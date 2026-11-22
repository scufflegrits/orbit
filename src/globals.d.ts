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

// What src/ui/ still reads from the old scripts (phases 5 and 6a), by script.
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
// storage.js
declare function saveMap(data: any, label?: string | false): void;
// team.js
declare let teamGroups: any[];
declare let teamSource: string;
declare let teamError: string;
declare function setTeamSunHidden(id: string, hidden: boolean): void;
// drag.js
declare const editToggle: HTMLElement;
declare function updateEditBar(): void;
// editor.js, editor-page.js
declare let editorTree: HTMLElement | null;
declare function openEditorPage(): void;
declare function editorHeader(title: string, back: () => void): void;
declare function editorActions(): HTMLElement;
declare function editorButton(label: string, action: () => void, className?: string): HTMLButtonElement;
declare function editorField(label: string, value: string, type?: string): { wrapper: HTMLElement, input: HTMLInputElement };
declare function editorError(message: string): void;
declare function copyGroups(): any[];
declare function applyEditorChange(next: any[], after: () => void, options?: any): void;
declare function selectJsonFile(onData: (data: any) => void): void;
declare function showSunList(): void;
declare function showSunEditor(index: number | null): void;
declare function showPlanetEditor(sunIndex: number, planetIndex: number): void;
declare function showMoonEditor(sunIndex: number, planetIndex: number, moonIndex: number): void;
// routines.js
declare function showRoutineEditor(index: number): void;
declare function showRoutines(): void;
// workspaces.js
declare let activeWorkspace: string;
declare function workspaceName(id?: string): string;
declare function workspaceSettings(): HTMLElement;
declare function loadWorkspaces(): { id: string, name: string }[];
declare function switchWorkspace(id: string): void;
