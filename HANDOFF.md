# Orbit handoff

## Project intent

Orbit is a local webpage for frequently visited links. The Galaxy shows suns (groups). Hovering over a sun reveals its first five planets (destinations); hovering over a planet reveals its moons (nested destinations). Clicking a sun opens its System, and clicking a planet or moon opens its URL in a new tab. Hosting and accounts are not required.

## Current state

- Milestones 1–12 in [ROADMAP.md](ROADMAP.md) are complete. [TEST_MATRIX.md](TEST_MATRIX.md) records browser checks for both direct-file and local-server modes, plus the user-confirmed Windows 11 launch check.
- The bundled data contains nine sample suns, 45 planets, and 61 moons. Five planets can appear around each Galaxy sun; eight appear around a System sun. Overflow lists keep additional destinations reachable.
- The Galaxy cog opens Settings, Help, and About. Settings contains Animations, Always show moons, Theme, Font size, and the local link editor. Font size offers Small, Standard, Large, and Extra large; the selected size is stored in this browser.
- Quick find sits in the Galaxy top bar and searches every sun, planet, and moon. The editor supports adding, renaming, reordering, and removing them; URL and color validation; JSON import/export; reset to bundled data; and Undo for the latest removal. Browser edits take precedence over project files until reset.
- Themes include Default, Alabama inspired, and Auburn inspired. The page uses local CSS and no remote theme assets.
- Labs contains `lab1`–`lab5` and five `lab1` server moons. Their hosts are examples. Remote Desktop destinations download `.rdp` files by default. The optional Windows helper registers `orbit-rdp://` to open built-in `mstsc.exe` with a host loaded; credentials are never stored in the map. Settings shows the installer command when native launch is selected. Installing the separate MSRDC app does not register the Orbit protocol.
- The installer registers the executable running it: Windows PowerShell 5.1 (`powershell.exe`) or PowerShell 7 (`pwsh.exe`). Running it again overwrites the per-user protocol command and refreshes the helper, so moving from 5.1 to 7 switches future clicks. Settings and README show both commands; the user must re-run the installer if that executable is removed.
- Keyboard navigation is deferred by the roadmap. Touch interaction is outside its scope.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell and script loading |
| `styles.css` | Layout, animations, responsive rules, and themes |
| `app.js` | Data loading, rendering, navigation, settings, and editor |
| `links.json` | Bundled suns, planets, and moons |
| `links-data.js` | Generated copy of the JSON for direct-file use |
| `sync.py` | Regenerates `links-data.js` from `links.json` |
| `serve.py` | Optional local server bound to `127.0.0.1:8000` |
| `tests/browser_matrix.py` | Playwright checks for the roadmap milestones |
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

Run `/home/sysadmin/.venv/bin/python tests/browser_matrix.py --milestone 12` to check the current matrix with Playwright and Chromium. It writes screenshots under `/tmp/orbit-browser-tests`. The test runner covers direct-file and local-server modes, data validation, pointer navigation, settings, editor operations, persistence, themes, font sizes, Remote Desktop downloads, native protocol links, and reduced motion. The user confirmed that the installed helper opens `mstsc.exe` on Windows 11.

No deployment or hosting was performed, and no personal links have been supplied.
