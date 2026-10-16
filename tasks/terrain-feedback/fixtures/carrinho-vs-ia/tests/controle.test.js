// Testes do controle, colisão deslizante, trem/sinais, moedas por zona, IA e partida.
// Rodam no Node, sem navegador: o controle é simulado com objetos no formato da Gamepad API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/core/config.js';
import { createRng } from '../src/core/random.js';
import { EventBus } from '../src/core/events.js';
import { Terrain } from '../src/world/terrain.js';
import { Props } from '../src/world/props.js';
import { CoinField, MAX_COIN_VALUE } from '../src/world/coins.js';
import { Train } from '../src/world/train.js';
import { Vehicle } from '../src/vehicles/vehicle.js';
import { PlayerDriver, AIDriver } from '../src/vehicles/drivers.js';
import { Match } from '../src/gameplay/match.js';
import { shapeStick, steerCurve, shapeTrigger, readPad } from '../src/input/input.js';

const terrain = new Terrain(CONFIG.seed);
const props = new Props(terrain);
props.generate(createRng(CONFIG.seed + 1));
const weather = { grip: 1, hapticWeak: 0 };
const idle = { controls: () => ({ throttle: 0, brake: 0, steer: 0, handbrake: false }) };

// Controle falso no formato da Gamepad API: 17 botões, 4 eixos
function fakePad({ axes = [0, 0, 0, 0], buttons = {} } = {}) {
  const b = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  for (const [i, v] of Object.entries(buttons)) b[i] = { pressed: v > 0.5, value: v };
  return { axes, buttons: b };
}

// ---------- Entrada ----------
test('analógico: zona morta radial (diagonal pequena não gera direção)', () => {
  const dz = CONFIG.input.stickDeadzone;
  assert.deepEqual(shapeStick(dz * 0.6, dz * 0.6), { x: 0, y: 0 });
  assert.deepEqual(shapeStick(0, dz * 0.99), { x: 0, y: 0 });
  const full = shapeStick(1, 0);
  assert.ok(Math.abs(full.x - 1) < 1e-9, 'analógico no limite = 100%');
  const diag = shapeStick(0.75, 0.75);
  assert.ok(Math.hypot(diag.x, diag.y) <= 1 + 1e-9, 'diagonal nunca passa de 100%');
});

test('analógico: sem salto na saída da zona morta e resposta crescente', () => {
  const dz = CONFIG.input.stickDeadzone;
  assert.ok(shapeStick(dz + 0.01, 0).x < 0.02, 'logo após a zona morta o valor ainda é quase zero');
  let prev = -1;
  for (let v = 0; v <= 1.0001; v += 0.05) {
    const x = shapeStick(v, 0).x;
    assert.ok(x >= prev - 1e-12);
    prev = x;
  }
});

test('curva de direção: centro mais fino, extremos iguais, sinal preservado', () => {
  assert.ok(steerCurve(0.5) < 0.5);
  assert.equal(steerCurve(1), 1);
  assert.equal(steerCurve(-1), -1);
  assert.equal(steerCurve(0), 0);
  assert.ok(steerCurve(-0.5) < 0 && Math.abs(steerCurve(-0.5)) === steerCurve(0.5));
});

test('gatilhos: zona morta e escala completa', () => {
  assert.equal(shapeTrigger(0.02), 0);
  assert.equal(shapeTrigger(1), 1);
  assert.ok(shapeTrigger(0.5) > 0.4 && shapeTrigger(0.5) < 0.6);
});

