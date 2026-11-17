import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { DEFAULT_FIT, estimateCrownPose, migrateLegacyFit, parseFit } from '../.test-build/fit.js';

const rect = { x: 0, y: 0, width: 1280, height: 720 };

function faceAt(rotation, faceWidth = 200, forehead = new Vector3(0, 0, 0)) {
  const quaternion = new Quaternion().setFromEuler(rotation);
  const normalized = (point) => ({
    x: (point.x + 640) / 1280,
    y: (360 - point.y) / 720,
    z: -point.z / 1280,
  });
  const landmarks = [];
  landmarks[10] = normalized(forehead);
  landmarks[234] = normalized(new Vector3(-faceWidth / 2, 0, 0).applyQuaternion(quaternion));
  landmarks[454] = normalized(new Vector3(faceWidth / 2, 0, 0).applyQuaternion(quaternion));
  return {
    faceLandmarks: [landmarks],
    faceBlendshapes: [],
    facialTransformationMatrixes: [{
      rows: 4, columns: 4, data: new Matrix4().makeRotationFromQuaternion(quaternion).toArray(),
    }],
  };
}

test('crown stays at the same skull point while the forehead rotates around it', () => {
  const offset = new Vector3(0, DEFAULT_FIT.lift * 2, -DEFAULT_FIT.setback * 2);
  for (const yaw of [-0.85, 0, 0.85]) {
    const euler = new Euler(0.2, yaw, 0.15);
    const quaternion = new Quaternion().setFromEuler(euler);
    const forehead = offset.clone().applyQuaternion(quaternion).negate();
    const pose = estimateCrownPose(faceAt(euler, 200, forehead), rect, 1280, 720, DEFAULT_FIT);
    assert.ok(pose);
    assert.ok(Math.hypot(pose.position.x, pose.position.y) < 1e-8,
      'hat should not follow the forehead around the crown');
    assert.ok(pose.quaternion.angleTo(quaternion) < 1e-7);
    assert.ok(Math.abs(pose.scale - 125) < 1e-8);
  }
});

test('head size stays stable during roll, yaw and camera-distance changes', () => {
  for (const rotation of [new Euler(), new Euler(0.3, 0.7, 0.6)]) {
    for (const faceWidth of [120, 240]) {
      const pose = estimateCrownPose(faceAt(rotation, faceWidth), rect, 1280, 720, DEFAULT_FIT);
      assert.ok(Math.abs(pose.scale - faceWidth / 1.6) < 1e-8);
    }
  }
});

test('crown correction respects cropped camera coordinates and resizing does not move the anchor', () => {
  const result = faceAt(new Euler());
  const cropped = { x: -160, y: 0, width: 1600, height: 720 };
  const pose = estimateCrownPose(result, cropped, 1280, 720, DEFAULT_FIT);
  const resized = estimateCrownPose(result, cropped, 1280, 720, { ...DEFAULT_FIT, size: 150 });
  assert.ok(Math.abs(pose.position.x) < 1e-8);
  assert.ok(Math.abs(pose.position.y - DEFAULT_FIT.lift * 2.5) < 1e-8);
  assert.ok(pose.position.distanceTo(resized.position) < 1e-8);
  assert.equal(estimateCrownPose({ ...result, faceLandmarks: [] }, rect, 1280, 720, DEFAULT_FIT), undefined);
});

test('saved personal fit restores valid measurements and rejects corrupt or out-of-range values', () => {
  const fit = { ...DEFAULT_FIT, size: 125, setback: 80 };
  assert.deepEqual(parseFit(JSON.stringify(fit)), fit);
  for (const value of ['invalid json', '{}', 'null', JSON.stringify({ ...fit, size: '125' }),
    JSON.stringify({ ...fit, setback: 1000 })]) {
    assert.throws(() => parseFit(value));
  }
});

test('legacy fits lose stretching, keep skull setback and seat the larger hat lower', () => {
  const old = { width: 135, height: 55, lift: 12, setback: 82 };
  const fit = migrateLegacyFit(JSON.stringify(old));
  assert.equal(fit.size, old.width);
  assert.equal(fit.setback, old.setback);
  assert.ok(fit.lift < old.lift);
  assert.deepEqual(fit, migrateLegacyFit(JSON.stringify({ ...old, height: 120 })));
  assert.ok(migrateLegacyFit(JSON.stringify({ ...old, width: 80 })).size > 80);
  assert.throws(() => migrateLegacyFit(JSON.stringify({ ...old, height: '55' })));
});
