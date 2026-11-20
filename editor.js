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
  const tags = editorField('Tags', (destination.tags || []).join(', '));
  tags.input.placeholder = 'For example: prod, windows';
  tags.input.setAttribute('aria-label', 'Tags');
  tags.wrapper.append(element('small', 'editor-hint', 'Separate tags with commas. Find tagged links with #tag in Quick find.'));
  const favorite = element('label', 'editor-check');
  const favoriteInput = document.createElement('input');
  favoriteInput.type = 'checkbox';
  favoriteInput.checked = destination.favorite === true;
  favorite.append(favoriteInput, element('span', '', 'Favorite (shown at the top of the Galaxy)'));
  form.append(type, url.wrapper, host.wrapper, profileNote, importRdp, tags.wrapper, favorite);
  update();
  return () => {
    const extras = {
      ...(tags.input.value.trim() ? { tags: tags.input.value } : {}),
      ...(favoriteInput.checked ? { favorite: true } : {}),
    };
    return select.value === 'rdp'
      ? { type: 'rdp', host: host.input.value.trim(), ...(rdpProfile ? { rdpProfile } : {}), ...extras }
      : { url: url.input.value.trim(), ...extras };
  };
}

// A note when this destination is also elsewhere in the map. Copies are
// allowed; the note only helps spot accidental duplicates.
function duplicateNote(item, path) {
  if (!item?.name) return null;
  const others = pathsForKey(destinationKey(item)).filter(other => other.join(':') !== path.join(':'));
  if (!others.length) return null;
  const where = others.slice(0, 3).map(other => pathLabel(other)).join('; ');
  return element('p', 'editor-note', `Also in ${where}${others.length > 3 ? `, and ${others.length - 3} more` : ''}. This is fine for a deliberate copy.`);
}

