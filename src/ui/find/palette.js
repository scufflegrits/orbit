// The command palette (Ctrl+K or Cmd+K; 2.2.1 palette.js): search the whole
// map and run commands without leaving the keyboard. Moved in rewrite phase
// 5. Whether it is open belongs to the mode store; app.js's mode subscriber
// calls paletteOpened() and paletteClosed().
import { findMatches } from '../../core/search.js';
import { clearRecent } from '../../state/prefs.js';
import { counted, element, tagChips } from '../dom.js';
import { showQuickAdd, typedAddress } from '../editor/quick-add.js';
import { openEditorAt, openEditorPage } from '../editor/page.js';
import { showRoutineEditor, showRoutines } from '../editor/tools/routines.js';
import { openMenu, showMenuPanel } from '../menu/menu.js';
import { switchWorkspace } from '../menu/workspaces.js';
import { activeWorkspace, store } from '../../state/page-store.js';
import * as workspaces from '../../state/workspaces.js';
import { setEditMode } from '../drag/drag.js';
import { modes } from '../page-modes.js';
import { favoriteItems } from '../views/favorites.js';
import { openAll, openAllFavorites, openDestination, runRoutine } from '../views/open.js';
import { render } from '../views/render.js';

/**
 * @typedef {{kind: string, label: string, detail?: string, match?: any, run: () => void}} PaletteEntry
 * @typedef {{overlay: HTMLElement, input: HTMLInputElement, list: HTMLElement, status: HTMLElement,
 *   opener: HTMLElement | null, entries: PaletteEntry[], active: number}} PaletteController
 */

/**
 * The palette's controller (DOM nodes, entries, the active row, the element
 * to refocus). Set exactly while the palette is open; whether it is open is
 * always asked of the mode store, never read from this.
 * @type {PaletteController}
 */
let palette = /** @type {any} */ (null);
/** The element to refocus when the palette closes, kept from openPalette() until it is built. */
/** @type {HTMLElement | null} */
let paletteOpener = null;

function paletteCommands() {
  return [
    { label: modes.inEditMode() ? 'Turn off Edit mode' : 'Turn on Edit mode', run: () => setEditMode(!modes.inEditMode()) },
    { label: 'Open Settings', run: () => { openMenu(); showMenuPanel('Settings'); } },
    { label: 'Edit links', run: () => { openMenu(); openEditorPage(); } },
    { label: 'Help', run: () => { openMenu(); showMenuPanel('Help'); } },
    { label: galaxyView === 'list' ? 'Show the Galaxy as orbits' : 'Show the Galaxy as a list',
      run: () => setGalaxyView(galaxyView === 'list' ? 'orbits' : 'list') },
    { label: 'Return to Galaxy', run: () => { location.hash = ''; } },
    { label: 'Clear recent links', run: () => { clearRecent(); render(); } },
    ...(favoriteItems().length > 1 && !modes.inEditMode() ? [{ label: 'Open all favorites', run: openAllFavorites }] : []),
    ...routines.map((routine, index) => ({ label: `Run routine: ${routine.name}`,
      run: () => modes.inEditMode() ? (openMenu(), openEditorPage(), showRoutineEditor(index)) : runRoutine(routine) })),
    { label: 'Edit routines', run: () => { openMenu(); openEditorPage(); showRoutines(); } },
    { label: 'Add a link', run: () => showQuickAdd('') },
    ...workspaces.loadWorkspaces().filter(item => item.id !== activeWorkspace()).map(item => ({
      label: `Switch to workspace: ${item.name}`, run: () => switchWorkspace(item.id) })),
  ];
}

/** @param {any} match */
function runMatch(match) {
  if (match.id) {
    location.hash = `group/${encodeURIComponent(match.id)}`;
  } else if (modes.linkOpensEditor('palette')) {
    openEditorAt(match.indices);
  } else {
    openDestination(match.destination);
  }
}

/**
 * Commands whose words all appear, then up to 40 map matches (each planet
 * with moons followed by its Open all command), with "Add <address>" first
 * when the query is a web address.
 * @param {string} query
 * @returns {PaletteEntry[]}
 */
function paletteEntries(query) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const commands = paletteCommands().filter(command =>
    words.every(word => command.label.toLocaleLowerCase().includes(word)));
  const matches = query.trim() ? findMatches(groups, query).slice(0, 40) : [];
  /** @type {PaletteEntry[]} */
  const entries = commands.map(command => ({ kind: 'Command', label: command.label, run: command.run }));
  const address = typedAddress(query);
  if (address) entries.unshift({ kind: 'Command', label: `Add ${address}`, run: () => showQuickAdd(address) });
  for (const match of /** @type {any[]} */ (matches)) {
    entries.push({ kind: match.kind, label: match.name, detail: match.why || match.path, match, run: () => runMatch(match) });
    // A planet with moons can also be opened together with them.
    if (match.kind === 'Planet' && !modes.inEditMode()) {
      const planet = match.destination;
      if (planet.moons.length) {
        entries.push({ kind: 'Command', label: `Open all: ${planet.name} + ${counted(planet.moons.length, 'moon')}`,
          detail: match.path, run: () => openAll(match.indices[0], match.indices[1]) });
      }
    }
  }
  return entries;
}

