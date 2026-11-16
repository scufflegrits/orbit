const app = document.querySelector('#app');
const count = document.querySelector('#link-count');
const settingsTrigger = document.querySelector('#settings-trigger');
const topbarSearch = document.querySelector('#topbar-search');
const quickFind = document.querySelector('#quick-find');
const menuOverlay = document.querySelector('#menu-overlay');
const menuContent = document.querySelector('#menu-content');
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

function closeMenu() {
  menuOverlay.hidden = true;
}

function openMenu() {
  menuContent.replaceChildren();
  for (const option of document.querySelectorAll('[data-menu-panel]')) option.classList.remove('active');
  menuOverlay.hidden = false;
}

function showMenuPanel(name) {
  menuContent.replaceChildren();
  for (const option of document.querySelectorAll('[data-menu-panel]')) {
    option.classList.toggle('active', option.dataset.menuPanel === name);
  }
  menuContent.append(element('h3', '', name));
  if (name === 'Settings') {
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
    rdpSetup.append(element('p', '', 'If you installed the helper before importing .rdp profiles was added, run the installer again to update the helper.'));
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
    const edit = element('button', 'editor-open', 'Edit links');
    edit.type = 'button';
    edit.addEventListener('click', () => showEditor('suns'));
    menuContent.append(edit);
    menuContent.append(element('p', 'data-source', `Active link map: ${dataSourceLabel()}`));
    if (storageWarning) menuContent.append(element('p', 'editor-error', storageWarning));
  } else if (name === 'Help') {
    menuContent.append(element('p', '', 'Explore your Galaxy. Hover over a sun to see its first five planets, then hover over a planet to reveal its moons.'));
    menuContent.append(element('p', '', 'Click a sun to open its System and find more planets. Web planets and moons open in a new tab.'));
    menuContent.append(element('p', '', 'Windows Remote Desktop entries download an .rdp file by default. After installing the Orbit Windows helper, choose Open mstsc.exe in Settings to open Remote Desktop Connection with the target loaded.'));
    menuContent.append(element('p', '', 'In Edit links, open a planet or moon and use Import .rdp file to keep a saved connection profile with that link. Save the link after importing.'));
    menuContent.append(element('p', '', 'Your browser may ask before opening the helper. Orbit does not store credentials.'));
    menuContent.append(element('p', '', 'Use Quick find in the Galaxy to search any sun, planet, or moon by name.'));
  } else if (name === 'About') {
    menuContent.append(element('p', '', 'Orbit is a local link map that keeps your favorite destinations in a visual Galaxy.'));
    menuContent.append(element('p', '', 'Your link map runs on this computer, without an account or hosted service.'));
    menuContent.append(element('p', '', `Version ${APP_VERSION}`));
  }
}

function editorButton(label, action, className = 'editor-button') {
  const button = element('button', className, label);
  button.type = 'button';
  button.addEventListener('click', action);
  return button;
}

function editorField(label, value, type = 'text') {
  const wrapper = element('label', 'editor-field');
  wrapper.append(element('span', '', label));
  const input = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
  if (type !== 'textarea') input.type = type;
  input.value = value;
  wrapper.append(input);
  return { wrapper, input };
}

