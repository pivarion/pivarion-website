/* ══════════════════════════════════════════════════════════════════════
   PIVARION V2 — THE FILM
   The same shot, pre-rendered. Scroll still drives the timeline; it now
   scrubs a video instead of running a studio's worth of WebGL.

   Why this is smooth: the film is encoded all-intra — every frame is a
   keyframe — so a seek decodes exactly one frame instead of walking a GOP.
   Measured in Chromium: 19.5ms median against 41.7ms for a 48-frame GOP,
   and a far tighter tail (29ms p90 against 72ms). It costs bitrate, and it
   is the whole reason scrubbing does not judder.

   Everything below the picture — panels, slate, timecode, nav — is the
   same logic the WebGL build ran, driven from the same t.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var D = document, W = window;

var film   = D.getElementById('film');
var poster = D.getElementById('opening-poster');
var boot   = D.getElementById('boot');
var bootLbl = D.getElementById('bootLbl'), bootBar = D.getElementById('bootBar');

function flat(){
  D.body.classList.add('flat');
  if (boot) boot.style.display = 'none';
}
if (!film || !film.canPlayType) { flat(); return; }

var reviewParams = new URLSearchParams(W.location.search);
var REDUCED = W.matchMedia && W.matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ══════════════════════════════════════════════════════════════════════
   PHONE
   A seek costs a decode. On a throttled phone that is around 100ms a
   frame, so a scrubbed film feels stuck however light the page is — and a
   16:9 frame cover-cropped to portrait throws the composition away.
   Phones therefore get the film as a plain looping hero, decoded in
   hardware at full rate, and the chapters as ordinary content on an
   ordinary scroll. Nothing below this point runs on a phone.
   ══════════════════════════════════════════════════════════════════════ */
var PHONE = !reviewParams.has('desktop') && W.matchMedia &&
            W.matchMedia('(max-width:900px), (pointer:coarse) and (max-width:1180px)').matches;

if (PHONE) {
  D.body.classList.add('phone');
  film.poster = 'assets/film/hero-mobile-poster.webp';
  film.loop = true;
  film.src = 'assets/film/hero-mobile.mp4';
  film.load();

  if (!REDUCED) {
    var tryPlay = function(){ var q = film.play(); if (q && q.catch) q.catch(function(){}); };
    film.addEventListener('loadeddata', tryPlay, { once:true });
    /* a hero nobody is looking at should not be costing battery */
    if ('IntersectionObserver' in W) {
      new IntersectionObserver(function (e){
        if (e[0].isIntersecting) tryPlay(); else film.pause();
      }, { threshold: 0 }).observe(film);
    }
    D.addEventListener('visibilitychange', function(){
      if (D.hidden) film.pause(); else tryPlay();
    });
  }

  /* the whole film is a tap away rather than nine screens away */
  var cta = D.getElementById('filmCta'), shell = D.getElementById('film-full'),
      full = D.getElementById('filmFull'), close = D.getElementById('filmClose');
  if (cta && shell && full) {
    cta.addEventListener('click', function(){
      if (!full.src) full.src = 'assets/film/shot-854.mp4';
      D.body.classList.add('film-open');
      shell.setAttribute('aria-hidden', 'false');
      var q = full.play(); if (q && q.catch) q.catch(function(){});
    });
    var shut = function(){
      full.pause();
      D.body.classList.remove('film-open');
      shell.setAttribute('aria-hidden', 'true');
    };
    if (close) close.addEventListener('click', shut);
    D.addEventListener('keydown', function(e){ if (e.key === 'Escape') shut(); });
  }

  D.body.classList.add('scene-ready');
  if (boot) boot.style.display = 'none';

  W.PIVARION_V2 = {
    seek: function(){}, now: function(){ return 0; }, snap: function(){},
    info: function(){ return { mode:'phone-loop', src:film.currentSrc.split('/').pop(),
      readyState:film.readyState, paused:film.paused }; }
  };
  return;
}

/* ── desktop source: a narrow window has no use for 1280 lines ──────── */
var narrow = Math.min(W.innerWidth, W.innerHeight) < 700 ||
             (W.matchMedia && W.matchMedia('(max-width:820px)').matches);
/* ?src= swaps the reel, for QA against another encode. Same-origin relative
   paths only — it must never become a way to point the page off-site. */
