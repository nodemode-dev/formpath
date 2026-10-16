import type { RayMesh, RaySurf, RayTexture } from './raytrace';
import type { Mesh } from './modelmesh';
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

export interface RayMap { x: number; y: number; w: number; h: number; tex: RayTexture }
export interface MatMap { tex: RayTexture; tw: number; th: number; rot: number; ox: number; oy: number }

export interface SurfExt { rays: Map<string, RaySurf>; mats: Map<string, MatMap | null> }

export function rayMesh(g: TraceGeom, solids: Solid[], map: RayMap | null = null, mat: MatMap | null = null, ext: SurfExt | null = null): RayMesh {
  const R = g.R, c = g.center, pos: number[] = [], nrm: number[] = [], obj: number[] = [], sol: number[] = [], uvs: number[] = [], uvOn: number[] = [], uvm: number[] = [], eps = Math.max(1e-6, g.size * 1e-4);
  const trig = new Map<MatMap, [number, number]>(), texList: RayTexture[] = [], texAt = new Map<MatMap, number>(), matIdx: number[] = [], surfArr: RaySurf[] = [], surfAt = new Map<string, number>(), sidx: number[] = [];
  const anyMat = !!mat || (!!ext && [...ext.mats.values()].some((m) => m !== null));
  const matUv = (mm: MatMap, s: number, t: number): void => {
    let tc = trig.get(mm);
    if (!tc) { const mr = (mm.rot * Math.PI) / 180; tc = [Math.cos(mr), Math.sin(mr)]; trig.set(mm, tc); }
    const a = s - mm.ox, b = t - mm.oy;
    uvm.push((a * tc[0] - b * tc[1]) / mm.tw + 0.5, (a * tc[1] + b * tc[0]) / mm.th + 0.5);
  };
  const texIndex = (mm: MatMap): number => { let i = texAt.get(mm); if (i === undefined) { i = texList.length; texList.push(mm.tex); texAt.set(mm, i); } return i; };
  const surfIndex = (id: string, r: RaySurf): number => { let i = surfAt.get(id); if (i === undefined) { i = surfArr.length; surfArr.push(r); surfAt.set(id, i); } return i; };
  const view = (v: V3): V3 => { const x = v[0] - c[0], y = v[1] - c[1], z = v[2] - c[2]; return [R[0] * x + R[1] * y + R[2] * z, R[3] * x + R[4] * y + R[5] * z, R[6] * x + R[7] * y + R[8] * z]; };
  const turn = (v: V3): V3 => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
  const colors = new Float32Array(Math.max(1, solids.length) * 3), index = new Map<Solid, number>();
  solids.forEach((s, i) => { index.set(s, i); const b = s.fill ?? s.stroke ?? [0.6, 0.6, 0.6]; colors[i * 3] = b[0]; colors[i * 3 + 1] = b[1]; colors[i * 3 + 2] = b[2]; });
  const emit = (si: number, a: V3, b: V3, d: V3, na: V3, nb: V3, nd: V3, textured = false, st?: Array<[number, number] | undefined>, sf?: string): void => {
    const mm = ext && sf !== undefined && ext.mats.has(sf) ? (ext.mats.get(sf) as MatMap | null) : mat, sr = ext && sf !== undefined ? ext.rays.get(sf) : undefined;
    for (const [v, n, k] of [[a, na, 0], [b, nb, 1], [d, nd, 2]] as Array<[V3, V3, number]>) {
      pos.push(...view(v)); nrm.push(...turn(n)); obj.push(v[0] - c[0], v[1] - c[1], v[2] - c[2]);
      if (anyMat) { if (mm) { const q = st?.[k]; if (q) matUv(mm, q[0], q[1]); else matUv(mm, v[0] - c[0], v[1] - c[1]); } else uvm.push(0, 0); }
      if (map) { if (textured) uvs.push((v[0] - map.x) / map.w, (v[1] - map.y) / map.h); else uvs.push(0, 0); }
    }
    if (map) uvOn.push(textured ? 1 : 0);
    if (ext) { sidx.push(sr && sf !== undefined ? surfIndex(sf, sr) : -1); if (anyMat) matIdx.push(mm ? texIndex(mm) : -1); }
    sol.push(si);
  };
  const facing = R[8] >= 0;
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
    const keep = (raw.rings ?? []).flatMap((r, i) => (r.length > 2 ? [i] : [])), rings = keep.map((i) => (raw.rings as V3[][])[i]), n0 = raw.normal;
    if (!rings.length) continue;
    const helper: V3 = Math.abs(n0[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = unit(cross(helper, n0)), e2 = cross(n0, e1);
    const pts = rings.map((r) => r.map((v) => [dot(v, e1), dot(v, e2)] as [number, number]));
    const insideRing = (p: [number, number], r: Array<[number, number]>): boolean => { let o = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) o = !o; } return o; };
    const depth = pts.map((r, i) => pts.reduce((k, o, j) => (j !== i && insideRing(r[0], o) ? k + 1 : k), 0));
    const parent = pts.map((r, i) => { let best = -1; pts.forEach((o, j) => { if (j !== i && depth[j] === depth[i] - 1 && insideRing(r[0], o)) best = j; }); return best; });
    pts.forEach((_, i) => {
      if (depth[i] % 2) return;
      const group = [i, ...pts.map((__, j) => j).filter((j) => depth[j] % 2 === 1 && parent[j] === i)], xs: number[] = [], ys: number[] = [], vs: V3[] = [], holes: number[] = [], sts: Array<[number, number] | undefined> = [];
      group.forEach((r, gi) => { if (gi) holes.push(xs.length); pts[r].forEach((p, k) => { xs.push(p[0]); ys.push(p[1]); vs.push(rings[r][k]); sts.push(raw.ruv?.[keep[r]]?.[k]); }); });
      const tris = triangulate(xs, ys, pts[i].length, holes);
      const art = !!map && raw.role === 'front' && facing;
      for (let t = 0; t < tris.length; t += 3) emit(si, vs[tris[t]], vs[tris[t + 1]], vs[tris[t + 2]], n0, n0, n0, art, [sts[tris[t]], sts[tris[t + 1]], sts[tris[t + 2]]], raw.surf);
    });
  }
  for (const q of sides) {
    const P = q.raw.pts, N = P.map((p) => {
      const l = at.get(key(q.si, p)) ?? [];
      let x = 0, y = 0, z = 0;
      for (const o of l) { const m = sides[o].n; if (dot(m, q.n) > 0.84) { x += m[0]; y += m[1]; z += m[2]; } }
      return Math.hypot(x, y, z) > 1e-9 ? unit([x, y, z]) : q.n;
    });
    const U = q.raw.uv, at4 = (i: number): [number, number] | undefined => (U ? [U[i * 2], U[i * 2 + 1]] : undefined);
    emit(q.si, P[0], P[1], P[2], N[0], N[1], N[2], false, [at4(0), at4(1), at4(2)], q.raw.surf);
    emit(q.si, P[0], P[2], P[3], N[0], N[2], N[3], false, [at4(0), at4(2), at4(3)], q.raw.surf);
  }
  const mesh: RayMesh = { tris: sol.length, pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), obj: Float32Array.from(obj), solid: Int32Array.from(sol), colors };
  if (map) { mesh.uv = Float32Array.from(uvs); mesh.uvOn = Uint8Array.from(uvOn); mesh.tex = map.tex; }
  if (ext) {
    mesh.surfs = surfArr; mesh.sidx = Int32Array.from(sidx);
    if (anyMat) { mesh.uvm = Float32Array.from(uvm); mesh.mats = texList; mesh.matOf = Int32Array.from(matIdx); }
  } else if (mat) { mesh.uvm = Float32Array.from(uvm); mesh.mat = mat.tex; }
  return mesh;
}

