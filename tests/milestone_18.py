"""Browser checks for milestone 18: imported Remote Desktop profiles."""

from pathlib import Path
from helpers import ROOT, check, download_json, open_editor, profile_rows, saved_map, submit_editor_form, upload_rdp


def open_lab1_server3(page):
    open_editor(page)
    page.locator(".editor-list-row").filter(has_text="Labs").get_by_role("button", name="Edit").click()
    page.locator(".editor-list-row").filter(has_text="lab1").get_by_role("button", name="Edit").click()
    page.locator(".editor-list-row").filter(has_text="lab1-server3").get_by_role("button", name="Edit").click()


def run_milestone_18(page, url, mode):
    fixture = ROOT / "tests" / "rdptest01.rdp"
    check(fixture.exists(), f"{mode}: user fixture tests/rdptest01.rdp is present")
    raw = fixture.read_bytes()
    check(raw[:2] == b"\xff\xfe", f"{mode}: fixture is UTF-16 little-endian")
    expected = profile_rows(raw.decode("utf-16"))
    address = [row for row in expected if row.lower().startswith("full address:s:")]
    check(len(address) == 1, f"{mode}: fixture has one full address")
    fixture_host = address[0].split(":", 2)[2]
    others = [row for row in expected if row not in address]
    secret = ("password", "passwd", "token", "secret", "signature", "signscope")

    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:map:v1')")
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    open_lab1_server3(page)
    upload_rdp(page, raw, "rdptest01.rdp")
    page.locator(".data-source").filter(has_text="connection settings imported").wait_for()
    check(page.get_by_label("Computer name or IP address").input_value() == fixture_host,
          f"{mode}: UTF-16 import fills the host from the profile")
    submit_editor_form(page)
    moon = page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups"
                         ".find(g => g.id === 'labs').links[0].moons[2]")
    saved_rows = profile_rows(moon["rdpProfile"])
    check(moon["name"] == "lab1-server3" and moon["host"] == fixture_host,
          f"{mode}: imported moon keeps its name and takes the profile host")
    check(sorted(saved_rows) == sorted(others + address),
          f"{mode}: saved profile keeps every non-secret setting")
    check(not any(word in row.split(":")[0].lower() for row in saved_rows for word in secret),
          f"{mode}: saved profile has no secret settings")
    page.locator("#menu-close").click()
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    reloaded = page.evaluate("groups.find(g => g.id === 'labs').links[0].moons[2]")
    check(reloaded == moon, f"{mode}: imported profile persists after reload")

    page.get_by_role("searchbox", name="Quick find").fill("lab1-server3")
    with page.expect_download() as download_info:
        page.locator(".find-item").click()
    downloaded = profile_rows(Path(download_info.value.path()).read_text())
    check(sorted(downloaded) == sorted(saved_rows),
          f"{mode}: downloaded .rdp keeps the imported settings")
    page.get_by_role("searchbox", name="Quick find").fill("")

    open_lab1_server3(page)
    exported = download_json(page, "Export moon")
    check(exported["kind"] == "moon" and exported["item"].get("rdpProfile") == moon["rdpProfile"],
          f"{mode}: moon export includes rdpProfile")
    page.get_by_label("Computer name or IP address").fill("edited-host:3390")
    submit_editor_form(page)
    edited = page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups"
                           ".find(g => g.id === 'labs').links[0].moons[2]")
    edited_rows = profile_rows(edited["rdpProfile"])
    check(edited["host"] == "edited-host:3390" and
          edited_rows.count("full address:s:edited-host:3390") == 1 and
          len(edited_rows) == len(saved_rows),
          f"{mode}: host edit updates the saved full address only")
    page.locator("#menu-close").click()
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    page.get_by_role("searchbox", name="Quick find").fill("lab1-server3")
    with page.expect_download() as download_info:
        page.locator(".find-item").click()
    check("full address:s:edited-host:3390" in profile_rows(Path(download_info.value.path()).read_text()),
          f"{mode}: downloaded .rdp follows the edited host")
    page.get_by_role("searchbox", name="Quick find").fill("")

    # Negative cases use in-memory files; the map must not change.
    open_lab1_server3(page)
    before = saved_map(page)
    base = "full address:s:synthetic-host\r\n"
    cases = {
        "bad line": ("not a setting\r\n" + base, "invalid setting line"),
        "no address": ("screen mode id:i:2\r\n", "needs a full address"),
        "two addresses": (base + base, "more than one computer address"),
        "bad host": ("full address:s:bad;host\r\n", "computer name or IP address"),
        "nul byte": (base + "\0", "not valid text"),
        "oversized import": (base + "x" * 64001, "too large to import"),
        "too large to launch": (base + "".join(f"setting{i}:i:1\r\n" for i in range(1500)),
                                "too large to launch"),
        "invalid utf-8": (b"\xff\xfe\xfa" + base.encode(), "RDP import failed"),
    }
    for label, (content, message) in cases.items():
        upload_rdp(page, content)
        page.locator(".editor-error").filter(has_text=message).wait_for()
        check(saved_map(page) == before, f"{mode}: {label} leaves the saved map unchanged")
    check(page.get_by_label("Computer name or IP address").input_value() == "edited-host:3390",
          f"{mode}: failed imports leave the form host unchanged")

    synthetic = (base + "screen mode id:i:2\r\npassword 51:b:AAAA\r\n"
                 "GatewayAccessToken:s:abc\r\nsignature:s:def\r\nsignscope:s:Full Address\r\n"
                 "ClientSecret:s:ghi\r\n")
    upload_rdp(page, synthetic)
    page.locator(".data-source").filter(has_text="5 password, token, or signature").wait_for()
    submit_editor_form(page)
    stripped = page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups"
                             ".find(g => g.id === 'labs').links[0].moons[2]")
    check(profile_rows(stripped["rdpProfile"]) ==
          ["full address:s:synthetic-host", "screen mode id:i:2"] and
          stripped["host"] == "synthetic-host",
          f"{mode}: password, token, secret and signature settings are excluded")
    print(f"PASS milestone 18 ({mode})")
