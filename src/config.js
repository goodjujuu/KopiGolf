// Every screen-dependent number and every colour lives here.

export const LAYOUT = {
  // The camera's HORIZONTAL field of view is locked, so every phone shows the same fairway width;
  // taller phones simply reveal more sky and ground. (The stage is capped at 3:4 in CSS.)
  horizontalFovDeg: 42,
  minVerticalFovDeg: 50,
  // Where the ball sits on screen, from the top (0) to the bottom (1). The camera pitch is solved
  // per screen so this holds on every aspect ratio.
  ballScreenY: 0.74,
  // Camera rig relative to the ball, in metres.
  cameraHeight: 1.15,
  cameraBack: 1.9,
  // Binoculars view: hover this high, part of the way to the pin.
  lookAheadHeight: 9,
  lookAheadFraction: 0.35,
  // Cap the render resolution so big phones stay smooth and cool.
  maxPixelRatio: 2,
};

// Ground layers sit slightly above each other so they never flicker.
export const SURFACE = { rough: 0, fairway: 0.03, green: 0.06 };

// Course art palettes. 100+ holes reuse a handful of themes to keep the look cohesive.
export const THEMES = {
  tropical: {
    skyTop: 0x5fc4f2,
    skyHorizon: 0xc9f0fb,
    rough: 0x6aa834,
    fairway: 0x86c442,
    green: 0x9fdc5c,
    hill: 0x4c8c33,
    water: 0x3fd0d8,
    sand: 0xf2e19e,
    trunk: 0x8c6b42,
    trunkAlt: 0x7a5c38,
    foliage: 0x8dd136,
    foliageAlt: 0x6fb12a,
    wood: 0x6e4a2c,
    flag: 0xf2483f,
  },
};

export const METRES_TO_YARDS = 1.09361;
export const DEG = Math.PI / 180;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The bag, in Golf Dreams order. `yards` is the full-power carry. `kind` picks the 3D head shape;
// `tier` picks the card colour in the club picker.
// Putter distance is how far it rolls on the green at full power.
export const CLUB_ORDER = ['P', 'D', '3w', '3i', '4i', '5i', '6i', '7i', '8i', '9i', 'Pw', 'Sw', 'Lw'];
export const CLUBS = {
  P: { id: 'P', name: 'Putter', kind: 'putter', tier: 'putter', maxRoll: 16, maxBackswing: 0.7 },
  D: { id: 'D', name: 'Driver', kind: 'wood', tier: 'wood', yards: 280, launchDeg: 12 },
  '3w': { id: '3w', name: '3 wood', kind: 'wood', tier: 'wood', yards: 250, launchDeg: 14 },
  '3i': { id: '3i', name: '3 iron', kind: 'iron', tier: 'long', yards: 230, launchDeg: 17 },
  '4i': { id: '4i', name: '4 iron', kind: 'iron', tier: 'long', yards: 210, launchDeg: 19 },
  '5i': { id: '5i', name: '5 iron', kind: 'iron', tier: 'mid', yards: 200, launchDeg: 21 },
  '6i': { id: '6i', name: '6 iron', kind: 'iron', tier: 'mid', yards: 190, launchDeg: 24 },
  '7i': { id: '7i', name: '7 iron', kind: 'iron', tier: 'long', yards: 180, launchDeg: 27 },
  '8i': { id: '8i', name: '8 iron', kind: 'iron', tier: 'mid', yards: 170, launchDeg: 31 },
  '9i': { id: '9i', name: '9 iron', kind: 'iron', tier: 'mid', yards: 150, launchDeg: 35 },
  Pw: { id: 'Pw', name: 'Pitching wedge', kind: 'wedge', tier: 'wedge', yards: 140, launchDeg: 40 },
  Sw: { id: 'Sw', name: 'Sand wedge', kind: 'wedge', tier: 'wedge', yards: 120, launchDeg: 45 },
  Lw: { id: 'Lw', name: 'Lob wedge', kind: 'wedge', tier: 'mid', yards: 100, launchDeg: 50 },
};
export const FULL_BACKSWING = 1.75; // radians, for every club except the putter

// Swing gesture tuning. Distances are fractions of the stage height so every phone feels the same.
export const SWING = {
  startThresholdPx: 10,         // movement before we decide between aiming and swinging
  fullDrawFraction: 0.28,       // pull down this much of the screen height = 100% power
  reverseThresholdPx: 14,       // how far back up the finger must move to start the downswing
  minPower: 0.05,               // smaller pull-backs are treated as accidental taps
  idealFlickSeconds: 0.25,      // flick from the bottom back past the start in this time or less = full tempo
  minTempo: 0.55,               // a very slow flick still hits, at 55% of the power (putts ignore tempo)
  maxSlope: 0.5,                // sideways drift per pixel of flick that counts as fully crooked
  maxDeviationDeg: 10,          // launch direction error for a fully crooked flick
  curveMissFraction: 0.08,      // a fully crooked flick also bends the ball this share of the carry sideways
  aimDegPerPx: 0.15,            // sideways drag to aim
  maxAimOffsetDeg: 60,
};

// Ball physics. Units: metres, seconds.
export const PHYSICS = {
  gravity: 9.81,
  ballRadius: 0.045,     // a real golf ball is 42.7 mm across
  airDrag: 0.08,
  minBounceSpeed: 1.2,
  restSpeed: 0.08,
  cupRadius: 0.11,       // generous for touch play (a real cup is 0.054 m)
  captureSpeed: 2.6,     // roll slower than this over the cup and it drops
  // bounce: vertical speed kept · keep: horizontal speed kept on a bounce · roll: rolling friction
  surfaces: {
    green: { bounce: 0.25, keep: 0.55, roll: 0.16 },
    fairway: { bounce: 0.3, keep: 0.6, roll: 0.32 },
    rough: { bounce: 0.22, keep: 0.45, roll: 0.6 },
    sand: { bounce: 0.08, keep: 0.25, roll: 1.4 },
  },
};

export const REDUCED_MOTION =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
