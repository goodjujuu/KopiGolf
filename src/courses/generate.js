import { BIOMES, BUILDING_STYLES } from './biomes.js';

// Turns a short course spec (city, par, length, shape, hazards, landmarks) into a full hole:
// fairway, green, bunkers, water, hills, trees, props, skyline. A seeded random generator
// (seeded from the spec id) means the same spec always produces exactly the same hole.
//
// Coordinates are metres. The tee is at the origin and play starts toward −z.
// Ellipse hazards are { x, z, rx, rz, yaw }: rx across the hole, rz along it, yaw like aim yaw.

const YARDS_PER_METRE = 1.09361;
const DEG = Math.PI / 180;

// ---------- seeded random ----------
function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
export function seededRandom(seedText) {
  let a = hashString(seedText);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- path helpers ----------
const forward = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
const rightOf = (yaw) => [Math.cos(yaw), -Math.sin(yaw)];
const yawOf = (dx, dz) => Math.atan2(-dx, -dz);

export function pathLength(points) {
  let s = 0;
  for (let i = 1; i < points.length; i++) s += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return s;
}

// Point, heading (yaw) and right-hand vector at distance s along the path. Past the end it
// carries straight on along the last segment.
export function pathAt(points, s) {
  let rest = s;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (rest <= len || i === points.length - 1) {
      const t = rest / len;
      const yaw = yawOf(bx - ax, bz - az);
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, yaw, right: rightOf(yaw) };
    }
    rest -= len;
  }
  const [x, z] = points[0];
  return { x, z, yaw: 0, right: [1, 0] };
}

// Shortest distance from (x, z) to the polyline, and how far along it that nearest point is.
export function nearestOnPath(points, x, z) {
  let best = { dist: Infinity, s: 0 };
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.dist) best = { dist: d, s: walked + t * Math.sqrt(len2) };
    walked += Math.sqrt(len2);
  }
  return best;
}

export function inEllipse(e, x, z) {
  const dx = x - e.x;
  const dz = z - e.z;
  const [fx, fz] = forward(e.yaw);
  const [rx, rz] = rightOf(e.yaw);
  const across = (dx * rx + dz * rz) / e.rx;
  const along = (dx * fx + dz * fz) / e.rz;
  return across * across + along * along <= 1;
}

// Signed distance past the coastline (positive = out at sea).
export function seaDistance(sea, x, z) {
  return (x - sea.x) * sea.nx + (z - sea.z) * sea.nz;
}

