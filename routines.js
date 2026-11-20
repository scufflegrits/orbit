// Routines: named lists of links opened together, such as a morning set, with
// an optional schedule that offers them when Orbit opens. Loaded as a classic
// script after tools.js. Routines are saved with the map (`routines` beside
// `groups`); links are remembered by destination key.

const ROUTINE_OFFERED_KEY = 'orbit:routine-offered:v1';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS = [1, 2, 3, 4, 5];

// The routine's links that are still on the map, in its order.
function routineItems(routine) {
  const items = [];
  let missing = 0;
  for (const link of routine.links) {
    const path = pathsForKey(link.key)[0];
    if (path) items.push({ path, item: itemAt(path) });
    else missing++;
  }
  return { items, missing };
}

function runRoutine(routine) {
  const { items, missing } = routineItems(routine);
  const extra = missing ? ` ${counted(missing, 'link')} in this routine ${missing === 1 ? 'is' : 'are'} no longer on the map.` : '';
  if (!items.length) return showOpenAllNotice(`${routine.name} has no links on the map.${extra}`, true);
  // Choosing a routine by name already says what will open.
  return openLinks(items.map(entry => entry.item), routine.name, { confirm: false, extra });
}

// Add incoming routines whose names are new (ignoring case).
function mergeRoutines(current, incoming) {
  const names = new Set(current.map(routine => routine.name.toLocaleLowerCase()));
  const used = new Set(current.map(routine => routine.id));
  const next = [...current];
  for (const routine of incoming) {
    if (names.has(routine.name.toLocaleLowerCase())) continue;
    names.add(routine.name.toLocaleLowerCase());
    const copy = JSON.parse(JSON.stringify(routine));
    if (used.has(copy.id)) copy.id = uniqueSunId(copy.name, used);
    used.add(copy.id);
    next.push(copy);
  }
  return next;
}

// ---- Arrival offer ------------------------------------------------------

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

function markOffered(id) {
  const offered = readOffered();
  offered[id] = localDay(new Date());
  try { localStorage.setItem(ROUTINE_OFFERED_KEY, JSON.stringify(offered)); } catch { /* Storage may be unavailable. */ }
}

// Scheduled routines that are due today and not yet opened or dismissed.
function dueRoutines(now = new Date()) {
  const offered = readOffered();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return routines.filter(routine => routine.schedule && routine.schedule.days.includes(now.getDay()) &&
    routine.schedule.time <= time && offered[routine.id] !== localDay(now));
}

// Browsers only open tabs after a click, so a due routine is offered, never
// opened by itself.
function offerDueRoutines() {
  document.querySelector('#routine-banner')?.remove();
  if (editMode) return;
  const due = dueRoutines();
  if (!due.length) return;
  const banner = element('section', 'routine-banner');
  banner.id = 'routine-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Routines ready to open');
  for (const routine of due) {
    const { items } = routineItems(routine);
    const row = element('div', 'routine-offer');
    row.append(element('p', 'routine-offer-copy', `Time for ${routine.name}: ${counted(items.length, 'link')}.`));
    const open = element('button', 'routine-offer-open', `Open ${routine.name}`);
    open.type = 'button';
    open.addEventListener('click', () => {
      markOffered(routine.id);
      row.remove();
      if (!banner.querySelector('.routine-offer')) banner.remove();
      runRoutine(routine);
    });
    const later = element('button', 'routine-offer-dismiss', 'Not today');
    later.type = 'button';
    later.addEventListener('click', () => {
      markOffered(routine.id);
      row.remove();
      if (!banner.querySelector('.routine-offer')) banner.remove();
    });
    row.append(open, later);
    banner.append(row);
  }
  noticeArea().prepend(banner);
}

// A page left open overnight offers the routine when it is looked at again.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && groups.length) offerDueRoutines();
});

// ---- Edit links screens ---------------------------------------------------

function scheduleText(schedule) {
  if (!schedule) return 'No schedule';
  const days = schedule.days.join(',') === WEEKDAYS.join(',') ? 'weekdays'
    : schedule.days.length === 7 ? 'every day' : schedule.days.map(day => DAY_NAMES[day]).join(', ');
  return `Offered at ${schedule.time}, ${days}`;
}

function showRoutines() {
  editorHeader('Routines', showSunList);
  menuContent.append(element('p', '', 'A routine opens a set of links together, such as the sites you start every morning with. It can also offer itself when Orbit opens at a set time, which works well with Orbit as your browser’s startup page.'));
  if (!routines.length) menuContent.append(element('p', 'editor-note', 'No routines yet.'));
  const list = element('div', 'editor-list');
  routines.forEach((routine, index) => {
    const { items, missing } = routineItems(routine);
    const row = element('div', 'editor-list-row routine-row');
    const copy = element('span', 'history-copy');
    copy.append(element('strong', '', routine.name));
    copy.append(element('small', '', `${counted(items.length, 'link')}${missing ? ` (${missing} no longer on the map)` : ''} · ${scheduleText(routine.schedule)}`));
    row.append(copy);
    row.append(editorButton('Open', () => runRoutine(routine)));
    row.append(editorButton('Share', () => shareRoutine(routine)));
    row.append(editorButton('Edit', () => showRoutineEditor(index)));
    list.append(row);
  });
  menuContent.append(list);
  editorActions().append(editorButton('New routine', () => showRoutineEditor(null), 'editor-primary'));
}

