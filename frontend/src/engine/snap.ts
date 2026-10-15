import { geomBounds } from './bounds';
import { walk } from './doc';
import { bezDeriv, bezPoint, isLineSeg, segments, type Seg } from './geometry';
import type { Doc, Pt, Rect } from './types';

export interface SnapLine { x1: number; y1: number; x2: number; y2: number }
export type SnapKind = 'guide' | 'side' | 'anchor' | 'artboard' | 'center';
interface Rule { at: number; lo: number; hi: number; kind: SnapKind }
interface Spot { x: number; y: number; kind: SnapKind }
export interface SnapTargets { cell: number; spots: Map<number, Spot[]>; cols: Rule[]; rows: Rule[]; frames: Rect[]; curves: Seg[] }
export interface SnapResult { p: Pt; lines: SnapLine[]; label: string | null; hit: 'spot' | 'axis' | 'grid' | null }

const RANK: Record<SnapKind, number> = { anchor: 0, artboard: 1, center: 2, side: 3, guide: 3 };
const cellKey = (i: number, j: number): number => (i + 32768) * 65536 + (j + 32768);

export function collectTargets(doc: Doc, exclude: Set<string>, anchorObjects = 6000): SnapTargets {
  const t: SnapTargets = { cell: 64, spots: new Map(), cols: [], rows: [], frames: [], curves: [] };
  const spot = (x: number, y: number, kind: SnapKind): void => {
    const k = cellKey(Math.floor(x / t.cell), Math.floor(y / t.cell)), list = t.spots.get(k);
    if (list) list.push({ x, y, kind }); else t.spots.set(k, [{ x, y, kind }]);
  };
  const frame = (r: Rect, kind: SnapKind): void => {
    const mx = r.x + r.w / 2, my = r.y + r.h / 2;
    t.cols.push({ at: r.x, lo: r.y, hi: r.y + r.h, kind }, { at: mx, lo: r.y, hi: r.y + r.h, kind: 'center' }, { at: r.x + r.w, lo: r.y, hi: r.y + r.h, kind });
    t.rows.push({ at: r.y, lo: r.x, hi: r.x + r.w, kind }, { at: my, lo: r.x, hi: r.x + r.w, kind: 'center' }, { at: r.y + r.h, lo: r.x, hi: r.x + r.w, kind });
    spot(mx, my, 'center');
  };
  let objects = 0;
  walk(doc.layers, (n, parents) => {
    if (n.hidden || exclude.has(n.id)) return false;
    if (n.kind === 'layer') return;
    const b = geomBounds(doc, n);
    if (Number.isFinite(b.x)) {
      frame(b, 'side');
      if (t.frames.length < 1500 && parents.every((p) => p.kind === 'layer')) t.frames.push(b);
    }
    if (++objects <= anchorObjects) {
      const subs = n.kind === 'path' ? n.d : n.kind === 'compound' ? n.children.flatMap((c) => c.d) : [];
      for (const sp of subs) {
        for (const a of sp.pts) spot(a.x, a.y, 'anchor');
        if (t.curves.length < 6000) t.curves.push(...segments(sp));
      }
    }
    return n.kind === 'group' ? undefined : false;
  });
  for (const a of doc.artboards) {
    frame(a, 'artboard');
    for (const [x, y] of [[a.x, a.y], [a.x + a.w, a.y], [a.x + a.w, a.y + a.h], [a.x, a.y + a.h]]) spot(x, y, 'artboard');
  }
  for (const g of doc.guides) (g.vertical ? t.cols : t.rows).push({ at: g.pos, lo: -1e5, hi: 1e5, kind: 'guide' });
  t.cols.sort((a, b) => a.at - b.at);
  t.rows.sort((a, b) => a.at - b.at);
  return t;
}

function nearestRule(list: Rule[], v: number, tol: number): Rule | null {
  let lo = 0, hi = list.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].at < v - tol) lo = m + 1; else hi = m; }
  let best: Rule | null = null;
  for (let i = lo; i < list.length && list[i].at <= v + tol; i++) if (!best || Math.abs(list[i].at - v) < Math.abs(best.at - v)) best = list[i];
  return best;
}

