# Refactor plan: test stability and file size

This plan is separate from [ROADMAP.md](ROADMAP.md), which tracks user-facing milestones. Nothing here changes behavior. Each step is one commit and is accepted only when the existing matrix passes.

## Constraints

- Orbit must keep running from `file://`, so ES modules (`type="module"`) are out: browsers block them on `file://`. Split `app.js` into classic scripts that share top-level globals, loaded in order from `index.html`, the way `links-data.js` already is.
- No build step, no new dependencies.
- Gate for every step: `/home/sysadmin/.venv/bin/python tests/browser_matrix.py --milestone 18` passes in both file and server modes. Run it twice, since the first problem to fix is flakiness.
- Do not change `tests/rdptest01.rdp` or commit it.

## Part 1 — Make the gate trustworthy (done 2026-11-15)

Outcome: 12 sequential and 6 parallel M13-only runs of the old code all passed, so the flake needs load to appear. The likely cause is that leaving a System (logo click) sets the hash, and the render and `closeMenu()` run in a later `hashchange` event; tests that read elements or opened the editor straight after the click could win the race. Fixed with `click_logo_to_galaxy` (waits for the System to detach and the Galaxy to render) at all three call sites, and `--repeat N` was added. `--milestone 18 --only-new --repeat 10` passed 10 of 10 in both modes.

1. **Find the flaky check.** Rerun milestone 13 on its own about ten times in each mode and record which assertion fails ("Orbit logo returns from a System to all suns" has failed once, and the M18 `groups` race failed once). Write the finding in the commit message.
2. **Replace racy reads with waits.** After each `page.reload`, wait for `.home-hub` (or the System's `.detail-view`) before calling `page.evaluate` or counting elements. Prefer Playwright's auto-waiting `expect`-style locator checks over `count()` snapshots. Change one test function per commit.
3. **Add a repeat option.** Add `--repeat N` to `tests/browser_matrix.py` so a milestone can be run N times in one command. Pass criterion for Part 1: 10 consecutive green runs of `--milestone 18`.

## Part 2 — Split `app.js` (classic scripts, bottom-up) (done 2026-11-15)

Outcome: steps 4–9 are done, one commit each, and the full matrix (milestones 1–18, both modes, 37 PASS lines) passed after every step. Final sizes: `app.js` 113 lines, `rdp.js` 80, `storage.js` 132, `menu.js` 145, `render.js` 302, `editor.js` 463 (slightly over the target; split it further only if it grows). A scan found no duplicate top-level names. The test runner copies fixtures through `APP_SCRIPTS`, so a new script must be added there.

Order moves the pieces with the fewest dependencies first. After each step, load order in `index.html` is updated and the gate is run. Roughly 1,200 lines now; the target is no file over about 400.

4. **`rdp.js`**: `validRdpHost`, `parseRdpProfile`, `readRdpText`, `downloadRdp`, `rdpLaunchUrl`. These are mostly pure, so this is the safest first cut.
5. **`storage.js`**: preference readers and `savePreference`, `validateMap`, `validDestination`, `uniqueSunId`, `loadBrowserMap`, `saveMap`, undo record helpers, the storage keys.
6. **`editor.js`**: everything from `editorButton` through `showEditor` (sun, planet, moon editors, import/export review, reset). This is the largest block.
7. **`menu.js`**: `openMenu`, `closeMenu`, `showMenuPanel` (Settings, Help, About).
8. **`render.js`**: `linkNode`, planet/sun node builders, `findMatches`, `findResult`, `renderHome`, `renderDetail`, `render`.
9. **`app.js`** keeps only DOM lookups, shared state, and `init`. Confirm nothing else is defined at top level that two files both assign.

Per step: move code without editing it, update `index.html` script order, run the gate, update the file table in `HANDOFF.md`, commit with a message naming the step.

## Part 3 — Split the test runner

10. Move shared helpers (`check`, `open_editor`, `upload_json`, `download_json`, `upload_rdp`, fixtures) into `tests/helpers.py`.
11. Move milestone functions into `tests/milestones_01_08.py`, `tests/milestones_09_14.py`, and `tests/milestone_18.py`, with `browser_matrix.py` keeping only the CLI and server setup. Keep `--milestone` and `--only-new` behavior identical.

## Done when

- Ten consecutive green gate runs in both modes.
- No source file over about 400 lines, with `index.html` listing the scripts in dependency order.
- `README.md`, `HANDOFF.md` (file table), and `TEST_MATRIX.md` reflect the new layout, with no behavior changes in the diff.

## Risks

- Script load order bugs only show up at runtime. The gate catches them, but run the `file://` mode after every step since that is where globals and load order matter most.
- Top-level `let` and `const` are shared across classic scripts but not attached to `window`. Do not reference them as `window.groups`; tests that use `page.evaluate("groups...")` keep working.
