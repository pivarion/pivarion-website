const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=') || true];
}));
const url = args.url || 'http://127.0.0.1:8768/';
const output = path.resolve(args.output || '/tmp/pivarion-frames');
const chrome = args.chrome || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const frames = { logo: 0, arrival: 0.15, car: 0.30, studio: 0.405,
  wheel: 0.605, gallery: 0.84, product: 0.888, end: 0.98 };

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: chrome,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const report = { url, capturedAt: new Date().toISOString(), views: {} };
  for (const view of [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'mobile', width: 390, height: 844 }
  ]) {
    const page = await browser.newPage({
      viewport: { width: view.width, height: view.height }, deviceScaleFactor: 1
    });
    const started = Date.now();
    await page.goto(`${url}${url.includes('?') ? '&' : '?'}shot=logo`, {
      waitUntil: 'domcontentloaded', timeout: 60_000
    });
    await page.waitForFunction(() => window.PIVARION_V2 && document.body.classList.contains('scene-ready'),
      null, { timeout: 120_000 });
    const readyWallMs = Date.now() - started;
    const readyInfo = await page.evaluate(() => window.PIVARION_V2.info());
    /* Walk through the hidden logo/car handoff once so all close product
       frames are captured with the deferred full-detail Ferrari. */
    await page.evaluate(() => { window.PIVARION_V2.seek(.095); window.PIVARION_V2.snap(); });
    await page.waitForFunction(() => window.PIVARION_V2.info().model === 'full', null, { timeout: 60_000 });
    const frameInfo = {};
    for (const [name, progress] of Object.entries(frames)) {
      await page.evaluate(value => {
        window.PIVARION_V2.seek(value);
        window.PIVARION_V2.snap();
      }, progress);
      await page.waitForTimeout(140);
      await page.screenshot({ path: path.join(output, `${name}-${view.name}.png`) });
      await page.locator('#gl').screenshot({
        path: path.join(output, `canvas-${name}-${view.name}.png`)
      });
      if (name === 'logo') fs.copyFileSync(
        path.join(output, `canvas-${name}-${view.name}.png`),
        path.join(output, `opening-canvas-${view.name}.png`));
      frameInfo[name] = await page.evaluate(() => window.PIVARION_V2.info());
    }
    report.views[view.name] = {
      readyWallMs,
      readyInfo,
      frames: frameInfo,
      info: await page.evaluate(() => window.PIVARION_V2.info())
    };
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
