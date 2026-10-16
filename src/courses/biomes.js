// Biomes: the look and feel of a course. Colours are for the low-poly world; `roughSurface`
// tells the physics what the ball lands in off the fairway; `trees` sets which tree models
// grow there (and how often), with the colours each model can take.

export const BIOMES = {
  summer: {
    label: 'Summer', rough: 0x7aa83a, fairway: 0x93c851, green: 0xa8dc66, tee: 0x9fd45c, hill: 0x6c9a34,
    bunker: 0xf0dfa6, lip: 0x8a6a42, beach: 0xf2e1a2, water: 0x3fb8d8, path: 0xe0cfa6, trunk: 0x7a5a3a,
    roughSurface: 'rough',
    trees: { round: 5, cypress: 3 },
    leaves: { round: [0x6aa83a, 0x5f9a32, 0x7cb848, 0x4f8a2e], cypress: [0x5c8f34, 0x4a7d2a] },
  },
  spring: {
    label: 'Spring', rough: 0x86bf4a, fairway: 0xa2d863, green: 0xb4e472, tee: 0xa8dc68, hill: 0x78ad40,
    bunker: 0xf3e4b2, lip: 0x8a6a42, beach: 0xf2e1a2, water: 0x48c0e0, path: 0xe6d6ae, trunk: 0x6e4e36,
    roughSurface: 'rough',
    trees: { blossom: 5, round: 3, cypress: 1 },
    leaves: { blossom: [0xf4b6c8, 0xf7c9d6, 0xe99ab3, 0xfbe3ea], round: [0x7cc24a, 0x8fd055], cypress: [0x5c9a34] },
  },
  autumn: {
    label: 'Autumn', rough: 0x93a048, fairway: 0xa7b85c, green: 0xadd06a, tee: 0xa4c060, hill: 0x868c3e,
    bunker: 0xeedcaa, lip: 0x7a5a3a, beach: 0xeedcaa, water: 0x3aa6c4, path: 0xd8c6a0, trunk: 0x5e4430,
    roughSurface: 'rough',
    trees: { round: 6, cypress: 1, pine: 1 },
    leaves: { round: [0xe0752a, 0xd9a02b, 0xc4462c, 0xe8c040, 0x8f9a35], cypress: [0xb8862e], pine: [0x4f6e34] },
  },
  snow: {
    label: 'Snow', rough: 0xeef3f8, fairway: 0xc4d6bc, green: 0xa9cc9a, tee: 0xd2e2cc, hill: 0xe4ecf3,
    bunker: 0xe9e4d4, lip: 0x9aa4ae, beach: 0xe8e2d0, water: 0x5aa8c8, path: 0xd6dde4, trunk: 0x5a4636,
    roughSurface: 'snow', snowfall: true,
    trees: { snowpine: 6, pine: 1 },
    leaves: { snowpine: [0x3f6a4a, 0x355e40], pine: [0x3f6a4a] },
  },
  desert: {
    label: 'Desert', rough: 0xe2c48a, fairway: 0x9cc55a, green: 0xa9d46a, tee: 0xa6cc62, hill: 0xd9b376,
    bunker: 0xf6e8bc, lip: 0xc19a62, beach: 0xf2dca4, water: 0x38c0cf, path: 0xcfae78, trunk: 0x8a6a42,
    roughSurface: 'sand',
    trees: { cactus: 3, palm: 3 },
    leaves: { cactus: [0x5f8f3e, 0x6c9a48], palm: [0x7fbf3a, 0x6aab2e] },
  },
  beach: {
    label: 'Beach', rough: 0x86b84a, fairway: 0x9ccd58, green: 0xaedf6c, tee: 0xa4d460, hill: 0x77a840,
    bunker: 0xf6e8bc, lip: 0x9a7a4a, beach: 0xf4e4b0, water: 0x37c7d6, path: 0xeadbb2, trunk: 0x8c6b42,
    roughSurface: 'rough',
    trees: { palm: 6, round: 1 },
    leaves: { palm: [0x8dd136, 0x6fb12a, 0x7fc232], round: [0x5f9a32] },
  },
  tropical: {
    label: 'Tropical', rough: 0x5f9e36, fairway: 0x7fc044, green: 0x96d65a, tee: 0x88c84c, hill: 0x4f8a2e,
    bunker: 0xf3e2b0, lip: 0x7a5a3a, beach: 0xf2e1a2, water: 0x33b9c9, path: 0xd9c9a0, trunk: 0x6e5034,
    roughSurface: 'rough',
    trees: { palm: 4, round: 4 },
    leaves: { palm: [0x8dd136, 0x6fb12a], round: [0x2f7a2e, 0x3d8a34, 0x4f9a3a] },
  },
  forest: {
    label: 'Forest', rough: 0x5a8a3a, fairway: 0x7cb04a, green: 0x92c95e, tee: 0x86bc52, hill: 0x4c7a30,
    bunker: 0xeedcaa, lip: 0x6a4e34, beach: 0xe8d8a8, water: 0x3a9fb8, path: 0xc8b48a, trunk: 0x5a3e2a,
    roughSurface: 'rough',
    trees: { pine: 7, round: 1 },
    leaves: { pine: [0x2f5e34, 0x3a6c3c, 0x27522c], round: [0x4f8a2e] },
  },
  alpine: {
    label: 'Alpine', rough: 0x74a548, fairway: 0x8fc45a, green: 0xa2d46a, tee: 0x96c85e, hill: 0x6a9a3e,
    bunker: 0xeee0b4, lip: 0x7a6a52, beach: 0xe8d8a8, water: 0x48b4d8, path: 0xcfc2a2, trunk: 0x5a4030,
    roughSurface: 'rough',
    trees: { pine: 5, snowpine: 2 },
    leaves: { pine: [0x2f5e34, 0x3a6c3c], snowpine: [0x3a6648] },
  },
};

// Skyline building colours by city style.
export const BUILDING_STYLES = {
  modern: [0x8fa3b8, 0x6f8296, 0xa8b8c8, 0x5d6b7a, 0xb7c4cf],
  classic: [0xd8c8a8, 0xc4b08a, 0xe2d6bc, 0xb59a74, 0xcfc0a0],
  mixed: [0x9aa6b2, 0xd2c4a6, 0x7d8a96, 0xb8aa8c, 0xc0c8d0],
  desert: [0xe6d2a8, 0xd8bc8a, 0xf0e2c4, 0xc8a878],
  colourful: [0xe8a87c, 0xf2d27a, 0x9ccbd8, 0xe7b0c4, 0xc8d89a, 0xf0e6d2],
};
