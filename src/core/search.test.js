// core/search.js: Quick find and the palette's matching (tests/behavior-2.2.md,
// "Quick find", S01-S04). Pure: it takes the combined map as a parameter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { oracle } from '../../tests/oracle/oracle.mjs';
import { combinedMap, runs } from '../../tests/unit/arbitraries.mjs';
import { addressText, editDistance, findMatches, searchEntries, searchWords } from './search.js';

const old = oracle();

const sun = (name, links, extra = {}) => ({ id: name.toLowerCase().replace(/\W+/g, '-'), name, description: '', color: '#79d9f8', links, ...extra });
const web = (name, url, extra = {}) => ({ name, url, moons: [], ...extra });
const MAP = [
  sun('Team', [web('Status', 'https://status.test/')], { id: 'team:team', team: true }),
  sun('Tech reviews', [
    web('The Verge', 'https://www.theverge.com/', { tags: ['news'] }),
    web('engadget', 'https://www.engadget.com/tech', { note: 'gadget blog' }),
    { name: 'Lab', type: 'rdp', host: 'lab1:3390', moons: [] },
  ]),
  sun('Work', [
    { ...web('Jira', 'https://jira.test/browse/{ticket}', { tags: ['work', 'daily'] }),
      moons: [{ name: 'Board', url: 'https://jira.test/board', tags: ['daily'] }, { name: 'build2', url: 'https://ci.test/b2' }] },
  ]),
];
const names = query => findMatches(MAP, query).map(match => match.name);

test('every word must match some field', () => {
  assert.deepEqual(names('jira board'), ['Board']);
  assert.deepEqual(names('jira nothing'), []);
});

test('an empty or blank query finds nothing', () => {
  assert.deepEqual(findMatches(MAP, ''), []);
  assert.deepEqual(findMatches(MAP, '   '), []);
});

test('names allow two-letter substring matches while paths only narrow', () => {
  assert.ok(names('ve').includes('The Verge'));
  assert.ok(names('verge.com').includes('The Verge'), 'address with 3+ characters');
  assert.ok(!names('wo').includes('Board'), 'a parent sun prefix alone cannot find the moon');
});

test('a typo matches only when the word matches nothing exactly anywhere', () => {
  assert.ok(names('engadgte').includes('engadget'), 'a swapped pair is one edit');
  assert.ok(names('engadet').includes('engadget'), 'one edit for 5-8 letters');
  assert.deepEqual(names('enga'), ['engadget'], 'prefix, no typo search needed');
  assert.ok(!names('jiri').includes('Jira'), 'no typo matching under five letters');
});

test('#tag and tag:name keep only items with exactly that tag', () => {
  assert.deepEqual(names('#daily'), ['Jira', 'Board']);
  assert.deepEqual(names('tag:news'), ['The Verge']);
  assert.deepEqual(names('#dail'), []);
  assert.deepEqual(names('#daily board'), ['Board']);
});

test('a word that matches only where an item sits narrows but never matches on its own', () => {
  assert.deepEqual(names('work'), ['Work', 'Jira'], 'the sun, and Jira by its tag; not every item in the sun');
  assert.deepEqual(names('tech reviews'), ['Tech reviews', 'engadget'], 'Engadget also matches by address');
  assert.ok(names('tech engadget').includes('engadget'));
});

test('notes and Remote Desktop hosts are searched', () => {
  assert.deepEqual(names('gadget blog'), ['engadget']);
  assert.deepEqual(names('lab1'), ['Lab']);
});

test('a higher scoring path does not hide a direct note or address match', () => {
  const map = [sun('Work Portal', [
    web('Dashboard', 'https://dashboard.test/', { note: 'Work' }),
    web('Reports', 'https://work.test/'),
    web('Path only', 'https://status.test/'),
  ])];
  const matches = findMatches(map, 'work');
  assert.deepEqual(matches.map(item => item.name), ['Work Portal', 'Dashboard', 'Reports']);
  assert.equal(matches[1].why, 'Matched the note');
  assert.equal(matches[2].why, 'Address: work.test');
  assert.deepEqual(findMatches(map, 'work portal').map(item => item.name), ['Work Portal', 'Dashboard', 'Reports']);
});

test('a short form like b2 matches build2', () => {
  assert.ok(names('b2').includes('build2'));
});

test('results carry kind, path, indices, and why they matched', () => {
  const [verge] = findMatches(MAP, 'theverge');
  assert.equal(verge.kind, 'Planet');
  assert.equal(verge.path, 'Tech reviews');
  assert.deepEqual(verge.indices, [1, 0]);
  assert.equal(verge.why, 'Address: www.theverge.com');
  const [board] = findMatches(MAP, 'board');
  assert.equal(board.kind, 'Moon');
  assert.equal(board.path, 'Work / Jira');
  assert.deepEqual(board.indices, [2, 0, 0]);
  const [team] = findMatches(MAP, 'team');
  assert.equal(team.kind, 'Sun');
  assert.equal(team.path, 'Team Galaxy');
});

