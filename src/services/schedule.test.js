// services/schedule.js (REWRITE_PLAN.md, phase 4): due routines, backup
// due, team changes, and the clock, with differential tests against 2.2.1's
// dueRoutines and backupDue.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { oracle } from '../../tests/oracle/oracle.mjs';
import { runs } from '../../tests/unit/arbitraries.mjs';
import { BACKUP_CHANGES, DAY_MS, backupDue, dueRoutines, localDay, now, setNow, teamChanges, teamEntries, today } from './schedule.js';

afterEach(() => setNow(null));

const MONDAY_9 = new Date(2026, 10, 23, 9, 0).getTime();

test('clock: real time by default; setNow fixes it; null goes back to real time', () => {
  const before = Date.now();
  assert.ok(now() >= before && now() <= Date.now());
  setNow(MONDAY_9);
  assert.equal(now(), MONDAY_9);
  assert.equal(today().getDay(), 1);
  setNow(null);
  assert.ok(Math.abs(now() - Date.now()) < 1000);
});

test('localDay is the local calendar day, zero-padded', () => {
  assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('dueRoutines: due on its day at or after its time, once per day', () => {
  const morning = { id: 'r1', name: 'Morning', links: [], schedule: { time: '08:30', days: [1, 2, 3, 4, 5] } };
  const later = { id: 'r2', name: 'Later', links: [], schedule: { time: '09:01', days: [1] } };
  const none = { id: 'r3', name: 'Any', links: [] };
  const date = new Date(MONDAY_9);
  assert.deepEqual(dueRoutines([morning, later, none], {}, date).map(r => r.id), ['r1']);
  assert.deepEqual(dueRoutines([morning], { r1: '2026-11-23' }, date), [], 'already offered today');
  assert.deepEqual(dueRoutines([morning], { r1: '2026-11-22' }, date).map(r => r.id), ['r1'], 'offered yesterday');
  assert.deepEqual(dueRoutines([morning], {}, new Date(2026, 10, 22, 9, 0)), [], 'not on Sunday');
  const nine = { id: 'r4', name: 'Nine', links: [], schedule: { time: '09:00', days: [1] } };
  assert.deepEqual(dueRoutines([nine], {}, date).map(r => r.id), ['r4'], 'due at exactly its minute');
  assert.deepEqual(dueRoutines([nine], {}, new Date(MONDAY_9 - 60000)), [], 'not a minute before');
  setNow(MONDAY_9);
  assert.deepEqual(dueRoutines([morning], {}).map(r => r.id), ['r1'], 'the default date is the clock');
});

test('backupDue: after 20 changes or 14 days, unless off, unchanged, or snoozed', () => {
  const start = MONDAY_9;
  assert.equal(backupDue({ changes: 3, since: start }, true, start + DAY_MS), null);
  assert.deepEqual(backupDue({ changes: BACKUP_CHANGES, since: start }, true, start), { changes: 20, days: 0 });
  assert.deepEqual(backupDue({ changes: 1, since: start }, true, start + 14 * DAY_MS), { changes: 1, days: 14 });
  assert.equal(backupDue({ changes: 25, since: start }, false, start), null, 'reminders off');
  assert.equal(backupDue({ changes: 0, since: start }, true, start + 30 * DAY_MS), null, 'nothing changed');
  assert.equal(backupDue(undefined, true, start), null);
  assert.equal(backupDue({ changes: 25, since: start, snoozeUntil: start + 1 }, true, start), null, 'snoozed');
  setNow(start + 15 * DAY_MS);
  assert.deepEqual(backupDue({ changes: 2, since: start }, true), { changes: 2, days: 15 }, 'the default time is the clock');
});

test('teamEntries and teamChanges: first load is quiet; later loads report added and removed links', () => {
  const team = [{ id: 'team:ops', name: 'Ops', color: null, links: [
    { name: 'Status', url: 'https://status.test/', moons: [{ name: 'Old', url: 'https://old.test/' }] }] }];
  const entries = teamEntries(/** @type {any} */ (team));
  assert.deepEqual(entries.map(e => [e.name, e.path]), [['Status', 'Ops'], ['Old', 'Ops → Status']]);
  assert.deepEqual(teamChanges(null, entries), { first: true });
  const seen = [{ key: entries[0].key, name: 'Status' }, { key: 'https://gone.test', name: 'Gone' }];
  const changes = teamChanges(seen, entries);
  assert.deepEqual(changes, { first: false, added: [entries[1]], removed: [seen[1]] });
});

// ---- Differential: 2.2.1 dueRoutines and backupDue ----------------------------

const time = fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
const routine = fc.record({
  id: fc.constantFrom('r1', 'r2', 'r3', 'r4'),
  name: fc.constant('R'),
  links: fc.constant([]),
  schedule: fc.option(fc.record({ time, days: fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { maxLength: 7 }) }), { nil: undefined }),
}).map(r => (r.schedule ? r : { id: r.id, name: r.name, links: r.links }));
// Any moment within a fortnight, so days of the week and times both vary.
const moment = fc.integer({ min: MONDAY_9 - 7 * DAY_MS, max: MONDAY_9 + 7 * DAY_MS });

test('dueRoutines matches 2.2.1 for random routines, days, and offers', () => {
  fc.assert(fc.property(fc.array(routine, { maxLength: 5 }), moment, fc.dictionary(fc.constantFrom('r1', 'r2', 'r3'),
    fc.constantFrom('2026-11-16', '2026-11-22', '2026-11-23', '2026-11-29', 'x')), (list, at, offered) => {
    const old = oracle();
    old.set('routines', list);
    old.setStorage({ 'orbit:routine-offered:v1': JSON.stringify(offered) });
    const expected = old.run(`dueRoutines(new Date(${at}))`);
    assert.deepEqual(JSON.parse(JSON.stringify(dueRoutines(list, offered, new Date(at)))), expected);
  }), runs(400));
});

test('backupDue matches 2.2.1 for random entries, settings, and times', () => {
  const entry = fc.option(fc.record({
    changes: fc.oneof(fc.integer({ min: 0, max: 40 }), fc.constant(undefined)),
    since: fc.oneof(moment, fc.constant(undefined), fc.constant(0)),
    snoozeUntil: fc.oneof(moment, fc.constant(undefined)),
  }, { requiredKeys: [] }), { nil: undefined });
  fc.assert(fc.property(entry, fc.constantFrom(null, 'true', 'false'), moment.map(t => t + 14 * DAY_MS), (value, setting, at) => {
    const old = oracle();
    old.setStorage({ 'orbit:backup:v1': JSON.stringify(value === undefined ? {} : { main: value }),
      ...(setting === null ? {} : { 'orbit:backup-reminders': setting }) });
    old.run("var activeWorkspace = 'main';");
    const expected = old.run(`backupDue(${at})`);
    const stored = value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    assert.deepEqual(backupDue(stored, setting !== 'false', at), expected ?? null);
  }), runs(400));
});

test('team destination changes include group moons but ignore groups', () => {
  const map = [{ id: 'team:ops', name: 'Ops', description: '', color: '#123456', links: [
    { name: 'Monitoring', type: /** @type {const} */ ('group'), moons: [{ name: 'Status', url: 'https://status.test/' }] },
  ] }];
  assert.deepEqual(teamEntries(map), [{ key: 'https://status.test', name: 'Status', path: 'Ops → Monitoring', sunId: 'team:ops', indices: [0, 0] }]);
});
