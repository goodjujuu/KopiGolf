import * as THREE from 'three';
import { lambert, bakeGeometry } from './materials.js';

// Low-poly models for the city obstacles in courses/obstacles.js. Each model is built in the
// obstacle's own frame (x across, z along, y up from the ground) to the same size as its colliders,
// so what the ball bounces off is what you see. Animals get a small idle loop (grazing, bobbing,
// tail flicks) through `update(time)`.

const PI = Math.PI;

// ---------- tiny geometry helpers (each returns a mesh placed by its base) ----------
function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color, opts));
  m.position.set(x, y + h / 2, z);
  return m;
}
function cyl(rTop, rBottom, h, color, x = 0, y = 0, z = 0, segs = 8, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segs), lambert(color, opts));
  m.position.set(x, y + h / 2, z);
  return m;
}
function ball(r, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, opts) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), lambert(color, opts));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}
function cone(r, h, color, x = 0, y = 0, z = 0, segs = 8, opts) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), lambert(color, opts));
  m.position.set(x, y + h / 2, z);
  return m;
}
function wheel(r, w, x, y, z, color = 0x222222) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 10), lambert(color));
  m.rotation.z = PI / 2;
  m.position.set(x, y, z);
  return m;
}
function glow(color, intensity = 0.7) {
  return { emissive: color, emissiveIntensity: intensity };
}
function group(...children) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
  return g;
}
// Stable per-instance variety (colours, poses) from where the obstacle stands.
function pick(o, list, salt = 0) {
  const h = Math.abs(Math.sin(o.x * 12.9898 + o.z * 78.233 + salt * 37.719) * 43758.5453);
  return list[Math.floor((h % 1) * list.length)];
}
function phaseOf(o) {
  return (Math.abs(o.x * 0.37 + o.z * 0.71) % 1) * PI * 2;
}

// Four-legged animal facing +z. Returns the group plus a head pivot for idle animation.
function quadruped({ len, bodyH, legH, width, color, legColor = color, neckLen = 0.4, neckTilt = 0.6, head = 0.3, headColor = color, tail = 0.4 }) {
  const g = new THREE.Group();
  const body = ball(0.5, color, 0, legH + bodyH / 2, 0, width, bodyH, len);
  g.add(body);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) g.add(cyl(width * 0.12, width * 0.1, legH + bodyH * 0.2, legColor, sx * width * 0.28, 0, sz * len * 0.32, 6));
  }
  const neck = new THREE.Group();
  neck.position.set(0, legH + bodyH * 0.7, len * 0.42);
  neck.rotation.x = neckTilt;
  const neckMesh = cyl(width * 0.16, width * 0.2, neckLen, color, 0, 0, 0, 6);
  neck.add(neckMesh);
  const headMesh = ball(head, headColor, 0, neckLen + head * 0.4, head * 0.4, 0.8, 0.8, 1.3);
  neck.add(headMesh);
  g.add(neck);
  if (tail) {
    const t = cyl(0.03, 0.06, tail, legColor, 0, 0, 0, 5);
    const pivot = new THREE.Group();
    pivot.position.set(0, legH + bodyH * 0.75, -len * 0.48);
    pivot.rotation.x = -2.5;
    pivot.add(t);
    g.add(pivot);
    g.userData.tail = pivot;
  }
  return { g, neck, headMesh };
}

// Upright bird (penguin / puffin).
function bird(h, back, belly, beak, feet = 0xf08a24) {
  const g = new THREE.Group();
  g.add(ball(h * 0.32, back, 0, h * 0.42, 0, 1, 1.35, 0.95));
  g.add(ball(h * 0.27, belly, 0, h * 0.4, h * 0.08, 0.95, 1.3, 0.8));
  const head = new THREE.Group();
  head.position.set(0, h * 0.8, 0);
  head.add(ball(h * 0.2, back, 0, 0, 0));
  const b = cone(h * 0.07, h * 0.22, beak, 0, -h * 0.11, h * 0.2, 6);
  b.rotation.x = PI / 2;
  head.add(b);
  g.add(head);
  for (const s of [-1, 1]) g.add(box(h * 0.12, h * 0.04, h * 0.16, feet, s * h * 0.1, 0, h * 0.04));
  return { g, head };
}

