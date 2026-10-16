import * as THREE from 'three';
import { SURFACE } from '../config.js';
import { BIOMES } from '../courses/biomes.js';
import { surfaceAt, groundHeight, GREEN_STRETCH } from '../physics/course.js';
import { seaDistance, seededRandom } from '../courses/generate.js';
import { lambert, bakeGeometry } from './materials.js';
import { buildTrees } from './trees.js';
import { buildSkyline } from './skyline.js';
import { buildLandmark } from './landmarks.js';
import { buildObstacle } from './obstacles.js';

// Builds a World Tour course from its hole data: a vertex-coloured heightfield for the ground,
// flat overlays for fairway / green / bunkers / ponds / cart path, instanced trees, props,
// the city skyline, landmarks and mountains, plus snowfall and birds for atmosphere.

const PI = Math.PI;

export function buildCourse(hole) {
  const biome = BIOMES[hole.biome];
  const group = new THREE.Group();
  group.name = `course:${hole.id}`;
  const animated = [];
  const nightLights = [];
  const heightAt = (x, z) => groundHeight(hole, x, z);

  // ---------- sea ----------
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 9000),
    new THREE.MeshLambertMaterial({ color: biome.water, emissive: biome.water, emissiveIntensity: 0.25 })
  );
  water.rotation.x = -PI / 2;
  water.position.y = -0.6;
  group.add(water);

  // ---------- ground ----------
  group.add(buildGround(hole, biome));

  // ---------- overlays ----------
  group.add(buildFairway(hole, biome));
  const tee = new THREE.Mesh(new THREE.BoxGeometry(10, 0.1, 7), lambert(biome.tee));
  tee.position.set(hole.tee[0], 0.04, hole.tee[2] + 1.5);
  group.add(tee);
  for (const side of [-1, 1]) {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), lambert(0xf2483f));
    marker.position.set(side * 3, 0.15, -0.6);
    group.add(marker);
  }
  group.add(buildGreen(hole, biome));
  for (const b of hole.bunkers) group.add(ellipse(b, biome.lip, SURFACE.bunker - 0.006, 0.9), ellipse(b, biome.bunker, SURFACE.bunker, 0));
  // Ponds and rivers sit just above the fairway (they can cut across it) but under the green.
  const waterMat = new THREE.MeshLambertMaterial({ color: biome.water, emissive: biome.water, emissiveIntensity: 0.25, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide });
  const bankMat = overlayMaterial(biome.lip, -2.5);
  bankMat.side = THREE.DoubleSide;
  for (const p of hole.ponds) {
    group.add(ellipse(p, biome.lip, 0.04, 1.5, bankMat));
    group.add(ellipse(p, biome.water, 0.046, 0, waterMat));
  }
  if (hole.islandLand) {
    group.add(ellipse(hole.islandLand, biome.lip, 0.047, 1.2, overlayMaterial(biome.lip, -3.5)));
    group.add(ellipse(hole.islandLand, biome.fairway, 0.048, 0, overlayMaterial(biome.fairway, -4)));
  }
  group.add(buildCartPath(hole.cartPath, biome));
  for (const r of hole.rivers ?? []) {
    group.add(ribbon(r.points, r.width + 3, 0.04, bankMat));
    group.add(ribbon(r.points, r.width, 0.046, waterMat));
  }

  // ---------- city obstacles ----------
  // Static ones (buses, statues, walls…) are merged into one mesh per material to keep draw
  // calls low on phones; animated animals stay as their own little rigs.
  const statics = new THREE.Group();
  for (const o of hole.obstacles ?? []) {
    const model = buildObstacle(o);
    if (!model) continue;
    const holder = new THREE.Group();
    holder.position.set(o.x, heightAt(o.x, o.z), o.z);
    holder.rotation.y = o.yaw;
    holder.scale.setScalar(o.scale);
    holder.add(model.group);
    if (model.update) {
      group.add(holder);
      animated.push(model.update);
    } else {
      statics.add(holder);
    }
  }
  const merged = mergeByMaterial(statics);
  group.add(merged);
  group.traverse((m) => {
    if (m.isMesh && m.name?.startsWith('obstacle') && m.material?.emissive && m.material.emissiveIntensity > 0.2) {
      m.userData.dayGlow = m.material.emissiveIntensity * 0.5; // neon still shows by day, brighter at night
      nightLights.push(m);
    }
  });

  // ---------- props ----------
  for (const [type, x, z, yawDeg] of hole.props) {
    const prop = type === 'bench' ? bench() : lampPost(nightLights);
    prop.position.set(x, heightAt(x, z), z);
    prop.rotation.y = (yawDeg * PI) / 180;
    group.add(prop);
  }

  // ---------- trees, skyline, landmarks ----------
  group.add(buildTrees(hole.trees, biome, heightAt));
  const skyline = hole.buildings?.length ? buildSkyline(hole.buildings, hole.buildingStyle, heightAt) : null;
  if (skyline) group.add(skyline.mesh);
  for (const l of hole.landmarks) {
    const lm = buildLandmark(l.type, l.variant);
    lm.group.position.set(l.x, l.type === 'mountain' ? -2 : Math.min(0, heightAt(l.x, l.z)), l.z);
    lm.group.rotation.y = l.yaw;
    lm.group.scale.multiplyScalar(l.scale);
    lm.group.traverse((o) => { if (o.userData.nightOnly) nightLights.push(o); });
    group.add(lm.group);
    if (lm.update) animated.push(lm.update);
  }

  // ---------- atmosphere ----------
  const birds = buildBirds(hole);
  group.add(birds.group);
  animated.push(birds.update);
  let snow = null;
  if (biome.snowfall) {
    snow = buildSnow();
    group.add(snow.points);
  }

  return {
    group,
    theme: { ...biome, flag: 0xf2483f },
    fogScale: { near: 4, far: 7.5 },
    update(time, cameraPos) {
      for (const fn of animated) fn(time);
      snow?.update(time, cameraPos);
    },
    setWaterGlow(v) {
      water.material.emissiveIntensity = v;
    },
    setNightGlow(v) {
      skyline?.setWindowGlow(v);
      for (const o of nightLights) {
        if (o.userData.nightOnly) o.visible = v > 0.5;
        if (o.material?.emissive) o.material.emissiveIntensity = o.userData.nightOnly ? 0.6 : Math.max(o.userData.dayGlow ?? 0, v * 1.2);
      }
    },
    dispose() {
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    },
  };
}

