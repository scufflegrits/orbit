// ui/backdrop/particles.js: the Constellations background's maths (adapted from Launchpad's particles).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dotStyle, frameDt, LINK_DIST, linkAlpha, POINTER_DIST, pointerAlpha, REPEL_DIST, rescale, spawn, step, strength, targetCount } from './particles.js';

test('particles: one particle per 14,000 px², at most 110', () => {
  assert.equal(targetCount(1400, 1000), 100);
  assert.equal(targetCount(1920, 1080), 110);
  assert.equal(targetCount(3840, 2160), 110);
  assert.equal(targetCount(0, 0), 0);
});

test('particles: links fade with distance; the pointer reaches farther and brighter', () => {
  assert.equal(LINK_DIST, 130);
  assert.equal(POINTER_DIST, 240);
  assert.equal(REPEL_DIST, 140);
  assert.equal(linkAlpha(0), 0.2);
  assert.ok(Math.abs(linkAlpha(65) - 0.1) < 1e-9);
  assert.equal(linkAlpha(130), 0);
  assert.equal(linkAlpha(500), 0);
  assert.equal(pointerAlpha(0), 0.6);
  assert.equal(pointerAlpha(240), 0);
  assert.ok(pointerAlpha(120) > linkAlpha(60));
});

test('particles: dots near the pointer glow brighter and bigger', () => {
  assert.deepEqual(dotStyle(1000, 2), { alpha: 0.5, radius: 2 });
  const near = dotStyle(0, 2);
  assert.ok(Math.abs(near.alpha - 0.95) < 1e-9 && Math.abs(near.radius - 3.6) < 1e-9);
});

test('particles: a frame step is 60 Hz frames, and a long pause never jumps', () => {
  assert.ok(Math.abs(frameDt(16.667) - 1) < 1e-3);
  assert.equal(frameDt(5000), frameDt(100));
  assert.equal(frameDt(0), 0);
});

test('particles: they drift, are pushed away from the pointer, and wrap around the edges', () => {
  const still = [{ x: 100, y: 100, vx: 0, vy: 0, r: 1 }];
  step(still, 1, { x: 150, y: 100 }, 800, 600);
  assert.ok(still[0].x < 100 && still[0].y === 100, 'pushed left, away from a pointer on its right');
  const far = [{ x: 100, y: 100, vx: 0.2, vy: -0.1, r: 1 }];
  step(far, 2, { x: 700, y: 500 }, 800, 600);
  assert.deepEqual([far[0].x, far[0].y], [100.4, 99.8], 'only drift when the pointer is far');
  const edge = [{ x: 809, y: -9, vx: 2, vy: -2, r: 1 }];
  step(edge, 1, null, 800, 600);
  assert.deepEqual([edge[0].x, edge[0].y], [-10, 610], 'wraps to the opposite side');
});

test('particles: a new particle sits inside the window, with a slow speed and a small radius', () => {
  let n = 0;
  const random = () => [0.5, 0.25, 0, 1, 0.5][n++ % 5];
  const p = spawn(800, 600, random);
  assert.equal(p.x, 400);
  assert.equal(p.y, 150);
  const speed = Math.hypot(p.vx, p.vy);
  assert.ok(speed >= 0.12 && speed <= 0.34, `speed ${speed}`);
  assert.ok(p.r >= 0.8 && p.r <= 2.4);
});

test('particles: resizing stretches the field instead of stranding particles', () => {
  const parts = [{ x: 400, y: 300, vx: 0, vy: 0, r: 1 }];
  rescale(parts, 800, 600, 1600, 900);
  assert.deepEqual([parts[0].x, parts[0].y], [800, 450]);
  rescale(parts, 0, 0, 100, 100);
  assert.deepEqual([parts[0].x, parts[0].y], [800, 450], 'nothing to scale from');
});

test('particles: strength scales opacity, Subtle < Normal < Bold, never above 1', () => {
  assert.deepEqual([strength('subtle'), strength('normal'), strength('bold')], [0.5, 1, 1.6]);
  assert.equal(strength('junk'), 1);
});
