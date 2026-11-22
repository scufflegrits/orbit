// The editor's screens (2.2.1 editor.js): the sun list with the import,
// export, reset, and tool buttons; the sun, planet, and moon forms; copying
// a moon; and reviewing an imported map or item. Moved in rewrite phase 6b.
import { validateMap, validItemExport } from '../../core/schema.js';
import * as mapOps from '../../core/map-ops.js';
import * as rdp from '../../core/rdp.js';
import * as fileIo from '../../services/file-io.js';
import { store } from '../../state/page-store.js';
import * as prefs from '../../state/prefs.js';
import { confirmed } from '../dialogs/confirm.js';
import { counted, element } from '../dom.js';
import { hooks } from '../hooks.js';
import { closeMenu, showMenuPanel } from '../menu/menu.js';
import { backupDue, backupReminder, noteBackupMade } from '../notices/backup.js';
import { team } from '../team-map.js';
import { showQuickAdd } from './quick-add.js';
import { applyEditorChange, copyGroups, duplicateNote, editorActions, editorButton, editorError, editorField, editorHeader,
  editorMoveControls, editorTree, exportItem, moveEntry, selectJsonFile } from './kit.js';
import { leaveEditorPage, renderEditorTree, showMoveMoon, showMovePlanet, showRdpBatchImport } from './page.js';
import { importBookmarks } from './tools/bookmarks.js';
import { showBulkRdp } from './tools/bulk-rdp.js';
import { showDuplicates } from './tools/duplicates.js';
import { showHistory } from './tools/history.js';
import { showLinkCheck } from './tools/link-check.js';
import { shareFavorites, showPackImport } from './tools/packs.js';
import { showPresets } from './tools/presets.js';
import { showRoutines } from './tools/routines.js';
import { showTeamItem, showTeamSun } from './tools/team.js';

