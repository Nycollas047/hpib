// Terreno (lógica pura, sem Three.js).
// A altura final é: relevo natural, moldado para a estrada e o trilho perto deles.
// Perto da pista, o terreno vira o relevo suavizado (Ground), então a pista fica plana
// na seção transversal e com inclinação baixa no sentido do percurso.
import { CONFIG } from '../core/config.js';
import { fbm, valueNoise } from './noise.js';
import { Ground } from './ground.js';

const smooth01 = (t) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
const lerp = (a, b, t) => a + (b - a) * t;

export class Terrain {
  constructor(seed = CONFIG.seed) {
    this.seed = seed;
    this.size = CONFIG.world.size;
    this.half = this.size / 2;
    const t = CONFIG.terrain;
    this.ground = new Ground((x, z) => this.rawHeight(x, z), t.groundExtent, t.groundCell, t.groundBlur);
  }

  // Relevo natural (sem estrada nem trilho)
  rawHeight(x, z) {
    const { heightScale, noiseScale } = CONFIG.terrain;
    return (fbm(x / noiseScale, z / noiseScale, this.seed) - 0.5) * heightScale;
  }

  // Altura do relevo suavizado (base de estrada e trilho)
  groundAt(x, z) {
    return this.ground.sample(x, z);
  }

  // ---- Geometria em coordenadas polares
  roadRadius(theta) {
    const { radius, wobble } = CONFIG.road;
    const n = valueNoise(Math.cos(theta) * 1.6 + 20, Math.sin(theta) * 1.6 + 20, this.seed + 7);
    return radius + (n - 0.5) * 2 * wobble;
  }

  railRadius(theta) {
    const { radiusBase, radiusAmp } = CONFIG.rail;
    return radiusBase + radiusAmp * Math.cos(2 * theta);
  }

  roadPoint(theta) {
    const r = this.roadRadius(theta);
    return { x: r * Math.cos(theta), z: r * Math.sin(theta) };
  }

  railPoint(theta) {
    const r = this.railRadius(theta);
    return { x: r * Math.cos(theta), z: r * Math.sin(theta) };
  }

  polar(x, z) {
    return { r: Math.hypot(x, z), theta: Math.atan2(z, x) };
  }

  distanceToRoad(x, z) {
    const { r, theta } = this.polar(x, z);
    return Math.abs(r - this.roadRadius(theta));
  }

  distanceToRail(x, z) {
    const { r, theta } = this.polar(x, z);
    return Math.abs(r - this.railRadius(theta));
  }

  // ---- Altura final
  heightAt(x, z) {
    const { r, theta } = this.polar(x, z);
    const { trackMargin } = CONFIG.terrain;
    const { margin: railMargin, bedHalf } = CONFIG.rail;
    const roadHalf = CONFIG.road.halfWidth;

    let h = this.rawHeight(x, z);

    // Estrada: no asfalto, a altura é o relevo suavizado no mesmo ângulo
    const rp = this.roadPoint(theta);
    const roadBed = this.groundAt(rp.x, rp.z);
    const dRoad = Math.abs(r - this.roadRadius(theta));
    h = lerp(roadBed, h, smooth01((dRoad - roadHalf) / trackMargin));

    // Trilho: mesma ideia, com a brita ocupando a faixa central
    const tp = this.railPoint(theta);
    const railBed = this.groundAt(tp.x, tp.z);
    const dRail = Math.abs(r - this.railRadius(theta));
    h = lerp(railBed, h, smooth01((dRail - bedHalf) / railMargin));

    return h;
  }

  // ---- Superfície: define atrito, velocidade e vibração
  surfaceAt(x, z) {
    const { r, theta } = this.polar(x, z);
    if (Math.abs(r - this.roadRadius(theta)) <= CONFIG.road.halfWidth) return 'asfalto';
    if (Math.abs(r - this.railRadius(theta)) <= CONFIG.rail.bedHalf) return 'pedra';

    const h = this.rawHeight(x, z);
    if (h > CONFIG.terrain.heightScale * 0.3) return 'pedra';

    const wet = valueNoise(x / 35, z / 35, this.seed + 99);
    if (wet > 0.66 && h < 0) return 'lama';
    if (wet > 0.4) return 'grama';
    return 'terra';
  }

  inBounds(x, z, margin = 0) {
    const lim = this.half - margin;
    return Math.abs(x) <= lim && Math.abs(z) <= lim;
  }
}
