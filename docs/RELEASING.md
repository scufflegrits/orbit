# Releasing Orbit

These steps release a new version of Orbit: they set the version, test it, tag it, and build a `.zip` that you can give to someone who does not use git. The zip unpacks to one `orbit-<version>/` folder that runs by opening `index.html`. It has no git history, tests, or project-planning notes.

## What you need

- **Git**, to get the project, tag the release, and build the zip.
- **Node**, to rebuild `orbit.js` after changing the version (`npm install` once).
- **Python 3 with Playwright**, to run the tests, and to check the zip's server mode. The scripts use `ORBIT_PYTHON`, else `~/.venv/bin/python`, else `python3`.
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
| `orbit.js` | The app: the bundle built from `src/` by `npm run build` (committed, so no build is needed to ship) |
| `links.json`, `links-data.js` | Main's default map, and the generated copy used when `index.html` is opened directly |
| `workspaces/`, `workspaces-data.js` | Default workspace maps and the generated data used when `index.html` is opened directly |
| `serve.py`, `sync.py` | The optional local server (with `--team` and link checking), and the script that regenerates link and workspace data (and `team-data.js` with `--team`) |
| `windows/` | The Remote Desktop helper's install, launch, and uninstall scripts |
| `README.md`, `CHANGELOG.md`, `docs/RDP_SIGNING.md` | Instructions for the person using Orbit, and what changed in each version |
| `docs/THIRD_PARTY_NOTICES.md` | The licence notices for the Lucide icons inside `orbit.js` and the bundled fonts (their licences require shipping them) |
| `fonts/` | The fonts (Inter, and DM Sans and Space Grotesk for Orbit classic), each with its licence file. Without it Orbit falls back to system fonts |

