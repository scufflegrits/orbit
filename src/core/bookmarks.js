// Browser bookmarks to suns. Takes the folder tree that services/file-io reads
// from an exported bookmarks HTML file (phase 4; tools.js readBookmarkFolder
// until then). Moved from tools.js (2.2.1).
import { validDestination, validateMap } from './schema.js';

/** Most links one import takes. */
export const BOOKMARK_LIMIT = 2000;
/** Browser toolbar folders, whose subfolders become suns of their own. */
export const BOOKMARK_BARS = /^(bookmarks bar|bookmarks toolbar|favorites bar|favourites bar|other bookmarks|other favorites|mobile bookmarks)$/i;

/** @typedef {{name: string, url: string}} BookmarkLink */
/** @typedef {{name: string, links: BookmarkLink[], folders: BookmarkFolder[]}} BookmarkFolder */

/** @param {BookmarkFolder} folder @returns {BookmarkLink[]} */
function flattenFolder(folder) {
  return [...folder.links, ...folder.folders.flatMap(flattenFolder)];
}

/**
 * Turn bookmark folders into suns, links into planets, and each subfolder into
 * a group planet with all its links as moons. Toolbar folders are
 * unwrapped; loose links go into a "Bookmarks" sun. Non-web links are skipped.
 * @param {BookmarkFolder} root
 */
export function bookmarksToMap(root) {
  const stats = { links: 0, skipped: 0, truncated: false };
  /** @param {BookmarkLink} link */
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
  /** @type {BookmarkFolder[]} */
  const tops = [];
  for (const folder of root.folders) {
    if (BOOKMARK_BARS.test(folder.name)) {
      tops.push(...folder.folders);
      if (folder.links.length) tops.push({ name: folder.name, links: folder.links, folders: [] });
    } else {
      tops.push(folder);
    }
  }
  if (root.links.length) tops.push({ name: 'Bookmarks', links: [...root.links], folders: [] });
  const suns = tops.map(folder => {
    /** @type {any[]} */
    const links = folder.links.map(destination).filter(Boolean).map(item => ({ ...item, moons: [] }));
    for (const sub of folder.folders) {
      const items = /** @type {any[]} */ (flattenFolder(sub).map(destination).filter(Boolean));
      if (!items.length) continue;
      links.push({ name: sub.name, type: 'group', moons: items });
    }
    return { name: folder.name, description: 'Imported from browser bookmarks', links };
  }).filter(sun => sun.links.length);
  return { map: validateMap({ groups: suns }), stats };
}
