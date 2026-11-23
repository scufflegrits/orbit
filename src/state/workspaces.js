// The workspace list and each workspace's storage keys (2.2.1 workspaces.js).
// Writing a workspace's map is the store's job; this module only keeps the list.
import { KEYS, readJson, readSafely, write, writeSafely } from './storage.js';
import { uniqueSunId } from '../core/schema.js';

/** @typedef {{id: string, name: string}} Workspace */

export const MAIN = 'main';
export const UNREADABLE = 'unreadable';
/** The keys that belong to one workspace. */
export const WORKSPACE_KEYS = Object.freeze([KEYS.map, KEYS.undo, KEYS.history]);

/**
 * The workspace list, always with Main (first, if it wasn't stored).
 * @returns {Workspace[]}
 */
export function loadWorkspaces() {
  const list = readJson(KEYS.workspaces, []);
  const valid = Array.isArray(list) ? list.filter(item => item && typeof item.id === 'string' && item.name) : [];
  return valid.some(item => item.id === MAIN) ? valid : [{ id: MAIN, name: 'Main' }, ...valid];
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
  return { id: uniqueSunId(clean, new Set([UNREADABLE, ...list.map(item => item.id)])), name: clean };
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
  saveWorkspaces(list.map(item => item.id === id ? { ...item, name: clean } : item));
}
