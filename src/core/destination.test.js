// core/destination.js: one key per destination, and finding items by key or
// path in the combined map (tests/behavior-2.2.md, D01 and M05).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { oracle } from '../../tests/oracle/oracle.mjs';
import { combinedMap, rdpHost, runs, validDestination, webUrl } from '../../tests/unit/arbitraries.mjs';
import { destinationKey, itemAt, pathsForKey } from './destination.js';

const old = oracle();
const key = url => destinationKey({ name: 'x', url });

test('destinationKey ignores the fragment, trailing slashes, and the case of the host', () => {
  assert.equal(key('https://A.Test/Docs/#top'), 'https://a.test/Docs');
  assert.equal(key('https://a.test/docs///'), 'https://a.test/docs');
  assert.equal(key('https://a.test/'), 'https://a.test');
  assert.equal(key('https://a.test'), 'https://a.test');
});

test('destinationKey keeps query order, path case, scheme, and www', () => {
  assert.notEqual(key('https://a.test/?a=1&b=2'), key('https://a.test/?b=2&a=1'));
  assert.notEqual(key('https://a.test/Docs'), key('https://a.test/docs'));
  assert.notEqual(key('http://a.test/'), key('https://a.test/'));
  assert.notEqual(key('https://www.a.test/'), key('https://a.test/'));
  assert.equal(key('https://a.test/x?q=1#h'), 'https://a.test/x?q=1');
});

test('destinationKey keeps a non-default port and drops a default one, as URL does', () => {
  assert.equal(key('https://a.test:8080/'), 'https://a.test:8080');
  assert.equal(key('https://a.test:443/'), 'https://a.test');
});

test('placeholder braces are encoded in the path only; in the query they stay literal', () => {
  assert.equal(key('https://a.test/{t}?q={u}'), 'https://a.test/%7Bt%7D?q={u}');
});

test('an address that does not parse gives url:<address>', () => {
  assert.equal(key('not a url'), 'url:not a url');
  assert.equal(key(''), 'url:');
  assert.equal(destinationKey({ name: 'x' }), 'url:undefined');
});

test('Remote Desktop gives rdp:<host> in lowercase, keeping the port', () => {
  assert.equal(destinationKey({ name: 'x', type: 'rdp', host: 'LAB1' }), 'rdp:lab1');
  assert.notEqual(destinationKey({ name: 'x', type: 'rdp', host: 'lab1' }), destinationKey({ name: 'x', type: 'rdp', host: 'lab1:3389' }));
  assert.equal(destinationKey({ name: 'x', type: 'rdp' }), 'rdp:');
});

test('no item gives an empty key', () => {
  assert.equal(destinationKey(null), '');
  assert.equal(destinationKey(undefined), '');
});

// A small combined map: one team sun first, then two personal suns.
const MAP = [
  { id: 'team:t', name: 'Team', description: '', color: '#79d9f8', team: true, links: [
    { name: 'Docs', url: 'https://docs.test/', moons: [{ name: 'Lab', type: 'rdp', host: 'lab1' }] }] },
  { id: 'work', name: 'Work', description: '', color: '#79d9f8', links: [
    { name: 'Docs again', url: 'https://DOCS.test', moons: [] },
    { name: 'Wiki', url: 'https://wiki.test/', moons: [{ name: 'Docs moon', url: 'https://docs.test/#x' }] }] },
  { id: 'home', name: 'Home', description: '', color: '#79d9f8', links: [] },
];

test('pathsForKey finds every copy in the combined map, team suns included', () => {
  assert.deepEqual(pathsForKey(MAP, 'https://docs.test'), [[0, 0], [1, 0], [1, 1, 0]]);
  assert.deepEqual(pathsForKey(MAP, 'rdp:lab1'), [[0, 0, 0]]);
  assert.deepEqual(pathsForKey(MAP, 'https://none.test'), []);
  assert.deepEqual(pathsForKey([], 'https://docs.test'), []);
});

test('itemAt returns the planet or moon at a path, or undefined', () => {
  assert.equal(itemAt(MAP, [1, 1]).name, 'Wiki');
  assert.equal(itemAt(MAP, [1, 1, 0]).name, 'Docs moon');
  assert.equal(itemAt(MAP, [2, 0]), undefined);
  assert.equal(itemAt(MAP, [9, 0]), undefined);
  assert.equal(itemAt(MAP, [1, 0, 5]), undefined);
  assert.equal(itemAt(MAP, [9, 0, 0]), undefined);
});

test('pathsForKey and itemAt do not change the map', () => {
  const before = JSON.stringify(MAP);
  pathsForKey(MAP, 'https://docs.test');
  itemAt(MAP, [1, 1, 0]);
  assert.equal(JSON.stringify(MAP), before);
});

// Differential: the same answers as 2.2.1.
const anyItem = fc.oneof(
  webUrl.map(url => ({ name: 'x', url })),
  rdpHost.map(host => ({ name: 'x', type: 'rdp', host })),
  validDestination,
);

test('destinationKey matches 2.2.1 for random destinations', () => {
  fc.assert(fc.property(anyItem, item => {
    assert.equal(destinationKey(item), old.call('destinationKey', item));
  }), runs(1000));
});

test('destinationKey gives one key for addresses that differ only in fragment, trailing slashes, or host case', () => {
  fc.assert(fc.property(fc.constantFrom('a.test', 'Docs.Example'), fc.constantFrom('', '/x', '/X/y'), fc.constantFrom('', '?q=1'),
    fc.constantFrom('', '/', '//'), fc.constantFrom('', '#a', '#'), fc.boolean(), (host, path, query, slash, hash, upper) => {
      const plain = key(`https://${host.toLowerCase()}${path}${query}`);
      const varied = key(`https://${upper ? host.toUpperCase() : host}${path}${slash}${query}${hash}`);
      assert.equal(varied, plain);
    }), runs(300));
});

test('pathsForKey and itemAt match 2.2.1 on random combined maps', () => {
  const sandbox = oracle();
  fc.assert(fc.property(combinedMap, fc.nat(30), fc.nat(15), fc.nat(10), (map, s, p, m) => {
    sandbox.set('groups', map);
    const items = map.flatMap(sun => sun.links.flatMap(planet => [planet, ...planet.moons]));
    const probe = items.length ? items[(s + p + m) % items.length] : { name: 'x', url: 'https://none.test/' };
    const wanted = destinationKey(probe);
    assert.deepEqual(pathsForKey(map, wanted), sandbox.call('pathsForKey', wanted));
    for (const path of [[s % 12, p % 13], [s % 12, p % 13, m % 9]]) {
      assert.deepEqual(itemAt(map, path), sandbox.call('itemAt', path));
    }
  }), runs(300));
});

test('a group has no destination key while its moons retain theirs', () => {
  const group = { name: 'Group', type: /** @type {const} */ ('group'), moons: [{ name: 'Web', url: 'https://a.test/' }] };
  const map = [{ id: 'work', name: 'Work', description: '', color: '#123456', links: [group] }];
  assert.equal(destinationKey(group), null);
  assert.deepEqual(pathsForKey(map, ''), []);
  assert.deepEqual(pathsForKey(map, 'https://a.test'), [[0, 0, 0]]);
});
