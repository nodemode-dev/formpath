import { geomBounds } from './bounds';
import { walk } from './doc';
import type { Doc, Pt, Rect } from './types';

export interface SnapLine { x1: number; y1: number; x2: number; y2: number }
export type SnapKind = 'guide' | 'side' | 'anchor' | 'artboard' | 'center';
interface Rule { at: number; lo: number; hi: number; kind: SnapKind }
interface Spot { x: number; y: number; kind: SnapKind }
export interface SnapTargets { cell: number; spots: Map<number, Spot[]>; cols: Rule[]; rows: Rule[] }
export interface SnapResult { p: Pt; lines: SnapLine[]; label: string | null; hit: 'spot' | 'axis' | 'grid' | null }

const RANK: Record<SnapKind, number> = { anchor: 0, artboard: 1, center: 2, side: 3, guide: 3 };
const cellKey = (i: number, j: number): number => (i + 32768) * 65536 + (j + 32768);

export function collectTargets(doc: Doc, exclude: Set<string>, anchorObjects = 6000): SnapTargets {
  const t: SnapTargets = { cell: 64, spots: new Map(), cols: [], rows: [] };
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
  walk(doc.layers, (n) => {
    if (n.hidden || exclude.has(n.id)) return false;
    if (n.kind === 'layer') return;
    const b = geomBounds(doc, n);
    if (Number.isFinite(b.x)) frame(b, 'side');
    if (++objects <= anchorObjects) {
      const subs = n.kind === 'path' ? n.d : n.kind === 'compound' ? n.children.flatMap((c) => c.d) : [];
      for (const sp of subs) for (const a of sp.pts) spot(a.x, a.y, 'anchor');
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

export function snapRect(r: Rect, t: SnapTargets, o: SnapOpts): { dx: number; dy: number; lines: SnapLine[] } {
  if (o.grid.on && !o.smart) {
    const step = o.grid.spacing / Math.max(1, o.grid.sub);
    return { dx: Math.round(r.x / step) * step - r.x, dy: Math.round(r.y / step) * step - r.y, lines: [] };
  }
  if (!o.smart) return { dx: 0, dy: 0, lines: [] };
  const ax = fitAxis(t.cols, [r.x, r.x + r.w / 2, r.x + r.w], o.tol), ay = fitAxis(t.rows, [r.y, r.y + r.h / 2, r.y + r.h], o.tol);
  const dx = ax ? ax.d : 0, dy = ay ? ay.d : 0, lines: SnapLine[] = [];
  if (ax) lines.push({ x1: ax.rule.at, y1: Math.min(ax.rule.lo, r.y + dy), x2: ax.rule.at, y2: Math.max(ax.rule.hi, r.y + r.h + dy) });
  if (ay) lines.push({ x1: Math.min(ay.rule.lo, r.x + dx), y1: ay.rule.at, x2: Math.max(ay.rule.hi, r.x + r.w + dx), y2: ay.rule.at });
  return { dx, dy, lines };
}

export function constrainAngle(origin: Pt, p: Pt, step = 45): Pt {
  const dx = p.x - origin.x, dy = p.y - origin.y, len = Math.hypot(dx, dy);
  const a = Math.round(Math.atan2(dy, dx) / ((step * Math.PI) / 180)) * ((step * Math.PI) / 180);
  return { x: origin.x + Math.cos(a) * len, y: origin.y + Math.sin(a) * len };
}
