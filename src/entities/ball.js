import * as THREE from 'three';
import { REDUCED_MOTION } from '../config.js';

export const BALL_RADIUS = 0.045; // a real golf ball is 42.7 mm across

// Flight and physics arrive in a later step. For now the ball rests and gently pulses so it
// reads as the thing to interact with.
export function createBall() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 24, 16),
    new THREE.MeshLambertMaterial({ color: 0xf8f8f6 })
  );
  mesh.castShadow = true;
  mesh.name = 'ball';

  return {
    mesh,
    update(time) {
      if (REDUCED_MOTION) return;
      mesh.scale.setScalar(1 + 0.04 * (0.5 + 0.5 * Math.sin(time * 3.4)));
    },
  };
}
