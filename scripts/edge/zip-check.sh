#!/bin/bash
# Check a release zip (docs/RELEASING.md, step 5): list it, extract it to a fresh
# folder, and open it from file and through its own serve.py, in Chromium here and
# in headless Edge on the test VM. The extracted copies are deleted afterwards.
#
#   scripts/edge/zip-check.sh ../orbit-dist/orbit-3.0.1.zip
set -u
source "$(dirname "$0")/env.sh"
ZIP=$(realpath "${1:?usage: $0 path/to/orbit-<version>.zip}")
NAME=$(basename "$ZIP" .zip)
VERSION=${NAME#orbit-}
WORK=$(mktemp -d)
SERVE_PORT=8791
PIDS=()
finish() {
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null; done
  rm -rf "$WORK"
  cleanup_vm
}
trap finish EXIT

unzip -l "$ZIP"
unzip -Z1 "$ZIP" | grep -q '/workspaces/dev-toolbox.json$' || { echo "The zip has no default Dev Toolbox workspace map." >&2; exit 1; }
unzip -Z1 "$ZIP" | grep -q '/workspaces-data.js$' || { echo "The zip has no generated workspace data." >&2; exit 1; }
unzip -Z1 "$ZIP" | grep -q '/css/galaxy.css$' || { echo "The zip has no css/ folder (styles.css imports its parts from it)." >&2; exit 1; }
(cd "$WORK" && unzip -q "$ZIP") || exit 1
[ -f "$WORK/$NAME/index.html" ] || { echo "The zip has no $NAME/index.html." >&2; exit 1; }
FAILED=0
check() { "$PY" "$REPO/tests/release_zip_check.py" --version "$VERSION" "$@" || FAILED=1; }

(cd "$WORK/$NAME" && exec "$PY" serve.py --port $SERVE_PORT) > "$WORK/serve.log" 2>&1 & PIDS+=($!)
for _ in $(seq 1 20); do curl -s -o /dev/null "http://127.0.0.1:$SERVE_PORT/" && break; sleep 0.5; done
echo "Chromium:"
check --url "file://$WORK/$NAME/index.html"
check --url "http://127.0.0.1:$SERVE_PORT/index.html"

echo "Edge on the VM:"
cat > "$WORK/setup.ps1" <<'PS'
$t = 'C:\orbit-test'; if (Test-Path $t) { Remove-Item -Recurse -Force $t }
Move-Item "$HOME\orbit-zip-data" $t
Write-Output ("{0}: {1} files" -f $t, (Get-ChildItem $t -Recurse -File).Count)
PS
to_vm -r "$WORK/$NAME" orbit-zip-data && run_ps "$WORK/setup.ps1" || exit 1
ssh "${SSH_OPTS[@]}" -L "127.0.0.1:$CDP_PORT:127.0.0.1:$CDP_PORT" -R "127.0.0.1:$SERVE_PORT:127.0.0.1:$SERVE_PORT" "$VM" \
  "\"$EDGE_EXE\" --headless=new --remote-debugging-port=$CDP_PORT --user-data-dir=C:\\orbit-edge-profile about:blank" > "$WORK/edge.log" 2>&1 & PIDS+=($!)
wait_for_edge || exit 1
check --cdp "http://127.0.0.1:$CDP_PORT" --url "file:///C:/orbit-test/index.html"
check --cdp "http://127.0.0.1:$CDP_PORT" --url "http://127.0.0.1:$SERVE_PORT/index.html"

[ $FAILED = 0 ] && echo "The zip passed every check." || echo "The zip failed a check."
exit $FAILED
