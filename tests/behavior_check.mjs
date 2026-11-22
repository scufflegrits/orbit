// Executable form of tests/behavior-2.2.md: runs Orbit 2.2.1's own pure
// functions (read from the git tag, so later edits can't change the baseline)
// and checks every rule the behavior inventory records.
//
//   node tests/behavior_check.mjs            # against tag v2.2.1
//   node tests/behavior_check.mjs --ref HEAD # against another ref
//
// Each check prints its inventory ID. Exit code 1 if any check fails.
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const refIndex = process.argv.indexOf('--ref');
const REF = refIndex > 0 ? process.argv[refIndex + 1] : 'v2.2.1';
const source = file => execFileSync('git', ['show', `${REF}:${file}`], { encoding: 'utf8' });

// Pull top-level `function name(...) {...}` and `const NAME = ...;` declarations out of a classic script.
function extract(file, names) {
  const text = source(file);
  return names.map(name => {
    const fn = new RegExp(`^(?:async )?function ${name}\\(.*?^}$`, 'ms').exec(text);
    if (fn) return fn[0];
    const constant = new RegExp(`^const ${name} = .*?;$`, 'ms').exec(text);
    if (constant) return constant[0];
    throw new Error(`${file}: ${name} not found at ${REF}`);
  }).join('\n\n');
}

// A sandbox with the browser pieces these functions touch.
const store = new Map();
const context = vm.createContext({
  URL, TextEncoder, TextDecoder, Intl, console,
  localStorage: {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
  },
});
const code = [
  source('rdp.js'),
  source('storage.js'),
  extract('team.js', ['plainCopy']),
  extract('render.js', ['editDistance', 'SHORT_FORM', 'wordQuality', 'searchWords', 'addressText', 'searchEntries', 'findMatches']),
  extract('drag.js', ['mapItemAt', 'samePath', 'moveMapItem']),
  extract('tools.js', ['mergeMaps']),
  extract('routines.js', ['mergeRoutines']),
  extract('favorites.js', ['pathsForKey', 'itemAt']),
  // Shared state the functions read, as app.js declares it.
  `var groups = []; var routines = []; var rdpPresets = []; var storageWarning = '';
   var MAP_STORAGE_KEY = 'orbit:map:v1'; var HISTORY_STORAGE_KEY = 'orbit:history:v1';`,
].join('\n\n');
vm.runInContext(code, context, { filename: `orbit@${REF}` });
const run = expression => vm.runInContext(expression, context);
const fn = name => run(name);

let failed = 0;
let passed = 0;
function check(id, description, body) {
  try {
    body();
    passed++;
    console.log(`PASS ${id} ${description}`);
  } catch (error) {
    failed++;
    console.log(`FAIL ${id} ${description}\n     ${error.message.split('\n').join('\n     ')}`);
  }
}
const plain = value => JSON.parse(JSON.stringify(value));
const validateMap = data => plain(fn('validateMap')(data));
const throwsWith = (body, pattern) => assert.throws(body, error => pattern.test(error.message), `expected an error matching ${pattern}`);
const web = (name, url, extra = {}) => ({ name, url, ...extra });
const sun = (name, links, extra = {}) => ({ name, links, ...extra });

// ---- V: map validation (storage.js validateMap and helpers) ----------------------

check('V01', 'unknown fields are dropped at every level', () => {
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
  assert.deepEqual(map.routines[0], { id: 'r', name: 'R', links: [{ key: 'k', name: 'n' }] });
  assert.deepEqual(map.rdpPresets[0], { id: 'p', name: 'P', settings: 'session bpp:i:32' });
});

