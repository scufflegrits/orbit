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
    menuContent.append(element('p', '', 'Orbit includes a Dev Toolbox workspace. Remove it, or add it back, in Settings → Workspaces.'));
    menuContent.append(element('p', '', 'Explore your Galaxy. Hover over a sun to see its first five planets, then hover over a planet to reveal its moons.'));
    menuContent.append(element('p', '', 'Hover over a group planet or focus it with Tab to see its links. Click the group or press Enter to keep them open. Click elsewhere or press Escape to unpin it.'));
    menuContent.append(element('p', '', 'With Animations set to Full, the interface and Constellations move. In Calm, the Constellations background holds still but follows the pointer. Off stops animations and pointer effects. Your device’s reduced-motion setting keeps the background still and disables its pointer effects at every level.'));
    menuContent.append(element('p', '', 'Click a sun to open its System and find more planets. Web planets and moons open in a new tab.'));
    menuContent.append(element('p', '', 'Windows Remote Desktop entries download an .rdp file by default. After installing the Orbit Windows helper, choose Open mstsc.exe in Settings to open Remote Desktop Connection with the target loaded.'));
    menuContent.append(element('p', '', 'In Edit links, open a planet or moon and use Import .rdp file to keep a saved connection profile with that link. Save the link after importing.'));
    menuContent.append(element('p', '', 'Your browser may ask before opening the helper. Orbit does not store credentials.'));
    menuContent.append(element('p', '', 'Use Quick find to search any sun, planet, or moon. It matches names, the sun or planet a link sits in, web addresses and computer names, and small typos; every word must match. Short forms work too: “lab1 s3” finds lab1-server3. Type #tag (or tag:name) to show only links with that tag.'));
    menuContent.append(element('p', '', 'Press Ctrl+K (Cmd+K on a Mac) for the command palette: search links and commands, then press Enter to open the highlighted one straight away.'));
    menuContent.append(element('p', '', 'Routines, favorites, and recently opened links appear above the Galaxy. Star a link in Quick find results, or tick Favorite in Edit links; Open all opens every favorite at once.'));
    menuContent.append(element('p', '', 'A routine is a named set of links, such as the sites you open every morning. Create one in Edit links → Routines, then click its chip above the Galaxy to open them all. Give it a time and days, and Orbit offers to open it when you arrive. Set Orbit as your browser’s startup page and allow pop-ups for it, and your day starts with one click.'));
    menuContent.append(element('p', '', 'Shift+click a planet, or use “Open a planet with all its moons” in a System, to open a planet and its website moons in new tabs. If only one tab opens, allow pop-ups for Orbit in your browser.'));
    menuContent.append(element('p', '', 'The list button in the top bar, next to Edit mode, switches the Galaxy between orbits and a compact list.'));
    menuContent.append(element('p', '', 'In Edit links, the icons on sun, planet, and moon rows let you edit, export, reorder, or remove the item. The arrows save the order within the current list right away. Team rows have View and Export icons.'));
    menuContent.append(element('p', '', 'Edit links has tools for version history (restore an earlier map), finding duplicates, checking for broken links (needs python3 serve.py), and importing files. Import a file accepts whole maps, individual suns, planets as suns, and browser bookmarks. Whole maps merge by default.'));
    menuContent.append(element('p', '', 'A team map, if one is set up, adds read-only team suns marked TEAM. Copy anything from them into your own map in Edit links. When the team map changes, Orbit lists what is new.'));
    menuContent.append(element('p', '', 'Paste a web address into Quick find (or use Add a link in the command palette) to add it to a sun as a planet or to a planet as a moon. A link can have a note, shown on hover and in search; never put passwords in notes.'));
    menuContent.append(element('p', '', 'A web address can contain {placeholders}, such as https://jira.example.com/browse/{ticket}. Opening the link asks for each value and remembers the last one.'));
    menuContent.append(element('p', '', 'Workspaces in Settings keep separate maps, such as Work and Home. Link packs share a routine or your favorites as a small file. Remote Desktop presets save connection settings, such as full screen on all monitors, for many links at once. Orbit reminds you to export a backup after many changes.'));
    menuContent.append(element('h4', 'editor-section-title', 'Rearranging by dragging'));
    menuContent.append(element('p', '', 'Turn on Edit mode in the top bar to rearrange the map with a mouse or pen. While it is on, planets and moons do not open; a sun still opens its System.'));
    menuContent.append(element('p', '', 'Drag a planet onto another sun to move it there with all its moons. Drag a moon onto another planet; in the Galaxy, pause on a sun to show its planets.'));
    menuContent.append(element('p', '', 'To set the order, drag onto a sibling: a planet onto a planet, a moon onto a moon, or a sun onto a sun. Choose Before or After, and the hint shows the position it will take. Pause on a planet to show its moons.'));
    menuContent.append(element('p', '', 'To change a moon into a planet, pause it on a sun\'s circle and hold on Make it a planet until it fills, then release. A planet without moons dragged onto another planet offers Make it a moon the same way. Passing over these choices never changes anything; Undo last drag reverses a change. Edit links has Make it a planet of… and Make it a moon of… under Move.'));
    menuContent.append(element('p', '', 'In a System, a list of the other suns and planets appears while you drag; pause on an entry to open it. Undo last drag reverses the most recent move until the map changes again.'));
    menuContent.append(element('p', '', 'Use Edit links to reach any item, including links outside the visible orbits. In a planet or moon editor, the top toolbar has Save, Export, Move, and Remove. Open Move to change the order or pick another sun or planet and a position. In Edit mode, a Quick find result opens that planet or moon in Edit links.'));
    menuContent.append(element('h4', 'editor-section-title', 'Keyboard'));
    menuContent.append(element('p', '', 'Press / to jump to Quick find. Down Arrow moves into the results, Up and Down Arrow move between them, and Enter opens one.'));
    menuContent.append(element('p', '', 'Press E on a focused sun, planet, or moon to open its editor. You can also rest the pointer on an item and click its pencil or use the trash button to remove it. Undo removal restores the last removed item.'));
    menuContent.append(element('p', '', 'Tab moves through the page. Focusing a sun reveals its planets, and focusing a planet reveals its moons.'));
    menuContent.append(element('p', '', 'Arrow keys move between suns, and between sibling planets or moons. Down Arrow on a planet enters its moons, and Up Arrow goes back out.'));
    menuContent.append(element('p', '', 'Escape dismisses a visible button tip, closes the menu, then cancels a drag, then turns Edit mode off, then clears Quick find, then returns from a System to the Galaxy.'));
    menuContent.append(element('p', '', 'Ctrl+K or Cmd+K opens the command palette. Up and Down Arrow move through it, Enter runs or opens the highlighted entry, and Escape closes it first.'));
  } else if (name === 'About') {
    menuContent.append(element('p', '', 'Orbit is a local link map that keeps your favorite destinations in a visual Galaxy.'));
    menuContent.append(element('p', '', 'Your link map runs on this computer, without an account or hosted service.'));
    menuContent.append(element('p', '', `Version ${APP_VERSION}`));
  }
}
