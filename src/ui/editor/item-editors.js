// The editor's sun, planet, and moon forms.
import * as mapOps from '../../core/map-ops.js';
import { isGroup } from '../../core/destination.js';
import { confirmed } from '../dialogs/confirm.js';
import { counted, element } from '../dom.js';
import { team } from '../team-map.js';
import { showBulkRdp } from './tools/bulk-rdp.js';
import { shareGroup } from './tools/packs.js';
import { showTeamItem, showTeamSun } from './tools/team.js';
import { applyEditorChange, attachItemToolbar, copyGroups, duplicateNote, editorActions, editorButton, editorExportRow, editorField, editorHeader, editorMoveControls, editorRowActions, exportItem, focusMovedRow, moveEntry, refreshEditorUndo, removeEditorItem } from './kit.js';
import { showMakeMoon, showMakePlanet, showMoveMoon, showMovePlanet, showRdpBatchImport } from './page.js';
import { groups, menuContent } from '../page.js';
import { destinationFields } from './fields.js';
import { importItem } from './import-export.js';
import { moveSun, showSunList } from './sun-list.js';

/** @param {typeof groups} map @param {number[]} parentPath */
function childItems(map, parentPath) {
  const [sun, planet] = parentPath;
  const planets = map[sun].links;
  return parentPath.length === 1 ? planets : planets[planet].moons;
}

/**
 * Refresh the children and their related actions in place so every draft
 * field and its listeners stay in the parent editor.
 * @param {number[]} parentPath
 * @param {(index: number) => void} open
 * @param {() => void} [updateParent]
 */
