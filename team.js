// Read-only team map. Loaded as a classic script after storage.js. A team map is
// an ordinary Orbit map file: `serve.py --team PATH` serves it as team.json, and
// `sync.py --team PATH` writes team-data.js for file:// use. Team suns are shown
// in front of the personal map, marked `team: true`, and never saved or exported.

const TEAM_FAVORITES_KEY = 'orbit:team-favorites';
let teamGroups = [];
let teamSource = '';
let teamError = '';

// Stored sets and hidden team suns moved to src/state/prefs.js in rewrite phase 3.
function readStoredSet(key) { return window.OrbitNext.state.prefs.readStoredSet(key); }
function writeStoredSet(key, set) { window.OrbitNext.state.prefs.writeStoredSet(key, set); }
function hiddenTeamSuns() { return window.OrbitNext.state.prefs.hiddenTeamSuns(); }

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

// Hiding a team sun goes through the store, which redraws (rewrite phase 3).
function setTeamSunHidden(id, hidden) { window.OrbitNext.store.setTeamSunHidden(id, hidden); }

function isTeamPath(path) {
  return Boolean(groups[path.sun]?.team);
}

// Copy a team item into the personal map, as an independent link. Moved to
// src/core/map-ops.js in rewrite phase 2.
function plainCopy(item) { return window.OrbitNext.core.plainCopy(item); }
