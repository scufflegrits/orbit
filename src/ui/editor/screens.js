// The editor's screens (2.2.1 editor.js): the sun list with the import,
// export, reset, and tool buttons; the sun, planet, and moon forms; copying
// a moon; and reviewing an imported map or item. Moved in rewrite phase 6b.
import { importKind } from '../../core/import-kind.js';
import { validateMap, validItemExport } from '../../core/schema.js';
import { isGroup } from '../../core/destination.js';
import * as mapOps from '../../core/map-ops.js';
import * as rdp from '../../core/rdp.js';
import * as fileIo from '../../services/file-io.js';
import { store } from '../../state/page-store.js';
import * as prefs from '../../state/prefs.js';
import { confirmed } from '../dialogs/confirm.js';
import { counted, element } from '../dom.js';
import { hooks } from '../hooks.js';
import { tip } from '../tooltip.js';
import { closeMenu, showMenuPanel } from '../menu/menu.js';
import { backupDue, backupReminder, noteBackupMade } from '../notices/backup.js';
import { team } from '../team-map.js';
import { showQuickAdd } from './quick-add.js';
import { applyEditorChange, copyGroups, duplicateNote, editorActions, editorButton, editorError, editorExportRow, editorField, editorHeader,
  editorMoveControls, editorTree, exportItem, moveEntry, removeEditorItem, selectJsonFile } from './kit.js';
import { leaveEditorPage, renderEditorTree, showMoveMoon, showMovePlanet, showRdpBatchImport } from './page.js';
import { reviewBookmarks } from './tools/bookmarks.js';
import { showBulkRdp } from './tools/bulk-rdp.js';
import { showDuplicates } from './tools/duplicates.js';
import { showHistory } from './tools/history.js';
import { showLinkCheck } from './tools/link-check.js';
import { shareFavorites, shareGroup, showPackImport } from './tools/packs.js';
import { showPresets } from './tools/presets.js';
import { showRoutines } from './tools/routines.js';
import { showTeamItem, showTeamSun } from './tools/team.js';
import { dataSourceLabel, groups, menuContent, quickFind, rdpPresets, routines, setFindQuery } from '../page.js';

/**
 * @param {any} form
 * @param {any} destination
 * @param {any} onRdpImported
 * @param {boolean} [allowGroup]
 */
function destinationFields(form, destination, onRdpImported, allowGroup = false) {
  const type = element('label', 'editor-field');
  const fieldName = allowGroup ? 'Kind' : 'Destination type';
  type.append(element('span', '', fieldName));
  const select = document.createElement('select');
  select.setAttribute('aria-label', fieldName);
  const kinds = [['web', 'Website'], ['rdp', 'Windows Remote Desktop']];
  if (allowGroup) kinds.push(['group', 'Group (no link)']);
  for (const [value, label] of kinds) {
    const option = element('option', '', label);
    option.value = value;
    select.append(option);
  }
  select.value = destination.type || 'web';
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
    favorite.hidden = select.value === 'group';
    url.input.disabled = select.value !== 'web';
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
      ...(favoriteInput.checked && select.value !== 'group' ? { favorite: true } : {}),
      ...(note.input.value.trim() ? { note: note.input.value } : {}),
    };
    if (select.value === 'group') return { type: 'group', ...extras };
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
  editorHeader(options.title || 'Review import', showSunList);
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
    applyEditorChange([...groups.filter(sun => sun.team), ...merged().groups], showSunList,
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
      applyEditorChange(data.groups, showSunList,
        { clearUndo: true, label: 'Replaced the map with an import', routines: data.routines || [], rdpPresets: data.rdpPresets || [] })));
  }
  actions.append(editorButton('Cancel', showSunList));
}

