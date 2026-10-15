import { parseColor, toRgb } from './paint';
import { inflateTrace } from './inflate-trace';
import { lighting, rotator, shadeRgb } from './threed';
import type { Effect } from './types';

export interface FilterFrame { scale: number; x: number; y: number; w: number; h: number }
type Params = Effect['params'];
type Plane = Float32Array;
type RGB3 = [number, number, number];
interface Px { w: number; h: number; r: Plane; g: Plane; b: Plane; a: Plane }

const clamp = (v: number, lo = 0, hi = 1): number => (v < lo ? lo : v > hi ? hi : v);
const ramp = (e0: number, e1: number, v: number): number => { const t = clamp((v - e0) / (e1 - e0 || 1e-6)); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const num = (p: Params, k: string, d: number): number => { const v = p[k]; return typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : d; };
const str = (p: Params, k: string, d: string): string => (typeof p[k] === 'string' ? (p[k] as string) : d);
const flag = (p: Params, k: string, d: boolean): boolean => (typeof p[k] === 'boolean' ? (p[k] as boolean) : d);
function rgbOf(p: Params, k: string, d: string): RGB3 {
  const c = parseColor(str(p, k, d)) ?? parseColor(d);
  const v = c ? toRgb(c) : { r: 0, g: 0, b: 0 };
  return [v.r / 255, v.g / 255, v.b / 255];
}

const LIGHTS: Record<string, number> = { right: 0, top_right: 45, top: 90, top_left: 135, left: 180, bottom_left: 225, bottom: 270, bottom_right: 315 };
const DIRS: Record<string, number> = { right_diagonal: -45, horizontal: 0, left_diagonal: 45, vertical: 90 };
const QUALITY: Record<string, number> = { draft: 8, good: 16, best: 32 };
const MEZZO_DOTS: Record<string, number> = { fine_dots: 0.4, medium_dots: 0.8, grainy_dots: 0.6, coarse_dots: 1.6 };

function unpack(img: ImageData): Px {
  const n = img.width * img.height, d = img.data, r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n), a = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) { r[i] = d[j] / 255; g[i] = d[j + 1] / 255; b[i] = d[j + 2] / 255; a[i] = d[j + 3] / 255; }
  return { w: img.width, h: img.height, r, g, b, a };
}

function pack(px: Px, img: ImageData): void {
  const d = img.data, n = px.w * px.h;
  for (let i = 0, j = 0; i < n; i++, j += 4) { d[j] = px.r[i] * 255; d[j + 1] = px.g[i] * 255; d[j + 2] = px.b[i] * 255; d[j + 3] = px.a[i] * 255; }
}

const like = (px: Px, a: Plane = Float32Array.from(px.a)): Px => ({ w: px.w, h: px.h, r: new Float32Array(px.r.length), g: new Float32Array(px.r.length), b: new Float32Array(px.r.length), a });

function boxPass(src: Plane, dst: Plane, w: number, h: number, r: number, horiz: boolean): void {
  const len = horiz ? w : h, lines = horiz ? h : w, step = horiz ? 1 : w, inv = 1 / (2 * r + 1);
  for (let l = 0; l < lines; l++) {
    const base = horiz ? l * w : l, first = src[base], last = src[base + (len - 1) * step];
    let acc = first * (r + 1);
    for (let k = 1; k <= r; k++) acc += k < len ? src[base + k * step] : last;
    for (let i = 0; i < len; i++) {
      dst[base + i * step] = acc * inv;
      const add = i + r + 1, sub = i - r;
      acc += (add < len ? src[base + add * step] : last) - (sub > 0 ? src[base + sub * step] : first);
    }
  }
}

function boxRows(src: Plane, dst: Plane, w: number, h: number, r: number, acc: Float64Array): void {
  const inv = 1 / (2 * r + 1), lastRow = (h - 1) * w;
  for (let x = 0; x < w; x++) acc[x] = src[x] * (r + 1);
  for (let k = 1; k <= r; k++) { const row = (k < h ? k : h - 1) * w; for (let x = 0; x < w; x++) acc[x] += src[row + x]; }
  for (let y = 0; y < h; y++) {
    const o = y * w, add = y + r + 1 < h ? (y + r + 1) * w : lastRow, sub = y - r > 0 ? (y - r) * w : 0;
    for (let x = 0; x < w; x++) { dst[o + x] = acc[x] * inv; acc[x] += src[add + x] - src[sub + x]; }
  }
}

export function blurPlane(p: Plane, w: number, h: number, sigma: number): Plane {
  const out = Float32Array.from(p);
  if (sigma < 0.4) return out;
  const r = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2)), tmp = new Float32Array(p.length), acc = new Float64Array(w);
  for (let k = 0; k < 3; k++) { boxPass(out, tmp, w, h, r, true); boxRows(tmp, out, w, h, r, acc); }
  return out;
}

function blurPx(px: Px, sigma: number): Px {
  if (sigma < 0.4) return { w: px.w, h: px.h, r: Float32Array.from(px.r), g: Float32Array.from(px.g), b: Float32Array.from(px.b), a: Float32Array.from(px.a) };
  const n = px.r.length, pr = new Float32Array(n), pg = new Float32Array(n), pb = new Float32Array(n);
  for (let i = 0; i < n; i++) { pr[i] = px.r[i] * px.a[i]; pg[i] = px.g[i] * px.a[i]; pb[i] = px.b[i] * px.a[i]; }
  const a = blurPlane(px.a, px.w, px.h, sigma), r = blurPlane(pr, px.w, px.h, sigma), g = blurPlane(pg, px.w, px.h, sigma), b = blurPlane(pb, px.w, px.h, sigma);
  for (let i = 0; i < n; i++) { const k = a[i] > 1e-4 ? 1 / a[i] : 0; r[i] *= k; g[i] *= k; b[i] *= k; }
  return { w: px.w, h: px.h, r, g, b, a };
}

function bleed(px: Px): void {
  const n = px.r.length;
  let open = false;
  for (let i = 0; i < n && !open; i++) if (px.a[i] < 0.999) open = true;
  if (!open) return;
  const { w, h } = px, a0 = Float32Array.from(px.a);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = a0[i];
    if (a <= 0 || a >= 0.999) continue;
    let best = a, j = -1;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const sx = x + ox, sy = y + oy;
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const k = sy * w + sx;
      if (a0[k] > best) { best = a0[k]; j = k; }
    }
    if (j >= 0) { const t = a; px.r[i] = lerp(px.r[j], px.r[i], t); px.g[i] = lerp(px.g[j], px.g[i], t); px.b[i] = lerp(px.b[j], px.b[i], t); }
  }
}

function luma(px: Px): Plane {
  const n = px.r.length, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.299 * px.r[i] + 0.587 * px.g[i] + 0.114 * px.b[i];
  return out;
}

function sobel(L: Plane, w: number, h: number): { mag: Plane; gx: Plane; gy: Plane } {
  const n = w * h, mag = new Float32Array(n), gx = new Float32Array(n), gy = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1) * w, y1 = y * w, y2 = Math.min(h - 1, y + 1) * w;
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - 1), x2 = Math.min(w - 1, x + 1);
      const sx = L[y0 + x2] + 2 * L[y1 + x2] + L[y2 + x2] - L[y0 + x0] - 2 * L[y1 + x0] - L[y2 + x0];
      const sy = L[y2 + x0] + 2 * L[y2 + x] + L[y2 + x2] - L[y0 + x0] - 2 * L[y0 + x] - L[y0 + x2];
      gx[y1 + x] = sx / 4; gy[y1 + x] = sy / 4; mag[y1 + x] = Math.hypot(sx, sy) / 4;
    }
  }
  return { mag, gx, gy };
}

function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function grain(F: FilterFrame, w: number, h: number, cellPt: number, seed: number): Plane {
  const c = Math.max(0.5, cellPt * F.scale), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { const v = Math.floor((y - F.y) / c); for (let x = 0; x < w; x++) out[y * w + x] = hash2(Math.floor((x - F.x) / c), v, seed); }
  return out;
}

function valueNoise(F: FilterFrame, w: number, h: number, cellPt: number, seed: number): Plane {
  const c = Math.max(0.5, cellPt * F.scale), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const v = (y - F.y) / c, y0 = Math.floor(v), ty = (v - y0) * (v - y0) * (3 - 2 * (v - y0));
    for (let x = 0; x < w; x++) {
      const u = (x - F.x) / c, x0 = Math.floor(u), tx = (u - x0) * (u - x0) * (3 - 2 * (u - x0));
      out[y * w + x] = lerp(lerp(hash2(x0, y0, seed), hash2(x0 + 1, y0, seed), tx), lerp(hash2(x0, y0 + 1, seed), hash2(x0 + 1, y0 + 1, seed), tx), ty);
    }
  }
  return out;
}

function fbm(F: FilterFrame, w: number, h: number, cellPt: number, seed: number, octaves = 3): Plane {
  const out = new Float32Array(w * h);
  let amp = 0.5, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(F, w, h, cellPt / 2 ** o, seed + o * 17);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp; amp /= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function stretch(p: Plane, k: number): Plane {
  let mean = 0;
  for (let i = 0; i < p.length; i++) mean += p[i];
  mean /= p.length || 1;
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i++) out[i] = clamp((p[i] - mean) * k + 0.5);
  return out;
}

