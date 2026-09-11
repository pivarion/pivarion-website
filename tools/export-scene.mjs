/**
 * Bake the front page's shot into a GLB plus a shot file.
 *
 *   node tools/export-scene.mjs <outdir>            [FPS=24 SECS=20 PORT=8899]
 *
 * The page is a live simulation: the camera is sampled from scroll position,
 * the car is a real LaFerrari swapped between two levels of detail, the studio
 * loads as five separate models, and a lot of what reads as light is additive
 * cards. So the export runs the real page frame by frame and records what it
 * actually did.
 *
 *   pivarion-scene.glb   real geometry and materials, with the camera and
 *                        object animation baked in as a glTF clip
 *   pivarion-shot.json   the same animation plus everything glTF cannot
 *                        carry — focal length, visibility, emission levels,
 *                        the whole light rig and the fog
 *
 * The additive cards are deliberately NOT exported. They stand in for light in
 * a rasteriser and mean nothing to a path tracer, so Blender gets the real
 * lights instead — which is why the rig travels in the shot file.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import path from 'node:path';

const OUT    = process.argv[2] || '.';
const FPS    = Number(process.env.FPS  || 24);
const SECS   = Number(process.env.SECS || 20);
const PORT   = Number(process.env.PORT || 8899);
const FRAMES = Math.round(FPS * SECS);
const W = 1920, H = 1080;
mkdirSync(OUT, { recursive: true });

/* Node block-buffers stdout when it is redirected, so milestones also go to a
   log that is flushed on every write — otherwise a 20-minute bake looks hung. */
const LOG = path.join(OUT, 'export.log');
writeFileSync(LOG, '');
const say = m => { const line = `[${new Date().toISOString().slice(11, 19)}] ${m}`;
                   console.log(line); appendFileSync(LOG, line + '\n'); };

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--hide-scrollbars', '--js-flags=--max-old-space-size=6144']
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => window.PV && window.PV.scene, null, { timeout: 300000 });
await page.waitForSelector('body.scene-ready', { timeout: 300000 });
say('scene ready');

// The full-detail car arrives on a deferred load; the export waits for it and
// then pins it, so the render is not at the mercy of the LOD swap.
await page.waitForFunction(() => window.PV.pinFull() === 'full', null, { timeout: 300000 });
say('vehicle: full detail, pinned');

