// state/store.js: the only writer of the map (REWRITE_PLAN.md, phase 3).
// Examples for each operation, the plan's property tests, and a differential
// test that runs random sequences of saves through 2.2.1's own saveMap.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { oracle } from '../../tests/oracle/oracle.mjs';
import { rawMap, runs, validMap } from '../../tests/unit/arbitraries.mjs';
import { memoryStorage, useBackend } from './storage.js';
import { loadHistory } from './history.js';
import { readBackupState } from './backup.js';
import { createStore } from './store.js';
import { loadStoredWorkspaces, loadWorkspaces, renameWorkspace } from './workspaces.js';

/** @type {ReturnType<typeof memoryStorage>} */
let storage;
const fresh = (initial = {}) => {
  storage = memoryStorage(initial);
  useBackend(storage);
};
beforeEach(() => fresh());

const sun = (id, links = [], extra = {}) => ({ id, name: id[0].toUpperCase() + id.slice(1), description: '', color: '#79d9f8', links, ...extra });
const planet = (name, url) => ({ name, url, moons: [] });
const SEED = { groups: [sun('sample', [planet('Docs', 'https://docs.test/')])] };
const TEAM = [sun('team:ops', [planet('Status', 'https://status.test/')], { team: true }), sun('team:hr', [], { team: true })];
const stored = (key = 'orbit:map:v1') => JSON.parse(storage.getItem(key) || 'null');
const started = (options = {}) => {
  const store = createStore();
  store.start({ seed: SEED, team: TEAM, ...options });
  return store;
};

test('start: Main with no saved map shows the project data, team suns first', () => {
  const store = started();
  const state = store.state();
  assert.deepEqual(state.groups.map(s => s.id), ['team:ops', 'team:hr', 'sample']);
  assert.equal(state.source, 'bundled');
  assert.equal(state.revision, 0);
  assert.equal(storage.data.size, 0, 'starting writes nothing');
});

test('start: a saved map wins; a broken one shows the fallback with a warning and is left in storage', () => {
  fresh({ 'orbit:map:v1': JSON.stringify({ groups: [sun('mine')] }) });
  assert.deepEqual(started().state().groups.map(s => s.id), ['team:ops', 'team:hr', 'mine']);
  fresh({ 'orbit:map:v1': JSON.stringify({ groups: [sun('bad', [], { color: null })] }) });
  const store = started();
  assert.deepEqual(store.state().groups.map(s => s.id), ['team:ops', 'team:hr', 'sample']);
  assert.equal(store.state().warning, 'Saved browser data could not be loaded: Bad needs a six-digit hex color.');
  assert.ok(storage.getItem('orbit:map:v1'), 'kept until the next save, as in 2.2.1');
});

test('start: another workspace with no saved map is empty (and reports "bundled", a 2.2.1 quirk)', () => {
  fresh({ 'orbit:workspaces:v1': JSON.stringify([{ id: 'main', name: 'Main' }, { id: 'home', name: 'Home' }]), 'orbit:workspace': 'home' });
  const store = started();
  assert.equal(store.state().workspace, 'home');
  assert.deepEqual(store.state().groups.map(s => s.id), ['team:ops', 'team:hr']);
  assert.equal(store.state().source, 'bundled');
});

test('default workspace: showing and switching writes no workspace data; edits persist and reset follows its file', () => {
  const toolbox = { id: 'dev-toolbox', name: 'Dev Toolbox', map: { groups: [sun('git')] } };
  const store = started({ defaults: [toolbox] });
  assert.deepEqual(store.state().groups.map(s => s.id), ['team:ops', 'team:hr', 'sample']);
  assert.equal(storage.data.size, 0, 'showing defaults writes nothing');
  assert.deepEqual(loadWorkspaces().map(w => w.id), ['main', 'dev-toolbox']);
  assert.deepEqual(loadStoredWorkspaces(), []);
  assert.equal(store.switchWorkspace('dev-toolbox'), true);
  assert.deepEqual(store.state().groups.map(s => s.id), ['team:ops', 'team:hr', 'git']);
  assert.equal(store.state().source, 'bundled');
  assert.deepEqual([...storage.data.keys()], ['orbit:workspace'], 'switch writes only the active workspace');
  store.saveMap({ groups: [...store.state().groups, sun('extra')] }, 'Added');
  assert.ok(stored('orbit:map:v1:dev-toolbox'));
  store.resetToBundled();
  assert.equal(storage.getItem('orbit:map:v1:dev-toolbox'), null);
  assert.deepEqual(store.state().groups.map(s => s.id), ['team:ops', 'team:hr', 'git']);
  assert.equal(store.state().source, 'bundled');
});

