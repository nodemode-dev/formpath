import { brushOutline } from './brushes';
import { anchor, bezPoint, bezTangent, centerOf, dist, flattenSub, hasIn, hasOut, pathBounds, pathLength, pointAtLength, rectPath, ellipsePath, roundCorners, segments, transformPath, rotateAbout, scaleAbout, translate, mul } from './geometry';
import { offsetPath, strokeToPath } from './kernel';
import { mapPathNonlinear, warpPoint } from './live';
import { parseColor, cssColor, BLACK } from './paint';
import type { Anchor, BlendMode, Doc, Effect, Mat, PathData, Pt, StrokeItem, VNode, WidthPoint } from './types';

export interface EffectParam { key: string; label: string; kind: 'number' | 'boolean' | 'select' | 'color'; min?: number; max?: number; step?: number; unit?: string; choices?: string[]; def: number | boolean | string }
export interface EffectDef { id: string; label: string; menu: string; raster?: boolean; params: EffectParam[] }

const num = (key: string, label: string, def: number, min: number, max: number, unit = '', step = 1): EffectParam => ({ key, label, kind: 'number', def, min, max, unit, step });
const bool = (key: string, label: string, def: boolean): EffectParam => ({ key, label, kind: 'boolean', def });
const sel = (key: string, label: string, def: string, choices: string[]): EffectParam => ({ key, label, kind: 'select', def, choices });
const col = (key: string, label: string, def: string): EffectParam => ({ key, label, kind: 'color', def });

export const WARP_STYLES = ['arc', 'arc_lower', 'arc_upper', 'arch', 'bulge', 'shell_lower', 'shell_upper', 'flag', 'wave', 'fish', 'rise', 'fisheye', 'inflate', 'squeeze', 'twist'];
const BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color_dodge', 'color_burn', 'hard_light', 'soft_light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
const title = (s: string): string => s.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

