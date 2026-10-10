import { geomBounds } from './bounds';
import { newId, updateNodes, walk } from './doc';
import { applyH, localAffine, mapPathAdaptive, meshFromMapper, type Homography, type Mapper, type MeshSpec } from './envelope';
import { apply, emptyRect, invert, isEmptyRect, mul, pathBounds, transformPath, transformRect, translate, unionRect } from './geometry';
import { envelopeFrame } from './live';
import { emptyAppearance, rgb } from './paint';
import { transformNode } from './transform';
import type { Anchor, Appearance, Doc, EnvelopeNode, GroupNode, Mat, PathData, PerspAttach, PerspGrid, PerspPlane, PerspView, Pt, Rect, VNode } from './types';

type V3 = [number, number, number];
export interface PlaneFrame { O: V3; X: V3; Y: V3; N: V3 }
export interface PlaneDelta { x: number; y: number; n: number }

const I: Mat = [1, 0, 0, 1, 0, 0];
const MESH = 6;
const TOL = 0.05;
const RAD = Math.PI / 180;

export const PLANES: readonly PerspPlane[] = ['left', 'right', 'floor'];
export const PLANE_LABELS: Record<PerspPlane | 'none', string> = { left: 'Left', right: 'Right', floor: 'Horizontal', none: 'None' };
export const DEFAULT_PERSP_VIEW: PerspView = { show: false, lock: false, snap: true, plane: 'left' };
export const PRESET_NAMES: Record<1 | 2 | 3, string> = { 1: '[1P-Normal View]', 2: '[2P-Normal View]', 3: '[3P-Normal View]' };

const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]];

function niceCell(v: number): number {
  const steps = [6, 9, 12, 18, 24, 36, 48, 72, 96];
  return steps.reduce((best, s) => (Math.abs(s - v) < Math.abs(best - v) ? s : best), steps[0]);
}

export function presetGrid(doc: Doc, type: 1 | 2 | 3): PerspGrid {
  const a = doc.artboards[0] ?? { x: 0, y: 0, w: 612, h: 792 };
  const W = a.w, H = a.h, s = Math.min(W, H), cell = niceCell(s / 22);
  const colors = { left: rgb(64, 120, 255), right: rgb(255, 104, 56), floor: rgb(48, 186, 96) };
  const off = { left: 0, right: 0, floor: 0 };
  if (type === 1) return { type, name: PRESET_NAMES[1], ground: { x: a.x + W * 0.3, y: a.y + H * 0.82 }, height: H * 0.42, station: W * 0.36, angle: 0, distance: W * 0.7, vp3: 0, cell, ext: { left: W * 0.28, right: s * 2.5, height: H * 0.6 }, off, colors, opacity: 0.5 };
  const D = W * 0.55;
  return { type, name: PRESET_NAMES[type], ground: { x: a.x + W / 2, y: a.y + H * 0.8 }, height: H * 0.4, station: 0, angle: 45, distance: D, vp3: type === 3 ? Math.max(2 * D * 1.6, H * 1.8) : 0, cell, ext: { left: s * 1.5, right: s * 1.5, height: H * 0.55 }, off, colors, opacity: 0.5 };
}

export const gridOf = (doc: Doc): PerspGrid => doc.persp ?? presetGrid(doc, 2);
export const perspViewOf = (doc: Doc): PerspView => ({ ...DEFAULT_PERSP_VIEW, ...(doc.perspView ?? {}) });

export function tiltOf(g: PerspGrid): number {
  if (g.type !== 3) return 0;
  const D = Math.max(1, g.distance), v = Math.abs(g.vp3) < 1 ? 1 : g.vp3;
  return 0.5 * Math.asin(Math.max(-1, Math.min(1, (2 * D) / v)));
}

