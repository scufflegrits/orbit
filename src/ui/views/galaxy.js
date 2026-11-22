// The Galaxy (2.2.1 render.js): the suns as orbits or as a list, the quick
// bar (routines, favorites, recent links), and Quick find's results in
// place of the map while it is filtering. Moved in rewrite phase 5.
import { findMatches } from '../../core/search.js';
import { counted, descriptionNode, element, safeColor, tagChips } from '../dom.js';
import { findRow } from '../find/results.js';
import { modes } from '../page-modes.js';
import { destinationNode, homeGroup } from './nodes.js';

/**
 * A chip that opens a destination like its circle does. In Edit mode the
 * guard in drag.js opens it in Edit links instead.
 * @param {{item: any, path: number[]}} entry
 */
function quickChip(entry) {
  const node = destinationNode(entry.item, 'quick-chip', entry.path);
  node.dataset.editPath = entry.path.join(':');
  node.title = `${node.title} (${entry.path.length === 3 ? 'moon' : 'planet'} in ${groups[entry.path[0]].name})`;
  return node;
}

/**
 * A routine chip opens the routine; in Edit mode it opens the routine editor.
 * @param {any} routine
 * @param {number} index
 */
function routineChip(routine, index) {
  const { items } = routineItems(routine);
  const chip = element('button', 'quick-chip routine-chip', routine.name);
  chip.type = 'button';
  chip.title = `Open the ${routine.name} routine (${counted(items.length, 'link')})`;
  chip.addEventListener('click', () => {
    if (modes.inEditMode()) {
      openMenu();
      openEditorPage();
      showRoutineEditor(index);
    } else {
      runRoutine(routine);
    }
  });
  return chip;
}

/** The quick bar, or null when it is off or has nothing to show. */
export function quickBar() {
  if (!showQuickBar) return null;
  const favorites = favoriteItems();
  const recent = recentItems();
  if (!favorites.length && !recent.length && !routines.length) return null;
  const bar = element('section', 'quick-bar');
  bar.setAttribute('aria-label', 'Routines, favorites, and recent links');
  for (const [label, list] of /** @type {[string, any[]][]} */ ([['Routines', routines], ['Favorites', favorites], ['Recent', recent]])) {
    if (!list.length) continue;
    const row = element('div', 'quick-row');
    row.append(element('h2', 'quick-label', label));
    const chips = element('div', 'quick-chips');
    if (label === 'Routines') list.forEach((routine, index) => chips.append(routineChip(routine, index)));
    else list.forEach(entry => chips.append(quickChip(entry)));
    if (label === 'Favorites' && list.length > 1 && !modes.inEditMode()) {
      const all = element('button', 'quick-open-all', `Open all (${list.length})`);
      all.type = 'button';
      all.title = 'Open every favorite in new tabs';
      all.addEventListener('click', openAllFavorites);
      chips.append(all);
    }
    row.append(chips);
    bar.append(row);
  }
  return bar;
}

/**
 * @param {any} item
 * @param {number[]} path
 * @param {any} sun
 */
function listLink(item, path, sun) {
  const node = destinationNode(item, 'list-link', path);
  node.dataset.editPath = path.join(':');
  if (isFavorite(item, sun)) node.append(element('span', 'list-favorite', ' ★'));
  if (item.note) node.append(element('span', 'list-note-text', ` — ${item.note}`));
  if (item.tags?.length) node.append(tagChips(item.tags));
  return node;
}

/** The dense alternative to the orbits: every sun with its planets and moons. */
function galaxyList() {
  const list = element('div', 'galaxy-list');
  if (modes.inEditMode()) {
    list.append(element('p', 'list-note', 'Dragging works in the Orbits view. Use Edit links, or switch back to Orbits, to rearrange.'));
  }
  groups.forEach((sun, sunIndex) => {
    const section = element('details', 'list-sun');
    section.open = true;
    section.style.setProperty('--sun-accent', safeColor(sun.color));
    const summary = element('summary', 'list-sun-head');
    summary.append(element('span', 'list-sun-name', `${sun.icon ? `${sun.icon} ` : ''}${sun.name}`));
    summary.append(element('span', 'list-count', counted(sun.links.length, 'planet')));
    if (sun.team) summary.append(element('span', 'team-mark', 'TEAM'));
    const open = element('a', 'list-open', 'Open System');
    open.href = `#group/${encodeURIComponent(sun.id)}`;
    summary.append(open);
    section.append(summary);
    if (sun.description) section.append(descriptionNode('list-description', sun.description));
    const planets = element('ul', 'list-planets');
    sun.links.forEach((/** @type {any} */ planet, /** @type {number} */ planetIndex) => {
      const row = element('li', 'list-planet');
      row.append(listLink(planet, [sunIndex, planetIndex], sun));
      if (planet.moons.length) {
        const moons = element('ul', 'list-moons');
        planet.moons.forEach((/** @type {any} */ moon, /** @type {number} */ moonIndex) => {
          const item = element('li', 'list-moon');
          item.append(listLink(moon, [sunIndex, planetIndex, moonIndex], sun));
          moons.append(item);
        });
        row.append(moons);
      }
      planets.append(row);
    });
    if (!sun.links.length) planets.append(element('li', 'list-empty', 'No planets yet.'));
    section.append(planets);
    list.append(section);
  });
  return list;
}

export function renderHome() {
  app.replaceChildren();
  app.className = 'home-view';
  settingsTrigger.hidden = false;
  topbarSearch.hidden = false;
  quickFind.value = findQuery;
  const results = element('section', 'find-results');
  results.setAttribute('aria-live', 'polite');
  const listView = galaxyView === 'list';
  if (listView) app.classList.add('list-view');
  const grid = listView ? galaxyList() : element('div', 'group-grid');
  if (!listView) groups.forEach((group, index) => grid.append(homeGroup(group, index)));
  const bar = quickBar();
  const updateFind = () => {
    setFindQuery(quickFind.value);
    const active = Boolean(findQuery.trim());
    grid.hidden = active;
    const currentBar = /** @type {HTMLElement | null} */ (app.querySelector(':scope > .quick-bar'));
    if (currentBar) currentBar.hidden = active;
    results.hidden = !active;
    if (!active) return;
    const matches = findMatches(groups, findQuery);
    const address = typedAddress(findQuery);
    results.replaceChildren(element('p', 'find-summary', `${matches.length} result${matches.length === 1 ? '' : 's'} for “${findQuery.trim()}”`));
    if (address) results.append(quickAddResult(address));
    if (matches.length) {
      const list = element('div', 'find-list');
      matches.forEach(match => list.append(findRow(match)));
      results.append(list);
    } else if (!address) {
      results.append(element('p', 'find-empty', 'No matching suns, planets, or moons. Try another name, an address, or #tag.'));
    }
  };
  quickFind.oninput = updateFind;
  app.append(results);
  if (bar) app.append(bar);
  if (!groups.length) {
    const empty = element('section', 'empty-galaxy');
    empty.append(element('h1', '', `${workspaceName()} is empty`));
    empty.append(element('p', '', 'Add a sun in Edit links, paste a web address into Quick find, or import a map or a link pack.'));
    const open = element('button', 'editor-primary', 'Open Edit links');
    open.type = 'button';
    open.addEventListener('click', () => { openMenu(); openEditorPage(); });
    empty.append(open);
    app.append(empty);
  }
  app.append(grid);
  updateFind();
}
