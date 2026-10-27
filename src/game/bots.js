import { CLUBS, CLUB_ORDER, SWING, PHYSICS, DEG, METRES_TO_YARDS, clamp } from '../config.js';
import { createBallBody, placeBody, launchBody, stepBody, planShot } from '../physics/ball.js';
import { surfaceAt } from '../physics/course.js';
import { aimTarget, suggestClub, scoreName } from './controller.js';
import { GOLFER_PRESETS } from '../avatar/looks.js';

// Computer golfers for solo play. Each crew member has a skill level; a bot "reads" a shot the
// way a player would (club, aim, power, allowing for the wind) and then executes it with errors
// sized by that skill. Every shot runs through the same physics as yours, and is sent to the
// friends layer as an ordinary swing, so it's replayed on your course exactly as it was played.
//
// Pure logic, no DOM. game/botPlay.js runs the match.

// power: spread of hit strength · dev: spread of a crooked swing (1 = fully crooked, like a bad
// flick) · wind: how much of the wind they allow for · mishit: chance of a duffed shot ·
// puttLen / puttLine: spread on putt length (fraction) and line (degrees) · read: green reading.
export const SKILLS = {
  rookie: { label: 'Rookie', stars: 1, power: 0.14, dev: 0.42, wind: 0.15, mishit: 0.12, puttLen: 0.24, puttLine: 3.4, read: 0.3, think: [6, 10] },
  amateur: { label: 'Amateur', stars: 2, power: 0.095, dev: 0.3, wind: 0.4, mishit: 0.07, puttLen: 0.17, puttLine: 2.4, read: 0.5, think: [5, 9] },
  clubpro: { label: 'Club pro', stars: 3, power: 0.065, dev: 0.21, wind: 0.65, mishit: 0.04, puttLen: 0.12, puttLine: 1.7, read: 0.7, think: [5, 8] },
  pro: { label: 'Tour pro', stars: 4, power: 0.042, dev: 0.13, wind: 0.85, mishit: 0.02, puttLen: 0.08, puttLine: 1.1, read: 0.85, think: [4, 7] },
  legend: { label: 'Legend', stars: 5, power: 0.026, dev: 0.075, wind: 1, mishit: 0.008, puttLen: 0.05, puttLine: 0.7, read: 1, think: [4, 6] },
};

// Who plays at what level.
export const BOT_SKILL = {
  garet: 'pro', pramoth: 'amateur', drt: 'clubpro', steven: 'rookie', henny: 'amateur', eyas: 'clubpro',
  faly: 'pro', weixiong: 'legend', gleb: 'rookie', matrickseah: 'clubpro', yunyu: 'pro', elloise: 'legend', javier: 'amateur', keenan: 'rookie', sangwon: 'pro', wolfgang: 'clubpro', justinwong: 'pro',
};

