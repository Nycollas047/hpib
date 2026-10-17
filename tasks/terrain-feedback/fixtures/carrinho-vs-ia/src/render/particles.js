// Sistema de partículas para Three.js:
// - Fumaça e poeira de derrapagem (drift) na cor do terreno
// - Explosão brilhante de partículas coloridas na coleta de moedas
import * as THREE from 'three';

const MAX_DRIFT_PARTICLES = 160;
const MAX_SPARK_PARTICLES = 140;

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;

    // 1. Partículas de fumaça / poeira de pneu
    const smokeGeo = new THREE.DodecahedronGeometry(0.24, 0);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, MAX_DRIFT_PARTICLES);
    this.smokeData = Array.from({ length: MAX_DRIFT_PARTICLES }, () => ({
      active: false,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      scale: 0.2,
      maxScale: 1.0,
      life: 0,
      maxLife: 0.6,
    }));
    this.smokeIndex = 0;

    // 2. Partículas de faísca / brilho de moedas
    const sparkGeo = new THREE.OctahedronGeometry(0.18, 0);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, MAX_SPARK_PARTICLES);
    this.sparkData = Array.from({ length: MAX_SPARK_PARTICLES }, () => ({
      active: false,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      scale: 0.2,
      life: 0,
      maxLife: 0.5,
    }));
    this.sparkIndex = 0;

    this.dummy = new THREE.Object3D();
    this.dummyColor = new THREE.Color();

    // Inicializa matrizes fora do campo de visão
    this.dummy.position.set(0, -999, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < MAX_DRIFT_PARTICLES; i++) {
      this.smokeMesh.setMatrixAt(i, this.dummy.matrix);
    }
    for (let i = 0; i < MAX_SPARK_PARTICLES; i++) {
      this.sparkMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.smokeMesh.instanceMatrix.needsUpdate = true;
    this.sparkMesh.instanceMatrix.needsUpdate = true;

    scene.add(this.smokeMesh, this.sparkMesh);
  }

  // Emite poeira/fumaça de pneu
  emitDrift(x, y, z, surface = 'asfalto', strength = 1.0) {
    const colors = {
      asfalto: 0xe8ecf0, // fumaça branca/cinza de borracha
      terra:   0xb58e65, // poeira de terra
      grama:   0x78ab52, // respingos de grama
      lama:    0x4d3824, // lama escura
      pedra:   0xa8adb5, // pó de brita
    };
    const colHex = colors[surface] || 0xe8ecf0;

    const count = Math.min(3, Math.ceil(strength * 2));
    for (let i = 0; i < count; i++) {
      const idx = this.smokeIndex;
      this.smokeIndex = (this.smokeIndex + 1) % MAX_DRIFT_PARTICLES;
      const p = this.smokeData[idx];

      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.8;
      p.y = y + 0.15;
      p.z = z + (Math.random() - 0.5) * 0.8;
      p.vx = (Math.random() - 0.5) * 1.5;
      p.vy = 0.8 + Math.random() * 1.2;
      p.vz = (Math.random() - 0.5) * 1.5;
      p.scale = 0.25;
      p.maxScale = 0.8 + Math.random() * 0.6;
      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.25;

      this.dummyColor.setHex(colHex);
      this.smokeMesh.setColorAt(idx, this.dummyColor);
    }
    if (this.smokeMesh.instanceColor) this.smokeMesh.instanceColor.needsUpdate = true;
  }

  // Explosão brilhante na coleta de moeda
  burstCoin(x, y, z, colorHex = 0xffd23f) {
    const count = 18;
    for (let i = 0; i < count; i++) {
      const idx = this.sparkIndex;
      this.sparkIndex = (this.sparkIndex + 1) % MAX_SPARK_PARTICLES;
      const p = this.sparkData[idx];

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 4 + Math.random() * 6;
      const vY = 2 + Math.random() * 5;

      p.active = true;
      p.x = x;
      p.y = y + 0.5;
      p.z = z;
      p.vx = Math.cos(angle) * speed;
      p.vy = vY;
      p.vz = Math.sin(angle) * speed;
      p.scale = 0.4;
      p.life = 0;
      p.maxLife = 0.4 + Math.random() * 0.25;

      this.dummyColor.setHex(colorHex);
      this.sparkMesh.setColorAt(idx, this.dummyColor);
    }
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    // 1. Atualiza partículas de fumaça
    let smokeNeedsUpdate = false;
    for (let i = 0; i < MAX_DRIFT_PARTICLES; i++) {
      const p = this.smokeData[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.updateMatrix();
        this.smokeMesh.setMatrixAt(i, this.dummy.matrix);
        smokeNeedsUpdate = true;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const progress = p.life / p.maxLife;
      const scale = p.scale + (p.maxScale - p.scale) * progress;

      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.life * 2, p.life * 1.5, 0);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();
      this.smokeMesh.setMatrixAt(i, this.dummy.matrix);
      smokeNeedsUpdate = true;
    }
    if (smokeNeedsUpdate) this.smokeMesh.instanceMatrix.needsUpdate = true;

    // 2. Atualiza faíscas de moedas
    let sparkNeedsUpdate = false;
    for (let i = 0; i < MAX_SPARK_PARTICLES; i++) {
      const p = this.sparkData[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.updateMatrix();
        this.sparkMesh.setMatrixAt(i, this.dummy.matrix);
        sparkNeedsUpdate = true;
        continue;
      }

      p.vy -= 12 * dt; // gravidade
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const progress = p.life / p.maxLife;
      const scale = Math.max(0.01, p.scale * (1 - progress));

      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.life * 8, p.life * 8, 0);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, this.dummy.matrix);
      sparkNeedsUpdate = true;
    }
    if (sparkNeedsUpdate) this.sparkMesh.instanceMatrix.needsUpdate = true;
  }
}