function destinationFields(form, destination, onRdpImported) {
  const type = element('label', 'editor-field');
  type.append(element('span', '', 'Destination type'));
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Destination type');
  for (const [value, label] of [['web', 'Website'], ['rdp', 'Windows Remote Desktop']]) {
    const option = element('option', '', label);
    option.value = value;
    select.append(option);
  }
  select.value = destination.type === 'rdp' ? 'rdp' : 'web';
  type.append(select);
  const url = editorField('Destination URL', destination.url || '', 'url');
  const host = editorField('Computer name or IP address', destination.host || '');
  let rdpProfile = destination.rdpProfile || null;
  const profileNote = element('p', 'data-source', rdpProfile
    ? 'Custom .rdp settings are saved with this link.' : 'No custom .rdp settings are saved.');
  const importRdp = editorButton('Import .rdp file', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.rdp,application/x-rdp';
    input.addEventListener('change', async () => {
      if (!input.files.length) return;
      try {
        const parsed = parseRdpProfile(await readRdpText(input.files[0]));
        select.value = 'rdp';
        host.input.value = parsed.host;
        rdpProfile = parsed.content;
        profileNote.textContent = `${parsed.settings} connection settings imported. ${parsed.removed ? `${parsed.removed} password, token, or signature settings excluded. ` : ''}Save this link to keep the profile.`;
        update();
        onRdpImported?.(input.files[0]);
      } catch (error) {
        editorError(`RDP import failed: ${error.message}`);
      }
    });
    input.click();
  });
  const update = () => {
    url.wrapper.hidden = select.value !== 'web';
    host.wrapper.hidden = select.value !== 'rdp';
    profileNote.hidden = select.value !== 'rdp';
  };
  select.addEventListener('change', update);
  form.append(type, url.wrapper, host.wrapper, profileNote, importRdp);
  update();
  return () => select.value === 'rdp'
    ? { type: 'rdp', host: host.input.value.trim(), ...(rdpProfile ? { rdpProfile } : {}) }
    : { url: url.input.value.trim() };
}

function editorError(message) {
  const previous = menuContent.querySelector('.editor-error');
  if (previous) previous.remove();
  menuContent.prepend(element('p', 'editor-error', message));
}

function editorHeader(title, back) {
  menuContent.replaceChildren();
  const header = element('div', 'editor-header');
  header.append(editorButton('← Back', back, 'editor-back'));
  header.append(element('h3', '', title));
  menuContent.append(header);
  const undo = loadUndoRecord();
  if (undo) {
    const notice = element('div', 'editor-undo');
    notice.append(element('span', '', `Last removed: ${undo.label}`));
    notice.append(editorButton('Undo removal', undoRemoval));
    menuContent.append(notice);
  }
}

function copyGroups() {
  return JSON.parse(JSON.stringify(groups));
}

function applyEditorChange(nextGroups, showNext, options = {}) {
  let previousUndo;
  try {
    if (options.undoRecord) {
      previousUndo = localStorage.getItem(UNDO_STORAGE_KEY);
      localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(options.undoRecord));
    }
    saveMap({ groups: nextGroups });
    if (options.clearUndo) localStorage.removeItem(UNDO_STORAGE_KEY);
    storageWarning = '';
    showNext();
  } catch (error) {
    if (options.undoRecord) {
      try {
        if (previousUndo === null) localStorage.removeItem(UNDO_STORAGE_KEY);
        else if (previousUndo !== undefined) localStorage.setItem(UNDO_STORAGE_KEY, previousUndo);
      } catch { /* Keep the original error visible. */ }
    }
    editorError(error.message);
  }
}

function moveEntry(items, index, amount) {
  const target = index + amount;
  if (target < 0 || target >= items.length) return false;
  [items[index], items[target]] = [items[target], items[index]];
  return true;
}

function editorActions() {
  const actions = element('div', 'editor-actions');
  menuContent.append(actions);
  return actions;
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportMap() {
  downloadJson({ groups }, 'orbit-links.json');
}

function exportItem(kind, item) {
  const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || kind;
  downloadJson({ format: 'orbit-item-v1', kind, item }, `orbit-${kind}-${slug}.json`);
}

function selectJsonFile(onData) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    if (!input.files.length) return;
    try {
      onData(JSON.parse(await input.files[0].text()));
    } catch (error) {
      editorError(`Import failed: ${error.message}`);
    }
  });
  input.click();
}

function showImportReview(data) {
  editorHeader('Review import', showSunList);
  const planetCount = data.groups.reduce((sum, sun) => sum + sun.links.length, 0);
  const moonCount = data.groups.reduce((sum, sun) => sum + sun.links.reduce(
    (total, planet) => total + planet.moons.length, 0), 0);
  menuContent.append(element('p', '', `${data.groups.length} suns · ${planetCount} planets · ${moonCount} moons`));
  menuContent.append(element('p', '', 'Applying this file replaces the link map saved in this browser. Export your current map first if you want a backup.'));
  const actions = editorActions();
  actions.append(editorButton('Apply import', () =>
    applyEditorChange(data.groups, showSunList, { clearUndo: true }), 'editor-primary'));
  actions.append(editorButton('Cancel', showSunList));
}

