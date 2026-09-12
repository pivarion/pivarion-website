const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright-core');
const url = process.argv[2] || 'http://127.0.0.1:8770/services/';
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const out='/tmp/pivarion-services';fs.mkdirSync(out,{recursive:true});
  try {
    for (const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
      const page = await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url); await page.evaluate(()=>document.fonts.ready);
      const dealer=page.locator('#tab-dealership'), owner=page.locator('#tab-private-owner');
      assert.equal(await dealer.getAttribute('aria-selected'),'true');
      assert.equal(await page.locator('[role=tabpanel]:visible').count(),1);
      await page.screenshot({path:`${out}/${name}-dealer.png`,fullPage:true});
      await owner.click();
      assert.equal(await page.locator('body').getAttribute('data-audience'),'private-owner');
      assert.equal(await page.locator('[role=tabpanel]:visible').count(),1);
      assert.equal(new URL(page.url()).searchParams.get('audience'),'private-owner');
      await page.locator('#panel-private-owner img').evaluate(img=>img.decode());
      await page.screenshot({path:`${out}/${name}-owner.png`,fullPage:true});
      assert(await page.locator('#owner-art a').getAttribute('href').then(h=>h.includes('Private%20owner')));
      await page.reload();
      assert.equal(await owner.getAttribute('aria-selected'),'true');
      await owner.focus();await page.keyboard.press('ArrowLeft');
      assert.equal(await dealer.getAttribute('aria-selected'),'true');
      await page.goBack();
      assert.equal(await owner.getAttribute('aria-selected'),'true');
      for (const choice of ['dealership','private-owner']) {
        await page.locator(`#tab-${choice}`).click();
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
        const broken=await page.locator('[role=tabpanel]:visible a[href^="#"]').evaluateAll(links=>links.filter(a=>!document.querySelector(a.getAttribute('href'))).length);
        assert.equal(broken,0);
      }
      await page.goto(url+'#web');assert(await page.locator('#web').isVisible());
      await page.goto(url+'?audience=dealership#owner-book');assert(await page.locator('#owner-book').isVisible());
      assert.deepEqual(errors,[]);
      console.log(`${name}: switching, keyboard, history, reload, deep links and overflow passed`);
      await page.close();
    }
    const nojs=await browser.newPage({javaScriptEnabled:false});await nojs.goto(url);
    assert(await nojs.locator('#panel-dealership').isVisible());assert(await nojs.locator('#panel-private-owner').isVisible());
    await nojs.close();console.log('No-JavaScript services remain available');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
