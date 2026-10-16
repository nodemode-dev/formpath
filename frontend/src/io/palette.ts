export type PaletteMethod = 'selective' | 'perceptual' | 'adaptive';
export type PaletteDither = 'none' | 'diffusion';

export interface PaletteOpts {
  colors: number;
  method: PaletteMethod;
  dither: PaletteDither;
  amount: number;
  transparent: boolean;
  matte: [number, number, number];
}

export interface Indexed {
  width: number;
  height: number;
  pixels: Uint8Array;
  palette: Uint8Array;
  count: number;
  trans: number;
}

const LIN = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const v = i / 255; t[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  return t;
})();

function lab(r: number, g: number, b: number, out: Float32Array, at: number): void {
  const lr = LIN[r], lg = LIN[g], lb = LIN[b];
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / 0.95047, y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb, z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  out[at] = 116 * fy - 16; out[at + 1] = 500 * (fx - fy); out[at + 2] = 200 * (fy - fz);
}

export function flattenOnMatte(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, o: Pick<PaletteOpts, 'transparent' | 'matte'>): { rgb: Uint8Array; clear: Uint8Array | null } {
  const n = w * h, rgb = new Uint8Array(n * 3);
  let clear: Uint8Array | null = null;
  const [mr, mg, mb] = o.matte;
  for (let i = 0, q = 0; i < n; i++, q += 3) {
    const p = i * 4, a = rgba[p + 3];
    if (o.transparent && a < 128) { if (!clear) clear = new Uint8Array(n); clear[i] = 1; rgb[q] = mr; rgb[q + 1] = mg; rgb[q + 2] = mb; continue; }
    if (a === 255) { rgb[q] = rgba[p]; rgb[q + 1] = rgba[p + 1]; rgb[q + 2] = rgba[p + 2]; continue; }
    const k = a / 255;
    rgb[q] = Math.round(rgba[p] * k + mr * (1 - k)); rgb[q + 1] = Math.round(rgba[p + 1] * k + mg * (1 - k)); rgb[q + 2] = Math.round(rgba[p + 2] * k + mb * (1 - k));
  }
  return { rgb, clear };
}

function exactColors(rgb: Uint8Array, clear: Uint8Array | null, limit: number): Map<number, number> | null {
  const seen = new Map<number, number>(), n = rgb.length / 3;
  for (let i = 0, q = 0; i < n; i++, q += 3) {
    if (clear && clear[i]) continue;
    const key = (rgb[q] << 16) | (rgb[q + 1] << 8) | rgb[q + 2];
    const c = seen.get(key);
    if (c === undefined) { if (seen.size >= limit) return null; seen.set(key, 1); } else seen.set(key, c + 1);
  }
  return seen;
}

interface Cell { r: number; g: number; b: number; n: number }

