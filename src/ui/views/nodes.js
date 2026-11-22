// The nodes the views are built from (2.2.1 render.js): a destination link,
// its site icon, a planet with its moon field, a sun in the Galaxy, and the
// orbit lines. Moved in rewrite phase 5. Indices in `data-*` attributes are
// combined (team suns first), as the page and OrbitTest number them.
import { rdpLaunchUrl } from '../../core/rdp.js';
import { PLACEHOLDER, templateNames } from '../../core/templates.js';
import { downloadRdp } from '../../services/rdp-launch.js';
import { counted, descriptionNode, element, safeColor, tagPath } from '../dom.js';
import { GALAXY_PLANETS, VISIBLE_MOONS } from '../layout/orbits.js';
import { askForVariables } from '../dialogs/placeholder.js';
import { modes } from '../page-modes.js';

/**
 * The site's own icon, when Show site icons is on. Hidden if it fails to load.
 * @param {any} link
 */
export function siteIcon(link) {
  if (!showSiteIcons || link.type === 'rdp') return null;
  let origin;
  try { origin = new URL(link.url.replace(PLACEHOLDER, 'x')).origin; } catch { return null; }
  const image = document.createElement('img');
  image.className = 'site-icon';
  image.alt = '';
  image.loading = 'lazy';
  image.referrerPolicy = 'no-referrer';
  image.src = `${origin}/favicon.ico`;
  image.addEventListener('error', () => image.remove());
  return image;
}

/**
 * A link that opens a destination: a web link in a new tab, a Remote Desktop
 * download or launch, or a button that asks for {placeholder} values. `path`
 * ([sun, planet] or [sun, planet, moon]) lets Orbit record it as recent.
 * @param {any} link
 * @param {string} className
 * @param {number[]} [path]
 * @returns {HTMLAnchorElement | HTMLButtonElement}
 */
export function destinationNode(link, className, path) {
  const isRdp = link.type === 'rdp';
  const download = isRdp && rdpLaunchMode === 'download';
  // A link with {placeholders} asks for their values before it opens.
  const template = !isRdp && templateNames(link.url).length > 0;
  const node = /** @type {HTMLAnchorElement | HTMLButtonElement} */ (element(download || template ? 'button' : 'a', className, link.name));
  if (path) node.dataset.destination = path.join(':');
  const icon = siteIcon(link);
  if (icon) node.prepend(icon);
  const button = /** @type {HTMLButtonElement} */ (node);
  const anchor = /** @type {HTMLAnchorElement} */ (node);
  if (template) {
    button.type = 'button';
    node.dataset.template = 'true';
    node.addEventListener('click', () => askForVariables(link));
    node.title = `Open ${link.name} (asks for ${templateNames(link.url).join(', ')})`;
    node.setAttribute('aria-label', node.title);
  } else if (download) {
    button.type = 'button';
    node.addEventListener('click', () => downloadRdp(link, rdpPresets));
    node.title = `Download Remote Desktop connection for ${link.name}`;
    node.setAttribute('aria-label', node.title);
  } else if (isRdp) {
    anchor.href = rdpLaunchUrl(link, rdpPresets);
    node.title = `Open Remote Desktop Connection for ${link.name}`;
    node.setAttribute('aria-label', node.title);
  } else {
    anchor.href = link.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    node.title = `Open ${link.name} in a new tab`;
    node.setAttribute('aria-label', node.title);
  }
  if (link.note) node.title = `${node.title}\n${link.note}`;
  return node;
}

/**
 * A destination on the map, tagged with its path; paused in Edit mode.
 * @param {any} link
 * @param {string} className
 * @param {number[]} [path]
 */
export function linkNode(link, className, path) {
  const node = destinationNode(link, className, path);
  if (path) {
    tagPath(node, path.length === 3 ? 'moon' : 'planet', path[0], path[1], path[2]);
    if (modes.inEditMode()) {
      node.title = `Drag ${link.name} to move it`;
      node.setAttribute('aria-label', `${link.name}. Links are paused in Edit mode.`);
    }
  }
  return node;
}

/**
 * Lines from a sun to its planets.
 * @param {{x: number, y: number}[]} points
 * @param {number} center
 * @param {number} size
 */
