# Orbit test matrix

Status: ready for milestone runs. This matrix tracks the checks for each milestone in [ROADMAP.md](ROADMAP.md). The assistant runs the checks before each milestone commit and records results here.

## Scope and method

| Item | Plan |
| --- | --- |
| Run modes | **File:** open `index.html` through `file://`. **Server:** run `serve.py` and open the local page. Test both where a row says **Both**. |
| Browser checks | Use headless Chromium for screenshots, navigation, pointer hover/click, reload, and browser storage checks. Add a small browser automation harness when interaction tests begin. |
| Data checks | Use focused Node or Python checks for data shape, generated data sync, URL validation, import/export, and persistence logic. |
| Visual checks | Inspect screenshots at normal and narrower desktop window sizes after animations finish. Record layout or contrast defects as failures. |
| Scope | Desktop pointer interaction. Keyboard navigation is deferred; touch screens are out of scope. |
| Result values | `Not run`, `Pass`, `Fail`, `Blocked`, or `N/A`. Record a brief reason and evidence for failures or blocks. |

Browser tests should use existing tool permissions when available. If a browser check cannot run in this environment, mark it `Blocked` and report the gap; do not request repeated approvals for routine test runs.

## Shared checks — run before every milestone commit

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| S01 | File | Open the Galaxy from `index.html`. | Page loads without an app error; six sample suns and the link count appear. | Pass (M1) |
| S02 | Server | Open the Galaxy through `serve.py`. | Page loads the current `links.json` data without an app error. | Pass (M1) |
| S03 | Both | Open a sun, return to the Galaxy, and open a destination. | Navigation works; destination opens its configured URL in a new tab. | Pass (M1) |
| S04 | Data | Parse `links.json`, check JavaScript and Python syntax, and compare generated direct-file data with JSON. | Files are valid and `links-data.js` represents the same link map as `links.json`. | Pass (M1) |
| S05 | Both | Inspect a normal and narrower desktop window. | Suns, planets, menus, and links remain readable and reachable without clipping. | Pass (M1) |

## Milestone 1 — Galaxy layout and language

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| G01 | Both | Load the Galaxy with the six sample suns and with an added sun. | Every sun is visible or reachable; no sun is silently omitted. | Pass |
| G02 | Both | Hover over a sun with more than five planets. | Its first five planets and spokes appear; later planets stay available in its System. | Pass |
| G03 | Both | Click a sun and use “Return to Galaxy.” | The correct System opens and the return action reaches the Galaxy. | Pass |
| G04 | Both | Inspect visible labels and help text. | Galaxy, Sun, System, and Planet are used consistently. | Pass |

## Milestone 2 — More planets and nested moons

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| H01 | Both | Load existing link data with no `moons` fields. | Existing suns and planet destinations still work. | Not run |
| H02 | Both | Hover over a sun, then a planet with moons; move the pointer onto a moon. | Planets appear, then moons and their spokes appear; moons stay visible during pointer movement. | Not run |
| H03 | Both | Open a planet's own URL and a moon's URL. | Each opens its distinct configured destination in a new tab. | Not run |
| H04 | Both | Load a System with more than eight planets. | Every planet is shown around the sun or in a clear overflow area and can be opened. | Not run |
| H05 | Both | Load a planet with more moons than fit around it. | Every moon remains visible or reachable through overflow; labels do not overlap controls. | Not run |

## Milestone 3 — Settings, Help, About, and motion

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| P01 | Both | Click the Galaxy cog; open Settings, Help, and About; close each panel. | The menu slides up, each entry opens the right panel, and close/outside click dismisses it. | Not run |
| P02 | Both | Switch Animations Off, hover suns and planets, open Settings, then reload. | Reveals and panels work without movement or delay; Off persists after reload. | Not run |
| P03 | Both | Switch Animations On and test with the operating system reduced-motion preference. | Motion returns when allowed; reduced-motion still suppresses it. | Not run |

## Milestone 4 — Local web editor and portability

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| E01 | Both | Add a sun, then rename it and change its description, color, and order. | Galaxy and System reflect the edits; the sun's stable link still opens its System. | Not run |
| E02 | Both | Add, rename, change URL, reorder, and remove planets under a chosen sun. | Edits appear under the right sun; the first five in order form the Galaxy preview; remaining planets stay in the System. | Not run |
| E03 | Both | Add, rename, change URL, reorder, and remove moons under a chosen planet. | Edits appear under the right planet and each moon opens its configured URL. | Not run |
| E04 | Both | Try blank names, invalid colors, and non-HTTP URLs. | Editor explains the error and leaves the saved link map unchanged. | Not run |
| E05 | Both | Remove a sun or planet that contains children, then cancel and confirm separately. | Cancel preserves the hierarchy; confirm removes only the selected item and its children. | Not run |
| E06 | Both | Save edits, reload, export, reset to bundled data, and import the export. | Edits survive reload and export; reset restores bundled data; import restores names, URLs, colors, order, and hierarchy. | Not run |
| E07 | Both | Import malformed or invalid JSON. | Current data stays intact and the user sees a useful error. | Not run |
| E08 | Both | Toggle “always show moons” and reload. | Visible planets show their moons without hover when enabled; hidden Galaxy planets remain hidden; the choice persists. | Not run |

## Milestone 5 — Themes

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| T01 | Both | Select Default, Alabama-inspired, and Auburn-inspired themes in the Galaxy and a System. | Each theme applies to suns, planets, moons, spokes, and menus; Default matches the original look. | Not run |
| T02 | Both | Reload after choosing each theme. | The selected theme persists and can be reset to Default. | Not run |
| T03 | Both | Inspect text, controls, hover states, and the editor in each theme. | Labels remain readable and controls visually distinguishable; no remote theme assets are required. | Not run |
| T04 | Both | Turn Animations Off while using each theme. | The motion setting still works in every theme. | Not run |

## Milestone commit record

After the shared checks and the current milestone's rows pass, record the commit here. If any check is blocked, record the reason and the remaining risk before committing.

| Milestone | Date | Result summary | Commit |
| --- | --- | --- | --- |
| 1 — Galaxy | 2026-11-15 | S01–S05 and G01–G04 passed in Playwright; screenshots inspected at 1280 and 900 pixels. | Milestone 1: Galaxy language |
| 2 — Planets and moons | — | Not run | — |
| 3 — Settings and motion | — | Not run | — |
| 4 — Editor and portability | — | Not run | — |
| 5 — Themes | — | Not run | — |
