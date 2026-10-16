import * as THREE from 'three';
import { LOCKER_SECTIONS, HEAD_FINISHES, GOLFER_PRESETS, loadLook, saveLook, sanitizeLook, randomLook, matchingPreset } from '../avatar/looks.js';
import { buildAvatar } from '../avatar/avatar.js';

// The Locker: customise your golfer and clubs, with a live 3D preview you can spin.
// Changes save on this device straight away and are sent to the game through onChange(look).

export function createLocker(session, { onChange }) {
  const root = document.getElementById('locker');
  const canvas = document.getElementById('locker-canvas');
  const tabs = root.querySelectorAll('.locker-tab');
  const chipsEl = document.getElementById('locker-chips');
  const controlsEl = document.getElementById('locker-controls');
  const closeBtn = document.getElementById('btn-locker-close');
  const randomBtn = document.getElementById('btn-locker-random');
  const resetBtn = document.getElementById('btn-locker-reset');

  let look = loadLook();
  let tab = 'golfer';
  let sectionId = LOCKER_SECTIONS.golfer[0].id;
  const preview = createPreview(canvas);

  const section = () => LOCKER_SECTIONS[tab].find((s) => s.id === sectionId) ?? LOCKER_SECTIONS[tab][0];

  function setLook(next) {
    look = sanitizeLook(next);
    saveLook(look);
    preview.setLook(look);
    renderControls();
    onChange(look);
  }

  // ----- tabs and section chips -----
  tabs.forEach((btn) => btn.addEventListener('click', () => {
    tab = btn.dataset.tab;
    sectionId = LOCKER_SECTIONS[tab][0].id;
    renderAll();
  }));

  chipsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-section]');
    if (!chip) return;
    sectionId = chip.dataset.section;
    renderAll();
  });

  controlsEl.addEventListener('click', (e) => {
    const preset = e.target.closest('[data-preset]');
    if (preset) {
      const p = GOLFER_PRESETS.find((x) => x.id === preset.dataset.preset);
      if (p) setLook({ ...look, ...p.look }); // golfer only: clubs and ball stay yours
      return;
    }
    const btn = e.target.closest('[data-key]');
    if (!btn) return;
    setLook({ ...look, [btn.dataset.key]: btn.dataset.value });
  });

  randomBtn.addEventListener('click', () => setLook(randomLook()));
  resetBtn.addEventListener('click', () => setLook({}));
  closeBtn.addEventListener('click', () => session.set({ screen: 'home' }));

  function renderAll() {
    tabs.forEach((btn) => btn.setAttribute('aria-selected', String(btn.dataset.tab === tab)));
    chipsEl.innerHTML = LOCKER_SECTIONS[tab]
      .map((s) => `<button type="button" class="locker-chip" data-section="${s.id}" aria-pressed="${s.id === section().id}">${s.label}</button>`)
      .join('');
    renderControls();
    preview.frame(tab === 'clubs' ? 'club' : section().zoom ?? 'body');
  }

  function renderControls() {
    controlsEl.innerHTML = section().controls.map((control) => {
      if (control.type === 'presets') {
        const active = matchingPreset(look);
        const cards = GOLFER_PRESETS.map((p) => `
          <button type="button" class="preset-card" data-preset="${p.id}" aria-pressed="${p.id === active}">
            <span class="preset-face" aria-hidden="true" style="--skin:${p.look.skin};--hair:${p.look.hairColour};--top:${p.look.topColour}"><i></i></span>
            <span class="preset-text"><b>${p.name}</b><small>${p.blurb}</small></span>
          </button>`).join('');
        return `<div class="locker-control"><p class="locker-label">The crew · tap to wear</p><div class="presets">${cards}</div></div>`;
      }
      const current = look[control.key];
      if (control.type === 'colour') {
        const swatches = control.palette.map((p) =>
          `<button type="button" class="swatch" style="--swatch:${p.hex}" data-key="${control.key}" data-value="${p.hex}" aria-pressed="${p.hex === current}" aria-label="${p.name}" title="${p.name}"></button>`
        ).join('');
        return `<div class="locker-control"><p class="locker-label">${control.label}</p><div class="swatches">${swatches}</div></div>`;
      }
      const tiles = control.options.map(([id, label]) => {
        const swatch = control.swatches ? `<span class="tile-swatch" style="--swatch:${HEAD_FINISHES[id].hex}"></span>` : '';
        return `<button type="button" class="tile" data-key="${control.key}" data-value="${id}" aria-pressed="${id === current}">${swatch}${label}</button>`;
      }).join('');
      return `<div class="locker-control"><p class="locker-label">${control.label}</p><div class="tiles">${tiles}</div></div>`;
    }).join('');
  }

  session.subscribe((s) => {
    const open = s.screen === 'locker';
    if (open === !root.hidden) return;
    root.hidden = !open;
    if (open) {
      renderAll();
      preview.setLook(look);
      preview.start();
    } else {
      preview.stop();
    }
  });

  onChange(look); // apply the saved look to the game at start-up
  return { get look() { return look; } };
}

// ---------- 3D preview: the golfer on a little round of turf, drag to spin ----------
function createPreview(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5d8f3a, 1.6));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
  key.position.set(1.5, 3, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1, right: 1, top: 1.5, bottom: -0.5 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe6ff, 0.8);
  rim.position.set(-2, 1.5, -2);
  scene.add(rim);

  const podium = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.06, 40), new THREE.MeshLambertMaterial({ color: 0x86c442 }));
  podium.position.y = -0.03;
  podium.receiveShadow = true;
  scene.add(podium);

  const turntable = new THREE.Group();
  scene.add(turntable);
  let avatar = null;
  let headY = 1;
  let height = 1.3;
  let spin = 0.35;
  let spinVelocity = 0;
  let framing = 'body';
  const camPos = new THREE.Vector3(0, 0.8, 4);
  const camTarget = new THREE.Vector3(0, 0.6, 0);
  const lookAt = new THREE.Vector3(0, 0.6, 0);

  function setLook(look) {
    if (avatar) {
      turntable.remove(avatar.group);
      avatar.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    }
    avatar = buildAvatar(look);
    avatar.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    turntable.add(avatar.group);
    headY = avatar.headCentre.y;
    height = avatar.height;
    frame(framing);
  }

  function frame(kind) {
    framing = kind;
    if (kind === 'head') {
      camTarget.set(0, headY, 0);
      camPos.set(0, headY + 0.05, 1.6);
    } else if (kind === 'club') {
      camTarget.set(0.15, height * 0.4, 0);
      camPos.set(0.4, height * 0.55, 3.1);
    } else {
      camTarget.set(0, height * 0.5, 0);
      camPos.set(0, height * 0.6, 3.6);
    }
  }

  // Drag to spin; let go and it keeps turning gently.
  let dragging = false;
  let lastX = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; spinVelocity = 0; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    spin += dx * 0.012;
    spinVelocity = dx * 0.012 * 60;
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  let raf = 0;
  let last = 0;
  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    }
    if (!dragging) {
      spinVelocity *= Math.exp(-dt * 3);
      spin += (spinVelocity + 0.25) * dt;
    }
    turntable.rotation.y = spin;
    const k = 1 - Math.exp(-dt * 6);
    camera.position.lerp(camPos, k);
    lookAt.lerp(camTarget, k);
    camera.lookAt(lookAt);
    renderer.render(scene, camera);
  }

  return {
    setLook,
    frame,
    start() { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop); },
    stop() { cancelAnimationFrame(raf); },
  };
}
