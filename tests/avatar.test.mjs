import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Euler, Quaternion, Raycaster, Vector3 } from 'three';
import { AVATAR_BASE_Y, createAvatar, estimateAvatarPosition, NEUTRAL_EXPRESSION, readPuppetExpression, readPuppetEyeClosure } from '../.test-build/avatar.js';
import { createHat } from '../.test-build/hat.js';

function eyeLandmarks(leftAperture, rightAperture, rotation = new Quaternion()) {
  const landmarks = [];
  for (const [indices, aperture, center] of [
    [[362, 263, 385, 380, 387, 373], leftAperture, 50],
    [[33, 133, 160, 144, 158, 153], rightAperture, -50],
  ]) {
    const gap = 60 * aperture / 2;
    const points = [[-30, 0], [30, 0], [-10, gap], [-10, -gap], [10, gap], [10, -gap]];
    indices.forEach((index, i) => {
      const point = new Vector3(center + points[i][0], points[i][1], 0).applyQuaternion(rotation);
      landmarks[index] = { x: 0.5 + point.x / 1280, y: 0.5 - point.y / 720, z: -point.z / 1280 };
    });
  }
  return { faceLandmarks: [landmarks] };
}

test('face expressions map by category name, combine smiles, and bound tracking scores', () => {
  const expression = readPuppetExpression([
    { categoryName: 'mouthSmileRight', score: 0.8 },
    { categoryName: 'eyeBlinkLeft', score: 1.2 },
    { categoryName: 'jawOpen', score: -0.2 },
    { categoryName: 'mouthSmileLeft', score: 0.4 },
    { categoryName: 'browInnerUp', score: 0.6 },
    { categoryName: 'unrelated', score: 0.9 },
  ]);
  assert.equal(expression.blinkLeft, 1);
  assert.equal(expression.blinkRight, 0);
  assert.equal(expression.jaw, 0);
  assert.ok(Math.abs(expression.smile - 0.6) < 1e-10);
  assert.equal(expression.brow, 0.6);
  assert.deepEqual(readPuppetExpression([]), NEUTRAL_EXPRESSION);
});

test('head pose and expressions articulate independently of the hanging body', () => {
  const avatar = createAvatar();
  const torso = avatar.root.getObjectByName('puppet-torso');
  const originalTorso = torso.quaternion.clone();
  const rotation = new Quaternion().setFromEuler(new Euler(0.2, -0.4, 0.1, 'YXZ'));
  avatar.update(rotation, { ...NEUTRAL_EXPRESSION, blinkLeft: 1, jaw: 0.8, smile: 0.7, brow: 0.4 }, 0, true);
  assert.ok(avatar.head.quaternion.angleTo(rotation) < 1e-7);
  assert.ok(torso.quaternion.equals(originalTorso), 'coat must stay rigid within its hanging joint');
  assert.equal(avatar.head.getObjectByName('eye-left').getObjectByName('open-eye').visible, false);
  assert.equal(avatar.head.getObjectByName('eye-left').getObjectByName('closed-eye').visible, true);
  assert.equal(avatar.head.getObjectByName('eye-right').getObjectByName('open-eye').visible, true, 'a wink must not close both eyes');
  assert.ok(avatar.head.getObjectByName('mouth').scale.y > 0.12, 'jaw opening must visibly open the mouth');
  assert.ok(avatar.head.getObjectByName('bearded-jaw').position.y < -0.08, 'beard must follow the jaw');
  assert.ok(avatar.head.getObjectByName('upper-teeth').visible);
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 0, true);
  assert.equal(avatar.head.getObjectByName('eye-left').getObjectByName('open-eye').visible, true);
  assert.equal(avatar.head.getObjectByName('eye-left').getObjectByName('closed-eye').visible, false);
  assert.ok(Math.abs(avatar.head.getObjectByName('bearded-jaw').position.y) < 1e-10);
  assert.equal(avatar.head.getObjectByName('mouth').scale.y, 0.025);
  assert.equal(avatar.head.getObjectByName('upper-teeth').visible, false);
});

