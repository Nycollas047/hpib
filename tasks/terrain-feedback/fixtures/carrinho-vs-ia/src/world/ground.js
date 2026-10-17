// Relevo suavizado (lógica pura).
// Uma grade 2D é pré-calculada e suavizada com média móvel separável.
// Estrada e trilho se assentam nesta superfície, então a inclinação fica baixa
// e cruzamentos ficam consistentes (os dois usam o mesmo campo).
export class Ground {
  constructor(sampleFn, extent, cell, blurCells, passes = 3) {
    this.extent = extent;
    this.cell = cell;
    this.n = Math.round((2 * extent) / cell) + 1;

    const n = this.n;
    let g = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        g[j * n + i] = sampleFn(-extent + i * cell, -extent + j * cell);
      }
    }

    for (let p = 0; p < passes; p++) {
      g = this._blur(g, blurCells, 1, 0);
      g = this._blur(g, blurCells, 0, 1);
    }
    this.g = g;
  }

  // dx,dy = direção (1,0) horizontal ou (0,1) vertical
  _blur(src, r, dx, dy) {
    const n = this.n;
    const out = new Float32Array(n * n);
    const w = 2 * r + 1;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let k = -r; k <= r; k++) {
          const ii = Math.min(n - 1, Math.max(0, i + k * dx));
          const jj = Math.min(n - 1, Math.max(0, j + k * dy));
          s += src[jj * n + ii];
        }
        out[j * n + i] = s / w;
      }
    }
    return out;
  }

  // Interpolação bilinear em (x, z)
  sample(x, z) {
    const n = this.n;
    const fi = Math.min(n - 1.001, Math.max(0, (x + this.extent) / this.cell));
    const fj = Math.min(n - 1.001, Math.max(0, (z + this.extent) / this.cell));
    const i = Math.floor(fi);
    const j = Math.floor(fj);
    const u = fi - i;
    const v = fj - j;
    const g = this.g;
    const a = g[j * n + i];
    const b = g[j * n + i + 1];
    const c = g[(j + 1) * n + i];
    const d = g[(j + 1) * n + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
}