test('start: an active default workspace with no saved map follows its file without writing', () => {
  const toolbox = { id: 'dev-toolbox', name: 'Dev Toolbox', map: { groups: [sun('git')] } };
  fresh({ 'orbit:workspace': 'dev-toolbox' });
  const store = started({ defaults: [toolbox] });
  assert.deepEqual(store.state().groups.map(s => s.id), ['team:ops', 'team:hr', 'git']);
  assert.deepEqual([...storage.data.entries()], [['orbit:workspace', 'dev-toolbox']]);
});

test('default workspace: remove remembers it; restoring creates no map and allows a matching name', () => {
  const toolbox = { id: 'dev-toolbox', name: 'Dev Toolbox', map: { groups: [sun('git')] } };
  fresh({ 'orbit:workspaces:v1': JSON.stringify([{ id: 'other', name: 'Dev Toolbox' }]) });
  const store = started({ defaults: [toolbox] });
  store.removeWorkspace('dev-toolbox');
  assert.ok(!loadWorkspaces().some(w => w.id === 'dev-toolbox'));
  assert.equal(store.addWorkspace('Dev Toolbox', 'default:dev-toolbox'), 'dev-toolbox');
  assert.ok(loadWorkspaces().some(w => w.id === 'dev-toolbox'));
  assert.equal(storage.getItem('orbit:map:v1:dev-toolbox'), null);
});

test('default workspace: user workspace list writes never persist unrenamed defaults', () => {
  const toolbox = { id: 'dev-toolbox', name: 'Dev Toolbox', map: { groups: [sun('git')] } };
  const store = started({ defaults: [toolbox] });
  const id = store.addWorkspace('Home', 'empty');
  assert.deepEqual(loadStoredWorkspaces(), [{ id, name: 'Home' }]);
  renameWorkspace(id, 'House');
  assert.deepEqual(loadStoredWorkspaces(), [{ id, name: 'House' }]);
  store.removeWorkspace(id);
  assert.deepEqual(loadStoredWorkspaces(), []);
  assert.ok(loadWorkspaces().some(item => item.id === 'dev-toolbox'));
});

test('default id collision: an existing saved map wins until Reset follows the default file', () => {
  const custom = { groups: [sun('kept')] };
  fresh({
    'orbit:workspaces:v1': JSON.stringify([{ id: 'dev-toolbox', name: 'Existing Tools' }]),
    'orbit:map:v1:dev-toolbox': JSON.stringify(custom),
    'orbit:workspace': 'dev-toolbox',
  });
  const store = started({ defaults: [{ id: 'dev-toolbox', name: 'Dev Toolbox', map: { groups: [sun('git')] } }] });
  assert.deepEqual(store.state().groups.map(item => item.id), ['team:ops', 'team:hr', 'kept']);
  assert.deepEqual(loadWorkspaces().find(item => item.id === 'dev-toolbox'), { id: 'dev-toolbox', name: 'Existing Tools' });
  store.resetToBundled();
  assert.deepEqual(store.state().groups.map(item => item.id), ['team:ops', 'team:hr', 'git']);
  assert.equal(storage.getItem('orbit:map:v1:dev-toolbox'), null);
});

test('start: hidden team suns are left out', () => {
  fresh({ 'orbit:team-hidden': '["team:hr"]' });
  assert.deepEqual(started().state().groups.map(s => s.id), ['team:ops', 'sample']);
});

