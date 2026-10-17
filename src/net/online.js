import { seededRandom } from '../courses/generate.js';
import { drawWind } from '../game/controller.js';
import { createMatch, finishHole, MAX_STROKES } from '../game/match.js';

// Online rooms: friends on their own phones play the same best-of-3 at the same time.
//
// Everything lives under rooms/<CODE> in the realtime store (net/backend.js):
//   host, createdAt, status ('lobby' | 'playing'), seed,
//   players/<id>: { name, joinedAt, online }
//   order: [ids]            fixed when the match starts (player 0, 1, …)
//   holeNo                  the hole everyone is on (anyone can move it on once a hole is done)
//   scores/<hole>/<id>: { strokes, title }
//   players/<id>/look                the golfer's Locker look (for the line-up and on-course avatars)
//   live/<hole>/<id>: { lie, strokes, shot, done }   where each ball is and the last swing, so
//                                    friends' phones can replay shots and show the golfer there
//
// No device is "in charge" of the match. Each one rebuilds it from the seed and the scores with
// the same pure rules as pass-the-phone (game/match.js), so all phones always agree on the
// holes, the winds and who won.

export const ROOM_CODE_LENGTH = 4;
export const MAX_ONLINE_PLAYERS = 6;
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (they look like 1 and 0)

const randomCode = () => Array.from({ length: ROOM_CODE_LENGTH }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
const randomSeed = () => Math.random().toString(36).slice(2, 10);
export const cleanCode = (text) => String(text ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, ROOM_CODE_LENGTH);

// Who this device is. Kept so a refresh drops you back into your room. (On the local test
// backend each tab is its own player.)
// Bump when what devices send each other changes; friends on a different number get a
// "refresh" heads-up. 2 = friends on the course (live lies and swings). 3 = new hole layouts.
export const NET_VERSION = 3;

export function deviceId(local) {
  const store = local ? sessionStorage : localStorage;
  const key = 'kopigolf.deviceId';
  try {
    let id = store.getItem(key);
    if (!id) { id = `p${Math.random().toString(36).slice(2, 10)}`; store.setItem(key, id); }
    return id;
  } catch {
    return `p${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function createRoomApi(backend, me) {
  const roomPath = (code) => `rooms/${code}`;

  async function markOnline(code) {
    await backend.update(`${roomPath(code)}/players/${me}`, { online: true });
    backend.onDisconnectSet(`${roomPath(code)}/players/${me}/online`, false);
  }

  return {
    me,

    async create(name) {
      for (let tries = 0; tries < 8; tries++) {
        const code = randomCode();
        const ok = await backend.transaction(roomPath(code), (cur) => {
          if (cur) return undefined; // taken: try another code
          return {
            host: me,
            createdAt: Date.now(),
            status: 'lobby',
            seed: randomSeed(),
            holeNo: 0,
            players: { [me]: { name, joinedAt: Date.now(), online: true } },
          };
        });
        if (ok) { await markOnline(code); return code; }
      }
      throw new Error('Could not make a room just now. Try again.');
    },

    // rejoinOnly: only if this device is already in the room (picking up after a refresh)
    async join(code, name, { rejoinOnly = false } = {}) {
      const room = await backend.get(roomPath(code));
      if (!room) throw new Error(`No room called ${code}. Check the code?`);
      const already = room.players?.[me];
      if (!already && rejoinOnly) throw new Error('Not in that room.');
      if (!already) {
        if (room.status !== 'lobby') throw new Error('That match has already teed off.');
        if (Object.keys(room.players ?? {}).length >= MAX_ONLINE_PLAYERS) throw new Error('That room is full.');
        await backend.set(`${roomPath(code)}/players/${me}`, { name, joinedAt: Date.now(), online: true });
      } else if (name && already.name !== name) {
        await backend.update(`${roomPath(code)}/players/${me}`, { name });
      }
      await markOnline(code);
      return code;
    },

    // Also stamps which version of the game this device runs (see NET_VERSION).
    setLook(code, look) {
      return backend.update(`${roomPath(code)}/players/${me}`, { look, v: NET_VERSION });
    },

    // KopiBucks this player puts in the pot (set in the lobby).
    setWager(code, amount) {
      return backend.update(`${roomPath(code)}/players/${me}`, { wager: amount });
    },

    setLive(code, holeNo, patch) {
      return backend.update(`${roomPath(code)}/live/${holeNo}/${me}`, patch);
    },

    subscribe(code, cb) {
      return backend.subscribe(roomPath(code), cb);
    },

    async leave(code, room) {
      if (!room) return;
      if (room.status === 'lobby') {
        await backend.remove(`${roomPath(code)}/players/${me}`);
        const left = Object.keys(room.players ?? {}).filter((id) => id !== me);
        if (!left.length) await backend.remove(roomPath(code));
        else if (room.host === me) await backend.update(roomPath(code), { host: left[0] });
      } else {
        await backend.update(`${roomPath(code)}/players/${me}`, { online: false });
      }
    },

    async start(code, room) {
      const order = Object.entries(room.players ?? {})
        .filter(([, p]) => p.online !== false)
        .sort((a, b) => a[1].joinedAt - b[1].joinedAt)
        .map(([id]) => id);
      if (order.length < 2) throw new Error('You need at least 2 players.');
      await backend.update(roomPath(code), { status: 'playing', order, holeNo: 0, scores: null, live: null, seed: randomSeed() });
    },

    submitScore(code, holeNo, strokes, title) {
      return backend.set(`${roomPath(code)}/scores/${holeNo}/${me}`, { strokes, title });
    },

    // Someone has dropped out mid-hole: score them as picked up so the rest can carry on.
    pickUpFor(code, holeNo, id) {
      return backend.transaction(`${roomPath(code)}/scores/${holeNo}/${id}`, (cur) =>
        (cur ? undefined : { strokes: MAX_STROKES, title: 'Picked up' }));
    },

    // Move everyone on from hole `from` (only once, whoever taps first).
    advance(code, from) {
      return backend.transaction(`${roomPath(code)}/holeNo`, (cur) => ((cur ?? 0) === from ? from + 1 : undefined));
    },

    async rematch(code, room) {
      const order = (room.order ?? []).filter((id) => room.players?.[id]?.online !== false);
      if (order.length < 2) throw new Error('Not enough players still here for a rematch.');
      await backend.update(roomPath(code), { status: 'playing', order, holeNo: 0, scores: null, live: null, seed: randomSeed() });
    },

    async backToLobby(code) {
      await backend.update(roomPath(code), { status: 'lobby', holeNo: 0, scores: null, live: null });
    },
  };
}

// The wind for hole k of a match: the same on every phone.
export function windFor(seed, k, level) {
  return drawWind(level, seededRandom(`${seed}:wind:${k}`));
}

const asList = (v) => (Array.isArray(v) ? v : v ? Object.keys(v).sort((a, b) => a - b).map((k) => v[k]) : []);

// Rebuild the match from the room, and work out what this device should be showing.
//   state: 'hole' (hole k in progress) · 'holeResult' (hole k decided) · 'final'
export function replayRoom(room, courseCount, me) {
  const order = asList(room.order);
  const names = order.map((id) => room.players?.[id]?.name || 'Player');
  const rng = seededRandom(room.seed);
  const m = createMatch(names, { courseCount, random: rng });
  const scores = room.scores ?? {};
  const roomHole = room.holeNo ?? 0;
  const myIndex = order.indexOf(me);
  for (let k = 0; k < 40; k++) {
    m.holeNo = k;
    const hole = m.holes[k];
    hole.wind = windFor(room.seed, k, hole.windLevel);
    const sc = scores[k] ?? {};
    for (const p of hole.players) {
      const s = sc[order[p]];
      if (s) { hole.strokes[p] = s.strokes; hole.titles[p] = s.title; }
    }
    const complete = hole.players.every((p) => hole.strokes[p] !== undefined);
    const base = { match: m, k, order, myIndex };
    if (!complete) {
      const mine = hole.players.includes(myIndex);
      return { ...base, state: 'hole', myTurn: mine && hole.strokes[myIndex] === undefined, playing: mine };
    }
    finishHole(m, rng);
    if (roomHole > k) {
      if (m.decided) return { ...base, state: 'final' };
      continue;
    }
    return { ...base, state: 'holeResult' };
  }
  return { match: m, k: m.holeNo, order, myIndex, state: 'final' };
}
