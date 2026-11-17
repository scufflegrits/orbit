# Orbit test matrix

Status: milestones 1–14, 18, and 19 passed; the PowerShell 7 installer check N06 passed on Windows; milestone 19 (keyboard navigation) passed. This matrix records the checks for each milestone in [ROADMAP.md](ROADMAP.md).

## Scope and method

| Item | Plan |
| --- | --- |
| Run modes | **File:** open `index.html` through `file://`. **Server:** run `serve.py` and open the local page. Test both where a row says **Both**. |
| Browser checks | Use headless Chromium for screenshots, navigation, pointer hover/click, reload, and browser storage checks. Add a small browser automation harness when interaction tests begin. |
| Data checks | Use focused Node or Python checks for data shape, generated data sync, URL validation, import/export, and persistence logic. |
| Visual checks | Inspect screenshots at normal and narrower desktop window sizes after animations finish. Record layout or contrast defects as failures. |
| Scope | Desktop pointer and keyboard interaction (keyboard added in milestone 19); touch screens are out of scope. |
| Result values | `Not run`, `Pass`, `Fail`, `Blocked`, or `N/A`. Record a brief reason and evidence for failures or blocks. |

Browser tests should use existing tool permissions when available. If a browser check cannot run in this environment, mark it `Blocked` and report the gap; do not request repeated approvals for routine test runs.

## Test tiers — what to run, and when

The full matrix replays every milestone in both run modes and takes about four to five minutes. Run only checks that cover changed behavior and its direct dependencies. Use `/home/sysadmin/.venv/bin/python tests/browser_matrix.py` for milestones that have relevant automated checks.

| Tier | When | Command | Time |
| --- | --- | --- | --- |
| Docs only | Roadmap, handoff, notes, or this file | No tests | none |
| Small feature or UI edit | After a related batch of edits | Inspect or run the specific affected behavior; `--milestone N --only-new` only when its checks cover the change | Usually under a minute |
| Shared or structural change | When a change can affect multiple features or script loading | Run the relevant affected milestones; use the full matrix only if the impact spans the app | Depends on scope |
| Stability | After a timing failure or flaky check | Repeat only the failing or affected check enough to assess the fix | Depends on risk |
| Release or deployment | Before a release or deployment | One full run at the highest milestone, plus applicable manual Windows checks | About 4–5 minutes, plus manual checks |

Rules:

- Batch related steps and check their changed behavior once before committing. Documentation-only edits need no tests.
- Do not rerun historical milestones merely because a JS, CSS, or HTML file changed.
- When a defect or a flaky check is found, fix or add the test in the same change, so the regression stays covered. Record the finding in the commit message.
- The current runner includes shared checks (S01–S05) in every invocation, including `--only-new`; choose an invocation only when that cost is justified by the change.

## Shared checks — run in every invocation

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
| N01 | Both | Select Open `mstsc.exe`, reload, then select Download `.rdp` file. | The selection persists after reload and can be changed back. | Pass |
| N02 | Both | Inspect a lab planet, moon, overflow moon, and Quick find result in client mode. | Each points to the `orbit-rdp://` URI for its own host. | Pass |
| N03 | Both | Return to download mode and click a server result. | The `.rdp` file still downloads with the configured server name. | Pass |
| N04 | Windows | Install the per-user helper; click a moon and use Connect. | The browser opens Remote Desktop Connection with that moon's host prefilled. | Pass — user confirmed native launch works on Windows 11 after installing the helper. |
| N05 | Both | Switch between download and native modes in Settings. | Native mode shows the Orbit helper install commands for Windows PowerShell 5.1 and PowerShell 7, and distinguishes built-in `mstsc.exe` from MSRDC; download mode hides setup guidance. | Pass |
| N06 | Windows | Run the installer using `pwsh.exe` 7. | The registered protocol command points to that PowerShell 7 executable and opens `mstsc.exe`. | Pass — user confirmed on Windows 11 (2026-11-15): installer registered PowerShell 7.7 `pwsh.exe`, the protocol command pointed to it, and Remote Desktop Connection opened with the host populated. |

