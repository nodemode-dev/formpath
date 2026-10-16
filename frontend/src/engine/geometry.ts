import { cornered } from './corners';
import type { Anchor, Mat, PathData, Pt, Rect, SubPath } from './types';

export const KAPPA = 0.5522847498307936;
export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];
export const EPS = 1e-9;

export function mul(m: Mat, n: Mat): Mat {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
export function invert(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-15) return [...IDENTITY];
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}
export const translate = (dx: number, dy: number): Mat => [1, 0, 0, 1, dx, dy];
export function scaleAbout(sx: number, sy: number, cx: number, cy: number): Mat { return [sx, 0, 0, sy, cx - sx * cx, cy - sy * cy]; }
export function rotateAbout(deg: number, cx: number, cy: number): Mat {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
}
export function shearAbout(deg: number, axis: 'horizontal' | 'vertical', cx: number, cy: number): Mat {
  const t = Math.tan((deg * Math.PI) / 180);
  return axis === 'horizontal' ? [1, 0, -t, 1, t * cy, 0] : [1, -t, 0, 1, 0, t * cx];
}
export function reflectAbout(axis: 'horizontal' | 'vertical', cx: number, cy: number): Mat {
  return axis === 'horizontal' ? [-1, 0, 0, 1, 2 * cx, 0] : [1, 0, 0, -1, 0, 2 * cy];
}
export const apply = (m: Mat, x: number, y: number): Pt => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
export const applyPt = (m: Mat, p: Pt): Pt => apply(m, p.x, p.y);
export const isIdentity = (m: Mat): boolean => m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;
export const matScale = (m: Mat): number => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
export const matAngle = (m: Mat): number => (Math.atan2(m[1], m[0]) * 180) / Math.PI;

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function anchor(x: number, y: number, ix = x, iy = y, ox = x, oy = y, smooth?: boolean): Anchor {
  const a: Anchor = { x, y, ix, iy, ox, oy };
  if (smooth) a.smooth = true;
  return a;
}
export const hasIn = (a: Anchor): boolean => Math.abs(a.ix - a.x) > EPS || Math.abs(a.iy - a.y) > EPS;
export const hasOut = (a: Anchor): boolean => Math.abs(a.ox - a.x) > EPS || Math.abs(a.oy - a.y) > EPS;

export type Seg = [Pt, Pt, Pt, Pt];
export function segOf(a: Anchor, b: Anchor): Seg { return [{ x: a.x, y: a.y }, { x: a.ox, y: a.oy }, { x: b.ix, y: b.iy }, { x: b.x, y: b.y }]; }
export function segments(sp: SubPath): Seg[] {
  const out: Seg[] = [], n = sp.pts.length;
  for (let i = 0; i < n - 1; i++) out.push(segOf(sp.pts[i], sp.pts[i + 1]));
  if (sp.closed && n > 1) out.push(segOf(sp.pts[n - 1], sp.pts[0]));
  return out;
}
export const isLineSeg = (s: Seg): boolean => dist(s[0], s[1]) < EPS && dist(s[2], s[3]) < EPS;

export function bezPoint(s: Seg, t: number): Pt {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * s[0].x + b * s[1].x + c * s[2].x + d * s[3].x, y: a * s[0].y + b * s[1].y + c * s[2].y + d * s[3].y };
}
export function bezDeriv(s: Seg, t: number): Pt {
  const u = 1 - t;
  let x = 3 * u * u * (s[1].x - s[0].x) + 6 * u * t * (s[2].x - s[1].x) + 3 * t * t * (s[3].x - s[2].x);
  let y = 3 * u * u * (s[1].y - s[0].y) + 6 * u * t * (s[2].y - s[1].y) + 3 * t * t * (s[3].y - s[2].y);
  if (Math.abs(x) < EPS && Math.abs(y) < EPS) { x = s[3].x - s[0].x; y = s[3].y - s[0].y; }
  return { x, y };
}
export function bezTangent(s: Seg, t: number): Pt { const d = bezDeriv(s, t), l = Math.hypot(d.x, d.y) || 1; return { x: d.x / l, y: d.y / l }; }
export function bezSplit(s: Seg, t: number): [Seg, Seg] {
  const p01 = lerpPt(s[0], s[1], t), p12 = lerpPt(s[1], s[2], t), p23 = lerpPt(s[2], s[3], t);
  const p012 = lerpPt(p01, p12, t), p123 = lerpPt(p12, p23, t), m = lerpPt(p012, p123, t);
  return [[s[0], p01, p012, m], [m, p123, p23, s[3]]];
}
export function bezSub(s: Seg, t0: number, t1: number): Seg {
  if (t0 <= 0 && t1 >= 1) return s;
  const right = t0 > 0 ? bezSplit(s, t0)[1] : s;
  if (t1 >= 1) return right;
  return bezSplit(right, (t1 - t0) / (1 - t0))[0];
}

