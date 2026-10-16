import * as THREE from 'three';
import { LAYOUT, DEG, REDUCED_MOTION } from './config.js';
import { buildWorld } from './world/builder.js';
import { createBall, BALL_RADIUS } from './entities/ball.js';
import { createClub } from './entities/club.js';

// Owns the renderer, camera, lights and the frame loop. It draws whatever the game controller
// tells it to; it has no game rules of its own.

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const AIM_DOTS = 16;
const FOLLOW_BACK = 6;
const FOLLOW_UP = 2.6;
const CLUB_HIDE_DELAY = 0.7;

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
  const aimLine = makeAimLine();
  scene.add(ball.mesh, club.root, aimLine.mesh);

  let world = null;
  let hole = null;
  let aimYaw = 0;
  let aimLength = 18;
  let groundY = 0;
  const lie = new THREE.Vector3();          // where the ball sits for the current shot
  const flightDir = new THREE.Vector3();
  const sunOffset = new THREE.Vector3();
  const shotPose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const lookPose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const followPose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const tmpMatrix = new THREE.Matrix4();
  let cameraMode = 'shot'; // 'shot' | 'follow'
  let lookAhead = false;
  let snapCamera = true;
  let clubHideTimer = 0;

  function loadHole(next) {
    hole = next;
    if (world) { scene.remove(world.group); world.dispose(); }
    world = buildWorld(hole);
    scene.add(world.group);
    sky.setColors(world.theme.skyTop, world.theme.skyHorizon);
    scene.background = new THREE.Color(world.theme.skyHorizon);
    scene.fog = new THREE.Fog(world.theme.skyHorizon, 80, 340);
    snapCamera = true;
  }

  // Set up for the next shot: ball at its lie, club addressing it, camera behind.
  function placeAtLie(p, yaw, length) {
    lie.set(p.x, p.y, p.z);
    groundY = p.y - BALL_RADIUS;
    ball.mesh.position.copy(lie);
    ball.mesh.visible = true;
    ball.setIdle(true);
    club.root.visible = true;
    club.release();
    aimLength = length;
    cameraMode = 'shot';
    lookAhead = false;
    setAim(yaw);
    aimLine.mesh.visible = true;
  }

  function setAim(yaw) {
    aimYaw = yaw;
    club.address(lie, aimYaw, groundY);
    aimLine.place(lie, aimYaw, aimLength, groundY);
    computePoses();
  }

  function setAimLength(length) {
    aimLength = length;
    aimLine.place(lie, aimYaw, aimLength, groundY);
  }

  function beginFlight(yaw) {
    cameraMode = 'flight';
    flightDir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    aimLine.mesh.visible = false;
    ball.setIdle(false);
    clubHideTimer = CLUB_HIDE_DELAY;
    lookAhead = false;
  }

  // Lock the horizontal field of view, then derive the vertical one from this screen's shape.
  function resize(width, height) {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
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
    const fromCentre = (LAYOUT.ballScreenY - 0.5) * 2;
    const belowAxis = Math.atan(fromCentre * Math.tan(vHalf));
    const toBall = Math.atan2(h, back);
    const pitch = -(toBall - belowAxis);
    shotPose.pos.set(lie.x + Math.sin(aimYaw) * back, lie.y + h, lie.z + Math.cos(aimYaw) * back);
    shotPose.quat.setFromEuler(new THREE.Euler(pitch, aimYaw, 0, 'YXZ'));

    const pin = new THREE.Vector3(hole.pin[0], 0.5, hole.pin[2]);
    lookPose.pos.copy(lie).lerp(pin, LAYOUT.lookAheadFraction);
    lookPose.pos.y = Math.max(lookPose.pos.y, LAYOUT.lookAheadHeight);
    tmpMatrix.lookAt(lookPose.pos, pin, WORLD_UP);
    lookPose.quat.setFromRotationMatrix(tmpMatrix);
  }

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let rafId = 0;
  let paused = false;
  let onFirstFrame = null;
  let onTick = null;

  function frame() {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;

    onTick?.(dt, t); // game rules and physics run first

    // Camera
    let target;
    let rate = 4.5;
    if (cameraMode === 'flight') {
      followPose.pos.copy(ball.mesh.position).addScaledVector(flightDir, -FOLLOW_BACK);
      followPose.pos.y = Math.max(ball.mesh.position.y, groundY) + FOLLOW_UP;
      tmpMatrix.lookAt(followPose.pos, ball.mesh.position, WORLD_UP);
      followPose.quat.setFromRotationMatrix(tmpMatrix);
      target = followPose;
      rate = 3;
    } else {
      target = lookAhead ? lookPose : shotPose;
    }
    if (snapCamera || REDUCED_MOTION) {
      camera.position.copy(target.pos);
      camera.quaternion.copy(target.quat);
      snapCamera = false;
    } else {
      const k = 1 - Math.exp(-dt * rate);
      camera.position.lerp(target.pos, k);
      camera.quaternion.slerp(target.quat, k);
    }
    sky.mesh.position.copy(camera.position);

    // Keep the tight shadow box on whatever the player is watching.
    const focus = cameraMode === 'flight' ? ball.mesh.position : lie;
    sunOffset.set(5, 6, -7).applyAxisAngle(WORLD_UP, aimYaw);
    sun.position.copy(focus).add(sunOffset);
    sun.target.position.copy(focus);

    if (clubHideTimer > 0) {
      clubHideTimer -= dt;
      if (clubHideTimer <= 0) club.root.visible = false;
    }

    world?.update(t);
    ball.update(t);
    club.update(t, dt);

    renderer.render(scene, camera);
    if (onFirstFrame) { onFirstFrame(); onFirstFrame = null; }
  }

  return {
    loadHole,
    placeAtLie,
    setAim,
    setAimLength,
    setClubKind(kind) { club.setKind(kind); },
    beginFlight,
    resize,
    club,
    setLookAhead(on) { lookAhead = on; },
    setBallPosition(p) { ball.mesh.position.set(p.x, p.y, p.z); },
    setBallVisible(on) { ball.mesh.visible = on; },
    start(firstFrameCallback, tickCallback) {
      onFirstFrame = firstFrameCallback;
      onTick = tickCallback;
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

// A row of small white dots on the ground showing where the shot is aimed.
function makeAimLine() {
  const geo = new THREE.CircleGeometry(0.045, 10);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, AIM_DOTS);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  const m = new THREE.Matrix4();
  return {
    mesh,
    place(from, yaw, length, groundY) {
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      for (let i = 0; i < AIM_DOTS; i++) {
        const d = 0.6 + ((i + 1) / AIM_DOTS) * (length - 0.6);
        const s = 1 + d * 0.06; // dots grow with distance so they stay visible
        m.makeScale(s, 1, s).setPosition(from.x + fx * d, groundY + 0.012, from.z + fz * d);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
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
