import * as THREE from 'three';
import { HEAD_FINISHES } from './looks.js';

// Builds a chunky, big-headed golfer from simple shapes, in the spirit of console avatars.
// buildAvatar(look) returns { group, headCentre, height }. Rebuild it whenever the look changes;
// it's a few dozen meshes, so that's instant.
//
// Units are metres-ish (a medium golfer is about 1.25 tall). +z is the front of the face.

// torso = body radius, limb = arm/leg thickness, depth = front-to-back fullness, belly = tummy size
const BUILDS = {
  slim: { torso: 0.115, limb: 0.9, depth: 0.78, belly: 0 },
  regular: { torso: 0.135, limb: 1, depth: 0.78, belly: 0 },
  broad: { torso: 0.16, limb: 1.15, depth: 0.8, belly: 0 },
  chubby: { torso: 0.175, limb: 1.22, depth: 0.9, belly: 0.75 },
  heavy: { torso: 0.2, limb: 1.4, depth: 0.98, belly: 1 },
};
const INK = '#2c3553'; // tattoo ink
const HEIGHTS = { short: { leg: 0.22, torso: 0.13 }, medium: { leg: 0.28, torso: 0.16 }, tall: { leg: 0.34, torso: 0.19 } };
const HEAD_R = 0.17;

const PI = Math.PI;
const matCache = new Map();
function mat(hex, { shine = 18, opacity = 1 } = {}) {
  const key = `${hex}|${shine}|${opacity}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshPhongMaterial({
      color: hex, shininess: shine, specular: 0x222222,
      transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
    }));
  }
  return matCache.get(key);
}
function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14);
const sphere = (r, w = 22, h = 16) => new THREE.SphereGeometry(r, w, h);

export function buildAvatar(look, { holdingClub = true } = {}) {
  const group = new THREE.Group();
  group.name = 'avatar';
  const build = BUILDS[look.build] ?? BUILDS.regular;
  const size = HEIGHTS[look.height] ?? HEIGHTS.medium;
  const skin = mat(look.skin, { shine: 12 });
  const limbR = 0.045 * build.limb;

  // ---------- legs, socks, shoes ----------
  const shoeY = 0.035;
  const legBottom = 0.07;
  const legTop = legBottom + size.leg;
  for (const side of [-1, 1]) {
    const x = side * (build.torso * 0.5);
    const shoe = mesh(capsule(0.048, 0.08), mat(look.shoesColour, { shine: 40 }), x, shoeY + 0.005, 0.03);
    shoe.rotation.x = PI / 2;
    shoe.scale.set(1.05, 1, 0.8);
    group.add(shoe);
    const sole = mesh(new THREE.BoxGeometry(0.1, 0.022, 0.19), mat(look.soleColour), x, 0.011, 0.03);
    group.add(sole);

    const legLen = legTop - legBottom;
    const lowerLen = legLen * 0.5;
    const upperLen = legLen - lowerLen;
    const bottomsMat = mat(look.bottomsColour);
    // Lower leg: trousers cover it; shorts, skirt and plus fours show socks or skin.
    const lowerMat = look.bottoms === 'trousers' ? bottomsMat : mat(look.socksColour);
    const lowerSkin = look.bottoms === 'shorts' || look.bottoms === 'skirt';
    group.add(mesh(capsule(limbR, lowerLen), lowerSkin ? skin : lowerMat, x, legBottom + lowerLen / 2 + limbR * 0.3, 0));
    if (lowerSkin) group.add(mesh(capsule(limbR * 1.04, lowerLen * 0.35), mat(look.socksColour), x, legBottom + 0.03, 0));
    const upperR = look.bottoms === 'plusfours' ? limbR * 1.45 : limbR * 1.08;
    const upperMat = look.bottoms === 'skirt' ? skin : bottomsMat;
    group.add(mesh(capsule(upperR, upperLen), upperMat, x, legBottom + lowerLen + upperLen / 2 + limbR * 0.5, 0));
  }

  // ---------- torso ----------
  const hipY = legTop + 0.02;
  const torsoR = build.torso;
  const torsoLen = size.torso;
  const torsoCentre = hipY + torsoLen / 2 + torsoR * 0.55;
  const topMat = mat(look.topColour);
  const accentMat = mat(look.topAccent);
  const depth = build.depth ?? 0.78;
  const torso = mesh(capsule(torsoR, torsoLen), topMat, 0, torsoCentre, 0);
  torso.scale.set(1, 1, depth);
  group.add(torso);
  // A rounder tummy for the chubby and heavy builds.
  if (build.belly) {
    const belly = mesh(sphere(torsoR * (0.78 + 0.12 * build.belly)), topMat, 0, torsoCentre - torsoLen * 0.28, torsoR * depth * 0.32 * build.belly);
    belly.scale.set(1.05, 0.92, 0.85);
    group.add(belly);
  }
  // Hips / waistband in the bottoms colour.
  const hips = mesh(capsule(torsoR * 0.98, 0.04), mat(look.bottomsColour), 0, hipY + 0.02, 0);
  hips.scale.set(1, 1, depth);
  group.add(hips);
  if (look.bottoms === 'skirt') {
    const skirt = mesh(new THREE.CylinderGeometry(torsoR * 0.95, torsoR * 1.45, size.leg * 0.45, 20, 1, true), mat(look.bottomsColour), 0, hipY - size.leg * 0.16, 0);
    skirt.material.side = THREE.DoubleSide;
    skirt.scale.z = 0.85;
    group.add(skirt);
  }

  const shoulderY = torsoCentre + torsoLen / 2 + torsoR * 0.35;
  const neckY = shoulderY + 0.04;

  // Top details
  const frontZ = torsoR * depth;
  if (look.top === 'polo') {
    const collar = mesh(new THREE.TorusGeometry(0.06, 0.016, 8, 20), accentMat, 0, neckY - 0.02, 0);
    collar.rotation.x = PI / 2 - 0.25;
    group.add(collar);
    group.add(mesh(new THREE.BoxGeometry(0.02, 0.07, 0.01), accentMat, 0, shoulderY - 0.05, frontZ));
  } else if (look.top === 'tee' || look.top === 'longsleeve') {
    const ring = mesh(new THREE.TorusGeometry(0.058, 0.01, 6, 20), accentMat, 0, neckY - 0.03, 0);
    ring.rotation.x = PI / 2;
    group.add(ring);
  } else if (look.top === 'vest') {
    const v = mesh(new THREE.ConeGeometry(0.06, 0.12, 3), accentMat, 0, shoulderY - 0.05, frontZ - 0.004);
    v.rotation.z = PI;
    v.scale.z = 0.15;
    group.add(v);
  } else if (look.top === 'hoodie') {
    const hood = mesh(new THREE.TorusGeometry(0.085, 0.035, 8, 20), topMat, 0, neckY - 0.01, -0.035);
    hood.rotation.x = PI / 2 + 0.35;
    group.add(hood);
    group.add(mesh(new THREE.BoxGeometry(torsoR * 1.1, 0.07, 0.02), accentMat, 0, torsoCentre - torsoLen * 0.3, frontZ - 0.01));
  } else if (look.top === 'jacket') {
    group.add(mesh(new THREE.BoxGeometry(0.012, torsoLen + torsoR, 0.012), accentMat, 0, torsoCentre, frontZ + 0.002));
    const collar = mesh(new THREE.TorusGeometry(0.065, 0.02, 8, 20), topMat, 0, neckY - 0.015, 0);
    collar.rotation.x = PI / 2 - 0.2;
    group.add(collar);
  }

  // ---------- arms ----------
  const longSleeves = ['longsleeve', 'hoodie', 'jacket'].includes(look.top);
  const sleeveMat = look.top === 'vest' ? accentMat : topMat; // vest: shirt sleeves in the trim colour
  const vestLong = look.top === 'vest';
  const gloveMat = mat(look.glovesColour, { shine: 30 });
  const upperArm = 0.11 * (0.9 + 0.1 * build.limb);
  const foreArm = 0.11;
  let rightHandWorld = null;
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (torsoR + limbR * 0.6), shoulderY, 0);
    // Arms hang slightly out from the body; the right arm reaches forward to hold the club.
    shoulder.rotation.z = side * 0.18;
    if (holdingClub && side === 1) shoulder.rotation.x = -0.35;
    group.add(shoulder);
    shoulder.add(mesh(capsule(limbR * 1.1, upperArm), sleeveMat, 0, -upperArm / 2, 0));
    const forearmMat = longSleeves || vestLong ? sleeveMat : skin;
    shoulder.add(mesh(capsule(limbR, foreArm), forearmMat, 0, -upperArm - foreArm / 2, 0));
    if (look.tattoos && look.tattoos !== 'none' && !longSleeves && !vestLong) {
      addArmTattoo(shoulder, limbR, -upperArm - foreArm / 2, foreArm, side);
    }
    const gloved = look.gloves === 'both' || (look.gloves === 'left' && side === -1);
    const hand = mesh(sphere(limbR * 1.25, 14, 10), gloved ? gloveMat : skin, 0, -upperArm - foreArm - limbR * 0.6, 0);
    shoulder.add(hand);
    if (side === 1) rightHandWorld = hand;
  }

  // ---------- neck + head ----------
  const neckR = 0.045 * (1 + (build.belly ?? 0) * 0.25);
  group.add(mesh(new THREE.CylinderGeometry(neckR, neckR * 1.1, 0.06, 12), skin, 0, neckY, 0));
  if (look.tattoos === 'inked') {
    // A small piece on the side of the neck.
    const piece = mesh(new THREE.CircleGeometry(0.022, 5), mat(INK, { shine: 5 }), neckR * 0.98, neckY, 0.01);
    piece.rotation.y = PI / 2 - 0.2;
    group.add(piece);
  }
  const headY = neckY + HEAD_R * 0.95;
  const head = new THREE.Group();
  head.position.set(0, headY, 0);
  group.add(head);
  const skull = mesh(sphere(HEAD_R, 28, 20), skin);
  skull.scale.set(1, 0.97, 0.95);
  head.add(skull);
  for (const side of [-1, 1]) {
    const ear = mesh(sphere(0.035, 12, 10), skin, side * HEAD_R * 0.97, -0.01, 0);
    ear.scale.set(0.55, 1, 0.8);
    head.add(ear);
  }
  addFace(head, look, skin);
  addHair(head, look);
  addFacialHair(head, look);
  addHat(head, look);
  addGlasses(head, look);

  // ---------- club planted beside the right hand ----------
  if (holdingClub) {
    group.updateMatrixWorld(true);
    const handPos = new THREE.Vector3();
    rightHandWorld.getWorldPosition(handPos);
    group.add(buildDisplayClub(look, handPos));
  }

  return { group, headCentre: new THREE.Vector3(0, headY, 0), height: headY + HEAD_R * 1.3 };
}

// Tattoos on a bare forearm: two bands and a little diamond, in dark ink.
function addArmTattoo(shoulder, r, centreY, len, side) {
  const ink = mat(INK, { shine: 5 });
  for (const t of [-0.28, 0.22]) {
    const band = mesh(new THREE.TorusGeometry(r * 1.02, r * 0.12, 6, 18), ink, 0, centreY + t * len, 0);
    band.rotation.x = PI / 2;
    shoulder.add(band);
  }
  const diamond = mesh(new THREE.OctahedronGeometry(r * 0.45, 0), ink, side * r * 0.2, centreY, r * 0.92);
  diamond.scale.set(0.8, 1.2, 0.25);
  shoulder.add(diamond);
}

// ---------- face ----------
const EYE_SHAPES = {
  round: { w: 0.032, h: 0.04 },
  almond: { w: 0.04, h: 0.026 },
  sleepy: { w: 0.036, h: 0.022, lid: true },
  wide: { w: 0.044, h: 0.046 },
  happy: { w: 0.034, h: 0.012, arc: true },
};

function addFace(head, look, skin) {
  const z = HEAD_R * 0.9;
  const eye = EYE_SHAPES[look.eyes] ?? EYE_SHAPES.round;
  const white = mat('#ffffff', { shine: 60 });
  const dark = mat('#1a1414');
  for (const side of [-1, 1]) {
    const ex = side * 0.062;
    const ey = 0.015;
    if (eye.arc) {
      // Closed, smiling eyes ("^ ^").
      const arc = mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 12, PI), dark, ex, ey - 0.005, z + 0.012);
      head.add(arc);
    } else {
      const ball = mesh(sphere(1, 16, 12), white, ex, ey, z - 0.006);
      ball.scale.set(eye.w, eye.h, 0.022);
      head.add(ball);
      const iris = mesh(new THREE.CircleGeometry(Math.min(eye.w, eye.h) * 0.62, 18), mat(look.eyeColour, { shine: 80 }), ex, ey - 0.002, z + 0.017);
      head.add(iris);
      head.add(mesh(new THREE.CircleGeometry(Math.min(eye.w, eye.h) * 0.3, 14), dark, ex, ey - 0.002, z + 0.018));
      head.add(mesh(new THREE.CircleGeometry(0.006, 8), white, ex + 0.008, ey + 0.008, z + 0.019));
      if (eye.lid) {
        const lid = mesh(new THREE.SphereGeometry(1, 14, 8, 0, PI * 2, 0, PI / 2), skin, ex, ey + 0.002, z - 0.004);
        lid.scale.set(eye.w * 1.08, eye.h * 1.1, 0.026);
        head.add(lid);
      }
    }
    // Eyebrows
    const browStyle = look.brows;
    const thick = browStyle === 'thick' ? 0.011 : 0.007;
    const brow = mesh(capsule(thick, 0.04), mat(look.hairColour), ex, ey + 0.05 + (browStyle === 'arched' ? 0.008 : 0), z + 0.004);
    let tilt = PI / 2;
    if (browStyle === 'determined') tilt += side * 0.35;
    if (browStyle === 'worried') tilt -= side * 0.35;
    if (browStyle === 'arched') tilt += side * 0.12;
    brow.rotation.z = tilt;
    head.add(brow);
  }

  // Nose
  const noseMat = mat(look.skin, { shine: 12 });
  if (look.nose === 'long') {
    const n = mesh(capsule(0.014, 0.03), noseMat, 0, -0.02, z + 0.012);
    n.rotation.x = PI / 2 - 0.4;
    head.add(n);
  } else {
    const r = { button: 0.016, round: 0.024, wide: 0.02 }[look.nose] ?? 0.016;
    const n = mesh(sphere(r, 12, 10), noseMat, 0, -0.022, z + 0.008);
    if (look.nose === 'wide') n.scale.set(1.6, 1, 1);
    head.add(n);
  }

  // Mouth
  const lip = mat('#7a2e2e');
  const my = -0.07;
  if (look.mouth === 'smile') {
    const m = mesh(new THREE.TorusGeometry(0.032, 0.006, 6, 14, PI), lip, 0, my + 0.012, z - 0.012);
    m.rotation.z = PI;
    head.add(m);
  } else if (look.mouth === 'grin') {
    const g = mesh(new THREE.CircleGeometry(0.036, 20, PI, PI), lip, 0, my + 0.01, z - 0.004);
    head.add(g);
    head.add(mesh(new THREE.PlaneGeometry(0.056, 0.01), mat('#ffffff'), 0, my + 0.004, z - 0.002));
  } else if (look.mouth === 'smirk') {
    const m = mesh(new THREE.TorusGeometry(0.026, 0.006, 6, 12, PI * 0.7), lip, 0.01, my + 0.01, z - 0.012);
    m.rotation.z = PI + 0.3;
    head.add(m);
  } else if (look.mouth === 'open') {
    const o = mesh(new THREE.CircleGeometry(0.016, 16), lip, 0, my, z - 0.004);
    o.scale.set(1, 1.3, 1);
    head.add(o);
  } else {
    const f = mesh(capsule(0.005, 0.032), lip, 0, my, z - 0.008);
    f.rotation.z = PI / 2;
    head.add(f);
  }

  // Cheeks
  if (look.cheeks === 'rosy') {
    for (const side of [-1, 1]) head.add(mesh(new THREE.CircleGeometry(0.022, 16), mat('#f08080', { opacity: 0.45 }), side * 0.095, -0.035, z - 0.018));
  } else if (look.cheeks === 'freckles') {
    const fm = mat('#8a5a3a', { opacity: 0.7 });
    for (const side of [-1, 1]) {
      for (const [dx, dy] of [[0, 0], [0.014, 0.008], [0.022, -0.006], [0.008, -0.012]]) {
        head.add(mesh(new THREE.CircleGeometry(0.0045, 8), fm, side * (0.08 + dx), -0.03 + dy, z - 0.014));
      }
    }
  }
}

// ---------- hair ----------
// A cap of hair over the top of the head, opened toward the face.
function hairCap(radius, thetaLength, material, tiltBack = 0.35) {
  const cap = mesh(new THREE.SphereGeometry(radius, 26, 14, 0, PI * 2, 0, thetaLength), material);
  cap.rotation.x = -tiltBack;
  return cap;
}

function addHair(head, look) {
  const h = mat(look.hairColour, { shine: 25 });
  const r = HEAD_R * 1.04;
  const hatOn = look.hat !== 'none';
  switch (look.hair) {
    case 'bald':
      return;
    case 'buzz': {
      head.add(hairCap(HEAD_R * 1.01, 1.35, mat(look.hairColour, { shine: 5, opacity: 0.85 })));
      return;
    }
    case 'short':
      head.add(hairCap(r, 1.4, h));
      return;
    case 'sidepart': {
      head.add(hairCap(r, 1.4, h));
      const sweep = mesh(capsule(0.035, 0.12), h, 0.03, HEAD_R * 0.72, HEAD_R * 0.45);
      sweep.rotation.z = PI / 2 - 0.2;
      head.add(sweep);
      return;
    }
    case 'spiky': {
      head.add(hairCap(r, 1.3, h));
      if (hatOn) return;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * PI * 2;
        const spike = mesh(new THREE.ConeGeometry(0.035, 0.11, 8), h, Math.cos(a) * 0.08, HEAD_R * 0.9, Math.sin(a) * 0.07 - 0.01);
        spike.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
        head.add(spike);
      }
      return;
    }
    case 'mohawk': {
      if (hatOn) { head.add(hairCap(r, 1.0, h)); return; }
      for (let i = 0; i < 6; i++) {
        const t = (i / 5) * 1.6 - 0.6; // from forehead over to the back
        const fin = mesh(new THREE.BoxGeometry(0.03, 0.09, 0.05), h, 0, Math.cos(t) * (HEAD_R + 0.03), Math.sin(t) * (HEAD_R + 0.03));
        fin.rotation.x = t;
        head.add(fin);
      }
      return;
    }
    case 'messy': {
      // Bed head: a cap of hair with tufts sticking out every which way.
      head.add(hairCap(r, 1.45, h, 0.3));
      const tufts = hatOn ? 5 : 11;
      for (let i = 0; i < tufts; i++) {
        const a = i * 2.39996; // golden-angle spread
        const lift = hatOn ? 0.35 : 0.75 + (i % 3) * 0.18;
        const tuft = mesh(new THREE.ConeGeometry(0.03 + (i % 2) * 0.01, 0.09 + (i % 4) * 0.015, 6), h,
          Math.cos(a) * HEAD_R * 0.62, HEAD_R * lift, Math.sin(a) * HEAD_R * 0.55 - 0.02);
        tuft.rotation.set(Math.sin(a) * 0.9 + (i % 3 - 1) * 0.3, a, -Math.cos(a) * 0.9);
        head.add(tuft);
      }
      // A fringe flopping over the forehead.
      const fringe = mesh(capsule(0.028, 0.1), h, -0.03, HEAD_R * 0.62, HEAD_R * 0.72);
      fringe.rotation.set(0.5, 0, PI / 2 + 0.5);
      head.add(fringe);
      return;
    }
    case 'afro': {
      if (hatOn) { head.add(hairCap(r * 1.1, 1.6, h)); return; }
      const puff = mesh(sphere(HEAD_R * 1.42, 22, 16), h, 0, HEAD_R * 0.32, -HEAD_R * 0.18);
      head.add(puff);
      return;
    }
    case 'bun': {
      head.add(hairCap(r, 1.45, h));
      head.add(mesh(sphere(0.07, 16, 12), h, 0, HEAD_R * 0.75, -HEAD_R * 0.75));
      return;
    }
    case 'ponytail': {
      head.add(hairCap(r, 1.45, h));
      const tail = mesh(capsule(0.04, 0.16), h, 0, -0.02, -HEAD_R * 1.05);
      tail.rotation.x = 0.25;
      head.add(tail);
      return;
    }
    case 'bob': {
      head.add(hairCap(r * 1.04, 1.95, h, 0.15));
      return;
    }
    case 'long':
    default: {
      head.add(hairCap(r, 1.5, h));
      const back = mesh(capsule(HEAD_R * 0.85, 0.16), h, 0, -0.11, -HEAD_R * 0.45);
      back.scale.set(1.05, 1, 0.55);
      head.add(back);
    }
  }
}

function addFacialHair(head, look) {
  const z = HEAD_R * 0.9;
  const h = mat(look.hairColour, { shine: 10 });
  switch (look.facialHair) {
    case 'stubble': {
      const s = mesh(new THREE.SphereGeometry(HEAD_R * 1.005, 24, 12, PI * 0.15, PI * 0.7, PI * 0.58, PI * 0.32), mat(look.hairColour, { opacity: 0.35 }));
      head.add(s);
      return;
    }
    case 'moustache': {
      for (const side of [-1, 1]) {
        const m = mesh(capsule(0.011, 0.03), h, side * 0.02, -0.048, z + 0.006);
        m.rotation.z = PI / 2 + side * 0.35;
        head.add(m);
      }
      return;
    }
    case 'goatee': {
      head.add(mesh(sphere(0.026, 12, 10), h, 0, -0.115, z - 0.025));
      return;
    }
    case 'beard': {
      const b = mesh(new THREE.SphereGeometry(HEAD_R * 1.05, 26, 14, 0, PI * 2, PI * 0.55, PI * 0.45), h);
      b.rotation.x = 0.2;
      head.add(b);
      for (const side of [-1, 1]) {
        const m = mesh(capsule(0.011, 0.03), h, side * 0.02, -0.048, z + 0.006);
        m.rotation.z = PI / 2 + side * 0.35;
        head.add(m);
      }
      return;
    }
    default:
  }
}

// ---------- hats ----------
function brim(radius, material, y, z, back = false) {
  const b = mesh(new THREE.CylinderGeometry(radius, radius, 0.012, 24, 1, false, -PI / 2, PI), material, 0, y, z);
  if (back) b.rotation.y = PI;
  return b;
}

function addHat(head, look) {
  const m = mat(look.hatColour, { shine: 20 });
  const r = HEAD_R;
  switch (look.hat) {
    case 'cap':
    case 'backwards': {
      const back = look.hat === 'backwards';
      const dome = mesh(new THREE.SphereGeometry(r * 1.08, 24, 12, 0, PI * 2, 0, PI / 2), m, 0, r * 0.12, 0);
      head.add(dome);
      head.add(brim(r * 0.8, m, r * 0.16, back ? -r * 0.55 : r * 0.55, back));
      head.add(mesh(sphere(0.018, 8, 6), m, 0, r * 1.2, 0));
      return;
    }
    case 'visor': {
      const band = mesh(new THREE.TorusGeometry(r * 1.03, 0.022, 8, 28), m, 0, r * 0.35, 0);
      band.rotation.x = PI / 2;
      head.add(band);
      head.add(brim(r * 0.82, m, r * 0.33, r * 0.6));
      return;
    }
    case 'bucket': {
      head.add(mesh(new THREE.CylinderGeometry(r * 0.82, r * 1.05, r * 0.75, 24), m, 0, r * 0.62, 0));
      head.add(mesh(new THREE.CylinderGeometry(r * 1.5, r * 1.5, 0.014, 28), m, 0, r * 0.26, 0));
      return;
    }
    case 'beanie': {
      const top = mesh(new THREE.SphereGeometry(r * 1.08, 24, 14, 0, PI * 2, 0, PI / 2), m, 0, r * 0.18, 0);
      top.scale.y = 1.25;
      head.add(top);
      const cuff = mesh(new THREE.TorusGeometry(r * 1.07, 0.03, 8, 28), m, 0, r * 0.2, 0);
      cuff.rotation.x = PI / 2;
      head.add(cuff);
      head.add(mesh(sphere(0.04, 10, 8), m, 0, r * 1.55, 0));
      return;
    }
    case 'flatcap': {
      const top = mesh(sphere(r * 1.1, 24, 14), m, 0, r * 0.42, 0.02);
      top.scale.set(1.05, 0.5, 1.12);
      head.add(top);
      head.add(brim(r * 0.7, m, r * 0.3, r * 0.62));
      return;
    }
    default:
  }
}

// ---------- glasses ----------
function addGlasses(head, look) {
  if (look.glasses === 'none') return;
  const frame = mat(look.glassesColour, { shine: 60 });
  const tint = mat('#1a2230', { opacity: 0.82, shine: 90 });
  const z = HEAD_R * 0.97;
  const y = 0.015;
  for (const side of [-1, 1]) {
    const x = side * 0.062;
    let ring;
    if (look.glasses === 'square') {
      ring = mesh(new THREE.TorusGeometry(0.04, 0.006, 6, 4), frame, x, y, z);
      ring.rotation.z = PI / 4;
      ring.scale.set(1.15, 0.85, 1);
    } else {
      ring = mesh(new THREE.TorusGeometry(0.034, 0.005, 6, 20), frame, x, y, z);
      if (look.glasses === 'aviators') ring.scale.set(1.1, 0.95, 1);
      if (look.glasses === 'sunglasses') ring.scale.set(1.2, 0.8, 1);
    }
    head.add(ring);
    if (look.glasses === 'sunglasses' || look.glasses === 'aviators') {
      const lens = mesh(new THREE.CircleGeometry(0.034, 20), tint, x, y, z - 0.001);
      lens.scale.copy(ring.scale);
      head.add(lens);
    }
    const arm = mesh(new THREE.BoxGeometry(0.006, 0.006, HEAD_R * 0.9), frame, side * HEAD_R * 0.86, y + 0.01, z - HEAD_R * 0.5);
    head.add(arm);
  }
  head.add(mesh(new THREE.BoxGeometry(0.03, 0.006, 0.006), frame, 0, y + 0.012, z + 0.004));
}

// ---------- the club shown with the avatar in the Locker ----------
function buildDisplayClub(look, handPos) {
  const g = new THREE.Group();
  const finish = HEAD_FINISHES[look.headFinish] ?? HEAD_FINISHES.chrome;
  const top = handPos.y + 0.06;
  const len = top - 0.03;
  const shaft = mesh(new THREE.CylinderGeometry(0.008, 0.007, len, 8), mat(look.shaftColour, { shine: 80 }), 0, 0.03 + len / 2, 0);
  g.add(shaft);
  g.add(mesh(new THREE.CylinderGeometry(0.016, 0.013, 0.16, 10), mat(look.gripColour), 0, top - 0.08, 0));
  const head = mesh(new THREE.BoxGeometry(0.09, 0.04, 0.035), mat(finish.hex, { shine: finish.shine }), 0.03, 0.02, 0);
  g.add(head);
  const ball = mesh(sphere(0.03, 16, 12), mat(look.ballColour, { shine: 40 }), 0.12, 0.03, 0.1);
  g.add(ball);
  g.position.set(handPos.x, 0, handPos.z);
  return g;
}