function importMap() {
  selectJsonFile(data => showImportReview(validateMap(data)));
}

function importItem(kind, sunIndex = null, planetIndex = null, sourceKind = kind) {
  selectJsonFile(data => {
    if (!data || data.format !== 'orbit-item-v1' || data.kind !== sourceKind || !data.item) {
      throw new Error(`Choose an Orbit ${sourceKind} export file.`);
    }
    let item;
    if (kind === 'sun' && sourceKind === 'planet') {
      item = validateMap({ groups: [{ name: data.item.name, links: [data.item] }] }).groups[0];
    } else if (kind === 'sun') {
      item = validateMap({ groups: [data.item] }).groups[0];
    } else if (kind === 'planet') {
      item = validateMap({ groups: [{ name: 'Import', links: [data.item] }] }).groups[0].links[0];
    } else {
      item = validDestination(data.item, 'Moon');
    }
    const back = kind === 'sun' ? showSunList
      : kind === 'planet' ? () => showSunEditor(sunIndex)
        : () => showPlanetEditor(sunIndex, planetIndex);
    editorHeader(sourceKind === kind ? `Review ${kind} import` : 'Review planet as sun', back);
    menuContent.append(element('p', '', item.name));
    if (sourceKind === 'planet' && kind === 'sun') {
      menuContent.append(element('p', '', 'The shared planet becomes the first planet in a new sun. Its destination and moons stay with it.'));
      menuContent.append(element('p', '', `Planet destination: ${item.links[0].host || item.links[0].url}`));
    }
    if (kind === 'sun') {
      const moons = item.links.reduce((sum, planet) => sum + planet.moons.length, 0);
      menuContent.append(element('p', '', `${item.links.length} planet${item.links.length === 1 ? '' : 's'} · ${moons} moon${moons === 1 ? '' : 's'}`));
    } else if (kind === 'planet') {
      menuContent.append(element('p', '', `${item.moons.length} moons · ${item.host || item.url}`));
    } else {
      menuContent.append(element('p', '', item.host || item.url));
    }
    const destination = kind === 'sun' ? 'the Galaxy'
      : kind === 'planet' ? `${groups[sunIndex].name} sun`
        : `${groups[sunIndex].name} sun → ${groups[sunIndex].links[planetIndex].name} planet`;
    menuContent.append(element('p', '', `Add to ${destination}. Existing links will remain.`));
    const actions = editorActions();
    actions.append(editorButton(`Add ${kind}`, () => {
      const next = copyGroups();
      const imported = JSON.parse(JSON.stringify(item));
      let showNext;
      if (kind === 'sun') {
        if (next.some(sun => sun.id === imported.id)) {
          imported.id = uniqueSunId(imported.name, new Set(next.map(sun => sun.id)));
        }
        next.push(imported);
        showNext = () => showSunEditor(next.length - 1);
      } else if (kind === 'planet') {
        next[sunIndex].links.push(imported);
        showNext = () => showPlanetEditor(sunIndex, next[sunIndex].links.length - 1);
      } else {
        next[sunIndex].links[planetIndex].moons.push(imported);
        showNext = () => showMoonEditor(sunIndex, planetIndex,
          next[sunIndex].links[planetIndex].moons.length - 1);
      }
      applyEditorChange(next, showNext);
    }, 'editor-primary'));
    actions.append(editorButton('Cancel', back));
  });
}

function resetMap() {
  if (!window.confirm('Replace browser edits with the link data loaded from the project files?')) return;
  try {
    localStorage.removeItem(MAP_STORAGE_KEY);
    localStorage.removeItem(UNDO_STORAGE_KEY);
    groups = validateMap(seedData).groups;
    activeMapSource = 'bundled';
    storageWarning = '';
    countDestinations();
    render();
    showSunList();
  } catch (error) {
    editorError(error.message);
  }
}

