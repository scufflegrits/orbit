// Edit mode and drag-and-drop organization. Loaded as a classic script after
// render.js and before keys.js and app.js. Dragging changes array order and
// parent membership only; it never stores positions. Uses shared state from
// app.js (app, groups, mapRevision, menuOverlay, MAP_STORAGE_KEY) only when
// called.

const editToggle = document.querySelector('#edit-toggle');
const editBar = document.querySelector('#edit-bar');
const editStatus = document.querySelector('#edit-status');
const editUndo = document.querySelector('#edit-undo');
const DRAG_THRESHOLD = 6;
const DWELL_MS = 350;
let editMode = false;
let drag = null;
let dragUndo = null;
let suppressNextClick = false;

// ---- Pure map operation -------------------------------------------------

// Paths use array indices: { kind: 'sun', sun }, { kind: 'planet', sun, planet },
// or { kind: 'moon', sun, planet, moon }.
function mapItemAt(list, path) {
  const sun = list[path.sun];
  if (path.kind === 'sun') return sun || null;
  const planet = sun?.links[path.planet];
  if (path.kind === 'planet') return planet || null;
  return path.kind === 'moon' ? planet?.moons[path.moon] || null : null;
}

function samePath(a, b) {
  return a.kind === b.kind && a.sun === b.sun && a.planet === b.planet && a.moon === b.moon;
}

// Move one item. A parent target ({ kind: 'sun' } for a planet, { kind:
// 'planet' } for a moon) appends. A sibling target (same kind as the source,
// with place: 'before' | 'after') reorders within one parent or inserts under
// another; suns can only be reordered. Returns { status: 'moved', groups, path }
// with a fresh copy, or { status: 'same' } / { status: 'invalid' } without
// touching anything.
function moveMapItem(list, source, target) {
  const key = source.kind;
  const parentKind = { planet: 'sun', moon: 'planet' }[key];
  const sibling = target.kind === key && (target.place === 'before' || target.place === 'after');
  if (!['sun', 'planet', 'moon'].includes(key)) return { status: 'invalid' };
  if (!sibling && (!parentKind || target.kind !== parentKind)) return { status: 'invalid' };
  if (!mapItemAt(list, source) || !mapItemAt(list, target)) return { status: 'invalid' };
  if (sibling && samePath(source, target)) return { status: 'invalid' };
  const next = JSON.parse(JSON.stringify(list));
  const siblingsAt = path => key === 'sun' ? next
    : key === 'planet' ? next[path.sun].links : next[path.sun].links[path.planet].moons;
  const from = siblingsAt(source);
  const to = siblingsAt(target);
  let index = sibling ? target[key] + (target.place === 'after' ? 1 : 0) : to.length;
  if (from === to) {
    if (!sibling) return { status: 'same' };
    // Removing the source first shifts every later sibling down by one.
    if (source[key] < index) index--;
    if (index === source[key]) return { status: 'same' };
  }
  const [moved] = from.splice(source[key], 1);
  to.splice(index, 0, moved);
  const path = { kind: key, sun: key === 'sun' ? index : target.sun };
  if (key !== 'sun') path.planet = key === 'planet' ? index : target.planet;
  if (key === 'moon') path.moon = index;
  return { status: 'moved', groups: next, path, total: to.length };
}

// ---- Edit mode ----------------------------------------------------------

function storageToken() {
  try { return localStorage.getItem(MAP_STORAGE_KEY); } catch { return undefined; }
}

function announce(message, isError = false) {
  editStatus.textContent = message;
  editStatus.classList.toggle('edit-status-error', isError);
}

// Render without the jump to the top or the entrance animations.
function keepingScroll(action) {
  const top = window.scrollY;
  action();
  app.classList.add('no-intro');
  window.scrollTo({ top, behavior: 'instant' });
}

function dragUndoValid() {
  return Boolean(dragUndo) && dragUndo.revision === mapRevision && dragUndo.token === storageToken();
}

