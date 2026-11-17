"""Focused browser checks for drag-and-drop organization.

Usage: python tests/drag_drop.py --phase 1|2
       python tests/drag_drop.py --phase 1 --cdp http://127.0.0.1:9333 --url file:///C:/path/index.html

Without --cdp the checks run in local Chromium against a disposable fixture in
file mode and through a temporary local server. With --cdp they run in an
already started browser (for example Edge on the Windows test VM) against a
copy of the same fixture at --url. Expected maps are built here with plain
list operations, independently of the app's own move helper.
"""

import argparse
import copy
import json
import tempfile
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

from helpers import ARTIFACTS, QuietHandler, check, download_json, saved_map, write_fixture


def web(name, slug, moons=None):
    item = {"name": name, "url": f"https://example.test/{slug}"}
    if moons is not None:
        item["moons"] = moons
    return item


def rdp(name, host, moons=None):
    # A harmless synthetic profile; never a real connection file.
    item = {"name": name, "type": "rdp", "host": host,
            "rdpProfile": f"full address:s:{host}\r\nscreen mode id:i:2\r\nprompt for credentials:i:1\r\n"}
    if moons is not None:
        item["moons"] = moons
    return item


def sun(sun_id, name, links):
    return {"id": sun_id, "name": name, "description": "", "color": "#79d9f8", "links": links}


# Duplicate names, a planet beyond the first eight, moons beyond the first
# four, an overflow planet whose fifth moon is rendered twice, and RDP items.
FIXTURE = {"groups": [
    sun("alpha", "Alpha", [
        web("One", "one", [web("Dup", "dup-moon-a"), web("M2", "m2"), web("M3", "m3"),
                           web("M4", "m4"), web("M5", "m5"), web("M6", "m6")]),
        web("Dup", "dup-planet-a", [web("Dup", "dup-moon-b"), rdp("RdpMoon", "moon-host.example")]),
        rdp("RdpPlanet", "lab-host.example", [web("RpMoon", "rp-moon")]),
        web("Four", "four", []), web("Five", "five", []), web("Six", "six", []),
        web("Seven", "seven", []), web("Eight", "eight", []),
        web("Nine", "nine", [web("N1", "n1"), web("N2", "n2"), web("N3", "n3"),
                             web("N4", "n4"), web("N5", "n5")]),
        web("Dup", "dup-planet-c", []),
    ]),
    sun("beta", "Beta", [web("Dup", "dup-planet-b", [web("Dup", "dup-moon-c")]), web("B2", "b2", [])]),
    sun("gamma", "Gamma", []),
]}
STORAGE_KEY = "orbit:map:v1"
CDP = False


def moved_planet(data, sun_index, planet, to_sun):
    result = copy.deepcopy(data)
    item = result["groups"][sun_index]["links"].pop(planet)
    result["groups"][to_sun]["links"].append(item)
    return result


def moved_moon(data, sun_index, planet, moon, to_sun, to_planet):
    result = copy.deepcopy(data)
    item = result["groups"][sun_index]["links"][planet]["moons"].pop(moon)
    result["groups"][to_sun]["links"][to_planet]["moons"].append(item)
    return result


def stored(page):
    text = saved_map(page)
    return json.loads(text) if text else None


def memory(page):
    return page.evaluate("({ groups })")


def fresh(page, url, **prefs):
    """Load the fixture with empty storage. Animations are off unless asked for."""
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.clear()")
    prefs.setdefault("orbit:animations", "false")
    for key, value in prefs.items():
        page.evaluate("([key, value]) => localStorage.setItem(key, value)", [key, value])
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    page.mouse.move(2, 2)


def edit_on(page):
    page.locator("#edit-toggle").click()
    page.locator("#edit-bar").wait_for(state="visible")
    page.mouse.move(2, 2)


def open_system(page, index):
    page.locator(f'.home-hub[data-sun="{index}"]').click()
    page.locator(".detail-view").wait_for()
    page.mouse.move(2, 2)


def pt(locator):
    box = locator.bounding_box()
    check(box is not None, "element has a box")
    return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2


def node(page, css, sun_index, planet=None, moon=None):
    selector = f'{css}[data-sun="{sun_index}"]'
    if planet is not None:
        selector += f'[data-planet="{planet}"]'
    if moon is not None:
        selector += f'[data-moon="{moon}"]'
    return page.locator(selector)


def press_and_start(page, point):
    """Press on a point and move past the drag threshold."""
    page.mouse.move(*point)
    page.mouse.down()
    page.mouse.move(point[0] + 5, point[1] + 9)


