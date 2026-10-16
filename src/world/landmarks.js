import * as THREE from 'three';
import { lambert } from './materials.js';

// Low-poly landmarks built from simple shapes, roughly at real-world size in metres.
// Each builder returns { group, update?(time) }. The front of a landmark faces +z; the course
// builder turns it to face the tee. buildLandmark(type, variant) picks the right one.

const PI = Math.PI;
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 12, open = false, t0 = 0, tl = PI * 2) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open, t0, tl);
const cone = (r, h, s = 12) => new THREE.ConeGeometry(r, h, s);
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);

function part(group, geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, opts) {
  const m = new THREE.Mesh(geo, opts ? new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }) : lambert(color));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  group.add(m);
  return m;
}

// Line segment as a thin cylinder (cables, struts).
function strut(group, a, b, radius, color) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(cyl(radius, radius, len, 5), lambert(color));
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  group.add(m);
  return m;
}

// Onion dome: a stretched sphere with a little spike.
function onion(group, r, color, x, y, z) {
  const d = part(group, sph(r, 12, 10), color, x, y + r * 0.9, z);
  d.scale.set(1, 1.25, 1);
  part(group, cone(r * 0.25, r * 1.1, 6), 0xd9a93a, x, y + r * 2.6, z);
}

// Triangular prism (a gable roof or pediment) sitting on yBase, ridge along x (or z).
function prism(group, width, height, length, color, x, yBase, z, alongZ = false) {
  const geo = cyl(1, 1, length, 3).rotateZ(PI / 2).rotateX(-PI / 2); // apex up, ridge along x
  geo.scale(1, height / 1.5, width / 2 / 0.866);
  geo.translate(0, (0.5 * height) / 1.5, 0);
  if (alongZ) geo.rotateY(PI / 2);
  return part(group, geo, color, x, yBase, z);
}

// ---------- towers ----------
function eiffel() {
  const g = new THREE.Group();
  const c = 0x6b5a46;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    part(g, box(9, 120, 9), c, sx * 31, 55, sz * 31, -sz * 0.26, 0, sx * 0.26);
  }
  part(g, box(72, 6, 72), c, 0, 58, 0);
  part(g, cyl(15, 27, 62, 4), c, 0, 92, 0, 0, PI / 4, 0);
  part(g, box(40, 4, 40), c, 0, 124, 0);
  part(g, cyl(3, 14, 150, 4), c, 0, 200, 0, 0, PI / 4, 0);
  part(g, box(8, 10, 8), c, 0, 278, 0);
  part(g, cyl(0.8, 1.2, 40), c, 0, 302, 0);
  return { group: g };
}

function tokyoTower() {
  const g = new THREE.Group();
  const red = 0xe0482c;
  const white = 0xf2f2ee;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    part(g, box(8, 130, 8), red, sx * 30, 60, sz * 30, -sz * 0.24, 0, sx * 0.24);
  }
  part(g, box(64, 10, 64), white, 0, 125, 0);
  const bands = [[22, 16, 40, red], [16, 12, 30, white], [12, 8, 30, red], [8, 5, 30, white], [5, 2, 30, red]];
  let y = 130;
  for (const [rb, rt, h, col] of bands) {
    part(g, cyl(rt, rb, h, 4), col, 0, y + h / 2, 0, 0, PI / 4, 0);
    y += h;
  }
  part(g, box(24, 6, 24), white, 0, 225, 0);
  part(g, cyl(1, 1.5, 60), white, 0, y + 30, 0);
  return { group: g };
}

