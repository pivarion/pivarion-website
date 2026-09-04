/* Porsche 911 GT3 RS (992) '23 by Mona x Supercars, CC BY 4.0.
   See ../credits.html for source and adaptations. The downloaded GLB remains
   unchanged. This adapter aligns it to the stage and separates its four wheels. */
(function () {
  'use strict';
  if (!window.THREE || !THREE.GLTFLoader) return;

  function nearestWheel(x, z, centers) {
    var best = 0, distance = Infinity;
    centers.forEach(function (c, i) {
      var d = (x - c[0]) ** 2 + (z - c[2]) ** 2;
      if (d < distance) { best = i; distance = d; }
    });
    return best;
  }

  function adapt(gltf, alignment) {
    var car = new THREE.Group();
    car.name = 'Porsche 911 GT3 RS';
    var centers = alignment.wheels, r = alignment.rotation;
    var s = alignment.scale, c = alignment.center;
    var matrix = new THREE.Matrix4().set(
      r[0][0]*s, r[0][1]*s, r[0][2]*s, -s*(r[0][0]*c[0]+r[0][1]*c[1]+r[0][2]*c[2]),
      r[1][0]*s, r[1][1]*s, r[1][2]*s, -s*(r[1][0]*c[0]+r[1][1]*c[1]+r[1][2]*c[2])-alignment.ground,
      r[2][0]*s, r[2][1]*s, r[2][2]*s, -s*(r[2][0]*c[0]+r[2][1]*c[1]+r[2][2]*c[2]),
      0, 0, 0, 1
    );
    var wheelHolders = centers.map(function (center, i) {
      var holder = new THREE.Group(), turn = new THREE.Group();
      holder.name = 'Wheel assembly ' + (i+1);
      holder.position.fromArray(center);
      holder.add(turn);
      holder.userData.turn = turn;
      holder.userData.radius = center[1];
      car.add(holder);
      return holder;
    });
    var materials = new Map(), discs = [], tails = [];

    // r150 runs with colour management disabled in this existing site.
    // Hex swatches are sRGB; glTF factors and shader inputs are linear.
    // Convert only our overrides, never the already-linear imported factors.
    function swatch(color, hex) {
      color.setHex(hex);
      if (!THREE.ColorManagement.enabled) color.convertSRGBToLinear();
    }

    function material(original) {
      if (materials.has(original)) return materials.get(original);
      var m = original.clone();
      m.envMapIntensity = 1.05;
      if (m.name === 'Paint11Mtl') {
        swatch(m.color,0xe2e5e6); m.metalness = 0.20; m.roughness = 0.32;
        m.metalnessMap = null; m.roughnessMap = null;
        m.clearcoat = 0.65; m.clearcoatRoughness = 0.24;
      } else if (m.name === 'Paint1Mtl') {
        swatch(m.color,0xb81910); m.metalness = 0.28; m.roughness = 0.38;
        // The source's near-zero roughness mask made the coating mirror-like.
        m.metalnessMap = null; m.roughnessMap = null; m.envMapIntensity = 0.65;
      } else if (m.name === 'PatternColor1Mtl') {
        swatch(m.color,0xb81910); m.metalness = 0.05; m.roughness = 0.43;
      } else if (m.name === 'Tire1Mtl') {
        swatch(m.color,0x252628); m.metalness = 0; m.roughness = 0.88;
        m.roughnessMap = null;
      } else if (m.name === 'Dashpadscreen1Mtl') {
        swatch(m.color,0x8c989d); m.opacity = 0.35; m.metalness = 0.12;
        m.roughness = 0.09; m.depthWrite = false;
      } else if (m.name === 'Caliperlf0021Mtl') {
        swatch(m.color,0xe8ae16); m.metalness = 0.20; m.roughness = 0.42;
      } else if (m.name === 'Wheel01lf0161Mtl') {
        m.metalness = 0.72; m.roughness = 0.54;
        m.emissive.setHex(0xd2380b); m.emissiveIntensity = 0;
        discs.push(m);
      } else if (m.name === 'Ln2Mtl') {
        m.emissive.setHex(0xfb1712); m.emissiveIntensity = 1.6;
        tails.push(m);
      }
      materials.set(original, m);
      return m;
    }

    gltf.scene.traverse(function (source) {
      if (!source.isMesh || source.material.opacity === 0) return;
      // The source's OBJ vertices are Z-up. All mesh-local transforms are
      // identity; apply our measured alignment instead of its root rotation.
      var geometry = source.geometry.clone().applyMatrix4(matrix);
      var m = material(source.material);
      var rotating = /^(Paint1Mtl|Tire1Mtl|Trim1Mtl|Wheel01lf0161Mtl)$/.test(m.name);
      var fixedWheel = /^(Caliperlf0011Mtl|Caliperlf0021Mtl)$/.test(m.name);
      if (!rotating && !fixedWheel) {
        var mesh = new THREE.Mesh(geometry, m);
        mesh.name = source.name; car.add(mesh);
        return;
      }
      var p = geometry.attributes.position, index = geometry.index;
      var count = index ? index.count : p.count;
      var buckets = [[], [], [], []];
      for (var i=0; i<count; i+=3) {
        var a=index?index.getX(i):i, b=index?index.getX(i+1):i+1, d=index?index.getX(i+2):i+2;
        var wheel = nearestWheel((p.getX(a)+p.getX(b)+p.getX(d))/3,
          (p.getZ(a)+p.getZ(b)+p.getZ(d))/3, centers);
        buckets[wheel].push(a,b,d);
      }
      buckets.forEach(function (indices, wheel) {
        if (!indices.length) return;
        var part = new THREE.BufferGeometry();
        Object.keys(geometry.attributes).forEach(function (key) {
          part.setAttribute(key, geometry.attributes[key]);
        });
        part.setIndex(indices);
        // Bounds must follow this wheel's indexed vertices, not the source
        // buffer containing all four wheels. This also keeps macro culling sane.
        part.boundingBox = new THREE.Box3();
        var point = new THREE.Vector3();
        indices.forEach(function (index) {
          point.fromBufferAttribute(p, index); part.boundingBox.expandByPoint(point);
        });
        part.boundingSphere = part.boundingBox.getBoundingSphere(new THREE.Sphere());
        var mesh = new THREE.Mesh(part, m);
        mesh.name = m.name + ' wheel ' + wheel;
        mesh.position.fromArray(centers[wheel]).multiplyScalar(-1);
        (rotating ? wheelHolders[wheel].userData.turn : wheelHolders[wheel]).add(mesh);
      });
    });
    return {
      group: car,
      wheels: wheelHolders,
      setHeat: function (heat) { discs.forEach(function (m) { m.emissiveIntensity = heat * 0.12; }); },
      setBrake: function (brake) { tails.forEach(function (m) { m.emissiveIntensity = 1.6 + brake * 2.4; }); }
    };
  }

  window.PivarionVehicle = {
    adapt: adapt,
    load: async function (assetRoot, onProgress) {
      var data = await Promise.all([
        new THREE.GLTFLoader().loadAsync(assetRoot + 'models/porsche-911-gt3-rs.glb', onProgress),
        fetch(assetRoot + 'models/normalization.json').then(function (response) {
          if (!response.ok) throw new Error('Vehicle alignment unavailable');
          return response.json();
        })
      ]);
      return adapt(data[0], data[1]);
    }
  };
})();
