import * as THREE from 'three';
import { buildAvatar } from '../avatar/avatar.js';
import { sanitizeLook } from '../avatar/looks.js';
import { createBallBody, placeBody, launchBody, stepBody } from '../physics/ball.js';
import { groundHeight } from '../physics/course.js';

// Friends on your course (online play). Each friend has their golfer standing at their ball,
// a floating name tag so you can find them, and their ball. When they swing, their shot is
// replayed here with the same physics (from the swing they sent), then their golfer walks over
// to wherever the ball came to rest.
//
//   sync({ hole, wind, friends: [{ id, name, look, index, lie, shot, done }] })   every room update
//   update(dt, t, camera)                                                         every frame
//   clear()                                                                       new hole

const STAND_OFF = 0.6; // golfer stands this far to the side of the ball
const WALK_TIME = 1.4;

export function createGhosts(scene) {
  const root = new THREE.Group();
  root.name = 'friends';
  scene.add(root);
  const friends = new Map(); // id → friend rig
  let hole = null;
  let wind = null;

  function rigFor(f) {
    let rig = friends.get(f.id);
    const lookKey = JSON.stringify(f.look ?? {});
    if (rig && rig.lookKey === lookKey && rig.name === f.name) return rig;
    if (rig) disposeRig(rig);
    const avatar = buildAvatar(sanitizeLook(f.look));
    const holder = new THREE.Group();
    holder.add(avatar.group);
    root.add(holder);
    const tag = nameTag(f.name, f.look?.topColour ?? '#3a63d8');
    tag.position.y = avatar.height + 0.35;
    holder.add(tag);
    const ballColour = f.look?.ballColour ?? '#f8f8f6';
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 14, 10),
      new THREE.MeshLambertMaterial({ color: ballColour, emissive: ballColour, emissiveIntensity: 0.35 })
    );
    ball.visible = false;
    root.add(ball);
    // A dot that stays the same size on screen over their ball, so you can spot it from 200 m.
    const marker = ballMarker(f.look?.topColour ?? '#3a63d8');
    marker.visible = false;
    root.add(marker);
    const trail = makeTrail(ballColour);
    root.add(trail.line);
    rig = {
      id: f.id, name: f.name, lookKey, holder, avatar, tag, ball, marker, trail, flyDir: new THREE.Vector3(0, 0, -1),
      pos: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), yaw: 0,
      walk: 1, path: null, pathT: 0, seenShot: -1, lie: null, phase: Math.random() * 6,
    };
    friends.set(f.id, rig);
    return rig;
  }

  function disposeRig(rig) {
    root.remove(rig.holder, rig.ball, rig.marker, rig.trail.line);
    rig.holder.traverse((o) => { if (o.isMesh || o.isSprite) o.geometry?.dispose(); });
    friends.delete(rig.id);
  }

  // Where a golfer stands to address a ball at (x, z), facing across the line to the pin.
  function stance(x, z, index, atTee) {
    const yaw = Math.atan2(-(hole.pin[0] - x), -(hole.pin[2] - z));
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    let px;
    let pz;
    let face;
    if (atTee) {
      // Waiting on the tee: a little line behind the tee box, looking down the hole.
      px = x - fx * 3 + rx * (index - 1) * 1.1 - rx * 1.6;
      pz = z - fz * 3 + rz * (index - 1) * 1.1 - rz * 1.6;
      face = Math.atan2(fx, fz);
    } else {
      px = x - rx * STAND_OFF;
      pz = z - rz * STAND_OFF;
      face = Math.atan2(rx, rz); // facing the ball
    }
    return { x: px, z: pz, y: groundHeight(hole, px, pz), face };
  }

  function placeAt(rig, f, instant) {
    const atTee = !f.lie || (Math.hypot(f.lie.x - hole.tee[0], f.lie.z - hole.tee[2]) < 1 && !(f.shot && f.shot.n > 0));
    const lie = f.lie ?? { x: hole.tee[0], z: hole.tee[2] };
    const s = stance(lie.x, lie.z, f.index, atTee);
    rig.to.set(s.x, s.y, s.z);
    rig.yaw = s.face;
    rig.lie = lie;
    if (instant || rig.walk >= 1 && rig.pos.lengthSq() === 0) {
      rig.pos.copy(rig.to);
      rig.walk = 1;
    } else {
      rig.from.copy(rig.pos);
      rig.walk = 0;
    }
    // Their ball sits at the lie (unless it's mid-flight).
    if (!rig.path) {
      rig.ball.visible = !f.done && !atTee;
      rig.ball.position.set(lie.x, groundHeight(hole, lie.x, lie.z) + 0.045, lie.z);
    }
  }

  // Replay a friend's shot: run the physics now, then play the recorded path back in real time.
  function playShot(rig, shot) {
    const body = createBallBody();
    placeBody(body, hole, shot.from.x, shot.from.z);
    launchBody(body, { yaw: shot.yaw, speed: shot.speed, launchRad: shot.launchRad, curve: shot.curve, wind: shot.launchRad > 0 ? wind : null, gustPhase: shot.gustPhase });
    const points = [];
    let end = 'rest';
    for (let i = 0; i < 60 * 25; i++) {
      const e = stepBody(body, hole, 1 / 60);
      points.push(body.p.x, body.p.y, body.p.z);
      if (e === 'water' || e === 'oob') { end = 'water'; break; }
      if (e === 'holed') { end = 'holed'; break; }
      if (body.state === 'rest') break;
    }
    rig.path = { points, end, count: points.length / 3 };
    rig.pathT = 0;
    rig.ball.visible = true;
    rig.trail.reset();
    rig.swingT = 0; // little swing turn on the golfer
  }

  return {
    sync({ hole: h, wind: w, friends: list }) {
      if (h !== hole) { this.clear(); hole = h; }
      wind = w;
      if (!hole) return;
      const live = new Set();
      for (const f of list) {
        live.add(f.id);
        const rig = rigFor(f);
        rig.done = !!f.done;
        rig.strokes = f.strokes ?? 0;
        rig.holder.visible = !f.done;
        rig.tag.visible = !f.done;
        // A new swing we haven't watched yet?
        if (f.shot && f.shot.n > rig.seenShot) {
          const fresh = rig.seenShot >= 0 || f.shot.n === 1;
          rig.seenShot = f.shot.n;
          if (fresh && !f.done) playShot(rig, f.shot);
        }
        if (!rig.path) placeAt(rig, f, rig.pos.lengthSq() === 0);
        else rig.pending = f; // walk over once the ball has landed
        if (f.done) { rig.ball.visible = false; rig.trail.line.visible = false; }
      }
      for (const [id, rig] of friends) if (!live.has(id)) disposeRig(rig);
    },

    update(dt, t, camera) {
      for (const rig of friends.values()) {
        // ball in flight
        if (rig.path) {
          rig.pathT += dt * 60;
          const i = Math.min(rig.path.count - 1, Math.floor(rig.pathT));
          const p = rig.path.points;
          const j = Math.max(0, i - 3);
          rig.flyDir.set(p[i * 3] - p[j * 3], 0, p[i * 3 + 2] - p[j * 3 + 2]);
          if (rig.flyDir.lengthSq() > 1e-4) rig.flyDir.normalize();
          rig.ball.position.set(p[i * 3], p[i * 3 + 1] + 0.02, p[i * 3 + 2]);
          rig.trail.push(rig.ball.position);
          if (i >= rig.path.count - 1) {
            if (rig.path.end !== 'rest') rig.ball.visible = false;
            rig.path = null;
            rig.trail.fade = 1.5;
            if (rig.pending) { placeAt(rig, rig.pending, false); rig.pending = null; }
          }
        }
        rig.trail.update(dt);
        // (only from a distance: up close the real ball is easy to see)
        rig.marker.visible = rig.ball.visible && !rig.done && (!camera || rig.ball.position.distanceTo(camera.position) > 14);
        rig.marker.position.set(rig.ball.position.x, rig.ball.position.y + 0.32, rig.ball.position.z);
        // walk to the new spot
        if (rig.walk < 1) {
          rig.walk = Math.min(1, rig.walk + dt / WALK_TIME);
          const k = rig.walk * rig.walk * (3 - 2 * rig.walk);
          rig.pos.lerpVectors(rig.from, rig.to, k);
        }
        // idle sway, a hop while walking, and a quick turn when they swing
        const bob = Math.sin(t * 2 + rig.phase) * 0.01 + (rig.walk < 1 ? Math.abs(Math.sin(rig.walk * 18)) * 0.06 : 0);
        rig.holder.position.set(rig.pos.x, rig.pos.y + bob, rig.pos.z);
        let turn = Math.sin(t * 0.7 + rig.phase) * 0.08;
        if (rig.swingT !== undefined && rig.swingT < 1) {
          rig.swingT += dt * 1.6;
          turn += Math.sin(Math.min(1, rig.swingT) * Math.PI) * 1.2;
        }
        rig.holder.rotation.y = rig.yaw + turn;
        // Don't stand inside the first-person camera.
        if (camera && !rig.done) {
          const near = rig.holder.position.distanceTo(camera.position) < 2.2;
          rig.avatar.group.visible = !near;
        }
      }
    },

    clear() {
      for (const rig of [...friends.values()]) disposeRig(rig);
      hole = null;
    },

    // What the camera needs to watch a friend: their ball, where they stand, and whether the
    // ball is in the air. null once they've holed out (or aren't on this hole).
    focus(id) {
      const rig = friends.get(id);
      if (!rig || rig.done || !hole) return null;
      return {
        ball: rig.ball.visible || rig.path ? rig.ball.position : rig.holder.position,
        golfer: rig.holder.position,
        flying: !!rig.path,
        flyDir: rig.flyDir,
        pin: hole.pin,
        name: rig.name,
        strokes: rig.strokes ?? 0,
      };
    },

    // Where everyone is (for tests and debugging).
    snapshot() {
      return [...friends.values()].map((r) => ({
        id: r.id, name: r.name, at: [r.to.x, r.to.z].map((v) => Math.round(v * 10) / 10),
        ball: r.ball.visible ? [r.ball.position.x, r.ball.position.z].map((v) => Math.round(v * 10) / 10) : null,
        flying: !!r.path, shots: r.seenShot, done: !!r.done,
      }));
    },
  };
}

