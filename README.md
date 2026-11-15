# Orbit

A local link map organized as a Galaxy of suns and planets. Each sun is a group of links. Hover over a sun to preview its first five planets, click the sun to open its System, or click a planet to open its destination in a new tab.

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
