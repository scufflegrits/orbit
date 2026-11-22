// window.OrbitTest: the only way the browser tests reach into the app
// (REWRITE_PLAN.md, "Test hook"). It exists only in the test bundle
// (.artifacts/orbit.test.js); the release bundle leaves this file out entirely.
//
// Since rewrite phase 8 everything it reaches is in src/. A few checks still
// read page names that 2.2.1's classic scripts defined (the drag suite and the
// data-compatibility check); the hook defines those too, read-only, so the
// tests stay unchanged and the release bundle defines nothing.

import { destinationKey } from '../core/destination.js';
import { moveMapItem } from '../core/map-ops.js';
import * as rdp from '../core/rdp.js';
import { validDestination } from '../core/schema.js';
import { captureJson } from '../services/file-io.js';
import * as history from '../state/history.js';
import { KEYS } from '../state/storage.js';
import * as backup from '../state/backup.js';
import * as prefs from '../state/prefs.js';
import { loadWorkspaces, workspaceKey } from '../state/workspaces.js';
import * as page from '../ui/page.js';
import { openEditorAt } from '../ui/editor/page.js';
import { exportMap, showSunList } from '../ui/editor/screens.js';
import { openMenu } from '../ui/menu/menu.js';
import { currentGesture, setEditMode } from '../ui/drag/drag.js';
import { openPalette } from '../ui/find/palette.js';
import { destinationNode, siteIcon } from '../ui/views/nodes.js';
import { render } from '../ui/views/render.js';

const core = { destinationKey, moveMapItem, validDestination };

/** @template T @param {T} value @returns {T} */
const copy = value => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

/**
 * @param {ReturnType<typeof import('../state/store.js').createStore>} store
 * @param {{schedule: typeof import('../services/schedule.js'), modes: ReturnType<typeof import('../ui/mode-store.js').createModeStore>}} parts
 */
export function installTestHook(store, { schedule, modes }) {
  // Page names the checks read as 2.2.1 defined them: the gesture (its
  // pointer id), the display preferences, and the saved-value readers.
  /** @type {Record<string, () => unknown>} */
  const readOnly = {
    drag: currentGesture,
    activeTheme: () => page.activeTheme, activeFontSize: () => page.activeFontSize,
    animationsEnabled: () => page.animationsEnabled, alwaysShowMoons: () => page.alwaysShowMoons,
    rdpLaunchMode: () => page.rdpLaunchMode, showQuickBar: () => page.showQuickBar,
    showSiteIcons: () => page.showSiteIcons, galaxyView: () => page.galaxyView,
  };
  for (const [name, get] of Object.entries(readOnly)) Object.defineProperty(window, name, { get, configurable: true });
  Object.assign(window, {
    setEditMode, openMenu, moveMapItem,
    readBooleanPreference: prefs.readBoolean, readStoredSet: prefs.readStoredSet, loadVariables: prefs.readVariables,
    readOffered: prefs.readOffered, loadRecent: prefs.readRecent, readBackupState: backup.readBackupState, loadWorkspaces,
  });
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
      return copy(captureJson(action));
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
      effectiveRdpProfile: item => rdp.effectiveRdpProfile(item, page.rdpPresets),
      /** @param {any} item */
      rdpLaunchUrl: item => rdp.rdpLaunchUrl(item, page.rdpPresets),
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
