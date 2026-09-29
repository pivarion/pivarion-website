// Temporary capture harness only. Never changes the production scene.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
execFileSync('git',['diff','--quiet','7b8160e','--','v2/index.html','v2/js/experience.v1.js','v2/js/vehicle.js','v2/js/mark.js','v2/js/mark-outlines.js','v2/js/cinematic-track.js'],{stdio:'inherit'});
const root=process.cwd(), out='/tmp/pivarion-mobile-capture';
await fs.mkdir(path.join(out,'v2/js'),{recursive:true});
for(const dir of ['assets','lib']){
  await fs.rm(path.join(out,'v2',dir),{force:true,recursive:true});
  await fs.symlink(path.join(root,'v2',dir),path.join(out,'v2',dir));
}
await fs.cp('v2/js',path.join(out,'v2/js'),{recursive:true});
let source=await fs.readFile('v2/js/experience.v1.js','utf8');
source=source.replace("var Q = { dpr:1.5", "var Q = { dpr:2");
source=source.replace('var perfStarted = 0', 'var captureMode=false; var perfStarted = 0');
source=source.replace('if(settling) requestRender(0);','if(captureMode) return;\n  if(settling) requestRender(0);');
source=source.replace('W.PIVARION_V2 = {',`W.PIVARION_V2 = {
  capture: async function(t){
    captureMode=true;
    if(raf) cancelAnimationFrame(raf); raf=0;
    if(galleryTimer) clearTimeout(galleryTimer); galleryTimer=0;
    if(!fullVehicle) fullVehicle=await W.PivarionVehicle.load('assets/',null,'full');
    activateVehicle(t>=.095 && t<.735 ? fullVehicle : wideVehicle,t>=.095 && t<.735 ? 'full':'wide');
    var previousT=Math.max(0,t-1/576), x0=carAt(0), x=carAt(t);
    tTarget=tNow=t; lastCarX=carAt(previousT); travel=lastCarX-x0;
    wheels.forEach(function(w){ w.userData.turn.rotation.z=-(lastCarX-x0)/w.userData.radius; });
    clock=t*24-1/24;
    var now=performance.now(); prev=now-1000/24;
    renderer.shadowMap.needsUpdate=true;
    tick(now);
    return await new Promise(function(resolve){ canvas.toBlob(resolve,'image/png'); });
  },`);
await fs.writeFile(path.join(out,'v2/js/experience.v1.js'),source);
let html=await fs.readFile('v2/index.html','utf8');
html=html.replace('<head>','<head><base href="/v2/">');
// Freeze signage font metrics before the scene is constructed.
html=html.replace('<script src="js/experience.v1.js?v=loading-2" defer></script>',`<script type="module">await document.fonts.ready; const s=document.createElement('script');s.src='js/experience.v1.js';document.body.append(s);</script>`);
await fs.writeFile(path.join(out,'v2/index.html'),html);
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html><head><title>Pivarion capture harness</title><style>body{background:#111;color:white;font:16px system-ui}iframe{width:360px;height:780px;border:0}button{padding:12px}output{display:block}</style></head><body><h1>Approved-scene capture</h1><button id="capture">Capture prototype samples</button><output id="status">Wait for the studio to open, then capture.</output><iframe src="/v2/"></iframe><script>
const frame=document.querySelector('iframe'), status=document.querySelector('output');
document.querySelector('button').onclick=async()=>{
 try{
  const api=frame.contentWindow.PIVARION_V2;if(!api)throw Error('Scene is still loading');
  document.querySelector('button').disabled=true;
  for(const [name,start,end] of [['opening',0,.22],['wheel',.49,.67]]){
   const count=Math.ceil((end-start)*576)+1;
   for(let i=0;i<count;i++){
    const blob=await api.capture(start+(end-start)*i/(count-1));
    const r=await fetch('/frames/'+name+'/'+String(i).padStart(4,'0')+'.png',{method:'POST',body:blob});
    if(!r.ok)throw Error('Frame save failed');
    status.textContent=name+' '+(i+1)+' / '+count;
    await new Promise(requestAnimationFrame);
   }
  }
  status.textContent='Capture complete';
 }catch(e){status.textContent=e.message;document.querySelector('button').disabled=false;}
};</script></body></html>`);
console.log(out);
