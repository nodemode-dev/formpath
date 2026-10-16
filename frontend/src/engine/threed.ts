import { anchor, emptyRect, flattenSub, pathBounds, unionRect } from './geometry';
import { parseColor, toRgb } from './paint';
import { getMesh, simplifyMesh, type Mesh } from './modelmesh';
import type { Effect, FillRule, PathData, Pt } from './types';

export type RGB3 = [number, number, number];
export type V3 = [number, number, number];
type Params = Effect['params'];
export interface Solid { d: PathData; rule: FillRule; fill: RGB3 | null; stroke: RGB3 | null; strokeWidth: number }
export interface Face { d: PathData; rule: FillRule; fill: RGB3 | null; stroke: RGB3 | null; strokeWidth: number; depth: number; solid: number; cap: boolean; t: number; s: number; role?: 'front' | 'back'; facing?: boolean; flat?: boolean }
export interface ModelTrace { mesh: Mesh; k: number }
export interface TraceGeom { raws: Raw[]; R: number[]; f: number; center: V3; size: number; model?: ModelTrace }
export interface Scene { faces: Face[]; project: (x: number, y: number, z: number) => Pt; center: Pt; trace: TraceGeom | null }
export interface LightSrc { dir: V3; color: RGB3; intensity: number; softness: number }
export interface Lighting { light: V3; intensity: number; ambient: number; highlight: number; shade: RGB3; material: string; look: string; srcs: LightSrc[] | null }

export const VECTOR_3D = new Set(['3d.extrude', '3d.revolve', '3d.rotate', '3d.model']);
export const rayTraced = (e: Effect): boolean => e.visible && VECTOR_3D.has(e.id) && e.params.ray_trace === true && !['wireframe', 'flat'].includes(str(e.params, 'material', e.id === '3d.rotate' ? 'flat' : 'plastic'));
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

export const LIGHT_LIMIT = 8;
const MATERIAL_BASE: Record<string, string> = { brushed_metal: 'metal', wood: 'matte', rough: 'matte' };

export function lightDir(rotation: number, height: number): V3 {
  const th = (rotation * Math.PI) / 180, ph = (clamp(height, 0, 90) * Math.PI) / 180;
  return [Math.cos(ph) * Math.sin(th), -Math.cos(ph) * Math.cos(th), -Math.sin(ph)];
}

export function lightSources(p: Params): LightSrc[] | null {
  const raw = p.lights;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    return list.slice(0, LIGHT_LIMIT).map((o: Record<string, unknown>) => {
      const q = o && typeof o === 'object' ? o : {}, n = (k: string, d: number): number => (typeof q[k] === 'number' && Number.isFinite(q[k] as number) ? (q[k] as number) : d);
      return { dir: lightDir(n('r', -45), n('h', 40)), color: rgbParam({ c: typeof q.c === 'string' ? q.c : '#ffffff' }, 'c', '#ffffff'), intensity: clamp(n('i', 100), 0, 200) / 100, softness: clamp(n('s', 0), 0, 100) / 100 };
    });
  } catch { return null; }
}

export interface LightSpec { color: string; intensity: number; rotation: number; height: number; softness: number }
export const LIGHTING_PRESETS: Record<string, { label: string; ambient: number; lights: LightSpec[] }> = {
  standard: { label: 'Standard', ambient: 40, lights: [{ color: '#ffffff', intensity: 100, rotation: -40, height: 45, softness: 20 }, { color: '#ffffff', intensity: 35, rotation: 140, height: 25, softness: 60 }] },
  diffuse: { label: 'Diffuse', ambient: 55, lights: [{ color: '#ffffff', intensity: 70, rotation: 0, height: 65, softness: 80 }, { color: '#ffffff', intensity: 45, rotation: -90, height: 35, softness: 80 }, { color: '#ffffff', intensity: 45, rotation: 90, height: 35, softness: 80 }] },
  top_left: { label: 'Top Left', ambient: 40, lights: [{ color: '#ffffff', intensity: 100, rotation: -45, height: 40, softness: 0 }] },
  right: { label: 'Right', ambient: 40, lights: [{ color: '#ffffff', intensity: 100, rotation: 90, height: 35, softness: 0 }] },
};
export const lightsToParam = (list: LightSpec[]): string => JSON.stringify(list.slice(0, LIGHT_LIMIT).map((l) => ({ c: l.color, i: Math.round(l.intensity), r: Math.round(l.rotation), h: Math.round(l.height), s: Math.round(l.softness) })));

