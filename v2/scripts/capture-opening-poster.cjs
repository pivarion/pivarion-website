const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { chromium } = require('playwright-core');

const url = process.argv[2] || 'http://127.0.0.1:8768/';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const destination = path.resolve(__dirname, '../assets/optimized/images');

(async () => {
  const browser = await chromium.launch({ headless:true, executablePath:chrome,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const temporary=[];
  for(const view of [
    {name:'desktop',width:1920,height:1080,dpr:1},
    {name:'mobile',width:390,height:844,dpr:2}
  ]){
    const page=await browser.newPage({
      viewport:{width:view.width,height:view.height}, deviceScaleFactor:view.dpr
    });
    await page.goto(`${url}${url.includes('?')?'&':'?'}shot=logo`,{waitUntil:'commit',timeout:60_000});
    await page.waitForFunction(() => window.PIVARION_V2 && document.body.classList.contains('scene-ready'),
      null,{timeout:120_000});
    const png=path.join(os.tmpdir(),`pivarion-opening-${view.name}.png`);
    await page.locator('#gl').screenshot({path:png});
    temporary.push(png); await page.close();
  }
  await browser.close();
  fs.mkdirSync(destination,{recursive:true});
  await Promise.all(temporary.map((png,index) => sharp(png).webp({quality:88,effort:6})
    .toFile(path.join(destination,`opening-canvas-${index?'mobile':'desktop'}.v1.webp`))));
  console.log('Captured pixel-matched desktop and 2x mobile opening posters.');
})().catch(error=>{console.error(error);process.exitCode=1;});