function needle(variant = 'cn') {
  const g = new THREE.Group();
  if (variant === 'cn') {
    const c = 0xd8d4cc;
    part(g, cyl(6, 15, 340, 6), c, 0, 170, 0);
    part(g, cyl(22, 18, 20, 18), 0x8a8f96, 0, 345, 0);
    part(g, new THREE.TorusGeometry(21, 3, 6, 20), c, 0, 334, 0, PI / 2);
    part(g, cyl(7, 7, 12, 10), 0x8a8f96, 0, 446, 0);
    part(g, cyl(1.5, 4, 110), c, 0, 500, 0);
  } else if (variant === 'space') {
    const c = 0xf2f2ee;
    part(g, cyl(4, 4, 160, 8), c, 0, 80, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      const foot = new THREE.Vector3(Math.cos(a) * 22, 0, Math.sin(a) * 22);
      const waist = new THREE.Vector3(Math.cos(a) * 6, 70, Math.sin(a) * 6);
      const top = new THREE.Vector3(Math.cos(a) * 12, 150, Math.sin(a) * 12);
      strut(g, foot, waist, 2.2, c);
      strut(g, waist, top, 2.2, c);
    }
    part(g, cyl(30, 14, 12, 24), 0xd9d9d0, 0, 156, 0);
    part(g, cone(28, 10, 24), 0xe08a3c, 0, 168, 0);
    part(g, cyl(0.8, 1.2, 30), c, 0, 188, 0);
  } else if (variant === 'berlin') {
    part(g, cyl(5, 9, 200, 10), 0xd8d4cc, 0, 100, 0);
    part(g, sph(17, 16, 12), 0xc8ccd2, 0, 210, 0);
    for (let i = 0; i < 5; i++) part(g, cyl(1.6, 2, 26), i % 2 ? 0xffffff : 0xd23c3c, 0, 240 + i * 26, 0);
  } else {
    // Seoul: tower on a wooded hill
    const hill = part(g, sph(140, 14, 8), 0x4f7a3a, 0, -40, 0);
    hill.scale.set(1, 0.65, 1);
    part(g, cyl(4, 7, 140, 8), 0xf2f2ee, 0, 115, 0);
    part(g, cyl(16, 12, 14, 16), 0xd9d9d0, 0, 190, 0);
    part(g, cyl(1, 2, 60), 0xf2f2ee, 0, 225, 0);
  }
  return { group: g };
}

function bigBen() {
  const g = new THREE.Group();
  const stone = 0xc9b48a;
  part(g, box(14, 70, 14), stone, 0, 35, 0);
  part(g, box(16, 14, 16), stone, 0, 77, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2;
    const face = part(g, new THREE.CircleGeometry(5.5, 20), 0xf4f0e0, Math.sin(a) * 8.05, 77, Math.cos(a) * 8.05, 0, a, 0);
    face.material = new THREE.MeshLambertMaterial({ color: 0xf4f0e0, side: THREE.DoubleSide });
  }
  part(g, box(12, 10, 12), stone, 0, 89, 0);
  part(g, cone(10, 24, 4), 0x5a5a4e, 0, 106, 0, 0, PI / 4, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, cone(1.5, 8, 4), stone, sx * 6, 98, sz * 6);
  // Houses of Parliament
  part(g, box(170, 24, 26), stone, -100, 12, 0);
  for (let x = -175; x <= -25; x += 18) part(g, cone(2, 9, 4), stone, x, 28, 10);
  part(g, box(20, 64, 20), stone, -190, 32, 0);
  return { group: g };
}

function londonEye() {
  const g = new THREE.Group();
  const wheel = new THREE.Group();
  wheel.position.y = 72;
  g.add(wheel);
  part(wheel, new THREE.TorusGeometry(60, 1.4, 6, 48), 0xe8ecf0);
  part(wheel, new THREE.TorusGeometry(57, 0.6, 4, 48), 0xc8ccd2);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * PI * 2;
    strut(wheel, new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 60, Math.sin(a) * 60, 0), 0.35, 0xc8ccd2);
  }
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * PI * 2;
    part(wheel, sph(2.6, 8, 6), 0xbfe0f0, Math.cos(a) * 62, Math.sin(a) * 62, 2);
  }
  part(wheel, cyl(3, 3, 8, 10), 0xc8ccd2, 0, 0, 0, PI / 2);
  strut(g, new THREE.Vector3(-30, 0, -40), new THREE.Vector3(0, 72, -3), 1.8, 0xe8ecf0);
  strut(g, new THREE.Vector3(30, 0, -40), new THREE.Vector3(0, 72, -3), 1.8, 0xe8ecf0);
  return { group: g, update(t) { wheel.rotation.z = t * 0.03; } };
}

function empireState() {
  const g = new THREE.Group();
  const c = 0xb9b2a6;
  const tiers = [[60, 100, 42], [48, 90, 34], [40, 90, 28], [28, 60, 22], [16, 30, 14]];
  let y = 0;
  for (const [w, h, d] of tiers) { part(g, box(w, h, d), c, 0, y + h / 2, 0); y += h; }
  part(g, cyl(3, 6, 22, 8), c, 0, y + 11, 0);
  part(g, cyl(1, 2, 50, 6), c, 0, y + 45, 0);
  return { group: g };
}

