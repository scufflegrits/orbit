# Orbit

A local link map organized into circles. Hover over a circle to reveal its links, click the center to see the whole circle, or click a smaller circle to open that destination in a new tab.

## Run

Open `index.html` in your browser. No server or internet connection is needed for the page itself.

You can also run it through a local-only server:

```bash
python3 serve.py
```

Then open <http://localhost:8000>. The server listens only on this computer. Press `Ctrl+C` to stop it.

## Add your links

Edit `links.json`. Each item in `groups` is a large circle, and each item in its `links` array is a destination:

```json
{
  "id": "tech",
  "name": "Tech",
  "description": "News, ideas, and what comes next",
  "color": "#79d9f8",
  "links": [
    { "name": "Engadget", "url": "https://www.engadget.com/" }
  ]
}
```

Keep the surrounding `{"groups": [...]}` structure. If you opened `index.html` directly, run `python3 sync.py` after editing `links.json`, then refresh the page. If you use the local server, just refresh. Up to five links appear on the home hover preview; up to eight appear around the center in the expanded view, with any extra links listed below.
