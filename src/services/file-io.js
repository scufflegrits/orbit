// Files the user picks or saves (2.2.1 editor.js, rdp.js, tools.js): choosing
// a file, reading JSON, .rdp, and bookmark files, and downloads.
//
// `document`, `URL`, and `DOMParser` are looked up on every call, so a test
// that replaces URL.createObjectURL still takes effect.
import { RDP_FILE_LIMIT, decodeRdpBytes } from '../core/rdp.js';

/**
 * Save text as a file through a temporary link.
 * @param {string} text
 * @param {string} filename
 * @param {string} type
 */
export function downloadText(text, filename, type) {
  const page = /** @type {any} */ (globalThis);
  const blob = new Blob([text], { type });
  const url = page.URL.createObjectURL(blob);
  const anchor = page.document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  page.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => page.URL.revokeObjectURL(url), 1000);
}

/** While set, JSON downloads go here instead of to a file (captureJson). @type {((data: unknown) => void) | null} */
let jsonSink = null;

/**
 * Save data as indented JSON with a final newline.
 * @param {unknown} data
 * @param {string} filename
 */
export function downloadJson(data, filename) {
  if (jsonSink) return jsonSink(data);
  downloadText(JSON.stringify(data, null, 2) + '\n', filename, 'application/json');
}

/**
 * Run `action` and return the data of the last JSON download it made, with
 * no file saved (OrbitTest.captureDownload).
 * @param {() => void} action
 */
export function captureJson(action) {
  /** @type {unknown} */
  let data;
  const previous = jsonSink;
  jsonSink = value => { data = value; };
  try {
    action();
  } finally {
    jsonSink = previous;
  }
  return data;
}

/**
 * Show the browser's file chooser; `onFile` gets the chosen file. Nothing
 * happens if the user cancels. Must be called from a click.
 * @param {string} accept
 * @param {(file: File) => void} onFile
 */
export function pickFile(accept, onFile) {
  const input = /** @type {HTMLInputElement} */ (/** @type {any} */ (globalThis).document.createElement('input'));
  input.type = 'file';
  input.accept = accept;
  input.addEventListener('change', () => {
    if (input.files?.length) onFile(input.files[0]);
  });
  input.click();
}

/**
 * A file's text parsed as JSON. Throws JSON.parse's error.
 * @param {{text(): Promise<string>}} file
 */
export async function readJsonFile(file) {
  return JSON.parse(await file.text());
}

/**
 * Read a file that can be JSON or HTML. An unparsed file still carries its text.
 * @param {File} file
 */
export async function readImportFile(file) {
  const text = await file.text();
  try {
    return { text, data: JSON.parse(text) };
  } catch {
    return { text, data: undefined };
  }
}

/**
 * A .rdp file's text, whatever its encoding (UTF-16 with or without a BOM,
 * or UTF-8). Throws when it is over 64,000 bytes.
 * @param {{size: number, arrayBuffer(): Promise<ArrayBuffer>}} file
 */
export async function readRdpText(file) {
  if (file.size > RDP_FILE_LIMIT) throw new Error('The .rdp file is too large to import.');
  return decodeRdpBytes(new Uint8Array(await file.arrayBuffer()));
}

/**
 * @typedef {{name: string, links: {name: string, url: string}[], folders: BookmarkFolder[]}} BookmarkFolder
 */

/**
 * One <DL> list of a Netscape bookmark file as a folder tree. A nested list
 * may sit inside its <DT> or right after it, depending on the parser.
 * @param {Element} list
 * @param {string} name
 * @returns {BookmarkFolder}
 */
function readBookmarkFolder(list, name) {
  /** @type {BookmarkFolder} */
  const folder = { name, links: [], folders: [] };
  for (const entry of list.querySelectorAll(':scope > dt, :scope > p > dt')) {
    const heading = entry.querySelector(':scope > h3');
    const anchor = entry.querySelector(':scope > a');
    if (heading) {
      const sub = entry.querySelector(':scope > dl') ||
        (entry.nextElementSibling?.tagName === 'DL' ? entry.nextElementSibling : null);
      if (sub) folder.folders.push(readBookmarkFolder(sub, heading.textContent?.trim() || 'Folder'));
    } else if (anchor) {
      folder.links.push({ name: anchor.textContent?.trim() ?? '', url: anchor.getAttribute('href') || '' });
    }
  }
  return folder;
}

/**
 * A browser's exported bookmarks HTML as a folder tree, for core/bookmarks.
 * Throws when the text has no bookmark list.
 * @param {string} text
 * @returns {BookmarkFolder}
 */
export function readBookmarksHtml(text) {
  const doc = new (/** @type {any} */ (globalThis).DOMParser)().parseFromString(text, 'text/html');
  const list = doc.querySelector('dl');
  if (!list) throw new Error('This is not a bookmarks file. Export bookmarks from your browser as HTML.');
  return readBookmarkFolder(list, 'Bookmarks');
}
