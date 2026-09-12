/* ══════════════════════════════════════════════════════════════════════
   THE SHOT
   The source-derived logo and detailed LaFerrari share the original
   continuous camera sequence. Vehicle attribution: credits.html.
   ══════════════════════════════════════════════════════════════════════ */
(async function () {
'use strict';

var D = document, W = window;
if(D.body.classList.contains('flat')) return;
var perfStarted = 0, readyMs = 0, readyAssetBytes = 0;
var perfEl = D.getElementById('perf'), perfEnabled = false;
var longTasks = 0, maxLongTaskMs = 0, postReadyLongTasks = 0, postReadyMaxLongTaskMs = 0;
var reviewParams = new URLSearchParams(W.location.search);
perfEnabled = reviewParams.get('perf') === '1';
if (perfEnabled) D.body.classList.add('perf');
if ('PerformanceObserver' in W) {
  try {
    new PerformanceObserver(function(list){
      list.getEntries().forEach(function(entry){
        longTasks++; maxLongTaskMs=Math.max(maxLongTaskMs,entry.duration);
        if(readyMs && entry.startTime>=readyMs){
          postReadyLongTasks++; postReadyMaxLongTaskMs=Math.max(postReadyMaxLongTaskMs,entry.duration);
        }
      });
    }).observe({entryTypes:['longtask']});
  } catch (ignored) {}
}
var forcedReview = reviewParams.has('frame') ? Number(reviewParams.get('frame')) : null;
if (forcedReview !== null && !Number.isFinite(forcedReview)) forcedReview = null;
if (reviewParams.has('shot') || forcedReview !== null) W.history.scrollRestoration = 'manual';
var boot = D.getElementById('boot'), bootBar = D.getElementById('bootBar'), bootLbl = D.getElementById('bootLbl');

/* ── give up gracefully ─────────────────────────────────────────────── */
function flat(){ D.body.classList.add('flat'); if(W.PivarionLoading) W.PivarionLoading.fail(); else if(boot) boot.hidden=true; }
if (!W.THREE || !W.PivarionMark || !W.PivarionVehicle) { flat(); return; }
try {
  var probe = D.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) { flat(); return; }
} catch (e) { flat(); return; }

/* Give the HTML studio slate its first paint before synchronous WebGL setup. */
await new Promise(function(resolve){ requestAnimationFrame(function(){ requestAnimationFrame(resolve); }); });

/* ── maths ──────────────────────────────────────────────────────────── */
var PI = Math.PI, TAU = PI * 2;
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function lerp(a,b,t){ return a+(b-a)*t; }
/* works with a>b, which is how most of the masks below are written */
function sstep(a,b,v){ var t=clamp((v-a)/(b-a||1e-6),0,1); return t*t*(3-2*t); }
function ease(t){ return t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
function rng(seed){ var s=seed>>>0; return function(){ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }

/* ── one cinematic output on every supported device ────────────────── */
var REDUCED = W.matchMedia && W.matchMedia('(prefers-reduced-motion:reduce)').matches;
var Q = { dpr:1.5, tire:88, lathe:52, drill:88, spokes:5, streak:190,
  bars:17, plinthSeg:48, aniso:8 };

function step(pct, msg){
  if(W.PivarionLoading) W.PivarionLoading.update(pct,msg);
}

function compressedLoader(){
  var instance = new THREE.GLTFLoader();
  if (W.MeshoptDecoder) instance.setMeshoptDecoder(W.MeshoptDecoder);
  return instance;
}

/* Begin every opening-room request together. Procedural scene construction and
   network/decode work now overlap instead of running in series. */
var criticalVehiclePromise = W.PivarionVehicle.load('assets/', function(event){
  if(event.total) step(12 + Math.round(event.loaded/event.total*28),'LOADING THE LAFERRARI');
}, 'wide');
var studioModelPaths = ['camera','sofa','laptop','desk','chair'].map(function(name){
  return 'assets/optimized/studio/'+name+'.v1.glb';
});
var studioModelsPromise = Promise.all(studioModelPaths.map(function(path){
  return compressedLoader().loadAsync(path);
}));
var wallTexturePromise = Promise.all([
  'assets/optimized/images/wall-art-road.v1.webp',
  'assets/optimized/images/wall-art-monaco.v1.webp'
].map(function(path){ return new THREE.TextureLoader().loadAsync(path); }));

/* ══════════════════════════════════════════════════════════════════════
   PAINTED TEXTURES
   ══════════════════════════════════════════════════════════════════════ */
function cv(w,h){ var c=D.createElement('canvas'); c.width=w; c.height=h; return c; }
/* r152 renamed texture.encoding to texture.colorSpace and swapped the
   numeric constant for a string. Set whichever this build actually has —
   writing the string into .encoding is silently ignored. */
function asColor(t){
  if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  else if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
  return t;
}
function tex(canvas, rx, ry, colour){
  var t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx||1, ry||1);
  t.anisotropy = Q.aniso;
  return colour ? asColor(t) : t;
}

/* wet asphalt — broad damp patches, fine tooth, and long smeared streaks
   in the direction of travel so the light bars stretch when they reflect */
function texAsphalt(){
  var S = 1024, c = cv(S,S), g = c.getContext('2d'), r = rng(9173), i;
  g.fillStyle='#8a8a8a'; g.fillRect(0,0,S,S);
  for (i=0;i<160;i++){                                     // damp pools
    var x=r()*S, y=r()*S, rad=(28+r()*150);
    var gr=g.createRadialGradient(x,y,0,x,y,rad);
    var v=Math.floor(28+r()*54);
    gr.addColorStop(0,'rgba('+v+','+v+','+v+',.85)'); gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr; g.beginPath(); g.arc(x,y,rad,0,TAU); g.fill();
  }
  g.globalAlpha=.5;                                        // travel streaks
  for (i=0;i<420;i++){
    var yy=r()*S, len=40+r()*380, w=1+r()*3, vv=Math.floor(40+r()*150);
    g.fillStyle='rgb('+vv+','+vv+','+vv+')'; g.fillRect(r()*S, yy, len, w);
  }
  g.globalAlpha=1;
  var img=g.getImageData(0,0,S,S), d=img.data;             // tooth
  for (i=0;i<d.length;i+=4){ var n=(r()-.5)*46; d[i]+=n; d[i+1]+=n; d[i+2]+=n; }
  g.putImageData(img,0,0);
  return c;
}

/* the printed logo reads as printed because of the layer lines */
function texLayers(){
  var c=cv(16,256), g=c.getContext('2d');
  for (var y=0;y<256;y++){
    var v = 128 + Math.sin(y*0.62)*46 + (y%4===0?-30:0);
    g.fillStyle='rgb('+v+','+v+','+v+')'; g.fillRect(0,y,16,1);
  }
  return c;
}

/* film grain for the CSS layer over the render */
function texGrainURL(){
  var S=132, c=cv(S,S), g=c.getContext('2d'), img=g.createImageData(S,S), d=img.data, r=rng(31337);
  for (var i=0;i<d.length;i+=4){ var v=r()*255; d[i]=d[i+1]=d[i+2]=v; d[i+3]=42; }
  g.putImageData(img,0,0);
  return c.toDataURL('image/png');
}

/* ── the environment. A handful of bright bars on a dark field, blurred
      into an irradiance map: this is what the paint, the rim and the
      caliper are actually reflecting. ─────────────────────────────── */
function texEnv(){
  var Wd=1024, Ht=512, c=cv(Wd,Ht), g=c.getContext('2d');
  var sky=g.createLinearGradient(0,0,0,Ht);
  sky.addColorStop(0,'#151617'); sky.addColorStop(.42,'#0d0e10');
  sky.addColorStop(.5,'#090a0b'); sky.addColorStop(1,'#030405');
  g.fillStyle=sky; g.fillRect(0,0,Wd,Ht);
  function bar(x,y,w,h,a,col){
    var gr=g.createLinearGradient(x,y,x,y+h);
    gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(.5,col); gr.addColorStop(1,'rgba(0,0,0,0)');
    g.globalAlpha=a; g.fillStyle=gr; g.fillRect(x,y,w,h); g.globalAlpha=1;
  }
  for (var i=0;i<4;i++) bar(i*256+18, 82, 172, 102, .75, 'rgba(240,240,238,1)');   // overhead strips
  bar(0, 218, Wd, 38, .30, 'rgba(202,204,207,1)');                                  // horizon line
  bar(300, 150, 420, 150, .24, 'rgba(235,234,230,1)');                              // warm side
  bar(30, 300, 260, 120, .10, 'rgba(195,200,207,1)');                               // cold kicker
  return c;
}

step(8,'PAINTING SURFACES');
D.getElementById('grain').style.backgroundImage = 'url(' + texGrainURL() + ')';

/* ══════════════════════════════════════════════════════════════════════
   RENDERER
   ══════════════════════════════════════════════════════════════════════ */
var canvas = D.getElementById('gl');
var renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
} catch (e2) { flat(); return; }
renderer.setPixelRatio(Math.min(W.devicePixelRatio||1, Q.dpr));
renderer.setSize(W.innerWidth, W.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
else renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setClearColor(0x04060a, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

var scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x04060a, 0.020);

var camera = new THREE.PerspectiveCamera(38, W.innerWidth/W.innerHeight, 0.02, 400);

var pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
var envTex = asColor(new THREE.CanvasTexture(texEnv()));
envTex.mapping = THREE.EquirectangularReflectionMapping;
var envRT = pmrem.fromEquirectangular(envTex);
scene.environment = envRT.texture;
envTex.dispose();
pmrem.dispose();

/* ══════════════════════════════════════════════════════════════════════
   GEOMETRY HELPERS
   ══════════════════════════════════════════════════════════════════════ */

/* three's merge utility lives in the addons, which the UMD build does not
   carry — and one rim as a single draw call is worth thirty lines. */
function merge(list){
  var i, k, total = 0, attrs = ['position','normal','uv'], out = new THREE.BufferGeometry();
  var geos = list.map(function(g){ return g.index ? g.toNonIndexed() : g; });
  for (i=0;i<geos.length;i++) total += geos[i].attributes.position.count;
  for (k=0;k<attrs.length;k++){
    var name = attrs[k], size = name==='uv' ? 2 : 3, arr = new Float32Array(total*size), off = 0, ok = true;
    for (i=0;i<geos.length;i++){
      var a = geos[i].attributes[name];
      if (!a){ ok = false; break; }
      arr.set(a.array, off); off += a.array.length;
    }
    if (ok) out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  for (i=0;i<geos.length;i++) if (geos[i] !== list[i]) geos[i].dispose();
  return out;
}

/* transform a geometry in place and hand it back, so builders can stay
   flat lists of parts instead of nests of Object3Ds */
function place(geo, x,y,z, rx,ry,rz, s){
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  if (s !== undefined && s !== 1) geo.scale(s,s,s);
  geo.translate(x||0, y||0, z||0);
  return geo;
}

/* a disc with a bolt-circle of real holes punched through it */
/* The shared mesh follows the original JPG contour, including its gaps. */
function markGeo(depth){ return W.PivarionMark.geometry(depth); }

/* ══════════════════════════════════════════════════════════════════════
   MATERIALS
   ══════════════════════════════════════════════════════════════════════ */
function std(o){ return new THREE.MeshStandardMaterial(o); }
var MAT = {
  alu: std({ color:0x8d949d, metalness:1.0, roughness:0.36, envMapIntensity:1.3 }),
  gold: std({ color:0x8f6f2c, metalness:1.0, roughness:0.31, envMapIntensity:1.5 }),
  print: std({ color:0xc6cdd8, metalness:0.05, roughness:0.88, envMapIntensity:0.5 }),
  plinth: std({ color:0x0a0d13, metalness:0.25, roughness:0.55, envMapIntensity:0.8 })
};

var flareTex = (function(){
  var S=128, c=cv(S,S), g=c.getContext('2d');
  var gr=g.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.28,'rgba(255,255,255,.55)');
  gr.addColorStop(.62,'rgba(255,255,255,.13)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr; g.fillRect(0,0,S,S);
  return asColor(new THREE.CanvasTexture(c));
})();
var glowMat = function(hex, op, both){
  return new THREE.MeshBasicMaterial({ color:hex, transparent:true, opacity:op,
    blending:THREE.AdditiveBlending, depthWrite:false,
    side: both ? THREE.DoubleSide : THREE.FrontSide });
};

var layerTex = tex(texLayers(), 1, 26);
MAT.print.bumpMap = layerTex; MAT.print.bumpScale = 0.004;
MAT.print.roughnessMap = layerTex;

step(46,'POURING THE ROAD');

/* ══════════════════════════════════════════════════════════════════════
   THE WORLD
   The car travels down +X. Everything else is nailed down, so the light
   bars overhead sweep across the paint the way they actually would.
   ══════════════════════════════════════════════════════════════════════ */
var world = new THREE.Group(); scene.add(world);

/* ground */
var floorMat = new THREE.MeshPhysicalMaterial({ color:0x050608, metalness:0.09,
  roughness:0.58, specularIntensity:0.28, clearcoat:0.10, clearcoatRoughness:0.62,
  envMapIntensity:0.34 });
if (!THREE.ColorManagement.enabled) floorMat.color.convertSRGBToLinear();
var asphalt = tex(texAsphalt(), 26, 8);
// Keep authored roughness: multiplying by the dark asphalt map made a mirror.
floorMat.bumpMap = asphalt; floorMat.bumpScale = 0.0012;
var floor = new THREE.Mesh(new THREE.PlaneGeometry(320, 90), floorMat);
floor.rotation.x = -PI/2; floor.position.x = -10;
floor.receiveShadow = true;
world.add(floor);

/* lane dashes, laid as one additive strip so they read as speed not paint */
(function(){
  var c = cv(64,512), g = c.getContext('2d');
  g.fillStyle='#000'; g.fillRect(0,0,64,512);
  g.fillStyle='#8b94a6'; g.fillRect(26,40,12,200);
  var t = tex(c, 1, 60, true); t.wrapT = THREE.RepeatWrapping;
  var m = new THREE.Mesh(new THREE.PlaneGeometry(320,0.34),
    new THREE.MeshBasicMaterial({ map:t, transparent:true, opacity:0.20,
      blending:THREE.AdditiveBlending, depthWrite:false }));
  m.material.opacity = 0.028;
  m.rotation.x = -PI/2; m.rotation.z = PI/2; m.position.set(-10, 0.012, 6.4);
  world.add(m);
  var m2 = m.clone(); m2.position.z = -6.4; world.add(m2);
})();

/* overhead strips, and the smear each one leaves on the wet surface */
var barGroup = new THREE.Group(); world.add(barGroup);
(function(){
  var geo = new THREE.PlaneGeometry(0.30, 15);
  var refl = new THREE.PlaneGeometry(7.0, 1.15);
  for (var i=0;i<Q.bars;i++){
    var x = -56 + i * (86 / Q.bars);
    var b = new THREE.Mesh(geo, glowMat(0xdce9ff, 0.90));
    b.position.set(x, 6.4, 0); b.rotation.x = PI/2;
    barGroup.add(b);
    var r = new THREE.Mesh(refl, glowMat(0xc8ced6, 0.025));
    r.position.set(x, 0.014, 0); r.rotation.x = -PI/2;
    barGroup.add(r);
    /* the gantry reads as a silhouette, so it is unlit by design */
    var post = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.07,15.4),
      new THREE.MeshBasicMaterial({ color:0x020306 }));
    post.position.set(x, 6.56, 0);
    barGroup.add(post);
  }
  /* two warm rails low on either side — the colour that separates the car
     from the void when it is nothing but a silhouette */
  for (var s=-1;s<=1;s+=2){
    var rail = new THREE.Mesh(new THREE.PlaneGeometry(150, 0.085), glowMat(0xff7a1e, 0.38));
    rail.position.set(-10, 0.42, s*13); rail.rotation.y = s>0 ? PI : 0;
    barGroup.add(rail);
    var railR = new THREE.Mesh(new THREE.PlaneGeometry(150, 3.2), glowMat(0xff6a00, 0.055));
    railR.position.set(-10, 0.015, s*10.5); railR.rotation.x = -PI/2;
    barGroup.add(railR);
  }
})();

/* ══════════════════════════════════════════════════════════════════════
   PIVARION STUDIO
   The supplied studio design becomes the physical location of the film:
   a monolithic entrance, warm architectural light and a long black hall.
   The website choreography stays unchanged; this group only builds the
   space around it.
   ══════════════════════════════════════════════════════════════════════ */
var studio = new THREE.Group(); world.add(studio);
await (async function(){
  var shell = std({ color:0x060708, metalness:0.42, roughness:0.52, envMapIntensity:0.68 });
  var panel = std({ color:0x101114, metalness:0.34, roughness:0.43, envMapIntensity:0.82 });
  var inset = std({ color:0x020304, metalness:0.10, roughness:0.80, envMapIntensity:0.28 });
  if (!THREE.ColorManagement.enabled){
    shell.color.convertSRGBToLinear(); panel.color.convertSRGBToLinear(); inset.color.convertSRGBToLinear();
  }
  var warm = glowMat(0xffb96f, 0.92, true);
  var warmSoft = glowMat(0xff8b32, 0.14, true);

  function box(w,h,d,x,y,z,material,rx,ry,rz){
    var m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material || shell);
    m.position.set(x,y,z);
    m.rotation.set(rx||0,ry||0,rz||0);
    m.receiveShadow = true;
    studio.add(m);
    return m;
  }
  function strip(w,h,d,x,y,z,rx,ry,rz,soft){
    return box(w,h,d,x,y,z,soft ? warmSoft : warm,rx,ry,rz);
  }

  function finishAsset(root, targetLongest, position, rotationY, darken){
    root.updateMatrixWorld(true);
    var first=new THREE.Box3().setFromObject(root), size=first.getSize(new THREE.Vector3());
    var scale=targetLongest/Math.max(size.x,size.y,size.z);
    root.scale.setScalar(scale); root.updateMatrixWorld(true);
    var fitted=new THREE.Box3().setFromObject(root), center=fitted.getCenter(new THREE.Vector3());
    root.position.set(-center.x,-fitted.min.y,-center.z);
    root.traverse(function(node){
      if(!node.isMesh) return;
      /* These room props never move. Their soft contact is already carried by
         the authored lighting, so omit them from the moving car shadow pass. */
      node.castShadow=false; node.receiveShadow=true;
      if(node.material){
        node.material=node.material.clone();
        node.material.envMapIntensity=0.86;
        if(darken && node.material.color){
          node.material.color.multiplyScalar(darken);
          node.material.roughness=Math.min(0.72,Math.max(0.28,node.material.roughness||0.42));
        }
      }
    });
    var holder=new THREE.Group(); holder.add(root);
    holder.position.set(position[0],position[1],position[2]);
    holder.rotation.y=rotationY||0; studio.add(holder);
    return holder;
  }
  var side;

  /* One continuous interior surrounds every chapter. Both walls extend far
     behind the camera so no façade edge or end cap can cross the vehicle. */
  box(96.0,6.8,0.42,15.0,3.40,-13.55,panel);
  box(96.0,6.8,0.42,15.0,3.40, 13.55,panel);
  strip(94.0,0.065,0.065,15.0,6.02,-13.28);
  strip(94.0,0.065,0.065,15.0,6.02, 13.28);
  strip(94.0,0.035,0.15,15.0,0.026,-12.92,-PI/2,0,0,true);
  strip(94.0,0.035,0.15,15.0,0.026, 12.92,-PI/2,0,0,true);

  /* The first wall fin begins well beyond the arrival lens so no upright can
     flash across the transition. */
  var bays = [7.4,13.6,19.8,26.0];
  for (var bi=0;bi<bays.length;bi++){
    var bx=bays[bi];
    for (side=-1;side<=1;side+=2){
      /* Lit reveals and suspended headers imply the structural bay without a
         solid post ever crossing the lens. */
      strip(0.075,5.10,0.075,bx+0.02,3.15,side*12.98);
      /* angled header fins are the studio's most recognizable detail */
      box(1.62,0.28,0.78,bx+0.52,5.92,side*13.18,shell,0,0,side*0.46);
    }
  }

  function lettering(title, subtitle, ink, subInk, titleSize, subSize){
    var c=cv(1024,256), g=c.getContext('2d');
    g.clearRect(0,0,c.width,c.height); g.textAlign='center'; g.textBaseline='middle';
    var titlePx=titleSize||58, subPx=subSize||28;
    g.font=titlePx+'px Michroma, Arial, sans-serif';
    while(g.measureText(title).width>880 && titlePx>24){ titlePx-=2; g.font=titlePx+'px Michroma, Arial, sans-serif'; }
    g.fillStyle=ink||'#f5f1ea';
    g.fillText(title,512,100);
    g.font=subPx+'px IBM Plex Mono, monospace';
    while(g.measureText(subtitle).width>880 && subPx>14){ subPx-=1; g.font=subPx+'px IBM Plex Mono, monospace'; }
    g.fillStyle=subInk||'#c7bcae';
    g.fillText(subtitle,512,178);
    var t=asColor(new THREE.CanvasTexture(c)); t.anisotropy=Q.aniso;
    return new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  }
  function rod(a,b,radius,material){
    var av=new THREE.Vector3(a[0],a[1],a[2]), bv=new THREE.Vector3(b[0],b[1],b[2]);
    var dir=new THREE.Vector3().subVectors(bv,av), len=dir.length();
    var m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,len,8),material||panel);
    m.position.copy(av).add(bv).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
    studio.add(m); return m;
  }

  /* Permanent brand wall. It uses the exact supplied Pivarion geometry,
     repeated as a lit relief rather than redrawn as a generic wheel. */
  box(4.65,4.65,0.16,7.3,4.02,-13.27,inset);
  var wallHalo=new THREE.Mesh(markGeo(0.055),glowMat(0xffd9ae,0.23,true));
  wallHalo.scale.setScalar(1.16); wallHalo.position.set(7.3,4.02,-13.14); studio.add(wallHalo);
  var wallLogo=new THREE.Mesh(markGeo(0.16),W.PivarionMark.materials());
  wallLogo.scale.setScalar(1.03); wallLogo.position.set(7.3,4.02,-13.02); studio.add(wallLogo);
  var wallSign=new THREE.Mesh(new THREE.PlaneGeometry(4.8,1.2),lettering('PIVARION','STUDIO  ·  TORONTO'));
  wallSign.position.set(1.55,4.48,-13.18); studio.add(wallSign);
  var gallerySign=new THREE.Mesh(new THREE.PlaneGeometry(4.4,1.05),lettering('PIVARION','STUDIO  ·  AUTOMOTIVE'));
  gallerySign.position.set(22.8,5.12,-13.18); studio.add(gallerySign);

  var propDark=std({color:0x14171b,metalness:0.36,roughness:0.34,envMapIntensity:0.92});
  var propSilver=std({color:0x8b9198,metalness:0.92,roughness:0.25,envMapIntensity:1.25});
  var propAmber=std({color:0xb96519,metalness:0.70,roughness:0.29,envMapIntensity:1.2});
  if (!THREE.ColorManagement.enabled){
    propDark.color.convertSRGBToLinear(); propSilver.color.convertSRGBToLinear(); propAmber.color.convertSRGBToLinear();
  }
  /* Two distinct owner-supplied LaFerrari photographs, each displayed at its
     native 3:2 ratio without stretching or cropping. */
  function wallArtMaterial(map){
    asColor(map); map.anisotropy=Q.aniso;
    return std({map:map,metalness:0.02,roughness:0.58,envMapIntensity:0.35});
  }
  function wallArt(x,w,h,material){
    box(w+0.18,h+0.18,0.08,x,2.78,-13.20,propDark);
    var art=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);
    art.position.set(x,2.78,-13.14); studio.add(art);
    strip(w+0.05,0.035,0.035,x,1.88,-13.03,0,0,0,true);
  }
  var wallTextures=await wallTexturePromise;
  wallArt(11.3,2.40,1.60,wallArtMaterial(wallTextures[0]));
  wallArt(14.3,2.40,1.60,wallArtMaterial(wallTextures[1]));

  /* A real photography bay: seamless white wall and floor, with all cameras
     and lamps standing in the room and aimed into it. It starts beyond the
     moving-car transition, so no backdrop edge can cross the body. */
  var cyc=std({color:0xf3f1ea,emissive:0x4b4a47,emissiveIntensity:0.42,
    metalness:0.0,roughness:0.70,envMapIntensity:0.32});
  if(!THREE.ColorManagement.enabled){ cyc.color.convertSRGBToLinear(); cyc.emissive.convertSRGBToLinear(); }
  box(17.0,5.55,0.12,8.5,3.00,13.25,cyc);
  box(17.0,0.055,5.9,8.5,0.035,10.28,cyc);
  var studioSign=new THREE.Mesh(new THREE.PlaneGeometry(8.1,1.58),lettering('PIVARION STUDIO','TORONTO  ·  AUTOMOTIVE','#0d1014','#272b31',92,34));
  studioSign.position.set(8.5,4.28,13.16); studioSign.rotation.y=PI; studio.add(studioSign);
  strip(16.5,0.055,0.055,8.5,5.55,13.10);

  function tripod(x,z,height){
    height=height||1.65;
    var top=[x,height,z];
    rod(top,[x-0.46,0.05,z+0.38],0.022,propSilver);
    rod(top,[x+0.46,0.05,z+0.38],0.022,propSilver);
    rod(top,[x,0.05,z-0.48],0.022,propSilver);
    rod([x,height*.62,z],top,0.032,propSilver);
    var collar=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.13,0.13,24),propDark);
    collar.position.set(x,height+0.05,z); studio.add(collar);
    return [x,height+0.12,z];
  }
  function softbox(mount,target){
    var hoodMat=std({color:0x171a1f,metalness:0.18,roughness:0.62,envMapIntensity:0.55});
    var diffuser=std({color:0xf3eee5,emissive:0xc9bda9,emissiveIntensity:0.34,
      metalness:0.0,roughness:0.93,side:THREE.FrontSide});
    if(!THREE.ColorManagement.enabled){
      hoodMat.color.convertSRGBToLinear(); diffuser.color.convertSRGBToLinear(); diffuser.emissive.convertSRGBToLinear();
    }
    var rig=new THREE.Group();
    var hood=new THREE.Mesh(new THREE.CylinderGeometry(0.57,0.72,0.34,8,1,false),hoodMat);
    hood.rotation.x=PI/2; rig.add(hood);
    var face=new THREE.Mesh(new THREE.CircleGeometry(0.555,8),diffuser);
    face.position.z=0.178; rig.add(face);
    var rimMesh=new THREE.Mesh(new THREE.RingGeometry(0.555,0.70,8),propDark);
    rimMesh.position.z=0.184; rig.add(rimMesh);
    /* A recessed rear hub and eight ribs make the visible side read as a
       fabric softbox, rather than a camera or bare geometric disc. */
    var rearHub=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,0.13,20),propSilver);
    rearHub.rotation.x=PI/2; rearHub.position.z=-0.205; rig.add(rearHub);
    for(var sr=0;sr<8;sr++){
      var sa=sr*PI/4, end=new THREE.Vector3(Math.cos(sa)*0.57,Math.sin(sa)*0.57,-0.19);
      var ribDir=end.clone(), ribLen=ribDir.length();
      var rib=new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.009,ribLen,6),propSilver);
      rib.position.copy(end).multiplyScalar(0.5);
      rib.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),ribDir.normalize());
      rig.add(rib);
    }
    rig.position.set(mount[0],mount[1],mount[2]);
    /* Aim from the wall target, then turn the physical fixture around so its
       illuminated face is visible from the room, as directed in review. */
    rig.lookAt(target);
    rig.rotateY(PI);
    studio.add(rig); return rig;
  }
  var cameraMountA=tripod(8.55,5.05,1.62);
  var lightMountA=tripod(5.15,6.15,2.12);
  var lightMountB=tripod(12.05,6.15,2.12);

  step(48,'FURNISHING THE STUDIO');
  var loaded=await studioModelsPromise;
  /* The source camera's lens points down local +Z. Keep it aimed at the same
     mark on the white wall as the two softboxes. */
  var photoWallTarget=new THREE.Vector3(8.5,2.05,13.12);
  var cameraA=finishAsset(loaded[0].scene,0.82,cameraMountA,0,0.55);
  cameraA.scale.setScalar(1.55);
  cameraA.name='Detailed central studio camera';
  var sofa=finishAsset(loaded[1].scene,2.55,[7.25,0,-10.65],0,0.52);
  sofa.name='Detailed leather client sofa';
  var desk=finishAsset(loaded[3].scene,2.30,[1.70,0,-10.45],0,0.42);
  var chair=finishAsset(loaded[4].scene,1.18,[1.70,0,-12.05],0,0.48);
  /* Centre the open laptop on the chair side of the desktop, fully above the
     work surface and directly on the seated user's sight line. */
  var laptop=finishAsset(loaded[2].scene,0.47,[1.70,0.88,-10.72],PI,0.32);
  /* A second instance of the same textured armchair sits across the desk.
     It keeps the detailed upholstery, curved shell and wooden legs while
     facing the original chair rather than reading as a geometric placeholder. */
  var visitorChair=chair.clone(true);
  visitorChair.position.set(1.70,0,-8.88);
  visitorChair.rotation.y=PI;
  studio.add(visitorChair);
  desk.name='Detailed studio desk'; chair.name='Detailed desk chair';
  visitorChair.name='Detailed visitor chair'; laptop.name='Detailed workstation laptop';
  softbox(lightMountA,photoWallTarget).name='Octagonal key softbox';
  softbox(lightMountB,photoWallTarget).name='Octagonal fill softbox';

  /* The modeled lamps face the white sweep and cast the two controlled pools
     that make this read as an operating photography studio. */
  [5.15,12.05].forEach(function(lx){
    var lightTarget=new THREE.Object3D(); lightTarget.position.set(8.5,1.6,13.1); studio.add(lightTarget);
    var photoLight=new THREE.SpotLight(0xfff1df,0.58,12,0.42,0.78,1.7);
    photoLight.position.set(lx,2.32,6.65); photoLight.target=lightTarget; studio.add(photoLight);
  });

  /* Small pools illuminate the architecture itself; the vehicle still
     uses its neutral tracking rig so the black paint remains accurate. */
  var lightXs=[1.8,8.0,14.2,20.4,26.2];
  for (var li=0;li<lightXs.length;li++){
    for (side=-1;side<=1;side+=2){
      var target = new THREE.Object3D(); target.position.set(lightXs[li],0.1,side*7.8); studio.add(target);
      var spot = new THREE.SpotLight(0xffead1,0.26,8.5,0.48,0.90,1.8);
      spot.position.set(lightXs[li],5.95,side*9.0); spot.target=target; studio.add(spot);
    }
  }
})();

