# Orbit

A local link map organized as a Galaxy of suns and planets. Each sun is a group of destinations, its planets are links, and a planet's moons are related links. Hover over a sun to preview its planets, click it to open its System, and click a planet to open it. Quick find, a command palette (`Ctrl+K`), favorites, routines, workspaces, and Windows Remote Desktop links are built in.

Orbit includes **Main** and the default **Dev Toolbox** workspace. Main has nine suns, 45 planets, and 106 destinations; Dev Toolbox has five suns and 31 destinations. Dev Toolbox collects Git, web, documentation, data, and diagramming tools.

**How to use Orbit is in the Help guide, `help.html`.** Open it from your copy of Orbit: the **?** beside each part of Settings, the Help tab, or **Help** in the command palette. This README covers running Orbit, its data files, and setup. (On GitHub, `help.html` shows as source; open it from a downloaded copy.)

## What's new in 3.0

Orbit 3.0.0 carried over saved links, routines, workspaces, and settings from 2.2.1. It rebuilt the code underneath (see [Changing Orbit's code](#changing-orbits-code)), so later changes are safer to make. Earlier versions and the full comparison with 2.2.1 are in [CHANGELOG.md](CHANGELOG.md).

**Once you save a map containing group planets, avoid opening Orbit 3.0.2 or earlier with the same browser storage. Older versions reject the saved map, fall back to the default map, and can overwrite your saved map on the next edit.** Back up your map using **Export → Whole map (JSON)** before switching versions. The current version backs up unreadable browser data before replacing it.

## Run

Open `index.html` in your browser. No server or internet connection is needed for the page itself.

**Browsers:** use an up-to-date browser. Orbit needs at least **Edge 144, Chrome 144, Firefox 147, or Safari 26.3**, the first releases of 2026. It is tested in Edge and Chrome. Firefox and Safari should work but aren't tested. In an older browser, parts of the page may lose their colours or layout.

You can also run it through a local-only server:

```bash
python3 serve.py
```

Then open <http://localhost:8000>. The server listens only on this computer. Press `Ctrl+C` to stop it. Use `--port` to pick another port, and `--team PATH` to add a read-only [team map](#team-map). The server is also what makes **Check links** in the editor work.

## Using Orbit

The Help guide, [`help.html`](help.html), explains everything. Its sections:

- [Find and open links](help.html#find-and-open): the Galaxy and Systems, group planets, Quick find, the command palette, favorites, Open all, list view, notes, and placeholders.
- [Change how the Galaxy looks](help.html#change-the-galaxy): themes, fonts, background, animations, site icons, and sun icons.
- [Edit your map](help.html#edit-your-map): Edit links, editing from the map, quick add, group planets, dragging in Edit mode, import, export, duplicates, link checking, History, and backups.
- [Workspaces](help.html#workspaces), [Routines](help.html#routines), [Remote Desktop](help.html#remote-desktop), [Team map](help.html#team-map), and [Keyboard](help.html#keyboard).
- [Settings reference](help.html#settings): every setting, group by group.

## Back up your map

Your edits are saved in this browser, separately for opening `index.html` directly and for `serve.py`. In **Settings → Edit links**, use **Export → Whole map (JSON)** for a backup, and **Import → Import a file** to restore it or move it to another browser. **Reset to file data** returns to the project's map; History keeps the previous one. Orbit suggests a backup after 20 changes or 14 days.

## Map files

Orbit's default maps are files you can edit: `links.json` for Main and `workspaces/<id>.json` for other default workspaces. Each item in `groups` is a sun, and each item in its `links` array is a planet. A website planet looks like this:

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

- `moons` is optional. Keep the surrounding `{"groups": [...]}` structure.
- A **group planet** uses `"type": "group"`, a name and no address of its own, with its destinations in `"moons"`.
- A **Windows Remote Desktop** link uses `type` and `host` instead of `url`: `{ "name": "lab1-server1", "type": "rdp", "host": "lab1-server1" }`. The **Labs** sun has examples; change their computer names to hosts on your network.
- If you open `index.html` directly, run `python3 sync.py` after editing these files, then refresh. With the local server, just refresh. Your browser edits take precedence until you use **Reset to file data**; the browser editor never writes these files.

### Default workspaces

A fresh copy includes Dev Toolbox automatically, and existing users get it too. If you edited Main before Dev Toolbox became a workspace, Orbit offers once to remove its old Dev Toolbox sun. You can remove the default workspace and add it back later from **Settings → Workspaces**.

To add another default workspace, create `workspaces/<id>.json` with its name and map, then run `python3 sync.py`. The generated `workspaces-data.js` is committed so direct file mode works; served mode reads the JSON file and falls back to the generated copy.

## Windows Remote Desktop helper

By default, clicking a Remote Desktop link downloads a `.rdp` file. To open Remote Desktop Connection directly instead, install the per-user **Orbit launcher** once on the Windows PC where you use Orbit. It opens the built-in `mstsc.exe`; the separate MSRDC app installed by `winget install Microsoft.RemoteDesktopClient` does not register Orbit's launcher. From the project folder, run with Windows PowerShell 5.1:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\Install-OrbitRdp.ps1
```

Windows 10 and 11 include Windows PowerShell 5.1 by default. If it is unavailable but PowerShell 7 is installed, run the installer with `pwsh.exe` instead:

```powershell
pwsh.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\Install-OrbitRdp.ps1
```

The installer registers the same PowerShell executable that ran it. Running it again replaces the current user's `orbit-rdp://` registration with the new executable, so a 5.1 install followed by a PowerShell 7 install switches future clicks to `pwsh.exe`. It also refreshes the copied helper; Orbit's browser settings and generated `.rdp` files remain in place. Re-run the installer after updating Orbit, or if you later remove the registered PowerShell installation.

Then choose **Settings → Remote Desktop → Open mstsc.exe**. A host-only link uses `mstsc.exe /v:` with a credential prompt and creates no connection file. A link with imported profile settings writes a file under `%LOCALAPPDATA%\Orbit\Connections` and opens it for review in Remote Desktop Connection. Your browser may ask whether to open the external app. Orbit stores no credentials.

Before reinstalling or uninstalling, the scripts save any existing `orbit-rdp` registry key as a uniquely named `.reg` file in `%LOCALAPPDATA%\Orbit` and print its path. If that backup fails, the script stops before changing the registration. To remove the launcher registration from that Windows account, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\Uninstall-OrbitRdp.ps1`. The generated connection files and registry backups remain available for manual use. Signing the scripts is covered in [docs/RDP_SIGNING.md](docs/RDP_SIGNING.md).

## Team map

A team map is an ordinary Orbit map file that a group shares; its suns appear read-only, marked **TEAM**. See the guide's [Team map](help.html#team-map) section for using it. To set one up:

- With the local server: `python3 serve.py --team /path/to/team-links.json`.
- Opening `index.html` directly: `python3 sync.py --team /path/to/team-links.json` writes `team-data.js` next to `index.html`; run `python3 sync.py --no-team` to remove it. Without that file, the browser console shows one harmless “file not found” message.

## Changing Orbit's code

This section is for working on Orbit from its git repository; the release zip doesn't include the code or tests.

Using Orbit needs no build or install: open `index.html`. Changing its code needs Node: since 3.0.0 the whole app is in `src/` (ES modules: `core/` for pure rules, `state/` for saved data and the one store, `services/` for opening links and files, `ui/` for the screens, `app/` for start-up), bundled into one file:

- **`orbit.js` is built from `src/` and committed.** After you change anything in `src/`, run `npm install` once, then `npm run build`, and commit `orbit.js` with your change. Never edit `orbit.js` by hand.
- **`npm run check:bundle`** confirms the committed `orbit.js` matches `src/`.
- **Icons** are Lucide's, generated into `src/ui/icon-data.js` by `npm run icons` from the version pinned in `package.json`. To add one, add its name (from <https://lucide.dev/icons>) to `scripts/icons.mjs`, run `npm run icons`, then use `icon('name')` from `src/ui/icons.js`. **`npm run check:icons`** fails if the generated file is out of date.
- **`npm run check`** type-checks `src/`; **`npm run check:layers`** checks how its folders depend on each other.
- **`npm run test:unit`** runs the node tests next to the code (`src/**/*.test.js`). Many compare the new code with Orbit 2.2.1's, kept frozen in `tests/oracle/`, on thousands of random maps; a failure names the input that differs. When you change a behavior on purpose, the matching comparison fails: update that test's expected result (or drop its 2.2.1 comparison), don't delete the test.
- **`npm run watch`** rebuilds `orbit.js` on every change, with a source map for the browser's developer tools. Run `npm run build` before committing; the source-map line makes `check:bundle` fail.
- **The browser tests** (`tests/*.py`) build their own test copy of the bundle (`.artifacts/orbit.test.js`, not committed) and use it in a temporary folder, so they never touch your `orbit.js`. The test copy adds `window.OrbitTest`; the release `orbit.js` defines nothing on the page.

[REWRITE_PLAN.md](docs/plans/REWRITE_PLAN.md) explains the structure, the rules the checks enforce (`check:layers`, and one owner for the map and for interaction modes), and how 3.0.0 was tested against 2.2.1.

## Credits

Icons: [Lucide](https://lucide.dev) (ISC), including icons derived from Feather (MIT). Fonts: [Inter](https://rsms.me/inter/) (the default), and DM Sans and Space Grotesk (Orbit classic), all under the SIL Open Font License 1.1; each font's licence is beside it in `fonts/`. The Constellations backdrop adapts the MIT-licensed particles and backdrop from [Launchpad](https://github.com/J-Houghton/launchpad). All notices are in [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).