/**
 * @param {any} form
 * @param {any} destination
 * @param {any} onRdpImported
 */
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
  // Connection settings: none, this link's imported settings, or a preset.
  const settingsField = element('label', 'editor-field');
  settingsField.append(element('span', '', 'Connection settings'));
  const settingsSelect = document.createElement('select');
  settingsSelect.setAttribute('aria-label', 'Connection settings');
  settingsField.append(settingsSelect);
  const fillSettings = (/** @type {any} */ selected) => {
    settingsSelect.replaceChildren();
    const add = (/** @type {any} */ value, /** @type {any} */ label) => {
      const option = element('option', '', label);
      option.value = value;
      settingsSelect.append(option);
    };
    add('none', 'None (just the computer)');
    if (rdpProfile) add('own', 'Imported .rdp settings');
    rdpPresets.forEach(preset => add(`preset:${preset.id}`, `Preset: ${preset.name}`));
    settingsSelect.value = [...settingsSelect.options].some(option => option.value === selected) ? selected : 'none';
  };
  fillSettings(destination.rdpPreset ? `preset:${destination.rdpPreset}` : rdpProfile ? 'own' : 'none');
  const importRdp = editorButton('Import .rdp file', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.rdp,application/x-rdp';
    input.addEventListener('change', async () => {
      const files = input.files;
      if (!files?.length) return;
      try {
        const parsed = rdp.parseRdpProfile(await fileIo.readRdpText(files[0]));
        select.value = 'rdp';
        host.input.value = parsed.host;
        rdpProfile = parsed.content;
        fillSettings('own');
        profileNote.textContent = `${parsed.settings} connection settings imported. ${parsed.removed ? `${parsed.removed} password, token, or signature settings excluded. ` : ''}Save this link to keep the profile.`;
        update();
        onRdpImported?.(files[0]);
      } catch (error) {
        editorError(`RDP import failed: ${/** @type {any} */ (error).message}`);
      }
    });
    input.click();
  });
  const update = () => {
    url.wrapper.hidden = select.value !== 'web';
    host.wrapper.hidden = select.value !== 'rdp';
    profileNote.hidden = select.value !== 'rdp';
    importRdp.hidden = select.value !== 'rdp';
    settingsField.hidden = select.value !== 'rdp';
  };
  select.addEventListener('change', update);
  const note = editorField('Note', destination.note || '', 'textarea');
  note.input.setAttribute('aria-label', 'Note');
  note.input.maxLength = 500;
  note.input.placeholder = 'Optional: what this link is for, or a hint such as which account to use';
  note.wrapper.append(element('small', 'editor-hint', 'Shown on hover and in search. Never put passwords here; notes are plain text in your browser and in exports.'));
  const tags = editorField('Tags', (destination.tags || []).join(', '));
  tags.input.placeholder = 'For example: prod, windows';
  tags.input.setAttribute('aria-label', 'Tags');
  tags.wrapper.append(element('small', 'editor-hint', 'Separate tags with commas. Find tagged links with #tag in Quick find.'));
  const favorite = element('label', 'editor-check');
  const favoriteInput = document.createElement('input');
  favoriteInput.type = 'checkbox';
  favoriteInput.checked = destination.favorite === true;
  favorite.append(favoriteInput, element('span', '', 'Favorite (shown at the top of the Galaxy)'));
  url.wrapper.append(element('small', 'editor-hint', 'Use {name} for a part that changes, such as https://jira.example.com/browse/{ticket}; Orbit asks for it when you open the link.'));
  form.append(type, url.wrapper, host.wrapper, settingsField, profileNote, importRdp, note.wrapper, tags.wrapper, favorite);
  update();
  return () => {
    const extras = {
      ...(tags.input.value.trim() ? { tags: tags.input.value } : {}),
      ...(favoriteInput.checked ? { favorite: true } : {}),
      ...(note.input.value.trim() ? { note: note.input.value } : {}),
    };
    const choice = settingsSelect.value;
    // "None" drops imported settings; a preset keeps them for switching back.
    const keepProfile = rdpProfile && choice !== 'none' ? { rdpProfile } : {};
    const preset = choice.startsWith('preset:') ? { rdpPreset: choice.slice(7) } : {};
    return select.value === 'rdp'
      ? { type: 'rdp', host: host.input.value.trim(), ...keepProfile, ...preset, ...extras }
      : { url: url.input.value.trim(), ...extras };
  };
}

export function exportMap() {
  fileIo.downloadJson({ groups: mapOps.personalGroups(groups), ...(routines.length ? { routines } : {}),
    ...(rdpPresets.length ? { rdpPresets } : {}) }, 'orbit-links.json');
  noteBackupMade();
}

/**
 * @param {any} data
 * @param {any} [options]
 */
export function showImportReview(data, options = {}) {
  editorHeader(options.title || 'Review import', showSunList);
  const planetCount = data.groups.reduce((/** @type {any} */ sum, /** @type {any} */ sun) => sum + sun.links.length, 0);
  const moonCount = data.groups.reduce((/** @type {any} */ sum, /** @type {any} */ sun) => sum + sun.links.reduce(
    (/** @type {any} */ total, /** @type {any} */ planet) => total + planet.moons.length, 0), 0);
  if (options.note) menuContent.append(element('p', '', options.note));
  menuContent.append(element('p', '', `The file has ${counted(data.groups.length, 'sun')} · ${counted(planetCount, 'planet')} · ${counted(moonCount, 'moon')}.`));
  const merged = mapOps.mergeMaps(mapOps.personalGroups(groups), data.groups);
  const { added, skipped } = merged;
  const newRoutines = mapOps.mergeRoutines(routines, data.routines || []);
  const addedRoutines = newRoutines.length - routines.length;
  const newPresets = mapOps.mergeRoutines(rdpPresets, data.rdpPresets || []);
  const addedPresets = newPresets.length - rdpPresets.length;
  menuContent.append(element('p', 'import-merge-summary', `Merge adds ${counted(added.suns, 'sun')}, ${counted(added.planets, 'planet')}, and ${counted(added.moons, 'moon')}${addedRoutines ? ` and ${counted(addedRoutines, 'routine')}` : ''}${addedPresets ? ` and ${counted(addedPresets, 'Remote Desktop preset')}` : ''}; ${counted(skipped.planets + skipped.moons, 'link')} already in your map ${skipped.planets + skipped.moons === 1 ? 'is' : 'are'} skipped. Nothing in your map changes.`));
  const actions = editorActions();
  const merge = editorButton('Merge into my map', () =>
    applyEditorChange([...groups.filter(sun => sun.team), ...merged.groups], showSunList,
      { label: options.label || 'Merged an imported map', routines: newRoutines, rdpPresets: newPresets }), 'editor-primary');
  merge.disabled = !(added.suns + added.planets + added.moons + addedRoutines + addedPresets);
  actions.append(merge);
  if (options.replace !== false) {
    menuContent.append(element('p', 'editor-hint', 'Replace my map swaps your whole map for the file. Version history keeps the current map, so you can restore it.'));
    actions.append(editorButton('Replace my map', () =>
      applyEditorChange(data.groups, showSunList,
        { clearUndo: true, label: 'Replaced the map with an import', routines: data.routines || [], rdpPresets: data.rdpPresets || [] })));
  }
  actions.append(editorButton('Cancel', showSunList));
}

