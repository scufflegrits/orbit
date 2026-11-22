// Operations on the map: moving an item, merging an import, finding
// duplicates, and copying team items into the personal map. Pure: each takes
// the map and returns a new value, never changing its input. Moved from
// drag.js, tools.js, routines.js, team.js, sharing.js, and storage.js (2.2.1).
import { destinationKey } from './destination.js';
import { uniqueSunId } from './schema.js';

export { uniqueSunId };

/** @typedef {import('./types.js').Sun} Sun */
/** @typedef {import('./types.js').Planet} Planet */
/** @typedef {import('./types.js').Destination} Destination */

/**
 * Where an item sits, by array index (team suns first, as on the page).
 * @typedef {{kind: 'sun', sun: number} | {kind: 'planet', sun: number, planet: number} | {kind: 'moon', sun: number, planet: number, moon: number}} MapPath
 */
/**
 * A move target: a parent (append) or a sibling with `place`.
 * @typedef {MapPath & {place?: 'before' | 'after'}} MoveTarget
 */
/**
 * @typedef {{status: 'moved', groups: Sun[], path: MapPath, total: number} | {status: 'same'} | {status: 'invalid'}} MoveResult
 */

/** @param {any} value */
const clone = value => JSON.parse(JSON.stringify(value));

/**
 * The sun, planet, or moon at a path: the very object in `list`, or null.
 * @param {Sun[]} list
 * @param {any} path
 * @returns {any}
 */
export function mapItemAt(list, path) {
  const sun = list[path.sun];
  if (path.kind === 'sun') return sun || null;
  const planet = sun?.links[path.planet];
  if (path.kind === 'planet') return planet || null;
  return path.kind === 'moon' ? planet?.moons[path.moon] || null : null;
}

/** @param {any} a @param {any} b */
export function samePath(a, b) {
  return a.kind === b.kind && a.sun === b.sun && a.planet === b.planet && a.moon === b.moon;
}

/**
 * Move one item. A parent target ({kind: 'sun'} for a planet, {kind: 'planet'}
 * for a moon) appends. A sibling target (same kind as the source, with place
 * 'before' or 'after') reorders within one parent or inserts under another;
 * suns can only be reordered. Nothing moves out of, into, or around the team map.
 * @param {Sun[]} list The combined map.
 * @param {any} source
 * @param {any} target
 * @returns {MoveResult}
 */
export function moveMapItem(list, source, target) {
  /** @type {'sun'|'planet'|'moon'} */
  const key = source.kind;
  const parentKind = /** @type {Record<string, string>} */ ({ planet: 'sun', moon: 'planet' })[key];
  const sibling = target.kind === key && (target.place === 'before' || target.place === 'after');
  if (!['sun', 'planet', 'moon'].includes(key)) return { status: 'invalid' };
  if (!sibling && (!parentKind || target.kind !== parentKind)) return { status: 'invalid' };
  if (!mapItemAt(list, source) || !mapItemAt(list, target)) return { status: 'invalid' };
  if (sibling && samePath(source, target)) return { status: 'invalid' };
  if (list[source.sun]?.team || list[target.sun]?.team) return { status: 'invalid' };
  /** @type {Sun[]} */
  const next = clone(list);
  /** @param {any} path @returns {any[]} */
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
  /** @type {any} */
  const path = { kind: key, sun: key === 'sun' ? index : target.sun };
  if (key !== 'sun') path.planet = key === 'planet' ? index : target.planet;
  if (key === 'moon') path.moon = index;
  return { status: 'moved', groups: next, path, total: to.length };
}

/**
 * A team item copied into the personal map, as an independent item: no `team`
 * flag, and a sun id without its `team:` prefix.
 * @template T
 * @param {T} item
 * @returns {T}
 */
export function plainCopy(item) {
  const copy = clone(item);
  delete copy.team;
  if (typeof copy.id === 'string' && copy.id.startsWith('team:')) copy.id = copy.id.slice(5);
  return copy;
}

/**
 * The personal suns of a combined map (team suns are never stored).
 * @param {Sun[]} list
 */
export function personalGroups(list) {
  return list.filter(sun => !sun.team);
}

/**
 * Add what is new in `incoming` to `personal`, never changing what is there.
 * Suns match by id, then by name (ignoring case); planets match inside their
 * sun, and moons inside their planet, by destination key. When two planets in
 * a sun share an address, moons merge into the first.
 * @param {Sun[]} personal
 * @param {Sun[]} incoming
 */
export function mergeMaps(personal, incoming) {
  /** @type {Sun[]} */
  const next = clone(personal);
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

/**
 * Add incoming routines (or Remote Desktop presets) whose names are new,
 * ignoring case. A clashing id is replaced with one made from the name.
 * @template {{id: string, name: string}} T
 * @param {T[]} current
 * @param {T[]} incoming
 * @returns {T[]}
 */
export function mergeRoutines(current, incoming) {
  const names = new Set(current.map(routine => routine.name.toLocaleLowerCase()));
  const used = new Set(current.map(routine => routine.id));
  const next = [...current];
  for (const routine of incoming) {
    if (names.has(routine.name.toLocaleLowerCase())) continue;
    names.add(routine.name.toLocaleLowerCase());
    const copy = clone(routine);
    if (used.has(copy.id)) copy.id = uniqueSunId(copy.name, used);
    used.add(copy.id);
    next.push(copy);
  }
  return next;
}

/**
 * Every destination found more than once in the combined map, each with
 * every place it appears ([sun, planet] or [sun, planet, moon]).
 * @param {Sun[]} list
 * @returns {{item: Destination, path: number[]}[][]}
 */
export function duplicateGroups(list) {
  /** @type {Map<string, {item: Destination, path: number[]}[]>} */
  const byKey = new Map();
  list.forEach((sun, sunIndex) => sun.links.forEach((planet, planetIndex) => {
    /** @type {[Destination, number[]][]} */
    const entries = [[planet, [sunIndex, planetIndex]], ...planet.moons.map((moon, moonIndex) =>
      /** @type {[Destination, number[]]} */ ([moon, [sunIndex, planetIndex, moonIndex]]))];
    for (const [item, path] of entries) {
      const key = destinationKey(item);
      const found = byKey.get(key) || [];
      found.push({ item, path });
      byKey.set(key, found);
    }
  }));
  return [...byKey.values()].filter(found => found.length > 1);
}

/**
 * A link as it goes into a link pack: never its moons, favorite mark, or preset.
 * @param {any} item
 */
export function packLink(item) {
  const copy = plainCopy(item);
  delete copy.moons;
  delete copy.favorite;
  delete copy.rdpPreset;
  return copy;
}

/**
 * The content of a single-item export file (orbit-item-v1).
 * @param {'sun'|'planet'|'moon'} kind
 * @param {any} item
 */
export function itemExport(kind, item) {
  return { format: 'orbit-item-v1', kind, item: plainCopy(item) };
}
