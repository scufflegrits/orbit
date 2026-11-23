import { app, groups, showSiteIcons } from '../page.js';
// Sizing and placing the orbits (2.2.1 render.js): one circle size per level
// shared across the map, label shrinking, the moon fan around a planet, the
// Galaxy's extra top room, and the System note's offset. Moved in rewrite
// phase 5. DOM measuring only; reads the page's current map.

/** Planets around a sun in the Galaxy, planets in a System, moons around a planet. */
export const GALAXY_PLANETS = 5;
export const SYSTEM_PLANETS = 8;
export const VISIBLE_MOONS = 6;
/**
 * How far a Galaxy planet's center sits from its sun's center: clear of the sun
 * grown on hover, with room for the "N moons" label. Same as --orbit-reach in
 * styles.css.
 * @param {number} planet The planet's size in px.
 */
export const galaxyReach = planet => 91 + planet / 2;
/** A site icon (16px) and its gap take this much room above a label. */
const SITE_ICON_ROOM = 19;

/**
 * @param {string[]} names
 * @param {number} totalLimit
 * @param {number} wordLimit
 */
function labelFit(names, totalLimit, wordLimit) {
  const longest = Math.max(1, ...names.map(name => name.length));
  const word = Math.max(1, ...names.flatMap(name => name.split(/[\s/-]+/).map(part => part.length)));
  return Math.max(.8, Math.min(1, totalLimit / longest, wordLimit / word));
}

export function updateMapLabelSizes() {
  // Use one fit per level so every sun in the Galaxy keeps the same type size.
  // A two-line name such as "Confluence ABC" fits the shared sun size.
  // Planets and moons keep their type size; fitOrbitSizes grows their circles.
  document.documentElement.style.setProperty('--sun-label-fit',
    String(labelFit(groups.map(sun => sun.name), 18, 10)));
}

/**
 * @typedef {{selector: string, variable?: string, base: () => number, max: number, names: () => {name: string}[]}} OrbitLevel
 */

// Planet and moon circles grow until every label fits without breaking a word.
// Each level shares one size across the whole map, so a long name in one System
// makes that level larger everywhere and the map stays even. A circle stops
// growing at its level's max; a name that still does not fit gets smaller type.
/** @type {Record<string, OrbitLevel>} */
const ORBIT_LEVELS = {
  home: { selector: '.home-satellite', variable: '--home-planet-size', base: () => 72, max: 112,
    names: () => groups.flatMap(sun => sun.links.slice(0, GALAXY_PLANETS)) },
  detail: { selector: '.detail-satellite', variable: '--detail-planet-size',
    base: () => Math.min(100, Math.max(70, window.innerWidth * .16)), max: 140,
    names: () => groups.flatMap(sun => sun.links.slice(0, SYSTEM_PLANETS)) },
  moon: { selector: '.moon-link', variable: '--moon-size', base: () => 72, max: 88,
    names: () => groups.flatMap(sun => sun.links.flatMap((/** @type {any} */ planet) => planet.moons.slice(0, VISIBLE_MOONS))) },
  more: { selector: '.more-link', variable: '--more-planet-size', base: () => 90, max: 130,
    names: () => groups.flatMap(sun => sun.links.slice(SYSTEM_PLANETS)) },
  overflowMoon: { selector: '.overflow-moon-link', variable: '--overflow-moon-size', base: () => 76, max: 110,
    names: () => groups.flatMap(sun => sun.links.flatMap((/** @type {any} */ planet) => planet.moons)) },
};
/** The circle size chosen for each level, in px. @type {Record<string, number>} */
export const orbitSizes = {};
/** @type {CanvasRenderingContext2D | null} */
let canvas = null;
const measureContext = () => /** @type {CanvasRenderingContext2D} */ (canvas ??= document.createElement('canvas').getContext('2d'));

// Lay the words out the way the browser will (greedy wrapping, centered) and
// check that no word is wider than the circle and every line sits inside it.
// `extra` is room above the text for a site icon.
/**
 * @param {string} name
 * @param {number} diameter
 * @param {number} padding
 * @param {number} lineHeight
 * @param {(text: string) => number} measure
 * @param {number} [extra]
 */
function labelFits(name, diameter, padding, lineHeight, measure, extra = 0) {
  const width = diameter - padding * 2;
  const space = measure(' ');
  /** @type {number[]} */
  const lines = [];
  for (const word of name.split(/\s+/).filter(Boolean)) {
    const wordWidth = measure(word);
    if (wordWidth > width) return false;
    const last = lines.length - 1;
    if (last >= 0 && lines[last] + space + wordWidth <= width) lines[last] += space + wordWidth;
    else lines.push(wordWidth);
  }
  const radius = diameter / 2 - 3;
  const half = (lines.length * lineHeight + extra) / 2;
  return lines.every((lineWidth, line) => {
    const y = Math.abs(extra + (line + .5) * lineHeight - half);
    return y < radius && lineWidth / 2 <= Math.sqrt(radius * radius - y * y);
  });
}

