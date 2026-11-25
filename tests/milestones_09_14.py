"""Browser checks for milestones 9-14."""

import json
from urllib.parse import urlparse
from pathlib import Path
from helpers import ARTIFACTS, ROOT, DEFAULT_LINKS, DEFAULT_SUNS, check, click_logo_to_galaxy, download_json, open_editor, submit_editor_form, upload_json


def run_milestone_9(page, url, mode):
    data = json.loads((ROOT / "links.json").read_text())
    suns = data["groups"]
    planets = [planet for sun in suns for planet in sun["links"]]
    moons = [moon for planet in planets for moon in planet.get("moons", [])]
    # The web suns: every sun but Labs (Remote Desktop links).
    original_suns = [sun for sun in suns if sun["id"] != "labs"]
    original_planets = [planet for sun in original_suns for planet in sun["links"]]
    original_moons = [moon for planet in original_planets for moon in planet.get("moons", [])]
    check(len(original_suns) == DEFAULT_SUNS - 1 and all(len(sun["links"]) >= 5 for sun in original_suns) and original_moons,
          "web sample suns each have at least five planets")
    check(len({sun["id"] for sun in suns}) == DEFAULT_SUNS, "unique sun IDs")
    web_planets = [planet for planet in original_planets if planet.get("type") != "group"]
    for destination in web_planets + original_moons:
        parsed = urlparse(destination["url"])
        check(destination["name"].strip() and parsed.scheme == "https" and parsed.netloc,
              f"valid sample destination: {destination}")
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:map:v1'); localStorage.removeItem('orbit:undo-removal:v1')")
    page.reload(wait_until="load")
    page.wait_for_timeout(700)
    check(page.locator(".home-hub").count() == DEFAULT_SUNS,
          f"{mode}: every sample sun on Galaxy")
    cards = page.locator(".group-card").all()
    rows = []
    for card in cards:
        box = card.bounding_box()
        check(box is not None and 0 <= box["x"] and box["x"] + box["width"] <= 1280,
              f"{mode}: sun card fits Galaxy")
        row = next((row for row in rows if abs(row["y"] - box["y"]) <= 10), None)
        if row is None:
            row = {"y": box["y"], "centers": []}
            rows.append(row)
        row["centers"].append(box["x"] + box["width"] / 2)
    last_row = max(rows, key=lambda row: row["y"])["centers"]
    check(abs(sum(last_row) / len(last_row) - 640) < 10,
          f"{mode}: last row of suns is centered ({len(last_row)} in it)")
    check(page.locator(".home-hub").filter(has_text="Stocks & Investing").count() == 1 and
          page.locator(".home-hub").filter(has_text="Science").count() == 1,
          f"{mode}: new suns present")
    check(page.locator(".hub-name").filter(has_text="Stocks & Investing").evaluate(
        "el => el.scrollWidth <= el.clientWidth + 1"),
        f"{mode}: long sun name fits its circle")
    page.screenshot(path=str(ARTIFACTS / f"milestone9-galaxy-{mode}-1280.png"),
                    full_page=True)
    page.set_viewport_size({"width": 900, "height": 900})
    for card in cards:
        box = card.bounding_box()
        check(box is not None and box["x"] >= -1 and box["x"] + box["width"] <= 901,
              f"{mode}: sun card fits narrow Galaxy")
    page.screenshot(path=str(ARTIFACTS / f"milestone9-galaxy-{mode}-900.png"),
                    full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    page.locator(".home-hub").filter(has_text="Stocks & Investing").click()
    check("Stocks & Investing" in page.locator(".detail-heading h1").inner_text(),
          f"{mode}: stocks System opens")
    check(page.locator(".detail-satellite").count() == 5,
          f"{mode}: stocks planets visible")
    investor = page.locator(".detail-planet-cluster").filter(has_text="Investor.gov")
    investor.locator(".detail-satellite").hover()
    page.wait_for_timeout(350)
    check(investor.locator(".moon-link:visible").count() == 4,
          f"{mode}: four Investor.gov moons visible")
    check(investor.locator(".moon-link").nth(2).get_attribute("href") ==
          "https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator",
          f"{mode}: investing moon URL")
    page.screenshot(path=str(ARTIFACTS / f"milestone9-stocks-{mode}.png"),
                    full_page=False)
    page.set_viewport_size({"width": 900, "height": 900})
    investor.locator(".detail-satellite").hover()
    for moon in investor.locator(".moon-link:visible").all():
        box = moon.bounding_box()
        check(box is not None and box["x"] >= 0 and box["x"] + box["width"] <= 900,
              f"{mode}: investing moons fit narrow System")
    page.context.route("https://www.investor.gov/protect-your-investments", lambda route: route.fulfill(
        status=200, content_type="text/html", body="<title>Investor.gov</title>"))
    with page.expect_popup() as popup_info:
        investor.locator(".moon-link").last.click()
    popup = popup_info.value
    popup.wait_for_load_state()
    check(popup.url == "https://www.investor.gov/protect-your-investments",
          f"{mode}: investing moon reachable")
    popup.close()
    page.screenshot(path=str(ARTIFACTS / f"milestone9-stocks-{mode}-900.png"),
                    full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    page.locator(".back-link").click()
    page.locator(".home-hub").filter(has_text="Science").click()
    page.wait_for_function("document.querySelector('.detail-heading h1')?.textContent?.includes('Science')")
    check(page.locator(".detail-satellite").count() == 5,
          f"{mode}: science planets visible")
    nasa = page.locator(".detail-planet-cluster").filter(has_text="NASA Science")
    nasa.locator(".detail-satellite").hover()
    page.wait_for_timeout(350)
    check(nasa.locator(".moon-link:visible").count() == 3,
          f"{mode}: NASA moons visible")
    check(nasa.locator(".moon-link").first.get_attribute("href") ==
          "https://science.nasa.gov/solar-system/",
          f"{mode}: science moon URL")
    page.screenshot(path=str(ARTIFACTS / f"milestone9-science-{mode}.png"),
                    full_page=False)
    page.set_viewport_size({"width": 900, "height": 900})
    nasa.locator(".detail-satellite").hover()
    for moon in nasa.locator(".moon-link:visible").all():
        box = moon.bounding_box()
        check(box is not None and box["x"] >= 0 and box["x"] + box["width"] <= 900,
              f"{mode}: science moons fit narrow System")
    page.screenshot(path=str(ARTIFACTS / f"milestone9-science-{mode}-900.png"),
                    full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    print(f"PASS milestone 9 ({mode})")


def run_milestone_10(page, url, mode):
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:font-size'); localStorage.removeItem('orbit:map:v1')")
    page.reload(wait_until="load")
    check(page.locator("html").get_attribute("data-font-size") == "standard",
          f"{mode}: font size defaults Standard")
    sizes = {"small": 0.9, "standard": 1, "large": 1.15, "extra": 1.3}
    for theme in ("default", "alabama", "auburn"):
        for size, scale in sizes.items():
            page.locator("#settings-trigger").click()
            page.locator('[data-menu-panel="Settings"]').click()
            page.get_by_label("Theme").select_option(theme)
            page.get_by_label("Font size").select_option(size)
            check(page.locator("html").get_attribute("data-font-size") == size,
                  f"{mode}: {theme} {size} applies immediately")
            setting_size = page.locator(".setting-copy strong").first.evaluate(
                "el => parseFloat(getComputedStyle(el).fontSize)")
            check(abs(setting_size - 14 * scale) < 0.2,
                  f"{mode}: {theme} {size} menu text scales")
            page.locator("#menu-close").click()
            page.reload(wait_until="load")
            page.locator(".home-hub").first.wait_for()
            check(page.locator("html").get_attribute("data-font-size") == size,
                  f"{mode}: {theme} {size} persists after reload")
            page.set_viewport_size({"width": 900, "height": 900})
            for hub in page.locator(".home-hub").all():
                check(hub.evaluate("el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1"),
                      f"{mode}: {theme} {size} sun label fits")
            hub_size = page.locator(".home-hub").first.locator(".hub-name").evaluate(
                "el => parseFloat(getComputedStyle(el).fontSize)")
            check(abs(hub_size - 20 * scale) < 0.2,
                  f"{mode}: {theme} {size} sun text scales")
            search = page.get_by_role("searchbox", name="Quick find")
            search.fill("Investor.gov")
            check(page.locator(".find-item").count() == 1,
                  f"{mode}: {theme} {size} search result reachable")
            search.fill("")
            page.locator(".home-hub").filter(has_text="Stocks & Investing").click()
            page.wait_for_function("document.querySelector('.detail-heading h1')?.textContent?.includes('Stocks & Investing')")
            check(page.locator(".detail-hub").evaluate(
                "el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1"),
                f"{mode}: {theme} {size} long System label fits")
            investor = page.locator(".detail-planet-cluster").filter(has_text="Investor.gov")
            investor.locator(".detail-satellite").hover()
            for moon in investor.locator(".moon-link:visible").all():
                box = moon.bounding_box()
                check(box is not None and box["x"] >= 0 and box["x"] + box["width"] <= 900,
                      f"{mode}: {theme} {size} moon fits System")
            page.locator(".back-link").click()
            open_editor(page)
            sheet = page.locator(".menu-sheet").bounding_box()
            check(sheet is not None and sheet["x"] >= 0 and sheet["x"] + sheet["width"] <= 900,
                  f"{mode}: {theme} {size} editor fits desktop")
            if size == "extra":
                page.screenshot(path=str(ARTIFACTS / f"milestone10-{theme}-{mode}-editor.png"),
                                full_page=True)
            page.set_viewport_size({"width": 1280, "height": 900})
            sheet = page.locator(".menu-sheet").bounding_box()
            check(sheet is not None and sheet["x"] >= 0 and sheet["x"] + sheet["width"] <= 1280,
                  f"{mode}: {theme} {size} editor fits normal desktop")
            page.locator("#menu-close").click()
            for hub in page.locator(".home-hub").all():
                check(hub.evaluate("el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1"),
                      f"{mode}: {theme} {size} sun label fits normal desktop")
            if size == "extra":
                page.screenshot(path=str(ARTIFACTS / f"milestone10-{theme}-{mode}-galaxy.png"),
                                full_page=True)
    print(f"PASS milestone 10 ({mode})")


def run_milestone_11(page, url, mode):
    data = json.loads((ROOT / "links.json").read_text())
    labs = data["groups"][-1]
    check(labs["id"] == "labs" and [planet["name"] for planet in labs["links"]] ==
          [f"lab{i}" for i in range(1, 6)], "five lab planets")
    check([moon["name"] for moon in labs["links"][0]["moons"]] ==
          [f"lab1-server{i}" for i in range(1, 6)], "five lab1 server moons")
    check(all(item.get("type") == "rdp" and item.get("host") for item in
              labs["links"] + labs["links"][0]["moons"]), "lab destinations use RDP hosts")
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:map:v1')")
    page.reload(wait_until="load")
    check(f"{DEFAULT_LINKS} LINKS" in page.locator("#link-count").inner_text(),
          f"{mode}: sample map link count")
    labs_hub = page.locator(".home-hub").filter(has_text="Labs")
    check(labs_hub.count() == 1, f"{mode}: Labs sun appears")
    labs_hub.click()
    page.wait_for_function("document.querySelector('.detail-heading h1')?.textContent === 'Labs'")
    check(page.locator(".detail-planet-cluster").count() == 5,
          f"{mode}: five lab planets visible")
    lab1 = page.locator(".detail-planet-cluster").filter(has_text="lab1")
    lab1.locator(".detail-satellite").hover()
    check(lab1.locator(".moon-link:visible").count() == 5 and
          page.locator(".moon-overflow .overflow-moon-link").count() == 0,
          f"{mode}: all five server moons orbit, none in overflow")
    with page.expect_download() as download_info:
        lab1.locator(".moon-link").first.click()
    download = download_info.value
    check(download.suggested_filename == "lab1-server1.rdp", f"{mode}: RDP filename")
    check(Path(download.path()).read_text() ==
          "full address:s:lab1-server1\nprompt for credentials:i:1\n",
          f"{mode}: RDP file targets selected server without stored credentials")
    lab1.locator(".detail-satellite").hover()
    with page.expect_download() as download_info:
        lab1.locator(".moon-link").nth(4).click()
    check(download_info.value.suggested_filename == "lab1-server5.rdp",
          f"{mode}: fifth server downloads")
    page.set_viewport_size({"width": 900, "height": 900})
    page.screenshot(path=str(ARTIFACTS / f"milestone11-labs-{mode}-900.png"), full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    page.locator(".back-link").click()
    page.get_by_role("searchbox", name="Quick find").fill("lab1-server1")
    with page.expect_download() as download_info:
        page.locator(".find-item").click()
    check(download_info.value.suggested_filename == "lab1-server1.rdp",
          f"{mode}: Quick find downloads RDP")
    page.get_by_role("searchbox", name="Quick find").fill("")
    open_editor(page)
    page.locator(".editor-list-row").filter(has_text="Labs").get_by_role("button", name="Edit").click()
    page.locator(".editor-list-row").filter(has_text="lab1").get_by_role("button", name="Edit").click()
    page.locator(".editor-list-row").filter(has_text="lab1-server1").get_by_role("button", name="Edit").click()
    check(page.get_by_label("Destination type").input_value() == "rdp",
          f"{mode}: editor loads RDP type")
    page.get_by_label("Computer name or IP address").fill("bad;host")
    submit_editor_form(page)
    check("computer name or IP address" in page.locator(".editor-error").inner_text(),
          f"{mode}: invalid host rejected")
    page.get_by_label("Computer name or IP address").fill("10.10.1.11:3390")
    submit_editor_form(page)
    saved = page.evaluate("JSON.parse(localStorage.getItem('orbit:map:v1')).groups.find(g => g.id === 'labs').links[0].moons[0]")
    check(saved == {"name": "lab1-server1", "type": "rdp", "host": "10.10.1.11:3390"},
          f"{mode}: RDP host edit persists")
    page.locator("#menu-close").click()
    page.reload(wait_until="load")
    page.get_by_role("searchbox", name="Quick find").fill("lab1-server1")
    with page.expect_download() as download_info:
        page.locator(".find-item").click()
    check("full address:s:10.10.1.11:3390" in Path(download_info.value.path()).read_text(),
          f"{mode}: edited host appears in download after reload")
    print(f"PASS milestone 11 ({mode})")


def run_milestone_12(page, url, mode):
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:map:v1'); localStorage.removeItem('orbit:rdp-launch')")
    page.reload(wait_until="load")
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    mode_select = page.get_by_label("Remote Desktop launch")
    check(mode_select.input_value() == "download", f"{mode}: RDP download is default")
    check(page.locator(".rdp-setup:visible").count() == 0,
          f"{mode}: native setup guidance stays hidden in download mode")
    mode_select.select_option("client")
    check(page.evaluate("localStorage.getItem('orbit:rdp-launch')") == "client",
          f"{mode}: client setting saved")
    check(mode_select.locator("option:checked").inner_text() == "Open mstsc.exe",
          f"{mode}: native mode clearly names the built-in client")
    setup = page.locator(".rdp-setup:visible")
    check(setup.count() == 1 and "Install-OrbitRdp.ps1" in setup.inner_text() and
          "mstsc.exe" in setup.inner_text() and "MSRDC" in setup.inner_text() and
          "powershell.exe" in setup.inner_text() and "pwsh.exe" in setup.inner_text(),
          f"{mode}: native setup guidance names the required installer and client")
    page.set_viewport_size({"width": 900, "height": 900})
    page.screenshot(path=str(ARTIFACTS / f"milestone12-settings-{mode}-900.png"), full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    page.locator("#menu-close").click()
    page.locator(".home-hub").filter(has_text="Labs").click()
    page.wait_for_function("document.querySelector('.detail-heading h1')?.textContent === 'Labs'")
    check(page.locator(".detail-satellite").first.get_attribute("href") == "orbit-rdp://lab1/",
          f"{mode}: lab planet opens native URI")
    lab1 = page.locator(".detail-planet-cluster").filter(has_text="lab1")
    lab1.locator(".detail-satellite").hover()
    check(lab1.locator(".moon-link").first.get_attribute("href") ==
          "orbit-rdp://lab1-server1/", f"{mode}: lab moon opens native URI")
    check(lab1.locator(".moon-link").nth(4).get_attribute("href") ==
          "orbit-rdp://lab1-server5/", f"{mode}: fifth moon opens native URI")
    page.locator(".back-link").click()
    page.get_by_role("searchbox", name="Quick find").fill("lab1-server1")
    check(page.locator(".find-item").get_attribute("href") == "orbit-rdp://lab1-server1/",
          f"{mode}: Quick find opens native URI")
    page.reload(wait_until="load")
    page.locator("#settings-trigger").click()
    page.locator('[data-menu-panel="Settings"]').click()
    check(page.get_by_label("Remote Desktop launch").input_value() == "client",
          f"{mode}: client setting persists after reload")
    page.get_by_label("Remote Desktop launch").select_option("download")
    check(page.locator(".rdp-setup:visible").count() == 0,
          f"{mode}: setup guidance hides when download returns")
    page.locator("#menu-close").click()
    page.get_by_role("searchbox", name="Quick find").fill("lab1-server1")
    check(page.locator(".find-item").get_attribute("href") is None,
          f"{mode}: download mode restores button")
    with page.expect_download() as download_info:
        page.locator(".find-item").click()
    check(download_info.value.suggested_filename == "lab1-server1.rdp",
          f"{mode}: download mode remains available")
    print(f"PASS milestone 12 ({mode})")


def run_pending_ui(page, url, mode):
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:map:v1')")
    page.reload(wait_until="load")
    search = page.get_by_role("searchbox", name="Quick find")
    check(page.locator("#topbar-search:visible").count() == 1,
          f"{mode}: Quick find appears in the top bar")
    search.fill("Engadget")
    check(page.locator(".find-item").count() > 0 and page.locator(".group-grid:visible").count() == 0,
          f"{mode}: top bar search finds links")
    page.locator(".brand").click()
    check(search.input_value() == "" and page.locator(".home-hub").count() == DEFAULT_SUNS,
          f"{mode}: Orbit logo clears search and shows all suns")
    search.fill("Tech")
    page.locator(".find-item").first.click()
    page.locator(".detail-view").wait_for()
    check(page.locator("#topbar-search:visible").count() == 1,
          f"{mode}: Quick find remains visible in a System")
    click_logo_to_galaxy(page)
    check(search.input_value() == "" and page.locator(".home-hub").count() == DEFAULT_SUNS,
          f"{mode}: Orbit logo returns from a System to all suns")
    page.set_viewport_size({"width": 900, "height": 900})
    page.screenshot(path=str(ARTIFACTS / f"pending-ui-{mode}-900.png"), full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    print(f"PASS pending UI ({mode})")


def run_milestone_13(page, url, mode):
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:map:v1')")
    page.reload(wait_until="load")
    open_editor(page)
    page.set_viewport_size({"width": 900, "height": 900})
    sheet = page.locator(".menu-sheet").bounding_box()
    check(sheet is not None and sheet["x"] >= 0 and sheet["x"] + sheet["width"] <= 900,
          f"{mode}: scoped import controls fit narrower editor")
    page.get_by_role("button", name="Import a file").scroll_into_view_if_needed()
    page.screenshot(path=str(ARTIFACTS / f"milestone13-editor-{mode}-900.png"))
    page.set_viewport_size({"width": 1280, "height": 900})
    page.locator(".editor-list-row").filter(has_text="Labs").get_by_role("button", name="Edit").click()
    pane = page.locator(".editor-pane")
    check(pane.locator(".editor-form button").all_text_contents() == ["Save sun"] and
          pane.locator(".editor-sun-tools").get_by_role("button", name="Export sun").count() == 1 and
          pane.locator(".editor-sun-removal").get_by_role("button", name="Remove sun").count() == 1,
          f"{mode}: Save, Export, and Remove sit in distinct areas")
    page.set_viewport_size({"width": 900, "height": 900})
    page.screenshot(path=str(ARTIFACTS / f"milestone13-sun-editor-{mode}-900.png"))
    page.set_viewport_size({"width": 1280, "height": 900})
    sun_file = download_json(page, "Export sun")
    check(sun_file["format"] == "orbit-item-v1" and sun_file["kind"] == "sun" and
          sun_file["item"]["id"] == "labs" and len(sun_file["item"]["links"]) == 5 and
          "groups" not in sun_file, f"{mode}: sun export contains only Labs and descendants")
    planet_row = page.locator(".editor-list-row").filter(has_text="lab1")
    page.get_by_role("button", name="Export lab1", exact=True).wait_for(timeout=2000)
    planet_file = download_json(page, "Export lab1")
    check(planet_file["kind"] == "planet" and planet_file["item"]["name"] == "lab1" and
          len(planet_file["item"]["moons"]) == 5 and "links" not in planet_file and
          page.get_by_role("heading", name="Edit Labs", exact=True).is_visible(),
          f"{mode}: the planet row exports its five moons without opening the editor")
    planet_row.get_by_role("button", name="Edit", exact=True).click()
    check(download_json(page, "Export planet") == planet_file, f"{mode}: both export buttons produce the same planet file")
    moon_row = page.locator(".editor-list-row").filter(has_text="lab1-server1")
    moon_file = download_json(page, "Export lab1-server1")
    check(moon_file["kind"] == "moon" and moon_file["item"]["host"] == "lab1-server1" and
          "moons" not in moon_file and page.get_by_role("heading", name="Edit lab1", exact=True).is_visible(),
          f"{mode}: the moon row exports just its RDP target without opening the editor")
    moon_row.get_by_role("button", name="Edit", exact=True).click()
    check(download_json(page, "Export moon") == moon_file, f"{mode}: both export buttons produce the same moon file")
    page.locator(".editor-back").click()
    page.locator(".editor-back").click()
    page.locator(".editor-back").click()

    original = page.evaluate("JSON.stringify(OrbitTest.groups())")
    upload_json(page, "Import a file", moon_file)
    page.locator(".editor-error").filter(has_text="This file is a moon").wait_for()
    check(page.evaluate("JSON.stringify(OrbitTest.groups())") == original,
          f"{mode}: mismatched item file leaves Galaxy unchanged")
    upload_json(page, "Import a file", b"{bad")
    page.locator(".editor-error").filter(has_text="This isn't an Orbit map").wait_for()
    check(page.evaluate("JSON.stringify(OrbitTest.groups())") == original,
          f"{mode}: malformed item file leaves Galaxy unchanged")
    upload_json(page, "Import a file", sun_file)
    page.locator(".editor-header h3").filter(has_text="Review sun import").wait_for()
    check("Add to the Galaxy" in page.locator("#menu-content").inner_text(),
          f"{mode}: sun review shows target")
    page.get_by_role("button", name="Cancel").click()
    check(page.evaluate("JSON.stringify(OrbitTest.groups())") == original,
          f"{mode}: cancelling a valid item import leaves Galaxy unchanged")
    upload_json(page, "Import a file", sun_file)
    page.locator(".editor-header h3").filter(has_text="Review sun import").wait_for()
    page.get_by_role("button", name="Add sun", exact=True).click()
    suns = page.evaluate("OrbitTest.groups().map(sun => sun.id)")
    check(len(suns) == DEFAULT_SUNS + 1 and suns.count("labs") == 1 and "labs-2" in suns,
          f"{mode}: imported duplicate sun gets a unique ID")
    page.locator(".editor-back").click()
    page.locator(".editor-list-row").filter(has_text="Tech").get_by_role("button", name="Edit").click()
    upload_json(page, "Import planet", planet_file)
    page.locator(".editor-header h3").filter(has_text="Review planet import").wait_for()
    check("Tech sun" in page.locator("#menu-content").inner_text(),
          f"{mode}: planet review shows chosen sun")
    page.get_by_role("button", name="Add planet", exact=True).click()
    check(page.evaluate("OrbitTest.groups().find(sun => sun.id === 'tech').links.at(-1).moons.length") == 5,
          f"{mode}: imported planet keeps its moons")
    page.locator(".editor-back").click()
    page.locator(".editor-list-row").filter(has_text="Engadget").get_by_role("button", name="Edit").click()
    before_moons = page.evaluate("OrbitTest.groups().find(sun => sun.id === 'tech').links[0].moons.length")
    bad_moon = {**moon_file, "item": {"name": "Unsafe", "url": "javascript:alert(1)"}}
    upload_json(page, "Import moon", bad_moon)
    page.locator(".editor-error").filter(has_text="http or https URL").wait_for()
    check(page.evaluate("OrbitTest.groups().find(sun => sun.id === 'tech').links[0].moons.length") == before_moons,
          f"{mode}: invalid moon leaves the chosen planet unchanged")
    upload_json(page, "Import moon", moon_file)
    page.locator(".editor-header h3").filter(has_text="Review moon import").wait_for()
    check("Tech sun → Engadget planet" in page.locator("#menu-content").inner_text(),
          f"{mode}: moon review shows chosen planet")
    page.get_by_role("button", name="Add moon", exact=True).click()
    check(page.evaluate("OrbitTest.groups().find(sun => sun.id === 'tech').links[0].moons.at(-1).host") == "lab1-server1",
          f"{mode}: imported moon appends to chosen planet")
    page.locator("#menu-close").click()
    page.reload(wait_until="load")
    # Server mode renders after fetching links.json; wait for the suns before counting them.
    page.locator(".home-hub").nth(DEFAULT_SUNS).wait_for()
    check(page.locator(".home-hub").count() == DEFAULT_SUNS + 1 and
          page.evaluate("OrbitTest.groups().find(sun => sun.id === 'tech').links.at(-1).moons.length") == 5,
          f"{mode}: scoped imports persist after reload")
    page.locator(".home-hub").filter(has_text="Tech").click()
    page.locator(".detail-view").wait_for()
    check(page.locator(".detail-satellite").filter(has_text="lab1").count() == 1,
          f"{mode}: imported planet appears in its chosen System")
    engadget = page.locator(".detail-planet-cluster").filter(has_text="Engadget")
    engadget.locator(".detail-satellite").hover()
    check(engadget.locator(".moon-link").filter(has_text="lab1-server1").count() == 1,
          f"{mode}: imported moon appears under its chosen planet")
    click_logo_to_galaxy(page)
    open_editor(page)
    full_file = download_json(page, "Whole map (JSON)")
    check(len(full_file["groups"]) == DEFAULT_SUNS + 1 and
          full_file["groups"][0]["links"][0]["moons"][-1]["host"] == "lab1-server1",
          f"{mode}: full export includes scoped imports")
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Reset to file data").click()
    check(page.evaluate("OrbitTest.groups().length") == DEFAULT_SUNS, f"{mode}: reset removes scoped imports")
    upload_json(page, "Import a file", full_file)
    page.get_by_role("button", name="Replace my map").click()
    check(page.evaluate("OrbitTest.groups().length") == DEFAULT_SUNS + 1, f"{mode}: full import restores scoped imports")
    print(f"PASS milestone 13 ({mode})")


def run_milestone_14(page, url, mode):
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.removeItem('orbit:map:v1')")
    page.reload(wait_until="load")
    open_editor(page)
    shared_planet = {"format": "orbit-item-v1", "kind": "planet", "item": {
        "name": "Shared Research", "url": "https://example.com/research", "moons": [
            {"name": "Papers", "url": "https://example.com/papers"},
            {"name": "Lab Server", "type": "rdp", "host": "shared-lab:3390"},
        ],
    }}
    original = page.evaluate("JSON.stringify(OrbitTest.groups())")
    upload_json(page, "Import a file", {**shared_planet, "kind": "moon"})
    page.locator(".editor-error").filter(has_text="This file is a moon").wait_for()
    check(page.evaluate("JSON.stringify(OrbitTest.groups())") == original,
          f"{mode}: wrong item type does not change Galaxy")
    invalid = {**shared_planet, "item": {**shared_planet["item"], "url": "javascript:alert(1)"}}
    upload_json(page, "Import a file", invalid)
    page.locator(".editor-error").filter(has_text="http or https URL").wait_for()
    check(page.evaluate("JSON.stringify(OrbitTest.groups())") == original,
          f"{mode}: invalid planet does not change Galaxy")
    upload_json(page, "Import a file", shared_planet)
    page.locator(".editor-header h3").filter(has_text="Review planet as sun").wait_for()
    check("first planet in a new sun" in page.locator("#menu-content").inner_text() and
          "Planet destination: https://example.com/research" in page.locator("#menu-content").inner_text(),
          f"{mode}: conversion review explains where the link and moons go")
    page.set_viewport_size({"width": 900, "height": 900})
    page.screenshot(path=str(ARTIFACTS / f"milestone14-review-{mode}-900.png"))
    page.set_viewport_size({"width": 1280, "height": 900})
    page.get_by_role("button", name="Cancel").click()
    check(page.evaluate("JSON.stringify(OrbitTest.groups())") == original,
          f"{mode}: cancelled conversion leaves Galaxy unchanged")
    for expected_id in ("shared-research", "shared-research-2"):
        upload_json(page, "Import a file", shared_planet)
        page.locator(".editor-header h3").filter(has_text="Review planet as sun").wait_for()
        page.get_by_role("button", name="Add sun", exact=True).click()
        saved = page.evaluate("OrbitTest.groups().at(-1)")
        check(saved["id"] == expected_id and saved["name"] == "Shared Research" and
              saved["links"] == [shared_planet["item"]] and saved["color"] == "#79d9f8",
              f"{mode}: converted sun preserves planet and moons with unique ID")
        page.locator(".editor-back").click()
    page.locator("#menu-close").click()
    page.reload(wait_until="load")
    # Server mode renders after fetching links.json; wait for the suns before counting them.
    page.locator(".home-hub").nth(DEFAULT_SUNS + 1).wait_for()
    check(page.locator(".home-hub").count() == DEFAULT_SUNS + 2,
          f"{mode}: both converted suns persist after reload")
    page.locator(".home-hub").filter(has_text="Shared Research").first.click()
    page.locator(".detail-view").wait_for()
    planet = page.locator(".detail-planet-cluster").first
    check(planet.locator(".detail-satellite").get_attribute("href") ==
          "https://example.com/research", f"{mode}: original planet destination remains reachable")
    planet.locator(".detail-satellite").hover()
    check(planet.locator(".moon-link").filter(has_text="Papers").get_attribute("href") ==
          "https://example.com/papers", f"{mode}: web moon remains reachable")
    with page.expect_download() as download_info:
        planet.locator(".moon-link").filter(has_text="Lab Server").click()
    check("full address:s:shared-lab:3390" in Path(download_info.value.path()).read_text(),
          f"{mode}: RDP moon retains its host and port")
    click_logo_to_galaxy(page)
    open_editor(page)
    page.locator(".editor-list-row").filter(has_text="Shared Research").first.get_by_role(
        "button", name="Edit").click()
    exported_sun = download_json(page, "Export sun")
    check(exported_sun["item"]["links"] == [shared_planet["item"]] and
          "groups" not in exported_sun, f"{mode}: converted sun exports only the shared planet")
    print(f"PASS milestone 14 ({mode})")
