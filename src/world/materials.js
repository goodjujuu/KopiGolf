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
