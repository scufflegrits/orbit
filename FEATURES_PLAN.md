# Feature batch plan — 2026-11-19

**Status:** Complete (2026-11-19, version 2.0.0). Implemented, tested in Chromium and in headless Edge on the Windows VM (both run modes), documented, and committed to `main`. A visible-window Edge pass of these features was not done. Tick a box only when that step is done. Testing waits until every feature is implemented (the user asked for this), then follows the usual cycle: local tests → Edge on the Windows VM → fix → docs → commit and push to `main`.

**Scope:** ideas 1–4 and 6–15 from the 2026-11-19 list. Idea 5 (lab reachability) and touchscreen dragging are out of scope.

**Ground rules (apply to every item):**
- Orbit keeps working from `file://` and through `serve.py`. Anything that needs the server says so in the UI when opened from a file, instead of failing silently.
- Browser edits stay in `localStorage`. New map fields are optional, validated in `validateMap`/`validDestination`, kept on export, and ignored by older versions.
- Edit mode, drag-and-drop, keyboard navigation, Quick find, and the editor keep working. Planets and moons can repeat names; never identify them by name alone.
- Nothing contacts a third-party service. Site icons, if turned on, come only from each site itself.
- The smallest supported screen is 1920×1080; checks still use 1280 and 900 pixels where the matrix already does.

## 0. Shared groundwork

- [x] Remove the duplicate `counted()` from `drag.js` (the one in `render.js` stays).
- [x] Map schema additions, validated and normalized in `storage.js`:
  - [x] Planets and moons: optional `tags` (lowercase, 1–24 chars of `a-z 0-9 -`, at most 8, no duplicates) and optional `favorite: true`.
  - [x] Suns: optional `icon` (1–2 characters, for example an emoji).
  - [x] Fields are dropped when empty, so existing maps and exports stay unchanged.
- [x] A destination key helper: normalized URL (lowercase scheme and host, default port removed, fragment removed, trailing `/` removed from the path) or `rdp:` + lowercase host[:port]. Used by recent, duplicates, merge import, and broken-link results.
- [x] Add any new script to `index.html` and `APP_SCRIPTS` in `tests/helpers.py`.

## 1. Recent and favorites

- [x] Record each opened planet or moon (click, keyboard, Quick find, command palette) in `orbit:recent:v1`: destination key, name, and time; newest first, at most 10, no repeats. Links whose destination no longer exists are hidden.
- [x] Favorite toggle: a "Favorite" checkbox in the planet and moon editors, and a star button on Quick find results. Stored as `favorite: true` on the item, so it moves with drags and exports.
- [x] Galaxy quick bar under the top bar: "Favorites" then "Recent", as compact chips that open the destination the same way the map does (web tab, RDP download or launch). Hidden when both are empty.
- [x] Setting: "Show favorites and recent" (on by default) and a "Clear recent" button.
- [x] Edit mode: chips open the item in Edit links instead of launching it (same rule as Quick find).

## 2. Open a whole planet at once

- [x] "Open all" opens a planet and its web moons in new tabs. RDP destinations are skipped, with a count shown.
- [x] Entry points: Shift+click on a planet in the Galaxy or System, an "Open a planet with all its moons" row of buttons under each System (one per planet with moons), and the command palette.
- [x] Ask before opening more than one tab ("Open 5 tabs?"). If the browser blocks pop-ups (`window.open` returns null), say how many were blocked and how to allow pop-ups for Orbit.
- [x] Each opened link counts as a recent entry.

## 3. Smarter Quick find

- [x] Search the name, the sun and planet path, the URL host and path, the RDP host, and tags.
- [x] Every word of the query must match somewhere (so "lab1 s3" finds lab1 → lab1-server3).
- [x] Word matching, best first: exact, prefix, contains (3+ letters), short form (letters then a number, for example `s3` matches `server3`), then typo tolerance (1 edit for 5+ letters, 2 for 9+).
- [x] `#tag` or `tag:name` limits results to that tag.
- [x] Rank by match quality, then map order. Results show why they matched when it was not the name (for example the host) and show tags.

## 4. Command palette (Ctrl+K)

