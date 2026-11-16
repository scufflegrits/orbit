"""Run Orbit's browser checks against file and local-server modes."""

import argparse
import ast
import json
import shutil
import subprocess
import tempfile
from urllib.parse import urlparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path("/tmp/orbit-browser-tests")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def run_data_checks():
    data = json.loads((ROOT / "links.json").read_text())
    generated = (ROOT / "links-data.js").read_text().split("window.ORBIT_DATA = ", 1)[1]
    check(json.loads(generated.removesuffix(";\n")) == data, "generated data matches JSON")
    for name in ("serve.py", "sync.py", "tests/browser_matrix.py"):
        ast.parse((ROOT / name).read_text())
    for name in ("app.js", "links-data.js"):
        subprocess.run(["node", "--check", str(ROOT / name)], check=True, capture_output=True)
    print("PASS shared (data and syntax)")


def run_shared(page, url, mode):
    page.goto(url, wait_until="load")
    page.locator(".home-hub").first.wait_for()
    check(page.locator(".home-hub").count() == 9, f"{mode}: nine suns")
    check("9 SUNS" in page.locator("#link-count").inner_text(), f"{mode}: sun count")
    check("106 LINKS" in page.locator("#link-count").inner_text(), f"{mode}: destination count includes moons")
    page.locator(".home-hub").first.click()
    page.locator(".detail-view").wait_for()
    check("Tech" in page.locator(".detail-heading h1").inner_text(), f"{mode}: Tech system")
    link = page.locator(".detail-satellite").first
    check(link.get_attribute("target") == "_blank", f"{mode}: destination target")
    check(link.get_attribute("href").startswith("https://"), f"{mode}: destination URL")
    page.context.route("https://www.engadget.com/**", lambda route: route.fulfill(
        status=200, content_type="text/html", body="<title>Test destination</title>"))
    with page.expect_popup() as popup_info:
        link.click()
    popup = popup_info.value
    popup.wait_for_load_state()
    check(popup.url == link.get_attribute("href"), f"{mode}: destination opened")
    popup.close()
    page.locator(".back-link").click()
    page.locator(".home-view").wait_for()
    page.wait_for_timeout(700)
    page.screenshot(path=str(ARTIFACTS / f"shared-{mode}-1280.png"), full_page=True)
    page.set_viewport_size({"width": 900, "height": 900})
    page.wait_for_timeout(300)
    for card in page.locator(".group-card").all():
        box = card.bounding_box()
        check(box is not None and box["x"] >= -1 and box["x"] + box["width"] <= 901,
              f"{mode}: sun fits narrower desktop")
    page.screenshot(path=str(ARTIFACTS / f"shared-{mode}-900.png"), full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    print(f"PASS shared ({mode})")


def run_milestone_1(page, url, mode):
    page.goto(url, wait_until="load")
    page.locator(".home-hub").first.hover()
    page.wait_for_timeout(400)
    check(page.locator(".home-orbit").first.locator(".home-satellite:visible").count() == 5,
          f"{mode}: first five planets visible on hover")
    check("GALAXY" in page.locator(".intro .eyebrow").inner_text(), f"{mode}: Galaxy label")
    page.locator(".home-hub").first.click()
    check("SYSTEM" in page.locator(".detail-heading .eyebrow").inner_text(),
          f"{mode}: System label")
    check("Return to Galaxy" in page.locator(".back-link").inner_text(),
          f"{mode}: return label")
    page.locator(".back-link").click()
    page.screenshot(path=str(ARTIFACTS / f"milestone1-{mode}.png"), full_page=True)
    print(f"PASS milestone 1 ({mode})")


def run_extra_sun_fixture(page):
    with tempfile.TemporaryDirectory(prefix="orbit-fixture-") as directory:
        fixture = Path(directory)
        for name in ("index.html", "styles.css", "app.js"):
            shutil.copy2(ROOT / name, fixture / name)
        data = json.loads((ROOT / "links.json").read_text())
        data["groups"][0]["links"].extend([
            {"name": "Extra One", "url": "https://example.com/one"},
            {"name": "Extra Two", "url": "https://example.com/two"},
        ])
        data["groups"].append({"id": "extra", "name": "Extra", "description": "Fixture",
                               "color": "#88aaff", "links": []})
        (fixture / "links-data.js").write_text("window.ORBIT_DATA = " + json.dumps(data) + ";\n")
        page.goto((fixture / "index.html").as_uri(), wait_until="load")
        page.locator(".home-hub").first.wait_for()
        check(page.locator(".home-hub").count() == 10, "extra sun remains visible")
        page.locator(".home-hub").first.hover()
        check(page.locator(".home-orbit").first.locator(".home-satellite").count() == 5,
              "Galaxy preview stays at five planets")
        page.locator(".home-hub").first.click()
        check(page.locator(".detail-satellite").count() == 7,
              "System includes planets beyond Galaxy preview")
    print("PASS milestone 1 (extra sun fixture)")


def write_fixture(directory, data):
    fixture = Path(directory)
    for name in ("index.html", "styles.css", "app.js"):
        shutil.copy2(ROOT / name, fixture / name)
    (fixture / "links.json").write_text(json.dumps(data))
    (fixture / "links-data.js").write_text("window.ORBIT_DATA = " + json.dumps(data) + ";\n")
    return fixture


def run_milestone_2(page, url, mode):
    page.goto(url, wait_until="load")
    page.locator(".home-hub").first.hover()
    planet = page.locator(".home-planet-cluster").first
    planet.locator(".home-satellite").hover()
    page.wait_for_timeout(350)
    check(planet.locator(".moon-link:visible").count() == 2,
          f"{mode}: Engadget moons appear on planet hover")
    moon = planet.locator(".moon-link").first
    moon.hover()
    check(planet.locator(".moon-link:visible").count() == 2,
          f"{mode}: moons remain visible during pointer movement")
    page.screenshot(path=str(ARTIFACTS / f"milestone2-moons-{mode}.png"), full_page=True)
    page.set_viewport_size({"width": 900, "height": 900})
    planet.locator(".home-satellite").hover()
    page.wait_for_timeout(350)
    for moon_link in planet.locator(".moon-link").all():
        box = moon_link.bounding_box()
        check(box is not None and box["x"] >= 0 and box["x"] + box["width"] <= 900,
              f"{mode}: moon fits narrower desktop")
    page.screenshot(path=str(ARTIFACTS / f"milestone2-moons-{mode}-900.png"), full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    planet.locator(".home-satellite").hover()
    page.context.route("https://www.engadget.com/category/reviews/**", lambda route: route.fulfill(
        status=200, content_type="text/html", body="<title>Test moon destination</title>"))
    with page.expect_popup() as popup_info:
        moon.click()
    popup = popup_info.value
    popup.wait_for_load_state()
    check(popup.url == "https://www.engadget.com/category/reviews/",
          f"{mode}: moon destination opened")
    popup.close()
    page.locator(".home-hub").first.click()
    detail_planet = page.locator(".detail-planet-cluster").first
    detail_planet.locator(".detail-satellite").hover()
    page.wait_for_timeout(350)
    check(detail_planet.locator(".moon-link:visible").count() == 2,
          f"{mode}: System moons appear")
    print(f"PASS milestone 2 ({mode})")


def run_milestone_2_fixtures(page):
    with tempfile.TemporaryDirectory(prefix="orbit-moons-") as directory:
        data = json.loads((ROOT / "links.json").read_text())
        data["groups"][0]["links"][0]["moons"] = [
            {"name": f"Moon {i}", "url": f"https://example.com/moon/{i}"}
            for i in range(7)
        ]
        data["groups"][0]["links"].extend([
            {"name": f"Extra {i}", "url": f"https://example.com/extra/{i}"}
            for i in range(5)
        ])
        fixture = write_fixture(directory, data)
        server = ThreadingHTTPServer(("127.0.0.1", 0),
                                     partial(QuietHandler, directory=str(fixture)))
        Thread(target=server.serve_forever, daemon=True).start()
        urls = (("file", (fixture / "index.html").as_uri()),
                ("server", f"http://127.0.0.1:{server.server_port}/index.html"))
        try:
            for mode, url in urls:
                page.goto(url, wait_until="load")
                page.locator(".home-hub").first.click()
                check(page.locator(".detail-planet-cluster").count() == 8,
                      f"{mode}: System shows eight planets around sun")
                check(page.locator(".overflow-planet").count() == 2,
                      f"{mode}: System lists remaining planets")
                check(page.locator(".moon-overflow .overflow-moon-link").count() == 3,
                      f"{mode}: System lists moons beyond the first four")
                planet = page.locator(".detail-planet-cluster").first
                planet.locator(".detail-satellite").hover()
                page.wait_for_timeout(350)
                check(planet.locator(".moon-link:visible").count() == 4,
                      f"{mode}: System shows first four moons around planet")
                page.screenshot(path=str(ARTIFACTS / f"milestone2-overflow-{mode}.png"),
                                full_page=True)
            legacy = json.loads((ROOT / "links.json").read_text())
            for group in legacy["groups"]:
                for link in group["links"]:
                    link.pop("moons", None)
            write_fixture(directory, legacy)
            for mode, url in urls:
                page.goto(url, wait_until="load")
                page.locator(".home-hub").first.wait_for()
                check(page.locator(".moon-field").count() == 0,
                      f"{mode}: legacy data without moons works")
        finally:
            server.shutdown()
            server.server_close()
    print("PASS milestone 2 (large and legacy fixtures, both modes)")


def run_milestone_3(page, url, mode):
    page.goto(url, wait_until="load")
    page.locator("#settings-trigger").click()
    check(page.locator("#menu-overlay:visible").count() == 1,
          f"{mode}: cog opens menu")
    check(page.locator(".menu-option").count() == 3,
          f"{mode}: Settings, Help, About entries")
    page.locator('[data-menu-panel="Help"]').click()
    check("Hover over a sun" in page.locator("#menu-content").inner_text(),
          f"{mode}: Help content")
    page.locator('[data-menu-panel="About"]').click()
    check("local link map" in page.locator("#menu-content").inner_text(),
          f"{mode}: About content")
    page.locator('[data-menu-panel="Settings"]').click()
    toggle = page.locator('input[aria-label="Animations"]')
    check(toggle.is_checked(), f"{mode}: Animations defaults On")
    toggle.uncheck()
    check(page.locator("html").get_attribute("data-animations") == "off",
          f"{mode}: Animations Off applies immediately")
    check(page.locator(".menu-sheet").evaluate(
        "el => getComputedStyle(el).animationName") == "none",
          f"{mode}: menu motion disabled")
    page.locator("#menu-close").click()
    check(page.locator("#menu-overlay:visible").count() == 0,
          f"{mode}: close control works")
    page.reload(wait_until="load")
    check(page.locator("html").get_attribute("data-animations") == "off",
          f"{mode}: Animations Off persists")
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    page.locator('input[aria-label="Animations"]').check()
    check(page.locator("html").get_attribute("data-animations") == "on",
          f"{mode}: Animations On applies")
    page.locator("#menu-scrim").click(position={"x": 5, "y": 5})
    check(page.locator("#menu-overlay:visible").count() == 0,
          f"{mode}: outside click closes menu")
    page.emulate_media(reduced_motion="reduce")
    check(page.locator(".group-card").first.evaluate(
        "el => parseFloat(getComputedStyle(el).animationDuration) < 0.001"),
          f"{mode}: OS reduced motion takes precedence")
    page.emulate_media(reduced_motion="no-preference")
    page.locator("#settings-trigger").click()
    page.wait_for_timeout(450)
    page.screenshot(path=str(ARTIFACTS / f"milestone3-menu-{mode}.png"), full_page=True)
    page.locator('[data-menu-panel="Settings"]').click()
    page.set_viewport_size({"width": 900, "height": 900})
    sheet = page.locator(".menu-sheet").bounding_box()
    check(sheet is not None and sheet["x"] >= 0 and sheet["x"] + sheet["width"] <= 900,
          f"{mode}: settings panel fits narrower desktop")
    page.screenshot(path=str(ARTIFACTS / f"milestone3-settings-{mode}-900.png"),
                    full_page=True)
    page.locator("#menu-close").click()
    print(f"PASS milestone 3 ({mode})")


def open_editor(page):
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    page.get_by_role("button", name="Edit links").click()
    page.locator(".editor-list-row").first.wait_for()


def submit_editor_form(page):
    page.locator(".editor-form button[type='submit']").click()


def run_milestone_4(page, url, mode):
    page.goto(url, wait_until="load")
    open_editor(page)
    check(page.locator(".editor-list-row").count() == 9, f"{mode}: editor lists suns")
    page.set_viewport_size({"width": 900, "height": 900})
    page.screenshot(path=str(ARTIFACTS / f"milestone4-editor-{mode}-900.png"), full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})

    page.get_by_role("button", name="Add sun").click()
    page.get_by_label("Sun name").fill("Personal")
    page.get_by_label("Description").fill("My saved places")
    page.get_by_label("Color").fill("#67bbcc")
    submit_editor_form(page)
    sun_id = page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups.at(-1).id")
    check(sun_id == "personal", f"{mode}: new sun has stable ID")
    page.get_by_label("Sun name").fill("Personal Renamed")
    submit_editor_form(page)
    check(page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups.at(-1).id") == sun_id,
          f"{mode}: rename preserves sun ID")
    page.get_by_role("button", name="Move up").click()
    check(page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups.at(-2).name") == "Personal Renamed",
          f"{mode}: sun reorder saved")

    page.get_by_role("button", name="Add planet").click()
    page.get_by_label("Planet name").fill("Test Planet")
    page.get_by_label("Destination URL").fill("https://example.com/planet")
    submit_editor_form(page)
    page.get_by_label("Planet name").fill("Renamed Planet")
    page.get_by_label("Destination URL").fill("https://example.com/planet-updated")
    submit_editor_form(page)
    page.get_by_role("button", name="Add moon").click()
    page.get_by_label("Moon name").fill("First Moon")
    page.get_by_label("Destination URL").fill("https://example.com/moon-one")
    submit_editor_form(page)
    page.get_by_label("Moon name").fill("Renamed Moon")
    page.get_by_label("Destination URL").fill("https://example.com/moon-updated")
    submit_editor_form(page)
    page.locator(".editor-back").click()
    page.get_by_role("button", name="Add moon").click()
    page.get_by_label("Moon name").fill("Second Moon")
    page.get_by_label("Destination URL").fill("https://example.com/moon-two")
    submit_editor_form(page)
    page.get_by_role("button", name="Move up").click()
    check(page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups.find(g => g.id === 'personal').links[0].moons[0].name") == "Second Moon",
          f"{mode}: moon reorder saved")
    page.locator(".editor-back").click()
    page.get_by_role("button", name="Add moon").click()
    before_invalid = page.evaluate("localStorage.getItem('orbit:map:v1')")
    page.get_by_label("Destination URL").fill("ftp://example.com")
    submit_editor_form(page)
    check(page.locator(".editor-error").count() == 1,
          f"{mode}: blank moon name rejected")
    page.get_by_label("Moon name").fill("Invalid Moon")
    submit_editor_form(page)
    check("http or https" in page.locator(".editor-error").inner_text(),
          f"{mode}: non-HTTP URL rejected")
    check(page.evaluate("localStorage.getItem('orbit:map:v1')") == before_invalid,
          f"{mode}: invalid edit leaves saved map intact")
    page.locator(".editor-back").click()
    page.locator(".editor-back").click()
    page.locator(".editor-back").click()

    with page.expect_download() as download_info:
        page.get_by_role("button", name="Export JSON").click()
    exported = Path(download_info.value.path()).read_bytes()
    exported_map = json.loads(exported)
    check(len(exported_map["groups"]) == 10, f"{mode}: export includes new sun")
    exported_personal = next(group for group in exported_map["groups"] if group["id"] == "personal")
    check(exported_personal["links"][0]["moons"][0]["name"] == "Second Moon",
          f"{mode}: export preserves moon order")

    with page.expect_file_chooser() as chooser_info:
        page.get_by_role("button", name="Import JSON").click()
    chooser_info.value.set_files({"name": "bad.json", "mimeType": "application/json", "buffer": b"{bad"})
    page.locator(".editor-error").wait_for()
    check(page.evaluate("localStorage.getItem('orbit:map:v1')") == before_invalid,
          f"{mode}: malformed import leaves map intact")
    with page.expect_file_chooser() as chooser_info:
        page.get_by_role("button", name="Import JSON").click()
    chooser_info.value.set_files({"name": "bad-color.json", "mimeType": "application/json",
                                  "buffer": b'{"groups":[{"name":"Bad","color":"#zzzzzz","links":[]}]}'})
    page.locator(".editor-error").filter(has_text="six-digit hex").wait_for()
    check("six-digit hex" in page.locator(".editor-error").inner_text(),
          f"{mode}: invalid color import rejected")

    page.locator("#menu-close").click()
    page.reload(wait_until="load")
    check(page.locator(".home-hub").count() == 10,
          f"{mode}: browser edits survive reload")
    personal = page.locator(".home-hub").filter(has_text="Personal Renamed")
    personal.click()
    check(page.url.endswith(f"group/{sun_id}"), f"{mode}: renamed sun route remains stable")
    page.locator(".back-link").click()
    open_editor(page)
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Reset to file data").click()
    check(page.locator(".editor-list-row").count() == 9,
          f"{mode}: reset restores bundled suns")
    with page.expect_file_chooser() as chooser_info:
        page.get_by_role("button", name="Import JSON").click()
    chooser_info.value.set_files({"name": "orbit-links.json", "mimeType": "application/json",
                                  "buffer": exported})
    page.get_by_role("button", name="Apply import").click()
    check(page.locator(".editor-list-row").count() == 10,
          f"{mode}: import restores exported map")
    check(page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups.find(g => g.id === 'personal').links[0].moons.length") == 2,
          f"{mode}: import restores moon hierarchy")
    check(page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1'))") == exported_map,
          f"{mode}: import restores full exported map")

    page.locator(".editor-back").click()
    page.get_by_label("Always show moons").check()
    page.locator("#menu-close").click()
    personal = page.locator(".home-hub").filter(has_text="Personal Renamed")
    personal.hover()
    page.wait_for_timeout(450)
    card = page.locator(".group-card").filter(has=personal)
    check(card.locator(".moon-link:visible").count() == 2,
          f"{mode}: always-show reveals moons around visible planet")
    page.context.route("https://example.com/moon-two", lambda route: route.fulfill(
        status=200, content_type="text/html", body="<title>Custom moon</title>"))
    with page.expect_popup() as popup_info:
        card.locator(".moon-link").first.click()
    popup = popup_info.value
    popup.wait_for_load_state()
    check(popup.url == "https://example.com/moon-two",
          f"{mode}: custom moon opens configured URL")
    popup.close()
    page.screenshot(path=str(ARTIFACTS / f"milestone4-always-moons-{mode}.png"),
                    full_page=True)
    page.reload(wait_until="load")
    check(page.locator("html").get_attribute("data-moons") == "always",
          f"{mode}: moon setting persists")
    check(page.locator(".home-orbit").first.locator(".moon-link:visible").count() == 0,
          f"{mode}: hidden Galaxy planets stay hidden")

    open_editor(page)
    page.locator(".editor-list-row").filter(has_text="Personal Renamed").get_by_role("button", name="Edit").click()
    page.locator(".editor-list-row").filter(has_text="Renamed Planet").get_by_role("button", name="Edit").click()
    page.locator(".editor-list-row").filter(has_text="Renamed Moon").get_by_role("button", name="Edit").click()
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Remove moon").click()
    check(page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups.find(g => g.id === 'personal').links[0].moons.length") == 1,
          f"{mode}: removing a moon preserves its sibling")
    page.locator(".editor-back").click()
    page.once("dialog", lambda dialog: dialog.dismiss())
    page.get_by_role("button", name="Remove sun").click()
    check(page.locator(".home-hub").count() == 10, f"{mode}: cancel preserves sun")
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Remove sun").click()
    check(page.locator(".editor-list-row").count() == 9, f"{mode}: confirm removes sun and children")

    page.locator(".editor-list-row").filter(has_text="Tech").get_by_role("button", name="Edit").click()
    page.get_by_role("button", name="Add planet").click()
    page.get_by_label("Planet name").fill("Preview Planet")
    page.get_by_label("Destination URL").fill("https://example.com/preview")
    submit_editor_form(page)
    page.get_by_role("button", name="Move up").click()
    check(page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups.find(g => g.id === 'tech').links[4].name") == "Preview Planet",
          f"{mode}: planet reorder changes Galaxy preview")
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Remove planet").click()
    print(f"PASS milestone 4 ({mode})")


def contrast_ratio(foreground, background):
    def luminance(value):
        channels = [int(value[index:index + 2], 16) / 255 for index in (1, 3, 5)]
        linear = [channel / 12.92 if channel <= 0.04045 else
                  ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]
        return sum(channel * weight for channel, weight in zip(linear, (0.2126, 0.7152, 0.0722)))
    brighter, darker = sorted((luminance(foreground), luminance(background)), reverse=True)
    return (brighter + 0.05) / (darker + 0.05)


def run_milestone_5(page, url, mode):
    requests = []
    page.on("request", lambda request: requests.append(request.url))
    page.goto(url, wait_until="load")
    appearances = {}
    for theme in ("default", "alabama", "auburn"):
        page.locator("#settings-trigger").click()
        page.locator('[data-menu-panel="Settings"]').click()
        theme_select = page.get_by_label("Theme")
        check(theme_select.locator("option").count() == 3, f"{mode}: three theme choices")
        theme_select.select_option(theme)
        check(page.locator("html").get_attribute("data-theme") == theme,
              f"{mode}: {theme} theme selected")
        palette = page.evaluate("""() => {
          const style = getComputedStyle(document.documentElement);
          return Object.fromEntries(['--page-bg', '--surface', '--text', '--muted',
            '--subtle', '--faint', '--theme-accent'].map(key => [key, style.getPropertyValue(key).trim()]));
        }""")
        for foreground, background in (("--text", "--page-bg"), ("--text", "--surface"),
                                       ("--muted", "--page-bg"), ("--theme-accent", "--surface")):
            ratio = contrast_ratio(palette[foreground], palette[background])
            check(ratio >= 4.5, f"{mode}: {theme} {foreground} contrast {ratio:.2f}")
        page.get_by_label("Animations").uncheck()
        check(page.locator(".menu-sheet").evaluate(
            "el => getComputedStyle(el).animationName") == "none",
            f"{mode}: motion Off works in {theme}")
        page.get_by_label("Animations").check()
        menu_background = page.locator(".menu-sheet").evaluate(
            "el => getComputedStyle(el).backgroundColor")
        page.locator("#menu-close").click()
        page.wait_for_timeout(700)
        sun_background = page.locator(".home-hub").first.evaluate(
            "el => getComputedStyle(el).backgroundImage")
        moon_background = page.locator(".moon-link").first.evaluate(
            "el => getComputedStyle(el).backgroundColor")
        spoke_color = page.locator(".orbit-lines").first.evaluate(
            "el => getComputedStyle(el).stroke")
        appearances[theme] = (menu_background, sun_background, moon_background, spoke_color)
        page.screenshot(path=str(ARTIFACTS / f"milestone5-{theme}-{mode}-galaxy.png"),
                        full_page=True)
        page.locator(".home-hub").first.click()
        page.wait_for_timeout(700)
        page.screenshot(path=str(ARTIFACTS / f"milestone5-{theme}-{mode}-system.png"),
                        full_page=False)
        page.locator(".back-link").click()
        page.locator("#settings-trigger").click()
        page.locator('[data-menu-panel="Settings"]').click()
        page.get_by_role("button", name="Edit links").click()
        page.set_viewport_size({"width": 900, "height": 900})
        page.screenshot(path=str(ARTIFACTS / f"milestone5-{theme}-{mode}-editor.png"),
                        full_page=True)
        page.set_viewport_size({"width": 1280, "height": 900})
        page.locator("#menu-close").click()
        page.reload(wait_until="load")
        check(page.locator("html").get_attribute("data-theme") == theme,
              f"{mode}: {theme} persists after reload")
    check(len(set(appearances.values())) == 3,
          f"{mode}: all themes change sun, moon, spokes, and menu")
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    page.get_by_label("Theme").select_option("default")
    check(page.locator("html").get_attribute("data-theme") == "default",
          f"{mode}: Default theme restores original selection")
    page.locator("#menu-close").click()
    external = [request for request in requests if request.startswith("http") and
                not request.startswith("http://127.0.0.1:")]
    check(not external, f"{mode}: no remote theme assets loaded: {external}")
    print(f"PASS milestone 5 ({mode})")


def run_milestone_6(page, url, mode):
    page.goto(url, wait_until="load")
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    page.get_by_label("Theme").select_option("alabama")
    page.locator("#menu-close").click()
    page.wait_for_timeout(700)
    colors = page.locator(".home-hub").evaluate_all(
        "nodes => nodes.map(node => getComputedStyle(node).borderColor)")
    check(len(set(colors)) >= 5, f"{mode}: Alabama preserves distinct sun colors")
    page.set_viewport_size({"width": 900, "height": 900})
    page.screenshot(path=str(ARTIFACTS / f"milestone6-alabama-{mode}-900.png"),
                    full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    page.get_by_label("Theme").select_option("default")
    page.locator("#menu-close").click()
    print(f"PASS milestone 6 ({mode})")


def run_milestone_7(page, url, mode):
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:map:v1')")
    page.reload(wait_until="load")
    search = page.get_by_role("searchbox", name="Quick find")
    search.fill("teCH")
    sun_result = page.locator(".find-item").filter(has_text="Galaxy")
    check(sun_result.count() == 1, f"{mode}: partial sun search")
    check("Galaxy" in sun_result.inner_text(),
          f"{mode}: sun result path")
    sun_result.click()
    check("Tech" in page.locator(".detail-heading h1").inner_text(),
          f"{mode}: sun result opens System")
    page.locator(".back-link").click()
    search = page.get_by_role("searchbox", name="Quick find")
    check(search.input_value() == "teCH", f"{mode}: query survives return to Galaxy")
    search.fill("Engadget")
    check("Tech" in page.locator(".find-item").inner_text(),
          f"{mode}: planet result shows parent")
    with page.expect_popup() as popup_info:
        page.locator(".find-item").click()
    popup = popup_info.value
    check(popup.url == "https://www.engadget.com/", f"{mode}: planet search URL")
    popup.close()
    search.fill("Reviews")
    review = page.locator(".find-item").filter(has_text="Tech / Engadget")
    check(review.count() == 1 and "Tech / Engadget" in review.inner_text(),
          f"{mode}: moon result shows full parent path")
    with page.expect_popup() as popup_info:
        review.click()
    popup = popup_info.value
    check(popup.url == "https://www.engadget.com/category/reviews/",
          f"{mode}: moon search URL")
    popup.close()
    page.set_viewport_size({"width": 900, "height": 900})
    page.screenshot(path=str(ARTIFACTS / f"milestone7-find-{mode}-900.png"),
                    full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    search.fill("no such destination")
    check(page.locator(".find-item").count() == 0 and
          "No matching" in page.locator(".find-empty").inner_text(),
          f"{mode}: useful empty state")
    search.fill("Tech")
    open_editor(page)
    page.locator(".editor-list-row").filter(has_text="Tech").get_by_role("button", name="Edit").click()
    page.get_by_label("Sun name").fill("Technology")
    submit_editor_form(page)
    page.locator("#menu-close").click()
    check("Technology" in page.locator(".find-item").filter(has_text="Galaxy").inner_text(),
          f"{mode}: search updates after edit")
    open_editor(page)
    imported = {"groups": [{"id": "research", "name": "Research", "color": "#8899aa",
                            "links": [{"name": "Papers", "url": "https://example.com/papers",
                                       "moons": [{"name": "Preprints", "url": "https://example.com/preprints"}]}]}]}
    with page.expect_file_chooser() as chooser_info:
        page.get_by_role("button", name="Import JSON").click()
    chooser_info.value.set_files({"name": "search.json", "mimeType": "application/json",
                                  "buffer": json.dumps(imported).encode()})
    page.get_by_role("button", name="Apply import").click()
    page.locator("#menu-close").click()
    check(page.locator(".find-item").count() == 0,
          f"{mode}: old search result disappears after import")
    search = page.get_by_role("searchbox", name="Quick find")
    search.fill("Preprints")
    check("Research / Papers" in page.locator(".find-item").inner_text(),
          f"{mode}: imported moon is searchable")
    open_editor(page)
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Reset to file data").click()
    page.locator("#menu-close").click()
    check(page.locator(".find-item").count() == 0,
          f"{mode}: imported result disappears after reset")
    search = page.get_by_role("searchbox", name="Quick find")
    search.fill("Tech")
    check(page.locator(".find-item").filter(has_text="Galaxy").count() == 1,
          f"{mode}: bundled search results return after reset")
    print(f"PASS milestone 7 ({mode})")


def run_milestone_8(page, url, mode):
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:map:v1'); localStorage.removeItem('orbit:undo-removal:v1')")
    page.reload(wait_until="load")
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    check("Bundled project data" in page.locator(".data-source").inner_text(),
          f"{mode}: bundled source in Settings")
    page.get_by_role("button", name="Edit links").click()
    check("Bundled project data" in page.locator(".data-source").inner_text(),
          f"{mode}: bundled source in editor")
    page.locator(".editor-list-row").filter(has_text="Tech").get_by_role("button", name="Edit").click()
    page.locator(".editor-list-row").filter(has_text="Engadget").get_by_role("button", name="Edit").click()
    page.locator(".editor-list-row").filter(has_text="Reviews").get_by_role("button", name="Edit").click()
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Remove moon").click()
    check("Reviews moon" in page.locator(".editor-undo").inner_text(),
          f"{mode}: moon removal offers undo")
    page.locator(".editor-back").click()
    page.get_by_label("Description").fill("Changed after removal")
    submit_editor_form(page)
    page.locator("#menu-close").click()
    page.reload(wait_until="load")
    open_editor(page)
    check("Browser edits" in page.locator(".data-source").inner_text(),
          f"{mode}: browser source survives reload")
    page.get_by_role("button", name="Undo removal").click()
    saved = page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups[0]")
    check(saved["description"] == "Changed after removal" and
          len(saved["links"][0]["moons"]) == 2,
          f"{mode}: moon undo after reload preserves later edit")
    page.locator(".editor-list-row").filter(has_text="Tech").get_by_role("button", name="Edit").click()
    page.locator(".editor-list-row").filter(has_text="Engadget").get_by_role("button", name="Edit").click()
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Remove planet").click()
    page.get_by_role("button", name="Undo removal").click()
    saved = page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups[0]")
    check(saved["links"][0]["name"] == "Engadget" and
          len(saved["links"][0]["moons"]) == 2,
          f"{mode}: planet undo restores moons and order")
    page.locator(".editor-list-row").filter(has_text="Tech").get_by_role("button", name="Edit").click()
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Remove sun").click()
    check(page.locator(".editor-list-row").count() == 8,
          f"{mode}: sun and children removed")
    page.get_by_role("button", name="Undo removal").click()
    saved = page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups[0]")
    check(saved["id"] == "tech" and len(saved["links"]) == 5 and
          len(saved["links"][0]["moons"]) == 2,
          f"{mode}: sun undo restores full hierarchy")
    imported = {"groups": [{"id": "sample", "name": "Sample", "color": "#8899aa",
                            "links": []}]}
    with page.expect_file_chooser() as chooser_info:
        page.get_by_role("button", name="Import JSON").click()
    chooser_info.value.set_files({"name": "source.json", "mimeType": "application/json",
                                  "buffer": json.dumps(imported).encode()})
    page.get_by_role("button", name="Apply import").click()
    check("Browser edits" in page.locator(".data-source").inner_text(),
          f"{mode}: import uses browser source")
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Reset to file data").click()
    check("Bundled project data" in page.locator(".data-source").inner_text(),
          f"{mode}: reset restores bundled source")
    check(page.locator(".editor-undo").count() == 0,
          f"{mode}: replacement clears stale undo")
    page.set_viewport_size({"width": 900, "height": 900})
    page.screenshot(path=str(ARTIFACTS / f"milestone8-editor-{mode}-900.png"),
                    full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    print(f"PASS milestone 8 ({mode})")


def run_milestone_9(page, url, mode):
    data = json.loads((ROOT / "links.json").read_text())
    suns = data["groups"]
    planets = [planet for sun in suns for planet in sun["links"]]
    moons = [moon for planet in planets for moon in planet.get("moons", [])]
    original_suns = suns[:8]
    original_planets = [planet for sun in original_suns for planet in sun["links"]]
    original_moons = [moon for planet in original_planets for moon in planet.get("moons", [])]
    check(len(original_suns) == 8 and len(original_planets) == 40 and len(original_moons) == 56,
          "original eight-sun sample counts")
    check(len({sun["id"] for sun in suns}) == 9, "unique sun IDs")
    for destination in original_planets + original_moons:
        parsed = urlparse(destination["url"])
        check(destination["name"].strip() and parsed.scheme == "https" and parsed.netloc,
              f"valid sample destination: {destination}")
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:map:v1'); localStorage.removeItem('orbit:undo-removal:v1')")
    page.reload(wait_until="load")
    page.wait_for_timeout(700)
    check(page.locator(".home-hub").count() == 9,
          f"{mode}: nine suns on Galaxy")
    cards = page.locator(".group-card").all()
    centers = []
    for card in cards:
        box = card.bounding_box()
        check(box is not None and 0 <= box["x"] and box["x"] + box["width"] <= 1280,
              f"{mode}: sun card fits Galaxy")
        centers.append(box["x"] + box["width"] / 2)
    check(abs(sum(centers[-3:]) / 3 - 640) < 10,
          f"{mode}: last row of three suns is centered")
    check(page.locator(".home-hub").filter(has_text="Stocks & Investing").count() == 1 and
          page.locator(".home-hub").filter(has_text="Science").count() == 1,
          f"{mode}: new suns present")
    check(page.locator(".hub-name").filter(has_text="Stocks & Investing").evaluate(
        "el => el.scrollWidth <= el.clientWidth + 1"),
        f"{mode}: long sun name fits its circle")
    page.screenshot(path=str(ARTIFACTS / f"milestone9-galaxy-{mode}-1280.png"),
                    full_page=True)
    page.set_viewport_size({"width": 900, "height": 900})
    for card in cards:
        box = card.bounding_box()
        check(box is not None and box["x"] >= -1 and box["x"] + box["width"] <= 901,
              f"{mode}: sun card fits narrow Galaxy")
    page.screenshot(path=str(ARTIFACTS / f"milestone9-galaxy-{mode}-900.png"),
                    full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    page.locator(".home-hub").filter(has_text="Stocks & Investing").click()
    check("Stocks & Investing" in page.locator(".detail-heading h1").inner_text(),
          f"{mode}: stocks System opens")
    check(page.locator(".detail-satellite").count() == 5,
          f"{mode}: stocks planets visible")
    investor = page.locator(".detail-planet-cluster").filter(has_text="Investor.gov")
    investor.locator(".detail-satellite").hover()
    page.wait_for_timeout(350)
    check(investor.locator(".moon-link:visible").count() == 4,
          f"{mode}: four Investor.gov moons visible")
    check(investor.locator(".moon-link").nth(2).get_attribute("href") ==
          "https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator",
          f"{mode}: investing moon URL")
    page.screenshot(path=str(ARTIFACTS / f"milestone9-stocks-{mode}.png"),
                    full_page=False)
    page.set_viewport_size({"width": 900, "height": 900})
    investor.locator(".detail-satellite").hover()
    for moon in investor.locator(".moon-link:visible").all():
        box = moon.bounding_box()
        check(box is not None and box["x"] >= 0 and box["x"] + box["width"] <= 900,
              f"{mode}: investing moons fit narrow System")
    page.context.route("https://www.investor.gov/protect-your-investments", lambda route: route.fulfill(
        status=200, content_type="text/html", body="<title>Investor.gov</title>"))
    with page.expect_popup() as popup_info:
        investor.locator(".moon-link").last.click()
    popup = popup_info.value
    popup.wait_for_load_state()
    check(popup.url == "https://www.investor.gov/protect-your-investments",
          f"{mode}: investing moon reachable")
    popup.close()
    page.screenshot(path=str(ARTIFACTS / f"milestone9-stocks-{mode}-900.png"),
                    full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    page.locator(".back-link").click()
    page.locator(".home-hub").filter(has_text="Science").click()
    page.wait_for_function("document.querySelector('.detail-heading h1')?.textContent?.includes('Science')")
    check(page.locator(".detail-satellite").count() == 5,
          f"{mode}: science planets visible")
    nasa = page.locator(".detail-planet-cluster").filter(has_text="NASA Science")
    nasa.locator(".detail-satellite").hover()
    page.wait_for_timeout(350)
    check(nasa.locator(".moon-link:visible").count() == 3,
          f"{mode}: NASA moons visible")
    check(nasa.locator(".moon-link").first.get_attribute("href") ==
          "https://science.nasa.gov/solar-system/",
          f"{mode}: science moon URL")
    page.screenshot(path=str(ARTIFACTS / f"milestone9-science-{mode}.png"),
                    full_page=False)
    page.set_viewport_size({"width": 900, "height": 900})
    nasa.locator(".detail-satellite").hover()
    for moon in nasa.locator(".moon-link:visible").all():
        box = moon.bounding_box()
        check(box is not None and box["x"] >= 0 and box["x"] + box["width"] <= 900,
              f"{mode}: science moons fit narrow System")
    page.screenshot(path=str(ARTIFACTS / f"milestone9-science-{mode}-900.png"),
                    full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    print(f"PASS milestone 9 ({mode})")


def run_milestone_10(page, url, mode):
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:font-size'); localStorage.removeItem('orbit:map:v1')")
    page.reload(wait_until="load")
    check(page.locator("html").get_attribute("data-font-size") == "standard",
          f"{mode}: font size defaults Standard")
    sizes = {"small": 0.9, "standard": 1, "large": 1.15, "extra": 1.3}
    for theme in ("default", "alabama", "auburn"):
        for size, scale in sizes.items():
            page.locator("#settings-trigger").click()
            page.locator('[data-menu-panel="Settings"]').click()
            page.get_by_label("Theme").select_option(theme)
            page.get_by_label("Font size").select_option(size)
            check(page.locator("html").get_attribute("data-font-size") == size,
                  f"{mode}: {theme} {size} applies immediately")
            setting_size = page.locator(".setting-copy strong").first.evaluate(
                "el => parseFloat(getComputedStyle(el).fontSize)")
            check(abs(setting_size - 14 * scale) < 0.2,
                  f"{mode}: {theme} {size} menu text scales")
            page.locator("#menu-close").click()
            page.reload(wait_until="load")
            page.locator(".home-hub").first.wait_for()
            check(page.locator("html").get_attribute("data-font-size") == size,
                  f"{mode}: {theme} {size} persists after reload")
            page.set_viewport_size({"width": 900, "height": 900})
            for hub in page.locator(".home-hub").all():
                check(hub.evaluate("el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1"),
                      f"{mode}: {theme} {size} sun label fits")
            hub_size = page.locator(".home-hub").first.locator(".hub-name").evaluate(
                "el => parseFloat(getComputedStyle(el).fontSize)")
            check(abs(hub_size - 25 * scale) < 0.2,
                  f"{mode}: {theme} {size} sun text scales")
            search = page.get_by_role("searchbox", name="Quick find")
            search.fill("Investor.gov")
            check(page.locator(".find-item").count() == 1,
                  f"{mode}: {theme} {size} search result reachable")
            search.fill("")
            page.locator(".home-hub").filter(has_text="Stocks & Investing").click()
            page.wait_for_function("document.querySelector('.detail-heading h1')?.textContent?.includes('Stocks & Investing')")
            check(page.locator(".detail-hub").evaluate(
                "el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1"),
                f"{mode}: {theme} {size} long System label fits")
            investor = page.locator(".detail-planet-cluster").filter(has_text="Investor.gov")
            investor.locator(".detail-satellite").hover()
            for moon in investor.locator(".moon-link:visible").all():
                box = moon.bounding_box()
                check(box is not None and box["x"] >= 0 and box["x"] + box["width"] <= 900,
                      f"{mode}: {theme} {size} moon fits System")
            page.locator(".back-link").click()
            open_editor(page)
            sheet = page.locator(".menu-sheet").bounding_box()
            check(sheet is not None and sheet["x"] >= 0 and sheet["x"] + sheet["width"] <= 900,
                  f"{mode}: {theme} {size} editor fits desktop")
            if size == "extra":
                page.screenshot(path=str(ARTIFACTS / f"milestone10-{theme}-{mode}-editor.png"),
                                full_page=True)
            page.set_viewport_size({"width": 1280, "height": 900})
            sheet = page.locator(".menu-sheet").bounding_box()
            check(sheet is not None and sheet["x"] >= 0 and sheet["x"] + sheet["width"] <= 1280,
                  f"{mode}: {theme} {size} editor fits normal desktop")
            page.locator("#menu-close").click()
            for hub in page.locator(".home-hub").all():
                check(hub.evaluate("el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1"),
                      f"{mode}: {theme} {size} sun label fits normal desktop")
            if size == "extra":
                page.screenshot(path=str(ARTIFACTS / f"milestone10-{theme}-{mode}-galaxy.png"),
                                full_page=True)
    print(f"PASS milestone 10 ({mode})")


def run_milestone_11(page, url, mode):
    data = json.loads((ROOT / "links.json").read_text())
    check(len(data["groups"]) == 9, "nine bundled suns")
    labs = data["groups"][-1]
    check(labs["id"] == "labs" and [planet["name"] for planet in labs["links"]] ==
          [f"lab{i}" for i in range(1, 6)], "five lab planets")
    check([moon["name"] for moon in labs["links"][0]["moons"]] ==
          [f"lab1-server{i}" for i in range(1, 6)], "five lab1 server moons")
    check(all(item.get("type") == "rdp" and item.get("host") for item in
              labs["links"] + labs["links"][0]["moons"]), "lab destinations use RDP hosts")
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:map:v1')")
    page.reload(wait_until="load")
    check("106 LINKS" in page.locator("#link-count").inner_text(),
          f"{mode}: nine-sun link count")
    labs_hub = page.locator(".home-hub").filter(has_text="Labs")
    check(labs_hub.count() == 1, f"{mode}: Labs sun appears")
    labs_hub.click()
    page.wait_for_function("document.querySelector('.detail-heading h1')?.textContent === 'Labs'")
    check(page.locator(".detail-planet-cluster").count() == 5,
          f"{mode}: five lab planets visible")
    lab1 = page.locator(".detail-planet-cluster").filter(has_text="lab1")
    lab1.locator(".detail-satellite").hover()
    check(lab1.locator(".moon-link:visible").count() == 4 and
          page.locator(".moon-overflow .overflow-moon-link").count() == 1,
          f"{mode}: first four server moons orbit and fifth appears in overflow")
    with page.expect_download() as download_info:
        lab1.locator(".moon-link").first.click()
    download = download_info.value
    check(download.suggested_filename == "lab1-server1.rdp", f"{mode}: RDP filename")
    check(Path(download.path()).read_text() ==
          "full address:s:lab1-server1\nprompt for credentials:i:1\n",
          f"{mode}: RDP file targets selected server without stored credentials")
    with page.expect_download() as download_info:
        page.locator(".moon-overflow .overflow-moon-link").click()
    check(download_info.value.suggested_filename == "lab1-server5.rdp",
          f"{mode}: overflow server downloads")
    page.set_viewport_size({"width": 900, "height": 900})
    page.screenshot(path=str(ARTIFACTS / f"milestone11-labs-{mode}-900.png"), full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    page.locator(".back-link").click()
    page.get_by_role("searchbox", name="Quick find").fill("lab1-server1")
    with page.expect_download() as download_info:
        page.locator(".find-item").click()
    check(download_info.value.suggested_filename == "lab1-server1.rdp",
          f"{mode}: Quick find downloads RDP")
    page.get_by_role("searchbox", name="Quick find").fill("")
    open_editor(page)
    page.locator(".editor-list-row").filter(has_text="Labs").get_by_role("button", name="Edit").click()
    page.locator(".editor-list-row").filter(has_text="lab1").get_by_role("button", name="Edit").click()
    page.locator(".editor-list-row").filter(has_text="lab1-server1").get_by_role("button", name="Edit").click()
    check(page.get_by_label("Destination type").input_value() == "rdp",
          f"{mode}: editor loads RDP type")
    page.get_by_label("Computer name or IP address").fill("bad;host")
    submit_editor_form(page)
    check("computer name or IP address" in page.locator(".editor-error").inner_text(),
          f"{mode}: invalid host rejected")
    page.get_by_label("Computer name or IP address").fill("10.10.1.11:3390")
    submit_editor_form(page)
    saved = page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups.find(g => g.id === 'labs').links[0].moons[0]")
    check(saved == {"name": "lab1-server1", "type": "rdp", "host": "10.10.1.11:3390"},
          f"{mode}: RDP host edit persists")
    page.locator("#menu-close").click()
    page.reload(wait_until="load")
    page.get_by_role("searchbox", name="Quick find").fill("lab1-server1")
    with page.expect_download() as download_info:
        page.locator(".find-item").click()
    check("full address:s:10.10.1.11:3390" in Path(download_info.value.path()).read_text(),
          f"{mode}: edited host appears in download after reload")
    print(f"PASS milestone 11 ({mode})")


def run_milestone_12(page, url, mode):
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:map:v1'); localStorage.removeItem('orbit:rdp-launch')")
    page.reload(wait_until="load")
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    mode_select = page.get_by_label("Remote Desktop launch")
    check(mode_select.input_value() == "download", f"{mode}: RDP download is default")
    mode_select.select_option("client")
    check(page.evaluate("localStorage.getItem('orbit:rdp-launch')") == "client",
          f"{mode}: client setting saved")
    page.set_viewport_size({"width": 900, "height": 900})
    page.screenshot(path=str(ARTIFACTS / f"milestone12-settings-{mode}-900.png"), full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    page.locator("#menu-close").click()
    page.locator(".home-hub").filter(has_text="Labs").click()
    page.wait_for_function("document.querySelector('.detail-heading h1')?.textContent === 'Labs'")
    check(page.locator(".detail-satellite").first.get_attribute("href") == "orbit-rdp://lab1/",
          f"{mode}: lab planet opens native URI")
    lab1 = page.locator(".detail-planet-cluster").filter(has_text="lab1")
    lab1.locator(".detail-satellite").hover()
    check(lab1.locator(".moon-link").first.get_attribute("href") ==
          "orbit-rdp://lab1-server1/", f"{mode}: lab moon opens native URI")
    check(page.locator(".moon-overflow .overflow-moon-link").get_attribute("href") ==
          "orbit-rdp://lab1-server5/", f"{mode}: overflow moon opens native URI")
    page.locator(".back-link").click()
    page.get_by_role("searchbox", name="Quick find").fill("lab1-server1")
    check(page.locator(".find-item").get_attribute("href") == "orbit-rdp://lab1-server1/",
          f"{mode}: Quick find opens native URI")
    page.reload(wait_until="load")
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    check(page.get_by_label("Remote Desktop launch").input_value() == "client",
          f"{mode}: client setting persists after reload")
    page.get_by_label("Remote Desktop launch").select_option("download")
    page.locator("#menu-close").click()
    page.get_by_role("searchbox", name="Quick find").fill("lab1-server1")
    check(page.locator(".find-item").get_attribute("href") is None,
          f"{mode}: download mode restores button")
    with page.expect_download() as download_info:
        page.locator(".find-item").click()
    check(download_info.value.suggested_filename == "lab1-server1.rdp",
          f"{mode}: download mode remains available")
    print(f"PASS milestone 12 ({mode})")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--milestone", type=int, choices=range(1, 13), required=True)
    args = parser.parse_args()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    run_data_checks()
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path="/usr/bin/chromium", headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            try:
                for mode, url in (
                    ("file", (ROOT / "index.html").as_uri()),
                    ("server", f"http://127.0.0.1:{server.server_port}/index.html"),
                ):
                    page = browser.new_page(viewport={"width": 1280, "height": 900})
                    try:
                        run_shared(page, url, mode)
                        if args.milestone >= 1:
                            run_milestone_1(page, url, mode)
                        if mode == "file":
                            run_extra_sun_fixture(page)
                        if args.milestone >= 2:
                            run_milestone_2(page, url, mode)
                            if mode == "file":
                                run_milestone_2_fixtures(page)
                        if args.milestone >= 3:
                            run_milestone_3(page, url, mode)
                        if args.milestone >= 4:
                            run_milestone_4(page, url, mode)
                        if args.milestone >= 5:
                            run_milestone_5(page, url, mode)
                        if args.milestone >= 6:
                            run_milestone_6(page, url, mode)
                        if args.milestone >= 7:
                            run_milestone_7(page, url, mode)
                        if args.milestone >= 8:
                            run_milestone_8(page, url, mode)
                        if args.milestone >= 9:
                            run_milestone_9(page, url, mode)
                        if args.milestone >= 10:
                            run_milestone_10(page, url, mode)
                        if args.milestone >= 11:
                            run_milestone_11(page, url, mode)
                        if args.milestone >= 12:
                            run_milestone_12(page, url, mode)
                    finally:
                        page.close()
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
