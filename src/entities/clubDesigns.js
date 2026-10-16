// One design per club, shared by the 3D club head (entities/club.js) and the club picker art
// (ui/clubArt.js) so what you pick is what you swing.
//
// Iron and wedge heads are described by their outline seen from behind (the view you get
// standing over the ball), in "head units": u runs from the heel (0, where the hosel joins) out
// to the toe (len), v runs up from the sole (0). One head unit is 0.1 m in the 3D world.
//
//   blade:  muscle-back irons (long irons), number stamped on the toe
//   cavity: cavity-back irons, coloured badge with the number in the middle of the back
//   wedge:  dark satin finish, tall rounded toe, loft stamped on the back, wider sole for a sand wedge
//   wood:   big rounded head; crown colour and alignment mark; driver biggest
//   putter: blade putter with a sight line and plumber's neck

export const CLUB_DESIGNS = {
  P: { style: 'putter' },
  D: { style: 'wood', size: 1.0, crown: 0x1c1e24, accent: 0xf2c230, label: 'D', loft: 10 },
  '3w': { style: 'wood', size: 0.8, crown: 0x22386a, accent: 0xe8edf2, label: '3', loft: 15 },
  '3i': { style: 'blade', len: 0.98, toeH: 0.56, heelH: 0.38, loft: 20, num: '3' },
  '4i': { style: 'blade', len: 0.96, toeH: 0.6, heelH: 0.4, loft: 23, num: '4' },
  '5i': { style: 'cavity', len: 0.95, toeH: 0.64, heelH: 0.42, loft: 26, num: '5', badge: 0xe0412a },
  '6i': { style: 'cavity', len: 0.94, toeH: 0.68, heelH: 0.44, loft: 29, num: '6', badge: 0xf2a71b },
  '7i': { style: 'cavity', len: 0.93, toeH: 0.72, heelH: 0.46, loft: 33, num: '7', badge: 0x2fa65a },
  '8i': { style: 'cavity', len: 0.92, toeH: 0.76, heelH: 0.48, loft: 37, num: '8', badge: 0x2a8fd6 },
  '9i': { style: 'cavity', len: 0.91, toeH: 0.8, heelH: 0.5, loft: 41, num: '9', badge: 0x7b4dd6 },
  Pw: { style: 'wedge', len: 0.9, toeH: 0.86, heelH: 0.52, loft: 46, num: '46', sole: 0.1 },
  Sw: { style: 'wedge', len: 0.9, toeH: 0.9, heelH: 0.54, loft: 56, num: '56', sole: 0.2 },
  Lw: { style: 'wedge', len: 0.88, toeH: 0.98, heelH: 0.56, loft: 60, num: '60', sole: 0.13 },
};

// Outline of an iron / wedge head as path commands in head units (closed).
// ['M', u, v] move, ['L', u, v] line, ['Q', cu, cv, u, v] quadratic curve.
export function ironOutline({ len, toeH, heelH }) {
  return [
    ['M', 0.04, 0],
    ['L', len - 0.2, -0.015], // sole, dipping a touch toward the toe
    ['Q', len + 0.02, -0.015, len + 0.01, toeH * 0.48], // round up the toe
    ['Q', len, toeH, len - 0.2, toeH], // rounded top of the toe
    ['L', 0.1, heelH], // topline down to the heel
    ['Q', 0.0, heelH, -0.005, heelH * 0.62], // into the hosel
    ['L', 0.0, 0.05],
    ['Q', 0.0, 0.0, 0.04, 0],
  ];
}
