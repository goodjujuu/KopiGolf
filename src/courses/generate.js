import { BIOMES, BUILDING_STYLES, BUILDING_KINDS, LOW_KINDS } from './biomes.js';
import { OBSTACLES, obstacleRadius } from './obstacles.js';

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
      const angle = spec.shape === 'straight' ? R(-6, 6) : spec.sharp ? R(42, 58) : R(24, 38);
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

  // Layout extras (see DESIGNS below): change the width, add hazards that shape the play.
  const design = new Set(spec.design ?? []);
  let width = spec.par === 3 ? R(24, 28) : R(30, 38);
  if (design.has('narrow')) width = spec.par === 3 ? R(19, 22) : R(22, 26);
  if (design.has('wide')) width = spec.par === 3 ? R(32, 36) : R(44, 52);
  const greenRadius = R(12, 15);
  const fairwayStart = spec.par === 3 ? total * 0.55 : 28;
  // Island greens: the fairway stops short of the water ringing the green.
  const fairwayEnd = spec.islandGreen ? total - greenRadius - 16 : total - 3;
  const fairwayPoints = [];
  for (let s = fairwayStart; s < fairwayEnd; s += 12) {
    const p = pathAt(path, s);
    fairwayPoints.push([p.x, p.z]);
  }
  if (!spec.islandGreen) fairwayPoints.push([pinPt[0], pinPt[1]]);
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
  }
  // Island green: a grassy island (green plus a collar, more of it behind the pin so a decent
  // shot that releases doesn't trickle off the back) ringed by water.
  let islandLand = null;
  if (spec.islandGreen) {
    const [fx, fz] = forward(endYaw);
    islandLand = { x: pinPt[0] + fx * 5, z: pinPt[1] + fz * 5, rx: greenRadius * 1.4 + 7, rz: greenRadius + 12, yaw: 0 };
    ponds.push({ x: islandLand.x, z: islandLand.z, rx: islandLand.rx + 12, rz: islandLand.rz + 13, yaw: 0 });
  }
  // Extra ponds beside the landing areas.
  for (let i = 0; i < (spec.ponds ?? 0); i++) {
    const p = pathAt(path, total * R(0.3, 0.8));
    const side = i % 2 ? turnSign : -turnSign;
    const lat = side * (width / 2 + R(14, 24));
    ponds.push({ x: p.x + p.right[0] * lat, z: p.z + p.right[1] * lat, rx: R(12, 20), rz: R(18, 32), yaw: p.yaw + R(-0.4, 0.4) });
  }
  if (water === 'sea-left' || water === 'sea-right') {
    const side = water === 'sea-left' ? -1 : 1;
    // The coastline runs parallel to the tee–pin line, clear of the widest point of the hole.
    const [rx, rz] = rightOf(axisYaw);
    const off = width / 2 + R(55, 75) + maxLateral(path, axisYaw, side);
    sea = { x: rx * side * off, z: rz * side * off, nx: rx * side, nz: rz * side, beach: 30 };
  }

  // ---------- rivers and canals (wavy bands of water crossing the hole) ----------
  const rivers = [];
  const crossings = spec.river === 'canals' ? [0.3, 0.66] : spec.river === 'cross' ? [R(0.36, 0.55)] : [];
  for (const at of crossings) {
    const c = pathAt(path, total * at);
    const yaw = c.yaw + (rng() < 0.5 ? -1 : 1) * R(55, 80) * DEG;
    const [fx, fz] = forward(yaw);
    const [rx, rz] = rightOf(yaw);
    const amp = spec.river === 'canals' ? 3 : R(10, 18);
    const points = [];
    for (let t = -700; t <= 700; t += 35) {
      const wobble = Math.sin(t / 110 + at * 9) * amp;
      points.push([round(c.x + fx * t + rx * wobble), round(c.z + fz * t + rz * wobble)]);
    }
    rivers.push({ points, width: spec.river === 'canals' ? R(9, 12) : R(13, 19) });
  }

  // ---------- bunkers ----------
  const bunkers = [];
  const greenside = spec.islandGreen ? 0 : spec.par === 3 ? 3 : 2 + (rng() < 0.5 ? 1 : 0);
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

  addDesignHazards({ design, spec, rng, R, path, total, width, greenRadius, endYaw, pinPt, ponds, bunkers, fairway, turnSign });

  const hole = {
    id: spec.id, number, name: spec.name, city: spec.city, country: spec.country,
    par: spec.par, yards: spec.yards, theme: spec.biome, biome: spec.biome, pitch: spec.pitch ?? 'grass', leaves: spec.leaves ?? null,
    tee: [0, 0, 0], pin: [pinPt[0], 0, pinPt[1]],
    path, fairway, greenRadius, bunkers, ponds, sea, rivers, islandLand,
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

  // Rolling mounds lining both sides of the fairway (just outside the rough's first cut).
  if (design.has('mounds')) {
    for (let s = 40; s < total - 20; s += R(26, 36)) {
      const p = pathAt(path, s);
      for (const side of [-1, 1]) {
        if (rng() < 0.2) continue;
        const r = R(5, 8);
        const lat = side * (width / 2 + 6 + r * 1.45 + R(0, 6));
        const x = p.x + p.right[0] * lat;
        const z = p.z + p.right[1] * lat;
        if (!clearOfPlay(hole, x, z, width / 2 + 5 + r * 1.43)) continue;
        hole.hills.push([round(x), round(z), round(r)]);
      }
    }
  }

  // ---------- city obstacles (things the ball can hit) ----------
  hole.obstacles = [];
  hole.colliders = [];
  placeObstacles(hole, spec, rng, R, total, width, endYaw);

  // ---------- trees ----------
  const types = Object.entries(spec.trees ?? biome.trees); // a city can bring its own trees
  const weightSum = types.reduce((a, [, w]) => a + w, 0);
  const pickType = () => {
    let r = rng() * weightSum;
    for (const [t, w] of types) { r -= w; if (r <= 0) return t; }
    return types[0][0];
  };
  hole.trees = [];
  const addTree = (x, z, scale) => {
    if (hole.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < 6 + obstacleRadius(o.type) * o.scale)) return;
    const type = pickType();
    hole.trees.push([type, round(x), round(z), round(scale, 100), Math.floor(rng() * 8), Math.floor(rng() * 360)]);
    const tc = TREE_COLLIDERS[type] ?? TREE_COLLIDERS.round;
    hole.colliders.push({ c: 'circle', x: round(x), z: round(z), r: round(tc.r * scale, 100), h: round(tc.h * scale), y0: 0, e: 0.25, label: 'tree' });
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

  // ---------- skyline (tall, far off) and neighbourhood (low, nearer) ----------
  hole.buildings = [];
  const sky = spec.skyline;
  const pickKind = (weights) => {
    const entries = Object.entries(weights);
    let r = rng() * entries.reduce((n, [, w]) => n + w, 0);
    for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
    return entries[0][0];
  };
  // Low buildings keep to their own heights, whatever the skyline does.
  const lowHeight = (kind) => ({ gable: R(9, 18), flat: R(6, 11), pagoda: R(16, 28), dome: R(10, 18) })[kind] ?? R(10, 20);
  const placeBuilding = (x, z, kind, h, style, a, size = [16, 38]) => {
    const palette = BUILDING_STYLES[style] ?? BUILDING_STYLES.mixed;
    const w = kind === 'pagoda' ? R(12, 18) : R(size[0], size[1]);
    const d = kind === 'pagoda' ? w : R(size[0], size[1]);
    hole.buildings.push([round(x), round(z), round(w), round(d), round(h), Math.floor(rng() * palette.length), round(a, 100), kind, style]);
  };
  if (sky && sky.density > 0) {
    const style = sky.style ?? 'mixed';
    const kinds = BUILDING_KINDS[style] ?? BUILDING_KINDS.mixed;
    const count = Math.round(28 * sky.density);
    for (let tries = 0, made = 0; made < count && tries < count * 6; tries++) {
      const a = axisYaw + R(-80, 80) * DEG;
      const d = R(sky.near ?? 430, sky.far ?? 950);
      const [fx, fz] = forward(a);
      const x = pinPt[0] + fx * d;
      const z = pinPt[1] + fz * d;
      if (hole.landmarks.some((l) => Math.hypot(l.x - x, l.z - z) < 110 * l.scale)) continue;
      if (sea && seaDistance(sea, x, z) > -10) continue;
      const kind = pickKind(kinds.tall);
      const tall = rng() < 0.15 ? 2.2 : 1;
      const h = LOW_KINDS.has(kind) ? lowHeight(kind) * (1 + sky.density * 0.25) : R(22, 60) * (0.7 + sky.density * 0.35) * tall * (sky.height ?? 1);
      placeBuilding(x, z, kind, h, style, a);
      made++;
    }
    // The neighbourhood: low houses and shops closer in, all round the hole.
    const lowStyle = sky.low ?? style;
    const lowKinds = (BUILDING_KINDS[lowStyle] ?? BUILDING_KINDS.mixed).low;
    const lowCount = Math.round(10 + 10 * Math.min(2, sky.density));
    for (let tries = 0, made = 0; made < lowCount && tries < lowCount * 8; tries++) {
      const a = rng() * Math.PI * 2;
      const d = R(hole.bounds.r * 0.75, hole.bounds.r + 220);
      const x = hole.bounds.x + Math.cos(a) * d;
      const z = hole.bounds.z + Math.sin(a) * d;
      if (!clearOfPlay(hole, x, z, width / 2 + 55)) continue;
      if (Math.hypot(x, z) < 70) continue; // not right behind the tee
      if (hole.landmarks.some((l) => Math.hypot(l.x - x, l.z - z) < 70 * l.scale)) continue;
      if (hole.buildings.some((b) => Math.hypot(b[0] - x, b[1] - z) < 26)) continue;
      const kind = pickKind(lowKinds);
      placeBuilding(x, z, kind, lowHeight(kind), lowStyle, a + R(-0.3, 0.3), [10, 20]);
      made++;
      // Close enough to be hit: make it solid, and clear any trees out of the way.
      const [bx, bz, bw, bd, bh, , byaw] = hole.buildings[hole.buildings.length - 1];
      const reach = Math.max(bw, bd) * 0.75 + 3;
      const gone = new Set();
      hole.trees = hole.trees.filter((t) => {
        const inside = Math.hypot(t[1] - bx, t[2] - bz) < reach;
        if (inside) gone.add(`${t[1]},${t[2]}`);
        return !inside;
      });
      if (gone.size) hole.colliders = hole.colliders.filter((c) => c.label !== 'tree' || !gone.has(`${c.x},${c.z}`));
      if (Math.hypot(bx - hole.bounds.x, bz - hole.bounds.z) < hole.bounds.r + 20) {
        hole.colliders.push({ c: 'box', x: bx, z: bz, w: bw, d: bd, h: bh, y0: 0, yaw: byaw, e: 0.35, label: 'building' });
      }
    }
    hole.buildingStyle = style;
  }

  return hole;
}