export function fitOrbitSizes() {
  const root = document.documentElement.style;
  const context = measureContext();
  for (const [key, level] of Object.entries(ORBIT_LEVELS)) {
    const sample = app.querySelector(level.selector);
    const base = level.base();
    if (!sample) {
      if (!orbitSizes[key]) orbitSizes[key] = base;
      continue;
    }
    const style = getComputedStyle(sample);
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const cache = new Map();
    /** @param {string} text */
    const measure = text => {
      if (!cache.has(text)) cache.set(text, context.measureText(text).width);
      return cache.get(text);
    };
    // The text box is the circle minus its padding and border on each side.
    const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.borderLeftWidth) || 0);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    const names = [...new Set(level.names().map(item => item.name))];
    const extra = showSiteIcons ? SITE_ICON_ROOM : 0;
    let size = Math.round(base);
    while (size < level.max && !names.every(name => labelFits(name, size, padding, lineHeight, measure, extra))) size += 2;
    orbitSizes[key] = Math.min(size, level.max);
    root.setProperty(/** @type {string} */ (level.variable), `${orbitSizes[key]}px`);
    shrinkLongLabels(level.selector, orbitSizes[key], style, padding, extra);
  }
}

/**
 * @param {string} selector
 * @param {number} size
 * @param {CSSStyleDeclaration} style
 * @param {number} padding
 * @param {number} [extra]
 */
function shrinkLongLabels(selector, size, style, padding, extra = 0) {
  const context = measureContext();
  const fontSize = parseFloat(style.fontSize);
  const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.2;
  for (const node of /** @type {NodeListOf<HTMLElement>} */ (app.querySelectorAll(selector))) {
    node.style.removeProperty('font-size');
    // Try 100%, 95%, ... down to 60% of the level's type size.
    for (let step = 20; step >= 12; step--) {
      const scale = step / 20;
      context.font = `${style.fontWeight} ${fontSize * scale}px ${style.fontFamily}`;
      /** @param {string} text */
      const measure = text => context.measureText(text).width;
      if (step === 12 || labelFits(/** @type {string} */ (node.textContent), size, padding, lineHeight * scale, measure, extra)) {
        if (scale < 1) node.style.fontSize = `${(fontSize * scale).toFixed(2)}px`;
        break;
      }
    }
  }
}

/**
 * Points around each circle, wrapped in their convex hull (monotone chain).
 * @param {{x: number, y: number, r: number}[]} circles
 * @param {number} margin
 */
function circleHull(circles, margin) {
  const points = circles.flatMap(({ x, y, r }) => Array.from({ length: 24 }, (_, i) => {
    const turn = i * Math.PI / 12;
    return { x: x + Math.cos(turn) * (r + margin), y: y + Math.sin(turn) * (r + margin) };
  })).sort((a, b) => a.x - b.x || a.y - b.y);
  /** @typedef {{x: number, y: number}} Point */
  /** @param {Point} o @param {Point} a @param {Point} b */
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  /** @param {Point[]} list */
  const half = list => list.reduce((/** @type {Point[]} */ hull, point) => {
    while (hull.length >= 2 && cross(/** @type {Point} */ (hull.at(-2)), /** @type {Point} */ (hull.at(-1)), point) <= 0) hull.pop();
    hull.push(point);
    return hull;
  }, []);
  const lower = half(points);
  const upper = half([...points].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * Spokes from a planet to its moons.
 * @param {{x: number, y: number}[]} points
 * @param {{x: number, y: number}} origin
 * @param {number} size
 */
function moonSpokes(points, origin, size) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'moon-spokes');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');
  for (const point of points) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(origin.x));
    line.setAttribute('y1', String(origin.y));
    line.setAttribute('x2', String(point.x));
    line.setAttribute('y2', String(point.y));
    svg.append(line);
  }
  return svg;
}

/**
 * Moons fan out from the outer side of their planet. More than four moons get
 * a wider fan and a longer reach, and the reach always leaves a gap between
 * neighbouring moons and between the moons and the planet.
 * @param {HTMLElement} field
 */
