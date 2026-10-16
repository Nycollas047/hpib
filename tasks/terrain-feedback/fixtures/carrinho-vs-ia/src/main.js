// Ponto de entrada: monta o mundo, liga lÃ³gica e visual, e roda o loop.
// Ordem: nÃºcleo â†’ mundo â†’ veÃ­culos â†’ partida â†’ visual â†’ loop.
import * as THREE from 'three';
import { CONFIG, WEATHER } from './core/config.js';
import { EventBus } from './core/events.js';
import { createRng } from './core/random.js';
import { Terrain } from './world/terrain.js';
import { Props } from './world/props.js';
import { CoinField } from './world/coins.js';
import { Train } from './world/train.js';
import { Vehicle } from './vehicles/vehicle.js';
import { PlayerDriver, AIDriver } from './vehicles/drivers.js';
import { Input, getActivePad, isDualSensePad } from './input/input.js';
import { HapticController } from './haptics/haptics.js';
import { Match } from './gameplay/match.js';
import { Hud } from './ui/hud.js';
import { buildTerrainMesh, buildApron } from './render/terrainView.js';
import { buildRoadGroup, buildRailGroup } from './render/trackView.js';
import { buildProps } from './render/propsView.js';
import { buildVehicleMesh, syncVehicleMesh } from './render/vehicleView.js';
import { buildTrainMeshes, syncTrainMeshes } from './render/trainView.js';
import { buildDelineators, buildSignals } from './render/roadsideView.js';
import { CoinView, COIN_COLORS } from './render/coinView.js';
import { WeatherView } from './render/weatherView.js';
import { Sky } from './render/sky.js';
import { SoundSystem } from './audio/sound.js';
import { ParticleSystem } from './render/particles.js';

const STEP = 1 / 60; // passo fixo de simulaÃ§Ã£o
const getGamepadActuatorAvailable = () => !!getActivePad()?.vibrationActuator;

// ---------- 1. NÃºcleo e lÃ³gica ----------
const bus = new EventBus();
const terrain = new Terrain(CONFIG.seed);

const props = new Props(terrain);
props.generate(createRng(CONFIG.seed + 1)); // cenÃ¡rio fixo em todas as rodadas

const coins = new CoinField(terrain, props);
coins.reset(createRng(CONFIG.seed + 2)); // moedas jÃ¡ visÃ­veis antes de comeÃ§ar

const train = new Train(terrain);
const input = new Input();
const haptics = new HapticController(bus);
const hud = new Hud();

const player = new Vehicle({ id: 'player', terrain, driver: new PlayerDriver(input) });
const ai = new Vehicle({
  id: 'ai',
  terrain,
  driver: new AIDriver({
    terrain,
    props,
    getCoins: () => coins.coins,
    getHazards: () => match.signals,
    getLead: () => match.scores.ai - match.scores.player,
  }),
});

const match = new Match({ bus, terrain, coins, props, train, player, ai });

// ---------- 2. Visual ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 900);

const sky = new Sky(scene);
const hemi = new THREE.HemisphereLight(0xffffff, 0x4a5a2a, 0.6);
const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 400 });
sun.shadow.bias = -0.0008;
scene.add(hemi, sun, sun.target);

const terrainMesh = buildTerrainMesh(terrain);
scene.add(terrainMesh, buildApron(), buildRoadGroup(terrain), buildRailGroup(terrain), buildProps(props, terrain));

const vehicleMeshes = {
  player: buildVehicleMesh(0xe74c3c),
  ai: buildVehicleMesh(0x3498db),
};
scene.add(vehicleMeshes.player, vehicleMeshes.ai);

scene.add(buildDelineators(terrain));
const signalView = buildSignals(terrain, train.crossings);
scene.add(signalView.group);

const trainView = buildTrainMeshes();
scene.add(trainView.group);

const coinView = new CoinView(scene);
const weatherView = new WeatherView(scene, sun, hemi, sky);
weatherView.apply(WEATHER[0]);

