import { bezPoint, bezSplit, isLineSeg, segOf, type Seg } from './geometry';
import type { Anchor, EnvelopeOptions, EnvelopeSpec, PathData, Pt, Rect, SubPath } from './types';

export type MeshSpec = Extract<EnvelopeSpec, { kind: 'mesh' }>;
export type Handles = [Pt, Pt, Pt, Pt];
export type Mapper = (p: Pt) => Pt;
export type Homography = [number, number, number, number, number, number, number, number, number];

export const ENVELOPE_DEFAULTS: EnvelopeOptions = { fidelity: 50, appearance: false, gradients: false, patterns: false, antiAlias: true };
export const envelopeOptions = (o?: Partial<EnvelopeOptions> | null): EnvelopeOptions => ({ ...ENVELOPE_DEFAULTS, ...(o ?? {}) });
export const fidelityTol = (fidelity: number): number => 0.04 * 2 ** ((100 - Math.max(0, Math.min(100, fidelity))) / 20);

const Z: Pt = { x: 0, y: 0 };
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const uniformKnots = (n: number): number[] => Array.from({ length: n + 1 }, (_, i) => i / n);

export function meshKnots(s: MeshSpec): { u: number[]; v: number[] } {
  return { u: s.u && s.u.length === s.cols + 1 ? s.u : uniformKnots(s.cols), v: s.v && s.v.length === s.rows + 1 ? s.v : uniformKnots(s.rows) };
}

export function meshHandles(s: MeshSpec): Handles[] {
  if (s.h && s.h.length === s.points.length) return s.h;
  const w = s.cols + 1, P = s.points;
  return P.map((p, k) => {
    const r = Math.floor(k / w), c = k % w, to = (q: Pt): Pt => ({ x: (q.x - p.x) / 3, y: (q.y - p.y) / 3 });
    return [c < s.cols ? to(P[k + 1]) : Z, c > 0 ? to(P[k - 1]) : Z, r < s.rows ? to(P[k + w]) : Z, r > 0 ? to(P[k - w]) : Z];
  });
}

const edge = (a: Pt, ah: Pt, b: Pt, bh: Pt): Seg => [{ x: a.x, y: a.y }, { x: a.x + ah.x, y: a.y + ah.y }, { x: b.x + bh.x, y: b.y + bh.y }, { x: b.x, y: b.y }];

interface Patch { top: Seg; bottom: Seg; left: Seg; right: Seg; p00: Pt; p10: Pt; p01: Pt; p11: Pt }
function patchAt(s: MeshSpec, H: Handles[], r: number, c: number): Patch {
  const w = s.cols + 1, k = r * w + c, P = s.points;
  const p00 = P[k], p10 = P[k + 1], p01 = P[k + w], p11 = P[k + w + 1];
  return { top: edge(p00, H[k][0], p10, H[k + 1][1]), bottom: edge(p01, H[k + w][0], p11, H[k + w + 1][1]), left: edge(p00, H[k][2], p01, H[k + w][3]), right: edge(p10, H[k + 1][2], p11, H[k + w + 1][3]), p00, p10, p01, p11 };
}
function coons(q: Patch, u: number, v: number): Pt {
  const t = bezPoint(q.top, u), b = bezPoint(q.bottom, u), l = bezPoint(q.left, v), r = bezPoint(q.right, v);
  return {
    x: (1 - v) * t.x + v * b.x + (1 - u) * l.x + u * r.x - ((1 - u) * (1 - v) * q.p00.x + u * (1 - v) * q.p10.x + (1 - u) * v * q.p01.x + u * v * q.p11.x),
    y: (1 - v) * t.y + v * b.y + (1 - u) * l.y + u * r.y - ((1 - u) * (1 - v) * q.p00.y + u * (1 - v) * q.p10.y + (1 - u) * v * q.p01.y + u * v * q.p11.y),
  };
}
function span(k: number[], t: number): number {
  let i = 0;
  while (i < k.length - 2 && t > k[i + 1]) i++;
  return i;
}

