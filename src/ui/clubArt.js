import { CLUB_DESIGNS, ironOutline } from '../entities/clubDesigns.js';

// Club-head drawings for the club picker (viewBox 64 × 48), drawn from the same designs as the
// 3D heads. Irons and wedges are shown from the back, the way you see them over the ball:
// muscle-back blades with the number on the toe, cavity-backs with a coloured badge, dark
// wedges with their loft stamped on, woods by their crown, the putter by its sight line.

const HEEL_X = 50; // where the hosel meets the head
const SOLE_Y = 45;
const S = 34; // px per head unit
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

const X = (u) => +(HEEL_X - u * S).toFixed(1); // toe points left, shaft up to the right
const Y = (v) => +(SOLE_Y - v * S).toFixed(1);

function pathFrom(commands) {
  return commands.map(([c, ...n]) => {
    if (c === 'Q') return `Q${X(n[0])} ${Y(n[1])} ${X(n[2])} ${Y(n[3])}`;
    return `${c}${X(n[0])} ${Y(n[1])}`;
  }).join('') + 'Z';
}

function shaft(fromX, fromY, color) {
  return `<path d="M${fromX} ${fromY} 58 1" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;
}

function ironArt(id, d) {
  const wedge = d.style === 'wedge';
  const body = wedge ? '#2c313b' : '#eef0f5';
  const shade = wedge ? '#1e222a' : '#c7ccd8';
  const ink = wedge ? '#c9cfda' : '#3a3f4c';
  const outline = pathFrom(ironOutline(d));
  const clip = `club-clip-${id}`;
  const hoselTop = Y(d.heelH) - 5;
  let detail = '';
  if (d.style === 'blade') {
    // Polished muscle bar low on the back, a mirror glint, number stamped on the toe.
    detail += `<rect x="${X(d.len)}" y="${Y(0.2)}" width="${(d.len) * S}" height="${0.1 * S}" fill="#d6dae4"/>`;
    detail += `<text x="${X(d.len * 0.74)}" y="${Y(d.toeH * 0.3)}" font-size="12" text-anchor="middle" fill="${ink}">${d.num}</text>`;
  } else if (d.style === 'cavity') {
    // Recessed cavity (following the rising topline) with a coloured badge carrying the number.
    const top = (u) => d.heelH + ((u - 0.1) / (d.len - 0.3)) * (d.toeH - d.heelH) - 0.08;
    const u0 = 0.13;
    const u1 = d.len - 0.17;
    detail += `<path d="M${X(u0)} ${Y(0.13)}L${X(u1)} ${Y(0.13)}L${X(u1)} ${Y(top(u1))}L${X(u0)} ${Y(top(u0))}Z" fill="#d3d8e3" stroke="#d3d8e3" stroke-width="3" stroke-linejoin="round"/>`;
    const bu = d.len * 0.58;
    const bx = X(bu);
    const by = Y((0.13 + top(bu)) / 2);
    detail += `<ellipse cx="${bx}" cy="${by}" rx="7.5" ry="6" fill="${hex(d.badge)}"/>`;
    detail += `<text x="${bx}" y="${by + 3.8}" font-size="11" text-anchor="middle" fill="#fff">${d.num}</text>`;
  } else {
    // Wedge: satin black, loft stamped big, bounce flange along the sole.
    detail += `<rect x="${X(d.len) - 2}" y="${Y(d.sole)}" width="${d.len * S + 4}" height="${d.sole * S + 2}" fill="${shade}"/>`;
    detail += `<path d="M${X(d.len * 0.7)} ${Y(d.toeH * 0.95)} ${X(d.len * 0.5)} ${Y(d.sole)}" stroke="#fff" stroke-width="4" opacity=".12"/>`;
    detail += `<text x="${X(d.len * 0.62)}" y="${Y(d.toeH * 0.45)}" font-size="9.5" text-anchor="middle" fill="${ink}">${d.num}°</text>`;
  }
  return `<svg class="club-card-art" viewBox="0 0 64 48" aria-hidden="true">` +
    `<defs><clipPath id="${clip}"><path d="${outline}"/></clipPath></defs>` +
    shaft(HEEL_X + 3, hoselTop, '#e9ecf1') +
    `<path d="M${HEEL_X - 1} ${Y(d.heelH * 0.7)} ${HEEL_X + 3.5} ${hoselTop}" stroke="${body}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="${outline}" fill="${body}"/>` +
    `<g clip-path="url(#${clip})">` +
    (wedge ? '' : `<rect x="0" y="${Y(0.09)}" width="64" height="20" fill="${shade}"/>`) +
    detail +
    `</g>` +
    `<path d="M${X(0.12)} ${Y(d.heelH) + 1} ${X(d.len - 0.2)} ${Y(d.toeH) + 1}" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="${wedge ? 0.25 : 0.9}"/>` +
    `</svg>`;
}

