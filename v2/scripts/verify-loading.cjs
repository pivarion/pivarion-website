const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const url=process.argv[2]||'http://127.0.0.1:8770/';
(async()=>{
  const browser=await chromium.launch({headless:true,
    executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  fs.mkdirSync('/tmp/pivarion-loading',{recursive:true});
  try{
    for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844]]){
      const page=await browser.newPage({viewport:{width,height},reducedMotion:name==='mobile'?'reduce':'no-preference'});
      let release;const held=new Promise(resolve=>release=resolve);
      await page.route('**/experience.v1.js?*',async route=>{await held;await route.continue();});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url,{waitUntil:'commit'});
      await page.waitForFunction(()=>!!window.PivarionLoading);
      assert(await page.locator('#boot').isVisible());
      assert.equal(await page.locator('#chrome').isVisible(),false);
      assert.equal(await page.locator('#opening-poster').isVisible(),false);
      assert(await page.locator('#scroll').evaluate(e=>e.inert));
      await page.mouse.wheel(0,900);
      assert.equal(await page.evaluate(()=>scrollY),0,'loading allowed scrolling');
      await page.evaluate(()=>{PivarionLoading.update(46,'Preparing the studio');PivarionLoading.update(12,'Loading the car');});
      assert.equal(await page.locator('[role=progressbar]').getAttribute('aria-valuenow'),'46');
      assert.equal(await page.locator('#bootLbl').textContent(),'Preparing the studio');
      await page.screenshot({path:`/tmp/pivarion-loading/${name}-loading.png`});
      release();
      await page.waitForFunction(()=>document.body.classList.contains('scene-ready'),null,{timeout:120000});
      await page.waitForFunction(()=>document.getElementById('boot').hidden);
      assert.equal(await page.locator('#opening-poster').isVisible(),false);
      assert(await page.locator('#gl').isVisible());
      assert.equal(await page.locator('#scroll').evaluate(e=>e.inert),false);
      assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('is-loading')),false);
      await page.screenshot({path:`/tmp/pivarion-loading/${name}-ready.png`});
      assert.deepEqual(errors,[]);
      console.log(name+': exclusive loader, scroll lock, monotonic progress, rendered reveal and unlock passed');
      await page.close();
    }
    for(const missing of ['**/lib/three.min.js?*','**/js/loading.v1.js']){
    const failed=await browser.newPage();
    await failed.route(missing,route=>route.abort());
    await failed.goto(url,{waitUntil:'domcontentloaded'});
    await failed.waitForFunction(()=>document.body.classList.contains('flat'));
    assert(await failed.locator('#flat').isVisible());
    assert.equal(await failed.locator('#boot').isVisible(),false);
    assert.equal(await failed.evaluate(()=>document.documentElement.classList.contains('is-loading')),false);
    await failed.close();
    }
    const nojs=await browser.newPage({javaScriptEnabled:false});
    await nojs.goto(url);assert(await nojs.locator('#flat').isVisible());
    assert.equal(await nojs.locator('#boot').isVisible(),false);
    await nojs.close();
    console.log('Missing dependency and no-JavaScript fallback passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
