import * as THREE from 'three';
import { REDUCED_MOTION } from '../config.js';
import { lambert } from './materials.js';

// Procedural low-poly palm: a curved, segmented trunk and a crown of drooping fronds.
// The crown sways so the island feels alive while the player lines up a shot.

const TRUNK_SEGMENTS = 6;
const SEGMENT_HEIGHT = 0.9;
const FROND_COUNT = 7;

export function makePalm([x, z, scale, yawDeg], groundY, theme) {
  const group = new THREE.Group();
  group.position.set(x, groundY, z);
  group.rotation.y = THREE.MathUtils.degToRad(yawDeg);
  group.scale.setScalar(scale);

  let topX = 0;
  let topY = 0;
  for (let i = 0; i < TRUNK_SEGMENTS; i++) {
    const t = i / TRUNK_SEGMENTS;
    const radius = 0.22 - 0.1 * t;
    const geo = new THREE.CylinderGeometry(radius * 0.92, radius, SEGMENT_HEIGHT, 7);
    const seg = new THREE.Mesh(geo, lambert(i % 2 ? theme.trunkAlt : theme.trunk));
    const lean = 0.48 * t * t; // the curve grows toward the top
    seg.position.set(topX + lean * 0.5, topY + SEGMENT_HEIGHT / 2, 0);
    seg.rotation.z = -lean * 0.6;
    group.add(seg);
    topX += lean;
    topY += SEGMENT_HEIGHT * 0.97;
  }

  const crown = new THREE.Group();
  crown.position.set(topX, topY, 0);
  const frondGeo = new THREE.BoxGeometry(0.5, 0.05, 2.0);
  frondGeo.translate(0, 0, -1.0); // pivot at the frond's base
  for (let i = 0; i < FROND_COUNT; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i / FROND_COUNT) * Math.PI * 2;
    const frond = new THREE.Mesh(frondGeo, lambert(i % 2 ? theme.foliageAlt : theme.foliage));
    frond.rotation.x = 0.5; // droop
    arm.add(frond);
    crown.add(arm);
  }
  // A small cluster of coconuts under the fronds.
  const nutGeo = new THREE.IcosahedronGeometry(0.11, 0);
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(nutGeo, lambert(theme.wood));
    const a = (i / 3) * Math.PI * 2;
    nut.position.set(Math.cos(a) * 0.14, -0.12, Math.sin(a) * 0.14);
    crown.add(nut);
  }
  group.add(crown);

  // Randomised sway so a grove doesn't move in lockstep.
  const amp = REDUCED_MOTION ? 0 : 0.04 + Math.random() * 0.04;
  const speed = 2 + Math.random() * 0.8;
  const phase = Math.random() * Math.PI * 2;

  return {
    group,
    update(time) {
      crown.rotation.x = amp * Math.sin(time * speed * 0.5 + phase);
      crown.rotation.z = amp * 0.5 * Math.sin(time * speed * 0.37 + phase);
    },
  };
}