// Floating name tag that stays the same size on screen and shows through trees.
function nameTag(name, colour) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  const label = String(name || 'Player').slice(0, 14);
  ctx.font = '700 34px "Lilita One", "Arial Rounded MT Bold", sans-serif';
  const w = Math.min(244, (ctx.measureText?.(label)?.width ?? 120) + 40);
  const x = (256 - w) / 2;
  ctx.fillStyle = colour;
  roundRect(ctx, x, 8, w, 50, 25);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();
  ctx.beginPath(); // little pointer under the tag
  ctx.moveTo(118, 58); ctx.lineTo(128, 70); ctx.lineTo(138, 58);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 4;
  ctx.fillText(label, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false, transparent: true, fog: false }));
  sprite.scale.set(0.16, 0.045, 1);
  sprite.renderOrder = 10;
  return sprite;
}

// Friend's ball marker: a ring in their shirt colour with a white dot, constant size on screen.
function ballMarker(colour) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(32, 32, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false, transparent: true, fog: false }));
  sprite.scale.set(0.028, 0.028, 1);
  sprite.renderOrder = 9;
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A short fading line behind a friend's ball in flight.
function makeTrail(colour) {
  const MAX = 48;
  const positions = new Float32Array(MAX * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setDrawRange(0, 0);
  const material = new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 0.8 });
  const line = new THREE.Line(geo, material);
  line.frustumCulled = false;
  let count = 0;
  const trail = {
    line,
    fade: 0,
    reset() { count = 0; geo.setDrawRange(0, 0); line.visible = true; material.opacity = 0.8; trail.fade = 0; },
    push(p) {
      if (count === MAX) positions.copyWithin(0, 3);
      else count++;
      positions.set([p.x, p.y, p.z], (count - 1) * 3);
      geo.attributes.position.needsUpdate = true;
      geo.setDrawRange(0, count);
    },
    update(dt) {
      if (trail.fade <= 0) return;
      trail.fade -= dt;
      material.opacity = Math.max(0, trail.fade / 1.5) * 0.8;
      if (trail.fade <= 0) line.visible = false;
    },
  };
  return trail;
}
