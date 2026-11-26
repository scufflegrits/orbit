// Keyboard handling (2.2.1 keys.js): the menu's focus trap, Escape by the
// mode store's topmost layer, / for Quick find, arrows through the results,
// and arrows between suns, planets, and moons. Moved in rewrite phase 7.
import { cancelDrag, setEditMode } from '../drag/drag.js';
import { editBar, editToggle } from '../drag/edit-bar.js';
import { handlePaletteKey, handlePaletteShortcut } from '../find/palette.js';
import { hideTooltip } from '../tooltip.js';
import { closeMenu } from '../menu/menu.js';
import { handleMapEditKey } from '../views/edit-buttons.js';
import { collapseGroup, setGroupExpanded } from '../views/group-planets.js';
import { modes } from '../page-modes.js';
import { app, menuOverlay, quickFind, setFindQuery, topbarSearch } from '../page.js';

/** @type {Record<string, [number, number]>} */
const ARROWS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
const PLANET_SELECTOR = '.home-satellite, .detail-satellite';

function menuFocusables() {
  return [.../** @type {NodeListOf<HTMLButtonElement>} */ (menuOverlay.querySelectorAll('.menu-sheet :is(button, a[href], input, select, textarea, [tabindex])'))]
    .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length > 0);
}

/**
 * @param {any} event
 */
function trapMenuFocus(event) {
  const items = menuFocusables();
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const inside = /** @type {HTMLElement} */ (menuOverlay.querySelector('.menu-sheet')).contains(document.activeElement);
  if (!inside) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * @param {any} event
 */
function handleEscape(event) {
  if (hideTooltip()) {
    event.preventDefault();
    return;
  }
  const target = modes.escapeTarget();
  if (target === 'overlay') {
    event.preventDefault();
    closeMenu();
  } else if (target === 'drag') {
    event.preventDefault();
    cancelDrag();
  } else if (target === 'edit') {
    event.preventDefault();
    const inBar = editBar().contains(document.activeElement);
    setEditMode(false);
    if (inBar) editToggle().focus();
  } else if (target === 'find') {
    event.preventDefault();
    // Keep keyboard users in the search box when the result they were on disappears.
    if (document.activeElement?.closest('.find-results')) quickFind.focus();
    quickFind.value = '';
    setFindQuery('');
    // On the Galaxy the input handler refreshes results; in a System it would leave the System.
    if (app.classList.contains('home-view')) quickFind.dispatchEvent(new Event('input'));
  } else if (collapseGroup()) {
    event.preventDefault();
  } else if (target === 'view') {
    location.hash = '';
  }
}

/**
 * @param {any} target
 */
function typingInField(target) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/**
 * @param {any} event
 */
function handleSlash(event) {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return false;
  if (typingInField(event.target) || !modes.keyAllowed('slash') || topbarSearch.hidden) return false;
  event.preventDefault();
  quickFind.focus();
  quickFind.select();
  return true;
}

/**
 * @param {any} event
 */
function handleFindArrows(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false;
  const results = [.../** @type {NodeListOf<HTMLElement>} */ (app.querySelectorAll('.find-item'))];
  if (!results.length) return false;
  const active = document.activeElement;
  if (active === quickFind) {
    if (event.key === 'ArrowUp') return false;
    event.preventDefault();
    results[0].focus();
    return true;
  }
  const index = results.indexOf(/** @type {HTMLElement} */ (active));
  if (index === -1) return false;
  event.preventDefault();
  if (event.key === 'ArrowDown') results[Math.min(index + 1, results.length - 1)].focus();
  else if (index === 0) quickFind.focus();
  else results[index - 1].focus();
  return true;
}

/**
 * @param {any} node
 */
function centerOf(node) {
  const box = node.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/**
 * @param {any} from
 * @param {any} candidates
 * @param {any} options
 */
function nearestInDirection(from, candidates, [dx, dy]) {
  const origin = centerOf(from);
  let best = null;
  let bestScore = Infinity;
  for (const node of candidates) {
    if (node === from) continue;
    const point = centerOf(node);
    const along = (point.x - origin.x) * dx + (point.y - origin.y) * dy;
    if (along <= 8) continue;
    const across = Math.abs((point.x - origin.x) * dy - (point.y - origin.y) * dx);
    const score = along + across * 2;
    if (score < bestScore) { best = node; bestScore = score; }
  }
  return best;
}

/**
 * @param {any} list
 * @param {any} node
 * @param {any} step
 */
function neighbor(list, node, step) {
  const index = list.indexOf(node);
  return index === -1 ? null : list[index + step] || null;
}

/**
 * @param {any} planet
 * @param {any} options
 */
function planetTarget(planet, [dx, dy]) {
  const cluster = planet.closest('.planet-cluster');
  const container = cluster.parentElement;
  const planets = [...container.querySelectorAll(':scope > .planet-cluster > :is(.home-satellite, .detail-satellite)')];
  if (dx) return neighbor(planets, planet, dx);
  if (dy > 0) {
    const moon = cluster.querySelector('.moon-link');
    if (moon && planet.matches('.group-planet') && !cluster.classList.contains('pinned') && !modes.inEditMode()) {
      collapseGroup();
      setGroupExpanded(cluster);
    }
    return moon;
  }
  return container.querySelector(':scope > .home-hub');
}

/**
 * @param {any} moon
 * @param {any} options
 */
function moonTarget(moon, [dx, dy]) {
  const field = moon.closest('.moon-field');
  if (dx) return neighbor([...field.querySelectorAll('.moon-link')], moon, dx);
  if (dy < 0) return field.closest('.planet-cluster').querySelector(`:scope > :is(${PLANET_SELECTOR})`);
  return null;
}

/**
 * @param {any} event
 */
function handleMapArrows(event) {
  const direction = ARROWS[event.key];
  if (!direction || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  if (modes.menuOpen()) return;
  const active = /** @type {HTMLElement} */ (document.activeElement);
  /** @type {HTMLElement | null} */
  let target = null;
  if (active.classList.contains('home-hub')) {
    target = nearestInDirection(active, [...app.querySelectorAll('.home-hub')], direction);
  } else if (active.matches(PLANET_SELECTOR)) {
    target = planetTarget(active, direction);
  } else if (active.classList.contains('moon-link')) {
    target = moonTarget(active, direction);
  }
  if (target) {
    event.preventDefault();
    target.focus();
  }
}

/** Listen for keys on the window, as 2.2.1 did. */
export function installKeys() {
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented) return;
    // The command palette takes every key while it is open, and the placeholder form handles its own.
    if (handlePaletteKey(event) || modes.overlayIs('palette') || !modes.keyAllowed('other')) return;
    if (handlePaletteShortcut(event) || handleMapEditKey(event)) return;
    if (event.key === 'Tab') {
      if (modes.menuOpen()) trapMenuFocus(event);
    } else if (event.key === 'Escape') {
      handleEscape(event);
    } else if (!handleSlash(event) && !handleFindArrows(event)) {
      handleMapArrows(event);
    }
  });
}
