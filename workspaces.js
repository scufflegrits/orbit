// Workspaces (separate personal maps such as Work and Home) and backup
// reminders. Loaded as a classic script after variables.js and before app.js,
// which takes its storage keys from workspaceKey().

const WORKSPACES_KEY = 'orbit:workspaces:v1';
const ACTIVE_WORKSPACE_KEY = 'orbit:workspace';
const BACKUP_KEY = 'orbit:backup:v1';
const BACKUP_CHANGES = 20;
const BACKUP_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function loadWorkspaces() {
  try {
    const list = JSON.parse(localStorage.getItem(WORKSPACES_KEY) || '[]');
    const valid = Array.isArray(list) ? list.filter(item => item && typeof item.id === 'string' && item.name) : [];
    return valid.some(item => item.id === 'main') ? valid : [{ id: 'main', name: 'Main' }, ...valid];
  } catch {
    return [{ id: 'main', name: 'Main' }];
  }
}

function saveWorkspaces(list) {
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify(list));
}

function readActiveWorkspace() {
  try {
    const id = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    return id && loadWorkspaces().some(item => item.id === id) ? id : 'main';
  } catch {
    return 'main';
  }
}

let activeWorkspace = readActiveWorkspace();

// Main keeps the original keys, so maps saved before workspaces stay put.
function workspaceKey(base, id = activeWorkspace) {
  return id === 'main' ? base : `${base}:${id}`;
}

function workspaceName(id = activeWorkspace) {
  return loadWorkspaces().find(item => item.id === id)?.name || 'Main';
}

function switchWorkspace(id) {
  if (!loadWorkspaces().some(item => item.id === id)) return;
  cancelDrag();
  activeWorkspace = id;
  savePreference(ACTIVE_WORKSPACE_KEY, id);
  MAP_STORAGE_KEY = workspaceKey('orbit:map:v1');
  UNDO_STORAGE_KEY = workspaceKey('orbit:undo-removal:v1');
  HISTORY_STORAGE_KEY = workspaceKey('orbit:history:v1');
  storageWarning = '';
  const browserMap = loadBrowserMap();
  const start = browserMap || (id === 'main' ? seedData : { groups: [] });
  groups = [...visibleTeamGroups(), ...start.groups];
  routines = start.routines || [];
  rdpPresets = start.rdpPresets || [];
  activeMapSource = browserMap ? 'browser' : id === 'main' ? 'bundled' : 'browser';
  mapRevision++;
  countDestinations();
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
function addWorkspace(name, start) {
  const list = loadWorkspaces();
  const clean = String(name || '').trim();
  if (!clean || clean.length > 40) throw new Error('A workspace needs a name of up to 40 characters.');
  if (list.some(item => item.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
    throw new Error(`There is already a workspace named ${clean}.`);
  }
  const id = uniqueSunId(clean, new Set(list.map(item => item.id)));
  const map = start === 'copy'
    ? { groups: personalGroups(groups), routines, rdpPresets }
    : start === 'bundled' ? seedData : { groups: [] };
  localStorage.setItem(workspaceKey('orbit:map:v1', id), JSON.stringify(validateMap(map)));
  saveWorkspaces([...list, { id, name: clean }]);
  return id;
}

function renameWorkspace(id, name) {
  const clean = String(name || '').trim();
  const list = loadWorkspaces();
  if (!clean || clean.length > 40) throw new Error('A workspace needs a name of up to 40 characters.');
  if (list.some(item => item.id !== id && item.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
    throw new Error(`There is already a workspace named ${clean}.`);
  }
  saveWorkspaces(list.map(item => item.id === id ? { ...item, name: clean } : item));
  updateWorkspaceSwitch();
}

function removeWorkspace(id) {
  if (id === 'main') return;
  for (const base of ['orbit:map:v1', 'orbit:undo-removal:v1', 'orbit:history:v1']) {
    localStorage.removeItem(workspaceKey(base, id));
  }
  const backups = readBackupState();
  delete backups[id];
  writeBackupState(backups);
  saveWorkspaces(loadWorkspaces().filter(item => item.id !== id));
  if (activeWorkspace === id) switchWorkspace('main');
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

function readBackupState() {
  try {
    const value = JSON.parse(localStorage.getItem(BACKUP_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeBackupState(state) {
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify(state)); } catch { /* Storage may be unavailable. */ }
}

function countChangeForBackup() {
  const state = readBackupState();
  const entry = state[activeWorkspace] || {};
  entry.changes = (entry.changes || 0) + 1;
  entry.since = entry.since || entry.lastExport || Date.now();
  state[activeWorkspace] = entry;
  writeBackupState(state);
}

function noteBackupMade() {
  const state = readBackupState();
  state[activeWorkspace] = { changes: 0, lastExport: Date.now() };
  writeBackupState(state);
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
