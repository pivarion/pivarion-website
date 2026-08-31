
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ═══════════════════════════════════════════════════════════════════════
   BRAND ARTWORK — loaded from /marks, discovered from the content tree
   ═══════════════════════════════════════════════════════════════════════ */
const MARKS = {};
const markKeys = new Set();
(function collect(n) { if (n.mark) markKeys.add(n.mark); (n.children || []).forEach(collect); })(SYSTEM);

await Promise.all([...markKeys].map(async k => {
  const im = new Image();
  im.src = `marks/${k}.png`;
  try { await im.decode(); MARKS[k] = im; } catch (e) { console.warn('missing mark:', k); }
}));

/* ═══════════════════════════════════════════════════════════════════════
   0 · QUALITY TIERS
   One place to trade fidelity for memory. Phones get a quarter of the
   texture area and half the mesh detail.
   ═══════════════════════════════════════════════════════════════════════ */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small   = innerWidth < 760;
const lowMem  = small || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const Q = {
  surface:  lowMem ?  768 : 1536,   // shared archetype surfaces
  hero:     lowMem ? 1024 : 2048,   // the body you can zoom closest to
  mark:     lowMem ?  256 :  512,   // per-body decal, the only unique texture
  lights:   lowMem ? 1024 : 2048,
  segments: lowMem ?   64 :  128,
  dpr:      Math.min(devicePixelRatio, lowMem ? 1.5 : 2)
};

import { SYSTEM, ARCHETYPES } from './system.js';

/* Give every node a reference to its parent so navigation can climb back out */
(function link(node, parent) {
  node.parent = parent;
  (node.children || []).forEach(c => link(c, node));
})(SYSTEM, null);

/* Auto-layout for bodies without an explicit position.
   Angle sets are hand-chosen for small counts so bodies land in the corners
   rather than straight above or below the planet; larger counts fall back to
   an even spread. Every position is then pushed out until it clears the
   centre body, so a moon can never intersect its planet. */
const ANGLE_SETS = {
  1: [135],
  2: [150, 30],
  3: [152, 28, 262],
  4: [135, 45, 315, 225],
  5: [150, 66, 14, 292, 236],
  6: [150, 90, 30, 330, 270, 210]
};

function autoPlace(i, n, centreRadius, bodyRadius) {
  const set = ANGLE_SETS[n];
  const deg = set ? set[i] : 135 - i * (360 / n);
  const a = deg * Math.PI / 180;

  let x = Math.cos(a) * 12.0;
  let y = Math.sin(a) * 7.0;

  // push outward along the same bearing until it clears the centre body
  const clear = centreRadius + bodyRadius + 1.6;
  const d = Math.hypot(x, y - 0.4);
  if (d < clear) { const k = clear / d; x *= k; y = 0.4 + (y - 0.4) * k; }

  return { x, y, z: 3.0 };
}

/* ═══════════════════════════════════════════════════════════════════════
   2 · LOADING FEEDBACK
   ═══════════════════════════════════════════════════════════════════════ */
const loadMsg = document.getElementById('loadmsg');
const loadBar = document.getElementById('loadbar');
let stepN = 0, stepTotal = 8;
async function step() {
  stepN++;
  loadBar.style.width = Math.min(100, Math.round(stepN / stepTotal * 100)) + '%';
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
}

if (!document.createElement('canvas').getContext('webgl2') &&
    !document.createElement('canvas').getContext('webgl')) {
  loadMsg.textContent = 'PIVARION — COMING SOON — HELLO@PIVARION.CA';
  loadBar.parentElement.style.display = 'none';
  throw new Error('WebGL unavailable');
}

/* ═══════════════════════════════════════════════════════════════════════
   3 · SURFACE GENERATION
   ═══════════════════════════════════════════════════════════════════════ */
function rnd(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

function noiseSampler(gw, gh, seed) {
  const r = rnd(seed);
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const X0 = ((xi % gw) + gw) % gw, X1 = (X0 + 1) % gw;
    const Y0 = ((yi % gh) + gh) % gh, Y1 = (Y0 + 1) % gh;
    const a = g[Y0 * gw + X0], b = g[Y0 * gw + X1];
    const c = g[Y1 * gw + X0], d = g[Y1 * gw + X1];
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  };
}