function showSunList() {
  editorHeader('Edit links', () => showMenuPanel('Settings'));
  menuContent.append(element('p', '', 'Choose a sun to edit its planets and moons. Import JSON replaces the Galaxy; item imports add links. Changes are saved in this browser.'));
  menuContent.append(element('p', 'data-source', `Active link map: ${dataSourceLabel()}`));
  const list = element('div', 'editor-list');
  groups.forEach((sun, index) => {
    const row = element('div', 'editor-list-row');
    row.append(element('span', '', `${sun.name} · ${sun.links.length} planets`));
    row.append(editorButton('Edit', () => showSunEditor(index)));
    list.append(row);
  });
  menuContent.append(list);
  const actions = editorActions();
  actions.append(editorButton('Add sun', () => showSunEditor(null), 'editor-primary'));
  actions.append(editorButton('Import JSON', importMap));
  actions.append(editorButton('Export JSON', exportMap));
  actions.append(editorButton('Import sun', () => importItem('sun')));
  actions.append(editorButton('Import planet as sun', () => importItem('sun', null, null, 'planet')));
  actions.append(editorButton('Reset to file data', resetMap));
}

function showSunEditor(index) {
  const isNew = index === null;
  const sun = isNew ? { name: '', description: '', color: '#79d9f8', links: [] } : groups[index];
  editorHeader(isNew ? 'Add sun' : `Edit ${sun.name}`, showSunList);
  const form = element('form', 'editor-form');
  const name = editorField('Sun name', sun.name);
  const description = editorField('Description', sun.description, 'textarea');
  const color = editorField('Color', sun.color, 'color');
  form.append(name.wrapper, description.wrapper, color.wrapper);
  const actions = element('div', 'editor-actions');
  const save = element('button', 'editor-primary', isNew ? 'Add sun' : 'Save sun');
  save.type = 'submit';
  actions.append(save);
  if (!isNew) {
    actions.append(editorButton('Move up', () => {
      const next = copyGroups();
      if (moveEntry(next, index, -1)) applyEditorChange(next, () => showSunEditor(index - 1));
    }));
    actions.append(editorButton('Move down', () => {
      const next = copyGroups();
      if (moveEntry(next, index, 1)) applyEditorChange(next, () => showSunEditor(index + 1));
    }));
    actions.append(editorButton('Remove sun', () => {
      if (!window.confirm(`Remove ${sun.name} and all its planets and moons?`)) return;
      const next = copyGroups();
      next.splice(index, 1);
      applyEditorChange(next, showSunList, { undoRecord: {
        kind: 'sun', index, item: sun, label: `${sun.name} sun`,
      } });
    }, 'editor-danger'));
  }
  form.append(actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = copyGroups();
    const value = { name: name.input.value.trim(), description: description.input.value.trim(),
      color: color.input.value, links: isNew ? [] : next[index].links };
    if (isNew) {
      value.id = uniqueSunId(value.name, new Set(next.map(item => item.id)));
      next.push(value);
    } else {
      value.id = next[index].id;
      next[index] = value;
    }
    applyEditorChange(next, () => showSunEditor(isNew ? next.length - 1 : index));
  });
  menuContent.append(form);
  if (!isNew) {
    editorActions().append(editorButton('Export sun', () => exportItem('sun', sun)));
    menuContent.append(element('h4', 'editor-section-title', 'Planets'));
    const list = element('div', 'editor-list');
    sun.links.forEach((planet, planetIndex) => {
      const row = element('div', 'editor-list-row');
      row.append(element('span', '', `${planet.name} · ${planet.moons.length} moons`));
      row.append(editorButton('Edit', () => showPlanetEditor(index, planetIndex)));
      list.append(row);
    });
    menuContent.append(list);
    const planetActions = editorActions();
    planetActions.append(editorButton('Add planet', () => showPlanetEditor(index, null), 'editor-primary'));
    planetActions.append(editorButton('Import planet', () => importItem('planet', index)));
  }
}

