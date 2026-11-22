// services/sources.js with a fake fetch (REWRITE_PLAN.md, phase 4). The
// differential test runs random team-map situations through 2.2.1's own
// loadTeamMap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { oracle } from '../../tests/oracle/oracle.mjs';
import { rawMap, runs, validMap } from '../../tests/unit/arbitraries.mjs';
import { fakeFetch } from '../../tests/unit/fakes.mjs';
import { loadBundledMap, loadTeamMap } from './sources.js';

const MAP = { groups: [{ id: 'docs', name: 'Docs', color: '#79d9f8', links: [{ name: 'Guide', url: 'https://guide.test/' }] }] };
const OTHER = { groups: [{ id: 'ops', name: 'Ops', color: '#79d9f8', links: [] }] };
const served = (routes, extra = {}) => ({ protocol: 'http:', fetch: fakeFetch(routes), bundledData: undefined, teamData: undefined, ...extra });
const file = (extra = {}) => ({ protocol: 'file:', fetch: () => assert.fail('file:// never fetches'), bundledData: undefined, teamData: undefined, ...extra });

test('bundled map: window.ORBIT_DATA in file://, links.json when served, validated', async () => {
  assert.equal((await loadBundledMap(file({ bundledData: MAP }))).groups[0].links[0].moons.length, 0, 'validated: moons added');
  const env = served({ './links.json': { status: 200, body: MAP } });
  assert.equal((await loadBundledMap(env)).groups[0].name, 'Docs');
  assert.deepEqual(env.fetch.requests, [{ url: './links.json', cache: 'no-store' }], 'never cached');
});

test('bundled map: the error messages 2.2.1 showed', async () => {
  await assert.rejects(loadBundledMap(file()), { message: 'Run `python3 sync.py` to generate links-data.js.' });
  await assert.rejects(loadBundledMap(served({ './links.json': { status: 500 } })), { message: 'HTTP 500' });
  await assert.rejects(loadBundledMap(served({ './links.json': { status: 200, body: null } })), { message: 'Run `python3 sync.py` to generate links-data.js.' });
  await assert.rejects(loadBundledMap(file({ bundledData: { groups: 'x' } })), { message: /groups/ });
});

test('team map: team.json wins over team-data.js when served; ids get the team: prefix', async () => {
  const result = await loadTeamMap(served({ './team.json': { status: 200, body: MAP } }, { teamData: OTHER }));
  assert.deepEqual(result.groups.map(sun => [sun.id, sun.team]), [['team:docs', true]]);
  assert.equal(result.source, 'team.json from serve.py --team');
  assert.equal(result.error, '');
});

test('team map: a 404 or a failure falls back to team-data.js; file:// uses only team-data.js', async () => {
  for (const answer of [{ status: 404 }, { status: 500 }, { throws: 'Failed to fetch' }, { status: 200, badJson: true }]) {
    const result = await loadTeamMap(served({ './team.json': answer }, { teamData: OTHER }));
    assert.deepEqual([result.groups[0].id, result.source], ['team:ops', 'team-data.js'], JSON.stringify(answer));
  }
  const local = await loadTeamMap(file({ teamData: OTHER }));
  assert.equal(local.source, 'team-data.js');
});

test('team map: none at all is no error; a failure with no team-data.js is reported, never thrown', async () => {
  assert.deepEqual(await loadTeamMap(served({ './team.json': { status: 404 } })), { groups: [], source: '', error: '' });
  assert.deepEqual(await loadTeamMap(file()), { groups: [], source: '', error: '' });
  assert.deepEqual(await loadTeamMap(served({ './team.json': { status: 500 } })),
    { groups: [], source: '', error: 'The team map could not be loaded: HTTP 500' });
  const invalid = await loadTeamMap(file({ teamData: { groups: [{ name: '' }] } }));
  assert.match(invalid.error, /^The team map could not be loaded: /);
});

test('team map: the same groups, source, and error as 2.2.1 loadTeamMap', async () => {
  const answer = fc.oneof(
    fc.record({ status: fc.constant(200), body: fc.oneof(validMap.map(groups => ({ groups })), rawMap) }),
    fc.constantFrom({ status: 404 }, { status: 500 }, { status: 403 }, { throws: 'Failed to fetch' }, { status: 200, badJson: true }),
  );
  const teamData = fc.option(fc.oneof(validMap.map(groups => ({ groups })), rawMap), { nil: undefined });
  await fc.assert(fc.asyncProperty(fc.constantFrom('file:', 'http:'), answer, teamData, async (protocol, spec, local) => {
    const old = oracle();
    old.run(`
      var window = { ORBIT_TEAM_DATA: ${JSON.stringify(local)} };
      var location = { protocol: ${JSON.stringify(protocol)} };
      var fetch = async () => {
        const spec = ${JSON.stringify(spec)};
        if (spec.throws) throw new Error(spec.throws);
        return { ok: spec.status === 200, status: spec.status,
          json: async () => { if (spec.badJson) throw new SyntaxError('Unexpected token < in JSON'); return spec.body; } };
      };`);
    await old.callAsync('loadTeamMap');
    const result = await loadTeamMap({ protocol, fetch: fakeFetch({ './team.json': spec }), bundledData: undefined, teamData: local });
    assert.deepEqual(result, { groups: old.get('teamGroups'), source: old.get('teamSource'), error: old.get('teamError') });
  }), runs(300));
});
