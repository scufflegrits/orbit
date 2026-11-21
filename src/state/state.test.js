// state/storage, workspaces, prefs, history, and backup, against an in-memory
// storage stand-in. Where 2.2.1 has the same function, the result is compared
// with the oracle's (tests/behavior-2.2.md, "Saving and history",
// "Workspaces", "Preferences").
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { oracle } from '../../tests/oracle/oracle.mjs';
import { KEYS, MIGRATIONS, memoryStorage, migrate, onExternalChange, readJson, useBackend, write, writeSafely } from './storage.js';
import { loadWorkspaces, newWorkspace, readActiveWorkspace, renameWorkspace, workspaceKey, workspaceName } from './workspaces.js';
import { hiddenTeamSuns, readBoolean, readFontSize, readGalaxyView, readRdpLaunch, readStoredSet, readTheme, savePreference, writeStoredSet } from './prefs.js';
import { HISTORY_LIMIT, loadHistory, recordHistory } from './history.js';
import { countChange, forgetWorkspace, noteBackupMade, readBackupState } from './backup.js';

/** @type {ReturnType<typeof memoryStorage>} */
let storage;
beforeEach(() => {
  storage = memoryStorage();
  useBackend(storage);
});

test('storage: same key names as 2.2.1', () => {
  assert.deepEqual({ ...KEYS }, {
    map: 'orbit:map:v1', undo: 'orbit:undo-removal:v1', history: 'orbit:history:v1', backup: 'orbit:backup:v1',
    workspaces: 'orbit:workspaces:v1', activeWorkspace: 'orbit:workspace', recent: 'orbit:recent:v1',
    variables: 'orbit:variables:v1', routineOffered: 'orbit:routine-offered:v1', teamFavorites: 'orbit:team-favorites',
    teamHidden: 'orbit:team-hidden', teamSeen: 'orbit:team-seen:v1',
  });
});

test('storage: a full storage throws for map writes and is ignored for preferences', () => {
  storage.failWrites = true;
  assert.throws(() => write('orbit:map:v1', '{}'), /quota/);
  assert.equal(writeSafely('orbit:theme', 'auburn'), false);
  savePreference('orbit:theme', 'auburn');
  assert.equal(storage.data.size, 0);
});

test('storage: unavailable storage reads as nothing', () => {
  useBackend({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } });
  assert.equal(readJson('orbit:recent:v1', 'fallback'), 'fallback');
  assert.equal(readBoolean('orbit:animations', true), true);
  assert.equal(readTheme(), 'default');
  assert.equal(readActiveWorkspace(), 'main');
  assert.deepEqual(loadWorkspaces(), [{ id: 'main', name: 'Main' }]);
  assert.deepEqual(loadHistory('orbit:history:v1'), []);
});

test('storage: the backend is looked up on every call, so a swapped storage takes effect at once', () => {
  const other = memoryStorage();
  useBackend(other);
  write('orbit:x', '1');
  assert.equal(other.getItem('orbit:x'), '1');
  assert.equal(storage.getItem('orbit:x'), null);
});

test('migrations: version 0 is 2.2.x, so start-up reads and writes nothing', () => {
  assert.equal(MIGRATIONS.length, 0);
  assert.deepEqual(migrate(), []);
  assert.equal(storage.data.size, 0);
});

test('external change: only Orbit keys from another tab are reported', () => {
  const target = new EventTarget();
  /** @type {(string|null)[]} */
  const seen = [];
  const stop = onExternalChange(key => seen.push(key), target);
  for (const key of ['orbit:map:v1', 'other', null]) target.dispatchEvent(Object.assign(new Event('storage'), { key }));
  stop();
  target.dispatchEvent(Object.assign(new Event('storage'), { key: 'orbit:map:v1' }));
  assert.deepEqual(seen, ['orbit:map:v1', null]);
});

test('workspaces: Main keeps the plain keys; others add :<id>', () => {
  assert.equal(workspaceKey('orbit:map:v1', 'main'), 'orbit:map:v1');
  assert.equal(workspaceKey('orbit:history:v1', 'home'), 'orbit:history:v1:home');
});

test('workspaces: the list always has Main; bad entries are dropped; the active one must exist', () => {
  storage.setItem('orbit:workspaces:v1', JSON.stringify([{ id: 'home', name: 'Home' }, { id: 3 }, null, { id: 'x' }]));
  assert.deepEqual(loadWorkspaces(), [{ id: 'main', name: 'Main' }, { id: 'home', name: 'Home' }]);
  storage.setItem('orbit:workspace', 'home');
  assert.equal(readActiveWorkspace(), 'home');
  assert.equal(workspaceName('home'), 'Home');
  storage.setItem('orbit:workspace', 'gone');
  assert.equal(readActiveWorkspace(), 'main');
  assert.equal(workspaceName('gone'), 'Main');
});

test('workspaces: names are 1-40 characters and unique ignoring case; ids come from names', () => {
  storage.setItem('orbit:workspaces:v1', JSON.stringify([{ id: 'main', name: 'Main' }, { id: 'home', name: 'Home' }]));
  assert.deepEqual(newWorkspace(' Home Office '), { id: 'home-office', name: 'Home Office' });
  assert.throws(() => newWorkspace('home'), { message: 'There is already a workspace named home.' });
  assert.throws(() => newWorkspace(' '), { message: 'A workspace needs a name of up to 40 characters.' });
  assert.throws(() => newWorkspace('w'.repeat(41)), { message: 'A workspace needs a name of up to 40 characters.' });
  renameWorkspace('home', 'Cottage');
  assert.equal(workspaceName('home'), 'Cottage');
  assert.throws(() => renameWorkspace('home', 'MAIN'), { message: 'There is already a workspace named MAIN.' });
});

