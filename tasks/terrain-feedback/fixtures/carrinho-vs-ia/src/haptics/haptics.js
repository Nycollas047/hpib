// Háptica: traduz física do veículo, superfície, relevo e clima em feedback sensorial.
//
// Integração completa com DualSense:
// - Atuadores Dual Voice-Coil: motor esquerdo (grave/massa) e motor direito (agudo/textura)
// - Gatilhos Adaptáveis: R2 (peso de subida/lama e tremor de patinagem) e L2 (ABS e engate de ré)
// - 5 LEDs de Jogador: tacômetro / velocímetro progressivo no controle
// - Lightbar RGB: iluminação sincronizada com o tipo de piso e eventos da partida
// - Fallback automático para a Gamepad API (dual-rumble padrão) se WebHID não estiver ativo

import { CONFIG, SURFACES } from '../core/config.js';
import { getActivePad, setWebHidPadGetter } from '../input/input.js';
import { DualSenseHaptics, TRIGGER_EFFECTS } from './dualsense.js';

export const SURFACE_COLORS = Object.freeze({
  asfalto: Object.freeze({ r: 0,   g: 140, b: 255 }), // Azul elétrico
  grama:   Object.freeze({ r: 25,  g: 220, b: 65  }), // Verde esmeralda vivo
  terra:   Object.freeze({ r: 255, g: 145, b: 20  }), // Âmbar / laranja terra
  lama:    Object.freeze({ r: 160, g: 75,  b: 15  }), // Cobre / marrom café
  pedra:   Object.freeze({ r: 210, g: 230, b: 255 }), // Branco gelo / prata
});

export const COIN_HAPTIC_COLORS = Object.freeze({
  1: Object.freeze({ r: 255, g: 215, b: 0   }), // Dourada
  2: Object.freeze({ r: 255, g: 110, b: 0   }), // Laranja
  3: Object.freeze({ r: 0,   g: 180, b: 255 }), // Azul
  4: Object.freeze({ r: 190, g: 60,  b: 255 }), // Roxa
});

export const HAPTIC_PARAMS = Object.freeze({
  pulseEvery: 0.08,             // frequência de atualização tátil (~12 Hz)
  terrainDuration: 110,
  reliefScale: 0.35,
  slipScale: 0.85,
  trainBase: 0.25,
  trainScale: 0.65,
  speedForFullIntensity: 12,
  effects: Object.freeze({
    crash: Object.freeze({ strongMagnitude: 1, weakMagnitude: 1, duration: 550, color: { r: 255, g: 20, b: 0 } }),
    reset: Object.freeze({ strongMagnitude: 0.3, weakMagnitude: 0.3, duration: 120, color: { r: 0, g: 200, b: 255 } }),
    bump: Object.freeze({ strongBase: 0.35, strongPerImpact: 1 / 14, weakMagnitude: 0.75, duration: 180, color: { r: 255, g: 50, b: 0 } }),
    coin: Object.freeze({ strongBase: 0.1, strongPerValue: 0.05, weakBase: 0.55, weakPerValue: 0.1, durationBase: 80, durationPerValue: 30 }),
    test: Object.freeze({ strongMagnitude: 1, weakMagnitude: 1, duration: 500, color: { r: 0, g: 255, b: 180 } }),
  }),
});

const PULSE_EVERY = HAPTIC_PARAMS.pulseEvery;
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

