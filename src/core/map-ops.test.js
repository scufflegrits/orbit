// core/map-ops.js: moving items, merging imports, duplicates, and copying team
// items (tests/behavior-2.2.md, "Map operations", M01-M04), plus the property
// tests the plan lists for phase 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { oracle } from '../../tests/oracle/oracle.mjs';
import { combinedMap, runs, validMap } from '../../tests/unit/arbitraries.mjs';
import { destinationKey } from './destination.js';
import {
  duplicateGroups, itemExport, mapItemAt, mergeMaps, sunAdditions, mergeRoutines, moveMapItem, packLink, personalGroups, plainCopy, samePath,
} from './map-ops.js';

const old = oracle();
const plain = value => JSON.parse(JSON.stringify(value));

const mapForMoves = () => [
  { id: 'team:t', name: 'Team', description: '', color: '#79d9f8', team: true, links: [{ name: 'Status', url: 'https://status.test/', moons: [] }] },
  { id: 'tech', name: 'Tech', description: '', color: '#79d9f8', links: [
    { name: 'The Verge', url: 'https://www.theverge.com/', moons: [{ name: 'Reviews', url: 'https://www.theverge.com/reviews' }] },
    { name: 'Jira', url: 'https://jira.test/', moons: [] }] },
  { id: 'home', name: 'Home', description: '', color: '#79d9f8', links: [{ name: 'Mail', url: 'https://mail.test/', moons: [] }] },
];

test('M01 a move returns a fresh copy and never changes its input; moving back restores it', () => {
  const before = mapForMoves();
  const result = moveMapItem(before, { kind: 'planet', sun: 1, planet: 1 }, { kind: 'planet', sun: 1, planet: 0, place: 'before' });
  assert.equal(result.status, 'moved');
  if (result.status !== 'moved') return;
  assert.deepEqual(result.path, { kind: 'planet', sun: 1, planet: 0 });
  assert.equal(result.total, 2);
  assert.deepEqual(result.groups[1].links.map(p => p.name), ['Jira', 'The Verge']);
  assert.deepEqual(before, mapForMoves(), 'input unchanged');
  const back = moveMapItem(result.groups, result.path, { kind: 'planet', sun: 1, planet: 1, place: 'after' });
  assert.equal(back.status, 'moved');
  if (back.status === 'moved') assert.deepEqual(back.groups, before);
});

test('M02 same place, invalid targets, and the team map', () => {
  const map = mapForMoves();
  const move = (source, target) => moveMapItem(map, source, target).status;
  assert.equal(move({ kind: 'planet', sun: 1, planet: 0 }, { kind: 'planet', sun: 1, planet: 1, place: 'before' }), 'same');
  assert.equal(move({ kind: 'planet', sun: 1, planet: 0 }, { kind: 'sun', sun: 1 }), 'same', 'onto its own sun');
  assert.equal(move({ kind: 'planet', sun: 1, planet: 0 }, { kind: 'planet', sun: 1, planet: 0, place: 'after' }), 'invalid', 'onto itself');
  assert.equal(move({ kind: 'planet', sun: 1, planet: 0 }, { kind: 'sun', sun: 0 }), 'invalid', 'into a team sun');
  assert.equal(move({ kind: 'planet', sun: 0, planet: 0 }, { kind: 'sun', sun: 2 }), 'invalid', 'out of a team sun');
  assert.equal(move({ kind: 'sun', sun: 2 }, { kind: 'planet', sun: 1, planet: 0 }), 'invalid', 'a sun under a planet');
  assert.equal(move({ kind: 'planet', sun: 1, planet: 9 }, { kind: 'sun', sun: 2 }), 'invalid', 'a missing source');
  assert.equal(move({ kind: 'moon', sun: 1, planet: 0, moon: 0 }, { kind: 'planet', sun: 2, planet: 0 }), 'moved', 'a moon to another planet');
  assert.equal(move({ kind: 'sun', sun: 2 }, { kind: 'sun', sun: 1, place: 'before' }), 'moved');
  assert.equal(move({ kind: 'sun', sun: 2 }, { kind: 'sun', sun: 0, place: 'before' }), 'invalid', 'nothing moves around the team map');
});