interface Cam { cx: number; cy: number; D: number; hy: number; phi: number; th: number; u: V3; f: V3; C0: V3; r: V3; l: V3 }
const cams = new WeakMap<PerspGrid, Cam>();
export function camera(g: PerspGrid): Cam {
  const hit = cams.get(g);
  if (hit) return hit;
  const D = Math.max(1, g.distance), phi = tiltOf(g), th = g.type === 1 ? 0 : Math.max(0.5, Math.min(89.5, g.angle)) * RAD;
  const hy = g.ground.y - g.height, cx = g.ground.x + g.station, cy = hy + D * Math.tan(phi);
  const u: V3 = [0, Math.cos(phi), Math.sin(phi)], f: V3 = [0, -Math.sin(phi), Math.cos(phi)];
  const c: V3 = [g.ground.x - cx, cy - g.ground.y, D];
  const C0 = add(add([c[0], 0, 0], scl(u, c[1])), scl(f, c[2]));
  const cam: Cam = { cx, cy, D, hy, phi, th, u, f, C0, r: [Math.sin(th), 0, Math.cos(th)], l: [-Math.cos(th), 0, Math.sin(th)] };
  cams.set(g, cam);
  return cam;
}

export function planeFrame(g: PerspGrid, plane: PerspPlane, off: number): PlaneFrame {
  const c = camera(g);
  const N: V3 = plane === 'right' ? c.l : plane === 'left' ? c.r : [0, 1, 0];
  const X: V3 = plane === 'right' ? c.r : neg(c.l);
  const Y: V3 = plane === 'floor' ? neg(c.r) : [0, -1, 0];
  return { O: add(c.C0, scl(N, off)), X, Y, N };
}

const hcache = new WeakMap<PerspGrid, Map<string, Homography>>();
export function planeH(g: PerspGrid, plane: PerspPlane, off: number): Homography {
  let m = hcache.get(g);
  if (!m) { m = new Map(); hcache.set(g, m); }
  const key = `${plane}:${off}`, hit = m.get(key);
  if (hit) return hit;
  const c = camera(g), F = planeFrame(g, plane, off), D = c.D;
  const cam = (v: V3): V3 => [v[0], dot(v, c.u), dot(v, c.f)];
  const X = cam(F.X), Y = cam(F.Y), O = cam(F.O);
  const k = Math.abs(O[2]) > 1e-9 ? 1 / Math.abs(O[2]) : 1;
  const H: Homography = [
    (c.cx * X[2] + D * X[0]) * k, (c.cx * Y[2] + D * Y[0]) * k, (c.cx * O[2] + D * O[0]) * k,
    (c.cy * X[2] - D * X[1]) * k, (c.cy * Y[2] - D * Y[1]) * k, (c.cy * O[2] - D * O[1]) * k,
    X[2] * k, Y[2] * k, O[2] * k,
  ];
  m.set(key, H);
  return H;
}

export function invH(m: Homography): Homography {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = c * h - b * i, C = b * f - c * e, Dd = f * g - d * i, E = a * i - c * g, F = c * d - a * f, G = d * h - e * g, Hh = b * g - a * h, II = a * e - b * d;
  const det = a * A + b * Dd + c * G || 1e-12;
  return [A / det, B / det, C / det, Dd / det, E / det, F / det, G / det, Hh / det, II / det];
}

const depth = (H: Homography, p: Pt): number => H[6] * p.x + H[7] * p.y + H[8];
export function projectPt(H: Homography, p: Pt): Pt {
  const w = Math.max(depth(H, p), 0.02 * Math.max(1e-6, Math.abs(H[8])));
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w };
}
export function toPlane(H: Homography, p: Pt): Pt | null {
  const q = applyH(invH(H), p);
  return depth(H, q) > 0.02 * Math.abs(H[8]) ? q : null;
}

export const planeAt = (g: PerspGrid, plane: PerspPlane, off: number, p: Pt): Pt | null => toPlane(planeH(g, plane, off), p);
export const fromPlane = (g: PerspGrid, plane: PerspPlane, off: number, p: Pt): Pt => projectPt(planeH(g, plane, off), p);

export function perspMapper(g: PerspGrid, a: PerspAttach): Mapper {
  const H = planeH(g, a.plane, a.off), m = a.m;
  return (p) => projectPt(H, apply(m, p.x, p.y));
}
function perspBack(g: PerspGrid, a: PerspAttach): Mapper {
  const Hi = invH(planeH(g, a.plane, a.off)), mi = invert(a.m);
  return (p) => { const q = applyH(Hi, p); return apply(mi, q.x, q.y); };
}

