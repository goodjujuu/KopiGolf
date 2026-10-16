import * as THREE from 'three';
import { REDUCED_MOTION } from '../config.js';
import { BALL_RADIUS } from './ball.js';

// The player's club, the game's main sprite.
//
// Node tree:
//
//   root     yawed toward the aim, positioned at the club head
//    └ address   fixed lean at address: top tilts left and toward the camera
//       └ pivot  sits at the hands; the swing is a rotation of this node
//          ├ grip
//          ├ shaft
//          └ head  rests behind the ball, face toward the target
//
// Swing angle convention (radians about the pivot's x axis):
//   negative = backswing (head comes back toward the camera and up)
//   0        = address / impact
//   positive = follow-through (head goes toward the target and up)

export const CLUB_LENGTH = 0.95;
const HEAD = { w: 0.1, h: 0.045, d: 0.035 };
const UP = new THREE.Vector3(0, 1, 0);
const FOLLOW_THROUGH_ANGLE = 1.9;
const FOLLOW_THROUGH_TIME = 0.28;

export function createClub() {
  const L = CLUB_LENGTH;
  const root = new THREE.Group();
  root.name = 'club';

  const address = new THREE.Group();
  address.rotation.set(0.32, 0, 0.3);
  root.add(address);

  const pivot = new THREE.Group();
  pivot.position.y = L;
  address.add(pivot);

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.014, L * 0.22, 8),
    new THREE.MeshLambertMaterial({ color: 0x2b2f33 })
  );
  grip.position.y = -L * 0.11;
  pivot.add(grip);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.008, L * 0.78, 8),
    new THREE.MeshPhongMaterial({ color: 0xc9ced4, specular: 0xffffff, shininess: 80 })
  );
  shaft.position.y = -L * 0.61;
  pivot.add(shaft);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(HEAD.w, HEAD.h, HEAD.d),
    new THREE.MeshPhongMaterial({ color: 0x4b5966, specular: 0x99a4ad, shininess: 50, flatShading: true })
  );
  head.position.y = -L;
  head.quaternion.copy(address.quaternion).invert(); // cancel the lean so the sole sits flat
  pivot.add(head);

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  const offset = new THREE.Vector3();
  let mode = 'idle'; // 'idle' | 'manual' (following the finger) | 'follow' (follow-through)
  let angle = 0;
  let target = 0;
  let followFrom = 0;
  let followT = 0;

  return {
    root,

    // Rest the head just behind the ball (toward the player), aimed down the target line.
    address(ballPos, aimYaw, groundY) {
      root.rotation.set(0, aimYaw, 0);
      offset.set(-0.015, 0, BALL_RADIUS + HEAD.d / 2 + 0.006).applyAxisAngle(UP, aimYaw);
      root.position.set(ballPos.x + offset.x, groundY + HEAD.h / 2, ballPos.z + offset.z);
    },

    setSwing(a) { mode = 'manual'; target = a; },
    release() { mode = 'idle'; },
    followThrough() { mode = 'follow'; followFrom = angle; followT = 0; },

    update(time, dt) {
      if (mode === 'manual') {
        angle += (target - angle) * (1 - Math.exp(-dt * 35));
      } else if (mode === 'follow') {
        followT = Math.min(1, followT + dt / FOLLOW_THROUGH_TIME);
        const eased = 1 - Math.pow(1 - followT, 3);
        angle = followFrom + (FOLLOW_THROUGH_ANGLE - followFrom) * eased;
      } else {
        angle += (0 - angle) * (1 - Math.exp(-dt * 8));
      }

      // Idle waggle fades in only once the club is back at address.
      const waggle = mode === 'idle' && !REDUCED_MOTION ? Math.max(0, 1 - Math.abs(angle) * 10) : 0;
      const w = (time * Math.PI * 2) / 2.5;
      pivot.rotation.x = angle + waggle * 0.018 * Math.sin(w + 0.8);
      pivot.rotation.z = angle * 0.18 + waggle * 0.06 * Math.sin(w);
    },
  };
}
