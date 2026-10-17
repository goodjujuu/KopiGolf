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
import { createLineup } from './ui/lineup.js';
import { createSoloPlay } from './game/soloPlay.js';
import { createSoloUI } from './ui/solo.js';
import { createHomeMe } from './ui/homeMe.js';
import { lookForName } from './avatar/looks.js';

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
  if (session.state.mode === 'solo') solo.quit();
  session.set({ screen: 'home', mapOpen: false, bagOpen: false, match: null, mode: ['match', 'online', 'solo'].includes(session.state.mode) ? 'tour' : session.state.mode });
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
  // Line everyone up first: player 1 wears this phone's Locker look; crew names get their
  // preset, anyone else a look made from their name.
  session.set({
    lineup: {
      players: names.map((name, i) => ({ name, look: i === 0 ? myLook : lookForName(name) })),
      title: 'Random best of 3',
      sub: `${names.length} golfers · pass the phone`,
    },
  });
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

let myLook = {};
const homeMe = createHomeMe(session);
createLocker(session, {
  onChange: (look) => {
    myLook = look;
    game.setLook(look);
    online?.setLook(look);
    homeMe.setLook(look);
  },
});
document.getElementById('btn-open-locker').addEventListener('click', () => session.set({ screen: 'locker' }));
createTourScreen(session, { onPlay: playTour });
createMatchSetup({ onStart: startMatch });
createLineup(session);
// Online: friends on their own phones.
var online = createOnlinePlay({ session, controller, catalog: CATALOG, toast: (t, sub) => hud.toast(t, sub), getLook: () => myLook, friends: game.friends });
createOnlineUI(session, online, { toast: (t, sub) => hud.toast(t, sub) });
// Solo: you against the crew (bots).
var solo = createSoloPlay({ session, controller, catalog: CATALOG, friends: game.friends, toast: (t, sub) => hud.toast(t, sub), getLook: () => myLook });
createSoloUI(session, solo, { getLook: () => myLook });

// New here? Make your golfer and pick a name before anything else.
if (!session.state.profile) session.set({ screen: 'locker', setup: true });
// Your name fills in the name boxes (online rooms, player 1 in pass-the-phone).
let lastName = session.state.profile?.name ?? null;
session.subscribe((s) => {
  const n = s.profile?.name ?? null;
  if (!n || n === lastName) return;
  const prev = lastName;
  lastName = n;
  const online = document.getElementById('online-name');
  if (online && (!online.value || online.value === prev)) online.value = n;
  const first = document.querySelector('#match-players input[data-index="0"]');
  if (first && (/^Player \d$/.test(first.value) || first.value === prev || !first.value)) {
    first.value = n;
    first.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
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

// The course sits behind the home screen as a live backdrop, seen from the look-ahead camera:
// a random city to start with, then a different one every few seconds (with a soft fade
// covering the swap) for as long as you're on the home screen.
const BACKDROP_EVERY = 12000;
const backdropFade = document.getElementById('backdrop-fade');
let backdropIndex = Math.floor(Math.random() * CATALOG.tour.count);
const showBackdrop = (index) => {
  const hole = CATALOG.tour.hole(index);
  if (!hole) return;
  activeHole = hole;
  session.set({ hole });
  controller.startHole(hole, session.state.settings);
};
showBackdrop(backdropIndex);
setInterval(() => {
  const s = session.state;
  if (s.screen !== 'home' || document.hidden || s.lineup) return;
  backdropFade?.classList.add('is-on');
  setTimeout(() => {
    if (session.state.screen === 'home') {
      backdropIndex = (backdropIndex + 1 + Math.floor(Math.random() * (CATALOG.tour.count - 1))) % CATALOG.tour.count;
      showBackdrop(backdropIndex);
    }
    setTimeout(() => backdropFade?.classList.remove('is-on'), 250); // let the new course draw first
  }, 700);
}, BACKDROP_EVERY);

let lastTimeOfDay = session.state.settings.timeOfDay;
session.subscribe((s) => {
  game.setLookAhead(s.lookAhead || s.screen === 'home');
  game.setWatch((s.mode === 'online' || s.mode === 'solo') && s.screen === 'play' ? s.watching : null);
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
const updatePaused = () => game.setPaused(document.hidden || session.state.screen === 'locker' || session.state.screen === 'tour' || session.state.screen === 'lobby' || session.state.screen === 'solo' || !!session.state.lineup);
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
  (dt) => { controller.update(dt); solo.update(dt); }
);
