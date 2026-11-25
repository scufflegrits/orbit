// Preferences and other small saved values that aren't the map (2.2.1
// storage.js, team.js). Formats are 2.2.1's: booleans are the strings 'true'
// and 'false', unknown values fall back to the default, and a write that
// fails is ignored.
import { KEYS, readJson, readSafely, remove, writeSafely } from './storage.js';
import { MAIN, workspaceKey } from './workspaces.js';

/**
 * @param {string} key
 * @param {boolean} fallback
 */
export function readBoolean(key, fallback) {
  const value = readSafely(key);
  return value === null ? fallback : value === 'true';
}

/**
 * @param {string} key
 * @param {unknown} value Stored as String(value).
 */
export function savePreference(key, value) {
  writeSafely(key, String(value));
}

/**
 * @template {string} T
 * @param {string} key
 * @param {readonly T[]} allowed
 * @param {T} fallback
 * @returns {T}
 */
function readChoice(key, allowed, fallback) {
  const value = /** @type {T} */ (readSafely(key));
  return allowed.includes(value) ? value : fallback;
}

export const readButtonTips = () => readChoice('orbit:button-tips', ['normal', 'slow', 'off'], 'normal');
export const readTheme = () => readChoice('orbit:theme', ['default', 'alabama', 'auburn'], 'default');
/** The font: Inter (the default) or Orbit classic (DM Sans and Space Grotesk). */
export const readFontFamily = () => readChoice('orbit:font-family', ['inter', 'classic'], 'inter');
export const readFontSize = () => readChoice('orbit:font-size', ['small', 'standard', 'large', 'extra'], 'standard');
export const readGalaxyView = () => readSafely('orbit:galaxy-view') === 'list' ? 'list' : 'orbits';
export const readRdpLaunch = () => readSafely('orbit:rdp-launch') === 'client' ? 'client' : 'download';

/**
 * A stored list of strings, as a set; empty when missing or not a list.
 * @param {string} key
 * @returns {Set<string>}
 */
export function readStoredSet(key) {
  const list = readJson(key, []);
  return new Set(Array.isArray(list) ? list.map(String) : []);
}

/**
 * @param {string} key
 * @param {Set<string>} set
 */
export function writeStoredSet(key, set) {
  writeSafely(key, JSON.stringify([...set]));
}

/** Ids of hidden team suns, with their `team:` prefix. */
export const hiddenTeamSuns = () => readStoredSet(KEYS.teamHidden);

/**
 * A stored JSON object, or {} when missing, unreadable, or not an object
 * (2.2.1 variables.js loadVariables, routines.js readOffered). As in 2.2.1, an
 * array counts as an object.
 * @param {string} key
 * @returns {Record<string, any>}
 */
function readObject(key) {
  const value = readJson(key, {});
  return value && typeof value === 'object' ? value : {};
}

/** The values entered last for each {placeholder}, by name. */
export const readVariables = () => readObject(KEYS.variables);

/**
 * Remember placeholder values, keeping the others.
 * @param {Record<string, string>} values
 */
export function saveVariables(values) {
  writeSafely(KEYS.variables, JSON.stringify({ ...readVariables(), ...values }));
}

/**
 * Every stored offer mark, as saved: the local day (YYYY-MM-DD) each routine
 * was last offered. Main's routines use the plain routine id, as 2.x did;
 * other workspaces add `:<workspace id>`, like their storage keys (3.0.1;
 * before, two workspaces' routines with the same id shared one mark).
 */
export const readOffered = () => readObject(KEYS.routineOffered);

/**
 * One workspace's offer marks, by routine id.
 * @param {string} workspace
 * @returns {Record<string, string>}
 */
export function offeredIn(workspace) {
  const all = readOffered();
  if (workspace === MAIN) return all;
  const suffix = `:${workspace}`;
  return Object.fromEntries(Object.entries(all).filter(([key]) => key.endsWith(suffix))
    .map(([key, day]) => [key.slice(0, -suffix.length), day]));
}

/**
 * @param {string} id Routine id.
 * @param {string} day YYYY-MM-DD
 * @param {string} [workspace] The routine's workspace (Main by default).
 */
export function markOffered(id, day, workspace = MAIN) {
  const offered = readOffered();
  offered[workspaceKey(id, workspace)] = day;
  writeSafely(KEYS.routineOffered, JSON.stringify(offered));
}

/**
 * Drop a removed workspace's offer marks, so a new workspace with the same id
 * starts fresh. Never called for Main.
 * @param {string} workspace
 */
export function forgetOffered(workspace) {
  const suffix = `:${workspace}`;
  const offered = readOffered();
  const kept = Object.fromEntries(Object.entries(offered).filter(([key]) => !key.endsWith(suffix)));
  if (Object.keys(kept).length !== Object.keys(offered).length) writeSafely(KEYS.routineOffered, JSON.stringify(kept));
}

/**
 * The team links seen last, or null before the first team map loads (or when
 * the stored value is unreadable). Not filtered: 2.2.1 used the list as stored.
 * @returns {any[] | null}
 */
export function readTeamSeen() {
  const value = readJson(KEYS.teamSeen, null);
  return Array.isArray(value) ? value : null;
}

/** @param {{key: string, name: string}[]} entries */
export function rememberTeam(entries) {
  writeSafely(KEYS.teamSeen, JSON.stringify(entries.map(({ key, name }) => ({ key, name }))));
}

/** How many recent links are kept. */
export const RECENT_LIMIT = 10;

/**
 * Recently opened links, newest first; entries without a string key are
 * skipped (2.2.1 favorites.js loadRecent).
 * @returns {{key: string, name: string, time: number}[]}
 */
export function readRecent() {
  const list = readJson(KEYS.recent, []);
  return Array.isArray(list) ? list.filter(entry => entry && typeof entry.key === 'string') : [];
}

/**
 * Put a link first in the recent list (once), keeping 10.
 * @param {string} key
 * @param {string} name
 * @param {number} time
 */
export function recordRecent(key, name, time) {
  const list = [{ key, name, time }, ...readRecent().filter(entry => entry.key !== key)];
  writeSafely(KEYS.recent, JSON.stringify(list.slice(0, RECENT_LIMIT)));
}

export function clearRecent() {
  try { remove(KEYS.recent); } catch { /* Storage may be unavailable. */ }
}
