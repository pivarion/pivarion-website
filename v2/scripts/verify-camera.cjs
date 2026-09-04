const assert = require('node:assert/strict');
const motion = require('../js/cinematic-track.js');
const THREE = require('../lib/three.min.js');

const dt = 1e-6;
const velocity = t => (motion.carAt(t+dt)-motion.carAt(t-dt))/(2*dt);
let previous = motion.carAt(0);
for (let i=1;i<=10000;i++) {
  const t=i/10000,shot=motion.sample(t);
  assert(shot.carX >= previous-1e-9,'car reversed'); previous=shot.carX;
  assert([...shot.p,...shot.l,shot.f].every(Number.isFinite));
  assert(shot.f >= 28 && shot.f <= 40.01);
}
for (let t=.09;t<.339;t+=.005) assert(velocity(t)>50,'unintended cruise stop');
let previousVelocity=velocity(.34);
for (let t=.341;t<.53;t+=.001) {
  const v=velocity(t);assert(v <= previousVelocity+.001,'car accelerates during braking');
  previousVelocity=v;
}
assert.equal(motion.carAt(.53),15.6);
assert.equal(motion.carAt(.70),15.6);
for (const t of [.34,.53]) assert(Math.abs(velocity(t-dt)-velocity(t+dt))<.01,'speed discontinuity');

// No positional or velocity jump where keyframes or rig blends meet.
let maximumVelocityJump=0;
for(const t of [.045,.07,.085,.105,.165,.175,.3,.405,.495,.575,.645,.69,.705,.712,.742,.775,.818,.856,.9,.95]) {
  const a=motion.sample(t-dt),b=motion.sample(t),c=motion.sample(t+dt);
  for(const key of ['p','l']) for(let axis=0;axis<3;axis++) {
    const jump=Math.abs((c[key][axis]-b[key][axis])/dt-(b[key][axis]-a[key][axis])/dt);
    maximumVelocityJump=Math.max(jump,maximumVelocityJump);
    assert(jump<.12,'camera velocity discontinuity at '+t);
  }
}

// The whole car stays within the horizontal frame while being followed,
// including a portrait viewport. Macro shots intentionally crop into detail.
let maximumHorizontalExtent=0;
for(const aspect of [16/9,499/837,390/844]) {
  for(let t=.165;t<=.405;t+=.002) {
    const shot=motion.sample(t,aspect);
    const camera=new THREE.PerspectiveCamera(shot.f,aspect,.02,400);
    camera.position.fromArray(shot.p);camera.lookAt(...shot.l);camera.updateMatrixWorld();
    for(const x of [-2.3075,2.2742]) for(const y of [0,1.3645]) for(const z of [-1.019,1.014]) {
      const v=new THREE.Vector3(x+shot.carX,y,z).project(camera);
      maximumHorizontalExtent=Math.max(maximumHorizontalExtent,Math.abs(v.x));
      assert(Math.abs(v.x)<1.04,'car exits portrait frame at '+t+' aspect '+aspect);
    }
  }
}
console.log(JSON.stringify({continuousMotion:true,oneDeceleration:true,
  maximumVelocityJump,maximumHorizontalExtent,portraitAndLandscapeFraming:true},null,2));
