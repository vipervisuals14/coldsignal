# ColdSignal 4K Studio v1.1 — source backup

This is an independent source-code copy of the current browser studio, prepared for permanent static hosting. It does not require Arena, an AI API, Resolve, a database, or a media-upload server.

## Run/build

Use Node 20.19+ or a compatible recent Node LTS:

```bash
npm ci
npm run build
npm run preview
```

Deploy the **contents of `dist/`** to the root of an HTTPS static website. The ready-to-upload ZIP already contains a compiled build, so no local compilation is needed for the first deployment.

`npm run dev` starts the development server. Preview/development servers bind to `0.0.0.0:5173` by configuration; normal deployed static hosting does not run those servers.

## Included functionality

- Native-resolution image/video textures, with GPU-size checks.
- WebGL 2 Rutt-Etra-style heightfield, raster lines, glow, distortion, streaks and camera movement.
- Local music analysis and optional ColdSignal CSV input.
- 3840 × 2160 frame-by-frame MP4/H.264 export; WebM/VP8 compatibility option.
- AAC audio where supported, otherwise compatible Opus paths; selected music is optional.
- Disk-backed export where the browser allows it, and explicit errors rather than silent downscaling.
- 4K PNG snapshot export and JSON look presets.

**Keyframe editing is included in v1.1.** See `KEYFRAMES.md`: Inspector diamonds, a draggable curve lane, add/delete/undo, linear/eased/hold interpolation, JSON animation saving/loading, and the same evaluator in preview and 4K export.

Short actual 4K image/video/audio exports and UI behavior were checked in Chromium. A full four-minute 4K encode, every browser/hardware combination, AAC encoding and native save-picker interaction were not certified by those tests. Use a capable desktop browser and test a short section first.

## Privacy

No personal media or private timing CSV is bundled. Selected files are processed in the browser. The public site code does not upload them to a server. Generated temporary exports can remain in browser-local storage until cleared in the app.

There is no persistent cloud editing session. Save looks and retain original media separately.

## Main files

- `src/renderer.js`: WebGL effect and camera.
- `src/audio.js`, `src/analysis.worker.js`: decoding, channel-energy analysis and CSV sampling.
- `src/exporter.js`: codec checks, frame rendering, audio/video encoding and container output.
- `src/main.js`: UI state, file selection and playback.
- `src/keyframes.js`, `src/keyframe-editor.js`: shared animation sampling and the interactive keyframe editor.
- `index.html`, `src/style.css`: interface and in-app help.

Dependencies are pinned in `package-lock.json`. See `THIRD_PARTY.md` and `public/licenses/mediabunny.txt` for third-party notices. Keep those notices when publishing.
