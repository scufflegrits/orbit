// Favorites and recent links (2.2.1 favorites.js). A personal favorite is
// stored on the item, so it moves and exports with it; a team favorite is a
// preference, because team items can't be edited. Moved in rewrite phase 6a.
import { destinationKey, itemAt, pathsForKey } from '../../core/destination.js';
import { KEYS } from '../../state/storage.js';
import { readRecent, readStoredSet, recordRecent, writeStoredSet } from '../../state/prefs.js';
import { hooks } from '../hooks.js';
import { modes } from '../page-modes.js';

/**
 * Whether a destination is a favorite (`sun` says whether it is a team item).
 * @param {any} item
 * @param {any} [sun]
 */
export function isFavorite(item, sun) {
  if (!item) return false;
  if (sun?.team) return readStoredSet(KEYS.teamFavorites).has(destinationKey(item));
  return item.favorite === true;
}

/** Every favorite on the map, in map order. */
export function favoriteItems() {
  /** @type {{path: number[], item: any}[]} */
  const list = [];
  groups.forEach((sun, sunIndex) => sun.links.forEach((/** @type {any} */ planet, /** @type {number} */ planetIndex) => {
    if (isFavorite(planet, sun)) list.push({ path: [sunIndex, planetIndex], item: planet });
    planet.moons.forEach((/** @type {any} */ moon, /** @type {number} */ moonIndex) => {
      if (isFavorite(moon, sun)) list.push({ path: [sunIndex, planetIndex, moonIndex], item: moon });
    });
  }));
  return list;
}

/**
 * Star or unstar a destination.
 * @param {number[]} path
 * @param {boolean} on
 */
export function setFavorite(path, on) {
  const sun = groups[path[0]];
  const item = itemAt(groups, path);
  if (!item) return;
  if (sun.team) {
    const set = readStoredSet(KEYS.teamFavorites);
    if (on) set.add(destinationKey(item));
    else set.delete(destinationKey(item));
    writeStoredSet(KEYS.teamFavorites, set);
    hooks.render();
    return;
  }
  const next = copyGroups();
  const target = path.length === 3 ? next[path[0]].links[path[1]].moons[path[2]] : next[path[0]].links[path[1]];
  if (on) target.favorite = true;
  else delete target.favorite;
  saveMap({ groups: next }, `${on ? 'Added' : 'Removed'} favorite ${item.name}`);
}

/** Recent links that still exist in the map, newest first. */
export function recentItems() {
  return readRecent().flatMap(entry => {
    const path = pathsForKey(groups, entry.key)[0];
    return path ? [{ path, item: itemAt(groups, path) }] : [];
  });
}

/**
 * Record a link as opened (never in Edit mode), then show it in the quick bar.
 * @param {any} item
 */
export function noteOpened(item) {
  if (!item || modes.inEditMode()) return;
  recordRecent(destinationKey(item), item.name, Date.now());
  // After the click has opened the link, show it in the Galaxy's quick bar.
  setTimeout(() => hooks.refreshQuickBar(), 0);
}
