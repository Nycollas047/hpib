// Sistema de áudio procedural com Web Audio API.
// Sintetiza áudio de alta fidelidade em tempo real sem depender de arquivos externos:
// - Motor procedural com RPM dinâmico, aceleração, marcha e filtro de aspiração
// - Canto de pneus / derrapagem (skid) modulado pela perda de agarre lateral (slip)
// - Moedas com acordes melódicos brilhantes por valor (1 a 4)
// - Batidas e colisões com transiente metálico e sub-grave
// - Estalo mecânico de travessia de dormentes na ferrovia
// - Sino de alerta dos cruzamentos de trem
// - Suporta saída padrão do navegador e alto-falante integrado do DualSense quando disponível

const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;

export class SoundSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.initialized = false;

    // Motor
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.currentRpm = 80;

    // Derrapagem
    this.skidGain = null;
    this.skidFilter = null;

    // Controle de tempo para sino e trilhos
    this.lastRailClick = 0;
    this.lastBell = 0;
  }

  init() {
    if (this.initialized || !AudioCtx) return;
    try {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.65;
      this.master.connect(this.ctx.destination);

      this._initEngine();
      this._initSkid();
      this.initialized = true;
    } catch {
      // Navegadores sem suporte ou contexto bloqueado
    }
  }

  resume() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _initEngine() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Oscilador 1: Onda dente de serra para ronco mecânico
    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 65;

    // Oscilador 2: Onda triangular para graves profundos dos pistões
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.value = 32.5;

    // Filtro passa-baixa que abre com o acelerador
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineFilter.Q.value = 2.5;

    // Ganho do motor
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.12;

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  _initSkid() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Buffer de ruído branco para derrapagem
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.skidFilter = ctx.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.value = 850;
    this.skidFilter.Q.value = 3.5;

    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;

    whiteNoise.connect(this.skidFilter);
    this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.master);

    whiteNoise.start();
  }

  // Atualização contínua por quadro
  update(vehicle, match, now, dt) {
    if (!this.initialized || !this.ctx || this.ctx.state !== 'running') return;

    const absSpeed = Math.abs(vehicle.speed);
    const speedRatio = Math.min(1, absSpeed / 26);
    const throttle = vehicle.controls?.throttle ?? (vehicle.speed > 0 ? 0.5 : 0);
    const brake = vehicle.controls?.brake ?? 0;

    // 1. Sintetizador de RPM do motor
    // Simula troca de marchas conforme a velocidade sobe
    const gear = Math.min(3, Math.floor(absSpeed / 7.5));
    const gearFraction = (absSpeed % 7.5) / 7.5;
    const targetFreq = 50 + gear * 12 + gearFraction * 45 + (throttle > 0 ? 25 * throttle : 0);

    this.currentRpm += (targetFreq - this.currentRpm) * Math.min(1, dt * 10);
    const t = this.ctx.currentTime;
    if (this.engineOsc1) {
      this.engineOsc1.frequency.setValueAtTime(this.currentRpm, t);
      this.engineOsc2.frequency.setValueAtTime(this.currentRpm * 0.5, t);
    }
    if (this.engineFilter) {
      const targetCutoff = 250 + speedRatio * 450 + (throttle > 0 ? 500 * throttle : 0);
      this.engineFilter.frequency.setValueAtTime(targetCutoff, t);
    }
    if (this.engineGain) {
      const targetGain = 0.08 + speedRatio * 0.12 + (throttle > 0 ? 0.06 : 0);
      this.engineGain.gain.setValueAtTime(targetGain, t);
    }

    // 2. Canto de pneu / Skid
    const absSlip = Math.abs(vehicle.slip);
    if (this.skidGain && this.skidFilter) {
      let skidVol = 0;
      if (absSlip > 1.2 && absSpeed > 2) {
        skidVol = Math.min(0.28, (absSlip - 1.2) * 0.07);
      }
      if (brake > 0.6 && absSpeed > 6) {
        skidVol = Math.max(skidVol, 0.2);
      }
      this.skidGain.gain.setValueAtTime(skidVol, t);
      this.skidFilter.frequency.setValueAtTime(800 + absSlip * 120, t);
    }

    // 3. Estalo rítmico dos dormentes na ferrovia
    const distRail = vehicle.terrain ? vehicle.terrain.distanceToRail(vehicle.x, vehicle.z) : 999;
    const railBedHalf = CONFIG?.rail?.bedHalf ?? 2.2;
    if (distRail <= railBedHalf && absSpeed > 2) {
      const interval = 0.65 / Math.max(1, absSpeed);
      if (now - this.lastRailClick > interval) {
        this.lastRailClick = now;
        this.playRailClick(absSpeed);
      }
    }

    // 4. Sino do cruzamento de trem quando próximo e sinal fechado/aviso
    const hazard = match ? match.hazardFor(vehicle) : null;
    if (hazard && hazard.dist < 85 && (hazard.state === 'red' || hazard.state === 'warn')) {
      const bellInterval = hazard.state === 'red' ? 0.45 : 0.9;
      if (now - this.lastBell > bellInterval) {
        this.lastBell = now;
        this.playCrossingBell(hazard.state === 'red');
      }
    }
  }

  // Moeda coletada: acordes melódicos brilhantes por valor
  playCoin(value = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const chords = {
      1: [880],                     // A5
      2: [784, 1046],               // G5 -> C6
      3: [659, 880, 1318],          // E5 -> A5 -> E6
      4: [587, 880, 1174, 1760],    // D5 -> A5 -> D6 -> A6
    };

    const notes = chords[value] || chords[1];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);

      gain.gain.setValueAtTime(0, now + idx * 0.045);
      gain.gain.linearRampToValueAtTime(0.22, now + idx * 0.045 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.35);

      osc.connect(gain);
      gain.connect(this.master);

      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.36);
    });
  }

  // Batida em obstáculo
  playBump(impact = 10) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const strength = Math.max(0.1, Math.min(1, impact / 20));

    // Sub grave
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.22);

    const initVol = Math.max(0.02, 0.35 * strength);
    gain.gain.setValueAtTime(initVol, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.master);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Colisão com trem (crash pesado)
  playCrash() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Explosão grave
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.6);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.65);

    osc.connect(gain);
    gain.connect(this.master);

    osc.start(now);
    osc.stop(now + 0.66);
  }

  // Estalo de dormente de ferrovia
  playRailClick(speed = 10) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vol = Math.max(0.02, Math.min(0.18, 0.04 + (speed / 26) * 0.14));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.04);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.master);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Sino de cruzamento de trem
  playCrossingBell(urgent = false) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(urgent ? 1760 : 1560, now); // A6

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.master);

    osc.start(now);
    osc.stop(now + 0.4);
  }
}