function burj() {
  const g = new THREE.Group();
  const c = 0xb9c6d2;
  const radii = [40, 34, 29, 24, 20, 16, 12, 9, 6];
  let y = 0;
  radii.forEach((r, i) => {
    const h = 90 - i * 4;
    part(g, cyl(r * 0.85, r, h, 6), c, (i % 2 ? 3 : -3), y + h / 2, 0, 0, i * 0.2, 0);
    y += h;
  });
  part(g, cyl(1, 5, 180, 6), c, 0, y + 90, 0);
  return { group: g };
}

function mbs() {
  const g = new THREE.Group();
  const c = 0xd6dde4;
  for (const x of [-75, 0, 75]) {
    part(g, box(16, 195, 42), c, x - 9, 97, 0, 0, 0, 0.07);
    part(g, box(16, 195, 42), c, x + 9, 97, 0, 0, 0, -0.07);
  }
  part(g, box(340, 10, 40), 0xc0c8d0, 20, 200, 0);
  part(g, box(200, 18, 60), 0xc8ced4, 0, 9, 40);
  return { group: g };
}

function supertrees() {
  const g = new THREE.Group();
  const caps = [0xb05ad8, 0x2fb5b0, 0xe08a3c, 0x7a4fd1, 0xe070b0, 0x3fa7e0];
  for (let i = 0; i < 7; i++) {
    const a = i * 2.1;
    const r = 15 + i * 9;
    const h = 25 + ((i * 37) % 25);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    part(g, cyl(1.5, 3.2, h, 8), 0x6a3fa0, x, h / 2, z);
    part(g, cyl(13, 3, 8, 14, true), caps[i % caps.length], x, h + 2, z, 0, 0, 0, { side: THREE.DoubleSide });
  }
  return { group: g };
}

function petronas() {
  const g = new THREE.Group();
  const c = 0xc7cdd4;
  for (const x of [-46, 46]) {
    const tiers = [[24, 140], [21, 100], [18, 70], [14, 50], [10, 40], [6, 30]];
    let y = 0;
    for (const [r, h] of tiers) { part(g, cyl(r * 0.95, r, h, 8), c, x, y + h / 2, 0, 0, PI / 8, 0); y += h; }
    part(g, cyl(0.6, 2, 70, 6), c, x, y + 35, 0);
  }
  part(g, box(70, 6, 7), 0xa8b0b8, 0, 170, 0);
  return { group: g };
}

// ---------- ancient ----------
function pyramids() {
  const g = new THREE.Group();
  const c = 0xd9bf86;
  for (const [r, h, x, z] of [[162, 139, 0, 0], [152, 136, 250, -210], [74, 65, 430, -390]]) {
    part(g, cone(r, h, 4), c, x, h / 2, z, 0, PI / 4, 0);
  }
  return { group: g };
}

function stepPyramid() {
  const g = new THREE.Group();
  const c = 0xb8ab90;
  for (let i = 0; i < 9; i++) {
    const w = 56 - i * 4.4;
    part(g, box(w, 2.7, w), i % 2 ? c : 0xa89a80, 0, i * 2.7 + 1.35, 0);
  }
  part(g, box(13, 7, 13), c, 0, 27.8, 0);
  part(g, box(9, 24.5, 32), 0x9a8c72, 0, 12, 18, -0.75, 0, 0);
  return { group: g };
}

function colosseum() {
  const g = new THREE.Group();
  const c = 0xd4c19a;
  const outer = part(g, cyl(80, 80, 40, 44, true), c, 0, 20, 0, 0, 0, 0, { side: THREE.DoubleSide });
  outer.scale.z = 0.82;
  const ruin = part(g, cyl(80, 80, 12, 44, true, 0, PI * 1.15), c, 0, 46, 0, 0, 0, 0, { side: THREE.DoubleSide });
  ruin.scale.z = 0.82;
  const inner = part(g, cyl(62, 62, 30, 40, true), 0xc4b08a, 0, 15, 0, 0, 0, 0, { side: THREE.DoubleSide });
  inner.scale.z = 0.8;
  // Rows of dark arches round the outside.
  const archGeo = box(4, 7, 1);
  const archMat = lambert(0x5a4a36);
  const arches = new THREE.InstancedMesh(archGeo, archMat, 44 * 3);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * PI * 2;
      const x = Math.cos(a) * 80.6;
      const z = Math.sin(a) * 80.6 * 0.82;
      m.makeRotationY(-a + PI / 2).setPosition(x, 7 + row * 12, z);
      arches.setMatrixAt(k++, m);
    }
  }
  g.add(arches);
  return { group: g };
}

