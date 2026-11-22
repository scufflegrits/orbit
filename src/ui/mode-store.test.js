// ui/mode-store.js: the one owner of the interaction modes (phase 4b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModeStore } from './mode-store.js';

test('starts at rest and applies events through the state machine', () => {
  const modes = createModeStore();
  assert.deepEqual(modes.state(), { overlay: 'none', mode: 'browsing', view: 'galaxy', find: 'empty' });
  assert.equal(modes.send('editOn'), true);
  assert.equal(modes.inEditMode(), true);
  assert.equal(modes.send('editOn'), false, 'an event that changes nothing reports false');
  assert.equal(createModeStore({ view: 'system' }).state().view, 'system');
});

test('listeners hear each change once, with the previous state and the event; not when nothing changed', () => {
  const modes = createModeStore();
  const heard = [];
  const stop = modes.subscribe((next, previous, event) => heard.push([previous.overlay, next.overlay, event]));
  modes.send('openMenu');
  modes.send('openPalette');
  modes.send('closeOverlay');
  stop();
  modes.send('openMenu');
  assert.deepEqual(heard, [['none', 'menu', 'openMenu'], ['menu', 'none', 'closeOverlay']]);
});

test('an event sent from inside a listener is applied at once and reported in order to every listener', () => {
  const modes = createModeStore();
  const heard = [];
  modes.subscribe((next, previous, event) => {
    heard.push(['first', event]);
    if (event === 'editOn') modes.send('press');
  });
  modes.subscribe((next, previous, event) => heard.push(['second', event, next.mode]));
  modes.send('editOn');
  assert.equal(modes.state().mode, 'pressed');
  assert.deepEqual(heard, [['first', 'editOn'], ['second', 'editOn', 'editIdle'], ['first', 'press'], ['second', 'press', 'pressed']]);
});

test('queries match the state machine', () => {
  const modes = createModeStore();
  modes.send('editOn');
  modes.send('press');
  assert.equal(modes.holding(), true);
  assert.equal(modes.dragging(), false);
  modes.send('passThreshold');
  assert.equal(modes.dragging(), true);
  assert.equal(modes.escapeTarget(), 'drag');
  assert.equal(modes.routineOffersAllowed(), false);
  assert.equal(modes.linkOpensEditor('app'), true);
  modes.send('openMenu');
  assert.equal(modes.holding(), false, 'opening the menu drops the held item');
  assert.equal(modes.menuOpen(), true);
  assert.equal(modes.keyAllowed('commandK'), false);
  assert.equal(modes.overlayIs('menu'), true);
});
