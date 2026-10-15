import { toRgb } from '../engine/paint';
import type { Color, MeshPoint, Pt } from '../engine';

export interface MeshSpec { type: 4 | 5 | 6 | 7; bpCoord: number; bpComp: number; bpFlag: number; decode: number[]; ncomp: number; perRow: number }
export interface Vtx { x: number; y: number; c: number[] }
export interface Patch { ring: Pt[]; inner: Pt[] | null; c: number[][] }
export type Xf = (x: number, y: number) => Pt;

class BitReader {
  private pos = 0;
  constructor(private readonly d: Uint8Array) {}
  get done(): boolean { return this.pos >= this.d.length * 8; }
  align(): void { this.pos = Math.ceil(this.pos / 8) * 8; }
  bits(n: number): number {
    let v = 0;
    for (let left = n; left > 0;) {
      const byte = this.d[this.pos >> 3] ?? 0, avail = 8 - (this.pos & 7), take = Math.min(avail, left);
      v = v * (1 << take) + ((byte >> (avail - take)) & ((1 << take) - 1));
      this.pos += take;
      left -= take;
    }
    return v;
  }
}

function reader(data: Uint8Array, s: MeshSpec): { r: BitReader; pt: (xf: Xf) => Pt; col: () => number[] } {
  const r = new BitReader(data), cmax = 2 ** s.bpCoord - 1, kmax = 2 ** s.bpComp - 1, [x0, x1, y0, y1] = s.decode;
  return {
    r,
    pt: (xf) => { const a = r.bits(s.bpCoord), b = r.bits(s.bpCoord); return xf(x0 + (a * (x1 - x0)) / cmax, y0 + (b * (y1 - y0)) / cmax); },
    col: () => Array.from({ length: s.ncomp }, (_, i) => { const lo = s.decode[4 + i * 2] ?? 0, hi = s.decode[5 + i * 2] ?? 1; return lo + (r.bits(s.bpComp) * (hi - lo)) / kmax; }),
  };
}

export function readTriangles(data: Uint8Array, s: MeshSpec, xf: Xf): Array<[Vtx, Vtx, Vtx]> {
  const { r, pt, col } = reader(data, s), out: Array<[Vtx, Vtx, Vtx]> = [];
  const vertex = (): { f: number; v: Vtx } => { const f = r.bits(s.bpFlag), p = pt(xf), c = col(); r.align(); return { f, v: { x: p.x, y: p.y, c } }; };
  let prev: [Vtx, Vtx, Vtx] | null = null;
  while (!r.done && out.length < 4e6) {
    const a = vertex();
    if (r.done && a.f === 0) break;
    if (a.f === 0 || !prev) {
      const b = vertex(), c = vertex();
      prev = [a.v, b.v, c.v];
    } else prev = a.f === 1 ? [prev[1], prev[2], a.v] : [prev[0], prev[2], a.v];
    out.push(prev);
  }
  return out;
}

export function readLattice(data: Uint8Array, s: MeshSpec, xf: Xf): Vtx[][] {
  const { r, pt, col } = reader(data, s), rows: Vtx[][] = [];
  while (!r.done && rows.length < 1e5) {
    const row: Vtx[] = [];
    for (let i = 0; i < s.perRow && !r.done; i++) { const p = pt(xf), c = col(); r.align(); row.push({ x: p.x, y: p.y, c }); }
    if (row.length === s.perRow) rows.push(row);
  }
  return rows;
}

const FLAG_START = [[3, 4, 5, 6], [6, 7, 8, 9], [9, 10, 11, 0]];

