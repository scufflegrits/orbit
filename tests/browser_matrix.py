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
                    finally:
                        page.close()
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