test('tracking is smoothed and extreme head rotations are limited', () => {
  const avatar = createAvatar();
  const rotation = new Quaternion().setFromEuler(new Euler(0, 2, 0, 'YXZ'));
  avatar.update(rotation, { ...NEUTRAL_EXPRESSION, jaw: 1 }, 1 / 30);
  const firstYaw = new Euler().setFromQuaternion(avatar.head.quaternion, 'YXZ').y;
  assert.ok(firstYaw > 0 && firstYaw < 1.05);
  const firstOpening = avatar.head.getObjectByName('mouth').scale.y;
  avatar.update(rotation, { ...NEUTRAL_EXPRESSION, jaw: 1 }, 1 / 30);
  assert.ok(avatar.head.getObjectByName('mouth').scale.y > firstOpening);
  avatar.update(rotation, NEUTRAL_EXPRESSION, 0, true);
  assert.ok(Math.abs(new Euler().setFromQuaternion(avatar.head.quaternion, 'YXZ').y - 1.05) < 1e-8);
});

test('Allison has an independent simplified face with speech, winks and shaded moving hair', () => {
  const personal = createAvatar();
  const avatar = createAvatar('allison');
  for (const name of ['beard-base', 'moustache', 'sculpted-beard-wave']) {
    assert.equal(avatar.head.getObjectByName(name), undefined, 'Allison must not inherit facial hair');
    assert.ok(personal.head.getObjectByName(name), 'original puppet must retain its facial hair');
  }
  const face = avatar.head.getObjectByName('face');
  assert.ok(avatar.head.position.z > personal.head.position.z + 0.2, 'Allison head should sit forward of the raised collar');
  const socket = avatar.head.getObjectByName('head-neck-socket');
  const body = avatar.root.getObjectByName('dangling-body');
  avatar.root.updateMatrixWorld(true);
  assert.ok(socket.getWorldPosition(new Vector3()).distanceTo(body.getWorldPosition(new Vector3())) < 1e-8,
    'moving the head forward must preserve the neck connection');
  assert.ok(Math.abs(body.position.z - personal.root.getObjectByName('dangling-body').position.z) < 1e-8,
    'the body must not follow the forward head offset back into the chin');
  assert.ok(face.scale.y > 0.9, 'Allison should have a longer face');
  for (const name of ['upper-lip', 'lower-lip', 'nostril']) {
    assert.equal(avatar.head.getObjectByName(name), undefined, 'Allison should not have lip or nostril details');
  }
  assert.ok(avatar.root.getObjectByName('puppet-torso').position.y
    > personal.root.getObjectByName('puppet-torso').position.y + 0.15, 'Allison body should sit closer to the head');
  for (const cheek of avatar.head.children.filter(node => node.name === 'cheek')) {
    const normal = new Vector3(0, 0, 1).applyQuaternion(cheek.quaternion);
    assert.ok(normal.x * Math.sign(cheek.position.x) > 0.4 && normal.z > 0.7,
      'blush patches should curve around the cheeks rather than face straight forward');
  }
  const faceRest = Array.from(face.geometry.getAttribute('position').array);
  const hair = avatar.head.getObjectByName('flowing-hair-lock');
  const rest = Array.from(hair.geometry.getAttribute('position').array);
  const colors = hair.geometry.getAttribute('color');
  let low = 0;
  let high = 0;
  const position = hair.geometry.getAttribute('position');
  for (let i = 1; i < position.count; i++) {
    if (position.getY(i) < position.getY(low)) low = i;
    if (position.getY(i) > position.getY(high)) high = i;
  }
  assert.ok(colors.getX(low) > colors.getX(high) * 2, 'brown hair must lighten toward the ends');
  const mouth = avatar.head.getObjectByName('mouth');
  const mouthStart = mouth.position.y;
  const rotation = new Quaternion().setFromEuler(new Euler(0.2, 0.4, -0.1, 'YXZ'));
  avatar.update(rotation, { ...NEUTRAL_EXPRESSION, jaw: 0.8, blinkLeft: 1, browRight: 0.9 }, 0, true);
  assert.ok(avatar.head.quaternion.angleTo(rotation) < 1e-7);
  assert.ok(mouth.scale.y > 0.1 && mouth.position.y < mouthStart, 'speech must still animate the simple mouth');
  assert.equal(avatar.head.getObjectByName('eye-left').getObjectByName('open-eye').visible, false);
  assert.equal(avatar.head.getObjectByName('eye-right').getObjectByName('open-eye').visible, true);
  assert.ok(avatar.head.children.filter(node => node.name === 'eyebrow')[0].position.y > 0.6);
  avatar.root.position.x = 0.3;
  avatar.update(rotation, NEUTRAL_EXPRESSION, 1 / 30);
  assert.ok(position.array.some((value, i) => Math.abs(value - rest[i]) > 0.03), 'Allison must share the hair dynamics');
  assert.deepEqual(Array.from(face.geometry.getAttribute('position').array), faceRest, 'hair motion must not deform the face');
  assert.equal(personal.head.getObjectByName('mouth').scale.y, 0.025, 'animating Allison must not alter the original puppet');
});