export function readPatches(data: Uint8Array, s: MeshSpec, xf: Xf): Patch[] {
  const { r, pt, col } = reader(data, s), out: Patch[] = [], tensor = s.type === 7;
  let prev: Patch | null = null;
  while (!r.done && out.length < 2e5) {
    const f = r.bits(s.bpFlag);
    let ring: Pt[], colors: number[][];
    if (f === 0 || !prev) {
      ring = Array.from({ length: 12 }, () => pt(xf));
      const inner = tensor ? Array.from({ length: 4 }, () => pt(xf)) : null;
      colors = [col(), col(), col(), col()];
      r.align();
      prev = { ring, inner, c: colors };
    } else {
      const idx = FLAG_START[Math.min(3, Math.max(1, f)) - 1], cidx = f === 1 ? [1, 2] : f === 2 ? [2, 3] : [3, 0];
      ring = [...idx.map((i) => (prev as Patch).ring[i]), ...Array.from({ length: 8 }, () => pt(xf))];
      const inner = tensor ? Array.from({ length: 4 }, () => pt(xf)) : null;
      colors = [(prev as Patch).c[cidx[0]], (prev as Patch).c[cidx[1]], col(), col()];
      r.align();
      prev = { ring, inner, c: colors };
    }
    out.push(prev);
  }
  return out;
}

export function controlNet(p: Patch): Pt[][] {
  const g: Pt[][] = [[], [], [], []], R = p.ring;
  g[0][0] = R[0]; g[0][1] = R[1]; g[0][2] = R[2]; g[0][3] = R[3];
  g[1][3] = R[4]; g[2][3] = R[5]; g[3][3] = R[6];
  g[3][2] = R[7]; g[3][1] = R[8]; g[3][0] = R[9];
  g[2][0] = R[10]; g[1][0] = R[11];
  if (p.inner) { g[1][1] = p.inner[0]; g[1][2] = p.inner[1]; g[2][2] = p.inner[2]; g[2][1] = p.inner[3]; return g; }
  const q = (a: Pt, b: Pt, c: Pt, d: Pt, e: Pt, f: Pt, h: Pt, i: Pt): Pt => ({
    x: (-4 * a.x + 6 * (b.x + c.x) - 2 * (d.x + e.x) + 3 * (f.x + h.x) - i.x) / 9,
    y: (-4 * a.y + 6 * (b.y + c.y) - 2 * (d.y + e.y) + 3 * (f.y + h.y) - i.y) / 9,
  });
  g[1][1] = q(g[0][0], g[0][1], g[1][0], g[0][3], g[3][0], g[3][1], g[1][3], g[3][3]);
  g[1][2] = q(g[0][3], g[0][2], g[1][3], g[0][0], g[3][3], g[3][2], g[1][0], g[3][0]);
  g[2][1] = q(g[3][0], g[3][1], g[2][0], g[3][3], g[0][0], g[0][1], g[2][3], g[0][3]);
  g[2][2] = q(g[3][3], g[3][2], g[2][3], g[3][0], g[0][3], g[0][2], g[2][0], g[0][0]);
  return g;
}

const bern = (t: number): number[] => { const u = 1 - t; return [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]; };

export interface RV { x: number; y: number; c: number[] }

export function patchTriangles(p: Patch, n: number): Array<[RV, RV, RV]> {
  const net = controlNet(p), grid: RV[][] = [];
  for (let a = 0; a <= n; a++) {
    const s = a / n, bs = bern(s), row: RV[] = [];
    for (let b = 0; b <= n; b++) {
      const t = b / n, bt = bern(t);
      let x = 0, y = 0;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const w = bs[i] * bt[j]; x += w * net[i][j].x; y += w * net[i][j].y; }
      const c = p.c[0].map((_, k) => (1 - s) * (1 - t) * p.c[0][k] + (1 - s) * t * p.c[1][k] + s * t * p.c[2][k] + s * (1 - t) * p.c[3][k]);
      row.push({ x, y, c });
    }
    grid.push(row);
  }
  const out: Array<[RV, RV, RV]> = [];
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { out.push([grid[a][b], grid[a + 1][b], grid[a][b + 1]], [grid[a + 1][b], grid[a + 1][b + 1], grid[a][b + 1]]); }
  return out;
}

