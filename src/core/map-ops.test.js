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
  changeItemLevel, copyTeamItem, duplicateGroups, exportTeamItem, itemExport, mapItemAt, mergeMaps, sunAdditions, mergeRoutines, moveMapItem, packLink, personalGroups, plainCopy, samePath,
} from './map-ops.js';
import { validItemExport, validRdpPresets } from './schema.js';

const old = oracle();
const plain = value => JSON.parse(JSON.stringify(value));

test('team copies remap nested presets and keep colliding names within the schema limit', () => {
  const name = 'x'.repeat(60);
  const source = [{ id: 'display', name, settings: 'screen mode id:i:2' }];
  const personal = [{ id: 'display', name, settings: 'screen mode id:i:1' }];
  const moon = { type: 'rdp', name: 'Lab', host: 'demo', rdpPreset: 'display' };
  const planet = { ...moon, moons: [moon] };
  const result = copyTeamItem('planet', planet, source, personal);
  assert.equal(result.presets.length, 2);
  assert.deepEqual(validRdpPresets(result.presets), result.presets);
  assert.notEqual(result.item.rdpPreset, 'display');
  assert.equal(result.item.rdpPreset, result.item.moons[0].rdpPreset);
  assert.equal(planet.moons[0].rdpPreset, 'display');
});

test('team exports inline supported presets and retain fallback profiles for omitted settings', () => {
  const fallback = 'full address:s:demo\r\nscreen mode id:i:1\r\n';
  const item = { name: 'Work', id: 'team:work', team: true, links: [
    { type: 'rdp', name: 'Lab', host: 'demo', rdpPreset: 'display', moons: [
      { type: 'rdp', name: 'Large', host: 'demo', rdpPreset: 'large', rdpProfile: fallback },
    ] },
  ] };
  const { data, omitted } = exportTeamItem('sun', item, [
    { id: 'display', name: 'Display', settings: 'screen mode id:i:2' },
    { id: 'large', name: 'Large', settings: 'username:s:' + 'x'.repeat(12000) },
  ]);
  assert.deepEqual(omitted, ['Large']);
  const [link] = validItemExport(data, 'sun').links;
  assert.equal(link.rdpProfile, 'full address:s:demo\r\nscreen mode id:i:2\r\n');
  assert.equal(link.moons[0].rdpProfile, fallback);
  assert.equal(link.moons[0].rdpPreset, undefined);
  assert.equal(item.links[0].rdpPreset, 'display');
});

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

// ---- Changing an item's level (moon <-> planet) ------------------------------
// changeItemLevel is separate from moveMapItem, whose 2.2.1 rules stay exactly
// as they were (a moon onto a sun and a planet onto a planet are still invalid
// there; DD01 and the differential test above check that).

const levelMap = () => [
  { id: 'team:ops', name: 'Ops', description: '', color: '#79d9f8', team: true, links: [
    { name: 'Runbook', url: 'https://runbook.test/', moons: [] }] },
  { id: 'alpha', name: 'Alpha', description: '', color: '#79d9f8', links: [
    { name: 'One', url: 'https://one.test/', moons: [
      { name: 'M1', url: 'https://m1.test/', tags: ['docs'], note: 'first', favorite: true },
      { name: 'Box', type: 'rdp', host: 'box.lab', rdpPreset: 'big' }] },
    { name: 'Two', url: 'https://two.test/', moons: [] },
    { name: 'Three', url: 'https://three.test/', tags: ['x'], moons: [] },
    { name: 'Grp', type: 'group', moons: [{ name: 'G1', url: 'https://g1.test/' }] }] },
  { id: 'beta', name: 'Beta', description: '', color: '#79d9f8', links: [
    { name: 'B1', url: 'https://b1.test/', moons: [] }] },
];

