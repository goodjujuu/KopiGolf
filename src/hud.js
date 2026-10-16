import { METRES_TO_YARDS, THEMES } from './config.js';
import { holeLength, holeAimYaw } from './courses/catalog.js';
import { hillFootprint } from './world/builder.js';

// DOM overlay: hole badge, map and binocular buttons, the overhead map sheet.
// It reads the session and writes intents back to it; it never touches the 3D scene.

export function createHUD(session) {
  const el = (id) => document.getElementById(id);
  const ui = {
    num: el('hole-num'),
    name: el('hole-name'),
    meta: el('hole-meta'),
    sr: el('hole-sr'),
    mapBtn: el('btn-map'),
    lookBtn: el('btn-look'),
    sheet: el('map-sheet'),
    closeBtn: el('btn-map-close'),
    mapKicker: el('map-kicker'),
    mapTitle: el('map-title'),
    mapDist: el('map-dist'),
    mapCanvas: el('map-canvas'),
  };

  const tap = () => { try { navigator.vibrate?.(8); } catch { /* not supported on iPhone */ } };

  ui.mapBtn.addEventListener('click', () => { tap(); session.set({ mapOpen: !session.state.mapOpen }); });
  ui.lookBtn.addEventListener('click', () => { tap(); session.set({ lookAhead: !session.state.lookAhead }); });
  ui.closeBtn.addEventListener('click', () => session.set({ mapOpen: false }));
  ui.sheet.addEventListener('click', (e) => { if (e.target === ui.sheet) session.set({ mapOpen: false }); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && session.state.mapOpen) session.set({ mapOpen: false }); });

  let lastMapOpen = false;
  session.subscribe((s) => {
    if (s.hole) {
      const yards = Math.round(holeLength(s.hole) * METRES_TO_YARDS);
      ui.num.textContent = s.hole.number;
      ui.name.textContent = s.hole.name;
      ui.meta.textContent = `Par ${s.hole.par} · ${yards} yd · ${s.strokes} ${s.strokes === 1 ? 'stroke' : 'strokes'}`;
      ui.sr.textContent = `Hole ${s.hole.number}, ${s.hole.name}, par ${s.hole.par}, ${yards} yards.`;
      ui.mapKicker.textContent = `Hole ${s.hole.number} · Par ${s.hole.par}`;
      ui.mapTitle.textContent = s.hole.name;
      ui.mapDist.textContent = `${yards} yd to the pin`;
    }
    ui.mapBtn.setAttribute('aria-pressed', String(s.mapOpen));
    ui.lookBtn.setAttribute('aria-pressed', String(s.lookAhead));
    ui.lookBtn.setAttribute('aria-label', s.lookAhead ? 'Back to the ball' : 'Look toward the pin');

    if (s.mapOpen !== lastMapOpen) {
      lastMapOpen = s.mapOpen;
      ui.sheet.hidden = !s.mapOpen;
      if (s.mapOpen) {
        drawMap(ui.mapCanvas, s.hole);
        ui.closeBtn.focus({ preventScroll: true });
      } else {
        ui.mapBtn.focus({ preventScroll: true });
      }
    }
  });
}

// Overhead map drawn from the same hole data as the 3D world, rotated so the tee is at the
// bottom and the pin is at the top.
function drawMap(canvas, hole) {
  if (!hole) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const theme = THEMES[hole.theme];
  const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

  // Local frame: u = right of the target line, v = distance down the target line.
  const yaw = holeAimYaw(hole);
  const fwd = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const [tx, , tz] = hole.tee;
  const toLocal = (x, z) => ({ u: (x - tx) * right.x + (z - tz) * right.z, v: (x - tx) * fwd.x + (z - tz) * fwd.z });

  const len = holeLength(hole);
  const vMin = -14;
  const vMax = len + 26;
  const scale = cssH / (vMax - vMin);
  const P = (x, z) => {
    const { u, v } = toLocal(x, z);
    return { x: cssW / 2 + u * scale, y: cssH - (v - vMin) * scale };
  };

  ctx.fillStyle = hex(theme.water);
  ctx.fillRect(0, 0, cssW, cssH);

  const ic = P(hole.island.center[0], hole.island.center[2]);
  circle(ctx, ic.x, ic.y, (hole.island.radius + 6) * scale, hex(theme.sand));
  circle(ctx, ic.x, ic.y, hole.island.radius * scale, hex(theme.rough));

  for (const [hx, hz, r] of hole.hills) {
    const p = P(hx, hz);
    circle(ctx, p.x, p.y, hillFootprint(r) * scale, hex(theme.hill));
  }

  // Fairway
  const w = hole.fairwayWidth * scale;
  const top = cssH - (len + 6 - vMin) * scale;
  const bottom = cssH - (-6 - vMin) * scale;
  ctx.fillStyle = hex(theme.fairway);
  roundRect(ctx, cssW / 2 - w / 2, top, w, bottom - top, w / 2);
  ctx.fill();

  // Green
  const pin = P(hole.pin[0], hole.pin[2]);
  ctx.fillStyle = hex(theme.green);
  ctx.beginPath();
  ctx.ellipse(pin.x, pin.y, hole.greenRadius * 1.4 * scale, hole.greenRadius * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  for (const [px, pz] of hole.palms) {
    const p = P(px, pz);
    circle(ctx, p.x, p.y, 3.2, hex(theme.foliageAlt));
  }

  // Target line
  const tee = P(tx, tz);
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tee.x, tee.y);
  ctx.lineTo(pin.x, pin.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Tee and flag
  circle(ctx, tee.x, tee.y, 6, '#163a2a');
  circle(ctx, tee.x, tee.y, 4, '#ffffff');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pin.x, pin.y);
  ctx.lineTo(pin.x, pin.y - 18);
  ctx.stroke();
  ctx.fillStyle = hex(theme.flag);
  ctx.beginPath();
  ctx.moveTo(pin.x, pin.y - 18);
  ctx.lineTo(pin.x + 12, pin.y - 14);
  ctx.lineTo(pin.x, pin.y - 10);
  ctx.closePath();
  ctx.fill();
}

function circle(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
