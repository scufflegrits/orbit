"""Check the group-planet downgrade hazard against the v3.0.2 tag."""

import functools
import json
import shutil
import subprocess
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

repo = Path(__file__).resolve().parents[2]
files = ("index.html", "links.json", "links-data.js", "orbit.js", "styles.css")
old = {name: subprocess.check_output(["git", "show", f"v3.0.2:{name}"], cwd=repo) for name in files}
group_map = {"groups": [{"id": "work", "name": "Downgrade fixture", "links": [
    {"name": "Monitoring", "type": "group", "moons": [{"name": "Status", "url": "https://example.test/"}]},
]}]}
text = json.dumps(group_map)
map_key = "orbit:map:v1"

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

def add_sun(page, name):
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    page.get_by_role("button", name="Edit links").click()
    page.get_by_role("button", name="Add sun", exact=True).click()
    page.get_by_label("Sun name").fill(name)
    page.get_by_role("button", name="Add sun", exact=True).click()

with tempfile.TemporaryDirectory(prefix="orbit-group-downgrade-") as root, sync_playwright() as playwright:
    root = Path(root)
    with ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(root))) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        browser = playwright.chromium.launch()
        for mode, url in (
            ("file", (root / "index.html").as_uri()),
            ("server", f"http://127.0.0.1:{server.server_port}/index.html"),
        ):
            context = browser.new_context(viewport={"width": 1920, "height": 1080})
            page = context.new_page()
            page.route("https://**", lambda route: route.abort())

            def load_new():
                for name in files:
                    shutil.copyfile(repo / name, root / name)
                page.goto(url, wait_until="load")
                page.locator(".home-hub").first.wait_for()

            load_new()
            page.evaluate("([key, value]) => localStorage.setItem(key, value)", [map_key, text])
            page.reload(wait_until="load")
            page.get_by_role("button", name="Open Downgrade fixture system", exact=False).wait_for()
            for name, data in old.items():
                (root / name).write_bytes(data)
            page.reload(wait_until="load")
            page.locator(".home-hub").first.wait_for()
            assert page.get_by_text("Downgrade fixture", exact=True).count() == 0
            assert page.evaluate("key => localStorage.getItem(key)", map_key) == text
            add_sun(page, "Old version save")
            previous = page.evaluate("key => JSON.parse(localStorage.getItem(key))", map_key)
            assert "Old version save" in [sun["name"] for sun in previous["groups"]]
            assert "Downgrade fixture" not in [sun["name"] for sun in previous["groups"]]
            # A future map the new version cannot read is preserved before its fallback is saved.
            load_new()
            unreadable = text.replace('"group"', '"future-kind"')
            page.evaluate("([key, value]) => localStorage.setItem(key, value)", [map_key, unreadable])
            page.reload(wait_until="load")
            page.locator(".home-hub").first.wait_for()
            add_sun(page, "New version save")
            assert page.evaluate("key => localStorage.getItem(key + ':unreadable')", map_key) == unreadable
            assert "New version save" in [sun["name"] for sun in
                page.evaluate("key => JSON.parse(localStorage.getItem(key))", map_key)["groups"]]
            context.close()
            print(f"PASS v3.0.2 downgrade and current backup guard ({mode})", flush=True)
        browser.close()
        server.shutdown()