function importMap() {
  selectJsonFile((/** @type {any} */ data) => showImportReview(validateMap(data)));
}

/**
 * @param {any} kind
 * @param {any} [sunIndex]
 * @param {any} [planetIndex]
 * @param {any} [sourceKind]
 */
function importItem(kind, sunIndex = null, planetIndex = null, sourceKind = kind) {
  selectJsonFile((/** @type {any} */ data) => {
    const item = validItemExport(data, kind, sourceKind);
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
      const moons = item.links.reduce((/** @type {any} */ sum, /** @type {any} */ planet) => sum + planet.moons.length, 0);
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
        if (next.some((/** @type {any} */ sun) => sun.id === imported.id)) {
          imported.id = mapOps.uniqueSunId(imported.name, new Set(next.map((/** @type {any} */ sun) => sun.id)));
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
  if (!confirmed('Replace browser edits with the link data loaded from the project files?')) return;
  try {
    // Main follows the project files again; other workspaces keep a saved
    // copy (store.resetToBundled). The store subscriber redraws.
    store.resetToBundled();
    showSunList();
  } catch (error) {
    editorError(/** @type {any} */ (error).message);
  }
}

export function showSunList() {
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
  const hidden = team.groups.filter(sun => prefs.hiddenTeamSuns().has(sun.id));
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
  const due = backupDue();
  if (due) menuContent.insertBefore(backupReminder(due), menuContent.querySelector('.editor-list'));
  menuContent.append(element('h4', 'editor-section-title', 'Tools'));
  const tools = editorActions();
  tools.append(editorButton('Add a link', () => showQuickAdd('')));
  tools.append(editorButton('Routines', showRoutines));
  tools.append(editorButton('RDP presets', showPresets));
  tools.append(editorButton('Share favorites', shareFavorites));
  tools.append(editorButton('Import link pack', showPackImport));
  tools.append(editorButton('History', showHistory));
  tools.append(editorButton('Find duplicates', showDuplicates));
  tools.append(editorButton('Check links', showLinkCheck));
  const tags = tagCounts();
  if (tags.length) {
    menuContent.append(element('h4', 'editor-section-title', 'Tags'));
    const list = element('div', 'tag-list');
    tags.forEach(([tag, count]) => list.append(editorButton(`#${tag} · ${count}`, () => {
      closeMenu();
      quickFind.value = `#${tag}`;
      setFindQuery(quickFind.value);
      if (location.hash && location.hash !== '#') location.hash = '';
      else hooks.render();
    }, 'tag-button')));
    menuContent.append(list);
  }
  renderEditorTree();
}

function tagCounts() {
  const counts = new Map();
  groups.forEach(sun => sun.links.forEach((/** @type {any} */ planet) => [planet, ...planet.moons].forEach(item =>
    (item.tags || []).forEach((/** @type {any} */ tag) => counts.set(tag, (counts.get(tag) || 0) + 1)))));
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * @param {any} index
 */
export function showSunEditor(index) {
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
    editorMoveControls(actions, index, groups.length, (/** @type {any} */ amount) => {
      const next = copyGroups();
      if (moveEntry(next, index, amount)) applyEditorChange(next, () => showSunEditor(index + amount));
    });
    actions.append(editorButton('Remove sun', () => {
      if (!confirmed(`Remove ${sun.name} and all its planets and moons?`)) return;
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
    /** @type {any} */
    const value = { name: name.input.value.trim(), description: description.input.value.trim(),
      color: color.input.value, icon: icon.input.value, links: isNew ? [] : next[index].links };
    if (isNew) {
      value.id = mapOps.uniqueSunId(value.name, new Set(next.map((/** @type {any} */ item) => item.id)));
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
    sun.links.forEach((/** @type {any} */ planet, /** @type {any} */ planetIndex) => {
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

/**
 * @param {any} sunIndex
 * @param {any} planetIndex
 */
export function showPlanetEditor(sunIndex, planetIndex) {
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
  const readDestination = destinationFields(form, planet, (/** @type {any} */ file) => {
    if (isNew && !name.input.value.trim()) name.input.value = file.name.replace(/\.rdp$/i, '');
  });
  const actions = element('div', 'editor-actions');
  const save = element('button', 'editor-primary', isNew ? 'Add planet' : 'Save planet');
  save.type = 'submit';
  actions.append(save);
  if (!isNew) {
    editorMoveControls(actions, planetIndex, groups[sunIndex].links.length, (/** @type {any} */ amount) => {
      const next = copyGroups();
      if (moveEntry(next[sunIndex].links, planetIndex, amount)) {
        applyEditorChange(next, () => showPlanetEditor(sunIndex, planetIndex + amount));
      }
    });
    actions.append(editorButton('Move to another sun', () => showMovePlanet(sunIndex, planetIndex)));
    actions.append(editorButton('Remove planet', () => {
      if (!confirmed(`Remove ${planet.name} and all its moons?`)) return;
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
    planet.moons.forEach((/** @type {any} */ moon, /** @type {any} */ moonIndex) => {
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
    if (planet.moons.some((/** @type {any} */ moon) => moon.type === 'rdp')) {
      moonActions.append(editorButton('Apply RDP settings to moons', () => showBulkRdp(sunIndex, planetIndex)));
    }
  }
}

/**
 * @param {any} sunIndex
 * @param {any} planetIndex
 * @param {any} moonIndex
 */
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
  groups.forEach((sun, targetSunIndex) => sun.links.forEach((/** @type {any} */ planet, /** @type {any} */ targetPlanetIndex) => {
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

/**
 * @param {any} sunIndex
 * @param {any} planetIndex
 * @param {any} moonIndex
 */
export function showMoonEditor(sunIndex, planetIndex, moonIndex) {
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
  const readDestination = destinationFields(form, moon, (/** @type {any} */ file) => {
    if (isNew && !name.input.value.trim()) name.input.value = file.name.replace(/\.rdp$/i, '');
  });
  const actions = element('div', 'editor-actions');
  const save = element('button', 'editor-primary', isNew ? 'Add moon' : 'Save moon');
  save.type = 'submit';
  actions.append(save);
  if (!isNew) {
    editorMoveControls(actions, moonIndex, planet.moons.length, (/** @type {any} */ amount) => {
      const next = copyGroups();
      if (moveEntry(next[sunIndex].links[planetIndex].moons, moonIndex, amount)) {
        applyEditorChange(next, () => showMoonEditor(sunIndex, planetIndex, moonIndex + amount));
      }
    });
    actions.append(editorButton('Move to another planet', () => showMoveMoon(sunIndex, planetIndex, moonIndex)));
    actions.append(editorButton('Remove moon', () => {
      if (!confirmed(`Remove ${moon.name}?`)) return;
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
