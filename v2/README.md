# v2 — the cinematic front end

A candidate replacement for the front of **pivarion.com**. It lives under
`/v2` so the live site is untouched; when it is approved, `v2/index.html`
becomes the root and the rooms move up a level.

```
v2/
  index.html          the front page — one file, self-contained
  media/index.html    submit your car · our goal · our social media
  services/index.html video · websites · automated marketing
  products/index.html printed logo · wall art · accessories
  css/pv.css          shared styles for the three rooms
  js/hero.js          the small WebGL band at the top of each room
  lib/three.min.js    three.js r150, vendored (MIT)
```

---

## The front page

One WebGL canvas, one camera, and the scroll bar wired to the dolly track.
There are no cuts: the whole page is a single continuous shot, and the type
cards drop in and out over it.

| t | shot | what is on screen |
| --- | --- | --- |
| 0.00–0.15 | 00 cold open | the mark turns out of the dark and lifts away |
| 0.15–0.47 | 01 media | the car comes past at speed; the camera latches on and tracks it |
| 0.47–0.73 | 02 service | in through the spokes onto the cross-drilled ceramic disc |
| 0.73–0.91 | 03 product | the road becomes a floor and three plinths rise out of it |
| 0.91–1.00 | 04 sign off | a wide, and the mark reseals over the gallery |

**Everything on screen is generated in the file.** No models, no video, no
image files. The car is a side elevation extruded and then sculpted by a
vertex pass; the tyre is a lathed section; the brake disc is a shape with
eighty-odd holes punched through it before extrusion, so you can see the
caliper through them. Textures — asphalt, tread, print layer lines, the
framed artwork, the environment — are painted into canvases at boot.

That is why the page is about 40 KB over the wire plus the renderer, and
why it is sharp at any resolution.

### Editing the shot

Two arrays hold the whole edit, near the bottom of the script:

```js
CAR_X  // [t, x] — where the car is on the road at each point
TRACK  // the camera marks: position, look-at, focal length, roll
```

A `TRACK` entry with `rel:true` is pegged to the car rather than to the
world, which is how the tracking shots stay locked while the car is still
moving. `e:'l'` makes a segment run at constant speed instead of easing —
that is the pass.

Panel timing lives in `PANELS` and the slate text in `SLATE`. Both are
plain lists of `t` ranges; nothing else needs touching to re-cut the film.

### Framing across screen shapes

Every mark was set against a 16:9 frame. On anything squarer the vertical
angle opens up to hold roughly the same width, so a phone gets the whole
car rather than a slice of one. That is the `fit` calculation in the loop.

### Quality

`Q` at the top of the script is the single place the trade-off lives —
pixel ratio, lathe segments, how many holes are drilled, how many speed
streaks. The tier is picked from cores, memory and viewport, not from a
user-agent string.

### Console

```js
PIVARION_V2.seek(0.62)   // jump to a point in the shot
PIVARION_V2.now()        // the smoothed timeline position
PIVARION_V2.info()       // draw calls, triangles, quality tier
```

---

## The three rooms

Conventional pages, deliberately. Each gets one WebGL band at the top —
the mark, the wheel, or the three products — from the shared `js/hero.js`,
and nothing on the page depends on it: if WebGL is missing the band stays
dark under its veil and the content reads exactly the same.

`hero.js` also carries the scroll reveal (`.rise`) the pages share.

---

## Known gaps

- The four social links on `/v2/media` are `href="#"`. Drop the real
  profile URLs in.
- The submit form composes a `mailto:` because there is no backend behind
  it yet. Point it at a form endpoint when there is one.
- The caliper is cast with **PIVARION** on it, not a manufacturer's name —
  deliberately, so nothing on the page borrows another brand's marks.
- `lib/three.min.js` is r150, the last release with a UMD build. Moving to
  the ES-module build later is a one-line change in each page plus an
  import in the script.
