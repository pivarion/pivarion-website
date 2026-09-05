/* One source-derived logo mesh for the opening, rooms, and product objects.
   PIVARION.JPG remains the authoritative artwork; the new six-view image only
   informs depth and surface treatment. The outline is sampled from that JPG,
   not recreated from idealized square/octagon proportions. */
(function () {
  'use strict';
  var source = window.PIVARION_MARK_SOURCE;
  if (!source || !window.THREE) return;
  var b = source.bounds;
  var cx = b[0] + (b[2] - 1) / 2, cy = b[1] + (b[3] - 1) / 2;
  var unit = 1.76 / Math.max(b[2] - 1, b[3] - 1);

  function path(points, shape) {
    var p = shape ? new THREE.Shape() : new THREE.Path();
    points.forEach(function (v, i) {
      p[i ? 'lineTo' : 'moveTo']((v[0] - cx) * unit, (cy - v[1]) * unit);
    });
    p.closePath();
    return p;
  }

  window.PivarionMark = {
    geometry: function (depth) {
      var shapes = source.components.map(function (component) {
        var shape = path(component.outer, true);
        shape.holes = component.holes.map(function (hole) { return path(hole, false); });
        return shape;
      });
      // Sharp extrusions keep the small gaps open and the frontal contour
      // faithful. The previous large bevel substantially changed the mark.
      var geometry = new THREE.ExtrudeGeometry(shapes, {
        depth: depth, steps: 1, bevelEnabled: false, curveSegments: 1
      });
      geometry.translate(0, 0, -depth / 2);
      geometry.computeVertexNormals();
      return geometry;
    },
    materials: function () {
      return [
        new THREE.MeshPhysicalMaterial({
          color: 0xe7e9ed, metalness: 0.52, roughness: 0.28,
          clearcoat: 0.25, clearcoatRoughness: 0.32, envMapIntensity: 1.1
        }),
        new THREE.MeshStandardMaterial({
          color: 0x4c525b, metalness: 0.72, roughness: 0.34, envMapIntensity: 0.85
        })
      ];
    }
  };
})();