function fbmField(W, H, seed, octaves) {
  const gw = 12, gh = 6;
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push(noiseSampler(gw << o, gh << o, seed + o * 1319));
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      let f = 0, a = 0.5, norm = 0;
      for (let o = 0; o < octaves; o++) { f += a * layers[o](u * (gw << o), v * (gh << o)); norm += a; a *= 0.5; }
      out[y * W + x] = f / norm;
    }
  }
  return out;
}

function carve(height, floorMask, W, H, cx, cy, rad, depth, seed) {
  const latScale = 1 / Math.max(Math.cos((cy / H - 0.5) * Math.PI), 0.18);
  const rx = rad * latScale;
  const x0 = Math.floor(cx - rx * 1.7), x1 = Math.ceil(cx + rx * 1.7);
  const y0 = Math.max(0, Math.floor(cy - rad * 1.7)), y1 = Math.min(H - 1, Math.ceil(cy + rad * 1.7));
  const wob = 0.9 + rnd(seed)() * 0.2;
  for (let y = y0; y <= y1; y++) {
    const dy = (y - cy) / rad;
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx;
      const d = Math.sqrt(dx * dx + dy * dy) / wob;
      if (d > 1.7) continue;
      const i = y * W + (((x % W) + W) % W);
      if (d < 0.82) {
        const t = d / 0.82;
        height[i] -= depth * (1 - t * t) * 0.85;
        floorMask[i] = Math.min(1, floorMask[i] + (1 - t * t) * 0.7);
      }
      height[i] += depth * Math.exp(-Math.pow((d - 0.93) / 0.13, 2)) * 0.75;
      if (d > 1.0) height[i] += depth * Math.exp(-Math.pow((d - 1.0) / 0.55, 2)) * 0.12;
    }
  }
}

function generateSurface(W, opt) {
  const H = W >> 1;
  const r = rnd(opt.seed + 5501);
  const height = fbmField(W, H, opt.seed, 6);
  const fine   = fbmField(W, H, opt.seed + 77, 4);
  const maria  = fbmField(W, H, opt.seed + 401, 3);
  const floorMask = new Float32Array(W * H);
  for (let i = 0; i < height.length; i++) height[i] = height[i] * 0.7 + fine[i] * 0.3;

  const craters = Math.round(W * 0.55 * opt.density);
  for (let c = 0; c < craters; c++) {
    carve(height, floorMask, W, H,
      r() * W, H * 0.06 + r() * H * 0.88,
      (W / 700) * (2 + Math.pow(r(), 3.4) * 60 * opt.bigness),
      0.035 + r() * 0.055, opt.seed + c * 17);
  }

  const acv = document.createElement('canvas'); acv.width = W; acv.height = H;
  const aimg = acv.getContext('2d').createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const m = Math.max(0, Math.min(1, (maria[i] - 0.47) * 6));
    let lum = opt.base + (height[i] - 0.5) * 88 + (fine[i] - 0.5) * 24;
    lum *= 1 - m * opt.maria;
    lum *= 1 - floorMask[i] * 0.18;
    lum = Math.max(16, Math.min(228, lum));
    const j = i * 4;
    aimg.data[j] = lum * 0.99; aimg.data[j+1] = lum; aimg.data[j+2] = lum * 1.05; aimg.data[j+3] = 255;
  }
  acv.getContext('2d').putImageData(aimg, 0, 0);

  const ncv = document.createElement('canvas'); ncv.width = W; ncv.height = H;
  const nimg = ncv.getContext('2d').createImageData(W, H);
  const strength = W * 0.16;
  for (let y = 0; y < H; y++) {
    const yn = Math.max(0, y - 1), yp = Math.min(H - 1, y + 1);
    for (let x = 0; x < W; x++) {
      const xn = (x - 1 + W) % W, xp = (x + 1) % W;
      const dx = (height[y*W+xp] - height[y*W+xn]) * strength;
      const dy = (height[yp*W+x] - height[yn*W+x]) * strength;
      const len = Math.sqrt(dx*dx + dy*dy + 1);
      const j = (y*W + x) * 4;
      nimg.data[j] = (-dx/len*0.5+0.5)*255; nimg.data[j+1] = (-dy/len*0.5+0.5)*255;
      nimg.data[j+2] = (1/len*0.5+0.5)*255; nimg.data[j+3] = 255;
    }
  }
  ncv.getContext('2d').putImageData(nimg, 0, 0);

  const RW = W >> 1, RH = H >> 1;
  const rcv = document.createElement('canvas'); rcv.width = RW; rcv.height = RH;
  const rimg = rcv.getContext('2d').createImageData(RW, RH);
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
    const src = (y*2)*W + (x*2);
    const v = 250 - fine[src]*44 - floorMask[src]*26;
    const j = (y*RW + x)*4;
    rimg.data[j] = rimg.data[j+1] = rimg.data[j+2] = v; rimg.data[j+3] = 255;
  }
  rcv.getContext('2d').putImageData(rimg, 0, 0);

  return { albedo: acv, normal: ncv, rough: rcv };
}