function quadRoots(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c / b];
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const sq = Math.sqrt(disc);
  return [(-b + sq) / (2 * a), (-b - sq) / (2 * a)];
}
export function segBounds(s: Seg): Rect {
  let x0 = Math.min(s[0].x, s[3].x), x1 = Math.max(s[0].x, s[3].x), y0 = Math.min(s[0].y, s[3].y), y1 = Math.max(s[0].y, s[3].y);
  const axes: Array<'x' | 'y'> = ['x', 'y'];
  for (const k of axes) {
    const a = -s[0][k] + 3 * s[1][k] - 3 * s[2][k] + s[3][k], b = 2 * (s[0][k] - 2 * s[1][k] + s[2][k]), c = s[1][k] - s[0][k];
    for (const t of quadRoots(3 * a, 3 * b, 3 * c)) {
      if (t <= 0 || t >= 1) continue;
      const p = bezPoint(s, t);
      if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const GX = [-0.9061798459386640, -0.5384693101056831, 0, 0.5384693101056831, 0.9061798459386640];
const GW = [0.2369268850561891, 0.4786286704993665, 0.5688888888888889, 0.4786286704993665, 0.2369268850561891];
export function segLength(s: Seg, t0 = 0, t1 = 1): number {
  if (isLineSeg(s)) return dist(bezPoint(s, t0), bezPoint(s, t1));
  let sum = 0;
  const parts = 4;
  for (let p = 0; p < parts; p++) {
    const a = t0 + ((t1 - t0) * p) / parts, b = t0 + ((t1 - t0) * (p + 1)) / parts, h = (b - a) / 2, m = (a + b) / 2;
    for (let i = 0; i < 5; i++) { const d = bezDeriv(s, m + h * GX[i]); sum += GW[i] * h * Math.hypot(d.x, d.y); }
  }
  return sum;
}
export function segTAtLength(s: Seg, len: number): number {
  const total = segLength(s);
  if (len <= 0) return 0;
  if (len >= total) return 1;
  let t = len / total;
  for (let i = 0; i < 8; i++) {
    const err = segLength(s, 0, t) - len, d = bezDeriv(s, t), sp = Math.hypot(d.x, d.y);
    if (Math.abs(err) < 1e-4 || sp < EPS) break;
    t = Math.min(1, Math.max(0, t - err / sp));
  }
  return t;
}
export function nearestOnSeg(s: Seg, p: Pt): { t: number; d: number; pt: Pt } {
  let best = { t: 0, d: Infinity, pt: s[0] };
  const N = isLineSeg(s) ? 1 : 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N, q = bezPoint(s, t), d = dist(q, p);
    if (d < best.d) best = { t, d, pt: q };
  }
  if (isLineSeg(s)) {
    const dx = s[3].x - s[0].x, dy = s[3].y - s[0].y, l2 = dx * dx + dy * dy;
    const u = l2 < EPS ? 0 : Math.max(0, Math.min(1, ((p.x - s[0].x) * dx + (p.y - s[0].y) * dy) / l2));
    const t = 0.5 - Math.sin(Math.asin(1 - 2 * u) / 3), q = bezPoint(s, t);
    return { t, d: dist(q, p), pt: q };
  }
  let t = best.t;
  for (let i = 0; i < 6; i++) {
    const q = bezPoint(s, t), d1 = bezDeriv(s, t);
    const h = 1e-4, q2 = bezDeriv(s, Math.min(1, t + h)), dd = { x: (q2.x - d1.x) / h, y: (q2.y - d1.y) / h };
    const f = (q.x - p.x) * d1.x + (q.y - p.y) * d1.y, fp = d1.x * d1.x + d1.y * d1.y + (q.x - p.x) * dd.x + (q.y - p.y) * dd.y;
    if (Math.abs(fp) < EPS) break;
    t = Math.max(0, Math.min(1, t - f / fp));
  }
  const q = bezPoint(s, t), d = dist(q, p);
  return d < best.d ? { t, d, pt: q } : best;
}
export function flattenSeg(s: Seg, tol: number, out: Pt[], includeStart = true): void {
  if (includeStart) out.push(s[0]);
  if (isLineSeg(s)) { out.push(s[3]); return; }
  const dd = Math.max(dist(s[0], s[1]) + dist(s[1], s[2]) + dist(s[2], s[3]), 0);
  const n = Math.max(2, Math.min(256, Math.ceil(Math.sqrt(dd / Math.max(tol, 1e-4)) * 1.2)));
  for (let i = 1; i <= n; i++) out.push(bezPoint(s, i / n));
}
export function flattenSub(sp: SubPath, tol = 0.25): Pt[] {
  const out: Pt[] = [];
  const segs = segments(sp);
  if (!segs.length) return sp.pts.map((a) => ({ x: a.x, y: a.y }));
  segs.forEach((s, i) => flattenSeg(s, tol, out, i === 0));
  if (sp.closed && out.length > 1 && dist(out[0], out[out.length - 1]) < EPS) out.pop();
  return out;
}

export const emptyRect = (): Rect => ({ x: Infinity, y: Infinity, w: -Infinity, h: -Infinity });
export const isEmptyRect = (r: Rect): boolean => !Number.isFinite(r.x) || r.w < 0 || r.h < 0;
export function unionRect(a: Rect, b: Rect): Rect {
  if (isEmptyRect(a)) return b;
  if (isEmptyRect(b)) return a;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
export const inflate = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
export const rectsTouch = (a: Rect, b: Rect): boolean => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
export const rectContains = (r: Rect, p: Pt): boolean => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
export function normRect(x0: number, y0: number, x1: number, y1: number): Rect { return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }; }
export function rectCorners(r: Rect): Pt[] { return [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }]; }
export function transformRect(r: Rect, m: Mat): Rect {
  let out = emptyRect();
  for (const c of rectCorners(r)) { const p = applyPt(m, c); out = unionRect(out, { x: p.x, y: p.y, w: 0, h: 0 }); }
  return out;
}

export function pathBounds(d: PathData): Rect {
  let r = emptyRect();
  for (const sp of cornered(d)) {
    if (sp.pts.length === 1) { const a = sp.pts[0]; r = unionRect(r, { x: a.x, y: a.y, w: 0, h: 0 }); continue; }
    for (const s of segments(sp)) r = unionRect(r, segBounds(s));
  }
  return r;
}
export function transformPath(d: PathData, m: Mat): PathData {
  return d.map((sp) => ({ closed: sp.closed, pts: sp.pts.map((a) => transformAnchor(a, m)) }));
}
export const cornerScale = { on: true };
export function transformAnchor(a: Anchor, m: Mat): Anchor {
  const p = apply(m, a.x, a.y), i = apply(m, a.ix, a.iy), o = apply(m, a.ox, a.oy);
  const out: Anchor = { x: p.x, y: p.y, ix: i.x, iy: i.y, ox: o.x, oy: o.y };
  if (a.smooth) out.smooth = true;
  if (a.corner) out.corner = a.corner.mode === 'relative' || !cornerScale.on ? a.corner : { ...a.corner, r: a.corner.r * matScale(m) };
  return out;
}
export function translatePath(d: PathData, dx: number, dy: number): PathData { return transformPath(d, translate(dx, dy)); }

export function tracePath(ctx: CanvasRenderingContext2D | Path2D, d: PathData): void {
  for (const sp of cornered(d)) {
    const n = sp.pts.length;
    if (!n) continue;
    ctx.moveTo(sp.pts[0].x, sp.pts[0].y);
    const seg = (a: Anchor, b: Anchor): void => {
      if (hasOut(a) || hasIn(b)) ctx.bezierCurveTo(a.ox, a.oy, b.ix, b.iy, b.x, b.y);
      else ctx.lineTo(b.x, b.y);
    };
    for (let i = 0; i < n - 1; i++) seg(sp.pts[i], sp.pts[i + 1]);
    if (sp.closed) { if (n > 1) seg(sp.pts[n - 1], sp.pts[0]); ctx.closePath(); }
  }
}
export function toPath2D(d: PathData): Path2D { const p = new Path2D(); tracePath(p, d); return p; }

const fmt = (v: number, prec: number): string => {
  const s = v.toFixed(prec);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s === '-0' ? '0' : s;
};
export function toSvgD(d: PathData, prec = 3): string {
  const out: string[] = [];
  for (const sp of cornered(d)) {
    const n = sp.pts.length;
    if (!n) continue;
    const f = (v: number): string => fmt(v, prec);
    out.push(`M${f(sp.pts[0].x)} ${f(sp.pts[0].y)}`);
    const seg = (a: Anchor, b: Anchor): void => {
      if (hasOut(a) || hasIn(b)) out.push(`C${f(a.ox)} ${f(a.oy)} ${f(b.ix)} ${f(b.iy)} ${f(b.x)} ${f(b.y)}`);
      else out.push(`L${f(b.x)} ${f(b.y)}`);
    };
    for (let i = 0; i < n - 1; i++) seg(sp.pts[i], sp.pts[i + 1]);
    if (sp.closed) { if (n > 1 && (hasOut(sp.pts[n - 1]) || hasIn(sp.pts[0]))) seg(sp.pts[n - 1], sp.pts[0]); out.push('Z'); }
  }
  return out.join('');
}

function arcToCubics(x1: number, y1: number, rx: number, ry: number, phi: number, large: boolean, sweep: boolean, x2: number, y2: number): Array<[number, number, number, number, number, number]> {
  if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]];
  const sinP = Math.sin(phi), cosP = Math.cos(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosP * dx + sinP * dy, y1p = -sinP * dx + cosP * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) co = -co;
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2, cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number): number => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  else if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const step = dt / n, k = (4 / 3) * Math.tan(step / 4);
  const out: Array<[number, number, number, number, number, number]> = [];
  let a = t1;
  const pt = (t: number): Pt => ({ x: cx + rx * Math.cos(t) * cosP - ry * Math.sin(t) * sinP, y: cy + rx * Math.cos(t) * sinP + ry * Math.sin(t) * cosP });
  const dpt = (t: number): Pt => ({ x: -rx * Math.sin(t) * cosP - ry * Math.cos(t) * sinP, y: -rx * Math.sin(t) * sinP + ry * Math.cos(t) * cosP });
  for (let i = 0; i < n; i++) {
    const b = a + step, p0 = pt(a), p1 = pt(b), d0 = dpt(a), d1 = dpt(b);
    out.push([p0.x + k * d0.x, p0.y + k * d0.y, p1.x - k * d1.x, p1.y - k * d1.y, p1.x, p1.y]);
    a = b;
  }
  if (out.length) { out[out.length - 1][4] = x2; out[out.length - 1][5] = y2; }
  return out;
}

