// Edit links tools: merge import, version history, duplicates, link check,
// bookmark import, bulk Remote Desktop settings, and read-only team screens.
// Loaded as a classic script after editor-page.js. Uses shared state and
// helpers from the other scripts only when called.

// ---- Merge import -------------------------------------------------------

// Moved to src/core/map-ops.js in rewrite phase 2.
function mergeMaps(personal, incoming) { return window.OrbitNext.core.mergeMaps(personal, incoming); }

// ---- Version history ----------------------------------------------------

function mapCounts(list) {
  const planets = list.reduce((sum, sun) => sum + sun.links.length, 0);
  const moons = list.reduce((sum, sun) => sum + sun.links.reduce((total, planet) => total + planet.moons.length, 0), 0);
  return { suns: list.length, planets, moons };
}

function countDifference(from, to) {
  const parts = [];
  for (const kind of ['suns', 'planets', 'moons']) {
    const change = to[kind] - from[kind];
    if (change) parts.push(`${change > 0 ? '+' : '−'}${counted(Math.abs(change), kind.slice(0, -1))}`);
  }
  return parts.length ? parts.join(', ') : 'same counts';
}

function showHistory() {
  editorHeader('History', showSunList);
  const entries = loadHistory();
  menuContent.append(element('p', '', 'Orbit keeps the map as it was before each of your last 20 changes in this browser. Restoring a version is itself a change, so it can be undone here too.'));
  if (!entries.length) {
    menuContent.append(element('p', 'editor-note', 'No earlier versions yet. They appear after your next change.'));
    return;
  }
  const current = mapCounts(personalGroups(groups));
  const list = element('div', 'editor-list history-list');
  entries.forEach(entry => {
    const counts = mapCounts(entry.groups);
    const row = element('div', 'editor-list-row history-row');
    const copy = element('span', 'history-copy');
    copy.append(element('strong', '', `Before: ${entry.label}`));
    copy.append(element('small', '', `${new Date(entry.time).toLocaleString()} · ${counted(counts.suns, 'sun')}, ${counted(counts.planets, 'planet')}, ${counted(counts.moons, 'moon')} · compared with now: ${countDifference(current, counts)}`));
    row.append(copy, editorButton('Restore', () => {
      if (!window.confirm(`Restore the map from ${new Date(entry.time).toLocaleString()}?`)) return;
      applyEditorChange([...groups.filter(sun => sun.team), ...entry.groups], showHistory,
        { label: `Restored the version from ${new Date(entry.time).toLocaleString()}`, routines: entry.routines || [],
          rdpPresets: entry.rdpPresets || [] });
    }));
    list.append(row);
  });
  menuContent.append(list);
}

// ---- Duplicates ---------------------------------------------------------

function duplicateGroups() { return window.OrbitNext.core.duplicateGroups(groups); }

function editPath(path) {
  if (path.length === 3) showMoonEditor(...path);
  else showPlanetEditor(...path);
}

function showDuplicates() {
  editorHeader('Find duplicates', showSunList);
  const duplicates = duplicateGroups();
  menuContent.append(element('p', '', 'Links that point to the same address or Remote Desktop computer. A copy you made on purpose shows here too; nothing is changed unless you edit or remove an item.'));
  if (!duplicates.length) {
    menuContent.append(element('p', 'editor-note', 'No duplicates found.'));
    return;
  }
  menuContent.append(element('p', 'data-source', `${counted(duplicates.length, 'address', 'addresses')} used more than once.`));
  duplicates.forEach(list => {
    const block = element('div', 'duplicate-group');
    block.append(element('h4', 'editor-section-title', addressText(list[0].item)));
    list.forEach(({ path }) => {
      const row = element('div', 'editor-list-row');
      row.append(element('span', '', `${pathLabel(path)}${groups[path[0]].team ? ' · team' : ''}`));
      row.append(editorButton(groups[path[0]].team ? 'View' : 'Edit', () => editPath(path)));
      block.append(row);
    });
    menuContent.append(block);
  });
}

// ---- Link check (server mode) -------------------------------------------

// Results of the last check in this page session, by destination key.
const linkCheckResults = new Map();

function webLinksByUrl() {
  const byUrl = new Map();
  groups.forEach((sun, sunIndex) => sun.links.forEach((planet, planetIndex) => {
    [[planet, [sunIndex, planetIndex]], ...planet.moons.map((moon, moonIndex) => [moon, [sunIndex, planetIndex, moonIndex]])]
      .forEach(([item, path]) => {
        // Remote Desktop links and links with {placeholders} are not checked.
        if (item.type === 'rdp' || templateNames(item.url).length) return;
        if (!byUrl.has(item.url)) byUrl.set(item.url, []);
        byUrl.get(item.url).push({ item, path });
      });
  }));
  return byUrl;
}

