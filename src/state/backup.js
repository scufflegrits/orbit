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

/**
 * Count one change in a workspace since its last export.
 * @param {string} workspace
 * @param {number} [now]
 */
export function countChange(workspace, now = Date.now()) {
  const state = readBackupState();
  const entry = state[workspace] || {};
  entry.changes = (entry.changes || 0) + 1;
  entry.since = entry.since || entry.lastExport || now;
  state[workspace] = entry;
  writeBackupState(state);
}

/**
 * Start counting again after an export.
 * @param {string} workspace
 * @param {number} [now]
 */
export function noteBackupMade(workspace, now = Date.now()) {
  const state = readBackupState();
  state[workspace] = { changes: 0, lastExport: now };
  writeBackupState(state);
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
