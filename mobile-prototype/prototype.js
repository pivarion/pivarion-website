import {syncDom} from './timeline.js';
const $=id=>document.getElementById(id);
const manifest=await fetch('manifest.json').then(r=>{if(!r.ok)throw Error('Manifest unavailable');return r.json();});
const video=$('sampleVideo'),canvas=$('gl'),ctx=canvas.getContext('2d',{alpha:false});
canvas.width=manifest.width;canvas.height=manifest.height;
const fps=manifest.fps, reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const usesFrameCallback='requestVideoFrameCallback' in video;
let sample,activeSample,activeGop,loaded=false,pending=null,desired=null,frameCallback=0,watchdog=0,generation=0,displayTime=-1;
let samples=[],runs=[],stalls=0,superseded=0,longTasks=[],started=performance.now(),firstFrameMs=null,painted=false,benchTimer=0,scenario='manual';
let lastPresented=0,gaps=[],activeUntil=0,lastStall=null;
try{new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});}catch{}
const p95=values=>values.length?[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1]:null;
function report(){return {version:1,sourceCommit:manifest.sourceCommit,scene:activeSample,gop:+activeGop,
 userAgent:navigator.userAgent,device:$('device').value,physicalPhone:$('physical').checked,visualReview:$('visual').value,
 viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},frameMeasurement:usesFrameCallback?'video-frame-callback + canvas draw':'seeked + animation-frame (not a gate pass)',
 scenario,sampleCount:samples.length,p95InputToFrameMs:p95(samples),maxInputToFrameMs:samples.length?Math.max(...samples):null,
 p95ActiveFrameGapMs:p95(gaps),supersededTargets:superseded,stalls,firstFrameMs,lastStall,
 requestedMediaBytes:sample.encodes[activeGop].bytes,posterBytes:sample.poster.bytes,
 firstContentfulPaintMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,
 loadedResources:performance.getEntriesByType('resource').map(e=>({url:e.name,bytes:e.encodedBodySize})),
 longTasks:longTasks.filter(e=>e.start>=started),gate:'pending physical-phone and visual review',reducedMotion:reduced};}
function update(){const r=report();$('rawResults').textContent=JSON.stringify(r);$('results').textContent=`${r.sampleCount} frame updates · p95 ${r.p95InputToFrameMs?.toFixed(1)??'—'} ms\n${(r.requestedMediaBytes/1e6).toFixed(2)} MB sample · ${stalls} stalls\n${usesFrameCallback?'Frame callback measurement':'Timing estimate only'} · physical-phone gate pending`+(lastStall?'\n'+JSON.stringify(lastStall):'');}
function cancelSeek(){clearTimeout(watchdog);if(frameCallback&&usesFrameCallback)video.cancelVideoFrameCallback(frameCallback);frameCallback=0;pending=null;}
function paint(time){
 if(!video.videoWidth)return;
 ctx.drawImage(video,0,0,canvas.width,canvas.height);canvas.classList.add('has-frame');painted=true;
 displayTime=time;syncDom(sample.start+Math.min(1,time/sample.lastFrameTime)*(sample.end-sample.start));
 if(firstFrameMs===null)firstFrameMs=performance.now()-started;
}
function complete(time){
 if(!pending)return;
 // Never label a stale decoder frame as the requested position.
 if(Math.abs(time-pending.time)>1/fps+.002){armFrame();return;}
 const request=pending;paint(time);
 const now=performance.now();samples.push(now-request.at);
 if(lastPresented&&now<activeUntil)gaps.push(now-lastPresented);lastPresented=now;
 cancelSeek();$('testStatus').textContent='Ready — scroll to move the camera.';update();
 requestAnimationFrame(pump);
}
function armFrame(){
 if(!usesFrameCallback||frameCallback)return;
 const token=generation;
 frameCallback=video.requestVideoFrameCallback((_,meta)=>{frameCallback=0;if(token===generation)complete(meta.mediaTime);});
}
function pump(){
 if(!loaded||pending||!desired||document.hidden||reduced)return;
 if(Math.abs(desired.time-displayTime)<.5/fps)return;
 // Aim inside the frame, not at its boundary: microsecond rounding can
 // otherwise select the previous frame and produce no new-frame callback.
 pending={...desired};armFrame();video.currentTime=pending.time+.5/fps;
 watchdog=setTimeout(()=>{lastStall={target:pending?.time,currentTime:video.currentTime,seeking:video.seeking,readyState:video.readyState,displayTime};stalls++;cancelSeek();$('testStatus').textContent='Playback stalled. Last frame preserved; change the sample to retry.';loaded=false;update();},2500);
}
function target(time){
 time=Math.round(Math.max(0,Math.min(sample.lastFrameTime,time))*fps)/fps;
 if(desired?.time===time)return;
 if(pending&&desired?.time!==pending.time)superseded++;
 desired={time,at:performance.now()};activeUntil=performance.now()+200;pump();
}
video.addEventListener('seeked',()=>{if(!usesFrameCallback&&pending)requestAnimationFrame(()=>complete(video.currentTime));});
video.addEventListener('loadeddata',()=>{loaded=true;paint(video.currentTime);$('testStatus').textContent='Ready — scroll to move the camera.';update();pump();});
video.addEventListener('error',()=>{cancelSeek();loaded=false;$('testStatus').textContent='Video unavailable. The studio still is shown; navigation remains available.';update();});
function saveRun(){if(sample)runs.push(report());}
function load(){
 saveRun();generation++;cancelSeek();clearTimeout(benchTimer);benchTimer=0;loaded=false;desired=null;displayTime=-1;painted=false;
 samples=[];gaps=[];lastPresented=0;stalls=0;lastStall=null;superseded=0;firstFrameMs=null;scenario='manual';started=performance.now();
 activeSample=$('sample').value;activeGop=$('encoding').value;sample=manifest.samples[activeSample];$('visual').value='unreviewed';video.pause();video.removeAttribute('src');video.load();
 canvas.classList.remove('has-frame');$('poster').src=sample.poster.src;
 syncDom(sample.start);window.scrollTo(0,0);
 if(reduced){$('testStatus').textContent='Reduced motion: studio still shown. Motion testing is disabled.';update();return;}
 video.src=sample.encodes[activeGop].src;video.load();update();
}
addEventListener('scroll',()=>{if(scenario==='synthetic')scenario='mixed';const height=document.documentElement.scrollHeight-innerHeight;target(Math.max(0,scrollY)/Math.max(1,height)*sample.lastFrameTime);},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelSeek();clearTimeout(benchTimer);benchTimer=0;video.pause();}else{lastPresented=0;pump();}});
for(const id of ['sample','encoding'])$(id).addEventListener('change',load);
$('benchmark').onclick=()=>{
 if(!loaded||reduced){$('testStatus').textContent='Wait for the sample to load before testing.';return;}
 clearTimeout(benchTimer);samples=[];gaps=[];lastPresented=0;stalls=0;superseded=0;scenario='synthetic';
 let n=0;const count=180;
 const step=()=>{if(document.hidden)return;const f=n/count;target((f<=.5?f*2:(1-f)*2)*sample.lastFrameTime);n++;
 if(n<=count)benchTimer=setTimeout(step,1000/30);else{benchTimer=0;$('testStatus').textContent='Test finished. Review the picture and download results.';}};step();
};
$('export').onclick=()=>{const data={runs:[...runs,report()],exportedAt:new Date().toISOString(),note:'No results are sent automatically. These timings do not measure GPU FPS or certify a phone.'};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='pivarion-mobile-test.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
load();
