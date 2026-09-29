# Mobile playback prototype — physical-phone gate pending

This is a two-sample feasibility test, not a replacement for `/v2/`.
Production remains `7b8160e`. No desktop or production source file was changed.

## On your iPhone

Open the preview in Safari. Collapse the test panel to inspect the picture and scroll forward/backward. Reopen it and run **Run forward / reverse test** for each scene and encoding (four combinations). Select your visual assessment, identify the phone if known, tick the physical-phone checkbox, and **Download results**. Send that JSON back for review. Also test a fast swipe and reversal, leaving/returning to Safari, and Low Power Mode. No results are transmitted automatically.

The automatic test sends 30 target updates per second for six seconds; it is a synthetic seek workload, not an FPS benchmark. Manual scrolling is measured too. Timings use video-frame callbacks and include time waiting behind the previous seek. Measurements end at the canvas draw; they do not measure screen scanout. Unsupported frame-callback browsers only get timing estimates and cannot pass the gate.

## Evidence and limits

- 720×1560 portrait captures directly from the approved Three.js scene: opening progress 0–0.22 (128 frames), wheel 0.49–0.67 (105 frames), 24 fps.
- H.264, CRF 21, no B frames, fast-start metadata, independently seekable frames and six-frame groups. Compare against the original captured PNGs before accepting colour/detail.
- Opening: 1.68 MB / six-frame versus 3.35 MB / independent. Wheel: 2.60 MB versus 5.12 MB. Independent-frame opening misses the 2 MB budget without further segmentation.
- A frame-boundary rounding stall was found and fixed by seeking inside the requested frame interval. Never fall back to autoplay.
- Desktop browser results are functional evidence only. No physical iPhone, Android, throttled-network, full-sequence, landscape or cross-chapter gate has passed.
- UI copies the existing headings and timing. Each selected sample expands across the test page's scroll track. It does not pretend the missing middle/gallery chapters have been implemented.
- Reduced motion shows the selected chapter still. Decode failures preserve a still/last valid frame. No 3D fallback is downloaded.

## Reproduce

From repository root: `node scripts/mobile-prototype/prepare.mjs`, then `python3 scripts/mobile-prototype/serve.py --capture`. Open localhost:8773 and click Capture after the studio loads. Temporary capture files remain under `/tmp/pivarion-mobile-capture`; the production source is not modified. The harness freezes the simulation's time, wheel travel, and gallery rotation. It uses the production wide/full model transition.

Set `PIVARION_FFMPEG` to FFmpeg (tested 6.1.1), run `node scripts/mobile-prototype/encode.mjs`, then `node scripts/mobile-prototype/page.mjs` and `node scripts/mobile-prototype/verify.mjs`. Serve the repository with `python3 scripts/mobile-prototype/serve.py --port 8774`, then open `/mobile-prototype/`.

## Stop condition

Do not implement the full phone renderer or publish to main until physical iPhone Safari passes p95 input-to-frame ≤100 ms, forward/reverse responsiveness and visual review. The full sequence must later meet the 1.5 s poster, 3.5 s usable playback and 15 MB total gates. Physical devices must be supplied by the user/tester; desktop emulation cannot substitute. Keep the desktop engine and release `7b8160e` untouched.
