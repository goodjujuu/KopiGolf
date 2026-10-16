import * as THREE from 'three';
import { REDUCED_MOTION } from '../config.js';
import { BALL_RADIUS } from './ball.js';

// The player's club, the game's main sprite.
//
// Node tree:
//
//   root      yawed toward the aim, positioned at the club head (so the head rests by the ball)
//    └ hands  where the grip is held at address
//       └ swing    the swing is a rotation of this node about a LEVEL axis across the target line,
//                  so the head always travels up and back, never down into the turf
//          └ lean  fixed address lean: shaft tilts left and toward the camera
//             ├ grip
//             ├ shaft
//             └ head  one per kind (iron, wedge, wood, putter); sole kept flat, face toward the target
//
// Swing angle convention (radians):
//   negative = backswing (head comes back toward the camera and up)
//   0        = address / impact
//   positive = follow-through (head goes toward the target and up)

export const CLUB_LENGTH = 0.95;
const HEAD = { w: 0.1, h: 0.045, d: 0.035 };
const UP = new THREE.Vector3(0, 1, 0);
const FOLLOW_THROUGH_ANGLE = 1.9;
const FOLLOW_THROUGH_TIME = 0.28;
const HANDS_LIFT = 0.2;       // hands rise this much (m) through the backswing…
const HANDS_LIFT_BY = 0.7;    // …reaching full lift at this swing angle (rad)

export function createClub() {
  const L = CLUB_LENGTH;
  const root = new THREE.Group();
  root.name = 'club';

  const leanQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.32, 0, 0.3));
  const handsAtAddress = new THREE.Vector3(0, L, 0).applyQuaternion(leanQuat);

  const hands = new THREE.Group();
  hands.position.copy(handsAtAddress);
  root.add(hands);

  const pivot = new THREE.Group(); // the swing node
  hands.add(pivot);

  const lean = new THREE.Group();
  lean.quaternion.copy(leanQuat);
  pivot.add(lean);

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.014, L * 0.22, 8),
    new THREE.MeshLambertMaterial({ color: 0x2b2f33 })
  );
  grip.position.y = -L * 0.11;
  lean.add(grip);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.008, L * 0.78, 8),
    new THREE.MeshPhongMaterial({ color: 0xc9ced4, specular: 0xffffff, shininess: 80 })
  );
  shaft.position.y = -L * 0.61;
  lean.add(shaft);

  // One head per kind of club; setKind() shows the right one.
  const heads = {
    iron: makeHead(new THREE.BoxGeometry(HEAD.w, HEAD.h, HEAD.d), 0x9aa5b1),
    wedge: makeHead(new THREE.BoxGeometry(0.09, 0.05, 0.03), 0x2e343c),
    putter: makeHead(new THREE.BoxGeometry(0.12, 0.032, 0.032), 0xd5dbe2),
    wood: makeHead(new THREE.SphereGeometry(0.05, 14, 10).scale(1.15, 0.5, 0.95), 0x26324a),
  };
  for (const h of Object.values(heads)) {
    h.position.y = -L;
    h.quaternion.copy(leanQuat).invert(); // cancel the lean so the sole sits flat
    h.visible = false;
    lean.add(h);
  }
  heads.iron.visible = true;

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

    setKind(kind) {
      for (const [k, h] of Object.entries(heads)) h.visible = k === kind;
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
      // Lift the hands a little in the backswing so the head clears the turf as it starts back.
      const lift = angle < 0 ? HANDS_LIFT * Math.min(1, -angle / HANDS_LIFT_BY) : 0;
      hands.position.y = handsAtAddress.y + lift;
    },
  };
}

function makeHead(geometry, color) {
  return new THREE.Mesh(
    geometry,
    new THREE.MeshPhongMaterial({ color, specular: 0x99a4ad, shininess: 50, flatShading: true })
  );
}
