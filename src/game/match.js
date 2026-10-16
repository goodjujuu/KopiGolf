// Best-of-3 match play for 2–4 friends passing one phone.
//
// The game picks three different city holes at random, each with its own random wind (the same
// wind for everyone on that hole). Every player plays each hole in turn; fewest strokes wins
// the hole, a tie for fewest halves it. First to win 2 holes takes the match. If nobody has 2
// after three holes, whoever won the most is champion; if that's tied, the tied players go to
// sudden death on extra random holes until one of them wins a hole outright.
//
// Pure logic, no DOM: main.js drives it and ui/match.js shows it.

export const HOLES_TO_WIN = 2;
export const REGULATION_HOLES = 3;
export const MAX_STROKES = 10; // pick up at this many so a bad hole can't hold the group up

// Random winds lean toward the playable end, with the odd hurricane for chaos.
const WIND_WEIGHTS = [['calm', 2], ['breezy', 3], ['windy', 3], ['stormy', 2], ['hurricane', 1]];

export function randomWindLevel(random = Math.random) {
  const total = WIND_WEIGHTS.reduce((n, [, w]) => n + w, 0);
  let r = random() * total;
  for (const [level, w] of WIND_WEIGHTS) {
    r -= w;
    if (r < 0) return level;
  }
  return 'calm';
}

function pickHole(used, courseCount, random) {
  const free = [];
  for (let i = 0; i < courseCount; i++) if (!used.has(i)) free.push(i);
  const pool = free.length ? free : Array.from({ length: courseCount }, (_, i) => i);
  return pool[Math.floor(random() * pool.length)];
}

function newHole(match, random, playoff = false) {
  const used = new Set(match.holes.map((h) => h.course));
  return {
    course: pickHole(used, match.courseCount, random),
    windLevel: randomWindLevel(random),
    wind: null, // drawn when the hole is first played, then shared by everyone
    players: playoff ? [...match.contenders] : match.players.map((_, i) => i),
    strokes: {}, // player index → strokes
    titles: {}, // player index → 'Birdie', 'Par', 'Picked up'…
    winner: null, // player index, or null for a halved hole
    playoff,
  };
}

export function createMatch(names, { courseCount, random = Math.random }) {
  const match = {
    players: names.map((name) => ({ name })),
    courseCount,
    holes: [],
    holeNo: 0, // index into holes
    turn: 0, // index into the current hole's players
    wins: names.map(() => 0),
    contenders: names.map((_, i) => i),
    stage: 'handoff', // 'handoff' → 'playing' → 'turnDone' → … → 'holeResult' → … → 'final'
    champion: null,
  };
  for (let i = 0; i < REGULATION_HOLES; i++) match.holes.push(newHole(match, random));
  return match;
}

export const currentHole = (m) => m.holes[m.holeNo];
export const currentPlayer = (m) => currentHole(m).players[m.turn];

// A player has finished the current hole.
export function recordTurn(m, strokes, title = '') {
  const hole = currentHole(m);
  hole.strokes[currentPlayer(m)] = strokes;
  hole.titles[currentPlayer(m)] = title;
  m.stage = 'turnDone';
  return m;
}

export function isLastTurn(m) {
  return m.turn >= currentHole(m).players.length - 1;
}

// Move to the next player on this hole.
export function nextTurn(m) {
  m.turn += 1;
  m.stage = 'handoff';
  return m;
}

// Everyone has played the hole: decide it and update the match.
export function finishHole(m, random = Math.random) {
  const hole = currentHole(m);
  const scores = hole.players.map((p) => hole.strokes[p]);
  const best = Math.min(...scores);
  const leaders = hole.players.filter((p) => hole.strokes[p] === best);
  hole.winner = leaders.length === 1 ? leaders[0] : null;
  if (hole.winner !== null) m.wins[hole.winner] += 1;

  // Decided?
  const most = Math.max(...m.wins);
  if (hole.playoff) {
    if (hole.winner !== null) m.champion = hole.winner;
    else m.contenders = leaders; // only those who tied for best stay in sudden death
  } else if (most >= HOLES_TO_WIN) {
    m.champion = m.wins.indexOf(most);
  } else if (m.holeNo + 1 >= REGULATION_HOLES) {
    const top = m.wins.map((w, i) => (w === most ? i : -1)).filter((i) => i >= 0);
    if (top.length === 1) m.champion = top[0];
    else m.contenders = top;
  }
  m.stage = 'holeResult';
  m.decided = m.champion !== null;
  if (!m.decided && m.holeNo + 1 >= m.holes.length) m.holes.push(newHole(m, random, true));
  return m;
}

export function nextHole(m) {
  if (m.decided) {
    m.stage = 'final';
    return m;
  }
  m.holeNo += 1;
  m.turn = 0;
  m.stage = 'handoff';
  return m;
}

// Total strokes per player over the holes they played (for the scorecard).
export function totals(m) {
  return m.players.map((_, i) => m.holes.reduce((n, h) => n + (h.strokes[i] ?? 0), 0));
}
