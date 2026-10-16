// A hole is DATA, not code. The world builder turns this into 3D at load time, so growing to
// 100+ holes means adding entries (by hand, with a level editor, or from a generator).
//
// Units are metres. +x is right, +y is up, −z points from the tee toward the green.

export const PACK_01 = {
  id: 'pack_01_tropical',
  title: 'Palm Isles',
  holes: [
    {
      id: 'palm-isles-01',
      number: 1,
      name: 'Coconut Run',
      par: 3,
      theme: 'tropical',
      tee: [0, 0, 0],
      pin: [4, 0, -62],
      fairwayWidth: 18,
      greenRadius: 7,
      island: { center: [0, 0, -45], radius: 85 },
      // [x, z, radius]: grassy mounds on the island
      hills: [
        [-34, -82, 14],
        [-55, -60, 18],
        [30, -100, 8],
      ],
      // [x, z, radius]: other islands out at sea, for the horizon
      farIslands: [
        [-150, -190, 28],
        [120, -210, 22],
        [210, -120, 16],
      ],
      // [x, z, scale, yawDegrees]
      palms: [
        [-22, -78, 1.3, 10],
        [-17, -82, 1.1, 80],
        [-26, -86, 1.5, 140],
        [-12, -88, 1.0, 200],
        [-31, -70, 1.2, 45],
        [-40, -40, 1.0, 90],
        [-44, -58, 1.3, 15],
        [14, -84, 1.0, 300],
        [20, -80, 1.2, 20],
        [26, -86, 0.9, 250],
        [33, -100, 1.1, 120],
      ],
      // [x, z]: wooden tee markers either side of the ball
      teeMarkers: [
        [-0.8, -0.7],
        [0.8, -0.7],
      ],
    },
  ],
};