function layoutMoonField(field) {
  const angle = Number(field.dataset.angle);
  const home = field.dataset.context === 'home';
  const planet = orbitSizes[home ? 'home' : 'detail'] || (home ? 72 : 100);
  const moon = orbitSizes.moon || 72;
  const moons = /** @type {HTMLElement[]} */ ([...field.querySelectorAll('.moon-link')]);
  const crowded = moons.length > 4;
  const spread = (crowded ? 150 : 130) * Math.PI / 180;
  const step = moons.length > 1 ? spread / (moons.length - 1) : 0;
  const extra = crowded ? 28 : 0;
  let radius = Math.max((home ? 98 : 108) + extra, planet / 2 + moon / 2 + 26 + extra);
  if (step) radius = Math.max(radius, (moon + 6) / (2 * Math.sin(step / 2)));
  const positions = moons.map((_, index) => {
    const moonAngle = angle - spread / 2 * (moons.length > 1 ? 1 : 0) + step * index;
    return { x: Math.cos(moonAngle) * radius, y: Math.sin(moonAngle) * radius };
  });
  // How far the highest moon rises above the sun's center (Galaxy only).
  const lift = Math.sin(angle) * galaxyReach(planet);
  field.dataset.rise = String(Math.round(Math.max(...positions.map(point => -(lift + point.y))) + moon / 2));
  // How far the lowest moon reaches below its planet's center (System only).
  field.dataset.drop = String(Math.round(Math.max(...positions.map(point => point.y)) + moon / 2));
  // The field is the hover area joining the planet to its moons. It is clipped
  // to the outline around them, so it never covers a neighbouring planet.
  const hull = circleHull([{ x: 0, y: 0, r: planet / 2 },
    ...positions.map(point => ({ ...point, r: moon / 2 }))], 12);
  const out = radius * .5;
  const center = { x: Math.cos(angle) * out, y: Math.sin(angle) * out };
  const size = Math.ceil(2 * Math.max(...hull.map(point => Math.hypot(point.x - center.x, point.y - center.y))));
  field.style.width = field.style.height = `${size}px`;
  field.style.clipPath = `polygon(${hull.map(point =>
    `${(point.x - center.x + size / 2).toFixed(1)}px ${(point.y - center.y + size / 2).toFixed(1)}px`).join(', ')})`;
  field.style.setProperty('--out-x', `${center.x}px`);
  field.style.setProperty('--out-y', `${center.y}px`);
  moons.forEach((node, index) => {
    node.style.setProperty('--mx', `${positions[index].x - center.x}px`);
    node.style.setProperty('--my', `${positions[index].y - center.y}px`);
  });
  const origin = { x: size / 2 - center.x, y: size / 2 - center.y };
  field.querySelector('.moon-spokes')?.remove();
  field.prepend(moonSpokes(positions.map(point => ({
    x: origin.x + point.x, y: origin.y + point.y,
  })), origin, size));
}

/**
 * A lower Galaxy planet's moons fan downwards and can reach the sun's caption.
 * Mark each planet whose fan does, so the caption fades while its moons show
 * (styles.css) instead of sitting under them.
 */
function markCaptionFans() {
  const planet = orbitSizes.home || 72;
  for (const orbit of /** @type {NodeListOf<HTMLElement>} */ (app.querySelectorAll('.home-orbit'))) {
    const caption = /** @type {HTMLElement | null} */ (orbit.parentElement?.querySelector(':scope > .group-description') ?? null);
    const center = orbit.offsetTop + orbit.offsetHeight / 2;
    for (const field of /** @type {NodeListOf<HTMLElement>} */ (orbit.querySelectorAll('.moon-field'))) {
      const bottom = center + Math.sin(Number(field.dataset.angle)) * galaxyReach(planet) + Number(field.dataset.drop);
      field.closest('.planet-cluster')?.toggleAttribute('data-covers-caption',
        Boolean(caption?.textContent) && bottom > /** @type {HTMLElement} */ (caption).offsetTop);
    }
  }
}

export function layoutOrbits() {
  fitOrbitSizes();
  /** @type {NodeListOf<HTMLElement>} */ (app.querySelectorAll('.moon-field')).forEach(layoutMoonField);
  // A long moon fan on a first-row Galaxy planet would reach past the top bar.
  // There are 242px above a first-row sun's center, plus the orbit's own top
  // margin (which grows with the planet size); add whatever more the highest
  // first-row fan needs.
  const firstCard = /** @type {HTMLElement | null} */ (app.querySelector('.group-card'));
  const firstRow = firstCard?.offsetTop;
  const orbitMargin = parseFloat(getComputedStyle(firstCard?.querySelector('.home-orbit') ?? document.body).marginTop) || 0;
  const fans = /** @type {HTMLElement[]} */ ([...app.querySelectorAll('.home-orbit .moon-field')])
    .filter(field => /** @type {HTMLElement} */ (field.closest('.group-card')).offsetTop === firstRow)
    .map(field => Number(field.dataset.rise));
  const extra = Math.max(0, ...fans) - 242 - (firstCard ? orbitMargin : 0);
  document.documentElement.style.setProperty('--galaxy-fan-room', `${Math.max(0, Math.ceil(extra))}px`);
  markCaptionFans();
  // In a System, a fan on a lower planet can hang past the bottom of the stage;
  // push the note below it down so the moons never cover its text.
  const stage = /** @type {HTMLElement | null} */ (app.querySelector('.detail-stage'));
  const note = /** @type {HTMLElement | null} */ (app.querySelector('.detail-note'));
  if (stage && note) {
    const overhang = Math.max(0, .../** @type {HTMLElement[]} */ ([...stage.querySelectorAll('.moon-field')]).map(field =>
      /** @type {HTMLElement} */ (field.closest('.planet-cluster')).offsetTop + Number(field.dataset.drop) - stage.offsetHeight));
    note.style.marginTop = overhang > 0 ? `${Math.ceil(overhang + 12)}px` : '';
  }
}

/** Re-lay the orbits on resize, and once the web font has loaded. */
export function installLayout() {
  let frame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(layoutOrbits);
  });
  // Measurements taken before the web font loads would use the fallback font.
  window.addEventListener('load', () => document.fonts?.ready.then(layoutOrbits));
}