var override = reviewParams.get('src');
if (override && !/^[a-z]+:|^\/\//i.test(override)) film.src = override;
else film.src = narrow ? 'assets/film/shot-854.mp4' : 'assets/film/shot-1280.mp4';
film.load();
var forcedReview = reviewParams.has('frame') ? Number(reviewParams.get('frame')) : null;
if (reviewParams.has('shot') || forcedReview !== null) W.history.scrollRestoration = 'manual';

function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function pad(v,n){ v = String(Math.floor(v)); while (v.length<n) v='0'+v; return v; }

/* ══════════════════════════════════════════════════════════════════════
   HTML IN STEP WITH THE PICTURE   (unchanged from the WebGL build)
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
    railFill=D.getElementById('railFill'), hintEl=D.getElementById('hint'),
    navLinks=[].slice.call(D.querySelectorAll('#top-nav a'));
var lastSlate = -1, lastTc = '';

function syncDom(t){
  var i, p;
  for (i=0;i<PANELS.length;i++){
    p = PANELS[i];
    if (!p.el) continue;
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
   SCROLL → TIME → FRAME
   ══════════════════════════════════════════════════════════════════════ */
var tTarget = 0, tNow = 0, prev = 0, raf = 0, ready = false;
var hidden = D.hidden, lastInteraction = 0;
var DUR = 20;                       /* replaced by the real duration on load */
var HALF_FRAME = 1 / 48;

function readScroll(){
  if (forcedReview !== null){ tTarget = clamp(forcedReview,0,1); return; }
  var h = D.documentElement.scrollHeight - W.innerHeight;
  tTarget = clamp(h > 0 ? (W.scrollY || W.pageYOffset) / h : 0, 0, 1);
}

/* A seek issued while another is in flight is dropped by the browser, so the
   newest target is held and applied when the last one lands. That, plus the
   half-frame threshold, is what keeps a fast flick from queueing work it will
   never show. */
var pendingSeek = null, seeking = false;
function showFrame(t){
  if (!ready) return;
  var want = clamp(t, 0, 1) * (DUR - HALF_FRAME);
  if (Math.abs(want - film.currentTime) < HALF_FRAME) return;
  if (seeking){ pendingSeek = want; return; }
  seeking = true;
  film.currentTime = want;
}
film.addEventListener('seeked', function(){
  seeking = false;
  if (pendingSeek !== null){
    var next = pendingSeek; pendingSeek = null;
    if (Math.abs(next - film.currentTime) >= HALF_FRAME){ seeking = true; film.currentTime = next; }
  }
});

function loop(now){
  raf = 0;
  if (hidden) return;
  var dt = Math.min(0.05, (now - prev) / 1000 || 0.016); prev = now;
  tNow += (tTarget - tNow) * (1 - Math.exp(-dt * 8.5));
  if (Math.abs(tTarget - tNow) < 0.00002) tNow = tTarget;
  showFrame(tNow);
  syncDom(tNow);
  /* keep stepping only while the picture is still catching up */
  if (Math.abs(tTarget - tNow) > 0.00002 || now - lastInteraction < 180) request();
}
function request(){
  if (hidden || raf) return;
  raf = W.requestAnimationFrame(loop);
}

W.addEventListener('scroll', function(){
  readScroll(); lastInteraction = performance.now(); request();
}, { passive:true });
W.addEventListener('resize', function(){ readScroll(); request(); });
D.addEventListener('visibilitychange', function(){
  hidden = D.hidden;
  if (!hidden){ prev = performance.now(); request(); }
});

/* ══════════════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════════════ */
function progress(){
  if (!bootBar || !film.buffered || !film.buffered.length || !film.duration) return;
  var pct = Math.round(film.buffered.end(film.buffered.length-1) / film.duration * 100);
  bootBar.textContent = pct + '%';
}
film.addEventListener('progress', progress);

var failed = false;
film.addEventListener('error', function(){ if (!failed){ failed = true; flat(); } });

function start(){
  if (ready) return;
  ready = true;
  DUR = film.duration || 20;
  if (bootLbl) bootLbl.textContent = 'READY';

  var reviewShot = reviewParams.get('shot');
  var reviewTimes = { logo:0, arrival:0.15, car:0.30, studio:0.405, bay:0.690,
    wheel:0.605, gallery:0.84, end:0.98 };
  if (Object.prototype.hasOwnProperty.call(reviewTimes, reviewShot)) {
    W.scrollTo(0, (D.documentElement.scrollHeight - W.innerHeight) * reviewTimes[reviewShot]);
  }
  readScroll();
  tNow = tTarget;
  showFrame(tNow);
  syncDom(tNow);

  /* the poster hands over only once a real frame is on screen */
  var reveal = function(){
    D.body.classList.add('scene-ready');
    if (poster) poster.style.display = 'none';
    if (boot) boot.style.display = 'none';
  };
  if (film.currentTime > 0 && !seeking) reveal();
  else film.addEventListener('seeked', reveal, { once:true });
  W.setTimeout(reveal, 1200);          /* never let the poster get stuck */
  request();
}

/* Safari will not scrub a video it has never been allowed to play, so it is
   nudged once, silently, and stopped on the first frame. */
function unlock(){
  var p = film.play();
  if (p && p.then) p.then(function(){ film.pause(); }).catch(function(){});
  else { try { film.pause(); } catch (e) {} }
}
film.addEventListener('loadedmetadata', function(){ unlock(); }, { once:true });
if (film.readyState >= 2) start();
else film.addEventListener('loadeddata', start, { once:true });
film.addEventListener('canplay', start);

/* a nudge for anyone who lands mid-page on a refresh */
if ((W.scrollY || 0) < 4 && forcedReview === null && !reviewParams.has('shot')) W.scrollTo(0, 0);

W.PIVARION_V2 = {
  seek: function(v){
    var h = D.documentElement.scrollHeight - W.innerHeight;
    W.scrollTo(0, h * clamp(v,0,1)); readScroll();
    lastInteraction = performance.now(); request();
  },
  now: function(){ return tNow; },
  snap: function(){ readScroll(); tNow = tTarget; showFrame(tNow); syncDom(tNow); },
  info: function(){
    return { mode:'film', src:film.currentSrc.split('/').pop(),
      duration:film.duration, currentTime:+film.currentTime.toFixed(3),
      readyState:film.readyState, t:+tNow.toFixed(4),
      buffered: film.buffered.length ? +film.buffered.end(film.buffered.length-1).toFixed(2) : 0 };
  }
};
})();
