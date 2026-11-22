#!/bin/bash
# Windows Remote Desktop helper checks B01, B02, and B07 (docs/TEST_MATRIX.md) on
# the test VM, against the helper scripts in windows/ at this commit. Stops
# without changes if the VM already has an Orbit registration. Leaves the VM
# as it was found. Exits non-zero if any check failed.
set -u
source "$(dirname "$0")/env.sh"
OUT="$REPO/.artifacts/edge/windows-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
trap cleanup_vm EXIT

(cd "$REPO" && git archive --format=zip -o "$OUT/orbit.zip" HEAD -- windows index.html orbit.js styles.css links.json links-data.js) || exit 1
cat > "$OUT/setup.ps1" <<'PS'
$ErrorActionPreference = 'Stop'
$t = 'C:\orbit-test'; if (Test-Path $t) { Remove-Item -Recurse -Force $t }
Expand-Archive "$HOME\orbit-b.zip" $t; Remove-Item -Force "$HOME\orbit-b.zip"
Write-Output ("{0}: {1}" -f $t, ((Get-ChildItem "$t\windows" | Select-Object -ExpandProperty Name) -join ', '))
PS
to_vm "$OUT/orbit.zip" orbit-b.zip && run_ps "$OUT/setup.ps1" || exit 1
run_ps "$EDGE_DIR/windows-checks.ps1" | tee "$OUT/windows-checks.log"
if grep -q '^FAIL' "$OUT/windows-checks.log" || ! grep -q '^end:' "$OUT/windows-checks.log"; then
  echo "Some Windows checks failed; see $OUT."; exit 1
fi
echo "All Windows checks passed."
