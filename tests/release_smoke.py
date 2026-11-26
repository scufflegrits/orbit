"""Smoke-test the committed release bundle by opening the repo folder itself.

    python tests/release_smoke.py

Every other browser suite tests a fixture copy with the test bundle
(.artifacts/orbit.test.js). This one opens the real index.html, orbit.js, and
links-data.js from the repo, in file and server mode, with no test hook,
using clicks and keys only. Run `npm run check:bundle` too: it proves orbit.js
matches its source; this proves it works. Clears what it saves.
"""

import json
import re
import sys
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from helpers import QuietHandler, ROOT, check, open_editor, submit_editor_form  # noqa: E402

VERSION = re.search(r"APP_VERSION = '([^']+)'", (ROOT / "src/app/version.js").read_text()).group(1)
DATA = json.loads((ROOT / "links.json").read_text())


def clear(page):
    page.evaluate("Object.keys(localStorage).filter(k => k.startsWith('orbit:')).forEach(k => localStorage.removeItem(k))")


def run(page, url, mode):
    page.goto(url, wait_until="load")
    clear(page)
    page.reload(wait_until="load")
    hubs = page.locator(".home-hub")
    hubs.first.wait_for()
    check(page.evaluate("typeof window.OrbitTest") == "undefined", f"{mode}: the release bundle has no test hook")
    # Since rewrite phase 8 the release bundle puts nothing on the page: no bridge, no old globals.
    check(page.evaluate("[typeof window.OrbitNext, typeof window.groups, typeof window.render]") == ["undefined"] * 3,
          f"{mode}: the release bundle defines no page globals")
    check(hubs.count() == len(DATA["groups"]), f"{mode}: the Galaxy shows every bundled sun ({hubs.count()})")
    check(page.locator("#workspace-switch option").all_inner_texts() == ["Main", "Dev Toolbox"],
          f"{mode}: Dev Toolbox is shipped as a default workspace")
    check(page.evaluate("Object.keys(localStorage).filter(k => k.startsWith('orbit:')).length") == 0,
          f"{mode}: showing the defaults writes no browser data")
    page.locator("#workspace-switch").select_option("dev-toolbox")
    page.locator(".home-hub").first.wait_for()
    check(page.locator(".home-hub").count() == 5 and "31 LINKS" in page.locator("#link-count").inner_text(),
          f"{mode}: Dev Toolbox loads its bundled map")
    page.locator("#workspace-switch").select_option("main")

    hubs.first.click()
    page.locator(".detail-view").wait_for()
    check(page.locator(".detail-satellite").count() >= 1, f"{mode}: a System opens with its planets")
    page.locator(".brand").click()
    page.locator(".detail-view").wait_for(state="detached")

    planet = DATA["groups"][0]["links"][0]["name"]
    page.locator("#quick-find").fill(planet)
    check(page.locator(".find-results").get_by_text(planet, exact=True).count() >= 1, f"{mode}: Quick find finds {planet}")
    page.keyboard.press("Escape")

    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="About"]').click()
    check(page.locator("#menu-overlay").get_by_text(f"Version {VERSION}").count() == 1, f"{mode}: About shows version {VERSION}")
    page.keyboard.press("Escape")

    open_editor(page)
    page.get_by_role("button", name="Add sun").click()
    page.get_by_label("Sun name").fill("Release smoke")
    page.get_by_label("Color").fill("#67bbcc")
    submit_editor_form(page)
    page.keyboard.press("Escape")
    page.reload(wait_until="load")
    hubs.first.wait_for()
    check(page.locator(".home-hub").filter(has_text="Release smoke").count() == 1, f"{mode}: an edit survives a reload")
    clear(page)
    print(f"PASS release smoke ({mode})")


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            try:
                for mode, url in (("file", (ROOT / "index.html").as_uri()),
                                  ("server", f"http://127.0.0.1:{server.server_port}/index.html")):
                    context = browser.new_context(viewport={"width": 1920, "height": 1080})
                    run(context.new_page(), url, mode)
                    context.close()
            finally:
                browser.close()
    finally:
        server.shutdown()
    print("PASS release smoke")


if __name__ == "__main__":
    main()
