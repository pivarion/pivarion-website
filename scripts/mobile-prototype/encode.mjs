import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
const encoder=process.env.PIVARION_FFMPEG || '/tmp/pivarion-encoder/node_modules/ffmpeg-static/ffmpeg';
const out='mobile-prototype/media';await fs.mkdir(out,{recursive:true});
const manifest={version:1,sourceCommit:'7b8160e',width:720,height:1560,fps:24,gate:'physical-device-test-pending',samples:{}};
async function version(file){const bytes=await fs.readFile(file);const hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);const ext=path.extname(file);const name=path.basename(file,ext)+'.'+hash+ext;await fs.rename(file,path.join(out,name));return {src:'media/'+name,bytes:bytes.length};}
for(const [name,start,end] of [['opening',0,.22],['wheel',.49,.67]]){
 const dir='/tmp/pivarion-mobile-capture/frames/'+name;
 const count=(await fs.readdir(dir)).filter(f=>f.endsWith('.png')).length;
 const expected=Math.ceil((end-start)*576)+1;if(count!==expected)throw Error(name+': incomplete capture');
 const poster=path.join(out,name+'-poster.webp');await sharp(dir+'/0000.png').webp({quality:90}).toFile(poster);
 const sample=manifest.samples[name]={start,end,count,duration:count/24,lastFrameTime:(count-1)/24,poster:await version(poster),encodes:{}};
 for(const gop of [1,6]){
  const file=path.join(out,name+'-gop'+gop+'.mp4');
  execFileSync(encoder,['-y','-hide_banner','-loglevel','error','-framerate','24','-i',dir+'/%04d.png','-an','-c:v','libx264','-preset','slow','-crf','21','-pix_fmt','yuv420p','-g',String(gop),'-keyint_min',String(gop),'-sc_threshold','0','-bf','0','-movflags','+faststart','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709',file],{stdio:'inherit'});
  sample.encodes[gop]=await version(file);
 }
}
await fs.writeFile('mobile-prototype/manifest.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
