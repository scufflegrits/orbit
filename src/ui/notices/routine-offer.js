// Routine offers (2.2.1 routines.js): a scheduled routine that is due is
// offered above the map, never opened by itself, because browsers only open
// tabs after a click. Due is services/schedule.js; offers are remembered in
// state/prefs.js. Moved in rewrite phase 6a.
import { dueRoutines, localDay, today } from '../../services/schedule.js';
import { markOffered, readOffered } from '../../state/prefs.js';
import { counted, element } from '../dom.js';
import { modes } from '../page-modes.js';
import { routineItems, runRoutine } from '../views/open.js';
import { noticeArea } from './area.js';
import { groups, routines } from '../page.js';

/** @param {string} id */
const offered = id => markOffered(id, localDay(today()));

export function offerDueRoutines() {
  document.querySelector('#routine-banner')?.remove();
  if (!modes.routineOffersAllowed()) return;
  const due = dueRoutines(routines, readOffered());
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
      offered(routine.id);
      row.remove();
      if (!banner.querySelector('.routine-offer')) banner.remove();
      runRoutine(routine);
    });
    const later = element('button', 'routine-offer-dismiss', 'Not today');
    later.type = 'button';
    later.addEventListener('click', () => {
      offered(routine.id);
      row.remove();
      if (!banner.querySelector('.routine-offer')) banner.remove();
    });
    row.append(open, later);
    banner.append(row);
  }
  noticeArea().prepend(banner);
}

/** A page left open overnight offers the routine when it is looked at again. */
export function installRoutineOffers() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && groups.length) offerDueRoutines();
  });
}
