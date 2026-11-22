// Opening links from the page (2.2.1 favorites.js, routines.js): one
// destination, a planet with its moons, every favorite, or a routine. The
// opening itself is services/opener.js; this asks the confirm question and
// shows the report. Moved in rewrite phase 6a.
import { itemAt, pathsForKey } from '../../core/destination.js';
import { counted } from '../../core/words.js';
import * as opener from '../../services/opener.js';
import { askForVariables } from '../dialogs/placeholder.js';
import { confirmed } from '../dialogs/confirm.js';
import { showOpenAllNotice } from '../notices/area.js';
import { favoriteItems, noteOpened } from './favorites.js';
import { groups, rdpLaunchMode, rdpPresets } from '../page.js';

/**
 * Open one destination the way its circle on the map would.
 * @param {any} item
 */
export function openDestination(item) {
  if (opener.openDestination(item, { presets: rdpPresets, launchMode: rdpLaunchMode }) === 'ask') return askForVariables(item);
  noteOpened(item);
}

/**
 * Open a list of links in new tabs. Remote Desktop links are left out: each
 * one would need its own download or helper prompt. `confirm` asks first when
 * more than one tab would open (`question(count)` words it); `extra` is added
 * to the report.
 * @param {any[]} items
 * @param {string} label
 * @param {{confirm?: boolean, question?: ((count: number) => string) | null, extra?: string}} [options]
 */
export function openLinks(items, label, { confirm = true, question = null, extra = '' } = {}) {
  const result = opener.openLinks(items, label, { confirm, question, extra, ask: confirmed, onOpened: noteOpened });
  return result ? showOpenAllNotice(result.message, result.isError) : null;
}

/**
 * A planet with all its moons.
 * @param {number} sunIndex
 * @param {number} planetIndex
 */
export function openAll(sunIndex, planetIndex) {
  const planet = groups[sunIndex]?.links[planetIndex];
  if (!planet) return null;
  return openLinks([planet, ...planet.moons], planet.name,
    { question: count => `Open ${count} tabs for ${planet.name} and its moons?` });
}

export function openAllFavorites() {
  return openLinks(favoriteItems().map(entry => entry.item), 'your favorites');
}

/**
 * The routine's links that are still on the map, in its order.
 * @param {any} routine
 */
export function routineItems(routine) {
  /** @type {{path: number[], item: any}[]} */
  const items = [];
  let missing = 0;
  for (const link of routine.links) {
    const path = pathsForKey(groups, link.key)[0];
    if (path) items.push({ path, item: itemAt(groups, path) });
    else missing++;
  }
  return { items, missing };
}

/** @param {any} routine */
export function runRoutine(routine) {
  const { items, missing } = routineItems(routine);
  const extra = missing ? ` ${counted(missing, 'link')} in this routine ${missing === 1 ? 'is' : 'are'} no longer on the map.` : '';
  if (!items.length) return showOpenAllNotice(`${routine.name} has no links on the map.${extra}`, true);
  // Choosing a routine by name already says what will open.
  return openLinks(items.map(entry => entry.item), routine.name, { confirm: false, extra });
}
