# Drag-and-drop organization plan

**Status:** Planning only. Roadmap backlog priority 9 has not been implemented. This is the execution guide for the next agent; read it completely before editing code.

**Branch:** `feature/drag-drop-organization`, created from `main` at `46112a7`. Do all planning and implementation commits on this branch. Keep `main` untouched; do not merge or push to `main` without a separate user request. Check `git status` before staging: `tests/rdptest01.rdp` is a private, untracked file. Never stage, log, copy to the VM, or commit it.

**Decisions already made:** This feature organizes the map by dragging; it does not animate orbits. Dragging must work in Galaxy and System views, with the editor tree as fallback. An explicit Edit mode toggle gates dragging. Phase 1 moves planets and moons between parents. Phase 2 adds sibling reordering and insertion while moving between parents. Review and commit each phase separately. Touch gestures are outside scope.

## Outcome and boundaries

A planet moves with all of its moons to another sun. A moon moves to another planet. Later, suns, planets, and moons can be reordered. A move preserves name, URL or RDP host, and imported RDP profile. The existing Copy moon command remains an independent copy. Array order controls Galaxy previews, System orbits, overflow, search, editor tree, and JSON export. Dragging changes array order and parent membership, never the orbital coordinates.

The app must continue to work directly from `file://` and through `serve.py`. Browser edits remain in `localStorage`; no backend, account, new map schema, or edits to `links.json`/`links-data.js` are needed. Invalid drops and cancellations do not mutate the map. Do not add ambient animation, free placement, or touch handling.

## Existing code: read before changing it

| File | Relevant behavior | Required care |
| --- | --- | --- |
| `index.html` | Shared top bar; classic deferred scripts load in dependency order. | Put the Edit mode toggle in the top bar. Load a new drag controller before `app.js` if one is added. |
| `render.js` | `renderHome` builds sun cards; first 5 planets appear on Galaxy hover. `renderDetail` places first 8 planets on the orbit, extra planets below, and moons after the first 4 in overflow. `linkNode` makes anchors or RDP download buttons. | Annotate every visible source and target, including overflow and duplicate renderings. Suppress destination activation in Edit mode, including Quick find. |
| `styles.css` | Hover/focus reveals Galaxy planets and moons; Galaxy moon fields are forcibly hidden on orbit leave. System overflow moons have another hover rule. Motion preferences already exist. | Active drags need their own reveal state. Check z-index, hit testing, clipping, focus, motion, and all themes. |
| `storage.js`, `app.js` | `validateMap` normalizes; only suns have stable IDs. `saveMap` validates, writes `orbit:map:v1`, updates `groups`, calls `render`; `render` replaces DOM and scrolls to top. | Capture source paths, save once at drop, and restore sensible route, scroll, and focus. Do not identify planets/moons by name. |
| `editor.js`, `editor-page.js` | `copyGroups` clones; cross-parent editor moves splice then append; Move up/down controls exist. Complete tree includes hidden items. | Reuse or extract one pure move operation. Keep tree order and keyboard controls in sync with map drag. |
| `keys.js`, `menu.js` | Escape closes menu, clears search, then leaves System. Arrow navigation and menu focus trap exist. Removal Undo uses `orbit:undo-removal:v1`. | Add drag cancellation and Edit mode exit to Escape layers without breaking old behavior. Keep drag Undo separate. |

Planet and moon names and destinations may repeat. At pointer-down, capture a source path (sun ID/index, planet index, moon index), the source object, an in-memory map revision, and the current map-storage value. Resolve and recheck the path and revision before committing; compare storage again to catch an edit in another tab. If an intervening edit/import/reset changes the map during the gesture, cancel it and show a clear message. Never move a different item because an index shifted or overwrite another tab's newer map. A render is not allowed mid-gesture just to reveal a target, because it would remove the captured DOM node. No persistent IDs are required for planets or moons.

## Shared interaction contract

### Edit mode and activation

1. Add a visible **Edit mode** toggle with `aria-pressed` in the shared top bar. It starts Off after each reload, remains On while moving between Galaxy and Systems in the same page session, and turns Off only by user action or reload. Turning Off cancels a drag. Show concise instructions and a path to Edit links; fit them at 900 pixels and Extra large text.
2. With Edit mode Off, all existing clicks, links, RDP downloads, `orbit-rdp://` launches, keyboard shortcuts, hover reveals, and navigation behave as before. With it On, a click on a sun still opens its System. Planets and moons must not launch destinations on click, pointer-up, Enter, or Space, including circles, overflow, and Quick find results. Search remains usable; in Edit mode, activating a search result opens that exact item in Edit links, using its array path rather than its name. A result must not look like a destination link and unexpectedly launch. The editor tree remains the fallback when the result's item is hidden from the map.
3. The settings menu and editor can open while Edit mode is On. Opening them cancels an active drag; closing them preserves Edit mode. Escape priority: if the menu is open, close it; otherwise cancel an active drag; otherwise exit Edit mode; otherwise use existing search/System handling. Keep Tab, arrow navigation, and menu focus trap intact. A System route change during a drag cancels the gesture before the route renders.
4. Start a drag only for the primary mouse button or pen after about 6 CSS pixels of movement. A click below that threshold stays a click. Once dragging starts, prevent native link drag and text selection. Suppress the subsequent synthetic click on completion or cancellation so a destination or sun cannot open accidentally.

