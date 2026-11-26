// Calls a lower screen module makes into a higher one, filled in by main.js
// at start-up. They break what would otherwise be import cycles (favorites
// redraw the Galaxy, which shows favorites). Each one is a plain function
// that does nothing until it is set.
export const hooks = {
  /** Redraw the page (ui/views/render.js). */
  render: () => {},
  /** Redraw only the Galaxy's quick bar (ui/views/galaxy.js). */
  refreshQuickBar: () => {},
  /** Open the menu (ui/menu/menu.js). */
  openMenu: () => {},
  /** Show a menu panel (ui/menu/menu.js). @type {(name: string) => void} */
  showMenuPanel: () => {},
  /** Export the personal map as JSON (ui/editor/import-export.js). */
  exportMap: () => {},
};
