// The editor's building blocks (2.2.1 editor.js, editor-page.js): buttons,
// fields, the header with the removal undo, saving a change through the
// store, move controls, file import, and item export. Also the editor's
// screen state: the tree (set while the full-page editor is open) and the
// last link check's results. Moved in rewrite phase 6b.
import { destinationKey, pathsForKey } from '../../core/destination.js';
import * as mapOps from '../../core/map-ops.js';
import * as fileIo from '../../services/file-io.js';
import { store } from '../../state/page-store.js';
import { element } from '../dom.js';
import { modes } from '../page-modes.js';
import { nav } from './nav.js';
import { groups, menuContent, setStorageWarning, storageWarning } from '../page.js';

/**
 * The full-page editor's tree, or null when it isn't open.
 * @type {HTMLElement | null}
 */
export let editorTree = null;
/** @param {HTMLElement | null} tree */
export function setEditorTree(tree) { editorTree = tree; }

/** The last link check's results in this page session, by destination key. */
export const linkCheckResults = new Map();

/**
 * @param {any} label
 * @param {any} action
 * @param {any} [className]
 */
export function editorButton(label, action, className = 'editor-button') {
  const button = element('button', className, label);
  button.type = 'button';
  button.addEventListener('click', action);
  return button;
}

/**
 * @param {any} label
 * @param {any} value
 * @param {any} [type]
 */
export function editorField(label, value, type = 'text') {
  const wrapper = element('label', 'editor-field');
  wrapper.append(element('span', '', label));
  const input = /** @type {HTMLInputElement} */ (type === 'textarea' ? document.createElement('textarea') : document.createElement('input'));
  if (type !== 'textarea') input.type = type;
  input.value = value;
  wrapper.append(input);
  return { wrapper, input };
}

/**
 * @param {any} message
 */
export function editorError(message) {
  const previous = menuContent.querySelector('.editor-error');
  if (previous) previous.remove();
  menuContent.prepend(element('p', 'editor-error', message));
}

/** @type {string | null} */
let directEditorPath = null;
/** @type {(() => boolean) | null} */
let restoreFocus = null;

/** @param {number[]} indices @param {() => boolean} restore */
export function rememberEditorOrigin(indices, restore) {
  directEditorPath = indices.join(':');
  restoreFocus = restore;
}

export function restoreEditorOrigin() {
  const restore = restoreFocus;
  restoreFocus = null;
  directEditorPath = null;
  return restore?.() ?? false;
}

/**
 * @param {any} title
 * @param {any} back
 * @param {(number | null)[]} [path]
 */
export function editorHeader(title, back, path) {
  const direct = directEditorPath !== null && path?.join(':') === directEditorPath;
  if (!direct) directEditorPath = null;
  menuContent.replaceChildren();
  const header = element('div', 'editor-header');
  header.append(editorButton('← Back', direct ? () => modes.send('closeOverlay') : back, 'editor-back'));
  header.append(element('h3', '', title));
  menuContent.append(header);
  const undo = store.loadUndoRecord();
  if (undo) {
    const notice = element('div', 'editor-undo');
    notice.append(element('span', '', `Last removed: ${undo.label}`));
    notice.append(editorButton('Undo removal', undoRemoval));
    menuContent.append(notice);
  }
}

export function copyGroups() {
  return JSON.parse(JSON.stringify(groups));
}

/**
 * @param {any} nextGroups
 * @param {any} showNext
 * @param {any} [options]
 */
export function applyEditorChange(nextGroups, showNext, options = {}) {
  try {
    store.saveMap({ groups: nextGroups, ...(options.routines !== undefined ? { routines: options.routines } : {}),
      ...(options.rdpPresets !== undefined ? { rdpPresets: options.rdpPresets } : {}) },
    options.label || 'Edit links change', { undoRecord: options.undoRecord, clearUndo: options.clearUndo });
    store.clearWarning();
    setStorageWarning('');
    showNext();
    nav.renderEditorTree();
  } catch (error) {
    editorError(/** @type {any} */ (error).message);
  }
}