test('mapeamento do DualSense: R2, L2, freio de mão, reset, pausa e direção', () => {
  const p = readPad(fakePad({ axes: [1, 0, 0, 0], buttons: { 7: 1, 6: 0.6, 2: 1, 3: 1, 9: 1 } }));
  assert.equal(p.throttle, 1);
  assert.ok(p.brake > 0.5 && p.brake < 0.7);
  assert.ok(p.handbrake && p.reset && p.pause);
  assert.ok(p.steer < -0.9, 'analógico para a direita = steer negativo');
  const q = readPad(fakePad({ axes: [-1, 0, 0, 0], buttons: { 5: 1 } }));
  assert.ok(q.steer > 0.9 && q.handbrake, 'R1 também é freio de mão');
  const cam = readPad(fakePad({ axes: [0, 0, 1, 0], buttons: { 11: 1 } }));
  assert.ok(cam.camX > 0.9 && cam.lookBack);

  // Aceleração pelo analógico esquerdo para frente (axes[1] < 0), botão X (0) e D-Pad (12..15)
  const stickFwd = readPad(fakePad({ axes: [0, -1, 0, 0] }));
  assert.ok(stickFwd.throttle > 0.9, 'empurrar o analógico esquerdo para frente acelera');
  const stickBack = readPad(fakePad({ axes: [0, 1, 0, 0] }));
  assert.ok(stickBack.brake > 0.9, 'puxar o analógico esquerdo para trás freia');
  const btnX = readPad(fakePad({ buttons: { 0: 1, 14: 1 } }));
  assert.equal(btnX.throttle, 1, 'botão Cruz (X) também acelera');
  assert.equal(btnX.steer, 1, 'D-Pad esquerda esterça para a esquerda');
});

test('PlayerDriver: L2 freia andando e dá ré só depois de parar um instante', () => {
  const input = { read: () => ({ throttle: 0, brake: 1, steer: 0, handbrake: false }) };
  const d = new PlayerDriver(input);
  const car = { speed: 15 };
  let c = d.controls(car, 1 / 60);
  assert.equal(c.brake, 1);
  assert.equal(c.throttle, 0, 'andando para frente: só freia');
  car.speed = 0;
  c = d.controls(car, 1 / 60);
  assert.equal(c.throttle, 0, 'logo ao parar ainda não dá ré');
  for (let i = 0; i < 30; i++) c = d.controls(car, 1 / 60);
  assert.equal(c.throttle, -1, 'depois de 0,25 s parado entra em ré');
  assert.equal(c.brake, 0);
});

// ---------- Colisão deslizante ----------
function hit(dx, dz) {
  const car = new Vehicle({ id: 'a', terrain, driver: idle });
  const p = terrain.roadPoint(0);
  car.place(p.x, p.z, 0);
  const wall = new Props(terrain);
  wall.items = [{ kind: 'rock', x: car.x + dx, z: car.z + dz, radius: 1.1 }];
  car.vx = 0; car.vz = 20; car.speed = 20; // 20 m/s para +Z
  const impact = wall.resolve(car);
  return { car, wall, impact };
}

test('batida de raspão: desliza ao longo do obstáculo e mantém a velocidade', () => {
  const { car, wall, impact } = hit(2.2, 0.5); // obstáculo ao lado
  assert.ok(impact > 0, 'houve impacto');
  assert.ok(car.vz > 15, `manteve ${car.vz.toFixed(1)} m/s para frente (antes: x0,4 = 8 m/s)`);
  assert.ok(car.vx < 0, 'foi empurrado para longe do obstáculo');
  const vz1 = car.vz;
  assert.equal(wall.resolve(car), 0, 'já se afastando: sem novo impacto');
  assert.ok(car.vz >= vz1 - 1e-6, 'sem perda extra no quadro seguinte');
});

test('batida de frente: perde quase toda a velocidade e é empurrado para trás', () => {
  const { car, impact } = hit(0, 2.0);
  assert.ok(impact > 15, `impacto ${impact.toFixed(1)} m/s`);
  assert.ok(car.vz < 5, 'parou quase tudo');
});

