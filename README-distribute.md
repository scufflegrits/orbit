# Building an Orbit distribution zip

These steps make a `.zip` of Orbit that you can give to someone who does not use git. The zip unpacks to one `orbit-<version>/` folder that runs by opening `index.html`. It has no git history, tests, or project-planning notes.

## What you need

- **Git**, to get the project and build the zip.
- **Python 3** (optional), to check the server mode before you hand the zip out.
- The project cloned from GitHub:

  ```sh
  git clone git@github.com:scufflegrits/orbit.git
  cd orbit
  ```

  If you already have a copy, update it instead: `git switch main` and then `git pull`. The remote may be named `main` rather than `origin`; check with `git remote -v`, and if so, run `git pull main main`.

## What goes in the zip

| Included | Why |
| --- | --- |
| `index.html`, `styles.css` | The page |
| `rdp.js`, `storage.js`, `team.js`, `favorites.js`, `editor.js`, `editor-page.js`, `tools.js`, `routines.js`, `menu.js`, `render.js`, `drag.js`, `palette.js`, `keys.js`, `app.js` | The app scripts that `index.html` loads |
| `links.json`, `links-data.js` | The sample link map, and the generated copy used when `index.html` is opened directly |
| `serve.py`, `sync.py` | The optional local server (with `--team` and link checking), and the script that regenerates `links-data.js` (and `team-data.js` with `--team`) |
| `windows/` | The Remote Desktop helper's install, launch, and uninstall scripts |
| `README.md`, `RDP_SIGNING.md` | Instructions for the person using Orbit |

Left out: `tests/`, `HANDOFF.md`, `ROADMAP.md`, `DRAG_DROP_PLAN.md`, `FEATURES_PLAN.md`, `REFACTOR_PLAN.md`, `TEST_MATRIX.md`, `.gitignore`, and `.gitconfig`. A generated `team-data.js` is never committed (it is in `.gitignore`), so a private team map is not shipped.

The zip is built from the last commit, never from your working folder. Files you have not committed are left out, including private ones such as `tests/rdptest01.rdp`. Commit any change you want to ship before you build.

## 1. Check that you are on the commit you want to ship

```sh
git status
git log --oneline -1
```

`git status` should show nothing to commit, except files you intend to keep out of the zip. Make sure `links.json` and `links-data.js` agree; if you changed `links.json`, run `python3 sync.py` and commit the result.

## 2. Build the zip

The version comes from `APP_VERSION` in `app.js`, and that is the version shown in Settings → About. Update it and commit before a new release.

**Linux or macOS:**

```sh
VERSION=$(sed -n "s/^const APP_VERSION = '\(.*\)';/\1/p" app.js)
mkdir -p ../orbit-dist
git archive --format=zip --prefix="orbit-$VERSION/" -o "../orbit-dist/orbit-$VERSION.zip" HEAD -- \
  index.html styles.css links.json links-data.js \
  rdp.js storage.js team.js favorites.js editor.js editor-page.js tools.js routines.js menu.js render.js drag.js palette.js keys.js app.js \
  serve.py sync.py windows README.md RDP_SIGNING.md
```

**Windows (PowerShell):**

```powershell
$Version = (Select-String -Path app.js -Pattern "APP_VERSION = '(.+)'").Matches[0].Groups[1].Value
New-Item -ItemType Directory -Force ..\orbit-dist | Out-Null
git archive --format=zip --prefix="orbit-$Version/" -o "..\orbit-dist\orbit-$Version.zip" HEAD -- `
  index.html styles.css links.json links-data.js `
  rdp.js storage.js team.js favorites.js editor.js editor-page.js tools.js routines.js menu.js render.js drag.js palette.js keys.js app.js `
  serve.py sync.py windows README.md RDP_SIGNING.md
```

The zip is written to an `orbit-dist` folder beside the project, so it never ends up inside the repository.

**When a script is added or renamed:** the file list above must match the `<script>` tags in `index.html` (except the optional `team-data.js`, which is never shipped). Compare the two before each release, because a missing script stops the page from loading.

## 3. Check the zip

1. **List its contents.** Run `unzip -l ../orbit-dist/orbit-<version>.zip`. In PowerShell, open the zip in File Explorer instead. You should see one `orbit-<version>/` folder holding the files in the table above and nothing else.
2. **Extract it to a fresh folder** outside the project, such as your Downloads folder.
3. **Open `index.html` directly** from the extracted folder in a browser:
   - The Galaxy appears; the bundled sample map shows 9 suns and 106 links.
   - **Edit mode** switches on in the top bar.
   - Settings → **About** shows the version you built.
4. **Optionally, try the local server.** In the extracted folder run `python3 serve.py` (on Windows, `py serve.py`), open <http://localhost:8000>, check the same things, then press `Ctrl+C` to stop it.
5. **Delete the extracted test folder.** If you tried things in the browser, also use Settings → Edit links → **Reset to file data** so your test changes do not linger.

## 4. Publish a checksum (optional)

A checksum lets people confirm their download is complete and unchanged. Give it out alongside the zip.

- Linux: `sha256sum ../orbit-dist/orbit-<version>.zip`
- macOS: `shasum -a 256 ../orbit-dist/orbit-<version>.zip`
- Windows (PowerShell): `Get-FileHash ..\orbit-dist\orbit-<version>.zip -Algorithm SHA256`

The person who receives the zip runs the same command and compares the result.

## What to tell the person receiving it

Unzip it anywhere and open `index.html`. Everything else is in the included `README.md`: adding links, Edit mode and dragging, Settings, and the optional Windows Remote Desktop helper.
