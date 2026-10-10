import { geomBounds } from './bounds';
import { newId, updateNodes } from './doc';
import type { Mapper } from './envelope';
import { emptyRect, flattenSub, isEmptyRect, rectCorners, unionRect } from './geometry';
import { distortNode } from './ops/distort';
import type { Appearance, Doc, FillRule, PathData, Pt, Rect, VNode } from './types';

interface FillArea { rings: Pt[][]; rule: FillRule }
interface Wire { pts: Pt[]; closed: boolean; r: number }
interface Region { fills: FillArea[]; wires: Wire[]; bounds: Rect }

export interface PuppetMesh {
  x0: number; y0: number; h: number; cols: number; rows: number;
  cell: Uint8Array; near: Int32Array; ctri: Int32Array;
  verts: Float64Array; tris: Int32Array; inner: Uint8Array; vbw: number;
}
export interface PinSpec { at: Pt; rot: boolean }
export interface PinTarget { to: Pt; angle: number }

function painted(ap: Appearance): { fill: boolean; half: number } {
  let fill = false, half = 0;
  for (const it of ap.items) {
    if (!it.visible || it.paint.type === 'none') continue;
    if (it.kind === 'fill') fill = true; else half = Math.max(half, it.width / 2);
  }
  return { fill, half };
}

function collect(doc: Doc, n: VNode, reg: Region, tol: number): void {
  if (n.hidden) return;
  const paths = (d: PathData, ap: Appearance, rule: FillRule): void => {
    const pp = painted(ap), rings = d.map((sp) => flattenSub(sp, tol)).filter((r) => r.length > 0);
    if (pp.fill) reg.fills.push({ rings: rings.filter((r) => r.length > 2), rule });
    d.forEach((sp, i) => { if (rings[i]) reg.wires.push({ pts: rings[i], closed: sp.closed, r: pp.half }); });
  };
  switch (n.kind) {
    case 'path': paths(n.d, n.ap, n.rule); break;
    case 'compound': paths(n.children.flatMap((c) => c.d), n.ap.items.length ? n.ap : n.children[0]?.ap ?? n.ap, n.rule); break;
    case 'group': case 'layer': for (const c of n.children) collect(doc, c, reg, tol); break;
    default: {
      const b = geomBounds(doc, n);
      if (isEmptyRect(b)) return;
      const q = rectCorners(b);
      reg.fills.push({ rings: [q], rule: 'nonzero' });
      reg.wires.push({ pts: q, closed: true, r: 0 });
    }
  }
}

