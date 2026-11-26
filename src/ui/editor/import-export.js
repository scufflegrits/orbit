// Editor map and item import/export screens.
import { importKind } from '../../core/import-kind.js';
import { validateMap, validItemExport } from '../../core/schema.js';
import { isGroup } from '../../core/destination.js';
import * as mapOps from '../../core/map-ops.js';
import * as fileIo from '../../services/file-io.js';
import { store, activeWorkspace } from '../../state/page-store.js';
import * as workspaces from '../../state/workspaces.js';
import * as prefs from '../../state/prefs.js';
import { confirmed } from '../dialogs/confirm.js';
import { counted, element } from '../dom.js';
import { nav } from './nav.js';
import { noteBackupMade } from '../notices/backup.js';
import { applyEditorChange, copyGroups, editorActions, editorButton, editorError, editorHeader, selectJsonFile } from './kit.js';
import { reviewBookmarks } from './tools/bookmarks.js';
import { menuContent, groups, rdpPresets, routines } from '../page.js';

export function exportMap() {
  fileIo.downloadJson({ groups: mapOps.personalGroups(groups), ...(routines.length ? { routines } : {}),
    ...(rdpPresets.length ? { rdpPresets } : {}) }, 'orbit-links.json');
  noteBackupMade();
}

/**
 * A labelled checkbox for the import review.
 * @param {string} className
 * @param {boolean} checked
 * @param {(Node | string)[]} parts
 */
function reviewCheck(className, checked, parts) {
  const label = element('label', `editor-check ${className}`);
  const box = /** @type {HTMLInputElement} */ (element('input'));
  box.type = 'checkbox';
  box.checked = checked;
  label.append(box, ...parts);
  return { label, box };
}

/**
 * Review a whole map before adding it. Each sun in the file is listed with what
 * it would add, and only the ticked suns are merged, each whole with its
 * planets and moons (a sun you already have gains only what it is missing).
 * Replace my map takes the whole file whatever is ticked.
 * @param {any} data
 * @param {{title?: string, note?: string, label?: string, replace?: boolean}} [options]
 */
