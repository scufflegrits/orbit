// Preferences, map validation, and browser storage. Loaded as a classic script
// after rdp.js and before app.js. These functions read shared state declared in
// app.js (MAP_STORAGE_KEY, UNDO_STORAGE_KEY, groups, storageWarning,
// activeMapSource) only when called, never at load time.

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

function readFontSizePreference() {
  try {
    const value = localStorage.getItem('orbit:font-size');
    return ['small', 'standard', 'large', 'extra'].includes(value) ? value : 'standard';
  } catch {
    return 'standard';
  }
}

function readGalaxyViewPreference() {
  try {
    return localStorage.getItem('orbit:galaxy-view') === 'list' ? 'list' : 'orbits';
  } catch {
    return 'orbits';
  }
}

function readRdpLaunchPreference() {
  try {
    return localStorage.getItem('orbit:rdp-launch') === 'client' ? 'client' : 'download';
  } catch {
    return 'download';
  }
}

// Tags are short lowercase words: letters, digits, spaces, and hyphens.
function validTags(value, label) {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  const tags = [];
  for (const raw of list) {
    const tag = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
    if (!tag) continue;
    if (!/^[a-z0-9][a-z0-9 -]{0,23}$/.test(tag)) {
      throw new Error(`${label} has an invalid tag “${tag}”. Use up to 24 letters, digits, spaces, or hyphens.`);
    }
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > 8) throw new Error(`${label} can have at most 8 tags.`);
  return tags;
}

// Optional extras shared by planets and moons; empty ones are left out.
function destinationExtras(value, label) {
  const extras = {};
  const tags = validTags(value.tags, label);
  if (tags.length) extras.tags = tags;
  if (value.favorite === true) extras.favorite = true;
  return extras;
}

function validDestination(value, label) {
  if (!value || typeof value !== 'object') throw new Error(`${label} needs a name and destination.`);
  const name = String(value.name || '').trim();
  if (!name) throw new Error(`${label} needs a name.`);
  const extras = destinationExtras(value, label);
  if (value.type === 'rdp') {
    const host = validRdpHost(String(value.host || '').trim(), label);
    if (value.rdpProfile === undefined) return { name, type: 'rdp', host, ...extras };
    return { name, type: 'rdp', host, rdpProfile: parseRdpProfile(value.rdpProfile, host).content, ...extras };
  }
  if (value.type !== undefined && value.type !== 'web') throw new Error(`${label} has an unsupported destination type.`);
  const url = String(value.url || '').trim();
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
      throw new Error('unsupported URL');
    }
  } catch {
    throw new Error(`${label} needs an http or https URL.`);
  }
  return { name, url, ...extras };
}

// One key per destination, so the same link is recognized wherever it appears:
// a normalized URL, or "rdp:" plus the lowercase computer and port.
function destinationKey(item) {
  if (!item) return '';
  if (item.type === 'rdp') return `rdp:${String(item.host || '').toLowerCase()}`;
  try {
    const url = new URL(item.url);
    url.hash = '';
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`;
  } catch {
    return `url:${item.url}`;
  }
}

// A sun icon is one or two characters, such as an emoji.
function validSunIcon(value, name) {
  const icon = String(value ?? '').trim();
  if (!icon) return '';
  const characters = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(icon)];
  if (characters.length > 2 || /[<>&"']/.test(icon)) throw new Error(`${name} needs an icon of one or two characters.`);
  return icon;
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
    const icon = validSunIcon(group.icon, name);
    return { id, name, description: String(group.description || ''), color, ...(icon ? { icon } : {}), links };
  });
  const routines = validRoutines(data.routines);
  return routines.length ? { groups: normalized, routines } : { groups: normalized };
}

// A routine is a named list of links, remembered by destination key so it
// survives moves and renames, with an optional schedule for the arrival offer.
function validRoutines(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Routines need to be a list.');
  const used = new Set();
  const names = new Set();
  return value.map((routine, index) => {
    if (!routine || typeof routine !== 'object') throw new Error(`Routine ${index + 1} is invalid.`);
    const name = String(routine.name || '').trim();
    if (!name || name.length > 60) throw new Error(`Routine ${index + 1} needs a name of up to 60 characters.`);
    if (names.has(name.toLocaleLowerCase())) throw new Error(`There is already a routine named ${name}.`);
    names.add(name.toLocaleLowerCase());
    if (!Array.isArray(routine.links)) throw new Error(`${name} needs a links list.`);
    const keys = new Set();
    const links = [];
    for (const link of routine.links) {
      const key = String(link?.key || '').trim();
      if (!key || key.length > 2000) throw new Error(`${name} has an invalid link.`);
      if (keys.has(key)) continue;
      keys.add(key);
      links.push({ key, name: String(link.name || '').trim().slice(0, 200) || key });
    }
    if (links.length > 100) throw new Error(`${name} can have at most 100 links.`);
    const id = routine.id && !used.has(String(routine.id)) ? String(routine.id) : uniqueSunId(name, used);
    used.add(id);
    const result = { id, name, links };
    if (routine.schedule) {
      const time = String(routine.schedule.time || '');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error(`${name} needs a time such as 08:00.`);
      const days = [...new Set((routine.schedule.days || []).map(Number))].sort();
      if (!days.length || days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) {
        throw new Error(`${name} needs at least one day for its schedule.`);
      }
      result.schedule = { time, days };
    }
    return result;
  });
}

// ---- Version history ----------------------------------------------------

const HISTORY_STORAGE_KEY = 'orbit:history:v1';
const HISTORY_LIMIT = 20;

function loadHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    return Array.isArray(list) ? list.filter(entry => entry && Array.isArray(entry.groups)) : [];
  } catch {
    return [];
  }
}

// Keep the map as it was before a change. When storage is full, drop the
// oldest versions; a failure here never blocks the change itself.
function recordHistory(previousGroups, label, previousRoutines = []) {
  const entry = { time: Date.now(), label: String(label || 'Change'), groups: previousGroups };
  if (previousRoutines.length) entry.routines = previousRoutines;
  const list = [entry, ...loadHistory()].slice(0, HISTORY_LIMIT);
  while (list.length) {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
      return;
    } catch {
      list.pop();
    }
  }
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

// Team suns sit in front of the personal map in `groups` but are never stored.
function personalGroups(list) {
  return list.filter(sun => !sun.team);
}

// Save the personal part of a map. The map as it was is kept in version
// history under `label`; pass label false to skip that (a history restore
// records its own entry).
// Routines are kept unless `data.routines` replaces them.
function saveMap(data, label = 'Change') {
  const normalized = validateMap({ groups: personalGroups(data.groups),
    routines: data.routines !== undefined ? data.routines : routines });
  const previous = personalGroups(groups);
  const previousRoutines = routines;
  localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(normalized));
  if (label !== false && JSON.stringify([previous, previousRoutines]) !==
      JSON.stringify([normalized.groups, normalized.routines || []])) {
    recordHistory(previous, label, previousRoutines);
  }
  groups = [...visibleTeamGroups(), ...normalized.groups];
  routines = normalized.routines || [];
  mapRevision++;
  activeMapSource = 'browser';
  countDestinations();
  render();
}

function loadUndoRecord() {
  try {
    const saved = localStorage.getItem(UNDO_STORAGE_KEY);
    if (!saved) return null;
    const record = JSON.parse(saved);
    return record && ['sun', 'planet', 'moon'].includes(record.kind) &&
      Number.isInteger(record.index) && record.index >= 0 && record.item ? record : null;
  } catch {
    return null;
  }
}
