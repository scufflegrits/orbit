// state/storage, workspaces, prefs, history, and backup, against an in-memory
// storage stand-in. Where 2.2.1 has the same function, the result is compared
// with the oracle's (tests/behavior-2.2.md, "Saving and history",
// "Workspaces", "Preferences").
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { oracle } from '../../tests/oracle/oracle.mjs';
import { KEYS, MIGRATIONS, memoryStorage, migrate, onExternalChange, readJson, useBackend, write, writeSafely } from './storage.js';
import { defaultWorkspaces, loadStoredWorkspaces, loadWorkspaces, markDefaultRemoved, newWorkspace, readActiveWorkspace, removedDefaultIds, renameWorkspace, restoreDefault, setDefaultWorkspaces, workspaceKey, workspaceName } from './workspaces.js';
import { hiddenTeamSuns, markOffered, offeredIn, readBackground, readBoolean, readFontFamily, readParticles, readButtonTips, readFontSize, readGalaxyView, readOffered, readRdpLaunch, readStoredSet, readTeamSeen, readTheme, readVariables, rememberTeam, savePreference, saveVariables, writeStoredSet } from './prefs.js';
import { HISTORY_LIMIT, loadHistory, recordHistory } from './history.js';
import { countChange, forgetWorkspace, noteBackupMade, readBackupState } from './backup.js';

