import { createSession } from './state.js';
import { CATALOG } from './courses/catalog.js';
import { createGameScene } from './scene.js';
import { createHUD } from './hud.js';
import { createGameController } from './game/controller.js';
import { createSwingInput } from './input/swing.js';

// Entry point: wires state, 3D scene, rules, input and HUD together, and handles screen-level
// concerns (resizing, pausing in the background, blocking browser gestures that fight the game).

const stage = document.getElementById('stage');
const loading = document.getElementById('loading');

const session = createSession();
const game = createGameScene(document.getElementById('scene'));
const hud = createHUD(session, {
  onPlayAgain: () => controller.startHole(CATALOG.hole(session.state.holeIndex)),
});
const controller = createGameController({ game, session, hud });
createSwingInput(stage, controller.input);

// React to state changes: load holes, toggle the binocular camera.
let loadedHoleIndex = -1;
session.subscribe((s) => {
  if (s.holeIndex !== loadedHoleIndex) {
    loadedHoleIndex = s.holeIndex;
    const hole = CATALOG.hole(s.holeIndex);
    if (hole) {
      session.set({ hole });
      controller.startHole(hole);
    }
  }
  game.setLookAhead(s.lookAhead);
});

// Resize whenever the stage changes size: rotation, browser bars sliding, desktop windows.
const sizeStage = () => {
  const r = stage.getBoundingClientRect();
  game.resize(r.width, r.height);
};
new ResizeObserver(sizeStage).observe(stage);
sizeStage();

document.addEventListener('visibilitychange', () => game.setPaused(document.hidden));

// iOS Safari: stop pinch-zoom and the long-press callout from hijacking the game.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
stage.addEventListener('contextmenu', (e) => e.preventDefault());

game.start(
  () => {
    clearTimeout(window.__kgFail);
    loading.classList.add('is-done');
    setTimeout(() => { loading.hidden = true; }, 600);
  },
  (dt) => controller.update(dt)
);
