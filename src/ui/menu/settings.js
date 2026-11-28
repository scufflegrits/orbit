// Settings panel and its controls, split from menu.js without behavior changes.
import * as prefs from '../../state/prefs.js';
import { counted, element } from '../dom.js';
import { reducedMotionQuery, refreshBackdrop } from '../backdrop/backdrop.js';
import { hooks } from '../hooks.js';
import { icon } from '../icons.js';
import { tip } from '../tooltip.js';
import { showBackupReminder } from '../notices/backup.js';
import { refreshTeamUpdateLinks } from '../notices/team-updates.js';
import { editorButton } from '../editor/kit.js';
import { openEditorPage } from '../editor/page.js';
import { CONFIRM_DELETE_KEY } from '../remove-item.js';
import { store } from '../../state/page-store.js';
import { team } from '../team-map.js';
import { workspaceSettings } from './workspaces.js';
import { activeFontFamily, activeFontSize, activeTheme, alwaysShowMoons, animationLevel, applyAnimationLevel, backgroundMode, buttonTips, dataSourceLabel, galaxyView, menuContent, particleStrength, rdpLaunchMode, setActiveFontFamily, setActiveFontSize, setActiveTheme, setAlwaysShowMoons, setBackgroundMode, setParticleStrength, setButtonTips, setGalaxyView, setRdpLaunchMode, setShowEditButtons, setShowQuickBar, setShowSiteIcons, showEditButtons, showQuickBar, showSiteIcons, storageWarning } from '../page.js';

/** @type {HTMLElement | null} */
let animationHint = null;
const animationHints = {
  full: "Everything moves, including the Constellations background when it's on.",
  calm: 'The Constellations background holds still but follows the pointer. Hovers and menus animate as usual.',
  off: 'No animations or transitions anywhere.',
};

function updateAnimationHint() {
  if (!animationHint) return;
  const lines = [animationHints[animationLevel]];
  if (animationLevel === 'calm' && backgroundMode === 'none') {
    lines.push('Calm only differs from Full with the Constellations background.');
  }
  if (reducedMotionQuery().matches) {
    lines.push("Your device's 'reduce motion' setting is on, so the background stays still and other animations are near-instant, whatever you choose.");
  }
  animationHint.textContent = lines.join(' ');
}

reducedMotionQuery().addEventListener('change', () => {
  if (animationHint?.isConnected) updateAnimationHint();
});


export function clearAnimationHint() {
  animationHint = null;
}

/**
 * Switch the font. Planet and moon circles are sized by measuring labels in
 * the current font, so wait for the new faces to load, then draw again (render
 * lays the orbits out anew).
 * @param {'inter' | 'classic'} family
 */
async function applyFontFamily(family) {
  setActiveFontFamily(family);
  document.documentElement.dataset.fontFamily = family;
  prefs.savePreference('orbit:font-family', family);
  const faces = family === 'classic' ? ['600 16px "Space Grotesk"', '16px "DM Sans"'] : ['600 16px Inter', '16px Inter'];
  try { await Promise.all(faces.map(face => document.fonts.load(face))); } catch { /* Draw with what loaded. */ }
  hooks.render();
}

export function showSettingsPanel() {
  const edit = element('button', 'editor-open', 'Edit links');
  edit.type = 'button';
  edit.addEventListener('click', openEditorPage);
  const editRow = element('div', 'editor-open-row');
  editRow.append(edit, helpLink('settings-edit-links', 'Edit links'));
  menuContent.append(editRow);
  const source = element('p', 'data-source', `Active link map: ${dataSourceLabel()}`);
  source.append(helpLink('settings-active-map', 'the active link map'));
  menuContent.append(source);
  if (storageWarning) menuContent.append(element('p', 'editor-error', storageWarning));
  const workspacesAndTeam = settingsGroup('workspaces-and-team', 'Workspaces and team');
  workspacesAndTeam.append(workspaceSettings(), teamSettings());
  menuContent.append(lookSettings(), galaxySettings(), editingSettings(), workspacesAndTeam, remoteDesktopSettings());
}