export function rasterTriangles(tris: Array<[RV, RV, RV]>, scaleWanted: number, finish: (c: number[]) => [number, number, number]): { w: number; h: number; x: number; y: number; scale: number; data: Uint8ClampedArray } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of tris) for (const v of t) { if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x; if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y; }
  if (!(x1 > x0 && y1 > y0) || !Number.isFinite(x1 - x0 + y1 - y0)) return null;
  const long = Math.max(x1 - x0, y1 - y0), scale = Math.min(scaleWanted, 2048 / long), w = Math.max(1, Math.ceil((x1 - x0) * scale)), h = Math.max(1, Math.ceil((y1 - y0) * scale));
  const data = new Uint8ClampedArray(w * h * 4), nc = tris[0]?.[0].c.length ?? 0, acc = new Array<number>(nc);
  for (const [A, B, C] of tris) {
    const ax = (A.x - x0) * scale, ay = (A.y - y0) * scale, bx = (B.x - x0) * scale, by = (B.y - y0) * scale, cx = (C.x - x0) * scale, cy = (C.y - y0) * scale;
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 0.5)), maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx) + 0.5));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy) - 0.5)), maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy) + 0.5));
    const eps = -0.02;
    for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
      const X = px + 0.5, Y = py + 0.5;
      const l1 = ((by - cy) * (X - cx) + (cx - bx) * (Y - cy)) / den, l2 = ((cy - ay) * (X - cx) + (ax - cx) * (Y - cy)) / den, l3 = 1 - l1 - l2;
      if (l1 < eps || l2 < eps || l3 < eps) continue;
      for (let k = 0; k < nc; k++) acc[k] = l1 * A.c[k] + l2 * B.c[k] + l3 * C.c[k];
      const [r, g, b] = finish(acc), o = (py * w + px) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
  }
  return { w, h, x: x0, y: y0, scale, data };
}

interface Oriented { corner: Pt[]; top: Pt[]; right: Pt[]; bottom: Pt[]; left: Pt[]; col: number[][]; id: number }

const key = (p: Pt): string => `${Math.round(p.x * 50)},${Math.round(p.y * 50)}`;
const dist = (a: Pt, b: Pt): boolean => Math.abs(a.x - b.x) < 0.02 && Math.abs(a.y - b.y) < 0.02;

function edge(p: Patch, a: number, b: number): Pt[] {
  const R = p.ring, e = (i: number): Pt[] => [R[i * 3 % 12], R[(i * 3 + 1) % 12], R[(i * 3 + 2) % 12], R[(i * 3 + 3) % 12]];
  return (a + 1) % 4 === b ? e(a) : e(b).slice().reverse();
}

function orient(p: Patch, id: number, r: number, rev: boolean): Oriented {
  const s = [0, 1, 2, 3].map((k) => (rev ? (r - k + 8) % 4 : (r + k) % 4)), cn = [p.ring[0], p.ring[3], p.ring[6], p.ring[9]];
  return { corner: s.map((i) => cn[i]), top: edge(p, s[0], s[1]), right: edge(p, s[1], s[2]), bottom: edge(p, s[3], s[2]), left: edge(p, s[0], s[3]), col: s.map((i) => p.c[i]), id };
}