function showLinkCheck() {
  editorHeader('Check links', showSunList);
  if (location.protocol === 'file:') {
    menuContent.append(element('p', '', 'Checking links needs the local server, because a page opened from a file cannot read other sites. In the Orbit folder, run:'));
    menuContent.append(element('code', 'editor-code', 'python3 serve.py'));
    menuContent.append(element('p', '', 'Then open http://localhost:8000 and choose Check links again.'));
    return;
  }
  const byUrl = webLinksByUrl();
  menuContent.append(element('p', '', `Orbit asks each website address in your map (${byUrl.size} in all) whether it answers. Remote Desktop links are not checked. Nothing is sent anywhere except to those sites.`));
  const status = element('p', 'link-check-status');
  status.setAttribute('role', 'status');
  const results = element('div', 'link-check-results');
  const start = editorButton('Start check', () => runLinkCheck(byUrl, status, results, start), 'editor-primary');
  editorActions().append(start);
  menuContent.append(status, results);
}

async function runLinkCheck(byUrl, status, results, start) {
  start.disabled = true;
  results.replaceChildren();
  const urls = [...byUrl.keys()];
  let answers;
  try {
    // The requests moved to src/services/link-check.js in rewrite phase 4.
    answers = await window.OrbitNext.services.linkCheck.checkLinks(urls,
      { onProgress: (done, total) => { status.textContent = `Checked ${done} of ${total}…`; } });
  } catch (error) {
    status.textContent = `The check stopped: ${error.message}`;
    start.disabled = false;
    return;
  }
  linkCheckResults.clear();
  const failures = [];
  for (const [url, entries] of byUrl) {
    const answer = answers[url] || { ok: false, error: 'no answer' };
    for (const entry of entries) linkCheckResults.set(destinationKey(entry.item), answer);
    if (!answer.ok) failures.push({ url, answer, entries });
  }
  status.textContent = failures.length
    ? `Checked ${counted(urls.length, 'address', 'addresses')}: ${failures.length} did not answer correctly.`
    : `Checked ${counted(urls.length, 'address', 'addresses')}: all answered.`;
  failures.forEach(({ answer, entries }) => entries.forEach(({ item, path }) => {
    const row = element('div', 'editor-list-row link-check-failure');
    const copy = element('span', 'history-copy');
    copy.append(element('strong', '', `⚠ ${item.name}`));
    copy.append(element('small', '', `${pathLabel(path)} · ${answer.status ? `HTTP ${answer.status}` : answer.error}`));
    row.append(copy, editorButton(groups[path[0]].team ? 'View' : 'Edit', () => editPath(path)));
    results.append(row);
  }));
  start.disabled = false;
  renderEditorTree();
}

// ---- Bookmark import ----------------------------------------------------

const BOOKMARK_LIMIT = window.OrbitNext.core.BOOKMARK_LIMIT;

// Folder tree to suns moved to src/core/bookmarks.js in rewrite phase 2.
function bookmarksToMap(root) { return window.OrbitNext.core.bookmarksToMap(root); }

function importBookmarks() {
  // Reading the file moved to src/services/file-io.js in rewrite phase 4.
  const fileIo = window.OrbitNext.services.fileIo;
  fileIo.pickFile('.html,.htm,text/html', async file => {
    try {
      const { map, stats } = bookmarksToMap(fileIo.readBookmarksHtml(await file.text()));
      if (!map.groups.length) throw new Error('The file has no website bookmarks.');
      const note = `Read ${counted(stats.links, 'website bookmark')}${stats.skipped ? `; skipped ${counted(stats.skipped, 'other link')} (not http or https)` : ''}${stats.truncated ? `; stopped at ${BOOKMARK_LIMIT}` : ''}. Each folder becomes a sun; a subfolder becomes a planet with its links as moons.`;
      showImportReview(map, { title: 'Review bookmarks', replace: false, label: 'Imported browser bookmarks', note });
    } catch (error) {
      editorError(`Bookmark import failed: ${error.message}`);
    }
  });
}

// ---- Bulk Remote Desktop settings -----------------------------------------

