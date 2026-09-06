// Runtime geometry verification for the compressed close-detail Ferrari.
// Texture references are removed only from this in-memory test copy because
// Node has no browser image decoder; the production GLB remains untouched.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { MeshoptDecoder } = require('meshoptimizer');

const root = path.resolve(__dirname, '..');
global.window = global;
global.THREE = require(path.join(root, 'lib/three.min.js'));
global.MeshoptDecoder = MeshoptDecoder;
vm.runInThisContext(fs.readFileSync(path.join(root, 'lib/GLTFLoader.js'), 'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(root, 'js/vehicle.js'), 'utf8'));

function texturelessGLB(source) {
  const bytes = fs.readFileSync(source);
  const jsonLength = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  function stripTextureRefs(value) {
    if (!value || typeof value !== 'object') return;
    for (const key of Object.keys(value)) {
      if (/Texture$/.test(key)) delete value[key];
      else stripTextureRefs(value[key]);
    }
  }
  stripTextureRefs(doc.materials);
  doc.images = []; doc.textures = []; doc.samplers = [];
  for (const key of ['extensionsUsed', 'extensionsRequired']) {
    if (doc[key]) doc[key] = doc[key].filter(name => name !== 'EXT_texture_webp');
  }
  let json = Buffer.from(JSON.stringify(doc));
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const binChunk = bytes.subarray(20 + jsonLength);
  const patched = Buffer.alloc(20 + json.length + binChunk.length);
  patched.writeUInt32LE(0x46546c67, 0); patched.writeUInt32LE(2, 4);
  patched.writeUInt32LE(patched.length, 8); patched.writeUInt32LE(json.length, 12);
  patched.writeUInt32LE(0x4e4f534a, 16); json.copy(patched, 20); binChunk.copy(patched, 20 + json.length);
  return patched;
}

(async () => {
  await MeshoptDecoder.ready;
  const patched = texturelessGLB(path.join(root, 'assets/optimized/ferrari-laferrari-full.v1.glb'));
  const gltf = await new Promise((resolve, reject) => {
    new THREE.GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(
      patched.buffer.slice(patched.byteOffset, patched.byteOffset + patched.byteLength), '', resolve, reject);
  });
  const result = PivarionVehicle.adapt(gltf);
  const group = result.group;
  let triangles = 0, meshes = 0;
  group.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    const geometry = object.geometry, position = geometry.attributes.position;
    assert(position && geometry.attributes.normal);
    for (const number of position.array) assert(Number.isFinite(number));
    if (geometry.index) for (const index of geometry.index.array) assert(index < position.count);
    triangles += (geometry.index ? geometry.index.count : position.count) / 3;
  });
  assert.equal(result.wheels.length, 4);
  assert(triangles > 580000, 'full-detail triangle count unexpectedly reduced');
  const body = group.children.find(x => x.isMesh && x.material.name === 'Body').material;
  assert.equal(body.color.clone().convertLinearToSRGB().getHex(), 0x0c0d10, 'black paint swatch mismatch');
  for (const wheel of result.wheels) {
    assert(wheel.userData.turn.children.some(x => /^rim\./.test(x.material.name)), 'rim missing');
    assert(wheel.userData.turn.children.some(x => /^tread\./.test(x.material.name)), 'tire missing');
    assert(wheel.children.some(x => x.isMesh && /^Material\.14[4-7]$/.test(x.material.name)), 'caliper missing');
  }
  group.updateMatrixWorld(true);
  function drawnBounds(object) {
    const box = new THREE.Box3(), point = new THREE.Vector3();
    object.traverse(node => {
      if (!node.isMesh) return;
      const geometry = node.geometry, position = geometry.attributes.position;
      for (let i = 0; i < (geometry.index ? geometry.index.count : position.count); i++) {
        point.fromBufferAttribute(position, geometry.index ? geometry.index.getX(i) : i)
          .applyMatrix4(node.matrixWorld);
        box.expandByPoint(point);
      }
    });
    return box;
  }
  const box = drawnBounds(group), size = box.getSize(new THREE.Vector3());
  assert(size.x > 4.4 && size.x < 4.8, 'unexpected car length');
  assert(size.y > 1.05 && size.y < 1.3, 'unexpected car height');
  assert(size.z > 1.8 && size.z < 2.2, 'unexpected car width');
  assert(Math.abs(box.min.y) < .001, 'tires not on ground');
  const caliper = result.wheels[0].children.find(x => x.isMesh && /^Material\.14[4-7]$/.test(x.material.name));
  const before = caliper.matrixWorld.clone();
  for (const wheel of result.wheels) wheel.userData.turn.rotation.z -= 1 / wheel.userData.radius;
  group.updateMatrixWorld(true);
  assert(before.equals(caliper.matrixWorld), 'caliper rotated with wheel');
  result.setHeat(.5); result.setBrake(1);
  console.log(JSON.stringify({ meshes, triangles, size, stationaryCalipers:true, fourRotatingWheels:true }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
