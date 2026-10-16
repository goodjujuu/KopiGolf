import { createSession } from './state.js';
import { CATALOG } from './courses/catalog.js';
import { createGameScene } from './scene.js';
import { createHUD } from './hud.js';
import { createGameController, drawWind } from './game/controller.js';
import { MAX_STROKES, createMatch, currentHole, finishHole, isLastTurn, nextHole, nextTurn, recordTurn } from './game/match.js';
import { createMatchSetup, createMatchOverlay } from './ui/match.js';
import { createOnlinePlay } from './game/onlinePlay.js';
import { createOnlineUI } from './ui/online.js';
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
let activeHole = CATALOG.practice;
const restartHole = () => controller.startHole(activeHole);
const playTour = (index) => {
  const hole = CATALOG.tour.hole(index);
  if (!hole) return;
  activeHole = hole;
  session.set({ screen: 'play', mode: 'tour', tourIndex: index, tourCount: CATALOG.tour.count, hole });
  controller.startHole(hole, session.state.settings);
};
const goHome = () => {
  if (session.state.mode === 'online') online.leave();
  session.set({ screen: 'home', mapOpen: false, bagOpen: false, match: null, mode: session.state.mode === 'match' || session.state.mode === 'online' ? 'tour' : session.state.mode });
};

// ---------- Random best of 3 (pass the phone) ----------
// Load the match's current hole with its shared wind; the hand-off card sits on top while the
// camera shows the hole. Each player starts fresh from the tee with the same conditions.
const loadMatchHole = () => {
  const m = session.state.match;
  const mh = currentHole(m);
  if (!mh.wind) mh.wind = drawWind(mh.windLevel);
  const hole = CATALOG.tour.hole(mh.course);
  activeHole = hole;
  session.set({ hole, match: m });
  controller.startHole(hole, session.state.settings, { wind: mh.wind, maxStrokes: MAX_STROKES });
  session.set({ lookAhead: m.stage === 'handoff' });
};
const startMatch = (names) => {
  const match = createMatch(names, { courseCount: CATALOG.tour.count });
  session.set({ screen: 'play', mode: 'match', match, mapOpen: false, bagOpen: false });
  loadMatchHole();
};
const matchAdvance = () => {
  const m = session.state.match;
  if (!m) return;
  if (m.stage === 'turnDone') {
    if (isLastTurn(m)) finishHole(m);
    else nextTurn(m);
  } else if (m.stage === 'holeResult') {
    nextHole(m);
  }
  session.set({ match: m });
  if (m.stage === 'handoff') loadMatchHole();
};

const hud = createHUD(session, {
  onPlayAgain: restartHole,
  onNextHole: () => playTour(session.state.tourIndex + 1),
  onRestart: restartHole,
  onHome: goHome,
  onSelectClub: (id) => controller.selectClub(id),
  onCancelSwing: () => swingInput.reset(),
});
const controller = createGameController({ game, session, hud });
const swingInput = createSwingInput(stage, controller.input);

createHome(session, {
  onStartPractice: (settings) => {
    activeHole = CATALOG.practice;
    session.set({ screen: 'play', mode: 'practice', settings, hole: activeHole });
    controller.startHole(activeHole, settings);
  },
});

createLocker(session, { onChange: (look) => game.setLook(look) });
document.getElementById('btn-open-locker').addEventListener('click', () => session.set({ screen: 'locker' }));
createTourScreen(session, { onPlay: playTour });
createMatchSetup({ onStart: startMatch });
// Online: friends on their own phones.
const online = createOnlinePlay({ session, controller, catalog: CATALOG, toast: (t, sub) => hud.toast(t, sub) });
createOnlineUI(session, online, { toast: (t, sub) => hud.toast(t, sub) });
createMatchOverlay(session, {
  onTeeOff: () => {
    const m = session.state.match;
    m.stage = 'playing';
    session.set({ match: m, lookAhead: false });
  },
  onNextTurn: matchAdvance,
  onNextHole: matchAdvance,
  onRematch: () => startMatch(session.state.match.players.map((p) => p.name)),
  onHome: goHome,
});
// A player holing out (or picking up) ends their turn.
session.subscribe((s) => {
  const m = s.match;
  if (s.mode !== 'match' || !m || m.stage !== 'playing' || !s.result) return;
  recordTurn(m, s.result.strokes, s.result.title);
  if (isLastTurn(m)) finishHole(m); // last player done: straight to who won the hole
  session.set({ match: m });
});
document.getElementById('btn-open-tour').addEventListener('click', () => session.set({ screen: 'tour' }));

// The course sits behind the home screen as a live backdrop, seen from the look-ahead camera.
session.set({ hole: activeHole });
controller.startHole(activeHole);

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
const updatePaused = () => game.setPaused(document.hidden || session.state.screen === 'locker' || session.state.screen === 'tour' || session.state.screen === 'lobby');
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