function pisa() {
  const g = new THREE.Group();
  const tower = new THREE.Group();
  tower.rotation.z = 0.07;
  g.add(tower);
  const c = 0xf2ede0;
  part(tower, cyl(8, 8.4, 11, 18), c, 0, 5.5, 0);
  for (let i = 0; i < 6; i++) {
    part(tower, cyl(7.6, 7.6, 6.5, 18), c, 0, 11 + i * 7 + 3.25, 0);
    part(tower, new THREE.TorusGeometry(8, 0.5, 4, 18), 0xd8d0be, 0, 11 + i * 7, 0, PI / 2);
  }
  part(tower, cyl(5.6, 6, 7, 16), c, 0, 57, 0);
  // Cathedral alongside
  part(g, box(32, 26, 90), c, -60, 13, -20);
  prism(g, 32, 9, 90, 0xb85a3a, -60, 26, -20, true);
  part(g, new THREE.SphereGeometry(10, 14, 8, 0, PI * 2, 0, PI / 2), 0xb85a3a, -60, 32, -20);
  return { group: g };
}

function parthenon() {
  const g = new THREE.Group();
  const hill = part(g, cyl(110, 170, 45, 10), 0xb8a684, 0, 22.5, 0);
  hill.scale.z = 0.7;
  const top = 45;
  const marble = 0xe8e0cc;
  for (let i = 0; i < 3; i++) part(g, box(72 - i * 3, 1.6, 34 - i * 3), marble, 0, top + 0.8 + i * 1.6, 0);
  const base = top + 4.8;
  const colGeo = cyl(1, 1.15, 10.5, 8);
  const cols = new THREE.InstancedMesh(colGeo, lambert(marble), 2 * 8 + 2 * 13);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i < 8; i++) for (const z of [-13, 13]) cols.setMatrixAt(k++, m.makeTranslation(-28 + i * 8, base + 5.25, z));
  for (let i = 0; i < 13; i++) for (const x of [-28, 28]) cols.setMatrixAt(k++, m.makeTranslation(x, base + 5.25, -11 + i * (22 / 12)));
  g.add(cols);
  part(g, box(62, 3.5, 30), marble, 0, base + 12.2, 0);
  prism(g, 30, 5, 62, marble, 0, base + 13.95, 0);
  return { group: g };
}

// ---------- domes, temples, spires ----------
function taj() {
  const g = new THREE.Group();
  const w = 0xf4f1ea;
  part(g, box(100, 7, 100), w, 0, 3.5, 0);
  part(g, box(56, 30, 56), w, 0, 22, 0);
  part(g, cyl(16, 16, 9, 20), w, 0, 41.5, 0);
  const dome = part(g, sph(20, 20, 14), w, 0, 52, 0);
  dome.scale.y = 1.35;
  part(g, cone(2.5, 14, 8), 0xd9a93a, 0, 85, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    part(g, cyl(4, 4, 7, 10), w, sx * 20, 40.5, sz * 20);
    part(g, sph(4.6, 10, 8), w, sx * 20, 46, sz * 20);
    part(g, cyl(2.4, 3.2, 46, 10), w, sx * 46, 30, sz * 46);
    part(g, sph(3.4, 10, 8), w, sx * 46, 55, sz * 46);
  }
  return { group: g };
}

function mosque() {
  const g = new THREE.Group();
  const stone = 0xdcd8d0;
  const lead = 0x8f979e;
  part(g, box(72, 24, 72), stone, 0, 12, 0);
  part(g, cyl(20, 22, 8, 20), stone, 0, 28, 0);
  part(g, new THREE.SphereGeometry(22, 20, 10, 0, PI * 2, 0, PI / 2), lead, 0, 32, 0);
  part(g, cone(1.6, 8, 6), 0xd9a93a, 0, 58, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2;
    part(g, new THREE.SphereGeometry(12, 14, 8, 0, PI * 2, 0, PI / 2), lead, Math.cos(a) * 22, 24, Math.sin(a) * 22);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + PI / 6;
    const x = Math.cos(a) * 58;
    const z = Math.sin(a) * 50;
    part(g, cyl(2, 2.6, 62, 10), stone, x, 31, z);
    part(g, cone(2.8, 12, 10), lead, x, 68, z);
  }
  return { group: g };
}

