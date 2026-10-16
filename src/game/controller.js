import { CLUBS, CLUB_ORDER, FULL_BACKSWING, SWING, PHYSICS, DEG, METRES_TO_YARDS, clamp } from '../config.js';
import { createBallBody, placeBody, launchBody, stepBody, planShot } from '../physics/ball.js';

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

export function createGameController({ game, session, hud }) {
  const body = createBallBody();
  let hole = null;
  let club = CLUBS['7i'];
  let lie = { x: 0, z: 0 };
  let baseYaw = 0;
  let aimYaw = 0;
  let phase = 'idle';
  let timer = 0;

  function setPhase(p) {
    phase = p;
    session.set({ phase: p });
  }

  function startHole(next) {
    hole = next;
    game.loadHole(hole);
    session.set({ strokes: 0, result: null, lookAhead: false });
    setLie(hole.tee[0], hole.tee[2]);
  }

  function distanceToPin(x, z) {
    return Math.hypot(hole.pin[0] - x, hole.pin[2] - z);
  }

  // Put the ball down for the next shot, pick the club, aim at the pin.
  function setLie(x, z) {
    placeBody(body, hole, x, z);
    lie = { x, z };
    baseYaw = Math.atan2(-(hole.pin[0] - x), -(hole.pin[2] - z));
    aimYaw = baseYaw;
    const toPin = distanceToPin(x, z);
    club = suggestClub(toPin, body.surface);
    game.placeAtLie(body.p, aimYaw, aimLengthFor(club, toPin));
    game.setClubKind(club.kind);
    session.set({ club: club.id, suggestedClub: club.id, lieSurface: body.surface, toPin, ballAt: { x, z } });
    setPhase('idle');
  }

  function aimLengthFor(c, toPin) {
    return c.kind === 'putter' ? clamp(toPin, 1.5, 10) : 18;
  }

  // Player picked a club from the bag.
  function selectClub(id) {
    if (!CLUBS[id] || (phase !== 'idle')) return;
    club = CLUBS[id];
    game.setClubKind(club.kind);
    game.setAimLength(aimLengthFor(club, session.state.toPin));
    session.set({ club: club.id });
  }

  function hit(shot) {
    hud.showPower(null);
    session.set({ strokes: session.state.strokes + 1, hintSeen: true });
    game.club.followThrough();

    const isPutt = club.kind === 'putter';
    if (isPutt) {
      const distance = club.maxRoll * shot.rawPower; // putts are judged on length and line, not speed
      const speed = Math.sqrt(2 * PHYSICS.surfaces.green.roll * PHYSICS.gravity * distance);
      const yaw = aimYaw - shot.deviation * SWING.maxDeviationDeg * 0.25 * DEG;
      launchBody(body, { yaw, speed, launchRad: 0, curve: 0 });
    } else {
      const launch = club.launchDeg * DEG;
      const carry = Math.max(1, (club.yards / METRES_TO_YARDS) * shot.power);
      const { speed, time } = planShot(carry, launch);
      const yaw = aimYaw - shot.deviation * SWING.maxDeviationDeg * 0.5 * DEG; // right flick → right
      // Sideways bend sized so a fully crooked flick misses by curveMissFraction of the carry.
      const curve = (2 * SWING.curveMissFraction * carry * shot.deviation) / (time * time);
      launchBody(body, { yaw, speed, launchRad: launch, curve });
    }

    game.beginFlight(aimYaw);
    const feedback = describeShot(shot, isPutt);
    hud.toast(feedback.title, feedback.sub);
    setPhase('flight');
  }

  // Called by the swing gesture.
  const input = {
    canStart: () => phase === 'idle' && !session.state.mapOpen && !session.state.bagOpen,
    begin() {
      if (session.state.lookAhead) session.set({ lookAhead: false });
    },
    aim(dxPixels) {
      const max = SWING.maxAimOffsetDeg * DEG;
      aimYaw = clamp(aimYaw - dxPixels * SWING.aimDegPerPx * DEG, baseYaw - max, baseYaw + max);
      game.setAim(aimYaw);
    },
    back(fraction) {
      if (phase !== 'swing') setPhase('swing');
      game.club.setSwing(-fraction * (club.maxBackswing ?? FULL_BACKSWING));
      hud.showPower(fraction);
    },
    cancel() {
      game.club.release();
      hud.showPower(null);
      setPhase('idle');
    },
    impact: hit,
  };

  // Called every frame by the scene loop.
  function update(dt) {
    if (phase === 'flight') {
      const event = stepBody(body, hole, dt);
      game.setBallPosition(body.p);
      if (event === 'water') {
        game.setBallVisible(false);
        hud.toast('Splash!', 'Into the water · 1 penalty stroke');
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
      setLie(body.p.x, body.p.z);
    } else if (phase === 'penalty') {
      session.set({ strokes: session.state.strokes + 1 });
      setLie(lie.x, lie.z); // replay from where the last shot was hit
    } else if (phase === 'holed') {
      const strokes = session.state.strokes;
      session.set({ result: { title: scoreName(strokes, hole.par), strokes, par: hole.par } });
    }
  }

  return { startHole, update, input, selectClub };
}
