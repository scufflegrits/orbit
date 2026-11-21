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

publishBridge({
  version: APP_VERSION,
  core: Object.freeze({ ...templates, ...destination, ...search, ...rdp, ...schema, ...mapOps, ...bookmarks }),
});
if (ORBIT_TEST) installTestHook();
