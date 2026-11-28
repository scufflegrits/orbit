// The store: Orbit's map and the state around it, and the only writer of the
// map key (REWRITE_PLAN.md, "One writer of the map" and "How a change flows").
// Every rule and order here is 2.2.1's (storage.js saveMap, app.js init and
// undoRemoval, editor.js applyEditorChange and resetMap, team.js
// setTeamSunHidden, workspaces.js), including its quirks, which the comments
// name.
//
// Nothing is read at import time: createStore() makes an empty store, and
// start() loads it.
import { isGroup } from '../core/destination.js';
import { validateMap } from '../core/schema.js';
import { personalGroups, uniqueSunId } from '../core/map-ops.js';
import { KEYS, migrate, read, readSafely, remove, write } from './storage.js';
import { MAIN, UNREADABLE, WORKSPACE_KEYS, defaultWorkspace, loadStoredWorkspaces, loadWorkspaces, markDefaultRemoved, newWorkspace, readActiveWorkspace, restoreDefault, saveActiveWorkspace, saveWorkspaces, setDefaultWorkspaces, workspaceKey } from './workspaces.js';
import { forgetOffered, hiddenTeamSuns, writeStoredSet } from './prefs.js';
import { recordHistory } from './history.js';
import { countChange, forgetWorkspace } from './backup.js';

/** @typedef {import('../core/types.js').Sun} Sun */
/** @typedef {import('../core/types.js').MapData} MapData */
/** @typedef {import('../core/types.js').Routine} Routine */
/** @typedef {import('../core/types.js').RdpPreset} RdpPreset */

/**
 * What the store holds. `groups` is the combined map: visible team suns first,
 * then the personal ones, numbered together as on the page.
 * @typedef {object} StoreState
 * @property {Sun[]} groups
 * @property {Routine[]} routines
 * @property {RdpPreset[]} rdpPresets
 * @property {number} revision Goes up by one on every save, reset, hide, and workspace switch.
 * @property {string} workspace
 * @property {'bundled'|'browser'} source Where the shown map came from.
 * @property {string} warning Why a saved map couldn't be loaded, or ''.
 * @property {MapData|null} seed The project's link data, validated.
 * @property {Sun[]} team Every team sun, hidden ones included.
 */

/** @typedef {'start'|'save'|'reset'|'team'|'switch'} ChangeKind */
/** @typedef {(state: Readonly<StoreState>, kind: ChangeKind) => void} Subscriber */

/**
 * @typedef {object} SaveOptions
 * @property {object} [undoRecord] Written to the workspace's undo key first; put back if the save fails.
 * @property {boolean} [clearUndo] Remove the undo record after saving.
 * @property {boolean} [invalidateUndo] Invalidate removal Undo in the committed map.
 * @property {number} [expectRevision] Refuse the save if the revision is not this one.
 */

/** @typedef {{kind: 'sun'|'planet'|'moon', index: number, item: any, label: string, sunId?: string, planetId?: string, generation?: string}} UndoRecord */

const newUndoGeneration = () => Array.from(crypto.getRandomValues(new Uint8Array(16)),
  byte => byte.toString(16).padStart(2, '0')).join('');

