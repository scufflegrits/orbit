// Keyboard handling: menu focus trap, Escape layers, Quick find keys, and arrow
// navigation through suns, planets, and moons. Loaded as a classic
// script before app.js. Uses shared state from app.js and menu.js (menuOverlay,
// quickFind, app) and the modes (drag.js orbitModes) only when a key is pressed.

function menuFocusables() {
  return [...menuOverlay.querySelectorAll('.menu-sheet :is(button, a[href], input, select, textarea, [tabindex])')]
    .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length > 0);
}

// Keep Tab and Shift+Tab inside the open menu.
function trapMenuFocus(event) {
  const items = menuFocusables();
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const inside = menuOverlay.querySelector('.menu-sheet').contains(document.activeElement);
  if (!inside) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

// Escape handles the topmost layer, as src/ui/modes.js orders them: an
// overlay (the palette and placeholder form handle their own Escape, so
// here it is the menu), then a pressed or dragged item, then Edit mode, then
// Quick find, then a System.
function handleEscape(event) {
  const target = orbitModes.escapeTarget();
  if (target === 'overlay') {
    event.preventDefault();
    closeMenu();
  } else if (target === 'drag') {
    event.preventDefault();
    cancelDrag();
  } else if (target === 'edit') {
    event.preventDefault();
    const inBar = editBar.contains(document.activeElement);
    setEditMode(false);
    if (inBar) editToggle.focus();
  } else if (target === 'find') {
    event.preventDefault();
    // Keep keyboard users in the search box when the result they were on disappears.
    if (document.activeElement.closest('.find-results')) quickFind.focus();
    quickFind.value = '';
    setFindQuery('');
    // On the Galaxy the input handler refreshes results; in a System it would leave the System.
    if (app.classList.contains('home-view')) quickFind.dispatchEvent(new Event('input'));
  } else if (target === 'view') {
    location.hash = '';
  }
}

function typingInField(target) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

// "/" jumps to Quick find unless the user is typing, a menu is open, or Quick find is hidden.
function handleSlash(event) {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return false;
  if (typingInField(event.target) || !orbitModes.keyAllowed('slash') || topbarSearch.hidden) return false;
  event.preventDefault();
  quickFind.focus();
  quickFind.select();
  return true;
}

// Down Arrow leaves Quick find for the results; Up and Down move through them.
function handleFindArrows(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false;
  const results = [...app.querySelectorAll('.find-item')];
  if (!results.length) return false;
  const active = document.activeElement;
  if (active === quickFind) {
    if (event.key === 'ArrowUp') return false;
    event.preventDefault();
    results[0].focus();
    return true;
  }
  const index = results.indexOf(active);
  if (index === -1) return false;
  event.preventDefault();
  if (event.key === 'ArrowDown') results[Math.min(index + 1, results.length - 1)].focus();
  else if (index === 0) quickFind.focus();
  else results[index - 1].focus();
  return true;
}

const ARROWS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
const PLANET_SELECTOR = '.home-satellite, .detail-satellite';

function centerOf(node) {
  const box = node.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

// The closest sun in the pressed direction; sideways drift counts double so rows and columns stay put.
function nearestInDirection(from, candidates, [dx, dy]) {
  const origin = centerOf(from);
  let best = null;
  let bestScore = Infinity;
  for (const node of candidates) {
    if (node === from) continue;
    const point = centerOf(node);
    const along = (point.x - origin.x) * dx + (point.y - origin.y) * dy;
    if (along <= 8) continue;
    const across = Math.abs((point.x - origin.x) * dy - (point.y - origin.y) * dx);
    const score = along + across * 2;
    if (score < bestScore) { best = node; bestScore = score; }
  }
  return best;
}

function neighbor(list, node, step) {
  const index = list.indexOf(node);
  return index === -1 ? null : list[index + step] || null;
}

function planetTarget(planet, [dx, dy]) {
  const cluster = planet.closest('.planet-cluster');
  const container = cluster.parentElement;
  const planets = [...container.querySelectorAll(':scope > .planet-cluster > :is(.home-satellite, .detail-satellite)')];
  if (dx) return neighbor(planets, planet, dx);
  if (dy > 0) return cluster.querySelector('.moon-link');
  return container.querySelector(':scope > .home-hub');
}

function moonTarget(moon, [dx, dy]) {
  const field = moon.closest('.moon-field');
  if (dx) return neighbor([...field.querySelectorAll('.moon-link')], moon, dx);
  if (dy < 0) return field.closest('.planet-cluster').querySelector(`:scope > :is(${PLANET_SELECTOR})`);
  return null;
}

function handleMapArrows(event) {
  const direction = ARROWS[event.key];
  if (!direction || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  if (menuOpen()) return;
  const active = document.activeElement;
  let target = null;
  if (active.classList.contains('home-hub')) {
    target = nearestInDirection(active, [...app.querySelectorAll('.home-hub')], direction);
  } else if (active.matches(PLANET_SELECTOR)) {
    target = planetTarget(active, direction);
  } else if (active.classList.contains('moon-link')) {
    target = moonTarget(active, direction);
  }
  if (target) {
    event.preventDefault();
    target.focus();
  }
}

window.addEventListener('keydown', event => {
  if (event.defaultPrevented) return;
  // The command palette takes every key while it is open, and the placeholder form handles its own.
  if (handlePaletteKey(event) || orbitModes.overlayIs('palette') || !orbitModes.keyAllowed('other')) return;
  if (handlePaletteShortcut(event)) return;
  if (event.key === 'Tab') {
    if (menuOpen()) trapMenuFocus(event);
  } else if (event.key === 'Escape') {
    handleEscape(event);
  } else if (!handleSlash(event) && !handleFindArrows(event)) {
    handleMapArrows(event);
  }
});
