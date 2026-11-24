// The menu (2.2.1 menu.js): open and close, and the Settings, Help, and
// About panels. Whether the menu is open belongs to the mode store; app.js's
// mode subscriber shows or hides the overlay and calls menuHidden(). Moved
// in rewrite phase 6a.
import * as prefs from '../../state/prefs.js';
import { counted, element } from '../dom.js';
import { hooks } from '../hooks.js';
import { showBackupReminder } from '../notices/backup.js';
import { editorButton, setEditorTree } from '../editor/kit.js';
import { openEditorPage } from '../editor/page.js';
import { modes } from '../page-modes.js';
import { store } from '../../state/page-store.js';
import { team } from '../team-map.js';
import { workspaceSettings } from './workspaces.js';
import { activeFontSize, activeTheme, alwaysShowMoons, animationsEnabled, APP_VERSION, buttonTips, dataSourceLabel, galaxyView, menuContent, menuOverlay, menuRoot, rdpLaunchMode, setActiveFontSize, setActiveTheme, setAlwaysShowMoons, setAnimationsEnabled, setButtonTips, setGalaxyView, setMenuContent, setRdpLaunchMode, setShowQuickBar, setShowSiteIcons, settingsTrigger, showQuickBar, showSiteIcons, storageWarning } from '../page.js';

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
  /** @type {HTMLElement} */ (menuOverlay.querySelector('.menu-sheet')).classList.remove('editor-page-mode');
  /** @type {HTMLElement} */ (menuOverlay.querySelector('.menu-top h2')).textContent = 'Explore the menu';
  setMenuContent(menuRoot);
  setEditorTree(null);
  // Return focus to whatever opened the menu so keyboard users keep their place.
  const target = menuOpener && document.contains(menuOpener) ? menuOpener : settingsTrigger;
  menuOpener = null;
  target.focus();
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

