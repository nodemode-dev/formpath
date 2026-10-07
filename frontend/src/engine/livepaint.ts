import { childrenOf } from './doc';
import { flattenSub, pointInPolygon, translatePath } from './geometry';
import { fill as fillItem } from './paint';
import type { GroupNode, Paint, PathData, PathNode, Pt, SubPath, VNode } from './types';

export interface LiveFace { d: PathData; polys: Pt[][] }

export function edgePaths(nodes: VNode[]): SubPath[] {
  const out: SubPath[] = [];
  const walk = (n: VNode): void => {
    if (n.hidden) return;
    if (n.kind === 'path') { if (!n.guide) out.push(...n.d.filter((sp) => sp.pts.length > 1)); return; }
    if (n.kind === 'compound') { n.children.forEach(walk); return; }
    childrenOf(n)?.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

function nearestOn(poly: Pt[], p: Pt): { q: Pt; d: number } {
  let best = { q: poly[0], d: Infinity };
  for (let i = 0; i + 1 < poly.length; i++) {
    const a = poly[i], b = poly[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    const q = { x: a.x + dx * t, y: a.y + dy * t }, d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < best.d) best = { q, d };
  }
  return best;
}

export function gapClosers(edges: SubPath[], gap: number): Array<[Pt, Pt]> {
  if (!(gap > 0)) return [];
  const polys = edges.map((sp) => { const f = flattenSub(sp, 0.5); return sp.closed && f.length ? [...f, f[0]] : f; });
  const out: Array<[Pt, Pt]> = [];
  edges.forEach((sp, i) => {
    if (sp.closed) return;
    const ends = [sp.pts[0], sp.pts[sp.pts.length - 1]];
    ends.forEach((e, k) => {
      let best: { q: Pt; d: number } | null = null;
      polys.forEach((poly, j) => { if (j === i || poly.length < 2) return; const r = nearestOn(poly, e); if (r.d > 1e-6 && r.d <= gap && (!best || r.d < best.d)) best = r; });
      const other = ends[1 - k], self = Math.hypot(other.x - e.x, other.y - e.y);
      if (k === 0 && self > 1e-6 && self <= gap && (!best || self < (best as { d: number }).d)) best = { q: other, d: self };
      if (best) out.push([{ x: e.x, y: e.y }, (best as { q: Pt }).q]);
    });
  });
  return out;
}

const SNAP = 1000;
const signedArea = (p: Pt[]): number => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q.x * r.y - r.x * q.y; } return a / 2; };

function cutSegments(segs: Array<[Pt, Pt]>): Array<[Pt, Pt]> {
  const cuts = segs.map(() => [0, 1]);
  const box = segs.map(([a, b]) => ({ x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) }));
  const order = segs.map((_, i) => i).sort((i, j) => box[i].x0 - box[j].x0);
  const E = 1e-9;
  for (let oi = 0; oi < order.length; oi++) {
    const i = order[oi], [p, p2] = segs[i], rx = p2.x - p.x, ry = p2.y - p.y;
    for (let oj = oi + 1; oj < order.length; oj++) {
      const j = order[oj];
      if (box[j].x0 > box[i].x1 + 1e-6) break;
      if (box[j].y0 > box[i].y1 + 1e-6 || box[j].y1 < box[i].y0 - 1e-6) continue;
      const [q, q2] = segs[j], sx = q2.x - q.x, sy = q2.y - q.y, qpx = q.x - p.x, qpy = q.y - p.y, d = rx * sy - ry * sx;
      if (Math.abs(d) < E) {
        if (Math.abs(qpx * ry - qpy * rx) > 1e-6 * Math.hypot(rx, ry)) continue;
        const rr = rx * rx + ry * ry, ss = sx * sx + sy * sy;
        if (rr > E) for (const v of [q, q2]) { const t = ((v.x - p.x) * rx + (v.y - p.y) * ry) / rr; if (t > E && t < 1 - E) cuts[i].push(t); }
        if (ss > E) for (const v of [p, p2]) { const u = ((v.x - q.x) * sx + (v.y - q.y) * sy) / ss; if (u > E && u < 1 - E) cuts[j].push(u); }
        continue;
      }
      const t = (qpx * sy - qpy * sx) / d, u = (qpx * ry - qpy * rx) / d;
      if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) continue;
      cuts[i].push(Math.max(0, Math.min(1, t)));
      cuts[j].push(Math.max(0, Math.min(1, u)));
    }
  }
  const out: Array<[Pt, Pt]> = [];
  segs.forEach(([a, b], i) => {
    const ts = [...new Set(cuts[i])].sort((x, y) => x - y);
    for (let k = 0; k + 1 < ts.length; k++) out.push([{ x: a.x + (b.x - a.x) * ts[k], y: a.y + (b.y - a.y) * ts[k] }, { x: a.x + (b.x - a.x) * ts[k + 1], y: a.y + (b.y - a.y) * ts[k + 1] }]);
  });
  return out;
}

