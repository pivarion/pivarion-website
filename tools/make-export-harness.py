#!/usr/bin/env python3
"""
Turn v2/ into an export harness.

    python3 tools/make-export-harness.py <harnessdir> <three-package-dir>

The page is a live simulation, not a scene file, and everything it builds
lives inside one async closure. This copies the site and makes four changes
to the copy — the shipped files are never touched:

  1. add lib/GLTFExporter.js, global-ified against the page's own UMD three
     exactly the way lib/GLTFLoader.js already is, so exporter and scene
     share one three.js instance
  2. split the render loop into `stepScene(now)` and the rAF `tick`, so a
     frame can be advanced by hand at an exact timestamp
  3. let the vehicle LOD be pinned, so the export gets the full-detail car
     instead of whichever variant the scroll position happened to want
  4. hang the closure's internals off `window.PV`

Everything the harness needs is derived from the real page, so the export
cannot drift from what ships.
"""
import re, shutil, sys, pathlib

OUT   = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'harness')
THREE = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'three')
SRC   = pathlib.Path('v2')

if OUT.exists():
    shutil.rmtree(OUT)
shutil.copytree(SRC, OUT)

# ── 1. GLTFExporter against the global THREE ──────────────────────────
exp = (THREE / 'examples/jsm/exporters/GLTFExporter.js').read_text()
exp = re.sub(r'^import \{(.*?)\} from \'three\';',
             lambda m: '(function(){\nconst {%s} = window.THREE;' % m.group(1),
             exp, count=1, flags=re.S | re.M)
assert exp.startswith('(function(){'), 'import block not rewritten'
exp = exp.replace('export { GLTFExporter };',
                  'window.THREE.GLTFExporter = GLTFExporter;\n})();')
(OUT / 'lib/GLTFExporter.js').write_text(
    '/* three.js r150 GLTFExporter — MIT. Only the module wrapper was adapted '
    'for the existing global THREE build, matching lib/GLTFLoader.js. */\n' + exp)

html = OUT / 'index.html'
h = html.read_text()
assert '<script src="lib/GLTFLoader.js?v=r150" defer></script>' in h
h = h.replace('<script src="lib/GLTFLoader.js?v=r150" defer></script>',
              '<script src="lib/GLTFLoader.js?v=r150" defer></script>\n'
              '<script src="lib/GLTFExporter.js" defer></script>')
html.write_text(h)

# ── the scene ─────────────────────────────────────────────────────────
js = OUT / 'js/experience.v1.js'
s = js.read_text()

def once(a, b):
    global s
    assert s.count(a) == 1, 'anchor not unique: %r (%d)' % (a[:60], s.count(a))
    s = s.replace(a, b, 1)

# ── 2. a frame you can advance by hand ────────────────────────────────
once("""function tick(now){
  raf=0;
  if (hidden) return;
  var dt = Math.min(0.05, (now - prev) / 1000 || 0.016); prev = now; clock += dt;""",
"""var __paused = false, __lockVehicle = false;
function tick(now){
  raf=0;
  if (hidden || __paused) return;
  stepScene(now);
}
function stepScene(now){
  var dt = Math.min(0.05, (now - prev) / 1000 || 0.016); prev = now; clock += dt;""")

# ── 3. hold the full-detail car for the whole export ──────────────────
once("""  if(activeModelVariant==='full' && t>=0.735) activateVehicle(wideVehicle,'wide');""",
     """  if(__lockVehicle){ /* pinned for export */ }
  else if(activeModelVariant==='full' && t>=0.735) activateVehicle(wideVehicle,'wide');""")

# ── 4. the closure, opened up ─────────────────────────────────────────
once("""W.PIVARION_V2 = {""", """W.PV = {
  THREE: THREE, renderer: renderer, scene: scene, camera: camera, world: world,
  studio: studio, floor: floor, barGroup: barGroup, streaks: streaks, MAT: MAT,
  mark: mark, plinths: plinths, products: spin, GX: GX,
  cinematic: cinematic, carAt: carAt,
  vehicle: function(){ return vehicle; },
  car: function(){ return car; },
  wheels: function(){ return wheels; },
  variant: function(){ return activeModelVariant; },
  lights: { key:key, rim:rim, fill:fill, edge:edge,
            brake:brakeLight, wheelKey:wheelKey, markKey:markKey },
  fog: function(){ return { color: scene.fog.color.getHex(), density: scene.fog.density }; },
  exposure: function(){ return renderer.toneMappingExposure; },
  pause: function(){ __paused = true; },
  /* Swap to the full-detail car and keep it, so the export is not at the
     mercy of whichever LOD the scroll position wanted. */
  pinFull: function(){
    __lockVehicle = false;
    if (fullVehicle) activateVehicle(fullVehicle, 'full');
    __lockVehicle = true;
    return activeModelVariant;
  },
  /* One frame, at an exact point on the timeline and an exact clock time.
     Stepping t forward monotonically keeps the integrals in the loop —
     wheel rotation and streak drift — identical to the live page. */
  bake: function(t, frame, fps){
    var nowMs = frame * 1000 / fps;
    tTarget = t; tNow = t;
    prev = nowMs - 1000 / fps;
    stepScene(nowMs);
    return { fov: camFov, roll: camRoll, carX: carAt(t) };
  },
  rewind: function(){
    prev = 0; clock = 0; travel = 0;
    tNow = 0; tTarget = 0; lastCarX = carAt(0);
  }
};

W.PIVARION_V2 = {""")

js.write_text(s)
print('harness -> %s' % OUT)
print('  index.html + lib/GLTFExporter.js (%d KB)' % (len(exp) // 1024))
print('  js/experience.v1.js patched (%d lines)' % len(s.splitlines()))
