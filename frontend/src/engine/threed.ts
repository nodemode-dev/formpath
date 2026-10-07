import { anchor, emptyRect, flattenSub, pathBounds, unionRect } from './geometry';
import { parseColor, toRgb } from './paint';
import type { Effect, FillRule, PathData, Pt } from './types';

export type RGB3 = [number, number, number];
type V3 = [number, number, number];
type Params = Effect['params'];
export interface Solid { d: PathData; rule: FillRule; fill: RGB3 | null; stroke: RGB3 | null; strokeWidth: number }
export interface Face { d: PathData; rule: FillRule; fill: RGB3 | null; stroke: RGB3 | null; strokeWidth: number; depth: number; solid: number; cap: boolean; t: number; s: number }
export interface Lighting { light: V3; intensity: number; ambient: number; highlight: number; shade: RGB3; material: string }

export const VECTOR_3D = new Set(['3d.extrude', '3d.revolve', '3d.rotate']);
export const ROTATION_PRESETS: Record<string, V3> = {
  off_axis_front: [-18, -26, 8], off_axis_back: [-18, 154, -8], off_axis_left: [-18, -64, 8], off_axis_right: [-18, 64, -8], off_axis_top: [-72, -26, 8], off_axis_bottom: [72, -26, -8],
  front: [0, 0, 0], back: [0, 180, 0], left: [0, -90, 0], right: [0, 90, 0], top: [-90, 0, 0], bottom: [90, 0, 0],
  isometric_left: [-35.26, -45, 30], isometric_right: [-35.26, 45, -30], isometric_top: [-54.74, 0, 45], isometric_bottom: [54.74, 0, -45],
};
const LIGHT_DIRS: Record<string, V3> = { top_left: [-1, -1, -1.2], top: [0, -1, -1.2], top_right: [1, -1, -1.2], left: [-1, 0, -1.2], front: [0, 0, -1], right: [1, 0, -1.2], bottom_left: [-1, 1, -1.2], bottom: [0, 1, -1.2], bottom_right: [1, 1, -1.2] };

const num = (p: Params, k: string, d: number): number => { const v = p[k]; return typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : d; };
const str = (p: Params, k: string, d: string): string => (typeof p[k] === 'string' ? (p[k] as string) : d);
const flag = (p: Params, k: string, d: boolean): boolean => (typeof p[k] === 'boolean' ? (p[k] as boolean) : d);
const clamp = (v: number, lo = 0, hi = 1): number => (v < lo ? lo : v > hi ? hi : v);
const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export function rgbParam(p: Params, k: string, d: string): RGB3 {
  const c = parseColor(str(p, k, d)) ?? parseColor(d);
  const v = c ? toRgb(c) : { r: 0, g: 0, b: 0 };
  return [v.r / 255, v.g / 255, v.b / 255];
}

export function lighting(p: Params): Lighting {
  return { light: norm(LIGHT_DIRS[str(p, 'light', 'top_left')] ?? LIGHT_DIRS.top_left), intensity: num(p, 'intensity', 100) / 100, ambient: num(p, 'ambient', 40) / 100, highlight: num(p, 'highlight', 60) / 100, shade: rgbParam(p, 'shading_color', '#000000'), material: str(p, 'material', 'plastic') };
}

export function shadeRgb(base: RGB3, n: V3, L: Lighting): RGB3 {
  if (L.material === 'flat') return base;
  const diffuse = Math.max(0, dot(n, L.light)), h = norm([L.light[0], L.light[1], L.light[2] - 1]), nh = Math.max(0, dot(n, h));
  if (L.material === 'metal') {
    const k = clamp(0.3 * L.ambient + 0.75 * diffuse * L.intensity), s = Math.pow(nh, 14) * L.highlight * 1.4;
    return [clamp(base[0] * k + base[0] * s + s * 0.25), clamp(base[1] * k + base[1] * s + s * 0.25), clamp(base[2] * k + base[2] * s + s * 0.25)];
  }
  const t = clamp(L.ambient + (1 - L.ambient) * diffuse * L.intensity), s = L.material === 'matte' ? 0 : Math.pow(nh, 36) * L.highlight;
  const c: RGB3 = [L.shade[0] + (base[0] - L.shade[0]) * t, L.shade[1] + (base[1] - L.shade[1]) * t, L.shade[2] + (base[2] - L.shade[2]) * t];
  return [clamp(c[0] + (1 - c[0]) * s), clamp(c[1] + (1 - c[1]) * s), clamp(c[2] + (1 - c[2]) * s)];
}

export function lightFactors(n: V3, L: Lighting): { t: number; s: number } {
  if (L.material === 'flat' || L.material === 'wireframe') return { t: 1, s: 0 };
  const diffuse = Math.max(0, dot(n, L.light)), h = norm([L.light[0], L.light[1], L.light[2] - 1]), nh = Math.max(0, dot(n, h));
  if (L.material === 'metal') return { t: clamp(0.3 * L.ambient + 0.75 * diffuse * L.intensity), s: clamp(Math.pow(nh, 14) * L.highlight * 0.6) };
  return { t: clamp(L.ambient + (1 - L.ambient) * diffuse * L.intensity), s: L.material === 'matte' ? 0 : clamp(Math.pow(nh, 36) * L.highlight) };
}

