import { store } from '../../state/page-store.js';
import { readSafely, writeSafely } from '../../state/storage.js';
import { defaultWorkspace } from '../../state/workspaces.js';
import { element } from '../dom.js';
import { noticeArea } from './area.js';

const KEY = 'orbit:notice:dev-toolbox-moved';

/** Show the one-time migration notice when Main still contains the old Dev Toolbox sun. */
export function showDevToolboxMovedNotice() {
  if (readSafely(KEY) !== null || !defaultWorkspace('dev-toolbox') || store.state().workspace !== 'main' || store.state().source !== 'browser') return;
  const groups = store.state().groups.filter(sun => !sun.team);
  const index = groups.findIndex(sun => sun.id === 'dev-toolbox');
  if (index < 0) return;
  const box = element('section', 'routine-offer');
  box.id = 'dev-toolbox-moved-notice';
  box.setAttribute('role', 'status');
  box.append(element('p', 'routine-offer-copy', 'Dev Toolbox now has its own workspace. Remove the Dev Toolbox sun from Main?'));
  const removeButton = element('button', 'routine-offer-open', 'Remove');
  removeButton.type = 'button';
  removeButton.addEventListener('click', () => {
    const item = groups[index];
    const next = groups.filter((_, i) => i !== index);
    try {
      store.saveMap({ groups: next }, 'Removed Dev Toolbox sun from Main', {
        undoRecord: { kind: 'sun', index, item, label: 'sun Dev Toolbox' },
      });
      writeSafely(KEY, 'remove');
      box.remove();
    } catch (error) {
      box.append(element('p', 'editor-error', `Could not remove the sun: ${/** @type {Error} */ (error).message}`));
    }
  });
  const keepButton = element('button', 'routine-offer-dismiss', 'Keep');
  keepButton.type = 'button';
  keepButton.addEventListener('click', () => { writeSafely(KEY, 'keep'); box.remove(); });
  box.append(removeButton, keepButton);
  noticeArea().prepend(box);
}