export class HapticController {
  constructor(bus) {
    this.lastPulse = -Infinity;
    this.effectUntil = 0;
    this.dualSense = new DualSenseHaptics();
    this.isTerrainRumbling = false;
    this.userInteracted = false;

    setWebHidPadGetter(() => (this.dualSense.connected ? this.dualSense.inputState : null));

    if (typeof window !== 'undefined') {
      const onUserAction = () => { this.userInteracted = true; };
      window.addEventListener('pointerdown', onUserAction, { passive: true });
      window.addEventListener('keydown', onUserAction, { passive: true });
    }

    this.status = {
      pad: 'nenhum controle detectado (pressione um botão no controle)',
      actuator: '—',
      activation: false,
      lastResult: '—',
      lastError: '',
      okCount: 0,
      errCount: 0,
      webhid: this.dualSense.supported ? 'aguardando conexão' : 'indisponível',
    };

    bus.on('vehicle:crash', ({ vehicle }) => {
      if (vehicle.id === 'player') {
        const p = HAPTIC_PARAMS.effects.crash;
        this.pulse({
          strongMagnitude: p.strongMagnitude,
          weakMagnitude: p.weakMagnitude,
          duration: p.duration,
          color: p.color,
          r2Effect: TRIGGER_EFFECTS.vibration(0, 8, 40),
          l2Effect: TRIGGER_EFFECTS.vibration(0, 8, 40),
          playerLeds: 0x1f,
        });
      }
    });

    // Moeda: toque curto e agudo; luz na cor da moeda correspondente
    bus.on('coin:collected', ({ vehicle, value }) => {
      if (vehicle.id === 'player') {
        const p = HAPTIC_PARAMS.effects.coin;
        const color = COIN_HAPTIC_COLORS[value] || COIN_HAPTIC_COLORS[1];
        this.pulse({
          strongMagnitude: p.strongBase + value * p.strongPerValue,
          weakMagnitude: p.weakBase + value * p.weakPerValue,
          duration: p.durationBase + value * p.durationPerValue,
          color,
          playerLeds: 0x1f,
        });
      }
    });

    // Batida em obstáculo: força proporcional à velocidade do impacto
    bus.on('vehicle:bump', ({ vehicle, impact }) => {
      if (vehicle.id === 'player') {
        const p = HAPTIC_PARAMS.effects.bump;
        this.pulse({
          strongMagnitude: clamp01(p.strongBase + impact * p.strongPerImpact),
          weakMagnitude: p.weakMagnitude,
          duration: p.duration,
          color: p.color,
          l2Effect: TRIGGER_EFFECTS.snap(1, 5, 7),
        });
      }
    });

    bus.on('vehicle:reset', ({ vehicle }) => {
      if (vehicle.id === 'player') {
        const p = HAPTIC_PARAMS.effects.reset;
        this.pulse({
          strongMagnitude: p.strongMagnitude,
          weakMagnitude: p.weakMagnitude,
          duration: p.duration,
          color: p.color,
        });
      }
    });

    bus.on('match:pause', () => this.stop());
  }

  async connectDualSense() {
    try {
      if (this.dualSense.connected) {
        this.test();
        return true;
      }
      const connected = await this.dualSense.connect();
      const linkName = this.dualSense.link.toUpperCase();
      this.status.webhid = connected ? `conectado via ${linkName}` : 'conexão cancelada';
      this.status.lastError = '';
      if (connected) {
        this.status.actuator = `DualSense WebHID (${linkName})`;
        this.test();
      }
      return connected;
    } catch (e) {
      this.status.webhid = 'falhou';
      this._fail(e?.message || String(e));
      return false;
    }
  }

  async reconnectDualSense() {
    try {
      const connected = await this.dualSense.reconnectAuthorized();
      const linkName = this.dualSense.link.toUpperCase();
      this.status.webhid = connected
        ? `conectado via ${linkName}`
        : (this.dualSense.supported ? 'não autorizado' : 'indisponível');
      if (connected) {
        this.status.actuator = `DualSense WebHID (${linkName})`;
      }
      return connected;
    } catch (e) {
      this.status.webhid = 'falhou';
      this._fail(e?.message || String(e));
      return false;
    }
  }

