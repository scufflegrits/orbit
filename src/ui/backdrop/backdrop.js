// The Constellations background (Settings > Background): drifting colour glows,
// particles that link up and gather around the pointer, a light that follows
// the pointer, and a little grain, behind Orbit. Adapted from Launchpad's
// backdrop (MIT; see particles.js). Its colours are CSS variables per theme
// (styles.css, --backdrop-*), so a theme switch recolours it.
//
// It never takes input (pointer-events: none) and sits as body's first child
// with z-index 0: Orbit paints backgrounds on both <html> and <body>, which
// would cover anything with a negative z-index. It moves only when the
// background is on, the tab is visible, no menu covers the page, Animations
// are on, and reduced motion isn't requested; otherwise it draws one still frame.
import { element } from '../dom.js';
import { animationsEnabled, backgroundMode, particleStrength } from '../page.js';
import { modes } from '../page-modes.js';
import { dotStyle, frameDt, linkAlpha, pointerAlpha, rescale, spawn, step, strength, targetCount } from './particles.js';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** @type {HTMLElement | null} */
let layer = null;
/** @type {HTMLCanvasElement | null} */
let canvas = null;
/** @type {CanvasRenderingContext2D | null} */
let g = null;
/** @type {import('./particles.js').Particle[]} */
let parts = [];
let width = 0;
let height = 0;
/** @type {{x: number, y: number} | null} */
let pointer = null;
let last = 0;
let frame = 0;
let menuWasOpen = false;

const still = () => !animationsEnabled || reducedMotion();
const paused = () => still() || document.hidden || modes.menuOpen();
/** The pointer only shapes the background while it moves: with motion off or a menu open it's ignored. */
const activePointer = () => (paused() ? null : pointer);

/** Show the pointer's glow only while the background moves, and pause the blobs under a menu. */
function syncLayerState() {
  if (!layer) return;
  if (paused()) delete layer.dataset.pointer;
  else if (pointer) layer.dataset.pointer = '';
  if (modes.menuOpen()) layer.dataset.menu = '';
  else delete layer.dataset.menu;
}

function build() {
  layer = element('div', 'backdrop');
  layer.setAttribute('aria-hidden', 'true');
  for (const index of [1, 2, 3, 4]) layer.append(element('div', `blob blob-${index}`));
  canvas = /** @type {HTMLCanvasElement} */ (element('canvas'));
  g = canvas.getContext('2d');
  layer.append(canvas, element('div', 'cursor-glow'), element('div', 'grain'));
  document.body.prepend(layer);
  parts = [];
  width = 0;
  height = 0;
  resize();
}

function remove() {
  cancelAnimationFrame(frame);
  layer?.remove();
  layer = canvas = g = null;
  parts = [];
}

function resize() {
  if (!canvas || !g) return;
  const ratio = Math.min(2, devicePixelRatio || 1);
  rescale(parts, width, height, innerWidth, innerHeight);
  width = innerWidth;
  height = innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  const target = targetCount(width, height);
  while (parts.length < target) parts.push(spawn(width, height));
  parts = parts.slice(0, target);
}

/** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {number} alpha */
function line(x1, y1, x2, y2, alpha) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (g);
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function render() {
  if (!canvas || !g) return;
  const k = strength(particleStrength);
  const reach = activePointer();
  const px = reach?.x ?? -1e4;
  const py = reach?.y ?? -1e4;
  g.clearRect(0, 0, width, height);
  g.strokeStyle = g.fillStyle = getComputedStyle(canvas).color;
  for (let i = 0; i < parts.length; i++) {
    const a = parts[i];
    g.lineWidth = 1;
    for (let j = i + 1; j < parts.length; j++) {
      const b = parts[j];
      const alpha = linkAlpha(Math.hypot(a.x - b.x, a.y - b.y));
      if (alpha) line(a.x, a.y, b.x, b.y, alpha * k);
    }
    const toPointer = pointerAlpha(Math.hypot(a.x - px, a.y - py));
    if (toPointer) {
      g.lineWidth = 1.25;
      line(a.x, a.y, px, py, toPointer * k);
    }
  }
  for (const p of parts) {
    const { alpha, radius } = dotStyle(Math.hypot(p.x - px, p.y - py), p.r);
    g.globalAlpha = Math.min(1, alpha * k);
    g.beginPath();
    g.arc(p.x, p.y, radius, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** @param {number} now */
function loop(now) {
  frame = 0;
  if (!layer) return;
  const dt = last ? frameDt(now - last) : 0;
  last = now;
  if (!paused()) step(parts, dt, activePointer(), width, height);
  render();
  if (paused()) last = 0;
  else frame = requestAnimationFrame(loop);
}

/** Show, hide, or redraw the background after a setting, theme, or visibility change. */
export function refreshBackdrop() {
  if (backgroundMode !== 'constellations') {
    if (layer) remove();
    return;
  }
  if (!layer) build();
  syncLayerState();
  cancelAnimationFrame(frame);
  last = 0;
  frame = requestAnimationFrame(loop);
}

/** Listen for the window, the pointer, and the menu (installed once, from main.js). */
export function installBackdrop() {
  addEventListener('resize', () => {
    if (!layer) return;
    resize();
    refreshBackdrop();
  });
  addEventListener('pointermove', event => {
    pointer = { x: event.clientX, y: event.clientY };
    // While paused (Animations off, reduced motion, a menu, a hidden tab) the
    // pointer changes nothing: no glow, no lines, no redraw.
    if (!layer || paused()) return;
    layer.style.setProperty('--cx', `${event.clientX}px`);
    layer.style.setProperty('--cy', `${event.clientY}px`);
    layer.dataset.pointer = '';
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => {
    pointer = null;
    if (layer) delete layer.dataset.pointer;
  });
  document.addEventListener('visibilitychange', () => { if (layer) refreshBackdrop(); });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => { if (layer) refreshBackdrop(); });
  // Pause while a menu covers the page, and pick up again when it closes.
  modes.subscribe(() => {
    const open = modes.menuOpen();
    if (open === menuWasOpen) return;
    menuWasOpen = open;
    if (layer) refreshBackdrop();
  });
}
