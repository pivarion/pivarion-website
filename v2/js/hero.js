/* ══════════════════════════════════════════════════════════════════════
   PIVARION · HERO
   A small WebGL band at the top of each room, plus the scroll reveal the
   pages share. Deliberately lighter than the main page: one object, one
   light rig, no timeline — the front door does the cinema, these do the
   work. Nothing here is required for the page to read: if WebGL is gone,
   the canvas simply stays dark under the veil.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
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
if (!canvas || !W.THREE) return;
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
  sky.addColorStop(0,'#0b1220'); sky.addColorStop(.5,'#05080e'); sky.addColorStop(1,'#020305');
  g.fillStyle = sky; g.fillRect(0,0,Wd,Ht);
  for (i=0;i<6;i++){
    var x = i*84 + 12, gr = g.createLinearGradient(x,44,x,90);
    gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(.5,'rgba(226,238,255,1)'); gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x,44,58,46);
  }
  g.globalAlpha = .28; g.fillStyle = 'rgba(255,138,40,1)'; g.fillRect(150,70,220,80);
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

/* ── the mark, from the brand SVG ──────────────────────────────────── */
function markGeo(depth, bevel){
  function P(x,y){ return [(x-50)/50, (50-y)/50]; }
  var oct = [[25,6],[75,6],[94,25],[94,75],[75,94],[25,94],[6,75],[6,25]];
  var s = new THREE.Shape(), i, p;
  for (i=0;i<oct.length;i++){ p = P(oct[i][0], oct[i][1]); i ? s.lineTo(p[0],p[1]) : s.moveTo(p[0],p[1]); }
  s.closePath();
  function rect(x0,y0,x1,y1){
    var q = new THREE.Path();
    q.moveTo(x0,y0); q.lineTo(x0,y1); q.lineTo(x1,y1); q.lineTo(x1,y0); q.closePath();
    return q;
  }
  var A = 0.396, N = 0.013;
  s.holes.push(rect(-A,-A,A,A));
  s.holes.push(rect(-N, A, N, 0.88));  s.holes.push(rect(-N,-0.88, N,-A));
  s.holes.push(rect(-0.88,-N,-A, N));  s.holes.push(rect( A,-N, 0.88, N));
  var ring = new THREE.Shape();
  ring.moveTo(-0.372,-0.372); ring.lineTo(-0.372,0.372); ring.lineTo(0.372,0.372);
  ring.lineTo(0.372,-0.372); ring.closePath();
  ring.holes.push(rect(-0.332,-0.332,0.332,0.332));
  var g = new THREE.ExtrudeGeometry([s, ring], {
    depth: depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: LOW ? 1 : 3, curveSegments: 1
  });
  g.translate(0,0,-depth/2);
  g.computeVertexNormals();
  return g;
}

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

