import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {build,transform} from 'esbuild';
import sharp from 'sharp';
const root=process.cwd(), out=path.join(root,'dist'), temp=path.join(root,'.perf-build');
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
const excluded=/\/(?:scripts|references|models)(?:\/|$)|\.(?:md|py)$/;
for(const item of ['index.html','auto','autoservice','css','js','marks','v2']) {
 await fs.cp(path.join(root,item),path.join(out,item),{recursive:true,filter:p=>!excluded.test(p.slice(root.length)) && !p.endsWith('.DS_Store') && !/performance-.*\.json$/.test(p)});
}
await fs.mkdir(temp,{recursive:true});
const abs=file=>JSON.stringify(path.join(root,'v2',file));
await fs.writeFile(path.join(temp,'engine.js'),`import Three from ${abs('lib/three.min.js')}; window.THREE=Three;`);
await fs.writeFile(path.join(temp,'scene.js'),`import Decoder from ${abs('lib/meshopt_decoder.v0.24.js')};window.MeshoptDecoder=Decoder;await import('./scene-body.js');`);
await fs.writeFile(path.join(temp,'scene-body.js'),['lib/GLTFLoader.js','js/mark-outlines.js','js/mark.js','js/vehicle.js','js/cinematic-track.js','js/experience.v1.js'].map(f=>`import ${abs(f)};`).join('\n'));
await fs.writeFile(path.join(temp,'room.js'),['js/mark-outlines.js','js/mark.js','js/hero.js'].map(f=>`import ${abs(f)};`).join('\n'));
for(const type of ['scene','room']) await fs.writeFile(path.join(temp,type+'-entry.js'),`try { await import('./engine.js'); await import('./${type}.js'); } catch(error) { console.error('Experience unavailable',error); ${type==='scene'?'window.PivarionLoading?.fail();':"document.querySelectorAll('.rise').forEach(el=>el.classList.add('in'));"} }`);
const result=await build({entryPoints:{scene:path.join(temp,'scene-entry.js'),room:path.join(temp,'room-entry.js')},outdir:path.join(out,'v2/build'),bundle:true,splitting:true,format:'esm',target:'es2022',minify:true,entryNames:'[name]-[hash]',chunkNames:'chunk-[hash]',metafile:true,legalComments:'linked'});
const preloads={scene:[],room:[]};
for(const [file,meta] of Object.entries(result.metafile.outputs)){
 const name=path.basename(meta.entryPoint||'');
 if(['engine.js','scene.js','scene-body.js'].includes(name))preloads.scene.push(path.basename(file));
 if(['engine.js','room.js'].includes(name))preloads.room.push(path.basename(file));
}
const entries={};for(const [file,meta] of Object.entries(result.metafile.outputs)) if(meta.entryPoint?.endsWith('-entry.js')) entries[path.basename(meta.entryPoint).split('-')[0]]=path.basename(file);
const manifest={entries,assets:{},jsBytes:Object.entries(result.metafile.outputs).filter(([p])=>p.endsWith('.js')).reduce((n,[,m])=>n+m.bytes,0)};
async function emit(stem,ext,bytes){const hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);const name=`${stem}.${hash}.${ext}`;await fs.writeFile(path.join(out,'v2/build',name),bytes);return name;}
const logo=await emit('logo','webp',await sharp('v2/assets/pivarion-logo-original.jpg').resize({width:256,withoutEnlargement:true}).webp({lossless:true}).toBuffer());
manifest.assets.logo=logo;
const transformed=new Map();
async function minified(file){if(transformed.has(file)) return transformed.get(file);const ext=path.extname(file).slice(1);const source=await fs.readFile(file,'utf8');const {code}=await transform(source,{loader:ext,minify:true,target:'es2022',legalComments:'inline'});const name=await emit(path.basename(file,'.'+ext),ext,code);transformed.set(file,name);return name;}
async function walk(dir){let a=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()) a.push(...await walk(p));else if(e.name.endsWith('.html')) a.push(p);}return a;}
for(const file of await walk(path.join(out,'v2'))){
 let html=await fs.readFile(file,'utf8');const rel=path.relative(path.dirname(file),path.join(out,'v2/build')).replaceAll('\\','/')+'/';
 const local=name=>rel+name;
 html=html.replace('<meta charset="utf-8">',`<meta charset="utf-8"><link rel="preload" as="image" href="${local(logo)}" fetchpriority="high">`);
 html=html.replace(/src="(?:\.\.\/)?assets\/pivarion-logo-original.jpg"/g,`src="${local(logo)}"`);
 if(file.endsWith('/v2/index.html') || /\/(media|products)\/index.html$/.test(file)){
  html=html.replace(/<script src="(?:\.\.\/)?(?:lib|js)\/(?!loading\.)([^"?]+)(?:\?[^\"]*)?" defer><\/script>/g,'');
  const type=file.endsWith('/v2/index.html')?'scene':'room';
  html=html.replace('</head>',preloads[type].map(name=>`<link rel="modulepreload" fetchpriority="low" href="${local(name)}">`).join('\n')+'\n</head>');
  html=html.replace('</body>',`<script type="module" src="${local(entries[type])}"></script>\n</body>`);
 }
 const refs=[...html.matchAll(/(?:src|href)="([^"?]+\.(?:js|css))(?:\?[^\"]*)?"/g)];
 for(const match of refs){if(/^(https?:|\/\/)/.test(match[1]) || match[1].includes('build/'))continue;const absolute=path.resolve(path.dirname(file),match[1]);const name=await minified(absolute);html=html.replaceAll(match[0],match[0].startsWith('src')?`src="${local(name)}"`:`href="${local(name)}"`);}
 for(const match of [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)]){const {code}=await transform(match[1],{loader:'css',minify:true});html=html.replace(match[0],`<style>${code}</style>`);}
 if(file.endsWith('/services/index.html')) {
  for(const stem of ['gallery-laferrari','wall-art-road']){
   const original=`../assets/optimized/images/${stem}.v1.webp`;
   const small=await emit(stem+'-640','webp',await sharp(path.join(root,'v2/assets/optimized/images',stem+'.v1.webp')).resize({width:640,withoutEnlargement:true}).webp({quality:86}).toBuffer());
   const meta=await sharp(path.join(root,'v2/assets/optimized/images',stem+'.v1.webp')).metadata();
   html=html.replace(`src="${original}"`,`src="${original}" srcset="${local(small)} 640w, ${original} ${meta.width}w" sizes="(max-width:700px) calc(100vw - 40px), (max-width:1400px) 50vw, 720px" decoding="async"`);
  }
 }
 await fs.writeFile(file,html);
}
await fs.writeFile(path.join(out,'v2/build/manifest.json'),JSON.stringify(manifest,null,2));
await fs.rm(temp,{recursive:true,force:true});
console.log(JSON.stringify(manifest,null,2));