/**
 * @param {any} items
 * @param {any} index
 * @param {any} amount
 */
export function moveEntry(items, index, amount) {
  const target = index + amount;
  if (target < 0 || target >= items.length) return false;
  [items[index], items[target]] = [items[target], items[index]];
  return true;
}

/**
 * @param {any} actions
 * @param {any} index
 * @param {any} count
 * @param {any} onMove
 */
export function editorMoveControls(actions, index, count, onMove) {
  const up = editorButton('Move up', () => onMove(-1));
  up.disabled = index === 0;
  const down = editorButton('Move down', () => onMove(1));
  down.disabled = index === count - 1;
  actions.append(up, element('span', 'editor-position', `${index + 1} of ${count}`), down);
}

export function editorActions() {
  const actions = element('div', 'editor-actions');
  menuContent.append(actions);
  return actions;
}

/**
 * @param {any} onData
 */
export function selectJsonFile(onData) {
  fileIo.pickFile('.json,application/json', async file => {
    try {
      onData(await fileIo.readJsonFile(file));
    } catch (error) {
      editorError(`Import failed: ${/** @type {any} */ (error).message}`);
    }
  });
}

/**
 * @param {any} kind
 * @param {any} item
 */
export function exportItem(kind, item) {
  const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || kind;
  fileIo.downloadJson(mapOps.itemExport(kind, item), `orbit-${kind}-${slug}.json`);
}

/**
 * @param {any} path
 */
export function pathLabel(path) {
  const sun = groups[path[0]];
  const planet = sun?.links[path[1]];
  if (!planet) return '';
  return path.length === 3 ? `${sun.name} → ${planet.name} → ${planet.moons[path[2]]?.name}` : `${sun.name} → ${planet.name}`;
}

/**
 * @param {any} item
 * @param {any} path
 */
export function duplicateNote(item, path) {
  if (!item?.name) return null;
  const key = destinationKey(item);
  if (key === null) return null;
  const others = pathsForKey(groups, key).filter(other => other.join(':') !== path.join(':'));
  if (!others.length) return null;
  const where = others.slice(0, 3).map(other => pathLabel(other)).join('; ');
  return element('p', 'editor-note', `Also in ${where}${others.length > 3 ? `, and ${others.length - 3} more` : ''}. This is fine for a deliberate copy.`);
}

/**
 * @param {any} options
 */
export function moveTargetField(options) {
  const field = element('label', 'editor-field');
  field.append(element('span', '', 'Move to'));
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Move to');
  options.forEach((/** @type {[string, string]} */ [value, label]) => {
    const option = element('option', '', label);
    option.value = value;
    select.append(option);
  });
  field.append(select);
  menuContent.append(field);
  return select;
}

/**
 * @param {any} targetSelect
 * @param {any} siblingNames
 */
export function movePositionField(targetSelect, siblingNames) {
  const field = element('label', 'editor-field');
  field.append(element('span', '', 'Position'));
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Position');
  const refresh = () => {
    select.replaceChildren();
    const end = element('option', '', 'At the end');
    end.value = 'end';
    select.append(end);
    siblingNames(targetSelect.value).forEach((/** @type {any} */ name, /** @type {any} */ index) => {
      const option = element('option', '', `Before ${name}`);
      option.value = index;
      select.append(option);
    });
  };
  targetSelect.addEventListener('change', refresh);
  refresh();
  field.append(select);
  menuContent.append(field);
  return select;
}

/**
 * @param {any} text
 */
export function profileRows(text) {
  return text.split(/\r\n|\n|\r/).filter(Boolean);
}

/**
 * @param {any} path
 */
export function editPath(path) {
  if (path.length === 3) nav.showMoonEditor(path[0], path[1], path[2]);
  else nav.showPlanetEditor(path[0], path[1]);
}

/** Put back the last removed sun, planet, or moon (the header's Undo removal). */
export function undoRemoval() {
  try {
    if (!store.undoRemoval()) return editorError('There is no removal to undo.');
    nav.showSunList();
  } catch (error) {
    editorError(`Could not undo removal: ${/** @type {Error} */ (error).message}`);
  }
}