function showPlanetEditor(sunIndex, planetIndex) {
  const isNew = planetIndex === null;
  const planet = isNew ? { name: '', url: '', moons: [] } : groups[sunIndex].links[planetIndex];
  editorHeader(isNew ? 'Add planet' : `Edit ${planet.name}`, () => showSunEditor(sunIndex));
  menuContent.append(element('p', '', `Sun: ${groups[sunIndex].name}`));
  const form = element('form', 'editor-form');
  const name = editorField('Planet name', planet.name);
  form.append(name.wrapper);
  const readDestination = destinationFields(form, planet, file => {
    if (isNew && !name.input.value.trim()) name.input.value = file.name.replace(/\.rdp$/i, '');
  });
  const actions = element('div', 'editor-actions');
  const save = element('button', 'editor-primary', isNew ? 'Add planet' : 'Save planet');
  save.type = 'submit';
  actions.append(save);
  if (!isNew) {
    for (const [label, amount] of [['Move up', -1], ['Move down', 1]]) {
      actions.append(editorButton(label, () => {
        const next = copyGroups();
        if (moveEntry(next[sunIndex].links, planetIndex, amount)) {
          applyEditorChange(next, () => showPlanetEditor(sunIndex, planetIndex + amount));
        }
      }));
    }
    actions.append(editorButton('Remove planet', () => {
      if (!window.confirm(`Remove ${planet.name} and all its moons?`)) return;
      const next = copyGroups();
      next[sunIndex].links.splice(planetIndex, 1);
      applyEditorChange(next, () => showSunEditor(sunIndex), { undoRecord: {
        kind: 'planet', sunId: groups[sunIndex].id, index: planetIndex,
        item: planet, label: `${planet.name} planet`,
      } });
    }, 'editor-danger'));
  }
  form.append(actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = copyGroups();
    const value = { name: name.input.value.trim(), ...readDestination(),
      moons: isNew ? [] : next[sunIndex].links[planetIndex].moons };
    if (isNew) next[sunIndex].links.push(value);
    else next[sunIndex].links[planetIndex] = value;
    applyEditorChange(next, () => showPlanetEditor(sunIndex,
      isNew ? next[sunIndex].links.length - 1 : planetIndex));
  });
  menuContent.append(form);
  if (!isNew) {
    editorActions().append(editorButton('Export planet', () => exportItem('planet', planet)));
    menuContent.append(element('h4', 'editor-section-title', 'Moons'));
    const list = element('div', 'editor-list');
    planet.moons.forEach((moon, moonIndex) => {
      const row = element('div', 'editor-list-row');
      row.append(element('span', '', moon.name));
      row.append(editorButton('Edit', () => showMoonEditor(sunIndex, planetIndex, moonIndex)));
      list.append(row);
    });
    menuContent.append(list);
    const moonActions = editorActions();
    moonActions.append(editorButton('Add moon', () => showMoonEditor(sunIndex, planetIndex, null), 'editor-primary'));
    moonActions.append(editorButton('Import moon', () => importItem('moon', sunIndex, planetIndex)));
  }
}

function showMoonEditor(sunIndex, planetIndex, moonIndex) {
  const isNew = moonIndex === null;
  const planet = groups[sunIndex].links[planetIndex];
  const moon = isNew ? { name: '', url: '' } : planet.moons[moonIndex];
  editorHeader(isNew ? 'Add moon' : `Edit ${moon.name}`,
    () => showPlanetEditor(sunIndex, planetIndex));
  menuContent.append(element('p', '', `${groups[sunIndex].name} sun → ${planet.name} planet`));
  const form = element('form', 'editor-form');
  const name = editorField('Moon name', moon.name);
  form.append(name.wrapper);
  const readDestination = destinationFields(form, moon, file => {
    if (isNew && !name.input.value.trim()) name.input.value = file.name.replace(/\.rdp$/i, '');
  });
  const actions = element('div', 'editor-actions');
  const save = element('button', 'editor-primary', isNew ? 'Add moon' : 'Save moon');
  save.type = 'submit';
  actions.append(save);
  if (!isNew) {
    for (const [label, amount] of [['Move up', -1], ['Move down', 1]]) {
      actions.append(editorButton(label, () => {
        const next = copyGroups();
        if (moveEntry(next[sunIndex].links[planetIndex].moons, moonIndex, amount)) {
          applyEditorChange(next, () => showMoonEditor(sunIndex, planetIndex, moonIndex + amount));
        }
      }));
    }
    actions.append(editorButton('Remove moon', () => {
      if (!window.confirm(`Remove ${moon.name}?`)) return;
      const next = copyGroups();
      next[sunIndex].links[planetIndex].moons.splice(moonIndex, 1);
      applyEditorChange(next, () => showPlanetEditor(sunIndex, planetIndex), { undoRecord: {
        kind: 'moon', sunId: groups[sunIndex].id, planetIndex,
        planetName: planet.name, planetUrl: planet.url, planetHost: planet.host,
        index: moonIndex, item: moon, label: `${moon.name} moon`,
      } });
    }, 'editor-danger'));
  }
  form.append(actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = copyGroups();
    const value = { name: name.input.value.trim(), ...readDestination() };
    if (isNew) next[sunIndex].links[planetIndex].moons.push(value);
    else next[sunIndex].links[planetIndex].moons[moonIndex] = value;
    applyEditorChange(next, () => showMoonEditor(sunIndex, planetIndex,
      isNew ? next[sunIndex].links[planetIndex].moons.length - 1 : moonIndex));
  });
  menuContent.append(form);
  if (!isNew) editorActions().append(editorButton('Export moon', () => exportItem('moon', moon)));
}