// ---------- layout designs ----------
// Every design is built from the same pieces the physics already knows (ponds, bunkers, the
// fairway's width, mounds), so they all play like the rest of the course.
//   split / splitSand: a pond (or bunker) in the middle of the landing zone: go left or right
//   reflect: twin reflecting canals running down both edges of the fairway
//   carry: a lake you have to carry off the tee
//   peninsula: water on three sides of the green
//   cornerLake: a lake in the inside of the dogleg (cut the corner over the water, or play round)
//   pots: lots of small, deep pot bunkers dotted about
//   waste: a long sandy waste area down one side
//   heavy: a cross bunker short of the green and extra greenside sand
//   narrow / wide: the fairway's width (set above)   mounds: rolling mounds along the sides
function addDesignHazards({ design, spec, rng, R, path, total, width, greenRadius, endYaw, pinPt, ponds, bunkers, fairway, turnSign }) {
  if (!design.size) return;
  const pin = { x: pinPt[0], z: pinPt[1] };
  // Keep the tee box, the green (with a little apron) and the other water clear.
  const safe = (e, pad = 4) => {
    const grown = { ...e, rx: e.rx + pad, rz: e.rz + pad };
    if (inEllipse(grown, 0, 0) || Math.hypot(e.x, e.z) < Math.max(e.rx, e.rz) + 22) return false;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) { // round the green's oval edge
      const gx = pin.x + Math.cos(a) * greenRadius * 1.4;
      const gz = pin.z + Math.sin(a) * greenRadius;
      if (inEllipse(grown, gx, gz)) return false;
    }
    return !inEllipse(grown, pin.x, pin.z);
  };
  const landing = spec.par === 3 ? total * 0.55 : Math.min(total * 0.55, R(200, 230));

  if (design.has('split') || design.has('splitSand')) {
    const p = pathAt(path, landing + R(-8, 8));
    const e = { x: p.x, z: p.z, rx: Math.max(4.5, width * 0.2), rz: R(20, 28), yaw: p.yaw };
    if (safe(e, 6)) (design.has('split') ? ponds : bunkers).push(roundE(e));
  }
  if (design.has('reflect')) {
    // Twin reflecting canals down both edges of the fairway (a Mughal garden): the middle
    // stays open, anything wide gets wet.
    const a = total * 0.28;
    const b = total * 0.7;
    const mid = pathAt(path, (a + b) / 2);
    for (const side of [-1, 1]) {
      const lat = side * (width / 2 + 4);
      const e = { x: mid.x + mid.right[0] * lat, z: mid.z + mid.right[1] * lat, rx: 3.5, rz: (b - a) / 2, yaw: mid.yaw };
      if (safe(e, 5)) ponds.push(roundE(e));
    }
  }
  if (design.has('carry')) {
    const at = spec.par === 3 ? total * R(0.4, 0.5) : R(75, 95);
    const p = pathAt(path, at);
    let e = { x: p.x, z: p.z, rx: width / 2 + R(26, 40), rz: spec.par === 3 ? total * 0.18 : R(24, 32), yaw: p.yaw };
    for (let i = 0; i < 4 && !safe(e, 5); i++) e = { ...e, rz: e.rz * 0.8, rx: e.rx * 0.9 };
    if (safe(e, 5)) ponds.push(roundE(e));
  }
  if (design.has('peninsula')) {
    for (const [side, ahead] of [[-1, 0.15], [1, 0.15], [0, 1]]) {
      const a = endYaw;
      const [fx, fz] = forward(a);
      const [rx, rz] = rightOf(a);
      const w = R(14, 18);
      const lat = side * (greenRadius * 1.4 + 10 + w);
      const fwd = side === 0 ? greenRadius + 16 + w : greenRadius * ahead; // room for a ball to release on quick greens
      const e = { x: pin.x + rx * lat + fx * fwd, z: pin.z + rz * lat + fz * fwd, rx: side === 0 ? greenRadius * 2.4 : w, rz: side === 0 ? w : greenRadius + 22, yaw: a };
      if (safe(e, 3)) ponds.push(roundE(e));
    }
  }
  if (design.has('cornerLake') && path.length >= 3) {
    const [cx, cz] = path[1];
    const [bx, bz] = path[path.length - 1];
    const k = 0.5;
    const mx = cx + (bx * 0.5 - cx) * k; // towards the tee–pin line, on the inside of the bend
    const mz = cz + (bz * 0.5 - cz) * k;
    const legYaw = yawOf(bx - cx, bz - cz);
    let e = { x: mx, z: mz, rx: R(22, 30), rz: R(30, 42), yaw: legYaw };
    const clearOfFairway = (el) => {
      const grown = { ...el, rx: el.rx + width / 2 + 3, rz: el.rz + width / 2 + 3 };
      const L = pathLength(fairway.points);
      for (let s = 0; s <= L; s += 6) { const q = pathAt(fairway.points, s); if (inEllipse(grown, q.x, q.z)) return false; }
      return true;
    };
    for (let i = 0; i < 5 && !(clearOfFairway(e) && safe(e, 5)); i++) e = { ...e, rx: e.rx * 0.82, rz: e.rz * 0.82 };
    if (clearOfFairway(e) && safe(e, 5) && e.rx > 8) ponds.push(roundE(e));
  }
  if (design.has('pots')) {
    const n = spec.par === 3 ? 7 : 11;
    for (let i = 0, tries = 0; i < n && tries < 60; tries++) {
      const p = pathAt(path, total * R(0.25, 0.96));
      const lat = (rng() < 0.5 ? -1 : 1) * R(2, width / 2 + 5);
      const e = { x: p.x + p.right[0] * lat, z: p.z + p.right[1] * lat, rx: R(2.6, 3.4), rz: R(2.4, 3.2), yaw: rng() * Math.PI };
      if (!safe(e, 3) || ponds.some((q) => inEllipse({ ...q, rx: q.rx + 5, rz: q.rz + 5 }, e.x, e.z))) continue;
      if (bunkers.some((b) => Math.hypot(b.x - e.x, b.z - e.z) < Math.max(b.rx, b.rz) + 6)) continue;
      bunkers.push(roundE(e));
      i++;
    }
  }
  if (design.has('waste')) {
    const p = pathAt(path, total * R(0.45, 0.55));
    const side = -turnSign;
    const e = { x: p.x + p.right[0] * side * (width / 2 + 5), z: p.z + p.right[1] * side * (width / 2 + 5), rx: R(9, 12), rz: total * 0.26, yaw: p.yaw };
    for (let i = 0; i < 4 && !safe(e, 4); i++) e.rz *= 0.8;
    if (safe(e, 4)) bunkers.push(roundE(e));
  }
  if (design.has('heavy')) {
    const p = pathAt(path, total - greenRadius - R(45, 65));
    const cross = { x: p.x, z: p.z, rx: width * 0.42, rz: R(3.5, 4.5), yaw: p.yaw };
    if (safe(cross, 4)) bunkers.push(roundE(cross));
    for (const a of [100, -100]) {
      const yawA = endYaw + a * DEG;
      const [fx, fz] = forward(yawA);
      const d = greenRadius * 1.25 + R(5, 8);
      const e = { x: pin.x + fx * d, z: pin.z + fz * d, rx: R(5, 7), rz: R(3, 4.5), yaw: yawA + Math.PI / 2 };
      if (!bunkers.some((b) => Math.hypot(b.x - e.x, b.z - e.z) < 9)) bunkers.push(roundE(e));
    }
  }
}

