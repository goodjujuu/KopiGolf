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

export const REDUCED_MOTION =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