export function puppetMesh(doc: Doc, nodes: VNode[], expand: number, density = 32): PuppetMesh | null {
  let b = emptyRect();
  for (const n of nodes) b = unionRect(b, geomBounds(doc, n));
  if (isEmptyRect(b)) return null;
  const size = Math.max(b.w, b.h, 1e-3), reg: Region = { fills: [], wires: [], bounds: b };
  for (const n of nodes) collect(doc, n, reg, size / 600);
  const reach = Math.max(0, ...reg.wires.map((w) => w.r));
  let h = size / density;
  const pad = Math.max(0, expand) + reach, W = b.w + 2 * pad, H = b.h + 2 * pad;
  while (Math.ceil(W / h + 2) * Math.ceil(H / h + 2) > 2400) h *= 1.15;
  const x0 = b.x - pad - h, y0 = b.y - pad - h, cols = Math.ceil(W / h) + 2, rows = Math.ceil(H / h) + 2;
  const cell = new Uint8Array(cols * rows);
  for (const f of reg.fills) {
    for (let j = 0; j < rows; j++) {
      const y = y0 + (j + 0.5) * h, xs: Array<[number, number]> = [];
      for (const ring of f.rings) for (let k = 0; k < ring.length; k++) {
        const p = ring[k], q = ring[(k + 1) % ring.length];
        if (p.y === q.y || y < Math.min(p.y, q.y) || y >= Math.max(p.y, q.y)) continue;
        xs.push([p.x + ((y - p.y) / (q.y - p.y)) * (q.x - p.x), q.y > p.y ? 1 : -1]);
      }
      if (!xs.length) continue;
      xs.sort((a, c) => a[0] - c[0]);
      let w = 0, cnt = 0, k = 0;
      for (let i = 0; i < cols; i++) {
        const x = x0 + (i + 0.5) * h;
        while (k < xs.length && xs[k][0] < x) { w += xs[k][1]; cnt++; k++; }
        if (f.rule === 'evenodd' ? cnt & 1 : w !== 0) cell[j * cols + i] = 1;
      }
    }
  }
  const markSeg = (p: Pt, q: Pt, r: number): void => {
    const rr = r + h * 0.75;
    const i0 = Math.max(0, Math.floor((Math.min(p.x, q.x) - rr - x0) / h)), i1 = Math.min(cols - 1, Math.floor((Math.max(p.x, q.x) + rr - x0) / h));
    const j0 = Math.max(0, Math.floor((Math.min(p.y, q.y) - rr - y0) / h)), j1 = Math.min(rows - 1, Math.floor((Math.max(p.y, q.y) + rr - y0) / h));
    const dx = q.x - p.x, dy = q.y - p.y, L = dx * dx + dy * dy;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = x0 + (i + 0.5) * h, cy = y0 + (j + 0.5) * h;
      const t = L > 0 ? Math.max(0, Math.min(1, ((cx - p.x) * dx + (cy - p.y) * dy) / L)) : 0;
      if (Math.hypot(cx - p.x - dx * t, cy - p.y - dy * t) <= rr) cell[j * cols + i] = 1;
    }
  };
  for (const w of reg.wires) {
    if (w.pts.length === 1) markSeg(w.pts[0], w.pts[0], w.r);
    for (let k = 0; k + 1 < w.pts.length; k++) markSeg(w.pts[k], w.pts[k + 1], w.r);
    if (w.closed && w.pts.length > 2) markSeg(w.pts[w.pts.length - 1], w.pts[0], w.r);
  }
  const innerCell = cell.slice();
  const grow = Math.min(12, Math.ceil(Math.max(0, expand) / h - 1e-9));
  if (grow > 0) {
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (!innerCell[j * cols + i]) continue;
      for (let dj = -grow; dj <= grow; dj++) for (let di = -grow; di <= grow; di++) {
        const a = i + di, c = j + dj;
        if (a < 0 || c < 0 || a >= cols || c >= rows || di * di + dj * dj > grow * grow + grow) continue;
        cell[c * cols + a] = 1;
      }
    }
  }
  const vw = cols + 1, vid = new Int32Array(vw * (rows + 1)).fill(-1), inner = [] as number[], xy = [] as number[];
  const colMajor = cols >= rows;
  const touch = (i: number, j: number): boolean => {
    for (const [a, c] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) if (a >= 0 && c >= 0 && a < cols && c < rows && cell[c * cols + a]) return true;
    return false;
  };
  const touchInner = (i: number, j: number): number => {
    let k = 0;
    for (const [a, c] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) if (a >= 0 && c >= 0 && a < cols && c < rows && innerCell[c * cols + a]) k++;
    return k === 4 ? 2 : k > 0 ? 1 : 0;
  };
  const outerN = colMajor ? cols + 1 : rows + 1, innerN = colMajor ? rows + 1 : cols + 1;
  for (let o = 0; o < outerN; o++) for (let k = 0; k < innerN; k++) {
    const i = colMajor ? o : k, j = colMajor ? k : o;
    if (!touch(i, j)) continue;
    vid[j * vw + i] = xy.length / 2;
    xy.push(x0 + i * h, y0 + j * h);
    inner.push(touchInner(i, j));
  }
  if (!xy.length) return null;
  const tris: number[] = [], ctri = new Int32Array(cols * rows).fill(-1);
  let vbw = 1;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (!cell[j * cols + i]) continue;
    const v00 = vid[j * vw + i], v10 = vid[j * vw + i + 1], v01 = vid[(j + 1) * vw + i], v11 = vid[(j + 1) * vw + i + 1];
    ctri[j * cols + i] = tris.length / 3;
    if ((i + j) & 1) tris.push(v00, v10, v01, v10, v11, v01);
    else tris.push(v00, v10, v11, v00, v11, v01);
    vbw = Math.max(vbw, Math.max(v00, v10, v01, v11) - Math.min(v00, v10, v01, v11));
  }
  const near = new Int32Array(cols * rows).fill(-1), queue: number[] = [];
  for (let c = 0; c < cell.length; c++) if (cell[c]) { near[c] = c; queue.push(c); }
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi], i = c % cols, j = (c - i) / cols;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, r = j + dj;
      if (a < 0 || r < 0 || a >= cols || r >= rows) continue;
      const k = r * cols + a;
      if (near[k] < 0) { near[k] = near[c]; queue.push(k); }
    }
  }
  return { x0, y0, h, cols, rows, cell, near, ctri, verts: Float64Array.from(xy), tris: Int32Array.from(tris), inner: Uint8Array.from(inner), vbw };
}

