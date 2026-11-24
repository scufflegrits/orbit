// Import browser bookmarks (2.2.1 tools.js): each folder becomes a sun, reviewed before anything is added.
// Moved in rewrite phase 6b.
import { BOOKMARK_LIMIT, bookmarksToMap } from '../../../core/bookmarks.js';
import * as fileIo from '../../../services/file-io.js';
import { counted } from '../../dom.js';
import { nav } from '../nav.js';

/** @param {string} text */
export function reviewBookmarks(text) {
  const { map, stats } = bookmarksToMap(fileIo.readBookmarksHtml(text));
  if (!map.groups.length) throw new Error('The file has no website bookmarks.');
  const note = `Read ${counted(stats.links, 'website bookmark')}${stats.skipped ? `; skipped ${counted(stats.skipped, 'other link')} (not http or https)` : ''}${stats.truncated ? `; stopped at ${BOOKMARK_LIMIT}` : ''}. Each folder becomes a sun; a subfolder becomes a group planet with all its links as moons.`;
  nav.showImportReview(map, { title: 'Review bookmarks', replace: false, label: 'Imported browser bookmarks', note });
}
