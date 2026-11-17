# Orbit roadmap

Status: milestones 1–14, 18, and 19 complete (2026-11-15 and 2026-11-16); milestones 15–17 are implemented, with testing deferred at the user's request. Native `mstsc.exe` launch for host-only and imported-profile links is confirmed on Windows 11; the PowerShell 7 installer path is also confirmed.

The editor is part of the local browser app; it does not require hosting or an account.

## Product language

| Term | Meaning |
| --- | --- |
| Galaxy | Home view containing all suns |
| Sun | A top-level group, such as Tech |
| System | The expanded view opened from a sun |
| Planet | A destination link belonging to a sun, such as Engadget |
| Moon | A nested link belonging to a planet |
| Spokes | Lines connecting a sun to planets or a planet to moons |

The earlier improvement notes used a few terms loosely. The Galaxy already shows six suns, which is a good starting layout. The five small circles previewed around a sun are planets. Hovering over a sun reveals its planets; hovering over a planet reveals its moons. The System supports more planets than the Galaxy preview, and each planet can have moons.

## Starting point (before milestone 1)

- The current home view already provides the basic Galaxy: it displays six groups, each with a sun and up to five planets on hover or keyboard focus.
- Clicking a sun opens the current expanded group view, which becomes the System. It displays up to eight planets around the sun and lists the rest below.
- Planets currently open external destinations in a new tab. Adding a planet requires editing `links.json`; there is no moon data, in-app link editor, settings menu, theme switcher, or import/export interface.
- `links.json` is the editable data source. `links-data.js` is generated for direct `file://` use, while the local server reads `links.json` on refresh.

## Milestone 1 — Galaxy layout and language

- Update visible labels and help text to use Galaxy, Sun, System, and Planet consistently.
- Rename the back action to “Return to Galaxy.” Keep the current sun-to-System navigation.
- Keep the current six suns visible in the Galaxy. Let the layout grow as suns are added without hiding existing ones.
- On hover, reveal only the first five **planets** around a sun.

**Done when:** A user can find every sun, open its System, and return to the Galaxy with a pointer; the interface uses the same terms as this document.

## Milestone 2 — More planets and nested moons

- Make the System a useful view of all its planets, beyond the Galaxy's five-planet preview. The current System places eight planets around the sun and lists any others below.
- Define a readable layout for larger groups, including how many planets appear around the sun, how additional planets are presented, and how users reach every destination.
- Treat the five planets in the Galaxy preview and eight planets around the current System sun as display limits, not limits on how many planets a sun may contain.
- Extend `groups[].links[]` so each planet can optionally contain a `moons` array of destination links. Existing planets without moons must keep working.
- When a sun's planets are visible, hovering over a planet reveals its moons. Use the same planet-to-moon behavior in the System. Draw sun-to-planet and planet-to-moon spokes where those circles appear.
- Preserve the planet's own destination link. Keep the moon cluster visible while the pointer moves from its planet to a moon.
- Define an overflow layout for planets with many moons so every nested destination remains reachable.
- Do not cap how many moons a planet can store. Show all of them through the visual layout or an overflow list when space runs out.

**Done when:** The Galaxy reveals planets from suns and moons from planets; Systems remain readable with more than eight planets; every planet and moon is reachable with a pointer.

## Milestone 3 — Settings, Help, and About

- Add a cog to the Galaxy. Activating it opens a menu that slides up with **Settings**, **Help**, and **About**.
- Give Settings a clear place for an **Animations** on/off switch and for theme choice, **Edit links**, and “always show moons” as those features are delivered in later milestones. Help explains Galaxy → Sun → Planet → Moon navigation and the System view; About describes the local app.
- Default Animations to **On**. When switched **Off**, remove movement, fades, and reveal delays throughout the Galaxy, Systems, moon clusters, and settings panels while keeping every interaction available. Save the choice locally across reloads.
- Continue honoring the operating system's reduced-motion preference even when the Animations switch is On.
- Support a visible close control, outside-click dismissal, reduced motion, and narrow desktop windows for the menu and its panels.