function updateEditBar() {
  // Any later map change bumps mapRevision, which retires the Undo record.
  if (dragUndo && !dragUndoValid()) dragUndo = null;
  editUndo.hidden = !dragUndo;
}

function setEditMode(on) {
  if (editMode === on) return;
  cancelDrag();
  editMode = on;
  document.documentElement.dataset.edit = on ? 'on' : 'off';
  editToggle.setAttribute('aria-pressed', String(on));
  editToggle.querySelector('.edit-toggle-state').textContent = on ? 'On' : 'Off';
  editBar.hidden = !on;
  announce('');
  if (!app.classList.contains('error-view')) keepingScroll(render);
}

function pathOf(node) {
  const data = node.dataset;
  const path = { kind: data.kind, sun: Number(data.sun) };
  if (data.planet !== undefined) path.planet = Number(data.planet);
  if (data.moon !== undefined) path.moon = Number(data.moon);
  return path;
}

function pathSelector(path) {
  let selector = `[data-kind="${path.kind}"][data-sun="${path.sun}"]`;
  if (path.planet !== undefined) selector += `[data-planet="${path.planet}"]`;
  if (path.moon !== undefined) selector += `[data-moon="${path.moon}"]`;
  return selector;
}

function focusPath(path) {
  // A moved item may be rendered twice, sit behind a hover reveal, or be gone
  // from this view; the notice is always there to fall back on.
  for (const node of app.querySelectorAll(pathSelector(path))) {
    const holders = [node.closest('.home-orbit'), path.kind === 'moon' && node.closest('.planet-cluster')]
      .filter(Boolean);
    // Open the reveal for the moment of focusing; focus then keeps it open.
    holders.forEach(holder => holder.classList.add('drag-open'));
    node.focus({ preventScroll: true });
    holders.forEach(holder => holder.classList.remove('drag-open'));
    if (document.activeElement === node) return;
  }
  editStatus.focus({ preventScroll: true });
}

// ---- Drag gesture -------------------------------------------------------

function nameAt(path) {
  return mapItemAt(groups, path).name;
}