export function planarFaces(lines: Pt[][]): LiveFace[] {
  const segs: Array<[Pt, Pt]> = [];
  for (const l of lines) for (let i = 0; i + 1 < l.length; i++) if (Math.hypot(l[i + 1].x - l[i].x, l[i + 1].y - l[i].y) > 1e-6) segs.push([l[i], l[i + 1]]);
  const ids = new Map<string, number>(), pts: Pt[] = [];
  const vid = (p: Pt): number => { const k = `${Math.round(p.x * SNAP)}:${Math.round(p.y * SNAP)}`; let v = ids.get(k); if (v === undefined) { v = pts.length; ids.set(k, v); pts.push({ x: Math.round(p.x * SNAP) / SNAP, y: Math.round(p.y * SNAP) / SNAP }); } return v; };
  const adj = new Map<number, Set<number>>();
  const link = (a: number, b: number): void => { if (a === b) return; (adj.get(a) ?? adj.set(a, new Set()).get(a) as Set<number>).add(b); (adj.get(b) ?? adj.set(b, new Set()).get(b) as Set<number>).add(a); };
  for (const [a, b] of cutSegments(segs)) link(vid(a), vid(b));
  const stack = [...adj.keys()].filter((v) => (adj.get(v)?.size ?? 0) < 2);
  while (stack.length) { const v = stack.pop() as number, ns = adj.get(v); if (!ns) continue; for (const w of ns) { const m = adj.get(w); m?.delete(v); if (m && m.size < 2) stack.push(w); } adj.delete(v); }
  const ring = new Map<number, number[]>();
  for (const [v, ns] of adj) ring.set(v, [...ns].sort((a, b) => Math.atan2(pts[a].y - pts[v].y, pts[a].x - pts[v].x) - Math.atan2(pts[b].y - pts[v].y, pts[b].x - pts[v].x)));
  const seen = new Set<string>(), bounded: Pt[][] = [], outer: Pt[][] = [];
  for (const [u, ns] of ring) for (const v0 of ns) {
    if (seen.has(`${u}>${v0}`)) continue;
    const cyc: Pt[] = [];
    let a = u, b = v0, guard = 0;
    while (!seen.has(`${a}>${b}`) && guard++ < 1e6) {
      seen.add(`${a}>${b}`);
      cyc.push(pts[a]);
      const r = ring.get(b) as number[], i = r.indexOf(a), c = r[(i - 1 + r.length) % r.length];
      a = b; b = c;
    }
    const area = signedArea(cyc);
    if (area > 1e-6) bounded.push(cyc); else if (area < -1e-6) outer.push(cyc);
  }
  const holes = bounded.map(() => [] as Pt[][]), area = bounded.map((f) => signedArea(f));
  for (const o of outer) {
    let best = -1;
    bounded.forEach((f, i) => { if (area[i] > -signedArea(o) - 1e-6 && pointInPolygon(o[0], f) !== 0 && !f.includes(o[0]) && (best < 0 || area[i] < area[best])) best = i; });
    if (best >= 0) holes[best].push(o);
  }
  return bounded.map((f, i) => { const polys = [f, ...holes[i]]; return { polys, d: polys.map((p) => ({ closed: true, pts: p.map((q) => ({ x: q.x, y: q.y, ix: q.x, iy: q.y, ox: q.x, oy: q.y })) })) }; });
}