function routineCheckbox(item, label, key, checked) {
  const row = element('label', 'editor-check routine-choice');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.value = key;
  box.checked = checked;
  box.dataset.name = item.name;
  row.append(box, element('span', '', label));
  row.dataset.search = label.toLocaleLowerCase();
  return row;
}

function showRoutineEditor(index) {
  const isNew = index === null;
  const routine = isNew ? { name: '', links: [], schedule: null } : routines[index];
  editorHeader(isNew ? 'New routine' : `Edit ${routine.name}`, showRoutines);
  const form = element('form', 'editor-form');
  const name = editorField('Routine name', routine.name);
  name.input.setAttribute('aria-label', 'Routine name');
  name.input.placeholder = 'For example: Morning';
  form.append(name.wrapper);
  // Schedule.
  const offer = element('label', 'editor-check');
  const offerBox = document.createElement('input');
  offerBox.type = 'checkbox';
  offerBox.checked = Boolean(routine.schedule);
  offerBox.setAttribute('aria-label', 'Offer this routine when Orbit opens');
  offer.append(offerBox, element('span', '', 'Offer this routine when Orbit opens'));
  const schedule = element('div', 'routine-schedule');
  const time = editorField('From', routine.schedule?.time || '08:00', 'time');
  time.input.setAttribute('aria-label', 'Offer from');
  const days = element('div', 'routine-days');
  days.setAttribute('role', 'group');
  days.setAttribute('aria-label', 'Days');
  const dayBoxes = DAY_NAMES.map((label, day) => {
    const option = element('label', 'editor-check routine-day');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = (routine.schedule?.days || WEEKDAYS).includes(day);
    box.setAttribute('aria-label', label);
    option.append(box, element('span', '', label));
    days.append(option);
    return box;
  });
  schedule.append(time.wrapper, days, element('small', 'editor-hint', 'Browsers open tabs only after a click, so Orbit asks with an Open button instead of opening them by itself. It asks once a day.'));
  const updateSchedule = () => { schedule.hidden = !offerBox.checked; };
  offerBox.addEventListener('change', updateSchedule);
  updateSchedule();
  form.append(offer, schedule);
  // Links.
  form.append(element('h4', 'editor-section-title', 'Links'));
  const chosen = new Set(routine.links.map(link => link.key));
  const summary = element('p', 'data-source routine-summary');
  const filter = editorField('Filter', '');
  filter.input.setAttribute('aria-label', 'Filter links');
  filter.input.placeholder = 'Type to narrow the list';
  const choices = element('div', 'routine-choices');
  const seen = new Set();
  groups.forEach(sun => {
    const block = element('fieldset', 'routine-sun');
    block.append(element('legend', '', `${sun.name}${sun.team ? ' (team)' : ''}`));
    sun.links.forEach(planet => {
      [[planet, planet.name], ...planet.moons.map(moon => [moon, `${planet.name} → ${moon.name}`])].forEach(([item, label]) => {
        const key = destinationKey(item);
        if (seen.has(key)) return;
        seen.add(key);
        block.append(routineCheckbox(item, `${label}${item.type === 'rdp' ? ' (Remote Desktop, not opened)' : ''}`, key, chosen.has(key)));
      });
    });
    if (block.querySelector('input')) choices.append(block);
  });
  const updateSummary = () => {
    const count = choices.querySelectorAll('input:checked').length;
    summary.textContent = `${counted(count, 'link')} chosen. They open in map order; links you already had keep their place.`;
  };
  choices.addEventListener('change', updateSummary);
  filter.input.addEventListener('input', () => {
    const needle = filter.input.value.trim().toLocaleLowerCase();
    for (const row of choices.querySelectorAll('.routine-choice')) row.hidden = Boolean(needle) && !row.dataset.search.includes(needle);
  });
  updateSummary();
  form.append(summary, filter.wrapper, choices);
  const actions = element('div', 'editor-actions');
  const save = element('button', 'editor-primary', isNew ? 'Add routine' : 'Save routine');
  save.type = 'submit';
  actions.append(save);
  if (!isNew) {
    actions.append(editorButton('Remove routine', () => {
      if (!window.confirm(`Remove the ${routine.name} routine? The links stay on your map.`)) return;
      const next = routines.filter((_, i) => i !== index);
      applyEditorChange(copyGroups(), showRoutines, { routines: next, label: `Removed routine ${routine.name}` });
    }, 'editor-danger'));
  }
  form.append(actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const boxes = [...choices.querySelectorAll('input:checked')];
    const picked = new Map(boxes.map(box => [box.value, box.dataset.name]));
    // Keep the existing order, then add new links in map order.
    const links = routine.links.filter(link => picked.has(link.key));
    for (const [key, linkName] of picked) {
      if (!links.some(link => link.key === key)) links.push({ key, name: linkName });
    }
    if (!links.length) return editorError('Choose at least one link for this routine.');
    const value = { name: name.input.value.trim(), links };
    if (!isNew) value.id = routine.id;
    if (offerBox.checked) {
      value.schedule = { time: time.input.value, days: dayBoxes.flatMap((box, day) => box.checked ? [day] : []) };
    }
    const next = [...routines];
    if (isNew) next.push(value);
    else next[index] = value;
    applyEditorChange(copyGroups(), showRoutines, { routines: next, label: `${isNew ? 'Added' : 'Saved'} routine ${value.name}` });
  });
  menuContent.append(form);
}