test('both puppet mouths have raised corners that deepen with smiles without distorting other facial geometry', () => {
  for (const profile of ['personal', 'allison']) {
    const avatar = createAvatar(profile);
    const mouth = avatar.head.getObjectByName('mouth');
    const face = avatar.head.getObjectByName('face');
    assert.equal(avatar.head.getObjectByName('lower-lip'), undefined);
    for (const cheek of avatar.head.children.filter(node => node.name === 'cheek')) {
      const normal = new Vector3(0, 0, 1).applyQuaternion(cheek.quaternion);
      assert.ok(normal.x * Math.sign(cheek.position.x) > 0.4 && normal.z > 0.7,
        'both puppets should have blush patches aligned to their cheeks');
    }
    const faceRest = Array.from(face.geometry.getAttribute('position').array);
    const position = mouth.geometry.getAttribute('position');
    let corner = 0;
    for (let i = 1; i < position.count; i++) {
      if (position.getX(i) > position.getX(corner)) corner = i;
    }
    const cornerRise = () => position.getY(corner) * mouth.scale.y;
    const neutralRise = cornerRise();
    assert.ok(neutralRise > 0.03, 'neutral mouths should have gently lifted corners');
    avatar.update(new Quaternion(), { ...NEUTRAL_EXPRESSION, smile: 1 }, 0, true);
    assert.ok(cornerRise() > neutralRise + 0.04, 'tracked smiles should visibly deepen the curve');
    avatar.update(new Quaternion(), { ...NEUTRAL_EXPRESSION, jaw: 1, smile: 1 }, 0, true);
    assert.ok(cornerRise() > 0.07, 'opening the mouth must preserve raised corners rather than stretching the smile away');
    assert.deepEqual(Array.from(face.geometry.getAttribute('position').array), faceRest,
      'mouth sculpting must not deform the shared face or other oval meshes');
  }
});

test('upper teeth stay against the top of the mouth through speech and smiles for both puppets', () => {
  for (const profile of ['personal', 'allison']) {
    const avatar = createAvatar(profile);
    const mouth = avatar.head.getObjectByName('mouth');
    const teeth = avatar.head.getObjectByName('upper-teeth');
    for (const jaw of [0.2, 0.5, 1, 0.35, 0]) {
      avatar.update(new Quaternion(), { ...NEUTRAL_EXPRESSION, jaw, smile: 0.6 }, 0, true);
      assert.equal(teeth.visible, true);
      assert.ok(Math.abs(teeth.position.y + teeth.scale.y - mouth.position.y - mouth.scale.y) < 1e-10,
        'the top of the teeth must follow the top of the opening, not its center');
    }
    avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 0, true);
    assert.equal(teeth.visible, false, 'neutral closed mouths should still hide the teeth');
  }
});

test('small detected mouth openings are amplified immediately without losing a closed neutral mouth', () => {
  const avatar = createAvatar();
  const mouth = avatar.head.getObjectByName('mouth');
  const neutralHeight = mouth.scale.y;
  for (const raw of [0.005, 0.02, 0.05, 0.1]) {
    avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 0, true);
    const expression = readPuppetExpression([{ categoryName: 'jawOpen', score: raw }]);
    avatar.update(new Quaternion(), expression, 1 / 30);
    assert.ok(mouth.scale.y > neutralHeight + raw * 0.15 * 2.5,
      'small openings should be several times more visible than the former linear response, even on the first frame');
  }
  assert.equal(readPuppetExpression([{ categoryName: 'jawOpen', score: 0 }]).jaw, 0);
  assert.equal(readPuppetExpression([{ categoryName: 'jawOpen', score: 1 }]).jaw, 1);
});

test('independent eyebrow raises and furrows change both height and tilt on the correct side', () => {
  const avatar = createAvatar();
  const brows = avatar.head.children.filter(node => node.name === 'eyebrow');
  const neutral = brows.map(brow => ({ y: brow.position.y, tilt: brow.rotation.z }));
  avatar.update(new Quaternion(), readPuppetExpression([
    { categoryName: 'browOuterUpLeft', score: 0.8 },
    { categoryName: 'browDownRight', score: 0.7 },
  ]), 0, true);
  assert.ok(brows[1].position.y > neutral[1].y + 0.1, 'wearer left brow must raise on viewer right');
  assert.ok(brows[0].position.y < neutral[0].y - 0.05, 'wearer right brow must furrow independently');
  for (let i = 0; i < 2; i++) assert.ok(Math.abs(brows[i].rotation.z - neutral[i].tilt) > 0.1);
  avatar.update(new Quaternion(), readPuppetExpression([{ categoryName: 'browInnerUp', score: 1 }]), 0, true);
  for (let i = 0; i < 2; i++) assert.ok(brows[i].position.y > neutral[i].y + 0.1);
});