function editorChildList(parentPath, open, updateParent) {
  const kind = parentPath.length === 1 ? 'planet' : 'moon';
  const list = element('div', 'editor-list');
  function refresh() {
    const items = childItems(groups, parentPath);
    list.replaceChildren(...items.map((/** @type {any} */ item, /** @type {number} */ index) => {
      const summary = kind === 'planet'
        ? `${item.name} · ${counted(item.moons.length, isGroup(item) ? 'link' : 'moon')}`
        : item.name;
      const actions = editorRowActions(item.name, index, items.length, [...parentPath, index], amount => {
        const scroll = menuContent.scrollTop;
        const next = copyGroups();
        if (moveEntry(childItems(next, parentPath), index, amount)) {
          applyEditorChange(next, () => {
            refresh();
            focusMovedRow(list, index + amount, amount, scroll);
          }, { label: `Reordered ${kind} ${item.name}` });
        }
      }, () => {
        refresh();
        refreshEditorUndo(() => {
          refresh();
          refreshEditorUndo();
        });
      });
      return editorExportRow(kind, item, summary, 'Edit', () => open(index), false, ...actions);
    }));
    updateParent?.();
  }
  refresh();
  return list;
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
    const firstPersonal = groups.findIndex(sun => !sun.team);
    editorMoveControls(position, index - firstPersonal, groups.length - firstPersonal,
      (/** @type {number} */ amount) => moveSun(index, amount, showSunEditor));
    sunTools.append(editorButton('Export sun', () => exportItem('sun', groups[index])), position);
    menuContent.append(sunTools);
    menuContent.append(element('h4', 'editor-section-title', 'Planets'));
    menuContent.append(editorChildList([index], planetIndex => showPlanetEditor(index, planetIndex)));
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
  const header = editorHeader(isNew ? 'Add planet' : `Edit ${planet.name}`, () => showSunEditor(sunIndex), [sunIndex, planetIndex]);
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
  const group = isGroup(planet);
  const getPlanet = () => groups[sunIndex].links[planetIndex];
  const refreshToolbar = attachItemToolbar(header, form, isNew ? 'Add planet' : 'Save planet', isNew ? undefined : {
    kind: 'planet', getItem: getPlanet, index: planetIndex, count: groups[sunIndex].links.length,
    reorder: amount => {
      const next = copyGroups();
      if (moveEntry(next[sunIndex].links, planetIndex, amount)) {
        applyEditorChange(next, () => showPlanetEditor(sunIndex, planetIndex + amount));
      }
    },
    move: () => showMovePlanet(sunIndex, planetIndex),
    // Only a planet without moons that isn't a group can become a moon.
    ...(!group && !planet.moons.length ? { changeLevel: { label: 'Make it a moon of…', action: () => showMakeMoon(sunIndex, planetIndex) } } : {}),
    remove: () => removeEditorItem([sunIndex, planetIndex], () => showSunEditor(sunIndex)),
    ...(group ? { extra: {
      label: 'Share links as a pack', icon: 'share-2', action: () => shareGroup(getPlanet()),
      available: () => getPlanet().moons.length > 0,
    } } : {}),
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = copyGroups();
    const value = { name: name.input.value.trim(), ...readDestination(),
      moons: isNew ? [] : next[sunIndex].links[planetIndex].moons };
    if (!isNew && isGroup(value) && !isGroup(planet) &&
        !confirmed(`${planet.name} will become a group and lose its link ${planet.type === 'rdp' ? planet.host : planet.url}. Continue?`)) return;
    if (isNew) next[sunIndex].links.push(value);
    else next[sunIndex].links[planetIndex] = { ...value, planetId: next[sunIndex].links[planetIndex].planetId };
    applyEditorChange(next, () => showPlanetEditor(sunIndex,
      isNew ? next[sunIndex].links.length - 1 : planetIndex), { label: `${isNew ? 'Added' : 'Saved'} planet ${value.name}` });
  });
  menuContent.append(form);
  if (!isNew) {
    menuContent.append(element('h4', 'editor-section-title', group ? 'Links' : 'Moons'));
    const empty = group ? element('p', 'data-source', 'No links yet') : null;
    if (empty) menuContent.append(empty);
    const bulk = editorButton('Apply RDP settings to moons', () => showBulkRdp(sunIndex, planetIndex));
    menuContent.append(editorChildList([sunIndex, planetIndex], moonIndex => showMoonEditor(sunIndex, planetIndex, moonIndex), () => {
      const moons = getPlanet().moons;
      if (empty) empty.hidden = moons.length > 0;
      bulk.hidden = !moons.some((/** @type {any} */ moon) => moon.type === 'rdp');
      refreshToolbar();
    }));
    const moonActions = editorActions();
    moonActions.append(editorButton(group ? 'Add link' : 'Add moon', () => showMoonEditor(sunIndex, planetIndex, null), 'editor-primary'));
    moonActions.append(editorButton('Import moon', () => importItem('moon', sunIndex, planetIndex)));
    moonActions.append(editorButton('Import .rdp files as moons', () => showRdpBatchImport('moon', sunIndex, planetIndex)));
    moonActions.append(bulk);
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
  const header = editorHeader(isNew ? addLabel : `Edit ${moon.name}`,
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
  attachItemToolbar(header, form, isNew ? addLabel : 'Save moon', isNew ? undefined : {
    kind: 'moon', getItem: () => moon, index: moonIndex, count: planet.moons.length,
    reorder: amount => {
      const next = copyGroups();
      if (moveEntry(next[sunIndex].links[planetIndex].moons, moonIndex, amount)) {
        applyEditorChange(next, () => showMoonEditor(sunIndex, planetIndex, moonIndex + amount));
      }
    },
    move: () => showMoveMoon(sunIndex, planetIndex, moonIndex),
    changeLevel: { label: 'Make it a planet of…', action: () => showMakePlanet(sunIndex, planetIndex, moonIndex) },
    remove: () => removeEditorItem([sunIndex, planetIndex, moonIndex], () => showPlanetEditor(sunIndex, planetIndex)),
    extra: { label: 'Copy moon', icon: 'copy', action: () => showCopyMoon(sunIndex, planetIndex, moonIndex) },
  });
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
}
