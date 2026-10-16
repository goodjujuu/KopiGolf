import { PACK_01 } from './pack01.js';
import { PRACTICE_HOLE } from './practice.js';

// Holes come in packs (e.g. 18 per pack) so the list can pass 100 without one giant file.
// To add a pack: create packNN.js next to this file and add it to COURSE_PACKS.
const COURSE_PACKS = [PACK_01];

export const CATALOG = {
  practice: PRACTICE_HOLE, // Practice mode always plays this one map
  packs: COURSE_PACKS,
  holes: COURSE_PACKS.flatMap((p) => p.holes).sort((a, b) => a.number - b.number),
  hole(index) {
    return this.holes[index] ?? null;
  },
};

// Straight-line distance from tee to pin, in metres.
export function holeLength(hole) {
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