test('body stays joined at the neck through head turns and swings with delayed damped motion', () => {
  const avatar = createAvatar();
  const socket = avatar.head.getObjectByName('head-neck-socket');
  const body = avatar.root.getObjectByName('dangling-body');
  const point = new Vector3();
  const attachment = new Vector3();
  avatar.root.position.set(0, -200, 0);
  avatar.root.scale.setScalar(130);
  let earlyRoll = 0;
  let middleRoll = 0;
  for (let frame = 0; frame < 180; frame++) {
    const rotation = new Quaternion().setFromEuler(new Euler(0.35, -0.65, 0.42, 'YXZ'));
    avatar.update(rotation, NEUTRAL_EXPRESSION, 1 / 30);
    avatar.root.updateMatrixWorld(true);
    socket.getWorldPosition(point);
    body.getWorldPosition(attachment);
    assert.ok(point.distanceTo(attachment) < 1e-8, 'head and body must share the exact same neck joint');
    const roll = new Euler().setFromQuaternion(body.quaternion, 'YXZ').z;
    if (frame === 1) earlyRoll = roll;
    if (frame === 12) middleRoll = roll;
    if (frame === 179) assert.ok(Math.abs(roll - 0.42 * 0.42) < 1e-6, 'held pose should settle, not keep bobbing');
    const coat = avatar.root.getObjectByName('wool-coat');
    assert.ok(new Box3().setFromObject(coat).min.y < -360, 'coat endpoint must remain below the output frame');
  }
  assert.ok(middleRoll > earlyRoll + 0.08, 'body must lag then swing into the held head pose');
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 0, true);
  assert.ok(body.quaternion.angleTo(new Quaternion()) < 1e-7, 'neutral reset must clear the swinging body');
});

test('puppet hat follows the head and has independent animation and fit from the webcam hat', () => {
  const avatar = createAvatar();
  const puppetHat = createHat();
  const webcamHat = createHat();
  puppetHat.occluder.visible = false;
  avatar.hatMount.add(puppetHat.root);
  webcamHat.update(1, 0.3, 1.5);
  const originalWebcamCap = webcamHat.root.getObjectByName('tree-cap').scale.clone();
  const rotation = new Quaternion().setFromEuler(new Euler(0.1, 0.4, -0.2, 'YXZ'));
  avatar.update(rotation, NEUTRAL_EXPRESSION, 0, true);
  puppetHat.update(2, 0.8, 1);
  avatar.root.updateMatrixWorld(true);
  assert.ok(puppetHat.root.getWorldQuaternion(new Quaternion()).angleTo(rotation) < 1e-7);
  const brim = new Vector3();
  puppetHat.root.getWorldPosition(brim);
  const expected = avatar.hatMount.position.clone().applyQuaternion(rotation).add(avatar.head.position);
  assert.ok(brim.distanceTo(expected) < 1e-8, 'brim must remain at the head-local crown while turning');
  assert.ok(webcamHat.root.getObjectByName('tree-cap').scale.equals(originalWebcamCap));
  assert.equal(webcamHat.occluder.visible, true, 'webcam occlusion must be preserved');
  assert.equal(puppetHat.occluder.visible, false, 'invisible real-head mask must not punch holes in the puppet');
});

