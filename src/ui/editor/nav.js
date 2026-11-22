// The editor's screens, as the helpers, the tree, and the tools reach them
// (rewrite phase 6b). Filled in by ui/editor/index.js; calling through this
// table instead of importing the screens avoids import cycles (the screens
// open the tools, and the tools go back to the screens).
export const nav = {
  /** @type {() => void} */ showSunList: () => {},
  /** @type {(index: number | null) => void} */ showSunEditor: () => {},
  /** @type {(sunIndex: number, planetIndex: number | null) => void} */ showPlanetEditor: () => {},
  /** @type {(sunIndex: number, planetIndex: number, moonIndex: number | null) => void} */ showMoonEditor: () => {},
  /** @type {(data: any, options?: any) => void} */ showImportReview: () => {},
  /** @type {() => void} */ renderEditorTree: () => {},
};
