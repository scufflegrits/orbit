// Drawing the page (2.2.1 render.js render()): the Galaxy, or the System the
// address names. Moved in rewrite phase 5; the store subscriber in app.js
// and the old scripts call it (through the bridge's page global).
import { layoutOrbits, updateMapLabelSizes } from '../layout/orbits.js';
import { modes } from '../page-modes.js';
import { renderHome } from './galaxy.js';
import { renderDetail } from './system.js';

export function render() {
  // A render replaces the nodes a drag is holding, so the gesture ends first.
  modes.send('render');
  updateMapLabelSizes();
  const route = decodeURIComponent(location.hash.slice(1));
  const id = route.startsWith('group/') ? route.slice(6) : null;
  const group = groups.find(item => item.id === id);
  modes.send(group ? 'openSystem' : 'toGalaxy');
  if (group) renderDetail(group);
  else renderHome();
  layoutOrbits();
  editToggle.hidden = false;
  updateEditBar();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