export function planeLocalRect(g: PerspGrid, plane: PerspPlane): Rect {
  const e = g.ext;
  if (plane === 'left') return { x: -e.left, y: -e.height, w: e.left, h: e.height };
  if (plane === 'right') return { x: 0, y: -e.height, w: e.right, h: e.height };
  return { x: -e.left, y: -e.right, w: e.left, h: e.right };
}

export function localScale(g: PerspGrid, plane: PerspPlane, off: number, at: Pt): number {
  const H = planeH(g, plane, off), a = projectPt(H, at), b = projectPt(H, { x: at.x + 1, y: at.y }), c = projectPt(H, { x: at.x, y: at.y + 1 });
  return Math.max(1e-6, Math.sqrt(Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))));
}

export function snapPlane(g: PerspGrid, plane: PerspPlane, off: number, p: Pt, tolDoc: number): Pt {
  const k = localScale(g, plane, off, p), t = tolDoc / k, c = Math.max(1e-6, g.cell);
  const sx = Math.round(p.x / c) * c, sy = Math.round(p.y / c) * c;
  return { x: Math.abs(sx - p.x) <= t ? sx : p.x, y: Math.abs(sy - p.y) <= t ? sy : p.y };
}

function clipSeg(H: Homography, a: Pt, b: Pt): [Pt, Pt] | null {
  const lim = 0.05 * Math.abs(H[8]), wa = depth(H, a) - lim, wb = depth(H, b) - lim;
  if (wa <= 0 && wb <= 0) return null;
  if (wa >= 0 && wb >= 0) return [projectPt(H, a), projectPt(H, b)];
  const t = wa / (wa - wb), m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  return wa > 0 ? [projectPt(H, a), projectPt(H, m)] : [projectPt(H, m), projectPt(H, b)];
}

export function gridGeometry(g: PerspGrid, plane: PerspPlane, maxLines = 300): { quad: Pt[]; lines: Array<[Pt, Pt]> } {
  const H = planeH(g, plane, g.off[plane]), r = planeLocalRect(g, plane), lim = 0.05 * Math.abs(H[8]);
  const corners = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
  const poly: Pt[] = [];
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % 4], wa = depth(H, a) - lim, wb = depth(H, b) - lim;
    if (wa >= 0) poly.push(a);
    if ((wa >= 0) !== (wb >= 0)) { const t = wa / (wa - wb); poly.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
  });
  const lines: Array<[Pt, Pt]> = [], c = Math.max(1e-6, g.cell);
  const stepX = c * Math.max(1, Math.ceil(r.w / c / maxLines)), stepY = c * Math.max(1, Math.ceil(r.h / c / maxLines));
  for (let x = Math.ceil(r.x / stepX) * stepX; x <= r.x + r.w + 1e-6; x += stepX) { const s = clipSeg(H, { x, y: r.y }, { x, y: r.y + r.h }); if (s) lines.push(s); }
  for (let y = Math.ceil(r.y / stepY) * stepY; y <= r.y + r.h + 1e-6; y += stepY) { const s = clipSeg(H, { x: r.x, y }, { x: r.x + r.w, y }); if (s) lines.push(s); }
  return { quad: poly.map((p) => projectPt(H, p)), lines };
}

export function vanishing(g: PerspGrid): { left: Pt | null; right: Pt | null; center: Pt | null; third: Pt | null; hy: number } {
  const c = camera(g), k = Math.cos(c.phi) || 1;
  if (g.type === 1) return { left: null, right: null, center: { x: c.cx, y: c.hy }, third: null, hy: c.hy };
  const t = Math.tan(c.th);
  return { left: { x: c.cx - c.D / (t * k), y: c.hy }, right: { x: c.cx + (c.D * t) / k, y: c.hy }, center: null, third: g.type === 3 ? { x: c.cx, y: c.hy + g.vp3 } : null, hy: c.hy };
}

