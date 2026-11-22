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
// A function declaration in a classic script; the test hook swaps it to capture downloads.
declare var downloadJson: (data: unknown, filename?: string) => void;
declare function exportMap(): void;
declare function showSunList(): void;
declare function openEditorAt(indices: number[]): void;
declare function setEditMode(on: boolean): void;
declare function openMenu(): void;
declare function effectiveRdpProfile(item: any): string | null;
declare function rdpLaunchUrl(item: any): string;

// What src/ui/ (views, find, layout; phase 5) still reads from the old scripts.
// app.js
declare const app: HTMLElement;
declare const quickFind: HTMLInputElement;
declare const settingsTrigger: HTMLElement;
declare const topbarSearch: HTMLElement;
declare let groups: any[];
declare let routines: any[];
declare let rdpPresets: any[];
declare let findQuery: string;
declare let galaxyView: 'orbits' | 'list';
declare let showQuickBar: boolean;
declare let showSiteIcons: boolean;
declare let rdpLaunchMode: 'download' | 'client';
declare function setFindQuery(text: string): void;
declare function setGalaxyView(view: string): void;
// drag.js
declare const editToggle: HTMLElement;
declare function updateEditBar(): void;
// favorites.js
declare function favoriteItems(): { path: number[], item: any }[];
declare function recentItems(): { path: number[], item: any }[];
declare function isFavorite(item: any, sun: any): boolean;
declare function setFavorite(path: number[], on: boolean): void;
declare function noteOpened(item: any): void;
declare function clearRecent(): void;
declare function openAll(sunIndex: number, planetIndex: number): unknown;
declare function openAllFavorites(): unknown;
declare function openDestination(item: any): unknown;
// variables.js
declare function askForVariables(item: any): void;
declare function typedAddress(text: string): string | null;
declare function quickAddResult(address: string): HTMLElement;
declare function showQuickAdd(address?: string): void;
// routines.js
declare function routineItems(routine: any): { items: { path: number[], item: any }[], missing: number };
declare function runRoutine(routine: any): unknown;
declare function showRoutineEditor(index: number): void;
declare function showRoutines(): void;
// menu.js, editor-page.js
declare function showMenuPanel(name: string): void;
declare function openEditorPage(): void;
// workspaces.js
declare let activeWorkspace: string;
declare function workspaceName(id?: string): string;
declare function loadWorkspaces(): { id: string, name: string }[];
declare function switchWorkspace(id: string): void;
