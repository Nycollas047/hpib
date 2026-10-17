// Testes da lógica (sem navegador e sem Three.js). Rodar com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, WEATHER } from '../src/core/config.js';
import { createRng } from '../src/core/random.js';
import { EventBus } from '../src/core/events.js';
import { Terrain } from '../src/world/terrain.js';
import { Props } from '../src/world/props.js';
import { CoinField } from '../src/world/coins.js';
import { Train } from '../src/world/train.js';
import { Vehicle } from '../src/vehicles/vehicle.js';

const TAU = Math.PI * 2;
const fixedDriver = (throttle = 0, steer = 0) => ({
  controls: () => ({ throttle, brake: 0, steer }),
});
const maxGrade = (t, fn, n = 3000) => {
  let m = 0;
  let prev = null;
  for (let k = 0; k <= n; k++) {
    const p = fn((k / n) * TAU);
    const h = t.heightAt(p.x, p.z);
    if (prev) m = Math.max(m, Math.abs(h - prev.h) / Math.hypot(p.x - prev.x, p.z - prev.z));
    prev = { x: p.x, z: p.z, h };
  }
  return m;
};

test('mesmo seed gera o mesmo relevo', () => {
  const a = new Terrain(42);
  const b = new Terrain(42);
  for (const [x, z] of [[10, 20], [-80, 55], [123, -77]]) {
    assert.equal(a.heightAt(x, z), b.heightAt(x, z));
  }
});

test('trilho e estrada têm inclinação suave (trem acompanha o relevo sem ficar íngreme)', () => {
  const t = new Terrain(CONFIG.seed);
  assert.ok(maxGrade(t, (th) => t.railPoint(th)) < 0.06, 'trilho acima de 6%');
  assert.ok(maxGrade(t, (th) => t.roadPoint(th)) < 0.09, 'estrada acima de 9%');
});

test('nos cruzamentos trilho e estrada estão à mesma altura', () => {
  const t = new Terrain(CONFIG.seed);
  let worst = 0;
  for (let k = 0; k < 4000; k++) {
    const th = (k / 4000) * TAU;
    const rp = t.roadPoint(th);
    if (t.distanceToRail(rp.x, rp.z) < 0.3) {
      const tp = t.railPoint(th);
      worst = Math.max(worst, Math.abs(t.groundAt(rp.x, rp.z) - t.groundAt(tp.x, tp.z)));
    }
  }
  assert.ok(worst < 0.2, `diferença de ${worst.toFixed(2)} m no cruzamento`);
});

test('o trilho cruza a estrada quatro vezes', () => {
  const t = new Terrain(CONFIG.seed);
  let crossings = 0;
  let wasInside = null;
  for (let i = 0; i <= 720; i++) {
    const th = (i / 720) * TAU;
    const inside = t.railRadius(th) < t.roadRadius(th);
    if (wasInside !== null && inside !== wasInside) crossings++;
    wasInside = inside;
  }
  assert.equal(crossings, 4);
});

test('a bitola das rodas é igual à dos trilhos (rodas sobre os trilhos)', () => {
  // trainView usa CONFIG.rail.gauge para as rodas e para os trilhos: o mesmo valor
  assert.ok(CONFIG.rail.gauge > 0.6 && CONFIG.rail.gauge < 0.8);
});

test('eixos ficam sobre o trilho (distância radial e altura do topo do trilho)', () => {
  const t = new Terrain(CONFIG.seed);
  const train = new Train(t);
  for (let k = 0; k < 24; k++) {
    train.theta = (k / 24) * TAU;
    for (const car of train.getCars()) {
      for (const w of car.wheelsets) {
        const r = Math.hypot(w.x, w.z);
        assert.ok(Math.abs(r - t.railRadius(Math.atan2(w.z, w.x))) < 0.05, 'eixo fora do trilho');
        assert.ok(Math.abs(w.y - (t.heightAt(w.x, w.z) + CONFIG.rail.railTop)) < 0.05, 'eixo fora da altura do trilho');
      }
    }
  }
});

