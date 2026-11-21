// Orbit's interaction modes as one pure state machine (REWRITE_PLAN.md,
// "Interaction modes"). Four parts run side by side: the overlay (at most
// one), the mode (browsing, Edit mode, pressing or dragging an item), the
// view, and Quick find.
//
// Built and tested in phase 3, but not wired to the page: until the phase 4b
// cut-over, the old flags (2.2.1) still decide everything.

/**
 * @typedef {'none'|'palette'|'placeholder'|'menu'|'menuPanel'|'menuEditor'} Overlay
 * @typedef {'browsing'|'editIdle'|'pressed'|'dragging'} Mode
 * @typedef {'galaxy'|'system'|'error'} View
 * @typedef {'empty'|'filtering'} Find
 * @typedef {{overlay: Overlay, mode: Mode, view: View, find: Find}} Modes
 */

/**
 * The events the page sends. Names follow the diagram's arrow labels.
 * @typedef {'openPalette'|'openPlaceholder'|'openMenu'|'openEditor'|'choosePanel'|'backToPanels'|'closeOverlay'|'runEntry'
 *   |'editOn'|'editOff'|'press'|'passThreshold'|'release'|'drop'|'cancelDrag'|'render'
 *   |'openSystem'|'toGalaxy'|'loadFailed'|'pageChange'|'switchWorkspace'|'type'|'clearFind'|'escape'} ModeEvent
 */

/**
 * The state at start-up.
 * @param {{view?: View}} [start]
 * @returns {Modes}
 */
export function initialModes({ view = 'galaxy' } = {}) {
  return Object.freeze({ overlay: 'none', mode: 'browsing', view, find: 'empty' });
}

/** @param {Modes} state */
export const inEditMode = state => state.mode !== 'browsing';
/** @param {Modes} state */
export const menuOpen = state => state.overlay === 'menu' || state.overlay === 'menuPanel' || state.overlay === 'menuEditor';
/** @param {Modes} state */
const holding = state => state.mode === 'pressed' || state.mode === 'dragging';

/**
 * Which part handles an Escape press, in 2.2.1's order (keys.js:33-55,
 * palette.js:150, variables.js:66), or null when Escape does nothing.
 * @param {Modes} state
 * @returns {'overlay'|'drag'|'edit'|'find'|'view'|null}
 */
export function escapeTarget(state) {
  if (state.overlay !== 'none') return 'overlay';
  if (holding(state)) return 'drag';
  if (state.mode === 'editIdle') return 'edit';
  if (state.find === 'filtering') return 'find';
  if (state.view === 'system') return 'view';
  return null;
}

/**
 * Whether a global shortcut is acted on: 'commandK' (Ctrl/Cmd+K), 'slash'
 * (focus Quick find), or 'other'. While the placeholder form is open, every
 * other key is left to it (keys.js:161); the menu refuses Ctrl/Cmd+K and /
 * (palette.js:177, keys.js:65); the error view refuses Ctrl/Cmd+K.
 * @param {Modes} state
 * @param {'commandK'|'slash'|'escape'|'other'} key
 */
export function keyAllowed(state, key) {
  if (key === 'escape') return true;
  if (state.overlay === 'placeholder') return false;
  if (key === 'commandK') return !menuOpen(state) && state.view !== 'error';
  if (key === 'slash') return !menuOpen(state);
  return true;
}

/**
 * Whether clicking a link in the given place opens the editor instead of the
 * link: only in Edit mode, and only for links inside #app (Galaxy, System,
 * list) and palette matches; notice links still open (drag.js:543-550).
 * @param {Modes} state
 * @param {'app'|'palette'|'notice'} where
 */
export function linkOpensEditor(state, where) {
  return inEditMode(state) && where !== 'notice';
}

/**
 * Whether a due routine may be offered now. Only Edit mode matters
 * (routines.js:79); an open overlay doesn't.
 * @param {Modes} state
 */
export const routineOffersAllowed = state => !inEditMode(state);

/**
 * The next state. An event that doesn't apply leaves the state as it is (the
 * same object), so callers can tell nothing happened.
 * @param {Modes} state
 * @param {ModeEvent} event
 * @returns {Modes}
 */
export function transition(state, event) {
  /** @param {Partial<Modes>} changes */
  const to = changes => {
    const next = { ...state, ...changes };
    return next.overlay === state.overlay && next.mode === state.mode && next.view === state.view && next.find === state.find
      ? state : Object.freeze(next);
  };
  // Opening an overlay never keeps a press or drag (menu.js:21, palette.js:62).
  const dropHold = holding(state) ? { mode: /** @type {Mode} */ ('editIdle') } : {};
  switch (event) {
    case 'openPalette':
      return keyAllowed(state, 'commandK') && state.overlay === 'none' ? to({ overlay: 'palette', ...dropHold }) : state;
    case 'openPlaceholder':
      return state.overlay === 'none' || state.overlay === 'palette' ? to({ overlay: 'placeholder', ...dropHold }) : state;
    case 'openMenu':
      return state.overlay === 'none' ? to({ overlay: 'menu', ...dropHold }) : state;
    case 'openEditor':
      return state.overlay === 'placeholder' ? state : to({ overlay: 'menuEditor', ...dropHold });
    case 'choosePanel':
      return state.overlay === 'menu' || state.overlay === 'menuPanel' || state.overlay === 'menuEditor' || state.overlay === 'palette'
        ? to({ overlay: 'menuPanel', ...dropHold }) : state;
    case 'backToPanels':
      return state.overlay === 'menuEditor' ? to({ overlay: 'menuPanel' }) : state;
    case 'closeOverlay':
      return to({ overlay: 'none' });
    case 'runEntry':
      return state.overlay === 'palette' ? to({ overlay: 'none' }) : state;
    case 'editOn':
      return state.mode === 'browsing' ? to({ mode: 'editIdle' }) : state;
    case 'editOff':
      return to({ mode: 'browsing' });
    case 'press':
      return state.mode === 'editIdle' && state.overlay === 'none' && state.view !== 'error' ? to({ mode: 'pressed' }) : state;
    case 'passThreshold':
      return state.mode === 'pressed' ? to({ mode: 'dragging' }) : state;
    case 'release':
    case 'drop':
    case 'cancelDrag':
    case 'render':
    case 'switchWorkspace':
      return holding(state) ? to({ mode: 'editIdle' }) : state;
    case 'pageChange':
      // hashchange cancels a drag and closes the menu, not the palette or form (app.js:134).
      return to({ ...dropHold, ...(menuOpen(state) ? { overlay: 'none' } : {}) });
    case 'openSystem':
      return state.view === 'galaxy' ? to({ view: 'system' }) : state;
    case 'toGalaxy':
      return state.view === 'system' ? to({ view: 'galaxy' }) : state;
    case 'loadFailed':
      return to({ view: 'error', overlay: 'none', mode: 'browsing' });
    case 'type':
      // Typing in Quick find inside a System returns to the Galaxy (MR09).
      return to({ find: 'filtering', ...(state.view === 'system' ? { view: 'galaxy' } : {}) });
    case 'clearFind':
      return to({ find: 'empty' });
    case 'escape': {
      const target = escapeTarget(state);
      if (target === 'overlay') return to({ overlay: 'none' });
      if (target === 'drag') return to({ mode: 'editIdle' });
      if (target === 'edit') return to({ mode: 'browsing' });
      if (target === 'find') return to({ find: 'empty' });
      if (target === 'view') return to({ view: 'galaxy' });
      return state;
    }
    default:
      return state;
  }
}
