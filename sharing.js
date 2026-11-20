// Link packs (share a routine or favorites) and team map update notices.
// Loaded as a classic script after workspaces.js.

const TEAM_SEEN_KEY = 'orbit:team-seen:v1';

// ---- Link packs -----------------------------------------------------------------

// A pack holds the links themselves (never moons, favorites, or passwords),
// and for a routine its name and schedule.
function packLink(item) {
  const copy = plainCopy(item);
  delete copy.moons;
  delete copy.favorite;
  delete copy.rdpPreset;
  return copy;
}

function exportPack(name, items, routine = null) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pack';
  const pack = { format: 'orbit-pack-v1', name, links: items.map(packLink) };
  if (routine) pack.routine = { name: routine.name, ...(routine.schedule ? { schedule: routine.schedule } : {}) };
  downloadJson(pack, `orbit-pack-${slug}.json`);
}

function shareRoutine(routine) {
  exportPack(routine.name, routineItems(routine).items.map(entry => entry.item), routine);
}

function shareFavorites() {
  const items = favoriteItems().map(entry => entry.item);
  if (!items.length) return editorError('You have no favorites to share yet.');
  exportPack('Favorites', items);
}

function validPack(data) {
  if (!data || data.format !== 'orbit-pack-v1' || !Array.isArray(data.links)) {
    throw new Error('This is not an Orbit link pack.');
  }
  const name = String(data.name || '').trim().slice(0, 60) || 'Shared links';
  const links = data.links.map((link, index) => validDestination(link, `Link ${index + 1} in the pack`));
  if (!links.length) throw new Error('The pack has no links.');
  return { name, links, routine: data.routine ? { name: String(data.routine.name || name).trim().slice(0, 60) || name,
    schedule: data.routine.schedule } : null };
}

function showPackImport() {
  editorHeader('Import link pack', showSunList);
  menuContent.append(element('p', '', 'A link pack is a small file someone shared from their Orbit: a routine or their favorites. Choose the file, or paste its text.'));
  const text = editorField('Pack text', '', 'textarea');
  text.input.setAttribute('aria-label', 'Pack text');
  text.input.placeholder = '{"format": "orbit-pack-v1", …}';
  const actions = editorActions();
  actions.append(editorButton('Choose pack file', () => selectJsonFile(data => showPackReview(validPack(data)))));
  menuContent.append(text.wrapper);
  editorActions().append(editorButton('Review pasted pack', () => {
    try { showPackReview(validPack(JSON.parse(text.input.value))); } catch (error) { editorError(`Import failed: ${error.message}`); }
  }, 'editor-primary'));
}

function showPackReview(pack) {
  editorHeader(`Review ${pack.name}`, showPackImport);
  const known = pack.links.filter(link => pathsForKey(destinationKey(link)).length);
  const fresh = pack.links.filter(link => !pathsForKey(destinationKey(link)).length);
  menuContent.append(element('p', 'import-merge-summary', `${counted(pack.links.length, 'link')}: ${counted(fresh.length, 'new link')} to add${known.length ? `, ${known.length} already on your map` : ''}.`));
  const list = element('ul', 'rdp-batch-list');
  pack.links.forEach(link => list.append(element('li', '', `${link.name} → ${link.type === 'rdp' ? link.host : link.url}${known.includes(link) ? ' (already on your map)' : ''}`)));
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
      const planets = fresh.map(link => ({ ...link, moons: [] }));
      if (select.value === 'new') {
        next.push({ id: uniqueSunId(pack.name, new Set(next.map(sun => sun.id))), name: pack.name,
          description: 'Shared link pack', color: '#79d9f8', links: planets });
      } else {
        next[Number(select.value)].links.push(...planets);
      }
    }
    let nextRoutines;
    if (withRoutine?.checked) {
      const taken = new Set(routines.map(routine => routine.name.toLocaleLowerCase()));
      let name = pack.routine.name;
      for (let n = 2; taken.has(name.toLocaleLowerCase()); n++) name = `${pack.routine.name} ${n}`;
      nextRoutines = [...routines, { name, links: pack.links.map(link => ({ key: destinationKey(link), name: link.name })),
        ...(pack.routine.schedule ? { schedule: pack.routine.schedule } : {}) }];
    }
    applyEditorChange(next, showSunList, { label: `Imported link pack ${pack.name}`,
      ...(nextRoutines ? { routines: nextRoutines } : {}) });
  }, 'editor-primary'));
}

// ---- Team map updates -------------------------------------------------------------

function teamEntries() {
  return teamGroups.flatMap(sun => sun.links.flatMap(planet => [
    { key: destinationKey(planet), name: planet.name, path: sun.name },
    ...planet.moons.map(moon => ({ key: destinationKey(moon), name: moon.name, path: `${sun.name} → ${planet.name}` })),
  ]));
}

function rememberTeam(entries) {
  try { localStorage.setItem(TEAM_SEEN_KEY, JSON.stringify(entries.map(({ key, name }) => ({ key, name })))); } catch { /* Storage may be unavailable. */ }
}

// The first load records the team links quietly; later loads report changes.
function checkTeamUpdates() {
  document.querySelector('#team-updates')?.remove();
  if (!teamGroups.length) return;
  const current = teamEntries();
  let seen;
  try { seen = JSON.parse(localStorage.getItem(TEAM_SEEN_KEY) || 'null'); } catch { seen = null; }
  if (!Array.isArray(seen)) return rememberTeam(current);
  const seenKeys = new Set(seen.map(entry => entry.key));
  const currentKeys = new Set(current.map(entry => entry.key));
  const added = current.filter(entry => !seenKeys.has(entry.key));
  const removed = seen.filter(entry => !currentKeys.has(entry.key));
  if (!added.length && !removed.length) return;
  const box = element('div', 'routine-offer team-updates');
  box.id = 'team-updates';
  box.append(element('p', 'routine-offer-copy', `Team map updated: ${added.length} new, ${removed.length} removed.`));
  const details = element('div', 'team-update-list');
  details.hidden = true;
  if (added.length) {
    details.append(element('strong', '', 'New'));
    const list = element('ul', '');
    added.forEach(entry => {
      const item = element('li', '');
      const path = pathsForKey(entry.key)[0];
      item.append(path ? destinationNode(itemAt(path), 'team-update-link', path) : element('span', '', entry.name),
        element('small', '', ` in ${entry.path}`));
      list.append(item);
    });
    details.append(list);
  }
  if (removed.length) {
    details.append(element('strong', '', 'Removed'));
    const list = element('ul', '');
    removed.forEach(entry => list.append(element('li', '', entry.name)));
    details.append(list);
  }
  const show = element('button', 'routine-offer-open', 'Show what’s new');
  show.type = 'button';
  show.setAttribute('aria-expanded', 'false');
  show.addEventListener('click', () => {
    details.hidden = !details.hidden;
    show.setAttribute('aria-expanded', String(!details.hidden));
  });
  const dismiss = element('button', 'routine-offer-dismiss', 'Dismiss');
  dismiss.type = 'button';
  dismiss.addEventListener('click', () => {
    rememberTeam(current);
    box.remove();
  });
  box.append(show, dismiss, details);
  noticeArea().append(box);
}
