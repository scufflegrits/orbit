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

// Map validation, destination keys, and placeholders moved to src/core/
// (schema.js, destination.js, templates.js) in rewrite phase 2. These names
// forward to them, looked up when called, until the callers move too.
const PLACEHOLDER = window.OrbitNext.core.PLACEHOLDER;
function validTags(value, label) { return window.OrbitNext.core.validTags(value, label); }
function templateNames(url) { return window.OrbitNext.core.templateNames(url); }
function fillTemplate(url, values) { return window.OrbitNext.core.fillTemplate(url, values); }
function validDestination(value, label) { return window.OrbitNext.core.validDestination(value, label); }
function destinationKey(item) { return window.OrbitNext.core.destinationKey(item); }
function uniqueSunId(name, used) { return window.OrbitNext.core.uniqueSunId(name, used); }
function validateMap(data) { return window.OrbitNext.core.validateMap(data); }
function validRdpPresets(value) { return window.OrbitNext.core.validRdpPresets(value); }
function presetSettings(text, name) { return window.OrbitNext.core.presetSettings(text, name); }
function validRoutines(value) { return window.OrbitNext.core.validRoutines(value); }

// ---- Version history ----------------------------------------------------

// HISTORY_STORAGE_KEY is set in app.js for the active workspace.
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
function recordHistory(previousGroups, label, previousRoutines = [], previousPresets = []) {
  const entry = { time: Date.now(), label: String(label || 'Change'), groups: previousGroups };
  if (previousRoutines.length) entry.routines = previousRoutines;
  if (previousPresets.length) entry.rdpPresets = previousPresets;
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
function personalGroups(list) { return window.OrbitNext.core.personalGroups(list); }

// Save the personal part of a map. The map as it was is kept in version
// history under `label`; pass label false to skip that (a history restore
// records its own entry).
// Routines and presets are kept unless `data` replaces them.
function saveMap(data, label = 'Change') {
  const normalized = validateMap({ groups: personalGroups(data.groups),
    routines: data.routines !== undefined ? data.routines : routines,
    rdpPresets: data.rdpPresets !== undefined ? data.rdpPresets : rdpPresets });
  const previous = personalGroups(groups);
  const previousRoutines = routines;
  localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(normalized));
  const changed = JSON.stringify([previous, previousRoutines, rdpPresets]) !==
    JSON.stringify([normalized.groups, normalized.routines || [], normalized.rdpPresets || []]);
  if (label !== false && changed) recordHistory(previous, label, previousRoutines, rdpPresets);
  if (changed) countChangeForBackup();
  groups = [...visibleTeamGroups(), ...normalized.groups];
  routines = normalized.routines || [];
  rdpPresets = normalized.rdpPresets || [];
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