- [x] Ctrl+K (and Cmd+K) opens a centered palette from any view when no menu is open; Escape or a click outside closes it and returns focus.
- [x] It uses the same search as Quick find. Enter opens the highlighted result directly: web in a new tab, RDP by the current Remote Desktop setting, a sun opens its System.
- [x] Commands are also listed when they match: Toggle Edit mode, Open Settings, Edit links, Help, "Open all: <planet>", Clear recent.
- [x] Arrow keys and Page Up/Down move, Ctrl+Home/End jump (plain Home/End stay in the search box), the list scrolls, and results are announced. In Edit mode a planet or moon result opens Edit links (same as Quick find).
- [x] Add it to Help and to the Escape order (palette closes before the menu rule applies).

## 6. Bulk Remote Desktop settings

- [x] In the editor for a planet with RDP moons: "Apply RDP settings to moons".
- [x] The source is an `.rdp` file or an existing moon's imported profile. Show the settings and which moons get them (optionally the planet too).
- [x] Each target keeps its own computer: its `full address` is rewritten to its host (`parseRdpProfile(text, host)`). Passwords, tokens, and signatures are excluded as in single import.
- [x] "Clear imported settings" removes the profiles from all RDP moons of the planet.
- [x] One saved change, so it can be undone through version history (item 9).

## 7. Tags

- [x] Tags field (comma-separated) in the planet and moon editors, validated as in groundwork.
- [x] Tags show on Quick find and palette results and in the editor tree as small chips.
- [x] Filtering by `#tag` (item 3); the editor lists all tags in use with counts on the Edit links start screen, and selecting a tag runs that search.

## 8. Broken-link check (server mode)

- [x] `serve.py`: `POST /api/check-links` with `{"urls": [...]}` (http/https only, at most 500). It returns `{url: {ok, status, error}}`, tries HEAD and falls back to GET, uses an 8-second timeout, 8 at a time, follows up to 5 redirects within http/https, and never returns page content.
- [x] Guard against other web pages using it: require `Content-Type: application/json` and a custom `X-Orbit-Check: 1` header (forces a CORS preflight, which is never approved), check that `Host` and `Origin` are this server, and keep binding to 127.0.0.1.
- [x] Editor start screen: "Check links". In file mode it explains that `python3 serve.py` is needed. In server mode it shows progress, then lists the failures (name, path, status or error) with Edit buttons, and marks them in the tree for this session.
- [x] RDP destinations are not checked (out of scope, like idea 5).

## 9. Version history

- [x] Every saved map change (editor, drag, import, reset, bulk RDP) first stores the previous map in `orbit:history:v1`: time, a short label for the change, and the map. Keep the last 20; drop the oldest if storage is full, and never block the save.
- [x] Editor start screen: "History" lists versions with time, label, and counts (suns, planets, moons), plus what changed compared with the current map (added or removed counts).
- [x] "Restore" applies that version as a new save (so a restore can itself be undone).
- [x] The existing single-removal Undo and drag Undo keep working as they are.

## 10. Duplicate finder

- [x] Editor start screen: "Find duplicates" groups items with the same destination key, listing each one's path with an Edit button.
- [x] The planet and moon editors show a non-blocking note when the destination already exists elsewhere ("Also in Tech → Engadget").
- [x] A moon copied on purpose still shows as a duplicate; the note explains this is informational.

## 11. Merge import

- [x] Import JSON reviews the file and offers "Merge into my map" (new default) or "Replace my map".
- [x] Merge rules: a sun matches by id, then by name (ignoring case); a planet matches inside its sun by destination key; a moon matches inside its planet by destination key. Unmatched items are appended in file order; matched items are left unchanged, and new moons of a matched planet are added to it.
- [x] The review shows what will be added (suns, planets, moons) and what is skipped as already present. Applying it is one saved change.

## 12. Read-only team map

- [x] A team map is an ordinary Orbit map file, loaded read-only:
  - [x] Server mode: `python3 serve.py --team PATH` serves it at `/team.json`. Without the option the request returns 404 and Orbit shows no team suns.
  - [x] File mode: `python3 sync.py --team PATH` writes `team-data.js` (`window.ORBIT_TEAM_DATA`), which `index.html` loads if present.
