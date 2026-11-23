// Quick find and the palette's matching (2.2.1 render.js). Pure: it takes the
// combined map as a parameter instead of reading a global.
import { isGroup } from './destination.js';

/**
 * @typedef {object} SearchField
 * @property {string} kind
 * @property {string} text
 * @property {number} weight
 * @property {boolean} [anywhere]
 * @property {string[]} [words]
 */

/**
 * @typedef {object} SearchEntry
 * @property {any} match
 * @property {string[]} tags
 * @property {SearchField[]} fields
 */

/**
 * Edit distance (with swapped neighbours as one edit); limit + 1 once it is over the limit.
 * @param {string} a
 * @param {string} b
 * @param {number} limit
 * @returns {number}
 */
export function editDistance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  /** @type {number[]} */
  let before = [];
  /** @type {number[]} */
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    /** @type {number[]} */
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

/**
 * @param {string} token
 * @param {string} text
 * @param {string[]} words
 * @param {boolean} loose
 * @param {boolean | undefined} anywhere
 * @returns {number}
 */
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

/**
 * @param {string} text
 * @returns {string[]}
 */
export function searchWords(text) {
  return text.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * @param {any} item
 * @returns {string}
 */
export function addressText(item) {
  if (isGroup(item)) return '';
  if (item.type === 'rdp') return item.host;
  try {
    const url = new URL(item.url);
    return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return item.url || '';
  }
}

/**
 * @param {import('./types.js').Sun[]} groups
 * @returns {SearchEntry[]}
 */
export function searchEntries(groups) {
  /** @type {SearchEntry[]} */
  const entries = [];
  /**
   * @param {string} name
   * @param {string} [path]
   * @param {any} [item]
   * @returns {SearchField[]}
   */
  const fields = (name, path, item) => {
    /** @type {SearchField[]} */
    const list = [{ kind: 'name', text: name.toLocaleLowerCase(), weight: 1, anywhere: true }];
    if (path) list.push({ kind: 'path', text: path.toLocaleLowerCase(), weight: .7 });
    if (item) {
      if (!isGroup(item)) list.push({ kind: 'address', text: addressText(item).toLocaleLowerCase(), weight: .6 });
      if (item.tags?.length) list.push({ kind: 'tag', text: item.tags.join(' '), weight: .8 });
      if (item.note) list.push({ kind: 'note', text: item.note.toLocaleLowerCase(), weight: .5 });
    }
    return list.map(field => ({ ...field, words: searchWords(field.text) }));
  };
  groups.forEach((sun, sunIndex) => {
    entries.push({ match: { kind: 'Sun', name: sun.name, path: sun.team ? 'Team Galaxy' : 'Galaxy', id: sun.id, icon: sun.icon },
      tags: [], fields: fields(sun.name) });
    sun.links.forEach((planet, planetIndex) => {
      entries.push({ match: { kind: isGroup(planet) ? 'Group' : 'Planet', name: planet.name, path: sun.name, destination: planet,
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

/**
 * @param {import('./types.js').Sun[]} groups
 * @param {string} query
 * @returns {any[]}
 */
export function findMatches(groups, query) {
  const raw = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  /** @type {string[]} */
  const tagFilters = raw.flatMap(word => {
    const tag = /^#(.+)$/.exec(word) || /^tag:(.+)$/.exec(word);
    return tag ? [tag[1]] : [];
  });
  const tokens = raw.filter(word => !/^#.+$/.test(word) && !/^tag:.+$/.test(word));
  if (!tokens.length && !tagFilters.length) return [];
  const entries = searchEntries(groups).filter(entry => tagFilters.every(tag => entry.tags.includes(tag)));
  const strictHits = new Set(tokens.filter(token => entries.some(entry =>
    entry.fields.some(field => wordQuality(token, field.text, field.words || [], false, field.anywhere)))));
  /** @type {{match: any, order: number}[]} */
  const scored = [];
  entries.forEach((entry, order) => {
    let score = 0;
    /** @type {Set<string>} */
    const reasons = new Set();
    for (const token of tokens) {
      let best = 0;
      let bestKind = '';
      for (const field of entry.fields) {
        const quality = wordQuality(token, field.text, field.words || [], !strictHits.has(token), field.anywhere) * field.weight;
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
