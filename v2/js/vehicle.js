/* 2013 Ferrari LaFerrari by XENVOR creations, CC BY 4.0.
   See ../credits.html. The downloaded GLB is unchanged; this adapter levels
   its export transform, sets a 2.65 m wheelbase, and rigs the original wheels. */
(function () {
  'use strict';
  if (!window.THREE || !THREE.GLTFLoader) return;
  function swatch(color, hex) {
    color.setHex(hex);
    if (!THREE.ColorManagement.enabled) color.convertSRGBToLinear();
  }
  function adapt(gltf) {
    var car = new THREE.Group(); car.name = 'Ferrari LaFerrari — Nero';
    gltf.scene.updateMatrixWorld(true);
    // Remove the source viewer's small roll/pitch. Keep every nested FBX
    // transform, including the four independently positioned wheel assemblies.
    var root = gltf.scene.getObjectByName('Sketchfab_model');
    var scale = new THREE.Vector3().setFromMatrixScale(root.matrixWorld).x;
    var level = new THREE.Matrix4().set(
      scale,0,0,0, 0,0,scale,0, 0,-scale,0,0, 0,0,0,1);
    var alignment = new THREE.Matrix4().makeRotationY(-Math.PI/2)
      .multiply(level).multiply(root.matrixWorld.clone().invert());
    var parts=[], tires=[], rims=[], materials=new Map(), discs=[], tails=[];
    function material(original) {
      if (materials.has(original)) return materials.get(original);
      var m=original.clone(), name=m.name;
      m.envMapIntensity=1.15;
      // Avoid the source's transmission pass for tinted automotive glass.
      if ('transmission' in m) m.transmission=0;
      if (name==='Body') {
        swatch(m.color,0x0c0d10); m.metalness=.32; m.roughness=.24;
        m.clearcoat=1; m.clearcoatRoughness=.14; m.envMapIntensity=1.7;
      } else if (name==='Carbon_fiber') {
        m.metalness=.18; m.roughness=.46; m.clearcoat=.5; m.clearcoatRoughness=.25;
      } else if (/^tread\./.test(name)) {
        swatch(m.color,0x202124); m.metalness=0; m.roughness=.9;
      } else if (/^rim\./.test(name)) {
        swatch(m.color,0x94989d); m.metalness=.88; m.roughness=.27; m.envMapIntensity=1.1;
      } else if (/^disc\./.test(name)) {
        m.metalness=.65; m.roughness=.57;
        swatch(m.emissive,0xad2708); m.emissiveIntensity=0; discs.push(m);
      } else if (/^Material\.14[4-7]$/.test(name)) {
        swatch(m.color,0xe8ac12); m.metalness=.22; m.roughness=.39;
      } else if (/^(Glasses|Engine_glass)$/.test(name)) {
        swatch(m.color,0x55636a); m.transparent=true; m.opacity=.32;
        m.metalness=.12; m.roughness=.08; m.depthWrite=false;
      } else if (/glasses/.test(name)) {
        m.transparent=true; m.opacity=.18; m.roughness=.10; m.depthWrite=false;
      } else if (/^(tail_lights|break_lights\.001|red_light)$/.test(name)) {
        swatch(m.color,0x750905); swatch(m.emissive,0xf31308);
        m.emissiveIntensity=.65; tails.push(m);
      } else if (name==='Front_headlights.001') {
        swatch(m.emissive,0xf4f7fa); m.emissiveIntensity=1.1;
      } else if (/^(black|Under|under_carreage|Interior|Viper)/i.test(name)) {
        swatch(m.color,0x16171a); m.metalness=.05; m.roughness=.65;
      }
      materials.set(original,m); return m;
    }
    gltf.scene.traverse(function(source) {
      if (!source.isMesh) return;
      var geometry=source.geometry.clone().applyMatrix4(
        new THREE.Matrix4().multiplyMatrices(alignment,source.matrixWorld));
      geometry.computeBoundingBox();
      var match=/^tire_([1-4])_/.exec(source.name), wheel=match?Number(match[1])-1:-1;
      var part={geometry:geometry,material:material(source.material),name:source.name,wheel:wheel};
      parts.push(part);
      if (/^tread\./.test(source.material.name)) tires[wheel]=part;
      if (/^rim\./.test(source.material.name)) rims[wheel]=part;
    });
    var center=function(part){return part.geometry.boundingBox.getCenter(new THREE.Vector3());};
    var front=center(tires[0]), rear=center(tires[2]);
    var meters=2.65/Math.abs(front.x-rear.x);
    var midX=(front.x+rear.x)/2, midZ=(center(tires[0]).z+center(tires[1]).z)/2;
    var ground=Math.min.apply(null,tires.map(function(p){return p.geometry.boundingBox.min.y;}));
    var normalize=new THREE.Matrix4().makeScale(meters,meters,meters)
      .multiply(new THREE.Matrix4().makeTranslation(-midX,-ground,-midZ));
    parts.forEach(function(p){p.geometry.applyMatrix4(normalize);p.geometry.computeBoundingBox();});
    var wheels=tires.map(function(tire,i) {
      var pivot=center(rims[i]), tireCenter=center(tire);
      pivot.z=tireCenter.z;
      var holder=new THREE.Group(),turn=new THREE.Group();
      holder.name='Wheel assembly '+(i+1); holder.position.copy(pivot); holder.add(turn);
      holder.userData.turn=turn;
      holder.userData.radius=tire.geometry.boundingBox.getSize(new THREE.Vector3()).y/2;
      car.add(holder); return holder;
    });
    parts.forEach(function(p) {
      var mesh=new THREE.Mesh(p.geometry,p.material); mesh.name=p.name;
      mesh.castShadow=true; mesh.receiveShadow=true;
      var fixed=/^BrakeRearLeft/.test(p.name);
      if (fixed) {
        var c=center(p),best=Infinity;
        wheels.forEach(function(w,i){var d=(w.position.x-c.x)**2+(w.position.z-c.z)**2;
          if(d<best){best=d;p.wheel=i;}});
      }
      if(p.wheel>=0) {
        mesh.position.copy(wheels[p.wheel].position).multiplyScalar(-1);
        (fixed?wheels[p.wheel]:wheels[p.wheel].userData.turn).add(mesh);
      } else car.add(mesh);
    });
    return {
      group:car,wheels:wheels,
      setHeat:function(heat){discs.forEach(function(m){m.emissiveIntensity=heat*.08;});},
      setBrake:function(brake){tails.forEach(function(m){m.emissiveIntensity=.65+brake*1.4;});}
    };
  }
  window.PivarionVehicle={adapt:adapt,load:async function(assetRoot,onProgress){
    return adapt(await new THREE.GLTFLoader().loadAsync(assetRoot+'models/ferrari-laferrari.glb',onProgress));
  }};
})();