function showBulkRdp(sunIndex, planetIndex) {
  const planet = groups[sunIndex].links[planetIndex];
  const back = () => showPlanetEditor(sunIndex, planetIndex);
  editorHeader(`RDP settings for ${planet.name}`, back);
  menuContent.append(element('p', '', 'Apply one set of Remote Desktop settings to several links at once. Each link keeps its own computer; passwords, tokens, and signatures are never kept.'));
  const targets = [];
  if (planet.type === 'rdp') targets.push({ label: `${planet.name} (this planet)`, path: [sunIndex, planetIndex], item: planet });
  planet.moons.forEach((moon, moonIndex) => {
    if (moon.type === 'rdp') targets.push({ label: moon.name, path: [sunIndex, planetIndex, moonIndex], item: moon });
  });
  let profile = null;
  const sourceField = element('label', 'editor-field');
  sourceField.append(element('span', '', 'Settings from'));
  const source = document.createElement('select');
  source.setAttribute('aria-label', 'Settings from');
  const fileOption = element('option', '', 'An .rdp file…');
  fileOption.value = 'file';
  source.append(fileOption);
  targets.forEach((target, index) => {
    if (!target.item.rdpProfile) return;
    const option = element('option', '', `${target.item.name}’s imported settings`);
    option.value = String(index);
    source.append(option);
  });
  rdpPresets.forEach(preset => {
    const option = element('option', '', `Preset: ${preset.name}`);
    option.value = `preset:${preset.id}`;
    source.append(option);
  });
  sourceField.append(source);
  const preview = element('div', 'rdp-bulk-preview');
  const chooseFile = editorButton('Choose .rdp file', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.rdp,application/x-rdp';
    input.addEventListener('change', async () => {
      if (!input.files.length) return;
      try {
        const parsed = parseRdpProfile(await readRdpText(input.files[0]));
        setProfile(parsed.content, `${input.files[0].name}${parsed.removed ? ` (${counted(parsed.removed, 'sensitive setting')} excluded)` : ''}`);
      } catch (error) {
        editorError(`RDP import failed: ${error.message}`);
      }
    });
    input.click();
  });
  const apply = editorButton('Apply to selected links', () => {
    const chosen = targets.filter((_, index) => boxes[index].checked);
    if (!profile || !chosen.length) return;
    const next = copyGroups();
    const preset = source.value.startsWith('preset:') ? source.value.slice(7) : null;
    for (const target of chosen) {
      const item = target.path.length === 3
        ? next[target.path[0]].links[target.path[1]].moons[target.path[2]] : next[target.path[0]].links[target.path[1]];
      // A preset is linked by name; other settings are copied in.
      if (preset) item.rdpPreset = preset;
      else {
        item.rdpProfile = parseRdpProfile(profile, item.host).content;
        delete item.rdpPreset;
      }
    }
    applyEditorChange(next, back, { label: `Applied RDP settings to ${counted(chosen.length, 'link')} in ${planet.name}` });
  }, 'editor-primary');
  apply.disabled = true;
  const setProfile = (content, from) => {
    profile = content;
    preview.replaceChildren(element('p', 'data-source', `Settings from ${from}:`));
    const rows = element('ul', 'rdp-bulk-settings');
    profileRows(content).filter(row => !/^full address:/i.test(row)).forEach(row => rows.append(element('li', '', row)));
    if (!rows.children.length) rows.append(element('li', '', 'Only the computer address (no other settings).'));
    preview.append(rows);
    apply.disabled = false;
  };
  const update = () => {
    chooseFile.hidden = source.value !== 'file';
    if (source.value === 'file') {
      profile = null;
      preview.replaceChildren(element('p', 'data-source', 'Choose an .rdp file to see its settings.'));
      apply.disabled = true;
    } else if (source.value.startsWith('preset:')) {
      const preset = rdpPresets.find(item => item.id === source.value.slice(7));
      setProfile(`full address:s:example\r\n${preset.settings}`, `the ${preset.name} preset`);
    } else {
      setProfile(targets[Number(source.value)].item.rdpProfile, `${targets[Number(source.value)].item.name}`);
    }
  };
  source.addEventListener('change', update);
  menuContent.append(sourceField);
  editorActions().append(chooseFile);
  menuContent.append(preview);
  menuContent.append(element('h4', 'editor-section-title', 'Apply to'));
  const boxes = targets.map(target => {
    const row = element('label', 'editor-check');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = true;
    row.append(box, element('span', '', `${target.label} → ${target.item.host}${target.item.rdpProfile ? ' (has settings)' : ''}`));
    menuContent.append(row);
    return box;
  });
  const actions = editorActions();
  actions.append(apply);
  actions.append(editorButton('Clear imported settings', () => {
    const chosen = targets.filter((_, index) => boxes[index].checked && targets[index].item.rdpProfile);
    if (!chosen.length) return editorError('None of the selected links has imported settings.');
    if (!window.confirm(`Remove imported settings from ${counted(chosen.length, 'link')}?`)) return;
    const next = copyGroups();
    for (const target of chosen) {
      const item = target.path.length === 3
        ? next[target.path[0]].links[target.path[1]].moons[target.path[2]] : next[target.path[0]].links[target.path[1]];
      delete item.rdpProfile;
    }
    applyEditorChange(next, back, { label: `Cleared RDP settings from ${counted(chosen.length, 'link')} in ${planet.name}` });
  }, 'editor-danger'));
  update();
}