export function computeFaces(nodes: VNode[], gap: number): LiveFace[] {
  const edges = edgePaths(nodes);
  if (!edges.length) return [];
  const lines = edges.map((sp) => { const f = flattenSub(sp, 0.1); return sp.closed && f.length ? [...f, f[0]] : f; });
  for (const [a, b] of gapClosers(edges, gap)) lines.push([a, b]);
  return planarFaces(lines);
}

const flat = (nodes: VNode[]): number[] => { const out: number[] = []; for (const sp of edgePaths(nodes)) for (const a of sp.pts) out.push(a.x, a.y, a.ix, a.iy, a.ox, a.oy); return out; };
const byChildren = new WeakMap<VNode[], Map<number, LiveFace[]>>();
const lastByGroup = new Map<string, { flat: number[]; gap: number; faces: LiveFace[] }>();

export function liveFaces(n: GroupNode): LiveFace[] {
  const gap = n.livePaint?.gap ?? 0;
  let m = byChildren.get(n.children);
  const hit = m?.get(gap);
  if (hit) return hit;
  const f = flat(n.children), last = lastByGroup.get(n.id);
  let faces: LiveFace[] | null = null;
  if (last && last.gap === gap && last.flat.length === f.length && f.length >= 2) {
    const dx = f[0] - last.flat[0], dy = f[1] - last.flat[1];
    let same = true;
    for (let i = 0; i < f.length && same; i += 2) same = Math.abs(f[i] - last.flat[i] - dx) < 1e-6 && Math.abs(f[i + 1] - last.flat[i + 1] - dy) < 1e-6;
    if (same) faces = last.faces.map((x) => ({ d: translatePath(x.d, dx, dy), polys: x.polys.map((p) => p.map((q) => ({ x: q.x + dx, y: q.y + dy }))) }));
  }
  if (!faces) { try { faces = computeFaces(n.children, gap); } catch { faces = []; } }
  if (!m) { m = new Map(); byChildren.set(n.children, m); }
  m.set(gap, faces);
  lastByGroup.set(n.id, { flat: f, gap, faces });
  if (lastByGroup.size > 64) lastByGroup.delete(lastByGroup.keys().next().value as string);
  return faces;
}

export const faceContains = (f: LiveFace, p: Pt): boolean => f.polys.reduce((k, poly) => k + (pointInPolygon(p, poly) !== 0 ? 1 : 0), 0) % 2 === 1;

export function faceAt(n: GroupNode, p: Pt): number { return liveFaces(n).findIndex((f) => faceContains(f, p)); }

const nodesCache = new WeakMap<LiveFace[], WeakMap<object, PathNode[]>>();
export function liveFaceNodes(n: GroupNode): PathNode[] {
  const lp = n.livePaint;
  if (!lp) return [];
  const faces = liveFaces(n);
  let m = nodesCache.get(faces);
  const hit = m?.get(lp.fills);
  if (hit) return hit;
  const paints = faces.map((f) => { let p: Paint | null = null; for (const s of lp.fills) if (faceContains(f, s.at)) p = s.paint; return p; });
  const out: PathNode[] = [];
  faces.forEach((f, i) => { const p = paints[i]; if (p && p.type !== 'none') out.push({ id: `${n.id}~f${i}`, kind: 'path', d: f.d, rule: 'evenodd', opacity: 1, blend: 'normal', ap: { items: [fillItem(p)], effects: [] }, name: 'Face' }); });
  if (!m) { m = new WeakMap(); nodesCache.set(faces, m); }
  m.set(lp.fills, out);
  return out;
}

export function interiorOf(f: LiveFace): Pt {
  const all = f.polys.flat(), y0 = Math.min(...all.map((q) => q.y)), y1 = Math.max(...all.map((q) => q.y));
  let best: Pt | null = null, wide = 0;
  for (const k of [0.5, 0.3, 0.7, 0.15, 0.85, 0.4, 0.6]) {
    const y = y0 + (y1 - y0) * k + 1e-7, xs: number[] = [];
    for (const poly of f.polys) for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if ((a.y <= y) !== (b.y <= y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x)); }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > wide) { wide = xs[i + 1] - xs[i]; best = { x: (xs[i] + xs[i + 1]) / 2, y }; }
    if (best && wide > 1) return best;
  }
  return best ?? all[0] ?? { x: 0, y: 0 };
}
