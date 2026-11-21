// core/schema.js: the one place that decides what a valid map, sun, link,
// routine, preset, link pack, and single-item export are (tests/behavior-2.2.md,
// "Map validation", V01-V09 and V11, and "Link packs").
//
// The differential tests at the end are the safety net: for random valid and
// invalid input, the new code must give 2.2.1's result or 2.2.1's error message
// (REWRITE_PLAN.md, "Differential test against 2.2.0").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { oracle } from '../../tests/oracle/oracle.mjs';
import { rawDestination, rawMap, rawPreset, rawRoutine, runs, validMap as validMapArb } from '../../tests/unit/arbitraries.mjs';
import {
  uniqueSunId, validDestination, validItemExport, validPack, validRdpPresets, validRoutines, validTags, validateMap,
} from './schema.js';

const old = oracle();
const web = (name, url, extra = {}) => ({ name, url, ...extra });
const sun = (name, links, extra = {}) => ({ name, links, ...extra });
const outcome = body => {
  try {
    return JSON.parse(JSON.stringify(body()));
  } catch (error) {
    return { error: error.message };
  }
};

test('V01 unknown fields are dropped at every level', () => {
  const map = validateMap({
    groups: [sun('A', [{ ...web('P', 'https://a.test/'), extra: 1, type: 'web', team: true,
      moons: [{ ...web('M', 'https://m.test/'), moons: [web('MM', 'https://mm.test/')], extra: 2 }] }],
    { id: 'a', team: true, extra: 3 })],
    routines: [{ name: 'R', links: [{ key: 'k', name: 'n', extra: 4 }], extra: 5 }],
    rdpPresets: [{ name: 'P', settings: 'session bpp:i:32', extra: 6 }],
    extra: 7,
  });
  assert.deepEqual(Object.keys(map), ['groups', 'routines', 'rdpPresets']);
  assert.deepEqual(Object.keys(map.groups[0]), ['id', 'name', 'description', 'color', 'links']);
  assert.deepEqual(map.groups[0].links[0], { name: 'P', url: 'https://a.test/', moons: [{ name: 'M', url: 'https://m.test/' }] });
  assert.deepEqual(map.routines?.[0], { id: 'r', name: 'R', links: [{ key: 'k', name: 'n' }] });
  assert.deepEqual(map.rdpPresets?.[0], { id: 'p', name: 'P', settings: 'session bpp:i:32' });
});

test('V02 empty optional fields are dropped; description and moons are always written', () => {
  const map = validateMap({
    groups: [sun('A', [
      web('P1', 'https://a.test/', { tags: [], favorite: 'yes', note: '   ', rdpPreset: '' }),
      web('P2', 'https://b.test/', { tags: '', favorite: false }),
      web('P3', 'https://c.test/', { favorite: true, note: ' kept ', tags: ['Ops', 'ops'] }),
      { name: 'R1', type: 'rdp', host: 'lab1', rdpPreset: 'missing' },
    ], { icon: '' })],
    routines: [], rdpPresets: [],
  });
  assert.deepEqual(Object.keys(map), ['groups']);
  const [p1, p2, p3, r1] = map.groups[0].links;
  assert.deepEqual(p1, { name: 'P1', url: 'https://a.test/', moons: [] });
  assert.deepEqual(p2, { name: 'P2', url: 'https://b.test/', moons: [] });
  assert.deepEqual(p3, { name: 'P3', url: 'https://c.test/', tags: ['ops'], favorite: true, note: 'kept', moons: [] });
  assert.deepEqual(r1, { name: 'R1', type: 'rdp', host: 'lab1', moons: [] });
  assert.equal(map.groups[0].description, '');
  assert.equal('icon' in map.groups[0], false);
});

test('V03 color defaults only when missing; null or empty is an error', () => {
  assert.equal(validateMap({ groups: [sun('A', [])] }).groups[0].color, '#79d9f8');
  assert.throws(() => validateMap({ groups: [sun('A', [], { color: null })] }), { message: 'A needs a six-digit hex color.' });
  assert.throws(() => validateMap({ groups: [sun('A', [], { color: '' })] }), { message: 'A needs a six-digit hex color.' });
});