function roundE(e) {
  return { x: round(e.x), z: round(e.z), rx: round(e.rx), rz: round(e.rz), yaw: round(e.yaw, 1000) };
}

// Is (x, z) out of the way of play: away from the fairway line, green, hazards, sea and tee?
function clearOfPlay(hole, x, z, minFromPath) {
  if (nearestOnPath(hole.path, x, z).dist < minFromPath) return false;
  if (Math.hypot(x - hole.pin[0], z - hole.pin[2]) < hole.greenRadius + 12) return false;
  if (hole.ponds.some((p) => inEllipse({ ...p, rx: p.rx + 6, rz: p.rz + 6 }, x, z))) return false;
  if ((hole.rivers ?? []).some((rv) => nearestOnPath(rv.points, x, z).dist < rv.width / 2 + 5)) return false;
  if (hole.bunkers.some((b) => inEllipse({ ...b, rx: b.rx + 4, rz: b.rz + 4 }, x, z))) return false;
  if (hole.sea && seaDistance(hole.sea, x, z) > -hole.sea.beach - 6) return false;
  return true;
}

// Collision size of each tree model at scale 1 (trunk plus the dense part of the canopy).
const TREE_COLLIDERS = {
  round: { r: 1.8, h: 8 }, blossom: { r: 1.8, h: 8 }, cypress: { r: 1.2, h: 11 },
  pine: { r: 2, h: 10.5 }, snowpine: { r: 2, h: 10.5 }, palm: { r: 0.45, h: 9 }, cactus: { r: 0.9, h: 4.6 },
  oak: { r: 2.4, h: 9 }, maple: { r: 2.4, h: 9 }, birch: { r: 0.9, h: 9 }, willow: { r: 2.6, h: 6.5 },
  bamboo: { r: 1, h: 8.5 }, rain: { r: 0.5, h: 7.5 }, umbrella: { r: 0.45, h: 10.5 }, jpine: { r: 1.6, h: 6.5 },
  olive: { r: 1.8, h: 4.6 }, banana: { r: 1.2, h: 4.5 }, gum: { r: 0.5, h: 11 }, topiary: { r: 1.1, h: 6 },
  joshua: { r: 0.6, h: 5.5 },
};

