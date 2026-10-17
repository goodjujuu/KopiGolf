import { TOUR_SPECS } from '../courses/tour.js';
import { PITCHES } from '../courses/pitches.js';
import { REGULATION_HOLES, regulationStrokes } from '../game/match.js';
import { SKILLS, pickBots } from '../game/bots.js';
import { matchingPreset } from '../avatar/looks.js';
import { windText, tiebreakLine } from './match.js';

// "Play" (solo): pick 1v1 or Tournament, a few seconds of matchmaking, "Match found!", then
// the match itself with its cards over the course (tee-off, waiting for the bots, hole result,
// final standings).

const SEARCH_TIME = 3000;
const FOUND_TIME = 3500; // the "Match found" card tees off by itself after this
const NAME_KEY = 'kopigolf.onlineName';
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KINDS = {
  '1v1': { label: '1v1', bots: 1 },
  tournament: { label: 'Tournament', bots: 5 },
};

const stars = (skill) => {
  const n = SKILLS[skill]?.stars ?? 0;
  return `<span class="solo-stars" aria-label="${n} of 5 stars">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
};
const face = (look = {}) => `<span class="preset-face" aria-hidden="true" style="--skin:${look.skin ?? '#e0a476'};--hair:${look.hairColour ?? '#1c1712'};--top:${look.topColour ?? '#3a63d8'}"><i></i></span>`;

export function myName() {
  try { return (localStorage.getItem(NAME_KEY) || '').trim().slice(0, 14) || 'You'; } catch { return 'You'; }
}

export function createSoloUI(session, solo, { getLook }) {
  const $ = (id) => document.getElementById(id);
  const screen = $('solo');
  const panel = $('solo-panel');
  const overlay = $('solo-overlay');
  const view = $('solo-view');
  let find = { phase: 'choose' }; // matchmaking: choose → searching → found
  let timer = 0;
  let tick = 0;

  $('btn-open-solo').addEventListener('click', () => { find = { phase: 'choose' }; session.set({ screen: 'solo' }); renderFind(); });
  $('btn-solo-back').addEventListener('click', back);

  function back() {
    clearTimeout(timer);
    clearInterval(tick);
    if (find.phase === 'choose') session.set({ screen: 'home' });
    else { find = { phase: 'choose' }; renderFind(); }
  }

  panel.addEventListener('click', (e) => {
    const kind = e.target.closest('[data-kind]')?.dataset.kind;
    if (kind) { search(kind); return; }
    const a = e.target.closest('[data-solo]')?.dataset.solo;
    if (a === 'cancel') back();
    if (a === 'go') go();
  });

  function search(kind) {
    find = { phase: 'searching', kind, started: Date.now() };
    renderFind();
    clearInterval(tick);
    tick = setInterval(() => {
      const el = panel.querySelector('.solo-timer');
      if (el) el.textContent = `0:0${Math.min(9, Math.floor((Date.now() - find.started) / 1000))}`;
    }, 250);
    clearTimeout(timer);
    timer = setTimeout(() => {
      clearInterval(tick);
      // Don't match you against the crew member you're dressed as (or named after).
      const me = myName().toLowerCase().replace(/[^a-z]/g, '');
      const exclude = [matchingPreset(getLook()), me].filter(Boolean);
      find = { phase: 'found', kind, bots: pickBots(KINDS[kind].bots, { exclude }) };
      renderFind();
      timer = setTimeout(go, FOUND_TIME);
    }, SEARCH_TIME);
  }

  function go() {
    clearTimeout(timer);
    if (find.phase !== 'found') return;
    const { kind, bots } = find;
    find = { phase: 'choose' };
    solo.start(kind, bots, myName());
  }

  function renderFind() {
    $('solo-title').textContent = find.phase === 'choose' ? 'Play' : KINDS[find.kind].label;
    if (find.phase === 'choose') {
      panel.innerHTML = `
        <p class="tour-group">Choose a match</p>
        <button class="solo-mode" type="button" data-kind="1v1">
          <span class="solo-mode-badge" aria-hidden="true">1v1</span>
          <span class="solo-mode-text"><b>1v1</b><small>You against one of the crew · best of 3</small></span>
        </button>
        <button class="solo-mode is-tour" type="button" data-kind="tournament">
          <span class="solo-mode-badge" aria-hidden="true">🏆</span>
          <span class="solo-mode-text"><b>Tournament</b><small>You and 5 of the crew · 6 golfers · best of 3</small></span>
        </button>
        <p class="tour-note solo-note">Opponents are picked at random, from Rookie ${stars('rookie')} to Legend ${stars('legend')}. Three surprise cities, random wind: win 2 holes to take it, level after 3 goes to fewest strokes.</p>`;
    } else if (find.phase === 'searching') {
      panel.innerHTML = `
        <div class="solo-search" role="status">
          <div class="solo-radar" aria-hidden="true"><i></i><i></i><i></i><span>⛳</span></div>
          <h3>Finding ${find.kind === '1v1' ? 'an opponent' : 'a field'}…</h3>
          <p>${KINDS[find.kind].label} · best of 3</p>
          <p class="solo-timer">0:00</p>
          <button class="text-btn" type="button" data-solo="cancel">Cancel</button>
        </div>`;
    } else {
      const me = { name: myName(), look: getLook() };
      const body = find.kind === '1v1'
        ? `<div class="solo-vs">
            ${vsCard(me, null)}
            <span class="solo-vs-mark" aria-hidden="true">VS</span>
            ${vsCard(find.bots[0], find.bots[0].skill)}
          </div>`
        : `<ul class="solo-field">
            <li>${face(me.look)}<b>${esc(me.name)}${me.name === 'You' ? '' : ' <small>(you)</small>'}</b></li>
            ${find.bots.map((b) => `<li>${face(b.look)}<b>${esc(b.name)}</b><span>${esc(SKILLS[b.skill].label)} ${stars(b.skill)}</span></li>`).join('')}
          </ul>`;
      panel.innerHTML = `
        <div class="solo-found" role="status">
          <p class="solo-found-kicker">Match found!</p>
          ${body}
          <button class="primary-btn" type="button" data-solo="go">Let's play</button>
          <div class="solo-bar" aria-hidden="true"><i style="animation-duration:${FOUND_TIME}ms"></i></div>
        </div>`;
    }
  }

  const vsCard = (p, skill) => `
    <div class="solo-vs-card${skill ? '' : ' is-me'}">
      ${face(p.look)}
      <b>${esc(p.name)}</b>
      <span>${skill ? `${esc(SKILLS[skill].label)} ${stars(skill)}` : 'Your golfer'}</span>
    </div>`;

  // ----- the match cards -----
  view.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]')?.dataset.action;
    if (a === 'teeoff') solo.teeOff();
    else if (a === 'watch') solo.watchFirst();
    else if (a === 'skip') solo.skip();
    else if (a === 'next') solo.next();
    else if (a === 'rematch') solo.rematch();
    else if (a === 'again') { solo.quit(); find = { phase: 'choose' }; session.set({ screen: 'solo', mode: 'tour' }); renderFind(); }
    else if (a === 'home') { solo.quit(); session.set({ screen: 'home', mode: 'tour' }); }
  });

  let lastHtml = '';
  session.subscribe((s) => {
    screen.hidden = s.screen !== 'solo';
    const o = s.solo;
    const waitingOn = o && (o.stage === 'waiting' || o.stage === 'watching');
    const show = s.screen === 'play' && s.mode === 'solo' && o && o.stage !== 'playing' && !(waitingOn && s.watching);
    overlay.hidden = !show;
    if (!show) { lastHtml = ''; return; }
    const html = VIEWS[o.stage]?.(o, s) ?? '';
    if (html !== lastHtml) {
      lastHtml = html;
      view.innerHTML = html;
    }
  });
}

// ---------- card views ----------
const hole = (o) => o.match.holes[o.match.holeNo];
const holeLabel = (o) => (hole(o).playoff ? 'Sudden death' : `Hole ${o.match.holeNo + 1} of ${REGULATION_HOLES}`);
const name = (o, p) => `${esc(o.players[p].name)}${o.players[p].me && o.players[p].name !== 'You' ? ' <small>(you)</small>' : ''}`;

function courseBox(h) {
  const spec = TOUR_SPECS[h.course];
  const ground = spec.pitch && spec.pitch !== 'grass' ? ` · ${PITCHES[spec.pitch].label}` : '';
  return `<div class="match-course"><p class="match-city">${esc(spec.city)}</p><p class="match-course-sub">${esc(spec.name)} · Par ${spec.par} · ${spec.yards} yd${ground}</p><p class="match-wind">Wind: ${windText(h)}</p></div>`;
}

function winsLine(o) {
  return `<p class="match-standing">${o.players.map((p, i) => `<span><b>${esc(p.name)}</b> ${o.match.wins[i]}</span>`).join('')}</p>`;
}

function playerList(o) {
  const h = hole(o);
  return `<ul class="live-list">${h.players.map((p) => {
    const pl = o.players[p];
    return `<li class="live-row"><span class="live-name">${name(o, p)}</span><span class="live-status">${pl.me ? '' : `${stars(pl.skill)}`}</span></li>`;
  }).join('')}</ul>`;
}

function progressList(o) {
  const h = hole(o);
  return `<ul class="live-list">${h.players.map((p) => {
    const done = h.strokes[p] !== undefined;
    const pr = o.progress[p];
    let status;
    if (done) status = `<b>${h.strokes[p]}</b> <small>${esc(h.titles[p] || '')}</small>`;
    else if (pr?.strokes) status = `<span class="live-dots">${pr.strokes} so far<i>.</i><i>.</i><i>.</i></span>`;
    else status = '<span class="live-dots">on the tee<i>.</i><i>.</i><i>.</i></span>';
    return `<li class="live-row${done ? ' is-done' : ''}"><span class="live-name">${name(o, p)}</span><span class="live-status">${status}</span></li>`;
  }).join('')}</ul>`;
}

// Final order: champion first, then most holes won, then fewest strokes.
function standingsOrder(o) {
  const m = o.match;
  const reg = regulationStrokes(m);
  return o.players.map((_, i) => i).sort((a, b) => (b === m.champion) - (a === m.champion) || m.wins[b] - m.wins[a] || reg[a] - reg[b]);
}
const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;

const VIEWS = {
  intro(o) {
    const h = hole(o);
    return `
      <p class="result-kicker">${holeLabel(o)} · ${o.kind === '1v1' ? '1v1' : 'Tournament'}</p>
      ${courseBox(h)}
      ${o.match.holeNo > 0 ? `<p class="match-label">Holes won</p>${winsLine(o)}` : ''}
      <p class="match-label">Everyone plays at once</p>
      ${playerList(o)}
      <button class="primary-btn" type="button" data-action="teeoff">Tee off</button>
      <button class="text-btn" type="button" data-action="home">Quit match</button>`;
  },

  watchingIntro(o) {
    const h = hole(o);
    return `
      <p class="result-kicker">Sudden death · ${esc(TOUR_SPECS[h.course].city)}</p>
      <h2 class="match-name">You're out</h2>
      <p class="result-line">${h.players.map((p) => esc(o.players[p].name)).join(' vs ')} play off for the title.</p>
      ${courseBox(h)}
      <button class="primary-btn" type="button" data-action="teeoff">Watch them play</button>
      <button class="text-btn" type="button" data-action="home">Quit match</button>`;
  },

  waiting(o) {
    const h = hole(o);
    const meIn = h.players.includes(0);
    const mine = h.strokes[0];
    const head = meIn
      ? `<h2 class="result-title">${esc(h.titles[0] || 'Done')}</h2><p class="result-line">${mine} ${mine === 1 ? 'stroke' : 'strokes'} · waiting for the others</p>`
      : `<h2 class="match-name">Sudden death</h2>`;
    return `
      <p class="result-kicker">${holeLabel(o)} · ${esc(TOUR_SPECS[h.course].city)}</p>
      ${head}
      ${progressList(o)}
      <button class="primary-btn" type="button" data-action="watch">Watch them play</button>
      <button class="secondary-btn" type="button" data-action="skip">Skip to the result</button>`;
  },

  holeResult(o) {
    const m = o.match;
    const h = hole(o);
    const best = Math.min(...h.players.map((p) => h.strokes[p]));
    const title = h.winner !== null ? (o.players[h.winner].me ? 'You win the hole!' : `${esc(o.players[h.winner].name)} wins the hole!`) : 'Halved!';
    const rows = [...h.players].sort((a, b) => h.strokes[a] - h.strokes[b]).map((p) => `
      <tr class="${h.strokes[p] === best ? 'is-best' : ''}">
        <th scope="row">${name(o, p)}</th>
        <td>${h.strokes[p]}${h.titles[p] ? `<small class="match-title">${esc(h.titles[p])}</small>` : ''}</td>
        <td>${m.wins[p]}</td>
      </tr>`).join('');
    let btn = 'Next hole';
    if (m.decided) btn = 'See the result';
    else if (m.holes[m.holeNo + 1]?.playoff) btn = 'Sudden death!';
    return `
      <p class="result-kicker">${holeLabel(o)} · ${esc(TOUR_SPECS[h.course].city)}</p>
      <h2 class="match-name">${title}</h2>
      ${h.winner === null ? '<p class="result-line">A tie for the best score: nobody takes the hole.</p>' : ''}
      <table class="match-table">
        <thead><tr><th scope="col">Player</th><th scope="col">Strokes</th><th scope="col">Holes won</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${!h.playoff ? tiebreakLine(m) : ''}
      <button class="primary-btn" type="button" data-action="next">${btn}</button>`;
  },

  final(o) {
    const m = o.match;
    const reg = regulationStrokes(m);
    const order = standingsOrder(o);
    const place = order.indexOf(0) + 1;
    const iWon = m.champion === 0;
    const played = m.holes.slice(0, m.holeNo + 1);
    const head = played.map((h, i) => `<th scope="col">${h.playoff ? 'SD' : i + 1}</th>`).join('');
    const rows = order.map((p, i) => `
      <tr class="${p === m.champion ? 'is-best' : ''}${o.players[p].me ? ' is-me' : ''}">
        <th scope="row">${p === m.champion ? '🏆' : `${i + 1}.`} ${name(o, p)}</th>
        ${played.map((h) => `<td class="${h.winner === p ? 'is-win' : ''}">${h.strokes[p] ?? '–'}</td>`).join('')}
        <td><b>${m.wins[p]}</b></td>
        <td>${reg[p]}</td>
      </tr>`).join('');
    const champ = o.players[m.champion];
    const sub = o.kind === '1v1'
      ? (iWon ? `You beat ${esc(o.players[1].name)} (${esc(SKILLS[o.players[1].skill].label)})` : `${esc(champ.name)} (${esc(SKILLS[champ.skill].label)}) takes it`)
      : `You finished ${ordinal(place)} of ${o.players.length}`;
    return `
      <p class="result-kicker">${o.kind === '1v1' ? '1v1' : 'Tournament'} over</p>
      <div class="match-trophy" aria-hidden="true">${iWon ? '🏆' : place <= 3 && o.kind !== '1v1' ? ['🥇', '🥈', '🥉'][place - 1] : '⛳'}</div>
      <h2 class="match-name">${iWon ? 'You win!' : `${esc(champ.name)} wins!`}</h2>
      <p class="result-line">${sub}${m.wonOnStrokes ? ' · won on fewer strokes' : ''}</p>
      <table class="match-table match-card-table">
        <thead><tr><th scope="col">Player</th>${head}<th scope="col">Won</th><th scope="col" title="Total strokes over the three holes">Strokes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <button class="primary-btn" type="button" data-action="rematch">Rematch</button>
      <button class="secondary-btn" type="button" data-action="again">New opponents</button>
      <button class="text-btn" type="button" data-action="home">Back to home</button>`;
  },
};
VIEWS.watching = VIEWS.waiting;