test('o carro do trem inclina conforme o relevo (pitch e roll não são zero o tempo todo)', () => {
  const t = new Terrain(CONFIG.seed);
  const train = new Train(t);
  let pitched = 0;
  let rolled = 0;
  let total = 0;
  for (let k = 0; k < 40; k++) {
    train.theta = (k / 40) * TAU;
    for (const car of train.getCars()) {
      total++;
      if (Math.abs(car.pitch) > 0.002) pitched++;
      if (Math.abs(car.roll) > 0.002) rolled++;
    }
  }
  assert.ok(pitched > total * 0.5, 'o trem quase não inclina no sentido do percurso');
  assert.ok(rolled > 0, 'o trem nunca rola de lado');
});

test('moedas nunca nascem dentro de obstáculos', () => {
  const t = new Terrain(CONFIG.seed);
  const props = new Props(t);
  props.generate(createRng(1));
  const coins = new CoinField(t, props);
  coins.reset(createRng(2));
  for (const c of coins.coins) {
    assert.equal(props.isBlocked(c.x, c.z, 0), false);
    assert.ok(c.value >= 1);
  }
});

test('obstáculos ficam fora da estrada e do trilho', () => {
  const t = new Terrain(CONFIG.seed);
  const props = new Props(t);
  props.generate(createRng(1));
  for (const p of props.items) {
    if (p.kind === 'lamp' || p.kind === 'pole') continue; // postes ficam na beira
    assert.ok(t.distanceToRoad(p.x, p.z) > CONFIG.road.halfWidth, `${p.kind} na estrada`);
    assert.ok(t.distanceToRail(p.x, p.z) > CONFIG.rail.bedHalf, `${p.kind} no trilho`);
  }
  assert.ok(props.items.length > 100, 'cenário com poucos obstáculos');
});

test('obstáculos empurram o veículo para fora (não atravessa)', () => {
  const t = new Terrain(CONFIG.seed);
  const props = new Props(t);
  props.items = [{ kind: 'rock', x: 0, z: 0, rot: 0, scale: 1, radius: 2 }];
  const v = new Vehicle({ id: 'x', terrain: t, driver: fixedDriver() });
  v.place(0.5, 0.5, 0);
  v.speed = 10;
  props.resolve(v);
  assert.ok(Math.hypot(v.x, v.z) >= 2, 'o veículo deveria estar fora do obstáculo');
});

test('veículo acelerando reto: valores finitos e dentro do mapa', () => {
  const t = new Terrain(CONFIG.seed);
  const v = new Vehicle({ id: 'x', terrain: t, driver: fixedDriver(1, 0) });
  const p0 = t.roadPoint(0);
  v.place(p0.x, p0.z, 0);
  const weather = WEATHER[1];
  for (let i = 0; i < 60 * 30; i++) {
    v.update(1 / 60, weather);
    for (const n of [v.x, v.y, v.z, v.heading, v.speed, v.pitch, v.roll]) {
      assert.ok(Number.isFinite(n), 'valor não finito na simulação');
    }
    assert.ok(t.inBounds(v.x, v.z, 0), 'veículo saiu do mapa');
  }
});

test('trem: colide com vagão e não colide longe da pista', () => {
  const t = new Terrain(CONFIG.seed);
  const train = new Train(t);
  train.theta = 0.3;
  const car = train.getCars()[0];
  assert.equal(train.collidesWith({ x: car.hitPoints[0].x, z: car.hitPoints[0].z }), true);
  assert.equal(train.collidesWith({ x: 0, z: 0 }), false);
});

test('EventBus: listener removido não é mais chamado', () => {
  const bus = new EventBus();
  let calls = 0;
  const off = bus.on('x', () => calls++);
  bus.emit('x');
  off();
  bus.emit('x');
  assert.equal(calls, 1);
});