export function parseSvgD(src: string): PathData {
  const toks = src.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: PathData = [];
  let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0, lastC: Pt | null = null, lastQ: Pt | null = null;
  let cur: SubPath | null = null;
  const num = (): number => Number(toks[i++]);
  const flag = (): boolean => { const t = toks[i] ?? '0', on = t[0] !== '0'; if (t.length > 1) toks[i] = t.slice(1); else i++; return on; };
  const isNum = (): boolean => i < toks.length && !/^[a-zA-Z]$/.test(toks[i]);
  const start = (x: number, y: number): void => { cur = { pts: [anchor(x, y)], closed: false }; out.push(cur); sx = x; sy = y; };
  const ensure = (): SubPath => { if (!cur) start(cx, cy); return cur as SubPath; };
  const lineTo = (x: number, y: number): void => { ensure().pts.push(anchor(x, y)); cx = x; cy = y; };
  const cubicTo = (x1: number, y1: number, x2: number, y2: number, x: number, y: number): void => {
    const sp = ensure(), last = sp.pts[sp.pts.length - 1];
    last.ox = x1; last.oy = y1;
    sp.pts.push(anchor(x, y, x2, y2));
    cx = x; cy = y;
  };
  while (i < toks.length) {
    if (/^[a-zA-Z]$/.test(toks[i])) cmd = toks[i++];
    else if (!cmd) { i++; continue; }
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    let ox = rel ? cx : 0, oy = rel ? cy : 0;
    if (C === 'Z') {
      if (cur) {
        const sp = cur as SubPath, first = sp.pts[0], last = sp.pts[sp.pts.length - 1];
        if (sp.pts.length > 1 && dist(first, last) < 1e-6) { first.ix = last.ix; first.iy = last.iy; sp.pts.pop(); }
        sp.closed = true;
      }
      cx = sx; cy = sy; cur = null; lastC = lastQ = null;
      continue;
    }
    if (!isNum()) { continue; }
    do {
      ox = rel ? cx : 0; oy = rel ? cy : 0;
      if (C === 'M') { const x = num() + ox, y = num() + oy; start(x, y); cx = x; cy = y; cmd = rel ? 'l' : 'L'; lastC = lastQ = null; break; }
      if (C === 'L') { lineTo(num() + ox, num() + oy); lastC = lastQ = null; }
      else if (C === 'H') { lineTo(num() + ox, cy); lastC = lastQ = null; }
      else if (C === 'V') { lineTo(cx, num() + (rel ? cy : 0)); lastC = lastQ = null; }
      else if (C === 'C') { const x1 = num() + ox, y1 = num() + oy, x2 = num() + ox, y2 = num() + oy, x = num() + ox, y = num() + oy; cubicTo(x1, y1, x2, y2, x, y); lastC = { x: x2, y: y2 }; lastQ = null; }
      else if (C === 'S') { const r = lastC ? { x: 2 * cx - lastC.x, y: 2 * cy - lastC.y } : { x: cx, y: cy }; const x2 = num() + ox, y2 = num() + oy, x = num() + ox, y = num() + oy; cubicTo(r.x, r.y, x2, y2, x, y); lastC = { x: x2, y: y2 }; lastQ = null; }
      else if (C === 'Q') { const qx = num() + ox, qy = num() + oy, x = num() + ox, y = num() + oy; cubicTo(cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy), x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y); lastQ = { x: qx, y: qy }; lastC = null; }
      else if (C === 'T') { const q: Pt = lastQ ? { x: 2 * cx - lastQ.x, y: 2 * cy - lastQ.y } : { x: cx, y: cy }; const x = num() + ox, y = num() + oy; cubicTo(cx + (2 / 3) * (q.x - cx), cy + (2 / 3) * (q.y - cy), x + (2 / 3) * (q.x - x), y + (2 / 3) * (q.y - y), x, y); lastQ = q; lastC = null; }
      else if (C === 'A') {
        const rx = num(), ry = num(), rot = num(), large = flag(), sweep = flag(), x = num() + ox, y = num() + oy;
        for (const c of arcToCubics(cx, cy, rx, ry, (rot * Math.PI) / 180, large, sweep, x, y)) cubicTo(c[0], c[1], c[2], c[3], c[4], c[5]);
        lastC = lastQ = null;
      } else { i++; }
    } while (isNum() && C !== 'M');
  }
  return out.filter((sp) => sp.pts.length > 0);
}