function bary(V: Float64Array, a: number, b: number, c: number, p: Pt): [number, number, number] {
  const ax = V[2 * a], ay = V[2 * a + 1], bx = V[2 * b] - ax, by = V[2 * b + 1] - ay, cx = V[2 * c] - ax, cy = V[2 * c + 1] - ay;
  const d = bx * cy - by * cx || 1e-12, px = p.x - ax, py = p.y - ay;
  const b1 = (px * cy - py * cx) / d, b2 = (bx * py - by * px) / d;
  return [1 - b1 - b2, b1, b2];
}

export interface Located { t: number; b: [number, number, number] }

export function locate(m: PuppetMesh, p: Pt): Located | null {
  const i = Math.max(0, Math.min(m.cols - 1, Math.floor((p.x - m.x0) / m.h))), j = Math.max(0, Math.min(m.rows - 1, Math.floor((p.y - m.y0) / m.h)));
  const c = m.near[j * m.cols + i];
  if (c < 0) return null;
  const t0 = m.ctri[c], T = m.tris;
  const b0 = bary(m.verts, T[3 * t0], T[3 * t0 + 1], T[3 * t0 + 2], p), b1 = bary(m.verts, T[3 * t0 + 3], T[3 * t0 + 4], T[3 * t0 + 5], p);
  return Math.min(...b0) >= Math.min(...b1) ? { t: t0, b: b0 } : { t: t0 + 1, b: b1 };
}

export function inMesh(m: PuppetMesh, p: Pt): boolean {
  const i = Math.floor((p.x - m.x0) / m.h), j = Math.floor((p.y - m.y0) / m.h);
  return i >= 0 && j >= 0 && i < m.cols && j < m.rows && m.cell[j * m.cols + i] === 1;
}

export function evalAt(m: PuppetMesh, def: Float64Array, l: Located): Pt {
  const T = m.tris, a = T[3 * l.t], b = T[3 * l.t + 1], c = T[3 * l.t + 2];
  return { x: l.b[0] * def[2 * a] + l.b[1] * def[2 * b] + l.b[2] * def[2 * c], y: l.b[0] * def[2 * a + 1] + l.b[1] * def[2 * b + 1] + l.b[2] * def[2 * c + 1] };
}

export function puppetMapper(m: PuppetMesh, def: Float64Array): Mapper {
  return (p) => { const l = locate(m, p); return l ? evalAt(m, def, l) : p; };
}

export function unmapPoint(m: PuppetMesh, def: Float64Array, p: Pt): { rest: Pt; inside: boolean } {
  const T = m.tris;
  let best = -Infinity, bt = 0, bb: [number, number, number] = [1, 0, 0];
  for (let t = 0; t < T.length / 3; t++) {
    const b = bary(def, T[3 * t], T[3 * t + 1], T[3 * t + 2], p), lo = Math.min(...b);
    if (lo > best) { best = lo; bt = t; bb = b; if (lo >= -1e-9) break; }
  }
  const rest = evalAt(m, m.verts, { t: bt, b: bb });
  return { rest, inside: best >= -1e-6 };
}

export function localAngle(m: PuppetMesh, def: Float64Array, at: Pt): number {
  const l = locate(m, at);
  if (!l) return 0;
  const T = m.tris, V = m.verts;
  let sc = 0, cc = 0;
  for (let k = 0; k < 3; k++) {
    const i = T[3 * l.t + k], j = T[3 * l.t + ((k + 1) % 3)];
    const ex = V[2 * j] - V[2 * i], ey = V[2 * j + 1] - V[2 * i + 1], fx = def[2 * j] - def[2 * i], fy = def[2 * j + 1] - def[2 * i + 1];
    cc += ex * fx + ey * fy; sc += ex * fy - ey * fx;
  }
  return Math.atan2(sc, cc);
}

