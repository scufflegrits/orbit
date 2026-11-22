// services/file-io.js and services/link-check.js, with a fake document and
// fetch (REWRITE_PLAN.md, phase 4). Reading bookmark HTML needs a real
// DOMParser, so it is covered in the browser by F13.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeDocument, fakeFetch } from '../../tests/unit/fakes.mjs';
import { downloadJson, downloadText, pickFile, readJsonFile, readRdpText } from './file-io.js';
import { checkLinks } from './link-check.js';

const page = /** @type {any} */ (globalThis);
afterEach(() => { delete page.document; });

test('downloadJson saves indented JSON with a final newline', async () => {
  const saved = fakeDocument();
  downloadJson({ groups: [] }, 'orbit-links.json');
  assert.equal(saved[0].download, 'orbit-links.json');
  assert.equal(saved[0].type, 'application/json');
  assert.equal(await saved[0].text, '{\n  "groups": []\n}\n');
});

test('downloads look up URL.createObjectURL at call time, so a test stub sees the file', async () => {
  fakeDocument();
  const seen = [];
  const original = page.URL.createObjectURL;
  page.URL.createObjectURL = blob => { seen.push(blob.type); return original(blob); };
  downloadText('x', 'a.txt', 'text/plain');
  assert.deepEqual(seen, ['text/plain']);
});

test('pickFile shows a chooser for the given types and hands over the chosen file; cancel does nothing', () => {
  fakeDocument();
  const chosen = [];
  pickFile('.json,application/json', file => chosen.push(file));
  const input = page.document.lastInput;
  assert.equal(input.type, 'file');
  assert.equal(input.accept, '.json,application/json');
  input.files = [];
  input.listeners.change();
  assert.deepEqual(chosen, []);
  input.files = ['map.json'];
  input.listeners.change();
  assert.deepEqual(chosen, ['map.json']);
});

test('readJsonFile parses, and throws JSON.parse\'s own error', async () => {
  assert.deepEqual(await readJsonFile({ text: async () => '{"a":1}' }), { a: 1 });
  await assert.rejects(readJsonFile({ text: async () => '{' }), SyntaxError);
});

test('readRdpText decodes UTF-16 and refuses files over 64,000 bytes', async () => {
  const utf16 = new Uint8Array([0xff, 0xfe, ...[...'full address:s:a'].flatMap(c => [c.charCodeAt(0), 0])]);
  assert.equal(await readRdpText({ size: utf16.length, arrayBuffer: async () => utf16.buffer }), 'full address:s:a');
  await assert.rejects(readRdpText({ size: 64001, arrayBuffer: async () => new ArrayBuffer(0) }), { message: 'The .rdp file is too large to import.' });
});

test('checkLinks sends batches of 50 with the X-Orbit-Check header and merges the answers', async () => {
  const urls = Array.from({ length: 120 }, (_, i) => `https://s${i}.test/`);
  const fetch = fakeFetch({ './api/check-links': request => ({
    status: 200, body: Object.fromEntries(JSON.parse(request.body).urls.map(url => [url, { ok: true, status: 200 }])) }) });
  const progress = [];
  const answers = await checkLinks(urls, { fetch, onProgress: (done, total) => progress.push([done, total]) });
  assert.equal(Object.keys(answers).length, 120);
  assert.deepEqual(progress, [[0, 120], [50, 120], [100, 120]]);
  assert.deepEqual(fetch.requests.map(r => JSON.parse(r.body).urls.length), [50, 50, 20]);
  for (const request of fetch.requests) {
    assert.equal(request.method, 'POST');
    assert.deepEqual(request.headers, { 'Content-Type': 'application/json', 'X-Orbit-Check': '1' });
  }
});

test('checkLinks: the messages for a server that cannot check links, or answers with an error', async () => {
  for (const status of [404, 501]) {
    await assert.rejects(checkLinks(['https://a.test/'], { fetch: fakeFetch({ './api/check-links': { status } }) }),
      { message: 'This server cannot check links. Start Orbit with python3 serve.py from this version.' });
  }
  await assert.rejects(checkLinks(['https://a.test/'], { fetch: fakeFetch({ './api/check-links': { status: 403 } }) }),
    { message: 'The server answered HTTP 403.' });
  assert.deepEqual(await checkLinks([], { fetch: () => assert.fail('nothing to check') }), {});
});
