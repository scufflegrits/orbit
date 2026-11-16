# Orbit handoff

## Project intent

Orbit is a local webpage for frequently visited links. The Galaxy shows suns (groups). Hovering over a sun reveals its first five planets (destinations); hovering over a planet reveals its moons (nested destinations). Clicking a sun opens its System, and clicking a planet or moon opens its URL in a new tab. Hosting and accounts are not required.

## Current state

- Milestones 1–14 are complete. Milestones 15–18 are implemented and awaiting the next test batch requested by the user. See [ROADMAP.md](ROADMAP.md) and [TEST_MATRIX.md](TEST_MATRIX.md).
- The bundled data contains nine sample suns, 45 planets, and 61 moons. Five planets can appear around each Galaxy sun; eight appear around a System sun. Overflow lists keep additional destinations reachable.
- The cog and Quick find appear on the Galaxy and System views. Quick find from a System returns to Galaxy results. The home view omits the large intro block; navigation guidance is in Help. The cog panel enters from the right.
- Themes are named Default, Red, and Blue. Settings also includes Animations, Always show moons, font size, Remote Desktop mode, and the local link editor.
- The editor supports scoped sun/planet/moon JSON sharing and importing a planet as a sun. It can also import local `.rdp` profiles into planet or moon entries, preserving settings while excluding password, token, and signature fields.
- Labs contains `lab1`–`lab5` and five `lab1` server moons. Their hosts are examples. Remote Desktop destinations download `.rdp` files by default. The Windows helper passes imported profiles to built-in `mstsc.exe`; the user confirmed native profile launch works on Windows after rerunning the installer. Installing MSRDC does not register Orbit's protocol.
- The installer registers the executable running it: Windows PowerShell 5.1 (`powershell.exe`) or PowerShell 7 (`pwsh.exe`). Running it again overwrites the per-user protocol command and refreshes the helper, so moving from 5.1 to 7 switches future clicks. Settings and README show both commands; the user must re-run the installer if that executable is removed.
- Keyboard navigation is deferred by the roadmap. Touch interaction is outside its scope.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell and script loading |
| `styles.css` | Layout, animations, responsive rules, and themes |
| `app.js` | Data loading, rendering, navigation, settings, and editor |
| `links.json` | Bundled suns, planets, and moons |
| `links-data.js` | Generated copy of the JSON for direct-file use |
| `sync.py` | Regenerates `links-data.js` from `links.json` |
| `serve.py` | Optional local server bound to `127.0.0.1:8000` |
| `tests/browser_matrix.py` | Playwright checks for the roadmap milestones |
| `README.md` | User instructions |
| `ROADMAP.md` | Scope, milestones, and deferred work |
| `TEST_MATRIX.md` | Test cases, results, and milestone commit record |
| `windows/Install-OrbitRdp.ps1` | Per-user Windows protocol registration |
| `windows/OrbitRdpLauncher.ps1` | Validates a target and opens Remote Desktop Connection |
| `windows/Uninstall-OrbitRdp.ps1` | Removes the per-user protocol registration |

## Run and edit

Open `index.html` directly, or run `python3 serve.py` and open `http://localhost:8000`. The editor stores changes in the current browser; use Export JSON to back them up and Import JSON to move them between run modes. The browser editor does not write `links.json`.

To edit bundled data, change `links.json` and run `python3 sync.py` for direct-file mode. The local server reads `links.json` on refresh. Browser overrides continue to take precedence until Reset to file data is used.

## Verification

The Playwright runner currently accepts `--milestone` values only through 14. Milestone 18 profile-import checks have not been automated or run. The user confirmed imported-profile native launch on Windows after updating the helper; that check is recorded as M18-04 in `TEST_MATRIX.md`.

## Active handoff — automate imported RDP profile checks

The user asked whether the remaining profile checks can be automated, then authorized writing the handoff. They saved a fixture at `tests/rdptest01.rdp`. It is UTF-16 little-endian with CRLF line endings, which exercises the importer's UTF-16 decoding path. Treat the fixture as user-provided connection data: avoid printing its setting values in logs or committing it without an explicit decision. `git status` currently shows it as untracked.

The implementation is in `app.js` and `windows/OrbitRdpLauncher.ps1`. Import is available while editing a planet or moon. It saves non-secret profile settings with that destination, strips password/token/signature settings, and updates `full address` when the host is edited. Downloads use the profile. Native launch sends it through the protocol URI to the helper. The user has already confirmed that native profile launch works after rerunning the installer.

Next work:

1. Add a `run_milestone_18` Playwright check to `tests/browser_matrix.py` and extend the CLI milestone range and dispatch. Run it in both file and local-server modes.
2. Use `tests/rdptest01.rdp` as the UTF-16 fixture. Import it into the existing `Labs → lab1 → lab1-server3` moon, save, reload, and check the address and representative settings without logging private values.
3. Download the imported moon's `.rdp` file and verify its settings remain. Edit the host and check that the saved and downloaded `full address` changes with it. Export the moon JSON and verify `rdpProfile` is included.
4. In-memory upload fixtures can exercise malformed and oversized imports and verify the saved map stays unchanged. Use a synthetic profile containing password, token, and signature keys to verify those fields are excluded. Do not modify the user fixture to create negative cases.
5. Update M18-01 to describe UTF-16 input, add coverage for import persistence, export/download, host edits, and invalid input in M18-02/M18-03, and record each automated result. M18-04 is already user-confirmed on Windows.
6. After checks, update `TEST_MATRIX.md` results and milestone summary. Update `ROADMAP.md` status and completion note only if all milestone checks are complete; keep M18 in progress if any check remains pending or fails. Update `README.md` if the actual import behavior or invocation guidance changes, and update this handoff with the final results and remaining Windows-only limitations.
7. Reconcile milestone range references: `README.md` currently says `--milestone 18`, but the runner only accepts through 14. After adding the runner, run `/home/sysadmin/.venv/bin/python tests/browser_matrix.py --milestone 18`.
8. Review `git status` and the diff. Keep `tests/rdptest01.rdp` untracked unless its contents are confirmed safe and there is a clear reason to commit the user-provided fixture. Commit the implementation and docs after checks, then push; the user requested both.

The recent README, ROADMAP, and TEST_MATRIX edits are uncommitted; keep them. `HANDOFF.md` is also being updated with the plan. No tests were run in the preceding turn.

No deployment or hosting was performed, and no personal links have been supplied.
