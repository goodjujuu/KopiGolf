import * as THREE from 'three';
import { HEAD_FINISHES } from './looks.js';
import { patternTexture } from './patterns.js';

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
  muscular: { torso: 0.165, limb: 1.38, depth: 0.82, belly: 0, muscles: true },
};
const INK = '#2c3553'; // tattoo ink
const HEIGHTS = {
  little: { leg: 0.16, torso: 0.1 }, // a kid
  short: { leg: 0.22, torso: 0.13 }, medium: { leg: 0.28, torso: 0.16 },
  tall: { leg: 0.34, torso: 0.19 }, xtall: { leg: 0.43, torso: 0.23 },
};
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
// Cloth in a pattern: the texture carries both colours, so the material itself is white.
const fabricCache = new Map();
function fabric(base, accent, pattern, repeat = [2, 2]) {
  if (!pattern || pattern === 'solid') return mat(base);
  const key = `${base}|${accent}|${pattern}|${repeat}`;
  if (!fabricCache.has(key)) {
    fabricCache.set(key, new THREE.MeshPhongMaterial({ color: 0xffffff, map: patternTexture(pattern, base, accent, repeat), shininess: 14, specular: 0x222222 }));
  }
  return fabricCache.get(key);
}
// A shirt number for the back of a football jersey.
const numberCache = new Map();
function numberMat(colour, text = '10') {
  const key = `${colour}|${text}`;
  if (!numberCache.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = '900 96px "Lilita One", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.strokeText(text, 64, 70);
    ctx.fillStyle = colour;
    ctx.fillText(text, 64, 70);
    const tex = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    numberCache.set(key, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  }
  return numberCache.get(key);
}
const LONG_SLEEVES = ['longsleeve', 'hoodie', 'jacket', 'shirt', 'sweater', 'rugby', 'windbreaker'];
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
  const bottomsMat = fabric(look.bottomsColour, look.bottomsAccent, look.bottomsPattern, [2, 2]);
  const socksMat = fabric(look.socksColour, look.socksAccent, look.socksPattern, [3, 1]);
  const bareShins = look.bottoms === 'shorts' || look.bottoms === 'skirt' || look.bottoms === 'kilt';
  for (const side of [-1, 1]) {
    const x = side * (build.torso * 0.5);
    addShoe(group, look, x, shoeY, limbR);

    const legLen = legTop - legBottom;
    const lowerLen = legLen * 0.5;
    const upperLen = legLen - lowerLen;
    // Lower leg: long trousers cover it; shorts, skirts and kilts show socks or skin; plus fours show socks.
    const longLegs = ['trousers', 'joggers', 'cargo'].includes(look.bottoms);
    group.add(mesh(capsule(limbR, lowerLen), longLegs ? bottomsMat : bareShins ? skin : socksMat, x, legBottom + lowerLen / 2 + limbR * 0.3, 0));
    if (bareShins) {
      const sockLen = { ankle: 0.12, crew: 0.4, knee: 0.85 }[look.socksStyle] ?? 0.4;
      group.add(mesh(capsule(limbR * 1.04, lowerLen * sockLen), socksMat, x, legBottom + 0.005 + lowerLen * sockLen * 0.5, 0));
    }
    if (look.bottoms === 'joggers') { // elastic cuff at the ankle
      const cuff = mesh(new THREE.TorusGeometry(limbR * 1.02, limbR * 0.28, 6, 16), mat(look.bottomsAccent), x, legBottom + 0.015, 0);
      cuff.rotation.x = PI / 2;
      group.add(cuff);
    }
    const upperR = look.bottoms === 'plusfours' ? limbR * 1.45 : look.bottoms === 'cargo' ? limbR * 1.15 : limbR * 1.08;
    const upperMat = look.bottoms === 'skirt' || look.bottoms === 'kilt' ? skin : bottomsMat;
    group.add(mesh(capsule(upperR, upperLen), upperMat, x, legBottom + lowerLen + upperLen / 2 + limbR * 0.5, 0));
    if (look.bottoms === 'cargo') { // side pockets on the thighs
      group.add(mesh(new THREE.BoxGeometry(0.02, upperLen * 0.45, upperR * 1.2), mat(look.bottomsColour), x + side * upperR * 1.05, legBottom + lowerLen + upperLen * 0.4, 0));
    }
  }

  // ---------- torso ----------
  const hipY = legTop + 0.02;
  const torsoR = build.torso;
  const torsoLen = size.torso;
  const torsoCentre = hipY + torsoLen / 2 + torsoR * 0.55;
  const topMat = fabric(look.topColour, look.topAccent, look.topPattern, [3, 2]);
  const accentMat = mat(look.topAccent);
  const depth = build.depth ?? 0.78;
  const torso = mesh(capsule(torsoR, torsoLen), topMat, 0, torsoCentre, 0);
  torso.scale.set(1, 1, depth);
  group.add(torso);
  // Muscular: a broad chest and shoulders tapering to the waist.
  if (build.muscles) {
    for (const side of [-1, 1]) {
      const pec = mesh(sphere(torsoR * 0.55), topMat, side * torsoR * 0.42, torsoCentre + torsoLen * 0.28, torsoR * depth * 0.42);
      pec.scale.set(1.1, 0.8, 0.6);
      group.add(pec);
    }
    torso.scale.set(1.12, 1, depth);
  }
  // A rounder tummy for the chubby and heavy builds.
  if (build.belly) {
    const belly = mesh(sphere(torsoR * (0.78 + 0.12 * build.belly)), topMat, 0, torsoCentre - torsoLen * 0.28, torsoR * depth * 0.32 * build.belly);
    belly.scale.set(1.05, 0.92, 0.85);
    group.add(belly);
  }
  // Hips / waistband in the bottoms colour.
  const hips = mesh(capsule(torsoR * 0.98, 0.04), bottomsMat, 0, hipY + 0.02, 0);
  hips.scale.set(1, 1, depth);
  group.add(hips);
  if (look.bottoms === 'skirt' || look.bottoms === 'kilt') {
    const kilt = look.bottoms === 'kilt';
    const len = size.leg * (kilt ? 0.58 : 0.45);
    const skirtMat = fabric(look.bottomsColour, look.bottomsAccent, look.bottomsPattern, [3, 1]).clone();
    skirtMat.side = THREE.DoubleSide;
    const skirt = mesh(new THREE.CylinderGeometry(torsoR * 0.95, torsoR * (kilt ? 1.3 : 1.45), len, 20, 1, true), skirtMat, 0, hipY - len * 0.36, 0);
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
  } else if (look.top === 'jersey') {
    // Football shirt: a V-neck in the trim colour, a little crest, and a big 10 on the back.
    for (const side of [-1, 1]) {
      const v = mesh(new THREE.BoxGeometry(0.016, 0.075, 0.012), accentMat, side * 0.022, shoulderY - 0.035, frontZ - 0.006);
      v.rotation.z = -side * 0.5; // the two arms of the V
      group.add(v);
    }
    group.add(mesh(new THREE.CircleGeometry(0.02, 12), accentMat, -torsoR * 0.42, shoulderY - torsoLen * 0.28, frontZ + 0.003));
    const num = mesh(new THREE.PlaneGeometry(torsoR * 1.15, torsoR * 1.15), numberMat(look.topAccent), 0, torsoCentre + torsoLen * 0.05, -frontZ - 0.004);
    num.rotation.y = PI;
    group.add(num);
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
  } else if (look.top === 'shirt' || look.top === 'rugby') {
    const collar = mesh(new THREE.TorusGeometry(0.06, 0.016, 8, 20), look.top === 'rugby' ? accentMat : topMat, 0, neckY - 0.02, 0);
    collar.rotation.x = PI / 2 - 0.25;
    group.add(collar);
    const buttons = look.top === 'shirt' ? 4 : 2;
    for (let i = 0; i < buttons; i++) group.add(mesh(sphere(0.009, 8, 6), accentMat, 0, shoulderY - 0.04 - i * (torsoLen * 0.28), frontZ + 0.004));
  } else if (look.top === 'sweater') {
    const ring = mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 20), accentMat, 0, neckY - 0.03, 0);
    ring.rotation.x = PI / 2;
    group.add(ring);
    const hem = mesh(new THREE.TorusGeometry(torsoR * 0.99, 0.018, 6, 26), accentMat, 0, hipY + 0.05, 0);
    hem.rotation.x = PI / 2;
    hem.scale.set(1, depth / 0.98, 1);
    group.add(hem);
  } else if (look.top === 'tank') {
    const ring = mesh(new THREE.TorusGeometry(0.066, 0.009, 6, 20), accentMat, 0, neckY - 0.035, 0);
    ring.rotation.x = PI / 2;
    group.add(ring);
  } else if (look.top === 'windbreaker') {
    group.add(mesh(new THREE.BoxGeometry(0.014, torsoLen + torsoR, 0.012), accentMat, 0, torsoCentre, frontZ + 0.002));
    const hood = mesh(new THREE.TorusGeometry(0.085, 0.035, 8, 20), accentMat, 0, neckY - 0.01, -0.035);
    hood.rotation.x = PI / 2 + 0.35;
    group.add(hood);
    group.add(mesh(new THREE.BoxGeometry(torsoR * 1.9, 0.03, 0.012), accentMat, 0, torsoCentre + torsoLen * 0.15, frontZ - 0.004));
  } else if (look.top === 'jacket') {
    group.add(mesh(new THREE.BoxGeometry(0.012, torsoLen + torsoR, 0.012), accentMat, 0, torsoCentre, frontZ + 0.002));
    const collar = mesh(new THREE.TorusGeometry(0.065, 0.02, 8, 20), topMat, 0, neckY - 0.015, 0);
    collar.rotation.x = PI / 2 - 0.2;
    group.add(collar);
  }

  // ---------- arms ----------
  const longSleeves = LONG_SLEEVES.includes(look.top);
  const tank = look.top === 'tank';
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
    shoulder.add(mesh(capsule(limbR * (tank ? 1 : 1.1), upperArm), tank ? skin : sleeveMat, 0, -upperArm / 2, 0));
    if (look.top === 'jersey') { // trim round the sleeve end
      const cuff = mesh(new THREE.TorusGeometry(limbR * 1.12, limbR * 0.2, 6, 16), accentMat, 0, -upperArm * 0.92, 0);
      cuff.rotation.x = PI / 2;
      shoulder.add(cuff);
    }
    if (build.muscles) { // shoulder caps and a bit of bicep
      shoulder.add(mesh(sphere(limbR * 1.45, 14, 10), tank ? skin : sleeveMat, 0, -limbR * 0.2, 0));
      const bicep = mesh(sphere(limbR * 1.2, 12, 10), tank ? skin : sleeveMat, 0, -upperArm * 0.55, limbR * 0.35);
      bicep.scale.set(1, 1.3, 1);
      shoulder.add(bicep);
    }
    const forearmMat = longSleeves || vestLong ? sleeveMat : skin;
    shoulder.add(mesh(capsule(limbR, foreArm), forearmMat, 0, -upperArm - foreArm / 2, 0));
    if (look.tattoos && look.tattoos !== 'none' && !longSleeves && !vestLong) {
      addArmTattoo(shoulder, limbR, -upperArm - foreArm / 2, foreArm, side);
    }
    const gloved = look.gloves === 'both' || (look.gloves === 'left' && side === -1);
    const handY = -upperArm - foreArm - limbR * 0.6;
    const hand = mesh(sphere(limbR * 1.25, 14, 10), gloved ? gloveMat : skin, 0, handY, 0);
    shoulder.add(hand);
    if (gloved) {
      const cuff = mesh(new THREE.TorusGeometry(limbR * 1.05, limbR * 0.25, 6, 16), mat(look.glovesAccent), 0, handY + limbR * 0.95, 0);
      cuff.rotation.x = PI / 2;
      shoulder.add(cuff);
    }
    if (side === -1 && look.wrist && look.wrist !== 'none') addWristwear(shoulder, look, limbR, handY + limbR * 1.5, longSleeves || vestLong);
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
  addNeckwear(group, look, neckR, neckY, shoulderY, frontZ, torsoLen);
  addEarrings(head, look);
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

