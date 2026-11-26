"""Browser checks that were deferred: B09, B11, and milestones 15–17.

Run with: /home/sysadmin/.venv/bin/python tests/pending_checks.py
   or, in a remote browser such as Edge on the Windows VM:
       python tests/pending_checks.py --cdp http://127.0.0.1:9333 --url file:///C:/path/index.html

Uses the bundled links.json. Without --cdp it runs in local Chromium in file
mode and through a temporary local server. "Narrow desktop" means 900 pixels,
as in the rest of the matrix.
"""

import argparse
import json
import tempfile
from functools import partial
from http.server import ThreadingHTTPServer
from threading import Thread

from playwright.sync_api import sync_playwright

from helpers import ARTIFACTS, ROOT, QuietHandler, check, click_logo_to_galaxy, saved_map, write_fixture

WIDE = {"width": 1280, "height": 900}
NARROW = {"width": 900, "height": 900}
DATA = json.loads((ROOT / "links.json").read_text())
VALID_RDP = "full address:s:{host}\r\nscreen mode id:i:2\r\npassword 51:b:SECRET\r\n"


def fresh(page, url, hash_=""):
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.clear()")
    page.goto(url.split("#")[0] + hash_, wait_until="load")
    page.reload(wait_until="load")
    page.locator(".home-hub, .detail-heading").first.wait_for()


def open_menu(page, panel=None):
    page.locator("#settings-trigger").click()
    page.locator("#menu-overlay").wait_for(state="visible")
    if panel:
        page.locator(f'[data-menu-panel="{panel}"]').click()


def sheet_box(page):
    return page.locator(".menu-sheet").bounding_box()


def usable_width(page):
    # The window width minus a classic scrollbar (Windows shows one; Linux headless does not).
    return page.evaluate("document.documentElement.clientWidth")


def menu_closed(page):
    return page.locator("#menu-overlay").is_hidden()


# ---- Milestone 15 ---------------------------------------------------------

def m15_theme_names(page, url, mode):
    fresh(page, url)
    open_menu(page, "Settings")
    theme = page.get_by_label("Theme", exact=True)
    labels = theme.locator("option").all_inner_texts()
    check(labels == ["Default", "Red", "Blue", "Aurora"], f"{mode}: theme labels include Default, Red, Blue, Aurora ({labels})")
    palettes = {}
    for value, label in (("default", "Default"), ("alabama", "Red"), ("auburn", "Blue")):
        theme.select_option(value)
        palettes[label] = page.evaluate(
            "getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim()")
    check(len(set(palettes.values())) == 3, f"{mode}: each theme has its own palette ({palettes})")
    for stored, label in (("alabama", "Red"), ("auburn", "Blue")):
        # Older versions saved the same internal values under the old names.
        page.evaluate(f"localStorage.setItem('orbit:theme', '{stored}')")
        page.reload(wait_until="load")
        check(page.evaluate("document.documentElement.dataset.theme") == stored,
              f"{mode}: saved {stored} still selects its palette after reload")
        open_menu(page, "Settings")
        selected = page.get_by_label("Theme", exact=True).evaluate("s => s.selectedOptions[0].textContent")
        check(selected == label, f"{mode}: saved {stored} reads {label} in Settings ({selected})")
        page.locator("#menu-close").click()
        check(page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim()")
              == palettes[label], f"{mode}: {label} keeps its palette after reload")
    print(f"PASS M15-01 theme names Red and Blue ({mode})")


