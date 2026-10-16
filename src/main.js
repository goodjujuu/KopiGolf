import { createSession } from './state.js';
import { CATALOG } from './courses/catalog.js';
import { createGameScene } from './scene.js';
import { createHUD } from './hud.js';
import { createGameController } from './game/controller.js';
import { createSwingInput } from './input/swing.js';
import { createHome, loadSavedSettings } from './ui/home.js';
import { createLocker } from './ui/locker.js';
import { createTourScreen } from './ui/tour.js';

// Entry point: wires state, 3D scene, rules, input and HUD together, and handles screen-level
// concerns (resizing, pausing in the background, blocking browser gestures that fight the game).

const stage = document.getElementById('stage');
const loading = document.getElementById('loading');

const session = createSession();
session.set({ settings: loadSavedSettings() });
const game = createGameScene(document.getElementById('scene'));

// Practice mode always plays the practice map. (Match play will choose holes from CATALOG.)
let currentHole = CATALOG.practice;
const restartHole = () => controller.startHole(currentHole);
const playTour = (index) => {
  const hole = CATALOG.tour.hole(index);
  if (!hole) return;
  currentHole = hole;
  session.set({ screen: 'play', mode: 'tour', tourIndex: index, tourCount: CATALOG.tour.count, hole });
  controller.startHole(hole, session.state.settings);
};
const goHome = () => session.set({ screen: 'home', mapOpen: false, bagOpen: false });

const hud = createHUD(session, {
  onPlayAgain: restartHole,
  onNextHole: () => playTour(session.state.tourIndex + 1),
  onRestart: restartHole,
  onHome: goHome,
  onSelectClub: (id) => controller.selectClub(id),
});
const controller = createGameController({ game, session, hud });
createSwingInput(stage, controller.input);

createHome(session, {
  onStartPractice: (settings) => {
    currentHole = CATALOG.practice;
    session.set({ screen: 'play', mode: 'practice', settings, hole: currentHole });
    controller.startHole(currentHole, settings);
  },
});

createLocker(session, { onChange: (look) => game.setLook(look) });
document.getElementById('btn-open-locker').addEventListener('click', () => session.set({ screen: 'locker' }));
createTourScreen(session, { onPlay: playTour });
document.getElementById('btn-open-tour').addEventListener('click', () => session.set({ screen: 'tour' }));

// The course sits behind the home screen as a live backdrop, seen from the look-ahead camera.
session.set({ hole: currentHole });
controller.startHole(currentHole);

let lastTimeOfDay = session.state.settings.timeOfDay;
session.subscribe((s) => {
  game.setLookAhead(s.lookAhead || s.screen === 'home');
  // Preview the time of day while choosing it on the home screen.
  if (s.settings.timeOfDay !== lastTimeOfDay) {
    lastTimeOfDay = s.settings.timeOfDay;
    game.setTimeOfDay(lastTimeOfDay);
  }
});

// Resize whenever the stage changes size: rotation, browser bars sliding, desktop windows.
const sizeStage = () => {
  const r = stage.getBoundingClientRect();
  game.resize(r.width, r.height);
};
new ResizeObserver(sizeStage).observe(stage);
sizeStage();

// Pause the course while the tab is hidden or the Locker (with its own preview) is open.
const updatePaused = () => game.setPaused(document.hidden || session.state.screen === 'locker' || session.state.screen === 'tour');
document.addEventListener('visibilitychange', updatePaused);
session.subscribe(updatePaused);

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
