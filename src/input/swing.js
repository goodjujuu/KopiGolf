import { SWING, clamp } from '../config.js';

// Turns touches (or mouse drags) on the play area into golf actions:
//
//   drag sideways first        → aim          handlers.aim(dxPixels)
//   drag down                  → backswing    handlers.back(fraction 0..1) while the club follows the finger
//   then flick back up past    → impact       handlers.impact({ power, rawPower, tempo, deviation })
//   where the finger started
//   lift before impact         → cancel       handlers.cancel()
//
//   power     how far you pulled back (rawPower), scaled down if the flick was slow (tempo)
//   tempo     1 for a quick flick, down to SWING.minTempo for a slow push
//   deviation −1 (flicked toward the left) … 0 (straight up) … +1 (toward the right)

export function createSwingInput(surface, handlers) {
  let mode = 'none'; // 'none' | 'pending' | 'aim' | 'back' | 'down'
  let pointerId = null;
  let start = null;
  let bottom = null;
  let lastX = 0;
  let height = 1;

  const finish = () => {
    if (pointerId !== null) surface.releasePointerCapture?.(pointerId);
    mode = 'none';
    pointerId = null;
  };

  surface.addEventListener('pointerdown', (e) => {
    if (mode !== 'none' || e.button > 0) return;
    if (e.target.closest('button, .map-sheet, .result, .home, .locker, .tour')) return;
    if (!handlers.canStart()) return;
    pointerId = e.pointerId;
    mode = 'pending';
    start = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    lastX = e.clientX;
    height = surface.clientHeight || window.innerHeight;
    try { surface.setPointerCapture(pointerId); } catch { /* older browsers */ }
    handlers.begin?.();
  });

  surface.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    const x = e.clientX;
    const y = e.clientY;
    const t = e.timeStamp;
    const dx = x - start.x;
    const dy = y - start.y;

    if (mode === 'pending') {
      if (Math.abs(dx) > SWING.startThresholdPx && Math.abs(dx) > Math.abs(dy) * 1.2) mode = 'aim';
      else if (dy > SWING.startThresholdPx) { mode = 'back'; bottom = { x, y, t }; }
      else return;
    }

    if (mode === 'aim') {
      handlers.aim(x - lastX);
      lastX = x;
      return;
    }

    const fullDraw = height * SWING.fullDrawFraction;
    const frac = clamp(dy / fullDraw, 0, 1);

    if (mode === 'back') {
      if (y >= bottom.y) bottom = { x, y, t };
      else if (bottom.y - y > SWING.reverseThresholdPx) mode = 'down';
      else bottom.t = t; // still lingering at the bottom: the flick timer starts when it leaves
      handlers.back(frac);
      return;
    }

    // mode === 'down'
    if (y > bottom.y) { // went back down again: carry on with the backswing
      mode = 'back';
      bottom = { x, y, t };
      handlers.back(frac);
      return;
    }
    if (y > start.y) { handlers.back(frac); return; }

    // The finger has come back past where it started: impact.
    const rawPower = clamp((bottom.y - start.y) / fullDraw, 0, 1);
    finish();
    if (rawPower < SWING.minPower) { handlers.cancel(); return; }
    const rise = Math.max(1, bottom.y - y);
    const seconds = Math.max(0.001, (t - bottom.t) / 1000);
    const tempo = clamp(SWING.idealFlickSeconds / seconds, SWING.minTempo, 1);
    const deviation = clamp((x - bottom.x) / rise / SWING.maxSlope, -1, 1);
    handlers.impact({ power: rawPower * tempo, rawPower, tempo, deviation });
  });

  const end = (e) => {
    if (e.pointerId !== pointerId) return;
    const wasSwinging = mode === 'back' || mode === 'down';
    finish();
    if (wasSwinging) handlers.cancel();
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
}
