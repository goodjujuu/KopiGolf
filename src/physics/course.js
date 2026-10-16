import { SURFACE } from '../config.js';
import { holeLength, holeAimYaw } from '../courses/catalog.js';
import { BIOMES } from '../courses/biomes.js';
import { nearestOnPath, inEllipse, seaDistance } from '../courses/generate.js';
import { terrainHeight } from './terrain.js';
import { pitchOf, FAIRWAY_SURFACES } from '../courses/pitches.js';

// What the ball is sitting on, worked out from the same hole data that draws the 3D world.
// Two kinds of hole: the practice island (hole.island) and World Tour courses (hole.path).
//
// Surfaces: green, fairway, bunker, rough, snow, sand (beach / desert), water, oob (out of bounds)

export const SAND_RIM = 5; // width of the beach around the practice island, metres
export const GREEN_STRETCH = 1.4; // greens are ovals, wider across than along
const TEE_BOX = 7;

export function surfaceAt(hole, x, z) {
  const gx = (x - hole.pin[0]) / (hole.greenRadius * GREEN_STRETCH);
  const gz = (z - hole.pin[2]) / hole.greenRadius;
  if (gx * gx + gz * gz <= 1) return 'green';
  return hole.island ? islandSurface(hole, x, z) : courseSurface(hole, x, z);
}

function islandSurface(hole, x, z) {
  if (inStadium(hole, x, z)) return 'fairway';
  const [cx, , cz] = hole.island.center;
  const d = Math.hypot(x - cx, z - cz);
  if (d <= hole.island.radius) return 'rough';
  if (d <= hole.island.radius + SAND_RIM) return 'sand';
  return 'water';
}

function courseSurface(hole, x, z) {
  if (hole.bunkers.some((b) => inEllipse(b, x, z))) return 'bunker';
  if (hole.islandLand && inEllipse(hole.islandLand, x, z)) return 'fairway';
  if (hole.ponds.some((p) => inEllipse(p, x, z))) return 'water';
  if (hole.rivers?.some((r) => nearestOnPath(r.points, x, z).dist < r.width / 2)) return 'water';
  if (hole.sea) {
    const d = seaDistance(hole.sea, x, z);
    if (d > 0) return 'water';
    if (d > -hole.sea.beach) return 'sand';
  }
  if (Math.hypot(x - hole.bounds.x, z - hole.bounds.z) > hole.bounds.r) return 'oob';
  if (Math.hypot(x - hole.tee[0], z - hole.tee[2]) < TEE_BOX) return 'fairway';
  const pitch = pitchOf(hole);
  if (nearestOnPath(hole.fairway.points, x, z).dist <= hole.fairway.width / 2) return pitch.fairway.surface;
  return pitch.rough?.surface ?? BIOMES[hole.biome]?.roughSurface ?? 'rough';
}

export function groundHeight(hole, x, z, surface = surfaceAt(hole, x, z)) {
  if (surface !== 'fairway' && FAIRWAY_SURFACES.has(surface)) return SURFACE.fairway;
  switch (surface) {
    case 'green': return SURFACE.green;
    case 'fairway': return SURFACE.fairway;
    case 'bunker': return SURFACE.bunker;
    case 'water': return -0.6;
    case 'sand':
      if (hole.island) return -0.25;
      if (hole.sea && seaDistance(hole.sea, x, z) > -hole.sea.beach) return beachHeight(hole, x, z);
      return terrainHeight(x, z, hole.hills);
    default: return SURFACE.rough + terrainHeight(x, z, hole.hills);
  }
}

// The beach slopes from grass height down to just under the water line.
export function beachHeight(hole, x, z) {
  const d = seaDistance(hole.sea, x, z); // −beach … 0
  const t = Math.min(1, Math.max(0, (d + hole.sea.beach) / hole.sea.beach));
  return -0.85 * t;
}

// The practice island's fairway is a single stadium from behind the tee to past the pin.
function inStadium(hole, x, z) {
  const yaw = holeAimYaw(hole);
  const mx = (hole.tee[0] + hole.pin[0]) / 2;
  const mz = (hole.tee[2] + hole.pin[2]) / 2;
  const u = (x - mx) * Math.cos(yaw) + (z - mz) * -Math.sin(yaw);
  const v = (x - mx) * -Math.sin(yaw) + (z - mz) * -Math.cos(yaw);
  const r = hole.fairwayWidth / 2;
  const h = (holeLength(hole) + 12) / 2 - r;
  if (Math.abs(u) > r) return false;
  if (Math.abs(v) <= h) return true;
  return Math.hypot(u, Math.abs(v) - h) <= r;
}
