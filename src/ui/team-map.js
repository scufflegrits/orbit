// The read-only team map as loaded at start-up (2.2.1 team.js): its suns
// (marked `team: true`, ids prefixed `team:`), where it came from, and any
// problem loading it, shown in Settings. Loading is services/sources.js; the
// store shows team suns in front of the personal map. Moved in rewrite
// phase 6b.
import { loadTeamMap as load } from '../services/sources.js';

export const team = {
  /** @type {any[]} */ groups: [],
  source: '',
  error: '',
};

/** Load the team map; a problem is reported, never thrown. */
export async function loadTeamMap() {
  const loaded = await load();
  team.groups = loaded.groups;
  team.source = loaded.source;
  team.error = loaded.error;
}
