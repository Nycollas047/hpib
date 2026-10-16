// Trem (lógica, sem Three.js).
// A cabeça anda pelo trilho (parametrizado por θ). Cada vagão tem frente e traseira
// sobre o trilho; daí saem o rumo, a inclinação (subida/descida) e a rolagem (desnível
// entre os dois trilhos). Assim o trem acompanha o relevo.
import { CONFIG } from '../core/config.js';

export class Train {
  constructor(terrain) {
    this.terrain = terrain;
    this.dir = 1;        // +1 = anti-horário
    this.travel = 0;     // distância percorrida (m), usada para girar as rodas
    this.cars = this._layout();
    this.length = CONFIG.train.cars.reduce((a, c) => a + c.length, 0) + CONFIG.train.gap * (CONFIG.train.cars.length - 1);
    this._buildArcTable();
    this.s = 0;          // posição da cabeça: metros ao longo do trilho (não ângulo)
    this.crossings = this._findCrossings();
  }

  // Posição da cabeça como ângulo θ (compatível com quem já usava train.theta)
  get theta() {
    return this.thetaAt(this.s);
  }

  set theta(th) {
    this.s = this.arcAt(th);
  }

  // Inverso de arcAt: ângulo θ para uma distância s sobre o trilho
  thetaAt(s) {
    const L = this.railLength;
    const q = ((s % L) + L) % L;
    let lo = 0, hi = this._arcN;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this._arc[mid] <= q) lo = mid; else hi = mid;
    }
    const seg = this._arc[hi] - this._arc[lo] || 1;
    return ((lo + (q - this._arc[lo]) / seg) / this._arcN) * Math.PI * 2;
  }

  // Tabela de comprimento de arco do trilho por θ (o trilho não é um círculo).
  // Serve para saber a que distância (em metros) o trem está de cada cruzamento.
  _buildArcTable() {
    const N = 1440;
    this._arc = new Float64Array(N + 1);
    let prev = this.terrain.railPoint(0);
    for (let i = 1; i <= N; i++) {
      const p = this.terrain.railPoint((i / N) * Math.PI * 2);
      this._arc[i] = this._arc[i - 1] + Math.hypot(p.x - prev.x, p.z - prev.z);
      prev = p;
    }
    this.railLength = this._arc[N];
    this._arcN = N;
  }

  // Distância percorrida sobre o trilho (m) até o ângulo θ, a partir de θ = 0
  arcAt(theta) {
    const u = (((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * this._arcN;
    const i = Math.min(this._arcN - 1, Math.floor(u));
    return this._arc[i] + (this._arc[i + 1] - this._arc[i]) * (u - i);
  }

  // Cruzamentos entre trilho e estrada: pontos onde railRadius(θ) = roadRadius(θ)
  _findCrossings() {
    const t = this.terrain;
    const f = (th) => t.railRadius(th) - t.roadRadius(th);
    const out = [];
    const N = 2880;
    let a = 0;
    let fa = f(a);
    for (let i = 1; i <= N; i++) {
      const b = (i / N) * Math.PI * 2;
      const fb = f(b);
      if (fa === 0 || fa * fb < 0) {
        let lo = a, hi = b, flo = fa;
        for (let k = 0; k < 30; k++) {
          const mid = (lo + hi) / 2;
          const fm = f(mid);
          if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; }
        }
        const th = (lo + hi) / 2;
        const p = t.roadPoint(th);
        out.push({ theta: th, x: p.x, z: p.z, arc: this.arcAt(th) });
      }
      a = b;
      fa = fb;
    }
    return out;
  }

  // Estado dos sinais. state: 'green' livre, 'warn' trem chegando (pisca), 'red' trem passando.
  // ahead = metros que a cabeça ainda precisa andar; eta = segundos até a cabeça chegar.
  signals() {
    const L = this.railLength;
    const head = this.s;
    const margin = 4;
    return this.crossings.map((c) => {
      let ahead = ((c.arc - head) * this.dir) % L;
      if (ahead < 0) ahead += L;
      const behind = L - ahead; // quanto a cabeça já passou
      const eta = ahead / CONFIG.train.speed;
      let state = 'green';
      if (behind < this.length + margin || ahead < margin) state = 'red';
      else if (eta < CONFIG.train.warnSeconds) state = 'warn';
      return { x: c.x, z: c.z, theta: c.theta, state, eta, ahead };
    });
  }

  // Distância de cada vagão até a cabeça, medida para trás (frente de cada carro = d, traseira = d + L)
  _layout() {
    const cars = [];
    let behind = 0;
    for (const spec of CONFIG.train.cars) {
      cars.push({ ...spec, start: behind });
      behind += spec.length + CONFIG.train.gap;
    }
    return cars;
  }

  update(dt) {
    // Anda por distância real sobre o trilho: 20 m/s em qualquer ponto
    // (antes avançava o ângulo, e o trem acelerava onde o trilho se afasta do centro)
    const ds = CONFIG.train.speed * dt;
    this.s = (this.s + this.dir * ds + this.railLength) % this.railLength;
    this.travel += ds;
  }

  // Ponto sobre o trilho a "d" metros atrás da cabeça
  _railAt(d) {
    const p = this.terrain.railPoint(this.thetaAt(this.s - this.dir * d));
    return { x: p.x, z: p.z, y: this.terrain.heightAt(p.x, p.z) + CONFIG.rail.railTop };
  }

  // Estado completo de cada carro (posição, rumo, inclinações e pontos de colisão)
  getCars() {
    const { gauge } = CONFIG.rail;
    return this.cars.map((car) => {
      const front = this._railAt(car.start);
      const back = this._railAt(car.start + car.length);

      // Frente do carro aponta para a cabeça; o vetor vai da traseira para a frente
      const fx = front.x - back.x;
      const fz = front.z - back.z;
      const len = Math.hypot(fx, fz) || 1;
      const ux = fx / len;
      const uz = fz / len;
      const heading = Math.atan2(ux, uz);

      const cx = (front.x + back.x) / 2;
      const cz = (front.z + back.z) / 2;
      const cy = (front.y + back.y) / 2;

      // Inclinação: sobe/desce no sentido do carro (positivo = frente mais alta)
      const pitch = -Math.atan2(front.y - back.y, len);

      // Rolagem: desnível entre os dois trilhos (direita = +X local = (uz, -ux))
      const rx = uz;
      const rz = -ux;
      const hR = this.terrain.heightAt(cx + rx * gauge, cz + rz * gauge) + CONFIG.rail.railTop;
      const hL = this.terrain.heightAt(cx - rx * gauge, cz - rz * gauge) + CONFIG.rail.railTop;
      const roll = Math.atan2(hR - hL, 2 * gauge);

      // Eixos: cada um fica sobre o trilho no seu próprio ponto (não no meio do carro)
      const wheelsets = CONFIG.train.wheelsets[car.type].map((zl) => {
        const d = car.start + car.length / 2 - zl;
        const a = this._railAt(d - 0.5);
        const b = this._railAt(d + 0.5);
        const p = this._railAt(d);
        return { x: p.x, y: p.y, z: p.z, heading: Math.atan2(a.x - b.x, a.z - b.z) };
      });

      return {
        type: car.type,
        wheelsets,
        length: car.length,
        x: cx,
        y: cy,
        z: cz,
        heading,
        pitch,
        roll,
        travel: this.travel,
        // Pontos sobre o trilho: frente, meio e traseira (colisão)
        hitPoints: [
          { x: front.x, z: front.z },
          { x: cx, z: cz },
          { x: back.x, z: back.z },
        ],
      };
    });
  }

  collidesWith(vehicle) {
    const reach = CONFIG.train.hitRadius + CONFIG.vehicle.hitRadius;
    for (const car of this.getCars()) {
      for (const p of car.hitPoints) {
        if (Math.hypot(p.x - vehicle.x, p.z - vehicle.z) < reach) return true;
      }
    }
    return false;
  }
}
