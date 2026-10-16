import { METRES_TO_YARDS, MS_TO_MPH, THEMES, CLUBS, CLUB_ORDER } from './config.js';
import { holeLength, holeAimYaw } from './courses/catalog.js';
import { hillFootprint } from './physics/terrain.js';
import { BIOMES } from './courses/biomes.js';

// DOM overlay: hole badge, buttons, power meter, club chip, shot feedback, result card and the
// overhead map. It reads the session and writes intents back to it; it never touches the 3D scene.

export function createHUD(session, { onPlayAgain, onNextHole, onSelectClub, onRestart, onHome }) {
  const el = (id) => document.getElementById(id);
  const ui = {
    num: el('hole-num'),
    name: el('hole-name'),
    meta: el('hole-meta'),
    sr: el('hole-sr'),
    hud: document.querySelector('.hud'),
    homeBtn: el('btn-home'),
    windChip: el('wind-chip'),
    windArrow: el('wind-arrow'),
    windText: el('wind-text'),
    mapBtn: el('btn-map'),
    restartBtn: el('btn-restart'),
    lookBtn: el('btn-look'),
    sheet: el('map-sheet'),
    closeBtn: el('btn-map-close'),
    mapKicker: el('map-kicker'),
    mapTitle: el('map-title'),
    mapDist: el('map-dist'),
    mapCanvas: el('map-canvas'),
    power: el('power'),
    powerFill: el('power-fill'),
    powerLabel: el('power-label'),
    hint: el('swing-hint'),
    clubChip: el('club-chip'),
    clubChipBadge: el('club-chip-badge'),
    clubChipText: el('club-chip-text'),
    bagSheet: el('bag-sheet'),
    bagGrid: el('bag-grid'),
    bagKicker: el('bag-kicker'),
    bagClose: el('btn-bag-close'),
    showYardages: el('show-yardages'),
    toast: el('toast'),
    toastTitle: el('toast-title'),
    toastSub: el('toast-sub'),
    result: el('result'),
    resultKicker: el('result-kicker'),
    resultTitle: el('result-title'),
    resultLine: el('result-line'),
    againBtn: el('btn-again'),
    nextBtn: el('btn-next'),
  };

  const tap = () => { try { navigator.vibrate?.(8); } catch { /* not supported on iPhone */ } };

  ui.mapBtn.addEventListener('click', () => { tap(); session.set({ mapOpen: !session.state.mapOpen }); });
  ui.lookBtn.addEventListener('click', () => { tap(); session.set({ lookAhead: !session.state.lookAhead }); });
  ui.closeBtn.addEventListener('click', () => session.set({ mapOpen: false }));
  ui.sheet.addEventListener('click', (e) => { if (e.target === ui.sheet) session.set({ mapOpen: false }); });
  ui.againBtn.addEventListener('click', () => { tap(); onPlayAgain(); });
  ui.nextBtn.addEventListener('click', () => { tap(); onNextHole(); });
  ui.homeBtn.addEventListener('click', () => { tap(); onHome(); });

  // ----- Restart: with shots on the card, the first tap asks "Restart?" and the second confirms -----
  let confirmTimer = 0;
  const resetRestartBtn = () => {
    clearTimeout(confirmTimer);
    ui.restartBtn.classList.remove('is-confirm');
    ui.restartBtn.setAttribute('aria-label', 'Restart hole');
  };
  ui.restartBtn.addEventListener('click', () => {
    tap();
    const nothingToLose = session.state.strokes === 0 && !session.state.result;
    if (nothingToLose || ui.restartBtn.classList.contains('is-confirm')) {
      resetRestartBtn();
      onRestart();
      return;
    }
    ui.restartBtn.classList.add('is-confirm');
    ui.restartBtn.setAttribute('aria-label', 'Tap again to restart the hole and clear your strokes');
    confirmTimer = setTimeout(resetRestartBtn, 3000);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (session.state.mapOpen) session.set({ mapOpen: false });
    if (session.state.bagOpen) session.set({ bagOpen: false });
  });

  // ----- Club picker -----
  const cards = buildClubCards(ui.bagGrid);
  ui.clubChip.addEventListener('click', () => {
    if (session.state.phase !== 'idle') return;
    tap();
    session.set({ bagOpen: true });
  });
  ui.bagClose.addEventListener('click', () => session.set({ bagOpen: false }));
  ui.bagSheet.addEventListener('click', (e) => { if (e.target === ui.bagSheet) session.set({ bagOpen: false }); });
  ui.bagGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.club-card');
    if (!card) return;
    tap();
    onSelectClub(card.dataset.club);
    session.set({ bagOpen: false });
  });
  const YARDAGE_KEY = 'kopigolf.showYardages';
  try { ui.showYardages.checked = localStorage.getItem(YARDAGE_KEY) !== 'false'; } catch { /* storage blocked */ }
  const applyYardages = () => ui.bagGrid.classList.toggle('hide-yardages', !ui.showYardages.checked);
  ui.showYardages.addEventListener('change', () => {
    applyYardages();
    try { localStorage.setItem(YARDAGE_KEY, String(ui.showYardages.checked)); } catch { /* storage blocked */ }
  });
  applyYardages();

  let lastMapOpen = false;
  let lastBagOpen = false;
  let lastResult = null;
  session.subscribe((s) => {
    const yardsToPin = Math.round((s.toPin ?? 0) * METRES_TO_YARDS);
    if (s.hole) {
      const holeYards = Math.round(holeLength(s.hole) * METRES_TO_YARDS);
      ui.num.textContent = s.hole.practice ? 'P' : s.hole.number;
      ui.name.textContent = s.hole.city ?? s.hole.name;
      ui.meta.textContent = `Par ${s.hole.par} · ${s.strokes} ${s.strokes === 1 ? 'stroke' : 'strokes'}`;
      ui.sr.textContent = `${s.hole.practice ? 'Practice' : `Hole ${s.hole.number}`}, ${s.hole.name}, par ${s.hole.par}, ${holeYards} yards, ${s.strokes} strokes so far.`;
      ui.mapKicker.textContent = `Hole ${s.hole.number} · Par ${s.hole.par}`;
      ui.mapTitle.textContent = s.hole.city ? `${s.hole.city} · ${s.hole.name}` : s.hole.name;
      ui.mapDist.textContent = `${yardsToPin} yd to the pin`;
    }
    ui.hud.hidden = s.screen !== 'play';

    // Wind chip: arrow shows where the wind blows relative to the way you're aiming.
    const windOn = s.wind && s.wind.speed >= 0.5;
    ui.windChip.hidden = !windOn;
    if (windOn) {
      const mph = Math.round(s.wind.speed * MS_TO_MPH);
      const rel = s.wind.yaw - (s.aimYaw ?? 0);           // 0 = blowing straight down your line
      const deg = (-rel * 180) / Math.PI;                  // yaw turns left; screen rotation turns right
      ui.windArrow.style.transform = `rotate(${deg}deg)`;
      ui.windText.textContent = `${mph} mph`;
      ui.windChip.setAttribute('aria-label', `Wind ${mph} miles per hour, ${describeWind(rel)}`);
    }

    const club = CLUBS[s.club] ?? CLUBS['7i'];
    ui.clubChipBadge.textContent = club.id;
    ui.clubChipText.textContent = `${club.name} · ${yardsToPin} yd to pin`;
    ui.clubChip.setAttribute('aria-label', `${club.name}, ${yardsToPin} yards to the pin. Change club`);
    ui.clubChip.hidden = s.phase !== 'idle' && s.phase !== 'swing';
    for (const [id, card] of cards) {
      card.setAttribute('aria-pressed', String(id === s.club));
      card.querySelector('.club-card-tag').hidden = id !== s.suggestedClub;
    }
    ui.hint.hidden = Boolean(s.hintSeen) || (s.phase !== 'idle' && s.phase !== 'swing');

    ui.mapBtn.setAttribute('aria-pressed', String(s.mapOpen));
    ui.lookBtn.setAttribute('aria-pressed', String(s.lookAhead));
    ui.lookBtn.setAttribute('aria-label', s.lookAhead ? 'Back to the ball' : 'Look toward the pin');

    if (s.mapOpen !== lastMapOpen) {
      lastMapOpen = s.mapOpen;
      ui.sheet.hidden = !s.mapOpen;
      if (s.mapOpen) {
        drawMap(ui.mapCanvas, s.hole, s.ballAt);
        ui.closeBtn.focus({ preventScroll: true });
      } else {
        ui.mapBtn.focus({ preventScroll: true });
      }
    }

    if (s.bagOpen !== lastBagOpen) {
      lastBagOpen = Boolean(s.bagOpen);
      ui.bagSheet.hidden = !s.bagOpen;
      if (s.bagOpen) {
        ui.bagKicker.textContent = `${yardsToPin} yd to the pin`;
        cards.get(s.club)?.focus({ preventScroll: true });
      } else {
        ui.clubChip.focus({ preventScroll: true });
      }
    }

    if (s.result !== lastResult) {
      lastResult = s.result;
      ui.result.hidden = !s.result;
      if (s.result) {
        ui.resultKicker.textContent = s.hole ? (s.hole.practice ? `Practice · ${s.hole.name}` : `Hole ${s.hole.number} · ${s.hole.city}`) : '';
        const hasNext = s.mode === 'tour' && s.tourIndex + 1 < s.tourCount;
        ui.nextBtn.hidden = !hasNext;
        ui.resultTitle.textContent = s.result.title;
        ui.resultLine.textContent = `${s.result.strokes} ${s.result.strokes === 1 ? 'stroke' : 'strokes'} on a par ${s.result.par}`;
        (hasNext ? ui.nextBtn : ui.againBtn).focus({ preventScroll: true });
      }
    }
  });

  let toastTimer = 0;
  return {
    // Vertical meter that fills as you pull the club back. Pass null to hide it.
    showPower(fraction) {
      if (fraction === null) { ui.power.classList.remove('is-on'); return; }
      ui.power.classList.add('is-on');
      ui.power.classList.toggle('is-max', fraction >= 0.98);
      ui.powerFill.style.transform = `scaleY(${fraction})`;
      ui.powerLabel.textContent = `${Math.round(fraction * 100)}%`;
    },
    // Short message in the upper part of the screen, e.g. "Perfect!" after a shot.
    toast(title, sub = '') {
      ui.toastTitle.textContent = title;
      ui.toastSub.textContent = sub;
      ui.toast.classList.remove('is-on');
      void ui.toast.offsetWidth; // restart the entry animation
      ui.toast.classList.add('is-on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => ui.toast.classList.remove('is-on'), 1900);
    },
  };
}

