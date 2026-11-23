// Clicks on destinations (2.2.1 favorites.js): record a link opened from the
// map, Quick find, or the quick bar as recent, and Shift+click a planet to
// open it with all its moons. Moved in rewrite phase 5.
import { itemAt } from '../../core/destination.js';
import { modes } from '../page-modes.js';
import { collapseGroup, setGroupExpanded } from './group-planets.js';
import { noteOpened } from './favorites.js';
import { openAll } from './open.js';
import { app, groups } from '../page.js';

/** @param {MouseEvent} event */
function trackDestinationClicks(event) {
  if (event.type === 'auxclick' && event.button !== 1) return;
  const node = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest('[data-destination]')) : null;
  // A link with placeholders is recorded when its form is submitted instead.
  if (!node || event.defaultPrevented || node.dataset.template) return;
  const path = /** @type {string} */ (node.dataset.destination).split(':').map(Number);
  noteOpened(itemAt(groups, path));
}

/**
 * Listen for clicks. The Edit mode guard in drag.js runs in the capture
 * phase and stops a destination click before the tracking (bubble phase)
 * sees it; Shift+click is in the capture phase too, and only outside Edit
 * mode.
 */
export function installClicks() {
  document.addEventListener('click', event => {
    if (event.defaultPrevented || modes.inEditMode() || !(event.target instanceof Element)) return;
    const button = event.target.closest('button.group-planet');
    if (button && app.contains(button) && button.parentElement) {
      const cluster = button.parentElement;
      const expanded = cluster.classList.contains('pinned');
      collapseGroup();
      if (!expanded) setGroupExpanded(cluster);
    } else if (!event.target.closest('.pinned')) {
      collapseGroup();
    }
  });
  document.addEventListener('click', trackDestinationClicks);
  document.addEventListener('auxclick', trackDestinationClicks);
  document.addEventListener('click', event => {
    if (!event.shiftKey || modes.inEditMode() || !(event.target instanceof Element)) return;
    const node = /** @type {HTMLElement | null} */ (event.target.closest('[data-kind="planet"]'));
    if (!node || !app.contains(node)) return;
    event.preventDefault();
    event.stopPropagation();
    openAll(Number(node.dataset.sun), Number(node.dataset.planet));
  }, true);
}