test('changeItemLevel: a moon becomes the last planet of another sun, keeping its fields', () => {
  const map = levelMap();
  const before = JSON.stringify(map);
  const result = changeItemLevel(map, { kind: 'moon', sun: 1, planet: 0, moon: 0 }, { kind: 'sun', sun: 2 });
  assert.equal(result.status, 'moved');
  if (result.status !== 'moved') return;
  assert.deepEqual(result.path, { kind: 'planet', sun: 2, planet: 1 });
  assert.equal(result.total, 2);
  assert.deepEqual(result.groups[2].links[1],
    { name: 'M1', url: 'https://m1.test/', tags: ['docs'], note: 'first', favorite: true, moons: [] });
  assert.deepEqual(result.groups[1].links[0].moons.map(m => m.name), ['Box']);
  assert.equal(JSON.stringify(map), before, 'input unchanged');
});

test('changeItemLevel: a moon can become a planet of its own sun; Remote Desktop fields carry over', () => {
  const result = changeItemLevel(levelMap(), { kind: 'moon', sun: 1, planet: 0, moon: 1 }, { kind: 'sun', sun: 1 });
  assert.equal(result.status, 'moved');
  if (result.status !== 'moved') return;
  assert.deepEqual(result.path, { kind: 'planet', sun: 1, planet: 4 });
  assert.deepEqual(result.groups[1].links[4], { name: 'Box', type: 'rdp', host: 'box.lab', rdpPreset: 'big', moons: [] });
});

test('changeItemLevel: a moonless planet becomes the last moon of a planet, without a moons field', () => {
  const result = changeItemLevel(levelMap(), { kind: 'planet', sun: 1, planet: 2 }, { kind: 'planet', sun: 2, planet: 0 });
  assert.equal(result.status, 'moved');
  if (result.status !== 'moved') return;
  assert.deepEqual(result.path, { kind: 'moon', sun: 2, planet: 0, moon: 0 });
  assert.deepEqual(result.groups[2].links[0].moons, [{ name: 'Three', url: 'https://three.test/', tags: ['x'] }]);
  assert.deepEqual(result.groups[1].links.map(p => p.name), ['One', 'Two', 'Grp']);
});

test('changeItemLevel: in the same sun, a later target planet shifts down by one; an earlier one does not', () => {
  const later = changeItemLevel(levelMap(), { kind: 'planet', sun: 1, planet: 1 }, { kind: 'planet', sun: 1, planet: 2 });
  assert.equal(later.status, 'moved');
  if (later.status === 'moved') {
    assert.deepEqual(later.path, { kind: 'moon', sun: 1, planet: 1, moon: 0 });
    assert.equal(later.groups[1].links[1].name, 'Three');
    assert.deepEqual(later.groups[1].links[1].moons.map(m => m.name), ['Two']);
  }
  const earlier = changeItemLevel(levelMap(), { kind: 'planet', sun: 1, planet: 2 }, { kind: 'planet', sun: 1, planet: 1 });
  assert.equal(earlier.status, 'moved');
  if (earlier.status === 'moved') assert.deepEqual(earlier.path, { kind: 'moon', sun: 1, planet: 1, moon: 0 });
});

test('changeItemLevel: a group planet can receive a moon', () => {
  const result = changeItemLevel(levelMap(), { kind: 'planet', sun: 1, planet: 1 }, { kind: 'planet', sun: 1, planet: 3 });
  assert.equal(result.status, 'moved');
  if (result.status === 'moved') assert.deepEqual(result.groups[1].links[2].moons.map(m => m.name), ['G1', 'Two']);
});

