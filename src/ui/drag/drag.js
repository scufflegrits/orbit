// Edit mode and drag-and-drop organization (2.2.1 drag.js). Dragging
// changes array order and parent membership only; it never stores positions.
// Whether Edit mode is on and whether an item is pressed or dragged belong
// to the mode store; this is the gesture's controller and the Edit bar.
// Moved in rewrite phase 7.
import * as mapOps from '../../core/map-ops.js';
import { activeWorkspace, store } from '../../state/page-store.js';
import { KEYS } from '../../state/storage.js';
import { workspaceKey } from '../../state/workspaces.js';
import { counted, element, tagPath } from '../dom.js';
import { openEditorAt, openEditorPage } from '../editor/page.js';
import { hooks } from '../hooks.js';
import { icon } from '../icons.js';
import { GALAXY_PLANETS, VISIBLE_MOONS } from '../layout/orbits.js';
import { openMenu } from '../menu/menu.js';
import { offerDueRoutines } from '../notices/routine-offer.js';
import { modes } from '../page-modes.js';
import { app, groups } from '../page.js';

const editToggle = () => /** @type {HTMLButtonElement} */ (document.querySelector('#edit-toggle'));
export const editBar = () => /** @type {HTMLElement} */ (document.querySelector('#edit-bar'));
const editStatus = () => /** @type {HTMLElement} */ (document.querySelector('#edit-status'));
const editUndo = () => /** @type {HTMLButtonElement} */ (document.querySelector('#edit-undo'));
export { editToggle };
const DRAG_THRESHOLD = 6;
const DWELL_MS = 350;
/**
 * The gesture's details (node, path, item, preview, tray, timers). It exists
 * exactly while the mode is pressed or dragging; whether a gesture is under
 * way is always asked of the mode store, never read from this.
 * @type {any}
 */
let drag = null;
/** The message shown when a drag ends without a drop; cancelDrag() sets it. @type {string | null} */
let cancelMessage = null;
/** @type {any} */
let dragUndo = null;
let suppressNextClick = false;

/** The gesture under way, or null (OrbitTest reads its pointer id). */
export const currentGesture = () => drag;

/** @type {Record<string, string>} */
const DRAG_HELP = {
  sun: 'Drop beside another sun',
  planet: 'Drop on a sun, or beside a planet. Hold on Make it a moon to change it into a moon',
  moon: 'Drop on a planet, or beside a moon. Hold on a sun to make it a planet',
};

function storageToken() {
  try { return localStorage.getItem(workspaceKey(KEYS.map, activeWorkspace())); } catch { return undefined; }
}

/**
 * @param {any} message
 * @param {any} [isError]
 */
