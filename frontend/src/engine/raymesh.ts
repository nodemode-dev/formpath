import type { RayMesh } from './raytrace';
import type { Raw, Solid, TraceGeom, V3 } from './threed';

interface Nd { i: number; x: number; y: number; prev: Nd; next: Nd }

const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

const area = (p: Nd, q: Nd, r: Nd): number => (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
const same = (a: Nd, b: Nd): boolean => a.x === b.x && a.y === b.y;
const inTri = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, px: number, py: number): boolean => (cx - px) * (ay - py) >= (ax - px) * (cy - py) && (ax - px) * (by - py) >= (bx - px) * (ay - py) && (bx - px) * (cy - py) >= (cx - px) * (by - py);

function link(xs: number[], ys: number[], from: number, to: number, cw: boolean): Nd | null {
  let sum = 0;
  for (let i = from, j = to - 1; i < to; j = i++) sum += (xs[j] - xs[i]) * (ys[i] + ys[j]);
  let last: Nd | null = null;
  const add = (i: number): void => {
    const n = { i, x: xs[i], y: ys[i] } as Nd;
    if (!last) { n.prev = n; n.next = n; } else { n.next = last.next; n.prev = last; last.next.prev = n; last.next = n; }
    last = n;
  };
  if (cw === sum > 0) for (let i = from; i < to; i++) add(i); else for (let i = to - 1; i >= from; i--) add(i);
  const l = last as Nd | null;
  if (l && same(l, l.next)) { drop(l); return l.next; }
  return l;
}

function drop(p: Nd): void { p.next.prev = p.prev; p.prev.next = p.next; }

function clean(start: Nd | null, end?: Nd): Nd | null {
  if (!start) return start;
  let e = end ?? start, p = start, again: boolean;
  do {
    again = false;
    if (same(p, p.next) || area(p.prev, p, p.next) === 0) { drop(p); p = e = p.prev; if (p === p.next) break; again = true; } else p = p.next;
  } while (again || p !== e);
  return e;
}

function isEar(ear: Nd): boolean {
  const a = ear.prev, b = ear, c = ear.next;
  if (area(a, b, c) >= 0) return false;
  const x0 = Math.min(a.x, b.x, c.x), y0 = Math.min(a.y, b.y, c.y), x1 = Math.max(a.x, b.x, c.x), y1 = Math.max(a.y, b.y, c.y);
  for (let p = c.next; p !== a; p = p.next) if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && !(a.x === p.x && a.y === p.y) && inTri(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
  return true;
}

function clip(start: Nd, out: number[]): void {
  let ear = start, stop = start, force = false;
  while (ear.prev !== ear.next) {
    const prev = ear.prev, next = ear.next;
    if (force || isEar(ear)) { out.push(prev.i, ear.i, next.i); drop(ear); ear = next.next; stop = next.next; force = false; continue; }
    ear = next;
    if (ear === stop) force = true;
  }
}

function inside(a: Nd, b: Nd): boolean {
  return area(a.prev, a, a.next) < 0 ? area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 : area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
}

function bridge(hole: Nd, outer: Nd): Nd | null {
  let p = outer, qx = -Infinity, m: Nd | null = null;
  const hx = hole.x, hy = hole.y;
  do {
    if (same(hole, p)) return p;
    if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
      const x = p.x + ((hy - p.y) * (p.next.x - p.x)) / (p.next.y - p.y);
      if (x <= hx && x > qx) { qx = x; m = p.x < p.next.x ? p : p.next; if (x === hx) return m; }
    }
    p = p.next;
  } while (p !== outer);
  if (!m) return null;
  const stop = m, mx = m.x, my = m.y;
  let tanMin = Infinity;
  p = m;
  do {
    if (hx >= p.x && p.x >= mx && hx !== p.x && inTri(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {
      const tan = Math.abs(hy - p.y) / (hx - p.x);
      if (inside(p, hole) && (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0))))) { m = p; tanMin = tan; }
    }
    p = p.next;
  } while (p !== stop);
  return m;
}

function split(a: Nd, b: Nd): Nd {
  const a2 = { i: a.i, x: a.x, y: a.y } as Nd, b2 = { i: b.i, x: b.x, y: b.y } as Nd, an = a.next, bp = b.prev;
  a.next = b; b.prev = a; a2.next = an; an.prev = a2; b2.next = a2; a2.prev = b2; bp.next = b2; b2.prev = bp;
  return b2;
}

export function triangulate(xs: number[], ys: number[], outerLen: number, holes: number[]): number[] {
  const out: number[] = [];
  let outer = link(xs, ys, 0, outerLen, true);
  if (!outer || outer.next === outer.prev) return out;
  if (holes.length) {
    const queue: Nd[] = [];
    for (let h = 0; h < holes.length; h++) {
      const list = link(xs, ys, holes[h], h < holes.length - 1 ? holes[h + 1] : xs.length, false);
      if (!list) continue;
      let left = list;
      for (let p = list.next; p !== list; p = p.next) if (p.x < left.x || (p.x === left.x && p.y < left.y)) left = p;
      queue.push(left);
    }
    queue.sort((a, b) => a.x - b.x);
    for (const hole of queue) {
      const br = bridge(hole, outer);
      if (!br) continue;
      const rev = split(br, hole);
      clean(rev, rev.next);
      outer = clean(br, br.next) ?? outer;
    }
  }
  clip(outer, out);
  return out;
}

