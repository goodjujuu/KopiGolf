// Single source of truth for game state. The 3D scene and the HUD both read from it;
// nothing talks to anything else directly. Multiplayer and wagers will extend this later.

export function createSession() {
  const listeners = new Set();
  const state = {
    holeIndex: 0,
    hole: null,
    strokes: 0,
    phase: 'idle',      // 'idle' → (next steps) 'swinging' → 'flight' → 'putting' → 'holed'
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