def drag_to(page, start, end, release=True):
    press_and_start(page, start)
    page.mouse.move(*end, steps=6)
    if release:
        page.mouse.up()


def galaxy_planet(page, sun_index, planet, settle=0):
    """Hover a Galaxy sun so its planets appear; return the planet's center."""
    page.mouse.move(*pt(node(page, ".home-hub", sun_index)))
    target = node(page, ".home-satellite", sun_index, planet)
    target.wait_for(state="visible")
    page.wait_for_timeout(settle)
    return pt(target)


def galaxy_moon(page, sun_index, planet, moon, settle=0):
    page.mouse.move(*galaxy_planet(page, sun_index, planet, settle))
    target = node(page, ".moon-link", sun_index, planet, moon)
    target.wait_for(state="visible")
    page.wait_for_timeout(settle)
    return pt(target)


def system_moon(page, sun_index, planet, moon):
    page.mouse.move(*pt(node(page, ".detail-satellite", sun_index, planet)))
    target = node(page, ".moon-link", sun_index, planet, moon)
    target.wait_for(state="visible")
    return pt(target)


def status(page):
    return page.locator("#edit-status").inner_text()


class Launches:
    """Counts popups and downloads so a check can assert nothing opened."""

    def __init__(self, page):
        self.page = page
        self.downloads = 0
        page.on("download", self._download)
        self.pages = len(page.context.pages)

    def _download(self, _download):
        self.downloads += 1

    def none(self, message):
        self.page.wait_for_timeout(250)
        check(len(self.page.context.pages) == self.pages, f"{message}: no new tab")
        check(self.downloads == 0, f"{message}: no download")


def run_pure_operation(page, url, mode):
    """DD01: the shared move operation."""
    fresh(page, url)
    result = page.evaluate("""() => {
        const before = JSON.stringify(groups);
        const out = {};
        out.planet = moveMapItem(groups, { kind: 'planet', sun: 0, planet: 1 }, { kind: 'sun', sun: 1 });
        out.moon = moveMapItem(groups, { kind: 'moon', sun: 0, planet: 1, moon: 1 }, { kind: 'planet', sun: 1, planet: 0 });
        out.sameSun = moveMapItem(groups, { kind: 'planet', sun: 0, planet: 1 }, { kind: 'sun', sun: 0 }).status;
        out.samePlanet = moveMapItem(groups, { kind: 'moon', sun: 0, planet: 0, moon: 0 }, { kind: 'planet', sun: 0, planet: 0 }).status;
        out.wrongKind = moveMapItem(groups, { kind: 'planet', sun: 0, planet: 1 }, { kind: 'planet', sun: 1, planet: 0 }).status;
        out.moonOnSun = moveMapItem(groups, { kind: 'moon', sun: 0, planet: 0, moon: 0 }, { kind: 'sun', sun: 1 }).status;
        out.missingSource = moveMapItem(groups, { kind: 'planet', sun: 0, planet: 99 }, { kind: 'sun', sun: 1 }).status;
        out.missingTarget = moveMapItem(groups, { kind: 'planet', sun: 0, planet: 1 }, { kind: 'sun', sun: 9 }).status;
        out.untouched = JSON.stringify(groups) === before;
        return out;
    }""")
    check(result["planet"]["status"] == "moved" and
          {"groups": result["planet"]["groups"]} == moved_planet(FIXTURE, 0, 1, 1),
          f"{mode}: a planet moves to the end of another sun with its moons, by path not name")
    check(result["planet"]["path"] == {"kind": "planet", "sun": 1, "planet": 2}, f"{mode}: new planet path")
    check({"groups": result["moon"]["groups"]} == moved_moon(FIXTURE, 0, 1, 1, 1, 0),
          f"{mode}: an RDP moon moves with its profile")
    check(result["moon"]["path"] == {"kind": "moon", "sun": 1, "planet": 0, "moon": 1}, f"{mode}: new moon path")
    check(result["sameSun"] == "same" and result["samePlanet"] == "same", f"{mode}: current parent is a no-op")
    check(all(result[key] == "invalid" for key in ("wrongKind", "moonOnSun", "missingSource", "missingTarget")),
          f"{mode}: wrong kinds and missing paths are invalid")
    check(result["untouched"], f"{mode}: the operation never changes its input")
    print(f"PASS DD01 pure move operation ({mode})")


