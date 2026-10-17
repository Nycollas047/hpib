import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/core/events.js';
import {
  DualSenseHaptics,
  TRIGGER_EFFECTS,
  computeDualSenseCrc32,
  fillBluetoothChecksum,
  detectLinkType,
  getOutputReportLength,
  parseDualSenseInputReport,
} from '../src/haptics/dualsense.js';
import { HapticController, HAPTIC_PARAMS, SURFACE_COLORS } from '../src/haptics/haptics.js';
import { Input, getActivePad } from '../src/input/input.js';

// ---------- Utilitários de CRC e Link ----------
test('CRC32 do DualSense: determinístico e formato unsigned 32-bit', () => {
  const buf = new Uint8Array(73);
  buf[0] = 0x10;
  buf[2] = 0xff;
  buf[4] = 255;
  const crc1 = computeDualSenseCrc32([0xa2, 0x31], new DataView(buf.buffer));
  const crc2 = computeDualSenseCrc32([0xa2, 0x31], new DataView(buf.buffer));
  assert.equal(crc1, crc2);
  assert.ok(crc1 > 0 && crc1 <= 0xffffffff);
});

test('fillBluetoothChecksum: preenche os últimos 4 bytes com little-endian', () => {
  const data = new Uint8Array(77);
  fillBluetoothChecksum(0x31, data);
  const view = new DataView(data.buffer);
  const crcExpected = computeDualSenseCrc32([0xa2, 0x31], new DataView(data.buffer, 0, 73));
  const crcActual = view.getUint32(73, true); // true = little-endian
  assert.equal(crcActual, crcExpected);
});

test('detectLinkType: identifica USB e Bluetooth pelas coleções HID', () => {
  const usbDevice = {
    collections: [{ outputReports: [{ reportId: 0x02 }] }],
  };
  assert.equal(detectLinkType(usbDevice), 'usb');

  const btDevice = {
    collections: [{ outputReports: [{ reportId: 0x31 }] }],
  };
  assert.equal(detectLinkType(btDevice), 'bluetooth');
});

test('getOutputReportLength: calcula o comprimento em bytes a partir dos itens do relatório', () => {
  const device = {
    collections: [
      {
        outputReports: [
          {
            reportId: 0x02,
            items: [{ reportSize: 8, reportCount: 63 }],
          },
        ],
      },
    ],
  };
  assert.equal(getOutputReportLength(device, 0x02, 47), 63);
  assert.equal(getOutputReportLength(device, 0x99, 47), 47, 'usa fallback para reportId ausente');
});

// ---------- TRIGGER_EFFECTS ----------
test('TRIGGER_EFFECTS: gera payloads binários válidos de 11 bytes', () => {
  const off = TRIGGER_EFFECTS.off();
  assert.equal(off.length, 11);
  assert.equal(off[0], 0);

  const fb = TRIGGER_EFFECTS.feedback(2, 6);
  assert.equal(fb.length, 11);
  assert.equal(fb[0], 0x21, 'Mode Rigid_A');
  assert.ok(fb[1] > 0 || fb[2] > 0);

  const vib = TRIGGER_EFFECTS.vibration(1, 7, 24);
  assert.equal(vib.length, 11);
  assert.equal(vib[0], 0x26, 'Mode Pulse_AB');
  assert.equal(vib[9], 24, 'Frequência em Hz');

  const snap = TRIGGER_EFFECTS.snap(2, 6, 6);
  assert.equal(snap.length, 11);
  assert.equal(snap[0], 0x25, 'Mode Rigid_AB');
});

