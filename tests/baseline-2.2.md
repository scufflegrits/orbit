# Orbit 2.2.1 test baseline

Recorded in phase 0 of the rewrite (2026-11-20). The app code was identical to tag `v2.2.1`; the only test change was the artifacts folder (`tests/helpers.py`).

## Browser suites

All in Playwright's Chromium 156 (headless), file and server mode, one after another on this machine.

| Suite | Command | Result | Time |
| --- | --- | --- | --- |
| Full matrix (milestones 1–14, 18, 19, shared checks) | `tests/browser_matrix.py --milestone 19` | 39 PASS lines, exit 0 | 205 s |
| Drag, phase 1 | `tests/drag_drop.py --phase 1` | 15 PASS lines, exit 0 | 49 s |
| Drag, phase 2 (DD01–DD16) | `tests/drag_drop.py --phase 2` | 29 PASS lines, exit 0 | 90 s |
| Sizing (OS01–OS06) | `tests/orbit_sizes.py` | 13 PASS lines, exit 0 | 11 s |
| Pending (B09, B11, milestones 15–17) | `tests/pending_checks.py` | 21 PASS lines, exit 0 | 51 s |
| Features (F01–F27, no F05) | `tests/features.py` | 53 PASS lines, exit 0 | 136 s |
| **Total** | | **170 PASS lines, no failures** | **about 9 min** |

Added in phase 0, also passing on 2.2.1:

| Check | Command | Result | Time |
| --- | --- | --- | --- |
| Behavior inventory, executable | `node tests/behavior_check.mjs` | 22 passed | under 1 s |
| Interaction-mode rules | `tests/mode_rules_check.py` | 23 passed (MR01–MR11 in both modes, MR12) | about 1 min |
| Data compatibility | `tests/data_compat_check.py` | passes against `tests/fixtures/v2.2-expected.json`, both modes | about 20 s |

Each new check was shown to fail on a deliberate break:

- `behavior_check.mjs`: a raised note limit made V07 fail.
- `mode_rules_check.py`: a swapped Escape order made MR01 fail; a menu that no longer cancels a drag made MR07 fail.
- `data_compat_check.py`: tags that are no longer lowercased made the Home workspace fail to load.

## Performance (full recipe, `tests/perf_compare.py --baseline`)

| Measurement | Median | Middle 50% of runs | Runs |
| --- | --- | --- | --- |
| First render | 184.45 ms | 182.03–195.15 ms | 20 (after 3 warm-up) |
| Quick find, per keystroke | 14.20 ms | 14.02–14.37 ms | 20 (after 3 warm-up) |
| App script size (all scripts except the data files) | 248,070 bytes | — | — |

- **Setup:** Playwright's Chromium 156, headless, 1920×1080, file mode, with the committed `tests/fixtures/perf-map.json` (seed 2026: 10 suns, 120 planets, 960 moons, 2 team suns) and `perf-queries.json` (`delta`, `yarrow delta`, `smumit`, `#daily`, `zzzz nothing matches`).
- **Noise check:** a quick run of 2.2.1 against an identical checkout differed by 3% (first render) and 1% (keystroke), well inside the 10% threshold.

## Which checks cover which old script

Used by the "done when" lines of phases 5–7: when a script is removed from `index.html`, the checks listed for it must pass. **This map is by feature area, from what each check exercises, not measured code coverage.**

| Old script | What it does | Checks that exercise it |
| --- | --- | --- |
| `render.js` | Galaxy, System, list, Quick find, sizing | Matrix milestones 1, 2, 7, 9–11, 13, 14; K01–K08 (milestone 19); OS01–OS06; pending milestones 16, 17; F01, F03, F14, F15; MR09 |
| `palette.js` | Command palette | F04, F16, F21, F22 (palette switch); MR03, MR05, MR06, MR11, MR12 |
| `menu.js` | Settings, Help, About | Matrix milestones 3, 5, 10, 12; pending milestone 15, M17-01; F12, F22, F24; MR03, MR04 |
| `variables.js` | Placeholder form, Quick add | F20, F21; MR06 |
| `sharing.js` | Link packs, team update notices | F23, F25 |
| `favorites.js` | Recent, favorites, open all, notices area | F01, F02, F16, F17, F18 |
| `editor.js`, `editor-page.js` | Link editor | Matrix milestones 4, 8, 13, 14, 18; pending B09, B11; F06, F07, F19, F27 |
| `tools.js` | Merge import, history, duplicates, link check, bookmarks, bulk RDP, team screens | F06, F08–F13 |
| `routines.js` | Routines and arrival offers | F17, F18; MR10 |
| `workspaces.js` | Workspaces, backup reminders | F22, F24, F27; data compatibility |
| `presets.js` | Remote Desktop presets | F26 |
| `team.js` | Team map | F12, F25; data compatibility |
| `drag.js` | Edit mode, drag, tray, drag undo | Drag phase 1 and DD01–DD16; MR07, MR08, MR11 |
| `keys.js` | Focus trap, Escape, arrows | K01–K08; MR01–MR03, MR06, MR08 |
| `storage.js`, `rdp.js`, `app.js` | Validation, saving, Remote Desktop, start-up | Every suite; `behavior_check.mjs`; data compatibility; matrix milestones 11, 12, 18 for Remote Desktop |
