import { TOUR_SPECS } from '../courses/tour.js';
import { PITCHES } from '../courses/pitches.js';
import { WIND_LEVELS, MS_TO_MPH } from '../config.js';
import { currentHole, currentPlayer, isLastTurn, regulationStrokes, REGULATION_HOLES, MAX_STROKES } from '../game/match.js';

// Best-of-3 match screens: the player setup on the Play with friends page, and the overlay that
// runs the match on the course — "pass the phone" hand-offs, each player's score, the hole
// result and the final scorecard.

const PLAYERS_KEY = 'kopigolf.players';
const MAX_PLAYERS = 4;

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- player setup ----------
export function createMatchSetup({ onStart }) {
  const list = document.getElementById('match-players');
  const addBtn = document.getElementById('btn-add-player');
  const startBtn = document.getElementById('btn-start-match');

  let names = ['Player 1', 'Player 2'];
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYERS_KEY) || 'null');
    if (Array.isArray(saved) && saved.length >= 2) names = saved.slice(0, MAX_PLAYERS).map(String);
  } catch { /* storage blocked */ }

  const save = () => { try { localStorage.setItem(PLAYERS_KEY, JSON.stringify(names)); } catch { /* storage blocked */ } };

  function render() {
    list.innerHTML = names.map((n, i) => `
      <li class="match-player">
        <span class="match-player-num" aria-hidden="true">${i + 1}</span>
        <input class="match-player-name" type="text" maxlength="14" autocomplete="off" spellcheck="false"
          value="${esc(n)}" data-index="${i}" aria-label="Player ${i + 1} name">
        ${names.length > 2 ? `<button class="match-player-remove" type="button" data-remove="${i}" aria-label="Remove player ${i + 1}">×</button>` : ''}
      </li>`).join('');
    addBtn.hidden = names.length >= MAX_PLAYERS;
  }

  list.addEventListener('input', (e) => {
    const i = Number(e.target.dataset.index);
    if (Number.isInteger(i)) { names[i] = e.target.value; save(); }
  });
  list.addEventListener('click', (e) => {
    const i = e.target.closest('[data-remove]')?.dataset.remove;
    if (i === undefined) return;
    names.splice(Number(i), 1);
    save();
    render();
  });
  addBtn.addEventListener('click', () => {
    if (names.length >= MAX_PLAYERS) return;
    names.push(`Player ${names.length + 1}`);
    save();
    render();
    list.querySelectorAll('input')[names.length - 1]?.select();
  });
  startBtn.addEventListener('click', () => {
    const clean = names.map((n, i) => n.trim().slice(0, 14) || `Player ${i + 1}`);
    onStart(clean);
  });
  render();
}

// ---------- the match overlay ----------
export function createMatchOverlay(session, { onTeeOff, onNextTurn, onNextHole, onRematch, onHome }) {
  const root = document.getElementById('match');
  const card = document.getElementById('match-card');

  card.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    ({ teeoff: onTeeOff, next: onNextTurn, hole: onNextHole, rematch: onRematch, home: onHome })[action]?.();
  });

  let lastKey = '';
  session.subscribe((s) => {
    const m = s.mode === 'match' && s.screen === 'play' ? s.match : null;
    const show = !!m && m.stage !== 'playing';
    root.hidden = !show;
    if (!show) { lastKey = ''; return; }
    const key = `${m.stage}|${m.holeNo}|${m.turn}|${currentHole(m).wind ? 1 : 0}`;
    if (key === lastKey) return;
    lastKey = key;
    card.innerHTML = VIEWS[m.stage](m);
    card.querySelector('.primary-btn')?.focus({ preventScroll: true });
  });
}

function holeLabel(m, hole = currentHole(m)) {
  return hole.playoff ? 'Sudden death' : `Hole ${m.holeNo + 1} of ${REGULATION_HOLES}`;
}

export function windText(hole) {
  const level = WIND_LEVELS[hole.windLevel];
  if (!hole.wind || hole.wind.speed < 0.5) return level.label;
  return `${level.label} · ${Math.round(hole.wind.speed * MS_TO_MPH)} mph`;
}

function standings(m) {
  return `<p class="match-standing">${m.players.map((p, i) =>
    `<span><b>${esc(p.name)}</b> ${m.wins[i]}</span>`).join('')}</p>`;
}