## Backlog follow-up — registry backup and editor polish

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| B01 | Windows | Re-run the installer with an existing `orbit-rdp` registration. | A new `.reg` file under `%LOCALAPPDATA%\Orbit` contains the previous key, its path is printed, and the registration is updated. | Not run — Windows is required. |
| B02 | Windows | Run the uninstaller with an existing registration. | A second `.reg` file is written and reported before the key and copied launcher are removed. | Not run — Windows is required. |
| B03 | File | Open Settings, then the Labs sun, `lab1` planet, and `lab1-server3` moon in Edit links; change the destination type. | Edit links is first in Settings; positions read 9 of 9, 1 of 5, and 3 of 5; Import `.rdp` appears only for Remote Desktop. | Pass — focused Chromium check (2026-11-16). |
| B04 | File | Inspect the Galaxy at 900 and 1920 pixels with “Confluence ABC” as a sun name; inspect Labs at 900 pixels with extra-large text. | Sun labels share one size and the phrase fits on two lines at Standard; larger moons clear the System heading and remain readable. | Pass — focused Chromium layout checks and screenshots (2026-11-16); final Galaxy sun size uses the verified 900-pixel fit at both widths. |
| B05 | File | Copy the `lab1-server1` moon from Labs to Tech → Engadget, edit the copy, and reload. | The copied destination matches the saved source; editing it leaves the original unchanged; the copy survives reload. | Pass — focused Chromium check (2026-11-16). |
| B06 | File | Save an inline HTTPS link and unsafe markup in a sun description; view Galaxy and System, then reload. | The HTTPS link opens in a new tab with `noopener noreferrer`; unsupported markup remains text; the description persists. | Pass — focused Chromium check (2026-11-16). |
| B07 | Windows | Re-run the installer and open a host-only Remote Desktop moon, then a moon with an imported profile. | Host-only launches `mstsc.exe` with `/v:` and `/prompt` without writing a connection file; the imported profile still opens through `/edit` with its settings. | Not run — Windows is required. |

## Pending UI batch checks

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| U01 | Both | Open the Galaxy and a System at normal and narrow desktop widths; use Quick find. | Search appears in the Galaxy top bar beside the map status, is hidden in Systems, and still finds suns, planets, and moons. | Pass — historical behavior, superseded by milestone 17. |
| U02 | Both | Search from the Galaxy, then click the Orbit logo; repeat after opening a System from a search result. | Quick find clears and all suns appear on the Galaxy. | Pass |

## Milestone 13 — Share selected links

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| I01 | Both | Export a sun, planet, and moon, then inspect each JSON file. | Each has the right type and only the selected item and its descendants; RDP hosts remain intact. | Pass |
| I02 | Both | Import each item into a chosen parent and reload. | Review shows the destination; imported links append, persist, and remain navigable; an imported duplicate sun gets a unique ID. | Pass |
| I03 | Both | Import malformed, mismatched, and invalid item files; cancel a valid import. | The current map stays unchanged and errors explain what went wrong. | Pass |
| I04 | Both | Export and import the entire Galaxy after scoped imports. | Full export includes all links and full import still replaces the map after review. | Pass |

## Milestone 14 — Import a planet as a sun

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| C01 | Both | Import a planet export as a sun, then reload and export the new sun. | The sun has a unique ID and contains the original planet, its destination, and all moons. | Pass |
| C02 | Both | Import the same planet twice, open its System, and follow its planet and moon entries. | Both suns remain distinct; the original destination and moons are reachable. | Pass |
| C03 | Both | Cancel a valid conversion and try mismatched or invalid files. | The current Galaxy stays unchanged and the error identifies the issue. | Pass |

## Milestone 15 — Theme names and right-side menu

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| M15-01 | Both | Open Theme in Settings after choosing Red and Blue, including after reload with older saved theme values. | Labels read Red and Blue; both retain their palettes and saved choices. | Not run — deferred at the user's request. |
| M15-02 | Both | Open the cog menu at normal and narrow desktop widths; inspect Settings, Help, About, and the editor. | The panel slides in from the right edge, scrolls when needed, and closes by button or outside click. | Not run — deferred at the user's request. |
| M15-03 | Both | Turn Animations Off and use reduced motion, then open the menu. | The panel appears immediately without a slide while all controls remain usable. | Not run — deferred at the user's request. |

## Milestone 16 — Compact Galaxy home

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| M16-01 | Both | Open the Galaxy at normal and narrow desktop widths. | The large heading and instructions are absent; all suns remain visible and reachable near the top bar. | Not run — deferred at the user's request. |
| M16-02 | Both | Open cog → Help, use Quick find, then open and leave a System. | Help contains the navigation instructions and search and System navigation still work. | Not run — deferred at the user's request. |

## Milestone 17 — Global settings and search

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| M17-01 | Both | Open the Galaxy and a System at normal and narrow desktop widths; open the cog in each. | Settings, Help, and About are available from both views and the header fits. | Not run — deferred at the user's request. |
| M17-02 | Both | Type a sun, planet, or moon query while viewing a System. | Orbit returns to Galaxy results with the query preserved; the chosen result opens correctly. | Not run — deferred at the user's request. |
| M17-03 | Both | Open a System from search results, then click the Orbit logo. | Quick find stays visible in the System, and the logo clears the query and shows all suns. | Not run — deferred at the user's request. |

