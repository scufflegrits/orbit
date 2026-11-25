#!/bin/bash
# Run Orbit's browser suites in Edge on the Windows test VM, in file and server mode.
#
#   scripts/edge/run.sh                       every suite, headless Edge
#   scripts/edge/run.sh --visible             in a normal Edge window in the user's Remote Desktop
#                                             session (they must be signed in; see docs/HANDOFF.md)
#   scripts/edge/run.sh --only features,drag  only these suites: drag, features, sizes, pending,
#                                             services, compat
#   scripts/edge/run.sh --only features --check f25 --repeat 3
#                                             one features check, three times (to tell a flaky wait
#                                             from a real failure)
#   scripts/edge/run.sh --mode file           file mode only (or server)
#
# Fixtures are written from this checkout's tests, copied to C:\orbit-<suite>-test,
# and served from this machine for server mode over a reverse SSH tunnel. The VM is
# cleaned up afterwards, also when the run fails or is interrupted. Logs go to
# .artifacts/edge/<time>/. Exits non-zero if any run failed.
set -u
source "$(dirname "$0")/env.sh"

SUITES="drag,features,sizes,pending,services,compat,defaults"
VISIBLE=0; MODES="file server"; CHECK=""; REPEAT=1; TIMEOUT=600
while [ $# -gt 0 ]; do
  case $1 in
    --visible) VISIBLE=1 ;;
    --only) SUITES=$2; shift ;;
    --mode) MODES=$2; shift ;;
    --check) CHECK=$2; shift ;;
    --repeat) REPEAT=$2; shift ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
  shift
done
wants() { [[ ",$SUITES," == *",$1,"* ]]; }
OUT="$REPO/.artifacts/edge/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
echo "logs: $OUT"

PIDS=()
finish() {
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null; done
  cleanup_vm
}
trap finish EXIT

# Fixtures. Each suite gets a folder and, for server mode, a port.
declare -A PORT=([drag]=8772 [sizes]=8776 [pending]=8777 [services]=8778 [compat]=8779 [defaults]=8780)
declare -A FOLDER=([drag]=drag [features]=feat [sizes]=size [pending]=pend [services]=svc [compat]=compat [defaults]=defaults)
cd "$REPO"
for suite in drag features sizes pending services compat defaults; do
  wants $suite || continue
  dir="$OUT/fixture-${FOLDER[$suite]}"; mkdir -p "$dir"
  case $suite in
    drag) "$PY" tests/drag_drop.py --phase 2 --write-fixture "$dir" ;;
    features) "$PY" tests/features.py --write-fixture "$dir" --target http://127.0.0.1:8774 ;;
    sizes) "$PY" tests/orbit_sizes.py --write-fixture "$dir" ;;
    services) "$PY" tests/services_check.py --write-fixture "$dir" ;;
    compat) "$PY" tests/data_compat_check.py --write-fixture "$dir" ;;
    defaults) "$PY" tests/default_workspaces.py --write-fixture "$dir" ;;
    pending) (cd tests && "$PY" -c "import sys; sys.argv=['x']; from pending_checks import DATA; from helpers import write_fixture; write_fixture('$dir', DATA)") ;;
  esac || { echo "could not write the $suite fixture" >&2; exit 1; }
done

# Copy them to the VM.
cat > "$OUT/setup.ps1" <<'PS'
$ErrorActionPreference = 'Stop'
foreach ($data in Get-ChildItem $HOME -Directory -Filter 'orbit-*-data') {
  $t = 'C:\' + ($data.Name -replace '-data$', '-test')
  if (Test-Path $t) { Remove-Item -Recurse -Force $t }
  Move-Item $data.FullName $t
  Write-Output ("{0}: {1} files" -f $t, (Get-ChildItem $t).Count)
}
PS
for suite in drag features sizes pending services compat defaults; do
  wants $suite || continue
  to_vm -r "$OUT/fixture-${FOLDER[$suite]}" "orbit-${FOLDER[$suite]}-data" || exit 1
done
run_ps "$OUT/setup.ps1" || exit 1

