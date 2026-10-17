// Veículo (lógica, sem Three.js).
// Não sabe quem dirige: recebe controles de um Driver (jogador ou IA).
// Convenção: heading 0 = +Z; direção = (sin h, cos h). steer > 0 = esquerda.
//
// Modelo de movimento:
//   - A velocidade é um VETOR no mundo (vx, vz), separado da direção do carro (heading).
//   - Componente "para frente" (speed): acelera e freia.
//   - Componente "lateral" (slip): decai pelo agarre. Chuva, neve, lama e o freio de mão
//     reduzem o agarre, então o carro escorrega. Isso faz o clima importar na direção.
//   - Giro: a taxa cai com a velocidade, para a aceleração lateral nunca passar de aLatMax.
import { CONFIG, SURFACES } from '../core/config.js';

const approach = (value, target, maxDelta) => {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Vehicle {
  constructor({ id, terrain, driver }) {
    this.id = id;
    this.terrain = terrain;
    this.driver = driver;

    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.heading = 0;
    this.vx = 0;          // velocidade no mundo
    this.vz = 0;
    this.speed = 0;       // componente para frente (m/s, negativo = ré)
    this.slip = 0;        // componente lateral (m/s)
    this.pitch = 0;
    this.roll = 0;
    this.slope = 0;
    this.surface = 'asfalto';
    this.handbrake = false;
    this.stunTimer = 0;
    this.crashCooldown = 0;
    this.bumpCooldown = 0;
    this.resetCooldown = 0;
  }

  place(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.vx = 0;
    this.vz = 0;
    this.speed = 0;
    this.slip = 0;
    this.stunTimer = 0;
    this.crashCooldown = 0;
    this.bumpCooldown = 0;
    this.handbrake = false;
    this.y = this.terrain.heightAt(x, z) + CONFIG.vehicle.lift;
  }

  get stunned() {
    return this.stunTimer > 0;
  }

  _scaleVelocity(f) {
    this.vx *= f;
    this.vz *= f;
    this.speed *= f;
    this.slip *= f;
  }

  stun(seconds) {
    this.stunTimer = Math.max(this.stunTimer, seconds);
    this._scaleVelocity(0.2);
  }

  // Batida em obstáculo: perde velocidade
  bump(factor = 0.4) {
    this._scaleVelocity(factor);
  }

  // Contato com um obstáculo, com a normal (nx, nz) apontando do obstáculo para o carro.
  // Em vez de multiplicar a velocidade a cada quadro (o carro "grudava" no poste),
  // remove só a parte da velocidade que entra no obstáculo. O resto desliza pela lateral.
  // Devolve a velocidade de impacto (m/s) para a háptica e as regras.
  contact(nx, nz) {
    const into = this.vx * nx + this.vz * nz;
    if (into >= 0) return 0; // já está se afastando
    const e = 0.15; // quique pequeno
    this.vx -= (1 + e) * into * nx;
    this.vz -= (1 + e) * into * nz;
    // Atrito do encosto: perde um pouco da velocidade lateral
    const f = 1 - Math.min(0.25, -into * 0.02);
    this.vx *= f;
    this.vz *= f;
    this._syncAxes();
    return -into;
  }

  // Recalcula speed e slip a partir do vetor velocidade
  _syncAxes() {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    this.speed = this.vx * fx + this.vz * fz;
    this.slip = this.vx * fz - this.vz * fx;
  }

  update(dt, weather) {
    const c = CONFIG.vehicle;
    const t = this.terrain;

    this.surface = t.surfaceAt(this.x, this.z);
    const surf = SURFACES[this.surface];
    const grip = surf.grip * weather.grip;

    if (this.crashCooldown > 0) this.crashCooldown -= dt;
    if (this.bumpCooldown > 0) this.bumpCooldown -= dt;
    if (this.resetCooldown > 0) this.resetCooldown -= dt;

    // 1) Controles (sem controle enquanto atordoado)
    let controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    if (this.stunTimer > 0) this.stunTimer -= dt;
    else controls = this.driver.controls(this, dt);
    const { throttle, brake, steer } = controls;
    this.controls = controls;
    this.handbrake = !!controls.handbrake;

    // 2) Giro: a taxa máxima cai com a velocidade (aceleração lateral limitada)
    const absV = Math.abs(this.speed);
    const yawMax = Math.min(c.steerRate, c.aLatMax / Math.max(absV, 1));
    const speedGate = Math.min(1, absV / 3); // não gira parado
    const understeer = Math.min(1, 0.5 + grip * 0.6); // pouco agarre: curva menos
    const yaw = steer * yawMax * speedGate * understeer * (this.speed >= 0 ? 1 : -1);
    this.heading = wrap(this.heading + yaw * dt);

    // 3) Decompõe a velocidade nos eixos do carro
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = Math.cos(this.heading);
    const rz = -Math.sin(this.heading);
    let vF = this.vx * fx + this.vz * fz;
    let vL = this.vx * rx + this.vz * rz;

    // 4) Acelerar e frear ao longo do carro. Subida reduz a velocidade máxima.
    const slopePenalty = 1 - Math.min(0.6, Math.max(0, this.slope) * 1.5);
    const topSpeed = c.maxSpeed * surf.speedFactor * slopePenalty;
    let target = 0;
    if (throttle > 0) target = topSpeed * throttle;
    else if (throttle < 0) target = -topSpeed * c.reverseFactor * -throttle;

    const traction = Math.min(1, grip + 0.1);
    const rate = throttle !== 0 ? c.accel * traction : c.drag;
    vF = approach(vF, target, rate * dt);
    if (brake > 0) vF = approach(vF, 0, c.brake * brake * Math.min(1, grip + 0.25) * dt);
    if (this.handbrake) vF = approach(vF, 0, c.handbrakeDecel * dt);

    // 5) Agarre lateral: a velocidade lateral decai. Menos agarre = escorrega mais.
    const k = c.lateralGrip * grip * (this.handbrake ? c.handbrakeSlip : 1);
    vL *= Math.exp(-k * dt);
    // Escorregar custa velocidade (arrasto de curva)
    vF = approach(vF, 0, Math.abs(vL) * c.slipDrag * dt);

    this.vx = fx * vF + rx * vL;
    this.vz = fz * vF + rz * vL;
    this.speed = vF;
    this.slip = vL;

    // 6) Movimento, com limite nas bordas do mapa
    let nx = this.x + this.vx * dt;
    let nz = this.z + this.vz * dt;
    // Borda do mapa: para só o movimento que sai do mapa e deixa deslizar ao longo dela
    const lim = t.half - 4;
    if (Math.abs(nx) > lim) {
      nx = Math.sign(nx) * lim;
      this.vx = 0;
    }
    if (Math.abs(nz) > lim) {
      nz = Math.sign(nz) * lim;
      this.vz = 0;
    }
    if (this.vx === 0 || this.vz === 0) this._syncAxes();
    this.x = nx;
    this.z = nz;

    // 7) Suspensão: quatro pontos medem o relevo; altura e inclinação vêm da média
    const wb = c.wheelBase / 2;
    const tr = c.track / 2;
    const hF = t.heightAt(this.x + fx * wb, this.z + fz * wb);
    const hB = t.heightAt(this.x - fx * wb, this.z - fz * wb);
    const hL = t.heightAt(this.x - rx * tr, this.z - rz * tr);
    const hR = t.heightAt(this.x + rx * tr, this.z + rz * tr);

    const targetY = (hF + hB + hL + hR) / 4 + c.lift;
    const maxDy = c.maxVerticalSpeed * dt; // limite de subida/descida: evita voo
    this.y += Math.max(-maxDy, Math.min(maxDy, targetY - this.y));

    this.slope = (hF - hB) / c.wheelBase;
    this.pitch = -Math.atan2(hF - hB, c.wheelBase);
    this.roll = Math.atan2(hR - hL, c.track);
  }
}
