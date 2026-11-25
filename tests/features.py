"""Browser checks for the feature batches of 2026-11-19 and -20 (F01–F26; there is no F05).

Run with: /home/sysadmin/.venv/bin/python tests/features.py [--only NAME]
   or, in a remote browser such as Edge on the Windows VM:
       python tests/features.py --write-fixture DIR --target http://127.0.0.1:PORT
       python tests/features.py --cdp http://127.0.0.1:9333 --url file:///C:/path/index.html --target ...

Locally it runs in Chromium in file mode and through serve.py's handler (with
--team), against a synthetic map whose web links point at a small local test
site (good and missing pages) for the link check.
"""

import argparse
import base64
import json
import sys
import tempfile
import urllib.error
import urllib.request
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

from drag_drop import drag_to, press_and_start, pt, system_moon, tray_row
from helpers import ARTIFACTS, ROOT, QuietHandler, check, download_json, saved_map, upload_json, write_fixture

sys.path.insert(0, str(ROOT))
import serve  # noqa: E402

VIEW = {"width": 1920, "height": 1080}
PROFILE = "full address:s:lab-box-server4:3390\r\nscreen mode id:i:1\r\ndesktopwidth:i:1280\r\n"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")


def make_map(target):
    """The personal map. Web links on `target` answer; /missing is a 404."""
    return {"groups": [
        {"id": "alpha", "name": "Alpha", "description": "First sun", "color": "#79d9f8", "links": [
            {"name": "Docs Portal", "url": f"{target}/ok/", "tags": ["docs", "prod"], "moons": [
                {"name": "Guide", "url": f"{target}/ok/guide.html", "tags": ["docs"]},
                {"name": "Broken Page", "url": f"{target}/missing"},
            ]},
            {"name": "Status", "url": "https://status.example.test/", "moons": [
                {"name": "Status History", "url": "https://status.example.test/history"},
            ]},
            {"name": "Lab Box", "type": "rdp", "host": "lab-box", "moons": [
                {"name": "lab-box-server3", "type": "rdp", "host": "lab-box-server3"},
                {"name": "lab-box-server4", "type": "rdp", "host": "lab-box-server4:3390", "rdpProfile": PROFILE},
            ]},
        ]},
        {"id": "beta", "name": "Beta", "description": "Second sun", "color": "#c49bff", "links": [
            {"name": "Docs Mirror", "url": f"{target}/ok", "moons": []},
            {"name": "Wiki", "url": "https://wiki.example.test/", "moons": []},
        ]},
    ]}


TEAM = {"groups": [{"id": "ops", "name": "Ops", "description": "Team sun", "color": "#ffad6e", "links": [
    {"name": "Runbook", "url": "https://runbook.example.test/", "moons": [
        {"name": "Pager", "url": "https://pager.example.test/"}]},
]}]}

BOOKMARKS = """<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><H3>Work Stuff</H3>
        <DL><p>
            <DT><A HREF="https://tracker.example.test/">Tracker</A>
            <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
            <DT><H3>Reports</H3>
            <DL><p>
                <DT><A HREF="https://reports.example.test/">Reports home</A>
                <DT><A HREF="https://reports.example.test/q3">Q3</A>
            </DL><p>
        </DL><p>
        <DT><A HREF="https://news.example.test/">News</A>
    </DL><p>
    <DT><A HREF="https://loose.example.test/">Loose link</A>
</DL><p>
"""


class Ctx:
    """What every check needs: the page, the Orbit URL, and the run mode."""

    def __init__(self, page, url, mode, target, server_mode):
        self.page, self.url, self.mode, self.target, self.server_mode = page, url, mode, target, server_mode
        self.data = make_map(target)


def fresh(ctx, hash_=""):
    page = ctx.page
    page.goto(ctx.url.split("#")[0], wait_until="load")
    page.evaluate("localStorage.clear()")
    page.goto(ctx.url.split("#")[0] + hash_, wait_until="load")
    page.reload(wait_until="load")
    page.locator(".home-hub, .detail-heading, .galaxy-list").first.wait_for()


def stored(page):
    text = saved_map(page)
    return json.loads(text)["groups"] if text else None


def popups(page, action, expect=0):
    """Run `action` and return the URLs of the tabs it opened.

    With `expect`, wait up to 5 s for that many tabs before the usual 700 ms
    settle (which catches extra tabs), so a slow browser isn't read as no tab.
    """
    opened = []

    def collect(tab):
        opened.append(tab)
    page.context.on("page", collect)
    action()
    for _ in range(50):
        if len(opened) >= expect:
            break
        page.wait_for_timeout(100)
    page.wait_for_timeout(700)
    page.context.remove_listener("page", collect)
    urls = []
    for tab in opened:
        try:
            tab.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:  # noqa: BLE001 - a blocked or failed load still counts as opened
            pass
        # A new tab can report about:blank until its navigation starts.
        for _ in range(50):
            if tab.url != "about:blank":
                break
            page.wait_for_timeout(100)
        urls.append(tab.url)
        tab.close()
    return urls


def open_editor(page):
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    page.get_by_role("button", name="Edit links").click()
    page.locator(".editor-tree").wait_for()


def tree(page, cls, text):
    return page.locator(f".editor-tree .{cls}").filter(has_text=text).first


def close_menu(page):
    if page.locator("#menu-overlay").is_visible():
        page.locator("#menu-close").click()


def search(page, text):
    page.locator("#quick-find").fill(text)
    page.wait_for_timeout(120)
    return page.locator(".find-item strong").all_inner_texts()


# ---- F01 Recent and favorites ----------------------------------------------