export function rectPath(x: number, y: number, w: number, h: number, radii: [number, number, number, number] = [0, 0, 0, 0], corner: 'round' | 'inverted' | 'chamfer' = 'round'): PathData {
  const max = Math.min(Math.abs(w), Math.abs(h)) / 2;
  const r = radii.map((v) => Math.max(0, Math.min(v, max))) as [number, number, number, number];
  if (r.every((v) => v < EPS)) return [{ closed: true, pts: [anchor(x, y), anchor(x + w, y), anchor(x + w, y + h), anchor(x, y + h)] }];
  const k = corner === 'round' ? KAPPA : corner === 'inverted' ? -KAPPA : 0;
  const pts: Anchor[] = [];
  const corners: Array<[number, number, number, number, number]> = [[x, y, 1, 1, r[0]], [x + w, y, -1, 1, r[1]], [x + w, y + h, -1, -1, r[2]], [x, y + h, 1, -1, r[3]]];
  corners.forEach(([cx, cy, sx, sy, rr], i) => {
    if (rr < EPS) { pts.push(anchor(cx, cy)); return; }
    const horizFirst = i % 2 === 1;
    const a = horizFirst ? { x: cx + sx * rr, y: cy } : { x: cx, y: cy + sy * rr };
    const b = horizFirst ? { x: cx, y: cy + sy * rr } : { x: cx + sx * rr, y: cy };
    if (corner === 'inverted') {
      const ia = horizFirst ? { x: a.x, y: a.y + sy * rr * KAPPA } : { x: a.x + sx * rr * KAPPA, y: a.y };
      const ib = horizFirst ? { x: b.x + sx * rr * KAPPA, y: b.y } : { x: b.x, y: b.y + sy * rr * KAPPA };
      pts.push(anchor(a.x, a.y, a.x, a.y, ia.x, ia.y), anchor(b.x, b.y, ib.x, ib.y, b.x, b.y));
    } else {
      const oa = { x: a.x + (cx - a.x) * k, y: a.y + (cy - a.y) * k }, ib = { x: b.x + (cx - b.x) * k, y: b.y + (cy - b.y) * k };
      pts.push(anchor(a.x, a.y, a.x, a.y, oa.x, oa.y), anchor(b.x, b.y, ib.x, ib.y, b.x, b.y));
    }
  });
  return [{ closed: true, pts }];
}

