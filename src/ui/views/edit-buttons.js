import { isGroup, itemAt } from '../../core/destination.js';
import { element, trashIcon } from '../dom.js';
import { showOpenAllNotice } from '../notices/area.js';
import { openEditorAt } from '../editor/page.js';
import { app, groups, showEditButtons } from '../page.js';
import { removeMapItem } from '../remove-item.js';
import { modes } from '../page-modes.js';
import { buttonTipsDelay, tip } from '../tooltip.js';
import { setGroupExpanded } from './group-planets.js';

const MAP_ITEM = ':is(.home-hub, .detail-hub, .home-satellite, .detail-satellite, .more-link, .moon-link, .overflow-moon-link)';
/** @type {HTMLElement | null} */
let hovered = null;
/** @type {HTMLElement | null} */
let hoverActions = null;
let timer = 0;

/** @param {EventTarget | null} target */
function mapItem(target) {
  const item = target instanceof Element ? target.closest(MAP_ITEM) : null;
  return item instanceof HTMLElement && app?.contains(item) ? item : null;
}

/** @param {HTMLElement} item */
function mapPath(item) {
  const { sun, planet, moon } = item.dataset;
  return [sun, planet, moon].filter(index => index !== undefined).map(Number);
}

function canEditFromMap() {
  return modes.overlayIs('none') && !modes.inEditMode();
}

/**
 * Map renders replace the nodes after a save. Refind the item in its sun
 * and reveal its orbit before focusing it, so the browser can focus moons
 * even if the pointer is still where the editor used to be.
 * @param {HTMLElement} origin
 * @param {number[]} path
 */
function mapFocus(origin, path) {
  const route = location.hash;
  const sunId = groups[path[0]]?.id;
  return () => {
    if (location.hash !== route) return false;
    const sun = groups.findIndex(group => group.id === sunId);
    if (sun === -1) return false;
    const [_, planet, moon] = path;
    const base = `${MAP_ITEM}[data-sun="${sun}"]`;
    const planetSelector = `${base}[data-kind="planet"][data-planet="${planet}"]`;
    const moonSelector = `${base}[data-kind="moon"][data-planet="${planet}"][data-moon="${moon}"]`;
    const node = origin.isConnected ? origin : app.querySelector(moonSelector) ||
      app.querySelector(planetSelector) || app.querySelector(`${base}[data-kind="sun"]`);
    if (!(node instanceof HTMLElement)) return false;
    const containers = [node.closest('.home-orbit'), node.closest('.planet-cluster, .overflow-planet')];
    if (node.dataset.kind === 'moon' && containers[1]?.classList.contains('group-cluster')) setGroupExpanded(containers[1]);
    for (const container of containers) container?.classList.add('restoring-map-focus');
    node.focus({ preventScroll: node === origin });
    for (const container of containers) container?.classList.remove('restoring-map-focus');
    return document.activeElement === node;
  };
}

/** @param {HTMLElement} item */
function editItem(item) {
  const path = mapPath(item);
  openEditorAt(path, { restoreFocus: mapFocus(item, path) });
}

/** @param {KeyboardEvent} event */
export function handleMapEditKey(event) {
  if (event.key.toLowerCase() !== 'e' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      event.isComposing || !canEditFromMap()) return false;
  const item = mapItem(event.target);
  if (!item || item !== document.activeElement) return false;
  event.preventDefault();
  editItem(item);
  return true;
}

function hideActions() {
  window.clearTimeout(timer);
  hovered = null;
  hoverActions?.remove();
  hoverActions = null;
}

/** @param {string} className @param {string | HTMLElement} icon @param {string} name @param {() => void} action */
function mapAction(className, icon, name, action) {
  const button = element('button', className);
  button.append(icon);
  tip(button, name);
  button.type = 'button';
  button.tabIndex = -1;
  button.setAttribute('aria-label', name);
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
  });
  button.addEventListener('click', event => {
    event.stopPropagation();
    if (canEditFromMap()) action();
  });
  return button;
}

/** @param {HTMLElement} item */
function showActions(item) {
  const parent = item.parentElement;
  if (!parent || !item.isConnected || !item.matches(':hover') || !showEditButtons || !canEditFromMap()) return;
  const path = mapPath(item);
  const sun = groups[path[0]];
  const target = path.length === 1 ? sun : itemAt(groups, path);
  if (!target) return;
  const verb = sun.team ? 'View' : 'Edit';
  const detail = path.length === 2 ? (isGroup(target) ? ' and its links' : ' and its moons') : '';
  const actions = element('div', 'map-item-actions');
  actions.append(mapAction('map-edit-button', '✎', `${verb} ${target.name}${detail}`, () => {
    if (item.isConnected) editItem(item);
  }));
  if (!sun.team) {
    actions.append(mapAction('map-remove-button', trashIcon(), `Remove ${target.name}`, () => {
      if (!item.isConnected) return;
      try {
        removeMapItem(path);
      } catch (error) {
        showOpenAllNotice(`Could not remove ${target.name}: ${/** @type {Error} */ (error).message}`, true);
      }
    }));
  }

  // Keep both actions beside their anchor in the existing hover region.
  // Measure its CSS origin to account for the orbit's translated container.
  parent.append(actions);
  const anchor = item.getBoundingClientRect();
  const base = actions.getBoundingClientRect();
  const scale = base.width / actions.offsetWidth;
  actions.style.left = `${(anchor.left + anchor.width * .82 - base.left) / scale - 12}px`;
  actions.style.top = `${(anchor.top + anchor.height * .18 - base.top) / scale - 12}px`;
  hoverActions = actions;
}

export function installMapEditButtons() {
  document.addEventListener('pointerover', event => {
    const item = mapItem(event.target);
    if (!item || item === hovered || event.pointerType === 'touch' || !showEditButtons || !canEditFromMap()) return;
    hideActions();
    hovered = item;
    timer = window.setTimeout(() => showActions(item), buttonTipsDelay() ?? 800);
  });
  document.addEventListener('pointerout', event => {
    if (!hovered || !(event.target instanceof Node) || (!hovered.contains(event.target) && !hoverActions?.contains(event.target))) return;
    const next = event.relatedTarget;
    if (next instanceof Node && (hovered.contains(next) || hoverActions?.contains(next))) return;
    hideActions();
  });
  modes.subscribe(() => {
    if (!canEditFromMap()) hideActions();
  });
  window.addEventListener('resize', hideActions);
}
