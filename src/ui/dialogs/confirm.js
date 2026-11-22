// Questions the user answers before something happens (REWRITE_PLAN.md:
// "the confirm questions moved out of services"). window.confirm is looked
// up on every call, so a test stub takes effect.

/**
 * @param {string} question
 * @returns {boolean} Whether the user said yes.
 */
export function confirmed(question) {
  return /** @type {any} */ (globalThis).confirm(question);
}
