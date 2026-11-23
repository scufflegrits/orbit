// Opening links (2.2.1 favorites.js, variables.js): one destination, or a
// list of them in new tabs (Open all, favorites, routines).
//
// Browsers allow new tabs only during the click that asked for them, so
// everything here is synchronous: no await or timer comes before the last
// window.open. window.open is looked up on every call, so a test stub takes
// effect. Questions and reports are returned to the screen code, which shows
// them; nothing here touches the page.
import { isGroup } from '../core/destination.js';
import { fillTemplate, templateNames } from '../core/templates.js';
import { counted } from '../core/words.js';
import { readVariables } from '../state/prefs.js';
import { launchRdp } from './rdp-launch.js';

/**
 * Open a web address in a new tab, cut off from Orbit's page.
 * @param {string} url
 * @returns {boolean} False when the browser blocked the tab.
 */
export function openTab(url) {
  const opened = /** @type {any} */ (globalThis).open(url, '_blank');
  if (opened) opened.opener = null;
  return Boolean(opened);
}

/**
 * Open one destination as its circle on the map would. A web link with
 * {placeholders} isn't opened: the result 'ask' tells the screen to show the
 * placeholder form. A Remote Desktop link downloads or launches.
 * @param {import('../core/types.js').Destination | import('../core/types.js').GroupPlanet} item
 * @param {{presets: import('../core/types.js').RdpPreset[], launchMode: 'download'|'client'}} options
 * @returns {'ask'|'rdp'|'opened'|'blocked'|'skipped'}
 */
export function openDestination(item, { presets, launchMode }) {
  if (isGroup(item)) return 'skipped';
  if (item.type === 'rdp') {
    launchRdp(item, presets, launchMode);
    return 'rdp';
  }
  if (templateNames(item.url).length) return 'ask';
  return openTab(item.url) ? 'opened' : 'blocked';
}

/**
 * @typedef {object} OpenPlan
 * @property {{item: import('../core/types.js').Destination, url: string}[]} web The tabs to open, placeholders filled.
 * @property {string} note What was left out, for the report.
 * @property {string} question The confirm question, for when more than one tab would open.
 * @property {string | null} empty The report when there is nothing to open, else null.
 * @property {string} label
 */

/**
 * Decide what a list of links opens. Remote Desktop links are left out (each
 * would need its own download or helper prompt), and so are links with a
 * {placeholder} that has no value entered yet.
 * @param {(import('../core/types.js').Destination | import('../core/types.js').GroupPlanet)[]} items
 * @param {string} label The name in the question and report ("your favorites").
 * @param {{question?: ((count: number) => string) | null, extra?: string, values?: Record<string, string>}} [options]
 * @returns {OpenPlan}
 */
export function planLinks(items, label, { question = null, extra = '', values = readVariables() } = {}) {
  const all = items.filter(item => item.type === undefined);
  const web = all.filter(item => templateNames(item.url).every(name => values[name]))
    .map(item => ({ item, url: fillTemplate(item.url, values) }));
  const skipped = items.filter(item => item.type === 'rdp').length;
  const unfilled = all.length - web.length;
  const note = `${skipped ? ` ${counted(skipped, 'Remote Desktop link')} left out.` : ''}${unfilled ? ` ${counted(unfilled, 'link')} with {placeholders} left out until you open ${unfilled === 1 ? 'it' : 'them'} once.` : ''}${extra}`;
  return {
    web,
    note,
    label,
    question: question ? question(web.length) : `Open ${web.length} tabs for ${label}?`,
    empty: web.length ? null : `${label} has no website links to open.${note}`,
  };
}

/**
 * Open a plan's tabs, all in this call. `onOpened` runs for each tab the
 * browser allowed.
 * @param {OpenPlan} plan
 * @param {(item: import('../core/types.js').Destination) => void} [onOpened]
 * @returns {{opened: number, blocked: number, message: string, isError: boolean}}
 */
export function openPlan(plan, onOpened = () => {}) {
  let blocked = 0;
  for (const { item, url } of plan.web) {
    if (openTab(url)) onOpened(item);
    else blocked++;
  }
  const message = blocked
    ? `Your browser blocked ${counted(blocked, 'tab')}. Allow pop-ups for Orbit in the browser's address bar, then try again.${plan.note}`
    : `Opened ${counted(plan.web.length, 'tab')} for ${plan.label}.${plan.note}`;
  return { opened: plan.web.length - blocked, blocked, message, isError: blocked > 0 };
}

/**
 * Open a list of links in new tabs, as 2.2.1's openLinks did. When more
 * than one tab would open and `confirm` is on, `ask(question)` must say yes
 * first (the screen passes window.confirm). Returns the report for the
 * screen to show, or null when the user said no.
 * @param {(import('../core/types.js').Destination | import('../core/types.js').GroupPlanet)[]} items
 * @param {string} label
 * @param {{confirm?: boolean, question?: ((count: number) => string) | null, extra?: string,
 *   ask: (question: string) => boolean, onOpened?: (item: import('../core/types.js').Destination) => void}} options
 * @returns {{message: string, isError: boolean} | null}
 */
export function openLinks(items, label, { confirm = true, question = null, extra = '', ask, onOpened }) {
  const plan = planLinks(items, label, { question, extra });
  if (plan.empty !== null) return { message: plan.empty, isError: false };
  if (confirm && plan.web.length > 1 && !ask(plan.question)) return null;
  const { message, isError } = openPlan(plan, onOpened);
  return { message, isError };
}
