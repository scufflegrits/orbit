# Orbit handoff

## Project intent

Orbit is a local webpage for frequently visited hyperlinks. The user likes the name **Orbit**. Links are grouped into large circles. Hovering over a large circle reveals smaller, clickable link circles radiating from it; clicking the large circle opens an expanded view of that group. Clicking a link opens its destination in a new tab. No web hosting is wanted.

## Current state

- A working first version is in this folder, built with plain HTML, CSS, and JavaScript.
- `links.json` is the source of truth. It currently has six made-up sample groups (Tech, Work, Build, Read, Media, Everyday) and 30 links. Tech includes Engadget, The Verge, Ars Technica, Wired, and Hacker News, matching the user's example.
- The home view shows up to five smaller circles on hover or keyboard focus. The expanded group view shows up to eight links around the center and lists additional links below. Escape or the back link returns home.
- The design is responsive, supports keyboard focus and reduced motion, and uses no remote fonts or hosted assets.
- `request-improvements.md` exists but is empty and will be ignored by Git.
- `.gitconfig` and `.gitignore` have been created. The project is a Git repository on the `main` branch.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell and script loading |
| `styles.css` | Visual design, orbit layout, animation, responsive rules |
| `app.js` | Loads data, renders home and expanded views, handles navigation |
| `links.json` | Editable groups and destinations |
| `links-data.js` | Generated copy of the JSON for opening the page directly as a file |
| `sync.py` | Regenerates `links-data.js` from `links.json` |
| `serve.py` | Optional server bound to `127.0.0.1:8000` |
| `README.md` | User instructions |
| `.gitconfig` | Sets `main` as the default initial branch when explicitly included in a Git command |
| `.gitignore` | Ignores `99_Archive/` and Markdown files whose names begin with `request` |

## Run and edit

Open `index.html` directly in a browser. After editing `links.json`, run `python3 sync.py` in this folder and refresh the page. Do not edit `links-data.js` by hand.

Alternatively, run `python3 serve.py` and open `http://localhost:8000`. In this mode, the page reads `links.json` on refresh, so no sync step is needed. This is a loopback server on the user's machine, not a hosted site.

Each group has `id`, `name`, `description`, `color` (six-digit hex), and a `links` array. Each link has `name` and an `http` or `https` `url`. See `README.md` and the sample data for the format.

## Verification and limits

- `links.json` parsed; `app.js` and generated `links-data.js` passed `node --check`.
- A lightweight DOM simulation confirmed that the home view renders six circles and the Tech detail view renders its five destinations.
- Visual browser QA was unavailable in the task sandbox: it blocked both a loopback server socket and headless Chromium. The direct-file mode was added so the user does not depend on a local server.
- No deployment or hosting was performed, and no real personal links have been supplied yet.

## Git

The repository was initialized locally. The initial build is committed on `main`.
