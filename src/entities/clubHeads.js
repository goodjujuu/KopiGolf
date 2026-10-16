import * as THREE from 'three';
import { CLUB_DESIGNS, ironOutline } from './clubDesigns.js';

// 3D club heads built from the shared designs (entities/clubDesigns.js), so the club in your
// hands matches the art in the club picker.
//
// Head frame: origin = bottom of the shaft. +x runs out to the toe (the heel and hosel are at
// the shaft), y is up with the sole at SOLE_Y, −z faces the target (you look at the back).
// Each head reports `sweetX`, how far toward the toe its sweet spot sits, so it can be set up
// with the sweet spot right behind the ball.

export const SOLE_Y = -0.0225;
const UNIT = 0.1; // metres per head unit (heads are drawn a touch larger than life to read on a phone)

// Metal parts take the Locker head finish; `dark` parts (wedges) take a darkened version of it.
export function createHeadMaterials() {
  const phong = (color) => new THREE.MeshPhongMaterial({ color, specular: 0x99a4ad, shininess: 60, flatShading: true });
  return {
    metal: phong(0xd5dbe2),
    dark: phong(0x2c313b),
    cavity: new THREE.MeshLambertMaterial({ color: 0xb9c0cc }),
    white: new THREE.MeshLambertMaterial({ color: 0xffffff }),
    red: new THREE.MeshLambertMaterial({ color: 0xe0412a }),
  };
}

export function buildHead(id, mats) {
  const d = CLUB_DESIGNS[id];
  if (!d) return null;
  if (d.style === 'wood') return woodHead(d, mats);
  if (d.style === 'putter') return putterHead(mats);
  return ironHead(d, mats);
}

function shapeFrom(commands, offsetU = 0) {
  const shape = new THREE.Shape();
  for (const [c, ...n] of commands) {
    const p = n.map((v, i) => (i % 2 === 0 ? (v + offsetU) * UNIT : v * UNIT));
    if (c === 'M') shape.moveTo(p[0], p[1]);
    else if (c === 'L') shape.lineTo(p[0], p[1]);
    else if (c === 'Q') shape.quadraticCurveTo(p[0], p[1], p[2], p[3]);
  }
  return shape;
}

// Text / badge decal painted on the back of a head.
function decal(draw, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = Math.round((128 * h) / w);
  const ctx = canvas.getContext('2d');
  draw(ctx, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 })
  );
}

const FONT = '"Lilita One", "Arial Rounded MT Bold", sans-serif';

