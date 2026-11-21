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
| B01 | Windows | Re-run the installer with an existing `orbit-rdp` registration. | A new `.reg` file under `%LOCALAPPDATA%\Orbit` contains the previous key, its path is printed, and the registration is updated. | Pass — Windows 11 VM (2026-11-19): a fresh install wrote no backup; re-installing over a changed registration exported it (with the previous command) to a new `.reg` file, printed its path, and restored the launcher command. |
| B02 | Windows | Run the uninstaller with an existing registration. | A second `.reg` file is written and reported before the key and copied launcher are removed. | Pass — Windows 11 VM (2026-11-19): the uninstaller wrote and printed a second `.reg` backup, then removed the key and the copied launcher. |
| B03 | File | Open Settings, then the Labs sun, `lab1` planet, and `lab1-server3` moon in Edit links; change the destination type. | Edit links is first in Settings; positions read 9 of 9, 1 of 5, and 3 of 5; Import `.rdp` appears only for Remote Desktop. | Pass — focused Chromium check (2026-11-16). |
| B04 | File | Inspect the Galaxy at 900 and 1920 pixels with “Confluence ABC” as a sun name; inspect Labs at 900 pixels with extra-large text. | Sun labels share one size and the phrase fits on two lines at Standard; larger moons clear the System heading and remain readable. | Pass — focused Chromium layout checks and screenshots (2026-11-16); final Galaxy sun size uses the verified 900-pixel fit at both widths. |
| B05 | File | Copy the `lab1-server1` moon from Labs to Tech → Engadget, edit the copy, and reload. | The copied destination matches the saved source; editing it leaves the original unchanged; the copy survives reload. | Pass — focused Chromium check (2026-11-16). |
| B06 | File | Save an inline HTTPS link and unsafe markup in a sun description; view Galaxy and System, then reload. | The HTTPS link opens in a new tab with `noopener noreferrer`; unsupported markup remains text; the description persists. | Pass — focused Chromium check (2026-11-16). |
| B07 | Windows | Re-run the installer and open a host-only Remote Desktop moon, then a moon with an imported profile. | Host-only launches `mstsc.exe` with `/v:` and `/prompt` without writing a connection file; the imported profile still opens through `/edit` with its settings. | Pass — Windows 11 VM (2026-11-19). Scripted: opening `orbit-rdp://` links through Windows started `mstsc.exe /v:b07-host.lab:3390 /prompt` with no Connections folder, and a profile link started `mstsc.exe /edit` on a file holding its settings. Interactive, in a signed-in Remote Desktop session with visible Edge: clicking Orbit's lab1-server1 moon in "Open mstsc.exe" mode showed Edge's open-link prompt; after Open, Remote Desktop Connection appeared for lab1-server1 (`/v:lab1-server1 /prompt`, session 2). A lab1-server2 moon with a synthetic imported profile opened the edit view with its 1280×720 settings (confirmed by the user and by the written connection file). |
| B08 | File | Open Edit links at 900 pixels, navigate from the persistent map tree, move a moon to another planet and a planet to another sun, then close and reopen Settings. | The workspace fills the viewport; both moves preserve their destinations and children; the tree updates; Settings returns to its normal panel. | Pass — focused Chromium check and screenshot (2026-11-16). |
| B09 | Server | Repeat B08 through the local server. | The workspace and cross-parent moves behave the same. | Pass — `tests/pending_checks.py` in Chromium (both modes) and Edge 157 on the VM (file and server, 2026-11-19). Also checks that only the tree and pane scroll. |
| B10 | File | Pick a folder containing two `.rdp` files and an unrelated file, then import two `.rdp` files as moons. | The folder import adds only the two profiles as planets; multi-file import adds both as moons; excluded secrets do not persist. | Pass — focused Chromium check (2026-11-16); file selection order is browser-defined. |
| B11 | Both | Drop a folder or files into the batch area and include an invalid `.rdp` file in a batch. | Drop reads the files; an invalid profile leaves the current map unchanged and disables Add. | Pass — `tests/pending_checks.py` in Chromium (both modes) and Edge 157 (2026-11-19). Files are dropped with a synthetic `DataTransfer`; a real folder drag from Explorer was not simulated. |

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
| M15-01 | Both | Open Theme in Settings after choosing Red and Blue, including after reload with older saved theme values. | Labels read Red and Blue; both retain their palettes and saved choices. | Pass — `tests/pending_checks.py` in Chromium (both modes) and Edge 157 on the VM (file and server, 2026-11-19). |
| M15-02 | Both | Open the cog menu at normal and narrow desktop widths; inspect Settings, Help, About, and the editor. | The panel slides in from the right edge, scrolls when needed, and closes by button or outside click. | Pass — `tests/pending_checks.py` in Chromium (both modes) and Edge 157 on the VM (file and server, 2026-11-19). |
| M15-03 | Both | Turn Animations Off and use reduced motion, then open the menu. | The panel appears immediately without a slide while all controls remain usable. | Pass — `tests/pending_checks.py` in Chromium (both modes) and Edge 157 on the VM (file and server, 2026-11-19). |

