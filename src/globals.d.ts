// Names src/ uses but doesn't define. Two kinds:
// 1. Data the page loads before orbit.js (links-data.js, team-data.js) and the
//    build-time ORBIT_TEST switch.
// 2. During the rewrite, the old classic scripts' globals that src/app reaches
//    through (REWRITE_PLAN.md, "Coexistence"). Each declaration is removed when
//    that code moves into src/; by phase 8 only part 1 remains.

/** Set by build.mjs: true in the test bundle, false in the release bundle. */
declare const ORBIT_TEST: boolean;

interface Window {
  ORBIT_DATA?: { groups: unknown[] };
  ORBIT_TEAM_DATA?: { groups: unknown[] };
  OrbitNext?: { readonly version: string };
  OrbitTest?: Record<string, unknown>;
}

// ---- Old classic-script globals (temporary) -------------------------------------
// What src/ still reads from the old scripts that remain (app.js, storage.js,
// rdp.js, drag.js, keys.js), by script. Phase 8 moves the last of them.
// app.js
declare const APP_VERSION: string;
declare const app: HTMLElement;
declare const quickFind: HTMLInputElement;
declare const settingsTrigger: HTMLElement;
declare const topbarSearch: HTMLElement;
declare const menuOverlay: HTMLElement;
declare const menuRoot: HTMLElement;
declare let menuContent: HTMLElement;
declare let groups: any[];
declare let routines: any[];
declare let rdpPresets: any[];
declare let findQuery: string;
declare let galaxyView: 'orbits' | 'list';
declare let showQuickBar: boolean;
declare let showSiteIcons: boolean;
declare let rdpLaunchMode: 'download' | 'client';
declare let activeTheme: string;
declare let activeFontSize: string;
declare let animationsEnabled: boolean;
declare let alwaysShowMoons: boolean;
declare let storageWarning: string;
declare function setFindQuery(text: string): void;
declare function setGalaxyView(view: string): void;
declare function dataSourceLabel(): string;
declare function undoRemoval(): void;
// drag.js
declare const editToggle: HTMLElement;
declare function updateEditBar(): void;
declare function setEditMode(on: boolean): void;
// rdp.js
declare function effectiveRdpProfile(item: any): string | null;
declare function rdpLaunchUrl(item: any): string;