function stBasil() {
  const g = new THREE.Group();
  part(g, box(62, 16, 62), 0xa8432c, 0, 8, 0);
  part(g, cyl(9, 11, 34, 8), 0xc8452c, 0, 33, 0);
  part(g, cone(9, 34, 8), 0xe8c040, 0, 67, 0);
  onion(g, 4, 0xd9a93a, 0, 84, 0);
  const cols = [0x3a8f5a, 0x3a6fd8, 0xe8c040, 0xc8452c, 0x2fb5b0, 0xe07a3a, 0x7a4fd1, 0x3a8f5a];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    const r = i % 2 ? 24 : 20;
    const h = i % 2 ? 22 : 30;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    part(g, cyl(5, 6, h, 8), i % 2 ? 0xf0e6d2 : 0xc8452c, x, 16 + h / 2, z);
    onion(g, i % 2 ? 6 : 7, cols[i], x, 16 + h, z);
  }
  return { group: g };
}

function pagoda() {
  const g = new THREE.Group();
  let y = 0;
  for (let i = 0; i < 5; i++) {
    const w = 15 - i * 1.8;
    const h = 6.5 - i * 0.4;
    part(g, box(w, h, w), 0x8a2c22, 0, y + h / 2, 0);
    part(g, cone(w * 0.95, 3.2, 4), 0x3a3a3a, 0, y + h + 1.2, 0, 0, PI / 4, 0);
    y += h + 1.4;
  }
  part(g, cyl(0.5, 0.9, 13, 6), 0xd9a93a, 0, y + 6.5, 0);
  return { group: g };
}

function templeHeaven() {
  const g = new THREE.Group();
  const marble = 0xf2f0ea;
  for (let i = 0; i < 3; i++) part(g, cyl(58 - i * 10, 60 - i * 10, 3, 32), marble, 0, 1.5 + i * 3, 0);
  let y = 9;
  for (const [r, h, roof] of [[15, 12, 20], [12, 8, 16], [9, 7, 12]]) {
    part(g, cyl(r, r, h, 20), 0xb8352a, 0, y + h / 2, 0);
    part(g, cone(roof, 7, 20), 0x2a4fa0, 0, y + h + 3.5, 0);
    y += h + 5;
  }
  part(g, sph(2.2, 10, 8), 0xd9a93a, 0, y + 3, 0);
  return { group: g };
}

function torii() {
  const g = new THREE.Group();
  const red = 0xd8402a;
  for (const x of [-4.5, 4.5]) {
    part(g, cyl(0.6, 0.75, 10, 10), red, x, 5, 0);
    part(g, cyl(0.9, 0.9, 1, 10), 0x222222, x, 0.5, 0);
  }
  part(g, box(13.5, 0.9, 1.2), 0x222222, 0, 10.6, 0);
  part(g, box(12.5, 0.7, 1), red, 0, 10, 0);
  part(g, box(11, 0.6, 0.8), red, 0, 8.6, 0);
  g.scale.setScalar(1.6);
  return { group: g };
}

function watArun() {
  const g = new THREE.Group();
  const buildPrang = (scale, x, z) => {
    const tiers = [[22, 10], [18, 12], [14, 14], [10, 16], [6, 14], [3, 10]];
    let y = 0;
    tiers.forEach(([r, h], i) => {
      part(g, cyl(r * 0.8 * scale, r * scale, h * scale, 8), i % 2 ? 0xe8e2d4 : 0xd9a07a, x, y + (h * scale) / 2, z);
      y += h * scale;
    });
    part(g, cone(1.6 * scale, 14 * scale, 8), 0xd9a93a, x, y + 7 * scale, z);
  };
  buildPrang(1, 0, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) buildPrang(0.42, sx * 40, sz * 40);
  return { group: g };
}

function sagrada() {
  const g = new THREE.Group();
  const stone = 0xc9b48a;
  part(g, box(60, 32, 92), stone, 0, 16, 0);
  const spires = [[-14, 30, 110], [-5, 30, 120], [5, 30, 120], [14, 30, 110], [-14, -30, 105], [-5, -30, 112], [5, -30, 112], [14, -30, 105], [0, 0, 172], [0, 18, 130], [12, -4, 125], [-12, -4, 125]];
  const tops = [0xe0482c, 0xe8c040, 0x3a8f5a, 0xf2f2ee];
  spires.forEach(([x, z, h], i) => {
    part(g, cyl(2.4, 5.5, h, 8), stone, x, h / 2, z);
    part(g, sph(3.4, 8, 6), tops[i % tops.length], x, h + 2, z);
  });
  return { group: g };
}

