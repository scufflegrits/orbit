"""Phase 0 of the rewrite: check the interaction-mode rules in REWRITE_PLAN.md
("Interaction modes") against the running app, in Chromium.

    python tests/mode_rules_check.py            # file and server mode

Each rule prints PASS or FAIL with its ID (MR01...). A FAIL means the plan's
description doesn't match what the app does; the plan is corrected, not the app.
"""

import json
import sys
import tempfile
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from helpers import ARTIFACTS, QuietHandler, write_fixture  # noqa: E402

DATA = {
    "groups": [
        {"id": "alpha", "name": "Alpha", "color": "#79d9f8", "links": [
            {"name": "Docs", "url": "https://docs.example.test/", "moons": [
                {"name": "Guide", "url": "https://docs.example.test/guide"}]},
            {"name": "Ticket", "url": "https://jira.example.test/browse/{ticket}", "moons": []},
            {"name": "Wiki", "url": "https://wiki.example.test/", "moons": []},
        ]},
        {"id": "beta", "name": "Beta", "color": "#f8a979", "links": [
            {"name": "Status", "url": "https://status.example.test/", "moons": []},
        ]},
    ],
    # Due every day from midnight, so it is offered on load.
    "routines": [{"id": "morning", "name": "Morning", "links": [{"key": "https://docs.example.test", "name": "Docs"}],
                  "schedule": {"time": "00:00", "days": [0, 1, 2, 3, 4, 5, 6]}}],
}

results = []


def rule(rule_id, text, ok, detail=""):
    results.append((rule_id, ok))
    print(f"{'PASS' if ok else 'FAIL'} {rule_id} {text}" + (f" ({detail})" if detail and not ok else ""))


def fresh(page, url, view="orbits"):
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.clear()")
    page.evaluate(f"localStorage.setItem('orbit:galaxy-view', '{view}')")
    page.reload(wait_until="load")
    page.locator(".home-hub, .galaxy-list").first.wait_for()


def edit_on(page):
    return page.locator("#edit-toggle").get_attribute("aria-pressed") == "true"


def set_edit(page, on):
    if edit_on(page) != on:
        page.locator("#edit-toggle").click()


def menu_open(page):
    return page.locator("#menu-overlay").is_visible()


def palette_open(page):
    return page.locator(".palette-overlay:not(.variable-overlay)").count() > 0


def form_open(page):
    return page.locator(".variable-overlay").count() > 0


def in_system(page):
    return page.locator(".detail-view").count() > 0


def drag_state(page):
    return page.evaluate("OrbitTest.state().drag")


def center(locator):
    box = locator.bounding_box()
    return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2


def press_planet(page, move=True):
    """Hover Alpha, press its first planet, and optionally move past the threshold."""
    page.mouse.move(*center(page.locator('.home-hub[data-sun="0"]')))
    planet = page.locator('.home-satellite[data-sun="0"][data-planet="0"]')
    planet.wait_for(state="visible")
    # Planets glide out from their sun (0.35 s), behind it until clear; press where the planet settles.
    page.wait_for_timeout(450)
    x, y = center(planet)
    page.mouse.move(x, y)
    page.mouse.down()
    if move:
        page.mouse.move(x + 5, y + 9)
        page.mouse.move(x + 40, y + 40, steps=4)