/**
 * @param {string} slug
 * @param {string} title
 */
function settingsGroup(slug, title) {
  const section = element('section', 'settings-group');
  const heading = element('h4', 'editor-section-title', title);
  heading.id = `settings-group-${slug}`;
  section.setAttribute('aria-labelledby', heading.id);
  section.append(heading, helpLink(`settings-${slug}`, title));
  return section;
}

/**
 * A ? link to this part of the Help guide (help.html), opened in a new tab. The
 * ids it points at are a contract with help.html; F45 checks each one exists.
 * @param {string} id
 * @param {string} title
 */
function helpLink(id, title) {
  const link = /** @type {HTMLAnchorElement} */ (element('a', 'settings-help'));
  link.href = `help.html#${id}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.setAttribute('aria-label', `Help for ${title}`);
  link.append(icon('circle-help'));
  return tip(link, 'Opens the Help guide in a new tab');
}

function lookSettings() {
  const section = settingsGroup('look', 'Look');
  const themeRow = element('label', 'setting-row');
  const themeCopy = element('span', 'setting-copy');
  themeCopy.append(element('strong', '', 'Theme'));
  themeCopy.append(element('small', '', 'Choose the colors for your Galaxy'));
  const themeSelect = document.createElement('select');
  themeSelect.setAttribute('aria-label', 'Theme');
  for (const [value, label] of [
    ['default', 'Default'], ['alabama', 'Red'], ['auburn', 'Blue'], ['aurora', 'Aurora'],
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
    refreshBackdrop();
  });
  themeRow.append(themeCopy, themeSelect);
  section.append(themeRow);
  const familyRow = element('label', 'setting-row');
  const familyCopy = element('span', 'setting-copy');
  familyCopy.append(element('strong', '', 'Font'));
  familyCopy.append(element('small', '', 'Inter, or Orbit classic: DM Sans with Space Grotesk labels'));
  const familySelect = document.createElement('select');
  familySelect.setAttribute('aria-label', 'Font');
  for (const [value, label] of [['inter', 'Inter (default)'], ['classic', 'Orbit classic (DM Sans and Space Grotesk)']]) {
    const option = element('option', '', label);
    option.value = value;
    familySelect.append(option);
  }
  familySelect.value = activeFontFamily;
  familySelect.addEventListener('change', () => applyFontFamily(/** @type {'inter' | 'classic'} */ (familySelect.value)));
  familyRow.append(familyCopy, familySelect);
  section.append(familyRow);
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
  section.append(fontRow);
  const backgroundRow = element('label', 'setting-row');
  const backgroundCopy = element('span', 'setting-copy');
  backgroundCopy.append(element('strong', '', 'Background'));
  backgroundCopy.append(element('small', '', 'None or animated Constellations'));
  const backgroundSelect = document.createElement('select');
  backgroundSelect.setAttribute('aria-label', 'Background');
  for (const [value, label] of [['none', 'None'], ['constellations', 'Constellations']]) {
    const option = element('option', '', label);
    option.value = value;
    backgroundSelect.append(option);
  }
  backgroundSelect.value = backgroundMode;
  backgroundSelect.addEventListener('change', () => {
    setBackgroundMode(/** @type {'none' | 'constellations'} */ (backgroundSelect.value));
    document.documentElement.dataset.background = backgroundMode;
    prefs.savePreference('orbit:background', backgroundMode);
    particlesRow.hidden = backgroundMode !== 'constellations';
    updateAnimationHint();
    refreshBackdrop();
  });
  backgroundRow.append(backgroundCopy, backgroundSelect);
  section.append(backgroundRow);
  const particlesRow = element('label', 'setting-row');
  particlesRow.hidden = backgroundMode !== 'constellations';
  const particlesCopy = element('span', 'setting-copy');
  particlesCopy.append(element('strong', '', 'Particles'));
  particlesCopy.append(element('small', '', 'Set the constellation strength'));
  const particlesSelect = document.createElement('select');
  particlesSelect.setAttribute('aria-label', 'Particles');
  for (const [value, label] of [['subtle', 'Subtle'], ['normal', 'Normal'], ['bold', 'Bold']]) {
    const option = element('option', '', label);
    option.value = value;
    particlesSelect.append(option);
  }
  particlesSelect.value = particleStrength;
  particlesSelect.addEventListener('change', () => {
    setParticleStrength(/** @type {'subtle' | 'normal' | 'bold'} */ (particlesSelect.value));
    document.documentElement.dataset.particles = particleStrength;
    prefs.savePreference('orbit:particles', particleStrength);
    refreshBackdrop();
  });
  particlesRow.append(particlesCopy, particlesSelect);
  section.append(particlesRow);
  const row = element('label', 'setting-row');
  const copy = element('span', 'setting-copy');
  animationHint = element('small');
  animationHint.id = 'animations-hint';
  copy.append(element('strong', '', 'Animations'), animationHint);
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Animations');
  select.setAttribute('aria-describedby', animationHint.id);
  for (const [value, label] of [['full', 'Full (default)'], ['calm', 'Calm'], ['off', 'Off']]) {
    const option = element('option', '', label);
    option.value = value;
    select.append(option);
  }
  select.value = animationLevel;
  updateAnimationHint();
  select.addEventListener('change', () => {
    const level = /** @type {prefs.AnimationLevel} */ (select.value);
    applyAnimationLevel(level);
    prefs.saveAnimationLevel(level);
    updateAnimationHint();
    refreshBackdrop();
  });
  row.append(copy, select);
  section.append(row);
  return section;
}

function galaxySettings() {
  const section = settingsGroup('galaxy', 'Galaxy');
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
  section.append(viewRow);
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
  section.append(moonRow);
  section.append(settingToggle('Show favorites and recent', 'A row of your favorite and recently opened links above the Galaxy',
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
  section.append(recentActions);
  section.append(settingToggle('Show site icons', 'Loads each website’s own icon from that site (its /favicon.ico). Off keeps Orbit from contacting sites until you open them.',
    showSiteIcons, checked => {
      setShowSiteIcons(checked);
      prefs.savePreference('orbit:site-icons', checked);
      hooks.render();
    }));
  return section;
}

function editingSettings() {
  const section = settingsGroup('editing', 'Editing');
  section.append(settingToggle('Edit buttons on hover', 'Show editing and removal controls when you rest the pointer on a map item',
    showEditButtons, setShowEditButtons));
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
  section.append(tipsRow);
  section.append(settingToggle('Confirm before deleting', 'Ask before removing a sun, planet, or moon from the map or editor',
    prefs.readBoolean(CONFIRM_DELETE_KEY, true), checked => prefs.savePreference(CONFIRM_DELETE_KEY, checked)));
  section.append(settingToggle('Backup reminders', 'Suggest a backup (Edit links → Export → Whole map (JSON)) after 20 changes or 14 days without one',
    prefs.readBoolean('orbit:backup-reminders', true), checked => {
      prefs.savePreference('orbit:backup-reminders', checked);
      showBackupReminder();
    }));
  return section;
}

function remoteDesktopSettings() {
  const section = settingsGroup('remote-desktop', 'Remote Desktop');
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
    refreshTeamUpdateLinks();
    prefs.savePreference('orbit:rdp-launch', rdpLaunchMode);
    updateRdpSetup();
    hooks.render();
  });
  rdpRow.append(rdpCopy, rdpSelect);
  section.append(rdpRow, rdpSetup);
  return section;
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
      hooks.showMenuPanel('Settings');
    }));
    section.append(row);
  });
  return section;
}