def m15_right_menu(page, url, mode):
    fresh(page, url)
    for viewport in (WIDE, NARROW):
        page.set_viewport_size(viewport)
        page.wait_for_timeout(200)
        open_menu(page)
        names = [a.get("animationName") for a in page.locator(".menu-sheet").evaluate(
            "s => s.getAnimations().map(a => ({animationName: a.animationName}))")]
        check("sheet-slide-in" in names, f"{mode}: the panel slides in ({viewport['width']}px)")
        page.wait_for_timeout(450)
        box = sheet_box(page)
        check(abs(box["x"] + box["width"] - usable_width(page)) <= 1 and box["x"] > 0,
              f"{mode}: the panel sits on the right edge at {viewport['width']}px ({box})")
        for panel in ("Settings", "Help", "About"):
            page.locator(f'[data-menu-panel="{panel}"]').click()
            check(page.locator("#menu-content h3").inner_text() == panel, f"{mode}: {panel} opens")
        page.locator("#menu-close").click()
        check(menu_closed(page), f"{mode}: the close button closes the menu")
        open_menu(page, "Help")
        page.mouse.click(30, viewport["height"] // 2)
        check(menu_closed(page), f"{mode}: an outside click closes the menu")
        page.screenshot(path=str(ARTIFACTS / f"pending-menu-{mode}-{viewport['width']}.png"))
    # A short window makes Settings taller than the panel; the panel scrolls.
    page.set_viewport_size({"width": 900, "height": 420})
    open_menu(page, "Settings")
    page.wait_for_timeout(400)
    scroll = page.locator(".menu-sheet").evaluate(
        "s => { const before = s.scrollTop; s.scrollTop = 10000; return [s.scrollHeight > s.clientHeight, s.scrollTop > before]; }")
    check(scroll == [True, True], f"{mode}: the panel scrolls when its content is taller ({scroll})")
    page.locator("#menu-close").click()
    # The editor opens full-screen from the same panel and returns to it.
    page.set_viewport_size(WIDE)
    open_menu(page, "Settings")
    page.get_by_role("button", name="Edit links").click()
    page.locator(".editor-page-layout").wait_for()
    box = sheet_box(page)
    check(box["x"] <= 1 and box["width"] >= usable_width(page) - 1, f"{mode}: the editor fills the screen")
    page.locator("#menu-close").click()
    check(menu_closed(page), f"{mode}: the editor closes with the menu")
    print(f"PASS M15-02 right-side menu ({mode})")


def m15_reduced_motion(page, url, mode):
    fresh(page, url)
    page.set_viewport_size(WIDE)
    open_menu(page, "Settings")
    page.get_by_label("Animations", exact=True).select_option("off")
    page.locator("#menu-close").click()
    open_menu(page)
    running = page.locator(".menu-sheet").evaluate("s => s.getAnimations().length")
    box = sheet_box(page)
    check(running == 0 and abs(box["x"] + box["width"] - usable_width(page)) <= 1,
          f"{mode}: with Animations Off the panel appears in place at once ({running}, {box})")
    page.locator('[data-menu-panel="Help"]').click()
    check("Open the Help guide" in page.locator("#menu-content").inner_text(), f"{mode}: controls work without motion")
    page.locator("#menu-close").click()
    # Return to Full and ask for reduced motion instead.
    open_menu(page, "Settings")
    page.get_by_label("Animations", exact=True).select_option("full")
    page.locator("#menu-close").click()
    page.emulate_media(reduced_motion="reduce")
    open_menu(page)
    page.wait_for_timeout(60)
    box = sheet_box(page)
    check(abs(box["x"] + box["width"] - usable_width(page)) <= 1,
          f"{mode}: with reduced motion the panel is in place almost at once ({box})")
    page.locator('[data-menu-panel="About"]').click()
    check("Version" in page.locator("#menu-content").inner_text(), f"{mode}: About works with reduced motion")
    page.locator("#menu-close").click()
    page.emulate_media(reduced_motion="no-preference")
    print(f"PASS M15-03 Animations Off and reduced motion ({mode})")


# ---- Milestone 16 ---------------------------------------------------------

def m16_compact_galaxy(page, url, mode):
    fresh(page, url)
    for viewport in (WIDE, NARROW):
        page.set_viewport_size(viewport)
        page.wait_for_timeout(300)
        check(page.locator(".home-view h1").count() == 0, f"{mode}: no large Galaxy heading")
        check("Hover over a sun" not in page.locator("#app").inner_text(),
              f"{mode}: the Galaxy has no instruction block")
        check(page.locator(".home-hub").count() == len(DATA["groups"]), f"{mode}: every sun is shown")
        topbar = page.locator(".topbar").bounding_box()
        first = page.locator(".group-grid").bounding_box()
        gap = first["y"] - (topbar["y"] + topbar["height"])
        check(0 <= gap <= 150, f"{mode}: the suns start near the top bar ({gap:.0f}px)")
        for hub in page.locator(".home-hub").all():
            box = hub.bounding_box()
            check(box["x"] >= 0 and box["x"] + box["width"] <= viewport["width"],
                  f"{mode}: every sun is within the window at {viewport['width']}px")
        page.screenshot(path=str(ARTIFACTS / f"pending-galaxy-{mode}-{viewport['width']}.png"), full_page=True)
    print(f"PASS M16-01 compact Galaxy ({mode})")


def m16_help_and_navigation(page, url, mode):
    fresh(page, url)
    page.set_viewport_size(WIDE)
    open_menu(page, "Help")
    check(page.locator("#menu-content a.help-guide-link").get_attribute("href") == "help.html", f"{mode}: Help links to the guide")
    help_text = (ROOT / "help.html").read_text()
    for phrase in ("Rest the pointer on a sun", "Click a sun to open its", "Quick find"):
        check(phrase in help_text, f"{mode}: the Help guide explains navigation ({phrase})")
    page.locator("#menu-close").click()
    page.locator("#quick-find").fill("Engadget")
    check(page.locator(".find-item").filter(has_text="Engadget").count() >= 1, f"{mode}: Quick find finds a planet")
    page.locator("#quick-find").fill("")
    page.locator(".home-hub").first.click()
    page.locator(".detail-view").wait_for()
    check(page.locator(".detail-heading h1").inner_text() == DATA["groups"][0]["name"], f"{mode}: a sun opens its System")
    page.locator(".back-link").click()
    page.locator(".home-view").wait_for()
    print(f"PASS M16-02 Help, search, and System navigation ({mode})")


# ---- Milestone 17 ---------------------------------------------------------

def m17_global_settings(page, url, mode):
    for hash_, view in (("", "Galaxy"), ("#group/" + DATA["groups"][0]["id"], "System")):
        fresh(page, url, hash_)
        for viewport in (WIDE, NARROW):
            page.set_viewport_size(viewport)
            page.wait_for_timeout(200)
            fits = page.locator(".topbar").evaluate(
                "t => t.scrollWidth <= t.clientWidth && [...t.querySelectorAll('*')].every(n => "
                "{ const r = n.getBoundingClientRect(); return r.width === 0 || (r.left >= 0 && r.right <= innerWidth); })")
            check(fits, f"{mode}: the header fits in the {view} at {viewport['width']}px")
            check(page.locator("#quick-find").is_visible(), f"{mode}: Quick find shows in the {view}")
            open_menu(page)
            for panel in ("Settings", "Help", "About"):
                page.locator(f'[data-menu-panel="{panel}"]').click()
                check(page.locator("#menu-content h3").inner_text() == panel,
                      f"{mode}: {panel} opens from the {view} at {viewport['width']}px")
            page.locator("#menu-close").click()
        page.screenshot(path=str(ARTIFACTS / f"pending-header-{mode}-{view.lower()}.png"))
    print(f"PASS M17-01 Settings, Help, and About from both views ({mode})")


def m17_search_from_system(page, url, mode):
    sun = DATA["groups"][0]
    fresh(page, url, "#group/" + sun["id"])
    page.set_viewport_size(WIDE)
    page.locator(".detail-view").wait_for()
    target = next(g for g in DATA["groups"] if g["id"] != sun["id"])
    page.locator("#quick-find").press_sequentially(target["name"][:4])
    page.locator(".home-view").wait_for()
    check(page.locator("#quick-find").input_value() == target["name"][:4],
          f"{mode}: the query is kept when the System returns to the Galaxy")
    check(page.locator(".find-results").is_visible(), f"{mode}: Galaxy results show")
    page.locator(".find-item").filter(has_text=target["name"]).first.click()
    page.locator(".detail-view").wait_for()
    check(page.locator(".detail-heading h1").inner_text() == target["name"], f"{mode}: a sun result opens its System")
    # A planet result found from a System opens its destination.
    planet = DATA["groups"][0]["links"][0]
    page.context.route(planet["url"].rstrip("/") + "**", lambda route: route.fulfill(
        status=200, content_type="text/html", body="<title>Test destination</title>"))
    page.locator("#quick-find").fill(planet["name"])
    page.locator(".home-view").wait_for()
    result = page.locator("a.find-item").filter(has_text=planet["name"]).first
    check(result.get_attribute("href") == planet["url"] and result.get_attribute("target") == "_blank",
          f"{mode}: a planet result links to its destination")
    with page.expect_popup() as popup_info:
        result.click()
    popup_info.value.close()
    print(f"PASS M17-02 search from a System ({mode})")


def m17_logo_clears(page, url, mode):
    fresh(page, url)
    page.set_viewport_size(WIDE)
    sun = DATA["groups"][1]
    page.locator("#quick-find").fill(sun["name"])
    page.locator(".find-item").filter(has_text=sun["name"]).first.click()
    page.locator(".detail-view").wait_for()
    check(page.locator("#quick-find").is_visible(), f"{mode}: Quick find stays visible in the System")
    click_logo_to_galaxy(page)
    check(page.locator("#quick-find").input_value() == "", f"{mode}: the logo clears the query")
    check(page.locator(".home-hub").count() == len(DATA["groups"]) and page.locator(".group-grid").is_visible(),
          f"{mode}: the logo shows every sun")
    print(f"PASS M17-03 logo clears search ({mode})")


# ---- B09 and B11 ----------------------------------------------------------

def open_workspace(page):
    open_menu(page, "Settings")
    page.get_by_role("button", name="Edit links").click()
    page.locator(".editor-tree").wait_for()


def tree_item(page, cls, text):
    return page.locator(f".editor-tree .{cls}").filter(has_text=text).first


def b09_workspace(page, url, mode):
    fresh(page, url)
    page.set_viewport_size(NARROW)
    open_workspace(page)
    box = sheet_box(page)
    check(box["x"] <= 1 and box["width"] >= usable_width(page) - 1 and box["height"] >= NARROW["height"] - 1,
          f"{mode}: the workspace fills the window ({box})")
    for viewport in (NARROW, {"width": 1920, "height": 1080}):
        page.set_viewport_size(viewport)
        page.wait_for_timeout(150)
        scroll = page.evaluate("""() => { const s = document.querySelector('.menu-sheet');
          return [s.scrollHeight - s.clientHeight, innerWidth - document.documentElement.clientWidth]; }""")
        check(scroll[0] <= 1 and scroll[1] == 0,
              f"{mode}: only the tree and pane scroll at {viewport['width']}px (sheet overflow, page scrollbar: {scroll})")
    page.set_viewport_size(NARROW)
    # Move the first Tech moon to Build → GitHub through the tree.
    tech, build = DATA["groups"][0], DATA["groups"][2]
    planet, moon = tech["links"][0], tech["links"][0]["moons"][0]
    target = build["links"][0]
    tree_item(page, "editor-tree-moon", moon["name"]).click()
    check(page.locator(".editor-pane").get_by_text(f"Edit {moon['name']}").count() >= 1, f"{mode}: the tree opens a moon")
    page.get_by_role("button", name="Move moon", exact=True).click()
    page.get_by_role("button", name="Move to another planet").click()
    page.get_by_label("Move to", exact=True).select_option(label=f"{build['name']} → {target['name']}")
    page.get_by_role("button", name="Move moon").click()
    saved = json.loads(saved_map(page))["groups"]
    moved = saved[2]["links"][0]["moons"][-1]
    check(moved == moon, f"{mode}: the moved moon keeps its destination ({moved})")
    check(moon not in saved[0]["links"][0]["moons"], f"{mode}: the moon left its old planet")
    left = tree_item(page, "editor-tree-planet", planet["name"]).inner_text()
    check(len(planet["moons"]) != 2 or left.endswith("· 1 moon"), f"{mode}: one moon reads singular ({left})")
    check(tree_item(page, "editor-tree-planet", target["name"]).inner_text().endswith(
        f"{len(target.get('moons', [])) + 1} moons"), f"{mode}: the tree shows the new moon count")
    # Move the second Tech planet, with its moons, to the Read sun.
    second = tech["links"][1]
    read = DATA["groups"][3]
    tree_item(page, "editor-tree-planet", second["name"]).click()
    page.get_by_role("button", name="Move planet", exact=True).click()
    page.get_by_role("button", name="Move to another sun").click()
    page.get_by_label("Move to", exact=True).select_option(label=read["name"])
    page.get_by_role("button", name="Move planet").click()
    saved = json.loads(saved_map(page))["groups"]
    check(saved[3]["links"][-1] == second, f"{mode}: the moved planet keeps its destination and moons")
    check(all(link["name"] != second["name"] for link in saved[0]["links"]), f"{mode}: the planet left Tech")
    check(tree_item(page, "editor-tree-sun", read["name"]).inner_text().endswith(
        f"{len(read['links']) + 1} planets"), f"{mode}: the tree shows the new planet count")
    page.screenshot(path=str(ARTIFACTS / f"pending-workspace-{mode}.png"))
    page.locator("#menu-close").click()
    open_menu(page, "Settings")
    check(page.locator(".editor-page-layout").count() == 0 and
          page.locator(".menu-sheet:not(.editor-page-mode)").count() == 1 and
          page.locator(".menu-top h2").inner_text() == "Explore the menu",
          f"{mode}: Settings returns to its normal panel")
    page.locator("#menu-close").click()
    print(f"PASS B09 edit workspace and cross-parent moves ({mode})")


DROP = """async ([files, selector]) => {
  const transfer = new DataTransfer();
  for (const [name, text] of files) transfer.items.add(new File([text], name));
  const zone = document.querySelector(selector);
  zone.dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true }));
  zone.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
}"""


def b11_drop_and_invalid(page, url, mode):
    fresh(page, url)
    page.set_viewport_size(WIDE)
    labs_index = next(i for i, g in enumerate(DATA["groups"]) if g["name"] == "Labs")
    labs = DATA["groups"][labs_index]
    open_workspace(page)
    tree_item(page, "editor-tree-planet", labs["links"][1]["name"]).click()
    page.get_by_role("button", name="Import .rdp files as moons").click()
    page.locator(".rdp-dropzone").wait_for()
    add = page.get_by_role("button", name="Add imported links")
    before = saved_map(page)
    # Dropping files reads them; non-.rdp files are skipped and secrets excluded.
    page.evaluate(DROP, [[["alpha.rdp", VALID_RDP.format(host="alpha.lab")],
                          ["beta.rdp", VALID_RDP.format(host="beta.lab:3390")],
                          ["notes.txt", "not a profile"]], ".rdp-dropzone"])
    page.locator(".rdp-batch-preview li").nth(1).wait_for()
    summary = page.locator(".rdp-batch-preview p").inner_text()
    check("2 moons ready" in summary and "2 sensitive settings excluded" in summary and "1 other files skipped" in summary,
          f"{mode}: the drop reads two profiles ({summary})")
    check(add.is_enabled(), f"{mode}: Add is enabled for a valid drop")
    # A batch with one invalid profile is refused as a whole.
    page.evaluate(DROP, [[["gamma.rdp", VALID_RDP.format(host="gamma.lab")],
                          ["broken.rdp", "this is not an rdp profile"]], ".rdp-dropzone"])
    page.locator(".editor-error").wait_for()
    error = page.locator(".editor-error").inner_text()
    check("broken.rdp" in error and add.is_disabled() and page.locator(".rdp-batch-preview li").count() == 0,
          f"{mode}: an invalid profile disables Add and clears the preview ({error})")
    check(saved_map(page) == before, f"{mode}: an invalid batch leaves the map unchanged")
    # A profile without a computer address is refused too.
    page.evaluate(DROP, [[["empty.rdp", "screen mode id:i:2\r\n"]], ".rdp-dropzone"])
    page.wait_for_timeout(200)
    check(add.is_disabled() and "full address" in page.locator(".editor-error").inner_text(),
          f"{mode}: a profile with no address is refused")
    check(saved_map(page) == before, f"{mode}: the map is still unchanged")
    # A good drop after the errors still works end to end.
    page.evaluate(DROP, [[["delta.rdp", VALID_RDP.format(host="delta.lab")]], ".rdp-dropzone"])
    page.locator(".rdp-batch-preview li").first.wait_for()
    check(page.locator(".editor-error").count() == 0, f"{mode}: a new valid drop clears the error")
    add.click()
    saved = json.loads(saved_map(page))["groups"][labs_index]["links"][1]["moons"]
    check(saved[-1]["name"] == "delta" and saved[-1]["host"] == "delta.lab" and
          "SECRET" not in json.dumps(saved), f"{mode}: the dropped profile is added without secrets")
    page.locator("#menu-close").click()
    print(f"PASS B11 .rdp drop and invalid batch ({mode})")


CHECKS = (m15_theme_names, m15_right_menu, m15_reduced_motion, m16_compact_galaxy, m16_help_and_navigation,
          m17_global_settings, m17_search_from_system, m17_logo_clears, b09_workspace, b11_drop_and_invalid)


def run_mode(context_page, url, mode, only):
    for check_fn in CHECKS:
        if only and only not in check_fn.__name__:
            continue
        check_fn(context_page(), url, mode)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Run only the checks whose function name contains this text")
    parser.add_argument("--cdp", help="Connect to a running browser at this DevTools address")
    parser.add_argument("--url", help="With --cdp: the page URL of the Orbit copy to test")
    args = parser.parse_args()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        if args.cdp:
            browser = playwright.chromium.connect_over_cdp(args.cdp)
            context = browser.contexts[0]
            print(f"Browser: {browser.version}")
            pages = []

            def new_page():
                if pages:
                    pages.pop().close()
                page = context.new_page()
                page.set_viewport_size(WIDE)
                pages.append(page)
                return page
            try:
                run_mode(new_page, args.url, "remote", args.only)
            finally:
                for page in pages:
                    page.close()
            print("PASS pending checks")
            return
        with tempfile.TemporaryDirectory() as directory:
            fixture = write_fixture(directory, DATA)
            server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(fixture)))
            Thread(target=server.serve_forever, daemon=True).start()
            browser = playwright.chromium.launch(
                executable_path="/usr/bin/chromium", headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"])
            try:
                for mode, url in (("file", (fixture / "index.html").as_uri()),
                                  ("server", f"http://127.0.0.1:{server.server_port}/index.html")):
                    context = browser.new_context(viewport=WIDE)

                    def new_page(context=context):
                        for old in context.pages:
                            old.close()
                        return context.new_page()
                    try:
                        run_mode(new_page, url, mode, args.only)
                    finally:
                        context.close()
            finally:
                browser.close()
                server.shutdown()
                server.server_close()
    print("PASS pending checks")


if __name__ == "__main__":
    main()