function lightsCanvas(W, seed) {
  const H = W >> 1;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const r = rnd(seed);
  for (let c = 0; c < 38; c++) {
    const cx = r()*W, cy = H*0.2 + r()*H*0.6, spread = W*(0.008 + r()*0.035);
    const count = 60 + Math.floor(r()*320);
    for (let i = 0; i < count; i++) {
      const a = r()*Math.PI*2, d = Math.pow(r(), 0.55)*spread;
      const s = W/4096*(0.7 + r()*0.9);
      ctx.fillStyle = `rgba(255,${168+(r()*60|0)},${96+(r()*60|0)},${0.28+r()*0.55})`;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a)*d, cy + Math.sin(a)*d*0.62, s, 0, 6.2832); ctx.fill();
    }
  }
  return cv;
}

/* ═══════════════════════════════════════════════════════════════════════
   4 · TEXTURE POOL
   Archetypes are generated once, on demand, and shared by every body that
   references them. `release()` frees anything no longer referenced.
   ═══════════════════════════════════════════════════════════════════════ */
const pool = new Map();   // key -> { textures, canvases, refs }

function texFrom(cv, srgb) {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

const POOL_LIMIT = 8;   // generated surfaces kept warm; there are only ~5 archetypes

function acquireSurface(key) {
  let entry = pool.get(key);
  if (!entry) {
    const canvases = generateSurface(key === 'main' ? Q.hero : Q.surface, ARCHETYPES[key]);
    entry = {
      refs: 0,
      canvases,
      map: texFrom(canvases.albedo, true),
      normalMap: texFrom(canvases.normal, false),
      roughnessMap: texFrom(canvases.rough, false)
    };
    pool.set(key, entry);
  }
  entry.refs++;
  entry.used = performance.now();
  return entry;
}

/* Releasing only drops the reference. The surface stays in the pool so
   navigating back is instant — regenerating it was the delay. */
function releaseSurface(key) {
  const entry = pool.get(key);
  if (entry) { entry.refs = Math.max(0, entry.refs - 1); entry.used = performance.now(); }
  trimPool();
}

/* Only evict when the pool outgrows its limit, oldest unused first. */
function trimPool() {
  while (pool.size > POOL_LIMIT) {
    let victim = null;
    pool.forEach((e, k) => {
      if (e.refs > 0) return;
      if (!victim || e.used < victim.e.used) victim = { k, e };
    });
    if (!victim) return;
    victim.e.map.dispose(); victim.e.normalMap.dispose(); victim.e.roughnessMap.dispose();
    pool.delete(victim.k);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   5 · SCENE
   ═══════════════════════════════════════════════════════════════════════ */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 900);

const renderer = new THREE.WebGLRenderer({ antialias: !small });
renderer.setPixelRatio(Q.dpr);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x04060a, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x2b3650, 0.34));
const key = new THREE.DirectionalLight(0xeaf0ff, 3.2);
key.position.set(-14, 9, 16);
scene.add(key);
const rim = new THREE.DirectionalLight(0x7fa4f0, 0.75);
rim.position.set(12, -4, -14);
scene.add(rim);

/* one sphere, reused by every body — scale carries the size */
const SPHERE = new THREE.SphereGeometry(1, Q.segments, Math.round(Q.segments * 0.75));

