"""Shared constants, fixtures, and page helpers for Orbit's browser checks."""

import ast
import hashlib
import json
import shutil
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Screenshots and other test output, inside the checkout running the tests (git-ignored),
# so separate checkouts and worktrees never overwrite each other's files.
ARTIFACTS = ROOT / ".artifacts"
# Classic scripts loaded by index.html besides the data files. None since rewrite phase 8: the app is
# the bundle. Kept so a future split file can be added here.
APP_SCRIPTS = ()
# The bundle built from src/ (build.mjs). Fixtures get the test bundle under this name, so index.html
# is the same file in tests and in release; the committed release bundle is checked by
# `npm run check:bundle` and tests/release_smoke.py instead.
BUNDLE = "orbit.js"
TEST_BUNDLE = ROOT / "orbit.test.js"
_test_bundle_built = False


def build_inputs_fingerprint():
    """SHA-256 of every build input, computed exactly as build.mjs fingerprint() does."""
    files = sorted({str(path.relative_to(ROOT).as_posix()) for path in (ROOT / "src").rglob("*") if path.is_file()}
                   | {"build.mjs", "package.json", "package-lock.json"})
    digest = hashlib.sha256()
    for name in files:
        digest.update(name.encode() + b"\0" + (ROOT / name).read_bytes() + b"\0")
    esbuild_version = json.loads((ROOT / "node_modules" / "esbuild" / "package.json").read_text())["version"]
    digest.update(f"esbuild@{esbuild_version}".encode())
    return digest.hexdigest()


def test_bundle():
    """Build the test bundle once per run, then refuse it unless its fingerprint matches the current inputs."""
    global _test_bundle_built
    if not _test_bundle_built:
        subprocess.run(["node", "build.mjs", "--test"], cwd=ROOT, check=True, capture_output=True)
        _test_bundle_built = True
    first_line = TEST_BUNDLE.read_text().split("\n", 1)[0] if TEST_BUNDLE.exists() else ""
    expected = f"/* orbit-build-inputs: {build_inputs_fingerprint()} */"
    if first_line != expected:
        raise RuntimeError("orbit.test.js is missing or was built from different inputs; run `npm run build:test`")
    return TEST_BUNDLE


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
    for name in (*APP_SCRIPTS, BUNDLE, "links-data.js"):
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


def write_fixture(directory, data):
    fixture = Path(directory)
    for name in ("index.html", "styles.css", *APP_SCRIPTS):
        shutil.copy2(ROOT / name, fixture / name)
    shutil.copy2(test_bundle(), fixture / BUNDLE)
    (fixture / "links.json").write_text(json.dumps(data))
    (fixture / "links-data.js").write_text("window.ORBIT_DATA = " + json.dumps(data) + ";\n")
    return fixture


def click_logo_to_galaxy(page):
    """Click the Orbit logo and wait for the Galaxy to render.

    Leaving a System changes the hash, so the render and the menu close happen
    in a later hashchange event. Waiting avoids reading or opening the editor
    before that event runs.
    """
    page.locator(".brand").click()
    page.locator(".detail-view").wait_for(state="detached")
    page.locator(".home-hub").first.wait_for()


def open_editor(page):
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    page.get_by_role("button", name="Edit links").click()
    page.locator(".editor-list-row").first.wait_for()


def submit_editor_form(page):
    page.locator(".editor-form button[type='submit']").click()


def upload_json(page, button, data):
    content = data if isinstance(data, bytes) else json.dumps(data).encode()
    with page.expect_file_chooser() as chooser_info:
        page.get_by_role("button", name=button, exact=True).click()
    chooser_info.value.set_files({"name": "shared.json", "mimeType": "application/json",
                                  "buffer": content})


def download_json(page, button):
    with page.expect_download() as download_info:
        page.get_by_role("button", name=button, exact=True).click()
    return json.loads(Path(download_info.value.path()).read_text())


def upload_rdp(page, content, name="profile.rdp"):
    if isinstance(content, str):
        content = content.encode()
    with page.expect_file_chooser() as chooser_info:
        page.get_by_role("button", name="Import .rdp file", exact=True).click()
    chooser_info.value.set_files({"name": name, "mimeType": "application/x-rdp", "buffer": content})


def profile_rows(text):
    return [line for line in text.replace("\r\n", "\n").split("\n") if line]


def saved_map(page):
    return page.evaluate("localStorage.getItem('orbit:map:v1')")