test('puppet translation follows the face midpoint in both axes and respects camera cover cropping', () => {
  const landmarks = [];
  landmarks[234] = { x: 0.3, y: 0.35, z: 0.05 };
  landmarks[454] = { x: 0.5, y: 0.45, z: -0.05 };
  const result = { faceLandmarks: [landmarks] };
  const full = estimateAvatarPosition(result, { x: 0, y: 0, width: 1280, height: 720 }, 1280, 720);
  assert.ok(Math.abs(full.x + 128) < 1e-8, 'moving left must move the puppet left instead of only rotating it');
  assert.ok(Math.abs(full.y - (AVATAR_BASE_Y + 72)) < 1e-8, 'moving upward must raise the puppet');
  const cropped = estimateAvatarPosition(result, { x: -160, y: 0, width: 1600, height: 720 }, 1280, 720);
  assert.ok(Math.abs(cropped.x + 160) < 1e-8, 'cover-cropped camera coordinates must be used');
  landmarks[234] = { x: 0.65, y: 0.6, z: 0 };
  landmarks[454] = { x: 0.85, y: 0.7, z: 0 };
  const moved = estimateAvatarPosition(result, { x: 0, y: 0, width: 1280, height: 720 }, 1280, 720);
  assert.ok(Math.abs(moved.x - 320) < 1e-8);
  assert.ok(Math.abs(moved.y - (AVATAR_BASE_Y - 108)) < 1e-8);
  assert.equal(estimateAvatarPosition({ faceLandmarks: [] }, { x: 0, y: 0, width: 1280, height: 720 }, 1280, 720), undefined);
});

test('sideways translation tugs the hanging body and the coat stays below frame even at the upper edge', () => {
  const avatar = createAvatar();
  avatar.root.scale.setScalar(130);
  avatar.root.position.set(0, AVATAR_BASE_Y, 0);
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 0, true);
  const body = avatar.root.getObjectByName('dangling-body');
  const socket = avatar.head.getObjectByName('head-neck-socket');
  avatar.root.position.x = 80;
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 1 / 30);
  assert.ok(new Euler().setFromQuaternion(body.quaternion, 'YXZ').z < -0.02,
    'body should trail to the left when the head moves right');
  for (let frame = 0; frame < 180; frame++) {
    avatar.root.position.y = AVATAR_BASE_Y + 360;
    avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 1 / 30);
    avatar.root.updateMatrixWorld(true);
    assert.ok(body.getWorldPosition(new Vector3()).distanceTo(socket.getWorldPosition(new Vector3())) < 1e-8);
    assert.ok(new Box3().setFromObject(avatar.root.getObjectByName('wool-coat')).min.y < -360,
      'the coat hem must stay below the 720p frame while the head moves upward');
  }
  assert.ok(body.quaternion.angleTo(new Quaternion()) < 1e-7, 'translation-induced swing must settle');
  avatar.root.position.x = -150;
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 0, true);
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 1 / 30);
  assert.ok(body.quaternion.angleTo(new Quaternion()) < 1e-7, 'snapping to a reacquired face must not create a false movement impulse');
});

test('fuller beard clears the rosy cheeks and keeps the mouth opening unobstructed', () => {
  const avatar = createAvatar();
  avatar.root.updateMatrixWorld(true);
  const cheeks = avatar.head.children.filter(node => node.name === 'cheek');
  const beardParts = [avatar.head.getObjectByName('bearded-jaw')];
  const ray = new Raycaster();
  for (const cheek of cheeks) {
    for (const dx of [-0.06, 0, 0.06]) {
      for (const dy of [-0.04, 0, 0.04]) {
        const point = cheek.position.clone().add(new Vector3(dx, dy, 0));
        avatar.head.localToWorld(point);
        ray.set(new Vector3(point.x, point.y, 10), new Vector3(0, 0, -1));
        const blush = ray.intersectObject(cheek)[0];
        const beard = ray.intersectObjects(beardParts, true)[0];
        assert.ok(blush);
        assert.ok(!beard || beard.distance > blush.distance + 0.01,
          'upper beard must remain behind the visible cheek surface, not cut across it');
      }
    }
  }
  const base = avatar.head.getObjectByName('beard-base');
  const dimensions = new Box3().setFromObject(base).getSize(new Vector3());
  assert.ok(dimensions.x > 1.2 && dimensions.y > 0.9 && dimensions.z > 0.7,
    'beard should be broader, longer and deeper than the previous 1.04 x 0.76 x 0.66 shape');
  for (const jaw of [0, 0.5, 1]) {
    avatar.update(new Quaternion(), { ...NEUTRAL_EXPRESSION, jaw }, 0, true);
    avatar.root.updateMatrixWorld(true);
    const mouth = avatar.head.getObjectByName('mouth');
    const center = mouth.getWorldPosition(new Vector3());
    ray.set(new Vector3(center.x, center.y, 10), new Vector3(0, 0, -1));
    const lips = ray.intersectObject(mouth)[0];
    const beard = ray.intersectObject(avatar.head.getObjectByName('bearded-jaw'), true)[0];
    assert.ok(lips);
    assert.ok(!beard || lips.distance < beard.distance, 'fullness must not hide the speaking mouth');
  }
});