// Plain-words wind direction for screen readers, from the angle between wind and aim.
function describeWind(rel) {
  const a = Math.atan2(Math.sin(rel), Math.cos(rel)); // wrap to −π..π
  const deg = (a * 180) / Math.PI;
  if (Math.abs(deg) <= 30) return 'helping, behind you';
  if (Math.abs(deg) >= 150) return 'against you, in your face';
  return deg > 0 ? 'blowing from right to left' : 'blowing from left to right';
}

// One card per club, in bag order, styled after the Golf Dreams club picker.
function buildClubCards(grid) {
  const cards = new Map();
  for (const id of CLUB_ORDER) {
    const club = CLUBS[id];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `club-card tier-${club.tier}`;
    card.dataset.club = id;
    card.setAttribute('aria-label', club.yards ? `${club.name}, ${club.yards} yards` : club.name);
    card.innerHTML =
      `<span class="club-card-id" aria-hidden="true">${club.id}</span>` +
      `<span class="club-card-tag" hidden>Best</span>` +
      CLUB_ART[club.kind] +
      `<span class="club-card-yds" aria-hidden="true">${club.yards ? `${club.yards} yds` : 'Putt'}</span>`;
    grid.appendChild(card);
    cards.set(id, card);
  }
  return cards;
}

// Simple club-head drawings for the cards (viewBox 64 × 48).
const CLUB_ART = {
  putter: `<svg class="club-card-art" viewBox="0 0 64 48" aria-hidden="true"><path d="M44 2 41 30" stroke="#1d1f2b" stroke-width="5" stroke-linecap="round"/><rect x="14" y="27" width="34" height="13" rx="2" fill="#eef1f6"/><rect x="14" y="36" width="34" height="4" rx="1" fill="#b9c1cc"/><path d="M47 43c3-2 5 2 8 0s5-2 7 0" stroke="#1d1f2b" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  wood: `<svg class="club-card-art" viewBox="0 0 64 48" aria-hidden="true"><path d="M50 2 44 22" stroke="#fff3c4" stroke-width="5" stroke-linecap="round"/><path d="M10 30c0-9 13-13 26-12 9 1 13 6 12 12-1 8-11 12-22 12C15 42 10 38 10 30Z" fill="#ffe08a"/><path d="M14 31c6 4 20 5 31 1" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".85"/><path d="M18 24c6-3 15-3 22-1" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/></svg>`,
  iron: `<svg class="club-card-art" viewBox="0 0 64 48" aria-hidden="true"><path d="M52 2 44 20" stroke="#f3f4f8" stroke-width="5" stroke-linecap="round"/><path d="M16 22 46 16c3 0 4 2 3 5l-5 19c-1 2-2 3-5 3H18c-4 0-6-3-5-6l3-15Z" fill="#f3f4f8"/><path d="M20 27h22M19 31h22M18 35h22" stroke="#b7bccb" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  wedge: `<svg class="club-card-art" viewBox="0 0 64 48" aria-hidden="true"><path d="M53 2 45 18" stroke="#2a2f3a" stroke-width="5" stroke-linecap="round"/><path d="M14 20 47 14c3 0 4 2 3 5l-5 20c-1 3-3 4-6 4H17c-4 0-6-3-5-6l2-17Z" fill="#2a2f3a"/><path d="M19 26h23M18 30h23M17 34h23" stroke="#4a5262" stroke-width="1.6" stroke-linecap="round"/></svg>`,
};

