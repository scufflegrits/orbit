// A System (2.2.1 render.js): one sun with up to eight planets on its
// orbit, the Open all buttons, and the planets and moons that don't fit.
// Moved in rewrite phase 5.
import { isGroup } from '../../core/destination.js';
import { counted, descriptionNode, element, safeColor, tagPath } from '../dom.js';
import { SYSTEM_PLANETS, VISIBLE_MOONS } from '../layout/orbits.js';
import { modes } from '../page-modes.js';
import { openAll } from './open.js';
import { linkNode, orbitLines, overflowPlanetNode, planetNode } from './nodes.js';
import { app, findQuery, groups, quickFind, rdpLaunchMode, setFindQuery, settingsTrigger, topbarSearch } from '../page.js';

/**
 * In a System: open a planet together with all of its moons.
 * @param {any} group
 * @param {number} sunIndex
 */
function openAllActions(group, sunIndex) {
  if (modes.inEditMode()) return null;
  const planets = group.links.map((/** @type {any} */ planet, /** @type {number} */ planetIndex) => ({ planet, planetIndex }))
    .filter((/** @type {any} */ { planet }) => planet.moons.length);
  if (!planets.length) return null;
  const row = element('div', 'open-all-row');
  row.append(element('span', 'open-all-label', planets.some((/** @type {{planet: any}} */ { planet }) => isGroup(planet))
    ? 'Open all links for a planet:' : 'Open a planet with all its moons:'));
  planets.forEach((/** @type {any} */ { planet, planetIndex }) => {
    const groupPlanet = isGroup(planet);
    const button = element('button', 'open-all-button', groupPlanet
      ? `${planet.name} · ${counted(planet.moons.length, 'link')}`
      : `${planet.name} + ${counted(planet.moons.length, 'moon')}`);
    button.type = 'button';
    button.title = groupPlanet
      ? `Open links in ${planet.name} in new tabs (Shift+click the group does the same)`
      : `Open ${planet.name} and its moons in new tabs (Shift+click a planet does the same)`;
    button.addEventListener('click', () => openAll(sunIndex, planetIndex));
    row.append(button);
  });
  return row;
}

/** @param {any} group */
export function renderDetail(group) {
  app.replaceChildren();
  app.className = 'detail-view';
  settingsTrigger.hidden = false;
  topbarSearch.hidden = false;
  quickFind.value = findQuery;
  quickFind.oninput = () => {
    // Typing in a System returns to the Galaxy (src/ui/modes.js MR09).
    setFindQuery(quickFind.value);
    location.hash = '';
  };
  const top = element('div', 'detail-top');
  const back = element('a', 'back-link', '←  Return to Galaxy');
  back.href = '#';
  top.append(back, element('span', 'detail-index', `${String(groups.indexOf(group) + 1).padStart(2, '0')} / ${String(groups.length).padStart(2, '0')}`));

  const heading = element('div', 'detail-heading');
  heading.append(element('p', 'eyebrow', 'EXPLORE THIS SYSTEM'));
  heading.append(element('h1', '', group.name));
  heading.append(descriptionNode('intro-copy', group.description));

  const stage = element('div', 'detail-stage');
  stage.style.setProperty('--sun-accent', safeColor(group.color));
  const visible = group.links.slice(0, SYSTEM_PLANETS);
  const center = 320;
  const radius = 205;
  const points = visible.map((/** @type {any} */ _, /** @type {number} */ i) => {
    const angle = (-90 + (360 / visible.length) * i) * Math.PI / 180;
    return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius, angle };
  });
  stage.append(orbitLines(points, center, 640));
  const sunIndex = groups.indexOf(group);
  stage.dataset.sun = String(sunIndex);
  const hub = tagPath(element('div', 'detail-hub'), 'sun', sunIndex);
  hub.tabIndex = 0;
  hub.setAttribute('role', 'group');
  hub.setAttribute('aria-label', `${group.name} sun`);
  if (!modes.inEditMode()) hub.setAttribute('aria-keyshortcuts', 'E');
  if (group.icon) hub.append(element('span', 'hub-icon', group.icon));
  hub.append(element('span', 'detail-hub-name', group.name));
  hub.append(element('span', 'detail-hub-sub', counted(group.links.length, 'planet')));
  if (group.team) hub.append(element('span', 'team-mark', 'TEAM'));
  stage.append(hub);
  visible.forEach((/** @type {any} */ link, /** @type {number} */ i) => stage.append(planetNode(link, 'detail', points[i], 640, i, sunIndex)));

  const note = element('p', 'detail-note', modes.inEditMode()
    ? 'Edit mode is on. Drag a planet or moon to move or reorder it; links stay closed until you turn Edit mode off.'
    : group.links.some((/** @type {any} */ link) => link.type === 'rdp')
    ? rdpLaunchMode === 'client'
      ? 'Select a lab to open Remote Desktop Connection with its target loaded. Your browser may ask to open the helper.'
      : 'Select a lab to download its Remote Desktop connection file. Open the file on Windows to connect.'
    : 'Select a planet to open its destination in a new tab.');
  if (!modes.inEditMode() && group.links.some(isGroup)) {
    note.textContent = 'Select a group planet to show its links. Select a linked planet to open its destination.';
  }
  app.append(top, heading, stage, note);
  const openAllRow = openAllActions(group, sunIndex);
  if (openAllRow) app.append(openAllRow);
  if (group.links.length > visible.length) {
    const more = element('section', 'more-links');
    more.append(element('h2', '', 'More planets in this system'));
    const list = element('div', 'more-grid');
    group.links.slice(visible.length).forEach((/** @type {any} */ link, /** @type {number} */ i) =>
      list.append(overflowPlanetNode(link, sunIndex, visible.length + i)));
    more.append(list);
    app.append(more);
  }
  const extraMoons = group.links.filter((/** @type {any} */ link, /** @type {number} */ index) =>
    link.moons.length > VISIBLE_MOONS && (!isGroup(link) || index < visible.length));
  if (extraMoons.length) {
    const section = element('section', 'moon-overflow');
    section.append(element('h2', '', 'More moons'));
    extraMoons.forEach((/** @type {any} */ planet) => {
      const planetIndex = group.links.indexOf(planet);
      const row = element('div', 'moon-overflow-row');
      row.append(element('h3', '', `Around ${planet.name}`));
      const links = element('div', 'moon-overflow-links');
      planet.moons.slice(VISIBLE_MOONS).forEach((/** @type {any} */ moon, /** @type {number} */ i) => links.append(
        linkNode(moon, 'overflow-moon-link', [sunIndex, planetIndex, VISIBLE_MOONS + i])));
      row.append(links);
      section.append(row);
    });
    app.append(section);
  }
}
