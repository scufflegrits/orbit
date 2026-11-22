const app = document.querySelector('#app');
const count = document.querySelector('#link-count');
const settingsTrigger = document.querySelector('#settings-trigger');
const topbarSearch = document.querySelector('#topbar-search');
const quickFind = document.querySelector('#quick-find');
const menuOverlay = document.querySelector('#menu-overlay');
const menuRoot = document.querySelector('#menu-content');
const viewToggle = document.querySelector('#view-toggle');
let menuContent = menuRoot;
// The version lives in src/app/version.js and reaches the old scripts through the bridge.
const APP_VERSION = window.OrbitNext.version;
let groups = [];
// Named link lists saved with the map (see routines.js).
let routines = [];
// Counts every change to the in-memory map; a drag or drag Undo made against
// an older revision is refused.
let mapRevision = 0;
// Storage keys of the active workspace; Main keeps the original keys.
let MAP_STORAGE_KEY = workspaceKey('orbit:map:v1');
let UNDO_STORAGE_KEY = workspaceKey('orbit:undo-removal:v1');
let HISTORY_STORAGE_KEY = workspaceKey('orbit:history:v1');
// Named Remote Desktop settings saved with the map (see presets.js).
let rdpPresets = [];
let animationsEnabled = readBooleanPreference('orbit:animations', true);
let alwaysShowMoons = readBooleanPreference('orbit:always-show-moons', false);
let activeTheme = readThemePreference();
let activeFontSize = readFontSizePreference();
let rdpLaunchMode = readRdpLaunchPreference();
let showQuickBar = readBooleanPreference('orbit:quick-bar', true);
let showSiteIcons = readBooleanPreference('orbit:site-icons', false);
let galaxyView = readGalaxyViewPreference();
let seedData = null;
let storageWarning = '';
// Quick find's text. Whether Quick find is empty or filtering belongs to
// src/ui/mode-store.js; setFindQuery() keeps the two together.
let findQuery = '';
let activeMapSource = 'bundled';
document.documentElement.dataset.animations = animationsEnabled ? 'on' : 'off';
document.documentElement.dataset.moons = alwaysShowMoons ? 'always' : 'hover';
document.documentElement.dataset.theme = activeTheme;
document.documentElement.dataset.fontSize = activeFontSize;

function countDestinations() {
  const destinations = groups.reduce((total, group) => total + group.links.reduce(
    (sum, link) => sum + 1 + link.moons.length, 0), 0);
  count.textContent = `${counted(destinations, 'link')} · ${counted(groups.length, 'sun')}`.toUpperCase();
}

// The Galaxy as orbits or as a list; the System view is the same in both.
function setGalaxyView(view) {
  galaxyView = view === 'list' ? 'list' : 'orbits';
  savePreference('orbit:galaxy-view', galaxyView);
  updateViewToggle();
  if (location.hash && location.hash !== '#') location.hash = '';
  else render();
}

function updateViewToggle() {
  const list = galaxyView === 'list';
  viewToggle.setAttribute('aria-pressed', String(list));
  viewToggle.title = list ? 'Show the Galaxy as orbits' : 'Show the Galaxy as a list';
  viewToggle.setAttribute('aria-label', viewToggle.title);
  viewToggle.textContent = list ? '◎' : '☰';
}

function dataSourceLabel() {
  return activeMapSource === 'browser' ? 'Browser edits' : 'Bundled project data';
}

// The store (src/state/store.js) is the only writer of the map since rewrite
// phase 3. This subscriber copies its state into the old globals the other
// scripts still read, then redraws, exactly once per change.
const orbitStore = window.OrbitNext.store;
orbitStore.subscribe((state, kind) => {
  groups = state.groups;
  routines = state.routines;
  rdpPresets = state.rdpPresets;
  mapRevision = state.revision;
  activeMapSource = state.source;
  storageWarning = state.warning;
  seedData = state.seed;
  activeWorkspace = state.workspace;
  MAP_STORAGE_KEY = workspaceKey('orbit:map:v1');
  UNDO_STORAGE_KEY = workspaceKey('orbit:undo-removal:v1');
  HISTORY_STORAGE_KEY = workspaceKey('orbit:history:v1');
  countDestinations();
  // A workspace switch redraws itself after deciding whether to leave the System.
  if (kind !== 'switch') render();
});

function setFindQuery(text) {
  findQuery = text;
  orbitModes.send(text ? 'type' : 'clearFind');
}

// The interaction modes (src/ui/mode-store.js) are owned by the store since
// rewrite phase 4b. This is the one place that shows them: a held item is
// tidied away, overlays are shown or removed, and Edit mode is shown,
// exactly once per change.
orbitModes.subscribe((next, previous, event) => {
  const held = state => state.mode === 'pressed' || state.mode === 'dragging';
  if (held(previous) && !held(next)) gestureEnded(previous.mode === 'dragging', event);
  if (previous.overlay !== next.overlay) {
    const menu = state => ['menu', 'menuPanel', 'menuEditor'].includes(state.overlay);
    if (previous.overlay === 'palette') paletteClosed();
    if (previous.overlay === 'placeholder') variableFormClosed();
    if (menu(previous) !== menu(next)) {
      menuOverlay.hidden = !menu(next);
      if (!menu(next)) menuHidden();
    }
    if (next.overlay === 'palette') paletteOpened();
    if (next.overlay === 'placeholder') variableFormOpened();
  }
  const editing = state => state.mode !== 'browsing';
  if (editing(previous) !== editing(next)) showEditMode(editing(next));
});

function undoRemoval() {
  try {
    if (!orbitStore.undoRemoval()) return editorError('There is no removal to undo.');
    showSunList();
  } catch (error) {
    editorError(`Could not undo removal: ${error.message}`);
  }
}

async function init() {
  try {
    // window.ORBIT_DATA or links.json, validated (src/services/sources.js, rewrite phase 4).
    const seed = await window.OrbitNext.services.sources.loadBundledMap();
    await loadTeamMap();
    // Loads the workspace's map; the subscriber above copies it and renders.
    orbitStore.start({ seed, team: teamGroups });
    offerDueRoutines();
    checkTeamUpdates();
    showBackupReminder();
  } catch (error) {
    orbitModes.send('loadFailed');
    app.className = 'error-view';
    app.replaceChildren(element('h1', '', 'Could not load your links.'));
    app.append(element('p', '', 'Run `python3 sync.py`, then open index.html. You can also use `python3 serve.py` for automatic updates on refresh.'));
    app.append(element('pre', '', String(error.message)));
  }
}

// A page change drops a held item and closes the menu, not the palette or placeholder form.
window.addEventListener('hashchange', () => { orbitModes.send('pageChange'); render(); });
document.querySelector('.brand').addEventListener('click', event => {
  event.preventDefault();
  quickFind.value = '';
  setFindQuery('');
  if (location.hash && location.hash !== '#') location.hash = '';
  else render();
});
settingsTrigger.addEventListener('click', openMenu);
viewToggle.addEventListener('click', () => setGalaxyView(galaxyView === 'list' ? 'orbits' : 'list'));
document.querySelector('#menu-close').addEventListener('click', closeMenu);
document.querySelector('#menu-scrim').addEventListener('click', closeMenu);
for (const option of document.querySelectorAll('[data-menu-panel]')) {
  option.addEventListener('click', () => showMenuPanel(option.dataset.menuPanel));
}
updateViewToggle();
updateWorkspaceSwitch();
init();