export function openPalette() {
  paletteOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  // Refused while another overlay is open; also drops a pressed or dragged item.
  modes.send('openPalette');
}

/** Called only by the mode subscriber, when the palette has opened. */
export function paletteOpened() {
  const opener = paletteOpener;
  paletteOpener = null;
  const overlay = element('div', 'palette-overlay');
  const scrim = element('div', 'palette-scrim');
  const dialog = element('section', 'palette');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Command palette');
  const input = element('input', 'palette-input');
  input.type = 'text';
  input.placeholder = 'Search links and commands';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', 'palette-list');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-label', 'Search links and commands');
  input.autocomplete = 'off';
  const list = element('ul', 'palette-list');
  list.id = 'palette-list';
  list.setAttribute('role', 'listbox');
  const status = element('p', 'palette-status');
  status.setAttribute('role', 'status');
  const hint = element('p', 'palette-hint', '↑ ↓ to move · Enter to open · Esc to close');
  dialog.append(input, list, status, hint);
  overlay.append(scrim, dialog);
  document.body.append(overlay);
  palette = { overlay, input, list, status, opener, entries: [], active: 0 };
  scrim.addEventListener('click', closePalette);
  input.addEventListener('input', updatePalette);
  updatePalette();
  input.focus();
}

export function closePalette() {
  if (!modes.overlayIs('palette')) return;
  modes.send('closeOverlay');
}

/** Called only by the mode subscriber, when the palette has closed for any reason. */
export function paletteClosed() {
  const { overlay, opener } = palette;
  palette = /** @type {any} */ (null);
  overlay.remove();
  if (opener && document.contains(opener)) opener.focus();
}

function updatePalette() {
  palette.entries = paletteEntries(palette.input.value);
  palette.active = 0;
  palette.list.replaceChildren();
  palette.entries.forEach((entry, index) => {
    const option = element('li', 'palette-option');
    option.id = `palette-option-${index}`;
    option.setAttribute('role', 'option');
    option.append(element('span', 'palette-kind', entry.kind));
    const copy = element('span', 'palette-copy');
    copy.append(element('strong', '', entry.label));
    if (entry.detail) copy.append(element('small', '', entry.detail));
    if (entry.match?.tags?.length) copy.append(tagChips(entry.match.tags));
    option.append(copy);
    option.addEventListener('mousemove', () => setPaletteActive(index));
    option.addEventListener('click', () => runPaletteEntry(index));
    palette.list.append(option);
  });
  palette.status.textContent = palette.entries.length
    ? `${counted(palette.entries.length, 'result')}.` : 'No matching links or commands.';
  setPaletteActive(0);
}

/** @param {number} index */
function setPaletteActive(index) {
  const options = palette.list.children;
  if (!options.length) {
    palette.input.removeAttribute('aria-activedescendant');
    return;
  }
  palette.active = Math.max(0, Math.min(index, options.length - 1));
  [...options].forEach((option, i) => option.setAttribute('aria-selected', String(i === palette.active)));
  const active = options[palette.active];
  palette.input.setAttribute('aria-activedescendant', active.id);
  active.scrollIntoView({ block: 'nearest' });
}

/** @param {number} index */
function runPaletteEntry(index) {
  if (!modes.overlayIs('palette')) return;
  const entry = palette.entries[index];
  if (!entry) return;
  modes.send('runEntry');
  entry.run();
}

/**
 * Keys while the palette is open. Returns true when the key was handled.
 * @param {KeyboardEvent} event
 */
export function handlePaletteKey(event) {
  if (!modes.overlayIs('palette')) return false;
  /** @type {Record<string, number>} */
  const moves = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 };
  if (event.key === 'Escape') {
    event.preventDefault();
    closePalette();
  } else if (event.key in moves) {
    event.preventDefault();
    setPaletteActive(palette.active + moves[event.key]);
  } else if (event.key === 'Home' && event.ctrlKey) {
    event.preventDefault();
    setPaletteActive(0);
  } else if (event.key === 'End' && event.ctrlKey) {
    event.preventDefault();
    setPaletteActive(palette.entries.length - 1);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    runPaletteEntry(palette.active);
  } else if (event.key === 'Tab') {
    // Focus stays in the search box; the list is navigated with the arrows.
    event.preventDefault();
  } else {
    return false;
  }
  return true;
}

/**
 * Ctrl+K or Cmd+K opens the palette unless the menu is open or Orbit failed to load.
 * @param {KeyboardEvent} event
 */
export function handlePaletteShortcut(event) {
  if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false;
  if (!modes.keyAllowed('commandK')) return false;
  event.preventDefault();
  openPalette();
  return true;
}