**Done when:** The cog and all three entries work with a pointer; the menu and panels can be closed without reloading the page; switching Animations Off makes transitions immediate and the choice survives a reload.

## Milestone 4 — Local web editor and portability

- Add “always show moons” to Settings. When enabled, keep moons visible around planets that are already displayed in the Galaxy or System; the option does not force hidden Galaxy planets to appear.
- Build **Edit links** into the local browser interface. Let the user add, rename, reorder, and remove suns; edit each sun's description and color; and add, rename, reorder, and remove its planets and their moons.
- Let the user define or change each planet's and moon's destination URL. Keep the parent sun or planet clear while editing, and show saved changes in the Galaxy and Systems immediately.
- Give new suns stable, unique IDs so renaming a sun does not change its System link.
- Validate required names, sun colors, and `http` or `https` URLs. Confirm removal of a sun or planet when it would also remove its children.
- Save edits in this browser so they survive a reload in direct-file and local-server modes. Browser edits take precedence over the bundled link data until the user resets to file data or imports a replacement. Export provides a portable JSON backup; the browser editor does not write project files directly.
- Add JSON import with format validation, a review step, and clear errors. Accept existing `groups` and `links` data and optional `moons` arrays.
- Add JSON export that includes every sun, planet, and moon. Document how browser-imported data relates to `links.json`, how to return to the file data, and how to back up changes.
- Keep all data handling local to the user's device.

**Done when:** A user can define links and manage suns, planets, and moons entirely in the browser, without editing JSON. Changes appear under the chosen parent, survive a reload, and appear in exports. Import and reset preserve or restore a complete link map, and invalid imports leave the current map intact.

## Milestone 5 — Themes

