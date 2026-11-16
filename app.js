const app = document.querySelector('#app');
const count = document.querySelector('#link-count');
const settingsTrigger = document.querySelector('#settings-trigger');
const menuOverlay = document.querySelector('#menu-overlay');
const menuContent = document.querySelector('#menu-content');
const APP_VERSION = '1.0.0';
let groups = [];
const GALAXY_PLANETS = 5;
const SYSTEM_PLANETS = 8;
const VISIBLE_MOONS = 4;
const MAP_STORAGE_KEY = 'orbit:map:v1';
let animationsEnabled = readBooleanPreference('orbit:animations', true);
let alwaysShowMoons = readBooleanPreference('orbit:always-show-moons', false);
let activeTheme = readThemePreference();
let seedData = null;
let storageWarning = '';
let findQuery = '';
document.documentElement.dataset.animations = animationsEnabled ? 'on' : 'off';
document.documentElement.dataset.moons = alwaysShowMoons ? 'always' : 'hover';
document.documentElement.dataset.theme = activeTheme;

function readBooleanPreference(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

function savePreference(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* Storage may be unavailable. */ }
}

function readThemePreference() {
  try {
    const value = localStorage.getItem('orbit:theme');
    return ['default', 'alabama', 'auburn'].includes(value) ? value : 'default';
  } catch {
    return 'default';
  }
}

function validDestination(value, label) {
  if (!value || typeof value !== 'object') throw new Error(`${label} needs a name and URL.`);
  const name = String(value.name || '').trim();
  const url = String(value.url || '').trim();
  if (!name) throw new Error(`${label} needs a name.`);
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
      throw new Error('unsupported URL');
    }
  } catch {
    throw new Error(`${label} needs an http or https URL.`);
  }
  return { name, url };
}

function uniqueSunId(name, used) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sun';
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  return id;
}

function validateMap(data) {
  if (!data || !Array.isArray(data.groups)) throw new Error('The link map needs a "groups" array.');
  const used = new Set();
  const normalized = data.groups.map((group, groupIndex) => {
    if (!group || typeof group !== 'object') throw new Error(`Sun ${groupIndex + 1} is invalid.`);
    const name = String(group.name || '').trim();
    if (!name) throw new Error(`Sun ${groupIndex + 1} needs a name.`);
    const color = group.color === undefined ? '#79d9f8' : String(group.color).trim();
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`${name} needs a six-digit hex color.`);
    if (!Array.isArray(group.links)) throw new Error(`${name} needs a planets array.`);
    const id = group.id === undefined || group.id === null || group.id === ''
      ? uniqueSunId(name, used) : String(group.id);
    if (used.has(id)) throw new Error(`Duplicate sun ID: ${id}`);
    used.add(id);
    const links = group.links.map((link, linkIndex) => {
      const planet = validDestination(link, `Planet ${linkIndex + 1} in ${name}`);
      if (link.moons !== undefined && !Array.isArray(link.moons)) {
        throw new Error(`${planet.name} needs a moons array.`);
      }
      const moons = (link.moons || []).map((moon, moonIndex) =>
        validDestination(moon, `Moon ${moonIndex + 1} around ${planet.name}`));
      return { ...planet, moons };
    });
    return { id, name, description: String(group.description || ''), color, links };
  });
  return { groups: normalized };
}

function countDestinations() {
  const destinations = groups.reduce((total, group) => total + group.links.reduce(
    (sum, link) => sum + 1 + link.moons.length, 0), 0);
  count.textContent = `${destinations} LINKS · ${groups.length} SUNS`;
}

function loadBrowserMap() {
  try {
    const text = localStorage.getItem(MAP_STORAGE_KEY);
    return text ? validateMap(JSON.parse(text)) : null;
  } catch (error) {
    storageWarning = `Saved browser data could not be loaded: ${error.message}`;
    return null;
  }
}

function saveMap(data) {
  const normalized = validateMap(data);
  localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(normalized));
  groups = normalized.groups;
  countDestinations();
  render();
}

function closeMenu() {
  menuOverlay.hidden = true;
}

function openMenu() {
  menuContent.replaceChildren();
  for (const option of document.querySelectorAll('[data-menu-panel]')) option.classList.remove('active');
  menuOverlay.hidden = false;
}

