// Análise do design do mapa: mede como o mapa funciona como espaço de jogo.
// Uso: node tools/map-analysis.mjs   → escreve docs/analise-mapa.json
// Depois: python3 tools/plot-map.py   → desenha docs/mapa-analise.png
import { writeFileSync, mkdirSync } from 'node:fs';
import { CONFIG } from '../src/core/config.js';
import { createRng } from '../src/core/random.js';
import { EventBus } from '../src/core/events.js';
import { Terrain } from '../src/world/terrain.js';
import { Props } from '../src/world/props.js';
import { CoinField } from '../src/world/coins.js';
import { Train } from '../src/world/train.js';
import { Vehicle } from '../src/vehicles/vehicle.js';
import { AIDriver } from '../src/vehicles/drivers.js';
import { Match } from '../src/gameplay/match.js';

const TAU = Math.PI * 2;
const pct = (n, d) => Math.round((1000 * n) / d) / 10;
const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const rnd = (v, k = 1) => Math.round(v * 10 ** k) / 10 ** k;

function build(seedOffset = 0) {
  const terrain = new Terrain(CONFIG.seed + seedOffset);
  const props = new Props(terrain);
  props.generate(createRng(CONFIG.seed + 1 + seedOffset));
  return { terrain, props };
}

const { terrain, props } = build(0);
const out = { config: { world: CONFIG.world.size, coins: CONFIG.coins.alive, maxSpeed: CONFIG.vehicle.maxSpeed } };

// ---------- 1. Geometria e uso do espaço ----------
{
  let roadLen = 0, railLen = 0, pr = null, pt = null;
  const roadLine = [], railLine = [];
  const crossings = [];
  let prevSign = null;
  const N = 6000;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * TAU;
    const r = terrain.roadPoint(th), t = terrain.railPoint(th);
    if (pr) { roadLen += Math.hypot(r.x - pr.x, r.z - pr.z); railLen += Math.hypot(t.x - pt.x, t.z - pt.z); }
    pr = r; pt = t;
    if (i % 20 === 0) { roadLine.push([r.x, r.z]); railLine.push([t.x, t.z]); }
    const sign = terrain.railRadius(th) < terrain.roadRadius(th);
    if (prevSign !== null && sign !== prevSign) crossings.push({ theta: th, x: r.x, z: r.z });
    prevSign = sign;
  }

  // Uso do espaço: classifica a grade 2 m
  const cls = { estrada: 0, faixa_moedas: 0, interior: 0, exterior: 0 };
  let total = 0;
  const half = CONFIG.world.size / 2 - 8;
  for (let x = -half; x <= half; x += 2) {
    for (let z = -half; z <= half; z += 2) {
      total++;
      const { r, theta } = terrain.polar(x, z);
      const d = r - terrain.roadRadius(theta);
      if (Math.abs(d) <= CONFIG.road.halfWidth) cls.estrada++;
      else if (Math.abs(d) <= 18) cls.faixa_moedas++;
      else if (d < 0) cls.interior++;
      else cls.exterior++;
    }
  }
  out.geometria = {
    comprimentoEstradaM: rnd(roadLen, 0),
    comprimentoTrilhoM: rnd(railLen, 0),
    voltaEmSegundos: rnd(roadLen / CONFIG.vehicle.maxSpeed, 1),
    cruzamentos: crossings.length,
    usoDoMapaPct: Object.fromEntries(Object.entries(cls).map(([k, v]) => [k, pct(v, total)])),
  };
  out._mapa = { roadLine, railLine, crossings };
}

