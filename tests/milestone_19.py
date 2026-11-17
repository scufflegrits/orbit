"""Browser checks for milestone 19: keyboard navigation."""

from helpers import ARTIFACTS, check


def focus_state(page):
    """Describe the focused element without reading any private values."""
    return page.evaluate("""() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        let node = el, visible = true;
        while (node && node !== document.body) {
            if (getComputedStyle(node).visibility === 'hidden') visible = false;
            node = node.parentElement;
        }
        return {
            cls: el.className, tag: el.tagName, text: (el.textContent || '').trim().slice(0, 40),
            outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0,
            visible: visible && box.width > 0 && box.height > 0,
        };
    }""")


def tab_until(page, class_name, limit):
    """Press Tab until the focused element has class_name; return the classes visited."""
    visited = []
    for _ in range(limit):
        page.keyboard.press("Tab")
        state = focus_state(page)
        visited.append(state["cls"].split()[0] if state else "none")
        if state and class_name in state["cls"]:
            return visited
    return visited


def reset_map(page, url):
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:map:v1')")
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()


def run_milestone_19(page, url, mode):
    reset_map(page, url)

    # Step 1: Tab from a sun reveals its planets, then each planet's moons, with a focus ring.
    page.locator(".home-hub").first.focus()
    check(focus_state(page)["outline"], f"{mode}: focused sun shows a focus ring")
    classes = tab_until(page, "moon-link", 12)
    check(classes[0:2] == ["home-hub", "home-satellite"] or "home-satellite" in classes,
          f"{mode}: Tab from a sun reaches its planets before any moon")
    state = focus_state(page)
    check(state and "moon-link" in state["cls"] and state["visible"],
          f"{mode}: Tab through a Galaxy planet reaches its visible moon")
    check(state["outline"], f"{mode}: focused Galaxy moon shows a focus ring")
    page.wait_for_timeout(1200)  # let reveal animations finish before the screenshot
    page.screenshot(path=str(ARTIFACTS / f"milestone19-galaxy-focus-{mode}.png"))

    page.locator(".home-hub").first.focus()
    page.keyboard.press("Enter")
    page.locator(".detail-view").wait_for()
    page.locator(".detail-satellite").first.focus()
    check(focus_state(page)["outline"], f"{mode}: focused System planet shows a focus ring")
    tab_until(page, "moon-link", 12)
    state = focus_state(page)
    check(state and "moon-link" in state["cls"] and state["visible"],
          f"{mode}: Tab through a System planet reaches its visible moon")
    check(state["outline"], f"{mode}: focused System moon shows a focus ring")
    page.wait_for_timeout(1200)
    page.screenshot(path=str(ARTIFACTS / f"milestone19-system-focus-{mode}.png"))

    check_menu_keys(page, url, mode)
    print(f"PASS milestone 19 ({mode})")


def in_menu(page):
    return page.evaluate("!!document.activeElement.closest('.menu-sheet')")


def active_id(page):
    return page.evaluate("document.activeElement.id")


def check_menu_keys(page, url, mode):
    """Step 2: menu focus, Tab trap, and Escape layers."""
    reset_map(page, url)
    page.locator("#settings-trigger").focus()
    page.keyboard.press("Enter")
    page.locator("#menu-overlay").wait_for(state="visible")
    check(in_menu(page), f"{mode}: opening the menu moves focus into it")
    page.keyboard.press("Enter")  # first option is Settings
    page.locator("#menu-content select").first.wait_for()
    for direction, key in (("forward", "Tab"), ("backward", "Shift+Tab")):
        stayed = True
        for _ in range(30):
            page.keyboard.press(key)
            stayed = stayed and in_menu(page)
        check(stayed, f"{mode}: {direction} Tab never leaves the open menu")
    page.keyboard.press("Escape")
    check(page.locator("#menu-overlay").is_hidden(), f"{mode}: Escape closes the menu")
    check(active_id(page) == "settings-trigger", f"{mode}: closing the menu returns focus to the cog")

    # Escape order inside a System: menu, then Quick find, then back to the Galaxy.
    page.locator(".home-hub").first.focus()
    page.keyboard.press("Enter")
    page.locator(".detail-view").wait_for()
    page.locator("#settings-trigger").focus()
    page.keyboard.press("Enter")
    page.keyboard.press("Escape")
    check(page.locator(".detail-view").count() == 1 and page.locator("#menu-overlay").is_hidden(),
          f"{mode}: Escape with the menu open closes only the menu")
    page.keyboard.press("Escape")
    page.locator(".detail-view").wait_for(state="detached")
    page.locator(".home-hub").first.wait_for()
    check(page.locator(".home-hub").count() == 9, f"{mode}: Escape in a System returns to the Galaxy")

    page.locator("#quick-find").fill("Engadget")
    check(page.locator(".find-item").count() > 0, f"{mode}: Quick find shows results")
    page.keyboard.press("Escape")
    check(page.locator("#quick-find").input_value() == "" and page.locator(".home-hub").count() == 9,
          f"{mode}: Escape clears Quick find and restores the Galaxy")
