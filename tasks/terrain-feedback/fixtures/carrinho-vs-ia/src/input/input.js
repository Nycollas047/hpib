// Entrada: teclado e controle PS5 (API padrão do navegador).
// Convenção: steer > 0 = esquerda; throttle e brake vão de 0 a 1.
//
// Mapeamento do DualSense (padrão "standard" do navegador):
//   analógico esquerdo = axes[0] e axes[1]     analógico direito = axes[2] e axes[3]
//   R2 = buttons[7]  L2 = buttons[6]  Cruz = 0  Círculo = 1  Quadrado = 2  Triângulo = 3
//   L1 = 4  R1 = 5  Options = 9  R3 = 11
//
// Funções puras no topo (sem navegador) para poder testar com controles falsos.
import { CONFIG } from '../core/config.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Zona morta RADIAL: o analógico é um círculo, não dois eixos independentes.
// Depois da zona morta, reescala para 0..1 (sem "pulo" quando sai do centro).
export function shapeStick(x, y, c = CONFIG.input) {
  const m = Math.hypot(x, y);
  if (m < c.stickDeadzone) return { x: 0, y: 0 };
  const k = clamp((m - c.stickDeadzone) / (c.stickOuter - c.stickDeadzone), 0, 1) / m;
  return { x: x * k, y: y * k };
}

// Curva de resposta: expoente > 1 deixa o centro mais fino (curvas leves) e o fim rápido
export const steerCurve = (v, exp = CONFIG.vehicle.steerExp) => Math.sign(v) * Math.abs(v) ** exp;

export const shapeTrigger = (v, dz = CONFIG.input.triggerDeadzone) =>
  v < dz ? 0 : clamp((v - dz) / (1 - dz), 0, 1);

// Aproxima "value" de "target" com taxa por segundo (suaviza sem atrasar demais)
export const smoothTo = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));

// Lê um controle e devolve valores crus e já com zona morta/curva
export function readPad(rawPad, c = CONFIG.input) {
  const pad = normalizePad(rawPad);
  const axes = pad.axes || [];
  const left = shapeStick(axes[0] ?? 0, axes[1] ?? 0, c);
  const right = shapeStick(axes[2] ?? 0, axes[3] ?? 0, c);
  const b = (i) => !!(pad.buttons?.[i]?.pressed || (pad.buttons?.[i]?.value ?? 0) > 0.5);
  const trigVal = (i) => {
    const btn = pad.buttons?.[i];
    if (!btn) return 0;
    if (typeof btn.value === 'number' && btn.value > 0) return btn.value;
    return btn.pressed ? 1 : 0;
  };

  // Direção: analógico esquerdo ou setinhas do controle (D-Pad esquerda = 14, direita = 15)
  const dpadSteer = (b(14) ? 1 : 0) - (b(15) ? 1 : 0);
  const stickSteer = -steerCurve(left.x); // analógico para a direita = steer negativo
  const steer = Math.abs(dpadSteer) > Math.abs(left.x) ? dpadSteer : stickSteer;

  // Acelerador e freio por gatilhos (R2/L2), botões (Cruz/Círculo) ou D-Pad (Cima/Baixo)
  const r2 = shapeTrigger(trigVal(7), c.triggerDeadzone);
  const l2 = shapeTrigger(trigVal(6), c.triggerDeadzone);
  const btnThrottle = Math.max(r2, b(0) || b(12) ? 1 : 0);
  const btnBrake = Math.max(l2, b(1) || b(13) ? 1 : 0);

  // Se o jogador não estiver usando gatilhos/botões para acelerar ou frear,
  // permite acelerar empurrando o analógico esquerdo para frente e frear puxando para trás.
  let stickThrottle = 0;
  let stickBrake = 0;
  if (btnThrottle === 0 && btnBrake === 0) {
    if (left.y < -0.15) stickThrottle = clamp(-left.y, 0, 1);
    else if (left.y > 0.25 && left.y > Math.abs(left.x) * 0.8) stickBrake = clamp(left.y, 0, 1);
  }

  return {
    steer,
    throttle: Math.max(btnThrottle, stickThrottle),
    brake: Math.max(btnBrake, stickBrake),
    handbrake: b(2) || b(5) || b(4),           // Quadrado, R1 ou L1
    reset: b(3),                               // Triângulo
    pause: b(9) || b(8),                       // Options ou Create
    confirm: b(0) || b(9) || b(7),             // Cruz (X), Options ou R2
    lookBack: b(11),                           // R3
    camX: right.x,
  };
}

let lastActivePadIndex = -1;
let webHidPadGetter = null;

export function setWebHidPadGetter(fn) {
  webHidPadGetter = typeof fn === 'function' ? fn : null;
}