function hallgrims() {
  const g = new THREE.Group();
  const c = 0xd9dde0;
  part(g, box(13, 74, 13), c, 0, 37, 0);
  part(g, cone(7, 18, 4), c, 0, 83, 0, 0, PI / 4, 0);
  for (let i = 1; i <= 6; i++) {
    const h = 66 - i * 9;
    for (const side of [-1, 1]) part(g, box(4.5, h, 11), c, side * (5 + i * 4.5), h / 2, 0);
  }
  part(g, box(22, 22, 55), c, 0, 11, -30);
  return { group: g };
}

function brandenburg() {
  const g = new THREE.Group();
  const s = 0xd8c8a0;
  part(g, box(66, 2, 14), s, 0, 1, 0);
  for (let i = 0; i < 6; i++) part(g, cyl(1.7, 1.7, 16, 10), s, -27 + i * 10.8, 10, 0);
  part(g, box(68, 7, 15), s, 0, 21.5, 0);
  part(g, box(30, 5, 13), s, 0, 27.5, 0);
  part(g, box(9, 5, 6), 0x4a6a5a, 0, 32.5, 0);
  return { group: g };
}

function koutoubia() {
  const g = new THREE.Group();
  const c = 0xc2774a;
  part(g, box(64, 12, 84), 0xd09a6e, 0, 6, -55);
  part(g, box(13, 62, 13), c, 0, 31, 0);
  part(g, box(7, 12, 7), c, 0, 68, 0);
  part(g, sph(3, 10, 8), 0x3a8f5a, 0, 75, 0);
  for (let i = 0; i < 3; i++) part(g, sph(1.4 - i * 0.3, 8, 6), 0xd9a93a, 0, 79 + i * 2.6, 0);
  return { group: g };
}

function campanile() {
  const g = new THREE.Group();
  part(g, box(12, 58, 12), 0xb0553a, 0, 29, 0);
  part(g, box(12.5, 10, 12.5), 0xeee6d6, 0, 63, 0);
  part(g, box(10, 8, 10), 0xb0553a, 0, 72, 0);
  part(g, cone(8, 22, 4), 0x6aa38a, 0, 87, 0, 0, PI / 4, 0);
  part(g, sph(1.2, 8, 6), 0xd9a93a, 0, 99, 0);
  part(g, box(72, 25, 32), 0xeec9b8, -60, 12.5, 10);
  return { group: g };
}

function opera() {
  const g = new THREE.Group();
  part(g, box(190, 7, 110), 0xd8cbb2, 0, 3.5, 0);
  const white = 0xf6f5f0;
  const shells = [[-50, 34, 0.9], [-25, 40, 1], [0, 34, 0.85], [40, 30, 0.8], [62, 26, 0.7], [82, 20, 0.6]];
  shells.forEach(([x, r, k], i) => {
    for (const z of [-18, 18]) {
      const shell = part(g, new THREE.SphereGeometry(r, 14, 8, 0, PI, 0, PI / 2), white, x, 7, z * (i < 3 ? 1 : 0.4), 0, PI / 2, 0);
      shell.scale.set(0.55 * k, 1.2 * k, 1);
      shell.material = new THREE.MeshLambertMaterial({ color: white, flatShading: true, side: THREE.DoubleSide });
    }
  });
  return { group: g };
}

// ---------- bridges ----------
function harbourBridge() {
  const g = new THREE.Group();
  const steel = 0x7d8590;
  const arch = part(g, new THREE.TorusGeometry(250, 4.5, 6, 40, PI), steel, 0, -110, 0);
  arch.scale.set(1, 0.95, 1);
  part(g, box(620, 5, 20), steel, 0, 50, 0);
  for (const x of [-280, 280]) {
    part(g, box(26, 90, 34), 0xc9b48a, x, 45, 0);
  }
  for (let x = -225; x <= 225; x += 25) {
    const yArch = -110 + Math.sqrt(Math.max(0, 250 * 250 - x * x)) * 0.95;
    if (yArch > 52) strut(g, new THREE.Vector3(x, 52, 0), new THREE.Vector3(x, yArch, 0), 0.8, steel);
  }
  return { group: g };
}

