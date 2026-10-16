import * as THREE from 'three';

// Low-poly trees, drawn with one instanced mesh per tree part so hundreds of trees cost only
// a handful of draw calls. Tree records come from the hole generator:
//   [type, x, z, scale, colourIndex, yawDegrees]
// Types: round, blossom, cypress, pine, snowpine, palm, cactus.

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
    default:
      return partsFor('round');
  }
}

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