## Milestone 16 — Compact Galaxy home

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| M16-01 | Both | Open the Galaxy at normal and narrow desktop widths. | The large heading and instructions are absent; all suns remain visible and reachable near the top bar. | Pass — `tests/pending_checks.py` in Chromium (both modes) and Edge 157 on the VM (file and server, 2026-11-19). |
| M16-02 | Both | Open cog → Help, use Quick find, then open and leave a System. | Help contains the navigation instructions and search and System navigation still work. | Pass — `tests/pending_checks.py` in Chromium (both modes) and Edge 157 on the VM (file and server, 2026-11-19). |

## Milestone 17 — Global settings and search

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| M17-01 | Both | Open the Galaxy and a System at normal and narrow desktop widths; open the cog in each. | Settings, Help, and About are available from both views and the header fits. | Pass — `tests/pending_checks.py` in Chromium (both modes) and Edge 157 on the VM (file and server, 2026-11-19). |
| M17-02 | Both | Type a sun, planet, or moon query while viewing a System. | Orbit returns to Galaxy results with the query preserved; the chosen result opens correctly. | Pass — `tests/pending_checks.py` in Chromium (both modes) and Edge 157 on the VM (file and server, 2026-11-19). |
| M17-03 | Both | Open a System from search results, then click the Orbit logo. | Quick find stays visible in the System, and the logo clears the query and shows all suns. | Pass — `tests/pending_checks.py` in Chromium (both modes) and Edge 157 on the VM (file and server, 2026-11-19). |

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

## Backlog 9 — Drag-and-drop organization