// ---------- shoes ----------
function addShoe(group, look, x, shoeY, limbR) {
  const upper = mat(look.shoesColour, { shine: 40 });
  const accent = mat(look.shoesAccent, { shine: 30 });
  const style = look.shoesStyle ?? 'classic';
  const shoe = mesh(capsule(0.048, style === 'loafer' ? 0.085 : 0.08), upper, x, shoeY + 0.005, 0.03);
  shoe.rotation.x = PI / 2;
  shoe.scale.set(1.05, 1, style === 'loafer' ? 0.68 : 0.8);
  group.add(shoe);
  group.add(mesh(new THREE.BoxGeometry(0.1, 0.022, 0.19), mat(look.soleColour), x, 0.011, 0.03));
  if (style === 'saddle') { // contrasting saddle across the middle
    const saddle = mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.05, 14, 1, true, -PI / 2, PI), accent, x, shoeY + 0.012, 0.03);
    saddle.rotation.z = PI / 2;
    saddle.rotation.y = PI / 2;
    saddle.material = accent;
    group.add(saddle);
  } else if (style === 'hightop' || style === 'boots') {
    const tall = style === 'boots' ? 0.11 : 0.08;
    group.add(mesh(new THREE.CylinderGeometry(limbR * 1.25, limbR * 1.35, tall, 14), upper, x, shoeY + tall / 2, 0));
    if (style === 'hightop') {
      const band = mesh(new THREE.TorusGeometry(limbR * 1.3, 0.008, 6, 16), accent, x, shoeY + tall * 0.85, 0);
      band.rotation.x = PI / 2;
      group.add(band);
    }
  } else if (style === 'loafer') { // strap across the top
    group.add(mesh(new THREE.BoxGeometry(0.07, 0.012, 0.025), accent, x, shoeY + 0.04, 0.06));
  } else { // classic: laces
    for (let i = 0; i < 3; i++) group.add(mesh(new THREE.BoxGeometry(0.04, 0.006, 0.008), accent, x, shoeY + 0.045, 0.045 + i * 0.018));
  }
}