export function showImportReview(data, options = {}) {
  editorHeader(options.title || 'Review import', nav.showSunList);
  const planetCount = data.groups.reduce((/** @type {any} */ sum, /** @type {any} */ sun) => sum + sun.links.length, 0);
  const moonCount = data.groups.reduce((/** @type {any} */ sum, /** @type {any} */ sun) => sum + sun.links.reduce(
    (/** @type {any} */ total, /** @type {any} */ planet) => total + planet.moons.length, 0), 0);
  if (options.note) menuContent.append(element('p', '', options.note));
  menuContent.append(element('p', '', `The file has ${counted(data.groups.length, 'sun')} · ${counted(planetCount, 'planet')} · ${counted(moonCount, 'moon')}.`));
  const personal = mapOps.personalGroups(groups);
  const additions = mapOps.sunAdditions(personal, data.groups);
  const newRoutines = mapOps.mergeRoutines(routines, data.routines || []);
  const addedRoutines = newRoutines.length - routines.length;
  const newPresets = mapOps.mergeRoutines(rdpPresets, data.rdpPresets || []);
  const addedPresets = newPresets.length - rdpPresets.length;

  const picker = element('fieldset', 'import-suns');
  picker.append(element('legend', '', 'Choose the suns to add'));
  const choose = element('p', 'import-sun-choose');
  /** @param {string} text @param {boolean} value */
  const setAll = (text, value) => {
    return editorButton(text, () => {
      for (const box of sunBoxes) if (!box.disabled) box.checked = value;
      update();
    }, 'import-sun-all');
  };
  /** @type {HTMLInputElement[]} */
  const sunBoxes = data.groups.map((/** @type {any} */ sun, /** @type {number} */ index) => {
    const adds = additions[index];
    const something = adds.planets + adds.moons > 0 || adds.isNew;
    const what = adds.isNew ? `new sun · ${counted(adds.planets, 'planet')} · ${counted(adds.moons, 'moon')}`
      : something ? `already yours · adds ${counted(adds.planets, 'planet')}, ${counted(adds.moons, 'moon')}`
        : 'already yours · nothing new';
    const { label, box } = reviewCheck('import-sun', something,
      [element('span', 'import-sun-name', sun.name), element('span', 'import-sun-adds', what)]);
    box.disabled = !something;
    box.addEventListener('change', () => update());
    picker.append(label);
    return box;
  });
  choose.append(setAll('Select all', true), setAll('Select none', false));
  picker.insertBefore(choose, picker.children[1] ?? null);
  menuContent.append(picker);
  const routineBox = addedRoutines ? reviewCheck('import-extra', true, [`Also add ${counted(addedRoutines, 'routine')}`]) : null;
  const presetBox = addedPresets ? reviewCheck('import-extra', true, [`Also add ${counted(addedPresets, 'Remote Desktop preset')}`]) : null;
  for (const extra of [routineBox, presetBox]) {
    if (!extra) continue;
    extra.box.addEventListener('change', () => update());
    menuContent.append(extra.label);
  }
  const summary = element('p', 'import-merge-summary');
  menuContent.append(summary);

  const chosen = () => data.groups.filter((/** @type {any} */ _, /** @type {number} */ index) => sunBoxes[index].checked);
  const merged = () => mapOps.mergeMaps(personal, chosen());
  const actions = editorActions();
  const merge = editorButton('Merge into my map', () => {
    const withRoutines = Boolean(routineBox?.box.checked);
    const withPresets = Boolean(presetBox?.box.checked);
    applyEditorChange([...groups.filter(sun => sun.team), ...merged().groups], nav.showSunList,
      { label: options.label || 'Merged an imported map', routines: withRoutines ? newRoutines : routines,
        rdpPresets: withPresets ? newPresets : rdpPresets });
  }, 'editor-primary');
  function update() {
    const { added, skipped } = merged();
    const routineCount = routineBox?.box.checked ? addedRoutines : 0;
    const presetCount = presetBox?.box.checked ? addedPresets : 0;
    const skippedLinks = skipped.planets + skipped.moons;
    summary.textContent = `Merge adds ${counted(added.suns, 'sun')}, ${counted(added.planets, 'planet')}, and ${counted(added.moons, 'moon')}${routineCount ? ` and ${counted(routineCount, 'routine')}` : ''}${presetCount ? ` and ${counted(presetCount, 'Remote Desktop preset')}` : ''}; ${counted(skippedLinks, 'link')} already in your map ${skippedLinks === 1 ? 'is' : 'are'} skipped. Nothing in your map changes.`;
    merge.disabled = !(added.suns + added.planets + added.moons + routineCount + presetCount);
  }
  update();
  actions.append(merge);
  if (options.replace !== false) {
    menuContent.append(element('p', 'editor-hint', 'Replace my map swaps your whole map for the file, every sun whatever is ticked. Version history keeps the current map, so you can restore it.'));
    actions.append(editorButton('Replace my map', () =>
      applyEditorChange(data.groups, nav.showSunList,
        { clearUndo: true, label: 'Replaced the map with an import', routines: data.routines || [], rdpPresets: data.rdpPresets || [] })));
  }
  actions.append(editorButton('Cancel', nav.showSunList));
}

export function importFile() {
  fileIo.pickFile('.json,application/json,.html,.htm,text/html', async file => {
    try {
      const { text, data } = await fileIo.readImportFile(file);
      const kind = importKind(data === undefined ? text : typeof data === 'string' ? null : data, file.name);
      switch (kind) {
        case 'bookmarks': return reviewBookmarks(text);
        case 'map': return showImportReview(validateMap(data));
        case 'sun': return reviewItem(data, 'sun');
        case 'planet': return reviewItem(data, 'sun', null, null, 'planet');
        case 'moon': return editorError('This file is a moon. Import moons inside a planet: Edit → the planet → Import moon.');
        default: return editorError("This isn't an Orbit map, sun, planet, or bookmarks file.");
      }
    } catch (error) {
      editorError(`Import failed: ${/** @type {Error} */ (error).message}`);
    }
  });
}

