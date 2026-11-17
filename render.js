// Galaxy and System rendering: link, planet, and sun nodes, Quick find results,
// and the home and detail views. Loaded as a classic script before app.js.
// Uses shared state from app.js (app, groups, findQuery, preferences) only when
// called.

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#79d9f8';
}

function labelFit(names, totalLimit, wordLimit) {
  const longest = Math.max(1, ...names.map(name => name.length));
  const word = Math.max(1, ...names.flatMap(name => name.split(/[\s/-]+/).map(part => part.length)));
  return Math.max(.8, Math.min(1, totalLimit / longest, wordLimit / word));
}

function updateMapLabelSizes() {
  // Use one fit per level so every sun in the Galaxy keeps the same type size.
  // A two-line name such as "Confluence ABC" fits the shared sun size.
  const planets = groups.flatMap(sun => sun.links.slice(0, SYSTEM_PLANETS));
  const moons = planets.flatMap(planet => planet.moons.slice(0, VISIBLE_MOONS));
  const style = document.documentElement.style;
  style.setProperty('--sun-label-fit', labelFit(groups.map(sun => sun.name), 18, 10));
  style.setProperty('--planet-label-fit', labelFit(planets.map(planet => planet.name), 17, 12));
  style.setProperty('--moon-label-fit', labelFit(moons.map(moon => moon.name), 13, 12));
}

