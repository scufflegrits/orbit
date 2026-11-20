# Orbit handoff

## Current assignment and workflow

Roadmap backlog priority 9, **drag-and-drop organization**, is complete and merged. It was built on `feature/drag-drop-organization` in two phases from the approved [DRAG_DROP_PLAN.md](DRAG_DROP_PLAN.md) and merged into `main` through pull request #1 (merge commit `b244f04`, 2026-11-17). Phase 1 and Phase 2 remain separate commits in the history. No new assignment has been given; check with the user before starting one. On 2026-11-17 the user asked for all work to go directly on `main`: every branch was merged and deleted, and future commits go straight to `main` unless the user asks for a branch. The GitHub remote is named `main` (not `origin`), so push with `git push main main`. Commit or push only when the user asks.

Feature batch (2026-11-19, version 2.0.0): the user asked for ideas 1–4 and 6–15 from a feature list, tracked with checkboxes in [FEATURES_PLAN.md](FEATURES_PLAN.md) (all ticked). Idea 5 (lab reachability) and touchscreen dragging were declined. How it fits together:

- **Team map** (`team.js`): team suns sit at the front of the same `groups` array, marked `team: true` with ids prefixed `team:`. `saveMap` strips them (`personalGroups`) before validating and storing, so every editor and drag path keeps using combined indices. `moveMapItem` refuses any path in a team sun; the drag controller, tray, Move/Copy targets, and editor screens (`showTeamSun`/`showTeamItem` in `tools.js`) treat them as read-only. Team favorites are a preference (`orbit:team-favorites`, destination keys); hidden team suns are `orbit:team-hidden`. Server mode fetches `/team.json` (`serve.py --team`); file mode reads `window.ORBIT_TEAM_DATA` from an optional `team-data.js` (`sync.py --team`, gitignored).
- **Version history**: `saveMap(data, label)` records the previous personal map in `orbit:history:v1` (last 20, oldest dropped if storage is full, skipped when nothing changed). Pass a label for every save; `false` skips recording. Reset records too.
- **Destination keys** (`destinationKey` in `storage.js`): normalized URL or `rdp:host[:port]`; used by recent links, duplicates, merge import, and link-check results.
- **Recent, favorites, open all** (`favorites.js`): rendered destinations carry `data-destination="sun:planet[:moon]"`; a bubble-phase click listener records recents (the Edit mode guard stops clicks first). Quick-bar chips and list links carry `data-edit-path` so the Edit mode guard in `drag.js` opens them in Edit links. Shift+click on a planet opens it with its web moons; browsers other than Playwright's Chromium block all but the first tab until pop-ups are allowed, and Orbit reports how many were blocked.
- **Search** (`findMatches` in `render.js`): every word must match; words that match nothing exactly get typo tolerance; path matches only narrow; `#tag`/`tag:` filter. **Palette** is `palette.js` (Ctrl/Cmd+K; first in the Escape order).
- **Editor tools** (`tools.js`): merge import (`mergeMaps`, also used by bookmark import), History, duplicates, link check (`POST /api/check-links` in `serve.py`, guarded by same-origin Host/Origin, JSON type, and an `X-Orbit-Check` header), bookmark import, bulk RDP settings.
- **Schema additions** (optional, dropped when empty): planet/moon `tags` and `favorite`, sun `icon`. **Settings**: quick bar, Galaxy view (`orbit:galaxy-view`), site icons (off by default; favicons load from each site).

How drag-and-drop works, for the next change: every rendered sun, planet, and moon carries its array path in `data-kind`, `data-sun`, `data-planet`, and `data-moon` (`tagPath` in `render.js`). `moveMapItem` in `drag.js` is the one pure move operation; the drag controller and the editor's Move forms both call it. A parent target appends; a sibling target with `place: 'before' | 'after'` reorders or inserts. A gesture records `mapRevision` (bumped by `saveMap` and Reset) and the stored map text, and refuses to commit if either changed. Drag Undo is in memory only and is retired by any later `mapRevision` change. Clicks on planets and moons are blocked in the capture phase while Edit mode is on. In a test, do not compute a tray row's position before the drag starts: the tray exists only during a drag.

## Project intent

Orbit is a local webpage for frequently visited links. The Galaxy shows suns (groups). Hovering over a sun reveals its first five planets (destinations); hovering over a planet reveals its moons (nested destinations). Clicking a sun opens its System, and clicking a planet or moon opens its URL in a new tab. Hosting and accounts are not required.

## Current state