### Pointer controller and feedback

1. Use Pointer Events with one state machine: idle, pressed, dragging, completed/cancelled. Prefer pointer capture to receive release outside the source. Cancel on Escape, pointercancel, lost capture, window blur, route change, menu opening, or Edit mode Off.
2. Use `document.elementFromPoint` at the current pointer location to resolve drop targets. The visual drag preview must have `pointer-events: none`; only visible, unobscured targets are eligible. Recompute hit testing after scroll/resize. Allow normal wheel/page scroll during dragging; do not require auto-scroll in Phase 1 because the editor tree covers distant entries.
3. Show a named preview and clear valid-target cues; include text/shape as well as color. Announce target changes, successful move, cancellation, and Undo through a polite live region. Invalid targets get no success cue. All three themes and all four font sizes need readable indicators.
4. Pin revealed Galaxy planets and moons open for the duration of a drag independently of hover/focus CSS. When a moon crosses another Galaxy sun, a brief deliberate hover reveals that sun's first five planets as targets. Do not hide the source or replace its DOM while this happens. Clear reveal classes and overlays on every exit path. With Animations Off or OS reduced motion, feedback appears immediately; no orbit movement is introduced.

### Save and Undo

1. A valid drop applies one array operation to a fresh copy of `groups`, calls `saveMap({ groups: next })` exactly once, then reports success. No pointer move writes storage. Preserve descendants and `rdpProfile` through validation. The copy action is never invoked by dragging.
2. An invalid type, self-drop, current-parent drop in Phase 1, outside drop, Escape, or failed validation/storage write leaves the stored and in-memory map unchanged. Surface a readable save error and leave Edit mode usable. Do not show success before `saveMap` returns.
3. Keep one **Undo last drag** record in memory: prior normalized map plus revision/storage token. It expires on reload, reset, import, or any later map edit; the next drag replaces it. All mutation paths (`saveMap`, editor changes, reset, import, removal Undo) must invalidate it through a common hook. Undo itself uses the validation/save path. Do not overwrite or clear persistent removal Undo (`orbit:undo-removal:v1`). If another tab edits the map, disable drag Undo instead of restoring an obsolete full map.
4. `saveMap` rerenders and `render` scrolls to top. Preserve route, useful scroll position, and focus after a drop and Undo. Focus a moved item if it remains visible; if it moved out of the current System, focus the result notice or stable target. The toggle stays reachable. Avoid changing ordinary navigation behavior globally.

## Phase 1 — move between parents

| Drag source | Galaxy parent target | System parent target | Result |
| --- | --- | --- | --- |
| Visible planet | Any other sun hub | A compact destination tray listing other suns | Remove from old sun and append to target sun, carrying all moons. |
| Visible moon | A different visible planet, including one under another sun revealed during drag | A different planet in the current System or under another sun in the destination tray | Remove from old planet and append to target planet. |
| System overflow planet/moon | Not a Galaxy source | Same targets as its circle counterpart | Move the exact stored item, including RDP profile. |

The System tray is essential because only one sun is rendered in a System. When dragging a planet, the tray exposes other suns. When dragging a moon, it exposes other suns and their planets; the planet row is the actual drop target. Include all planets in this tray, even ones hidden by Galaxy preview. It appears only during a drag. The editor tree remains the fallback for sources and destinations that are difficult to reach visually.

Galaxy direct drag covers only the first five planets per sun and the first four visible moons per planet. For hidden source items, use System overflow or Edit links. In a System, first-eight orbit planets, More planets, moon circles, More moons, and moons shown under overflow planets must all be drag sources. A duplicate rendering of the same moon must carry the same source path. Dropping on its present parent is a no-op with “Already here” feedback.

### Phase 1 execution steps

