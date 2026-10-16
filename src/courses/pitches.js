// Pitches: what the hole is actually played on. Not every city course is grass — New York is
// played down a street, Cairo across desert hardpan, Zermatt on a ski piste, Reykjavík on ice.
// Each pitch sets the surface (and so the bounce and roll, see PHYSICS.surfaces in config.js)
// and look of the fairway and of the ground around it. The putting green is always a green.
//
//   fairway: { surface, color, label, deco }   deco = painted / patterned details on the strip
//   rough:   { surface, color, label } | null  null = keep the biome's own rough

export const PITCHES = {
  grass: {
    label: 'Grass',
    fairway: { surface: 'fairway', color: null, label: 'Fairway', deco: 'mown' },
    rough: null,
  },
  street: {
    label: 'Street',
    fairway: { surface: 'asphalt', color: 0x4a4e55, label: 'Street', deco: 'street' },
    rough: { surface: 'pavement', color: 0xb8b3aa, label: 'Sidewalk' },
  },
  plaza: {
    label: 'Plaza',
    fairway: { surface: 'cobbles', color: 0xb9a68a, label: 'Cobbles', deco: 'cobbles' },
    rough: null,
  },
  desert: {
    label: 'Desert',
    fairway: { surface: 'hardpan', color: 0xe3c58f, label: 'Hardpan', deco: 'ripples' },
    rough: { surface: 'sand', color: 0xd6aa66, label: 'Dunes' },
  },
  beach: {
    label: 'Beach',
    fairway: { surface: 'beach', color: 0xe9d29a, label: 'Firm sand', deco: 'ripples' },
    rough: { surface: 'sand', color: 0xf3e3b4, label: 'Soft sand' },
  },
  ski: {
    label: 'Ski piste',
    fairway: { surface: 'piste', color: 0xf7fafd, label: 'Piste', deco: 'corduroy' },
    rough: { surface: 'snow', color: 0xe4ecf4, label: 'Powder' },
  },
  ice: {
    label: 'Ice rink',
    fairway: { surface: 'ice', color: 0xcfe9f4, label: 'Ice', deco: 'rink' },
    rough: { surface: 'snow', color: 0xeef3f8, label: 'Snowbank' },
  },
  gravel: {
    label: 'Zen garden',
    fairway: { surface: 'gravel', color: 0xdcd8cc, label: 'Raked gravel', deco: 'raked' },
    rough: null,
  },
};

// Surfaces that play the part of a fairway (smooth, flat strip you aim down).
export const FAIRWAY_SURFACES = new Set(['fairway', 'asphalt', 'cobbles', 'hardpan', 'beach', 'piste', 'ice', 'gravel']);

export function pitchOf(hole) {
  return PITCHES[hole?.pitch] ?? PITCHES.grass;
}