export type GridHandleId = 'vpl' | 'vpr' | 'vp1' | 'vp3' | 'horizonL' | 'horizonR' | 'ground' | 'extL' | 'extR' | 'extH' | 'cell' | 'offL' | 'offR' | 'offF';
export const HANDLE_LABELS: Record<GridHandleId, string> = {
  vpl: 'Left vanishing point', vpr: 'Right vanishing point', vp1: 'Vanishing point', vp3: 'Third vanishing point', horizonL: 'Horizon', horizonR: 'Horizon', ground: 'Ground level',
  extL: 'Left grid extent', extR: 'Right grid extent', extH: 'Vertical grid extent', cell: 'Grid cell size', offL: 'Left plane', offR: 'Right plane', offF: 'Horizontal plane',
};

export function gridHandles(g: PerspGrid): Array<{ id: GridHandleId; at: Pt }> {
  const v = vanishing(g), c = camera(g), out: Array<{ id: GridHandleId; at: Pt }> = [];
  const fl = (p: Pt): Pt => fromPlane(g, 'floor', 0, p), rt = (p: Pt): Pt => fromPlane(g, 'right', 0, p);
  if (v.left && v.right) {
    out.push({ id: 'vpl', at: v.left }, { id: 'vpr', at: v.right });
    const span = Math.max(40, (v.right.x - v.left.x) * 0.08);
    out.push({ id: 'horizonL', at: { x: v.left.x - span, y: v.hy } }, { id: 'horizonR', at: { x: v.right.x + span, y: v.hy } });
  }
  if (v.center) { out.push({ id: 'vp1', at: v.center }); const span = Math.max(60, c.D * 0.6); out.push({ id: 'horizonL', at: { x: v.center.x - span, y: v.hy } }, { id: 'horizonR', at: { x: v.center.x + span, y: v.hy } }); }
  if (v.third) out.push({ id: 'vp3', at: v.third });
  out.push(
    { id: 'ground', at: { ...g.ground } },
    { id: 'extL', at: fl({ x: -g.ext.left, y: 0 }) },
    { id: 'extR', at: fl({ x: 0, y: -g.ext.right }) },
    { id: 'extH', at: rt({ x: 0, y: -g.ext.height }) },
    { id: 'cell', at: rt({ x: Math.min(g.cell, g.ext.right), y: -g.ext.height }) },
    { id: 'offL', at: fl({ x: -g.ext.left / 2, y: -g.off.left }) },
    { id: 'offR', at: fl({ x: -g.off.right, y: -g.ext.right / 2 }) },
    { id: 'offF', at: rt({ x: g.ext.right * 0.75, y: -g.off.floor }) },
  );
  return out;
}

function solveVps(g: PerspGrid, xl: number, xr: number): PerspGrid {
  const cx = g.ground.x + g.station, L = Math.max(2, cx - xl), R = Math.max(2, xr - cx);
  const angle = Math.atan(Math.sqrt(R / L)) / RAD;
  let next = g;
  for (let i = 0; i < 4; i++) { const k = Math.cos(tiltOf(next)); next = { ...g, angle, distance: Math.max(1, Math.sqrt(R * L) * k) }; }
  return next;
}

export function dragGrid(g: PerspGrid, id: GridHandleId, p: Pt): PerspGrid {
  const v = vanishing(g), cell = Math.max(1, g.cell), hgt = (y: number): number => { const h = g.ground.y - y; return Math.abs(h) < 1 ? (h < 0 ? -1 : 1) : h; };
  const onFloor = planeAt(g, 'floor', 0, p), onRight = planeAt(g, 'right', 0, p);
  switch (id) {
    case 'vpl': return v.right ? { ...solveVps(g, p.x, v.right.x), height: hgt(p.y) } : g;
    case 'vpr': return v.left ? { ...solveVps(g, v.left.x, p.x), height: hgt(p.y) } : g;
    case 'vp1': return { ...g, station: p.x - g.ground.x, height: hgt(p.y) };
    case 'vp3': { const d = p.y - v.hy, min = 2 * Math.max(1, g.distance) + 1; return { ...g, vp3: Math.abs(d) < min ? (d < 0 ? -min : min) : d }; }
    case 'horizonL': case 'horizonR': return { ...g, height: hgt(p.y) };
    case 'ground': return { ...g, ground: { x: p.x, y: p.y } };
    case 'extL': return onFloor ? { ...g, ext: { ...g.ext, left: Math.max(cell, -onFloor.x) } } : g;
    case 'extR': return onFloor ? { ...g, ext: { ...g.ext, right: Math.max(cell, -onFloor.y) } } : g;
    case 'extH': return onRight ? { ...g, ext: { ...g.ext, height: Math.max(cell, -onRight.y) } } : g;
    case 'cell': return onRight ? { ...g, cell: Math.max(1, Math.min(2000, Math.round(onRight.x * 100) / 100)) } : g;
    case 'offL': return onFloor ? { ...g, off: { ...g.off, left: -onFloor.y } } : g;
    case 'offR': return onFloor ? { ...g, off: { ...g.off, right: -onFloor.x } } : g;
    case 'offF': return onRight ? { ...g, off: { ...g.off, floor: -onRight.y } } : g;
  }
}