function starfield(count, spread, size, opacity) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = spread * (0.55 + Math.random() * 0.45);
    const t = Math.acos(2 * Math.random() - 1), ph = Math.random() * Math.PI * 2;
    pos[i*3] = r*Math.sin(t)*Math.cos(ph); pos[i*3+1] = r*Math.sin(t)*Math.sin(ph); pos[i*3+2] = r*Math.cos(t);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xffffff, size, sizeAttenuation: true, transparent: true, opacity, depthWrite: false
  }));
}
const farStars = starfield(lowMem ? 1200 : 3200, 180, 0.4, 0.9);
scene.add(farStars, starfield(lowMem ? 300 : 700, 80, 0.18, 0.5));

const composer = new EffectComposer(renderer);
composer.setPixelRatio(Q.dpr);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), lowMem ? 0.5 : 0.75, 0.7, 0.68));
composer.addPass(new OutputPass());

/* ═══════════════════════════════════════════════════════════════════════
   6 · BODIES
   The brand mark is a small decal sampled in the shader, not baked into a
   full-size texture. That keeps per-body cost at ~0.3 MB instead of ~24 MB.
   ═══════════════════════════════════════════════════════════════════════ */
/* x,y = corner in UV · z,w = width,height. v gets double the extent because
   the map is 2:1, so equal degrees means unequal UV. */
const MARK_RECT = new THREE.Vector4(0.35, 0.232, 0.30, 0.60);
const nightShaders = [];

const markCache = new Map();
function markTexture(name, img) {
  let t = markCache.get(name);
  if (t) return t;
  const cv = document.createElement('canvas');
  cv.width = cv.height = Q.mark;
  cv.getContext('2d').drawImage(img, 0, 0, Q.mark, Q.mark);
  t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  markCache.set(name, t);
  return t;
}

let lightsTex = null;
function cityLights() {
  if (!lightsTex) lightsTex = texFrom(lightsCanvas(Q.lights, 31), true);
  return lightsTex;
}

