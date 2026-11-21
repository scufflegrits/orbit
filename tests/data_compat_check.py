"""Data compatibility for the rewrite: load the 2.2 storage fixture into Orbit and
check that everything is read back the same way as 2.2.1 reads it.

    python tests/make_v22_fixture.py                 # writes the fixture (once)
    python tests/data_compat_check.py --record       # on 2.2.1: writes the expected results
    python tests/data_compat_check.py                # any later version: compares with them

The expected results (tests/fixtures/v2.2-expected.json) were recorded from 2.2.1
and are the contract. This version collects state through 2.2.1's page globals;
when the rewrite moves state into modules (phase 3), collection switches to
window.OrbitTest, and the expected results stay the same.
"""

import argparse
import json
import sys
import tempfile
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from helpers import QuietHandler, write_fixture  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"
FIXTURE = FIXTURES / "v2.2-storage.json"
EXPECTED = FIXTURES / "v2.2-expected.json"

COLLECT = """() => {
  const json = value => JSON.parse(JSON.stringify(value));
  const raw = key => localStorage.getItem(key);
  return {
    workspace: activeWorkspace,
    personal: json(personalGroups(groups)),
    teamShown: groups.filter(sun => sun.team).map(sun => sun.id),
    routines: json(routines),
    rdpPresets: json(rdpPresets),
    source: activeMapSource,
    warning: storageWarning,
    undo: json(loadUndoRecord()),
    history: loadHistory().map(entry => ({ time: entry.time, label: entry.label, suns: entry.groups.length,
      routines: (entry.routines || []).length, rdpPresets: (entry.rdpPresets || []).length })),
    storedMap: raw(MAP_STORAGE_KEY),
  };
}"""

COLLECT_SHARED = """() => {
  const json = value => JSON.parse(JSON.stringify(value));
  return {
    preferences: { theme: activeTheme, fontSize: activeFontSize, animations: animationsEnabled,
      alwaysShowMoons, rdpLaunch: rdpLaunchMode, quickBar: showQuickBar, siteIcons: showSiteIcons,
      galaxyView, backupReminders: readBooleanPreference('orbit:backup-reminders', true),
      htmlTheme: document.documentElement.dataset.theme || '', htmlFontSize: document.documentElement.dataset.fontSize || '' },
    workspaces: json(loadWorkspaces()),
    recent: json(loadRecent()),
    variables: json(loadVariables()),
    offered: json(readOffered()),
    teamFavorites: [...readStoredSet('orbit:team-favorites')],
    teamHidden: [...readStoredSet('orbit:team-hidden')],
    teamSeen: JSON.parse(localStorage.getItem('orbit:team-seen:v1') || 'null'),
    backup: json(readBackupState()),
  };
}"""


def snapshot(page):
    return page.evaluate("""() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('orbit:'))
                            .sort().map(k => [k, localStorage.getItem(k)]))""")


def collect(page, url, fixture):
    """Load the fixture into a fresh page and read back what Orbit makes of it."""
    page.goto(url, wait_until="load")
    page.evaluate("localStorage.clear()")
    page.evaluate("data => { for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v); }", fixture["storage"])
    page.reload(wait_until="load")
    page.locator(".home-view, .galaxy-list").first.wait_for()
    page.wait_for_timeout(300)  # the team map loads asynchronously
    result = {"shared": page.evaluate(COLLECT_SHARED), "workspaces": {}}
    after_load = snapshot(page)
    result["storageChangedByLoading"] = sorted(k for k in set(after_load) | set(fixture["storage"])
                                               if after_load.get(k) != fixture["storage"].get(k))
    for workspace in ("main", "home", "broken"):
        page.locator("#workspace-switch").select_option(workspace)
        page.wait_for_timeout(200)
        state = page.evaluate(COLLECT)
        # The stored text must survive loading untouched, even when 2.2.1 rejects it.
        state["storedMapUnchanged"] = state.pop("storedMap") == fixture["storage"].get(
            "orbit:map:v1" if workspace == "main" else f"orbit:map:v1:{workspace}")
        result["workspaces"][workspace] = state
    page.locator("#workspace-switch").select_option("main")
    result["storageChangedBySwitching"] = sorted(k for k, v in snapshot(page).items() if after_load.get(k) != v)
    return result


def diff(expected, actual, path=""):
    """Every place two JSON values differ, as readable paths."""
    if type(expected) is not type(actual):
        return [f"{path or '<root>'}: expected {json.dumps(expected)[:120]}, got {json.dumps(actual)[:120]}"]
    if isinstance(expected, dict):
        out = []
        for key in sorted(set(expected) | set(actual)):
            if key not in actual:
                out.append(f"{path}.{key}: missing")
            elif key not in expected:
                out.append(f"{path}.{key}: unexpected")
            else:
                out += diff(expected[key], actual[key], f"{path}.{key}")
        return out
    if isinstance(expected, list):
        if len(expected) != len(actual):
            return [f"{path}: expected {len(expected)} items, got {len(actual)}"]
        return [line for i, (e, a) in enumerate(zip(expected, actual)) for line in diff(e, a, f"{path}[{i}]")]
    return [] if expected == actual else [f"{path}: expected {json.dumps(expected)[:120]}, got {json.dumps(actual)[:120]}"]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--record", action="store_true", help="Write the expected results (run on 2.2.1 only)")
    args = parser.parse_args()
    fixture = json.loads(FIXTURE.read_text())
    with tempfile.TemporaryDirectory() as directory, sync_playwright() as playwright:
        folder = write_fixture(directory, fixture["links"])
        (folder / "team.json").write_text(json.dumps(fixture["team"]))
        (folder / "team-data.js").write_text("window.ORBIT_TEAM_DATA = " + json.dumps(fixture["team"]) + ";\n")
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(folder)))
        Thread(target=server.serve_forever, daemon=True).start()
        browser = playwright.chromium.launch()
        results = {}
        try:
            for mode, url in (("file", (folder / "index.html").as_uri()),
                              ("server", f"http://127.0.0.1:{server.server_port}/index.html")):
                context = browser.new_context(viewport={"width": 1920, "height": 1080})
                results[mode] = collect(context.new_page(), url, fixture)
                context.close()
        finally:
            browser.close()
            server.shutdown()
    problems = [f"file vs server mode {line}" for line in diff(results["file"], results["server"])]
    if args.record:
        if problems:
            print("\n".join(problems))
            sys.exit("Not recorded: file and server mode disagree.")
        EXPECTED.write_text(json.dumps(results["file"], indent=2, ensure_ascii=False) + "\n")
        print(f"recorded {EXPECTED.relative_to(EXPECTED.parents[2])}")
        return
    expected = json.loads(EXPECTED.read_text())
    for mode in ("file", "server"):
        problems += [f"{mode} mode {line}" for line in diff(expected, results[mode])]
    if problems:
        print("\n".join(f"FAIL {line}" for line in problems))
        sys.exit(1)
    print("PASS data compatibility: the 2.2 fixture reads back as recorded, in file and server mode")


if __name__ == "__main__":
    main()
