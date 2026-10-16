// Single source of truth for game state. The 3D scene and the HUD both read from it;
// nothing talks to anything else directly. Multiplayer and wagers will extend this later.

export function createSession() {
  const listeners = new Set();
  const state = {
    screen: 'home',     // 'home' | 'locker' | 'tour' | 'play'
    mode: 'practice',   // 'practice' | 'tour' | 'match'
    match: null,        // best-of-3 match in progress (game/match.js)
    tourIndex: 0,
    tourCount: 0,
    settings: { timeOfDay: 'day', wind: 'calm' },
    wind: null,         // { speed, yaw, x, z } for the current hole
    aimYaw: 0,          // where the player is aiming (radians), for the wind arrow
    holeIndex: 0,
    hole: null,
    strokes: 0,
    phase: 'idle',      // 'idle' → 'swing' → 'flight' → 'settle' → 'idle' …, or 'penalty' / 'holed'
    club: '7i',         // id from CLUB_ORDER in config.js
    suggestedClub: '7i',
    bagOpen: false,     // club picker showing
    lieSurface: 'fairway',
    toPin: 0,           // metres from the ball to the pin
    ballAt: null,       // { x, z } of the ball's current lie
    result: null,       // { title, strokes, par } once the ball is in the cup
    hintSeen: false,    // hide the swing instructions after the first shot
    mapOpen: false,
    lookAhead: false,
  };

  return {
    get state() { return state; },
    set(patch) {
      Object.assign(state, patch);
      listeners.forEach((fn) => fn(state, patch));
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(state, state);
      return () => listeners.delete(fn);
    },
  };
}
