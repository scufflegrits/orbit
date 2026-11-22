# Orbit 2.2.1 behavior inventory

What Orbit's core and state code does today, as the baseline the 3.0.0 rewrite must keep (see `REWRITE_PLAN.md`). Written in phase 0 from the code at tag `v2.2.1` and the existing tests. In this file "2.2" means 2.2.1: 2.2.1 changed only Reset in workspaces other than Main.

Each rule says how it's pinned:

- **[check Vnn]** an executable check in `tests/behavior_check.mjs`, which runs the real 2.2.1 functions read from the git tag (`node tests/behavior_check.mjs`; 22 checks, all passing, 2026-11-20). A deliberate mutation (raising the note limit) made V07 fail.
- **[suite Xnn]** an existing browser check.
- **[code]** read in the code only; the rewrite's tests for that module pin it first (phases 2–3).

## Map validation (`storage.js` `validateMap` and helpers, `rdp.js`)

- **Unknown fields are dropped at every level**: map, sun, planet, moon, routine, routine link, preset. This includes `team`, `type: 'web'`, and moons on a moon. [check V01] (`storage.js:119,178`, `storage.js:173-175`)
- **Empty optional fields are dropped; two fields are always written.** [check V02]
  - Dropped: empty `tags`; `favorite` unless exactly `true`; a blank `note` (notes are trimmed); an empty `icon`; an empty `rdpPreset`, or one naming a preset the map doesn't have (`storage.js:186`); empty `routines` and `rdpPresets`.
  - Always written: `description` (`''` when missing) and `moons` (`[]` when missing).
  - Tags are trimmed, lowercased, have runs of spaces collapsed, and duplicates removed.
- **Color:** `#79d9f8` only when `color` is missing; `null` or `''` fails with "`<Sun>` needs a six-digit hex color." (`storage.js:161`) [check V03]
- **Sun ids:** generated from the name, in order (`My Sun!` → `my-sun`, then `my-sun-2`; a name with no letters or digits → `sun`). A later explicit id equal to a generated one fails with "Duplicate sun ID: `<id>`". A blank name fails with "Sun `<n>` needs a name." [check V04]
- **Remote Desktop hosts:** trimmed; the port is normalized (`:03389` → `:3389`) and must be 1–65535; the case of the computer name is kept. Bad hosts fail with "… needs a computer name or IP address, with an optional port." (`rdp.js:5-14`) [check V05]
- **Duplicates:** [check V06]
  - a duplicate sun id fails;
  - a duplicate routine or preset id is silently replaced with one generated from its name (`storage.js:208,256`);
  - duplicate routine link keys are dropped silently;
  - duplicate routine or preset names, ignoring case, fail ("There is already a routine named …").
- **Limits:** [check V07]
  - notes 500 characters
  - 8 tags, each up to 24 characters
  - 5 placeholders per address
  - routine names 60 characters; routine link names silently cut to 200 (`storage.js:253`); 100 links per routine, counted after duplicates are removed
  - preset names 60 characters, and **at most 100 setting lines** (`storage.js:228`; missing from the first plan reviews)
  - imported profiles 12,000 bytes after cleaning (`rdp.js:42`); `.rdp` files 64,000 bytes when read (`rdp.js:49`, browser only)
  - no limit on the size of the map
- **Remote Desktop settings:** [check V08]
  - Presets **refuse** a secret ("`<Preset>` cannot keep password 51; Orbit never stores credentials."), skip blank and whitespace-only lines, and drop `full address`.
  - Imported profiles **strip** secrets silently, keep every other line, and replace `full address` with the link's own computer.
  - In a profile, a whitespace-only line fails ("The .rdp file has an invalid setting line."); an empty line is skipped (`rdp.js:22-25` vs `storage.js:218`).
  - `rdpProfile: null` fails with "The .rdp file is not valid text."; `""` fails with "The .rdp file needs a full address setting.". Either makes the whole map invalid.