check('V02', 'empty optional fields are dropped; description and moons are always written', () => {
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

check('V03', 'color defaults only when missing; null or empty is an error', () => {
  assert.equal(validateMap({ groups: [sun('A', [])] }).groups[0].color, '#79d9f8');
  throwsWith(() => validateMap({ groups: [sun('A', [], { color: null })] }), /^A needs a six-digit hex color\.$/);
  throwsWith(() => validateMap({ groups: [sun('A', [], { color: '' })] }), /^A needs a six-digit hex color\.$/);
});

check('V04', 'sun ids come from names in order; a later explicit id that clashes is an error', () => {
  const ids = validateMap({ groups: [sun('My Sun!', []), sun('my sun', []), sun('', [], { name: '***' })] }).groups.map(s => s.id);
  assert.deepEqual(ids, ['my-sun', 'my-sun-2', 'sun']);
  throwsWith(() => validateMap({ groups: [sun('My Sun', []), sun('Other', [], { id: 'my-sun' })] }), /^Duplicate sun ID: my-sun$/);
  throwsWith(() => validateMap({ groups: [sun('   ', [])] }), /^Sun 1 needs a name\.$/);
});

check('V05', 'Remote Desktop hosts: ports are normalized and range-checked; case is kept', () => {
  const host = h => validateMap({ groups: [sun('A', [{ name: 'R', type: 'rdp', host: h }])] }).groups[0].links[0].host;
  assert.equal(host('Lab1:03389'), 'Lab1:3389');
  assert.equal(host(' lab1 '), 'lab1');
  throwsWith(() => host('lab1:0'), /needs a computer name or IP address, with an optional port\.$/);
  throwsWith(() => host('lab1:70000'), /needs a computer name or IP address/);
  throwsWith(() => host('bad_host'), /needs a computer name or IP address/);
});

check('V06', 'duplicates: routine and preset ids are regenerated; routine link keys and tags deduplicated', () => {
  const map = validateMap({
    groups: [sun('A', [web('P', 'https://a.test/', { tags: ['x', 'X', 'x '] })])],
    routines: [{ id: 'same', name: 'One', links: [{ key: 'k' }, { key: 'k' }, { key: 'j' }] }, { id: 'same', name: 'Two', links: [{ key: 'k' }] }],
    rdpPresets: [{ id: 'p', name: 'First', settings: '' }, { id: 'p', name: 'Second', settings: '' }],
  });
  assert.deepEqual(map.routines.map(r => r.id), ['same', 'two']);
  assert.deepEqual(map.routines[0].links.map(l => l.key), ['k', 'j']);
  assert.deepEqual(map.rdpPresets.map(p => p.id), ['p', 'second']);
  assert.deepEqual(map.groups[0].links[0].tags, ['x']);
  throwsWith(() => validateMap({ groups: [], routines: [{ name: 'R', links: [] }, { name: 'r', links: [] }] }), /^There is already a routine named r\.$/);
  throwsWith(() => validateMap({ groups: [], rdpPresets: [{ name: 'P' }, { name: 'p' }] }), /^There is already a preset named p\.$/);
});

check('V07', 'limits', () => {
  const one = extra => validateMap({ groups: [sun('A', [web('P', 'https://a.test/', extra)])] });
  one({ note: 'n'.repeat(500) });
  throwsWith(() => one({ note: 'n'.repeat(501) }), /has a note longer than 500 characters\.$/);
  one({ tags: Array.from({ length: 8 }, (_, i) => `t${i}`) });
  throwsWith(() => one({ tags: Array.from({ length: 9 }, (_, i) => `t${i}`) }), /can have at most 8 tags\.$/);
  throwsWith(() => one({ tags: ['a'.repeat(25)] }), /has an invalid tag/);
  throwsWith(() => validateMap({ groups: [sun('A', [web('P', 'https://a.test/{a}/{b}/{c}/{d}/{e}/{f}')])] }), /can have at most five \{placeholders\}\.$/);
  const routine = extra => validateMap({ groups: [], routines: [{ name: 'R', links: [{ key: 'k' }], ...extra }] }).routines[0];
  throwsWith(() => routine({ name: 'r'.repeat(61) }), /^Routine 1 needs a name of up to 60 characters\.$/);
  assert.equal(routine({ links: [{ key: 'k', name: 'n'.repeat(250) }] }).links[0].name.length, 200);
  routine({ links: [...Array.from({ length: 100 }, (_, i) => ({ key: `k${i}` })), { key: 'k0' }] });
  throwsWith(() => routine({ links: Array.from({ length: 101 }, (_, i) => ({ key: `k${i}` })) }), /^R can have at most 100 links\.$/);
  throwsWith(() => validateMap({ groups: [], rdpPresets: [{ name: 'P', settings: Array.from({ length: 101 }, (_, i) => `k${i}:i:1`).join('\n') }] }), /^P has too many settings\.$/);
  throwsWith(() => validateMap({ groups: [], rdpPresets: [{ name: 'p'.repeat(61) }] }), /^Remote Desktop preset 1 needs a name of up to 60 characters\.$/);
  // No limit on map size: a large map validates.
  validateMap({ groups: Array.from({ length: 50 }, (_, s) => sun(`S${s}`, Array.from({ length: 50 }, (_, p) => web(`P${p}`, `https://s${s}.test/${p}`)))) });
});

check('V08', 'Remote Desktop settings: presets refuse secrets, profiles strip them', () => {
  throwsWith(() => validateMap({ groups: [], rdpPresets: [{ name: 'P', settings: 'password 51:b:00' }] }), /^P cannot keep password 51; Orbit never stores credentials\.$/);
  const preset = validateMap({ groups: [], rdpPresets: [{ name: 'P', settings: 'a:i:1\n   \nfull address:s:x\nb:i:2' }] }).rdpPresets[0];
  assert.equal(preset.settings, 'a:i:1\r\nb:i:2');
  const rdp = profile => validateMap({ groups: [sun('A', [{ name: 'R', type: 'rdp', host: 'lab1', rdpProfile: profile }])] }).groups[0].links[0];
  assert.equal(rdp('full address:s:other\npassword 51:b:00\nsession bpp:i:32\n').rdpProfile, 'full address:s:lab1\r\nsession bpp:i:32\r\n');
  throwsWith(() => rdp('full address:s:lab1\n   \n'), /^The \.rdp file has an invalid setting line\.$/);
  throwsWith(() => rdp(null), /^The \.rdp file is not valid text\.$/);
  throwsWith(() => rdp(''), /^The \.rdp file needs a full address setting\.$/);
  throwsWith(() => rdp(`full address:s:lab1\n${'x:s:' + 'y'.repeat(12000)}\n`), /^The \.rdp file is too large to launch through Orbit\.$/);
});

check('V09', 'routine schedules', () => {
  const routine = schedule => validateMap({ groups: [], routines: [{ name: 'R', links: [{ key: 'k' }], schedule }] }).routines[0];
  assert.deepEqual(routine({ time: '08:00', days: [5, '1', 1] }).schedule, { time: '08:00', days: [1, 5] });
  throwsWith(() => routine({ time: '8:00', days: [1] }), /^R needs a time such as 08:00\.$/);
  throwsWith(() => routine({ time: '08:00', days: [] }), /^R needs at least one day for its schedule\.$/);
  // The sandbox has its own TypeError class, so compare by name, not instanceof.
  assert.throws(() => routine({ time: '08:00', days: '1,2' }), error => error.name === 'TypeError' && /map is not a function/.test(error.message),
    'a string of days throws a raw TypeError');
});

check('V10', 'a saved map that fails validation loads as nothing, with a warning', () => {
  store.set('orbit:map:v1', JSON.stringify({ groups: [sun('A', [], { color: null })] }));
  assert.equal(fn('loadBrowserMap')(), null);
  assert.equal(run('storageWarning'), 'Saved browser data could not be loaded: A needs a six-digit hex color.');
  store.set('orbit:map:v1', '{not json');
  assert.equal(fn('loadBrowserMap')(), null);
  assert.match(run('storageWarning'), /^Saved browser data could not be loaded: /);
  store.clear();
  run("storageWarning = ''");
  assert.equal(fn('loadBrowserMap')(), null, 'no saved map is also null, without a warning');
  assert.equal(run('storageWarning'), '');
});

check('V11', 'web addresses: http and https only, no credentials, placeholders checked with sample values', () => {
  const url = u => validateMap({ groups: [sun('A', [web('P', u)])] }).groups[0].links[0].url;
  assert.equal(url(' https://a.test/{ticket} '), 'https://a.test/{ticket}');
  for (const bad of ['ftp://a.test/', 'https://user:pw@a.test/', 'https://a.test/{', 'javascript:alert(1)', 'a.test']) {
    throwsWith(() => url(bad), /^Planet 1 in A needs an http or https URL\.$/);
  }
});

// ---- D: destination keys and templates ---------------------------------------------

check('D01', 'destinationKey normalization', () => {
  const key = url => fn('destinationKey')({ url });
  assert.equal(key('https://A.Test/Path//#frag'), 'https://a.test/Path');
  assert.equal(key('https://a.test/'), 'https://a.test');
  assert.equal(key('https://a.test/?b=1&a=2'), 'https://a.test?b=1&a=2');
  assert.notEqual(key('http://a.test/'), key('https://a.test/'));
  assert.notEqual(key('https://www.a.test/'), key('https://a.test/'));
  assert.notEqual(key('https://a.test/x?b=1&a=2'), key('https://a.test/x?a=2&b=1'));
  assert.equal(key('https://a.test/{t}/?q={x}'), 'https://a.test/%7Bt%7D?q={x}', 'braces are encoded in the path only');
  assert.equal(key('not a url'), 'url:not a url');
  assert.equal(fn('destinationKey')({ type: 'rdp', host: 'Lab1:3389' }), 'rdp:lab1:3389');
  assert.notEqual(fn('destinationKey')({ type: 'rdp', host: 'lab1' }), fn('destinationKey')({ type: 'rdp', host: 'lab1:3389' }));
});

check('D02', 'templates: names deduplicated in order, values encoded, missing values empty', () => {
  assert.deepEqual(plain(fn('templateNames')('https://a.test/{b}/{a}/{b}?x={c-1}')), ['b', 'a', 'c-1']);
  assert.equal(fn('fillTemplate')('https://a.test/{t}?q={q}', { t: 'a b/c' }), 'https://a.test/a%20b%2Fc?q=');
});

// ---- S: Quick find (render.js findMatches) -----------------------------------------

run(`groups = [
  { id: 'team:ops', team: true, name: 'Ops', links: [{ name: 'Status board', url: 'https://status.test/', moons: [] }] },
  { id: 'news', name: 'Tech news', links: [
    { name: 'The Verge', url: 'https://www.theverge.com/', tags: ['daily'], moons: [
      { name: 'Reviews', url: 'https://www.theverge.com/reviews', moons: [] }] },
    { name: 'Jira', url: 'https://jira.example.test/browse', note: 'sprint board', moons: [] }] },
  { id: 'labs', name: 'Labs', links: [{ name: 'lab1', type: 'rdp', host: 'lab1', moons: [] }] }]`);
const find = query => plain(fn('findMatches')(query)).map(match => `${match.kind}:${match.name}`);

check('S01', 'every word must match somewhere', () => {
  assert.deepEqual(find('verge reviews'), ['Moon:Reviews']);
  assert.deepEqual(find('verge nothing'), []);
});

check('S02', 'names match any part; other fields need 3+ characters', () => {
  assert.ok(find('ve').includes('Planet:The Verge'), 'two letters inside a name');
  assert.ok(find('verge.com').includes('Planet:The Verge'), 'a dotted address');
  assert.deepEqual(find('xample'), ['Planet:Jira'], 'part of an address, 3+ characters');
});

check('S03', 'typos are tolerated only for words that match nothing exactly', () => {
  assert.ok(find('vegre').includes('Planet:The Verge'), 'a swapped pair of letters, 5+ characters');
  assert.deepEqual(find('vrg'), [], 'too short for typo matching');
  assert.ok(!find('reviews').includes('Planet:The Verge') || find('reviews')[0] === 'Moon:Reviews', 'an exact word wins');
});

check('S04', '#tag and tag: filter; a sun name alone does not list its contents', () => {
  assert.deepEqual(find('#daily'), ['Planet:The Verge']);
  assert.deepEqual(find('tag:daily'), ['Planet:The Verge']);
  assert.deepEqual(find('tech'), ['Sun:Tech news'], 'a path match only narrows');
  assert.deepEqual(find('tech jira'), ['Planet:Jira']);
  assert.deepEqual(find('sprint'), ['Planet:Jira'], 'notes are searched');
});

// ---- M: map operations ---------------------------------------------------------------

const mapForMoves = () => plain(run('groups'));
check('M01', 'moveMapItem returns a fresh copy and never changes its input', () => {
  const before = mapForMoves();
  const result = plain(fn('moveMapItem')(before, { kind: 'planet', sun: 1, planet: 1 }, { kind: 'planet', sun: 1, planet: 0, place: 'before' }));
  assert.equal(result.status, 'moved');
  assert.deepEqual(result.path, { kind: 'planet', sun: 1, planet: 0 });
  assert.deepEqual(result.groups[1].links.map(p => p.name), ['Jira', 'The Verge']);
  assert.deepEqual(before, mapForMoves(), 'input unchanged');
  // Moving it back with the returned path restores the original.
  const back = plain(fn('moveMapItem')(result.groups, result.path, { kind: 'planet', sun: 1, planet: 1, place: 'after' }));
  assert.deepEqual(back.groups, before);
});

check('M02', 'moveMapItem: same place, invalid targets, and the team map', () => {
  const map = mapForMoves();
  const move = (source, target) => plain(fn('moveMapItem')(map, source, target)).status;
  assert.equal(move({ kind: 'planet', sun: 1, planet: 0 }, { kind: 'planet', sun: 1, planet: 1, place: 'before' }), 'same');
  assert.equal(move({ kind: 'planet', sun: 1, planet: 0 }, { kind: 'sun', sun: 1 }), 'same', 'onto its own sun');
  assert.equal(move({ kind: 'planet', sun: 1, planet: 0 }, { kind: 'planet', sun: 1, planet: 0, place: 'after' }), 'invalid', 'onto itself');
  assert.equal(move({ kind: 'planet', sun: 1, planet: 0 }, { kind: 'sun', sun: 0 }), 'invalid', 'into a team sun');
  assert.equal(move({ kind: 'planet', sun: 0, planet: 0 }, { kind: 'sun', sun: 2 }), 'invalid', 'out of a team sun');
  assert.equal(move({ kind: 'sun', sun: 2 }, { kind: 'planet', sun: 1, planet: 0 }), 'invalid', 'a sun under a planet');
  assert.equal(move({ kind: 'planet', sun: 1, planet: 9 }, { kind: 'sun', sun: 2 }), 'invalid', 'a missing source');
});

check('M03', 'mergeMaps adds only what is new, matching suns by id then name', () => {
  const personal = [{ id: 'a', name: 'Alpha', links: [
    { name: 'P', url: 'https://p.test/', moons: [{ name: 'M1', url: 'https://m1.test/' }] },
    { name: 'P again', url: 'https://p.test/', moons: [] }] }];
  const incoming = [
    { id: 'other-id', name: 'ALPHA', links: [{ name: 'P copy', url: 'https://p.test/#x', moons: [{ name: 'M2', url: 'https://m2.test/' }, { name: 'M1 copy', url: 'https://m1.test/' }] }] },
    { id: 'a', name: 'New sun with a used id', links: [] }];
  const result = plain(fn('mergeMaps')(personal, incoming));
  assert.deepEqual(Object.keys(result).sort(), ['added', 'groups', 'skipped']);
  assert.deepEqual(result.groups[0].links[0].moons.map(m => m.name), ['M1', 'M2'], 'moons merge into the first planet with that address');
  assert.equal(result.groups[0].links[1].moons.length, 0);
  assert.deepEqual(result.added, { suns: 0, planets: 0, moons: 1 });
  assert.deepEqual(result.skipped, { suns: 2, planets: 1, moons: 1 }, 'the second incoming sun matches by id');
});

check('M04', 'mergeRoutines adds only new names and regenerates clashing ids', () => {
  const merged = plain(fn('mergeRoutines')([{ id: 'r1', name: 'Morning', links: [] }],
    [{ id: 'x', name: 'morning', links: [] }, { id: 'r1', name: 'Evening', links: [] }]));
  assert.deepEqual(merged.map(r => [r.id, r.name]), [['r1', 'Morning'], ['evening', 'Evening']]);
});

check('M05', 'pathsForKey finds every copy of a destination, team suns included', () => {
  run(`groups[2].links.push({ name: 'Verge again', url: 'https://www.theverge.com/#top', moons: [] })`);
  assert.deepEqual(plain(fn('pathsForKey')('https://www.theverge.com')), [[1, 0], [2, 1]]);
  assert.equal(fn('itemAt')([1, 0, 0]).name, 'Reviews');
});

console.log(`\n${passed} passed, ${failed} failed (Orbit at ${REF})`);
process.exitCode = failed ? 1 : 0;
