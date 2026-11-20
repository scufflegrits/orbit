// Full-screen edit workspace and cross-parent moves. Loaded after editor.js.

let editorTree = null;

function openEditorPage() {
  const sheet = menuOverlay.querySelector('.menu-sheet');
  sheet.classList.add('editor-page-mode');
  sheet.querySelector('.menu-top h2').textContent = 'Edit your Galaxy';
  const layout = element('div', 'editor-page-layout');
  editorTree = element('nav', 'editor-tree');
  editorTree.setAttribute('aria-label', 'Galaxy link tree');
  const pane = element('section', 'editor-pane');
  layout.append(editorTree, pane);
  menuRoot.replaceChildren(layout);
  menuContent = pane;
  renderEditorTree();
  showSunList();
  editorTree.querySelector('button')?.focus();
}

// Open Edit links on one planet ([sun, planet]) or moon ([sun, planet, moon]).
function openEditorAt(indices) {
  openMenu();
  openEditorPage();
  if (indices.length === 3) showMoonEditor(...indices);
  else showPlanetEditor(...indices);
}

function leaveEditorPage() {
  menuOverlay.querySelector('.menu-sheet').classList.remove('editor-page-mode');
  menuOverlay.querySelector('.menu-top h2').textContent = 'Explore the menu';
  editorTree = null;
  menuContent = menuRoot;
  showMenuPanel('Settings');
  menuRoot.querySelector('.editor-open')?.focus();
}

function renderEditorTree() {
  if (!editorTree) return;
  editorTree.replaceChildren(element('h3', '', 'Galaxy'));
  groups.forEach((sun, sunIndex) => {
    const sunButton = editorButton(`${sun.icon ? `${sun.icon} ` : ''}${sun.name} · ${counted(sun.links.length, 'planet')}${sun.team ? ' · team' : ''}`,
      () => showSunEditor(sunIndex), 'editor-tree-item editor-tree-sun');
    editorTree.append(sunButton);
    sun.links.forEach((planet, planetIndex) => {
      const planetButton = editorButton(`${planet.name} · ${counted(planet.moons.length, 'moon')}`,
        () => showPlanetEditor(sunIndex, planetIndex), 'editor-tree-item editor-tree-planet');
      decorateTreeItem(planetButton, planet);
      editorTree.append(planetButton);
      planet.moons.forEach((moon, moonIndex) => {
        const moonButton = editorButton(moon.name,
          () => showMoonEditor(sunIndex, planetIndex, moonIndex), 'editor-tree-item editor-tree-moon');
        decorateTreeItem(moonButton, moon);
        editorTree.append(moonButton);
      });
    });
  });
}

// Tags, and a warning mark for a link the last Check links found broken.
function decorateTreeItem(button, item) {
  const result = linkCheckResults.get(destinationKey(item));
  if (result && !result.ok) {
    button.classList.add('editor-tree-broken');
    button.prepend(element('span', 'broken-mark', '⚠ '));
    button.title = `Last check: ${result.status ? `HTTP ${result.status}` : result.error}`;
  }
  if (item.tags?.length) button.append(tagChips(item.tags));
}

function moveTargetField(options) {
  const field = element('label', 'editor-field');
  field.append(element('span', '', 'Move to'));
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Move to');
  options.forEach(([value, label]) => {
    const option = element('option', '', label);
    option.value = value;
    select.append(option);
  });
  field.append(select);
  menuContent.append(field);
  return select;
}

// Position within the chosen parent, so keyboard users can insert as well as append.
function movePositionField(targetSelect, siblingNames) {
  const field = element('label', 'editor-field');
  field.append(element('span', '', 'Position'));
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Position');
  const refresh = () => {
    select.replaceChildren();
    const end = element('option', '', 'At the end');
    end.value = 'end';
    select.append(end);
    siblingNames(targetSelect.value).forEach((name, index) => {
      const option = element('option', '', `Before ${name}`);
      option.value = index;
      select.append(option);
    });
  };
  targetSelect.addEventListener('change', refresh);
  refresh();
  field.append(select);
  menuContent.append(field);
  return select;
}

