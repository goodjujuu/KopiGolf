import * as THREE from 'three';
import { BUILDING_STYLES } from '../courses/biomes.js';

// City skyline: every building is merged into one mesh with a window-grid texture whose
// scale matches each building's size, so windows stay square on short and tall towers.
// The same texture lights the windows up at night.
//   buildings: [x, z, width, depth, height, colourIndex, yaw]

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

export function buildSkyline(buildings, style, heightAt) {
  const palette = BUILDING_STYLES[style] ?? BUILDING_STYLES.mixed;
  const positions = [];
  const normals = [];
  const uvs = [];
  const colours = [];
  const colour = new THREE.Color();
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();

  const addBox = (x, y, z, w, h, d, yaw, hex) => {
    const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    // Scale UVs per face so each window is roughly BAY × FLOOR metres. Face order: +x −x +y −y +z −z.
    const uv = geo.attributes.uv;
    for (let face = 0; face < 6; face++) {
      for (let v = 0; v < 6; v++) {
        const i = face * 6 + v;
        if (face === 2 || face === 3) { uv.setXY(i, 0.05, 0.05); continue; } // roofs: plain wall colour
        const across = face < 2 ? d : w;
        uv.setXY(i, uv.getX(i) * (across / BAY), uv.getY(i) * (h / FLOOR));
      }
    }
    m.makeRotationY(yaw).setPosition(x, y + h / 2, z);
    geo.applyMatrix4(m);
    nm.getNormalMatrix(m);
    positions.push(...geo.attributes.position.array);
    normals.push(...geo.attributes.normal.array);
    uvs.push(...uv.array);
    colour.setHex(hex);
    for (let i = 0; i < geo.attributes.position.count; i++) colours.push(colour.r, colour.g, colour.b);
    geo.dispose();
  };

  for (const [x, z, w, d, h, ci, yaw] of buildings) {
    const y = heightAt(x, z) - 1;
    const hex = palette[ci % palette.length];
    addBox(x, y, z, w, h, d, yaw, hex);
    // Some buildings get a narrower top section.
    if (h > 70 && ci % 2 === 0) addBox(x, y + h, z, w * 0.6, h * 0.18, d * 0.6, yaw, hex);
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
