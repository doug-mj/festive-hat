import * as THREE from 'three';

function material(color: string, metalness = 0, emissive?: string) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness: metalness ? 0.3 : 0.75,
    ...(emissive ? { emissive, emissiveIntensity: 0.8 } : {}),
  });
}

function sphere(parent: THREE.Object3D, radius: number, mat: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function box(parent: THREE.Object3D, size: [number, number, number], mat: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function tube(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, mat: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(32, points.length * 3), radius, 6, false), mat);
  parent.add(mesh);
  return mesh;
}

function starShape() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 === 0 ? 0.18 : 0.08;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function createHat() {
  const root = new THREE.Group();
  const cap = new THREE.Group();
  cap.name = 'tree-cap';
  root.add(cap);
  const green = material('#116248');
  const greenLight = material('#197956');
  const red = material('#c52f43');
  const gold = material('#f4c86b', 0.65);
  const snow = material('#fff4df');
  const skin = material('#efb99b');
  const brown = material('#92512f');
  const hoofMaterial = material('#432e27');
  const blackNose = material('#17181a');
  const glow = material('#ffe1a0', 0.2, '#ffc65a');

  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.76, 2.05, 64), green);
  cone.position.y = 1.025;
  cap.add(cone);
  for (const [radius, height, y] of [[0.79, 0.43, 0.29], [0.61, 0.43, 0.83], [0.41, 0.43, 1.37]] as const) {
    const tier = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 48, 1, true), greenLight);
    tier.position.y = y;
    cap.add(tier);
  }
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.77, 0.8, 0.16, 64), red);
  band.position.y = 0.04;
  cap.add(band);
  const fur = new THREE.MeshStandardMaterial({
    color: '#c8c6c1',
    roughness: 1,
    emissive: '#fffaf2',
    emissiveIntensity: 0.55,
  });
  const fluffyBrim = new THREE.Group();
  fluffyBrim.name = 'fluffy-brim';
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.13, 16, 80), fur);
  brim.name = 'brim-core';
  brim.rotation.x = Math.PI / 2;
  fluffyBrim.add(brim);
  const puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 16), fur, 84);
  puffs.name = 'fur-puffs';
  const tuft = new THREE.Object3D();
  const variation = (seed: number) => 0.5 + Math.sin(seed * 127.1 + 31.7) * 0.5;
  const scatter = (seed: number) => {
    const value = Math.sin(seed * 91.7 + 47.3) * 43758.5453;
    return (value - Math.floor(value)) * 2 - 1;
  };
  for (let i = 0; i < puffs.count; i++) {
    const row = i % 3;
    const angle = (Math.floor(i / 3) + row * 0.43 + scatter(i) * 0.45) * Math.PI * 2 / 28;
    const crossAngle = row * Math.PI * 2 / 3 + scatter(i + 100) * 0.8;
    const tubeRadius = 0.12 + scatter(i + 200) * 0.03;
    const radius = 0.82 + Math.cos(crossAngle) * tubeRadius;
    tuft.position.set(Math.cos(angle) * radius,
      Math.sin(crossAngle) * tubeRadius + scatter(i + 300) * 0.035,
      Math.sin(angle) * radius);
    tuft.scale.setScalar((0.075 + variation(i + 20) * 0.025) * 1.5);
    tuft.updateMatrix();
    puffs.setMatrixAt(i, tuft.matrix);
  }
  fluffyBrim.add(puffs);
  cap.add(fluffyBrim);
  const garland: THREE.Vector3[] = [];
  for (let i = 0; i <= 160; i++) {
    const t = i / 160;
    const y = 0.2 + t * 1.65;
    const r = 0.79 * (1 - y / 2.15);
    const a = t * Math.PI * 2 * 3.4;
    garland.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  tube(cap, garland, 0.022, gold);
  const bulbs: THREE.Mesh[] = [];
  for (let i = 0; i < 28; i++) {
    const t = i / 28;
    const y = 0.22 + t * 1.58;
    const a = t * Math.PI * 2 * 3.4;
    const r = 0.8 * (1 - y / 2.15);
    bulbs.push(sphere(cap, i % 3 === 0 ? 0.068 : 0.043, i % 3 === 0 ? red : glow,
      Math.cos(a) * r, y, Math.sin(a) * r));
  }
  const topper = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(), {
    depth: 0.055, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, steps: 1,
  }), gold);
  topper.position.set(0, 2.14, 0);
  cap.add(topper);

  const flightTeam = new THREE.Group();
  flightTeam.name = 'santa-flight';
  root.add(flightTeam);
  const sleigh = new THREE.Group();
  sleigh.name = 'sleigh';
  flightTeam.add(sleigh);
  box(sleigh, [0.49, 0.14, 0.28], red, 0, 0, 0);
  box(sleigh, [0.09, 0.27, 0.28], red, -0.22, 0.1, 0);
  for (const z of [-0.17, 0.17]) {
    tube(sleigh, [
      new THREE.Vector3(-0.3, -0.13, z), new THREE.Vector3(0.23, -0.13, z),
      new THREE.Vector3(0.37, -0.04, z), new THREE.Vector3(0.32, 0.025, z),
    ], 0.018, gold);
    box(sleigh, [0.025, 0.1, 0.025], gold, -0.15, -0.06, z);
    box(sleigh, [0.025, 0.1, 0.025], gold, 0.15, -0.06, z);
  }
  sphere(sleigh, 0.14, red, -0.04, 0.2, 0).scale.set(0.85, 1, 0.85);
  sphere(sleigh, 0.105, skin, -0.02, 0.39, 0);
  sphere(sleigh, 0.085, snow, 0.055, 0.35, 0).scale.set(0.6, 1, 1);
  const santaHat = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.23, 16), red);
  santaHat.position.set(-0.035, 0.54, 0);
  santaHat.rotation.z = 0.25;
  sleigh.add(santaHat);
  sphere(sleigh, 0.04, snow, -0.063, 0.65, 0);
  sphere(sleigh, 0.14, gold, -0.23, 0.22, -0.025);
  const legs: { hip: THREE.Group; knee: THREE.Group; phase: number; rest: number }[] = [];
  const reindeer: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const deer = new THREE.Group();
    deer.name = i === 2 ? 'rudolph' : `reindeer-${i + 1}`;
    sphere(deer, 0.13, brown, 0, 0.14, 0).scale.set(1.4, 0.7, 0.65);
    sphere(deer, 0.075, brown, 0.15, 0.27, 0);
    const nose = sphere(deer, 0.026, i === 2 ? red : blackNose, 0.22, 0.27, 0);
    nose.name = `${deer.name}-nose`;
    for (const z of [-0.055, 0.055]) {
      tube(deer, [
        new THREE.Vector3(0.11, 0.3, z), new THREE.Vector3(0.09, 0.43, z * 1.5),
        new THREE.Vector3(0.03, 0.46, z * 1.5),
      ], 0.012, gold);
      for (const x of [-0.08, 0.07]) {
        const front = x > 0;
        const hip = new THREE.Group();
        hip.name = `${deer.name}-${front ? 'front' : 'rear'}-${z > 0 ? 'near' : 'far'}`;
        hip.position.set(x, 0.12, z);
        box(hip, [0.026, 0.105, 0.026], brown, 0, -0.0525, 0);
        const knee = new THREE.Group();
        knee.position.y = -0.105;
        box(knee, [0.023, 0.1, 0.023], brown, 0, -0.05, 0);
        const hoof = box(knee, [0.042, 0.03, 0.04], hoofMaterial, 0.009, -0.1, 0);
        hoof.name = 'hoof';
        hip.add(knee);
        deer.add(hip);
        legs.push({
          hip, knee,
          phase: i * 0.8 + (front ? 0 : Math.PI / 2) + (z > 0 ? 0 : Math.PI),
          rest: front ? 0.25 : -0.4,
        });
      }
    }
    reindeer.push(deer);
    flightTeam.add(deer);
  }
  const reinSegments = 48;
  const reins = [-1, 1].map((side) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((reinSegments + 1) * 3), 3));
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#f4c86b' }));
    line.name = `team-rein-${side}`;
    flightTeam.add(line);
    return { side, line };
  });
  const worldUp = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3();
  const inward = new THREE.Vector3();
  const trackUp = new THREE.Vector3();
  const orientation = new THREE.Matrix4();
  const bankRotation = new THREE.Quaternion();
  const localForward = new THREE.Vector3(1, 0, 0);
  const harnessSample = new THREE.Object3D();
  const attachment = new THREE.Vector3();
  const vehicleScale = 0.85;

  function followTrack(object: THREE.Object3D, angle: number, size: number, bank: number) {
    const radius = 1.32 * size;
    const hillHeight = 0.3 * size;
    object.position.set(Math.cos(angle) * radius,
      0.94 * size + Math.sin(angle * 2) * hillHeight, Math.sin(angle) * radius);
    forward.set(-Math.sin(angle) * radius, Math.cos(angle * 2) * hillHeight * 2,
      Math.cos(angle) * radius).normalize();
    inward.crossVectors(forward, worldUp).normalize();
    trackUp.crossVectors(inward, forward).normalize();
    orientation.makeBasis(forward, trackUp, inward);
    object.quaternion.setFromRotationMatrix(orientation);
    bankRotation.setFromAxisAngle(localForward, bank);
    object.quaternion.multiply(bankRotation);
    object.scale.setScalar(vehicleScale);
  }

  const moonShape = new THREE.Shape();
  // Two intersecting arcs make an actual crescent, not a disk with a dark overlay.
  moonShape.absarc(0, 0, 0.28, Math.PI / 3, 5 * Math.PI / 3, false);
  moonShape.absarc(0.19, 0, Math.sqrt(0.19 ** 2 + 0.28 ** 2 - 2 * 0.19 * 0.28 * 0.5),
    Math.atan2(-0.28 * Math.sin(Math.PI / 3), 0.14 - 0.19),
    Math.atan2(0.28 * Math.sin(Math.PI / 3), 0.14 - 0.19), true);
  moonShape.closePath();
  const moon = new THREE.Mesh(new THREE.ExtrudeGeometry(moonShape, {
    depth: 0.065, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, steps: 1,
  }), glow);
  moon.position.set(0.97, 2.48, 0);
  moon.rotation.z = -0.22;
  root.add(moon);
  const sparkles = new THREE.Group();
  for (const [x, y, size] of [[0.6, 2.6, 0.24], [1.32, 2.23, 0.18], [-0.43, 2.32, 0.16]] as const) {
    const sparkle = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(), {
      depth: 0.02, bevelEnabled: false,
    }), glow);
    sparkle.position.set(x, y, 0);
    sparkle.scale.setScalar(size);
    sparkles.add(sparkle);
  }
  root.add(sparkles);

  // Approximate head depth: hides the sleigh behind the wearer without painting over video.
  const occluder = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24),
    new THREE.MeshBasicMaterial({ colorWrite: false }));
  occluder.scale.set(0.72, 0.94, 0.62);
  occluder.position.set(0, -0.84, -0.08);
  occluder.renderOrder = -1;
  root.add(occluder);

  return {
    root,
    occluder,
    flightTeam,
    moon,
    update(time: number, angle: number, size: number) {
      cap.scale.setScalar(size);
      const radius = 1.32 * size;
      const leadDistance = 0.6 + (reindeer.length - 1) * 0.5;
      followTrack(sleigh, angle, size, 0.06);
      reindeer.forEach((deer, i) => followTrack(deer, angle + (0.6 + i * 0.5) / radius, size, 0.12));
      for (let i = 0; i <= reinSegments; i++) {
        const distance = 0.22 * vehicleScale + (leadDistance - 0.22 * vehicleScale) * i / reinSegments;
        followTrack(harnessSample, angle + distance / radius, size, 0.12);
        for (const { side, line } of reins) {
          attachment.set(0, 0.14, side * 0.11).applyQuaternion(harnessSample.quaternion)
            .multiplyScalar(vehicleScale).add(harnessSample.position);
          line.geometry.getAttribute('position').setXYZ(i, attachment.x, attachment.y, attachment.z);
        }
      }
      for (const { line } of reins) {
        line.geometry.getAttribute('position').needsUpdate = true;
        line.geometry.computeBoundingSphere();
      }
      for (const leg of legs) {
        const cycle = time * 8 + leg.phase;
        leg.hip.rotation.z = leg.rest + Math.sin(cycle) * 0.7;
        leg.knee.rotation.z = 0.4 + Math.sin(cycle + 0.9) * 0.35;
      }
      moon.scale.setScalar(0.85);
      moon.position.set(0.97 * size, (2.48 + Math.sin(time * 0.8) * 0.055) * size, 0);
      sparkles.scale.setScalar(size);
      topper.rotation.y = time * 0.35;
      bulbs.forEach((bulb, i) => bulb.scale.setScalar(0.9 + Math.sin(time * 2 + i * 1.8) * 0.13));
    },
  };
}
