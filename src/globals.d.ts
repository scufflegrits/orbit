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
declare var editMode: boolean;
declare var drag: { state: 'pressed' | 'dragging' } | null;
// A function declaration in a classic script; the test hook swaps it to capture downloads.
declare var downloadJson: (data: unknown, filename?: string) => void;
declare function exportMap(): void;
declare function showSunList(): void;
declare function openEditorAt(indices: number[]): void;
declare function setEditMode(on: boolean): void;
declare function openMenu(): void;
declare function openPalette(): void;
declare function render(): void;
declare function effectiveRdpProfile(item: any): string | null;
declare function rdpLaunchUrl(item: any): string;
declare function siteIcon(item: any): HTMLElement | null;
declare function destinationNode(item: any, className: string, path?: number[]): HTMLElement;