function ironHead(d, mats) {
  const wedge = d.style === 'wedge';
  const depth = d.style === 'cavity' ? 0.026 : wedge ? 0.022 : 0.019;
  const group = new THREE.Group();
  // Lofted holder hinged on the leading edge of the sole: the back of the head leans toward you.
  const loft = new THREE.Group();
  loft.position.y = SOLE_Y;
  loft.rotation.x = (d.loft * Math.PI) / 180 * 0.75;
  group.add(loft);

  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shapeFrom(ironOutline(d), 0.02), { depth, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 6 }),
    wedge ? mats.dark : mats.metal
  );
  body.position.z = -depth / 2;
  loft.add(body);
  const back = depth / 2 + 0.0025;
  const len = d.len * UNIT;
  const midX = (d.len * 0.55 + 0.02) * UNIT;

  if (d.style === 'blade') {
    // Polished muscle across the lower back, number stamped on the toe.
    const muscle = new THREE.Mesh(new THREE.BoxGeometry(len * 0.8, 0.012, 0.006), mats.metal);
    muscle.position.set(midX, 0.018, back);
    loft.add(muscle);
    const num = decal((ctx, w, h) => {
      ctx.fillStyle = '#3a3f4c';
      ctx.font = `${h * 0.8}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.num, w / 2, h / 2);
    }, 0.026, 0.026);
    num.position.set((d.len * 0.82) * UNIT, d.toeH * UNIT * 0.45, back + 0.001);
    loft.add(num);
  } else if (d.style === 'cavity') {
    // Cavity panel following the topline, with the coloured number badge.
    const top = (u) => d.heelH + ((u - 0.1) / (d.len - 0.3)) * (d.toeH - d.heelH) - 0.08;
    const u0 = 0.13;
    const u1 = d.len - 0.17;
    const cav = new THREE.Shape();
    cav.moveTo((u0 + 0.02) * UNIT, 0.13 * UNIT);
    cav.lineTo((u1 + 0.02) * UNIT, 0.13 * UNIT);
    cav.lineTo((u1 + 0.02) * UNIT, top(u1) * UNIT);
    cav.lineTo((u0 + 0.02) * UNIT, top(u0) * UNIT);
    const panel = new THREE.Mesh(new THREE.ShapeGeometry(cav), mats.cavity);
    panel.position.z = back - 0.001;
    loft.add(panel);
    const badgeColour = `#${d.badge.toString(16).padStart(6, '0')}`;
    const badge = decal((ctx, w, h) => {
      ctx.fillStyle = badgeColour;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `${h * 0.78}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.num, w / 2, h / 2 + h * 0.04);
    }, 0.03, 0.024);
    const bu = d.len * 0.58;
    badge.position.set((bu + 0.02) * UNIT, ((0.13 + top(bu)) / 2) * UNIT, back + 0.0005);
    loft.add(badge);
  } else {
    // Wedge: loft stamped on the toe, wide bounce flange along the sole for the sand wedge.
    const flange = new THREE.Mesh(new THREE.BoxGeometry(len * 0.82, d.sole * UNIT * 0.6, 0.01), mats.dark);
    flange.position.set(midX, d.sole * UNIT * 0.3, back);
    loft.add(flange);
    const stamp = decal((ctx, w, h) => {
      ctx.fillStyle = '#c9cfda';
      ctx.font = `${h * 0.62}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${d.num}°`, w / 2, h / 2);
    }, 0.04, 0.022);
    stamp.position.set((d.len * 0.64) * UNIT, d.toeH * UNIT * 0.52, back + 0.001);
    loft.add(stamp);
  }

  // Hosel up into the shaft.
  const hosel = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.009, 0.05, 8), wedge ? mats.dark : mats.metal);
  hosel.position.set(0.004, SOLE_Y + 0.038, 0);
  hosel.rotation.z = 0.3;
  group.add(hosel);
  return { group, sweetX: (d.len * 0.5 + 0.02) * UNIT };
}

function woodHead(d, mats) {
  const k = d.size;
  const group = new THREE.Group();
  const rx = 0.06 * k;
  const ry = 0.028 * k;
  const rz = 0.052 * k;
  const cx = rx * 0.95;
  const cy = SOLE_Y + ry;
  const crownMat = new THREE.MeshPhongMaterial({ color: d.crown, specular: 0xffffff, shininess: 90, flatShading: false });
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), crownMat);
  crown.scale.set(rx, ry * 1.05, rz);
  crown.position.set(cx, cy, 0);
  const sole = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mats.metal);
  sole.scale.set(rx, ry, rz);
  sole.position.set(cx, cy, 0);
  // Flat-ish face toward the target.
  const face = new THREE.Mesh(new THREE.BoxGeometry(rx * 1.5, ry * 1.6, 0.004), mats.metal);
  face.position.set(cx, cy, -rz * 0.86);
  group.add(crown, sole, face);
  // Alignment mark on the crown: a chevron on the driver, twin stripes on the fairway wood.
  const accent = new THREE.MeshLambertMaterial({ color: d.accent });
  if (d.label === 'D') {
    for (const s of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, 0.016), accent);
      bar.position.set(cx + s * 0.004, cy + ry * 0.93, -rz * 0.6);
      bar.rotation.y = s * 0.6;
      group.add(bar);
    }
  } else {
    for (const s of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.002, rz * 1.5), accent);
      stripe.position.set(cx + s * 0.005, cy + ry * 0.92, 0);
      group.add(stripe);
    }
  }
  const hosel = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.01, 0.04, 8), mats.dark);
  hosel.position.set(0.006, SOLE_Y + 0.04, 0);
  hosel.rotation.z = 0.3;
  group.add(hosel);
  return { group, sweetX: cx };
}

function putterHead(mats) {
  const group = new THREE.Group();
  const w = 0.12;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 0.03), mats.metal);
  const cx = w / 2 + 0.008;
  blade.position.set(cx, SOLE_Y + 0.015, 0);
  const topLine = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.002, 0.01), mats.white);
  topLine.position.set(cx, SOLE_Y + 0.031, 0.006);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.0025, 0.026), mats.red);
  sight.position.set(cx, SOLE_Y + 0.0315, 0);
  // Plumber's neck: up from the heel, a little jog, then into the shaft.
  const neck1 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8), mats.metal);
  neck1.position.set(0.02, SOLE_Y + 0.045, -0.006);
  const neck2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.008), mats.metal);
  neck2.position.set(0.011, SOLE_Y + 0.06, -0.006);
  group.add(blade, topLine, sight, neck1, neck2);
  return { group, sweetX: cx };
}
