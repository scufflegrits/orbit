// Check links (2.2.1 tools.js): ask serve.py whether each web address answers; server mode only.
// Moved in rewrite phase 6b.
import { destinationKey } from '../../../core/destination.js';
import { templateNames } from '../../../core/templates.js';
import { checkLinks } from '../../../services/link-check.js';
import { counted, element } from '../../dom.js';
import { editorActions, editorButton, editorHeader, editPath, linkCheckResults, pathLabel } from '../kit.js';
import { nav } from '../nav.js';
import { groups, menuContent } from '../../page.js';

function webLinksByUrl() {
  const byUrl = new Map();
  groups.forEach((sun, sunIndex) => sun.links.forEach((/** @type {any} */ planet, /** @type {any} */ planetIndex) => {
    [[planet, [sunIndex, planetIndex]], ...planet.moons.map((/** @type {any} */ moon, /** @type {any} */ moonIndex) => [moon, [sunIndex, planetIndex, moonIndex]])]
      .forEach(([item, path]) => {
        // Remote Desktop links and links with {placeholders} are not checked.
        if (item.type === 'rdp' || templateNames(item.url).length) return;
        if (!byUrl.has(item.url)) byUrl.set(item.url, []);
        byUrl.get(item.url).push({ item, path });
      });
  }));
  return byUrl;
}

export function showLinkCheck() {
  editorHeader('Check links', nav.showSunList);
  if (location.protocol === 'file:') {
    menuContent.append(element('p', '', 'Checking links needs the local server, because a page opened from a file cannot read other sites. In the Orbit folder, run:'));
    menuContent.append(element('code', 'editor-code', 'python3 serve.py'));
    menuContent.append(element('p', '', 'Then open http://localhost:8000 and choose Check links again.'));
    return;
  }
  const byUrl = webLinksByUrl();
  menuContent.append(element('p', '', `Orbit asks each website address in your map (${byUrl.size} in all) whether it answers. Remote Desktop links are not checked. Nothing is sent anywhere except to those sites.`));
  const status = element('p', 'link-check-status');
  status.setAttribute('role', 'status');
  const results = element('div', 'link-check-results');
  const start = editorButton('Start check', () => runLinkCheck(byUrl, status, results, start), 'editor-primary');
  editorActions().append(start);
  menuContent.append(status, results);
}

/**
 * @param {any} byUrl
 * @param {any} status
 * @param {any} results
 * @param {any} start
 */
async function runLinkCheck(byUrl, status, results, start) {
  start.disabled = true;
  results.replaceChildren();
  const urls = [...byUrl.keys()];
  let answers;
  try {
    // The requests moved to src/services/link-check.js in rewrite phase 4.
    answers = await checkLinks(urls,
      { onProgress: (done, total) => { status.textContent = `Checked ${done} of ${total}…`; } });
  } catch (error) {
    status.textContent = `The check stopped: ${/** @type {any} */ (error).message}`;
    start.disabled = false;
    return;
  }
  linkCheckResults.clear();
  const failures = [];
  for (const [url, entries] of byUrl) {
    const answer = answers[url] || { ok: false, error: 'no answer' };
    for (const entry of entries) linkCheckResults.set(destinationKey(entry.item), answer);
    if (!answer.ok) failures.push({ url, answer, entries });
  }
  status.textContent = failures.length
    ? `Checked ${counted(urls.length, 'address', 'addresses')}: ${failures.length} did not answer correctly.`
    : `Checked ${counted(urls.length, 'address', 'addresses')}: all answered.`;
  failures.forEach(({ answer, entries }) => entries.forEach((/** @type {any} */ { item, path }) => {
    const row = element('div', 'editor-list-row link-check-failure');
    const copy = element('span', 'history-copy');
    copy.append(element('strong', '', `⚠ ${item.name}`));
    copy.append(element('small', '', `${pathLabel(path)} · ${answer.status ? `HTTP ${answer.status}` : answer.error}`));
    row.append(copy, editorButton(groups[path[0]].team ? 'View' : 'Edit', () => editPath(path)));
    results.append(row);
  }));
  start.disabled = false;
  nav.renderEditorTree();
}
