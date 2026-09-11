# Pivarion V2

The approved V2 content and camera sequence place the complete film inside the
supplied Pivarion studio concept. The
opening mark occupies the illuminated central entrance, the LaFerrari crosses
the threshold into a long black showroom, and the product chapter sits in a
freestanding display bay framed by warm architectural light.

The detailed set includes the exact Pivarion mark as a permanent illuminated
wall relief, Pivarion Studio signage, a white photography sweep, one production
camera, two softboxes, a workstation and chair, a client sofa, and automotive art.

The underlying front end retains the September 4 LaFerrari revision: a smaller
opening logo, black LaFerrari, and invisible studio lighting for the products.
The car now enters while the opening mark clears the lens, eliminating the
blank transition frame. Closer, lower tracking cameras give the Ferrari a
full-scale presence while retaining the wheel close-up. Portrait framing uses
a restrained edge crop so the car stays large enough to show body and wheel detail.

## Playback

The front page plays a pre-rendered film instead of running the studio live.
`index.html` scrubs `assets/film/shot-*.mp4` from scroll position; the WebGL
build that produced it is preserved, unchanged, at `/v2/webgl.html`.

The film is encoded **all-intra** — every frame is a keyframe — so a scroll
seek decodes exactly one frame instead of walking a group of pictures.
Measured in Chromium: **19.5 ms median seek against 41.7 ms** for a 48-frame
GOP, with a much tighter tail (29 ms p90 against 72 ms). That costs bitrate,
and it is the entire reason scrubbing does not judder. Do not "optimise" the
GOP without re-measuring.

| | requests | JS | models | film |
| --- | --- | --- | --- | --- |
| `webgl.html` | 48 | 790 KB | 4.3 MB | — |
| `index.html` (desktop) | 6 | 8 KB | — | 7.3 MB |
| `index.html` (≤820px) | 6 | 8 KB | — | 3.8 MB |

Narrow screens get the 854-wide reel, so mobile is lighter than the WebGL
build was as well as costing nothing per frame. Desktop trades about a
megabyte of download for a page that does no GPU work at all.

The three rooms lost their WebGL bands too. Each now plays a short looping
clip cut from the same render (`assets/film/hero-*.mp4`, 300–420 KB), which
took `/services` off the full LaFerrari pipeline. `js/reveal.js` carries the
scroll reveal that used to live inside `js/hero.js`.

### Phones do not scrub

A seek costs a decode. Measured on a 4x-throttled phone, scrubbing the film
runs at about **10 fps** no matter how light the page is — that is the decode,
not the page. And a 16:9 frame cover-cropped into a portrait screen throws the
composition away: you get a door and a wheel instead of a car.

So phones get a different film, not a smaller one. `experience.video.js`
branches on `(max-width:900px), (pointer:coarse) and (max-width:1180px)` and
never enters the scrub loop. The hero becomes a silent looping cut
(`hero-mobile.mp4`, 10s, 1.1 MB) letterboxed into the page's own black, the
five cards become ordinary sections in normal flow, and the whole 20s film is
a tap away behind **Watch the film** instead of nine screens away.

Measured on the same throttled phone:

| | first paint | scroll | page |
| --- | --- | --- | --- |
| WebGL build | 592 ms | 3300 ms/frame | 9 screens |
| scrubbed film | — | 100 ms/frame (~10 fps) | 9 screens |
| phone mode | **236 ms** | **16.7 ms/frame (60 fps)** | **3.2 screens** |

`?desktop=1` forces the scrubbed build on a phone for comparison.

The rooms were loading Google Fonts as a render-blocking stylesheet, which
cost **13.2 seconds to first paint** on a throttled phone — a blank screen
until Google answered. They now use the same non-blocking preload the front
page already used, with a `<noscript>` fallback: 560 ms.

### Regenerating the film

The renders come from `tools/` at the repository root — see `tools/README.md`.
Once `out/frames/` exists:

```sh
ffmpeg -framerate 24 -pattern_type glob -i 'out/frames/pv_*.png' \
  -c:v libx264 -preset slower -crf 27 -g 1 -keyint_min 1 -sc_threshold 0 \
  -pix_fmt yuv420p -movflags +faststart -vf scale=1280:720 -an \
  v2/assets/film/shot-1280.mp4
```

