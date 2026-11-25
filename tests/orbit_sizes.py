"""Browser checks for planet and moon sizing and the six-moon fan (OS01–OS06, OS08–OS11).

Run with: /home/sysadmin/.venv/bin/python tests/orbit_sizes.py
   or, in a remote browser such as Edge on the Windows VM:
       python tests/orbit_sizes.py --cdp http://127.0.0.1:9333 --url file:///C:/path/index.html
   (write the fixture data for that copy with --write-fixture DIR)

Uses a synthetic fixture with long planet and moon names, a planet with six
moons plus overflow, and the smallest supported screen (1920x1080). Runs in
file mode and against a temporary local server.
"""

import argparse
import json
import tempfile
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

from helpers import ARTIFACTS, QuietHandler, check, write_fixture

VIEWPORT = {"width": 1920, "height": 1080}


def web(name, slug, moons=None):
    item = {"name": name, "url": f"https://example.test/{slug}"}
    if moons is not None:
        item["moons"] = moons
    return item


MOON_NAMES = ["Onboarding", "Translations", "Reports", "Calendar", "Billing", "Support",
              "Archive", "Internationalization"]
FIXTURE = {"groups": [
    {"id": "alpha", "name": "Alpha", "description": "First row sun", "color": "#79d9f8", "links": [
        web("Basic Confluence", "confluence", [web(name, f"m{i}") for i, name in enumerate(MOON_NAMES)]),
        web("International", "intl", [web(f"Five {i}", f"f{i}") for i in range(5)]),
        {"name": "Documentation Hub", "type": "group", "moons": [web("Guides", "g"), web("API", "api")]},
        web("Telecommunications", "telecom", [web("Lines", "l"), web("Phones", "p"), web("Faxes", "fx"),
                                              web("Pagers", "pg")]),
        web("Wiki", "wiki", []),
    ]},
    {"id": "beta", "name": "Beta", "description": "Second sun", "color": "#c49bff", "links": [
        web("Mail", "mail", [web("Inbox", "in")]), web("Calendar", "cal", []),
    ]},
]}

# A label's words, each checked as one unbroken run of text.
WORD_SPLITS = """sel => [...document.querySelectorAll(sel)].flatMap(node => {
  const text = node.firstChild;
  if (!text || text.nodeType !== Node.TEXT_NODE) return [];
  const result = [];
  for (const match of text.data.matchAll(/\\S+/g)) {
    const range = document.createRange();
    range.setStart(text, match.index);
    range.setEnd(text, match.index + match[0].length);
    const lines = new Set([...range.getClientRects()].map(rect => Math.round(rect.top)));
    if (lines.size > 1) result.push(match[0]);
  }
  return result;
})"""


def center(locator):
    box = locator.bounding_box()
    check(box is not None, "element has a box")
    return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2


def node(page, css, sun, planet=None, moon=None):
    selector = f'{css}[data-sun="{sun}"]'
    if planet is not None:
        selector += f'[data-planet="{planet}"]'
    if moon is not None:
        selector += f'[data-moon="{moon}"]'
    return page.locator(selector)


def hover_galaxy_planet(page, sun, planet):
    page.mouse.move(*center(page.locator(".home-hub").nth(sun)))
    target = node(page, ".home-satellite", sun, planet)
    target.wait_for(state="visible")
    page.wait_for_timeout(450)
    page.mouse.move(*center(target), steps=4)
    page.wait_for_timeout(300)


