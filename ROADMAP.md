# Orbit roadmap

Status: milestones 1–11 complete (2026-11-15). Milestone 12 is implemented; its Windows client launch check awaits a Windows PC.

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

Add keyboard access to the sun → planet → moon interaction and the settings panels, including visible focus, focus management, and Escape behavior. Existing browser-native keyboard behavior can remain, but new keyboard interactions are outside the current milestones.

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
- Apply the choice to planets, moons, overflow, and Quick find in both run modes. Show the required Orbit helper install command in Settings when native mode is selected; distinguish built-in `mstsc.exe` from the separate MSRDC app. Document the browser's external-app prompt and how to remove the helper.

**Done when:** Native mode produces the right protocol link for every Remote Desktop destination, the setting persists, and download mode still works. A Windows PC with the helper installed must be used for the final client-launch check.

## Delivery approach

Implement and review one milestone at a time. Update `README.md` and sample data when behavior or the data format changes. Verify direct-file and local-server modes, pointer navigation, desktop window sizes, and reduced-motion behavior for each affected milestone. Commit each completed milestone separately after its checks pass, with a message naming the milestone. Touch interaction is outside this roadmap.
