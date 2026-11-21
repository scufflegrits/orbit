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
const GALAXY_PLANETS = 5;
const SYSTEM_PLANETS = 8;
const VISIBLE_MOONS = 6;
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

function undoRemoval() {
  const record = loadUndoRecord();
  if (!record) return editorError('There is no removal to undo.');
  try {
    const next = copyGroups();
    if (record.kind === 'sun') {
      if (next.some(sun => sun.id === record.item.id)) {
        record.item.id = uniqueSunId(record.item.name, new Set(next.map(sun => sun.id)));
      }
      next.splice(Math.min(record.index, next.length), 0, record.item);
    } else {
      const sun = next.find(item => item.id === record.sunId);
      if (!sun) throw new Error('The parent sun no longer exists.');
      if (record.kind === 'planet') {
        sun.links.splice(Math.min(record.index, sun.links.length), 0, record.item);
      } else {
        const matching = sun.links.find(planet =>
          planet.url === record.planetUrl && planet.host === record.planetHost &&
          planet.name === record.planetName);
        const planet = matching || sun.links[record.planetIndex];
        if (!planet) throw new Error('The parent planet no longer exists.');
        planet.moons.splice(Math.min(record.index, planet.moons.length), 0, record.item);
      }
    }
    saveMap({ groups: next }, `Undid removal of ${record.label}`);
    localStorage.removeItem(UNDO_STORAGE_KEY);
    showSunList();
  } catch (error) {
    editorError(`Could not undo removal: ${error.message}`);
  }
}

async function init() {
  try {
    let data;
    if (location.protocol === 'file:') {
      data = window.ORBIT_DATA;
    } else {
      const response = await fetch('./links.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    }
    if (!data) throw new Error('Run `python3 sync.py` to generate links-data.js.');
    seedData = validateMap(data);
    const browserMap = loadBrowserMap();
    await loadTeamMap();
    const startMap = browserMap || (activeWorkspace === 'main' ? seedData : { groups: [] });
    groups = [...visibleTeamGroups(), ...startMap.groups];
    routines = startMap.routines || [];
    rdpPresets = startMap.rdpPresets || [];
    activeMapSource = browserMap ? 'browser' : 'bundled';
    countDestinations();
    render();
    offerDueRoutines();
    checkTeamUpdates();
    showBackupReminder();
  } catch (error) {
    app.className = 'error-view';
    app.replaceChildren(element('h1', '', 'Could not load your links.'));
    app.append(element('p', '', 'Run `python3 sync.py`, then open index.html. You can also use `python3 serve.py` for automatic updates on refresh.'));
    app.append(element('pre', '', String(error.message)));
  }
}

window.addEventListener('hashchange', () => { cancelDrag(); closeMenu(); render(); });
document.querySelector('.brand').addEventListener('click', event => {
  event.preventDefault();
  findQuery = '';
  quickFind.value = '';
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
