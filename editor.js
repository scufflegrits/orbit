// Link editor: sun, planet, and moon forms, JSON import and export, and reset.
// Loaded as a classic script before app.js. Uses shared state and helpers from
// app.js (groups, menuContent, element, render, ...) only when called.

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
    importRdp.hidden = select.value !== 'rdp';
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

function editorMoveControls(actions, index, count, onMove) {
  const up = editorButton('Move up', () => onMove(-1));
  up.disabled = index === 0;
  const down = editorButton('Move down', () => onMove(1));
  down.disabled = index === count - 1;
  actions.append(up, element('span', 'editor-position', `${index + 1} of ${count}`), down);
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
  description.wrapper.append(element('small', 'editor-hint', 'Use [label](https://example.com) to add a link within the description.'));
  const color = editorField('Color', sun.color, 'color');
  form.append(name.wrapper, description.wrapper, color.wrapper);
  const actions = element('div', 'editor-actions');
  const save = element('button', 'editor-primary', isNew ? 'Add sun' : 'Save sun');
  save.type = 'submit';
  actions.append(save);
  if (!isNew) {
    editorMoveControls(actions, index, groups.length, amount => {
      const next = copyGroups();
      if (moveEntry(next, index, amount)) applyEditorChange(next, () => showSunEditor(index + amount));
    });
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
    editorMoveControls(actions, planetIndex, groups[sunIndex].links.length, amount => {
      const next = copyGroups();
      if (moveEntry(next[sunIndex].links, planetIndex, amount)) {
        applyEditorChange(next, () => showPlanetEditor(sunIndex, planetIndex + amount));
      }
    });
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

function showCopyMoon(sunIndex, planetIndex, moonIndex) {
  const sourceSun = groups[sunIndex];
  const sourcePlanet = sourceSun.links[planetIndex];
  const moon = sourcePlanet.moons[moonIndex];
  const back = () => showMoonEditor(sunIndex, planetIndex, moonIndex);
  editorHeader(`Copy ${moon.name}`, back);
  menuContent.append(element('p', '', `From ${sourceSun.name} sun → ${sourcePlanet.name} planet`));
  menuContent.append(element('p', '', 'This copies the saved moon as an independent link. Later edits to either moon will not change the other.'));
  const target = element('label', 'editor-field');
  target.append(element('span', '', 'Copy to planet'));
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Copy to planet');
  groups.forEach((sun, targetSunIndex) => sun.links.forEach((planet, targetPlanetIndex) => {
    if (targetSunIndex === sunIndex && targetPlanetIndex === planetIndex) return;
    const option = element('option', '', `${sun.name} → ${planet.name}`);
    option.value = `${targetSunIndex}:${targetPlanetIndex}`;
    select.append(option);
  }));
  if (!select.options.length) {
    menuContent.append(element('p', '', 'Add another planet before copying this moon.'));
    return;
  }
  target.append(select);
  menuContent.append(target);
  editorActions().append(editorButton('Copy to selected planet', () => {
    const [targetSunIndex, targetPlanetIndex] = select.value.split(':').map(Number);
    const next = copyGroups();
    const targetMoons = next[targetSunIndex].links[targetPlanetIndex].moons;
    targetMoons.push(JSON.parse(JSON.stringify(moon)));
    applyEditorChange(next, () => showMoonEditor(targetSunIndex, targetPlanetIndex, targetMoons.length - 1));
  }, 'editor-primary'));
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
    editorMoveControls(actions, moonIndex, planet.moons.length, amount => {
      const next = copyGroups();
      if (moveEntry(next[sunIndex].links[planetIndex].moons, moonIndex, amount)) {
        applyEditorChange(next, () => showMoonEditor(sunIndex, planetIndex, moonIndex + amount));
      }
    });
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
  if (!isNew) {
    const extraActions = editorActions();
    extraActions.append(editorButton('Copy moon', () => showCopyMoon(sunIndex, planetIndex, moonIndex)));
    extraActions.append(editorButton('Export moon', () => exportItem('moon', moon)));
  }
}

function showEditor(level) {
  if (level === 'suns') showSunList();
}
