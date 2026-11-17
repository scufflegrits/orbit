"""Run Orbit's browser checks against file and local-server modes.

Usage: python tests/browser_matrix.py --milestone N [--only-new] [--repeat R]
Shared helpers live in helpers.py; milestone checks live in milestones_*.py.
"""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
from helpers import ARTIFACTS, QuietHandler, ROOT, run_data_checks, run_shared
from milestones_01_08 import (
    run_extra_sun_fixture,
    run_milestone_1,
    run_milestone_2,
    run_milestone_2_fixtures,
    run_milestone_3,
    run_milestone_4,
    run_milestone_5,
    run_milestone_6,
    run_milestone_7,
    run_milestone_8,
)
from milestones_09_14 import (
    run_milestone_10,
    run_milestone_11,
    run_milestone_12,
    run_milestone_13,
    run_milestone_14,
    run_milestone_9,
    run_pending_ui,
)
from milestone_18 import run_milestone_18
from milestone_19 import run_milestone_19


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--milestone", type=int, choices=range(1, 20), required=True)
    parser.add_argument("--only-new", action="store_true", help="Run only the selected milestone")
    parser.add_argument("--repeat", type=int, default=1,
                        help="Run the selection this many times; stop at the first failure")
    args = parser.parse_args()
    for number in range(1, args.repeat + 1):
        if args.repeat > 1:
            print(f"--- repeat {number}/{args.repeat}")
        run_once(args)
    if args.repeat > 1:
        print(f"PASS all {args.repeat} repeats")


def run_once(args):
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    run_data_checks()
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path="/usr/bin/chromium", headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            try:
                for mode, url in (
                    ("file", (ROOT / "index.html").as_uri()),
                    ("server", f"http://127.0.0.1:{server.server_port}/index.html"),
                ):
                    page = browser.new_page(viewport={"width": 1280, "height": 900})
                    try:
                        run_shared(page, url, mode)
                        if args.milestone >= 1 and (not args.only_new or args.milestone == 1):
                            run_milestone_1(page, url, mode)
                        if mode == "file" and (not args.only_new or args.milestone == 1):
                            run_extra_sun_fixture(page)
                        if args.milestone >= 2 and (not args.only_new or args.milestone == 2):
                            run_milestone_2(page, url, mode)
                            if mode == "file":
                                run_milestone_2_fixtures(page)
                        if args.milestone >= 3 and (not args.only_new or args.milestone == 3):
                            run_milestone_3(page, url, mode)
                        if args.milestone >= 4 and (not args.only_new or args.milestone == 4):
                            run_milestone_4(page, url, mode)
                        if args.milestone >= 5 and (not args.only_new or args.milestone == 5):
                            run_milestone_5(page, url, mode)
                        if args.milestone >= 6 and (not args.only_new or args.milestone == 6):
                            run_milestone_6(page, url, mode)
                        if args.milestone >= 7 and (not args.only_new or args.milestone == 7):
                            run_milestone_7(page, url, mode)
                        if args.milestone >= 8 and (not args.only_new or args.milestone == 8):
                            run_milestone_8(page, url, mode)
                        if args.milestone >= 9 and (not args.only_new or args.milestone == 9):
                            run_milestone_9(page, url, mode)
                        if args.milestone >= 10 and (not args.only_new or args.milestone == 10):
                            run_milestone_10(page, url, mode)
                        if args.milestone >= 11 and (not args.only_new or args.milestone == 11):
                            run_milestone_11(page, url, mode)
                        if args.milestone >= 12 and (not args.only_new or args.milestone == 12):
                            run_milestone_12(page, url, mode)
                        if args.milestone >= 13:
                            if not args.only_new or args.milestone == 13:
                                run_pending_ui(page, url, mode)
                                run_milestone_13(page, url, mode)
                        if args.milestone >= 14:
                            run_milestone_14(page, url, mode)
                        if args.milestone >= 18 and (not args.only_new or args.milestone == 18):
                            run_milestone_18(page, url, mode)
                        if args.milestone >= 19 and (not args.only_new or args.milestone == 19):
                            run_milestone_19(page, url, mode)
                    finally:
                        page.close()
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
