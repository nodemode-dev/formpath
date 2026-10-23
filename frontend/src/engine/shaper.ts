import { newId } from './doc';
import { flattenSub, pathBounds, pointInPolygon } from './geometry';
import { interiorPoint, regionParts, uniteAll } from './kernel';
import { inArea, intertwineOverlays } from './intertwine';
import { liveShapePath } from './ops/live-shapes';
import { arrangement, geometryOf } from './ops/paths';
import { withFirstFill } from './paint';
import { liveArt } from './pathfinder';
import type { FillRule, GroupNode, LiveShape, Mat, Paint, PathData, PathNode, Pt, ShaperSpec, VNode } from './types';

export const emptyShaper = (): ShaperSpec => ({ cuts: [], merges: [], fills: [] });

interface Cell { d: PathData; top: number; members: number[]; ip: Pt }
const cellCache = new WeakMap<VNode[], Cell[]>();
function shapeOf(n: VNode): { d: PathData; rule: FillRule } | null {
  if (n.hidden) return null;
  const g = geometryOf(n);
  if (!g) return null;
  const d = g.d.filter((sp) => sp.pts.length > 2).map((sp) => ({ ...sp, closed: true }));
  return d.length ? { d, rule: g.rule } : null;
}

export function shaperCells(g: GroupNode): Cell[] {
  const kids = g.children, hit = cellCache.get(kids);
  if (hit) return hit;
  const shapes = kids.map(shapeOf), idx = shapes.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
  let cells: Cell[] = [];
  try {
    cells = arrangement(idx.map((i) => shapes[i] as { d: PathData; rule: FillRule })).map((f) => {
      const ip = interiorPoint(f.d) ?? { x: pathBounds(f.d).x, y: pathBounds(f.d).y };
      const members = idx.filter((i) => { const s = shapes[i] as { d: PathData; rule: FillRule }; return s.rule === 'evenodd' ? evenOdd(s.d, ip) : inArea(s.d, ip); });
      return { d: f.d, top: idx[f.top], members: members.length ? members : [idx[f.top]], ip };
    });
  } catch { cells = []; }
  cellCache.set(kids, cells);
  return cells;
}

function evenOdd(d: PathData, p: Pt): boolean {
  let k = 0;
  for (const sp of d) if (sp.pts.length > 1 && pointInPolygon(p, flattenSub({ ...sp, closed: true }, 0.5)) !== 0) k++;
  return k % 2 === 1;
}

export interface ShaperRegion { node: PathNode; cells: number[]; owner: number; merged: boolean }
const regionCache = new WeakMap<GroupNode, ShaperRegion[]>();
export function shaperRegions(g: GroupNode): ShaperRegion[] {
  const hit = regionCache.get(g);
  if (hit) return hit;
  const spec = g.shaper ?? emptyShaper(), kids = g.children, cells = shaperCells(g);
  const cut = cells.map((c) => spec.cuts.some((q) => inArea(c.d, q)));
  const parent = cells.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const merged = new Set<number>(), srcOf = new Map<number, string>();
  const touched = spec.merges.map((m) => cells.map((_, i) => i).filter((i) => !cut[i] && m.pts.some((q) => inArea(cells[i].d, q))));
  touched.forEach((cs) => { for (const c of cs) { parent[find(c)] = find(cs[0]); merged.add(c); } });
  spec.merges.forEach((m, k) => { if (touched[k].length) srcOf.set(find(touched[k][0]), m.src); });
  const groups = new Map<string, { cells: number[]; owner: number; merged: boolean }>();
  cells.forEach((c, i) => {
    if (cut[i]) return;
    const key = merged.has(i) ? `m${find(i)}` : `t${c.top}`;
    const gr = groups.get(key) ?? { cells: [], owner: c.top, merged: merged.has(i) };
    gr.cells.push(i);
    if (merged.has(i)) { const src = kids.findIndex((x) => x.id === srcOf.get(find(i))); gr.owner = src >= 0 ? src : Math.max(gr.owner, c.top); }
    groups.set(key, gr);
  });
  const out: ShaperRegion[] = [];
  for (const [key, gr] of groups) {
    const whole = gr.cells.length === 1 ? cells[gr.cells[0]].d : uniteAll(gr.cells.map((i) => ({ d: cells[i].d, rule: 'nonzero' as FillRule })));
    const parts = gr.merged ? [whole] : regionParts(whole);
    parts.forEach((d, k) => {
      const src = kids[gr.owner];
      if (!src || !d.length) return;
      const mine = gr.cells.filter((i) => parts.length === 1 || inArea(d, cells[i].ip));
      const f = [...spec.fills].reverse().find((x) => inArea(d, x.at));
      const node: PathNode = { id: `${g.id}~r${key}_${k}`, kind: 'path', d, rule: 'nonzero', opacity: src.opacity, blend: src.blend, ap: f ? withFirstFill(src.ap, f.paint) : src.ap };
      out.push({ node, cells: mine, owner: gr.owner, merged: gr.merged });
    });
  }
  out.sort((a, b) => a.owner - b.owner);
  regionCache.set(g, out);
  return out;
}

