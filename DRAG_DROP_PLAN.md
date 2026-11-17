# Drag-and-drop organization plan

Status: planning only. No item 9 implementation has started.

## Goal and decisions

Let the user organize the link map directly on the Galaxy and System views. This is drag-and-drop editing, not continuous orbit animation. An explicit **Edit mode** toggle is required before dragging. The existing editor tree remains available for destinations hidden by Galaxy previews or System overflow, and its buttons remain the keyboard alternative.

The work is split into two phases. Phase 1 moves items between parents. Phase 2 adds reordering. Each phase gets its own review and commit.

## Interaction rules shared by both phases

- Put the Edit mode toggle in the top bar on the Galaxy and System views. Edit mode starts Off after a reload and stays On while moving between those views until the user turns it Off.
- In Edit mode, dragging is available to pointer users. A click on a sun still opens its System. Clicking a planet or moon does not launch its destination while editing; leaving Edit mode restores normal link behavior.
- Start a drag only after a short pointer movement threshold. Show a dragged-item preview and highlight valid drop targets. Keep revealed planets and moons visible throughout a drag, even when the pointer leaves the original hover region.
- Dropping on an invalid target or outside a target leaves the map unchanged. Escape cancels an active drag; a second Escape exits Edit mode before the existing search/System Escape behavior.
- A successful drop saves through the existing browser-local map path, updates the Galaxy and System immediately, and offers a one-step Undo for that drag. Preserve the existing removal-undo behavior.
- The Animations setting and operating-system reduced-motion preference govern drag previews and completion effects. Edit mode never starts ambient motion.
- Dragging **moves** an entry. The separate Copy moon action remains the way to duplicate one.

## Phase 1 — move between parents

1. Drag a visible planet onto a sun to move the planet, including all its moons, to that sun. On the Galaxy, the visible suns are direct targets. In a System, show a compact list of other suns as drop targets while dragging a planet.
2. Drag a visible moon onto a planet to move it to that planet. This works on the Galaxy and within a System. In the Galaxy, hovering another sun during a drag reveals its planets as possible targets.
3. A parent drop appends the moved item to the end of its new parent's list. Dropping it on its current parent is a no-op. The editor tree handles destinations that cannot be shown as map drop targets.
4. Include visible overflow planets and moons in a System as drag sources and eligible targets where their type allows it. Keep the existing first-five Galaxy preview, first-eight System orbit, and moon overflow limits.

**Phase 1 acceptance:** move a planet across suns and a moon across planets in both run modes; verify children and Remote Desktop profiles stay intact, the saved order and exports update, Undo restores the previous parent and position, invalid drops do nothing, and normal links work again after Edit mode is turned Off.

## Phase 2 — reorder

1. Drag a sun beside another sun to change Galaxy order.
2. Drag a planet beside another planet or a moon beside another moon. Show a clear before/after insertion marker. A same-parent drop reorders; a different-parent sibling drop moves and inserts in one action.
3. Keep ordering consistent with the editor tree. Reordering planets changes which first five appear in the Galaxy preview. Reordering moons changes which first four appear around their planet.

**Phase 2 acceptance:** reorder each level in both run modes; confirm the new order survives reload and JSON export, preview and overflow boundaries update, keyboard users can make the same changes with editor controls, and cancellation or an invalid drop leaves the saved map unchanged.

## Implementation boundaries and checks

- Keep this in the existing `index.html` page so direct `file://` use and local-server use share the behavior. Reuse map validation and `saveMap`; do not add a backend or account requirement.
- Keep drop targets and preview indicators separate from link activation. A pointer drag must not open a website or start a Remote Desktop download.
- Treat hover and focus reveals, overflow lists, narrow desktop widths, all three themes, Animations Off, and reduced motion as affected behavior.
- Use focused browser checks for each phase in file and server modes. Do not replay unrelated historical milestones as a routine gate.

The implementation is paused until this plan is reviewed.