// ---------- extras ----------
function addNeckwear(group, look, neckR, neckY, shoulderY, frontZ, torsoLen) {
  const m = mat(look.neckColour, { shine: ['chain', 'pendant'].includes(look.neck) ? 90 : 18 });
  switch (look.neck) {
    case 'chain':
    case 'pendant': {
      const chain = mesh(new THREE.TorusGeometry(neckR * 1.55, 0.005, 6, 24), m, 0, neckY - 0.045, 0.012);
      chain.rotation.x = PI / 2 - 0.45;
      group.add(chain);
      if (look.neck === 'pendant') group.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 12), m, 0, neckY - 0.09, frontZ * 0.9).rotateX(PI / 2));
      return;
    }
    case 'pearls': { // a string of pearls whatever the colour picked
      const pearl = mat('#f6f0e4', { shine: 120 });
      const ringR = neckR * 1.75;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * PI * 2;
        const p = mesh(sphere(0.014, 8, 6), pearl, Math.sin(a) * ringR, 0, Math.cos(a) * ringR);
        const holder = new THREE.Group();
        holder.add(p);
        holder.position.set(0, neckY - 0.045, 0.018);
        holder.rotation.x = -0.45;
        group.add(holder);
      }
      return;
    }
    case 'tie': {
      group.add(mesh(new THREE.BoxGeometry(0.03, 0.026, 0.02), m, 0, shoulderY - 0.005, frontZ));
      const blade = mesh(new THREE.ConeGeometry(0.03, torsoLen * 0.95, 4), m, 0, shoulderY - 0.02 - torsoLen * 0.47, frontZ + 0.004);
      blade.rotation.z = PI;
      blade.rotation.y = PI / 4;
      blade.scale.z = 0.3;
      group.add(blade);
      return;
    }
    case 'bowtie': {
      for (const s of [-1, 1]) {
        const wing = mesh(new THREE.ConeGeometry(0.026, 0.05, 4), m, s * 0.026, shoulderY + 0.005, frontZ + 0.005);
        wing.rotation.z = s * PI / 2;
        wing.scale.z = 0.5;
        group.add(wing);
      }
      group.add(mesh(sphere(0.012, 8, 6), m, 0, shoulderY + 0.005, frontZ + 0.01));
      return;
    }
    case 'scarf': {
      const wrap = mesh(new THREE.TorusGeometry(neckR * 1.3, 0.024, 8, 20), m, 0, neckY - 0.01, 0);
      wrap.rotation.x = PI / 2;
      group.add(wrap);
      group.add(mesh(new THREE.BoxGeometry(0.045, torsoLen * 0.7, 0.014), m, 0.04, shoulderY - torsoLen * 0.3, frontZ + 0.006));
      return;
    }
    default:
  }
}

