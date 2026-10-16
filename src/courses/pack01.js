// A hole is DATA, not code. The world builder turns this into 3D at load time, so growing to
// 100+ holes means adding entries (by hand, with a level editor, or from a generator).
//
// Units are metres. +x is right, +y is up, −z points from the tee toward the green.

// The first real course pack goes here (the old hole 1 is now the practice map, see practice.js).
// Hole format: see PRACTICE_HOLE for a full example.
export const PACK_01 = {
  id: 'pack_01',
  title: 'Course pack 1',
  holes: [],
};
