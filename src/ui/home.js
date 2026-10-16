import { LIGHTING, WIND_LEVELS } from '../config.js';

// Home screen: pick Practice options (time of day, wind) and tee off.
// The chosen options are remembered on this device for next time.

const SETTINGS_KEY = 'kopigolf.practiceSettings';

export function loadSavedSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (saved && LIGHTING[saved.timeOfDay] && WIND_LEVELS[saved.wind]) return saved;
  } catch { /* storage blocked or bad data */ }
  return { timeOfDay: 'day', wind: 'calm' };
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage blocked */ }
}

export function createHome(session, { onStartPractice }) {
  const home = document.getElementById('home');
  const startBtn = document.getElementById('btn-practice');

  const read = () => ({
    timeOfDay: home.querySelector('input[name="timeOfDay"]:checked')?.value ?? 'day',
    wind: home.querySelector('input[name="wind"]:checked')?.value ?? 'calm',
  });

  // Reflect saved settings in the radio buttons.
  const { timeOfDay, wind } = session.state.settings;
  home.querySelector(`input[name="timeOfDay"][value="${timeOfDay}"]`).checked = true;
  home.querySelector(`input[name="wind"][value="${wind}"]`).checked = true;

  home.addEventListener('change', () => {
    const settings = read();
    session.set({ settings });
    saveSettings(settings);
  });

  startBtn.addEventListener('click', () => onStartPractice(read()));

  session.subscribe((s) => {
    home.hidden = s.screen !== 'home';
    // Stay in step with changes made on the Play with friends screen.
    const tod = home.querySelector(`input[name="timeOfDay"][value="${s.settings.timeOfDay}"]`);
    const wind = home.querySelector(`input[name="wind"][value="${s.settings.wind}"]`);
    if (tod) tod.checked = true;
    if (wind) wind.checked = true;
  });
}