// ---------- DualSenseHaptics via Mock de HIDDevice ----------
function createMockHidDevice({ link = 'usb', failSend = false } = {}) {
  const reportId = link === 'bluetooth' ? 0x31 : 0x02;
  const sentReports = [];

  return {
    opened: true,
    vendorId: 0x054c,
    productId: 0x0ce6,
    collections: [
      {
        outputReports: [
          {
            reportId,
            items: [{ reportSize: 8, reportCount: link === 'bluetooth' ? 77 : 63 }],
          },
        ],
      },
    ],
    sentReports,
    async sendReport(id, data) {
      if (failSend) throw new Error('Falha simulada no canal HID');
      sentReports.push({ id, data: new Uint8Array(data) });
    },
    async receiveFeatureReport() {
      return new DataView(new ArrayBuffer(64));
    },
  };
}

test('DualSenseHaptics USB: formata relatório 0x02 com flags 0xff/0xf7, gatilhos e leds', async () => {
  const ds = new DualSenseHaptics();
  const mock = createMockHidDevice({ link: 'usb' });
  await ds._attachDevice(mock);

  assert.equal(ds.connected, true);
  assert.equal(ds.link, 'usb');
  assert.equal(ds.reportId, 0x02);

  const r2 = TRIGGER_EFFECTS.feedback(1, 6);
  const l2 = TRIGGER_EFFECTS.vibration(1, 7, 25);
  const ok = await ds._sendRaw({
    strong: 0.8,
    weak: 0.4,
    color: { r: 10, g: 200, b: 255 },
    playerLeds: 0x1f,
    r2Effect: r2,
    l2Effect: l2,
  });

  assert.equal(ok, true);
  assert.equal(mock.sentReports.length, 1);

  const rep = mock.sentReports[0];
  assert.equal(rep.id, 0x02);
  assert.ok(rep.data.length >= 47);

  // Flags fundamentais
  assert.equal(rep.data[0], 0xff, 'valid_flag0 habilita compatibilidade e haptic select');
  assert.equal(rep.data[1], 0xf7, 'valid_flag1');
  assert.equal(rep.data[2], Math.round(0.4 * 255), 'motor direito (agudo / weak)');
  assert.equal(rep.data[3], Math.round(0.8 * 255), 'motor esquerdo (grave / strong)');

  // Gatilhos nos offsets USB: R2 em 10..20, L2 em 21..31
  assert.equal(rep.data[10], 0x21, 'R2 feedback mode');
  assert.equal(rep.data[21], 0x26, 'L2 vibration mode');
  assert.equal(rep.data[43], 0x1f, '5 Player LEDs acesos');
  assert.equal(rep.data[44], 10, 'Lightbar R');
  assert.equal(rep.data[45], 200, 'Lightbar G');
  assert.equal(rep.data[46], 255, 'Lightbar B');
});

test('DualSenseHaptics Bluetooth: formata relatório 0x31 com offset +2, gatilhos e CRC32', async () => {
  const ds = new DualSenseHaptics();
  const mock = createMockHidDevice({ link: 'bluetooth' });
  await ds._attachDevice(mock);

  assert.equal(ds.connected, true);
  assert.equal(ds.link, 'bluetooth');
  assert.equal(ds.reportId, 0x31);

  const r2 = TRIGGER_EFFECTS.vibration(1, 5, 30);
  const l2 = TRIGGER_EFFECTS.snap(2, 6, 6);
  const ok = await ds._sendRaw({
    strong: 1.0,
    weak: 0.5,
    color: { r: 255, g: 120, b: 0 },
    playerLeds: 0x0e,
    r2Effect: r2,
    l2Effect: l2,
  });

  assert.equal(ok, true);
  assert.equal(mock.sentReports.length, 1);

  const rep = mock.sentReports[0];
  assert.equal(rep.id, 0x31);
  assert.equal(rep.data.length, 77);

  // Cabeçalho BT
  assert.equal(rep.data[1], 0x10, 'tag DS_OUTPUT_TAG');
  assert.equal(rep.data[2], 0xff, 'valid_flag0');
  assert.equal(rep.data[3], 0xf7, 'valid_flag1');
  assert.equal(rep.data[4], Math.round(0.5 * 255), 'motor direito');
  assert.equal(rep.data[5], Math.round(1.0 * 255), 'motor esquerdo');

  // Gatilhos deslocados por +2 no Bluetooth: R2 em 12, L2 em 23
  assert.equal(rep.data[12], 0x26, 'R2 BT vibration mode');
  assert.equal(rep.data[23], 0x25, 'L2 BT snap mode');
  assert.equal(rep.data[45], 0x0e, '3 Player LEDs');
  assert.equal(rep.data[46], 255, 'R');
  assert.equal(rep.data[47], 120, 'G');
  assert.equal(rep.data[48], 0, 'B');

  // Checagem do CRC32
  const view = new DataView(rep.data.buffer);
  const expectedCrc = computeDualSenseCrc32([0xa2, 0x31], new DataView(rep.data.buffer, 0, 73));
  assert.equal(view.getUint32(73, true), expectedCrc, 'CRC32 válido nos últimos 4 bytes');
});