// ---------- 2. Onde as moedas nascem ----------
{
  const bands = { estrada: 0, perto_3_10: 0, longe_10_18: 0, mais_de_18: 0 };
  const zonas = {};
  const valores = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const surf = {};
  const values = [];
  const pts = [];
  let n = 0, steep = 0;
  for (let s = 0; s < 80; s++) {
    const { terrain: t, props: p } = build(s % 4); // 4 mapas diferentes
    const cf = new CoinField(t, p);
    cf.reset(createRng(500 + s));
    for (const c of cf.coins) {
      n++;
      const { r, theta } = t.polar(c.x, c.z);
      const off = Math.abs(r - t.roadRadius(theta));
      if (off <= CONFIG.road.halfWidth) bands.estrada++;
      else if (off <= 10) bands.perto_3_10++;
      else if (off <= 18) bands.longe_10_18++;
      else bands.mais_de_18++;
      zonas[c.zone] = (zonas[c.zone] || 0) + 1;
      valores[c.value]++;
      surf[c.surface] = (surf[c.surface] || 0) + 1;
      values.push(c.value);
      const slope = Math.abs(t.heightAt(c.x + 1.5, c.z) - t.heightAt(c.x - 1.5, c.z)) / 3;
      if (slope > 0.15) steep++;
      if (s % 4 === 0 && s < 24) pts.push([c.x, c.z, c.value, c.zone]);
    }
  }
  out.moedas = {
    amostras: n,
    faixaPct: Object.fromEntries(Object.entries(bands).map(([k, v]) => [k, pct(v, n)])),
    zonaPct: Object.fromEntries(Object.entries(zonas).map(([k, v]) => [k, pct(v, n)])),
    valorPct: Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, pct(v, n)])),
    superficiePct: Object.fromEntries(Object.entries(surf).map(([k, v]) => [k, pct(v, n)])),
    valorMedio: rnd(avg(values), 2),
    emEncostaIngremePct: pct(steep, n),
  };
  out._mapa.coinSpawns = pts;
}

// ---------- 3. Simulação de partidas: quem faz o quê ----------
function simulate(seedOffset, sight, seconds = 180) {
  const { terrain: t, props: p } = build(seedOffset);
  const coins = new CoinField(t, p);
  const train = new Train(t);
  const bus = new EventBus();
  const idle = { controls: () => ({ throttle: 0, brake: 0, steer: 0 }) };
  const player = new Vehicle({ id: 'player', terrain: t, driver: idle });
  const ai = new Vehicle({ id: 'ai', terrain: t, driver: new AIDriver({ terrain: t, props: p, getCoins: () => coins.coins }) });
  const match = new Match({ bus, terrain: t, coins, props: p, train, player, ai });
  const saved = CONFIG.ai.coinSight;
  CONFIG.ai.coinSight = sight;
  // O jogador fica parado nesta medição: sem desligar o elástico, a IA seria sempre freada por "estar na frente"
  const rubber = [CONFIG.ai.rubberLead, CONFIG.ai.rubberTrail];
  CONFIG.ai.rubberLead = 0; CONFIG.ai.rubberTrail = 0;

  const res = { coins: 0, valor: 0, faixa: { estrada: 0, perto: 0, longe: 0 }, crashes: 0, stuck: [], pickups: [], times: [] };
  let last = CONFIG.match.roundSeconds;
  bus.on('coin:collected', ({ vehicle, value }) => {
    if (vehicle.id !== 'ai') return;
    const { r, theta } = t.polar(vehicle.x, vehicle.z);
    const off = Math.abs(r - t.roadRadius(theta));
    res.coins++; res.valor += value;
    res.faixa[off <= CONFIG.road.halfWidth ? 'estrada' : off <= 10 ? 'perto' : 'longe']++;
    res.times.push(last - match.timeLeft); last = match.timeLeft;
    res.pickups.push([vehicle.x, vehicle.z, value]);
  });
  bus.on('vehicle:crash', ({ vehicle }) => { if (vehicle.id === 'ai') res.crashes++; });

  match.round = seedOffset * 3; // cada partida usa um conjunto inicial de moedas diferente
  match.start();
  const dt = 1 / 60;
  let cur = 0;
  while (match.state === 'playing') {
    match.update(dt);
    if (Math.abs(ai.speed) < 0.8 && !ai.stunned) {
      cur++;
      if (cur === 60) {
        let near = null, nd = 1e9;
        for (const it of p.items) { const d = Math.hypot(it.x - ai.x, it.z - ai.z) - it.radius; if (d < nd) { nd = d; near = it.kind; } }
        res.stuck.push({ x: ai.x, z: ai.z, perto: near, dist: nd });
      }
    } else cur = 0;
  }
  CONFIG.ai.coinSight = saved;
  [CONFIG.ai.rubberLead, CONFIG.ai.rubberTrail] = rubber;
  return res;
}