function rotation(rx: number, ry: number, rz: number): number[] {
  const [a, b, c] = [rx, ry, rz].map((v) => (v * Math.PI) / 180), ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  const X = [1, 0, 0, 0, ca, -sa, 0, sa, ca], Y = [cb, 0, sb, 0, 1, 0, -sb, 0, cb], Z = [cc, -sc, 0, sc, cc, 0, 0, 0, 1];
  const m = (p: number[], q: number[]): number[] => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => p[i * 3] * q[j] + p[i * 3 + 1] * q[3 + j] + p[i * 3 + 2] * q[6 + j]));
  return m(X, m(Y, Z));
}
const rot = (m: number[], v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

const area = (pts: Pt[]): number => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; } return s / 2; };

function inset(pts: Pt[], d: number, sign: number): Pt[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const e1 = norm([p.x - a.x, p.y - a.y, 0]), e2 = norm([b.x - p.x, b.y - p.y, 0]);
    const n1: V3 = [e1[1] * sign, -e1[0] * sign, 0], n2: V3 = [e2[1] * sign, -e2[0] * sign, 0], m = norm([n1[0] + n2[0], n1[1] + n2[1], 0]);
    const c = Math.max(0.35, dot(m, n2)), k = Math.min(d / c, d * 3);
    return { x: p.x - m[0] * k, y: p.y - m[1] * k };
  });
}

interface Raw { pts: V3[]; normal: V3; solid: Solid; cap: boolean; rings?: V3[][]; role?: 'front' | 'back' }