export const EFFECTS: EffectDef[] = [
  ...WARP_STYLES.map((s) => ({ id: `warp.${s}`, label: title(s), menu: 'Warp', params: [num('bend', 'Bend', 50, -100, 100, '%'), num('horizontal', 'Horizontal Distortion', 0, -100, 100, '%'), num('vertical', 'Vertical Distortion', 0, -100, 100, '%'), bool('vertical_orientation', 'Vertical', false)] })),
  { id: 'distort.free_distort', label: 'Free Distort', menu: 'Distort & Transform', params: [num('tlx', 'Top left x', 0, -500, 500, '%'), num('tly', 'Top left y', 0, -500, 500, '%'), num('trx', 'Top right x', 0, -500, 500, '%'), num('try', 'Top right y', 0, -500, 500, '%'), num('brx', 'Bottom right x', 0, -500, 500, '%'), num('bry', 'Bottom right y', 0, -500, 500, '%'), num('blx', 'Bottom left x', 0, -500, 500, '%'), num('bly', 'Bottom left y', 0, -500, 500, '%')] },
  { id: 'distort.pucker_bloat', label: 'Pucker & Bloat', menu: 'Distort & Transform', params: [num('amount', 'Amount', 30, -200, 200, '%')] },
  { id: 'distort.roughen', label: 'Roughen', menu: 'Distort & Transform', params: [num('size', 'Size', 5, 0, 100, '%'), bool('relative', 'Relative', true), num('detail', 'Detail', 10, 0, 100, '/in'), bool('smooth', 'Smooth', false), num('seed', 'Seed', 1, 0, 9999)] },
  { id: 'distort.transform', label: 'Transform', menu: 'Distort & Transform', params: [num('scale_h', 'Scale Horizontal', 100, -1000, 1000, '%'), num('scale_v', 'Scale Vertical', 100, -1000, 1000, '%'), num('move_h', 'Move Horizontal', 0, -10000, 10000, 'pt'), num('move_v', 'Move Vertical', 0, -10000, 10000, 'pt'), num('rotate', 'Angle', 0, -360, 360, 'deg'), num('copies', 'Copies', 0, 0, 1000), bool('reflect_x', 'Reflect X', false), bool('reflect_y', 'Reflect Y', false)] },
  { id: 'distort.tweak', label: 'Tweak', menu: 'Distort & Transform', params: [num('horizontal', 'Horizontal', 10, 0, 100, '%'), num('vertical', 'Vertical', 10, 0, 100, '%'), bool('anchors', 'Anchor Points', true), bool('handles', 'Control Points', true), num('seed', 'Seed', 1, 0, 9999)] },
  { id: 'distort.twist', label: 'Twist', menu: 'Distort & Transform', params: [num('angle', 'Angle', 45, -3600, 3600, 'deg')] },
  { id: 'distort.zig_zag', label: 'Zig Zag', menu: 'Distort & Transform', params: [num('size', 'Size', 10, 0, 1000, 'pt'), num('ridges', 'Ridges per segment', 4, 0, 100), bool('smooth', 'Smooth', false), bool('relative', 'Relative', false)] },
  { id: 'path.offset', label: 'Offset Path', menu: 'Path', params: [num('offset', 'Offset', 10, -1000, 1000, 'pt'), sel('joins', 'Joins', 'miter', ['miter', 'round', 'bevel']), num('miter', 'Miter limit', 4, 1, 500)] },
  { id: 'path.outline_stroke', label: 'Outline Stroke', menu: 'Path', params: [num('width', 'Width', 4, 0.01, 1000, 'pt')] },
  { id: 'stylize.round_corners', label: 'Round Corners', menu: 'Stylize', params: [num('radius', 'Radius', 10, 0, 1000, 'pt')] },
  { id: 'stylize.scribble', label: 'Scribble', menu: 'Stylize', params: [num('angle', 'Angle', 30, -180, 180, 'deg'), num('spacing', 'Spacing', 5, 0.1, 100, 'pt'), num('width', 'Stroke Width', 3, 0.1, 100, 'pt'), num('variation', 'Variation', 1, 0, 50, 'pt'), num('seed', 'Seed', 1, 0, 9999)] },
  { id: 'stylize.drop_shadow', label: 'Drop Shadow', menu: 'Stylize', raster: true, params: [sel('mode', 'Mode', 'multiply', BLENDS), num('opacity', 'Opacity', 75, 0, 100, '%'), num('x', 'X Offset', 7, -1000, 1000, 'pt'), num('y', 'Y Offset', 7, -1000, 1000, 'pt'), num('blur', 'Blur', 5, 0, 144, 'pt'), col('color', 'Color', '#000000')] },
  { id: 'stylize.inner_glow', label: 'Inner Glow', menu: 'Stylize', raster: true, params: [sel('mode', 'Mode', 'screen', BLENDS), num('opacity', 'Opacity', 75, 0, 100, '%'), num('blur', 'Blur', 5, 0, 144, 'pt'), col('color', 'Color', '#ffffff')] },
  { id: 'stylize.outer_glow', label: 'Outer Glow', menu: 'Stylize', raster: true, params: [sel('mode', 'Mode', 'screen', BLENDS), num('opacity', 'Opacity', 75, 0, 100, '%'), num('blur', 'Blur', 5, 0, 144, 'pt'), col('color', 'Color', '#ffd400')] },
  { id: 'stylize.feather', label: 'Feather', menu: 'Stylize', raster: true, params: [num('radius', 'Feather Radius', 5, 0, 1000, 'pt')] },
  { id: 'blur.gaussian', label: 'Gaussian Blur', menu: 'Blur', raster: true, params: [num('radius', 'Radius', 5, 0, 250, 'pt')] },
  { id: 'convert.rectangle', label: 'Rectangle', menu: 'Convert to Shape', params: [num('extra_w', 'Extra Width', 0, -1000, 1000, 'pt'), num('extra_h', 'Extra Height', 0, -1000, 1000, 'pt')] },
  { id: 'convert.rounded_rectangle', label: 'Rounded Rectangle', menu: 'Convert to Shape', params: [num('extra_w', 'Extra Width', 0, -1000, 1000, 'pt'), num('extra_h', 'Extra Height', 0, -1000, 1000, 'pt'), num('radius', 'Corner Radius', 9, 0, 1000, 'pt')] },
  { id: 'convert.ellipse', label: 'Ellipse', menu: 'Convert to Shape', params: [num('extra_w', 'Extra Width', 0, -1000, 1000, 'pt'), num('extra_h', 'Extra Height', 0, -1000, 1000, 'pt')] },
];
export const EFFECT_IDS = new Set(EFFECTS.map((e) => e.id));
export function effectDef(id: string): EffectDef | undefined { return EFFECTS.find((e) => e.id === id); }
export function effectDefaults(id: string): Effect['params'] { const d = effectDef(id); return Object.fromEntries((d?.params ?? []).map((p) => [p.key, p.def])); }