/** @type {ReturnType<typeof memoryStorage>} */
let storage;
beforeEach(() => {
  storage = memoryStorage();
  useBackend(storage);
  setDefaultWorkspaces([]);
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

test('version 1 migration marks storage without changing earlier data', () => {
  write(KEYS.map, 'earlier map');
  assert.deepEqual(MIGRATIONS.map(migration => migration.version), [1]);
  assert.deepEqual(migrate(), [1]);
  assert.equal(storage.getItem(KEYS.map), 'earlier map');
  assert.equal(storage.getItem('orbit:storage-version'), '1');
  assert.deepEqual(migrate(), []);
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

test('workspaces: defaults appear without being stored, removal persists, ids stay reserved, rename stores only the choice', () => {
  setDefaultWorkspaces([{ id: 'dev-toolbox', name: 'Dev Toolbox', map: { groups: [] } }]);
  assert.deepEqual(loadWorkspaces(), [{ id: 'main', name: 'Main' }, { id: 'dev-toolbox', name: 'Dev Toolbox' }]);
  assert.deepEqual(loadStoredWorkspaces(), []);
  assert.throws(() => newWorkspace('Dev Toolbox'), /already a workspace/);
  markDefaultRemoved('dev-toolbox');
  assert.deepEqual(loadWorkspaces(), [{ id: 'main', name: 'Main' }]);
  assert.notEqual(newWorkspace('Dev Toolbox').id, 'dev-toolbox');
  restoreDefault('dev-toolbox');
  renameWorkspace('dev-toolbox', 'Tools');
  assert.deepEqual(loadStoredWorkspaces(), [{ id: 'dev-toolbox', name: 'Tools' }]);
  assert.deepEqual(defaultWorkspaces().map(item => item.id), ['dev-toolbox']);
  storage.setItem('orbit:workspaces:removed:v1', '{bad');
  assert.deepEqual([...removedDefaultIds()], []);
});

test('prefs: booleans are the strings true and false; unknown values fall back', () => {
  assert.equal(readBoolean('orbit:animations', true), true);
  savePreference('orbit:animations', false);
  assert.equal(storage.getItem('orbit:animations'), 'false');
  assert.equal(readBoolean('orbit:animations', true), false);
  storage.setItem('orbit:quick-bar', 'yes');
  assert.equal(readBoolean('orbit:quick-bar', true), false, '2.2.1: anything but "true" is false');
  for (const [key, bad, read, fallback] of [['orbit:theme', 'red', readTheme, 'default'], ['orbit:button-tips', 'unknown', readButtonTips, 'normal'], ['orbit:font-size', 'huge', readFontSize, 'standard'],
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

test('prefs: placeholder values and routine offers read as 2.2.1 loadVariables and readOffered did', () => {
  const values = ['{"id":"7"}', '[1,2]', 'null', '"text"', '{', '5'];
  for (const text of values) {
    const old = oracle();
    old.setStorage({ 'orbit:variables:v1': text, 'orbit:routine-offered:v1': text });
    storage.setItem('orbit:variables:v1', text);
    storage.setItem('orbit:routine-offered:v1', text);
    assert.deepEqual(JSON.parse(JSON.stringify(readVariables())), old.call('loadVariables'), text);
    assert.deepEqual(JSON.parse(JSON.stringify(readOffered())), old.call('readOffered'), text);
  }
});

test('prefs: routine offers are per workspace; Main keeps the plain routine id (3.0.1)', () => {
  markOffered('morning', '2026-11-22');
  markOffered('morning', '2026-11-21', 'home');
  assert.deepEqual(JSON.parse(storage.getItem(KEYS.routineOffered)), { morning: '2026-11-22', 'morning:home': '2026-11-21' });
  assert.equal(offeredIn('main').morning, '2026-11-22');
  assert.deepEqual(offeredIn('home'), { morning: '2026-11-21' });
  assert.deepEqual(offeredIn('work'), {});
  // A mark saved by 2.x or 3.0.0 (plain id) still counts for Main.
  storage.setItem(KEYS.routineOffered, '{"standup":"2026-11-22"}');
  assert.deepEqual(offeredIn('main'), { standup: '2026-11-22' });
  assert.deepEqual(offeredIn('home'), {});
});

test('prefs: saving placeholder values keeps the others; offers record the day; a full storage is ignored', () => {
  saveVariables({ id: '7' });
  saveVariables({ q: 'x' });
  assert.equal(storage.getItem(KEYS.variables), '{"id":"7","q":"x"}');
  markOffered('r1', '2026-11-23');
  assert.deepEqual(readOffered(), { r1: '2026-11-23' });
  storage.failWrites = true;
  saveVariables({ id: '8' });
  markOffered('r1', '2026-11-24');
  assert.equal(readVariables().id, '7');
});

test('prefs: team links seen last are null until first remembered, and keep only key and name', () => {
  assert.equal(readTeamSeen(), null);
  storage.setItem(KEYS.teamSeen, '{"not":"a list"}');
  assert.equal(readTeamSeen(), null);
  rememberTeam([{ key: 'https://a.test', name: 'A', path: 'Ops' }]);
  assert.equal(storage.getItem(KEYS.teamSeen), '[{"key":"https://a.test","name":"A"}]');
  assert.deepEqual(readTeamSeen(), [{ key: 'https://a.test', name: 'A' }]);
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

test('prefs: the font is Inter unless Orbit classic was chosen; anything else falls back to Inter', () => {
  assert.equal(readFontFamily(), 'inter', 'missing: Inter, so existing users get it after the update');
  storage.setItem('orbit:font-family', 'classic');
  assert.equal(readFontFamily(), 'classic');
  for (const junk of ['comic', '', 'Inter', 'CLASSIC']) {
    storage.setItem('orbit:font-family', junk);
    assert.equal(readFontFamily(), 'inter', junk);
  }
});

test('prefs: the background is None unless Constellations was chosen; particles are Normal by default; Aurora is a theme', () => {
  assert.equal(readBackground(), 'none', 'missing: None, so nobody gets motion they did not choose');
  storage.setItem('orbit:background', 'constellations');
  assert.equal(readBackground(), 'constellations');
  storage.setItem('orbit:background', 'starfield');
  assert.equal(readBackground(), 'none');
  assert.equal(readParticles(), 'normal');
  for (const value of ['subtle', 'bold']) {
    storage.setItem('orbit:particles', value);
    assert.equal(readParticles(), value);
  }
  storage.setItem('orbit:particles', 'loud');
  assert.equal(readParticles(), 'normal');
  storage.setItem('orbit:theme', 'aurora');
  assert.equal(readTheme(), 'aurora');
});
