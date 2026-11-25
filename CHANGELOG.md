# Changelog

What changed in each version of Orbit, newest first. Your version is shown in Settings → About.

## Unreleased

- Buttons and markers use [Lucide](https://lucide.dev) icons instead of text symbols (✎ ⤓ ↑ ↓ ☰ ⚙ × ★ and others), so they look the same in every browser and follow the theme color. A favorite's star is filled.
- Grouped the Edit links tools and moved **Add sun** and **Add a link** above the sun list.
- **Import a file** reviews whole maps, suns, planets as new suns, and browser bookmarks from one picker.
- Added button tips that appear on hover or keyboard focus. Settings offers a shorter delay, a longer delay, or Off. In file mode, the **Check links** tip explains how to enable the check.
- Open a sun, planet, or moon’s editor from its pencil on the map or by pressing **E** while the item has focus. Closing the editor returns focus to the map item.
- Added **Export** beside Edit or View on planet and moon rows. Moved the sun editor’s export, position, and removal actions into separate rows from Save.
- Added a trash button below the pencil, **Undo removal** on the map, and a **Confirm before deleting** setting shared by the map and editor. Confirmation is on by default. Map and editor removal buttons use the same outlined bin icon.
- Put Save, Export, Move, and Remove in a sticky toolbar in planet and moon editors. Save has a floppy disk icon and a label. The planet and moon rows use icons for their Edit and Export shortcuts.
- Added Edit, Export, Move up, Move down, and Remove icons to personal sun rows. Team sun rows offer View and Export.
- Matched the planet, moon, and group-link rows to the sun row icons. Move and Remove work directly from the list and preserve unsaved fields in the parent editor.

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
