import * as THREE from 'three';

// Low-poly trees, drawn with one instanced mesh per tree part so hundreds of trees cost only
// a handful of draw calls. Tree records come from the hole generator:
//   [type, x, z, scale, colourIndex, yawDegrees]
// Types: round, blossom, cypress, pine, snowpine, palm, cactus, oak, maple, birch, willow,
// bamboo, rain (wide rain tree / acacia), umbrella (stone pine), jpine (Japanese pine), olive,
// banana, gum (eucalyptus), topiary, joshua.

const PI = Math.PI;

// Each tree type is a list of parts: geometry (already positioned for a 1× tree) and colour.
// colour: 'trunk' | 'leaf' (from the biome palette for that type) | a fixed hex.
function partsFor(type) {
  const trunk = (h, r = 0.35) => new THREE.CylinderGeometry(r * 0.7, r, h, 6).translate(0, h / 2, 0);
  switch (type) {
    case 'round':
    case 'blossom':
      return [
        { geo: trunk(4), colour: 'trunk' },
        { geo: new THREE.IcosahedronGeometry(3.2, 0).scale(1, 1.1, 1).translate(0, 5.6, 0), colour: 'leaf' },
      ];
    case 'cypress':
      return [
        { geo: trunk(1.6, 0.3), colour: 'trunk' },
        { geo: new THREE.IcosahedronGeometry(1.8, 0).scale(1.15, 3.6, 1.15).translate(0, 7.4, 0), colour: 'leaf' },
      ];
    case 'pine':
      return [
        { geo: trunk(2.6, 0.32), colour: 'trunk' },
        { geo: new THREE.ConeGeometry(3.4, 4.6, 7).translate(0, 4.4, 0), colour: 'leaf' },
        { geo: new THREE.ConeGeometry(2.7, 4, 7).translate(0, 6.9, 0), colour: 'leaf' },
        { geo: new THREE.ConeGeometry(1.9, 3.4, 7).translate(0, 9.2, 0), colour: 'leaf' },
      ];
    case 'snowpine':
      return [
        { geo: trunk(2.6, 0.32), colour: 'trunk' },
        { geo: new THREE.ConeGeometry(3.4, 4.6, 7).translate(0, 4.4, 0), colour: 'leaf' },
        { geo: new THREE.ConeGeometry(2.7, 4, 7).translate(0, 6.9, 0), colour: 'leaf' },
        { geo: new THREE.ConeGeometry(1.9, 3.4, 7).translate(0, 9.2, 0), colour: 'leaf' },
        { geo: new THREE.ConeGeometry(1.5, 1.6, 7).translate(0, 10.3, 0), colour: 0xf4f8fb },
        { geo: new THREE.ConeGeometry(2.9, 1.2, 7).translate(0, 7.8, 0), colour: 0xf4f8fb },
        { geo: new THREE.ConeGeometry(3.6, 1.1, 7).translate(0, 5.3, 0), colour: 0xf4f8fb },
      ];
    case 'palm': {
      const parts = [{ geo: new THREE.CylinderGeometry(0.22, 0.38, 8.5, 6).translate(0, 4.25, 0).rotateZ(-0.12), colour: 'trunk' }];
      for (let i = 0; i < 7; i++) {
        const frond = new THREE.BoxGeometry(0.7, 0.08, 3.4).translate(0, 0, -1.7).rotateX(0.5).rotateY((i / 7) * PI * 2).translate(1.0, 8.4, 0);
        parts.push({ geo: frond, colour: 'leaf' });
      }
      return parts;
    }
    case 'cactus':
      return [
        { geo: new THREE.CapsuleGeometry(0.45, 4.2, 3, 8).translate(0, 2.5, 0), colour: 'leaf' },
        { geo: new THREE.CapsuleGeometry(0.3, 1.4, 3, 8).translate(0, 0.7, 0).rotateZ(0.9).translate(0.9, 2.2, 0), colour: 'leaf' },
        { geo: new THREE.CapsuleGeometry(0.3, 1.6, 3, 8).translate(0, 0.8, 0).translate(1.55, 2.6, 0), colour: 'leaf' },
        { geo: new THREE.CapsuleGeometry(0.28, 1.2, 3, 8).translate(0, 0.6, 0).rotateZ(-0.9).translate(-0.85, 2.9, 0), colour: 'leaf' },
        { geo: new THREE.CapsuleGeometry(0.28, 1.2, 3, 8).translate(0, 0.6, 0).translate(-1.4, 3.3, 0), colour: 'leaf' },
      ];
    case 'oak': // a broad crown of three clumps
    case 'maple':
      return [
        { geo: trunk(4.2, 0.45), colour: 'trunk' },
        { geo: new THREE.IcosahedronGeometry(2.8, 0).translate(-1.4, 5.6, 0.4), colour: 'leaf' },
        { geo: new THREE.IcosahedronGeometry(2.6, 0).translate(1.5, 5.9, -0.3), colour: 'leaf' },
        { geo: new THREE.IcosahedronGeometry(2.7, 0).translate(0.1, 7.3, 0.2), colour: 'leaf' },
      ];
    case 'birch': // slim white trunk, small airy crown
      return [
        { geo: new THREE.CylinderGeometry(0.18, 0.26, 6.5, 6).translate(0, 3.25, 0), colour: 0xeceae2 },
        { geo: new THREE.CylinderGeometry(0.27, 0.27, 0.25, 6).translate(0, 2.2, 0), colour: 0x2e2a26 },
        { geo: new THREE.CylinderGeometry(0.24, 0.24, 0.2, 6).translate(0, 3.9, 0), colour: 0x2e2a26 },
        { geo: new THREE.IcosahedronGeometry(1.9, 0).scale(1, 1.5, 1).translate(0, 7.1, 0), colour: 'leaf' },
      ];
    case 'willow': { // a dome with long trailing curtains
      const parts = [
        { geo: trunk(3.6, 0.5), colour: 'trunk' },
        { geo: new THREE.SphereGeometry(3.4, 8, 5, 0, PI * 2, 0, PI / 2).scale(1, 0.75, 1).translate(0, 5.2, 0), colour: 'leaf' },
      ];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2;
        parts.push({ geo: new THREE.ConeGeometry(0.9, 4.6, 5).rotateX(PI).translate(Math.cos(a) * 2.7, 3.2, Math.sin(a) * 2.7), colour: 'leaf' });
      }
      return parts;
    }
    case 'bamboo': { // a clump of tall stalks with leafy tops
      const parts = [];
      const spots = [[0, 0, 9], [0.9, 0.4, 7.5], [-0.7, 0.6, 8.2], [0.3, -0.9, 6.8], [-0.6, -0.6, 7.8]];
      for (const [x, z, h] of spots) {
        parts.push({ geo: new THREE.CylinderGeometry(0.13, 0.16, h, 5).translate(x, h / 2, z), colour: 0x8fae4a });
        parts.push({ geo: new THREE.ConeGeometry(0.9, 2.2, 5).translate(x, h - 0.4, z), colour: 'leaf' });
      }
      return parts;
    }
    case 'rain': // rain tree / acacia: a thin trunk and a wide, flat crown
      return [
        { geo: trunk(4.8, 0.35), colour: 'trunk' },
        { geo: new THREE.CylinderGeometry(0.16, 0.22, 2.4, 5).translate(0, 1.2, 0).rotateZ(0.6).translate(0.6, 4.2, 0), colour: 'trunk' },
        { geo: new THREE.CylinderGeometry(0.16, 0.22, 2.4, 5).translate(0, 1.2, 0).rotateZ(-0.6).translate(-0.6, 4.2, 0), colour: 'trunk' },
        { geo: new THREE.IcosahedronGeometry(4.2, 0).scale(1.25, 0.32, 1.1).translate(0, 6.6, 0), colour: 'leaf' },
      ];
    case 'umbrella': // Mediterranean stone pine: tall bare trunk, a flat parasol on top
      return [
        { geo: new THREE.CylinderGeometry(0.28, 0.42, 9, 6).translate(0, 4.5, 0).rotateZ(0.1), colour: 'trunk' },
        { geo: new THREE.IcosahedronGeometry(3.6, 0).scale(1.2, 0.4, 1.2).translate(0.9, 9.6, 0), colour: 'leaf' },
      ];
    case 'jpine': // Japanese black pine: a crooked trunk and flat cloud pads
      return [
        { geo: new THREE.CylinderGeometry(0.28, 0.42, 5, 6).translate(0, 2.5, 0).rotateZ(0.25), colour: 'trunk' },
        { geo: new THREE.CylinderGeometry(0.2, 0.26, 3, 5).translate(0, 1.5, 0).rotateZ(-0.9).translate(-1.1, 3.8, 0), colour: 'trunk' },
        { geo: new THREE.IcosahedronGeometry(2.4, 0).scale(1.3, 0.38, 1.1).translate(-1.4, 5.3, 0.3), colour: 'leaf' },
        { geo: new THREE.IcosahedronGeometry(2.0, 0).scale(1.3, 0.4, 1.1).translate(1.8, 4.6, -0.2), colour: 'leaf' },
        { geo: new THREE.IcosahedronGeometry(1.6, 0).scale(1.3, 0.42, 1.1).translate(-0.4, 6.6, 0), colour: 'leaf' },
      ];
    case 'olive': // short, gnarled, a wide silvery crown
      return [
        { geo: new THREE.CylinderGeometry(0.35, 0.6, 2.2, 6).translate(0, 1.1, 0).rotateZ(-0.15), colour: 'trunk' },
        { geo: new THREE.IcosahedronGeometry(2.3, 0).scale(1.35, 0.8, 1.2).translate(0.2, 3.4, 0), colour: 'leaf' },
        { geo: new THREE.IcosahedronGeometry(1.5, 0).translate(1.6, 3.9, 0.6), colour: 'leaf' },
      ];
    case 'banana': { // big paddle leaves fanning out of a short stem
      const parts = [{ geo: new THREE.CylinderGeometry(0.3, 0.4, 3.4, 6).translate(0, 1.7, 0), colour: 0x7c9a48 }];
      for (let i = 0; i < 6; i++) {
        const leaf = new THREE.BoxGeometry(1.1, 0.06, 3.6).translate(0, 0, -1.8).rotateX(-0.35 - (i % 2) * 0.25).rotateY((i / 6) * PI * 2 + 0.3).translate(0, 3.4, 0);
        parts.push({ geo: leaf, colour: 'leaf' });
      }
      return parts;
    }
    case 'gum': // eucalyptus: a tall pale trunk and loose clumps up top
      return [
        { geo: new THREE.CylinderGeometry(0.3, 0.45, 9, 6).translate(0, 4.5, 0), colour: 0xd8d0c0 },
        { geo: new THREE.IcosahedronGeometry(1.9, 0).translate(-1.2, 8.8, 0.4), colour: 'leaf' },
        { geo: new THREE.IcosahedronGeometry(1.6, 0).translate(1.3, 9.6, -0.4), colour: 'leaf' },
        { geo: new THREE.IcosahedronGeometry(1.4, 0).translate(0.1, 10.8, 0.2), colour: 'leaf' },
      ];
    case 'topiary': // a clipped cone on a short stem, in a box
      return [
        { geo: new THREE.BoxGeometry(1.6, 0.9, 1.6).translate(0, 0.45, 0), colour: 0xe8e2d6 },
        { geo: trunk(1.2, 0.18).translate(0, 0.8, 0), colour: 'trunk' },
        { geo: new THREE.ConeGeometry(1.5, 4.2, 8).translate(0, 4.0, 0), colour: 'leaf' },
      ];
    case 'joshua': { // Joshua tree: a shaggy trunk splitting into spiky-tipped arms
      const parts = [{ geo: new THREE.CylinderGeometry(0.32, 0.45, 3.2, 6).translate(0, 1.6, 0), colour: 'trunk' }];
      for (const [rz, ry, len] of [[0.7, 0, 2.6], [-0.6, 0.4, 2.2], [0.4, 2.2, 2.4], [-0.3, 3.6, 2]]) {
        const arm = new THREE.CylinderGeometry(0.22, 0.28, len, 5).translate(0, len / 2, 0).rotateZ(rz).rotateY(ry).translate(0, 3, 0);
        parts.push({ geo: arm, colour: 'trunk' });
        const tip = new THREE.IcosahedronGeometry(0.75, 0).scale(1, 0.8, 1).translate(0, len, 0).rotateZ(rz).rotateY(ry).translate(0, 3, 0);
        parts.push({ geo: tip, colour: 'leaf' });
      }
      return parts;
    }
    default:
      return partsFor('round');
  }
}

