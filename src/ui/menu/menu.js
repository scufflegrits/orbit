// The menu (2.2.1 menu.js): open and close, and the Help and About panels.
// Whether the menu is open belongs to the mode store; app.js's mode subscriber
// shows or hides the overlay and calls menuHidden(). Moved in rewrite phase 6a.
import { element } from '../dom.js';
import { restoreEditorOrigin, setEditorTree } from '../editor/kit.js';
import { modes } from '../page-modes.js';
import { APP_VERSION, menuContent, menuOverlay, menuRoot, setMenuContent, settingsTrigger } from '../page.js';
import { clearAnimationHint, showSettingsPanel } from './settings.js';

/** The element that opened the menu, to refocus when it closes. @type {HTMLElement | null} */
let menuOpener = null;


export function closeMenu() {
  if (!modes.menuOpen()) return;
  modes.send('closeOverlay');
}

/**
 * Called only by the mode subscriber, when the menu has closed for any
 * reason (Close, the scrim, Escape, or a page change).
 */
export function menuHidden() {
  clearAnimationHint();
  /** @type {HTMLElement} */ (menuOverlay.querySelector('.menu-sheet')).classList.remove('editor-page-mode');
  /** @type {HTMLElement} */ (menuOverlay.querySelector('.menu-top h2')).textContent = 'Explore the menu';
  setMenuContent(menuRoot);
  setEditorTree(null);
  // Return focus to whatever opened the menu so keyboard users keep their place.
  const target = menuOpener && document.contains(menuOpener) ? menuOpener : settingsTrigger;
  menuOpener = null;
  if (!restoreEditorOrigin()) target.focus();
}

export function openMenu() {
  // Opening the menu also drops a pressed or dragged item.
  modes.send('openMenu');
  if (!modes.menuOpen()) return;
  menuOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  setMenuContent(menuRoot);
  menuContent.replaceChildren();
  for (const option of document.querySelectorAll('[data-menu-panel]')) option.classList.remove('active');
  /** @type {HTMLElement} */ (document.querySelector('[data-menu-panel]')).focus();
}

export function openSettings() {
  openMenu();
  if (modes.menuOpen()) showMenuPanel('Settings');
}

/** @param {string} name Settings, Help, or About. */
export function showMenuPanel(name) {
  modes.send('choosePanel');
  clearAnimationHint();
  menuContent.replaceChildren();
  for (const option of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-menu-panel]'))) {
    option.classList.toggle('active', option.dataset.menuPanel === name);
  }
  menuContent.append(element('h3', '', name));
  if (name === 'Settings') {
    showSettingsPanel();
  } else if (name === 'Help') {
    menuContent.append(element('p', '', 'The Help guide explains everything Orbit does, with a section for each part of Settings. It opens in a new tab.'));
    const guide = /** @type {HTMLAnchorElement} */ (element('a', 'editor-open help-guide-link', 'Open the Help guide'));
    guide.href = 'help.html';
    guide.target = '_blank';
    guide.rel = 'noopener';
    menuContent.append(guide);
    menuContent.append(element('h4', 'editor-section-title', 'Quick keys'));
    menuContent.append(element('p', '', 'Press / to jump to Quick find. Press Ctrl+K (Cmd+K on a Mac) for the command palette.'));
    menuContent.append(element('p', '', 'Tab moves through the page. Arrow keys move between suns, and between planets or moons; Enter opens the focused one.'));
    menuContent.append(element('p', '', 'Press E on a focused sun, planet, or moon to open its editor. Shift+click a planet to open it with all its moons.'));
    menuContent.append(element('p', '', 'Escape goes back one step at a time: it closes the menu, cancels a drag, turns Edit mode off, clears Quick find, then returns to the Galaxy.'));
  } else if (name === 'About') {
    menuContent.append(element('p', '', 'Orbit is a local link map that keeps your favorite destinations in a visual Galaxy.'));
    menuContent.append(element('p', '', 'Your link map runs on this computer, without an account or hosted service.'));
    menuContent.append(element('p', '', `Version ${APP_VERSION}`));
  }
}
