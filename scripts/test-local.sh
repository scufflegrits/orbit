#!/bin/bash
# Run every local check: types, layers, bundle, node tests, and every browser suite in
# Playwright's Chromium (file and server mode where the runner does both). Takes about
# ten minutes. Logs go to .artifacts/local/<time>/; a summary is printed as it goes.
# Exits non-zero if anything failed. Uses ORBIT_PYTHON, else ~/.venv/bin/python, else python3.
set -u
REPO=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO"
if [ -n "${ORBIT_PYTHON:-}" ]; then PY=$ORBIT_PYTHON
elif [ -x "$HOME/.venv/bin/python" ]; then PY=$HOME/.venv/bin/python
else PY=python3; fi
OUT="$REPO/.artifacts/local/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
echo "logs: $OUT"
FAILED=0
step() {
  local name=$1; shift
  local start; start=$(date +%s)
  "$@" > "$OUT/$name.log" 2>&1
  local rc=$?
  [ $rc = 0 ] || FAILED=1
  printf '%-10s exit=%s %4ss  %s\n' "$name" "$rc" "$(( $(date +%s) - start ))" \
    "$( if grep -q '^PASS' "$OUT/$name.log"; then echo "$(grep -c '^PASS' "$OUT/$name.log") PASS lines"
        elif grep -q '^ℹ pass' "$OUT/$name.log"; then grep -E '^ℹ (pass|fail) ' "$OUT/$name.log" | tr '\n' ' '
        else tail -1 "$OUT/$name.log" | cut -c1-80; fi )"
}
step types npm run -s check
step layers npm run -s check:layers
step bundle npm run -s check:bundle
step unit npm run -s test:unit
step matrix "$PY" tests/browser_matrix.py --milestone 19
step drag1 "$PY" tests/drag_drop.py --phase 1
step drag2 "$PY" tests/drag_drop.py --phase 2
step sizes "$PY" tests/orbit_sizes.py
step pending "$PY" tests/pending_checks.py
step features "$PY" tests/features.py
step services "$PY" tests/services_check.py
step modes "$PY" tests/mode_rules_check.py
step compat "$PY" tests/data_compat_check.py
step smoke "$PY" tests/release_smoke.py
step behavior node tests/behavior_check.mjs
[ $FAILED = 0 ] && echo "Everything passed." || echo "Something failed; see $OUT."
exit $FAILED