function showMenuPanel(name) {
  menuContent.replaceChildren();
  for (const option of document.querySelectorAll('[data-menu-panel]')) {
    option.classList.toggle('active', option.dataset.menuPanel === name);
  }
  menuContent.append(element('h3', '', name));
  if (name === 'Settings') {
    const themeRow = element('label', 'setting-row');
    const themeCopy = element('span', 'setting-copy');
    themeCopy.append(element('strong', '', 'Theme'));
    themeCopy.append(element('small', '', 'Choose the colors for your Galaxy'));
    const themeSelect = document.createElement('select');
    themeSelect.setAttribute('aria-label', 'Theme');
    for (const [value, label] of [
      ['default', 'Default'], ['alabama', 'Alabama inspired'], ['auburn', 'Auburn inspired'],
    ]) {
      const option = element('option', '', label);
      option.value = value;
      themeSelect.append(option);
    }
    themeSelect.value = activeTheme;
    themeSelect.addEventListener('change', () => {
      activeTheme = themeSelect.value;
      document.documentElement.dataset.theme = activeTheme;
      savePreference('orbit:theme', activeTheme);
    });
    themeRow.append(themeCopy, themeSelect);
    menuContent.append(themeRow);
    const row = element('label', 'setting-row');
    const copy = element('span', 'setting-copy');
    copy.append(element('strong', '', 'Animations'));
    copy.append(element('small', '', 'Movement and reveal effects throughout Orbit'));
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = animationsEnabled;
    input.setAttribute('aria-label', 'Animations');
    input.addEventListener('change', () => {
      animationsEnabled = input.checked;
      document.documentElement.dataset.animations = animationsEnabled ? 'on' : 'off';
      savePreference('orbit:animations', animationsEnabled);
    });
    row.append(copy, input);
    menuContent.append(row);
    const moonRow = element('label', 'setting-row');
    const moonCopy = element('span', 'setting-copy');
    moonCopy.append(element('strong', '', 'Always show moons'));
    moonCopy.append(element('small', '', 'Show moons around visible planets without hovering'));
    const moonInput = document.createElement('input');
    moonInput.type = 'checkbox';
    moonInput.checked = alwaysShowMoons;
    moonInput.setAttribute('aria-label', 'Always show moons');
    moonInput.addEventListener('change', () => {
      alwaysShowMoons = moonInput.checked;
      document.documentElement.dataset.moons = alwaysShowMoons ? 'always' : 'hover';
      savePreference('orbit:always-show-moons', alwaysShowMoons);
    });
    moonRow.append(moonCopy, moonInput);
    menuContent.append(moonRow);
    const edit = element('button', 'editor-open', 'Edit links');
    edit.type = 'button';
    edit.addEventListener('click', () => showEditor('suns'));
    menuContent.append(edit);
    if (storageWarning) menuContent.append(element('p', 'editor-error', storageWarning));
  } else if (name === 'Help') {
    menuContent.append(element('p', '', 'The Galaxy contains your suns. Hover over a sun to see its first five planets, then hover over a planet to reveal its moons.'));
    menuContent.append(element('p', '', 'Click a sun to open its System and find more planets. Click a planet or moon to open its destination in a new tab.'));
    menuContent.append(element('p', '', 'Use Quick find in the Galaxy to search any sun, planet, or moon by name.'));
  } else if (name === 'About') {
    menuContent.append(element('p', '', 'Orbit is a local link map that keeps your favorite destinations in a visual Galaxy.'));
    menuContent.append(element('p', '', 'Your link map runs on this computer, without an account or hosted service.'));
    menuContent.append(element('p', '', `Version ${APP_VERSION}`));
  }
}

function editorButton(label, action, className = 'editor-button') {
  const button = element('button', className, label);
  button.type = 'button';
  button.addEventListener('click', action);
  return button;
}

function editorField(label, value, type = 'text') {
  const wrapper = element('label', 'editor-field');
  wrapper.append(element('span', '', label));
  const input = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
  if (type !== 'textarea') input.type = type;
  input.value = value;
  wrapper.append(input);
  return { wrapper, input };
}

function editorError(message) {
  const previous = menuContent.querySelector('.editor-error');
  if (previous) previous.remove();
  menuContent.prepend(element('p', 'editor-error', message));
}

function editorHeader(title, back) {
  menuContent.replaceChildren();
  const header = element('div', 'editor-header');
  header.append(editorButton('← Back', back, 'editor-back'));
  header.append(element('h3', '', title));
  menuContent.append(header);
}

function copyGroups() {
  return JSON.parse(JSON.stringify(groups));
}

function applyEditorChange(nextGroups, showNext) {
  try {
    saveMap({ groups: nextGroups });
    storageWarning = '';
    showNext();
  } catch (error) {
    editorError(error.message);
  }
}

function moveEntry(items, index, amount) {
  const target = index + amount;
  if (target < 0 || target >= items.length) return false;
  [items[index], items[target]] = [items[target], items[index]];
  return true;
}

