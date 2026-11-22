// Stand-ins for the browser APIs the services use, for node tests
// (REWRITE_PLAN.md, phase 4: "Tests use fake window.open, fetch, storage,
// and clock"). Each installs itself on globalThis; tests remove it after.

const page = /** @type {any} */ (globalThis);

/**
 * A fake document whose download links record their file instead of saving
 * it. Returns the list of saved files: {download, type, text (a promise)}.
 */
export function fakeDocument() {
  /** @type {{download: string, type: string, text: Promise<string>}[]} */
  const saved = [];
  const blobs = new Map();
  page.URL.createObjectURL = blob => { const url = `blob:fake/${blobs.size}`; blobs.set(url, blob); return url; };
  page.URL.revokeObjectURL = url => { blobs.delete(url); };
  page.document = {
    createElement: tag => ({
      tag, href: '', download: '', type: '', accept: '', files: null, listeners: {},
      addEventListener(name, fn) { this.listeners[name] = fn; },
      click() {
        if (this.tag === 'a') {
          const blob = blobs.get(this.href);
          saved.push({ download: this.download, type: blob.type, text: blob.text() });
        } else {
          page.document.lastInput = this;
        }
      },
      remove() {},
    }),
    body: { append() {} },
    lastInput: null,
  };
  return saved;
}

/**
 * A fake fetch that answers from `routes`: url → {status, body} | {throws}
 * | a function of the request. Records every request.
 * @param {Record<string, any>} routes
 */
export function fakeFetch(routes) {
  const requests = [];
  const fetch = async (url, init = {}) => {
    requests.push({ url, ...init });
    let answer = routes[url];
    if (typeof answer === 'function') answer = answer({ url, ...init });
    if (!answer) answer = { status: 404 };
    if (answer.throws) throw new Error(answer.throws);
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      json: async () => {
        if (answer.badJson) throw new SyntaxError('Unexpected token < in JSON');
        return JSON.parse(JSON.stringify(answer.body));
      },
    };
  };
  return Object.assign(fetch, { requests });
}
