"""Browser checks for bundled default workspaces (F42)."""
import json
import argparse
import tempfile
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

from helpers import ARTIFACTS, ROOT, QuietHandler, check, write_fixture


def run_mode(page, mode, url, legacy):
    page.on("dialog", lambda dialog: dialog.accept())
    try:
        page.goto(url, wait_until="load")
        page.evaluate("(map) => { localStorage.clear(); localStorage.setItem('orbit:map:v1', JSON.stringify(map)); }", legacy)
        page.reload(wait_until="load")
        page.locator(".home-hub").first.wait_for()
        if not mode.startswith("Edge"):
            ARTIFACTS.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(ARTIFACTS / f"f42-{mode}-notice.png"), full_page=True)
        check(page.locator(".home-hub").count() == 10, f"{mode}: migrated Main initially retains old sun")
        check(page.locator("#dev-toolbox-moved-notice").inner_text().startswith("Dev Toolbox now has its own workspace"),
              f"{mode}: one-time migration notice appears")
        initial_keys = page.evaluate("Object.keys(localStorage).filter(k => k.startsWith('orbit:')).sort()")
        check(initial_keys == ["orbit:map:v1"], f"{mode}: startup and displaying defaults writes no new browser data")
        if not mode.startswith("Edge"):
            page.screenshot(path=str(ARTIFACTS / f"f42-{mode}-workspace-switch.png"), full_page=True)
            page.set_viewport_size({"width": 390, "height": 844})
            page.screenshot(path=str(ARTIFACTS / f"f42-{mode}-phone.png"), full_page=True)
            page.set_viewport_size({"width": 1280, "height": 900})
        page.get_by_role("button", name="Remove", exact=True).click()
        check(page.locator(".home-hub").count() == 9, f"{mode}: notice removes old sun through save path")
        check(page.evaluate("OrbitTest.undoRecord()?.item.id") == "dev-toolbox", f"{mode}: notice removal can be undone")
        check(page.evaluate("OrbitTest.history()[0]?.label") == "Removed Dev Toolbox sun from Main",
              f"{mode}: notice removal appears in history")
        check(page.evaluate("localStorage.getItem('orbit:notice:dev-toolbox-moved')") == "remove",
              f"{mode}: migration answer is remembered")

        before = page.evaluate("Object.keys(localStorage).filter(k => k.startsWith('orbit:')).sort()")
        switch = page.locator("#workspace-switch")
        check(switch.locator("option").all_inner_texts() == ["Main", "Dev Toolbox"], f"{mode}: default appears in workspace switch")
        switch.select_option("dev-toolbox")
        check(page.locator(".home-hub").count() == 5, f"{mode}: Dev Toolbox has five suns")
        check("29 LINKS" in page.locator("#link-count").inner_text(), f"{mode}: Dev Toolbox has 29 destinations")
        if not mode.startswith("Edge"):
            page.screenshot(path=str(ARTIFACTS / f"f42-{mode}-dev-toolbox.png"), full_page=True)
        keys = page.evaluate("Object.keys(localStorage).filter(k => k.startsWith('orbit:')).sort()")
        check(keys == sorted([*before, "orbit:workspace"]), f"{mode}: switching writes only active workspace")

        # A user edit creates a workspace map; Reset follows the bundled file and removes that copy.
        page.evaluate("""() => { const groups = OrbitTest.groups(); groups.push({id:'extra',name:'Extra',description:'',color:'#79d9f8',links:[]}); OrbitTest.saveMap(groups,{label:'Added extra'}); }""")
        check(page.evaluate("localStorage.getItem('orbit:map:v1:dev-toolbox') !== null"), f"{mode}: edit is saved per workspace")
        page.reload(wait_until="load")
        page.locator(".home-hub").first.wait_for()
        check(page.locator(".home-hub").count() == 6, f"{mode}: edits survive reload")
        page.locator("#settings-trigger").click()
        page.get_by_role("button", name="Settings", exact=True).click()
        if not mode.startswith("Edge"):
            page.screenshot(path=str(ARTIFACTS / f"f42-{mode}-workspace-settings.png"), full_page=True)
        page.get_by_role("button", name="Edit links", exact=True).click()
        page.get_by_role("button", name="Reset to file data").click()
        check(page.locator(".home-hub").count() == 5, f"{mode}: reset returns to file map")
        check(page.evaluate("localStorage.getItem('orbit:map:v1:dev-toolbox')") is None,
              f"{mode}: default reset deletes the saved copy")
        page.locator("#menu-close").click()
        page.locator("#settings-trigger").click()
        page.get_by_role("button", name="Settings", exact=True).click()
        page.locator(".workspace-row").filter(has_text="Dev Toolbox").get_by_role("button", name="Remove").click()
        check(page.evaluate("JSON.parse(localStorage.getItem('orbit:workspaces:removed:v1')).includes('dev-toolbox')"),
              f"{mode}: removed default stays removed")
        page.get_by_label("New workspace name", exact=True).fill("ignored")
        page.get_by_label("Start the new workspace with").select_option("default:dev-toolbox")
        if not mode.startswith("Edge"):
            page.screenshot(path=str(ARTIFACTS / f"f42-{mode}-restore-choice.png"), full_page=True)
        name = page.get_by_label("New workspace name", exact=True)
        check(name.input_value() == "Dev Toolbox" and name.get_attribute("readonly") is not None,
              f"{mode}: restore selects the reserved name read-only")
        page.get_by_role("button", name="Add workspace").click()
        check(page.locator(".home-hub").count() == 5 and page.locator("#workspace-switch").input_value() == "dev-toolbox",
              f"{mode}: restore reopens the default map")
        check(page.evaluate("localStorage.getItem('orbit:map:v1:dev-toolbox')") is None,
              f"{mode}: restore does not create a saved map")
        check(page.evaluate("JSON.parse(localStorage.getItem('orbit:workspaces:v1') || '[]').every(x => x.id !== 'dev-toolbox')"),
              f"{mode}: showing/restoring defaults does not store defaults")
        print(f"PASS F42 defaults ({mode})")
    finally:
        page.close()