function goldenGate() {
  const g = new THREE.Group();
  const red = 0xc0362c;
  const deckY = 68;
  for (const x of [-330, 330]) {
    for (const z of [-13, 13]) part(g, box(9, 230, 9), red, x, 115, z);
    for (const y of [90, 150, 215]) part(g, box(9, 7, 30), red, x, y, 0);
  }
  part(g, box(980, 7, 28), red, 0, deckY, 0);
  const cableY = (x) => {
    const ax = Math.abs(x);
    if (ax <= 330) return 80 + (ax / 330) ** 2 * 145;
    return 225 - ((ax - 330) / 160) * 150;
  };
  for (const z of [-13, 13]) {
    let prev = null;
    for (let x = -490; x <= 490; x += 35) {
      const p = new THREE.Vector3(x, cableY(x), z);
      if (prev) strut(g, prev, p, 1.1, red);
      prev = p;
      if (Math.abs(x) < 320 && x % 70 === 0) strut(g, new THREE.Vector3(x, deckY + 3, z), p, 0.35, red);
    }
  }
  return { group: g };
}

// ---------- towns, mills, clusters ----------
function windmills() {
  const g = new THREE.Group();
  const rotors = [];
  const tulips = [0xe0482c, 0xf2c84b, 0xe070b0, 0xf08a3c, 0xffffff, 0x9b59d0];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 70;
    part(g, cyl(4, 7, 22, 8), 0x4a3a2e, x, 11, 0);
    part(g, cone(5.5, 7, 8), 0x2f3a2e, x, 25.5, 0);
    const rotor = new THREE.Group();
    rotor.position.set(x, 23, 6);
    for (let b = 0; b < 4; b++) {
      const blade = part(rotor, box(2.8, 26, 0.4), 0xf2ede0, 0, 0, 0, 0, 0, (b / 4) * PI * 2);
      blade.geometry = box(2.8, 26, 0.4).translate(0, 13, 0);
    }
    g.add(rotor);
    rotors.push(rotor);
  }
  for (let r = 0; r < 8; r++) part(g, box(200, 0.5, 5), tulips[r % tulips.length], 0, 0.25, 30 + r * 7);
  return { group: g, update(t) { rotors.forEach((ro, i) => { ro.rotation.z = t * 0.4 + i; }); } };
}

function canalHouses() {
  const g = new THREE.Group();
  const cols = [0x8a3a2a, 0x2f4a6a, 0x3a6a4a, 0x6a4a2a, 0xd8c8a8, 0x9a5a3a, 0x2a3a4a];
  for (let i = 0; i < 12; i++) {
    const h = 14 + ((i * 7) % 6);
    const x = (i - 5.5) * 8;
    part(g, box(7.5, h, 11), cols[i % cols.length], x, h / 2, 0);
    prism(g, 7.5, 4, 11, 0x3a3a3a, x, h, 0, true);
  }
  return { group: g };
}

function chalets() {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const x = (i % 4) * 26 - 40;
    const z = Math.floor(i / 4) * 30;
    part(g, box(11, 7, 9), 0x8a5a3a, x, 3.5, z);
    prism(g, 9, 4, 13, 0xf2f6fa, x, 7, z);
  }
  return { group: g };
}

function hkTowers() {
  const g = new THREE.Group();
  // Angular glass tower
  let y = 0;
  for (const [r, h] of [[34, 110], [28, 90], [20, 70], [12, 40]]) { part(g, cyl(r * 0.8, r, h, 4), 0x5d7488, -70, y + h / 2, 0, 0, PI / 4, 0); y += h; }
  part(g, cyl(0.8, 1.6, 50, 4), 0xc8ccd2, -70, y + 25, 0);
  // Tall slim tower with a crown
  part(g, box(44, 400, 44), 0x8fa3b8, 60, 200, -40);
  part(g, box(30, 20, 30), 0xb7c4cf, 60, 410, -40);
  part(g, box(52, 300, 40), 0x6f8296, 160, 150, 30);
  return { group: g };
}

