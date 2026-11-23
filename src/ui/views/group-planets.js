// Group expansion is shared by map buttons, keyboard navigation, and search.
import { app, groups, quickFind, setFindQuery } from '../page.js';

/** @type {{id: string, planet: number} | null} */
let pendingGroup = null;

/** @param {Element} cluster */
export function setGroupExpanded(cluster, expanded = true) {
  cluster.classList.toggle('pinned', expanded);
  cluster.querySelector('.group-planet')?.setAttribute('aria-expanded', String(expanded));
}

/** Close the currently pinned group, if there is one. */
export function collapseGroup() {
  const cluster = app.querySelector('.pinned');
  if (!cluster) return false;
  if (cluster.contains(document.activeElement) && !document.activeElement?.matches('.group-planet')) {
    /** @type {HTMLElement|null} */ (cluster.querySelector('.group-planet'))?.focus();
  }
  setGroupExpanded(cluster, false);
  return true;
}

/** @param {number} sun @param {number} planet */
export function openGroup(sun, planet) {
  const id = groups[sun]?.id;
  if (!id) return;
  const route = `group/${encodeURIComponent(id)}`;
  pendingGroup = { id, planet };
  setFindQuery('');
  quickFind.value = '';
  if (location.hash === `#${route}`) revealPendingGroup(id);
  else location.hash = route;
}

/** @param {string|null} id */
export function revealPendingGroup(id) {
  const next = pendingGroup;
  pendingGroup = null;
  if (!next || id !== next.id) return;
  const button = /** @type {HTMLButtonElement|null} */ (
    app.querySelector(`.group-planet[data-planet="${next.planet}"]`));
  const cluster = button?.parentElement;
  if (!button || !cluster) return;
  collapseGroup();
  setGroupExpanded(cluster);
  button.focus();
  button.scrollIntoView({ block: 'nearest' });
}