// Overhead map drawn from the same hole data as the 3D world, rotated so the tee is at the
// bottom and the pin is at the top. Handles the practice island and World Tour courses.
function drawMap(canvas, hole, ballAt) {
  if (!hole) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const theme = hole.island ? THEMES[hole.theme] : { ...BIOMES[hole.biome], foliageAlt: 0x3f6a2e, sand: BIOMES[hole.biome].beach, flag: 0xf2483f };
  const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

  // Local frame: u = right of the tee–pin line, v = distance down it.
  const yaw = holeAimYaw(hole);
  const fwd = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const [tx, , tz] = hole.tee;
  const toLocal = (x, z) => ({ u: (x - tx) * right.x + (z - tz) * right.z, v: (x - tx) * fwd.x + (z - tz) * fwd.z });

  // Fit the whole hole: tee, pin and fairway corners, with a margin.
  const pts = hole.path ? hole.path.map(([x, z]) => toLocal(x, z)) : [toLocal(tx, tz), toLocal(hole.pin[0], hole.pin[2])];
  const margin = hole.path ? 40 : 14;
  const vMin = Math.min(...pts.map((p) => p.v)) - margin;
  const vMax = Math.max(...pts.map((p) => p.v)) + margin + (hole.path ? 10 : 12);
  const uSpan = Math.max(...pts.map((p) => Math.abs(p.u))) + margin;
  const scale = Math.min(cssH / (vMax - vMin), cssW / (2 * uSpan));
  const P = (x, z) => {
    const { u, v } = toLocal(x, z);
    return { x: cssW / 2 + u * scale, y: cssH - (v - vMin) * scale - (cssH - (vMax - vMin) * scale) / 2 };
  };

  // Ground
  if (hole.island) {
    ctx.fillStyle = hex(theme.water);
    ctx.fillRect(0, 0, cssW, cssH);
    const ic = P(hole.island.center[0], hole.island.center[2]);
    circle(ctx, ic.x, ic.y, (hole.island.radius + 6) * scale, hex(theme.sand));
    circle(ctx, ic.x, ic.y, hole.island.radius * scale, hex(theme.rough));
  } else {
    ctx.fillStyle = hex(theme.rough);
    ctx.fillRect(0, 0, cssW, cssH);
    if (hole.sea) drawSea(ctx, hole.sea, P, cssW, cssH, hex(theme.beach), hex(theme.water));
  }
  for (const [hx, hz, r] of hole.hills) {
    const p = P(hx, hz);
    circle(ctx, p.x, p.y, hillFootprint(r) * scale, hex(theme.hill));
  }

  // Fairway
  ctx.strokeStyle = hex(theme.fairway);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (hole.fairway?.points) {
    ctx.lineWidth = hole.fairway.width * scale;
    hole.fairway.points.forEach(([x, z], i) => { const p = P(x, z); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
  } else {
    ctx.lineWidth = hole.fairwayWidth * scale;
    const a = P(tx - fwd.x * 6, tz - fwd.z * 6);
    const b = P(hole.pin[0] + fwd.x * 6, hole.pin[2] + fwd.z * 6);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();

  // Hazards
  for (const pond of hole.ponds ?? []) drawEllipse(ctx, pond, P, scale, yaw, hex(theme.water));
  for (const b of hole.bunkers ?? []) drawEllipse(ctx, b, P, scale, yaw, hex(theme.bunker));

  // Green
  const pin = P(hole.pin[0], hole.pin[2]);
  ctx.fillStyle = hex(theme.green);
  ctx.beginPath();
  ctx.ellipse(pin.x, pin.y, hole.greenRadius * 1.4 * scale, hole.greenRadius * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trees (a sample of them, as dots)
  const trees = hole.palms ? hole.palms.map(([x, z]) => [x, z]) : (hole.trees ?? []).map(([, x, z]) => [x, z]);
  ctx.fillStyle = 'rgba(30, 60, 30, 0.55)';
  for (const [x, z] of trees) {
    const p = P(x, z);
    if (p.x < -4 || p.y < -4 || p.x > cssW + 4 || p.y > cssH + 4) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(2, 3 * scale), 0, Math.PI * 2);
    ctx.fill();
  }

  // Line from the ball to the pin
  const tee = P(tx, tz);
  const from = ballAt ? P(ballAt.x, ballAt.z) : tee;
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(pin.x, pin.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Tee, ball and flag
  circle(ctx, tee.x, tee.y, 6, '#163a2a');
  circle(ctx, tee.x, tee.y, 4, '#ffffff');
  if (ballAt && Math.hypot(ballAt.x - tx, ballAt.z - tz) > 1) {
    circle(ctx, from.x, from.y, 6, '#163a2a');
    circle(ctx, from.x, from.y, 4, '#ffd84a');
  }
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

// Rotated ellipse hazard ({ x, z, rx, rz, yaw }) in map space.
function drawEllipse(ctx, e, P, scale, mapYaw, fill) {
  const c = P(e.x, e.z);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, e.rx * scale, e.rz * scale, -(e.yaw - mapYaw), 0, Math.PI * 2);
  ctx.fill();
}

// Fill the sea side of the coastline (with a strip of beach) across the whole map.
function drawSea(ctx, sea, P, w, h, beachColour, waterColour) {
  const band = (offset, colour) => {
    const along = { x: -sea.nz, z: sea.nx };
    const ox = sea.x + sea.nx * offset;
    const oz = sea.z + sea.nz * offset;
    const far = 6000;
    const corners = [
      P(ox - along.x * far, oz - along.z * far),
      P(ox + along.x * far, oz + along.z * far),
      P(ox + along.x * far + sea.nx * far, oz + along.z * far + sea.nz * far),
      P(ox - along.x * far + sea.nx * far, oz - along.z * far + sea.nz * far),
    ];
    ctx.fillStyle = colour;
    ctx.beginPath();
    corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
  };
  band(-sea.beach, beachColour);
  band(0, waterColour);
}

function circle(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
