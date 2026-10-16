import { CLUBS, CLUB_ORDER, FULL_BACKSWING, SWING, PHYSICS, WIND_LEVELS, DEG, METRES_TO_YARDS, clamp } from '../config.js';
import { pitchOf } from '../courses/pitches.js';
import { createBallBody, placeBody, launchBody, stepBody, planShot, predictFlight } from '../physics/ball.js';
import { nearestOnPath, pathAt, pathLength } from '../courses/generate.js';
import { surfaceAt } from '../physics/course.js';

// The rules of a hole: whose turn it is to swing, what a swing does to the ball, what happens
// when it lands, scoring. It drives the 3D scene and the HUD but owns no drawing itself.
//
// Phases: idle → swing → flight → settle → idle …  (or → penalty → idle, or → holed)

const SCORE_NAMES = { '-3': 'Albatross!', '-2': 'Eagle!', '-1': 'Birdie!', 0: 'Par', 1: 'Bogey', 2: 'Double bogey', 3: 'Triple bogey' };
const SETTLE_DELAY = 0.9;
const PENALTY_DELAY = 1.6;
const HOLED_DELAY = 1.1;

export function scoreName(strokes, par) {
  if (strokes === 1) return 'Hole in one!';
  const diff = strokes - par;
  return SCORE_NAMES[diff] ?? `${diff} over par`;
}

export function describeShot({ rawPower, tempo, deviation }, isPutt) {
  const d = Math.abs(deviation);
  const left = deviation < 0;
  let direction = 'Straight';
  if (d >= 0.5) direction = isPutt ? (left ? 'Pulled left' : 'Pushed right') : (left ? 'Hook' : 'Slice');
  else if (d >= 0.15) direction = left ? 'Slight pull' : 'Slight push';
  const percent = `${Math.round(rawPower * (isPutt ? 1 : tempo) * 100)}%`;
  if (isPutt) return { title: direction === 'Straight' ? 'Nice roll' : direction, sub: `Power ${percent}` };

  if (!isPutt && d < 0.15 && tempo >= 0.95 && rawPower >= 0.85) return { title: 'Perfect!', sub: `Power ${percent} · Straight` };
  if (tempo < 0.7) return { title: 'Too slow', sub: `Flick faster for full power · ${direction}` };
  return { title: direction, sub: `Power ${percent}` };
}

// The club Golf Dreams would hand you: putter on the green, otherwise the shortest club that
// reaches the pin at full power (or the driver if nothing does).
export function suggestClub(distanceMetres, surface) {
  if (surface === 'green') return CLUBS.P;
  const yards = distanceMetres * METRES_TO_YARDS;
  const reaching = CLUB_ORDER.map((id) => CLUBS[id]).filter((c) => c.yards && c.yards >= yards);
  return reaching.length ? reaching.reduce((a, b) => (b.yards < a.yards ? b : a)) : CLUBS.D;
}

// Where to aim from (x, z): the pin when it's in reach, otherwise a lay-up spot further down
// the fairway (so doglegs aim around the corner, not over the trees).
const REACH = 235;  // metres: go for the pin from closer than this
const LAYUP = 215;  // metres: how far down the fairway to lay up
const RUN_OUT = { asphalt: 65, ice: 55, piste: 45, cobbles: 45, hardpan: 40, beach: 20, gravel: 15 };

export function aimTarget(hole, x, z) {
  const pin = { x: hole.pin[0], z: hole.pin[2] };
  if (!hole.path || Math.hypot(pin.x - x, pin.z - z) <= REACH) return pin;
  const total = pathLength(hole.path);
  const { s } = nearestOnPath(hole.path, x, z);
  // Pull the lay-up back until the landing zone, and the run-out after it, is dry. Fast pitches
  // (streets, ice, pistes) run further, so they need more room.
  const runOut = RUN_OUT[pitchOf(hole).fairway.surface] ?? 35;
  const wet = (at) => {
    const t = pathAt(hole.path, at);
    const dx = t.x - x;
    const dz = t.z - z;
    const len = Math.hypot(dx, dz) || 1;
    for (let d = -10; d <= runOut; d += 5) {
      // along the ball's straight line (it doesn't follow the bend once it's rolling)
      const surf = surfaceAt(hole, t.x + (dx / len) * d, t.z + (dz / len) * d);
      if (surf === 'water' || surf === 'oob') return true;
    }
    return false;
  };
  let at = Math.min(total, s + LAYUP);
  while (at > s + 60 && wet(at)) at -= 10;
  const p = pathAt(hole.path, at);
  return { x: p.x, z: p.z };
}

