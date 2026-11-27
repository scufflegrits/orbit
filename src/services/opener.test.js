// services/opener.js and services/rdp-launch.js, with a fake window.open and
// storage (REWRITE_PLAN.md, phase 4). The differential test runs random
// lists through 2.2.1's own openLinks and compares everything it did.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { oracle } from '../../tests/oracle/oracle.mjs';
import { runs, webUrl, rdpHost } from '../../tests/unit/arbitraries.mjs';
import { fakeDocument } from '../../tests/unit/fakes.mjs';
import { memoryStorage, useBackend } from '../state/storage.js';
import { openDestination, openLinks, openPlan, openTab, planLinks } from './opener.js';
import { launchRdp } from './rdp-launch.js';

const page = /** @type {any} */ (globalThis);
/** @type {{url: string, target: string}[]} */
let opened;
/** Indexes of window.open calls the "browser" blocks. */
let blockAt = new Set();
beforeEach(() => {
  useBackend(memoryStorage());
  opened = [];
  blockAt = new Set();
  page.open = (url, target) => {
    opened.push({ url, target });
    return blockAt.has(opened.length - 1) ? null : { opener: 'orbit' };
  };
});
afterEach(() => {
  delete page.open;
  delete page.location;
  delete page.document;
  useBackend(null);
});

const web = (name, url) => ({ name, url });
const rdp = (name, host) => ({ name, type: 'rdp', host });

test('openTab cuts the new tab off from Orbit and reports a blocked tab', () => {
  let tab = null;
  page.open = () => { tab = { opener: 'orbit' }; return tab; };
  assert.equal(openTab('https://a.test/'), true);
  assert.equal(/** @type {any} */ (tab).opener, null);
  page.open = () => null;
  assert.equal(openTab('https://a.test/'), false);
});

test('window.open is looked up at call time, so a stub installed later takes effect', () => {
  const calls = [];
  page.open = () => { calls.push('late'); return null; };
  openTab('https://a.test/');
  assert.deepEqual(calls, ['late']);
});

test('openDestination: web links open, placeholder links ask, Remote Desktop downloads or launches', () => {
  assert.equal(openDestination(web('A', 'https://a.test/'), { presets: [], launchMode: 'download' }), 'opened');
  assert.deepEqual(opened, [{ url: 'https://a.test/', target: '_blank' }]);
  assert.equal(openDestination(web('T', 'https://t.test/{id}'), { presets: [], launchMode: 'download' }), 'ask');
  assert.equal(opened.length, 1, 'a placeholder link opens nothing until the form is filled');
  blockAt = new Set([1]);
  assert.equal(openDestination(web('B', 'https://b.test/'), { presets: [], launchMode: 'download' }), 'blocked');
  page.location = { href: '' };
  assert.equal(openDestination(rdp('Lab', 'lab01'), { presets: [], launchMode: 'client' }), 'rdp');
  assert.match(page.location.href, /^orbit-rdp:\/\/lab01\//);
});

test('launchRdp in download mode saves a .rdp file named after the link', async () => {
  const saved = fakeDocument();
  launchRdp(/** @type {any} */ (rdp('Lab', 'lab01:3390')), [], 'download');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].download, 'lab.rdp');
  assert.equal(saved[0].type, 'application/x-rdp');
  assert.match(await saved[0].text, /full address:s:lab01:3390/);
});

test('planLinks: Remote Desktop links and unfilled placeholders are left out and counted', () => {
  useBackend(memoryStorage({ 'orbit:variables:v1': JSON.stringify({ id: '42' }) }));
  const plan = planLinks([web('A', 'https://a.test/'), rdp('Lab', 'lab01'), web('T', 'https://t.test/{id}'), web('U', 'https://u.test/{q}')], 'Docs');
  assert.deepEqual(plan.web.map(entry => entry.url), ['https://a.test/', 'https://t.test/42']);
  assert.equal(plan.note, ' 1 Remote Desktop link left out. 1 link with {placeholders} left out until you open it once.');
  assert.equal(plan.question, 'Open 2 tabs for Docs?');
  assert.equal(plan.empty, null);
  assert.equal(planLinks([rdp('Lab', 'lab01')], 'Lab').empty, 'Lab has no website links to open. 1 Remote Desktop link left out.');
});

test('openPlan: blocked tabs are counted and only allowed tabs are reported as opened', () => {
  blockAt = new Set([1, 2]);
  const noted = [];
  const result = openPlan(planLinks([web('A', 'https://a.test/'), web('B', 'https://b.test/'), web('C', 'https://c.test/')], 'X'), item => noted.push(item.name));
  assert.deepEqual(noted, ['A']);
  assert.deepEqual(result, { opened: 1, blocked: 2, isError: true,
    message: "Your browser blocked 2 tabs. Allow pop-ups for Orbit in the browser's address bar, then try again." });
});

test('openLinks asks before opening more than one tab, and a "no" opens nothing', () => {
  const asked = [];
  const items = [web('A', 'https://a.test/'), web('B', 'https://b.test/')];
  assert.equal(openLinks(items, 'Docs', { ask: question => { asked.push(question); return false; } }), null);
  assert.deepEqual(asked, ['Open 2 tabs for Docs?']);
  assert.equal(opened.length, 0);
  assert.deepEqual(openLinks(items, 'Docs', { confirm: false, ask: () => assert.fail('not asked') }),
    { message: 'Opened 2 tabs for Docs.', isError: false });
});

