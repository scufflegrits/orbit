// One key per destination, and finding items by key or path in the combined map.
// Pure: no DOM, no storage. Moved from storage.js and pure helpers (2.2.1).

/**
 * The key that makes two destinations "the same": fragment, trailing slashes and
 * host case are ignored. Remote Desktop gives rdp:<host>. No item gives ''.
 * @param {any} item A Destination, or null/undefined.
 * @returns {string}
 */
export function destinationKey(item) {
  if (!item) return '';
  if (item.type === 'rdp') return `rdp:${String(item.host || '').toLowerCase()}`;
  try {
    const url = new URL(item.url);
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`;
  } catch {
    return `url:${item.url}`;
  }
}

/**
 * Every planet and moon in the map whose key matches, as [sun, planet] or [sun, planet, moon].
 * @param {import('./types.js').Sun[]} groups
 * @param {string} key
 * @returns {number[][]}
 */
export function pathsForKey(groups, key) {
  /** @type {number[][]} */
  const paths = [];
  groups.forEach((sun, sunIndex) => sun.links.forEach((planet, planetIndex) => {
    if (destinationKey(planet) === key) paths.push([sunIndex, planetIndex]);
    planet.moons.forEach((moon, moonIndex) => {
      if (destinationKey(moon) === key) paths.push([sunIndex, planetIndex, moonIndex]);
    });
  }));
  return paths;
}

/**
 * The planet or moon at a path, or undefined.
 * @param {import('./types.js').Sun[]} groups
 * @param {number[]} path
 * @returns {import('./types.js').Destination | undefined}
 */
export function itemAt(groups, path) {
  const planet = groups[/** @type {number} */ (path[0])]?.links[/** @type {number} */ (path[1])];
  return path.length === 3 ? planet?.moons[/** @type {number} */ (path[2])] : planet;
}
