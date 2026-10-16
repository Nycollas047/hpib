// Motoristas: quem decide os controles do veículo.
// Jogador e IA têm a mesma interface: controls(vehicle, dt) → { throttle, brake, steer, handbrake }.
// Para trocar a IA, basta criar outro driver com esse método.
import { CONFIG } from '../core/config.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class PlayerDriver {
  constructor(input) {
    this.input = input;
    this.stoppedFor = 0;   // há quanto tempo está parado com o freio apertado
  }

  controls(vehicle, dt = 1 / 60) {
    const c = this.input.read(dt);

    // L2 / S: freia enquanto anda para frente; parado, depois de um instante, vira ré.
    // (A pausa curta evita entrar em ré sem querer ao terminar de frear.)
    if (c.brake > 0 && c.throttle === 0 && vehicle.speed < 0.6) this.stoppedFor += dt;
    else this.stoppedFor = 0;

    if (this.stoppedFor > CONFIG.input.reverseDelay || (c.brake > 0 && c.throttle === 0 && vehicle.speed < -0.2)) {
      return { ...c, throttle: -c.brake, brake: 0 };
    }
    return c;
  }
}

export class AIDriver {
  // getHazards(): lista de sinais do trem [{x, z, state}]; getLead(): moedas à frente do jogador
  constructor({ terrain, props = null, getCoins, getHazards = () => [], getLead = () => 0 }) {
    this.terrain = terrain;
    this.props = props;
    this.getCoins = getCoins;
    this.getHazards = getHazards;
    this.getLead = getLead;
    this.level = CONFIG.ai.defaultLevel;
    this.stuckTime = 0;
    this.reverseTime = 0;
    this.reverseSteer = 1;
    this.skill = CONFIG.ai.levels[this.level];
    this.clock = 0;
    this.stuckEvents = 0;    // quantas vezes ficou preso seguidas (escala a manobra de saída)
    this.freeTime = 0;
    this.targetCoin = null;
    this.skip = new Map();   // moedas desistidas: id → até quando (s)
  }

  reset() {
    this.stuckTime = 0;
    this.reverseTime = 0;
    this.skip.clear();
    this.targetCoin = null;
    this.stuckEvents = 0;
  }

  setLevel(name) {
    if (CONFIG.ai.levels[name] !== undefined) this.level = name;
  }

  // Habilidade efetiva: nível escolhido ± "elástico".
  // Se a IA está muito na frente, perde um pouco de rendimento; se está atrás, ganha um pouco.
  // Assim a partida fica disputada sem a IA "trapacear" de forma visível.
  effectiveSkill() {
    const a = CONFIG.ai;
    const lead = this.getLead(); // placar da IA menos o do jogador
    const adj = lead > 0 ? -Math.min(0.25, lead * a.rubberLead) : Math.min(0.1, -lead * a.rubberTrail);
    return clamp(a.levels[this.level] * (1 + adj), 0.4, 1);
  }

  controls(vehicle, dt) {
    this.clock += dt;
    // Ré temporária para sair de quando ficou preso
    if (this.reverseTime > 0) {
      this.reverseTime -= dt;
      return { throttle: -1, brake: 0, steer: this.reverseSteer, handbrake: false };
    }

    this.skill = this.effectiveSkill();
    const target = this._target(vehicle);
    const desired = Math.atan2(target.x - vehicle.x, target.z - vehicle.z);
    const diff = wrap(desired - vehicle.heading);
    const steer = clamp(diff * 2 + this._avoid(vehicle, target), -1, 1);

    // Menos gás em curva fechada; a habilidade limita a velocidade para o jogador ter chance
    let throttle = (1 - Math.min(1, Math.abs(diff)) * 0.6) * this.skill;
    let brake = 0;

    // Trem: para antes do cruzamento quando o sinal não está verde
    const stop = this._trainStop(vehicle);
    if (stop) {
      throttle = 0;
      brake = stop;
    }

    // Preso: quer andar e não anda por 1 s → dá ré com volante oposto
    if (vehicle.speed < 1 && throttle > 0.3) this.stuckTime += dt;
    else this.stuckTime = 0;

    if (vehicle.speed > 4) this.freeTime += dt;
    else this.freeTime = 0;
    if (this.freeTime > 5) this.stuckEvents = 0;

    if (this.stuckTime > 1) {
      this.stuckTime = 0;
      this.stuckEvents++;
      // Presa de novo no mesmo lugar: ré mais longa e volante para o outro lado a cada tentativa
      this.reverseTime = Math.min(3, 1 + 0.6 * (this.stuckEvents - 1));
      // Desiste da moeda que a levou até aqui (ela pode estar atrás de um "paredão" de árvores)
      if (this.targetCoin) this.skip.set(this.targetCoin.id, this.clock + 25);
      this.reverseSteer = this.stuckEvents % 2 ? (steer >= 0 ? -1 : 1) : (steer >= 0 ? 1 : -1);
    }

    return { throttle, brake, steer, handbrake: false };
  }