export function rayMesh(g: TraceGeom, solids: Solid[]): RayMesh {
  const R = g.R, c = g.center, pos: number[] = [], nrm: number[] = [], obj: number[] = [], sol: number[] = [], eps = Math.max(1e-6, g.size * 1e-4);
  const view = (v: V3): V3 => { const x = v[0] - c[0], y = v[1] - c[1], z = v[2] - c[2]; return [R[0] * x + R[1] * y + R[2] * z, R[3] * x + R[4] * y + R[5] * z, R[6] * x + R[7] * y + R[8] * z]; };
  const turn = (v: V3): V3 => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
  const colors = new Float32Array(Math.max(1, solids.length) * 3), index = new Map<Solid, number>();
  solids.forEach((s, i) => { index.set(s, i); const b = s.fill ?? s.stroke ?? [0.6, 0.6, 0.6]; colors[i * 3] = b[0]; colors[i * 3 + 1] = b[1]; colors[i * 3 + 2] = b[2]; });
  const emit = (si: number, a: V3, b: V3, d: V3, na: V3, nb: V3, nd: V3): void => {
    for (const [v, n] of [[a, na], [b, nb], [d, nd]] as Array<[V3, V3]>) { pos.push(...view(v)); nrm.push(...turn(n)); obj.push(v[0] - c[0], v[1] - c[1], v[2] - c[2]); }
    sol.push(si);
  };
  const sides: Array<{ raw: Raw; n: V3; si: number }> = [], at = new Map<string, number[]>();
  const key = (si: number, p: V3): string => `${si}|${Math.round(p[0] / eps)}|${Math.round(p[1] / eps)}|${Math.round(p[2] / eps)}`;
  for (const raw of g.raws) {
    const si = index.get(raw.solid) ?? 0;
    if (!raw.cap) {
      let n = raw.normal;
      if (!(n[0] || n[1] || n[2])) continue;
      if (raw.hint && dot(n, raw.hint) < 0) n = [-n[0], -n[1], -n[2]];
      const qi = sides.length;
      sides.push({ raw, n, si });
      for (const p of raw.pts) { const k = key(si, p), l = at.get(k); if (l) { if (l[l.length - 1] !== qi) l.push(qi); } else at.set(k, [qi]); }
      continue;
    }
    const rings = (raw.rings ?? []).filter((r) => r.length > 2), n0 = raw.normal;
    if (!rings.length) continue;
    const helper: V3 = Math.abs(n0[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = unit(cross(helper, n0)), e2 = cross(n0, e1);
    const pts = rings.map((r) => r.map((v) => [dot(v, e1), dot(v, e2)] as [number, number]));
    const insideRing = (p: [number, number], r: Array<[number, number]>): boolean => { let o = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) o = !o; } return o; };
    const depth = pts.map((r, i) => pts.reduce((k, o, j) => (j !== i && insideRing(r[0], o) ? k + 1 : k), 0));
    const parent = pts.map((r, i) => { let best = -1; pts.forEach((o, j) => { if (j !== i && depth[j] === depth[i] - 1 && insideRing(r[0], o)) best = j; }); return best; });
    pts.forEach((_, i) => {
      if (depth[i] % 2) return;
      const group = [i, ...pts.map((__, j) => j).filter((j) => depth[j] % 2 === 1 && parent[j] === i)], xs: number[] = [], ys: number[] = [], vs: V3[] = [], holes: number[] = [];
      group.forEach((r, gi) => { if (gi) holes.push(xs.length); pts[r].forEach((p, k) => { xs.push(p[0]); ys.push(p[1]); vs.push(rings[r][k]); }); });
      const tris = triangulate(xs, ys, pts[i].length, holes);
      for (let t = 0; t < tris.length; t += 3) emit(si, vs[tris[t]], vs[tris[t + 1]], vs[tris[t + 2]], n0, n0, n0);
    });
  }
  for (const q of sides) {
    const P = q.raw.pts, N = P.map((p) => {
      const l = at.get(key(q.si, p)) ?? [];
      let x = 0, y = 0, z = 0;
      for (const o of l) { const m = sides[o].n; if (dot(m, q.n) > 0.84) { x += m[0]; y += m[1]; z += m[2]; } }
      return Math.hypot(x, y, z) > 1e-9 ? unit([x, y, z]) : q.n;
    });
    emit(q.si, P[0], P[1], P[2], N[0], N[1], N[2]);
    emit(q.si, P[0], P[2], P[3], N[0], N[2], N[3]);
  }
  return { tris: sol.length, pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), obj: Float32Array.from(obj), solid: Int32Array.from(sol), colors };
}
