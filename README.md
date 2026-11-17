# Evergreen Studio

A local Christmas camera-effect prototype: a head-tracked 3D tree hat, orbiting Santa with a sleigh and three reindeer, a floating crescent moon, and an original personal Christmas-puppet avatar mode.

## Run

Requires Node.js 20.19+ and Chrome with graphics acceleration enabled.

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite in Chrome. The initial demo does not need camera permission. Click **Enable camera** and allow access to try on the hat. Choose your physical webcam, not OBS Virtual Camera.

The app requests video only, not microphone access. Face tracking and rendering run on your computer; camera frames are not uploaded. The tracking model downloads from Google's model storage when tracking starts (and may be browser-cached); interface fonts load from Google Fonts. The MediaPipe runtime and WASM are served locally with the app. An internet connection is required for the first model load. This is a local development prototype, not an offline-packaged or production-hardened app.

## Send to Google Meet on macOS

1. In OBS, hide/remove your existing raw webcam source. The browser app now owns the webcam.
2. In Chrome, enable the camera in this app. Under **Your personal fit**, adjust **Hat size**, **Crown lift**, and **Set back**. Sit back enough to fit the taller, naturally proportioned hat and moon.
3. Click **Clean output for OBS**. Press Escape to return to the controls. Camera access remains in this same window; do not open a second instance.
4. In OBS, add a **macOS Screen Capture** source, choose window capture, and select this Chrome window. Grant OBS Screen & System Audio Recording permission if macOS requests it. No audio capture is needed for the effect.
5. Crop browser chrome and black letterboxing, leaving only the 16:9 output. Hold Option while dragging source edges to crop in OBS, then fit the cropped source to the scene. Set the scene/output to 1280 × 720 for the prototype.
6. Keep the captured window visible and unminimized. Do not select the OBS window itself (that causes a recursive capture).
7. Start OBS Virtual Camera. In Meet, select **OBS Virtual Camera** under Settings > Video. Leave your microphone set to your normal microphone.
8. Disable Meet's own visual effects while testing to avoid layering or performance issues.

No streaming or recording is necessary. Other meeting participants do not need this app or OBS.

## Controls and limitations