/* speed streaks — lit dust drawn out by the shutter */
var streaks;
(function(){
  var g = new THREE.BoxGeometry(1, 0.010, 0.010);
  streaks = new THREE.InstancedMesh(g, glowMat(0xbcd6ff, 0.5, true), Q.streak);
  var r = rng(4211), d = new THREE.Object3D();
  streaks.userData.seed = [];
  for (var i=0;i<Q.streak;i++){
    var px = -70 + r()*150, py = 0.08 + Math.pow(r(),1.7)*3.6, pz = (r()-.5)*22, sc = 0.9 + r()*3.0;
    streaks.userData.seed.push([px,py,pz,sc]);
    d.position.set(px,py,pz); d.scale.set(sc,1,1); d.updateMatrix();
    streaks.setMatrixAt(i, d.matrix);
  }
  streaks.instanceMatrix.needsUpdate = true;
  streaks.frustumCulled = false;
  world.add(streaks);
})();

/* a soft black pool under anything that touches the floor */
var shadowTex = (function(){
  var S=256, c=cv(S,S), g=c.getContext('2d');
  var gr=g.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
  gr.addColorStop(0,'rgba(0,0,0,.92)'); gr.addColorStop(.45,'rgba(0,0,0,.5)'); gr.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=gr; g.fillRect(0,0,S,S);
  return new THREE.CanvasTexture(c);
})();
function contact(w,d){
  var m = new THREE.Mesh(new THREE.PlaneGeometry(w,d),
    new THREE.MeshBasicMaterial({ map:shadowTex, transparent:true, opacity:0.85, depthWrite:false }));
  m.rotation.x = -PI/2; m.position.y = 0.006;
  m.userData.runtimeShared=true;
  return m;
}