// Spread the city's obstacles over the hole: in the landing zones (off the centre line, so a
// straight shot down the middle is always open), on the approach, around the green and along
// the edges. Each spot may hold a group (a line of Berlin Wall, a waddle of penguins…).
function placeObstacles(hole, spec, rng, R, total, width, endYaw) {
  const types = spec.obstacles ?? [];
  if (!types.length) return;
  // Spots down the hole: obstacles out on the fairway itself (alternating sides, so there's
  // always a way through), along the edges, on the approach and right around the green.
  const slots = [];
  const startS = spec.par === 3 ? total * 0.3 : 110;
  const step = spec.par === 3 ? 22 : 34;
  let k = 0;
  for (let s = startS; s < total - 35; s += step + R(-6, 6), k++) {
    slots.push([k % 3 === 2 ? 'edge' : 'fair', s]);
  }
  slots.push(['approach', total - R(30, 45)], ['green'], ['green'], ['green'], ['edge', total * R(0.4, 0.8)]);
  const tooWet = (x, z, pad) =>
    hole.ponds.some((p) => inEllipse({ ...p, rx: p.rx + pad, rz: p.rz + pad }, x, z)) ||
    hole.rivers.some((rv) => nearestOnPath(rv.points, x, z).dist < rv.width / 2 + pad) ||
    (hole.sea && seaDistance(hole.sea, x, z) > -hole.sea.beach * 0.3);
  const onGreen = (x, z, pad) => {
    const gx = (x - hole.pin[0]) / (hole.greenRadius * 1.4 + pad);
    const gz = (z - hole.pin[2]) / (hole.greenRadius + pad);
    return gx * gx + gz * gz <= 1;
  };

  // Doglegs: something tall in the inside corner, on the shortcut line, so you have to play
  // around the bend (or go over the top of it) instead of cutting straight at the flag.
  const corner = () => {
    if (hole.path.length < 3) return false;
    const type = types.find((t) => OBSTACLES[t]?.big) ?? types.find((t) => !OBSTACLES[t]?.animal) ?? types[0];
    const def = OBSTACLES[type];
    const radius = obstacleRadius(type);
    const group = def.group ?? { count: 1, spread: 0 };
    const groupReach = radius + group.spread * (group.count - 1) * 0.6;
    for (let c = 1; c < hole.path.length - 1; c++) {
      const [cx, cz] = hole.path[c];
      // Nearest point on the straight tee → pin line to the corner.
      const [ax, az] = hole.path[0];
      const [bx, bz] = hole.path[hole.path.length - 1];
      const L2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((cx - ax) * (bx - ax) + (cz - az) * (bz - az)) / L2));
      const lx = ax + (bx - ax) * t;
      const lz = az + (bz - az) * t;
      for (const k of [0.45, 0.6, 0.3, 0.75]) {
        const x = cx + (lx - cx) * k;
        const z = cz + (lz - cz) * k;
        if (nearestOnPath(hole.path, x, z).dist < width / 2 + groupReach + 2) continue;
        if (Math.hypot(x, z) < 40 || tooWet(x, z, groupReach + 2) || onGreen(x, z, groupReach + 6)) continue;
        if (hole.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < groupReach + obstacleRadius(o.type) + 6)) continue;
        const yaw = Math.atan2(-(bx - ax), -(bz - az)) + Math.PI / 2;
        addGroup(hole, type, def, x, z, def.group?.layout === 'line' ? yaw : rng() * Math.PI * 2, rng, R);
        return true;
      }
    }
    return false;
  };
  corner();

  const placed = new Set();
  slots.forEach(([kind, s], i) => {
    // Rotate through the city's types, but make sure each one shows up before repeating.
    const wantSmall = kind === 'fair' || kind === 'approach' || kind === 'green';
    const pool = wantSmall && types.some((t) => !OBSTACLES[t]?.big) ? types.filter((t) => !OBSTACLES[t]?.big) : types;
    const type = types.find((t) => !placed.has(t) && pool.includes(t)) ?? pool[i % pool.length];
    const def = OBSTACLES[type];
    if (!def) return;
    const radius = obstacleRadius(type);
    const group = def.group ?? { count: 1, spread: 0 };
    const groupReach = radius + group.spread * (group.count - 1) * 0.6;
    if (def.big && (kind === 'fair' || kind === 'approach')) kind = 'edge';
    for (const side of rng() < 0.5 ? [1, -1] : [-1, 1]) {
      let x;
      let z;
      let yaw;
      if (kind === 'green') {
        const a = endYaw + side * R(35, 160) * DEG;
        const d = hole.greenRadius * 1.15 + R(3, 6) + groupReach;
        const [fx, fz] = forward(a);
        x = hole.pin[0] + fx * d;
        z = hole.pin[2] + fz * d;
        yaw = a;
      } else {
        const p = pathAt(hole.path, s);
        const lat = kind === 'edge' ? side * (width / 2 + R(3, 9) + groupReach)
          : side * (width * R(0.2, 0.4) + 3 + groupReach * 0.5);
        x = p.x + p.right[0] * lat;
        z = p.z + p.right[1] * lat;
        yaw = p.yaw;
      }
      if (Math.hypot(x, z) < 25 || tooWet(x, z, groupReach + 2) || onGreen(x, z, kind === 'green' ? groupReach - 2 : groupReach + 3)) continue;
      if (nearestOnPath(hole.path, x, z).dist < 3.5 + groupReach * 0.6 && kind !== 'edge') continue;
      if (hole.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < groupReach + obstacleRadius(o.type) + 6)) continue;
      addGroup(hole, type, def, x, z, yaw, rng, R);
      placed.add(type);
      return;
    }
  });
  // Top up to at least 10 spots on every hole.
  let spots = new Set(hole.obstacles.map((o) => o.spot)).size;
  for (let tries = 0; spots < 10 && tries < 60; tries++) {
    const type = types[tries % types.length];
    const def = OBSTACLES[type];
    if (!def) continue;
    const group = def.group ?? { count: 1, spread: 0 };
    const groupReach = obstacleRadius(type) + group.spread * (group.count - 1) * 0.6;
    const p = pathAt(hole.path, total * R(0.2, 0.92));
    const inside = !def.big && rng() < 0.6;
    const side = rng() < 0.5 ? -1 : 1;
    const lat = side * (inside ? width * R(0.22, 0.42) + 3 + groupReach * 0.5 : width / 2 + R(3, 12) + groupReach);
    const x = p.x + p.right[0] * lat;
    const z = p.z + p.right[1] * lat;
    if (Math.hypot(x, z) < 25 || tooWet(x, z, groupReach + 2) || onGreen(x, z, groupReach + 3)) continue;
    if (nearestOnPath(hole.path, x, z).dist < 3.5 + groupReach * 0.6) continue;
    if (hole.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < groupReach + obstacleRadius(o.type) + 5)) continue;
    addGroup(hole, type, def, x, z, p.yaw, rng, R);
    placed.add(type);
    spots = new Set(hole.obstacles.map((o) => o.spot)).size;
  }
  // Anything that didn't find room yet (short holes, island greens): try along the edges.
  for (const type of types) {
    if (placed.has(type) || !OBSTACLES[type]) continue;
    const def = OBSTACLES[type];
    const group = def.group ?? { count: 1, spread: 0 };
    const groupReach = obstacleRadius(type) + group.spread * (group.count - 1) * 0.6;
    for (let tries = 0; tries < 12 && !placed.has(type); tries++) {
      const p = pathAt(hole.path, total * R(0.25, 0.85));
      const lat = (rng() < 0.5 ? -1 : 1) * (width / 2 + R(4, 14) + groupReach);
      const x = p.x + p.right[0] * lat;
      const z = p.z + p.right[1] * lat;
      if (Math.hypot(x, z) < 25 || tooWet(x, z, groupReach + 2) || onGreen(x, z, groupReach + 3)) continue;
      if (hole.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < groupReach + obstacleRadius(o.type) + 6)) continue;
      addGroup(hole, type, def, x, z, p.yaw, rng, R);
      placed.add(type);
    }
  }
}