def f01_recent_favorites(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    check(page.locator(".quick-bar").count() == 0, f"{mode}: no quick bar before anything is opened")
    search(page, "docs portal")
    urls = popups(page, lambda: page.locator("a.find-item").filter(has_text="Docs Portal").first.click(), expect=1)
    check(urls and urls[0].rstrip("/").endswith("/ok"), f"{mode}: the result opened ({urls})")
    search(page, "guide")
    page.locator(".find-row").filter(has_text="Guide").locator(".favorite-toggle").click()
    check(stored(page)[0]["links"][0]["moons"][0].get("favorite") is True, f"{mode}: the favorite is saved on the moon")
    search(page, "")
    rows = {row.locator(".quick-label").inner_text(): row.locator(".quick-chip").all_inner_texts()
            for row in page.locator(".quick-row").all()}
    check(rows == {"Favorites": ["Guide"], "Recent": ["Docs Portal"]}, f"{mode}: the quick bar shows them ({rows})")
    page.reload(wait_until="load")
    page.locator(".quick-chip").first.wait_for()
    check(page.locator(".quick-chip").count() == 2, f"{mode}: favorites and recent survive a reload")
    # A chip opens its link and moves to the front of Recent.
    urls = popups(page, lambda: page.locator(".quick-chip").filter(has_text="Guide").click(), expect=1)
    check(urls and urls[0].endswith("/ok/guide.html"), f"{mode}: a chip opens its link")
    check(page.locator(".quick-row").nth(1).locator(".quick-chip").all_inner_texts() == ["Guide", "Docs Portal"],
          f"{mode}: the opened link is first in Recent")
    # In Edit mode a chip opens Edit links on that item instead.
    page.locator("#edit-toggle").click()
    urls = popups(page, lambda: page.locator(".quick-chip").first.click())
    check(not urls and "Edit Guide" in page.locator(".editor-pane").inner_text(),
          f"{mode}: in Edit mode a chip opens Edit links ({urls})")
    close_menu(page)
    page.locator("#edit-toggle").click()
    # Settings: hide the bar, and clear Recent.
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    page.get_by_role("button", name="Clear recent links").click()
    page.get_by_label("Show favorites and recent", exact=True).uncheck()
    close_menu(page)
    check(page.locator(".quick-bar").count() == 0, f"{mode}: the setting hides the quick bar")
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    page.get_by_label("Show favorites and recent", exact=True).check()
    close_menu(page)
    check(page.locator(".quick-row").all_inner_texts() and page.locator(".quick-label").all_inner_texts() == ["Favorites"],
          f"{mode}: Clear recent leaves only Favorites")
    print(f"PASS F01 recent and favorites ({mode})")


# ---- F02 Open all ----------------------------------------------------------

def f02_open_all(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx, "#group/alpha")
    row = page.locator(".open-all-row")
    check(row.locator("button").all_inner_texts() == ["Docs Portal + 2 moons", "Status + 1 moon", "Lab Box + 2 moons"],
          f"{mode}: one Open all button per planet with moons")
    # Playwright's Chromium allows every tab; Edge's pop-up blocker allows the
    # first and blocks the rest. Either way the notice must say what happened.
    def opened_or_reported(urls, total, name):
        notice = page.locator("#open-all-notice").inner_text()
        if len(urls) == total:
            return notice == f"Opened {total} tabs for {name}."
        blocked = total - len(urls)
        return f"blocked {blocked} tab{'s' if blocked != 1 else ''}" in notice and "Allow pop-ups" in notice
    urls = popups(page, lambda: row.get_by_role("button", name="Docs Portal + 2 moons").click(), expect=1)
    check(urls and urls[0].rstrip("/").endswith("/ok") and opened_or_reported(urls, 3, "Docs Portal"),
          f"{mode}: the planet and its moons open, or blocked tabs are reported ({urls})")
    # Shift+click a planet does the same.
    urls = popups(page, lambda: page.locator('.detail-satellite[data-planet="1"]').click(modifiers=["Shift"]), expect=1)
    check(urls and urls[0].rstrip("/") == "https://status.example.test" and opened_or_reported(urls, 2, "Status"),
          f"{mode}: Shift+click opens a planet with its moons ({urls})")
    # Remote Desktop links are left out.
    urls = popups(page, lambda: row.get_by_role("button", name="Lab Box + 2 moons").click())
    check(not urls and "has no website links" in page.locator("#open-all-notice").inner_text()
          and "3 Remote Desktop links left out" in page.locator("#open-all-notice").inner_text(),
          f"{mode}: Remote Desktop links are left out ({urls})")
    # A blocked pop-up is reported with how to allow them.
    page.evaluate("window.open = () => null")
    row.get_by_role("button", name="Docs Portal + 2 moons").click()
    notice = page.locator("#open-all-notice").inner_text()
    check("blocked 3 tabs" in notice and "Allow pop-ups" in notice, f"{mode}: blocked tabs are reported ({notice})")
    # Declining the question opens nothing.
    page.reload(wait_until="load")
    page.locator(".open-all-row").wait_for()
    DISMISS_NEXT.add(page)
    urls = popups(page, lambda: page.get_by_role("button", name="Docs Portal + 2 moons").click())
    check(not urls, f"{mode}: Cancel opens nothing")
    print(f"PASS F02 open all ({mode})")


# ---- F03 Smarter Quick find -------------------------------------------------

def f03_search(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    check(search(page, "lab box s3")[:1] == ["lab-box-server3"], f"{mode}: a short form finds lab-box-server3")
    names = search(page, "status.example")
    check(names[:1] == ["Status"] and "Address: status.example.test" in page.locator(".find-why").first.inner_text(),
          f"{mode}: an address matches and says why ({names})")
    check(sorted(search(page, "#docs")) == ["Docs Portal", "Guide"], f"{mode}: #docs keeps only tagged links")
    check(sorted(search(page, "tag:prod")) == ["Docs Portal"], f"{mode}: tag:prod works too")
    check(page.locator(".find-item .tag-chip").all_inner_texts() == ["#docs", "#prod"], f"{mode}: results show their tags")
    check(search(page, "docs protal")[:1] == ["Docs Portal"], f"{mode}: a typo still finds Docs Portal")
    check(search(page, "alpha") == ["Alpha"], f"{mode}: a sun's name does not list everything inside it")
    check(search(page, "alpha guide") == ["Guide"], f"{mode}: a sun's name narrows another word")
    check(search(page, "wiki")[:1] == ["Wiki"] and "Docs Portal" not in search(page, "wiki"),
          f"{mode}: unrelated links stay out")
    check(page.locator(".find-empty").count() == 0 and search(page, "zzzz-none") == [] and
          "#tag" in page.locator(".find-empty").inner_text(), f"{mode}: no results explains the options")
    print(f"PASS F03 smarter Quick find ({mode})")


# ---- F04 Command palette -----------------------------------------------------

def f04_palette(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    page.locator(".home-hub").first.focus()
    page.keyboard.press("Control+k")
    palette = page.locator(".palette")
    check(palette.is_visible() and page.evaluate("document.activeElement.classList.contains('palette-input')"),
          f"{mode}: Ctrl+K opens the palette with focus in it")
    page.keyboard.type("guide")
    options = page.locator(".palette-option strong").all_inner_texts()
    check(options[:1] == ["Guide"], f"{mode}: the palette finds a moon ({options})")
    urls = popups(page, lambda: page.keyboard.press("Enter"), expect=1)
    check(urls and urls[0].endswith("/ok/guide.html") and not palette.count(), f"{mode}: Enter opens it and closes ({urls})")
    page.keyboard.press("Control+k")
    page.keyboard.type("docs portal")
    labels = page.locator(".palette-option strong").all_inner_texts()
    check("Open all: Docs Portal + 2 moons" in labels, f"{mode}: Open all is offered for a planet ({labels})")
    page.keyboard.press("ArrowDown")
    check(page.locator('.palette-option[aria-selected="true"] strong').inner_text() == labels[1],
          f"{mode}: arrows move the selection")
    page.keyboard.press("Escape")
    check(page.locator(".palette").count() == 0 and page.evaluate("document.activeElement.classList.contains('home-hub')"),
          f"{mode}: Escape closes it and returns focus")
    page.keyboard.press("Control+k")
    page.keyboard.type("turn on edit")
    page.keyboard.press("Enter")
    check(page.locator("#edit-toggle").get_attribute("aria-pressed") == "true", f"{mode}: a command turns Edit mode on")
    page.keyboard.press("Control+k")
    page.keyboard.type("guide")
    urls = popups(page, lambda: page.keyboard.press("Enter"))
    check(not urls and "Edit Guide" in page.locator(".editor-pane").inner_text(),
          f"{mode}: in Edit mode a result opens Edit links")
    # The palette does not open over the menu, and Escape closes the menu.
    page.keyboard.press("Control+k")
    check(page.locator(".palette").count() == 0, f"{mode}: Ctrl+K does nothing while the menu is open")
    page.keyboard.press("Escape")
    page.keyboard.press("Control+k")
    page.keyboard.type("lab box")
    page.keyboard.press("Enter")
    page.wait_for_timeout(200)
    check("lab-box" in page.locator(".editor-pane").inner_text() or page.locator(".editor-pane").count() == 1,
          f"{mode}: a Remote Desktop result in Edit mode opens Edit links")
    page.keyboard.press("Escape")
    page.keyboard.press("Escape")
    check(page.locator("#edit-toggle").get_attribute("aria-pressed") == "false", f"{mode}: Escape layers still work")
    print(f"PASS F04 command palette ({mode})")


# ---- F06 Bulk Remote Desktop settings -------------------------------------------

def f06_bulk_rdp(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    open_editor(page)
    tree(page, "editor-tree-planet", "Lab Box").click()
    page.get_by_role("button", name="Apply RDP settings to moons").click()
    page.get_by_label("Settings from", exact=True).select_option(label="lab-box-server4’s imported settings")
    settings = page.locator(".rdp-bulk-settings li").all_inner_texts()
    check(settings == ["screen mode id:i:1", "desktopwidth:i:1280"], f"{mode}: the settings are listed ({settings})")
    check(page.locator(".editor-check input").count() == 3, f"{mode}: the planet and both moons can be chosen")
    page.get_by_role("button", name="Apply to selected links").click()
    lab = stored(page)[0]["links"][2]
    for item in (lab, *lab["moons"]):
        rows = item["rdpProfile"].split("\r\n")
        check(rows[0] == f"full address:s:{item['host']}" and "desktopwidth:i:1280" in rows,
              f"{mode}: {item['name']} gets the settings with its own computer")
    # Clearing from the planet only.
    page.get_by_role("button", name="Apply RDP settings to moons").click()
    checks = page.locator(".editor-check input")
    checks.nth(1).uncheck()
    checks.nth(2).uncheck()
    page.get_by_role("button", name="Clear imported settings").click()
    lab = stored(page)[0]["links"][2]
    check("rdpProfile" not in lab and all("rdpProfile" in moon for moon in lab["moons"]),
          f"{mode}: Clear removes settings only from the chosen links")
    # A file with a password: the password is never kept.
    page.get_by_role("button", name="Apply RDP settings to moons").click()
    with page.expect_file_chooser() as chooser:
        page.get_by_role("button", name="Choose .rdp file").click()
    chooser.value.set_files({"name": "team.rdp", "mimeType": "application/x-rdp",
                             "buffer": b"full address:s:other\r\nsession bpp:i:24\r\npassword 51:b:SECRET\r\n"})
    page.locator(".rdp-bulk-settings li").first.wait_for()
    check(page.locator(".rdp-bulk-preview").inner_text().count("sensitive setting") == 1, f"{mode}: excluded settings are reported")
    page.get_by_role("button", name="Apply to selected links").click()
    check("SECRET" not in json.dumps(stored(page)) and "session bpp:i:24" in stored(page)[0]["links"][2]["rdpProfile"],
          f"{mode}: settings from a file apply without its password")
    close_menu(page)
    print(f"PASS F06 bulk Remote Desktop settings ({mode})")


# ---- F07 Tags ------------------------------------------------------------------

def f07_tags(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    open_editor(page)
    tree(page, "editor-tree-planet", "Status").click()
    page.get_by_label("Tags", exact=True).fill("bad_tag!")
    page.get_by_role("button", name="Save planet").click()
    check("invalid tag" in page.locator(".editor-error").inner_text(), f"{mode}: an invalid tag is refused")
    page.get_by_label("Tags", exact=True).fill("Ops, public, ops")
    page.get_by_role("button", name="Save planet").click()
    check(stored(page)[0]["links"][1]["tags"] == ["ops", "public"], f"{mode}: tags are saved lowercase without repeats")
    check("#ops" in tree(page, "editor-tree-planet", "Status").inner_text(), f"{mode}: the tree shows tags")
    page.locator(".editor-header .editor-back").click()
    page.locator(".editor-header .editor-back").click()
    buttons = page.locator(".tag-button").all_inner_texts()
    check(buttons[:1] == ["#docs · 2"] and "#ops · 1" in buttons, f"{mode}: the start screen lists tags ({buttons})")
    page.locator(".tag-button").filter(has_text="#ops").click()
    page.locator(".find-results").wait_for()
    check(page.locator("#quick-find").input_value() == "#ops" and
          page.locator(".find-item strong").all_inner_texts() == ["Status"], f"{mode}: a tag button runs that search")
    print(f"PASS F07 tags ({mode})")


# ---- F08 Broken-link check -----------------------------------------------------

def f08_link_check(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    open_editor(page)
    button = page.get_by_role("button", name="Check links")
    if not ctx.server_mode:
        button.hover()
        tooltip = page.get_by_role("tooltip")
        tooltip.wait_for()
        check(button.is_disabled() and "python3 serve.py" in tooltip.inner_text(), f"{mode}: file mode explains serve.py")
        close_menu(page)
        print(f"PASS F08 link check explains serve.py ({mode})")
        return
    button.click()
    page.get_by_role("button", name="Start check").click()
    page.wait_for_function("document.querySelector('.link-check-status').textContent.startsWith('Checked ') && !document.querySelector('.link-check-status').textContent.includes('…')", timeout=60000)
    failures = [name.strip() for name in page.locator(".link-check-failure strong").all_inner_texts()]
    check("Broken Page" in failures and page.locator(".link-check-failure strong").filter(has_text="Broken Page")
          .locator("svg.icon-triangle-alert").count() == 1, f"{mode}: the missing page is reported with a warning icon ({failures})")
    check(not any(name.endswith(("Docs Portal", "Guide", "Docs Mirror")) for name in failures),
          f"{mode}: working pages pass ({failures})")
    check("HTTP 404" in page.locator(".link-check-failure").filter(has_text="Broken Page").inner_text(),
          f"{mode}: the status is shown")
    check(tree(page, "editor-tree-moon", "Broken Page").locator(".broken-mark").count() == 1,
          f"{mode}: the tree marks the broken link")
    page.locator(".link-check-failure").filter(has_text="Broken Page").get_by_role("button", name="Edit").click()
    check("Edit Broken Page" in page.locator(".editor-pane").inner_text(), f"{mode}: Edit opens the broken link")
    close_menu(page)
    # The API refuses requests that did not come from Orbit itself.
    base = ctx.url.split("/index.html")[0]
    api = f"{base}/api/check-links"
    body = json.dumps({"urls": [f"{ctx.target}/ok/"]}).encode()
    for headers, label in (({"Content-Type": "application/json"}, "without the Orbit header"),
                           ({"Content-Type": "text/plain", "X-Orbit-Check": "1"}, "as plain text"),
                           ({"Content-Type": "application/json", "X-Orbit-Check": "1", "Origin": "https://evil.example"},
                            "with another site's Origin")):
        try:
            status = urllib.request.urlopen(urllib.request.Request(api, data=body, headers=headers), timeout=10).status
        except urllib.error.HTTPError as error:
            status = error.code
        check(status == 403, f"{mode}: the API refuses a request {label} ({status})")
    # A page on another site cannot use it: the browser's preflight is never approved.
    other = page.context.new_page()
    other.goto(f"{ctx.target}/ok/")
    result = other.evaluate("""async url => {
      try { return (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Orbit-Check': '1' },
        body: '{"urls": []}' })).status; }
      catch { return 'blocked'; } }""", api)
    other.close()
    check(result == "blocked", f"{mode}: another site's page is blocked ({result})")
    print(f"PASS F08 link check ({mode})")


# ---- F09 Version history -------------------------------------------------------

def f09_history(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    open_editor(page)
    page.get_by_role("button", name="History", exact=True).click()
    check("No earlier versions" in page.locator(".editor-pane").inner_text(), f"{mode}: history starts empty")
    tree(page, "editor-tree-planet", "Wiki").click()
    page.get_by_label("Planet name", exact=True).fill("Team Wiki")
    page.get_by_role("button", name="Save planet").click()
    page.get_by_role("button", name="Remove planet").click()
    check([link["name"] for link in stored(page)[1]["links"]] == ["Docs Mirror"], f"{mode}: the planet is gone")
    page.locator(".editor-header .editor-back").click()
    page.get_by_role("button", name="History", exact=True).click()
    rows = page.locator(".history-row strong").all_inner_texts()
    check(rows == ["Before: Removed planet Team Wiki", "Before: Saved planet Team Wiki"], f"{mode}: changes are listed ({rows})")
    check("+1 planet" in page.locator(".history-row small").first.inner_text(), f"{mode}: the difference is shown")
    page.locator(".history-row").nth(1).get_by_role("button", name="Restore").click()
    check([link["name"] for link in stored(page)[1]["links"]] == ["Docs Mirror", "Wiki"], f"{mode}: the older version is back")
    rows = page.locator(".history-row strong").all_inner_texts()
    check(rows[0].startswith("Before: Restored the version from"), f"{mode}: a restore can be undone ({rows[:1]})")
    # Drags and resets are recorded as well.
    close_menu(page)
    page.evaluate("""() => { const next = OrbitTest.groups(); next.reverse();
      OrbitTest.saveMap(next, { label: 'Moved sun test' }); }""")
    open_editor(page)
    page.get_by_role("button", name="Reset to file data").click()
    page.get_by_role("button", name="History", exact=True).click()
    rows = page.locator(".history-row strong").all_inner_texts()
    check(rows[:2] == ["Before: Reset to file data", "Before: Moved sun test"], f"{mode}: resets and other saves are kept ({rows[:2]})")
    close_menu(page)
    print(f"PASS F09 version history ({mode})")


# ---- F10 Duplicates ------------------------------------------------------------

def f10_duplicates(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    open_editor(page)
    page.get_by_role("button", name="Find duplicates").click()
    groups = page.locator(".duplicate-group")
    check(groups.count() == 1, f"{mode}: one address is used twice ({groups.count()})")
    rows = groups.first.locator(".editor-list-row span").all_inner_texts()
    check(rows == ["Alpha → Docs Portal", "Beta → Docs Mirror"], f"{mode}: both places are listed ({rows})")
    groups.first.get_by_role("button", name="Edit").nth(1).click()
    check("Also in Alpha → Docs Portal" in page.locator(".editor-note").inner_text(), f"{mode}: the editor notes the duplicate")
    tree(page, "editor-tree-planet", "Status").click()
    check(page.locator(".editor-pane .editor-note").count() == 0, f"{mode}: a unique link has no note")
    close_menu(page)
    print(f"PASS F10 duplicates ({mode})")


# ---- F11 Merge import ----------------------------------------------------------

def f11_merge_import(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    before = json.loads(json.dumps(ctx.data["groups"]))
    incoming = {"groups": [
        {"id": "alpha", "name": "Alpha", "links": [
            {"name": "Docs Portal again", "url": f"{ctx.target}/ok/#top", "moons": [
                {"name": "Guide", "url": f"{ctx.target}/ok/guide.html"},
                {"name": "New Moon", "url": "https://moon.example.test/"}]},
            {"name": "Extra", "url": "https://extra.example.test/"}]},
        {"name": "Gamma", "links": [{"name": "G1", "url": "https://g1.example.test/"}]},
    ]}
    open_editor(page)
    with page.expect_file_chooser() as chooser:
        page.get_by_role("button", name="Import a file", exact=True).click()
    chooser.value.set_files({"name": "more.json", "mimeType": "application/json", "buffer": json.dumps(incoming).encode()})
    page.wait_for_selector(".import-merge-summary, .editor-error")
    summary = page.locator(".import-merge-summary").inner_text()
    check("adds 1 sun, 2 planets, and 1 moon" in summary and "2 links already in your map are skipped" in summary,
          f"{mode}: the review shows what is new ({summary})")
    check(page.get_by_role("button", name="Replace my map").count() == 1, f"{mode}: Replace is offered")
    page.get_by_role("button", name="Merge into my map").click()
    after = stored(page)
    alpha = after[0]
    check([link["name"] for link in alpha["links"]] == ["Docs Portal", "Status", "Lab Box", "Extra"],
          f"{mode}: the new planet is appended")
    check([moon["name"] for moon in alpha["links"][0]["moons"]] == ["Guide", "Broken Page", "New Moon"],
          f"{mode}: the new moon joins the matching planet")
    check(alpha["links"][0]["name"] == "Docs Portal" and after[1] == before[1], f"{mode}: existing items are unchanged")
    check([sun["name"] for sun in after] == ["Alpha", "Beta", "Gamma"], f"{mode}: the new sun is added")
    # The same file again adds nothing.
    with page.expect_file_chooser() as chooser:
        page.get_by_role("button", name="Import a file", exact=True).click()
    chooser.value.set_files({"name": "more.json", "mimeType": "application/json", "buffer": json.dumps(incoming).encode()})
    page.wait_for_selector(".import-merge-summary, .editor-error")
    check(page.get_by_role("button", name="Merge into my map").is_disabled(), f"{mode}: nothing new means nothing to merge")
    close_menu(page)
    print(f"PASS F11 merge import ({mode})")


# ---- F12 Team map --------------------------------------------------------------

def f12_team(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    hubs = page.locator(".hub-name").all_inner_texts()
    check(hubs == ["Ops", "Alpha", "Beta"], f"{mode}: the team sun comes first ({hubs})")
    check(page.locator(".team-card .team-mark").inner_text() == "TEAM", f"{mode}: it is marked TEAM")
    check(search(page, "runbook") == ["Runbook"], f"{mode}: Quick find includes team links")
    page.locator(".find-row").filter(has_text="Runbook").locator(".favorite-toggle").click()
    search(page, "")
    check(page.locator(".quick-chip").all_inner_texts() == ["Runbook"], f"{mode}: a team link can be a favorite")
    check(page.evaluate("localStorage.getItem('orbit:team-favorites')") == '["https://runbook.example.test"]',
          f"{mode}: a team favorite is a preference")
    # Team links can be viewed and exported without changing the team map.
    page.locator("#edit-toggle").click()
    hub = page.locator(".home-hub").first
    hub.hover()
    planet = page.locator('.home-satellite[data-sun="0"]').first
    planet.wait_for(state="visible")
    # Planets glide out from their sun (0.35 s); press where the planet settles.
    page.wait_for_timeout(450)
    box = planet.bounding_box()
    target = page.locator('.home-hub[data-sun="1"]').bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(target["x"] + 40, target["y"] + 40, steps=8)
    page.mouse.up()
    check("read-only" in page.locator("#edit-status").inner_text() and stored(page) is None,
          f"{mode}: team items cannot be dragged")
    page.locator("#edit-toggle").click()
    open_editor(page)
    tree(page, "editor-tree-sun", "Ops").click()
    for name, kind in (("Runbook", "planet"), ("Pager", "moon")):
        label = f"Export {name}"
        button = page.get_by_role("button", name=label, exact=True)
        exported_item = (button.evaluate("node => OrbitTest.captureDownload(() => node.click())")
                         if mode.startswith("remote") else download_json(page, label))
        check(exported_item["kind"] == kind and exported_item["item"]["name"] == name and stored(page) is None,
              f"{mode}: the team {kind} row exports without modifying the map")
        if kind == "planet":
            page.locator(".editor-list-row").filter(has_text=name).get_by_role("button", name="View").click()
    pane = page.locator(".editor-pane").inner_text()
    check("read-only team planet" in pane and page.get_by_role("button", name="Save planet").count() == 0,
          f"{mode}: a team planet is read-only")
    page.get_by_label("Copy to", exact=True).select_option(label="Beta")
    page.get_by_role("button", name="Copy planet to my map").click()
    beta = stored(page)[1]
    check([link["name"] for link in beta["links"]][-1] == "Runbook" and "team" not in json.dumps(stored(page)),
          f"{mode}: the copy is an ordinary personal planet")
    check(all(sun["id"] != "team:ops" for sun in stored(page)), f"{mode}: the team sun is never saved")
    page.locator(".editor-header .editor-back").click()
    page.locator(".editor-header .editor-back").click()
    if mode.startswith("remote"):
        # A remote browser's download cannot be read here; take the data
        # Whole map (JSON) hands to the download instead.
        exported = page.evaluate("OrbitTest.captureDownload(() => OrbitTest.actions.exportMap())")
    else:
        with page.expect_download() as download:
            page.get_by_role("button", name="Whole map (JSON)", exact=True).click()
        exported = json.loads(Path(download.value.path()).read_text())
    check([sun["name"] for sun in exported["groups"]] == ["Alpha", "Beta"], f"{mode}: Export leaves the team map out")
    tree(page, "editor-tree-sun", "Ops").click()
    page.get_by_role("button", name="Hide this team sun").click()
    close_menu(page)
    check(page.locator(".hub-name").all_inner_texts() == ["Alpha", "Beta"], f"{mode}: a team sun can be hidden")
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    source = page.locator(".team-source").inner_text()
    check("1 team sun from" in source, f"{mode}: Settings shows the team map source ({source})")
    page.locator(".team-settings").get_by_role("button", name="Show").click()
    close_menu(page)
    check(page.locator(".hub-name").all_inner_texts()[0] == "Ops", f"{mode}: and shown again")
    print(f"PASS F12 team map ({mode})")


# ---- F13 Bookmark import -------------------------------------------------------

def f13_bookmarks(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    open_editor(page)
    with page.expect_file_chooser() as chooser:
        page.get_by_role("button", name="Import a file").click()
    chooser.value.set_files({"name": "bookmarks.html", "mimeType": "text/html", "buffer": BOOKMARKS.encode()})
    page.wait_for_selector(".import-merge-summary, .editor-error")
    pane = page.locator(".editor-pane").inner_text()
    check("Read 5 website bookmarks; skipped 1 other link" in pane, f"{mode}: the review counts links ({pane[:300]})")
    check(page.get_by_role("button", name="Replace my map").count() == 0, f"{mode}: bookmarks never replace the map")
    page.get_by_role("button", name="Merge into my map").click()
    suns = {sun["name"]: sun for sun in stored(page)}
    check(set(suns) == {"Alpha", "Beta", "Work Stuff", "Bookmarks bar", "Bookmarks"}, f"{mode}: folders became suns ({list(suns)})")
    work = suns["Work Stuff"]["links"]
    check([link["name"] for link in work] == ["Tracker", "Reports"] and
          work[1]["type"] == "group" and "url" not in work[1] and
          [moon["name"] for moon in work[1]["moons"]] == ["Reports home", "Q3"],
          f"{mode}: a subfolder became a planet with moons ({work})")
    check([link["name"] for link in suns["Bookmarks bar"]["links"]] == ["News"] and
          [link["name"] for link in suns["Bookmarks"]["links"]] == ["Loose link"], f"{mode}: loose links have a home")
    check("javascript" not in json.dumps(stored(page)), f"{mode}: script links are skipped")
    close_menu(page)
    print(f"PASS F13 bookmark import ({mode})")


# ---- F14 Icons -----------------------------------------------------------------

def f14_icons(ctx):
    page, mode = ctx.page, ctx.mode
    # With a Playwright route in place, this Chromium does not load images at
    # all; without one, the example sites simply fail (they do not exist).
    page.context.unroute_all()
    fresh(ctx)
    check(page.locator(".site-icon").count() == 0, f"{mode}: site icons are off by default")
    open_editor(page)
    tree(page, "editor-tree-sun", "Alpha").click()
    page.get_by_label("Icon", exact=True).fill("abc")
    page.get_by_role("button", name="Save sun").click()
    check("one or two characters" in page.locator(".editor-error").inner_text(), f"{mode}: a long icon is refused")
    page.get_by_label("Icon", exact=True).fill("🧪")
    page.get_by_role("button", name="Save sun").click()
    check(stored(page)[0]["icon"] == "🧪", f"{mode}: the icon is saved")
    check(tree(page, "editor-tree-sun", "Alpha").inner_text().startswith("🧪"), f"{mode}: the tree shows the icon")
    close_menu(page)
    check(page.locator('.home-hub[data-sun="1"] .hub-icon').inner_text() == "🧪", f"{mode}: the Galaxy hub shows it")
    sizes_before = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--home-planet-size')")
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    check("favicon.ico" in page.locator(".menu-content").inner_text(), f"{mode}: the setting says where icons come from")
    page.get_by_label("Show site icons", exact=True).check()
    close_menu(page)
    sources = page.evaluate("OrbitTest.groups()[1].links.map(link => OrbitTest.helpers.siteIcon(link)?.getAttribute('src') ?? null)")
    check(sources == [f"{ctx.target}/favicon.ico", "https://status.example.test/favicon.ico", None],
          f"{mode}: each icon comes from its own site, and Remote Desktop links have none ({sources})")
    page.locator('.home-hub[data-sun="1"]').hover()
    page.wait_for_timeout(1500)
    # The local test site has a favicon; the example sites answer 404.
    check(page.locator('.home-satellite[data-sun="1"][data-planet="0"] .site-icon').count() == 1,
          f"{mode}: an icon that loads stays")
    # A site that refuses the request at once (a closed local port).
    page.evaluate("""() => { const node = OrbitTest.helpers.destinationNode({ name: 'Closed', url: 'http://127.0.0.1:9/' }, 'probe-link');
      node.id = 'icon-probe'; document.body.append(node); }""")
    try:
        page.wait_for_function("!document.querySelector('#icon-probe .site-icon')", timeout=10000)
        removed = True
    except Exception:  # noqa: BLE001 - reported by the check below
        removed = False
    check(removed, f"{mode}: an icon that fails is removed")
    sizes_after = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--home-planet-size')")
    check(int(sizes_after.strip()[:-2]) >= int(sizes_before.strip()[:-2]), f"{mode}: circles leave room for icons")
    page.screenshot(path=str(ARTIFACTS / f"features-icons-{mode}.png"))
    print(f"PASS F14 icons ({mode})")


# ---- F15 List view -------------------------------------------------------------

def f15_list(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    page.locator("#view-toggle").click()
    page.locator(".galaxy-list").wait_for()
    names = page.locator(".list-sun-name").all_inner_texts()
    check(names == ["Ops", "Alpha", "Beta"], f"{mode}: the list shows every sun ({names})")
    check(page.locator(".list-link").count() == 2 + 8 + 2, f"{mode}: and every planet and moon")
    check(page.locator("#view-toggle").get_attribute("aria-pressed") == "true", f"{mode}: the toggle shows its state")
    urls = popups(page, lambda: page.locator(".list-link").filter(has_text="Guide").click(), expect=1)
    check(urls and urls[0].endswith("/ok/guide.html"), f"{mode}: a list link opens ({urls})")
    page.locator(".list-link").filter(has_text="Docs Portal").focus()
    page.keyboard.press("Tab")
    check(page.evaluate("document.activeElement.classList.contains('list-link')"), f"{mode}: Tab moves through the list")
    page.reload(wait_until="load")
    page.locator(".galaxy-list").wait_for()
    page.screenshot(path=str(ARTIFACTS / f"features-list-{mode}.png"), full_page=True)
    page.locator(".list-sun").nth(1).locator(".list-open").click()
    page.locator(".detail-heading").wait_for()
    check(page.locator(".detail-heading h1").inner_text() == "Alpha", f"{mode}: Open System works")
    page.locator(".back-link").click()
    page.locator(".galaxy-list").wait_for()
    check(len(search(page, "guide")) == 1 and page.locator(".galaxy-list").is_hidden(), f"{mode}: Quick find works in the list")
    search(page, "")
    page.locator("#edit-toggle").click()
    check("Dragging works in the Orbits view" in page.locator(".list-note").inner_text(), f"{mode}: Edit mode explains dragging")
    urls = popups(page, lambda: page.locator(".list-link").filter(has_text="Guide").click())
    check(not urls and "Edit Guide" in page.locator(".editor-pane").inner_text(), f"{mode}: Edit mode opens Edit links")
    close_menu(page)
    page.locator("#edit-toggle").click()
    page.locator("#view-toggle").click()
    page.locator(".group-grid").wait_for()
    check(page.evaluate("localStorage.getItem('orbit:galaxy-view')") == "orbits", f"{mode}: the choice is remembered")
    print(f"PASS F15 list view ({mode})")


# ---- F16 Open all favorites ------------------------------------------------

def f16_open_all_favorites(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    for name in ("Guide", "Status"):
        search(page, name.lower())
        page.locator(".find-row").filter(has_text=name).first.locator(".favorite-toggle").click()
    search(page, "")
    button = page.locator(".quick-open-all")
    check(button.inner_text() == "Open all (2)", f"{mode}: the Favorites row offers Open all")
    urls = popups(page, button.click, expect=1)
    notice = page.locator("#open-all-notice").inner_text()
    check(urls and (notice == "Opened 2 tabs for your favorites." or "blocked 1 tab" in notice),
          f"{mode}: Open all opens every favorite or reports blocked tabs ({urls}, {notice})")
    page.keyboard.press("Control+k")
    page.keyboard.type("open all fav")
    check(page.locator(".palette-option strong").first.inner_text() == "Open all favorites", f"{mode}: the palette offers it")
    page.keyboard.press("Escape")
    page.locator("#edit-toggle").click()
    check(page.locator(".quick-open-all").count() == 0, f"{mode}: Open all is hidden in Edit mode")
    page.locator("#edit-toggle").click()
    print(f"PASS F16 open all favorites ({mode})")


# ---- F17 Routines ----------------------------------------------------------

def make_routine(page, name, labels):
    if page.get_by_role("button", name="New routine").count() == 0:
        page.get_by_role("button", name="Routines", exact=True).click()
    page.get_by_role("button", name="New routine").click()
    page.get_by_label("Routine name", exact=True).fill(name)
    for label in labels:
        page.locator(".routine-choice").filter(has_text=label).first.locator("input").check()
    page.get_by_role("button", name="Add routine").click()


def f17_routines(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    open_editor(page)
    make_routine(page, "Morning", ["Docs Portal → Guide", "Lab Box (Remote", "Runbook", "Wiki"])
    saved = json.loads(saved_map(page))["routines"]
    check([routine["name"] for routine in saved] == ["Morning"] and len(saved[0]["links"]) == 4,
          f"{mode}: the routine is saved with the map ({saved})")
    check([link["name"] for link in saved[0]["links"]] == ["Runbook", "Guide", "Lab Box", "Wiki"],
          f"{mode}: links follow the map order ({[link['name'] for link in saved[0]['links']]})")
    rows = page.locator(".routine-row small").all_inner_texts()
    check(rows == ["4 links · No schedule"], f"{mode}: the list summarizes it ({rows})")
    # A name already used is refused.
    make_routine(page, "morning", ["Wiki"])
    check("already a routine named" in page.locator(".editor-error").inner_text(), f"{mode}: names are unique")
    # Renaming and moving a link keeps the routine working.
    tree(page, "editor-tree-moon", "Guide").click()
    page.get_by_label("Moon name", exact=True).fill("User Guide")
    page.get_by_role("button", name="Save moon").click()
    tree(page, "editor-tree-planet", "Wiki").click()
    page.get_by_role("button", name="Remove planet").click()
    page.locator(".editor-header .editor-back").click()
    page.get_by_role("button", name="Routines", exact=True).click()
    rows = page.locator(".routine-row small").all_inner_texts()
    check(rows == ["3 links (1 no longer on the map) · No schedule"], f"{mode}: renames survive and removals are counted ({rows})")
    close_menu(page)
    # The quick bar runs it without asking: web links open, Remote Desktop is left out.
    chip = page.locator(".routine-chip")
    check(page.locator(".quick-label").first.inner_text() == "Routines" and chip.inner_text() == "Morning",
          f"{mode}: the quick bar has a Routines row")
    urls = popups(page, chip.click, expect=1)
    notice = page.locator("#open-all-notice").inner_text()
    check(urls and ("Opened 2 tabs for Morning." in notice or "blocked 1 tab" in notice) and
          "1 Remote Desktop link left out" in notice and "1 link in this routine is no longer on the map" in notice,
          f"{mode}: the routine opens its links ({urls}, {notice})")
    # The palette, Edit mode, and history know about it.
    page.keyboard.press("Control+k")
    page.keyboard.type("run routine")
    check(page.locator(".palette-option strong").first.inner_text() == "Run routine: Morning", f"{mode}: the palette lists it")
    page.keyboard.press("Escape")
    page.locator("#edit-toggle").click()
    page.locator(".routine-chip").click()
    check("Edit Morning" in page.locator(".editor-pane").inner_text(), f"{mode}: in Edit mode the chip opens the editor")
    check(page.locator(".routine-choice input:checked").count() == 3, f"{mode}: the editor shows the chosen links")
    page.locator(".editor-header .editor-back").click()
    page.locator(".editor-header .editor-back").click()
    page.get_by_role("button", name="History", exact=True).click()
    check("Before: Added routine Morning" in page.locator(".history-row strong").all_inner_texts(), f"{mode}: history records it")
    close_menu(page)
    page.locator("#edit-toggle").click()
    # Export includes routines; merge adds new names only.
    exported = page.evaluate("OrbitTest.captureDownload(() => OrbitTest.actions.exportMap())")
    check([routine["name"] for routine in exported.get("routines", [])] == ["Morning"], f"{mode}: Whole map (JSON) includes routines")
    incoming = {"groups": [], "routines": [
        {"name": "MORNING", "links": [{"key": "https://wiki.example.test", "name": "Wiki"}]},
        {"name": "Evening", "links": [{"key": "https://status.example.test", "name": "Status"}],
         "schedule": {"time": "18:00", "days": [1, 2, 3, 4, 5]}}]}
    open_editor(page)
    with page.expect_file_chooser() as chooser:
        page.get_by_role("button", name="Import a file", exact=True).click()
    chooser.value.set_files({"name": "routines.json", "mimeType": "application/json", "buffer": json.dumps(incoming).encode()})
    page.wait_for_selector(".import-merge-summary, .editor-error")
    check("and 1 routine" in page.locator(".import-merge-summary").inner_text(), f"{mode}: the review counts the new routine")
    page.get_by_role("button", name="Merge into my map").click()
    saved = json.loads(saved_map(page))["routines"]
    check([routine["name"] for routine in saved] == ["Morning", "Evening"] and saved[1]["schedule"]["time"] == "18:00",
          f"{mode}: merge adds Evening and keeps Morning ({[routine['name'] for routine in saved]})")
    page.get_by_role("button", name="Routines", exact=True).click()
    page.locator(".routine-row").filter(has_text="Evening").get_by_role("button", name="Edit").click()
    page.get_by_role("button", name="Remove routine").click()
    check([routine["name"] for routine in json.loads(saved_map(page))["routines"]] == ["Morning"], f"{mode}: a routine can be removed")
    close_menu(page)
    print(f"PASS F17 routines ({mode})")


# ---- F18 Offer routines on arrival ------------------------------------------------

def set_routines(page, routines):
    page.evaluate("""list => { OrbitTest.saveMap(OrbitTest.groups(), { routines: list, label: 'test routines' });
      localStorage.removeItem('orbit:routine-offered:v1'); }""", routines)
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    page.wait_for_timeout(200)


def f18_arrival(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    now = page.evaluate("[new Date().getDay(), new Date().getHours() * 60 + new Date().getMinutes()]")
    links = [{"key": "https://status.example.test", "name": "Status"}, {"key": "https://wiki.example.test", "name": "Wiki"}]
    every_day = list(range(7))
    set_routines(page, [{"name": "Morning", "links": links, "schedule": {"time": "00:00", "days": every_day}}])
    banner = page.locator("#routine-banner")
    check(banner.is_visible() and banner.locator(".routine-offer-copy").inner_text() == "Time for Morning: 2 links.",
          f"{mode}: a due routine is offered")
    page.get_by_role("button", name="Not today").click()
    check(banner.count() == 0, f"{mode}: Not today closes the offer")
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    check(page.locator("#routine-banner").count() == 0, f"{mode}: it is not offered again today")
    set_routines(page, [{"name": "Morning", "links": links, "schedule": {"time": "00:00", "days": every_day}}])
    urls = popups(page, lambda: page.get_by_role("button", name="Open Morning").click(), expect=1)
    notice = page.locator("#open-all-notice").inner_text()
    check(urls and ("Opened 2 tabs for Morning." in notice or "blocked 1 tab" in notice), f"{mode}: Open opens the routine ({urls})")
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    check(page.locator("#routine-banner").count() == 0, f"{mode}: an opened routine is not offered again today")
    tomorrow = (now[0] + 1) % 7
    set_routines(page, [{"name": "Other day", "links": links, "schedule": {"time": "00:00", "days": [tomorrow]}}])
    check(page.locator("#routine-banner").count() == 0, f"{mode}: a routine for another day waits")
    if now[1] < 23 * 60 + 59:
        set_routines(page, [{"name": "Late", "links": links, "schedule": {"time": "23:59", "days": every_day}}])
        check(page.locator("#routine-banner").count() == 0, f"{mode}: a routine waits for its time")
    set_routines(page, [{"name": "A", "links": links[:1], "schedule": {"time": "00:00", "days": every_day}},
                        {"name": "B", "links": links[1:], "schedule": {"time": "00:00", "days": every_day}},
                        {"name": "Unscheduled", "links": links}])
    check(page.locator(".routine-offer").count() == 2, f"{mode}: due routines share the banner; unscheduled ones are not offered")
    page.locator("#edit-toggle").click()
    check(page.locator("#routine-banner").count() == 0, f"{mode}: Edit mode hides the offer")
    page.locator("#edit-toggle").click()
    check(page.locator(".routine-offer").count() == 2, f"{mode}: it returns when Edit mode is off")
    # The editor saves a schedule.
    open_editor(page)
    page.get_by_role("button", name="Routines", exact=True).click()
    page.locator(".routine-row").filter(has_text="Unscheduled").get_by_role("button", name="Edit").click()
    page.get_by_label("Offer this routine when Orbit opens", exact=True).check()
    page.get_by_label("Offer from", exact=True).fill("07:30")
    page.get_by_label("Sat", exact=True).check()
    page.get_by_role("button", name="Save routine").click()
    saved = [routine for routine in json.loads(saved_map(page))["routines"] if routine["name"] == "Unscheduled"][0]
    check(saved["schedule"] == {"time": "07:30", "days": [1, 2, 3, 4, 5, 6]}, f"{mode}: the schedule is saved ({saved})")
    check("Offered at 07:30, Mon, Tue, Wed, Thu, Fri, Sat" in page.locator(".editor-pane").inner_text(),
          f"{mode}: the list describes the schedule")
    close_menu(page)
    print(f"PASS F18 routine offers ({mode})")


# ---- Batch 3 helpers (in the page, `next[0]` is the team sun Ops) ------------------------------------------------------------

def save_map_js(page, script, label="test setup"):
    """Change the map in the page with JavaScript (`next` is a copy of the groups)."""
    page.evaluate(f"""() => {{ const next = OrbitTest.groups(); {script}; OrbitTest.saveMap(next, {{ label: '{label}' }}); }}""")


def capture_download(page, action_js):
    """Run JavaScript that downloads JSON and return the data instead of a file."""
    return page.evaluate(f"""() => OrbitTest.captureDownload(() => {{ {action_js}; }})""")


# ---- F19 Notes ------------------------------------------------------------------

def f19_notes(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    open_editor(page)
    tree(page, "editor-tree-planet", "Status").click()
    check(page.get_by_label("Note", exact=True).get_attribute("maxlength") == "500", f"{mode}: notes are limited to 500 characters")
    page.get_by_label("Note", exact=True).fill("Use the ops account")
    page.get_by_role("button", name="Save planet").click()
    check(stored(page)[0]["links"][1]["note"] == "Use the ops account", f"{mode}: the note is saved")
    close_menu(page)
    title = page.locator('.home-satellite[data-sun="1"][data-planet="1"]').get_attribute("title")
    check(title.endswith("\nUse the ops account"), f"{mode}: the tooltip shows the note ({title!r})")
    check(search(page, "ops account") == ["Status"] and page.locator(".find-why").inner_text() == "Matched the note"
          and page.locator(".find-note").inner_text() == "Use the ops account", f"{mode}: Quick find matches and shows notes")
    search(page, "")
    page.locator("#view-toggle").click()
    check("Use the ops account" in page.locator(".list-link").filter(has_text="Status").first.inner_text(),
          f"{mode}: the list view shows notes")
    page.locator("#view-toggle").click()
    page.evaluate("() => { try { OrbitTest.helpers.validDestination({ name: 'x', url: 'https://x.example/', note: 'n'.repeat(501) }, 'X'); window.__noteError = ''; } catch (e) { window.__noteError = e.message; } }")
    check("longer than 500" in page.evaluate("window.__noteError"), f"{mode}: a longer note is refused")
    print(f"PASS F19 notes ({mode})")


# ---- F20 Link variables ---------------------------------------------------------

def f20_variables(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    save_map_js(page, "next[1].links[1].moons.push({ name: 'Ticket', url: 'https://jira.example.test/browse/{ticket}?env={env}' })")
    # Open all leaves the link out until it has values.
    page.goto(ctx.url.split("#")[0] + "#group/alpha")
    page.locator(".open-all-row").wait_for()
    urls = popups(page, lambda: page.get_by_role("button", name="Status + 2 moons").click())
    notice = page.locator("#open-all-notice").inner_text()
    check("1 link with {placeholders} left out" in notice, f"{mode}: Open all waits for values ({notice})")
    page.locator(".back-link").click()
    page.locator(".home-hub").first.wait_for()
    search(page, "ticket")
    result = page.locator(".find-item").filter(has_text="Ticket").first
    check(result.get_attribute("href") is None, f"{mode}: a placeholder link is not a plain link")
    result.click()
    dialog = page.locator(".variable-form")
    check(dialog.is_visible() and page.evaluate("document.activeElement.getAttribute('aria-label')") == "ticket",
          f"{mode}: the form asks for the first value")
    page.get_by_label("ticket", exact=True).fill("ABC 12")
    page.get_by_label("env", exact=True).fill("prod")
    check(page.locator(".variable-preview").inner_text() == "https://jira.example.test/browse/ABC%2012?env=prod",
          f"{mode}: the preview fills and encodes the values")
    urls = popups(page, lambda: dialog.get_by_role("button", name="Open").click(), expect=1)
    check(urls == ["https://jira.example.test/browse/ABC%2012?env=prod"], f"{mode}: Open opens the filled address ({urls})")
    check(page.locator(".variable-form").count() == 0, f"{mode}: the form closes")
    search(page, "")
    check("Ticket" in page.locator(".quick-chip").all_inner_texts(), f"{mode}: the link is recorded as recent")
    page.locator(".quick-chip").filter(has_text="Ticket").click()
    check(page.get_by_label("ticket", exact=True).input_value() == "ABC 12", f"{mode}: the last values are remembered")
    urls = popups(page, lambda: page.keyboard.press("Escape"))
    check(not urls and page.locator(".variable-form").count() == 0 and page.locator(".home-hub").first.is_visible(),
          f"{mode}: Escape cancels without opening")
    page.goto(ctx.url.split("#")[0] + "#group/alpha")
    page.locator(".open-all-row").wait_for()
    urls = popups(page, lambda: page.get_by_role("button", name="Status + 2 moons").click())
    notice = page.locator("#open-all-notice").inner_text()
    check("placeholders" not in notice and (len(urls) == 3 or "blocked" in notice), f"{mode}: with values, Open all includes it ({notice})")
    if "https://jira.example.test/browse/ABC%2012?env=prod" not in urls and len(urls) == 3:
        check(False, f"{mode}: Open all uses the remembered values ({urls})")
    # A brace without a name is refused.
    open_editor(page)
    tree(page, "editor-tree-moon", "Ticket").click()
    page.locator(".editor-pane input[type='url']").fill("https://jira.example.test/{ticket")
    page.get_by_role("button", name="Save moon").click()
    check("http or https URL" in page.locator(".editor-error").inner_text(), f"{mode}: an unmatched brace is refused")
    close_menu(page)
    print(f"PASS F20 link variables ({mode})")


# ---- F21 Quick add --------------------------------------------------------------

def f21_quick_add(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    page.locator("#quick-find").fill("https://news.example.test/today")
    card = page.locator(".find-add")
    check(card.is_visible() and "https://news.example.test/today" in card.inner_text(), f"{mode}: an address offers Add this link")
    card.click()
    check(page.get_by_label("Address", exact=True).input_value() == "https://news.example.test/today" and
          page.get_by_label("Name", exact=True).input_value() == "News", f"{mode}: the form is prefilled")
    options = page.get_by_label("Add to", exact=True).locator("option").all_inner_texts()
    check("Beta (as a planet)" in options and "Alpha → Docs Portal (as a moon)" in options and
          not any(option.startswith("Ops") for option in options), f"{mode}: personal suns and planets are offered ({options})")
    page.get_by_label("Add to", exact=True).select_option(label="Beta (as a planet)")
    page.get_by_role("button", name="Add link").click()
    check(stored(page)[1]["links"][-1] == {"name": "News", "url": "https://news.example.test/today", "moons": []},
          f"{mode}: a planet is added")
    check("Edit News" in page.locator(".editor-pane").inner_text(), f"{mode}: the new planet opens in the editor")
    close_menu(page)
    page.locator("#quick-find").fill("")
    page.keyboard.press("Control+k")
    page.keyboard.type("www.weather.example.test")
    check(page.locator(".palette-option strong").first.inner_text() == "Add https://www.weather.example.test",
          f"{mode}: the palette offers to add an address")
    page.keyboard.press("Enter")
    page.get_by_label("Add to", exact=True).select_option(label="Alpha → Docs Portal (as a moon)")
    page.get_by_label("Name", exact=True).fill("Weather")
    page.get_by_role("button", name="Add link").click()
    check(stored(page)[0]["links"][0]["moons"][-1] == {"name": "Weather", "url": "https://www.weather.example.test"},
          f"{mode}: a moon is added")
    close_menu(page)
    page.keyboard.press("Control+k")
    page.keyboard.type("add a link")
    page.keyboard.press("Enter")
    check(page.get_by_label("Address", exact=True).input_value() == "" and
          page.evaluate("document.activeElement.getAttribute('aria-label')") == "Address", f"{mode}: Add a link starts empty")
    close_menu(page)
    print(f"PASS F21 quick add ({mode})")


# ---- F22 Workspaces -------------------------------------------------------------

def open_settings(page):
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()


def add_workspace(page, name, start):
    open_settings(page)
    page.get_by_label("New workspace name", exact=True).fill(name)
    page.get_by_label("Start the new workspace with", exact=True).select_option(label=start)
    page.get_by_role("button", name="Add workspace").click()
    close_menu(page)


def f22_workspaces(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    check(page.locator("#workspace-switch").count() == 0, f"{mode}: no workspace menu with one workspace")
    add_workspace(page, "Home", "An empty map")
    check(page.locator(".hub-name").all_inner_texts() == ["Ops"], f"{mode}: an empty workspace shows only the team map")
    switch = page.locator("#workspace-switch")
    check(switch.locator("option").all_inner_texts() == ["Main", "Home"] and switch.input_value() == "home",
          f"{mode}: the top bar switches workspaces")
    check(json.loads(page.evaluate("localStorage.getItem('orbit:map:v1:home')")) == {"groups": []},
          f"{mode}: the workspace has its own storage")
    switch.select_option(label="Main")
    check(page.locator(".hub-name").all_inner_texts() == ["Ops", "Alpha", "Beta"], f"{mode}: Main is unchanged")
    add_workspace(page, "Work", "A copy of this workspace")
    check(page.locator(".hub-name").all_inner_texts() == ["Ops", "Alpha", "Beta"], f"{mode}: a copy starts with this map")
    save_map_js(page, "next[2].links.pop()", "work change")
    check(len(json.loads(page.evaluate("localStorage.getItem('orbit:map:v1:work')"))["groups"][1]["links"]) == 1,
          f"{mode}: changes stay in this workspace")
    page.keyboard.press("Control+k")
    page.keyboard.type("switch to workspace: main")
    page.keyboard.press("Enter")
    check(page.locator("#workspace-switch").input_value() == "main" and
          page.locator(".home-hub").count() == 3 and len(stored(page) or ctx.data["groups"]) == 2,
          f"{mode}: the palette switches, and Main kept both Beta planets")
    check(page.locator('.home-hub[data-sun="2"] .hub-count').inner_text() == "2 PLANETS", f"{mode}: Main's Beta still has 2 planets")
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    check(page.locator("#workspace-switch").input_value() == "main", f"{mode}: the open workspace is remembered")
    open_settings(page)
    page.locator(".workspace-row").filter(has_text="Home").get_by_role("button", name="Rename").click()
    page.get_by_label("New workspace name", exact=True).wait_for()
    names = page.locator("#workspace-switch option").all_inner_texts()
    check(names == ["Main", "Home", "Work"], f"{mode}: rename needs an answer; the test accepts the default ({names})")
    page.locator(".workspace-row").filter(has_text="Work").get_by_role("button", name="Remove").click()
    check(page.evaluate("localStorage.getItem('orbit:map:v1:work')") is None and
          page.locator("#workspace-switch option").all_inner_texts() == ["Main", "Home"], f"{mode}: a workspace can be removed")
    check(page.locator(".workspace-row").filter(has_text="Main").get_by_role("button", name="Remove").count() == 0,
          f"{mode}: Main cannot be removed")
    close_menu(page)
    print(f"PASS F22 workspaces ({mode})")


def reset_to_file_data(page):
    open_editor(page)
    page.get_by_role("button", name="Reset to file data").click()
    close_menu(page)


def f27_reset_workspace(ctx):
    """Reset in a workspace other than Main keeps the sample map after a reload."""
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    add_workspace(page, "Home", "An empty map")
    check(page.locator(".hub-name").all_inner_texts() == ["Ops"], f"{mode}: Home starts empty")
    reset_to_file_data(page)
    check(page.locator(".hub-name").all_inner_texts() == ["Ops", "Alpha", "Beta"], f"{mode}: Reset shows the file data in Home")
    saved = page.evaluate("localStorage.getItem('orbit:map:v1:home')")
    check(saved is not None and [sun["name"] for sun in json.loads(saved)["groups"]] == ["Alpha", "Beta"],
          f"{mode}: Reset saves the file data to Home's own key")
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    check(page.locator("#workspace-switch").input_value() == "home" and
          page.locator(".hub-name").all_inner_texts() == ["Ops", "Alpha", "Beta"],
          f"{mode}: Home still shows the file data after a reload")
    # Main keeps following the project files: Reset removes its saved map.
    page.locator("#workspace-switch").select_option(label="Main")
    save_map_js(page, "next[2].links.pop()", "main change")
    check(saved_map(page) is not None, f"{mode}: Main has a saved map before Reset")
    reset_to_file_data(page)
    check(saved_map(page) is None and page.locator(".hub-name").all_inner_texts() == ["Ops", "Alpha", "Beta"],
          f"{mode}: Reset in Main removes the saved map, as before")
    check(page.evaluate("localStorage.getItem('orbit:map:v1:home')") is not None, f"{mode}: Reset in Main leaves Home alone")
    print(f"PASS F27 reset in a workspace ({mode})")


def f28_offers_per_workspace(ctx):
    """A routine dismissed in one workspace is still offered in another with the same routine id."""
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    links = [{"key": "https://status.example.test", "name": "Status"}, {"key": "https://wiki.example.test", "name": "Wiki"}]
    morning = [{"name": "Morning", "links": links, "schedule": {"time": "00:00", "days": list(range(7))}}]
    set_routines(page, morning)
    banner = page.locator("#routine-banner")
    check(banner.is_visible(), f"{mode}: Main offers Morning")
    page.get_by_role("button", name="Not today").click()
    add_workspace(page, "Home", "An empty map")
    # Home gets its own routine named Morning, so the same id; the offer marks are kept.
    page.evaluate("list => OrbitTest.saveMap(OrbitTest.groups(), { routines: list, label: 'test routines' })", morning)
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    page.wait_for_timeout(200)
    check(page.locator("#workspace-switch").input_value() == "home" and
          [routine["id"] for routine in json.loads(page.evaluate("localStorage.getItem('orbit:map:v1:home')"))["routines"]] == ["morning"],
          f"{mode}: Home has its own Morning routine with the same id")
    # Home's map is empty, so none of the routine's links are on it: "0 links".
    check(banner.is_visible() and banner.locator(".routine-offer-copy").inner_text().startswith("Time for Morning:"),
          f"{mode}: Home offers its Morning although Main's was dismissed today")
    page.get_by_role("button", name="Not today").click()
    page.locator("#workspace-switch").select_option(label="Main")
    page.wait_for_timeout(200)
    check(page.locator("#routine-banner").count() == 0, f"{mode}: Main's Morning stays dismissed")
    offered = json.loads(page.evaluate("localStorage.getItem('orbit:routine-offered:v1')"))
    check(sorted(offered) == ["morning", "morning:home"] and len(set(offered.values())) == 1,
          f"{mode}: Main keeps the plain routine id; Home's mark adds :home ({offered})")
    print(f"PASS F28 routine offers per workspace ({mode})")


def f29_sun_picker(ctx):
    """A whole-map import lets you pick suns (each whole, with its planets and moons); Replace still takes it all."""
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    incoming = {"groups": [
        {"id": "alpha", "name": "Alpha", "links": [
            {"name": "Wiki", "url": "https://wiki.example.test/", "moons": [{"name": "Wiki Help", "url": "https://wiki.example.test/help"}]}]},
        {"id": "gamma", "name": "Gamma", "links": [
            {"name": "G1", "url": "https://g1.example.test/", "moons": [
                {"name": "G1 Docs", "url": "https://g1.example.test/docs"}, {"name": "G1 API", "url": "https://g1.example.test/api"}]},
            {"name": "G2", "url": "https://g2.example.test/", "moons": [{"name": "G2 Help", "url": "https://g2.example.test/help"}]}]},
        {"id": "delta", "name": "Delta", "links": [{"name": "D1", "url": "https://d1.example.test/"}]},
    ]}
    buffer = json.dumps(incoming).encode()
    row = lambda name: page.locator(".import-sun").filter(has=page.locator(".import-sun-name", has_text=name))
    open_editor(page)
    with page.expect_file_chooser() as chooser:
        page.get_by_role("button", name="Import a file", exact=True).click()
    chooser.value.set_files({"name": "galaxy.json", "mimeType": "application/json", "buffer": buffer})
    page.wait_for_selector(".import-merge-summary, .editor-error")
    check(page.locator(".import-sun").count() == 3, f"{mode}: the review lists every sun in the file")
    check("new sun · 2 planets · 3 moons" in row("Gamma").inner_text() and "adds 1 planet, 1 moon" in row("Alpha").inner_text(),
          f"{mode}: each row says what that sun adds ({page.locator('.import-sun').all_inner_texts()})")
    check(all(row(name).locator("input").is_checked() for name in ("Alpha", "Gamma", "Delta")),
          f"{mode}: everything that adds something starts ticked")
    row("Delta").locator("input").uncheck()
    summary = page.locator(".import-merge-summary").inner_text()
    check("adds 1 sun, 3 planets, and 4 moons" in summary, f"{mode}: the summary follows the ticks ({summary})")
    page.get_by_role("button", name="Merge into my map").click()
    after = {sun["name"]: sun for sun in stored(page)}
    check(list(after) == ["Alpha", "Beta", "Gamma"], f"{mode}: only the ticked suns arrive ({list(after)})")
    check([[moon["name"] for moon in planet["moons"]] for planet in after["Gamma"]["links"]] == [["G1 Docs", "G1 API"], ["G2 Help"]],
          f"{mode}: a picked sun brings all its planets and moons")
    check(after["Alpha"]["links"][-1]["name"] == "Wiki" and after["Alpha"]["links"][-1]["moons"][0]["name"] == "Wiki Help",
          f"{mode}: a sun you already have gains only what is missing")
    # The same file again: Alpha and Gamma have nothing new; Delta still does.
    with page.expect_file_chooser() as chooser:
        page.get_by_role("button", name="Import a file", exact=True).click()
    chooser.value.set_files({"name": "galaxy.json", "mimeType": "application/json", "buffer": buffer})
    page.wait_for_selector(".import-merge-summary, .editor-error")
    check(row("Gamma").locator("input").is_disabled() and "nothing new" in row("Gamma").inner_text() and
          row("Delta").locator("input").is_checked(), f"{mode}: a sun with nothing new can't be picked")
    # Replace my map still takes the whole Galaxy, whatever is ticked.
    row("Delta").locator("input").uncheck()
    page.get_by_role("button", name="Replace my map").click()
    check([sun["name"] for sun in stored(page)] == ["Alpha", "Gamma", "Delta"], f"{mode}: Replace takes the whole map")
    # Select none gives a clean slate for choosing a single sun.
    fresh(ctx)
    open_editor(page)
    with page.expect_file_chooser() as chooser:
        page.get_by_role("button", name="Import a file", exact=True).click()
    chooser.value.set_files({"name": "galaxy.json", "mimeType": "application/json", "buffer": buffer})
    page.wait_for_selector(".import-merge-summary, .editor-error")
    page.get_by_role("button", name="Select none").click()
    check(page.locator(".import-sun input:checked").count() == 0 and page.get_by_role("button", name="Merge into my map").is_disabled(),
          f"{mode}: Select none clears all the suns")
    row("Gamma").locator("input").check()
    page.get_by_role("button", name="Merge into my map").click()
    check([sun["name"] for sun in stored(page)] == ["Alpha", "Beta", "Gamma"], f"{mode}: the import adds the picked sun")
    close_menu(page)
    print(f"PASS F29 sun picker ({mode})")


# ---- F23 Link packs -------------------------------------------------------------

def f23_link_packs(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    page.evaluate("""() => { const groups = OrbitTest.groups(); const key = OrbitTest.helpers.destinationKey;
      OrbitTest.saveMap(groups, { label: 'test', routines: [{ name: 'Morning',
      links: [{ key: key(groups[1].links[0].moons[0]), name: 'Guide' },
              { key: key(groups[1].links[1]), name: 'Status' }],
      schedule: { time: '08:00', days: [1, 2, 3, 4, 5] } }] }); }""")
    open_editor(page)
    page.get_by_role("button", name="Routines", exact=True).click()
    pack = capture_download(page, "document.querySelector('.routine-row').querySelectorAll('button')[1].click()")
    check(pack["format"] == "orbit-pack-v1" and [link["name"] for link in pack["links"]] == ["Guide", "Status"]
          and pack["routine"] == {"name": "Morning", "schedule": {"time": "08:00", "days": [1, 2, 3, 4, 5]}}
          and "moons" not in pack["links"][1], f"{mode}: Share exports the routine as a pack ({pack})")
    page.locator(".editor-header .editor-back").click()
    page.get_by_role("button", name="Share favorites").click()
    check("no favorites" in page.locator(".editor-error").inner_text(), f"{mode}: sharing no favorites explains why")
    # Someone else's pack, with one link that is new here.
    pack["links"].append({"name": "Calendar", "url": "https://calendar.example.test/"})
    page.get_by_role("button", name="Link pack").click()
    page.get_by_label("Pack text", exact=True).fill(json.dumps(pack))
    page.get_by_role("button", name="Review pasted pack").click()
    summary = page.locator(".import-merge-summary").inner_text()
    check(summary == "3 links: 1 new link to add, 2 already on your map.", f"{mode}: the review counts new links ({summary})")
    page.get_by_role("button", name="Add to my map").click()
    after = json.loads(saved_map(page))
    check(after["groups"][-1]["name"] == "Morning" and [link["name"] for link in after["groups"][-1]["links"]] == ["Calendar"],
          f"{mode}: only the new link is added, in a new sun")
    check([routine["name"] for routine in after["routines"]] == ["Morning", "Morning 2"] and
          len(after["routines"][1]["links"]) == 3, f"{mode}: the routine is added under a free name")
    page.get_by_role("button", name="Link pack").click()
    page.get_by_label("Pack text", exact=True).fill('{"format": "something-else"}')
    page.get_by_role("button", name="Review pasted pack").click()
    check("not an Orbit link pack" in page.locator(".editor-error").inner_text(), f"{mode}: other files are refused")
    close_menu(page)
    print(f"PASS F23 link packs ({mode})")


# ---- F24 Backup reminders -------------------------------------------------------

def set_backup(page, entry):
    page.evaluate("entry => localStorage.setItem('orbit:backup:v1', JSON.stringify({ main: entry }))", entry)
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()


def f24_backups(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    check(page.locator("#backup-reminder").count() == 0, f"{mode}: no reminder without changes")
    now = page.evaluate("Date.now()")
    set_backup(page, {"changes": 19, "since": now})
    check(page.locator("#backup-reminder").count() == 0, f"{mode}: 19 changes are not enough")
    save_map_js(page, "next[1].links.pop()", "a change")
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    reminder = page.locator("#backup-reminder")
    check(reminder.is_visible() and "20 changes since your last export" in reminder.inner_text(), f"{mode}: 20 changes remind")
    page.get_by_role("button", name="Remind me later").click()
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    check(page.locator("#backup-reminder").count() == 0, f"{mode}: Remind me later waits")
    set_backup(page, {"changes": 1, "since": now - 15 * 86400000})
    check("1 change since your last export, 15 days ago" in page.locator("#backup-reminder").inner_text(),
          f"{mode}: 14 days remind too")
    exported = capture_download(page, "document.querySelector('#backup-reminder .routine-offer-open').click()")
    check([sun["name"] for sun in exported["groups"]] == ["Alpha", "Beta"] and page.locator("#backup-reminder").count() == 0,
          f"{mode}: Back up now exports and closes the reminder")
    state = json.loads(page.evaluate("localStorage.getItem('orbit:backup:v1')"))["main"]
    check(state["changes"] == 0 and state["lastExport"] >= now, f"{mode}: exporting resets the count")
    set_backup(page, {"changes": 25, "since": now})
    open_editor(page)
    check(page.locator(".editor-pane .backup-reminder").count() == 1, f"{mode}: Edit links shows the reminder too")
    close_menu(page)
    open_settings(page)
    page.get_by_label("Backup reminders", exact=True).uncheck()
    close_menu(page)
    check(page.locator("#backup-reminder").count() == 0, f"{mode}: reminders can be turned off")
    print(f"PASS F24 backup reminders ({mode})")


# ---- F25 Team map updates -------------------------------------------------------

def f25_team_updates(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    seen = json.loads(page.evaluate("localStorage.getItem('orbit:team-seen:v1')"))
    check([entry["name"] for entry in seen] == ["Runbook", "Pager"] and page.locator("#team-updates").count() == 0,
          f"{mode}: the first load records the team map quietly")
    # Pretend this browser saw a different team map last time.
    page.evaluate("""() => localStorage.setItem('orbit:team-seen:v1', JSON.stringify([
      { key: 'https://runbook.example.test', name: 'Runbook' }, { key: 'https://old.example.test', name: 'Old page' }]))""")
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    box = page.locator("#team-updates")
    check(box.locator(".routine-offer-copy").inner_text() == "Team map updated: 1 new, 1 removed.", f"{mode}: changes are reported")
    check(box.locator(".team-update-list").is_hidden(), f"{mode}: details start closed")
    box.get_by_role("button", name="Show what’s new").click()
    check(box.locator(".team-update-link").inner_text() == "Pager" and "in Ops → Runbook" in box.inner_text()
          and "Old page" in box.inner_text(), f"{mode}: the list shows new and removed links")
    urls = popups(page, lambda: box.locator(".team-update-link").click(), expect=1)
    check(urls and urls[0].rstrip("/") == "https://pager.example.test", f"{mode}: a new link opens from the list ({urls})")
    box.get_by_role("button", name="Dismiss").click()
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    check(page.locator("#team-updates").count() == 0, f"{mode}: Dismiss records the current team map")
    print(f"PASS F25 team map updates ({mode})")


# ---- F26 Remote Desktop presets ---------------------------------------------------

def f26_presets(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    open_editor(page)
    page.get_by_role("button", name="RDP presets").click()
    page.get_by_role("button", name="New preset").click()
    page.get_by_label("Preset name", exact=True).fill("Big screen")
    page.get_by_label("Display", exact=True).select_option(label="Full screen")
    page.get_by_label("Use all monitors", exact=True).check()
    check(page.get_by_label("Settings", exact=True).input_value() == "screen mode id:i:2\nuse multimon:i:1",
          f"{mode}: choices write the settings")
    page.get_by_label("Settings", exact=True).fill("screen mode id:i:2\nuse multimon:i:1\npassword 51:b:SECRET")
    page.get_by_role("button", name="Add preset").click()
    check("never stores credentials" in page.locator(".editor-error").inner_text(), f"{mode}: passwords are refused")
    page.get_by_label("Settings", exact=True).fill("screen mode id:i:2\nuse multimon:i:1\nfull address:s:ignored")
    page.get_by_role("button", name="Add preset").click()
    presets = json.loads(saved_map(page))["rdpPresets"]
    check(presets == [{"id": "big-screen", "name": "Big screen", "settings": "screen mode id:i:2\r\nuse multimon:i:1"}],
          f"{mode}: the preset is saved without an address ({presets})")
    # One moon chooses it; then the planet applies it to the rest.
    tree(page, "editor-tree-moon", "lab-box-server3").click()
    page.get_by_label("Connection settings", exact=True).select_option(label="Preset: Big screen")
    page.get_by_role("button", name="Save moon").click()
    check(stored(page)[0]["links"][2]["moons"][0].get("rdpPreset") == "big-screen", f"{mode}: a link chooses a preset")
    profile = page.evaluate("OrbitTest.helpers.effectiveRdpProfile(OrbitTest.groups()[1].links[2].moons[0])")
    check(profile == "full address:s:lab-box-server3\r\nscreen mode id:i:2\r\nuse multimon:i:1\r\n",
          f"{mode}: the link opens with the preset and its own computer ({profile!r})")
    check(page.evaluate("OrbitTest.helpers.rdpLaunchUrl(OrbitTest.groups()[1].links[2].moons[0])").startswith("orbit-rdp://lab-box-server3/?profile="),
          f"{mode}: the mstsc.exe launch carries the preset")
    tree(page, "editor-tree-planet", "Lab Box").click()
    page.get_by_role("button", name="Apply RDP settings to moons").click()
    page.get_by_label("Settings from", exact=True).select_option(label="Preset: Big screen")
    page.get_by_role("button", name="Apply to selected links").click()
    lab = stored(page)[0]["links"][2]
    check(all(item.get("rdpPreset") == "big-screen" for item in (lab, *lab["moons"])) and lab["moons"][1].get("rdpProfile"),
          f"{mode}: a preset applies to several links and keeps their own settings for later")
    # Removing the preset leaves the links without it.
    page.locator(".editor-header .editor-back").click()
    page.locator(".editor-header .editor-back").click()
    page.get_by_role("button", name="RDP presets").click()
    check("used by 3 links" in page.locator(".editor-pane").inner_text(), f"{mode}: the list counts its links")
    page.get_by_role("button", name="Edit", exact=True).click()
    page.get_by_role("button", name="Remove preset").click()
    after = json.loads(saved_map(page))
    check("rdpPresets" not in after and not any("rdpPreset" in item for item in [after["groups"][0]["links"][2], *after["groups"][0]["links"][2]["moons"]]),
          f"{mode}: removing a preset clears it from links")
    check(page.evaluate("OrbitTest.helpers.effectiveRdpProfile(OrbitTest.groups()[1].links[2].moons[1])").startswith("full address:s:lab-box-server4:3390"),
          f"{mode}: a link falls back to its own imported settings")
    close_menu(page)
    print(f"PASS F26 Remote Desktop presets ({mode})")


def f30_group_planets(ctx):
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    open_editor(page)
    tree(page, "editor-tree-sun", "Alpha").click()
    page.get_by_role("button", name="Add planet", exact=True).click()
    page.get_by_label("Planet name").fill("Monitoring")
    page.get_by_label("Kind", exact=True).select_option("group", timeout=5000)
    check(not page.get_by_label("Destination URL").is_visible() and
          not page.get_by_text("Favorite (shown at the top of the Galaxy)").is_visible(),
          f"{mode}: a group has no destination or favorite field")
    page.get_by_role("button", name="Add planet", exact=True).click()
    check(page.locator(".editor-pane").get_by_text("No links yet", exact=True).is_visible(), f"{mode}: empty groups are allowed")
    for name, path in (("Dashboard", "/ok/"), ("Metrics", "/ok/guide.html")):
        page.get_by_role("button", name="Add link", exact=True).click()
        page.get_by_label("Moon name").fill(name)
        page.get_by_label("Destination URL").fill(ctx.target + path)
        page.locator("button[form='item-editor-form']").click()
        tree(page, "editor-tree-planet", "Monitoring").click()

    def export(button):
        if mode.startswith("remote"):
            return page.get_by_role("button", name=button, exact=True).evaluate(
                "node => OrbitTest.captureDownload(() => node.click())")
        return download_json(page, button)

    exported_item = export("Export planet")
    check(exported_item["item"]["type"] == "group", f"{mode}: planet export keeps the group")
    exported_link = export("Export Dashboard")
    check(exported_link["kind"] == "moon" and exported_link["item"]["name"] == "Dashboard",
          f"{mode}: the group exports individual links from their rows")
    pack = export("Share links as a pack")
    check([link["name"] for link in pack["links"]] == ["Dashboard", "Metrics"],
          f"{mode}: a shared group becomes a pack of its links")
    tree(page, "editor-tree-sun", "Alpha").click()
    check(export("Export Monitoring") == exported_item, f"{mode}: the sun list exports the group and its links")
    close_menu(page)

    galaxy_sun = page.get_by_role("button", name="Open Alpha system", exact=False)
    galaxy_sun.hover()
    group = page.locator(".group-planet").filter(has_text="Monitoring")
    group.wait_for()
    check(group.evaluate("el => el.tagName") == "BUTTON" and group.locator(".site-icon").count() == 0,
          f"{mode}: Galaxy draws a group button")
    check(popups(page, group.click) == [], f"{mode}: ordinary clicks open no tabs")
    page.mouse.move(20, 200)
    check(group.get_attribute("aria-expanded") == "true", f"{mode}: moons stay shown after moving away")
    page.mouse.click(20, 200)
    check(group.get_attribute("aria-expanded") == "false", f"{mode}: clicking elsewhere closes the group")
    galaxy_sun.hover()
    group.click()
    page.keyboard.press("Escape")
    check(group.get_attribute("aria-expanded") == "false", f"{mode}: Escape unpins the group")

    check("Monitoring" in search(page, "monitoring"), f"{mode}: Quick find includes the group")
    result = page.locator(".find-row").filter(has_text="Monitoring")
    check("Group in Alpha" in result.inner_text() and result.locator(".favorite-toggle").count() == 0,
          f"{mode}: group search results have no star")
    result.locator(".find-item").click()
    page.locator(".detail-heading").wait_for()
    group = page.locator(".detail-satellite.group-planet").filter(has_text="Monitoring")
    check(group.get_attribute("aria-expanded") == "true", f"{mode}: Quick find pins the group in its System")
    urls = popups(page, lambda: group.click(modifiers=["Shift"]), expect=1)
    notice = page.locator("#open-all-notice").inner_text()
    expected_urls = {ctx.target + "/ok", ctx.target + "/ok/guide.html"}
    opened_urls = {url.rstrip("/") for url in urls}
    check((len(urls) == 2 and opened_urls == expected_urls and notice == "Opened 2 tabs for Monitoring.") or
          (len(urls) == 1 and opened_urls == {ctx.target + "/ok"} and "blocked 1 tab" in notice),
          f"{mode}: Shift-click tries both moons ({urls}, {notice})")
    page.keyboard.press("Escape")
    group.focus()
    page.keyboard.press("Enter")
    check(group.get_attribute("aria-expanded") == "true", f"{mode}: Enter pins a focused group")

    open_editor(page)
    exported = export("Whole map (JSON)")
    upload_json(page, "Import a file", exported)
    page.get_by_role("button", name="Replace my map").click()
    upload_json(page, "Import a file", {"groups": [{"name": "Alpha", "links": [
        {"name": "MONITORING", "type": "group", "moons": [{"name": "Status Board", "url": ctx.target + "/status"}]},
    ]}]})
    check("adds 0 planets, 1 moon" in page.locator(".import-sun").inner_text(), f"{mode}: the picker matches the existing group")
    page.get_by_role("button", name="Merge into my map").click()
    page.reload(wait_until="load")
    saved = stored(page)[0]["links"]
    matching = [planet for planet in saved if planet.get("type") == "group"]
    check(len(matching) == 1 and [link["name"] for link in matching[0]["moons"]] == ["Dashboard", "Metrics", "Status Board"],
          f"{mode}: import and reload retain the group and its links")
    open_editor(page)
    tree(page, "editor-tree-sun", "Beta").click()
    upload_json(page, "Import planet", exported_item)
    page.get_by_role("button", name="Add planet", exact=True).click()
    copy = stored(page)[1]["links"][-1]
    check(copy == exported_item["item"], f"{mode}: planet import keeps the group and its links")
    page.get_by_label("Kind", exact=True).select_option("web")
    page.get_by_role("button", name="Save planet", exact=True).click()
    check("needs an http or https URL" in page.locator(".editor-error").inner_text(),
          f"{mode}: converting a group to a website requires a URL")
    page.get_by_label("Destination URL").fill("https://monitoring.example.test/")
    page.get_by_role("button", name="Save planet", exact=True).click()
    page.get_by_label("Kind", exact=True).select_option("group")
    DISMISS_NEXT.add(page)
    page.get_by_role("button", name="Save planet", exact=True).click()
    check(stored(page)[1]["links"][-1]["url"] == "https://monitoring.example.test/",
          f"{mode}: canceling the conversion preserves the website")
    page.get_by_role("button", name="Save planet", exact=True).click()
    check(stored(page)[1]["links"][-1] == copy, f"{mode}: confirmed conversion keeps all the group's links")
    close_menu(page)
    page.locator(".back-link").click()
    page.locator("#view-toggle").click()
    alpha = page.locator(".list-sun").filter(has=page.locator(".list-sun-name", has_text="Alpha"))
    heading = alpha.get_by_role("heading", name="Monitoring", exact=True)
    check(heading.is_visible() and alpha.get_by_role("link", name="Open Metrics in a new tab").is_visible(),
          f"{mode}: the Galaxy list shows a group heading with its links")
    page.locator("#view-toggle").click()
    page.locator(".home-hub").filter(has_text="Alpha").click()
    page.locator("#edit-toggle").click()
    group = page.locator(".detail-satellite.group-planet").filter(has_text="Monitoring")
    sun_index = int(group.get_attribute("data-sun"))
    drag_to(page, system_moon(page, sun_index, 0, 0), pt(group))
    check(stored(page)[0]["links"][-1]["moons"][-1]["name"] == "Guide", f"{mode}: drag a moon onto the group")
    press_and_start(page, pt(group))
    row = tray_row(page, "sun", sun_index + 1)
    page.mouse.move(*pt(row), steps=6)
    page.mouse.up()
    suns = stored(page)
    check(all(p.get("type") != "group" for p in suns[0]["links"]) and
          [moon["name"] for moon in suns[1]["links"][-1]["moons"]] == ["Dashboard", "Metrics", "Status Board", "Guide"],
          f"{mode}: drag the group to another sun with its links")
    print(f"PASS F30 group planets ({mode})")


def f31_edit_links_layout(ctx):
    page = ctx.page
    fresh(ctx)
    open_editor(page)
    pane = page.locator(".editor-pane")
    check(pane.locator(".editor-actions").first.locator("button").all_inner_texts() == ["Add sun", "Add a link"] and
          pane.locator(".editor-list").evaluate("el => el.previousElementSibling.textContent === 'Suns' && el.previousElementSibling.previousElementSibling.matches('.editor-actions')"),
          "the add actions come before the sun list")
    groups = pane.locator(".editor-group")
    check(groups.locator("h4").all_text_contents() == ["Import", "Export", "Organize", "Start over"],
          "the groups appear in order")
    for i, labels in enumerate([["Import a file", "Link pack"], ["Whole map (JSON)", "Share favorites"],
                                ["Routines", "RDP presets", "Find duplicates", "Check links", "History"],
                                ["Reset to file data"]]):
        check(groups.nth(i).locator("button").all_inner_texts() == labels, f"expected buttons {labels}")
    check(page.get_by_role("button", name="Check links").is_enabled() == ctx.server_mode,
          "Check links can only run in server mode")
    planet = {"name": "Imported planet", "url": "https://example.test/"}
    sun = {"name": "Imported sun", "links": [planet]}
    cases = [
        ({"groups": [sun]}, "Review import"),
        ({"format": "orbit-item-v1", "kind": "sun", "item": sun}, "Review sun import"),
        ({"format": "orbit-item-v1", "kind": "planet", "item": planet}, "Review planet as sun"),
        ({"format": "orbit-item-v1", "kind": "moon", "item": planet}, "This file is a moon"),
        ({}, "This isn't an Orbit map"),
    ]
    for data, title in cases:
        with page.expect_file_chooser() as chooser:
            page.get_by_role("button", name="Import a file").click()
        chooser.value.set_files({"name": "orbit.json", "mimeType": "application/json", "buffer": json.dumps(data).encode()})
        pane.get_by_text(title).wait_for()
        if title.startswith("Review"):
            check(page.get_by_role("button", name="Replace my map").count() == (title == "Review import"),
                  "only whole-map imports can replace the map")
            page.get_by_role("button", name="Cancel").click()
    with page.expect_file_chooser() as chooser:
        page.get_by_role("button", name="Import a file").click()
    chooser.value.set_files({"name": "bookmarks.html", "mimeType": "text/html", "buffer": BOOKMARKS.encode()})
    pane.get_by_text("Review bookmarks").wait_for()
    check(page.get_by_role("button", name="Replace my map").count() == 0, "bookmarks merge only")
    print(f"PASS F31 Edit links layout and import ({ctx.mode})")


def f32_button_tips(ctx):
    page = ctx.page
    fresh(ctx)
    open_editor(page)
    tip = page.get_by_role("tooltip")
    add = page.get_by_role("button", name="Add sun", exact=True)
    link = page.get_by_role("button", name="Add a link", exact=True)
    add.hover()
    page.wait_for_timeout(500)
    check(not tip.is_visible(), "the normal delay has not elapsed")
    link.hover()
    page.wait_for_timeout(500)
    check(not tip.is_visible(), "the delay restarts for the next button")
    tip.wait_for(timeout=900)
    box = tip.bounding_box()
    check(box["x"] >= 8 and box["x"] + box["width"] <= page.evaluate("innerWidth") - 8,
          "tooltip remains inside the viewport")
    page.keyboard.press("Escape")
    check(not tip.is_visible() and page.locator("#menu-overlay").is_visible(), "Escape only hides the visible tip")
    page.locator(".editor-back").focus()
    page.keyboard.press("Tab")
    tip.wait_for(timeout=1300)
    check(add.evaluate("el => el === document.activeElement"), "keyboard focus shows a tip")
    for value in ("off", "slow"):
        close_menu(page)
        page.locator("#settings-trigger").click()
        page.locator('[data-menu-panel="Settings"]').click()
        page.get_by_role("combobox", name="Button tips").select_option(value)
        page.get_by_role("button", name="Edit links").click()
        add.hover()
        page.wait_for_timeout(1000)
        check(not tip.is_visible(), f"{value} shows no tip after one second")
        if value == "off":
            check("Create a new sun" in add.evaluate("""el => document.getElementById(el.getAttribute("aria-describedby")).textContent"""),
                  "the description is available with tips off")
            page.locator(".editor-back").focus()
            page.keyboard.press("Tab")
            page.wait_for_timeout(900)
            check(not tip.is_visible(), "tips off also disables visual tips from keyboard focus")
        else:
            tip.wait_for(timeout=850)
    page.reload(wait_until="load")
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    check(page.get_by_role("combobox", name="Button tips").input_value() == "slow", "the setting survives a reload")
    print(f"PASS F32 Button tips ({ctx.mode})")


def f33_edit_from_map(ctx):
    page = ctx.page
    fresh(ctx)
    # Make an ordinary and a group planet available together in the Galaxy.
    data = ctx.data
    data["groups"][0]["links"].append({"name": "Monitoring", "type": "group", "moons": [
        {"name": "Dashboard", "url": "https://monitor.example.test/"}]})
    page.evaluate("(map) => localStorage.setItem('orbit:map:v1', JSON.stringify(map))", data)
    page.reload(wait_until="load")
    alpha = page.locator(".home-hub").filter(has_text="Alpha")
    alpha.wait_for()
    pencil = page.locator(".map-edit-button")
    title = page.locator(".editor-header h3")

    def edit_from(item, name, heading, close="back"):
        item.hover()
        pencil.wait_for(timeout=2000)
        check(pencil.get_attribute("aria-label") == name, f"the hover button is for {name}")
        pencil.click()
        title.get_by_text(heading, exact=True).wait_for()
        if close:
            page.locator(".editor-back" if close == "back" else "#menu-close").click()
            page.locator("#menu-overlay").wait_for(state="hidden")
            check(item.evaluate("el => el === document.activeElement"), f"focus returns to {name}")

    alpha.hover()
    page.wait_for_timeout(400)
    check(not pencil.is_visible(), "the pencil waits for the hover delay")
    edit_from(alpha, "Edit Alpha", "Edit Alpha")
    planet = page.locator(".home-satellite").filter(has_text="Docs Portal")
    edit_from(planet, "Edit Docs Portal and its moons", "Edit Docs Portal", close=None)
    check(page.locator(".editor-pane .editor-list-row").filter(has_text="Guide").count() == 1, "the planet editor lists its moons")
    page.locator(".editor-pane .editor-list-row").filter(has_text="Guide").get_by_role("button", name="Edit").click()
    page.locator(".editor-back").click()
    title.get_by_text("Edit Docs Portal", exact=True).wait_for()
    page.locator("#menu-close").click()
    check(planet.evaluate("el => el === document.activeElement"), "closing after deeper navigation restores focus")
    moon = planet.locator("..").locator(".moon-link").filter(has_text="Guide")
    planet.hover()
    edit_from(moon, "Edit Guide", "Edit Guide", close="close")
    group = page.locator(".home-satellite.group-planet").filter(has_text="Monitoring")
    group.click()
    check(group.get_attribute("aria-expanded") == "true", "the group is pinned")
    edit_from(group, "Edit Monitoring and its links", "Edit Monitoring")
    check(group.get_attribute("aria-expanded") == "true", "the pencil leaves the group pinned")
    ops = page.locator(".home-hub").filter(has_text="Ops")
    edit_from(ops, "View Ops", "Ops (team)", close=None)
    check("read-only" in page.locator(".editor-pane").inner_text(), "a team sun opens read-only")
    page.locator("#menu-close").click()

    alpha.click()
    hub = page.locator(".detail-hub")
    edit_from(hub, "Edit Alpha", "Edit Alpha")
    system_planet = page.locator(".detail-satellite").filter(has_text="Docs Portal")
    system_planet.focus()
    page.keyboard.press("ArrowDown")
    page.keyboard.press("e")
    title.get_by_text("Edit Guide", exact=True).wait_for()
    page.get_by_role("textbox", name="Moon name").fill("Renamed Guide")
    page.get_by_role("button", name="Save moon").click()
    title.get_by_text("Edit Renamed Guide", exact=True).wait_for()
    page.locator(".editor-back").click()
    saved_moon = page.locator(".moon-link").filter(has_text="Renamed Guide")
    check(saved_moon.evaluate("el => el === document.activeElement"), "Back restores focus after a save redraws the map")
    page.locator("#edit-toggle").click()
    system_planet.hover()
    system_planet.focus()
    page.keyboard.press("e")
    page.wait_for_timeout(1000)
    check(not pencil.is_visible() and not page.locator(".map-remove-button").is_visible() and
          page.locator("#menu-overlay").is_hidden(), "Edit mode suppresses the hover buttons and E")
    page.locator("#edit-toggle").click()
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    page.get_by_role("combobox", name="Button tips").select_option("off")
    page.locator("#menu-close").click()
    hub.hover()
    pencil.wait_for(timeout=1300)
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    page.get_by_role("checkbox", name="Edit buttons on hover").uncheck()
    page.locator("#menu-close").click()
    hub.hover()
    page.wait_for_timeout(1000)
    check(not pencil.is_visible() and not page.locator(".map-remove-button").is_visible(),
          "the setting disables both hover buttons")
    system_planet.focus()
    page.keyboard.press("e")
    title.get_by_text("Edit Docs Portal", exact=True).wait_for()
    page.locator(".editor-back").click()
    check(system_planet.evaluate("el => el === document.activeElement"), "E still works and returns focus")
    page.locator("#quick-find").focus()
    page.keyboard.press("e")
    check(page.locator("#quick-find").input_value() == "e" and page.locator("#menu-overlay").is_hidden(), "E types normally in Quick find")
    print(f"PASS F33 Edit from the map ({ctx.mode})")


def f34_remove_map_items(ctx):
    page = ctx.page
    fresh(ctx)
    prompts = []
    page.on("dialog", lambda dialog: prompts.append(dialog.message))
    notice = page.locator("#map-removal-notice")
    pencil = page.locator(".map-edit-button")
    trash = page.locator(".map-remove-button")
    undo = notice.get_by_role("button", name="Undo removal")

    def remove(item, name, cancel=False):
        item.hover()
        button = page.get_by_role("button", name=f"Remove {name}", exact=True)
        button.wait_for(timeout=2000)
        check(button.bounding_box()["y"] > pencil.bounding_box()["y"], "the trash button sits below the pencil")
        if cancel:
            DISMISS_NEXT.add(page)
        button.click()

    team = page.locator(".home-hub").filter(has_text="Ops")
    team.hover()
    pencil.wait_for()
    check(trash.count() == 0, "team items only offer View")

    alpha = page.locator(".home-hub").filter(has_text="Alpha")
    alpha.click()
    hub = page.locator(".detail-hub")
    planet = page.locator(".detail-satellite").filter(has_text="Docs Portal")
    moon = page.locator(".moon-link").filter(has_text="Guide")
    planet.hover()
    remove(moon, "Guide", cancel=True)
    check(prompts[-1] == "Remove Guide?" and moon.count() == 1 and not notice.is_visible(),
          "cancelling a map removal leaves the item in place")
    planet.hover()
    remove(moon, "Guide")
    check(moon.count() == 0 and "Guide" in notice.inner_text(), "removing a moon shows its map undo")
    page.reload(wait_until="load")
    undo.click()
    check(moon.count() == 1 and not notice.is_visible(), "map Undo restores the moon")

    remove(planet, "Docs Portal")
    check("2 moons" in prompts[-1] and planet.count() == 0, "a planet prompt counts its moons")
    undo.click()
    check(planet.count() == 1 and moon.count() == 1, "map Undo restores the planet and its moons")
    remove(hub, "Alpha")
    check("3 planets" in prompts[-1] and "5 moons" in prompts[-1], "a sun prompt counts its planets and moons")
    check(alpha.count() == 0 and not page.evaluate("location.hash"), "removing the current sun returns to the Galaxy")
    undo.click()
    alpha.wait_for()

    open_editor(page)
    tree(page, "editor-tree-moon", "Guide").click()
    DISMISS_NEXT.add(page)
    page.get_by_role("button", name="Remove moon").click()
    check(prompts[-1] == "Remove Guide?" and tree(page, "editor-tree-moon", "Guide").count() == 1,
          "editor removal prompts by default too")
    close_menu(page)
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    preference = page.get_by_role("checkbox", name="Confirm before deleting")
    check(preference.is_checked(), "confirmation is on by default")
    preference.uncheck()
    close_menu(page)
    page.reload(wait_until="load")
    alpha.wait_for()
    before = len(prompts)
    remove(alpha, "Alpha")
    check(len(prompts) == before and alpha.count() == 0, "map removal skips confirmation after reloading the preference")
    undo.click()
    open_editor(page)
    tree(page, "editor-tree-moon", "Guide").click()
    page.get_by_role("button", name="Remove moon").click()
    check(len(prompts) == before and tree(page, "editor-tree-moon", "Guide").count() == 0,
          "editor removal shares the same preference")
    check(not notice.is_visible(), "the map notice hides while the editor offers Undo")
    page.locator(".editor-undo").get_by_role("button", name="Undo removal").click()
    check(tree(page, "editor-tree-moon", "Guide").count() == 1, "editor Undo restores the moon")
    DISMISS_NEXT.add(page)
    page.get_by_role("button", name="Reset to file data").click()
    check(len(prompts) == before + 1 and "project files" in prompts[-1],
          "reset still asks for confirmation")
    print(f"PASS F34 Remove map items ({ctx.mode})")


def f35_item_editor_toolbar(ctx):
    page = ctx.page
    fresh(ctx)
    open_editor(page)
    tree(page, "editor-tree-sun", "Alpha").click()
    row = page.locator(".editor-list-row").filter(has_text="Docs Portal")
    edit = row.get_by_role("button", name="Edit", exact=True)
    check(edit.inner_text().strip() == "" and edit.locator("svg.icon-pencil").count() == 1, "the planet row uses an icon with its Edit name")
    edit.click()
    header = page.locator(".editor-header")
    save = header.get_by_role("button", name="Save planet", exact=True)
    export = header.get_by_role("button", name="Export planet", exact=True)
    move = header.get_by_role("button", name="Move planet", exact=True)
    remove = header.get_by_role("button", name="Remove planet", exact=True)
    for action in (save, export, move, remove):
        check(action.is_visible(), "the planet action is available at the top")
    check(save.locator("svg.icon-save").count() == 1 and "Save planet" in save.inner_text(), "Save has an icon and a label")
    export.hover()
    page.get_by_role("tooltip").filter(has_text="Export planet").wait_for(timeout=2000)

    original_viewport = page.viewport_size
    page.set_viewport_size({"width": 950, "height": 580})
    pane = page.locator(".editor-pane")
    pane.evaluate("el => el.scrollTop = el.scrollHeight")
    check(pane.evaluate("el => el.scrollTop") > 50, "the editor pane actually scrolls")
    check(abs(header.bounding_box()["y"] - pane.bounding_box()["y"]) < 24, "the action bar stays at the top")
    page.set_viewport_size(original_viewport)

    move.focus()
    page.keyboard.press("Enter")
    check(header.get_by_role("button", name="Move up", exact=True).is_disabled(), "the first planet can't move up")
    check(header.get_by_role("button", name="Move down", exact=True).is_enabled(), "the planet can move down")
    check(header.get_by_role("button", name="Move to another sun").is_visible(), "the cross-sun move is offered")
    page.keyboard.press("Escape")
    check(page.locator("#menu-overlay").is_visible() and not header.get_by_role("button", name="Move down").is_visible(),
          "Escape closes the Move choices and leaves the editor open")
    page.get_by_role("textbox", name="Planet name").fill("Renamed Portal")
    save.click()
    check(header.get_by_role("heading", name="Edit Renamed Portal").is_visible(), "the header submit saves the planet")
    row = page.locator(".editor-list-row").filter(has_text="Guide")
    row.get_by_role("button", name="Edit", exact=True).click()
    check(header.get_by_role("button", name="Save moon", exact=True).is_visible() and
          header.get_by_role("button", name="Export moon", exact=True).is_visible() and
          header.get_by_role("button", name="Copy moon", exact=True).is_visible(),
          "the moon's actions are also at the top")
    header.get_by_role("button", name="Move moon", exact=True).click()
    header.get_by_role("button", name="Move down", exact=True).click()
    check(stored(page)[0]["links"][0]["moons"][1]["name"] == "Guide", "the menu moves the moon")
    DISMISS_NEXT.add(page)
    header.get_by_role("button", name="Remove moon", exact=True).click()
    check(header.get_by_role("heading", name="Edit Guide").is_visible(), "Remove still asks before deleting")
    print(f"PASS F35 Item editor toolbar ({ctx.mode})")


def f36_sun_row_actions(ctx):
    page = ctx.page
    fresh(ctx)
    open_editor(page)
    rows = page.locator(".editor-pane .editor-list-row")
    ops = rows.filter(has_text="Ops")
    alpha = rows.filter(has_text="Alpha")
    beta = rows.filter(has_text="Beta")

    check(ops.get_by_role("button").count() == 2 and
          ops.get_by_role("button", name="View", exact=True).locator("svg.icon-eye").count() == 1,
          "the team row offers just its View and Export icons")
    check(alpha.get_by_role("button").count() == 5 and
          alpha.get_by_role("button", name="Edit", exact=True).locator("svg.icon-pencil").count() == 1,
          "a personal sun row has all five icons")

    for row, name in ((ops, "Ops"), (alpha, "Alpha")):
        label = f"Export {name}"
        button = row.get_by_role("button", name=label, exact=True)
        data = (button.evaluate("node => OrbitTest.captureDownload(() => node.click())")
                if ctx.mode.startswith("remote") else download_json(page, label))
        check(data["kind"] == "sun" and data["item"]["name"] == name and len(data["item"]["links"]) > 0,
              "row export downloads the selected sun with its planets")
        check(page.get_by_role("heading", name="Edit links", exact=True).is_visible(),
              "row export stays in the sun list")

    up = alpha.get_by_role("button", name="Move Alpha up", exact=True)
    down = alpha.get_by_role("button", name="Move Alpha down", exact=True)
    check(up.is_disabled() and beta.get_by_role("button", name="Move Beta down", exact=True).is_disabled(),
          "a personal sun can't move above the team sun or beyond the end")
    down.click()
    check([sun["name"] for sun in stored(page)] == ["Beta", "Alpha"] and
          page.locator(".hub-name").all_inner_texts() == ["Ops", "Beta", "Alpha"],
          "the arrow saves the new order and updates the Galaxy")
    check(up.is_enabled() and down.is_disabled(), "the available directions update after moving")
    close_menu(page)
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    check(page.locator(".hub-name").all_inner_texts() == ["Ops", "Beta", "Alpha"], "the saved order survives reload")
    open_editor(page)
    up.click()
    check([sun["name"] for sun in stored(page)] == ["Alpha", "Beta"], "the up arrow also saves")

    remove = alpha.get_by_role("button", name="Remove Alpha", exact=True)
    DISMISS_NEXT.add(page)
    remove.click()
    check(alpha.count() == 1, "cancelling removal leaves the sun in the list")
    remove.click()
    check(alpha.count() == 0 and [sun["name"] for sun in stored(page)] == ["Beta"],
          "the trash icon removes the sun and its descendants")
    page.get_by_role("button", name="Undo removal", exact=True).click()
    check(alpha.count() == 1 and stored(page)[0]["links"][0]["moons"][0]["name"] == "Guide",
          "Undo restores the sun in place with its planets and moons")
    print(f"PASS F36 Sun row actions ({ctx.mode})")


def f37_child_row_actions(ctx):
    page = ctx.page
    fresh(ctx)
    data = ctx.data
    data["groups"][0]["links"].append({"name": "Monitoring", "type": "group", "moons": [
        {"name": "Dashboard", "url": "https://monitor.example.test/"}]})
    page.evaluate("(map) => localStorage.setItem('orbit:map:v1', JSON.stringify(map))", data)
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    open_editor(page)
    editor = page.locator(".editor-pane")
    rows = editor.locator(".editor-list-row")

    def row_action(item, label):
        return rows.filter(has_text=item).get_by_role("button", name=label, exact=True)

    def export(label):
        button = editor.get_by_role("button", name=label, exact=True)
        return (button.evaluate("node => OrbitTest.captureDownload(() => node.click())")
                if ctx.mode.startswith("remote") else download_json(page, label))

    tree(page, "editor-tree-sun", "Alpha").click()
    sun_name = editor.get_by_role("textbox", name="Sun name")
    sun_name.fill("Unsaved sun name")
    down = row_action("Docs Portal", "Move Docs Portal down")
    down.wait_for(timeout=2000)
    check(rows.filter(has_text="Docs Portal").get_by_role("button").count() == 5 and
          row_action("Docs Portal", "Move Docs Portal up").is_disabled(), "planet rows share the five-icon layout")
    down.click()
    check(stored(page)[0]["links"][1]["name"] == "Docs Portal" and sun_name.input_value() == "Unsaved sun name",
          "reordering planets saves the order and preserves the sun draft")
    DISMISS_NEXT.add(page)
    row_action("Docs Portal", "Remove Docs Portal").click()
    check(rows.filter(has_text="Docs Portal").count() == 1, "cancelling keeps the planet")
    row_action("Docs Portal", "Remove Docs Portal").click()
    check(sun_name.input_value() == "Unsaved sun name" and
          all(link["name"] != "Docs Portal" for link in export("Export sun")["item"]["links"]),
          "the sun draft remains open and its export reflects the removal")
    editor.get_by_role("button", name="Undo removal").click()
    check(stored(page)[0]["links"][1]["moons"][0]["name"] == "Guide" and
          sun_name.input_value() == "Unsaved sun name", "Undo restores the planet and its moons in the same editor")

    row_action("Docs Portal", "Edit").click()
    planet_name = editor.get_by_role("textbox", name="Planet name")
    planet_name.fill("Unsaved planet name")
    row_action("Guide", "Move Guide down").click()
    check(stored(page)[0]["links"][1]["moons"][1]["name"] == "Guide" and
          planet_name.input_value() == "Unsaved planet name", "moving a moon preserves the planet draft")
    row_action("Guide", "Remove Guide").click()
    check([moon["name"] for moon in export("Export planet")["item"]["moons"]] == ["Broken Page"],
          "toolbar export uses the saved moons")
    editor.get_by_role("button", name="Undo removal").click()
    check(planet_name.input_value() == "Unsaved planet name" and
          row_action("Guide", "Move Guide down").is_disabled(), "the last moon cannot move down after Undo")
    editor.get_by_role("button", name="Save planet").click()
    check(stored(page)[0]["links"][1]["name"] == "Unsaved planet name" and
          stored(page)[0]["links"][1]["moons"][1]["name"] == "Guide",
          "saving the parent keeps the updated child order without resurrecting stale data")

    tree(page, "editor-tree-planet", "Monitoring").click()
    check(row_action("Dashboard", "Move Dashboard up").is_disabled() and
          row_action("Dashboard", "Move Dashboard down").is_disabled(), "a group's only link can't be reordered")
    row_action("Dashboard", "Remove Dashboard").click()
    check(editor.get_by_text("No links yet", exact=True).is_visible() and
          not editor.get_by_role("button", name="Share links as a pack").is_visible(), "removing the last group link refreshes its actions")
    editor.get_by_role("button", name="Undo removal").click()
    check(editor.get_by_role("button", name="Share links as a pack").is_visible(), "Undo restores the group's share action")

    tree(page, "editor-tree-sun", "Ops").click()
    check(rows.filter(has_text="Runbook").get_by_role("button").count() == 2, "team planets show View and Export")
    row_action("Runbook", "View").click()
    check(rows.filter(has_text="Pager").get_by_role("button").count() == 2, "team moons show View and Export")
    print(f"PASS F37 Child row actions ({ctx.mode})")


# ---- F38 Lucide icons --------------------------------------------------------------

# Icon-like symbols that buttons and markers used before Lucide icons (prose arrows in
# sentences, sizes such as 1920 x 1080, and a sun's own emoji are not buttons' own text).
ICON_SCAN = r"""() => {
  const glyphs = /[✎⤓↑↓↕💾👁⧉↗☰◎⚙×★☆📁⚠▶→←]/u;
  const markers = '.editor-icon, .find-arrow, .broken-mark, .editor-tree-group, .list-favorite';
  const glyphText = [], noIcon = [], unnamed = [];
  for (const el of document.querySelectorAll(`button, a, [role=button], ${markers}`)) {
    // The menu's backdrop is a full-screen, unseen close target, not an icon button.
    if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden' || el.matches('.menu-scrim')) continue;
    const own = el.matches(markers) ? el.textContent
      : [...el.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.data).join('');
    const label = `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${(el.getAttribute('aria-label') || own).trim().slice(0, 30)}"`;
    if (glyphs.test(own)) glyphText.push(label);
    if (el.matches('button, [role=button]') && !/[\p{L}\p{N}]/u.test(el.textContent || '')) {
      if (!el.querySelector('svg.icon')) noIcon.push(label);
      if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) unnamed.push(label);
    }
  }
  const chips = [...document.querySelectorAll('.routine-chip')].filter(chip => getComputedStyle(chip, '::before').content.includes('▶'));
  return { glyphText, noIcon, unnamed, cssTrash: document.querySelectorAll('.trash-icon').length, cssPlay: chips.length };
}"""


def f38_lucide_icons(ctx):
    """Buttons and markers draw Lucide icons, never text symbols; icon-only buttons have an icon and a name."""
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    data = ctx.data
    data["groups"][0]["links"].append({"name": "Monitoring", "type": "group", "moons": [
        {"name": "Dashboard", "url": "https://monitor.example.test/"}]})
    page.evaluate("(map) => localStorage.setItem('orbit:map:v1', JSON.stringify(map))", data)
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()

    def scan(where):
        found = page.evaluate(ICON_SCAN)
        check(not found["glyphText"], f"{mode}: {where}: no text symbols on buttons or markers ({found['glyphText']})")
        check(not found["noIcon"], f"{mode}: {where}: every icon-only button draws an icon ({found['noIcon']})")
        check(not found["unnamed"], f"{mode}: {where}: every icon-only button has a name ({found['unnamed']})")
        check(found["cssTrash"] == 0 and found["cssPlay"] == 0, f"{mode}: {where}: no CSS-drawn icons ({found})")

    toggle = page.locator("#view-toggle")
    check(toggle.locator("svg.icon-list").count() == 1, f"{mode}: the view toggle shows the list icon in orbits view")
    scan("Galaxy")
    toggle.click()
    page.locator(".galaxy-list, .list-sun").first.wait_for()
    check(toggle.locator("svg.icon-orbit").count() == 1, f"{mode}: the view toggle shows the orbit icon in list view")
    scan("list view")
    toggle.click()
    page.locator(".home-hub").first.wait_for()
    # The hover edit and remove buttons on a planet.
    # A team sun is read-only: its hover button is View (an eye) and there's no remove button.
    team_hub = page.locator(".team-card .home-hub").first
    if team_hub.count():
        team_hub.hover()
        page.locator(".map-edit-button").first.wait_for(state="visible", timeout=4000)
        check(page.locator(".map-edit-button svg.icon-eye").count() == 1 and page.locator(".map-remove-button").count() == 0,
              f"{mode}: a team sun's hover button is View, with an eye")
        page.mouse.move(5, 5)
    hub = page.locator(".home-hub").filter(has_text="Alpha")
    hub.hover()
    planet = page.locator(".home-orbit:hover .home-satellite").first
    planet.wait_for(state="visible")
    planet.hover()
    page.locator(".map-edit-button").first.wait_for(state="visible", timeout=4000)
    check(page.locator(".map-edit-button svg.icon-pencil").count() == 1 and
          page.locator(".map-remove-button svg.icon-trash-2").count() == 1, f"{mode}: map buttons draw pencil and trash")
    scan("map hover buttons")
    # Quick find: result arrows and the favorite star, filled once it's a favorite.
    page.mouse.move(5, 5)
    page.locator("#quick-find").fill("Guide")
    row = page.locator(".find-row").filter(has_text="Guide").first
    row.wait_for()
    star = row.locator(".favorite-toggle")
    fill = lambda: star.locator("svg.icon-star").evaluate("svg => getComputedStyle(svg).fill")
    check(star.locator("svg.icon-star").count() == 1 and fill() == "none", f"{mode}: an unfavorited star is an outline")
    star.click()
    star = page.locator(".find-row").filter(has_text="Guide").first.locator(".favorite-toggle")
    check(fill() not in ("none", ""), f"{mode}: a favorite's star is filled ({fill()})")
    scan("Quick find")
    page.locator("#quick-find").fill("")
    # The editor: sun list, a sun, a planet, a moon, and the tree's group marker.
    open_editor(page)
    scan("Edit links")
    check(page.locator(".editor-tree-group svg.icon-folder").count() >= 1, f"{mode}: the tree marks a group with a folder icon")
    page.locator(".editor-list-row").filter(has_text="Alpha").get_by_role("button", name="Edit", exact=True).click()
    page.locator(".editor-list-row").first.wait_for()
    scan("sun editor")
    page.locator(".editor-list-row").filter(has_text="Docs Portal").get_by_role("button", name="Edit", exact=True).click()
    page.locator(".editor-header h3").wait_for()
    scan("planet editor")
    moon_rows = page.locator(".editor-list-row")
    if moon_rows.count():
        moon_rows.first.get_by_role("button", name="Edit", exact=True).click()
        page.locator(".editor-header h3").wait_for()
        scan("moon editor")
    check(page.locator(".editor-back svg.icon-arrow-left").count() == 1, f"{mode}: Back has an arrow icon")
    close_menu(page)
    print(f"PASS F38 Lucide icons ({mode})")


# ---- F39 Change level: moon to planet, planet to moon ----------------------------

def f39_level_change(ctx):
    """The editor turns a moon into a planet and a moonless planet into a moon; drags show why not."""
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    # A favorite moon keeps its star when it becomes a planet.
    page.locator("#quick-find").fill("Broken")
    page.locator(".find-row").filter(has_text="Broken Page").first.locator(".favorite-toggle").click()
    page.locator("#quick-find").fill("")
    open_editor(page)

    # Moon editor: Make it a planet of... Beta.
    tree(page, "editor-tree-moon", "Broken Page").click()
    page.get_by_role("button", name="Move moon", exact=True).click()
    page.get_by_role("button", name="Make it a planet of…", exact=True).click()
    page.get_by_label("Make it a planet of", exact=True).select_option(label="Beta")
    page.get_by_role("button", name="Make it a planet", exact=True).click()
    page.locator(".editor-header h3").filter(has_text="Broken Page").wait_for()
    beta = stored(page)[1]
    check([planet["name"] for planet in beta["links"]] == ["Docs Mirror", "Wiki", "Broken Page"] and
          beta["links"][2]["moons"] == [] and beta["links"][2].get("favorite") is True,
          f"{mode}: Broken Page is Beta's last planet and still a favorite ({beta['links'][-1]})")
    check(page.get_by_label("Planet name", exact=True).input_value() == "Broken Page",
          f"{mode}: the planet editor opens at the new planet")
    check([moon["name"] for moon in stored(page)[0]["links"][0]["moons"]] == ["Guide"], f"{mode}: Docs Portal lost the moon")

    # Planet editor: Make it a moon of... is offered only for a planet without moons that isn't a group.
    tree(page, "editor-tree-planet", "Docs Portal").click()
    page.get_by_role("button", name="Move planet", exact=True).click()
    check(page.get_by_role("button", name="Make it a moon of…", exact=True).count() == 0,
          f"{mode}: a planet with moons isn't offered Make it a moon")
    tree(page, "editor-tree-planet", "Wiki").click()
    page.get_by_role("button", name="Move planet", exact=True).click()
    page.get_by_role("button", name="Make it a moon of…", exact=True).click()
    page.get_by_label("Make it a moon of", exact=True).select_option(label="Alpha → Status")
    page.get_by_role("button", name="Make it a moon", exact=True).click()
    page.locator(".editor-header h3").filter(has_text="Wiki").wait_for()
    after = stored(page)
    check([moon["name"] for moon in after[0]["links"][1]["moons"]] == ["Status History", "Wiki"] and
          "moons" not in after[0]["links"][1]["moons"][1] and [p["name"] for p in after[1]["links"]] == ["Docs Mirror", "Broken Page"],
          f"{mode}: Wiki is Status's last moon ({after[0]['links'][1]['moons']})")
    check(page.get_by_label("Moon name", exact=True).input_value() == "Wiki", f"{mode}: the moon editor opens at the new moon")
    close_menu(page)
    check(page.locator(".quick-chip").filter(has_text="Broken Page").count() >= 1, f"{mode}: the favorite is still in Favorites")

    # A group isn't offered Make it a moon either; in a drag its pill is disabled with the reason.
    data = ctx.data
    data["groups"][0]["links"].append({"name": "Monitoring", "type": "group", "moons": [
        {"name": "Dashboard", "url": "https://monitor.example.test/"}]})
    page.evaluate("(map) => localStorage.setItem('orbit:map:v1', JSON.stringify(map))", data)
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    open_editor(page)
    tree(page, "editor-tree-planet", "Monitoring").click()
    page.get_by_role("button", name="Move planet", exact=True).click()
    check(page.get_by_role("button", name="Make it a moon of…", exact=True).count() == 0, f"{mode}: a group isn't offered Make it a moon")
    close_menu(page)
    page.locator("#edit-toggle").click()
    page.locator("#edit-bar").wait_for(state="visible")

    def press_drag(item):
        box = item.bounding_box()
        x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + 6, y + 10, steps=2)

    alpha = page.locator(".home-hub").filter(has_text="Alpha")
    alpha.hover()
    group = page.locator(".home-orbit:hover .home-satellite").filter(has_text="Monitoring")
    group.wait_for(state="visible")
    press_drag(group)
    wiki_free = page.locator(".home-hub").filter(has_text="Beta")
    page.mouse.move(*(lambda b: (b["x"] + b["width"] / 2, b["y"] + b["height"] / 2))(wiki_free.bounding_box()), steps=6)
    beta_planet = page.locator('.home-satellite[data-sun="2"][data-planet="0"]')
    beta_planet.wait_for(state="visible")
    page.mouse.move(*(lambda b: (b["x"] + b["width"] / 2, b["y"] + b["height"] / 2))(beta_planet.bounding_box()), steps=6)
    pill = page.locator('.drop-choices [data-action="moon"]')
    pill.wait_for(timeout=3000)
    check(pill.get_attribute("aria-disabled") == "true" and "a group's links stay in the group" in pill.inner_text(),
          f"{mode}: a dragged group sees why it can't be a moon ({pill.inner_text()!r})")
    page.keyboard.press("Escape")
    page.mouse.up()

    # A moon on a team sun's circle: the choice is disabled, with the reason.
    alpha.hover()
    docs = page.locator('.home-satellite[data-sun="1"][data-planet="0"]')
    docs.wait_for(state="visible")
    docs.hover()
    guide = page.locator('.moon-link[data-sun="1"][data-planet="0"][data-moon="0"]')
    guide.wait_for(state="visible")
    press_drag(guide)
    ops = page.locator(".team-card .home-hub").first
    page.mouse.move(*(lambda b: (b["x"] + b["width"] / 2, b["y"] + b["height"] / 2))(ops.bounding_box()), steps=6)
    choice = page.locator('.drop-choices [data-action="planet"]')
    choice.wait_for(timeout=3000)
    check(choice.get_attribute("aria-disabled") == "true" and "Team suns are read-only" in choice.inner_text(),
          f"{mode}: a team sun's circle shows it's read-only ({choice.inner_text()!r})")
    page.keyboard.press("Escape")
    page.mouse.up()
    page.locator("#edit-done").click()
    print(f"PASS F39 change level ({mode})")


# ---- F40 Fonts: Inter by default, Orbit classic as the alternative -------------------

LOADED_FONTS = "() => [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family.replace(/[\"']/g, '')).sort()"
SPLIT_LABELS = r"""() => [...document.querySelectorAll('.home-satellite, .moon-link')].flatMap(node => {
  const text = [...node.childNodes].find(child => child.nodeType === Node.TEXT_NODE);
  if (!text) return [];
  return [...text.data.matchAll(/\S+/g)].filter(match => {
    const range = document.createRange();
    range.setStart(text, match.index);
    range.setEnd(text, match.index + match[0].length);
    return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size > 1;
  }).map(match => match[0]);
})"""


def f40_fonts(ctx):
    """Inter is the default, loaded from Orbit's own fonts/ folder; Settings > Font offers Orbit classic."""
    page, mode = ctx.page, ctx.mode
    fresh(ctx)
    page.wait_for_function("document.fonts.status === 'loaded'")
    family = lambda selector: page.locator(selector).first.evaluate("node => getComputedStyle(node).fontFamily")
    size = lambda: page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--home-planet-size').trim()")
    check(family(".hub-name").startswith("Inter") and family("body").startswith("Inter"),
          f"{mode}: Inter is the default ({family('.hub-name')!r}, {family('body')!r})")
    check(page.evaluate(LOADED_FONTS) == ["Inter"], f"{mode}: only Inter is loaded ({page.evaluate(LOADED_FONTS)})")
    check(page.evaluate("document.fonts.check('600 16px Inter')"), f"{mode}: Inter is ready to draw")
    if mode == "server":
        # Over http the browser records each file it fetched (a file:// page may not).
        fonts = page.evaluate("performance.getEntriesByType('resource').map(entry => entry.name).filter(name => /\\.woff2?$/.test(name))")
        check(len(fonts) == 1 and fonts[0].endswith("/fonts/Inter.woff2"), f"{mode}: Inter comes from Orbit's own fonts folder ({fonts})")
    inter_size = size()

    # Settings > Font > Orbit classic: DM Sans and Space Grotesk, and the circles are measured again.
    open_settings(page)
    font = page.get_by_label("Font", exact=True)
    check(font.input_value() == "inter" and font.locator("option").all_inner_texts() == ["Inter (default)", "Orbit classic (DM Sans and Space Grotesk)"],
          f"{mode}: the Font setting offers Inter and Orbit classic ({font.locator('option').all_inner_texts()})")
    font.select_option("classic")
    page.wait_for_function("document.documentElement.dataset.fontFamily === 'classic'")
    page.wait_for_function("[...document.fonts].some(face => face.family.includes('Space Grotesk') && face.status === 'loaded')")
    page.wait_for_timeout(300)
    close_menu(page)
    check(family(".hub-name").startswith('"Space Grotesk"') and family("body").startswith('"DM Sans"'),
          f"{mode}: classic uses Space Grotesk and DM Sans ({family('.hub-name')!r}, {family('body')!r})")
    switched_size = size()
    check(page.evaluate(SPLIT_LABELS) == [], f"{mode}: after switching, no label splits a word ({page.evaluate(SPLIT_LABELS)})")
    check(page.evaluate("localStorage.getItem('orbit:font-family')") == "classic", f"{mode}: the choice is saved")

    # A reload keeps classic and measures the circles exactly as the switch did.
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    page.wait_for_function("document.fonts.status === 'loaded'")
    page.wait_for_timeout(300)
    check(page.evaluate("document.documentElement.dataset.fontFamily") == "classic" and size() == switched_size,
          f"{mode}: a reload keeps classic with the same circle size ({size()} vs {switched_size}; Inter was {inter_size})")
    check(page.evaluate(LOADED_FONTS) == ["DM Sans", "Space Grotesk"], f"{mode}: classic doesn't load Inter ({page.evaluate(LOADED_FONTS)})")

    # An unknown saved value falls back to Inter.
    page.evaluate("localStorage.setItem('orbit:font-family', 'comic')")
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    check(page.evaluate("document.documentElement.dataset.fontFamily") == "inter" and family(".hub-name").startswith("Inter"),
          f"{mode}: an unknown value falls back to Inter")
    print(f"PASS F40 fonts ({mode})")


CHECKS = (f01_recent_favorites, f02_open_all, f03_search, f04_palette, f06_bulk_rdp, f07_tags, f08_link_check,
          f09_history, f10_duplicates, f11_merge_import, f12_team, f13_bookmarks, f14_icons, f15_list,
          f16_open_all_favorites, f17_routines, f18_arrival, f19_notes, f20_variables, f21_quick_add,
          f22_workspaces, f23_link_packs, f24_backups, f25_team_updates, f26_presets, f27_reset_workspace,
          f28_offers_per_workspace, f29_sun_picker, f30_group_planets, f31_edit_links_layout, f32_button_tips, f33_edit_from_map, f34_remove_map_items, f35_item_editor_toolbar, f36_sun_row_actions, f37_child_row_actions,
          f38_lucide_icons, f39_level_change, f40_fonts)


def run_checks(make_ctx, only):
    for check_fn in CHECKS:
        if not only or only in check_fn.__name__:
            check_fn(make_ctx())


# Pages whose next confirm() should be answered Cancel; every other dialog is accepted.
DISMISS_NEXT = set()


def answer_dialog(page, dialog):
    if page in DISMISS_NEXT:
        DISMISS_NEXT.discard(page)
        dialog.dismiss()
    else:
        dialog.accept()


def prepare_page(page):
    page.on("dialog", lambda dialog: answer_dialog(page, dialog))
    # Example sites answer with a page, and have no favicon.
    page.context.route("https://*.example.test/**", lambda route: route.fulfill(
        status=404, body="") if route.request.url.endswith("/favicon.ico")
        else route.fulfill(status=200, content_type="text/html", body="<title>Example</title>"))


def write_data(directory, target):
    directory = Path(directory)
    data = make_map(target)
    (directory / "links.json").write_text(json.dumps(data))
    (directory / "links-data.js").write_text("window.ORBIT_DATA = " + json.dumps(data) + ";\n")
    (directory / "team.json").write_text(json.dumps(TEAM))
    (directory / "team-data.js").write_text("window.ORBIT_TEAM_DATA = " + json.dumps(TEAM) + ";\n")


def start_target_site():
    """A tiny site with good pages under /ok and nothing at /missing."""
    site = Path(tempfile.mkdtemp())
    (site / "ok").mkdir()
    (site / "ok" / "index.html").write_text("<title>OK</title>")
    (site / "ok" / "guide.html").write_text("<title>Guide</title>")
    (site / "favicon.ico").write_bytes(PNG)
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(site)))
    Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_port}"


class QuietOrbit(serve.OrbitHandler):
    def log_message(self, _format, *_args):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Run only the checks whose function name contains this text")
    parser.add_argument("--cdp", help="Connect to a running browser at this DevTools address")
    parser.add_argument("--url", help="With --cdp: the Orbit page to test")
    parser.add_argument("--server-mode", action="store_true", help="With --cdp: the URL is served by serve.py")
    parser.add_argument("--target", help="The test site the map's web links use (for --cdp and --write-fixture)")
    parser.add_argument("--write-fixture", metavar="DIR", help="Only write the map and team data into DIR and exit")
    parser.add_argument("--serve", metavar="DIR", help="Serve DIR with serve.py's handler (and --team) on --port and wait")
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args()
    if args.write_fixture:
        # The whole fixture, test bundle included, so a remote browser tests what the local runs test.
        write_data(write_fixture(Path(args.write_fixture), make_map(args.target)), args.target)
        return
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    if args.serve:
        QuietOrbit.team_path = str(Path(args.serve) / "team.json")
        server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(QuietOrbit, directory=args.serve))
        print(f"serving {args.serve} on {server.server_port}", flush=True)
        server.serve_forever()
    with sync_playwright() as playwright:
        if args.cdp:
            browser = playwright.chromium.connect_over_cdp(args.cdp)
            context = browser.contexts[0]
            print(f"Browser: {browser.version}")
            pages = []

            def make_remote():
                while pages:
                    pages.pop().close()
                page = context.new_page()
                page.set_viewport_size(VIEW)
                prepare_page(page)
                pages.append(page)
                return Ctx(page, args.url, "remote-server" if args.server_mode else "remote-file",
                           args.target, args.server_mode)
            try:
                run_checks(make_remote, args.only)
            finally:
                for page in pages:
                    page.close()
            print("PASS features")
            return
        target_server, target = start_target_site()
        with tempfile.TemporaryDirectory() as directory:
            fixture = write_fixture(directory, make_map(target))
            write_data(fixture, target)
            QuietOrbit.team_path = str(fixture / "team.json")
            server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietOrbit, directory=str(fixture)))
            Thread(target=server.serve_forever, daemon=True).start()
            browser = playwright.chromium.launch(executable_path="/usr/bin/chromium", headless=True,
                                                 args=["--no-sandbox", "--disable-dev-shm-usage"])
            try:
                for mode, url in (("file", (fixture / "index.html").as_uri()),
                                  ("server", f"http://localhost:{server.server_port}/index.html")):
                    context = browser.new_context(viewport=VIEW)

                    def make_local(context=context, mode=mode, url=url):
                        for old in context.pages:
                            old.close()
                        page = context.new_page()
                        prepare_page(page)
                        return Ctx(page, url, mode, target, mode == "server")
                    try:
                        run_checks(make_local, args.only)
                    finally:
                        context.close()
            finally:
                browser.close()
                server.shutdown()
                target_server.shutdown()
    print("PASS features")


if __name__ == "__main__":
    main()
