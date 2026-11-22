// FROZEN ORACLE: Orbit 2.2.1's opener, schedule, and team-loading code (the
// parts rewrite phase 4 moves to src/services/), extracted unchanged from tag
// v2.2.1 (file and function names below). Never edit. Loaded in Node vm by
// tests/oracle/oracle.mjs; the page functions they call (window.open,
// window.confirm, showOpenAllNotice, noteOpened, fetch, location) are
// defined by each test with oracle().run().

// ---- render.js: counted

function counted(amount, word, plural = `${word}s`) {
  return `${amount} ${amount === 1 ? word : plural}`;
}

// ---- variables.js: loadVariables

const VARIABLES_KEY = 'orbit:variables:v1';

function loadVariables() {
  try {
    const value = JSON.parse(localStorage.getItem(VARIABLES_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

// ---- favorites.js: openLinks

function openLinks(items, label, { confirm = true, question = null, extra = '' } = {}) {
  // Links with {placeholders} use the values entered last; without one they wait.
  const remembered = loadVariables();
  const filled = item => templateNames(item.url).every(name => remembered[name]);
  const all = items.filter(item => item.type !== 'rdp');
  const web = all.filter(filled).map(item => ({ item, url: fillTemplate(item.url, remembered) }));
  const skipped = items.length - all.length;
  const unfilled = all.length - web.length;
  const note = `${skipped ? ` ${counted(skipped, 'Remote Desktop link')} left out.` : ''}${unfilled ? ` ${counted(unfilled, 'link')} with {placeholders} left out until you open ${unfilled === 1 ? 'it' : 'them'} once.` : ''}${extra}`;
  if (!web.length) return showOpenAllNotice(`${label} has no website links to open.${note}`);
  const ask = question ? question(web.length) : `Open ${web.length} tabs for ${label}?`;
  if (confirm && web.length > 1 && !window.confirm(ask)) return null;
  let blocked = 0;
  for (const { item, url } of web) {
    const opened = window.open(url, '_blank');
    if (opened) {
      opened.opener = null;
      noteOpened(item);
    } else {
      blocked++;
    }
  }
  const message = blocked
    ? `Your browser blocked ${counted(blocked, 'tab')}. Allow pop-ups for Orbit in the browser's address bar, then try again.${note}`
    : `Opened ${counted(web.length, 'tab')} for ${label}.${note}`;
  return showOpenAllNotice(message, blocked > 0);
}

// ---- routines.js: localDay, readOffered, dueRoutines

const ROUTINE_OFFERED_KEY = 'orbit:routine-offered:v1';

function localDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function readOffered() {
  try {
    const value = JSON.parse(localStorage.getItem(ROUTINE_OFFERED_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function dueRoutines(now = new Date()) {
  const offered = readOffered();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return routines.filter(routine => routine.schedule && routine.schedule.days.includes(now.getDay()) &&
    routine.schedule.time <= time && offered[routine.id] !== localDay(now));
}

// ---- workspaces.js: readBackupState, backupDue

const BACKUP_KEY = 'orbit:backup:v1';
const BACKUP_CHANGES = 20;
const BACKUP_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function readBackupState() {
  try {
    const value = JSON.parse(localStorage.getItem(BACKUP_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function backupDue(now = Date.now()) {
  if (!readBooleanPreference('orbit:backup-reminders', true)) return null;
  const entry = readBackupState()[activeWorkspace];
  if (!entry?.changes || (entry.snoozeUntil && now < entry.snoozeUntil)) return null;
  const days = Math.floor((now - (entry.since || now)) / DAY_MS);
  return entry.changes >= BACKUP_CHANGES || days >= BACKUP_DAYS ? { changes: entry.changes, days } : null;
}

// ---- team.js: fetchTeamData, loadTeamMap

var teamGroups = [];
var teamSource = '';
var teamError = '';

async function fetchTeamData() {
  if (location.protocol !== 'file:') {
    try {
      const response = await fetch('./team.json', { cache: 'no-store' });
      if (response.ok) return { data: await response.json(), source: 'team.json from serve.py --team' };
      if (response.status !== 404) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (!window.ORBIT_TEAM_DATA) throw error;
    }
  }
  return window.ORBIT_TEAM_DATA ? { data: window.ORBIT_TEAM_DATA, source: 'team-data.js' } : null;
}

async function loadTeamMap() {
  teamGroups = [];
  teamSource = '';
  teamError = '';
  try {
    const loaded = await fetchTeamData();
    if (!loaded) return;
    // Team ids are prefixed so they can never collide with personal sun ids.
    teamGroups = validateMap(loaded.data).groups.map(sun => ({ ...sun, id: `team:${sun.id}`, team: true }));
    teamSource = loaded.source;
  } catch (error) {
    teamError = `The team map could not be loaded: ${error.message}`;
  }
}