function streak(src: Plane, w: number, h: number, angleDeg: number, len: number): Plane {
  const q = ((Math.round(angleDeg / 45) % 4) + 4) % 4, r = Math.round(len / 2 / (q % 2 ? Math.SQRT2 : 1));
  if (r < 1 || w < 1 || h < 1) return Float32Array.from(src);
  const out = new Float32Array(w * h), dx = q === 2 ? 0 : 1, dy = q === 0 ? 0 : q === 1 ? -1 : 1, line = new Int32Array(w + h), inv = 1 / (2 * r + 1);
  const starts: number[] = [];
  if (q === 0) for (let y = 0; y < h; y++) starts.push(0, y);
  else if (q === 2) for (let x = 0; x < w; x++) starts.push(x, 0);
  else { for (let x = 0; x < w; x++) starts.push(x, q === 1 ? h - 1 : 0); for (let y = q === 1 ? 0 : 1; y < (q === 1 ? h - 1 : h); y++) starts.push(0, y); }
  for (let s = 0; s < starts.length; s += 2) {
    let n = 0, x = starts[s], y = starts[s + 1];
    while (x >= 0 && x < w && y >= 0 && y < h) { line[n++] = y * w + x; x += dx; y += dy; }
    const first = src[line[0]], last = src[line[n - 1]];
    let acc = first * (r + 1);
    for (let k = 1; k <= r; k++) acc += k < n ? src[line[k]] : last;
    for (let i = 0; i < n; i++) {
      out[line[i]] = acc * inv;
      const add = i + r + 1, sub = i - r;
      acc += (add < n ? src[line[add]] : last) - (sub > 0 ? src[line[sub]] : first);
    }
  }
  return out;
}

function streakPx(px: Px, angle: number, len: number): Px {
  const n = px.r.length, pr = new Float32Array(n), pg = new Float32Array(n), pb = new Float32Array(n);
  for (let i = 0; i < n; i++) { pr[i] = px.r[i] * px.a[i]; pg[i] = px.g[i] * px.a[i]; pb[i] = px.b[i] * px.a[i]; }
  const a = streak(px.a, px.w, px.h, angle, len), r = streak(pr, px.w, px.h, angle, len), g = streak(pg, px.w, px.h, angle, len), b = streak(pb, px.w, px.h, angle, len);
  for (let i = 0; i < n; i++) { const k = a[i] > 1e-4 ? 1 / a[i] : 0; r[i] *= k; g[i] *= k; b[i] *= k; }
  return { w: px.w, h: px.h, r, g, b, a: px.a };
}

function kuwahara(px: Px, radius: number): Px {
  const { w, h } = px, r = Math.max(1, Math.round(radius)), W = w + 1, size = W * (h + 1), L = luma(px);
  const iR = new Float64Array(size), iG = new Float64Array(size), iB = new Float64Array(size), iL = new Float64Array(size), iQ = new Float64Array(size), iA = new Float64Array(size);
  for (let y = 0; y < h; y++) {
    let sr = 0, sg = 0, sb = 0, sl = 0, sq = 0, sa = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x, o = (y + 1) * W + x + 1, u = y * W + x + 1, a = px.a[i];
      sr += px.r[i] * a; sg += px.g[i] * a; sb += px.b[i] * a; sl += L[i] * a; sq += L[i] * L[i] * a; sa += a;
      iR[o] = iR[u] + sr; iG[o] = iG[u] + sg; iB[o] = iB[u] + sb; iL[o] = iL[u] + sl; iQ[o] = iQ[u] + sq; iA[o] = iA[u] + sa;
    }
  }
  const out = like(px), box = (I: Float64Array, x0: number, y0: number, x1: number, y1: number): number => I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = Infinity, bx0 = -1, by0 = 0, bx1 = 1, by1 = 1;
    for (let q = 0; q < 4; q++) {
      const x0 = Math.max(0, q & 1 ? x : x - r), x1 = Math.min(w, (q & 1 ? x + r : x) + 1), y0 = Math.max(0, q & 2 ? y : y - r), y1 = Math.min(h, (q & 2 ? y + r : y) + 1);
      const a = box(iA, x0, y0, x1, y1);
      if (a < (x1 - x0) * (y1 - y0) * 0.5) continue;
      const m = box(iL, x0, y0, x1, y1) / a, v = box(iQ, x0, y0, x1, y1) / a - m * m;
      if (v < best) { best = v; bx0 = x0; by0 = y0; bx1 = x1; by1 = y1; }
    }
    const i = y * w + x;
    if (bx0 < 0) { out.r[i] = px.r[i]; out.g[i] = px.g[i]; out.b[i] = px.b[i]; continue; }
    const a = box(iA, bx0, by0, bx1, by1);
    out.r[i] = box(iR, bx0, by0, bx1, by1) / a; out.g[i] = box(iG, bx0, by0, bx1, by1) / a; out.b[i] = box(iB, bx0, by0, bx1, by1) / a;
  }
  return out;
}

function shade(H: Plane, w: number, h: number, lightDeg: number, depth: number): Plane {
  const out = new Float32Array(w * h), a = (lightDeg * Math.PI) / 180, lx = Math.cos(a), ly = -Math.sin(a);
  for (let y = 0; y < h; y++) {
    const yu = Math.max(0, y - 1) * w, yd = Math.min(h - 1, y + 1) * w;
    for (let x = 0; x < w; x++) {
      const gx = H[y * w + Math.min(w - 1, x + 1)] - H[y * w + Math.max(0, x - 1)], gy = H[yd + x] - H[yu + x];
      out[y * w + x] = clamp(0.5 - (gx * lx + gy * ly) * depth);
    }
  }
  return out;
}

function unsharp(px: Px, sigma: number, amount: number): Px {
  if (amount <= 0) return px;
  const b = blurPx(px, sigma), out = like(px, px.a);
  for (let i = 0; i < px.r.length; i++) { out.r[i] = clamp(px.r[i] + (px.r[i] - b.r[i]) * amount); out.g[i] = clamp(px.g[i] + (px.g[i] - b.g[i]) * amount); out.b[i] = clamp(px.b[i] + (px.b[i] - b.b[i]) * amount); }
  return out;
}

function sample(px: Px, x: number, y: number, out: number[]): void {
  const { w, h } = px, fx = clamp(x, 0, w - 1), fy = clamp(y, 0, h - 1), x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
  const i00 = y0 * w + x0, i10 = y0 * w + x1, i01 = y1 * w + x0, i11 = y1 * w + x1;
  const w00 = (1 - tx) * (1 - ty) * px.a[i00], w10 = tx * (1 - ty) * px.a[i10], w01 = (1 - tx) * ty * px.a[i01], w11 = tx * ty * px.a[i11];
  const a = w00 + w10 + w01 + w11, outside = x < -0.5 || y < -0.5 || x > w - 0.5 || y > h - 0.5;
  out[3] = outside ? 0 : a;
  const k = a > 1e-5 ? 1 / a : 0;
  out[0] = (px.r[i00] * w00 + px.r[i10] * w10 + px.r[i01] * w01 + px.r[i11] * w11) * k;
  out[1] = (px.g[i00] * w00 + px.g[i10] * w10 + px.g[i01] * w01 + px.g[i11] * w11) * k;
  out[2] = (px.b[i00] * w00 + px.b[i10] * w10 + px.b[i01] * w01 + px.b[i11] * w11) * k;
}

function displace(px: Px, dx: Plane, dy: Plane): Px {
  const out = like(px), s = [0, 0, 0, 0];
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
    const i = y * px.w + x;
    sample(px, x + dx[i], y + dy[i], s);
    out.r[i] = s[0]; out.g[i] = s[1]; out.b[i] = s[2]; out.a[i] = s[3];
  }
  return out;
}

function texture(kind: string, F: FilterFrame, w: number, h: number, scalingPct: number): Plane {
  const k = Math.max(0.05, (scalingPct / 100) * F.scale), out = new Float32Array(w * h);
  const fine = valueNoise(F, w, h, 0.8 * (scalingPct / 100), 91);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x - F.x) / k, v = (y - F.y) / k, i = y * w + x;
    let t: number;
    switch (kind) {
      case 'brick': { const row = Math.floor(v / 10), bu = (((u + (row & 1 ? 12 : 0)) % 24) + 24) % 24, bv = ((v % 10) + 10) % 10; t = ramp(0, 1.6, Math.min(bu, 24 - bu, bv, 10 - bv)) * (0.85 + 0.15 * fine[i]); break; }
      case 'burlap': t = 0.5 + 0.22 * Math.sin((u * Math.PI) / 3.5) * Math.sin((v * Math.PI) / 3.5) + 0.35 * (fine[i] - 0.5); break;
      case 'sandstone': t = fine[i]; break;
      case 'frosted': t = hash2(Math.floor(u * 1.5), Math.floor(v * 1.5), 7); break;
      case 'blocks': { const bu = ((u % 12) + 12) % 12, bv = ((v % 12) + 12) % 12; t = ramp(0, 2.5, Math.min(bu, 12 - bu, bv, 12 - bv)); break; }
      case 'tiny_lens': { const cu = ((u % 8) + 8) % 8 - 4, cv = ((v % 8) + 8) % 8 - 4, r = Math.hypot(cu, cv) / 4; t = r < 1 ? Math.sqrt(1 - r * r) : 0; break; }
      default: t = 0.5 + 0.25 * Math.sin((u * Math.PI) / 2) * Math.sin((v * Math.PI) / 2) + 0.2 * (fine[i] - 0.5);
    }
    out[i] = t;
  }
  return out;
}