export function isDualSensePad(pad) {
  if (!pad) return false;
  const id = (pad.id || '').toLowerCase();
  return id.includes('054c') || id.includes('dualsense') || id.includes('wireless controller');
}

// Normaliza controles DualSense que o navegador entrega sem mapeamento "standard" (DirectInput cru)
export function normalizePad(pad) {
  if (!pad || pad.mapping === 'standard' || pad.mapping === undefined || !isDualSensePad(pad)) {
    return pad;
  }
  const axes = pad.axes || [];
  const rawBtns = pad.buttons || [];
  const makeBtn = (pressed, value = pressed ? 1 : 0) => ({ pressed: !!pressed, value });
  const rawPressed = (i) => !!(rawBtns[i]?.pressed || (rawBtns[i]?.value ?? 0) > 0.5);

  const lx = axes[0] ?? 0;
  const ly = axes[1] ?? 0;
  const rx = axes[2] ?? 0;
  const ry = axes.length >= 6 ? (axes[5] ?? 0) : (axes[3] ?? 0);

  // No DirectInput, L2 e R2 costumam vir nos eixos 3 e 4 (-1 solto a +1 apertado) quando buttons[6]/[7] estão ativos
  const l2Pressed = rawPressed(6);
  const r2Pressed = rawPressed(7);
  const l2Val = l2Pressed
    ? (axes.length >= 6 && typeof axes[3] === 'number' ? clamp((axes[3] + 1) / 2, 0.15, 1) : (rawBtns[6]?.value || 1))
    : 0;
  const r2Val = r2Pressed
    ? (axes.length >= 6 && typeof axes[4] === 'number' ? clamp((axes[4] + 1) / 2, 0.15, 1) : (rawBtns[7]?.value || 1))
    : 0;

  // Hat switch do D-Pad no eixo 9 (DirectInput): -1 = cima, -0.43 = direita, 0.14 = baixo, 0.71 = esquerda
  let dpadUp = rawPressed(12), dpadDown = rawPressed(13), dpadLeft = rawPressed(14), dpadRight = rawPressed(15);
  if (typeof axes[9] === 'number' && axes[9] >= -1.05 && axes[9] <= 1.05) {
    const hat = Math.round(((axes[9] + 1) / 2) * 7);
    dpadUp = hat === 0 || hat === 1 || hat === 7;
    dpadRight = hat === 1 || hat === 2 || hat === 3;
    dpadDown = hat === 3 || hat === 4 || hat === 5;
    dpadLeft = hat === 5 || hat === 6 || hat === 7;
  }

  return {
    id: pad.id,
    connected: pad.connected,
    mapping: 'standard',
    vibrationActuator: pad.vibrationActuator,
    axes: [lx, ly, rx, ry],
    buttons: [
      makeBtn(rawPressed(1)),              // 0: Cruz (X) (no DirectInput é botão 1)
      makeBtn(rawPressed(2)),              // 1: Círculo (no DirectInput é botão 2)
      makeBtn(rawPressed(0)),              // 2: Quadrado (no DirectInput é botão 0)
      makeBtn(rawPressed(3)),              // 3: Triângulo
      makeBtn(rawPressed(4)),              // 4: L1
      makeBtn(rawPressed(5)),              // 5: R1
      makeBtn(l2Pressed, l2Val),           // 6: L2
      makeBtn(r2Pressed, r2Val),           // 7: R2
      makeBtn(rawPressed(8)),              // 8: Create
      makeBtn(rawPressed(9)),              // 9: Options
      makeBtn(rawPressed(10)),             // 10: L3
      makeBtn(rawPressed(11)),             // 11: R3
      makeBtn(dpadUp),                     // 12: D-Pad Cima
      makeBtn(dpadDown),                   // 13: D-Pad Baixo
      makeBtn(dpadLeft),                   // 14: D-Pad Esquerda
      makeBtn(dpadRight),                  // 15: D-Pad Direita
      makeBtn(rawPressed(12)),             // 16: PS
    ],
  };
}

function hasPadActivity(pad) {
  if (!pad || !pad.connected) return false;
  const axes = pad.axes || [];
  const hasStick = axes.slice(0, 4).some((a) => Math.abs(a) > 0.15);
  const hasButton = (pad.buttons || []).some((b) => b?.pressed || (b?.value ?? 0) > 0.1);
  return hasStick || hasButton;
}