function descriptionNode(className, description) {
  const node = element('p', className);
  const pattern = /\[([^\[\]]+)\]\(([^()\s]+)\)/g;
  let cursor = 0;
  for (const match of description.matchAll(pattern)) {
    node.append(document.createTextNode(description.slice(cursor, match.index)));
    let href = null;
    try {
      const url = new URL(match[2]);
      if (['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password) {
        href = url.href;
      }
    } catch { /* Invalid links stay visible as text. */ }
    if (href) {
      const link = element('a', 'description-link', match[1]);
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      node.append(link);
    } else {
      node.append(document.createTextNode(match[0]));
    }
    cursor = match.index + match[0].length;
  }
  node.append(document.createTextNode(description.slice(cursor)));
  return node;
}

// Mark a rendered sun, planet, or moon with its array path so Edit mode can
// find the exact stored item. Names and destinations may repeat; paths do not.
function tagPath(node, kind, sun, planet, moon) {
  node.dataset.kind = kind;
  node.dataset.sun = sun;
  if (planet !== undefined) node.dataset.planet = planet;
  if (moon !== undefined) node.dataset.moon = moon;
  return node;
}

function linkNode(link, className, path) {
  const node = destinationNode(link, className);
  if (path) {
    tagPath(node, path.length === 3 ? 'moon' : 'planet', ...path);
    if (editMode) {
      node.title = `Drag ${link.name} to move it`;
      node.setAttribute('aria-label', `${link.name}. Links are paused in Edit mode.`);
    }
  }
  return node;
}

function destinationNode(link, className) {
  const isRdp = link.type === 'rdp';
  const download = isRdp && rdpLaunchMode === 'download';
  const node = element(download ? 'button' : 'a', className, link.name);
  if (download) {
    node.type = 'button';
    node.addEventListener('click', () => downloadRdp(link));
    node.title = `Download Remote Desktop connection for ${link.name}`;
    node.setAttribute('aria-label', node.title);
  } else if (isRdp) {
    node.href = rdpLaunchUrl(link);
    node.title = `Open Remote Desktop Connection for ${link.name}`;
    node.setAttribute('aria-label', node.title);
  } else {
    node.href = link.url;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    node.title = `Open ${link.name} in a new tab`;
    node.setAttribute('aria-label', node.title);
  }
  return node;
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

function planetNode(link, context, point, size, index, sunIndex) {
  const cluster = element('div', `planet-cluster ${context}-planet-cluster`);
  cluster.style.setProperty('--x', `${point.x / size * 100}%`);
  cluster.style.setProperty('--y', `${point.y / size * 100}%`);
  cluster.style.setProperty('--delay', `${index * (context === 'home' ? 35 : 50)}ms`);
  cluster.append(linkNode(link, context === 'home' ? 'home-satellite' : 'detail-satellite', [sunIndex, index]));

  if (link.moons.length) {
    const field = element('div', 'moon-field');
    const outward = 62;
    const radius = context === 'home' ? 98 : 108;
    const outX = Math.cos(point.angle) * outward;
    const outY = Math.sin(point.angle) * outward;
    field.style.setProperty('--out-x', `${outX}px`);
    field.style.setProperty('--out-y', `${outY}px`);
    const visible = link.moons.slice(0, VISIBLE_MOONS);
    const positions = visible.map((_, moonIndex) => {
      const spread = visible.length === 1 ? 0 : -1 + 2 * moonIndex / (visible.length - 1);
      const angle = point.angle + spread * Math.PI * 65 / 180;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
    const origin = { x: 110 - outX, y: 110 - outY };
    field.append(moonSpokes(positions.map(position => ({
      x: origin.x + position.x, y: origin.y + position.y,
    })), origin, 220));
    visible.forEach((moon, moonIndex) => {
      const node = linkNode(moon, 'moon-link', [sunIndex, index, moonIndex]);
      node.style.setProperty('--mx', `${positions[moonIndex].x - outX}px`);
      node.style.setProperty('--my', `${positions[moonIndex].y - outY}px`);
      field.append(node);
    });
    cluster.append(field);
    cluster.append(element('span', 'moon-badge', `${link.moons.length} moon${link.moons.length === 1 ? '' : 's'}`));
  }
  return cluster;
}

function overflowPlanetNode(link, sunIndex, planetIndex) {
  const item = element('div', 'overflow-planet');
  item.append(linkNode(link, 'more-link', [sunIndex, planetIndex]));
  if (link.moons.length) {
    const moons = element('div', 'overflow-moons');
    link.moons.forEach((moon, moonIndex) => moons.append(
      linkNode(moon, 'overflow-moon-link', [sunIndex, planetIndex, moonIndex])));
    item.append(moons);
  }
  return item;
}

function homeGroup(group, index) {
  const card = element('section', 'group-card');
  card.style.setProperty('--sun-accent', safeColor(group.color));
  card.style.setProperty('--card-index', index);
  const orbit = element('div', 'home-orbit');
  orbit.dataset.sun = index;
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
  tagPath(hub, 'sun', index);
  hub.setAttribute('aria-label', `Open ${group.name} system with ${group.links.length} planets`);
  hub.append(element('span', 'hub-name', group.name));
  hub.append(element('span', 'hub-count', `${group.links.length} PLANETS`));
  hub.addEventListener('click', () => { location.hash = `group/${encodeURIComponent(group.id)}`; });
  orbit.append(hub);
  visible.forEach((link, i) => orbit.append(planetNode(link, 'home', points[i], 320, i, index)));

  card.append(orbit, descriptionNode('group-description', group.description));
  return card;
}

function findMatches(query) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const matches = [];
  for (const [sunIndex, sun] of groups.entries()) {
    if (sun.name.toLocaleLowerCase().includes(needle)) {
      matches.push({ kind: 'Sun', name: sun.name, path: 'Galaxy', id: sun.id });
    }
    for (const [planetIndex, planet] of sun.links.entries()) {
      if (planet.name.toLocaleLowerCase().includes(needle)) {
        matches.push({ kind: 'Planet', name: planet.name, path: sun.name, destination: planet,
          indices: [sunIndex, planetIndex] });
      }
      for (const [moonIndex, moon] of planet.moons.entries()) {
        if (moon.name.toLocaleLowerCase().includes(needle)) {
          matches.push({ kind: 'Moon', name: moon.name,
            path: `${sun.name} / ${planet.name}`, destination: moon,
            indices: [sunIndex, planetIndex, moonIndex] });
        }
      }
    }
  }
  return matches;
}

// In Edit mode a planet or moon result opens that exact item in Edit links
// instead of launching it.
function editFindResult(match) {
  const node = element('button', 'find-item find-item-edit');
  node.type = 'button';
  node.title = `Edit ${match.name} in Edit links`;
  node.addEventListener('click', () => openEditorAt(match.indices));
  node.append(element('span', 'find-kind', match.kind));
  const copy = element('span', 'find-copy');
  copy.append(element('strong', '', match.name), element('small', '', match.path));
  node.append(copy, element('span', 'find-arrow find-edit-label', 'Edit'));
  return node;
}

function findResult(match) {
  if (editMode && match.indices) return editFindResult(match);
  const isRdp = match.destination?.type === 'rdp';
  const download = isRdp && rdpLaunchMode === 'download';
  const node = element(match.id || download ? 'button' : 'a', 'find-item');
  if (match.id) {
    node.type = 'button';
    node.addEventListener('click', () => { location.hash = `group/${encodeURIComponent(match.id)}`; });
  } else if (download) {
    node.type = 'button';
    node.addEventListener('click', () => downloadRdp(match.destination));
    node.title = `Download Remote Desktop connection for ${match.name}`;
  } else if (isRdp) {
    node.href = rdpLaunchUrl(match.destination);
    node.title = `Open Remote Desktop Connection for ${match.name}`;
  } else {
    node.href = match.destination.url;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
  }
  node.append(element('span', 'find-kind', match.kind));
  const copy = element('span', 'find-copy');
  copy.append(element('strong', '', match.name), element('small', '', match.path));
  node.append(copy, element('span', 'find-arrow', match.id ? '→' : download ? '↓' : '↗'));
  return node;
}

function renderHome() {
  app.replaceChildren();
  app.className = 'home-view';
  settingsTrigger.hidden = false;
  topbarSearch.hidden = false;
  quickFind.value = findQuery;
  const results = element('section', 'find-results');
  results.setAttribute('aria-live', 'polite');
  const grid = element('div', 'group-grid');
  groups.forEach((group, index) => grid.append(homeGroup(group, index)));
  const updateFind = () => {
    findQuery = quickFind.value;
    const active = Boolean(findQuery.trim());
    grid.hidden = active;
    results.hidden = !active;
    if (!active) return;
    const matches = findMatches(findQuery);
    results.replaceChildren(element('p', 'find-summary', `${matches.length} result${matches.length === 1 ? '' : 's'} for “${findQuery.trim()}”`));
    if (matches.length) {
      const list = element('div', 'find-list');
      matches.forEach(match => list.append(findResult(match)));
      results.append(list);
    } else {
      results.append(element('p', 'find-empty', 'No matching suns, planets, or moons. Try another name.'));
    }
  };
  quickFind.oninput = updateFind;
  app.append(results, grid);
  updateFind();
}

function renderDetail(group) {
  app.replaceChildren();
  app.className = 'detail-view';
  settingsTrigger.hidden = false;
  topbarSearch.hidden = false;
  quickFind.value = findQuery;
  quickFind.oninput = () => {
    findQuery = quickFind.value;
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
  const points = visible.map((_, i) => {
    const angle = (-90 + (360 / visible.length) * i) * Math.PI / 180;
    return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius, angle };
  });
  stage.append(orbitLines(points, center, 640));
  const sunIndex = groups.indexOf(group);
  stage.dataset.sun = sunIndex;
  const hub = tagPath(element('div', 'detail-hub'), 'sun', sunIndex);
  hub.append(element('span', 'detail-hub-name', group.name));
  hub.append(element('span', 'detail-hub-sub', `${group.links.length} planets`));
  stage.append(hub);
  visible.forEach((link, i) => stage.append(planetNode(link, 'detail', points[i], 640, i, sunIndex)));

  const note = element('p', 'detail-note', editMode
    ? 'Edit mode is on. Drag a planet or moon to move or reorder it; links stay closed until you turn Edit mode off.'
    : group.links.some(link => link.type === 'rdp')
    ? rdpLaunchMode === 'client'
      ? 'Select a lab to open Remote Desktop Connection with its target loaded. Your browser may ask to open the helper.'
      : 'Select a lab to download its Remote Desktop connection file. Open the file on Windows to connect.'
    : 'Select a planet to open its destination in a new tab.');
  app.append(top, heading, stage, note);
  if (group.links.length > visible.length) {
    const more = element('section', 'more-links');
    more.append(element('h2', '', 'More planets in this system'));
    const list = element('div', 'more-grid');
    group.links.slice(visible.length).forEach((link, i) =>
      list.append(overflowPlanetNode(link, sunIndex, visible.length + i)));
    more.append(list);
    app.append(more);
  }
  const extraMoons = group.links.filter(link => link.moons.length > VISIBLE_MOONS);
  if (extraMoons.length) {
    const section = element('section', 'moon-overflow');
    section.append(element('h2', '', 'More moons'));
    extraMoons.forEach(planet => {
      const planetIndex = group.links.indexOf(planet);
      const row = element('div', 'moon-overflow-row');
      row.append(element('h3', '', `Around ${planet.name}`));
      const links = element('div', 'moon-overflow-links');
      planet.moons.slice(VISIBLE_MOONS).forEach((moon, i) => links.append(
        linkNode(moon, 'overflow-moon-link', [sunIndex, planetIndex, VISIBLE_MOONS + i])));
      row.append(links);
      section.append(row);
    });
    app.append(section);
  }
}

function render() {
  // A render replaces the nodes a drag is holding, so end the gesture first.
  cancelDrag();
  updateMapLabelSizes();
  const route = decodeURIComponent(location.hash.slice(1));
  const id = route.startsWith('group/') ? route.slice(6) : null;
  const group = groups.find(item => item.id === id);
  if (group) renderDetail(group);
  else renderHome();
  editToggle.hidden = false;
  updateEditBar();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