export function meshSampler(s: MeshSpec): (U: number, V: number) => Pt {
  const H = meshHandles(s), { u: us, v: vs } = meshKnots(s), cache = new Map<number, Patch>();
  return (U, V) => {
    const c = span(us, U), r = span(vs, V), key = r * s.cols + c;
    let q = cache.get(key);
    if (!q) { q = patchAt(s, H, r, c); cache.set(key, q); }
    return coons(q, (U - us[c]) / (us[c + 1] - us[c] || 1), (V - vs[r]) / (vs[r + 1] - vs[r] || 1));
  };
}

export function meshMapper(s: MeshSpec, fr: Rect): Mapper {
  const at = meshSampler(s);
  return (p) => at(clamp01((p.x - fr.x) / (fr.w || 1)), clamp01((p.y - fr.y) / (fr.h || 1)));
}

export function meshFromMapper(fr: Rect, rows: number, cols: number, f: Mapper): MeshSpec {
  const points: Pt[] = [], h: Handles[] = [], du = fr.w / cols, dv = fr.h / rows, e = 1e-4;
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const x = fr.x + du * i, y = fr.y + dv * j, P = f({ x, y });
    const d = (dx: number, dy: number): Pt => { const q = f({ x: x + dx * e, y: y + dy * e }); return { x: (q.x - P.x) / e / 3, y: (q.y - P.y) / e / 3 }; };
    points.push(P);
    h.push([i < cols ? d(du, 0) : Z, i > 0 ? d(-du, 0) : Z, j < rows ? d(0, dv) : Z, j > 0 ? d(0, -dv) : Z]);
  }
  return { kind: 'mesh', rows, cols, points, h };
}

export function mapMeshSpec(s: MeshSpec, f: Mapper): MeshSpec {
  const H = meshHandles(s), points = s.points.map(f);
  const h = s.points.map((p, k) => H[k].map((v) => {
    if (Math.abs(v.x) + Math.abs(v.y) < 1e-12) return Z;
    const e = 1e-4, q = f({ x: p.x + v.x * e, y: p.y + v.y * e });
    return { x: (q.x - points[k].x) / e, y: (q.y - points[k].y) / e };
  }) as Handles);
  return { ...s, points, h };
}

export function meshCurves(s: MeshSpec): Seg[] {
  const H = meshHandles(s), w = s.cols + 1, P = s.points, out: Seg[] = [];
  for (let r = 0; r <= s.rows; r++) for (let c = 0; c <= s.cols; c++) {
    const k = r * w + c;
    if (c < s.cols) out.push(edge(P[k], H[k][0], P[k + 1], H[k + 1][1]));
    if (r < s.rows) out.push(edge(P[k], H[k][2], P[k + w], H[k + w][3]));
  }
  return out;
}

export function segsToSub(segs: Seg[], closed: boolean): SubPath {
  if (!segs.length) return { closed, pts: [] };
  const out: Anchor[] = [{ x: segs[0][0].x, y: segs[0][0].y, ix: segs[0][0].x, iy: segs[0][0].y, ox: segs[0][1].x, oy: segs[0][1].y }];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i], next = segs[i + 1];
    out.push({ x: s[3].x, y: s[3].y, ix: s[2].x, iy: s[2].y, ox: next ? next[1].x : s[3].x, oy: next ? next[1].y : s[3].y });
  }
  if (closed && out.length > 1) {
    const last = out[out.length - 1], first = out[0];
    if (Math.hypot(last.x - first.x, last.y - first.y) < 1e-6) { out.pop(); out[0] = { ...first, ix: last.ix, iy: last.iy }; }
  }
  return { closed, pts: out };
}

