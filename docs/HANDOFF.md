# Orbit handoff

Last updated 2026-11-24 for the unreleased Edit links and map changes, including row actions for suns, planets, and moons, map removal, and sticky editor toolbars.

## Status

**Orbit 3.0.3:** group planets, the sun picker for whole-map imports, two Galaxy hover fixes, and new Dev Toolbox links. See the changelog for the storage compatibility warning.

All work is on `main`. The unreleased changes passed the planned Chromium and headless Edge 158 checks in file and server mode. **3.0.0 (2026-11-22) is the rewrite**, merged from the `rewrite` branch as one squashed commit with the user's approval; the branch was deleted and its 34 phase commits are kept under tag `rewrite-history` (one of them, `ceafb8c`, doesn't run on its own). Orbit's code is now ES modules in `src/` (layers core < state < services < ui < app, checked by `npm run check:layers`), bundled by esbuild into the committed `orbit.js`; changing `src/` needs Node (`npm install`, then `npm run build`), see README "Changing Orbit's code". The tests reach the app only through `window.OrbitTest`, which exists in the git-ignored test bundle `orbit.test.js` only. One store (`src/state/page-store.js`) is the only writer of the map and one mode store (`src/ui/page-modes.js`) owns the interaction modes; `src/app/one-owner.test.js` fails on a second owner. How it was done, phase by phase: [REWRITE_PLAN.md](plans/REWRITE_PLAN.md).