1. Create or extract a pure move operation: resolve/recheck source path, classify valid parent, clone groups, splice source once, append once. Verify duplicate names, same-parent no-op, and imported RDP profile preservation.
2. Add Edit mode state, top bar toggle, instructions, Escape/cancellation, and destination activation guard. Check ordinary browsing Off and click behavior On before pointer movement is added.
3. Add render metadata for map and overflow entries, drag controller, pinned reveals, System tray, and feedback. Keep the existing `.rdp` file drop zone independent.
4. Add save, focus/scroll restoration, drag Undo, error handling, and cleanup for route/menu changes. Update Help and README.
5. Run focused checks, inspect diff and `git diff --check`, then commit Phase 1 alone. Do not start Phase 2 before reviewing Phase 1.

### Phase 1 acceptance

In both file and server modes, move a planet across suns with all moons; move a moon within a System and to another sun via Galaxy and System tray; move overflow planet/moon sources; use duplicate names; preserve a synthetic imported RDP profile; verify reload and JSON export; test invalid/self/current-parent drops, Escape/pointer cancellation, storage failure, and one-step Undo. Verify a drag or edit-mode click never opens a web link, downloads an RDP file, or invokes the native RDP protocol. Turning Edit mode Off restores normal links. Check Tab, arrows, menu focus, and Escape around the toggle. Inspect 900-pixel and normal desktop widths, all themes, Extra large text, Animations Off, and reduced motion. Use a synthetic RDP profile, never the private fixture.

## Phase 2 — reorder and insert beside siblings

Extend the pure operation to accept a sibling plus `before` or `after`. Remove the source, adjust target index if both items share an array, insert once, and reject self-drop. A parent drop still appends. A sibling drop can either reorder within one parent or move to a new parent at a chosen position.

| Source | Sibling target | Result |
| --- | --- | --- |
| Sun | Another Galaxy sun | Reorder cards and System index without changing sun ID or descendants. |
| Planet | Another planet in Galaxy preview, System orbit/overflow, or tray | Reorder or move and insert; first-five/first-eight boundaries update. |
| Moon | Another moon circle, overflow moon, or moon revealed under a tray planet | Reorder or move and insert; first-four/overflow boundaries update. |

Radial positions do not reveal array order. Do not infer before/after only from left/right halves of a circle. Hovering a sibling shows two labeled placement choices (“Before …”, “After …”) and a clear insertion marker with generous targets. In overflow lists, place markers above/below the row; in the Galaxy grid, use DOM order across row wraps. Announce the proposed insertion. Keep parent-append drops available. For cross-sun moon insertion, expand a planet in the System destination tray to reveal its moon siblings; an empty planet remains an append target. Editor Move up/down remains the keyboard reorder route; editor cross-parent controls must also let keyboard users reach the same parent and insertion position before Phase 2 is complete.

### Phase 2 execution and acceptance

1. Verify the pure insertion operation for first-to-last, last-to-first, adjacent, cross-parent, self-drop, and same-array index adjustment.
2. Add sun sources, sibling targets, labeled placement controls, and insertion markers to the controller. Preserve Phase 1 parent drops and invalid-drop cleanup.
3. Extend editor controls where needed for keyboard parity. Update Help, README, and focused checks; review and commit Phase 2 separately.
4. In both run modes, reorder every level; insert before/after across parents; verify Galaxy first five, System first eight, moon first four, overflow, search order, editor tree, reload, and JSON export. Check cancellation and save failure leave order untouched. Test affected keyboard, visual, and motion states, not the full historical matrix.

## Windows 11 VM test resource

The user provided a disposable Windows 11 VM with full authorization for project testing. **Hostname:** `win11-lab-test`; **IP:** `10.31.31.238`; **user:** `sysadmin`; **baseline snapshot:** `s04`. The user confirmed the VM is currently running from `s04`. Do not record the supplied password in files, command history, logs, test fixtures, or commits. Key-only SSH from this development host has already been configured and verified using `/home/sysadmin/.ssh/id_ed25519`. Use `ssh -F /dev/null` because this host's default SSH config contains a permission error. The verified host key is currently in `/tmp/orbit-win11-known_hosts`; if the temporary file is lost, verify the fingerprint before accepting a replacement.

Connection command:

```sh
ssh -F /dev/null -i /home/sysadmin/.ssh/id_ed25519 -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile=/tmp/orbit-win11-known_hosts \
  sysadmin@10.31.31.238 whoami
```

Microsoft Edge is installed at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. Chrome was not found in its usual Program Files path. Windows PowerShell 5.1 is present. A real Python/Node runtime has not been verified; do not assume the Linux browser harness runs directly in the guest. Snapshot restore requires hypervisor access, not guest SSH. If experiments change the guest browser profile or Orbit data, restore `s04` before a repeatable final check or use a fresh isolated Edge profile.

