// Partida: regras, rodadas e placar (lógica, sem Three.js e sem teclado).
// Estados: 'ready' (esperando começar) → 'playing' ⇄ 'paused' → 'ended' → (reinício) → 'playing'.
import { CONFIG, WEATHER } from '../core/config.js';
import { createRng } from '../core/random.js';

const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Match {
  constructor({ bus, terrain, coins, props, train, player, ai }) {
    this.bus = bus;
    this.terrain = terrain;
    this.coins = coins;
    this.props = props;
    this.train = train;
    this.player = player;
    this.ai = ai;

    this.state = 'ready';
    this.round = 0;
    this.timeLeft = CONFIG.match.roundSeconds;
    this.scores = { player: 0, ai: 0 };
    this.wins = { player: 0, ai: 0 };
    this.weather = WEATHER[0];
    this.signals = train.signals(); // estado atual dos sinais do trem

    // Posição inicial visível já na tela de "pressione para começar"
    this.placeOnRoad(player, 0);
    this.placeOnRoad(ai, Math.PI);
  }

  // Coloca o veículo na estrada, virado no sentido anti-horário
  placeOnRoad(vehicle, theta) {
    const p = this.terrain.roadPoint(theta);
    vehicle.place(p.x, p.z, wrap(-theta));
  }

  // Volta o veículo para o ponto mais próximo da estrada, no sentido que ele já estava seguindo.
  // Custa moedas e tem tempo de espera, para não virar atalho. Devolve true se aconteceu.
  resetToRoad(vehicle) {
    if (this.state !== 'playing' || vehicle.resetCooldown > 0 || vehicle.stunned) return false;
    const t = this.terrain;
    const { theta } = t.polar(vehicle.x, vehicle.z);
    const a = t.roadPoint(theta);
    const b = t.roadPoint(theta + 0.01);
    const along = Math.atan2(b.x - a.x, b.z - a.z); // sentido anti-horário
    // Escolhe o sentido (horário ou anti-horário) mais próximo de onde o carro olha
    const heading =
      Math.abs(wrap(along - vehicle.heading)) <= Math.PI / 2 ? along : wrap(along + Math.PI);
    vehicle.place(a.x, a.z, heading);
    vehicle.resetCooldown = CONFIG.match.resetCooldown;
    this.scores[vehicle.id] = Math.max(0, this.scores[vehicle.id] - CONFIG.match.resetPenalty);
    this.bus.emit('vehicle:reset', { vehicle });
    return true;
  }

  // Sinal fechado (aviso ou vermelho) mais próximo do veículo; null se todos estão verdes
  hazardFor(vehicle) {
    let best = null;
    for (const s of this.signals) {
      if (s.state === 'green') continue;
      const dist = Math.hypot(s.x - vehicle.x, s.z - vehicle.z);
      if (!best || dist < best.dist) best = { ...s, dist };
    }
    return best;
  }

  start() {
    this.round += 1;
    const rng = createRng(CONFIG.seed + this.round * 7919);

    this.weather = WEATHER[(this.round - 1) % WEATHER.length];
    this.train.theta = rng() * TAU;

    this.scores = { player: 0, ai: 0 };
    this.timeLeft = CONFIG.match.roundSeconds;
    this.placeOnRoad(this.player, 0);
    this.placeOnRoad(this.ai, Math.PI);
    this.player.resetCooldown = 0;
    this.ai.resetCooldown = 0;
    this.coins.reset(rng, [this.player, this.ai]); // moedas nascem longe dos carros
    this.ai.driver.reset?.();
    this.signals = this.train.signals();

    this.state = 'playing';
    this.bus.emit('weather:change', { profile: this.weather });
    this.bus.emit('match:start', { round: this.round });
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.bus.emit('match:pause', {});
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.bus.emit('match:resume', {});
  }

  // Passo fixo de simulação: a ordem abaixo importa
  update(dt) {
    if (this.state !== 'playing') return;

    this.timeLeft -= dt;
    const vehicles = [this.player, this.ai];

    // 1) Veículos andam; depois são empurrados para fora de obstáculos (e deslizam nelas)
    for (const v of vehicles) {
      v.update(dt, this.weather);
      const impact = this.props.resolve(v);
      if (impact > CONFIG.match.bumpMinSpeed && v.bumpCooldown <= 0) {
        v.bumpCooldown = CONFIG.match.bumpCooldown; // um aviso por batida, não um por quadro
        this.bus.emit('vehicle:bump', { vehicle: v, impact });
      }
    }

    // 2) Trem anda, sinais atualizam e colisão é verificada
    this.train.update(dt);
    this.signals = this.train.signals();
    for (const v of vehicles) {
      if (v.crashCooldown <= 0 && this.train.collidesWith(v)) {
        v.crashCooldown = CONFIG.match.crashCooldown;
        v.stun(CONFIG.match.stunSeconds);
        this.scores[v.id] = Math.max(0, this.scores[v.id] - CONFIG.match.trainPenalty);
        this.bus.emit('vehicle:crash', { vehicle: v });
      }
    }

    // 3) Moedas
    this.coins.update(dt, vehicles, (vehicle, coin) => {
      this.scores[vehicle.id] += coin.value;
      this.bus.emit('coin:collected', { vehicle, value: coin.value, coin });
    });

    if (this.timeLeft <= 0) this._end();
  }

  _end() {
    this.state = 'ended';
    this.timeLeft = 0;

    const { player, ai } = this.scores;
    const winner = player === ai ? 'draw' : player > ai ? 'player' : 'ai';
    if (winner !== 'draw') this.wins[winner] += 1;

    this.bus.emit('match:end', { scores: { ...this.scores }, winner });
  }
}