- [x] The Galaxy shows team suns first, with a "Team" mark, then the personal map. The team suns are refreshed on every load and never saved into personal storage or exports (Export JSON exports the personal map; a separate "Export team map" is not needed).
- [x] Team items are read-only: no drag source or target, no editor changes. The editor shows them with "Copy to my map" (a sun, a planet into a chosen personal sun, or a moon onto a chosen personal planet).
- [x] "Hide this team sun" per sun, stored as a preference, with "Show hidden team suns" in Settings.
- [x] Quick find, the palette, favorites, and recent include team items. A favorite on a team item is stored as a preference (destination key), because team items cannot be edited.
- [x] Settings shows the team map source and its sun count; errors loading it appear there and never block the personal map.
- [x] Note: in file mode without a team map, the browser console shows one harmless "file not found" for `team-data.js`.

## 13. Browser bookmark import

- [x] Edit links → "Import bookmarks" reads an exported bookmarks HTML file (Chrome, Edge, and Firefox use the same Netscape format) with `DOMParser`; nothing is uploaded.
- [x] Mapping: each top-level folder becomes a sun; its links become planets; each subfolder becomes a planet from its first link, with the rest of its links (flattened from deeper folders) as moons. Loose links outside folders go into a "Bookmarks" sun. Bars named like "Bookmarks bar" or "Favorites bar" are unwrapped one level.
- [x] Only http/https links are kept; `javascript:`, `place:`, and file links are skipped and counted. At most 2,000 links.
- [x] The result goes through the merge review (item 11), so importing never replaces the map.

## 14. Sun icons and site icons

- [x] Sun icon field in the sun editor (1–2 characters, for example an emoji), shown above the name in the Galaxy hub and System hub, and in the editor tree.
- [x] Setting "Show site icons" (off by default; the Settings text says it loads each site's `/favicon.ico` from that site). When on, web planets and moons show the icon above their label; it is hidden when it fails to load. The browser's own cache keeps them.
- [x] Labels still fit (the sizing code accounts for the icon line).

## 15. List view

- [x] Setting and top-bar toggle: "Galaxy view: Orbits / List", remembered.
- [x] List view: every sun as a section (icon, name, description, planet count), with planets and their moons nested as links that open the same way the map does, and favorites marked. Sections can be collapsed.
- [x] Quick find, the palette, Settings, and System links still work. Edit mode in list view explains that dragging uses the Orbits view, and Edit links remains available.
- [x] Usable with the keyboard (normal Tab order; the arrow-key map navigation applies only to the Orbits view).

## Testing (after everything above is implemented)

- [x] New `tests/features.py` (file and server mode, plus `--cdp`/`--url` for Edge) with one check group per item: F01 recent/favorites, F02 open all, F03 search, F04 palette, F06 bulk RDP, F07 tags, F08 link check (server mode, against a local test server that serves good and bad URLs), F09 history, F10 duplicates, F11 merge import, F12 team map (both modes), F13 bookmark import, F14 icons, F15 list view.
- [x] Prove a few checks can fail by breaking the feature temporarily.
- [x] Update existing suites where behavior changed (Import JSON now merges by default; new top-bar control; Help text).
- [x] Run locally: full matrix (`--milestone 19`), `drag_drop.py --phase 2`, `orbit_sizes.py`, `pending_checks.py`, `features.py`.
- [x] Run `features.py` and the other suites in Edge on the Windows VM (headless; file mode plus server mode through the SSH tunnel). Edge's pop-up blocker allows only the first Open all tab; the check accepts that when Orbit reports the blocked ones.
- [x] Inspect screenshots at 1920×1080 and 900 pixels.
- [x] Fix what fails and rerun.

## Finish

- [x] Docs: README (user-facing features), Help text, HANDOFF (architecture, files, open items), TEST_MATRIX (F01–F15 rows and commit record), ROADMAP status, README-distribute if `serve.py`/`sync.py` options change.
- [x] Version 2.0.0.
- [x] Commit and push to `main`.