function showMovePlanet(sunIndex, planetIndex) {
  const sun = groups[sunIndex];
  const planet = sun.links[planetIndex];
  editorHeader(`Move ${planet.name}`, () => showPlanetEditor(sunIndex, planetIndex));
  menuContent.append(element('p', '', `From ${sun.name} sun. Its moons move with it.`));
  const options = groups.flatMap((target, index) => index === sunIndex || target.team ? [] : [[String(index), target.name]]);
  if (!options.length) {
    menuContent.append(element('p', '', 'Add another sun before moving this planet.'));
    return;
  }
  const select = moveTargetField(options);
  const position = movePositionField(select, value => groups[Number(value)].links.map(item => item.name));
  editorActions().append(editorButton('Move planet', () => {
    const sun = Number(select.value);
    const moved = moveMapItem(groups, { kind: 'planet', sun: sunIndex, planet: planetIndex },
      position.value === 'end' ? { kind: 'sun', sun }
        : { kind: 'planet', sun, planet: Number(position.value), place: 'before' });
    if (moved.status !== 'moved') return editorError('That planet could not be moved.');
    applyEditorChange(moved.groups, () => showPlanetEditor(moved.path.sun, moved.path.planet),
      { label: `Moved planet ${planet.name} to ${groups[sun].name}` });
  }, 'editor-primary'));
}

function showMoveMoon(sunIndex, planetIndex, moonIndex) {
  const sun = groups[sunIndex];
  const planet = sun.links[planetIndex];
  const moon = planet.moons[moonIndex];
  editorHeader(`Move ${moon.name}`, () => showMoonEditor(sunIndex, planetIndex, moonIndex));
  menuContent.append(element('p', '', `From ${sun.name} sun → ${planet.name} planet.`));
  const options = groups.flatMap((targetSun, targetSunIndex) => targetSun.links.flatMap(
    (targetPlanet, targetPlanetIndex) => (targetSunIndex === sunIndex && targetPlanetIndex === planetIndex) || targetSun.team
      ? [] : [[`${targetSunIndex}:${targetPlanetIndex}`, `${targetSun.name} → ${targetPlanet.name}`]]));
  if (!options.length) {
    menuContent.append(element('p', '', 'Add another planet before moving this moon.'));
    return;
  }
  const select = moveTargetField(options);
  const position = movePositionField(select, value => {
    const [targetSun, targetPlanet] = value.split(':').map(Number);
    return groups[targetSun].links[targetPlanet].moons.map(item => item.name);
  });
  editorActions().append(editorButton('Move moon', () => {
    const [targetSunIndex, targetPlanetIndex] = select.value.split(':').map(Number);
    const parent = { sun: targetSunIndex, planet: targetPlanetIndex };
    const moved = moveMapItem(groups,
      { kind: 'moon', sun: sunIndex, planet: planetIndex, moon: moonIndex },
      position.value === 'end' ? { kind: 'planet', ...parent }
        : { kind: 'moon', ...parent, moon: Number(position.value), place: 'before' });
    if (moved.status !== 'moved') return editorError('That moon could not be moved.');
    applyEditorChange(moved.groups,
      () => showMoonEditor(moved.path.sun, moved.path.planet, moved.path.moon),
      { label: `Moved moon ${moon.name}` });
  }, 'editor-primary'));
}