test('saveMap stores only personal suns, records the previous version, counts a change, and notifies', () => {
  const store = started();
  /** @type {string[]} */
  const kinds = [];
  store.subscribe((state, kind) => kinds.push(`${kind}:${state.revision}`));
  const next = [...store.state().groups, sun('work')];
  store.saveMap({ groups: next }, 'Added Work');
  assert.deepEqual(stored().groups.map(s => s.id), ['sample', 'work']);
  assert.deepEqual(loadHistory('orbit:history:v1').map(e => [e.label, e.groups.map(s => s.id)]), [['Added Work', ['sample']]]);
  assert.equal(readBackupState().main.changes, 1);
  assert.equal(store.state().source, 'browser');
  assert.deepEqual(kinds, ['save:1']);
});

test('saveMap with no change: revision still goes up, no history, no backup count', () => {
  const store = started();
  store.saveMap({ groups: store.state().groups }, 'Nothing');
  assert.equal(store.state().revision, 1);
  assert.deepEqual(loadHistory('orbit:history:v1'), []);
  assert.deepEqual(readBackupState(), {});
});

test('saveMap with label false skips history but still counts the change', () => {
  const store = started();
  store.saveMap({ groups: [sun('x')] }, false);
  assert.deepEqual(loadHistory('orbit:history:v1'), []);
  assert.equal(readBackupState().main.changes, 1);
});

test('saveMap keeps routines and presets unless replaced', () => {
  const store = started();
  store.saveMap({ groups: [], routines: [{ name: 'Morning', links: [{ key: 'k' }] }] }, 'R');
  store.saveMap({ groups: [sun('a')] }, 'G');
  assert.equal(store.state().routines[0].name, 'Morning');
  store.saveMap({ groups: [sun('a')], routines: [] }, 'Clear');
  assert.deepEqual(store.state().routines, []);
  assert.equal(stored().routines, undefined);
});

test('an invalid map throws with nothing changed, and the previous undo record is put back', () => {
  const store = started();
  storage.setItem('orbit:undo-removal:v1', '{"kind":"sun","index":0,"item":{}}');
  const before = { ...storage.data };
  assert.throws(() => store.saveMap({ groups: [sun('a', [], { color: 'red' })] }, 'Bad', { undoRecord: { kind: 'planet' } }),
    { message: 'A needs a six-digit hex color.' });
  assert.equal(storage.getItem('orbit:undo-removal:v1'), '{"kind":"sun","index":0,"item":{}}');
  assert.deepEqual({ ...storage.data }, before);
  assert.equal(store.state().revision, 0);
});

test('a full storage throws: map, history, and backup unchanged, and a new undo record removed again', () => {
  const store = started();
  storage.failWrites = true;
  assert.throws(() => store.saveMap({ groups: [sun('a')] }, 'X', { undoRecord: { kind: 'sun' } }), /quota/);
  storage.failWrites = false;
  assert.equal(storage.data.size, 0);
  assert.equal(store.state().revision, 0);
  const writes = [];
  const setItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => { writes.push(key); if (key === 'orbit:map:v1') throw new Error('quota'); setItem(key, value); };
  assert.throws(() => store.saveMap({ groups: [sun('a')] }, 'X', { undoRecord: { kind: 'sun' } }), /quota/);
  assert.equal(storage.getItem('orbit:undo-removal:v1'), null, 'the undo record that was new is removed');
  assert.deepEqual(writes, ['orbit:undo-removal:v1', 'orbit:map:v1'], 'undo record first, then the map; never history');
});

test('expectRevision refuses a save made against an older revision', () => {
  const store = started();
  store.saveMap({ groups: [sun('a')] }, 'A', { expectRevision: 0 });
  assert.throws(() => store.saveMap({ groups: [sun('b')] }, 'B', { expectRevision: 0 }), { message: 'The link map changed, so nothing was saved.' });
  assert.deepEqual(stored().groups.map(s => s.id), ['a']);
});

