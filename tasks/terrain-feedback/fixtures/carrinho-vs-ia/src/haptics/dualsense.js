// Háptica direta no DualSense via WebHID (USB e Bluetooth).
//
// Suporta:
// - Atuadores de bobina de voz (motores esquerdo grave e direito agudo)
// - Gatilhos Adaptáveis (R2 acelerador e L2 freio/ré) com Feedback, Vibration e Snap
// - Barra de luz RGB colorida reativa
// - 5 LEDs brancos de jogador (Player LEDs) abaixo do touchpad
// - Protocolo USB (0x02) e Bluetooth (0x31) com CRC32

const SONY_VID = 0x054c;
const DUALSENSE_PIDS = [0x0ce6, 0x0df2]; // DualSense e DualSense Edge

const REPORT_ID_USB = 0x02;
const REPORT_ID_BT = 0x31;
const DEFAULT_LEN_USB = 63;
const DEFAULT_LEN_BT = 77;

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

// Tabela e cálculo de CRC32 padrão (IEEE 802.3) para relatórios Bluetooth do DualSense
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeDualSenseCrc32(prefix, view) {
  let crc = 0xffffffff;
  for (const byte of prefix) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  for (let i = 0; i < view.byteLength; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ view.getUint8(i)) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function fillBluetoothChecksum(reportId, data) {
  const crc = computeDualSenseCrc32([0xa2, reportId], new DataView(data.buffer, 0, data.byteLength - 4));
  const n = data.byteLength;
  data[n - 4] = crc & 0xff;
  data[n - 3] = (crc >>> 8) & 0xff;
  data[n - 2] = (crc >>> 16) & 0xff;
  data[n - 1] = (crc >>> 24) & 0xff;
}

export function detectLinkType(device) {
  let hasUsb = false;
  let hasBt = false;
  for (const col of device?.collections || []) {
    for (const rep of col.outputReports || []) {
      if (rep.reportId === REPORT_ID_USB) hasUsb = true;
      if (rep.reportId === REPORT_ID_BT) hasBt = true;
    }
  }
  if (hasUsb) return 'usb';
  if (hasBt) return 'bluetooth';

  for (const col of device?.collections || []) {
    for (const rep of col.inputReports || []) {
      if (rep.reportId === REPORT_ID_BT) return 'bluetooth';
    }
  }
  return 'usb';
}

export function getOutputReportLength(device, reportId, fallbackLength) {
  for (const col of device?.collections || []) {
    for (const rep of col.outputReports || []) {
      if (rep.reportId === reportId) {
        const bits = (rep.items || []).reduce(
          (sum, item) => sum + (item.reportSize || 0) * (item.reportCount || 0),
          0
        );
        if (bits > 0) return Math.ceil(bits / 8);
      }
    }
  }
  return fallbackLength;
}

// ============================================================
// Geradores de Efeitos para os Gatilhos Adaptáveis (11 bytes cada)
// ============================================================
export const TRIGGER_EFFECTS = Object.freeze({
  off() {
    return new Uint8Array(11);
  },
  // Resistência progressiva/firme a partir da posição (0..9) com força (1..8)
  feedback(position = 0, strength = 4) {
    if (strength <= 0 || position > 9) return TRIGGER_EFFECTS.off();
    const str = Math.max(1, Math.min(8, Math.round(strength)));
    const pos = Math.max(0, Math.min(9, Math.round(position)));
    const f = (str - 1) & 7;
    let fz = 0;
    let az = 0;
    for (let i = pos; i < 10; i++) {
      fz |= f << (3 * i);
      az |= 1 << i;
    }
    const res = new Uint8Array(11);
    res[0] = 0x21; // Mode Rigid_A
    res[1] = az & 0xff;
    res[2] = (az >> 8) & 0xff;
    res[3] = fz & 0xff;
    res[4] = (fz >> 8) & 0xff;
    res[5] = (fz >> 16) & 0xff;
    res[6] = (fz >> 24) & 0xff;
    return res;
  },
  // Vibração / trepidação sob o dedo (ex: ABS ou patinagem de rodas)
  vibration(position = 0, amplitude = 5, frequency = 25) {
    if (amplitude <= 0 || position > 9) return TRIGGER_EFFECTS.off();
    const amp = Math.max(1, Math.min(8, Math.round(amplitude)));
    const pos = Math.max(0, Math.min(9, Math.round(position)));
    const freq = Math.max(1, Math.min(255, Math.round(frequency)));
    const a = (amp - 1) & 7;
    let az = 0;
    let zn = 0;
    for (let i = pos; i < 10; i++) {
      az |= a << (3 * i);
      zn |= 1 << i;
    }
    const res = new Uint8Array(11);
    res[0] = 0x26; // Mode Pulse_AB
    res[1] = zn & 0xff;
    res[2] = (zn >> 8) & 0xff;
    res[3] = az & 0xff;
    res[4] = (az >> 8) & 0xff;
    res[5] = (az >> 16) & 0xff;
    res[6] = (az >> 24) & 0xff;
    res[9] = freq & 0xff;
    return res;
  },
  // Estalo mecânico (como engate de ré ou trava de marcha)
  snap(start = 2, end = 7, strength = 6) {
    const s = Math.max(0, Math.min(7, Math.round(start)));
    const e = Math.max(s + 1, Math.min(8, Math.round(end)));
    const str = Math.max(1, Math.min(8, Math.round(strength)));
    const z = (1 << s) | (1 << e);
    const res = new Uint8Array(11);
    res[0] = 0x25; // Mode Rigid_AB
    res[1] = z & 0xff;
    res[2] = (z >> 8) & 0xff;
    res[3] = (str - 1) & 7;
    return res;
  },
});

const normStick = (u8) => Math.max(-1, Math.min(1, ((u8 ?? 128) - 128) / 127));
const makeBtn = (pressed, value = pressed ? 1 : 0) => ({ pressed: !!pressed, value });

// Converte relatórios de entrada WebHID do DualSense (USB 0x01, BT 0x31 e BT simples 0x01)
// para o formato "standard" da Gamepad API (4 eixos, 17 botões).
export function parseDualSenseInputReport(reportId, data, link = 'usb') {
  if (!data || typeof data.getUint8 !== 'function' || data.byteLength < 7) return null;

  let lx = 128, ly = 128, rx = 128, ry = 128;
  let l2 = 0, r2 = 0;
  let b0 = 0x08, b1 = 0, b2 = 0;

  if (reportId === REPORT_ID_BT && data.byteLength >= 11) {
    // Relatório Bluetooth completo 0x31: byte 0 é cabeçalho BT, dados começam no byte 1
    lx = data.getUint8(1);
    ly = data.getUint8(2);
    rx = data.getUint8(3);
    ry = data.getUint8(4);
    l2 = data.getUint8(5);
    r2 = data.getUint8(6);
    b0 = data.getUint8(8);
    b1 = data.getUint8(9);
    b2 = data.getUint8(10);
  } else if (reportId === 0x01 && (data.byteLength >= 40 || (link === 'usb' && data.byteLength >= 10))) {
    // Relatório USB 0x01 (63 bytes sem reportId)
    lx = data.getUint8(0);
    ly = data.getUint8(1);
    rx = data.getUint8(2);
    ry = data.getUint8(3);
    l2 = data.getUint8(4);
    r2 = data.getUint8(5);
    b0 = data.getUint8(7);
    b1 = data.getUint8(8);
    b2 = data.getUint8(9);
  } else if (reportId === 0x01 && data.byteLength >= 7) {
    // Relatório Bluetooth básico 0x01 (9 bytes sem reportId)
    lx = data.getUint8(0);
    ly = data.getUint8(1);
    rx = data.getUint8(2);
    ry = data.getUint8(3);
    b0 = data.getUint8(4);
    b1 = data.getUint8(5);
    b2 = data.getUint8(6);
    l2 = data.byteLength > 7 ? data.getUint8(7) : ((b1 & 0x04) ? 255 : 0);
    r2 = data.byteLength > 8 ? data.getUint8(8) : ((b1 & 0x08) ? 255 : 0);
  } else {
    return null;
  }

  const hat = b0 & 0x0f;
  const dpadUp = hat === 0 || hat === 1 || hat === 7;
  const dpadRight = hat === 1 || hat === 2 || hat === 3;
  const dpadDown = hat === 3 || hat === 4 || hat === 5;
  const dpadLeft = hat === 5 || hat === 6 || hat === 7;

  const l2Btn = (b1 & 0x04) !== 0;
  const r2Btn = (b1 & 0x08) !== 0;
  const l2Val = l2 > 0 ? clamp01(l2 / 255) : (l2Btn ? 1 : 0);
  const r2Val = r2 > 0 ? clamp01(r2 / 255) : (r2Btn ? 1 : 0);

  return {
    id: `DualSense Wireless Controller (WebHID ${link.toUpperCase()})`,
    connected: true,
    mapping: 'standard',
    axes: [normStick(lx), normStick(ly), normStick(rx), normStick(ry)],
    buttons: [
      makeBtn(b0 & 0x20),                     // 0: Cruz (X)
      makeBtn(b0 & 0x40),                     // 1: Círculo
      makeBtn(b0 & 0x10),                     // 2: Quadrado
      makeBtn(b0 & 0x80),                     // 3: Triângulo
      makeBtn(b1 & 0x01),                     // 4: L1
      makeBtn(b1 & 0x02),                     // 5: R1
      makeBtn(l2Val > 0.04 || l2Btn, l2Val),  // 6: L2
      makeBtn(r2Val > 0.04 || r2Btn, r2Val),  // 7: R2
      makeBtn(b1 & 0x10),                     // 8: Create
      makeBtn(b1 & 0x20),                     // 9: Options
      makeBtn(b1 & 0x40),                     // 10: L3
      makeBtn(b1 & 0x80),                     // 11: R3
      makeBtn(dpadUp),                        // 12: D-Pad Cima
      makeBtn(dpadDown),                      // 13: D-Pad Baixo
      makeBtn(dpadLeft),                      // 14: D-Pad Esquerda
      makeBtn(dpadRight),                     // 15: D-Pad Direita
      makeBtn(b2 & 0x01),                     // 16: PS
    ],
  };
}

export class DualSenseHaptics {
  constructor() {
    this.device = null;
    this.link = 'unknown'; // 'usb' | 'bluetooth' | 'unknown'
    this.reportId = REPORT_ID_USB;
    this.reportLength = DEFAULT_LEN_USB;
    this.outSeq = 0;
    this.inputState = null;

    this.targetStrong = 0;
    this.targetWeak = 0;
    this.targetColor = { r: 0, g: 120, b: 255 };
    this.targetPlayerLeds = 0x04; // LED central
    this.targetR2Effect = TRIGGER_EFFECTS.off();
    this.targetL2Effect = TRIGGER_EFFECTS.off();

    this.isSending = false;
    this.needsSend = false;
    this.stopTimer = null;
    this.lastError = null;

    this._onInputReport = (e) => {
      if (e.reportId === REPORT_ID_BT && this.link !== 'bluetooth') {
        this.link = 'bluetooth';
        this.reportId = REPORT_ID_BT;
        this.reportLength = DEFAULT_LEN_BT;
      }
      const parsed = parseDualSenseInputReport(e.reportId, e.data, this.link);
      if (parsed) this.inputState = parsed;
    };

    if (this.supported) {
      navigator.hid.addEventListener('disconnect', (e) => {
        if (e.device === this.device) {
          this._stopTimer();
          this.device = null;
          this.inputState = null;
          this.link = 'unknown';
        }
      });

      navigator.hid.addEventListener('connect', async (e) => {
        if (this._isDualSenseDevice(e.device) && !this.connected) {
          try {
            await this._attachDevice(e.device);
          } catch {
            // falhas silenciosas em reconnect automático
          }
        }
      });
    }
  }

  get supported() {
    return typeof navigator !== 'undefined' && 'hid' in navigator && !!navigator.hid;
  }

  get connected() {
    return !!this.device?.opened;
  }

  get busy() {
    return this.isSending;
  }

  async connect() {
    if (!this.supported) throw new Error('WebHID indisponível: use Chrome ou Edge');

    const filters = [
      { vendorId: SONY_VID, productId: 0x0ce6 },
      { vendorId: SONY_VID, productId: 0x0df2 },
      { vendorId: SONY_VID },
    ];

    const devices = await navigator.hid.requestDevice({ filters });
    if (!devices || devices.length === 0) return false;

    await this._attachDevice(devices[0]);
    return true;
  }

  async reconnectAuthorized() {
    if (!this.supported) return false;
    const devices = await navigator.hid.getDevices();
    const device = devices.find((item) => this._isDualSenseDevice(item));
    if (!device) return false;

    await this._attachDevice(device);
    return true;
  }

  _isDualSenseDevice(dev) {
    if (!dev) return false;
    if (dev.vendorId !== SONY_VID) return false;
    if (DUALSENSE_PIDS.includes(dev.productId)) return true;
    return (dev.collections || []).some(
      (c) => c.usagePage === 0x01 && (c.usage === 0x04 || c.usage === 0x05)
    );
  }

  async _attachDevice(device) {
    if (!device.opened) {
      await device.open();
    }

    this.link = detectLinkType(device);
    this.reportId = this.link === 'bluetooth' ? REPORT_ID_BT : REPORT_ID_USB;
    this.reportLength = getOutputReportLength(
      device,
      this.reportId,
      this.link === 'bluetooth' ? DEFAULT_LEN_BT : DEFAULT_LEN_USB
    );

    if (this.link === 'bluetooth') {
      try {
        await device.receiveFeatureReport(0x05);
      } catch {
        // Ignorado se não for suportado pela pilha BT do sistema
      }
    }

    if (this.device && this.device !== device) {
      this.device.removeEventListener?.('inputreport', this._onInputReport);
    }
    device.removeEventListener?.('inputreport', this._onInputReport);
    device.addEventListener?.('inputreport', this._onInputReport);

    this.device = device;
    this.lastError = null;
    if (!this.inputState) {
      this.inputState = {
        id: `DualSense Wireless Controller (WebHID ${this.link.toUpperCase()})`,
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      };
    }
  }

  // Define o estado completo da háptica: vibração, luzes e gatilhos adaptáveis
  setHapticState({
    strongMagnitude = 0,
    weakMagnitude = 0,
    duration = 0,
    color = null,
    playerLeds = null,
    r2Effect = null,
    l2Effect = null,
  } = {}) {
    if (!this.connected) return false;

    this.targetStrong = clamp01(strongMagnitude);
    this.targetWeak = clamp01(weakMagnitude);

    if (color) this.targetColor = color;
    if (playerLeds !== null) this.targetPlayerLeds = playerLeds & 0x1f;
    if (r2Effect !== null) this.targetR2Effect = r2Effect;
    if (l2Effect !== null) this.targetL2Effect = l2Effect;

    this._stopTimer();
    if (duration > 0) {
      this.stopTimer = setTimeout(() => {
        this.stopTimer = null;
        this.targetStrong = 0;
        this.targetWeak = 0;
        this._dispatch();
      }, duration);
    }

    return this._dispatch();
  }

  // Compatibilidade com a interface pulse simples
  pulse({
    strongMagnitude = 0,
    weakMagnitude = 0,
    duration = 0,
    color = null,
    playerLeds = null,
    r2Effect = null,
    l2Effect = null,
  } = {}) {
    return this.setHapticState({
      strongMagnitude,
      weakMagnitude,
      duration,
      color,
      playerLeds,
      r2Effect,
      l2Effect,
    });
  }

  stop() {
    this._stopTimer();
    this.targetStrong = 0;
    this.targetWeak = 0;
    this.targetR2Effect = TRIGGER_EFFECTS.off();
    this.targetL2Effect = TRIGGER_EFFECTS.off();
    this.targetPlayerLeds = 0;
    return this._dispatch();
  }

  _stopTimer() {
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  async _dispatch() {
    if (!this.connected) return false;
    if (this.isSending) {
      this.needsSend = true;
      return true;
    }

    this.isSending = true;
    this.needsSend = false;
    let success = true;

    try {
      while (this.connected) {
        const strong = this.targetStrong;
        const weak = this.targetWeak;
        const color = this.targetColor;
        const playerLeds = this.targetPlayerLeds;
        const r2Effect = this.targetR2Effect;
        const l2Effect = this.targetL2Effect;

        const ok = await this._sendRaw({ strong, weak, color, playerLeds, r2Effect, l2Effect });
        if (!ok) {
          success = false;
          break;
        }

        if (
          this.needsSend ||
          strong !== this.targetStrong ||
          weak !== this.targetWeak ||
          playerLeds !== this.targetPlayerLeds ||
          r2Effect !== this.targetR2Effect ||
          l2Effect !== this.targetL2Effect
        ) {
          this.needsSend = false;
          continue;
        }
        break;
      }
    } finally {
      this.isSending = false;
    }

    return success;
  }

  async _sendRaw(arg1, arg2, arg3) {
    if (!this.connected) return false;

    let strong = 0;
    let weak = 0;
    let color = this.targetColor;
    let playerLeds = this.targetPlayerLeds;
    let r2Effect = this.targetR2Effect;
    let l2Effect = this.targetL2Effect;

    if (typeof arg1 === 'number') {
      strong = arg1;
      weak = typeof arg2 === 'number' ? arg2 : 0;
      if (arg3) color = arg3;
    } else if (arg1 && typeof arg1 === 'object') {
      strong = arg1.strong ?? 0;
      weak = arg1.weak ?? 0;
      color = arg1.color ?? this.targetColor;
      playerLeds = arg1.playerLeds ?? this.targetPlayerLeds;
      r2Effect = arg1.r2Effect ?? this.targetR2Effect;
      l2Effect = arg1.l2Effect ?? this.targetL2Effect;
    }

    const isBt = this.link === 'bluetooth';
    const reportId = isBt ? REPORT_ID_BT : REPORT_ID_USB;
    const minLen = isBt ? DEFAULT_LEN_BT : 47;
    const len = Math.max(minLen, this.reportLength || (isBt ? DEFAULT_LEN_BT : DEFAULT_LEN_USB));
    const payload = new Uint8Array(len);

    const rightMotor = Math.round(clamp01(weak) * 255);
    const leftMotor = Math.round(clamp01(strong) * 255);
    const r = color?.r ?? 0;
    const g = color?.g ?? 120;
    const b = color?.b ?? 255;
    const leds = (playerLeds ?? 0) & 0x1f;

    if (isBt) {
      this.outSeq = (this.outSeq + 1) & 0x0f;
      payload[0] = this.outSeq << 4;
      payload[1] = 0x10; // DS_OUTPUT_TAG

      // Dados comuns com deslocamento de +2 bytes para o frame Bluetooth
      payload[2] = 0xff; // valid_flag0 (0x01 | 0x02 = rumble, 0x04/0x08 = gatilhos)
      payload[3] = 0xf7; // valid_flag1 (áudio e LEDs)
      payload[4] = rightMotor; // motor direito (agudo / weak)
      payload[5] = leftMotor;  // motor esquerdo (grave / strong)
      payload[10] = 0x00; // mic mute LED
      payload[11] = 0x10; // power-save normal

      // Gatilhos adaptáveis (offset 10 + 2 = 12 para R2, offset 21 + 2 = 23 para L2)
      for (let i = 0; i < 11; i++) {
        payload[12 + i] = r2Effect[i] ?? 0;
        payload[23 + i] = l2Effect[i] ?? 0;
      }

      payload[41] = 0x02; // valid_flag2 (lightbar)
      payload[43] = 0x02; // LEDs ativos
      payload[45] = leds; // 5 Player LEDs
      payload[46] = r;
      payload[47] = g;
      payload[48] = b;

      fillBluetoothChecksum(REPORT_ID_BT, payload);
    } else {
      // Relatório USB 0x02
      payload[0] = 0xff; // valid_flag0 (0x01 | 0x02 = rumble, 0x04/0x08 = gatilhos)
      payload[1] = 0xf7; // valid_flag1
      payload[2] = rightMotor; // motor direito
      payload[3] = leftMotor;  // motor esquerdo
      payload[8] = 0x00; // mic mute LED
      payload[9] = 0x10; // power-save normal

      // Gatilhos adaptáveis (offset 10 para R2, offset 21 para L2)
      for (let i = 0; i < 11; i++) {
        payload[10 + i] = r2Effect[i] ?? 0;
        payload[21 + i] = l2Effect[i] ?? 0;
      }

      if (len >= 47) {
        payload[39] = 0x02; // valid_flag2 (lightbar)
        payload[41] = 0x02; // LEDs ativos
        payload[43] = leds; // 5 Player LEDs
        payload[44] = r;
        payload[45] = g;
        payload[46] = b;
      }
    }

    try {
      await this.device.sendReport(reportId, payload);
      this.lastError = null;
      return true;
    } catch (err) {
      this.lastError = err;
      return false;
    }
  }
}
