// The full-page editor (2.2.1 editor-page.js): opening and leaving it, the
// Galaxy tree beside the forms, moving a planet or moon to another parent,
// and importing many .rdp files at once. Moved in rewrite phase 6b.
import { destinationKey } from '../../core/destination.js';
import * as mapOps from '../../core/map-ops.js';
import * as rdp from '../../core/rdp.js';
import * as fileIo from '../../services/file-io.js';
import { counted, element, tagChips } from '../dom.js';
import { hooks } from '../hooks.js';
import { modes } from '../page-modes.js';
import { applyEditorChange, copyGroups, editorActions, editorButton, editorError, editorHeader, editorTree, linkCheckResults,
  movePositionField, moveTargetField, setEditorTree } from './kit.js';
import { nav } from './nav.js';
import { groups, menuContent, menuOverlay, menuRoot, setMenuContent } from '../page.js';

export function openEditorPage() {
  modes.send('openEditor');
  const sheet = /** @type {HTMLElement} */ (menuOverlay.querySelector('.menu-sheet'));
  sheet.classList.add('editor-page-mode');
  /** @type {HTMLElement} */ (sheet.querySelector('.menu-top h2')).textContent = 'Edit your Galaxy';
  const layout = element('div', 'editor-page-layout');
  const tree = element('nav', 'editor-tree');
  setEditorTree(tree);
  tree.setAttribute('aria-label', 'Galaxy link tree');
  const pane = element('section', 'editor-pane');
  layout.append(tree, pane);
  menuRoot.replaceChildren(layout);
  setMenuContent(pane);
  renderEditorTree();
  nav.showSunList();
  tree.querySelector('button')?.focus();
}

/**
 * @param {any} indices
 */
export function openEditorAt(indices) {
  hooks.openMenu();
  openEditorPage();
  if (indices.length === 3) nav.showMoonEditor(indices[0], indices[1], indices[2]);
  else nav.showPlanetEditor(indices[0], indices[1]);
}

export function leaveEditorPage() {
  modes.send('backToPanels');
  /** @type {HTMLElement} */ (menuOverlay.querySelector('.menu-sheet')).classList.remove('editor-page-mode');
  /** @type {HTMLElement} */ (menuOverlay.querySelector('.menu-top h2')).textContent = 'Explore the menu';
  setEditorTree(null);
  setMenuContent(menuRoot);
  hooks.showMenuPanel('Settings');
  /** @type {HTMLElement | null} */ (menuRoot.querySelector('.editor-open'))?.focus();
}

export function renderEditorTree() {
  const tree = editorTree;
  if (!tree) return;
  tree.replaceChildren(element('h3', '', 'Galaxy'));
  groups.forEach((sun, sunIndex) => {
    const sunButton = editorButton(`${sun.icon ? `${sun.icon} ` : ''}${sun.name} · ${counted(sun.links.length, 'planet')}${sun.team ? ' · team' : ''}`,
      () => nav.showSunEditor(sunIndex), 'editor-tree-item editor-tree-sun');
    tree.append(sunButton);
    sun.links.forEach((/** @type {any} */ planet, /** @type {any} */ planetIndex) => {
      const planetButton = editorButton(`${planet.name} · ${counted(planet.moons.length, 'moon')}`,
        () => nav.showPlanetEditor(sunIndex, planetIndex), 'editor-tree-item editor-tree-planet');
      decorateTreeItem(planetButton, planet);
      tree.append(planetButton);
      planet.moons.forEach((/** @type {any} */ moon, /** @type {any} */ moonIndex) => {
        const moonButton = editorButton(moon.name,
          () => nav.showMoonEditor(sunIndex, planetIndex, moonIndex), 'editor-tree-item editor-tree-moon');
        decorateTreeItem(moonButton, moon);
        tree.append(moonButton);
      });
    });
  });
}

/**
 * @param {any} button
 * @param {any} item
 */
export function decorateTreeItem(button, item) {
  const result = linkCheckResults.get(destinationKey(item));
  if (result && !result.ok) {
    button.classList.add('editor-tree-broken');
    button.prepend(element('span', 'broken-mark', '⚠ '));
    button.title = `Last check: ${result.status ? `HTTP ${result.status}` : result.error}`;
  }
  if (item.tags?.length) button.append(tagChips(item.tags));
}

/**
 * @param {any} sunIndex
 * @param {any} planetIndex
 */
export function showMovePlanet(sunIndex, planetIndex) {
  const sun = groups[sunIndex];
  const planet = sun.links[planetIndex];
  editorHeader(`Move ${planet.name}`, () => nav.showPlanetEditor(sunIndex, planetIndex));
  menuContent.append(element('p', '', `From ${sun.name} sun. Its moons move with it.`));
  const options = groups.flatMap((target, index) => index === sunIndex || target.team ? [] : [[String(index), target.name]]);
  if (!options.length) {
    menuContent.append(element('p', '', 'Add another sun before moving this planet.'));
    return;
  }
  const select = moveTargetField(options);
  const position = movePositionField(select, (/** @type {any} */ value) => groups[Number(value)].links.map((/** @type {any} */ item) => item.name));
  editorActions().append(editorButton('Move planet', () => {
    const sun = Number(select.value);
    const moved = /** @type {any} */ (mapOps.moveMapItem(groups, { kind: 'planet', sun: sunIndex, planet: planetIndex },
      position.value === 'end' ? { kind: 'sun', sun }
        : { kind: 'planet', sun, planet: Number(position.value), place: 'before' }));
    if (moved.status !== 'moved') return editorError('That planet could not be moved.');
    applyEditorChange(moved.groups, () => nav.showPlanetEditor(moved.path.sun, moved.path.planet),
      { label: `Moved planet ${planet.name} to ${groups[sun].name}` });
  }, 'editor-primary'));
}