function pathLabel(path) {
  const sun = groups[path[0]];
  const planet = sun?.links[path[1]];
  if (!planet) return '';
  return path.length === 3 ? `${sun.name} → ${planet.name} → ${planet.moons[path[2]]?.name}` : `${sun.name} → ${planet.name}`;
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
    saveMap({ groups: nextGroups, ...(options.routines !== undefined ? { routines: options.routines } : {}) },
      options.label || 'Edit links change');
    if (options.clearUndo) localStorage.removeItem(UNDO_STORAGE_KEY);
    storageWarning = '';
    showNext();
    renderEditorTree();
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

// The team map is never exported with the personal map.
function exportMap() {
  downloadJson({ groups: personalGroups(groups), ...(routines.length ? { routines } : {}) }, 'orbit-links.json');
}

function exportItem(kind, item) {
  const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || kind;
  downloadJson({ format: 'orbit-item-v1', kind, item: plainCopy(item) }, `orbit-${kind}-${slug}.json`);
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

// Review a whole map before adding it. Merge (the default) adds only what is
// new; Replace swaps the personal map for the file. `options.title` and
// `options.replace` let other imports (bookmarks) reuse this screen.
function showImportReview(data, options = {}) {
  editorHeader(options.title || 'Review import', showSunList);
  const planetCount = data.groups.reduce((sum, sun) => sum + sun.links.length, 0);
  const moonCount = data.groups.reduce((sum, sun) => sum + sun.links.reduce(
    (total, planet) => total + planet.moons.length, 0), 0);
  if (options.note) menuContent.append(element('p', '', options.note));
  menuContent.append(element('p', '', `The file has ${counted(data.groups.length, 'sun')} · ${counted(planetCount, 'planet')} · ${counted(moonCount, 'moon')}.`));
  const merged = mergeMaps(personalGroups(groups), data.groups);
  const { added, skipped } = merged;
  const newRoutines = mergeRoutines(routines, data.routines || []);
  const addedRoutines = newRoutines.length - routines.length;
  menuContent.append(element('p', 'import-merge-summary', `Merge adds ${counted(added.suns, 'sun')}, ${counted(added.planets, 'planet')}, and ${counted(added.moons, 'moon')}${addedRoutines ? ` and ${counted(addedRoutines, 'routine')}` : ''}; ${counted(skipped.planets + skipped.moons, 'link')} already in your map ${skipped.planets + skipped.moons === 1 ? 'is' : 'are'} skipped. Nothing in your map changes.`));
  const actions = editorActions();
  const merge = editorButton('Merge into my map', () =>
    applyEditorChange([...groups.filter(sun => sun.team), ...merged.groups], showSunList,
      { label: options.label || 'Merged an imported map', routines: newRoutines }), 'editor-primary');
  merge.disabled = !(added.suns + added.planets + added.moons + addedRoutines);
  actions.append(merge);
  if (options.replace !== false) {
    menuContent.append(element('p', 'editor-hint', 'Replace my map swaps your whole map for the file. Version history keeps the current map, so you can restore it.'));
    actions.append(editorButton('Replace my map', () =>
      applyEditorChange(data.groups, showSunList,
        { clearUndo: true, label: 'Replaced the map with an import', routines: data.routines || [] })));
  }
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
      menuContent.append(element('p', '', `${counted(item.links.length, 'planet')} · ${counted(moons, 'moon')}`));
    } else if (kind === 'planet') {
      menuContent.append(element('p', '', `${counted(item.moons.length, 'moon')} · ${item.host || item.url}`));
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
    recordHistory(personalGroups(groups), 'Reset to file data', routines);
    localStorage.removeItem(MAP_STORAGE_KEY);
    localStorage.removeItem(UNDO_STORAGE_KEY);
    groups = [...visibleTeamGroups(), ...validateMap(seedData).groups];
    routines = validateMap(seedData).routines || [];
    mapRevision++;
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
  editorHeader('Edit links', () => editorTree ? leaveEditorPage() : showMenuPanel('Settings'));
  menuContent.append(element('p', '', 'Choose a sun to edit its planets and moons. Import JSON and Import bookmarks add what is new (Import JSON can also replace your map); item imports add links. Changes are saved in this browser, and History keeps earlier versions.'));
  menuContent.append(element('p', 'data-source', `Active link map: ${dataSourceLabel()}`));
  const list = element('div', 'editor-list');
  groups.forEach((sun, index) => {
    const row = element('div', 'editor-list-row');
    row.append(element('span', '', `${sun.icon ? `${sun.icon} ` : ''}${sun.name} · ${counted(sun.links.length, 'planet')}${sun.team ? ' · team, read-only' : ''}`));
    row.append(editorButton(sun.team ? 'View' : 'Edit', () => showSunEditor(index)));
    list.append(row);
  });
  menuContent.append(list);
  const hidden = teamGroups.filter(sun => hiddenTeamSuns().has(sun.id));
  if (hidden.length) {
    menuContent.append(element('p', 'data-source', `${counted(hidden.length, 'team sun')} hidden. Show them again in Settings.`));
  }
  const actions = editorActions();
  actions.append(editorButton('Add sun', () => showSunEditor(null), 'editor-primary'));
  actions.append(editorButton('Import JSON', importMap));
  actions.append(editorButton('Import bookmarks', importBookmarks));
  actions.append(editorButton('Export JSON', exportMap));
  actions.append(editorButton('Import sun', () => importItem('sun')));
  actions.append(editorButton('Import planet as sun', () => importItem('sun', null, null, 'planet')));
  actions.append(editorButton('Reset to file data', resetMap));
  menuContent.append(element('h4', 'editor-section-title', 'Tools'));
  const tools = editorActions();
  tools.append(editorButton('Routines', showRoutines));
  tools.append(editorButton('History', showHistory));
  tools.append(editorButton('Find duplicates', showDuplicates));
  tools.append(editorButton('Check links', showLinkCheck));
  const tags = tagCounts();
  if (tags.length) {
    menuContent.append(element('h4', 'editor-section-title', 'Tags'));
    const list = element('div', 'tag-list');
    tags.forEach(([tag, count]) => list.append(editorButton(`#${tag} · ${count}`, () => {
      closeMenu();
      findQuery = `#${tag}`;
      quickFind.value = findQuery;
      if (location.hash && location.hash !== '#') location.hash = '';
      else render();
    }, 'tag-button')));
    menuContent.append(list);
  }
  renderEditorTree();
}

// Every tag in the map, most used first.
function tagCounts() {
  const counts = new Map();
  groups.forEach(sun => sun.links.forEach(planet => [planet, ...planet.moons].forEach(item =>
    (item.tags || []).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)))));
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function showSunEditor(index) {
  if (index !== null && groups[index]?.team) return showTeamSun(index);
  const isNew = index === null;
  const sun = isNew ? { name: '', description: '', color: '#79d9f8', links: [] } : groups[index];
  editorHeader(isNew ? 'Add sun' : `Edit ${sun.name}`, showSunList);
  const form = element('form', 'editor-form');
  const name = editorField('Sun name', sun.name);
  const description = editorField('Description', sun.description, 'textarea');
  description.wrapper.append(element('small', 'editor-hint', 'Use [label](https://example.com) to add a link within the description.'));
  const color = editorField('Color', sun.color, 'color');
  const icon = editorField('Icon', sun.icon || '');
  icon.input.maxLength = 16;
  icon.input.placeholder = 'Optional, for example 🧪';
  icon.input.setAttribute('aria-label', 'Icon');
  icon.wrapper.append(element('small', 'editor-hint', 'One or two characters, such as an emoji, shown above the sun’s name.'));
  form.append(name.wrapper, description.wrapper, color.wrapper, icon.wrapper);
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
      applyEditorChange(next, showSunList, { label: `Removed sun ${sun.name}`, undoRecord: {
        kind: 'sun', index, item: sun, label: `${sun.name} sun`,
      } });
    }, 'editor-danger'));
  }
  form.append(actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = copyGroups();
    const value = { name: name.input.value.trim(), description: description.input.value.trim(),
      color: color.input.value, icon: icon.input.value, links: isNew ? [] : next[index].links };
    if (isNew) {
      value.id = uniqueSunId(value.name, new Set(next.map(item => item.id)));
      next.push(value);
    } else {
      value.id = next[index].id;
      next[index] = value;
    }
    applyEditorChange(next, () => showSunEditor(isNew ? next.length - 1 : index),
      { label: `${isNew ? 'Added' : 'Saved'} sun ${value.name}` });
  });
  menuContent.append(form);
  if (!isNew) {
    editorActions().append(editorButton('Export sun', () => exportItem('sun', sun)));
    menuContent.append(element('h4', 'editor-section-title', 'Planets'));
    const list = element('div', 'editor-list');
    sun.links.forEach((planet, planetIndex) => {
      const row = element('div', 'editor-list-row');
      row.append(element('span', '', `${planet.name} · ${counted(planet.moons.length, 'moon')}`));
      row.append(editorButton('Edit', () => showPlanetEditor(index, planetIndex)));
      list.append(row);
    });
    menuContent.append(list);
    const planetActions = editorActions();
    planetActions.append(editorButton('Add planet', () => showPlanetEditor(index, null), 'editor-primary'));
    planetActions.append(editorButton('Import planet', () => importItem('planet', index)));
    planetActions.append(editorButton('Import .rdp files as planets', () => showRdpBatchImport('planet', index)));
  }
}

