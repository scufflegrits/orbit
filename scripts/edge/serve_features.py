"""For Edge runs of tests/features.py: the feature test site on 8774 and Orbit in
server mode (serve.py's handler, with a team map) on 8775. Runs until stopped.
Started by scripts/edge/run.sh; the VM reaches both through the SSH tunnel."""
import sys
import tempfile
import time
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tests"))
import features as F  # noqa: E402
from helpers import QuietHandler, write_fixture  # noqa: E402

TARGET = "http://127.0.0.1:8774"
with tempfile.TemporaryDirectory() as base:
    site = Path(base) / "site"
    (site / "ok").mkdir(parents=True)
    (site / "ok" / "index.html").write_text("<title>OK</title>")
    (site / "ok" / "guide.html").write_text("<title>Guide</title>")
    (site / "sample").write_text("Works at the exact file URL")
    (site / "favicon.ico").write_bytes(F.PNG)
    target = ThreadingHTTPServer(("127.0.0.1", 8774), partial(QuietHandler, directory=str(site)))
    Thread(target=target.serve_forever, daemon=True).start()
    orbit = Path(base) / "orbit"
    orbit.mkdir()
    write_fixture(orbit, F.make_map(TARGET))
    F.write_data(orbit, TARGET)
    F.QuietOrbit.team_path = str(orbit / "team.json")
    server = ThreadingHTTPServer(("127.0.0.1", 8775), partial(F.QuietOrbit, directory=str(orbit)))
    Thread(target=server.serve_forever, daemon=True).start()
    print("serving", flush=True)
    while True:
        time.sleep(3600)