// ---------- ground heightfield ----------
function buildGround(hole, biome) {
  const size = Math.min(5200, (hole.bounds.r + 1500) * 2);
  const segs = 220;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-PI / 2);
  geo.translate(hole.bounds.x, 0, hole.bounds.z);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const rough = new THREE.Color(biome.rough);
  const hill = new THREE.Color(biome.hill);
  const beach = new THREE.Color(biome.beach);
  const seabed = new THREE.Color(biome.beach).multiplyScalar(0.75);
  const rand = seededRandom(`${hole.id}:ground`);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    let y;
    let s = surfaceAt(hole, x, z);
    if (hole.sea && seaDistance(hole.sea, x, z) > 0) {
      y = -0.9 - Math.min(6, seaDistance(hole.sea, x, z) * 0.05);
      c.copy(seabed);
    } else if (s === 'sand' && hole.sea && seaDistance(hole.sea, x, z) > -hole.sea.beach) {
      y = groundHeight(hole, x, z, s);
      c.copy(beach);
    } else {
      // Overlays (fairway, green, bunker, pond) sit on flat ground at 0.
      if (s === 'fairway' || s === 'green' || s === 'bunker' || s === 'water') s = 'rough';
      y = groundHeight(hole, x, z, s);
      c.copy(rough).lerp(hill, Math.min(1, y / 14));
    }
    // A touch of per-vertex variation gives the faceted low-poly look.
    const v = 0.94 + rand() * 0.1;
    c.multiplyScalar(v);
    pos.setY(i, y);
    colours.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

// ---------- overlays ----------
function overlayMaterial(color, offset = -1) {
  return new THREE.MeshLambertMaterial({ color, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset });
}

