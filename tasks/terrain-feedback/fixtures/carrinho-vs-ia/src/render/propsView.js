// Visual do cenário (Three.js): árvores, pedras, casas, postes de luz e de telégrafo.
// Cada tipo é montado de partes e desenhado com InstancedMesh (poucas chamadas de desenho).
// Escala de referência: carro 4 m, casa ~6 m de largura e ~6 m de altura, pinheiro 6 a 10 m.
import * as THREE from 'three';
import { lampMaterial } from './materials.js';

const lambert = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

const MAT = {
  trunk: lambert(0x6b4a2b),
  foliage: lambert(0xffffff), // a cor de cada árvore vem de setColorAt
  rock: lambert(0x7d8189),
  wall: lambert(0xffffff),    // a cor de cada casa vem de setColorAt
  roof: lambert(0x9c3b2e),
  door: lambert(0x5b3a22),
  window: lambert(0x2d4a63),
  steel: lambert(0x6c737c),
  lamp: lampMaterial,
};

const FOLIAGE = [0x2e6b3a, 0x3c7d3f, 0x2a5e35, 0x4a8a3c, 0x356f45];
const WALLS = [0xf1e3c4, 0xe9d2a6, 0xd9e4ea, 0xf0c9b0, 0xcfe0c3];

// Partes de cada tipo: geometria já posicionada na origem (base no chão)
const PARTS = {
  pine: [
    { geo: new THREE.CylinderGeometry(0.22, 0.32, 1.8, 6).translate(0, 0.9, 0), mat: MAT.trunk },
    { geo: new THREE.ConeGeometry(2.2, 3.0, 7).translate(0, 3.1, 0), mat: MAT.foliage, color: FOLIAGE },
    { geo: new THREE.ConeGeometry(1.65, 2.6, 7).translate(0, 4.5, 0), mat: MAT.foliage, color: FOLIAGE },
    { geo: new THREE.ConeGeometry(0.95, 2.2, 7).translate(0, 6.0, 0), mat: MAT.foliage, color: FOLIAGE },
  ],
  oak: [
    { geo: new THREE.CylinderGeometry(0.3, 0.42, 2.6, 6).translate(0, 1.3, 0), mat: MAT.trunk },
    { geo: new THREE.IcosahedronGeometry(2.4, 0).translate(0, 4.2, 0), mat: MAT.foliage, color: FOLIAGE },
  ],
  rock: [
    { geo: new THREE.DodecahedronGeometry(1.0, 0).translate(0, 0.25, 0), mat: MAT.rock },
  ],
  house: [
    { geo: new THREE.BoxGeometry(6, 3.2, 5).translate(0, 1.6, 0), mat: MAT.wall, color: WALLS },
    { geo: new THREE.ConeGeometry(4.6, 2.6, 4).rotateY(Math.PI / 4).translate(0, 4.5, 0), mat: MAT.roof },
    { geo: new THREE.BoxGeometry(0.9, 2.0, 0.12).translate(0, 1.0, 2.52), mat: MAT.door },
    { geo: new THREE.BoxGeometry(1.0, 1.0, 0.12).translate(-1.9, 1.9, 2.52), mat: MAT.window },
    { geo: new THREE.BoxGeometry(1.0, 1.0, 0.12).translate(1.9, 1.9, 2.52), mat: MAT.window },
  ],
  lamp: [
    { geo: new THREE.CylinderGeometry(0.07, 0.09, 6, 6).translate(0, 3, 0), mat: MAT.steel },
    { geo: new THREE.BoxGeometry(0.45, 0.3, 0.45).translate(0, 6.15, 0), mat: MAT.lamp },
  ],
  pole: [
    { geo: new THREE.CylinderGeometry(0.12, 0.15, 8, 6).translate(0, 4, 0), mat: MAT.trunk },
    { geo: new THREE.BoxGeometry(3.2, 0.22, 0.22).translate(0, 7.6, 0), mat: MAT.trunk },
  ],
};

export function buildProps(props, terrain) {
  const group = new THREE.Group();
  const byKind = {};
  for (const it of props.items) (byKind[it.kind] ??= []).push(it);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (const kind of Object.keys(byKind)) {
    const list = byKind[kind];
    for (const part of PARTS[kind]) {
      const mesh = new THREE.InstancedMesh(part.geo, part.mat, list.length);
      list.forEach((it, i) => {
        dummy.position.set(it.x, terrain.heightAt(it.x, it.z), it.z);
        dummy.rotation.set(0, it.rot, 0);
        dummy.scale.setScalar(it.scale ?? 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (part.color) mesh.setColorAt(i, color.setHex(part.color[i % part.color.length]));
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  return group;
}
