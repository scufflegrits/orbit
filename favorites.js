// Recent links, favorites, and opening a planet with all its moons. Loaded as a
// classic script after team.js. Uses shared state from app.js (groups,
// editMode, rdpLaunchMode) only when called.

const RECENT_STORAGE_KEY = 'orbit:recent:v1';
const RECENT_LIMIT = 10;

// Every path in the map (team suns included) whose destination has this key.
function pathsForKey(key) {
  const paths = [];
  groups.forEach((sun, sunIndex) => sun.links.forEach((planet, planetIndex) => {
    if (destinationKey(planet) === key) paths.push([sunIndex, planetIndex]);
    planet.moons.forEach((moon, moonIndex) => {
      if (destinationKey(moon) === key) paths.push([sunIndex, planetIndex, moonIndex]);
    });
  }));
  return paths;
}

function itemAt(path) {
  const planet = groups[path[0]]?.links[path[1]];
  return path.length === 3 ? planet?.moons[path[2]] : planet;
}

// ---- Recent -------------------------------------------------------------

function loadRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || '[]');
    return Array.isArray(list) ? list.filter(entry => entry && typeof entry.key === 'string') : [];
  } catch {
    return [];
  }
}

function noteOpened(item) {
  if (!item || editMode) return;
  const key = destinationKey(item);
  const list = [{ key, name: item.name, time: Date.now() }, ...loadRecent().filter(entry => entry.key !== key)];
  try { localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list.slice(0, RECENT_LIMIT))); } catch { /* Storage may be unavailable. */ }
  // After the click has opened the link, show it in the Galaxy's quick bar.
  setTimeout(refreshQuickBar, 0);
}

// Replace only the quick bar, so the rest of the Galaxy keeps its state.
function refreshQuickBar() {
  if (!app.classList.contains('home-view')) return;
  const old = app.querySelector(':scope > .quick-bar');
  const next = quickBar();
  const searching = Boolean(quickFind.value.trim());
  if (next) next.hidden = searching;
  if (old && next) old.replaceWith(next);
  else if (old) old.remove();
  else if (next) app.querySelector(':scope > .find-results')?.after(next);
}

function clearRecent() {
  try { localStorage.removeItem(RECENT_STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
}

// Recent links that still exist in the map, newest first.
function recentItems() {
  return loadRecent().flatMap(entry => {
    const path = pathsForKey(entry.key)[0];
    return path ? [{ path, item: itemAt(path) }] : [];
  });
}

// ---- Favorites ----------------------------------------------------------

function isFavorite(item, sun) {
  if (!item) return false;
  if (sun?.team) return readStoredSet(TEAM_FAVORITES_KEY).has(destinationKey(item));
  return item.favorite === true;
}

function favoriteItems() {
  const list = [];
  groups.forEach((sun, sunIndex) => sun.links.forEach((planet, planetIndex) => {
    if (isFavorite(planet, sun)) list.push({ path: [sunIndex, planetIndex], item: planet });
    planet.moons.forEach((moon, moonIndex) => {
      if (isFavorite(moon, sun)) list.push({ path: [sunIndex, planetIndex, moonIndex], item: moon });
    });
  }));
  return list;
}

// Team favorites are a preference (team items cannot be edited); personal ones
// are stored on the item so they move and export with it.
function setFavorite(path, on) {
  const sun = groups[path[0]];
  const item = itemAt(path);
  if (!item) return;
  if (sun.team) {
    const set = readStoredSet(TEAM_FAVORITES_KEY);
    if (on) set.add(destinationKey(item));
    else set.delete(destinationKey(item));
    writeStoredSet(TEAM_FAVORITES_KEY, set);
    render();
    return;
  }
  const next = copyGroups();
  const target = path.length === 3 ? next[path[0]].links[path[1]].moons[path[2]] : next[path[0]].links[path[1]];
  if (on) target.favorite = true;
  else delete target.favorite;
  saveMap({ groups: next }, `${on ? 'Added' : 'Removed'} favorite ${item.name}`);
}

// ---- Opening links ------------------------------------------------------

// Open one destination the way its circle on the map would.
function openDestination(item) {
  if (item.type !== 'rdp' && templateNames(item.url).length) return askForVariables(item);
  if (item.type === 'rdp') {
    if (rdpLaunchMode === 'download') downloadRdp(item);
    else window.location.href = rdpLaunchUrl(item);
  } else {
    const opened = window.open(item.url, '_blank');
    if (opened) opened.opener = null;
  }
  noteOpened(item);
}

// Open a list of links in new tabs. Remote Desktop links are left out: each
// one would need its own download or helper prompt. `confirm` asks first when
// more than one tab would open (`question(count)` words it); `extra` is added
// to the notice.
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

// A planet with all its moons.
function openAll(sunIndex, planetIndex) {
  const planet = groups[sunIndex]?.links[planetIndex];
  if (!planet) return null;
  return openLinks([planet, ...planet.moons], planet.name,
    { question: count => `Open ${count} tabs for ${planet.name} and its moons?` });
}

function openAllFavorites() {
  return openLinks(favoriteItems().map(entry => entry.item), 'your favorites');
}

// Banners (routine offers, backup reminders, team updates) sit above the map.
function noticeArea() {
  let area = document.querySelector('#notice-area');
  if (!area) {
    area = element('section', 'notice-area');
    area.id = 'notice-area';
    area.setAttribute('aria-label', 'Notices');
    document.querySelector('.app-shell').insertBefore(area, app);
  }
  return area;
}

function showOpenAllNotice(message, isError = false) {
  let notice = document.querySelector('#open-all-notice');
  if (!notice) {
    notice = element('p', 'open-all-notice');
    notice.id = 'open-all-notice';
    notice.setAttribute('role', 'status');
    document.body.append(notice);
  }
  notice.textContent = message;
  notice.classList.toggle('open-all-error', isError);
  notice.hidden = false;
  clearTimeout(notice.hideTimer);
  notice.hideTimer = setTimeout(() => { notice.hidden = true; }, isError ? 9000 : 4000);
  return message;
}

// Record links opened from the map, Quick find, and the quick bar. The Edit mode
// guard runs first in the capture phase and stops these clicks.
function trackDestinationClicks(event) {
  if (event.type === 'auxclick' && event.button !== 1) return;
  const node = event.target instanceof Element ? event.target.closest('[data-destination]') : null;
  // A link with placeholders is recorded when its form is submitted instead.
  if (!node || event.defaultPrevented || node.dataset.template) return;
  const path = node.dataset.destination.split(':').map(Number);
  noteOpened(itemAt(path));
}
document.addEventListener('click', trackDestinationClicks);
document.addEventListener('auxclick', trackDestinationClicks);

// Shift+click on a planet opens it with all its moons.
document.addEventListener('click', event => {
  if (!event.shiftKey || editMode || !(event.target instanceof Element)) return;
  const node = event.target.closest('[data-kind="planet"]');
  if (!node || !app.contains(node)) return;
  event.preventDefault();
  event.stopPropagation();
  openAll(Number(node.dataset.sun), Number(node.dataset.planet));
}, true);
