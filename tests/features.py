"""Browser checks for the feature batches of 2026-11-19 and -20 (F01–F18; there is no F05).

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

from helpers import ARTIFACTS, ROOT, QuietHandler, check, saved_map, write_fixture

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


def popups(page, action):
    """Run `action` and return the URLs of the tabs it opened."""
    opened = []

    def collect(tab):
        opened.append(tab)
    page.context.on("page", collect)
    action()
    page.wait_for_timeout(700)
    page.context.remove_listener("page", collect)
    urls = []
    for tab in opened:
        try:
            tab.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:  # noqa: BLE001 - a blocked or failed load still counts as opened
            pass
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
    urls = popups(page, lambda: page.locator("a.find-item").filter(has_text="Docs Portal").first.click())
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
    urls = popups(page, lambda: page.locator(".quick-chip").filter(has_text="Guide").click())
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
    urls = popups(page, lambda: row.get_by_role("button", name="Docs Portal + 2 moons").click())
    check(urls and urls[0].rstrip("/").endswith("/ok") and opened_or_reported(urls, 3, "Docs Portal"),
          f"{mode}: the planet and its moons open, or blocked tabs are reported ({urls})")
    # Shift+click a planet does the same.
    urls = popups(page, lambda: page.locator('.detail-satellite[data-planet="1"]').click(modifiers=["Shift"]))
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
    urls = popups(page, lambda: page.keyboard.press("Enter"))
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
    page.get_by_role("button", name="Check links").click()
    if not ctx.server_mode:
        check("python3 serve.py" in page.locator(".editor-pane").inner_text(), f"{mode}: file mode explains serve.py")
        close_menu(page)
        print(f"PASS F08 link check explains serve.py ({mode})")
        return
    page.get_by_role("button", name="Start check").click()
    page.wait_for_function("document.querySelector('.link-check-status').textContent.startsWith('Checked ') && !document.querySelector('.link-check-status').textContent.includes('…')", timeout=60000)
    failures = page.locator(".link-check-failure strong").all_inner_texts()
    check("⚠ Broken Page" in failures, f"{mode}: the missing page is reported ({failures})")
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
    page.evaluate("""() => { const next = copyGroups(); next.reverse();
      saveMap({ groups: next }, 'Moved sun test'); }""")
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
        page.get_by_role("button", name="Import JSON", exact=True).click()
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
        page.get_by_role("button", name="Import JSON", exact=True).click()
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
    # Read-only: no drag, and the editor only views and copies.
    page.locator("#edit-toggle").click()
    hub = page.locator(".home-hub").first
    hub.hover()
    planet = page.locator('.home-satellite[data-sun="0"]').first
    planet.wait_for(state="visible")
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
    tree(page, "editor-tree-planet", "Runbook").click()
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
        # Export JSON hands to the download instead.
        exported = page.evaluate("""() => { let data; const save = downloadJson;
          downloadJson = value => { data = value; }; exportMap(); downloadJson = save; return data; }""")
    else:
        with page.expect_download() as download:
            page.get_by_role("button", name="Export JSON", exact=True).click()
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
        page.get_by_role("button", name="Import bookmarks").click()
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
          work[1]["url"] == "https://reports.example.test/" and [moon["name"] for moon in work[1]["moons"]] == ["Q3"],
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
    sources = page.evaluate("groups[1].links.map(link => siteIcon(link)?.getAttribute('src') ?? null)")
    check(sources == [f"{ctx.target}/favicon.ico", "https://status.example.test/favicon.ico", None],
          f"{mode}: each icon comes from its own site, and Remote Desktop links have none ({sources})")
    page.locator('.home-hub[data-sun="1"]').hover()
    page.wait_for_timeout(1500)
    # The local test site has a favicon; the example sites answer 404.
    check(page.locator('.home-satellite[data-sun="1"][data-planet="0"] .site-icon').count() == 1,
          f"{mode}: an icon that loads stays")
    # A site that refuses the request at once (a closed local port).
    page.evaluate("""() => { const node = destinationNode({ name: 'Closed', url: 'http://127.0.0.1:9/' }, 'probe-link');
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
    urls = popups(page, lambda: page.locator(".list-link").filter(has_text="Guide").click())
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
    urls = popups(page, button.click)
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
    urls = popups(page, chip.click)
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
    exported = page.evaluate("""() => { let data; const save = downloadJson;
      downloadJson = value => { data = value; }; exportMap(); downloadJson = save; return data; }""")
    check([routine["name"] for routine in exported.get("routines", [])] == ["Morning"], f"{mode}: Export JSON includes routines")
    incoming = {"groups": [], "routines": [
        {"name": "MORNING", "links": [{"key": "https://wiki.example.test", "name": "Wiki"}]},
        {"name": "Evening", "links": [{"key": "https://status.example.test", "name": "Status"}],
         "schedule": {"time": "18:00", "days": [1, 2, 3, 4, 5]}}]}
    open_editor(page)
    with page.expect_file_chooser() as chooser:
        page.get_by_role("button", name="Import JSON", exact=True).click()
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
    page.evaluate("""list => { saveMap({ groups: copyGroups(), routines: list }, 'test routines');
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
    urls = popups(page, lambda: page.get_by_role("button", name="Open Morning").click())
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


CHECKS = (f01_recent_favorites, f02_open_all, f03_search, f04_palette, f06_bulk_rdp, f07_tags, f08_link_check,
          f09_history, f10_duplicates, f11_merge_import, f12_team, f13_bookmarks, f14_icons, f15_list,
          f16_open_all_favorites, f17_routines, f18_arrival)


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
        write_data(args.write_fixture, args.target)
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