const shot = await page.evaluate(async ({ FRAMES, FPS, VW, VH }) => {
  const PV = window.PV, THREE = PV.THREE;
  PV.pause();

  /* Name the things the shot moves. Everything else keeps whatever name it
     arrived with, which for the studio props is the original model's. */
  PV.camera.name = 'PV_Camera';
  PV.mark.name   = 'PV_Mark';
  PV.floor.name  = 'PV_Floor';
  PV.studio.name = 'PV_Studio';
  const car = PV.car();
  car.name = 'PV_Car';
  const tracked = [PV.camera, car, PV.mark];
  PV.wheels().forEach((w, i) => {
    w.name = 'PV_Wheel_' + i;
    w.userData.turn.name = 'PV_WheelSpin_' + i;
    tracked.push(w.userData.turn);
  });
  PV.plinths.forEach((p, i) => { p.name = 'PV_Plinth_' + i; tracked.push(p); });
  PV.products.forEach((o, i) => { o.name = 'PV_Product_' + i; tracked.push(o); });
  if (!PV.camera.parent) PV.scene.add(PV.camera);

  /* three leaves material.name empty, which turns the whole library into
     Material_0..N on the far side. Name them so Blender can address them. */
  Object.keys(PV.MAT).forEach(k => { if (PV.MAT[k]) PV.MAT[k].name = 'PV_' + k; });
  let anon = 0;
  PV.scene.traverse(o => {
    if (o.isMesh && o.material) {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach(m => { if (!m.name) m.name = 'PV_anon_' + (anon++); });
    }
  });

  const N = tracked.length;
  const pos  = tracked.map(() => new Float32Array(FRAMES * 3));
  const quat = tracked.map(() => new Float32Array(FRAMES * 4));
  const scl  = tracked.map(() => new Float32Array(FRAMES * 3));
  const times = new Float32Array(FRAMES);
  const frames = [];

  /* every light in the scene, however deep in the studio it sits */
  const lights = [];
  PV.scene.traverse(o => { if (o.isLight) lights.push(o); });
  const lightId = l => l.name || l.type + '_' + lights.indexOf(l);
  lights.forEach((l, i) => { if (!l.name) l.name = l.type + '_' + i; });

  const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
  PV.rewind();
  for (let f = 0; f < FRAMES; f++) {
    const t = FRAMES > 1 ? f / (FRAMES - 1) : 0;
    const info = PV.bake(t, f, FPS);
    times[f] = f / FPS;
    for (let i = 0; i < N; i++) {
      const o = tracked[i];
      o.updateMatrixWorld(true);
      pos[i].set([o.position.x, o.position.y, o.position.z], f * 3);
      quat[i].set([o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w], f * 4);
      scl[i].set([o.scale.x, o.scale.y, o.scale.z], f * 3);
    }
    PV.camera.getWorldPosition(wp); PV.camera.getWorldQuaternion(wq);
    const r6 = v => +v.toFixed(5);
    frames.push({
      f, t: +t.toFixed(6),
      cam: { p: [wp.x, wp.y, wp.z].map(r6),
             q: [wq.x, wq.y, wq.z, wq.w].map(v => +v.toFixed(6)),
             fov: +info.fov.toFixed(4), roll: +info.roll.toFixed(5) },
      carX: +info.carX.toFixed(5),
      vis: Object.fromEntries(tracked.map(o => [o.name, o.visible])),
      emit: Object.fromEntries(Object.keys(PV.MAT)
        .filter(k => PV.MAT[k] && PV.MAT[k].emissiveIntensity !== undefined)
        .map(k => ['PV_' + k, +PV.MAT[k].emissiveIntensity.toFixed(4)])),
      lit: Object.fromEntries(lights.map(l => [l.name, {
        i: +l.intensity.toFixed(4),
        p: [l.position.x, l.position.y, l.position.z].map(r6)
      }]))
    });
  }

  const clip = new THREE.AnimationClip('PivarionShot', FRAMES / FPS, tracked.flatMap((o, i) => [
    new THREE.VectorKeyframeTrack(o.name + '.position', times, pos[i]),
    new THREE.QuaternionKeyframeTrack(o.name + '.quaternion', times, quat[i]),
    new THREE.VectorKeyframeTrack(o.name + '.scale', times, scl[i])
  ]));
  window.__clip = clip;

  /* the additive cards stand in for light; Blender gets real lights instead */
  let dropped = 0, kept = 0;
  PV.scene.traverse(o => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const fake = o.isInstancedMesh || (m && m.isMeshBasicMaterial);
    o.visible = !fake;
    fake ? dropped++ : kept++;
  });
  PV.mark.visible = true;
  PV.plinths.forEach(p => { p.visible = true; });
  car.visible = true;
  car.position.x = PV.carAt(0.52);          // a readable rest pose

  const lv = o => [o.position.x, o.position.y, o.position.z];
  const hexOf = c => c.getHex();
  return {
    meta: { fps: FPS, frames: FRAMES, seconds: FRAMES / FPS, width: VW, height: VH,
            source: 'v2/index.html', variant: PV.variant(), kept, dropped,
            materials: Array.from(new Set(
              (() => { const n = []; PV.scene.traverse(o => {
                if (o.isMesh && o.visible)
                  (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m && n.push(m.name));
              }); return n; })())).sort() },
    rig: {
      fog: PV.fog(),
      exposure: PV.exposure(),
      lights: lights.map(l => {
        const e = { name: l.name, type: l.type, colour: hexOf(l.color),
                    intensity: l.intensity, p: lv(l) };
        l.getWorldPosition(wp); e.world = [wp.x, wp.y, wp.z];
        if (l.target) { l.target.getWorldPosition(wp); e.target = [wp.x, wp.y, wp.z]; }
        if (l.isSpotLight) { e.angle = l.angle; e.penumbra = l.penumbra; }
        if (l.distance !== undefined) e.distance = l.distance;
        if (l.decay !== undefined) e.decay = l.decay;
        if (l.groundColor) e.ground = hexOf(l.groundColor);
        return e;
      })
    },
    frames
  };
}, { FRAMES, FPS, VW: W, VH: H });

say(`baked ${shot.meta.frames} frames of the "${shot.meta.variant}" car`);
console.log(`  kept ${shot.meta.kept} meshes, dropped ${shot.meta.dropped} light cards`);
console.log(`  ${shot.rig.lights.length} lights: ` +
  shot.rig.lights.map(l => l.type).filter((v, i, a) => a.indexOf(v) === i).join(', '));
writeFileSync(path.join(OUT, 'pivarion-shot.json'), JSON.stringify(shot));

// ── GLB ───────────────────────────────────────────────────────────────
const bytes = await page.evaluate(() => new Promise((res, rej) => {
  new THREE.GLTFExporter().parse(window.PV.scene, glb => {
    window.__glb = new Uint8Array(glb);
    res(window.__glb.length);
  }, rej, { binary: true, onlyVisible: true, animations: [window.__clip] });
}));
say(`GLB is ${(bytes / 1048576).toFixed(1)} MB — transferring`);

const CHUNK = 4 * 1024 * 1024, parts = [];
for (let off = 0; off < bytes; off += CHUNK) {
  const b64 = await page.evaluate(([o, c]) => {
    const v = window.__glb.subarray(o, Math.min(o + c, window.__glb.length));
    let s = '';
    for (let i = 0; i < v.length; i += 8192)
      s += String.fromCharCode.apply(null, v.subarray(i, i + 8192));
    return btoa(s);
  }, [off, CHUNK]);
  parts.push(Buffer.from(b64, 'base64'));
}
const glb = Buffer.concat(parts);
if (glb.length !== bytes) throw new Error(`transfer truncated: ${glb.length} of ${bytes}`);
writeFileSync(path.join(OUT, 'pivarion-scene.glb'), glb);
say(`wrote pivarion-scene.glb (${(glb.length / 1048576).toFixed(1)} MB)`);

await browser.close();