test('clearUndo removes the undo record after a save', () => {
  const store = started();
  store.saveMap({ groups: [sun('a')] }, 'A', { undoRecord: { kind: 'sun', index: 0, item: sun('z'), label: 'Z' } });
  assert.ok(store.loadUndoRecord());
  store.saveMap({ groups: [sun('b')] }, 'B', { clearUndo: true });
  assert.equal(store.loadUndoRecord(), null);
});

test('undoRemoval puts a sun, planet, or moon back, then clears the record', () => {
  const store = started();
  assert.equal(store.undoRemoval(), false, 'nothing to undo');
  store.saveMap({ groups: [sun('a', [{ ...planet('P', 'https://p.test/'), moons: [] }])] }, 'Start');
  storage.setItem('orbit:undo-removal:v1', JSON.stringify({ kind: 'moon', index: 0, item: { name: 'M', url: 'https://m.test/' }, label: 'M',
    sunId: 'a', planetUrl: 'https://p.test/', planetName: 'P', planetIndex: 0 }));
  assert.equal(store.undoRemoval(), true);
  assert.equal(store.state().groups[2].links[0].moons[0].name, 'M');
  assert.equal(store.loadUndoRecord(), null);
  assert.equal(loadHistory('orbit:history:v1')[0].label, 'Undid removal of M');
  storage.setItem('orbit:undo-removal:v1', JSON.stringify({ kind: 'sun', index: 2, item: sun('a'), label: 'A' }));
  store.undoRemoval();
  assert.deepEqual(store.state().groups.map(s => s.id), ['team:ops', 'team:hr', 'a-2', 'a'], 'a clashing id is renamed; the index counts team suns');
  storage.setItem('orbit:undo-removal:v1', JSON.stringify({ kind: 'planet', index: 0, item: planet('Q', 'https://q.test/'), label: 'Q', sunId: 'gone' }));
  assert.throws(() => store.undoRemoval(), { message: 'The parent sun no longer exists.' });
  storage.setItem('orbit:undo-removal:v1', '{"kind":"sun","index":-1,"item":{}}');
  assert.equal(store.loadUndoRecord(), null, 'a negative index is not a record');
});

test('resetToBundled: Main removes its saved map; another workspace saves the file data (2.2.1, F27)', () => {
  fresh({ 'orbit:workspaces:v1': JSON.stringify([{ id: 'main', name: 'Main' }, { id: 'home', name: 'Home' }]) });
  const store = started();
  store.saveMap({ groups: [sun('mine')] }, 'Mine', { undoRecord: { kind: 'sun', index: 0, item: sun('x'), label: 'X' } });
  store.resetToBundled();
  assert.equal(storage.getItem('orbit:map:v1'), null);
  assert.equal(storage.getItem('orbit:undo-removal:v1'), null);
  assert.equal(store.state().source, 'bundled');
  assert.equal(loadHistory('orbit:history:v1')[0].label, 'Reset to file data');
  store.switchWorkspace('home');
  store.saveMap({ groups: [sun('house')] }, 'House');
  store.resetToBundled();
  assert.deepEqual(stored('orbit:map:v1:home').groups.map(s => s.id), ['sample']);
  assert.equal(store.state().source, 'browser');
  assert.equal(loadHistory('orbit:history:v1:home')[0].label, 'Reset to file data');
});

test('setTeamSunHidden hides and shows a team sun, keeping the personal map', () => {
  const store = started();
  store.setTeamSunHidden('team:ops', true);
  assert.deepEqual(store.state().groups.map(s => s.id), ['team:hr', 'sample']);
  assert.equal(storage.getItem('orbit:team-hidden'), '["team:ops"]');
  store.setTeamSunHidden('team:ops', false);
  assert.deepEqual(store.state().groups.map(s => s.id), ['team:ops', 'team:hr', 'sample']);
  assert.equal(store.state().revision, 2);
  assert.equal(storage.getItem('orbit:map:v1'), null, 'hiding is not a map write');
});

