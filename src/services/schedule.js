// Time-based decisions (2.2.1 routines.js, workspaces.js, sharing.js): which
// routines are due, whether a backup reminder is due, and what changed in the
// team map since it was last seen. Owns the clock, so tests can set it
// (OrbitTest.setNow).
import { destinationKey } from '../core/destination.js';

export const BACKUP_CHANGES = 20;
export const BACKUP_DAYS = 14;
export const DAY_MS = 24 * 60 * 60 * 1000;
/** How long "Remind me later" waits. */
export const SNOOZE_MS = 3 * DAY_MS;

/** @type {number | null} */
let fixedNow = null;

/** Milliseconds since 1970, or the time set by setNow(). */
export const now = () => (fixedNow === null ? Date.now() : fixedNow);

/** The current time as a Date. */
export const today = () => new Date(now());

/**
 * Fix the clock at `ms`, or pass null to use the real time again.
 * @param {number | null} ms
 */
export function setNow(ms) {
  fixedNow = ms === null || ms === undefined ? null : Number(ms);
}

/**
 * The local calendar day, as YYYY-MM-DD.
 * @param {Date} date
 */
export function localDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Scheduled routines due on `date`'s day at or after their time, and not
 * yet opened or dismissed that day.
 * @param {import('../core/types.js').Routine[]} routines
 * @param {Record<string, string>} offered Local day each routine was last offered, by id.
 * @param {Date} [date]
 */
export function dueRoutines(routines, offered, date = today()) {
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return routines.filter(routine => routine.schedule && routine.schedule.days.includes(date.getDay()) &&
    routine.schedule.time <= time && offered[routine.id] !== localDay(date));
}

/**
 * Whether to remind the user to back up: after 20 changes or 14 days since
 * the last export, unless reminders are off, nothing changed, or it was
 * snoozed. Returns the counts for the reminder text, or null.
 * @param {{changes?: number, since?: number, snoozeUntil?: number} | undefined} entry This workspace's entry in orbit:backup:v1.
 * @param {boolean} enabled The orbit:backup-reminders preference.
 * @param {number} [time]
 * @returns {{changes: number, days: number} | null}
 */
export function backupDue(entry, enabled, time = now()) {
  if (!enabled) return null;
  if (!entry?.changes || (entry.snoozeUntil && time < entry.snoozeUntil)) return null;
  const days = Math.floor((time - (entry.since || time)) / DAY_MS);
  return entry.changes >= BACKUP_CHANGES || days >= BACKUP_DAYS ? { changes: entry.changes, days } : null;
}

/** @typedef {{key: string, name: string, path: string}} TeamEntry */

/**
 * Every team planet and moon, by destination key, with where it is.
 * @param {import('../core/types.js').Sun[]} teamGroups
 * @returns {TeamEntry[]}
 */
export function teamEntries(teamGroups) {
  return teamGroups.flatMap(sun => sun.links.flatMap(planet => [
    { key: destinationKey(planet), name: planet.name, path: sun.name },
    ...planet.moons.map(moon => ({ key: destinationKey(moon), name: moon.name, path: `${sun.name} → ${planet.name}` })),
  ]));
}

/**
 * What the team map gained and lost since it was last seen. `seen` null
 * means it was never seen: the caller records it quietly.
 * @param {{key: string, name: string}[] | null} seen
 * @param {TeamEntry[]} current
 * @returns {{first: true} | {first: false, added: TeamEntry[], removed: {key: string, name: string}[]}}
 */
export function teamChanges(seen, current) {
  if (!Array.isArray(seen)) return { first: true };
  const seenKeys = new Set(seen.map(entry => entry.key));
  const currentKeys = new Set(current.map(entry => entry.key));
  return {
    first: false,
    added: current.filter(entry => !seenKeys.has(entry.key)),
    removed: seen.filter(entry => !currentKeys.has(entry.key)),
  };
}
