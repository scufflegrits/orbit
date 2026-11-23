// Link packs (2.2.1 sharing.js): share a routine or your favorites as a
// small file, and import one. A pack holds the links themselves (never moons,
// favorites, or passwords), and for a routine its name and schedule. The
// format is core/schema.js validPack and core/map-ops.js packLink. Moved in
// rewrite phase 6a; the rest of the editor's tools follow in 6b.
import { destinationKey, pathsForKey } from '../../../core/destination.js';
import { packLink, uniqueSunId } from '../../../core/map-ops.js';
import { validPack } from '../../../core/schema.js';
import { counted, element } from '../../dom.js';
import { routineItems } from '../../views/open.js';
import { favoriteItems } from '../../views/favorites.js';
import * as fileIo from '../../../services/file-io.js';
import { applyEditorChange, copyGroups, editorActions, editorButton, editorError, editorField, editorHeader, selectJsonFile } from '../kit.js';
import { nav } from '../nav.js';
import { groups, menuContent, routines } from '../../page.js';

/**
 * @param {string} name
 * @param {any[]} items
 * @param {any} [routine]
 */
function exportPack(name, items, routine = null) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pack';
  /** @type {any} */
  const pack = { format: 'orbit-pack-v1', name, links: items.map(packLink) };
  if (routine) pack.routine = { name: routine.name, ...(routine.schedule ? { schedule: routine.schedule } : {}) };
  fileIo.downloadJson(pack, `orbit-pack-${slug}.json`);
}

/** @param {any} routine */
export function shareRoutine(routine) {
  exportPack(routine.name, routineItems(routine).items.map(entry => entry.item), routine);
}

/** @param {import('../../../core/types.js').GroupPlanet} group */
export function shareGroup(group) {
  exportPack(group.name, group.moons);
}

export function shareFavorites() {
  const items = favoriteItems().map(entry => entry.item);
  if (!items.length) return editorError('You have no favorites to share yet.');
  exportPack('Favorites', items);
}

export function showPackImport() {
  editorHeader('Import link pack', nav.showSunList);
  menuContent.append(element('p', '', 'A link pack is a small file someone shared from their Orbit: a routine or their favorites. Choose the file, or paste its text.'));
  const text = editorField('Pack text', '', 'textarea');
  text.input.setAttribute('aria-label', 'Pack text');
  text.input.placeholder = '{"format": "orbit-pack-v1", …}';
  const actions = editorActions();
  actions.append(editorButton('Choose pack file', () => selectJsonFile((/** @type {any} */ data) => showPackReview(validPack(data)))));
  menuContent.append(text.wrapper);
  editorActions().append(editorButton('Review pasted pack', () => {
    try { showPackReview(validPack(JSON.parse(text.input.value))); } catch (error) { editorError(`Import failed: ${/** @type {Error} */ (error).message}`); }
  }, 'editor-primary'));
}

/** @param {import('../../../core/schema.js').LinkPack} pack */
function showPackReview(pack) {
  editorHeader(`Review ${pack.name}`, showPackImport);
  const known = pack.links.filter(link => pathsForKey(groups, destinationKey(link)).length);
  const fresh = pack.links.filter(link => !pathsForKey(groups, destinationKey(link)).length);
  menuContent.append(element('p', 'import-merge-summary', `${counted(pack.links.length, 'link')}: ${counted(fresh.length, 'new link')} to add${known.length ? `, ${known.length} already on your map` : ''}.`));
  const list = element('ul', 'rdp-batch-list');
  pack.links.forEach((/** @type {any} */ link) => list.append(element('li', '', `${link.name} → ${link.type === 'rdp' ? link.host : link.url}${known.includes(link) ? ' (already on your map)' : ''}`)));
  menuContent.append(list);
  const target = element('label', 'editor-field');
  target.append(element('span', '', 'Add new links to'));
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Add new links to');
  const option = element('option', '', `A new sun named ${pack.name}`);
  option.value = 'new';
  select.append(option);
  groups.forEach((sun, index) => {
    if (sun.team) return;
    const item = element('option', '', `${sun.name} (as planets)`);
    item.value = String(index);
    select.append(item);
  });
  target.append(select);
  menuContent.append(target);
  /** @type {HTMLInputElement | null} */
  let withRoutine = null;
  if (pack.routine) {
    const row = element('label', 'editor-check');
    withRoutine = document.createElement('input');
    withRoutine.type = 'checkbox';
    withRoutine.checked = true;
    withRoutine.setAttribute('aria-label', 'Also add the routine');
    row.append(withRoutine, element('span', '', `Also add the routine “${pack.routine.name}”`));
    menuContent.append(row);
  }
  editorActions().append(editorButton('Add to my map', () => {
    const next = copyGroups();
    if (fresh.length) {
      const planets = fresh.map((/** @type {any} */ link) => ({ ...link, moons: [] }));
      if (select.value === 'new') {
        next.push({ id: uniqueSunId(pack.name, new Set(next.map((/** @type {any} */ sun) => sun.id))), name: pack.name,
          description: 'Shared link pack', color: '#79d9f8', links: planets });
      } else {
        next[Number(select.value)].links.push(...planets);
      }
    }
    /** @type {any[] | undefined} */
    let nextRoutines;
    if (withRoutine?.checked && pack.routine) {
      const taken = new Set(routines.map(routine => routine.name.toLocaleLowerCase()));
      let name = pack.routine.name;
      for (let n = 2; taken.has(name.toLocaleLowerCase()); n++) name = `${pack.routine.name} ${n}`;
      nextRoutines = [...routines, { name, links: pack.links.map(link => ({ key: destinationKey(link), name: link.name })),
        ...(pack.routine.schedule ? { schedule: pack.routine.schedule } : {}) }];
    }
    applyEditorChange(next, nav.showSunList, { label: `Imported link pack ${pack.name}`,
      ...(nextRoutines ? { routines: nextRoutines } : {}) });
  }, 'editor-primary'));
}
