// Cenário que bloqueia (lógica, sem Three.js).
// Árvores, pedras, casas, postes de luz e postes de telégrafo.
// Regra: o veículo não atravessa obstáculos; se encostar, é empurrado para fora.
import { CONFIG } from '../core/config.js';

const KINDS = {
  pine:  { radius: 1.3 },
  oak:   { radius: 1.6 },
  rock:  { radius: 1.1 },
  house: { radius: 5.0 },
  lamp:  { radius: 0.35 },
  pole:  { radius: 0.3 },
};

export class Props {
  constructor(terrain) {
    this.terrain = terrain;
    this.items = [];
  }

  // Lugar livre: dentro do mapa, fora da estrada e do trilho, e sem tocar outro obstáculo
  _free(x, z, radius, roadClear = CONFIG.road.halfWidth + 5, railClear = CONFIG.rail.bedHalf + 4) {
    const t = this.terrain;
    if (!t.inBounds(x, z, 12)) return false;
    if (t.distanceToRoad(x, z) < roadClear) return false;
    if (t.distanceToRail(x, z) < railClear) return false;
    return !this.items.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + radius + 0.5);
  }

  _add(kind, x, z, rot, scale = 1) {
    this.items.push({ kind, x, z, rot, scale, radius: KINDS[kind].radius * scale });
  }

  generate(rng) {
    const t = this.terrain;
    this.items = [];

    // Casas: do lado de fora da estrada, em grupos
    for (let tries = 0, placed = 0; tries < 400 && placed < CONFIG.props.houses; tries++) {
      const theta = rng() * Math.PI * 2;
      const side = rng() < 0.5 ? -1 : 1;
      const r = t.roadRadius(theta) + side * (14 + rng() * 14);
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      if (this._free(x, z, KINDS.house.radius, 14, 12)) {
        this._add('house', x, z, Math.atan2(x, z) + (rng() - 0.5) * 0.4);
        placed++;
      }
    }

    // Postes de luz: a cada ~24 m, do lado de fora da curva da estrada
    const roadStep = 24;
    for (let theta = 0; theta < Math.PI * 2; theta += roadStep / t.roadRadius(theta)) {
      // Fora do asfalto com folga: um carro na borda da pista (3,8 m) não encosta no poste
      const r = t.roadRadius(theta) + CONFIG.road.halfWidth + CONFIG.vehicle.hitRadius + 0.9;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      if (this._free(x, z, KINDS.lamp.radius, 0.5, CONFIG.rail.bedHalf + 3)) this._add('lamp', x, z, 0);
    }

    // Postes de telégrafo: a cada ~34 m, ao lado do trilho
    for (let theta = 0; theta < Math.PI * 2; theta += 34 / t.railRadius(theta)) {
      const r = t.railRadius(theta) + 3.5;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      if (this._free(x, z, KINDS.pole.radius, CONFIG.road.halfWidth + 4, 1.5)) {
        const p = t.railPoint(theta);
        const tan = Math.atan2(t.railPoint(theta + 1e-3).x - p.x, t.railPoint(theta + 1e-3).z - p.z);
        this._add('pole', x, z, tan);
      }
    }

    // Árvores e pedras: espalhadas nas áreas livres
    const { trees, rocks } = CONFIG.props;
    for (let tries = 0, placed = 0; tries < trees * 12 && placed < trees; tries++) {
      const x = (rng() - 0.5) * (t.size - 30);
      const z = (rng() - 0.5) * (t.size - 30);
      const surf = t.surfaceAt(x, z);
      if (surf !== 'grama' && surf !== 'terra') continue;
      const kind = rng() < 0.6 ? 'pine' : 'oak';
      if (this._free(x, z, KINDS[kind].radius)) {
        this._add(kind, x, z, rng() * Math.PI * 2, 0.85 + rng() * 0.5);
        placed++;
      }
    }
    for (let tries = 0, placed = 0; tries < rocks * 12 && placed < rocks; tries++) {
      const x = (rng() - 0.5) * (t.size - 30);
      const z = (rng() - 0.5) * (t.size - 30);
      const surf = t.surfaceAt(x, z);
      if (surf === 'asfalto' || surf === 'pedra') continue;
      if (this._free(x, z, KINDS.rock.radius, CONFIG.road.halfWidth + 3)) {
        this._add('rock', x, z, rng() * Math.PI * 2, 0.8 + rng() * 1.4);
        placed++;
      }
    }
  }

  // Empurra o veículo para fora de qualquer obstáculo encostado e o faz deslizar.
  // Devolve a maior velocidade de impacto (m/s); 0 se não encostou.
  resolve(vehicle) {
    const margin = CONFIG.vehicle.hitRadius;
    let impact = 0;
    for (const p of this.items) {
      const dx = vehicle.x - p.x;
      const dz = vehicle.z - p.z;
      const d = Math.hypot(dx, dz);
      const min = p.radius + margin;
      if (d < min) {
        const nx = d > 1e-4 ? dx / d : 1;
        const nz = d > 1e-4 ? dz / d : 0;
        vehicle.x = p.x + nx * min;
        vehicle.z = p.z + nz * min;
        impact = Math.max(impact, vehicle.contact(nx, nz));
      }
    }
    return impact;
  }

  // Usado por moedas: nenhuma moeda nasce dentro de um obstáculo
  isBlocked(x, z, extra = 0) {
    return this.items.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + extra);
  }
}