test('borda do mapa: o carro desliza e não atravessa nem trava', () => {
  const car = new Vehicle({ id: 'a', terrain, driver: { controls: () => ({ throttle: 1, brake: 0, steer: 0, handbrake: false }) } });
  car.place(0, terrain.half - 30, 0.3); // indo para a borda +Z com um pouco de +X
  for (let i = 0; i < 600; i++) car.update(1 / 60, weather);
  const lim = terrain.half - 4;
  assert.ok(Math.abs(car.z) <= lim + 1e-6 && Math.abs(car.x) <= lim + 1e-6);
  assert.ok(Number.isFinite(car.x) && Number.isFinite(car.speed));
  assert.ok(car.x > 5, 'continuou deslizando ao longo da borda');
});

// ---------- Direção ----------
test('direção: aceleração lateral nunca passa de aLatMax em qualquer velocidade', () => {
  const car = new Vehicle({ id: 'a', terrain, driver: { controls: () => ({ throttle: 1, brake: 0, steer: 1, handbrake: false }) } });
  const p = terrain.roadPoint(0);
  car.place(p.x, p.z, 0);
  let worst = 0, prevH = car.heading;
  for (let i = 0; i < 900; i++) {
    car.update(1 / 60, weather);
    let dh = car.heading - prevH;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    worst = Math.max(worst, Math.abs(dh * 60 * car.speed));
    prevH = car.heading;
  }
  assert.ok(worst <= CONFIG.vehicle.aLatMax * 1.05, `aceleração lateral ${worst.toFixed(1)} m/s²`);
});

test('freio de mão: o carro escorrega mais e perde velocidade', () => {
  const run = (hand) => {
    const car = new Vehicle({
      id: 'a', terrain,
      driver: { controls: (v, dt) => ({ throttle: car.t < 3 ? 1 : 0, brake: 0, steer: car.t > 2 ? 0.6 : 0, handbrake: hand && car.t > 2 }) },
    });
    car.t = 0;
    const p = terrain.roadPoint(0);
    car.place(p.x, p.z, 0);
    let maxSlip = 0;
    for (let i = 0; i < 300; i++) { car.t += 1 / 60; car.update(1 / 60, weather); maxSlip = Math.max(maxSlip, Math.abs(car.slip)); }
    return { maxSlip, speed: car.speed };
  };
  const normal = run(false);
  const hand = run(true);
  assert.ok(hand.maxSlip > normal.maxSlip * 1.5, `escorregou ${hand.maxSlip.toFixed(1)} vs ${normal.maxSlip.toFixed(1)}`);
  assert.ok(hand.speed < normal.speed);
});

// ---------- Trem e sinais ----------
test('trem: velocidade constante em todo o trilho (distância real, não ângulo)', () => {
  const tr = new Train(terrain);
  let prev = tr._railAt(0);
  let min = Infinity, max = 0;
  for (let i = 0; i < 60 * 80; i++) {
    tr.update(1 / 60);
    const c = tr._railAt(0);
    const v = Math.hypot(c.x - prev.x, c.z - prev.z) * 60;
    prev = c;
    if (i > 2) { min = Math.min(min, v); max = Math.max(max, v); }
  }
  assert.ok(min > CONFIG.train.speed * 0.98 && max < CONFIG.train.speed * 1.02, `${min.toFixed(2)}–${max.toFixed(2)} m/s`);
});

test('sinais: vermelho sempre que o trem encosta no cruzamento, aviso com 6 s de antecedência', () => {
  const tr = new Train(terrain);
  assert.equal(tr.crossings.length, 4);
  let warned = 0, wrong = 0;
  let last = tr.signals().map((s) => s.state);
  for (let i = 0; i < 60 * 300; i++) {
    tr.update(1 / 60);
    tr.signals().forEach((s, k) => {
      if (tr.collidesWith({ x: s.x, z: s.z }) && s.state !== 'red') wrong++;
      if (last[k] === 'green' && s.state === 'warn') {
        warned++;
        assert.ok(Math.abs(s.eta - CONFIG.train.warnSeconds) < 0.1);
      }
      last[k] = s.state;
    });
  }
  assert.equal(wrong, 0, 'nenhuma colisão com sinal que não estivesse vermelho');
  assert.ok(warned >= 8, 'o aviso apareceu várias vezes');
});