/** @param {string} name Settings, Help, or About. */
export function showMenuPanel(name) {
  modes.send('choosePanel');
  menuContent.replaceChildren();
  for (const option of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-menu-panel]'))) {
    option.classList.toggle('active', option.dataset.menuPanel === name);
  }
  menuContent.append(element('h3', '', name));
  if (name === 'Settings') {
    const edit = element('button', 'editor-open', 'Edit links');
    edit.type = 'button';
    edit.addEventListener('click', openEditorPage);
    menuContent.append(edit);
    menuContent.append(element('p', 'data-source', `Active link map: ${dataSourceLabel()}`));
    if (storageWarning) menuContent.append(element('p', 'editor-error', storageWarning));
    const themeRow = element('label', 'setting-row');
    const themeCopy = element('span', 'setting-copy');
    themeCopy.append(element('strong', '', 'Theme'));
    themeCopy.append(element('small', '', 'Choose the colors for your Galaxy'));
    const themeSelect = document.createElement('select');
    themeSelect.setAttribute('aria-label', 'Theme');
    for (const [value, label] of [
      ['default', 'Default'], ['alabama', 'Red'], ['auburn', 'Blue'],
    ]) {
      const option = element('option', '', label);
      option.value = value;
      themeSelect.append(option);
    }
    themeSelect.value = activeTheme;
    themeSelect.addEventListener('change', () => {
      setActiveTheme(/** @type {any} */ (themeSelect.value));
      document.documentElement.dataset.theme = activeTheme;
      prefs.savePreference('orbit:theme', activeTheme);
    });
    themeRow.append(themeCopy, themeSelect);
    menuContent.append(themeRow);
    const fontRow = element('label', 'setting-row');
    const fontCopy = element('span', 'setting-copy');
    fontCopy.append(element('strong', '', 'Font size'));
    fontCopy.append(element('small', '', 'Text size throughout Orbit'));
    const fontSelect = document.createElement('select');
    fontSelect.setAttribute('aria-label', 'Font size');
    for (const [value, label] of [
      ['small', 'Small (90%)'], ['standard', 'Standard (100%)'],
      ['large', 'Large (115%)'], ['extra', 'Extra large (130%)'],
    ]) {
      const option = element('option', '', label);
      option.value = value;
      fontSelect.append(option);
    }
    fontSelect.value = activeFontSize;
    fontSelect.addEventListener('change', () => {
      setActiveFontSize(/** @type {any} */ (fontSelect.value));
      document.documentElement.dataset.fontSize = activeFontSize;
      prefs.savePreference('orbit:font-size', activeFontSize);
    });
    fontRow.append(fontCopy, fontSelect);
    menuContent.append(fontRow);
    const rdpRow = element('label', 'setting-row');
    const rdpCopy = element('span', 'setting-copy');
    rdpCopy.append(element('strong', '', 'Remote Desktop'));
    rdpCopy.append(element('small', '', 'Opening the client requires the Orbit Windows helper'));
    const rdpSelect = document.createElement('select');
    rdpSelect.setAttribute('aria-label', 'Remote Desktop launch');
    for (const [value, label] of [
      ['download', 'Download .rdp file'], ['client', 'Open mstsc.exe'],
    ]) {
      const option = element('option', '', label);
      option.value = value;
      rdpSelect.append(option);
    }
    rdpSelect.value = rdpLaunchMode;
    const rdpSetup = element('div', 'rdp-setup');
    rdpSetup.append(element('strong', '', 'Windows setup required'));
    rdpSetup.append(element('p', '', 'This opens built-in mstsc.exe. Installing Microsoft Remote Desktop Client (MSRDC) does not install the Orbit helper.'));
    rdpSetup.append(element('p', '', 'From the Orbit project folder, run with Windows PowerShell 5.1:'));
    rdpSetup.append(element('code', '', 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\windows\\Install-OrbitRdp.ps1'));
    rdpSetup.append(element('p', '', 'If only PowerShell 7 is available, run:'));
    rdpSetup.append(element('code', '', 'pwsh.exe -NoProfile -ExecutionPolicy Bypass -File .\\windows\\Install-OrbitRdp.ps1'));
    rdpSetup.append(element('p', '', 'Run the installer again after updating Orbit to refresh the helper. Host-only links open with mstsc.exe /v without a connection file; imported profiles still use a file.'));
    const updateRdpSetup = () => { rdpSetup.hidden = rdpSelect.value !== 'client'; };
    updateRdpSetup();
    rdpSelect.addEventListener('change', () => {
      setRdpLaunchMode(/** @type {any} */ (rdpSelect.value));
      prefs.savePreference('orbit:rdp-launch', rdpLaunchMode);
      updateRdpSetup();
      hooks.render();
    });
    rdpRow.append(rdpCopy, rdpSelect);
    menuContent.append(rdpRow, rdpSetup);
    const row = element('label', 'setting-row');
    const copy = element('span', 'setting-copy');
    copy.append(element('strong', '', 'Animations'));
    copy.append(element('small', '', 'Movement and reveal effects throughout Orbit'));
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = animationsEnabled;
    input.setAttribute('aria-label', 'Animations');
    input.addEventListener('change', () => {
      setAnimationsEnabled(input.checked);
      document.documentElement.dataset.animations = animationsEnabled ? 'on' : 'off';
      prefs.savePreference('orbit:animations', animationsEnabled);
    });
    row.append(copy, input);
    menuContent.append(row);
    const moonRow = element('label', 'setting-row');
    const moonCopy = element('span', 'setting-copy');
    moonCopy.append(element('strong', '', 'Always show moons'));
    moonCopy.append(element('small', '', 'Show moons around visible planets without hovering'));
    const moonInput = document.createElement('input');
    moonInput.type = 'checkbox';
    moonInput.checked = alwaysShowMoons;
    moonInput.setAttribute('aria-label', 'Always show moons');
    moonInput.addEventListener('change', () => {
      setAlwaysShowMoons(moonInput.checked);
      document.documentElement.dataset.moons = alwaysShowMoons ? 'always' : 'hover';
      prefs.savePreference('orbit:always-show-moons', alwaysShowMoons);
    });
    moonRow.append(moonCopy, moonInput);
    menuContent.append(moonRow);
    const tipsRow = element('label', 'setting-row');
    const tipsCopy = element('span', 'setting-copy');
    tipsCopy.append(element('strong', '', 'Button tips'));
    const tipsSelect = document.createElement('select');
    tipsSelect.setAttribute('aria-label', 'Button tips');
    for (const [value, label] of [['slow', 'After 1.5 seconds'], ['normal', 'After 0.8 seconds'], ['off', 'Off']]) {
      const option = element('option', '', label);
      option.value = value;
      tipsSelect.append(option);
    }
    tipsSelect.value = buttonTips;
    tipsSelect.addEventListener('change', () => setButtonTips(tipsSelect.value));
    tipsRow.append(tipsCopy, tipsSelect);
    menuContent.append(tipsRow);
    menuContent.append(settingToggle('Show favorites and recent', 'A row of your favorite and recently opened links above the Galaxy',
      showQuickBar, checked => {
        setShowQuickBar(checked);
        prefs.savePreference('orbit:quick-bar', checked);
        hooks.render();
      }));
    const recentActions = element('div', 'editor-actions');
    const clear = editorButton('Clear recent links', () => {
      prefs.clearRecent();
      hooks.render();
      clear.textContent = 'Recent links cleared';
    });
    recentActions.append(clear);
    menuContent.append(recentActions);
    const viewRow = element('label', 'setting-row');
    const viewCopy = element('span', 'setting-copy');
    viewCopy.append(element('strong', '', 'Galaxy view'));
    viewCopy.append(element('small', '', 'Orbits, or a compact list of every sun, planet, and moon'));
    const viewSelect = document.createElement('select');
    viewSelect.setAttribute('aria-label', 'Galaxy view');
    for (const [value, label] of [['orbits', 'Orbits'], ['list', 'List']]) {
      const option = element('option', '', label);
      option.value = value;
      viewSelect.append(option);
    }
    viewSelect.value = galaxyView;
    viewSelect.addEventListener('change', () => setGalaxyView(viewSelect.value));
    viewRow.append(viewCopy, viewSelect);
    menuContent.append(viewRow);
    menuContent.append(settingToggle('Show site icons', 'Loads each website’s own icon from that site (its /favicon.ico). Off keeps Orbit from contacting sites until you open them.',
      showSiteIcons, checked => {
        setShowSiteIcons(checked);
        prefs.savePreference('orbit:site-icons', checked);
        hooks.render();
      }));
    menuContent.append(settingToggle('Backup reminders', 'Suggest a backup (Edit links → Export → Whole map (JSON)) after 20 changes or 14 days without one',
      prefs.readBoolean('orbit:backup-reminders', true), checked => {
        prefs.savePreference('orbit:backup-reminders', checked);
        showBackupReminder();
      }));
    menuContent.append(workspaceSettings());
    menuContent.append(teamSettings());
  } else if (name === 'Help') {
    menuContent.append(element('p', '', 'Explore your Galaxy. Hover over a sun to see its first five planets, then hover over a planet to reveal its moons.'));
    menuContent.append(element('p', '', 'Click a sun to open its System and find more planets. Web planets and moons open in a new tab.'));
    menuContent.append(element('p', '', 'Windows Remote Desktop entries download an .rdp file by default. After installing the Orbit Windows helper, choose Open mstsc.exe in Settings to open Remote Desktop Connection with the target loaded.'));
    menuContent.append(element('p', '', 'In Edit links, open a planet or moon and use Import .rdp file to keep a saved connection profile with that link. Save the link after importing.'));
    menuContent.append(element('p', '', 'Your browser may ask before opening the helper. Orbit does not store credentials.'));
    menuContent.append(element('p', '', 'Use Quick find to search any sun, planet, or moon. It matches names, the sun or planet a link sits in, web addresses and computer names, and small typos; every word must match. Short forms work too: “lab1 s3” finds lab1-server3. Type #tag (or tag:name) to show only links with that tag.'));
    menuContent.append(element('p', '', 'Press Ctrl+K (Cmd+K on a Mac) for the command palette: search links and commands, then press Enter to open the highlighted one straight away.'));
    menuContent.append(element('p', '', 'Routines, favorites, and recently opened links appear above the Galaxy. Star a link in Quick find results, or tick Favorite in Edit links; Open all opens every favorite at once.'));
    menuContent.append(element('p', '', 'A routine is a named set of links, such as the sites you open every morning. Create one in Edit links → Routines, then click its chip above the Galaxy to open them all. Give it a time and days, and Orbit offers to open it when you arrive. Set Orbit as your browser’s startup page and allow pop-ups for it, and your day starts with one click.'));
    menuContent.append(element('p', '', 'Shift+click a planet, or use “Open a planet with all its moons” in a System, to open a planet and its website moons in new tabs. If only one tab opens, allow pop-ups for Orbit in your browser.'));
    menuContent.append(element('p', '', 'The ☰ button in the top bar switches the Galaxy between orbits and a compact list.'));
    menuContent.append(element('p', '', 'Edit links has tools for version history (restore an earlier map), finding duplicates, checking for broken links (needs python3 serve.py), and importing files. Import a file accepts whole maps, individual suns, planets as suns, and browser bookmarks. Whole maps merge by default.'));
    menuContent.append(element('p', '', 'A team map, if one is set up, adds read-only team suns marked TEAM. Copy anything from them into your own map in Edit links. When the team map changes, Orbit lists what is new.'));
    menuContent.append(element('p', '', 'Paste a web address into Quick find (or use Add a link in the command palette) to add it to a sun as a planet or to a planet as a moon. A link can have a note, shown on hover and in search; never put passwords in notes.'));
    menuContent.append(element('p', '', 'A web address can contain {placeholders}, such as https://jira.example.com/browse/{ticket}. Opening the link asks for each value and remembers the last one.'));
    menuContent.append(element('p', '', 'Workspaces in Settings keep separate maps, such as Work and Home. Link packs share a routine or your favorites as a small file. Remote Desktop presets save connection settings, such as full screen on all monitors, for many links at once. Orbit reminds you to export a backup after many changes.'));
    menuContent.append(element('h4', 'editor-section-title', 'Rearranging by dragging'));
    menuContent.append(element('p', '', 'Turn on Edit mode in the top bar to rearrange the map with a mouse or pen. While it is on, planets and moons do not open; a sun still opens its System.'));
    menuContent.append(element('p', '', 'Drag a planet onto another sun to move it there with all its moons. Drag a moon onto another planet; in the Galaxy, pause on a sun to show its planets.'));
    menuContent.append(element('p', '', 'To set the order, drag onto a sibling: a planet onto a planet, a moon onto a moon, or a sun onto a sun. Choose Before or After, and the hint shows the position it will take. Pause on a planet to show its moons.'));
    menuContent.append(element('p', '', 'In a System, a list of the other suns and planets appears while you drag; pause on an entry to open it. Undo last drag reverses the most recent move until the map changes again.'));
    menuContent.append(element('p', '', 'Links that are not shown on the map, and keyboard-only editing, are covered by Edit links: Move up and Move down set the order, and Move to another sun or planet lets you choose the position. In Edit mode, a Quick find result opens that planet or moon in Edit links.'));
    menuContent.append(element('h4', 'editor-section-title', 'Keyboard'));
    menuContent.append(element('p', '', 'Press / to jump to Quick find. Down Arrow moves into the results, Up and Down Arrow move between them, and Enter opens one.'));
    menuContent.append(element('p', '', 'Tab moves through the page. Focusing a sun reveals its planets, and focusing a planet reveals its moons.'));
    menuContent.append(element('p', '', 'Arrow keys move between suns, and between sibling planets or moons. Down Arrow on a planet enters its moons, and Up Arrow goes back out.'));
    menuContent.append(element('p', '', 'Escape closes the menu first, then cancels a drag, then turns Edit mode off, then clears Quick find, then returns from a System to the Galaxy.'));
    menuContent.append(element('p', '', 'Ctrl+K or Cmd+K opens the command palette. Up and Down Arrow move through it, Enter runs or opens the highlighted entry, and Escape closes it first.'));
  } else if (name === 'About') {
    menuContent.append(element('p', '', 'Orbit is a local link map that keeps your favorite destinations in a visual Galaxy.'));
    menuContent.append(element('p', '', 'Your link map runs on this computer, without an account or hosted service.'));
    menuContent.append(element('p', '', `Version ${APP_VERSION}`));
  }
}

/**
 * @param {string} title
 * @param {string} hint
 * @param {boolean} checked
 * @param {(checked: boolean) => void} onChange
 */
function settingToggle(title, hint, checked, onChange) {
  const row = element('label', 'setting-row');
  const copy = element('span', 'setting-copy');
  copy.append(element('strong', '', title), element('small', '', hint));
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.setAttribute('aria-label', title);
  input.addEventListener('change', () => onChange(input.checked));
  row.append(copy, input);
  return row;
}

// Where the team map comes from, and any team suns hidden from this Galaxy.
function teamSettings() {
  const section = element('div', 'team-settings');
  section.append(element('strong', '', 'Team map'));
  if (team.error) section.append(element('p', 'editor-error', team.error));
  if (!team.groups.length) {
    if (!team.error) section.append(element('p', 'team-source', 'No team map is set up. Start Orbit with python3 serve.py --team PATH, or run python3 sync.py --team PATH for file use.'));
    return section;
  }
  section.append(element('p', 'team-source', `${counted(team.groups.length, 'team sun')} from ${team.source}. Team suns are read-only and never saved with your map.`));
  const hidden = prefs.hiddenTeamSuns();
  team.groups.filter((/** @type {any} */ sun) => hidden.has(sun.id)).forEach((/** @type {any} */ sun) => {
    const row = element('div', 'editor-list-row');
    row.append(element('span', '', `${sun.name} (hidden)`));
    row.append(editorButton('Show', () => {
      store.setTeamSunHidden(sun.id, false);
      showMenuPanel('Settings');
    }));
    section.append(row);
  });
  return section;
}
