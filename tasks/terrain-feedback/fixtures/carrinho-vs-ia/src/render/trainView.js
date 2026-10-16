// Visual do trem (Three.js).
// Dois tipos de peça: a carroceria (um grupo por carro, no centro do carro) e os eixos
// (um grupo por eixo, posicionado sobre o trilho no seu próprio ponto).
// Assim as rodas sempre encostam no trilho, mesmo em curvas.
import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { lampMaterial } from './materials.js';

const RED = 0xc0392b;
const TEAL = 0x2a8c7a;
const COAL = 0x2b2d31;
const IRON = 0x3b3f46;
const GAUGE = CONFIG.rail.gauge;
const WHEEL_R = CONFIG.train.wheelRadius;

const lambert = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

function box(w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// Carroceria comum: chassi, engates
function frame(length, mat) {
  const f = new THREE.Group();
  f.add(box(2.4, 0.22, length - 0.6, 0, WHEEL_R * 2 + 0.1, 0, mat));
  for (const s of [-1, 1]) f.add(box(0.32, 0.28, 0.9, 0, 0.75, s * (length / 2 + 0.7), mat));
  return f;
}

function locomotive(length) {
  const g = new THREE.Group();
  const paint = lambert(RED);
  const dark = lambert(COAL);
  const iron = lambert(IRON);
  const glass = lambert(0x9fd3ff);

  g.add(frame(length, iron));

  // Caldeira: cilindro deitado no sentido do trem
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, length - 6, 12).rotateX(Math.PI / 2), paint);
  boiler.position.set(0, 2.45, 1.5);
  g.add(boiler);

  // Cabine na traseira, com janelas laterais
  const cabZ = -length / 2 + 2.4;
  g.add(box(2.8, 2.5, 4.2, 0, 2.5, cabZ, paint));
  g.add(box(2.85, 0.25, 4.3, 0, 3.85, cabZ, dark));
  for (const s of [-1, 1]) g.add(box(0.06, 0.9, 2.2, s * 1.42, 2.8, cabZ, glass));

  // Chaminé e domo
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.3, 8), dark);
  chimney.position.set(0, 4.3, length / 2 - 4.2);
  g.add(chimney);
  g.add(box(0.9, 0.5, 0.9, 0, 3.9, 1.5, dark));

  // Farol e para-choque em cunha
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.3), lampMaterial);
  head.position.set(0, 2.2, length / 2 - 0.1);
  g.add(head);
  const cow = box(2.6, 0.9, 1.2, 0, 0.8, length / 2 - 0.4, iron);
  cow.rotation.x = -0.5;
  g.add(cow);
  return g;
}

function wagon(length) {
  const g = new THREE.Group();
  const side = lambert(TEAL);
  const iron = lambert(IRON);
  const coal = lambert(COAL);

  g.add(frame(length, iron));

  // Caixa aberta: piso e quatro paredes
  const top = WHEEL_R * 2 + 0.5;
  g.add(box(2.6, 0.2, length - 0.8, 0, top, 0, iron));
  g.add(box(0.2, 1.2, length - 0.8, -1.3, top + 0.6, 0, side));
  g.add(box(0.2, 1.2, length - 0.8, 1.3, top + 0.6, 0, side));
  g.add(box(2.6, 1.2, 0.2, 0, top + 0.6, -(length - 0.8) / 2, side));
  g.add(box(2.6, 1.2, 0.2, 0, top + 0.6, (length - 0.8) / 2, side));
  g.add(box(2.3, 0.5, length - 1.4, 0, top + 0.5, 0, coal)); // carvão
  return g;
}

// Um eixo: duas rodas e o eixo entre elas. Origem no nível do topo do trilho.
function wheelset() {
  const g = new THREE.Group();
  const dark = lambert(COAL);
  const chrome = lambert(0xc9ced6);
  const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.22, 12).rotateZ(Math.PI / 2);
  for (const x of [-GAUGE, GAUGE]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(x, WHEEL_R, 0);
    w.userData.spin = true;
    g.add(w);
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GAUGE * 2 + 0.2, 6).rotateZ(Math.PI / 2), chrome);
  axle.position.set(0, WHEEL_R, 0);
  g.add(axle);
  return g;
}

export function buildTrainMeshes() {
  const group = new THREE.Group();
  const cars = [];
  const wheelsets = [];
  for (const spec of CONFIG.train.cars) {
    const car = spec.type === 'loco' ? locomotive(spec.length) : wagon(spec.length);
    car.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    group.add(car);
    cars.push(car);

    const sets = CONFIG.train.wheelsets[spec.type].map(() => {
      const ws = wheelset();
      ws.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
      });
      group.add(ws);
      return ws;
    });
    wheelsets.push(sets);
  }
  return { group, cars, wheelsets };
}

// Posiciona carrocerias e eixos com o estado da lógica; gira as rodas pela distância percorrida
export function syncTrainMeshes(view, carStates) {
  carStates.forEach((s, i) => {
    const car = view.cars[i];
    car.position.set(s.x, s.y, s.z);
    car.rotation.set(s.pitch, s.heading, s.roll, 'YXZ');

    s.wheelsets.forEach((w, j) => {
      const ws = view.wheelsets[i][j];
      ws.position.set(w.x, w.y, w.z);
      ws.rotation.set(0, w.heading, 0, 'YXZ');
      ws.children.forEach((c) => {
        if (c.userData.spin) c.rotation.x = -s.travel / WHEEL_R;
      });
    });
  });
}
