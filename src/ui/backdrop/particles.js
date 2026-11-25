// The Constellations background's maths: particles that drift, link up when
// close, and gather around the pointer. Pure (no DOM), so it's tested in node.
// Adapted from Launchpad's particles background (MIT, Copyright (c) 2026 Jake
// Houghton; src/backgrounds/particles.ts, https://github.com/J-Houghton/launchpad;
// notice in docs/THIRD_PARTY_NOTICES.md).

/** Particles closer than this (px) are joined by a line. */
export const LINK_DIST = 130;
/** Particles closer than this to the pointer reach out to it. */
export const POINTER_DIST = 240;
/** Particles closer than this drift away from the pointer. */
export const REPEL_DIST = 140;

/** @typedef {{x: number, y: number, vx: number, vy: number, r: number}} Particle */

/**
 * One particle per 14,000 px² of window, at most 110.
 * @param {number} width
 * @param {number} height
 */
export const targetCount = (width, height) => Math.round(Math.min(110, (width * height) / 14_000));

/**
 * A particle somewhere in the window, drifting slowly in a random direction.
 * @param {number} width
 * @param {number} height
 * @param {() => number} [random]
 * @returns {Particle}
 */
export function spawn(width, height, random = Math.random) {
  const x = random() * width;
  const y = random() * height;
  const angle = random() * Math.PI * 2;
  const speed = 0.12 + random() * 0.22;
  return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 0.8 + random() * 1.6 };
}

/**
 * Frames of 60 Hz since the last draw; a long pause (a hidden tab) never jumps.
 * @param {number} ms
 */
export const frameDt = ms => Math.min(ms, 100) / 16.667;

/**
 * Move every particle: drift, a gentle push away from the pointer, and wrap
 * around the edges. Changes `parts` in place (it runs every frame).
 * @param {Particle[]} parts
 * @param {number} dt Frames of 60 Hz.
 * @param {{x: number, y: number} | null} pointer
 * @param {number} width
 * @param {number} height
 */
export function step(parts, dt, pointer, width, height) {
  const px = pointer?.x ?? -1e4;
  const py = pointer?.y ?? -1e4;
  for (const p of parts) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const dx = p.x - px;
    const dy = p.y - py;
    const d = Math.hypot(dx, dy);
    if (d < REPEL_DIST && d > 0.5) {
      const push = (1 - d / REPEL_DIST) * 1.8 * dt;
      p.x += (dx / d) * push;
      p.y += (dy / d) * push;
    }
    if (p.x < -10) p.x = width + 10; else if (p.x > width + 10) p.x = -10;
    if (p.y < -10) p.y = height + 10; else if (p.y > height + 10) p.y = -10;
  }
}

/**
 * Stretch the field to a new window size instead of stranding particles where
 * the old edges were.
 * @param {Particle[]} parts
 * @param {number} oldWidth
 * @param {number} oldHeight
 * @param {number} width
 * @param {number} height
 */
export function rescale(parts, oldWidth, oldHeight, width, height) {
  if (!oldWidth || !oldHeight) return;
  for (const p of parts) {
    p.x *= width / oldWidth;
    p.y *= height / oldHeight;
  }
}

/** @param {number} d Distance between two particles. */
export const linkAlpha = d => (d < LINK_DIST ? (1 - d / LINK_DIST) * 0.2 : 0);

/** @param {number} d Distance from a particle to the pointer. */
export const pointerAlpha = d => (d < POINTER_DIST ? (1 - d / POINTER_DIST) * 0.6 : 0);

/**
 * A dot near the pointer glows brighter and a little bigger.
 * @param {number} d Distance to the pointer.
 * @param {number} r The particle's radius.
 */
export function dotStyle(d, r) {
  const near = Math.max(0, 1 - d / POINTER_DIST);
  return { alpha: 0.5 + near * 0.45, radius: r * (1 + near * 0.8) };
}

/**
 * The Particles setting: how strongly the particles are drawn (every opacity is
 * multiplied by this, then capped at 1).
 * @param {string} name
 */
export const strength = name => ({ subtle: 0.5, normal: 1, bold: 1.6 })[/** @type {'subtle'} */ (name)] ?? 1;