- Milestones 1–14, 18, and 19 and backlog priorities 1–9 are complete (some backlog items still need Windows checks; see Next work). Milestones 15–17 are implemented and have no dedicated browser checks yet; the user deferred testing them. See [ROADMAP.md](ROADMAP.md) and [TEST_MATRIX.md](TEST_MATRIX.md).
- The bundled data contains nine sample suns, 45 planets, and 61 moons. Five planets can appear around each Galaxy sun; eight appear around a System sun; six moons can appear around a planet. Overflow lists keep additional destinations reachable.
- The cog and Quick find appear on the Galaxy and System views. Quick find from a System returns to Galaxy results. The home view omits the large intro block; navigation guidance is in Help. The cog panel enters from the right.
- Themes are named Default, Red, and Blue. Settings also includes Animations, Always show moons, font size, Remote Desktop mode, and the local link editor.
- The editor supports scoped sun/planet/moon JSON sharing and importing a planet as a sun. It can also import local `.rdp` profiles into planet or moon entries, preserving settings while excluding password, token, and signature fields.
- Labs contains `lab1`–`lab5` and five `lab1` server moons. Their hosts are examples. Remote Desktop destinations download `.rdp` files by default. The Windows helper passes imported profiles to built-in `mstsc.exe`; the user confirmed native profile launch works on Windows after rerunning the installer. Installing MSRDC does not register Orbit's protocol.
- The installer registers the executable running it: Windows PowerShell 5.1 (`powershell.exe`) or PowerShell 7 (`pwsh.exe`). Running it again overwrites the per-user protocol command and refreshes the helper, so moving from 5.1 to 7 switches future clicks. Settings and README show both commands; the user must re-run the installer if that executable is removed.
- Keyboard navigation (Milestone 19) is complete and documented in Help and the README. `/` focuses Quick find, and Down and Up Arrow move through its results. Tab reaches every sun, planet, and moon with a visible focus ring; focusing a planet reveals its moons (keyboard focus shows planets and moons immediately via `:has(:focus-visible)`, while mouse presses keep the animated reveal so clicks still land on the sun). Arrow keys move between suns by position, between sibling planets or moons, down into moons, and back up. The menu takes focus when opened, traps Tab, and returns focus to its opener. Escape closes the menu, then cancels a drag, then turns Edit mode off, then clears Quick find, then leaves a System. Touch interaction remains out of scope.
- Planet and moon sizing (2026-11-17): up to six moons orbit a planet (`VISIBLE_MOONS` in `app.js`); extras go to More moons. `fitOrbitSizes` in `render.js` measures every label with a canvas and grows each level's circle (Galaxy planets, System planets, moons, More planets, overflow moons) until no word splits, up to a per-level max; past the max, only that label's text shrinks (to 60% at most). Sizes are shared across the whole map and set as CSS variables (`--home-planet-size`, `--detail-planet-size`, `--moon-size`, `--more-planet-size`, `--overflow-moon-size`). `layoutMoonField` places the moons: five or six moons get a 150° fan and a longer reach, and the hover field is clipped to the outline around the planet and its moons so it never covers a neighbouring planet. Galaxy planets that grow move outward to clear the sun, and the Galaxy adds top room (`--galaxy-fan-room`) when a first-row fan would reach the top bar; in a System, the note under the stage moves down when a lower planet's fan would cover it. In Edit mode, the Before/After box for an orbiting moon opens outward from its planet so it does not cover the next moon. The smallest supported screen is 1920×1080. Checks: `tests/orbit_sizes.py` (OS01–OS06; OS07 is the same run in Edge on the VM, passed 2026-11-19).
- Drag-and-drop organization (backlog 9) is complete. An **Edit mode** toggle in the top bar (Off after every reload) pauses planet and moon links. A mouse or pen can then move a planet to another sun or a moon to another planet, and reorder or insert suns, planets, and moons by choosing Before or After beside a sibling. A System shows a destination tray during a drag. **Undo last drag** reverses one move. Edit links → Move to another sun/planet has a Position field for keyboard users. See README "Rearrange by dragging" and `TEST_MATRIX.md` DD01–DD17.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell and script loading |
| `styles.css` | Layout, animations, responsive rules, and themes |
| `app.js` | Shared DOM handles, state and constants, destination count, undo, event wiring, and `init` |
| `rdp.js` | Remote Desktop host validation, `.rdp` parsing, download, and protocol URLs |
| `storage.js` | Preferences, destination and map validation, browser map and undo storage |
| `editor.js` | Sun, planet, and moon editors, JSON import/export, reset |
| `editor-page.js` | Full-screen editor workspace, persistent map tree, and cross-parent moves |
| `menu.js` | Settings menu: open/close with focus handling, and the Settings, Help, and About panels |
| `keys.js` | Keyboard handling: menu focus trap, Escape layers, `/` and arrow keys for Quick find, and arrow navigation through the map |
| `render.js` | Galaxy and System rendering, planet/moon nodes, Quick find |
| `team.js` | Read-only team map: loading, hidden team suns, copy helper |
| `favorites.js` | Recent links, favorites, opening a planet with its moons, and recent-link tracking |
| `tools.js` | Edit links tools: merge import, history, duplicates, link check, bookmark import, bulk RDP settings, team screens |
| `palette.js` | Command palette (Ctrl/Cmd+K) |
| `FEATURES_PLAN.md` | The 2026-11-19 feature batch plan with its checklist |
| `drag.js` | Edit mode, the shared move operation, the pointer drag controller, the System destination tray, and drag Undo |
| `links.json` | Bundled suns, planets, and moons |
| `links-data.js` | Generated copy of the JSON for direct-file use |
| `sync.py` | Regenerates `links-data.js` from `links.json`; `--team PATH` writes `team-data.js`, `--no-team` removes it |
| `serve.py` | Optional local server bound to `127.0.0.1:8000` (`--port`, `--team PATH`), with `POST /api/check-links` |
| `tests/browser_matrix.py` | Test runner CLI (`--milestone`, `--only-new`, `--repeat`) and per-mode dispatch |
| `tests/helpers.py` | Shared constants (`ROOT`, `ARTIFACTS`, `APP_SCRIPTS`), fixtures, and page helpers |
| `tests/milestones_01_08.py` | Browser checks for milestones 1–8 |
| `tests/milestones_09_14.py` | Browser checks for milestones 9–14 and the pending-UI checks |
| `tests/milestone_18.py` | Browser checks for imported Remote Desktop profiles |
| `tests/milestone_19.py` | Browser checks for keyboard navigation (K01–K08) |
| `tests/drag_drop.py` | Focused drag-and-drop checks (`--phase 1\|2`; `--cdp` and `--url` run them in a remote browser such as Edge on the VM) |
| `tests/orbit_sizes.py` | Planet and moon sizing, the six-moon fan, and hover handoff at 1920×1080 (OS01–OS06; `--cdp`, `--url`, and `--write-fixture` work as in `drag_drop.py`) |
| `tests/features.py` | Feature batch checks F01–F15 (no F05); file mode and serve.py's handler with `--team`, a local test site for the link check; `--cdp`/`--url`/`--target`/`--server-mode` for Edge and `--write-fixture DIR --target URL` for the VM copy |
| `tests/pending_checks.py` | Deferred browser checks B09, B11, and milestones 15–17 on the bundled data (`--only`, `--cdp`, `--url`) |
| `README.md` | User instructions |
| `ROADMAP.md` | Scope, milestones, and deferred work |
| `DRAG_DROP_PLAN.md` | The priority-9 plan as built (design record) and the Windows VM test procedure |
| `TEST_MATRIX.md` | Test cases, results, and milestone commit record |
| `windows/Install-OrbitRdp.ps1` | Per-user Windows protocol registration |
| `windows/OrbitRdpLauncher.ps1` | Validates a target and opens Remote Desktop Connection |
| `windows/Uninstall-OrbitRdp.ps1` | Removes the per-user protocol registration |

