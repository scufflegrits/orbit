// The page's shared screen state (2.2.1 app.js globals), one owner each:
// the page's fixed elements, the map as last shown (copied from the store
// by app/start.js's subscriber, exactly once per change), the display
// preferences, and Quick find's text. Screens import these as live bindings;
// only the setters here change them. Moved in rewrite phase 8.
import { readAnimationLevel, readBackground, readBoolean, readButtonTips, readFontFamily, readParticles, readFontSize, readGalaxyView, readRdpLaunch, readTheme, savePreference } from '../state/prefs.js';
import { hooks } from './hooks.js';
import { icon } from './icons.js';
import { modes } from './page-modes.js';

/** Set by main.js from app/version.js (ui/ can't import app/). */
export let APP_VERSION = '';
/** @param {string} version */
export function setVersion(version) { APP_VERSION = version; }

// ---- Fixed elements, found once the page has loaded ---------------------

export let app = /** @type {HTMLElement} */ (/** @type {unknown} */ (null));
export let quickFind = /** @type {HTMLInputElement} */ (/** @type {unknown} */ (null));
export let settingsTrigger = /** @type {HTMLElement} */ (/** @type {unknown} */ (null));
export let topbarSearch = /** @type {HTMLElement} */ (/** @type {unknown} */ (null));
export let menuOverlay = /** @type {HTMLElement} */ (/** @type {unknown} */ (null));
export let menuRoot = /** @type {HTMLElement} */ (/** @type {unknown} */ (null));
export let viewToggle = /** @type {HTMLElement} */ (/** @type {unknown} */ (null));
export let linkCount = /** @type {HTMLElement} */ (/** @type {unknown} */ (null));
/** Where the menu's panels and the editor draw: the menu itself, or the editor's pane. */
export let menuContent = /** @type {HTMLElement} */ (/** @type {unknown} */ (null));
/** @param {HTMLElement} node */
export function setMenuContent(node) { menuContent = node; }

/** @param {string} selector */
const find = selector => /** @type {HTMLElement} */ (document.querySelector(selector));

/** Find the page's fixed elements. Called once, when the page has loaded. */
export function findPageElements() {
  app = find('#app');
  linkCount = find('#link-count');
  settingsTrigger = find('#settings-trigger');
  topbarSearch = find('#topbar-search');
  quickFind = /** @type {HTMLInputElement} */ (find('#quick-find'));
  menuOverlay = find('#menu-overlay');
  menuRoot = find('#menu-content');
  viewToggle = find('#view-toggle');
  menuContent = menuRoot;
}

// ---- The map as shown -----------------------------------------------------

/** @type {any[]} */
export let groups = [];
/** @type {any[]} */
export let routines = [];
/** @type {any[]} */
export let rdpPresets = [];
export let storageWarning = '';
export let activeMapSource = 'bundled';

/**
 * Copy the store's state for the screens (the store subscriber in app/start.js).
 * @param {{groups: any[], routines: any[], rdpPresets: any[], source: string, warning: string}} state
 */
export function showStoreState(state) {
  groups = state.groups;
  routines = state.routines;
  rdpPresets = state.rdpPresets;
  activeMapSource = state.source;
  storageWarning = state.warning;
}

/** @param {string} text */
export function setStorageWarning(text) { storageWarning = text; }

export function dataSourceLabel() {
  return activeMapSource === 'browser' ? 'Browser edits' : 'Bundled project data';
}

// ---- Display preferences (read when the page loads) ----------------------

/** @type {import('../state/prefs.js').AnimationLevel} */
export let animationLevel = 'full';
export let animationsEnabled = true;
export let alwaysShowMoons = false;
/** @type {'normal'|'slow'|'off'} */
export let buttonTips = 'normal';
export let showEditButtons = true;
export let activeTheme = 'default';
export let activeFontSize = 'standard';
/** @type {'inter' | 'classic'} */
export let activeFontFamily = 'inter';
/** @type {'none' | 'constellations'} */
export let backgroundMode = 'none';
/** @type {'subtle' | 'normal' | 'bold'} */
export let particleStrength = 'normal';
/** @type {'download'|'client'} */
export let rdpLaunchMode = 'download';
export let showQuickBar = true;
export let showSiteIcons = false;
/** @type {'orbits'|'list'} */
export let galaxyView = 'orbits';