test('workspaces: add (empty, copy, bundled), switch, and remove', () => {
  const store = started();
  store.saveMap({ groups: [sun('mine')] }, 'Mine');
  const copy = store.addWorkspace('Copy', 'copy');
  const sample = store.addWorkspace('Sample', 'bundled');
  const empty = store.addWorkspace('Empty', 'empty');
  assert.deepEqual([copy, sample, empty], ['copy', 'sample', 'empty']);
  assert.deepEqual(stored('orbit:map:v1:copy').groups.map(s => s.id), ['mine']);
  assert.deepEqual(stored('orbit:map:v1:sample').groups.map(s => s.id), ['sample']);
  assert.deepEqual(stored('orbit:map:v1:empty'), { groups: [] });
  assert.equal(store.switchWorkspace('nope'), false);
  assert.equal(store.switchWorkspace('copy'), true);
  assert.equal(storage.getItem('orbit:workspace'), 'copy');
  assert.deepEqual(store.state().groups.map(s => s.id), ['team:ops', 'team:hr', 'mine']);
  store.saveMap({ groups: [sun('changed')] }, 'Changed');
  assert.deepEqual(stored().groups.map(s => s.id), ['mine'], 'Main untouched');
  storage.setItem('orbit:routine-offered:v1', JSON.stringify({ morning: '2026-11-22', 'morning:copy': '2026-11-22', 'morning:empty': '2026-11-22' }));
  assert.equal(store.removeWorkspace('copy'), true, 'it was the open one');
  assert.equal(storage.getItem('orbit:map:v1:copy'), null);
  assert.equal(storage.getItem('orbit:history:v1:copy'), null);
  assert.equal(readBackupState().copy, undefined);
  assert.deepEqual(stored('orbit:routine-offered:v1'), { morning: '2026-11-22', 'morning:empty': '2026-11-22' }, 'its routine offer marks go too (3.0.1)');
  assert.equal(store.removeWorkspace('main'), false);
  assert.equal(store.removeWorkspace('empty'), false);
});

test('locate and combinedIndex convert between the page\'s numbering and team or personal', () => {
  const store = started();
  assert.deepEqual(store.locate(1), { team: true, index: 1 });
  assert.deepEqual(store.locate(2), { team: false, index: 0 });
  assert.equal(store.combinedIndex({ team: false, index: 0 }), 2);
  assert.equal(store.combinedIndex({ team: true, index: 1 }), 1);
});

// ---- Properties (REWRITE_PLAN.md, phase 3) -------------------------------

const team = fc.constantFrom([], TEAM, [TEAM[0]]);
const op = fc.oneof(
  { weight: 6, arbitrary: fc.record({ kind: fc.constant('save'), groups: validMap, label: fc.constantFrom('Edit', false, undefined),
    withTeam: fc.boolean(), teamEdit: fc.boolean() }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('saveRaw'), data: rawMap }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('hide'), id: fc.constantFrom('team:ops', 'team:hr'), hidden: fc.boolean() }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('switch'), id: fc.constantFrom('main', 'home', 'work') }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('reset') }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('restore'), pick: fc.nat(30) }) },
);

/** Apply one random operation; returns whether the revision should have gone up. */
function apply(store, step) {
  const state = store.state();
  const teamSuns = state.groups.filter(s => s.team);
  try {
    if (step.kind === 'save') {
      const front = step.withTeam ? teamSuns.map(s => (step.teamEdit ? { ...s, name: 'Edited by mistake' } : s)) : [];
      store.saveMap({ groups: [...front, ...step.groups] }, step.label);
    } else if (step.kind === 'saveRaw') {
      store.saveMap(step.data && Array.isArray(step.data.groups) ? step.data : { groups: [] }, 'Raw');
    } else if (step.kind === 'hide') {
      store.setTeamSunHidden(step.id, step.hidden);
    } else if (step.kind === 'switch') {
      return store.switchWorkspace(step.id);
    } else if (step.kind === 'reset') {
      store.resetToBundled();
    } else {
      const versions = loadHistory(state.workspace === 'main' ? 'orbit:history:v1' : `orbit:history:v1:${state.workspace}`);
      if (!versions.length) return false;
      const entry = versions[step.pick % versions.length];
      store.saveMap({ groups: [...teamSuns, ...entry.groups], routines: entry.routines || [], rdpPresets: entry.rdpPresets || [] }, 'Restored');
      const after = store.state();
      assert.deepEqual(after.groups.filter(s => !s.team), entry.groups, 'restoring gives that version\'s map');
      assert.deepEqual(after.routines, entry.routines || []);
      assert.deepEqual(after.rdpPresets, entry.rdpPresets || []);
    }
    return true;
  } catch {
    return false;
  }
}

