import { PRACTICE_HOLE } from './practice.js';
import { TOUR } from './tour.js';
import { pathLength } from './generate.js';

// Every playable map: the practice island and the World Tour (see tour.js to add more).
export const CATALOG = {
  practice: PRACTICE_HOLE, // Practice mode always plays this one map
  tour: TOUR,
};

// Playing length from tee to pin, in metres (along the fairway on doglegs).
export function holeLength(hole) {
  if (hole.path) return pathLength(hole.path);
  const dx = hole.pin[0] - hole.tee[0];
  const dz = hole.pin[2] - hole.tee[2];
  return Math.hypot(dx, dz);
}

// Yaw (radians about +y) that turns the −z axis to face from the tee toward the pin.
export function holeAimYaw(hole) {
  const dx = hole.pin[0] - hole.tee[0];
  const dz = hole.pin[2] - hole.tee[2];
  return Math.atan2(-dx, -dz);
}