interface Cells { idx: Int32Array; d1: Plane; d2: Plane; sx: Float32Array; sy: Float32Array; count: number }
function voronoi(F: FilterFrame, w: number, h: number, cellPt: number, seed: number): Cells {
  const c = Math.max(1.5, cellPt * F.scale), gx0 = Math.floor((0 - F.x) / c) - 1, gy0 = Math.floor((0 - F.y) / c) - 1, cols = Math.floor((w - F.x) / c) + 2 - gx0, rows = Math.floor((h - F.y) / c) + 2 - gy0;
  const count = cols * rows, sx = new Float32Array(count), sy = new Float32Array(count);
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
    const ax = gx + gx0, ay = gy + gy0, j = gy * cols + gx;
    sx[j] = F.x + (ax + 0.1 + 0.8 * hash2(ax, ay, seed)) * c; sy[j] = F.y + (ay + 0.1 + 0.8 * hash2(ax, ay, seed + 1)) * c;
  }
  const idx = new Int32Array(w * h), d1 = new Float32Array(w * h), d2 = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const cy = Math.floor((y - F.y) / c) - gy0;
    for (let x = 0; x < w; x++) {
      const cx = Math.floor((x - F.x) / c) - gx0;
      let b1 = Infinity, b2 = Infinity, bi = 0;
      for (let oy = -1; oy <= 1; oy++) {
        const ry = cy + oy;
        if (ry < 0 || ry >= rows) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const rx = cx + ox;
          if (rx < 0 || rx >= cols) continue;
          const j = ry * cols + rx, d = Math.hypot(sx[j] - x, sy[j] - y);
          if (d < b1) { b2 = b1; b1 = d; bi = j; } else if (d < b2) b2 = d;
        }
      }
      const i = y * w + x;
      idx[i] = bi; d1[i] = b1; d2[i] = b2;
    }
  }
  return { idx, d1, d2, sx, sy, count };
}

function cellMeans(px: Px, cells: Cells): { r: Float32Array; g: Float32Array; b: Float32Array; a: Float32Array } {
  const r = new Float32Array(cells.count), g = new Float32Array(cells.count), b = new Float32Array(cells.count), a = new Float32Array(cells.count), n = new Float32Array(cells.count);
  for (let i = 0; i < cells.idx.length; i++) { const j = cells.idx[i], k = px.a[i]; r[j] += px.r[i] * k; g[j] += px.g[i] * k; b[j] += px.b[i] * k; a[j] += k; n[j]++; }
  for (let j = 0; j < cells.count; j++) { const k = a[j] > 1e-5 ? 1 / a[j] : 0; r[j] *= k; g[j] *= k; b[j] *= k; a[j] = n[j] ? a[j] / n[j] : 0; }
  return { r, g, b, a };
}

function twoTone(px: Px, m: Plane, fg: RGB3, bg: RGB3): Px {
  const out = like(px, px.a);
  for (let i = 0; i < m.length; i++) { const t = clamp(m[i]); out.r[i] = lerp(fg[0], bg[0], t); out.g[i] = lerp(fg[1], bg[1], t); out.b[i] = lerp(fg[2], bg[2], t); }
  return out;
}

function map(px: Px, fn: (r: number, g: number, b: number, i: number, out: number[]) => void): Px {
  const out = like(px, px.a), o = [0, 0, 0];
  for (let i = 0; i < px.r.length; i++) { fn(px.r[i], px.g[i], px.b[i], i, o); out.r[i] = clamp(o[0]); out.g[i] = clamp(o[1]); out.b[i] = clamp(o[2]); }
  return out;
}

const post = (v: number, n: number): number => Math.round(clamp(v) * (n - 1)) / (n - 1);

function palette(px: Px, alpha: Plane, n: number): number[] {
  const idx: number[] = [], step = Math.max(1, Math.floor(px.r.length / 6000));
  for (let i = 0; i < px.r.length; i += step) if (alpha[i] > 0.5) idx.push(i);
  if (!idx.length) return [0, 0, 0];
  idx.sort((a, b) => (0.299 * px.r[a] + 0.587 * px.g[a] + 0.114 * px.b[a]) - (0.299 * px.r[b] + 0.587 * px.g[b] + 0.114 * px.b[b]));
  const c: number[] = [];
  for (let k = 0; k < n; k++) { const i = idx[Math.min(idx.length - 1, Math.floor(((k + 0.5) / n) * idx.length))]; c.push(px.r[i], px.g[i], px.b[i]); }
  for (let it = 0; it < 8; it++) {
    const s = new Float64Array(n * 4);
    for (const i of idx) {
      let best = Infinity, j = 0;
      for (let k = 0; k < n; k++) { const d = (px.r[i] - c[k * 3]) ** 2 + (px.g[i] - c[k * 3 + 1]) ** 2 + (px.b[i] - c[k * 3 + 2]) ** 2; if (d < best) { best = d; j = k; } }
      s[j * 4] += px.r[i]; s[j * 4 + 1] += px.g[i]; s[j * 4 + 2] += px.b[i]; s[j * 4 + 3]++;
    }
    for (let k = 0; k < n; k++) if (s[k * 4 + 3]) { c[k * 3] = s[k * 4] / s[k * 4 + 3]; c[k * 3 + 1] = s[k * 4 + 1] / s[k * 4 + 3]; c[k * 3 + 2] = s[k * 4 + 2] / s[k * 4 + 3]; }
  }
  return c;
}

type Run = (px: Px, p: Params, F: FilterFrame) => Px;