export function sanitizeGrid(g: PerspGrid): PerspGrid {
  const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const type = g.type === 1 || g.type === 3 ? g.type : 2, D = Math.max(1, num(g.distance, 300));
  const vp3 = type === 3 ? (() => { const v = num(g.vp3, 4 * D), min = 2 * D + 1; return Math.abs(v) < min ? (v < 0 ? -min : min) : v; })() : num(g.vp3, 0);
  const cell = Math.max(1, num(g.cell, 24));
  return {
    ...g, type, distance: D, vp3, cell, angle: Math.max(0.5, Math.min(89.5, num(g.angle, 45))), height: Math.abs(num(g.height, 300)) < 1 ? 1 : num(g.height, 300), station: num(g.station, 0),
    ext: { left: Math.max(cell, num(g.ext?.left, 600)), right: Math.max(cell, num(g.ext?.right, 600)), height: Math.max(cell, num(g.ext?.height, 400)) },
    off: { left: num(g.off?.left, 0), right: num(g.off?.right, 0), floor: num(g.off?.floor, 0) }, opacity: Math.max(0, Math.min(1, num(g.opacity, 0.5))),
  };
}

export function sigPaths(ds: PathData[]): number {
  let h = 0, k = 0;
  for (const d of ds) for (const sp of d) {
    k += 1; h += (sp.closed ? 7.13 : 3.71) * k;
    for (const a of sp.pts) { k += 1; h += k * (a.x * 1.13 + a.y * 2.71 + a.ix * 0.57 + a.iy * 1.93 + a.ox * 0.31 + a.oy * 2.29); }
  }
  return h;
}
function sigMesh(s: EnvelopeNode['spec']): number {
  if (s.kind !== 'mesh') return Number.NaN;
  let h = s.rows * 131 + s.cols * 17, k = 0;
  for (const p of s.points) { k += 1; h += k * (p.x * 1.37 + p.y * 2.11); }
  for (const hs of s.h ?? []) for (const q of hs) { k += 1; h += k * (q.x * 0.71 + q.y * 1.79); }
  return h;
}

function mapPointwise(d: PathData, f: Mapper): PathData {
  return d.map((sp) => ({ closed: sp.closed, pts: sp.pts.map((a): Anchor => { const p = f(a), i = f({ x: a.ix, y: a.iy }), o = f({ x: a.ox, y: a.oy }); return { x: p.x, y: p.y, ix: i.x, iy: i.y, ox: o.x, oy: o.y, ...(a.smooth ? { smooth: true } : {}) }; }) }));
}

function regrade(ap: Appearance, f: Mapper): Appearance {
  if (!ap.items.some((i) => i.paint.type === 'gradient' && i.paint.gradient.geom)) return ap;
  return { ...ap, items: ap.items.map((it) => {
    if (it.paint.type !== 'gradient' || !it.paint.gradient.geom) return it;
    const g = it.paint.gradient.geom, a = f({ x: g.x1, y: g.y1 }), b = f({ x: g.x2, y: g.y2 }), c = g.fx !== undefined && g.fy !== undefined ? f({ x: g.fx, y: g.fy }) : null;
    return { ...it, paint: { ...it.paint, gradient: { ...it.paint.gradient, geom: { x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...(c ? { fx: c.x, fy: c.y } : {}) } } } };
  }) };
}