export function meshOutline(s: MeshSpec): PathData {
  const H = meshHandles(s), w = s.cols + 1, P = s.points, segs: Seg[] = [];
  const at = (r: number, c: number): number => r * w + c;
  for (let c = 0; c < s.cols; c++) { const a = at(0, c), b = at(0, c + 1); segs.push(edge(P[a], H[a][0], P[b], H[b][1])); }
  for (let r = 0; r < s.rows; r++) { const a = at(r, s.cols), b = at(r + 1, s.cols); segs.push(edge(P[a], H[a][2], P[b], H[b][3])); }
  for (let c = s.cols; c > 0; c--) { const a = at(s.rows, c), b = at(s.rows, c - 1); segs.push(edge(P[a], H[a][1], P[b], H[b][0])); }
  for (let r = s.rows; r > 0; r--) { const a = at(r, 0), b = at(r - 1, 0); segs.push(edge(P[a], H[a][3], P[b], H[b][2])); }
  return [segsToSub(segs, true)];
}

export function meshPointAt(s: MeshSpec, p: Pt, tol: number): number {
  let best = -1, bd = tol;
  s.points.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d <= bd) { bd = d; best = i; } });
  return best;
}

export function meshHandleAt(s: MeshSpec, idx: number, p: Pt, tol: number): number {
  const q = s.points[idx], H = meshHandles(s)[idx];
  if (!q || !H) return -1;
  return H.findIndex((h) => Math.hypot(h.x, h.y) > 1e-6 && Math.hypot(q.x + h.x - p.x, q.y + h.y - p.y) <= tol);
}

export function withMeshPoint(s: MeshSpec, idx: number, at: Pt): MeshSpec {
  const H = meshHandles(s);
  return { ...s, points: s.points.map((q, i) => (i === idx ? { x: at.x, y: at.y } : q)), h: s.h && s.h.length === s.points.length ? s.h : H };
}

export function withMeshHandle(s: MeshSpec, idx: number, which: number, end: Pt, mirror: boolean): MeshSpec {
  const H = meshHandles(s).map((x) => [...x] as Handles), q = s.points[idx];
  const v = { x: end.x - q.x, y: end.y - q.y };
  H[idx][which] = v;
  const opp = which ^ 1, o = H[idx][opp], ol = Math.hypot(o.x, o.y), vl = Math.hypot(v.x, v.y);
  if (mirror && ol > 1e-6 && vl > 1e-6) H[idx][opp] = { x: (-v.x / vl) * ol, y: (-v.y / vl) * ol };
  return { ...s, h: H };
}

export function meshAddLine(s: MeshSpec, p: Pt, tol: number): { spec: MeshSpec; index: number } | null {
  const at = meshSampler(s), { u: us0, v: vs0 } = meshKnots(s), N = 16;
  let bu = -1, bv = -1, bd = Infinity;
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const U = us0[c] + ((us0[c + 1] - us0[c]) * i) / N, V = vs0[r] + ((vs0[r + 1] - vs0[r]) * j) / N, q = at(U, V), d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) { bd = d; bu = U; bv = V; }
  }
  if (bd > tol) return null;
  const near = (k: number[], t: number): boolean => k.some((x) => Math.abs(x - t) < 0.015);
  const addU = !near(us0, bu), addV = !near(vs0, bv);
  if (!addU && !addV) return null;
  const us = addU ? [...us0, bu].sort((a, b) => a - b) : us0, vs = addV ? [...vs0, bv].sort((a, b) => a - b) : vs0;
  const cols = us.length - 1, rows = vs.length - 1, H0 = meshHandles(s), w0 = s.cols + 1;
  const oldU = (t: number): number => us0.indexOf(t), oldV = (t: number): number => vs0.indexOf(t);
  const deriv = (U: number, V: number, dU: number, dV: number, P: Pt): Pt => { const e = 1e-4, q = at(U + dU * e, V + dV * e); return { x: (q.x - P.x) / e / 3, y: (q.y - P.y) / e / 3 }; };
  const points: Pt[] = [], h: Handles[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const U = us[i], V = vs[j], P = at(U, V), oi = oldU(U), oj = oldV(V), old = oi >= 0 && oj >= 0 ? H0[oj * w0 + oi] : null;
    const hu = (k: number, slot: number): Pt => { if (k < 0 || k > cols) return Z; const ok = oldU(us[k]); return old && ok >= 0 && Math.abs(ok - oi) === 1 ? old[slot] : deriv(U, V, us[k] - U, 0, P); };
    const hv = (k: number, slot: number): Pt => { if (k < 0 || k > rows) return Z; const ok = oldV(vs[k]); return old && ok >= 0 && Math.abs(ok - oj) === 1 ? old[slot] : deriv(U, V, 0, vs[k] - V, P); };
    points.push(old ? s.points[oj * w0 + oi] : P);
    h.push([hu(i + 1, 0), hu(i - 1, 1), hv(j + 1, 2), hv(j - 1, 3)]);
  }
  const nearest = (k: number[], t: number): number => k.reduce((best, x, i) => (Math.abs(x - t) < Math.abs(k[best] - t) ? i : best), 0);
  return { spec: { kind: 'mesh', rows, cols, points, h, u: us, v: vs }, index: nearest(vs, bv) * (cols + 1) + nearest(us, bu) };
}

