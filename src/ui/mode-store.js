// The one owner of the interaction modes from rewrite phase 4b on
// (REWRITE_PLAN.md, "Who owns mode state during the migration"). It holds
// the current state of ui/modes.js's machine: code sends events, asks
// queries, and the page shows the result from one subscriber (app.js until
// the screens move).
import { escapeTarget, inEditMode, initialModes, keyAllowed, linkOpensEditor, menuOpen, routineOffersAllowed, transition } from './modes.js';

/**
 * @typedef {import('./modes.js').Modes} Modes
 * @typedef {import('./modes.js').ModeEvent} ModeEvent
 * @typedef {(next: Modes, previous: Modes, event: ModeEvent) => void} ModeListener
 */

/** @param {{view?: import('./modes.js').View}} [start] */
export function createModeStore(start) {
  let state = initialModes(start);
  /** @type {ModeListener[]} */
  const listeners = [];
  /** Changes waiting to be reported, oldest first. @type {[Modes, Modes, ModeEvent][]} */
  const queue = [];
  let reporting = false;

  return {
    /** The current state (frozen). */
    state: () => state,

    /**
     * Apply an event. Listeners run only when something changed. An event
     * sent from inside a listener is applied at once, and reported after the
     * current change has reached every listener, so each listener hears the
     * changes in the order they happened.
     * @param {ModeEvent} event
     * @returns {boolean} Whether the state changed.
     */
    send(event) {
      const previous = state;
      const next = transition(state, event);
      if (next === previous) return false;
      state = next;
      queue.push([next, previous, event]);
      if (!reporting) {
        reporting = true;
        try {
          while (queue.length) {
            const change = /** @type {[Modes, Modes, ModeEvent]} */ (queue.shift());
            for (const listener of [...listeners]) listener(...change);
          }
        } finally {
          reporting = false;
          queue.length = 0;
        }
      }
      return true;
    },

    /**
     * @param {ModeListener} listener
     * @returns {() => void} Unsubscribe.
     */
    subscribe(listener) {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    },

    // Queries; each reads the current state.
    inEditMode: () => inEditMode(state),
    menuOpen: () => menuOpen(state),
    /** Pressing or dragging an item. */
    holding: () => state.mode === 'pressed' || state.mode === 'dragging',
    dragging: () => state.mode === 'dragging',
    /** @param {import('./modes.js').Overlay} overlay */
    overlayIs: overlay => state.overlay === overlay,
    escapeTarget: () => escapeTarget(state),
    /** @param {'commandK'|'slash'|'escape'|'other'} key */
    keyAllowed: key => keyAllowed(state, key),
    /** @param {'app'|'palette'|'notice'} where */
    linkOpensEditor: where => linkOpensEditor(state, where),
    routineOffersAllowed: () => routineOffersAllowed(state),
  };
}