const VIEWS = {
  handoff(m) {
    const hole = currentHole(m);
    const spec = TOUR_SPECS[hole.course];
    const p = m.players[currentPlayer(m)];
    const ground = spec.pitch && spec.pitch !== 'grass' ? ` · ${PITCHES[spec.pitch].label}` : '';
    const first = m.turn === 0;
    return `
      <p class="result-kicker">${holeLabel(m)}${hole.playoff ? ` · ${hole.players.map((i) => esc(m.players[i].name)).join(' vs ')}` : ''}</p>
      ${first ? `<div class="match-course"><p class="match-city">${esc(spec.city)}</p><p class="match-course-sub">${esc(spec.name)} · Par ${spec.par} · ${spec.yards} yd${ground}</p><p class="match-wind">Wind: ${windText(hole)}</p></div>` : ''}
      <p class="match-pass">${first && m.holeNo === 0 ? 'First up' : 'Pass the phone to'}</p>
      <h2 class="match-name">${esc(p.name)}</h2>
      ${!first ? `<p class="result-line">${spec.city} · Par ${spec.par} · Wind: ${windText(hole)}</p>` : ''}
      ${m.holeNo > 0 ? `<p class="match-label">Holes won</p>${standings(m)}` : ''}
      <button class="primary-btn" type="button" data-action="teeoff">Tee off</button>
      <button class="text-btn" type="button" data-action="home">Quit match</button>`;
  },

  turnDone(m) {
    const hole = currentHole(m);
    const pi = currentPlayer(m);
    const strokes = hole.strokes[pi];
    const nextName = isLastTurn(m) ? null : m.players[hole.players[m.turn + 1]].name;
    const picked = hole.titles[pi] === 'Picked up';
    return `
      <p class="result-kicker">${holeLabel(m)} · ${esc(m.players[pi].name)}</p>
      <h2 class="result-title">${esc(hole.titles[pi])}</h2>
      <p class="result-line">${strokes} ${strokes === 1 ? 'stroke' : 'strokes'}${picked ? ` (the limit is ${MAX_STROKES})` : ''}</p>
      <button class="primary-btn" type="button" data-action="${nextName ? 'next' : 'hole'}">${nextName ? `Pass to ${esc(nextName)}` : 'Who won the hole?'}</button>`;
  },

  holeResult(m) {
    const hole = currentHole(m);
    const spec = TOUR_SPECS[hole.course];
    const best = Math.min(...hole.players.map((p) => hole.strokes[p]));
    const title = hole.winner !== null ? `${esc(m.players[hole.winner].name)} wins the hole!` : 'Halved!';
    const sub = hole.winner !== null ? '' : '<p class="result-line">A tie for the best score: nobody takes the hole.</p>';
    const rows = hole.players.map((p) => `
      <tr class="${hole.strokes[p] === best ? 'is-best' : ''}">
        <th scope="row">${esc(m.players[p].name)}</th>
        <td>${hole.strokes[p]}${hole.titles[p] ? `<small class="match-title">${esc(hole.titles[p])}</small>` : ''}</td>
        <td>${m.wins[p]}</td>
      </tr>`).join('');
    let btn = 'Next hole';
    if (m.decided) btn = 'Crown the champion';
    else if (m.holes[m.holeNo + 1]?.playoff) btn = 'Sudden death!';
    return `
      <p class="result-kicker">${holeLabel(m)} · ${esc(spec.city)}</p>
      <h2 class="match-name">${title}</h2>${sub}
      <table class="match-table">
        <thead><tr><th scope="col">Player</th><th scope="col">Strokes</th><th scope="col">Holes won</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${!hole.playoff ? tiebreakLine(m) : ''}
      <button class="primary-btn" type="button" data-action="hole">${btn}</button>`;
  },

  final(m) {
    const champ = m.players[m.champion];
    const played = m.holes.slice(0, m.holeNo + 1);
    const reg = regulationStrokes(m);
    const head = played.map((h, i) => `<th scope="col" title="${esc(TOUR_SPECS[h.course].city)}">${h.playoff ? 'SD' : i + 1}</th>`).join('');
    const rows = m.players.map((p, i) => `
      <tr class="${i === m.champion ? 'is-best' : ''}">
        <th scope="row">${i === m.champion ? '🏆 ' : ''}${esc(p.name)}</th>
        ${played.map((h) => `<td class="${h.winner === i ? 'is-win' : ''}">${h.strokes[i] ?? '–'}</td>`).join('')}
        <td><b>${m.wins[i]}</b></td>
        <td>${reg[i]}</td>
      </tr>`).join('');
    const cities = played.map((h, i) => `${h.playoff ? 'SD' : i + 1} ${TOUR_SPECS[h.course].city}`).join(' · ');
    return `
      <p class="result-kicker">Match over</p>
      <div class="match-trophy" aria-hidden="true">🏆</div>
      <h2 class="match-name">${esc(champ.name)} wins!</h2>
      <p class="result-line">${m.wonOnStrokes ? `Level on holes, won on fewer strokes (${reg[m.champion]})` : `${m.wins[m.champion]} ${m.wins[m.champion] === 1 ? 'hole' : 'holes'} won`}</p>
      <table class="match-table match-card-table">
        <thead><tr><th scope="col">Player</th>${head}<th scope="col">Won</th><th scope="col" title="Total strokes over the three holes">Strokes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="match-cities">${esc(cities)}</p>
      <button class="primary-btn" type="button" data-action="rematch">Rematch</button>
      <button class="text-btn" type="button" data-action="home">Back to home</button>`;
  },
};

// After three holes, level on holes won: say it was settled on total strokes (or goes to sudden death).
export function tiebreakLine(m) {
  if (!m.tiebreak) return '';
  const parts = m.tiebreak.players.map((p, i) => `${esc(m.players[p].name)} ${m.tiebreak.totals[i]}`).join(' · ');
  return m.wonOnStrokes
    ? `<p class="match-tiebreak">Level on holes, so fewest strokes wins: ${parts}</p>`
    : `<p class="match-tiebreak">Level on holes and on strokes (${parts}): sudden death!</p>`;
}