/**
 * @param {'planet' | 'moon'} kind
 * @param {number} sunIndex
 * @param {number | null} [planetIndex]
 */
export function importItem(kind, sunIndex, planetIndex = null) {
  selectJsonFile((/** @type {any} */ data) => reviewItem(data, kind, sunIndex, planetIndex));
}

/**
 * @param {any} data
 * @param {any} kind
 * @param {any} [sunIndex]
 * @param {any} [planetIndex]
 * @param {any} [sourceKind]
 */
function reviewItem(data, kind, sunIndex = null, planetIndex = null, sourceKind = kind) {
  const item = validItemExport(data, kind, sourceKind);
  const back = kind === 'sun' ? nav.showSunList
    : kind === 'planet' ? () => nav.showSunEditor(sunIndex)
      : () => nav.showPlanetEditor(sunIndex, planetIndex);
  editorHeader(sourceKind === kind ? `Review ${kind} import` : 'Review planet as sun', back);
  menuContent.append(element('p', '', item.name));
  if (sourceKind === 'planet' && kind === 'sun') {
    const planet = item.links[0];
    menuContent.append(element('p', '', isGroup(planet)
      ? 'The group becomes the first planet in a new sun and keeps all its links.'
      : 'The shared planet becomes the first planet in a new sun. Its destination and moons stay with it.'));
    if (!isGroup(planet)) menuContent.append(element('p', '', `Planet destination: ${planet.host || planet.url}`));
  }
  if (kind === 'sun') {
    const moons = item.links.reduce((/** @type {any} */ sum, /** @type {any} */ planet) => sum + planet.moons.length, 0);
    menuContent.append(element('p', '', `${counted(item.links.length, 'planet')} · ${counted(moons, 'moon')}`));
  } else if (kind === 'planet') {
    menuContent.append(element('p', '', isGroup(item)
      ? (item.moons.length ? counted(item.moons.length, 'link') : 'No links yet')
      : `${counted(item.moons.length, 'moon')} · ${item.host || item.url}`));
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
      if (next.some((/** @type {any} */ sun) => sun.id === imported.id)) {
        imported.id = mapOps.uniqueSunId(imported.name, new Set(next.map((/** @type {any} */ sun) => sun.id)));
      }
      next.push(imported);
      showNext = () => nav.showSunEditor(next.length - 1);
    } else if (kind === 'planet') {
      next[sunIndex].links.push(imported);
      showNext = () => nav.showPlanetEditor(sunIndex, next[sunIndex].links.length - 1);
    } else {
      next[sunIndex].links[planetIndex].moons.push(imported);
      showNext = () => nav.showMoonEditor(sunIndex, planetIndex,
        next[sunIndex].links[planetIndex].moons.length - 1);
    }
    applyEditorChange(next, showNext);
  }, 'editor-primary'));
  actions.append(editorButton('Cancel', back));
}

export function resetMap() {
  const id = activeWorkspace();
  const name = workspaces.workspaceName(id);
  const message = id === 'main' ? "Replace Main's edits with its default links?"
    : workspaces.defaultWorkspace(id) ? `Replace ${name}'s edits with its default links?`
      : `Replace ${name}'s map with Main's default map?`;
  if (!confirmed(message)) return;
  try {
    // Main follows the project files again; other workspaces keep a saved
    // copy (store.resetToBundled). The store subscriber redraws.
    store.resetToBundled();
    nav.showSunList();
  } catch (error) {
    editorError(/** @type {any} */ (error).message);
  }
}
