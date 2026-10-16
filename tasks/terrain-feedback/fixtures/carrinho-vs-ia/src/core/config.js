// ============================================================
// CONFIG: todos os números de ajuste do jogo ficam aqui.
// Unidades: 1 unidade = 1 metro. Tempo em segundos. Velocidade em m/s.
// ============================================================

export const CONFIG = {
  seed: 1337,

  // Mundo 600 m: a volta na estrada leva ~35 s a 94 km/h (antes 400 m e 24 s)
  world: { size: 600, segments: 360 },

  terrain: {
    heightScale: 27,       // amplitude do relevo fora da pista (m)
    noiseScale: 210,       // tamanho dos morros (maior = morros mais largos)
    groundExtent: 340,     // área do "relevo suavizado" usado para assentar estrada e trilho
    groundCell: 2,         // resolução do relevo suavizado (m)
    groundBlur: 21,        // raio da suavização (células) = 42 m; limita a inclinação da pista
    trackMargin: 15,       // distância até a qual o terreno se molda à pista (m)
  },

  road: { radius: 145, wobble: 20, halfWidth: 3.8 },

  rail: {
    radiusBase: 165,
    radiusAmp: 75,         // trilho em "8": cruza a estrada 4 vezes
    gauge: 0.72,           // metade da bitola padrão (1,435 m). Rodas e trilhos usam este valor
    bedHalf: 2.2,          // meia largura da brita (m)
    ballastTop: 0.12,
    sleeperTop: 0.24,
    railRadius: 0.07,
    railTop: 0.38,         // topo do trilho: onde as rodas apoiam
    sleeperSpacing: 0.65,
    margin: 12,            // distância até a qual o terreno se molda ao trilho (m)
  },

  vehicle: {
    accel: 18,             // m/s²
    brake: 30,             // m/s²
    drag: 6,               // desaceleração ao soltar o acelerador
    maxSpeed: 26,          // m/s em asfalto (94 km/h)
    reverseFactor: 0.4,
    // Direção: a taxa de giro cai com a velocidade, para a aceleração lateral nunca passar de aLatMax.
    steerRate: 2.2,        // rad/s máximo em baixa velocidade
    aLatMax: 16,           // m/s² (1,6 g): a 94 km/h dá raio de curva de ~42 m (antes 10,8 m)
    steerExp: 1.5,         // curva do analógico: >1 deixa o centro do analógico mais preciso
    lateralGrip: 9,        // 1/s: quão rápido o carro "agarra" (menos = escorrega mais)
    handbrakeSlip: 0.22,   // multiplicador do agarre com o freio de mão
    handbrakeDecel: 7,     // m/s² de frenagem do freio de mão
    slipDrag: 0.35,        // perda de velocidade por escorregar (m/s² por m/s lateral)
    wheelBase: 2.4,
    track: 1.7,
    maxVerticalSpeed: 14,  // m/s: limite de subida/descida da suspensão (evita voo)
    hitRadius: 1.4,
    lift: 0.12,
  },

  train: {
    speed: 20,             // m/s (72 km/h)
    warnSeconds: 6,        // aviso nos sinais quando a cabeça chega ao cruzamento em até 6 s
    wheelRadius: 0.45,
    cars: [
      { type: 'loco',  length: 16 },
      { type: 'loco',  length: 16 },
      { type: 'wagon', length: 12 },
      { type: 'wagon', length: 12 },
      { type: 'wagon', length: 12 },
    ],
    // Posição dos eixos (m, a partir do centro do carro, + = frente)
    wheelsets: { loco: [-5.8, -3.2, 3.4, 6.0], wagon: [-4.0, 4.0] },
    gap: 1.5,
    hitRadius: 1.6,
  },

  // Moedas: valor 1 a 4 (cor: dourada, laranja, azul, roxa). Nascem em zonas diferentes.
  coins: {
    alive: 18,
    radius: 2.6,           // raio de coleta
    visualRadius: 0.9,
    minSpacing: 24,        // distância mínima entre moedas
    minFromRail: 6,
    minFromVehicle: 30,    // nenhuma moeda nasce em cima de um carro
    riskDistance: 25,      // perto do trilho: valor +1
    // Pesos das zonas de nascimento (somam 1)
    zones: { road: 0.5, risk: 0.2, hill: 0.15, open: 0.15 },
    candidates: 14,        // testa vários lugares e fica com o mais afastado das outras moedas
    hillSlope: 0.11,       // inclinação mínima (11%) para contar como encosta
    openMinFromRoad: 12,   // distância mínima da estrada para a zona 'open'
  },

  props: { trees: 380, houses: 9, rocks: 90 },

  match: {
    roundSeconds: 210,
    trainPenalty: 3,       // moedas perdidas ao ser atingido pelo trem
    stunSeconds: 1.5,
    crashCooldown: 1.5,
    resetPenalty: 1,       // custo de voltar à pista (Triângulo / R)
    resetCooldown: 3,
    bumpCooldown: 0.4,     // evita repetir a batida em obstáculo a cada quadro
    bumpMinSpeed: 2.5,     // m/s: abaixo disso é encostão, não conta como batida
  },

  // Dificuldade da IA: fração da velocidade/precisão máxima
  ai: {
    levels: { facil: 0.7, normal: 0.85, dificil: 1.0 },
    defaultLevel: 'normal',
    coinSight: 90,
    roadLookahead: 0.14,
    rubberLead: 0.02,      // a IA perde 2% de habilidade por moeda de vantagem (máx. 25%)
    rubberTrail: 0.01,     // e ganha 1% por moeda de atraso (máx. 10%)
    trainStopDistance: 34, // começa a frear antes de um cruzamento com sinal vermelho
  },

  // Entrada: zonas mortas e curvas de resposta (controle e teclado)
  input: {
    stickDeadzone: 0.14,   // zona morta RADIAL do analógico (evita deriva e diagonais travadas)
    stickOuter: 0.96,      // acima disso conta como 100% (analógicos gastos não chegam a 1)
    triggerDeadzone: 0.04,
    padSmooth: 20,         // 1/s: filtro leve contra tremor do analógico
    keyRise: 5.5,          // 1/s: teclado vai ao máximo em ~0,2 s (em vez de 0 ou 1 instantâneo)
    keyFall: 9,
    reverseDelay: 0.25,    // s parado com o freio apertado antes de começar a dar ré
    cameraSmooth: 7,       // 1/s: retorno da câmera ao centro
  },

  camera: {
    distance: 13,
    height: 5.2,
    lerp: 0.12,
    fov: 62,
    fovBoost: 16,          // abre o campo de visão com a velocidade (sensação de velocidade)
    yawMax: 1.3,           // rad: giro da câmera com o analógico direito
  },
};