step(62,'ASSEMBLING THE CAR');

/* ── the car assembly ─────────────────────────────────────────────── */
var vehicle, wideVehicle = null, fullVehicle = null, activeModelVariant = 'wide';
try {
  vehicle = await criticalVehiclePromise;
} catch (error) {
  console.error('LaFerrari asset could not load', error);
  flat(); return;
}
var car = vehicle.group;
car.add(contact(5.4, 2.5));
var wheels = vehicle.wheels;
wideVehicle = vehicle;
world.add(car);

/* the hero mark: it opens the film and it closes it */
var mark = new THREE.Mesh(markGeo(0.34), W.PivarionMark.materials());
mark.scale.setScalar(1.82);
mark.position.set(0, 2.85, 0);
world.add(mark);

step(76,'DRESSING THE GALLERY');

/* ══════════════════════════════════════════════════════════════════════
   THE GALLERY — three plinths under unobtrusive studio spots
   ══════════════════════════════════════════════════════════════════════ */
var GX = 21.0, plinths = [], spin = [];
(function(){
  var zs = [3.5, 0, -3.5];
  for (var i=0;i<3;i++){
    var p = new THREE.Group();
    p.position.set(GX, 0, zs[i]);
    p.visible = false;
    var col = new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.60,1.02, Q.plinthSeg), MAT.plinth);
    col.position.y = 0.51; p.add(col);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.545,0.545,0.028, Q.plinthSeg),
      std({ color:0x13161c, metalness:0.15, roughness:0.72, envMapIntensity:0.30 }));
    cap.position.y = 1.028; p.add(cap);
    p.add(contact(2.4,2.4));
    /* Invisible studio spots light the objects without a translucent cone
       crossing the product, artwork, or final logo. */
    var poolMat = glowMat(0xd7dce2, 0.045); poolMat.map = flareTex;
    var pool = new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.5), poolMat);
    pool.rotation.x = -PI/2; pool.position.y = 0.02; p.add(pool);
    var target = new THREE.Object3D(); target.position.set(0,1.35,0); p.add(target);
    var lamp = new THREE.SpotLight(0xfffbf4, 2.2, 7, 0.40, 0.90, 1.5);
    lamp.position.set(1.5,4.6,0.8); lamp.target = target; p.add(lamp);
    world.add(p);
    plinths.push(p);
  }

  /* I — the mark, printed solid */
  var printed = new THREE.Mesh(markGeo(0.30, 0.05), MAT.print);
  printed.scale.setScalar(0.44);
  printed.position.set(0, 1.44, 0);
  plinths[0].add(printed); spin.push(printed);

  /* II — the supplied LaFerrari photograph, fitted at its native 16:10 ratio. */
  var art = asColor(new THREE.TextureLoader().load('assets/optimized/images/gallery-laferrari.v1.webp'));
  art.anisotropy = Q.aniso;
  var frame = new THREE.Group();
  var canvasPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.80),
    std({ map:art, roughness:0.62, metalness:0.0, envMapIntensity:0.5 }));
  frame.add(canvasPlane);
  var backing=new THREE.Mesh(new THREE.BoxGeometry(1.36,0.88,0.026),MAT.plinth);
  backing.position.z=-0.024; frame.add(backing);
  var fr = [];
  fr.push(place(new THREE.BoxGeometry(1.44,0.055,0.050), 0, 0.442,-0.006));
  fr.push(place(new THREE.BoxGeometry(1.44,0.055,0.050), 0,-0.442,-0.006));
  fr.push(place(new THREE.BoxGeometry(0.055,0.94,0.050),-0.692,0,-0.006));
  fr.push(place(new THREE.BoxGeometry(0.055,0.94,0.050), 0.692,0,-0.006));
  frame.add(new THREE.Mesh(merge(fr), MAT.alu));
  frame.position.set(0, 1.64, 0);
  frame.rotation.x = 0;
  frame.rotation.y = PI/2;             /* the gallery is walked from +X */
  plinths[1].add(frame); spin.push(frame);

  /* III — an open client presentation box. The pen, book and keychain are
     nested inside one product group so the complete handover set rotates as
     a single, believable object instead of a pendant spinning under a bar. */
  var presentation = new THREE.Group();
  var boxShell=std({color:0x07090d,metalness:0.38,roughness:0.32,envMapIntensity:1.05});
  var velvet=std({color:0x11151b,metalness:0.0,roughness:0.94,envMapIntensity:0.16});
  var paper=std({color:0xe8e1d4,metalness:0.0,roughness:0.82,envMapIntensity:0.28});
  var orange=std({color:0xc84b10,metalness:0.56,roughness:0.34,envMapIntensity:1.2});
  if(!THREE.ColorManagement.enabled){
    boxShell.color.convertSRGBToLinear(); velvet.color.convertSRGBToLinear();
    paper.color.convertSRGBToLinear(); orange.color.convertSRGBToLinear();
  }
  function productPart(geometry,material,x,y,z,rx,ry,rz){
    var part=new THREE.Mesh(geometry,material);
    part.position.set(x||0,y||0,z||0); part.rotation.set(rx||0,ry||0,rz||0);
    part.castShadow=true; part.receiveShadow=true; presentation.add(part); return part;
  }

  /* Rigid presentation tray with a fitted velvet bed and raised perimeter. */
  productPart(new THREE.BoxGeometry(1.42,0.12,0.90),boxShell,0,0.06,0);
  productPart(new THREE.BoxGeometry(1.28,0.035,0.76),velvet,0,0.135,0);
  productPart(new THREE.BoxGeometry(1.42,0.16,0.055),boxShell,0,0.19,-0.423);
  productPart(new THREE.BoxGeometry(1.42,0.16,0.055),boxShell,0,0.19, 0.423);
  productPart(new THREE.BoxGeometry(0.055,0.16,0.79),boxShell,-0.682,0.19,0);
  productPart(new THREE.BoxGeometry(0.055,0.16,0.79),boxShell, 0.682,0.19,0);

  /* Hinged lid, opened toward the back. Its exact Pivarion relief and fine
     metal border stay attached to the lid and catch the moving studio light. */
  var lid=new THREE.Group(); lid.position.set(0,0.20,-0.43); lid.rotation.x=-1.14;
  var lidPanel=new THREE.Mesh(new THREE.BoxGeometry(1.42,0.085,0.86),boxShell);
  lidPanel.position.z=0.41; lidPanel.castShadow=true; lidPanel.receiveShadow=true; lid.add(lidPanel);
  var lidInset=new THREE.Mesh(new THREE.BoxGeometry(1.25,0.026,0.69),velvet);
  lidInset.position.set(0,0.058,0.41); lid.add(lidInset);
  var lidLogoMap=asColor(new THREE.TextureLoader().load('assets/pivarion-logo-original.jpg'));
  lidLogoMap.anisotropy=Q.aniso;
  var lidLogo=new THREE.Mesh(new THREE.PlaneGeometry(0.52,0.42),
    new THREE.MeshBasicMaterial({map:lidLogoMap,side:THREE.DoubleSide,toneMapped:false}));
  lidLogo.rotation.x=-PI/2; lidLogo.position.set(0,0.078,0.41); lid.add(lidLogo);
  var lidRails=[
    new THREE.BoxGeometry(1.27,0.018,0.018),new THREE.BoxGeometry(1.27,0.018,0.018),
    new THREE.BoxGeometry(0.018,0.018,0.71),new THREE.BoxGeometry(0.018,0.018,0.71)
  ];
  place(lidRails[0],0,0.076,0.755); place(lidRails[1],0,0.076,0.065);
  place(lidRails[2],-0.625,0.076,0.41); place(lidRails[3],0.625,0.076,0.41);
  var lidBorder=new THREE.Mesh(merge(lidRails),MAT.gold); lid.add(lidBorder);
  presentation.add(lid);
  var hingeGeo=new THREE.CylinderGeometry(0.025,0.025,0.42,14);
  var hingeA=productPart(hingeGeo,MAT.gold,-0.40,0.205,-0.43,0,0,PI/2);
  var hingeB=productPart(hingeGeo,MAT.gold, 0.40,0.205,-0.43,0,0,PI/2);

  /* Branded hard-cover book: warm page block, black covers and a raised mark. */
  productPart(new THREE.BoxGeometry(0.50,0.075,0.56),paper,-0.34,0.215,0.035);
  productPart(new THREE.BoxGeometry(0.55,0.025,0.61),boxShell,-0.34,0.265,0.035);
  productPart(new THREE.BoxGeometry(0.55,0.022,0.61),boxShell,-0.34,0.165,0.035);
  productPart(new THREE.BoxGeometry(0.024,0.105,0.61),orange,-0.615,0.215,0.035);
  var bookMark=new THREE.Mesh(markGeo(0.018),MAT.gold);
  bookMark.scale.setScalar(0.052); bookMark.rotation.x=-PI/2;
  bookMark.position.set(-0.34,0.292,0.035); bookMark.castShadow=true; presentation.add(bookMark);

  /* Machined pen seated lengthwise beside the book, with separate grip,
     ferrule, nib and clip so it reads at close range. */
  productPart(new THREE.CylinderGeometry(0.027,0.027,0.56,18),MAT.alu,0.43,0.235,-0.055,PI/2,0,0);
  productPart(new THREE.CylinderGeometry(0.031,0.031,0.19,18),boxShell,0.43,0.235,0.13,PI/2,0,0);
  productPart(new THREE.CylinderGeometry(0.030,0.010,0.105,18),MAT.gold,0.43,0.235,-0.385,PI/2,0,0);
  productPart(new THREE.CylinderGeometry(0.034,0.034,0.035,18),orange,0.43,0.235,0.245,PI/2,0,0);
  productPart(new THREE.BoxGeometry(0.012,0.022,0.22),MAT.gold,0.462,0.264,0.12,0,0,-0.08);

  /* Compact Pivarion keychain laid into the remaining velvet recess. Every
     link, connector and cut-through eyelet belongs to the rotating box. */
  var boxedKey=new THREE.Group();
  var boxedRing=new THREE.Mesh(new THREE.TorusGeometry(0.082,0.016,8,26),MAT.gold); boxedKey.add(boxedRing);
  for(var L=0;L<3;L++){
    var boxedLink=new THREE.Mesh(new THREE.TorusGeometry(0.044,0.010,7,18),MAT.gold);
    boxedLink.position.y=-0.122-L*0.073; boxedLink.rotation.y=L%2?PI/2:0;
    boxedKey.add(boxedLink);
  }
  var boxedTag=new THREE.Mesh(markGeo(0.032),MAT.gold);
  boxedTag.scale.setScalar(0.145); boxedTag.position.y=-0.47; boxedKey.add(boxedTag);
  var boxedEyeletShape=new THREE.Shape(); boxedEyeletShape.absarc(0,0,0.040,0,TAU,false);
  var boxedEyeletHole=new THREE.Path(); boxedEyeletHole.absarc(0,0,0.019,0,TAU,true);
  boxedEyeletShape.holes.push(boxedEyeletHole);
  var boxedEyelet=new THREE.Mesh(new THREE.ExtrudeGeometry(boxedEyeletShape,
    {depth:0.032,steps:1,bevelEnabled:false,curveSegments:18}),MAT.gold);
  boxedEyelet.geometry.translate(0,0,-0.016); boxedEyelet.position.y=-0.348; boxedKey.add(boxedEyelet);
  var boxedConnector=new THREE.Mesh(new THREE.TorusGeometry(0.029,0.006,8,20),MAT.gold);
  boxedConnector.rotation.y=PI/2; boxedConnector.position.y=-0.326; boxedKey.add(boxedConnector);
  boxedKey.scale.setScalar(0.62); boxedKey.rotation.x=-PI/2;
  boxedKey.position.set(0.31,0.245,-0.16); boxedKey.traverse(function(n){if(n.isMesh)n.castShadow=true;});
  presentation.add(boxedKey);

  presentation.position.set(0,1.045,0);
  plinths[2].add(presentation); spin.push(presentation);
})();