export function orbitLines(points, center, size) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'orbit-lines');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');
  for (const point of points) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(center));
    line.setAttribute('y1', String(center));
    line.setAttribute('x2', String(point.x));
    line.setAttribute('y2', String(point.y));
    svg.append(line);
  }
  return svg;
}

/**
 * A planet on its orbit, with up to six moons (placed later by the layout).
 * @param {any} link
 * @param {'home'|'detail'} context
 * @param {{x: number, y: number, angle: number}} point
 * @param {number} size
 * @param {number} index
 * @param {number} sunIndex
 */
export function planetNode(link, context, point, size, index, sunIndex) {
  const cluster = element('div', `planet-cluster ${context}-planet-cluster`);
  cluster.style.setProperty('--x', `${point.x / size * 100}%`);
  cluster.style.setProperty('--y', `${point.y / size * 100}%`);
  cluster.style.setProperty('--cos', Math.cos(point.angle).toFixed(4));
  cluster.style.setProperty('--sin', Math.sin(point.angle).toFixed(4));
  cluster.style.setProperty('--delay', `${index * (context === 'home' ? 35 : 50)}ms`);
  cluster.append(linkNode(link, context === 'home' ? 'home-satellite' : 'detail-satellite', [sunIndex, index]));

  if (link.moons.length) {
    // layoutMoonField places the moons once the circle sizes are known.
    const field = element('div', 'moon-field');
    field.dataset.angle = String(point.angle);
    field.dataset.context = context;
    link.moons.slice(0, VISIBLE_MOONS).forEach((/** @type {any} */ moon, /** @type {number} */ moonIndex) =>
      field.append(linkNode(moon, 'moon-link', [sunIndex, index, moonIndex])));
    cluster.append(field);
    cluster.append(element('span', 'moon-badge', counted(link.moons.length, 'moon')));
  }
  return cluster;
}

/**
 * A planet past the eighth, listed under the System with all its moons.
 * @param {any} link
 * @param {number} sunIndex
 * @param {number} planetIndex
 */
export function overflowPlanetNode(link, sunIndex, planetIndex) {
  const item = element('div', 'overflow-planet');
  item.append(linkNode(link, 'more-link', [sunIndex, planetIndex]));
  if (link.moons.length) {
    const moons = element('div', 'overflow-moons');
    link.moons.forEach((/** @type {any} */ moon, /** @type {number} */ moonIndex) => moons.append(
      linkNode(moon, 'overflow-moon-link', [sunIndex, planetIndex, moonIndex])));
    item.append(moons);
  }
  return item;
}

/**
 * A sun in the Galaxy with its first five planets.
 * @param {any} group
 * @param {number} index
 */
export function homeGroup(group, index) {
  const card = element('section', 'group-card');
  card.style.setProperty('--sun-accent', safeColor(group.color));
  card.style.setProperty('--card-index', String(index));
  const orbit = element('div', 'home-orbit');
  orbit.dataset.sun = String(index);
  const visible = group.links.slice(0, GALAXY_PLANETS);
  const center = 160;
  const radius = 108;
  const points = visible.map((/** @type {any} */ _, /** @type {number} */ i) => {
    const angle = (-90 + (360 / visible.length) * i) * Math.PI / 180;
    return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius, angle };
  });

  orbit.append(orbitLines(points, center, 320));
  const hub = element('button', 'home-hub');
  hub.type = 'button';
  tagPath(hub, 'sun', index);
  hub.setAttribute('aria-label', `Open ${group.team ? 'team ' : ''}${group.name} system with ${counted(group.links.length, 'planet')}`);
  if (group.icon) hub.append(element('span', 'hub-icon', group.icon));
  hub.append(element('span', 'hub-name', group.name));
  hub.append(element('span', 'hub-count', counted(group.links.length, 'planet').toUpperCase()));
  if (group.team) {
    card.classList.add('team-card');
    hub.append(element('span', 'team-mark', 'TEAM'));
  }
  hub.addEventListener('click', () => { location.hash = `group/${encodeURIComponent(group.id)}`; });
  orbit.append(hub);
  visible.forEach((/** @type {any} */ link, /** @type {number} */ i) => orbit.append(planetNode(link, 'home', points[i], 320, i, index)));

  card.append(orbit, descriptionNode('group-description', group.description));
  return card;
}