# Servers for server mode, and the tunnel: Edge's port forward, the servers back.
TUNNEL=(-L "127.0.0.1:$CDP_PORT:127.0.0.1:$CDP_PORT")
if wants features; then
  "$PY" "$EDGE_DIR/serve_features.py" > "$OUT/serve-features.log" 2>&1 & PIDS+=($!)
  TUNNEL+=(-R 127.0.0.1:8774:127.0.0.1:8774 -R 127.0.0.1:8775:127.0.0.1:8775)
fi
for suite in drag sizes pending services compat defaults; do
  wants $suite || continue
  PIDS+=("$(serve_dir "${PORT[$suite]}" "$OUT/fixture-${FOLDER[$suite]}" "$OUT/serve-$suite.log")")
  TUNNEL+=(-R "127.0.0.1:${PORT[$suite]}:127.0.0.1:${PORT[$suite]}")
done

PROFILE='C:\orbit-edge-profile'
if [ $VISIBLE = 1 ]; then
  vm 'query user' | grep -q Active || { echo "Nobody is signed in to the VM over Remote Desktop; a visible run needs that session." >&2; exit 1; }
  ssh "${SSH_OPTS[@]}" -N "${TUNNEL[@]}" "$VM" > "$OUT/tunnel.log" 2>&1 & PIDS+=($!)
  # SSH can't open windows on the signed-in desktop; a one-off interactive scheduled task can.
  run_ps "$EDGE_DIR/interactive.ps1" -Name Visible -Exe "\"$EDGE_EXE\"" \
    -Arguments "\"--remote-debugging-port=$CDP_PORT --user-data-dir=$PROFILE --no-first-run --no-default-browser-check --window-size=1920,1080 about:blank\""
else
  ssh "${SSH_OPTS[@]}" "${TUNNEL[@]}" "$VM" \
    "\"$EDGE_EXE\" --headless=new --remote-debugging-port=$CDP_PORT --user-data-dir=$PROFILE about:blank" > "$OUT/edge.log" 2>&1 & PIDS+=($!)
fi
wait_for_edge || exit 1

# The runs.
CDP=(--cdp "http://127.0.0.1:$CDP_PORT")
FAILED=0
run() {
  local name=$1; shift
  for n in $(seq 1 "$REPEAT"); do
    local log="$OUT/$name.log"; [ "$REPEAT" -gt 1 ] && log="$OUT/$name-$n.log"
    timeout $TIMEOUT "$PY" "$@" "${CDP[@]}" > "$log" 2>&1
    local rc=$?
    [ $rc = 0 ] || FAILED=1
    printf '%-18s exit=%s  %s PASS lines; last: %s\n' "$name$([ "$REPEAT" -gt 1 ] && echo " #$n")" "$rc" \
      "$(grep -c '^PASS' "$log")" "$(tail -1 "$log" | cut -c1-110)"
  done
}
only=(); [ -n "$CHECK" ] && only=(--only "$CHECK")
for mode in $MODES; do
  for suite in drag features sizes pending compat services defaults; do
    wants $suite || continue
    if [ "$mode" = file ]; then url="file:///C:/orbit-${FOLDER[$suite]}-test/index.html"
    elif [ $suite = features ]; then url="http://127.0.0.1:8775/index.html"
    else url="http://127.0.0.1:${PORT[$suite]}/index.html"; fi
    case $suite in
      drag) run "drag-$mode" tests/drag_drop.py --phase 2 --url "$url" ;;
      features) extra=(); [ "$mode" = server ] && extra=(--server-mode)
        run "features-$mode" tests/features.py --url "$url" --target http://127.0.0.1:8774 "${extra[@]}" "${only[@]}" ;;
      sizes) run "sizes-$mode" tests/orbit_sizes.py --url "$url" ;;
      pending) run "pending-$mode" tests/pending_checks.py --url "$url" ;;
      compat) run "compat-$mode" tests/data_compat_check.py --url "$url" ;;
      services) run "services-$mode" tests/services_check.py --url "$url" ;;
      defaults) run "defaults-$mode" tests/default_workspaces.py --url "$url" --server-mode ;;
    esac
  done
done
[ $FAILED = 0 ] && echo "All Edge runs passed." || echo "Some Edge runs failed; see $OUT."
exit $FAILED
