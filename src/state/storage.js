// Browser storage: the one place that touches localStorage. Key names and value
// formats are 2.2.1's (REWRITE_PLAN.md, "Storage keys").
//
// The backend is looked up on every call, never cached, so a test that stubs
// Storage.prototype.setItem (or swaps localStorage) still takes effect. Node
// tests install an in-memory stand-in with useBackend().

/**
 * The part of the Storage API Orbit uses.
 * @typedef {{getItem(key: string): string|null, setItem(key: string, value: string): void, removeItem(key: string): void}} StorageBackend
 */

/** Keys shared by every workspace, or the base of a per-workspace key. */
export const KEYS = Object.freeze({
  map: 'orbit:map:v1',
  undo: 'orbit:undo-removal:v1',
  history: 'orbit:history:v1',
  backup: 'orbit:backup:v1',
  workspaces: 'orbit:workspaces:v1',
  activeWorkspace: 'orbit:workspace',
  recent: 'orbit:recent:v1',
  variables: 'orbit:variables:v1',
  routineOffered: 'orbit:routine-offered:v1',
  teamFavorites: 'orbit:team-favorites',
  teamHidden: 'orbit:team-hidden',
  teamSeen: 'orbit:team-seen:v1',
});

/** @type {(() => StorageBackend) | null} */
let override = null;

/** @returns {StorageBackend} */
function backend() {
  return override ? override() : globalThis.localStorage;
}

/**
 * Use another storage (node tests). Pass null to go back to localStorage.
 * @param {StorageBackend | null} storage
 */
export function useBackend(storage) {
  override = storage ? () => storage : null;
}

/** An in-memory Storage stand-in, for tests. Set `failWrites` to act like a full storage. */
export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    failWrites: false,
    /** @param {string} key */
    getItem(key) { return data.has(key) ? /** @type {string} */ (data.get(key)) : null; },
    /** @param {string} key @param {string} value */
    setItem(key, value) {
      if (this.failWrites) throw new Error('The quota has been exceeded.');
      data.set(key, String(value));
    },
    /** @param {string} key */
    removeItem(key) { data.delete(key); },
  };
}

/**
 * The stored text, or null when there is none. Throws if storage is unavailable.
 * @param {string} key
 */
export function read(key) {
  return backend().getItem(key);
}

/**
 * The stored text, or null when there is none or storage is unavailable.
 * @param {string} key
 */
export function readSafely(key) {
  try {
    return backend().getItem(key);
  } catch {
    return null;
  }
}

/**
 * Parsed JSON, or `fallback` when missing, unreadable, or not valid JSON.
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {any}
 */
export function readJson(key, fallback) {
  try {
    const text = backend().getItem(key);
    return text === null ? fallback : JSON.parse(text);
  } catch {
    return fallback;
  }
}

/**
 * Write text. Throws when storage is full or unavailable, so a failed save is
 * reported (map writes use this).
 * @param {string} key
 * @param {string} value
 */
export function write(key, value) {
  backend().setItem(key, value);
}

/**
 * Write text, ignoring failure (preferences use this, as in 2.2.1).
 * @param {string} key
 * @param {string} value
 * @returns {boolean} Whether it was written.
 */
export function writeSafely(key, value) {
  try {
    backend().setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** @param {string} key */
export function remove(key) {
  backend().removeItem(key);
}

// ---- Migrations ---------------------------------------------------------

/**
 * Numbered changes to the stored format. Version 0 is 2.2.x; there are none
 * yet, so nothing is ever written for them. Each future entry is
 * {version, up()} and needs a test that loads the 2.2 fixture.
 * @type {{version: number, up: () => void}[]}
 */
export const MIGRATIONS = [];
export const STORAGE_VERSION_KEY = 'orbit:storage-version';

/**
 * Run the migrations newer than the stored version. With no migrations this
 * reads nothing and writes nothing, so 2.2 data is left exactly as it is.
 * @returns {number[]} The versions applied.
 */
export function migrate() {
  if (!MIGRATIONS.length) return [];
  const current = Number(readSafely(STORAGE_VERSION_KEY) || 0);
  const applied = [];
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    migration.up();
    write(STORAGE_VERSION_KEY, String(migration.version));
    applied.push(migration.version);
  }
  return applied;
}

// ---- Changes from other tabs -------------------------------------------

/**
 * Call `listener` with the key when another tab changes one of Orbit's keys
 * (the browser's `storage` event; `key` is null when storage was cleared).
 * @param {(key: string|null) => void} listener
 * @param {{addEventListener: Function, removeEventListener: Function}} [target] window by default.
 * @returns {() => void} Stops listening.
 */
export function onExternalChange(listener, target = globalThis) {
  /** @param {any} event */
  const handler = event => {
    if (event.key === null || String(event.key).startsWith('orbit:')) listener(event.key);
  };
  target.addEventListener('storage', handler);
  return () => target.removeEventListener('storage', handler);
}
