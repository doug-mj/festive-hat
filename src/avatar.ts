import * as THREE from 'three';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

export const AVATAR_BASE_Y = -200;

export function estimateAvatarPosition(
  result: FaceLandmarkerResult,
  rect: { x: number; y: number; width: number; height: number },
  outputWidth: number,
  outputHeight: number,
) {
  const left = result.faceLandmarks[0]?.[234];
  const right = result.faceLandmarks[0]?.[454];
  if (!left || !right) return undefined;
  return new THREE.Vector3(
    rect.x + (left.x + right.x) / 2 * rect.width - outputWidth / 2,
    AVATAR_BASE_Y + outputHeight / 2 - rect.y - (left.y + right.y) / 2 * rect.height,
    0,
  );
}

export interface PuppetExpression {
  blinkLeft: number;
  blinkRight: number;
  jaw: number;
  smile: number;
  brow: number;
  browLeft: number;
  browRight: number;
  frownLeft: number;
  frownRight: number;
}

export const NEUTRAL_EXPRESSION: Readonly<PuppetExpression> = {
  blinkLeft: 0, blinkRight: 0, jaw: 0, smile: 0, brow: 0,
  browLeft: 0, browRight: 0, frownLeft: 0, frownRight: 0,
};

export function readPuppetEyeClosure(
  result: Pick<FaceLandmarkerResult, 'faceLandmarks'>,
  rect: { width: number; height: number },
) {
  const landmarks = result.faceLandmarks[0];
  if (!landmarks) throw new Error('Cannot read eyelid closure without a tracked face.');
  const closure = (indices: readonly number[]) => {
    const [outer, inner, upperA, lowerA, upperB, lowerB] = indices.map(index => landmarks[index]);
    if (!outer || !inner || !upperA || !lowerA || !upperB || !lowerB) {
      throw new Error('Tracked face is missing the eyelid landmarks needed for blinking.');
    };
    const distance = (a: typeof outer, b: typeof outer) => Math.hypot(
      (a.x - b.x) * rect.width, (a.y - b.y) * rect.height, (a.z - b.z) * rect.width,
    );
    const width = distance(outer, inner);
    if (width <= 0) throw new Error('Tracked eye has no measurable width.');
    const aperture = (distance(upperA, lowerA) + distance(upperB, lowerB)) / (2 * width);
    return THREE.MathUtils.clamp((0.2 - aperture) / 0.1, 0, 1);
  }
  return {
    blinkLeft: closure([362, 263, 385, 380, 387, 373]),
    blinkRight: closure([33, 133, 160, 144, 158, 153]),
  };
}

export function readPuppetExpression(categories: readonly { categoryName: string; score: number }[]): PuppetExpression {
  const scores = new Map(categories.map(({ categoryName, score }) => [categoryName, score]));
  const score = (name: string) => THREE.MathUtils.clamp(scores.get(name) ?? 0, 0, 1);
  return {
    blinkLeft: score('eyeBlinkLeft'),
    blinkRight: score('eyeBlinkRight'),
    jaw: Math.min(1, Math.pow(score('jawOpen'), 0.6) * 1.7),
    smile: (score('mouthSmileLeft') + score('mouthSmileRight')) / 2,
    brow: score('browInnerUp'),
    browLeft: score('browOuterUpLeft'),
    browRight: score('browOuterUpRight'),
    frownLeft: score('browDownLeft'),
    frownRight: score('browDownRight'),
  };
}