- **Routine schedules:** [check V09]
  - the time must be `HH:MM`, 24-hour;
  - days are converted to numbers, deduplicated, sorted, and must be 0–6, with at least one;
  - `days` given as a string throws a raw `TypeError` ("… map is not a function"), not an Orbit message (`storage.js:262`).
- **Web addresses:** trimmed; http or https only, with no username or password. Placeholders are checked by replacing each with `x`, and an unmatched brace fails. Every failure reads "`<label>` needs an http or https URL." [check V11]
- **A saved map that fails to load:** `loadBrowserMap` returns `null` and sets the warning "Saved browser data could not be loaded: `<reason>`". Start-up then shows the bundled map (Main) or an empty map (other workspaces), and **the user's stored map is overwritten by the next save** (`storage.js:303-310`). No saved map also returns `null`, without a warning. [check V10]

## Destination keys and placeholders

- **`destinationKey`:** [check D01]
  - Built from protocol, host (lowercase), path, and query. The fragment never enters the key, so `url.hash = ''` (`storage.js:129`) is redundant.
  - Trailing slashes are removed, so `https://a.test/` → `https://a.test`.
  - Query order, path case, scheme, and `www` are kept, so `http` vs `https` and `www.` vs no `www.` are different keys.
  - **Placeholder braces are encoded only in the path** (`/%7Bt%7D`); in the query they stay literal (`?q={x}`). The first plan said both were encoded.
  - An address that can't be parsed gives `url:<address>`.
  - Remote Desktop gives `rdp:<host, lowercased, with its port>`, so `lab1` and `lab1:3389` are different keys.
- **Placeholders:** names are letters, digits, `_` and `-`, up to 30 characters; `templateNames` returns them deduplicated in order; `fillTemplate` URI-encodes each value and uses `''` for a missing one. [check D02]

## Quick find (`render.js` `findMatches`)

- **Every word must match** some field: the name, the sun and planet it sits in, the address, tags, or note. [check S01]
- **Names match any part of a word**, including two letters. Other fields need 3 or more characters to match inside a word; that's what lets `verge.com` match an address. [check S02]
- **Typos are tolerated only for a word that matches nothing exactly anywhere:** 1 edit for 5–8 characters, 2 for 9 or more, with a swapped pair of letters counting as one edit. Shorter words get no typo matching. [check S03]
- **`#tag` and `tag:name`** keep only items with exactly that tag. A word that matches only the path (where an item sits) narrows results but can't make a match on its own, so typing a sun's name lists the sun, not everything in it. Notes are searched. [check S04]
- **Ranking:** results are ranked by score; ties keep map order (`render.js:557`). [code]

## Map operations

- **`moveMapItem(list, source, target)`** never changes its input: [check M01, M02]
  - A move returns `{status: 'moved', groups, path, total}` with a fresh copy.
  - Moving back from the returned `path` restores the original.
  - `same` is returned for a move to the same place, including onto its own parent.
  - `invalid` is returned for onto itself, into or out of a team sun, a sun under a planet, or a missing source.
- **`mergeMaps(personal, incoming)`** returns `{groups, added, skipped}` and never changes what's already there: [check M03]
  - Suns match by id, then by name ignoring case; an unmatched sun is copied whole, with a new id if its id is taken.
  - Planets match within their sun by destination key, and moons within their planet.
  - When two planets in a sun share an address, incoming moons merge into **the first** of them.
- **`mergeRoutines(current, incoming)`** adds only names that are new (ignoring case) and regenerates a clashing id. Import uses the same function for presets (`editor.js:259-261`). [check M04]
- **`pathsForKey(key)`** finds every copy of a destination in the combined map, team suns included, as `[sun, planet]` or `[sun, planet, moon]`. [check M05]

## Saving and history (`storage.js` `saveMap`, `recordHistory`)

- **Order of a save** (`storage.js:322-339`): [code; suite F09, F22, F27]
  1. Strip team suns, then validate (keeping current routines and presets unless given).
  2. Write the map key.
  3. If anything changed and the label isn't `false`, record the previous map in history.
  4. If anything changed, count a change for the backup reminder.
  5. Update the in-memory map.
  6. Increase the revision **on every save, changed or not**.
  7. Mark the source as browser edits, recount, and render.

  A failed write (storage full) throws before history is touched.