test('V04 sun ids come from names in order; a later explicit id that clashes is an error', () => {
  const ids = validateMap({ groups: [sun('My Sun!', []), sun('my sun', []), sun('***', [])] }).groups.map(s => s.id);
  assert.deepEqual(ids, ['my-sun', 'my-sun-2', 'sun']);
  assert.throws(() => validateMap({ groups: [sun('My Sun', []), sun('Other', [], { id: 'my-sun' })] }), { message: 'Duplicate sun ID: my-sun' });
  assert.throws(() => validateMap({ groups: [sun('   ', [])] }), { message: 'Sun 1 needs a name.' });
  assert.equal(uniqueSunId('Café Menu', new Set(['caf-menu'])), 'caf-menu-2');
});

test('V05 Remote Desktop hosts are trimmed and normalized', () => {
  const host = h => validateMap({ groups: [sun('A', [{ name: 'R', type: 'rdp', host: h }])] }).groups[0].links[0].host;
  assert.equal(host('Lab1:03389'), 'Lab1:3389');
  assert.equal(host(' lab1 '), 'lab1');
  assert.throws(() => host('bad_host'), { message: 'Planet 1 in A needs a computer name or IP address, with an optional port.' });
});

test('V06 duplicates: routine and preset ids are regenerated; routine link keys and tags deduplicated', () => {
  const map = validateMap({
    groups: [sun('A', [web('P', 'https://a.test/', { tags: ['x', 'X', 'x '] })])],
    routines: [{ id: 'same', name: 'One', links: [{ key: 'k' }, { key: 'k' }, { key: 'j' }] }, { id: 'same', name: 'Two', links: [{ key: 'k' }] }],
    rdpPresets: [{ id: 'p', name: 'First', settings: '' }, { id: 'p', name: 'Second', settings: '' }],
  });
  assert.deepEqual(map.routines?.map(r => r.id), ['same', 'two']);
  assert.deepEqual(map.routines?.[0].links.map(l => l.key), ['k', 'j']);
  assert.deepEqual(map.rdpPresets?.map(p => p.id), ['p', 'second']);
  assert.deepEqual(map.groups[0].links[0].tags, ['x']);
  assert.throws(() => validateMap({ groups: [], routines: [{ name: 'R', links: [] }, { name: 'r', links: [] }] }), { message: 'There is already a routine named r.' });
  assert.throws(() => validateMap({ groups: [], rdpPresets: [{ name: 'P' }, { name: 'p' }] }), { message: 'There is already a preset named p.' });
});

test('V07 limits', () => {
  const one = extra => validateMap({ groups: [sun('A', [web('P', 'https://a.test/', extra)])] });
  one({ note: 'n'.repeat(500) });
  assert.throws(() => one({ note: 'n'.repeat(501) }), { message: 'Planet 1 in A has a note longer than 500 characters.' });
  one({ tags: Array.from({ length: 8 }, (_, i) => `t${i}`) });
  assert.throws(() => one({ tags: Array.from({ length: 9 }, (_, i) => `t${i}`) }), { message: 'Planet 1 in A can have at most 8 tags.' });
  assert.throws(() => validTags(['a'.repeat(25)], 'L'), { message: `L has an invalid tag “${'a'.repeat(25)}”. Use up to 24 letters, digits, spaces, or hyphens.` });
  assert.throws(() => validateMap({ groups: [sun('A', [web('P', 'https://a.test/{a}/{b}/{c}/{d}/{e}/{f}')])] }), { message: 'Planet 1 in A can have at most five {placeholders}.' });
  const routine = extra => validRoutines([{ name: 'R', links: [{ key: 'k' }], ...extra }])[0];
  assert.throws(() => routine({ name: 'r'.repeat(61) }), { message: 'Routine 1 needs a name of up to 60 characters.' });
  assert.equal(routine({ links: [{ key: 'k', name: 'n'.repeat(250) }] }).links[0].name.length, 200);
  routine({ links: [...Array.from({ length: 100 }, (_, i) => ({ key: `k${i}` })), { key: 'k0' }] });
  assert.throws(() => routine({ links: Array.from({ length: 101 }, (_, i) => ({ key: `k${i}` })) }), { message: 'R can have at most 100 links.' });
  assert.throws(() => validRdpPresets([{ name: 'p'.repeat(61) }]), { message: 'Remote Desktop preset 1 needs a name of up to 60 characters.' });
  validateMap({ groups: Array.from({ length: 50 }, (_, s) => sun(`S${s}`, Array.from({ length: 50 }, (_, p) => web(`P${p}`, `https://s${s}.test/${p}`)))) });
});

