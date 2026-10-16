import * as THREE from 'three';

// Flat-shaded matte materials give the toy-like low-poly look. Shared per colour to save memory.
const MATERIAL_CACHE = new Map();

export function lambert(color, options = {}) {
  const key = `${color}|${JSON.stringify(options)}`;
  if (!MATERIAL_CACHE.has(key)) {
    MATERIAL_CACHE.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...options }));
  }
  return MATERIAL_CACHE.get(key);
}

// Bake several meshes that share a material into one geometry (positions and normals only;
// the flat matte materials need nothing else). `matrixOf(mesh)` gives each mesh's transform
// into the new mesh's space. Fewer draw calls is what keeps busy courses smooth on phones.
export function bakeGeometry(meshes, matrixOf) {
  const parts = meshes.map((m) => {
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(matrixOf(m));
    m.geometry.dispose();
    return g;
  });
  const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let at = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, at * 3);
    nor.set(g.attributes.normal.array, at * 3);
    at += g.attributes.position.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.computeBoundingSphere();
  return geo;
}
