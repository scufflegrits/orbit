# Changelog

What changed in each version of Orbit, newest first. Your version is shown in Settings → About.

## Unreleased

### New

- **Help guide.** Help is now a full guide, `help.html`, that opens in its own tab. A **?** beside each part of Settings opens the matching section, and the command palette's **Help** opens the guide too. The Help tab keeps a link to it and the most-used keys. The guide works without a server and follows your theme and font.
- **Orbit has a tab icon:** an orbit symbol on a dark square, so its tab is easy to find. Before, the tab showed the browser's blank page icon.

### Changed

- **The README is shorter:** it now covers running Orbit, map files, backups, and setup, and points to the Help guide for everything else.
- **Browser requirements:** Orbit now needs Edge 144, Chrome 144, Firefox 147, or Safari 26.3 or later, the first releases of 2026. Keep your browser up to date.
- **Dev Toolbox** gains **Structurizr** in Diagramming, with **The C4 model** as its moon, so it now has 31 links. If you've already saved Dev Toolbox, use Settings → Edit links → **Reset to file data** on it to see them.

## 3.1.0 — 2026-11-26

### New

- **Dev Toolbox workspace.** Dev Toolbox now ships as its own workspace beside Main, with five suns (Git, Web tools, Docs & learning, Data tools, Diagramming) and 29 developer links. Existing browsers gain it automatically. Removing it is remembered, and Settings → Workspaces can add it back. If your Main map still has the old Dev Toolbox sun, Orbit asks once whether to remove it from Main. An existing workspace you named with the `dev-toolbox` id becomes the default one and keeps your saved links until you choose Reset. Main now has nine suns and 106 links.
- **Constellations background and Aurora theme.** Settings → **Background** → **Constellations** adds stars that drift, link up, and gather around the pointer. It's off by default. **Particles** sets how strongly they're drawn. **Aurora** is a new dark violet theme beside Default, Red, and Blue.
- **Animations has three levels:** Full, Calm, and Off. In Calm, the Constellations background holds still but follows the pointer, while hovers and menus animate as usual. Your device's reduce-motion setting keeps the background fully still.
- **Orbit ships its own fonts** and uses **Inter** by default, so it looks the same on every computer (before, Windows showed Segoe UI and Arial in place of fonts that weren't installed). Settings → **Font** offers **Orbit classic** (DM Sans and Space Grotesk).
- **Change a moon into a planet, or a planet into a moon,** by drag and drop in Edit mode. Pause a moon on a sun's circle and hold on **Make it a planet**, or drag a planet without moons onto another planet and hold on **Make it a moon**. Just passing over these choices never changes anything. Edit links has **Make it a planet of…** and **Make it a moon of…** under Move too.
- **Edit from the map:** open a sun, planet, or moon's editor from its pencil, or by pressing **E** while it has focus. Closing the editor returns focus to the map item.
- **Removing from the map:** a trash button below the pencil, **Undo removal**, and a **Confirm before deleting** setting shared by the map and the editor (on by default).
- **Button tips** appear on hover or keyboard focus. Settings offers a shorter delay, a longer delay, or Off. In file mode, the **Check links** tip explains how to enable the check.
- **Import a file** reviews whole maps, suns, planets as new suns, and browser bookmarks from one picker.

### Changed

- **The cog opens Settings directly,** with Help and About as tabs beside it.
- **Settings is grouped** under Look, Galaxy, Editing, Workspaces and team, and Remote Desktop. The Remote Desktop launch method and Windows setup are at the bottom.
- **Group planets show their links on hover,** like a planet's moons. Clicking one keeps them open, and an accent ring marks the pinned group.
- Buttons and markers use [Lucide](https://lucide.dev) icons instead of text symbols (✎ ⤓ ↑ ↓ ☰ ⚙ × ★ and others), so they look the same in every browser and follow the theme colour. A favourite's star is filled.
- **Edit links is reorganised:**
  - The tools are grouped, and **Add sun** and **Add a link** sit above the sun list.
  - Planet and moon editors keep **Save**, **Export**, **Move**, and **Remove** in a sticky toolbar.
  - Sun, planet, moon, and group-link rows have matching Edit, Export, Move up, Move down, and Remove icons. Team sun rows offer View and Export.
  - Move and Remove work directly from the list and keep unsaved fields in the parent editor.
  - The sun editor's export, position, and removal actions are in their own rows, apart from Save.

## 3.0.3 — 2026-11-22

- **Added group planets.** Create a planet that holds related links without an address of its own. Select it to show its links or Shift+click to open them in bulk. Bookmark subfolders now import as groups, and the sample map's Dev Toolbox shows a **Diagramming** group.
- **Compatibility warning. Once you save a map containing group planets, avoid opening Orbit 3.0.2 or earlier with the same browser storage. Older versions reject the map and can overwrite it on the next edit.** The current version saves a backup of unreadable browser data before replacing it.
- **Fixed:** a hovered sun in the Galaxy shifted 3 px up and to the left as it grew, so planets on the top left looked closer than those on the bottom right. It now grows in place, and every planet keeps the same gap.
- **Fixed:** in the Galaxy, moving the mouse from a lower planet to its moons could close them just before you reached one. The faded caption (added in 3.0.2) was still catching the mouse.
- **Added:** moons in the sample map's Dev Toolbox sun: under **JSON Crack**, ToDiagram, JSON Crack on GitHub, JSON Crack for VS Code, jless, and fx; under **Transform**, jq and yq.
- **Added:** a sun picker when importing a whole map. **Import JSON** lists the file's suns with what each would add; merge only the ones you tick, each with all its planets and moons. **Replace my map** still takes the whole map. **Import sun** now accepts a whole map file and opens the same picker, and **Import bookmarks** uses it too.

## 3.0.2 — 2026-11-22

- **Added:** a **Dev Toolbox** sun in the sample map, after Build: Learn Git Branching, Devhints, JSON Crack, Transform, Refactoring Guru, DevDocs, Excalidraw, and roadmap.sh. Your own saved map is unchanged; the new sun appears if you use the sample map or choose Reset to file data.
- **Fixed:** in the Galaxy, planets sat almost on their sun, and when the sun grew on hover it touched or overlapped them and their "N moons" labels. Planets now orbit about 20 px clear of the hovered sun, so each sun card is a little taller.
- **Fixed:** in the Galaxy, a lower planet's moons covered the sun's caption. The caption now fades while those moons show.

## 3.0.1 — 2026-11-22

- **Fixed:** a routine dismissed or opened from its offer in one workspace is no longer hidden in another workspace that has a routine with the same name. Each workspace now remembers its own offers, and removing a workspace forgets its offers. Offers already made today in Main still count; in other workspaces, a routine may be offered once more on the day you update.

## 3.0.0 — 2026-11-22

**Nothing changes for you.** Orbit looks and works exactly as in 2.2.1. Your saved links, routines, workspaces, and settings carry over untouched: a snapshot of 2.2 saved data reads back exactly as 2.2.1 read it. Orbit still opens by double-clicking `index.html`, with no install or server.

**Speed and size,** measured on the largest test map against 2.2.1:

| | Change |
| --- | --- |
| First time the Galaxy is drawn | 2% faster |
| Typing in Quick find | unchanged |
| Code the browser loads | 1.5% larger (about 252 KB) |

**To go back to 2.2.1:** in a git copy, run `git checkout v2.2.1`; otherwise unpack the 2.2.1 zip over this folder. Your data stays in the browser, and 2.2.1 reads it as before.

### Under the hood

3.0.0 rebuilds Orbit's code so later changes are safer to make. This only matters if you change the code; see "Changing Orbit's code" in the README.

| | 2.2.1 | 3.0.0 |
| --- | --- | --- |
| What the page loads | 20 scripts, in a fixed order | 1 file, `orbit.js`, built from `src/` |
| How the code is split | 18 large files sharing hundreds of global names | 68 small modules, each importing what it uses |
| Structure | none enforced | 5 layers (core, state, services, ui, app); a check fails on an upward or circular import |
| Who saves the map | many places wrote it directly | one store is the only writer |
| Edit mode, dragging, open menus | flags spread across files | one owner; a test fails if a second copy appears |
| Type checking | none | strict checking of all of `src/` |
| Fast tests | none | 180 node tests in about 6 seconds, many comparing results with 2.2.1's own code |
| Changing the code needs | a text editor | Node: `npm install` once, then `npm run build` after each change |

How the rewrite was planned, built, and tested: [REWRITE_PLAN.md](docs/plans/REWRITE_PLAN.md) in the repository.

## 2.2.1 — 2026-11-20

- **Fixed:** in a workspace other than Main, Reset to file data now keeps the file's map after a reload. Before, the map went empty.

## 2.2.0 — 2026-11-20

- Notes on links.
- `{placeholder}` links that ask for a value when opened.
- Quick add.
- Workspaces.
- Link packs.
- Backup reminders.
- Notices when the team map is updated.
- Remote Desktop presets.

## 2.1.0 — 2026-11-20

- Open all favorites.
- Named routines.
- Routine offers when Orbit opens.

## 2.0.0 — 2026-11-19

- Recent links and favorites.
- Open all.
- Smarter Quick find.
- The Ctrl/Cmd+K command palette.
- Bulk Remote Desktop settings.
- Tags.
- Link check.
- Version history.
- Duplicate finder.
- Merge import.
- Read-only team map.
- Bookmark import.
- Site icons.
- List view.

## Before 2.0.0 — to 2026-11-17

The Galaxy and System views, the link editor, Remote Desktop links and the Windows helper, keyboard navigation, sizing, and drag-and-drop, built as milestones 1–19. See [ROADMAP.md](docs/plans/ROADMAP.md) in the repository.