- **History:**
  - Entries are `{time, label, groups, routines?, rdpPresets?}`, newest first, at most 20.
  - When storage is full, the oldest entries are dropped until the write fits. If even one entry doesn't fit, history is left as it was, and the change still goes through.
  - Entries with no `groups` array are ignored on load. [code; suite F09]
- **Removal undo:**
  - The record is `{kind, index, item, label, sunId, planetUrl, planetHost, planetName, planetIndex}` (`app.js:69-93`). It's written before the save and put back if the save fails (`editor.js:162-185`).
  - Undoing a sun whose id is taken gives it a new id.
  - A moon's planet is found by its address, host, and name, then by index. [code; suite milestone 8]

## Workspaces and what's stored where

- **Keys:**
  - Main uses `orbit:map:v1`, `orbit:undo-removal:v1`, and `orbit:history:v1`; other workspaces add `:<id>` (`workspaces.js:38-40`).
  - Removing a workspace deletes its three keys and its entry in `orbit:backup:v1`.
  - Main can't be removed. [suite F22]
- **Shared across workspaces:**
  - `orbit:workspaces:v1`, `orbit:workspace`, recents (`orbit:recent:v1`), saved placeholder values, team favorites, hidden team suns, team-seen, routine offers, and every preference.
  - Personal favorites are stored on items, so they're per workspace. [code]
- **Routine offers are keyed by routine id only** (`routines.js:62`), so routines with the same id in two workspaces share one "offered today" mark. Kept as is. [code]
- **Reset to file data** (2.2.1, `editor.js:344`): [suite F27]
  - In Main it removes the saved map, so Main follows the project's link data again.
  - In other workspaces it saves the file data under the workspace's key.
  - Both record history and clear the removal undo.

## Preferences (value formats)

- **Booleans** are stored as the strings `'true'` and `'false'`. A missing key uses the default. Any value other than `'true'` reads as false. (`storage.js:6-13`)
- **Fixed lists:** anything not in the list uses the default.
  - Theme: `default`, `alabama` (Red), or `auburn` (Blue).
  - Font size: `small`, `standard`, `large`, or `extra`; default `standard`.
  - Galaxy view: `list`, otherwise `orbits`.
  - Remote Desktop: `client`, otherwise `download`.
- **Unavailable storage:** every reader returns the default when storage throws, and writes are silently skipped. [code; suite milestones 3, 5, 10]

## Team map source (`team.js` `fetchTeamData`)

- **Server mode** fetches `./team.json` with `no-store`:
  - a success uses it;
  - a 404 falls back to `window.ORBIT_TEAM_DATA`;
  - any other status or a network error falls back to `ORBIT_TEAM_DATA` if it exists, and otherwise is reported as an error in Settings (it never blocks the personal map).
- **File mode** uses only `ORBIT_TEAM_DATA`. [code; suite F12]

## Link packs (`sharing.js` `validPack`)

- **Format:** the file must have `format: 'orbit-pack-v1'` and a `links` array. Pack and routine names are trimmed and cut to 60 characters, and an empty name becomes "Shared links". [code; suite F23]
- **Links are checked like map destinations,** so a pack keeps `favorite`, `rdpPreset`, and `rdpProfile` if the file has them.
- **A routine's schedule isn't checked until Add,** when the whole map is validated.
- **The same link twice in a pack** is added twice.
- **A routine whose name is taken** is added as "`<name>` 2" (then 3, …), whereas Merge import skips a routine whose name is taken.

## Corrections to the plan found while writing this

1. Placeholder braces are encoded only in the path, not the query (plan: "Placeholders are encoded as `%7B`/`%7D`").
2. The fragment never enters a destination key; `url.hash = ''` is redundant.
3. Presets have a 100-line limit that the plan's list didn't include.
4. `rdpProfile: null` and `""` fail with different messages.
