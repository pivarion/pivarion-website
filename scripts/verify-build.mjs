import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('dist');
async function walk(dir){let files=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()) files.push(...await walk(p));else if(e.name.endsWith('.html'))files.push(p);}return files;}
let checked=0;
for(const file of await walk(path.join(root,'v2'))){
 const html=await fs.readFile(file,'utf8');
 for(const m of html.matchAll(/<(?:script|link|img|source)\b[^>]*?\b(?:src|href)="([^"#?]+)(?:[^\"]*)?"/g)){
  if(/^(https?:|data:|\/\/)/.test(m[1]))continue;
  const target=m[1].startsWith('/')?path.join(root,m[1]):path.resolve(path.dirname(file),m[1]);
  await fs.access(target).catch(()=>assert.fail(`Missing built asset ${m[1]} in ${file}`));checked++;
 }
}
const html=await fs.readFile('dist/v2/index.html','utf8');
assert(!html.includes('<picture id="opening-poster"'),'hidden poster still in critical page');
assert(html.includes('type="module"'));
assert(!html.includes('experience.v1.js?v='));
const manifest=JSON.parse(await fs.readFile('dist/v2/build/manifest.json'));
assert((await fs.stat('dist/v2/build/'+manifest.assets.logo)).size<5000,'UI logo exceeds 5 KB');
assert(manifest.jsBytes<800000,'JS chunks exceed 800 KB uncompressed');
assert(!(await fs.readdir('dist/v2')).includes('scripts'),'development scripts deployed');
console.log(`Verified ${checked} local asset references, hashed chunks, logo and code budgets.`);
