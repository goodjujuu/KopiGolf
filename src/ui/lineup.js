import * as THREE from 'three';
import { buildAvatar } from '../avatar/avatar.js';
import { sanitizeLook } from '../avatar/looks.js';

// "Here are your players": before a match, everyone's golfer stands in a line for a few
// seconds, idling, with their name on a sash-style banner across the chest. Tap to skip.
// Shown whenever session.state.lineup = { players: [{ name, look }], title, sub } is set.

const DURATION = 5;
const SPACING = 0.78;

export function createLineup(session) {
  const root = document.getElementById('lineup');
  const canvas = document.getElementById('lineup-canvas');
  const banners = document.getElementById('lineup-banners');
  const title = document.getElementById('lineup-title');
  const sub = document.getElementById('lineup-sub');
  const bar = document.getElementById('lineup-bar');

  let renderer = null;
  let scene;
  let camera;
  let rigs = [];
  let raf = 0;
  let clock = null;
  let showing = null;

  function setup() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5d8f3a, 1.6));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
    key.position.set(1.5, 3, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 2, bottom: -1 });
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfe6ff, 0.8);
    rim.position.set(-2, 1.5, -2);
    scene.add(rim);
    const turf = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.08, 48), new THREE.MeshLambertMaterial({ color: 0x86c442 }));
    turf.position.y = -0.04;
    turf.scale.z = 0.45;
    turf.receiveShadow = true;
    scene.add(turf);
  }

  function show(lineup) {
    if (!renderer) setup();
    for (const r of rigs) scene.remove(r.group);
    rigs = [];
    banners.innerHTML = '';
    const n = lineup.players.length;
    lineup.players.forEach((p, i) => {
      const look = sanitizeLook(p.look);
      const avatar = buildAvatar(look);
      const group = new THREE.Group();
      group.add(avatar.group);
      group.position.x = (i - (n - 1) / 2) * SPACING;
      group.rotation.y = (i - (n - 1) / 2) * -0.12; // turned slightly in toward the middle
      scene.add(group);
      const banner = document.createElement('div');
      banner.className = 'lineup-banner';
      banner.style.setProperty('--sash', look.topAccent === look.topColour ? '#f2c84b' : look.topAccent);
      banner.textContent = p.name;
      banners.append(banner);
      // Chest height: roughly two thirds of the way up the body.
      rigs.push({ group, avatar, banner, chest: avatar.height * 0.56, phase: i * 1.7 });
    });
    title.textContent = lineup.title ?? 'Match day';
    sub.textContent = lineup.sub ?? `${n} golfers`;
    // Frame everyone: wider lines pull the camera back.
    const width = Math.max(1.6, n * SPACING + 0.6);
    resize();
    const dist = width / 2 / Math.tan((camera.fov * Math.PI) / 360) / Math.min(1, camera.aspect) * 0.95 + 1.2;
    camera.position.set(0, 1.05, dist);
    camera.lookAt(0, 0.62, 0);
    clock = new THREE.Clock();
    cancelAnimationFrame(raf);
    frame();
  }

  function resize() {
    const r = root.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const v = new THREE.Vector3();
  function frame() {
    raf = requestAnimationFrame(frame);
    try { draw(); } catch (e) { console.warn('Line-up stopped', e); close(); }
  }

  function draw() {
    const t = clock.getElapsedTime();
    const rect = canvas.getBoundingClientRect();
    for (const r of rigs) {
      // Idle: a gentle breathing bob, a little sway and the odd look around.
      r.group.position.y = Math.sin(t * 2.2 + r.phase) * 0.012;
      r.avatar.group.rotation.y = Math.sin(t * 0.9 + r.phase) * 0.18;
      r.avatar.group.rotation.z = Math.sin(t * 1.3 + r.phase) * 0.02;
      v.set(0, r.chest, 0);
      r.group.localToWorld(v);
      v.project(camera);
      r.banner.style.transform = `translate(${((v.x + 1) / 2) * rect.width}px, ${((1 - v.y) / 2) * rect.height}px) translate(-50%, -50%) rotate(-8deg)`;
    }
    bar.style.transform = `scaleX(${Math.min(1, t / DURATION)})`;
    renderer.render(scene, camera);
    if (t >= DURATION) close();
  }

  function close() {
    cancelAnimationFrame(raf);
    if (session.state.lineup) session.set({ lineup: null });
  }

  root.addEventListener('click', close);

  session.subscribe((s) => {
    const want = s.lineup ?? null;
    if (want === showing) return;
    showing = want;
    root.hidden = !want;
    if (!want) { cancelAnimationFrame(raf); return; }
    try {
      show(want);
    } catch (e) {
      // Never let the line-up hold a match up: skip it if it can't be drawn.
      console.warn('Line-up skipped', e);
      showing = null;
      root.hidden = true;
      queueMicrotask(() => session.set({ lineup: null }));
    }
  });
}
