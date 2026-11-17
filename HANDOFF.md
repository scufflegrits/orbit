# Orbit handoff

## Current assignment and branch

Roadmap backlog priority 9 is **drag-and-drop organization**, not orbit animation. The user asked for a thorough, agent-ready plan before code changes and for the work to live outside `main`. The current branch is `feature/drag-drop-organization`, created from `main` at `46112a7`. [DRAG_DROP_PLAN.md](DRAG_DROP_PLAN.md) is the authoritative start-to-finish guide: it specifies the user decisions, source files, interaction rules, two implementation phases, Undo and keyboard behavior, focused tests, Windows VM use, commit sequence, and completion criteria. **No drag-and-drop code has started.** Stay in planning until the user reviews the plan. Do not merge or push to `main` without a separate request.

The phase boundary is deliberate: Phase 1 moves planets and moons between parents; Phase 2 reorders suns, planets, and moons, including cross-parent sibling insertion. Each phase gets its own review and commit on the feature branch. An explicit Edit mode toggle is required on both Galaxy and System. The editor tree remains the fallback for hidden items and keyboard access. Touch remains out of scope.

## Project intent

Orbit is a local webpage for frequently visited links. The Galaxy shows suns (groups). Hovering over a sun reveals its first five planets (destinations); hovering over a planet reveals its moons (nested destinations). Clicking a sun opens its System, and clicking a planet or moon opens its URL in a new tab. Hosting and accounts are not required.

## Current state

- Milestones 1–14, 18, and 19 are complete. Milestones 15–17 are implemented and have no dedicated browser checks yet; the user deferred testing them. See [ROADMAP.md](ROADMAP.md) and [TEST_MATRIX.md](TEST_MATRIX.md).
- The bundled data contains nine sample suns, 45 planets, and 61 moons. Five planets can appear around each Galaxy sun; eight appear around a System sun. Overflow lists keep additional destinations reachable.
- The cog and Quick find appear on the Galaxy and System views. Quick find from a System returns to Galaxy results. The home view omits the large intro block; navigation guidance is in Help. The cog panel enters from the right.
- Themes are named Default, Red, and Blue. Settings also includes Animations, Always show moons, font size, Remote Desktop mode, and the local link editor.
- The editor supports scoped sun/planet/moon JSON sharing and importing a planet as a sun. It can also import local `.rdp` profiles into planet or moon entries, preserving settings while excluding password, token, and signature fields.
- Labs contains `lab1`–`lab5` and five `lab1` server moons. Their hosts are examples. Remote Desktop destinations download `.rdp` files by default. The Windows helper passes imported profiles to built-in `mstsc.exe`; the user confirmed native profile launch works on Windows after rerunning the installer. Installing MSRDC does not register Orbit's protocol.
- The installer registers the executable running it: Windows PowerShell 5.1 (`powershell.exe`) or PowerShell 7 (`pwsh.exe`). Running it again overwrites the per-user protocol command and refreshes the helper, so moving from 5.1 to 7 switches future clicks. Settings and README show both commands; the user must re-run the installer if that executable is removed.
- Keyboard navigation (Milestone 19) is complete and documented in Help and the README. `/` focuses Quick find, and Down and Up Arrow move through its results. Tab reaches every sun, planet, and moon with a visible focus ring; focusing a planet reveals its moons (keyboard focus shows planets and moons immediately via `:has(:focus-visible)`, while mouse presses keep the animated reveal so clicks still land on the sun). Arrow keys move between suns by position, between sibling planets or moons, down into moons, and back up. The menu takes focus when opened, traps Tab, and returns focus to its opener. Escape closes the menu, then clears Quick find, then leaves a System. Touch interaction remains out of scope.

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
| `links.json` | Bundled suns, planets, and moons |
| `links-data.js` | Generated copy of the JSON for direct-file use |
| `sync.py` | Regenerates `links-data.js` from `links.json` |
| `serve.py` | Optional local server bound to `127.0.0.1:8000` |
| `tests/browser_matrix.py` | Test runner CLI (`--milestone`, `--only-new`, `--repeat`) and per-mode dispatch |
| `tests/helpers.py` | Shared constants (`ROOT`, `ARTIFACTS`, `APP_SCRIPTS`), fixtures, and page helpers |
| `tests/milestones_01_08.py` | Browser checks for milestones 1–8 |
| `tests/milestones_09_14.py` | Browser checks for milestones 9–14 and the pending-UI checks |
| `tests/milestone_18.py` | Browser checks for imported Remote Desktop profiles |
| `tests/milestone_19.py` | Browser checks for keyboard navigation (K01–K08) |
| `README.md` | User instructions |
| `ROADMAP.md` | Scope, milestones, and deferred work |
| `DRAG_DROP_PLAN.md` | Full priority-9 execution plan and Windows VM test procedure |
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

