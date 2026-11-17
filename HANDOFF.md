# Orbit handoff

## Project intent

Orbit is a local webpage for frequently visited links. The Galaxy shows suns (groups). Hovering over a sun reveals its first five planets (destinations); hovering over a planet reveals its moons (nested destinations). Clicking a sun opens its System, and clicking a planet or moon opens its URL in a new tab. Hosting and accounts are not required.

## Current state

- Milestones 1–14 and 18 are complete. Milestones 15–17 are implemented and awaiting the next test batch requested by the user. See [ROADMAP.md](ROADMAP.md) and [TEST_MATRIX.md](TEST_MATRIX.md).
- The bundled data contains nine sample suns, 45 planets, and 61 moons. Five planets can appear around each Galaxy sun; eight appear around a System sun. Overflow lists keep additional destinations reachable.
- The cog and Quick find appear on the Galaxy and System views. Quick find from a System returns to Galaxy results. The home view omits the large intro block; navigation guidance is in Help. The cog panel enters from the right.
- Themes are named Default, Red, and Blue. Settings also includes Animations, Always show moons, font size, Remote Desktop mode, and the local link editor.
- The editor supports scoped sun/planet/moon JSON sharing and importing a planet as a sun. It can also import local `.rdp` profiles into planet or moon entries, preserving settings while excluding password, token, and signature fields.
- Labs contains `lab1`–`lab5` and five `lab1` server moons. Their hosts are examples. Remote Desktop destinations download `.rdp` files by default. The Windows helper passes imported profiles to built-in `mstsc.exe`; the user confirmed native profile launch works on Windows after rerunning the installer. Installing MSRDC does not register Orbit's protocol.
- The installer registers the executable running it: Windows PowerShell 5.1 (`powershell.exe`) or PowerShell 7 (`pwsh.exe`). Running it again overwrites the per-user protocol command and refreshes the helper, so moving from 5.1 to 7 switches future clicks. Settings and README show both commands; the user must re-run the installer if that executable is removed.
- Keyboard navigation is in progress as Milestone 19 (steps 1–2 done: focus reveals moons; menu focus trap and layered Escape; steps 3–6 remain: Quick find keys, arrow navigation, Help text, docs). Touch interaction is outside the roadmap's scope. A prioritized backlog from the user's notes is in `ROADMAP.md`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell and script loading |
| `styles.css` | Layout, animations, responsive rules, and themes |
| `app.js` | Shared DOM handles, state and constants, destination count, undo, event wiring, and `init` |
| `rdp.js` | Remote Desktop host validation, `.rdp` parsing, download, and protocol URLs |
| `storage.js` | Preferences, destination and map validation, browser map and undo storage |
| `editor.js` | Sun, planet, and moon editors, JSON import/export, reset |
| `menu.js` | Settings menu: open/close and the Settings, Help, and About panels |
| `render.js` | Galaxy and System rendering, planet/moon nodes, Quick find |
| `links.json` | Bundled suns, planets, and moons |
| `links-data.js` | Generated copy of the JSON for direct-file use |
| `sync.py` | Regenerates `links-data.js` from `links.json` |
| `serve.py` | Optional local server bound to `127.0.0.1:8000` |
| `tests/browser_matrix.py` | Test runner CLI (`--milestone`, `--only-new`, `--repeat`) and per-mode dispatch |
| `tests/helpers.py` | Shared constants (`ROOT`, `ARTIFACTS`, `APP_SCRIPTS`), fixtures, and page helpers |
| `tests/milestones_01_08.py` | Browser checks for milestones 1–8 |
| `tests/milestones_09_14.py` | Browser checks for milestones 9–14 and the pending-UI checks |
| `tests/milestone_18.py` | Browser checks for imported Remote Desktop profiles |
| `README.md` | User instructions |
| `ROADMAP.md` | Scope, milestones, and deferred work |
| `TEST_MATRIX.md` | Test cases, results, and milestone commit record |
| `windows/Install-OrbitRdp.ps1` | Per-user Windows protocol registration |
| `windows/OrbitRdpLauncher.ps1` | Validates a target and opens Remote Desktop Connection |
| `windows/Uninstall-OrbitRdp.ps1` | Removes the per-user protocol registration |

## Run and edit

Open `index.html` directly, or run `python3 serve.py` and open `http://localhost:8000`. The editor stores changes in the current browser; use Export JSON to back them up and Import JSON to move them between run modes. The browser editor does not write `links.json`.

To edit bundled data, change `links.json` and run `python3 sync.py` for direct-file mode. The local server reads `links.json` on refresh. Browser overrides continue to take precedence until Reset to file data is used.

## Verification

The full matrix is slow, so use the tiers in `TEST_MATRIX.md`: `--milestone N --only-new` after each edit, one full `--milestone N` per commit that changes JS, CSS, or HTML, and a full regression with `--repeat 3` plus the manual Windows checks before any deployment.

The Playwright runner (`tests/browser_matrix.py`, with checks in `tests/milestone*.py` and helpers in `tests/helpers.py`) accepts `--milestone` 1–18. Milestones 15–17 have no dedicated checks yet. Run it with `/home/sysadmin/.venv/bin/python tests/browser_matrix.py --milestone 18`. `--milestone N` replays every milestone up to N in both modes and is slow; add `--only-new` to run just milestone N (about 20 seconds for 18). M18-01 to M18-03 are automated (`run_milestone_18`: UTF-16 fixture import, persistence, download, export, host edit, secret stripping, and malformed/oversized negatives) and passed in both modes over five consecutive runs. M18-04 (native launch) is user-confirmed on Windows. N06 (PowerShell 7 installer) was confirmed on Windows; no Windows-only checks remain. The M13 flake was a race after the logo click and is fixed (`click_logo_to_galaxy`); `--repeat N` runs a selection N times and stops at the first failure. See [REFACTOR_PLAN.md](REFACTOR_PLAN.md).

## Next work

The scripts are classic scripts (not modules, so `file://` works) loaded in order by `index.html`: `links-data.js`, `rdp.js`, `storage.js`, `editor.js`, `menu.js`, `render.js`, `app.js`. They share top-level globals; keep the order and add any new script to `APP_SCRIPTS` in `tests/browser_matrix.py`, which copies and syntax-checks them. Cleanup progress is tracked in [REFACTOR_PLAN.md](REFACTOR_PLAN.md): test stabilization, the `app.js` split, and the test runner split are all done. `tests/rdptest01.rdp` is user connection data: keep it untracked and do not print its values.

No deployment or hosting was performed, and no personal links have been supplied.
