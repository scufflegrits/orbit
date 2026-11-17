// Keyboard handling: menu focus trap and Escape layers. Loaded as a classic
// script before app.js. Uses shared state from app.js and menu.js (menuOverlay,
// quickFind, findQuery, app) only when a key is pressed.

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

// Escape closes the menu first, then clears Quick find, then leaves a System.
function handleEscape(event) {
  if (!menuOverlay.hidden) {
    event.preventDefault();
    closeMenu();
  } else if (quickFind.value || findQuery) {
    event.preventDefault();
    findQuery = '';
    quickFind.value = '';
    // On the Galaxy the input handler refreshes results; in a System it would leave the System.
    if (app.classList.contains('home-view')) quickFind.dispatchEvent(new Event('input'));
  } else if (location.hash && location.hash !== '#') {
    location.hash = '';
  }
}

window.addEventListener('keydown', event => {
  if (event.defaultPrevented) return;
  if (event.key === 'Tab' && !menuOverlay.hidden) trapMenuFocus(event);
  else if (event.key === 'Escape') handleEscape(event);
});
