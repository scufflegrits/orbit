// Backup reminder bookkeeping: one key, one entry per workspace (2.2.1
// workspaces.js). Whether a reminder is due is decided in services (phase 4).
import { KEYS, readJson, writeSafely } from './storage.js';

/** @typedef {{changes?: number, since?: number, lastExport?: number, snoozeUntil?: number}} BackupEntry */

/** @returns {Record<string, BackupEntry>} */
export function readBackupState() {
  const value = readJson(KEYS.backup, {});
  return value && typeof value === 'object' ? value : {};
}

/** @param {Record<string, BackupEntry>} state */
export function writeBackupState(state) {
  writeSafely(KEYS.backup, JSON.stringify(state));
}

/** @param {Record<string, BackupEntry>} state @param {string} workspace */
function ownEntry(state, workspace) {
  return Object.hasOwn(state, workspace) ? state[workspace] : undefined;
}

/** @param {string} workspace */
export function readBackupEntry(workspace) {
  return ownEntry(readBackupState(), workspace);
}

/**
 * Count one change in a workspace since its last export.
 * @param {string} workspace
 * @param {number} [now]
 */
export function countChange(workspace, now = Date.now()) {
  const state = readBackupState();
  const entry = ownEntry(state, workspace) || {};
  writeBackupState({ ...state, [workspace]: {
    ...entry, changes: (entry.changes || 0) + 1, since: entry.since || entry.lastExport || now,
  } });
}

/**
 * Start counting again after an export.
 * @param {string} workspace
 * @param {number} [now]
 */
export function noteBackupMade(workspace, now = Date.now()) {
  const state = readBackupState();
  writeBackupState({ ...state, [workspace]: { changes: 0, lastExport: now } });
}

/** @param {string} workspace @param {number} snoozeUntil */
export function snoozeBackup(workspace, snoozeUntil) {
  const state = readBackupState();
  writeBackupState({ ...state, [workspace]: { ...ownEntry(state, workspace), snoozeUntil } });
}

/**
 * Remove a workspace's entry (when the workspace is removed).
 * @param {string} workspace
 */
export function forgetWorkspace(workspace) {
  const state = readBackupState();
  delete state[workspace];
  writeBackupState(state);
}
