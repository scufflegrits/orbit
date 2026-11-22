// Small DOM helpers every screen uses (2.2.1 render.js). Moved in rewrite
// phase 5; the bridge also publishes them as page globals for the old
// scripts.
export { counted } from '../core/words.js';

/**
 * A new element with an optional class and text.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {string} [className]
 * @param {string|number|null} [text] Set as textContent, exactly as given (null clears it).
 * @returns {HTMLElementTagNameMap[K]}
 */
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = /** @type {string} */ (text);
  return node;
}

/**
 * A sun's color if it is a six-digit hex color, else the default.
 * @param {unknown} value
 */
export function safeColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#79d9f8';
}

/**
 * Mark a rendered sun, planet, or moon with its array path so Edit mode can
 * find the exact stored item. Names and destinations may repeat; paths do
 * not. Indices are combined: team suns first, as the page numbers them.
 * @template {HTMLElement} T
 * @param {T} node
 * @param {'sun'|'planet'|'moon'} kind
 * @param {number} sun
 * @param {number} [planet]
 * @param {number} [moon]
 * @returns {T}
 */
export function tagPath(node, kind, sun, planet, moon) {
  node.dataset.kind = kind;
  node.dataset.sun = String(sun);
  if (planet !== undefined) node.dataset.planet = String(planet);
  if (moon !== undefined) node.dataset.moon = String(moon);
  return node;
}

/**
 * `#tag` chips.
 * @param {string[]} tags
 */
export function tagChips(tags) {
  const list = element('span', 'tag-chips');
  tags.forEach(tag => list.append(element('span', 'tag-chip', `#${tag}`)));
  return list;
}

/**
 * A description as a paragraph; `[text](https://...)` becomes a link when
 * the address is a plain web address, and stays as text otherwise.
 * @param {string} className
 * @param {string} description
 */
export function descriptionNode(className, description) {
  const node = element('p', className);
  const pattern = /\[([^\[\]]+)\]\(([^()\s]+)\)/g;
  let cursor = 0;
  for (const match of description.matchAll(pattern)) {
    const index = /** @type {number} */ (match.index);
    node.append(document.createTextNode(description.slice(cursor, index)));
    let href = null;
    try {
      const url = new URL(match[2]);
      if (['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password) {
        href = url.href;
      }
    } catch { /* Invalid links stay visible as text. */ }
    if (href) {
      const link = element('a', 'description-link', match[1]);
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      node.append(link);
    } else {
      node.append(document.createTextNode(match[0]));
    }
    cursor = index + match[0].length;
  }
  node.append(document.createTextNode(description.slice(cursor)));
  return node;
}
