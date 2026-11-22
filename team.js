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

// Loading moved to src/services/sources.js in rewrite phase 4. A problem is
// reported in Settings and never blocks the personal map.
async function loadTeamMap() {
  const loaded = await window.OrbitNext.services.sources.loadTeamMap();
  teamGroups = loaded.groups;
  teamSource = loaded.source;
  teamError = loaded.error;
}

// Hiding a team sun goes through the store, which redraws (rewrite phase 3).
function setTeamSunHidden(id, hidden) { window.OrbitNext.store.setTeamSunHidden(id, hidden); }

function isTeamPath(path) {
  return Boolean(groups[path.sun]?.team);
}

// Copy a team item into the personal map, as an independent link. Moved to
// src/core/map-ops.js in rewrite phase 2.
function plainCopy(item) { return window.OrbitNext.core.plainCopy(item); }