// Leaf colours for each tree type when neither the biome nor the city sets them.
export const DEFAULT_LEAVES = {
  oak: [0x4f8a2e, 0x5f9a32, 0x467f2a], maple: [0xd9452c, 0xe8742a, 0xc8302a, 0xf0a030],
  birch: [0x8fbf48, 0xa3c94e, 0xd8c040], willow: [0x8ab840, 0x9cc64e, 0x7aa83a],
  bamboo: [0x6fae3a, 0x7cbc44], rain: [0x4f9a32, 0x5fa83a, 0x3f8a2e], umbrella: [0x3f6e34, 0x4a7a3a],
  jpine: [0x2f5a34, 0x3a6a3a], olive: [0x9aaa7a, 0x8a9c6a, 0xa8b688], banana: [0x7cc23a, 0x6aae30],
  gum: [0x7f9a6a, 0x6f8c5c, 0x8aa478], topiary: [0x3f7a34, 0x4a8a3a], joshua: [0x6f8f4a, 0x7c9a52],
};

// trees: tree records; biome: palette; heightAt(x, z): ground height.
export function buildTrees(trees, biome, heightAt) {
  const group = new THREE.Group();
  group.name = 'trees';
  const byType = new Map();
  for (const t of trees) {
    if (!byType.has(t[0])) byType.set(t[0], []);
    byType.get(t[0]).push(t);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const colour = new THREE.Color();

  for (const [type, list] of byType) {
    const palette = biome.leaves[type] ?? biome.leaves.round ?? [0x5f9a32];
    for (const part of partsFor(type)) {
      const mat = new THREE.MeshLambertMaterial({ flatShading: true, color: 0xffffff });
      const mesh = new THREE.InstancedMesh(part.geo, mat, list.length);
      list.forEach(([, x, z, s, ci, yawDeg], i) => {
        q.setFromAxisAngle(up, (yawDeg * PI) / 180);
        pos.set(x, heightAt(x, z) - 0.2, z);
        scl.setScalar(s);
        mesh.setMatrixAt(i, m.compose(pos, q, scl));
        const hex = part.colour === 'trunk' ? biome.trunk : part.colour === 'leaf' ? palette[ci % palette.length] : part.colour;
        mesh.setColorAt(i, colour.setHex(hex));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  }
  return group;
}