test('mapItemAt returns the very object at a path (drag compares identity); samePath compares every part', () => {
  const map = mapForMoves();
  assert.equal(mapItemAt(map, { kind: 'moon', sun: 1, planet: 0, moon: 0 }), map[1].links[0].moons[0]);
  assert.equal(mapItemAt(map, { kind: 'sun', sun: 2 }), map[2]);
  assert.equal(mapItemAt(map, { kind: 'planet', sun: 5, planet: 0 }), null);
  assert.ok(samePath({ kind: 'planet', sun: 1, planet: 0 }, { kind: 'planet', sun: 1, planet: 0, place: 'before' }));
  assert.ok(!samePath({ kind: 'planet', sun: 1, planet: 0 }, { kind: 'moon', sun: 1, planet: 0, moon: 0 }));
});

test('M03 mergeMaps adds only what is new, matching suns by id then name', () => {
  const personal = [{ id: 'a', name: 'Alpha', description: '', color: '#79d9f8', links: [
    { name: 'P', url: 'https://p.test/', moons: [{ name: 'M1', url: 'https://m1.test/' }] },
    { name: 'P again', url: 'https://p.test/', moons: [] }] }];
  const incoming = [
    { id: 'other-id', name: 'ALPHA', description: '', color: '#79d9f8', links: [{ name: 'P copy', url: 'https://p.test/#x',
      moons: [{ name: 'M2', url: 'https://m2.test/' }, { name: 'M1 copy', url: 'https://m1.test/' }] }] },
    { id: 'a', name: 'New sun with a used id', description: '', color: '#79d9f8', links: [] },
    { id: 'team:x', name: 'From the team', description: '', color: '#79d9f8', team: true, links: [] }];
  const result = mergeMaps(personal, incoming);
  assert.deepEqual(Object.keys(result).sort(), ['added', 'groups', 'skipped']);
  assert.deepEqual(result.groups[0].links[0].moons.map(m => m.name), ['M1', 'M2'], 'moons merge into the first planet with that address');
  assert.equal(result.groups[0].links[1].moons.length, 0);
  assert.deepEqual(result.groups[1], { id: 'x', name: 'From the team', description: '', color: '#79d9f8', links: [] }, 'a team sun is copied as a plain one');
  assert.deepEqual(result.added, { suns: 1, planets: 0, moons: 1 });
  assert.deepEqual(result.skipped, { suns: 2, planets: 1, moons: 1 }, 'the second incoming sun matches by id');
  assert.equal(personal[0].links[0].moons.length, 1, 'input unchanged');
});

test('sunAdditions: what each incoming sun adds on its own, whole with its planets and moons (sun picker)', () => {
  const personal = [{ id: 'build', name: 'Build', description: '', color: '#79d9f8', links: [
    { name: 'GitHub', url: 'https://github.com/', moons: [{ name: 'Docs', url: 'https://docs.github.com/' }] }] }];
  const incoming = [
    { id: 'tools', name: 'Dev Toolbox', description: '', color: '#79d9f8', links: [
      { name: 'DevDocs', url: 'https://devdocs.io/', moons: [{ name: 'JS', url: 'https://devdocs.io/javascript/' }, { name: 'CSS', url: 'https://devdocs.io/css/' }] },
      { name: 'Excalidraw', url: 'https://excalidraw.com/', moons: [] }] },
    { id: 'other', name: 'build', description: '', color: '#79d9f8', links: [
      { name: 'GitHub', url: 'https://github.com/', moons: [{ name: 'Docs', url: 'https://docs.github.com/' }, { name: 'Status', url: 'https://githubstatus.com/' }] },
      { name: 'npm', url: 'https://www.npmjs.com/', moons: [{ name: 'Docs', url: 'https://docs.npmjs.com/' }] }] },
    { id: 'same', name: 'Build', description: '', color: '#79d9f8', links: [
      { name: 'GitHub again', url: 'https://github.com/#top', moons: [] }] }];
  assert.deepEqual(sunAdditions(personal, incoming), [
    { isNew: true, planets: 2, moons: 2 },
    { isNew: false, planets: 1, moons: 2 },
    { isNew: false, planets: 0, moons: 0 },
  ], 'a new sun brings every planet and moon; a matched sun brings only what is missing; a sun with nothing new adds nothing');
  // Merging only the chosen suns adds exactly what their rows said.
  const chosen = mergeMaps(personal, [incoming[0]]);
  assert.deepEqual(chosen.added, { suns: 1, planets: 2, moons: 2 });
  assert.deepEqual(chosen.groups.map(sun => sun.name), ['Build', 'Dev Toolbox']);
  assert.equal(personal.length, 1, 'input unchanged');
});

