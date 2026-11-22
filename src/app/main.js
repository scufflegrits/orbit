// Entry point for orbit.js. During the rewrite the old classic scripts still
// start the app (app.js init); this only publishes the bridge and, in the test
// bundle, the test hook. ORBIT_TEST is set by build.mjs: false for the release
// bundle, which removes the test hook entirely.
import { APP_VERSION } from './version.js';
import { publishBridge, publishPageGlobals } from './legacy-bridge.js';
import { installTestHook } from './test-hook.js';
import * as bookmarks from '../core/bookmarks.js';
import * as destination from '../core/destination.js';
import * as mapOps from '../core/map-ops.js';
import * as rdp from '../core/rdp.js';
import * as schema from '../core/schema.js';
import * as search from '../core/search.js';
import * as templates from '../core/templates.js';
import * as words from '../core/words.js';
import * as backup from '../state/backup.js';
import * as history from '../state/history.js';
import * as prefs from '../state/prefs.js';
import * as storage from '../state/storage.js';
import * as workspaces from '../state/workspaces.js';
import { createStore } from '../state/store.js';
import { modes } from '../ui/page-modes.js';
import * as dom from '../ui/dom.js';
import * as find from '../ui/find/palette.js';
import { fitOrbitSizes, installLayout, layoutOrbits } from '../ui/layout/orbits.js';
import { confirmed } from '../ui/dialogs/confirm.js';
import * as placeholder from '../ui/dialogs/placeholder.js';
import * as quickAdd from '../ui/editor/quick-add.js';
import * as packs from '../ui/editor/tools/packs.js';
import { hooks } from '../ui/hooks.js';
import * as menu from '../ui/menu/menu.js';
import { noticeArea, showOpenAllNotice } from '../ui/notices/area.js';
import * as backupNotice from '../ui/notices/backup.js';
import { installRoutineOffers, offerDueRoutines } from '../ui/notices/routine-offer.js';
import { checkTeamUpdates } from '../ui/notices/team-updates.js';
import { installClicks } from '../ui/views/clicks.js';
import * as favorites from '../ui/views/favorites.js';
import { quickBar, refreshQuickBar } from '../ui/views/galaxy.js';
import * as open from '../ui/views/open.js';
import { destinationNode, siteIcon } from '../ui/views/nodes.js';
import { render } from '../ui/views/render.js';
import * as fileIo from '../services/file-io.js';
import * as linkCheck from '../services/link-check.js';
import * as opener from '../services/opener.js';
import * as rdpLaunch from '../services/rdp-launch.js';
import * as schedule from '../services/schedule.js';
import * as sources from '../services/sources.js';

// Reads nothing yet: app.js (old) calls store.start() once the link data is loaded.
const store = createStore();

publishBridge({
  version: APP_VERSION,
  core: Object.freeze({ ...templates, ...destination, ...search, ...rdp, ...schema, ...mapOps, ...bookmarks, ...words }),
  store,
  modes,
  state: Object.freeze({ storage, workspaces, prefs, history, backup }),
  services: Object.freeze({ sources, opener, rdpLaunch, linkCheck, fileIo, schedule }),
});
// Calls lower screen modules make into higher ones.
hooks.render = render;
hooks.refreshQuickBar = refreshQuickBar;

// What the removed old scripts defined, for the old scripts still loaded and
// the page checks that call them by name: render.js and palette.js (phase
// 5); menu.js, variables.js, sharing.js, and favorites.js (phase 6a).
publishPageGlobals({
  element: dom.element, counted: dom.counted, tagPath: dom.tagPath, tagChips: dom.tagChips,
  descriptionNode: dom.descriptionNode, siteIcon, destinationNode, quickBar, render, layoutOrbits, fitOrbitSizes,
  addressText: search.addressText,
  /** @param {string} query */
  findMatches: query => search.findMatches(groups, query),
  openPalette: find.openPalette, closePalette: find.closePalette, paletteOpened: find.paletteOpened,
  paletteClosed: find.paletteClosed, handlePaletteKey: find.handlePaletteKey, handlePaletteShortcut: find.handlePaletteShortcut,
  openMenu: menu.openMenu, closeMenu: menu.closeMenu, menuHidden: menu.menuHidden, showMenuPanel: menu.showMenuPanel,
  askForVariables: placeholder.askForVariables, variableFormOpened: placeholder.variableFormOpened,
  variableFormClosed: placeholder.variableFormClosed, closeVariableDialog: placeholder.closeVariableDialog,
  typedAddress: quickAdd.typedAddress, showQuickAdd: quickAdd.showQuickAdd,
  shareRoutine: packs.shareRoutine, shareFavorites: packs.shareFavorites, showPackImport: packs.showPackImport,
  checkTeamUpdates, noticeArea, showOpenAllNotice, offerDueRoutines,
  noteBackupMade: backupNotice.noteBackupMade, backupDue: backupNotice.backupDue, showBackupReminder: backupNotice.showBackupReminder,
  backupReminder: backupNotice.backupReminder,
  isFavorite: favorites.isFavorite, setFavorite: favorites.setFavorite, favoriteItems: favorites.favoriteItems,
  noteOpened: favorites.noteOpened, recentItems: favorites.recentItems,
  openDestination: open.openDestination, openLinks: open.openLinks, openAll: open.openAll,
  openAllFavorites: open.openAllFavorites, routineItems: open.routineItems, runRoutine: open.runRoutine, confirmed,
  /** @param {string} key */
  pathsForKey: key => destination.pathsForKey(groups, key),
  /** @param {number[]} path */
  itemAt: path => destination.itemAt(groups, path),
  // Read by tests/data_compat_check.py.
  loadVariables: prefs.readVariables, readOffered: prefs.readOffered, loadRecent: prefs.readRecent, clearRecent: prefs.clearRecent,
  readBackupState: backup.readBackupState,
});
// Listeners the moved code installed when its script loaded.
installLayout();
installClicks();
installRoutineOffers();
if (ORBIT_TEST) installTestHook(store, { schedule, modes });
