// Runs Orbit 2.2.1's own code (the frozen copies in this folder) in a Node vm
// sandbox, so the rewrite's tests can compare new code with the old answers
// (REWRITE_PLAN.md, "Differential test against 2.2.0").
//
//   import { oracle } from '../../tests/oracle/oracle.mjs';
//   const old = oracle();                  // a fresh sandbox
//   old.call('validateMap', data)          // result as plain JSON, or { error: message }
//   old.set('groups', map.groups)          // the globals 2.2.1 functions read
//
// Results cross the sandbox boundary as JSON, so they compare equal with
// assert.deepStrictEqual against objects made here.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const HERE = new URL('.', import.meta.url);
const FILES = ['rdp.js', 'storage.js', 'pure.js'];
const CODE = FILES.map(name => readFileSync(new URL(name, HERE), 'utf8')).join('\n\n');

/** A fresh 2.2.1 sandbox. Each call builds a new one, so tests can't leak state. */
export function oracle() {
  const store = new Map();
  const context = vm.createContext({
    URL, TextEncoder, TextDecoder, Intl, console, btoa,
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: key => store.delete(key),
    },
  });
  vm.runInContext(`${CODE}
    var groups = []; var routines = []; var rdpPresets = []; var storageWarning = '';
    var MAP_STORAGE_KEY = 'orbit:map:v1'; var HISTORY_STORAGE_KEY = 'orbit:history:v1';
    globalThis.__set = (name, value) => { eval(name + ' = value'); };
    globalThis.__get = name => eval(name);`, context, { filename: 'orbit-2.2.1-oracle.js' });
  const innerJSON = vm.runInContext('JSON', context);
  const InnerRegExp = vm.runInContext('RegExp', context);
  const toPlain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
  const inside = value => (value === undefined ? undefined : innerJSON.parse(JSON.stringify(value)));
  return {
    /** Call a 2.2.1 function; returns its result as plain JSON, or {error: message} if it throws. */
    call(name, ...args) {
      try {
        return toPlain(context.__get(name)(...args.map(inside)));
      } catch (error) {
        return { error: String(error && error.message) };
      }
    },
    /** Set a 2.2.1 global (groups, routines, rdpPresets) for the functions that read it. */
    set(name, value) {
      context.__set(name, inside(value));
    },
    /** Run code inside the sandbox (to define the browser-side functions 2.2.1 code calls); returns plain JSON. */
    run(code) {
      return toPlain(vm.runInContext(code, context));
    },
    /** Everything in the sandbox's localStorage, as {key: text}. */
    storage() {
      return Object.fromEntries(store);
    },
    /** Replace the sandbox's localStorage contents. */
    setStorage(entries) {
      store.clear();
      for (const [key, value] of Object.entries(entries)) store.set(key, String(value));
    },
    /** Read a 2.2.1 global or constant, as plain JSON. */
    get(name) {
      const value = context.__get(name);
      return value instanceof InnerRegExp ? value : toPlain(value);
    },
  };
}