const special = (n: GroupNode): boolean => !!(n.dim || n.graph || n.livePaint || n.intertwine || n.shaper || n.trace);
const centerOf = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

function meshed(doc: Doc, n: EnvelopeNode, g: PerspGrid): EnvelopeNode {
  const a = n.persp as PerspAttach, fr = envelopeFrame(doc, n), spec: MeshSpec = meshFromMapper(fr, MESH, MESH, perspMapper(g, a));
  return { ...n, frame: fr, spec, persp: { ...a, sig: sigMesh(spec) } };
}
function normalized(doc: Doc, n: EnvelopeNode, g: PerspGrid): EnvelopeNode {
  const a = n.persp as PerspAttach, fr = envelopeFrame(doc, n);
  if (isEmptyRect(fr)) return n;
  const c = centerOf(fr), P = perspMapper(g, a)(c), t = { x: P.x - c.x, y: P.y - c.y };
  if (Math.hypot(t.x, t.y) < 0.5) return n;
  const T = translate(t.x, t.y);
  return { ...n, children: n.children.map((ch) => transformNode(ch, T)), frame: transformRect(n.frame, T), persp: { ...a, m: mul(a.m, translate(-t.x, -t.y)) } };
}

export function projectLeaf(doc: Doc, n: VNode, g: PerspGrid, from?: { g: PerspGrid; a: PerspAttach } | 'src'): VNode {
  const a = n.persp;
  if (!a) return n;
  const f = perspMapper(g, a);
  const ap = from === 'src' ? regrade(n.ap, f) : from ? regrade(n.ap, (p) => f(perspBack(from.g, from.a)(p))) : n.ap;
  if (n.kind === 'path' && a.src?.length === 1) { const d = mapPathAdaptive(a.src[0], f, TOL, true); return { ...n, ap, d, live: undefined, bbox: undefined, persp: { ...a, sig: sigPaths([d]) } }; }
  if (n.kind === 'compound' && a.src && a.src.length === n.children.length) {
    const ds = a.src.map((s) => mapPathAdaptive(s, f, TOL, true));
    return { ...n, ap, bbox: undefined, children: n.children.map((c, i) => ({ ...c, d: ds[i], live: undefined })), persp: { ...a, sig: sigPaths(ds) } };
  }
  if (n.kind === 'envelope') return meshed(doc, normalized(doc, n, g), g);
  return n;
}

function wrap(doc: Doc, n: VNode, g: PerspGrid, a: PerspAttach, makeId: () => string): VNode {
  const fr = geomBounds(doc, n);
  if (isEmptyRect(fr) || (fr.w < 1e-6 && fr.h < 1e-6)) return n;
  const env: EnvelopeNode = { id: makeId(), kind: 'envelope', ...(n.name ? { name: n.name } : {}), children: [n], spec: { kind: 'mesh', rows: 1, cols: 1, points: [] }, frame: fr, opacity: 1, blend: 'normal', ap: emptyAppearance(), persp: a };
  return meshed(doc, normalized(doc, env, g), g);
}

export interface PlaneTarget { plane: PerspPlane; off: number }

function reattach(doc: Doc, n: VNode, g: PerspGrid, to: PlaneTarget): VNode {
  const a = n.persp as PerspAttach;
  if (a.plane === to.plane && a.off === to.off) return n;
  return projectLeaf(doc, { ...n, persp: { ...a, plane: to.plane, off: to.off } }, g, { g, a });
}