function counted(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function trayRow(className, name, count, kind, ...indices) {
  const row = element('div', className);
  if (kind) tagPath(row, kind, ...indices);
  row.append(element('span', 'tray-name', name));
  if (count) row.append(element('span', 'tray-count', count));
  return row;
}

// Only one sun is on screen in a System, so a drag gets a list of the rest.
// Planet drag: other suns (drop to append; pause to list their planets).
// Moon drag: every sun's planets (drop to append; pause to list their moons).
function buildTray(pointerX) {
  const tray = element('aside', 'drag-tray');
  tray.classList.add(pointerX > window.innerWidth / 2 ? 'drag-tray-left' : 'drag-tray-right');
  const current = Number(app.querySelector('.detail-stage').dataset.sun);
  const forPlanet = drag.path.kind === 'planet';
  tray.append(element('h2', '', forPlanet ? 'Move to another sun' : 'Move to a planet'));
  groups.forEach((sun, sunIndex) => {
    if (forPlanet && sunIndex === current) return;
    const group = element('div', 'tray-group');
    if (!forPlanet && sunIndex === current) group.classList.add('open');
    const count = counted(sun.links.length, 'planet');
    group.append(forPlanet ? trayRow('tray-row tray-head', sun.name, count, 'sun', sunIndex)
      : trayRow('tray-head', sunIndex === current ? `${sun.name} (this System)` : sun.name, count));
    const list = element('div', 'tray-list');
    sun.links.forEach((planet, planetIndex) => {
      const item = element('div', 'tray-item');
      item.append(trayRow('tray-row', planet.name, forPlanet ? '' : counted(planet.moons.length, 'moon'),
        'planet', sunIndex, planetIndex));
      if (!forPlanet && planet.moons.length) {
        item.classList.add('tray-expandable');
        const moons = element('div', 'tray-sublist');
        planet.moons.forEach((moon, moonIndex) => moons.append(
          trayRow('tray-row tray-moon', moon.name, '', 'moon', sunIndex, planetIndex, moonIndex)));
        item.append(moons);
      }
      list.append(item);
    });
    if (!sun.links.length) list.append(element('p', 'tray-empty', 'No planets yet.'));
    group.append(list);
    tray.append(group);
  });
  tray.append(element('p', 'tray-hint', forPlanet
    ? 'Pause on a sun to place the planet beside one of its planets.'
    : 'Pause on a sun to show its planets, and on a planet to show its moons.'));
  document.body.append(tray);
  return tray;
}

const DRAG_HELP = {
  sun: 'Drop beside another sun',
  planet: 'Drop on a sun, or beside a planet',
  moon: 'Drop on a planet, or beside a moon',
};

function startDrag(event) {
  drag.state = 'dragging';
  try { drag.node.setPointerCapture(drag.pointerId); } catch { /* Events still bubble to the document. */ }
  window.getSelection()?.removeAllRanges();
  document.documentElement.classList.add('dragging');
  drag.node.classList.add('drag-source');
  // Keep the source visible without relying on hover or focus.
  if (drag.path.kind !== 'sun') drag.node.closest('.home-orbit')?.classList.add('drag-open');
  if (drag.path.kind === 'moon') {
    drag.node.closest('.planet-cluster, .overflow-planet')?.classList.add('drag-open');
  }
  drag.preview = element('div', 'drag-preview');
  drag.preview.append(element('strong', '', drag.item.name), element('span', 'drag-hint', ''));
  document.body.append(drag.preview);
  if (app.classList.contains('detail-view')) drag.tray = buildTray(event.clientX);
  announce(`Moving ${drag.path.kind} ${drag.item.name}. ${DRAG_HELP[drag.path.kind]}.`);
}

// A sibling needs an explicit Before or After, because positions on an orbit
// do not show array order.
function showChoices(sibling, path) {
  if (drag.choices?.sibling === sibling) return;
  hideChoices();
  const box = element('div', 'drop-choices');
  for (const [place, word] of [['before', 'Before'], ['after', 'After']]) {
    const choice = element('div', 'drop-choice', `${word} ${nameAt(path)}`);
    choice.dataset.place = place;
    box.append(choice);
  }
  document.body.append(box);
  const rect = sibling.getBoundingClientRect();
  const clamp = (value, size, limit) => Math.max(8, Math.min(value, limit - size - 8));
  box.style.left = `${clamp(rect.left + rect.width / 2 - box.offsetWidth / 2, box.offsetWidth, window.innerWidth)}px`;
  box.style.top = `${clamp(rect.top + rect.height / 2 - box.offsetHeight / 2, box.offsetHeight, window.innerHeight)}px`;
  drag.choices = { box, sibling, path };
}

function hideChoices() {
  drag.choices?.box.remove();
  drag.choices = null;
}

function siblingTarget(choice) {
  const { sibling } = drag.choices;
  const path = { ...drag.choices.path, place: choice.dataset.place };
  const result = moveMapItem(groups, drag.path, path);
  if (result.status !== 'moved') return { status: result.status === 'same' ? 'same' : 'none', node: choice, path, sibling };
  const index = result.path[drag.path.kind];
  return { status: 'valid', node: choice, path, sibling, position: `position ${index + 1} of ${result.total}` };
}

function resolveTarget(under) {
  if (!under) return { status: 'none' };
  const kind = drag.path.kind;
  if (drag.choices && under.closest('.drop-choices')) {
    const choice = under.closest('.drop-choice');
    return choice ? siblingTarget(choice)
      : { status: 'choose', node: drag.choices.sibling, path: drag.choices.path };
  }
  const tagged = under.closest('[data-kind]');
  let node = tagged;
  // A whole Galaxy card stands in for its sun when suns are being reordered.
  if (kind === 'sun') node = under.closest('.group-card')?.querySelector('.home-hub') || null;
  if (node?.dataset.kind === kind) {
    const path = pathOf(node);
    return samePath(path, drag.path) ? { status: 'none' } : { status: 'choose', node, path };
  }
  const want = { planet: 'sun', moon: 'planet' }[kind];
  node = want && tagged?.dataset.kind === want ? tagged : null;
  // The whole orbit stands in for its sun, so a planet does not need a precise drop.
  if (!node && want === 'sun') {
    node = under.closest('.home-orbit, .detail-stage')?.querySelector('.home-hub, .detail-hub') || null;
  }
  if (!node) return { status: 'none' };
  const path = pathOf(node);
  const same = path.sun === drag.path.sun && (want === 'sun' || path.planet === drag.path.planet);
  return { status: same ? 'same' : 'valid', node, path };
}

function openDwell(node) {
  if (!drag || drag.dwellNode !== node) return;
  if (node.matches('.tray-group, .tray-item')) {
    const scope = node.matches('.tray-group') ? '.tray-group.open' : '.tray-item.open';
    for (const other of drag.tray.querySelectorAll(scope)) other.classList.remove('open');
    node.classList.add('open');
  } else {
    node.classList.add('drag-open', 'drag-reveal');
  }
  drag.dwellNode = null;
  refreshDrag();
  // Revealed planets travel outward for a moment; hit-test again once they settle.
  setTimeout(refreshDrag, 450);
}

// What a pause over this element would open: a tray branch, another sun's
// planets, or (for a moon) another planet's moons.
function dwellCandidate(under) {
  const branch = under.closest('.tray-expandable:not(.open), .tray-group:not(.open)');
  if (branch || drag.path.kind === 'sun' || under.closest('.drag-tray, .drop-choices')) return branch;
  const cluster = drag.path.kind === 'moon'
    ? under.closest('.planet-cluster:not(.drag-open), .overflow-planet:not(.drag-open)') : null;
  return cluster || under.closest('.home-orbit:not(.drag-open)');
}

function updateDwell(under) {
  // A reveal closes shortly after the pointer leaves it; the gap between a
  // planet and its moons must not close it.
  for (const reveal of app.querySelectorAll('.drag-reveal')) {
    const inside = under && (reveal.contains(under) || under.closest('.drop-choices'));
    if (inside) {
      clearTimeout(drag.closing.get(reveal));
      drag.closing.delete(reveal);
    } else if (!drag.closing.has(reveal)) {
      drag.closing.set(reveal, setTimeout(() => {
        reveal.classList.remove('drag-open', 'drag-reveal');
        drag?.closing.delete(reveal);
        refreshDrag();
      }, DWELL_MS));
    }
  }
  const node = under ? dwellCandidate(under) : null;
  if (node === drag.dwellNode) return;
  clearTimeout(drag.dwellTimer);
  drag.dwellNode = node;
  if (node) drag.dwellTimer = setTimeout(() => openDwell(node), DWELL_MS);
}

function placePreview(x, y) {
  let left = x + 14;
  let top = y + 16;
  if (drag.choices) {
    // Stay beside the Before and After choices instead of covering them.
    const box = drag.choices.box.getBoundingClientRect();
    left = box.right + 10;
    if (left + drag.preview.offsetWidth > window.innerWidth - 8) left = box.left - drag.preview.offsetWidth - 10;
    top = box.top;
  }
  drag.preview.style.transform = `translate(${left}px, ${top}px)`;
}

function updateDrag(x, y) {
  drag.x = x;
  drag.y = y;
  const under = document.elementFromPoint(x, y);
  updateDwell(under);
  const target = resolveTarget(under);
  if (target.status === 'choose') showChoices(target.node, target.path);
  else if (!target.sibling) hideChoices();
  placePreview(x, y);
  const changed = target.node !== drag.target?.node || target.status !== drag.target?.status;
  if (!changed) return;
  drag.target?.node?.classList.remove('drop-target', 'drop-same');
  drag.target?.sibling?.classList.remove('insert-before', 'insert-after');
  const leftTarget = drag.target?.status === 'valid';
  drag.target = target;
  const hint = drag.preview.querySelector('.drag-hint');
  drag.preview.classList.toggle('drag-preview-valid', target.status === 'valid');
  if (target.status === 'valid' && target.sibling) {
    target.node.classList.add('drop-target');
    target.sibling.classList.add(`insert-${target.path.place}`);
    hint.textContent = `Insert ${target.path.place} ${nameAt(target.path)}, ${target.position}`;
    announce(`Insert ${drag.item.name} ${target.path.place} ${nameAt(target.path)}, ${target.position}. Release to place it.`);
  } else if (target.status === 'valid') {
    target.node.classList.add('drop-target');
    hint.textContent = `Drop to move to ${nameAt(target.path)}`;
    announce(`Over ${target.path.kind} ${nameAt(target.path)}. Release to move ${drag.item.name} here.`);
  } else if (target.status === 'same') {
    target.node.classList.add('drop-same');
    hint.textContent = target.sibling ? 'Already in this position' : `Already in ${nameAt(target.path)}`;
  } else if (target.status === 'choose') {
    hint.textContent = `Choose Before or After ${nameAt(target.path)}`;
    announce(`Beside ${target.path.kind} ${nameAt(target.path)}. Choose Before or After.`);
  } else {
    hint.textContent = DRAG_HELP[drag.path.kind];
  }
  if (leftTarget && target.status !== 'valid') announce(`No drop target. ${hint.textContent}.`);
}

function refreshDrag() {
  if (drag?.state === 'dragging') updateDrag(drag.x, drag.y);
}

function endGesture() {
  const gesture = drag;
  clearTimeout(gesture.dwellTimer);
  for (const timer of gesture.closing.values()) clearTimeout(timer);
  if (gesture.state === 'dragging') hideChoices();
  drag = null;
  if (gesture.state !== 'dragging') return gesture;
  try { gesture.node.releasePointerCapture(gesture.pointerId); } catch { /* Already released. */ }
  gesture.preview.remove();
  gesture.tray?.remove();
  document.documentElement.classList.remove('dragging');
  const marks = ['drag-open', 'drag-reveal', 'drop-target', 'drop-same', 'drag-source', 'insert-before', 'insert-after'];
  for (const node of document.querySelectorAll(marks.map(mark => `.${mark}`).join(', '))) {
    node.classList.remove(...marks);
  }
  // The browser still sends a click after the release; it must not open anything.
  suppressNextClick = true;
  return gesture;
}

// Ends any press or drag without changing the map. Returns true if there was one.
function cancelDrag(message = 'Move cancelled. Nothing changed.') {
  if (!drag) return false;
  const gesture = endGesture();
  if (gesture.state === 'dragging') announce(message);
  return true;
}

function commitMove(gesture, target) {
  if (gesture.token !== storageToken()) {
    return announce('The link map changed in another tab, so nothing was moved. Reload this page to pick up the latest map.', true);
  }
  if (gesture.revision !== mapRevision || mapItemAt(groups, gesture.path) !== gesture.item) {
    return announce('The link map changed during the drag, so nothing was moved.', true);
  }
  const result = moveMapItem(groups, gesture.path, target.path);
  if (result.status !== 'moved') return announce('That is not a place this item can go. Nothing changed.');
  const previous = groups;
  const where = target.path.place ? `${target.path.place} ${nameAt(target.path)}` : `to ${nameAt(target.path)}`;
  const label = `${gesture.path.kind} ${gesture.item.name} ${where}`;
  try {
    keepingScroll(() => saveMap({ groups: result.groups }));
  } catch (error) {
    return announce(`The move could not be saved, so nothing changed. ${error.message}`, true);
  }
  dragUndo = { groups: previous, revision: mapRevision, token: storageToken(), label };
  updateEditBar();
  announce(`Moved ${label}.`);
  focusPath(result.path);
}

function undoDrag() {
  const record = dragUndo;
  if (!dragUndoValid()) {
    dragUndo = null;
    updateEditBar();
    return announce('The link map has changed since that drag, so it can no longer be undone.', true);
  }
  try {
    keepingScroll(() => saveMap({ groups: record.groups }));
  } catch (error) {
    return announce(`Undo could not be saved, so nothing changed. ${error.message}`, true);
  }
  dragUndo = null;
  updateEditBar();
  announce(`Undid the move of ${record.label}.`);
  editStatus.focus({ preventScroll: true });
}

// ---- Events -------------------------------------------------------------

document.addEventListener('pointerdown', event => {
  suppressNextClick = false;
  if (!editMode || drag || !menuOverlay.hidden) return;
  if (event.button !== 0 || !event.isPrimary || event.pointerType === 'touch') return;
  const node = event.target instanceof Element ? event.target.closest('[data-kind]') : null;
  if (!node || !app.contains(node)) return;
  const path = pathOf(node);
  const item = mapItemAt(groups, path);
  // The System hub is not a source: there is nothing to reorder it against.
  if (!item || (path.kind === 'sun' && !node.classList.contains('home-hub'))) return;
  drag = { state: 'pressed', pointerId: event.pointerId, node, path, item, closing: new Map(),
    revision: mapRevision, token: storageToken(), startX: event.clientX, startY: event.clientY };
});

document.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (drag.state === 'pressed') {
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
    startDrag(event);
  }
  updateDrag(event.clientX, event.clientY);
});