def run_mode(page, url, mode):
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="load")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(300)

    # OS01: no planet label in the Galaxy breaks inside a word, and every
    # Galaxy planet shares one size.
    page.mouse.move(*center(page.locator(".home-hub").first))
    node(page, ".home-satellite", 0, 0).wait_for(state="visible")
    page.wait_for_timeout(450)
    split = page.evaluate(WORD_SPLITS, ".home-satellite")
    check(split == [], f"{mode}: Galaxy planet words stay whole (split: {split})")
    sizes = set(page.evaluate("[...document.querySelectorAll('.home-satellite')].map(n => n.offsetWidth)"))
    check(len(sizes) == 1 and sizes.pop() > 72, f"{mode}: Galaxy planets grow together to fit long names")
    print(f"PASS OS01 Galaxy planet labels ({mode})")

    # OS02: six moons orbit; the seventh and eighth stay reachable in the System.
    hover_galaxy_planet(page, 0, 0)
    check(node(page, ".moon-link", 0, 0).count() == 6, f"{mode}: six moons orbit a planet")
    for moon in range(6):
        check(node(page, ".moon-link", 0, 0, moon).is_visible(), f"{mode}: moon {moon + 1} is visible")
    split = page.evaluate(WORD_SPLITS, ".moon-link")
    check(split == [], f"{mode}: moon words stay whole (split: {split})")
    page.screenshot(path=str(ARTIFACTS / f"orbit-sizes-galaxy-six-{mode}.png"))
    print(f"PASS OS02 six visible moons ({mode})")

    # OS03: the fan of a first-row planet stays on screen.
    tops = [node(page, ".moon-link", 0, 0, moon).bounding_box()["y"] for moon in range(6)]
    check(min(tops) >= 0, f"{mode}: the top moon fan stays below the top of the screen ({min(tops):.0f})")
    print(f"PASS OS03 fan stays on screen ({mode})")

    # OS04: moving straight to a neighbouring planet shows that planet's moons
    # instead of keeping the first planet's fan.
    page.mouse.move(*center(node(page, ".home-satellite", 0, 1)), steps=8)
    page.wait_for_timeout(350)
    check(node(page, ".moon-link", 0, 1, 0).is_visible() and
          not node(page, ".moon-link", 0, 0, 0).is_visible(),
          f"{mode}: hover hands over to the neighbouring planet")
    print(f"PASS OS04 hover handoff ({mode})")

    # OS05: a planet with more than four moons holds them farther out than one
    # with four, in the System.
    page.goto(url.split("#")[0] + "#group/alpha", wait_until="load")
    page.wait_for_timeout(700)
    split = page.evaluate(WORD_SPLITS, ".detail-satellite")
    check(split == [], f"{mode}: System planet words stay whole (split: {split})")

    def reach(planet):
        satellite = node(page, ".detail-satellite", 0, planet)
        page.mouse.move(*center(satellite), steps=4)
        page.wait_for_timeout(300)
        px, py = center(satellite)
        return min(((lambda c: ((c[0] - px) ** 2 + (c[1] - py) ** 2) ** .5)(center(moon)))
                   for moon in node(page, ".moon-link", 0, planet).all())
    six, five, four = reach(0), reach(1), reach(3)
    check(six > four + 20 and five > four + 20,
          f"{mode}: five and six moons sit farther out than four ({six:.0f}, {five:.0f}, {four:.0f})")
    # The lower planet's fan (still hovered) clears the note under the stage.
    lowest = max(box["y"] + box["height"] for box in
                 (moon.bounding_box() for moon in node(page, ".moon-link", 0, 3).all()))
    note_top = page.locator(".detail-note").bounding_box()["y"]
    check(lowest <= note_top, f"{mode}: lower moons clear the System note ({lowest:.0f} <= {note_top:.0f})")
    page.screenshot(path=str(ARTIFACTS / f"orbit-sizes-system-{mode}.png"))
    print(f"PASS OS05 more distance for more than four moons ({mode})")

    # OS06: moons beyond six are listed under More moons.
    names = page.locator(".moon-overflow-links").first.locator("a, button").all_inner_texts()
    check(names == MOON_NAMES[6:], f"{mode}: moons beyond six are listed under More moons ({names})")
    print(f"PASS OS06 More moons ({mode})")

    # OS08: a hovered sun (grown 5%) keeps clear of its planets and their "N moons"
    # labels. Long names here grow the planets, which used to bring them closest.
    page.goto(url, wait_until="load")
    page.locator(".home-hub").first.wait_for()
    page.wait_for_timeout(300)
    page.mouse.move(*center(page.locator(".home-hub").first))
    node(page, ".home-satellite", 0, 4).wait_for(state="visible")
    page.wait_for_timeout(900)
    gaps = page.evaluate("""() => {
      const orbit = document.querySelector('.home-orbit[data-sun="0"]');
      const sun = orbit.querySelector('.home-hub').getBoundingClientRect();
      const sx = sun.left + sun.width / 2, sy = sun.top + sun.height / 2, sr = sun.width / 2;
      const planets = [...orbit.querySelectorAll('.home-satellite')].map(node => {
        const box = node.getBoundingClientRect();
        return Math.hypot(box.left + box.width / 2 - sx, box.top + box.height / 2 - sy) - sr - box.width / 2;
      });
      const badges = [...orbit.querySelectorAll('.moon-badge')].map(node => {
        const box = node.getBoundingClientRect();
        const nx = Math.max(box.left, Math.min(sx, box.right)), ny = Math.max(box.top, Math.min(sy, box.bottom));
        return Math.hypot(nx - sx, ny - sy) - sr;
      });
      return { sun: sun.width, planets, badges };
    }""")
    check(gaps["sun"] > 134 and min(gaps["planets"]) >= 12,
          f"{mode}: planets keep at least 12px from the hovered sun ({gaps})")
    check(min(gaps["badges"]) >= 2, f"{mode}: moon labels stay off the hovered sun ({gaps})")
    # The hovered sun grows in place, so every planet keeps the same gap.
    check(max(gaps["planets"]) - min(gaps["planets"]) < 1, f"{mode}: the hovered sun stays centered; every gap is equal ({gaps})")
    print(f"PASS OS08 planets clear the hovered sun ({mode})")

    # OS09: a lower planet's moons never sit on top of the sun's caption: the caption
    # fades while they would cover it, and stays for a planet whose moons don't reach it.
    caption_state = """sun => {
      const card = document.querySelector(`.home-orbit[data-sun="${sun}"]`).closest('.group-card');
      const caption = card.querySelector('.group-description');
      const range = document.createRange();
      range.selectNodeContents(caption);
      const text = range.getBoundingClientRect();
      const covered = [...card.querySelectorAll('.planet-cluster:hover .moon-link')].some(node => {
        const box = node.getBoundingClientRect();
        return box.left < text.right && box.right > text.left && box.top < text.bottom && box.bottom > text.top;
      });
      return { covered, opacity: Number(getComputedStyle(caption).opacity) };
    }"""
    hover_galaxy_planet(page, 0, 2)
    group = node(page, ".group-planet", 0, 2)
    check(group.get_attribute("aria-expanded") == "false", f"{mode}: the lower group is open on hover alone")
    lower = page.evaluate(caption_state, 0)
    check(not lower["covered"] or lower["opacity"] < .05,
          f"{mode}: a lower planet's moons don't cover a visible caption ({lower})")
    hover_galaxy_planet(page, 0, 0)
    page.wait_for_timeout(400)
    top = page.evaluate(caption_state, 0)
    check(not top["covered"] and top["opacity"] == 1, f"{mode}: the top planet leaves the caption visible ({top})")
    print(f"PASS OS09 moons never cover the caption ({mode})")

    # OS10: moving slowly from a lower planet to each of its moons keeps them open,
    # and the moon is what the pointer lands on (a faded caption once caught it).
    hover_galaxy_planet(page, 0, 2)
    for index in range(2):
        start = center(group)
        page.mouse.move(*start)
        moon = node(page, ".moon-link", 0, 2, index)
        name = moon.inner_text()
        end = center(moon)
        for step in range(1, 13):
            page.mouse.move(start[0] + (end[0] - start[0]) * step / 12, start[1] + (end[1] - start[1]) * step / 12)
            page.wait_for_timeout(40)
            check(moon.is_visible(), f"{mode}: moon {name} stays open on the way to it (step {step} of 12)")
        landed = page.evaluate("([x, y]) => document.elementFromPoint(x, y)?.closest('.moon-link')?.textContent", list(end))
        check(landed == name, f"{mode}: the pointer lands on moon {name} ({landed})")
    print(f"PASS OS10 the pointer reaches every moon ({mode})")


    # OS11: the pencil leaves the open moon field reachable.
    hover_galaxy_planet(page, 0, 3)
    planet = node(page, ".home-satellite", 0, 3)
    pencil = page.locator(".map-edit-button")
    pencil.wait_for(timeout=2500)
    moon = node(page, ".moon-link", 0, 3, 0)
    start, end = center(planet), center(moon)
    for step in range(1, 13):
        page.mouse.move(start[0] + (end[0] - start[0]) * step / 12, start[1] + (end[1] - start[1]) * step / 12)
        page.wait_for_timeout(40)
        check(moon.is_visible(), f"{mode}: the moon stays open past the pencil (step {step} of 12)")
    landed = page.evaluate("([x, y]) => document.elementFromPoint(x, y)?.closest('.moon-link')?.textContent", list(end))
    check(landed == moon.inner_text(), f"{mode}: the pointer lands on the moon after the pencil")
    print(f"PASS OS11 pencil leaves the moons reachable ({mode})")

    # OS12: with Orbit classic (DM Sans and Space Grotesk) chosen before the page loads,
    # Galaxy planet labels still keep their words whole and share one size.
    page.evaluate("localStorage.setItem('orbit:font-family', 'classic')")
    page.reload(wait_until="load")
    page.locator(".home-hub").first.wait_for()
    page.wait_for_function("document.fonts.status === 'loaded'")
    page.wait_for_timeout(300)
    check(page.evaluate("document.documentElement.dataset.fontFamily") == "classic", f"{mode}: Orbit classic is in use")
    page.mouse.move(*center(page.locator(".home-hub").first))
    node(page, ".home-satellite", 0, 0).wait_for(state="visible")
    page.wait_for_timeout(450)
    split = page.evaluate(WORD_SPLITS, ".home-satellite")
    check(split == [], f"{mode}: classic planet words stay whole (split: {split})")
    sizes = set(page.evaluate("[...document.querySelectorAll('.home-satellite')].map(n => n.offsetWidth)"))
    check(len(sizes) == 1, f"{mode}: classic planets share one size ({sizes})")
    page.evaluate("localStorage.removeItem('orbit:font-family')")
    print(f"PASS OS12 Orbit classic labels ({mode})")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cdp", help="Connect to a running browser at this DevTools address")
    parser.add_argument("--url", help="With --cdp: the page URL of the fixture copy to test")
    parser.add_argument("--write-fixture", metavar="DIR",
                        help="Only write the synthetic fixture data files into DIR and exit")
    args = parser.parse_args()
    if args.write_fixture:
        # The whole fixture, test bundle included, so a remote browser tests what the local runs test.
        write_fixture(Path(args.write_fixture), FIXTURE)
        return
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    if args.cdp:
        with sync_playwright() as playwright:
            browser = playwright.chromium.connect_over_cdp(args.cdp)
            page = browser.contexts[0].new_page()
            page.set_viewport_size(VIEWPORT)
            print(f"Browser: {browser.version}")
            try:
                run_mode(page, args.url, "remote")
            finally:
                page.close()
        print("PASS orbit sizes")
        return
    with sync_playwright() as playwright, tempfile.TemporaryDirectory() as directory:
        fixture = write_fixture(directory, FIXTURE)
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(fixture)))
        Thread(target=server.serve_forever, daemon=True).start()
        browser = playwright.chromium.launch(
            executable_path="/usr/bin/chromium", headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"])
        try:
            for mode, url in (("file", (fixture / "index.html").as_uri()),
                              ("server", f"http://127.0.0.1:{server.server_port}/index.html")):
                page = browser.new_page(viewport=VIEWPORT)
                try:
                    run_mode(page, url, mode)
                finally:
                    page.close()
        finally:
            browser.close()
            server.shutdown()
            server.server_close()
    print("PASS orbit sizes")


if __name__ == "__main__":
    main()