/* ══════════════════════════════════════════════════════════════════════
   LIGHT
   ══════════════════════════════════════════════════════════════════════ */
scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 0.30));
var key = new THREE.DirectionalLight(0xffffff, 1.65); key.position.set(0.4, 1.3, 0.35); scene.add(key);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left:-3.7, right:3.7, top:3.7, bottom:-3.7, near:0.1, far:30 });
key.shadow.normalBias = 0.012; key.shadow.bias = -0.0001;
scene.add(key.target);
var rim = new THREE.DirectionalLight(0xfffaf3, 0.70); rim.position.set(-1.0, 0.30,-0.55); scene.add(rim);
var fill= new THREE.DirectionalLight(0xffffff, 0.20); fill.position.set(-0.35,0.45, 1.0); scene.add(fill);
/* A restrained neutral edge separates the black body from the dark set. */
var edge= new THREE.DirectionalLight(0xffffff, 0.35); edge.position.set(0.35, 0.85, 1.0); scene.add(edge);
/* The logo key fades before the car reveal to prevent light spilling onto paint. */
var markKey = new THREE.PointLight(0xffffff, 0.0, 34, 2); markKey.position.set(7.5, 5.2, 6.0); scene.add(markKey);
var brakeLight = new THREE.PointLight(0xff3a00, 0.0, 3.4, 2); scene.add(brakeLight);
var wheelKey  = new THREE.PointLight(0xffffff, 0.0, 5.0, 2); scene.add(wheelKey);

