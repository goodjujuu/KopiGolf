import { PHYSICS, SURFACE } from '../config.js';
import { surfaceAt, groundHeight } from './course.js';

// Ball flight, bounce and roll. Plain numbers, no Three.js, so it can be tested on its own.
//
// States: 'rest' → 'air' → (bounces) → 'roll' → 'rest'   or   → 'water' / 'holed'
// stepBody() returns an event when something happens: 'land', 'rest', 'water', 'holed'.

const SUBSTEPS = 4;
const TERMINAL_EVENTS = new Set(['rest', 'water', 'holed']);

export function createBallBody() {
  return {
    p: { x: 0, y: 0, z: 0 },
    v: { x: 0, y: 0, z: 0 },
    side: { x: 0, z: 0 }, // sideways acceleration from a crooked swing (hook / slice)
    state: 'rest',
    surface: 'fairway',
    bounces: 0,
  };
}

export function placeBody(body, hole, x, z) {
  const s = surfaceAt(hole, x, z);
  body.surface = s;
  body.p.x = x;
  body.p.z = z;
  body.p.y = groundHeight(hole, x, z, s) + PHYSICS.ballRadius;
  body.v.x = body.v.y = body.v.z = 0;
  body.side.x = body.side.z = 0;
  body.state = 'rest';
  body.bounces = 0;
}

// yaw: direction (radians about +y, 0 = toward −z). curve: sideways m/s², positive bends right.
export function launchBody(body, { yaw, speed, launchRad, curve }) {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const horizontal = speed * Math.cos(launchRad);
  body.v.x = fx * horizontal;
  body.v.z = fz * horizontal;
  body.v.y = speed * Math.sin(launchRad);
  body.side.x = Math.cos(yaw) * curve;
  body.side.z = -Math.sin(yaw) * curve;
  body.state = launchRad > 0 ? 'air' : 'roll';
  body.bounces = 0;
}

export function stepBody(body, hole, dt) {
  if (body.state === 'rest' || body.state === 'holed' || body.state === 'water') return null;
  const h = dt / SUBSTEPS;
  let event = null;
  for (let i = 0; i < SUBSTEPS; i++) {
    const e = substep(body, hole, h);
    if (e) event = e;
    if (TERMINAL_EVENTS.has(event)) break;
  }
  return event;
}

function substep(b, hole, dt) {
  const g = PHYSICS.gravity;
  const R = PHYSICS.ballRadius;

  if (b.state === 'air') {
    b.v.y -= g * dt;
    b.v.x += b.side.x * dt;
    b.v.z += b.side.z * dt;
    const drag = 1 - PHYSICS.airDrag * dt;
    b.v.x *= drag; b.v.y *= drag; b.v.z *= drag;
    b.p.x += b.v.x * dt; b.p.y += b.v.y * dt; b.p.z += b.v.z * dt;

    const s = surfaceAt(hole, b.p.x, b.p.z);
    const ground = groundHeight(hole, b.p.x, b.p.z, s) + R;
    if (b.p.y > ground || b.v.y >= 0) return null;

    b.surface = s;
    b.p.y = ground;
    if (s === 'water') { b.state = 'water'; return 'water'; }
    if (s === 'green' && distToCup(b, hole) < PHYSICS.cupRadius) return holeOut(b, hole);

    const surf = PHYSICS.surfaces[s];
    b.bounces += 1;
    b.side.x = b.side.z = 0; // once it touches down, the curve stops
    const firstTouch = b.bounces === 1;
    if (-b.v.y > PHYSICS.minBounceSpeed) {
      b.v.y = -b.v.y * surf.bounce;
      b.v.x *= surf.keep;
      b.v.z *= surf.keep;
    } else {
      b.v.y = 0;
      b.state = 'roll';
    }
    return firstTouch ? 'land' : null;
  }

  // Rolling along the ground.
  const s = surfaceAt(hole, b.p.x, b.p.z);
  b.surface = s;
  if (s === 'water') { b.state = 'water'; b.p.y = groundHeight(hole, b.p.x, b.p.z, s); return 'water'; }
  const speed = Math.hypot(b.v.x, b.v.z);
  if (s === 'green' && distToCup(b, hole) < PHYSICS.cupRadius && speed < PHYSICS.captureSpeed) {
    return holeOut(b, hole);
  }
  const next = Math.max(0, speed - PHYSICS.surfaces[s].roll * g * dt);
  if (next < PHYSICS.restSpeed) {
    b.v.x = b.v.z = 0;
    b.state = 'rest';
    b.p.y = groundHeight(hole, b.p.x, b.p.z, s) + R;
    return 'rest';
  }
  const k = next / speed;
  b.v.x *= k;
  b.v.z *= k;
  b.p.x += b.v.x * dt;
  b.p.z += b.v.z * dt;
  b.p.y = groundHeight(hole, b.p.x, b.p.z) + R;
  return null;
}

function distToCup(b, hole) {
  return Math.hypot(b.p.x - hole.pin[0], b.p.z - hole.pin[2]);
}

function holeOut(b, hole) {
  b.state = 'holed';
  b.p.x = hole.pin[0];
  b.p.z = hole.pin[2];
  b.p.y = SURFACE.green - 0.06;
  b.v.x = b.v.y = b.v.z = 0;
  return 'holed';
}
