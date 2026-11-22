// Preferences and other small saved values that aren't the map (2.2.1
// storage.js, team.js). Formats are 2.2.1's: booleans are the strings 'true'
// and 'false', unknown values fall back to the default, and a write that
// fails is ignored.
import { KEYS, readJson, readSafely, writeSafely } from './storage.js';

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

export const readTheme = () => readChoice('orbit:theme', ['default', 'alabama', 'auburn'], 'default');
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

/** The local day (YYYY-MM-DD) each routine was last offered, by routine id. */
export const readOffered = () => readObject(KEYS.routineOffered);

/**
 * @param {string} id
 * @param {string} day YYYY-MM-DD
 */
export function markOffered(id, day) {
  const offered = readOffered();
  offered[id] = day;
  writeSafely(KEYS.routineOffered, JSON.stringify(offered));
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