Windows PowerShell 5.1 and Microsoft Edge are present; Edge is at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. Chrome was not found in its usual Program Files path. Python/Node are not verified as real guest runtimes. Copy a clean archive of **tracked** files to a disposable guest folder for Edge file-mode checks, excluding private fixtures and credentials. The drag plan documents the archive/SSH procedure and how to use Edge for focused pointer checks. A guest SSH login cannot restore `s04`; snapshot restoration requires hypervisor access. Windows registry/helper checks B01, B02, and B07 remain pending. They are separate from priority 9. A local draft smoke script was not run or copied to the VM; do not report those cases as passed.

## Next work

Backlog priorities 1–8 were implemented on 2026-11-16. The registry scripts export a preexisting `orbit-rdp` key to a unique `.reg` file in `%LOCALAPPDATA%\Orbit` before changing it; Windows checks B01–B02 are now possible on the test VM but have not run. Editor polish passed focused file-mode check B03. Sizing uses a shared font per Galaxy label level, fits “Confluence ABC” on two lines at Standard, enlarges moons, and scales other interface text at wide desktop widths; focused visual check B04 covered it. Moon copying is independent and passed focused cross-sun check B05. Inline sun-description links use HTTP(S) only and passed focused safe-rendering check B06. Host-only Remote Desktop links now use `mstsc.exe /v:` without a connection file; imported profiles retain their file route; Windows check B07 remains pending. The full-screen edit workspace passed focused file-mode check B08; server check B09 is not run. Batch `.rdp` folder and multi-file import passed focused file-mode check B10; drop and invalid-batch check B11 remain. The historical full matrix was stopped at the user's request after all file-mode checks and server checks through milestone 4 passed. Do not resume a full matrix as a routine gate for these small edits. The user explicitly asked to replace the old full-matrix-per-commit policy; `ROADMAP.md` and `TEST_MATRIX.md` now call for focused checks of changed behavior.

The scripts are classic scripts (not modules, so `file://` works) loaded in order by `index.html`: `links-data.js`, `rdp.js`, `storage.js`, `editor.js`, `editor-page.js`, `menu.js`, `render.js`, `keys.js`, `app.js`. They share top-level globals; keep the order and add any new script to `APP_SCRIPTS` in `tests/helpers.py`, which the fixtures copy and the syntax check reads. Cleanup progress is tracked in [REFACTOR_PLAN.md](REFACTOR_PLAN.md): test stabilization, the `app.js` split, and the test runner split are all done. `tests/rdptest01.rdp` is user connection data: keep it untracked and do not print its values.

The prioritized backlog from the user's private notes is in `ROADMAP.md` ("Backlog — prioritized observations"). Priorities 1–8 are implemented; priority 9 is the planned drag-and-drop organization work in `DRAG_DROP_PLAN.md`. Questions A–E in the roadmap are resolved. The notes file `request-observations.md` is gitignored and private; do not commit or quote it.

The optional `tests/rdptest01.rdp` fixture is still untracked and must stay that way. Python caches are ignored through `.gitignore`.

No deployment or hosting was performed, and no personal links have been supplied.