// Pick `count` different crew members at random, leaving out anyone in `exclude` (preset ids).
export function pickBots(count, { exclude = [], random = Math.random } = {}) {
  const pool = GOLFER_PRESETS.filter((p) => !exclude.includes(p.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).map((p) => ({ id: p.id, name: p.short ?? (p.name.split(' ')[0] === 'Elloise' ? 'Elloise' : p.name), fullName: p.name, look: p.look, skill: BOT_SKILL[p.id] ?? 'amateur' }));
}

const MAX_SIM_STEPS = 60 * 25;
const DT = 1 / 60; // same step the friends layer replays with, so replays land in the same spot

// Run a shot to the end. Returns where it first came down, where it ended and how.
function simulate(hole, from, params, wind) {
  const body = createBallBody();
  placeBody(body, hole, from.x, from.z);
  launchBody(body, { ...params, wind: params.launchRad > 0 ? wind : null });
  let land = null;
  let end = 'rest';
  let steps = 0;
  for (; steps < MAX_SIM_STEPS; steps++) {
    const e = stepBody(body, hole, DT);
    if (e === 'land' && !land) land = { x: body.p.x, z: body.p.z };
    if (e === 'water' || e === 'oob') { end = e; break; }
    if (e === 'holed') { end = 'holed'; break; }
    if (body.state === 'rest') break;
  }
  return { end, x: body.p.x, z: body.p.z, land: land ?? { x: body.p.x, z: body.p.z }, steps: steps + 1 };
}

function gauss(random) {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Launch numbers for club c at power p, bent by deviation dev (same as your swing).
function flight(c, power, yaw, dev) {
  const launchRad = c.launchDeg * DEG;
  const carry = Math.max(1, (c.yards / METRES_TO_YARDS) * power);
  const { speed, time } = planShot(carry, launchRad);
  const curve = (2 * SWING.curveMissFraction * carry * dev) / (time * time);
  return { yaw: yaw - dev * SWING.maxDeviationDeg * 0.5 * DEG, speed, launchRad, curve };
}

const puttSpeed = (len) => Math.sqrt(2 * PHYSICS.surfaces.green.roll * PHYSICS.gravity * len);
const bearing = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

// Errors of a shot from `from` that finished at r: how far past (along) and how far right
// (cross) of `target` it ended, measured along the line from `from` to the target.
function miss(from, target, r) {
  const yaw = bearing(from, target);
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const want = Math.hypot(target.x - from.x, target.z - from.z);
  const along = (r.x - from.x) * fx + (r.z - from.z) * fz - want;
  const cross = (r.x - from.x) * Math.cos(yaw) - (r.z - from.z) * Math.sin(yaw);
  return { along, cross, want };
}

// Work out the swing that sends the ball to `target` (with or without the wind), by trying it.
function solveFull(hole, from, target, club, wind, gustPhase) {
  let yaw = bearing(from, target);
  const dist = Math.hypot(target.x - from.x, target.z - from.z);
  let power = clamp(dist / (club.yards / METRES_TO_YARDS), 0.05, 1);
  for (let i = 0; i < 5; i++) {
    const r = simulate(hole, from, { ...flight(club, power, yaw, 0), gustPhase }, wind);
    const at = r.end === 'rest' || r.end === 'holed' ? r : r.land;
    const m = miss(from, target, at);
    if (Math.abs(m.along) < 2 && Math.abs(m.cross) < 1.5) break;
    const got = Math.max(5, m.want + m.along);
    power = clamp(power * (m.want / got), 0.05, 1);
    yaw += m.cross / Math.max(10, m.want);
  }
  return { yaw, power };
}

function solvePutt(hole, from, pin, wind, read) {
  const dist = Math.hypot(pin.x - from.x, pin.z - from.z);
  const straight = { yaw: bearing(from, pin), len: Math.min(CLUBS.P.maxRoll, dist + 0.45) };
  let { yaw, len } = straight;
  for (let i = 0; i < 4; i++) {
    const r = simulate(hole, from, { yaw, speed: puttSpeed(len), launchRad: 0, curve: 0, gustPhase: 0 }, wind);
    if (r.end === 'holed') break;
    const m = miss(from, pin, r);
    yaw += m.cross / Math.max(1.5, dist);
    len = clamp(len - (m.along - 0.4) * 0.8, 0.3, CLUBS.P.maxRoll);
  }
  // A weaker reader only partly sees the break and the pace.
  return { yaw: straight.yaw + (yaw - straight.yaw) * read, len: straight.len + (len - straight.len) * read };
}

const DRY = (s) => s !== 'water' && s !== 'oob';

// Try the obvious club, then more club, then laying up short of trouble; keep whichever plan
// (simulated with the wind) finishes dry and nearest where it was meant to go.
function chooseShot(hole, lie, surface, wind, gustPhase) {
  const target = aimTarget(hole, lie.x, lie.z);
  const dist = Math.hypot(target.x - lie.x, target.z - lie.z);
  let first = suggestClub(dist, surface);
  if (first.kind === 'putter') first = CLUBS.Lw; // just off the green: a little chip
  const score = (club, aim, weight = 0) => {
    const sol = solveFull(hole, lie, aim, club, wind, gustPhase);
    const r = simulate(hole, lie, { ...flight(club, sol.power, sol.yaw, 0), gustPhase }, wind);
    const wet = r.end === 'water' || r.end === 'oob';
    const off = Math.hypot(r.x - aim.x, r.z - aim.z) + weight;
    return { club, target: aim, ...sol, cost: (wet ? 1e5 : 0) + (r.end === 'holed' ? -50 : off) };
  };
  let best = score(first, target);
  const fine = (b) => b.cost < Math.max(12, dist * 0.12);
  for (let club = first, i = 0; i < 2 && !fine(best); i++) {
    const more = longer(club);
    if (more === club) break;
    club = more;
    const b = score(club, target);
    if (b.cost < best.cost) best = b;
  }
  if (best.cost >= 1e5) {
    // Nothing gets there dry: lay up on dry ground short of it.
    for (const f of [0.8, 0.65, 0.5, 0.35]) {
      const aim = { x: lie.x + (target.x - lie.x) * f, z: lie.z + (target.z - lie.z) * f };
      if (!DRY(surfaceAt(hole, aim.x, aim.z))) continue;
      const b = score(suggestClub(dist * f, surface), aim, dist * (1 - f) * 0.5);
      if (b.cost < best.cost) best = b;
      if (b.cost < 1e5) break;
    }
  }
  return best;
}

// The next club up the bag (longer), for when full power still falls short.
function longer(club) {
  const order = CLUB_ORDER.map((id) => CLUBS[id]).filter((c) => c.yards).sort((a, b) => a.yards - b.yards);
  return order.find((c) => c.yards > club.yards) ?? club;
}

// Plan and hit one shot from `lie`. Returns the swing (as a friends-layer shot) and what happened.
export function botShot(hole, lie, wind, skillId, random = Math.random) {
  const sk = SKILLS[skillId] ?? SKILLS.amateur;
  const surface = surfaceAt(hole, lie.x, lie.z);
  const pin = { x: hole.pin[0], z: hole.pin[2] };
  const gustPhase = random() * Math.PI * 2;
  let params;

  if (surface === 'green') {
    const plan = solvePutt(hole, lie, pin, wind, sk.read);
    const len = clamp(plan.len * (1 + gauss(random) * sk.puttLen), 0.2, CLUBS.P.maxRoll);
    const yaw = plan.yaw + gauss(random) * sk.puttLine * DEG;
    params = { yaw, speed: puttSpeed(len), launchRad: 0, curve: 0, gustPhase: 0 };
  } else {
    // Read the shot with the wind they can see: the club and target that end up dry and closest.
    const plan = chooseShot(hole, lie, surface, wind, gustPhase);
    const calm = solveFull(hole, lie, plan.target, plan.club, null, gustPhase);
    let club = plan.club;
    let power = calm.power + (plan.power - calm.power) * sk.wind;
    let yaw = calm.yaw + (plan.yaw - calm.yaw) * sk.wind;
    let dev = clamp(gauss(random) * sk.dev, -1, 1);
    power = clamp(power * (1 + gauss(random) * sk.power), 0.04, 1);
    if (random() < sk.mishit) { // a duff, a top or a big slice
      power *= 0.45 + random() * 0.35;
      dev = clamp(dev + (random() < 0.5 ? -1 : 1) * (0.4 + random() * 0.4), -1, 1);
    }
    params = { ...flight(club, power, yaw, dev), gustPhase, club: club.id };
  }

  const result = simulate(hole, lie, params, wind);
  const { club, ...swing } = params;
  return {
    shot: { from: { x: lie.x, z: lie.z }, ...swing },
    club: club ?? 'P',
    end: result.end,
    rest: { x: result.x, z: result.z },
    duration: result.steps * DT,
  };
}

// A bot's progress on one hole. Call next() for each shot until done.
export function createBotRound(hole, wind, skillId, { maxStrokes = 10, random = Math.random } = {}) {
  const round = {
    lie: { x: hole.tee[0], z: hole.tee[2] },
    strokes: 0,
    done: false,
    title: '',
    next() {
      if (round.done) return null;
      const s = botShot(hole, round.lie, wind, skillId, random);
      round.strokes += 1;
      s.shot.n = round.strokes;
      if (s.end === 'holed') {
        round.done = true;
        round.title = scoreName(round.strokes, hole.par);
      } else if (s.end === 'water' || s.end === 'oob') {
        round.strokes += 1; // penalty; replay from the same spot
      } else {
        round.lie = s.rest;
      }
      if (!round.done && round.strokes >= maxStrokes) {
        round.done = true;
        round.title = 'Picked up';
      }
      s.strokes = round.strokes;
      s.lie = { ...round.lie };
      s.done = round.done;
      return s;
    },
  };
  return round;
}