export function defaultPins(m: PuppetMesh, count = 3): Pt[] {
  const V = m.verts, n = V.length / 2, cand: number[] = [];
  for (let i = 0; i < n; i++) if (m.inner[i] === 2) cand.push(i);
  if (!cand.length) for (let i = 0; i < n; i++) if (m.inner[i]) cand.push(i);
  if (!cand.length) for (let i = 0; i < n; i++) cand.push(i);
  let cx = 0, cy = 0;
  for (const i of cand) { cx += V[2 * i]; cy += V[2 * i + 1]; }
  cx /= cand.length; cy /= cand.length;
  const picked: number[] = [], dmin = cand.map((i) => Math.hypot(V[2 * i] - cx, V[2 * i + 1] - cy) * 1e-3);
  for (let k = 0; k < Math.min(count, cand.length); k++) {
    let bi = 0;
    for (let q = 1; q < cand.length; q++) if (dmin[q] > dmin[bi]) bi = q;
    const v = cand[bi];
    picked.push(v);
    cand.forEach((i, q) => { dmin[q] = k === 0 ? Math.hypot(V[2 * i] - V[2 * v], V[2 * i + 1] - V[2 * v + 1]) : Math.min(dmin[q], Math.hypot(V[2 * i] - V[2 * v], V[2 * i + 1] - V[2 * v + 1])); });
  }
  const inset = (p: Pt): Pt => ({ x: p.x + (cx - p.x) * 0.12, y: p.y + (cy - p.y) * 0.12 });
  return picked.map((v) => inset({ x: V[2 * v], y: V[2 * v + 1] }));
}

class Band {
  private readonly a: Float64Array;
  private readonly w: number;
  constructor(readonly n: number, readonly bw: number) { this.w = bw + 1; this.a = new Float64Array(n * this.w); }
  add(i: number, j: number, v: number): void { if (j > i) { const t = i; i = j; j = t; } this.a[i * this.w + j - i + this.bw] += v; }
  factor(): void {
    const { n, bw, w, a } = this;
    for (let i = 0; i < n; i++) {
      const j0 = Math.max(0, i - bw), ri = i * w - i + bw;
      for (let j = j0; j <= i; j++) {
        const rj = j * w - j + bw;
        let s = a[ri + j];
        for (let k = Math.max(j0, j - bw); k < j; k++) s -= a[ri + k] * a[rj + k];
        if (j === i) a[ri + i] = Math.sqrt(Math.max(s, 1e-12));
        else a[ri + j] = s / a[rj + j];
      }
    }
  }
  solve(b: Float64Array): Float64Array {
    const { n, bw, w, a } = this, y = Float64Array.from(b);
    for (let i = 0; i < n; i++) { const ri = i * w - i + bw; let s = y[i]; for (let k = Math.max(0, i - bw); k < i; k++) s -= a[ri + k] * y[k]; y[i] = s / a[ri + i]; }
    for (let i = n - 1; i >= 0; i--) { let s = y[i]; const hi = Math.min(n - 1, i + bw); for (let k = i + 1; k <= hi; k++) s -= a[k * w - k + bw + i] * y[k]; y[i] = s / a[i * w + bw]; }
    return y;
  }
}

interface Con { v: [number, number, number]; b: [number, number, number]; pin: number; off: Pt | null }

const PIN_W = 1e4, REG = 1e-6, ITER = 4;

