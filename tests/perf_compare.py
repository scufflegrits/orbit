"""Measure Orbit's speed with the fixed recipe in REWRITE_PLAN.md ("Performance recipe").

    python tests/perf_compare.py --baseline                 # 2.2.1 alone, full recipe; records medians
    python tests/perf_compare.py --against WORKTREE         # 2.2.1 vs this checkout, full recipe (phase 8)
    python tests/perf_compare.py --against WORKTREE --quick # phase-end check: 2 warm-up, 5 measured runs

A version is a git ref (tag or commit) or WORKTREE (this checkout's files,
including uncommitted edits and new files that git doesn't ignore). Each version is copied into its own
fixture folder with the committed perf map, then measured in file mode in one
headless Chromium at 1920x1080, alternating versions run by run.

Measurements, per run (a fresh page each time, storage cleared):
- first render: navigation start to the first animation frame where every
  Galaxy sun (10 personal + 2 team) is in the page.
- Quick find per keystroke: the five committed queries typed one key at a time;
  from a capture-phase keydown on the document to the next animation-frame
  callback after the document's bubble-phase input listener (which runs after
  Quick find's own handler). Animation-frame callbacks run before painting, so
  this is a consistent measuring point, not rendering time. The run's value is
  the median over its keystrokes.
The result for each version is the median over runs, with the middle 50% of runs.
"""

import argparse
import json
import shutil
import statistics
import subprocess
import sys
import tarfile
import tempfile
import time
from io import BytesIO
from pathlib import Path

from playwright.sync_api import sync_playwright

TESTS = Path(__file__).resolve().parent
ROOT = TESTS.parent
FIXTURES = TESTS / "fixtures"
OUT = ROOT / ".artifacts" / "perf"
BASELINE_REF = "v2.2.1"
KEY_TIMEOUT_MS = 2000

PROBE = """
(() => {
  window.__perf = { firstRender: null, keys: [], keyStart: null };
  const expected = %d;
  const poll = () => {
    if (document.querySelectorAll('.home-hub').length >= expected) {
      window.__perf.firstRender = performance.now();
    } else {
      requestAnimationFrame(poll);
    }
  };
  requestAnimationFrame(poll);
  document.addEventListener('keydown', () => { window.__perf.keyStart = performance.now(); }, true);
  document.addEventListener('input', () => {
    const start = window.__perf.keyStart;
    if (start === null) return;
    window.__perf.keyStart = null;
    requestAnimationFrame(() => window.__perf.keys.push(performance.now() - start));
  });
})();
"""


def materialize(ref, folder):
    """Copy a version's tracked files into folder."""
    folder.mkdir(parents=True)
    if ref == "WORKTREE":
        # Tracked files plus new ones not yet committed (but never ignored files).
        listing = ["git", "ls-files", "--cached", "--others", "--exclude-standard"]
        for name in subprocess.run(listing, cwd=ROOT, capture_output=True, text=True, check=True).stdout.split("\n"):
            source = ROOT / name
            if name and source.is_file() and not name.startswith("tests/"):
                (folder / name).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, folder / name)
    else:
        archive = subprocess.run(["git", "archive", "--format=tar", ref], cwd=ROOT, capture_output=True, check=True).stdout
        with tarfile.open(fileobj=BytesIO(archive)) as tar:
            tar.extractall(folder, members=[m for m in tar.getmembers() if not m.name.startswith("tests/")], filter="data")
    data = json.loads((FIXTURES / "perf-map.json").read_text())
    (folder / "links.json").write_text(json.dumps(data["personal"]))
    (folder / "links-data.js").write_text("window.ORBIT_DATA = " + json.dumps(data["personal"]) + ";\n")
    (folder / "team-data.js").write_text("window.ORBIT_TEAM_DATA = " + json.dumps(data["team"]) + ";\n")
    return folder / "index.html", len(data["personal"]["groups"]) + len(data["team"]["groups"])


def bundle_bytes(folder):
    """Bytes of the app's own scripts: everything index.html loads except the data files."""
    import re
    html = (folder / "index.html").read_text()
    names = [n for n in re.findall(r'<script src="([^"]+)"', html) if n not in ("links-data.js", "workspaces-data.js", "team-data.js")]
    return sum((folder / n).stat().st_size for n in names if (folder / n).exists())