/** Read the saved preferences and show the ones set on the page's root. */
export function readPreferences() {
  applyAnimationLevel(readAnimationLevel());
  alwaysShowMoons = readBoolean('orbit:always-show-moons', false);
  activeTheme = readTheme();
  buttonTips = readButtonTips();
  showEditButtons = readBoolean('orbit:edit-buttons', true);
  activeFontSize = readFontSize();
  activeFontFamily = /** @type {'inter' | 'classic'} */ (readFontFamily());
  backgroundMode = /** @type {'none' | 'constellations'} */ (readBackground());
  particleStrength = /** @type {'subtle' | 'normal' | 'bold'} */ (readParticles());
  rdpLaunchMode = readRdpLaunch();
  showQuickBar = readBoolean('orbit:quick-bar', true);
  showSiteIcons = readBoolean('orbit:site-icons', false);
  galaxyView = readGalaxyView();
  const root = document.documentElement.dataset;
  root.moons = alwaysShowMoons ? 'always' : 'hover';
  root.theme = activeTheme;
  root.fontSize = activeFontSize;
  root.fontFamily = activeFontFamily;
  root.background = backgroundMode;
  root.particles = particleStrength;
}

/** @param {import('../state/prefs.js').AnimationLevel} level */
export function applyAnimationLevel(level) {
  animationLevel = level;
  animationsEnabled = level !== 'off';
  const root = document.documentElement.dataset;
  root.animations = animationsEnabled ? 'on' : 'off';
  root.motion = level;
}
/** @param {boolean} on */
export function setAlwaysShowMoons(on) { alwaysShowMoons = on; }
/** @param {string} value */
export function setButtonTips(value) {
  buttonTips = value === 'slow' || value === 'off' ? value : 'normal';
  savePreference('orbit:button-tips', buttonTips);
}

/** @param {boolean} on */
export function setShowEditButtons(on) {
  showEditButtons = on;
  savePreference('orbit:edit-buttons', on);
}

/** @param {string} theme */
export function setActiveTheme(theme) { activeTheme = theme; }
/** @param {string} size */
export function setActiveFontSize(size) { activeFontSize = size; }
/** @param {'inter' | 'classic'} family */
export function setActiveFontFamily(family) { activeFontFamily = family; }
/** @param {'none' | 'constellations'} mode */
export function setBackgroundMode(mode) { backgroundMode = mode; }
/** @param {'subtle' | 'normal' | 'bold'} level */
export function setParticleStrength(level) { particleStrength = level; }
/** @param {'download'|'client'} mode */
export function setRdpLaunchMode(mode) { rdpLaunchMode = mode; }
/** @param {boolean} on */
export function setShowQuickBar(on) { showQuickBar = on; }
/** @param {boolean} on */
export function setShowSiteIcons(on) { showSiteIcons = on; }

export function updateViewToggle() {
  const list = galaxyView === 'list';
  viewToggle.setAttribute('aria-pressed', String(list));
  viewToggle.title = list ? 'Show the Galaxy as orbits' : 'Show the Galaxy as a list';
  viewToggle.setAttribute('aria-label', viewToggle.title);
  viewToggle.replaceChildren(icon(list ? 'orbit' : 'list'));
}

/**
 * The Galaxy as orbits or as a list; the System view is the same in both.
 * @param {string} view
 */
export function setGalaxyView(view) {
  galaxyView = view === 'list' ? 'list' : 'orbits';
  savePreference('orbit:galaxy-view', galaxyView);
  updateViewToggle();
  if (location.hash && location.hash !== '#') location.hash = '';
  else hooks.render();
}

// ---- Quick find -----------------------------------------------------------

/** Quick find's text. Whether it is empty or filtering belongs to the mode store; this keeps the two together. */
export let findQuery = '';
/** @param {string} text */
export function setFindQuery(text) {
  findQuery = text;
  modes.send(text ? 'type' : 'clearFind');
}