function addGroup(hole, type, def, x, z, yaw, rng, R) {
  const g = def.group ?? { count: 1, spread: 0 };
  const spot = (hole.spotCount = (hole.spotCount ?? 0) + 1);
  const [rx, rz] = rightOf(yaw);
  for (let k = 0; k < g.count; k++) {
    let mx = x;
    let mz = z;
    if (g.layout === 'line') {
      const off = (k - (g.count - 1) / 2) * g.spread;
      mx += rx * off;
      mz += rz * off;
    } else if (g.layout === 'ring') {
      const a = (k / g.count) * Math.PI * 2;
      mx += Math.cos(a) * g.spread;
      mz += Math.sin(a) * g.spread;
    } else if (k > 0) {
      mx += R(-1, 1) * g.spread;
      mz += R(-1, 1) * g.spread;
    }
    const scale = g.shrink ? 1 - g.shrink * k : 1;
    const myaw = def.animal ? rng() * Math.PI * 2 : yaw + (g.layout === 'line' ? 0 : R(-0.2, 0.2));
    if (nearestOnPath(hole.path, mx, mz).dist < 2.5 + obstacleRadius(type) * scale) continue;
    hole.obstacles.push({ type, spot, x: round(mx, 100), z: round(mz, 100), yaw: round(myaw, 1000), scale: round(scale, 100) });
    const c = Math.cos(myaw);
    const s = Math.sin(myaw);
    for (const col of def.colliders) {
      const lx = col.x * scale;
      const lz = col.z * scale;
      const base = { x: round(mx + lx * c + lz * s, 100), z: round(mz - lx * s + lz * c, 100), h: col.h * scale, y0: (col.y0 ?? 0) * scale, e: def.animal ? 0.3 : 0.45, label: def.label };
      if (col.c === 'circle') hole.colliders.push({ c: 'circle', r: col.r * scale, ...base });
      else hole.colliders.push({ c: 'box', w: col.w * scale, d: col.d * scale, yaw: myaw, ...base });
    }
  }
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
