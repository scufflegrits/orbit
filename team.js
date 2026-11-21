// Read-only team map. Loaded as a classic script after storage.js. A team map is
// an ordinary Orbit map file: `serve.py --team PATH` serves it as team.json, and
// `sync.py --team PATH` writes team-data.js for file:// use. Team suns are shown
// in front of the personal map, marked `team: true`, and never saved or exported.

const TEAM_HIDDEN_KEY = 'orbit:team-hidden';
const TEAM_FAVORITES_KEY = 'orbit:team-favorites';
let teamGroups = [];
let teamSource = '';
let teamError = '';

function readStoredSet(key) {
  try {
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeStoredSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch { /* Storage may be unavailable. */ }
}

function hiddenTeamSuns() {
  return readStoredSet(TEAM_HIDDEN_KEY);
}

function visibleTeamGroups() {
  const hidden = hiddenTeamSuns();
  return teamGroups.filter(sun => !hidden.has(sun.id));
}

async function fetchTeamData() {
  if (location.protocol !== 'file:') {
    try {
      const response = await fetch('./team.json', { cache: 'no-store' });
      if (response.ok) return { data: await response.json(), source: 'team.json from serve.py --team' };
      if (response.status !== 404) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (!window.ORBIT_TEAM_DATA) throw error;
    }
  }
  return window.ORBIT_TEAM_DATA ? { data: window.ORBIT_TEAM_DATA, source: 'team-data.js' } : null;
}

// Load the team map; a problem is reported in Settings and never blocks the
// personal map.
async function loadTeamMap() {
  teamGroups = [];
  teamSource = '';
  teamError = '';
  try {
    const loaded = await fetchTeamData();
    if (!loaded) return;
    // Team ids are prefixed so they can never collide with personal sun ids.
    teamGroups = validateMap(loaded.data).groups.map(sun => ({ ...sun, id: `team:${sun.id}`, team: true }));
    teamSource = loaded.source;
  } catch (error) {
    teamError = `The team map could not be loaded: ${error.message}`;
  }
}

function setTeamSunHidden(id, hidden) {
  const set = hiddenTeamSuns();
  if (hidden) set.add(id);
  else set.delete(id);
  writeStoredSet(TEAM_HIDDEN_KEY, set);
  groups = [...visibleTeamGroups(), ...personalGroups(groups)];
  mapRevision++;
  countDestinations();
  render();
}

function isTeamPath(path) {
  return Boolean(groups[path.sun]?.team);
}

// Copy a team item into the personal map, as an independent link. Moved to
// src/core/map-ops.js in rewrite phase 2.
function plainCopy(item) { return window.OrbitNext.core.plainCopy(item); }
