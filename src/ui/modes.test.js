// ui/modes.js: one test per transition in the "Interaction modes" diagram and
// one per rule under it (REWRITE_PLAN.md). Rule ids match the browser checks
// in tests/mode_rules_check.py (MR01-MR12), which confirmed them on 2.2.1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { escapeTarget, inEditMode, initialModes, keyAllowed, linkOpensEditor, menuOpen, routineOffersAllowed, transition } from './modes.js';

/** @param {any} changes */
const at = changes => Object.freeze({ ...initialModes(), ...changes });
/** Run events in order from a state. */
const run = (state, ...events) => events.reduce(transition, state);

test('start-up: no overlay, browsing, empty Quick find; the view is Galaxy, a System, or the error view', () => {
  assert.deepEqual(initialModes(), { overlay: 'none', mode: 'browsing', view: 'galaxy', find: 'empty' });
  assert.equal(initialModes({ view: 'system' }).view, 'system');
  assert.equal(transition(initialModes(), 'loadFailed').view, 'error');
});

test('overlay transitions in the diagram', () => {
  const cases = [
    ['none', 'openPalette', 'palette'], ['none', 'openPlaceholder', 'placeholder'], ['none', 'openMenu', 'menu'],
    ['none', 'openEditor', 'menuEditor'], ['palette', 'closeOverlay', 'none'], ['palette', 'runEntry', 'none'],
    ['palette', 'openPlaceholder', 'placeholder'], ['palette', 'choosePanel', 'menuPanel'], ['palette', 'openEditor', 'menuEditor'],
    ['placeholder', 'closeOverlay', 'none'], ['menu', 'choosePanel', 'menuPanel'], ['menuPanel', 'openEditor', 'menuEditor'],
    ['menuEditor', 'backToPanels', 'menuPanel'], ['menu', 'closeOverlay', 'none'], ['menuPanel', 'closeOverlay', 'none'],
    ['menuEditor', 'closeOverlay', 'none'],
  ];
  for (const [from, event, to] of cases) assert.equal(transition(at({ overlay: from }), /** @type {any} */ (event)).overlay, to, `${from} --${event}-->`);
});

test('only one overlay at a time: the menu and palette open only from no overlay, never from the placeholder form', () => {
  assert.equal(transition(at({ overlay: 'menu' }), 'openPalette').overlay, 'menu', 'MR03: the menu refuses Ctrl/Cmd+K');
  assert.equal(transition(at({ overlay: 'palette' }), 'openMenu').overlay, 'palette');
  assert.equal(transition(at({ overlay: 'placeholder' }), 'openEditor').overlay, 'placeholder');
  assert.equal(transition(at({ overlay: 'placeholder' }), 'openPalette').overlay, 'placeholder');
  assert.equal(transition(at({ overlay: 'menu' }), 'openPlaceholder').overlay, 'menu');
});

test('mode transitions in the diagram', () => {
  const cases = [
    ['browsing', 'editOn', 'editIdle'], ['editIdle', 'press', 'pressed'], ['pressed', 'passThreshold', 'dragging'],
    ['pressed', 'release', 'editIdle'], ['pressed', 'escape', 'editIdle'], ['pressed', 'render', 'editIdle'],
    ['dragging', 'drop', 'editIdle'], ['dragging', 'escape', 'editIdle'], ['dragging', 'render', 'editIdle'],
    ['editIdle', 'editOff', 'browsing'], ['editIdle', 'escape', 'browsing'],
  ];
  for (const [from, event, to] of cases) assert.equal(transition(at({ mode: from }), /** @type {any} */ (event)).mode, to, `${from} --${event}-->`);
  assert.equal(transition(at({ mode: 'browsing' }), 'press').mode, 'browsing', 'no press outside Edit mode');
  assert.equal(transition(at({ mode: 'editIdle', overlay: 'menu' }), 'press').mode, 'editIdle', 'no press under an overlay');
});

test('view and Quick find transitions in the diagram', () => {
  assert.equal(transition(at({}), 'openSystem').view, 'system');
  for (const event of /** @type {const} */ (['toGalaxy', 'escape'])) assert.equal(transition(at({ view: 'system' }), event).view, 'galaxy');
  assert.equal(transition(at({ view: 'error' }), 'openSystem').view, 'error', 'the error view is a dead end');
  assert.equal(transition(at({ view: 'error' }), 'toGalaxy').view, 'error');
  assert.equal(transition(at({}), 'type').find, 'filtering');
  assert.equal(transition(at({ find: 'filtering' }), 'clearFind').find, 'empty');
  assert.equal(transition(at({ find: 'filtering' }), 'escape').find, 'empty');
});

test('MR01, MR02: Escape order is overlay, then a held item, then Edit mode, then Quick find, then System', () => {
  let state = at({ overlay: 'palette', mode: 'dragging', find: 'filtering', view: 'system' });
  const order = [];
  for (let i = 0; i < 6; i++) {
    order.push(escapeTarget(state));
    state = transition(state, 'escape');
  }
  assert.deepEqual(order, ['overlay', 'drag', 'edit', 'find', 'view', null]);
  assert.deepEqual(state, { overlay: 'none', mode: 'browsing', view: 'galaxy', find: 'empty' });
  const rest = initialModes();
  assert.equal(transition(rest, 'escape'), rest, 'Escape at rest does nothing');
});

