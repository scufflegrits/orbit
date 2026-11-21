// While the rewrite moves code from the old classic scripts into src/, the old
// scripts reach the new code through window.OrbitNext (REWRITE_PLAN.md,
// "Coexistence"). orbit.js loads before them, so OrbitNext exists by the time
// any old script runs. Removed in phase 8.

/**
 * @typedef {object} OrbitNextApi
 * @property {string} version The app version, from src/app/version.js.
 */

/** @param {OrbitNextApi} api */
export function publishBridge(api) {
  window.OrbitNext = Object.freeze({ ...api });
}
