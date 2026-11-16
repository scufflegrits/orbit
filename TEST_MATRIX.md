# Orbit test matrix

Status: milestones 1–11 passed; milestone 12 browser checks passed, with its Windows client check pending. This matrix records the checks for each milestone in [ROADMAP.md](ROADMAP.md).

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
| S01 | File | Open the Galaxy from `index.html`. | Page loads without an app error; nine sample suns and the link count appear. | Pass (M12) |
| S02 | Server | Open the Galaxy through `serve.py`. | Page loads the current `links.json` data without an app error. | Pass (M12) |
| S03 | Both | Open a sun, return to the Galaxy, and open a destination. | Navigation works; website destinations open their configured URL in a new tab. | Pass (M12) |
| S04 | Data | Parse `links.json`, check JavaScript and Python syntax, and compare generated direct-file data with JSON. | Files are valid and `links-data.js` represents the same link map as `links.json`. | Pass (M12) |
| S05 | Both | Inspect a normal and narrower desktop window. | Suns, planets, menus, and links remain readable and reachable without clipping. | Pass (M12) |

## Milestone 1 — Galaxy layout and language

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| G01 | Both | Load the Galaxy with the eight sample suns and with an added sun. | Every sun is visible or reachable; no sun is silently omitted. | Pass |
| G02 | Both | Hover over a sun with more than five planets. | Its first five planets and spokes appear; later planets stay available in its System. | Pass |
| G03 | Both | Click a sun and use “Return to Galaxy.” | The correct System opens and the return action reaches the Galaxy. | Pass |
| G04 | Both | Inspect visible labels and help text. | Galaxy, Sun, System, and Planet are used consistently. | Pass |

## Milestone 2 — More planets and nested moons

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| H01 | Both | Load existing link data with no `moons` fields. | Existing suns and planet destinations still work. | Pass |
| H02 | Both | Hover over a sun, then a planet with moons; move the pointer onto a moon. | Planets appear, then moons and their spokes appear; moons stay visible during pointer movement. | Pass |
| H03 | Both | Open a planet's own URL and a moon's URL. | Each opens its distinct configured destination in a new tab. | Pass |
| H04 | Both | Load a System with more than eight planets. | Every planet is shown around the sun or in a clear overflow area and can be opened. | Pass |
| H05 | Both | Load a planet with more moons than fit around it. | Every moon remains visible or reachable through overflow; labels do not overlap controls. | Pass |

## Milestone 3 — Settings, Help, About, and motion

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| P01 | Both | Click the Galaxy cog; open Settings, Help, and About; close each panel. | The menu slides up, each entry opens the right panel, and close/outside click dismisses it. | Pass |
| P02 | Both | Switch Animations Off, hover suns and planets, open Settings, then reload. | Reveals and panels work without movement or delay; Off persists after reload. | Pass |
| P03 | Both | Switch Animations On and test with the operating system reduced-motion preference. | Motion returns when allowed; reduced-motion still suppresses it. | Pass |

## Milestone 4 — Local web editor and portability

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| E01 | Both | Add a sun, then rename it and change its description, color, and order. | Galaxy and System reflect the edits; the sun's stable link still opens its System. | Pass |
| E02 | Both | Add, rename, change URL, reorder, and remove planets under a chosen sun. | Edits appear under the right sun; the first five in order form the Galaxy preview; remaining planets stay in the System. | Pass |
| E03 | Both | Add, rename, change URL, reorder, and remove moons under a chosen planet. | Edits appear under the right planet and each moon opens its configured URL. | Pass |
| E04 | Both | Try blank names, invalid colors, and non-HTTP URLs. | Editor explains the error and leaves the saved link map unchanged. | Pass |
| E05 | Both | Remove a sun or planet that contains children, then cancel and confirm separately. | Cancel preserves the hierarchy; confirm removes only the selected item and its children. | Pass |
| E06 | Both | Save edits, reload, export, reset to bundled data, and import the export. | Edits survive reload and export; reset restores bundled data; import restores names, URLs, colors, order, and hierarchy. | Pass |
| E07 | Both | Import malformed or invalid JSON. | Current data stays intact and the user sees a useful error. | Pass |
| E08 | Both | Toggle “always show moons” and reload. | Visible planets show their moons without hover when enabled; hidden Galaxy planets remain hidden; the choice persists. | Pass |

## Milestone 5 — Themes

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| T01 | Both | Select Default, Alabama-inspired, and Auburn-inspired themes in the Galaxy and a System. | Each theme applies to suns, planets, moons, spokes, and menus; Default matches the original look. | Pass |
| T02 | Both | Reload after choosing each theme. | The selected theme persists and can be reset to Default. | Pass |
| T03 | Both | Inspect text, controls, hover states, and the editor in each theme. | Labels remain readable and controls visually distinguishable; no remote theme assets are required. | Pass |
| T04 | Both | Turn Animations Off while using each theme. | The motion setting still works in every theme. | Pass |

## Milestone 6 — Alabama theme refresh

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| A01 | Both | View the Alabama Galaxy, System, and editor at normal and narrow desktop widths. | Neutral surfaces, crimson accents, and distinct sun colors remain readable without clipping. | Pass |
| A02 | Both | Compare Auburn before and after the refresh; switch motion Off and reload. | Auburn stays visually stable; preferences still work. | Pass |

