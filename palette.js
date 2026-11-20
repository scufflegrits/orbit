// Command palette (Ctrl+K or Cmd+K): search the whole map and run commands
// without leaving the keyboard. Loaded as a classic script after drag.js and
// before keys.js. Uses shared state and helpers from the other scripts only
// when called.

let palette = null;

function paletteCommands() {
  return [
    { label: editMode ? 'Turn off Edit mode' : 'Turn on Edit mode', run: () => setEditMode(!editMode) },
    { label: 'Open Settings', run: () => { openMenu(); showMenuPanel('Settings'); } },
    { label: 'Edit links', run: () => { openMenu(); openEditorPage(); } },
    { label: 'Help', run: () => { openMenu(); showMenuPanel('Help'); } },
    { label: galaxyView === 'list' ? 'Show the Galaxy as orbits' : 'Show the Galaxy as a list',
      run: () => setGalaxyView(galaxyView === 'list' ? 'orbits' : 'list') },
    { label: 'Return to Galaxy', run: () => { location.hash = ''; } },
    { label: 'Clear recent links', run: () => { clearRecent(); render(); } },
    ...(favoriteItems().length > 1 && !editMode ? [{ label: 'Open all favorites', run: openAllFavorites }] : []),
    ...routines.map((routine, index) => ({ label: `Run routine: ${routine.name}`,
      run: () => editMode ? (openMenu(), openEditorPage(), showRoutineEditor(index)) : runRoutine(routine) })),
    { label: 'Edit routines', run: () => { openMenu(); openEditorPage(); showRoutines(); } },
  ];
}

function paletteEntries(query) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const commands = paletteCommands().filter(command =>
    words.every(word => command.label.toLocaleLowerCase().includes(word)));
  const matches = query.trim() ? findMatches(query).slice(0, 40) : [];
  const entries = commands.map(command => ({ kind: 'Command', label: command.label, run: command.run }));
  for (const match of matches) {
    entries.push({ kind: match.kind, label: match.name, detail: match.why || match.path, match, run: () => runMatch(match) });
    // A planet with moons can also be opened together with them.
    if (match.kind === 'Planet' && !editMode) {
      const planet = match.destination;
      if (planet.moons.length) {
        entries.push({ kind: 'Command', label: `Open all: ${planet.name} + ${counted(planet.moons.length, 'moon')}`,
          detail: match.path, run: () => openAll(...match.indices) });
      }
    }
  }
  return entries;
}

function runMatch(match) {
  if (match.id) {
    location.hash = `group/${encodeURIComponent(match.id)}`;
  } else if (editMode) {
    openEditorAt(match.indices);
  } else {
    openDestination(match.destination);
  }
}

function openPalette() {
  if (palette) return;
  cancelDrag();
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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

function closePalette() {
  if (!palette) return;
  const { overlay, opener } = palette;
  palette = null;
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

function runPaletteEntry(index) {
  const entry = palette?.entries[index];
  if (!entry) return;
  closePalette();
  entry.run();
}

// Keys while the palette is open. Returns true when the key was handled.
function handlePaletteKey(event) {
  if (!palette) return false;
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

// Ctrl+K or Cmd+K opens the palette unless the menu is open.
function handlePaletteShortcut(event) {
  if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false;
  if (!menuOverlay.hidden || app.classList.contains('error-view')) return false;
  event.preventDefault();
  openPalette();
  return true;
}