  refresh() {
    const pad = getActivePad();
    const act = pad?.vibrationActuator;
    this.status.pad = pad ? `${pad.id}` : this.status.pad;

    if (this.dualSense.connected) {
      const linkName = this.dualSense.link.toUpperCase();
      this.status.actuator = `DualSense WebHID (${linkName})`;
      this.status.webhid = `conectado via ${linkName}`;
    } else if (pad) {
      this.status.actuator = act
        ? `Gamepad (${act.type ?? 'desconhecido'})`
        : 'Gamepad sem vibração nativa; use o botão para conectar DualSense WebHID';
    } else {
      this.status.actuator = '—';
    }

    const hasActivation =
      (typeof navigator !== 'undefined' && !!navigator.userActivation?.hasBeenActive) ||
      this.userInteracted ||
      !!pad;
    this.status.activation = hasActivation;
  }

  // Chamado a cada quadro com a telemetria do jogador
  update(timeSeconds, vehicle, weather, trainNear = 0) {
    if (vehicle.id !== 'player' || vehicle.stunned) return;

    const moving = Math.abs(vehicle.speed) >= 0.5;
    if (!moving && trainNear <= 0) {
      if (this.isTerrainRumbling) {
        this.isTerrainRumbling = false;
        if (this.dualSense.connected) {
          this.pulse({
            strongMagnitude: 0,
            weakMagnitude: 0,
            duration: 0,
            playerLeds: 0x04,
            r2Effect: TRIGGER_EFFECTS.off(),
            l2Effect: TRIGGER_EFFECTS.off(),
          });
        } else {
          this.stop();
        }
      }
      return;
    }

    if (timeSeconds - this.lastPulse < PULSE_EVERY) return;

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs < this.effectUntil) return;

    this.lastPulse = timeSeconds;
    this.isTerrainRumbling = true;

    const surfaceKey = vehicle.surface || 'asfalto';
    const surf = SURFACES[surfaceKey] || SURFACES.asfalto;
    const speedRatio = moving ? Math.min(1, Math.abs(vehicle.speed) / HAPTIC_PARAMS.speedForFullIntensity) : 0;
    const absSpeed = Math.abs(vehicle.speed);

    // 1. Texturas táteis base
    const relief = Math.min(1, Math.abs(vehicle.slope) * 4);
    let strong = surf.strong * speedRatio + relief * HAPTIC_PARAMS.reliefScale * speedRatio;
    let weak = surf.weak * speedRatio + (weather?.hapticWeak ?? 0);

    // 2. Micro-texturas granulares por terreno
    if (surfaceKey === 'asfalto') {
      // Ronco liso e suave que ganha vibração aerodinâmica em alta velocidade
      if (speedRatio > 0.8) weak += (speedRatio - 0.8) * 0.25;
    } else if (surfaceKey === 'terra') {
      // Cascalho irregular batendo no chassi
      const gravel = Math.abs(Math.sin(timeSeconds * 43) * Math.cos(timeSeconds * 71));
      weak += gravel * 0.22 * speedRatio;
    } else if (surfaceKey === 'grama') {
      // Atrito aveludado e contínuo da vegetação
      const grassFlutter = (Math.sin(timeSeconds * 35) + 1) * 0.08;
      weak += grassFlutter * speedRatio;
    } else if (surfaceKey === 'pedra') {
      // Impactos secos e triturados
      const crunch = Math.sin(timeSeconds * 30) > 0 ? 0.35 : 0.08;
      strong += crunch * speedRatio;
      weak += 0.25 * speedRatio;
    } else if (surfaceKey === 'lama') {
      // Sucção e borbulhamento pesado em ~4 Hz
      const suction = Math.floor(timeSeconds * 8) % 2 === 0 ? 0.45 : 0.12;
      strong += suction * speedRatio;
      weak += 0.12 * speedRatio;
    }