/* ══════════════════════════════════════════════════════════════════════
   THE CAMERA TRACK
   Keys are shot marks. `rel` means the mark is pegged to the car, which
   is how the tracking shots stay locked while the car is still moving.
   ══════════════════════════════════════════════════════════════════════ */
var cinematic = W.PivarionCinematicTrack;
function carAt(t){ return cinematic.carAt(t); }
var camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camFov = 37, camRoll = 0;
function frameShot(t){
  var shot = cinematic.sample(t, W.innerWidth / W.innerHeight);
  camPos.fromArray(shot.p); camLook.fromArray(shot.l);
  camFov=shot.f; camRoll=0;
}

/* ══════════════════════════════════════════════════════════════════════
   SCROLL → TIME
   ══════════════════════════════════════════════════════════════════════ */
var tTarget = 0, tNow = 0, lastCarX = carAt(0), travel = 0, clock = 0;
var raf = 0, galleryTimer = 0, hidden = D.hidden, lastInteraction = performance.now();
var renderedFrames = 0, renderedTotal = 0, fps = 0, frameTimeMs = 0;
var fpsWindowStart = performance.now(), lastShadowUpdate = 0;
function requestRender(delay){
  if(hidden || D.body.classList.contains('flat')) return;
  if(!delay && galleryTimer){ clearTimeout(galleryTimer); galleryTimer=0; }
  if(raf || galleryTimer) return;
  if (delay) {
    galleryTimer=W.setTimeout(function(){ galleryTimer=0; raf=requestAnimationFrame(tick); },delay);
  } else raf=requestAnimationFrame(tick);
}
function readScroll(){
  if (forcedReview !== null){ tTarget=clamp(forcedReview,0,1); return; }
  var h = D.documentElement.scrollHeight - W.innerHeight;
  tTarget = clamp(h > 0 ? (W.scrollY || W.pageYOffset) / h : 0, 0, 1);
}
W.addEventListener('scroll', function(){ readScroll(); lastInteraction=performance.now(); requestRender(0); }, { passive:true });

