// Your player profile on this device: just a username for now (your look lives with the Locker).
// The first time someone opens KopiGolf there's no profile, so they're sent to the Locker to
// make their golfer and pick a name. The name is then used everywhere a name is asked for:
// online rooms, solo matches and player 1 in pass-the-phone.

const PROFILE_KEY = 'kopigolf.profile';
const ONLINE_NAME_KEY = 'kopigolf.onlineName';
const PLAYERS_KEY = 'kopigolf.players';
export const NAME_MAX = 14;
export const NAME_MIN = 2;

export const cleanName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
export const validName = (name) => cleanName(name).length >= NAME_MIN;

export function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    if (p && validName(p.name)) return { name: cleanName(p.name), createdAt: p.createdAt ?? Date.now() };
  } catch { /* storage blocked or bad data */ }
  return null;
}

// A name to start the setup box with: whatever this device used before, if anything.
export function suggestedName() {
  try {
    const online = localStorage.getItem(ONLINE_NAME_KEY);
    if (online) return cleanName(online);
    const first = JSON.parse(localStorage.getItem(PLAYERS_KEY) || '[]')[0];
    if (first && !/^Player \d$/.test(first)) return cleanName(first);
  } catch { /* ignore */ }
  return '';
}

export function saveProfile(name, previous = null) {
  const profile = { name: cleanName(name), createdAt: previous?.createdAt ?? Date.now() };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(ONLINE_NAME_KEY, profile.name);
    // Player 1 in pass-the-phone is you (unless you've typed someone else in there).
    const players = JSON.parse(localStorage.getItem(PLAYERS_KEY) || 'null') || ['Player 1', 'Player 2'];
    if (!players[0] || /^Player \d$/.test(players[0]) || players[0] === previous?.name) {
      players[0] = profile.name;
      localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
    }
  } catch { /* storage blocked: the profile still lasts for this visit */ }
  return profile;
}
