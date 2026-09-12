const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const v2 = path.resolve(__dirname, '..');
const asset = name => path.join(v2, 'assets', 'optimized', name);
const size = name => fs.statSync(asset(name)).size;
const MiB = 1024 * 1024;

const budgets = {
  'ferrari-laferrari-wide.v1.glb': 4 * MiB,
  'ferrari-laferrari-full.v1.glb': 8 * MiB,
  'studio/camera.v1.glb': 1.1 * MiB,
  'studio/sofa.v1.glb': 0.3 * MiB,
  'studio/laptop.v1.glb': 0.5 * MiB,
  'studio/desk.v1.glb': 0.35 * MiB,
  'studio/chair.v1.glb': 0.5 * MiB
};

for (const [name, limit] of Object.entries(budgets)) {
  assert(fs.existsSync(asset(name)), `missing optimized asset: ${name}`);
  assert(size(name) <= limit, `${name} exceeds ${(limit / MiB).toFixed(2)} MiB`);
}

function glbJSON(name) {
  const bytes = fs.readFileSync(asset(name));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${name} is not a GLB`);
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
}

for (const variant of ['wide', 'full']) {
  const name = `ferrari-laferrari-${variant}.v1.glb`;
  const doc = glbJSON(name);
  assert(doc.extensionsRequired.includes('EXT_meshopt_compression'));
  const names = new Set([
    ...doc.nodes.map(x => x.name),
    ...doc.meshes.map(x => x.name),
    ...doc.materials.map(x => x.name)
  ]);
  for (const required of ['Sketchfab_model', 'Body', 'tread.001', 'rim.001', 'Material.144']) {
    assert(names.has(required), `${name} lost required ${required}`);
  }
}

const studioBytes = Object.keys(budgets)
  .filter(name => name.startsWith('studio/'))
  .reduce((total, name) => total + size(name), 0);
const criticalBytes = size('ferrari-laferrari-wide.v1.glb') + studioBytes;
const runtimeFiles = [
  'lib/three.min.js', 'lib/GLTFLoader.js', 'lib/meshopt_decoder.v0.24.js',
  'js/mark-outlines.js', 'js/mark.js', 'js/vehicle.js',
  'js/cinematic-track.js', 'js/loading.v1.js', 'js/experience.v1.js'
];
const runtimeBytes = runtimeFiles.reduce((total, name) => total + fs.statSync(path.join(v2, name)).size, 0);
const postersBytes = size('images/opening-canvas-desktop.v1.webp') + size('images/opening-canvas-mobile.v1.webp');
const criticalTransfer = criticalBytes + runtimeBytes + postersBytes;
assert(criticalTransfer < 8 * MiB, 'critical initial transfer exceeds 8 MiB');
function directoryBytes(directory) {
  return fs.readdirSync(directory, { withFileTypes:true }).reduce((total, entry) => {
    const target=path.join(directory,entry.name);
    return total + (entry.isDirectory() ? directoryBytes(target) : fs.statSync(target).size);
  },0);
}
const completeTransfer = directoryBytes(path.join(v2,'assets','optimized')) + runtimeBytes;
assert(completeTransfer < 15 * MiB, 'complete deferred experience exceeds 15 MiB');

console.log(JSON.stringify({
  wideMiB: +(size('ferrari-laferrari-wide.v1.glb') / MiB).toFixed(2),
  fullMiB: +(size('ferrari-laferrari-full.v1.glb') / MiB).toFixed(2),
  studioMiB: +(studioBytes / MiB).toFixed(2),
  critical3DMiB: +(criticalBytes / MiB).toFixed(2),
  criticalTransferMiB: +(criticalTransfer / MiB).toFixed(2),
  completeTransferMiB: +(completeTransfer / MiB).toFixed(2)
}, null, 2));