// A fresh wind for a hole. yaw is the direction it blows TOWARD (0 = toward −z, like aim yaw).
export function drawWind(level, random = Math.random) {
  const { min, max, gust = 0 } = WIND_LEVELS[level] ?? WIND_LEVELS.calm;
  const speed = min + (max - min) * random();
  const yaw = random() * Math.PI * 2;
  return { speed, yaw, gust, x: -Math.sin(yaw) * speed, z: -Math.cos(yaw) * speed };
}

// events (optional): onShot(shot) when you swing, onLie({ x, z, strokes }) when the ball comes to
// rest for the next shot — online play forwards these so friends can watch your shots.
export function createGameController({ game, session, hud, events = {} }) {
  const body = createBallBody();
  let hole = null;
  let club = CLUBS['7i'];
  let lie = { x: 0, z: 0 };
  let baseYaw = 0;
  let aimYaw = 0;
  let phase = 'idle';
  let timer = 0;
  let wind = drawWind('calm');
  let hitThisShot = false;
  let maxStrokes = Infinity;

  function setPhase(p) {
    phase = p;
    session.set({ phase: p });
  }

  // settings: { timeOfDay: 'day' | 'sunset' | 'night', wind: 'calm' | 'breezy' | 'windy' | 'stormy' | 'hurricane' }
  // options.wind: use this exact wind (match play: everyone on a hole gets the same conditions)
  // options.maxStrokes: pick the ball up once you reach this many (keeps a match moving)
  function startHole(next, settings = session.state.settings, options = {}) {
    hole = next;
    timer = 0; // drop any pending settle / penalty from a shot still in the air
    maxStrokes = options.maxStrokes ?? Infinity;
    wind = options.wind ?? drawWind(settings.wind);
    game.loadHole(hole);
    game.setTimeOfDay(settings.timeOfDay);
    session.set({ strokes: 0, result: null, lookAhead: false, mapOpen: false, bagOpen: false, wind });
    setLie(hole.tee[0], hole.tee[2]);
  }

  function distanceToPin(x, z) {
    return Math.hypot(hole.pin[0] - x, hole.pin[2] - z);
  }

  // Put the ball down for the next shot, pick the club, aim at the pin.
  function setLie(x, z) {
    placeBody(body, hole, x, z);
    lie = { x, z };
    const target = aimTarget(hole, x, z);
    baseYaw = Math.atan2(-(target.x - x), -(target.z - z));
    aimYaw = baseYaw;
    const toPin = distanceToPin(x, z);
    club = suggestClub(Math.hypot(target.x - x, target.z - z), body.surface);
    game.placeAtLie(body.p, aimYaw);
    game.setClub(club.id);
    session.set({ club: club.id, suggestedClub: club.id, lieSurface: body.surface, toPin, ballAt: { x, z }, aimYaw });
    events.onLie?.({ x, z, strokes: session.state.strokes });
    updateGuide();
    setPhase('idle');
  }

  // Launch numbers for a non-putter at a given power (0..1).
  function flightFor(c, power) {
    const launchRad = c.launchDeg * DEG;
    const carry = Math.max(1, (c.yards / METRES_TO_YARDS) * power);
    return { carry, launchRad, ...planShot(carry, launchRad) };
  }

  // Dotted arc of a full-power, straight, windless shot with the club in hand (ground dots for putts).
  function updateGuide() {
    if (club.kind === 'putter') {
      game.setGuide({ kind: 'ground', length: clamp(session.state.toPin, 1.5, 10) });
      return;
    }
    const { speed, launchRad } = flightFor(club, 1);
    game.setGuide({ kind: 'arc', points: predictFlight(hole, body.p, { yaw: aimYaw, speed, launchRad }) });
  }

  // Player picked a club from the bag.
  function selectClub(id) {
    if (!CLUBS[id] || (phase !== 'idle')) return;
    club = CLUBS[id];
    game.setClub(club.id);
    updateGuide();
    session.set({ club: club.id });
  }

  function hit(shot) {
    hud.showPower(null);
    session.set({ strokes: session.state.strokes + 1, hintSeen: true, ...(session.state.watching ? { watching: null } : {}) });
    game.club.followThrough();

    const isPutt = club.kind === 'putter';
    if (isPutt) {
      const distance = club.maxRoll * shot.rawPower; // putts are judged on length and line, not speed
      const speed = Math.sqrt(2 * PHYSICS.surfaces.green.roll * PHYSICS.gravity * distance);
      const yaw = aimYaw - shot.deviation * SWING.maxDeviationDeg * 0.25 * DEG;
      launchBody(body, { yaw, speed, launchRad: 0, curve: 0 });
      events.onShot?.({ from: { x: lie.x, z: lie.z }, yaw, speed, launchRad: 0, curve: 0, gustPhase: 0, n: session.state.strokes });
    } else {
      const { carry, speed, time, launchRad } = flightFor(club, shot.power);
      const yaw = aimYaw - shot.deviation * SWING.maxDeviationDeg * 0.5 * DEG; // right flick → right
      // Sideways bend sized so a fully crooked flick misses by curveMissFraction of the carry.
      const curve = (2 * SWING.curveMissFraction * carry * shot.deviation) / (time * time);
      launchBody(body, { yaw, speed, launchRad, curve, wind });
      events.onShot?.({ from: { x: lie.x, z: lie.z }, yaw, speed, launchRad, curve, gustPhase: body.gustPhase, n: session.state.strokes });
    }

    game.beginFlight(aimYaw);
    hitThisShot = false;
    const feedback = describeShot(shot, isPutt);
    hud.toast(feedback.title, feedback.sub);
    setPhase('flight');
  }

  // Called by the swing gesture.
  const input = {
    canStart: () => session.state.screen === 'play' && phase === 'idle' && !session.state.mapOpen && !session.state.bagOpen,
    begin() {
      if (session.state.lookAhead || session.state.watching) session.set({ lookAhead: false, watching: null });
    },
    aim(dxPixels) {
      const max = SWING.maxAimOffsetDeg * DEG;
      aimYaw = clamp(aimYaw - dxPixels * SWING.aimDegPerPx * DEG, baseYaw - max, baseYaw + max);
      game.setAim(aimYaw);
      updateGuide();
      session.set({ aimYaw });
    },
    back(fraction) {
      if (phase !== 'swing') setPhase('swing');
      game.club.setSwing(-fraction * (club.maxBackswing ?? FULL_BACKSWING));
      hud.showPower(fraction);
    },
    backStart(side) {
      session.set({ swingSide: side });
    },
    cancel({ reset = false } = {}) {
      game.club.release();
      hud.showPower(null);
      setPhase('idle');
      if (reset) hud.toast('Swing reset', 'No stroke taken · line it up again');
    },
    cancelZone: () => hud.cancelZone(),
    cancelHover: (on) => hud.cancelHover(on),
    impact: hit,
  };

  // Called every frame by the scene loop.
  function update(dt) {
    if (phase === 'flight') {
      const event = stepBody(body, hole, dt);
      game.setBallPosition(body.p);
      if (event === 'hit' && !hitThisShot) {
        hitThisShot = true;
        const what = body.lastHit?.label ?? 'something';
        hud.toast(what === 'tree' ? 'Timber!' : 'Bonk!', what === 'tree' ? 'Straight into a tree' : `Off the ${what.toLowerCase()}`);
      }
      if (event === 'water' || event === 'oob') {
        game.setBallVisible(false);
        if (event === 'water') hud.toast('Splash!', 'Into the water · 1 penalty stroke');
        else hud.toast('Out of bounds', '1 penalty stroke · replay from where you hit');
        timer = PENALTY_DELAY;
        setPhase('penalty');
      } else if (event === 'holed') {
        game.setBallVisible(false);
        timer = HOLED_DELAY;
        setPhase('holed');
      } else if (event === 'rest') {
        timer = SETTLE_DELAY;
        setPhase('settle');
      }
      return;
    }
    if (timer <= 0) return;
    timer -= dt;
    if (timer > 0) return;

    if (phase === 'settle') {
      if (!pickUpIfOverLimit()) setLie(body.p.x, body.p.z);
    } else if (phase === 'penalty') {
      session.set({ strokes: session.state.strokes + 1 });
      if (!pickUpIfOverLimit()) setLie(lie.x, lie.z); // replay from where the last shot was hit
    } else if (phase === 'holed') {
      const strokes = session.state.strokes;
      session.set({ result: { title: scoreName(strokes, hole.par), strokes, par: hole.par } });
    }
  }

  // Match play: at the stroke limit the ball is picked up and the hole scores as that limit.
  function pickUpIfOverLimit() {
    const strokes = session.state.strokes;
    if (strokes < maxStrokes) return false;
    setPhase('holed');
    game.setBallVisible(false);
    session.set({ result: { title: 'Picked up', strokes, par: hole.par, pickedUp: true } });
    return true;
  }

  return { startHole, update, input, selectClub, events };
}