test('trem: theta pode ser definido e lido (compatibilidade)', () => {
  const tr = new Train(terrain);
  tr.theta = 2.0;
  assert.ok(Math.abs(tr.theta - 2.0) < 1e-3);
});

// ---------- Moedas por zona ----------
test('moedas: todas as zonas aparecem, valores de 1 a 4, longe dos carros e entre si', () => {
  const zones = {};
  const cars = [{ x: terrain.roadPoint(0).x, z: terrain.roadPoint(0).z }, { x: terrain.roadPoint(Math.PI).x, z: terrain.roadPoint(Math.PI).z }];
  for (let s = 0; s < 40; s++) {
    const cf = new CoinField(terrain, props);
    cf.reset(createRng(100 + s), cars);
    for (const c of cf.coins) {
      zones[c.zone] = (zones[c.zone] || 0) + 1;
      assert.ok(c.value >= 1 && c.value <= MAX_COIN_VALUE);
      for (const v of cars) assert.ok(Math.hypot(c.x - v.x, c.z - v.z) >= CONFIG.coins.minFromVehicle - 1e-6);
    }
    for (let i = 0; i < cf.coins.length; i++) {
      for (let j = i + 1; j < cf.coins.length; j++) {
        const a = cf.coins[i], b = cf.coins[j];
        assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= CONFIG.coins.minSpacing - 1e-6);
      }
    }
  }
  for (const z of Object.keys(CONFIG.coins.zones)) assert.ok(zones[z] > 0, `zona ${z} nunca apareceu`);
  const total = Object.values(zones).reduce((a, b) => a + b, 0);
  assert.ok(zones.road / total > 0.35, 'a estrada recebe boa parte das moedas');
});

test('moedas: zonas de risco valem mais que a estrada', () => {
  const cf = new CoinField(terrain, props);
  const sum = { road: [0, 0], risk: [0, 0] };
  for (let s = 0; s < 40; s++) {
    cf.reset(createRng(300 + s));
    for (const c of cf.coins) if (sum[c.zone]) { sum[c.zone][0] += c.value; sum[c.zone][1]++; }
  }
  const avg = (z) => sum[z][0] / sum[z][1];
  assert.ok(avg('risk') > avg('road') + 0.8, `risco ${avg('risk').toFixed(2)} vs estrada ${avg('road').toFixed(2)}`);
});

// ---------- IA ----------
test('IA: níveis ordenados e elástico limitado', () => {
  let lead = 0;
  const ai = new AIDriver({ terrain, getCoins: () => [], getLead: () => lead });
  ai.setLevel('facil'); const f = ai.effectiveSkill();
  ai.setLevel('normal'); const n = ai.effectiveSkill();
  ai.setLevel('dificil'); const d = ai.effectiveSkill();
  assert.ok(f < n && n < d);
  lead = 1000; // IA muito na frente: perde no máximo 25%
  assert.ok(ai.effectiveSkill() >= CONFIG.ai.levels.dificil * 0.75 - 1e-9);
  lead = -1000; // IA muito atrás: ganha no máximo 10%, e nunca passa de 1
  ai.setLevel('normal');
  assert.ok(ai.effectiveSkill() <= 1 && ai.effectiveSkill() > CONFIG.ai.levels.normal);
});

