import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import wasmLoader from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinary from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import { createHat } from './hat';
import { createSnowfall } from './snow';
import { AVATAR_BASE_Y, createAvatar, estimateAvatarPosition, NEUTRAL_EXPRESSION, readPuppetExpression, readPuppetEyeClosure } from './avatar';
import { DEFAULT_FIT, FIT_STORAGE_KEY, LEGACY_FIT_STORAGE_KEY, estimateCrownPose, migrateLegacyFit, parseFit } from './fit';
import type { HeadFit } from './fit';
import './style.css';

document.body.innerHTML = `
  <main aria-label="Meeting camera effect">
    <div class="toolbar">
      <label for="effect-mode">Camera effect
        <select id="effect-mode">
          <option value="hat">Hat Filter (Webcam)</option>
          <option value="avatar">Doug Avatar</option>
          <option value="allison">Allison Avatar</option>
        </select>
      </label>
      <button class="primary" id="start">Start camera</button>
      <button id="stop" hidden>Stop camera</button>
      <button id="clean" title="Press Escape to exit clean output">Clean output</button>
    </div>
    <section class="stage" aria-label="Camera preview">
      <canvas id="output" width="1280" height="720" tabindex="-1" aria-label="Festive camera output"></canvas>
    </section>
    <p id="status" role="status" aria-live="polite">Camera is off.</p>
    <div class="error" id="error" role="alert" hidden></div>
  </main>
  <button class="output-exit" id="exit-clean">Exit clean output</button>
`;

function element<T extends HTMLElement>(id: string, ctor: { new(): T }): T {
  const el = document.getElementById(id);
  if (!(el instanceof ctor)) throw new Error(`Missing interface element: ${id}`);
  return el;
}

const canvas = element('output', HTMLCanvasElement);
const context = canvas.getContext('2d');
if (!context) throw new Error('This browser does not support a 2D canvas.');
const ctx = context;
const startButton = element('start', HTMLButtonElement);
const stopButton = element('stop', HTMLButtonElement);
const status = element('status', HTMLParagraphElement);
const errorBox = element('error', HTMLDivElement);
const effectMode = element('effect-mode', HTMLSelectElement);
const video = document.createElement('video');
video.muted = true;
video.playsInline = true;
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const snowfall = createSnowfall(WIDTH, HEIGHT);

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
} catch (error) {
  errorBox.hidden = false;
  errorBox.textContent = '3D rendering could not start. Enable graphics acceleration in Chrome and reload this page.';
  startButton.disabled = true;
  throw error;
}
renderer.setSize(WIDTH, HEIGHT);
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, 0.1, 4000);
camera.position.z = 2000;
scene.add(new THREE.HemisphereLight('#fff8e4', '#477b74', 2.6));
const keyLight = new THREE.DirectionalLight('#fff2d6', 3.2);
keyLight.position.set(-300, 600, 900);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight('#afdfe6', 2);
rimLight.position.set(450, 200, -500);
scene.add(rimLight);
const hat = createHat();
scene.add(hat.root);
const puppets = {
  avatar: { avatar: createAvatar(), hat: createHat() },
  allison: { avatar: createAvatar('allison'), hat: createHat() },
};
let avatar = puppets.avatar.avatar;
let avatarHat = puppets.avatar.hat;
const outlineEffect = new OutlineEffect(renderer, {
  defaultThickness: 0.0025,
  defaultColor: new THREE.Color('#29212b').toArray(),
});
for (const puppet of Object.values(puppets)) {
  puppet.avatar.root.position.set(0, AVATAR_BASE_Y, 0);
  puppet.avatar.root.scale.setScalar(130);
  puppet.avatar.update(puppet.avatar.head.quaternion, NEUTRAL_EXPRESSION, 0, true);
  puppet.avatar.root.visible = false;
  scene.add(puppet.avatar.root);
  puppet.hat.occluder.visible = false;
  puppet.avatar.hatMount.add(puppet.hat.root);
  puppet.avatar.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      // Keep the soft instanced fur and invisible head-depth masks out of the ink pass.
      if (!material.colorWrite || object instanceof THREE.InstancedMesh) {
        material.userData.outlineParameters = { visible: false };
      }
    }
  });
}
let avatarMode = false;
let puppetExpression = { ...NEUTRAL_EXPRESSION };
const puppetDemoQuaternion = new THREE.Quaternion();
const puppetDemoRotation = new THREE.Euler();

