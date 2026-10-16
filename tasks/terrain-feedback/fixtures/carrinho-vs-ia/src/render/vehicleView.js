// Visual do carrinho (Three.js, low-poly estilizado). Frente = +Z (heading 0 = +Z).
// Inclui:
// - Rodas dianteiras esterçantes que viram com a direção
// - 4 rodas funcionais que giram conforme a velocidade
// - Suspensão com inclinação da carroceria (body roll em curvas e pitch ao frear/acelerar)
// - Lanternas traseiras dinâmicas que acendem com o freio
import * as THREE from 'three';
import { lampMaterial } from './materials.js';
import { getCarStripeTexture, getGrilleTexture, getHeadlightTexture, getTireTexture } from './textures.js';

export function buildVehicleMesh(color) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const paint = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const paintStripe = new THREE.MeshLambertMaterial({ map: getCarStripeTexture(color), flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1d1f23, flatShading: true });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd3ff, flatShading: true });
  const chrome = new THREE.MeshLambertMaterial({ color: 0xd8dde6, flatShading: true });
  const brakeMat = new THREE.MeshLambertMaterial({ color: 0xd92518, emissive: 0x660805, emissiveIntensity: 0.25 });
  const grilleMat = new THREE.MeshLambertMaterial({ map: getGrilleTexture() });
  const tireMat = new THREE.MeshLambertMaterial({ color: 0x24262a, map: getTireTexture() });
  const headlightMat = new THREE.MeshLambertMaterial({
    color: 0xfff1c4,
    emissive: 0xffc860,
    emissiveIntensity: 0.15,
    map: getHeadlightTexture(),
  });

  const addBody = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    body.add(m);
    return m;
  };

  // Carroceria em duas partes (chassi baixo e capô) e cabine com vidros
  addBody(new THREE.BoxGeometry(1.8, 0.55, 3.9), paint, 0, 0.55, 0);
  addBody(new THREE.BoxGeometry(1.7, 0.2, 1.4), paintStripe, 0, 0.9, 1.2); // Capô com faixas
  addBody(new THREE.BoxGeometry(1.6, 0.6, 1.9), glass, 0, 1.2, -0.2);
  addBody(new THREE.BoxGeometry(1.7, 0.08, 1.9), paintStripe, 0, 1.52, -0.2); // Teto com faixas
  addBody(new THREE.BoxGeometry(1.5, 0.12, 0.9), dark, 0, 1.6, -0.2); // bagageiro

  // Para-choques, grade e retrovisores
  addBody(new THREE.BoxGeometry(1.9, 0.18, 0.18), chrome, 0, 0.35, 2.0);
  addBody(new THREE.BoxGeometry(1.9, 0.18, 0.18), chrome, 0, 0.35, -2.0);
  addBody(new THREE.BoxGeometry(1.1, 0.25, 0.05), grilleMat, 0, 0.7, 1.96);
  for (const s of [-1, 1]) {
    addBody(new THREE.BoxGeometry(0.15, 0.15, 0.25), dark, s * 1.0, 1.05, 0.9);
  }

  // Faróis dianteiros e lanternas traseiras de freio
  for (const s of [-1, 1]) {
    addBody(new THREE.BoxGeometry(0.4, 0.18, 0.06), headlightMat, s * 0.6, 0.7, 1.96);
    addBody(new THREE.BoxGeometry(0.3, 0.14, 0.06), brakeMat, s * 0.65, 0.7, -1.96);
  }

  // Constrói uma roda com raio e detalhes nos aros para visual de rotação
  const createWheel = () => {
    const wheelGroup = new THREE.Group();
    const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12).rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 6).rotateZ(Math.PI / 2);
    const spokeGeo = new THREE.BoxGeometry(0.33, 0.08, 0.38);

    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, chrome);
    const spoke = new THREE.Mesh(spokeGeo, chrome);

    wheelGroup.add(tire, hub, spoke);
    return wheelGroup;
  };

  // 1. Rodas dianteiras com pivô de direção (steering)
  const pivotFL = new THREE.Group();
  pivotFL.position.set(-0.95, 0.36, 1.3);
  const wheelFL = createWheel();
  pivotFL.add(wheelFL);
  group.add(pivotFL);

  const pivotFR = new THREE.Group();
  pivotFR.position.set(0.95, 0.36, 1.3);
  const wheelFR = createWheel();
  pivotFR.add(wheelFR);
  group.add(pivotFR);

  // 2. Rodas traseiras com giro de tração
  const wheelRL = createWheel();
  wheelRL.position.set(-0.95, 0.36, -1.3);
  group.add(wheelRL);

  const wheelRR = createWheel();
  wheelRR.position.set(0.95, 0.36, -1.3);
  group.add(wheelRR);

  group.userData = {
    body,
    pivotFL,
    pivotFR,
    wheelFL,
    wheelFR,
    wheelRL,
    wheelRR,
    brakeMat,
    wheelAngle: 0,
  };

  return group;
}

// Atualiza posição, rotação do mundo, direção das rodas, giro e suspensão
export function syncVehicleMesh(mesh, vehicle, dt = 1 / 60) {
  mesh.position.set(vehicle.x, vehicle.y, vehicle.z);
  mesh.rotation.set(vehicle.pitch, vehicle.heading, vehicle.roll, 'YXZ');

  const u = mesh.userData;
  if (!u || !u.body) return;

  const throttle = vehicle.controls?.throttle ?? (vehicle.speed > 0 ? 0.6 : 0);
  const brake = vehicle.controls?.brake ?? 0;
  const steer = vehicle.controls?.steer ?? 0;

  // 1. Esterçamento das rodas dianteiras
  const steerAngle = steer * 0.44;
  u.pivotFL.rotation.y = steerAngle;
  u.pivotFR.rotation.y = steerAngle;

  // 2. Giro das 4 rodas conforme a velocidade
  const spinDelta = (vehicle.speed * dt) / 0.36;
  u.wheelAngle = (u.wheelAngle + spinDelta) % (Math.PI * 2);
  u.wheelFL.rotation.x = u.wheelAngle;
  u.wheelFR.rotation.x = u.wheelAngle;
  u.wheelRL.rotation.x = u.wheelAngle;
  u.wheelRR.rotation.x = u.wheelAngle;

  // 3. Suspensão: inclinação da carroceria (Body Roll & Pitch)
  const speedRatio = Math.min(1, Math.abs(vehicle.speed) / 26);
  const roll = -vehicle.slip * 0.022 - steer * speedRatio * 0.04;
  const pitch = brake > 0 ? -brake * 0.045 : (throttle > 0 ? throttle * 0.02 : 0);
  u.body.rotation.set(pitch, 0, roll);

  // 4. Luzes de freio dinâmicas
  if (u.brakeMat) {
    u.brakeMat.emissiveIntensity = brake > 0.1 ? 2.0 : 0.25;
  }
}
