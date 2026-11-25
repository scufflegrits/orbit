// Names src/ uses but doesn't define. Two kinds:
// 1. Data the page loads before orbit.js (links-data.js, team-data.js) and the
//    build-time ORBIT_TEST switch.
// 2. (Until phase 8) the old classic scripts' globals; none remain.

/** Set by scripts/build.mjs: true in the test bundle, false in the release bundle. */
declare const ORBIT_TEST: boolean;

interface Window {
  ORBIT_DATA?: { groups: unknown[] };
  ORBIT_TEAM_DATA?: { groups: unknown[] };
  ORBIT_WORKSPACES?: { id: string; name: string; map: { groups: unknown[] } }[];
  OrbitNext?: { readonly version: string };
  OrbitTest?: Record<string, unknown>;
}
