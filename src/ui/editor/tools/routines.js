// Routines (2.2.1 routines.js): the list, and the editor for a routine's links and schedule.
// Moved in rewrite phase 6b.
import { destinationKey, isGroup } from '../../../core/destination.js';
import { confirmed } from '../../dialogs/confirm.js';
import { counted, element } from '../../dom.js';
import { routineItems, runRoutine } from '../../views/open.js';
import { applyEditorChange, copyGroups, editorActions, editorButton, editorError, editorField, editorHeader } from '../kit.js';
import { nav } from '../nav.js';
import { shareRoutine } from './packs.js';
import { groups, menuContent, routines } from '../../page.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS = [1, 2, 3, 4, 5];

/**
 * @param {any} schedule
 */
function scheduleText(schedule) {
  if (!schedule) return 'No schedule';
  const days = schedule.days.join(',') === WEEKDAYS.join(',') ? 'weekdays'
    : schedule.days.length === 7 ? 'every day' : schedule.days.map((/** @type {any} */ day) => DAY_NAMES[day]).join(', ');
  return `Offered at ${schedule.time}, ${days}`;
}

export function showRoutines() {
  editorHeader('Routines', nav.showSunList);
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

/**
 * @param {any} item
 * @param {any} label
 * @param {any} key
 * @param {any} checked
 */
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

/**
 * @param {any} index
 */
export function showRoutineEditor(index) {
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
  const chosen = new Set(routine.links.map((/** @type {any} */ link) => link.key));
  const summary = element('p', 'data-source routine-summary');
  const filter = editorField('Filter', '');
  filter.input.setAttribute('aria-label', 'Filter links');
  filter.input.placeholder = 'Type to narrow the list';
  const choices = element('div', 'routine-choices');
  const seen = new Set();
  groups.forEach(sun => {
    const block = element('fieldset', 'routine-sun');
    block.append(element('legend', '', `${sun.name}${sun.team ? ' (team)' : ''}`));
    sun.links.forEach((/** @type {any} */ planet) => {
      [[planet, planet.name], ...planet.moons.map((/** @type {any} */ moon) => [moon, `${planet.name} → ${moon.name}`])].forEach(([item, label]) => {
        if (isGroup(item)) return;
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
    for (const row of /** @type {NodeListOf<HTMLElement>} */ (choices.querySelectorAll('.routine-choice'))) row.hidden = Boolean(needle) && !/** @type {string} */ (row.dataset.search).includes(needle);
  });
  updateSummary();
  form.append(summary, filter.wrapper, choices);
  const actions = element('div', 'editor-actions');
  const save = element('button', 'editor-primary', isNew ? 'Add routine' : 'Save routine');
  save.type = 'submit';
  actions.append(save);
  if (!isNew) {
    actions.append(editorButton('Remove routine', () => {
      if (!confirmed(`Remove the ${routine.name} routine? The links stay on your map.`)) return;
      const next = routines.filter((_, i) => i !== index);
      applyEditorChange(copyGroups(), showRoutines, { routines: next, label: `Removed routine ${routine.name}` });
    }, 'editor-danger'));
  }
  form.append(actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const boxes = [.../** @type {NodeListOf<HTMLInputElement>} */ (choices.querySelectorAll('input:checked'))];
    const picked = new Map(boxes.map(box => [box.value, box.dataset.name]));
    // Keep the existing order, then add new links in map order.
    const links = routine.links.filter((/** @type {any} */ link) => picked.has(link.key));
    for (const [key, linkName] of picked) {
      if (!links.some((/** @type {any} */ link) => link.key === key)) links.push({ key, name: linkName });
    }
    if (!links.length) return editorError('Choose at least one link for this routine.');
    /** @type {any} */
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
