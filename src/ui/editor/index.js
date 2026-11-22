// Wires the editor's screens into the table the helpers, tree, and tools
// call through (ui/editor/nav.js). Imported once by main.js.
import { nav } from './nav.js';
import { renderEditorTree } from './page.js';
import { showImportReview, showMoonEditor, showPlanetEditor, showSunEditor, showSunList } from './screens.js';

export function installEditor() {
  Object.assign(nav, { showSunList, showSunEditor, showPlanetEditor, showMoonEditor, showImportReview, renderEditorTree });
}
