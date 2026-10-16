import { TOUR_SPECS } from '../courses/tour.js';
import { PITCHES } from '../courses/pitches.js';
import { WIND_LEVELS, MS_TO_MPH } from '../config.js';
import { REGULATION_HOLES, MAX_STROKES, regulationStrokes } from '../game/match.js';

// Online play screens: the "Play online" card (create / join), the room lobby, and the cards
// shown over the course during an online match (tee-off intro, live "waiting for…" list, hole
// result, final scorecard).

const NAME_KEY = 'kopigolf.onlineName';
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createOnlineUI(session, actions, { toast }) {
  const $ = (id) => document.getElementById(id);
  const nameInput = $('online-name');
  const codeInput = $('join-code');
  const msg = $('online-msg');
  const createBtn = $('btn-create-room');
  const joinBtn = $('btn-join-room');

  // ----- Play online card -----
  try { nameInput.value = localStorage.getItem(NAME_KEY) || ''; } catch { /* storage blocked */ }
  if (!nameInput.value) {
    try { nameInput.value = JSON.parse(localStorage.getItem('kopigolf.players') || '[]')[0] || ''; } catch { /* ignore */ }
  }
  const myName = () => {
    const n = nameInput.value.trim().slice(0, 14);
    try { localStorage.setItem(NAME_KEY, n); } catch { /* storage blocked */ }
    return n;
  };
  const needName = () => {
    if (myName()) return false;
    nameInput.focus();
    session.set({ online: { ...session.state.online, error: 'Pop your name in first.' } });
    return true;
  };
  codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  createBtn.addEventListener('click', () => { if (!needName()) actions.create(myName()); });
  joinBtn.addEventListener('click', () => { if (!needName()) actions.join(codeInput.value, myName()); });
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinBtn.click(); });

  // ----- Lobby -----
  const leave = () => actions.leave();
  $('btn-lobby-leave').addEventListener('click', leave);
  $('btn-lobby-leave-2').addEventListener('click', leave);
  $('btn-lobby-start').addEventListener('click', () => actions.start());
  $('btn-invite').addEventListener('click', async () => {
    const url = actions.inviteLink();
    const code = session.state.online.code;
    try {
      if (navigator.share) { await navigator.share({ title: 'KopiGolf', text: `Join my KopiGolf room: ${code}`, url }); return; }
    } catch { /* share sheet closed: fall through to copying */ }
    try { await navigator.clipboard.writeText(url); toast('Invite link copied', code); } catch { toast(`Room code: ${code}`, url); }
  });

  // ----- Match overlay -----
  const overlay = $('online-overlay');
  const view = $('online-view');
  view.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'teeoff') actions.teeOff();
    else if (a === 'advance') actions.advance();
    else if (a === 'rematch') actions.rematch();
    else if (a === 'lobby') actions.toLobby();
    else if (a === 'leave') actions.leave();
    else if (a === 'pickup') actions.pickUpFor(Number(el.dataset.player));
  });

  let lastHtml = '';
  session.subscribe((s) => {
    const o = s.online ?? {};
    // card
    createBtn.disabled = joinBtn.disabled = !o.available || o.busy;
    msg.hidden = !(o.error || !o.available);
    msg.textContent = o.error || (!o.available ? 'Online play turns on once the game is linked to its free Firebase project (see ONLINE_SETUP.md).' : '');
    msg.classList.toggle('is-off', !o.error);
    if (o.prefillCode && !codeInput.value) codeInput.value = o.prefillCode;

    // lobby
    $('lobby').hidden = s.screen !== 'lobby';
    if (s.screen === 'lobby' && o.room) renderLobby(o);

    // overlay
    const show = s.screen === 'play' && s.mode === 'online' && o.view && !(o.view.state === 'hole' && o.view.myTurn && o.teedOff);
    overlay.hidden = !show;
    if (!show) { lastHtml = ''; return; }
    const html = OVERLAY[o.view.state === 'hole' ? (o.view.myTurn ? 'intro' : 'waiting') : o.view.state](o);
    if (html !== lastHtml) {
      lastHtml = html;
      view.innerHTML = html;
    }
  });

  function renderLobby(o) {
    const room = o.room;
    const me = o.me;
    $('lobby-code').textContent = o.code;
    const players = Object.entries(room.players ?? {}).sort((a, b) => a[1].joinedAt - b[1].joinedAt);
    $('lobby-players').innerHTML = players.map(([id, p]) => `
      <li class="lobby-player${p.online === false ? ' is-away' : ''}">
        <span class="lobby-dot" aria-hidden="true"></span>
        <span class="lobby-name">${esc(p.name || 'Player')}${id === me ? ' <small>(you)</small>' : ''}</span>
        ${id === room.host ? '<span class="lobby-host">Host</span>' : ''}
        ${p.online === false ? '<span class="lobby-away">away</span>' : ''}
      </li>`).join('');
    const isHost = room.host === me;
    const ready = players.filter(([, p]) => p.online !== false).length;
    const startBtn = $('btn-lobby-start');
    startBtn.hidden = !isHost;
    startBtn.disabled = ready < 2 || o.busy;
    const hostName = room.players?.[room.host]?.name || 'the host';
    $('lobby-note').textContent = o.error
      || (isHost
        ? (ready < 2 ? 'Send the code to your friends. You can start once someone joins.' : `${ready} players ready. Start when everyone's in.`)
        : `Waiting for ${hostName} to start the match…`);
  }
}