export const shaperRegionAt = (g: GroupNode, p: Pt): ShaperRegion | null => [...shaperRegions(g)].reverse().find((r) => inArea(r.node.d, p)) ?? null;

export function samplePolyline(pts: Pt[], step: number): Pt[] {
  if (pts.length < 2) return pts.slice();
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(l / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

export type ShaperOp = 'merge' | 'punch' | 'delete';
export type ScribbleResult = { kind: 'cut' | 'merge'; spec: ShaperSpec } | { kind: 'remove'; indices: number[] } | { kind: 'none' };
export function shaperScribble(g: GroupNode, stroke: Pt[], op: ShaperOp): ScribbleResult | null {
  const spec = g.shaper ?? emptyShaper(), cells = shaperCells(g);
  const cut = cells.map((c) => spec.cuts.some((q) => inArea(c.d, q)));
  const order: number[] = [];
  for (const p of samplePolyline(stroke, 2)) {
    const i = cells.findIndex((c, k) => !cut[k] && inArea(c.d, p));
    if (i >= 0 && !order.includes(i)) order.push(i);
  }
  if (!order.length) return null;
  if (op === 'delete') return { kind: 'remove', indices: [...new Set(order.map((i) => cells[i].top))] };
  if (op === 'punch') {
    const over = order.filter((i) => cells[i].members.length >= 2);
    return over.length ? { kind: 'cut', spec: { ...spec, cuts: [...spec.cuts, ...over.map((i) => cells[i].ip)] } } : { kind: 'none' };
  }
  if (order.length < 2) return { kind: 'none' };
  const first = shaperRegions(g).find((r) => r.cells.includes(order[0]));
  const src = g.children[first?.owner ?? cells[order[0]].top]?.id ?? g.children[cells[order[0]].top].id;
  const cuts = spec.cuts.filter((q) => !order.some((i) => inArea(cells[i].d, q)));
  return { kind: 'merge', spec: { ...spec, cuts, merges: [...spec.merges, { pts: order.map((i) => cells[i].ip), src }] } };
}

export function shaperFill(g: GroupNode, at: Pt, paint: Paint): ShaperSpec | null {
  const r = shaperRegionAt(g, at);
  if (!r) return null;
  const spec = g.shaper ?? emptyShaper();
  return { ...spec, fills: [...spec.fills.filter((f) => !inArea(r.node.d, f.at)), { at, paint }] };
}

export function shaperNode(nodes: VNode[], id = newId('g')): GroupNode {
  return { id, kind: 'group', name: 'Shaper Group', clip: false, children: nodes, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, shaper: emptyShaper() };
}

export function expandedShaper(g: GroupNode): GroupNode {
  return { ...g, shaper: undefined, name: g.name === 'Shaper Group' ? 'Shaper Group (expanded)' : g.name, children: shaperRegions(g).map((r) => ({ ...r.node, id: newId('p') })) };
}

export function mapShaper(s: ShaperSpec, f: (p: Pt) => Pt, paint: (p: Paint) => Paint = (p) => p): ShaperSpec {
  return { cuts: s.cuts.map(f), merges: s.merges.map((m) => ({ ...m, pts: m.pts.map(f) })), fills: s.fills.map((x) => ({ at: f(x.at), paint: paint(x.paint) })) };
}

export type ShapeKind = 'line' | 'triangle' | 'rectangle' | 'square' | 'polygon' | 'circle' | 'ellipse';
export interface Recognized { kind: ShapeKind; live: LiveShape; d: PathData; error: number }

const plen = (pts: Pt[]): number => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);

export function resample(pts: Pt[], n: number): Pt[] {
  const total = plen(pts);
  if (total <= 0 || pts.length < 2) return pts.slice();
  const step = total / (n - 1), out: Pt[] = [pts[0]];
  let acc = 0, prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    let cur = pts[i], d = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    while (acc + d >= step && d > 0) {
      const t = (step - acc) / d, q = { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t };
      out.push(q); prev = q; d = Math.hypot(cur.x - prev.x, cur.y - prev.y); acc = 0;
      cur = pts[i];
    }
    acc += d; prev = cur;
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out.slice(0, n);
}

function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cr = (o: Pt, a: Pt, b: Pt): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: Pt[] = [], up: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

function reversals(R: Pt[], deg: number): number {
  const lim = Math.cos((deg * Math.PI) / 180);
  let count = 0, last = -10;
  for (let i = 2; i < R.length - 2; i++) {
    const ax = R[i].x - R[i - 2].x, ay = R[i].y - R[i - 2].y, bx = R[i + 2].x - R[i].x, by = R[i + 2].y - R[i].y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < 1e-9 || lb < 1e-9) continue;
    if ((ax * bx + ay * by) / (la * lb) < lim && i - last > 3) { count++; last = i; }
  }
  return count;
}

