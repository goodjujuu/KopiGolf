import { createPreview } from './locker.js';

// Your golfer on the home screen, under the KopiGolf title: slowly turning on its little round
// of turf, with your name underneath. Tap it to open the Locker.

export function createHomeMe(session) {
  const btn = document.getElementById('btn-home-me');
  const canvas = document.getElementById('home-me-canvas');
  const nameEl = document.getElementById('home-me-name');
  let preview = null;
  let look = null;
  let running = false;

  btn.addEventListener('click', () => session.set({ screen: 'locker' }));

  function sync(s) {
    const show = s.screen === 'home' && !!s.profile && !s.setup;
    btn.hidden = !s.profile;
    nameEl.textContent = s.profile?.name ?? '';
    if (show && !running) {
      try {
        if (!preview) { preview = createPreview(canvas); if (look) preview.setLook(look); }
        preview.start();
        running = true;
      } catch (e) {
        console.warn('Home golfer preview unavailable', e); // the name still shows
      }
    } else if (!show && running) {
      preview?.stop();
      running = false;
    }
  }
  session.subscribe(sync);

  return {
    setLook(next) {
      look = next;
      preview?.setLook(next);
    },
  };
}
