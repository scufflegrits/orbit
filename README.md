# Orbit

A local link map organized as a Galaxy of suns and planets. Each sun is a group of destinations. Hover over a sun to preview its first five planets, click the sun to open its System, or click a planet to open its destination.

Use **Quick find** in the Galaxy's top bar to search sun, planet, and moon names. Results show their parent path and open the System or destination directly.

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

To open the Windows client directly from a moon, install the per-user **Orbit launcher** once on the Windows PC where you use Orbit. This opens the built-in `mstsc.exe`; the separate MSRDC app installed by `winget install Microsoft.RemoteDesktopClient` does not register Orbit's launcher. From the project folder, run with Windows PowerShell 5.1:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\Install-OrbitRdp.ps1
```

Windows 10 and 11 include Windows PowerShell 5.1 by default. If it is unavailable but PowerShell 7 is installed, run the installer with `pwsh.exe` instead:

```powershell
pwsh.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\Install-OrbitRdp.ps1
```

The installer registers the same PowerShell executable that ran it. Running it again replaces the current user's `orbit-rdp://` registration with the new executable, so a 5.1 install followed by a PowerShell 7 install switches future clicks to `pwsh.exe`. It also refreshes the copied helper; Orbit's browser settings and generated `.rdp` files remain in place. Re-run the installer if you later remove the registered PowerShell installation.

Then choose **Settings → Remote Desktop → Open mstsc.exe**. Clicking a lab planet or moon asks Windows to open the Orbit launcher, which opens Remote Desktop Connection with the computer prefilled. Click **Connect** in the client. Your browser may ask whether to open the external app. This setting is saved in the browser; **Download .rdp file** remains available in the same menu. The helper stores connection files under `%LOCALAPPDATA%\Orbit\Connections` and stores no credentials.

To remove the launcher registration from that Windows account, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\Uninstall-OrbitRdp.ps1`. The generated connection files remain available for manual use.

## Settings and help

Click the cog in the Galaxy to open Settings, Help, or About. Settings includes an **Animations** switch. Turning it off removes movement and reveal delays while leaving all links usable. The choice is saved in this browser. Orbit also honors your operating system's reduced-motion preference.

The **Font size** setting offers Small (90%), Standard (100%), Large (115%), and Extra large (130%). Standard is the default. The choice applies immediately throughout Orbit and is saved in this browser.

Settings also includes **Always show moons** and **Edit links**. The editor lets you add, rename, reorder, or remove suns, planets, and moons, and edit their descriptions, colors, website URLs, and Remote Desktop hosts. Changes appear immediately and are stored in this browser. Export JSON for a portable backup, import a JSON file to replace the browser map, or reset to the link data loaded from the project files.

To share part of your map, open a sun, planet, or moon in **Edit links** and choose **Export sun**, **Export planet**, or **Export moon**. A sun export includes its planets and moons; a planet export includes its moons; a moon export includes only that moon. The downloaded `orbit-*.json` file contains just that item and its descendants. To receive one, use **Import sun** in the editor's sun list, **Import planet** inside the destination sun, or **Import moon** inside the destination planet. Review the item and destination, then add it. This appends the imported links and keeps your existing map. If an imported sun ID already exists, Orbit gives the new sun a unique ID. **Import JSON** still replaces the entire Galaxy after review.

If someone shares a planet and you want it at the top level, choose **Import planet as sun** in the sun list. Orbit creates a sun named after the planet and places the shared planet inside it as its first planet. The planet's destination and moons remain available. The new sun receives a default color that you can change in the editor.

Settings and Edit links show whether the active map is bundled project data or browser edits. After removing a sun, planet, or moon, use **Undo removal** in the editor to restore it. The latest removal remains available after a reload; importing or resetting the map clears it.

Browser edits take precedence over `links.json` (or `links-data.js` in direct-file mode) until you reset. Direct-file and local-server pages have separate browser storage; use export and import to move edits between them. The browser editor does not write `links.json` directly.

The Theme setting offers Default, Alabama inspired, and Auburn inspired palettes. The latter two draw on the universities' published [Alabama colors](https://brand.ua.edu/colors/) and [Auburn colors](https://ocm.auburn.edu/brand-center/colors.php). The themes use original Orbit styling and no remote assets. Your choice is saved in this browser; select Default to return to the original appearance.
