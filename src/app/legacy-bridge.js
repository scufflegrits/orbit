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
 * @property {Readonly<Record<string, any>>} state The state modules (storage, workspaces, prefs, history, backup).
 */

/** @param {OrbitNextApi} api */
export function publishBridge(api) {
  window.OrbitNext = Object.freeze({ ...api });
}
