const D=document;
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
var lastSlate = -1, lastTc = '', lastDomProgress = -1;
function pad(v,n){ v = String(Math.floor(v)); while (v.length<n) v='0'+v; return v; }

function syncDom(t){
  if(t === lastDomProgress) return;
  lastDomProgress = t;
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


export {syncDom};
