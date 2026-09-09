# tools — taking the shot out of the browser

The front page is not a scene file. It is a simulation: geometry generated at
boot, a camera sampled from scroll position, wheels turning on ground covered,
and a lot of additive cards standing in for light. None of that is something
Blender can open.

This pipeline runs the real page frame by frame, records what it actually did,
and rebuilds it in Blender.

```
tools/make-export-harness.py   v2/index.html -> an exportable copy
tools/export-scene.mjs         run the page, bake the shot, write GLB + JSON
tools/blender_build.py         rebuild it in Blender and render
tools/make-video.sh            frames -> mp4
```

## Run it

```bash
# 1. harness (three edits to a copy; the shipped page is never touched)
python3 tools/make-export-harness.py /tmp/harness/index.html
cp -r /path/to/three@0.150.1 /tmp/harness/three
(cd /tmp/harness && npx http-server -p 8899 -s .)

# 2. bake — FPS and SECS set the length of the baked clip
FPS=24 SECS=20 node tools/export-scene.mjs ./export

# 3. build and render
python3.11 tools/blender_build.py ./export ./out --res 1280x720 --samples 28 --save-blend

# 4. encode
tools/make-video.sh ./out/frames ./out 24
```

`pip install bpy==4.2.0` gives you Blender as a Python module, which is what
`blender_build.py` expects. It needs `libegl1` present even for CPU renders.

## What comes out

| file | what it holds |
| --- | --- |
| `pivarion-scene.glb` | geometry, materials, textures, and the movement as a glTF clip |
| `pivarion-shot.json` | the same movement plus everything glTF cannot carry |
| `pivarion-shot.blend` | the assembled Blender scene, lit and ready to render |
| `frames/pv_####.png` | the image sequence |
| `pivarion-shot.mp4` | H.264, plus a CRF 12 master |

## The two things worth knowing

**glTF cannot animate focal length.** The shot pushes from 26mm to 42mm of
vertical angle — the dive onto the brake disc is a lens move as much as a
dolly — and a glTF camera has one static `yfov`. So the GLB carries the
camera's *motion* and `pivarion-shot.json` carries its *lens*, frame by
frame, along with visibility, emission levels, the light rig and the fog.
Open the GLB alone in any DCC and the camera flies the right path at a fixed
40mm. `blender_build.py` reads both, which is why the render matches the page.

**The light in the page is mostly a lie.** Overhead strips, ground smears,
flares, speed streaks and contact shadows are additive cards — cheap stand-ins
for light in a rasteriser, and meaningless in a path tracer. The exporter drops
all 72 of them and ships their positions in the shot file instead; the Blender
script turns the 17 overhead strips into real area lights, which is what puts
the travelling highlights back onto the paint.

## Coordinates

glTF is Y-up, Blender is Z-up, so world transforms are rotated +90° about X on
the way in. Applying that same rotation to the camera's quaternion is the only
correction a camera needs — glTF and Blender cameras both look down their local
−Z, so once the world agrees, the framing does too.

## Knobs

`blender_build.py` takes `--res`, `--samples`, `--frames A:B`, `--stills a,b,c`,
`--engine`, `--save-blend`, `--no-render`, and for the look: `--sun`, `--strip`,
`--point`, `--fog`, `--ev`, `--shutter`, `--view`, `--look`.

Use `--stills` to check a few marks before committing to a full pass — at 720p
a frame costs about 30 seconds on four cores, so the full 480 is roughly four
hours. EEVEE is available via `--engine BLENDER_EEVEE_NEXT` but is far slower
here: without a GPU it falls back to llvmpipe at ~40s for a 480×270 frame.