export function gridMesh(patches: Patch[], colorOf: (c: number[]) => Color): { rows: number; cols: number; points: MeshPoint[] } | null {
  const n = patches.length;
  if (!n || n > 6000) return null;
  const byCorner = new Map<string, number[]>();
  patches.forEach((p, i) => { for (const c of [p.ring[0], p.ring[3], p.ring[6], p.ring[9]]) { const k = key(c), l = byCorner.get(k) ?? []; if (!l.includes(i)) l.push(i); byCorner.set(k, l); } });
  const placed = new Map<string, Oriented>(), used = new Set<number>(), pos = (r: number, c: number): string => `${r},${c}`;
  const start = orient(patches[0], 0, 0, false);
  placed.set(pos(0, 0), start);
  used.add(0);
  const queue: Array<[number, number]> = [[0, 0]];
  const find = (want: Array<[number, Pt]>): Oriented | 'bad' | null => {
    const cand = (byCorner.get(key(want[0][1])) ?? []).filter((i) => !used.has(i));
    let hit: Oriented | null = null;
    for (const i of cand) for (const rev of [false, true]) for (let r = 0; r < 4; r++) {
      const o = orient(patches[i], i, r, rev);
      if (want.every(([k, pt]) => dist(o.corner[k], pt))) { if (hit && hit.id !== i) return 'bad'; hit ??= o; }
    }
    return hit;
  };
  while (queue.length) {
    const [r, c] = queue.shift() as [number, number], o = placed.get(pos(r, c)) as Oriented;
    const dirs: Array<[number, number, Array<[number, Pt]>]> = [
      [r, c + 1, [[0, o.corner[1]], [3, o.corner[2]]]],
      [r + 1, c, [[0, o.corner[3]], [1, o.corner[2]]]],
      [r, c - 1, [[1, o.corner[0]], [2, o.corner[3]]]],
      [r - 1, c, [[3, o.corner[0]], [2, o.corner[1]]]],
    ];
    for (const [nr, nc, want] of dirs) {
      if (placed.has(pos(nr, nc))) continue;
      const f = find(want);
      if (f === 'bad') return null;
      if (!f) continue;
      placed.set(pos(nr, nc), f);
      used.add(f.id);
      queue.push([nr, nc]);
    }
  }
  if (used.size !== n) return null;
  let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity;
  for (const k of placed.keys()) { const [r, c] = k.split(',').map(Number); r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
  const rows = r1 - r0 + 1, cols = c1 - c0 + 1;
  if (rows * cols !== n) return null;
  const cell = (r: number, c: number): Oriented | undefined => placed.get(pos(r + r0, c + c0));
  const W = cols + 1, pts: Array<MeshPoint | null> = new Array<MeshPoint | null>((rows + 1) * W).fill(null);
  const zero = (): [Pt, Pt, Pt, Pt] => [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
  let bad = false;
  const ensure = (r: number, c: number, p: Pt, color: number[]): MeshPoint => {
    const i = r * W + c, hit = pts[i];
    if (hit) {
      const a = toRgb(hit.color), b = toRgb(colorOf(color));
      if (Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) > 24 || Math.abs(hit.x - p.x) > 0.05 || Math.abs(hit.y - p.y) > 0.05) bad = true;
      return hit;
    }
    return (pts[i] = { x: p.x, y: p.y, color: colorOf(color), opacity: 1, h: zero() });
  };
  const off =(to: Pt, from: Pt): Pt => ({ x: to.x - from.x, y: to.y - from.y });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const o = cell(r, c) as Oriented;
    const A = ensure(r, c, o.corner[0], o.col[0]), B = ensure(r, c + 1, o.corner[1], o.col[1]), E = ensure(r + 1, c + 1, o.corner[2], o.col[2]), D = ensure(r + 1, c, o.corner[3], o.col[3]);
    A.h[0] = off(o.top[1], o.top[0]); B.h[1] = off(o.top[2], o.top[3]);
    B.h[2] = off(o.right[1], o.right[0]); E.h[3] = off(o.right[2], o.right[3]);
    D.h[0] = off(o.bottom[1], o.bottom[0]); E.h[1] = off(o.bottom[2], o.bottom[3]);
    A.h[2] = off(o.left[1], o.left[0]); D.h[3] = off(o.left[2], o.left[3]);
  }
  if (bad || pts.some((p) => !p)) return null;
  return { rows, cols, points: pts as MeshPoint[] };
}

export function latticeMesh(rows: Vtx[][], colorOf: (c: number[]) => Color): { rows: number; cols: number; points: MeshPoint[] } | null {
  const R = rows.length, C = rows[0]?.length ?? 0;
  if (R < 2 || C < 2 || R * C > 40000) return null;
  const points: MeshPoint[] = [];
  const at = (r: number, c: number): Vtx => rows[Math.max(0, Math.min(R - 1, r))][Math.max(0, Math.min(C - 1, c))];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const v = rows[r][c], to = (o: Vtx, on: boolean): Pt => (on ? { x: (o.x - v.x) / 3, y: (o.y - v.y) / 3 } : { x: 0, y: 0 });
    points.push({ x: v.x, y: v.y, color: colorOf(v.c), opacity: 1, h: [to(at(r, c + 1), c < C - 1), to(at(r, c - 1), c > 0), to(at(r + 1, c), r < R - 1), to(at(r - 1, c), r > 0)] });
  }
  return { rows: R - 1, cols: C - 1, points };
}