test('M04 mergeRoutines adds only new names and regenerates clashing ids; presets merge the same way', () => {
  const merged = mergeRoutines([{ id: 'r1', name: 'Morning', links: [] }],
    [{ id: 'x', name: 'morning', links: [] }, { id: 'r1', name: 'Evening', links: [] }]);
  assert.deepEqual(merged.map(r => [r.id, r.name]), [['r1', 'Morning'], ['evening', 'Evening']]);
  const presets = mergeRoutines([{ id: 'wide', name: 'Wide', settings: '' }], [{ id: 'wide', name: 'Narrow', settings: 'x:i:1' }]);
  assert.deepEqual(presets, [{ id: 'wide', name: 'Wide', settings: '' }, { id: 'narrow', name: 'Narrow', settings: 'x:i:1' }]);
});

test('duplicateGroups lists every destination found more than once, with its paths', () => {
  const map = mapForMoves();
  map[2].links.push({ name: 'Verge again', url: 'https://www.theverge.com/#top', moons: [] });
  const groups = duplicateGroups(map);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].map(entry => entry.path), [[1, 0], [2, 1]]);
  assert.equal(groups[0][1].item, map[2].links[1]);
});

test('personalGroups, plainCopy, packLink, and itemExport', () => {
  const map = mapForMoves();
  assert.deepEqual(personalGroups(map).map(s => s.id), ['tech', 'home']);
  assert.deepEqual(plainCopy(map[0]), { id: 't', name: 'Team', description: '', color: '#79d9f8', links: map[0].links });
  assert.deepEqual(packLink({ name: 'L', type: 'rdp', host: 'h', rdpPreset: 'wide', favorite: true, team: true, moons: [], note: 'n' }),
    { name: 'L', type: 'rdp', host: 'h', note: 'n' });
  assert.deepEqual(itemExport('sun', map[0]), { format: 'orbit-item-v1', kind: 'sun', item: plainCopy(map[0]) });
});

// ---- Properties ----------------------------------------------------------

/** Random move requests, including out-of-range and mismatched ones. */
const pathArb = fc.record({
  kind: fc.constantFrom('sun', 'planet', 'moon', 'nope'),
  sun: fc.nat(11), planet: fc.nat(12), moon: fc.nat(8),
  place: fc.constantFrom(undefined, 'before', 'after', 'inside'),
});
const trim = path => {
  const out = { kind: path.kind, sun: path.sun };
  if (path.kind !== 'sun') out.planet = path.planet;
  if (path.kind === 'moon' || path.kind === 'nope') out.moon = path.moon;
  if (path.place !== undefined) out.place = path.place;
  return out;
};
const keys = map => map.flatMap(sun => sun.links.flatMap(planet => [destinationKey(planet), ...planet.moons.map(destinationKey)])).sort();