Run with `/home/sysadmin/.venv/bin/python tests/drag_drop.py --phase 2` (all rows; `--phase 1` stops after DD09; `--only TEXT` runs the checks whose function name contains TEXT; file mode and a temporary local server, synthetic fixture with repeated names, overflow items, and synthetic RDP profiles). Expected maps are built in the test with plain list operations, not with the app's move helper.

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| DD01 | Both | Call the shared move operation directly. | A planet or moon moves to the end of the new parent by path; the current parent is a no-op; wrong kinds and missing paths are invalid; the input is never changed; an RDP profile survives. | Pass — automated (`drag_drop.py`, 2026-11-16). |
| DD02 | Both | Toggle Edit mode; click, Enter, and Space on planets and moons; use Quick find. | Off after reload; On keeps web links, RDP downloads, and `orbit-rdp:` links closed; a search result opens that exact item in Edit links; a sun still opens its System. | Pass — automated. |
| DD03 | Both | Press Escape with the menu open, in Edit mode, and with Quick find filled. | Each press closes one layer: menu, then drag, then Edit mode, then Quick find. | Pass — automated. |
| DD04 | Both | Galaxy: drag a planet with moons to another sun; reload; export. | The stored map, reload, Export JSON, and editor tree match; nothing is saved during pointer movement; no tab or download opens. | Pass — automated. |
| DD05 | Both | Galaxy: drag a moon to another planet, and to a planet under another sun. | Pausing on the other sun reveals its planets; the source stays visible; the moon is appended. | Pass — automated, animations on. |
| DD06 | Both | System: drag stage, More planets, More moons, and overflow-planet moons to the stage and the destination tray. | Each exact item moves, including RDP profiles; the tray closes; scroll position and focus are kept. | Pass — automated. |
| DD07 | Both | Drop on the current parent, outside, and on a wrong kind; cancel by Escape, pointercancel, blur, menu, route change, and Edit mode Off; fail the save; change the map mid-drag. | The stored and in-memory maps are unchanged, overlays are cleared, a readable message appears, and another tab's map is never overwritten. | Pass — automated. |
| DD08 | Both | Undo last drag. | Only the last drag is reversed; a later edit or another tab's change retires it; the removal Undo record is untouched. | Pass — automated. |
| DD09 | Both | 900 and 1280 pixels, three themes, four text sizes, reduced motion. | Edit mode controls fit without horizontal scrolling and a drag works in each. | Pass — automated; screenshots inspected at 900 pixels with Extra large text. |

| DD10 | Both | Call the move operation with a sibling and `before` or `after`. | First-to-last, last-to-first, adjacent, same-array index adjustment, and cross-parent insertion give the expected arrays; a sun keeps its ID and descendants; self-drops and mixed kinds are invalid. | Pass — automated (2026-11-16). |
| DD11 | Both | Galaxy: drag a sun onto another sun and choose Before or After. | The cards and System index follow the new order; the System address still works; a drop without a choice changes nothing; Undo restores the order. | Pass — automated; choices screenshot inspected. |
| DD12 | Both | Reorder planets in the Galaxy, on the System stage, through More planets, and through the tray; insert under another sun. | The stored order matches; the Galaxy first-five and System first-eight boundaries follow it. | Pass — automated. |
| DD13 | Both | Reorder moons on the stage and from More moons; insert beside a moon of another planet on the stage, through the tray, and in the Galaxy. | Pausing on a planet shows its moons; the stored order matches; the first-four boundary follows it. | Pass — automated; choices screenshot inspected. |
| DD14 | Both | Drop on the current position, press Escape over a choice, and fail the save during a reorder. | The order is unchanged and the choices and markers are cleared. | Pass — automated. |
| DD15 | Both | Edit links: Move to another sun or planet with a Position. | The item is inserted before the chosen sibling; the editor tree, Export JSON, reload, and Quick find order all follow. | Pass — automated. |
| DD16 | Both | Reorder a sun, move and insert planets and moons in the Galaxy and a System (stage, More moons, tray), undo one move, then Export JSON and import the file into a clean browser. | The downloaded file equals the expected map: sun IDs in the new order, RDP profiles intact, no item lost or duplicated; importing it reproduces the same stored map. | Pass — automated, real download. |

| DD17 | Windows Edge, file | Run DD01–DD16 in Microsoft Edge 157.0.4341.60 on the Windows 11 test VM: `tests/drag_drop.py --phase 2 --cdp http://127.0.0.1:9333 --url file:///C:/orbit-drag-test/index.html`, against a `git archive` of the Phase 2 commit plus the synthetic fixture, with a fresh Edge profile and the DevTools port forwarded over SSH to loopback only. | Every check passes with real pointer input at 1280 by 900 (DD09 also at 900 pixels). | Pass (2026-11-16). Limits: Edge ran headless, not as an interactive window; Export JSON was read from the bytes the page produced, not from a saved file, and DD04's export step is skipped remotely; server mode was not run on Windows. The guest folder and profile were removed afterwards. |

## Planet and moon sizing — six moons