/* ══════════════════════════════════════════════════════════════════════
   HTML IN STEP WITH THE PICTURE
   ══════════════════════════════════════════════════════════════════════ */
var PANELS = [
  { el:D.getElementById('p0'), a:0.000, b:0.085 },
  { el:D.getElementById('p1'), a:0.155, b:0.430 },
  { el:D.getElementById('p2'), a:0.498, b:0.706 },
  { el:D.getElementById('p3'), a:0.772, b:0.906 },
  { el:D.getElementById('p4'), a:0.938, b:1.010 }
];
var SLATE = [
  [0.000,'SHOT 00','COLD OPEN — THE MARK'],
  [0.115,'SHOT 01','EXT. NIGHT — FOLLOW'],
  [0.175,'SHOT 01','TRACKING — FERRARI LAFERRARI'],
  [0.340,'SHOT 01','TRACKING — ON THE BRAKES'],
  [0.498,'SHOT 02','MACRO — CARBON CERAMIC'],
  [0.640,'SHOT 02','MACRO — SIX PISTON'],
  [0.726,'SHOT 03','INT. GALLERY — CRANE UP'],
  [0.800,'SHOT 03','GALLERY — PLINTH I'],
  [0.845,'SHOT 03','GALLERY — PLINTH II'],
  [0.888,'SHOT 03','GALLERY — PLINTH III'],
  [0.935,'SHOT 04','WIDE — SIGN OFF']
];
var shotNo=D.getElementById('shotNo'), shotSt=D.getElementById('shotSt'), tcEl=D.getElementById('tc'),
    railFill=D.getElementById('railFill'), hintEl=D.getElementById('hint'), flareEl=D.getElementById('flare'),
    navLinks=[].slice.call(D.querySelectorAll('#top-nav a'));
