// Import browser bookmarks (2.2.1 tools.js): each folder becomes a sun, reviewed before anything is added.
// Moved in rewrite phase 6b.
import { BOOKMARK_LIMIT, bookmarksToMap } from '../../../core/bookmarks.js';
import * as fileIo from '../../../services/file-io.js';
import { counted } from '../../dom.js';
import { editorError } from '../kit.js';
import { nav } from '../nav.js';

export function importBookmarks() {
  // Reading the file moved to src/services/file-io.js in rewrite phase 4.
  fileIo.pickFile('.html,.htm,text/html', async file => {
    try {
      const { map, stats } = bookmarksToMap(fileIo.readBookmarksHtml(await file.text()));
      if (!map.groups.length) throw new Error('The file has no website bookmarks.');
      const note = `Read ${counted(stats.links, 'website bookmark')}${stats.skipped ? `; skipped ${counted(stats.skipped, 'other link')} (not http or https)` : ''}${stats.truncated ? `; stopped at ${BOOKMARK_LIMIT}` : ''}. Each folder becomes a sun; a subfolder becomes a planet with its links as moons.`;
      nav.showImportReview(map, { title: 'Review bookmarks', replace: false, label: 'Imported browser bookmarks', note });
    } catch (error) {
      editorError(`Bookmark import failed: ${/** @type {any} */ (error).message}`);
    }
  });
}
