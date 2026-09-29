// Reuse approved typography, copy, and timing; do not ship scene dependencies.
import fs from 'node:fs/promises';
import sharp from 'sharp';
const source=await fs.readFile('v2/index.html','utf8');
let html=source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
html=html.replace('<title>Pivarion — Media · Service · Product</title>','<title>Pivarion — Mobile playback prototype</title><meta name="robots" content="noindex,nofollow">');
html=html.replace(/<link[^>]+(?:as="fetch"|as="script"|modulepreload)[^>]*>/g,'');
html=html.replace(/<div id="flat">[\s\S]*?<div id="boot"/, '<div id="boot"');
html=html.replace(/<div id="boot"[\s\S]*?<output id="perf"/, '<output id="perf"');
html=html.replace(/<noscript>[\s\S]*?<\/noscript>/g,'');
html=html.replace(/assets\/pivarion-logo-original.jpg/g,'media/logo.webp');
html=html.replace(/href="(media\/|services\/|products\/|credits.html|logo-preview.html)"/g,'href="https://pivarion.com/v2/$1"');
const manifest=JSON.parse(await fs.readFile('mobile-prototype/manifest.json','utf8'));
html=html.replace('</head>',`<link rel="preload" as="image" href="${manifest.samples.opening.poster.src}" fetchpriority="high"><link rel="stylesheet" href="prototype.css"></head>`);
html=html.replace('<canvas id="gl"','<img id="poster" src="'+manifest.samples.opening.poster.src+'" alt="Pivarion studio" fetchpriority="high"><canvas id="gl"');
html=html.replace('</body>',`<video id="sampleVideo" muted playsinline preload="auto" aria-hidden="true"></video>
<aside id="testPanel"><details open><summary>Mobile playback test · not the live site</summary>
<p>Scroll forwards and backwards. Compare both encodings on your iPhone.</p>
<label>Scene <select id="sample"><option value="opening">Opening → driving</option><option value="wheel">Wheel close-up</option></select></label>
<label>Encoding <select id="encoding"><option value="6">Six-frame groups</option><option value="1">Independent frames</option></select></label>
<button id="benchmark">Run forward / reverse test</button><button id="export">Download results</button>
<label>Phone model <input id="device" placeholder="e.g. iPhone 13" maxlength="80"></label>
<label>Picture / scrolling <select id="visual"><option value="unreviewed">Not reviewed yet</option><option value="pass">Looks right, no flashes or stutter</option><option value="fail">Visible problem</option></select></label>
<label><input type="checkbox" id="physical"> I am testing on a physical phone</label>
<output id="testStatus" role="status">Loading the opening sample…</output><pre id="results"></pre><pre id="rawResults" hidden></pre>
</details></aside><script type="module" src="prototype.js"></script></body>`);
await fs.writeFile('mobile-prototype/index.html',html);
await sharp('v2/assets/pivarion-logo-original.jpg').resize({width:256}).webp({lossless:true}).toFile('mobile-prototype/media/logo.webp');
const scene=await fs.readFile('v2/js/experience.v1.js','utf8');
const start=scene.indexOf('var PANELS = [');
const end=scene.indexOf('/* ═',scene.indexOf('function syncDom',start));
await fs.writeFile('mobile-prototype/timeline.js',`const D=document;\n${scene.slice(start,end)}\nexport {syncDom};\n`);
