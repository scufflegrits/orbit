// The page's one store (phase 3 on). Screens import it; main.js puts it on
// the bridge for the old scripts and the test hook. Reads nothing until
// app.js (old) calls store.start() once the link data is loaded.
import { createStore } from './store.js';
import { readActiveWorkspace } from './workspaces.js';

export const store = createStore();

/**
 * The open workspace: the store's once it has started, and the saved choice
 * before that, as 2.2.1's activeWorkspace was from the moment the page loaded
 * (the top-bar switch is drawn before the store starts).
 */
export function activeWorkspace() {
  return store.state().seed ? store.state().workspace : readActiveWorkspace();
}
