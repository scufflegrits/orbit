# Orbit

A local link map organized as a Galaxy of suns and planets. Each sun is a group of links. Hover over a sun to preview its first five planets, click the sun to open its System, or click a planet to open its destination in a new tab.

Use **Quick find** on the Galaxy to search sun, planet, and moon names. Results show their parent path and open the System or destination directly.

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

## Settings and help

Click the cog in the Galaxy to open Settings, Help, or About. Settings includes an **Animations** switch. Turning it off removes movement and reveal delays while leaving all links usable. The choice is saved in this browser. Orbit also honors your operating system's reduced-motion preference.

Settings also includes **Always show moons** and **Edit links**. The editor lets you add, rename, reorder, or remove suns, planets, and moons, and edit their descriptions, colors, and destination URLs. Changes appear immediately and are stored in this browser. Export JSON for a portable backup, import a JSON file to replace the browser map, or reset to the link data loaded from the project files.

Browser edits take precedence over `links.json` (or `links-data.js` in direct-file mode) until you reset. Direct-file and local-server pages have separate browser storage; use export and import to move edits between them. The browser editor does not write `links.json` directly.

The Theme setting offers Default, Alabama inspired, and Auburn inspired palettes. The latter two draw on the universities' published [Alabama colors](https://brand.ua.edu/colors/) and [Auburn colors](https://ocm.auburn.edu/brand-center/colors.php). The themes use original Orbit styling and no remote assets. Your choice is saved in this browser; select Default to return to the original appearance.