function showEditor(level) {
  if (level === 'suns') showSunList();
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#79d9f8';
}

function linkNode(link, className) {
  const isRdp = link.type === 'rdp';
  const download = isRdp && rdpLaunchMode === 'download';
  const node = element(download ? 'button' : 'a', className, link.name);
  if (download) {
    node.type = 'button';
    node.addEventListener('click', () => downloadRdp(link));
    node.title = `Download Remote Desktop connection for ${link.name}`;
    node.setAttribute('aria-label', node.title);
  } else if (isRdp) {
    node.href = rdpLaunchUrl(link);
    node.title = `Open Remote Desktop Connection for ${link.name}`;
    node.setAttribute('aria-label', node.title);
  } else {
    node.href = link.url;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    node.title = `Open ${link.name} in a new tab`;
    node.setAttribute('aria-label', node.title);
  }
  return node;
}

function orbitLines(points, center, size) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'orbit-lines');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');
  for (const point of points) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', center);
    line.setAttribute('y1', center);
    line.setAttribute('x2', point.x);
    line.setAttribute('y2', point.y);
    svg.append(line);
  }
  return svg;
}

function moonSpokes(points, origin, size) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'moon-spokes');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');
  for (const point of points) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', origin.x);
    line.setAttribute('y1', origin.y);
    line.setAttribute('x2', point.x);
    line.setAttribute('y2', point.y);
    svg.append(line);
  }
  return svg;
}