const startWorkspaces = () => fresh({ 'orbit:workspaces:v1': JSON.stringify([{ id: 'main', name: 'Main' }, { id: 'home', name: 'Home' }, { id: 'work', name: 'Work' }]) });

test('properties: no team suns are ever stored or changed; the revision goes up by one on every change', () => {
  fc.assert(fc.property(team, fc.array(op, { maxLength: 12 }), (teamSuns, steps) => {
    startWorkspaces();
    const store = createStore();
    store.start({ seed: SEED, team: teamSuns });
    for (const step of steps) {
      const before = store.state().revision;
      const changed = apply(store, step);
      assert.equal(store.state().revision, before + (changed ? 1 : 0));
      for (const [key, text] of storage.data) {
        if (key.startsWith('orbit:map:v1')) assert.ok(JSON.parse(text).groups.every(s => !s.team && !String(s.id).startsWith('team:')), key);
      }
      const shown = store.state().groups.filter(s => s.team);
      assert.ok(shown.every(s => teamSuns.some(t => JSON.stringify(t) === JSON.stringify(s))), 'team suns are never changed');
    }
  }), runs(300));
});

test('property: a workspace switch never touches another workspace\'s keys or backup entry', () => {
  fc.assert(fc.property(fc.array(op, { maxLength: 10 }), fc.constantFrom('main', 'home', 'work'), (steps, target) => {
    startWorkspaces();
    const store = createStore();
    store.start({ seed: SEED, team: TEAM });
    for (const step of steps) apply(store, step);
    const before = new Map(storage.data);
    const backups = readBackupState();
    store.switchWorkspace(target);
    for (const [key, text] of before) {
      if (key === 'orbit:workspace') continue;
      assert.equal(storage.getItem(key), text, key);
    }
    assert.deepEqual(readBackupState(), backups);
    for (const key of storage.data.keys()) assert.ok(before.has(key) || key === 'orbit:workspace', `no new key ${key}`);
  }), runs(200));
});

test('property: after resetToBundled in any workspace, loading it again shows the same map', () => {
  fc.assert(fc.property(fc.array(op, { maxLength: 8 }), fc.constantFrom('main', 'home', 'work'), (steps, where) => {
    startWorkspaces();
    const store = createStore();
    store.start({ seed: SEED, team: TEAM });
    for (const step of steps) apply(store, step);
    store.switchWorkspace(where);
    store.resetToBundled();
    const shown = store.state();
    const reloaded = createStore();
    reloaded.start({ seed: SEED, team: TEAM });
    assert.equal(reloaded.state().workspace, where);
    assert.deepEqual(reloaded.state().groups, shown.groups);
    assert.deepEqual(reloaded.state().routines, shown.routines);
  }), runs(200));
});

// ---- Differential: sequences of saves against 2.2.1's saveMap -------------

