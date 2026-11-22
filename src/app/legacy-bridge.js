// While the rewrite moves code from the old classic scripts into src/, the old
// scripts reach the new code through window.OrbitNext (REWRITE_PLAN.md,
// "Coexistence"). orbit.js loads before them, so OrbitNext exists by the time
// any old script runs. Removed in phase 8.

/**
 * @typedef {object} OrbitNextApi
 * @property {string} version The app version, from src/app/version.js.
 * @property {Readonly<Record<string, any>>} core Every export of src/core/, for the
 *   old scripts' forwarding functions (phase 2 on).
 * @property {ReturnType<typeof import('../state/store.js').createStore>} store The one store (phase 3 on).
 * @property {ReturnType<typeof import('../ui/mode-store.js').createModeStore>} modes The one owner of the
 *   interaction modes (phase 4b on).
 * @property {Readonly<Record<string, any>>} state The state modules (storage, workspaces, prefs, history, backup).
 * @property {Readonly<Record<string, any>>} services The service modules (sources, opener, rdpLaunch, linkCheck,
 *   fileIo, schedule), phase 4 on.
 */

/** @param {OrbitNextApi} api */
export function publishBridge(api) {
  window.OrbitNext = Object.freeze({ ...api });
}

/**
 * Put functions that moved out of an old script on the page as globals, for
 * the old scripts still loaded that call them by name (phase 5 on: what
 * render.js and palette.js defined). Each name goes when its last old caller
 * moves; phase 8 removes the rest.
 * @param {Record<string, unknown>} names
 */
export function publishPageGlobals(names) {
  for (const [name, value] of Object.entries(names)) {
    Object.defineProperty(window, name, { value, writable: true, configurable: true, enumerable: false });
  }
}
