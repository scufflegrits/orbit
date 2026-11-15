# Orbit handoff

## Project intent

Orbit is a local webpage for frequently visited links. The Galaxy shows suns (groups). Hovering over a sun reveals its first five planets (destinations); hovering over a planet reveals its moons (nested destinations). Clicking a sun opens its System, and clicking a planet or moon opens its URL in a new tab. Hosting and accounts are not required.

## Current state

- All five milestones in [ROADMAP.md](ROADMAP.md) are complete. [TEST_MATRIX.md](TEST_MATRIX.md) records browser checks for both direct-file and local-server modes.
- The bundled data contains six sample suns, 30 planets, and four moons. Five planets can appear around each Galaxy sun; eight appear around a System sun. Overflow lists keep additional destinations reachable.
- The Galaxy cog opens Settings, Help, and About. Settings contains Animations, Always show moons, Theme, and the local link editor.
- The editor supports adding, renaming, reordering, and removing suns, planets, and moons; URL and color validation; JSON import/export; and reset to bundled data. Browser edits take precedence over project files until reset.
- Themes include Default, Alabama inspired, and Auburn inspired. The page uses local CSS and no remote theme assets.
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

## Run and edit

Open `index.html` directly, or run `python3 serve.py` and open `http://localhost:8000`. The editor stores changes in the current browser; use Export JSON to back them up and Import JSON to move them between run modes. The browser editor does not write `links.json`.

To edit bundled data, change `links.json` and run `python3 sync.py` for direct-file mode. The local server reads `links.json` on refresh. Browser overrides continue to take precedence until Reset to file data is used.

## Verification

Run `/home/sysadmin/.venv/bin/python tests/browser_matrix.py --milestone 5` to check the full matrix with Playwright and Chromium. It writes screenshots under `/tmp/orbit-browser-tests`. The test runner covers direct-file and local-server modes, data validation, pointer navigation, settings, editor operations, persistence, themes, and reduced motion.

No deployment or hosting was performed, and no personal links have been supplied.
