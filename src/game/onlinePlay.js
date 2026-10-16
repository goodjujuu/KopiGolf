import { connectBackend, onlineMode } from '../net/backend.js';
import { createRoomApi, deviceId, replayRoom, cleanCode, NET_VERSION } from '../net/online.js';
import { MAX_STROKES } from './match.js';

// Online play on your own phone: joins a room, follows it, and drives this device's game.
// Writes session.state.online = { available, busy, error, code, room, view, teedOff } for the UI.
//   view = replayRoom(...) → { match, k, state: 'hole' | 'holeResult' | 'final', myTurn, … }

const ROOM_KEY = 'kopigolf.onlineRoom';

// getLook(): this device's Locker look. friends: the scene's other-player layer (world/ghosts.js).
export function createOnlinePlay({ session, controller, catalog, toast, getLook = () => ({}), friends = null }) {
  const mode = onlineMode();
  let api = null;
  let unsubscribe = null;
  let code = null;
  let room = null;
  let loadedK = -1; // hole index currently loaded on this device
  let loadedSeed = null;
  let teedOff = false; // this device is playing hole loadedK right now
  let lastScores = '';
  let pendingLineup = null;

  const patch = (p) => session.set({ online: { ...session.state.online, ...p } });
  // Remember the room per device (per tab on the local test backend, where tabs share storage).
  const store = () => (mode === 'local' ? sessionStorage : localStorage);
  patch({ available: !!mode, local: mode === 'local', busy: false, error: '', code: null, room: null, view: null, teedOff: false });

  async function ensureApi() {
    if (api) return api;
    if (!mode) throw new Error('Online play is not switched on yet.');
    patch({ busy: true, error: '' });
    try {
      const backend = await connectBackend();
      api = createRoomApi(backend, deviceId(mode === 'local'));
      patch({ me: api.me });
      return api;
    } catch (e) {
      throw new Error('Could not reach the game server. Check your connection and try again.');
    } finally {
      patch({ busy: false });
    }
  }

  async function run(task) {
    patch({ busy: true, error: '' });
    try { await task(); } catch (e) { patch({ error: e.message || String(e) }); } finally { patch({ busy: false }); }
  }

  function follow(next) {
    unsubscribe?.();
    code = next;
    api.setLook(code, getLook()).catch(() => {});
    try { store().setItem(ROOM_KEY, code); } catch { /* storage blocked */ }
    patch({ code });
    unsubscribe = api.subscribe(code, onRoom);
  }

  function stopFollowing(message = '') {
    unsubscribe?.();
    unsubscribe = null;
    code = null;
    room = null;
    loadedK = -1;
    teedOff = false;
    try { store().removeItem(ROOM_KEY); } catch { /* storage blocked */ }
    patch({ code: null, room: null, view: null, teedOff: false, error: message });
    friends?.clear();
    setFriendsHere([]);
    const s = session.state;
    if (s.mode === 'online' || s.screen === 'lobby') session.set({ screen: 'tour', mode: 'tour' });
  }

  function onRoom(next) {
    room = next;
    if (!room) { stopFollowing('That room has closed.'); return; }
    if (!room.players?.[api.me]) { stopFollowing('You left the room.'); return; }

    checkVersions();
    if (room.status === 'lobby') {
      friends?.clear();
      setFriendsHere([]);
      loadedK = -1;
      teedOff = false;
      patch({ room, view: null, teedOff });
      if (session.state.screen !== 'lobby') session.set({ screen: 'lobby', mode: 'tour' });
      return;
    }

    const view = replayRoom(room, catalog.tour.count, api.me);
    if (room.seed !== loadedSeed) {
      loadedSeed = room.seed;
      loadedK = -1;
      teedOff = false;
      lastScores = '';
      // A brand-new match: line everyone up first (after this update has been applied).
      if (!room.scores) {
        pendingLineup = {
            players: view.order.map((id) => ({ name: room.players?.[id]?.name || 'Player', look: room.players?.[id]?.look ?? {} })),
            title: 'Online match',
            sub: `Room ${code} · best of 3 · ${view.order.length} golfers`,
        };
      }
    }

    // Friends finishing while you play: a quick heads-up.
    announceScores(view);

    // Keep the right hole on screen. Never swap it out from under a shot in progress.
    if (view.k !== loadedK && !(teedOff && view.state === 'hole' && view.myTurn)) {
      loadHole(view);
    }
    if (!view.myTurn) teedOff = false;
    syncFriends(view);
    patch({ room, view, teedOff });
    if (session.state.screen !== 'play' || session.state.mode !== 'online') session.set({ screen: 'play', mode: 'online' });
    if (pendingLineup) {
      const lineup = pendingLineup;
      pendingLineup = null;
      session.set({ lineup });
    }
  }

  // Show everyone else on this hole on my course: where their ball is, and replay new swings.
  function syncFriends(view) {
    if (!friends) return;
    if (view.state !== 'hole') { friends.clear(); setFriendsHere([]); return; }
    const mh = view.match.holes[view.k];
    const live = room.live?.[view.k] ?? {};
    const list = mh.players
      .filter((p) => p !== view.myIndex)
      .map((p, i) => {
        const id = view.order[p];
        const l = live[id] ?? {};
        return {
          id, index: i, name: view.match.players[p].name, look: room.players?.[id]?.look ?? {},
          lie: l.lie ?? null, shot: l.shot ?? null, strokes: Math.max(l.strokes ?? 0, l.shot?.n ?? 0),
          done: !!l.done || mh.strokes[p] !== undefined,
        };
      });
    friends.sync({ hole: catalog.tour.hole(mh.course), wind: mh.wind, friends: list });
    setFriendsHere(list.filter((f) => !f.done).map(({ id, name, strokes }) => ({ id, name, strokes })));
  }

  // Who the Friends button can cycle through. Stop watching anyone who has holed out.
  function setFriendsHere(list) {
    const s = session.state;
    const patchState = { friendsHere: list };
    if (s.watching && !list.some((f) => f.id === s.watching)) patchState.watching = null;
    session.set(patchState);
  }

  // Everyone needs the same version of the game to see each other. Old copies don't send where
  // their ball is, so say so once per player instead of leaving them invisible.
  const warned = new Set();
  function checkVersions() {
    for (const [id, p] of Object.entries(room.players ?? {})) {
      if (id === api.me || p?.online === false) continue;
      const v = Number(p?.v ?? 0);
      const key = `${code}|${id}|${v}`;
      if (v === NET_VERSION || warned.has(key)) continue;
      warned.add(key);
      if (v < NET_VERSION) toast(`${p?.name || 'A friend'} needs to refresh`, 'They have an older KopiGolf, so you can\'t see them on the course');
      else toast('Refresh to update KopiGolf', `${p?.name || 'A friend'} has a newer version`);
    }
  }

  function announceScores(view) {
    const hole = view.match.holes[view.k];
    const key = `${room.seed}|${view.k}|${JSON.stringify(hole.strokes)}`;
    if (lastScores && key !== lastScores && teedOff) {
      const prev = JSON.parse(lastScores.split('|')[2] || '{}');
      for (const [p, strokes] of Object.entries(hole.strokes)) {
        if (prev[p] === undefined && Number(p) !== view.myIndex) {
          toast(`${view.match.players[p].name}: ${hole.titles[p] || 'done'}`, `${strokes} ${strokes === 1 ? 'stroke' : 'strokes'}`);
        }
      }
    }
    lastScores = key;
  }

  function loadHole(view) {
    const mh = view.match.holes[view.k];
    const hole = catalog.tour.hole(mh.course);
    loadedK = view.k;
    teedOff = false;
    session.set({ hole, mode: 'online', screen: 'play' });
    controller.startHole(hole, session.state.settings, { wind: mh.wind, maxStrokes: MAX_STROKES });
    session.set({ lookAhead: true });
  }

  // My swings and where my ball ends up, for friends' screens.
  controller.events.onShot = (shot) => {
    if (session.state.mode !== 'online' || !teedOff || !code) return;
    api.setLive(code, loadedK, { shot }).catch(() => {});
  };
  controller.events.onLie = (lie) => {
    if (session.state.mode !== 'online' || !teedOff || !code) return;
    api.setLive(code, loadedK, { lie: { x: lie.x, z: lie.z }, strokes: lie.strokes }).catch(() => {});
  };

  // This device finished its hole: send the score.
  session.subscribe((s) => {
    if (s.mode !== 'online' || !teedOff || !s.result || !code) return;
    const k = loadedK;
    teedOff = false;
    patch({ teedOff });
    api.submitScore(code, k, s.result.strokes, s.result.title).catch(() => patch({ error: 'Your score did not send. Check your connection.' }));
    api.setLive(code, k, { done: true }).catch(() => {});
  });

  const actions = {
    async create(name) {
      await run(async () => {
        await ensureApi();
        follow(await api.create(name));
      });
    },
    async join(rawCode, name) {
      const c = cleanCode(rawCode);
      if (c.length < 4) { patch({ error: 'Room codes are 4 letters.' }); return; }
      await run(async () => {
        await ensureApi();
        follow(await api.join(c, name));
      });
    },
    async leave() {
      const c = code;
      const r = room;
      stopFollowing();
      if (api && c) await api.leave(c, r).catch(() => {});
    },
    start: () => run(() => api.start(code, room)),
    teeOff() {
      const view = session.state.online.view;
      if (!view?.myTurn) return;
      if (view.k !== loadedK) loadHole(view);
      const mh = view.match.holes[view.k];
      const hole = catalog.tour.hole(mh.course);
      controller.startHole(hole, session.state.settings, { wind: mh.wind, maxStrokes: MAX_STROKES });
      teedOff = true;
      patch({ teedOff });
      api.setLive(code, view.k, { lie: { x: hole.tee[0], z: hole.tee[2] }, strokes: 0, shot: null, done: false }).catch(() => {});
      session.set({ lookAhead: false });
    },
    pickUpFor: (index) => run(() => api.pickUpFor(code, session.state.online.view.k, room.order[index] ?? room.order?.[String(index)])),
    advance: () => run(() => api.advance(code, session.state.online.view.k)),
    rematch: () => run(() => api.rematch(code, room)),
    toLobby: () => run(() => api.backToLobby(code)),
    inviteLink() {
      const url = new URL(location.href);
      url.search = '';
      url.hash = '';
      url.searchParams.set('room', code);
      if (mode === 'local') url.searchParams.set('net', 'local');
      return url.toString();
    },
    clearError: () => patch({ error: '' }),
    // Locker changed: friends see the new look from the next update.
    setLook(look) {
      if (api && code) api.setLook(code, look).catch(() => {});
    },
  };

  // Opened from an invite link, or refreshed mid-match: pick the room back up.
  (async () => {
    if (!mode) return;
    const params = new URLSearchParams(location.search);
    const linked = cleanCode(params.get('room'));
    let remembered = null;
    try { remembered = store().getItem(ROOM_KEY); } catch { /* storage blocked */ }
    if (linked) {
      patch({ prefillCode: linked });
      session.set({ screen: 'tour' });
    }
    const rejoin = remembered && (!linked || linked === remembered) ? remembered : null;
    if (!rejoin) return;
    try {
      await ensureApi();
      const existing = await api.join(rejoin, '', { rejoinOnly: true });
      follow(existing);
    } catch {
      try { store().removeItem(ROOM_KEY); } catch { /* storage blocked */ }
    }
  })();

  return actions;
}