test('V08 profiles in a map are cleaned for the link\'s own computer; null and "" fail differently', () => {
  const rdp = profile => validateMap({ groups: [sun('A', [{ name: 'R', type: 'rdp', host: 'lab1', rdpProfile: profile }])] }).groups[0].links[0];
  assert.equal(rdp('full address:s:other\npassword 51:b:00\nsession bpp:i:32\n').rdpProfile, 'full address:s:lab1\r\nsession bpp:i:32\r\n');
  assert.throws(() => rdp(null), { message: 'The .rdp file is not valid text.' });
  assert.throws(() => rdp(''), { message: 'The .rdp file needs a full address setting.' });
});

test('V09 routine schedules', () => {
  const routine = schedule => validRoutines([{ name: 'R', links: [{ key: 'k' }], schedule }])[0];
  assert.deepEqual(routine({ time: '08:00', days: [5, '1', 1] }).schedule, { time: '08:00', days: [1, 5] });
  assert.throws(() => routine({ time: '8:00', days: [1] }), { message: 'R needs a time such as 08:00.' });
  assert.throws(() => routine({ time: '08:00', days: [] }), { message: 'R needs at least one day for its schedule.' });
  assert.throws(() => routine({ time: '08:00', days: '1,2' }), TypeError, 'a string of days throws a raw TypeError, as in 2.2.1');
});

test('V11 web addresses: http and https only, no credentials, placeholders checked with sample values', () => {
  assert.equal(validDestination(web('P', ' https://a.test/{ticket} '), 'L').url, 'https://a.test/{ticket}');
  for (const bad of ['ftp://a.test/', 'https://user:pw@a.test/', 'https://a.test/{', 'javascript:alert(1)', 'a.test']) {
    assert.throws(() => validDestination(web('P', bad), 'Planet 1 in A'), { message: 'Planet 1 in A needs an http or https URL.' });
  }
  assert.throws(() => validDestination({ name: 'P', type: 'ftp' }, 'L'), { message: 'L has an unsupported destination type.' });
  assert.throws(() => validDestination(null, 'L'), { message: 'L needs a name and destination.' });
  assert.throws(() => validDestination({ url: 'https://a.test/' }, 'L'), { message: 'L needs a name.' });
});

test('the map needs a groups array', () => {
  for (const bad of [null, undefined, {}, { groups: 'x' }, []]) {
    assert.throws(() => validateMap(bad), { message: 'The link map needs a "groups" array.' });
  }
});

test('link packs: format, a name of up to 60 characters, at least one valid link, an optional routine', () => {
  const pack = validPack({ format: 'orbit-pack-v1', name: ' Shared ', links: [{ ...web('A', 'https://a.test/'), favorite: true, moons: [] }],
    routine: { name: '', schedule: { time: '08:00', days: [1] } } });
  assert.deepEqual(pack, { name: 'Shared', links: [{ name: 'A', url: 'https://a.test/', favorite: true }],
    routine: { name: 'Shared', schedule: { time: '08:00', days: [1] } } });
  assert.equal(validPack({ format: 'orbit-pack-v1', links: [web('A', 'https://a.test/')] }).name, 'Shared links');
  assert.equal(validPack({ format: 'orbit-pack-v1', links: [web('A', 'https://a.test/')] }).routine, null);
  assert.throws(() => validPack({ format: 'orbit-pack-v2', links: [] }), { message: 'This is not an Orbit link pack.' });
  assert.throws(() => validPack({ format: 'orbit-pack-v1', links: [] }), { message: 'The pack has no links.' });
  assert.throws(() => validPack({ format: 'orbit-pack-v1', links: [web('A', 'ftp://a')] }), { message: 'Link 1 in the pack needs an http or https URL.' });
});

test('single-item exports (orbit-item-v1) are checked for format and kind, then validated as that kind', () => {
  const planet = { name: 'P', url: 'https://a.test/', moons: [web('M', 'https://m.test/')] };
  assert.deepEqual(validItemExport({ format: 'orbit-item-v1', kind: 'planet', item: planet }, 'planet'),
    { name: 'P', url: 'https://a.test/', moons: [{ name: 'M', url: 'https://m.test/' }] });
  assert.deepEqual(validItemExport({ format: 'orbit-item-v1', kind: 'planet', item: planet }, 'sun', 'planet'),
    { id: 'p', name: 'P', description: '', color: '#79d9f8', links: [{ name: 'P', url: 'https://a.test/', moons: [{ name: 'M', url: 'https://m.test/' }] }] });
  assert.deepEqual(validItemExport({ format: 'orbit-item-v1', kind: 'moon', item: web('M', 'https://m.test/') }, 'moon'), { name: 'M', url: 'https://m.test/' });
  assert.equal(validItemExport({ format: 'orbit-item-v1', kind: 'sun', item: sun('S', [], { id: 'mine' }) }, 'sun').id, 'mine');
  assert.throws(() => validItemExport({ format: 'orbit-item-v1', kind: 'moon', item: {} }, 'planet'), { message: 'Choose an Orbit planet export file.' });
  assert.throws(() => validItemExport({ format: 'orbit-item-v1', kind: 'planet' }, 'planet'), { message: 'Choose an Orbit planet export file.' });
  assert.throws(() => validItemExport(null, 'sun'), { message: 'Choose an Orbit sun export file.' });
});