function profileRows(text) {
  return text.split(/\r\n|\n|\r/).filter(Boolean);
}

// ---- Read-only team screens ---------------------------------------------

function personalSunOptions() {
  return groups.flatMap((sun, index) => sun.team ? [] : [[String(index), sun.name]]);
}

function showTeamSun(index) {
  const sun = groups[index];
  editorHeader(`${sun.icon ? `${sun.icon} ` : ''}${sun.name} (team)`, showSunList);
  menuContent.append(element('p', 'editor-note', 'This sun comes from the team map, so it is read-only here. Copy it, or any of its planets and moons, into your own map to change it.'));
  if (sun.description) menuContent.append(descriptionNode('', sun.description));
  const actions = editorActions();
  actions.append(editorButton('Copy sun to my map', () => {
    const next = copyGroups();
    const copy = plainCopy(sun);
    copy.id = uniqueSunId(copy.name, new Set(next.map(item => item.id)));
    next.push(copy);
    applyEditorChange(next, () => showSunEditor(next.length - 1), { label: `Copied team sun ${sun.name}` });
  }, 'editor-primary'));
  actions.append(editorButton('Hide this team sun', () => {
    setTeamSunHidden(sun.id, true);
    showSunList();
  }));
  actions.append(editorButton('Export sun', () => exportItem('sun', sun)));
  menuContent.append(element('h4', 'editor-section-title', 'Planets'));
  const list = element('div', 'editor-list');
  sun.links.forEach((planet, planetIndex) => {
    const row = element('div', 'editor-list-row');
    row.append(element('span', '', `${planet.name} · ${counted(planet.moons.length, 'moon')}`));
    row.append(editorButton('View', () => showTeamItem([index, planetIndex])));
    list.append(row);
  });
  menuContent.append(list);
}

function showTeamItem(path) {
  const sun = groups[path[0]];
  const planet = sun.links[path[1]];
  const item = itemAt(path);
  const isMoon = path.length === 3;
  if (!item) return showTeamSun(path[0]);
  editorHeader(`${item.name} (team)`, () => isMoon ? showTeamItem(path.slice(0, 2)) : showTeamSun(path[0]));
  menuContent.append(element('p', '', `${sun.name} sun${isMoon ? ` → ${planet.name} planet` : ''} · read-only team ${isMoon ? 'moon' : 'planet'}`));
  menuContent.append(element('p', 'data-source', item.type === 'rdp' ? `Remote Desktop: ${item.host}` : item.url));
  if (item.tags?.length) menuContent.append(tagChips(item.tags));
  const favorite = isFavorite(item, sun);
  editorActions().append(editorButton(favorite ? 'Remove from favorites' : 'Add to favorites', () => {
    setFavorite(path, !favorite);
    showTeamItem(path);
  }));
  // Copy into a personal sun (a planet) or onto a personal planet (a moon).
  const options = isMoon
    ? groups.flatMap((target, targetSun) => target.team ? [] : target.links.map((targetPlanet, targetPlanetIndex) =>
      [`${targetSun}:${targetPlanetIndex}`, `${target.name} → ${targetPlanet.name}`]))
    : personalSunOptions();
  if (options.length) {
    const select = moveTargetField(options);
    select.setAttribute('aria-label', 'Copy to');
    select.previousElementSibling.textContent = 'Copy to';
    editorActions().append(editorButton(isMoon ? 'Copy moon to my map' : 'Copy planet to my map', () => {
      const next = copyGroups();
      const [targetSun, targetPlanet] = select.value.split(':').map(Number);
      if (isMoon) next[targetSun].links[targetPlanet].moons.push(plainCopy(item));
      else next[targetSun].links.push(plainCopy(item));
      applyEditorChange(next, () => isMoon
        ? showMoonEditor(targetSun, targetPlanet, next[targetSun].links[targetPlanet].moons.length - 1)
        : showPlanetEditor(targetSun, next[targetSun].links.length - 1),
      { label: `Copied team ${isMoon ? 'moon' : 'planet'} ${item.name}` });
    }, 'editor-primary'));
  } else {
    menuContent.append(element('p', 'editor-hint', `Add ${isMoon ? 'a planet' : 'a sun'} to your own map to copy this ${isMoon ? 'moon' : 'planet'} into it.`));
  }
  if (!isMoon && planet.moons.length) {
    menuContent.append(element('h4', 'editor-section-title', 'Moons'));
    const list = element('div', 'editor-list');
    planet.moons.forEach((moon, moonIndex) => {
      const row = element('div', 'editor-list-row');
      row.append(element('span', '', moon.name));
      row.append(editorButton('View', () => showTeamItem([path[0], path[1], moonIndex])));
      list.append(row);
    });
    menuContent.append(list);
  }
}
