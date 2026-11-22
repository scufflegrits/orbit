# Orbit handoff

Last updated 2026-11-21, at version 2.2.1 (3.0.0 ready on `rewrite`, waiting for approval to merge).

## Status

All released work is on `main`, with no failing or pending test. The 3.0.0 rewrite runs on the `rewrite` branch ([REWRITE_PLAN.md](https://github.com/scufflegrits/orbit/blob/rewrite/REWRITE_PLAN.md) there). **Phases 0 and 1 are done on `rewrite`** (2026-11-20 and 21). Phase 0 recorded the 2.2.1 baseline (`tests/baseline-2.2.md`). Phase 1 added the build: `src/` is bundled by esbuild into a committed `orbit.js` (release, no test hook) and a git-ignored `orbit.test.js` (with `window.OrbitTest`), loaded before the old scripts; the tests now reach the app only through `OrbitTest`. On that branch, changing `src/` needs Node (`npm install`, `npm run build`); see README "Changing Orbit's code". Phase 2 (2026-11-21) moved the pure logic into `src/core/` (schema, destination, templates, search, rdp, map-ops, bookmarks), tested with `npm run test:unit` against a frozen copy of 2.2.1 (`tests/oracle/`); the old scripts' functions now forward to it through `window.OrbitNext.core`. A trial of delegating modules to cheaper subagents worked but saved no time, so it was switched off. No phase starts without the user's go-ahead; Checkpoint A was passed ("Continue"). Phase 3 (2026-11-21) added `src/state/` (storage, workspaces, prefs, history, backup, and the store, now the only writer of the map) and the pure interaction-mode model `src/ui/modes.js` (tested, not wired until phase 4b); one subscriber in `app.js` copies the store's state into the old globals and redraws. Phase 4 (2026-11-21) added `src/services/` (sources, opener, rdp-launch, link-check, file-io, schedule); the old opener, team loading, file, link-check, routine-offer, and backup functions forward to it through `window.OrbitNext.services`, and `tests/services_check.py` checks pop-up allowance and team-map loading in the browser. The visible-window Open-all check passed in Edge with the user over Remote Desktop. Phase 4b (2026-11-21) made `src/ui/mode-store.js` the one owner of the interaction modes (Edit mode, pressing and dragging, the open overlay, Quick find, the view): the old scripts send events to it as `orbitModes`, one subscriber in `app.js` shows every change, and `src/app/one-owner.test.js` fails if any script keeps its own copy. `editMode` no longer exists.

**The rewrite is done on `rewrite` (2026-11-22), as 3.0.0, not yet merged.** Phases 5–8 moved every screen into `src/` and deleted the 20 classic scripts and the bridge: `index.html` now loads the map data and `orbit.js`, which defines nothing on the page. Every suite passes in Chromium and in Edge (headless, and a visible window in the user's Remote Desktop session) in both modes; the 2.2 storage fixture reads back exactly as 2.2.1 read it; speed is unchanged (first render −2%, keystroke +0%) and the scripts are +1.5%. The user asked for the phases to run without waiting, with anything needing them logged here.

**Decided by the user (2026-11-21):** phases 4 and 4b approved; Checkpoint B: Continue; delegation stays off; the phase 3 team-index correction stands; proceed through the remaining phases without waiting, logging what needs the user.

**Done with the user (2026-11-22):** the visible-window Open-all check on 3.0.0 passed (one tab, the rest reported blocked; after allowing pop-ups, all three open).

**Waiting for the user:**
1. **Approval to merge `rewrite` into `main`**, push, tag `v3.0.0`, and delete the branch (REWRITE_PLAN.md, phase 9).
2. **A broken commit on `rewrite`, pushed:** `ceafb8c` (phase 5) includes the deletion of `menu.js`, `variables.js`, `sharing.js`, and `favorites.js` while its `index.html` still loads them, so the app doesn't run at that one commit; `90eab6e` (phase 6a) completes the move. Fixing the history needs a force-push of `rewrite` (or a squash when merging); say which you prefer.

| Release | Date | What it added | Plan |
| --- | --- | --- | --- |
| Milestones 1–19, backlog 1–9 | to 2026-11-17 | Galaxy and System views, editor, Remote Desktop links and Windows helper, keyboard navigation, sizing, drag-and-drop | [ROADMAP.md](ROADMAP.md), [DRAG_DROP_PLAN.md](DRAG_DROP_PLAN.md) |
| 2.0.0 | 2026-11-19 | Recent links and favorites, open all, smarter Quick find, Ctrl/Cmd+K palette, bulk RDP settings, tags, link check, version history, duplicate finder, merge import, read-only team map, bookmark import, site icons, list view | [FEATURES_PLAN.md](FEATURES_PLAN.md) |
| 2.1.0 | 2026-11-20 | Open all favorites, named routines, routine offers when Orbit opens | FEATURES_PLAN.md |
| 2.2.0 | 2026-11-20 | Notes, `{placeholder}` links, quick add, workspaces, link packs, backup reminders, team map update notices, RDP presets | FEATURES_PLAN.md |
| 2.2.1 | 2026-11-20 | Fix: Reset to file data in a workspace other than Main now keeps the file data after a reload (check F27) | TEST_MATRIX.md |

Declined, do not build: lab reachability checks (idea 5 of the 2.0.0 list) and touchscreen dragging.

## How the user wants work done

- **The change cycle, unprompted:** local tests → Edge on the Windows VM → fix what fails → update the docs → commit and push. Do not ask before each step.
- **Commit straight to `main`.** No branches or pull requests unless asked. The remote is named `main`, so push with `git push main main`. **Exception:** the 3.0.0 rewrite lives only on the `rewrite` branch, and [REWRITE_PLAN.md](REWRITE_PLAN.md) overrides this rule for rewrite work (push with `git push main rewrite`; merging into `main` needs the user's approval).
- **Plans** for multi-part work go in a Markdown file with `[ ]` checkboxes, ticked as items land; testing may wait until every item is built.
- **Tests are focused**, not full-matrix: check changed behavior and its direct dependencies (see [TEST_MATRIX.md](TEST_MATRIX.md)). Run the full matrix only for app-wide changes, a release, or an explicit request.

## Private material — never commit, copy, print, or quote

- `tests/rdptest01.rdp` — the user's connection data. Keep it untracked and off the VM.
- `request-observations.md` — gitignored private notes.
- The VM's password. Use the SSH key only.
- Never expose Edge's remote-debugging port on a public VM interface; tunnel it over SSH.

## Project intent

Orbit is a local webpage for frequently visited links; no hosting or accounts. The Galaxy shows suns (groups). Hovering over a sun reveals its first five planets (destinations); hovering over a planet reveals its moons (nested destinations). Clicking a sun opens its System; clicking a planet or moon opens its link in a new tab, or downloads/launches a Remote Desktop connection. The smallest supported screen is 1920×1080. No personal links have been supplied; the bundled map is sample data (nine suns, 45 planets, 61 moons).

## Run and edit

- Open `index.html` directly (file mode), or run `python3 serve.py` and open `http://localhost:8000` (server mode). `serve.py` binds to `127.0.0.1:8000`; `--port` changes the port and `--team PATH` serves a team map at `/team.json`.
- The editor saves to the current browser's storage. Export JSON backs a map up; Import JSON merges or replaces. The browser never writes `links.json`.
- To change the bundled map, edit `links.json` and run `python3 sync.py` (regenerates `links-data.js` for file mode). `sync.py --team PATH` writes the gitignored `team-data.js`; `--no-team` removes it. A map saved in the browser takes precedence until **Reset to file data**.

## Code layout

Classic scripts (not modules, so `file://` works), sharing top-level globals and loaded by `index.html` in this order:

`links-data.js`, optional `team-data.js`, `rdp.js`, `storage.js`, `team.js`, `favorites.js`, `editor.js`, `editor-page.js`, `tools.js`, `routines.js`, `variables.js`, `workspaces.js`, `sharing.js`, `presets.js`, `menu.js`, `render.js`, `drag.js`, `palette.js`, `keys.js`, `app.js`.

Keep that order. A new script also goes in `APP_SCRIPTS` in `tests/helpers.py`, which the test fixtures copy and the syntax check reads.

| File | Purpose |
| --- | --- |
| `index.html` | Page shell and script loading |
| `styles.css` | Layout, animations, responsive rules, themes (Default, Red, Blue) |
| `app.js` | Shared state and constants (`APP_VERSION`, storage keys), destination count, undo, event wiring, `init` |
| `rdp.js` | Remote Desktop host validation, `.rdp` parsing, download, protocol URLs, `effectiveRdpProfile` (applies a preset) |
| `storage.js` | Preferences, map validation, `saveMap`, history, `destinationKey`, placeholder helpers |
| `team.js` | Read-only team map: loading, hidden team suns, `plainCopy` |
| `favorites.js` | Recent links, favorites, `openLinks` (the shared opener), `noticeArea` banners |
| `editor.js` | Sun, planet, and moon editors; JSON import/export; reset |
| `editor-page.js` | Full-screen editor workspace, map tree, cross-parent moves |
| `tools.js` | Merge import, History, duplicates, link check, bookmark import, bulk RDP settings, team screens |
| `routines.js` | Routines: running, merging, the arrival offer, editor screens |
| `variables.js` | The placeholder form and Quick add |
| `workspaces.js` | Workspaces and backup reminders |
| `sharing.js` | Link packs and team map update notices |
| `presets.js` | Remote Desktop preset screens |
| `menu.js` | Cog menu: Settings, Help, About |
| `render.js` | Galaxy, System, and list rendering; `fitOrbitSizes`; Quick find (`findMatches`) |
| `drag.js` | Edit mode, `moveMapItem`, the pointer drag controller, the System tray, drag Undo |
| `palette.js` | Command palette (Ctrl/Cmd+K) |
| `keys.js` | Menu focus trap, the Escape order, `/` and arrow-key navigation |
| `links.json` / `links-data.js` | Bundled map, and its generated copy for file mode |
| `serve.py` / `sync.py` | Local server (with `POST /api/check-links`) / data generator |
| `windows/*.ps1` | Per-user `orbit-rdp://` protocol install, launcher, uninstall |

Other docs: [README.md](README.md) (user guide), [README-distribute.md](README-distribute.md), [ROADMAP.md](ROADMAP.md), [TEST_MATRIX.md](TEST_MATRIX.md), [FEATURES_PLAN.md](FEATURES_PLAN.md), [DRAG_DROP_PLAN.md](DRAG_DROP_PLAN.md), [REFACTOR_PLAN.md](REFACTOR_PLAN.md) (done), [RDP_SIGNING.md](RDP_SIGNING.md).

## Things to know before changing code

**Map schema.** `{ groups: [sun…], routines?, rdpPresets? }`. A sun has `id`, `name`, `description`, `color`, `links` (planets), optional `icon`. A planet or moon is a web link (`url`) or Remote Desktop link (`type: 'rdp'`, `host`, optional profile), with optional `tags`, `favorite`, `note`, `rdpPreset`; planets have `moons`. Optional fields are dropped when empty. Web URLs may contain up to five `{placeholders}` (`PLACEHOLDER`, `templateNames`, `fillTemplate`). Routines are `{id, name, links: [{key, name}], schedule?: {time, days}}`; presets are `{id, name, settings}` (`.rdp` lines, never passwords).

**Saving.** Every change goes through `saveMap(data, label)` (editors call `applyEditorChange(next, after, { label, routines?, rdpPresets? })`). It strips team suns, validates, stores, records the previous map in version history (last 20; `label === false` skips), keeps routines and presets unless given, bumps `mapRevision`, and counts a change for the backup reminder.

**Team map.** Team suns sit at the front of the same `groups` array, marked `team: true` with ids prefixed `team:`, so every path index is a combined index. Editors, drag, Move/Copy targets, and Quick add skip or refuse them. In tests, a page's `copyGroups()` therefore has the team sun at index 0 when a team map is loaded.

**Destination keys.** `destinationKey(item)` is a normalized URL or `rdp:host[:port]`. Recents, favorites of team links, routines, duplicates, merge import, link packs, link-check results, and team update notices all match on it; `pathsForKey` finds an item's current position.

**Workspaces.** `MAP_STORAGE_KEY`, `UNDO_STORAGE_KEY`, and `HISTORY_STORAGE_KEY` are `let` in `app.js`, built by `workspaceKey()`. Main keeps the original keys (so pre-2.2 maps stay put); other workspaces append `:<id>`. Preferences and the team map are shared across workspaces.

**Opening links.** `openLinks(items, label, options)` is the one opener for Open all, favorites, and routines. Browsers other than Playwright's Chromium (including Edge) allow only the first tab until pop-ups are allowed for the site; Orbit reports the blocked count. Remote Desktop links are never opened in bulk. Placeholder links reuse their last values, or are skipped and counted.

**Banners.** Routine offers, backup reminders, team updates, and open-all reports go in `noticeArea()`, inserted before `#app`.

**Drag-and-drop.** Rendered nodes carry their array path in `data-kind`, `data-sun`, `data-planet`, `data-moon` (`tagPath`). `moveMapItem` is the one pure move; a parent target appends, a sibling target with `place: 'before' | 'after'` inserts. A gesture refuses to commit if `mapRevision` or the stored map changed underneath it. Clicks on links are blocked in the capture phase while Edit mode is on. The System tray exists only during a drag.

**Sizing.** `fitOrbitSizes` measures labels with a canvas and grows each level's circle until no word splits, up to a per-level max, then shrinks only that label (to 60% at most). Sizes are shared map-wide as CSS variables. Up to six moons orbit a planet (`VISIBLE_MOONS`); `layoutMoonField` fans them and clips the hover field.

**Keyboard.** Escape order: palette, then menu, then drag, then Edit mode, then Quick find, then leaving a System.

**Server security.** `POST /api/check-links` requires a same-origin Host/Origin, a JSON body, and an `X-Orbit-Check: 1` header.

## Tests

Local tests use Python Playwright with its Chromium. Each runner checks file mode and server mode.

| Runner | Covers | Last local result |
| --- | --- | --- |
| `tests/browser_matrix.py` | Milestones 1–14, 18, 19 (`--milestone N`, `--only-new`, `--repeat N`) | 39 passed |
| `tests/drag_drop.py` | DD checks (`--phase 1\|2`) | 29 passed |
| `tests/orbit_sizes.py` | OS01–OS06 at 1920×1080 | 13 passed |
| `tests/pending_checks.py` | B09, B11, milestones 15–17 (`--only`) | 21 passed |
| `tests/features.py` | F01–F27, no F05 | all passed |
| `npm run test:unit` (`rewrite` branch) | Node tests for `src/core/`, `src/state/`, and `src/ui/modes.js`: examples, property tests, and differential tests against 2.2.1 (`tests/oracle/`) | 141 passed |
| `tests/behavior_check.mjs` (`rewrite` branch) | 2.2.1's pure rules (V, D, S, M), read from tag `v2.2.1` | 22 passed |
| `tests/mode_rules_check.py` (`rewrite` branch) | Interaction-mode rules MR01–MR12 | 23 passed |
| `tests/data_compat_check.py` (`rewrite` branch) | The 2.2 storage fixture reads back as recorded | passed |
| `tests/perf_compare.py` (`rewrite` branch) | The performance recipe (`--baseline`, `--against REF [--quick]`) | baseline recorded |

`drag_drop.py`, `orbit_sizes.py`, `pending_checks.py`, and `features.py` accept `--cdp URL` and `--url PAGE` to drive a remote browser; `features.py` also takes `--target`, `--server-mode`, and `--write-fixture DIR`, and the drag and sizing runners take `--write-fixture DIR`.

Known quirks:

- Playwright's Chromium does not load images while a route is registered, so F14 removes routes first.
- Downloads in a remote browser can't be read; the tests capture `downloadJson` calls instead.
- Dialogs are answered by one global handler; add a message to `DISMISS_NEXT` to cancel one.
- Leaving a System renders in a later `hashchange`; wait for `.detail-view` to detach before pressing keys.
- All `file://` pages share one localStorage, so reload after clearing it; a hash-only `goto` keeps the old in-memory map.
- In file mode without a team map, the console shows one harmless "file not found" for `team-data.js`.

When a defect or flake is found, fix or add the test in the same change, and mutate the code once to prove a new check can fail.

## Windows 11 test VM

`win11-lab-test` at `10.31.31.238`, account `sysadmin`, Edge 157, Windows PowerShell 5.1. Disposable; the user gave full control. Remote Desktop was enabled at the user's request (2026-11-19) and is left on, so the VM no longer matches its baseline snapshot `s04`. Restoring a snapshot needs hypervisor access.

SSH with the key (`-F /dev/null` works around a permission error in the local SSH config). The verified host key is in `/tmp/orbit-win11-known_hosts`; if that file is gone, verify the fingerprint before accepting a new key.

```sh
ssh -F /dev/null -i /home/sysadmin/.ssh/id_ed25519 -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile=/tmp/orbit-win11-known_hosts \
  sysadmin@10.31.31.238 whoami
```

**Headless Edge run:**

1. Build a clean archive of tracked files only (`git archive --format=zip HEAD`) and write any fixture the runner needs (`--write-fixture DIR`).
2. Copy them to the guest and expand to a test folder such as `C:\orbit-drag-test`, overwriting `links.json` and `links-data.js` with the fixture.
3. Start Edge over SSH with `-L 127.0.0.1:9333:127.0.0.1:9333`: `msedge.exe --headless=new --remote-debugging-port=9333 --user-data-dir=C:\orbit-drag-profile about:blank` (add `--window-size=1920,1080` for sizing). Edge is at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
4. Run the runner with `--cdp http://127.0.0.1:9333 --url file:///C:/<folder>/index.html`.
5. For server mode, serve the fixture from this host on loopback, add `-R 127.0.0.1:PORT:127.0.0.1:PORT` (8771–8775 have been used), and pass `--url http://127.0.0.1:PORT/index.html`.
6. Clean up: `Stop-Process` Edge, wait a few seconds for the profile to unlock, then delete the profile and test folders.

**Visible-window run:** the user signs in over Remote Desktop and leaves the session open (`query user` shows it). SSH cannot open windows on that desktop, so start Edge (same flags, no `--headless`) through a one-off scheduled task whose principal uses `-LogonType Interactive`, then tunnel 9333 as above. Screen captures from such a task come back white; use Playwright screenshots and ask the user what they see.

Tips:

- Run PowerShell as copied `.ps1` files; inline PowerShell loses its quoting over SSH.
- Windows Edge has a 15 px scrollbar, so compare positions against `document.documentElement.clientWidth`.
- When killing local helpers, use `pgrep`/`pkill` with a `[x]`-style bracket pattern so the command doesn't match its own shell.

Windows-only checks B01, B02 (protocol install and re-install), and B07 (host-only and profile launches through `mstsc.exe`) passed in a PowerShell 5.1 script on the guest. That script refuses to start if an `orbit-rdp` key or `%LOCALAPPDATA%\Orbit` already exists, and it removes both afterwards.

## Remote Desktop notes

- Remote Desktop links download `.rdp` files by default. The optional Windows helper (`windows/Install-OrbitRdp.ps1`) registers `orbit-rdp://` per user for the PowerShell that runs it (5.1 or 7); re-running it switches the registration. Host-only links use `mstsc.exe /v:`; imported profiles go through a temporary `.rdp` file.
- Imported `.rdp` profiles keep their settings but drop password, token, and signature fields. Presets follow the same rule.
- Installing MSRDC does not register Orbit's protocol.

## Open follow-ups

None blocking. Batch 3 (2.2.0) passed in headless Edge in both modes but has not had a visible-window Edge pass; earlier batches have. No deployment or hosting has been done.
