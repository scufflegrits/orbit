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