const RUNS: Record<string, Run> = {
  'gallery.colored_pencil': (px, p, F) => {
    const s = F.scale, L = luma(px), E = sobel(L, px.w, px.h).mag, paper = 0.5 + num(p, 'paper', 25) / 100, pressure = num(p, 'pressure', 8) / 8;
    const hatch = stretch(streak(grain(F, px.w, px.h, 0.6, 3), px.w, px.h, 45, num(p, 'width', 4) * 2 * s), 4);
    return map(px, (r, g, b, i, o) => { const m = clamp((1 - L[i]) * 1.3 * pressure * (0.35 + hatch[i]) + E[i] * pressure * 1.5); o[0] = lerp(paper, r * 0.9, m); o[1] = lerp(paper, g * 0.9, m); o[2] = lerp(paper, b * 0.9, m); });
  },
  'gallery.cutout': (px, p, F) => {
    const n = Math.max(2, Math.round(num(p, 'levels', 4))), K = kuwahara(blurPx(px, (4 - num(p, 'fidelity', 2)) * 0.4 * F.scale), Math.max(1, (num(p, 'simplicity', 4) + 1) * 0.8 * F.scale));
    const pal = palette(K, px.a, n);
    return map(K, (r, g, b, _i, o) => { let best = Infinity, j = 0; for (let k = 0; k < pal.length; k += 3) { const d = (r - pal[k]) ** 2 + (g - pal[k + 1]) ** 2 + (b - pal[k + 2]) ** 2; if (d < best) { best = d; j = k; } } o[0] = pal[j]; o[1] = pal[j + 1]; o[2] = pal[j + 2]; });
  },
  'gallery.dry_brush': (px, p, F) => {
    const K = kuwahara(px, Math.max(1, (num(p, 'size', 2) + 1) * 1.2 * F.scale)), n = 3 + Math.round(num(p, 'detail', 8)), tx = grain(F, px.w, px.h, 0.7, 11), t = num(p, 'texture', 1) * 0.06;
    return map(K, (r, g, b, i, o) => { const k = 1 + (tx[i] - 0.5) * t; o[0] = post(r, n) * k; o[1] = post(g, n) * k; o[2] = post(b, n) * k; });
  },
  'gallery.film_grain': (px, p, F) => {
    const L = luma(px), g0 = grain(F, px.w, px.h, 0.45, 5), amt = (num(p, 'grain', 4) / 20) * 0.5, hl = num(p, 'highlight', 0) / 20, inten = num(p, 'intensity', 10) / 10;
    return map(px, (r, g, b, i, o) => { const n = (g0[i] - 0.5) * amt * (1 - 0.5 * L[i] * L[i]), boost = hl > 0 ? ramp(1 - hl, 1, L[i]) * inten * 0.6 : 0; o[0] = r + n + (1 - r) * boost; o[1] = g + n + (1 - g) * boost; o[2] = b + n + (1 - b) * boost; });
  },
  'gallery.fresco': (px, p, F) => {
    const K = kuwahara(px, (num(p, 'size', 2) + 1) * 1.3 * F.scale), E = sobel(luma(K), px.w, px.h).mag, tx = grain(F, px.w, px.h, 0.8, 13), t = num(p, 'texture', 1) * 0.07, d = num(p, 'detail', 8) / 10;
    return map(K, (r, g, b, i, o) => { const k = (1 - clamp(E[i] * (1 + d * 2)) * 0.7) * (1 + (tx[i] - 0.5) * t) * 0.92; o[0] = ((r - 0.5) * 1.4 + 0.5) * k; o[1] = ((g - 0.5) * 1.4 + 0.5) * k; o[2] = ((b - 0.5) * 1.4 + 0.5) * k; });
  },
  'gallery.neon_glow': (px, p, F) => {
    const L = luma(px), c = rgbOf(p, 'color', '#2b8cff'), bright = num(p, 'brightness', 15) / 25, size = num(p, 'size', 5);
    const E = blurPlane(sobel(L, px.w, px.h).mag, px.w, px.h, Math.abs(size) * 0.5 * F.scale + 0.5);
    const glow = blurPlane(E, px.w, px.h, Math.abs(size) * 0.6 * F.scale + 0.5);
    return map(px, (_r, _g, _b, i, o) => {
      const t = clamp(L[i] * (0.4 + bright)), lo = clamp(t * 2), hi = clamp(t * 2 - 1);
      const e = clamp((size >= 0 ? glow[i] : E[i]) * 3 * bright);
      for (let k = 0; k < 3; k++) o[k] = lerp(lerp(0, c[k], lo), 1, hi) + c[k] * e;
    });
  },
  'gallery.paint_daubs': (px, p, F) => {
    const size = num(p, 'size', 8), type = str(p, 'type', 'simple'), K = kuwahara(type === 'wide_blurry' ? blurPx(px, size * 0.2 * F.scale) : px, Math.max(1, size * 0.5 * F.scale));
    const S = unsharp(K, Math.max(1, size * 0.3 * F.scale), num(p, 'sharpness', 7) / 12);
    if (type === 'simple' || type === 'wide_sharp' || type === 'wide_blurry') return S;
    const E = sobel(luma(S), px.w, px.h).mag, sp = grain(F, px.w, px.h, 0.6, 21);
    return map(S, (r, g, b, i, o) => { const e = clamp(E[i] * 3); const k = type === 'light_rough' ? 1 + e * 0.5 : type === 'dark_rough' ? 1 - e * 0.5 : 1 + (sp[i] > 0.97 ? 0.6 : 0); o[0] = r * k; o[1] = g * k; o[2] = b * k; });
  },
  'gallery.palette_knife': (px, p, F) => {
    const K = kuwahara(px, Math.max(1, num(p, 'size', 25) * 0.35 * F.scale)), n = 3 + Math.round(num(p, 'detail', 3)) * 2, B = blurPx(K, num(p, 'softness', 0) * 0.3 * F.scale);
    return map(B, (r, g, b, _i, o) => { o[0] = post(r, n); o[1] = post(g, n); o[2] = post(b, n); });
  },
  'gallery.plastic_wrap': (px, p, F) => {
    const H = blurPlane(luma(px), px.w, px.h, num(p, 'smoothness', 7) * 0.6 * F.scale), k = (16 - num(p, 'detail', 9)) * 6 / Math.max(0.3, F.scale), strength = num(p, 'highlight', 15) / 15;
    const lx = -0.45, ly = -0.55, lz = 0.7;
    return map(px, (r, g, b, i, o) => {
      const x = i % px.w, y = (i / px.w) | 0, w = px.w;
      const gx = (H[y * w + Math.min(w - 1, x + 1)] - H[y * w + Math.max(0, x - 1)]) * k, gy = (H[Math.min(px.h - 1, y + 1) * w + x] - H[Math.max(0, y - 1) * w + x]) * k;
      const len = Math.hypot(gx, gy, 1), d = (-gx * lx - gy * ly + lz) / len, spec = Math.pow(clamp(d), 24) * strength, rim = clamp(Math.hypot(gx, gy) * 0.4) * 0.25;
      o[0] = r * (1 - rim) + spec; o[1] = g * (1 - rim) + spec; o[2] = b * (1 - rim) + spec;
    });
  },
  'gallery.poster_edges': (px, p, F) => {
    const n = 2 + Math.round(num(p, 'posterization', 2)), P = blurPx(px, 0.5 * F.scale), E = sobel(blurPlane(luma(px), px.w, px.h, Math.max(0.5, num(p, 'thickness', 2) * 0.3 * F.scale)), px.w, px.h).mag, inten = num(p, 'intensity', 1);
    return map(P, (r, g, b, i, o) => { const e = 1 - clamp(E[i] * (1 + inten) * 3 - 0.08); o[0] = post(r, n) * e; o[1] = post(g, n) * e; o[2] = post(b, n) * e; });
  },
  'gallery.rough_pastels': (px, p, F) => {
    const S = streakPx(px, 45, num(p, 'stroke', 6) * F.scale), T = texture(str(p, 'texture', 'canvas'), F, px.w, px.h, num(p, 'scaling', 100)), sh = shade(T, px.w, px.h, LIGHTS[str(p, 'light', 'bottom')] ?? 270, num(p, 'relief', 20) / 6);
    const chalk = grain(F, px.w, px.h, 0.5, 23), d = num(p, 'detail', 4) / 20;
    return map(S, (r, g, b, i, o) => { const k = 0.55 + 0.9 * sh[i], c = (chalk[i] > 0.8 - d * 0.3 ? 0.12 : 0); o[0] = r * k + c; o[1] = g * k + c; o[2] = b * k + c; });
  },
  'gallery.smudge_stick': (px, p, F) => {
    const S = streakPx(px, 45, (num(p, 'stroke', 2) + 1) * 3 * F.scale), L = luma(S), hl = num(p, 'highlight', 0) / 20, inten = num(p, 'intensity', 10) / 10;
    return map(S, (r, g, b, i, o) => { const boost = hl > 0 ? ramp(1 - hl, 1, L[i]) * inten * 0.7 : 0, k = 0.9; o[0] = r * k + (1 - r) * boost; o[1] = g * k + (1 - g) * boost; o[2] = b * k + (1 - b) * boost; });
  },
  'gallery.sponge': (px, p, F) => {
    const size = num(p, 'size', 2) + 1, K = kuwahara(px, size * 0.7 * F.scale), n = blurPlane(fbm(F, px.w, px.h, size * 1.4, 31), px.w, px.h, num(p, 'smoothness', 5) * 0.15 * F.scale), def = num(p, 'definition', 12) / 25;
    return map(K, (r, g, b, i, o) => { const blob = ramp(0.5, 0.62, n[i]) * def; const k = 1 - 0.55 * blob; o[0] = r * k; o[1] = g * k; o[2] = b * k; });
  },
  'gallery.underpainting': (px, p, F) => {
    const B = blurPx(px, num(p, 'size', 6) * 0.4 * F.scale), cov = num(p, 'coverage', 16) / 40, T = texture(str(p, 'texture', 'canvas'), F, px.w, px.h, num(p, 'scaling', 100)), sh = shade(T, px.w, px.h, LIGHTS[str(p, 'light', 'top')] ?? 90, num(p, 'relief', 4) / 6);
    return map(px, (r, g, b, i, o) => { const k = 0.6 + 0.8 * sh[i]; o[0] = lerp(r, B.r[i], cov) * k; o[1] = lerp(g, B.g[i], cov) * k; o[2] = lerp(b, B.b[i], cov) * k; });
  },
  'gallery.watercolor': (px, p, F) => {
    const K = kuwahara(px, (15 - num(p, 'detail', 9)) * 0.4 * F.scale + 1), E = sobel(luma(K), px.w, px.h).mag, sh = num(p, 'shadow', 1), tx = valueNoise(F, px.w, px.h, 3, 41), t = num(p, 'texture', 1) * 0.05;
    return map(K, (r, g, b, i, o) => { const dark = clamp(E[i] * (1.5 + sh * 0.6)) * 0.65, k = (1 - dark) * (1 - sh * 0.03) * (1 + (tx[i] - 0.5) * t), m = (r + g + b) / 3; o[0] = (m + (r - m) * 1.25) * k; o[1] = (m + (g - m) * 1.25) * k; o[2] = (m + (b - m) * 1.25) * k; });
  },
  'blur.radial': (px, p, F) => {
    const amount = num(p, 'amount', 10), zoom = str(p, 'method', 'spin') === 'zoom', n = QUALITY[str(p, 'quality', 'good')] ?? 16;
    const cx = F.x + F.w / 2 + (num(p, 'center_x', 0) / 100) * F.w, cy = F.y + F.h / 2 + (num(p, 'center_y', 0) / 100) * F.h, out = like(px), s = [0, 0, 0, 0];
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1) - 0.5;
        let sx: number, sy: number;
        if (zoom) { const f = 1 + t * (amount / 100) * 0.6; sx = cx + (x - cx) * f; sy = cy + (y - cy) * f; }
        else { const ang = (t * amount * 1.2 * Math.PI) / 180, co = Math.cos(ang), si = Math.sin(ang); sx = cx + (x - cx) * co - (y - cy) * si; sy = cy + (x - cx) * si + (y - cy) * co; }
        sample(px, sx, sy, s);
        r += s[0] * s[3]; g += s[1] * s[3]; b += s[2] * s[3]; a += s[3];
      }
      const i = y * px.w + x, k = a > 1e-5 ? 1 / a : 0;
      out.r[i] = r * k; out.g[i] = g * k; out.b[i] = b * k; out.a[i] = a / n;
    }
    return out;
  },
  'blur.smart': (px, p, F) => {
    const L = luma(px), B = blurPx(px, num(p, 'radius', 3) * F.scale), LB = luma(B), th = num(p, 'threshold', 25) / 255, mode = str(p, 'mode', 'normal');
    if (mode !== 'normal') {
      const E = sobel(L, px.w, px.h).mag;
      return map(B, (r, g, b, i, o) => { const e = ramp(th * 0.5, th, E[i]); if (mode === 'edge_only') { o[0] = o[1] = o[2] = e; } else { o[0] = r + e; o[1] = g + e; o[2] = b + e; } });
    }
    return map(px, (r, g, b, i, o) => { const t = 1 - ramp(th, th * 2, Math.abs(L[i] - LB[i])); o[0] = lerp(r, B.r[i], t); o[1] = lerp(g, B.g[i], t); o[2] = lerp(b, B.b[i], t); });
  },
  'gallery.accented_edges': (px, p, F) => {
    const L = luma(px), E = blurPlane(blurPlane(sobel(L, px.w, px.h).mag, px.w, px.h, num(p, 'width', 2) * 0.3 * F.scale), px.w, px.h, num(p, 'smoothness', 5) * 0.12 * F.scale), br = num(p, 'brightness', 38);
    return map(px, (r, g, b, i, o) => { const e = clamp(E[i] * 4); if (br >= 25) { const k = e * (br - 25) / 25; o[0] = r + (1 - r) * k; o[1] = g + (1 - g) * k; o[2] = b + (1 - b) * k; } else { const k = 1 - e * (25 - br) / 25; o[0] = r * k; o[1] = g * k; o[2] = b * k; } });
  },
  'gallery.angled_strokes': (px, p, F) => {
    const len = num(p, 'length', 15) * 0.6 * F.scale, A = streakPx(px, 45, len), B = streakPx(px, -45, len), L = luma(px), bal = (num(p, 'balance', 50) - 50) / 100;
    return unsharp(map(px, (_r, _g, _b, i, o) => { const t = ramp(0.4, 0.6, L[i] + bal); o[0] = lerp(B.r[i], A.r[i], t); o[1] = lerp(B.g[i], A.g[i], t); o[2] = lerp(B.b[i], A.b[i], t); }), 1.5 * F.scale, num(p, 'sharpness', 3) / 6);
  },
  'gallery.crosshatch': (px, p, F) => {
    const len = num(p, 'length', 9) * F.scale, n = grain(F, px.w, px.h, 0.7, 51), h1 = stretch(streak(n, px.w, px.h, 45, len), 5), h2 = stretch(streak(n, px.w, px.h, -45, len), 5), L = luma(px), st = num(p, 'strength', 1);
    return unsharp(map(px, (r, g, b, i, o) => { const h = (h1[i] + h2[i]) / 2, k = 1 - (1 - L[i]) * clamp((0.5 - h) * st * 2 + 0.5) * 0.55; o[0] = r * k; o[1] = g * k; o[2] = b * k; }), 1.5 * F.scale, num(p, 'sharpness', 6) / 10);
  },
  'gallery.dark_strokes': (px, p, F) => {
    const D = streakPx(px, 45, 5 * F.scale), W = streakPx(px, -45, 12 * F.scale), L = luma(px), bal = (num(p, 'balance', 5) - 5) / 20, black = num(p, 'black', 6) / 10, white = num(p, 'white', 2) / 10;
    return map(px, (_r, _g, _b, i, o) => { const t = ramp(0.45, 0.55, L[i] + bal), kd = 1 - black * 0.65, kw = white * 0.45; o[0] = lerp(D.r[i] * kd, W.r[i] + (1 - W.r[i]) * kw, t); o[1] = lerp(D.g[i] * kd, W.g[i] + (1 - W.g[i]) * kw, t); o[2] = lerp(D.b[i] * kd, W.b[i] + (1 - W.b[i]) * kw, t); });
  },
  'gallery.ink_outlines': (px, p, F) => {
    const S = streakPx(px, 45, num(p, 'length', 4) * F.scale), L = luma(px), E = sobel(L, px.w, px.h).mag, dark = num(p, 'dark', 20) / 50, light = num(p, 'light', 10) / 50;
    return map(S, (r, g, b, i, o) => { const ink = clamp(E[i] * 3) * dark, up = ramp(0.6, 1, L[i]) * light; o[0] = (r + (1 - r) * up) * (1 - ink); o[1] = (g + (1 - g) * up) * (1 - ink); o[2] = (b + (1 - b) * up) * (1 - ink); });
  },
  'gallery.spatter': (px, p, F) => {
    const rad = num(p, 'radius', 10) * 0.5 * F.scale, cell = Math.max(0.3, (16 - num(p, 'smoothness', 5)) * 0.12), nx = valueNoise(F, px.w, px.h, cell, 61), ny = valueNoise(F, px.w, px.h, cell, 62);
    for (let i = 0; i < nx.length; i++) { nx[i] = (nx[i] - 0.5) * 2 * rad; ny[i] = (ny[i] - 0.5) * 2 * rad; }
    return displace(px, nx, ny);
  },
  'gallery.sprayed_strokes': (px, p, F) => {
    const sp = RUNS['gallery.spatter'](px, { radius: num(p, 'radius', 7), smoothness: 6 }, F);
    const S = streakPx(sp, DIRS[str(p, 'direction', 'right_diagonal')] ?? -45, num(p, 'length', 12) * F.scale);
    return { ...S, a: streak(sp.a, px.w, px.h, DIRS[str(p, 'direction', 'right_diagonal')] ?? -45, num(p, 'length', 12) * F.scale) };
  },
  'gallery.sumi_e': (px, p, F) => {
    const B = blurPx(px, num(p, 'width', 10) * 0.15 * F.scale), L = luma(B), pr = num(p, 'pressure', 2) / 15, ct = 1 + num(p, 'contrast', 16) / 40;
    return map(B, (r, g, b, i, o) => { const k = 1 - ramp(0.25, 0.75, 1 - L[i]) * (0.45 + pr) * 0.8; o[0] = (r * k - 0.5) * ct + 0.5; o[1] = (g * k - 0.5) * ct + 0.5; o[2] = (b * k - 0.5) * ct + 0.5; });
  },
  'gallery.diffuse_glow': (px, p, F) => {
    const L = luma(px), g0 = grain(F, px.w, px.h, 0.45, 71), gr = num(p, 'graininess', 6) / 20, glow = num(p, 'glow', 10) / 20, clear = num(p, 'clear', 15) / 20, bg = rgbOf(p, 'color', '#ffffff');
    return map(px, (r, g, b, i, o) => { const m = ramp(1 - glow * 0.8 - 0.05, 1, L[i] + (g0[i] - 0.5) * gr) * (1 - clear * 0.6); o[0] = lerp(r, bg[0], m); o[1] = lerp(g, bg[1], m); o[2] = lerp(b, bg[2], m); });
  },
  'gallery.glass': (px, p, F) => {
    let T = blurPlane(texture(str(p, 'texture', 'frosted'), F, px.w, px.h, num(p, 'scaling', 100)), px.w, px.h, num(p, 'smoothness', 3) * 0.25 * F.scale);
    if (flag(p, 'invert', false)) T = T.map((v) => 1 - v);
    const { gx, gy } = sobel(T, px.w, px.h), k = num(p, 'distortion', 5) * F.scale * 2.5;
    for (let i = 0; i < gx.length; i++) { gx[i] *= k; gy[i] *= k; }
    return displace(px, gx, gy);
  },
  'gallery.ocean_ripple': (px, p, F) => {
    const size = num(p, 'size', 9), mag = num(p, 'magnitude', 9) * 0.6 * F.scale, n1 = fbm(F, px.w, px.h, size * 1.1, 81, 2), n2 = fbm(F, px.w, px.h, size * 1.1, 82, 2);
    for (let i = 0; i < n1.length; i++) { n1[i] = (n1[i] - 0.5) * 2 * mag; n2[i] = (n2[i] - 0.5) * 2 * mag; }
    return displace(px, n1, n2);
  },
  'gallery.color_halftone': (px, p, F) => {
    const cell = Math.max(2, num(p, 'radius', 8) * 2 * F.scale * 0.5), angles = [num(p, 'c', 108), num(p, 'm', 162), num(p, 'y', 90), num(p, 'k', 45)].map((a) => (a * Math.PI) / 180);
    const n = px.r.length, ch: Plane[] = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    for (let i = 0; i < n; i++) { const k = 1 - Math.max(px.r[i], px.g[i], px.b[i]), d = 1 - k || 1; ch[3][i] = k; ch[0][i] = (1 - px.r[i] - k) / d; ch[1][i] = (1 - px.g[i] - k) / d; ch[2][i] = (1 - px.b[i] - k) / d; }
    const cov = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    for (let c = 0; c < 4; c++) {
      const co = Math.cos(angles[c]), si = Math.sin(angles[c]);
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
        const u = ((x - F.x) * co + (y - F.y) * si) / cell, v = (-(x - F.x) * si + (y - F.y) * co) / cell, cu = Math.floor(u) + 0.5, cv = Math.floor(v) + 0.5;
        const sx = Math.round(F.x + (cu * co - cv * si) * cell), sy = Math.round(F.y + (cu * si + cv * co) * cell), j = clamp(sy, 0, px.h - 1) * px.w + clamp(sx, 0, px.w - 1);
        const rad = Math.sqrt(clamp(ch[c][j])) * 0.7071, d = Math.hypot(u - cu, v - cv);
        cov[c][y * px.w + x] = clamp((rad - d) * cell + 0.5);
      }
    }
    return map(px, (_r, _g, _b, i, o) => { const k = 1 - cov[3][i]; o[0] = (1 - cov[0][i]) * k; o[1] = (1 - cov[1][i]) * k; o[2] = (1 - cov[2][i]) * k; });
  },
  'gallery.crystallize': (px, p, F) => {
    const cells = voronoi(F, px.w, px.h, num(p, 'cell', 10), 91), out = like(px), s = [0, 0, 0, 0], cache = new Float32Array(cells.count * 4).fill(-1);
    for (let i = 0; i < cells.idx.length; i++) {
      const j = cells.idx[i];
      if (cache[j * 4] < 0) { sample(px, cells.sx[j], cells.sy[j], s); cache[j * 4] = s[0]; cache[j * 4 + 1] = s[1]; cache[j * 4 + 2] = s[2]; cache[j * 4 + 3] = s[3]; }
      out.r[i] = cache[j * 4]; out.g[i] = cache[j * 4 + 1]; out.b[i] = cache[j * 4 + 2]; out.a[i] = cache[j * 4 + 3];
    }
    return out;
  },
  'gallery.mezzotint': (px, p, F) => {
    const type = str(p, 'type', 'medium_dots'), dot = MEZZO_DOTS[type];
    const make = (seed: number): Plane => {
      if (dot) { const g = grain(F, px.w, px.h, dot, seed); return type === 'grainy_dots' ? blurPlane(g, px.w, px.h, 0.4 * F.scale) : g; }
      const len = /short/.test(type) ? 4 : /medium/.test(type) ? 9 : 18;
      return stretch(streak(grain(F, px.w, px.h, 0.5, seed), px.w, px.h, /lines/.test(type) ? 0 : 45, len * F.scale), 3);
    };
    const nr = make(101), ng = make(102), nb = make(103), aa = 0.03;
    return map(px, (r, g, b, i, o) => { o[0] = ramp(nr[i] - aa, nr[i] + aa, r); o[1] = ramp(ng[i] - aa, ng[i] + aa, g); o[2] = ramp(nb[i] - aa, nb[i] + aa, b); });
  },
  'gallery.pointillize': (px, p, F) => {
    const size = num(p, 'cell', 5), cells = voronoi(F, px.w, px.h, size, 111), bg = rgbOf(p, 'background', '#ffffff'), out = like(px), s = [0, 0, 0, 0], c = size * F.scale;
    for (let i = 0; i < cells.idx.length; i++) {
      const j = cells.idx[i], rad = c * (0.42 + 0.16 * hash2(j, 7, 113)), m = clamp(rad - cells.d1[i] + 0.5), v = (hash2(j, 3, 117) - 0.5) * 0.25;
      sample(px, cells.sx[j], cells.sy[j], s);
      out.r[i] = lerp(bg[0], clamp(s[0] + v), m); out.g[i] = lerp(bg[1], clamp(s[1] + v), m); out.b[i] = lerp(bg[2], clamp(s[2] + v), m);
    }
    return out;
  },
  'gallery.bas_relief': (px, p, F) => {
    const H = blurPlane(luma(px), px.w, px.h, num(p, 'smoothness', 3) * 0.4 * F.scale), sh = shade(H, px.w, px.h, LIGHTS[str(p, 'light', 'bottom')] ?? 270, num(p, 'detail', 13) * 2.2);
    return twoTone(px, sh, rgbOf(p, 'foreground', '#000000'), rgbOf(p, 'background', '#ffffff'));
  },
  'gallery.chalk_charcoal': (px, p, F) => {
    const L = luma(px), n = grain(F, px.w, px.h, 0.6, 121), A = stretch(streak(n, px.w, px.h, 45, 6 * F.scale), 4), B = stretch(streak(n, px.w, px.h, -45, 6 * F.scale), 4), ch = num(p, 'charcoal', 6) / 20, ck = num(p, 'chalk', 6) / 20, pr = 1 + num(p, 'pressure', 1) / 2;
    const m = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) m[i] = clamp(0.5 - (1 - L[i]) * ch * pr * (0.3 + A[i]) * 1.4 + L[i] * ck * pr * (0.3 + B[i]) * 1.4);
    return twoTone(px, m, rgbOf(p, 'foreground', '#000000'), rgbOf(p, 'background', '#ffffff'));
  },
  'gallery.charcoal': (px, p, F) => {
    const L = luma(px), st = stretch(streak(grain(F, px.w, px.h, 0.8, 131), px.w, px.h, 45, (num(p, 'thickness', 1) + 2) * 3 * F.scale), 3), E = sobel(L, px.w, px.h).mag, det = num(p, 'detail', 5) / 5, bal = (num(p, 'balance', 50) - 50) / 100;
    const m = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) m[i] = ramp(0.35, 0.65, L[i] + bal + (st[i] - 0.5) * 0.6) * (1 - clamp(E[i] * 2.5 * det));
    return twoTone(px, m, rgbOf(p, 'foreground', '#000000'), rgbOf(p, 'background', '#ffffff'));
  },
  'gallery.chrome': (px, p, F) => {
    const H = blurPlane(luma(px), px.w, px.h, (num(p, 'smoothness', 7) + 1) * 0.5 * F.scale), f = 2 + num(p, 'detail', 4) * 0.8;
    return map(px, (_r, _g, _b, i, o) => { const v = 0.5 + 0.5 * Math.sin(H[i] * Math.PI * f), c = ramp(0.05, 0.95, v); o[0] = o[1] = o[2] = c; });
  },
  'gallery.conte_crayon': (px, p, F) => {
    const L = luma(px), T = texture(str(p, 'texture', 'canvas'), F, px.w, px.h, num(p, 'scaling', 100)), sh = shade(T, px.w, px.h, LIGHTS[str(p, 'light', 'top')] ?? 90, num(p, 'relief', 4) / 4), fl = num(p, 'fg_level', 11) / 8, bl = num(p, 'bg_level', 7) / 8;
    const m = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) m[i] = clamp(0.5 + (L[i] * bl - (1 - L[i]) * fl) * 0.7 + (sh[i] - 0.5) * 0.8);
    return twoTone(px, m, rgbOf(p, 'foreground', '#3b2417'), rgbOf(p, 'background', '#ffffff'));
  },
  'gallery.graphic_pen': (px, p, F) => {
    const L = luma(px), st = stretch(streak(grain(F, px.w, px.h, 0.6, 141), px.w, px.h, DIRS[str(p, 'direction', 'right_diagonal')] ?? -45, num(p, 'length', 15) * F.scale), 4), bal = (num(p, 'balance', 50) - 50) / 100;
    const m = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) m[i] = ramp(st[i] - 0.04, st[i] + 0.04, L[i] + bal);
    return twoTone(px, m, rgbOf(p, 'foreground', '#000000'), rgbOf(p, 'background', '#ffffff'));
  },
  'gallery.halftone_pattern': (px, p, F) => {
    const L = luma(px), c = (num(p, 'size', 1) + 2) * 1.2 * F.scale, ct = 1 + num(p, 'contrast', 5) / 10, type = str(p, 'type', 'dot'), cx = F.x + F.w / 2, cy = F.y + F.h / 2;
    const m = new Float32Array(L.length);
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
      const i = y * px.w + x, v = clamp((L[i] - 0.5) * ct + 0.5);
      let pat: number;
      if (type === 'line') pat = 0.5 + 0.5 * Math.cos(((y - F.y) / c) * 2 * Math.PI);
      else if (type === 'circle') pat = 0.5 + 0.5 * Math.cos((Math.hypot(x - cx, y - cy) / c) * 2 * Math.PI);
      else { const u = (x - F.x) / c, w2 = (y - F.y) / c; pat = Math.hypot(u - Math.floor(u) - 0.5, w2 - Math.floor(w2) - 0.5) * 1.41; }
      m[i] = ramp(pat - 0.08, pat + 0.08, v);
    }
    return twoTone(px, m, rgbOf(p, 'foreground', '#000000'), rgbOf(p, 'background', '#ffffff'));
  },
  'gallery.note_paper': (px, p, F) => {
    const L = blurPlane(luma(px), px.w, px.h, 0.8 * F.scale), g0 = grain(F, px.w, px.h, 0.5, 151), bal = num(p, 'balance', 25) / 50, gr = num(p, 'graininess', 10) / 20;
    const m = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) m[i] = ramp(bal - 0.05, bal + 0.05, L[i]);
    const H = blurPlane(m, px.w, px.h, 0.8 * F.scale), sh = shade(H, px.w, px.h, 135, num(p, 'relief', 11) * 1.5), fg = rgbOf(p, 'foreground', '#000000'), bg = rgbOf(p, 'background', '#ffffff');
    return map(px, (_r, _g, _b, i, o) => { const t = lerp(0.35, 1, m[i]) * (0.75 + 0.5 * sh[i]) * (1 + (g0[i] - 0.5) * gr * 0.3); o[0] = lerp(fg[0], bg[0], t); o[1] = lerp(fg[1], bg[1], t); o[2] = lerp(fg[2], bg[2], t); });
  },
  'gallery.photocopy': (px, p, F) => {
    const L = luma(px), B = blurPlane(L, px.w, px.h, num(p, 'detail', 7) * 0.5 * F.scale), dk = num(p, 'darkness', 8) / 8;
    const m = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) m[i] = 1 - clamp((B[i] - L[i]) * 12 * dk - 0.05) * (L[i] < 0.95 ? 1 : 0);
    return twoTone(px, m, rgbOf(p, 'foreground', '#000000'), rgbOf(p, 'background', '#ffffff'));
  },
  'gallery.plaster': (px, p, F) => {
    const L = blurPlane(luma(px), px.w, px.h, 0.6 * F.scale), bal = num(p, 'balance', 20) / 50, m = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) m[i] = 1 - ramp(bal - 0.06, bal + 0.06, L[i]);
    const H = blurPlane(m, px.w, px.h, num(p, 'smoothness', 2) * 0.6 * F.scale + 0.6), sh = shade(H, px.w, px.h, LIGHTS[str(p, 'light', 'top')] ?? 90, 6), t = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) t[i] = clamp(0.72 + (sh[i] - 0.5) * 1.3 - H[i] * 0.12);
    return twoTone(px, t, rgbOf(p, 'foreground', '#000000'), rgbOf(p, 'background', '#ffffff'));
  },
  'gallery.reticulation': (px, p, F) => {
    const L = luma(px), n = blurPlane(grain(F, px.w, px.h, 0.5, 161), px.w, px.h, 0.5 * F.scale), dens = num(p, 'density', 12) / 50, shift = (num(p, 'bg_level', 5) - num(p, 'fg_level', 40)) / 100, m = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) m[i] = ramp(0.38, 0.62, L[i] * 0.8 + 0.1 + shift * 0.25 + (n[i] - 0.5) * (0.5 + dens));
    return twoTone(px, m, rgbOf(p, 'foreground', '#000000'), rgbOf(p, 'background', '#ffffff'));
  },
  'gallery.stamp': (px, p, F) => {
    const B = blurPlane(luma(px), px.w, px.h, num(p, 'smoothness', 5) * 0.25 * F.scale), t = num(p, 'balance', 25) / 50, m = new Float32Array(B.length);
    for (let i = 0; i < B.length; i++) m[i] = ramp(t - 0.02, t + 0.02, B[i]);
    return twoTone(px, m, rgbOf(p, 'foreground', '#000000'), rgbOf(p, 'background', '#ffffff'));
  },
  'gallery.torn_edges': (px, p, F) => {
    const B = blurPlane(luma(px), px.w, px.h, 0.6 * F.scale), n = fbm(F, px.w, px.h, 2, 171, 3), t = num(p, 'balance', 25) / 50, rough = (16 - num(p, 'smoothness', 11)) / 15, edge = 0.12 / Math.max(1, num(p, 'contrast', 17) / 4), m = new Float32Array(B.length);
    for (let i = 0; i < B.length; i++) m[i] = ramp(-edge, edge, B[i] - t + (n[i] - 0.5) * 0.4 * rough);
    return twoTone(px, m, rgbOf(p, 'foreground', '#000000'), rgbOf(p, 'background', '#ffffff'));
  },
  'gallery.water_paper': (px, p, F) => {
    const fib = stretch(streak(grain(F, px.w, px.h, 0.6, 181), px.w, px.h, 90, num(p, 'fiber', 15) * F.scale), 2.5), B = blurPx(px, 0.8 * F.scale), br = (num(p, 'brightness', 60) - 50) / 100, ct = num(p, 'contrast', 80) / 80;
    return map(B, (r, g, b, i, o) => { const k = 0.82 + 0.3 * fib[i]; o[0] = ((r - 0.5) * ct + 0.5 + br) * k; o[1] = ((g - 0.5) * ct + 0.5 + br) * k; o[2] = ((b - 0.5) * ct + 0.5 + br) * k; });
  },
  'gallery.glowing_edges': (px, p, F) => {
    const B = blurPx(px, num(p, 'smoothness', 5) * 0.15 * F.scale), wd = num(p, 'width', 2) * 0.35 * F.scale, br = num(p, 'brightness', 6) / 4;
    const er = blurPlane(sobel(B.r, px.w, px.h).mag, px.w, px.h, wd), eg = blurPlane(sobel(B.g, px.w, px.h).mag, px.w, px.h, wd), eb = blurPlane(sobel(B.b, px.w, px.h).mag, px.w, px.h, wd);
    return map(px, (_r, _g, _b, i, o) => { o[0] = er[i] * br * 3; o[1] = eg[i] * br * 3; o[2] = eb[i] * br * 3; });
  },
  'gallery.craquelure': (px, p, F) => {
    const cells = voronoi(F, px.w, px.h, num(p, 'spacing', 15) * 0.8, 191), crack = new Float32Array(cells.d1.length), w2 = 0.9 * F.scale;
    for (let i = 0; i < crack.length; i++) crack[i] = 1 - ramp(0, w2, cells.d2[i] - cells.d1[i]);
    const depth = num(p, 'depth', 6) / 10, H = blurPlane(crack.map((c) => 1 - c * depth), px.w, px.h, 0.7 * F.scale), sh = shade(H, px.w, px.h, 135, 6), bright = 0.75 + num(p, 'brightness', 9) * 0.035;
    return map(px, (r, g, b, i, o) => { const k = bright * (0.75 + 0.5 * sh[i]) * (1 - crack[i] * depth * 0.6); o[0] = r * k; o[1] = g * k; o[2] = b * k; });
  },
  'gallery.grain': (px, p, F) => {
    const type = str(p, 'type', 'regular'), it = num(p, 'intensity', 40) / 100, ct = 1 + (num(p, 'contrast', 50) - 50) / 100;
    const size = type === 'enlarged' ? 1.5 : type === 'clumped' ? 0.9 : type === 'soft' ? 0.7 : 0.45;
    let n = grain(F, px.w, px.h, size, 201);
    if (type === 'soft' || type === 'clumped') n = stretch(blurPlane(n, px.w, px.h, 0.5 * F.scale), 2.5);
    if (type === 'horizontal' || type === 'vertical') n = stretch(streak(n, px.w, px.h, type === 'horizontal' ? 0 : 90, 8 * F.scale), 4);
    const L = luma(px);
    return map(px, (r, g, b, i, o) => {
      const v = n[i] - 0.5;
      if (type === 'sprinkles' || type === 'speckle') { const dot = n[i] > 1 - it * 0.3 ? (type === 'speckle' ? 1 : (L[i] > 0.5 ? 0 : 1)) : -1; if (dot >= 0) { o[0] = o[1] = o[2] = dot; return; } }
      if (type === 'stippled') { const d = n[i] < it * (1 - L[i]) ? 0.6 : 1; o[0] = r * d; o[1] = g * d; o[2] = b * d; return; }
      const k = (type === 'contrasty' ? 2 : 1) * it;
      o[0] = (r + v * k - 0.5) * ct + 0.5; o[1] = (g + v * k - 0.5) * ct + 0.5; o[2] = (b + v * k - 0.5) * ct + 0.5;
    });
  },
  'gallery.mosaic_tiles': (px, p, F) => {
    const c = Math.max(3, num(p, 'size', 12) * F.scale), gw = Math.max(0.6, num(p, 'grout', 3) * 0.35 * F.scale), lt = num(p, 'lighten', 9) / 10;
    return map(px, (r, g, b, i, o) => {
      const x = i % px.w, y = (i / px.w) | 0, u = ((x - F.x) % c + c) % c, v = ((y - F.y) % c + c) % c, d = Math.min(u, c - u, v, c - v);
      const gr = 1 - ramp(gw * 0.5, gw, d), bev = 1 + (ramp(0, gw * 2.5, Math.min(u, v)) - ramp(0, gw * 2.5, Math.min(c - u, c - v))) * 0.08;
      o[0] = lerp(r * bev, r + (1 - r) * lt * 0.7, gr); o[1] = lerp(g * bev, g + (1 - g) * lt * 0.7, gr); o[2] = lerp(b * bev, b + (1 - b) * lt * 0.7, gr);
    });
  },
  'gallery.patchwork': (px, p, F) => {
    const c = Math.max(2, (num(p, 'size', 4) + 2) * 1.5 * F.scale), rel = num(p, 'relief', 8) / 25, s = [0, 0, 0, 0];
    return map(px, (_r, _g, _b, i, o) => {
      const x = i % px.w, y = (i / px.w) | 0, gx = Math.floor((x - F.x) / c), gy = Math.floor((y - F.y) / c), u = (x - F.x) / c - gx, v = (y - F.y) / c - gy;
      sample(px, F.x + (gx + 0.5) * c, F.y + (gy + 0.5) * c, s);
      const lum = 0.299 * s[0] + 0.587 * s[1] + 0.114 * s[2], edge = Math.min(u, v) < 0.12 ? 1 + rel * (1 - lum) * 0.8 : Math.max(u, v) > 0.88 ? 1 - rel * (1 - lum) * 0.8 : 1;
      o[0] = s[0] * edge; o[1] = s[1] * edge; o[2] = s[2] * edge;
    });
  },
  'gallery.stained_glass': (px, p, F) => {
    const size = num(p, 'cell', 10), cells = voronoi(F, px.w, px.h, size, 211), mean = cellMeans(px, cells), bw = num(p, 'border', 4) * 0.3 * F.scale, light = num(p, 'light', 3) / 10, lead = rgbOf(p, 'foreground', '#000000'), c = size * F.scale;
    const out = like(px);
    for (let i = 0; i < cells.idx.length; i++) {
      const j = cells.idx[i], br = 1 + light * 0.6 * clamp(1 - cells.d1[i] / c), m = ramp(bw * 0.5, bw * 0.5 + 1, cells.d2[i] - cells.d1[i]);
      out.r[i] = lerp(lead[0], clamp(mean.r[j] * br), m); out.g[i] = lerp(lead[1], clamp(mean.g[j] * br), m); out.b[i] = lerp(lead[2], clamp(mean.b[j] * br), m);
    }
    return out;
  },
  'gallery.texturizer': (px, p, F) => {
    let T = texture(str(p, 'texture', 'canvas'), F, px.w, px.h, num(p, 'scaling', 100));
    if (flag(p, 'invert', false)) T = T.map((v) => 1 - v);
    const sh = shade(T, px.w, px.h, LIGHTS[str(p, 'light', 'top')] ?? 90, num(p, 'relief', 4) / 3);
    return map(px, (r, g, b, i, o) => { const k = 1 + (sh[i] - 0.5) * 1.2; o[0] = r * k; o[1] = g * k; o[2] = b * k; });
  },
  'gallery.de_interlace': (px, p, F) => {
    const odd = str(p, 'eliminate', 'odd') === 'odd', dup = str(p, 'create', 'interpolation') === 'duplication', step = Math.max(1, Math.round(F.scale)), out = like(px, px.a);
    for (let y = 0; y < px.h; y++) {
      const line = Math.floor((y - Math.round(F.y)) / step), drop = (((line % 2) + 2) % 2 === 1) === odd;
      for (let x = 0; x < px.w; x++) {
        const i = y * px.w + x, up = Math.max(0, y - step) * px.w + x, dn = Math.min(px.h - 1, y + step) * px.w + x;
        if (!drop) { out.r[i] = px.r[i]; out.g[i] = px.g[i]; out.b[i] = px.b[i]; continue; }
        if (dup) { out.r[i] = px.r[up]; out.g[i] = px.g[up]; out.b[i] = px.b[up]; } else { out.r[i] = (px.r[up] + px.r[dn]) / 2; out.g[i] = (px.g[up] + px.g[dn]) / 2; out.b[i] = (px.b[up] + px.b[dn]) / 2; }
      }
    }
    return out;
  },
  '3d.inflate': (px, p, F) => {
    const { w, h } = px, n = w * h, R = Math.max(1, num(p, 'depth', 20) * F.scale), vol = clamp(num(p, 'volume', 100) / 100, 0.1, 1), dist = new Float32Array(n), D2 = Math.SQRT2;
    for (let i = 0; i < n; i++) dist[i] = px.a[i] > 0.5 ? 1e9 : 0;
    const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : dist[y * w + x]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (dist[i]) dist[i] = Math.min(dist[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + D2, at(x + 1, y - 1) + D2); }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (dist[i]) dist[i] = Math.min(dist[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + D2, at(x - 1, y + 1) + D2); }
    const H = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = Math.min(1, dist[i] / R); H[i] = R * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))) * vol; }
    const S = blurPlane(H, w, h, Math.max(0.8, R * 0.12)), L = lighting(p), rx = num(p, 'rx', 0), ry = num(p, 'ry', 0), rz = num(p, 'rz', 0);
    if (p.ray_trace === true) return inflateTrace(px, S, p.quality, F, L, rx, ry, rz);
    if (rx || ry || rz) {
      const turn = rotator(rx, ry, rz), cx = F.x + F.w / 2, cy = F.y + F.h / 2, out = like(px, new Float32Array(n)), dir = turn.inv([0, 0, 1]);
      let top = 0, bx0 = w, by0 = h, bx1 = -1, by1 = -1;
      for (let i = 0; i < n; i++) { top = Math.max(top, S[i]); if (px.a[i] > 0.5) { const x = i % w, y = (i / w) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; } }
      if (bx1 < 0) return out;
      const lo3 = [bx0 - 0.5, by0 - 0.5, -top - 0.5], hi3 = [bx1 + 0.5, by1 + 0.5, 0.5], dt = 0.75 * Math.max(1, F.scale), A = (x: number, y: number): number => px.a[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
      const solidAt = (o: number[]): number => { const x = Math.round(o[0]), y = Math.round(o[1]); if (x < 0 || y < 0 || x >= w || y >= h) return -1; const i = y * w + x; return px.a[i] > 0.5 && o[2] <= 0 && o[2] >= -S[i] ? i : -1; };
      const cast = (qx: number, qy: number): RGB3 | null => {
        const v = turn.inv([qx - cx, qy - cy, 0]), o0 = [cx + v[0], cy + v[1], v[2]], ray = (t: number): number[] => [o0[0] + dir[0] * t, o0[1] + dir[1] * t, o0[2] + dir[2] * t];
        let t0 = -1e9, t1 = 1e9;
        for (let k = 0; k < 3; k++) {
          if (Math.abs(dir[k]) < 1e-9) { if (o0[k] < lo3[k] || o0[k] > hi3[k]) return null; continue; }
          const a = (lo3[k] - o0[k]) / dir[k], b = (hi3[k] - o0[k]) / dir[k];
          t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
        }
        if (t0 > t1) return null;
        let prev = t0, hit = -1, o = ray(t0);
        for (let t = t0; t < t1 + dt; t += dt) { const tc = Math.min(t, t1); o = ray(tc); hit = solidAt(o); if (hit >= 0) { let lo = prev, hi = tc; for (let k = 0; k < 5; k++) { const mid = (lo + hi) / 2, om = ray(mid); if (solidAt(om) >= 0) { hi = mid; o = om; } else lo = mid; } hit = solidAt(o); break; } prev = tc; }
        if (hit < 0) return null;
        const x = Math.round(o[0]), y = Math.round(o[1]), onTop = Math.abs(o[2] + S[hit]) < 1.5;
        const gx = A(x + 1, y) - A(x - 1, y), gy = A(x, y + 1) - A(x, y - 1), gl = Math.hypot(gx, gy);
        let nl: RGB3 = [0, 0, 1];
        if (!onTop && o[2] < -1.5 && gl > 1e-6) nl = [-gx / gl, -gy / gl, 0];
        else if (onTop || o[2] < -1.5) { const hx = (S[y * w + Math.min(w - 1, x + 1)] - S[y * w + Math.max(0, x - 1)]) / 2, hy = (S[Math.min(h - 1, y + 1) * w + x] - S[Math.max(0, y - 1) * w + x]) / 2, l = Math.hypot(hx, hy, 1); nl = [-hx / l, -hy / l, -1 / l]; }
        let nv = turn.fwd(nl);
        if (nv[2] > 0) nv = [-nv[0], -nv[1], -nv[2]];
        return shadeRgb([px.r[hit], px.g[hit], px.b[hit]], nv as RGB3, L);
      };
      const mask = new Uint8Array(n);
      for (let qy = 0; qy < h; qy++) for (let qx = 0; qx < w; qx++) { const c = cast(qx, qy), j = qy * w + qx; if (!c) continue; mask[j] = 1; out.r[j] = c[0]; out.g[j] = c[1]; out.b[j] = c[2]; out.a[j] = 1; }
      for (let qy = 0; qy < h; qy++) for (let qx = 0; qx < w; qx++) {
        const j = qy * w + qx, m = mask[j];
        if (!((qx > 0 && mask[j - 1] !== m) || (qx < w - 1 && mask[j + 1] !== m) || (qy > 0 && mask[j - w] !== m) || (qy < h - 1 && mask[j + w] !== m))) continue;
        let r = 0, g = 0, b = 0, k = 0;
        for (let s = 0; s < 4; s++) { const c = cast(qx + ((s & 1) - 0.5) * 0.5, qy + ((s >> 1) - 0.5) * 0.5); if (c) { r += c[0]; g += c[1]; b += c[2]; k++; } }
        if (k) { out.r[j] = r / k; out.g[j] = g / k; out.b[j] = b / k; }
        out.a[j] = k / 4;
      }
      return out;
    }
    return map(px, (r, g, b, i, o) => {
      const x = i % w, y = (i / w) | 0, hx = (S[y * w + Math.min(w - 1, x + 1)] - S[y * w + Math.max(0, x - 1)]) / 2, hy = (S[Math.min(h - 1, y + 1) * w + x] - S[Math.max(0, y - 1) * w + x]) / 2, l = Math.hypot(hx, hy, 1);
      const c = shadeRgb([r, g, b], [-hx / l, -hy / l, -1 / l], L);
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    });
  },
  'rasterize.raster': (px, p, F) => {
    const c = (F.scale * 72) / Math.max(1, num(p, 'resolution', 72)), white = str(p, 'background', 'transparent') === 'white', out = like(px), { w, h } = px;
    if (c > 1.01) {
      const gx0 = Math.floor(-F.x / c) - 1, cols = Math.floor((w - F.x) / c) + 2 - gx0, gy0 = Math.floor(-F.y / c) - 1, rows = Math.floor((h - F.y) / c) + 2 - gy0, sum = new Float64Array(cols * rows * 5);
      const cell = (x: number, y: number): number => ((Math.floor((y - F.y) / c) - gy0) * cols + Math.floor((x - F.x) / c) - gx0) * 5;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, k = cell(x, y), a = px.a[i]; sum[k] += px.r[i] * a; sum[k + 1] += px.g[i] * a; sum[k + 2] += px.b[i] * a; sum[k + 3] += a; sum[k + 4]++; }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, k = cell(x, y), a = sum[k + 3], q = a > 1e-6 ? 1 / a : 0; out.r[i] = sum[k] * q; out.g[i] = sum[k + 1] * q; out.b[i] = sum[k + 2] * q; out.a[i] = a / sum[k + 4]; }
    } else { out.r.set(px.r); out.g.set(px.g); out.b.set(px.b); out.a.set(px.a); }
    if (white) {
      const m = num(p, 'around', 0) * F.scale, x0 = F.x - m, y0 = F.y - m, x1 = F.x + F.w + m, y1 = F.y + F.h + m;
      for (let y = Math.max(0, Math.floor(y0)); y < Math.min(h, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(w, Math.ceil(x1)); x++) { const i = y * w + x, a = out.a[i]; out.r[i] = out.r[i] * a + 1 - a; out.g[i] = out.g[i] * a + 1 - a; out.b[i] = out.b[i] * a + 1 - a; out.a[i] = 1; }
    }
    return out;
  },
  'gallery.ntsc_colors': (px) => map(px, (r, g, b, _i, o) => {
    const Y = 0.299 * r + 0.587 * g + 0.114 * b, I = 0.596 * r - 0.274 * g - 0.322 * b, Q = 0.211 * r - 0.523 * g + 0.312 * b, c = Math.hypot(I, Q), lim = 0.24, k = c > lim ? lim / c : 1, i2 = I * k, q2 = Q * k;
    o[0] = Y + 0.956 * i2 + 0.621 * q2; o[1] = Y - 0.272 * i2 - 0.647 * q2; o[2] = Y - 1.106 * i2 + 1.703 * q2;
  }),
};