    // 3. Travessia dos trilhos de trem: ritmo dos dormentes de madeira (sleeper spacing = 0.65 m)
    const distRail = vehicle.terrain ? vehicle.terrain.distanceToRail(vehicle.x, vehicle.z) : 999;
    const railBedHalf = CONFIG?.rail?.bedHalf ?? 2.2;
    if (distRail <= railBedHalf && moving) {
      const sleeperPhase = Math.sin(((vehicle.x + vehicle.z) / 0.65) * Math.PI);
      const sleeperClick = Math.max(0, sleeperPhase) ** 4;
      strong += sleeperClick * 0.4 * speedRatio;
      weak += sleeperClick * 0.35 * speedRatio;
    }

    // 4. Pingos de chuva no teto (micro-impactos aleatórios no motor direito)
    if (weather?.id === 'chuva') {
      const droplet = Math.sin(timeSeconds * 88.5) > 0.72 ? 0.12 : 0;
      weak += droplet;
    }

    // 5. Derrapagem e perda de agarre (Drift)
    const absSlip = Math.abs(vehicle.slip);
    const slide = Math.min(1, absSlip / 6);
    weak = Math.max(weak, slide * HAPTIC_PARAMS.slipScale);

    // 6. Trem se aproximando do cruzamento: pulso ritmado que acelera
    if (trainNear > 0 && Math.floor(timeSeconds * 8) % 2 === 0) {
      strong = Math.max(strong, HAPTIC_PARAMS.trainBase + trainNear * HAPTIC_PARAMS.trainScale);
    }

    // 7. Gatilhos Adaptáveis (R2 Acelerador e L2 Freio/Ré)
    const throttle = vehicle.controls?.throttle ?? (vehicle.speed > 0 ? 0.6 : 0);
    const brake = vehicle.controls?.brake ?? 0;
    let r2Effect = TRIGGER_EFFECTS.off();
    let l2Effect = TRIGGER_EFFECTS.off();

    // R2: Resistência física em lama e subida de encostas
    if (surfaceKey === 'lama') {
      r2Effect = TRIGGER_EFFECTS.feedback(1, 6);
    } else if (vehicle.slope > 0.08) {
      const slopeForce = Math.min(8, Math.round(3 + vehicle.slope * 15));
      r2Effect = TRIGGER_EFFECTS.feedback(1, slopeForce);
    } else if (surfaceKey === 'terra') {
      r2Effect = TRIGGER_EFFECTS.feedback(2, 3);
    } else {
      r2Effect = TRIGGER_EFFECTS.feedback(3, 2);
    }

    // R2: Tremor de patinagem de rodas (Wheel Spin) ao acelerar sem tração
    const isSpinning = throttle > 0.5 && (absSlip > 1.4 || (surfaceKey === 'lama' && absSpeed < 4));
    if (isSpinning) {
      r2Effect = TRIGGER_EFFECTS.vibration(1, 6, 28);
    }

    // L2: Simulação de ABS e Marcha Ré
    const isReversing = vehicle.speed < -0.2 && throttle < 0;
    if (isReversing) {
      l2Effect = TRIGGER_EFFECTS.snap(2, 6, 6); // estalo mecânico de engate da ré
    } else if (brake > 0.3) {
      const isAbsActive = absSlip > 1.0 || weather?.id === 'chuva' || weather?.id === 'neve';
      if (isAbsActive) {
        l2Effect = TRIGGER_EFFECTS.vibration(1, 7, 24); // trepidação rítmica de pedal com ABS
      } else {
        l2Effect = TRIGGER_EFFECTS.feedback(2, 5); // resistência hidráulica progressiva
      }
    }

    // 8. Tacômetro nos 5 LEDs de Jogador (0 a 94 km/h)
    let playerLeds = 0x04; // 1 LED central
    const speedKmh = absSpeed * 3.6;
    if (isReversing) {
      playerLeds = 0x11; // LEDs externos piscando em ré
    } else if (speedKmh < 15) {
      playerLeds = 0x04; // 1 LED
    } else if (speedKmh < 35) {
      playerLeds = 0x0e; // 3 LEDs centrais
    } else if (speedKmh < 65) {
      playerLeds = 0x1b; // 4 LEDs
    } else {
      playerLeds = 0x1f; // Todos os 5 LEDs em velocidade máxima!
    }

