# Pivarion V2

The cinematic front end, with the September 4 LaFerrari revision: a smaller
opening logo, black LaFerrari, and invisible studio lighting for the products.
The car now enters while the opening mark clears the lens, eliminating the
blank transition frame. Closer, lower tracking cameras give the Ferrari a
full-scale presence while retaining the wheel close-up. Portrait framing uses
a restrained edge crop so the car stays large enough to show body and wheel detail.

## Preview

From the repository root:

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory v2
```

Open `http://127.0.0.1:8766/` and scroll. Optional review links:
`/?shot=logo`, `/?shot=arrival`, `/?shot=car`, `/?shot=wheel`, `/?shot=gallery`, `/?shot=end`, and `/logo-preview.html`.

## Implementation

- `index.html`: the main scene, road, lighting, content and scroll handling.
- `js/cinematic-track.js`: earlier car reveal, continuous following, one smooth
  deceleration, wheel close-up and portrait framing.
- `js/vehicle.js`: LaFerrari loading, measured alignment, materials and wheel rigging.
  Tyres, rims and discs rotate with travel while calipers remain fixed.
- `js/mark.js` and `js/mark-outlines.js`: one logo contour extracted from the
  original JPG and reused across the site. Flat placements use the unchanged JPG.
- `js/hero.js`: shared room heroes; the service room uses the LaFerrari's wheel.
- `assets/models/`: unchanged downloaded GLBs; LaFerrari alignment is derived from its wheel geometry.
- `assets/references/`: supplied car photography and its provenance manifest.
- `credits.html`: model attribution, adaptation notes and third-party licenses.
- `lib/`: Three.js r150 and its official loader adapted for the existing runtime.

Vehicle colour overrides convert sRGB swatches to linear values explicitly for
this r150 runtime. Neutral lighting, restrained reflections, and fading the logo
key before the reveal keep the black finish and silver wheels distinct. The LaFerrari uses an explicit
2.65 m wheelbase and the source hierarchy is levelled before grounding the tires.

## Validation

```sh
node v2/scripts/verify-camera.cjs
node v2/scripts/verify-model.cjs
python3 v2/scripts/build-logo-mesh.py
```

The camera checks cover continuous travel, deceleration and portrait/landscape
framing. The model checks cover geometry, ground alignment, wheel/caliper
separation and black paint colour conversion. The model check omits texture references
only from its in-memory input; production uses the complete original GLB.
JavaScript syntax, local links and preview HTTP responses were also checked.
Car, reveal and wheel shots were visually reviewed in the local browser.

The LaFerrari GLB is 27.0 MB with about 587,000 triangles. Device performance and delivery
compression should be assessed before publishing. The car is an artist-authored
model; the 3D logo is raster-derived rather than a vector master.

## Review history and rollback

The development worktree retains `v2-demo/`. Its `previous/` folder preserves the
first Porsche demo, before the camera/lighting revision. The original procedural
V2 was archived there at `v2-demo/backups/v2-before-approved-update.zip` before promotion.
The approved Porsche revision is also preserved at
`v2-demo/backups/v2-approved-porsche-before-laferrari.zip`.
These demo/rollback files are not copied into this V2 application.