## Milestone 7 — Quick find

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| Q01 | Both | Search for a sun, planet, and moon by full and partial names. | Each result shows its parent path and opens the correct System or URL. | Pass |
| Q02 | Both | Search for an absent name, then edit, import, and reset data. | Empty state is clear and results always reflect the current map. | Pass |

## Milestone 8 — Editor recovery

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| R01 | Both | Inspect source status before editing and after edit, import, and reset. | The active source is accurately labeled. | Pass |
| R02 | Both | Remove a sun, planet, and moon; undo after another edit and after reload. | The latest removal and its children return in their original position without losing subsequent edits. | Pass |

## Milestone 9 — Eight-sun map and scale review

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| L01 | Both | Open the eight-sun Galaxy at 1280 and 900 pixels. | All suns, including Stocks & Investing and Science, are readable and reachable. | Pass |
| L02 | Both | Open new Systems, planets, and moons; inspect existing moon-rich planets. | URLs match bundled data and all destinations are reachable, including overflow. | Pass |
| L03 | Data | Validate URLs, generated data sync, names, IDs, and counts. | Project data is valid and direct-file/server copies match. | Pass |

## Milestone 10 — Font size setting

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| F01 | Both | Select Small, Standard, Large, and Extra large, then reload. | Each applies immediately and persists across reloads. | Pass |
| F02 | Both | Inspect Galaxy, Systems, search, menus, and editor at each size and theme. | Text changes size without clipping labels or hiding links at 1280 and 900 pixels. | Pass |

## Milestone 11 — Labs and Windows Remote Desktop

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| D01 | Both | Load the bundled map and open Labs. | Nine suns, five lab planets, and five lab1 server moons appear; the fifth moon is in overflow. | Pass |
| D02 | Both | Click a server moon and an overflow moon. | Each downloads a `.rdp` file named for the server, containing the selected host and a credential prompt. | Pass |
| D03 | Both | Search for a lab server and select its result. | Quick find downloads the same server connection file. | Pass |
| D04 | Both | Enter an invalid host, then edit a valid host and reload. | Invalid hosts are rejected; valid hosts persist and appear in the downloaded file. | Pass |
| D05 | Both | Inspect Labs at a 900-pixel desktop width. | Planet and moon labels remain readable and all targets reachable. | Pass |

## Milestone 12 — Open Windows Remote Desktop client

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| N01 | Both | Select Open Windows client, reload, then select Download `.rdp` file. | The selection persists after reload and can be changed back. | Pass |
| N02 | Both | Inspect a lab planet, moon, overflow moon, and Quick find result in client mode. | Each points to the `orbit-rdp://` URI for its own host. | Pass |
| N03 | Both | Return to download mode and click a server result. | The `.rdp` file still downloads with the configured server name. | Pass |
| N04 | Windows | Install the per-user helper; click a moon and use Connect. | The browser opens Remote Desktop Connection with that moon's host prefilled. | Blocked — no Windows runtime in this workspace; requires a Windows PC. |

## Milestone commit record

After the shared checks and the current milestone's rows pass, record the commit here. If any check is blocked, record the reason and the remaining risk before committing.

| Milestone | Date | Result summary | Commit |
| --- | --- | --- | --- |
| 1 — Galaxy | 2026-11-15 | S01–S05 and G01–G04 passed in Playwright; screenshots inspected at 1280 and 900 pixels. | Milestone 1: Galaxy language |
| 2 — Planets and moons | 2026-11-15 | S01–S05 and H01–H05 passed in Playwright; moon and overflow screenshots inspected. | Milestone 2: Planets and moons |
| 3 — Settings and motion | 2026-11-15 | S01–S05 and P01–P03 passed in Playwright; menu and Settings screenshots inspected. | Milestone 3: Settings and motion |
| 4 — Editor and portability | 2026-11-15 | S01–S05 and E01–E08 passed in Playwright; editor and always-show screenshots inspected. | Milestone 4: Local link editor |
| 5 — Themes | 2026-11-15 | S01–S05 and T01–T04 passed in Playwright; theme screenshots and text contrast checked. | Milestone 5: Themes |
| 6 — Alabama refresh | 2026-11-15 | S01–S05 and A01–A02 passed; Alabama screenshots inspected and Auburn rules unchanged. | Milestone 6: Alabama theme refresh |
| 7 — Quick find | 2026-11-15 | S01–S05 and Q01–Q02 passed in Playwright; 900-pixel result screenshot inspected. | Milestone 7: Quick find |
| 8 — Editor recovery | 2026-11-15 | S01–S05 and R01–R02 passed in Playwright; 900-pixel editor screenshot inspected. | Milestone 8: Editor recovery |
| 9 — Eight-sun map | 2026-11-15 | S01–S05 and L01–L03 passed in Playwright; Galaxy and System screenshots inspected at 1280 and 900 pixels. | Milestone 9: Eight-sun map |
| 10 — Font sizes | 2026-11-15 | S01–S05 and F01–F02 passed in Playwright in both run modes; all 12 font/theme combinations checked per mode and extra-large screenshots inspected. | Milestone 10: Font size setting |
| 11 — Labs and Remote Desktop | 2026-11-15 | S01–S05 and D01–D05 passed in Playwright in both run modes; RDP file contents and 900-pixel Labs screenshot inspected. Windows client connection awaits real hostnames. | Milestone 11: Labs and Remote Desktop |
| 12 — Native Windows launch | 2026-11-15 | S01–S05 and N01–N03 passed in Playwright in both run modes; N04 awaits a Windows PC. The helper and setting are ready for a live check. | Milestone 12: Native Windows launch |
