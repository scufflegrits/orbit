"""Drive the installed Edge in the disposable VM's visible desktop session."""
import argparse

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("phase", choices=["blocked", "inspect-settings", "allowed"])
args = parser.parse_args()

target = "http://127.0.0.1:8779"
expected = {f"{target}/two.html", f"{target}/three.html"}

with sync_playwright() as playwright:
    browser = playwright.chromium.connect_over_cdp("http://127.0.0.1:9334")
    orbit = next(page for context in browser.contexts for page in context.pages
                 if page.url.startswith("file:///C:/orbit-visible-test/index.html"))
    context = orbit.context
    if args.phase == "inspect-settings":
        settings = next((page for page in context.pages if page.url.startswith("edge://settings")), None)
        if settings is None:
            settings = context.new_page()
        settings.goto("edge://settings/content/popups", wait_until="domcontentloaded")
        settings.wait_for_timeout(1200)
        print(settings.get_by_text("Blocked (recommended)", exact=True).evaluate("el => el.parentElement.parentElement.parentElement.outerHTML")[:7500], flush=True)
    else:
        if args.phase == "blocked":
            orbit.evaluate("""([target]) => {
                const map = { groups: [{ id: 'lab', name: 'Lab', links: [
                    { name: 'Docs', type: 'group', moons: [
                        { name: 'Guide', url: target + '/two.html' },
                        { name: 'API', url: target + '/three.html' },
                    ] },
                ] }] };
                localStorage.setItem('orbit:map:v1', JSON.stringify(map));
            }""", [target])
            orbit.reload(wait_until="load")
            if not orbit.url.endswith("#group/lab"):
                orbit.get_by_role("button", name="Open Lab system", exact=False).click()
        orbit.bring_to_front()
        orbit.locator(".detail-satellite.group-planet").wait_for()
        baseline = set(context.pages)
        questions = []

        def confirm(dialog):
            questions.append(dialog.message)
            dialog.accept()

        orbit.on("dialog", confirm)
        orbit.locator(".detail-satellite.group-planet").click(modifiers=["Shift"])
        orbit.locator("#open-all-notice:not([hidden])").wait_for()
        orbit.wait_for_timeout(900)
        new_tabs = set(context.pages) - baseline
        urls = {tab.url for tab in new_tabs}
        notice = orbit.locator("#open-all-notice").inner_text()
        assert questions == ["Open 2 tabs for Docs?"], questions
        if args.phase == "blocked":
            assert len(new_tabs) == 1 and urls < expected and "blocked 1 tab" in notice, (urls, notice)
        else:
            assert len(new_tabs) == 2 and urls == expected and notice == "Opened 2 tabs for Docs.", (urls, notice)
        for tab in new_tabs:
            tab.close()
        print(f"PASS visible Edge ({args.phase}): {len(new_tabs)} tabs, {notice}")