export function meshRemoveLines(s: MeshSpec, idx: number): MeshSpec {
  const w = s.cols + 1, r = Math.floor(idx / w), c = idx % w;
  const dropRow = r > 0 && r < s.rows, dropCol = c > 0 && c < s.cols;
  if (!dropRow && !dropCol) return s;
  const H = meshHandles(s), { u, v } = meshKnots(s);
  const rows = Array.from({ length: s.rows + 1 }, (_, j) => j).filter((j) => !(dropRow && j === r));
  const cols = Array.from({ length: s.cols + 1 }, (_, i) => i).filter((i) => !(dropCol && i === c));
  const points: Pt[] = [], h: Handles[] = [];
  rows.forEach((j, jj) => cols.forEach((i, ii) => {
    const k = j * w + i, q = s.points[k], hh = [...H[k]] as Handles;
    const toward = (o: Pt, old: Pt): Pt => { const len = Math.hypot(o.x - q.x, o.y - q.y) / 3, ol = Math.hypot(old.x, old.y); return ol > 1e-6 ? { x: (old.x / ol) * len, y: (old.y / ol) * len } : { x: (o.x - q.x) / 3, y: (o.y - q.y) / 3 }; };
    if (ii + 1 < cols.length && cols[ii + 1] !== i + 1) hh[0] = toward(s.points[j * w + cols[ii + 1]], H[k][0]);
    if (ii > 0 && cols[ii - 1] !== i - 1) hh[1] = toward(s.points[j * w + cols[ii - 1]], H[k][1]);
    if (jj + 1 < rows.length && rows[jj + 1] !== j + 1) hh[2] = toward(s.points[rows[jj + 1] * w + i], H[k][2]);
    if (jj > 0 && rows[jj - 1] !== j - 1) hh[3] = toward(s.points[rows[jj - 1] * w + i], H[k][3]);
    points.push(q); h.push(hh);
  }));
  return { kind: 'mesh', rows: rows.length - 1, cols: cols.length - 1, points, h, u: cols.map((i) => u[i]), v: rows.map((j) => v[j]) };
}

function squareToQuad(q: Pt[]): Homography {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  if (Math.abs(dx3) < 1e-12 && Math.abs(dy3) < 1e-12) return [p1.x - p0.x, p3.x - p0.x, p0.x, p1.y - p0.y, p3.y - p0.y, p0.y, 0, 0, 1];
  const den = dx1 * dy2 - dx2 * dy1 || 1e-12;
  const g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
  return [p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x, p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y, g, h, 1];
}
function adjugate(m: Homography): Homography {
  const [a, b, c, d, e, f, g, h, i] = m;
  return [e * i - f * h, c * h - b * i, b * f - c * e, f * g - d * i, a * i - c * g, c * d - a * f, d * h - e * g, b * g - a * h, a * e - b * d];
}
function hmul(a: Homography, b: Homography): Homography {
  const o = new Array(9).fill(0) as Homography;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
}
export function homography(src: Pt[], dst: Pt[]): Homography { return hmul(squareToQuad(dst), adjugate(squareToQuad(src))); }
export function applyH(m: Homography, p: Pt): Pt {
  const w = m[6] * p.x + m[7] * p.y + m[8];
  const k = Math.abs(w) < 1e-12 ? 1e-12 : w;
  return { x: (m[0] * p.x + m[1] * p.y + m[2]) / k, y: (m[3] * p.x + m[4] * p.y + m[5]) / k };
}
export function isAffineH(m: Homography, size: number): boolean { return (Math.abs(m[6]) + Math.abs(m[7])) * Math.max(1, size) < 1e-7 * Math.abs(m[8]); }

