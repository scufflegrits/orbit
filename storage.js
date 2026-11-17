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

function readRdpLaunchPreference() {
  try {
    return localStorage.getItem('orbit:rdp-launch') === 'client' ? 'client' : 'download';
  } catch {
    return 'download';
  }
}

function validDestination(value, label) {
  if (!value || typeof value !== 'object') throw new Error(`${label} needs a name and destination.`);
  const name = String(value.name || '').trim();
  if (!name) throw new Error(`${label} needs a name.`);
  if (value.type === 'rdp') {
    const host = validRdpHost(String(value.host || '').trim(), label);
    if (value.rdpProfile === undefined) return { name, type: 'rdp', host };
    return { name, type: 'rdp', host, rdpProfile: parseRdpProfile(value.rdpProfile, host).content };
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
