import { freeformSampler, toCmyk, toRgb } from '../engine/paint';
import type { Color, Gradient, MeshNode, Pt, Rect } from '../engine';

export interface ShadingData { dict: string; stream: Uint8Array }

class Bits {
  private out: number[] = [];
  u8(v: number): void { this.out.push(v & 255); }
  u16(v: number): void { this.out.push((v >> 8) & 255, v & 255); }
  u32(v: number): void { this.out.push(Math.floor(v / 16777216) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); }
  bytes(): Uint8Array { return Uint8Array.from(this.out); }
}

const n3 = (v: number): string => String(Math.round(v * 1e4) / 1e4);
const clamp = (v: number): number => Math.max(0, Math.min(1, v));

function components(c: Color, cmyk: boolean): number[] {
  if (cmyk) { const k = toCmyk(c); return k.kind === 'cmyk' ? [k.c / 100, k.m / 100, k.y / 100, k.k / 100] : [0, 0, 0, 1]; }
  const v = toRgb(c);
  return [v.r / 255, v.g / 255, v.b / 255];
}

function decode(b: Rect, n: number): string { return `[${n3(b.x)} ${n3(b.x + b.w)} ${n3(b.y)} ${n3(b.y + b.h)}${' 0 1'.repeat(n)}]`; }

export function meshShading(m: MeshNode, cmyk: boolean, alpha: boolean): ShadingData {
  const w = m.cols + 1, ncomp = alpha ? 1 : cmyk ? 4 : 3, patches: Array<{ p: Pt[]; c: number[][] }> = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (q: Pt): Pt => { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); return q; };
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
    const a = m.points[r * w + c], b = m.points[r * w + c + 1], d = m.points[(r + 1) * w + c], e = m.points[(r + 1) * w + c + 1];
    const o = (p: typeof a, h: Pt): Pt => add({ x: p.x + h.x, y: p.y + h.y });
    const p = [add(a), o(a, a.h[0]), o(b, b.h[1]), add(b), o(b, b.h[2]), o(e, e.h[3]), add(e), o(e, e.h[1]), o(d, d.h[0]), add(d), o(d, d.h[3]), o(a, a.h[2])];
    const col = (q: typeof a): number[] => (alpha ? [clamp(q.opacity)] : components(q.color, cmyk));
    patches.push({ p, c: [col(a), col(b), col(e), col(d)] });
  }
  if (!patches.length) { x0 = y0 = 0; x1 = y1 = 1; }
  const pad = 1e-3 * Math.max(1, x1 - x0, y1 - y0), box: Rect = { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
  const bits = new Bits(), q32 = (v: number, lo: number, span: number): number => Math.round(clamp((v - lo) / span) * 4294967295);
  for (const pt of patches) {
    bits.u8(0);
    for (const q of pt.p) { bits.u32(q32(q.x, box.x, box.w)); bits.u32(q32(q.y, box.y, box.h)); }
    for (const c of pt.c) for (const v of c) bits.u16(Math.round(clamp(v) * 65535));
  }
  const cs = alpha ? '/DeviceGray' : cmyk ? '/DeviceCMYK' : '/DeviceRGB';
  return { dict: `<< /ShadingType 6 /ColorSpace ${cs} /BitsPerCoordinate 32 /BitsPerComponent 16 /BitsPerFlag 8 /Decode ${decode(box, ncomp)} >>`, stream: bits.bytes() };
}

export function meshHasAlpha(m: MeshNode): boolean { return m.points.some((p) => p.opacity < 0.999); }

export function freeformShading(g: Gradient, b: Rect, cmyk: boolean): ShadingData {
  const at = freeformSampler(g), ncomp = cmyk ? 4 : 3, long = Math.max(b.w, b.h, 1e-6), N = 96;
  const nx = Math.max(2, Math.round((N * b.w) / long)), ny = Math.max(2, Math.round((N * b.h) / long));
  const bits = new Bits(), q32 = (v: number, lo: number, span: number): number => Math.round(clamp((v - lo) / span) * 4294967295);
  const vert = (i: number, j: number, flag: number): void => {
    const x = b.x + (b.w * i) / nx, y = b.y + (b.h * j) / ny, c = at(x, y);
    bits.u8(flag); bits.u32(q32(x, b.x, b.w)); bits.u32(q32(y, b.y, b.h));
    for (const v of components({ kind: 'rgb', r: c.r, g: c.g, b: c.b }, cmyk)) bits.u8(Math.round(clamp(v) * 255));
  };
  for (let j = 0; j < ny; j++) {
    let k = 0;
    for (let i = 0; i <= nx; i++) for (const row of [j, j + 1]) vert(i, row, k++ < 3 ? 0 : 1);
  }
  return { dict: `<< /ShadingType 4 /ColorSpace ${cmyk ? '/DeviceCMYK' : '/DeviceRGB'} /BitsPerCoordinate 32 /BitsPerComponent 8 /BitsPerFlag 8 /Decode ${decode(b, ncomp)} >>`, stream: bits.bytes() };
}
