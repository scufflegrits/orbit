"""Copy links.json into a browser-readable file for direct file:// use.

Options:
  --team PATH   Also write team-data.js from a read-only team map JSON file.
  --no-team     Remove team-data.js, so no team map is shown.
  Workspaces in workspaces/*.json are validated and written to workspaces-data.js.
"""

import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlsplit


def read_map(path, label):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("groups"), list):
        raise ValueError(f'{label} needs a "groups" array')
    return data


def validate_workspace_id(value):
    if not isinstance(value, str) or len(value) > 40 or value in {"main", "unreadable"} or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value):
        raise ValueError(f"Invalid workspace id {value!r}; use a unique lowercase slug of up to 40 characters, other than main or unreadable")


def validate_workspace_map(data, label):
    if not isinstance(data, dict) or not isinstance(data.get("groups"), list):
        raise ValueError(f'{label} needs a "groups" array')
    used_ids = set()
    def destination(value, place, allow_group=False):
        if not isinstance(value, dict) or not isinstance(value.get("name"), str) or not value["name"].strip():
            raise ValueError(f"{label}: {place} needs a name and destination")
        kind = value.get("type")
        if kind == "group":
            if not allow_group:
                raise ValueError(f"{label}: {place} cannot be a group")
        elif kind == "rdp":
            host = value.get("host", "")
            match = re.fullmatch(r"([^:]+)(?::([0-9]{1,5}))?", host) if isinstance(host, str) else None
            if not match or not match[1] or len(match[1]) > 253 or any(
                    len(part) > 63 or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?", part, re.I)
                    for part in match[1].split(".")) or (match[2] and not 1 <= int(match[2]) <= 65535):
                raise ValueError(f"{label}: {place} needs a Remote Desktop computer name or IP address")
        elif kind not in (None, "web"):
            raise ValueError(f"{label}: {place} has an unsupported destination type")
        else:
            address = value.get("url")
            try:
                parsed = urlsplit(address)
                if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password or re.search(r"\{[^{}]*\}", address) is None and ("{" in address or "}" in address):
                    raise ValueError
            except (TypeError, ValueError):
                raise ValueError(f"{label}: {place} needs an http or https URL") from None
        moons = value.get("moons", [])
        if not isinstance(moons, list):
            raise ValueError(f"{label}: {value['name']} needs a moons array")
        for moon_index, moon in enumerate(moons, 1):
            destination(moon, f"Moon {moon_index} around {value['name']}")

    for index, sun in enumerate(data["groups"], 1):
        if not isinstance(sun, dict) or not isinstance(sun.get("name"), str) or not sun["name"].strip():
            raise ValueError(f"{label}: Sun {index} needs a name")
        color = sun.get("color", "#79d9f8")
        if not isinstance(color, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
            raise ValueError(f"{label}: {sun['name']} needs a six-digit hex color")
        if not isinstance(sun.get("links"), list):
            raise ValueError(f"{label}: {sun['name']} needs a planets array")
        sid = sun.get("id")
        if sid is not None and sid != "":
            if str(sid) in used_ids:
                raise ValueError(f"{label}: Duplicate sun ID: {sid}")
            used_ids.add(str(sid))
        for planet_index, planet in enumerate(sun["links"], 1):
            destination(planet, f"Planet {planet_index} in {sun['name']}", allow_group=True)
    if data.get("routines") is not None and not isinstance(data["routines"], list):
        raise ValueError(f"{label}: Routines need to be a list")
    if data.get("rdpPresets") is not None and not isinstance(data["rdpPresets"], list):
        raise ValueError(f"{label}: Remote Desktop presets need to be a list")


def main():
    parser = argparse.ArgumentParser(description="Write links-data.js (and optionally team-data.js).")
    parser.add_argument("--team", help="Path to a read-only team map JSON file")
    parser.add_argument("--no-team", action="store_true", help="Remove team-data.js")
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    data = read_map(directory / "links.json", "links.json")
    output = "// Generated from links.json by sync.py. Edit links.json instead.\n"
    output += "window.ORBIT_DATA = " + json.dumps(data, ensure_ascii=True, indent=2) + ";\n"
    (directory / "links-data.js").write_text(output, encoding="utf-8")
    print("Updated links-data.js. Open index.html in your browser.")
    workspace_dir = directory / "workspaces"
    bundled = []
    if workspace_dir.exists():
        ids = set()
        for path in sorted(workspace_dir.glob("*.json")):
            workspace_id = path.stem
            validate_workspace_id(workspace_id)
            if workspace_id in ids:
                raise ValueError(f"Duplicate workspace id: {workspace_id}")
            ids.add(workspace_id)
            raw = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                raise ValueError(f"{path.name} needs an object with a name and groups")
            name = raw.get("name")
            if not isinstance(name, str) or not name.strip() or len(name.strip()) > 40:
                raise ValueError(f"{path.name} needs a name of 1–40 characters")
            validate_workspace_map(raw, path.name)
            map_data = {key: value for key, value in raw.items() if key != "name"}
            bundled.append({"id": workspace_id, "name": name.strip(), "map": map_data})
    workspace_output = "// Generated from workspaces/*.json by sync.py. Edit those files instead.\n"
    workspace_output += "window.ORBIT_WORKSPACES = " + json.dumps(bundled, ensure_ascii=True, indent=2) + ";\n"
    workspace_data = directory / "workspaces-data.js"
    if bundled:
        workspace_data.write_text(workspace_output, encoding="utf-8")
        print("Updated workspaces-data.js.")
    elif workspace_data.exists():
        workspace_data.unlink()
        print("Removed workspaces-data.js.")
    team_file = directory / "team-data.js"
    if args.team:
        team = read_map(args.team, args.team)
        output = "// Generated by sync.py --team. Edit the team map file instead.\n"
        output += "window.ORBIT_TEAM_DATA = " + json.dumps(team, ensure_ascii=True, indent=2) + ";\n"
        team_file.write_text(output, encoding="utf-8")
        print(f"Updated team-data.js from {args.team}.")
    elif args.no_team and team_file.exists():
        team_file.unlink()
        print("Removed team-data.js.")


if __name__ == "__main__":
    main()