export function createAvatar() {
  const root = new THREE.Group();
  root.name = 'personal-puppet';
  const head = new THREE.Group();
  head.name = 'puppet-head';
  head.position.y = 0.78;
  root.add(head);
  const hatMount = new THREE.Group();
  hatMount.name = 'puppet-hat-mount';
  hatMount.position.set(0, 0.87, -0.1);
  hatMount.scale.setScalar(0.88);
  head.add(hatMount);
  const neckSocket = new THREE.Object3D();
  neckSocket.name = 'head-neck-socket';
  neckSocket.position.set(0, -0.52, -0.1);
  head.add(neckSocket);
  const bodyPivot = new THREE.Group();
  bodyPivot.name = 'dangling-body';
  root.add(bodyPivot);
  const grain = new Uint8Array(128 * 128);
  for (let i = 0; i < grain.length; i++) {
    const noise = Math.sin(i * 127.1 + 31.7) * 43758.5453;
    grain[i] = Math.floor((noise - Math.floor(noise)) * 255);
  }
  const texture = new THREE.DataTexture(grain, 128, 128, THREE.RedFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const felt = (color: string) => new THREE.MeshStandardMaterial({
    color, roughness: 1, bumpMap: texture, bumpScale: 0.012,
  });
  const skin = felt('#d6a18b');
  const blush = felt('#cf8e7c');
  const hair = felt('#35251f');
  const hairLight = felt('#463028');
  const hairDark = felt('#291e1b');
  const green = felt('#234c42');
  const cream = felt('#ded3b6');
  const red = felt('#923b3b');
  const gold = felt('#b99b57');
  const white = felt('#ece3cf');
  const iris = felt('#6c7770');
  const pupil = felt('#161d1b');
  const mouthMaterial = felt('#492623');
  const sphereGeometry = new THREE.SphereGeometry(1, 32, 24);

  function oval(parent: THREE.Object3D, name: string, mat: THREE.Material,
    x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    const mesh = new THREE.Mesh(sphereGeometry, mat);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  }

  function strand(parent: THREE.Object3D, points: [number, number, number][], radius: number, mat: THREE.Material) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, radius, 6, false), mat);
    parent.add(mesh);
    return mesh;
  }

  const torso = new THREE.Group();
  torso.name = 'puppet-torso';
  torso.position.set(0, -0.3, 0.1);
  bodyPivot.add(torso);
  const coatProfile = [
    new THREE.Vector2(0, -5.5), new THREE.Vector2(0.95, -5.5), new THREE.Vector2(1.04, -3.3),
  ];
  for (let i = 0; i <= 16; i++) {
    const angle = i / 16 * Math.PI / 2;
    coatProfile.push(new THREE.Vector2(Math.cos(angle) * 1.18, -0.98 + Math.sin(angle) * 1.14));
  }
  const coat = new THREE.Mesh(new THREE.LatheGeometry(coatProfile, 48), green);
  coat.name = 'wool-coat';
  coat.position.z = -0.12;
  coat.scale.z = 0.48 / 1.18;
  torso.add(coat);
  for (const side of [-1, 1]) {
    const sleeve = oval(torso, 'sleeve', green, side * 0.97, -1.13, -0.06, 0.32, 0.83, 0.36);
    sleeve.rotation.z = side * 0.14;
    const lapel = oval(torso, 'coat-facing', red, side * 0.27, -0.78, 0.35, 0.15, 0.79, 0.08);
    lapel.rotation.z = side * -0.16;
  }
  oval(torso, 'shirt', cream, 0, -0.42, 0.36, 0.3, 0.49, 0.09);
  oval(torso, 'neck', skin, 0, 0.03, 0, 0.25, 0.4, 0.25);
  for (const side of [-1, 1]) {
    const collar = oval(torso, 'knitted-collar', cream, side * 0.32, -0.14, 0.32, 0.32, 0.13, 0.14);
    collar.rotation.z = side * 0.36;
    oval(torso, 'bow-tie', red, side * 0.13, -0.36, 0.49, 0.15, 0.1, 0.07);
  }
  oval(torso, 'bow-knot', red, 0, -0.36, 0.52, 0.07, 0.08, 0.06);
  for (let i = 0; i < 3; i++) {
    oval(torso, 'brass-button', gold, 0, -0.78 - i * 0.39, 0.38, 0.055, 0.055, 0.035);
  }
  // Fine stitches read as fabric without downloading or sampling any image textures.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 20; i++) {
      strand(torso, [
        [side * 0.71 - 0.025, -0.56 - i * 0.061, 0.265],
        [side * 0.71, -0.58 - i * 0.061, 0.278],
        [side * 0.71 + 0.025, -0.56 - i * 0.061, 0.265],
      ], 0.006, hairLight);
    }
  }

  const hairVolume = new THREE.Group();
  hairVolume.name = 'puppet-hair';
  head.add(hairVolume);
  const hairLocks: {
    mesh: THREE.Mesh;
    rest: Float32Array;
    weights: Float32Array;
    tip: THREE.Vector3;
    offset: THREE.Vector3;
    velocity: THREE.Vector3;
    stiffness: number;
  }[] = [];
  function flexibleHair(mesh: THREE.Mesh, tip: THREE.Vector3, stiffness: number) {
    const position = mesh.geometry.getAttribute('position');
    if (position instanceof THREE.BufferAttribute) position.setUsage(THREE.DynamicDrawUsage);
    const weights = new Float32Array(position.count);
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i) * mesh.scale.y + mesh.position.y;
      weights[i] = THREE.MathUtils.clamp((0.35 - y) / 1.95, 0, 1) ** 2;
    }
    hairLocks.push({
      mesh, rest: new Float32Array(position.array), weights, tip,
      offset: new THREE.Vector3(), velocity: new THREE.Vector3(), stiffness,
    });
  }
  const backHair = oval(hairVolume, 'back-hair', hairDark, 0, -0.46, -0.32, 0.99, 1.38, 0.66);
  backHair.geometry = backHair.geometry.clone();
  flexibleHair(backHair, new THREE.Vector3(0, -1.7, -0.32), 48);
  oval(head, 'face', skin, 0, 0.17, 0, 0.65, 0.81, 0.57);
  for (const side of [-1, 1]) {
    oval(head, 'ear', skin, side * 0.65, 0.02, 0.01, 0.14, 0.22, 0.12);
    oval(head, 'ear-inset', blush, side * 0.69, 0.02, 0.1, 0.066, 0.12, 0.035);
    oval(head, 'cheek', blush, side * 0.4, -0.07, 0.46, 0.17, 0.12, 0.07);
  }

  // A parted crown and layered wavy locks keep the silhouette recognizably long-haired.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const lock = strand(hairVolume, [
        [side * (0.03 + t * 0.13), 0.91 - t * 0.03, 0.08 - t * 0.53],
        [side * (0.46 + t * 0.2), 0.72, 0.35 - t * 0.8],
        [side * (0.79 + t * 0.12), 0.23, 0.24 - t * 0.86],
        [side * (0.85 + Math.sin(i * 2) * 0.07), -0.12, 0.17 - t * 0.84],
        [side * (0.86 + Math.sin(i * 2 + 1) * 0.09), -0.49, 0.2 - t * 0.84],
        [side * (0.92 + Math.sin(i * 2) * 0.08), -0.94, 0.1 - t * 0.8],
        [side * (0.86 + Math.sin(i * 2 + 1) * 0.09), -1.28, 0.16 - t * 0.8],
        [side * (0.88 + Math.sin(i * 3) * 0.1), -1.58 - t * 0.13, 0.12 - t * 0.76],
      ], 0.1 + (i % 3) * 0.008, i % 3 === 0 ? hairLight : hair);
      lock.name = 'flowing-hair-lock';
      flexibleHair(lock, new THREE.Vector3(
        side * (0.88 + Math.sin(i * 3) * 0.1), -1.58 - t * 0.13, 0.12 - t * 0.76,
      ), 32 + (i % 5) * 5);
    }
  }

  const eyes: { open: THREE.Group; closed: THREE.Mesh; isClosed: boolean }[] = [];
  const brows: THREE.Mesh[] = [];
  const lidMaterial = new THREE.MeshBasicMaterial({ color: '#141214' });
  lidMaterial.userData.outlineParameters = { visible: false };
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.name = side < 0 ? 'eye-right' : 'eye-left';
    eye.position.set(side * 0.255, 0.29, 0.512);
    head.add(eye);
    const open = new THREE.Group();
    open.name = 'open-eye';
    eye.add(open);
    oval(open, 'eye-white', white, 0, 0, 0, 0.16, 0.091, 0.047);
    oval(open, 'iris', iris, -side * 0.012, -0.005, 0.041, 0.064, 0.07, 0.018);
    oval(open, 'pupil', pupil, -side * 0.012, -0.005, 0.058, 0.031, 0.044, 0.009);
    oval(open, 'eye-glint', white, -0.022, 0.021, 0.067, 0.012, 0.013, 0.005);
    const closed = strand(eye, [[-0.14, 0.004, 0.06], [0, -0.018, 0.068], [0.14, 0.004, 0.06]], 0.012, lidMaterial);
    closed.name = 'closed-eye';
    closed.visible = false;
    eyes.push({ open, closed, isClosed: false });
    const brow = oval(head, 'eyebrow', hair, side * 0.26, 0.46, 0.53, 0.18, 0.038, 0.038);
    brow.rotation.z = side * -0.09;
    brows.push(brow);
  }
  oval(head, 'nose-bridge', skin, 0, 0.12, 0.56, 0.1, 0.2, 0.13);
  oval(head, 'nose', skin, 0, -0.015, 0.68, 0.145, 0.125, 0.155);
  for (const side of [-1, 1]) {
    oval(head, 'nostril', blush, side * 0.083, -0.084, 0.758, 0.025, 0.016, 0.012);
    const sideBeard = oval(head, 'side-beard', hair, side * 0.52, -0.44, 0.34, 0.2, 0.4, 0.22);
    sideBeard.rotation.z = -side * 0.37;
  }
  const jaw = new THREE.Group();
  jaw.name = 'bearded-jaw';
  head.add(jaw);
  oval(jaw, 'beard-base', hair, 0, -0.71, 0.32, 0.62, 0.48, 0.38);
  const mouth = oval(head, 'mouth', mouthMaterial, 0, -0.3, 0.653, 0.18, 0.025, 0.025);
  const lip = oval(jaw, 'lower-lip', blush, 0, -0.35, 0.665, 0.15, 0.033, 0.025);
  const teeth = oval(head, 'upper-teeth', white, 0, -0.292, 0.675, 0.12, 0.023, 0.009);
  teeth.visible = false;
  for (const side of [-1, 1]) {
    const moustache = oval(head, 'moustache', hairLight, side * 0.155, -0.19, 0.647, 0.2, 0.085, 0.09);
    moustache.rotation.z = side * -0.17;
  }
  for (let i = 0; i < 33; i++) {
    const x = (i / 32 - 0.5) * 1.03;
    const edge = Math.abs(x) / 0.515;
    const points: [number, number, number][] = [
      [x, -0.4 - (1 - edge) * 0.05, 0],
      [x + Math.sin(i * 2) * 0.025, -0.67, 0],
      [x * 0.92, -0.94 + edge * 0.06, 0],
      [x * 0.78, -1.13 + edge * 0.18 + Math.sin(i * 1.7) * 0.02, 0],
    ];
    for (const point of points) {
      point[2] = 0.325 + Math.sqrt(Math.max(0, 1 - (point[0] / 0.62) ** 2
        - ((point[1] + 0.71) / 0.48) ** 2)) * 0.38;
    }
    strand(jaw, points, 0.022 + (i % 3) * 0.003, i % 4 === 0 ? hairLight : hair);
  }

  const expression = { ...NEUTRAL_EXPRESSION };
  const rotation = new THREE.Euler();
  const safeQuaternion = new THREE.Quaternion();
  const bodyAngles = new THREE.Vector3();
  const bodyVelocity = new THREE.Vector3();
  const bodyTarget = new THREE.Vector3();
  const bodyRotation = new THREE.Euler(0, 0, 0, 'YXZ');
  const previousPosition = new THREE.Vector3();
  const previousHeadQuaternion = new THREE.Quaternion();
  const inverseHeadQuaternion = new THREE.Quaternion();
  const hairRotationDelta = new THREE.Quaternion();
  const hairTranslation = new THREE.Vector3();
  const hairGravity = new THREE.Vector3();
  const hairPoint = new THREE.Vector3();

  function updateHair(delta: number, snap: boolean) {
    const duration = THREE.MathUtils.clamp(delta, 0, 0.1);
    inverseHeadQuaternion.copy(head.quaternion).invert();
    hairRotationDelta.copy(inverseHeadQuaternion).multiply(previousHeadQuaternion);
    hairTranslation.copy(previousPosition).sub(root.position).divide(root.scale).applyQuaternion(inverseHeadQuaternion);
    hairGravity.set(0, -1, 0).applyQuaternion(inverseHeadQuaternion);
    hairGravity.y += 1;
    hairGravity.multiplyScalar(0.45);
    const steps = Math.max(1, Math.ceil(duration * 120));
    const step = duration / steps;
    for (const lock of hairLocks) {
      if (snap) {
        lock.offset.set(0, 0, 0);
        lock.velocity.set(0, 0, 0);
      } else if (duration > 0) {
        // Keep the free ends inertial as the head moves, then spring back toward the styled shape.
        hairPoint.copy(lock.tip).add(lock.offset).applyQuaternion(hairRotationDelta).add(hairTranslation);
        lock.offset.copy(hairPoint).sub(lock.tip);
        lock.velocity.applyQuaternion(hairRotationDelta);
        const damping = 2 * Math.sqrt(lock.stiffness) * 0.48;
        for (let i = 0; i < steps; i++) {
          for (const axis of ['x', 'y', 'z'] as const) {
            lock.velocity[axis] += ((hairGravity[axis] - lock.offset[axis]) * lock.stiffness
              - lock.velocity[axis] * damping) * step;
            lock.offset[axis] += lock.velocity[axis] * step;
            const limit = axis === 'y' ? 0.14 : axis === 'x' ? 0.38 : 0.32;
            if (Math.abs(lock.offset[axis]) > limit) {
              lock.offset[axis] = Math.sign(lock.offset[axis]) * limit;
              lock.velocity[axis] = 0;
            }
          }
        }
      }
      const position = lock.mesh.geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) {
        const weight = lock.weights[i]!;
        position.setXYZ(i,
          lock.rest[i * 3]! + lock.offset.x * weight / lock.mesh.scale.x,
          lock.rest[i * 3 + 1]! + lock.offset.y * weight / lock.mesh.scale.y,
          lock.rest[i * 3 + 2]! + lock.offset.z * weight / lock.mesh.scale.z);
      }
      position.needsUpdate = true;
      lock.mesh.geometry.computeVertexNormals();
      lock.mesh.geometry.computeBoundingSphere();
      lock.mesh.geometry.computeBoundingBox();
    }
    previousHeadQuaternion.copy(head.quaternion);
  }

  function update(quaternion: THREE.Quaternion, next: Readonly<PuppetExpression>, delta: number, snap = false) {
    const smoothing = snap ? 1 : 1 - Math.exp(-Math.max(0, delta) * 18);
    rotation.setFromQuaternion(quaternion, 'YXZ');
    rotation.x = THREE.MathUtils.clamp(rotation.x, -0.6, 0.6);
    rotation.y = THREE.MathUtils.clamp(rotation.y, -1.05, 1.05);
    rotation.z = THREE.MathUtils.clamp(rotation.z, -0.5, 0.5);
    safeQuaternion.setFromEuler(rotation);
    head.quaternion.slerp(safeQuaternion, smoothing);
    // Both parts share this moving neck joint; only the hanging body's rotation lags.
    bodyPivot.position.copy(neckSocket.position).applyQuaternion(head.quaternion).add(head.position);
    rotation.setFromQuaternion(head.quaternion, 'YXZ');
    bodyTarget.set(rotation.x * 0.25, rotation.y * 0.32, rotation.z * 0.42);
    if (snap) {
      bodyAngles.copy(bodyTarget);
      bodyVelocity.set(0, 0, 0);
    } else {
      bodyVelocity.z -= (root.position.x - previousPosition.x) / root.scale.x * 2.5;
      const duration = THREE.MathUtils.clamp(delta, 0, 0.1);
      const steps = Math.max(1, Math.ceil(duration * 120));
      const step = duration / steps;
      for (let i = 0; i < steps; i++) {
        for (const axis of ['x', 'y', 'z'] as const) {
          bodyVelocity[axis] += ((bodyTarget[axis] - bodyAngles[axis]) * 42 - bodyVelocity[axis] * 7) * step;
          bodyAngles[axis] += bodyVelocity[axis] * step;
        }
      }
    }
    updateHair(delta, snap);
    previousPosition.copy(root.position);
    bodyRotation.set(bodyAngles.x, bodyAngles.y, bodyAngles.z, 'YXZ');
    bodyPivot.quaternion.setFromEuler(bodyRotation);
    for (const key of Object.keys(expression) as (keyof PuppetExpression)[]) {
      const blink = key === 'blinkLeft' || key === 'blinkRight';
      const rate = blink ? 60 : 32;
      const response = (blink || key === 'jaw') && !snap ? 1 - Math.exp(-Math.max(0, delta) * rate) : smoothing;
      expression[key] = THREE.MathUtils.lerp(expression[key], THREE.MathUtils.clamp(next[key], 0, 1), response);
    }
    // MediaPipe's left/right labels refer to the wearer, not the viewer.
    eyes.forEach((eye, i) => {
      const blink = i === 0 ? expression.blinkRight : expression.blinkLeft;
      // Separate close/reopen thresholds prevent a held wink flickering at the boundary.
      if (snap || blink >= 0.65 || blink <= 0.35) eye.isClosed = blink >= 0.65;
      eye.open.visible = !eye.isClosed;
      eye.open.scale.y = Math.max(0.15, 1 - blink);
      eye.closed.visible = eye.isClosed;
    });
    brows.forEach((brow, i) => {
      const side = i === 0 ? -1 : 1;
      const outer = i === 0 ? expression.browRight : expression.browLeft;
      const down = i === 0 ? expression.frownRight : expression.frownLeft;
      brow.position.y = 0.46 + expression.brow * 0.14 + outer * 0.18 - down * 0.1;
      brow.rotation.z = side * (-0.09 - expression.brow * 0.22 + outer * 0.32 + down * 0.25);
    });
    mouth.scale.y = 0.025 + expression.jaw * 0.15;
    mouth.scale.x = 0.18 + expression.smile * 0.06;
    mouth.position.y = -0.3 - expression.jaw * 0.045;
    jaw.position.y = -expression.jaw * 0.11;
    lip.position.y = -0.35 - expression.jaw * 0.09;
    teeth.visible = expression.jaw > 0.13 || expression.smile > 0.35;
  }

  update(new THREE.Quaternion(), NEUTRAL_EXPRESSION, 0, true);
  return { root, head, hatMount, update };
}