## Run and edit

Open `index.html` directly, or run `python3 serve.py` and open `http://localhost:8000`. The editor stores changes in the current browser; use Export JSON to back them up and Import JSON to move them between run modes. The browser editor does not write `links.json`.

To edit bundled data, change `links.json` and run `python3 sync.py` for direct-file mode. The local server reads `links.json` on refresh. Browser overrides continue to take precedence until Reset to file data is used.

## Verification

Use the scope-based tiers in `TEST_MATRIX.md`: check changed behavior and its direct dependencies after a related batch of edits. A full matrix is reserved for changes with app-wide impact, a release or deployment, or an explicit request; it is not a routine commit gate. Repeat tests only for a concrete failure or timing risk.

The Playwright runner (`tests/browser_matrix.py`, with checks in `tests/milestone*.py` and helpers in `tests/helpers.py`) accepts `--milestone` 1–19. Milestones 15–17 have no dedicated checks yet. `--milestone N` replays every milestone up to N in both modes and is slow; `--only-new` runs just milestone N plus shared checks. M18-01 to M18-03 are automated (`run_milestone_18`: UTF-16 fixture import, persistence, download, export, host edit, secret stripping, and malformed/oversized negatives) and passed in both modes over five consecutive runs. M18-04 (native launch) and N06 (PowerShell 7 installer) were confirmed on Windows. Backlog registry checks B01–B02 now need Windows verification. The M13 flake was a race after the logo click and is fixed (`click_logo_to_galaxy`); `--repeat N` runs a selection N times and stops at the first failure. See [REFACTOR_PLAN.md](REFACTOR_PLAN.md).