test('longer fuller hair extends below the shoulders without lifting the crown or hiding expressions', () => {
  const avatar = createAvatar();
  const hair = avatar.head.getObjectByName('puppet-hair');
  avatar.root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(hair);
  const dimensions = bounds.getSize(new Vector3());
  assert.ok(dimensions.x > 2.15, 'hair should be visibly wider than the former roughly 1.9-unit silhouette');
  assert.ok(dimensions.z > 1.35, 'fullness should extend around the back, not just stretch the front view');
  assert.ok(dimensions.y > 2.7 && dimensions.y < 3.1, 'waves should now extend past the shoulders');
  assert.ok(bounds.max.y < 1.85, 'longer hair must not lift the crown through the hat');
  const collar = avatar.root.getObjectByName('knitted-collar').getWorldPosition(new Vector3());
  assert.ok(bounds.min.y < collar.y - 0.7, 'hair ends should sit well below the collar rather than at shoulder height');
  const ray = new Raycaster();
  for (const name of ['eye-left', 'eye-right', 'cheek']) {
    for (const feature of avatar.head.children.filter(node => node.name === name)) {
      const center = feature.getWorldPosition(new Vector3());
      ray.set(new Vector3(center.x, center.y, 10), new Vector3(0, 0, -1));
      const faceHit = ray.intersectObject(feature, true)[0];
      const hairHit = ray.intersectObject(hair, true)[0];
      assert.ok(faceHit);
      assert.ok(!hairHit || hairHit.distance > faceHit.distance,
        'fuller hair must frame the face rather than obscure its expressions');
    }
  }
});

test('one fuller beard wraps into the head at the front, sides and back without detaching as the jaw opens', () => {
  const avatar = createAvatar();
  const beard = avatar.head.getObjectByName('beard-base');
  const position = beard.geometry.getAttribute('position');
  const uv = beard.geometry.getAttribute('uv');
  const roots = [];
  for (let i = 0; i < position.count; i++) {
    if (uv.getY(i) !== 0) continue;
    roots.push({ index: i, point: new Vector3().fromBufferAttribute(position, i) });
  }
  assert.ok(Math.min(...roots.map(({ point }) => point.z)) < -0.35, 'beard must wrap behind the head, not form a front-only shield');
  assert.ok(Math.max(...roots.map(({ point }) => point.x)) > 0.58, 'upper sides should reach the head below the ears');
  const dimensions = new Box3().setFromObject(beard).getSize(new Vector3());
  assert.ok(dimensions.x > 1.4 && dimensions.x < 1.65, 'continuous beard should be wider and fuller without ballooning');
  for (const jaw of [0, 0.5, 1, 0]) {
    const rotation = new Quaternion().setFromEuler(new Euler(0.2, 0.7, -0.2));
    avatar.update(rotation, { ...NEUTRAL_EXPRESSION, jaw }, 0, true);
    avatar.root.updateMatrixWorld(true);
    for (const root of roots) {
      const attached = beard.localToWorld(new Vector3().fromBufferAttribute(position, root.index));
      avatar.head.worldToLocal(attached);
      assert.ok(attached.distanceTo(root.point) < 1e-7, 'opening the mouth must not pull the upper beard away from the head');
      const skullDistance = (attached.x / 0.65) ** 2 + ((attached.y - 0.17) / 0.81) ** 2 + (attached.z / 0.57) ** 2;
      assert.ok(skullDistance < 1, 'every attachment must sit inside the head surface rather than float outside it');
    }
  }
});

