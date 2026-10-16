// Visual das moedas (Three.js).
// A moeda é um disco DEITADO que gira em torno do eixo vertical. Assim ela sempre aparece
// vista de cima. (A versão anterior era um disco de pé girando: de perfil, ela sumia.)
// Um feixe de luz vertical marca a moeda de longe.
import * as THREE from 'three';
import { CONFIG } from '../core/config.js';

const R = CONFIG.coins.visualRadius;

// Cor pelo valor: o jogador lê o risco/recompensa de longe
export const COIN_COLORS = { 1: 0xffd23f, 2: 0xff9a2e, 3: 0x4fb4ff, 4: 0xb86bff };
const HEIGHT_ABOVE_GROUND = 1.0;
const BEACON_H = 16;

export class CoinView {
  constructor(scene) {
    const coinGeo = new THREE.CylinderGeometry(R, R, 0.16, 20);
    const coinMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      emissive: 0x2a2a2a,
      flatShading: true,
    });
    this.coins = new THREE.InstancedMesh(coinGeo, coinMat, CONFIG.coins.alive);
    this.coins.castShadow = true;

    // Feixe: cilindro fino e translúcido acima de cada moeda
    const beamGeo = new THREE.CylinderGeometry(0.12, 0.12, BEACON_H, 6).translate(0, BEACON_H / 2, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.beams = new THREE.InstancedMesh(beamGeo, beamMat, CONFIG.coins.alive);

    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.lastValue = new Array(CONFIG.coins.alive).fill(0);
    scene.add(this.coins, this.beams);
  }

  sync(coins, terrain, timeSeconds) {
    coins.forEach((c, i) => {
      const bob = Math.sin(timeSeconds * 3 + c.id) * 0.15;
      const y = terrain.heightAt(c.x, c.z) + HEIGHT_ABOVE_GROUND + bob;

      // Moeda de valor alto é maior e tem outra cor
      if (this.lastValue[i] !== c.value) {
        this.lastValue[i] = c.value;
        this.color.setHex(COIN_COLORS[c.value] ?? COIN_COLORS[1]);
        this.coins.setColorAt(i, this.color);
        this.beams.setColorAt(i, this.color);
        this.coins.instanceColor.needsUpdate = true;
        this.beams.instanceColor.needsUpdate = true;
      }
      const k = 1 + (c.value - 1) * 0.15;
      this.dummy.position.set(c.x, y, c.z);
      this.dummy.rotation.set(0, c.spin, 0);
      this.dummy.scale.set(k, k, k);
      this.dummy.updateMatrix();
      this.coins.setMatrixAt(i, this.dummy.matrix);

      this.dummy.position.set(c.x, y, c.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.beams.setMatrixAt(i, this.dummy.matrix);
    });
    this.coins.instanceMatrix.needsUpdate = true;
    this.beams.instanceMatrix.needsUpdate = true;
  }
}