Left out: `src/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `jsconfig.json`, the rest of `docs/` (the handoff, test matrix, these release steps, and `docs/plans/`), `.gitignore`, `.gitattributes`, and `.gitconfig`. A generated `team-data.js` is never committed (it is in `.gitignore`), so a private team map is not shipped. A few links in `README.md` and `CHANGELOG.md` point to planning docs that stay in the repository; they don't work inside the zip, which is expected.

**When you add a file the person using Orbit needs** (a new page asset, script, or user guide), add it to this table and to both `git archive` commands in step 4. `index.html` loads `links-data.js`, `workspaces-data.js`, the optional `team-data.js`, and `orbit.js`; `serve.py` quietly handles missing optional generated workspace data.

The zip is built from the release tag, never from your working folder. Files you have not committed are left out, including private ones such as `tests/rdptest01.rdp`.

## 1. Set the version and write the changelog

Choose the version: the last number for fixes only (3.0.0 → 3.0.1), the middle one for new features (3.0.1 → 3.1.0), the first for a change that breaks saved data or how Orbit is opened.

1. Set `APP_VERSION` in `src/app/version.js`. It is the version shown in Settings → About and the one the commands below read.
2. Run `npm run build` to rebuild `orbit.js` with it.
3. Add the new version's section at the top of `CHANGELOG.md`: the date, and what changed for the person using Orbit (new, changed, fixed), in their words.
4. If `links.json` or `workspaces/*.json` changed, run `python3 sync.py` so `links-data.js` and `workspaces-data.js` match their source files.

## 2. Test it

A release runs every test, not only the ones for the latest change (see `docs/HANDOFF.md`, "Tests", for each runner):

- `scripts/test-local.sh`: types, layers, bundle, node tests, and every browser runner in `tests/` in file and server mode. Compare the counts with `docs/HANDOFF.md`.
- `scripts/edge/run.sh`: the browser suites in Edge on the Windows test VM (`docs/HANDOFF.md`, "Windows 11 test VM").
- If `windows/` changed: `scripts/edge/windows-checks.sh`. If opening links changed: the Open-all hand check, `scripts/edge/open-all-check.sh`.

Fix anything that fails before going on, and record the results in `docs/TEST_MATRIX.md`.

## 3. Commit, tag, and push

```sh
git status                      # only the release changes, and files you keep out on purpose
git add -A                      # or name the files; never add private files such as tests/rdptest01.rdp
git commit -m "Orbit <version>: <what changed>"
git tag -a v<version> -m "Orbit <version>"
git push main main              # the remote may be named origin instead
git push main v<version>
```

Every release has a tag (`v2.2.0`, `v3.0.1`, …), so `git checkout v<version>` brings any release back.

## 4. Build the zip

**Linux or macOS:**

```sh
VERSION=$(sed -n "s/^export const APP_VERSION = '\(.*\)';/\1/p" src/app/version.js)
mkdir -p ../orbit-dist
git archive --format=zip --prefix="orbit-$VERSION/" -o "../orbit-dist/orbit-$VERSION.zip" "v$VERSION" -- \
  index.html styles.css links.json links-data.js workspaces workspaces-data.js orbit.js \
  serve.py sync.py windows README.md CHANGELOG.md docs/RDP_SIGNING.md docs/THIRD_PARTY_NOTICES.md fonts
```

**Windows (PowerShell):**

```powershell
$Version = (Select-String -Path src\app\version.js -Pattern "APP_VERSION = '(.+)'").Matches[0].Groups[1].Value
New-Item -ItemType Directory -Force ..\orbit-dist | Out-Null
git archive --format=zip --prefix="orbit-$Version/" -o "..\orbit-dist\orbit-$Version.zip" "v$Version" -- `
  index.html styles.css links.json links-data.js workspaces workspaces-data.js orbit.js `
  serve.py sync.py windows README.md CHANGELOG.md docs/RDP_SIGNING.md docs/THIRD_PARTY_NOTICES.md fonts
```

The zip is written to an `orbit-dist` folder beside the project, so it never ends up inside the repository. If the command says the tag doesn't exist, step 3 wasn't done. An existing zip of the same version is overwritten without asking, so don't reuse a version number for a different build.

## 5. Check the zip

`scripts/edge/zip-check.sh ../orbit-dist/orbit-<version>.zip` does items 1–5 below in Chromium and in Edge on the test VM, and deletes what it extracted. Without the VM, do them by hand:

1. **List its contents.** Run `unzip -l ../orbit-dist/orbit-<version>.zip`. In PowerShell, open the zip in File Explorer instead. You should see one `orbit-<version>/` folder holding the files in the table above and nothing else.
2. **Extract it to a fresh folder** outside the project, such as your Downloads folder.
3. **Open `index.html` directly** from the extracted folder, in Chrome or Edge:
   - The Galaxy appears; Main shows nine suns and the workspace switch offers Dev Toolbox. The top bar's Main count matches `links.json` (the zip check compares them for you).
   - **Edit mode** switches on in the top bar.
   - Settings → **About** shows the version you built.
   - The browser's developer console (F12) shows no errors, apart from one "file not found" for the optional `team-data.js`.
4. **Try the local server.** In the extracted folder run `python3 serve.py` (on Windows, `py serve.py`), open <http://localhost:8000>, check the same things, then press `Ctrl+C` to stop it.
5. **Delete the extracted test folder.** If you tried things in the browser, also use Settings → Edit links → **Reset to file data** so your test changes do not linger.

## 6. Save a checksum

A checksum lets people confirm their download is complete and unchanged. Save it next to the zip and give it out alongside it.

- Linux: `cd ../orbit-dist && sha256sum orbit-<version>.zip | tee orbit-<version>.zip.sha256`
- macOS: `cd ../orbit-dist && shasum -a 256 orbit-<version>.zip | tee orbit-<version>.zip.sha256`
- Windows (PowerShell): `Get-FileHash ..\orbit-dist\orbit-<version>.zip -Algorithm SHA256`

The person who receives the zip runs the same command and compares the result. Record the checksum in `docs/TEST_MATRIX.md` with the release.

## 7. Remove older zips

Delete earlier versions' zips and checksum files from `orbit-dist`, so only the current release is handed out. Any older release can be rebuilt from its tag with step 4.

## What to tell the person receiving it

Unzip it anywhere and open `index.html`. Everything else is in the included `README.md`: adding links, Edit mode and dragging, Settings, and the optional Windows Remote Desktop helper. If they already use Orbit, `CHANGELOG.md` says what's new, and their saved links carry over.