**3.0.0 checks:** every suite passes in Chromium and in Edge (headless, and a visible window in the user's Remote Desktop session) in both modes; the 2.2 storage fixture reads back exactly as 2.2.1 read it; speed is unchanged (first render −2%, keystroke +0%) and the scripts are +1.5%; the user confirmed Open all by hand in visible Edge.

**Waiting for the user:** nothing.

Release history, version by version: [CHANGELOG.md](../CHANGELOG.md). Add a section there with each release ([RELEASING.md](RELEASING.md), step 1). The plan behind each release: [ROADMAP.md](plans/ROADMAP.md) and [DRAG_DROP_PLAN.md](plans/DRAG_DROP_PLAN.md) (milestones), [FEATURES_PLAN.md](plans/FEATURES_PLAN.md) (2.0.0–2.2.0), [REWRITE_PLAN.md](plans/REWRITE_PLAN.md) (3.0.0).

Declined, do not build: lab reachability checks (idea 5 of the 2.0.0 list) and touchscreen dragging.

## How the user wants work done

- **The change cycle, unprompted:** local tests → Edge on the Windows VM → fix what fails → update the docs → commit and push. Do not ask before each step.
- **Commit straight to `main`.** No branches or pull requests unless asked. The remote is named `main`, so push with `git push main main`.
- **Plans** for multi-part work go in a Markdown file with `[ ]` checkboxes, ticked as items land; testing may wait until every item is built.
- **Tests are focused**, not full-matrix: check changed behavior and its direct dependencies (see [TEST_MATRIX.md](TEST_MATRIX.md)). Run the full matrix only for app-wide changes, a release, or an explicit request.
- **Keep Python testing scripts in this repository.** Put browser checks and preview scripts under `tests/`. Put manual checks under `tests/manual/` and test output under the gitignored `.artifacts/`.

## Private material — never commit, copy, print, or quote

- `tests/rdptest01.rdp` — the user's connection data. Keep it untracked and off the VM.
- `private/` — gitignored private notes (including `request-observations.md`).
- The VM's password. Use the SSH key only.
- Never expose Edge's remote-debugging port on a public VM interface; tunnel it over SSH.

## Project intent

Orbit is a local webpage for frequently visited links; no hosting or accounts. The Galaxy shows suns (groups). Hovering over a sun reveals its first five planets. Clicking a sun opens its System. Linked planets and moons open websites or download or launch Remote Desktop connections. Clicking a group planet shows its moons until dismissed. The smallest supported screen is 1920×1080. The bundled map has ten suns and 123 destinations.

## Run and edit

- Open `index.html` directly (file mode), or run `python3 serve.py` and open `http://localhost:8000` (server mode). `serve.py` binds to `127.0.0.1:8000`; `--port` changes the port and `--team PATH` serves a team map at `/team.json`.
- The editor saves to the current browser's storage. **Export → Whole map (JSON)** backs up the map. **Import → Import a file** accepts a whole map, an exported sun or planet, or browser bookmarks. The browser never writes `links.json`.
- In the sun and planet editors, planet and moon rows export individual items directly. The read-only team views offer the same row exports. The sun form holds Save, with export and position below it and removal after the planet list.
- Planet and moon editors associate their sticky Save button with the form using the `form` attribute. Their Move disclosure reuses the existing reorder and cross-parent move actions.
- Sun rows save personal sun order directly. Team suns stay above them and can be viewed or exported from their rows. Planet and moon rows refresh their child list in place after reorder, removal, or its Undo, preserving the live parent form.
- To change the bundled map, edit `links.json` and run `python3 sync.py` (regenerates `links-data.js` for file mode). `sync.py --team PATH` writes the gitignored `team-data.js`; `--no-team` removes it. A map saved in the browser takes precedence until **Reset to file data**.

## Code layout

Since 3.0.0 the app is ES modules in `src/`, bundled by `scripts/build.mjs` into one committed file, `orbit.js`. `index.html` loads `links-data.js`, the optional `team-data.js`, then `orbit.js`. Layers, lowest first (`npm run check:layers` fails on an upward or circular import): core < state < services < ui < app.

| Path | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Page shell; layout, animations, responsive rules, themes (Default, Red, Blue) |
| `orbit.js` | The built app (`npm run build`); never edit by hand |
| `links.json` / `links-data.js` | Bundled map, and its generated copy for file mode |
| `serve.py` / `sync.py` | Local server (with `POST /api/check-links`) / data generator |
| `src/core/` | Pure rules: schema and validation, destination keys, placeholders, search, Remote Desktop parsing, map moves and merges, bookmarks |
| `src/state/` | Saved data: storage, workspaces, preferences, history, backup; `page-store.js` is the only writer of the map |
| `src/services/` | Map and team sources, opening links (`opener.js`), Remote Desktop launch, link check, file import and export, the clock |
| `src/ui/` | The screens: `views/`, `find/`, `menu/`, `dialogs/`, `notices/`, `editor/`, `drag/`, `keys/`, `layout/`; `page-modes.js` owns the interaction modes; `page.js` holds the page's shared state ; `icons.js` draws Lucide icons from the generated `icon-data.js` |
| `src/app/` | Start-up (`main.js`, `start.js`), `version.js` (`APP_VERSION`), and the test hook (test bundle only) |
| `scripts/` | `build.mjs` (release and test bundles, `--check`, `--watch`), `check-layers.mjs`, and `icons.mjs` (generates `src/ui/icon-data.js` from the pinned `lucide-static`: `npm run icons`; `npm run check:icons` fails if it's out of date) |
| `tests/` | Browser runners (`*.py`), node helpers (`unit/`), the frozen 2.2.1 code (`oracle/`), fixtures |
| `windows/*.ps1` | Per-user `orbit-rdp://` protocol install, launcher, uninstall |
| `docs/` | This handoff, the test matrix, release steps, the Remote Desktop signing guide; finished plans in `docs/plans/` |
| `private/` | Gitignored private notes |

Test output and the test bundle (`orbit.test.js`) go in the gitignored `.artifacts/`. Run `~/.venv/bin/python tests/editor_previews.py` to generate editor screenshots. See [manual browser checks](../tests/manual/README.md) for the release-specific probes.

Other docs: [README.md](../README.md) (user guide), [RELEASING.md](RELEASING.md), [ROADMAP.md](plans/ROADMAP.md), [TEST_MATRIX.md](TEST_MATRIX.md), [FEATURES_PLAN.md](plans/FEATURES_PLAN.md), [DRAG_DROP_PLAN.md](plans/DRAG_DROP_PLAN.md), [REFACTOR_PLAN.md](plans/REFACTOR_PLAN.md) (done), [RDP_SIGNING.md](RDP_SIGNING.md).

## Things to know before changing code

**Map schema.** `{ groups: [sun…], routines?, rdpPresets? }`. A sun has `id`, `name`, `description`, `color`, `links` (planets), optional `icon`. A link is a website (`url`) or Remote Desktop destination (`type: 'rdp'`, `host`, optional profile). A planet is a link with `moons`, or a group with `name`, `type: 'group'`, `moons`, and optional `tags` and `note`. Each moon is a link. Optional fields are dropped when empty. Web URLs may contain up to five `{placeholders}` (`PLACEHOLDER`, `templateNames`, `fillTemplate`). Routines are `{id, name, links: [{key, name}], schedule?: {time, days}}`; presets are `{id, name, settings}` (`.rdp` lines, never passwords).

**Saving.** Every change goes through `saveMap(data, label)` (editors call `applyEditorChange(next, after, { label, routines?, rdpPresets? })`). It strips team suns, validates, stores, records the previous map in version history (last 20; `label === false` skips), keeps routines and presets unless given, bumps `mapRevision`, and counts a change for the backup reminder. The first save containing a group marks storage version 1. Before replacing an unreadable map, the store preserves the raw text under that map key with an `:unreadable` suffix. Orbit 3.0.2 and earlier can overwrite saved group maps if run with the same browser storage.

**Team map.** Team suns sit at the front of the same `groups` array, marked `team: true` with ids prefixed `team:`, so every path index is a combined index. Editors, drag, Move/Copy targets, and Quick add skip or refuse them. In tests, a page's `copyGroups()` therefore has the team sun at index 0 when a team map is loaded.

**Destination keys.** `destinationKey(item)` is a normalized URL or `rdp:host[:port]` for a link, and `null` for a group planet. Imports match group planets case-insensitively by name within a sun. Recents, favorites of team links, routines, duplicates, merge import, link packs, link-check results, and team update notices all match on it; `pathsForKey` finds an item's current position.

**Workspaces.** `MAP_STORAGE_KEY`, `UNDO_STORAGE_KEY`, and `HISTORY_STORAGE_KEY` are `let` in `app.js`, built by `workspaceKey()`. Main keeps the original keys (so pre-2.2 maps stay put); other workspaces append `:<id>`. Preferences and the team map are shared across workspaces.

**Opening links.** `openLinks(items, label, options)` is the one opener for Open all, favorites, and routines. Browsers other than Playwright's Chromium (including Edge) allow only the first tab until pop-ups are allowed for the site; Orbit reports the blocked count. Remote Desktop links are never opened in bulk. Placeholder links reuse their last values, or are skipped and counted.

**Banners.** Routine offers, backup reminders, team updates, and open-all reports go in `noticeArea()`, inserted before `#app`.

**Drag-and-drop.** Rendered nodes carry their array path in `data-kind`, `data-sun`, `data-planet`, `data-moon` (`tagPath`). `moveMapItem` is the one pure move; a parent target appends, a sibling target with `place: 'before' | 'after'` inserts. A gesture refuses to commit if `mapRevision` or the stored map changed underneath it. Clicks on links are blocked in the capture phase while Edit mode is on. The System tray exists only during a drag.

**Sizing.** `fitOrbitSizes` measures labels with a canvas and grows each level's circle until no word splits, up to a per-level max, then shrinks only that label (to 60% at most). Sizes are shared map-wide as CSS variables. Up to six moons orbit a planet (`VISIBLE_MOONS`); `layoutMoonField` fans them and clips the hover field.

**Keyboard.** Escape order: a visible button tip, palette, then menu, then drag, then Edit mode, then Quick find, then leaving a System. **E** opens the focused map item in the editor. `src/ui/views/edit-buttons.js` handles the hover pencil and focus restoration for both entry points.

**Server security.** `POST /api/check-links` requires a same-origin Host/Origin, a JSON body, and an `X-Orbit-Check: 1` header.

Display preferences are shared across workspaces. **Button tips** uses `orbit:button-tips` with values `normal`, `slow`, and `off`. **Edit buttons on hover** uses `orbit:edit-buttons` and defaults to on. **Confirm before deleting** uses `orbit:confirm-before-delete` and defaults to on. Both map and editor deletions use `src/ui/remove-item.js` and the workspace’s existing removal undo.

## Tests

Local tests use Python Playwright with its Chromium. Each runner checks file mode and server mode. **`scripts/test-local.sh` runs every check below** (about ten minutes; logs in `.artifacts/local/`), and `scripts/edge/run.sh` runs the browser suites in Edge on the test VM (see "Windows 11 test VM").

| Runner | Covers | Last local result |
| --- | --- | --- |
| `tests/browser_matrix.py` | Milestones 1–14, 18, 19 (`--milestone N`, `--only-new`, `--repeat N`) | 39 passed |
| `tests/drag_drop.py` | DD checks (`--phase 1\|2`) | 29 passed |
| `tests/orbit_sizes.py` | OS01–OS06, OS08–OS11 at 1920×1080 | 21 passed |
| `tests/pending_checks.py` | B09, B11, milestones 15–17 (`--only`) | 21 passed |
| `tests/features.py` | F01–F38, no F05 | 75 passed (both modes), with F38 for the Lucide icons |
| `npm run check` | Types (`tsc`), import layers, bundle up to date, icon data matches Lucide (`check:icons`) | passed |
| `npm run test:unit` | Node tests in `src/**/*.test.js`: examples, property tests, and differential tests against 2.2.1 (`tests/oracle/`). A deliberate behavior change fails its differential test: update the expected result there, don't delete the test | 195 passed |
| `tests/behavior_check.mjs` | 2.2.1's pure rules (V, D, S, M), read from tag `v2.2.1` | 22 passed |
| `tests/mode_rules_check.py` | Interaction-mode rules MR01–MR12 | 23 passed |
| `tests/data_compat_check.py` | The 2.2 storage fixture reads back as recorded | passed |
| `tests/perf_compare.py` | The performance recipe (`--baseline`, `--against REF [--quick]`) | baseline recorded |

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

`win11-lab-test` at `10.31.31.238`, account `sysadmin`, Edge 158, Windows PowerShell 5.1. Disposable; the user gave full control. Remote Desktop was enabled at the user's request (2026-11-19) and is left on, so the VM no longer matches its baseline snapshot `s04`. Restoring a snapshot needs hypervisor access.

SSH uses the key, never the password. The verified host key is in `~/.ssh/orbit-win11-known_hosts`; if that file is gone, check the VM's fingerprint before saving a new one (the scripts print how). Edge's debugging port is reached only through an SSH tunnel to the VM's loopback, never on a public interface.

**Scripts** (in `scripts/edge/`; settings and defaults at the top of `env.sh`, overridable with `ORBIT_VM`, `ORBIT_SSH_KEY`, `ORBIT_KNOWN_HOSTS`, `ORBIT_PYTHON`). Each one leaves the VM as it was found, also when it fails, and prints what is left (`cleanup.ps1`). Logs go to `.artifacts/edge/`.

| Script | What it does |
| --- | --- |
| `scripts/edge/run.sh` | The browser suites (drag, features, sizes, pending, services, compat) in headless Edge, file and server mode. `--only features,drag`, `--mode file`, `--check f25 --repeat 3` (one features check, repeated), `--visible` (a normal window in the user's Remote Desktop session). About ten minutes for everything. |
| `scripts/edge/windows-checks.sh` | Windows helper checks B01, B02, B07 against `windows/` at this commit. Refuses to start if the VM already has an `orbit-rdp` key or `%LOCALAPPDATA%\Orbit`. |
| `scripts/edge/open-all-check.sh start` / `observe` / `stop` | The Open-all hand check: visible Edge with a fresh profile on a planet with two moons; the user confirms one tab plus two reported blocked, then all three after allowing pop-ups. |
| `scripts/edge/zip-check.sh ZIP` | A release zip, extracted, from file and through its own `serve.py`, in Chromium here and Edge on the VM (`tests/release_zip_check.py`). |

How the runs work, for changing the scripts:

- Fixtures come from each runner's `--write-fixture DIR`; they are copied to `C:\orbit-<suite>-test`. Server mode serves them from this machine on loopback (ports 8772–8779) through `-R` tunnels; the features site and team server is `scripts/edge/serve_features.py` (8774, 8775).
- Headless Edge is started over SSH with `-L 127.0.0.1:9333:127.0.0.1:9333`. For a visible window, the user signs in over Remote Desktop and leaves the session open (`query user` shows it); SSH can't open windows on that desktop, so `interactive.ps1` starts Edge through a one-off scheduled task with `-LogonType Interactive`. Screen captures from such a task come back white; use Playwright screenshots and ask the user what they see.
- The runners then take `--cdp http://127.0.0.1:9333 --url file:///C:/<folder>/index.html` (or the server URL).

Tips:

- Run PowerShell as copied `.ps1` files (`run_ps` in `env.sh`); inline PowerShell loses its quoting over SSH.
- Windows Edge has a 15 px scrollbar, so compare positions against `document.documentElement.clientWidth`.
- When killing local helpers, use `pgrep`/`pkill` with a `[x]`-style bracket pattern so the command doesn't match its own shell.

## Remote Desktop notes

- Remote Desktop links download `.rdp` files by default. The optional Windows helper (`windows/Install-OrbitRdp.ps1`) registers `orbit-rdp://` per user for the PowerShell that runs it (5.1 or 7); re-running it switches the registration. Host-only links use `mstsc.exe /v:`; imported profiles go through a temporary `.rdp` file.
- Imported `.rdp` profiles keep their settings but drop password, token, and signature fields. Presets follow the same rule.
- Installing MSRDC does not register Orbit's protocol.

## Open follow-ups

- **Test quirk:** `tests/browser_matrix.py --milestone 11 --only-new` fails on its own (also before 3.0.2); the full matrix passes. Run milestone 11 through the full matrix until it is looked into.
- Every feature check, including batch 3 (2.2.0), has passed in a visible Edge window (3.0.0, 2026-11-22). No deployment or hosting has been done.