def run_upgrade(context, mode, url, workspace):
    page = context.new_page()
    try:
        page.goto(url, wait_until="load")
        old = {
            "orbit:map:v1": json.dumps({"groups": [{"id": "saved-main", "name": "Saved Main", "color": "#79d9f8", "links": []}]}),
            "orbit:workspaces:v1": json.dumps([{"id": "work", "name": "Work"}]),
            "orbit:map:v1:work": json.dumps({"groups": [{"id": "saved-work", "name": "Saved Work", "color": "#79d9f8", "links": []}]}),
            "orbit:workspace": "work",
            "orbit:theme": "aurora",
            "orbit:font-family": "classic",
            "orbit:recent:v1": "[]",
        }
        page.evaluate("(values) => { localStorage.clear(); for (const [k,v] of Object.entries(values)) localStorage.setItem(k,v); }", old)
        page.reload(wait_until="load")
        page.locator(".home-hub").first.wait_for()
        after = page.evaluate("Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('orbit:')).map(k => [k,localStorage.getItem(k)]))")
        check(after == old, f"{mode}: 3.0.3 storage is unchanged at startup")
        check(page.locator("#workspace-switch option").all_inner_texts() == ["Main", "Work", "Dev Toolbox"],
              f"{mode}: the default appears without being stored")
        check(page.evaluate("OrbitTest.groups()[0].id") == "saved-work", f"{mode}: saved active workspace stays active")
        page.locator("#workspace-switch").select_option("dev-toolbox")
        check(page.evaluate("OrbitTest.groups()[0].id") == workspace["groups"][0]["id"], f"{mode}: default map opens after upgrade")
        expected = {**old, "orbit:workspace": "dev-toolbox"}
        after_switch = page.evaluate("Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('orbit:')).map(k => [k,localStorage.getItem(k)]))")
        check(after_switch == expected, f"{mode}: switching changes only active workspace")
        print(f"PASS F42 3.0.3 upgrade ({mode})")
    finally:
        page.close()