{
  const summarize = (label, sight) => {
    const runs = [];
    for (let s = 0; s < 8; s++) runs.push(simulate(s, sight));
    const coins = avg(runs.map((r) => r.coins));
    const f = { estrada: 0, perto: 0, longe: 0 };
    runs.forEach((r) => { for (const k in f) f[k] += r.faixa[k]; });
    const totalCoins = f.estrada + f.perto + f.longe || 1;
    const stuck = runs.flatMap((r) => r.stuck);
    return {
      motorista: label,
      moedasEm3min: rnd(coins, 1),
      valorEm3min: rnd(avg(runs.map((r) => r.valor)), 1),
      valorPorMoeda: rnd(avg(runs.map((r) => r.valor)) / (coins || 1), 2),
      intervaloEntreMoedasS: rnd(avg(runs.flatMap((r) => r.times)), 1),
      origemPct: { estrada: pct(f.estrada, totalCoins), perto: pct(f.perto, totalCoins), longe: pct(f.longe, totalCoins) },
      batidasNoTrem: rnd(avg(runs.map((r) => r.crashes)), 1),
      travadasPorPartida: rnd(stuck.length / runs.length, 1),
      travadasPerto: Object.entries(stuck.reduce((a, s) => ((a[s.perto] = (a[s.perto] || 0) + 1), a), {})),
      _stuck: runs[0].stuck.map((s) => [s.x, s.z]),
      _pickups: runs[0].pickups,
    };
  };
  const follower = summarize('segue a estrada, só pega moeda a até 8 m', 8);
  const ai = summarize(`IA atual (vê moedas a ${CONFIG.ai.coinSight} m)`, CONFIG.ai.coinSight);
  out.simulacao = [follower, ai].map(({ _stuck, _pickups, ...r }) => r);
  out._mapa.stuck = ai._stuck;
  out._mapa.pickupsAI = ai._pickups;
}

// ---------- 4. Exposição ao trem nos cruzamentos ----------
{
  const train = new Train(terrain);
  const dt = 0.1, T = 3000;
  let vmin = 1e9, vmax = 0, pp = train._railAt(0);
  const cross = out._mapa.crossings;
  const state = cross.map(() => ({ occ: 0, starts: 0, was: false, idle: 99 }));
  for (let t = 0; t < T; t += dt) {
    train.update(dt);
    const hp = train._railAt(0);
    const sp = Math.hypot(hp.x - pp.x, hp.z - pp.z) / dt;
    pp = hp;
    if (t > 1) { vmin = Math.min(vmin, sp); vmax = Math.max(vmax, sp); }
    cross.forEach((c, i) => {
      const hit = train.collidesWith({ x: c.x, z: c.z });
      if (hit) state[i].occ += dt;
      if (hit) { if (state[i].idle > 3) state[i].starts++; state[i].idle = 0; } else state[i].idle = (state[i].idle ?? 99) + dt;
      state[i].was = hit;
    });
  }
  const velMinMax = `${rnd(vmin, 1)} a ${rnd(vmax, 1)} m/s`;
  const occPct = state.map((s) => (100 * s.occ) / T);
  out.trem = {
    comprimentoDoTremM: rnd(CONFIG.train.cars.reduce((s, c) => s + c.length, 0) + CONFIG.train.gap * (CONFIG.train.cars.length - 1), 0),
    velocidadeMs: CONFIG.train.speed,
    cruzamentoBloqueadoPct: occPct.map((v) => rnd(v, 1)),
    passagensPorMinutoPorCruzamento: rnd(avg(state.map((s) => (s.starts * 60) / T)), 2),
    segundosBloqueadoPorPassagem: rnd(avg(state.map((s) => (s.starts ? s.occ / s.starts : 0))), 1),
    avisoAoJogador: 'sinais piscando 6 s antes + alerta no HUD + vibração',
    velocidadeMinMax: velMinMax,
  };
}

