import { TOUR_SPECS } from '../courses/tour.js';
import { BIOMES } from '../courses/biomes.js';
import { saveSettings } from './home.js';
import { PITCHES } from '../courses/pitches.js';

// Course picker inside "Play with friends": choose conditions, then tap a city to play its hole.
// (Invites and KopiBucks wagers will slot in here before tee-off.)

const GROUPS = [
  { from: 0, to: 18, label: 'Front 18 · Asia, Oceania & the Middle East' },
  { from: 18, to: 36, label: 'Back 18 · Europe, the Americas & Africa' },
];

export function createTourScreen(session, { onPlay }) {
  const root = document.getElementById('tour');
  const list = document.getElementById('tour-list');
  document.getElementById('btn-tour-close').addEventListener('click', () => session.set({ screen: 'home' }));

  const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
  list.innerHTML = GROUPS.map((g) => {
    const cards = TOUR_SPECS.slice(g.from, g.to).map((spec, k) => {
      const i = g.from + k;
      const biome = BIOMES[spec.biome];
      const pitch = PITCHES[spec.pitch] ?? PITCHES.grass;
      const ground = spec.pitch && spec.pitch !== 'grass' ? pitch.label : biome.label;
      const swatch = pitch.fairway.color ?? biome.fairway;
      return `<button type="button" class="tour-card" data-index="${i}" style="--biome:${hex(swatch)}" aria-label="Hole ${i + 1}, ${spec.city}, ${spec.name}, par ${spec.par}, ${spec.yards} yards, ${ground}">
        <span class="tour-num" aria-hidden="true">${i + 1}</span>
        <span class="tour-text" aria-hidden="true"><span class="tour-city">${spec.city}</span><span class="tour-sub">${spec.name} · ${spec.country}</span></span>
        <span class="tour-meta" aria-hidden="true"><span>Par ${spec.par} · ${spec.yards} yd</span><span class="tour-biome">${ground}</span></span>
      </button>`;
    }).join('');
    return `<p class="tour-group">${g.label}</p>${cards}`;
  }).join('');

  list.addEventListener('click', (e) => {
    const card = e.target.closest('.tour-card');
    if (card) onPlay(Number(card.dataset.index));
  });

  root.addEventListener('change', () => {
    const settings = {
      timeOfDay: root.querySelector('input[name="tourTimeOfDay"]:checked')?.value ?? 'day',
      wind: root.querySelector('input[name="tourWind"]:checked')?.value ?? 'calm',
    };
    session.set({ settings });
    saveSettings(settings);
  });

  session.subscribe((s) => {
    root.hidden = s.screen !== 'tour';
    const tod = root.querySelector(`input[name="tourTimeOfDay"][value="${s.settings.timeOfDay}"]`);
    const wind = root.querySelector(`input[name="tourWind"][value="${s.settings.wind}"]`);
    if (tod) tod.checked = true;
    if (wind) wind.checked = true;
  });
}
