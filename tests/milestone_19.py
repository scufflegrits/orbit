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
    print(f"PASS milestone 19 ({mode})")
