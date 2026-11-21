"""Write tests/fixtures/v2.2-storage.json: a browser's worth of Orbit 2.2 saved data.

Synthetic data only (never a real browser's). It covers every storage key
2.2.1 uses, three workspaces (Main, an old-format one, and one whose map 2.2.1
rejects), a team map, routines, presets, placeholders, and values stored in
older or invalid forms. tests/data_compat_check.py loads it.

    python tests/make_v22_fixture.py
"""

import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "fixtures" / "v2.2-storage.json"
DAY = 24 * 60 * 60 * 1000
T0 = 1_763_600_000_000  # 2025-11-20, a fixed time so the file never changes

BUNDLED = {"groups": [
    {"id": "bundled", "name": "Bundled", "description": "From links.json", "color": "#79d9f8", "links": [
        {"name": "Example", "url": "https://example.test/", "moons": []}]},
]}

TEAM = {"groups": [
    {"id": "ops", "name": "Ops", "description": "Team links", "color": "#f8d779", "links": [
        {"name": "Status", "url": "https://status.example.test/", "moons": []},
        {"name": "Runbook", "url": "https://runbook.example.test/", "moons": []}]},
    {"id": "hidden-team", "name": "Hidden team sun", "description": "", "color": "#cccccc", "links": []},
]}

PROFILE = "full address:s:lab1\r\nscreen mode id:i:2\r\nsession bpp:i:32\r\n"

# Main: the map as 2.2.1 writes it (already normalized), using every optional field.
MAIN_MAP = {
    "groups": [
        {"id": "work", "name": "Work", "description": "Daily tools", "color": "#79d9f8", "icon": "🛠️", "links": [
            {"name": "Jira", "url": "https://jira.example.test/browse/{ticket}", "tags": ["daily", "tickets"],
             "favorite": True, "note": "Use the sprint board", "moons": [
                 {"name": "Board", "url": "https://jira.example.test/board", "tags": ["daily"]}]},
            {"name": "Docs", "url": "https://docs.example.test/", "moons": []},
        ]},
        {"id": "labs", "name": "Labs", "description": "", "color": "#a979f8", "links": [
            {"name": "lab1", "type": "rdp", "host": "lab1", "rdpProfile": PROFILE, "moons": [
                {"name": "lab1 full screen", "type": "rdp", "host": "lab1:3390", "rdpPreset": "full-screen"}]},
        ]},
    ],
    "routines": [
        {"id": "morning", "name": "Morning", "links": [
            {"key": "https://docs.example.test", "name": "Docs"},
            {"key": "https://status.example.test", "name": "Status"},
            {"key": "https://gone.example.test", "name": "No longer on the map"}],
         "schedule": {"time": "08:00", "days": [1, 2, 3, 4, 5]}},
        {"id": "evening", "name": "Evening", "links": [{"key": "https://jira.example.test/board", "name": "Board"}]},
    ],
    "rdpPresets": [{"id": "full-screen", "name": "Full screen", "settings": "screen mode id:i:2\r\nuse multimon:i:1"}],
}

# Home: an older export, with fields missing or in looser forms that 2.2.1 normalizes on load.
HOME_MAP = {"groups": [
    {"name": "Home stuff", "links": [
        {"name": "Mail", "url": " https://mail.example.test/ ", "tags": "Personal, personal",
         "moons": [{"name": "Calendar", "url": "https://calendar.example.test/"}]},
        {"name": "News", "url": "https://news.example.test/", "favorite": "yes", "note": "   "},
    ]},
    {"name": "Home stuff", "color": "#123456", "links": []},
]}

# Broken: a map 2.2.1 refuses (color null), so it loads as empty with a warning.
BROKEN_MAP = {"groups": [{"id": "bad", "name": "Bad", "color": None, "links": []}]}

STORAGE = {
    "orbit:workspaces:v1": [{"id": "main", "name": "Main"}, {"id": "home", "name": "Home"},
                            {"id": "broken", "name": "Broken"}],
    "orbit:workspace": "main",
    "orbit:map:v1": MAIN_MAP,
    "orbit:map:v1:home": HOME_MAP,
    "orbit:map:v1:broken": BROKEN_MAP,
    "orbit:undo-removal:v1": {"kind": "planet", "index": 1, "label": "Wiki",
                              "item": {"name": "Wiki", "url": "https://wiki.example.test/", "moons": []},
                              "sunId": "work", "planetUrl": None, "planetHost": None, "planetName": None,
                              "planetIndex": None},
    "orbit:undo-removal:v1:home": {"kind": "sun", "index": 0, "label": "Old sun",
                                   "item": {"id": "old", "name": "Old sun", "description": "", "color": "#79d9f8",
                                            "links": []}},
    "orbit:history:v1": [
        {"time": T0 - DAY, "label": "Renamed Docs", "groups": MAIN_MAP["groups"],
         "routines": MAIN_MAP["routines"], "rdpPresets": MAIN_MAP["rdpPresets"]},
        {"time": T0 - 2 * DAY, "label": "Added Labs", "groups": MAIN_MAP["groups"][:1]},
        {"label": "Ignored: no groups list"},
    ],
    "orbit:history:v1:home": [{"time": T0 - DAY, "label": "Imported", "groups": []}],
    "orbit:backup:v1": {"main": {"changes": 3, "since": T0 - 2 * DAY},
                        "home": {"changes": 0, "lastExport": T0 - DAY},
                        "broken": {"changes": 1, "since": T0, "snoozeUntil": T0 + 3 * DAY}},
    # Preferences: stored as strings; one invalid value (font size) falls back to the default.
    "orbit:theme": "auburn",
    "orbit:animations": "false",
    "orbit:always-show-moons": "true",
    "orbit:font-size": "huge",
    "orbit:rdp-launch": "client",
    "orbit:quick-bar": "false",
    "orbit:galaxy-view": "list",
    "orbit:site-icons": "true",
    "orbit:backup-reminders": "false",
    "orbit:recent:v1": [{"key": "https://docs.example.test", "name": "Docs", "time": T0},
                        {"key": "rdp:lab1", "name": "lab1", "time": T0 - 1000},
                        {"name": "no key, ignored"}],
    "orbit:variables:v1": {"ticket": "ABC-123"},
    "orbit:routine-offered:v1": {"morning": "2025-11-19"},
    "orbit:team-favorites": ["https://status.example.test"],
    "orbit:team-hidden": ["team:hidden-team"],  # stored with the team: prefix (team.js:57, tools.js:460)
    "orbit:team-seen:v1": [{"key": "https://status.example.test", "name": "Status"},
                           {"key": "https://old.example.test", "name": "Removed from the team map"}],
}


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fixture = {
        "about": "Synthetic Orbit 2.2 browser data for the rewrite's data-compatibility check. "
                 "Written by tests/make_v22_fixture.py; do not edit by hand.",
        "links": BUNDLED,
        "team": TEAM,
        # localStorage holds strings: objects are stored as JSON, preferences as plain strings.
        "storage": {key: value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
                    for key, value in STORAGE.items()},
    }
    OUT.write_text(json.dumps(fixture, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(OUT.parents[2])} ({len(fixture['storage'])} keys)")


if __name__ == "__main__":
    main()
