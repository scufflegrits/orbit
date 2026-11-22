#!/bin/bash
# The Open-all hand check in visible Edge (pop-up allowance, docs/TEST_MATRIX.md F02).
# Playwright's Chromium never blocks pop-ups, so a person has to confirm this one.
#
#   scripts/edge/open-all-check.sh start     open Edge in the user's Remote Desktop session on an
#                                            Orbit with one planet and two moons (local test pages)
#   scripts/edge/open-all-check.sh observe   list Edge's open tabs and Orbit's Open-all notice
#   scripts/edge/open-all-check.sh stop      close everything and clean up the VM
#
# The person then: clicks Lab, then Open all on Docs (expect one tab, the other two reported
# blocked); allows pop-ups from the address bar's blocked pop-up icon; clicks Open all again
# (expect all three tabs). The user must be signed in to the VM over Remote Desktop.
set -u
source "$(dirname "$0")/env.sh"
cd "$REPO"
STATE="$REPO/.artifacts/edge/open-all"
PORT=9334
SITE_PORT=8779

case ${1:-} in
  start)
    rm -rf "$STATE" && mkdir -p "$STATE/orbit" "$STATE/site"
    vm 'query user' | grep -q Active || { echo "Nobody is signed in to the VM over Remote Desktop." >&2; exit 1; }
    "$PY" - "$STATE" <<'EOF' || exit 1
import json, sys
from pathlib import Path
sys.path.insert(0, "tests")
from helpers import write_fixture
site = "http://127.0.0.1:8779"
data = {"groups": [{"id": "lab", "name": "Lab", "color": "#79d9f8", "links": [
    {"name": "Docs", "url": f"{site}/one.html", "moons": [
        {"name": "Guide", "url": f"{site}/two.html"}, {"name": "API", "url": f"{site}/three.html"}]}]}]}
out = Path(sys.argv[1])
write_fixture(out / "orbit", data)
for i, name in enumerate(["one", "two", "three"], 1):
    (out / "site" / f"{name}.html").write_text(f"<title>Orbit test tab {i}</title><h1>Orbit test tab {i}</h1>")
EOF
    cat > "$STATE/setup.ps1" <<'PS'
$t = 'C:\orbit-visible-test'; if (Test-Path $t) { Remove-Item -Recurse -Force $t }
Move-Item "$HOME\orbit-visible-data" $t
Write-Output ("{0}: {1} files" -f $t, (Get-ChildItem $t).Count)
PS
    to_vm -r "$STATE/orbit" orbit-visible-data && run_ps "$STATE/setup.ps1" || exit 1
    "$PY" -m http.server $SITE_PORT --bind 127.0.0.1 --directory "$STATE/site" > "$STATE/site.log" 2>&1 &
    echo $! > "$STATE/site.pid"
    ssh "${SSH_OPTS[@]}" -N -L 127.0.0.1:$PORT:127.0.0.1:$PORT -R 127.0.0.1:$SITE_PORT:127.0.0.1:$SITE_PORT "$VM" > "$STATE/tunnel.log" 2>&1 &
    echo $! > "$STATE/tunnel.pid"
    # A fresh profile, so pop-ups start blocked.
    run_ps "$EDGE_DIR/interactive.ps1" -Name Visible -Exe "\"$EDGE_EXE\"" \
      -Arguments "\"--remote-debugging-port=$PORT --user-data-dir=C:\\orbit-visible-profile --no-first-run --no-default-browser-check --start-maximized file:///C:/orbit-visible-test/index.html\""
    wait_for_edge $PORT || exit 1
    echo "Edge is open in the Remote Desktop session. In it: click Lab, then Open all on Docs."
    echo "Expect one tab and two reported blocked; allow pop-ups, Open all again, and expect three tabs."
    echo "Then run: $0 observe, and $0 stop." ;;
  observe)
    "$PY" - $PORT <<'EOF'
import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{sys.argv[1]}")
    pages = [page for context in browser.contexts for page in context.pages]
    for page in pages:
        print("tab:", page.url, "|", page.title())
    orbit = next((page for page in pages if page.url.startswith("file:///C:/orbit-visible-test")), None)
    if orbit:
        print("Open-all notice:", orbit.evaluate(
            "document.querySelector('#open-all-notice')?.hidden === false ? document.querySelector('#open-all-notice').textContent : '(none)'"))
EOF
    ;;
  stop)
    for f in site tunnel; do [ -f "$STATE/$f.pid" ] && kill "$(cat "$STATE/$f.pid")" 2>/dev/null; done
    cleanup_vm
    rm -rf "$STATE" ;;
  *) sed -n '2,13p' "$0"; exit 2 ;;
esac
