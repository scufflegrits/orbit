// Quick add (2.2.1 variables.js): a web address typed or pasted into Quick
// find or the palette becomes a planet or moon. Moved in rewrite phase 6a;
// the rest of the editor follows in 6b.
import { PLACEHOLDER } from '../../core/templates.js';
import { element } from '../dom.js';
import { openMenu } from '../menu/menu.js';
import { modes } from '../page-modes.js';

/**
 * A typed web address, or null. "www.example.com" becomes https://.
 * @param {unknown} text
 */
export function typedAddress(text) {
  const value = String(text || '').trim();
  if (/\s/.test(value) || !value) return null;
  const candidate = /^https?:\/\//i.test(value) ? value : /^www\.[^.\s]+\.[^\s]+$/i.test(value) ? `https://${value}` : null;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.hostname.includes('.') || url.hostname === 'localhost' ? candidate : null;
  } catch {
    return null;
  }
}

/**
 * A name from the address's host: "docs.example.com" → "Docs".
 * @param {string} address
 */
function suggestedName(address) {
  try {
    const host = new URL(address.replace(PLACEHOLDER, 'x')).hostname.replace(/^www\./, '');
    const word = host.split('.')[0];
    return word ? word[0].toUpperCase() + word.slice(1) : host;
  } catch {
    return '';
  }
}

/**
 * The "Add this link" card at the top of Quick find results.
 * @param {string} address
 */
export function quickAddResult(address) {
  const node = element('button', 'find-item find-add');
  node.type = 'button';
  node.append(element('span', 'find-kind', 'Add'));
  const copy = element('span', 'find-copy');
  copy.append(element('strong', '', 'Add this link to your map'), element('small', '', address));
  node.append(copy, element('span', 'find-arrow', '+'));
  node.addEventListener('click', () => showQuickAdd(address));
  return node;
}

/** @param {string} [address] */
export function showQuickAdd(address = '') {
  if (!modes.menuOpen()) openMenu();
  if (!editorTree) openEditorPage();
  editorHeader('Add a link', showSunList);
  /** @type {[string, string][]} */
  const targets = [];
  groups.forEach((sun, sunIndex) => {
    if (sun.team) return;
    targets.push([`sun:${sunIndex}`, `${sun.name} (as a planet)`]);
    sun.links.forEach((/** @type {any} */ planet, /** @type {number} */ planetIndex) => targets.push([`planet:${sunIndex}:${planetIndex}`, `${sun.name} → ${planet.name} (as a moon)`]));
  });
  if (!targets.length) {
    menuContent.append(element('p', 'editor-note', 'Add a sun to your map first; links are added to a sun as planets or to a planet as moons.'));
    editorActions().append(editorButton('Add sun', () => showSunEditor(null), 'editor-primary'));
    return;
  }
  menuContent.append(element('p', '', 'Add a website to a sun as a planet, or to a planet as a moon.'));
  const form = element('form', 'editor-form');
  const url = editorField('Address', address, 'url');
  url.input.setAttribute('aria-label', 'Address');
  const name = editorField('Name', address ? suggestedName(address) : '');
  name.input.setAttribute('aria-label', 'Name');
  let nameEdited = false;
  name.input.addEventListener('input', () => { nameEdited = true; });
  url.input.addEventListener('input', () => { if (!nameEdited) name.input.value = suggestedName(url.input.value); });
  const paste = editorButton('Paste from clipboard', async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      url.input.value = typedAddress(text) || text;
      url.input.dispatchEvent(new Event('input'));
    } catch {
      editorError('The browser did not allow Orbit to read the clipboard. Click in Address and press Ctrl+V instead.');
    }
  });
  const target = element('label', 'editor-field');
  target.append(element('span', '', 'Add to'));
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Add to');
  targets.forEach(([value, label]) => {
    const option = element('option', '', label);
    option.value = value;
    select.append(option);
  });
  target.append(select);
  const actions = element('div', 'editor-actions');
  const save = element('button', 'editor-primary', 'Add link');
  save.type = 'submit';
  actions.append(save);
  form.append(url.wrapper, paste, name.wrapper, target, actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const address = typedAddress(url.input.value) || url.input.value.trim();
    const value = { name: name.input.value.trim() || suggestedName(address), url: address };
    const next = copyGroups();
    const [kind, sunIndex, planetIndex] = select.value.split(':');
    if (kind === 'sun') {
      next[Number(sunIndex)].links.push({ ...value, moons: [] });
      applyEditorChange(next, () => showPlanetEditor(Number(sunIndex), next[Number(sunIndex)].links.length - 1),
        { label: `Added planet ${value.name}` });
    } else {
      const moons = next[Number(sunIndex)].links[Number(planetIndex)].moons;
      moons.push(value);
      applyEditorChange(next, () => showMoonEditor(Number(sunIndex), Number(planetIndex), moons.length - 1),
        { label: `Added moon ${value.name}` });
    }
  });
  menuContent.append(form);
  (address ? name.input : url.input).focus();
}
