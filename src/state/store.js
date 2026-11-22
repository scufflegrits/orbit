// The store: Orbit's map and the state around it, and the only writer of the
// map key (REWRITE_PLAN.md, "One writer of the map" and "How a change flows").
// Every rule and order here is 2.2.1's (storage.js saveMap, app.js init and
// undoRemoval, editor.js applyEditorChange and resetMap, team.js
// setTeamSunHidden, workspaces.js), including its quirks, which the comments
// name.
//
// Nothing is read at import time: createStore() makes an empty store, and
// start() loads it.
import { validateMap } from '../core/schema.js';
import { personalGroups, uniqueSunId } from '../core/map-ops.js';
import { KEYS, read, readSafely, remove, write } from './storage.js';
import { MAIN, WORKSPACE_KEYS, loadWorkspaces, newWorkspace, readActiveWorkspace, saveActiveWorkspace, saveWorkspaces, workspaceKey } from './workspaces.js';
import { hiddenTeamSuns, writeStoredSet } from './prefs.js';
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
 * @property {number} [expectRevision] Refuse the save if the revision is not this one.
 */

/** @typedef {{kind: 'sun'|'planet'|'moon', index: number, item: any, label: string, sunId?: string, planetUrl?: string, planetHost?: string, planetName?: string, planetIndex?: number}} UndoRecord */

export function createStore() {
  /** @type {StoreState} */
  let state = {
    groups: [], routines: [], rdpPresets: [], revision: 0, workspace: MAIN, source: 'bundled', warning: '', seed: null, team: [],
  };
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
   * used; then `warning` says why. (2.2.1: the stored map is overwritten by
   * the next save.)
   * @returns {MapData|null}
   */
  function loadBrowserMap() {
    try {
      const text = read(key(KEYS.map));
      return text ? validateMap(JSON.parse(text)) : null;
    } catch (error) {
      set({ warning: `Saved browser data could not be loaded: ${/** @type {Error} */ (error).message}` });
      return null;
    }
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
     * @param {{seed: MapData, team?: Sun[]}} input
     */
    start({ seed, team = [] }) {
      set({ seed, team, workspace: readActiveWorkspace(), warning: '' });
      const browserMap = loadBrowserMap();
      const map = browserMap || (state.workspace === MAIN ? seed : { groups: [] });
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
      const undoKey = key(KEYS.undo);
      /** @type {string|null|undefined} */
      let previousUndo;
      try {
        if (options.undoRecord) {
          previousUndo = read(undoKey);
          write(undoKey, JSON.stringify(options.undoRecord));
        }
        const normalized = validateMap({ groups: personalGroups(data.groups),
          routines: data.routines !== undefined ? data.routines : state.routines,
          rdpPresets: data.rdpPresets !== undefined ? data.rdpPresets : state.rdpPresets });
        const previous = personalGroups(state.groups);
        write(key(KEYS.map), JSON.stringify(normalized));
        const changed = JSON.stringify([previous, state.routines, state.rdpPresets]) !==
          JSON.stringify([normalized.groups, normalized.routines || [], normalized.rdpPresets || []]);
        if (label !== false && changed) recordHistory(key(KEYS.history), previous, label, state.routines, state.rdpPresets);
        if (changed) countChange(state.workspace);
        set({ groups: [...visibleTeam(), ...normalized.groups], routines: normalized.routines || [],
          rdpPresets: normalized.rdpPresets || [], revision: state.revision + 1, source: 'browser' });
      } catch (error) {
        if (options.undoRecord) {
          try {
            if (previousUndo === null) remove(undoKey);
            else if (previousUndo !== undefined) write(undoKey, previousUndo);
          } catch { /* Keep the original error. */ }
        }
        throw error;
      }
      if (options.clearUndo) {
        try { remove(undoKey); } catch { /* The map is saved; a stale undo record is harmless. */ }
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
      const fileData = validateMap(state.seed);
      recordHistory(key(KEYS.history), personalGroups(state.groups), 'Reset to file data', state.routines, state.rdpPresets);
      if (state.workspace === MAIN) remove(key(KEYS.map));
      else write(key(KEYS.map), JSON.stringify(fileData));
      remove(key(KEYS.undo));
      set({ groups: [...visibleTeam(), ...fileData.groups], routines: fileData.routines || [], rdpPresets: fileData.rdpPresets || [],
        revision: state.revision + 1, source: state.workspace === MAIN ? 'bundled' : 'browser', warning: '' });
      notify('reset');
    },

    /** The workspace's last removal, if it can be undone. @returns {UndoRecord|null} */
    loadUndoRecord() {
      try {
        const saved = readSafely(key(KEYS.undo));
        if (!saved) return null;
        const record = JSON.parse(saved);
        return record && ['sun', 'planet', 'moon'].includes(record.kind) &&
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
      } else {
        const sun = next.find(item => item.id === record.sunId);
        if (!sun) throw new Error('The parent sun no longer exists.');
        if (record.kind === 'planet') {
          sun.links.splice(Math.min(record.index, sun.links.length), 0, record.item);
        } else {
          const matching = sun.links.find(planet => /** @type {any} */ (planet).url === record.planetUrl &&
            /** @type {any} */ (planet).host === record.planetHost && planet.name === record.planetName);
          const planet = matching || sun.links[/** @type {number} */ (record.planetIndex)];
          if (!planet) throw new Error('The parent planet no longer exists.');
          planet.moons.splice(Math.min(record.index, planet.moons.length), 0, record.item);
        }
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
      const map = browserMap || (id === MAIN ? state.seed || { groups: [] } : { groups: [] });
      set({ groups: [...visibleTeam(), ...map.groups], routines: map.routines || [], rdpPresets: map.rdpPresets || [],
        source: browserMap ? 'browser' : id === MAIN ? 'bundled' : 'browser', revision: state.revision + 1 });
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
      const added = newWorkspace(name);
      const map = start === 'copy'
        ? { groups: personalGroups(state.groups), routines: state.routines, rdpPresets: state.rdpPresets }
        : start === 'bundled' ? state.seed : { groups: [] };
      write(workspaceKey(KEYS.map, added.id), JSON.stringify(validateMap(map)));
      saveWorkspaces([...loadWorkspaces(), added]);
      return added.id;
    },

    /**
     * Remove a workspace (never Main): its map, undo, and history keys, and its
     * backup entry. Returns true if it was the open one; the caller then
     * switches to Main.
     * @param {string} id
     */
    removeWorkspace(id) {
      if (id === MAIN) return false;
      for (const base of WORKSPACE_KEYS) remove(workspaceKey(base, id));
      forgetWorkspace(id);
      saveWorkspaces(loadWorkspaces().filter(item => item.id !== id));
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
