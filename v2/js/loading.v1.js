(function () {
  'use strict';
  var boot=document.getElementById('boot'), progress=0, finished=false;
  var panels=[document.getElementById('chrome'),document.getElementById('scroll')];
  panels.forEach(function(panel){ panel.inert=true; });
  function update(value,label){
    if(finished || value<progress) return;
    progress=Math.max(progress,Math.min(100,value));
    document.getElementById('bootFill').style.transform='scaleX('+(progress/100)+')';
    document.getElementById('bootBar').textContent=Math.round(progress)+'%';
    boot.querySelector('[role=progressbar]').setAttribute('aria-valuenow',Math.round(progress));
    if(label) document.getElementById('bootLbl').textContent=label;
  }
  function unlock(){
    document.documentElement.classList.remove('is-loading','is-revealing');
    panels.forEach(function(panel){ panel.inert=false; });
  }
  function dismiss(){
    boot.hidden=true;
    if(boot.contains(document.activeElement)) document.getElementById('brand').focus({preventScroll:true});
  }
  function fail(){
    if(finished) return;
    finished=true; clearTimeout(slowTimer);
    document.body.classList.add('flat'); unlock(); dismiss();
  }
  var slowTimer=setTimeout(function(){ document.getElementById('bootHelp').hidden=false; },20000);
  document.getElementById('bootRetry').onclick=function(){ location.reload(); };
  document.getElementById('bootSimple').onclick=fail;
  window.addEventListener('error',function(event){
    if(event.target && event.target.tagName==='SCRIPT') fail();
  },true);
  window.PivarionLoading={update:update,fail:fail,finish:function(){
    if(finished) return;
    update(100,'The stage is yours'); finished=true; clearTimeout(slowTimer);
    document.body.classList.add('scene-ready');
    document.documentElement.classList.replace('is-loading','is-revealing');
    boot.classList.add('revealing');
    var reduced=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    setTimeout(function(){ unlock(); dismiss(); },reduced?0:720);
  }};
})();