test('prefs: booleans are the strings true and false; unknown values fall back', () => {
  assert.equal(readBoolean('orbit:animations', true), true);
  savePreference('orbit:animations', false);
  assert.equal(storage.getItem('orbit:animations'), 'false');
  assert.equal(readBoolean('orbit:animations', true), false);
  storage.setItem('orbit:quick-bar', 'yes');
  assert.equal(readBoolean('orbit:quick-bar', true), false, '2.2.1: anything but "true" is false');
  for (const [key, bad, read, fallback] of [['orbit:theme', 'red', readTheme, 'default'], ['orbit:font-size', 'huge', readFontSize, 'standard'],
    ['orbit:galaxy-view', 'grid', readGalaxyView, 'orbits'], ['orbit:rdp-launch', 'x', readRdpLaunch, 'download']]) {
    storage.setItem(/** @type {string} */ (key), /** @type {string} */ (bad));
    assert.equal(/** @type {Function} */ (read)(), fallback);
  }
  storage.setItem('orbit:theme', 'auburn');
  assert.equal(readTheme(), 'auburn');
});

test('prefs: stored sets (team hidden, team favorites) read as sets of strings', () => {
  storage.setItem('orbit:team-hidden', JSON.stringify(['team:a', 7]));
  assert.deepEqual([...hiddenTeamSuns()], ['team:a', '7']);
  storage.setItem('orbit:team-favorites', '{"not":"a list"}');
  assert.deepEqual([...readStoredSet('orbit:team-favorites')], []);
  writeStoredSet('orbit:team-favorites', new Set(['https://a.test']));
  assert.equal(storage.getItem('orbit:team-favorites'), '["https://a.test"]');
});

const map = name => [{ id: name, name, description: '', color: '#79d9f8', links: [] }];

test('history: newest first, 20 kept, empty routines and presets left out', () => {
  for (let i = 0; i < 25; i++) recordHistory('orbit:history:v1', map(`s${i}`), i ? `Change ${i}` : '', [], [], 1000 + i);
  const list = loadHistory('orbit:history:v1');
  assert.equal(list.length, HISTORY_LIMIT);
  assert.equal(list[0].label, 'Change 24');
  assert.deepEqual(Object.keys(list[0]), ['time', 'label', 'groups']);
  recordHistory('orbit:history:v1', map('r'), 'With routines', [{ id: 'r' }], [{ id: 'p' }], 5);
  assert.deepEqual(Object.keys(loadHistory('orbit:history:v1')[0]), ['time', 'label', 'groups', 'routines', 'rdpPresets']);
});

test('history: a missing label becomes "Change"; entries without groups are skipped', () => {
  recordHistory('orbit:history:v1', map('a'), undefined, [], [], 1);
  assert.equal(loadHistory('orbit:history:v1')[0].label, 'Change');
  storage.setItem('orbit:history:v1', JSON.stringify([{ label: 'broken' }, { time: 1, label: 'ok', groups: [] }]));
  assert.deepEqual(loadHistory('orbit:history:v1').map(entry => entry.label), ['ok']);
});

test('history: when storage is full the oldest versions are dropped, and a total failure is silent', () => {
  const sized = memoryStorage();
  const setItem = sized.setItem.bind(sized);
  sized.setItem = (key, value) => { if (value.length > 400) throw new Error('quota'); setItem(key, value); };
  useBackend(sized);
  for (let i = 0; i < 10; i++) recordHistory('orbit:history:v1', map(`sun-${i}`), `Change ${i}`, [], [], i);
  const list = loadHistory('orbit:history:v1');
  assert.ok(list.length > 0 && list.length < 10);
  assert.equal(list[0].label, 'Change 9', 'the newest version is kept');
  sized.setItem = () => { throw new Error('quota'); };
  recordHistory('orbit:history:v1', map('x'), 'Never fits', [], [], 1);
});

test('history matches 2.2.1 recordHistory and loadHistory', () => {
  const old = oracle();
  for (let i = 0; i < 23; i++) {
    const routines = i % 3 ? [] : [{ id: 'r', name: 'R', links: [] }];
    recordHistory('orbit:history:v1', map(`s${i}`), i % 4 ? `L${i}` : '', routines, [], 0);
    old.call('recordHistory', map(`s${i}`), i % 4 ? `L${i}` : '', routines, []);
  }
  const strip = list => list.map(({ time, ...rest }) => rest);
  assert.deepEqual(strip(loadHistory('orbit:history:v1')), strip(old.call('loadHistory')));
});

test('backup: counts changes per workspace, resets on export, and forgets a removed workspace', () => {
  countChange('main', 100);
  countChange('main', 200);
  countChange('home', 300);
  assert.deepEqual(readBackupState(), { main: { changes: 2, since: 100 }, home: { changes: 1, since: 300 } });
  noteBackupMade('main', 400);
  countChange('main', 500);
  assert.deepEqual(readBackupState().main, { changes: 1, lastExport: 400, since: 400 }, 'counting starts from the last export');
  forgetWorkspace('home');
  assert.deepEqual(Object.keys(readBackupState()), ['main']);
  storage.setItem('orbit:backup:v1', 'null');
  assert.deepEqual(readBackupState(), {});
});
