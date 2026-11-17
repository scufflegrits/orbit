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

// Move a planet to the end of another sun, or a moon to the end of another
// planet. Returns { status: 'moved', groups, path } with a fresh copy, or
// { status: 'same' } / { status: 'invalid' } without touching anything.
function moveMapItem(list, source, target) {
  const parentKind = { planet: 'sun', moon: 'planet' }[source.kind];
  if (!parentKind || target.kind !== parentKind) return { status: 'invalid' };
  if (!mapItemAt(list, source) || !mapItemAt(list, target)) return { status: 'invalid' };
  if (target.sun === source.sun && (parentKind === 'sun' || target.planet === source.planet)) {
    return { status: 'same' };
  }
  const next = JSON.parse(JSON.stringify(list));
  if (source.kind === 'planet') {
    const [moved] = next[source.sun].links.splice(source.planet, 1);
    const siblings = next[target.sun].links;
    siblings.push(moved);
    return { status: 'moved', groups: next,
      path: { kind: 'planet', sun: target.sun, planet: siblings.length - 1 } };
  }
  const [moved] = next[source.sun].links[source.planet].moons.splice(source.moon, 1);
  const siblings = next[target.sun].links[target.planet].moons;
  siblings.push(moved);
  return { status: 'moved', groups: next,
    path: { kind: 'moon', sun: target.sun, planet: target.planet, moon: siblings.length - 1 } };
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

function sourceLabel() {
  return `${drag.path.kind} ${drag.item.name}`;
}

function parentName(path) {
  const parent = path.kind === 'sun' ? groups[path.sun] : groups[path.sun].links[path.planet];
  return parent.name;
}

function buildTray(pointerX) {
  const tray = element('aside', 'drag-tray');
  tray.classList.add(pointerX > window.innerWidth / 2 ? 'drag-tray-left' : 'drag-tray-right');
  const current = Number(app.querySelector('.detail-stage').dataset.sun);
  const forPlanet = drag.path.kind === 'planet';
  tray.append(element('h2', '', forPlanet ? 'Move to another sun' : 'Move to a planet'));
  groups.forEach((sun, sunIndex) => {
    if (forPlanet) {
      if (sunIndex === current) return;
      const row = tagPath(element('div', 'tray-row'), 'sun', sunIndex);
      row.append(element('span', 'tray-name', sun.name),
        element('span', 'tray-count', `${sun.links.length} planets`));
      tray.append(row);
      return;
    }
    const group = element('div', 'tray-group');
    if (sunIndex === current) group.classList.add('open');
    group.append(element('div', 'tray-head', sunIndex === current ? `${sun.name} (this System)` : sun.name));
    const list = element('div', 'tray-list');
    sun.links.forEach((planet, planetIndex) => {
      const row = tagPath(element('div', 'tray-row'), 'planet', sunIndex, planetIndex);
      row.append(element('span', 'tray-name', planet.name),
        element('span', 'tray-count', `${planet.moons.length} moons`));
      list.append(row);
    });
    if (!sun.links.length) list.append(element('p', 'tray-empty', 'No planets yet.'));
    group.append(list);
    tray.append(group);
  });
  if (!forPlanet) tray.append(element('p', 'tray-hint', 'Pause on a sun to show its planets.'));
  document.body.append(tray);
  return tray;
}

function startDrag(event) {
  drag.state = 'dragging';
  try { drag.node.setPointerCapture(drag.pointerId); } catch { /* Events still bubble to the document. */ }
  window.getSelection()?.removeAllRanges();
  document.documentElement.classList.add('dragging');
  drag.node.classList.add('drag-source');
  // Keep the source visible without relying on hover or focus.
  drag.node.closest('.home-orbit')?.classList.add('drag-open');
  if (drag.path.kind === 'moon') {
    drag.node.closest('.planet-cluster, .overflow-planet')?.classList.add('drag-open');
  }
  drag.preview = element('div', 'drag-preview');
  drag.preview.append(element('strong', '', drag.item.name), element('span', 'drag-hint', ''));
  document.body.append(drag.preview);
  if (app.classList.contains('detail-view')) drag.tray = buildTray(event.clientX);
  announce(drag.path.kind === 'planet'
    ? `Moving planet ${drag.item.name}. Drop it on another sun.`
    : `Moving moon ${drag.item.name}. Drop it on another planet.`);
}

// Phase 1: a planet lands on a sun and a moon lands on a planet.
function resolveTarget(under) {
  if (!under) return { status: 'none' };
  const want = drag.path.kind === 'planet' ? 'sun' : 'planet';
  const tagged = under.closest('[data-kind]');
  let node = tagged?.dataset.kind === want ? tagged : null;
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
  if (node.classList.contains('tray-group')) {
    for (const other of drag.tray.querySelectorAll('.tray-group.open')) other.classList.remove('open');
    node.classList.add('open');
  } else {
    node.classList.add('drag-open', 'drag-reveal');
  }
  refreshDrag();
  // Revealed planets travel outward for a moment; hit-test again once they settle.
  setTimeout(refreshDrag, 450);
}

function updateDwell(under) {
  const node = under?.closest(drag.path.kind === 'moon'
    ? '.tray-group:not(.open), .home-orbit:not(.drag-open)' : '.tray-group:not(.open)') || null;
  for (const orbit of app.querySelectorAll('.home-orbit.drag-reveal')) {
    if (!under || !orbit.contains(under)) orbit.classList.remove('drag-open', 'drag-reveal');
  }
  if (node === drag.dwellNode) return;
  clearTimeout(drag.dwellTimer);
  drag.dwellNode = node;
  if (node) drag.dwellTimer = setTimeout(() => openDwell(node), DWELL_MS);
}

function updateDrag(x, y) {
  drag.x = x;
  drag.y = y;
  drag.preview.style.transform = `translate(${x + 14}px, ${y + 16}px)`;
  const under = document.elementFromPoint(x, y);
  updateDwell(under);
  const target = resolveTarget(under);
  const changed = target.node !== drag.target?.node || target.status !== drag.target?.status;
  if (!changed) return;
  drag.target?.node?.classList.remove('drop-target', 'drop-same');
  const leftTarget = drag.target?.status === 'valid';
  drag.target = target;
  const hint = drag.preview.querySelector('.drag-hint');
  drag.preview.classList.toggle('drag-preview-valid', target.status === 'valid');
  if (target.status === 'valid') {
    target.node.classList.add('drop-target');
    hint.textContent = `Drop to move to ${parentName(target.path)}`;
    announce(`Over ${target.path.kind} ${parentName(target.path)}. Release to move ${drag.item.name} here.`);
  } else if (target.status === 'same') {
    target.node.classList.add('drop-same');
    hint.textContent = `Already in ${parentName(target.path)}`;
  } else {
    hint.textContent = drag.path.kind === 'planet' ? 'Drop on another sun' : 'Drop on another planet';
  }
  if (leftTarget && target.status !== 'valid') announce(`No drop target. ${hint.textContent}.`);
}

function refreshDrag() {
  if (drag?.state === 'dragging') updateDrag(drag.x, drag.y);
}

function endGesture() {
  const gesture = drag;
  drag = null;
  clearTimeout(gesture.dwellTimer);
  if (gesture.state !== 'dragging') return gesture;
  try { gesture.node.releasePointerCapture(gesture.pointerId); } catch { /* Already released. */ }
  gesture.preview.remove();
  gesture.tray?.remove();
  document.documentElement.classList.remove('dragging');
  for (const node of document.querySelectorAll('.drag-open, .drag-reveal, .drop-target, .drop-same, .drag-source')) {
    node.classList.remove('drag-open', 'drag-reveal', 'drop-target', 'drop-same', 'drag-source');
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
  const label = `${gesture.path.kind} ${gesture.item.name} to ${parentName(target.path)}`;
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
  if (path.kind === 'sun' || !item) return;
  drag = { state: 'pressed', pointerId: event.pointerId, node, path, item,
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
  else if (target?.status === 'same') announce(`${gesture.item.name} is already in ${parentName(target.path)}. Nothing changed.`);
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
window.addEventListener('scroll', refreshDrag, { passive: true });
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