// ---------- the generator ----------
export function generateHole(spec, number) {
  const rng = seededRandom(spec.id);
  const R = (a, b) => a + (b - a) * rng();
  const biome = BIOMES[spec.biome];
  const length = spec.yards / YARDS_PER_METRE;
  const turnSign = spec.shape === 'left' ? -1 : spec.shape === 'right' ? 1 : rng() < 0.5 ? -1 : 1;

  // Centreline from tee to pin.
  const path = [[0, 0]];
  let pos = [0, 0];
  let yaw = 0;
  const legs = spec.par === 3 ? [1]
    : spec.par === 4 ? (spec.shape === 'straight' ? [1] : [R(0.55, 0.62), 1])
    : spec.shape === 'straight' ? [R(0.45, 0.55), 1] : [R(0.38, 0.45), R(0.7, 0.76), 1];
  let travelled = 0;
  legs.forEach((until, i) => {
    const legLen = length * until - travelled;
    if (i > 0) {
      // Turn at each corner: same way for a dogleg, alternating for an S-bend.
      const dir = spec.shape === 's' && i === 2 ? -turnSign : turnSign;
      const angle = spec.shape === 'straight' ? R(-6, 6) : R(22, 36);
      yaw -= dir * angle * DEG; // negative yaw turns right
    } else {
      yaw = R(-4, 4) * DEG;
    }
    const [fx, fz] = forward(yaw);
    pos = [pos[0] + fx * legLen, pos[1] + fz * legLen];
    path.push(pos);
    travelled += legLen;
  });
  const total = pathLength(path);
  const pinPt = path[path.length - 1];
  const endYaw = pathAt(path, total).yaw;
  const axisYaw = yawOf(pinPt[0], pinPt[1]);

  const width = spec.par === 3 ? R(24, 28) : R(30, 38);
  const greenRadius = R(12, 15);
  const fairwayStart = spec.par === 3 ? total * 0.55 : 28;
  const fairwayPoints = [];
  for (let s = fairwayStart; s < total - 3; s += 12) {
    const p = pathAt(path, s);
    fairwayPoints.push([p.x, p.z]);
  }
  fairwayPoints.push([pinPt[0], pinPt[1]]);
  // Simplify: keep corners only (fairway is drawn as connected stadium segments).
  const fairway = { points: simplify(fairwayPoints), width };

  // ---------- water ----------
  const ponds = [];
  let sea = null;
  const water = spec.water ?? 'none';
  if (water === 'front') {
    const p = pathAt(path, total - greenRadius - R(20, 28));
    ponds.push({ x: p.x, z: p.z, rx: width * R(0.6, 0.8), rz: R(9, 13), yaw: p.yaw });
  } else if (water === 'side') {
    const p = pathAt(path, total * R(0.6, 0.7));
    const side = -turnSign;
    ponds.push({ x: p.x + p.right[0] * side * (width / 2 + 38), z: p.z + p.right[1] * side * (width / 2 + 38), rx: R(28, 38), rz: R(60, 85), yaw: p.yaw });
  } else if (water === 'creek') {
    const p = pathAt(path, total * R(0.42, 0.5));
    ponds.push({ x: p.x, z: p.z, rx: width + 90, rz: R(5, 7), yaw: p.yaw });
  } else if (water === 'sea-left' || water === 'sea-right') {
    const side = water === 'sea-left' ? -1 : 1;
    // The coastline runs parallel to the tee–pin line, clear of the widest point of the hole.
    const [rx, rz] = rightOf(axisYaw);
    const off = width / 2 + R(55, 75) + maxLateral(path, axisYaw, side);
    sea = { x: rx * side * off, z: rz * side * off, nx: rx * side, nz: rz * side, beach: 30 };
  }

  // ---------- bunkers ----------
  const bunkers = [];
  const greenside = spec.par === 3 ? 3 : 2 + (rng() < 0.5 ? 1 : 0);
  const sides = [70, -70, 130, -130, 180, 35, -35];
  for (let i = 0; i < greenside; i++) {
    const a = endYaw + sides[(i + Math.floor(rng() * 3)) % sides.length] * DEG;
    const d = greenRadius * 1.2 + R(4, 7);
    const [fx, fz] = forward(a);
    bunkers.push({ x: pinPt[0] + fx * d, z: pinPt[1] + fz * d, rx: R(6, 9), rz: R(3.5, 5.5), yaw: a + Math.PI / 2 });
  }
  if (spec.par > 3) {
    const n = 1 + (rng() < 0.6 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const p = pathAt(path, R(200, 240) + i * 25);
      const side = i % 2 ? -turnSign : turnSign;
      const lat = side * (width / 2 + R(-2, 4));
      bunkers.push({ x: p.x + p.right[0] * lat, z: p.z + p.right[1] * lat, rx: R(5, 7), rz: R(9, 13), yaw: p.yaw });
    }
  }

  const hole = {
    id: spec.id, number, name: spec.name, city: spec.city, country: spec.country,
    par: spec.par, yards: spec.yards, theme: spec.biome, biome: spec.biome,
    tee: [0, 0, 0], pin: [pinPt[0], 0, pinPt[1]],
    path, fairway, greenRadius, bunkers, ponds, sea,
    bounds: { x: pathAt(path, total / 2).x, z: pathAt(path, total / 2).z, r: total / 2 + 170 },
    fogScale: 4.5,
  };

  // ---------- hills ----------
  hole.hills = [];
  const hillCount = spec.biome === 'desert' ? 22 : spec.biome === 'alpine' ? 18 : 14;
  for (let tries = 0; hole.hills.length < hillCount && tries < 400; tries++) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng()) * (hole.bounds.r + 250);
    const x = hole.bounds.x + Math.cos(a) * d;
    const z = hole.bounds.z + Math.sin(a) * d;
    const r = R(14, 38) * (spec.biome === 'desert' ? 1.3 : 1);
    if (!clearOfPlay(hole, x, z, width / 2 + r * 1.6 + 18)) continue;
    hole.hills.push([round(x), round(z), round(r)]);
  }

  // ---------- trees ----------
  const types = Object.entries(biome.trees);
  const weightSum = types.reduce((a, [, w]) => a + w, 0);
  const pickType = () => {
    let r = rng() * weightSum;
    for (const [t, w] of types) { r -= w; if (r <= 0) return t; }
    return types[0][0];
  };
  hole.trees = [];
  const addTree = (x, z, scale) => {
    const type = pickType();
    hole.trees.push([type, round(x), round(z), round(scale, 100), Math.floor(rng() * 8), Math.floor(rng() * 360)]);
  };
  // Lines of trees down both sides of the hole.
  for (let s = -10; s < total + 30; s += R(9, 15)) {
    const p = pathAt(path, s);
    for (const side of [-1, 1]) {
      if (rng() < 0.25) continue;
      const lat = side * (width / 2 + R(10, 40));
      const x = p.x + p.right[0] * lat;
      const z = p.z + p.right[1] * lat;
      if (clearOfPlay(hole, x, z, width / 2 + 7) && Math.hypot(x, z) > 12) addTree(x, z, R(0.8, 1.35));
    }
  }
  // A backdrop of trees behind the green, and scattered groves further out.
  for (let i = 0; i < 26; i++) {
    const a = endYaw + R(-70, 70) * DEG;
    const d = greenRadius + R(28, 90);
    const [fx, fz] = forward(a);
    const x = pinPt[0] + fx * d;
    const z = pinPt[1] + fz * d;
    if (clearOfPlay(hole, x, z, 6)) addTree(x, z, R(0.9, 1.5));
  }
  for (let i = 0; i < 90; i++) {
    const a = rng() * Math.PI * 2;
    const d = R(60, hole.bounds.r + 200);
    const x = hole.bounds.x + Math.cos(a) * d;
    const z = hole.bounds.z + Math.sin(a) * d;
    if (clearOfPlay(hole, x, z, width / 2 + 25)) addTree(x, z, R(0.9, 1.6));
  }

  // ---------- props: cart path, benches, lamp posts ----------
  const pathSide = -turnSign;
  hole.cartPath = [];
  for (let s = -20; s <= total + 10; s += 20) {
    const p = pathAt(path, s);
    const lat = pathSide * (width / 2 + 9);
    hole.cartPath.push([round(p.x + p.right[0] * lat), round(p.z + p.right[1] * lat)]);
  }
  hole.props = [
    ['bench', round(pathSide * 16), 6, pathSide > 0 ? -90 : 90],
    ['lamp', round(pathSide * 13), 2, 0],
  ];
  if (spec.lamps !== false) {
    for (let s = 80; s < total; s += 85) {
      const p = pathAt(path, s);
      const lat = pathSide * (width / 2 + 13);
      hole.props.push(['lamp', round(p.x + p.right[0] * lat), round(p.z + p.right[1] * lat), 0]);
      if (rng() < 0.4) hole.props.push(['bench', round(p.x + p.right[0] * (lat + 3)), round(p.z + p.right[1] * (lat + 3)), Math.round(-p.yaw / DEG + (pathSide > 0 ? -90 : 90))]);
    }
  }

  // ---------- landmarks (placed relative to the path) ----------
  // { beyond: metres past the green } or { at: 0..1 of the way down the hole }, plus lat:
  // metres to the side (negative = left).
  hole.landmarks = (spec.landmarks ?? []).map((l) => {
    const s = l.beyond != null ? total + l.beyond : total * (l.at ?? 1);
    const extra = Math.max(0, s - total);
    const p = pathAt(path, Math.min(s, total));
    const [fx, fz] = forward(p.yaw);
    const lat = l.lat ?? 0;
    return {
      type: l.type, variant: l.variant, scale: l.scale ?? 1,
      x: round(p.x + fx * extra + p.right[0] * lat), z: round(p.z + fz * extra + p.right[1] * lat),
      yaw: round((l.yawDeg ?? 0) * DEG + p.yaw, 1000),
    };
  });

  // ---------- skyline ----------
  hole.buildings = [];
  const sky = spec.skyline;
  if (sky && sky.density > 0) {
    const palette = BUILDING_STYLES[sky.style ?? 'mixed'];
    const count = Math.round(28 * sky.density);
    for (let tries = 0; hole.buildings.length < count && tries < count * 6; tries++) {
      const a = axisYaw + R(-80, 80) * DEG;
      const d = R(sky.near ?? 430, sky.far ?? 950);
      const [fx, fz] = forward(a);
      const x = pinPt[0] + fx * d;
      const z = pinPt[1] + fz * d;
      if (hole.landmarks.some((l) => Math.hypot(l.x - x, l.z - z) < 110 * l.scale)) continue;
      if (sea && seaDistance(sea, x, z) > -10) continue;
      const tall = rng() < 0.15 ? 2.2 : 1;
      const h = R(22, 60) * (0.7 + sky.density * 0.35) * tall * (sky.height ?? 1);
      hole.buildings.push([round(x), round(z), round(R(16, 38)), round(R(16, 38)), round(h), Math.floor(rng() * palette.length), round(a, 100)]);
    }
    hole.buildingStyle = sky.style ?? 'mixed';
  }

  return hole;
}