export function createStore() {
  /** @type {StoreState} */
  let state = {
    groups: [], routines: [], rdpPresets: [], revision: 0, workspace: MAIN, source: 'bundled', warning: '', seed: null, team: [],
  };
  /** @type {{id: string, name: string, map: MapData}[]} */
  let defaults = [];
  /** @type {string|null|undefined} */
  let loadedMap;
  let hasSavedMap = false;
  /** @type {string|undefined} */
  let undoGeneration;
  /** @type {Set<Subscriber>} */
  const subscribers = new Set();

  /** @param {Partial<StoreState>} changes */
  const set = changes => { state = Object.freeze({ ...state, ...changes }); };
  /** @param {ChangeKind} kind */
  const notify = kind => { for (const subscriber of [...subscribers]) subscriber(state, kind); };
  /** @param {string} base */
  const key = base => workspaceKey(base, state.workspace);
  const visibleTeam = () => {
    const hidden = hiddenTeamSuns();
    return state.team.filter(sun => !hidden.has(sun.id));
  };

  /**
   * The workspace's saved map, or null when there is none or it can't be
   * used; then `warning` says why.
   * @returns {MapData|null}
   */
  function loadBrowserMap() {
    loadedMap = undefined;
    hasSavedMap = false;
    undoGeneration = undefined;
    try {
      loadedMap = read(key(KEYS.map));
      if (loadedMap === null) return null;
      const data = JSON.parse(loadedMap);
      const map = validateMap(data, { keepPlanetIds: true });
      undoGeneration = typeof data.undoGeneration === 'string' ? data.undoGeneration : undefined;
      hasSavedMap = true;
      return map;
    } catch (error) {
      set({ warning: `Saved browser data could not be loaded: ${/** @type {Error} */ (error).message}` });
      return null;
    }
  }

  function requireCurrentMap() {
    if (loadedMap === undefined || read(key(KEYS.map)) !== loadedMap ||
        !loadWorkspaces().some(workspace => workspace.id === state.workspace)) {
      throw new Error('The saved link map changed or could not be read. Reload Orbit and try again.');
    }
  }

  /**
   * Preserve the exact stored text before a save or reset replaces an unreadable map.
   * @param {string} mapKey
   */
  function backupUnreadableMap(mapKey) {
    const text = read(mapKey);
    if (text === null) return;
    try {
      validateMap(JSON.parse(text));
    } catch {
      // Older versions could give a workspace the id "unreadable".
      const suffix = mapKey === KEYS.map && loadWorkspaces().some(item => item.id === UNREADABLE)
        ? `:${UNREADABLE}` : UNREADABLE;
      write(`${mapKey}:${suffix}`, text);
    }
  }

  /** @param {string} mapKey @param {MapData} map @param {string} [generation] */
  function writeMap(mapKey, map, generation) {
    const text = JSON.stringify(generation === undefined ? map : { ...map, undoGeneration: generation });
    backupUnreadableMap(mapKey);
    if (map.groups.some(sun => sun.links.some(isGroup))) migrate();
    write(mapKey, text);
    return text;
  }

  const store = {
    /** @returns {Readonly<StoreState>} */
    state: () => state,

    /**
     * @param {Subscriber} subscriber
     * @returns {() => void} Unsubscribes.
     */
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => { subscribers.delete(subscriber); };
    },

    /**
     * Load the active workspace at start-up. `seed` is the validated project
     * data; `team` the team suns (ids with `team:`, `team: true`).
     * @param {{seed: MapData, team?: Sun[], defaults?: {id: string, name: string, map: MapData}[]}} input
     */
    start({ seed, team = [], defaults: bundledDefaults = [] }) {
      defaults = bundledDefaults;
      setDefaultWorkspaces(defaults);
      set({ seed, team, workspace: readActiveWorkspace(), warning: '' });
      const browserMap = loadBrowserMap();
      const defaultMap = defaults.find(item => item.id === state.workspace)?.map;
      const map = browserMap || (state.workspace === MAIN ? seed : defaultMap || { groups: [] });
      // 2.2.1 quirk kept: at start-up a workspace with no saved map reports
      // 'bundled' even outside Main (switching reports 'browser').
      set({ groups: [...visibleTeam(), ...map.groups], routines: map.routines || [], rdpPresets: map.rdpPresets || [],
        source: browserMap ? 'browser' : 'bundled' });
      notify('start');
    },

    /**
     * Save a map (team suns may be included; they're never stored or changed).
     * Routines and presets are kept unless `data` replaces them. The previous
     * version goes into history under `label` unless it's false or nothing
     * changed. Throws, with nothing changed, if the map is invalid or can't be
     * written.
     * @param {{groups: Sun[], routines?: Routine[], rdpPresets?: RdpPreset[]}} data
     * @param {string|false} [label]
     * @param {SaveOptions} [options]
     */
    saveMap(data, label = 'Change', options = {}) {
      if (options.expectRevision !== undefined && options.expectRevision !== state.revision) {
        throw new Error('The link map changed, so nothing was saved.');
      }
      requireCurrentMap();
      const normalized = validateMap({ groups: personalGroups(data.groups),
        routines: data.routines !== undefined ? data.routines : state.routines,
        rdpPresets: data.rdpPresets !== undefined ? data.rdpPresets : state.rdpPresets }, { keepPlanetIds: true });
      const previous = personalGroups(state.groups);
      const changed = JSON.stringify([previous, state.routines, state.rdpPresets]) !==
        JSON.stringify([normalized.groups, normalized.routines || [], normalized.rdpPresets || []]);
      const undoKey = key(KEYS.undo);
      const generation = options.invalidateUndo || (!hasSavedMap && read(undoKey) !== null)
        ? newUndoGeneration() : undoGeneration;
      /** @type {string|null|undefined} */
      let previousUndo;
      try {
        if (options.undoRecord) {
          previousUndo = read(undoKey);
          write(undoKey, JSON.stringify({ ...options.undoRecord, generation }));
        }
        loadedMap = writeMap(key(KEYS.map), normalized, generation);
      } catch (error) {
        if (options.undoRecord) {
          try {
            if (previousUndo === null) remove(undoKey);
            else if (previousUndo !== undefined) write(undoKey, previousUndo);
          } catch { /* Keep the original error. */ }
        }
        throw error;
      }
      hasSavedMap = true;
      undoGeneration = generation;
      if (label !== false && changed) recordHistory(key(KEYS.history), previous, label, state.routines, state.rdpPresets);
      if (changed) countChange(state.workspace);
      set({ groups: [...visibleTeam(), ...normalized.groups], routines: normalized.routines || [],
        rdpPresets: normalized.rdpPresets || [], revision: state.revision + 1, source: 'browser' });
      if (options.clearUndo || options.invalidateUndo) {
        try { remove(undoKey); } catch { /* The map and its undo generation have been committed. */ }
      }
      notify('save');
    },

    /** Forget the load warning (after a successful edit, as 2.2.1's editor does). */
    clearWarning() {
      set({ warning: '' });
    },

    /**
     * Replace the map with the project's link data. In Main the saved map is
     * removed, so Main follows the project files again; elsewhere the file data
     * is saved under the workspace's key (2.2.1, check F27). History keeps the
     * map as it was; the removal undo is cleared.
     */
    resetToBundled() {
      requireCurrentMap();
      const isDefault = Boolean(defaultWorkspace(state.workspace));
      const fileData = validateMap(isDefault ? defaults.find(item => item.id === state.workspace)?.map : state.seed);
      if (state.workspace === MAIN || isDefault) {
        backupUnreadableMap(key(KEYS.map));
        remove(key(KEYS.map));
        loadedMap = null;
        hasSavedMap = false;
        undoGeneration = undefined;
      } else {
        const generation = newUndoGeneration();
        loadedMap = writeMap(key(KEYS.map), fileData, generation);
        undoGeneration = generation;
        hasSavedMap = true;
      }
      recordHistory(key(KEYS.history), personalGroups(state.groups), 'Reset to file data', state.routines, state.rdpPresets);
      try { remove(key(KEYS.undo)); } catch { /* The reset is saved; keep the displayed map in sync. */ }
      set({ groups: [...visibleTeam(), ...fileData.groups], routines: fileData.routines || [], rdpPresets: fileData.rdpPresets || [],
        revision: state.revision + 1, source: state.workspace === MAIN || isDefault ? 'bundled' : 'browser', warning: '' });
      notify('reset');
    },

    /** The workspace's last removal, if it can be undone. @returns {UndoRecord|null} */
    loadUndoRecord() {
      if (!hasSavedMap) return null;
      try {
        const saved = readSafely(key(KEYS.undo));
        if (!saved) return null;
        const record = JSON.parse(saved);
        return record && record.generation === undoGeneration && ['sun', 'planet', 'moon'].includes(record.kind) &&
          Number.isInteger(record.index) && record.index >= 0 && record.item ? record : null;
      } catch {
        return null;
      }
    },

    /**
     * Put the last removed sun, planet, or moon back. Returns false when there
     * is nothing to undo; throws when it can't be put back.
     */
    undoRemoval() {
      requireCurrentMap();
      const record = store.loadUndoRecord();
      if (!record) return false;
      /** @type {Sun[]} */
      const next = JSON.parse(JSON.stringify(state.groups));
      // 2.2.1 inserts into the combined map, so a sun's index counts team suns.
      if (record.kind === 'sun') {
        if (next.some(sun => sun.id === record.item.id)) {
          record.item.id = uniqueSunId(record.item.name, new Set(next.map(sun => sun.id)));
        }
        next.splice(Math.min(record.index, next.length), 0, record.item);
      } else if (record.kind === 'planet') {
        const sun = next.find(item => item.id === record.sunId);
        if (!sun) throw new Error('The parent sun no longer exists.');
        sun.links.splice(Math.min(record.index, sun.links.length), 0, record.item);
      } else {
        if (!record.planetId) throw new Error('This older removal record cannot identify the parent planet.');
        const matches = personalGroups(next).flatMap(sun => sun.links.filter(planet => planet.planetId === record.planetId));
        if (matches.length !== 1) throw new Error('The original parent planet could not be identified.');
        const [planet] = matches;
        planet.moons.splice(Math.min(record.index, planet.moons.length), 0, record.item);
      }
      store.saveMap({ groups: next }, `Undid removal of ${record.label}`, { clearUndo: true });
      return true;
    },

    /**
     * Hide or show a team sun. Stored as a shared preference; the revision goes up.
     * @param {string} id With its `team:` prefix.
     * @param {boolean} hidden
     */
    setTeamSunHidden(id, hidden) {
      const ids = hiddenTeamSuns();
      if (hidden) ids.add(id);
      else ids.delete(id);
      writeStoredSet(KEYS.teamHidden, ids);
      set({ groups: [...visibleTeam(), ...personalGroups(state.groups)], revision: state.revision + 1 });
      notify('team');
    },

    /**
     * Open another workspace. Returns false if it doesn't exist. Never touches
     * another workspace's keys.
     * @param {string} id
     */
    switchWorkspace(id) {
      if (!loadWorkspaces().some(item => item.id === id)) return false;
      set({ workspace: id, warning: '' });
      saveActiveWorkspace(id);
      const browserMap = loadBrowserMap();
      const defaultMap = defaults.find(item => item.id === id)?.map;
      const map = browserMap || (id === MAIN ? state.seed || { groups: [] } : defaultMap || { groups: [] });
      set({ groups: [...visibleTeam(), ...map.groups], routines: map.routines || [], rdpPresets: map.rdpPresets || [],
        source: browserMap ? 'browser' : id === MAIN || defaultMap ? 'bundled' : 'browser', revision: state.revision + 1 });
      notify('switch');
      return true;
    },

    /**
     * Add a workspace and save its first map: 'empty', 'copy' (of this
     * workspace), or 'bundled'. Doesn't switch to it. Returns its id.
     * @param {unknown} name
     * @param {'empty'|'copy'|'bundled'|string} start
     */
    addWorkspace(name, start) {
      if (typeof start === 'string' && start.startsWith('default:')) {
        const id = start.slice('default:'.length);
        const bundled = defaults.find(item => item.id === id);
        if (!bundled) throw new Error('That default workspace is unavailable.');
        restoreDefault(id);
        const raw = loadStoredWorkspaces().filter(item => item.id !== id);
        if (String(name).trim() !== bundled.name) raw.push({ id, name: String(name).trim() });
        saveWorkspaces(raw);
        return id;
      }
      const added = newWorkspace(name);
      const map = start === 'copy'
        ? { groups: personalGroups(state.groups), routines: state.routines, rdpPresets: state.rdpPresets }
        : start === 'bundled' ? state.seed : { groups: [] };
      writeMap(workspaceKey(KEYS.map, added.id), validateMap(map));
      saveWorkspaces([...loadStoredWorkspaces(), added]);
      return added.id;
    },

    /**
     * Remove a workspace (never Main): its map, undo, and history keys, its
     * backup entry, and its routine offer marks. Returns true if it was the open one; the caller then
     * switches to Main.
     * @param {string} id
     */
    removeWorkspace(id) {
      if (id === MAIN) return false;
      for (const base of WORKSPACE_KEYS) remove(workspaceKey(base, id));
      forgetWorkspace(id);
      forgetOffered(id);
      if (defaultWorkspace(id)) markDefaultRemoved(id);
      saveWorkspaces(loadStoredWorkspaces().filter(item => item.id !== id));
      return state.workspace === id;
    },

    /**
     * Where a combined index points: a team sun or a personal one.
     * @param {number} index
     * @returns {{team: boolean, index: number}}
     */
    locate(index) {
      const teamCount = state.groups.filter(sun => sun.team).length;
      return index < teamCount ? { team: true, index } : { team: false, index: index - teamCount };
    },

    /**
     * The combined index of a team or personal sun.
     * @param {{team: boolean, index: number}} place
     */
    combinedIndex(place) {
      return place.team ? place.index : place.index + state.groups.filter(sun => sun.team).length;
    },
  };
  return store;
}