document.addEventListener('pointerup', event => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (drag.state === 'dragging') updateDrag(event.clientX, event.clientY);
  const target = drag.target;
  const gesture = endGesture();
  if (gesture.state !== 'dragging') return;
  if (target?.status === 'valid') commitMove(gesture, target);
  else if (target?.status === 'same') {
    announce(target.sibling ? `${gesture.item.name} is already in that position. Nothing changed.`
      : `${gesture.item.name} is already in ${nameAt(target.path)}. Nothing changed.`);
  } else if (target?.status === 'choose') {
    announce(`Choose Before or After to place ${gesture.item.name} beside ${nameAt(target.path)}. Nothing changed.`);
  }
  else announce('That was not a drop target. Nothing changed.');
});

// A click follows the release in the same task; after that the guard is spent.
document.addEventListener('pointerup', () => setTimeout(() => { suppressNextClick = false; }, 0));

document.addEventListener('pointercancel', event => {
  if (drag && event.pointerId === drag.pointerId) cancelDrag();
});
document.addEventListener('lostpointercapture', event => {
  if (drag?.state === 'dragging' && event.target === drag.node && event.pointerId === drag.pointerId) cancelDrag();
});
window.addEventListener('blur', () => cancelDrag('Move cancelled because the window lost focus. Nothing changed.'));
// Scrolling moves the page under the fixed Before and After choices.
window.addEventListener('scroll', () => { if (drag?.state === 'dragging') hideChoices(); refreshDrag(); }, { passive: true });
window.addEventListener('resize', refreshDrag);
window.addEventListener('storage', updateEditBar);

function guardActivation(event) {
  if (suppressNextClick) {
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (!editMode || !(event.target instanceof Element)) return;
  const node = event.target.closest('[data-kind="planet"], [data-kind="moon"]');
  if (!node || !app.contains(node)) return;
  event.preventDefault();
  event.stopPropagation();
  announce(`Links are closed in Edit mode. Drag ${node.textContent} to move it, or turn Edit mode off to open it.`);
}
// Capture phase, so the destination's own handlers never see the click.
document.addEventListener('click', guardActivation, true);
document.addEventListener('auxclick', guardActivation, true);
document.addEventListener('dragstart', event => {
  if (editMode && event.target instanceof Node && app.contains(event.target)) event.preventDefault();
});

editToggle.addEventListener('click', () => setEditMode(!editMode));
editUndo.addEventListener('click', undoDrag);
document.querySelector('#edit-done').addEventListener('click', () => {
  setEditMode(false);
  editToggle.focus();
});
document.querySelector('#edit-open-editor').addEventListener('click', () => {
  openMenu();
  openEditorPage();
});