// ---- Differential: 2.2.1's result or 2.2.1's error message -------------

test('validateMap matches 2.2.1 on random valid and invalid maps', () => {
  fc.assert(fc.property(rawMap, data => {
    assert.deepEqual(outcome(() => validateMap(data)), old.call('validateMap', data));
  }), runs(2000));
});

test('validDestination matches 2.2.1 on random planets and moons', () => {
  fc.assert(fc.property(rawDestination, value => {
    assert.deepEqual(outcome(() => validDestination(value, 'Moon 2 around X')), old.call('validDestination', value, 'Moon 2 around X'));
  }), runs(2000));
});

test('validRoutines and validRdpPresets match 2.2.1', () => {
  fc.assert(fc.property(fc.array(rawRoutine, { maxLength: 4 }), fc.array(rawPreset, { maxLength: 4 }), (list, presets) => {
    assert.deepEqual(outcome(() => validRoutines(list)), old.call('validRoutines', list));
    assert.deepEqual(outcome(() => validRdpPresets(presets)), old.call('validRdpPresets', presets));
  }), runs(1000));
});

test('validPack matches 2.2.1', () => {
  const pack = fc.record({
    format: fc.constantFrom('orbit-pack-v1', 'orbit-pack-v1', 'other', undefined),
    name: fc.constantFrom(undefined, '', ' Shared ', 'n'.repeat(70), 7),
    links: fc.oneof(fc.array(rawDestination, { maxLength: 3 }), fc.constantFrom(undefined, 'x')),
    routine: fc.constantFrom(undefined, null, {}, { name: ' R ' }, { name: 'r'.repeat(70), schedule: { time: 'x' } }, { schedule: { time: '08:00', days: [1] } }),
  }, { requiredKeys: [] });
  fc.assert(fc.property(fc.oneof(pack, fc.constantFrom(null, 'x')), data => {
    assert.deepEqual(outcome(() => validPack(data)), old.call('validPack', data));
  }), runs(1000));
});

test('validation is idempotent: validating a saved map again changes nothing', () => {
  fc.assert(fc.property(rawMap, data => {
    let first;
    try {
      first = validateMap(data);
    } catch {
      return;
    }
    const again = validateMap(JSON.parse(JSON.stringify(first)));
    assert.deepEqual(again, JSON.parse(JSON.stringify(first)));
  }), runs(1000));
  fc.assert(fc.property(validMapArb, groups => {
    assert.deepEqual(validateMap({ groups }), { groups });
  }), runs(300));
});

// ---- Data compatibility (node): the 2.2.1 storage fixture --------------

test('every stored map in the 2.2.1 fixture validates exactly as 2.2.1 validates it', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../tests/fixtures/v2.2-storage.json', import.meta.url), 'utf8'));
  const maps = Object.entries(fixture.storage).filter(([key]) => key.startsWith('orbit:map:v1'));
  assert.ok(maps.length >= 3, 'Main, Home, and Broken');
  for (const [key, text] of maps) {
    const data = JSON.parse(text);
    assert.deepEqual(outcome(() => validateMap(data)), old.call('validateMap', data), key);
  }
  const history = Object.entries(fixture.storage).filter(([key]) => key.startsWith('orbit:history:v1'));
  for (const [key, text] of history) {
    for (const entry of JSON.parse(text)) {
      const data = { groups: entry.groups, routines: entry.routines, rdpPresets: entry.rdpPresets };
      assert.deepEqual(outcome(() => validateMap(data)), old.call('validateMap', data), key);
    }
  }
  for (const data of [fixture.links, fixture.team].filter(Boolean)) {
    assert.deepEqual(outcome(() => validateMap(data)), old.call('validateMap', data));
  }
});
