import * as THREE from 'three';
import { BUILDING_STYLES, ROOF_STYLES } from '../courses/biomes.js';

// City skyline and the low neighbourhood in front of it. Every building is merged into one mesh
// with a window-grid texture whose scale matches each wall's size, so windows stay square on
// short and tall buildings. The same texture lights the windows up at night. Roofs, domes and
// spires are plain colour (no windows).
//   buildings: [x, z, width, depth, height, colourIndex, yaw, kind, style?]  (style overrides the
//   skyline's own, e.g. a low traditional neighbourhood in front of a modern skyline)
// kinds: box · setback (stepped tower) · cylinder · slab · spire · gable (house with a pitched
//        roof) · dome · pagoda · flat (low desert block) · tank (rooftop water tower)

const FLOOR = 4.5;   // metres per window row
const BAY = 5;       // metres per window column

let windowTextures = null;
function getWindowTextures() {
  if (windowTextures) return windowTextures;
  const make = (wall, glass) => {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = glass;
    ctx.fillRect(3, 4, 10, 8);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  windowTextures = {
    walls: make('#ffffff', '#9fb0c2'),   // tinted per building by vertex colour
    lights: make('#000000', '#ffffff'),  // emissive mask: only the windows glow
  };
  return windowTextures;
}

export function buildSkyline(buildings, skylineStyle, heightAt) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colours = [];
  const colour = new THREE.Color();
  const m = new THREE.Matrix4();

  // Add a geometry placed at (x, y, z) turned by yaw. uvMode: 'walls' (window grid sized to
  // the faces), 'plain' (solid colour).
  const add = (geo, x, y, z, yaw, hex, uvMode = 'plain', size = null) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const uv = g.attributes.uv;
    const nrm = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      if (uvMode !== 'walls' || Math.abs(nrm.getY(i)) > 0.5) { uv.setXY(i, 0.05, 0.05); continue; }
      if (size.round) {
        uv.setXY(i, uv.getX(i) * (size.round / BAY), uv.getY(i) * (size.h / FLOOR));
      } else {
        const across = Math.abs(nrm.getX(i)) > 0.5 ? size.d : size.w;
        uv.setXY(i, uv.getX(i) * (across / BAY), uv.getY(i) * (size.h / FLOOR));
      }
    }
    m.makeRotationY(yaw).setPosition(x, y, z);
    g.applyMatrix4(m);
    positions.push(...g.attributes.position.array);
    normals.push(...g.attributes.normal.array);
    uvs.push(...uv.array);
    colour.setHex(hex);
    for (let i = 0; i < g.attributes.position.count; i++) colours.push(colour.r, colour.g, colour.b);
    g.dispose();
    if (g !== geo) geo.dispose();
  };
  // A walled block standing on y (its base), windowed.
  const block = (x, y, z, w, h, d, yaw, hex) => add(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), x, y, z, yaw, hex, 'walls', { w, d, h });
  // Shapes sitting on top of a block, positioned in the building's own frame then turned.
  const part = (geo, x, y, z, yaw, hex) => add(geo, x, y, z, yaw, hex, 'plain');

  for (const [x, z, w, d, h, ci, yaw, kind = 'box', own] of buildings) {
    const style = own ?? skylineStyle;
    const palette = BUILDING_STYLES[style] ?? BUILDING_STYLES.mixed;
    const y = heightAt(x, z) - 1;
    const hex = palette[ci % palette.length];
    const roofs = ROOF_STYLES[style] ?? ROOF_STYLES.mixed;
    const roof = roofs[ci % roofs.length];
    switch (kind) {
      case 'setback': { // a stepped tower, with a mast on the tallest
        block(x, y, z, w, h * 0.55, d, yaw, hex);
        block(x, y + h * 0.55, z, w * 0.76, h * 0.27, d * 0.76, yaw, hex);
        block(x, y + h * 0.82, z, w * 0.52, h * 0.18, d * 0.52, yaw, hex);
        if (h > 60) part(new THREE.BoxGeometry(0.8, h * 0.18, 0.8).translate(0, h + h * 0.09, 0), x, y, z, yaw, 0xd8dde2);
        break;
      }
      case 'cylinder': { // a round glass tower with a crown
        const r = Math.min(w, d) / 2;
        add(new THREE.CylinderGeometry(r, r, h, 16, 1).translate(0, h / 2, 0), x, y, z, yaw, hex, 'walls', { round: Math.PI * 2 * r, h });
        part(new THREE.CylinderGeometry(r * 0.7, r, h * 0.06, 16).translate(0, h + h * 0.03, 0), x, y, z, yaw, roof);
        break;
      }
      case 'slab': // a wide, thin block
        block(x, y, z, w * 1.6, h * 0.8, d * 0.45, yaw, hex);
        break;
      case 'spire': { // tower with a pointed top and a needle
        block(x, y, z, w, h, d, yaw, hex);
        const rh = Math.max(8, h * 0.28);
        part(new THREE.ConeGeometry(Math.min(w, d) * 0.71, rh, 4).rotateY(Math.PI / 4).scale(w / Math.min(w, d), 1, d / Math.min(w, d)).translate(0, h + rh / 2, 0), x, y, z, yaw, roof);
        part(new THREE.CylinderGeometry(0.3, 0.5, rh * 0.6, 5).translate(0, h + rh + rh * 0.3, 0), x, y, z, yaw, 0xd8dde2);
        break;
      }
      case 'gable': { // a house: walls and a pitched roof running along its depth
        block(x, y, z, w, h, d, yaw, hex);
        const rh = Math.min(w, d) * 0.45;
        const prism = new THREE.BoxGeometry(1, 1, d * 1.04).rotateZ(Math.PI / 4).scale((w * 1.08) / Math.SQRT2, (2 * rh) / Math.SQRT2, 1).translate(0, h, 0);
        part(prism, x, y, z, yaw, roof);
        if (ci % 3 === 0) part(new THREE.BoxGeometry(1.4, rh * 1.3, 1.4).translate(w * 0.25, h + rh * 0.7, d * 0.2), x, y, z, yaw, 0x8a5a44); // chimney
        break;
      }
      case 'dome': { // block with a dome (and a little minaret on some)
        block(x, y, z, w, h, d, yaw, hex);
        const r = Math.min(w, d) * 0.42;
        part(new THREE.CylinderGeometry(r * 1.02, r * 1.02, r * 0.35, 14).translate(0, h + r * 0.17, 0), x, y, z, yaw, hex);
        part(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, h + r * 0.35, 0), x, y, z, yaw, roof);
        if (ci % 2 === 0) {
          part(new THREE.CylinderGeometry(0.9, 1.1, h * 1.5, 8).translate(w * 0.42, h * 0.75, d * 0.42), x, y, z, yaw, hex);
          part(new THREE.ConeGeometry(1.2, 3.5, 8).translate(w * 0.42, h * 1.5 + 1.75, d * 0.42), x, y, z, yaw, roof);
        }
        break;
      }
      case 'pagoda': { // stacked storeys with wide, flared roofs
        const tiers = 3;
        let tw = w;
        let ty = y;
        const th = h / (tiers + 0.6);
        for (let t = 0; t < tiers; t++) {
          block(x, ty, z, tw, th, tw, yaw, hex);
          part(new THREE.ConeGeometry(tw * 0.92, th * 0.55, 4, 1).rotateY(Math.PI / 4).translate(0, ty - y + th + th * 0.2, 0), x, y, z, yaw, roof);
          ty += th + th * 0.12;
          tw *= 0.74;
        }
        part(new THREE.CylinderGeometry(0.2, 0.35, th * 0.9, 5).translate(0, ty - y + th * 0.45, 0), x, y, z, yaw, 0xd9a93a);
        break;
      }
      case 'flat': { // a low desert house: thick walls, a parapet, a water tank or small dome
        block(x, y, z, w, h, d, yaw, hex);
        part(new THREE.BoxGeometry(w * 1.02, 0.9, d * 1.02).translate(0, h + 0.45, 0), x, y, z, yaw, roof);
        if (ci % 2) part(new THREE.SphereGeometry(Math.min(w, d) * 0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(-w * 0.2, h + 0.9, 0), x, y, z, yaw, 0xf2ead8);
        break;
      }
      case 'tank': { // a block with a wooden water tower on the roof
        block(x, y, z, w, h, d, yaw, hex);
        const r = Math.min(w, d) * 0.16;
        for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(new THREE.BoxGeometry(0.3, 2.4, 0.3).translate(lx * r * 0.7, h + 1.2, lz * r * 0.7), x, y, z, yaw, 0x4a3a2e);
        part(new THREE.CylinderGeometry(r, r, r * 1.6, 10).translate(0, h + 2.4 + r * 0.8, 0), x, y, z, yaw, 0x8a6648);
        part(new THREE.ConeGeometry(r * 1.08, r * 0.7, 10).translate(0, h + 2.4 + r * 1.6 + r * 0.35, 0), x, y, z, yaw, 0x5a463a);
        break;
      }
      default: { // plain block; the tallest get a narrower top section
        block(x, y, z, w, h, d, yaw, hex);
        if (h > 70 && ci % 2 === 0) block(x, y + h, z, w * 0.6, h * 0.18, d * 0.6, yaw, hex);
      }
    }
  }
  if (!positions.length) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  const tex = getWindowTextures();
  const material = new THREE.MeshLambertMaterial({
    map: tex.walls, vertexColors: true,
    emissive: 0xffd27a, emissiveMap: tex.lights, emissiveIntensity: 0,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'skyline';
  return {
    mesh,
    setWindowGlow(v) { material.emissiveIntensity = v; },
  };
}