M19 results (2026-11-16): K01–K08 are automated in `tests/milestone_19.py` and passed in both modes; `--milestone 19 --only-new --repeat 5` passed 5 of 5 and the full matrix passed once as the commit gate. Two async-render races were found and fixed in tests while writing them: leaving a System runs the render in a later `hashchange`, so tests must wait for `.detail-view` to detach and `.home-hub` to appear before reading or pressing keys. When a defect or flake is found, fix or add the test in the same change. For drag work, the plan calls for a separate focused `tests/drag_drop.py` runner rather than replaying milestone 19.

## Windows 11 test VM

The user provided a disposable Windows 11 VM, `win11-lab-test` at `10.31.31.238`, with account `sysadmin`, full project-testing control, and baseline snapshot `s04`. The user confirmed it is currently at `s04`. Never record or print its supplied password. Key-only SSH was installed and verified from this host with `/home/sysadmin/.ssh/id_ed25519`. Use `-F /dev/null` because the local system SSH config has a permission error. The verified host key is in `/tmp/orbit-win11-known_hosts`; if that temporary file disappears, verify the fingerprint before accepting a new key.

```sh
ssh -F /dev/null -i /home/sysadmin/.ssh/id_ed25519 -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile=/tmp/orbit-win11-known_hosts \
  sysadmin@10.31.31.238 whoami
```