export function isScribble(raw: Pt[]): boolean {
  if (raw.length < 6) return false;
  const R = resample(raw, 96), h = hull(R), hp = h.length > 2 ? plen([...h, h[0]]) : plen(h);
  const ratio = plen(R) / Math.max(1e-6, hp), rev = reversals(R, 135);
  return (rev >= 2 && ratio > 1.3) || rev >= 4;
}

function closedRdp(pts: Pt[], tol: number): Pt[] {
  let far = 0, fi = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[0].x, pts[i].y - pts[0].y); if (d > far) { far = d; fi = i; } }
  const rdp = (a: Pt[]): Pt[] => {
    if (a.length < 3) return a;
    const s = a[0], e = a[a.length - 1], dx = e.x - s.x, dy = e.y - s.y, l = Math.hypot(dx, dy) || 1;
    let md = 0, mi = 0;
    for (let i = 1; i < a.length - 1; i++) { const d = Math.abs((a[i].x - s.x) * dy - (a[i].y - s.y) * dx) / l; if (d > md) { md = d; mi = i; } }
    return md > tol ? [...rdp(a.slice(0, mi + 1)).slice(0, -1), ...rdp(a.slice(mi))] : [s, e];
  };
  const one = rdp(pts.slice(0, fi + 1)), two = rdp([...pts.slice(fi), pts[0]]);
  let v = [...one.slice(0, -1), ...two.slice(0, -1)];
  let changed = true;
  while (changed && v.length > 3) {
    changed = false;
    for (let i = 0; i < v.length; i++) {
      const a = v[(i - 1 + v.length) % v.length], b = v[i], c = v[(i + 1) % v.length];
      const ux = b.x - a.x, uy = b.y - a.y, wx = c.x - b.x, wy = c.y - b.y, lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
      const turn = lu < 1e-9 || lw < 1e-9 ? 0 : Math.acos(Math.max(-1, Math.min(1, (ux * wx + uy * wy) / (lu * lw))));
      if (turn < (28 * Math.PI) / 180 || lu < tol * 0.6) { v = v.filter((_, k) => k !== i); changed = true; break; }
    }
  }
  return v;
}

function meanDist(R: Pt[], d: PathData, scale: number): number {
  const polys = d.map((sp) => flattenSub(sp, 0.5));
  let s = 0;
  for (const p of R) {
    let best = Infinity;
    for (const poly of polys) for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
      const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
      best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t));
    }
    s += best;
  }
  return s / R.length / Math.max(1e-6, scale);
}