var lastSlate = -1, lastTc = '';
function pad(v,n){ v = String(Math.floor(v)); while (v.length<n) v='0'+v; return v; }

function syncDom(t){
  var i, p;
  for (i=0;i<PANELS.length;i++){
    p = PANELS[i];
    var on = t >= p.a && t <= p.b;
    if (on !== p.was){ p.el.classList.toggle('on', on); p.was = on; }
  }
  D.body.classList.toggle('cine', t > 0.160 && t < 0.735);

  var s = 0;
  for (i=0;i<SLATE.length;i++) if (t >= SLATE[i][0]) s = i;
  if (s !== lastSlate){ lastSlate = s; shotNo.textContent = SLATE[s][1]; shotSt.textContent = SLATE[s][2]; }

  var frames = Math.round(t * 24 * 96);                     /* a 96-second reel */
  var str = '00:'+pad(frames/(24*60),2)+':'+pad((frames/24)%60,2)+':'+pad(frames%24,2);
  if (str !== lastTc){ lastTc = str; tcEl.textContent = str; }
  railFill.style.transform = 'scaleX(' + t.toFixed(4) + ')';

  var act = t<0.44 ? 0 : t<0.74 ? 1 : t<0.93 ? 2 : -1;
  for (i=0;i<navLinks.length;i++) navLinks[i].classList.toggle('on', i === act);
  hintEl.classList.toggle('gone', t > 0.02);
}

/* ══════════════════════════════════════════════════════════════════════
   THE LOOP
   ══════════════════════════════════════════════════════════════════════ */
var streakSeed = streaks.userData.seed, sObj = new THREE.Object3D();
var vpW = W.innerWidth, vpH = W.innerHeight;
function resize(){
  vpW = W.innerWidth; vpH = W.innerHeight;
  renderer.setPixelRatio(Math.min(W.devicePixelRatio||1, Q.dpr));
  renderer.setSize(vpW, vpH, false);
  camera.aspect = vpW/vpH; camera.updateProjectionMatrix();
  readScroll();
  renderer.shadowMap.needsUpdate=true;
  requestRender(0);
}
W.addEventListener('resize', resize);
W.addEventListener('orientationchange', function(){ setTimeout(resize, 220); });

var proj = new THREE.Vector3();
var prev = 0;
D.addEventListener('visibilitychange', function(){
  hidden = D.hidden;
  if (hidden) {
    if (raf) cancelAnimationFrame(raf); raf=0;
    if (galleryTimer) clearTimeout(galleryTimer); galleryTimer=0;
  } else {
    prev=performance.now(); lastInteraction=prev; requestRender(0);
  }
});

function resourceBytes(){
  return performance.getEntriesByType('resource').reduce(function(total,entry){
    if (entry.name.indexOf(W.location.origin) !== 0) return total;
    return total + (entry.encodedBodySize || entry.transferSize || 0);
  },0);
}
function refreshPerf(now){
  renderedFrames++; renderedTotal++;
  var elapsed=now-fpsWindowStart;
  if(elapsed>=500){
    fps=renderedFrames*1000/elapsed;
    renderedFrames=0; fpsWindowStart=now;
    if(perfEnabled && perfEl){
      var stats=renderer.info.render;
      perfEl.textContent='FPS '+fps.toFixed(0)+'  '+frameTimeMs.toFixed(1)+'ms\nDPR '+renderer.getPixelRatio().toFixed(2)+
        '  calls '+stats.calls+'  tris '+stats.triangles.toLocaleString()+
        '\nloaded '+(resourceBytes()/1048576).toFixed(2)+' MB  ready '+Math.round(readyMs)+'ms';
    }
  }
}

function activateVehicle(nextVehicle, variant){
  if(!nextVehicle || activeModelVariant===variant) return;
  var oldCar=car, newCar=nextVehicle.group;
  newCar.position.copy(oldCar.position); newCar.rotation.copy(oldCar.rotation);
  newCar.quaternion.copy(oldCar.quaternion); newCar.scale.copy(oldCar.scale); newCar.visible=oldCar.visible;
  if(!newCar.children.some(function(child){return child.userData.runtimeShared;})) newCar.add(contact(5.4,2.5));
  for(var wi=0;wi<Math.min(wheels.length,nextVehicle.wheels.length);wi++){
    nextVehicle.wheels[wi].userData.turn.rotation.copy(wheels[wi].userData.turn.rotation);
  }
  world.remove(oldCar); world.add(newCar);
  vehicle=nextVehicle; car=newCar; wheels=nextVehicle.wheels; activeModelVariant=variant;
  renderer.shadowMap.needsUpdate=true;
}

