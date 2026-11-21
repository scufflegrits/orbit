// Workspaces (separate personal maps such as Work and Home) and backup
// reminders. Loaded as a classic script after variables.js and before app.js,
// which takes its storage keys from workspaceKey().

const BACKUP_CHANGES = 20;
const BACKUP_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

// The list and keys moved to src/state/workspaces.js, and switching, adding,
// and removing to the store, in rewrite phase 3. These keep the screen parts.
const stateWorkspaces = () => window.OrbitNext.state.workspaces;

function loadWorkspaces() { return stateWorkspaces().loadWorkspaces(); }
function saveWorkspaces(list) { stateWorkspaces().saveWorkspaces(list); }
function readActiveWorkspace() { return stateWorkspaces().readActiveWorkspace(); }

// Set from the store by the subscriber in app.js.
let activeWorkspace = readActiveWorkspace();

// Main keeps the original keys, so maps saved before workspaces stay put.
function workspaceKey(base, id = activeWorkspace) { return stateWorkspaces().workspaceKey(base, id); }
function workspaceName(id = activeWorkspace) { return stateWorkspaces().workspaceName(id); }

function switchWorkspace(id) {
  if (!loadWorkspaces().some(item => item.id === id)) return;
  cancelDrag();
  // The store loads the workspace's map; its subscriber copies it but leaves
  // the redraw to this function.
  if (!window.OrbitNext.store.switchWorkspace(id)) return;
  updateWorkspaceSwitch();
  // A System from another workspace does not exist here.
  if (location.hash && location.hash !== '#' && !groups.some(sun => location.hash.includes(encodeURIComponent(sun.id)))) {
    location.hash = '';
  } else {
    render();
  }
  offerDueRoutines();
  showBackupReminder();
}

// start: 'empty', 'copy' (this workspace), or 'bundled'.
function addWorkspace(name, start) { return window.OrbitNext.store.addWorkspace(name, start); }

function renameWorkspace(id, name) {
  stateWorkspaces().renameWorkspace(id, name);
  updateWorkspaceSwitch();
}

function removeWorkspace(id) {
  if (id === 'main') return;
  if (window.OrbitNext.store.removeWorkspace(id)) switchWorkspace('main');
  else updateWorkspaceSwitch();
}

// The top-bar menu appears once there is more than one workspace.
function updateWorkspaceSwitch() {
  let select = document.querySelector('#workspace-switch');
  const list = loadWorkspaces();
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
    select.addEventListener('change', () => switchWorkspace(select.value));
    document.querySelector('.topbar-right').prepend(select);
  }
  select.replaceChildren(...list.map(item => {
    const option = element('option', '', item.name);
    option.value = item.id;
    return option;
  }));
  select.value = activeWorkspace;
}

function workspaceSettings() {
  const section = element('div', 'team-settings workspace-settings');
  section.append(element('strong', '', 'Workspaces'));
  section.append(element('p', 'workspace-hint', 'Separate maps, such as Work and Home, each with their own suns, favorites, routines, and history. The team map and these settings are shared.'));
  const list = loadWorkspaces();
  list.forEach(item => {
    const row = element('div', 'editor-list-row workspace-row');
    row.append(element('span', '', `${item.name}${item.id === activeWorkspace ? ' (open)' : ''}`));
    if (item.id !== activeWorkspace) row.append(editorButton('Switch', () => { switchWorkspace(item.id); showMenuPanel('Settings'); }));
    row.append(editorButton('Rename', () => {
      const name = window.prompt('New name for this workspace', item.name);
      if (name === null) return;
      try { renameWorkspace(item.id, name); showMenuPanel('Settings'); } catch (error) { editorError(error.message); }
    }));
    if (item.id !== 'main') {
      row.append(editorButton('Remove', () => {
        if (!window.confirm(`Remove the ${item.name} workspace and its map? Export it first if you want a copy.`)) return;
        removeWorkspace(item.id);
        showMenuPanel('Settings');
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
  for (const [value, label] of [['empty', 'An empty map'], ['copy', 'A copy of this workspace'], ['bundled', 'The sample map']]) {
    const option = element('option', '', label);
    option.value = value;
    start.append(option);
  }
  const add = element('button', 'editor-button', 'Add workspace');
  add.type = 'submit';
  form.append(name.wrapper, start, add);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const id = addWorkspace(name.input.value, start.value);
      switchWorkspace(id);
      showMenuPanel('Settings');
    } catch (error) {
      editorError(error.message);
    }
  });
  section.append(form);
  return section;
}

// ---- Backup reminders ---------------------------------------------------------

// Backup bookkeeping moved to src/state/backup.js in rewrite phase 3.
function readBackupState() { return window.OrbitNext.state.backup.readBackupState(); }
function writeBackupState(state) { window.OrbitNext.state.backup.writeBackupState(state); }

function noteBackupMade() {
  window.OrbitNext.state.backup.noteBackupMade(activeWorkspace);
  document.querySelector('#backup-reminder')?.remove();
}

function backupDue(now = Date.now()) {
  if (!readBooleanPreference('orbit:backup-reminders', true)) return null;
  const entry = readBackupState()[activeWorkspace];
  if (!entry?.changes || (entry.snoozeUntil && now < entry.snoozeUntil)) return null;
  const days = Math.floor((now - (entry.since || now)) / DAY_MS);
  return entry.changes >= BACKUP_CHANGES || days >= BACKUP_DAYS ? { changes: entry.changes, days } : null;
}

function backupReminder(due) {
  const box = element('div', 'routine-offer backup-reminder');
  const where = loadWorkspaces().length > 1 ? ` in ${workspaceName()}` : '';
  box.append(element('p', 'routine-offer-copy', `Back up your map${where}: ${counted(due.changes, 'change')} since your last export${due.days ? `, ${counted(due.days, 'day')} ago` : ''}.`));
  const save = element('button', 'routine-offer-open', 'Back up now');
  save.type = 'button';
  save.addEventListener('click', () => {
    exportMap();
    box.remove();
  });
  const later = element('button', 'routine-offer-dismiss', 'Remind me later');
  later.type = 'button';
  later.addEventListener('click', () => {
    const state = readBackupState();
    state[activeWorkspace] = { ...state[activeWorkspace], snoozeUntil: Date.now() + 3 * DAY_MS };
    writeBackupState(state);
    document.querySelector('#backup-reminder')?.remove();
    box.remove();
  });
  box.append(save, later);
  return box;
}

function showBackupReminder() {
  document.querySelector('#backup-reminder')?.remove();
  const due = backupDue();
  if (!due) return;
  const box = backupReminder(due);
  box.id = 'backup-reminder';
  noticeArea().append(box);
}