def run_edit_mode(page, url, mode):
    """DD02-DD03: toggle, activation guard, Quick find, Escape layers, keyboard."""
    fresh(page, url)
    toggle = page.locator("#edit-toggle")
    check(toggle.get_attribute("aria-pressed") == "false" and page.locator("#edit-bar").is_hidden(),
          f"{mode}: Edit mode starts Off")

    # Off: a planet still opens its destination.
    page.mouse.move(*galaxy_planet(page, 0, 0))
    with page.context.expect_page() as popup:
        page.mouse.down()
        page.mouse.up()
    check(popup.value.url.startswith("https://example.test/one"), f"{mode}: links work with Edit mode Off")
    popup.value.close()

    edit_on(page)
    check(toggle.get_attribute("aria-pressed") == "true", f"{mode}: toggle reports pressed")
    launches = Launches(page)
    page.mouse.move(*galaxy_planet(page, 0, 0))
    page.mouse.down()
    page.mouse.up()
    launches.none(f"{mode}: clicking a planet in Edit mode")
    check("Links are closed" in status(page), f"{mode}: the click explains why nothing opened")
    page.mouse.move(*galaxy_moon(page, 0, 1, 1))
    page.mouse.down()
    page.mouse.up()
    launches.none(f"{mode}: clicking an RDP download moon in Edit mode")
    node(page, ".home-satellite", 0, 0).focus()
    page.keyboard.press("Enter")
    launches.none(f"{mode}: Enter on a planet in Edit mode")
    page.keyboard.press("ArrowRight")
    check(page.evaluate("document.activeElement.dataset.planet") == "1",
          f"{mode}: arrow keys still move between planets in Edit mode")
    node(page, ".moon-link", 0, 1, 1).focus()
    page.keyboard.press("Space")
    launches.none(f"{mode}: Space on an RDP moon in Edit mode")
    check(stored(page) is None, f"{mode}: clicks in Edit mode save nothing")

    # Quick find opens the exact item in Edit links, even with repeated names.
    page.locator("#quick-find").fill("Dup")
    results = page.locator(".find-item")
    check(results.count() == 6 and page.locator(".find-item[href]").count() == 0,
          f"{mode}: Edit mode results are not destination links")
    results.nth(4).click()  # Dup planet under Beta
    page.locator(".editor-pane").wait_for()
    pane = page.locator(".editor-pane").inner_text()
    check("Sun: Beta" in pane and page.locator(".editor-pane input[type='url']").input_value().endswith("dup-planet-b"),
          f"{mode}: a search result opens that exact planet in Edit links")
    launches.none(f"{mode}: activating a search result in Edit mode")

    # Escape: menu, then Edit mode, then Quick find.
    page.keyboard.press("Escape")
    check(page.locator("#menu-overlay").is_hidden() and toggle.get_attribute("aria-pressed") == "true",
          f"{mode}: Escape closes the menu and keeps Edit mode")
    page.keyboard.press("Escape")
    check(toggle.get_attribute("aria-pressed") == "false" and page.locator("#quick-find").input_value() == "Dup",
          f"{mode}: the next Escape leaves Edit mode only")
    check(page.locator(".find-item[href]").count() == 6, f"{mode}: results are links again with Edit mode Off")
    page.keyboard.press("Escape")
    check(page.locator("#quick-find").input_value() == "", f"{mode}: then Escape clears Quick find")

    # Keyboard toggle, and the mode survives navigation but not a reload.
    toggle.focus()
    page.keyboard.press("Space")
    check(toggle.get_attribute("aria-pressed") == "true", f"{mode}: Space turns Edit mode on")
    open_system(page, 0)
    check(toggle.get_attribute("aria-pressed") == "true" and "alpha" in page.url,
          f"{mode}: a sun still opens its System and Edit mode stays on")
    page.mouse.move(*pt(node(page, ".detail-satellite", 0, 3)))
    page.mouse.down()
    page.mouse.up()
    page.locator(".more-link").first.click()
    launches.none(f"{mode}: System planets and overflow planets stay closed in Edit mode")

    # The native Remote Desktop protocol link is cancelled too.
    page.evaluate("localStorage.setItem('orbit:rdp-launch', 'client')")
    page.reload(wait_until="load")
    page.locator(".detail-satellite").first.wait_for()
    check(toggle.get_attribute("aria-pressed") == "false", f"{mode}: Edit mode is Off after a reload")
    probe = """() => {
        const node = document.querySelector('.detail-satellite[data-planet="2"]');
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        return { href: node.getAttribute('href'), allowed: node.dispatchEvent(event) };
    }"""
    page.evaluate("window.addEventListener('click', event => { if (event.target.closest('a[href^=\"orbit-rdp:\"]')) event.preventDefault(); })")
    edit_on(page)
    result = page.evaluate(probe)
    check(result["href"].startswith("orbit-rdp://") and result["allowed"] is False,
          f"{mode}: an orbit-rdp link is cancelled in Edit mode")
    page.locator("#edit-done").click()
    check(toggle.get_attribute("aria-pressed") == "false" and page.evaluate("document.activeElement.id") == "edit-toggle",
          f"{mode}: the bar turns Edit mode off and returns focus to the toggle")
    print(f"PASS DD02-DD03 Edit mode and activation guard ({mode})")