export function lightSpecs(p: Params): LightSpec[] {
  const raw = p.lights;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const list: unknown = JSON.parse(raw);
      if (Array.isArray(list)) return list.slice(0, LIGHT_LIMIT).map((o: Record<string, unknown>) => { const q = o && typeof o === 'object' ? o : {}, n = (k: string, d: number): number => (typeof q[k] === 'number' && Number.isFinite(q[k] as number) ? (q[k] as number) : d); return { color: typeof q.c === 'string' ? q.c : '#ffffff', intensity: clamp(n('i', 100), 0, 200), rotation: n('r', -45), height: clamp(n('h', 40), 0, 90), softness: clamp(n('s', 0), 0, 100) }; });
    } catch { }
  }
  const d = norm(LIGHT_DIRS[str(p, 'light', 'top_left')] ?? LIGHT_DIRS.top_left);
  return [{ color: '#ffffff', intensity: num(p, 'intensity', 100), rotation: Math.round((Math.atan2(d[0], -d[1] || 0) * 180) / Math.PI), height: Math.round((Math.asin(clamp(-d[2], -1, 1)) * 180) / Math.PI), softness: 0 }];
}

export function lightingPreset(p: Params): string {
  const list = lightSpecs(p), amb = num(p, 'ambient', 40);
  for (const [id, pr] of Object.entries(LIGHTING_PRESETS)) {
    if (pr.lights.length !== list.length || Math.abs(pr.ambient - amb) > 0.5) continue;
    if (pr.lights.every((l, i) => { const o = list[i], dr = Math.abs((((l.rotation - o.rotation) % 360) + 540) % 360 - 180); return o.color.toLowerCase() === l.color && Math.abs(o.intensity - l.intensity) < 1.5 && dr < 1.5 && Math.abs(o.height - l.height) < 1.6 && Math.abs(o.softness - l.softness) < 1.5; })) return id;
  }
  return 'custom';
}

export function lighting(p: Params): Lighting {
  const srcs = lightSources(p), main = srcs?.reduce((m: LightSrc | null, s) => (!m || s.intensity > m.intensity ? s : m), null) ?? null, mat = str(p, 'material', 'plastic');
  return { light: main ? main.dir : norm(LIGHT_DIRS[str(p, 'light', 'top_left')] ?? LIGHT_DIRS.top_left), intensity: num(p, 'intensity', 100) / 100, ambient: num(p, 'ambient', 40) / 100, highlight: num(p, 'highlight', 60) / 100, shade: rgbParam(p, 'shading_color', '#000000'), material: MATERIAL_BASE[mat] ?? mat, look: mat, srcs };
}

function lit(n: V3, L: Lighting): { d: RGB3; s: RGB3 } {
  const d: RGB3 = [0, 0, 0], s: RGB3 = [0, 0, 0], metal = L.material === 'metal';
  for (const l of L.srcs ?? []) {
    const diffuse = Math.max(0, dot(n, l.dir));
    if (diffuse <= 0) continue;
    const h = norm([l.dir[0], l.dir[1], l.dir[2] - 1]), nh = Math.max(0, dot(n, h)), spec = metal ? Math.pow(nh, 14) * L.highlight * 1.4 : L.material === 'matte' ? 0 : Math.pow(nh, 36) * L.highlight;
    for (let c = 0; c < 3; c++) { d[c] += l.color[c] * l.intensity * diffuse; s[c] += l.color[c] * l.intensity * spec; }
  }
  return { d, s };
}