function buildFairway(hole, biome) {
  const g = new THREE.Group();
  const mat = overlayMaterial(biome.fairway, -1);
  const stripeMat = overlayMaterial(new THREE.Color(biome.fairway).multiplyScalar(0.94).getHex(), -1.5);
  const { points, width } = hole.fairway;
  const r = width / 2;
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r, 28).rotateX(-PI / 2), mat);
    cap.position.set(x, SURFACE.fairway, z);
    cap.receiveShadow = true;
    g.add(cap);
    if (i === 0) continue;
    const [px, pz] = points[i - 1];
    const len = Math.hypot(x - px, z - pz);
    const yaw = Math.atan2(-(x - px), -(z - pz));
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(width, len).rotateX(-PI / 2), mat);
    seg.position.set((x + px) / 2, SURFACE.fairway, (z + pz) / 2);
    seg.rotation.y = yaw;
    seg.receiveShadow = true;
    g.add(seg);
    // Mowing stripes across the fairway.
    for (let d = 6; d < len - 6; d += 16) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.92, 8).rotateX(-PI / 2), stripeMat);
      const t = d / len;
      stripe.position.set(px + (x - px) * t, SURFACE.fairway + 0.004, pz + (z - pz) * t);
      stripe.rotation.y = yaw;
      g.add(stripe);
    }
  }
  return g;
}

function buildGreen(hole, biome) {
  const g = new THREE.Group();
  const [px, , pz] = hole.pin;
  const fringe = new THREE.Mesh(new THREE.CircleGeometry(hole.greenRadius + 1.6, 40).rotateX(-PI / 2), overlayMaterial(biome.fairway, -5));
  fringe.scale.set(GREEN_STRETCH, 1, 1);
  fringe.position.set(px, SURFACE.green - 0.01, pz);
  const green = new THREE.Mesh(new THREE.CircleGeometry(hole.greenRadius, 40).rotateX(-PI / 2), overlayMaterial(biome.green, -6));
  green.scale.set(GREEN_STRETCH, 1, 1);
  green.position.set(px, SURFACE.green, pz);
  green.receiveShadow = true;
  const cup = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0x1d2a1a }));
  cup.position.set(px, SURFACE.green + 0.01, pz);
  g.add(fringe, green, cup);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), lambert(0xffffff));
  pole.position.set(px, SURFACE.green + 1.2, pz);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.02), lambert(0xf2483f));
  cloth.position.set(px + 0.39, SURFACE.green + 2.15, pz);
  g.add(pole, cloth);
  return g;
}

// A flat ellipse ({ x, z, rx, rz, yaw }), optionally grown by `grow` metres (for lips and banks).
function ellipse(e, color, y, grow, material) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-PI / 2), material ?? overlayMaterial(color, grow ? -1 : -2));
  m.scale.set(e.rx + grow, 1, e.rz + grow);
  const holder = new THREE.Group();
  holder.position.set(e.x, y, e.z);
  holder.rotation.y = e.yaw;
  holder.add(m);
  m.receiveShadow = true;
  return holder;
}

// Bake a group of meshes into one mesh per material.
function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse((m) => {
    if (!m.isMesh) return;
    if (!buckets.has(m.material)) buckets.set(m.material, []);
    buckets.get(m.material).push(m);
  });
  const out = new THREE.Group();
  out.name = 'obstacles';
  for (const [material, meshes] of buckets) {
    const geo = bakeGeometry(meshes, (m) => m.matrixWorld);
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'obstacle-merged';
    out.add(mesh);
  }
  return out;
}

