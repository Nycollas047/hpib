// Visual do relevo (Three.js): malha com cor por vértice.
// A cor vem da superfície (terra, grama, lama, pedra) e fica rochosa em encostas íngremes.
import * as THREE from 'three';
import { CONFIG, SURFACES } from '../core/config.js';

const ROCK = new THREE.Color(0x6d6f74);
const smooth = (a, b, t) => {
  const c = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return c * c * (3 - 2 * c);
};
// Pequena variação determinística por posição (evita chapado)
const jitter = (x, z) => {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

export function buildTerrainMesh(terrain) {
  const { size, segments } = CONFIG.world;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrain.heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  const normal = geo.attributes.normal;

  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    c.setHex(SURFACES[terrain.surfaceAt(x, z)].color);

    // Encosta íngreme (normal pouco vertical) vira rocha
    const steep = smooth(0.2, 0.42, 1 - normal.getY(i));
    c.lerp(ROCK, steep);

    const shade = 0.9 + 0.2 * jitter(x, z);
    colors[i * 3] = c.r * shade;
    colors[i * 3 + 1] = c.g * shade;
    colors[i * 3 + 2] = c.b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.receiveShadow = true;
  return mesh;
}

// Chão além do mapa, para a borda não aparecer no horizonte
export function buildApron() {
  const geo = new THREE.PlaneGeometry(3000, 3000);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x4d6b35 }));
  mesh.position.y = -6;
  mesh.receiveShadow = true;
  return mesh;
}
