/**
 * Identify a parsed map or item, or recognize the text of a bookmarks file.
 * @param {unknown} data
 * @param {string} fileName
 */
export function importKind(data, fileName = '') {
  if (/\.html?$/i.test(fileName)) return 'bookmarks';
  if (typeof data === 'string' && (/^\s*<!doctype netscape-bookmark-file/i.test(data) || /<dl\s*>/i.test(data))) {
    return 'bookmarks';
  }
  if (!data || typeof data !== 'object') return 'unknown';
  if (!('format' in data) && 'groups' in data && Array.isArray(data.groups)) return 'map';
  if ('format' in data && data.format === 'orbit-item-v1' && 'kind' in data) {
    const { kind } = data;
    if (kind === 'sun' || kind === 'planet' || kind === 'moon') return kind;
  }
  return 'unknown';
}