function woodArt(d) {
  const k = d.size;
  const cx = 30;
  const cy = 30;
  const rx = 22 * k;
  const ry = 13 * k;
  const crown = hex(d.crown);
  const accent = hex(d.accent);
  // Pear-shaped head seen from behind: flatter face edge at the far side, big round back,
  // narrowing into the hosel at the heel (right).
  const P = (x, y) => `${(cx + x * rx).toFixed(1)} ${(cy + y * ry).toFixed(1)}`;
  const head = (dy) => `M${P(-1, -0.35 + dy)}Q${P(-0.1, -0.95 + dy)} ${P(0.8, -0.55 + dy)}Q${P(1.05, -0.3 + dy)} ${P(0.85, 0.15 + dy)}` +
    `Q${P(0.5, 1.05 + dy)} ${P(-0.25, 1 + dy)}Q${P(-1.15, 0.9 + dy)} ${P(-1, -0.35 + dy)}Z`;
  const stripes = d.label === 'D'
    ? `<path d="M${P(-0.12, -0.62)}L${P(0, -0.38)}L${P(0.12, -0.62)}" stroke="${accent}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M${P(-0.1, -0.68)}L${P(-0.1, 0.9)}M${P(0.1, -0.66)}L${P(0.1, 0.9)}" stroke="${accent}" stroke-width="1.8" stroke-linecap="round"/>`;
  return `<svg class="club-card-art" viewBox="0 0 64 48" aria-hidden="true">` +
    shaft(cx + rx * 0.8, cy - ry * 0.5, '#e9ecf1') +
    `<path d="${head(0.28)}" fill="#bfc6d1"/>` + // sole showing below
    `<path d="${head(0)}" fill="${crown}"/>` + // crown
    `<path d="M${P(-0.92, -0.42)}Q${P(-0.1, -1.0)} ${P(0.78, -0.6)}" stroke="#e7ebf0" stroke-width="${2.6 * k}" fill="none" stroke-linecap="round"/>` + // face edge
    `<path d="M${P(-0.6, 0.45)}Q${P(-0.1, 0.85)} ${P(0.4, 0.55)}" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".3"/>` + // gloss
    stripes +
    `</svg>`;
}

function putterArt() {
  return `<svg class="club-card-art" viewBox="0 0 64 48" aria-hidden="true">` +
    `<path d="M45 26h4v-6l3-1 5-18" stroke="#e9ecf1" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` + // plumber's neck
    `<rect x="11" y="26" width="42" height="18" rx="4" fill="#eef1f6"/>` +
    `<rect x="11" y="38" width="42" height="6" rx="3" fill="#bfc6d1"/>` +
    `<rect x="13" y="26" width="38" height="4" rx="2" fill="#fff"/>` +
    `<rect x="30.8" y="25" width="2.4" height="9" rx="1.2" fill="#e0412a"/>` + // sight line
    `<circle cx="20" cy="35" r="2.2" fill="#c7ccd8"/><circle cx="44" cy="35" r="2.2" fill="#c7ccd8"/>` +
    `</svg>`;
}

export function clubArt(club) {
  const d = CLUB_DESIGNS[club.id];
  if (!d) return '';
  if (d.style === 'putter') return putterArt();
  if (d.style === 'wood') return woodArt(d);
  return ironArt(club.id, d);
}
