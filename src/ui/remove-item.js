import { isGroup } from '../core/destination.js';
import { counted } from '../core/words.js';
import { store } from '../state/page-store.js';
import { readBoolean } from '../state/prefs.js';
import { confirmed } from './dialogs/confirm.js';
import { setStorageWarning } from './page.js';

export const CONFIRM_DELETE_KEY = 'orbit:confirm-before-delete';

/**
 * Delete an item from either the map or the editor. Both use the same
 * confirmation preference and workspace undo record.
 * @param {number[]} path
 */
export function removeMapItem(path) {
  const [sunIndex, planetIndex, moonIndex] = path;
  const { groups, revision } = store.state();
  const sun = groups[sunIndex];
  const planet = sun?.links[planetIndex];
  const kind = path.length === 1 ? 'sun' : path.length === 2 ? 'planet' : 'moon';
  const item = kind === 'sun' ? sun : kind === 'planet' ? planet : planet?.moons[moonIndex];
  if (!item || sun.team) return false;

  if (readBoolean(CONFIRM_DELETE_KEY, true)) {
    let contents = '';
    if (kind === 'sun' && sun.links.length) {
      const moons = sun.links.reduce((total, link) => total + link.moons.length, 0);
      contents = ` and its ${counted(sun.links.length, 'planet')}${moons ? ` and ${counted(moons, 'moon')}` : ''}`;
    } else if (kind === 'planet' && planet.moons.length) {
      contents = ` and its ${counted(planet.moons.length, isGroup(planet) ? 'link' : 'moon')}`;
    }
    if (!confirmed(`Remove ${item.name}${contents}?`)) return false;
  }

  /** @type {typeof groups} */
  const next = JSON.parse(JSON.stringify(groups));
  /** @type {import('../state/store.js').UndoRecord} */
  const undoRecord = { kind, item, label: `${item.name} ${kind}`, sunId: sun.id,
    index: path[path.length - 1] };
  if (kind === 'sun') {
    next.splice(sunIndex, 1);
  } else if (kind === 'planet') {
    next[sunIndex].links.splice(planetIndex, 1);
  } else {
    undoRecord.planetIndex = planetIndex;
    undoRecord.planetName = planet.name;
    if ('url' in planet) undoRecord.planetUrl = planet.url;
    if ('host' in planet) undoRecord.planetHost = planet.host;
    next[sunIndex].links[planetIndex].moons.splice(moonIndex, 1);
  }

  store.saveMap({ groups: next }, `Removed ${kind} ${item.name}`, { undoRecord, expectRevision: revision });
  store.clearWarning();
  setStorageWarning('');
  // The save already rendered the Galaxy if its System no longer exists.
  if (kind === 'sun' && location.hash === `#group/${encodeURIComponent(sun.id)}`) {
    const url = new URL(location.href);
    url.hash = '';
    history.replaceState(history.state, '', url);
  }
  return true;
}
