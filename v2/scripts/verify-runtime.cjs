const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

const url = process.argv[2] || 'http://127.0.0.1:8768/';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({
    headless:true,
    executablePath:chrome,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport:{width:1280,height:720}, deviceScaleFactor:1 });
  const errors=[];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(`${request.url()} ${request.failure()?.errorText || 'failed'}`));
  await page.goto(url, { waitUntil:'commit', timeout:60_000 });
  await page.waitForSelector('#boot', { state:'visible' });
  await page.waitForFunction(() => window.PIVARION_V2 && document.body.classList.contains('scene-ready'),
    null, { timeout:120_000 });
  const ready = await page.evaluate(() => window.PIVARION_V2.info());
  console.log('Opening diagnostics:', JSON.stringify(ready));
  assert(ready.criticalAssetBytes <= 8*1024*1024, 'critical transfer exceeds 8 MiB');
  assert(ready.firstVisualMs !== null && ready.firstVisualMs < 1500, 'opening visual missed 1.5 s local budget');

  await page.evaluate(() => { window.PIVARION_V2.seek(.095); window.PIVARION_V2.snap(); });
  await page.waitForFunction(() => window.PIVARION_V2.info().model === 'full', null, { timeout:60_000 });
  await page.evaluate(() => { window.PIVARION_V2.seek(.30); window.PIVARION_V2.snap(); });
  await page.waitForTimeout(1000);
  const complete = await page.evaluate(() => window.PIVARION_V2.info());
  assert(complete.loadedAssetBytes <= 15*1024*1024, 'complete transfer exceeds 15 MiB');
  assert.equal(errors.length,0,errors.join('\n'));

  await page.evaluate(() => { window.PIVARION_V2.seek(.84); window.PIVARION_V2.snap(); });
  await page.waitForFunction(() => window.PIVARION_V2.info().model === 'wide', null, { timeout:60_000 });
  const gallery = await page.evaluate(() => window.PIVARION_V2.info());
  await browser.close();
  console.log(JSON.stringify({ ready, complete, gallery, browserErrors:errors }, null, 2));
})().catch(error => { console.error(error); process.exitCode=1; });