test('pop-up allowance, layer 1: every window.open happens before openLinks returns, with no await or timer', () => {
  const items = [web('A', 'https://a.test/'), web('B', 'https://b.test/'), web('C', 'https://c.test/')];
  const result = openLinks(items, 'Docs', { ask: () => true });
  assert.equal(opened.length, 3, 'all three tabs were asked for synchronously');
  assert.ok(!(result instanceof Promise), 'openLinks is not async');
  for (const fn of [openLinks, openPlan, planLinks, openTab, openDestination]) {
    assert.notEqual(fn.constructor.name, 'AsyncFunction', `${fn.name} is not async`);
  }
});

// ---- Differential: 2.2.1 openLinks --------------------------------------

const item = fc.oneof(
  { weight: 5, arbitrary: fc.tuple(fc.constantFrom('A', 'B', 'Docs'), webUrl).map(([name, url]) => web(name, url)) },
  { weight: 1, arbitrary: fc.tuple(fc.constantFrom('Lab', 'Box'), rdpHost).map(([name, host]) => rdp(name, host)) },
);
const variables = fc.dictionary(fc.constantFrom('ticket', 'id', 'q', 'term', 'x'), fc.constantFrom('', '7', 'a b', 'é'), { maxKeys: 4 });
const options = fc.record({
  confirm: fc.boolean(),
  question: fc.boolean(),
  extra: fc.constantFrom('', ' 1 link in this routine is no longer on the map.'),
  answer: fc.boolean(),
  blocked: fc.array(fc.nat(6), { maxLength: 3 }),
}, { requiredKeys: [] });

test('openLinks does what 2.2.1 openLinks did: tabs, question, report, and recorded links', () => {
  fc.assert(fc.property(fc.array(item, { maxLength: 7 }), fc.constantFrom('Docs', 'your favorites'), variables, options, (items, label, values, opts) => {
    const blocked = new Set(opts.blocked ?? []);
    const old = oracle();
    old.setStorage({ 'orbit:variables:v1': JSON.stringify(values) });
    old.run(`
      var log = { opened: [], asked: [], noted: [], notice: null };
      var window = {
        open: url => { log.opened.push(url); return ${JSON.stringify([...blocked])}.includes(log.opened.length - 1) ? null : {}; },
        confirm: question => { log.asked.push(question); return ${Boolean(opts.answer)}; },
      };
      var noteOpened = item => log.noted.push(item.name);
      var showOpenAllNotice = (message, isError = false) => { log.notice = { message, isError }; return message; };`);
    old.set('__items', items);
    const oldReturn = old.run(`openLinks(__items, ${JSON.stringify(label)}, { ${opts.confirm === undefined ? '' : `confirm: ${opts.confirm},`}
      question: ${opts.question ? 'count => `Open ${count} tabs for it and its moons?`' : 'null'}, extra: ${JSON.stringify(opts.extra ?? '')} })`);
    const oldLog = old.run('log');

    useBackend(memoryStorage({ 'orbit:variables:v1': JSON.stringify(values) }));
    opened = [];
    blockAt = blocked;
    const asked = [];
    const noted = [];
    const result = openLinks(items, label, {
      ...(opts.confirm === undefined ? {} : { confirm: opts.confirm }),
      question: opts.question ? count => `Open ${count} tabs for it and its moons?` : null,
      extra: opts.extra ?? '',
      ask: question => { asked.push(question); return Boolean(opts.answer); },
      onOpened: entry => noted.push(entry.name),
    });
    assert.deepEqual(opened.map(entry => entry.url), oldLog.opened, 'the same tabs, in order');
    assert.ok(opened.every(entry => entry.target === '_blank'));
    assert.deepEqual(asked, oldLog.asked, 'the same question, or none');
    assert.deepEqual(noted, oldLog.noted, 'the same links recorded as opened');
    assert.deepEqual(result, oldLog.notice, 'the same report, or none');
    assert.equal(result === null ? null : result.message, oldReturn ?? null);
  }), runs(400));
});

test('opening a group is a no-op and bulk opening only plans its moons', () => {
  const group = { name: 'Monitoring', type: /** @type {const} */ ('group'), moons: [web('Status', 'https://status.test/')] };
  openDestination(group, { presets: [], launchMode: 'download' });
  assert.deepEqual(opened, []);
  const plan = planLinks([group, ...group.moons], group.name);
  assert.deepEqual(plan.web.map(item => item.url), ['https://status.test/']);
  assert.equal(plan.note, '');
});

test('bulk opening skips inherited placeholder names until explicitly saved', () => {
  for (const name of ['constructor', 'toString', '__proto__']) {
    const items = [web('Template', 'https://a.test/{' + name + '}')];
    assert.equal(planLinks(items, 'Templates', { values: {} }).web.length, 0);
    const values = Object.fromEntries([[name, 'saved value']]);
    assert.equal(planLinks(items, 'Templates', { values }).web[0].url, 'https://a.test/saved%20value');
  }
});