## Milestone 18 — Import saved Remote Desktop profiles

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| M18-01 | Both | Import a UTF-16 little-endian `.rdp` file (`tests/rdptest01.rdp`, kept untracked) into the `lab1-server3` moon; save and reload. | Host, name, and every non-secret setting persist under the intended parent. | Pass — automated in `run_milestone_18`, both modes, 5 consecutive runs. |
| M18-02 | Both | Download an imported link's `.rdp` file, export the moon, then edit its host and download again. | The downloaded file and moon JSON (`rdpProfile`) retain settings, and `full address` follows the edited host in the saved profile and download. | Pass — automated, both modes. |
| M18-03 | Both | Import a synthetic profile with password, token, secret, and signature settings; try malformed, missing-address, duplicate-address, bad-host, NUL, oversized, over-launch-limit, and invalid-encoding files. | Secrets are omitted; each invalid file shows an error and leaves the saved map and form host unchanged. | Pass — automated with in-memory fixtures, both modes. |
| M18-04 | Windows | Reinstall the Orbit helper and open an imported profile in native mode. | `mstsc.exe /edit` opens with the imported settings and correct host; the browser's external-app prompt still works. | Pass — user confirmed the updated helper fixed native profile launch on Windows. |

## Milestone 19 — Keyboard navigation

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| K01 | Both | Focus a Galaxy sun and press Tab. | The sun's planets become focusable in order, then each planet's moons appear and receive focus; the focused item shows a visible ring. | Pass — automated (`milestone_19.py`). |
| K02 | Both | Open a System, focus a planet, and press Tab. | Its moons appear and receive focus with a visible ring. | Pass — automated. |
| K03 | Both | Open the menu with the keyboard, then press Tab and Shift+Tab repeatedly. | Focus moves into the menu on open and never leaves it while it is open. | Pass — automated. |
| K04 | Both | Press Escape with the menu open, then with Quick find filled, then in a System. | Each press closes only the top layer: menu (focus returns to the cog), then Quick find, then the System. | Pass — automated. |
| K05 | Both | Press `/`, type a query, and use Down and Up Arrow and Enter in the results. | `/` focuses Quick find (not while typing in a field or with the menu open); arrows move between results and back to the field; Enter opens the result. | Pass — automated. |
| K06 | Both | Use arrow keys on suns, planets, and moons. | Arrows move between suns by position, between sibling planets and moons, down into moons, and up to the planet. | Pass — automated. |
| K07 | Both | Read cog → Help. | The keyboard shortcuts are described. | Pass — automated. |
| K08 | Both | Keyboard only: search, open a System, reach a moon, open a destination, open and close the menu, return to the Galaxy. | Every step works with a visible focus indicator throughout. | Pass — automated. |

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
| 11 — Labs and Remote Desktop | 2026-11-15 | S01–S05 and D01–D05 passed in Playwright in both run modes; RDP file contents and 900-pixel Labs screenshot inspected. Bundled lab hostnames remain examples. | Milestone 11: Labs and Remote Desktop |
| 12 — Native Windows launch | 2026-11-15 | S01–S05 and N01–N03 and N05 passed in Playwright in both run modes; the user confirmed N04 on Windows 11 after installing the helper. | Milestone 12: Native Windows launch |
| 12 follow-up — Setup guidance | 2026-11-15 | S01–S05 and N05 passed in both run modes; the 900-pixel Settings view was inspected. PowerShell scripts now document their behavior. | Explain Orbit's mstsc helper setup |
| 12 follow-up — PowerShell fallback | 2026-11-15 | Installer selection and setup text updated for PowerShell 7; N05 browser check passed. N06 later passed on Windows. | Support PowerShell 7 in Orbit installer |
| 13 — Share selected links | 2026-11-15 | S01–S05, U01–U02, and I01–I04 passed in both run modes; all earlier milestones passed in the full matrix; 900-pixel editor screenshot inspected. | Milestone 13: Share selected links |
| 14 — Planet as sun | 2026-11-15 | S01–S05 and C01–C03 passed in both run modes; all earlier milestones passed in the full matrix; 900-pixel review screenshot inspected. | Milestone 14: Import planet as sun |
| 18 — Import saved Remote Desktop profiles | 2026-11-15 | M18-01 to M18-03 automated and passed in both run modes (`--milestone 18 --only-new`, 5 consecutive runs); M18-04 confirmed by the user on Windows. Fixture values were not logged or committed. | Milestone 18: Import saved Remote Desktop profiles |
| 19 — Keyboard navigation | 2026-11-16 | K01–K08 automated and passed in both run modes; `--milestone 19 --only-new --repeat 5` passed 5 of 5, and the full matrix passed once as the commit gate. Focus screenshots inspected. | Milestone 19: Keyboard navigation |
