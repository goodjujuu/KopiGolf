import * as THREE from 'three';
import { REDUCED_MOTION } from '../config.js';
import { BALL_RADIUS } from './ball.js';
import { HEAD_FINISHES } from '../avatar/looks.js';
import { patternTexture } from '../avatar/patterns.js';
import { CLUB_ORDER, CLUBS } from '../config.js';
import { buildHead, createHeadMaterials, SOLE_Y } from './clubHeads.js';

// The player's club, the game's main sprite.
//
// Node tree:
//
//   root      yawed toward the aim, positioned at the club head (so the head rests by the ball)
//    └ hands  where the grip is held at address
//       └ swing    the swing is a rotation of this node about a LEVEL axis across the target line,
//                  so the head always travels up and back, never down into the turf
//          └ lean  fixed address lean: shaft tilts left and toward the camera
//             ├ grip   + the player's hands and forearms (gloves / sleeves from the Locker)
//             ├ shaft
//             └ head  one per club (see clubHeads.js); sole kept flat, face toward the target
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

  // One head per club (driver, 3 wood, each iron, each wedge, putter), built from the shared
  // designs so it matches the club picker. setClub() shows the right one.
  const headMats = createHeadMaterials();
  const heads = {};
  for (const id of CLUB_ORDER) {
    const built = buildHead(id, headMats);
    if (!built) continue;
    built.group.position.y = -L;
    built.group.quaternion.copy(leanQuat).invert(); // cancel the lean so the sole sits flat
    built.group.visible = false;
    built.group.name = `head:${id}`;
    lean.add(built.group);
    heads[id] = built;
  }
  let current = heads['7i'];
  current.group.visible = true;

  // First-person hands on the grip: lead (left) hand on top, right hand below, forearms
  // continuing up the line of the shaft out of view.
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xe0a476 });
  const leadHandMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const trailHandMat = new THREE.MeshLambertMaterial({ color: 0xe0a476 });
  const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x3a63d8 });
  const handGeo = new THREE.SphereGeometry(0.034, 14, 10);
  const leadHand = new THREE.Mesh(handGeo, leadHandMat);
  leadHand.position.set(0, -0.05, 0.004);
  leadHand.scale.set(1.05, 1.35, 1.1);
  const trailHand = new THREE.Mesh(handGeo, trailHandMat);
  trailHand.position.set(0.004, -0.12, 0.01);
  trailHand.scale.set(1, 1.3, 1.1);
  lean.add(leadHand, trailHand);
  // Each arm runs from the grip up toward its shoulder (above the camera), so it leaves the
  // top of the screen like your own arms would. Forearm = skin or sleeve; upper arm = shirt.
  const forearmGeo = new THREE.CapsuleGeometry(0.03, 0.28, 4, 10);
  const upperArmGeo = new THREE.CapsuleGeometry(0.038, 0.62, 4, 10);
  const shirtMat = new THREE.MeshLambertMaterial({ color: 0x3a63d8 });
  const forearms = [];
  const tattoos = [];
  const uppers = [];
  const wristMat = new THREE.MeshPhongMaterial({ color: 0x22262c, shininess: 60 });
  let wristwear = null;
  const inkMat = new THREE.MeshLambertMaterial({ color: 0x2c3553 });
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.012, 0.005, 0.01);
    // Angled up toward the camera and off the left of the screen (checked for the default camera).
    arm.rotation.set(0.35, 0, side < 0 ? 0.4 : -0.1);
    const fore = new THREE.Mesh(forearmGeo, skinMat);
    fore.position.y = 0.17;
    // Tattoo bands (shown on bare forearms when the look has tattoos).
    const ink = [];
    for (const t of [-0.07, 0.06]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.0305, 0.004, 6, 18), inkMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = t;
      fore.add(band);
      ink.push(band);
    }
    tattoos.push(...ink);
    const upper = new THREE.Mesh(upperArmGeo, shirtMat);
    upper.position.y = 0.66;
    arm.add(fore, upper);
    uppers.push(upper);
    if (side < 0) { // lead (left) arm: room for a watch, sweatband or bracelet at the wrist
      const wrist = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.007, 6, 18), wristMat);
      wrist.rotation.x = Math.PI / 2;
      wrist.position.y = -0.11;
      wrist.visible = false;
      fore.add(wrist);
      wristwear = wrist;
    }
    lean.add(arm);
    forearms.push(fore);
  }

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
      // Sweet spot right behind the ball; the shaft end (root) sits toward the heel from there.
      offset.set(-current.sweetX, 0, BALL_RADIUS + HEAD.d / 2 + 0.006).applyAxisAngle(UP, aimYaw);
      root.position.set(ballPos.x + offset.x, groundY - SOLE_Y, ballPos.z + offset.z);
    },

    // Apply the Locker look: shaft, grip, head finish, gloves and sleeves.
    setLook(look) {
      shaft.material.color.set(look.shaftColour);
      grip.material.color.set(look.gripColour);
      const finish = HEAD_FINISHES[look.headFinish] ?? HEAD_FINISHES.chrome;
      headMats.metal.color.set(finish.hex);
      headMats.metal.shininess = finish.shine;
      headMats.dark.color.set(finish.hex).multiplyScalar(0.28); // wedges: a dark satin take on the finish
      headMats.dark.shininess = finish.shine * 0.4;
      skinMat.color.set(look.skin);
      leadHandMat.color.set(look.gloves === 'none' ? look.skin : look.glovesColour);
      trailHandMat.color.set(look.gloves === 'both' ? look.glovesColour : look.skin);
      const longSleeves = ['longsleeve', 'hoodie', 'jacket', 'vest', 'shirt', 'sweater', 'rugby', 'windbreaker'].includes(look.top);
      // Sleeves carry the top's pattern (a sweater vest shows plain shirt sleeves in the trim colour).
      const patterned = look.top !== 'vest' && look.topPattern && look.topPattern !== 'solid';
      const tex = patterned ? patternTexture(look.topPattern, look.topColour, look.topAccent, [2, 2]) : null;
      for (const m of [sleeveMat, shirtMat]) {
        m.map = tex;
        m.color.set(tex ? '#ffffff' : look.top === 'vest' ? look.topAccent : look.topColour);
        m.needsUpdate = true;
      }
      for (const arm of forearms) arm.material = longSleeves ? sleeveMat : skinMat;
      for (const u of uppers) u.material = look.top === 'tank' || look.top === 'shirtless' ? skinMat : shirtMat;
      if (wristwear) {
        wristwear.visible = look.wrist === 'watch' || look.wrist === 'sweatband' || (look.wrist === 'bracelet' && !longSleeves);
        wristMat.color.set(look.wristColour);
        wristwear.scale.set(1, 1, look.wrist === 'sweatband' ? 3 : look.wrist === 'bracelet' ? 0.5 : 1);
      }
      for (const t of tattoos) t.visible = !longSleeves && look.tattoos && look.tattoos !== 'none';
    },

    // Show the head for a club id ('D', '7i', 'Sw'…). Re-address after this so the sweet spot
    // lines up with the ball.
    setClub(id) {
      const next = heads[id] ?? heads[CLUBS[id]?.kind === 'putter' ? 'P' : '7i'];
      for (const h of Object.values(heads)) h.group.visible = h === next;
      current = next;
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


