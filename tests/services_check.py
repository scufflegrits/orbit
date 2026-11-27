"""Rewrite phase 4: browser checks for the services (REWRITE_PLAN.md, "Checks
added by the review").

    python tests/services_check.py                     # Chromium, file and server mode
    python tests/services_check.py --cdp http://127.0.0.1:9333 --url file:///C:/orbit-svc-test/index.html
                                                       # pop-up checks only, in a remote browser
    python tests/services_check.py --write-fixture DIR # the pop-up fixture, for a remote browser

Pop-up allowance, layer 2 (supporting evidence only): a window.open stub
records navigator.userActivation.isActive for every tab Orbit asks for, from
each way of opening several links. Every call must happen while the click's
user activation is still active, so no await or timer came first.

Team map in server mode: which of team.json and team-data.js loads, and the
error text when /team.json fails and there is no team-data.js.
"""

import argparse
import json
import sys
import tempfile
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import serve  # noqa: E402
from helpers import QuietHandler, check, write_fixture  # noqa: E402

VIEW = {"width": 1920, "height": 1080}

DATA = {
    "groups": [
        {"id": "alpha", "name": "Alpha", "color": "#79d9f8", "links": [
            {"name": "Docs", "url": "https://docs.example.test/", "favorite": True, "moons": [
                {"name": "Guide", "url": "https://docs.example.test/guide"},
                {"name": "API", "url": "https://docs.example.test/api", "favorite": True}]},
            {"name": "Ticket", "url": "https://jira.example.test/browse/{ticket}", "moons": []},
        ]},
    ],
    # Due every day from midnight, so it is offered on load.
    "routines": [{"id": "morning", "name": "Morning", "links": [
        {"key": "https://docs.example.test", "name": "Docs"}, {"key": "https://docs.example.test/guide", "name": "Guide"}],
        "schedule": {"time": "00:00", "days": [0, 1, 2, 3, 4, 5, 6]}}],
}

TEAM_FILE = {"groups": [{"id": "ops", "name": "Ops from team.json", "color": "#79d9f8", "links": [
    {"name": "Status", "url": "https://status.example.test/", "moons": []}]}]}
TEAM_SCRIPT = {"groups": [{"id": "ops", "name": "Ops from team-data.js", "color": "#79d9f8", "links": [
    {"name": "Runbook", "url": "https://runbook.example.test/", "moons": []}]}]}

STUB = """() => {
  window.__opens = [];
  window.open = (url, target) => {
    window.__opens.push({ url, target, active: navigator.userActivation.isActive });
    return {};
  };
}"""


def fresh(page, url):
    page.goto(url, wait_until="load")
    page.evaluate("Object.keys(localStorage).filter(k => k.startsWith('orbit:')).forEach(k => localStorage.removeItem(k))")
    page.reload(wait_until="load")
    page.locator(".home-hub, .galaxy-list").first.wait_for()
    page.evaluate(STUB)


def opens(page):
    return page.evaluate("window.__opens")


def all_active(page, what, expected, mode):
    calls = opens(page)
    check([call["url"] for call in calls] == expected, f"{mode}: {what} asked for {expected} ({calls})")
    check(all(call["target"] == "_blank" for call in calls), f"{mode}: {what} opens new tabs")
    check(all(call["active"] for call in calls), f"{mode}: {what}: every window.open ran during the click ({calls})")
    print(f"PASS {what}: {len(calls)} window.open calls, all with user activation ({mode})")


def popup_checks(page, url, mode):
    page.on("dialog", lambda dialog: dialog.accept())
    docs = ["https://docs.example.test/", "https://docs.example.test/guide", "https://docs.example.test/api"]

    fresh(page, url)
    page.locator(".home-hub").first.click()
    page.locator(".detail-view").wait_for()
    page.evaluate(STUB)
    page.locator(".open-all-button").filter(has_text="Docs").click()
    all_active(page, "Open all (planet and moons, after the confirm question)", docs, mode)

    fresh(page, url)
    page.locator(".quick-open-all").click()
    all_active(page, "Open all favorites", [docs[0], docs[2]], mode)

    fresh(page, url)
    page.get_by_role("button", name="Open Morning").click()
    all_active(page, "a routine offer", docs[:2], mode)

    fresh(page, url)
    page.locator(".home-hub").first.click()
    page.locator(".detail-view").wait_for()
    page.evaluate(STUB)
    page.locator(".detail-satellite").filter(has_text="Ticket").click()
    page.get_by_label("ticket", exact=True).fill("OPS-7")
    page.get_by_role("button", name="Open", exact=True).click()
    all_active(page, "the placeholder form", ["https://jira.example.test/browse/OPS-7"], mode)

    fresh(page, url)
    page.locator(".home-hub").first.click()
    page.locator(".detail-view").wait_for()
    page.evaluate(STUB)
    page.locator('.detail-satellite[data-kind="planet"]').filter(has_text="Docs").click(modifiers=["Shift"])
    all_active(page, "Shift+click on a planet", docs, mode)


def team_settings(page):
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    text = page.locator(".team-settings:not(.workspace-settings)").first.inner_text()
    page.locator("#menu-close").click()
    return text


def serve_case(directory, team_path):
    handler = type("TeamCase", (serve.OrbitHandler,), {"team_path": team_path, "log_message": lambda *_: None})
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(handler, directory=str(directory)))
    Thread(target=server.serve_forever, daemon=True).start()
    return server


