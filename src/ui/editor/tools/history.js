// Version history (2.2.1 tools.js): the map as it was before each of the last 20 changes, and restoring one.
// Moved in rewrite phase 6b.
import * as mapOps from '../../../core/map-ops.js';
import * as history from '../../../state/history.js';
import { activeWorkspace, store } from '../../../state/page-store.js';
import { KEYS } from '../../../state/storage.js';
import { workspaceKey } from '../../../state/workspaces.js';
import { confirmed } from '../../dialogs/confirm.js';
import { counted, element } from '../../dom.js';
import { applyEditorChange, editorButton, editorHeader } from '../kit.js';
import { nav } from '../nav.js';

/**
 * @param {any} list
 */
function mapCounts(list) {
  const planets = list.reduce((/** @type {any} */ sum, /** @type {any} */ sun) => sum + sun.links.length, 0);
  const moons = list.reduce((/** @type {any} */ sum, /** @type {any} */ sun) => sum + sun.links.reduce((/** @type {any} */ total, /** @type {any} */ planet) => total + planet.moons.length, 0), 0);
  return { suns: list.length, planets, moons };
}

/**
 * @param {any} from
 * @param {any} to
 */
function countDifference(from, to) {
  const parts = [];
  for (const kind of ['suns', 'planets', 'moons']) {
    const change = to[kind] - from[kind];
    if (change) parts.push(`${change > 0 ? '+' : '−'}${counted(Math.abs(change), kind.slice(0, -1))}`);
  }
  return parts.length ? parts.join(', ') : 'same counts';
}

export function showHistory() {
  editorHeader('History', nav.showSunList);
  const entries = history.loadHistory(workspaceKey(KEYS.history, activeWorkspace()));
  menuContent.append(element('p', '', 'Orbit keeps the map as it was before each of your last 20 changes in this browser. Restoring a version is itself a change, so it can be undone here too.'));
  if (!entries.length) {
    menuContent.append(element('p', 'editor-note', 'No earlier versions yet. They appear after your next change.'));
    return;
  }
  const current = mapCounts(mapOps.personalGroups(groups));
  const list = element('div', 'editor-list history-list');
  entries.forEach(entry => {
    const counts = mapCounts(entry.groups);
    const row = element('div', 'editor-list-row history-row');
    const copy = element('span', 'history-copy');
    copy.append(element('strong', '', `Before: ${entry.label}`));
    copy.append(element('small', '', `${new Date(entry.time).toLocaleString()} · ${counted(counts.suns, 'sun')}, ${counted(counts.planets, 'planet')}, ${counted(counts.moons, 'moon')} · compared with now: ${countDifference(current, counts)}`));
    row.append(copy, editorButton('Restore', () => {
      if (!confirmed(`Restore the map from ${new Date(entry.time).toLocaleString()}?`)) return;
      applyEditorChange([...groups.filter(sun => sun.team), ...entry.groups], showHistory,
        { label: `Restored the version from ${new Date(entry.time).toLocaleString()}`, routines: entry.routines || [],
          rdpPresets: entry.rdpPresets || [] });
    }));
    list.append(row);
  });
  menuContent.append(list);
}
