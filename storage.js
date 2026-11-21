// Preferences, map validation, and saving: since the rewrite these forward to
// src/ through window.OrbitNext (core in phase 2, state in phase 3). Loaded as
// a classic script after rdp.js and before app.js.

// Preferences moved to src/state/prefs.js in rewrite phase 3.
function readBooleanPreference(key, fallback) { return window.OrbitNext.state.prefs.readBoolean(key, fallback); }
function savePreference(key, value) { window.OrbitNext.state.prefs.savePreference(key, value); }
function readThemePreference() { return window.OrbitNext.state.prefs.readTheme(); }
function readFontSizePreference() { return window.OrbitNext.state.prefs.readFontSize(); }
function readGalaxyViewPreference() { return window.OrbitNext.state.prefs.readGalaxyView(); }
function readRdpLaunchPreference() { return window.OrbitNext.state.prefs.readRdpLaunch(); }

// Map validation, destination keys, and placeholders moved to src/core/
// (schema.js, destination.js, templates.js) in rewrite phase 2. These names
// forward to them, looked up when called, until the callers move too.
const PLACEHOLDER = window.OrbitNext.core.PLACEHOLDER;
function validTags(value, label) { return window.OrbitNext.core.validTags(value, label); }
function templateNames(url) { return window.OrbitNext.core.templateNames(url); }
function fillTemplate(url, values) { return window.OrbitNext.core.fillTemplate(url, values); }
function validDestination(value, label) { return window.OrbitNext.core.validDestination(value, label); }
function destinationKey(item) { return window.OrbitNext.core.destinationKey(item); }
function uniqueSunId(name, used) { return window.OrbitNext.core.uniqueSunId(name, used); }
function validateMap(data) { return window.OrbitNext.core.validateMap(data); }
function validRdpPresets(value) { return window.OrbitNext.core.validRdpPresets(value); }
function presetSettings(text, name) { return window.OrbitNext.core.presetSettings(text, name); }
function validRoutines(value) { return window.OrbitNext.core.validRoutines(value); }

// ---- Version history and saving -------------------------------------------
// Moved to src/state/ in rewrite phase 3: history.js keeps the versions, and
// store.js is the only writer of the map. HISTORY_STORAGE_KEY is the active
// workspace's key (set by the store subscriber in app.js).

function loadHistory() { return window.OrbitNext.state.history.loadHistory(HISTORY_STORAGE_KEY); }

// Team suns sit in front of the personal map in `groups` but are never stored.
function personalGroups(list) { return window.OrbitNext.core.personalGroups(list); }

// Save the personal part of a map; see store.saveMap. Throws, with nothing
// changed, when the map is invalid or storage is full.
function saveMap(data, label = 'Change') { window.OrbitNext.store.saveMap(data, label); }

function loadUndoRecord() { return window.OrbitNext.store.loadUndoRecord(); }