Run with `/home/sysadmin/.venv/bin/python tests/orbit_sizes.py` (file mode and a temporary local server, 1920×1080, synthetic fixture with long names, a planet with eight moons, and planets with five and four moons). The drag-and-drop suite and the full matrix also cover this change, because they assume the visible-moon limit.

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| OS01 | Both | Show a Galaxy sun whose planets are named "Basic Confluence", "International", "Documentation Hub", and "Telecommunications". | No word is split across lines; every Galaxy planet has the same, larger size. | Pass — automated (`orbit_sizes.py`, 2026-11-17). |
| OS02 | Both | Hover a planet with eight moons. | Six moons orbit and are visible; no moon label splits a word. | Pass — automated. |
| OS03 | Both | Hover that planet when it is the top planet of a first-row sun. | The highest moon stays on screen. | Pass — automated. |
| OS04 | Both | Move from that planet straight to its neighbour. | The neighbour's moons appear and the first planet's moons hide. | Pass — automated. |
| OS05 | Both | In the System, compare planets with six, five, and four moons, then hover a lower planet. | Five and six moons sit at least 20 px farther out than four; System planet labels stay whole; the lower planet's moons end above the note under the System (2026-11-19). | Pass — automated. |
| OS06 | Both | Read More moons for the eight-moon planet. | The seventh and eighth moons are listed. | Pass — automated. |
| OS07 | Windows Edge, file | Run OS01–OS06 in Microsoft Edge 157.0.4341.60 on the Windows 11 test VM at 1920×1080: `tests/orbit_sizes.py --cdp http://127.0.0.1:9333 --url file:///C:/orbit-size-test/index.html`, against a `git archive` plus the fixture from `--write-fixture`, with a fresh profile and the DevTools port forwarded over SSH to loopback only. | Every check passes with Windows fonts; screenshots match Chromium. | Pass (2026-11-19). Limits: headless Edge; server mode not run on Windows. `drag_drop.py --phase 2` also passed in Edge against the same build. Guest folders and profile removed afterwards. |

## Feature batches — 2026-11-19 and 2026-11-20 (F01–F26)

