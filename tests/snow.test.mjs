import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnowfall } from '../.test-build/snow.js';

function frame(snow, time) {
  const circles = [];
  const strokes = [];
  let saved = 0;
  snow.draw({
    save() { saved++; },
    restore() { saved--; },
    beginPath() {},
    arc(x, y, radius) { circles.push({ x, y, radius }); },
    fill() {},
    moveTo(x, y) { strokes.push({ x, y }); },
    lineTo(x, y) { strokes.push({ x, y }); },
    stroke() {},
  }, time);
  assert.equal(saved, 0, 'snow must leave the webcam canvas state balanced');
  return { circles, strokes };
}

test('snow covers the frame, falls downward and stays fixed when animation time is paused', () => {
  const snow = createSnowfall(1280, 720);
  const first = frame(snow, 0);
  const next = frame(snow, 0.1);
  assert.deepEqual(frame(snow, 0.1), next);
  assert.ok(first.circles.length > 50 && first.strokes.length > 0);
  const quarters = new Set(first.circles.map(flake => `${flake.x > 640}:${flake.y > 360}`));
  assert.equal(quarters.size, 4, 'snow should cover the webcam, not just surround the hat');
  for (let i = 0; i < first.circles.length; i++) {
    const fall = next.circles[i].y - first.circles[i].y;
    assert.ok((fall > 0 && fall < 7) || fall < -700, 'flakes must fall or wrap from bottom to top');
  }
});

test('snow recycles inside padded frame bounds over long runs without particle buildup', () => {
  const snow = createSnowfall(1280, 720);
  const first = frame(snow, 0);
  for (const time of [30, 600, 3600]) {
    const current = frame(snow, time);
    assert.equal(current.circles.length, first.circles.length);
    assert.equal(current.strokes.length, first.strokes.length);
    for (const flake of current.circles) {
      assert.ok(flake.x >= -12 && flake.x <= 1292);
      assert.ok(flake.y >= -12 && flake.y <= 732);
    }
  }
});
