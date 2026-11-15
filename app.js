const app = document.querySelector('#app');
const count = document.querySelector('#link-count');
let groups = [];
const GALAXY_PLANETS = 5;
const SYSTEM_PLANETS = 8;
const VISIBLE_MOONS = 4;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#79d9f8';
}

function linkNode(link, className) {
  const anchor = element('a', className, link.name);
  anchor.href = link.url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.title = `Open ${link.name} in a new tab`;
  anchor.setAttribute('aria-label', `Open ${link.name} in a new tab`);
  return anchor;
}

function orbitLines(points, center, size) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'orbit-lines');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');
  for (const point of points) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', center);
    line.setAttribute('y1', center);
    line.setAttribute('x2', point.x);
    line.setAttribute('y2', point.y);
    svg.append(line);
  }
  return svg;
}

function moonSpokes(points, origin, size) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'moon-spokes');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');
  for (const point of points) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', origin.x);
    line.setAttribute('y1', origin.y);
    line.setAttribute('x2', point.x);
    line.setAttribute('y2', point.y);
    svg.append(line);
  }
  return svg;
}

function planetNode(link, context, point, size, index) {
  const cluster = element('div', `planet-cluster ${context}-planet-cluster`);
  cluster.style.setProperty('--x', `${point.x / size * 100}%`);
  cluster.style.setProperty('--y', `${point.y / size * 100}%`);
  cluster.style.setProperty('--delay', `${index * (context === 'home' ? 35 : 50)}ms`);
  cluster.append(linkNode(link, context === 'home' ? 'home-satellite' : 'detail-satellite'));

  if (link.moons.length) {
    const field = element('div', 'moon-field');
    const outward = 62;
    const radius = context === 'home' ? 78 : 88;
    const outX = Math.cos(point.angle) * outward;
    const outY = Math.sin(point.angle) * outward;
    field.style.setProperty('--out-x', `${outX}px`);
    field.style.setProperty('--out-y', `${outY}px`);
    const visible = link.moons.slice(0, VISIBLE_MOONS);
    const positions = visible.map((_, moonIndex) => {
      const spread = visible.length === 1 ? 0 : -1 + 2 * moonIndex / (visible.length - 1);
      const angle = point.angle + spread * Math.PI / 3;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
    const origin = { x: 110 - outX, y: 110 - outY };
    field.append(moonSpokes(positions.map(position => ({
      x: origin.x + position.x, y: origin.y + position.y,
    })), origin, 220));
    visible.forEach((moon, moonIndex) => {
      const node = linkNode(moon, 'moon-link');
      node.style.setProperty('--mx', `${positions[moonIndex].x - outX}px`);
      node.style.setProperty('--my', `${positions[moonIndex].y - outY}px`);
      field.append(node);
    });
    cluster.append(field);
    cluster.append(element('span', 'moon-badge', `${link.moons.length} moon${link.moons.length === 1 ? '' : 's'}`));
  }
  return cluster;
}

function overflowPlanetNode(link) {
  const item = element('div', 'overflow-planet');
  item.append(linkNode(link, 'more-link'));
  if (link.moons.length) {
    const moons = element('div', 'overflow-moons');
    link.moons.forEach(moon => moons.append(linkNode(moon, 'overflow-moon-link')));
    item.append(moons);
  }
  return item;
}

function homeGroup(group, index) {
  const card = element('section', 'group-card');
  card.style.setProperty('--accent', safeColor(group.color));
  card.style.setProperty('--card-index', index);
  const orbit = element('div', 'home-orbit');
  const visible = group.links.slice(0, GALAXY_PLANETS);
  const center = 160;
  const radius = 108;
  const points = visible.map((_, i) => {
    const angle = (-90 + (360 / visible.length) * i) * Math.PI / 180;
    return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius, angle };
  });

  orbit.append(orbitLines(points, center, 320));
  const hub = element('button', 'home-hub');
  hub.type = 'button';
  hub.setAttribute('aria-label', `Open ${group.name} system with ${group.links.length} planets`);
  hub.append(element('span', 'hub-name', group.name));
  hub.append(element('span', 'hub-count', `${group.links.length} PLANETS`));
  hub.addEventListener('click', () => { location.hash = `group/${encodeURIComponent(group.id)}`; });
  orbit.append(hub);
  visible.forEach((link, i) => orbit.append(planetNode(link, 'home', points[i], 320, i)));

  card.append(orbit, element('p', 'group-description', group.description));
  return card;
}

function renderHome() {
  app.replaceChildren();
  app.className = 'home-view';
  const intro = element('div', 'intro');
  intro.append(element('p', 'eyebrow', 'YOUR PERSONAL LINK GALAXY'));
  const title = element('h1', '', 'Explore your galaxy.');
  intro.append(title);
  intro.append(element('p', 'intro-copy', 'Hover over a sun to see its planets. Click the sun to explore its system.'));
  const grid = element('div', 'group-grid');
  groups.forEach((group, index) => grid.append(homeGroup(group, index)));
  app.append(intro, grid);
}

function renderDetail(group) {
  app.replaceChildren();
  app.className = 'detail-view';
  const top = element('div', 'detail-top');
  const back = element('a', 'back-link', '←  Return to Galaxy');
  back.href = '#';
  top.append(back, element('span', 'detail-index', `${String(groups.indexOf(group) + 1).padStart(2, '0')} / ${String(groups.length).padStart(2, '0')}`));

  const heading = element('div', 'detail-heading');
  heading.append(element('p', 'eyebrow', 'EXPLORE THIS SYSTEM'));
  heading.append(element('h1', '', group.name));
  heading.append(element('p', 'intro-copy', group.description));

  const stage = element('div', 'detail-stage');
  stage.style.setProperty('--accent', safeColor(group.color));
  const visible = group.links.slice(0, SYSTEM_PLANETS);
  const center = 320;
  const radius = 205;
  const points = visible.map((_, i) => {
    const angle = (-90 + (360 / visible.length) * i) * Math.PI / 180;
    return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius, angle };
  });
  stage.append(orbitLines(points, center, 640));
  const hub = element('div', 'detail-hub');
  hub.append(element('span', 'detail-hub-name', group.name));
  hub.append(element('span', 'detail-hub-sub', `${group.links.length} planets`));
  stage.append(hub);
  visible.forEach((link, i) => stage.append(planetNode(link, 'detail', points[i], 640, i)));

  const note = element('p', 'detail-note', 'Select a planet to open its destination in a new tab.');
  app.append(top, heading, stage, note);
  if (group.links.length > visible.length) {
    const more = element('section', 'more-links');
    more.append(element('h2', '', 'More planets in this system'));
    const list = element('div', 'more-grid');
    group.links.slice(visible.length).forEach(link => list.append(overflowPlanetNode(link)));
    more.append(list);
    app.append(more);
  }
  const extraMoons = group.links.filter(link => link.moons.length > VISIBLE_MOONS);
  if (extraMoons.length) {
    const section = element('section', 'moon-overflow');
    section.append(element('h2', '', 'More moons'));
    extraMoons.forEach(planet => {
      const row = element('div', 'moon-overflow-row');
      row.append(element('h3', '', `Around ${planet.name}`));
      const links = element('div', 'moon-overflow-links');
      planet.moons.slice(VISIBLE_MOONS).forEach(moon => links.append(linkNode(moon, 'overflow-moon-link')));
      row.append(links);
      section.append(row);
    });
    app.append(section);
  }
}

