import { createMatch, currentHole, finishHole, nextHole, MAX_STROKES } from './match.js';
import { drawWind } from './controller.js';
import { createBotRound, SKILLS } from './bots.js';

// Solo play (the "Play" button): you against the KopiGolf crew. Same best-of-3 rules as playing
// with friends. Everyone plays each hole at once: you swing as normal while the bots play
// alongside you on the course (their shots replayed through the friends layer), each at their
// own pace and skill.
//
// session.state.solo = { kind: '1v1' | 'tournament', stage, match, players: [{ name, skill, me }] }
//   stage: 'intro' → 'playing' → ('waiting' while bots finish) → 'holeResult' → … → 'final'
//          ('watching' when you aren't in a sudden-death hole)

const ME = 0; // you are always player 0
const AFTER_YOU = 3; // bots speed up this much once you've holed out
const WALK_OVER = 1.2; // seconds after a ball lands before the bot is "done" walking up to it

export function createSoloPlay({ session, controller, catalog, friends, toast, getLook }) {
  let st = null; // live match state (not all of it goes into the session)

  const pub = () => {
    if (!st) { session.set({ solo: null }); return; }
    session.set({
      solo: {
        kind: st.kind, stage: st.stage, match: st.match,
        players: st.players.map((p) => ({ name: p.name, skill: p.skill ?? null, me: !!p.me })),
        progress: st.progress,
      },
    });
  };

  // ----- starting -----
  function start(kind, bots, myName) {
    const players = [{ name: myName || 'You', me: true }, ...bots.map((b) => ({ ...b }))];
    const match = createMatch(players.map((p) => p.name), { courseCount: catalog.tour.count });
    st = { kind, bots, players, match, stage: 'intro', clock: 0, speed: 1, rounds: new Map(), queue: [], progress: {} };
    session.set({ screen: 'play', mode: 'solo', mapOpen: false, bagOpen: false, watching: null });
    loadHole();
    session.set({
      lineup: {
        players: players.map((p) => ({ name: p.name, look: p.me ? getLook() : p.look })),
        title: kind === '1v1' ? '1v1' : 'Tournament',
        sub: kind === '1v1' ? `vs ${bots[0].name} · ${SKILLS[bots[0].skill].label} · best of 3` : `${players.length} golfers · best of 3`,
      },
    });
  }

  function loadHole() {
    const m = st.match;
    const mh = currentHole(m);
    if (!mh.wind) mh.wind = drawWind(mh.windLevel);
    const hole = catalog.tour.hole(mh.course);
    st.hole = hole;
    st.clock = 0;
    st.speed = 1;
    st.rounds = new Map();
    st.progress = {};
    friends.clear();
    session.set({ hole, watching: null });
    controller.startHole(hole, session.state.settings, { wind: mh.wind, maxStrokes: MAX_STROKES });
    session.set({ lookAhead: true });
    // Bots in this hole start working out their rounds now (a shot per frame), while you read the card.
    for (const p of mh.players) {
      if (p === ME) continue;
      const bot = st.players[p];
      const sk = SKILLS[bot.skill] ?? SKILLS.amateur;
      st.rounds.set(p, {
        p, bot, sk,
        round: createBotRound(hole, mh.wind, bot.skill, { maxStrokes: MAX_STROKES }),
        planned: [], // shots worked out so far
        played: 0, // shots shown so far
        nextAt: 1.5 + Math.random() * 4.5 + (p - 1) * 0.8, // when they hit next (match clock)
        shown: { lie: null, shot: null, strokes: 0, done: false },
        finished: false,
      });
      st.progress[p] = { strokes: 0, done: false };
    }
    st.stage = mh.players.includes(ME) ? 'intro' : 'watchingIntro';
    syncFriends();
    pub();
  }

  // ----- the hole in play -----
  function teeOff() {
    if (!st || (st.stage !== 'intro' && st.stage !== 'watchingIntro')) return;
    st.stage = st.stage === 'intro' ? 'playing' : 'watching';
    if (st.stage === 'watching') st.speed = AFTER_YOU;
    session.set({ lookAhead: false });
    if (st.stage === 'watching') session.set({ watching: firstBotId() });
    pub();
  }

  const botId = (p) => `bot-${st.players[p].id}-${p}`;
  const firstBotId = () => {
    const r = [...st.rounds.values()].find((x) => !x.finished);
    return r ? botId(r.p) : null;
  };

  // Called every frame by the game loop.
  function update(dt) {
    if (!st) return;
    // Work out bots' shots ahead of time, one per frame, and never while you're mid-swing or
    // watching your own ball fly (a slow phone would stutter).
    const busy = st.stage === 'playing' && session.state.phase !== 'idle' && !session.state.watching;
    if (!busy) {
      for (const r of st.rounds.values()) {
        if (!r.round.done) { r.planned.push(r.round.next()); break; }
      }
    }
    if (st.stage !== 'playing' && st.stage !== 'waiting' && st.stage !== 'watching') return;
    st.clock += dt * st.speed;
    let changed = false;
    for (const r of st.rounds.values()) changed = advance(r, st.clock) || changed;
    if (changed) { syncFriends(); pub(); }
    maybeFinishHole();
  }

  // Show a bot's shots whose time has come.
  function advance(r, clock) {
    let changed = false;
    while (!r.finished) {
      if (r.played < r.planned.length && clock >= r.nextAt) {
        const s = r.planned[r.played++];
        r.shown = { lie: s.lie, shot: s.shot, strokes: s.strokes, done: false };
        st.progress[r.p] = { strokes: s.strokes, done: false };
        const [lo, hi] = r.sk.think;
        r.nextAt += s.duration + (s.done ? WALK_OVER : lo + Math.random() * (hi - lo));
        if (s.done) r.finishAt = r.nextAt;
        changed = true;
      } else if (r.finishAt !== undefined && clock >= r.finishAt) {
        r.finished = true;
        r.shown.done = true;
        const mh = currentHole(st.match);
        mh.strokes[r.p] = r.round.strokes;
        mh.titles[r.p] = r.round.title;
        st.progress[r.p] = { strokes: r.round.strokes, done: true, title: r.round.title };
        // Tell you how they did (in a big field, only the good ones).
        const great = r.round.strokes < st.hole.par;
        if (st.stage === 'playing' && (st.kind === '1v1' || great)) toast(`${r.bot.name}: ${r.round.title}`, `${r.round.strokes} ${r.round.strokes === 1 ? 'stroke' : 'strokes'}`);
        changed = true;
      } else break;
    }
    return changed;
  }

  function syncFriends() {
    const mh = currentHole(st.match);
    const list = [...st.rounds.values()].map((r, i) => ({
      id: botId(r.p), index: i, name: r.bot.name, look: r.bot.look,
      lie: r.shown.lie, shot: r.shown.shot, strokes: r.shown.strokes, done: r.shown.done,
    }));
    friends.sync({ hole: st.hole, wind: mh.wind, friends: list });
    const here = list.filter((f) => !f.done).map(({ id, name, strokes }) => ({ id, name, strokes }));
    const patch = { friendsHere: here };
    // Watching someone who just finished: back to your ball, or (once you're done) on to
    // whoever's still out there.
    if (session.state.watching && !here.some((f) => f.id === session.state.watching)) {
      patch.watching = st.stage === 'playing' ? null : here[0]?.id ?? null;
    }
    session.set(patch);
  }

  // You holed out (or picked up).
  session.subscribe((s) => {
    if (s.mode !== 'solo' || !st || st.stage !== 'playing' || !s.result) return;
    const mh = currentHole(st.match);
    mh.strokes[ME] = s.result.strokes;
    mh.titles[ME] = s.result.title;
    st.progress[ME] = { strokes: s.result.strokes, done: true, title: s.result.title };
    st.stage = 'waiting';
    st.speed = AFTER_YOU;
    pub();
    maybeFinishHole();
  });

  function maybeFinishHole() {
    if (st.stage !== 'waiting' && st.stage !== 'watching') return;
    if ([...st.rounds.values()].some((r) => !r.finished)) return;
    finishHole(st.match);
    st.stage = 'holeResult';
    session.set({ watching: null, friendsHere: [] });
    pub();
  }

  // Don't want to wait: the bots finish their holes instantly.
  function skip() {
    if (!st || (st.stage !== 'waiting' && st.stage !== 'watching')) return;
    for (const r of st.rounds.values()) {
      while (!r.round.done) r.planned.push(r.round.next());
      advance(r, Infinity);
    }
    syncFriends();
    maybeFinishHole();
  }

  function next() {
    if (!st || st.stage !== 'holeResult') return;
    nextHole(st.match);
    if (st.match.stage === 'final') {
      st.stage = 'final';
      friends.clear();
      pub();
      return;
    }
    loadHole();
  }

  function rematch() {
    if (!st) return;
    start(st.kind, st.bots, st.players[ME].name);
  }

  function quit() {
    st = null;
    friends.clear();
    session.set({ friendsHere: [], watching: null });
    pub();
  }

  return { start, teeOff, update, skip, next, rematch, quit, watchFirst: () => session.set({ watching: firstBotId(), lookAhead: false }) };
}