export function scene3d(solids: Solid[], e: Effect): Face[] {
  const p = e.params, kind = e.id;
  let b = emptyRect();
  for (const s of solids) b = unionRect(b, pathBounds(s.d));
  if (!Number.isFinite(b.x)) return [];
  const size = Math.max(b.w, b.h, 1), tol = Math.max(0.2, size / 300), raws: Raw[] = [];
  const polys = (s: Solid): Array<{ pts: Pt[]; closed: boolean }> => s.d.map((sp) => ({ pts: flattenSub(sp, tol), closed: sp.closed })).filter((q) => q.pts.length > 1);
  let center: V3 = [b.x + b.w / 2, b.y + b.h / 2, 0];
  if (kind === '3d.extrude' || kind === '3d.rotate') {
    const depth = kind === '3d.rotate' ? 0 : Math.max(0, num(p, 'depth', 50)), caps = kind === '3d.rotate' || flag(p, 'cap', true);
    const bevel = kind === '3d.extrude' ? str(p, 'bevel', 'none') : 'none', bh = bevel === 'none' ? 0 : Math.min(Math.max(0, num(p, 'bevel_height', 4)), depth / 2, Math.min(b.w, b.h) * 0.25);
    center = [b.x + b.w / 2, b.y + b.h / 2, depth / 2];
    for (const s of solids) {
      const list = polys(s);
      const outer = list.reduce((m, q) => (Math.abs(area(q.pts)) > Math.abs(m) ? area(q.pts) : m), 0), sign = outer >= 0 ? 1 : -1;
      const steps = bh > 0 ? (bevel === 'rounded' ? 4 : 1) : 0;
      const ring = (pts: Pt[], k: number): { pts: Pt[]; z: number } => { if (!steps) return { pts, z: 0 }; const t = k / steps, th = (t * Math.PI) / 2, inAmt = bevel === 'rounded' ? bh * (1 - Math.sin(th)) : bh * (1 - t), z = bevel === 'rounded' ? bh * (1 - Math.cos(th)) : bh * t; return { pts: inAmt > 1e-6 ? inset(pts, inAmt, sign) : pts, z }; };
      for (const q of list) {
        if (depth > 0 || bh > 0) {
          const rings = Array.from({ length: steps + 1 }, (_, k) => ring(q.pts, k));
          rings.push({ pts: q.pts, z: depth });
          const segN = q.closed ? q.pts.length : q.pts.length - 1;
          for (let r = 0; r < rings.length - 1; r++) {
            const A = rings[r], B = rings[r + 1];
            if (Math.abs(B.z - A.z) < 1e-6 && A.pts === B.pts) continue;
            for (let i = 0; i < segN; i++) {
              const j = (i + 1) % q.pts.length, a0 = A.pts[i], a1 = A.pts[j], b0 = B.pts[i], b1 = B.pts[j];
              const P: V3[] = [[a0.x, a0.y, A.z], [a1.x, a1.y, A.z], [b1.x, b1.y, B.z], [b0.x, b0.y, B.z]];
              raws.push({ pts: P, normal: norm(cross(sub3(P[2], P[0]), sub3(P[3], P[1]))), solid: s, cap: false });
            }
          }
        }
      }
      if (caps) {
        const closed = list.filter((q) => q.closed && q.pts.length > 2);
        if (closed.length) {
          const front = closed.map((q) => ring(q.pts, 0)), z0 = front[0]?.z ?? 0;
          raws.push({ pts: [], rings: front.map((f) => f.pts.map((v): V3 => [v.x, v.y, z0])), normal: [0, 0, -1], solid: s, cap: true, role: 'front' });
          if (depth > 0) raws.push({ pts: [], rings: closed.map((q) => q.pts.map((v): V3 => [v.x, v.y, depth])), normal: [0, 0, 1], solid: s, cap: true, role: 'back' });
        }
      }
    }
  } else if (kind === '3d.revolve') {
    const right = str(p, 'from', 'left') === 'right', axis = right ? b.x + b.w + num(p, 'offset', 0) : b.x - num(p, 'offset', 0), ang = clamp(num(p, 'angle', 360), 1, 360);
    const steps = Math.max(6, Math.ceil((ang / 360) * 48)), th = (k: number): number => ((k / steps) * ang * Math.PI) / 180;
    center = [axis, b.y + b.h / 2, 0];
    const rev = (v: Pt, t: number): V3 => { const r = v.x - axis; return [axis + r * Math.cos(t), v.y, -r * Math.sin(t)]; };
    for (const s of solids) for (const q of polys(s)) {
      const segN = q.closed ? q.pts.length : q.pts.length - 1;
      for (let k = 0; k < steps; k++) for (let i = 0; i < segN; i++) {
        const a = q.pts[i], c = q.pts[(i + 1) % q.pts.length], P: V3[] = [rev(a, th(k)), rev(c, th(k)), rev(c, th(k + 1)), rev(a, th(k + 1))];
        raws.push({ pts: P, normal: norm(cross(sub3(P[2], P[0]), sub3(P[3], P[1]))), solid: s, cap: false });
      }
      if (ang < 360 && flag(p, 'cap', true) && q.closed && q.pts.length > 2) {
        raws.push({ pts: [], rings: [q.pts.map((v) => rev(v, 0))], normal: [0, 0, -1], solid: s, cap: true });
        const t = th(steps);
        raws.push({ pts: [], rings: [q.pts.map((v) => rev(v, t))], normal: [Math.sin(t), 0, Math.cos(t)], solid: s, cap: true });
      }
    }
  }
  const R = rotation(num(p, 'rx', -18), num(p, 'ry', -26), num(p, 'rz', 8)), fov = clamp(num(p, 'perspective', 0), 0, 160);
  const f = fov > 0 ? size / 2 / Math.tan((fov * Math.PI) / 360) : 0, L = lighting(p), wire = L.material === 'wireframe', seam = Math.max(0.15, size / 1500);
  const project = (v: V3): { x: number; y: number; z: number } => {
    const r = rot(R, [v[0] - center[0], v[1] - center[1], v[2] - center[2]]);
    const k = f > 0 ? f / Math.max(f * 0.05, f + r[2]) : 1;
    return { x: center[0] + r[0] * k, y: center[1] + r[1] * k, z: r[2] };
  };
  const groups = new Map<Solid, { faces: Face[]; front: Face | null; back: Face | null; facing: boolean }>();
  for (const raw of raws) {
    const rings = raw.rings ?? [raw.pts];
    let z = 0, count = 0;
    const d: PathData = rings.map((ringPts) => ({ closed: true, pts: ringPts.map((v) => { const q = project(v); z += q.z; count++; return anchor(q.x, q.y); }) }));
    const n0 = rot(R, raw.normal), n: V3 = n0[2] > 0 ? [-n0[0], -n0[1], -n0[2]] : n0;
    const base = raw.solid.fill ?? raw.solid.stroke ?? [0.6, 0.6, 0.6], col = shadeRgb(base, n, L), lf = lightFactors(n, L);
    const face: Face = { d, rule: raw.cap ? raw.solid.rule : 'nonzero', fill: wire ? null : col, stroke: wire ? base : raw.cap ? null : col, strokeWidth: wire ? Math.max(0.25, raw.solid.strokeWidth || 0.5) : raw.cap ? 0 : seam, depth: z / Math.max(1, count), solid: solids.indexOf(raw.solid), cap: raw.cap, t: lf.t, s: lf.s };
    let g = groups.get(raw.solid);
    if (!g) { g = { faces: [], front: null, back: null, facing: true }; groups.set(raw.solid, g); }
    if (raw.role === 'front') { g.front = face; g.facing = n0[2] <= 0; } else if (raw.role === 'back') g.back = face; else g.faces.push(face);
  }
  const ordered = [...groups.values()].map((g) => {
    g.faces.sort((a, c) => c.depth - a.depth);
    const near = g.facing ? g.front : g.back, far = g.facing ? g.back : g.front, list = [...(far ? [far] : []), ...g.faces, ...(near ? [near] : [])];
    return { list, depth: list.reduce((m, f) => m + f.depth, 0) / Math.max(1, list.length) };
  });
  ordered.sort((a, c) => c.depth - a.depth);
  return ordered.flatMap((o) => o.list);
}

export function outline3d(d: PathData, e: Effect): PathData {
  return scene3d([{ d, rule: 'nonzero', fill: null, stroke: null, strokeWidth: 0 }], e).flatMap((f) => f.d);
}