def run_galaxy_moves(page, url, mode):
    """DD04-DD05: Galaxy drags, persistence, export."""
    fresh(page, url)
    edit_on(page)
    launches = Launches(page)
    expected = moved_planet(FIXTURE, 0, 1, 1)
    start = galaxy_planet(page, 0, 1)
    drag_to(page, start, pt(node(page, ".home-hub", 1)), release=False)
    check(page.locator(".drag-preview").count() == 1 and
          "Drop to move to Beta" in page.locator(".drag-preview").inner_text(),
          f"{mode}: the preview names the target")
    check(node(page, ".home-hub", 1).evaluate("node => node.classList.contains('drop-target')"),
          f"{mode}: the target sun is marked")
    check(stored(page) is None, f"{mode}: nothing is saved while the pointer moves")
    page.mouse.up()
    check(stored(page) == expected and memory(page) == expected,
          f"{mode}: the planet named Dup moved from Alpha to Beta with both moons")
    launches.none(f"{mode}: dropping a planet")
    check("Moved planet Dup to Beta" in status(page), f"{mode}: the move is announced")
    check(page.locator(".drag-preview").count() == 0 and page.locator(".drop-target, .drag-open").count() == 0,
          f"{mode}: drag feedback is cleared")
    check(page.locator("#edit-undo").is_visible(), f"{mode}: Undo last drag is offered")
    check("9 PLANETS" in node(page, ".home-hub", 0).inner_text() and "3 PLANETS" in node(page, ".home-hub", 1).inner_text(),
          f"{mode}: the Galaxy shows the new counts")

    # A moon to another planet of the same sun (animations on, real reveals).
    fresh(page, url, **{"orbit:animations": "true"})
    edit_on(page)
    launches = Launches(page)
    start = galaxy_moon(page, 0, 1, 0, settle=700)
    press_and_start(page, start)
    page.mouse.move(*pt(node(page, ".home-satellite", 0, 2)), steps=6)
    page.mouse.up()
    expected = moved_moon(FIXTURE, 0, 1, 0, 0, 2)
    check(stored(page) == expected, f"{mode}: a moon moved to another planet of the same sun")

    # A moon to a planet under another sun: pausing on that sun reveals its planets.
    start = galaxy_moon(page, 0, 0, 1, settle=700)
    press_and_start(page, start)
    page.mouse.move(*pt(node(page, ".home-hub", 1)), steps=6)
    target = node(page, ".home-satellite", 1, 1)
    target.wait_for(state="visible")
    check(node(page, ".moon-link", 0, 0, 1).is_visible(), f"{mode}: the source moon stays visible during the drag")
    page.wait_for_timeout(700)
    page.screenshot(path=str(ARTIFACTS / f"drag-galaxy-moon-{mode}.png"))
    page.mouse.move(*pt(target), steps=4)
    check("Drop to move to B2" in page.locator(".drag-preview").inner_text(), f"{mode}: revealed planet is a target")
    page.mouse.up()
    expected = moved_moon(expected, 0, 0, 1, 1, 1)
    check(stored(page) == expected, f"{mode}: a moon moved to a planet under another sun")
    launches.none(f"{mode}: dropping moons")

    # Reload and export keep the result.
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    check(memory(page) == expected, f"{mode}: the moved map survives a reload")
    if not CDP:
        page.locator("#settings-trigger").click()
        page.locator('[data-menu-panel="Settings"]').click()
        page.get_by_role("button", name="Edit links").click()
        check(download_json(page, "Export JSON") == expected, f"{mode}: Export JSON matches the moved map")
        tree = page.locator(".editor-tree-item").all_inner_texts()
        check(tree.index("M2") > tree.index("B2 · 1 moons"), f"{mode}: the editor tree shows the moved moon under B2")
    print(f"PASS DD04-DD05 Galaxy moves, reload, export ({mode})")