function editorActions() {
  const actions = element('div', 'editor-actions');
  menuContent.append(actions);
  return actions;
}

function exportMap() {
  const blob = new Blob([JSON.stringify({ groups }, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'orbit-links.json';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showImportReview(data) {
  editorHeader('Review import', showSunList);
  const planetCount = data.groups.reduce((sum, sun) => sum + sun.links.length, 0);
  const moonCount = data.groups.reduce((sum, sun) => sum + sun.links.reduce(
    (total, planet) => total + planet.moons.length, 0), 0);
  menuContent.append(element('p', '', `${data.groups.length} suns · ${planetCount} planets · ${moonCount} moons`));
  menuContent.append(element('p', '', 'Applying this file replaces the link map saved in this browser. Export your current map first if you want a backup.'));
  const actions = editorActions();
  actions.append(editorButton('Apply import', () => applyEditorChange(data.groups, showSunList), 'editor-primary'));
  actions.append(editorButton('Cancel', showSunList));
}

function importMap() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    if (!input.files.length) return;
    try {
      showImportReview(validateMap(JSON.parse(await input.files[0].text())));
    } catch (error) {
      editorError(`Import failed: ${error.message}`);
    }
  });
  input.click();
}

function resetMap() {
  if (!window.confirm('Replace browser edits with the link data loaded from the project files?')) return;
  try {
    localStorage.removeItem(MAP_STORAGE_KEY);
    groups = validateMap(seedData).groups;
    storageWarning = '';
    countDestinations();
    render();
    showSunList();
  } catch (error) {
    editorError(error.message);
  }
}

function showSunList() {
  editorHeader('Edit links', () => showMenuPanel('Settings'));
  menuContent.append(element('p', '', 'Choose a sun to edit its planets and moons. Changes are saved in this browser.'));
  const list = element('div', 'editor-list');
  groups.forEach((sun, index) => {
    const row = element('div', 'editor-list-row');
    row.append(element('span', '', `${sun.name} · ${sun.links.length} planets`));
    row.append(editorButton('Edit', () => showSunEditor(index)));
    list.append(row);
  });
  menuContent.append(list);
  const actions = editorActions();
  actions.append(editorButton('Add sun', () => showSunEditor(null), 'editor-primary'));
  actions.append(editorButton('Import JSON', importMap));
  actions.append(editorButton('Export JSON', exportMap));
  actions.append(editorButton('Reset to file data', resetMap));
}

function showSunEditor(index) {
  const isNew = index === null;
  const sun = isNew ? { name: '', description: '', color: '#79d9f8', links: [] } : groups[index];
  editorHeader(isNew ? 'Add sun' : `Edit ${sun.name}`, showSunList);
  const form = element('form', 'editor-form');
  const name = editorField('Sun name', sun.name);
  const description = editorField('Description', sun.description, 'textarea');
  const color = editorField('Color', sun.color, 'color');
  form.append(name.wrapper, description.wrapper, color.wrapper);
  const actions = element('div', 'editor-actions');
  const save = element('button', 'editor-primary', isNew ? 'Add sun' : 'Save sun');
  save.type = 'submit';
  actions.append(save);
  if (!isNew) {
    actions.append(editorButton('Move up', () => {
      const next = copyGroups();
      if (moveEntry(next, index, -1)) applyEditorChange(next, () => showSunEditor(index - 1));
    }));
    actions.append(editorButton('Move down', () => {
      const next = copyGroups();
      if (moveEntry(next, index, 1)) applyEditorChange(next, () => showSunEditor(index + 1));
    }));
    actions.append(editorButton('Remove sun', () => {
      if (!window.confirm(`Remove ${sun.name} and all its planets and moons?`)) return;
      const next = copyGroups();
      next.splice(index, 1);
      applyEditorChange(next, showSunList);
    }, 'editor-danger'));
  }
  form.append(actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = copyGroups();
    const value = { name: name.input.value.trim(), description: description.input.value.trim(),
      color: color.input.value, links: isNew ? [] : next[index].links };
    if (isNew) {
      value.id = uniqueSunId(value.name, new Set(next.map(item => item.id)));
      next.push(value);
    } else {
      value.id = next[index].id;
      next[index] = value;
    }
    applyEditorChange(next, () => showSunEditor(isNew ? next.length - 1 : index));
  });
  menuContent.append(form);
  if (!isNew) {
    menuContent.append(element('h4', 'editor-section-title', 'Planets'));
    const list = element('div', 'editor-list');
    sun.links.forEach((planet, planetIndex) => {
      const row = element('div', 'editor-list-row');
      row.append(element('span', '', `${planet.name} · ${planet.moons.length} moons`));
      row.append(editorButton('Edit', () => showPlanetEditor(index, planetIndex)));
      list.append(row);
    });
    menuContent.append(list);
    editorActions().append(editorButton('Add planet', () => showPlanetEditor(index, null), 'editor-primary'));
  }
}

