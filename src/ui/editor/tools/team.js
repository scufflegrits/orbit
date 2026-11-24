// Read-only team screens (2.2.1 tools.js): view a team sun, planet, or moon, and copy it into the personal map.
// Moved in rewrite phase 6b.
import { isGroup, itemAt } from '../../../core/destination.js';
import * as mapOps from '../../../core/map-ops.js';
import { store } from '../../../state/page-store.js';
import { counted, descriptionNode, element, tagChips } from '../../dom.js';
import { isFavorite, setFavorite } from '../../views/favorites.js';
import { applyEditorChange, copyGroups, editorActions, editorButton, editorHeader, exportItem, moveTargetField } from '../kit.js';
import { nav } from '../nav.js';
import { groups, menuContent } from '../../page.js';

function personalSunOptions() {
  return groups.flatMap((sun, index) => sun.team ? [] : [[String(index), sun.name]]);
}

/**
 * @param {any} index
 */
export function showTeamSun(index) {
  const sun = groups[index];
  editorHeader(`${sun.icon ? `${sun.icon} ` : ''}${sun.name} (team)`, nav.showSunList, [index]);
  menuContent.append(element('p', 'editor-note', 'This sun comes from the team map, so it is read-only here. Copy it, or any of its planets and moons, into your own map to change it.'));
  if (sun.description) menuContent.append(descriptionNode('', sun.description));
  const actions = editorActions();
  actions.append(editorButton('Copy sun to my map', () => {
    const next = copyGroups();
    const copy = mapOps.plainCopy(sun);
    copy.id = mapOps.uniqueSunId(copy.name, new Set(next.map((/** @type {any} */ item) => item.id)));
    next.push(copy);
    applyEditorChange(next, () => nav.showSunEditor(next.length - 1), { label: `Copied team sun ${sun.name}` });
  }, 'editor-primary'));
  actions.append(editorButton('Hide this team sun', () => {
    store.setTeamSunHidden(sun.id, true);
    nav.showSunList();
  }));
  actions.append(editorButton('Export sun', () => exportItem('sun', sun)));
  menuContent.append(element('h4', 'editor-section-title', 'Planets'));
  const list = element('div', 'editor-list');
  sun.links.forEach((/** @type {any} */ planet, /** @type {any} */ planetIndex) => {
    const row = element('div', 'editor-list-row');
    row.append(element('span', '', `${planet.name} · ${counted(planet.moons.length, isGroup(planet) ? 'link' : 'moon')}`));
    row.append(editorButton('View', () => showTeamItem([index, planetIndex])));
    list.append(row);
  });
  menuContent.append(list);
}

/**
 * @param {any} path
 */
export function showTeamItem(path) {
  const sun = groups[path[0]];
  const planet = sun.links[path[1]];
  const item = itemAt(groups, path);
  const isMoon = path.length === 3;
  if (!item) return showTeamSun(path[0]);
  editorHeader(`${item.name} (team)`, () => isMoon ? showTeamItem(path.slice(0, 2)) : showTeamSun(path[0]), path);
  menuContent.append(element('p', '', `${sun.name} sun${isMoon ? ` → ${planet.name} planet` : ''} · read-only team ${isMoon ? 'moon' : 'planet'}`));
  const group = isGroup(item);
  const summary = group ? (item.moons.length ? counted(item.moons.length, 'link') : 'No links yet')
    : item.type === 'rdp' ? `Remote Desktop: ${item.host}` : item.url;
  menuContent.append(element('p', 'data-source', summary));
  if (item.tags?.length) menuContent.append(tagChips(item.tags));
  const favorite = isFavorite(item, sun);
  if (!group) editorActions().append(editorButton(favorite ? 'Remove from favorites' : 'Add to favorites', () => {
    setFavorite(path, !favorite);
    showTeamItem(path);
  }));
  // Copy into a personal sun (a planet) or onto a personal planet (a moon).
  const options = isMoon
    ? groups.flatMap((target, targetSun) => target.team ? [] : target.links.map((/** @type {any} */ targetPlanet, /** @type {any} */ targetPlanetIndex) =>
      [`${targetSun}:${targetPlanetIndex}`, `${target.name} → ${targetPlanet.name}`]))
    : personalSunOptions();
  if (options.length) {
    const select = moveTargetField(options);
    select.setAttribute('aria-label', 'Copy to');
    /** @type {Element} */ (select.previousElementSibling).textContent = 'Copy to';
    editorActions().append(editorButton(isMoon ? 'Copy moon to my map' : 'Copy planet to my map', () => {
      const next = copyGroups();
      const [targetSun, targetPlanet] = select.value.split(':').map(Number);
      if (isMoon && !isGroup(item)) next[targetSun].links[targetPlanet].moons.push(mapOps.plainCopy(item));
      else next[targetSun].links.push(mapOps.plainCopy(item));
      applyEditorChange(next, () => isMoon
        ? nav.showMoonEditor(targetSun, targetPlanet, next[targetSun].links[targetPlanet].moons.length - 1)
        : nav.showPlanetEditor(targetSun, next[targetSun].links.length - 1),
      { label: `Copied team ${isMoon ? 'moon' : 'planet'} ${item.name}` });
    }, 'editor-primary'));
  } else {
    menuContent.append(element('p', 'editor-hint', `Add ${isMoon ? 'a planet' : 'a sun'} to your own map to copy this ${isMoon ? 'moon' : 'planet'} into it.`));
  }
  if (!isMoon && planet.moons.length) {
    menuContent.append(element('h4', 'editor-section-title', group ? 'Links' : 'Moons'));
    const list = element('div', 'editor-list');
    planet.moons.forEach((/** @type {any} */ moon, /** @type {any} */ moonIndex) => {
      const row = element('div', 'editor-list-row');
      row.append(element('span', '', moon.name));
      row.append(editorButton('View', () => showTeamItem([path[0], path[1], moonIndex])));
      list.append(row);
    });
    menuContent.append(list);
  }
}