function buildPalette(rgb: Uint8Array, clear: Uint8Array | null, size: number, method: PaletteMethod): Array<[number, number, number]> {
  const n = rgb.length / 3, cells = new Map<number, Cell>();
  for (let i = 0, q = 0; i < n; i++, q += 3) {
    if (clear && clear[i]) continue;
    const key = ((rgb[q] >> 3) << 10) | ((rgb[q + 1] >> 3) << 5) | (rgb[q + 2] >> 3);
    let c = cells.get(key);
    if (!c) { c = { r: 0, g: 0, b: 0, n: 0 }; cells.set(key, c); }
    c.r += rgb[q]; c.g += rgb[q + 1]; c.b += rgb[q + 2]; c.n++;
  }
  const list = [...cells.values()], m = list.length, sp = new Float32Array(m * 3), wt = new Float64Array(m), mean = new Uint8Array(m * 3);
  const perceptual = method !== 'adaptive';
  for (let i = 0; i < m; i++) {
    const c = list[i], r = Math.round(c.r / c.n), g = Math.round(c.g / c.n), b = Math.round(c.b / c.n);
    mean[i * 3] = r; mean[i * 3 + 1] = g; mean[i * 3 + 2] = b;
    if (perceptual) lab(r, g, b, sp, i * 3); else { sp[i * 3] = r * 0.9; sp[i * 3 + 1] = g * 1.2; sp[i * 3 + 2] = b * 0.6; }
    wt[i] = method === 'perceptual' ? Math.sqrt(c.n) : c.n;
  }
  const order = Int32Array.from({ length: m }, (_, i) => i);
  interface Box { lo: number; hi: number; axis: number; extent: number; weight: number }
  const measure = (lo: number, hi: number): Box => {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    let weight = 0;
    for (let k = lo; k < hi; k++) { const i = order[k]; weight += wt[i]; for (let a = 0; a < 3; a++) { const v = sp[i * 3 + a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; } }
    let axis = 0, extent = mx[0] - mn[0];
    for (let a = 1; a < 3; a++) if (mx[a] - mn[a] > extent) { axis = a; extent = mx[a] - mn[a]; }
    return { lo, hi, axis, extent, weight };
  };
  const boxes: Box[] = [measure(0, m)];
  while (boxes.length < size) {
    let best = -1, bp = 0;
    for (let b = 0; b < boxes.length; b++) { const bx = boxes[b]; if (bx.hi - bx.lo < 2 || bx.extent <= 0) continue; const pr = bx.weight * bx.extent; if (pr > bp) { bp = pr; best = b; } }
    if (best < 0) break;
    const bx = boxes[best], axis = bx.axis, seg = Array.from(order.subarray(bx.lo, bx.hi)).sort((x, y) => sp[x * 3 + axis] - sp[y * 3 + axis]);
    order.set(seg, bx.lo);
    let acc = 0, cut = bx.lo + 1;
    for (let k = bx.lo; k < bx.hi - 1; k++) { acc += wt[order[k]]; cut = k + 1; if (acc >= bx.weight / 2) break; }
    boxes.splice(best, 1, measure(bx.lo, cut), measure(cut, bx.hi));
  }
  const out: Array<[number, number, number]> = [];
  for (const bx of boxes) {
    let r = 0, g = 0, b = 0, t = 0;
    for (let k = bx.lo; k < bx.hi; k++) { const i = order[k], c = list[i]; r += c.r; g += c.g; b += c.b; t += c.n; }
    out.push([Math.round(r / t), Math.round(g / t), Math.round(b / t)]);
  }
  if (method === 'selective') {
    for (const c of out) {
      const w = c.map((v) => Math.round(v / 51) * 51);
      if (Math.max(Math.abs(w[0] - c[0]), Math.abs(w[1] - c[1]), Math.abs(w[2] - c[2])) <= 20) { c[0] = w[0]; c[1] = w[1]; c[2] = w[2]; }
    }
  }
  return out;
}

export function quantize(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, o: PaletteOpts): Indexed {
  const { rgb, clear } = flattenOnMatte(rgba, w, h, o);
  const n = w * h, want = Math.max(2, Math.min(256, Math.round(o.colors))), room = clear ? want - 1 : want;
  const exact = exactColors(rgb, clear, Math.max(1, room));
  let entries: Array<[number, number, number]>;
  if (exact) {
    const keys = [...exact.entries()].sort((a, b) => b[1] - a[1]);
    entries = keys.map(([k]) => [(k >> 16) & 255, (k >> 8) & 255, k & 255] as [number, number, number]);
    if (!entries.length) entries = [[o.matte[0], o.matte[1], o.matte[2]]];
  } else entries = buildPalette(rgb, clear, Math.max(1, room), o.method);
  const shift = clear ? 1 : 0, count = entries.length + shift, palette = new Uint8Array(count * 3);
  entries.forEach((e, i) => { palette[(i + shift) * 3] = e[0]; palette[(i + shift) * 3 + 1] = e[1]; palette[(i + shift) * 3 + 2] = e[2]; });
  const pixels = new Uint8Array(n), perceptual = o.method !== 'adaptive', ps = new Float32Array(entries.length * 3);
  entries.forEach((e, i) => { if (perceptual) lab(e[0], e[1], e[2], ps, i * 3); else { ps[i * 3] = e[0] * 0.9; ps[i * 3 + 1] = e[1] * 1.2; ps[i * 3 + 2] = e[2] * 0.6; } });
  const exactIndex = new Map<number, number>();
  entries.forEach((e, i) => { const k = (e[0] << 16) | (e[1] << 8) | e[2]; if (!exactIndex.has(k)) exactIndex.set(k, i); });
  const cache = new Int16Array(32768).fill(-1), probe = new Float32Array(3);
  const nearest = (r: number, g: number, b: number): number => {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3), hit = cache[key];
    if (hit >= 0) return hit;
    if (perceptual) lab(r, g, b, probe, 0); else { probe[0] = r * 0.9; probe[1] = g * 1.2; probe[2] = b * 0.6; }
    let best = 0, bd = Infinity;
    for (let i = 0; i < entries.length; i++) { const d0 = ps[i * 3] - probe[0], d1 = ps[i * 3 + 1] - probe[1], d2 = ps[i * 3 + 2] - probe[2], d = d0 * d0 + d1 * d1 + d2 * d2; if (d < bd) { bd = d; best = i; } }
    cache[key] = best;
    return best;
  };
  const diffuse = o.dither === 'diffusion' && !exact && o.amount > 0, k = Math.max(0, Math.min(1, o.amount / 100));
  const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);
  let cur = new Float32Array((w + 2) * 3), nxt = new Float32Array((w + 2) * 3);
  for (let y = 0; y < h; y++) {
    if (diffuse) { cur.set(nxt); nxt.fill(0); }
    for (let x = 0; x < w; x++) {
      const i = y * w + x, q = i * 3;
      if (clear && clear[i]) { pixels[i] = 0; continue; }
      const r0 = rgb[q], g0 = rgb[q + 1], b0 = rgb[q + 2];
      const ex = exactIndex.get((r0 << 16) | (g0 << 8) | b0);
      if (!diffuse) { pixels[i] = (ex ?? nearest(r0, g0, b0)) + shift; continue; }
      const e = (x + 1) * 3, r = clamp(r0 + cur[e]), g = clamp(g0 + cur[e + 1]), b = clamp(b0 + cur[e + 2]);
      const ri = Math.round(r), gi = Math.round(g), bi = Math.round(b), hit = exactIndex.get((ri << 16) | (gi << 8) | bi), idx = hit ?? nearest(ri, gi, bi), pe = entries[idx];
      pixels[i] = idx + shift;
      const er = (r - pe[0]) * k, eg = (g - pe[1]) * k, eb = (b - pe[2]) * k;
      if (x + 1 < w) { cur[e + 3] += er * 7 / 16; cur[e + 4] += eg * 7 / 16; cur[e + 5] += eb * 7 / 16; }
      nxt[e - 3] += er * 3 / 16; nxt[e - 2] += eg * 3 / 16; nxt[e - 1] += eb * 3 / 16;
      nxt[e] += er * 5 / 16; nxt[e + 1] += eg * 5 / 16; nxt[e + 2] += eb * 5 / 16;
      if (x + 1 < w) { nxt[e + 3] += er / 16; nxt[e + 4] += eg / 16; nxt[e + 5] += eb / 16; }
    }
  }
  return { width: w, height: h, pixels, palette, count, trans: clear ? 0 : -1 };
}