function planetNode(link, context, point, size, index) {
  const cluster = element('div', `planet-cluster ${context}-planet-cluster`);
  cluster.style.setProperty('--x', `${point.x / size * 100}%`);
  cluster.style.setProperty('--y', `${point.y / size * 100}%`);
  cluster.style.setProperty('--delay', `${index * (context === 'home' ? 35 : 50)}ms`);
  cluster.append(linkNode(link, context === 'home' ? 'home-satellite' : 'detail-satellite'));

  if (link.moons.length) {
    const field = element('div', 'moon-field');
    const outward = 62;
    const radius = context === 'home' ? 78 : 88;
    const outX = Math.cos(point.angle) * outward;
    const outY = Math.sin(point.angle) * outward;
    field.style.setProperty('--out-x', `${outX}px`);
    field.style.setProperty('--out-y', `${outY}px`);
    const visible = link.moons.slice(0, VISIBLE_MOONS);
    const positions = visible.map((_, moonIndex) => {
      const spread = visible.length === 1 ? 0 : -1 + 2 * moonIndex / (visible.length - 1);
      const angle = point.angle + spread * Math.PI / 3;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
    const origin = { x: 110 - outX, y: 110 - outY };
    field.append(moonSpokes(positions.map(position => ({
      x: origin.x + position.x, y: origin.y + position.y,
    })), origin, 220));
    visible.forEach((moon, moonIndex) => {
      const node = linkNode(moon, 'moon-link');
      node.style.setProperty('--mx', `${positions[moonIndex].x - outX}px`);
      node.style.setProperty('--my', `${positions[moonIndex].y - outY}px`);
      field.append(node);
    });
    cluster.append(field);
    cluster.append(element('span', 'moon-badge', `${link.moons.length} moon${link.moons.length === 1 ? '' : 's'}`));
  }
  return cluster;
}

function overflowPlanetNode(link) {
  const item = element('div', 'overflow-planet');
  item.append(linkNode(link, 'more-link'));
  if (link.moons.length) {
    const moons = element('div', 'overflow-moons');
    link.moons.forEach(moon => moons.append(linkNode(moon, 'overflow-moon-link')));
    item.append(moons);
  }
  return item;
}

function homeGroup(group, index) {
  const card = element('section', 'group-card');
  card.style.setProperty('--sun-accent', safeColor(group.color));
  card.style.setProperty('--card-index', index);
  const orbit = element('div', 'home-orbit');
  const visible = group.links.slice(0, GALAXY_PLANETS);
  const center = 160;
  const radius = 108;
  const points = visible.map((_, i) => {
    const angle = (-90 + (360 / visible.length) * i) * Math.PI / 180;
    return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius, angle };
  });

  orbit.append(orbitLines(points, center, 320));
  const hub = element('button', 'home-hub');
  hub.type = 'button';
  hub.setAttribute('aria-label', `Open ${group.name} system with ${group.links.length} planets`);
  hub.append(element('span', 'hub-name', group.name));
  if (group.name.length > 12) hub.classList.add('long-name');
  hub.append(element('span', 'hub-count', `${group.links.length} PLANETS`));
  hub.addEventListener('click', () => { location.hash = `group/${encodeURIComponent(group.id)}`; });
  orbit.append(hub);
  visible.forEach((link, i) => orbit.append(planetNode(link, 'home', points[i], 320, i)));

  card.append(orbit, element('p', 'group-description', group.description));
  return card;
}

function findMatches(query) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const matches = [];
  for (const sun of groups) {
    if (sun.name.toLocaleLowerCase().includes(needle)) {
      matches.push({ kind: 'Sun', name: sun.name, path: 'Galaxy', id: sun.id });
    }
    for (const planet of sun.links) {
      if (planet.name.toLocaleLowerCase().includes(needle)) {
        matches.push({ kind: 'Planet', name: planet.name, path: sun.name, destination: planet });
      }
      for (const moon of planet.moons) {
        if (moon.name.toLocaleLowerCase().includes(needle)) {
          matches.push({ kind: 'Moon', name: moon.name,
            path: `${sun.name} / ${planet.name}`, destination: moon });
        }
      }
    }
  }
  return matches;
}

function findResult(match) {
  const isRdp = match.destination?.type === 'rdp';
  const download = isRdp && rdpLaunchMode === 'download';
  const node = element(match.id || download ? 'button' : 'a', 'find-item');
  if (match.id) {
    node.type = 'button';
    node.addEventListener('click', () => { location.hash = `group/${encodeURIComponent(match.id)}`; });
  } else if (download) {
    node.type = 'button';
    node.addEventListener('click', () => downloadRdp(match.destination));
    node.title = `Download Remote Desktop connection for ${match.name}`;
  } else if (isRdp) {
    node.href = rdpLaunchUrl(match.destination);
    node.title = `Open Remote Desktop Connection for ${match.name}`;
  } else {
    node.href = match.destination.url;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
  }
  node.append(element('span', 'find-kind', match.kind));
  const copy = element('span', 'find-copy');
  copy.append(element('strong', '', match.name), element('small', '', match.path));
  node.append(copy, element('span', 'find-arrow', match.id ? '→' : download ? '↓' : '↗'));
  return node;
}

