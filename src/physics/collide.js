import { PHYSICS } from '../config.js';
import { groundHeight } from './course.js';

// Ball against solid things on the course: trees and city obstacles (buses, statues, animals…).
// Colliders come from the hole generator; a coarse grid keeps each check to the few nearby ones.
//   circle: upright cylinder of radius r      box: w × d footprint turned by yaw
//   both span from (ground + y0) to (ground + h); e = bounciness (0..1)

const CELL = 16;
const grids = new WeakMap();

function gridFor(hole) {
  if (grids.has(hole)) return grids.get(hole);
  const cells = new Map();
  for (const c of hole.colliders ?? []) {
    c.base = groundHeight(hole, c.x, c.z);
    const reach = c.c === 'circle' ? c.r : Math.hypot(c.w, c.d) / 2;
    for (let gx = Math.floor((c.x - reach) / CELL); gx <= Math.floor((c.x + reach) / CELL); gx++) {
      for (let gz = Math.floor((c.z - reach) / CELL); gz <= Math.floor((c.z + reach) / CELL); gz++) {
        const key = `${gx},${gz}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(c);
      }
    }
  }
  grids.set(hole, cells);
  return cells;
}

// Push the ball out of anything it has run into and bounce it off. Returns the collider hit, or null.
export function collide(b, hole) {
  if (!hole.colliders?.length) return null;
  const list = gridFor(hole).get(`${Math.floor(b.p.x / CELL)},${Math.floor(b.p.z / CELL)}`);
  if (!list) return null;
  const R = PHYSICS.ballRadius;
  for (const c of list) {
    if (b.p.y - R > c.base + c.h || b.p.y + R < c.base + c.y0) continue;
    let nx;
    let nz;
    let depth;
    if (c.c === 'circle') {
      const dx = b.p.x - c.x;
      const dz = b.p.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + R;
      if (d >= min) continue;
      if (d < 1e-6) { const v = Math.hypot(b.v.x, b.v.z) || 1; nx = -b.v.x / v; nz = -b.v.z / v; } else { nx = dx / d; nz = dz / d; }
      depth = min - d;
    } else {
      const cs = Math.cos(c.yaw);
      const sn = Math.sin(c.yaw);
      const dx = b.p.x - c.x;
      const dz = b.p.z - c.z;
      const lx = dx * cs - dz * sn; // into the box's own frame
      const lz = dx * sn + dz * cs;
      const px = c.w / 2 + R - Math.abs(lx);
      const pz = c.d / 2 + R - Math.abs(lz);
      if (px <= 0 || pz <= 0) continue;
      // Dropping onto the roof: bounce up instead of sideways.
      if (b.v.y < 0 && b.p.y - R > c.base + c.h - 0.35) {
        b.p.y = c.base + c.h + R;
        b.v.y = -b.v.y * c.e;
        b.v.x *= 0.7;
        b.v.z *= 0.7;
        return c;
      }
      let lnx = 0;
      let lnz = 0;
      if (px < pz) { lnx = Math.sign(lx) || 1; depth = px; } else { lnz = Math.sign(lz) || 1; depth = pz; }
      nx = lnx * cs + lnz * sn; // back to world
      nz = -lnx * sn + lnz * cs;
    }
    b.p.x += nx * depth;
    b.p.z += nz * depth;
    const vn = b.v.x * nx + b.v.z * nz;
    if (vn < 0) {
      b.v.x -= (1 + c.e) * vn * nx;
      b.v.z -= (1 + c.e) * vn * nz;
      b.v.x *= 0.85;
      b.v.z *= 0.85;
      b.v.y *= 0.8;
    }
    b.side.x = b.side.z = 0; // no more hook or slice after a knock
    return c;
  }
  return null;
}