// ---------- overlay views ----------
function holeLabel(v) {
  const hole = v.match.holes[v.k];
  return hole.playoff ? 'Sudden death' : `Hole ${v.k + 1} of ${REGULATION_HOLES}`;
}

function windText(hole) {
  const level = WIND_LEVELS[hole.windLevel];
  if (!hole.wind || hole.wind.speed < 0.5) return level.label;
  return `${level.label} · ${Math.round(hole.wind.speed * MS_TO_MPH)} mph`;
}

function courseBox(hole) {
  const spec = TOUR_SPECS[hole.course];
  const ground = spec.pitch && spec.pitch !== 'grass' ? ` · ${PITCHES[spec.pitch].label}` : '';
  return `<div class="match-course"><p class="match-city">${esc(spec.city)}</p><p class="match-course-sub">${esc(spec.name)} · Par ${spec.par} · ${spec.yards} yd${ground}</p><p class="match-wind">Wind: ${windText(hole)}</p></div>`;
}

// Live list: who's done, who's still out there.
function progressList(o) {
  const v = o.view;
  const hole = v.match.holes[v.k];
  const rows = hole.players.map((p) => {
    const id = v.order[p];
    const online = o.room.players?.[id]?.online !== false;
    const done = hole.strokes[p] !== undefined;
    const me = p === v.myIndex;
    let status;
    if (done) status = `<b>${hole.strokes[p]}</b> <small>${esc(hole.titles[p] || '')}</small>`;
    else if (!online) status = `<button class="pickup-btn" type="button" data-action="pickup" data-player="${p}">Away · pick up</button>`;
    else status = '<span class="live-dots">playing<i>.</i><i>.</i><i>.</i></span>';
    return `<li class="live-row${done ? ' is-done' : ''}"><span class="live-name">${esc(v.match.players[p].name)}${me ? ' <small>(you)</small>' : ''}</span><span class="live-status">${status}</span></li>`;
  }).join('');
  return `<ul class="live-list">${rows}</ul>`;
}

function winsLine(v) {
  return `<p class="match-standing">${v.match.players.map((p, i) => `<span><b>${esc(p.name)}</b> ${v.match.wins[i]}</span>`).join('')}</p>`;
}