def tray_row(page, kind, sun_index, planet=None):
    return node(page, f'.drag-tray .tray-row[data-kind="{kind}"]', sun_index, planet)


def run_system_moves(page, url, mode):
    """DD06: System drags through the stage, overflow, and the destination tray."""
    fresh(page, url)
    edit_on(page)
    open_system(page, 0)
    launches = Launches(page)
    check(page.locator(".drag-tray").count() == 0, f"{mode}: the tray is hidden until a drag starts")

    # RDP planet with its profile and moon to the empty sun, through the tray.
    press_and_start(page, pt(node(page, ".detail-satellite", 0, 2)))
    row = tray_row(page, "sun", 2)
    row.wait_for()
    check(tray_row(page, "sun", 0).count() == 0, f"{mode}: the planet tray lists other suns only")
    page.mouse.move(*pt(row), steps=6)
    page.screenshot(path=str(ARTIFACTS / f"drag-system-tray-{mode}.png"))
    page.mouse.up()
    expected = moved_planet(FIXTURE, 0, 2, 2)
    check(stored(page) == expected, f"{mode}: an RDP planet moved to an empty sun with its profile and moon")
    check(page.locator(".drag-tray").count() == 0 and page.locator(".detail-view").count() == 1,
          f"{mode}: the tray closes and the System stays open")
    check(page.evaluate("document.activeElement.id") == "edit-status",
          f"{mode}: focus goes to the result when the item left this System")

    # Moon to another planet on the stage; focus follows the moved moon.
    start = system_moon(page, 0, 0, 2)
    drag_to(page, start, pt(node(page, ".detail-satellite", 0, 2)))
    expected = moved_moon(expected, 0, 0, 2, 0, 2)
    check(stored(page) == expected, f"{mode}: a moon moved to another planet on the stage")
    check(page.evaluate("document.activeElement.textContent") == "M3", f"{mode}: focus follows the moved moon")

    # RDP moon to a planet under another sun; pausing on the sun shows its planets.
    start = system_moon(page, 0, 1, 1)
    press_and_start(page, start)
    head = page.locator(".drag-tray .tray-group").nth(1).locator(".tray-head")
    page.mouse.move(*pt(head), steps=6)
    row = tray_row(page, "planet", 1, 0)
    row.wait_for(state="visible")
    page.mouse.move(*pt(row), steps=3)
    page.mouse.up()
    expected = moved_moon(expected, 0, 1, 1, 1, 0)
    check(stored(page) == expected, f"{mode}: an RDP moon moved to a planet under another sun")

    # Overflow sources keep the scroll position.
    more_moon = node(page, ".moon-overflow .overflow-moon-link", 0, 7, 4)
    more_moon.scroll_into_view_if_needed()
    scroll = page.evaluate("scrollY")
    check(scroll > 0, f"{mode}: the overflow lists are below the fold")
    press_and_start(page, pt(more_moon))
    row = tray_row(page, "planet", 0, 3)
    row.wait_for(state="visible")
    page.mouse.move(*pt(row), steps=6)
    page.mouse.up()
    expected = moved_moon(expected, 0, 7, 4, 0, 3)
    check(stored(page) == expected, f"{mode}: a More moons entry moved to another planet")
    check(abs(page.evaluate("scrollY") - scroll) < 150, f"{mode}: the page stays near the drop, not at the top")

    overflow_planet = node(page, ".more-link", 0, 8)
    overflow_planet.scroll_into_view_if_needed()
    press_and_start(page, pt(overflow_planet))
    row = tray_row(page, "sun", 1)
    row.wait_for()
    page.mouse.move(*pt(row), steps=6)
    page.mouse.up()
    expected = moved_planet(expected, 0, 8, 1)
    check(stored(page) == expected, f"{mode}: the last overflow planet named Dup moved to Beta")

    # A moon listed under an overflow planet; its fifth moon is rendered twice.
    fresh(page, url)
    edit_on(page)
    open_system(page, 0)
    check(node(page, ".moon-overflow .overflow-moon-link", 0, 8, 4).count() == 1 and
          node(page, ".overflow-moons .overflow-moon-link", 0, 8, 4).count() == 1,
          f"{mode}: a moon rendered twice carries the same path")
    planet = node(page, ".more-link", 0, 8)
    planet.scroll_into_view_if_needed()
    page.mouse.move(*pt(planet))
    moon = node(page, ".overflow-moons .overflow-moon-link", 0, 8, 0)
    moon.wait_for(state="visible")
    press_and_start(page, pt(moon))
    check(moon.is_visible(), f"{mode}: the overflow moon list stays open during the drag")
    row = tray_row(page, "planet", 0, 9)
    row.wait_for(state="visible")
    row.scroll_into_view_if_needed()
    page.mouse.move(*pt(row), steps=6)
    page.mouse.up()
    check(stored(page) == moved_moon(FIXTURE, 0, 8, 0, 0, 9),
          f"{mode}: a moon under an overflow planet moved to another overflow planet")
    launches.none(f"{mode}: System drags")
    print(f"PASS DD06 System moves, overflow, tray ({mode})")


