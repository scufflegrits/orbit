#!/usr/bin/env bash
# Run the full local and Windows Edge suites together.
set -u
REPO=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO"

bash scripts/test-local.sh &
local_pid=$!
bash scripts/edge/run.sh &
edge_pid=$!

wait "$local_pid"
local_status=$?
wait "$edge_pid"
edge_status=$?

printf 'Local suite exit: %s\nEdge suite exit: %s\n' "$local_status" "$edge_status"
if [ "$local_status" -ne 0 ] || [ "$edge_status" -ne 0 ]; then
  exit 1
fi
