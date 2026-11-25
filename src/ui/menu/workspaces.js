// Workspaces on screen (2.2.1 workspaces.js): the top-bar switch, and the
// list in Settings with switch, rename, remove, and add. The list, keys, and
// saving are state/workspaces.js and the store. Moved in rewrite phase 6b.
import * as workspaces from '../../state/workspaces.js';
import { activeWorkspace, store } from '../../state/page-store.js';
import { confirmed } from '../dialogs/confirm.js';
import { element } from '../dom.js';
import { editorButton, editorError, editorField } from '../editor/kit.js';
import { hooks } from '../hooks.js';
import { showBackupReminder } from '../notices/backup.js';
import { offerDueRoutines } from '../notices/routine-offer.js';
import { modes } from '../page-modes.js';
import { groups } from '../page.js';

/**
 * @param {any} base
 * @param {any} [id]
 */
export function workspaceKey(base, id = activeWorkspace()) { return workspaces.workspaceKey(base, id); }

/**
 * @param {any} [id]
 */
export function workspaceName(id = activeWorkspace()) { return workspaces.workspaceName(id); }

/**
 * @param {any} id
 */
export function switchWorkspace(id) {
  if (!workspaces.loadWorkspaces().some(item => item.id === id)) return;
  // A workspace switch drops a pressed or dragged item.
  modes.send('switchWorkspace');
  // The store loads the workspace's map; its subscriber copies it but leaves
  // the redraw to this function.
  if (!store.switchWorkspace(id)) return;
  updateWorkspaceSwitch();
  // A System from another workspace does not exist here.
  if (location.hash && location.hash !== '#' && !groups.some(sun => location.hash.includes(encodeURIComponent(sun.id)))) {
    location.hash = '';
  } else {
    hooks.render();
  }
  offerDueRoutines();
  showBackupReminder();
}

/**
 * @param {any} name
 * @param {any} start
 */
export function addWorkspace(name, start) { return store.addWorkspace(name, start); }

/**
 * @param {any} id
 * @param {any} name
 */
export function renameWorkspace(id, name) {
  workspaces.renameWorkspace(id, name);
  updateWorkspaceSwitch();
}

/**
 * @param {any} id
 */
export function removeWorkspace(id) {
  if (id === 'main') return;
  if (store.removeWorkspace(id)) switchWorkspace('main');
  else updateWorkspaceSwitch();
}

export function updateWorkspaceSwitch() {
  let select = /** @type {HTMLSelectElement | null} */ (document.querySelector('#workspace-switch'));
  const list = workspaces.loadWorkspaces();
  if (list.length < 2) {
    select?.remove();
    return;
  }
  if (!select) {
    select = document.createElement('select');
    select.id = 'workspace-switch';
    select.className = 'workspace-switch';
    select.setAttribute('aria-label', 'Workspace');
    select.title = 'Switch workspace';
    const created = select;
    created.addEventListener('change', () => switchWorkspace(created.value));
    /** @type {HTMLElement} */ (document.querySelector('.topbar-right')).prepend(created);
  }
  select.replaceChildren(...list.map(item => {
    const option = element('option', '', item.name);
    option.value = item.id;
    return option;
  }));
  select.value = activeWorkspace();
}

export function workspaceSettings() {
  const section = element('div', 'team-settings workspace-settings');
  section.append(element('strong', '', 'Workspaces'));
  section.append(element('p', 'workspace-hint', 'Separate maps, such as Work and Home, each with their own suns, favorites, routines, and history. The team map and these settings are shared.'));
  const list = workspaces.loadWorkspaces();
  list.forEach(item => {
    const row = element('div', 'editor-list-row workspace-row');
    row.append(element('span', '', `${item.name}${workspaces.defaultWorkspace(item.id) ? ' (default)' : ''}${item.id === activeWorkspace() ? ' (open)' : ''}`));
    if (item.id !== activeWorkspace()) row.append(editorButton('Switch', () => { switchWorkspace(item.id); hooks.showMenuPanel('Settings'); }));
    row.append(editorButton('Rename', () => {
      const name = window.prompt('New name for this workspace', item.name);
      if (name === null) return;
      try { renameWorkspace(item.id, name); hooks.showMenuPanel('Settings'); } catch (error) { editorError(/** @type {any} */ (error).message); }
    }));
    if (item.id !== 'main') {
      row.append(editorButton('Remove', () => {
        const message = workspaces.defaultWorkspace(item.id)
          ? `Remove the ${item.name} workspace? Your edits to it in this browser are deleted, so export it first to keep them. It's one of Orbit's default workspaces, so you can add it back from Add workspace, starting from its default links.`
          : `Remove the ${item.name} workspace and its map? Export it first if you want a copy.`;
        if (!confirmed(message)) return;
        removeWorkspace(item.id);
        hooks.showMenuPanel('Settings');
      }, 'editor-danger'));
    }
    section.append(row);
  });
  const form = element('form', 'workspace-add');
  const name = editorField('New workspace', '');
  name.input.setAttribute('aria-label', 'New workspace name');
  name.input.placeholder = 'For example: Home';
  const start = document.createElement('select');
  start.setAttribute('aria-label', 'Start the new workspace with');
  for (const [value, label] of [['empty', 'An empty map'], ['copy', 'A copy of this workspace'], ['bundled', "Main's default map"]]) {
    const option = element('option', '', label);
    option.value = value;
    start.append(option);
  }
  for (const item of workspaces.defaultWorkspaces()) {
    if (!workspaces.removedDefaultIds().has(item.id)) continue;
    const option = element('option', '', `${item.name} (default)`);
    option.value = `default:${item.id}`;
    start.append(option);
  }
  start.addEventListener('change', () => {
    const selected = start.value.startsWith('default:')
      ? workspaces.defaultWorkspace(start.value.slice('default:'.length)) : null;
    name.input.readOnly = Boolean(selected);
    if (selected) name.input.value = selected.name;
  });
  const add = element('button', 'editor-button', 'Add workspace');
  add.type = 'submit';
  form.append(name.wrapper, start, add);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const id = addWorkspace(name.input.value, start.value);
      switchWorkspace(id);
      hooks.showMenuPanel('Settings');
    } catch (error) {
      editorError(/** @type {any} */ (error).message);
    }
  });
  section.append(form);
  return section;
}