// ---------- the catalogue ----------
const MODELS = {
  // ----- vehicles -----
  bus() {
    const g = group(
      box(2.6, 3.9, 11, 0xd8262c, 0, 0.45),
      box(2.64, 0.7, 10.2, 0x2a3440, 0, 1.6),
      box(2.64, 0.7, 10.2, 0x2a3440, 0, 3.15),
      box(2.62, 0.18, 11.02, 0xf2e8d0, 0, 2.6),
      box(2.4, 0.06, 10.6, 0xb81f25, 0, 4.35),
    );
    for (const z of [-3.6, 3.6]) g.add(wheel(0.55, 2.7, 0, 0.55, z));
    g.add(box(1.4, 0.35, 0.05, 0x111111, 0, 3.75, 5.51)); // destination blind
    return { group: g };
  },
  cab(o) {
    const g = group(
      box(2, 0.9, 4.8, 0xf6c21a, 0, 0.35),
      box(1.8, 0.62, 2.5, 0xf6c21a, 0, 1.25, -0.2),
      box(1.84, 0.42, 2.3, 0x2a3440, 0, 1.33, -0.2),
      box(0.6, 0.22, 0.3, 0xffffff, 0, 1.87, -0.2, glow(0xfff6c0, 0.4)),
      box(2.02, 0.12, 4.82, 0x222222, 0, 0.82),
    );
    for (const z of [-1.5, 1.5]) g.add(wheel(0.38, 2.04, 0, 0.38, z));
    g.rotation.y = pick(o, [0, 0.05, -0.05]);
    return { group: g };
  },
  cableCar() {
    const g = group(
      box(2.6, 1.3, 8.5, 0x8a2b20, 0, 0.5),
      box(2.4, 1.3, 7.6, 0xe9d9b0, 0, 1.8),
      box(2.44, 0.75, 7, 0x2a3440, 0, 2.05),
      box(2.8, 0.25, 8.7, 0x6d5d4b, 0, 3.15),
      box(0.4, 0.3, 4, 0x3a3a3a, 0, 3.4),
    );
    for (const z of [-2.8, 2.8]) g.add(wheel(0.4, 2.2, 0, 0.4, z));
    return { group: g };
  },
  tram() {
    const g = group(
      box(2.4, 1.8, 12, 0x24804c, 0, 0.3),
      box(2.4, 2, 12, 0x2f9a5c, 0, 2.1),
      box(2.44, 0.75, 11.4, 0x2a3440, 0, 1.15),
      box(2.44, 0.75, 11.4, 0x2a3440, 0, 2.95),
      box(2.42, 0.2, 12.02, 0xf2e8d0, 0, 2.05),
      box(2.2, 0.1, 11.6, 0xd7d0c0, 0, 4.1),
    );
    for (const z of [-4, 4]) g.add(wheel(0.4, 2.2, 0, 0.4, z));
    g.add(cyl(0.04, 0.04, 1.6, 0x333333, 0, 4.1, 2)); // trolley pole
    return { group: g };
  },
  tuktuk(o) {
    const body = pick(o, [0x1f8ad1, 0x2aa04a, 0xe2382c, 0xf2a71b]);
    const g = group(
      box(1.4, 0.8, 2.6, body, 0, 0.3, -0.1),
      box(1.45, 0.08, 2.8, 0x1e1e1e, 0, 1.7, -0.1),
      box(0.06, 1, 0.06, 0x333333, -0.66, 0.8, 1.1),
      box(0.06, 1, 0.06, 0x333333, 0.66, 0.8, 1.1),
      box(0.06, 0.6, 0.06, 0x333333, -0.66, 1.1, -1.4),
      box(0.06, 0.6, 0.06, 0x333333, 0.66, 1.1, -1.4),
      box(0.9, 0.3, 0.6, 0x3a2a20, 0, 1.0, -0.6),
      wheel(0.26, 0.2, 0, 0.26, 1.2),
      wheel(0.26, 1.5, 0, 0.26, -1),
    );
    return { group: g };
  },
  hotdogCart() {
    const g = group(
      box(1.4, 0.9, 2.2, 0xd6dbe0, 0, 0.4),
      box(1.42, 0.2, 2.22, 0xd13a2b, 0, 1.1),
      cyl(0.03, 0.03, 1.4, 0x888888, 0, 1.3, 0),
      cone(1.1, 0.5, 0xf6c21a, 0, 1.7, 0, 8),
      cone(1.12, 0.12, 0xd13a2b, 0, 1.68, 0, 8),
      wheel(0.35, 1.5, 0, 0.35, 0.6),
    );
    return { group: g };
  },
  // ----- street things -----
  phoneBox() {
    const red = 0xcf1f25;
    const g = group(
      box(1.1, 2.3, 1.1, red),
      box(0.9, 1.5, 1.12, 0xe8eef2, 0, 0.6),
      box(1.12, 1.5, 0.9, 0xe8eef2, 0, 0.6),
      box(1.16, 0.25, 1.16, red, 0, 2.3),
      box(0.9, 0.18, 1.18, 0x222222, 0, 2.05, 0, glow(0xffffff, 0.15)),
      cyl(0.35, 0.55, 0.12, red, 0, 2.55, 0, 4),
    );
    return { group: g };
  },
  guard(o) {
    const g = group(
      box(0.18, 0.95, 0.22, 0x1b1b2e, -0.12, 0),
      box(0.18, 0.95, 0.22, 0x1b1b2e, 0.12, 0),
      box(0.56, 0.75, 0.32, 0xc8202a, 0, 0.95),
      box(0.58, 0.08, 0.34, 0xeeeeee, 0, 1.0),
      ball(0.14, 0xf0c8a0, 0, 1.85),
      cyl(0.2, 0.22, 0.6, 0x111111, 0, 1.9, 0, 10),
      ball(0.2, 0x111111, 0, 2.5, 0, 1, 0.5, 1),
      box(0.05, 0.9, 0.05, 0x666666, 0.33, 1.0, 0.1),
    );
    const phase = phaseOf(o);
    return { group: g, update: (t) => { g.position.y = Math.max(0, Math.sin(t * 0.4 + phase) > 0.97 ? 0.04 : 0); } };
  },
  vendingMachine(o) {
    const c = pick(o, [0xe0312f, 0x2a67d6, 0xf5f5f5, 0x2fa65a]);
    const g = group(
      box(1.1, 1.9, 0.9, c),
      box(0.8, 1.0, 0.04, 0xcfe8ff, -0.08, 0.75, 0.46, glow(0xcfe8ff, 0.5)),
      box(0.18, 0.5, 0.04, 0x333333, 0.4, 0.8, 0.46),
      box(0.8, 0.2, 0.04, 0x222222, -0.08, 0.25, 0.46),
    );
    return { group: g };
  },
  neonSign(o) {
    const c1 = pick(o, [0xff3d8b, 0x2ee6ff, 0xffd23d]);
    const c2 = pick(o, [0x2ee6ff, 0xb44dff, 0xff6a2e], 1);
    const g = group(
      cyl(0.18, 0.22, 7, 0x333840, -1.8),
      cyl(0.18, 0.22, 7, 0x333840, 1.8),
      box(4.4, 3, 0.3, 0x1a1a22, 0, 4),
      box(3.8, 0.35, 0.34, c1, 0, 6.2, 0, glow(c1, 1)),
      box(3.2, 0.35, 0.34, c2, 0, 5.4, 0, glow(c2, 1)),
      box(3.6, 0.35, 0.34, c1, 0, 4.6, 0, glow(c1, 1)),
    );
    return { group: g };
  },
  slotMachine(o) {
    const c = pick(o, [0xd21f3c, 0x7b2bd1, 0x1d7fd1]);
    const g = group(
      box(1, 1.0, 0.9, c),
      box(1, 0.8, 0.7, c, 0, 1.0, -0.1),
      box(0.8, 0.35, 0.04, 0xfff7d6, 0, 1.25, 0.26, glow(0xfff2a0, 0.7)),
      box(1.04, 0.12, 0.94, 0xf2c230, 0, 0.95),
      ball(0.1, 0xd21f1f, 0.62, 1.6, 0),
      box(0.05, 0.5, 0.05, 0xcccccc, 0.6, 1.1, 0),
      cyl(0.3, 0.3, 0.1, 0xf2c230, 0, 1.8, -0.1, 8, glow(0xf2c230, 0.4)),
    );
    return { group: g };
  },
  dice(o) {
    const g = group(box(3, 3, 3, 0xf6f6f2));
    const pip = (x, y, z) => g.add(ball(0.28, pick(o, [0xd21f1f, 0x111111]), x, y, z, 1, 1, 0.25));
    pip(0, 1.5, 1.51); // one on the front
    for (const [a, b] of [[-0.7, 0.8], [0, 0], [0.7, -0.8]]) { // three on the side
      const p = ball(0.28, 0x111111, 1.51, 1.5 + b, a, 0.25, 1, 1);
      g.add(p);
    }
    for (const [a, b] of [[-0.7, -0.7], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7]]) g.add(ball(0.28, 0x111111, a, 3.01, b, 1, 0.25, 1)); // four on top
    g.rotation.y = pick(o, [0.2, -0.35, 0.6]);
    return { group: g };
  },
  wallSegment(o) {
    const paint = pick(o, [0xf2483f, 0x2ec4e6, 0xf6c21a, 0x8e44ad, 0x2fa65a]);
    const paint2 = pick(o, [0x2ec4e6, 0xff7ab8, 0xf6c21a, 0xffffff], 1);
    const g = group(
      box(3.6, 3.3, 1.0, 0xbfbcb4),
      box(3.6, 0.5, 2.2, 0xa9a69e, 0, 0, -0.3),
      box(2.4, 1.2, 0.04, paint, -0.3, 0.8, 0.52),
      box(1.4, 0.9, 0.04, paint2, 0.8, 1.6, 0.53),
    );
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.6, 8), lambert(0xc9c6be));
    top.rotation.z = PI / 2;
    top.position.set(0, 3.35, 0);
    g.add(top);
    return { group: g };
  },
  bikes(o) {
    const frame = pick(o, [0x1b1b1b, 0x2a67d6, 0xd13a2b, 0xf5f5f5, 0x2fa65a]);
    const g = new THREE.Group();
    for (const z of [-0.58, 0.58]) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 5, 14), lambert(0x1a1a1a));
      w.rotation.y = PI / 2;
      w.position.set(0, 0.36, z);
      g.add(w);
    }
    g.add(box(0.06, 0.06, 1.1, frame, 0, 0.62), box(0.06, 0.45, 0.06, frame, 0, 0.36, -0.2), box(0.06, 0.55, 0.06, frame, 0, 0.36, 0.5));
    g.add(box(0.22, 0.06, 0.28, 0x222222, 0, 0.82, -0.2), box(0.55, 0.05, 0.05, 0x888888, 0, 0.92, 0.5));
    g.add(box(0.32, 0.22, 0.28, 0x8b5a2b, 0, 0.62, 0.78)); // front basket
    g.rotation.z = 0.08;
    return { group: g };
  },
  cafeTables(o) {
    const top = pick(o, [0xffffff, 0x2a2a2a, 0x2f6f8f]);
    const chair = pick(o, [0xc0392b, 0x2a2a2a, 0x7a5230], 1);
    const g = group(
      cyl(0.5, 0.5, 0.05, top, 0, 0.72, 0, 14),
      cyl(0.04, 0.04, 0.72, 0x444444),
      cyl(0.25, 0.25, 0.04, 0x444444),
      ball(0.12, pick(o, [0xf2483f, 0xf6c21a, 0x7b2bd1], 2), 0, 0.85),
    );
    for (const a of [0, PI]) {
      const c = group(box(0.4, 0.05, 0.4, chair, 0, 0.45), box(0.4, 0.45, 0.05, chair, 0, 0.45, -0.18));
      for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) c.add(box(0.04, 0.45, 0.04, chair, lx, 0, lz));
      c.position.set(Math.sin(a) * 0.8, 0, Math.cos(a) * 0.8);
      c.rotation.y = a + PI;
      g.add(c);
    }
    return { group: g };
  },
  surfboards() {
    const g = group(
      box(2.4, 0.08, 0.1, 0x7a5230, 0, 1.0, -0.2),
      box(0.1, 1.2, 0.1, 0x7a5230, -1.15, 0, -0.2),
      box(0.1, 1.2, 0.1, 0x7a5230, 1.15, 0, -0.2),
    );
    const cols = [0xff6a3d, 0x2ec4e6, 0xf6c21a, 0x2fa65a, 0xff7ab8];
    cols.forEach((c, i) => {
      const b = ball(0.25, c, -1 + i * 0.5, 1.2, 0, 1, 4.6, 0.25);
      b.rotation.x = -0.12;
      g.add(b);
    });
    return { group: g };
  },
  beachUmbrella(o) {
    const c1 = pick(o, [0xf2483f, 0x2a7ad6, 0x2fa65a, 0xff8a1f]);
    const g = group(cyl(0.05, 0.05, 2.5, 0xeeeeee, 0, 0, 0, 6));
    const segs = 8;
    for (let i = 0; i < segs; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.6, segs, 1, true, (i / segs) * PI * 2, (PI * 2) / segs), lambert(i % 2 ? 0xffffff : c1, { side: THREE.DoubleSide }));
      s.position.y = 2.3;
      g.add(s);
    }
    const towel = box(0.9, 0.02, 1.8, pick(o, [0xffd23d, 0x2ec4e6, 0xff7ab8], 1), 0.9, 0, 0.6);
    towel.rotation.y = 0.3;
    g.add(towel);
    return { group: g };
  },
  footballGoal() {
    const white = 0xf6f6f6;
    const g = group(
      cyl(0.07, 0.07, 2.44, white, -3.66),
      cyl(0.07, 0.07, 2.44, white, 3.66),
      box(7.46, 0.12, 0.12, white, 0, 2.32),
      box(7.3, 0.04, 0.04, 0xcccccc, 0, 0, -1.6),
      box(0.04, 0.04, 1.6, 0xcccccc, -3.66, 2.38, -0.8),
      box(0.04, 0.04, 1.6, 0xcccccc, 3.66, 2.38, -0.8),
    );
    const net = new THREE.Mesh(new THREE.PlaneGeometry(7.3, 2.9), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    net.position.set(0, 1.2, -0.8);
    net.rotation.x = -0.6;
    g.add(net);
    return { group: g };
  },
  hotAirBalloon(o) {
    const cols = [pick(o, [0xf2483f, 0x7b2bd1, 0x1d7fd1]), pick(o, [0xf6c21a, 0xffffff, 0x2ec4e6], 1)];
    const g = new THREE.Group();
    const lift = new THREE.Group();
    g.add(lift);
    lift.add(box(2, 1.4, 2, 0x8b5a2b, 0, 14));
    for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
      const r = cyl(0.03, 0.03, 3, 0x553311, x * 1.3, 15.4, z * 1.3, 4);
      lift.add(r);
    }
    const n = 10;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 10, (i / n) * PI * 2, (PI * 2) / n), lambert(cols[i % 2]));
      s.position.y = 21.5;
      s.scale.y = 1.15;
      lift.add(s);
    }
    lift.add(cone(2.2, 2.5, cols[0], 0, 15.8, 0, 10));
    lift.children.at(-1).rotation.x = PI;
    g.add(cyl(0.03, 0.03, 14, 0xdddddd, 1.0, 0, 0.8, 4)); // tether
    const phase = phaseOf(o);
    return { group: g, update: (t) => { lift.position.y = Math.sin(t * 0.5 + phase) * 0.25; lift.rotation.y = Math.sin(t * 0.15 + phase) * 0.2; } };
  },
  car(o) {
    const c = pick(o, [0xd7262c, 0x2a67d6, 0xf5f5f5, 0x1b1b1b, 0x9aa3ad, 0x2fa65a, 0xf2a71b]);
    const g = group(
      box(1.9, 0.75, 4.4, c, 0, 0.3),
      box(1.7, 0.6, 2.3, c, 0, 1.05, -0.25),
      box(1.74, 0.42, 2.1, 0x2a3440, 0, 1.12, -0.25),
      box(1.92, 0.1, 4.42, 0x222222, 0, 0.32),
      box(0.4, 0.15, 0.05, 0xfff6c0, -0.6, 0.75, 2.21, glow(0xfff6c0, 0.3)),
      box(0.4, 0.15, 0.05, 0xfff6c0, 0.6, 0.75, 2.21, glow(0xfff6c0, 0.3)),
      box(0.4, 0.15, 0.05, 0xd21f1f, -0.6, 0.75, -2.21),
      box(0.4, 0.15, 0.05, 0xd21f1f, 0.6, 0.75, -2.21),
    );
    for (const z of [-1.4, 1.4]) g.add(wheel(0.36, 1.94, 0, 0.36, z));
    return { group: g };
  },
  trafficCone() {
    const g = group(
      box(0.5, 0.05, 0.5, 0x1b1b1b),
      cone(0.22, 0.7, 0xff6a1a, 0, 0.05, 0, 10),
      cyl(0.13, 0.16, 0.12, 0xffffff, 0, 0.32, 0, 10),
    );
    return { group: g };
  },
  hydrant(o) {
    const c = pick(o, [0xd7262c, 0xf2c21a]);
    const g = group(
      cyl(0.2, 0.24, 0.6, c, 0, 0, 0, 10),
      ball(0.2, c, 0, 0.62, 0, 1, 0.8, 1),
      cyl(0.05, 0.05, 0.12, c, 0, 0.78, 0, 6),
      cyl(0.09, 0.09, 0.5, 0xc0c0c0, 0, 0.38, 0, 8),
    );
    g.children[3].rotation.z = PI / 2;
    return { group: g };
  },
  planter(o) {
    const flowers = [pick(o, [0xf2483f, 0xf6c21a, 0xff7ab8, 0xb44dff]), pick(o, [0xffffff, 0xf2483f, 0xff9a2e], 1)];
    const g = group(
      box(2.6, 0.75, 0.9, 0x8f8a80),
      box(2.4, 0.15, 0.7, 0x5a3e2a, 0, 0.72),
    );
    for (let i = 0; i < 6; i++) g.add(ball(0.24, i < 3 ? 0x4f8a2e : flowers[i % 2], -1 + (i % 6) * 0.4, 0.95 + (i % 2) * 0.08, (i % 2 ? 0.15 : -0.15), 1, 0.8, 1));
    return { group: g };
  },
  bench() {
    const wood = 0x8a5a32;
    const g = group(
      box(1.9, 0.08, 0.5, wood, 0, 0.45, 0.1),
      box(1.9, 0.4, 0.06, wood, 0, 0.6, -0.2),
      box(0.08, 0.45, 0.6, 0x2a2a2a, -0.85, 0, 0),
      box(0.08, 0.45, 0.6, 0x2a2a2a, 0.85, 0, 0),
    );
    return { group: g };
  },
  lifeguardTower() {
    const g = group(
      box(2.6, 1.4, 2.6, 0xf6c21a, 0, 2.2),
      box(2.8, 0.15, 2.8, 0xd7262c, 0, 3.6),
      cone(1.9, 0.5, 0xd7262c, 0, 3.7, 0, 4),
      box(2.0, 0.6, 0.05, 0x2a3440, 0, 2.7, 1.31),
      box(1.2, 0.18, 0.06, 0xd7262c, 0, 2.35, 1.33),
    );
    g.children[2].rotation.y = PI / 4;
    for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) g.add(box(0.15, 2.2, 0.15, 0xf2efe8, x, 0, z));
    const ramp = box(0.9, 0.08, 3, 0xd8c7a0, 0, 1.0, 2.4);
    ramp.rotation.x = 0.6;
    g.add(ramp);
    return { group: g };
  },
  sandcastle() {
    const s = 0xe6c98a;
    const g = group(
      cyl(1.3, 1.4, 0.6, s, 0, 0, 0, 10),
      box(1.4, 0.6, 1.4, s, 0, 0.6),
      cyl(0.35, 0.4, 1.0, s, -0.75, 0.6, -0.75, 8),
      cyl(0.35, 0.4, 1.0, s, 0.75, 0.6, -0.75, 8),
      cyl(0.35, 0.4, 1.0, s, -0.75, 0.6, 0.75, 8),
      cyl(0.35, 0.4, 1.0, s, 0.75, 0.6, 0.75, 8),
      cone(0.4, 0.4, s, 0, 1.2, 0, 8),
      box(0.03, 0.4, 0.03, 0x8a6a42, 0, 1.4, 0),
      box(0.3, 0.18, 0.02, 0xf2483f, 0.15, 1.65, 0),
    );
    return { group: g };
  },
  volleyballNet() {
    const g = group(
      cyl(0.08, 0.08, 2.5, 0xeeeeee, -4.5),
      cyl(0.08, 0.08, 2.5, 0xeeeeee, 4.5),
      box(9, 0.08, 0.04, 0xffffff, 0, 2.42),
      box(9, 0.06, 0.04, 0xffffff, 0, 1.62),
    );
    const net = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.8), new THREE.MeshLambertMaterial({ color: 0x222222, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    net.position.y = 2.05;
    g.add(net, ball(0.11, 0xf6c21a, 1.2, 0.11, 1.5));
    return { group: g };
  },
  slalomGate(o) {
    const c = pick(o, [0xd7262c, 0x2a67d6]);
    const g = group(
      cyl(0.03, 0.03, 1.9, c, -2),
      cyl(0.03, 0.03, 1.9, c, 2),
      box(4, 0.6, 0.04, c, 0, 1.25),
      box(1.6, 0.3, 0.05, 0xffffff, 0, 1.4),
    );
    return { group: g };
  },
  snowCannon() {
    const g = group(
      box(1.4, 0.3, 1.2, 0x555b62),
      cyl(0.15, 0.2, 2.2, 0x6b7680, 0, 0.3, 0, 8),
    );
    const barrel = cyl(0.55, 0.65, 1.2, 0xf2c21a, 0, 0, 0, 12);
    barrel.position.set(0, 2.8, 0.2);
    barrel.rotation.x = 1.0;
    g.add(barrel);
    const spray = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    spray.position.set(0, 4.3, 2.4);
    spray.rotation.x = -2.1;
    g.add(spray);
    return { group: g };
  },
  iceHut(o) {
    const c = pick(o, [0xd7262c, 0x2a67d6, 0x2fa65a, 0xf2a71b]);
    const g = group(
      box(2.6, 2.2, 2.8, c),
      box(0.8, 1.6, 0.05, 0x3a2a20, 0, 0, 1.41),
      box(0.6, 0.5, 0.05, 0xffd27a, 0.8, 1.2, 1.41, glow(0xffb84a, 0.4)),
      box(0.25, 0.9, 0.25, 0x555555, 0.8, 2.6, -0.8),
    );
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 3.0, 3), lambert(0xf4f8fb));
    roof.rotation.x = -PI / 2;
    roof.scale.z = 0.35;
    roof.position.y = 2.2 + 1.75 * 0.5 * 0.35;
    g.add(roof);
    return { group: g };
  },
  hockeyNet() {
    const red = 0xd7262c;
    const g = group(
      cyl(0.04, 0.04, 1.1, red, -0.9, 0, 0.55, 6),
      cyl(0.04, 0.04, 1.1, red, 0.9, 0, 0.55, 6),
      box(1.85, 0.08, 0.08, red, 0, 1.06, 0.55),
      box(1.85, 0.05, 1.2, 0xeeeeee, 0, 0),
    );
    const net = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    net.position.set(0, 0.55, 0);
    net.rotation.x = 0.9;
    g.add(net);
    return { group: g };
  },
  rock(o) {
    const c = pick(o, [0x8f8a80, 0x9b8b74, 0x7d7a74, 0xb09a7a]);
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), lambert(c));
    r.scale.set(1.1, 0.95, 0.9);
    r.position.y = 1.1;
    r.rotation.set(0.3, pick(o, [0, 1, 2]), 0.2);
    const g = group(r, ball(0.5, 0x6a7a4a, 0.4, 2.0, 0.2, 1.4, 0.35, 1.2));
    return { group: g };
  },
  // ----- statues, ruins, buildings -----
  merlion() {
    const white = 0xf1efe8;
    const g = group(
      cyl(2.4, 2.4, 1.2, 0xa9a59a, 0, 0, 0, 12),
      ball(1.6, white, 0, 2.6, -0.3, 1, 1.3, 1.2),
      ball(0.9, white, 0, 3.1, -1.8, 0.8, 0.8, 1.2),
      cyl(0.9, 1.4, 2.6, white, 0, 3.4, 0.2, 10),
      ball(1.3, white, 0, 6.6, 0.4),
      ball(1.45, 0xe6dfcf, 0, 6.5, 0.1, 1.05, 1.05, 0.9),
      box(1.2, 0.4, 0.9, white, 0, 6.0, 1.3),
    );
    for (let i = 0; i < 8; i++) g.add(ball(0.22, 0x9fd8ff, 0, 6.1 - i * i * 0.08, 1.9 + i * 0.5, 1, 1, 1, glow(0x9fd8ff, 0.3)));
    return { group: g };
  },
  matryoshka(o) {
    const c = pick(o, [0xd21f2c, 0x2a67d6, 0xf2a71b]);
    const g = group(
      ball(1.5, c, 0, 1.55, 0, 1, 1.05, 1),
      ball(1.05, c, 0, 3.35, 0),
      ball(0.72, 0xf6dcc0, 0, 3.4, 0.45, 1, 1, 0.7),
      ball(0.2, 0xe86a7a, -0.35, 3.25, 0.9),
      ball(0.2, 0xe86a7a, 0.35, 3.25, 0.9),
      ball(0.7, 0xf6c21a, 0, 1.4, 1.05, 1, 1.2, 0.6),
      ball(0.35, 0xf2483f, 0, 1.5, 1.4, 1, 1, 0.5),
    );
    return { group: g };
  },
  stoneLantern(o) {
    const s = 0x9a978f;
    const g = group(
      cyl(0.55, 0.6, 0.25, s, 0, 0, 0, 6),
      cyl(0.18, 0.22, 0.85, s, 0, 0.25, 0, 6),
      cyl(0.45, 0.35, 0.18, s, 0, 1.1, 0, 6),
      box(0.55, 0.42, 0.55, 0xffd27a, 0, 1.28, 0, glow(0xffb84a, 0.5)),
      cyl(0.05, 0.6, 0.38, s, 0, 1.7, 0, 6),
      ball(0.12, s, 0, 2.12),
    );
    g.rotation.y = pick(o, [0, 0.3]);
    return { group: g };
  },
  stoneLion() {
    const s = 0xb0a99a;
    const g = group(
      box(1.5, 0.6, 1.5, 0x8d877b),
      ball(0.5, s, 0, 1.05, -0.15, 1, 0.9, 1.2),
      ball(0.45, s, 0, 1.6, 0.2, 1.1, 1, 1),
      ball(0.36, s, 0, 1.6, 0.42),
      ball(0.2, s, 0.3, 0.75, 0.45),
    );
    return { group: g };
  },
  column(o) {
    const m = 0xece6d6;
    const broken = pick(o, [false, false, true]);
    const h = broken ? 5.5 : 8;
    const g = group(
      box(2, 0.5, 2, 0xd9d2c0),
      cyl(0.75, 0.85, h, m, 0, 0.5, 0, 12),
    );
    if (!broken) g.add(box(2, 0.5, 2, 0xd9d2c0, 0, 8.5));
    else {
      const piece = cyl(0.6, 0.85, 1.4, m, 1.6, 0.15, 0.6, 12);
      piece.rotation.z = PI / 2;
      g.add(piece);
    }
    return { group: g };
  },
  obelisk() {
    const s = 0xd6c39a;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.3, 15.5, 4), lambert(s));
    shaft.rotation.y = PI / 4;
    shaft.position.y = 1.2 + 7.75;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.3, 4), lambert(0xe8c46a));
    tip.rotation.y = PI / 4;
    tip.position.y = 1.2 + 15.5 + 0.65;
    return { group: group(box(3.2, 1.2, 3.2, 0xbca988), shaft, tip) };
  },
  fountain(o) {
    const s = 0xd6d0c2;
    const water = 0x6fc3e8;
    const g = group(
      cyl(4.2, 4.2, 0.8, s, 0, 0, 0, 18),
      cyl(3.8, 3.8, 0.1, water, 0, 0.66, 0, 18, glow(water, 0.25)),
      cyl(0.5, 0.7, 1.6, s, 0, 0.7, 0, 8),
      cyl(1.6, 0.6, 0.35, s, 0, 2.0, 0, 12),
      cyl(0.25, 0.3, 0.6, s, 0, 2.3, 0, 8),
    );
    const jet = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.1, 12, 1, true), new THREE.MeshLambertMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    jet.position.y = 2.0;
    jet.userData.keep = true;
    g.add(jet);
    const phase = phaseOf(o);
    return { group: g, update: (t) => { jet.scale.y = 1 + Math.sin(t * 3 + phase) * 0.12; } };
  },
  sphinx() {
    const s = 0xd9b77a;
    const g = group(
      box(3.6, 2.2, 7, s, 0, 0, -1),
      box(1.0, 0.8, 3.2, s, -1.1, 0, 3.2),
      box(1.0, 0.8, 3.2, s, 1.1, 0, 3.2),
      box(2.6, 2.4, 2.2, s, 0, 2.0, 2.1),
      box(1.6, 1.4, 1.2, 0xe3c48a, 0, 2.9, 2.9),
      box(3.2, 1.6, 0.6, 0xc9a465, 0, 2.6, 1.6),
    );
    return { group: g };
  },
  stela(o) {
    const s = pick(o, [0x8d8f7a, 0x9b9480]);
    const g = group(
      box(1.2, 3.8, 0.6, s),
      box(1.0, 0.5, 0.64, 0x6f705e, 0, 0.6),
      box(1.0, 0.5, 0.64, 0x6f705e, 0, 1.7),
      box(1.0, 0.5, 0.64, 0x6f705e, 0, 2.8),
      box(1.4, 0.2, 0.8, 0x7a7b68),
    );
    g.add(ball(0.4, 0x5a6b4a, 0.3, 3.9, 0, 1.2, 0.5, 1)); // moss
    g.rotation.z = pick(o, [0, 0.06, -0.08], 1);
    return { group: g };
  },
  spiritHouse() {
    const gold = 0xe6b93a;
    const g = group(
      cyl(0.12, 0.14, 1.3, 0xe8e2d0),
      box(1.2, 0.08, 1.2, 0xe8e2d0, 0, 1.3),
      box(0.8, 0.6, 0.8, 0xd23a2a, 0, 1.38),
      cone(0.75, 0.9, gold, 0, 1.98, 0, 4),
      cone(0.08, 0.4, gold, 0, 2.2, 0, 4),
    );
    g.children[3].rotation.y = PI / 4;
    for (const [x, z] of [[-0.5, 0.55], [0.5, 0.55]]) g.add(ball(0.12, 0xff9a2e, x, 1.42, z));
    return { group: g };
  },
  torii() {
    const red = 0xe0412a;
    const g = group(
      cyl(0.32, 0.38, 6.5, red, -3.5, 0, 0, 10),
      cyl(0.32, 0.38, 6.5, red, 3.5, 0, 0, 10),
      box(8.6, 0.45, 0.45, red, 0, 5.2),
      box(9.6, 0.5, 0.75, red, 0, 6.4),
      box(9.9, 0.25, 0.85, 0x1b1b1b, 0, 6.9),
      box(0.4, 0.7, 0.3, red, 0, 5.65),
      cyl(0.48, 0.48, 0.4, 0x1b1b1b, -3.5, 0, 0, 10),
      cyl(0.48, 0.48, 0.4, 0x1b1b1b, 3.5, 0, 0, 10),
    );
    return { group: g };
  },
  totem() {
    const cols = [0x2a7a8a, 0xc0392b, 0x1b1b1b, 0xf2a71b, 0x2a7a8a];
    const g = new THREE.Group();
    cols.forEach((c, i) => {
      g.add(cyl(0.7, 0.75, 1.6, c, 0, i * 1.6, 0, 8));
      g.add(ball(0.18, 0xffffff, -0.28, i * 1.6 + 1.05, 0.62));
      g.add(ball(0.18, 0xffffff, 0.28, i * 1.6 + 1.05, 0.62));
      g.add(box(0.5, 0.15, 0.2, 0x1b1b1b, 0, i * 1.6 + 0.45, 0.68));
    });
    g.add(box(3.2, 0.25, 0.6, 0xc0392b, 0, 8.2), ball(0.5, 0xf2a71b, 0, 8.6, 0.2));
    return { group: g };
  },
  tiki(o) {
    const wood = pick(o, [0x7a4a24, 0x5e3a1d]);
    const g = group(
      cyl(0.55, 0.65, 1.8, wood, 0, 0, 0, 8),
      box(1.2, 1.4, 1.0, wood, 0, 1.8),
      box(0.35, 0.25, 0.1, 0xf6f0e0, -0.28, 2.6, 0.5),
      box(0.35, 0.25, 0.1, 0xf6f0e0, 0.28, 2.6, 0.5),
      box(0.8, 0.25, 0.1, 0x2a1a10, 0, 2.0, 0.5),
      box(1.3, 0.2, 1.1, 0x3e7a3a, 0, 3.0),
    );
    return { group: g };
  },
  lighthouse() {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const r0 = 3 - i * 0.2;
      g.add(cyl(r0 - 0.2, r0, 3, i % 2 ? 0xd7262c : 0xf6f6f2, 0, i * 3, 0, 14));
    }
    g.add(cyl(2.4, 2.4, 0.3, 0x2a2a2a, 0, 15, 0, 14));
    g.add(cyl(1.4, 1.4, 1.6, 0xfff2b0, 0, 15.3, 0, 10, glow(0xfff2b0, 0.8)));
    g.add(cone(1.8, 1.2, 0xd7262c, 0, 16.9, 0, 12));
    g.add(box(0.9, 1.8, 0.2, 0x3a2a20, 0, 0, 2.95));
    return { group: g };
  },
  logCabin() {
    const log = 0x8a5a32;
    const g = group(
      box(6, 3.4, 8, log),
      box(6.1, 0.12, 8.1, 0x6e4626, 0, 1.1),
      box(6.1, 0.12, 8.1, 0x6e4626, 0, 2.2),
      box(1.1, 2.0, 0.1, 0x4a2e18, 0, 0, 4.02),
      box(1.0, 0.8, 0.1, 0xffd27a, 1.9, 1.4, 4.02, glow(0xffb84a, 0.4)),
      box(1.0, 0.8, 0.1, 0xffd27a, -1.9, 1.4, 4.02, glow(0xffb84a, 0.4)),
      box(0.8, 2.6, 0.8, 0x8f8a80, 2.0, 3.0, -2.0),
    );
    // Gable roof: a three-sided prism lying along z, apex up.
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(3.81, 3.81, 8.6, 3), lambert(0x4b3b33));
    roof.rotation.x = -PI / 2;
    roof.scale.z = 0.37;
    roof.position.y = 3.4 + 3.81 * 0.5 * 0.37;
    g.add(roof);
    g.add(box(0.7, 0.2, 8.8, 0xf4f8fb, 0, 5.3)); // snow on the ridge
    return { group: g };
  },
  skiLift() {
    const steel = 0x6b7680;
    const g = group(
      cyl(0.35, 0.5, 12, steel, 0, 0, 0, 8),
      box(5, 0.3, 0.3, steel, 0, 11.6),
      ball(0.3, 0x333333, -2.3, 11.5),
      ball(0.3, 0x333333, 2.3, 11.5),
      box(0.05, 2.2, 0.05, 0x333333, 2.3, 9.3),
      box(1.4, 0.15, 0.6, 0xd7262c, 2.3, 9.1, 0.1),
      box(1.4, 0.6, 0.12, 0xd7262c, 2.3, 9.2, -0.2),
    );
    return { group: g };
  },
  snowman(o) {
    const snow = 0xf6f9fc;
    const g = group(
      ball(1.0, snow, 0, 0.9),
      ball(0.72, snow, 0, 2.0),
      ball(0.48, snow, 0, 2.85),
      cyl(0.3, 0.3, 0.45, 0x1b1b1b, 0, 3.15, 0, 10),
      cyl(0.48, 0.48, 0.05, 0x1b1b1b, 0, 3.15, 0, 10),
      box(1.0, 0.18, 0.9, pick(o, [0xd7262c, 0x2a67d6, 0x2fa65a]), 0, 2.5),
      ball(0.06, 0x111111, -0.16, 2.95, 0.43),
      ball(0.06, 0x111111, 0.16, 2.95, 0.43),
    );
    const nose = cone(0.08, 0.4, 0xf08a24, 0, 2.85, 0.45, 6);
    nose.rotation.x = PI / 2;
    nose.position.set(0, 2.85, 0.6);
    g.add(nose);
    return { group: g };
  },

  // ----- animals -----
  camel(o) {
    const sand = 0xc79a5a;
    const { g, neck } = quadruped({ len: 2.0, bodyH: 0.85, legH: 1.25, width: 0.75, color: sand, neckLen: 0.9, neckTilt: 0.35, head: 0.28 });
    g.add(ball(0.45, sand, 0, 2.25, -0.1, 0.9, 0.9, 1.1));
    g.add(box(0.9, 0.12, 1.0, 0xc0392b, 0, 2.05, -0.1));
    return animal(o, g, neck, { graze: 0.25, speed: 0.6 });
  },
  kangaroo(o) {
    const fur = 0xb07a4a;
    const g = new THREE.Group();
    g.add(ball(0.35, fur, 0, 0.35, -0.15, 0.8, 0.9, 1.4));
    const body = ball(0.36, fur, 0, 0.9, 0.05, 0.85, 1.4, 0.8);
    body.rotation.x = 0.35;
    g.add(body);
    const tail = cyl(0.04, 0.12, 1.1, fur, 0, 0, 0, 6);
    tail.position.set(0, 0.25, -0.75);
    tail.rotation.x = -1.3;
    g.add(tail);
    const head = new THREE.Group();
    head.position.set(0, 1.45, 0.2);
    head.add(ball(0.18, fur, 0, 0.05, 0.1, 0.8, 0.9, 1.3));
    head.add(cone(0.06, 0.25, fur, -0.09, 0.15, 0, 4), cone(0.06, 0.25, fur, 0.09, 0.15, 0, 4));
    g.add(head);
    g.add(box(0.1, 0.3, 0.1, fur, -0.15, 0.8, 0.35), box(0.1, 0.3, 0.1, fur, 0.15, 0.8, 0.35));
    const phase = phaseOf(o);
    return { group: g, update: (t) => {
      const hop = Math.max(0, Math.sin(t * 2.2 + phase));
      g.position.y = hop > 0.85 ? (hop - 0.85) * 2 : 0;
      head.rotation.y = Math.sin(t * 0.7 + phase) * 0.4;
    } };
  },
  penguin(o) {
    const { g, head } = bird(0.7, 0x1c1f26, 0xf6f6f2, 0xf08a24);
    const phase = phaseOf(o);
    return { group: g, update: (t) => { g.rotation.z = Math.sin(t * 3 + phase) * 0.08; head.rotation.y = Math.sin(t * 0.8 + phase) * 0.6; } };
  },
  puffin(o) {
    const { g, head } = bird(0.35, 0x1c1f26, 0xf6f6f2, 0xf2602a);
    head.children[0].scale.set(1.1, 1, 1.1);
    const phase = phaseOf(o);
    return { group: g, update: (t) => { head.rotation.x = Math.max(0, Math.sin(t * 1.4 + phase)) * 0.5; } };
  },
  deer(o) {
    const c = 0xb98352;
    const { g, neck } = quadruped({ len: 1.1, bodyH: 0.5, legH: 0.8, width: 0.45, color: c, neckLen: 0.45, neckTilt: 0.4, head: 0.16 });
    for (const s of [-1, 1]) {
      const a = cyl(0.02, 0.03, 0.35, 0x5b3c22, s * 0.08, 0.62, 0.05, 4);
      a.rotation.z = -s * 0.4;
      neck.add(a);
    }
    for (const [x, z] of [[0.12, 0.2], [-0.1, -0.1], [0.08, -0.3]]) g.add(ball(0.05, 0xf6efe0, x, 1.25, z));
    return animal(o, g, neck, { graze: 0.9, speed: 0.5 });
  },
  moose(o) {
    const c = 0x4a3324;
    const { g, neck } = quadruped({ len: 2.0, bodyH: 0.9, legH: 1.1, width: 0.85, color: c, legColor: 0x6a5240, neckLen: 0.5, neckTilt: 0.9, head: 0.3 });
    for (const s of [-1, 1]) {
      const a = box(0.75, 0.08, 0.45, 0xd8c6a0, s * 0.55, 0.75, 0.1);
      a.rotation.z = -s * 0.35;
      neck.add(a);
    }
    return animal(o, g, neck, { graze: 0.6, speed: 0.4 });
  },
  bear(o) {
    const c = pick(o, [0x4a3324, 0x2a2420, 0x6a4a2e]);
    const { g, neck } = quadruped({ len: 1.5, bodyH: 0.8, legH: 0.45, width: 0.9, color: c, neckLen: 0.2, neckTilt: 1.2, head: 0.3, tail: 0 });
    neck.add(ball(0.09, c, -0.18, 0.5, 0.05), ball(0.09, c, 0.18, 0.5, 0.05), ball(0.1, 0x8a6a4a, 0, 0.24, 0.45));
    return animal(o, g, neck, { graze: 0.4, speed: 0.7 });
  },
  panda(o) {
    const g = group(
      ball(0.6, 0xf6f6f2, 0, 0.6, 0, 1, 1.05, 0.9),
      ball(0.5, 0x1b1b1b, 0, 0.75, 0, 1.12, 0.35, 1),
      ball(0.18, 0x1b1b1b, -0.4, 0.15, 0.4),
      ball(0.18, 0x1b1b1b, 0.4, 0.15, 0.4),
    );
    const head = new THREE.Group();
    head.position.set(0, 1.12, 0.05);
    head.add(ball(0.36, 0xf6f6f2), ball(0.11, 0x1b1b1b, -0.25, 0.27, 0), ball(0.11, 0x1b1b1b, 0.25, 0.27, 0));
    head.add(ball(0.09, 0x1b1b1b, -0.13, 0.04, 0.3, 1, 1.3, 0.5), ball(0.09, 0x1b1b1b, 0.13, 0.04, 0.3, 1, 1.3, 0.5));
    g.add(head);
    const bamboo = cyl(0.04, 0.04, 0.9, 0x6aa84f, 0.35, 0.5, 0.35, 5);
    bamboo.rotation.z = 0.5;
    g.add(bamboo);
    const phase = phaseOf(o);
    return { group: g, update: (t) => { head.rotation.z = Math.sin(t * 1.1 + phase) * 0.12; head.rotation.x = Math.sin(t * 2.2 + phase) * 0.06; } };
  },
  elephant(o) {
    const c = 0x8e8a86;
    const { g, neck } = quadruped({ len: 2.7, bodyH: 1.7, legH: 1.0, width: 1.8, color: c, neckLen: 0.2, neckTilt: 0.2, head: 0.75 });
    for (const s of [-1, 1]) {
      const ear = ball(0.6, 0x9b9590, s * 0.7, 0.4, 0, 0.2, 1, 0.9);
      neck.add(ear);
    }
    const trunk = new THREE.Group();
    trunk.position.set(0, 0.25, 0.9);
    const tm = cyl(0.12, 0.22, 1.4, c, 0, -1.4, 0, 6);
    trunk.add(tm);
    neck.add(trunk);
    for (const s of [-1, 1]) {
      const tusk = cone(0.07, 0.6, 0xf6f0e0, s * 0.3, -0.2, 0.75, 5);
      tusk.rotation.x = 1.2;
      neck.add(tusk);
    }
    if (pick(o, [true, false])) g.add(box(1.6, 0.1, 1.4, 0xc0392b, 0, 2.7, 0), box(1.62, 0.12, 1.42, 0xf2c230, 0, 2.62, 0));
    const phase = phaseOf(o);
    return { group: g, update: (t) => { trunk.rotation.x = Math.sin(t * 0.9 + phase) * 0.25; neck.rotation.y = Math.sin(t * 0.3 + phase) * 0.15; } };
  },
  otter(o) {
    const c = 0x6b4a32;
    const g = group(
      ball(0.18, c, 0, 0.16, 0, 0.9, 0.85, 2),
      ball(0.13, c, 0, 0.26, 0.38),
      ball(0.09, 0xc8a888, 0, 0.22, 0.48, 1, 0.8, 0.8),
    );
    const tail = cone(0.07, 0.35, c, 0, 0.08, -0.5, 5);
    tail.rotation.x = -PI / 2;
    g.add(tail);
    const phase = phaseOf(o);
    return { group: g, update: (t) => { g.rotation.y = Math.sin(t * 0.6 + phase) * 0.6; g.position.y = Math.max(0, Math.sin(t * 1.8 + phase)) * 0.05; } };
  },
  cat(o) {
    const c = pick(o, [0xf2a14a, 0x2a2a2a, 0xf6f6f2, 0x8a8a8a, 0xb07a4a]);
    const g = group(
      ball(0.13, c, 0, 0.13, -0.02, 1, 1.1, 1.3),
      ball(0.09, c, 0, 0.3, 0.08),
      cone(0.035, 0.07, c, -0.05, 0.36, 0.08, 4),
      cone(0.035, 0.07, c, 0.05, 0.36, 0.08, 4),
    );
    const tail = new THREE.Group();
    tail.position.set(0, 0.06, -0.16);
    const tm = cyl(0.018, 0.022, 0.22, c, 0, 0, 0, 4);
    tail.add(tm);
    tail.rotation.x = -0.5;
    g.add(tail);
    const phase = phaseOf(o);
    return { group: g, update: (t) => { tail.rotation.z = Math.sin(t * 2.5 + phase) * 0.6; } };
  },
  horse(o) {
    const c = pick(o, [0x7a4a2a, 0xd9c7a8, 0x3a2a20, 0xa8a8a8]);
    const { g, neck } = quadruped({ len: 1.55, bodyH: 0.65, legH: 0.75, width: 0.6, color: c, neckLen: 0.55, neckTilt: 0.5, head: 0.2, tail: 0.6 });
    neck.add(box(0.08, 0.6, 0.18, 0xe8e0d0, 0, 0.05, -0.12));
    return animal(o, g, neck, { graze: 1.0, speed: 0.45 });
  },
  cow(o) {
    const { g, neck } = quadruped({ len: 1.8, bodyH: 0.8, legH: 0.7, width: 0.8, color: 0xf6f6f2, legColor: 0xf6f6f2, neckLen: 0.3, neckTilt: 0.9, head: 0.24, headColor: 0x2a2a2a });
    g.add(ball(0.32, 0x2a2a2a, 0.25, 1.35, 0.2, 1, 0.6, 1.4), ball(0.25, 0x2a2a2a, -0.25, 1.15, -0.4, 1, 0.8, 1.2));
    neck.add(cone(0.05, 0.18, 0xe8e0c8, -0.16, 0.48, 0.05, 4), cone(0.05, 0.18, 0xe8e0c8, 0.16, 0.48, 0.05, 4));
    const bell = ball(0.08, 0xd8b030, 0, 0.0, 0.2);
    neck.add(bell);
    return animal(o, g, neck, { graze: 0.8, speed: 0.4 });
  },
  sealion(o) {
    const c = 0x5a4632;
    const g = new THREE.Group();
    g.add(ball(0.5, c, 0, 0.3, -0.3, 1, 0.6, 1.8));
    const upper = new THREE.Group();
    upper.position.set(0, 0.35, 0.3);
    upper.add(ball(0.35, c, 0, 0.3, 0, 1, 1.5, 0.9));
    upper.add(ball(0.2, c, 0, 0.8, 0.12, 1, 0.9, 1.3));
    upper.add(ball(0.05, 0x111111, 0, 0.8, 0.37));
    g.add(upper);
    for (const s of [-1, 1]) g.add(box(0.5, 0.06, 0.25, c, s * 0.4, 0, 0.45));
    const phase = phaseOf(o);
    return { group: g, update: (t) => { upper.rotation.x = -0.25 + Math.sin(t * 1.2 + phase) * 0.2; } };
  },
  monkey(o) {
    const c = 0x8a6a4a;
    const g = group(
      ball(0.22, c, 0, 0.28, 0, 1, 1.2, 0.9),
      ball(0.15, c, 0, 0.6, 0.03),
      ball(0.1, 0xe6c8a0, 0, 0.58, 0.12, 1, 0.9, 0.6),
      ball(0.05, 0xe6c8a0, -0.15, 0.62, 0),
      ball(0.05, 0xe6c8a0, 0.15, 0.62, 0),
    );
    const tail = cyl(0.025, 0.03, 0.6, c, 0, 0, 0, 4);
    tail.position.set(0, 0.1, -0.2);
    tail.rotation.x = -1.2;
    g.add(tail);
    const phase = phaseOf(o);
    return { group: g, update: (t) => { g.rotation.y = Math.sin(t * 0.9 + phase) * 0.7; } };
  },
  turtle(o) {
    const g = group(
      ball(0.55, 0x4a6a3a, 0, 0.05, 0, 1, 0.55, 1.2),
      ball(0.15, 0x7a9a6a, 0, 0.15, 0.7),
    );
    for (const [x, z] of [[-0.5, 0.35], [0.5, 0.35], [-0.4, -0.45], [0.4, -0.45]]) g.add(ball(0.16, 0x7a9a6a, x, 0.06, z, 1.4, 0.3, 0.8));
    const head = g.children[1];
    head.userData.keep = true;
    const phase = phaseOf(o);
    return { group: g, update: (t) => { head.position.z = 0.7 + Math.sin(t * 0.5 + phase) * 0.05; } };
  },
  pigeon(o) {
    const c = pick(o, [0x8a8f9a, 0x6f7480, 0xb0b4bc]);
    const g = group(
      ball(0.12, c, 0, 0.15, 0, 0.9, 0.8, 1.3),
      box(0.12, 0.02, 0.18, 0x5a5f6a, 0, 0.14, -0.2),
    );
    const head = new THREE.Group();
    head.position.set(0, 0.24, 0.1);
    head.add(ball(0.065, 0x5f6a7a), cone(0.02, 0.06, 0x333333, 0, -0.01, 0.07, 4));
    head.children[1].rotation.x = PI / 2;
    g.add(head);
    const phase = phaseOf(o);
    return { group: g, update: (t) => { head.rotation.x = Math.max(0, Math.sin(t * 4 + phase)) * 0.7; g.rotation.y = Math.sin(t * 0.5 + phase) * 1.2; } };
  },
  peacock(o) {
    const g = group(
      ball(0.22, 0x1d4fa8, 0, 0.45, 0, 1, 1.1, 1.4),
      cyl(0.06, 0.09, 0.4, 0x1d4fa8, 0, 0.55, 0.22, 6),
      ball(0.08, 0x1d4fa8, 0, 0.98, 0.26),
      box(0.03, 0.03, 0.2, 0x555555, -0.06, 0, 0),
      box(0.03, 0.3, 0.03, 0x555555, -0.06, 0, 0),
      box(0.03, 0.3, 0.03, 0x555555, 0.06, 0, 0),
    );
    const fan = new THREE.Group();
    fan.position.set(0, 0.45, -0.3);
    const fanMesh = new THREE.Mesh(new THREE.CircleGeometry(0.8, 14, 0, PI), lambert(0x1f8a6a, { side: THREE.DoubleSide }));
    fanMesh.rotation.y = 0;
    fan.add(fanMesh);
    for (let i = 0; i < 7; i++) {
      const a = (i + 0.5) / 7 * PI;
      fan.add(ball(0.06, 0x2a3fa0, Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.01, 1, 1, 0.3));
    }
    fan.rotation.x = -0.25;
    g.add(fan);
    const phase = phaseOf(o);
    return { group: g, update: (t) => { fan.rotation.z = Math.sin(t * 6 + phase) * 0.03; fan.scale.setScalar(0.92 + Math.max(0, Math.sin(t * 0.3 + phase)) * 0.1); } };
  },
};

