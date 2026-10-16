import { ellipsePath, linePath, mul, piePath, polygonPath, rectPath, starPath, transformPath } from '../geometry';
import { cornered } from '../corners';
import type { CornerSpec, LiveShape, Mat, PathData, PathNode } from '../types';

export interface LivePatch {
  w?: number; h?: number; radii?: [number, number, number, number]; corner?: 'round' | 'inverted' | 'chamfer';
  start?: number; end?: number; r?: number; sides?: number; radius?: number; points?: number; r1?: number; r2?: number;
  length?: number; angle?: number;
}

const axes = (m: Mat): [number, number] => [Math.hypot(m[0], m[1]) || 1, Math.hypot(m[2], m[3]) || 1];

export function normalizeLive(l: LiveShape): LiveShape {
  if (l.kind === 'line') return l;
  const [sx, sy] = axes(l.xf);
  if (Math.abs(sx - 1) < 1e-9 && Math.abs(sy - 1) < 1e-9) return l;
  const xf = mul(l.xf, [1 / sx, 0, 0, 1 / sy, 0, 0]), s = Math.sqrt(sx * sy), m = Math.min(sx, sy);
  switch (l.kind) {
    case 'rect': return { ...l, x: l.x * sx, y: l.y * sy, w: l.w * sx, h: l.h * sy, radii: l.radii.map((r) => r * m) as [number, number, number, number], xf };
    case 'ellipse': return { ...l, x: l.x * sx, y: l.y * sy, w: l.w * sx, h: l.h * sy, xf };
    case 'polygon': return { ...l, cx: l.cx * sx, cy: l.cy * sy, r: l.r * s, radius: l.radius * m, xf };
    case 'star': return { ...l, cx: l.cx * sx, cy: l.cy * sy, r1: l.r1 * s, r2: l.r2 * s, ...(l.radius ? { radius: l.radius * m } : {}), xf };
  }
}

export function liveShapePath(l: LiveShape): PathData {
  switch (l.kind) {
    case 'rect': return transformPath(rectPath(l.x, l.y, l.w, l.h, l.radii, l.corner), l.xf);
    case 'ellipse': return transformPath(Math.abs(l.end - l.start) % 360 < 1e-6 ? ellipsePath(l.x, l.y, l.w, l.h) : piePath(l.x, l.y, l.w, l.h, -l.end, -l.start), l.xf);
    case 'polygon': return transformPath(l.corner && l.corner !== 'round' && l.radius > 0 ? typedCorners(polygonPath(l.cx, l.cy, l.r, l.sides), l.radius, l.corner) : polygonPath(l.cx, l.cy, l.r, l.sides, l.radius), l.xf);
    case 'star': return transformPath(l.corner && l.corner !== 'round' && (l.radius ?? 0) > 0 ? typedCorners(starPath(l.cx, l.cy, l.r1, l.r2, l.points), l.radius ?? 0, l.corner) : starPath(l.cx, l.cy, l.r1, l.r2, l.points, l.radius ?? 0), l.xf);
    case 'line': return linePath(l.x1, l.y1, l.x2, l.y2);
  }
}

function typedCorners(d: PathData, r: number, type: CornerSpec['type']): PathData {
  return cornered(d.map((sp) => ({ closed: sp.closed, pts: sp.pts.map((a) => ({ ...a, corner: { type, r } })) })));
}

const cornerOf = (c: CornerSpec['type'] | undefined): { corner?: CornerSpec['type'] } => (c && c !== 'round' ? { corner: c } : {});

export function patchLive(l0: LiveShape, p: LivePatch): LiveShape {
  const l = normalizeLive(l0), pos = (v: number | undefined, d: number, lo = 0.01): number => (v === undefined || !Number.isFinite(v) ? d : Math.max(lo, v));
  switch (l.kind) {
    case 'rect': {
      const w = pos(p.w, l.w), h = pos(p.h, l.h), max = Math.min(w, h) / 2;
      const radii = (p.radii ?? (p.radius !== undefined ? [p.radius, p.radius, p.radius, p.radius] : l.radii)).map((r) => Math.max(0, Math.min(max, r))) as [number, number, number, number];
      return { ...l, w, h, radii, corner: p.corner ?? l.corner };
    }
    case 'ellipse': return { ...l, w: pos(p.w, l.w), h: pos(p.h, l.h), start: p.start ?? l.start, end: p.end ?? l.end };
    case 'polygon': {
      const r = pos(p.r, l.r), { corner: oldCorner, ...rest } = l;
      return { ...rest, r, sides: Math.max(3, Math.min(1000, Math.round(p.sides ?? l.sides))), radius: Math.max(0, Math.min(r, p.radius ?? l.radius)), ...cornerOf(p.corner ?? oldCorner) };
    }
    case 'star': {
      const r1 = pos(p.r1, l.r1), radius = Math.max(0, Math.min(r1, p.radius ?? l.radius ?? 0));
      const { radius: old, corner: oldCorner, ...rest } = l; void old;
      return { ...rest, points: Math.max(3, Math.min(1000, Math.round(p.points ?? l.points))), r1, r2: pos(p.r2, l.r2), ...(radius > 0 ? { radius } : {}), ...cornerOf(p.corner ?? oldCorner) };
    }
    case 'line': {
      const len0 = Math.hypot(l.x2 - l.x1, l.y2 - l.y1), a0 = Math.atan2(-(l.y2 - l.y1), l.x2 - l.x1);
      const len = pos(p.length, len0), a = p.angle !== undefined ? (p.angle * Math.PI) / 180 : a0;
      return { ...l, x2: l.x1 + Math.cos(a) * len, y2: l.y1 - Math.sin(a) * len };
    }
  }
}

