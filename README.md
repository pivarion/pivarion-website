# pivarion-website

Landing experience for **pivarion.ca** — a navigable 3D solar system where each
service is a planet, and each planet can contain a system of its own.

Live: [pivarion-website.vercel.app](https://pivarion-website.vercel.app)

---

## What this is

A single self-contained `index.html`. No build step, no dependencies to
install, no asset folder. Three.js loads from a CDN; every planet surface is
generated procedurally in the browser at load; the brand marks are embedded in
the file as base64.

Deploying is copying one file.

## Running it

The file must be **served over http(s)**, not opened from disk — browsers block
ES module imports on `file://`, so double-clicking it shows a blank page.

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

## Deploying

Push to `main`. Vercel redeploys automatically, usually within a minute.

`index.html` must stay at the repo root, or it won't be served as the homepage.
After a deploy, hard-reload (Cmd/Ctrl + Shift + R) — the file is large and
cached aggressively.

---

## Adding a moon

The whole system is a data tree near the top of the script. Everything else —
geometry, orbit rings, labels, click handling, camera framing — is derived from
it.

```js
{
  id: 'logistics',
  name: 'PIVARION LOGISTICS',
  radius: 2.28,
  surface: 'cratered',      // one of the ARCHETYPES below
  tint: 0x6f7887,
  mark: 'logistics',        // key into MARK_SRC, optional
  children: []              // fill this and the body becomes enterable
}
```

Drop that into any `children` array. Position is optional: omit `at` and the
body is placed automatically, spaced evenly, pushed out far enough to clear its
planet, with the camera pulled back to keep everything in frame.

A body with a non-empty `children` array can be clicked to descend into its own
system. One with an empty array shows "COMING SOON".

### Adding a mark

Marks are white-on-black artwork embedded as base64 in `MARK_SRC`. To add one,
crop the artwork square, resize to 448×448, reduce to a small palette, and
base64-encode the PNG. The shader reads luminance as coverage, so white becomes
the mark and black becomes nothing.

The mark is rendered as a decal in the shader — it brightens the albedo and
perturbs the surface normal, so it catches light like part of the terrain
rather than sitting on top as a sticker.

### Surface archetypes

Five procedural surfaces, shared by reference across every body:

| key | character |
| --- | --- |
| `main` | the hero planet, higher resolution |
| `cratered` | dense small impacts, few dark plains |
| `weathered` | sparse large craters, broad maria |
| `basalt` | darkest, heavy dark plains |
| `pale` | light and even, moderate cratering |

Ten moons using `cratered` cost the same memory as one. Only the small mark
decal is unique per body.

---

## Architecture notes

**Data-driven.** The scene is built from the tree, so adding bodies never means
touching scene code.

**Shared geometry.** Every body reuses one sphere and varies by scale.

**Texture pool.** Surfaces are generated once, reference-counted, and kept warm
after release so navigating back is instant. Eviction only happens past
`POOL_LIMIT`, oldest unused first.

**Lifecycle.** Entering a system disposes the previous one entirely, so memory
stays flat however deep the tree goes.

**Quality tiers.** Phones and tablets generate at roughly a quarter of the
texture area with lower mesh detail — the `Q` object at the top is the single
place that trade-off lives.

**Frame budget.** 60fps while interacting, 30 when the scene is only drifting,
nothing at all when the tab is hidden.

---

## Console helpers

With the page open, in the browser console:

```js
PIVARION.stats()            // live geometry, texture and memory figures
PIVARION.exportSurfaces()   // download generated surfaces as PNGs
PIVARION.system             // the data tree
```

`exportSurfaces()` exists for the eventual move from generating surfaces at
runtime to shipping them as static files — the biggest remaining load-time win.

---

## Known limits

- Surfaces regenerate on every page load; nothing caches between visits.
  A few seconds on desktop, longer on phones.
- The page grows with each embedded mark. Past a dozen or so they should move
  to separate files so they cache independently.
- Mobile is functional but untuned — framing and interaction were designed for
  desktop first.
- The display typeface is Michroma, a stand-in for the real brand face.
