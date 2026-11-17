import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import { createHat } from '../.test-build/hat.js';

test('resizing keeps the tree, brim and topper in their original proportions', () => {
  const hat = createHat();
  const cap = hat.root.getObjectByName('tree-cap');
  hat.update(0, 0, 0.8);
  const small = new Box3().setFromObject(cap).getSize(new Vector3());
  hat.update(0, 0, 1.4);
  const large = new Box3().setFromObject(cap).getSize(new Vector3());
  for (const axis of ['x', 'y', 'z']) {
    assert.ok(Math.abs(large[axis] / small[axis] - 1.4 / 0.8) < 1e-7,
      `${axis} should grow by the same factor`);
  }
});

test('three reindeer follow the sleigh in single file, with only leading Rudolph red-nosed', () => {
  const hat = createHat();
  const deer = ['reindeer-1', 'reindeer-2', 'rudolph'].map(name => hat.root.getObjectByName(name));
  const noses = [];
  hat.flightTeam.traverse(node => { if (node.name.endsWith('-nose')) noses.push(node); });
  assert.equal(noses.length, 3);
  for (const [angle, size] of [[0, 0.7], [2.4, 1.2], [6.1, 1.6]]) {
    hat.update(0, angle, size);
    let previousPhase = 0;
    for (let i = 0; i < deer.length; i++) {
      const position = deer[i].position;
      const phase = (Math.atan2(position.z, position.x) - angle + Math.PI * 2) % (Math.PI * 2);
      assert.ok(phase > previousPhase && phase < Math.PI, 'each deer must lead the previous vehicle around the turn');
      previousPhase = phase;
      const nose = deer[i].getObjectByName(`${deer[i].name}-nose`).material.color;
      if (i < 2) assert.ok(Math.max(nose.r, nose.g, nose.b) < 0.05, 'the two trailing noses should be black');
      else assert.ok(nose.r > nose.g * 3 && nose.r > nose.b * 3, 'leading Rudolph should have a red nose');
    }
  }
});

test('the sleigh and all deer climb and descend the same track, facing its tangent and banking inward', () => {
  const hat = createHat();
  const vehicles = ['sleigh', 'reindeer-1', 'reindeer-2', 'rudolph'].map(name => hat.root.getObjectByName(name));
  const epsilon = 0.0001;
  for (const [angle, size] of [[0.3, 0.7], [2.5, 1.2], [6.1, 1.6]]) {
    hat.update(0, angle, size);
    const poses = vehicles.map(vehicle => ({
      position: vehicle.position.clone(),
      forward: new Vector3(1, 0, 0).applyQuaternion(vehicle.quaternion),
      up: new Vector3(0, 1, 0).applyQuaternion(vehicle.quaternion),
    }));
    hat.update(0, angle + epsilon, size);
    const ahead = vehicles.map(vehicle => vehicle.position.clone());
    hat.update(0, angle - epsilon, size);
    vehicles.forEach((vehicle, i) => {
      const tangent = ahead[i].clone().sub(vehicle.position).normalize();
      assert.ok(poses[i].forward.dot(tangent) > 0.99999, 'body must pitch and turn along its own path');
      const inward = poses[i].position.clone().setY(0).negate().normalize();
      assert.ok(poses[i].up.dot(inward) > 0.02, 'body must lean slightly into the turn');
    });
  }
  const sleigh = vehicles[0];
  hat.update(0, Math.PI / 4, 1.2);
  const crest = sleigh.position.y;
  hat.update(0, Math.PI * 3 / 4, 1.2);
  assert.ok(crest - sleigh.position.y > 0.6, 'rollercoaster hills should be substantial, not idle bobbing');
});

test('rounded white trim remains wider and thicker than the original smooth rim', () => {
  const hat = createHat();
  const brim = hat.root.getObjectByName('fluffy-brim');
  const core = brim.getObjectByName('brim-core');
  const size = new Box3().setFromObject(brim).getSize(new Vector3());
  const coreSize = new Box3().setFromObject(core).getSize(new Vector3());
  assert.ok(size.x > 1.95 && size.z > 1.95, 'trim should be wider than the old 1.79-unit rim');
  assert.ok(size.y > 0.3, 'trim should be thicker than the old 0.19-unit rim');
  assert.ok(size.y > coreSize.y + 0.03, 'fluff should extend beyond the smooth core');
  const puffs = brim.getObjectByName('fur-puffs');
  assert.ok(puffs.isInstancedMesh);
  assert.ok(puffs.count < 100, 'rim should use fewer large rounded puffs, not hundreds of tiny ones');
});

test('rim puffs are 50 percent larger and scattered rather than arranged in regular rows', () => {
  const puffs = createHat().root.getObjectByName('fur-puffs');
  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  const rotation = new Quaternion();
  let clockwise = 0;
  let counterclockwise = 0;
  for (let i = 0; i < puffs.count; i++) {
    puffs.getMatrixAt(i, matrix);
    matrix.decompose(position, rotation, scale);
    const oldRadius = 0.075 + (0.5 + Math.sin((i + 20) * 127.1 + 31.7) * 0.5) * 0.025;
    assert.ok(Math.abs(scale.x / oldRadius - 1.5) < 1e-6);
    assert.ok(Math.abs(scale.x - scale.y) < 1e-8 && Math.abs(scale.x - scale.z) < 1e-8,
      'larger puffs must remain round');
    const oldAngle = (Math.floor(i / 3) + (i % 3) * 0.43) * Math.PI * 2 / 28;
    const difference = Math.atan2(Math.sin(Math.atan2(position.z, position.x) - oldAngle),
      Math.cos(Math.atan2(position.z, position.x) - oldAngle));
    if (difference > 0.02) clockwise++;
    if (difference < -0.02) counterclockwise++;
  }
  assert.ok(clockwise > 20 && counterclockwise > 20, 'placement should vary noticeably in both directions');
});

test('all three deer kick from fixed hips with alternating legs, and a paused time freezes the gait', () => {
  const hat = createHat();
  for (const name of ['reindeer-1', 'reindeer-2', 'rudolph']) {
    const near = hat.root.getObjectByName(`${name}-front-near`);
    const far = hat.root.getObjectByName(`${name}-front-far`);
    const hoof = near.getObjectByName('hoof');
    hat.update(0, 0, 1.2);
    const hipStart = near.getWorldPosition(new Vector3());
    const hoofStart = hoof.getWorldPosition(new Vector3());
    const rotations = [near.rotation.z, far.rotation.z];
    hat.update(Math.PI / 64, 0, 1.2);
    assert.ok((near.rotation.z - rotations[0]) * (far.rotation.z - rotations[1]) < 0);
    const motion = new Box3().expandByPoint(hoofStart);
    for (let step = 1; step <= 16; step++) {
      hat.update(step * Math.PI / 64, 0, 1.2);
      assert.ok(near.getWorldPosition(new Vector3()).distanceTo(hipStart) < 1e-8);
      motion.expandByPoint(hoof.getWorldPosition(new Vector3()));
    }
    assert.ok(motion.getSize(new Vector3()).length() > 0.15, 'each deer must make a substantial kick over its gait cycle');
    hat.update(0.37, 0, 1.2);
    const hoofMoving = hoof.getWorldPosition(new Vector3());
    hat.update(0.37, 0, 1.2);
    assert.ok(hoof.getWorldPosition(new Vector3()).distanceTo(hoofMoving) < 1e-8);
  }
});