def team_checks(browser, root):
    good = root / "team.json"
    good.write_text(json.dumps(TEAM_FILE))
    broken = root / "broken.json"
    broken.write_text("{ not json")
    cases = [
        # (name, team-data.js present, team path, first sun, Settings text)
        ("team.json wins over team-data.js", True, good, "Ops from team.json", "1 team sun from team.json from serve.py --team"),
        ("a 404 falls back to team-data.js", True, None, "Ops from team-data.js", "1 team sun from team-data.js"),
        ("a 500 falls back to team-data.js", True, broken, "Ops from team-data.js", "1 team sun from team-data.js"),
        ("a 500 with no team-data.js is reported", False, broken, "Alpha", "The team map could not be loaded: HTTP 500"),
    ]
    for name, script, team_path, first, text in cases:
        directory = root / name.replace(" ", "-").replace(".", "")
        directory.mkdir()
        write_fixture(directory, DATA)
        if script:
            (directory / "team-data.js").write_text("window.ORBIT_TEAM_DATA = " + json.dumps(TEAM_SCRIPT) + ";\n")
        server = serve_case(directory, str(team_path) if team_path else None)
        context = browser.new_context(viewport=VIEW)
        page = context.new_page()
        try:
            fresh(page, f"http://localhost:{server.server_port}/index.html")
            hubs = page.locator(".hub-name").all_inner_texts()
            check(hubs[0] == first, f"server: {name}: first sun {hubs}")
            settings = team_settings(page)
            check(text in settings, f"server: {name}: Settings says {text!r} ({settings!r})")
            print(f"PASS team map: {name} (server)")
        finally:
            context.close()
            server.shutdown()


def empty_team_checks(browser, root):
    for mode in ("file", "server", "server fallback"):
        directory = root / ("team-empty-" + mode.replace(" ", "-"))
        directory.mkdir()
        write_fixture(directory, DATA)
        generated = mode != "server"
        source = directory / ("team-data.js" if generated else "team.json")

        def publish(data):
            text = json.dumps(data)
            source.write_text(f"window.ORBIT_TEAM_DATA = {text};\n" if generated else text)

        def reload(page):
            page.reload(wait_until="load")
            page.locator(".home-hub").first.wait_for()

        publish({"groups": []})
        server = None if mode == "file" else serve_case(directory, None if generated else str(source))
        url = (directory / "index.html").as_uri() if server is None else f"http://localhost:{server.server_port}/index.html"
        context = browser.new_context(viewport=VIEW)
        if mode == "server fallback":
            # The fixture republishes in under a second, below HTTP Last-Modified precision.
            context.route("**/team-data.js", lambda route: route.continue_())
        page = context.new_page()
        try:
            fresh(page, url)
            banner = page.locator("#team-updates")
            seen = lambda: page.evaluate("JSON.parse(localStorage.getItem('orbit:team-seen:v1'))")
            check(banner.count() == 0 and seen() == [], f"{mode}: an initial empty team map is recorded quietly")

            publish(TEAM_FILE)
            reload(page)
            check("1 new, 0 removed" in banner.inner_text(), f"{mode}: a published link is new")
            banner.get_by_role("button", name="Dismiss").click()
            previous = seen()
            source.unlink()
            reload(page)
            check(banner.count() == 0 and seen() == previous, f"{mode}: an unavailable source preserves the snapshot")

            publish({"groups": []})
            reload(page)
            check("0 new, 1 removed" in banner.inner_text(), f"{mode}: an empty team map reports the last removal")
            banner.get_by_role("button", name="Dismiss").click()
            reload(page)
            check(banner.count() == 0 and seen() == [], f"{mode}: dismissal records the empty snapshot")
            publish(TEAM_FILE)
            reload(page)
            check("1 new, 0 removed" in banner.inner_text(), f"{mode}: republishing the link reports it as new")
            print(f"PASS team map: empty and unavailable sources ({mode})")
        finally:
            context.close()
            if server is not None:
                server.shutdown()
                server.server_close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cdp", help="Connect to a running browser at this DevTools address (pop-up checks only)")
    parser.add_argument("--url", help="With --cdp: the Orbit page to test")
    parser.add_argument("--write-fixture", metavar="DIR", help="Only write the pop-up fixture into DIR and exit")
    args = parser.parse_args()
    if args.write_fixture:
        write_fixture(Path(args.write_fixture), DATA)
        return
    with sync_playwright() as playwright:
        if args.cdp:
            browser = playwright.chromium.connect_over_cdp(args.cdp)
            print(f"Browser: {browser.version}")
            page = browser.contexts[0].new_page()
            page.set_viewport_size(VIEW)
            try:
                popup_checks(page, args.url, "remote-server" if args.url.startswith("http") else "remote-file")
            finally:
                page.close()
            print("PASS services (pop-up checks)")
            return
        browser = playwright.chromium.launch(executable_path="/usr/bin/chromium", headless=True,
                                             args=["--no-sandbox", "--disable-dev-shm-usage"])
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = root / "popups"
            fixture.mkdir()
            write_fixture(fixture, DATA)
            server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(fixture)))
            Thread(target=server.serve_forever, daemon=True).start()
            try:
                for mode, url in (("file", (fixture / "index.html").as_uri()),
                                  ("server", f"http://localhost:{server.server_port}/index.html")):
                    context = browser.new_context(viewport=VIEW)
                    try:
                        popup_checks(context.new_page(), url, mode)
                    finally:
                        context.close()
                team_checks(browser, root)
                empty_team_checks(browser, root)
            finally:
                server.shutdown()
                browser.close()
    print("PASS services")


if __name__ == "__main__":
    main()