const rot = (phi: number, cx: number, cy: number): Mat => { const c = Math.cos(phi), s = Math.sin(phi); return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]; };
const snapAngle = (phi: number, period: number, tolDeg = 8): number => { const k = Math.round(phi / period) * period; return Math.abs(phi - k) < (tolDeg * Math.PI) / 180 ? k : phi; };
const signed = (v: Pt[]): number => v.reduce((s, a, i) => { const b = v[(i + 1) % v.length]; return s + a.x * b.y - b.x * a.y; }, 0) / 2;

export function recognizeShape(raw: Pt[]): Recognized | null {
  const pts = raw.filter((p, i) => i === 0 || Math.hypot(p.x - raw[i - 1].x, p.y - raw[i - 1].y) > 1e-6);
  if (pts.length < 3) return null;
  const b = pathBounds([{ closed: false, pts: pts.map((p) => ({ x: p.x, y: p.y, ix: p.x, iy: p.y, ox: p.x, oy: p.y })) }]);
  const diag = Math.hypot(b.w, b.h);
  if (diag < 6) return null;
  const gap = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
  if (gap > Math.max(0.3 * diag, 14)) {
    const a = pts[0], z = pts[pts.length - 1], dx = z.x - a.x, dy = z.y - a.y;
    const dev = pts.reduce((m, q) => Math.max(m, Math.abs((q.x - a.x) * dy - (q.y - a.y) * dx) / gap), 0);
    if (dev > Math.max(4, 0.08 * gap)) return null;
    let ang = Math.atan2(z.y - a.y, z.x - a.x);
    const sn = snapAngle(ang, Math.PI / 4, 6);
    if (sn !== ang) { const L = Math.hypot(z.x - a.x, z.y - a.y); ang = sn; const live: LiveShape = { kind: 'line', x1: a.x, y1: a.y, x2: a.x + Math.cos(ang) * L, y2: a.y + Math.sin(ang) * L }; return { kind: 'line', live, d: liveShapePath(live), error: 0 }; }
    const live: LiveShape = { kind: 'line', x1: a.x, y1: a.y, x2: z.x, y2: z.y };
    return { kind: 'line', live, d: liveShapePath(live), error: dev / gap };
  }
  const R = resample([...pts, pts[0]], 96).slice(0, -1);
  const cx = R.reduce((s, p) => s + p.x, 0) / R.length, cy = R.reduce((s, p) => s + p.y, 0) / R.length;
  const scale = Math.max(4, Math.sqrt(b.w * b.h) / 2);
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of R) { const x = p.x - cx, y = p.y - cy; sxx += x * x; syy += y * y; sxy += x * y; }
  sxx /= R.length; syy /= R.length; sxy /= R.length;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy, disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc, l2 = Math.max(1e-9, tr / 2 - disc);
  const cands: Recognized[] = [];
  const add = (kind: ShapeKind, live: LiveShape, penalty: number): void => { const d = liveShapePath(live); cands.push({ kind, live, d, error: meanDist(R, d, scale) + penalty }); };
  const r = R.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / R.length;
  add('circle', { kind: 'ellipse', x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, start: 0, end: 360, xf: [1, 0, 0, 1, 0, 0] }, 0.004);
  const theta = snapAngle(0.5 * Math.atan2(2 * sxy, sxx - syy), Math.PI / 2);
  const ea = Math.sqrt(2 * l1), eb = Math.sqrt(2 * l2);
  add('ellipse', { kind: 'ellipse', x: cx - ea, y: cy - eb, w: 2 * ea, h: 2 * eb, start: 0, end: 360, xf: theta === 0 ? [1, 0, 0, 1, 0, 0] : rot(theta, cx, cy) }, 0.012);
  const tol = Math.max(3, 0.07 * diag);
  let v = closedRdp(R, tol);
  if (v.length >= 3 && v.length <= 8) {
    if (signed(v) < 0) v = [...v].reverse();
    if (v.length === 3) {
      const t = polygonTemplate(3);
      const m = affineFrom(t, v);
      if (m) add('triangle', { kind: 'polygon', cx: 0, cy: 0, r: 1, sides: 3, radius: 0, xf: m }, 0.006);
    }
    if (v.length === 4) {
      let s4 = 0, c4 = 0;
      for (let i = 0; i < 4; i++) { const a = v[i], q = v[(i + 1) % 4], ang = Math.atan2(q.y - a.y, q.x - a.x); const w = Math.hypot(q.x - a.x, q.y - a.y); s4 += Math.sin(4 * ang) * w; c4 += Math.cos(4 * ang) * w; }
      const phi = snapAngle(Math.atan2(s4, c4) / 4, Math.PI / 2);
      const back = rot(-phi, cx, cy), us = R.map((p) => ({ x: back[0] * p.x + back[2] * p.y + back[4], y: back[1] * p.x + back[3] * p.y + back[5] }));
      const xs = us.map((p) => p.x).sort((a, c) => a - c), ys = us.map((p) => p.y).sort((a, c) => a - c), q = (a: number[], f: number): number => a[Math.min(a.length - 1, Math.max(0, Math.round(f * (a.length - 1))))];
      let x0 = q(xs, 0.03), x1 = q(xs, 0.97), y0 = q(ys, 0.03), y1 = q(ys, 0.97), sq = false;
      if (Math.abs((x1 - x0) - (y1 - y0)) / Math.max(x1 - x0, y1 - y0) < 0.12) { const s = ((x1 - x0) + (y1 - y0)) / 2, mx = (x0 + x1) / 2, my = (y0 + y1) / 2; x0 = mx - s / 2; x1 = mx + s / 2; y0 = my - s / 2; y1 = my + s / 2; sq = true; }
      add(sq ? 'square' : 'rectangle', { kind: 'rect', x: x0, y: y0, w: x1 - x0, h: y1 - y0, radii: [0, 0, 0, 0], corner: 'round', xf: phi === 0 ? [1, 0, 0, 1, 0, 0] : rot(phi, cx, cy) }, 0.003);
    }
    if (v.length >= 5) {
      const k = v.length, pcx = v.reduce((s, p) => s + p.x, 0) / k, pcy = v.reduce((s, p) => s + p.y, 0) / k, pr = v.reduce((s, p) => s + Math.hypot(p.x - pcx, p.y - pcy), 0) / k;
      const a0 = Math.atan2(v[0].y - pcy, v[0].x - pcx) + Math.PI / 2, step = (2 * Math.PI) / k;
      const phi = snapAngle(a0 - Math.round(a0 / step) * step, step, 6);
      add('polygon', { kind: 'polygon', cx: pcx, cy: pcy, r: pr, sides: k, radius: 0, xf: phi === 0 ? [1, 0, 0, 1, 0, 0] : rot(phi, pcx, pcy) }, 0.006 + 0.002 * k);
    }
  }
  cands.sort((a, c) => a.error - c.error);
  const best = cands[0];
  return best && best.error < 0.16 ? best : null;
}

