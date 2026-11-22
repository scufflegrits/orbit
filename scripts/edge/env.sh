# Shared settings and helpers for the Edge scripts; sourced, not run.
#
# Settings (environment variables, with this project's defaults):
#   ORBIT_VM           the Windows test VM, user@host         (sysadmin@10.31.31.238)
#   ORBIT_SSH_KEY      SSH key for the VM                     (~/.ssh/id_ed25519)
#   ORBIT_KNOWN_HOSTS  the VM's verified host key             (~/.ssh/orbit-win11-known_hosts)
#   ORBIT_PYTHON       Python with Playwright                 (~/.venv/bin/python, else python3)
#
# Edge's debugging port is only ever reached through an SSH tunnel to the VM's
# loopback, never on a public interface.

REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
EDGE_DIR="$REPO/scripts/edge"
VM=${ORBIT_VM:-sysadmin@10.31.31.238}
KEY=${ORBIT_SSH_KEY:-$HOME/.ssh/id_ed25519}
KNOWN_HOSTS=${ORBIT_KNOWN_HOSTS:-$HOME/.ssh/orbit-win11-known_hosts}
if [ -n "${ORBIT_PYTHON:-}" ]; then PY=$ORBIT_PYTHON
elif [ -x "$HOME/.venv/bin/python" ]; then PY=$HOME/.venv/bin/python
else PY=python3; fi
EDGE_EXE='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
CDP_PORT=9333
# -F /dev/null works around a permission error in the local SSH config.
SSH_OPTS=(-F /dev/null -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$KNOWN_HOSTS")

if [ ! -s "$KNOWN_HOSTS" ]; then
  echo "No verified host key for the VM at $KNOWN_HOSTS." >&2
  echo "Check the VM's fingerprint (on the VM: ssh-keygen -lf C:\\ProgramData\\ssh\\ssh_host_ed25519_key.pub)," >&2
  echo "then save it with: ssh-keyscan -t ed25519 ${VM#*@} > $KNOWN_HOSTS (and compare ssh-keygen -lf $KNOWN_HOSTS)." >&2
  exit 2
fi

# Run a command on the VM.
vm() { ssh "${SSH_OPTS[@]}" "$VM" "$@"; }

# Copy to the VM: to_vm [-r] SOURCE DEST (DEST relative to the VM user's home).
to_vm() {
  local recurse=()
  if [ "$1" = "-r" ]; then recurse=(-r); shift; fi
  scp -q "${recurse[@]}" "${SSH_OPTS[@]}" "$1" "$VM:$2"
}

# Run a PowerShell file on the VM: run_ps FILE [ARGUMENTS...]. Inline PowerShell
# loses its quoting over SSH, so scripts are always copied first.
run_ps() {
  local file=$1; shift
  local name; name="orbit-$(basename "$file")"
  to_vm "$file" "$name" && vm "powershell -NoProfile -ExecutionPolicy Bypass -File $name $*"
  vm "del $name 2>nul" >/dev/null 2>&1 || true
}

# Leave the VM as it was found (cleanup.ps1), and print what is left.
cleanup_vm() { run_ps "$EDGE_DIR/cleanup.ps1"; }

# Wait for Edge's debugging port through the tunnel; print its version.
wait_for_edge() {
  local port=${1:-$CDP_PORT}
  for _ in $(seq 1 30); do curl -s "http://127.0.0.1:$port/json/version" >/dev/null && break; sleep 1; done
  curl -s "http://127.0.0.1:$port/json/version" | grep -o '"Browser": "[^"]*"' || { echo "Edge did not start" >&2; return 1; }
}

# Serve a folder on loopback with the tests' quiet handler: serve_dir PORT DIR LOG (prints the pid).
serve_dir() {
  "$PY" -c "
import sys; from functools import partial; from http.server import ThreadingHTTPServer
sys.path.insert(0, '$REPO/tests'); from helpers import QuietHandler
ThreadingHTTPServer(('127.0.0.1', $1), partial(QuietHandler, directory='$2')).serve_forever()" > "$3" 2>&1 &
  echo $!
}
