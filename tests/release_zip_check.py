"""Check an extracted release zip in a browser (docs/RELEASING.md, step 5).

    python tests/release_zip_check.py --version 3.0.1 --url file:///path/orbit-3.0.1/index.html
    python tests/release_zip_check.py --version 3.0.1 --url http://127.0.0.1:8000/index.html --cdp http://127.0.0.1:9333

The page loads with the bundled sample map (as many suns and links as its links-data.js holds), Edit mode switches on,
About shows the version, Inter loads from the zip's own fonts folder, there are no page errors, and the release defines no test hook.
scripts/edge/zip-check.sh runs it in Chromium here and in Edge on the test VM.
"""
import argparse

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--url", required=True, help="the extracted zip's index.html, as a file:// or http:// URL")
    parser.add_argument("--version", required=True, help="the version About should show")
    parser.add_argument("--cdp", help="drive a remote browser over the Chrome DevTools Protocol")
    args = parser.parse_args()
    with sync_playwright() as p:
        if args.cdp:
            browser = p.chromium.connect_over_cdp(args.cdp)
            context = browser.contexts[0] if browser.contexts else browser.new_context()
        else:
            browser = p.chromium.launch()
            context = browser.new_context()
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(args.url, wait_until="load")
        page.locator(".home-hub").first.wait_for()
        suns, links = page.evaluate("""() => [ORBIT_DATA.groups.length,
          ORBIT_DATA.groups.reduce((n, sun) => n + sun.links.reduce((m, planet) => m + Number(planet.type !== "group") + (planet.moons || []).length, 0), 0)]""")
        count = page.locator("#link-count").inner_text()
        assert page.locator(".home-hub").count() == suns and f"{suns} SUNS" in count and f"{links} LINKS" in count, count
        assert page.locator("#workspace-switch option").all_inner_texts() == ["Main", "Dev Toolbox"], "Dev Toolbox ships in the release"
        page.locator("#workspace-switch").select_option("dev-toolbox")
        assert page.locator(".home-hub").count() == 5 and "31 LINKS" in page.locator("#link-count").inner_text(), "Dev Toolbox map loads from the release"
        page.locator("#workspace-switch").select_option("main")
        # The zip's own fonts/ folder supplies Inter (a zip without it falls back silently).
        page.wait_for_function("document.fonts.status === 'loaded'")
        inter = page.evaluate("""() => ({ loaded: [...document.fonts].some(face => face.family.replace(/["']/g, '') === 'Inter' && face.status === 'loaded'),
          family: getComputedStyle(document.querySelector('.hub-name')).fontFamily })""")
        assert inter["loaded"] and inter["family"].startswith("Inter"), f"Inter loads from the zip's fonts folder: {inter}"
        page.locator("#edit-toggle").click()
        assert page.locator("#edit-toggle").get_attribute("aria-pressed") == "true", "Edit mode switches on"
        page.locator("#edit-done").click()
        page.locator("#settings-trigger").click()
        page.locator('[data-menu-panel="About"]').click()
        about = page.locator("#menu-content").inner_text()
        assert args.version in about, f"About shows {args.version}: {about}"
        assert page.evaluate("typeof window.OrbitTest") == "undefined", "the release has no test hook"
        assert not errors, errors
        print(f"PASS release zip: {suns} suns, {links} links, Inter, Edit mode, About shows {args.version}, no test hook ({args.url})")
        page.close()
        if not args.cdp:
            browser.close()


if __name__ == "__main__":
    main()
