"""Generate editor and map control screenshots from the synthetic features map."""

from tempfile import TemporaryDirectory

from playwright.sync_api import sync_playwright

from features import make_map, open_editor, tree, write_data
from helpers import ARTIFACTS, write_fixture


def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    target = "https://example.test"
    with TemporaryDirectory(prefix="editor-preview-", dir=ARTIFACTS) as directory, sync_playwright() as playwright:
        fixture = write_fixture(directory, make_map(target))
        write_data(fixture, target)
        browser = playwright.chromium.launch(
            executable_path="/usr/bin/chromium",
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        try:
            page = browser.new_page(viewport={"width": 1440, "height": 920})
            page.goto((fixture / "index.html").as_uri(), wait_until="load")
            sun = page.locator(".home-hub").filter(has_text="Alpha")
            card = page.locator(".group-card").filter(has=sun)
            sun.hover()
            page.get_by_role("button", name="Remove Alpha", exact=True).wait_for()
            card.screenshot(path=ARTIFACTS / "orbit-map-removal.png", animations="disabled")
            page.get_by_role("button", name="Edit Alpha", exact=True).hover()
            page.get_by_role("tooltip").filter(has_text="Edit Alpha").wait_for()
            card.screenshot(path=ARTIFACTS / "orbit-map-edit-pencil.png")

            open_editor(page)
            page.mouse.move(0, 0)
            page.screenshot(path=ARTIFACTS / "orbit-edit-links.png")
            page.locator(".editor-pane .editor-list").first.screenshot(
                path=ARTIFACTS / "orbit-sun-row-actions.png"
            )

            tree(page, "editor-tree-planet", "Docs Portal").click()
            page.locator(".editor-header").get_by_role("button", name="Move planet", exact=True).click()
            page.screenshot(path=ARTIFACTS / "orbit-item-toolbar.png")
        finally:
            browser.close()
    print(f"Saved editor previews to {ARTIFACTS}")


if __name__ == "__main__":
    main()