Run with `/home/sysadmin/.venv/bin/python tests/features.py` (file mode, and serve.py's handler with `--team` in server mode; a synthetic map whose web links point at a local test site with good pages, a 404, and a favicon; a team map with one sun). For Edge on the VM: `--write-fixture DIR --target http://127.0.0.1:8774`, then `--cdp http://127.0.0.1:9333 --url ... --target ... [--server-mode]` with the target site and Orbit served on this host and tunnelled. There is no F05: lab reachability was declined.

| ID | Mode | Check | Pass condition | Result |
| --- | --- | --- | --- | --- |
| F01 | Both | Open a link from Quick find, star a moon, reload, open a chip, use a chip in Edit mode, hide the row, clear Recent. | Favorites and Recent appear above the Galaxy, survive reload, update when a link opens, open Edit links in Edit mode, and follow the settings; the favorite is saved on the item. | Pass — Chromium and Edge (2026-11-19). |
| F02 | Both | Use Open all on a planet with two web moons, Shift+click a planet, Open all on Remote Desktop links, simulate blocked pop-ups, and Cancel. | All tabs open (or the blocked ones are counted, as Edge does after the first), Remote Desktop links are left out with a count, blocked tabs are reported with how to allow pop-ups, and Cancel opens nothing. | Pass — Chromium (all tabs) and Edge (first tab, rest reported blocked). Confirmed by hand in visible Edge (2026-11-20): after “Always allow pop-ups” for the site, all three tabs opened and Orbit reported “Opened 3 tabs”. |
| F03 | Both | Search a short form, an address, `#docs`, `tag:prod`, a typo, a sun name alone, a sun name with a moon name, and nonsense. | Each finds the expected items, results show why and their tags, a sun name alone lists only the sun, and the empty message explains the options. | Pass — Chromium and Edge. |
| F04 | Both | Open the palette with Ctrl+K, open a moon, list Open all, move with arrows, close with Escape, run a command, open Edit links in Edit mode, try it over the menu. | The palette takes focus, runs the highlighted entry, closes first on Escape and returns focus, and stays closed while the menu is open. | Pass — Chromium and Edge. |
| F06 | Both | Apply a moon's imported settings to a planet and its moons, clear one, then apply from a file with a password. | Each target gets the settings with its own computer, Clear affects only the chosen links, and the password is never kept. | Pass — Chromium and Edge. |
| F07 | Both | Save an invalid tag, then mixed-case repeated tags; use the tag list. | Invalid tags are refused; tags are saved lowercase without repeats; the tree and start screen show them; a tag runs its search. | Pass — Chromium and Edge. |
| F08 | Server (file shows guidance) | Run Check links; open a failure; call the API without the Orbit header, as text, with a foreign Origin, and from another site's page. | The 404 page is reported with its status and marked in the tree, good pages pass, and every foreign request is refused (403 or blocked by the browser). | Pass — Chromium and Edge (both modes). |
| F09 | Both | Rename and remove a planet, read History, restore, then save and reset. | Each change is listed with its difference; Restore brings the version back and is itself recorded; resets and other saves are kept. | Pass — Chromium and Edge. |
| F10 | Both | Find duplicates; open one; open a unique link. | The shared address is listed with both places; the editor notes the duplicate; a unique link has no note. | Pass — Chromium and Edge. |
| F11 | Both | Import a map with a matching sun, a matching planet (different name and fragment), a new moon, a new planet, and a new sun; import it again. | The review counts what is new; Merge adds only that and changes nothing existing; the second import has nothing to merge; Replace is offered. | Pass — Chromium and Edge. |
| F12 | Both | Load a team map; search and favorite a team link; drag a team planet; view and copy it; export; hide and show the team sun. | Team suns come first marked TEAM, are searchable and favorable, cannot be dragged or edited, copy as ordinary links, are never saved or exported, and can be hidden and shown. | Pass — Chromium and Edge (both modes). |
| F13 | Both | Import a bookmarks file with a bar, folders, a subfolder, a script link, and a loose link. | The review counts links and skipped ones; Merge creates suns from folders, a planet with moons from the subfolder, homes for loose links, and no script links; Replace is not offered. | Pass — Chromium and Edge. |
| F14 | Both | Set a too-long and an emoji sun icon; turn on site icons. | Long icons are refused; the emoji shows in the tree and hub; icons come from each site, Remote Desktop links have none, a loading icon stays, a failing one is removed, and circles leave room. | Pass — Chromium and Edge. |
| F15 | Both | Switch to List view; open a link; Tab; reload; open a System; search; use Edit mode; switch back. | Every sun, planet, and moon is listed; links open; the view is remembered; Quick find and Open System work; Edit mode explains dragging and opens Edit links. | Pass — Chromium and Edge. |
| F16 | Both | Star two links; use Open all on the Favorites row; look for it in the palette and in Edit mode. | Every favorite opens (or blocked tabs are reported); the palette offers Open all favorites; Edit mode hides the button. | Pass — Chromium and Edge (2026-11-20). |
| F17 | Both | Create a routine with a moon, a Remote Desktop planet, a team planet, and a planet; try a duplicate name; rename one link and remove another; run it; use the palette, Edit mode, History, Export, Merge import, and Remove. | Links are saved in map order by destination; duplicate names are refused; renames survive and removals are counted; the chip opens web links without asking and reports what was left out; every other surface knows the routine. | Pass — Chromium and Edge. |
| F18 | Both | Schedule routines due now, later today, and on another day; use Not today and Open; reload; share the banner; toggle Edit mode; save a schedule in the editor. | Only due routines are offered, once a day, after Open or Not today; due routines share the banner; Edit mode hides it; the editor saves the time and days. | Pass — Chromium and Edge. |
| F19 | Both | Save a note; hover; search its words; open the list view; try 501 characters. | The note is saved, shown in the tooltip, search (with why), and list view; longer notes are refused. | Pass — Chromium and Edge (2026-11-20). |
| F20 | Both | Add a `{ticket}`/`{env}` link; Open all before and after giving values; open it from Quick find and the quick bar; cancel with Escape; save an unmatched brace. | Open all leaves it out until values exist, then uses them; the form asks, previews with encoding, opens the filled address, remembers values, and records it as recent; Escape opens nothing; a broken address is refused. | Pass — Chromium and Edge. |
| F21 | Both | Type an address into Quick find; add it to a sun; add another from the palette as a moon; open Add a link empty. | Quick find offers Add this link, prefilled with a suggested name; targets are personal suns and planets only; planets and moons are added and opened in the editor. | Pass — Chromium and Edge. |
| F22 | Both | Add an empty and a copied workspace; switch from the top bar and palette; change one; reload; rename; remove; try to remove Main. | Each workspace has its own storage and map; the team map stays; the open workspace is remembered; Main cannot be removed. | Pass — Chromium and Edge. Proven to fail when every workspace shares Main's storage. |
| F23 | Both | Share a routine; share no favorites; paste a pack with one new link; paste a non-pack. | The pack has the links and routine (no moons or passwords); the review counts new links; only new links are added; the routine is added under a free name; other files are refused. | Pass — Chromium and Edge. |
| F24 | Both | Reach 20 changes; Remind me later; 14 days with one change; Back up now; Edit links; turn reminders off. | Reminders appear only when due, wait after Remind me later, export and reset on Back up now, show in Edit links, and stop when turned off. | Pass — Chromium and Edge. |
| F25 | Both | Load a team map, then pretend an older version was seen; show and dismiss. | The first load is quiet; changes are counted, listed (new links open), and dismissed until the next change. | Pass — Chromium and Edge. |
| F26 | Both | Build a preset from choices; try a password; save with an address line; choose it for a moon; apply it to a planet's moons; remove it. | Choices write settings; passwords are refused and addresses dropped; links open with the preset and their own computer; removing it clears it and imported settings remain. | Pass — Chromium and Edge. |
| F27 | Both | In a new empty workspace, Reset to file data, then reload; in Main, make a change and Reset. | The other workspace shows the file data, saves it to its own key, and still shows it after a reload; Main's Reset removes its saved map as before and leaves the other workspace alone. | Pass — Chromium and Edge 158 (2026-11-20). Failed before the fix. |

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
| Backlog 9 — Drag-and-drop | 2026-11-16 | DD01–DD16 passed in Chromium in both run modes and in Edge on the Windows VM (DD17); `--milestone 19 --only-new` passed once as a regression check. Drag, tray, and placement screenshots inspected. The full matrix was not run. | Backlog 9 phase 1; Backlog 9 phase 2 (merged to `main` by pull request #1, 2026-11-17) |
| Planet sizing and six moons | 2026-11-17 | OS01–OS06 passed in both run modes; the full matrix (`--milestone 19`) and `drag_drop.py --phase 2` passed in Chromium. Milestone 2, 10, and 11 checks and the drag-and-drop fixture were updated for six visible moons and the 20px sun label. Not run in Edge on the VM. Galaxy and System screenshots inspected at 1920×1080. | Size planets and moons to their labels; show six moons |
| Sizing — Edge pass and System note room | 2026-11-19 | OS01–OS06 (with the new OS05 note check) and DD01–DD16 passed in Edge 157 on the Windows VM (OS07, DD17 repeated); the full matrix, `drag_drop.py --phase 2`, and `orbit_sizes.py` passed in Chromium in both run modes. The Edge screenshots showed a lower planet's moons covering the System note in both browsers; fixed and rechecked. | Keep System moons clear of the note; run sizing checks in Edge |
| Deferred checks — B01–B02, B07, B09, B11, milestones 15–17 | 2026-11-19 | New `tests/pending_checks.py` (21 checks) passed in Chromium in both run modes and in Edge 157 on the Windows VM in file mode and, through an SSH tunnel to a local server, server mode; `orbit_sizes.py` and `drag_drop.py --phase 2` also passed in Edge in both modes; B01, B02, and B07 passed on the VM with PowerShell 5.1; the full matrix passed in Chromium. Fixed: the full-screen editor showed two scrollbars on Windows, and counts of one read "1 moons"/"1 planets". Not done: an interactive Edge window (no desktop session on the VM). | Run the deferred checks; fix the editor scrollbars and singular counts |
| Visible Edge pass | 2026-11-19 | With the user signed in to the VM over Remote Desktop, Edge 157 ran as a normal window in that session (started by a scheduled task; user agent without "HeadlessChrome"). `pending_checks.py`, `orbit_sizes.py`, and `drag_drop.py --phase 2` all passed in it in file and server mode, and B07 was repeated with the real Edge prompt and Remote Desktop window. No code changes. | Record the visible Edge pass |
| Feature batch (ideas 1–4, 6–15) | 2026-11-19 | `tests/features.py` F01–F15 passed in Chromium (file and server) and in headless Edge 157 on the Windows VM (file, and server through the SSH tunnel); the full matrix, `drag_drop.py --phase 2`, `orbit_sizes.py`, and `pending_checks.py` passed in Chromium and (except the full matrix) in Edge in both modes. Two checks were proven to fail by breaking merge import and the tag filter. Existing tests updated: Import JSON now offers Merge or Replace, Quick find ranks better matches first, and a drag check expects "1 moon". | Add favorites, search, palette, tools, team map, list view, and icons |
| Feature batch — visible Edge pass | 2026-11-20 | With the user signed in over Remote Desktop, a normal Edge 157 window ran `features.py` (F01–F15), `pending_checks.py`, `orbit_sizes.py`, and `drag_drop.py --phase 2` in file and server mode; all passed. The user confirmed Open all by hand: Edge allowed one tab and Orbit reported two blocked; after allowing pop-ups, all three opened. No code changes. | Record the visible Edge pass of the feature batch |
| Routines batch (ideas 16–18) | 2026-11-20 | F16–F18 added to `tests/features.py`; all of F01–F18 passed in Chromium (file and server) and headless Edge 157 on the VM (both modes); the full matrix, `drag_drop.py --phase 2`, `orbit_sizes.py`, and `pending_checks.py` passed in Chromium, and all but the full matrix in Edge. F18 was proven to fail by breaking the once-a-day rule. F14's failing-icon check now uses a closed local port instead of an unknown domain, which was slow under load. | Add routines, Open all favorites, and arrival offers |
| Batch 3 (ideas 19–26) | 2026-11-20 | F19–F26 added to `tests/features.py`; all of F01–F26 passed in Chromium (file and server) and headless Edge 157 on the VM (both modes); the full matrix, `drag_drop.py --phase 2`, `orbit_sizes.py`, and `pending_checks.py` passed in Chromium, and all but the full matrix in Edge. F22 was proven to fail by breaking workspace storage. The backup reminder's button is “Back up now” so it does not clash with Export JSON in tests. | Add notes, placeholders, quick add, workspaces, link packs, backup reminders, team updates, and RDP presets |
| Fix: Reset in other workspaces (2.2.1) | 2026-11-20 | Found by the rewrite plan review: Reset to file data in a workspace other than Main showed the sample map, then an empty map after a reload. New F27 failed first, then passed after the fix; all of F01–F27 and milestones 1–13 (which use Reset in Main) passed in Chromium in both modes; F20–F27 passed in headless Edge 158 on the VM in both modes. | Keep Reset's map in workspaces other than Main |