test('changeItemLevel: refusals say why, and never change the input', () => {
  const map = levelMap();
  const before = JSON.stringify(map);
  const reason = (source, target) => {
    const result = changeItemLevel(map, source, target);
    return result.status === 'invalid' ? result.reason : result.status;
  };
  assert.equal(reason({ kind: 'planet', sun: 1, planet: 0 }, { kind: 'planet', sun: 2, planet: 0 }), 'has-moons');
  assert.equal(reason({ kind: 'planet', sun: 1, planet: 3 }, { kind: 'planet', sun: 2, planet: 0 }), 'group');
  assert.equal(reason({ kind: 'moon', sun: 1, planet: 0, moon: 0 }, { kind: 'sun', sun: 0 }), 'team');
  assert.equal(reason({ kind: 'planet', sun: 0, planet: 0 }, { kind: 'planet', sun: 2, planet: 0 }), 'team');
  assert.equal(reason({ kind: 'planet', sun: 1, planet: 1 }, { kind: 'planet', sun: 0, planet: 0 }), 'team');
  assert.equal(reason({ kind: 'planet', sun: 1, planet: 1 }, { kind: 'planet', sun: 1, planet: 1 }), 'self');
  assert.equal(reason({ kind: 'sun', sun: 1 }, { kind: 'planet', sun: 2, planet: 0 }), 'kind');
  assert.equal(reason({ kind: 'moon', sun: 1, planet: 0, moon: 0 }, { kind: 'planet', sun: 2, planet: 0 }), 'kind');
  assert.equal(reason({ kind: 'planet', sun: 1, planet: 1 }, { kind: 'sun', sun: 2 }), 'kind');
  assert.equal(reason({ kind: 'moon', sun: 1, planet: 0, moon: 9 }, { kind: 'sun', sun: 2 }), 'missing');
  assert.equal(reason({ kind: 'moon', sun: 1, planet: 0, moon: 0 }, { kind: 'sun', sun: 9 }), 'missing');
  assert.equal(JSON.stringify(map), before);
});

test('changeItemLevel: moon to planet and back returns the moon to the end of its planet', () => {
  fc.assert(fc.property(validMap, fc.nat(99), fc.nat(99), fc.nat(99), fc.nat(99), (map, s, p, m, t) => {
    const personal = map.map((sun, index) => index).filter(index => !map[index].team);
    const withMoons = personal.flatMap(sunIndex => map[sunIndex].links
      .map((planet, planetIndex) => ({ sunIndex, planetIndex, planet }))
      .filter(({ planet }) => planet.moons.length));
    fc.pre(withMoons.length > 0);
    const { sunIndex, planetIndex, planet } = withMoons[s % withMoons.length];
    const moonIndex = m % planet.moons.length;
    const target = personal[t % personal.length];
    const before = JSON.stringify(map);
    const out = changeItemLevel(map, { kind: 'moon', sun: sunIndex, planet: planetIndex, moon: moonIndex }, { kind: 'sun', sun: target });
    assert.equal(out.status, 'moved');
    if (out.status !== 'moved') return;
    const back = changeItemLevel(out.groups, out.path, { kind: 'planet', sun: sunIndex, planet: planetIndex });
    assert.equal(back.status, 'moved');
    if (back.status !== 'moved') return;
    const expected = JSON.parse(before);
    const [moon] = expected[sunIndex].links[planetIndex].moons.splice(moonIndex, 1);
    expected[sunIndex].links[planetIndex].moons.push(moon);
    assert.deepEqual(back.groups, expected);
    assert.equal(JSON.stringify(map), before, 'input unchanged');
  }), { numRuns: 300 });
});

test('imported RDP preset references follow merged ids rather than colliding local ids', async () => {
  const { rebindImportedPresets, mergeRoutines } = await import('./map-ops.js');
  const local = [{ id: 'shared', name: 'Local', settings: 'screen mode id:i:1' }];
  const incoming = [{ id: 'shared', name: 'Imported', settings: 'screen mode id:i:2' }];
  const groups = [{ id: 'work', name: 'Work', color: '#123456', description: '', links: [
    { name: 'Host', type: 'rdp', host: 'host', rdpPreset: 'shared', moons: [
      { name: 'Moon', type: 'rdp', host: 'moon', rdpPreset: 'shared' }
    ] }
  ] }];
  const before = JSON.stringify(groups);
  const merged = mergeRoutines(local, incoming);
  const result = rebindImportedPresets(groups, incoming, merged);
  assert.equal(result[0].links[0].rdpPreset, merged[1].id);
  assert.equal(result[0].links[0].moons[0].rdpPreset, merged[1].id);
  assert.equal(rebindImportedPresets(groups, incoming, local)[0].links[0].rdpPreset, undefined);
  assert.equal(rebindImportedPresets(groups, incoming, [{ ...incoming[0], id: 'existing' }])[0].links[0].rdpPreset, 'existing');
  assert.equal(JSON.stringify(groups), before);
});