`?src=<relative path>` swaps the reel at runtime for comparing encodes.
`?shot=` and `?frame=` work exactly as they did.

## Preview

From the repository root:

```sh
python3 -m http.server 8768 --bind 127.0.0.1 --directory v2
```

Open `http://127.0.0.1:8768/` and scroll. Optional review links:
`/?shot=logo`, `/?shot=arrival`, `/?shot=car`, `/?shot=wheel`, `/?shot=gallery`, `/?shot=end`, and `/logo-preview.html`.

## Implementation

- `index.html`: the main scene, road, lighting, content and scroll handling.
- `js/cinematic-track.js`: earlier car reveal, continuous following, one smooth
  deceleration, wheel close-up and portrait framing.
- `js/vehicle.js`: Meshopt LaFerrari loading, measured alignment, materials and wheel rigging.
  Tyres, rims and discs rotate with travel while calipers remain fixed.
- `js/mark.js` and `js/mark-outlines.js`: one logo contour extracted from the
  original JPG and reused across the site. Flat placements use the unchanged JPG.
- `js/hero.js`: shared room heroes; the service room uses the LaFerrari's wheel.
- `assets/models/`: preserved source GLBs; LaFerrari alignment is derived from its wheel geometry.
- `assets/models/studio/`: licensed textured studio props plus source and scale metadata.
- `assets/optimized/`: immutable, versioned Meshopt GLBs and WebP imagery used by the live experience.
- `assets/references/`: supplied car photography and its provenance manifest.
- `credits.html`: model attribution, adaptation notes and third-party licenses.
- `lib/`: Three.js r150 and its official loader adapted for the existing runtime.

Vehicle colour overrides convert sRGB swatches to linear values explicitly for
this r150 runtime. Neutral lighting, restrained reflections, and fading the logo
key before the reveal keep the black finish and silver wheels distinct. The LaFerrari uses an explicit
2.65 m wheelbase and the source hierarchy is levelled before grounding the tires.

## Validation

```sh
npm install
npm run assets:optimize
npm test
npm run test:visual -- --url=http://127.0.0.1:8768/ --output=/tmp/pivarion-frames
python3 v2/scripts/build-logo-mesh.py
```

The camera checks cover continuous travel, deceleration and portrait/landscape
framing. The model checks cover geometry, ground alignment, wheel/caliper
separation, required node/material names and black paint colour conversion.
The full-detail compressed model retains all 587,310 triangles and is 2.73 MiB;
the opening LOD is 2.40 MiB. Five studio props total 1.89 MiB, placing the
critical 3D payload at 4.29 MiB. The preserved source Ferrari is 27.0 MB.

The opening renders behind a 31–44 KB pixel-matched WebP poster. Critical
room assets load concurrently; the full Ferrari loads after interaction and
swaps at an existing hidden transition. Rendering runs while scrolling or
settling, pauses on static frames and hidden tabs, and runs at 30 FPS for the
rotating gallery. Add `?perf=1` for live FPS, frame time, DPR, draw calls,
triangles, payload and readiness diagnostics. `PIVARION_V2.info()` exposes the
same measurements. Vercel serves versioned assets for one year with immutable
caching while HTML keeps its normal deployment revalidation behavior.

The car is an artist-authored model; the 3D logo is raster-derived rather than
a vector master.

## Review history and rollback

The development worktree retains `v2-demo/`. Its `previous/` folder preserves the
first Porsche demo, before the camera/lighting revision. The original procedural
V2 was archived there at `v2-demo/backups/v2-before-approved-update.zip` before promotion.
The approved Porsche revision is also preserved at
`v2-demo/backups/v2-approved-porsche-before-laferrari.zip`.
These demo and rollback files are not part of this V2 application.

The performance release rollback commit is
`2d32d3521ffbf334790329ae2334a027373c653f`. Measured source metrics are recorded
in `performance-baseline.json`; optimized payload, runtime and visual-difference
measurements are recorded in `performance-results.json`.