test('hair bends behind movement with pinned roots and independently flexible locks and backing', () => {
  const avatar = createAvatar();
  avatar.root.scale.setScalar(130);
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 0, true);
  const hair = avatar.head.getObjectByName('puppet-hair');
  const rest = hair.children.map(mesh => Array.from(mesh.geometry.getAttribute('position').array));
  const face = avatar.head.getObjectByName('face');
  const faceRest = Array.from(face.geometry.getAttribute('position').array);
  avatar.root.position.x = 52;
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 1 / 30);
  const tipMotion = [];
  hair.children.forEach((mesh, lock) => {
    const position = mesh.geometry.getAttribute('position');
    let tip = 0;
    for (let i = 0; i < position.count; i++) {
      if (rest[lock][i * 3 + 1] < rest[lock][tip * 3 + 1]) tip = i;
      const y = rest[lock][i * 3 + 1] * mesh.scale.y + mesh.position.y;
      if (y >= 0.35) {
        assert.ok(Math.hypot(position.getX(i) - rest[lock][i * 3], position.getY(i) - rest[lock][i * 3 + 1],
          position.getZ(i) - rest[lock][i * 3 + 2]) < 1e-8, 'crown vertices must stay fixed under the hat');
      }
    }
    const movement = (position.getX(tip) - rest[lock][tip * 3]) * mesh.scale.x;
    assert.ok(movement < -0.2, 'both the long locks and the backing must trail a rightward head movement');
    tipMotion.push(movement);
  });
  assert.ok(Math.max(...tipMotion) - Math.min(...tipMotion) > 0.001, 'locks must not all move as a single solid curtain');
  assert.deepEqual(Array.from(face.geometry.getAttribute('position').array), faceRest,
    'deforming the backing must not deform the shared face geometry');
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 0, true);
  const turn = new Quaternion().setFromEuler(new Euler(0, 0.65, 0));
  avatar.update(turn, NEUTRAL_EXPRESSION, 1 / 30);
  const lock = hair.getObjectByName('flowing-hair-lock');
  const moved = lock.geometry.getAttribute('position').array;
  assert.ok(moved.some((value, i) => i % 3 === 2 && Math.abs(value - rest[1][i]) > 0.04),
    'turning in place must also swing the hair, even without translation');
});

test('both hairstyles have stronger but controlled follow-through after a modest sideways movement', () => {
  for (const profile of ['personal', 'allison']) {
    const avatar = createAvatar(profile);
    avatar.root.scale.setScalar(130);
    avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 0, true);
    const lock = avatar.head.getObjectByName('flowing-hair-lock');
    const position = lock.geometry.getAttribute('position');
    let tip = 0;
    for (let i = 1; i < position.count; i++) if (position.getY(i) < position.getY(tip)) tip = i;
    const rest = position.getX(tip);
    avatar.root.position.x = 26;
    avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 1 / 30);
    const initialLag = rest - position.getX(tip);
    assert.ok(initialLag > 0.225 && initialLag < 0.27, 'a modest movement should create more lag without hitting the hard travel limit');
    let rebound = 0;
    for (let frame = 0; frame < 240; frame++) {
      avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 1 / 30);
      rebound = Math.max(rebound, position.getX(tip) - rest);
    }
    assert.ok(rebound > 0.05 && rebound < 0.09, 'hair should swing back farther, but not whip around uncontrollably');
    assert.ok(Math.abs(position.getX(tip) - rest) < 1e-6, 'extra follow-through must still settle completely');
  }
});

test('hair overshoots, settles, pauses without drift, and clears motion on tracking reacquisition', () => {
  const avatar = createAvatar();
  avatar.root.scale.setScalar(130);
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 0, true);
  const lock = avatar.head.getObjectByName('flowing-hair-lock');
  const rest = Array.from(lock.geometry.getAttribute('position').array);
  const position = lock.geometry.getAttribute('position');
  let tip = 0;
  for (let i = 1; i < position.count; i++) if (position.getY(i) < position.getY(tip)) tip = i;
  avatar.root.position.x = 40;
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 1 / 30);
  const paused = Array.from(position.array);
  for (let i = 0; i < 10; i++) avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 0);
  assert.deepEqual(Array.from(position.array), paused, 'a paused demo must not keep simulating');
  let overshoot = 0;
  for (let i = 0; i < 240; i++) {
    avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 1 / 30);
    overshoot = Math.max(overshoot, position.getX(tip) - rest[tip * 3]);
  }
  assert.ok(overshoot > 0.015, 'free ends should swing past rest before settling, not simply lerp back');
  assert.ok(Math.abs(position.getX(tip) - rest[tip * 3]) < 1e-6, 'held poses must settle without endless fake wind');
  avatar.root.position.x = -100;
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 1 / 30);
  avatar.root.position.x = 300;
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 0, true);
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 1 / 30);
  assert.deepEqual(Array.from(position.array), rest, 'reacquisition must clear both deflection and stored velocity');
});