export function editLive(n: PathNode, p: LivePatch): PathNode {
  if (!n.live) return n;
  const live = patchLive(n.live, p);
  return { ...n, live, d: liveShapePath(live) };
}

export type ConvertKind = 'rectangle' | 'rounded_rectangle' | 'ellipse' | 'polygon' | 'star';
export const CONVERT_KINDS: ReadonlyArray<readonly [ConvertKind, string]> = [['rectangle', 'Rectangle'], ['rounded_rectangle', 'Rounded Rectangle'], ['ellipse', 'Ellipse'], ['polygon', 'Polygon'], ['star', 'Star']];

export function convertLive(n: PathNode, to: ConvertKind): PathNode {
  if (!n.live || n.live.kind === 'line') return n;
  const l = normalizeLive(n.live);
  if (l.kind === 'line') return n;
  let x: number, y: number, w: number, h: number, radius = 0, corner: CornerSpec['type'] = 'round';
  if (l.kind === 'rect') { x = l.x; y = l.y; w = l.w; h = l.h; radius = Math.max(...l.radii); corner = l.corner; }
  else if (l.kind === 'ellipse') { x = l.x; y = l.y; w = l.w; h = l.h; }
  else if (l.kind === 'polygon') { x = l.cx - l.r; y = l.cy - l.r; w = l.r * 2; h = l.r * 2; radius = l.radius; corner = l.corner ?? 'round'; }
  else { x = l.cx - l.r1; y = l.cy - l.r1; w = l.r1 * 2; h = l.r1 * 2; radius = l.radius ?? 0; corner = l.corner ?? 'round'; }
  const m = Math.min(Math.abs(w), Math.abs(h)), cx = x + w / 2, cy = y + h / 2, r = m / 2, xf = l.xf;
  let live: LiveShape;
  switch (to) {
    case 'rectangle': live = { kind: 'rect', x, y, w, h, radii: [0, 0, 0, 0], corner, xf }; break;
    case 'rounded_rectangle': {
      if (l.kind === 'rect' && radius > 0) return n;
      const rr = Math.min(radius > 0 ? radius : m / 4, m / 2);
      live = { kind: 'rect', x, y, w, h, radii: [rr, rr, rr, rr], corner, xf };
      break;
    }
    case 'ellipse': live = { kind: 'ellipse', x, y, w, h, start: 0, end: 360, xf }; break;
    case 'polygon': live = { kind: 'polygon', cx, cy, r, sides: 6, radius: Math.min(radius, r), ...cornerOf(corner), xf }; break;
    case 'star': live = { kind: 'star', cx, cy, r1: r, r2: r * 0.5, points: 5, ...(Math.min(radius, r) > 0 ? { radius: Math.min(radius, r) } : {}), ...cornerOf(corner), xf }; break;
  }
  if (live.kind === l.kind && JSON.stringify(live) === JSON.stringify(l)) return n;
  return { ...n, live, d: liveShapePath(live) };
}

export function liveParams(l0: LiveShape): Record<string, number | string> {
  const l = normalizeLive(l0);
  switch (l.kind) {
    case 'rect': return { w: l.w, h: l.h, r0: l.radii[0], r1: l.radii[1], r2: l.radii[2], r3: l.radii[3], corner: l.corner };
    case 'ellipse': return { w: l.w, h: l.h, start: l.start, end: l.end };
    case 'polygon': return { r: l.r, sides: l.sides, radius: l.radius, corner: l.corner ?? 'round' };
    case 'star': return { points: l.points, r1: l.r1, r2: l.r2, radius: l.radius ?? 0, corner: l.corner ?? 'round' };
    case 'line': return { length: Math.hypot(l.x2 - l.x1, l.y2 - l.y1), angle: (Math.atan2(-(l.y2 - l.y1), l.x2 - l.x1) * 180) / Math.PI };
  }
}