test('MR03, MR06, MR12: what an open overlay or the error view blocks', () => {
  assert.equal(keyAllowed(at({ overlay: 'menu' }), 'commandK'), false);
  assert.equal(keyAllowed(at({ overlay: 'menuEditor' }), 'slash'), false);
  assert.equal(keyAllowed(at({ overlay: 'placeholder' }), 'commandK'), false);
  assert.equal(keyAllowed(at({ overlay: 'placeholder' }), 'slash'), false);
  assert.equal(keyAllowed(at({ overlay: 'placeholder' }), 'other'), false);
  assert.equal(keyAllowed(at({ overlay: 'placeholder' }), 'escape'), true);
  assert.equal(keyAllowed(at({ view: 'error' }), 'commandK'), false);
  assert.equal(transition(at({ view: 'error' }), 'openPalette').overlay, 'none');
  assert.equal(keyAllowed(at({}), 'commandK'), true);
  assert.equal(keyAllowed(at({ overlay: 'palette' }), 'slash'), true);
});

test('MR04: Edit mode stays on when the menu or editor opens; only a held item is dropped', () => {
  assert.equal(transition(at({ mode: 'editIdle' }), 'openMenu').mode, 'editIdle');
  assert.equal(transition(at({ mode: 'dragging' }), 'openEditor').mode, 'editIdle');
});

test('MR07, MR08: a press or drag never survives an overlay, a page change, a workspace switch, Edit mode off, or a render', () => {
  for (const mode of /** @type {const} */ (['pressed', 'dragging'])) {
    for (const event of /** @type {const} */ (['openMenu', 'openPalette', 'openEditor', 'openPlaceholder', 'pageChange', 'switchWorkspace', 'render', 'cancelDrag'])) {
      assert.equal(transition(at({ mode }), event).mode, 'editIdle', `${mode} then ${event}`);
    }
    assert.equal(transition(at({ mode }), 'editOff').mode, 'browsing');
  }
});

test('a page change closes the menu but not the palette or placeholder form', () => {
  for (const overlay of ['menu', 'menuPanel', 'menuEditor']) assert.equal(transition(at({ overlay }), 'pageChange').overlay, 'none');
  for (const overlay of ['palette', 'placeholder']) assert.equal(transition(at({ overlay }), 'pageChange').overlay, overlay);
});

test('MR09: typing in Quick find inside a System returns to the Galaxy', () => {
  assert.deepEqual(transition(at({ view: 'system' }), 'type'), { ...initialModes(), find: 'filtering' });
});

test('MR10: routine offers depend on Edit mode only, not on an open overlay', () => {
  assert.equal(routineOffersAllowed(at({})), true);
  assert.equal(routineOffersAllowed(at({ overlay: 'menu' })), true);
  assert.equal(routineOffersAllowed(at({ mode: 'editIdle' })), false);
});

test('MR11: in Edit mode, links in the app and palette matches open the editor; notice links still open', () => {
  const edit = at({ mode: 'editIdle' });
  assert.equal(linkOpensEditor(edit, 'app'), true);
  assert.equal(linkOpensEditor(edit, 'palette'), true);
  assert.equal(linkOpensEditor(edit, 'notice'), false);
  assert.equal(linkOpensEditor(at({}), 'app'), false);
});

test('queries: inEditMode and menuOpen', () => {
  assert.equal(inEditMode(at({ mode: 'dragging' })), true);
  assert.equal(inEditMode(at({})), false);
  assert.equal(menuOpen(at({ overlay: 'menuPanel' })), true);
  assert.equal(menuOpen(at({ overlay: 'palette' })), false);
});

test('an event that does not apply returns the same state object', () => {
  const state = at({ overlay: 'menu' });
  assert.equal(transition(state, 'openPalette'), state);
  assert.equal(transition(state, 'passThreshold'), state);
});

const events = /** @type {const} */ (['openPalette', 'openPlaceholder', 'openMenu', 'openEditor', 'choosePanel', 'backToPanels', 'closeOverlay',
  'runEntry', 'editOn', 'editOff', 'press', 'passThreshold', 'release', 'drop', 'cancelDrag', 'render', 'openSystem', 'toGalaxy',
  'pageChange', 'switchWorkspace', 'type', 'clearFind', 'escape']);

test('invariants hold after any sequence: a held item implies Edit mode and no overlay; the error view stays', () => {
  fc.assert(fc.property(fc.boolean(), fc.array(fc.constantFrom(...events), { maxLength: 40 }), (failed, list) => {
    let state = failed ? transition(initialModes(), 'loadFailed') : initialModes();
    for (const event of list) {
      state = transition(state, event);
      if (state.mode === 'pressed' || state.mode === 'dragging') {
        assert.equal(state.overlay, 'none', `held under an overlay after ${event}`);
        assert.notEqual(state.view, 'error');
      }
      if (failed) assert.equal(state.view, 'error');
      assert.ok(Object.isFrozen(state));
    }
    // Enough Escapes always get back to the resting state of the view.
    for (let i = 0; i < 5; i++) state = transition(state, 'escape');
    assert.deepEqual({ ...state, view: undefined }, { overlay: 'none', mode: 'browsing', find: 'empty', view: undefined });
  }), { numRuns: 500, seed: 2026 });
});