const sound = new SoundSystem();
const particles = new ParticleSystem(scene);

// Eventos que o visual e o Ã¡udio reagem (a lÃ³gica nÃ£o sabe que eles existem)
bus.on('weather:change', ({ profile }) => weatherView.apply(profile));
bus.on('match:start', () => sound.resume());
bus.on('match:resume', () => sound.resume());
bus.on('match:end', () => haptics.stop());
bus.on('match:end', () => hud.showStart('Próxima rodada'));

bus.on('coin:collected', ({ vehicle, value, coin }) => {
  if (vehicle.id === 'player') sound.playCoin(value);
  const coinY = terrain.heightAt(coin.x, coin.z) + 1.0;
  particles.burstCoin(coin.x, coinY, coin.z, COIN_COLORS[value] ?? 0xffd23f);
});

bus.on('vehicle:bump', ({ vehicle, impact }) => {
  if (vehicle.id === 'player') sound.playBump(impact);
});

bus.on('vehicle:crash', ({ vehicle }) => {
  if (vehicle.id === 'player') sound.playCrash();
});

// ---------- 3. Entrada, tela inicial e cÃ¢mera ----------
function updateHidUi() {
  const btn = document.getElementById('hid-connect');
  const startHidBtn = document.getElementById('start-hid-btn');
  if (haptics.dualSense.connected) {
    const text = `DualSense Conectado (${haptics.dualSense.link.toUpperCase()})`;
    if (btn) {
      btn.textContent = text;
      btn.style.borderColor = 'rgba(52,211,153,0.6)';
      btn.style.color = '#a7f3d0';
    }
    if (startHidBtn) {
      startHidBtn.textContent = text;
      startHidBtn.style.borderColor = 'rgba(52,211,153,0.6)';
      startHidBtn.style.color = '#a7f3d0';
    }
  } else {
    const text = 'Conectar DualSense (USB/BT)';
    if (btn) {
      btn.textContent = text;
      btn.style.borderColor = 'rgba(255,255,255,0.25)';
      btn.style.color = '#fff';
    }
    if (startHidBtn) {
      startHidBtn.textContent = 'Conectar DualSense';
      startHidBtn.style.borderColor = 'rgba(255,255,255,0.25)';
      startHidBtn.style.color = '#fff';
    }
  }
}

const hidConnectBtn = document.getElementById('hid-connect');
if (hidConnectBtn) {
  hidConnectBtn.addEventListener('click', async () => {
    sound.resume();
    await haptics.connectDualSense();
    updateHidUi();
  });
}

const startHidBtn = document.getElementById('start-hid-btn');
if (startHidBtn) {
  startHidBtn.addEventListener('click', async () => {
    sound.resume();
    await haptics.connectDualSense();
    updateHidUi();
  });
}

document.getElementById('start-btn').addEventListener('click', async () => {
  sound.resume();
  hud.hideStart();
  if (match.state === 'ready' || match.state === 'ended') match.start();
  if (haptics.dualSense.supported && !haptics.dualSense.connected) {
    await haptics.reconnectDualSense();
    updateHidUi();
  }
  haptics.test();
});

window.addEventListener('pointerdown', () => sound.resume(), { passive: true });
window.addEventListener('keydown', (e) => {
  sound.resume();
  if (e.code === 'F2') hud.toggleDebug();
  if (e.code === 'F3') haptics.test(); // vibraÃ§Ã£o de teste
});

// Reutiliza a autorizaÃ§Ã£o WebHID dada anteriormente (sem abrir seletor).
haptics.reconnectDualSense().then(() => updateHidUi());

window.addEventListener('gamepadconnected', (e) => {
  if (isDualSensePad(e.gamepad) && haptics.dualSense.supported && !haptics.dualSense.connected) {
    haptics.reconnectDualSense().then(() => updateHidUi());
  }
});

