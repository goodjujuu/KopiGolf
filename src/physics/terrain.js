// Shape of the grassy mounds. Shared by the 3D builder (to draw them), the physics (to roll
// over them) and the overhead map. No Three.js here so it can be unit-tested.

export const HILL_SPREAD = 1.6; // mounds are squashed spheres, wider than tall
export const HILL_SINK = 0.45;  // fraction of the radius buried below ground

export function terrainHeight(x, z, hills) {
  let y = 0;
  for (const [hx, hz, r] of hills) {
    const dx = (x - hx) / (r * HILL_SPREAD);
    const dz = (z - hz) / (r * HILL_SPREAD);
    const d2 = dx * dx + dz * dz;
    if (d2 < 1) y = Math.max(y, r * Math.sqrt(1 - d2) - r * HILL_SINK);
  }
  return y;
}

// Visible radius of a mound where it meets the ground.
export function hillFootprint(r) {
  return r * HILL_SPREAD * Math.sqrt(1 - HILL_SINK * HILL_SINK);
}