    // 9. Cor dinâmica da Lightbar
    let color = SURFACE_COLORS[surfaceKey] || SURFACE_COLORS.asfalto;
    if (trainNear > 0.25) {
      color = { r: 255, g: Math.round(30 * (1 - trainNear)), b: 0 }; // Vermelho de trem
    } else if (absSlip > 2.2) {
      color = { r: 255, g: 195, b: 0 }; // Amarelo de tração/drift
    }

    this.pulse({
      strongMagnitude: clamp01(strong),
      weakMagnitude: clamp01(weak),
      duration: HAPTIC_PARAMS.terrainDuration,
      isContinuous: true,
      color,
      playerLeds,
      r2Effect,
      l2Effect,
    });
  }

  pulse({
    strongMagnitude,
    weakMagnitude,
    duration = 0,
    isContinuous = false,
    color = null,
    playerLeds = null,
    r2Effect = null,
    l2Effect = null,
  }) {
    const strong = clamp01(strongMagnitude);
    const weak = clamp01(weakMagnitude);

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!isContinuous && duration > 0) {
      this.effectUntil = nowMs + duration;
    }

    if (this.dualSense.connected) {
      const sent = this.dualSense.pulse({
        strongMagnitude: strong,
        weakMagnitude: weak,
        duration,
        color,
        playerLeds,
        r2Effect,
        l2Effect,
      });

      if (!sent) {
        this._fail('DualSense WebHID desconectado');
        return false;
      }
      if (typeof sent.then === 'function') {
        sent.then((ok) => {
          if (ok) this._ok();
          else this._fail(this.dualSense.lastError?.message || 'falha ao enviar relatório WebHID');
        });
      } else {
        this._ok();
      }
      return true;
    }

    const pad = getActivePad();
    const actuator = pad?.vibrationActuator;

    if (!actuator) {
      this._fail('sem atuador Gamepad; conecte o DualSense via WebHID pelo botão na tela');
      return false;
    }

    const hasActivation =
      (typeof navigator !== 'undefined' && !!navigator.userActivation?.hasBeenActive) ||
      this.userInteracted ||
      !!pad;
    if (!hasActivation) {
      this._fail('bloqueada: clique na página antes (o navegador exige um clique)');
      return false;
    }

    try {
      actuator
        .playEffect('dual-rumble', {
          startDelay: 0,
          duration,
          weakMagnitude: weak,
          strongMagnitude: strong,
        })
        .then(() => this._ok())
        .catch((e) => {
          const msg = e?.message || String(e);
          if (e?.name !== 'AbortError' && !msg.toLowerCase().includes('preempted')) {
            this._fail(msg);
          }
        });
    } catch (e) {
      this._fail(e?.message || String(e));
      return false;
    }
    return true;
  }

  // Vibração de teste com efeitos completos (F3 ou botão)
  test() {
    const p = HAPTIC_PARAMS.effects.test;
    return this.pulse({
      strongMagnitude: p.strongMagnitude,
      weakMagnitude: p.weakMagnitude,
      duration: p.duration,
      color: p.color,
      r2Effect: TRIGGER_EFFECTS.vibration(1, 6, 30),
      l2Effect: TRIGGER_EFFECTS.feedback(1, 6),
      playerLeds: 0x1f,
    });
  }

  stop() {
    getActivePad()?.vibrationActuator?.reset?.();
    this.dualSense.stop();
  }

  _ok() {
    this.status.okCount += 1;
    this.status.lastResult = 'ok';
    this.status.lastError = '';
  }

  _fail(message) {
    this.status.errCount += 1;
    this.status.lastResult = 'falhou';
    this.status.lastError = message;
  }
}
