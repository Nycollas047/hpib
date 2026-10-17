// Moedas (lógica, sem Three.js).
// Pool: quando uma moeda é coletada, ela reaparece em outro lugar,
// então o número de moedas na pista é sempre o mesmo.
//
// Cada moeda nasce em uma ZONA (CONFIG.coins.zones), e a zona define o risco e o valor:
//   road  na pista: seguro, vale o da superfície (1)
//   risk  perto do trilho: vale +1 (o trem passa por ali)
//   hill  em encosta: vale +1 (o relevo atrapalha)
//   open  longe da pista: vale o da superfície (terra/grama/lama: 2 a 3)
// Valor final de 1 a 4. O visual usa o valor para escolher a cor.
import { CONFIG, SURFACES } from '../core/config.js';

const TAU = Math.PI * 2;
export const MAX_COIN_VALUE = 4;

export class CoinField {
  constructor(terrain, props = null) {
    this.terrain = terrain;
    this.props = props;
    this.coins = [];
    this.avoid = [];        // veículos: nenhuma moeda nasce em cima de um carro
    this.rng = Math.random;
  }

  reset(rng, vehicles = []) {
    this.rng = rng;
    this.avoid = vehicles;
    this.coins = [];
    for (let i = 0; i < CONFIG.coins.alive; i++) {
      const coin = { id: i, x: 0, z: 0, value: 1, surface: 'asfalto', zone: 'road', spin: 0 };
      this._place(coin);
      this.coins.push(coin);
    }
  }

  // Sorteia a zona respeitando os pesos
  _pickZone() {
    const zones = Object.entries(CONFIG.coins.zones);
    const total = zones.reduce((s, [, w]) => s + w, 0);
    let r = this.rng() * total;
    for (const [name, w] of zones) {
      if ((r -= w) <= 0) return name;
    }
    return zones[0][0];
  }

  _slope(x, z) {
    const t = this.terrain;
    const gx = (t.heightAt(x + 2, z) - t.heightAt(x - 2, z)) / 4;
    const gz = (t.heightAt(x, z + 2) - t.heightAt(x, z - 2)) / 4;
    return Math.hypot(gx, gz);
  }

  // Ponto sorteado para a zona (ainda sem checar as regras gerais)
  _sample(zone) {
    const t = this.terrain;
    const th = this.rng() * TAU;
    if (zone === 'road') {
      const r = t.roadRadius(th) + (this.rng() * 2 - 1) * (CONFIG.road.halfWidth - 1.2);
      return { x: Math.cos(th) * r, z: Math.sin(th) * r };
    }
    // Demais zonas: ponto em qualquer lugar do mapa (uniforme em área)
    const R = t.half - 14;
    return { x: (this.rng() * 2 - 1) * R, z: (this.rng() * 2 - 1) * R };
  }

  _inZone(zone, x, z) {
    const t = this.terrain;
    const dRoad = t.distanceToRoad(x, z);
    const dRail = t.distanceToRail(x, z);
    if (zone === 'road') return dRoad <= CONFIG.road.halfWidth - 0.8;
    if (zone === 'risk') return dRail <= CONFIG.coins.riskDistance && dRoad > CONFIG.road.halfWidth;
    if (zone === 'hill') return this._slope(x, z) >= CONFIG.coins.hillSlope && dRoad > CONFIG.road.halfWidth + 2;
    if (zone === 'open') return dRoad >= CONFIG.coins.openMinFromRoad;
    return true;
  }

  // Regras gerais: dentro do mapa, longe do trilho, de obstáculos, de outras moedas e de carros
  _valid(coin, x, z) {
    const t = this.terrain;
    const c = CONFIG.coins;
    if (!t.inBounds(x, z, 8)) return false;
    if (t.distanceToRail(x, z) < c.minFromRail) return false;
    if (this.props?.isBlocked(x, z, 1.5)) return false;
    if (this.coins.some((o) => o !== coin && Math.hypot(o.x - x, o.z - z) < c.minSpacing)) return false;
    if (this.avoid.some((v) => Math.hypot(v.x - x, v.z - z) < c.minFromVehicle)) return false;
    return true;
  }

  // Testa vários lugares ("candidates") e fica com o mais afastado das outras moedas,
  // assim elas se espalham em vez de formar cachos.
  _place(coin) {
    const { candidates } = CONFIG.coins;
    let zone = this._pickZone();
    let best = null;

    for (let pass = 0; pass < 3 && !best; pass++) {
      let found = 0;
      for (let attempt = 0; attempt < 200 && found < candidates; attempt++) {
        const p = this._sample(zone);
        if (!this._inZone(zone, p.x, p.z) || !this._valid(coin, p.x, p.z)) continue;
        found++;
        const gap = Math.min(1e9, ...this.coins.filter((o) => o !== coin).map((o) => Math.hypot(o.x - p.x, o.z - p.z)));
        if (!best || gap > best.gap) best = { ...p, gap };
      }
      if (!best) zone = pass === 0 ? 'open' : 'road'; // zona sem espaço: tenta outra
    }

    if (!best) {
      const p = this.terrain.roadPoint(this.rng() * TAU); // último recurso
      best = { x: p.x, z: p.z };
      zone = 'road';
    }

    coin.x = best.x;
    coin.z = best.z;
    coin.zone = zone;
    coin.surface = this.terrain.surfaceAt(best.x, best.z);
    const bonus = zone === 'risk' || zone === 'hill' ? 1 : 0;
    coin.value = Math.min(MAX_COIN_VALUE, SURFACES[coin.surface].coinValue + bonus);
  }

  // Verifica coletas. onCollect(vehicle, coin) é chamado quando alguém pega a moeda.
  update(dt, vehicles, onCollect) {
    this.avoid = vehicles;
    const radius = CONFIG.coins.radius;
    for (const coin of this.coins) {
      coin.spin += dt * 3;
      for (const v of vehicles) {
        if (Math.hypot(v.x - coin.x, v.z - coin.z) < radius) {
          onCollect(v, coin);
          this._place(coin);
          break;
        }
      }
    }
  }
}
