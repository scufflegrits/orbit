// Where notices go (2.2.1 favorites.js): the banner area above the map
// (routine offers, backup reminders, team updates), and the short report
// after opening several links. Moved in rewrite phase 6a.
import { element } from '../dom.js';

/** The notice area above the map, created on first use. */
export function noticeArea() {
  let area = document.querySelector('#notice-area');
  if (!area) {
    area = element('section', 'notice-area');
    area.id = 'notice-area';
    area.setAttribute('aria-label', 'Notices');
    /** @type {HTMLElement} */ (document.querySelector('.app-shell')).insertBefore(area, app);
  }
  return area;
}

/**
 * Show the open-all report for a few seconds (longer for a problem).
 * @param {string} message
 * @param {boolean} [isError]
 * @returns {string} The message.
 */
export function showOpenAllNotice(message, isError = false) {
  let notice = /** @type {(HTMLElement & {hideTimer?: number}) | null} */ (document.querySelector('#open-all-notice'));
  if (!notice) {
    notice = element('p', 'open-all-notice');
    notice.id = 'open-all-notice';
    notice.setAttribute('role', 'status');
    document.body.append(notice);
  }
  const shown = notice;
  shown.textContent = message;
  shown.classList.toggle('open-all-error', isError);
  shown.hidden = false;
  clearTimeout(shown.hideTimer);
  shown.hideTimer = setTimeout(() => { shown.hidden = true; }, isError ? 9000 : 4000);
  return message;
}
