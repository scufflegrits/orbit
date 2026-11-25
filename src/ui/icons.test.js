// ui/icons.js: Lucide icons drawn from the generated data (scripts/icons.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAMES, readIcon } from '../../scripts/icons.mjs';
import { ICON_DATA } from './icon-data.js';
import { iconSpec } from './icons.js';

test('icons: every name the generator lists is in the data, and the data matches lucide-static', () => {
  assert.deepEqual(Object.keys(ICON_DATA).sort(), [...new Set(NAMES)].sort());
  for (const name of NAMES) assert.deepEqual(ICON_DATA[name], readIcon(name), name);
});

test('icons: a spec has the shared Lucide outline attributes, hidden from screen readers', () => {
  const spec = iconSpec('x');
  assert.deepEqual(spec.attrs, {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false',
    class: 'icon icon-x',
  });
  assert.deepEqual(spec.children, [['path', { d: 'M18 6 6 18' }], ['path', { d: 'm6 6 12 12' }]]);
});

test('icons: filled and extra classes', () => {
  const spec = iconSpec('star', { filled: true, className: 'favorite-star' });
  assert.equal(spec.attrs.fill, 'currentColor');
  assert.equal(spec.attrs.class, 'icon icon-star favorite-star');
});

test('icons: an unknown name throws, so a typo fails loudly', () => {
  assert.throws(() => iconSpec('no-such-icon'), /Unknown icon "no-such-icon"/);
});