// Perdeu o foco (trocou de aba): pausa, para o carro nÃ£o andar sozinho
document.addEventListener('visibilitychange', () => {
  if (document.hidden) match.pause();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const camTarget = new THREE.Vector3();
const camDesired = new THREE.Vector3();
let cameraReady = false;

let devCam = null; // cÃ¢mera livre, sÃ³ para o modo ?dev (inspeÃ§Ã£o visual)

let camFov = CONFIG.camera.fov;

function updateCamera(dt) {
  if (devCam) {
    camera.position.copy(devCam.pos);
    camera.lookAt(devCam.look);
    return;
  }
  const { distance, height, lerp, fov, fovBoost } = CONFIG.camera;

  // Campo de visÃ£o abre com a velocidade (sensaÃ§Ã£o de velocidade sem mudar a fÃ­sica)
  const speedRatio = Math.min(1, Math.abs(player.speed) / CONFIG.vehicle.maxSpeed);
  camFov += (fov + fovBoost * speedRatio * speedRatio - camFov) * Math.min(1, dt * 4);
  if (Math.abs(camera.fov - camFov) > 0.01) {
    camera.fov = camFov;
    camera.updateProjectionMatrix();
  }

  // AnalÃ³gico direito gira a cÃ¢mera em volta do carro; R3 olha para trÃ¡s
  const h = player.heading + input.readCamera(dt);
  camDesired.set(
    player.x - Math.sin(h) * distance,
    player.y + height,
    player.z - Math.cos(h) * distance
  );
  // A cÃ¢mera nunca entra no relevo: fica pelo menos 2 m acima do chÃ£o
  camDesired.y = Math.max(camDesired.y, terrain.heightAt(camDesired.x, camDesired.z) + 2);

  if (!cameraReady) {
    camera.position.copy(camDesired);
    cameraReady = true;
  } else {
    // O quanto a cÃ¢mera acompanha nÃ£o depende da taxa de quadros
    camera.position.lerp(camDesired, 1 - Math.pow(1 - lerp, dt * 60));
  }
  camTarget.set(player.x, player.y + 1.2, player.z);
  camera.lookAt(camTarget);
}

// Sol e sombras acompanham o carro (a sombra sÃ³ precisa cobrir a Ã¡rea perto dele)
function updateSun() {
  sun.position.set(player.x + 60, 120, player.z + 40);
  sun.target.position.set(player.x, 0, player.z);
  sun.target.updateMatrixWorld();
}

// Seta para a melhor moeda (valor alto e perto) e alerta de trem
function updateHudExtras(hazard) {
  if (match.state !== 'playing') {
    hud.setArrow(null);
    hud.setWarning(null);
    return;
  }
  let best = null;
  let bestScore = 0;
  for (const c of coins.coins) {
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    const score = c.value / (d + 25);
    if (score > bestScore) {
      best = { c, d };
      bestScore = score;
    }
  }
  if (best) {
    // Ã‚ngulo em relaÃ§Ã£o ao que a cÃ¢mera estÃ¡ vendo (nÃ£o ao carro)
    const fx = player.x - camera.position.x;
    const fz = player.z - camera.position.z;
    const fl = Math.hypot(fx, fz) || 1;
    const tx = best.c.x - player.x;
    const tz = best.c.z - player.z;
    const forward = (tx * fx + tz * fz) / fl;
    const side = (tx * -fz + tz * fx) / fl;
    hud.setArrow({
      angle: Math.atan2(side, forward),
      dist: best.d,
      value: best.c.value,
      color: '#' + COIN_COLORS[best.c.value].toString(16).padStart(6, '0'),
    });
  } else hud.setArrow(null);

  if (hazard && hazard.dist < 110) {
    const urgent = hazard.state === 'red';
    hud.setWarning(urgent ? `TREM NO CRUZAMENTO Â· ${Math.round(hazard.dist)} m` : `TREM CHEGANDO Â· cruzamento a ${Math.round(hazard.dist)} m`, urgent);
  } else hud.setWarning(null);
}

// ---------- 4. Loop principal ----------
let lastTime = performance.now() / 1000;
let accumulator = 0;
let lastDebug = 0;

function frame(nowMs) {
  const now = nowMs / 1000;
  const frameTime = Math.min(0.1, now - lastTime);
  lastTime = now;
  accumulator += frameTime;

  // BotÃµes de um toque: Options/Enter comeÃ§a, pausa e continua; TriÃ¢ngulo/R volta Ã  pista
  const act = input.poll();
  if (match.state === 'playing') {
    if (act.pause) match.pause();
    else if (act.reset) match.resetToRoad(player);
  } else if (match.state === 'paused') {
    if (act.confirm || act.pause) {
      sound.resume();
      match.resume();
    }
  } else if (act.confirm) {
    sound.resume();
    hud.hideStart();
    if (match.state === 'ready' || match.state === 'ended') match.start();
  }

  while (accumulator >= STEP) {
    match.update(STEP);
    accumulator -= STEP;
  }
  if (match.state !== 'playing') accumulator = 0; // pausado: nÃ£o acumula tempo

  // Visual e hÃ¡ptica leem o estado; nÃ£o alteram a lÃ³gica
  syncVehicleMesh(vehicleMeshes.player, player, frameTime);
  syncVehicleMesh(vehicleMeshes.ai, ai, frameTime);
  syncTrainMeshes(trainView, train.getCars());
  coinView.sync(coins.coins, terrain, now);
  signalView.update(match.signals, now);

  // Ãudio procedural e partÃ­culas dinÃ¢micas
  sound.update(player, match, now, frameTime);
  particles.update(frameTime);

  const absPlayerSlip = Math.abs(player.slip);
  if (absPlayerSlip > 1.2 && Math.abs(player.speed) > 2) {
    particles.emitDrift(player.x, player.y, player.z, player.surface, absPlayerSlip / 4);
  }
  const absAiSlip = Math.abs(ai.slip);
  if (absAiSlip > 1.4 && Math.abs(ai.speed) > 2) {
    particles.emitDrift(ai.x, ai.y, ai.z, ai.surface, absAiSlip / 5);
  }

  const hazard = match.state === 'playing' ? match.hazardFor(player) : null;
  const trainNear = hazard && hazard.dist < 70 ? 1 - hazard.dist / 70 : 0;
  haptics.update(now, player, match.weather, trainNear);
  weatherView.update(frameTime, camTarget);
  sky.follow(camera.position);
  updateSun();
  updateCamera(frameTime);
  hud.update(match, player);
  updateHudExtras(hazard);

  if (now - lastDebug > 0.5) {
    lastDebug = now;
    haptics.refresh();
    updateHidUi();
    const s = haptics.status;
    const ctrl = player.controls || { throttle: 0, brake: 0, steer: 0 };
    hud.setDebug(
      `CONTROLE E VIBRAÃ‡ÃƒO (diagnÃ³stico)\n` +
      `controle:        ${s.pad}\n` +
      `dispositivo:     ${input.lastDevice}\n` +
      `acel / freio:    ${ctrl.throttle.toFixed(2)} / ${ctrl.brake.toFixed(2)} (dir: ${ctrl.steer.toFixed(2)})\n` +
      `atuador:         ${s.actuator}\n` +
      `WebHID:          ${s.webhid}\n` +
      `clique na pÃ¡gina: ${s.activation ? 'sim' : 'NÃƒO (clique no botÃ£o ComeÃ§ar)'}\n` +
      `Ãºltimo resultado: ${s.lastResult}\n` +
      `ok / falhas:     ${s.okCount} / ${s.errCount}\n` +
      `Ãºltimo erro:     ${s.lastError || 'â€”'}\n` +
      `\nF3: vibraÃ§Ã£o de teste`
    );
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// Modo de desenvolvimento: ?dev expÃµe o estado do jogo no console (window.game)
if (new URLSearchParams(location.search).has('dev')) {
  window.game = {
    player, ai, train, match, coins, camera,
    setDevCam: (pos, look) => { devCam = pos ? { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look) } : null; },
  };
}

requestAnimationFrame(frame);



