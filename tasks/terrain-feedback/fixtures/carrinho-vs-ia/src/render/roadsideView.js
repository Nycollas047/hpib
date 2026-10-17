// Beira da estrada (Three.js): balizas que dão noção de velocidade e sinais do trem.
// Só desenho. O estado dos sinais vem da lógica (train.signals()).
import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { arcSamples } from './trackView.js';

// Balizas brancas com faixa vermelha, a cada 8 m nas duas bordas.
// Sem colisão: servem de régua visual para velocidade, largura da pista e curvas.
export function buildDelineators(terrain, spacing = 8) {
  const group = new THREE.Group();
  const post = new THREE.BoxGeometry(0.14, 0.9, 0.14).translate(0, 0.45, 0);
  const band = new THREE.BoxGeometry(0.16, 0.2, 0.16).translate(0, 0.72, 0);
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const red = new THREE.MeshLambertMaterial({ color: 0xd63a2f, emissive: 0x330805 });

  const pts = arcSamples((th) => terrain.roadPoint(th), spacing);
  const off = CONFIG.road.halfWidth + 0.55;
  const posts = new THREE.InstancedMesh(post, white, pts.length * 2);
  const bands = new THREE.InstancedMesh(band, red, pts.length * 2);
  const m = new THREE.Matrix4();
  let i = 0;
  for (const p of pts) {
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    for (const side of [-1, 1]) {
      const x = p.x + rx * off * side;
      const z = p.z + rz * off * side;
      m.makeTranslation(x, terrain.heightAt(x, z), z);
      posts.setMatrixAt(i, m);
      bands.setMatrixAt(i, m);
      i++;
    }
  }
  posts.castShadow = false;
  group.add(posts, bands);
  return group;
}

// Sinais nos cruzamentos: um poste de cada lado da estrada com duas luzes vermelhas alternadas
export function buildSignals(terrain, crossings) {
  const group = new THREE.Group();
  const lit = new THREE.Color(0xff2a1a);
  const unlit = new THREE.Color(0x3a1210);
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.11, 3.4, 8).translate(0, 1.7, 0);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x55595f });
  const boxGeo = new THREE.BoxGeometry(1.5, 0.55, 0.2).translate(0, 3.3, 0);
  const lampGeo = new THREE.SphereGeometry(0.2, 12, 8);
  const signGeo = new THREE.BoxGeometry(1.4, 0.3, 0.06);
  const signMat = new THREE.MeshLambertMaterial({ color: 0xf4f4f4 });

  const lights = [];
  const off = CONFIG.road.halfWidth + 2.9;
  crossings.forEach((c) => {
    const a = terrain.roadPoint(c.theta + 1e-3);
    const b = terrain.roadPoint(c.theta - 1e-3);
    const heading = Math.atan2(a.x - b.x, a.z - b.z);
    const rx = Math.cos(heading);
    const rz = -Math.sin(heading);
    const pair = [];
    for (const side of [-1, 1]) {
      const x = c.x + rx * off * side;
      const z = c.z + rz * off * side;
      const g = new THREE.Group();
      g.position.set(x, terrain.heightAt(x, z), z);
      g.rotation.y = heading; // caixa de luz virada para a estrada
      g.add(new THREE.Mesh(poleGeo, poleMat));
      g.add(new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x222428 })));
      const cross = new THREE.Mesh(signGeo, signMat);
      cross.position.y = 2.75;
      g.add(cross);
      for (const s of [-1, 1]) {
        const mat = new THREE.MeshBasicMaterial({ color: unlit.clone() });
        const lamp = new THREE.Mesh(lampGeo, mat);
        lamp.position.set(0.45 * s, 3.3, 0.12);
        g.add(lamp);
        pair.push({ mat, phase: s > 0 ? 0 : 1 });
      }
      group.add(g);
    }
    lights.push(pair);
  });

  return {
    group,
    // signals: train.signals(); t: tempo em segundos
    update(signals, t) {
      signals.forEach((sig, i) => {
        const pair = lights[i];
        if (!pair) return;
        const rate = sig.state === 'red' ? 3 : 2;
        for (const l of pair) {
          const on = sig.state !== 'green' && Math.floor(t * rate * 2) % 2 === l.phase;
          l.mat.color.copy(on ? lit : unlit);
        }
      });
    },
  };
}