def run_rejections(page, url, mode):
    """DD07: invalid drops, cancellations, save failure, changes during a drag."""
    fresh(page, url)
    edit_on(page)
    launches = Launches(page)

    def unchanged(message):
        check(stored(page) is None and memory(page) == FIXTURE, f"{mode}: {message} leaves the map unchanged")
        check(page.locator(".drag-preview, .drag-tray").count() == 0, f"{mode}: {message} clears the overlay")

    start = galaxy_planet(page, 0, 1)
    drag_to(page, start, pt(node(page, ".home-hub", 0)), release=False)
    check("Already in Alpha" in page.locator(".drag-preview").inner_text() and
          page.locator(".drop-target").count() == 0, f"{mode}: the current sun gets no success cue")
    page.mouse.up()
    check("already in Alpha" in status(page), f"{mode}: Already here feedback")
    unchanged("dropping on the current sun")

    start = galaxy_planet(page, 0, 1)
    drag_to(page, start, (640, 880))
    check("not a drop target" in status(page), f"{mode}: outside drop feedback")
    unchanged("dropping outside any target")

    start = galaxy_moon(page, 0, 1, 0)
    drag_to(page, start, pt(node(page, ".home-satellite", 0, 1)))
    unchanged("dropping a moon on its own planet")
    start = galaxy_moon(page, 0, 1, 0)
    drag_to(page, start, pt(node(page, ".home-hub", 0)))
    unchanged("dropping a moon on a sun")

    # Below the threshold it stays a click, and the click opens nothing.
    start = galaxy_planet(page, 0, 1)
    page.mouse.move(*start)
    page.mouse.down()
    page.mouse.move(start[0] + 2, start[1] + 2)
    check(page.locator(".drag-preview").count() == 0, f"{mode}: a small movement does not start a drag")
    page.mouse.up()
    unchanged("a click below the threshold")

    # Escape cancels the drag but keeps Edit mode; the release opens nothing.
    start = galaxy_planet(page, 0, 1)
    drag_to(page, start, pt(node(page, ".home-hub", 1)), release=False)
    page.keyboard.press("Escape")
    check(page.locator("#edit-toggle").get_attribute("aria-pressed") == "true" and "cancelled" in status(page),
          f"{mode}: Escape cancels the drag and keeps Edit mode")
    page.mouse.up()
    check(page.locator(".home-view").count() == 1, f"{mode}: releasing over a sun after Escape does not open it")
    unchanged("Escape during a drag")

    for label, script in (
        ("pointercancel", "document.querySelector('.drag-source').dispatchEvent(new PointerEvent('pointercancel', { pointerId: drag.pointerId, bubbles: true }))"),
        ("window blur", "window.dispatchEvent(new Event('blur'))"),
        ("turning Edit mode off", "setEditMode(false)"),
        ("opening the menu", "openMenu()"),
        ("a route change", "location.hash = 'group/beta'"),
    ):
        start = galaxy_planet(page, 0, 1)
        drag_to(page, start, pt(node(page, ".home-hub", 1)), release=False)
        page.evaluate(script)
        page.wait_for_timeout(100)
        page.mouse.up()
        unchanged(label)
        if label == "turning Edit mode off":
            edit_on(page)
        elif label == "opening the menu":
            page.keyboard.press("Escape")
            check(page.locator("#edit-toggle").get_attribute("aria-pressed") == "true",
                  f"{mode}: closing the menu keeps Edit mode")
        elif label == "a route change":
            page.locator(".detail-view").wait_for()
            page.keyboard.press("Escape")  # leaves Edit mode
            page.keyboard.press("Escape")  # leaves the System
            page.locator(".home-hub").first.wait_for()
            edit_on(page)
    launches.none(f"{mode}: rejected and cancelled drags")

    # A failed save reports the error and changes nothing.
    page.evaluate("""() => {
        window.realSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error('Synthetic storage failure'); };
    }""")
    start = galaxy_planet(page, 0, 1)
    drag_to(page, start, pt(node(page, ".home-hub", 1)))
    check("could not be saved" in status(page) and "Synthetic storage failure" in status(page),
          f"{mode}: a save failure is readable")
    check(page.locator("#edit-undo").is_hidden(), f"{mode}: no Undo after a failed save")
    unchanged("a failed save")
    page.evaluate("() => { Storage.prototype.setItem = window.realSetItem; }")

    # An edit from another tab during the drag is never overwritten.
    start = galaxy_planet(page, 0, 1)
    drag_to(page, start, pt(node(page, ".home-hub", 1)), release=False)
    other = json.dumps(moved_planet(FIXTURE, 0, 0, 2))
    page.evaluate("([key, value]) => localStorage.setItem(key, value)", [STORAGE_KEY, other])
    page.mouse.up()
    check("another tab" in status(page) and saved_map(page) == other and memory(page) == FIXTURE,
          f"{mode}: a map changed in another tab is not overwritten")
    page.evaluate("localStorage.removeItem('orbit:map:v1')")

    # An in-page map change during the drag cancels it.
    start = galaxy_planet(page, 0, 1)
    drag_to(page, start, pt(node(page, ".home-hub", 1)), release=False)
    page.evaluate("saveMap({ groups })")
    page.mouse.up()
    check(stored(page) == FIXTURE and page.locator(".drag-preview").count() == 0,
          f"{mode}: an edit during the drag cancels the move")
    start = galaxy_planet(page, 0, 1)
    drag_to(page, start, pt(node(page, ".home-hub", 1)))
    check(stored(page) == moved_planet(FIXTURE, 0, 1, 1), f"{mode}: Edit mode still works after the failures")
    print(f"PASS DD07 invalid drops, cancellation, save failure ({mode})")