let stream: MediaStream | undefined;
let tracker: FaceLandmarker | undefined;
let loading = false;
let cancelled = false;
const paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let clean = false;
let hasPose = false;
let lastVideoTime = -1;
let lastInference = 0;
let previousFrame = performance.now();
let animationTime = 0;
let orbitPhase = 0;
let previousAnimationTime = 0;
const targetPosition = new THREE.Vector3();
const targetAvatarPosition = new THREE.Vector3(0, AVATAR_BASE_Y, 0);
const targetQuaternion = new THREE.Quaternion();
let targetScale = 1;
let fit: HeadFit = { ...DEFAULT_FIT };
let facePresent = false;
const demoBackground = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
demoBackground.addColorStop(0, '#294844');
demoBackground.addColorStop(0.6, '#183633');
demoBackground.addColorStop(1, '#112725');

function showError(message: string, error: unknown) {
  console.error(message, error);
  if (clean) setClean(false);
  errorBox.textContent = message;
  errorBox.hidden = false;
}

try {
  const saved = localStorage.getItem(FIT_STORAGE_KEY);
  if (saved !== null) {
    fit = parseFit(saved);
  } else {
    const legacy = localStorage.getItem(LEGACY_FIT_STORAGE_KEY);
    if (legacy !== null) {
      fit = migrateLegacyFit(legacy);
    }
  }
} catch (error) {
  showError('Saved hat fit could not be loaded. Using the default fit.', error);
}
effectMode.addEventListener('change', () => {
  avatar.root.visible = false;
  const selected = effectMode.value === 'allison' ? puppets.allison : puppets.avatar;
  selected.avatar.root.position.copy(avatar.root.position);
  avatar = selected.avatar;
  avatarHat = selected.hat;
  avatarMode = effectMode.value !== 'hat';
  avatar.update(targetQuaternion, puppetExpression, 0, true);
  status.textContent = stream
    ? 'Effect changed. Look at the camera to animate it.'
    : `Camera is off. Showing the ${avatarMode ? 'puppet' : 'hat'} demo.`;
});

function setClean(value: boolean) {
  clean = value;
  document.body.classList.toggle('clean', value);
  if (value) canvas.focus({ preventScroll: true });
  else element('clean', HTMLButtonElement).focus({ preventScroll: true });
}
element('clean', HTMLButtonElement).addEventListener('click', () => setClean(true));
element('exit-clean', HTMLButtonElement).addEventListener('click', () => setClean(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && clean) setClean(false);
});

async function loadTracker() {
  if (tracker) return tracker;
  status.textContent = 'Loading face tracking model. The first launch needs an internet connection...';
  // Bundle matching WASM files with the app instead of loading executable code from a CDN.
  const fileset = await FilesetResolver.isSimdSupported();
  if (!fileset) throw new Error('Face tracking requires a browser with WebAssembly SIMD support. Use an up-to-date Chrome.');
  tracker = await FaceLandmarker.createFromOptions(
    { wasmLoaderPath: wasmLoader, wasmBinaryPath: wasmBinary },
    {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFacialTransformationMatrixes: true,
      outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
      minFacePresenceConfidence: 0.6,
    },
  );
  return tracker;
}

function stopCamera() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
  video.srcObject = null;
  hasPose = false;
  facePresent = false;
  puppetExpression = { ...NEUTRAL_EXPRESSION };
  lastVideoTime = -1;
  startButton.hidden = false;
  stopButton.hidden = true;
  status.textContent = `Camera stopped. Showing the demo ${avatarMode ? 'puppet' : 'hat'}.`;
}

