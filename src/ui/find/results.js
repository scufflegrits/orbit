// Quick find's results (2.2.1 render.js): a row per match with its favorite
// star; in Edit mode a planet or moon opens in Edit links instead. Matching
// is core/search.js. Moved in rewrite phase 5.
import { rdpLaunchUrl } from '../../core/rdp.js';
import { templateNames } from '../../core/templates.js';
import { downloadRdp } from '../../services/rdp-launch.js';
import { element, tagChips } from '../dom.js';
import { modes } from '../page-modes.js';

/** @param {any} match */
function findCopy(match) {
  const copy = element('span', 'find-copy');
  copy.append(element('strong', '', `${match.icon ? `${match.icon} ` : ''}${match.name}`), element('small', '', match.path));
  if (match.why) copy.append(element('small', 'find-why', match.why));
  if (match.destination?.note) copy.append(element('small', 'find-note', match.destination.note));
  if (match.tags?.length) copy.append(tagChips(match.tags));
  return copy;
}

/**
 * In Edit mode a planet or moon result opens that exact item in Edit links
 * instead of launching it.
 * @param {any} match
 */
function editFindResult(match) {
  const node = element('button', 'find-item find-item-edit');
  node.type = 'button';
  node.title = `Edit ${match.name} in Edit links`;
  node.addEventListener('click', () => openEditorAt(match.indices));
  node.append(element('span', 'find-kind', match.kind), findCopy(match));
  node.append(element('span', 'find-arrow find-edit-label', 'Edit'));
  return node;
}

/** @param {any} match */
function findResult(match) {
  if (modes.inEditMode() && match.indices) return editFindResult(match);
  const isRdp = match.destination?.type === 'rdp';
  const download = isRdp && rdpLaunchMode === 'download';
  const template = match.destination && !isRdp && templateNames(match.destination.url).length > 0;
  const node = /** @type {HTMLAnchorElement & HTMLButtonElement} */ (element(match.id || download || template ? 'button' : 'a', 'find-item'));
  if (match.id) {
    node.type = 'button';
    node.addEventListener('click', () => { location.hash = `group/${encodeURIComponent(match.id)}`; });
  } else if (template) {
    node.type = 'button';
    node.dataset.template = 'true';
    node.addEventListener('click', () => askForVariables(match.destination));
  } else if (download) {
    node.type = 'button';
    node.addEventListener('click', () => downloadRdp(match.destination, rdpPresets));
    node.title = `Download Remote Desktop connection for ${match.name}`;
  } else if (isRdp) {
    node.href = rdpLaunchUrl(match.destination, rdpPresets);
    node.title = `Open Remote Desktop Connection for ${match.name}`;
  } else {
    node.href = match.destination.url;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
  }
  if (match.indices) node.dataset.destination = match.indices.join(':');
  node.append(element('span', 'find-kind', match.kind), findCopy(match));
  node.append(element('span', 'find-arrow', match.id ? '→' : download ? '↓' : '↗'));
  return node;
}

/**
 * A result, with a star beside it for planets and moons.
 * @param {any} match
 */
export function findRow(match) {
  const result = findResult(match);
  if (!match.indices) return result;
  const row = element('div', 'find-row');
  const sun = groups[match.indices[0]];
  const on = isFavorite(match.destination, sun);
  const star = element('button', `favorite-toggle${on ? ' is-favorite' : ''}`, on ? '★' : '☆');
  star.type = 'button';
  star.setAttribute('aria-pressed', String(on));
  star.setAttribute('aria-label', `${on ? 'Remove' : 'Add'} ${match.name} ${on ? 'from' : 'to'} favorites`);
  star.title = /** @type {string} */ (star.getAttribute('aria-label'));
  star.addEventListener('click', () => {
    setFavorite(match.indices, !on);
    // The Galaxy re-renders; keep the keyboard user on this result's star.
    /** @type {HTMLElement | null} */ (app.querySelector(`.find-row [data-star="${match.indices.join(':')}"]`))?.focus();
  });
  star.dataset.star = match.indices.join(':');
  row.append(result, star);
  return row;
}
