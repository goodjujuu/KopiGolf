import * as THREE from 'three';

// Fabric patterns for avatar clothing, drawn on a small canvas in two colours (main + accent).
// The same drawing feeds the 3D textures (patternTexture) and the Locker's preview tiles
// (patternPreview), so the tile always shows what you'll wear.

export const PATTERNS = [
  ['solid', 'Plain'], ['stripes', 'Stripes'], ['pinstripe', 'Pinstripe'], ['gingham', 'Gingham'],
  ['tartan', 'Tartan'], ['argyle', 'Argyle'], ['dots', 'Polka dots'], ['camo', 'Camo'],
  ['floral', 'Hawaiian'], ['chevron', 'Chevron'], ['twotone', 'Two-tone'], ['racing', 'Racing stripe'],
];

const SIZE = 128;

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

// A tiny seeded random so camo and florals look the same every time.
function rng(seed) {
  let a = seed * 2654435761 >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawPattern(ctx, id, base, accent, size = SIZE) {
  const s = size;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = accent;
  ctx.strokeStyle = accent;
  switch (id) {
    case 'stripes':
      for (let y = 0; y < s; y += s / 4) ctx.fillRect(0, y, s, s / 8);
      break;
    case 'pinstripe':
      ctx.globalAlpha = 0.9;
      for (let x = 0; x < s; x += s / 8) ctx.fillRect(x, 0, Math.max(1, s / 64), s);
      ctx.globalAlpha = 1;
      break;
    case 'gingham':
      ctx.globalAlpha = 0.55;
      for (let x = 0; x < s; x += s / 4) ctx.fillRect(x, 0, s / 8, s);
      for (let y = 0; y < s; y += s / 4) ctx.fillRect(0, y, s, s / 8);
      ctx.globalAlpha = 1;
      break;
    case 'tartan':
      ctx.globalAlpha = 0.6;
      for (let x = 0; x < s; x += s / 2) { ctx.fillRect(x, 0, s / 5, s); ctx.fillRect(0, x, s, s / 5); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = shade(base, 0.55);
      for (let x = s / 3; x < s; x += s / 2) { ctx.fillRect(x, 0, s / 40, s); ctx.fillRect(0, x, s, s / 40); }
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.6;
      for (let x = s / 8; x < s; x += s / 2) { ctx.fillRect(x, 0, s / 64, s); ctx.fillRect(0, x, s, s / 64); }
      ctx.globalAlpha = 1;
      break;
    case 'argyle': {
      const w = s / 2;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          ctx.beginPath();
          const cx = i * w + w / 2;
          const cy = j * w + w / 2;
          ctx.moveTo(cx, cy - w / 2); ctx.lineTo(cx + w / 2, cy); ctx.lineTo(cx, cy + w / 2); ctx.lineTo(cx - w / 2, cy);
          ctx.closePath();
          ctx.globalAlpha = (i + j) % 2 ? 0.45 : 1;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = shade(base, 1.6);
      ctx.lineWidth = s / 64;
      ctx.beginPath();
      for (let k = -s; k < 2 * s; k += w) { ctx.moveTo(k, 0); ctx.lineTo(k + s, s); ctx.moveTo(k + s, 0); ctx.lineTo(k, s); }
      ctx.stroke();
      break;
    }
    case 'dots':
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          ctx.beginPath();
          ctx.arc((x + (y % 2) * 0.5) * (s / 4) + s / 8, y * (s / 4) + s / 8, s / 18, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    case 'camo': {
      const r = rng(7);
      const blobs = [shade(base, 0.7), accent, shade(accent, 0.65)];
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = blobs[i % 3];
        ctx.beginPath();
        const x = r() * s;
        const y = r() * s;
        ctx.ellipse(x, y, s * (0.07 + r() * 0.08), s * (0.04 + r() * 0.05), r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
        // wrap round the edges so the tile repeats without seams
        ctx.beginPath();
        ctx.ellipse(x - s * Math.sign(x - s / 2), y, s * 0.06, s * 0.04, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'floral': {
      const r = rng(11);
      for (let i = 0; i < 7; i++) {
        const x = r() * s;
        const y = r() * s;
        const rad = s * (0.06 + r() * 0.04);
        ctx.fillStyle = i % 3 === 2 ? shade(base, 1.5) : accent;
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2 + i;
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * rad, y + Math.sin(a) * rad, rad * 0.75, rad * 0.45, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#f6d24a';
        ctx.beginPath();
        ctx.arc(x, y, rad * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = shade(base, 0.7);
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.ellipse(r() * s, r() * s, s * 0.05, s * 0.018, r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'chevron':
      ctx.lineWidth = s / 12;
      for (let y = -s / 4; y < s + s / 4; y += s / 4) {
        ctx.beginPath();
        for (let x = 0; x <= s; x += s / 4) ctx.lineTo(x, y + ((x / (s / 4)) % 2 ? s / 8 : 0));
        ctx.stroke();
      }
      break;
    case 'twotone':
      ctx.fillRect(0, s / 2, s, s / 2);
      break;
    case 'racing':
      ctx.fillRect(s * 0.4, 0, s * 0.2, s);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.7;
      ctx.fillRect(s * 0.37, 0, s * 0.02, s);
      ctx.fillRect(s * 0.61, 0, s * 0.02, s);
      ctx.globalAlpha = 1;
      break;
    default: // solid
  }
}

const canvasCache = new Map();
function patternCanvas(id, base, accent) {
  const key = `${id}|${base}|${accent}`;
  if (!canvasCache.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    drawPattern(canvas.getContext('2d'), id, base, accent);
    canvasCache.set(key, canvas);
  }
  return canvasCache.get(key);
}

// Texture for a 3D part. `repeat` sets how many times it tiles round and along the part.
const textureCache = new Map();
export function patternTexture(id, base, accent, repeat = [2, 2]) {
  const key = `${id}|${base}|${accent}|${repeat}`;
  if (!textureCache.has(key)) {
    const tex = new THREE.CanvasTexture(patternCanvas(id, base, accent));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(key, tex);
  }
  return textureCache.get(key);
}

// Little swatch for the Locker tiles.
export function patternPreview(id, base, accent) {
  return patternCanvas(id, base, accent).toDataURL();
}
