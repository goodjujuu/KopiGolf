import * as THREE from 'three';
import { THEMES, SURFACE } from '../config.js';
import { holeLength, holeAimYaw } from '../courses/catalog.js';
import { lambert } from './materials.js';
import { makePalm } from './palm.js';

// Turns a hole's data into a low-poly 3D world built from primitives, so the first 100+ holes
// need no 3D modelling. Hand-made models can replace individual pieces later.

const HILL_SPREAD = 1.6; // mounds are squashed spheres, wider than tall
const HILL_SINK = 0.45;  // fraction of the radius buried below ground

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

// Visible radius of a mound where it meets the ground (used by the overhead map too).
export function hillFootprint(r) {
  return r * HILL_SPREAD * Math.sqrt(1 - HILL_SINK * HILL_SINK);
}

export function buildWorld(hole) {
  const theme = THEMES[hole.theme];
  const group = new THREE.Group();
  group.name = `world:${hole.id}`;
  const animated = [];

  group.add(makeWater(theme));
  group.add(makeIsland(hole, theme));
  group.add(makeFairway(hole, theme));
  group.add(makeGreen(hole, theme));
  group.add(makeFlag(hole, theme));
  for (const h of hole.hills) group.add(makeHill(h, theme.hill));
  for (const h of hole.farIslands) group.add(makeFarIsland(h, theme));
  for (const m of hole.teeMarkers) group.add(makeTeeLog(m, theme));
  for (const p of hole.palms) {
    const palm = makePalm(p, terrainHeight(p[0], p[1], hole.hills), theme);
    group.add(palm.group);
    animated.push(palm);
  }

  group.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });

  return {
    group,
    theme,
    update(time) { for (const a of animated) a.update(time); },
    dispose() { group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); },
  };
}

// ---------- pieces ----------

function makeWater(theme) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshLambertMaterial({ color: theme.water, emissive: theme.water, emissiveIntensity: 0.25 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.6;
  return mesh;
}

function makeIsland(hole, theme) {
  const g = new THREE.Group();
  const [cx, , cz] = hole.island.center;
  const r = hole.island.radius;

  const sand = new THREE.Mesh(new THREE.CylinderGeometry(r + 5, r + 8, 2, 48), lambert(theme.sand));
  sand.position.set(cx, -1.25, cz); // top face at y = −0.25, just above the water
  g.add(sand);

  const grass = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 1.5, 2, 48), lambert(theme.rough));
  grass.position.set(cx, -1 + SURFACE.rough, cz); // top face at y = 0
  g.add(grass);
  return g;
}

// A stadium shape (rectangle with round ends) running from behind the tee to past the pin.
function makeFairway(hole, theme) {
  const w = hole.fairwayWidth;
  const len = holeLength(hole) + 12;
  const r = w / 2;
  const h = len / 2 - r;
  const shape = new THREE.Shape();
  shape.absarc(0, h, r, 0, Math.PI, false);
  shape.absarc(0, -h, r, Math.PI, Math.PI * 2, false);
  shape.closePath();

  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 16), lambert(theme.fairway));
  mesh.rotation.x = -Math.PI / 2; // shape +y → world −z

  const holder = new THREE.Group();
  holder.position.set((hole.tee[0] + hole.pin[0]) / 2, SURFACE.fairway, (hole.tee[2] + hole.pin[2]) / 2);
  holder.rotation.y = holeAimYaw(hole);
  holder.add(mesh);
  return holder;
}

function makeGreen(hole, theme) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(hole.greenRadius, 36), lambert(theme.green));
  disc.rotation.x = -Math.PI / 2;
  disc.scale.set(1.4, 1, 1); // oval greens read better from the tee
  disc.position.set(hole.pin[0], SURFACE.green, hole.pin[2]);
  g.add(disc);

  const cup = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), new THREE.MeshBasicMaterial({ color: 0x1d2a1a }));
  cup.rotation.x = -Math.PI / 2;
  cup.position.set(hole.pin[0], SURFACE.green + 0.01, hole.pin[2]);
  g.add(cup);
  return g;
}

function makeFlag(hole, theme) {
  const g = new THREE.Group();
  g.position.set(hole.pin[0], SURFACE.green, hole.pin[2]);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), lambert(0xffffff));
  pole.position.y = 1.2;
  g.add(pole);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.02), lambert(theme.flag));
  cloth.position.set(0.39, 2.15, 0);
  g.add(cloth);
  return g;
}

function makeHill([x, z, r], color) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), lambert(color));
  mesh.position.set(x, -r * HILL_SINK, z);
  mesh.scale.set(HILL_SPREAD, 1, HILL_SPREAD);
  return mesh;
}

function makeFarIsland([x, z, r], theme) {
  const g = new THREE.Group();
  g.add(makeHill([x, z, r], theme.hill));
  const beach = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.55, r * 1.65, 1, 24), lambert(theme.sand));
  beach.position.set(x, -0.45, z);
  g.add(beach);
  return g;
}

// The little wooden stumps either side of the ball in the reference screenshot.
function makeTeeLog([x, z], theme) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 7), lambert(theme.wood));
  mesh.position.set(x, 0.07, z);
  mesh.rotation.set(0.2, 0.3 * Math.sign(x), Math.PI / 2.3);
  mesh.castShadow = true;
  return mesh;
}
