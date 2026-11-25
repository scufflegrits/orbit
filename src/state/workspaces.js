// The workspace list and each workspace's storage keys (2.2.1 workspaces.js).
// Writing a workspace's map is the store's job; this module only keeps the list.
import { KEYS, readJson, readSafely, write, writeSafely } from './storage.js';
import { uniqueSunId } from '../core/schema.js';

/** @typedef {{id: string, name: string}} Workspace */

export const MAIN = 'main';
export const UNREADABLE = 'unreadable';
export const REMOVED_DEFAULTS_KEY = 'orbit:workspaces:removed:v1';
/** @type {Workspace[]} */
let defaults = [];

/** Set bundled workspace metadata before the first workspace read. @param {Workspace[]} list */
export function setDefaultWorkspaces(list) {
  defaults = Array.isArray(list) ? list.filter(item => item && typeof item.id === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) && item.id.length <= 40 && item.id !== MAIN && item.id !== UNREADABLE &&
    typeof item.name === 'string' && item.name.trim().length > 0 && item.name.trim().length <= 40) : [];
}

/** The ids the user removed from the bundled defaults. */
export function removedDefaultIds() {
  const list = readJson(REMOVED_DEFAULTS_KEY, []);
  return new Set(Array.isArray(list) ? list.filter(id => typeof id === 'string') : []);
}

/** @param {string} id */
export function markDefaultRemoved(id) {
  const removed = removedDefaultIds(); removed.add(id);
  write(REMOVED_DEFAULTS_KEY, JSON.stringify([...removed]));
}

/** @param {string} id */
export function restoreDefault(id) {
  const removed = removedDefaultIds(); removed.delete(id);
  write(REMOVED_DEFAULTS_KEY, JSON.stringify([...removed]));
}

/** Raw user choices only. Defaults are merged at read time and never persisted by listing them. */
export function loadStoredWorkspaces() {
  const list = readJson(KEYS.workspaces, []);
  return Array.isArray(list) ? list.filter(item => item && typeof item.id === 'string' && item.name) : [];
}

/** Bundled workspace metadata, including its validated map when available. */
export function defaultWorkspaces() { return defaults; }
/** @param {string} id */
export function defaultWorkspace(id) { return defaults.find(item => item.id === id) || null; }
/** The keys that belong to one workspace. */
export const WORKSPACE_KEYS = Object.freeze([KEYS.map, KEYS.undo, KEYS.history]);

/**
 * The workspace list, always with Main (first, if it wasn't stored).
 * @returns {Workspace[]}
 */
export function loadWorkspaces() {
  const stored = loadStoredWorkspaces();
  const list = stored.some(item => item.id === MAIN) ? stored : [{ id: MAIN, name: 'Main' }, ...stored];
  const removed = removedDefaultIds();
  for (const item of defaults) {
    if (removed.has(item.id) || list.some(saved => saved.id === item.id)) continue;
    list.push({ id: item.id, name: item.name });
  }
  return list;
}

/**
 * Save the list. Throws when storage is full, as in 2.2.1.
 * @param {Workspace[]} list
 */
export function saveWorkspaces(list) {
  write(KEYS.workspaces, JSON.stringify(list));
}

/** The stored active workspace, if it still exists; otherwise Main. */
export function readActiveWorkspace() {
  const id = readSafely(KEYS.activeWorkspace);
  return id && loadWorkspaces().some(item => item.id === id) ? id : MAIN;
}

/** @param {string} id */
export function saveActiveWorkspace(id) {
  writeSafely(KEYS.activeWorkspace, String(id));
}

/**
 * A workspace's key. Main keeps the original keys, so maps saved before
 * workspaces existed stay where they are.
 * @param {string} base
 * @param {string} id
 */
export function workspaceKey(base, id) {
  return id === MAIN ? base : `${base}:${id}`;
}

/** @param {string} id */
export function workspaceName(id) {
  return loadWorkspaces().find(item => item.id === id)?.name || 'Main';
}

/**
 * Check a new workspace name and choose its id. Doesn't save anything.
 * @param {unknown} name
 * @returns {{id: string, name: string}}
 */
export function newWorkspace(name) {
  const list = loadWorkspaces();
  const clean = String(name || '').trim();
  if (!clean || clean.length > 40) throw new Error('A workspace needs a name of up to 40 characters.');
  if (list.some(item => item.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
    throw new Error(`There is already a workspace named ${clean}.`);
  }
  return { id: uniqueSunId(clean, new Set([UNREADABLE, ...defaults.map(item => item.id), ...list.map(item => item.id)])), name: clean };
}

/**
 * @param {string} id
 * @param {unknown} name
 */
export function renameWorkspace(id, name) {
  const clean = String(name || '').trim();
  const list = loadWorkspaces();
  if (!clean || clean.length > 40) throw new Error('A workspace needs a name of up to 40 characters.');
  if (list.some(item => item.id !== id && item.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
    throw new Error(`There is already a workspace named ${clean}.`);
  }
  const stored = loadStoredWorkspaces();
  if (defaultWorkspace(id) || id === MAIN) {
    const entry = { id, name: clean };
    saveWorkspaces([...stored.filter(item => item.id !== id), entry]);
  } else saveWorkspaces(stored.map(item => item.id === id ? { ...item, name: clean } : item));
}
