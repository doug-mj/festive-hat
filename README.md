# Evergreen Studio

A local Christmas webcam effect for Google Meet, built with Three.js and MediaPipe.

## Features

- **Tree hat:** head-tracked 3D Christmas tree with Santa, three flying reindeer, and a crescent moon.
- **Puppet avatar:** replaces your webcam image with a character that follows your head position, turns, mouth, eyebrows, and winks.
- Snowfall, optional illustrated outlines, mirroring, animation controls, and saved hat-fit adjustments.
- Clean 1280 x 720 output for OBS Virtual Camera.

Camera processing stays on your computer. No video uploads or microphone access. Internet is needed for the initial tracking-model download and web fonts.

## Run

Requires **Node.js 20.19+** and **Chrome with graphics acceleration enabled**.

```sh
npm install
npm run dev
```

Open the localhost URL printed in the terminal. Choose a camera effect and click **Enable camera**. Select your physical webcam, **not OBS Virtual Camera**.

## Use in Google Meet

Requires OBS on your Mac.

1. In OBS, hide any raw webcam source so the app can use the camera.
2. In the app, click **Clean output for OBS**. Press **Escape** to restore controls.
3. In OBS, add **macOS Screen Capture**, choose **Window Capture**, and select the app's browser window.
4. **Option-drag** the source edges to crop browser chrome and black borders, then choose **Transform > Fit to Screen**.
5. Start **OBS Virtual Camera** and select it as your camera in Google Meet. Keep your normal microphone selected.

Keep the browser window open and unminimized. Disable Meet's own visual effects.

## Development

```sh
npm test
npm run build
```
