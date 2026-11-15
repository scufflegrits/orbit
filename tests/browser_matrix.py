"""Run Orbit's browser checks against file and local-server modes."""

import argparse
import ast
import json
import shutil
import subprocess
import tempfile
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
    check(page.locator(".home-hub").count() == 6, f"{mode}: six suns")
    check("6 SUNS" in page.locator("#link-count").inner_text(), f"{mode}: sun count")
    check("34 LINKS" in page.locator("#link-count").inner_text(), f"{mode}: destination count includes moons")
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
        check(page.locator(".home-hub").count() == 7, "extra sun remains visible")
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
    check(page.locator(".editor-list-row").count() == 6, f"{mode}: editor lists suns")
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
    check(len(exported_map["groups"]) == 7, f"{mode}: export includes new sun")
    check(exported_map["groups"][5]["links"][0]["moons"][0]["name"] == "Second Moon",
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
    check(page.locator(".home-hub").count() == 7,
          f"{mode}: browser edits survive reload")
    personal = page.locator(".home-hub").filter(has_text="Personal Renamed")
    personal.click()
    check(page.url.endswith(f"group/{sun_id}"), f"{mode}: renamed sun route remains stable")
    page.locator(".back-link").click()
    open_editor(page)
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Reset to file data").click()
    check(page.locator(".editor-list-row").count() == 6,
          f"{mode}: reset restores bundled suns")
    with page.expect_file_chooser() as chooser_info:
        page.get_by_role("button", name="Import JSON").click()
    chooser_info.value.set_files({"name": "orbit-links.json", "mimeType": "application/json",
                                  "buffer": exported})
    page.get_by_role("button", name="Apply import").click()
    check(page.locator(".editor-list-row").count() == 7,
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
    check(page.locator(".home-hub").count() == 7, f"{mode}: cancel preserves sun")
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Remove sun").click()
    check(page.locator(".editor-list-row").count() == 6, f"{mode}: confirm removes sun and children")

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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--milestone", type=int, choices=range(1, 6), required=True)
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
                    finally:
                        page.close()
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
