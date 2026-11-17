# Orbit

A local link map organized as a Galaxy of suns and planets. Each sun is a group of destinations. Hover over a sun to preview its first five planets, click the sun to open its System, or click a planet to open its destination.

Use **Quick find** in the top bar on the Galaxy or any System to search sun, planet, and moon names. Searching from a System returns to the Galaxy with matching results. Results show their parent path and open the System or destination directly.

The bundled map has nine sample suns, including **Stocks & Investing**, **Science**, and **Labs**, with 45 planets and 61 moons. These destinations are examples; replace them with your own in Edit links.

## Run

Open `index.html` in your browser. No server or internet connection is needed for the page itself.

You can also run it through a local-only server:

```bash
python3 serve.py
```

Then open <http://localhost:8000>. The server listens only on this computer. Press `Ctrl+C` to stop it.

## Add your links

Edit `links.json`. Each item in `groups` is a sun, and each item in its `links` array is a planet with a destination:

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

The `moons` array is optional. Hover over a planet to reveal its moons; clicking the planet still opens its own destination. The Galaxy previews up to five planets per sun. A System shows up to eight planets around its sun and lists additional planets below. Up to four moons appear around a hovered planet; any extras are listed in the System.

Keep the surrounding `{"groups": [...]}` structure. If you opened `index.html` directly, run `python3 sync.py` after editing `links.json`, then refresh the page. If you use the local server, just refresh.

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

## Rearrange by dragging

Turn on **Edit mode** in the top bar to rearrange the map with a mouse or pen. It is off after every reload. While it is on, planets and moons do not open, download, or launch Remote Desktop; a sun still opens its System.

- Drag a planet onto another sun to move it there with all its moons.
- Drag a moon onto another planet. In the Galaxy, pause on another sun to show its planets.
- In a System, a list of the other suns and planets appears while you drag, because only one sun is on screen.
- **Undo last drag** reverses the most recent move until the map changes again or the page reloads.

A moved link keeps its name, destination, and any imported `.rdp` profile, and goes to the end of its new parent. The Galaxy shows only the first five planets and four moons, so use a System or **Edit links** for the rest. In Edit mode, a Quick find result opens that planet or moon in Edit links. Dragging needs a mouse or pen; with a keyboard, use the move controls in Edit links. Touch dragging is not supported.

## Keyboard

Orbit works without a mouse. Press `/` anywhere to jump to **Quick find**, then use Down Arrow to move into the results, Up and Down Arrow to move between them, and Enter to open one.

Tab moves through the page. Focusing a sun shows its planets and focusing a planet shows its moons, each with a visible focus ring. Arrow keys move between suns by position, between sibling planets or moons, down from a planet into its moons, and back up. Enter opens the focused item.

Escape closes the menu first; when the menu is closed it cancels a drag, then turns Edit mode off, then clears Quick find, and after that it returns from a System to the Galaxy. While the menu is open, Tab stays inside it, and closing it returns focus to the cog.

## Settings and help

Click the cog on the Galaxy or any System to open Settings, Help, or About. Settings includes an **Animations** switch. Turning it off removes movement and reveal delays while leaving all links usable. The choice is saved in this browser. Orbit also honors your operating system's reduced-motion preference.

The **Font size** setting offers Small (90%), Standard (100%), Large (115%), and Extra large (130%). Standard is the default. The choice applies immediately throughout Orbit and is saved in this browser.
Circle labels use a shared size for each level across the Galaxy, and long names wrap inside their circles. Moons have larger circles and text; other interface text grows slightly on wide desktop screens.

Settings also includes **Always show moons** and **Edit links**. Edit links opens a full-screen workspace with the complete sun, planet, and moon tree beside the selected item's editor. The editor lets you add, rename, reorder, or remove suns, planets, and moons, move a planet to another sun or a moon to another planet, and edit descriptions, colors, website URLs, and Remote Desktop hosts. Changes appear immediately and are stored in this browser. Export JSON for a portable backup, import a JSON file to replace the browser map, or reset to the link data loaded from the project files.
Sun descriptions can include links within their text. In a sun's Description field, write `[label](https://example.com)`; use an `http` or `https` URL. The link appears in the Galaxy and System and opens in a new tab. Unsupported link markup remains plain text. Descriptions are included in JSON exports.

To share part of your map, open a sun, planet, or moon in **Edit links** and choose **Export sun**, **Export planet**, or **Export moon**. A sun export includes its planets and moons; a planet export includes its moons; a moon export includes only that moon. The downloaded `orbit-*.json` file contains just that item and its descendants. To receive one, use **Import sun** in the editor's sun list, **Import planet** inside the destination sun, or **Import moon** inside the destination planet. Review the item and destination, then add it. This appends the imported links and keeps your existing map. If an imported sun ID already exists, Orbit gives the new sun a unique ID. **Import JSON** still replaces the entire Galaxy after review.

If someone shares a planet and you want it at the top level, choose **Import planet as sun** in the sun list. Orbit creates a sun named after the planet and places the shared planet inside it as its first planet. The planet's destination and moons remain available. The new sun receives a default color that you can change in the editor.

Settings and Edit links show whether the active map is bundled project data or browser edits. After removing a sun, planet, or moon, use **Undo removal** in the editor to restore it. The latest removal remains available after a reload; importing or resetting the map clears it.
To copy a moon to another planet, open that moon in **Edit links** and choose **Copy moon**. Pick a target planet in the review screen. The copy keeps the saved destination and any imported Remote Desktop profile, and later edits to either moon are independent.

Browser edits take precedence over `links.json` (or `links-data.js` in direct-file mode) until you reset. Direct-file and local-server pages have separate browser storage; use export and import to move edits between them. The browser editor does not write `links.json` directly.

The Theme setting offers Default, Red, and Blue. Red and Blue retain their existing palettes, and previously saved theme choices still work. Your choice is saved in this browser; select Default to return to the original appearance.