// Superfícies: atrito, velocidade, valor da moeda e vibração do controle.
// strong = motor grave (0 a 1), weak = motor agudo (0 a 1), pulse = vibração em pulsos.
export const SURFACES = {
  asfalto: { label: 'Asfalto', speedFactor: 1.0, grip: 1.0,  color: 0x3a3d44, coinValue: 1, strong: 0.04, weak: 0.14, pulse: false },
  terra:   { label: 'Terra',   speedFactor: 0.8, grip: 0.8,  color: 0x8a6a45, coinValue: 2, strong: 0.22, weak: 0.28, pulse: false },
  grama:   { label: 'Grama',   speedFactor: 0.7, grip: 0.75, color: 0x5f9a3c, coinValue: 2, strong: 0.08, weak: 0.18, pulse: false },
  pedra:   { label: 'Pedra',   speedFactor: 0.6, grip: 0.7,  color: 0x8b8f96, coinValue: 3, strong: 0.55, weak: 0.40, pulse: true  },
  lama:    { label: 'Lama',    speedFactor: 0.4, grip: 0.45, color: 0x4a3b2a, coinValue: 3, strong: 0.30, weak: 0.50, pulse: true  },
};

// Climas: um por rodada, em ciclo.
export const WEATHER = [
  { id: 'sol',     label: 'Sol',     grip: 1.0,  fog: 0.0025, skyTop: 0x3f7fd1, skyHorizon: 0xbfe3ff, sun: 1.25, ambient: 0.55, night: false, hapticWeak: 0,    precip: null },
  { id: 'chuva',   label: 'Chuva',   grip: 0.7,  fog: 0.006,  skyTop: 0x3b4a58, skyHorizon: 0x7f919e, sun: 0.45, ambient: 0.45, night: false, hapticWeak: 0.08, precip: { kind: 'rain', count: 1200, speed: 26, size: 0.14, color: 0xcfe4ff } },
  { id: 'neve',    label: 'Neve',    grip: 0.45, fog: 0.008,  skyTop: 0xa9b8c6, skyHorizon: 0xe6eef5, sun: 0.75, ambient: 0.75, night: false, hapticWeak: 0.03, precip: { kind: 'snow', count: 900,  speed: 3.2, size: 0.28, color: 0xffffff } },
  { id: 'noite',   label: 'Noite',   grip: 1.0,  fog: 0.008,  skyTop: 0x050a1f, skyHorizon: 0x1c2748, sun: 0.10, ambient: 0.28, night: true,  hapticWeak: 0,    precip: null },
  { id: 'neblina', label: 'Neblina', grip: 0.95, fog: 0.022,  skyTop: 0xb8c2ca, skyHorizon: 0xcfd6dc, sun: 0.55, ambient: 0.65, night: false, hapticWeak: 0,    precip: null },
];