function makeBody(node, asCentre) {
  const surf = acquireSurface(node.surface);
  const mat = new THREE.MeshStandardMaterial({
    map: surf.map,
    normalMap: surf.normalMap,
    normalScale: new THREE.Vector2(1.35, 1.35),
    roughnessMap: surf.roughnessMap,
    roughness: 1.0,
    metalness: 0.04,
    color: node.tint
  });

  const markTex = node.mark && MARKS[node.mark] ? markTexture(node.mark, MARKS[node.mark]) : null;

  if (node.lights) {
    mat.emissiveMap = cityLights();
    mat.emissive = new THREE.Color(0xffb070);
    mat.emissiveIntensity = 2.15;
  }

  if (markTex || node.lights) {
    mat.onBeforeCompile = shader => {
      if (markTex) {
        shader.uniforms.uMark = { value: markTex };
        shader.uniforms.uMarkRect = { value: MARK_RECT };
        shader.uniforms.uMarkStrength = { value: 0.90 };
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>
            uniform sampler2D uMark; uniform vec4 uMarkRect; uniform float uMarkStrength;
            float markAt(vec2 uv){
              vec2 m = (uv - uMarkRect.xy) / uMarkRect.zw;
              if (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) return 0.0;
              return texture2D(uMark, m).r;
            }`)
          .replace('#include <map_fragment>', `#include <map_fragment>
            float mA = markAt(vMapUv) * uMarkStrength;
            vec3 markLit = clamp(diffuseColor.rgb * 1.55 + 0.26, 0.0, 1.0);
            diffuseColor.rgb = mix(diffuseColor.rgb, markLit, mA);`)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            {
              vec2 e = vec2(0.0018, 0.0036);
              float gx = markAt(vMapUv + vec2(e.x,0.0)) - markAt(vMapUv - vec2(e.x,0.0));
              float gy = markAt(vMapUv + vec2(0.0,e.y)) - markAt(vMapUv - vec2(0.0,e.y));
              normal = normalize(normal + vec3(-gx, -gy, 0.0) * 0.45);
            }`);
      }
      if (node.lights) {
        shader.uniforms.uLightDir = { value: new THREE.Vector3(0, 0, 1) };
        shader.fragmentShader = 'uniform vec3 uLightDir;\n' + shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           totalEmissiveRadiance *= smoothstep(0.20, -0.30, dot(normalize(vNormal), normalize(uLightDir)));`
        );
        nightShaders.push(shader);
      }
    };
  }

  const mesh = new THREE.Mesh(SPHERE, mat);
  mesh.scale.setScalar(asCentre ? (node.centreRadius || 5.0) : node.radius);
  mesh.userData = { node, surfaceKey: node.surface, markTex };
  return mesh;
}

/* Aim a body's marked face (local +X, where the decal sits) at the resting
   camera position. Bodies off to the sides need their own angle. */
function faceCamera(mesh) {
  const camPos = new THREE.Vector3(0, HOME.dist * Math.sin(HOME.pol), HOME.dist * Math.cos(HOME.pol));
  const dx = camPos.x - mesh.position.x;
  const dz = camPos.z - mesh.position.z;
  mesh.rotation.y = Math.atan2(-dz, dx);
}

function disposeBody(mesh) {
  scene.remove(mesh);
  mesh.material.dispose();
  releaseSurface(mesh.userData.surfaceKey);
  // geometry, mark decals and the city-lights map are shared caches — kept
}

/* ═══════════════════════════════════════════════════════════════════════
   7 · ORBITS
   ═══════════════════════════════════════════════════════════════════════ */
const orbitVert = `attribute float aAlpha; varying float vA;
void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const orbitFrag = `precision mediump float; varying float vA; uniform vec3 uColor; uniform float uOpacity;
void main(){ gl_FragColor = vec4(uColor, vA * uOpacity); }`;

function orbit(radius, opacity, phase) {
  const N = 320;
  const pos = new Float32Array((N + 1) * 3), alp = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    pos[i*3] = Math.cos(a) * radius; pos[i*3+2] = Math.sin(a) * radius;
    alp[i] = 0.10 + 0.90 * Math.pow(0.5 + 0.5 * Math.cos(a - phase), 1.7);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));
  return new THREE.Line(g, new THREE.ShaderMaterial({
    vertexShader: orbitVert, fragmentShader: orbitFrag,
    uniforms: { uColor: { value: new THREE.Color(0xc4d4f0) }, uOpacity: { value: opacity } },
    transparent: true, depthWrite: false
  }));
}

function disposeLine(l) { scene.remove(l); l.geometry.dispose(); l.material.dispose(); }

/* ═══════════════════════════════════════════════════════════════════════
   8 · SYSTEM LIFECYCLE
   Build the bodies of one node; tear them down completely when leaving.
   This is what keeps memory flat as the tree grows.
   ═══════════════════════════════════════════════════════════════════════ */
let current = null;      // { node, centre, bodies[], rings[], moonRings[] }

function buildSystem(node) {
  const kids = node.children || [];
  const centreRadius = node.centreRadius || 5.0;
  const positions = kids.map((c, i) => c.at || autoPlace(i, kids.length, centreRadius, c.radius));
  fitCamera(positions, kids.map(c => c.radius), centreRadius);

  const centre = makeBody(node, true);
  centre.position.set(0, 0.4, 0);
  faceCamera(centre);
  scene.add(centre);

  const rings = [];
  const ringGroup = new THREE.Group();
  ringGroup.position.copy(centre.position);
  [[8.4, 0.30, 0.6], [12.0, 0.22, 2.4], [16.2, 0.15, 4.1]].forEach(([r, o, ph], i) => {
    const e = orbit(r, o, ph);
    e.rotation.z = (i - 1) * 0.06; e.rotation.x = (i - 1) * 0.04;
    ringGroup.add(e); rings.push(e);
  });
  scene.add(ringGroup);

  const bodies = [], moonRings = [];
  kids.forEach((child, i) => {
    const at = positions[i];
    const m = makeBody(child);
    m.position.set(at.x, at.y, at.z);
    faceCamera(m);
    m.userData.index = i;
    scene.add(m);
    bodies.push(m);

    const e = orbit(child.radius * 1.7, 0.16, i * 1.6);
    e.position.copy(m.position);
    e.rotation.z = (i % 2 ? 1 : -1) * 0.24;
    e.rotation.x = 0.12 + i * 0.05;
    scene.add(e);
    moonRings.push(e);
  });

  current = { node, centre, bodies, rings, ringGroup, moonRings };
  buildLabels();
  return current;
}

function disposeSystem() {
  if (!current) return;
  current.bodies.forEach(disposeBody);
  current.moonRings.forEach(disposeLine);
  current.rings.forEach(r => { r.geometry.dispose(); r.material.dispose(); });
  scene.remove(current.ringGroup);
  disposeBody(current.centre);
  nightShaders.length = 0;
  current = null;
}

/* ═══════════════════════════════════════════════════════════════════════
   9 · OVERLAY — built from the same data
   ═══════════════════════════════════════════════════════════════════════ */
const ui = document.querySelector('.ui');
const titleEl = document.getElementById('title');
const subtitleEl = document.getElementById('subtitle');
const backEl = document.getElementById('back');
const exploreEl = document.getElementById('explore');
let labels = [];

function buildLabels() {
  labels.forEach(el => el.remove());
  labels = (current.node.children || []).map((child, i) => {
    const el = document.createElement('button');
    el.className = 'label';
    el.type = 'button';
    el.setAttribute('aria-label', child.name + (child.children && child.children.length ? '' : ' — coming soon'));
    el.innerHTML = '<span></span>';
    el.querySelector('span').textContent = child.name;
    el.addEventListener('click', () => zoomInto(i));
    el.addEventListener('pointerenter', () => setHover(i));
    el.addEventListener('pointerleave', () => setHover(null));
    el.addEventListener('focus', () => setHover(i));
    el.addEventListener('blur', () => setHover(null));
    ui.appendChild(el);
    return el;
  });
}

function setHover(i) {
  if (!current) return;
  current.moonRings.forEach((ring, k) => { ring.material.uniforms.uOpacity.value = (k === i) ? 0.42 : 0.16; });
}

/* ═══════════════════════════════════════════════════════════════════════
   10 · CAMERA + NAVIGATION
   ═══════════════════════════════════════════════════════════════════════ */
const HOME = { dist: 27, az: 0, pol: 0.20, target: new THREE.Vector3(0, 0.4, 0) };
let MAX_DIST = 29;

/* Pull the camera back just far enough that every body sits inside the frame */
function fitCamera(positions, radii, centreRadius) {
  const tanV = Math.tan((38 * Math.PI / 180) / 2);
  const tanH = tanV * (innerWidth / innerHeight);
  let need = 27;
  positions.forEach((p, i) => {
    need = Math.max(need,
      (Math.abs(p.y - 0.4) + radii[i] + 1.4) / tanV,
      (Math.abs(p.x) + radii[i] + 1.4) / tanH);
  });
  need = Math.max(need, (centreRadius + 2.2) / tanV);
  HOME.dist = Math.min(need, 42);
  MAX_DIST = HOME.dist + 2;
}
const cam  = { dist: 46, az: 0, pol: 0.20, target: HOME.target.clone() };
const goal = { dist: HOME.dist, az: 0, pol: 0.20, target: HOME.target.clone() };
let focused = null;

function minDist() {
  return focused === null ? HOME.dist * 0.46 : current.bodies[focused].scale.x * 3.4;
}

function applyCamera() {
  camera.position.set(
    cam.target.x + cam.dist * Math.cos(cam.pol) * Math.sin(cam.az),
    cam.target.y + cam.dist * Math.sin(cam.pol),
    cam.target.z + cam.dist * Math.cos(cam.pol) * Math.cos(cam.az)
  );
  camera.lookAt(cam.target);
}

function focusBody(i) {
  focused = i;
  const m = current.bodies[i], node = m.userData.node;
  goal.target.copy(m.position);
  goal.dist = m.scale.x * 4.2;
  goal.az = m.position.x > 0 ? 0.55 : -0.55;
  goal.pol = 0.12;
  titleEl.querySelector('h1').textContent = node.name;
  subtitleEl.textContent = 'COMING SOON';
  subtitleEl.classList.remove('enterable');
  labels.forEach(l => l.classList.remove('on'));
  backEl.classList.add('on');
  exploreEl.classList.add('hide');
}

const warpEl = document.getElementById('warp');
let transitioning = false;

/* One click: dive at the moon, veil the swap, arrive in its system pulling back. */
function zoomInto(i) {
  if (transitioning) return;
  const m = current.bodies[i], node = m.userData.node;
  if (!node.children || !node.children.length) { focusBody(i); return; }

  transitioning = true;
  focused = null;
  labels.forEach(l => l.classList.remove('on'));
  exploreEl.classList.add('hide');
  titleEl.classList.remove('on');

  goal.target.copy(m.position);
  goal.dist = m.scale.x * 2.2;
  goal.az = m.position.x > 0 ? 0.35 : -0.35;
  goal.pol = 0.12;
  interacting = true;

  setTimeout(() => warpEl.classList.add('on'), 260);
  setTimeout(() => {
    enterSystem(node);
    warpEl.classList.remove('on');
    transitioning = false;
  }, 560);
}

/* Descend into a body that has its own children. The old system is fully
   torn down first, so memory stays flat however deep you go. */
function enterSystem(node) {
  disposeSystem();
  buildSystem(node);
  focused = null;
  goHome();
  cam.dist = 9;                  // arrive close, then ease out — reads as landing
  goal.dist = HOME.dist;
  titleEl.classList.add('on');
  updateBack();
  interacting = true;
}

function exitSystem() {
  const parent = current.node.parent;
  if (!parent) return;
  const cameFrom = current.node.id;
  enterSystem(parent);
  const i = (parent.children || []).findIndex(c => c.id === cameFrom);
  if (i >= 0) { cam.dist = 15; focusBody(i); }
}

function updateBack() {
  const parent = current.node.parent;
  backEl.textContent = parent ? ('\u2190 BACK TO ' + parent.name) : '\u2190 BACK TO SYSTEM';
}

function goHome() {
  focused = null;
  goal.target.copy(HOME.target);
  goal.dist = HOME.dist; goal.az = HOME.az; goal.pol = HOME.pol;
  titleEl.querySelector('h1').textContent = current.node.name;
  subtitleEl.textContent = current.node.subtitle || '';
  labels.forEach(l => l.classList.add('on'));
  backEl.classList.remove('on');
  exploreEl.classList.remove('hide');
}

function back() {
  if (focused !== null) goHome();
  else if (current.node.parent) exitSystem();
}
backEl.addEventListener('click', back);
document.getElementById('mark').addEventListener('click', () => {
  if (current.node !== SYSTEM) enterSystem(SYSTEM); else goHome();
});
addEventListener('keydown', e => { if (e.key === 'Escape') back(); });

/* ── input ── */
const canvas = renderer.domElement;
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let dragging = false, moved = 0, lastX = 0, lastY = 0, interacting = true;

canvas.addEventListener('pointerdown', e => {
  dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; interacting = true;
  canvas.classList.add('grabbing'); canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  interacting = true;
  if (dragging) {
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    lastX = e.clientX; lastY = e.clientY;
    goal.az -= dx * 0.004;
    goal.pol = Math.max(-0.55, Math.min(0.85, goal.pol + dy * 0.003));
  } else {
    ndc.set((e.clientX/innerWidth)*2-1, -(e.clientY/innerHeight)*2+1);
    ray.setFromCamera(ndc, camera);
    const over = focused === null ? ray.intersectObjects(current.bodies)[0] : null;
    canvas.classList.toggle('pointing', !!over);
    setHover(over ? over.object.userData.index : null);
  }
});
canvas.addEventListener('pointerup', e => {
  dragging = false; canvas.classList.remove('grabbing');
  if (moved > 6) return;
  ndc.set((e.clientX/innerWidth)*2-1, -(e.clientY/innerHeight)*2+1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(current.bodies)[0];
  if (hit) zoomInto(hit.object.userData.index);
  else if (focused !== null) goHome();
});
canvas.addEventListener('wheel', e => {
  interacting = true;
  goal.dist = Math.max(minDist(), Math.min(MAX_DIST, goal.dist + e.deltaY * 0.02));
}, { passive: true });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  interacting = true;
});

