import * as THREE from 'three';
import { REDUCED_MOTION, SURFACE } from '../config.js';
import { BALL_RADIUS } from './ball.js';

// The player's club, the game's main sprite.
//
// Node tree, built so the swing (next step) is just a rotation of `pivot`:
//
//   root     yawed toward the pin, positioned at the club head
//    └ address   fixed lean at address: top tilts left and toward the camera
//       └ pivot  sits at the hands; rotate this to swing
//          ├ grip
//          ├ shaft
//          └ head  rests behind the ball, face toward the target

export const CLUB_LENGTH = 0.95;
const HEAD = { w: 0.1, h: 0.045, d: 0.035 };
const UP = new THREE.Vector3(0, 1, 0);

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

  return {
    root,
    pivot, // exposed for the swing step

    // Rest the head just behind the ball (toward the player), aimed down the target line.
    address(ballPos, aimYaw) {
      root.rotation.set(0, aimYaw, 0);
      offset.set(-0.015, 0, BALL_RADIUS + HEAD.d / 2 + 0.006).applyAxisAngle(UP, aimYaw);
      root.position.set(ballPos.x + offset.x, SURFACE.fairway + HEAD.h / 2, ballPos.z + offset.z);
    },

    // Idle waggle: a slow, small pendulum around the hands, like a golfer settling over the ball.
    update(time) {
      const a = REDUCED_MOTION ? 0 : 0.06;
      const w = (time * Math.PI * 2) / 2.5;
      pivot.rotation.z = a * Math.sin(w);
      pivot.rotation.x = a * 0.3 * Math.sin(w + 0.8);
    },
  };
}