test('hair remains bounded through fast motion and long frames, while gravity responds to a held tilt', () => {
  const avatar = createAvatar();
  avatar.root.scale.setScalar(130);
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 0, true);
  const hair = avatar.head.getObjectByName('puppet-hair');
  const rest = hair.children.map(mesh => Array.from(mesh.geometry.getAttribute('position').array));
  for (let frame = 0; frame < 60; frame++) {
    avatar.root.position.set(Math.sin(frame * 2) * 500, Math.cos(frame * 3) * 300, 0);
    const rotation = new Quaternion().setFromEuler(new Euler(Math.sin(frame), Math.cos(frame), Math.sin(frame * 2)));
    avatar.update(rotation, NEUTRAL_EXPRESSION, frame % 2 ? 0.5 : 1 / 60);
    hair.children.forEach((mesh, lock) => {
      const position = mesh.geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) {
        const displacement = Math.hypot(
          (position.getX(i) - rest[lock][i * 3]) * mesh.scale.x,
          (position.getY(i) - rest[lock][i * 3 + 1]) * mesh.scale.y,
          (position.getZ(i) - rest[lock][i * 3 + 2]) * mesh.scale.z,
        );
        assert.ok(Number.isFinite(displacement) && displacement < 0.62, 'hair must never explode or stretch without bounds');
      }
    });
  }
  const tilt = new Quaternion().setFromEuler(new Euler(0, 0, 0.4));
  avatar.update(tilt, NEUTRAL_EXPRESSION, 0, true);
  for (let i = 0; i < 120; i++) avatar.update(tilt, NEUTRAL_EXPRESSION, 1 / 30);
  const back = hair.getObjectByName('back-hair');
  const position = back.geometry.getAttribute('position');
  let tip = 0;
  for (let i = 1; i < position.count; i++) if (position.getY(i) < position.getY(tip)) tip = i;
  assert.ok((position.getX(tip) - rest[0][tip * 3]) * back.scale.x < -0.1,
    'lower hair should droop toward world gravity rather than staying rigidly perpendicular to a tilted head');
});

test('eyelid gap detects actual closure through head turns without relying on blink confidence', () => {
  for (const rotation of [new Quaternion(), new Quaternion().setFromEuler(new Euler(0.3, 0.6, -0.3))]) {
    const eyes = readPuppetEyeClosure(eyeLandmarks(0.08, 0.25, rotation), { width: 1280, height: 720 });
    assert.ok(eyes.blinkLeft > 0.99);
    assert.ok(eyes.blinkRight < 0.01);
  }
  assert.throws(() => readPuppetEyeClosure({ faceLandmarks: [] }, { width: 1280, height: 720 }));
});

test('eyelid-driven winks reject squints, close promptly and reopen independently', () => {
  const avatar = createAvatar();
  const left = avatar.head.getObjectByName('eye-left');
  const right = avatar.head.getObjectByName('eye-right');
  const eyes = (leftGap, rightGap) => ({
    ...readPuppetExpression([{ categoryName: 'eyeBlinkLeft', score: 0.45 }]),
    ...readPuppetEyeClosure(eyeLandmarks(leftGap, rightGap), { width: 1280, height: 720 }),
  });
  for (const aperture of [0.3, 0.25, 0.2, 0.17]) {
    const partial = eyes(aperture, 0.25);
    for (let frame = 0; frame < 20; frame++) avatar.update(new Quaternion(), partial, 1 / 30);
    assert.equal(left.getObjectByName('closed-eye').visible, false, 'a held squint or partial blink must not become a wink');
  }
  avatar.update(new Quaternion(), eyes(0.08, 0.25), 1 / 30);
  assert.equal(left.getObjectByName('closed-eye').visible, true, 'closed eyelids must register on the first frame even with a modest blink score');
  assert.equal(left.getObjectByName('open-eye').visible, false, 'white, iris and pupil must disappear behind the closed lid');
  assert.equal(right.getObjectByName('open-eye').visible, true);
  for (const blinkLeft of [0.58, 0.5, 0.6, 0.52]) {
    avatar.update(new Quaternion(), { ...NEUTRAL_EXPRESSION, blinkLeft }, 1 / 30);
    assert.equal(left.getObjectByName('closed-eye').visible, true, 'a held wink should not flicker at the close threshold');
  }
  avatar.update(new Quaternion(), eyes(0.25, 0.08), 1 / 30);
  assert.equal(left.getObjectByName('open-eye').visible, true);
  assert.equal(right.getObjectByName('closed-eye').visible, true);
  avatar.update(new Quaternion(), { ...NEUTRAL_EXPRESSION, blinkLeft: 1, blinkRight: 1 }, 0, true);
  assert.equal(left.getObjectByName('closed-eye').visible, true);
  assert.equal(right.getObjectByName('closed-eye').visible, true);
  avatar.update(new Quaternion(), NEUTRAL_EXPRESSION, 0, true);
  for (const eye of [left, right]) {
    assert.equal(eye.getObjectByName('closed-eye').visible, false);
    assert.equal(eye.getObjectByName('open-eye').visible, true);
  }
});