// Shared idle loop for four-legged animals: look around, dip the head to graze now and then.
function animal(o, g, neck, { graze = 0.6, speed = 0.5 }) {
  const phase = phaseOf(o);
  const base = neck.rotation.x;
  const tail = g.userData.tail;
  return {
    group: g,
    update(t) {
      const cycle = Math.sin(t * speed * 0.6 + phase);
      neck.rotation.x = base + Math.max(0, cycle) * graze;
      neck.rotation.y = Math.sin(t * speed + phase * 2) * 0.25;
      if (tail) tail.rotation.z = Math.sin(t * 3 + phase) * 0.3;
    },
  };
}

// Build one obstacle instance ({ type, x, z, yaw, scale }). Returns { group, update? } or null.
export function buildObstacle(o) {
  const make = MODELS[o.type];
  if (!make) return null;
  const model = make(o);
  model.group.name = `obstacle:${o.type}`;
  if (model.update) compactRig(model.group);
  return model;
}

// Animated rigs: merge the plain meshes under each joint by material, keeping the joints
// (neck, tail, head groups) and any mesh an animation moves on its own (userData.keep).
function compactRig(node) {
  const buckets = new Map();
  for (const c of [...node.children]) {
    if (c.isMesh && !c.children.length && !c.userData.keep) {
      if (!buckets.has(c.material)) buckets.set(c.material, []);
      buckets.get(c.material).push(c);
    } else if (!c.isMesh) {
      compactRig(c);
    }
  }
  for (const [material, meshes] of buckets) {
    if (meshes.length < 2) continue;
    for (const m of meshes) {
      m.updateMatrix();
      node.remove(m);
    }
    node.add(new THREE.Mesh(bakeGeometry(meshes, (m) => m.matrix), material));
  }
}

export const OBSTACLE_MODEL_TYPES = Object.keys(MODELS);