function showPlanetEditor(sunIndex, planetIndex) {
  if (groups[sunIndex]?.team) return showTeamItem([sunIndex, planetIndex]);
  const isNew = planetIndex === null;
  const planet = isNew ? { name: '', url: '', moons: [] } : groups[sunIndex].links[planetIndex];
  editorHeader(isNew ? 'Add planet' : `Edit ${planet.name}`, () => showSunEditor(sunIndex));
  menuContent.append(element('p', '', `Sun: ${groups[sunIndex].name}`));
  if (!isNew) {
    const note = duplicateNote(planet, [sunIndex, planetIndex]);
    if (note) menuContent.append(note);
  }
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
    actions.append(editorButton('Move to another sun', () => showMovePlanet(sunIndex, planetIndex)));
    actions.append(editorButton('Remove planet', () => {
      if (!window.confirm(`Remove ${planet.name} and all its moons?`)) return;
      const next = copyGroups();
      next[sunIndex].links.splice(planetIndex, 1);
      applyEditorChange(next, () => showSunEditor(sunIndex), { label: `Removed planet ${planet.name}`, undoRecord: {
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
      isNew ? next[sunIndex].links.length - 1 : planetIndex), { label: `${isNew ? 'Added' : 'Saved'} planet ${value.name}` });
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
    moonActions.append(editorButton('Import .rdp files as moons', () => showRdpBatchImport('moon', sunIndex, planetIndex)));
    if (planet.moons.some(moon => moon.type === 'rdp')) {
      moonActions.append(editorButton('Apply RDP settings to moons', () => showBulkRdp(sunIndex, planetIndex)));
    }
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
    if ((targetSunIndex === sunIndex && targetPlanetIndex === planetIndex) || sun.team) return;
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
  if (groups[sunIndex]?.team) return showTeamItem([sunIndex, planetIndex, moonIndex]);
  const isNew = moonIndex === null;
  const planet = groups[sunIndex].links[planetIndex];
  const moon = isNew ? { name: '', url: '' } : planet.moons[moonIndex];
  editorHeader(isNew ? 'Add moon' : `Edit ${moon.name}`,
    () => showPlanetEditor(sunIndex, planetIndex));
  menuContent.append(element('p', '', `${groups[sunIndex].name} sun → ${planet.name} planet`));
  if (!isNew) {
    const note = duplicateNote(moon, [sunIndex, planetIndex, moonIndex]);
    if (note) menuContent.append(note);
  }
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
    actions.append(editorButton('Move to another planet', () => showMoveMoon(sunIndex, planetIndex, moonIndex)));
    actions.append(editorButton('Remove moon', () => {
      if (!window.confirm(`Remove ${moon.name}?`)) return;
      const next = copyGroups();
      next[sunIndex].links[planetIndex].moons.splice(moonIndex, 1);
      applyEditorChange(next, () => showPlanetEditor(sunIndex, planetIndex), { label: `Removed moon ${moon.name}`, undoRecord: {
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
      isNew ? next[sunIndex].links[planetIndex].moons.length - 1 : moonIndex), { label: `${isNew ? 'Added' : 'Saved'} moon ${value.name}` });
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
