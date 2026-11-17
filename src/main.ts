import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import wasmLoader from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinary from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import { createHat } from './hat';
import { createSnowfall } from './snow';
import { AVATAR_BASE_Y, createAvatar, estimateAvatarPosition, NEUTRAL_EXPRESSION, readPuppetExpression, readPuppetEyeClosure } from './avatar';
import { DEFAULT_FIT, FIT_LIMITS, FIT_STORAGE_KEY, LEGACY_FIT_STORAGE_KEY, estimateCrownPose, migrateLegacyFit, parseFit } from './fit';
import type { HeadFit } from './fit';
import './style.css';

document.body.innerHTML = `
  <header>
    <div class="brand"><div class="brand-mark" aria-hidden="true">&#10035;</div>
      <div class="brand-name">evergreen <span>studio</span></div></div>
    <div class="local-badge"><span class="dot"></span>Made for a little meeting magic</div>
  </header>
  <main>
    <section class="intro" aria-labelledby="page-title">
      <div><div class="eyebrow">The festive camera collection / No. 001</div>
        <h1 id="page-title">A little over the treetop.</h1>
        <p class="subtitle">An unnecessarily festive hat. Or your very own Christmas puppet.</p></div>
      <div class="edition">CHRISTMAS '26 &nbsp; / &nbsp; LOCAL PROTOTYPE</div>
    </section>
    <div class="workspace">
      <section aria-label="Camera preview">
        <div class="preview-card">
          <div class="preview-header"><span class="preview-title"><span class="dot"></span>Your festive feed</span>
            <span class="live-pill" id="mode-label">Demo preview</span></div>
          <div class="stage">
            <canvas id="output" width="1280" height="720" tabindex="-1" aria-label="Festive video preview: tree hat or personal puppet avatar, with optional snowfall"></canvas>
            <div class="stage-label" id="stage-label">DEMO &nbsp; / &nbsp; Camera is off</div>
          </div>
          <div class="preview-footer"><span id="status" role="status" aria-live="polite">Ready when you are. Try the hat, then turn on your camera.</span>
            <span id="performance">1280 &times; 720</span></div>
        </div>
        <div class="toolbar">
          <button class="primary" id="start">Enable camera</button>
          <button id="stop" hidden>Stop camera</button>
          <button id="clean" class="quiet">Clean output for OBS</button>
          <button id="pause" class="quiet" aria-pressed="false">Pause animation</button>
        </div>
        <p class="hint">Choose a camera effect in the controls. In hat mode, Hat size scales evenly without squashing.
          Lower Crown lift to cover more forehead.
          Sit farther back if the taller tree or moon needs more headroom.
          Clean output hides everything but the video. Press Escape to return.</p>
        <div class="error" id="error" role="alert" hidden></div>
      </section>
      <aside aria-label="Effect controls">
        <section class="panel">
          <div class="control"><label for="effect-mode">Camera effect</label>
            <select id="effect-mode">
              <option value="hat">Tree hat / webcam</option>
              <option value="avatar">Personal puppet + tree hat</option>
            </select></div>
          <p class="hint" id="avatar-hint" hidden>Your Christmas puppet wears the tree hat. Head turns, blinks,
            position, sensitive mouth movement and independent eyebrows drive it. The body hangs from the neck;
            this is puppet motion, not body tracking. Camera video stays hidden.</p>
          <div class="control" id="avatar-look" hidden>
            <label class="toggle" for="outlines">Illustrated outlines <input id="outlines" type="checkbox" checked></label>
            <p class="hint">Experimental ink edges on the puppet and its hat. Turn off to compare the original look.</p>
          </div>
          <div id="hat-controls">
          <h2>Your personal fit</h2>
          <p class="panel-description" id="fit-status" role="status">A bigger, lower-seated hat with natural proportions. Adjustments save in this browser.</p>
          ${([
            ['size', 'Hat size'],
            ['lift', 'Crown lift'], ['setback', 'Set back'],
          ] as const).map(([key, label]) => `
            <div class="control"><label for="fit-${key}">${label} <output id="fit-${key}-value">${DEFAULT_FIT[key]}%</output></label>
              <input id="fit-${key}" type="range" min="${FIT_LIMITS[key][0]}" max="${FIT_LIMITS[key][1]}" value="${DEFAULT_FIT[key]}" step="1"></div>
          `).join('')}
          <p class="hint">Crown lift raises or lowers the brim without changing its shape. Set back keeps it over your skull when you turn.</p>
          <button id="reset-fit" class="quiet">Reset my fit</button>
          <div class="control"><label for="orbit-speed">Santa's pace <output id="orbit-speed-value">1.0x</output></label>
            <input id="orbit-speed" type="range" min="20" max="200" value="100" step="5"></div>
          <div class="control">
            <label class="toggle" for="santa">Santa &amp; his sleigh <input id="santa" type="checkbox" checked></label>
            <label class="toggle" for="moon">Floating moon <input id="moon" type="checkbox" checked></label>
          </div>
          </div>
          <div class="control">
            <label class="toggle" for="snow">Snowfall <input id="snow" type="checkbox" checked></label>
            <label class="toggle" for="mirror">Mirror video <input id="mirror" type="checkbox"></label>
          </div>
          <div class="control"><label for="camera">Camera</label>
            <select id="camera"><option value="">Default camera</option></select></div>
        </section>
        <div class="connection"><strong><span class="dot"></span>Next stop: Google Meet</strong>
          <p>Enable your camera here. In OBS, hide the raw webcam source and capture this window's clean output.
          Keep OBS Virtual Camera selected in Meet.</p></div>
      </aside>
    </div>
    <section class="steps" aria-label="Setup steps">
      <div class="step"><span class="step-number">01</span><div><strong>Find your festive side</strong><p>Enable your camera and allow access. Tracking stays on your computer.</p></div></div>
      <div class="step"><span class="step-number">02</span><div><strong>Frame your little forest</strong><p>Adjust the fit, then switch to clean output. Capture only the video area in OBS.</p></div></div>
      <div class="step"><span class="step-number">03</span><div><strong>Bring the cheer</strong><p>Start OBS Virtual Camera. In Meet, choose it under Settings &rarr; Video.</p></div></div>
    </section>
    <footer><span>Built for festive faces, not facial recognition. No audio access. No video uploads.</span>
      <span>Three.js + MediaPipe &nbsp; / &nbsp; Made to be a little extra.</span></footer>
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
const pauseButton = element('pause', HTMLButtonElement);
const status = element('status', HTMLSpanElement);
const errorBox = element('error', HTMLDivElement);
const cameraSelect = element('camera', HTMLSelectElement);
const fitStatus = element('fit-status', HTMLParagraphElement);
const speedInput = element('orbit-speed', HTMLInputElement);
const mirrorInput = element('mirror', HTMLInputElement);
const moonInput = element('moon', HTMLInputElement);
const santaInput = element('santa', HTMLInputElement);
const snowInput = element('snow', HTMLInputElement);
const effectMode = element('effect-mode', HTMLSelectElement);
const outlinesInput = element('outlines', HTMLInputElement);
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
const avatar = createAvatar();
avatar.root.position.set(0, AVATAR_BASE_Y, 0);
avatar.root.scale.setScalar(130);
avatar.root.visible = false;
scene.add(avatar.root);
const avatarHat = createHat();
avatarHat.occluder.visible = false;
avatar.hatMount.add(avatarHat.root);
const outlineEffect = new OutlineEffect(renderer, {
  defaultThickness: 0.0025,
  defaultColor: new THREE.Color('#29212b').toArray(),
});
avatar.root.traverse((object) => {
  if (!(object instanceof THREE.Mesh)) return;
  const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) {
    // Keep the soft instanced fur and invisible head-depth masks out of the ink pass.
    if (!material.colorWrite || object instanceof THREE.InstancedMesh) {
      material.userData.outlineParameters = { visible: false };
    }
  }
});
let avatarMode = false;
let puppetExpression = { ...NEUTRAL_EXPRESSION };
const puppetDemoQuaternion = new THREE.Quaternion();
const puppetDemoRotation = new THREE.Euler();

let stream: MediaStream | undefined;
let tracker: FaceLandmarker | undefined;
let loading = false;
let cancelled = false;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let clean = false;
let hasPose = false;
let lastVideoTime = -1;
let lastInference = 0;
let previousFrame = performance.now();
let animationTime = 0;
let orbitPhase = 0;
let previousAnimationTime = 0;
let frameCount = 0;
let fpsStart = performance.now();
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

function updatePause() {
  pauseButton.textContent = paused ? 'Resume animation' : 'Pause animation';
  pauseButton.setAttribute('aria-pressed', String(paused));
}
updatePause();

function saveFit(message = 'Your fit is saved in this browser. No photos or face data are stored.') {
  try {
    localStorage.setItem(FIT_STORAGE_KEY, JSON.stringify(fit));
    fitStatus.textContent = message;
  } catch (error) {
    console.error('Could not save personal hat fit.', error);
    fitStatus.textContent = 'Your fit works for this session, but browser storage is blocked. It could not be saved.';
  }
}

function updateFitControls() {
  for (const key of ['size', 'lift', 'setback'] as const) {
    element(`fit-${key}`, HTMLInputElement).value = String(fit[key]);
    element(`fit-${key}-value`, HTMLOutputElement).value = `${fit[key]}%`;
  }
}

try {
  const saved = localStorage.getItem(FIT_STORAGE_KEY);
  if (saved !== null) {
    fit = parseFit(saved);
    fitStatus.textContent = 'Your saved personal fit is loaded. Changes save in this browser.';
  } else {
    const legacy = localStorage.getItem(LEGACY_FIT_STORAGE_KEY);
    if (legacy !== null) {
      fit = migrateLegacyFit(legacy);
      saveFit('Updated your old fit: removed stretching and seated the hat lower. Your setback is preserved.');
    }
  }
} catch (error) {
  console.error('Could not restore personal hat fit.', error);
  fitStatus.textContent = 'Saved fit could not be loaded. Using the new proportional starting fit; adjust a control to save it again.';
}
updateFitControls();
for (const key of ['size', 'lift', 'setback'] as const) {
  const input = element(`fit-${key}`, HTMLInputElement);
  input.addEventListener('input', () => {
    fit[key] = Number(input.value);
    element(`fit-${key}-value`, HTMLOutputElement).value = `${fit[key]}%`;
  });
  input.addEventListener('change', () => saveFit());
}
element('reset-fit', HTMLButtonElement).addEventListener('click', () => {
  fit = { ...DEFAULT_FIT };
  updateFitControls();
  saveFit();
});
speedInput.addEventListener('input', () => {
  element('orbit-speed-value', HTMLOutputElement).value = `${(Number(speedInput.value) / 100).toFixed(1)}x`;
});
effectMode.addEventListener('change', () => {
  avatarMode = effectMode.value === 'avatar';
  element('hat-controls', HTMLDivElement).hidden = avatarMode;
  element('avatar-hint', HTMLParagraphElement).hidden = !avatarMode;
  element('avatar-look', HTMLDivElement).hidden = !avatarMode;
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
pauseButton.addEventListener('click', () => { paused = !paused; updatePause(); });

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
  cameraSelect.disabled = false;
  element('mode-label', HTMLSpanElement).textContent = 'Demo preview';
  element('stage-label', HTMLDivElement).textContent = 'DEMO / Camera is off';
  status.textContent = `Camera stopped. Showing the demo ${avatarMode ? 'puppet' : 'hat'}.`;
}

async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const selected = stream?.getVideoTracks()[0]?.getSettings().deviceId ?? cameraSelect.value;
  cameraSelect.replaceChildren(new Option('Default camera', ''));
  for (const device of devices) {
    if (device.kind !== 'videoinput') continue;
    const option = new Option(device.label || `Camera ${cameraSelect.options.length}`, device.deviceId);
    // Feeding OBS's own output back into this app creates a recursive capture.
    option.disabled = /OBS Virtual Camera/i.test(device.label);
    cameraSelect.add(option);
  }
  cameraSelect.value = selected;
}

async function startCamera() {
  if (loading) return;
  loading = true;
  cancelled = false;
  errorBox.hidden = true;
  startButton.disabled = true;
  cameraSelect.disabled = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access requires localhost or HTTPS and a supported browser.');
    }
    const selected = cameraSelect.value;
    stopCamera();
    cameraSelect.disabled = true;
    await loadTracker();
    if (cancelled) return;
    status.textContent = 'Waiting for camera permission...';
    const nextStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: WIDTH }, height: { ideal: HEIGHT },
        frameRate: { ideal: 30, max: 30 },
        ...(selected ? { deviceId: { exact: selected } } : { facingMode: 'user' }),
      },
      audio: false,
    });
    if (cancelled) {
      nextStream.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = nextStream;
    await listCameras();
    if (/OBS Virtual Camera/i.test(nextStream.getVideoTracks()[0]?.label ?? '')) {
      throw new Error('Select your physical webcam, not OBS Virtual Camera. OBS should capture this app, not feed it.');
    }
    video.srcObject = stream;
    await video.play();
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      stopCamera();
      showError('The camera disconnected or its permission was revoked. Reconnect it and enable the camera again.', new Error('Camera track ended'));
    }, { once: true });
    startButton.hidden = true;
    stopButton.hidden = false;
    element('mode-label', HTMLSpanElement).textContent = 'Live camera';
    element('stage-label', HTMLDivElement).textContent = 'LIVE / Finding your face';
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
    cameraSelect.disabled = false;
  }
}
startButton.addEventListener('click', () => { void startCamera(); });
stopButton.addEventListener('click', stopCamera);
cameraSelect.addEventListener('change', () => { if (stream) void startCamera(); });
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
    element('stage-label', HTMLDivElement).textContent = 'LIVE / Looking for you';
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
  element('stage-label', HTMLDivElement).textContent = 'LIVE / Face tracking active';
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
  ctx.fillStyle = '#d5e4cb';
  ctx.textAlign = 'center';
  ctx.font = '500 16px "DM Sans", sans-serif';
  if (avatarMode) return;
  ctx.fillText('A very merry test flight.', WIDTH / 2, 630);
  ctx.fillStyle = '#9eb6a6';
  ctx.font = '13px "DM Sans", sans-serif';
  ctx.fillText('Enable your camera to try it on.', WIDTH / 2, 657);
}

function render(now: number) {
  requestAnimationFrame(render);
  if (now - previousFrame < 1000 / 30 - 0.5) return;
  const delta = Math.min((now - previousFrame) / 1000, 0.1);
  previousFrame = now;
  if (!paused) animationTime += delta;
  orbitPhase += (animationTime - previousAnimationTime) * Number(speedInput.value) / 100 * 0.65;
  previousAnimationTime = animationTime;
  ctx.save();
  if (mirrorInput.checked) { ctx.translate(WIDTH, 0); ctx.scale(-1, 1); }
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
      }, delta, true);
    }
    hat.root.position.set(-30, -185, 0);
    hat.root.rotation.set(0.05, Math.sin(animationTime * 0.25) * 0.3, -0.04);
    hat.root.scale.setScalar(150);
  }
  hat.flightTeam.visible = santaInput.checked;
  hat.moon.visible = moonInput.checked;
  hat.update(animationTime, orbitPhase, fit.size / 100);
  if (avatarMode) avatarHat.update(animationTime, orbitPhase, 1);
  renderer.render(scene, camera);
  if (avatarMode && outlinesInput.checked) outlineEffect.renderOutline(scene, camera);
  ctx.drawImage(renderer.domElement, 0, 0);
  ctx.restore();
  if (snowInput.checked) snowfall.draw(ctx, animationTime);
  frameCount++;
  if (now - fpsStart >= 1000) {
    element('performance', HTMLSpanElement).textContent = `1280 × 720 / ${Math.round(frameCount * 1000 / (now - fpsStart))} fps`;
    fpsStart = now;
    frameCount = 0;
  }
}
requestAnimationFrame(render);
