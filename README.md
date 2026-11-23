# Orbit

A local link map organized as a Galaxy of suns and planets. Each sun is a group of destinations. Hover over a sun to preview its first five planets, click the sun to open its System, click a linked planet to open its destination, or select a group planet to show its links. Your routines, favorites, and recent links sit above the Galaxy, and the ☰ button shows everything as a compact list. Set Orbit as your startup page and a [routine](#start-your-day-with-orbit) opens your morning sites in one click.

To rearrange the map, turn on **Edit mode** in the top bar and drag suns, planets, and moons; see [Rearrange by dragging](#rearrange-by-dragging).

Use **Quick find** in the top bar on the Galaxy or any System to search suns, planets, and moons by name, web address, computer name, or tag; see [Find and open links](#find-and-open-links). Searching from a System returns to the Galaxy with matching results. Press `Ctrl+K` for the command palette.

The bundled map has ten sample suns, including **Dev Toolbox**, **Stocks & Investing**, **Science**, and **Labs**, with 53 planets and 123 destinations. In Dev Toolbox, the **Diagramming** group holds Excalidraw, PlantUML JSON diagrams, and Graphviz.

## What's new in 3.0

Orbit 3.0.0 carried over saved links, routines, workspaces, and settings from 2.2.1. It rebuilt the code underneath (see [Changing Orbit's code](#changing-orbits-code)), so later changes are safer to make. It is just as fast: the Galaxy draws 2% faster, typing in Quick find is unchanged, and the code is 1.5% larger. Earlier versions and the full comparison with 2.2.1 are in [CHANGELOG.md](CHANGELOG.md). 3.0.1 fixes routine offers in workspaces other than Main; 3.0.2 gives Galaxy planets more room around their sun and adds a Dev Toolbox sun to the sample map (see the changelog).

**Once you save a map containing group planets, avoid opening Orbit 3.0.2 or earlier with the same browser storage. Older versions reject the saved map, fall back to the sample map, and can overwrite your saved map on the next edit.** Export JSON before switching versions. The current version backs up unreadable browser data before replacing it.

## Run

Open `index.html` in your browser. No server or internet connection is needed for the page itself.

You can also run it through a local-only server:

```bash
python3 serve.py
```

Then open <http://localhost:8000>. The server listens only on this computer. Press `Ctrl+C` to stop it. Use `--port` to pick another port, and `--team PATH` to add a read-only [team map](#team-map). The server is also what makes **Check links** in the editor work.

## Add your links

Edit `links.json`. Each item in `groups` is a sun, and each item in its `links` array is a planet. A website planet looks like this.

```json
{
  "id": "tech",
  "name": "Tech",
  "description": "News, ideas, and what comes next",
  "color": "#79d9f8",
  "links": [
    {
      "name": "Engadget",
      "url": "https://www.engadget.com/",
      "moons": [
        { "name": "Reviews", "url": "https://www.engadget.com/category/reviews/" }
      ]
    }
  ]
}
```

The `moons` array is optional. Hover over a planet to reveal its moons; clicking the planet still opens its own destination. The Galaxy previews up to five planets per sun. A System shows up to eight planets around its sun and lists additional planets below. Up to six moons appear around a hovered planet, fanned farther out when there are more than four; any extras are listed in the System. Planet and moon circles grow to fit their longest name without splitting a word, and every planet in a view shares one size. A name too long even for the largest circle gets smaller text instead. Orbit is laid out for screens 1920×1080 and larger.

Keep the surrounding `{"groups": [...]}` structure. If you opened `index.html` directly, run `python3 sync.py` after editing `links.json`, then refresh the page. If you use the local server, just refresh.

## Group planets

A group planet holds related links inside a sun. In **Settings → Edit links**, open a sun, choose **Add planet**, then set **Kind** to **Group (no link)**. Save the group and use **Add link** for each website or Remote Desktop link. Groups can start empty and can have notes and tags.

Click or press **Enter** on a group planet to show its links. Click elsewhere or press **Escape** to close it. **Shift+click** uses Open all for the group's links. Quick find takes you to the group in its System. The compact Galaxy list shows groups as headings above their links.

Change **Kind** to switch between a group and a linked planet. Both keep their moons. Switching to a group asks you to confirm removal of the planet's address. Switching to a linked planet requires a website address or Remote Desktop host. **Export planet** keeps the group intact. **Share links as a pack** exports the links for someone to import individually.

In `links.json`, use `"type": "group"` on the planet and put its destinations in `"moons"`. Give the group a name and leave out its own address.

## Windows Remote Desktop entries

The **Labs** sun contains `lab1` through `lab5` as planets and five server moons around `lab1`. Their computer names are examples; edit each target to match a reachable host on your network. A Windows Remote Desktop destination uses `type` and `host` instead of `url`:

```json
{ "name": "lab1-server1", "type": "rdp", "host": "lab1-server1" }
```

By default, clicking one downloads a `.rdp` connection file with that host. Open the downloaded file on Windows to start Remote Desktop Connection. The destination editor offers **Windows Remote Desktop** as a type for any planet or moon, and accepts a computer name or IP address with an optional port such as `lab1-server1:3390`.

To use a saved connection, open its planet or moon in **Settings → Edit links** and select **Import .rdp file**. For example, open **Labs → lab1 → lab1-server3**, import the saved file, review the computer address, then select **Save moon**. Orbit keeps the file's connection settings with that link for future `.rdp` downloads and native `mstsc.exe` launches. The same control can fill a new planet or moon; its file name becomes the link name if you have not entered one. Editing the computer address later updates the saved profile's target while retaining its other settings. Password, token, and signature fields are excluded; Orbit does not store credentials. Exported Orbit JSON includes the remaining profile settings, so review it before sharing.

To import several saved connections, open a saved sun and choose **Import .rdp files as planets**, or open a saved planet and choose **Import .rdp files as moons**. Pick multiple files, pick a folder, or drop files or a folder into the import area. Review the names and computer addresses, then add the batch. Orbit skips non-`.rdp` files in a folder and stops the batch if any selected `.rdp` file is invalid. The browser reads the chosen files locally; Orbit does not watch the folder for future changes.

To open the Windows client directly from a moon, install the per-user **Orbit launcher** once on the Windows PC where you use Orbit. This opens the built-in `mstsc.exe`; the separate MSRDC app installed by `winget install Microsoft.RemoteDesktopClient` does not register Orbit's launcher. From the project folder, run with Windows PowerShell 5.1:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\Install-OrbitRdp.ps1
```

Windows 10 and 11 include Windows PowerShell 5.1 by default. If it is unavailable but PowerShell 7 is installed, run the installer with `pwsh.exe` instead:

```powershell
pwsh.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\Install-OrbitRdp.ps1
```

The installer registers the same PowerShell executable that ran it. Running it again replaces the current user's `orbit-rdp://` registration with the new executable, so a 5.1 install followed by a PowerShell 7 install switches future clicks to `pwsh.exe`. It also refreshes the copied helper; Orbit's browser settings and generated `.rdp` files remain in place. Re-run the installer after updating Orbit, or if you later remove the registered PowerShell installation.

Then choose **Settings → Remote Desktop → Open mstsc.exe**. Clicking a lab planet or moon asks Windows to open the Orbit launcher. A host-only link uses `mstsc.exe /v:` with a credential prompt and creates no connection file. A link with imported profile settings still writes a file under `%LOCALAPPDATA%\Orbit\Connections` and opens it for review in Remote Desktop Connection. Your browser may ask whether to open the external app. This setting is saved in the browser; **Download .rdp file** remains available in the same menu. Orbit stores no credentials.

Before reinstalling or uninstalling, the scripts save any existing `orbit-rdp` registry key as a uniquely named `.reg` file in `%LOCALAPPDATA%\Orbit` and print its path. If that backup fails, the script stops before changing the registration. To remove the launcher registration from that Windows account, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\Uninstall-OrbitRdp.ps1`. The generated connection files and registry backups remain available for manual use.

## Find and open links

**Quick find** matches every word you type against a link's name, the sun and planet it sits in, its web address or computer name, and its tags. The sun or planet a link sits in only narrows a search, so “tech reviews” finds the Reviews moons in Tech, while “tech” alone finds the Tech sun. Short forms work: “lab1 s3” finds `lab1-server3`. A word that matches nothing exactly also finds near misses, so “engadgte” still finds Engadget. Type `#tag` or `tag:name` to see only links with that tag. Better matches come first; a result found by its address says so.

**Favorites and recent links** appear in a row above the Galaxy. Star a planet or moon in Quick find results, or tick **Favorite** in its editor; **Open all** at the end of the row opens every favorite at once. The last ten links you opened are listed under Recent. Turn the row off, or clear Recent, in Settings.

**Command palette:** press `Ctrl+K` (`Cmd+K` on a Mac) from any view. Type to search links and commands such as **Turn on Edit mode**, **Edit links**, or **Show the Galaxy as a list**, then press Enter to open the highlighted entry straight away. Up and Down Arrow (and Page Up and Page Down) move; Escape closes it.

**Open a planet with all its moons:** Shift+click a planet, use the **Open a planet with all its moons** buttons under a System, or choose **Open all** in the command palette. Orbit asks before opening more than one tab and leaves Remote Desktop links out. Most browsers block all but the first tab until you allow pop-ups for Orbit (Edge and Chrome show a pop-up icon in the address bar); Orbit tells you how many were blocked.

**List view:** the ☰ button in the top bar (or **Settings → Galaxy view**) shows the Galaxy as a compact list of every sun with its planets and moons. Links open the same way as on the map. Dragging works in the Orbits view; in List view, Edit mode opens links in Edit links instead.

**Icons:** give a sun an icon (one or two characters, such as an emoji) in its editor; it appears above the sun's name. **Show site icons** in Settings adds each website's own icon to its planets and moons. It is off by default because it loads `/favicon.ico` from every site on your map; when off, Orbit contacts no site until you open it.

## Notes, placeholders, and quick add

**Notes:** a planet or moon can have a short note (up to 500 characters), such as what the page is for or which account to use. It shows on hover, in Quick find and command palette results, and in the list view, and Quick find matches it. Never put passwords in a note; notes are plain text in your browser and in exports.

**Placeholders:** a web address can contain up to five `{name}` parts, such as `https://jira.example.com/browse/{ticket}`. Opening the link shows a small form for each value, filled in with the last ones you used, and a preview of the address. Open all and routines use the last values; a link without values yet is left out and counted. Link checking skips these links.

**Quick add:** paste or type a web address into Quick find and choose **Add this link to your map**, or press `Ctrl+K` and choose **Add a link** (or **Add <address>**). Pick a sun to add it as a planet, or a planet to add it as a moon. **Paste from clipboard** fills the address when the browser allows it.

## Workspaces

**Settings → Workspaces** keeps separate maps, such as Work and Home, each with its own suns, favorites, routines, history, and undo. Add a workspace starting from an empty map, a copy of the current one, or the sample map; rename or remove it (Main stays). Once there is more than one, a workspace menu appears in the top bar, and the command palette offers **Switch to workspace**. The team map and your settings are shared by all workspaces. Export JSON and Import JSON work on the open workspace. **Reset to file data** in Main goes back to following the project's link data; in any other workspace it saves a copy of that link data as the workspace's map, so it stays after a reload.

## Start your day with Orbit

A **routine** is a named set of links you open together, such as the sites you start every morning with. Create one in **Settings → Edit links → Routines → New routine**: name it, tick its planets and moons (team links work too), and save. It appears as a chip in the Routines row above the Galaxy; one click opens all its websites in new tabs. Remote Desktop links in a routine are left out when it opens. The command palette lists **Run routine: <name>**.

Routines remember links by their address, so renaming or moving a link on the map keeps the routine working; a link you remove is skipped and counted. Routines are saved with your map: Export JSON includes them, Import JSON merges routines with new names, and History restores them.

Tick **Offer this routine when Orbit opens** to give a routine a time and days (weekdays by default). When Orbit opens on one of those days at or after that time, a banner offers **Open <routine>** or **Not today**. Browsers open tabs only after a click, so Orbit asks instead of opening them by itself, and it asks once a day in each workspace.

To make this your morning start:

1. Make Orbit your browser's startup page. In Edge: **Settings → Start, home, and new tabs → When Edge starts → Open these pages**, and add Orbit's address (`file:///C:/path/to/orbit/index.html`, or `http://localhost:8000` with `serve.py`). In Chrome: **Settings → On startup → Open a specific page or set of pages**.
2. Open a routine once and allow pop-ups for Orbit when the browser asks (the blocked pop-up icon at the right of the address bar). Until then, the browser opens only the first tab and Orbit says how many were blocked.

## Edit links tools

- **Routines** lists your routines with Open, Share, Edit, and Remove; see [Start your day with Orbit](#start-your-day-with-orbit).
- **History** keeps the map (and its routines) as it was before each of your last 20 changes in this browser (edits, drags, imports, restores, and resets), with what changed. **Restore** brings a version back as a new change, so it can be undone too.
- **Find duplicates** lists links that point to the same address or computer, with where each one is. An item's editor also notes when its destination exists elsewhere. A copy you made on purpose is fine.
- **Check links** asks each website on your map whether it answers and lists the ones that do not, with Edit buttons. It needs `python3 serve.py`, because a page opened from a file cannot contact other sites. Remote Desktop links are not checked.
- **Import bookmarks** reads a bookmarks file exported from Chrome, Edge, or Firefox (HTML). Each folder becomes a sun, its links become planets, and each subfolder becomes a group planet with all its links as moons. Bars such as “Bookmarks bar” are unwrapped. Only web links are kept, and the result is merged, never replacing your map.
- **Import JSON** lists every sun in a map file with what it would add, so you can pick which suns to bring in (all that add something start ticked; **Select all** and **Select none** help). **Merge into my map** adds the ticked suns, each with all its planets and moons; for a sun you already have (matched by ID or name) it adds only the planets and moons you're missing, matching links by destination and group planets by name within the sun, and keeps your existing entries. Routines and Remote Desktop presets in the file have their own boxes. **Replace my map** swaps your whole map for the file, whatever is ticked; History keeps the old one. **Import sun** also accepts a whole map file: it opens the same picker with nothing ticked, so you can take just the suns you want. **Import bookmarks** uses the same picker, one sun per bookmark folder.
- **Tags:** a planet or moon can have up to eight tags (letters, digits, spaces, and hyphens). The Edit links start screen lists the tags in use; select one to search for it.
- **Add a link** opens Quick add.
- **Share favorites**, and **Share** beside a routine, save a **link pack**: a small `orbit-pack-*.json` file with those links (names, addresses, tags, and notes; never passwords) and, for a routine, its name and schedule. **Import link pack** reads a pack file or pasted text, shows which links are new, adds only those (to a new sun named after the pack, or to one of your suns), and can add the routine too.
- **RDP presets** are named Remote Desktop settings, such as full screen on all monitors. Build one from common choices (display, all monitors, clipboard, drives), edit its settings text, or start from an `.rdp` file; computer addresses and passwords are never kept. In a Remote Desktop link's editor, **Connection settings** chooses none, its own imported settings, or a preset; downloads and `mstsc.exe` launches then use that preset with the link's own computer. Presets are saved and exported with the map.
- **Backup reminders:** after 20 changes or 14 days with changes since your last Export JSON, Orbit suggests a backup above the Galaxy and in Edit links (**Back up now** or **Remind me later**). Turn this off in Settings.
- **Apply RDP settings to moons**, in a planet with Remote Desktop moons, copies one set of connection settings (from an `.rdp` file, another moon, or a preset) to the planet and its moons. Each keeps its own computer, and passwords, tokens, and signatures are never kept. **Clear imported settings** removes them again.

## Team map

A team map is an ordinary Orbit map file that a group shares. Orbit shows its suns first, marked **TEAM**, alongside your own map:

- With the local server: `python3 serve.py --team /path/to/team-links.json`.
- Opening `index.html` directly: `python3 sync.py --team /path/to/team-links.json` writes `team-data.js` next to `index.html`; run `python3 sync.py --no-team` to remove it. Without that file, the browser console shows one harmless “file not found” message.

When the team file changes, a notice says how many links are new or removed; **Show what’s new** lists them (new ones open from the list) and **Dismiss** hides it until the next change.

Team suns are read-only: they cannot be dragged or edited, and they are never saved or exported with your map. Quick find, favorites, and recent links include them. In Edit links, open a team sun, planet, or moon to **Copy** it into your own map, or **Hide this team sun** (show it again in Settings). Changes to the team file appear when you reload.

## Rearrange by dragging

Turn on **Edit mode** in the top bar to rearrange the map with a mouse or pen. It is off after every reload. While it is on, planets and moons do not open, download, or launch Remote Desktop; a sun still opens its System.

- Drag a planet onto another sun to move it there with all its moons.
- Drag a moon onto another planet. In the Galaxy, pause on another sun to show its planets.
- In a System, a list of the other suns and planets appears while you drag, because only one sun is on screen.
- To set the order, drag onto a sibling: a planet onto a planet, a moon onto a moon, or a sun onto a sun in the Galaxy. Choose **Before** or **After**; the hint shows the position the item will take. Pause on a planet to show its moons, or on a tray entry to open it.
- **Undo last drag** reverses the most recent move until the map changes again or the page reloads.

A moved link keeps its name, destination, and any imported `.rdp` profile, and goes to the end of its new parent unless you choose a position beside a sibling. Reordering a sun keeps its System address. The Galaxy shows only the first five planets of each sun and six moons of each planet, so use a System, the list view, or **Edit links** for the rest. In Edit mode, a Quick find result opens that planet or moon in Edit links. Dragging needs a mouse or pen; with a keyboard, use Edit links: **Move up** and **Move down** set the order, and **Move to another sun** or **Move to another planet** includes a position. Touch dragging is not supported or planned. Team suns cannot be dragged.

## Keyboard

Orbit works without a mouse. Press `/` anywhere to jump to **Quick find**, then use Down Arrow to move into the results, Up and Down Arrow to move between them, and Enter to open one. Press `Ctrl+K` (`Cmd+K` on a Mac) for the command palette.

Tab moves through the page. Focusing a sun shows its planets and focusing a planet shows its moons, each with a visible focus ring. Arrow keys move between suns by position, between sibling planets or moons, down from a planet into its moons, and back up. Enter opens the focused item.

Escape closes the command palette first, then the menu; when neither is open it cancels a drag, then turns Edit mode off, then clears Quick find, and after that it returns from a System to the Galaxy. While the menu is open, Tab stays inside it, and closing it returns focus to the cog.

## Settings and help

Click the cog on the Galaxy or any System to open Settings, Help, or About. Settings includes an **Animations** switch. Turning it off removes movement and reveal delays while leaving all links usable. The choice is saved in this browser. Orbit also honors your operating system's reduced-motion preference.

The **Font size** setting offers Small (90%), Standard (100%), Large (115%), and Extra large (130%). Standard is the default. The choice applies immediately throughout Orbit and is saved in this browser.
Circle labels use a shared size for each level across the Galaxy, and long names wrap inside their circles. Moons have larger circles and text; other interface text grows slightly on wide desktop screens.

Settings also includes **Always show moons**, **Show favorites and recent** (with **Clear recent links**), **Galaxy view** (Orbits or List), **Show site icons**, the [team map](#team-map) status, and **Edit links**. Edit links opens a full-screen workspace with the complete sun, planet, and moon tree beside the selected item's editor. The editor lets you add, rename, reorder, or remove suns, planets, and moons, move a planet to another sun or a moon to another planet at a chosen position, and edit descriptions, colors, sun icons, website URLs, Remote Desktop hosts, tags, and favorites. Changes appear immediately and are stored in this browser. Export JSON for a portable backup, import a JSON file to merge into (or replace) the browser map, or reset to the link data loaded from the project files. See [Edit links tools](#edit-links-tools) for history, duplicates, link checking, and bookmark import.
Sun descriptions can include links within their text. In a sun's Description field, write `[label](https://example.com)`; use an `http` or `https` URL. The link appears in the Galaxy and System and opens in a new tab. Unsupported link markup remains plain text. Descriptions are included in JSON exports.

To share part of your map, open a sun, planet, or moon in **Edit links** and choose **Export sun**, **Export planet**, or **Export moon**. A sun export includes its planets and moons; a planet export includes its moons; a moon export includes only that moon. The downloaded `orbit-*.json` file contains just that item and its descendants. To receive one, use **Import sun** in the editor's sun list, **Import planet** inside the destination sun, or **Import moon** inside the destination planet. Review the item and destination, then add it. This appends the imported links and keeps your existing map. If an imported sun ID already exists, Orbit gives the new sun a unique ID. **Import JSON** reviews a whole map and merges it by default; it can also replace your map.

If someone shares a planet and you want it at the top level, choose **Import planet as sun** in the sun list. Orbit creates a sun named after the planet and places the shared planet inside it as its first planet. The planet's destination and moons remain available. The new sun receives a default color that you can change in the editor.

Settings and Edit links show whether the active map is bundled project data or browser edits. After removing a sun, planet, or moon, use **Undo removal** in the editor to restore it. The latest removal remains available after a reload; replacing or resetting the map clears it. For anything older, use **History** (see [Edit links tools](#edit-links-tools)).
To copy a moon to another planet, open that moon in **Edit links** and choose **Copy moon**. Pick a target planet in the review screen. The copy keeps the saved destination and any imported Remote Desktop profile, and later edits to either moon are independent.

Browser edits take precedence over `links.json` (or `links-data.js` in direct-file mode) until you reset. Direct-file and local-server pages have separate browser storage; use export and import to move edits between them. The browser editor does not write `links.json` directly.

The Theme setting offers Default, Red, and Blue. Red and Blue retain their existing palettes, and previously saved theme choices still work. Your choice is saved in this browser; select Default to return to the original appearance.

## Changing Orbit's code

This section is for working on Orbit from its git repository; the release zip doesn't include the code or tests.

Using Orbit needs no build or install: open `index.html`. Changing its code needs Node: since 3.0.0 the whole app is in `src/` (ES modules: `core/` for pure rules, `state/` for saved data and the one store, `services/` for opening links and files, `ui/` for the screens, `app/` for start-up), bundled into one file:

- **`orbit.js` is built from `src/` and committed.** After you change anything in `src/`, run `npm install` once, then `npm run build`, and commit `orbit.js` with your change. Never edit `orbit.js` by hand.
- **`npm run check:bundle`** confirms the committed `orbit.js` matches `src/`.
- **`npm run check`** type-checks `src/`; **`npm run check:layers`** checks how its folders depend on each other.
- **`npm run test:unit`** runs the node tests next to the code (`src/**/*.test.js`). Many compare the new code with Orbit 2.2.1's, kept frozen in `tests/oracle/`, on thousands of random maps; a failure names the input that differs. When you change a behavior on purpose, the matching comparison fails: update that test's expected result (or drop its 2.2.1 comparison), don't delete the test.
- **`npm run watch`** rebuilds `orbit.js` on every change, with a source map for the browser's developer tools. Run `npm run build` before committing; the source-map line makes `check:bundle` fail.
- **The browser tests** (`tests/*.py`) build their own test copy of the bundle (`.artifacts/orbit.test.js`, not committed) and use it in a temporary folder, so they never touch your `orbit.js`. The test copy adds `window.OrbitTest`; the release `orbit.js` defines nothing on the page.

[REWRITE_PLAN.md](docs/plans/REWRITE_PLAN.md) explains the structure, the rules the checks enforce (`check:layers`, and one owner for the map and for interaction modes), and how 3.0.0 was tested against 2.2.1.
