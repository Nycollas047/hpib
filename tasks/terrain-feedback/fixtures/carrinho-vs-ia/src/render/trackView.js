// Visual da pista (Three.js): estrada com faixas e tracejado; trilho com brita, dormentes
// e dois trilhos de aço. Tudo acompanha a altura do terreno (terrain.heightAt).
// Não decide nada de jogo: só desenha.
import * as THREE from 'three';
import { CONFIG, SURFACES } from '../core/config.js';
import { getAsphaltTexture, getWoodTexture } from './textures.js';

const TAU = Math.PI * 2;
const RING_SEGMENTS = 480;

// Faixa contínua em volta do anel: raio da linha central ± meia largura
function ribbon(terrain, radiusFn, halfW, lift, color, map = null) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= RING_SEGMENTS; i++) {
    const th = (i / RING_SEGMENTS) * TAU;
    const r = radiusFn(th);
    const v = (i / RING_SEGMENTS) * 48;
    for (const side of [-1, 1]) {
      const rr = r + side * halfW;
      const x = Math.cos(th) * rr;
      const z = Math.sin(th) * rr;
      positions.push(x, terrain.heightAt(x, z) + lift, z);
      uvs.push(side === -1 ? 0 : 1, v);
    }
  }
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const matConfig = { color, side: THREE.DoubleSide };
  if (map) matConfig.map = map;
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial(matConfig));
  mesh.receiveShadow = true;
  return mesh;
}

// Pontos igualmente espaçados ao longo de uma curva fechada (em metros de arco)
export function arcSamples(pointFn, spacing) {
  const N = 8000;
  const pts = [];
  for (let i = 0; i <= N; i++) pts.push(pointFn((i / N) * TAU));
  const lens = [0];
  for (let i = 1; i <= N; i++) {
    lens.push(lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  }
  const total = lens[N];
  const out = [];
  let j = 0;
  for (let s = 0; s < total; s += spacing) {
    while (j < N - 1 && lens[j + 1] < s) j++;
    const seg = lens[j + 1] - lens[j] || 1;
    const th = ((j + (s - lens[j]) / seg) / N) * TAU;
    const p = pointFn(th);
    const a = pointFn(th + 1e-3);
    const b = pointFn(th - 1e-3);
    out.push({ x: p.x, z: p.z, heading: Math.atan2(a.x - b.x, a.z - b.z) });
  }
  return out;
}

// Estrada: asfalto, faixas nas bordas e tracejado central
export function buildRoadGroup(terrain) {
  const group = new THREE.Group();
  const hw = CONFIG.road.halfWidth;
  const r = (th) => terrain.roadRadius(th);

  group.add(ribbon(terrain, r, hw, 0.1, SURFACES.asfalto.color, getAsphaltTexture()));
  group.add(ribbon(terrain, (th) => r(th) + hw - 0.45, 0.18, 0.13, 0xf2f2f2));
  group.add(ribbon(terrain, (th) => r(th) - hw + 0.45, 0.18, 0.13, 0xf2f2f2));

  // Tracejado: traços de 3,5 m a cada 9 m
  const dashes = arcSamples((th) => terrain.roadPoint(th), 9);
  const dashGeo = new THREE.BoxGeometry(0.22, 0.03, 3.5);
  const dashMesh = new THREE.InstancedMesh(
    dashGeo,
    new THREE.MeshLambertMaterial({ color: 0xf2e8c4 }),
    dashes.length
  );
  const dummy = new THREE.Object3D();
  dashes.forEach((d, i) => {
    dummy.position.set(d.x, terrain.heightAt(d.x, d.z) + 0.15, d.z);
    dummy.rotation.set(0, d.heading, 0);
    dummy.updateMatrix();
    dashMesh.setMatrixAt(i, dummy.matrix);
  });
  dashMesh.receiveShadow = true;
  group.add(dashMesh);
  return group;
}

// Trilho: brita, dormentes e dois trilhos (bitola ±0,72 m)
export function buildRailGroup(terrain) {
  const group = new THREE.Group();
  const { bedHalf, ballastTop, sleeperTop, railRadius, gauge, sleeperSpacing } = CONFIG.rail;

  group.add(
    ribbon(terrain, (th) => terrain.railRadius(th), bedHalf, ballastTop, 0x7b7d80)
  );

  // Dormentes: perpendiculares ao trilho, apoiados na brita
  const sleepers = arcSamples((th) => terrain.railPoint(th), sleeperSpacing);
  const sleeperMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.6, 0.12, 0.24),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2b, map: getWoodTexture() }),
    sleepers.length
  );
  const dummy = new THREE.Object3D();
  sleepers.forEach((s, i) => {
    dummy.position.set(s.x, terrain.heightAt(s.x, s.z) + sleeperTop - 0.06, s.z);
    dummy.rotation.set(0, s.heading, 0);
    dummy.updateMatrix();
    sleeperMesh.setMatrixAt(i, dummy.matrix);
  });
  sleeperMesh.castShadow = true;
  sleeperMesh.receiveShadow = true;
  group.add(sleeperMesh);

  // Dois trilhos de aço sobre os dormentes
  const steel = new THREE.MeshLambertMaterial({ color: 0xc9ced6 });
  const N = 900;
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i < N; i++) {
      const th = (i / N) * TAU;
      const rr = terrain.railRadius(th) + side * gauge;
      const x = Math.cos(th) * rr;
      const z = Math.sin(th) * rr;
      pts.push(new THREE.Vector3(x, terrain.heightAt(x, z) + sleeperTop + railRadius, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, N, railRadius, 6, true), steel);
    rail.castShadow = true;
    group.add(rail);
  }
  return group;
}