function importFile() {
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
function importItem(kind, sunIndex, planetIndex = null) {
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
  const back = kind === 'sun' ? showSunList
    : kind === 'planet' ? () => showSunEditor(sunIndex)
      : () => showPlanetEditor(sunIndex, planetIndex);
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

/**
 * @param {string} label
 * @param {...HTMLElement} controls
 */
function editorGroup(label, ...controls) {
  const group = element('section', 'editor-group');
  const heading = element('h4', 'editor-group-label', label);
  heading.id = `editor-group-${label.toLowerCase().replaceAll(' ', '-')}`;
  group.setAttribute('aria-labelledby', heading.id);
  const actions = element('div', 'editor-actions');
  actions.append(...controls);
  group.append(heading, actions);
  menuContent.append(group);
}

export function showSunList() {
  editorHeader('Edit links', () => editorTree ? leaveEditorPage() : showMenuPanel('Settings'));
  menuContent.append(element('p', '', 'Choose a sun to edit its planets and moons, or add, import, and export below. Changes are saved in this browser. History keeps earlier versions.'));
  menuContent.append(element('p', 'data-source', `Active link map: ${dataSourceLabel()}`));
  const due = backupDue();
  if (due) menuContent.append(backupReminder(due));
  editorActions().append(
    tip(editorButton('Add sun', () => showSunEditor(null), 'editor-primary'), 'Create a new sun, a group of planets, at the end of your Galaxy.'),
    tip(editorButton('Add a link', () => showQuickAdd('')), 'Add a planet or moon quickly by pasting its address.'),
  );
  menuContent.append(element('h4', 'editor-section-title', 'Suns'));
  const list = element('div', 'editor-list');
  groups.forEach((sun, index) => {
    const row = element('div', 'editor-list-row');
    row.append(element('span', '', `${sun.icon ? `${sun.icon} ` : ''}${sun.name} · ${counted(sun.links.length, 'planet')}${sun.team ? ' · team, read-only' : ''}`));
    row.append(tip(editorButton(sun.team ? 'View' : 'Edit', () => showSunEditor(index)),
      sun.team ? `View ${sun.name}: a read-only team sun.` : `Edit ${sun.name}: its name, color, planets, and moons.`));
    list.append(row);
  });
  menuContent.append(list);
  const hidden = team.groups.filter(sun => prefs.hiddenTeamSuns().has(sun.id));
  if (hidden.length) {
    menuContent.append(element('p', 'data-source', `${counted(hidden.length, 'team sun')} hidden. Show them again in Settings.`));
  }

  editorGroup('Import',
    tip(editorButton('Import a file', importFile), 'Add from a file: a whole map (pick which suns, or replace your map), a single sun, a planet as a new sun, or a browser bookmarks file.'),
    tip(editorButton('Link pack', showPackImport), "Paste a link pack someone shared and add the links you don't have yet."),
  );
  editorGroup('Export',
    tip(editorButton('Whole map (JSON)', exportMap), 'Download your whole map, with routines and presets, as a backup or to move it to another browser.'),
    tip(editorButton('Share favorites', shareFavorites), 'Copy your favorites as a link pack to send to someone.'),
  );
  const fileMode = location.protocol === 'file:';
  const checkLinks = editorButton('Check links', () => {
    if (!fileMode) showLinkCheck();
  });
  if (fileMode) checkLinks.setAttribute('aria-disabled', 'true');
  editorGroup('Organize',
    tip(editorButton('Routines', showRoutines), 'Name sets of links to open together, and have Orbit offer them at set times.'),
    tip(editorButton('RDP presets', showPresets), 'Saved Remote Desktop settings (screen size, monitors) to reuse across computers.'),
    tip(editorButton('Find duplicates', showDuplicates), 'List links that appear more than once in your map.'),
    tip(checkLinks, fileMode
      ? 'Check links needs the local server: run python3 serve.py and open http://localhost:8000.'
      : "Test every web link and mark the ones that don't answer."),
    tip(editorButton('History', showHistory), 'Your map before each of your last 20 changes; restore any of them.'),
  );
  editorGroup('Start over',
    tip(editorButton('Reset to file data', resetMap, 'editor-danger'), "Replace your browser edits with the project's map. History keeps the current one."),
    element('p', 'editor-hint', "Replaces your browser edits with the project's map. History keeps the current one."),
  );
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
  editorHeader(isNew ? 'Add sun' : `Edit ${sun.name}`, showSunList, [index]);
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
    const sunTools = element('div', 'editor-sun-tools');
    const position = element('div', 'editor-row-actions');
    position.setAttribute('role', 'group');
    position.setAttribute('aria-label', 'Sun position');
    editorMoveControls(position, index, groups.length, (/** @type {any} */ amount) => {
      const next = copyGroups();
      if (moveEntry(next, index, amount)) applyEditorChange(next, () => showSunEditor(index + amount));
    });
    sunTools.append(editorButton('Export sun', () => exportItem('sun', sun)), position);
    menuContent.append(sunTools);
    menuContent.append(element('h4', 'editor-section-title', 'Planets'));
    const list = element('div', 'editor-list');
    sun.links.forEach((/** @type {any} */ planet, /** @type {any} */ planetIndex) => {
      const summary = `${planet.name} · ${counted(planet.moons.length, isGroup(planet) ? 'link' : 'moon')}`;
      list.append(editorExportRow('planet', planet, summary, 'Edit', () => showPlanetEditor(index, planetIndex)));
    });
    menuContent.append(list);
    const planetActions = editorActions();
    planetActions.append(editorButton('Add planet', () => showPlanetEditor(index, null), 'editor-primary'));
    planetActions.append(editorButton('Import planet', () => importItem('planet', index)));
    planetActions.append(editorButton('Import .rdp files as planets', () => showRdpBatchImport('planet', index)));

    const removal = element('div', 'editor-sun-removal');
    removal.append(editorButton('Remove sun', () => removeEditorItem([index], showSunList), 'editor-danger'),
      element('p', 'editor-hint', 'Removes this sun and all its planets and moons.'));
    menuContent.append(removal);
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
  editorHeader(isNew ? 'Add planet' : `Edit ${planet.name}`, () => showSunEditor(sunIndex), [sunIndex, planetIndex]);
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
  }, true);
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
    actions.append(editorButton('Remove planet', () =>
      removeEditorItem([sunIndex, planetIndex], () => showSunEditor(sunIndex)), 'editor-danger'));
  }
  form.append(actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = copyGroups();
    const value = { name: name.input.value.trim(), ...readDestination(),
      moons: isNew ? [] : next[sunIndex].links[planetIndex].moons };
    if (!isNew && isGroup(value) && !isGroup(planet) &&
        !confirmed(`${planet.name} will become a group and lose its link ${planet.type === 'rdp' ? planet.host : planet.url}. Continue?`)) return;
    if (isNew) next[sunIndex].links.push(value);
    else next[sunIndex].links[planetIndex] = value;
    applyEditorChange(next, () => showPlanetEditor(sunIndex,
      isNew ? next[sunIndex].links.length - 1 : planetIndex), { label: `${isNew ? 'Added' : 'Saved'} planet ${value.name}` });
  });
  menuContent.append(form);
  if (!isNew) {
    const sharing = editorActions();
    sharing.append(editorButton('Export planet', () => exportItem('planet', planet)));
    const group = isGroup(planet);
    if (group && planet.moons.length) sharing.append(editorButton('Share links as a pack', () => shareGroup(planet)));
    menuContent.append(element('h4', 'editor-section-title', group ? 'Links' : 'Moons'));
    if (group && !planet.moons.length) menuContent.append(element('p', 'data-source', 'No links yet'));
    const list = element('div', 'editor-list');
    planet.moons.forEach((/** @type {any} */ moon, /** @type {any} */ moonIndex) => {
      list.append(editorExportRow('moon', moon, moon.name, 'Edit', () => showMoonEditor(sunIndex, planetIndex, moonIndex)));
    });
    menuContent.append(list);
    const moonActions = editorActions();
    moonActions.append(editorButton(group ? 'Add link' : 'Add moon', () => showMoonEditor(sunIndex, planetIndex, null), 'editor-primary'));
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
  const addLabel = isGroup(planet) ? 'Add link' : 'Add moon';
  editorHeader(isNew ? addLabel : `Edit ${moon.name}`,
    () => showPlanetEditor(sunIndex, planetIndex), [sunIndex, planetIndex, moonIndex]);
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
  const save = element('button', 'editor-primary', isNew ? addLabel : 'Save moon');
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
    actions.append(editorButton('Remove moon', () =>
      removeEditorItem([sunIndex, planetIndex, moonIndex], () => showPlanetEditor(sunIndex, planetIndex)), 'editor-danger'));
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