def run_undo(page, url, mode):
    """DD08: one-step drag Undo, separate from removal Undo."""
    fresh(page, url)
    removal = json.dumps({"kind": "planet", "sunId": "beta", "index": 0, "label": "Kept planet",
                          "item": {"name": "Kept", "url": "https://example.test/kept", "moons": []}})
    page.evaluate("value => localStorage.setItem('orbit:undo-removal:v1', value)", removal)
    edit_on(page)
    undo = page.locator("#edit-undo")
    check(undo.is_hidden(), f"{mode}: no drag Undo before a drag")
    start = galaxy_planet(page, 0, 1)
    drag_to(page, start, pt(node(page, ".home-hub", 1)))
    first = moved_planet(FIXTURE, 0, 1, 1)
    start = galaxy_planet(page, 0, 0)
    drag_to(page, start, pt(node(page, ".home-hub", 2)))
    second = moved_planet(first, 0, 0, 2)
    check(stored(page) == second, f"{mode}: two drags applied")
    undo.click()
    check(stored(page) == first and memory(page) == first, f"{mode}: Undo restores the map before the last drag only")
    check(undo.is_hidden() and "Undid the move of planet One to Gamma" in status(page),
          f"{mode}: Undo is single-step and announced")
    check(page.evaluate("localStorage.getItem('orbit:undo-removal:v1')") == removal,
          f"{mode}: drag and Undo leave the removal Undo record alone")

    # Any later map edit retires the drag Undo.
    start = galaxy_planet(page, 0, 0)
    drag_to(page, start, pt(node(page, ".home-hub", 2)))
    check(undo.is_visible(), f"{mode}: Undo is offered again")
    page.evaluate("saveMap({ groups })")
    check(undo.is_hidden(), f"{mode}: a later map edit retires drag Undo")

    # A change from another tab retires it as well.
    start = galaxy_planet(page, 1, 0)
    drag_to(page, start, pt(node(page, ".home-hub", 0)))
    check(undo.is_visible(), f"{mode}: Undo is offered after another drag")
    other = json.dumps(FIXTURE)
    page.evaluate("([key, value]) => localStorage.setItem(key, value)", [STORAGE_KEY, other])
    undo.click()
    check(saved_map(page) == other and undo.is_hidden() and "no longer be undone" in status(page),
          f"{mode}: Undo refuses to restore over another tab's map")
    print(f"PASS DD08 drag Undo ({mode})")