async function droppedFiles(dataTransfer) {
  const entries = [...dataTransfer.items].map(item => item.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return [...dataTransfer.files];
  const visit = async entry => {
    if (entry.isFile) {
      return [await new Promise((resolve, reject) => entry.file(resolve, reject))];
    }
    if (!entry.isDirectory) return [];
    const reader = entry.createReader();
    const files = [];
    while (true) {
      const children = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      if (!children.length) break;
      for (const child of children) files.push(...await visit(child));
    }
    return files;
  };
  const files = [];
  for (const entry of entries) files.push(...await visit(entry));
  return files;
}

function showRdpBatchImport(kind, sunIndex, planetIndex = null) {
  const sun = groups[sunIndex];
  const parent = kind === 'moon' ? sun.links[planetIndex] : sun;
  const back = kind === 'moon' ? () => showPlanetEditor(sunIndex, planetIndex)
    : () => showSunEditor(sunIndex);
  editorHeader('Import .rdp files', back);
  menuContent.append(element('p', '', `Add ${kind}s under ${sun.name}${kind === 'moon' ? ` → ${parent.name}` : ''}. Existing links stay in place.`));
  menuContent.append(element('p', '', 'Pick multiple .rdp files or a folder, or drop them here. Orbit reads the files in this browser and excludes password, token, and signature settings.'));
  const dropZone = element('div', 'rdp-dropzone', 'Drop .rdp files or a folder here');
  const preview = element('div', 'rdp-batch-preview');
  const actions = editorActions();
  const add = editorButton('Add imported links', () => {
    const next = copyGroups();
    const target = kind === 'moon' ? next[sunIndex].links[planetIndex].moons : next[sunIndex].links;
    target.push(...prepared);
    applyEditorChange(next, back, { label: `Imported ${counted(prepared.length, kind)} from .rdp files` });
  }, 'editor-primary');
  add.disabled = true;
  let prepared = [];
  let selectionVersion = 0;
  const prepare = async files => {
    const version = ++selectionVersion;
    prepared = [];
    add.disabled = true;
    preview.replaceChildren();
    menuContent.querySelector('.editor-error')?.remove();
    try {
      const selected = files.filter(file => /\.rdp$/i.test(file.name));
      if (!selected.length) throw new Error('Choose at least one .rdp file.');
      if (selected.length > 100) throw new Error('Choose at most 100 .rdp files at once.');
      const imported = [];
      let excluded = 0;
      for (const file of selected) {
        let parsed;
        try { parsed = parseRdpProfile(await readRdpText(file)); }
        catch (error) { throw new Error(`${file.name}: ${error.message}`); }
        imported.push({ name: file.name.replace(/\.rdp$/i, '') || 'Remote Desktop',
          type: 'rdp', host: parsed.host, rdpProfile: parsed.content });
        excluded += parsed.removed;
      }
      if (version !== selectionVersion || !menuContent.contains(dropZone)) return;
      prepared = imported;
      preview.append(element('p', '', `${imported.length} ${kind}${imported.length === 1 ? '' : 's'} ready · ${excluded} sensitive settings excluded · ${files.length - selected.length} other files skipped.`));
      const list = element('ul', 'rdp-batch-list');
      imported.forEach(item => list.append(element('li', '', `${item.name} → ${item.host}`)));
      preview.append(list);
      add.disabled = false;
    } catch (error) {
      if (version === selectionVersion && menuContent.contains(dropZone)) {
        editorError(`RDP import failed: ${error.message}`);
      }
    }
  };
  const choose = folder => {
    const input = document.createElement('input');
    input.type = 'file';
    if (folder) input.setAttribute('webkitdirectory', '');
    else { input.multiple = true; input.accept = '.rdp,application/x-rdp'; }
    input.addEventListener('change', () => { if (input.files.length) prepare([...input.files]); });
    input.click();
  };
  dropZone.addEventListener('dragover', event => event.preventDefault());
  dropZone.addEventListener('drop', async event => {
    event.preventDefault();
    try { await prepare(await droppedFiles(event.dataTransfer)); }
    catch (error) { editorError(`RDP import failed: ${error.message}`); }
  });
  menuContent.append(dropZone);
  actions.append(editorButton('Choose .rdp files', () => choose(false)));
  actions.append(editorButton('Choose folder', () => choose(true)));
  actions.append(add);
  menuContent.append(preview);
}