function addWristwear(shoulder, look, limbR, y, sleeved) {
  const m = mat(look.wristColour, { shine: look.wrist === 'bracelet' ? 90 : 30 });
  if (look.wrist === 'watch') {
    const strap = mesh(new THREE.TorusGeometry(limbR * 1.08, limbR * 0.18, 6, 16), m, 0, y, 0);
    strap.rotation.x = PI / 2;
    shoulder.add(strap);
    shoulder.add(mesh(new THREE.CylinderGeometry(limbR * 0.55, limbR * 0.55, limbR * 0.3, 14), mat('#e8eef2', { shine: 90 }), 0, y, limbR * 1.1).rotateX(PI / 2));
  } else if (look.wrist === 'sweatband') {
    shoulder.add(mesh(new THREE.CylinderGeometry(limbR * 1.22, limbR * 1.22, limbR * 1.1, 14), m, 0, y, 0));
  } else if (look.wrist === 'bracelet' && !sleeved) {
    const b = mesh(new THREE.TorusGeometry(limbR * 1.06, limbR * 0.12, 6, 16), m, 0, y, 0);
    b.rotation.x = PI / 2 + 0.2;
    shoulder.add(b);
  }
}

function addEarrings(head, look) {
  if (!look.ears || look.ears === 'none') return;
  const m = mat(look.earColour, { shine: 95 });
  for (const side of [-1, 1]) {
    const x = side * HEAD_R * 1.0;
    if (look.ears === 'studs') head.add(mesh(sphere(0.009, 8, 6), m, x, -0.04, 0.01));
    else if (look.ears === 'footballs') {
      // A little chain with a mini football swinging off it.
      head.add(mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.04, 5), m, x * 1.02, -0.065, 0.01));
      const ball = new THREE.Group();
      ball.position.set(x * 1.04, -0.105, 0.01);
      ball.add(mesh(sphere(0.024, 14, 10), mat('#ffffff', { shine: 40 })));
      const patch = mat('#1a1a1a');
      for (const [a, b] of [[0, 0], [2.1, 0.5], [4.2, -0.4], [1, 2.2], [3.3, 2.6]]) {
        // black patches: little spheres set into the ball's surface
        ball.add(mesh(sphere(0.0085, 8, 6), patch, Math.cos(a) * Math.cos(b - 1.2) * 0.0198, Math.sin(b - 1.2) * 0.0198, Math.sin(a) * Math.cos(b - 1.2) * 0.0198));
      }
      head.add(ball);
    }
    else {
      const hoop = mesh(new THREE.TorusGeometry(0.018, 0.0035, 6, 16), m, x, -0.058, 0.01);
      hoop.rotation.y = PI / 2;
      head.add(hoop);
    }
  }
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
  lashes: { w: 0.036, h: 0.04, lashes: true },
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
      if (eye.lashes) {
        // Three little flicks off the outer top edge of each eye.
        for (let i = 0; i < 3; i++) {
          const a = 0.5 + i * 0.35; // around the top-outer edge
          const lash = mesh(capsule(0.0032, 0.014), dark, ex + side * Math.cos(a) * eye.w * 0.95, ey + Math.sin(a) * eye.h * 0.95, z + 0.012);
          lash.rotation.z = -side * (PI / 2 - a);
          head.add(lash);
        }
      }
      if (eye.lid) {
        const lid = mesh(new THREE.SphereGeometry(1, 14, 8, 0, PI * 2, 0, PI / 2), skin, ex, ey + 0.002, z - 0.004);
        lid.scale.set(eye.w * 1.08, eye.h * 1.1, 0.026);
        head.add(lid);
      }
    }
    // Eyebrows
    const browStyle = look.brows;
    const thick = browStyle === 'bushy' ? 0.017 : browStyle === 'thick' ? 0.011 : 0.007;
    const brow = mesh(capsule(thick, browStyle === 'bushy' ? 0.05 : 0.04), mat(look.hairColour), ex, ey + 0.05 + (browStyle === 'arched' ? 0.008 : 0), z + (browStyle === 'bushy' ? 0.007 : 0.004));
    let tilt = PI / 2;
    if (browStyle === 'determined') tilt += side * 0.35;
    if (browStyle === 'bushy') { tilt += side * 0.12; brow.scale.set(1, 1, 0.75); } // heavy, slightly stern
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
  if (look.mouth === 'lipstick') {
    const red = mat('#d12c4a', { shine: 70 });
    const m = mesh(new THREE.TorusGeometry(0.028, 0.009, 6, 14, PI), red, 0, my + 0.012, z - 0.012);
    m.rotation.z = PI;
    head.add(m);
    const top = mesh(capsule(0.007, 0.03), red, 0, my + 0.008, z - 0.004);
    top.rotation.z = PI / 2;
    head.add(top);
  } else if (look.mouth === 'smile') {
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
    case 'pompadour': {
      // Short sides with a tall, glossy quiff swept up and back from the forehead.
      const gloss = mat(look.hairColour, { shine: 70 });
      head.add(hairCap(r, 1.35, h, 0.35));
      if (hatOn) return;
      const quiff = mesh(sphere(HEAD_R * 0.62, 20, 14), gloss, 0, HEAD_R * 0.86, HEAD_R * 0.22);
      quiff.scale.set(1.05, 0.75, 1.25);
      quiff.rotation.x = -0.35;
      head.add(quiff);
      const front = mesh(sphere(HEAD_R * 0.38, 16, 12), gloss, 0, HEAD_R * 0.98, HEAD_R * 0.58);
      front.scale.set(1.2, 0.85, 0.9);
      head.add(front);
      const back = mesh(sphere(HEAD_R * 0.55, 16, 12), gloss, 0, HEAD_R * 0.7, -HEAD_R * 0.28);
      back.scale.set(1.0, 0.7, 1.1);
      head.add(back);
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
    case 'undercut': {
      // Clipper-short sides, a long top swept over to one side.
      head.add(hairCap(HEAD_R * 1.01, 1.35, mat(look.hairColour, { shine: 5, opacity: 0.85 })));
      if (hatOn) return;
      const top = mesh(sphere(HEAD_R * 0.86, 20, 14), h, -0.012, HEAD_R * 0.62, 0.012);
      top.scale.set(1.08, 0.52, 1.12);
      top.rotation.z = 0.22;
      head.add(top);
      const sweep = mesh(capsule(0.042, 0.13), h, 0.05, HEAD_R * 0.62, HEAD_R * 0.55);
      sweep.rotation.set(0.35, 0, PI / 2 + 0.45);
      head.add(sweep);
      const flop = mesh(sphere(0.05, 12, 10), h, 0.115, HEAD_R * 0.5, HEAD_R * 0.5);
      flop.scale.set(0.8, 1.3, 0.8);
      head.add(flop);
      return;
    }
    case 'pigtails': {
      head.add(hairCap(r, 1.45, h));
      for (const side of [-1, 1]) {
        const tie = mesh(sphere(0.03, 10, 8), h, side * HEAD_R * 0.92, 0.04, -HEAD_R * 0.25);
        head.add(tie);
        const tail = mesh(capsule(0.036, 0.12), h, side * HEAD_R * 1.12, -0.04, -HEAD_R * 0.28);
        tail.rotation.z = side * 0.35;
        head.add(tail);
      }
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
  const m = fabric(look.hatColour, look.hatAccent, look.hatPattern, [3, 1]);
  const band = mat(look.hatAccent, { shine: 20 });
  const r = HEAD_R;
  const ring = (radius, tube, y, material = band) => {
    const t = mesh(new THREE.TorusGeometry(radius, tube, 8, 28), material, 0, y, 0);
    t.rotation.x = PI / 2;
    return t;
  };
  switch (look.hat) {
    case 'cap':
    case 'backwards':
    case 'trucker': {
      const back = look.hat === 'backwards';
      const dome = mesh(new THREE.SphereGeometry(r * 1.08, 24, 12, 0, PI * 2, 0, PI / 2), m, 0, r * 0.12, 0);
      head.add(dome);
      if (look.hat === 'trucker') { // contrasting front panel
        const panel = mesh(new THREE.SphereGeometry(r * 1.095, 16, 10, PI * 0.25, PI * 0.5, 0.15, PI / 2 - 0.15), band, 0, r * 0.12, 0);
        panel.rotation.y = PI / 2 - PI * 0.5;
        head.add(panel);
      }
      head.add(brim(r * 0.8, look.hat === 'trucker' ? band : m, r * 0.16, back ? -r * 0.55 : r * 0.55, back));
      head.add(mesh(sphere(0.018, 8, 6), band, 0, r * 1.2, 0));
      return;
    }
    case 'fedora': {
      const crown = mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.92, r * 0.62, 24), m, 0, r * 0.68, 0);
      crown.scale.z = 0.92;
      head.add(crown);
      const dent = mesh(new THREE.BoxGeometry(r * 0.12, r * 0.08, r * 1.2), mat(look.hatColour), 0, r * 0.99, 0);
      head.add(dent);
      head.add(ring(r * 0.9, 0.018, r * 0.45));
      head.add(mesh(new THREE.CylinderGeometry(r * 1.42, r * 1.42, 0.012, 30), m, 0, r * 0.38, 0));
      return;
    }
    case 'cowboy': {
      const crown = mesh(new THREE.CylinderGeometry(r * 0.72, r * 0.9, r * 0.75, 24), m, 0, r * 0.74, 0);
      crown.scale.z = 0.85;
      head.add(crown);
      head.add(ring(r * 0.88, 0.016, r * 0.45));
      const brimDisc = mesh(new THREE.CylinderGeometry(r * 1.55, r * 1.55, 0.012, 30), m, 0, r * 0.38, 0);
      brimDisc.scale.set(1.15, 1, 0.9);
      head.add(brimDisc);
      for (const side of [-1, 1]) { // curled-up sides
        const curl = mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, r * 1.6, 12, 1, true, 0, PI), m, side * r * 1.55, r * 0.6, 0);
        curl.rotation.x = PI / 2;
        curl.rotation.z = side > 0 ? 0 : PI;
        curl.material = m;
        head.add(curl);
      }
      return;
    }
    case 'boater': {
      head.add(mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.98, r * 0.42, 26), m, 0, r * 0.58, 0));
      head.add(ring(r * 0.98, 0.022, r * 0.47));
      head.add(mesh(new THREE.CylinderGeometry(r * 1.45, r * 1.45, 0.012, 30), m, 0, r * 0.38, 0));
      return;
    }
    case 'beret':
    case 'tam': {
      const beret = mesh(sphere(r * (look.hat === 'tam' ? 1.2 : 1.12), 22, 14), m, look.hat === 'beret' ? r * 0.12 : 0, r * 0.62, -0.01);
      beret.scale.set(1, 0.38, 1);
      beret.rotation.z = look.hat === 'beret' ? -0.25 : 0;
      head.add(beret);
      head.add(ring(r * 1.0, 0.016, r * 0.5, look.hat === 'tam' ? band : m));
      if (look.hat === 'tam') head.add(mesh(sphere(0.045, 10, 8), band, 0, r * 0.98, 0));
      else head.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6), m, r * 0.12, r * 0.85, 0));
      return;
    }
    case 'bow': { // a big hair bow on one side
      const bow = new THREE.Group();
      for (const s of [-1, 1]) {
        const wing = mesh(new THREE.ConeGeometry(0.05, 0.09, 4), m, s * 0.045, 0, 0);
        wing.rotation.z = s * PI / 2;
        wing.scale.z = 0.45;
        bow.add(wing);
      }
      bow.add(mesh(sphere(0.022, 10, 8), band, 0, 0, 0.004));
      bow.position.set(r * 0.5, r * 0.88, -r * 0.05);
      bow.rotation.set(-0.2, 0, -0.45);
      head.add(bow);
      return;
    }
    case 'headband': {
      const hb = mesh(new THREE.TorusGeometry(r * 1.02, 0.026, 8, 30), m, 0, r * 0.42, 0);
      hb.rotation.x = PI / 2 - 0.12;
      hb.scale.y = 1;
      head.add(hb);
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
  const clear = look.lensColour === '#cfe8ff';
  const shadesByDefault = ['sunglasses', 'aviators', 'sport', 'goggles', 'heart'].includes(look.glasses);
  const lensMat = mat(look.lensColour ?? '#1a2230', { opacity: clear ? 0.25 : 0.82, shine: 95 });
  const showLens = shadesByDefault || !clear;
  const z = HEAD_R * 0.97;
  const y = 0.015;
  const style = look.glasses;

  if (style === 'sport') { // one wraparound visor
    const visor = mesh(new THREE.CylinderGeometry(HEAD_R * 1.04, HEAD_R * 1.04, 0.05, 24, 1, true, -PI * 0.34, PI * 0.68), lensMat, 0, y, 0);
    head.add(visor);
    const top = mesh(new THREE.TorusGeometry(HEAD_R * 1.045, 0.006, 6, 24, PI * 0.68), frame, 0, y + 0.026, 0);
    top.rotation.set(PI / 2, 0, PI * 0.16);
    head.add(top);
    return;
  }
  if (style === 'goggles') {
    const strap = mesh(new THREE.TorusGeometry(HEAD_R * 1.03, 0.012, 6, 28), frame, 0, y, 0);
    strap.rotation.x = PI / 2;
    head.add(strap);
  }

  for (const side of [-1, 1]) {
    const x = side * 0.062;
    let rim;
    if (style === 'square') {
      rim = mesh(new THREE.TorusGeometry(0.04, 0.006, 6, 4), frame, x, y, z);
      rim.rotation.z = PI / 4;
      rim.scale.set(1.15, 0.85, 1);
    } else if (style === 'halfrim') {
      rim = mesh(new THREE.TorusGeometry(0.036, 0.007, 6, 16, PI), frame, x, y, z);
      rim.scale.set(1.15, 0.8, 1);
    } else if (style === 'cateye') {
      rim = mesh(new THREE.TorusGeometry(0.036, 0.006, 6, 20), frame, x, y, z);
      rim.scale.set(1.2, 0.8, 1);
      const flick = mesh(new THREE.ConeGeometry(0.012, 0.03, 4), frame, x + side * 0.038, y + 0.024, z);
      flick.rotation.z = -side * 0.9;
      head.add(flick);
    } else if (style === 'goggles') {
      rim = mesh(new THREE.TorusGeometry(0.036, 0.012, 8, 20), frame, x, y, z + 0.006);
    } else if (style === 'heart') {
      rim = heartMesh(0.04, frame, x, y, z);
      head.add(rim);
      const lens = heartMesh(0.033, lensMat, x, y, z + 0.002);
      head.add(lens);
      rim = null;
    } else {
      rim = mesh(new THREE.TorusGeometry(0.034, 0.005, 6, 20), frame, x, y, z);
      if (style === 'aviators') rim.scale.set(1.1, 0.95, 1);
      if (style === 'sunglasses') rim.scale.set(1.2, 0.8, 1);
    }
    if (rim) {
      head.add(rim);
      if (showLens) {
        const lens = mesh(new THREE.CircleGeometry(0.034, 20), lensMat, x, y, z - 0.001 + (style === 'goggles' ? 0.006 : 0));
        lens.scale.copy(rim.scale);
        head.add(lens);
      }
    }
    if (style !== 'goggles') {
      head.add(mesh(new THREE.BoxGeometry(0.006, 0.006, HEAD_R * 0.9), frame, side * HEAD_R * 0.86, y + 0.01, z - HEAD_R * 0.5));
    }
  }
  head.add(mesh(new THREE.BoxGeometry(0.03, 0.006, 0.006), frame, 0, y + 0.012, z + 0.004));
}

// A flat heart (for the heart-shaped glasses).
function heartMesh(size, material, x, y, z) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -size);
  shape.bezierCurveTo(size * 1.3, -size * 0.2, size * 0.9, size * 0.9, 0, size * 0.35);
  shape.bezierCurveTo(-size * 0.9, size * 0.9, -size * 1.3, -size * 0.2, 0, -size);
  return mesh(new THREE.ShapeGeometry(shape, 10), material, x, y, z);
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