test('IA: para antes do cruzamento com sinal fechado', () => {
  const x = terrain.roadPoint(0.6);
  const crossing = { x: x.x, z: x.z, state: 'red' };
  const ai = new Vehicle({
    id: 'ai', terrain,
    driver: new AIDriver({ terrain, getCoins: () => [], getHazards: () => [crossing] }),
  });
  const start = terrain.roadPoint(0.6 - 0.5);
  const a = terrain.roadPoint(0.6 - 0.5 + 0.01);
  ai.place(start.x, start.z, Math.atan2(a.x - start.x, a.z - start.z));
  let minDist = Infinity;
  for (let i = 0; i < 60 * 25; i++) {
    ai.update(1 / 60, weather);
    minDist = Math.min(minDist, Math.hypot(ai.x - crossing.x, ai.z - crossing.z));
  }
  assert.ok(minDist > 5, `parou a ${minDist.toFixed(1)} m do cruzamento`);
  assert.ok(Math.abs(ai.speed) < 1, 'ficou parada esperando');
});

// ---------- Partida ----------
function makeMatch() {
  const bus = new EventBus();
  const train = new Train(terrain);
  const coins = new CoinField(terrain, props);
  const player = new Vehicle({ id: 'player', terrain, driver: idle });
  const ai = new Vehicle({ id: 'ai', terrain, driver: new AIDriver({ terrain, getCoins: () => coins.coins }) });
  const match = new Match({ bus, terrain, coins, props, train, player, ai });
  return { bus, match, player, ai, coins, train };
}

test('partida: pausa congela tempo, carros e trem', () => {
  const { match, player, train } = makeMatch();
  match.start();
  for (let i = 0; i < 120; i++) match.update(1 / 60);
  match.pause();
  assert.equal(match.state, 'paused');
  const t = match.timeLeft, s = train.s;
  for (let i = 0; i < 120; i++) match.update(1 / 60);
  assert.equal(match.timeLeft, t);
  assert.equal(train.s, s);
  match.resume();
  match.update(1 / 60);
  assert.ok(match.timeLeft < t);
});

test('voltar à pista: leva ao eixo da estrada, custa moeda e tem espera', () => {
  const { match, player } = makeMatch();
  match.start();
  match.scores.player = 5;
  player.place(10, 10, 1.0); // fora da pista
  assert.ok(terrain.distanceToRoad(player.x, player.z) > CONFIG.road.halfWidth);
  assert.equal(match.resetToRoad(player), true);
  assert.ok(terrain.distanceToRoad(player.x, player.z) < 0.5);
  assert.equal(match.scores.player, 5 - CONFIG.match.resetPenalty);
  assert.equal(player.speed, 0);
  player.place(10, 10, 1.0);
  player.resetCooldown = CONFIG.match.resetCooldown;
  assert.equal(match.resetToRoad(player), false, 'durante a espera não funciona');
});

test('voltar à pista: mantém o sentido em que o carro estava virado', () => {
  const { match, player } = makeMatch();
  match.start();
  const p = terrain.roadPoint(1.0);
  const q = terrain.roadPoint(1.01);
  const along = Math.atan2(q.x - p.x, q.z - p.z);
  player.place(p.x + 20, p.z, along + Math.PI); // virado no sentido contrário
  match.resetToRoad(player);
  const d = Math.atan2(Math.sin(player.heading - (along + Math.PI)), Math.cos(player.heading - (along + Math.PI)));
  assert.ok(Math.abs(d) < 0.3, 'continua virado no sentido horário');
});

test('partida completa: 210 s com IA, tudo finito, eventos de coleta e batida emitidos', () => {
  const { bus, match, player, ai } = makeMatch();
  let collected = 0, bumps = 0;
  bus.on('coin:collected', () => collected++);
  bus.on('vehicle:bump', () => bumps++);
  match.start();
  // jogador "anda reto" com um motorista simples para forçar encontros com obstáculos
  player.driver = { controls: () => ({ throttle: 1, brake: 0, steer: 0.15, handbrake: false }) };
  while (match.state === 'playing') {
    match.update(1 / 60);
    for (const v of [player, ai]) assert.ok(Number.isFinite(v.x + v.z + v.speed + v.slip + v.y + v.heading));
  }
  assert.equal(match.state, 'ended');
  assert.ok(collected > 20, `coletas: ${collected}`);
  assert.ok(Number.isFinite(bumps));
});