/* ── a wheel, cut down to what a hero band actually shows ──────────── */
function wheel(){
  var g = new THREE.Group(), i, j;
  var TP = [[0.322,-0.116],[0.350,-0.128],[0.390,-0.130],[0.428,-0.120],[0.450,-0.104],
            [0.4585,-0.078],[0.46,-0.04],[0.46,0.04],[0.4585,0.078],[0.450,0.104],
            [0.428,0.120],[0.390,0.130],[0.350,0.128],[0.322,0.116]];
  var lathe = new THREE.LatheGeometry(TP.map(function(p){ return new THREE.Vector2(p[0],p[1]); }), SEG*2);
  lathe.rotateX(PI/2);
  g.add(new THREE.Mesh(lathe, M.rubber));

  var barrel = new THREE.CylinderGeometry(0.324,0.324,0.225, SEG, 1, true);
  barrel.rotateX(PI/2);
  var bm = new THREE.Mesh(barrel, M.spoke); bm.material.side = THREE.DoubleSide; g.add(bm);
  g.add(new THREE.Mesh(place(new THREE.TorusGeometry(0.324,0.0135,8,SEG), 0,0,0.111), M.rim));

  for (i=0;i<5;i++) for (j=-1;j<=1;j+=2){
    var sh = new THREE.Shape();
    sh.moveTo(-0.041,0.088); sh.lineTo(0.041,0.088); sh.lineTo(0.019,0.316); sh.lineTo(-0.019,0.316); sh.closePath();
    var b = new THREE.ExtrudeGeometry(sh, { depth:0.030, bevelEnabled:true,
      bevelThickness:0.007, bevelSize:0.007, bevelSegments:1, curveSegments:1 });
    b.translate(0,0,0.058); b.rotateY(j*0.30); b.rotateZ(i/5*TAU + j*0.155 + 0.31);
    g.add(new THREE.Mesh(b, M.spoke));
  }
  g.add(new THREE.Mesh(place(new THREE.CylinderGeometry(0.086,0.086,0.046,SEG), 0,0,0.096, PI/2), M.gold));
  g.add(new THREE.Mesh(place(new THREE.CylinderGeometry(0.047,0.043,0.040,6), 0,0,0.128, PI/2), M.gold));

  /* the disc, drilled for real */
  var s = new THREE.Shape();
  s.absarc(0,0,0.296,0,TAU,false);
  var h0 = new THREE.Path(); h0.absarc(0,0,0.150,0,TAU,true); s.holes.push(h0);
  var rings = LOW ? [[0.222,18]] : [[0.186,20],[0.223,24],[0.259,28]];
  for (i=0;i<rings.length;i++) for (j=0;j<rings[i][1];j++){
    var a = j/rings[i][1]*TAU + i*0.21, hp = new THREE.Path();
    hp.absarc(Math.cos(a)*rings[i][0], Math.sin(a)*rings[i][0], 0.0088, 0, TAU, true);
    s.holes.push(hp);
  }
  var rotor = new THREE.ExtrudeGeometry(s, { depth:0.030, bevelEnabled:false, curveSegments: LOW?8:16 });
  rotor.translate(0,0,-0.015);
  g.add(new THREE.Mesh(rotor, M.disc));
  g.add(new THREE.Mesh(place(new THREE.CylinderGeometry(0.152,0.092,0.070,SEG), 0,0,-0.050, PI/2), M.alu));

  /* the caliper does not turn with it */
  var a0 = 0.86, a1 = 1.96, cs = new THREE.Shape();
  cs.absarc(0,0,0.332,a0,a1,false); cs.absarc(0,0,0.228,a1,a0,true); cs.closePath();
  var cb = new THREE.ExtrudeGeometry(cs, { depth:0.118, bevelEnabled:true,
    bevelThickness:0.010, bevelSize:0.010, bevelSegments:1, curveSegments: LOW?8:16 });
  cb.translate(0,0,-0.059);
  var cal = new THREE.Mesh(cb, M.cal);

  var holder = new THREE.Group();
  holder.add(g); holder.add(cal);
  holder.userData.turn = g;
  return holder;
}

/* ── the three objects that leave with the keys ────────────────────── */
function products(){
  var g = new THREE.Group(), i;
  var printed = new THREE.Mesh(markGeo(0.30,0.05), M.print);
  printed.scale.setScalar(0.50); printed.position.set(-1.05, 0.06, 0.30);
  g.add(printed);

  var art = (function(){
    var Wd=512, Ht=330, c=cv(Wd,Ht), x=c.getContext('2d');
    var bg=x.createLinearGradient(0,0,0,Ht);
    bg.addColorStop(0,'#0d1422'); bg.addColorStop(1,'#03050a');
    x.fillStyle=bg; x.fillRect(0,0,Wd,Ht);
    var gl=x.createRadialGradient(Wd*.6,Ht*.5,0,Wd*.6,Ht*.5,Wd*.5);
    gl.addColorStop(0,'rgba(255,106,0,.32)'); gl.addColorStop(1,'rgba(255,106,0,0)');
    x.fillStyle=gl; x.fillRect(0,0,Wd,Ht);
    x.strokeStyle='rgba(238,241,245,.85)'; x.lineWidth=2;
    x.beginPath();
    x.moveTo(96,214); x.bezierCurveTo(120,150,180,132,236,132);
    x.bezierCurveTo(300,132,344,158,392,196); x.lineTo(420,214);
    x.stroke();
    x.beginPath(); x.moveTo(96,214); x.lineTo(420,214); x.stroke();
    x.strokeStyle='rgba(243,195,3,.9)'; x.lineWidth=3;
    [166,356].forEach(function(cx){ x.beginPath(); x.arc(cx,214,30,0,TAU); x.stroke(); });
    x.fillStyle='rgba(238,241,245,.9)'; x.font='300 17px "Barlow",sans-serif';
    x.letterSpacing='9px'; x.textAlign='center'; x.fillText('PIVARION', Wd/2, Ht-38);
    return asColor(new THREE.CanvasTexture(c));
  })();
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
  subject = wheel(); spinner = subject.userData.turn;
  SHOT = { z: 2.95, look: -0.26 };
} else if (MODE === 'products'){
  subject = products(); swing = subject.userData.parts;
  SHOT = { z: 4.30, look: -0.58 };
} else {
  subject = new THREE.Mesh(markGeo(0.26, 0.045), M.steel);
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
})();