function render() {
  const route = decodeURIComponent(location.hash.slice(1));
  const id = route.startsWith('group/') ? route.slice(6) : null;
  const group = groups.find(item => item.id === id);
  if (group) renderDetail(group);
  else renderHome();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

async function init() {
  try {
    let data;
    if (location.protocol === 'file:') {
      data = window.ORBIT_DATA;
    } else {
      const response = await fetch('./links.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    }
    if (!data) throw new Error('Run `python3 sync.py` to generate links-data.js.');
    if (!Array.isArray(data.groups)) throw new Error('links.json needs a "groups" array.');
    groups = data.groups.map((group, index) => {
      if (!group.name || !Array.isArray(group.links)) throw new Error(`Group ${index + 1} needs a name and links array.`);
      const links = group.links.filter(link => link.name && /^https?:\/\//i.test(link.url)).map(link => ({
        ...link,
        moons: Array.isArray(link.moons)
          ? link.moons.filter(moon => moon.name && /^https?:\/\//i.test(moon.url))
          : [],
      }));
      return { ...group, id: String(group.id || group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')), links };
    });
    const destinations = groups.reduce((total, group) => total + group.links.reduce(
      (sum, link) => sum + 1 + link.moons.length, 0), 0);
    count.textContent = `${destinations} LINKS · ${groups.length} SUNS`;
    render();
  } catch (error) {
    app.className = 'error-view';
    app.replaceChildren(element('h1', '', 'Could not load your links.'));
    app.append(element('p', '', 'Run `python3 sync.py`, then open index.html. You can also use `python3 serve.py` for automatic updates on refresh.'));
    app.append(element('pre', '', String(error.message)));
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && location.hash) location.hash = '';
});
init();
