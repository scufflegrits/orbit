// Edit bar state, announcements, focus, and move history for drag editing.
import * as mapOps from '../../core/map-ops.js';
import { activeWorkspace, store } from '../../state/page-store.js';
import { KEYS } from '../../state/storage.js';
import { workspaceKey } from '../../state/workspaces.js';
import { hooks } from '../hooks.js';
import { offerDueRoutines } from '../notices/routine-offer.js';
import { GALAXY_PLANETS, VISIBLE_MOONS } from '../layout/orbits.js';
import { app, groups } from '../page.js';

export const editToggle = () => /** @type {HTMLButtonElement} */ (document.querySelector('#edit-toggle'));

export const editBar = () => /** @type {HTMLElement} */ (document.querySelector('#edit-bar'));

const editStatus = () => /** @type {HTMLElement} */ (document.querySelector('#edit-status'));

export const editUndo = () => /** @type {HTMLButtonElement} */ (document.querySelector('#edit-undo'));

/** @type {any} */
let dragUndo = null;

export function storageToken() {
  try { return localStorage.getItem(workspaceKey(KEYS.map, activeWorkspace())); } catch { return undefined; }
}

/**
 * @param {any} message
 * @param {any} [isError]
 */
export function announce(message, isError = false) {
  editStatus().textContent = message;
  editStatus().classList.toggle('edit-status-error', isError);
}

/**
 * @param {any} action
 */
function keepingScroll(action) {
  const top = window.scrollY;
  action();
  app.classList.add('no-intro');
  window.scrollTo({ top, behavior: 'instant' });
}

function dragUndoValid() {
  return Boolean(dragUndo) && dragUndo.revision === store.state().revision && dragUndo.token === storageToken();
}

export function updateEditBar() {
  // Any later map change bumps store.state().revision, which retires the Undo record.
  if (dragUndo && !dragUndoValid()) dragUndo = null;
  editUndo().hidden = !dragUndo;
}

/**
 * @param {any} on
 */
export function showEditMode(on) {
  document.documentElement.dataset.edit = on ? 'on' : 'off';
  editToggle().setAttribute('aria-pressed', String(on));
  /** @type {HTMLElement} */ (editToggle().querySelector('.edit-toggle-state')).textContent = on ? 'On' : 'Off';
  editBar().hidden = !on;
  announce('');
  if (!app.classList.contains('error-view')) keepingScroll(hooks.render);
  // The arrival offer waits until Edit mode is off.
  offerDueRoutines();
}

/**
 * @param {any} path
 */
function pathSelector(path) {
  let selector = `[data-kind="${path.kind}"][data-sun="${path.sun}"]`;
  if (path.planet !== undefined) selector += `[data-planet="${path.planet}"]`;
  if (path.moon !== undefined) selector += `[data-moon="${path.moon}"]`;
  return selector;
}

/**
 * @param {any} path
 */
function focusPath(path) {
  // A moved item may be rendered twice, sit behind a hover reveal, or be gone
  // from this view; the notice is always there to fall back on.
  for (const node of /** @type {NodeListOf<HTMLElement>} */ (app.querySelectorAll(pathSelector(path)))) {
    const holders = /** @type {Element[]} */ ([node.closest('.home-orbit'), path.kind === 'moon' && node.closest('.planet-cluster')]
      .filter(Boolean));
    // Open the reveal for the moment of focusing; focus then keeps it open.
    holders.forEach(holder => holder.classList.add('drag-open'));
    node.focus({ preventScroll: true });
    holders.forEach(holder => holder.classList.remove('drag-open'));
    if (document.activeElement === node) return;
  }
  editStatus().focus({ preventScroll: true });
}

/**
 * @param {any} path
 */
export function nameAt(path) {
  return mapOps.mapItemAt(groups, path).name;
}

/**
 * Where a level change puts the item, and a note when the Galaxy or the moon
 * fan won't show it there.
 * @param {any} result A moved result from changeItemLevel.
 * @param {'planet' | 'moon'} levelChange
 */
export function levelPlace(result, levelChange) {
  const number = (levelChange === 'planet' ? result.path.planet : result.path.moon) + 1;
  const note = levelChange === 'planet' && number > GALAXY_PLANETS ? 'shown in its System'
    : levelChange === 'moon' && number > VISIBLE_MOONS ? 'shown under More moons' : '';
  return { number, note };
}

/**
 * @param {any} gesture
 * @param {any} target
 */
export function commitMove(gesture, target) {
  if (gesture.token !== storageToken()) {
    return announce('The link map changed in another tab, so nothing was moved. Reload this page to pick up the latest map.', true);
  }
  if (gesture.revision !== store.state().revision || mapOps.mapItemAt(groups, gesture.path) !== gesture.item) {
    return announce('The link map changed during the drag, so nothing was moved.', true);
  }
  const result = target.levelChange ? mapOps.changeItemLevel(groups, gesture.path, target.path)
    : mapOps.moveMapItem(groups, gesture.path, target.path);
  if (result.status !== 'moved') return announce('That is not a place this item can go. Nothing changed.');
  const previous = groups;
  const where = target.levelChange ? `to ${nameAt(target.path)} as a ${target.levelChange}`
    : target.path.place ? `${target.path.place} ${nameAt(target.path)}` : `to ${nameAt(target.path)}`;
  const place = target.levelChange ? levelPlace(result, target.levelChange) : null;
  const label = `${gesture.path.kind} ${gesture.item.name} ${where}`;
  try {
    keepingScroll(() => store.saveMap({ groups: result.groups }, `Moved ${label}`));
  } catch (error) {
    return announce(`The move could not be saved, so nothing changed. ${/** @type {any} */ (error).message}`, true);
  }
  dragUndo = { groups: previous, revision: store.state().revision, token: storageToken(), label };
  updateEditBar();
  announce(`Moved ${label}.${place?.note ? ` It's ${target.levelChange} ${place.number} (${place.note}).` : ''}`);
  focusPath(result.path);
}

export function undoDrag() {
  const record = dragUndo;
  if (!dragUndoValid()) {
    dragUndo = null;
    updateEditBar();
    return announce('The link map has changed since that drag, so it can no longer be undone.', true);
  }
  try {
    keepingScroll(() => store.saveMap({ groups: record.groups }, `Undid the move of ${record.label}`));
  } catch (error) {
    return announce(`Undo could not be saved, so nothing changed. ${/** @type {any} */ (error).message}`, true);
  }
  dragUndo = null;
  updateEditBar();
  announce(`Undid the move of ${record.label}.`);
  editStatus().focus({ preventScroll: true });
}