export class PuppetSolver {
  private readonly cons: Con[] = [];
  private readonly sim: Band;
  private readonly lap: Band;
  private readonly rest: Float64Array;
  constructor(readonly mesh: PuppetMesh, pins: PinSpec[]) {
    const V = mesh.verts, T = mesh.tris, n = V.length / 2, s = mesh.h * 2;
    this.rest = V;
    pins.forEach((p, k) => {
      const offs: Array<Pt | null> = p.rot ? [null, { x: s, y: 0 }, { x: 0, y: s }] : [null];
      for (const off of offs) {
        const l = locate(mesh, off ? { x: p.at.x + off.x, y: p.at.y + off.y } : p.at);
        if (l) this.cons.push({ v: [T[3 * l.t], T[3 * l.t + 1], T[3 * l.t + 2]], b: l.b, pin: k, off });
      }
    });
    const vb = mesh.vbw;
    this.sim = new Band(2 * n, 2 * vb + 1);
    this.lap = new Band(n, vb);
    const S = this.sim, L = this.lap;
    const row = (c: Array<[number, number]>, w = 1): void => { for (const [i, a] of c) for (const [j, b] of c) if (j <= i) S.add(i, j, w * a * b); };
    for (let t = 0; t < T.length / 3; t++) {
      for (let k = 0; k < 3; k++) {
        const i = T[3 * t + k], j = T[3 * t + ((k + 1) % 3)], q = T[3 * t + ((k + 2) % 3)];
        const ex = V[2 * j] - V[2 * i], ey = V[2 * j + 1] - V[2 * i + 1], dx = V[2 * q] - V[2 * i], dy = V[2 * q + 1] - V[2 * i + 1], e2 = ex * ex + ey * ey || 1e-12;
        const x = (dx * ex + dy * ey) / e2, y = (dx * -ey + dy * ex) / e2;
        row([[2 * q, 1], [2 * i, x - 1], [2 * j, -x], [2 * j + 1, y], [2 * i + 1, -y]]);
        row([[2 * q + 1, 1], [2 * i + 1, x - 1], [2 * j + 1, -x], [2 * j, -y], [2 * i, y]]);
        L.add(i, i, 1); L.add(j, j, 1); L.add(i, j, -1);
      }
    }
    for (const c of this.cons) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      if (c.v[b] > c.v[a]) continue;
      const w = PIN_W * c.b[a] * c.b[b];
      S.add(2 * c.v[a], 2 * c.v[b], w); S.add(2 * c.v[a] + 1, 2 * c.v[b] + 1, w); L.add(c.v[a], c.v[b], w);
    }
    for (let i = 0; i < n; i++) { S.add(2 * i, 2 * i, REG); S.add(2 * i + 1, 2 * i + 1, REG); L.add(i, i, REG); }
    S.factor(); L.factor();
  }

  private goal(c: Con, t: PinTarget): Pt {
    if (!c.off) return t.to;
    const co = Math.cos(t.angle), si = Math.sin(t.angle);
    return { x: t.to.x + c.off.x * co - c.off.y * si, y: t.to.y + c.off.x * si + c.off.y * co };
  }

  solve(targets: PinTarget[]): Float64Array {
    const V = this.rest, T = this.mesh.tris, n = V.length / 2;
    const b1 = new Float64Array(2 * n);
    for (let i = 0; i < 2 * n; i++) b1[i] = REG * V[i];
    const goals = this.cons.map((c) => this.goal(c, targets[c.pin]));
    this.cons.forEach((c, k) => { for (let a = 0; a < 3; a++) { b1[2 * c.v[a]] += PIN_W * c.b[a] * goals[k].x; b1[2 * c.v[a] + 1] += PIN_W * c.b[a] * goals[k].y; } });
    let cur = this.sim.solve(b1);
    const bx = new Float64Array(n), by = new Float64Array(n);
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < n; i++) { bx[i] = REG * V[2 * i]; by[i] = REG * V[2 * i + 1]; }
      this.cons.forEach((c, k) => { for (let a = 0; a < 3; a++) { bx[c.v[a]] += PIN_W * c.b[a] * goals[k].x; by[c.v[a]] += PIN_W * c.b[a] * goals[k].y; } });
      for (let t = 0; t < T.length / 3; t++) {
        let sc = 0, cc = 0;
        for (let k = 0; k < 3; k++) {
          const i = T[3 * t + k], j = T[3 * t + ((k + 1) % 3)];
          const ex = V[2 * j] - V[2 * i], ey = V[2 * j + 1] - V[2 * i + 1], fx = cur[2 * j] - cur[2 * i], fy = cur[2 * j + 1] - cur[2 * i + 1];
          cc += ex * fx + ey * fy; sc += ex * fy - ey * fx;
        }
        const r = Math.hypot(sc, cc) || 1, co = cc / r, si = sc / r;
        for (let k = 0; k < 3; k++) {
          const i = T[3 * t + k], j = T[3 * t + ((k + 1) % 3)];
          const ex = V[2 * j] - V[2 * i], ey = V[2 * j + 1] - V[2 * i + 1], gx = ex * co - ey * si, gy = ex * si + ey * co;
          bx[j] += gx; bx[i] -= gx; by[j] += gy; by[i] -= gy;
        }
      }
      const X = this.lap.solve(bx), Y = this.lap.solve(by), next = new Float64Array(2 * n);
      for (let i = 0; i < n; i++) { next[2 * i] = X[i]; next[2 * i + 1] = Y[i]; }
      cur = next;
    }
    return cur;
  }
}

export function puppetApply(doc: Doc, rest: VNode[], m: PuppetMesh, def: Float64Array, envIds: Map<string, string>): { doc: Doc; select: string[] } {
  const f = puppetMapper(m, def), tol = Math.max(0.05, m.h * 0.01);
  const envId = (id: string): string => { let e = envIds.get(id); if (!e) { e = newId('e'); envIds.set(id, e); } return e; };
  let out = doc;
  const select: string[] = [];
  for (const n of rest) {
    const cur = envIds.get(n.id) ?? n.id, next = distortNode(doc, n, f, { affine: false, tol, envId, bend: true, grid: 8 });
    out = updateNodes(out, [cur], () => next);
    select.push(next.id);
  }
  return { doc: out, select };
}