test('DualSenseHaptics: fila serializada não lança erro em múltiplos envios simultâneos', async () => {
  const ds = new DualSenseHaptics();
  const mock = createMockHidDevice({ link: 'usb' });
  await ds._attachDevice(mock);

  const p1 = ds.pulse({ strongMagnitude: 0.5, weakMagnitude: 0.5, duration: 50 });
  const p2 = ds.pulse({ strongMagnitude: 1.0, weakMagnitude: 0.2, duration: 50 });
  const [res1, res2] = await Promise.all([p1, p2]);

  assert.equal(res1, true);
  assert.equal(res2, true);
  assert.ok(mock.sentReports.length >= 1);
  ds.stop();
});

// ---------- HapticController ----------
test('HapticController: reage aos eventos da partida e despacha para o DualSense', async () => {
  const bus = new EventBus();
  const hc = new HapticController(bus);
  const mock = createMockHidDevice({ link: 'usb' });
  await hc.dualSense._attachDevice(mock);

  // 1. Coleta de moeda (cor amarela / dourada no relatório)
  bus.emit('coin:collected', { vehicle: { id: 'player' }, value: 1 });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(mock.sentReports.length >= 1);
  const coinReport = mock.sentReports.at(-1);
  assert.ok(coinReport.data[2] > 0, 'motor fraco deve vibrar para moeda');
  assert.equal(coinReport.data[44], 255, 'Moeda 1 Lightbar R dourada');

  // 2. Colisão com obstáculo
  bus.emit('vehicle:bump', { vehicle: { id: 'player' }, impact: 14 });
  await new Promise((r) => setTimeout(r, 20));
  const bumpReport = mock.sentReports.at(-1);
  assert.ok(bumpReport.data[3] > coinReport.data[3], 'impacto gera mais motor forte');

  // 3. Batida de trem (crash) com gatilhos de tremor e luz vermelha
  bus.emit('vehicle:crash', { vehicle: { id: 'player' } });
  await new Promise((r) => setTimeout(r, 20));
  const crashReport = mock.sentReports.at(-1);
  assert.equal(crashReport.data[2], 255);
  assert.equal(crashReport.data[3], 255);
  assert.equal(crashReport.data[44], 255, 'Crash luz vermelha R=255');
  assert.equal(crashReport.data[45], 20, 'G=20');

  hc.stop();
});