export const FILTER_IDS = new Set(Object.keys(RUNS));
const MOVES_ALPHA = new Set(['rasterize.raster', 'blur.radial', 'gallery.spatter', 'gallery.sprayed_strokes', 'gallery.glass', 'gallery.ocean_ripple', 'gallery.crystallize', '3d.inflate']);

export function filterReach(id: string, p: Params): number {
  if (id === 'gallery.spatter' || id === 'gallery.sprayed_strokes') return num(p, 'radius', 10) * 0.5 + (id === 'gallery.sprayed_strokes' ? num(p, 'length', 12) / 2 : 0);
  if (id === 'gallery.glass') return num(p, 'distortion', 5) * 1.5;
  if (id === 'gallery.ocean_ripple') return num(p, 'magnitude', 9) * 0.6;
  if (id === 'gallery.crystallize') return num(p, 'cell', 10) * 0.5;
  if (id === '3d.inflate') return num(p, 'rx', 0) || num(p, 'ry', 0) || num(p, 'rz', 0) ? num(p, 'depth', 20) * 1.2 : 0;
  if (id === 'rasterize.raster') return str(p, 'background', 'transparent') === 'white' ? num(p, 'around', 0) : 0;
  return 0;
}

export function runFilter(id: string, p: Params, img: ImageData, F: FilterFrame): void {
  const run = RUNS[id];
  if (!run || img.width < 1 || img.height < 1) return;
  const px = unpack(img), alpha = Float32Array.from(px.a);
  bleed(px);
  const out = run(px, p, F);
  if (!MOVES_ALPHA.has(id)) out.a = alpha;
  pack(out, img);
}
