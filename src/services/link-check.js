// Asking serve.py whether each web address answers (2.2.1 tools.js
// runLinkCheck). Only works when Orbit is served by serve.py; the request
// carries X-Orbit-Check so other sites can't trigger it.

export const BATCH_SIZE = 50;

/**
 * @typedef {{ok: boolean, status?: number, error?: string}} LinkAnswer
 */

/**
 * Check addresses in batches of 50. `onProgress(done, total)` is called
 * before each batch. Throws with the text shown in the editor when the
 * server can't check links or answers with an error.
 * @param {string[]} urls
 * @param {{onProgress?: (done: number, total: number) => void, fetch?: (url: string, init: any) => Promise<any>}} [options]
 * @returns {Promise<Record<string, LinkAnswer>>}
 */
export async function checkLinks(urls, { onProgress = () => {}, fetch = (url, init) => globalThis.fetch(url, init) } = {}) {
  /** @type {Record<string, LinkAnswer>} */
  const answers = {};
  for (let index = 0; index < urls.length; index += BATCH_SIZE) {
    onProgress(index, urls.length);
    const response = await fetch('./api/check-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Orbit-Check': '1' },
      body: JSON.stringify({ urls: urls.slice(index, index + BATCH_SIZE) }),
    });
    if (response.status === 404 || response.status === 501) {
      throw new Error('This server cannot check links. Start Orbit with python3 serve.py from this version.');
    }
    if (!response.ok) throw new Error(`The server answered HTTP ${response.status}.`);
    Object.assign(answers, await response.json());
  }
  return answers;
}