// A flat strip of the given width following a polyline, with round joints (for rivers and canals).
function ribbon(points, width, y, material) {
  const half = width / 2;
  const positions = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = (-(bz - az) / len) * half;
    const nz = ((bx - ax) / len) * half;
    positions.push(
      ax - nx, y, az - nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz,
      ax - nx, y, az - nz, ax + nx, y, az + nz, bx + nx, y, bz + nz,
    );
  }
  // Round joints between segments, as fans in the same geometry (one draw call per ribbon).
  const fan = 14;
  for (let i = 1; i < points.length - 1; i++) {
    const [cx, cz] = points[i];
    for (let k = 0; k < fan; k++) {
      const a0 = (k / fan) * PI * 2;
      const a1 = ((k + 1) / fan) * PI * 2;
      positions.push(cx, y, cz, cx + Math.cos(a1) * half, y, cz + Math.sin(a1) * half, cx + Math.cos(a0) * half, y, cz + Math.sin(a0) * half);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const strip = new THREE.Mesh(geo, material);
  strip.receiveShadow = true;
  return strip;
}

function buildCartPath(points, biome) {
  const positions = [];
  const half = 1.5;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / len * half;
    const nz = (bx - ax) / len * half;
    const y = 0.02;
    positions.push(
      ax - nx, y, az - nz, bx - nx, y, bz - nz, bx + nx, y, bz + nz,
      ax - nx, y, az - nz, bx + nx, y, bz + nz, ax + nx, y, az + nz,
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const mat = overlayMaterial(biome.path, -1);
  mat.side = THREE.DoubleSide;
  return new THREE.Mesh(geo, mat);
}

// ---------- props ----------
function bench() {
  const g = new THREE.Group();
  const wood = lambert(0xe8e4dc);
  const leg = lambert(0x4a4a4a);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.5), wood);
  seat.position.y = 0.48;
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.08), wood);
  back.position.set(0, 0.85, -0.24);
  g.add(seat, back);
  for (const x of [-0.95, 0.95]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.45), leg);
    l.position.set(x, 0.24, 0);
    g.add(l);
  }
  return g;
}

function lampPost(nightLights) {
  const g = new THREE.Group();
  const metal = lambert(0x3a3f46);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5, 6), metal);
  pole.position.y = 2.5;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), metal);
  arm.position.set(0.6, 4.95, 0);
  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.18, 0.35),
    new THREE.MeshLambertMaterial({ color: 0xfff1c8, emissive: 0xffd27a, emissiveIntensity: 0 })
  );
  lamp.position.set(1.2, 4.85, 0);
  nightLights.push(lamp);
  g.add(pole, arm, lamp);
  return g;
}

// ---------- atmosphere ----------
function buildBirds(hole) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x2a2a30, side: THREE.DoubleSide, fog: false });
  const wingGeo = new THREE.PlaneGeometry(0.9, 0.25).translate(0.45, 0, 0);
  const birds = [];
  const centre = { x: hole.pin[0] * 0.6, z: hole.pin[2] * 0.6 };
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group();
    const left = new THREE.Mesh(wingGeo, mat);
    const right = new THREE.Mesh(wingGeo, mat);
    right.rotation.y = PI;
    b.add(left, right);
    b.scale.setScalar(1.6);
    group.add(b);
    birds.push({ b, left, right, r: 60 + i * 9, h: 55 + (i % 3) * 8, phase: i * 0.6, speed: 0.08 + (i % 4) * 0.01 });
  }
  return {
    group,
    update(t) {
      for (const bird of birds) {
        const a = bird.phase + t * bird.speed;
        bird.b.position.set(centre.x + Math.cos(a) * bird.r, bird.h + Math.sin(t * 0.5 + bird.phase) * 3, centre.z + Math.sin(a) * bird.r);
        bird.b.rotation.y = -a;
        const flap = Math.sin(t * 8 + bird.phase) * 0.5;
        bird.left.rotation.x = flap;
        bird.right.rotation.x = -flap;
      }
    },
  };
}

function buildSnow() {
  const count = 1400;
  const box = 140;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * box;
    positions[i * 3 + 1] = Math.random() * 60;
    positions[i * 3 + 2] = (Math.random() - 0.5) * box;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, transparent: true, opacity: 0.9, depthWrite: false }));
  points.frustumCulled = false;
  let last = 0;
  return {
    points,
    update(time, cam) {
      const dt = Math.min(0.1, time - last);
      last = time;
      if (cam) points.position.set(cam.x, cam.y - 20, cam.z);
      const p = geo.attributes.position;
      for (let i = 0; i < count; i++) {
        let y = p.getY(i) - dt * 2.2;
        if (y < 0) y += 60;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(time * 0.7 + i) * dt * 0.4);
      }
      p.needsUpdate = true;
    },
  };
}