export function getActivePad() {
  const hidPad = webHidPadGetter ? webHidPadGetter() : null;
  const rawPads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  const pads = Array.from(rawPads || []).map((p) => (p && p.connected ? normalizePad(p) : null));

  // 1. Se o DualSense via WebHID estiver com botão/analógico ativo, prioriza imediatamente
  if (hidPad?.connected && hasPadActivity(hidPad)) {
    return hidPad;
  }

  // 2. Prioriza o controle da Gamepad API que tiver atividade nos eixos ou botões
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    if (hasPadActivity(pad)) {
      lastActivePadIndex = i;
      return pad;
    }
  }

  // 3. Se o DualSense estiver conectado via WebHID, usa o estado dele (essencial no Bluetooth 0x31)
  if (hidPad?.connected) {
    return hidPad;
  }

  // 4. Mantém o último controle ativo se ainda estiver conectado
  if (lastActivePadIndex >= 0 && pads[lastActivePadIndex]?.connected) {
    return pads[lastActivePadIndex];
  }

  // 5. Prioriza DualSense se estiver presente
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    if (pad && pad.connected && isDualSensePad(pad)) {
      lastActivePadIndex = i;
      return pad;
    }
  }

  // 6. Devolve o primeiro controle conectado
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    if (pad && pad.connected) {
      lastActivePadIndex = i;
      return pad;
    }
  }
  return null;
}

export class Input {
  constructor(win = typeof window !== 'undefined' ? window : null) {
    this.keys = new Set();
    this.prev = {};
    this.keySteer = 0;      // teclado com rampa
    this.padSteer = 0;      // controle com filtro leve
    this.cameraYaw = 0;     // giro da câmera (rad)
    this.lastDevice = 'teclado';

    if (win) {
      win.addEventListener('keydown', (e) => {
        this.keys.add(e.code);
        if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      });
      win.addEventListener('keyup', (e) => this.keys.delete(e.code));
      win.addEventListener('blur', () => this.keys.clear());
    }
  }

  // Controles de direção. Chamado pelo PlayerDriver a cada passo da simulação.
  read(dt = 1 / 60) {
    const k = this.keys;
    const c = CONFIG.input;
    const has = (...codes) => codes.some((code) => k.has(code));

    // Teclado: a direção sobe e desce em rampa (antes era 0 ou 1 de uma vez)
    const keyTarget = (has('KeyA', 'ArrowLeft') ? 1 : 0) - (has('KeyD', 'ArrowRight') ? 1 : 0);
    const rate = keyTarget === 0 || Math.sign(keyTarget) !== Math.sign(this.keySteer) ? c.keyFall : c.keyRise;
    this.keySteer += clamp(keyTarget - this.keySteer, -rate * dt, rate * dt);

    let throttle = has('KeyW', 'ArrowUp') ? 1 : 0;
    let brake = has('KeyS', 'ArrowDown') ? 1 : 0;
    let handbrake = has('Space');
    let steer = this.keySteer;

    const pad = getActivePad();
    if (pad) {
      const p = readPad(pad, c);
      this.padSteer = smoothTo(this.padSteer, p.steer, c.padSmooth, dt);
      if (Math.abs(p.steer) > 0.02 || p.throttle > 0 || p.brake > 0) this.lastDevice = 'controle';
      if (Math.abs(p.steer) > Math.abs(steer) || (keyTarget === 0 && Math.abs(this.padSteer) > Math.abs(steer))) {
        steer = this.padSteer;
      }
      throttle = Math.max(throttle, p.throttle);
      brake = Math.max(brake, p.brake);
      handbrake = handbrake || p.handbrake;
    }
    return { throttle, brake, steer: clamp(steer, -1, 1), handbrake };
  }

  // Câmera: analógico direito (ou Q/E) gira em volta do carro; R3 (ou C) olha para trás
  readCamera(dt) {
    const k = this.keys;
    let x = (k.has('KeyQ') ? 1 : 0) - (k.has('KeyE') ? 1 : 0);
    let back = k.has('KeyC');
    const pad = getActivePad();
    if (pad) {
      const p = readPad(pad);
      if (Math.abs(p.camX) > Math.abs(x)) x = -p.camX; // empurrar para a direita gira a vista para a direita
      back = back || p.lookBack;
    }
    const target = back ? Math.PI : x * CONFIG.camera.yawMax;
    // Olhar para trás é um estado (volta sozinho quando solta)
    this.cameraYaw = smoothTo(this.cameraYaw, target, CONFIG.input.cameraSmooth, dt);
    return this.cameraYaw;
  }

  // Botões de um toque só (true uma vez por aperto)
  _edge(name, now) {
    const fired = now && !this.prev[name];
    this.prev[name] = now;
    return fired;
  }

  // Chamado uma vez por quadro. Devolve ações discretas.
  poll() {
    const k = this.keys;
    const pad = getActivePad();
    const p = pad ? readPad(pad) : null;
    return {
      confirm: this._edge('confirm', k.has('Enter') || k.has('Space') || !!p?.confirm), // começar / reiniciar / continuar
      pause: this._edge('pause', k.has('Escape') || k.has('KeyP') || !!p?.pause),
      reset: this._edge('reset', k.has('KeyR') || !!p?.reset),
    };
  }
}