function vegas() {
  const g = new THREE.Group();
  part(g, cone(95, 105, 4), 0x22262c, 0, 52.5, 0, 0, PI / 4, 0);
  const beam = part(g, cyl(1.2, 1.2, 700, 6), 0xfff4c0, 0, 455, 0, 0, 0, 0, { emissive: 0xfff4c0, emissiveIntensity: 0.6, transparent: true, opacity: 0.5 });
  beam.userData.nightOnly = true;
  part(g, sph(55, 20, 14), 0x3a4fd8, 220, 55, -80, 0, 0, 0, { emissive: 0x3a4fd8, emissiveIntensity: 0.25 });
  for (const [x, z, h, col] of [[-180, -40, 170, 0xd9a93a], [-260, 20, 140, 0xf2f2ee], [-120, -120, 190, 0xf2f2ee], [320, 40, 150, 0x8fa3b8]]) {
    for (let k = 0; k < 3; k++) part(g, box(16, h - k * 20, 50), col, x + Math.cos(k * 2.1) * 18, (h - k * 20) / 2, z + Math.sin(k * 2.1) * 18, 0, k * 2.1, 0);
  }
  const eye = londonEye();
  eye.group.position.set(120, 0, 120);
  eye.group.scale.setScalar(0.9);
  g.add(eye.group);
  return { group: g, update: eye.update };
}

// ---------- mountains ----------
function mountain(variant = 'peak') {
  const g = new THREE.Group();
  const snow = 0xf4f8fb;
  const snowCap = (r, h, segs, y, color = snow) => part(g, cone(r, h, segs), color, 0, y, 0);
  switch (variant) {
    case 'fuji':
      part(g, cone(900, 620, 18), 0x5a6b84, 0, 310, 0);
      snowCap(330, 228, 18, 620 - 114);
      break;
    case 'matterhorn': {
      const rock = part(g, cone(400, 820, 5), 0x7f858c, 0, 410, 0, 0, 0.3, 0.06);
      rock.scale.x = 0.85;
      const cap = part(g, cone(200, 410, 5), snow, 0, 615, 0, 0, 0.3, 0.06);
      cap.scale.x = 0.85;
      cap.position.x = 18;
      break;
    }
    case 'rainier':
      part(g, cone(1100, 520, 14), 0x6b7a8f, 0, 260, 0);
      snowCap(600, 284, 14, 520 - 142);
      break;
    case 'table': {
      part(g, cyl(640, 820, 320, 12), 0x7d7a62, 0, 160, 0);
      const cloth = part(g, sph(600, 16, 6), 0xffffff, 0, 330, 0, 0, 0, 0, { transparent: true, opacity: 0.85 });
      cloth.scale.y = 0.06;
      break;
    }
    case 'sugarloaf': {
      const dome = part(g, sph(170, 12, 10), 0x6f7f5f, 0, 60, 0);
      dome.scale.y = 1.7;
      break;
    }
    case 'corcovado': {
      part(g, cone(360, 430, 10), 0x4f7a3a, 0, 215, 0);
      const statue = new THREE.Group();
      statue.position.y = 425;
      statue.scale.setScalar(2.2);
      part(statue, cyl(3, 5.5, 30, 8), 0xe8e4dc, 0, 15, 0);
      part(statue, box(28, 4, 4), 0xe8e4dc, 0, 26, 0);
      part(statue, sph(3, 10, 8), 0xe8e4dc, 0, 33, 0);
      g.add(statue);
      break;
    }
    case 'diamond': {
      part(g, cyl(520, 760, 170, 16), 0x8a8a5a, 0, 85, 0);
      part(g, cyl(380, 380, 4, 16), 0x6f7046, 0, 168, 0);
      break;
    }
    case 'range': {
      const peaks = [[-700, 0, 520, 480], [-250, -150, 650, 560], [250, -60, 600, 520], [700, 80, 480, 430], [0, -400, 700, 600]];
      for (const [x, z, r, h] of peaks) {
        part(g, cone(r, h, 7), 0x7f858c, x, h / 2, z, 0, x * 0.01, 0);
        part(g, cone(r * 0.36, h * 0.36, 7), snow, x, h - h * 0.18, z, 0, x * 0.01, 0);
      }
      break;
    }
    case 'peak':
    default:
      part(g, cone(500, 320, 9), 0x5f7f45, 0, 160, 0);
  }
  return { group: g };
}

const BUILDERS = {
  eiffel, tokyoTower, needle, bigBen, londonEye, empireState, burj, mbs, supertrees, petronas,
  pyramids, stepPyramid, colosseum, pisa, parthenon, taj, mosque, stBasil, pagoda, templeHeaven,
  torii, watArun, sagrada, hallgrims, brandenburg, koutoubia, campanile, opera, harbourBridge,
  goldenGate, windmills, canalHouses, chalets, hkTowers, vegas, mountain,
};
export const LANDMARK_TYPES = Object.keys(BUILDERS);

export function buildLandmark(type, variant) {
  const builder = BUILDERS[type];
  if (!builder) return { group: new THREE.Group() };
  return builder(variant);
}