export function modelRayMesh(mesh: Mesh, R: number[], k: number, ext: SurfExt | null, textures: Map<number, MatMap>): RayMesh {
  const nv = mesh.pos.length / 3, nt = mesh.idx.length / 3, pos = new Float32Array(nt * 9), nrm = new Float32Array(nt * 9), obj = new Float32Array(nt * 9), solid = new Int32Array(nt), uvm = mesh.uv ? new Float32Array(nt * 6) : null;
  const colors = new Float32Array(Math.max(1, mesh.groups.length) * 3), surfArr: RaySurf[] = [], sidx = new Int32Array(nt), texList: RayTexture[] = [], texAt = new Map<number, number>(), matOf = new Int32Array(nt).fill(-1);
  mesh.groups.forEach((g, i) => { colors[i * 3] = g.color[0]; colors[i * 3 + 1] = g.color[1]; colors[i * 3 + 2] = g.color[2]; });
  const surfAt = new Map<number, number>();
  void nv;
  for (let t = 0; t < nt; t++) {
    const gi = mesh.grp[t];
    solid[t] = gi;
    const sr = ext?.rays.get(`g${gi}`);
    if (sr) { let i = surfAt.get(gi); if (i === undefined) { i = surfArr.length; surfArr.push(sr); surfAt.set(gi, i); } sidx[t] = i; } else sidx[t] = -1;
    const tx = textures.get(gi);
    if (tx && uvm) { let i = texAt.get(gi); if (i === undefined) { i = texList.length; texList.push(tx.tex); texAt.set(gi, i); } matOf[t] = i; }
    for (let c = 0; c < 3; c++) {
      const v = mesh.idx[t * 3 + c], px = mesh.pos[v * 3] * k, py = mesh.pos[v * 3 + 1] * k, pz = mesh.pos[v * 3 + 2] * k, qx = mesh.nrm[v * 3], qy = mesh.nrm[v * 3 + 1], qz = mesh.nrm[v * 3 + 2], o = t * 9 + c * 3;
      pos[o] = R[0] * px + R[1] * py + R[2] * pz; pos[o + 1] = R[3] * px + R[4] * py + R[5] * pz; pos[o + 2] = R[6] * px + R[7] * py + R[8] * pz;
      nrm[o] = R[0] * qx + R[1] * qy + R[2] * qz; nrm[o + 1] = R[3] * qx + R[4] * qy + R[5] * qz; nrm[o + 2] = R[6] * qx + R[7] * qy + R[8] * qz;
      obj[o] = px; obj[o + 1] = py; obj[o + 2] = pz;
      if (uvm && mesh.uv) { uvm[t * 6 + c * 2] = mesh.uv[v * 2]; uvm[t * 6 + c * 2 + 1] = mesh.uv[v * 2 + 1]; }
    }
  }
  const out: RayMesh = { tris: nt, pos, nrm, obj, solid, colors, surfs: surfArr, sidx };
  if (uvm && texList.length) { out.uvm = uvm; out.mats = texList; out.matOf = matOf; }
  return out;
}
