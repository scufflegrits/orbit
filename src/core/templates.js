// Placeholders such as {ticket} in a web address, filled in when the link opens.
// Pure: no DOM, no storage. Moved from storage.js (2.2.1).

/** A placeholder: letters, digits, _ and -, up to 30 characters. Global, so use it only with replace and matchAll. */
export const PLACEHOLDER = /\{([A-Za-z0-9_-]{1,30})\}/g;

/**
 * The placeholder names in an address, each once, in order of first use.
 * @param {unknown} url
 * @returns {string[]}
 */
export function templateNames(url) {
  return [...new Set([...String(url || '').matchAll(PLACEHOLDER)].map(match => String(match[1])))];
}

/**
 * The address with each placeholder replaced by its URI-encoded value (nothing when missing).
 * @param {string} url
 * @param {Record<string, string|undefined>} values
 * @returns {string}
 */
export function fillTemplate(url, values) {
  return url.replace(PLACEHOLDER, (_, name) => encodeURIComponent(Object.hasOwn(values, name) ? values[name] ?? '' : ''));
}
