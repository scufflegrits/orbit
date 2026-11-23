"""Browser checks for milestone 19: keyboard navigation."""

import re

from helpers import SAMPLE_SUNS, ARTIFACTS, check


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
    check_find_keys(page, url, mode)
    check_map_arrows(page, url, mode)
    check_help_and_journey(page, url, mode)
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
    check(page.locator(".home-hub").count() == SAMPLE_SUNS, f"{mode}: Escape in a System returns to the Galaxy")

    page.locator("#quick-find").fill("Engadget")
    check(page.locator(".find-item").count() > 0, f"{mode}: Quick find shows results")
    page.keyboard.press("Escape")
    check(page.locator("#quick-find").input_value() == "" and page.locator(".home-hub").count() == SAMPLE_SUNS,
          f"{mode}: Escape clears Quick find and restores the Galaxy")


def check_find_keys(page, url, mode):
    """Step 3: "/" and arrow keys in Quick find."""
    reset_map(page, url)
    page.locator(".home-hub").first.focus()
    page.keyboard.press("/")
    check(active_id(page) == "quick-find", f"{mode}: / focuses Quick find")
    page.keyboard.type("a/b")
    check(page.locator("#quick-find").input_value() == "a/b",
          f"{mode}: / is typed normally while Quick find has focus")
    page.locator("#quick-find").fill("")
    page.locator("#quick-find").blur()

    page.locator("#settings-trigger").focus()
    page.keyboard.press("Enter")
    page.keyboard.press("/")
    check(in_menu(page) and page.locator("#quick-find").input_value() == "",
          f"{mode}: / is ignored while the menu is open")
    page.keyboard.press("Escape")

    page.keyboard.press("/")
    page.keyboard.type("e")
    page.locator(".find-item").first.wait_for()
    check(page.locator(".find-item").count() >= 3, f"{mode}: the query has several results")
    page.keyboard.press("ArrowDown")
    first = page.evaluate("document.activeElement.className")
    check("find-item" in first and page.evaluate(
        "document.activeElement === document.querySelector('.find-item')"),
        f"{mode}: Down Arrow moves from Quick find to the first result")
    page.keyboard.press("ArrowDown")
    check(page.evaluate("document.activeElement === document.querySelectorAll('.find-item')[1]"),
          f"{mode}: Down Arrow moves to the next result")
    page.keyboard.press("ArrowUp")
    page.keyboard.press("ArrowUp")
    check(active_id(page) == "quick-find", f"{mode}: Up Arrow from the first result returns to Quick find")
    page.keyboard.press("ArrowDown")
    page.keyboard.press("Escape")
    check(active_id(page) == "quick-find" and page.locator("#quick-find").input_value() == "",
          f"{mode}: Escape from a result clears the query and keeps focus in Quick find")

    page.keyboard.type("Tech")
    page.locator(".find-item").first.wait_for()
    page.keyboard.press("ArrowDown")
    check("Sun" in page.evaluate("document.activeElement.textContent"),
          f"{mode}: the Tech sun is the first result")
    page.keyboard.press("Enter")
    page.locator(".detail-view").wait_for()
    check("Tech" in page.locator(".detail-heading h1").inner_text(),
          f"{mode}: Enter on a sun result opens its System")


def active_is(page, selector, index):
    return page.evaluate(
        "([selector, index]) => document.activeElement === document.querySelectorAll(selector)[index]",
        [selector, index])


