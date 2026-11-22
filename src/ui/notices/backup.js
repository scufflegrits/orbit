// The backup reminder (2.2.1 workspaces.js): after 20 changes or 14 days
// without an export, suggest one. Counting is state/backup.js and the due
// check services/schedule.js. Moved in rewrite phase 6a.
import { backupDue as dueFor, now, SNOOZE_MS } from '../../services/schedule.js';
import * as backup from '../../state/backup.js';
import { activeWorkspace, store } from '../../state/page-store.js';
import { readBoolean } from '../../state/prefs.js';
import * as workspaces from '../../state/workspaces.js';
import { hooks } from '../hooks.js';
import { counted, element } from '../dom.js';
import { noticeArea } from './area.js';

/** An export was just made: reset the count and drop the reminder. */
export function noteBackupMade() {
  backup.noteBackupMade(activeWorkspace());
  document.querySelector('#backup-reminder')?.remove();
}

/** Whether the active workspace is due a reminder, with the counts for its text. */
export function backupDue(time = now()) {
  return dueFor(backup.readBackupState()[activeWorkspace()], readBoolean('orbit:backup-reminders', true), time);
}

/** @param {{changes: number, days: number}} due */
export function backupReminder(due) {
  const box = element('div', 'routine-offer backup-reminder');
  const where = workspaces.loadWorkspaces().length > 1 ? ` in ${workspaces.workspaceName(activeWorkspace())}` : '';
  box.append(element('p', 'routine-offer-copy', `Back up your map${where}: ${counted(due.changes, 'change')} since your last export${due.days ? `, ${counted(due.days, 'day')} ago` : ''}.`));
  const save = element('button', 'routine-offer-open', 'Back up now');
  save.type = 'button';
  save.addEventListener('click', () => {
    hooks.exportMap();
    box.remove();
  });
  const later = element('button', 'routine-offer-dismiss', 'Remind me later');
  later.type = 'button';
  later.addEventListener('click', () => {
    const state = backup.readBackupState();
    state[activeWorkspace()] = { ...state[activeWorkspace()], snoozeUntil: now() + SNOOZE_MS };
    backup.writeBackupState(state);
    document.querySelector('#backup-reminder')?.remove();
    box.remove();
  });
  box.append(save, later);
  return box;
}

export function showBackupReminder() {
  document.querySelector('#backup-reminder')?.remove();
  const due = backupDue();
  if (!due) return;
  const box = backupReminder(due);
  box.id = 'backup-reminder';
  noticeArea().append(box);
}