function nearestSpot(t: SnapTargets, p: Pt, tol: number): Spot | null {
  const c = t.cell, i0 = Math.floor((p.x - tol) / c), i1 = Math.floor((p.x + tol) / c), j0 = Math.floor((p.y - tol) / c), j1 = Math.floor((p.y + tol) / c);
  let best: Spot | null = null, score = Infinity;
  const consider = (s: Spot): void => {
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d > tol) return;
    const v = d + RANK[s.kind] * tol * 0.15;
    if (v < score) { score = v; best = s; }
  };
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > t.spots.size) { for (const list of t.spots.values()) list.forEach(consider); return best; }
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) t.spots.get(cellKey(i, j))?.forEach(consider);
  return best;
}

export interface SnapOpts { tol: number; smart: boolean; grid: { on: boolean; spacing: number; sub: number }; point: boolean }

export function snapPoint(p: Pt, t: SnapTargets, o: SnapOpts): SnapResult {
  let q = p, hit: SnapResult['hit'] = null;
  if (o.grid.on) {
    const step = o.grid.spacing / Math.max(1, o.grid.sub);
    q = { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
    hit = 'grid';
    if (!o.smart) return { p: q, lines: [], label: null, hit };
  }
  if (!o.smart && !o.point) return { p: q, lines: [], label: null, hit };
  const s = nearestSpot(t, q, o.tol);
  if (s) return { p: { x: s.x, y: s.y }, lines: [], label: s.kind, hit: 'spot' };
  if (!o.smart) return { p: q, lines: [], label: null, hit };
  const col = nearestRule(t.cols, q.x, o.tol), row = nearestRule(t.rows, q.y, o.tol);
  if (!col && !row) return { p: q, lines: [], label: null, hit };
  const at = { x: col ? col.at : q.x, y: row ? row.at : q.y }, lines: SnapLine[] = [];
  if (col) lines.push({ x1: col.at, y1: Math.min(col.lo, at.y), x2: col.at, y2: Math.max(col.hi, at.y) });
  if (row) lines.push({ x1: Math.min(row.lo, at.x), y1: row.at, x2: Math.max(row.hi, at.x), y2: row.at });
  return { p: at, lines, label: null, hit: 'axis' };
}

function fitAxis(list: Rule[], feats: number[], tol: number): { d: number; rule: Rule } | null {
  let best: { d: number; rule: Rule; score: number } | null = null;
  feats.forEach((v, i) => {
    const rule = nearestRule(list, v, tol);
    if (!rule) return;
    const score = Math.abs(rule.at - v) + ((i === 1) !== (rule.kind === 'center') ? tol * 0.25 : 0);
    if (!best || score < best.score) best = { d: rule.at - v, rule, score };
  });
  return best;
}

interface Span { a: number; b: number; c0: number; c1: number }
function spacing(r: Rect, boxes: Rect[], vertical: boolean, tol: number): { d: number; lines: SnapLine[] } | null {
  const S = (x: Rect): Span => (vertical ? { a: x.y, b: x.y + x.h, c0: x.x, c1: x.x + x.w } : { a: x.x, b: x.x + x.w, c0: x.y, c1: x.y + x.h });
  const me = S(r), size = me.b - me.a, others = boxes.map(S).filter((s) => s.c0 < me.c1 && s.c1 > me.c0);
  const leftOf = (x: Span, list: Span[]): Span | null => list.filter((s) => s.b <= x.a + tol && s !== x).reduce<Span | null>((m, s) => (!m || s.b > m.b ? s : m), null);
  const rightOf = (x: Span, list: Span[]): Span | null => list.filter((s) => s.a >= x.b - tol && s !== x).reduce<Span | null>((m, s) => (!m || s.a < m.a ? s : m), null);
  const A = leftOf(me, others), B = rightOf(me, others);
  const opts: Array<{ d: number; gaps: Array<[number, number]> }> = [];
  if (A && B && B.a - A.b > size) { const p = (A.b + B.a - size) / 2; opts.push({ d: p - me.a, gaps: [[A.b, p], [p + size, B.a]] }); }
  if (A) { const A2 = leftOf(A, boxes.map(S).filter((s) => s.c0 < A.c1 && s.c1 > A.c0)); if (A2 && A.a - A2.b > 0) { const g = A.a - A2.b, p = A.b + g; opts.push({ d: p - me.a, gaps: [[A2.b, A.a], [A.b, p]] }); } }
  if (B) { const B2 = rightOf(B, boxes.map(S).filter((s) => s.c0 < B.c1 && s.c1 > B.c0)); if (B2 && B2.a - B.b > 0) { const g = B2.a - B.b, p = B.a - g - size; opts.push({ d: p - me.a, gaps: [[p + size, B.a], [B.b, B2.a]] }); } }
  const best = opts.filter((x) => Math.abs(x.d) <= tol).sort((x, y) => Math.abs(x.d) - Math.abs(y.d))[0];
  if (!best) return null;
  const c = (Math.max(me.c0, ...others.map((s) => s.c0)) + Math.min(me.c1, ...others.map((s) => s.c1))) / 2, mid = Number.isFinite(c) ? c : (me.c0 + me.c1) / 2, k = tol * 0.6;
  const lines: SnapLine[] = [];
  for (const [g0, g1] of best.gaps) {
    if (vertical) lines.push({ x1: mid, y1: g0, x2: mid, y2: g1 }, { x1: mid - k, y1: g0, x2: mid + k, y2: g0 }, { x1: mid - k, y1: g1, x2: mid + k, y2: g1 });
    else lines.push({ x1: g0, y1: mid, x2: g1, y2: mid }, { x1: g0, y1: mid - k, x2: g0, y2: mid + k }, { x1: g1, y1: mid - k, x2: g1, y2: mid + k });
  }
  return { d: best.d, lines };
}

export function snapRect(r: Rect, t: SnapTargets, o: SnapOpts): { dx: number; dy: number; lines: SnapLine[] } {
  if (o.grid.on && !o.smart) {
    const step = o.grid.spacing / Math.max(1, o.grid.sub);
    return { dx: Math.round(r.x / step) * step - r.x, dy: Math.round(r.y / step) * step - r.y, lines: [] };
  }
  if (!o.smart) return { dx: 0, dy: 0, lines: [] };
  const ax = fitAxis(t.cols, [r.x, r.x + r.w / 2, r.x + r.w], o.tol), ay = fitAxis(t.rows, [r.y, r.y + r.h / 2, r.y + r.h], o.tol);
  const sx = t.frames.length ? spacing(r, t.frames, false, o.tol) : null, sy = t.frames.length ? spacing(r, t.frames, true, o.tol) : null;
  const useSx = !!sx && (!ax || Math.abs(sx.d) <= Math.abs(ax.d) + 1e-9), useSy = !!sy && (!ay || Math.abs(sy.d) <= Math.abs(ay.d) + 1e-9);
  const dx = useSx && sx ? sx.d : ax ? ax.d : 0, dy = useSy && sy ? sy.d : ay ? ay.d : 0, lines: SnapLine[] = [];
  if (ax && Math.abs(ax.d - dx) < 1e-6) lines.push({ x1: ax.rule.at, y1: Math.min(ax.rule.lo, r.y + dy), x2: ax.rule.at, y2: Math.max(ax.rule.hi, r.y + r.h + dy) });
  if (ay && Math.abs(ay.d - dy) < 1e-6) lines.push({ x1: Math.min(ay.rule.lo, r.x + dx), y1: ay.rule.at, x2: Math.max(ay.rule.hi, r.x + r.w + dx), y2: ay.rule.at });
  if (useSx && sx) lines.push(...sx.lines);
  if (useSy && sy) lines.push(...sy.lines);
  return { dx, dy, lines };
}

export const DEFAULT_SNAP_ANGLES = [0, 45, 90, 135];

function roots(f: (t: number) => number, steps = 14): number[] {
  const out: number[] = [];
  let t0 = 0, f0 = f(0);
  for (let i = 1; i <= steps; i++) {
    const t1 = i / steps, f1 = f(t1);
    if (f0 === 0) out.push(t0);
    else if (f0 * f1 < 0) {
      let a = t0, b = t1, fa = f0;
      for (let k = 0; k < 22; k++) { const m = (a + b) / 2, fm = f(m); if (fa * fm <= 0) b = m; else { a = m; fa = fm; } }
      out.push((a + b) / 2);
    }
    t0 = t1; f0 = f1;
  }
  return out;
}

export function snapLine(p: Pt, from: Pt, t: SnapTargets, tol: number, angles: number[] = DEFAULT_SNAP_ANGLES): SnapResult | null {
  let best: { q: Pt; d: number; label: string; lines: SnapLine[] } | null = null;
  const take = (q: Pt, label: string, lines: SnapLine[], bias: number): void => {
    const d = Math.hypot(p.x - q.x, p.y - q.y) + bias;
    if (d <= tol && (!best || d < best.d)) best = { q, d, label, lines };
  };
  for (const deg of angles) {
    const a = (deg * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), s = (p.x - from.x) * ux + (p.y - from.y) * uy;
    const q = { x: from.x + ux * s, y: from.y + uy * s };
    take(q, `${deg}°`, [{ x1: from.x, y1: from.y, x2: q.x, y2: q.y }], 0);
  }
  const reach = tol * 6;
  for (const s of t.curves) {
    const x0 = Math.min(s[0].x, s[1].x, s[2].x, s[3].x), x1 = Math.max(s[0].x, s[1].x, s[2].x, s[3].x);
    const y0 = Math.min(s[0].y, s[1].y, s[2].y, s[3].y), y1 = Math.max(s[0].y, s[1].y, s[2].y, s[3].y);
    if (p.x < x0 - reach || p.x > x1 + reach || p.y < y0 - reach || p.y > y1 + reach) continue;
    const line = isLineSeg(s);
    for (const u of roots((k) => { const b = bezPoint(s, k), v = bezDeriv(s, k); return (b.x - from.x) * v.x + (b.y - from.y) * v.y; })) {
      const q = bezPoint(s, u), v = bezDeriv(s, u), len = Math.hypot(v.x, v.y), r = Math.hypot(q.x - from.x, q.y - from.y);
      if (!len || r < tol) continue;
      const k = Math.min(tol * 1.5, r / 3), wx = v.x / len, wy = v.y / len, dx = (from.x - q.x) / r, dy = (from.y - q.y) / r;
      const m = [
        { x1: q.x + dx * k, y1: q.y + dy * k, x2: q.x + (dx + wx) * k, y2: q.y + (dy + wy) * k },
        { x1: q.x + wx * k, y1: q.y + wy * k, x2: q.x + (dx + wx) * k, y2: q.y + (dy + wy) * k },
      ];
      take(q, 'perpendicular', [{ x1: from.x, y1: from.y, x2: q.x, y2: q.y }, ...m], -tol * 0.05);
    }
    if (line) continue;
    for (const u of roots((k) => { const b = bezPoint(s, k), v = bezDeriv(s, k); return (b.x - from.x) * v.y - (b.y - from.y) * v.x; })) {
      const q = bezPoint(s, u);
      if (Math.hypot(q.x - from.x, q.y - from.y) < tol) continue;
      take(q, 'tangent', [{ x1: from.x, y1: from.y, x2: q.x, y2: q.y }], -tol * 0.05);
    }
  }
  if (!best) return null;
  const b = best as { q: Pt; label: string; lines: SnapLine[] };
  return { p: b.q, lines: b.lines, label: b.label, hit: 'axis' };
}

export function constrainAngle(origin: Pt, p: Pt, step = 45): Pt {
  const dx = p.x - origin.x, dy = p.y - origin.y, len = Math.hypot(dx, dy);
  const a = Math.round(Math.atan2(dy, dx) / ((step * Math.PI) / 180)) * ((step * Math.PI) / 180);
  return { x: origin.x + Math.cos(a) * len, y: origin.y + Math.sin(a) * len };
}