function showPlanetEditor(sunIndex, planetIndex) {
  const isNew = planetIndex === null;
  const planet = isNew ? { name: '', url: '', moons: [] } : groups[sunIndex].links[planetIndex];
  editorHeader(isNew ? 'Add planet' : `Edit ${planet.name}`, () => showSunEditor(sunIndex));
  menuContent.append(element('p', '', `Sun: ${groups[sunIndex].name}`));
  const form = element('form', 'editor-form');
  const name = editorField('Planet name', planet.name);
  const url = editorField('Destination URL', planet.url, 'url');
  form.append(name.wrapper, url.wrapper);
  const actions = element('div', 'editor-actions');
  const save = element('button', 'editor-primary', isNew ? 'Add planet' : 'Save planet');
  save.type = 'submit';
  actions.append(save);
  if (!isNew) {
    for (const [label, amount] of [['Move up', -1], ['Move down', 1]]) {
      actions.append(editorButton(label, () => {
        const next = copyGroups();
        if (moveEntry(next[sunIndex].links, planetIndex, amount)) {
          applyEditorChange(next, () => showPlanetEditor(sunIndex, planetIndex + amount));
        }
      }));
    }
    actions.append(editorButton('Remove planet', () => {
      if (!window.confirm(`Remove ${planet.name} and all its moons?`)) return;
      const next = copyGroups();
      next[sunIndex].links.splice(planetIndex, 1);
      applyEditorChange(next, () => showSunEditor(sunIndex));
    }, 'editor-danger'));
  }
  form.append(actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = copyGroups();
    const value = { name: name.input.value.trim(), url: url.input.value.trim(),
      moons: isNew ? [] : next[sunIndex].links[planetIndex].moons };
    if (isNew) next[sunIndex].links.push(value);
    else next[sunIndex].links[planetIndex] = value;
    applyEditorChange(next, () => showPlanetEditor(sunIndex,
      isNew ? next[sunIndex].links.length - 1 : planetIndex));
  });
  menuContent.append(form);
  if (!isNew) {
    menuContent.append(element('h4', 'editor-section-title', 'Moons'));
    const list = element('div', 'editor-list');
    planet.moons.forEach((moon, moonIndex) => {
      const row = element('div', 'editor-list-row');
      row.append(element('span', '', moon.name));
      row.append(editorButton('Edit', () => showMoonEditor(sunIndex, planetIndex, moonIndex)));
      list.append(row);
    });
    menuContent.append(list);
    editorActions().append(editorButton('Add moon', () => showMoonEditor(sunIndex, planetIndex, null), 'editor-primary'));
  }
}

function showMoonEditor(sunIndex, planetIndex, moonIndex) {
  const isNew = moonIndex === null;
  const planet = groups[sunIndex].links[planetIndex];
  const moon = isNew ? { name: '', url: '' } : planet.moons[moonIndex];
  editorHeader(isNew ? 'Add moon' : `Edit ${moon.name}`,
    () => showPlanetEditor(sunIndex, planetIndex));
  menuContent.append(element('p', '', `${groups[sunIndex].name} sun → ${planet.name} planet`));
  const form = element('form', 'editor-form');
  const name = editorField('Moon name', moon.name);
  const url = editorField('Destination URL', moon.url, 'url');
  form.append(name.wrapper, url.wrapper);
  const actions = element('div', 'editor-actions');
  const save = element('button', 'editor-primary', isNew ? 'Add moon' : 'Save moon');
  save.type = 'submit';
  actions.append(save);
  if (!isNew) {
    for (const [label, amount] of [['Move up', -1], ['Move down', 1]]) {
      actions.append(editorButton(label, () => {
        const next = copyGroups();
        if (moveEntry(next[sunIndex].links[planetIndex].moons, moonIndex, amount)) {
          applyEditorChange(next, () => showMoonEditor(sunIndex, planetIndex, moonIndex + amount));
        }
      }));
    }
    actions.append(editorButton('Remove moon', () => {
      if (!window.confirm(`Remove ${moon.name}?`)) return;
      const next = copyGroups();
      next[sunIndex].links[planetIndex].moons.splice(moonIndex, 1);
      applyEditorChange(next, () => showPlanetEditor(sunIndex, planetIndex));
    }, 'editor-danger'));
  }
  form.append(actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = copyGroups();
    const value = { name: name.input.value.trim(), url: url.input.value.trim() };
    if (isNew) next[sunIndex].links[planetIndex].moons.push(value);
    else next[sunIndex].links[planetIndex].moons[moonIndex] = value;
    applyEditorChange(next, () => showMoonEditor(sunIndex, planetIndex,
      isNew ? next[sunIndex].links[planetIndex].moons.length - 1 : moonIndex));
  });
  menuContent.append(form);
}

