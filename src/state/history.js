// Version history: the map as it was before each of the last 20 changes, per
// workspace (2.2.1 storage.js loadHistory and recordHistory).
import { readJson, write } from './storage.js';

export const HISTORY_LIMIT = 20;

/**
 * @typedef {{time: number, label: string, groups: any[], routines?: any[], rdpPresets?: any[]}} HistoryEntry
 */

/**
 * The saved versions, newest first. Entries without a groups list are skipped.
 * @param {string} key The workspace's history key.
 * @returns {HistoryEntry[]}
 */
export function loadHistory(key) {
  const list = readJson(key, []);
  return Array.isArray(list) ? list.filter(entry => entry && Array.isArray(entry.groups)) : [];
}

/**
 * Keep a map as it was before a change. When storage is full, the oldest
 * versions are dropped until it fits; a failure here never blocks the change.
 * @param {string} key
 * @param {any[]} previousGroups
 * @param {unknown} label
 * @param {any[]} [previousRoutines]
 * @param {any[]} [previousPresets]
 * @param {number} [time]
 */
export function recordHistory(key, previousGroups, label, previousRoutines = [], previousPresets = [], time = Date.now()) {
  /** @type {HistoryEntry} */
  const entry = { time, label: String(label || 'Change'), groups: previousGroups };
  if (previousRoutines.length) entry.routines = previousRoutines;
  if (previousPresets.length) entry.rdpPresets = previousPresets;
  const list = [entry, ...loadHistory(key)].slice(0, HISTORY_LIMIT);
  while (list.length) {
    try {
      write(key, JSON.stringify(list));
      return;
    } catch {
      list.pop();
    }
  }
}
