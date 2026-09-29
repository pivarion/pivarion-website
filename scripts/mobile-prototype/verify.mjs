import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root='mobile-prototype';
const html=await fs.readFile(root+'/index.html','utf8');
assert(!/three\.min|GLTFLoader|meshopt_decoder|experience\.v1|\.glb/.test(html),'Heavy scene dependency in phone prototype');
assert(!/is-loading/.test(html.replace(/<style>[\s\S]*?<\/style>/g,'')),'Loading lock left in prototype');
const data=JSON.parse(await fs.readFile(root+'/manifest.json'));
for(const sample of Object.values(data.samples)){
 for(const asset of [sample.poster,...Object.values(sample.encodes)]){
  const buffer=await fs.readFile(root+'/'+asset.src);assert.equal(buffer.length,asset.bytes);
  if(asset.src.endsWith('.mp4'))assert(buffer.indexOf('moov')<buffer.indexOf('mdat'),'MP4 must have fast-start metadata');
 }
 assert.equal(sample.lastFrameTime,(sample.count-1)/data.fps);
}
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
 if(/^(https?:|mailto:|#)/.test(match[1]))continue;
 await fs.access(root+'/'+match[1]);
}
assert(data.samples.opening.encodes['6'].bytes+data.samples.opening.poster.bytes<2_000_000,'Smaller opening exceeds initial prototype budget');
console.log('Prototype media, fast-start MP4, entry references and absence of 3D dependencies verified. Physical-phone gate remains pending.');
