import * as THREE from 'three';
import { PHYSICS, REDUCED_MOTION } from '../config.js';

export const BALL_RADIUS = PHYSICS.ballRadius;

// The ball's 3D mesh. Its motion comes from physics/ball.js; this only draws it.
// While waiting for a shot it pulses gently so it reads as the thing to interact with.
export function createBall() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 24, 16),
    new THREE.MeshLambertMaterial({ color: 0xf8f8f6 })
  );
  mesh.castShadow = true;
  mesh.name = 'ball';
  let idle = true;

  return {
    mesh,
    setColour(hex) { mesh.material.color.set(hex); },
    // A faint self-glow keeps the ball easy to spot at night.
    setGlow(amount) {
      mesh.material.emissive.setHex(0xffffff);
      mesh.material.emissiveIntensity = amount;
    },
    setIdle(on) {
      idle = on;
      if (!on) mesh.scale.setScalar(1);
    },
    update(time) {
      if (!idle || REDUCED_MOTION) return;
      mesh.scale.setScalar(1 + 0.04 * (0.5 + 0.5 * Math.sin(time * 3.4)));
    },
  };
}