def check_map_arrows(page, url, mode):
    """Step 4: arrow keys between suns, planets, and moons."""
    reset_map(page, url)
    page.locator(".home-hub").first.focus()
    page.keyboard.press("ArrowRight")
    check(active_is(page, ".home-hub", 1), f"{mode}: Right Arrow moves to the next sun")
    page.keyboard.press("ArrowLeft")
    check(active_is(page, ".home-hub", 0), f"{mode}: Left Arrow moves back to the previous sun")
    page.keyboard.press("ArrowLeft")
    check(active_is(page, ".home-hub", 0), f"{mode}: Left Arrow on the first sun stays put")
    page.keyboard.press("ArrowDown")
    check(active_is(page, ".home-hub", 3), f"{mode}: Down Arrow moves to the sun below")
    page.keyboard.press("ArrowUp")
    check(active_is(page, ".home-hub", 0), f"{mode}: Up Arrow moves to the sun above")

    # Planets and moons around the first sun.
    page.keyboard.press("Tab")
    check(active_is(page, ".home-satellite", 0), f"{mode}: Tab from a sun reaches its first planet")
    page.keyboard.press("ArrowRight")
    check(active_is(page, ".home-satellite", 1), f"{mode}: Right Arrow moves to the next planet")
    page.keyboard.press("ArrowDown")
    check(page.evaluate("document.activeElement.classList.contains('moon-link') && "
                        "document.activeElement.closest('.planet-cluster') === "
                        "document.querySelectorAll('.home-planet-cluster')[1]"),
          f"{mode}: Down Arrow on a planet enters its first moon")
    page.keyboard.press("ArrowRight")
    check(page.evaluate("document.activeElement.classList.contains('moon-link') && "
                        "document.activeElement === document.querySelectorAll("
                        "'.home-planet-cluster')[1].querySelectorAll('.moon-link')[1]"),
          f"{mode}: Right Arrow moves to the next moon")
    page.keyboard.press("ArrowUp")
    check(active_is(page, ".home-satellite", 1), f"{mode}: Up Arrow from a moon returns to its planet")
    page.keyboard.press("ArrowUp")
    check(active_is(page, ".home-hub", 0), f"{mode}: Up Arrow from a Galaxy planet returns to its sun")

    # The same keys inside a System.
    page.keyboard.press("Enter")
    page.locator(".detail-view").wait_for()
    page.locator(".detail-satellite").first.focus()
    page.keyboard.press("ArrowLeft")
    check(active_is(page, ".detail-satellite", 0), f"{mode}: Left Arrow on the first System planet stays put")
    page.keyboard.press("ArrowRight")
    check(active_is(page, ".detail-satellite", 1), f"{mode}: Right Arrow moves to the next System planet")
    page.keyboard.press("ArrowDown")
    check(page.evaluate("document.activeElement.classList.contains('moon-link')"),
          f"{mode}: Down Arrow enters a System planet's moons")
    page.keyboard.press("ArrowUp")
    check(active_is(page, ".detail-satellite", 1), f"{mode}: Up Arrow returns to the System planet")


def tab_until_id(page, element_id, key="Tab", limit=60):
    for _ in range(limit):
        page.keyboard.press(key)
        if active_id(page) == element_id:
            return True
    return False


def check_help_and_journey(page, url, mode):
    """Steps 5-6: Help describes the shortcuts, and a keyboard-only journey works."""
    reset_map(page, url)
    page.context.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda route: route.fulfill(
        status=200, content_type="text/html", body="<title>Test destination</title>"))
    page.locator("#settings-trigger").focus()
    page.keyboard.press("Enter")
    page.keyboard.press("Tab")
    page.keyboard.press("Enter")  # Help is the second option
    text = page.locator("#menu-content").inner_text()
    check(all(word in text for word in ("Press /", "Arrow", "Escape", "Tab")),
          f"{mode}: Help describes the keyboard shortcuts")
    page.keyboard.press("Escape")

    # Keyboard-only: search, open a System, reach a moon, open it, use the menu, return.
    page.keyboard.press("/")
    page.keyboard.type("Tech")
    page.locator(".find-item").first.wait_for()
    page.keyboard.press("ArrowDown")
    page.keyboard.press("Enter")
    page.locator(".detail-view").wait_for()
    reached = tab_until(page, "detail-satellite", 20)
    check("detail-satellite" in reached, f"{mode}: Tab reaches a System planet")
    page.keyboard.press("ArrowDown")
    check(page.evaluate("document.activeElement.classList.contains('moon-link')"),
          f"{mode}: Down Arrow reaches a moon")
    with page.context.expect_page() as popup:
        page.keyboard.press("Enter")
    check(popup.value.url.startswith("https://"), f"{mode}: Enter opens the moon's destination")
    popup.value.close()
    check(tab_until_id(page, "settings-trigger", "Shift+Tab"), f"{mode}: Shift+Tab reaches the cog")
    page.keyboard.press("Enter")
    check(in_menu(page), f"{mode}: the cog opens the menu from the keyboard")
    # The query from the search is still set, so the order is: menu, query, then the System.
    page.keyboard.press("Escape")
    check(page.locator("#menu-overlay").is_hidden() and page.locator(".detail-view").count() == 1,
          f"{mode}: first Escape closes only the menu")
    page.keyboard.press("Escape")
    check(page.locator("#quick-find").input_value() == "" and page.locator(".detail-view").count() == 1,
          f"{mode}: second Escape clears Quick find and stays in the System")
    page.keyboard.press("Escape")
    page.locator(".detail-view").wait_for(state="detached")  # the hashchange render is async
    page.locator(".home-hub").first.wait_for()
    check(page.locator(".home-hub").count() == SAMPLE_SUNS, f"{mode}: third Escape returns to the Galaxy")
