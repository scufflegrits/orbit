"""Serve the link map on this computer only.

Options:
  --team PATH   Also serve a read-only team map (an Orbit map JSON file) as /team.json.
  --port PORT   Listen on another port (default 8000).

The server also answers POST /api/check-links for Edit links → Check links.
"""

import argparse
import json
import ssl
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

CHECK_LIMIT = 500
CHECK_TIMEOUT = 8
CHECK_WORKERS = 8
MAX_REDIRECTS = 5
USER_AGENT = "Orbit link check (local)"


class WebOnlyRedirects(urllib.request.HTTPRedirectHandler):
    """Follow at most MAX_REDIRECTS redirects, and only to http or https."""

    max_redirections = MAX_REDIRECTS

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlsplit(newurl).scheme not in ("http", "https"):
            raise urllib.error.HTTPError(newurl, code, "redirect to a non-web address", headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


OPENER = urllib.request.build_opener(WebOnlyRedirects, urllib.request.HTTPSHandler(context=ssl.create_default_context()))


def check_url(url):
    """Ask one address whether it answers. Never returns page content."""
    last_error = None
    for method in ("HEAD", "GET"):
        request = urllib.request.Request(url, method=method, headers={"User-Agent": USER_AGENT})
        try:
            with OPENER.open(request, timeout=CHECK_TIMEOUT) as response:
                return {"ok": response.status < 400, "status": response.status}
        except urllib.error.HTTPError as error:
            # Some servers refuse HEAD; ask again with GET before reporting it.
            if method == "HEAD" and error.code in (400, 403, 405, 406, 429, 501):
                last_error = {"ok": False, "status": error.code}
                continue
            return {"ok": False, "status": error.code}
        except (urllib.error.URLError, OSError, ValueError) as error:
            reason = getattr(error, "reason", error)
            last_error = {"ok": False, "error": str(reason)[:200] or "no answer"}
            if method == "HEAD":
                continue
    return last_error or {"ok": False, "error": "no answer"}


class OrbitHandler(SimpleHTTPRequestHandler):
    team_path = None

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/team.json":
            return self.send_team()
        if path == "/team-data.js" and not (Path(self.directory) / "team-data.js").exists():
            # index.html always asks for team-data.js; answer quietly when there is none.
            return self.send_bytes(b"// No team map.\n", "text/javascript")
        return super().do_GET()

    def send_bytes(self, body, content_type, status=200):
        self.send_response(status)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, data, status=200):
        self.send_bytes(json.dumps(data).encode(), "application/json", status)

    def send_team(self):
        if not self.team_path:
            return self.send_json({"error": "No team map. Start serve.py with --team PATH."}, 404)
        try:
            data = json.loads(Path(self.team_path).read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            return self.send_json({"error": f"The team map could not be read: {error}"}, 500)
        return self.send_json(data)

    def same_origin(self):
        """Only Orbit pages from this server may use the API."""
        host = self.headers.get("Host", "")
        origin = self.headers.get("Origin")
        allowed = {f"localhost:{self.server.server_port}", f"127.0.0.1:{self.server.server_port}"}
        if host not in allowed:
            return False
        return origin is None or urlsplit(origin).netloc in allowed

    def do_POST(self):
        if urlsplit(self.path).path != "/api/check-links":
            return self.send_json({"error": "Not found"}, 404)
        # The custom header and JSON type make a browser send a CORS preflight
        # first, which this server never approves, so other sites cannot use it.
        if (not self.same_origin() or self.headers.get("X-Orbit-Check") != "1"
                or self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json"):
            return self.send_json({"error": "Forbidden"}, 403)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 1_000_000:
                raise ValueError("request too large")
            urls = json.loads(self.rfile.read(length)).get("urls")
            if not isinstance(urls, list) or len(urls) > CHECK_LIMIT:
                raise ValueError(f"send a list of at most {CHECK_LIMIT} urls")
            urls = [str(url) for url in urls]
            if any(urlsplit(url).scheme not in ("http", "https") for url in urls):
                raise ValueError("only http and https addresses can be checked")
        except (ValueError, AttributeError) as error:
            return self.send_json({"error": str(error)}, 400)
        with ThreadPoolExecutor(max_workers=CHECK_WORKERS) as pool:
            results = dict(zip(urls, pool.map(check_url, urls)))
        return self.send_json(results)


def main():
    parser = argparse.ArgumentParser(description="Serve Orbit on this computer only.")
    parser.add_argument("--team", help="Path to a read-only team map JSON file")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    if args.team:
        team = Path(args.team).resolve()
        json.loads(team.read_text(encoding="utf-8"))
        OrbitHandler.team_path = str(team)
    handler = partial(OrbitHandler, directory=str(directory))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"Orbit is running at http://localhost:{args.port}", flush=True)
    if args.team:
        print(f"Team map: {OrbitHandler.team_path}", flush=True)
    print("Press Ctrl+C to stop it.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
