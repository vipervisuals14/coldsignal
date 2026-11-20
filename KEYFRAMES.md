# ColdSignal v1.1 — keyframes are now included

## Find the new editor

The header shows **WEB / 1.1**. There is a **KEYFRAME EDITOR** below the audio waveform, and **◇ diamonds** beside the animatable Inspector sliders.

If your own hosted site still shows WEB / 01, it is running the old build. Upload **ColdSignal_UPLOAD_v1_1_KEYFRAMES.zip** to a new **production deployment in the same hosting project**, then reload the site. A hard refresh (Ctrl+Shift+R on Windows/Linux, Cmd+Shift+R on macOS) can help clear a stale page. You do not need to create a new project or change your URL.

## Make a first animation

1. Move the playhead to the beginning of the section.
2. Set a control such as **Contour height**, **Glow amount**, **Manual azimuth** or **Framing zoom**.
3. Click its **◇**. It turns into **◆** at a keyed frame.
4. Move the playhead later, then change the same slider. Once a control has keys, manual edits automatically add/update its key at the playhead.
5. Press Play. The base control animates between the keys.

You can also choose a control in the keyframe editor and use **Add key**. Empty tracks show the current static value until you add a key.

## Edit the animation

- **Drag a diamond** horizontally to move it in time. New/moved keys snap to the selected output FPS.
- **Time (s)** retimes the current key; without a selected key, it moves the playhead.
- **Value** sets a key’s value. Entering a value on an empty track creates its first key.
- **Previous / next** jumps to the selected control’s keys.
- **×** or Delete removes the current key. Clear track removes all keys for that control while keeping its current value as the static base.
- **Undo / redo** restores key edits and related settings. Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z work while the keyframe editor is focused, outside a text input.
- Dropping a key exactly onto another replaces that key; Undo restores the previous state.

### Interpolation

**To next key** belongs to the currently selected key and controls its outgoing segment:

- **Linear:** constant-rate change between the two values.
- **Ease in / out:** smoothstep easing, with a gentle start and finish.
- **Hold:** keep the first value until the next key, then jump.

The first and last values are held outside the key range. This is a numeric curve editor, not a custom Bezier-tangent editor.

## Camera, music and timing

Keyframes animate the **base controls**. The music envelopes and automatic camera path are applied afterward, just as live adjustments were previously.

- For an exact manual camera move, turn **Automatic camera** off and animate Manual azimuth, Elevation, Camera distance and/or Framing zoom.
- If Automatic camera stays on, the chosen orbit/push/drift path adds to your animated base pose.
- Camera dragging/scrolling updates an existing animated camera control at the playhead. Controls without keys remain static until you create their first key.
- Key times are stored in **seconds relative to the current section’s start**, not absolute song time.
- Changing Song start does not shift manual keys. Existing keys retain their time positions if FPS changes; newly created/moved keys snap to the current FPS.
- Shortening Duration does not delete or rescale later keys. They are retained and can still influence interpolation within the shortened section.
- Raster line count and horizontal mesh detail are intentionally not keyframeable, keeping topology fixed. Colour swatches and checkbox/menu states remain static.

## Save and export

- **Save animation** saves manual keys, interpolation, base settings and section timing to JSON. Load animation restores those settings. The file does not contain music, video or image data.
- **Save look** saves only the evaluated pose at the current playhead, not the animation.
- Reloading the page clears unsaved keys and selected local media. Save your animation before leaving.
- The full-resolution PNG snapshot and **4K video exporter use the same keyframe evaluator as the preview**.
- The export dialog reports how many manual keys are included. Keys are sampled for each output frame; they are not applied only to the preview.

## Validation scope

Checked in Chromium:

- Add/edit/move/delete keys; undo/redo and numeric retiming.
- Linear, ease and hold interpolation, endpoints and clamped outside values.
- Inspector values follow the animation; playback does not record unwanted keys.
- Save/load animation and evaluated-pose saving.
- Invalid animation rejection, fixed-topology restrictions and section-relative timing.
- Camera key interpolation and automatic recording of edits to an already-animated camera pose.
- Desktop and 390px layout.
- An actual **3840 × 2160 H.264 MP4**, 24 fps, all **six of six frames**, with soundtrack. The expected keyed value was checked at every exported frame.

This was a short export test, not a full-song benchmark or a certification of every browser/GPU. The existing hardware, codec and memory limitations still apply.
