// window.OrbitTest: the only way the browser tests reach into the app
// (REWRITE_PLAN.md, "Test hook"). It exists only in the test bundle
// (orbit.test.js); the release bundle leaves this file out entirely.
//
// In phase 1 it reads and drives the old classic scripts' globals, which it
// looks up when called (orbit.js loads before those scripts). As code moves
// into src/, each function here switches to the new module and the tests stay
// unchanged.

import { destinationKey } from '../core/destination.js';
import { moveMapItem } from '../core/map-ops.js';
import { validDestination } from '../core/schema.js';
import * as history from '../state/history.js';
import { KEYS } from '../state/storage.js';
import { workspaceKey } from '../state/workspaces.js';

const core = { destinationKey, moveMapItem, validDestination };

/** @template T @param {T} value @returns {T} */
const copy = value => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

/**
 * @param {ReturnType<typeof import('../state/store.js').createStore>} store
 * @param {{schedule: typeof import('../services/schedule.js'), modes: ReturnType<typeof import('../ui/mode-store.js').createModeStore>}} parts
 */
export function installTestHook(store, { schedule, modes }) {
  window.OrbitTest = {
    /** The combined map (team suns first, as the page numbers them) and the state around it. */
    state() {
      const state = store.state();
      return {
        groups: copy(state.groups),
        routines: copy(state.routines),
        rdpPresets: copy(state.rdpPresets),
        revision: state.revision,
        workspace: state.workspace,
        source: state.source,
        warning: state.warning,
        editMode: modes.inEditMode(),
        drag: modes.holding() ? modes.state().mode : null,
        modes: { ...modes.state() },
      };
    },

    /** The active workspace's saved versions, newest first. */
    history() {
      return copy(history.loadHistory(workspaceKey(KEYS.history, store.state().workspace)));
    },

    /** The active workspace's removal undo record, or null. */
    undoRecord() {
      return copy(store.loadUndoRecord());
    },

    /** A copy of the combined map: the same as state().groups. */
    groups() {
      return copy(store.state().groups);
    },

    /**
     * Save a combined map (team suns may be included; they're never stored).
     * @param {any[]} nextGroups
     * @param {{routines?: any[], rdpPresets?: any[], label?: string|false}} [options]
     */
    saveMap(nextGroups, options = {}) {
      /** @type {{groups: any[], routines?: any[], rdpPresets?: any[]}} */
      const data = { groups: nextGroups };
      if (options.routines !== undefined) data.routines = options.routines;
      if (options.rdpPresets !== undefined) data.rdpPresets = options.rdpPresets;
      store.saveMap(data, options.label === undefined ? 'Test' : options.label);
    },

    /**
     * Run `action` and return what it would have downloaded as JSON, instead of a file.
     * @param {() => void} action
     */
    captureDownload(action) {
      let data;
      const original = downloadJson;
      downloadJson = value => { data = value; };
      try {
        action();
      } finally {
        downloadJson = original;
      }
      return copy(data);
    },

    /** App actions the tests drive directly. */
    actions: {
      exportMap: () => exportMap(),
      showSunList: () => showSunList(),
      /** @param {number[]} path */
      openEditorAt: path => openEditorAt(path),
      /** @param {boolean} on */
      setEditMode: on => setEditMode(on),
      openMenu: () => openMenu(),
      openPalette: () => openPalette(),
      render: () => render(),
    },

    /** Pure functions the tests call. */
    helpers: {
      /** @param {any[]} list @param {any} source @param {any} target */
      moveMapItem: (list, source, target) => core.moveMapItem(list, source, target),
      /** @param {any} value @param {string} label */
      validDestination: (value, label) => core.validDestination(value, label),
      /** @param {any} item */
      destinationKey: item => core.destinationKey(item),
      /** @param {any} item */
      effectiveRdpProfile: item => effectiveRdpProfile(item),
      /** @param {any} item */
      rdpLaunchUrl: item => rdpLaunchUrl(item),
      /** @param {any} item */
      siteIcon: item => siteIcon(item),
      /** @param {any} item @param {string} className @param {number[]} [path] */
      destinationNode: (item, className, path) => destinationNode(item, className, path),
    },

    /**
     * Fix the clock routine offers and backup reminders read, or pass null for
     * the real time again.
     * @param {number|null} ms
     */
    setNow(ms) {
      schedule.setNow(ms);
    },

    /** Clear Orbit's saved data and reload (file:// pages share one localStorage). */
    reset() {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('orbit:')) localStorage.removeItem(key);
      }
      location.reload();
    },
  };
}