function tick(now){
  raf=0;
  if (hidden || D.body.classList.contains('flat')) return;
  var dt = Math.min(0.05, (now - prev) / 1000 || 0.016); prev = now; clock += dt;

  /* One short, frame-rate-independent damping step for both car and camera. */
  tNow += (tTarget - tNow) * (1 - Math.exp(-dt * 8.5));
  var t = tNow;

  /* The same studio remains present from the opening mark through the last
     frame; there is no room swap between shot labels. */
  studio.visible = true;

  var cx = carAt(t);
  var dx = cx - lastCarX; lastCarX = cx;
  var speed = Math.abs(dx) / dt;
  travel += dx;
  car.position.x = cx;
  // The key and its shadow follow the dolly with a constant lighting angle.
  key.position.set(cx+4,13,3.5); key.target.position.set(cx,0,0);
  // The car begins outside the opening frame and drives into view. Keeping it
  // rendered throughout removes the single-frame pop that appeared at 8%.
  car.visible = true;
  if(activeModelVariant==='full' && t>=0.735) activateVehicle(wideVehicle,'wide');
  else if(activeModelVariant==='wide' && fullVehicle && ((t>=0.082 && t<=0.108) || (t>=0.455 && t<0.735))) {
    activateVehicle(fullVehicle,'full');
  }

  /* wheels turn on the ground they cover, so scrubbing back turns them back */
  for (var i=0;i<wheels.length;i++) {
    wheels[i].userData.turn.rotation.z -= dx / wheels[i].userData.radius;
  }
  /* a touch of steering lock and squat under braking */
  var brake = cinematic.brakeAt(t);
  car.rotation.z = -brake * 0.005;
  car.position.y = -brake * 0.006;

  /* the discs take the heat and give it back slowly */
  /* peak on the brakes, then a long ember that is still alive for the macro */
  var heat = clamp(sstep(0.355, 0.470, t) * (1 - 0.66*sstep(0.500, 0.665, t))
                                          * (1 - sstep(0.720, 0.810, t)), 0, 1);
  vehicle.setHeat(heat);
  brakeLight.intensity = heat * 0.06;
  brakeLight.position.set(cx + 1.324, 0.3284, 0.965);
  wheelKey.intensity = sstep(0.470,0.560,t) * (1 - sstep(0.720,0.760,t)) * 0.60;
  wheelKey.position.set(cx + 2.33, 1.50, 2.6);
  vehicle.setBrake(brake);

  /* streaks: they exist while there is speed to draw them out */
  var sOp = clamp(speed / 30, 0, 1) * 0.30;
  streaks.material.opacity = sOp;
  streaks.visible = sOp > 0.012;
  if (streaks.visible){
    var span = 150, base = -70, drift = travel * 1.65;
    for (i=0;i<streakSeed.length;i++){
      var s0 = streakSeed[i];
      var x = base + (((s0[0] - base - drift) % span) + span) % span;
      sObj.position.set(x, s0[1], s0[2]);
      sObj.scale.set(s0[3] * (0.30 + clamp(speed/44,0,1)*1.25), 1, 1);
      sObj.updateMatrix();
      streaks.setMatrixAt(i, sObj.matrix);
    }
    streaks.instanceMatrix.needsUpdate = true;
  }

  /* the mark: it lifts away once the car arrives, and comes back to close */
  if (t < 0.090){
    mark.visible = true;
    mark.position.set(0, 2.85 + sstep(0.025, 0.082, t) * 15, 0);
    mark.rotation.set(0, PI/2 + sstep(0.020, 0.082, t) * 0.16, 0);
    mark.scale.setScalar(1.82);
  } else if (t > 0.905){
    var u = sstep(0.905, 0.975, t);
    mark.visible = true;
    mark.position.set(20.4, lerp(9.4, 4.50, u), 0);
    mark.rotation.set(0, PI/2 + (1-u) * 1.15, 0);
    mark.scale.setScalar(1.85);
  } else mark.visible = false;
  markKey.intensity = t < .090 ? 8 * (1-sstep(.018,.070,t)) : (mark.visible ? 4 : 0);
  if (mark.visible) markKey.position.set(mark.position.x + 5.0, mark.position.y + 3.2, 4.6);

  /* the gallery only exists once we are in it */
  var gal = t > 0.712;
  for (i=0;i<plinths.length;i++) plinths[i].visible = gal;
  if (gal){
    var rise = sstep(0.712, 0.790, t);
    for (i=0;i<plinths.length;i++) plinths[i].position.y = (rise - 1) * 1.4;
    spin[0].rotation.y = clock * 0.42;
    /* Wall art remains square and level for product inspection. */
    spin[1].rotation.set(0, PI/2, 0);
    spin[2].rotation.y = clock * 0.48;
    spin[2].rotation.z = 0;
  }
  /* the road recedes as the floor takes over */
  barGroup.visible = t < 0.760;

  /* ── set the camera ── */
  frameShot(t, cx);
  camera.position.copy(camPos);
  camera.up.set(0,1,0);
  camera.lookAt(camLook);
  if (camRoll) camera.rotateZ(camRoll);
  /* The shared camera sampler includes portrait framing and the
     deliberate release into the wheel macro. */
  var fit = camFov;
  if (camera.fov !== fit){ camera.fov = fit; camera.updateProjectionMatrix(); }

  // Raise the travelling car above the stacked copy in portrait layouts.
  var portraitLift = (1-sstep(.72,1.1,camera.aspect)) * .14
    * sstep(.105,.175,t) * (1-sstep(.405,.495,t));
  if (portraitLift>0) camera.setViewOffset(vpW,vpH,0,vpH*portraitLift,vpW,vpH);
  else if(camera.view && camera.view.enabled) camera.clearViewOffset();

  /* the flare rides whatever is burning brightest in frame */
  var fStrength = heat * 0.04;
  if (fStrength > 0.02){
    proj.set(cx + (heat > 0.05 ? 1.324 : 2.1), heat > 0.05 ? 0.3284 : 0.85, heat > 0.05 ? 0.94 : 0.6).project(camera);
    flareEl.style.setProperty('--fx', ((proj.x*0.5+0.5)*100).toFixed(1)+'%');
    flareEl.style.setProperty('--fy', ((-proj.y*0.5+0.5)*100).toFixed(1)+'%');
    flareEl.style.opacity = Math.min(0.85, fStrength).toFixed(3);
  } else if (flareEl.style.opacity !== '0') flareEl.style.opacity = '0';

  syncDom(t);
  if(Math.abs(dx)>0.00001 && now-lastShadowUpdate>=32){
    renderer.shadowMap.needsUpdate=true; lastShadowUpdate=now;
  }
  var renderStarted=performance.now();
  renderer.render(scene, camera);
  var renderCost=performance.now()-renderStarted;
  frameTimeMs=frameTimeMs ? frameTimeMs*0.82+renderCost*0.18 : renderCost;
  refreshPerf(now);
  var settling=Math.abs(tTarget-tNow)>0.00005 || now-lastInteraction<180;
  var rotating=t>0.712 && t<0.925 && !REDUCED;
  if(settling) requestRender(0);
  else if(rotating) requestRender(33);
}

/* ══════════════════════════════════════════════════════════════════════
   ROLL
   ══════════════════════════════════════════════════════════════════════ */
step(92,'LIGHTING THE SET');
var reviewShot = reviewParams.get('shot');
var reviewTimes = { logo:0, arrival:0.15, car:0.30, studio:0.405, bay:0.690,
  wheel:0.605, gallery:0.84, end:0.98 };
if (Object.prototype.hasOwnProperty.call(reviewTimes, reviewShot)) {
  W.scrollTo(0, (D.documentElement.scrollHeight-W.innerHeight)*reviewTimes[reviewShot]);
}
resize();
readScroll();
tNow = tTarget;
lastCarX = carAt(tNow);

/* Keep the opaque studio slate up until the live canvas has committed a frame. */
renderer.shadowMap.needsUpdate=true;
prev=performance.now()-16;
if(raf){ cancelAnimationFrame(raf); raf=0; }
fpsWindowStart=performance.now(); renderedFrames=0;
tick(performance.now());
readyMs=performance.now()-perfStarted;
readyAssetBytes=resourceBytes();
step(100,'READY');
requestAnimationFrame(function(){
  if(D.body.classList.contains('flat')) return;
  if(W.PivarionLoading) W.PivarionLoading.finish();
  else D.body.classList.add('scene-ready');

  /* Close-detail geometry is no longer part of the critical path. Load it
     after interaction is available and exchange it during the existing
     studio-to-macro transition, where the body is never seen at two LODs. */
  W.setTimeout(function(){
    W.PivarionVehicle.load('assets/', null, 'full').then(function(result){
      fullVehicle=result;
      if((tNow>=0.082 && tNow<=0.108) || (tNow>=0.455 && tNow<0.735)) activateVehicle(fullVehicle,'full');
      lastInteraction=performance.now(); requestRender(0);
    }).catch(function(error){ console.warn('Full-detail Ferrari deferred load failed',error); });
  },750);
});

/* a nudge for anyone who lands mid-page on a refresh */
if ((W.scrollY || 0) < 4) W.scrollTo(0, 0);

W.PIVARION_V2 = {
  seek: function(v){ var h = D.documentElement.scrollHeight - W.innerHeight; W.scrollTo(0, h * clamp(v,0,1)); readScroll(); lastInteraction=performance.now(); requestRender(0); },
  now: function(){ return tNow; },
  snap: function(){ readScroll(); tNow=tTarget; lastCarX=carAt(tNow); lastInteraction=performance.now(); requestRender(0); },
  info: function(){
    var stats=renderer.info.render;
    var fcp=performance.getEntriesByName('first-contentful-paint')[0];
    return { quality:'cinematic', model:activeModelVariant, fps:+fps.toFixed(1),
      frameTimeMs:+frameTimeMs.toFixed(1), dpr:renderer.getPixelRatio(), calls:stats.calls,
      triangles:stats.triangles, renderedFrames:renderedTotal,
      criticalAssetBytes:readyAssetBytes, loadedAssetBytes:resourceBytes(),
      firstVisualMs:fcp ? +fcp.startTime.toFixed(1) : null, readyMs:+readyMs.toFixed(1),
      longTasks:longTasks, maxLongTaskMs:+maxLongTaskMs.toFixed(1),
      postReadyLongTasks:postReadyLongTasks, postReadyMaxLongTaskMs:+postReadyMaxLongTaskMs.toFixed(1), hidden:hidden };
  }
};

})().catch(function (error) {
  console.error('Scene setup failed', error);
  document.body.classList.add('flat');
  if(window.PivarionLoading) window.PivarionLoading.fail();
});