export function ellipsePath(x: number, y: number, w: number, h: number): PathData {
  const rx = w / 2, ry = h / 2, cx = x + rx, cy = y + ry, kx = rx * KAPPA, ky = ry * KAPPA;
  return [{ closed: true, pts: [
    anchor(cx, y, cx - kx, y, cx + kx, y, true),
    anchor(x + w, cy, x + w, cy - ky, x + w, cy + ky, true),
    anchor(cx, y + h, cx + kx, y + h, cx - kx, y + h, true),
    anchor(x, cy, x, cy + ky, x, cy - ky, true),
  ] }];
}

export function arcSegmentPath(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): Anchor[] {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2))), step = (a1 - a0) / n, k = (4 / 3) * Math.tan(step / 4);
  const pts: Anchor[] = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + step * i, c = Math.cos(t), s = Math.sin(t), px = cx + rx * c, py = cy + ry * s;
    const dx = -rx * s * k, dy = ry * c * k;
    pts.push(anchor(px, py, i === 0 ? px : px - dx, i === 0 ? py : py - dy, i === n ? px : px + dx, i === n ? py : py + dy, i > 0 && i < n));
  }
  return pts;
}

export function piePath(x: number, y: number, w: number, h: number, start: number, end: number): PathData {
  if (Math.abs(end - start) >= 359.999 || Math.abs(end - start) < 1e-6) return ellipsePath(x, y, w, h);
  const cx = x + w / 2, cy = y + h / 2, a0 = (start * Math.PI) / 180;
  let a1 = (end * Math.PI) / 180;
  while (a1 <= a0) a1 += Math.PI * 2;
  const pts = arcSegmentPath(cx, cy, w / 2, h / 2, a0, a1);
  pts.push(anchor(cx, cy));
  return [{ closed: true, pts }];
}