  // Desvio de obstáculos: árvores, pedras, casas e postes à frente empurram a direção para o lado
  // contrário. Antes a IA só olhava para a moeda e travava em árvores (1 vez por partida).
  _avoid(vehicle, target) {
    if (!this.props) return 0;
    const closing = Math.hypot(target.x - vehicle.x, target.z - vehicle.z) < 14; // chegando na moeda
    const fx = Math.sin(vehicle.heading);
    const fz = Math.cos(vehicle.heading);
    const look = 7 + Math.abs(vehicle.speed) * 0.7;
    let push = 0;
    for (const p of this.props.items) {
      const dx = p.x - vehicle.x;
      const dz = p.z - vehicle.z;
      const ahead = dx * fx + dz * fz;
      if (ahead < -1.5 || ahead > look + p.radius) continue; // inclui o que está encostado ao lado
      const lateral = dx * fz - dz * fx; // > 0: obstáculo à esquerda
      const room = p.radius + CONFIG.vehicle.hitRadius + 0.8;
      if (Math.abs(lateral) > room) continue;
      // Obstáculo colado na moeda que está sendo pegada: não repele (senão a IA fica parada em volta dela)
      if (closing && Math.hypot(p.x - target.x, p.z - target.z) < p.radius + 4) continue;
      const w = (1 - Math.max(0, ahead) / (look + p.radius)) * (1 - Math.abs(lateral) / room);
      push -= (lateral >= 0 ? 1 : -1) * w * 2.5;
    }
    return clamp(push, -1.2, 1.2);
  }

  // Devolve a força do freio (0 a 1) se há sinal fechado à frente, ou 0
  _trainStop(vehicle) {
    const fx = Math.sin(vehicle.heading);
    const fz = Math.cos(vehicle.heading);
    for (const h of this.getHazards()) {
      if (h.state === 'green') continue;
      const dx = h.x - vehicle.x;
      const dz = h.z - vehicle.z;
      const d = Math.hypot(dx, dz);
      const ahead = (dx * fx + dz * fz) / (d || 1);
      if (ahead < 0.5 || d > CONFIG.ai.trainStopDistance || d < 7) continue;
      // Velocidade máxima para ainda conseguir parar a 6 m do cruzamento (freio de ~12 m/s²)
      const vMax = Math.sqrt(2 * 12 * Math.max(0, d - 6));
      if (vehicle.speed > vMax) return 1;
      if (d < 14) return 0.6; // já devagar: segura onde está
    }
    return 0;
  }

  // Moeda boa e perto tem prioridade; senão, segue a estrada à frente.
  // Nota = valor / (distância + 12): prefere a de valor alto, mas não cruza o mapa por ela.
  _target(vehicle) {
    let best = null;
    let bestScore = 0;
    const hazards = this.getHazards().filter((h) => h.state !== 'green');
    for (const coin of this.getCoins()) {
      const d = Math.hypot(coin.x - vehicle.x, coin.z - vehicle.z);
      if (d > CONFIG.ai.coinSight) continue;
      if ((this.skip.get(coin.id) ?? 0) > this.clock) continue;
      if (hazards.some((h) => Math.hypot(h.x - coin.x, h.z - coin.z) < 16)) continue; // moeda perto do trem
      const score = coin.value / (d + 12);
      if (score > bestScore) {
        best = coin;
        bestScore = score;
      }
    }
    this.targetCoin = best;
    if (best) return best;

    const { theta } = this.terrain.polar(vehicle.x, vehicle.z);
    return this.terrain.roadPoint(theta + CONFIG.ai.roadLookahead);
  }
}
