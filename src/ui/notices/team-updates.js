// Team map update notices (2.2.1 sharing.js): the first load records the
// team links quietly; later loads report what is new and what was removed.
// The comparison is services/schedule.js. Moved in rewrite phase 6a.
import { itemAt, pathsForKey } from '../../core/destination.js';
import { teamChanges, teamEntries } from '../../services/schedule.js';
import { readTeamSeen, rememberTeam } from '../../state/prefs.js';
import { element } from '../dom.js';
import { destinationNode } from '../views/nodes.js';
import { team } from '../team-map.js';
import { noticeArea } from './area.js';

export function checkTeamUpdates() {
  document.querySelector('#team-updates')?.remove();
  if (!team.groups.length) return;
  const current = teamEntries(team.groups);
  const changes = teamChanges(readTeamSeen(), current);
  if (changes.first) return rememberTeam(current);
  const { added, removed } = changes;
  if (!added.length && !removed.length) return;
  const box = element('div', 'routine-offer team-updates');
  box.id = 'team-updates';
  box.append(element('p', 'routine-offer-copy', `Team map updated: ${added.length} new, ${removed.length} removed.`));
  const details = element('div', 'team-update-list');
  details.hidden = true;
  if (added.length) {
    details.append(element('strong', '', 'New'));
    const list = element('ul', '');
    added.forEach(entry => {
      const item = element('li', '');
      const path = pathsForKey(groups, entry.key)[0];
      item.append(path ? destinationNode(itemAt(groups, path), 'team-update-link', path) : element('span', '', entry.name),
        element('small', '', ` in ${entry.path}`));
      list.append(item);
    });
    details.append(list);
  }
  if (removed.length) {
    details.append(element('strong', '', 'Removed'));
    const list = element('ul', '');
    removed.forEach(entry => list.append(element('li', '', entry.name)));
    details.append(list);
  }
  const show = element('button', 'routine-offer-open', 'Show what’s new');
  show.type = 'button';
  show.setAttribute('aria-expanded', 'false');
  show.addEventListener('click', () => {
    details.hidden = !details.hidden;
    show.setAttribute('aria-expanded', String(!details.hidden));
  });
  const dismiss = element('button', 'routine-offer-dismiss', 'Dismiss');
  dismiss.type = 'button';
  dismiss.addEventListener('click', () => {
    rememberTeam(current);
    box.remove();
  });
  box.append(show, dismiss, details);
  noticeArea().append(box);
}
