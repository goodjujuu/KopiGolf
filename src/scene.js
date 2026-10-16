import * as THREE from 'three';
import { LAYOUT, LIGHTING, DEG, REDUCED_MOTION } from './config.js';
import { buildWorld } from './world/builder.js';
import { createBall, BALL_RADIUS } from './entities/ball.js';
import { createClub } from './entities/club.js';
import { createGhosts } from './world/ghosts.js';
import { groundHeight } from './physics/course.js';

// Owns the renderer, camera, lights and the frame loop. It draws whatever the game controller
// tells it to; it has no game rules of its own.

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const AIM_DOTS = 16;
const ARC_DOTS = 34;
const FOLLOW_BACK = 6;
const FOLLOW_UP = 2.6;
const CLUB_HIDE_DELAY = 0.7;

export function createGameScene(canvas) {
  // Logarithmic depth keeps flat course layers from flickering across kilometre-long views.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LAYOUT.maxPixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 7000);
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
  const stars = makeStars();
  scene.add(sky.mesh, stars);

  const ball = createBall();
  const club = createClub();
  const aimLine = makeAimLine();        // ground dots, used for the putter
  const trajectory = makeTrajectory(); // dotted flight arc + landing ring, for every other club
  scene.add(ball.mesh, club.root, aimLine.mesh, trajectory.group);
  const friends = createGhosts(scene); // other players' golfers and balls (online play)

  let world = null;
  let hole = null;
  let aimYaw = 0;
  let groundY = 0;
  let lighting = LIGHTING.day;
  const lie = new THREE.Vector3();          // where the ball sits for the current shot
  const flightDir = new THREE.Vector3();
  const sunOffset = new THREE.Vector3();
  const shotPose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const lookPose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const followPose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const tmpMatrix = new THREE.Matrix4();
  let cameraMode = 'shot'; // 'shot' | 'follow'
  let lookAhead = false;
  let watchId = null; // a friend's id while the camera is watching them (online play)
  const watchPose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const watchLook = new THREE.Vector3();
  const watchDir = new THREE.Vector3();
  let snapCamera = true;
  let clubHideTimer = 0;

  function loadHole(next) {
    if (next === hole && world) { snapCamera = true; return; } // same hole again (restart, next player): keep the world
    hole = next;
    if (world) { scene.remove(world.group); world.dispose(); }
    world = buildWorld(hole);
    scene.add(world.group);
    applyLighting();
    snapCamera = true;
  }

  // Day, sunset or night: sky, fog, sun/moon, water sheen, stars.
  function setTimeOfDay(name) {
    lighting = LIGHTING[name] ?? LIGHTING.day;
    applyLighting();
  }

  function applyLighting() {
    const L = lighting;
    sky.setColors(L.skyTop, L.skyHorizon);
    scene.background = new THREE.Color(L.skyHorizon);
    const fogScale = world?.fogScale ?? { near: 1, far: 1 };
    scene.fog = new THREE.Fog(L.skyHorizon, L.fogNear * fogScale.near, L.fogFar * fogScale.far);
    hemi.color.setHex(L.hemiSky);
    hemi.groundColor.setHex(L.hemiGround);
    hemi.intensity = L.hemiIntensity;
    sun.color.setHex(L.sunColor);
    sun.intensity = L.sunIntensity;
    stars.visible = L.stars;
    ball.setGlow(L.ballGlow);
    world?.setWaterGlow(L.waterGlow);
    world?.setNightGlow(L.windowGlow);
  }

  // Set up for the next shot: ball at its lie, club addressing it, camera behind.
  function placeAtLie(p, yaw) {
    lie.set(p.x, p.y, p.z);
    groundY = p.y - BALL_RADIUS;
    ball.mesh.position.copy(lie);
    ball.mesh.visible = true;
    ball.setIdle(true);
    club.root.visible = true;
    club.release();
    cameraMode = 'shot';
    lookAhead = false;
    setAim(yaw);
  }

  function setAim(yaw) {
    aimYaw = yaw;
    club.address(lie, aimYaw, groundY);
    computePoses();
  }

  // Shot guide: { kind: 'arc', points } for a flighted shot, { kind: 'ground', length } for a putt,
  // or null to hide it.
  function setGuide(guide) {
    aimLine.mesh.visible = guide?.kind === 'ground';
    trajectory.group.visible = guide?.kind === 'arc';
    if (guide?.kind === 'ground') aimLine.place(lie, aimYaw, guide.length, groundY);
    if (guide?.kind === 'arc') trajectory.place(guide.points);
  }

  function beginFlight(yaw) {
    cameraMode = 'flight';
    flightDir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    setGuide(null);
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
    // Higher up on long holes so the whole approach fits in view.
    lookPose.pos.y = Math.max(lookPose.pos.y, LAYOUT.lookAheadHeight, lie.distanceTo(pin) * 0.09);
    tmpMatrix.lookAt(lookPose.pos, pin, WORLD_UP);
    lookPose.quat.setFromRotationMatrix(tmpMatrix);
  }

  const groundAt = (p) => (hole ? groundHeight(hole, p.x, p.z) : 0);

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
    const watching = watchId && cameraMode !== 'flight' ? friends.focus(watchId) : null;
    if (watching) {
      const b = watching.ball;
      if (watching.flying) {
        // Chase their ball like your own.
        watchPose.pos.copy(b).addScaledVector(watching.flyDir, -FOLLOW_BACK);
        watchPose.pos.y = Math.max(b.y, groundAt(b)) + FOLLOW_UP;
        watchLook.copy(b);
        rate = 5;
      } else {
        // Over their shoulder: behind the ball, looking up the hole, golfer and ball in view.
        watchDir.set(watching.pin[0] - b.x, 0, watching.pin[2] - b.z);
        if (watchDir.lengthSq() < 1e-4) watchDir.set(0, 0, -1);
        watchDir.normalize();
        const g = groundAt(b);
        watchPose.pos.set(b.x - watchDir.x * 7 + watchDir.z * 1.2, g + 3.4, b.z - watchDir.z * 7 - watchDir.x * 1.2);
        watchLook.set(b.x + watchDir.x * 6, g + 0.4, b.z + watchDir.z * 6);
        rate = 3.2;
      }
      tmpMatrix.lookAt(watchPose.pos, watchLook, WORLD_UP);
      watchPose.quat.setFromRotationMatrix(tmpMatrix);
      target = watchPose;
    } else if (cameraMode === 'flight') {
      followPose.pos.copy(ball.mesh.position).addScaledVector(flightDir, -FOLLOW_BACK);
      followPose.pos.y = Math.max(ball.mesh.position.y, groundY) + FOLLOW_UP;
      tmpMatrix.lookAt(followPose.pos, ball.mesh.position, WORLD_UP);
      followPose.quat.setFromRotationMatrix(tmpMatrix);
      target = followPose;
      rate = 5;
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
    stars.position.copy(camera.position);

    // Keep the tight shadow box on whatever the player is watching.
    const focus = watching ? watching.ball : cameraMode === 'flight' ? ball.mesh.position : lie;
    sunOffset.fromArray(lighting.sunOffset).applyAxisAngle(WORLD_UP, aimYaw);
    sun.position.copy(focus).add(sunOffset);
    sun.target.position.copy(focus);

    if (clubHideTimer > 0) {
      clubHideTimer -= dt;
      if (clubHideTimer <= 0) club.root.visible = false;
    }

    world?.update(t, camera.position);
    friends.update(dt, t, camera);
    ball.update(t);
    club.update(t, dt);

    renderer.render(scene, camera);
    if (onFirstFrame) { onFirstFrame(); onFirstFrame = null; }
  }

  return {
    loadHole,
    placeAtLie,
    setAim,
    setGuide,
    setTimeOfDay,
    setClub(id) {
      club.setClub(id);
      if (ball.mesh.visible) club.address(lie, aimYaw, groundY); // keep the sweet spot behind the ball
    },
    setLook(look) { club.setLook(look); ball.setColour(look.ballColour); },
    beginFlight,
    resize,
    club,
    friends,
    setLookAhead(on) { lookAhead = on; },
    // Watch a friend (their id) or come back to your own ball (null).
    setWatch(id) { watchId = id || null; },
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

// Dotted flight arc for the selected club at full power, plus a ring where it lands.
function makeTrajectory() {
  const group = new THREE.Group();
  group.visible = false;
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false, depthWrite: false });
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), dotMat, ARC_DOTS);
  dots.frustumCulled = false;
  dots.renderOrder = 2;
  const ringGeo = new THREE.RingGeometry(0.75, 1.05, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false, depthWrite: false }));
  ring.renderOrder = 2;
  group.add(dots, ring);
  const m = new THREE.Matrix4();
  return {
    group,
    place(points) {
      if (!points || points.length < 2) { group.visible = false; return; }
      const first = points[0];
      for (let i = 0; i < ARC_DOTS; i++) {
        // Skip the first metre or so, so dots don't sit on top of the ball.
        const t = 0.03 + (i / (ARC_DOTS - 1)) * 0.97;
        const p = points[Math.min(points.length - 1, Math.round(t * (points.length - 1)))];
        const d = Math.hypot(p.x - first.x, p.z - first.z);
        const s = 1 + d * 0.035; // grow with distance so far dots stay visible
        m.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
        dots.setMatrixAt(i, m);
      }
      dots.instanceMatrix.needsUpdate = true;
      const last = points[points.length - 1];
      const d = Math.hypot(last.x - first.x, last.z - first.z);
      ring.position.set(last.x, last.y - 0.03, last.z);
      ring.scale.setScalar(Math.max(1, d / 40));
    },
  };
}

// Small points scattered over the upper sky, shown at night.
function makeStars() {
  const count = 450;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const y = 0.12 + Math.random() * 0.88; // keep them above the horizon haze
    const r = Math.sqrt(1 - y * y);
    positions.set([Math.cos(theta) * r * 5000, y * 5000, Math.sin(theta) * r * 5000], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
  stars.renderOrder = -1;
  stars.frustumCulled = false;
  stars.visible = false;
  return stars;
}

// A big inverted sphere with a vertical gradient. It follows the camera and ignores fog, so the
// fogged sea melts into the horizon colour without a visible seam.
function makeSkyDome() {
  const radius = 5500;
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