def measure(browser, index, suns, queries):
    context = browser.new_context(viewport={"width": 1920, "height": 1080})
    context.add_init_script(PROBE % suns)
    page = context.new_page()
    page.goto(index.as_uri(), wait_until="load")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="load")
    page.wait_for_function("window.__perf.firstRender !== null", timeout=10000)
    first = page.evaluate("window.__perf.firstRender")
    find = page.locator("#quick-find")
    keys = []
    for query in queries:
        find.click()
        # Clear without timing: no keydown, so the probe ignores the input event.
        page.evaluate("document.querySelector('#quick-find').value = ''; window.__perf.keyStart = null")
        for char in query:
            count = page.evaluate("window.__perf.keys.length")
            page.keyboard.type(char)
            try:
                page.wait_for_function(f"window.__perf.keys.length > {count}", timeout=KEY_TIMEOUT_MS)
            except Exception as error:
                raise RuntimeError(f"no measurement within {KEY_TIMEOUT_MS} ms for {char!r} in {query!r}") from error
        keys += page.evaluate("window.__perf.keys.splice(0)")
    context.close()
    return first, statistics.median(keys)


def summary(values):
    ordered = sorted(values)
    quarter = statistics.quantiles(ordered, n=4) if len(ordered) >= 2 else [ordered[0]] * 3
    return {"median": round(statistics.median(ordered), 2), "q1": round(quarter[0], 2), "q3": round(quarter[2], 2),
            "runs": len(ordered)}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--baseline", action="store_true", help=f"Measure {BASELINE_REF} alone and record it")
    parser.add_argument("--against", help="Version to compare with the baseline: a git ref or WORKTREE")
    parser.add_argument("--quick", action="store_true", help="2 warm-up and 5 measured runs (informs, never fails)")
    args = parser.parse_args()
    if not args.baseline and not args.against:
        parser.error("use --baseline or --against")
    warmup, runs = (2, 5) if args.quick else (3, 20)
    versions = [BASELINE_REF] + ([] if args.baseline else [args.against])
    queries = json.loads((FIXTURES / "perf-queries.json").read_text())["queries"]
    OUT.mkdir(parents=True, exist_ok=True)
    results = {}
    with tempfile.TemporaryDirectory() as directory, sync_playwright() as playwright:
        folders = {v: materialize(v, Path(directory) / f"v{i}") for i, v in enumerate(versions)}
        browser = playwright.chromium.launch()
        samples = {v: {"firstRender": [], "keystroke": []} for v in versions}
        try:
            for round_ in range(warmup + runs):
                for version in versions:  # alternate A, B, A, B...
                    index, suns = folders[version]
                    first, key = measure(browser, index, suns, queries)
                    if round_ >= warmup:
                        samples[version]["firstRender"].append(first)
                        samples[version]["keystroke"].append(key)
            for version in versions:
                results[version] = {"firstRenderMs": summary(samples[version]["firstRender"]),
                                    "keystrokeMs": summary(samples[version]["keystroke"]),
                                    "scriptBytes": bundle_bytes(folders[version][0].parent)}
        finally:
            browser.close()
    record = {"when": time.strftime("%Y-%m-%d %H:%M"), "browser": "playwright chromium headless 1920x1080",
              "warmup": warmup, "runs": runs, "queries": queries, "results": results}
    name = "baseline" if args.baseline else ("quick" if args.quick else "full")
    (OUT / f"{name}.json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps(record, indent=2))
    if args.baseline:
        return
    base, new = results[BASELINE_REF], results[args.against]
    failed = []
    for metric in ("firstRenderMs", "keystrokeMs"):
        a, b = base[metric]["median"], new[metric]["median"]
        limit = 1.20 if args.quick else 1.10
        ok = b <= a * limit or b - a <= 5
        print(f"{'OK  ' if ok else 'SLOW'} {metric}: {BASELINE_REF} {a} ms, {args.against} {b} ms ({(b / a - 1) * 100:+.0f}%)")
        if not ok:
            failed.append(metric)
    size_ok = new["scriptBytes"] <= base["scriptBytes"] * 1.10
    print(f"{'OK  ' if size_ok else 'BIG '} scriptBytes: {base['scriptBytes']} vs {new['scriptBytes']}")
    if not size_ok:
        failed.append("scriptBytes")
    if failed and not args.quick:
        sys.exit(f"Slower than allowed: {', '.join(failed)}. Run once more; fail only if both runs fail.")


if __name__ == "__main__":
    main()