function polygonTemplate(n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; out.push({ x: Math.cos(a), y: Math.sin(a) }); }
  return signed(out) < 0 ? out.reverse() : out;
}

function affineFrom(src: Pt[], dst: Pt[]): Mat | null {
  const [p0, p1, p2] = src, [q0, q1, q2] = dst;
  const d = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
  if (Math.abs(d) < 1e-9) return null;
  const solve = (u0: number, u1: number, u2: number): [number, number, number] => {
    const a = ((u1 - u0) * (p2.y - p0.y) - (u2 - u0) * (p1.y - p0.y)) / d;
    const c = ((p1.x - p0.x) * (u2 - u0) - (p2.x - p0.x) * (u1 - u0)) / d;
    return [a, c, u0 - a * p0.x - c * p0.y];
  };
  const [a, c, e] = solve(q0.x, q1.x, q2.x), [bb, dd, f] = solve(q0.y, q1.y, q2.y);
  return [a, bb, c, dd, e, f];
}

export function derivedArt(n: GroupNode, outline = false): VNode[] | null {
  const live = liveArt(n, outline);
  if (live) return live;
  if (n.shaper) return outline ? n.children : shaperRegions(n).map((r) => r.node);
  if (n.intertwine) return outline ? n.children : [...n.children, ...intertwineOverlays(n)];
  return null;
}

export function transformShaper(s: ShaperSpec, m: Mat): ShaperSpec { return mapShaper(s, (p) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] })); }