/**
 * @param {any} sunIndex
 * @param {any} planetIndex
 * @param {any} moonIndex
 */
export function showMoveMoon(sunIndex, planetIndex, moonIndex) {
  const sun = groups[sunIndex];
  const planet = sun.links[planetIndex];
  const moon = planet.moons[moonIndex];
  editorHeader(`Move ${moon.name}`, () => nav.showMoonEditor(sunIndex, planetIndex, moonIndex));
  menuContent.append(element('p', '', `From ${sun.name} sun → ${planet.name} planet.`));
  const options = groups.flatMap((targetSun, targetSunIndex) => targetSun.links.flatMap(
    (/** @type {any} */ targetPlanet, /** @type {any} */ targetPlanetIndex) => (targetSunIndex === sunIndex && targetPlanetIndex === planetIndex) || targetSun.team
      ? [] : [[`${targetSunIndex}:${targetPlanetIndex}`, `${targetSun.name} → ${targetPlanet.name}`]]));
  if (!options.length) {
    menuContent.append(element('p', '', 'Add another planet before moving this moon.'));
    return;
  }
  const select = moveTargetField(options);
  const position = movePositionField(select, (/** @type {any} */ value) => {
    const [targetSun, targetPlanet] = value.split(':').map(Number);
    return groups[targetSun].links[targetPlanet].moons.map((/** @type {any} */ item) => item.name);
  });
  editorActions().append(editorButton('Move moon', () => {
    const [targetSunIndex, targetPlanetIndex] = select.value.split(':').map(Number);
    const parent = { sun: targetSunIndex, planet: targetPlanetIndex };
    const moved = /** @type {any} */ (mapOps.moveMapItem(groups,
      { kind: 'moon', sun: sunIndex, planet: planetIndex, moon: moonIndex },
      position.value === 'end' ? { kind: 'planet', ...parent }
        : { kind: 'moon', ...parent, moon: Number(position.value), place: 'before' }));
    if (moved.status !== 'moved') return editorError('That moon could not be moved.');
    applyEditorChange(moved.groups,
      () => nav.showMoonEditor(moved.path.sun, moved.path.planet, moved.path.moon),
      { label: `Moved moon ${moon.name}` });
  }, 'editor-primary'));
}

/**
 * @param {any} dataTransfer
 */
export async function droppedFiles(dataTransfer) {
  const entries = [...dataTransfer.items].map(item => item.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return [...dataTransfer.files];
  /** @type {(entry: any) => Promise<File[]>} */
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

/**
 * @param {any} kind
 * @param {any} sunIndex
 * @param {any} [planetIndex]
 */
export function showRdpBatchImport(kind, sunIndex, planetIndex = null) {
  const sun = groups[sunIndex];
  const parent = kind === 'moon' ? sun.links[planetIndex] : sun;
  const back = kind === 'moon' ? () => nav.showPlanetEditor(sunIndex, planetIndex)
    : () => nav.showSunEditor(sunIndex);
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
  /** @type {any[]} */
  let prepared = [];
  let selectionVersion = 0;
  const prepare = async (/** @type {any} */ files) => {
    const version = ++selectionVersion;
    prepared = [];
    add.disabled = true;
    preview.replaceChildren();
    menuContent.querySelector('.editor-error')?.remove();
    try {
      const selected = files.filter((/** @type {any} */ file) => /\.rdp$/i.test(file.name));
      if (!selected.length) throw new Error('Choose at least one .rdp file.');
      if (selected.length > 100) throw new Error('Choose at most 100 .rdp files at once.');
      const imported = [];
      let excluded = 0;
      for (const file of selected) {
        let parsed;
        try { parsed = rdp.parseRdpProfile(await fileIo.readRdpText(file)); }
        catch (error) { throw new Error(`${file.name}: ${/** @type {any} */ (error).message}`); }
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
        editorError(`RDP import failed: ${/** @type {any} */ (error).message}`);
      }
    }
  };
  const choose = (/** @type {any} */ folder) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (folder) input.setAttribute('webkitdirectory', '');
    else { input.multiple = true; input.accept = '.rdp,application/x-rdp'; }
    input.addEventListener('change', () => { if (input.files?.length) prepare([...input.files]); });
    input.click();
  };
  dropZone.addEventListener('dragover', event => event.preventDefault());
  dropZone.addEventListener('drop', async event => {
    event.preventDefault();
    try { await prepare(await droppedFiles(event.dataTransfer)); }
    catch (error) { editorError(`RDP import failed: ${/** @type {any} */ (error).message}`); }
  });
  menuContent.append(dropZone);
  actions.append(editorButton('Choose .rdp files', () => choose(false)));
  actions.append(editorButton('Choose folder', () => choose(true)));
  actions.append(add);
  menuContent.append(preview);
}
