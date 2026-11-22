// core/templates.js: placeholders such as {ticket} in a web address
// (tests/behavior-2.2.md, "Destination keys and placeholders", D02).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { oracle } from '../../tests/oracle/oracle.mjs';
import { runs } from '../../tests/unit/arbitraries.mjs';
import { PLACEHOLDER, templateNames, fillTemplate } from './templates.js';

const old = oracle();

test('PLACEHOLDER is the 2.2.1 pattern: letters, digits, _ and -, up to 30 characters, global', () => {
  assert.equal(PLACEHOLDER.source, old.get('PLACEHOLDER').source);
  assert.equal(PLACEHOLDER.flags, 'g');
});

test('templateNames returns names deduplicated, in order of first use', () => {
  assert.deepEqual(templateNames('https://a.test/{ticket}/{id}?q={ticket}&r={id_2}'), ['ticket', 'id', 'id_2']);
});

test('templateNames ignores what is not a placeholder', () => {
  assert.deepEqual(templateNames('https://a.test/{}/{a b}/{x.y}/{' + 'n'.repeat(31) + '}'), []);
  assert.deepEqual(templateNames('https://a.test/{' + 'n'.repeat(30) + '}'), ['n'.repeat(30)]);
  assert.deepEqual(templateNames('https://a.test/{a-b}{C_9}'), ['a-b', 'C_9']);
});

test('templateNames accepts a missing or non-string address', () => {
  assert.deepEqual(templateNames(undefined), []);
  assert.deepEqual(templateNames(null), []);
  assert.deepEqual(templateNames(''), []);
});

test('fillTemplate URI-encodes each value and fills a missing one with nothing', () => {
  assert.equal(fillTemplate('https://a.test/{t}?q={q}&r={r}', { t: 'A B/C', q: 'café&x=1' }),
    'https://a.test/A%20B%2FC?q=caf%C3%A9%26x%3D1&r=');
});

test('fillTemplate fills every use of a name', () => {
  assert.equal(fillTemplate('https://a.test/{t}/{t}', { t: '1' }), 'https://a.test/1/1');
});

test('fillTemplate can be called again after a previous call (no leftover regex state)', () => {
  for (let i = 0; i < 3; i++) assert.equal(fillTemplate('https://a.test/{t}', { t: String(i) }), `https://a.test/${i}`);
  for (let i = 0; i < 3; i++) assert.deepEqual(templateNames('https://a.test/{t}'), ['t']);
});

// Differential: the same answers as 2.2.1 for random text with braces.
const braceText = fc.array(fc.constantFrom('{', '}', 'a', 'B', '_', '-', '9', '/', '?', '=', ' ', '.', 'é', '{t}', '{id}'), { maxLength: 30 })
  .map(parts => 'https://a.test/' + parts.join(''));
const values = fc.dictionary(fc.constantFrom('t', 'id', 'a', 'B', 'a-', '_'), fc.string({ maxLength: 5 }));

test('templateNames matches 2.2.1 on random text', () => {
  fc.assert(fc.property(braceText, text => {
    assert.deepEqual(templateNames(text), old.call('templateNames', text));
  }), runs(500));
});

test('fillTemplate matches 2.2.1 on random text and values', () => {
  fc.assert(fc.property(braceText, values, (text, given) => {
    assert.equal(fillTemplate(text, given), old.call('fillTemplate', text, given));
  }), runs(500));
});