export function attachKeep(doc: Doc, n: VNode, g: PerspGrid, to: PlaneTarget, makeId: () => string = () => newId('e')): VNode {
  if (n.persp) return reattach(doc, n, g, to);
  const H = planeH(g, to.plane, to.off), Hi = invH(H), back: Mapper = (p) => applyH(Hi, p);
  const ok = (d: PathData): boolean => d.every((sp) => sp.pts.every((q) => toPlane(H, q) !== null));
  switch (n.kind) {
    case 'layer': return n;
    case 'group': if (!special(n)) return { ...n, bbox: undefined, children: n.children.map((c) => attachKeep(doc, c, g, to, makeId)) }; break;
    case 'path': return ok(n.d) ? { ...n, live: undefined, bbox: undefined, persp: { plane: to.plane, off: to.off, m: [...I], src: [mapPointwise(n.d, back)], sig: sigPaths([n.d]) } } : n;
    case 'compound': return n.children.every((c) => ok(c.d)) ? { ...n, bbox: undefined, children: n.children.map((c) => ({ ...c, live: undefined })), persp: { plane: to.plane, off: to.off, m: [...I], src: n.children.map((c) => mapPointwise(c.d, back)), sig: sigPaths(n.children.map((c) => c.d)) } } : n;
    default: break;
  }
  const fr = geomBounds(doc, n);
  if (isEmptyRect(fr)) return n;
  const c = centerOf(fr);
  if (!toPlane(H, c)) return n;
  return wrap(doc, n, g, { plane: to.plane, off: to.off, m: localAffine(back, c, Math.max(fr.w, fr.h, 1)) }, makeId);
}

export function attachPlace(doc: Doc, n: VNode, g: PerspGrid, to: PlaneTarget, m: Mat, makeId: () => string = () => newId('e')): VNode {
  if (n.persp) return reattach(doc, n, g, to);
  switch (n.kind) {
    case 'layer': return n;
    case 'group': if (!special(n)) return { ...n, bbox: undefined, children: n.children.map((c) => attachPlace(doc, c, g, to, m, makeId)) }; break;
    case 'path': return projectLeaf(doc, { ...n, persp: { plane: to.plane, off: to.off, m: [...m], src: [n.d] } }, g, 'src');
    case 'compound': return projectLeaf(doc, { ...n, persp: { plane: to.plane, off: to.off, m: [...m], src: n.children.map((c) => c.d) } }, g, 'src');
    default: break;
  }
  return wrap(doc, n, g, { plane: to.plane, off: to.off, m: [...m] }, makeId);
}

export function placeMatrix(doc: Doc, nodes: VNode[], at: Pt, scale = 1): Mat {
  let b = emptyRect();
  for (const n of nodes) b = unionRect(b, geomBounds(doc, n));
  const c = isEmptyRect(b) ? { x: 0, y: 0 } : centerOf(b);
  return [scale, 0, 0, scale, at.x - scale * c.x, at.y - scale * c.y];
}

export function releaseNode(n: VNode): VNode {
  const kids = n.kind === 'group' ? n.children.map(releaseNode) : null;
  if (!n.persp && !kids) return n;
  const out = { ...n, persp: undefined } as VNode;
  return kids && out.kind === 'group' ? { ...out, children: kids } : out;
}

export function perspLeaves(n: VNode, out: VNode[] = []): VNode[] {
  if (n.persp) { out.push(n); return out; }
  if (n.kind === 'group') for (const c of n.children) perspLeaves(c, out);
  return out;
}

function fitAffine(g: PerspGrid, a: PerspAttach, n: EnvelopeNode): Mat | null {
  const s = n.spec;
  if (s.kind !== 'mesh' || s.points.length !== (s.rows + 1) * (s.cols + 1)) return null;
  const H = planeH(g, a.plane, a.off), fr = n.frame;
  const q0 = toPlane(H, s.points[0]), q1 = toPlane(H, s.points[s.cols]), q2 = toPlane(H, s.points[s.rows * (s.cols + 1)]);
  if (!q0 || !q1 || !q2 || fr.w < 1e-6 || fr.h < 1e-6) return null;
  const m0 = (q1.x - q0.x) / fr.w, m1 = (q1.y - q0.y) / fr.w, m2 = (q2.x - q0.x) / fr.h, m3 = (q2.y - q0.y) / fr.h;
  return [m0, m1, m2, m3, q0.x - m0 * fr.x - m2 * fr.y, q0.y - m1 * fr.x - m3 * fr.y];
}

const nearRect = (a: Rect, b: Rect): boolean => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.w - b.w) < 1e-6 && Math.abs(a.h - b.h) < 1e-6;

