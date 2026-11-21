// FROZEN ORACLE: the pure functions of Orbit 2.2.1 outside storage.js and rdp.js,
// extracted unchanged from tag v2.2.1 (file and function names below).
// Never edit. Loaded in Node vm by tests/oracle/oracle.mjs.

// ---- team.js: plainCopy

function plainCopy(item) {
  const copy = JSON.parse(JSON.stringify(item));
  delete copy.team;
  if (typeof copy.id === 'string' && copy.id.startsWith('team:')) copy.id = copy.id.slice(5);
  return copy;
}

// ---- favorites.js: pathsForKey, itemAt

function pathsForKey(key) {
  const paths = [];
  groups.forEach((sun, sunIndex) => sun.links.forEach((planet, planetIndex) => {
    if (destinationKey(planet) === key) paths.push([sunIndex, planetIndex]);
    planet.moons.forEach((moon, moonIndex) => {
      if (destinationKey(moon) === key) paths.push([sunIndex, planetIndex, moonIndex]);
    });
  }));
  return paths;
}

function itemAt(path) {
  const planet = groups[path[0]]?.links[path[1]];
  return path.length === 3 ? planet?.moons[path[2]] : planet;
}

// ---- render.js: editDistance, SHORT_FORM, wordQuality, searchWords, addressText, searchEntries, findMatches

function editDistance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let before = [];
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) current[j] = Math.min(current[j], before[j - 2] + 1);
      best = Math.min(best, current[j]);
    }
    if (best > limit) return limit + 1;
    before = previous;
    previous = current;
  }
  return previous[b.length];
}

const SHORT_FORM = /^([a-z]+)(\d+)$/;

function wordQuality(token, text, words, loose, anywhere) {
  let best = 0;
  for (const word of words) {
    if (word === token) return 1;
    if (word.startsWith(token)) best = Math.max(best, .85);
    else if (token.length >= 3 && word.includes(token)) best = Math.max(best, .6);
    const short = SHORT_FORM.exec(token);
    const long = SHORT_FORM.exec(word);
    if (short && long && short[2] === long[2] && long[1].startsWith(short[1])) best = Math.max(best, .55);
    if (loose && !best && token.length >= 5) {
      const limit = token.length >= 9 ? 2 : 1;
      if (editDistance(token, word, limit) <= limit) best = Math.max(best, .4);
    }
  }
  // Names match any part ("ve" in "the verge"); other fields need 3+ letters,
  // which also lets "verge.com" match an address.
  if (!best && (anywhere || token.length >= 3) && text.includes(token)) best = .5;
  return best;
}

