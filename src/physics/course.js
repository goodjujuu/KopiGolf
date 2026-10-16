import { SURFACE } from '../config.js';
import { holeLength, holeAimYaw } from '../courses/catalog.js';
import { terrainHeight } from './terrain.js';

// What the ball is sitting on, worked out from the same hole data that draws the 3D world.

export const SAND_RIM = 5; // width of the beach around the island, metres
export const GREEN_STRETCH = 1.4; // greens are ovals, wider across than along

export function surfaceAt(hole, x, z) {
  const gx = (x - hole.pin[0]) / (hole.greenRadius * GREEN_STRETCH);
  const gz = (z - hole.pin[2]) / hole.greenRadius;
  if (gx * gx + gz * gz <= 1) return 'green';
  if (inFairway(hole, x, z)) return 'fairway';
  const [cx, , cz] = hole.island.center;
  const d = Math.hypot(x - cx, z - cz);
  if (d <= hole.island.radius) return 'rough';
  if (d <= hole.island.radius + SAND_RIM) return 'sand';
  return 'water';
}

export function groundHeight(hole, x, z, surface = surfaceAt(hole, x, z)) {
  switch (surface) {
    case 'green': return SURFACE.green;
    case 'fairway': return SURFACE.fairway;
    case 'sand': return -0.25;
    case 'water': return -0.6;
    default: return SURFACE.rough + terrainHeight(x, z, hole.hills);
  }
}

// The fairway is a stadium (rectangle with round ends) from behind the tee to past the pin.
function inFairway(hole, x, z) {
  const yaw = holeAimYaw(hole);
  const mx = (hole.tee[0] + hole.pin[0]) / 2;
  const mz = (hole.tee[2] + hole.pin[2]) / 2;
  const u = (x - mx) * Math.cos(yaw) + (z - mz) * -Math.sin(yaw); // across the hole
  const v = (x - mx) * -Math.sin(yaw) + (z - mz) * -Math.cos(yaw); // along the hole
  const r = hole.fairwayWidth / 2;
  const h = (holeLength(hole) + 12) / 2 - r;
  if (Math.abs(u) > r) return false;
  if (Math.abs(v) <= h) return true;
  return Math.hypot(u, Math.abs(v) - h) <= r;
}
