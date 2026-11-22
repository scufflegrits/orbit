// Where the maps come from (2.2.1 app.js init, team.js): the bundled map from
// window.ORBIT_DATA (file://) or links.json (served), and the read-only team
// map from /team.json (served) before window.ORBIT_TEAM_DATA.
//
// The page's globals are looked up on every call, never cached; node tests
// pass their own `env`.
import { validateMap } from '../core/schema.js';

/**
 * @typedef {object} SourceEnv
 * @property {string} protocol location.protocol
 * @property {(url: string, init?: any) => Promise<{ok: boolean, status: number, json(): Promise<any>}>} fetch
 * @property {any} bundledData window.ORBIT_DATA
 * @property {any} teamData window.ORBIT_TEAM_DATA
 */

/** @returns {SourceEnv} */
export function pageEnv() {
  const page = /** @type {any} */ (globalThis);
  return {
    protocol: page.location.protocol,
    fetch: (url, init) => page.fetch(url, init),
    bundledData: page.ORBIT_DATA,
    teamData: page.ORBIT_TEAM_DATA,
  };
}

/**
 * The bundled map, validated. Throws with 2.2.1's messages: `HTTP <status>`
 * when links.json can't be fetched, the sync.py hint when there is no data,
 * or the validation error.
 * @param {SourceEnv} [env]
 */
export async function loadBundledMap(env = pageEnv()) {
  let data;
  if (env.protocol === 'file:') {
    data = env.bundledData;
  } else {
    const response = await env.fetch('./links.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  }
  if (!data) throw new Error('Run `python3 sync.py` to generate links-data.js.');
  return validateMap(data);
}

/**
 * The raw team map and where it came from, or null when there is none.
 * Served: /team.json wins; a 404 falls back to team-data.js; any other
 * failure falls back too when team-data.js exists, and is thrown otherwise.
 * @param {SourceEnv} env
 * @returns {Promise<{data: any, source: string} | null>}
 */
async function fetchTeamData(env) {
  if (env.protocol !== 'file:') {
    try {
      const response = await env.fetch('./team.json', { cache: 'no-store' });
      if (response.ok) return { data: await response.json(), source: 'team.json from serve.py --team' };
      if (response.status !== 404) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (!env.teamData) throw error;
    }
  }
  return env.teamData ? { data: env.teamData, source: 'team-data.js' } : null;
}

/**
 * The team map, never thrown: a problem is reported as `error` (shown in
 * Settings) and never blocks the personal map. Team sun ids get a `team:`
 * prefix so they can't collide with personal ones, and each sun is marked
 * `team: true`.
 * @param {SourceEnv} [env]
 * @returns {Promise<{groups: any[], source: string, error: string}>}
 */
export async function loadTeamMap(env = pageEnv()) {
  try {
    const loaded = await fetchTeamData(env);
    if (!loaded) return { groups: [], source: '', error: '' };
    const groups = validateMap(loaded.data).groups.map(sun => ({ ...sun, id: `team:${sun.id}`, team: true }));
    return { groups, source: loaded.source, error: '' };
  } catch (error) {
    return { groups: [], source: '', error: `The team map could not be loaded: ${/** @type {Error} */ (error).message}` };
  }
}