def run_layout(page, url, mode):
    """DD09: narrow and wide layouts, themes, text sizes, reduced motion."""
    for width, theme, size in ((900, "default", "extra"), (900, "alabama", "small"),
                               (1280, "auburn", "large"), (1280, "default", "standard")):
        page.set_viewport_size({"width": width, "height": 900})
        fresh(page, url, **{"orbit:theme": theme, "orbit:font-size": size})
        edit_on(page)
        fits = page.evaluate("""() => {
            const inside = node => { const box = node.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth + 1; };
            return document.documentElement.scrollWidth <= innerWidth + 1 &&
                [...document.querySelectorAll('#edit-toggle, #settings-trigger, #edit-bar, #edit-bar button:not([hidden])')].every(inside);
        }""")
        check(fits, f"{mode}: Edit mode controls fit at {width}px with {size} text")
        start = galaxy_planet(page, 0, 1)
        drag_to(page, start, pt(node(page, ".home-hub", 1)), release=False)
        page.screenshot(path=str(ARTIFACTS / f"drag-layout-{mode}-{width}-{theme}-{size}.png"))
        page.mouse.up()
        check(stored(page) == moved_planet(FIXTURE, 0, 1, 1), f"{mode}: a drag works at {width}px, {theme}, {size}")
    page.set_viewport_size({"width": 1280, "height": 900})

    page.emulate_media(reduced_motion="reduce")
    fresh(page, url, **{"orbit:animations": "true"})
    edit_on(page)
    start = galaxy_moon(page, 0, 1, 0, settle=100)
    press_and_start(page, start)
    page.mouse.move(*pt(node(page, ".home-hub", 1)), steps=6)
    target = node(page, ".home-satellite", 1, 1)
    target.wait_for(state="visible")
    page.wait_for_timeout(500)
    page.mouse.move(*pt(target), steps=3)
    page.mouse.up()
    check(stored(page) == moved_moon(FIXTURE, 0, 1, 0, 1, 1), f"{mode}: a drag works with reduced motion")
    page.emulate_media(reduced_motion="no-preference")
    print(f"PASS DD09 layout, themes, text size, reduced motion ({mode})")


PHASE_1 = (run_pure_operation, run_edit_mode, run_galaxy_moves, run_system_moves,
           run_rejections, run_undo, run_layout)


def run_mode(page, url, mode, phase):
    page.context.route("https://example.test/**", lambda route: route.fulfill(
        status=200, content_type="text/html", body="<title>Test destination</title>"))
    for step in PHASE_1:
        step(page, url, mode)
    if phase >= 2:
        raise SystemExit("Phase 2 checks are not implemented yet.")


def main():
    global CDP
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", type=int, choices=(1, 2), required=True)
    parser.add_argument("--cdp", help="Connect to a running browser at this DevTools address")
    parser.add_argument("--url", help="With --cdp: the page URL of the fixture copy to test")
    parser.add_argument("--write-fixture", metavar="DIR",
                        help="Only write the synthetic fixture data files into DIR and exit")
    args = parser.parse_args()
    if args.write_fixture:
        target = Path(args.write_fixture)
        (target / "links.json").write_text(json.dumps(FIXTURE))
        (target / "links-data.js").write_text("window.ORBIT_DATA = " + json.dumps(FIXTURE) + ";\n")
        return
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        if args.cdp:
            CDP = True
            browser = playwright.chromium.connect_over_cdp(args.cdp)
            context = browser.contexts[0]
            page = context.new_page()
            page.set_viewport_size({"width": 1280, "height": 900})
            print(f"Browser: {browser.version}")
            try:
                run_mode(page, args.url, "remote", args.phase)
            finally:
                page.close()
            return
        with tempfile.TemporaryDirectory() as directory:
            fixture = write_fixture(directory, FIXTURE)
            server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(fixture)))
            Thread(target=server.serve_forever, daemon=True).start()
            browser = playwright.chromium.launch(
                executable_path="/usr/bin/chromium", headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"])
            try:
                for mode, url in (("file", (fixture / "index.html").as_uri()),
                                  ("server", f"http://127.0.0.1:{server.server_port}/index.html")):
                    page = browser.new_page(viewport={"width": 1280, "height": 900})
                    try:
                        run_mode(page, url, mode, args.phase)
                    finally:
                        page.close()
            finally:
                browser.close()
                server.shutdown()
                server.server_close()
    print(f"PASS drag-and-drop phase {args.phase}")


if __name__ == "__main__":
    main()
