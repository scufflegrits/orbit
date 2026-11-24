import { store } from '../../state/page-store.js';
import { element } from '../dom.js';
import { modes } from '../page-modes.js';
import { settingsTrigger } from '../page.js';

let lastRecord = '';

/** Mirror the active workspace's undo record on the map. */
export function updateRemovalNotice() {
  const undo = store.loadUndoRecord();
  const key = undo ? JSON.stringify([store.state().workspace, undo]) : '';
  if (key === lastRecord) return;
  lastRecord = key;
  dismissRemovalNotice();
  if (!undo) return;

  const notice = element('div', 'map-removal-notice');
  notice.id = 'map-removal-notice';
  const status = element('span', '', `Removed ${undo.label}.`);
  status.setAttribute('role', 'status');
  const restore = element('button', 'editor-button', 'Undo removal');
  restore.type = 'button';
  restore.addEventListener('click', () => {
    try {
      if (!store.undoRemoval()) dismissRemovalNotice();
    } catch (error) {
      status.textContent = `Could not undo removal: ${/** @type {Error} */ (error).message}`;
    }
  });
  const dismiss = element('button', 'editor-button', 'Dismiss');
  dismiss.type = 'button';
  dismiss.addEventListener('click', dismissRemovalNotice);
  notice.append(status, restore, dismiss);
  document.body.append(notice);
  syncRemovalNoticeVisibility();
}


export function syncRemovalNoticeVisibility() {
  document.querySelector('#map-removal-notice')?.toggleAttribute('hidden', !modes.overlayIs('none'));
}

function dismissRemovalNotice() {
  const notice = document.querySelector('#map-removal-notice');
  if (notice?.contains(document.activeElement)) settingsTrigger.focus({ preventScroll: true });
  notice?.remove();
}