function renderHome() {
  app.replaceChildren();
  app.className = 'home-view';
  settingsTrigger.hidden = false;
  topbarSearch.hidden = false;
  quickFind.value = findQuery;
  const results = element('section', 'find-results');
  results.setAttribute('aria-live', 'polite');
  const grid = element('div', 'group-grid');
  groups.forEach((group, index) => grid.append(homeGroup(group, index)));
  const updateFind = () => {
    findQuery = quickFind.value;
    const active = Boolean(findQuery.trim());
    grid.hidden = active;
    results.hidden = !active;
    if (!active) return;
    const matches = findMatches(findQuery);
    results.replaceChildren(element('p', 'find-summary', `${matches.length} result${matches.length === 1 ? '' : 's'} for “${findQuery.trim()}”`));
    if (matches.length) {
      const list = element('div', 'find-list');
      matches.forEach(match => list.append(findResult(match)));
      results.append(list);
    } else {
      results.append(element('p', 'find-empty', 'No matching suns, planets, or moons. Try another name.'));
    }
  };
  quickFind.oninput = updateFind;
  app.append(results, grid);
  updateFind();
}

function renderDetail(group) {
  app.replaceChildren();
  app.className = 'detail-view';
  settingsTrigger.hidden = false;
  topbarSearch.hidden = false;
  quickFind.value = findQuery;
  quickFind.oninput = () => {
    findQuery = quickFind.value;
    location.hash = '';
  };
  const top = element('div', 'detail-top');
  const back = element('a', 'back-link', '←  Return to Galaxy');
  back.href = '#';
  top.append(back, element('span', 'detail-index', `${String(groups.indexOf(group) + 1).padStart(2, '0')} / ${String(groups.length).padStart(2, '0')}`));

  const heading = element('div', 'detail-heading');
  heading.append(element('p', 'eyebrow', 'EXPLORE THIS SYSTEM'));
  heading.append(element('h1', '', group.name));
  heading.append(element('p', 'intro-copy', group.description));

  const stage = element('div', 'detail-stage');
  stage.style.setProperty('--sun-accent', safeColor(group.color));
  const visible = group.links.slice(0, SYSTEM_PLANETS);
  const center = 320;
  const radius = 205;
  const points = visible.map((_, i) => {
    const angle = (-90 + (360 / visible.length) * i) * Math.PI / 180;
    return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius, angle };
  });
  stage.append(orbitLines(points, center, 640));
  const hub = element('div', 'detail-hub');
  if (group.name.length > 12) hub.classList.add('long-name');
  hub.append(element('span', 'detail-hub-name', group.name));
  hub.append(element('span', 'detail-hub-sub', `${group.links.length} planets`));
  stage.append(hub);
  visible.forEach((link, i) => stage.append(planetNode(link, 'detail', points[i], 640, i)));

  const note = element('p', 'detail-note', group.links.some(link => link.type === 'rdp')
    ? rdpLaunchMode === 'client'
      ? 'Select a lab to open Remote Desktop Connection with its target loaded. Your browser may ask to open the helper.'
      : 'Select a lab to download its Remote Desktop connection file. Open the file on Windows to connect.'
    : 'Select a planet to open its destination in a new tab.');
  app.append(top, heading, stage, note);
  if (group.links.length > visible.length) {
    const more = element('section', 'more-links');
    more.append(element('h2', '', 'More planets in this system'));
    const list = element('div', 'more-grid');
    group.links.slice(visible.length).forEach(link => list.append(overflowPlanetNode(link)));
    more.append(list);
    app.append(more);
  }
  const extraMoons = group.links.filter(link => link.moons.length > VISIBLE_MOONS);
  if (extraMoons.length) {
    const section = element('section', 'moon-overflow');
    section.append(element('h2', '', 'More moons'));
    extraMoons.forEach(planet => {
      const row = element('div', 'moon-overflow-row');
      row.append(element('h3', '', `Around ${planet.name}`));
      const links = element('div', 'moon-overflow-links');
      planet.moons.slice(VISIBLE_MOONS).forEach(moon => links.append(linkNode(moon, 'overflow-moon-link')));
      row.append(links);
      section.append(row);
    });
    app.append(section);
  }
}

function render() {
  const route = decodeURIComponent(location.hash.slice(1));
  const id = route.startsWith('group/') ? route.slice(6) : null;
  const group = groups.find(item => item.id === id);
  if (group) renderDetail(group);
  else renderHome();
  window.scrollTo({ top: 0, behavior: 'instant' });
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
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && location.hash) location.hash = '';
});
init();