function searchWords(text) {
  return text.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function addressText(item) {
  if (item.type === 'rdp') return item.host;
  try {
    const url = new URL(item.url);
    return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return item.url || '';
  }
}

function searchEntries() {
  const entries = [];
  const fields = (name, path, item) => {
    const list = [{ kind: 'name', text: name.toLocaleLowerCase(), weight: 1, anywhere: true }];
    if (path) list.push({ kind: 'path', text: path.toLocaleLowerCase(), weight: .7 });
    if (item) {
      list.push({ kind: 'address', text: addressText(item).toLocaleLowerCase(), weight: .6 });
      if (item.tags?.length) list.push({ kind: 'tag', text: item.tags.join(' '), weight: .8 });
      if (item.note) list.push({ kind: 'note', text: item.note.toLocaleLowerCase(), weight: .5 });
    }
    return list.map(field => ({ ...field, words: searchWords(field.text) }));
  };
  groups.forEach((sun, sunIndex) => {
    entries.push({ match: { kind: 'Sun', name: sun.name, path: sun.team ? 'Team Galaxy' : 'Galaxy', id: sun.id, icon: sun.icon },
      tags: [], fields: fields(sun.name) });
    sun.links.forEach((planet, planetIndex) => {
      entries.push({ match: { kind: 'Planet', name: planet.name, path: sun.name, destination: planet,
        indices: [sunIndex, planetIndex], tags: planet.tags || [] },
      tags: planet.tags || [], fields: fields(planet.name, sun.name, planet) });
      planet.moons.forEach((moon, moonIndex) => {
        entries.push({ match: { kind: 'Moon', name: moon.name, path: `${sun.name} / ${planet.name}`, destination: moon,
          indices: [sunIndex, planetIndex, moonIndex], tags: moon.tags || [] },
        tags: moon.tags || [], fields: fields(moon.name, `${sun.name} ${planet.name}`, moon) });
      });
    });
  });
  return entries;
}

function findMatches(query) {
  const raw = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const tagFilters = raw.flatMap(word => {
    const tag = /^#(.+)$/.exec(word) || /^tag:(.+)$/.exec(word);
    return tag ? [tag[1]] : [];
  });
  const tokens = raw.filter(word => !/^#.+$/.test(word) && !/^tag:.+$/.test(word));
  if (!tokens.length && !tagFilters.length) return [];
  const entries = searchEntries().filter(entry => tagFilters.every(tag => entry.tags.includes(tag)));
  const strictHits = new Set(tokens.filter(token => entries.some(entry =>
    entry.fields.some(field => wordQuality(token, field.text, field.words, false, field.anywhere)))));
  const scored = [];
  entries.forEach((entry, order) => {
    let score = 0;
    const reasons = new Set();
    for (const token of tokens) {
      let best = 0;
      let bestKind = '';
      for (const field of entry.fields) {
        const quality = wordQuality(token, field.text, field.words, !strictHits.has(token), field.anywhere) * field.weight;
        if (quality > best) { best = quality; bestKind = field.kind; }
      }
      if (!best) return;
      score += best;
      reasons.add(bestKind);
    }
    // Where an item sits only narrows a search ("tech reviews"); typing a
    // sun's name should not list everything inside it.
    if (tokens.length && ![...reasons].some(kind => kind !== 'path')) return;
    if (!tokens.length) score = 1;
    const match = { ...entry.match, score };
    if (!reasons.has('name')) {
      if (reasons.has('address')) match.why = `Address: ${addressText(entry.match.destination)}`;
      else if (reasons.has('tag')) match.why = 'Matched a tag';
      else if (reasons.has('note')) match.why = 'Matched the note';
    }
    scored.push({ match, order });
  });
  scored.sort((a, b) => b.match.score - a.match.score || a.order - b.order);
  return scored.map(item => item.match);
}

// ---- drag.js: mapItemAt, samePath, moveMapItem

function mapItemAt(list, path) {
  const sun = list[path.sun];
  if (path.kind === 'sun') return sun || null;
  const planet = sun?.links[path.planet];
  if (path.kind === 'planet') return planet || null;
  return path.kind === 'moon' ? planet?.moons[path.moon] || null : null;
}

function samePath(a, b) {
  return a.kind === b.kind && a.sun === b.sun && a.planet === b.planet && a.moon === b.moon;
}

function moveMapItem(list, source, target) {
  const key = source.kind;
  const parentKind = { planet: 'sun', moon: 'planet' }[key];
  const sibling = target.kind === key && (target.place === 'before' || target.place === 'after');
  if (!['sun', 'planet', 'moon'].includes(key)) return { status: 'invalid' };
  if (!sibling && (!parentKind || target.kind !== parentKind)) return { status: 'invalid' };
  if (!mapItemAt(list, source) || !mapItemAt(list, target)) return { status: 'invalid' };
  if (sibling && samePath(source, target)) return { status: 'invalid' };
  // The team map is read-only: nothing moves out of, into, or around it.
  if (list[source.sun]?.team || list[target.sun]?.team) return { status: 'invalid' };
  const next = JSON.parse(JSON.stringify(list));
  const siblingsAt = path => key === 'sun' ? next
    : key === 'planet' ? next[path.sun].links : next[path.sun].links[path.planet].moons;
  const from = siblingsAt(source);
  const to = siblingsAt(target);
  let index = sibling ? target[key] + (target.place === 'after' ? 1 : 0) : to.length;
  if (from === to) {
    if (!sibling) return { status: 'same' };
    // Removing the source first shifts every later sibling down by one.
    if (source[key] < index) index--;
    if (index === source[key]) return { status: 'same' };
  }
  const [moved] = from.splice(source[key], 1);
  to.splice(index, 0, moved);
  const path = { kind: key, sun: key === 'sun' ? index : target.sun };
  if (key !== 'sun') path.planet = key === 'planet' ? index : target.planet;
  if (key === 'moon') path.moon = index;
  return { status: 'moved', groups: next, path, total: to.length };
}

// ---- tools.js: mergeMaps, duplicateGroups, BOOKMARK_LIMIT, BOOKMARK_BARS, flattenFolder, bookmarksToMap

function mergeMaps(personal, incoming) {
  const next = JSON.parse(JSON.stringify(personal));
  const added = { suns: 0, planets: 0, moons: 0 };
  const skipped = { suns: 0, planets: 0, moons: 0 };
  const usedIds = new Set(next.map(sun => sun.id));
  for (const source of incoming) {
    const sun = next.find(item => item.id === source.id) ||
      next.find(item => item.name.toLocaleLowerCase() === source.name.toLocaleLowerCase());
    if (!sun) {
      const copy = plainCopy(source);
      if (usedIds.has(copy.id)) copy.id = uniqueSunId(copy.name, usedIds);
      usedIds.add(copy.id);
      next.push(copy);
      added.suns++;
      added.planets += copy.links.length;
      added.moons += copy.links.reduce((sum, planet) => sum + planet.moons.length, 0);
      continue;
    }
    skipped.suns++;
    for (const sourcePlanet of source.links) {
      const key = destinationKey(sourcePlanet);
      const planet = sun.links.find(item => destinationKey(item) === key);
      if (!planet) {
        sun.links.push(plainCopy(sourcePlanet));
        added.planets++;
        added.moons += sourcePlanet.moons.length;
        continue;
      }
      skipped.planets++;
      for (const moon of sourcePlanet.moons) {
        const moonKey = destinationKey(moon);
        if (planet.moons.some(item => destinationKey(item) === moonKey)) {
          skipped.moons++;
        } else {
          planet.moons.push(plainCopy(moon));
          added.moons++;
        }
      }
    }
  }
  return { groups: next, added, skipped };
}

function duplicateGroups() {
  const byKey = new Map();
  groups.forEach((sun, sunIndex) => sun.links.forEach((planet, planetIndex) => {
    [[planet, [sunIndex, planetIndex]], ...planet.moons.map((moon, moonIndex) => [moon, [sunIndex, planetIndex, moonIndex]])]
      .forEach(([item, path]) => {
        const key = destinationKey(item);
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push({ item, path });
      });
  }));
  return [...byKey.values()].filter(list => list.length > 1);
}

const BOOKMARK_LIMIT = 2000;

const BOOKMARK_BARS = /^(bookmarks bar|bookmarks toolbar|favorites bar|favourites bar|other bookmarks|other favorites|mobile bookmarks)$/i;

function flattenFolder(folder) {
  return [...folder.links, ...folder.folders.flatMap(flattenFolder)];
}

function bookmarksToMap(root) {
  const stats = { links: 0, skipped: 0, truncated: false };
  const destination = link => {
    if (stats.links >= BOOKMARK_LIMIT) {
      stats.truncated = true;
      return null;
    }
    try {
      const url = new URL(link.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('not web');
      const item = validDestination({ name: link.name || url.hostname, url: link.url }, 'Bookmark');
      stats.links++;
      return item;
    } catch {
      stats.skipped++;
      return null;
    }
  };
  const tops = [];
  const loose = [];
  for (const folder of root.folders) {
    if (BOOKMARK_BARS.test(folder.name)) {
      tops.push(...folder.folders);
      if (folder.links.length) tops.push({ name: folder.name, links: folder.links, folders: [] });
    } else {
      tops.push(folder);
    }
  }
  loose.push(...root.links);
  if (loose.length) tops.push({ name: 'Bookmarks', links: loose, folders: [] });
  const suns = tops.map(folder => {
    const links = folder.links.map(destination).filter(Boolean).map(item => ({ ...item, moons: [] }));
    for (const sub of folder.folders) {
      const items = flattenFolder(sub).map(destination).filter(Boolean);
      if (!items.length) continue;
      links.push({ name: sub.name, url: items[0].url, moons: items.slice(1) });
    }
    return { name: folder.name, description: 'Imported from browser bookmarks', links };
  }).filter(sun => sun.links.length);
  return { map: validateMap({ groups: suns }), stats };
}

// ---- routines.js: mergeRoutines

function mergeRoutines(current, incoming) {
  const names = new Set(current.map(routine => routine.name.toLocaleLowerCase()));
  const used = new Set(current.map(routine => routine.id));
  const next = [...current];
  for (const routine of incoming) {
    if (names.has(routine.name.toLocaleLowerCase())) continue;
    names.add(routine.name.toLocaleLowerCase());
    const copy = JSON.parse(JSON.stringify(routine));
    if (used.has(copy.id)) copy.id = uniqueSunId(copy.name, used);
    used.add(copy.id);
    next.push(copy);
  }
  return next;
}

// ---- sharing.js: packLink, validPack

function packLink(item) {
  const copy = plainCopy(item);
  delete copy.moons;
  delete copy.favorite;
  delete copy.rdpPreset;
  return copy;
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