/* ── overlay projection ── */
const v = new THREE.Vector3();
function project(vec) {
  v.copy(vec).project(camera);
  return [(v.x*0.5+0.5)*innerWidth, (-v.y*0.5+0.5)*innerHeight, v.z < 1];
}
function placeOverlay() {
  current.bodies.forEach((m, i) => {
    const [x, y, front] = project(new THREE.Vector3(m.position.x, m.position.y - 0.2, m.position.z));
    labels[i].style.left = x + 'px';
    labels[i].style.top = y + 'px';
    labels[i].style.visibility = front ? 'visible' : 'hidden';
  });
  if (focused === null) {
    const [tx, ty] = project(new THREE.Vector3(0, current.centre.position.y - 1.1, 0));
    titleEl.style.left = tx + 'px';
    titleEl.style.top = ty + 'px';
  } else {
    // pinned low-centre so it stays readable however close the camera gets
    titleEl.style.left = (innerWidth / 2) + 'px';
    titleEl.style.top = (innerHeight * 0.78) + 'px';
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   11 · LOOP — adaptive frame rate, paused when hidden
   ═══════════════════════════════════════════════════════════════════════ */
const clock = new THREE.Clock();
let acc = 0, idleTimer = 0;

function settled() {
  return Math.abs(goal.dist - cam.dist) < 0.01 &&
         Math.abs(goal.az - cam.az) < 0.001 &&
         Math.abs(goal.pol - cam.pol) < 0.001 &&
         cam.target.distanceToSquared(goal.target) < 0.0001;
}

function tick() {
  requestAnimationFrame(tick);
  if (document.hidden) return;

  const dt = Math.min(clock.getDelta(), 0.05);
  idleTimer += dt;
  if (idleTimer > 0.4) { interacting = false; }

  // 60fps while something is happening, 30fps when the scene is just drifting
  const busy = interacting || dragging || !settled();
  acc += dt;
  if (!busy && acc < 1 / 30) return;
  acc = 0;

  const k = 1 - Math.pow(0.0016, dt);
  cam.dist += (goal.dist - cam.dist) * k;
  cam.az   += (goal.az   - cam.az)   * k;
  cam.pol  += (goal.pol  - cam.pol)  * k;
  cam.target.lerp(goal.target, k);
  applyCamera();

  if (!reduced) {
    current.centre.rotation.y += dt * 0.008;
    current.bodies.forEach(m => { m.rotation.y += dt * 0.008; });
    current.ringGroup.rotation.y += dt * 0.010;
    farStars.rotation.y += dt * 0.0015;
  }

  if (nightShaders.length) {
    const ld = key.position.clone().normalize().transformDirection(camera.matrixWorldInverse);
    nightShaders.forEach(sh => sh.uniforms.uLightDir && sh.uniforms.uLightDir.value.copy(ld));
  }

  placeOverlay();
  composer.render();
}

addEventListener('pointermove', () => { idleTimer = 0; });
addEventListener('visibilitychange', () => { clock.getDelta(); });

/* ═══════════════════════════════════════════════════════════════════════
   12 · BOOT
   ═══════════════════════════════════════════════════════════════════════ */
await step('LOADING MARKS');

stepTotal = 3 + Object.keys(ARCHETYPES).length;
for (const k of Object.keys(ARCHETYPES)) {
  await step('GENERATING ' + k.toUpperCase());
  acquireSurface(k);          // warm the pool, then release the warm-up ref
  pool.get(k).refs--;
}

await step('BUILDING SYSTEM');
buildSystem(SYSTEM);
goHome();
updateBack();
applyCamera();
tick();

await step('ENTERING ORBIT');
document.getElementById('loading').classList.add('out');
titleEl.classList.add('on');
labels.forEach((el, i) => setTimeout(() => {
  el.classList.add('on');
  setTimeout(() => el.classList.add('hint'), 900);
}, 500 + i * 180));

/* Dev helper: dumps the generated surfaces as PNGs so they can be shipped
   as static files later, removing generation from the browser entirely.
   Run  PIVARION.exportSurfaces()  in the console. */
window.PIVARION = {
  system: SYSTEM,
  pool,
  renderer,
  /* Run PIVARION.stats() in the console for live GPU usage */
  stats() {
    const m = renderer.info.memory;
    let bytes = 0;
    pool.forEach(e => Object.values(e.canvases).forEach(c => { bytes += c.width * c.height * 4 * 1.33; }));
    return {
      geometries: m.geometries,
      textures: m.textures,
      drawCalls: renderer.info.render.calls,
      sharedSurfaces: pool.size,
      approxSurfaceMB: +(bytes / 1048576).toFixed(1)
    };
  },
  exportSurfaces() {
    pool.forEach((entry, key) => {
      Object.entries(entry.canvases).forEach(([kind, cv]) => {
        const a = document.createElement('a');
        a.download = `${key}-${kind}.png`;
        a.href = cv.toDataURL('image/png');
        a.click();
      });
    });
  }
};

