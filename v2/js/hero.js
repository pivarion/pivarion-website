/* ══════════════════════════════════════════════════════════════════════
   PIVARION · HERO
   A small WebGL band at the top of each room, plus the scroll reveal the
   pages share. Deliberately lighter than the main page: one object, one
   light rig, no timeline — the front door does the cinema, these do the
   work. Nothing here is required for the page to read: if WebGL is gone,
   the canvas simply stays dark under the veil.
   ══════════════════════════════════════════════════════════════════════ */
(async function () {
'use strict';
var D = document, W = window, PI = Math.PI, TAU = PI * 2;

/* ── scroll reveal, for every page ─────────────────────────────────── */
(function reveal(){
  var items = [].slice.call(D.querySelectorAll('.rise'));
  if (!items.length) return;
  if (!('IntersectionObserver' in W)) {
    items.forEach(function (el){ el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries){
    entries.forEach(function (e){
      if (!e.isIntersecting) return;
      var i = +(e.target.getAttribute('data-delay') || 0);
      setTimeout(function (){ e.target.classList.add('in'); }, i * 90);
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  items.forEach(function (el){ io.observe(el); });
})();

/* ── the band ──────────────────────────────────────────────────────── */
var canvas = D.querySelector('canvas[data-hero]');
if (!canvas || !W.THREE || !W.PivarionMark) return;
try {
  var probe = D.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;
} catch (e) { return; }

var MODE = canvas.getAttribute('data-hero');
var LOW  = (navigator.hardwareConcurrency || 4) <= 4 || Math.min(W.innerWidth, W.innerHeight) < 620;
var SEG  = LOW ? 20 : 44;

var renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !LOW, alpha: true, powerPreference: 'high-performance' });
} catch (e2) { return; }
renderer.setPixelRatio(Math.min(W.devicePixelRatio || 1, LOW ? 1.25 : 1.7));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
else renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setClearColor(0x000000, 0);

var scene  = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(34, 1, 0.05, 90);

function cv(w,h){ var c = D.createElement('canvas'); c.width = w; c.height = h; return c; }
/* r152 renamed texture.encoding to texture.colorSpace and swapped the
   numeric constant for a string. Set whichever this build actually has —
   writing the string into .encoding is silently ignored. */
function asColor(t){
  if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  else if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
  return t;
}

/* the same bars-on-a-dark-field environment the main page reflects */
(function env(){
  var Wd = 512, Ht = 256, c = cv(Wd,Ht), g = c.getContext('2d'), i;
  var sky = g.createLinearGradient(0,0,0,Ht);
  sky.addColorStop(0,MODE==='wheel'?'#151617':'#0b1220'); sky.addColorStop(.5,MODE==='wheel'?'#090a0b':'#05080e'); sky.addColorStop(1,'#020305');
  g.fillStyle = sky; g.fillRect(0,0,Wd,Ht);
  for (i=0;i<6;i++){
    var x = i*84 + 12, gr = g.createLinearGradient(x,44,x,90);
    gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(.5,MODE==='wheel'?'rgba(238,238,235,1)':'rgba(226,238,255,1)'); gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x,44,58,46);
  }
  g.globalAlpha = MODE==='wheel'?.16:.28; g.fillStyle = MODE==='wheel'?'rgba(225,225,222,1)':'rgba(255,138,40,1)'; g.fillRect(150,70,220,80);
  g.globalAlpha = 1;
  var pm = new THREE.PMREMGenerator(renderer);
  var t = asColor(new THREE.CanvasTexture(c));
  t.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pm.fromEquirectangular(t).texture;
  t.dispose(); pm.dispose();
})();

scene.add(new THREE.HemisphereLight(0x161f2c, 0x010206, 0.30));
var key = new THREE.DirectionalLight(0xdfe8ff, 1.55); key.position.set(1.1, 1.4, 1.6); scene.add(key);
var rim = new THREE.DirectionalLight(0xff7a20, 1.45); rim.position.set(-1.4, 0.5,-1.0); scene.add(rim);
var fil = new THREE.DirectionalLight(0x3560a8, 0.65); fil.position.set(-0.6, 0.4, 1.2); scene.add(fil);
var edg = new THREE.DirectionalLight(0xa9c8ff, 1.30); edg.position.set(0.4, 0.9, 1.0); scene.add(edg);
if (MODE === 'wheel') {
  key.color.setHex(0xffffff); key.intensity=1.65; key.position.set(.4,1.3,.35);
  rim.color.setHex(0xfffaf3); rim.intensity=.7;
  fil.color.setHex(0xffffff); fil.intensity=.2;
  edg.color.setHex(0xffffff); edg.intensity=.35;
}

/* Shared raster-derived logo contours; no independently redrawn mark. */
function markGeo(depth){ return W.PivarionMark.geometry(depth); }

var M = {
  steel: new THREE.MeshPhysicalMaterial({ color:0x9fa8b4, metalness:1, roughness:0.24,
           clearcoat:1, clearcoatRoughness:0.10, envMapIntensity:1.3 }),
  print: new THREE.MeshStandardMaterial({ color:0xc6cdd8, metalness:0.05, roughness:0.88, envMapIntensity:0.55 }),
  rim:   new THREE.MeshStandardMaterial({ color:0x848c96, metalness:1, roughness:0.22, envMapIntensity:1.4 }),
  spoke: new THREE.MeshStandardMaterial({ color:0x2f343c, metalness:1, roughness:0.36, envMapIntensity:1.1 }),
  rubber:new THREE.MeshStandardMaterial({ color:0x070708, metalness:0, roughness:0.98, envMapIntensity:0.08 }),
  disc:  new THREE.MeshStandardMaterial({ color:0x101216, metalness:0.26, roughness:0.62,
           envMapIntensity:0.30, emissive:0x5e1200, emissiveIntensity:0.14 }),
  cal:   new THREE.MeshPhysicalMaterial({ color:0xffcf14, metalness:0.3, roughness:0.26,
           clearcoat:0.9, envMapIntensity:2.4 }),
  alu:   new THREE.MeshStandardMaterial({ color:0x8d949d, metalness:1, roughness:0.36, envMapIntensity:1.3 }),
  gold:  new THREE.MeshStandardMaterial({ color:0xa8813a, metalness:1, roughness:0.29, envMapIntensity:1.7 })
};

function place(g,x,y,z,rx,ry,rz){
  if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz);
  g.translate(x||0,y||0,z||0); return g;
}

/* ── the three objects that leave with the keys ────────────────────── */
function products(){
  var g = new THREE.Group(), i;
  var printed = new THREE.Mesh(markGeo(0.30,0.05), M.print);
  printed.scale.setScalar(0.50); printed.position.set(-1.05, 0.06, 0.30);
  g.add(printed);

  var art = asColor(new THREE.TextureLoader().load('../assets/references/porsche-reference-01.jpeg'));
  var frame = new THREE.Group();
  frame.add(new THREE.Mesh(new THREE.PlaneGeometry(1.30,0.84),
    new THREE.MeshStandardMaterial({ map:art, roughness:0.6, metalness:0, envMapIntensity:0.5 })));
  [[0,0.455,1.46,0.055],[0,-0.455,1.46,0.055],[-0.702,0,0.055,0.96],[0.702,0,0.055,0.96]].forEach(function(b){
    var m = new THREE.Mesh(new THREE.BoxGeometry(b[2],b[3],0.05), M.alu);
    m.position.set(b[0],b[1],-0.008); frame.add(m);
  });
  frame.position.set(0.05, -0.02, -0.25); frame.scale.setScalar(0.86);
  g.add(frame);

  var key = new THREE.Group();
  key.add(new THREE.Mesh(new THREE.TorusGeometry(0.10,0.020,8,SEG), M.gold));
  for (i=0;i<4;i++)
    key.add(new THREE.Mesh(place(new THREE.TorusGeometry(0.056,0.014,6,16), 0,-0.155-i*0.088,0, 0, i%2?PI/2:0), M.gold));
  var tag = new THREE.Mesh(markGeo(0.05,0.010), M.gold);
  tag.scale.setScalar(0.24); tag.position.y = -0.72;
  key.add(tag);
  key.position.set(1.08, 0.34, 0.25);
  g.add(key);

  g.userData.parts = [printed, frame, key];
  return g;
}

/* The type owns the bottom of the band, so the camera is aimed low and
   the subject rides above it. Framing this way needs no breakpoint: it
   holds from a phone to an ultrawide. */
var subject, spinner = null, swing = null, SHOT;
if (MODE === 'wheel'){
  try {
    var vehicle = await W.PivarionVehicle.load('../assets/');
    subject = vehicle.wheels[0];
    subject.removeFromParent(); subject.position.set(0, 0, 0);
    spinner = subject.userData.turn;
  } catch (error) {
    console.error('Wheel asset could not load', error);
    return;
  }
  SHOT = { z: 2.95, look: -0.26 };
} else if (MODE === 'products'){
  subject = products(); swing = subject.userData.parts;
  SHOT = { z: 4.30, look: -0.58 };
} else {
  subject = new THREE.Mesh(markGeo(0.34), W.PivarionMark.materials());
  subject.scale.setScalar(0.95);
  SHOT = { z: 4.30, look: -0.34 };
}
scene.add(subject);

/* ── motion ────────────────────────────────────────────────────────── */
var px = 0, py = 0, tx = 0, ty = 0, t0 = 0, running = true;
if (!(W.matchMedia && W.matchMedia('(pointer:coarse)').matches)){
  W.addEventListener('pointermove', function (e){
    tx = (e.clientX / W.innerWidth  - 0.5) * 2;
    ty = (e.clientY / W.innerHeight - 0.5) * 2;
  }, { passive:true });
}
function resize(){
  var r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  /* same idea as the front page: a narrow frame stands further back so
     the subject stays whole instead of being cropped to a detail */
  var a = camera.aspect;
  var back = a < 1.45 ? Math.pow(1.45 / Math.max(a, 0.42), 0.55) : 1;
  camera.position.set(0, 0, SHOT.z * back);
  camera.lookAt(0, SHOT.look * back, 0);
}
W.addEventListener('resize', resize);
D.addEventListener('visibilitychange', function (){ running = !D.hidden; });

/* the band only draws while it is on screen */
if ('IntersectionObserver' in W){
  new IntersectionObserver(function (es){ running = es[0].isIntersecting && !D.hidden; },
    { threshold: 0 }).observe(canvas);
}

var REDUCED = W.matchMedia && W.matchMedia('(prefers-reduced-motion:reduce)').matches;
function frame(now){
  requestAnimationFrame(frame);
  if (!running) return;
  var dt = Math.min(0.05, (now - t0)/1000 || 0.016); t0 = now;
  var s = REDUCED ? 0 : 1, clock = now / 1000;

  px += (tx - px) * 0.05; py += (ty - py) * 0.05;

  if (MODE === 'wheel'){
    if (spinner) spinner.rotation.z -= dt * 0.55 * s;
    subject.rotation.y = -0.30 + px * 0.26 + Math.sin(clock*0.22)*0.05*s;
    subject.rotation.x = py * 0.14;
  } else if (MODE === 'products'){
    subject.rotation.y = px * 0.16;
    subject.position.y = Math.sin(clock*0.5)*0.02*s;
    swing[0].rotation.y = clock * 0.42 * s;
    swing[1].rotation.y = Math.sin(clock*0.34)*0.22*s;
    swing[2].rotation.y = clock * 0.55 * s;
    swing[2].rotation.z = Math.sin(clock*1.15)*0.09*s;
  } else {
    subject.rotation.y = Math.sin(clock*0.22)*0.42*s + px*0.30;
    subject.rotation.x = Math.sin(clock*0.17)*0.13*s + py*0.16;
  }
  renderer.render(scene, camera);
}
resize();
requestAnimationFrame(frame);
})().catch(function (error) { console.error('Room hero unavailable', error); });
