// Start-up (2.2.1 app.js): find the page, read the preferences, subscribe to
// the store and the mode store, wire the top bar and menu, then load the
// bundled and team maps and show them. Moved in rewrite phase 8; main.js
// calls start() once the page has loaded.
import { isGroup } from '../core/destination.js';
import { counted } from '../core/words.js';
import { loadBundledMap } from '../services/sources.js';
import { store } from '../state/page-store.js';
import { element } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { gestureEnded, showEditMode } from '../ui/drag/drag.js';
import { paletteClosed, paletteOpened } from '../ui/find/palette.js';
import { variableFormClosed, variableFormOpened } from '../ui/dialogs/placeholder.js';
import { closeMenu, menuHidden, openMenu, showMenuPanel } from '../ui/menu/menu.js';
import { updateWorkspaceSwitch } from '../ui/menu/workspaces.js';
import { showBackupReminder } from '../ui/notices/backup.js';
import { syncRemovalNoticeVisibility, updateRemovalNotice } from '../ui/notices/removal.js';
import { offerDueRoutines } from '../ui/notices/routine-offer.js';
import { checkTeamUpdates } from '../ui/notices/team-updates.js';
import * as page from '../ui/page.js';
import { modes } from '../ui/page-modes.js';
import { loadTeamMap, team } from '../ui/team-map.js';
import { render } from '../ui/views/render.js';

function countDestinations() {
  const destinations = page.groups.reduce((total, group) => total + group.links.reduce(
    (/** @type {number} */ sum, /** @type {any} */ link) => sum + Number(!isGroup(link)) + link.moons.length, 0), 0);
  page.linkCount.textContent = `${counted(destinations, 'link')} · ${counted(page.groups.length, 'sun')}`.toUpperCase();
}

async function init() {
  try {
    const seed = await loadBundledMap();
    await loadTeamMap();
    // Loads the workspace's map; the subscriber copies it and renders.
    store.start({ seed, team: team.groups });
    offerDueRoutines();
    checkTeamUpdates();
    showBackupReminder();
  } catch (error) {
    modes.send('loadFailed');
    page.app.className = 'error-view';
    page.app.replaceChildren(element('h1', '', 'Could not load your links.'));
    page.app.append(element('p', '', 'Run `python3 sync.py`, then open index.html. You can also use `python3 serve.py` for automatic updates on refresh.'));
    page.app.append(element('pre', '', String(/** @type {Error} */ (error).message)));
  }
}

export function start() {
  page.findPageElements();
  page.readPreferences();
  // The top bar's icon buttons (index.html has only their names).
  page.settingsTrigger.replaceChildren(icon('settings'));
  document.querySelector('#menu-close')?.replaceChildren(icon('x'));

  // The store is the only writer of the map. This copies its state for the
  // screens, then redraws, exactly once per change.
  store.subscribe((state, kind) => {
    page.showStoreState(state);
    countDestinations();
    // A workspace switch redraws itself after deciding whether to leave the System.
    if (kind !== 'switch') render();
    updateRemovalNotice();
  });

  // The one place that shows the interaction modes: a held item is tidied
  // away, overlays are shown or removed, and Edit mode is shown, exactly
  // once per change.
  modes.subscribe((next, previous, event) => {
    const held = (/** @type {typeof next} */ state) => state.mode === 'pressed' || state.mode === 'dragging';
    if (held(previous) && !held(next)) gestureEnded(previous.mode === 'dragging', event);
    if (previous.overlay !== next.overlay) {
      syncRemovalNoticeVisibility();
      const menu = (/** @type {typeof next} */ state) => ['menu', 'menuPanel', 'menuEditor'].includes(state.overlay);
      if (previous.overlay === 'palette') paletteClosed();
      if (previous.overlay === 'placeholder') variableFormClosed();
      if (menu(previous) !== menu(next)) {
        page.menuOverlay.hidden = !menu(next);
        if (!menu(next)) menuHidden();
      }
      if (next.overlay === 'palette') paletteOpened();
      if (next.overlay === 'placeholder') variableFormOpened();
    }
    const editing = (/** @type {typeof next} */ state) => state.mode !== 'browsing';
    if (editing(previous) !== editing(next)) showEditMode(editing(next));
  });

  // A page change drops a held item and closes the menu, not the palette or placeholder form.
  window.addEventListener('hashchange', () => { modes.send('pageChange'); render(); });
  /** @type {HTMLElement} */ (document.querySelector('.brand')).addEventListener('click', event => {
    event.preventDefault();
    page.quickFind.value = '';
    page.setFindQuery('');
    if (location.hash && location.hash !== '#') location.hash = '';
    else render();
  });
  page.settingsTrigger.addEventListener('click', openMenu);
  page.viewToggle.addEventListener('click', () => page.setGalaxyView(page.galaxyView === 'list' ? 'orbits' : 'list'));
  /** @type {HTMLElement} */ (document.querySelector('#menu-close')).addEventListener('click', closeMenu);
  /** @type {HTMLElement} */ (document.querySelector('#menu-scrim')).addEventListener('click', closeMenu);
  for (const option of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-menu-panel]'))) {
    option.addEventListener('click', () => showMenuPanel(/** @type {string} */ (option.dataset.menuPanel)));
  }
  page.updateViewToggle();
  updateWorkspaceSwitch();
  init();
}
