// Settings menu: open, close, and the Settings, Help, and About panels.
// Loaded as a classic script before app.js. Uses shared state from app.js
// (menuOverlay, menuContent, preferences, groups) only when called.

let menuOpener = null;

function closeMenu() {
  if (menuOverlay.hidden) return;
  menuOverlay.hidden = true;
  // Return focus to whatever opened the menu so keyboard users keep their place.
  const target = menuOpener && document.contains(menuOpener) ? menuOpener : settingsTrigger;
  menuOpener = null;
  target.focus();
}

function openMenu() {
  menuOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  menuContent.replaceChildren();
  for (const option of document.querySelectorAll('[data-menu-panel]')) option.classList.remove('active');
  menuOverlay.hidden = false;
  document.querySelector('[data-menu-panel]').focus();
}

function showMenuPanel(name) {
  menuContent.replaceChildren();
  for (const option of document.querySelectorAll('[data-menu-panel]')) {
    option.classList.toggle('active', option.dataset.menuPanel === name);
  }
  menuContent.append(element('h3', '', name));
  if (name === 'Settings') {
    const edit = element('button', 'editor-open', 'Edit links');
    edit.type = 'button';
    edit.addEventListener('click', () => showEditor('suns'));
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
      activeTheme = themeSelect.value;
      document.documentElement.dataset.theme = activeTheme;
      savePreference('orbit:theme', activeTheme);
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
      activeFontSize = fontSelect.value;
      document.documentElement.dataset.fontSize = activeFontSize;
      savePreference('orbit:font-size', activeFontSize);
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
      rdpLaunchMode = rdpSelect.value;
      savePreference('orbit:rdp-launch', rdpLaunchMode);
      updateRdpSetup();
      render();
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
      animationsEnabled = input.checked;
      document.documentElement.dataset.animations = animationsEnabled ? 'on' : 'off';
      savePreference('orbit:animations', animationsEnabled);
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
      alwaysShowMoons = moonInput.checked;
      document.documentElement.dataset.moons = alwaysShowMoons ? 'always' : 'hover';
      savePreference('orbit:always-show-moons', alwaysShowMoons);
    });
    moonRow.append(moonCopy, moonInput);
    menuContent.append(moonRow);
  } else if (name === 'Help') {
    menuContent.append(element('p', '', 'Explore your Galaxy. Hover over a sun to see its first five planets, then hover over a planet to reveal its moons.'));
    menuContent.append(element('p', '', 'Click a sun to open its System and find more planets. Web planets and moons open in a new tab.'));
    menuContent.append(element('p', '', 'Windows Remote Desktop entries download an .rdp file by default. After installing the Orbit Windows helper, choose Open mstsc.exe in Settings to open Remote Desktop Connection with the target loaded.'));
    menuContent.append(element('p', '', 'In Edit links, open a planet or moon and use Import .rdp file to keep a saved connection profile with that link. Save the link after importing.'));
    menuContent.append(element('p', '', 'Your browser may ask before opening the helper. Orbit does not store credentials.'));
    menuContent.append(element('p', '', 'Use Quick find in the Galaxy to search any sun, planet, or moon by name.'));
    menuContent.append(element('h4', 'editor-section-title', 'Keyboard'));
    menuContent.append(element('p', '', 'Press / to jump to Quick find. Down Arrow moves into the results, Up and Down Arrow move between them, and Enter opens one.'));
    menuContent.append(element('p', '', 'Tab moves through the page. Focusing a sun reveals its planets, and focusing a planet reveals its moons.'));
    menuContent.append(element('p', '', 'Arrow keys move between suns, and between sibling planets or moons. Down Arrow on a planet enters its moons, and Up Arrow goes back out.'));
    menuContent.append(element('p', '', 'Escape closes the menu first, then clears Quick find, then returns from a System to the Galaxy.'));
  } else if (name === 'About') {
    menuContent.append(element('p', '', 'Orbit is a local link map that keeps your favorite destinations in a visual Galaxy.'));
    menuContent.append(element('p', '', 'Your link map runs on this computer, without an account or hosted service.'));
    menuContent.append(element('p', '', `Version ${APP_VERSION}`));
  }
}