function rand(seed: number): () => number {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
const P = (e: Effect, k: string, d: number): number => { const v = e.params[k]; return typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && !Number.isNaN(+v) ? +v : d; };
const B = (e: Effect, k: string, d: boolean): boolean => { const v = e.params[k]; return typeof v === 'boolean' ? v : d; };
const PT_PER_IN = 72;

function quadMap(p0: Pt, p1: Pt, p2: Pt, p3: Pt): number[] | null {
  const ex = p0.x - p1.x + p2.x - p3.x, ey = p0.y - p1.y + p2.y - p3.y;
  if (Math.abs(ex) < 1e-9 && Math.abs(ey) < 1e-9) return [p1.x - p0.x, p3.x - p0.x, p0.x, p1.y - p0.y, p3.y - p0.y, p0.y, 0, 0];
  const ax = p1.x - p2.x, bx = p3.x - p2.x, ay = p1.y - p2.y, by = p3.y - p2.y, den = ax * by - bx * ay;
  if (Math.abs(den) < 1e-12) return null;
  const g = (ex * by - bx * ey) / den, h = (ax * ey - ex * ay) / den;
  return [p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x, p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y, g, h];
}

function normalAt(sp: Pt[], i: number, closed: boolean): Pt {
  const n = sp.length, a = sp[(i - 1 + n) % n], b = sp[(i + 1) % n];
  const p = closed || (i > 0 && i < n - 1) ? { x: b.x - a.x, y: b.y - a.y } : i === 0 ? { x: sp[1].x - sp[0].x, y: sp[1].y - sp[0].y } : { x: sp[n - 1].x - sp[n - 2].x, y: sp[n - 1].y - sp[n - 2].y };
  const l = Math.hypot(p.x, p.y) || 1;
  return { x: -p.y / l, y: p.x / l };
}

function polyToSmooth(pts: Pt[], closed: boolean, smooth: boolean): PathData {
  if (!smooth) return [{ closed, pts: pts.map((p) => anchor(p.x, p.y)) }];
  const n = pts.length;
  return [{ closed, pts: pts.map((p, i) => {
    const back = closed || i > 0, fwd = closed || i < n - 1, prev = back ? pts[(i - 1 + n) % n] : p, next = fwd ? pts[(i + 1) % n] : p;
    const tx = next.x - prev.x, ty = next.y - prev.y, tl = Math.hypot(tx, ty) || 1, li = Math.hypot(p.x - prev.x, p.y - prev.y) * 0.3, lo = Math.hypot(next.x - p.x, next.y - p.y) * 0.3;
    return anchor(p.x, p.y, p.x - (tx / tl) * li, p.y - (ty / tl) * li, p.x + (tx / tl) * lo, p.y + (ty / tl) * lo, true);
  }) }];
}

function applyOne(d: PathData, e: Effect): PathData {
  const b = pathBounds(d);
  if (!Number.isFinite(b.x)) return d;
  const id = e.id;
  if (id.startsWith('warp.')) {
    const style = id.slice(5);
    return mapPathNonlinear(d, (p) => warpPoint(style, P(e, 'bend', 50), P(e, 'horizontal', 0), P(e, 'vertical', 0), B(e, 'vertical_orientation', false), b, p), 6);
  }
  switch (id) {
    case 'distort.pucker_bloat': {
      const a = P(e, 'amount', 30) / 100, c = centerOf(b);
      return d.map((sp) => {
        const n = sp.pts.length, moved = sp.pts.map((p) => ({ x: p.x + (c.x - p.x) * a * 0.4, y: p.y + (c.y - p.y) * a * 0.4 })), out: Anchor[] = moved.map((m) => anchor(m.x, m.y));
        segments(sp).forEach((s, i) => {
          const j = (i + 1) % n, mid = bezPoint(s, 0.5), apex = { x: mid.x + (mid.x - c.x) * a * 0.9, y: mid.y + (mid.y - c.y) * a * 0.9 };
          const p0 = moved[i], p3 = moved[j], q = { x: 2 * apex.x - (p0.x + p3.x) / 2, y: 2 * apex.y - (p0.y + p3.y) / 2 };
          out[i] = { ...out[i], ox: p0.x + ((q.x - p0.x) * 2) / 3, oy: p0.y + ((q.y - p0.y) * 2) / 3 };
          out[j] = { ...out[j], ix: p3.x + ((q.x - p3.x) * 2) / 3, iy: p3.y + ((q.y - p3.y) * 2) / 3 };
        });
        return { closed: sp.closed, pts: out };
      });
    }
    case 'distort.roughen': {
      const r = rand(P(e, 'seed', 1)), size = B(e, 'relative', true) ? (P(e, 'size', 5) / 100) * Math.max(b.w, b.h) : P(e, 'size', 5), detail = Math.max(0.1, P(e, 'detail', 10));
      return d.flatMap((sp) => {
        if (sp.pts.length < 2) return [sp];
        const len = pathLength(sp), count = Math.max(sp.pts.length, Math.round((len / PT_PER_IN) * detail)), total = sp.closed ? count : count + 1, pts: Pt[] = [];
        for (let i = 0; i < total; i++) {
          const at = pointAtLength(sp, (len * i) / count), kn = (r() * 2 - 1) * size, kt = (r() * 2 - 1) * size * 0.35;
          pts.push({ x: at.p.x - at.tangent.y * kn + at.tangent.x * kt, y: at.p.y + at.tangent.x * kn + at.tangent.y * kt });
        }
        return polyToSmooth(pts, sp.closed, B(e, 'smooth', false));
      });
    }
    case 'distort.zig_zag': {
      const size = B(e, 'relative', false) ? (P(e, 'size', 10) / 100) * Math.max(b.w, b.h) : P(e, 'size', 10), ridges = Math.max(0, Math.round(P(e, 'ridges', 4)));
      return d.flatMap((sp) => {
        const segN = segments(sp).length;
        if (!segN) return [sp];
        const len = pathLength(sp), pts: Pt[] = [];
        let total = segN * (ridges + 1);
        if (sp.closed && total % 2) total++;
        for (let k = 0; k <= total; k++) {
          if (sp.closed && k === total) break;
          const at = pointAtLength(sp, (len * k) / total), s = k % 2 ? -size : size;
          pts.push({ x: at.p.x + at.tangent.y * s, y: at.p.y - at.tangent.x * s });
        }
        return polyToSmooth(pts, sp.closed, B(e, 'smooth', false));
      });
    }
    case 'distort.twist': {
      const c = centerOf(b), deg = P(e, 'angle', 45), ang = (deg * Math.PI) / 180;
      let R = 1e-6;
      for (const sp of d) for (const p of sp.pts) R = Math.max(R, Math.hypot(p.x - c.x, p.y - c.y));
      return mapPathNonlinear(d, (p) => { const dx = p.x - c.x, dy = p.y - c.y, k = Math.max(0, 1 - (Math.hypot(dx, dy) / R) ** 2), a = ang * k * k, co = Math.cos(a), si = Math.sin(a); return { x: c.x + dx * co - dy * si, y: c.y + dx * si + dy * co }; }, Math.min(24, Math.max(4, Math.ceil(Math.abs(deg) / 20))));
    }
    case 'distort.transform': {
      const c = centerOf(b), th = (-P(e, 'rotate', 0) * Math.PI) / 180, co = Math.cos(th), si = Math.sin(th);
      const sx = (P(e, 'scale_h', 100) / 100) * (B(e, 'reflect_x', false) ? -1 : 1), sy = (P(e, 'scale_v', 100) / 100) * (B(e, 'reflect_y', false) ? -1 : 1);
      const m00 = co * sx, m01 = si * sx, m10 = -si * sy, m11 = co * sy;
      const step: Mat = [m00, m01, m10, m11, c.x + P(e, 'move_h', 0) - (m00 * c.x + m10 * c.y), c.y + P(e, 'move_v', 0) - (m01 * c.x + m11 * c.y)];
      const copies = Math.max(0, Math.min(500, Math.round(P(e, 'copies', 0))));
      if (!copies) return transformPath(d, step);
      const out: PathData = [...d];
      for (let i = 0, acc = step; i < copies; i++, acc = mul(step, acc)) out.push(...transformPath(d, acc));
      return out;
    }
    case 'distort.tweak': {
      const seed = Math.round(P(e, 'seed', 1)), hx = (P(e, 'horizontal', 10) / 100) * b.w, vy = (P(e, 'vertical', 10) / 100) * b.h, an = B(e, 'anchors', true), hd = B(e, 'handles', true);
      const jit = (i: number, j: number, k: number): number => { let h = Math.imul(i + 1, 374761393) ^ Math.imul(j + 1, 668265263) ^ Math.imul(k + 7, 1274126177) ^ Math.imul(seed, 2654435761); h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (((h ^ (h >>> 16)) >>> 0) / 4294967295) * 2 - 1; };
      return d.map((sp, si) => ({ closed: sp.closed, pts: sp.pts.map((a, ai) => {
        const dx = an ? jit(si, ai, 0) * hx : 0, dy = an ? jit(si, ai, 1) * vy : 0, kx = (k: number): number => (hd ? jit(si, ai, k) * hx * 0.6 : 0), ky = (k: number): number => (hd ? jit(si, ai, k) * vy * 0.6 : 0);
        return { ...a, x: a.x + dx, y: a.y + dy, ix: a.ix + dx + (hasIn(a) ? kx(2) : 0), iy: a.iy + dy + (hasIn(a) ? ky(3) : 0), ox: a.ox + dx + (hasOut(a) ? kx(4) : 0), oy: a.oy + dy + (hasOut(a) ? ky(5) : 0) };
      }) }));
    }
    case 'distort.free_distort': {
      const q = (k: string): number => P(e, k, 0) / 100;
      const tl = { x: b.x + q('tlx') * b.w, y: b.y + q('tly') * b.h }, tr = { x: b.x + b.w + q('trx') * b.w, y: b.y + q('try') * b.h }, br = { x: b.x + b.w + q('brx') * b.w, y: b.y + b.h + q('bry') * b.h }, bl = { x: b.x + q('blx') * b.w, y: b.y + b.h + q('bly') * b.h };
      const H = quadMap(tl, tr, br, bl);
      if (!H) return d;
      return mapPathNonlinear(d, (p) => { const u = (p.x - b.x) / (b.w || 1), v = (p.y - b.y) / (b.h || 1), w = Math.max(1e-3, H[6] * u + H[7] * v + 1); return { x: (H[0] * u + H[1] * v + H[2]) / w, y: (H[3] * u + H[4] * v + H[5]) / w }; }, 4);
    }
    case 'path.offset': try { return offsetPath(d, P(e, 'offset', 10), (String(e.params.joins ?? 'miter') as 'miter' | 'round' | 'bevel'), P(e, 'miter', 4)); } catch { return d; }
    case 'path.outline_stroke': try { return strokeToPath(d, P(e, 'width', 4), 'butt', 'miter', 4); } catch { return d; }
    case 'stylize.round_corners': return roundCorners(d, P(e, 'radius', 10));
    case 'stylize.scribble': return scribble(d, e);
    case 'convert.rectangle': return rectPath(b.x - P(e, 'extra_w', 0), b.y - P(e, 'extra_h', 0), b.w + 2 * P(e, 'extra_w', 0), b.h + 2 * P(e, 'extra_h', 0));
    case 'convert.rounded_rectangle': { const r = P(e, 'radius', 9); return rectPath(b.x - P(e, 'extra_w', 0), b.y - P(e, 'extra_h', 0), b.w + 2 * P(e, 'extra_w', 0), b.h + 2 * P(e, 'extra_h', 0), [r, r, r, r]); }
    case 'convert.ellipse': return ellipsePath(b.x - P(e, 'extra_w', 0), b.y - P(e, 'extra_h', 0), b.w + 2 * P(e, 'extra_w', 0), b.h + 2 * P(e, 'extra_h', 0));
  }
  return d;
}

function scribble(d: PathData, e: Effect): PathData {
  const b = pathBounds(d), ang = (P(e, 'angle', 30) * Math.PI) / 180, spacing = Math.max(0.1, P(e, 'spacing', 5)), width = Math.max(0.1, P(e, 'width', 3)), r = rand(P(e, 'seed', 1)), vari = P(e, 'variation', 1);
  const polys = d.filter((sp) => sp.pts.length > 2).map((sp) => flattenSub({ ...sp, closed: true }, 1));
  const c = centerOf(b), R = Math.hypot(b.w, b.h) / 2 + spacing, co = Math.cos(ang), si = Math.sin(ang);
  const rot = (x: number, y: number): Pt => ({ x: c.x + x * co - y * si, y: c.y + x * si + y * co });
  const zig: Pt[] = [];
  let flip = false;
  for (let y = -R; y <= R; y += spacing) {
    const xs: number[] = [];
    for (const poly of polys) for (let i = 0; i < poly.length; i++) {
      const a = poly[i], bb = poly[(i + 1) % poly.length];
      const la = { x: (a.x - c.x) * co + (a.y - c.y) * si, y: -(a.x - c.x) * si + (a.y - c.y) * co }, lb = { x: (bb.x - c.x) * co + (bb.y - c.y) * si, y: -(bb.x - c.x) * si + (bb.y - c.y) * co };
      if ((la.y <= y && lb.y > y) || (lb.y <= y && la.y > y)) xs.push(la.x + ((y - la.y) / (lb.y - la.y)) * (lb.x - la.x));
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    const x0 = xs[0] + (r() - 0.5) * vari, x1 = xs[xs.length - 1] + (r() - 0.5) * vari;
    if (flip) { zig.push(rot(x1, y), rot(x0, y + spacing / 2)); } else { zig.push(rot(x0, y), rot(x1, y + spacing / 2)); }
    flip = !flip;
  }
  if (zig.length < 2) return d;
  try { return strokeToPath([{ closed: false, pts: zig.map((p) => anchor(p.x, p.y)) }], width, 'round', 'round', 4); } catch { return d; }
}

const effectCache = new WeakMap<PathData, WeakMap<Effect[], PathData>>();
export function effectPath(d: PathData, effects: Effect[]): PathData {
  const active = effects.filter((e) => e.visible && !effectDef(e.id)?.raster && EFFECT_IDS.has(e.id));
  if (!active.length) return d;
  let byFx = effectCache.get(d);
  if (!byFx) { byFx = new WeakMap(); effectCache.set(d, byFx); }
  const hit = byFx.get(effects);
  if (hit) return hit;
  let out = d;
  for (const e of active) { try { out = applyOne(out, e); } catch { } }
  byFx.set(effects, out);
  return out;
}

export interface RasterFx { kind: 'drop_shadow' | 'outer_glow' | 'inner_glow' | 'feather' | 'blur'; dx: number; dy: number; blur: number; color: string; opacity: number; blend: BlendMode; reach: number }
export function rasterEffects(n: VNode): RasterFx[] {
  const out: RasterFx[] = [];
  for (const e of n.ap.effects) {
    if (!e.visible) continue;
    const colr = (k: string, d: string): string => cssColor(parseColor(String(e.params[k] ?? d)) ?? BLACK);
    const mode = (String(e.params.mode ?? 'normal') as BlendMode);
    if (e.id === 'stylize.drop_shadow') { const dx = P(e, 'x', 7), dy = P(e, 'y', 7), bl = P(e, 'blur', 5); out.push({ kind: 'drop_shadow', dx, dy, blur: bl, color: colr('color', '#000'), opacity: P(e, 'opacity', 75) / 100, blend: mode, reach: Math.abs(dx) + Math.abs(dy) + bl * 3 }); }
    else if (e.id === 'stylize.outer_glow') { const bl = P(e, 'blur', 5); out.push({ kind: 'outer_glow', dx: 0, dy: 0, blur: bl, color: colr('color', '#ffd400'), opacity: P(e, 'opacity', 75) / 100, blend: mode, reach: bl * 3 }); }
    else if (e.id === 'stylize.inner_glow') { const bl = P(e, 'blur', 5); out.push({ kind: 'inner_glow', dx: 0, dy: 0, blur: bl, color: colr('color', '#fff'), opacity: P(e, 'opacity', 75) / 100, blend: mode, reach: 0 }); }
    else if (e.id === 'stylize.feather') { const bl = P(e, 'radius', 5); out.push({ kind: 'feather', dx: 0, dy: 0, blur: bl, color: '#000', opacity: 1, blend: 'normal', reach: 0 }); }
    else if (e.id === 'blur.gaussian') { const bl = P(e, 'radius', 5); out.push({ kind: 'blur', dx: 0, dy: 0, blur: bl, color: '#000', opacity: 1, blend: 'normal', reach: bl * 3 }); }
  }
  return out;
}

export const WIDTH_PROFILES: Record<string, WidthPoint[]> = {
  uniform: [{ t: 0, l: 1, r: 1 }, { t: 1, l: 1, r: 1 }],
  lens: [{ t: 0, l: 0, r: 0 }, { t: 0.5, l: 1, r: 1 }, { t: 1, l: 0, r: 0 }],
  taper_start: [{ t: 0, l: 0, r: 0 }, { t: 1, l: 1, r: 1 }],
  taper_end: [{ t: 0, l: 1, r: 1 }, { t: 1, l: 0, r: 0 }],
  taper_both: [{ t: 0, l: 0, r: 0 }, { t: 0.15, l: 1, r: 1 }, { t: 0.85, l: 1, r: 1 }, { t: 1, l: 0, r: 0 }],
  pinch: [{ t: 0, l: 1, r: 1 }, { t: 0.5, l: 0.2, r: 0.2 }, { t: 1, l: 1, r: 1 }],
  teardrop: [{ t: 0, l: 0, r: 0 }, { t: 0.3, l: 1, r: 1 }, { t: 1, l: 0, r: 0 }],
  wave: [{ t: 0, l: 0.5, r: 0.5 }, { t: 0.25, l: 1, r: 1 }, { t: 0.5, l: 0.5, r: 0.5 }, { t: 0.75, l: 1, r: 1 }, { t: 1, l: 0.5, r: 0.5 }],
};

export function profileAt(prof: WidthPoint[], t: number): { l: number; r: number } {
  const p = [...prof].sort((a, b) => a.t - b.t);
  if (!p.length) return { l: 1, r: 1 };
  if (t <= p[0].t) return { l: p[0].l, r: p[0].r };
  for (let i = 0; i < p.length - 1; i++) if (t <= p[i + 1].t) { const u = (t - p[i].t) / Math.max(1e-9, p[i + 1].t - p[i].t); return { l: p[i].l + (p[i + 1].l - p[i].l) * u, r: p[i].r + (p[i + 1].r - p[i].r) * u }; }
  const last = p[p.length - 1];
  return { l: last.l, r: last.r };
}

const outlineCache = new WeakMap<PathData, WeakMap<StrokeItem, PathData>>();
export function strokeOutline(d: PathData, s: StrokeItem): PathData {
  let m = outlineCache.get(d);
  if (!m) { m = new WeakMap(); outlineCache.set(d, m); }
  const hit = m.get(s);
  if (hit) return hit;
  const prof = s.profile ?? WIDTH_PROFILES.uniform, hw = s.width / 2, out: PathData = [];
  for (const sp of d) {
    const pts = flattenSub(sp, 0.2);
    if (pts.length < 2) continue;
    if (sp.closed) pts.push({ ...pts[0] });
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + dist(pts[i], pts[i - 1]));
    const total = lens[lens.length - 1] || 1;
    const left: Pt[] = [], right: Pt[] = [];
    pts.forEach((p, i) => {
      const nrm = normalAt(pts, i, false), w = profileAt(prof, lens[i] / total);
      left.push({ x: p.x + nrm.x * hw * w.l, y: p.y + nrm.y * hw * w.l });
      right.push({ x: p.x - nrm.x * hw * w.r, y: p.y - nrm.y * hw * w.r });
    });
    if (sp.closed) {
      out.push({ closed: true, pts: left.map((p) => anchor(p.x, p.y)) }, { closed: true, pts: right.reverse().map((p) => anchor(p.x, p.y)) });
    } else out.push({ closed: true, pts: [...left, ...right.reverse()].map((p) => anchor(p.x, p.y)) });
  }
  m.set(s, out);
  return out;
}

export const ARROWHEADS = ['none', 'triangle', 'triangle_open', 'arrow', 'arrow_open', 'circle', 'circle_open', 'square', 'square_open', 'diamond', 'diamond_open', 'bar', 'barbed', 'half_arrow', 'feather', 'tail', 'concave'];

function headShape(kind: string): { d: PathData; inset: number } | null {
  const P2 = (pts: number[][]): Anchor[] => pts.map(([x, y]) => anchor(x, y));
  const ring = (outer: Anchor[], k: number): PathData => {
    const cx = outer.reduce((s, a) => s + a.x, 0) / outer.length, cy = outer.reduce((s, a) => s + a.y, 0) / outer.length;
    return [{ closed: true, pts: outer }, { closed: true, pts: [...outer].reverse().map((a) => anchor(cx + (a.x - cx) * k, cy + (a.y - cy) * k)) }];
  };
  switch (kind) {
    case 'triangle': return { d: [{ closed: true, pts: P2([[0, 0], [-4, -1.6], [-4, 1.6]]) }], inset: 3.5 };
    case 'triangle_open': return { d: ring(P2([[0, 0], [-4, -1.6], [-4, 1.6]]), 0.6), inset: 0.5 };
    case 'arrow': return { d: [{ closed: true, pts: P2([[0, 0], [-4.5, -2], [-3.4, 0], [-4.5, 2]]) }], inset: 3 };
    case 'arrow_open': return { d: [{ closed: true, pts: P2([[0, 0], [-4.4, -2.4], [-4.8, -1.8], [-1.3, 0], [-4.8, 1.8], [-4.4, 2.4]]) }], inset: 0.5 };
    case 'circle': return { d: ellipsePath(-3, -1.5, 3, 3), inset: 1.5 };
    case 'circle_open': { const o = ellipsePath(-3, -1.5, 3, 3)[0], i = ellipsePath(-2.4, -0.9, 1.8, 1.8)[0]; return { d: [o, { closed: true, pts: [...i.pts].reverse().map((a) => ({ x: a.x, y: a.y, ix: a.ox, iy: a.oy, ox: a.ix, oy: a.iy })) }], inset: 0.3 }; }
    case 'square': return { d: [{ closed: true, pts: P2([[0, -1.5], [0, 1.5], [-3, 1.5], [-3, -1.5]]) }], inset: 1.5 };
    case 'square_open': return { d: [{ closed: true, pts: P2([[0, -1.5], [0, 1.5], [-3, 1.5], [-3, -1.5]]) }, { closed: true, pts: P2([[-0.6, -0.9], [-2.4, -0.9], [-2.4, 0.9], [-0.6, 0.9]]) }], inset: 0.3 };
    case 'diamond': return { d: [{ closed: true, pts: P2([[0, 0], [-2, -2], [-4, 0], [-2, 2]]) }], inset: 2 };
    case 'diamond_open': return { d: [{ closed: true, pts: P2([[0, 0], [-2, -2], [-4, 0], [-2, 2]]) }, { closed: true, pts: P2([[-0.9, 0], [-2, 1.1], [-3.1, 0], [-2, -1.1]]) }], inset: 0.3 };
    case 'bar': return { d: [{ closed: true, pts: P2([[0, -2], [0, 2], [-0.8, 2], [-0.8, -2]]) }], inset: 0 };
    case 'barbed': return { d: [{ closed: true, pts: P2([[0, 0], [-5, -2.4], [-3.6, 0], [-5, 2.4]]) }], inset: 3 };
    case 'half_arrow': return { d: [{ closed: true, pts: P2([[0, 0], [-4.5, -2.2], [-4.5, 0]]) }], inset: 3 };
    case 'feather': return { d: [{ closed: true, pts: P2([[-3, -0.5], [-0.5, -2.2], [0.5, -2.2], [-2, -0.5], [-2, 0.5], [0.5, 2.2], [-0.5, 2.2], [-3, 0.5]]) }], inset: 0 };
    case 'tail': return { d: [{ closed: true, pts: P2([[0, -1.5], [-2, -1.5], [-3, 0], [-2, 1.5], [0, 1.5], [-1, 0]]) }], inset: 0 };
    case 'concave': return { d: [{ closed: true, pts: [anchor(0, 0), anchor(-4.5, -2.2, -4.5, -2.2, -3, -0.6), anchor(-4.5, 2.2, -3, 0.6, -4.5, 2.2)] }], inset: 3 };
  }
  return null;
}

export function arrowGeometry(d: PathData, s: StrokeItem): PathData | null {
  if ((s.startArrow === 'none' || !s.startArrow) && (s.endArrow === 'none' || !s.endArrow)) return null;
  const sp = d.find((x) => !x.closed && x.pts.length > 1);
  if (!sp) return null;
  const out: PathData = [];
  const place = (kind: string, end: boolean, scalePct: number): void => {
    const h = headShape(kind);
    if (!h) return;
    const segs = segments(sp), seg = end ? segs[segs.length - 1] : segs[0];
    const p = end ? seg[3] : seg[0], tg = bezTangent(seg, end ? 1 : 0);
    const dir = end ? tg : { x: -tg.x, y: -tg.y }, k = s.width * (scalePct / 100), ang = Math.atan2(dir.y, dir.x);
    const shift = s.arrowAlign === 'extend' ? (h.inset > 0 ? h.inset * k : 0) : 0;
    const m = mul(translate(p.x + dir.x * shift, p.y + dir.y * shift), mul(rotateAbout((ang * 180) / Math.PI, 0, 0), scaleAbout(k, k, 0, 0)));
    out.push(...transformPath(h.d, m));
  };
  if (s.startArrow && s.startArrow !== 'none') place(s.startArrow, false, s.arrowScale[0]);
  if (s.endArrow && s.endArrow !== 'none') place(s.endArrow, true, s.arrowScale[1]);
  return out.length ? out : null;
}

export function brushGeometry(doc: Doc, d: PathData, s: StrokeItem): Array<{ d: PathData; paint: StrokeItem['paint'] | null }> | null {
  const def = doc.brushes.find((b) => b.id === s.brush || b.name === s.brush);
  if (!def) return null;
  try { return brushOutline(doc, def, d, s); } catch { return null; }
}