def run(page, url, mode):
    print(f"--- {mode}")
    fresh(page, url)
    # MR01: Escape order on the Galaxy, with Edit mode on and Quick find text.
    page.locator("#quick-find").fill("docs")
    set_edit(page, True)
    page.locator("body").click(position={"x": 5, "y": 5})
    page.keyboard.press("Escape")
    first = (edit_on(page), page.locator("#quick-find").input_value())
    page.keyboard.press("Escape")
    second = page.locator("#quick-find").input_value()
    rule("MR01", "Escape turns Edit mode off before clearing Quick find", first == (False, "docs") and second == "",
         f"after 1st Escape edit={first[0]} query={first[1]!r}; after 2nd query={second!r}")

    # MR02: Escape order in a System.
    page.goto(url + "#group/alpha", wait_until="load")
    page.locator(".detail-view").wait_for()
    set_edit(page, True)
    page.keyboard.press("Escape")
    step1 = (edit_on(page), in_system(page))
    page.keyboard.press("Escape")
    page.locator(".detail-view").wait_for(state="detached")
    rule("MR02", "In a System, Escape turns Edit mode off, then returns to the Galaxy",
         step1 == (False, True) and not in_system(page), f"after 1st Escape edit={step1[0]} system={step1[1]}")

    # MR03: the cog opens Settings, which blocks Ctrl+K and / and closes on Escape.
    fresh(page, url)
    cog = page.locator("#settings-trigger")
    settings_tab = page.locator('[data-menu-panel="Settings"]')
    heading = page.locator("#menu-content h3")
    named = cog.get_attribute("title") == "Settings" and page.get_by_role(
        "button", name="Settings", exact=True).and_(cog).count() == 1

    def settings_shown():
        return (menu_open(page) and settings_tab.evaluate("el => el.matches('.active:focus')") and
                heading.all_text_contents() == ["Settings"])

    cog.click()
    first_open = settings_shown()
    page.keyboard.press("Control+k")
    page.keyboard.press("/")
    blocked = not palette_open(page) and page.evaluate("document.activeElement.id") != "quick-find"
    page.keyboard.press("Escape")
    closed = not menu_open(page) and cog.evaluate("el => el === document.activeElement")
    cog.click()
    page.locator('[data-menu-panel="Help"]').click()
    help_shown = heading.all_text_contents() == ["Help"]
    page.keyboard.press("Escape")
    cog.press("Enter")
    reopened = settings_shown()
    page.keyboard.press("Escape")
    page.keyboard.press("Control+k")
    page.keyboard.type("Open Settings")
    page.keyboard.press("Enter")
    from_palette = settings_shown()
    page.keyboard.press("Escape")
    rule("MR03", "The cog opens Settings, refuses Ctrl+K and /, and closes on Escape",
         named and first_open and blocked and closed and help_shown and reopened and from_palette,
         f"named={named} settings={first_open} blocked={blocked} closed={closed} "
         f"help={help_shown} reopened={reopened} palette={from_palette}")

    # MR04: Edit mode stays on when the menu opens.
    set_edit(page, True)
    page.locator("#settings-trigger").click()
    stays = edit_on(page)
    page.keyboard.press("Escape")
    page.locator("#edit-open-editor").click()
    direct_editor = (menu_open(page) and page.locator(".editor-tree").is_visible() and
                     page.locator(".menu-top h2").inner_text() == "Edit your Galaxy")
    page.keyboard.press("Escape")
    rule("MR04", "Edit mode stays on and its Edit links button opens the editor directly",
         stays and direct_editor and edit_on(page))
    set_edit(page, False)

    # MR05: the palette opens with Ctrl+K and Escape closes only the palette.
    set_edit(page, True)
    page.keyboard.press("Control+k")
    opened = palette_open(page)
    page.keyboard.press("Escape")
    rule("MR05", "Escape closes only the palette", opened and not palette_open(page) and edit_on(page),
         f"opened={opened} still_open={palette_open(page)} edit={edit_on(page)}")
    set_edit(page, False)

    # MR06: palette -> placeholder form; the form swallows other keys and closes on Escape.
    page.keyboard.press("Control+k")
    page.keyboard.type("ticket")
    page.keyboard.press("Enter")
    page.locator(".variable-overlay").wait_for()
    from_palette = form_open(page) and not palette_open(page)
    page.locator(".variable-form input").first.press("Control+k")
    page.locator(".variable-form input").first.press("/")
    swallowed = not palette_open(page) and page.evaluate("document.activeElement.id") != "quick-find"
    page.locator(".variable-form input").first.press("Escape")
    rule("MR06", "The palette can open the placeholder form, which ignores Ctrl+K and / and closes on Escape",
         from_palette and swallowed and not form_open(page), f"from_palette={from_palette} swallowed={swallowed}")

    # MR07: a drag is cancelled by opening the menu or palette, a page change, and a re-render.
    cancels = {}
    for name, action in (("menu", "OrbitTest.actions.openMenu()"), ("palette", "OrbitTest.actions.openPalette()"),
                         ("page change", "location.hash = 'group/beta'"), ("re-render", "OrbitTest.actions.render()")):
        fresh(page, url)
        set_edit(page, True)
        press_planet(page)
        before = drag_state(page)
        page.evaluate(action)
        page.wait_for_timeout(100)
        cancels[name] = (before, drag_state(page))
        page.mouse.up()
        page.keyboard.press("Escape")
    rule("MR07", "Opening the menu or palette, a page change, and a re-render each cancel a drag",
         all(v == ("dragging", None) for v in cancels.values()), str(cancels))

    # MR08: Escape cancels a pressed (not yet dragging) item and leaves Edit mode on.
    fresh(page, url)
    set_edit(page, True)
    press_planet(page, move=False)
    pressed = drag_state(page)
    page.keyboard.press("Escape")
    after = (drag_state(page), edit_on(page))
    page.mouse.up()
    rule("MR08", "Escape cancels a pressed item first, keeping Edit mode on", pressed == "pressed" and after == (None, True),
         f"pressed={pressed} after={after}")
    set_edit(page, False)

    # MR09: typing in Quick find inside a System leaves the System.
    page.goto(url + "#group/alpha", wait_until="load")
    page.locator(".detail-view").wait_for()
    page.locator("#quick-find").fill("wiki")
    page.wait_for_timeout(200)
    rule("MR09", "Typing in Quick find inside a System returns to the Galaxy", not in_system(page))

    # MR10: routine offers follow Edit mode only, and stay while the menu is open.
    fresh(page, url)
    offered = page.locator("#routine-banner").count() == 1
    set_edit(page, True)
    hidden_in_edit = page.locator("#routine-banner").count() == 0
    set_edit(page, False)
    back = page.locator("#routine-banner").count() == 1
    page.locator("#settings-trigger").click()
    with_menu = page.locator("#routine-banner").count() == 1
    page.keyboard.press("Escape")
    rule("MR10", "A due routine is offered at start-up, hidden in Edit mode, offered again after, and kept while the menu is open",
         offered and hidden_in_edit and back and with_menu,
         f"offered={offered} hidden_in_edit={hidden_in_edit} back={back} with_menu={with_menu}")

    # MR11: in Edit mode, a list-view link and a palette match open the editor instead of the link.
    fresh(page, url, view="list")
    set_edit(page, True)
    opened = []
    page.context.on("page", lambda p: opened.append(p.url))
    page.locator(".galaxy-list a, .galaxy-list button").filter(has_text="Wiki").first.click()
    list_opens_editor = menu_open(page) and page.locator(".editor-tree").count() == 1
    page.keyboard.press("Escape")
    page.keyboard.press("Control+k")
    page.keyboard.type("wiki")
    page.keyboard.press("Enter")
    palette_opens_editor = menu_open(page) and page.locator(".editor-tree").count() == 1
    page.keyboard.press("Escape")
    rule("MR11", "In Edit mode, list links and palette matches open the editor, and no tab opens",
         list_opens_editor and palette_opens_editor and not opened,
         f"list={list_opens_editor} palette={palette_opens_editor} tabs={opened}")