/** The move that puts a moved item back where it came from. */
function inverse(original, source, moved) {
  const kind = source.kind;
  if (kind === 'sun') return [moved.path, { kind: 'sun', sun: source.sun, place: source.sun < moved.path.sun ? 'before' : 'after' }];
  const parentKind = kind === 'planet' ? 'sun' : 'planet';
  const parent = { kind: parentKind, sun: source.sun, ...(kind === 'moon' ? { planet: source.planet } : {}) };
  const siblings = kind === 'planet' ? moved.groups[source.sun].links : moved.groups[source.sun].links[source.planet].moons;
  const index = source[kind];
  const sameParent = moved.path.sun === source.sun && (kind === 'planet' || moved.path.planet === source.planet);
  if (sameParent) return [moved.path, { ...parent, kind, [kind]: index, place: index < moved.path[kind] ? 'before' : 'after' }];
  if (!siblings.length) return [moved.path, parent];
  if (index < siblings.length) return [moved.path, { ...parent, kind, [kind]: index, place: 'before' }];
  return [moved.path, { ...parent, kind, [kind]: siblings.length - 1, place: 'after' }];
}

test('moveMapItem matches 2.2.1 for random maps and moves', () => {
  fc.assert(fc.property(combinedMap, pathArb, pathArb, (map, a, b) => {
    const source = trim(a);
    const target = trim(b);
    delete source.place;
    assert.deepEqual(plain(moveMapItem(map, source, target)), old.call('moveMapItem', map, source, target));
  }), runs(2000));
});

test('a move never loses or duplicates a link, never touches the team map, and can be undone', () => {
  fc.assert(fc.property(combinedMap, pathArb, pathArb, (map, a, b) => {
    const source = trim(a);
    delete source.place;
    const target = trim(b);
    const before = plain(map);
    const result = moveMapItem(map, source, target);
    assert.deepEqual(map, before, 'input unchanged');
    if (result.status !== 'moved') return;
    assert.deepEqual(keys(result.groups), keys(map));
    const team = map.filter(sun => sun.team);
    assert.deepEqual(result.groups.slice(0, team.length), team, 'team suns unchanged and still first');
    const [from, to] = inverse(map, source, result);
    const back = moveMapItem(result.groups, from, to);
    assert.equal(back.status, 'moved');
    if (back.status === 'moved') assert.deepEqual(back.groups, map);
  }), runs(2000));
});

test('mergeMaps matches 2.2.1 on random maps', () => {
  fc.assert(fc.property(validMap, combinedMap, (personal, incoming) => {
    assert.deepEqual(plain(mergeMaps(personal, incoming)), old.call('mergeMaps', personal, incoming));
  }), runs(500));
});

test('mergeMaps keeps everything already there and adds nothing already under the matched sun or planet', () => {
  fc.assert(fc.property(validMap, validMap, (personal, incoming) => {
    const before = plain(personal);
    const { groups, added } = mergeMaps(personal, incoming);
    assert.deepEqual(personal, before, 'input unchanged');
    let planets = 0;
    let moons = 0;
    personal.forEach((sun, s) => {
      const after = groups[s];
      const { links: _links, ...sunFields } = sun;
      const { links: _after, ...afterFields } = after;
      assert.deepEqual(afterFields, sunFields, 'the sun itself is unchanged');
      sun.links.forEach((planet, p) => {
        const { moons: _m, ...fields } = planet;
        const { moons: _n, ...afterPlanet } = after.links[p];
        assert.deepEqual(afterPlanet, fields, 'existing planets kept, in order');
        assert.deepEqual(after.links[p].moons.slice(0, planet.moons.length), planet.moons, 'existing moons kept, in order');
        const newMoons = after.links[p].moons.slice(planet.moons.length).map(destinationKey);
        assert.equal(new Set(newMoons).size, newMoons.length, 'no moon added twice');
        for (const key of newMoons) assert.ok(!planet.moons.some(m => destinationKey(m) === key), 'no moon already there is added');
        moons += newMoons.length;
      });
      const newPlanets = after.links.slice(sun.links.length);
      const newKeys = newPlanets.map(destinationKey);
      assert.equal(new Set(newKeys).size, newKeys.length, 'no planet added twice');
      for (const key of newKeys) assert.ok(!sun.links.some(p => destinationKey(p) === key), 'no planet already there is added');
      planets += newPlanets.length;
      moons += newPlanets.reduce((sum, p) => sum + p.moons.length, 0);
    });
    for (const sun of groups.slice(personal.length)) {
      // A new sun starts as a copy of the first incoming sun with its name; a
      // later incoming sun with the same name merges into it.
      const source = incoming.find(item => item.name.toLocaleLowerCase() === sun.name.toLocaleLowerCase());
      assert.ok(source, 'a new sun comes from the import');
      source.links.forEach((planet, p) => {
        const { moons, ...fields } = planet;
        const { moons: grown, ...copied } = sun.links[p];
        assert.deepEqual(copied, fields, 'it starts as a whole copy');
        assert.deepEqual(grown.slice(0, moons.length), moons, 'later suns can only add moons');
      });
      planets += sun.links.length;
      moons += sun.links.reduce((sum, p) => sum + p.moons.length, 0);
    }
    assert.equal(added.suns, groups.length - personal.length);
    assert.equal(added.planets, planets);
    assert.equal(added.moons, moons);
    assert.equal(new Set(groups.map(sun => sun.id)).size, groups.length, 'sun ids stay unique');
  }), runs(500));
});