const OVERLAY = {
  intro(o) {
    const v = o.view;
    const hole = v.match.holes[v.k];
    return `
      <p class="result-kicker">${holeLabel(v)} · Online</p>
      ${courseBox(hole)}
      ${v.k > 0 ? `<p class="match-label">Holes won</p>${winsLine(v)}` : ''}
      <p class="match-label">Everyone plays at once</p>
      ${progressList(o)}
      <button class="primary-btn" type="button" data-action="teeoff">Tee off</button>
      <button class="text-btn" type="button" data-action="leave">Leave match</button>`;
  },

  waiting(o) {
    const v = o.view;
    const hole = v.match.holes[v.k];
    const mine = hole.strokes[v.myIndex];
    const watching = !hole.players.includes(v.myIndex);
    const head = watching
      ? `<h2 class="match-name">You're watching</h2><p class="result-line">Sudden death: ${hole.players.map((p) => esc(v.match.players[p].name)).join(' vs ')}</p>`
      : `<h2 class="result-title">${esc(hole.titles[v.myIndex] || 'Done')}</h2><p class="result-line">${mine} ${mine === 1 ? 'stroke' : 'strokes'} · waiting for the others</p>`;
    return `
      <p class="result-kicker">${holeLabel(v)} · ${esc(TOUR_SPECS[hole.course].city)}</p>
      ${head}
      ${progressList(o)}
      <p class="match-hint">Anyone away for good can be picked up (scored as ${MAX_STROKES}) so the rest can carry on.</p>`;
  },

  holeResult(o) {
    const v = o.view;
    const m = v.match;
    const hole = m.holes[v.k];
    const best = Math.min(...hole.players.map((p) => hole.strokes[p]));
    const title = hole.winner !== null ? `${esc(m.players[hole.winner].name)} wins the hole!` : 'Halved!';
    const rows = hole.players.map((p) => `
      <tr class="${hole.strokes[p] === best ? 'is-best' : ''}">
        <th scope="row">${esc(m.players[p].name)}${p === v.myIndex ? ' <small>(you)</small>' : ''}</th>
        <td>${hole.strokes[p]}${hole.titles[p] ? `<small class="match-title">${esc(hole.titles[p])}</small>` : ''}</td>
        <td>${m.wins[p]}</td>
      </tr>`).join('');
    let btn = 'Next hole';
    if (m.decided) btn = 'Crown the champion';
    else if (m.holes[v.k + 1]?.playoff) btn = 'Sudden death!';
    return `
      <p class="result-kicker">${holeLabel(v)} · ${esc(TOUR_SPECS[hole.course].city)}</p>
      <h2 class="match-name">${title}</h2>
      ${hole.winner === null ? '<p class="result-line">A tie for the best score: nobody takes the hole.</p>' : ''}
      <table class="match-table">
        <thead><tr><th scope="col">Player</th><th scope="col">Strokes</th><th scope="col">Holes won</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${!hole.playoff ? tiebreakLine(m) : ''}
      <button class="primary-btn" type="button" data-action="advance">${btn}</button>
      <p class="match-hint">Whoever taps first moves everyone on.</p>`;
  },

  final(o) {
    const v = o.view;
    const m = v.match;
    const champ = m.players[m.champion];
    const played = m.holes.slice(0, v.k + 1);
    const reg = regulationStrokes(m);
    const head = played.map((h, i) => `<th scope="col">${h.playoff ? 'SD' : i + 1}</th>`).join('');
    const rows = m.players.map((p, i) => `
      <tr class="${i === m.champion ? 'is-best' : ''}">
        <th scope="row">${i === m.champion ? '🏆 ' : ''}${esc(p.name)}${i === v.myIndex ? ' <small>(you)</small>' : ''}</th>
        ${played.map((h) => `<td class="${h.winner === i ? 'is-win' : ''}">${h.strokes[i] ?? '–'}</td>`).join('')}
        <td><b>${m.wins[i]}</b></td>
        <td>${reg[i]}</td>
      </tr>`).join('');
    const cities = played.map((h, i) => `${h.playoff ? 'SD' : i + 1} ${TOUR_SPECS[h.course].city}`).join(' · ');
    const iWon = m.champion === v.myIndex;
    return `
      <p class="result-kicker">Match over</p>
      <div class="match-trophy" aria-hidden="true">🏆</div>
      <h2 class="match-name">${iWon ? 'You win!' : `${esc(champ.name)} wins!`}</h2>
      <p class="result-line">${m.wonOnStrokes ? `Level on holes, won on fewer strokes (${reg[m.champion]})` : `${m.wins[m.champion]} ${m.wins[m.champion] === 1 ? 'hole' : 'holes'} won`}</p>
      <table class="match-table match-card-table">
        <thead><tr><th scope="col">Player</th>${head}<th scope="col">Won</th><th scope="col" title="Total strokes over the three holes">Strokes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="match-cities">${esc(cities)}</p>
      <button class="primary-btn" type="button" data-action="rematch">Rematch</button>
      <button class="secondary-btn" type="button" data-action="lobby">Back to the room</button>
      <button class="text-btn" type="button" data-action="leave">Leave</button>`;
  },
};

// After three holes, level on holes won: say it was settled on total strokes (or goes to sudden death).
function tiebreakLine(m) {
  if (!m.tiebreak) return '';
  const parts = m.tiebreak.players.map((p, i) => `${esc(m.players[p].name)} ${m.tiebreak.totals[i]}`).join(' · ');
  return m.wonOnStrokes
    ? `<p class="match-tiebreak">Level on holes, so fewest strokes wins: ${parts}</p>`
    : `<p class="match-tiebreak">Level on holes and on strokes (${parts}): sudden death!</p>`;
}