- **Camera effect** switches between the original **Tree hat / webcam** and **Personal puppet + tree hat**. The puppet is an original, simplified brown-haired, bearded character with a vintage Christmas-puppet feel, not a recreation of a movie character or a photo-derived 3D scan. The demo previews it without camera permission.
- Avatar mode replaces the entire webcam picture with a festive background and a 3D puppet wearing its own head-mounted tree hat, including Santa, all three reindeer, and the moon. Its independent hat instance does not change the webcam hat or your saved fit. The puppet starts lower in the frame and follows your head's left/right and up/down position, using the midpoint between your cheeks and the same camera cropping as the webcam effect. Its size stays constant; leaning closer does not resize it. Moving near the edges can take the hat outside the frame, just like a real hat. The coat is extended below the frame so its hem does not pop into view when you move upward.
- Head rotation, separate left/right blinking, jaw opening, smiling and eyebrows follow the existing face tracker, with smoothing. Mouth tracking uses a nonlinear gain with no added dead zone, so small detected openings produce visible motion; its response is faster than the other expressions. Talking is driven visually by your mouth, not microphone audio. Independent outer eyebrow raises and furrows combine with inner eyebrow raises, changing both brow height and tilt. Hair, beard and coat use locally generated geometry and surface grain; no portrait is loaded or uploaded by the app.
- The beard has a fuller, longer lower silhouette with denser, gently wavy surface locks. Its upper sides angle away from the rosy cheeks rather than crossing in front of them; the lower beard still moves with the jaw without hiding the mouth.
- Hair has a fuller side-and-back silhouette, with thicker, denser layers of waves extending below the shoulders. Added volume and length sit below the crown, keeping the part, face visibility and hat placement intact.
- Each eye can wink independently. A closed eye hides its white, iris and pupil and becomes a slightly curved dark line; both eyes can close together. Live closure is measured from the 3D eyelid gap relative to eye width, accounting for camera aspect ratio and head rotation, rather than requiring an unusually high expression-model blink score. Narrow close/open thresholds and a fast response let closed eyelids register promptly while avoiding ordinary squints and flickering. Reopening restores the original eye, and the line works with illustrated outlines on or off.
- The body shares a neck attachment point with the rotating head and hangs from that point with damped, delayed pitch, turn and sway. Sideways movement gives the hanging body a small trailing swing. This is head-driven puppet motion, not body tracking; arms are attached to the coat and do not track gestures. Body, hand and finger tracking are not implemented. When your face is lost, the puppet stays at its last tracked location while its expression and body ease back to neutral, without exposing the webcam. Stopping the camera returns to the centered, labeled animated demo.
- Hat-fitting controls apply only in hat mode and are hidden in avatar mode. Snow, mirroring, clean OBS output and camera controls work in both modes. Pause freezes demo motion and snowfall, but live expression/head tracking continues, just as the live webcam continues in hat mode. Mode selection resets on reload.
- **Illustrated outlines** is an experimental, default-on option in puppet mode, inspired by prisoner849's [OutlineEffect (per material) example](https://codepen.io/prisoner849/pen/NWJywxL). It uses the installed Three.js `OutlineEffect` addon, not copied Pen code: a second 3D pass draws thin, dark ink edges while keeping the models' existing colors, textures and lighting. Toggle it off for an immediate comparison. The soft instanced rim puffs and invisible head mask are excluded to avoid hard-edged fluff or unwanted silhouettes. It does not filter the webcam, background or snow, and webcam hat mode remains unchanged. Outlines are baked into the clean OBS output and can cost some rendering performance.
- The starting fit uses a bigger hat seated slightly over the forehead, with skull setback estimated from your screenshots. It is an initial personal fit, not a 3D scan of your head.
- Face landmarks still drive tracking, but a head-local 3D offset places the brim at the crown. The offset rotates with your head, so the hat does not swing around a forehead attachment point.
- **Hat size** scales the cap, brim, decorations and star uniformly. There are no independent width or height controls, so fitting cannot squash them. Santa and the moon retain their own proportions; their positions follow the hat size.
- Fit from the front first: use **Hat size** to span your head and lower **Crown lift** to cover more forehead without flattening the tree. Then turn sideways and adjust **Set back** to center it over your skull. Recheck while nodding. Sit back if the topper or moon clips the camera frame.
- Fit adjustments save automatically when you release a slider, in this browser on this exact localhost origin. Only three numeric settings are stored, not photos, landmarks, or face data. Old width/height fits migrate once to proportional sizing with lower seating, preserving skull setback; an on-screen notice explains this change. **Reset my fit** restores the new bigger, lower-seated starting values. Blocked storage or invalid saved settings produce an on-screen notice.
- The tree has smooth tiered sides again, with no branch spikes. The white rim has 84 smooth, rounded puffs around a matte core. Puffs are 50% larger than the previous version and have irregular, stable placement around the ring, without pointed fibers or animated jitter.
- The rim's material uses a soft warm fill and reduced diffuse contrast to lift its dark undersides and blend the puffs together. This does not change the lighting on the tree, Santa or the reindeer.
- Three reindeer fly in single file along the same curved track as Santa's sleigh. The two nearest Santa have black noses; red-nosed Rudolph leads. Curved golden reins connect the team.
- The flight track has two substantial climbs and descents per orbit. Each vehicle pitches along its own section of the track and banks slightly inward, rather than floating up and down independently. Spacing follows the hat's orbit while the animals keep their proportions.
- All three reindeer have hip and knee joints with staggered flying kicks and small hooves. The gait uses the same animation clock as Santa's flight, so **Pause animation** and reduced-motion preferences pause the kicks too.
- Santa and the moon are enabled by default. Change Santa's pace, pause animation, toggle the objects, and adjust hat fit.
- **Snowfall** is enabled by default and can be toggled independently. Snow falls across the whole finished video, over both your webcam and the 3D hat, including clean OBS output. It does not depend on face tracking and has no accumulation. Flakes vary in size, opacity, speed and gentle sideways drift; larger flakes have six-point shapes.
- **Pause animation** freezes snowfall as well as the hat scene, without freezing your webcam. Reduced-motion preferences start both effects paused. Snow also appears in the demo; its toggle follows the other effect toggles and resets on page reload.
- Mirroring defaults off to avoid double mirroring with Meet's self-view. The mirror toggle affects the whole finished video, not just the hat.
- Reduced-motion preferences pause animation initially; use **Resume animation** to opt in.
- If no face is found, the hat hides rather than staying on a stale position.
- **Stop camera** releases webcam access and returns to a clearly labeled demo.
- Tracks one person. Tracking under extreme head turns, hairline fit, and realistic head/hair occlusion are approximate. There is a simple invisible head-shaped depth mask, not full segmentation.
- Lighting and camera framing matter. The output is 1280 × 720; actual performance depends on your machine, OBS capture, and Meet.
- OBS Virtual Camera is deliberately disabled in the camera selector to prevent a feedback loop. If OBS is your default camera, the app rejects it; select a physical webcam from the camera selector and enable the camera again.
- If camera permission is denied, allow this localhost site in Chrome and allow Chrome camera access in macOS System Settings. If the camera is busy, stop raw webcam capture in OBS and other apps, then retry.
- Clean output is not fullscreen automatically; this avoids interrupting your desktop capture setup. Tab exposes an accessible exit button; Escape exits without putting controls into the captured video.

## Validate

```sh
npm run build
npm test
```

The build type-checks all app code and creates a production bundle. Tests cover crown anchoring through head turns and nods, scale stability, cropped camera coordinates, saved-fit validation/migration, proportional sizing, rounded rim dimensions, reindeer count/nose order, track-following pitch/bank, all three reindeer's alternating gait, snowfall, and puppet expression mapping, small-mouth sensitivity, independent eyebrows, pose limits, smoothing, cropped head translation, neck attachment, head-mounted hat, body settling and coat coverage using Node's built-in test runner. Use `npm run preview` to serve the production bundle locally. Check camera alignment with your actual webcam and verify the result from a second Meet participant before relying on it in a call.

Browser verification should cover: demo animation and pause, fit controls, mirrored output, clean output and Escape, permission denial and retry, a moving face, loss/reacquisition of a face, rejection of OBS camera feedback, and releasing camera access on stop. For avatar mode, also check mode switching, left/right and up/down movement, connected neck and hat while turning, separate winks, small mouth openings, independent eyebrow raises and furrows, neutral pose on face loss, and that raw webcam pixels never appear in avatar output. Rendering and inference are capped at approximately 30 fps to leave resources for OBS and Meet.