test('ties keep map order', () => {
  assert.deepEqual(names('#daily'), ['Jira', 'Board']);
});

test('editDistance counts a swapped pair as one edit and stops early past the limit', () => {
  assert.equal(editDistance('engadgte', 'engadget', 2), 1);
  assert.equal(editDistance('abc', 'abc', 1), 0);
  assert.equal(editDistance('abcdef', 'ab', 1), 2, 'length difference past the limit gives limit + 1');
  assert.equal(editDistance('aaaaa', 'bbbbb', 1), 2);
});

test('searchWords splits on anything but letters and digits, lowercased', () => {
  assert.deepEqual(searchWords('The Verge.com / Café-2'), ['the', 'verge', 'com', 'café', '2']);
});

test('addressText is host and path for the web, the host for Remote Desktop', () => {
  assert.equal(addressText({ name: 'x', url: 'https://www.a.test/' }), 'www.a.test');
  assert.equal(addressText({ name: 'x', url: 'https://a.test/b/c?q=1' }), 'a.test/b/c');
  assert.equal(addressText({ name: 'x', type: 'rdp', host: 'lab1:3390' }), 'lab1:3390');
  assert.equal(addressText({ name: 'x', url: 'nope' }), 'nope');
});

test('findMatches does not change the map', () => {
  const before = JSON.stringify(MAP);
  findMatches(MAP, 'jira #daily b2');
  assert.equal(JSON.stringify(MAP), before);
});

// Differential: the same results, in the same order, as 2.2.1.
const word = fc.constantFrom('docs', 'Docs', 'jira', 'jir', 'wiki', 'wikki', 'verge', 'verge.com', 'tech', 'reviews',
  'engadgte', 'enga', 've', 'lab1', 'lab', '3390', 'b2', 'build2', 'work', 'Work', 'ops', 'daily', 'team', 'status',
  'runbook', 'morning', 'café', 'cafe', 'menu', 'example', 'ticket', '{ticket}', 'a', 'x', 'zzz', 'release notes', 'notes',
  'reléase', 'eleases', 'docs.example');
const filter = fc.constantFrom('#work', '#ops', '#docs', '#daily', 'tag:team', 'tag:x-1', '#nope', '#', 'tag:');
const query = fc.array(fc.oneof({ weight: 4, arbitrary: word }, { weight: 1, arbitrary: filter }), { minLength: 0, maxLength: 3 })
  .chain(words => fc.constantFrom(' ', '  ', ' \t').map(gap => ` ${words.join(gap)} `));

test('findMatches preserves the 2.2.1 results and ordering when allowing more direct matches', () => {
  const sandbox = oracle();
  fc.assert(fc.property(combinedMap, query, (map, text) => {
    sandbox.set('groups', map);
    const previous = sandbox.call('findMatches', text);
    const key = (/** @type {any} */ match) => match.id ?? match.indices.join(':');
    const previousKeys = new Set(previous.map(key));
    const current = findMatches(map, text);
    // Only new results with a previously masked direct match may differ.
    assert.deepEqual(JSON.parse(JSON.stringify(current.filter(match => previousKeys.has(key(match))))), previous);
    for (const match of current.filter(match => !previousKeys.has(key(match)))) assert.ok(match.indices);
  }), runs(400));
});

test('searchEntries matches 2.2.1 on random maps', () => {
  const sandbox = oracle();
  fc.assert(fc.property(combinedMap, map => {
    sandbox.set('groups', map);
    assert.deepEqual(JSON.parse(JSON.stringify(searchEntries(map))), sandbox.call('searchEntries'));
  }), runs(100));
});

test('editDistance matches 2.2.1', () => {
  const letters = fc.string({ unit: fc.constantFrom('a', 'b', 'c', 'd'), maxLength: 10 });
  fc.assert(fc.property(letters, letters, fc.integer({ min: 0, max: 3 }), (a, b, limit) => {
    assert.equal(editDistance(a, b, limit), old.call('editDistance', a, b, limit));
  }), runs(1000));
});

test('empty groups are found by name without an address field', () => {
  const groups = [sun('Work', [{ name: 'Monitoring', type: 'group', moons: [] }])];
  assert.equal(findMatches(groups, 'monitoring')[0].kind, 'Group');
  assert.ok(!searchEntries(groups)[1].fields.some(field => field.kind === 'address'));
});