def run_notice_variants(context, mode, url, legacy):
    page = context.new_page()
    try:
        page.goto(url, wait_until="load")
        page.evaluate("(map) => { localStorage.clear(); localStorage.setItem('orbit:map:v1', JSON.stringify(map)); }", legacy)
        page.reload(wait_until="load")
        page.locator("#dev-toolbox-moved-notice").wait_for()
        page.get_by_role("button", name="Keep", exact=True).click()
        check(page.evaluate("localStorage.getItem('orbit:notice:dev-toolbox-moved')") == "keep", f"{mode}: Keep is saved")
        page.reload(wait_until="load")
        check(page.locator("#dev-toolbox-moved-notice").count() == 0, f"{mode}: notice stays dismissed")
        page.evaluate("localStorage.clear()")
        page.reload(wait_until="load")
        check(page.locator("#dev-toolbox-moved-notice").count() == 0, f"{mode}: no notice without a saved old Main map")
        print(f"PASS F42 migration notice ({mode})")
    finally:
        page.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-fixture", metavar="DIR")
    parser.add_argument("--cdp")
    parser.add_argument("--url")
    parser.add_argument("--server-mode", action="store_true")
    args = parser.parse_args()
    main_map = json.loads((ROOT / "links.json").read_text())
    workspace = json.loads((ROOT / "workspaces/dev-toolbox.json").read_text())
    workspace["id"] = "dev-toolbox"
    # The notice fixture models a pre-update Main with the moved sun still saved.
    toolbox = {"id": "dev-toolbox", "name": "Dev Toolbox", "description": "Old copy", "color": "#ffb3a1", "links": []}
    legacy = {"groups": [*main_map["groups"], toolbox]}
    if args.write_fixture:
        write_fixture(args.write_fixture, legacy, [workspace])
        return
    if args.cdp:
        if not args.url:
            parser.error("--cdp requires --url")
        with sync_playwright() as playwright:
            browser = playwright.chromium.connect_over_cdp(args.cdp)
            context = browser.contexts[0]
            page = context.new_page()
            mode = "Edge server" if args.server_mode else "Edge file"
            run_mode(page, mode, args.url, legacy)
            page.close()
            run_upgrade(context, mode, args.url, workspace)
            run_notice_variants(context, mode, args.url, legacy)
        return
    with tempfile.TemporaryDirectory(prefix="orbit-default-workspace-") as temp:
        fixture = write_fixture(temp, legacy, [workspace])
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(fixture)))
        Thread(target=server.serve_forever, daemon=True).start()
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path="/usr/bin/chromium", headless=True,
                                                 args=["--no-sandbox", "--disable-dev-shm-usage"])
            try:
                context = browser.new_context(viewport={"width": 1280, "height": 900})
                run_mode(context.new_page(), "file", (fixture / "index.html").as_uri(), legacy)
                run_upgrade(context, "file", (fixture / "index.html").as_uri(), workspace)
                run_notice_variants(context, "file", (fixture / "index.html").as_uri(), legacy)
                context.close()
                # Server JSON takes precedence over generated embedded data.
                changed = json.loads(json.dumps({"name": "Dev Toolbox", "groups": workspace["groups"][:1]}))
                changed["groups"][0]["name"] = "Changed from JSON"
                (fixture / "workspaces/dev-toolbox.json").write_text(json.dumps(changed))
                context = browser.new_context()
                page = context.new_page()
                page.goto(f"http://127.0.0.1:{server.server_port}/index.html", wait_until="load")
                page.locator(".home-hub").first.wait_for()
                page.locator("#workspace-switch").select_option("dev-toolbox")
                check(page.evaluate("OrbitTest.groups()[0].name") == "Changed from JSON", "server: current JSON overrides generated fallback")
                page.close()
                context.close()
                (fixture / "workspaces/dev-toolbox.json").write_text(json.dumps(workspace))
                context = browser.new_context(viewport={"width": 1280, "height": 900})
                run_mode(context.new_page(), "server", f"http://127.0.0.1:{server.server_port}/index.html", legacy)
                run_upgrade(context, "server", f"http://127.0.0.1:{server.server_port}/index.html", workspace)
                run_notice_variants(context, "server", f"http://127.0.0.1:{server.server_port}/index.html", legacy)
                context.close()
            finally:
                browser.close()
                server.shutdown()


if __name__ == "__main__":
    main()
