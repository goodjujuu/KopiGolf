import * as THREE from 'three';
import { LAYOUT, SURFACE, REDUCED_MOTION } from './config.js';
import { holeAimYaw } from './courses/catalog.js';
import { buildWorld } from './world/builder.js';
import { createBall, BALL_RADIUS } from './entities/ball.js';
import { createClub } from './entities/club.js';

// Owns the renderer, camera, lights and the loop. The HUD never touches 3D objects;
// it calls the methods returned here.

const DEG = Math.PI / 180;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export function createGameScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LAYOUT.maxPixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 800);
  camera.rotation.order = 'YXZ';

  // Lights: soft sky/ground fill plus a low sun for the long club shadow.
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5d8f3a, 1.4);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.01;
  scene.add(hemi, sun, sun.target);

  const sky = makeSkyDome();
  scene.add(sky.mesh);

  const ball = createBall();
  const club = createClub();
  scene.add(ball.mesh, club.root);

  let world = null;
  let hole = null;
  let aimYaw = 0;
  const ballPos = new THREE.Vector3();
  const shotPose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const lookPose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  let lookAhead = false;
  let snapCamera = true;
  let viewW = 1;
  let viewH = 1;

  function loadHole(next) {
    hole = next;
    if (world) { scene.remove(world.group); world.dispose(); }
    world = buildWorld(hole);
    scene.add(world.group);

    sky.setColors(world.theme.skyTop, world.theme.skyHorizon);
    scene.background = new THREE.Color(world.theme.skyHorizon);
    scene.fog = new THREE.Fog(world.theme.skyHorizon, 80, 340);

    aimYaw = holeAimYaw(hole);
    ballPos.set(hole.tee[0], SURFACE.fairway + BALL_RADIUS, hole.tee[2]);
    ball.mesh.position.copy(ballPos);
    club.address(ballPos, aimYaw);

    // Sun low and ahead-right of the player, so the shadow falls back toward the camera.
    const sunOffset = new THREE.Vector3(5, 6, -7).applyAxisAngle(WORLD_UP, aimYaw);
    sun.position.copy(ballPos).add(sunOffset);
    sun.target.position.copy(ballPos);

    lookAhead = false;
    snapCamera = true;
    computePoses();
  }

  // Lock the horizontal field of view, then derive the vertical one from this screen's shape.
  function resize(width, height) {
    viewW = Math.max(1, width);
    viewH = Math.max(1, height);
    renderer.setSize(viewW, viewH, false);
    camera.aspect = viewW / viewH;
    const hFov = LAYOUT.horizontalFovDeg * DEG;
    const vFov = Math.max(2 * Math.atan(Math.tan(hFov / 2) / camera.aspect), LAYOUT.minVerticalFovDeg * DEG);
    camera.fov = vFov / DEG;
    camera.updateProjectionMatrix();
    computePoses();
    snapCamera = true;
  }

  // Solve the camera pitch so the ball lands at LAYOUT.ballScreenY on any aspect ratio.
  function computePoses() {
    if (!hole) return;
    const h = LAYOUT.cameraHeight;
    const back = LAYOUT.cameraBack;
    const vHalf = (camera.fov * DEG) / 2;
    const fromCentre = (LAYOUT.ballScreenY - 0.5) * 2;         // 0 = centre, 1 = bottom edge
    const belowAxis = Math.atan(fromCentre * Math.tan(vHalf)); // ball's angle below the view axis
    const toBall = Math.atan2(h, back);                         // angle from camera down to the ball
    const pitch = -(toBall - belowAxis);

    shotPose.pos.set(ballPos.x + Math.sin(aimYaw) * back, ballPos.y + h, ballPos.z + Math.cos(aimYaw) * back);
    shotPose.quat.setFromEuler(new THREE.Euler(pitch, aimYaw, 0, 'YXZ'));

    const pin = new THREE.Vector3(hole.pin[0], 0.5, hole.pin[2]);
    lookPose.pos.copy(ballPos).lerp(pin, LAYOUT.lookAheadFraction);
    lookPose.pos.y = LAYOUT.lookAheadHeight;
    const m = new THREE.Matrix4().lookAt(lookPose.pos, pin, WORLD_UP);
    lookPose.quat.setFromRotationMatrix(m);
  }

  function setLookAhead(on) { lookAhead = on; }

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let rafId = 0;
  let paused = false;
  let onFirstFrame = null;

  function frame() {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;

    const target = lookAhead ? lookPose : shotPose;
    if (snapCamera || REDUCED_MOTION) {
      camera.position.copy(target.pos);
      camera.quaternion.copy(target.quat);
      snapCamera = false;
    } else {
      const k = 1 - Math.exp(-dt * 4.5);
      camera.position.lerp(target.pos, k);
      camera.quaternion.slerp(target.quat, k);
    }
    sky.mesh.position.copy(camera.position);

    world?.update(t);
    ball.update(t);
    club.update(t);

    renderer.render(scene, camera);
    if (onFirstFrame) { onFirstFrame(); onFirstFrame = null; }
  }

  return {
    loadHole,
    resize,
    setLookAhead,
    start(firstFrameCallback) {
      onFirstFrame = firstFrameCallback;
      clock.start();
      frame();
    },
    // Stop drawing while the tab is hidden to save battery.
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      if (paused) cancelAnimationFrame(rafId);
      else { clock.getDelta(); frame(); }
    },
  };
}

// A big inverted sphere with a vertical gradient. It follows the camera and ignores fog, so the
// fogged sea melts into the horizon colour without a visible seam.
function makeSkyDome() {
  const radius = 600;
  const geo = new THREE.SphereGeometry(radius, 32, 16);
  const colors = new Float32Array(geo.attributes.position.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;

  const top = new THREE.Color();
  const horizon = new THREE.Color();
  const c = new THREE.Color();
  return {
    mesh,
    setColors(topHex, horizonHex) {
      top.setHex(topHex);
      horizon.setHex(horizonHex);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const t = THREE.MathUtils.clamp((pos.getY(i) / radius) * 1.8, 0, 1);
        c.copy(horizon).lerp(top, Math.pow(t, 0.7));
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      geo.attributes.color.needsUpdate = true;
    },
  };
}
