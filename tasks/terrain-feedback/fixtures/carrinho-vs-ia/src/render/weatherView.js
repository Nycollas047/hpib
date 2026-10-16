// Visual do clima (Three.js): céu, neblina, luz, sombras, precipitação e faróis.
// Recebe um perfil de WEATHER (config.js) e só aplica. Não decide nada de jogo.
import * as THREE from 'three';
import { setNightLights } from './materials.js';

const BOX_XZ = 140; // área da precipitação, centrada no carro
const BOX_Y = 40;

export class WeatherView {
  constructor(scene, sun, hemi, sky) {
    this.scene = scene;
    this.sun = sun;
    this.hemi = hemi;
    this.sky = sky;
    this.precip = null;
  }

  apply(profile) {
    this.sky.setColors(profile.skyTop, profile.skyHorizon);
    this.scene.fog = new THREE.FogExp2(profile.skyHorizon, profile.fog);
    this.sun.intensity = profile.sun;
    this.hemi.intensity = profile.ambient;
    setNightLights(profile.night);
    this._setPrecip(profile.precip);
  }

  _setPrecip(spec) {
    if (this.precip) {
      this.scene.remove(this.precip.points);
      this.precip.points.geometry.dispose();
      this.precip.points.material.dispose();
      this.precip = null;
    }
    if (!spec) return;

    const pos = new Float32Array(spec.count * 3);
    for (let i = 0; i < spec.count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * BOX_XZ;
      pos[i * 3 + 1] = Math.random() * BOX_Y;
      pos[i * 3 + 2] = (Math.random() - 0.5) * BOX_XZ;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: spec.color,
      size: spec.size,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.precip = { points, spec, pos };
  }

  // A precipitação acompanha o carro, então cai sempre ao redor dele
  update(dt, center) {
    if (!this.precip) return;
    const { points, spec, pos } = this.precip;
    points.position.set(center.x, 0, center.z);
    const fall = spec.speed * dt;
    for (let i = 0; i < spec.count; i++) {
      pos[i * 3 + 1] -= fall;
      if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] += BOX_Y;
    }
    points.geometry.attributes.position.needsUpdate = true;
  }
}