export function polygonPath(cx: number, cy: number, r: number, sides: number, cornerRadius = 0): PathData {
  const pts: Anchor[] = [];
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    pts.push(anchor(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return cornerRadius > 0 ? roundCorners([{ closed: true, pts }], cornerRadius) : [{ closed: true, pts }];
}

export function starPath(cx: number, cy: number, r1: number, r2: number, points: number, cornerRadius = 0): PathData {
  const pts: Anchor[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points, r = i % 2 === 0 ? r1 : r2;
    pts.push(anchor(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return cornerRadius > 0 ? roundCorners([{ closed: true, pts }], cornerRadius) : [{ closed: true, pts }];
}

export function spiralPath(cx: number, cy: number, radius: number, decay: number, segmentsCount: number, clockwise: boolean): PathData {
  const dir = clockwise ? 1 : -1, dk = Math.max(0.05, Math.min(0.99, decay));
  let c = { x: cx, y: cy }, r = radius, ang = -Math.PI / 2;
  let p = { x: c.x + r * Math.cos(ang), y: c.y + r * Math.sin(ang) };
  const pts: Anchor[] = [anchor(p.x, p.y)];
  for (let i = 0; i < segmentsCount; i++) {
    const t0 = { x: -Math.sin(ang) * dir, y: Math.cos(ang) * dir }, ang1 = ang + (dir * Math.PI) / 2;
    const p1 = { x: c.x + r * Math.cos(ang1), y: c.y + r * Math.sin(ang1) }, t1 = { x: -Math.sin(ang1) * dir, y: Math.cos(ang1) * dir }, k = r * KAPPA;
    const last = pts[pts.length - 1];
    last.ox = p.x + t0.x * k; last.oy = p.y + t0.y * k;
    pts.push(anchor(p1.x, p1.y, p1.x - t1.x * k, p1.y - t1.y * k, p1.x, p1.y, i < segmentsCount - 1));
    c = { x: p1.x + (c.x - p1.x) * dk, y: p1.y + (c.y - p1.y) * dk };
    r *= dk; ang = ang1; p = p1;
  }
  return [{ closed: false, pts }];
}

export function arcPath(x1: number, y1: number, x2: number, y2: number, slope = 0.5, convex = true): PathData {
  const k = Math.max(0, Math.min(1, slope)) * 2 * KAPPA;
  const a = anchor(x1, y1), b = anchor(x2, y2);
  if (convex) { a.ox = x1; a.oy = y1 + (y2 - y1) * k; b.ix = x2 - (x2 - x1) * k; b.iy = y2; }
  else { a.ox = x1 + (x2 - x1) * k; a.oy = y1; b.ix = x2; b.iy = y2 - (y2 - y1) * k; }
  return [{ closed: false, pts: [a, b] }];
}

export function linePath(x1: number, y1: number, x2: number, y2: number): PathData { return [{ closed: false, pts: [anchor(x1, y1), anchor(x2, y2)] }]; }

export function flarePath(cx: number, cy: number, r: number, rays: number): PathData {
  const out: PathData = [...ellipsePath(cx - r * 0.25, cy - r * 0.25, r * 0.5, r * 0.5)];
  for (let i = 0; i < rays; i++) {
    const a = (i * 2 * Math.PI) / rays + (i % 2) * 0.07, len = r * (0.55 + ((i * 37) % 10) / 22);
    out.push({ closed: false, pts: [anchor(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3), anchor(cx + Math.cos(a) * len, cy + Math.sin(a) * len)] });
  }
  return out;
}

export function roundCorners(d: PathData, radius: number): PathData {
  return d.map((sp) => {
    const n = sp.pts.length;
    if (n < 2 || radius <= 0) return sp;
    const pts: Anchor[] = [];
    for (let i = 0; i < n; i++) {
      const a = sp.pts[i];
      const endpoint = !sp.closed && (i === 0 || i === n - 1);
      if (endpoint || hasIn(a) || hasOut(a)) { pts.push({ ...a }); continue; }
      const prev = sp.pts[(i - 1 + n) % n], next = sp.pts[(i + 1) % n];
      const v1 = { x: prev.x - a.x, y: prev.y - a.y }, v2 = { x: next.x - a.x, y: next.y - a.y };
      const l1 = Math.hypot(v1.x, v1.y), l2 = Math.hypot(v2.x, v2.y);
      if (l1 < EPS || l2 < EPS) { pts.push({ ...a }); continue; }
      const cosT = (v1.x * v2.x + v1.y * v2.y) / (l1 * l2), theta = Math.acos(Math.max(-1, Math.min(1, cosT)));
      if (theta > Math.PI - 1e-3) { pts.push({ ...a }); continue; }
      let t = radius / Math.tan(theta / 2);
      t = Math.min(t, l1 / 2, l2 / 2);
      const r = t * Math.tan(theta / 2), k = (4 / 3) * Math.tan((Math.PI - theta) / 4) * r;
      const u1 = { x: v1.x / l1, y: v1.y / l1 }, u2 = { x: v2.x / l2, y: v2.y / l2 };
      const p1 = { x: a.x + u1.x * t, y: a.y + u1.y * t }, p2 = { x: a.x + u2.x * t, y: a.y + u2.y * t };
      pts.push(anchor(p1.x, p1.y, p1.x, p1.y, p1.x - u1.x * k, p1.y - u1.y * k), anchor(p2.x, p2.y, p2.x - u2.x * k, p2.y - u2.y * k, p2.x, p2.y));
    }
    return { closed: sp.closed, pts };
  });
}

export function reversePath(d: PathData): PathData {
  return d.map((sp) => ({ closed: sp.closed, pts: [...sp.pts].reverse().map((a) => { const r: Anchor = { x: a.x, y: a.y, ix: a.ox, iy: a.oy, ox: a.ix, oy: a.iy }; if (a.smooth) r.smooth = true; if (a.corner) r.corner = a.corner; return r; }) }));
}

export function pathLength(sp: SubPath): number { return segments(sp).reduce((s, g) => s + segLength(g), 0); }

export function pointAtLength(sp: SubPath, len: number): { p: Pt; tangent: Pt } {
  const segs = segments(sp);
  let acc = 0;
  for (const s of segs) {
    const l = segLength(s);
    if (acc + l >= len || s === segs[segs.length - 1]) {
      const t = segTAtLength(s, Math.max(0, len - acc));
      return { p: bezPoint(s, t), tangent: bezTangent(s, t) };
    }
    acc += l;
  }
  const a = sp.pts[0];
  return { p: { x: a.x, y: a.y }, tangent: { x: 1, y: 0 } };
}

export function signedArea(pts: Pt[]): number {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; s += a.x * b.y - b.x * a.y; }
  return s / 2;
}

export function pointInPolygon(p: Pt, poly: Pt[]): number {
  let wn = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    if (a.y <= p.y) { if (b.y > p.y && (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y) > 0) wn++; }
    else if (b.y <= p.y && (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y) < 0) wn--;
  }
  return wn;
}

export function windingAt(d: PathData, p: Pt): number {
  let w = 0;
  for (const sp of cornered(d)) if (sp.pts.length > 1) w += pointInPolygon(p, flattenSub({ ...sp, closed: true }, 0.5));
  return w;
}

export function insideFill(d: PathData, p: Pt, rule: 'nonzero' | 'evenodd'): boolean {
  const w = windingAt(d, p);
  return rule === 'evenodd' ? (w & 1) !== 0 : w !== 0;
}

export function nearestOnPath(d: PathData, p: Pt): { sub: number; seg: number; t: number; d: number; pt: Pt } | null {
  let best: { sub: number; seg: number; t: number; d: number; pt: Pt } | null = null;
  d.forEach((sp, si) => segments(sp).forEach((s, gi) => {
    const r = nearestOnSeg(s, p);
    if (!best || r.d < best.d) best = { sub: si, seg: gi, t: r.t, d: r.d, pt: r.pt };
  }));
  return best;
}

export function splitSegmentAt(sp: SubPath, segIndex: number, t: number): SubPath {
  const n = sp.pts.length, i = segIndex, j = (segIndex + 1) % n;
  const a = sp.pts[i], b = sp.pts[j], line = isLineSeg(segOf(a, b));
  const [l, r] = bezSplit(segOf(a, b), t);
  const na: Anchor = line ? { ...a } : { ...a, ox: l[1].x, oy: l[1].y };
  const m: Anchor = line ? { x: l[3].x, y: l[3].y, ix: l[3].x, iy: l[3].y, ox: l[3].x, oy: l[3].y } : { x: l[3].x, y: l[3].y, ix: l[2].x, iy: l[2].y, ox: r[1].x, oy: r[1].y };
  if (!line) m.smooth = true;
  const nb: Anchor = line ? { ...b } : { ...b, ix: r[2].x, iy: r[2].y };
  const pts = sp.pts.map((p) => ({ ...p }));
  pts[i] = na; pts[j] = nb;
  pts.splice(i + 1, 0, m);
  return { closed: sp.closed, pts };
}

export function fitCurve(points: Pt[], error: number): Anchor[] {
  const pts = points.filter((p, i) => i === 0 || dist(p, points[i - 1]) > 1e-6);
  if (pts.length < 2) return pts.map((p) => anchor(p.x, p.y));
  if (pts.length === 2) return [anchor(pts[0].x, pts[0].y), anchor(pts[1].x, pts[1].y)];
  const beziers: Seg[] = [];
  const norm = (v: Pt): Pt => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
  const tHat1 = norm({ x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y });
  const tHat2 = norm({ x: pts[pts.length - 2].x - pts[pts.length - 1].x, y: pts[pts.length - 2].y - pts[pts.length - 1].y });
  fitCubic(pts, 0, pts.length - 1, tHat1, tHat2, error, beziers);
  const out: Anchor[] = [anchor(beziers[0][0].x, beziers[0][0].y)];
  for (const b of beziers) {
    const last = out[out.length - 1];
    last.ox = b[1].x; last.oy = b[1].y;
    out.push(anchor(b[3].x, b[3].y, b[2].x, b[2].y, b[3].x, b[3].y));
  }
  for (let i = 1; i < out.length - 1; i++) {
    const a = out[i], v1 = norm({ x: a.x - a.ix, y: a.y - a.iy }), v2 = norm({ x: a.ox - a.x, y: a.oy - a.y });
    if (v1.x * v2.x + v1.y * v2.y > 0.98) a.smooth = true;
  }
  return out;
}

function fitCubic(d: Pt[], first: number, last: number, tHat1: Pt, tHat2: Pt, error: number, out: Seg[]): void {
  const nPts = last - first + 1;
  if (nPts === 2) {
    const l = dist(d[first], d[last]) / 3;
    out.push([d[first], { x: d[first].x + tHat1.x * l, y: d[first].y + tHat1.y * l }, { x: d[last].x + tHat2.x * l, y: d[last].y + tHat2.y * l }, d[last]]);
    return;
  }
  let u = chordParams(d, first, last);
  let bez = generateBezier(d, first, last, u, tHat1, tHat2);
  let [maxErr, split] = maxError(d, first, last, bez, u);
  if (maxErr < error) { out.push(bez); return; }
  if (maxErr < error * 4) {
    for (let i = 0; i < 20; i++) {
      u = reparameterize(d, first, last, u, bez);
      bez = generateBezier(d, first, last, u, tHat1, tHat2);
      [maxErr, split] = maxError(d, first, last, bez, u);
      if (maxErr < error) { out.push(bez); return; }
    }
  }
  const c = { x: d[split - 1].x - d[split + 1].x, y: d[split - 1].y - d[split + 1].y }, l = Math.hypot(c.x, c.y) || 1;
  const tc = { x: c.x / l, y: c.y / l };
  fitCubic(d, first, split, tHat1, tc, error, out);
  fitCubic(d, split, last, { x: -tc.x, y: -tc.y }, tHat2, error, out);
}
function chordParams(d: Pt[], first: number, last: number): number[] {
  const u = [0];
  for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1] + dist(d[i], d[i - 1]));
  const total = u[u.length - 1] || 1;
  return u.map((v) => v / total);
}
function generateBezier(d: Pt[], first: number, last: number, u: number[], tHat1: Pt, tHat2: Pt): Seg {
  const p0 = d[first], p3 = d[last];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < u.length; i++) {
    const t = u[i], b0 = (1 - t) ** 3, b1 = 3 * t * (1 - t) ** 2, b2 = 3 * t * t * (1 - t), b3 = t ** 3;
    const a1 = { x: tHat1.x * b1, y: tHat1.y * b1 }, a2 = { x: tHat2.x * b2, y: tHat2.y * b2 };
    c00 += a1.x * a1.x + a1.y * a1.y; c01 += a1.x * a2.x + a1.y * a2.y; c11 += a2.x * a2.x + a2.y * a2.y;
    const tmp = { x: d[first + i].x - (p0.x * (b0 + b1) + p3.x * (b2 + b3)), y: d[first + i].y - (p0.y * (b0 + b1) + p3.y * (b2 + b3)) };
    x0 += a1.x * tmp.x + a1.y * tmp.y; x1 += a2.x * tmp.x + a2.y * tmp.y;
  }
  const det = c00 * c11 - c01 * c01;
  let alpha1 = Math.abs(det) < 1e-12 ? 0 : (x0 * c11 - c01 * x1) / det, alpha2 = Math.abs(det) < 1e-12 ? 0 : (c00 * x1 - c01 * x0) / det;
  const segLen = dist(p0, p3), eps = 1e-6 * segLen;
  if (alpha1 < eps || alpha2 < eps) { alpha1 = alpha2 = segLen / 3; }
  return [p0, { x: p0.x + tHat1.x * alpha1, y: p0.y + tHat1.y * alpha1 }, { x: p3.x + tHat2.x * alpha2, y: p3.y + tHat2.y * alpha2 }, p3];
}
function reparameterize(d: Pt[], first: number, last: number, u: number[], bez: Seg): number[] {
  return u.map((t, i) => {
    const p = d[first + i], q = bezPoint(bez, t), q1 = bezDeriv(bez, t);
    const h = 1e-4, q1b = bezDeriv(bez, Math.min(1, t + h)), q2 = { x: (q1b.x - q1.x) / h, y: (q1b.y - q1.y) / h };
    const num = (q.x - p.x) * q1.x + (q.y - p.y) * q1.y, den = q1.x * q1.x + q1.y * q1.y + (q.x - p.x) * q2.x + (q.y - p.y) * q2.y;
    return Math.abs(den) < 1e-12 ? t : Math.max(0, Math.min(1, t - num / den));
  });
}
function maxError(d: Pt[], first: number, last: number, bez: Seg, u: number[]): [number, number] {
  let maxD = 0, split = Math.floor((last - first + 1) / 2) + first;
  for (let i = first + 1; i < last; i++) {
    const p = bezPoint(bez, u[i - first]), dd = (p.x - d[i].x) ** 2 + (p.y - d[i].y) ** 2;
    if (dd >= maxD) { maxD = dd; split = i; }
  }
  return [Math.sqrt(maxD), Math.max(first + 1, Math.min(last - 1, split))];
}