// ---------- 5. As moedas são visíveis de longe? ----------
{
  const visible = (from, to) => {
    const steps = Math.ceil(Math.hypot(to[0] - from[0], to[2] - from[2]) / 3);
    for (let i = 1; i < steps; i++) {
      const f = i / steps;
      const x = from[0] + (to[0] - from[0]) * f, z = from[2] + (to[2] - from[2]) * f;
      const y = from[1] + (to[1] - from[1]) * f;
      if (terrain.heightAt(x, z) > y) return false;
    }
    return true;
  };
  const buckets = [[0, 40], [40, 80], [80, 140]];
  const acc = buckets.map(() => ({ n: 0, corpo: 0, feixe: 0 }));
  const rng = createRng(77);
  const cf = new CoinField(terrain, props);
  for (let s = 0; s < 25; s++) {
    cf.reset(createRng(900 + s));
    for (const c of cf.coins) {
      const cy = terrain.heightAt(c.x, c.z);
      for (let k = 0; k < 20; k++) {
        const th = rng() * TAU;
        const rp = terrain.roadPoint(th);
        const d = Math.hypot(rp.x - c.x, rp.z - c.z);
        const b = buckets.findIndex(([a, z]) => d >= a && d < z);
        if (b < 0) continue;
        const eye = [rp.x, terrain.heightAt(rp.x, rp.z) + 3.6, rp.z];
        acc[b].n++;
        if (visible(eye, [c.x, cy + 1, c.z])) acc[b].corpo++;
        if (visible(eye, [c.x, cy + 17, c.z])) acc[b].feixe++;
      }
    }
  }
  out.visibilidade = buckets.map(([a, z], i) => ({
    distanciaM: `${a}-${z}`,
    amostras: acc[i].n,
    corpoVisivelPct: pct(acc[i].corpo, acc[i].n || 1),
    feixeVisivelPct: pct(acc[i].feixe, acc[i].n || 1),
  }));
}

// ---------- 6. Obstáculos e corredor da estrada ----------
{
  const near = props.items.filter((p) => terrain.distanceToRoad(p.x, p.z) < CONFIG.road.halfWidth + 6);
  const kinds = {};
  near.forEach((p) => (kinds[p.kind] = (kinds[p.kind] || 0) + 1));
  const lamps = props.items.filter((p) => p.kind === 'lamp');
  const l0r = lamps[0]?.radius ?? 0;
  out.obstaculos = {
    total: props.items.length,
    aMenosDe6mDaBorda: kinds,
    folgaPostesM: rnd(Math.min(...lamps.map((l) => terrain.distanceToRoad(l.x, l.z))) - CONFIG.road.halfWidth - l0r - CONFIG.vehicle.hitRadius, 2),
    postesMaisPertoDoEixoM: rnd(Math.min(...lamps.map((l) => terrain.distanceToRoad(l.x, l.z))), 2),
    postesNaEstrada: lamps.length,
    perdaDeVelocidadePorBatida: 'só a parte da velocidade que entra no obstáculo (desliza)',
  };
  out._mapa.props = props.items.map((p) => [p.x, p.z, p.kind, p.radius]);
}

mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/analise-mapa.json', import.meta.url), JSON.stringify(out, null, 1));
const { _mapa, ...resumo } = out;
console.log(JSON.stringify(resumo, null, 1));