async function startCamera() {
  if (loading) return;
  loading = true;
  cancelled = false;
  errorBox.hidden = true;
  startButton.disabled = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access requires localhost or HTTPS and a supported browser.');
    }
    stopCamera();
    await loadTracker();
    if (cancelled) return;
    status.textContent = 'Waiting for camera permission...';
    const nextStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: WIDTH }, height: { ideal: HEIGHT },
        frameRate: { ideal: 30, max: 30 },
        facingMode: 'user',
      },
      audio: false,
    });
    if (cancelled) {
      nextStream.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = nextStream;
    if (/OBS Virtual Camera/i.test(nextStream.getVideoTracks()[0]?.label ?? '')) {
      throw new Error('Choose your physical webcam in the browser camera settings, not OBS Virtual Camera, then try again.');
    }
    video.srcObject = stream;
    await video.play();
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      stopCamera();
      showError('The camera disconnected or its permission was revoked. Reconnect it and enable the camera again.', new Error('Camera track ended'));
    }, { once: true });
    startButton.hidden = true;
    stopButton.hidden = false;
    status.textContent = 'Look at the camera to start face tracking.';
  } catch (error) {
    stopCamera();
    const message = error instanceof DOMException && error.name === 'NotAllowedError'
      ? 'Camera permission was denied. Allow camera access for this site in your browser and macOS settings, then try again.'
      : error instanceof DOMException && error.name === 'NotReadableError'
        ? 'The camera is unavailable. Hide or remove the raw webcam source in OBS and close other apps using it, then retry.'
        : error instanceof Error ? error.message : 'Camera setup failed. Check the browser console for details.';
    showError(message, error);
  } finally {
    loading = false;
    startButton.disabled = false;
  }
}
startButton.addEventListener('click', () => { void startCamera(); });
stopButton.addEventListener('click', stopCamera);
window.addEventListener('pagehide', () => {
  cancelled = true;
  stopCamera();
  tracker?.close();
  tracker = undefined;
});

function videoRect() {
  const scale = Math.max(WIDTH / video.videoWidth, HEIGHT / video.videoHeight);
  const width = video.videoWidth * scale;
  const height = video.videoHeight * scale;
  return { x: (WIDTH - width) / 2, y: (HEIGHT - height) / 2, width, height };
}

function updatePose(result: FaceLandmarkerResult) {
  const rect = videoRect();
  const pose = estimateCrownPose(result, rect, WIDTH, HEIGHT, fit);
  facePresent = Boolean(pose);
  if (!pose) {
    hasPose = false;
    puppetExpression = { ...NEUTRAL_EXPRESSION };
    status.textContent = avatarMode
      ? 'Face not found. Your puppet rests until you return; camera video stays hidden.'
      : 'Face not found. The hat is hidden until you return.';
    return;
  }
  targetScale = pose.scale;
  targetPosition.copy(pose.position);
  targetQuaternion.copy(pose.quaternion);
  const puppetPosition = estimateAvatarPosition(result, rect, WIDTH, HEIGHT);
  if (!puppetPosition) throw new Error('Tracked face is missing the cheek landmarks needed to position the puppet.');
  targetAvatarPosition.copy(puppetPosition);
  puppetExpression = readPuppetExpression(result.faceBlendshapes[0]?.categories ?? []);
  if (avatarMode) Object.assign(puppetExpression, readPuppetEyeClosure(result, rect));
  if (!hasPose) {
    hat.root.position.copy(targetPosition);
    hat.root.quaternion.copy(targetQuaternion);
    hat.root.scale.setScalar(targetScale);
    if (avatarMode) {
      avatar.root.position.copy(targetAvatarPosition);
      avatar.update(targetQuaternion, puppetExpression, 0, true);
    }
  }
  hasPose = true;
  status.textContent = avatarMode
    ? 'Puppet active. Head, mouth and eyebrow tracking; body hangs from the neck.'
    : 'Hat attached. Face tracking active.';
}

