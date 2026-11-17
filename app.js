const app = document.querySelector('#app');
const count = document.querySelector('#link-count');
const settingsTrigger = document.querySelector('#settings-trigger');
const topbarSearch = document.querySelector('#topbar-search');
const quickFind = document.querySelector('#quick-find');
const menuOverlay = document.querySelector('#menu-overlay');
const menuRoot = document.querySelector('#menu-content');
let menuContent = menuRoot;
const APP_VERSION = '1.7.0';
let groups = [];
const GALAXY_PLANETS = 5;
const SYSTEM_PLANETS = 8;
const VISIBLE_MOONS = 4;
const MAP_STORAGE_KEY = 'orbit:map:v1';
const UNDO_STORAGE_KEY = 'orbit:undo-removal:v1';
let animationsEnabled = readBooleanPreference('orbit:animations', true);
let alwaysShowMoons = readBooleanPreference('orbit:always-show-moons', false);
let activeTheme = readThemePreference();
let activeFontSize = readFontSizePreference();
let rdpLaunchMode = readRdpLaunchPreference();
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
  count.textContent = `${destinations} LINKS · ${groups.length} SUNS`;
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
    saveMap({ groups: next });
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
    groups = (browserMap || seedData).groups;
    activeMapSource = browserMap ? 'browser' : 'bundled';
    countDestinations();
    render();
  } catch (error) {
    app.className = 'error-view';
    app.replaceChildren(element('h1', '', 'Could not load your links.'));
    app.append(element('p', '', 'Run `python3 sync.py`, then open index.html. You can also use `python3 serve.py` for automatic updates on refresh.'));
    app.append(element('pre', '', String(error.message)));
  }
}

window.addEventListener('hashchange', () => { closeMenu(); render(); });
document.querySelector('.brand').addEventListener('click', event => {
  event.preventDefault();
  findQuery = '';
  quickFind.value = '';
  if (location.hash && location.hash !== '#') location.hash = '';
  else render();
});
settingsTrigger.addEventListener('click', openMenu);
document.querySelector('#menu-close').addEventListener('click', closeMenu);
document.querySelector('#menu-scrim').addEventListener('click', closeMenu);
for (const option of document.querySelectorAll('[data-menu-panel]')) {
  option.addEventListener('click', () => showMenuPanel(option.dataset.menuPanel));
}
init();