function syncLeaf(doc: Doc, n: VNode, g: PerspGrid): VNode {
  const a = n.persp as PerspAttach;
  if (n.kind === 'path' || n.kind === 'compound') {
    const ds = n.kind === 'path' ? [n.d] : n.children.map((c) => c.d), s = sigPaths(ds);
    if (s === a.sig && a.src && a.src.length === ds.length) return n;
    const back = perspBack(g, a);
    return { ...n, persp: { ...a, src: ds.map((d) => mapPointwise(d, back)), sig: s } };
  }
  if (n.kind === 'envelope') {
    const s = sigMesh(n.spec), fr = envelopeFrame(doc, n);
    if (s === a.sig && nearRect(fr, n.frame)) return n;
    const m = s !== a.sig ? fitAffine(g, a, n) : null;
    return meshed(doc, m ? { ...n, persp: { ...a, m } } : n, g);
  }
  return { ...n, persp: undefined } as VNode;
}

const verified = new WeakMap<VNode, PerspGrid>();
export function perspSync(doc: Doc): Doc {
  let any = false;
  const g = gridOf(doc), fix = new Map<string, VNode>();
  walk(doc.layers, (n) => {
    if (!n.persp) return;
    any = true;
    if (verified.get(n) !== g) { const r = syncLeaf(doc, n, g); if (r === n) verified.set(n, g); else fix.set(n.id, r); }
    if (n.kind === 'envelope') return false;
  });
  if (!any) return doc;
  let out = doc.persp ? doc : { ...doc, persp: g };
  if (fix.size) { out = updateNodes(out, fix.keys(), (n) => fix.get(n.id) ?? n); for (const v of fix.values()) verified.set(v, g); }
  return out;
}

export function reprojectDoc(doc: Doc, next: PerspGrid): Doc {
  const prev = gridOf(doc), ids: string[] = [];
  walk(doc.layers, (n) => { if (n.persp) { ids.push(n.id); if (n.kind === 'envelope') return false; } });
  const out: Doc = { ...doc, persp: next };
  if (!ids.length) return out;
  const done = updateNodes(out, ids, (n) => (n.persp ? projectLeaf(doc, n, next, { g: prev, a: n.persp }) : n));
  walk(done.layers, (n) => { if (n.persp) { verified.set(n, next); if (n.kind === 'envelope') return false; } });
  return done;
}

export function planeDeltaWorld(g: PerspGrid, plane: PerspPlane, d: PlaneDelta): V3 {
  const F = planeFrame(g, plane, 0);
  return add(add(scl(F.X, d.x), scl(F.Y, d.y)), scl(F.N, d.n));
}

export function moveLeaf(doc: Doc, n: VNode, g: PerspGrid, w: V3): VNode {
  const a = n.persp;
  if (!a) return n;
  const F = planeFrame(g, a.plane, 0), dx = dot(w, F.X), dy = dot(w, F.Y), dn = dot(w, F.N);
  return projectLeaf(doc, { ...n, persp: { ...a, m: mul(translate(dx, dy), a.m), off: a.off + dn } }, g, { g, a });
}

export function scaleLeaf(doc: Doc, n: VNode, g: PerspGrid, plane: PerspPlane, S: Mat): VNode {
  const a = n.persp;
  if (!a || a.plane !== plane) return n;
  return projectLeaf(doc, { ...n, persp: { ...a, m: mul(S, a.m) } }, g, { g, a });
}

export function mapLeaves(n: VNode, fn: (leaf: VNode) => VNode): VNode {
  if (n.persp) return fn(n);
  if (n.kind === 'group') { const kids = n.children.map((c) => mapLeaves(c, fn)); return kids.some((c, i) => c !== n.children[i]) ? { ...n, children: kids } : n; }
  return n;
}

export function leafPlaneBounds(doc: Doc, n: VNode): Rect {
  const a = n.persp;
  if (!a) return emptyRect();
  if ((n.kind === 'path' || n.kind === 'compound') && a.src) return a.src.reduce((r, d) => unionRect(r, pathBounds(transformPath(d, a.m))), emptyRect());
  if (n.kind === 'envelope') return transformRect(envelopeFrame(doc, n), a.m);
  return emptyRect();
}