function showEditor(level) {
  if (level === 'suns') showSunList();
}

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
  card.style.setProperty('--sun-accent', safeColor(group.color));
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

function findMatches(query) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const matches = [];
  for (const sun of groups) {
    if (sun.name.toLocaleLowerCase().includes(needle)) {
      matches.push({ kind: 'Sun', name: sun.name, path: 'Galaxy', id: sun.id });
    }
    for (const planet of sun.links) {
      if (planet.name.toLocaleLowerCase().includes(needle)) {
        matches.push({ kind: 'Planet', name: planet.name, path: sun.name, url: planet.url });
      }
      for (const moon of planet.moons) {
        if (moon.name.toLocaleLowerCase().includes(needle)) {
          matches.push({ kind: 'Moon', name: moon.name,
            path: `${sun.name} / ${planet.name}`, url: moon.url });
        }
      }
    }
  }
  return matches;
}

function findResult(match) {
  const node = element(match.id ? 'button' : 'a', 'find-item');
  if (match.id) {
    node.type = 'button';
    node.addEventListener('click', () => { location.hash = `group/${encodeURIComponent(match.id)}`; });
  } else {
    node.href = match.url;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
  }
  node.append(element('span', 'find-kind', match.kind));
  const copy = element('span', 'find-copy');
  copy.append(element('strong', '', match.name), element('small', '', match.path));
  node.append(copy, element('span', 'find-arrow', match.id ? '→' : '↗'));
  return node;
}

function renderHome() {
  app.replaceChildren();
  app.className = 'home-view';
  settingsTrigger.hidden = false;
  const intro = element('div', 'intro');
  intro.append(element('p', 'eyebrow', 'YOUR PERSONAL LINK GALAXY'));
  const title = element('h1', '', 'Explore your galaxy.');
  intro.append(title);
  intro.append(element('p', 'intro-copy', 'Hover over a sun to see its planets. Click the sun to explore its system.'));
  const find = element('div', 'find');
  const label = element('label', 'find-label', 'Quick find');
  const input = element('input', 'find-input');
  input.type = 'search';
  input.placeholder = 'Search suns, planets, moons';
  input.autocomplete = 'off';
  input.value = findQuery;
  label.append(input);
  find.append(label);
  const results = element('section', 'find-results');
  results.setAttribute('aria-live', 'polite');
  const grid = element('div', 'group-grid');
  groups.forEach((group, index) => grid.append(homeGroup(group, index)));
  const updateFind = () => {
    findQuery = input.value;
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
  input.addEventListener('input', updateFind);
  app.append(intro, find, results, grid);
  updateFind();
}

function renderDetail(group) {
  app.replaceChildren();
  app.className = 'detail-view';
  settingsTrigger.hidden = true;
  const top = element('div', 'detail-top');
  const back = element('a', 'back-link', '←  Return to Galaxy');
  back.href = '#';
  top.append(back, element('span', 'detail-index', `${String(groups.indexOf(group) + 1).padStart(2, '0')} / ${String(groups.length).padStart(2, '0')}`));

  const heading = element('div', 'detail-heading');
  heading.append(element('p', 'eyebrow', 'EXPLORE THIS SYSTEM'));
  heading.append(element('h1', '', group.name));
  heading.append(element('p', 'intro-copy', group.description));

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
    seedData = validateMap(data);
    groups = (loadBrowserMap() || seedData).groups;
    countDestinations();
    render();
  } catch (error) {
    app.className = 'error-view';
    app.replaceChildren(element('h1', '', 'Could not load your links.'));
    app.append(element('p', '', 'Run `python3 sync.py`, then open index.html. You can also use `python3 serve.py` for automatic updates on refresh.'));
    app.append(element('pre', '', String(error.message)));
  }
}

window.addEventListener('hashchange', () => { closeMenu(); render(); });
settingsTrigger.addEventListener('click', openMenu);
document.querySelector('#menu-close').addEventListener('click', closeMenu);
document.querySelector('#menu-scrim').addEventListener('click', closeMenu);
for (const option of document.querySelectorAll('[data-menu-panel]')) {
  option.addEventListener('click', () => showMenuPanel(option.dataset.menuPanel));
}
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && location.hash) location.hash = '';
});
init();