test('HapticController.update: terreno dinâmico, gatilhos adaptáveis e leds de velocidade', async () => {
  const bus = new EventBus();
  const hc = new HapticController(bus);
  const mock = createMockHidDevice({ link: 'usb' });
  await hc.dualSense._attachDevice(mock);

  // Carro em alta velocidade na lama
  const vehicleMud = {
    id: 'player',
    stunned: false,
    speed: 20, // ~72 km/h -> 5 LEDs
    surface: 'lama',
    slope: 0.12,
    slip: 0.1,
    controls: { throttle: 0.8, brake: 0 },
    terrain: { distanceToRail: () => 100 },
  };

  hc.update(1.0, vehicleMud, { hapticWeak: 0 });
  await new Promise((r) => setTimeout(r, 20));

  const mudReport = mock.sentReports.at(-1);
  assert.equal(mudReport.data[10], 0x21, 'R2 feedback ativo na lama/subida');
  assert.equal(mudReport.data[43], 0x1f, '5 LEDs em alta velocidade');

  // Frenagem brusca com derrapagem -> L2 aciona ABS
  const vehicleAbs = {
    id: 'player',
    stunned: false,
    speed: 15,
    surface: 'asfalto',
    slope: 0,
    slip: 2.5, // forte escorregamento
    controls: { throttle: 0, brake: 1.0 },
    terrain: { distanceToRail: () => 100 },
  };

  hc.update(1.2, vehicleAbs, { hapticWeak: 0 });
  await new Promise((r) => setTimeout(r, 20));

  const absReport = mock.sentReports.at(-1);
  assert.equal(absReport.data[21], 0x26, 'L2 pulsa ABS durante frenagem com slip');

  // Cruzamento de trilhos (distanceToRail < bedHalf) gera clatter rítmico
  const vehicleRail = {
    id: 'player',
    stunned: false,
    speed: 10,
    surface: 'pedra',
    slope: 0,
    slip: 0,
    x: 10.2,
    z: 5.4,
    controls: { throttle: 1, brake: 0 },
    terrain: { distanceToRail: () => 1.0 }, // sobre a brita
  };

  hc.update(1.4, vehicleRail, { hapticWeak: 0 });
  await new Promise((r) => setTimeout(r, 20));

  const railReport = mock.sentReports.at(-1);
  assert.ok(railReport.data[3] > 0, 'Dormentes dos trilhos geram impacto nos motores');

  hc.stop();
});

test('WebHID inputreport: USB (0x01) e Bluetooth (0x31) alimentam o controle do carro', async () => {
  const bus = new EventBus();
  const hc = new HapticController(bus);
  const input = new Input(null);

  // Simula relatório Bluetooth 0x31 com R2 = 255 e analógico esquerdo para a esquerda (0)
  const btBytes = new Uint8Array(77);
  btBytes[0] = 0x02; // cabeçalho BT
  btBytes[1] = 0;    // LX = totalmente à esquerda
  btBytes[2] = 128;  // LY = centro
  btBytes[3] = 128;  // RX = centro
  btBytes[4] = 128;  // RY = centro
  btBytes[5] = 0;    // L2 = solto
  btBytes[6] = 255;  // R2 = totalmente pressionado
  btBytes[8] = 0x18; // Quadrado pressionado (0x10) + hat neutro (0x08)

  const parsedBt = parseDualSenseInputReport(0x31, new DataView(btBytes.buffer), 'bluetooth');
  assert.ok(parsedBt);
  assert.equal(parsedBt.buttons[7].value, 1, 'R2 = 100% no Bluetooth 0x31');
  assert.equal(parsedBt.buttons[2].pressed, true, 'Quadrado pressionado');
  assert.ok(parsedBt.axes[0] < -0.99, 'Analógico esquerdo para a esquerda');

  // Conecta mock BT no HapticController e dispara inputreport
  const listeners = {};
  const mockBt = {
    ...createMockHidDevice({ link: 'bluetooth' }),
    addEventListener(type, fn) { listeners[type] = fn; },
    removeEventListener() {},
  };
  await hc.dualSense._attachDevice(mockBt);
  listeners.inputreport({ reportId: 0x31, data: new DataView(btBytes.buffer) });

  assert.equal(getActivePad(), hc.dualSense.inputState);
  const controls = input.read(1 / 60);
  assert.equal(controls.throttle, 1, 'Carro acelera via WebHID Bluetooth 0x31');
  assert.equal(controls.handbrake, true, 'Freio de mão via WebHID Bluetooth 0x31');
  assert.ok(controls.steer > 0, 'Carro esterça via WebHID Bluetooth 0x31');

  hc.stop();
});

