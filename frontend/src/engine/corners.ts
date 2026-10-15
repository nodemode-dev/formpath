import { bezPoint, bezSub, bezTangent, EPS, isLineSeg, segLength, segOf, segTAtLength, type Seg } from './geometry';
import type { Anchor, CornerSpec, PathData, Pt, SubPath } from './types';

export const CORNER_TYPES: ReadonlyArray<CornerSpec['type']> = ['round', 'inverted', 'chamfer'];

export interface CornerFrame { at: Pt; bis: Pt; theta: number; tmax: number }
export interface CornerFit { t: number; max: number; clamped: boolean }

export function cornerFrame(sp: SubPath, i: number): CornerFrame | null {
  const n = sp.pts.length;
  if (n < 3 || (!sp.closed && (i === 0 || i === n - 1))) return null;
  const a = sp.pts[i], s1 = segOf(sp.pts[(i - 1 + n) % n], a), s2 = segOf(a, sp.pts[(i + 1) % n]);
  const l1 = segLength(s1), l2 = segLength(s2);
  if (l1 < EPS * 10 || l2 < EPS * 10) return null;
  const d1 = bezTangent(s1, 1), u2 = bezTangent(s2, 0), u1 = { x: -d1.x, y: -d1.y };
  const theta = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y)));
  if (theta > Math.PI - 0.02 || theta < 0.02) return null;
  const bx = u1.x + u2.x, by = u1.y + u2.y, bl = Math.hypot(bx, by) || 1;
  return { at: { x: a.x, y: a.y }, bis: { x: bx / bl, y: by / bl }, theta, tmax: Math.min(l1, l2) / 2 };
}

export function cornerFit(f: CornerFrame, spec: CornerSpec): CornerFit {
  const tan = Math.tan(f.theta / 2), chamfer = spec.type === 'chamfer';
  const want = spec.mode === 'relative' ? Math.max(0, Math.min(1, spec.r)) * f.tmax : chamfer ? spec.r : spec.r / tan;
  return { t: Math.max(0, Math.min(want, f.tmax)), max: chamfer ? f.tmax : f.tmax * tan, clamped: want >= f.tmax - 1e-6 };
}

export function cornerRadiusFor(f: CornerFrame, spec: Pick<CornerSpec, 'type' | 'mode'>, t: number): number {
  const c = Math.max(0, Math.min(t, f.tmax));
  if (spec.mode === 'relative') return f.tmax > 0 ? c / f.tmax : 0;
  return spec.type === 'chamfer' ? c : c * Math.tan(f.theta / 2);
}

export function cornerAlong(f: CornerFrame, spec: CornerSpec): number {
  return cornerFit(f, spec).t / Math.cos(f.theta / 2);
}

export function tangentFromAlong(f: CornerFrame, along: number): number { return along * Math.cos(f.theta / 2); }

export function hasCorners(d: PathData): boolean {
  for (const sp of d) for (const a of sp.pts) if (a.corner && a.corner.r > 0) return true;
  return false;
}

const reflect = (q: Pt, a: Pt, b: Pt): Pt => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  if (l2 < EPS) return q;
  const k = ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2, px = a.x + dx * k, py = a.y + dy * k;
  return { x: 2 * px - q.x, y: 2 * py - q.y };
};

function bakeSub(sp: SubPath): SubPath {
  const n = sp.pts.length, joins = new Map<number, { f: CornerFrame; t: number; spec: CornerSpec }>();
  sp.pts.forEach((a, i) => {
    if (!a.corner || a.corner.r <= 0) return;
    const f = cornerFrame(sp, i);
    if (!f) return;
    const t = cornerFit(f, a.corner).t;
    if (t > EPS) joins.set(i, { f, t, spec: a.corner });
  });
  const segCount = sp.closed ? n : n - 1, subs: Seg[] = [];
  for (let j = 0; j < segCount; j++) {
    const k = (j + 1) % n, s = segOf(sp.pts[j], sp.pts[k]), js = joins.get(j), je = joins.get(k);
    const len = js || je ? segLength(s) : 0;
    const t0 = js ? segTAtLength(s, js.t) : 0, t1 = je ? segTAtLength(s, len - je.t) : 1;
    if (isLineSeg(s)) { const p0 = bezPoint(s, t0), p1 = bezPoint(s, t1); subs.push([p0, p0, p1, p1]); } else subs.push(bezSub(s, t0, t1));
  }
  const pts: Anchor[] = [];
  for (let i = 0; i < n; i++) {
    const a = sp.pts[i], inS = i > 0 ? subs[i - 1] : sp.closed ? subs[segCount - 1] : null, outS = i < segCount ? subs[i] : null, jn = joins.get(i);
    if (!jn || !inS || !outS) {
      const o: Anchor = { x: a.x, y: a.y, ix: inS ? inS[2].x : a.ix, iy: inS ? inS[2].y : a.iy, ox: outS ? outS[1].x : a.ox, oy: outS ? outS[1].y : a.oy };
      if (a.smooth) o.smooth = true;
      pts.push(o);
      continue;
    }
    const p1 = inS[3], p2 = outS[0], T1 = bezTangent(inS, 1), T2 = bezTangent(outS, 0);
    let q1: Pt = p1, q2: Pt = p2;
    if (jn.spec.type !== 'chamfer') {
      const r = jn.t * Math.tan(jn.f.theta / 2), k = (4 / 3) * Math.tan((Math.PI - jn.f.theta) / 4) * r;
      q1 = { x: p1.x + T1.x * k, y: p1.y + T1.y * k };
      q2 = { x: p2.x - T2.x * k, y: p2.y - T2.y * k };
      if (jn.spec.type === 'inverted') { q1 = reflect(q1, p1, p2); q2 = reflect(q2, p1, p2); }
    }
    pts.push({ x: p1.x, y: p1.y, ix: inS[2].x, iy: inS[2].y, ox: q1.x, oy: q1.y }, { x: p2.x, y: p2.y, ix: q2.x, iy: q2.y, ox: outS[1].x, oy: outS[1].y });
  }
  return { closed: sp.closed, pts };
}

const bakeCache = new WeakMap<PathData, PathData>();

export function cornered(d: PathData): PathData {
  let out = bakeCache.get(d);
  if (!out) {
    out = hasCorners(d) ? d.map((sp) => (sp.pts.some((a) => a.corner && a.corner.r > 0) ? bakeSub(sp) : sp)) : d;
    bakeCache.set(d, out);
  }
  return out;
}

export function stripCorners(d: PathData): PathData {
  return d.map((sp) => ({ closed: sp.closed, pts: sp.pts.map((a) => { if (!a.corner) return a; const { corner, ...rest } = a; void corner; return rest; }) }));
}