export function shadeRgb(base: RGB3, n: V3, L: Lighting): RGB3 {
  if (L.material === 'flat') return base;
  if (L.srcs) {
    const { d, s } = lit(n, L);
    if (L.material === 'metal') return base.map((b, c) => clamp(b * clamp(0.3 * L.ambient + 0.75 * d[c]) + b * s[c] + s[c] * 0.25)) as RGB3;
    return base.map((b, c) => { const k = L.shade[c] + (b - L.shade[c]) * clamp(L.ambient + (1 - L.ambient) * d[c]); return clamp(k + (1 - k) * clamp(s[c])); }) as RGB3;
  }
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
  if (L.srcs) {
    const { d, s } = lit(n, L), dm = (d[0] + d[1] + d[2]) / 3, sm = (s[0] + s[1] + s[2]) / 3;
    return L.material === 'metal' ? { t: clamp(0.3 * L.ambient + 0.75 * dm), s: clamp(sm * 0.43) } : { t: clamp(L.ambient + (1 - L.ambient) * dm), s: clamp(sm) };
  }
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
export function rotator(rx: number, ry: number, rz: number): { fwd: (v: V3) => V3; inv: (v: V3) => V3 } {
  const m = rotation(rx, ry, rz), t = [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
  return { fwd: (v) => rot(m, v), inv: (v) => rot(t, v) };
}

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

export interface Raw { pts: V3[]; normal: V3; solid: Solid; cap: boolean; rings?: V3[][]; role?: 'front' | 'back'; hint?: V3; uv?: number[]; ruv?: Array<Array<[number, number]>>; surf?: string }

export interface TextureRef { ref: string; scale: number; rot: number; ox: number; oy: number; color: RGB3 | null }
export interface SurfaceProps { rough: number; metal: number }
const IMPLIED_SURFACE: Record<string, [number, number]> = { plastic: [0.8, 0], matte: [1, 0], metal: [0.77, 1], brushed_metal: [0.7, 1], wood: [1, 0], rough: [0.9, 0], flat: [1, 0] };

export function textureOf(p: Params): TextureRef | null {
  const ref = str(p, 'texture', '').trim();
  if (!ref) return null;
  return { ref, scale: clamp(num(p, 'texture_scale', 100), 10, 400), rot: num(p, 'texture_rotation', 0), ox: num(p, 'texture_offset_x', 0), oy: num(p, 'texture_offset_y', 0), color: str(p, 'texture_color', '').trim() ? rgbParam(p, 'texture_color', '#808080') : null };
}

export function impliedSurface(material: string): SurfaceProps {
  const v = IMPLIED_SURFACE[material] ?? IMPLIED_SURFACE.plastic;
  return { rough: v[0], metal: v[1] };
}

export function surfaceOf(p: Params): SurfaceProps | null {
  const r = num(p, 'roughness', NaN), m = num(p, 'metallic', NaN);
  if (Number.isNaN(r) && Number.isNaN(m)) return null;
  const im = impliedSurface(str(p, 'material', 'plastic'));
  return { rough: Number.isNaN(r) ? im.rough : clamp(r), metal: Number.isNaN(m) ? im.metal : clamp(m) };
}

export interface SurfSpec { material?: string; color?: string; roughness?: number; metallic?: number; texture?: string; texture_color?: string; texture_scale?: number; texture_rotation?: number; texture_offset_x?: number; texture_offset_y?: number }
export interface SurfLook { look: string; col: RGB3 | null; sf: SurfaceProps | null; tex: TextureRef | null }
export const SURFACE_CHOICES: Record<string, ReadonlyArray<readonly [string, string]>> = {
  '3d.extrude': [['front', 'Front'], ['back', 'Back'], ['sides', 'Sides'], ['bevel', 'Bevel']],
  '3d.revolve': [['outer', 'Outer'], ['inner', 'Inner'], ['caps', 'Caps']],
  '3d.rotate': [['front', 'Front']],
};
const SPEC_TEXT = new Set(['material', 'color', 'texture', 'texture_color']);
const SPEC_NUM = new Set(['roughness', 'metallic', 'texture_scale', 'texture_rotation', 'texture_offset_x', 'texture_offset_y']);

export function surfaceSpecs(p: Params): Record<string, SurfSpec> | null {
  const raw = p.surfaces;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const o: unknown = JSON.parse(raw);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const out: Record<string, SurfSpec> = {};
    for (const [id, v] of Object.entries(o as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const s: Record<string, string | number> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) { if (SPEC_TEXT.has(k) && typeof x === 'string') s[k] = x; else if (SPEC_NUM.has(k) && typeof x === 'number' && Number.isFinite(x)) s[k] = x; }
      if (Object.keys(s).length) out[id] = s as SurfSpec;
    }
    return Object.keys(out).length ? out : null;
  } catch { return null; }
}
export const surfacesToParam = (s: Record<string, SurfSpec>): string => (Object.keys(s).length ? JSON.stringify(s) : '');
export const surfaceTextured = (p: Params): boolean => { const s = surfaceSpecs(p); return !!s && Object.values(s).some((v) => !!v.texture?.trim()); };

export function surfaceResolver(p: Params): ((id: string | undefined) => SurfLook) | null {
  const specs = surfaceSpecs(p);
  if (!specs) return null;
  const gMat = str(p, 'material', 'plastic'), gTex = textureOf(p), gSf = surfaceOf(p), memo = new Map<string, SurfLook>();
  return (id) => {
    const key = id ?? '';
    let r = memo.get(key);
    if (r) return r;
    const s: SurfSpec = (id && specs[id]) || {}, look = s.material ?? gMat;
    let tex = gTex;
    if (s.texture !== undefined) tex = s.texture.trim() ? { ref: s.texture.trim(), scale: clamp(s.texture_scale ?? 100, 10, 400), rot: s.texture_rotation ?? 0, ox: s.texture_offset_x ?? 0, oy: s.texture_offset_y ?? 0, color: s.texture_color?.trim() ? rgbParam({ c: s.texture_color }, 'c', '#808080') : null } : null;
    const col: RGB3 | null = s.color?.trim() ? rgbParam({ c: s.color }, 'c', '#808080') : tex?.color ?? null;
    let sf = gSf;
    if (s.roughness !== undefined || s.metallic !== undefined) { const im = impliedSurface(look); sf = { rough: clamp(s.roughness ?? gSf?.rough ?? im.rough), metal: clamp(s.metallic ?? gSf?.metal ?? im.metal) }; } else if (s.material !== undefined) sf = null;
    r = { look, col, sf, tex };
    memo.set(key, r);
    return r;
  };
}

const lightFor = (L: Lighting, look: string): Lighting => ({ ...L, material: MATERIAL_BASE[look] ?? look, look });

function oriented(P: V3[], st: number[], out: V3 | undefined): number[] {
  if (!out) return st;
  const e1 = sub3(P[1], P[0]), e3 = sub3(P[3], P[0]), d1s = st[2] - st[0], d1t = st[3] - st[1], d3s = st[6] - st[0], d3t = st[7] - st[1], det = d1s * d3t - d1t * d3s;
  if (Math.abs(det) < 1e-12) return st;
  const du: V3 = [0, 1, 2].map((k) => (d3t * e1[k] - d1t * e3[k]) / det) as V3, dv: V3 = [0, 1, 2].map((k) => (d1s * e3[k] - d3s * e1[k]) / det) as V3;
  const mirror = dot(cross(du, dv), out) > 0, down = dv[1] < 0 && Math.abs(dv[1]) > 0.5 * Math.hypot(dv[0], dv[1], dv[2]);
  return st.map((v, i) => (i % 2 === 0 ? (mirror ? -v : v) : v)).map((v) => (down ? -v : v));
}

function cumLen(pts: Pt[]): number[] {
  const n = pts.length, out = [0];
  for (let k = 1; k <= n; k++) out.push(out[k - 1] + Math.hypot(pts[k % n].x - pts[k - 1].x, pts[k % n].y - pts[k - 1].y));
  return out;
}

function ringSigns(list: Array<{ pts: Pt[]; closed: boolean }>): number[] {
  const inside = (p: Pt, ring: Pt[]): boolean => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
  return list.map((q, i) => {
    if (!q.closed || q.pts.length < 3) return 0;
    let depth = 0;
    list.forEach((o, j) => { if (j !== i && o.closed && o.pts.length > 2 && inside(q.pts[0], o.pts)) depth++; });
    return (area(q.pts) >= 0 ? 1 : -1) * (depth % 2 ? -1 : 1);
  });
}

export function scene3d(solids: Solid[], e: Effect): Face[] { return scene3dWith(solids, e).faces; }

export function scene3dWith(solids: Solid[], e: Effect, trace = false): Scene {
  const p = e.params, kind = e.id, res = surfaceResolver(p), texUv = trace && (textureOf(p) !== null || (res !== null && surfaceTextured(p)));
  let b = emptyRect();
  for (const s of solids) b = unionRect(b, pathBounds(s.d));
  if (!Number.isFinite(b.x)) return { faces: [], project: (x, y) => ({ x, y }), center: { x: 0, y: 0 }, trace: null };
  if (kind === '3d.model') return modelScene(solids, e, b, trace, res);
  const size = Math.max(b.w, b.h, 1), tol = Math.max(0.2, size / 300), raws: Raw[] = [];
  const memo = new Map<Solid, Array<{ pts: Pt[]; closed: boolean }>>();
  const polys = (s: Solid): Array<{ pts: Pt[]; closed: boolean }> => { let l = memo.get(s); if (!l) { l = s.d.map((sp) => ({ pts: flattenSub(sp, tol), closed: sp.closed })).filter((q) => q.pts.length > 1); memo.set(s, l); } return l; };
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
      const hs = trace ? ringSigns(list) : [];
      for (const [qi, q] of list.entries()) {
        if (depth > 0 || bh > 0) {
          const cum = texUv ? cumLen(q.pts) : null, zc = depth / 2;
          const rings = Array.from({ length: steps + 1 }, (_, k) => ring(q.pts, k));
          rings.push({ pts: q.pts, z: depth });
          const segN = q.closed ? q.pts.length : q.pts.length - 1;
          for (let r = 0; r < rings.length - 1; r++) {
            const A = rings[r], B = rings[r + 1];
            if (Math.abs(B.z - A.z) < 1e-6 && A.pts === B.pts) continue;
            for (let i = 0; i < segN; i++) {
              const j = (i + 1) % q.pts.length, a0 = A.pts[i], a1 = A.pts[j], b0 = B.pts[i], b1 = B.pts[j];
              const P: V3[] = [[a0.x, a0.y, A.z], [a1.x, a1.y, A.z], [b1.x, b1.y, B.z], [b0.x, b0.y, B.z]];
              const sg = hs[qi] ?? 0, ex = q.pts[j].x - q.pts[i].x, ey = q.pts[j].y - q.pts[i].y;
              raws.push({ pts: P, normal: norm(cross(sub3(P[2], P[0]), sub3(P[3], P[1]))), solid: s, cap: false, surf: steps > 0 && r < steps ? 'bevel' : 'sides', ...(sg ? { hint: [ey * sg, -ex * sg, 0] as V3 } : {}), ...(cum ? { uv: oriented(P, [cum[i], A.z - zc, cum[i + 1], A.z - zc, cum[i + 1], B.z - zc, cum[i], B.z - zc], sg ? [ey * sg, -ex * sg, 0] : undefined) } : {}) });
            }
          }
        }
      }
      if (caps) {
        const closed = list.filter((q) => q.closed && q.pts.length > 2);
        if (closed.length) {
          const front = closed.map((q) => ring(q.pts, 0)), z0 = front[0]?.z ?? 0, tcx = b.x + b.w / 2, tcy = b.y + b.h / 2;
          raws.push({ pts: [], rings: front.map((f) => f.pts.map((v): V3 => [v.x, v.y, z0])), normal: [0, 0, -1], solid: s, cap: true, role: 'front', surf: 'front', ...(texUv ? { ruv: front.map((f) => f.pts.map((v): [number, number] => [v.x - tcx, v.y - tcy])) } : {}) });
          if (depth > 0) raws.push({ pts: [], rings: closed.map((q) => q.pts.map((v): V3 => [v.x, v.y, depth])), normal: [0, 0, 1], solid: s, cap: true, role: 'back', surf: 'back', ...(texUv ? { ruv: closed.map((q) => q.pts.map((v): [number, number] => [tcx - v.x, v.y - tcy])) } : {}) });
        }
      }
    }
  } else if (kind === '3d.revolve') {
    const right = str(p, 'from', 'left') === 'right', axis = right ? b.x + b.w + num(p, 'offset', 0) : b.x - num(p, 'offset', 0), ang = clamp(num(p, 'angle', 360), 1, 360);
    const steps = Math.max(6, Math.ceil((ang / 360) * 48)), th = (k: number): number => ((k / steps) * ang * Math.PI) / 180;
    center = [axis, b.y + b.h / 2, 0];
    const rev = (v: Pt, t: number): V3 => { const r = v.x - axis; return [axis + r * Math.cos(t), v.y, -r * Math.sin(t)]; };
    const signs = new Map<Solid, number[]>();
    let radius = 1;
    if (texUv) for (const s of solids) for (const q of polys(s)) for (const v of q.pts) radius = Math.max(radius, Math.abs(v.x - axis));
    const tcy = b.y + b.h / 2;
    for (const s of solids) for (const [qi, q] of polys(s).entries()) {
      if (trace && !signs.has(s)) signs.set(s, ringSigns(polys(s)));
      const segN = q.closed ? q.pts.length : q.pts.length - 1, sg = signs.get(s)?.[qi] ?? 0, cum = texUv ? cumLen(q.pts) : null;
      for (let k = 0; k < steps; k++) for (let i = 0; i < segN; i++) {
        const a = q.pts[i], c = q.pts[(i + 1) % q.pts.length], P: V3[] = [rev(a, th(k)), rev(c, th(k)), rev(c, th(k + 1)), rev(a, th(k + 1))];
        const ox = (c.y - a.y) * sg, oy = -(c.x - a.x) * sg, tm = (th(k) + th(k + 1)) / 2;
        raws.push({ pts: P, normal: norm(cross(sub3(P[2], P[0]), sub3(P[3], P[1]))), solid: s, cap: false, surf: sg && ox * ((a.x + c.x) / 2 - axis < 0 ? -1 : 1) < 0 ? 'inner' : 'outer', ...(sg ? { hint: [ox * Math.cos(tm), oy, -ox * Math.sin(tm)] as V3 } : {}), ...(cum ? { uv: oriented(P, [th(k) * radius, cum[i], th(k) * radius, cum[i + 1], th(k + 1) * radius, cum[i + 1], th(k + 1) * radius, cum[i]], sg ? [ox * Math.cos(tm), oy, -ox * Math.sin(tm)] : undefined) } : {}) });
      }
      if (ang < 360 && flag(p, 'cap', true) && q.closed && q.pts.length > 2) {
        const flat = texUv ? { ruv: [q.pts.map((v): [number, number] => [v.x - axis, v.y - tcy])] } : {};
        raws.push({ pts: [], rings: [q.pts.map((v) => rev(v, 0))], normal: [0, 0, -1], solid: s, cap: true, surf: 'caps', ...flat });
        const t = th(steps);
        raws.push({ pts: [], rings: [q.pts.map((v) => rev(v, t))], normal: [Math.sin(t), 0, Math.cos(t)], solid: s, cap: true, surf: 'caps', ...flat });
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
    const sr = res ? res(raw.surf) : null, Ls = sr && sr.look !== L.look ? lightFor(L, sr.look) : L, wf = sr ? Ls.material === 'wireframe' : wire;
    const base = sr?.col ?? raw.solid.fill ?? raw.solid.stroke ?? [0.6, 0.6, 0.6], col = shadeRgb(base, n, Ls), lf = lightFactors(n, Ls);
    const face: Face = { d, rule: raw.cap ? raw.solid.rule : 'nonzero', fill: wf ? null : col, stroke: wf ? base : raw.cap ? null : col, strokeWidth: wf ? Math.max(0.25, raw.solid.strokeWidth || 0.5) : raw.cap ? 0 : seam, depth: z / Math.max(1, count), solid: solids.indexOf(raw.solid), cap: raw.cap, t: lf.t, s: lf.s, ...(sr?.col ? { flat: true } : {}) };
    let g = groups.get(raw.solid);
    if (!g) { g = { faces: [], front: null, back: null, facing: true }; groups.set(raw.solid, g); }
    if (raw.role === 'front') { face.role = 'front'; face.facing = n0[2] <= 0; g.front = face; g.facing = face.facing; } else if (raw.role === 'back') { face.role = 'back'; g.back = face; } else g.faces.push(face);
  }
  const ordered = [...groups.values()].map((g) => {
    g.faces.sort((a, c) => c.depth - a.depth);
    const near = g.facing ? g.front : g.back, far = g.facing ? g.back : g.front, list = [...(far ? [far] : []), ...g.faces, ...(near ? [near] : [])];
    return { list, depth: list.reduce((m, f) => m + f.depth, 0) / Math.max(1, list.length) };
  });
  ordered.sort((a, c) => c.depth - a.depth);
  return { faces: ordered.flatMap((o) => o.list), project: (x, y, z) => { const q = project([x, y, z]); return { x: q.x, y: q.y }; }, center: { x: b.x + b.w / 2, y: b.y + b.h / 2 }, trace: trace ? { raws, R, f, center, size } : null };
}

export const MODEL_FACES = 4000;
export const MODEL_FACES_MAX = 60000;

function modelScene(solids: Solid[], e: Effect, b: { x: number; y: number; w: number; h: number }, trace: boolean, res: ReturnType<typeof surfaceResolver>): Scene {
  const p = e.params, size = Math.max(b.w, b.h, 1), cx = b.x + b.w / 2, cy = b.y + b.h / 2, center: V3 = [cx, cy, 0];
  const R = rotation(num(p, 'rx', -18), num(p, 'ry', -26), num(p, 'rz', 0)), fov = clamp(num(p, 'perspective', 0), 0, 160), f = fov > 0 ? size / 2 / Math.tan((fov * Math.PI) / 360) : 0;
  const project = (v: V3): { x: number; y: number; z: number } => {
    const r = rot(R, [v[0] - center[0], v[1] - center[1], v[2] - center[2]]), k = f > 0 ? f / Math.max(f * 0.05, f + r[2]) : 1;
    return { x: center[0] + r[0] * k, y: center[1] + r[1] * k, z: r[2] };
  };
  const out = (faces: Face[], tr: TraceGeom | null): Scene => ({ faces, project: (x, y, z) => { const q = project([x, y, z]); return { x: q.x, y: q.y }; }, center: { x: cx, y: cy }, trace: tr });
  const mesh = getMesh(str(p, 'model', ''));
  if (!mesh) return out(solids.map((s, i) => ({ d: s.d, rule: s.rule, fill: [0.84, 0.84, 0.84], stroke: [0.5, 0.5, 0.5], strokeWidth: 1, depth: 0, solid: i, cap: false, t: 1, s: 0 })), null);
  const L = lighting(p), wire = L.material === 'wireframe', seam = Math.max(0.15, size / 1500), cull = flag(p, 'cull', true);
  const m = simplifyMesh(mesh, clamp(num(p, 'max_faces', MODEL_FACES), 100, MODEL_FACES_MAX)), nv = m.pos.length / 3, nt = m.idx.length / 3;
  const vx = new Float64Array(nv), vy = new Float64Array(nv), vz = new Float64Array(nv), nx = new Float64Array(nv), ny = new Float64Array(nv), nz = new Float64Array(nv), sx = new Float64Array(nv), sy = new Float64Array(nv);
  for (let i = 0; i < nv; i++) {
    const r = rot(R, [m.pos[i * 3] * size, m.pos[i * 3 + 1] * size, m.pos[i * 3 + 2] * size]), q = rot(R, [m.nrm[i * 3], m.nrm[i * 3 + 1], m.nrm[i * 3 + 2]]), kp = f > 0 ? f / Math.max(f * 0.05, f + r[2]) : 1;
    vx[i] = r[0]; vy[i] = r[1]; vz[i] = r[2]; nx[i] = q[0]; ny[i] = q[1]; nz[i] = q[2]; sx[i] = cx + r[0] * kp; sy[i] = cy + r[1] * kp;
  }
  const faces: Face[] = [];
  for (let t = 0; t < nt; t++) {
    const a = m.idx[t * 3], c = m.idx[t * 3 + 1], d = m.idx[t * 3 + 2];
    const ux = vx[c] - vx[a], uy = vy[c] - vy[a], uz = vz[c] - vz[a], wx = vx[d] - vx[a], wy = vy[d] - vy[a], wz = vz[d] - vz[a];
    const gx = uy * wz - uz * wy, gy = uz * wx - ux * wz, gz = ux * wy - uy * wx, mz = (vz[a] + vz[c] + vz[d]) / 3;
    if (cull && (f > 0 ? gx * (vx[a] + vx[c] + vx[d]) / 3 + gy * (vy[a] + vy[c] + vy[d]) / 3 + gz * (mz + f) : gz) > 0) continue;
    let sxn = nx[a] + nx[c] + nx[d], syn = ny[a] + ny[c] + ny[d], szn = nz[a] + nz[c] + nz[d];
    const sl = Math.hypot(sxn, syn, szn) || 1;
    sxn /= sl; syn /= sl; szn /= sl;
    const n: V3 = szn > 0 ? [-sxn, -syn, -szn] : [sxn, syn, szn], g = m.grp[t], sr = res ? res(`g${g}`) : null, Ls = sr && sr.look !== L.look ? lightFor(L, sr.look) : L, wf = sr ? Ls.material === 'wireframe' : wire;
    const base = sr?.col ?? mesh.groups[g]?.color ?? [0.7, 0.7, 0.7], col = shadeRgb(base, n, Ls), lf = lightFactors(n, Ls);
    faces.push({ d: [{ closed: true, pts: [anchor(sx[a], sy[a]), anchor(sx[c], sy[c]), anchor(sx[d], sy[d])] }], rule: 'nonzero', fill: wf ? null : col, stroke: wf ? base : col, strokeWidth: wf ? 0.4 : seam, depth: mz, solid: 0, cap: false, t: lf.t, s: lf.s });
  }
  faces.sort((q, r) => r.depth - q.depth);
  return out(faces, trace ? { raws: [], R, f, center, size, model: { mesh, k: size } } : null);
}

export function outline3d(d: PathData, e: Effect): PathData {
  const faces = scene3d([{ d, rule: 'nonzero', fill: null, stroke: null, strokeWidth: 0 }], e);
  if (e.id !== '3d.model') return faces.flatMap((f) => f.d);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of faces) for (const sp of f.d) for (const a of sp.pts) { if (a.x < x0) x0 = a.x; if (a.x > x1) x1 = a.x; if (a.y < y0) y0 = a.y; if (a.y > y1) y1 = a.y; }
  return Number.isFinite(x0) ? [{ closed: true, pts: [anchor(x0, y0), anchor(x1, y0), anchor(x1, y1), anchor(x0, y1)] }] : d;
}
