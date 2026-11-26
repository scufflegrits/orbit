// Entry point for orbit.js, the whole app since rewrite phase 8. index.html
// loads it in <head>, after the map data: it installs the listeners that
// don't need the page (in the order 2.2.1's scripts added them), then starts
// the app once the page has loaded. ORBIT_TEST is set by scripts/build.mjs: false for
// the release bundle, which removes the test hook entirely.
import { APP_VERSION } from './version.js';
import { start } from './start.js';
import { installTestHook } from './test-hook.js';
import { store } from '../state/page-store.js';
import { installDrag } from '../ui/drag/drag.js';
import { installEditor } from '../ui/editor/index.js';
import { exportMap } from '../ui/editor/import-export.js';
import { hooks } from '../ui/hooks.js';
import { installKeys } from '../ui/keys/keys.js';
import { installLayout } from '../ui/layout/orbits.js';
import * as menu from '../ui/menu/menu.js';
import { installRoutineOffers } from '../ui/notices/routine-offer.js';
import { installTooltip } from '../ui/tooltip.js';
import { setVersion } from '../ui/page.js';
import { readBackground, readFontFamily } from '../state/prefs.js';
import { modes } from '../ui/page-modes.js';
import { installMapEditButtons } from '../ui/views/edit-buttons.js';
import { installClicks } from '../ui/views/clicks.js';
import { installBackdrop } from '../ui/backdrop/backdrop.js';
import { refreshQuickBar } from '../ui/views/galaxy.js';
import { render } from '../ui/views/render.js';
import * as schedule from '../services/schedule.js';

setVersion(APP_VERSION);

// The font choice goes on the page's root at once, while the <head> loads, so the
// browser never lays text out (or downloads) in the other font first.
document.documentElement.dataset.fontFamily = readFontFamily();
document.documentElement.dataset.background = readBackground();

// Calls lower screen modules make into higher ones.
hooks.render = render;
hooks.refreshQuickBar = refreshQuickBar;
hooks.openMenu = menu.openMenu;
hooks.showMenuPanel = menu.showMenuPanel;
hooks.exportMap = exportMap;
installEditor();

// Listeners that don't need the page's elements, in 2.2.1's order.
installLayout();
installClicks();
installRoutineOffers();
installDrag();
installKeys();
installBackdrop();
installMapEditButtons();

if (ORBIT_TEST) installTestHook(store, { schedule, modes });

function startPage() {
  installTooltip();
  start();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startPage);
else startPage();
