// Geometry verification without a browser/GPU. Omit texture references only in
// the in-memory test input; the actual asset and production loader are unchanged.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
global.window = global;
global.THREE = require(path.join(root, 'lib/three.min.js'));
vm.runInThisContext(fs.readFileSync(path.join(root, 'lib/GLTFLoader.js'), 'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(root, 'js/vehicle.js'), 'utf8'));
const bytes = fs.readFileSync(path.join(root, 'assets/models/ferrari-laferrari.glb'));
const jsonLength = bytes.readUInt32LE(12);
const doc = JSON.parse(bytes.subarray(20,20+jsonLength));
function stripTextureRefs(value) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (/Texture$/.test(key)) delete value[key];
    else stripTextureRefs(value[key]);
  }
}
stripTextureRefs(doc.materials);
doc.images = []; doc.textures = [];
let json = Buffer.from(JSON.stringify(doc));
json = Buffer.concat([json, Buffer.alloc((4-json.length%4)%4,32)]);
const binChunk = bytes.subarray(20+jsonLength);
const patched = Buffer.alloc(20+json.length+binChunk.length);
patched.writeUInt32LE(0x46546c67,0); patched.writeUInt32LE(2,4);
patched.writeUInt32LE(patched.length,8); patched.writeUInt32LE(json.length,12);
patched.writeUInt32LE(0x4e4f534a,16); json.copy(patched,20); binChunk.copy(patched,20+json.length);

new THREE.GLTFLoader().parse(patched.buffer.slice(patched.byteOffset, patched.byteOffset+patched.byteLength),'', gltf => {
  const result = PivarionVehicle.adapt(gltf);
  const group = result.group;
  let triangles=0, meshes=0;
  group.traverse(o => {
    if (!o.isMesh) return;
    meshes++;
    const geom=o.geometry, p=geom.attributes.position;
    assert(p && geom.attributes.normal);
    for (const number of p.array) assert(Number.isFinite(number));
    if (geom.index) for (const index of geom.index.array) assert(index < p.count);
    triangles += (geom.index ? geom.index.count : p.count)/3;
  });
  assert.equal(result.wheels.length,4);
  const body=group.children.find(x=>x.isMesh && x.material.name==='Body').material;
  assert.equal(body.color.clone().convertLinearToSRGB().getHex(),0x0c0d10,'black paint swatch mismatch');
  for (const wheel of result.wheels) {
    assert(wheel.userData.turn.children.some(x=>/^rim\./.test(x.material.name)),'rim missing');
    assert(wheel.userData.turn.children.some(x=>/^tread\./.test(x.material.name)),'tire missing');
    assert(wheel.children.some(x=>x.isMesh && /^Material\.14[4-7]$/.test(x.material.name)),'stationary caliper missing');
  }
  group.updateMatrixWorld(true);
  // Inspect only drawn vertices (split meshes share original attribute buffers).
  function drawnBounds(object) {
    const box=new THREE.Box3(),point=new THREE.Vector3();
    object.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position;
      for(let i=0;i<(g.index?g.index.count:p.count);i++) {
        point.fromBufferAttribute(p,g.index?g.index.getX(i):i).applyMatrix4(o.matrixWorld);box.expandByPoint(point);
      }
    });return box;
  }
  const box=drawnBounds(group),size=box.getSize(new THREE.Vector3());
  assert(size.x>4.4 && size.x<4.8,'unexpected car length');
  assert(size.y>1.05 && size.y<1.3,'unexpected car height');
  assert(size.z>1.8 && size.z<2.2,'unexpected car width');
  assert(Math.abs(box.min.y)<.001,'tires not on ground');
  const caliper = result.wheels[0].children.find(x=>x.isMesh && /^Material\.14[4-7]$/.test(x.material.name));
  const before=caliper.matrixWorld.clone();
  for(const wheel of result.wheels) wheel.userData.turn.rotation.z-=1/wheel.userData.radius;
  group.updateMatrixWorld(true);
  assert(before.equals(caliper.matrixWorld),'caliper rotated with wheel');
  result.setHeat(.5);result.setBrake(1);
  console.log(JSON.stringify({meshes,triangles,bounds:box,size,wheelCenters:result.wheels.map(w=>w.position.toArray()),wheelRadii:result.wheels.map(w=>w.userData.radius),stationaryCalipers:true,fourRotatingWheels:true},null,2));
}, e=>{console.error(e);process.exitCode=1;});
