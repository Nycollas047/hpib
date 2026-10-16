// Texturas procedurais geradas via DataTexture (Three.js).
// 100% autossuficiente: funciona perfeitamente no navegador e em ambiente de testes (Node.js)
// sem nenhuma dependência externa, requisição HTTP ou elemento HTML5 Canvas.
import * as THREE from 'three';

// Cache para reaproveitar instâncias de texturas
const textureCache = new Map();

/**
 * Cria ou retorna textura de asfalto com granulação de brita e marcas de pneus.
 */
export function getAsphaltTexture() {
  if (textureCache.has('asphalt')) return textureCache.get('asphalt');

  const width = 128;
  const height = 128;
  const data = new Uint8Array(width * height * 4);

  let idx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      // Ruído determinístico de granulação de asfalto
      const noise = ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1;
      const grain = (noise - 0.5) * 28;

      // Faixas de desgaste por pneus (duas trilhas ligeiramente mais escuras onde os pneus passam)
      const inLeftTrack = Math.abs(u - 0.32) < 0.1;
      const inRightTrack = Math.abs(u - 0.68) < 0.1;
      const wear = inLeftTrack || inRightTrack ? -16 : 0;

      // Bordas da pista ligeiramente mais claras por poeira
      const shoulder = (u < 0.08 || u > 0.92) ? 14 : 0;

      const baseVal = Math.max(20, Math.min(240, 52 + grain + wear + shoulder));

      data[idx] = baseVal;         // R
      data[idx + 1] = baseVal + 2; // G (levemente frio/neutro)
      data[idx + 2] = baseVal + 4; // B
      data[idx + 3] = 255;         // A
      idx += 4;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 48); // Repete ao longo da extensão da pista
  texture.generateMipmaps = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;

  textureCache.set('asphalt', texture);
  return texture;
}

/**
 * Cria textura de dormente de madeira com fibras e marcas de desgaste.
 */
export function getWoodTexture() {
  if (textureCache.has('wood')) return textureCache.get('wood');

  const width = 64;
  const height = 64;
  const data = new Uint8Array(width * height * 4);

  let idx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Fibras longitudinais da madeira
      const grain = Math.sin(y * 0.8 + Math.sin(x * 0.15) * 2.5) * 18;
      const noise = ((Math.sin(x * 37.1 + y * 91.7) * 43758.5453) % 1 + 1) % 1;
      const jitter = (noise - 0.5) * 16;

      const r = Math.max(30, Math.min(220, 108 + grain + jitter));
      const g = Math.max(20, Math.min(180, 72 + grain * 0.7 + jitter));
      const b = Math.max(10, Math.min(140, 42 + grain * 0.4 + jitter));

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
      idx += 4;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  textureCache.set('wood', texture);
  return texture;
}

/**
 * Cria textura de sulcos de pneu de borracha.
 */
export function getTireTexture() {
  if (textureCache.has('tire')) return textureCache.get('tire');

  const width = 64;
  const height = 64;
  const data = new Uint8Array(width * height * 4);

  let idx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Blocos de banda de rodagem (gomos transversais e sulco central)
      const grooveY = (y % 8) < 2;
      const centralGroove = Math.abs(x - 32) < 4;
      const isGroove = grooveY || centralGroove;

      const base = isGroove ? 18 : 38;
      const noise = ((Math.sin(x * 15.3 + y * 49.1) * 23421.63) % 1 + 1) % 1;
      const v = Math.max(10, Math.min(60, base + (noise - 0.5) * 6));

      data[idx] = v;
      data[idx + 1] = v + 1;
      data[idx + 2] = v + 3;
      data[idx + 3] = 255;
      idx += 4;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  textureCache.set('tire', texture);
  return texture;
}

/**
 * Cria textura de pintura esportiva com faixas de corrida duplas no capô/teto.
 */
export function getCarStripeTexture(baseHex, stripeHex = 0xffffff) {
  const key = `stripe_${baseHex}_${stripeHex}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const width = 64;
  const height = 64;
  const data = new Uint8Array(width * height * 4);

  const baseColor = new THREE.Color(baseHex);
  const stripeColor = new THREE.Color(stripeHex);

  const br = Math.round(baseColor.r * 255);
  const bg = Math.round(baseColor.g * 255);
  const bb = Math.round(baseColor.b * 255);

  const sr = Math.round(stripeColor.r * 255);
  const sg = Math.round(stripeColor.g * 255);
  const sb = Math.round(stripeColor.b * 255);

  let idx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      // Duas listras brancas esportivas centrais
      const isStripe1 = u >= 0.38 && u <= 0.46;
      const isStripe2 = u >= 0.54 && u <= 0.62;
      const isStripe = isStripe1 || isStripe2;

      // Linha fina de contorno escuro nas faixas
      const isStripeBorder =
        (Math.abs(u - 0.38) < 0.02 || Math.abs(u - 0.46) < 0.02 ||
         Math.abs(u - 0.54) < 0.02 || Math.abs(u - 0.62) < 0.02);

      if (isStripeBorder) {
        data[idx] = Math.round(br * 0.4);
        data[idx + 1] = Math.round(bg * 0.4);
        data[idx + 2] = Math.round(bb * 0.4);
      } else if (isStripe) {
        data[idx] = sr;
        data[idx + 1] = sg;
        data[idx + 2] = sb;
      } else {
        // Pintura metálica com suave gradiente de reflexo
        const sheen = 1.0 + (Math.abs(u - 0.5) - 0.25) * 0.15;
        data[idx] = Math.min(255, Math.round(br * sheen));
        data[idx + 1] = Math.min(255, Math.round(bg * sheen));
        data[idx + 2] = Math.min(255, Math.round(bb * sheen));
      }
      data[idx + 3] = 255;
      idx += 4;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  textureCache.set(key, texture);
  return texture;
}

/**
 * Cria textura de grade dianteira de radiador.
 */
export function getGrilleTexture() {
  if (textureCache.has('grille')) return textureCache.get('grille');

  const width = 32;
  const height = 32;
  const data = new Uint8Array(width * height * 4);

  let idx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Filetes horizontais pretos com borda cromada
      const slat = y % 4;
      const isBar = slat === 0 || slat === 1;
      const val = isBar ? 70 : 16;

      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val + 4;
      data[idx + 3] = 255;
      idx += 4;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  textureCache.set('grille', texture);
  return texture;
}

/**
 * Cria textura de lente de farol estriada.
 */
export function getHeadlightTexture() {
  if (textureCache.has('headlight')) return textureCache.get('headlight');

  const width = 32;
  const height = 32;
  const data = new Uint8Array(width * height * 4);

  let idx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Estrias verticais de dispersão óptica do vidro
      const rib = Math.sin(x * 1.6) > 0 ? 255 : 210;
      data[idx] = rib;
      data[idx + 1] = rib;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
      idx += 4;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  textureCache.set('headlight', texture);
  return texture;
}
