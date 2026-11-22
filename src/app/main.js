// Entry point for orbit.js. During the rewrite the old classic scripts still
// start the app (app.js init); this only publishes the bridge and, in the test
// bundle, the test hook. ORBIT_TEST is set by build.mjs: false for the release
// bundle, which removes the test hook entirely.
import { APP_VERSION } from './version.js';
import { publishBridge } from './legacy-bridge.js';
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
  state: Object.freeze({ storage, workspaces, prefs, history, backup }),
  services: Object.freeze({ sources, opener, rdpLaunch, linkCheck, fileIo, schedule }),
});
if (ORBIT_TEST) installTestHook(store, { schedule });