test('sequences of saves match 2.2.1: shown map, stored map, history, change count, revision, errors', () => {
  const save = fc.record({ groups: fc.oneof(validMap, rawMap.map(raw => (raw && Array.isArray(raw.groups) ? raw.groups : []))),
    routines: fc.constantFrom(undefined, [], [{ id: 'r', name: 'R', links: [{ key: 'k' }] }]),
    label: fc.constantFrom('Edit', false, undefined), withTeam: fc.boolean() });
  fc.assert(fc.property(team, fc.array(save, { maxLength: 8 }), (teamSuns, steps) => {
    fresh();
    const store = createStore();
    store.start({ seed: SEED, team: teamSuns });
    const old = oracle();
    old.set('teamList', teamSuns);
    old.run(`var mapRevision = 0, activeMapSource = 'bundled', changes = 0;
      function visibleTeamGroups() { return teamList; }
      function countChangeForBackup() { changes++; }
      function countDestinations() {} function render() {}
      groups = [...teamList, ...${JSON.stringify(SEED.groups)}];`);
    for (const step of steps) {
      const data = { groups: [...(step.withTeam ? store.state().groups.filter(s => s.team) : []), ...step.groups],
        ...(step.routines !== undefined ? { routines: step.routines } : {}) };
      let mine = null;
      try {
        store.saveMap(data, step.label);
      } catch (error) {
        mine = error.message;
      }
      const theirs = old.call('saveMap', data, step.label);
      assert.equal(mine, theirs && theirs.error !== undefined ? theirs.error : null);
      assert.deepEqual(store.state().groups, old.get('groups'));
      assert.deepEqual(store.state().routines, old.get('routines'));
      assert.equal(store.state().revision, old.get('mapRevision'));
      const oldStorage = old.storage();
      assert.equal(storage.getItem('orbit:map:v1'), oldStorage['orbit:map:v1'] ?? null);
      const strip = text => JSON.parse(text || '[]').map(({ time, ...rest }) => rest);
      assert.deepEqual(strip(storage.getItem('orbit:history:v1')), strip(oldStorage['orbit:history:v1']));
      assert.equal(readBackupState().main?.changes ?? 0, old.get('changes'));
    }
  }), runs(300));
});

test('a save backs up unreadable browser data before replacing it', () => {
  fresh({ 'orbit:map:v1': 'broken JSON' });
  const store = started();
  const writes = [];
  const setItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => { writes.push(key); setItem(key, value); };
  store.saveMap(SEED);
  assert.equal(storage.getItem('orbit:map:v1:unreadable'), 'broken JSON');
  assert.deepEqual(writes.slice(0, 2), ['orbit:map:v1:unreadable', 'orbit:map:v1']);
  store.saveMap(SEED);
  assert.equal(storage.getItem('orbit:map:v1:unreadable'), 'broken JSON');
});

test('a failed unreadable-map backup leaves the original in place', () => {
  fresh({ 'orbit:map:v1': 'broken JSON' });
  const store = started();
  const setItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key.endsWith(':unreadable')) throw new Error('Backup failed');
    setItem(key, value);
  };
  assert.throws(() => store.saveMap(SEED), /Backup failed/);
  assert.equal(storage.getItem('orbit:map:v1'), 'broken JSON');
  assert.equal(store.state().source, 'bundled');
});

test('saving a map with groups sets storage version 1', () => {
  started().saveMap({ groups: [sun('work', [{ name: 'Group', type: 'group', moons: [] }])] });
  assert.equal(storage.getItem('orbit:storage-version'), '1');
});

test('the Main backup does not overwrite a preexisting workspace named Unreadable', () => {
  fresh({ 'orbit:map:v1': 'broken JSON', 'orbit:map:v1:unreadable': '{"groups":[]}',
    'orbit:workspaces:v1': JSON.stringify([{ id: 'unreadable', name: 'Unreadable' }]) });
  started().saveMap(SEED);
  assert.equal(storage.getItem('orbit:map:v1:unreadable'), '{"groups":[]}');
  assert.equal(storage.getItem('orbit:map:v1::unreadable'), 'broken JSON');
});

test('reset keeps memory in sync with disk if clearing the old undo record fails', () => {
  const store = started();
  store.saveMap({ groups: [sun('edited')] });
  const removeItem = storage.removeItem.bind(storage);
  storage.removeItem = key => {
    if (key === 'orbit:undo-removal:v1') throw new Error('Cannot remove undo');
    removeItem(key);
  };
  assert.doesNotThrow(() => store.resetToBundled());
  assert.deepEqual(store.state().groups.filter(s => !s.team), SEED.groups);
  assert.equal(storage.getItem('orbit:map:v1'), null);
});
