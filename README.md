# Evergreen Studio

A local Christmas webcam effect for Google Meet, built with Three.js and MediaPipe.

## Features

- **Tree hat:** head-tracked 3D Christmas tree with Santa, three flying reindeer, and a crescent moon.
- **Puppet avatars:** choose the original puppet or Allison, both with head, mouth, eyebrow and wink tracking, plus spring-driven hair.
- Snowfall, illustrated puppet outlines, and a simple effect selector.
- Clean 1280 x 720 output for OBS Virtual Camera.

Camera processing stays on your computer. No video uploads or microphone access. Internet is needed for the initial tracking-model download.

## Run

Requires **Node.js 20.19+** and **Chrome with graphics acceleration enabled**.

```sh
npm install
npm run dev
```

Open the localhost URL printed in the terminal. Choose a **Camera effect** and click **Start camera**. To change webcams, use your browser's camera settings; choose your physical webcam, **not OBS Virtual Camera**.

## Hosted version

[Open Evergreen Studio](https://doug-mj.github.io/festive-hat/). Pushes to `main` automatically test, build, and deploy to GitHub Pages. No local server is needed; allow camera access in Chrome.

## Use in Google Meet

Requires OBS on your Mac.

1. In OBS, hide any raw webcam source so the app can use the camera.
2. In the app, click **Clean output**. Press **Escape** to restore controls.
3. In OBS, add **macOS Screen Capture**, choose **Window Capture**, and select the app's browser window.
4. **Option-drag** the source edges to crop browser chrome and black borders, then choose **Transform > Fit to Screen**.
5. Start **OBS Virtual Camera** and select it as your camera in Google Meet. Keep your normal microphone selected.

Keep the browser window open and unminimized. Disable Meet's own visual effects.

## Development

```sh
npm test
npm run build
```