function drawDemo(time: number) {
  ctx.fillStyle = demoBackground;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < 45; i++) {
    const x = (Math.sin(i * 127.1) * 0.5 + 0.5) * WIDTH;
    const y = (Math.sin(i * 47.7) * 0.5 + 0.5) * HEIGHT;
    ctx.beginPath();
    ctx.fillStyle = `rgba(237, 225, 171, ${0.08 + (Math.sin(time + i) + 1) * 0.08})`;
    ctx.arc(x, y, 1 + i % 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(640, 380, 20, 640, 380, 360);
  glow.addColorStop(0, '#81a87e20');
  glow.addColorStop(1, '#81a87e00');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function render(now: number) {
  requestAnimationFrame(render);
  if (now - previousFrame < 1000 / 30 - 0.5) return;
  const delta = Math.min((now - previousFrame) / 1000, 0.1);
  previousFrame = now;
  if (!paused) animationTime += delta;
  orbitPhase += (animationTime - previousAnimationTime) * 0.65;
  previousAnimationTime = animationTime;
  ctx.save();
  if (stream && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    const rect = videoRect();
    if (avatarMode) drawDemo(animationTime);
    else ctx.drawImage(video, rect.x, rect.y, rect.width, rect.height);
    if (tracker && video.currentTime !== lastVideoTime && now - lastInference >= 1000 / 30) {
      lastVideoTime = video.currentTime;
      lastInference = now;
      try {
        updatePose(tracker.detectForVideo(video, now));
      } catch (error) {
        stopCamera();
        tracker.close();
        tracker = undefined;
        showError('Face tracking stopped unexpectedly. Try enabling your camera again; check graphics acceleration if this repeats.', error);
      }
    }
    hat.root.visible = !avatarMode && facePresent;
    avatar.root.visible = avatarMode;
    if (avatarMode) {
      if (facePresent) avatar.root.position.lerp(targetAvatarPosition, 1 - Math.exp(-delta * 16));
      avatar.update(facePresent ? targetQuaternion : puppetDemoQuaternion.identity(), puppetExpression, delta);
    }
    if (hasPose) {
      const smoothing = 1 - Math.exp(-delta * 16);
      hat.root.position.lerp(targetPosition, smoothing);
      hat.root.quaternion.slerp(targetQuaternion, smoothing);
      const size = THREE.MathUtils.lerp(hat.root.scale.x, targetScale, smoothing);
      hat.root.scale.setScalar(size);
    }
  } else {
    drawDemo(animationTime);
    hat.root.visible = !avatarMode;
    avatar.root.visible = avatarMode;
    if (avatarMode) {
      avatar.root.position.set(0, AVATAR_BASE_Y, 0);
      puppetDemoRotation.set(Math.sin(animationTime * 0.7) * 0.065, Math.sin(animationTime * 0.45) * 0.22,
        Math.sin(animationTime * 0.6) * 0.035);
      puppetDemoQuaternion.setFromEuler(puppetDemoRotation);
      const blink = Math.max(0, 1 - Math.abs((animationTime % 4.3) - 3.8) / 0.1);
      avatar.update(puppetDemoQuaternion, {
        ...NEUTRAL_EXPRESSION,
        blinkLeft: blink, blinkRight: blink, jaw: Math.max(0, Math.sin(animationTime * 2.4)) * 0.28,
        smile: 0.22, brow: Math.max(0, Math.sin(animationTime * 0.9)) * 0.25,
        browLeft: Math.max(0, Math.sin(animationTime * 0.6)) * 0.4,
        browRight: Math.max(0, -Math.sin(animationTime * 0.6)) * 0.4,
      }, paused ? 0 : delta);
    }
    hat.root.position.set(-30, -185, 0);
    hat.root.rotation.set(0.05, Math.sin(animationTime * 0.25) * 0.3, -0.04);
    hat.root.scale.setScalar(150);
  }
  hat.update(animationTime, orbitPhase, fit.size / 100);
  if (avatarMode) avatarHat.update(animationTime, orbitPhase, 1);
  renderer.render(scene, camera);
  if (avatarMode) outlineEffect.renderOutline(scene, camera);
  ctx.drawImage(renderer.domElement, 0, 0);
  ctx.restore();
  snowfall.draw(ctx, animationTime);
}
requestAnimationFrame(render);