// Is (x, z) out of the way of play: away from the fairway line, green, hazards, sea and tee?
function clearOfPlay(hole, x, z, minFromPath) {
  if (nearestOnPath(hole.path, x, z).dist < minFromPath) return false;
  if (Math.hypot(x - hole.pin[0], z - hole.pin[2]) < hole.greenRadius + 12) return false;
  if (hole.ponds.some((p) => inEllipse({ ...p, rx: p.rx + 6, rz: p.rz + 6 }, x, z))) return false;
  if (hole.bunkers.some((b) => inEllipse({ ...b, rx: b.rx + 4, rz: b.rz + 4 }, x, z))) return false;
  if (hole.sea && seaDistance(hole.sea, x, z) > -hole.sea.beach - 6) return false;
  return true;
}

function maxLateral(path, axisYaw, side) {
  const [rx, rz] = rightOf(axisYaw);
  return Math.max(0, ...path.map(([x, z]) => side * (x * rx + z * rz)));
}

// Keep the first and last points and any point where the direction changes.
function simplify(points) {
  if (points.length <= 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [ax, az] = out[out.length - 1];
    const [bx, bz] = points[i];
    const [cx, cz] = points[i + 1];
    const cross = (bx - ax) * (cz - bz) - (bz - az) * (cx - bx);
    if (Math.abs(cross) > 1) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out.map(([x, z]) => [round(x), round(z)]);
}

function round(v, k = 10) {
  return Math.round(v * k) / k;
}
