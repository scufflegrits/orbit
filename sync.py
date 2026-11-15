"""Copy links.json into a browser-readable file for direct file:// use."""

import json
from pathlib import Path


def main():
    directory = Path(__file__).resolve().parent
    data = json.loads((directory / "links.json").read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("groups"), list):
        raise ValueError('links.json needs a "groups" array')
    output = "// Generated from links.json by sync.py. Edit links.json instead.\n"
    output += "window.ORBIT_DATA = " + json.dumps(data, ensure_ascii=True, indent=2) + ";\n"
    (directory / "links-data.js").write_text(output, encoding="utf-8")
    print("Updated links-data.js. Open index.html in your browser.")


if __name__ == "__main__":
    main()
