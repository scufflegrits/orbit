/** The decoded sun ID in a System fragment, or null for other routes. @param {string} hash */
export function systemIdFromHash(hash) {
  try {
    const route = decodeURIComponent(hash.slice(1));
    return route.startsWith('group/') ? route.slice(6) : null;
  } catch {
    return null;
  }
}