- Keep the current appearance as the **Default** theme.
- Add distinct themes inspired by the [University of Alabama](https://www.ua.edu/) and [Auburn University](https://www.auburn.edu/) websites. Define original color palettes and component styles; do not depend on remote assets.
- Apply themes across the Galaxy, Systems, planets, moons, spokes, and menus. Save the selected theme locally and provide a way to return to Default.
- Check text and control contrast in every theme, including hover states.

**Done when:** Theme changes take effect immediately, survive a reload in the same browser, and remain usable in both the direct-file and local-server modes.

## Implementation defaults

| Choice | Default |
| --- | --- |
| How should the Galaxy grow beyond its current six suns? | Keep all suns accessible and adapt the grid as more are added. |
| How should a System present more than eight planets? | Keep a readable circular layout plus a clearly labeled list for overflow. |
| How should planets beyond the Galaxy's first five be included in its preview? | Let the user reorder planets in Settings; the first five in that order appear on hover. |
| How should moons stay open as the pointer moves from a planet to a moon? | Treat the planet and its moons as one hover region. |
| How should “always show moons” behave when a planet is hidden in the Galaxy? | Show moons only for planets currently visible; keep the five-planet preview limit. |
| Where do in-app edits and imported data live? | Store a browser-local override in both run modes, allow export, and provide a reset to the bundled link data. |

## Later — Keyboard navigation

Scheduled as Milestone 19.

## Milestone 6 — Alabama theme refresh

- Use neutral charcoal and gray as the base, with crimson for selected accents and silver for quieter details.
- Let sun colors remain distinct while keeping the theme recognizable. Keep Auburn's current appearance.
- Inspect Galaxy, System, and editor screens in both run modes at normal and narrow desktop widths; verify text contrast and motion settings.

**Done when:** Alabama has clear contrast between the background, circles, and accents; the six sample suns remain distinguishable; Auburn still looks and behaves as before.

## Milestone 7 — Quick find

- Add a Galaxy search that matches sun, planet, and moon names without a network request.
- Show each result's parent path and let a pointer open the sun's System or a destination link.
- Keep results current after browser edits, imports, and resets. Explain when nothing matches.

**Done when:** A user can find and open any sun, planet, or moon from the Galaxy without tracing its circle hierarchy.

## Milestone 8 — Editor recovery

- Show whether the active link map comes from bundled project data or browser edits.
- Add Undo for the latest removal, including a removed sun's planets and moons; keep it available after closing the editor or reloading.
- Preserve import/export and reset behavior, with a clear data-source indicator after each operation.

**Done when:** The active source is clear, and the latest accidental removal can be restored without losing later edits.

## Milestone 9 — Eight-sun map and scale review

- Add a **Stocks & Investing** sun and a **Science** sun with useful planets and moons. Expand moon examples among existing planets.
- Keep every destination local to the bundled JSON and generated direct-file data; validate each URL and preserve existing IDs.
- Review the eight-sun Galaxy, long names, populated Systems, and moon clusters at normal and narrow desktop widths.

**Done when:** Eight suns fit the Galaxy, all sample destinations are reachable, long labels remain readable, and overflow handles larger sets without hiding links.

## Milestone 10 — Font size setting

- Add a Settings choice for Small, Standard, Large, and Extra large text, with Standard as the default.
- Save the choice in this browser and apply it to Galaxy, System, search, menu, and editor text.
- Keep circle labels, controls, and overflow readable at each size on normal and narrow desktop widths, in all themes.

**Done when:** The chosen size applies immediately and survives a reload in both run modes, while every destination remains readable and reachable.

## Milestone 11 — Labs and Windows Remote Desktop

- Add a ninth **Labs** sun with `lab1` through `lab5` planets. Give `lab1` five server moons, `lab1-server1` through `lab1-server5`, to demonstrate moon overflow.
- Allow a planet or moon to use a Windows Remote Desktop destination with a computer name or IP address and optional port. Keep website links compatible with existing maps.
- Generate a `.rdp` file for the selected target, including a credential prompt; show that opening the downloaded file on Windows starts the client. Do not store credentials in Orbit.
- Let the browser editor create, change, import, export, search, and persist Remote Desktop destinations. Validate host input before generating a file.
- Treat bundled lab hostnames as examples until the user replaces them with reachable targets.

**Done when:** Nine suns fit the Galaxy; all five labs and the five `lab1` servers are reachable; clicking a Remote Desktop destination downloads the correct host file in direct-file and local-server modes; edits survive reload and export.

## Milestone 12 — Open Windows Remote Desktop client

- Add a browser setting that switches Remote Desktop destinations between `.rdp` download and opening built-in `mstsc.exe`. Keep download as the default and preserve the choice across reloads.
- Provide a per-user Windows helper that registers an `orbit-rdp://` protocol handler. Validate the selected host and port, create a connection file without credentials, and open it in Remote Desktop Connection for review before connecting.
- Register the PowerShell executable that runs the installer, supporting Windows PowerShell 5.1 or PowerShell 7 when either is available.
- Apply the choice to planets, moons, overflow, and Quick find in both run modes. Show the required Orbit helper install command in Settings when native mode is selected; distinguish built-in `mstsc.exe` from the separate MSRDC app. Document the browser's external-app prompt and how to remove the helper.

**Done when:** Native mode produces the right protocol link for every Remote Desktop destination, the setting persists, and download mode still works. A Windows PC with the helper installed must be used for the final client-launch check.

## Milestone 13 — Share selected links

- Export one sun with its planets and moons, one planet with its moons, or one moon alone from its editor screen. Keep whole-Galaxy export available.
- Mark each item file with its type and version so the importer can reject the wrong file or invalid data. Include no unrelated suns, planets, or moons.
- Import a sun into the Galaxy, a planet into a chosen sun, or a moon into a chosen planet. Review the item and target before adding it; leave existing links intact. Resolve a duplicate imported sun ID without changing the existing sun's link.
- Keep full-Galaxy import as a separate replacement action. Explain the distinction in the editor and README.

**Done when:** Each item round-trips through export and import in file and server modes, descendants are preserved, invalid or mismatched files leave the map intact, and full-Galaxy import/export still works.

## Milestone 14 — Import a planet as a sun

- Accept an Orbit planet export from the Galaxy's sun list as a new sun.
- Name the new sun after the planet and put the original planet inside it, preserving its destination and moons. Give the new sun a default color that the editor can change.
- Review the conversion before saving, append it without changing existing suns, and generate a unique sun ID when the same planet is imported more than once.
- Reject invalid or mismatched files without changing the map; keep normal sun, planet, moon, and Galaxy imports working.

**Done when:** A shared planet becomes a navigable sun in both run modes, its destination and moons survive reload and export, and cancelled or invalid conversions leave the map intact.

## Milestone 15 — Theme names and right-side menu

- Show the existing Alabama theme as **Red** and the existing Auburn theme as **Blue**, preserving saved theme selections and colors.
- Open the cog menu as a full-height panel that slides in from the right edge. Keep Settings, Help, About, the close control, outside-click dismissal, and scrollable editor content.
- Keep the Animations switch and reduced-motion preference effective for the new panel animation.

**Done when:** The new labels appear, saved preferences still select the same palettes, and the menu enters from the right and remains usable at normal and narrow desktop widths in both run modes. Browser testing is deferred until the next requested test batch.

## Milestone 16 — Compact Galaxy home

- Remove the large Galaxy heading and hover instructions from the home page so suns begin closer to the top bar.
- Keep the sun, planet, and moon guidance in cog → Help; retain the System description in each expanded sun.
- Keep Quick find and the home grid usable at normal and narrow desktop widths.

**Done when:** The Galaxy shows the suns without the introductory block, Help provides the navigation instructions, and search and System navigation still work. Browser testing is deferred until the next requested test batch.

## Milestone 17 — Global settings and search

- Show the cog and Quick find in the top bar on the Galaxy and every System.
- Opening the cog from a System should show the same Settings, Help, About, and editor controls as on the Galaxy.
- Typing in Quick find from a System should return to the Galaxy and show results for the entered query. Keep the query when opening a System from search results; the Orbit logo still clears it.
- Keep the top bar usable at normal and narrow desktop widths.

**Done when:** Settings and Quick find are available from both views, a System search reaches Galaxy results, and the header remains readable. Browser testing is deferred until the next requested test batch.

## Milestone 18 — Import saved Remote Desktop profiles

- Let the editor read a local `.rdp` file into an existing or new planet or moon, including a lab server moon. Decode common UTF-8 and UTF-16 saved files and require a valid `full address` setting.
- Preserve connection settings with the link and update the profile's target if the host is edited. Exclude saved passwords, tokens, and signatures; keep imports local to the browser and show what was excluded.
- Use the saved profile for `.rdp` downloads and pass it to the Windows helper for native `mstsc.exe` launches. Validate profile data again in the helper and require the user to rerun the installer to update an older helper.
- Include profile settings in Orbit JSON export/import and document what to review before sharing.

**Done when:** A custom `.rdp` file can populate an existing lab moon, survive reload and JSON export/import, and open with its settings in download and native modes. Completed 2026-11-15: browser checks are automated (`tests/browser_matrix.py --milestone 18 --only-new`) and native launch was confirmed on Windows.

## Milestone 19 — Keyboard navigation

Keyboard access to everything the pointer can reach, in small steps. Touch interaction stays out of scope.

1. **Focus reveals moons.** Focusing a planet (Galaxy or System) shows its moons the way hover does, so every planet and moon is reachable with Tab and has a visible focus ring.
2. **Menu focus.** Opening the cog menu moves focus into it, Tab and Shift+Tab stay inside while it is open, and closing it returns focus to the cog.
3. **Escape layers.** Escape closes the menu first; otherwise it clears a non-empty Quick find; otherwise it returns from a System to the Galaxy.
4. **Quick find.** `/` focuses Quick find (ignored while typing in a field or when the menu is open). Down Arrow moves from the field into the results, Up and Down move between results, and Up from the first result returns to the field. Enter opens the focused result.
5. **Arrow keys in the map.** On the Galaxy, arrows move between suns by position. On a planet, Left and Right move between sibling planets and Down enters its moons. On a moon, Left and Right move between sibling moons and Up returns to its planet. Enter and Space keep their native behavior.
6. **Help and docs.** Describe the shortcuts in cog → Help and the README, then add Playwright checks in both run modes.

**Done when:** a user can search, open a System, reach any planet or moon, open a destination, open and close the menu, and return to the Galaxy using only the keyboard, with a visible focus indicator throughout, and the full browser matrix still passes in both run modes.

**Completed 2026-11-16:** all six steps are implemented in `keys.js`, `menu.js`, and `styles.css`, with checks K01–K08 in `tests/milestone_19.py`.

## Backlog — prioritized observations (2026-11-16)

Collected from the user's private notes (`request-observations.md`, not committed). Milestone 19 (keyboard navigation) is in progress and comes first. Effort is a rough guide: **S** under a day of focused work, **M** a few steps, **L** a milestone of its own. Numbers in brackets are the note numbers.

| Priority | Item | Effort | Notes |
| --- | --- | --- | --- |
| 1 | **Back up registry settings before the PowerShell scripts change them** [10] | S | Safety first: `Install-OrbitRdp.ps1` writes under `HKCU:\Software\Classes\orbit-rdp` and the uninstaller removes it. Export the key to a `.reg` file in the Orbit data folder before any change, and say where it is. |
| 2 | **Editor polish batch**: hide *Import .rdp file* for website destinations [1]; show *Edit links* at the top of Settings [14]; show the position number (for example "3 of 8") by Move up and Move down [8] | S | The import button is currently always shown because only the URL, host, and note are toggled. |
| 3 | **Sizing pass**: shorten or shrink long sun names such as "Confluence" [2]; make moons bigger [7]; fix small text at 1920×1080 [11]; size sun, planet, and moon text to the longest label [16] | M | One design change: scale from viewport and from the longest visible label, then re-check themes, font sizes, and the 900-pixel layout. |
| 4 | **Copy a moon to another planet** [4] | M | Copy is a duplicate, so later edits do not follow it (see question A). |
| 5 | **Links in sun descriptions** [6, 13] | M | Needs a safe format (for example `[text](https://…)` limited to http and https) rendered by building DOM nodes, never raw HTML, plus an editor field and export support. A sun linking to a page is the same feature. |
| 6 | **Launch with `mstsc.exe` arguments** such as `/v:host` instead of a temporary file [12] | M | The helper could pass `/v:` plus allowed options, with the same validation as today. See question C. |
| 7 | **Dedicated edit page** to reorganize everything in one view [3] | L | Replaces the nested sun, planet, and moon menus with one screen: drag or list reordering, copy, move. Best done after items 2 and 4. |
| 8 | **Read `.rdp` files dropped in a folder** [9] | L | A browser page cannot watch a folder. It would need the optional local server or the Windows helper to read it. See question D. |
| 9 | **Dynamic movement on the main page** [15] | L | Positions are fixed and CSS-driven today. Real motion needs an animation layer that also respects the animation setting, reduced motion, and the hover and focus reveals. Prototype before committing. |

### Questions to settle

- **A. Copies or shared moons [4, 5]?** Today each moon is its own entry, so editing one never changes the others. Proposed: keep copies independent. Shared moons would need linked entries and a clear way to unlink.
- **B. Descriptions [6, 13]:** should a link replace the whole description line, or sit inside it as text (the proposal above)?
- **C. `mstsc.exe` arguments [12]:** is the goal to avoid downloading a file, or to pass options a file cannot hold? Imported profile settings would still need the file route.
- **D. Folder drop [9]:** is it acceptable to run `serve.py` for this, or should it stay a pure browser page where you pick or drop files in the editor (multiple files at once)?
- **E. Sizing [16]:** equal sizing could make short labels look oversized. Should it apply per sun or across the whole Galaxy?

## Delivery approach

Implement and review one milestone at a time. Update `README.md` and sample data when behavior or the data format changes. Verify direct-file and local-server modes, pointer navigation, desktop window sizes, and reduced-motion behavior for each affected milestone. Commit each completed milestone separately after its checks pass, with a message naming the milestone. Touch interaction is outside this roadmap.