function announce(message, isError = false) {
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
export function setEditMode(on) {
  if (modes.inEditMode() === on) return;
  cancelDrag();
  modes.send(on ? 'editOn' : 'editOff');
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
 * @param {any} node
 */
function pathOf(node) {
  const data = node.dataset;
  /** @type {any} */
  const path = { kind: data.kind, sun: Number(data.sun) };
  if (data.planet !== undefined) path.planet = Number(data.planet);
  if (data.moon !== undefined) path.moon = Number(data.moon);
  return path;
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
function nameAt(path) {
  return mapOps.mapItemAt(groups, path).name;
}

/**
 * @param {any} className
 * @param {any} name
 * @param {any} count
 * @param {any} [kind]
 * @param {...any} indices
 */
function trayRow(className, name, count, kind, ...indices) {
  const row = element('div', className);
  if (kind) tagPath(row, kind, indices[0], indices[1], indices[2]);
  row.append(element('span', 'tray-name', name));
  if (count) row.append(element('span', 'tray-count', count));
  return row;
}

/**
 * @param {any} pointerX
 */
function buildTray(pointerX) {
  const tray = element('aside', 'drag-tray');
  tray.classList.add(pointerX > window.innerWidth / 2 ? 'drag-tray-left' : 'drag-tray-right');
  const current = Number(/** @type {HTMLElement} */ (app.querySelector('.detail-stage')).dataset.sun);
  const forPlanet = drag.path.kind === 'planet';
  tray.append(element('h2', '', forPlanet ? 'Move to another sun' : 'Move to a planet'));
  groups.forEach((sun, sunIndex) => {
    if ((forPlanet && sunIndex === current) || sun.team) return;
    const group = element('div', 'tray-group');
    if (!forPlanet && sunIndex === current) group.classList.add('open');
    const count = counted(sun.links.length, 'planet');
    group.append(forPlanet ? trayRow('tray-row tray-head', sun.name, count, 'sun', sunIndex)
      : trayRow('tray-head', sunIndex === current ? `${sun.name} (this System)` : sun.name, count));
    const list = element('div', 'tray-list');
    sun.links.forEach((/** @type {any} */ planet, /** @type {any} */ planetIndex) => {
      const item = element('div', 'tray-item');
      item.append(trayRow('tray-row', planet.name, forPlanet ? '' : counted(planet.moons.length, 'moon'),
        'planet', sunIndex, planetIndex));
      if (!forPlanet && planet.moons.length) {
        item.classList.add('tray-expandable');
        const moons = element('div', 'tray-sublist');
        planet.moons.forEach((/** @type {any} */ moon, /** @type {any} */ moonIndex) => moons.append(
          trayRow('tray-row tray-moon', moon.name, '', 'moon', sunIndex, planetIndex, moonIndex)));
        item.append(moons);
      }
      list.append(item);
    });
    if (!sun.links.length) list.append(element('p', 'tray-empty', 'No planets yet.'));
    if (!forPlanet) list.append(trayRow('tray-row tray-new-planet', `+ New planet in ${sun.name}`, '', 'sun', sunIndex));
    group.append(list);
    tray.append(group);
  });
  tray.append(element('p', 'tray-hint', forPlanet
    ? 'Pause on a sun to place the planet beside one of its planets.'
    : 'Pause on a sun to show its planets, and on a planet to show its moons. Hold on + New planet to make the moon a planet.'));
  document.body.append(tray);
  return tray;
}

/**
 * @param {any} event
 */
function startDrag(event) {
  modes.send('passThreshold');
  try { drag.node.setPointerCapture(drag.pointerId); } catch { /* Events still bubble to the document. */ }
  window.getSelection()?.removeAllRanges();
  document.documentElement.classList.add('dragging');
  drag.node.classList.add('drag-source');
  // Keep the source visible without relying on hover or focus.
  if (drag.path.kind !== 'sun') drag.node.closest('.home-orbit')?.classList.add('drag-open');
  if (drag.path.kind === 'moon') {
    drag.node.closest('.planet-cluster, .overflow-planet')?.classList.add('drag-open');
  }
  drag.preview = element('div', 'drag-preview');
  drag.preview.append(element('strong', '', drag.item.name), element('span', 'drag-hint', ''));
  document.body.append(drag.preview);
  if (app.classList.contains('detail-view')) drag.tray = buildTray(event.clientX);
  announce(`Moving ${drag.path.kind} ${drag.item.name}. ${DRAG_HELP[drag.path.kind]}.`);
}

/**
 * @param {any} sibling
 * @param {any} path
 */
function showChoices(sibling, path) {
  if (drag.choices?.sibling === sibling) return;
  hideChoices();
  // A moon on a sun's circle is offered only the change into a planet.
  const convertOnly = path.kind !== drag.path.kind;
  const box = element('div', 'drop-choices');
  if (!convertOnly) {
    for (const [place, word] of [['before', 'Before'], ['after', 'After']]) {
      const choice = element('div', 'drop-choice', `${word} ${nameAt(path)}`);
      choice.dataset.place = place;
      box.append(choice);
    }
  }
  const option = convertOnly || (drag.path.kind === 'planet' && path.kind === 'planet') ? levelOption(path) : null;
  if (option) {
    const choice = element('div', `drop-choice drop-level${option.enabled ? '' : ' is-disabled'}`);
    choice.dataset.action = option.levelChange;
    if (!option.enabled) choice.setAttribute('aria-disabled', 'true');
    choice.append(icon(option.levelChange === 'planet' ? 'arrow-up-from-line' : 'arrow-down-to-line'),
      element('span', '', option.text));
    // Below Before and After, set apart by a divider: the box opens centered on
    // the planet, so the pointer arrives on Before or After, never on this.
    // (It stays in the same box: a gap between boxes would close them.)
    if (!convertOnly) box.append(element('div', 'drop-level-divider'));
    box.append(choice);
  }
  document.body.append(box);
  const rect = sibling.getBoundingClientRect();
  if (convertOnly) {
    // Beside the sun's circle, never over its center, where the pointer is.
    const right = rect.right + 14;
    const left = right + box.offsetWidth > window.innerWidth - 8 ? rect.left - 14 - box.offsetWidth : right;
    box.style.left = `${Math.max(8, left)}px`;
    box.style.top = `${Math.max(8, Math.min(rect.top + rect.height / 2 - box.offsetHeight / 2, window.innerHeight - box.offsetHeight - 8))}px`;
    drag.choices = { box, sibling, path, convertOnly, option };
    return;
  }
  let x = rect.left + rect.width / 2;
  let y = rect.top + rect.height / 2;
  // Moons in an orbit sit close together, so a box centered on one would cover
  // its neighbours. Open it outward from the planet instead, still overlapping
  // the moon so the pointer reaches it without leaving the moon first.
  const planet = path.kind === 'moon' &&
    sibling.closest('.planet-cluster')?.querySelector(':scope > :is(.home-satellite, .detail-satellite)');
  if (planet) {
    const from = planet.getBoundingClientRect();
    const dx = x - (from.left + from.width / 2);
    const dy = y - (from.top + from.height / 2);
    const length = Math.hypot(dx, dy) || 1;
    const shift = rect.width * .15 +
      Math.abs(dx / length) * box.offsetWidth / 2 + Math.abs(dy / length) * box.offsetHeight / 2;
    x += dx / length * shift;
    y += dy / length * shift;
  }
  const clamp = (/** @type {any} */ value, /** @type {any} */ size, /** @type {any} */ limit) => Math.max(8, Math.min(value, limit - size - 8));
  box.style.left = `${clamp(x - box.offsetWidth / 2, box.offsetWidth, window.innerWidth)}px`;
  box.style.top = `${clamp(y - box.offsetHeight / 2, box.offsetHeight, window.innerHeight)}px`;
  drag.choices = { box, sibling, path, convertOnly, option };
}

function hideChoices() {
  disarm();
  drag.choices?.box.remove();
  drag.choices = null;
}

/**
 * Whether the dragged item can change level onto `path`, and the choice's words.
 * @param {any} path A sun for a moon, a planet for a planet.
 */
function levelOption(path) {
  const levelChange = drag.path.kind === 'moon' ? 'planet' : 'moon';
  const result = mapOps.changeItemLevel(groups, drag.path, path);
  if (result.status === 'moved') return { levelChange, enabled: true, text: `Make it a ${levelChange} of ${nameAt(path)}` };
  /** @type {Record<string, string>} */
  const reasons = {
    team: groups[path.sun]?.team ? 'Team suns are read-only' : 'Team planets are read-only',
    'has-moons': `Can't be a moon: ${drag.item.name} has ${counted(drag.item.moons?.length || 0, 'moon')}`,
    group: "Can't be a moon: a group's links stay in the group",
  };
  return { levelChange, enabled: false, text: reasons[result.reason] || 'It can\'t change level here' };
}

/** Stop arming a level-change choice. */
function disarm() {
  // endGesture clears the timer itself once the mode has moved on.
  if (!modes.holding() || !drag.arm) return;
  clearTimeout(drag.arm.timer);
  drag.arm.choice.classList.remove('arming', 'armed');
  drag.arm = null;
}

/**
 * A level change takes effect only after the pointer rests on its choice for
 * DWELL_MS, so passing over it on the way somewhere never converts.
 * @param {any} choice
 */
function levelTarget(choice) {
  const { sibling, path } = drag.choices;
  const waiting = { status: 'choose', node: sibling, path };
  if (choice.getAttribute('aria-disabled') === 'true') {
    disarm();
    return waiting;
  }
  if (drag.arm?.choice !== choice) {
    disarm();
    choice.classList.add('arming');
    drag.arm = { choice, ready: false, timer: setTimeout(() => {
      if (!modes.dragging() || drag.arm?.choice !== choice) return;
      drag.arm.ready = true;
      choice.classList.add('armed');
      refreshDrag();
    }, DWELL_MS) };
    return waiting;
  }
  if (!drag.arm.ready) return waiting;
  return { status: 'valid', node: choice, path, sibling, levelChange: choice.dataset.action };
}

/**
 * Where a level change puts the item, and a note when the Galaxy or the moon
 * fan won't show it there.
 * @param {any} result A moved result from changeItemLevel.
 * @param {'planet' | 'moon'} levelChange
 */
function levelPlace(result, levelChange) {
  const number = (levelChange === 'planet' ? result.path.planet : result.path.moon) + 1;
  const note = levelChange === 'planet' && number > GALAXY_PLANETS ? 'shown in its System'
    : levelChange === 'moon' && number > VISIBLE_MOONS ? 'shown under More moons' : '';
  return { number, note };
}

/**
 * @param {any} choice
 */
function siblingTarget(choice) {
  const { sibling } = drag.choices;
  /** @type {any} */
  const path = { ...drag.choices.path, place: choice.dataset.place };
  const result = mapOps.moveMapItem(groups, drag.path, path);
  if (result.status !== 'moved') return { status: result.status === 'same' ? 'same' : 'none', node: choice, path, sibling };
  const index = /** @type {any} */ (result.path)[drag.path.kind];
  return { status: 'valid', node: choice, path, sibling, position: `position ${index + 1} of ${result.total}` };
}

/**
 * @param {any} under
 */
function resolveTarget(under) {
  if (!under) return { status: 'none' };
  const kind = drag.path.kind;
  if (drag.choices && under.closest('.drop-choices')) {
    const choice = under.closest('.drop-choice');
    if (choice?.dataset.action) return levelTarget(choice);
    disarm();
    return choice ? siblingTarget(choice)
      : { status: 'choose', node: drag.choices.sibling, path: drag.choices.path };
  }
  disarm();
  const tagged = under.closest('[data-kind]');
  // Only a sun's own circle (or the tray's New planet row) offers a moon the change
  // into a planet; the orbit and stage around it never do. Team suns show why not.
  if (kind === 'moon' && tagged?.dataset.kind === 'sun' && tagged.matches('.home-hub, .detail-hub, .tray-new-planet')) {
    return { status: 'choose', node: tagged, path: pathOf(tagged) };
  }
  if (tagged && groups[Number(tagged.dataset.sun)]?.team) return { status: 'none' };
  let node = tagged;
  // A whole Galaxy card stands in for its sun when suns are being reordered.
  if (kind === 'sun') node = under.closest('.group-card')?.querySelector('.home-hub') || null;
  if (node?.dataset.kind === kind) {
    const path = pathOf(node);
    return mapOps.samePath(path, drag.path) ? { status: 'none' } : { status: 'choose', node, path };
  }
  const want = /** @type {Record<string, string>} */ ({ planet: 'sun', moon: 'planet' })[kind];
  node = want && tagged?.dataset.kind === want ? tagged : null;
  // The whole orbit stands in for its sun, so a planet does not need a precise drop.
  if (!node && want === 'sun') {
    node = under.closest('.home-orbit, .detail-stage')?.querySelector('.home-hub, .detail-hub') || null;
    // The empty space of a team sun's orbit is read-only too.
    if (node && groups[Number(node.dataset.sun)]?.team) return { status: 'none' };
  }
  if (!node) return { status: 'none' };
  const path = pathOf(node);
  const same = path.sun === drag.path.sun && (want === 'sun' || path.planet === drag.path.planet);
  return { status: same ? 'same' : 'valid', node, path };
}

/**
 * @param {any} node
 */
function openDwell(node) {
  if (!modes.holding() || drag.dwellNode !== node) return;
  if (node.matches('.tray-group, .tray-item')) {
    const scope = node.matches('.tray-group') ? '.tray-group.open' : '.tray-item.open';
    for (const other of drag.tray.querySelectorAll(scope)) other.classList.remove('open');
    node.classList.add('open');
  } else {
    node.classList.add('drag-open', 'drag-reveal');
  }
  drag.dwellNode = null;
  refreshDrag();
  // Revealed planets travel outward for a moment; hit-test again once they settle.
  setTimeout(refreshDrag, 450);
}

/**
 * @param {any} under
 */
function dwellCandidate(under) {
  const branch = under.closest('.tray-expandable:not(.open), .tray-group:not(.open)');
  if (branch || drag.path.kind === 'sun' || under.closest('.drag-tray, .drop-choices')) return branch;
  const cluster = drag.path.kind === 'moon'
    ? under.closest('.planet-cluster:not(.drag-open), .overflow-planet:not(.drag-open)') : null;
  return cluster || under.closest('.home-orbit:not(.drag-open)');
}

/**
 * @param {any} under
 */
function updateDwell(under) {
  // A reveal closes shortly after the pointer leaves it; the gap between a
  // planet and its moons must not close it.
  for (const reveal of app.querySelectorAll('.drag-reveal')) {
    const inside = under && (reveal.contains(under) || under.closest('.drop-choices'));
    if (inside) {
      clearTimeout(drag.closing.get(reveal));
      drag.closing.delete(reveal);
    } else if (!drag.closing.has(reveal)) {
      drag.closing.set(reveal, setTimeout(() => {
        reveal.classList.remove('drag-open', 'drag-reveal');
        if (modes.holding()) drag.closing.delete(reveal);
        refreshDrag();
      }, DWELL_MS));
    }
  }
  const node = under ? dwellCandidate(under) : null;
  if (node === drag.dwellNode) return;
  clearTimeout(drag.dwellTimer);
  drag.dwellNode = node;
  if (node) drag.dwellTimer = setTimeout(() => openDwell(node), DWELL_MS);
}

/**
 * @param {any} x
 * @param {any} y
 */
function placePreview(x, y) {
  let left = x + 14;
  let top = y + 16;
  if (drag.choices) {
    // Stay beside the Before and After choices instead of covering them.
    const box = drag.choices.box.getBoundingClientRect();
    left = box.right + 10;
    if (left + drag.preview.offsetWidth > window.innerWidth - 8) left = box.left - drag.preview.offsetWidth - 10;
    top = box.top;
  }
  drag.preview.style.transform = `translate(${left}px, ${top}px)`;
}

/**
 * @param {any} x
 * @param {any} y
 */
function updateDrag(x, y) {
  drag.x = x;
  drag.y = y;
  const under = document.elementFromPoint(x, y);
  updateDwell(under);
  const target = /** @type {any} */ (resolveTarget(under));
  if (target.status === 'choose') showChoices(target.node, target.path);
  else if (!target.sibling) hideChoices();
  placePreview(x, y);
  const changed = target.node !== drag.target?.node || target.status !== drag.target?.status;
  if (!changed) return;
  drag.target?.node?.classList.remove('drop-target', 'drop-same');
  drag.target?.sibling?.classList.remove('insert-before', 'insert-after');
  const leftTarget = drag.target?.status === 'valid';
  drag.target = target;
  const hint = drag.preview.querySelector('.drag-hint');
  drag.preview.classList.toggle('drag-preview-valid', target.status === 'valid');
  if (target.status === 'valid' && target.levelChange) {
    target.node.classList.add('drop-target');
    const result = mapOps.changeItemLevel(groups, drag.path, target.path);
    const { number, note } = result.status === 'moved' ? levelPlace(result, target.levelChange) : { number: 0, note: '' };
    hint.textContent = note ? `Make ${drag.item.name} ${target.levelChange} ${number} of ${nameAt(target.path)} (${note})`
      : `Make ${drag.item.name} a ${target.levelChange} of ${nameAt(target.path)}`;
    announce(`${hint.textContent}. Release to change it.`);
  } else if (target.status === 'valid' && target.sibling) {
    target.node.classList.add('drop-target');
    target.sibling.classList.add(`insert-${target.path.place}`);
    hint.textContent = `Insert ${target.path.place} ${nameAt(target.path)}, ${target.position}`;
    announce(`Insert ${drag.item.name} ${target.path.place} ${nameAt(target.path)}, ${target.position}. Release to place it.`);
  } else if (target.status === 'valid') {
    target.node.classList.add('drop-target');
    hint.textContent = `Drop to move to ${nameAt(target.path)}`;
    announce(`Over ${target.path.kind} ${nameAt(target.path)}. Release to move ${drag.item.name} here.`);
  } else if (target.status === 'same') {
    target.node.classList.add('drop-same');
    hint.textContent = target.sibling ? 'Already in this position' : `Already in ${nameAt(target.path)}`;
  } else if (target.status === 'choose') {
    const name = nameAt(target.path);
    const option = drag.choices?.option;
    if (drag.choices?.convertOnly) {
      hint.textContent = option.enabled ? `Hold on Make it a planet of ${name}` : option.text;
      announce(`On sun ${name}. ${option.enabled ? `Hold on Make it a planet of ${name}, or move away.` : `${option.text}.`}`);
    } else if (option) {
      hint.textContent = option.enabled ? `Choose Before or After ${name}, or hold on Make it a moon` : `Choose Before or After ${name}`;
      announce(option.enabled ? `Beside planet ${name}. Choose Before, After, or Make it a moon of ${name}.`
        : `Beside planet ${name}. Choose Before or After. ${option.text}.`);
    } else {
      hint.textContent = `Choose Before or After ${name}`;
      announce(`Beside ${target.path.kind} ${name}. Choose Before or After.`);
    }
  } else {
    hint.textContent = DRAG_HELP[drag.path.kind];
  }
  if (leftTarget && target.status !== 'valid') announce(`No drop target. ${hint.textContent}.`);
}

function refreshDrag() {
  if (modes.dragging()) updateDrag(drag.x, drag.y);
}

/**
 * @param {any} wasDragging
 */
function endGesture(wasDragging) {
  const gesture = drag;
  clearTimeout(gesture.dwellTimer);
  clearTimeout(gesture.arm?.timer);
  for (const timer of gesture.closing.values()) clearTimeout(timer);
  if (wasDragging) hideChoices();
  drag = null;
  if (!wasDragging) return gesture;
  try { gesture.node.releasePointerCapture(gesture.pointerId); } catch { /* Already released. */ }
  gesture.preview.remove();
  gesture.tray?.remove();
  document.documentElement.classList.remove('dragging');
  const marks = ['drag-open', 'drag-reveal', 'drop-target', 'drop-same', 'drag-source', 'insert-before', 'insert-after'];
  for (const node of document.querySelectorAll(marks.map(mark => `.${mark}`).join(', '))) {
    node.classList.remove(...marks);
  }
  // The browser still sends a click after the release; it must not open anything.
  suppressNextClick = true;
  return gesture;
}

/**
 * @param {any} [message]
 */
export function cancelDrag(message = 'Move cancelled. Nothing changed.') {
  if (!modes.holding()) return false;
  cancelMessage = message;
  modes.send('cancelDrag');
  return true;
}

/**
 * @param {any} wasDragging
 * @param {any} event
 */
export function gestureEnded(wasDragging, event) {
  endGesture(wasDragging);
  const message = cancelMessage || 'Move cancelled. Nothing changed.';
  cancelMessage = null;
  if (wasDragging && event !== 'drop') announce(message);
}

/**
 * @param {any} gesture
 * @param {any} target
 */
function commitMove(gesture, target) {
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

function undoDrag() {
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

/**
 * @param {any} event
 */
function guardActivation(event) {
  if (suppressNextClick) {
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (!modes.linkOpensEditor('app') || !(event.target instanceof Element)) return;
  // Favorites, recent links, and list links open their item in Edit links.
  const shortcut = event.target.closest('[data-edit-path]');
  if (shortcut && app.contains(shortcut)) {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'click') openEditorAt(shortcut.dataset.editPath.split(':').map(Number));
    return;
  }
  const node = event.target.closest('[data-kind="planet"], [data-kind="moon"]');
  if (!node || !app.contains(node)) return;
  event.preventDefault();
  event.stopPropagation();
  announce(`Links are closed in Edit mode. Drag ${node.textContent} to move it, or turn Edit mode off to open it.`);
}

/**
 * Listen for the pointer, the window, and the Edit bar. Document and window
 * listeners go in at once, in the order 2.2.1 added them; the Edit bar's
 * buttons once the page has loaded.
 */
export function installDrag() {
  document.addEventListener('pointerdown', event => {
    suppressNextClick = false;
    if (modes.state().mode !== 'editIdle' || modes.menuOpen()) return;
    if (event.button !== 0 || !event.isPrimary || event.pointerType === 'touch') return;
    const node = event.target instanceof Element ? event.target.closest('[data-kind]') : null;
    if (!node || !app.contains(node)) return;
    const path = pathOf(node);
    if (groups[path.sun]?.team) {
      announce('Team suns are read-only. Copy an item to your map in Edit links to rearrange it.');
      return;
    }
    const item = mapOps.mapItemAt(groups, path);
    // The System hub is not a source: there is nothing to reorder it against.
    if (!item || (path.kind === 'sun' && !node.classList.contains('home-hub'))) return;
    if (!modes.send('press')) return;
    drag = { pointerId: event.pointerId, node, path, item, closing: new Map(),
      revision: store.state().revision, token: storageToken(), startX: event.clientX, startY: event.clientY };
  });

  document.addEventListener('pointermove', event => {
    if (!modes.holding() || event.pointerId !== drag.pointerId) return;
    if (!modes.dragging()) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
      startDrag(event);
    }
    updateDrag(event.clientX, event.clientY);
  });

  document.addEventListener('pointerup', event => {
    if (!modes.holding() || event.pointerId !== drag.pointerId) return;
    const dragging = modes.dragging();
    if (dragging) updateDrag(event.clientX, event.clientY);
    const target = drag.target;
    const gesture = drag;
    // The subscriber tidies the gesture away; the result is reported here.
    modes.send(dragging ? 'drop' : 'release');
    if (!dragging) return;
    if (target?.status === 'valid') commitMove(gesture, target);
    else if (target?.status === 'same') {
      announce(target.sibling ? `${gesture.item.name} is already in that position. Nothing changed.`
        : `${gesture.item.name} is already in ${nameAt(target.path)}. Nothing changed.`);
    } else if (target?.status === 'choose') {
      announce(target.path.kind !== gesture.path.kind
        ? `Hold on Make it a planet of ${nameAt(target.path)} to change ${gesture.item.name} into a planet. Nothing changed.`
        : `Choose Before or After to place ${gesture.item.name} beside ${nameAt(target.path)}. Nothing changed.`);
    }
    else announce('That was not a drop target. Nothing changed.');
  });

  // A click follows the release in the same task; after that the guard is spent.
  document.addEventListener('pointerup', () => setTimeout(() => { suppressNextClick = false; }, 0));

  document.addEventListener('pointercancel', event => {
    if (modes.holding() && event.pointerId === drag.pointerId) cancelDrag();
  });
  document.addEventListener('lostpointercapture', event => {
    if (modes.dragging() && event.target === drag.node && event.pointerId === drag.pointerId) cancelDrag();
  });
  window.addEventListener('blur', () => cancelDrag('Move cancelled because the window lost focus. Nothing changed.'));
  // Scrolling moves the page under the fixed Before and After choices.
  window.addEventListener('scroll', () => { if (modes.dragging()) hideChoices(); refreshDrag(); }, { passive: true });
  window.addEventListener('resize', refreshDrag);
  window.addEventListener('storage', updateEditBar);

  // Capture phase, so the destination's own handlers never see the click.
  document.addEventListener('click', guardActivation, true);
  document.addEventListener('auxclick', guardActivation, true);
  document.addEventListener('dragstart', event => {
    if (modes.inEditMode() && event.target instanceof Node && app.contains(event.target)) event.preventDefault();
  });
  const editBarButtons = () => {
    editToggle().addEventListener('click', () => setEditMode(!modes.inEditMode()));
    editUndo().addEventListener('click', undoDrag);
    /** @type {HTMLElement} */ (document.querySelector('#edit-done')).addEventListener('click', () => {
      setEditMode(false);
      editToggle().focus();
    });
    /** @type {HTMLElement} */ (document.querySelector('#edit-open-editor')).addEventListener('click', () => {
      openMenu();
      openEditorPage();
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', editBarButtons);
  else editBarButtons();
}