export function simplifyPolyline(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop() as [number, number];
    let maxD = 0, idx = -1;
    const A = pts[a], B = pts[b], dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      const d = len < 1e-9 ? Math.hypot(pts[i].x - A.x, pts[i].y - A.y) : Math.abs(dy * pts[i].x - dx * pts[i].y + B.x * A.y - B.y * A.x) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

export function smoothPoints(pts: Pt[], amount: number): Pt[] {
  if (pts.length < 3 || amount <= 0) return pts;
  const out = pts.map((p) => ({ ...p }));
  const passes = Math.max(1, Math.round(amount * 4));
  for (let k = 0; k < passes; k++) {
    for (let i = 1; i < out.length - 1; i++) { out[i] = { x: (out[i - 1].x + out[i].x * 2 + out[i + 1].x) / 4, y: (out[i - 1].y + out[i].y * 2 + out[i + 1].y) / 4 }; }
  }
  return out;
}

export function anchorCount(d: PathData): number { return d.reduce((n, sp) => n + sp.pts.length, 0); }
export function flatIndex(d: PathData, sub: number, i: number): number { let n = 0; for (let s = 0; s < sub; s++) n += d[s].pts.length; return n + i; }
export function unflatIndex(d: PathData, idx: number): [number, number] | null {
  let n = idx;
  for (let s = 0; s < d.length; s++) { if (n < d[s].pts.length) return [s, n]; n -= d[s].pts.length; }
  return null;
}

export function polyToPath(pts: Pt[], closed: boolean): PathData { return [{ closed, pts: pts.map((p) => anchor(p.x, p.y)) }]; }
export const rectToPath = (r: Rect): PathData => rectPath(r.x, r.y, r.w, r.h);
export function centerOf(r: Rect): Pt { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
