"""Data generation checks for links and bundled workspaces."""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from helpers import ROOT, check


def run(directory):
    return subprocess.run([sys.executable, "sync.py"], cwd=directory, text=True, capture_output=True)


def main():
    with tempfile.TemporaryDirectory(prefix="orbit-sync-") as temp:
        root = Path(temp)
        shutil.copy2(ROOT / "sync.py", root / "sync.py")
        shutil.copy2(ROOT / "links.json", root / "links.json")
        (root / "workspaces").mkdir()
        shutil.copy2(ROOT / "workspaces/dev-toolbox.json", root / "workspaces/dev-toolbox.json")
        result = run(root)
        check(result.returncode == 0, f"sync.py writes valid maps: {result.stderr}")
        expected = json.loads((root / "workspaces/dev-toolbox.json").read_text())
        generated = (root / "workspaces-data.js").read_text().split("window.ORBIT_WORKSPACES = ", 1)[1]
        check(json.loads(generated.removesuffix(";\n")) == [{"id": "dev-toolbox", "name": expected["name"],
              "map": {key: value for key, value in expected.items() if key != "name"}}], "generated workspace data matches source")

        addresses = []
        for sun in expected["groups"]:
            for planet in sun["links"]:
                if planet.get("type") != "group":
                    addresses.append(planet["url"])
                addresses.extend(moon["url"] for moon in planet.get("moons", []))
        check(bool(addresses) and len(set(addresses)) == len(addresses), "default workspace destinations are nonempty and unique")

        (root / "workspaces/dev-toolbox.json").unlink()
        result = run(root)
        check(result.returncode == 0 and not (root / "workspaces-data.js").exists(), "empty workspace folder removes generated file")

        (root / "workspaces").mkdir(exist_ok=True)
        shutil.copy2(ROOT / "workspaces/dev-toolbox.json", root / "workspaces/main.json")
        result = run(root)
        check(result.returncode != 0 and "Invalid workspace id" in result.stderr, "reserved workspace ids are rejected")
    print("PASS sync workspace data")


if __name__ == "__main__":
    main()