const named = fc.array(fc.record({ id: fc.constantFrom('a', 'b', 'morning', 'wide'), name: fc.constantFrom('Morning', 'morning', 'Evening', 'Wide', 'wide', 'Night'), links: fc.constant([]) }), { maxLength: 5 });
const distinct = named.map(list => {
  const seen = new Set();
  const ids = new Set();
  return list.filter(item => !seen.has(item.name.toLowerCase()) && seen.add(item.name.toLowerCase()) && !ids.has(item.id) && ids.add(item.id));
});

test('mergeRoutines matches 2.2.1 and never creates two routines or presets with the same name', () => {
  fc.assert(fc.property(distinct, named, (current, incoming) => {
    const merged = mergeRoutines(current, incoming);
    assert.deepEqual(plain(merged), old.call('mergeRoutines', current, incoming));
    const names = merged.map(item => item.name.toLocaleLowerCase());
    assert.equal(new Set(names).size, names.length);
    assert.deepEqual(merged.slice(0, current.length), current, 'what was there stays first, unchanged');
  }), runs(500));
});

test('duplicateGroups matches 2.2.1', () => {
  const sandbox = oracle();
  fc.assert(fc.property(combinedMap, map => {
    sandbox.set('groups', map);
    assert.deepEqual(plain(duplicateGroups(map)), sandbox.call('duplicateGroups'));
  }), runs(300));
});

test('group merges match by name within a sun, and duplicates include only destinations', () => {
  const map = mapForMoves();
  const moon = map[1].links[0].moons[0];
  const group = { name: 'Jira', type: /** @type {const} */ ('group'), moons: [moon] };
  map[1].links.push(group);
  map[2].links.push({ ...group, moons: [] });
  const incoming = [{ ...map[1], links: [
    { ...group, name: 'JIRA', moons: [moon, { name: 'New', url: 'https://new.test/' }] },
    { ...group, name: 'Other', moons: [] },
  ] }];
  assert.deepEqual(sunAdditions(map, incoming), [{ isNew: false, planets: 1, moons: 1 }]);
  const merged = mergeMaps(map, incoming).groups;
  assert.deepEqual(merged[1].links.map(p => p.moons.length), [1, 0, 2, 0]);
  assert.deepEqual(merged[2].links[1].moons, []);
  assert.deepEqual(duplicateGroups(merged).map(entries => entries.map(entry => entry.path)), [[[1, 0, 0], [1, 2, 0]]]);
  const moved = moveMapItem(merged, { kind: 'planet', sun: 1, planet: 2 }, { kind: 'sun', sun: 2 });
  assert.equal(moved.status, 'moved');
  if (moved.status !== 'moved') return;
  const movedMoon = moveMapItem(moved.groups, { kind: 'moon', sun: 1, planet: 0, moon: 0 }, moved.path);
  assert.equal(movedMoon.status, 'moved');
  if (movedMoon.status === 'moved') assert.equal(movedMoon.groups[2].links[2].moons.length, 3);
});