const near3 = (P0: Pt, c: Pt, P3: Pt, t: number): boolean => Math.hypot(c.x - (P0.x + (P3.x - P0.x) * t), c.y - (P0.y + (P3.y - P0.y) * t)) < 1e-4;

export function mapPathAdaptive(d: PathData, f: Mapper, tol: number, keepLines = false, maxDepth = 7): PathData {
  const ctl = (p: Pt, P: Pt, c: Pt): Pt => {
    const vx = c.x - p.x, vy = c.y - p.y;
    if (Math.abs(vx) + Math.abs(vy) < 1e-12) return P;
    const e = 1e-4, q = f({ x: p.x + vx * e, y: p.y + vy * e });
    return { x: P.x + (q.x - P.x) / e, y: P.y + (q.y - P.y) / e };
  };
  const piece = (s: Seg, P0: Pt, P3: Pt, depth: number, out: Seg[]): void => {
    const m: Seg = [P0, ctl(s[0], P0, s[1]), ctl(s[3], P3, s[2]), P3];
    if (depth < maxDepth) {
      let err = 0;
      for (const t of [0.5, 0.25, 0.75]) { const a = bezPoint(m, t), b = f(bezPoint(s, t)); err = Math.max(err, Math.hypot(a.x - b.x, a.y - b.y)); if (err > tol) break; }
      if (err > tol) { const [l, r] = bezSplit(s, 0.5), Pm = f(l[3]); piece(l, P0, Pm, depth + 1, out); piece(r, Pm, P3, depth + 1, out); return; }
    }
    if (near3(P0, m[1], P3, 1 / 3) && near3(P0, m[2], P3, 2 / 3)) out.push([P0, P0, P3, P3]);
    else out.push(m);
  };
  return d.map((sp) => {
    const n = sp.pts.length;
    if (n < 2) return { closed: sp.closed, pts: sp.pts.map((a) => { const q = f(a); return { x: q.x, y: q.y, ix: q.x, iy: q.y, ox: q.x, oy: q.y }; }) };
    const mapped = sp.pts.map((a) => f(a)), segN = sp.closed ? n : n - 1, segs: Seg[] = [];
    for (let i = 0; i < segN; i++) {
      const j = (i + 1) % n, raw = segOf(sp.pts[i], sp.pts[j]), P0 = mapped[i], P3 = mapped[j];
      if (isLineSeg(raw)) {
        if (keepLines) { segs.push([P0, P0, P3, P3]); continue; }
        const a = raw[0], b = raw[3];
        piece([a, { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 }, { x: a.x + ((b.x - a.x) * 2) / 3, y: a.y + ((b.y - a.y) * 2) / 3 }, b], P0, P3, 0, segs);
      } else piece(raw, P0, P3, 0, segs);
    }
    return segsToSub(segs, sp.closed);
  });
}

export function localAffine(f: Mapper, at: Pt, size: number): [number, number, number, number, number, number] {
  const e = Math.max(1e-3, size * 1e-3), P = f(at), qx = f({ x: at.x + e, y: at.y }), qy = f({ x: at.x, y: at.y + e });
  const a = (qx.x - P.x) / e, b = (qx.y - P.y) / e, c = (qy.x - P.x) / e, d = (qy.y - P.y) / e;
  return [a, b, c, d, P.x - a * at.x - c * at.y, P.y - b * at.x - d * at.y];
}
