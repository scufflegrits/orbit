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
import re
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
# six, an overflow planet whose seventh moon is rendered twice, and RDP items.
FIXTURE = {"groups": [
    sun("alpha", "Alpha", [
        web("One", "one", [web("Dup", "dup-moon-a"), web("M2", "m2"), web("M3", "m3"),
                           web("M4", "m4"), web("M5", "m5"), web("M6", "m6"),
                           web("M7", "m7"), web("M8", "m8")]),
        web("Dup", "dup-planet-a", [web("Dup", "dup-moon-b"), rdp("RdpMoon", "moon-host.example")]),
        rdp("RdpPlanet", "lab-host.example", [web("RpMoon", "rp-moon")]),
        web("Four", "four", []), web("Five", "five", []), web("Six", "six", []),
        web("Seven", "seven", []), web("Eight", "eight", []),
        web("Nine", "nine", [web("N1", "n1"), web("N2", "n2"), web("N3", "n3"),
                             web("N4", "n4"), web("N5", "n5"), web("N6", "n6"),
                             web("N7", "n7")]),
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
    return page.evaluate("({ groups: OrbitTest.groups() })")


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
        const groups = OrbitTest.groups();
        const moveMapItem = OrbitTest.helpers.moveMapItem;
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
        check(download_json(page, "Whole map (JSON)") == expected, f"{mode}: Whole map (JSON) matches the moved map")
        tree = page.locator(".editor-tree-item").all_inner_texts()
        check(tree.index("M2") > tree.index("B2 · 1 moon"), f"{mode}: the editor tree shows the moved moon under B2")
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
    more_moon = node(page, ".moon-overflow .overflow-moon-link", 0, 7, 6)
    more_moon.scroll_into_view_if_needed()
    scroll = page.evaluate("scrollY")
    check(scroll > 0, f"{mode}: the overflow lists are below the fold")
    press_and_start(page, pt(more_moon))
    row = tray_row(page, "planet", 0, 3)
    row.wait_for(state="visible")
    page.mouse.move(*pt(row), steps=6)
    page.mouse.up()
    expected = moved_moon(expected, 0, 7, 6, 0, 3)
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

    # A moon listed under an overflow planet; its seventh moon is rendered twice.
    fresh(page, url)
    edit_on(page)
    open_system(page, 0)
    check(node(page, ".moon-overflow .overflow-moon-link", 0, 8, 6).count() == 1 and
          node(page, ".overflow-moons .overflow-moon-link", 0, 8, 6).count() == 1,
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
    page.evaluate("OrbitTest.saveMap(OrbitTest.groups(), { label: 'Change' })")
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
    page.evaluate("OrbitTest.saveMap(OrbitTest.groups(), { label: 'Change' })")
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


# ---- Phase 2: reorder and insert beside siblings ----


def siblings(data, kind, parent):
    if kind == "sun":
        return data["groups"]
    if kind == "planet":
        return data["groups"][parent[0]]["links"]
    return data["groups"][parent[0]]["links"][parent[1]]["moons"]


def placed(data, kind, source, parent, index):
    """Remove the item at source and put it at its final index under parent."""
    result = copy.deepcopy(data)
    item = siblings(result, kind, source[:-1]).pop(source[-1])
    siblings(result, kind, parent).insert(index, item)
    return result


def choose(page, sibling, place, release=True):
    """Move onto a sibling, wait for the Before and After choices, and pick one."""
    page.mouse.move(*pt(sibling), steps=6)
    choice = page.locator(f'.drop-choices [data-place="{place}"]')
    choice.wait_for()
    page.mouse.move(*pt(choice), steps=3)
    if release:
        page.mouse.up()


def pause_on(page, locator, reveals):
    """Hold the pointer on an element until the item it reveals is visible."""
    page.mouse.move(*pt(locator), steps=6)
    reveals.wait_for(state="visible")
    page.wait_for_timeout(100)


def export_map(page):
    """Use Edit links > Export JSON and return the exported file's contents."""
    if page.locator("#menu-overlay").is_hidden():
        page.locator("#edit-open-editor" if page.locator("#edit-bar").is_visible() else "#settings-trigger").click()
        if page.locator(".editor-pane").count() == 0:
            page.locator('[data-menu-panel="Settings"]').click()
            page.get_by_role("button", name="Edit links").click()
    page.evaluate("OrbitTest.actions.showSunList()")
    if not CDP:
        return download_json(page, "Whole map (JSON)")
    # A remote browser saves downloads on its own disk, so read the file's bytes as they are made.
    page.evaluate("""() => {
        const original = URL.createObjectURL;
        URL.createObjectURL = blob => { window.exportedText = blob.text(); return original.call(URL, blob); };
    }""")
    page.get_by_role("button", name="Whole map (JSON)", exact=True).click()
    return json.loads(page.evaluate("window.exportedText"))


def run_pure_insertion(page, url, mode):
    """DD10: the insertion form of the shared move operation."""
    fresh(page, url)
    result = page.evaluate("""() => {
        const groups = OrbitTest.groups();
        const moveMapItem = OrbitTest.helpers.moveMapItem;
        const before = JSON.stringify(groups);
        const move = (source, target) => moveMapItem(groups, source, target);
        const planet = (sun, index, place) => ({ kind: 'planet', sun, planet: index, ...(place ? { place } : {}) });
        const moon = (sun, p, index, place) => ({ kind: 'moon', sun, planet: p, moon: index, ...(place ? { place } : {}) });
        const out = {
            sunLast: move({ kind: 'sun', sun: 0 }, { kind: 'sun', sun: 2, place: 'after' }),
            sunFirst: move({ kind: 'sun', sun: 2 }, { kind: 'sun', sun: 0, place: 'before' }),
            adjacentSame: move(planet(0, 0), planet(0, 1, 'before')).status,
            adjacentSwap: move(planet(0, 0), planet(0, 1, 'after')),
            laterSameArray: move(planet(0, 1), planet(0, 4, 'after')),
            earlierSameArray: move(planet(0, 9), planet(0, 0, 'before')),
            crossPlanet: move(planet(0, 1), planet(1, 1, 'before')),
            crossMoon: move(moon(0, 0, 5), moon(1, 0, 0, 'after')),
            moonFirst: move(moon(0, 0, 5), moon(0, 0, 0, 'before')),
            self: move(planet(0, 1), planet(0, 1, 'before')).status,
            sunOnSunNoPlace: move({ kind: 'sun', sun: 0 }, { kind: 'sun', sun: 1 }).status,
            planetBesideMoon: move(planet(0, 1), moon(0, 0, 0, 'before')).status,
            append: move(planet(0, 1), { kind: 'sun', sun: 1 }),
        };
        out.untouched = JSON.stringify(groups) === before;
        return out;
    }""")

    def same(key, expected, path):
        check({"groups": result[key]["groups"]} == expected and result[key]["path"] == path,
              f"{mode}: insertion case {key}")

    same("sunLast", placed(FIXTURE, "sun", (0,), (), 2), {"kind": "sun", "sun": 2})
    same("sunFirst", placed(FIXTURE, "sun", (2,), (), 0), {"kind": "sun", "sun": 0})
    same("adjacentSwap", placed(FIXTURE, "planet", (0, 0), (0,), 1), {"kind": "planet", "sun": 0, "planet": 1})
    same("laterSameArray", placed(FIXTURE, "planet", (0, 1), (0,), 4), {"kind": "planet", "sun": 0, "planet": 4})
    same("earlierSameArray", placed(FIXTURE, "planet", (0, 9), (0,), 0), {"kind": "planet", "sun": 0, "planet": 0})
    same("crossPlanet", placed(FIXTURE, "planet", (0, 1), (1,), 1), {"kind": "planet", "sun": 1, "planet": 1})
    same("crossMoon", placed(FIXTURE, "moon", (0, 0, 5), (1, 0), 1),
         {"kind": "moon", "sun": 1, "planet": 0, "moon": 1})
    same("moonFirst", placed(FIXTURE, "moon", (0, 0, 5), (0, 0), 0),
         {"kind": "moon", "sun": 0, "planet": 0, "moon": 0})
    same("append", moved_planet(FIXTURE, 0, 1, 1), {"kind": "planet", "sun": 1, "planet": 2})
    check(result["sunLast"]["groups"][2]["id"] == "alpha" and len(result["sunLast"]["groups"][2]["links"]) == 10,
          f"{mode}: a reordered sun keeps its ID and descendants")
    check(result["adjacentSame"] == "same", f"{mode}: before the next sibling is the same position")
    check(all(result[key] == "invalid" for key in ("self", "sunOnSunNoPlace", "planetBesideMoon")),
          f"{mode}: self-drops, suns without a position, and mixed kinds are invalid")
    check(result["untouched"], f"{mode}: insertion never changes its input")
    print(f"PASS DD10 pure insertion operation ({mode})")


def run_sun_reorder(page, url, mode):
    """DD11: reorder suns in the Galaxy."""
    fresh(page, url)
    edit_on(page)
    launches = Launches(page)
    press_and_start(page, pt(node(page, ".home-hub", 0)))
    choose(page, node(page, ".home-hub", 1), "after", release=False)
    check("Insert after Beta, position 2 of 3" in page.locator(".drag-preview").inner_text(),
          f"{mode}: the hint names the insertion position")
    check(page.locator(".drop-choice").all_inner_texts() == ["Before Beta", "After Beta"],
          f"{mode}: the placement choices are labeled")
    page.screenshot(path=str(ARTIFACTS / f"drag-sun-choices-{mode}.png"))
    page.mouse.up()
    expected = placed(FIXTURE, "sun", (0,), (), 1)
    check(stored(page) == expected, f"{mode}: Alpha moved after Beta")
    check(page.locator(".home-view").count() == 1 and page.evaluate("location.hash") in ("", "#"),
          f"{mode}: dropping a sun does not open a System")
    check(page.locator(".hub-name").all_inner_texts() == ["Beta", "Alpha", "Gamma"], f"{mode}: the cards are reordered")
    check(page.evaluate("document.activeElement.dataset.sun") == "1", f"{mode}: focus follows the moved sun")

    # Dropping on the sibling without choosing changes nothing.
    press_and_start(page, pt(node(page, ".home-hub", 2)))
    page.mouse.move(*pt(node(page, ".home-hub", 0)), steps=6)
    page.locator(".drop-choices").wait_for()
    page.mouse.move(*pt(page.locator(".drop-choices")))
    page.mouse.up()
    check("Choose Before or After" in status(page) and stored(page) == expected,
          f"{mode}: a drop without a choice changes nothing")

    press_and_start(page, pt(node(page, ".home-hub", 2)))
    choose(page, node(page, ".home-hub", 0), "before")
    expected = placed(expected, "sun", (2,), (), 0)
    check(stored(page) == expected, f"{mode}: the last sun moved to the front")
    page.locator("#edit-undo").click()
    check(page.locator(".hub-name").all_inner_texts() == ["Beta", "Alpha", "Gamma"], f"{mode}: Undo restores the sun order")
    page.evaluate("location.hash = 'group/alpha'")
    page.locator(".detail-view").wait_for()
    check("Alpha" in page.locator(".detail-heading h1").inner_text() and
          "02 / 03" in page.locator(".detail-index").inner_text(),
          f"{mode}: a reordered sun keeps its System address and shows its new index")
    launches.none(f"{mode}: reordering suns")
    print(f"PASS DD11 sun reorder ({mode})")


def run_planet_reorder(page, url, mode):
    """DD12: reorder planets and insert them under another sun."""
    fresh(page, url)
    edit_on(page)
    launches = Launches(page)
    press_and_start(page, galaxy_planet(page, 0, 0))
    choose(page, node(page, ".home-satellite", 0, 3), "after")
    expected = placed(FIXTURE, "planet", (0, 0), (0,), 3)
    check(stored(page) == expected, f"{mode}: a Galaxy planet moved after a sibling")

    # Under another sun, before a chosen planet: pausing on the sun shows its planets.
    press_and_start(page, galaxy_planet(page, 0, 0))
    pause_on(page, node(page, ".home-hub", 1), node(page, ".home-satellite", 1, 1))
    choose(page, node(page, ".home-satellite", 1, 1), "before", release=False)
    check("Insert before B2, position 2 of 3" in page.locator(".drag-preview").inner_text(),
          f"{mode}: cross-sun insertion shows the position")
    page.mouse.up()
    expected = placed(expected, "planet", (0, 0), (1,), 1)
    check(stored(page) == expected, f"{mode}: a planet was inserted before B2 under Beta")

    # In a System the first-eight boundary follows the new order.
    page.set_viewport_size({"width": 1280, "height": 1500})
    fresh(page, url)
    edit_on(page)
    open_system(page, 0)
    press_and_start(page, pt(node(page, ".more-link", 0, 9)))
    choose(page, node(page, ".detail-satellite", 0, 0), "before")
    expected = placed(FIXTURE, "planet", (0, 9), (0,), 0)
    check(stored(page) == expected, f"{mode}: an overflow planet moved to the front")
    check(page.locator(".detail-satellite").all_inner_texts()[:2] == ["Dup", "One"] and
          page.locator(".more-link").all_inner_texts() == ["Eight", "Nine"],
          f"{mode}: the eighth planet moved into More planets")

    press_and_start(page, pt(node(page, ".detail-satellite", 0, 2)))
    choose(page, node(page, ".more-link", 0, 9), "after")
    expected = placed(expected, "planet", (0, 2), (0,), 9)
    check(stored(page) == expected, f"{mode}: a stage planet moved to the end through More planets")

    # Through the tray: pause on a sun to list its planets, then choose a side.
    press_and_start(page, pt(node(page, ".detail-satellite", 0, 0)))
    row = tray_row(page, "planet", 1, 0)
    pause_on(page, tray_row(page, "sun", 1), row)
    choose(page, row, "after")
    expected = placed(expected, "planet", (0, 0), (1,), 1)
    check(stored(page) == expected, f"{mode}: a planet was inserted through the tray")
    launches.none(f"{mode}: reordering planets")
    page.set_viewport_size({"width": 1280, "height": 900})
    print(f"PASS DD12 planet reorder and insertion ({mode})")


def run_moon_reorder(page, url, mode):
    """DD13: reorder moons and insert them under another planet."""
    page.set_viewport_size({"width": 1280, "height": 1500})
    fresh(page, url)
    edit_on(page)
    open_system(page, 0)
    launches = Launches(page)

    # A More moons entry to the front: pausing on the planet shows its moons.
    press_and_start(page, pt(node(page, ".moon-overflow .overflow-moon-link", 0, 0, 6)))
    first = node(page, ".moon-link", 0, 0, 0)
    pause_on(page, node(page, ".detail-satellite", 0, 0), first)
    choose(page, first, "before", release=False)
    page.screenshot(path=str(ARTIFACTS / f"drag-moon-choices-{mode}.png"))
    page.mouse.up()
    expected = placed(FIXTURE, "moon", (0, 0, 6), (0, 0), 0)
    check(stored(page) == expected, f"{mode}: an overflow moon moved to the front")
    check(page.locator(".moon-overflow-links").first.locator("a, button").all_inner_texts() == ["M6", "M8"],
          f"{mode}: the sixth moon moved into More moons")

    # Within one planet on the stage.
    press_and_start(page, system_moon(page, 0, 0, 1))
    choose(page, node(page, ".moon-link", 0, 0, 3), "after")
    expected = placed(expected, "moon", (0, 0, 1), (0, 0), 3)
    check(stored(page) == expected, f"{mode}: a moon moved after a sibling")

    # Beside a moon of another planet on the stage.
    press_and_start(page, system_moon(page, 0, 0, 0))
    target = node(page, ".moon-link", 0, 1, 1)
    pause_on(page, node(page, ".detail-satellite", 0, 1), target)
    choose(page, target, "before")
    expected = placed(expected, "moon", (0, 0, 0), (0, 1), 1)
    check(stored(page) == expected, f"{mode}: a moon was inserted before a moon of another planet")

    # Through the tray: sun, then planet, then a side of one of its moons.
    press_and_start(page, system_moon(page, 0, 0, 0))
    head = page.locator(".drag-tray .tray-group").nth(1).locator(".tray-head")
    planet = tray_row(page, "planet", 1, 0)
    moon = node(page, '.drag-tray .tray-row[data-kind="moon"]', 1, 0, 0)
    pause_on(page, head, planet)
    pause_on(page, planet, moon)
    choose(page, moon, "after")
    expected = placed(expected, "moon", (0, 0, 0), (1, 0), 1)
    check(stored(page) == expected, f"{mode}: a moon was inserted through the tray")

    # Galaxy: another sun, then one of its planets, then beside its moon.
    page.set_viewport_size({"width": 1280, "height": 900})
    fresh(page, url)
    edit_on(page)
    press_and_start(page, galaxy_moon(page, 0, 1, 0))
    planet = node(page, ".home-satellite", 1, 0)
    moon = node(page, ".moon-link", 1, 0, 0)
    pause_on(page, node(page, ".home-hub", 1), planet)
    pause_on(page, planet, moon)
    choose(page, moon, "before")
    check(stored(page) == placed(FIXTURE, "moon", (0, 1, 0), (1, 0), 0),
          f"{mode}: a Galaxy moon was inserted before a moon under another sun")
    launches.none(f"{mode}: reordering moons")
    print(f"PASS DD13 moon reorder and insertion ({mode})")


def run_reorder_rejections(page, url, mode):
    """DD14: a cancelled or failed insertion leaves the order alone."""
    fresh(page, url)
    edit_on(page)

    def unchanged(message):
        check(stored(page) is None and memory(page) == FIXTURE, f"{mode}: {message} leaves the order unchanged")
        check(page.locator(".drag-preview, .drop-choices, .insert-before, .insert-after").count() == 0,
              f"{mode}: {message} clears the placement choices")

    press_and_start(page, galaxy_planet(page, 0, 0))
    choose(page, node(page, ".home-satellite", 0, 1), "before", release=False)
    check("Already in this position" in page.locator(".drag-preview").inner_text() and
          page.locator(".drop-target").count() == 0, f"{mode}: the current position gets no success cue")
    page.mouse.up()
    unchanged("dropping on the current position")

    press_and_start(page, galaxy_planet(page, 0, 0))
    choose(page, node(page, ".home-satellite", 0, 2), "after", release=False)
    check(node(page, ".home-satellite", 0, 2).evaluate("node => node.classList.contains('insert-after')"),
          f"{mode}: the sibling carries the insertion marker")
    page.keyboard.press("Escape")
    page.mouse.up()
    unchanged("Escape over a placement choice")

    page.evaluate("""() => {
        window.realSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error('Synthetic storage failure'); };
    }""")
    press_and_start(page, pt(node(page, ".home-hub", 0)))
    choose(page, node(page, ".home-hub", 2), "after")
    check("could not be saved" in status(page), f"{mode}: a failed reorder reports the error")
    unchanged("a failed save")
    page.evaluate("() => { Storage.prototype.setItem = window.realSetItem; }")
    print(f"PASS DD14 reorder cancellation and save failure ({mode})")


def run_editor_positions(page, url, mode):
    """DD15: keyboard-reachable positions in Edit links; search, tree, reload, export."""
    fresh(page, url)
    page.evaluate("OrbitTest.actions.openEditorAt([0, 1])")
    page.get_by_role("button", name="Move planet", exact=True).click()
    page.get_by_role("button", name="Move to another sun").click()
    page.get_by_label("Move to").select_option("1")
    position = page.get_by_label("Position")
    check(position.locator("option").all_inner_texts() == ["At the end", "Before Dup", "Before B2"],
          f"{mode}: the editor lists the positions under the chosen sun")
    position.select_option("1")
    page.get_by_role("button", name="Move planet", exact=True).click()
    expected = placed(FIXTURE, "planet", (0, 1), (1,), 1)
    check(stored(page) == expected, f"{mode}: the editor inserted a planet before B2")
    check("Sun: Beta" in page.locator(".editor-pane").inner_text(), f"{mode}: the editor follows the moved planet")

    page.evaluate("OrbitTest.actions.openEditorAt([0, 0, 0])")
    page.get_by_role("button", name="Move moon", exact=True).click()
    page.get_by_role("button", name="Move to another planet").click()
    page.get_by_label("Move to").select_option("1:0")
    page.get_by_label("Position").select_option("0")
    page.get_by_role("button", name="Move moon", exact=True).click()
    expected = placed(expected, "moon", (0, 0, 0), (1, 0), 0)
    check(stored(page) == expected, f"{mode}: the editor inserted a moon at the front of another planet")

    tree = page.locator(".editor-tree-item").all_inner_texts()
    beta = tree.index("Beta · 3 planets")
    check(tree[beta + 1:beta + 4] == ["Dup · 2 moons", "Dup", "Dup"] and tree[beta + 4] == "Dup · 2 moons",
          f"{mode}: the editor tree follows the new order")
    check(export_map(page) == expected, f"{mode}: Whole map (JSON) follows the new order")
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    check(memory(page) == expected, f"{mode}: the new order survives a reload")
    page.locator("#quick-find").fill("M")
    names = page.locator(".find-item strong").all_inner_texts()
    # Better matches come first; among equally good ones (a word starting with
    # "m"), results follow the map order.
    starts = re.compile(r"(^|[^a-z0-9])m")
    flat = [item["name"] for group in expected["groups"] for planet in group["links"]
            for item in (planet, *planet["moons"]) if starts.search(item["name"].lower())]
    suns = [group["name"] for group in expected["groups"]]
    check([name for name in names if name not in suns and starts.search(name.lower())] == flat,
          f"{mode}: Quick find follows the new order")
    print(f"PASS DD15 editor positions, tree, export, reload, search ({mode})")


def run_export_after_moves(page, url, mode):
    """DD16: Export JSON after a mixed run of drags, and a round trip through Import JSON."""
    page.set_viewport_size({"width": 1280, "height": 1500})
    fresh(page, url)
    edit_on(page)
    # Galaxy: reorder a sun, move a planet with moons, insert a planet under another sun.
    press_and_start(page, pt(node(page, ".home-hub", 2)))
    choose(page, node(page, ".home-hub", 0), "before")
    expected = placed(FIXTURE, "sun", (2,), (), 0)              # Gamma, Alpha, Beta
    drag_to(page, galaxy_planet(page, 1, 2), pt(node(page, ".home-hub", 0)))
    expected = moved_planet(expected, 1, 2, 0)                  # RdpPlanet with its moon to Gamma
    press_and_start(page, galaxy_planet(page, 1, 1))
    pause_on(page, node(page, ".home-hub", 2), node(page, ".home-satellite", 2, 0))
    choose(page, node(page, ".home-satellite", 2, 0), "after")
    expected = placed(expected, "planet", (1, 1), (2,), 1)      # Dup with RdpMoon between Beta's planets
    # System: reorder a moon, move an overflow moon through the tray, then undo one more move.
    open_system(page, 1)
    press_and_start(page, system_moon(page, 1, 0, 3))
    choose(page, node(page, ".moon-link", 1, 0, 0), "before")
    expected = placed(expected, "moon", (1, 0, 3), (1, 0), 0)
    moved_name = expected["groups"][1]["links"][0]["moons"][6]["name"]
    press_and_start(page, pt(node(page, ".moon-overflow .overflow-moon-link", 1, 0, 6)))
    head = page.locator(".drag-tray .tray-group").nth(0).locator(".tray-head")
    row = tray_row(page, "planet", 0, 0)
    pause_on(page, head, row)
    page.mouse.move(*pt(row), steps=3)
    page.mouse.up()
    expected = moved_moon(expected, 1, 0, 6, 0, 0)              # a More moons entry to RdpPlanet under Gamma
    press_and_start(page, pt(node(page, ".detail-satellite", 1, 1)))
    page.mouse.move(*pt(tray_row(page, "sun", 2)), steps=6)
    page.mouse.up()
    check(stored(page) == moved_planet(expected, 1, 1, 2), f"{mode}: the move to be undone was applied")
    page.locator("#edit-undo").click()
    check(stored(page) == expected and memory(page) == expected, f"{mode}: the mixed run of drags and Undo is stored")

    exported = export_map(page)
    check(exported == expected, f"{mode}: Whole map (JSON) matches the map after the drags")
    check([group["id"] for group in exported["groups"]] == ["gamma", "alpha", "beta"],
          f"{mode}: the export keeps sun IDs in the new order")
    gamma, beta = exported["groups"][0], exported["groups"][2]
    check(gamma["links"][0]["rdpProfile"] == FIXTURE["groups"][0]["links"][2]["rdpProfile"] and
          [moon["name"] for moon in gamma["links"][0]["moons"]] == ["RpMoon", moved_name],
          f"{mode}: the exported RDP planet keeps its profile and gained the moved moon")
    check(beta["links"][1]["moons"][1] == FIXTURE["groups"][0]["links"][1]["moons"][1],
          f"{mode}: the exported RDP moon is unchanged inside its moved planet")
    counts = lambda data: (sum(len(group["links"]) for group in data["groups"]),
                           sum(len(planet["moons"]) for group in data["groups"] for planet in group["links"]))
    check(counts(exported) == counts(FIXTURE), f"{mode}: nothing was lost or duplicated")

    # The exported file imports into a clean browser as the same map.
    fresh(page, url)
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    page.get_by_role("button", name="Edit links").click()
    with page.expect_file_chooser() as chooser:
        page.get_by_role("button", name="Import a file", exact=True).click()
    chooser.value.set_files({"name": "orbit-links.json", "mimeType": "application/json",
                             "buffer": (json.dumps(exported, indent=2) + "\n").encode()})
    page.get_by_role("button", name="Replace my map").click()
    check(stored(page) == expected, f"{mode}: the exported file imports as the same map")
    page.set_viewport_size({"width": 1280, "height": 900})
    print(f"PASS DD16 export after mixed drags, import round trip ({mode})")


PHASE_1 = (run_pure_operation, run_edit_mode, run_galaxy_moves, run_system_moves,
           run_rejections, run_undo, run_layout)
PHASE_2 = (run_pure_insertion, run_sun_reorder, run_planet_reorder, run_moon_reorder,
           run_reorder_rejections, run_editor_positions, run_export_after_moves)


def run_mode(page, url, mode, phase, only=None):
    page.context.route("https://example.test/**", lambda route: route.fulfill(
        status=200, content_type="text/html", body="<title>Test destination</title>"))
    steps = PHASE_1 + (PHASE_2 if phase >= 2 else ())
    for step in steps:
        if not only or only in step.__name__:
            step(page, url, mode)


def main():
    global CDP
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", type=int, choices=(1, 2), required=True)
    parser.add_argument("--only", help="Run only the checks whose function name contains this text")
    parser.add_argument("--cdp", help="Connect to a running browser at this DevTools address")
    parser.add_argument("--url", help="With --cdp: the page URL of the fixture copy to test")
    parser.add_argument("--write-fixture", metavar="DIR",
                        help="Only write the synthetic fixture data files into DIR and exit")
    args = parser.parse_args()
    if args.write_fixture:
        # The whole fixture, test bundle included, so a remote browser tests what the local runs test.
        write_fixture(Path(args.write_fixture), FIXTURE)
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
                run_mode(page, args.url, "remote", args.phase, args.only)
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
                        run_mode(page, url, mode, args.phase, args.only)
                    finally:
                        page.close()
            finally:
                browser.close()
                server.shutdown()
                server.server_close()
    print(f"PASS drag-and-drop phase {args.phase}")


if __name__ == "__main__":
    main()