def run_error_view(page, directory):
    """MR12: the error view refuses Ctrl+K."""
    broken = Path(directory) / "broken"
    broken.mkdir()
    write_fixture(broken, DATA)
    (broken / "links-data.js").write_text("window.ORBIT_DATA = { groups: 'not a list' };\n")
    page.goto((broken / "index.html").as_uri(), wait_until="load")
    page.locator(".error-view").wait_for()
    page.keyboard.press("Control+k")
    rule("MR12", "The error view refuses Ctrl+K", not palette_open(page))


def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as directory, sync_playwright() as playwright:
        fixture = write_fixture(directory, DATA)
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(fixture)))
        Thread(target=server.serve_forever, daemon=True).start()
        browser = playwright.chromium.launch()
        try:
            for mode, url in (("file", (fixture / "index.html").as_uri()),
                              ("server", f"http://127.0.0.1:{server.server_port}/index.html")):
                context = browser.new_context(viewport={"width": 1920, "height": 1080})
                page = context.new_page()
                page.on("dialog", lambda dialog: dialog.accept())
                run(page, url, mode)
                context.close()
            context = browser.new_context(viewport={"width": 1920, "height": 1080})
            run_error_view(context.new_page(), directory)
            context.close()
        finally:
            browser.close()
            server.shutdown()
    failed = [rule_id for rule_id, ok in results if not ok]
    print(f"\n{len(results) - len(failed)} passed, {len(failed)} failed" + (f": {', '.join(failed)}" if failed else ""))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