Use Edge on the VM to check Windows pointer capture, hover reveals, cancellation, focus, reduced motion, 900-pixel and normal desktop viewports, and file-mode storage persistence. Copy only tracked project files or a clean archive to a disposable guest folder. Explicitly exclude `.git`, the private `tests/rdptest01.rdp`, local browser data, and credentials. Open the copied `index.html` by `file://`. Linux Chromium covers both file and server modes. If a Windows server-mode check is useful, first verify a guest runtime or tunnel the Linux server; a new runtime is not a feature prerequisite. An Edge headless CDP session forwarded through SSH may automate pointer checks, but verify that it starts and is reachable before relying on it. A headless screenshot alone is not an interaction check; use an interactive Edge session if CDP is unavailable.

The VM can also run pending Windows helper checks B01, B02, and B07 in `TEST_MATRIX.md`, but those are independent of this feature. Drag testing only needs to confirm an RDP item's stored host/profile survive a move; no real RDP connection is needed. Record helper results separately so they do not block a drag phase.

### Repeatable VM workflow for an implementation phase

1. After committing the phase on the feature branch, make a clean archive with `git archive --format=zip HEAD -o /tmp/orbit-drag-drop.zip`. An archive of `HEAD` includes only committed files and automatically excludes the private untracked RDP fixture. Copy that archive to `sysadmin@10.31.31.238` with `scp` using the same SSH config, identity, strict host-key, and known-host options above. Expand it in a disposable guest directory using PowerShell. Do not copy the working tree wholesale.
2. Use a fresh Edge user-data directory for each phase so previous `localStorage` does not affect results. Open the guest `index.html` as a file URL and run the exact Phase 1 or Phase 2 pointer cases. Record Edge version, viewport, test case, and result. If the browser is started through SSH in headless mode, first prove pointer events work through an SSH-forwarded loopback CDP port with a simple drag; otherwise use the guest's interactive Edge session. Do not expose CDP on a public VM interface.
3. Compare the saved map before/after a move, reload the file URL, and export JSON. Inspect that a moved RDP item still has its synthetic profile. Do not connect to a real host. Take screenshots only for the affected layout states. Clean the guest test directory and browser profile after recording results, or restore `s04` if a clean baseline is required for a later run.

### Focused test harness to create during implementation

Add `tests/drag_drop.py` as a focused Playwright runner with a `--phase 1|2` argument. Reuse `tests/helpers.py` fixtures, disposable storage, and the same two URLs used by `tests/browser_matrix.py`: the repository `index.html` file URI and a temporary `ThreadingHTTPServer` on `127.0.0.1`. Add any new classic app script to `tests/helpers.py` `APP_SCRIPTS` so fixtures and syntax checks include it. Keep a small synthetic map with duplicate names, an overflow planet, an overflow moon, and an RDP item with a harmless synthetic profile. Generate expected maps independently of the production move helper. Drive real pointer-down/move/up gestures in Chromium and assert stored JSON, visible order, no popup/download, and Undo. The intended commands are:

```sh
/home/sysadmin/.venv/bin/python tests/drag_drop.py --phase 1
/home/sysadmin/.venv/bin/python tests/drag_drop.py --phase 2
```

The runner is a deliverable, so those commands will exist only after the corresponding phase is implemented. Keep Phase 1 checks runnable after Phase 2 is added. Add concise rows to `TEST_MATRIX.md` for those checks and the separate Windows Edge smoke results. A single targeted run per phase is the normal gate; repeat only a concrete failure or flake. Do not route these checks through `--milestone 19`, which replays unrelated historical behavior.

## Test and delivery rules

- Add focused pure-operation tests and meaningful browser checks for changed behavior and its direct dependencies. Use disposable browser storage or export a backup before test edits. Do not write tests that merely mirror code.
- Run changed checks once per coherent batch. Repeat only to investigate failure or flakiness. The full browser matrix is reserved for an app-wide structural change, release/deployment, or explicit user request, per `TEST_MATRIX.md` and `ROADMAP.md`.
- Record check IDs, commands, outcomes, and limitations in `TEST_MATRIX.md`. Update `HANDOFF.md` after each implementation phase. Keep the private fixture and VM password out of all outputs.
- Before each commit, inspect `git diff --check`, `git status`, and focused results. Stage only intended paths. Commit Phase 1 and Phase 2 separately on `feature/drag-drop-organization`; push that branch for review when ready. Never merge it into `main` automatically.

**Done when:** Galaxy and System drag moves, overflow paths, editor fallback, Phase 2 ordering, keyboard parity, Undo, persistence/export, destination suppression, and focused Windows Edge checks pass, or any environment limitation is recorded precisely. The user reviews the feature branch before merge. Until then this remains a plan, and `main` app behavior is unchanged.