The drag checks ran in Edge on this VM (DD17, 2026-11-16). To repeat: `git archive --format=zip HEAD`, write the fixture data with `tests/drag_drop.py --phase 2 --write-fixture DIR`, copy the archive and the two fixture files to the guest, expand to `C:\orbit-drag-test` and overwrite `links.json` and `links-data.js` there; start Edge through SSH with `-L 127.0.0.1:9333:127.0.0.1:9333` and `msedge.exe --headless=new --remote-debugging-port=9333 --user-data-dir=C:\orbit-drag-profile about:blank`; then run `tests/drag_drop.py --phase 2 --cdp http://127.0.0.1:9333 --url file:///C:/orbit-drag-test/index.html`. Stop Edge and delete both guest folders afterwards. The sizing checks ran the same way (OS07, 2026-11-19): write their fixture with `tests/orbit_sizes.py --write-fixture DIR`, expand a second copy to `C:\orbit-size-test`, add `--window-size=1920,1080` to the Edge command, and run `tests/orbit_sizes.py --cdp http://127.0.0.1:9333 --url file:///C:/orbit-size-test/index.html`. Copy PowerShell steps to the guest as a `.ps1` file; inline PowerShell loses its quoting over SSH. Stop Edge (`Stop-Process`) and wait a few seconds before deleting the profile, or its files are still locked. Server mode on Windows (2026-11-19): serve the fixtures from this host on loopback and add `-R 127.0.0.1:PORT:127.0.0.1:PORT` to the same SSH command, then pass `--url http://127.0.0.1:PORT/index.html`. `tests/pending_checks.py` uses the bundled data, so a plain copy of the tracked files is enough. B01, B02, and B07 ran as a PowerShell 5.1 script on the guest: install, change the registered command, re-install, open `orbit-rdp://` host-only and profile links with `Start-Process` and read the `mstsc.exe` command lines, then uninstall; the script refused to start if an `orbit-rdp` key or `%LOCALAPPDATA%\Orbit` already existed and removed both afterwards. Windows Edge shows a classic 15 px scrollbar, so compare positions with `document.documentElement.clientWidth`, not the window width. Remote Desktop is enabled on the VM (2026-11-19, at the user's request; Network Level Authentication on, the built-in firewall rules on for all profiles, network category Public), so snapshot `s04` no longer matches. For a visible-window pass, the user signs in over Remote Desktop and leaves the session open; `query user` shows it. SSH cannot open windows on that desktop, so start Edge with a one-off scheduled task whose principal uses `-LogonType Interactive` (same Edge flags without `--headless`), then tunnel 9333 as before. A screen capture from such a task (`CopyFromScreen`) came back pure white even while Edge rendered, so rely on Playwright screenshots and ask the user what the desktop shows. All `file://` pages share one localStorage, so reload after clearing it; a hash-only `goto` keeps the old in-memory map.

Windows PowerShell 5.1 and Microsoft Edge are present; Edge is at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. Chrome was not found in its usual Program Files path. Python/Node are not verified as real guest runtimes. Copy a clean archive of **tracked** files to a disposable guest folder for Edge file-mode checks, excluding private fixtures and credentials. The drag plan documents the archive/SSH procedure and how to use Edge for focused pointer checks. A guest SSH login cannot restore `s04`; snapshot restoration requires hypervisor access. Windows registry/helper checks B01, B02, and B07 remain pending. They are separate from priority 9. A local draft smoke script was not run or copied to the VM; do not report those cases as passed.

## Next work

Backlog priorities 1–8 were implemented on 2026-11-16, and priority 9 (drag-and-drop) was merged on 2026-11-17. The registry scripts export a preexisting `orbit-rdp` key to a unique `.reg` file in `%LOCALAPPDATA%\Orbit` before changing it; Windows checks B01–B02 are now possible on the test VM but have not run. Editor polish passed focused file-mode check B03. Sizing uses a shared font per Galaxy label level, fits “Confluence ABC” on two lines at Standard, enlarges moons, and scales other interface text at wide desktop widths; focused visual check B04 covered it. Moon copying is independent and passed focused cross-sun check B05. Inline sun-description links use HTTP(S) only and passed focused safe-rendering check B06. Host-only Remote Desktop links now use `mstsc.exe /v:` without a connection file; imported profiles retain their file route; Windows check B07 remains pending. The full-screen edit workspace passed focused file-mode check B08; server check B09 is not run. Batch `.rdp` folder and multi-file import passed focused file-mode check B10; drop and invalid-batch check B11 remain. The historical full matrix was stopped at the user's request after all file-mode checks and server checks through milestone 4 passed. Do not resume a full matrix as a routine gate for these small edits. The user explicitly asked to replace the old full-matrix-per-commit policy; `ROADMAP.md` and `TEST_MATRIX.md` now call for focused checks of changed behavior.

The scripts are classic scripts (not modules, so `file://` works) loaded in order by `index.html`: `links-data.js`, `rdp.js`, `storage.js`, `editor.js`, `editor-page.js`, `menu.js`, `render.js`, `drag.js`, `keys.js`, `app.js`. They share top-level globals; keep the order and add any new script to `APP_SCRIPTS` in `tests/helpers.py`, which the fixtures copy and the syntax check reads. Cleanup progress is tracked in [REFACTOR_PLAN.md](REFACTOR_PLAN.md): test stabilization, the `app.js` split, and the test runner split are all done. `tests/rdptest01.rdp` is user connection data: keep it untracked and do not print its values.

The prioritized backlog from the user's private notes is in `ROADMAP.md` ("Backlog — prioritized observations"). Priorities 1–9 are implemented; priority 9 is drag-and-drop organization (`DRAG_DROP_PLAN.md`). Nothing further is prioritized there. Questions A–E in the roadmap are resolved. The notes file `request-observations.md` is gitignored and private; do not commit or quote it.

The optional `tests/rdptest01.rdp` fixture is still untracked and must stay that way. Python caches are ignored through `.gitignore`.

Open follow-ups, none blocking:

- Every check in `TEST_MATRIX.md` has now run (2026-11-19). B01, B02, and B07 passed on the VM; B09, B11, and milestones 15–17 passed in `tests/pending_checks.py` in Chromium and in Edge, in both run modes.
- The visible-window Edge pass is done (2026-11-19): every browser suite passed in a normal Edge window in the user's Remote Desktop session, and B07 passed with the real Edge prompt and Remote Desktop window. No open test items remain.
- Touchscreen dragging is not planned (decided 2026-11-19).
- Feature batch (2026-11-19): `tests/features.py` passed in Chromium (file and server) and headless Edge 157 on the VM (file, and server through the SSH tunnel). Not done: a visible-window Edge pass for the new features. In file mode without a team map, the console shows one harmless "file not found" for `team-data.js`. Playwright's Chromium does not load images while a route is registered, so F14 removes routes first.

No deployment or hosting was performed, and no personal links have been supplied.
