import { childrenOf } from './doc';
import { anchor, dist, emptyRect, flattenSub, pathBounds, pathLength, pointAtLength, segLength, segments, unionRect, mul, translate, rotateAbout, scaleAbout, transformPath, ellipsePath, starPath, rectPath } from './geometry';
import { mapPathNonlinear } from './live';
import { luminance, mixColor, solid, tinted, BLACK, rgb } from './paint';
import type { BrushDef, Doc, Paint, PathData, Pt, Rect, StrokeItem, SubPath, VNode, WidthPoint } from './types';

export interface BrushPiece { d: PathData; paint: Paint | null; opacity?: number }

function artPieces(n: VNode): Array<{ d: PathData; paint: Paint }> {
  const out: Array<{ d: PathData; paint: Paint }> = [];
  const visit = (x: VNode): void => {
    if (x.hidden) return;
    if (x.kind === 'path' || x.kind === 'compound') {
      const d = x.kind === 'path' ? x.d : x.children.flatMap((c) => c.d);
      const f = x.ap.items.find((i) => i.kind === 'fill' && i.visible && i.paint.type !== 'none');
      if (f) out.push({ d, paint: f.paint });
      return;
    }
    childrenOf(x)?.forEach(visit);
  };
  visit(n);
  return out;
}
function artBounds(n: VNode): Rect { return artPieces(n).reduce((r, p) => unionRect(r, pathBounds(p.d)), emptyRect()); }

function colorize(def: BrushDef, p: Paint, stroke: Paint): Paint {
  if (def.colorize === 'none' || stroke.type !== 'color' || p.type !== 'color') return p;
  const lum = luminance(p.color);
  if (def.colorize === 'tints') return solid(tinted(stroke.color, (1 - lum) * 100));
  if (def.colorize === 'tints_shades') return solid(lum > 0.5 ? mixColor(stroke.color, rgb(255, 255, 255), (lum - 0.5) * 2) : mixColor(BLACK, stroke.color, lum * 2));
  return solid(stroke.color);
}

interface Track { len: number; at(s: number): { p: Pt; n: Pt } }
function track(sp: SubPath): Track {
  const pts = flattenSub(sp, 0.25);
  if (sp.closed) pts.push({ ...pts[0] });
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + dist(pts[i], pts[i - 1]));
  const len = lens[lens.length - 1];
  return {
    len,
    at(s: number) {
      const t = Math.max(0, Math.min(len, s));
      let i = 1;
      while (i < lens.length - 1 && lens[i] < t) i++;
      const a = pts[i - 1], b = pts[i], seg = lens[i] - lens[i - 1] || 1, k = (t - lens[i - 1]) / seg;
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
      return { p: { x: a.x + dx * k, y: a.y + dy * k }, n: { x: -dy / l, y: dx / l } };
    },
  };
}

function profileWidth(prof: WidthPoint[] | null, t: number): number {
  if (!prof || !prof.length) return 1;
  const p = [...prof].sort((a, b) => a.t - b.t), w = (q: WidthPoint): number => (q.l + q.r) / 2;
  if (t <= p[0].t) return w(p[0]);
  for (let i = 0; i < p.length - 1; i++) if (t <= p[i + 1].t) { const u = (t - p[i].t) / Math.max(1e-9, p[i + 1].t - p[i].t); return w(p[i]) + (w(p[i + 1]) - w(p[i])) * u; }
  return w(p[p.length - 1]);
}

function calligraphic(d: PathData, b: Extract<BrushDef['brush'], { type: 'calligraphic' }>, width: number, prof: WidthPoint[] | null): PathData {
  const a0 = (b.size * (width || 1)) / 2, th = (b.angle * Math.PI) / 180, ct = Math.cos(th), st = Math.sin(th);
  const support = (ux: number, uy: number, k: number): Pt => {
    const a = a0 * k, bb = a * Math.max(0.01, b.roundness / 100);
    const rx = ux * ct + uy * st, ry = -ux * st + uy * ct, den = Math.sqrt(a * a * rx * rx + bb * bb * ry * ry) || 1;
    const px = (a * a * rx) / den, py = (bb * bb * ry) / den;
    return { x: px * ct - py * st, y: px * st + py * ct };
  };
  const out: PathData = [];
  for (const sp of d) {
    const pts = flattenSub(sp, 0.3);
    if (pts.length < 2) continue;
    if (sp.closed) pts.push({ ...pts[0] });
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + dist(pts[i], pts[i - 1]));
    const total = lens[lens.length - 1] || 1;
    const left: Pt[] = [], right: Pt[] = [];
    pts.forEach((p, i) => {
      const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], dx = q.x - o.x, dy = q.y - o.y, l = Math.hypot(dx, dy) || 1;
      const k = profileWidth(prof, lens[i] / total), nx = -dy / l, ny = dx / l, s1 = support(nx, ny, k), s2 = support(-nx, -ny, k);
      left.push({ x: p.x + s1.x, y: p.y + s1.y });
      right.push({ x: p.x + s2.x, y: p.y + s2.y });
    });
    out.push({ closed: true, pts: [...left, ...right.reverse()].map((p) => anchor(p.x, p.y)) });
  }
  return out;
}

type Art = Array<{ d: PathData; paint: Paint }>;

function bend(art: Art, ab: Rect, tr: Track, xs: (x: number) => number, sy: number, flip: boolean): Art {
  const cy = ab.y + ab.h / 2;
  const f = (p: Pt): Pt => {
    const s = xs(p.x), off = (p.y - cy) * sy * (flip ? -1 : 1);
    if (s < 0 || s > tr.len) { const e = tr.at(s < 0 ? 0 : tr.len), over = s < 0 ? s : s - tr.len, tx = e.n.y, ty = -e.n.x; return { x: e.p.x + tx * over + e.n.x * off, y: e.p.y + ty * over + e.n.y * off }; }
    const at = tr.at(s);
    return { x: at.p.x + at.n.x * off, y: at.p.y + at.n.y * off };
  };
  return art.map((a) => ({ d: mapPathNonlinear(a.d, f, 6), paint: a.paint }));
}

function stretchAlong(art: Art, ab: Rect, tr: Track, from: number, length: number, thick: number, flip: boolean, reverse = false): Art {
  const sy = ab.h > 0 ? thick / ab.h : 1, sx = ab.w > 0 ? length / ab.w : 1;
  return bend(art, ab, tr, (x) => from + (reverse ? ab.x + ab.w - x : x - ab.x) * sx, sy, flip);
}

function artBrush(b: Extract<BrushDef['brush'], { type: 'art' }>, art: Art, ab: Rect, tr: Track, width: number): Art {
  const k = Math.max(0.1, width) * (b.width / 100), rev = !!b.flipAlong;
  const local = (x: number): number => (rev ? ab.x + ab.w - x + ab.x : x);
  if (!b.stretch) {
    const sx = ab.w > 0 ? tr.len / ab.w : 1;
    return bend(art, ab, tr, (x) => (local(x) - ab.x) * sx, sx * (b.width / 100), b.flip);
  }
  const g = b.guides;
  if (g && g[1] > g[0]) {
    const sy = k, g1 = ab.x + ab.w * Math.max(0, Math.min(1, g[0])), g2 = ab.x + ab.w * Math.max(0, Math.min(1, g[1]));
    const head = (g1 - ab.x) * sy, tail = (ab.x + ab.w - g2) * sy, fixed = head + tail;
    if (fixed < tr.len * 0.98) {
      const mid = (tr.len - fixed) / Math.max(1e-6, g2 - g1);
      return bend(art, ab, tr, (x0) => { const x = local(x0); return x <= g1 ? (x - ab.x) * sy : x >= g2 ? tr.len - (ab.x + ab.w - x) * sy : head + (x - g1) * mid; }, sy, b.flip);
    }
  }
  return stretchAlong(art, ab, tr, 0, tr.len, ab.h * k, b.flip, rev);
}

interface Corner { s: number; at: Pt; angle: number; outer: boolean }

function corners(sp: SubPath, tr: Track): Corner[] {
  const segs = segments(sp), out: Corner[] = [];
  let acc = 0;
  const lens = segs.map((g) => segLength(g));
  const total = lens.reduce((a, b) => a + b, 0) || 1, scale = tr.len / total;
  const dirIn = (g: [Pt, Pt, Pt, Pt]): Pt => { const a = dist(g[2], g[3]) > 1e-6 ? g[2] : dist(g[1], g[3]) > 1e-6 ? g[1] : g[0]; return { x: g[3].x - a.x, y: g[3].y - a.y }; };
  const dirOut = (g: [Pt, Pt, Pt, Pt]): Pt => { const a = dist(g[1], g[0]) > 1e-6 ? g[1] : dist(g[2], g[0]) > 1e-6 ? g[2] : g[3]; return { x: a.x - g[0].x, y: a.y - g[0].y }; };
  for (let i = 0; i < segs.length; i++) {
    acc += lens[i];
    const nx = segs[i + 1] ?? (sp.closed ? segs[0] : null);
    if (!nx) continue;
    const u = dirIn(segs[i]), v = dirOut(nx), lu = Math.hypot(u.x, u.y), lv = Math.hypot(v.x, v.y);
    if (lu < 1e-9 || lv < 1e-9) continue;
    const cos = (u.x * v.x + u.y * v.y) / (lu * lv), cross = u.x * v.y - u.y * v.x;
    if (cos > Math.cos((25 * Math.PI) / 180)) continue;
    const a1 = Math.atan2(u.y, u.x);
    out.push({ s: Math.min(tr.len, acc * scale), at: segs[i][3], angle: a1, outer: cross > 0 });
  }
  return out;
}

function patternBrush(def: BrushDef, b: Extract<BrushDef['brush'], { type: 'pattern' }>, sp: SubPath, tr: Track, s: StrokeItem, out: BrushPiece[]): void {
  const scale = Math.max(0.1, s.width), push = (list: Art): void => { for (const p of list) out.push({ d: p.d, paint: colorize(def, p.paint, s.paint) }); };
  const tile = (n: VNode | null | undefined): { art: Art; ab: Rect } | null => { if (!n) return null; const art = artPieces(n), ab = artBounds(n); return art.length && ab.w > 0 ? { art, ab } : null; };
  const side = tile(b.art), start = sp.closed ? null : tile(b.start), end = sp.closed ? null : tile(b.end), outer = tile(b.outer), inner = tile(b.inner);
  if (!side) return;
  const thick = side.ab.h * scale, flip = !!b.flip, rev = !!b.flipAlong;
  const cs = corners(sp, tr).filter((c) => (c.outer ? outer : inner));
  const runs: Array<[number, number]> = [];
  let from = 0;
  if (start) { const w = start.ab.w * scale; push(stretchAlong(start.art, start.ab, tr, 0, Math.min(w, tr.len), start.ab.h * scale, flip, rev)); from = Math.min(w, tr.len); }
  let to = tr.len;
  if (end) { const w = end.ab.w * scale; to = Math.max(from, tr.len - w); push(stretchAlong(end.art, end.ab, tr, to, tr.len - to, end.ab.h * scale, flip, rev)); }
  for (const c of cs) {
    const t = (c.outer ? outer : inner) as { art: Art; ab: Rect }, w = Math.max(t.ab.w, thick / scale) * scale, half = w / 2;
    if (c.s - half < from || c.s + half > to) continue;
    runs.push([from, c.s - half]);
    from = c.s + half;
    const cx = t.ab.x + t.ab.w / 2, cy = t.ab.y + t.ab.h / 2, k = scale;
    const m = mul(translate(c.at.x - cx, c.at.y - cy), mul(rotateAbout((c.angle * 180) / Math.PI, cx, cy), scaleAbout(k * (rev ? -1 : 1), k * (flip ? -1 : 1), cx, cy)));
    push(t.art.map((a) => ({ d: transformPath(a.d, m), paint: a.paint })));
  }
  runs.push([from, to]);
  const natural = side.ab.w * scale, pitch = natural * (1 + b.spacing / 100);
  for (const [a, z] of runs) {
    const L = z - a;
    if (L <= 1e-3) continue;
    if (b.fit === 'space') {
      const count = Math.max(1, Math.floor(L / pitch)), step = L / count;
      for (let i = 0; i < count; i++) push(stretchAlong(side.art, side.ab, tr, a + i * step + (step - natural) / 2, natural, thick, flip, rev));
    } else if (b.fit === 'approximate') {
      const count = Math.max(1, Math.round(L / pitch)), step = L / count, k = step / pitch;
      for (let i = 0; i < count; i++) push(stretchAlong(side.art, side.ab, tr, a + i * step, natural * k, thick * k, flip, rev));
    } else {
      const count = Math.max(1, Math.round(L / pitch)), step = L / count;
      for (let i = 0; i < count; i++) push(stretchAlong(side.art, side.ab, tr, a + i * step, step / (1 + b.spacing / 100), thick, flip, rev));
    }
  }
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function bristleStrokes(b: Extract<BrushDef['brush'], { type: 'bristle' }>, d: PathData, s: StrokeItem): BrushPiece[] {
  const out: BrushPiece[] = [], W = Math.max(0.5, b.size * Math.max(0.1, s.width)), shape = b.shape;
  const flat = shape.startsWith('flat'), fan = shape === 'fan';
  const count = Math.round(6 + (Math.max(1, Math.min(100, b.density)) / 100) * 70);
  const tipLen = W * Math.max(0.25, b.length / 100) * 0.9, wob = W * 0.09 * (1 - Math.max(1, Math.min(100, b.stiffness)) / 100);
  d.forEach((sp, si) => {
    if (sp.pts.length < 2) return;
    const tr = track(sp), len = tr.len;
    if (len < 0.5) return;
    const r = rng(Math.round(len * 131) + si * 977 + count * 7 + shape.length * 31);
    const step = Math.max(0.4, Math.min(W / 5, len / 12));
    for (let i = 0; i < count; i++) {
      let u: number, depth: number;
      if (flat) { u = r() * 2 - 1; depth = r() * 0.25; }
      else if (fan) { u = (i / Math.max(1, count - 1)) * 2 - 1 + (r() - 0.5) * 0.05; depth = r() * 0.1; }
      else { const rr = Math.sqrt(r()), th = r() * Math.PI * 2; u = rr * Math.cos(th); depth = Math.abs(rr * Math.sin(th)); }
      const lf = shape.endsWith('point') ? 1 - u * u * 0.75 : shape.endsWith('curve') ? 1 - u * u * 0.4 : shape.endsWith('angle') ? 0.45 + 0.55 * (u + 1) / 2 : fan ? 1 - Math.abs(u) * 0.3 : 1;
      const lead = (1 - lf) * tipLen + depth * tipLen * 0.3;
      const s0 = Math.min(len * 0.45, lead), s1 = Math.max(len * 0.55, len - lead);
      if (s1 - s0 < step) continue;
      const tw = Math.max(0.15, W * (Math.max(1, b.thickness) / 100) * 0.34 * (0.6 + r() * 0.8));
      const op = Math.max(0.03, Math.min(1, (b.opacity / 100) * (0.5 + r() * 0.5)));
      const ph = r() * Math.PI * 2, fq = 0.6 + r() * 1.4, spread = fan ? 1.5 : 1;
      const left: Pt[] = [], right: Pt[] = [];
      const n = Math.max(2, Math.ceil((s1 - s0) / step));
      for (let k = 0; k <= n; k++) {
        const at = s0 + ((s1 - s0) * k) / n, pos = tr.at(at), t = at / len;
        const conv = shape.endsWith('point') || fan ? Math.min(1, 0.35 + 0.65 * Math.min(at, len - at) / Math.max(1e-6, tipLen)) : 1;
        const off = u * (W / 2) * spread * profileWidth(s.profile, t) * conv + wob * Math.sin((at / (W * 0.8 + 1)) * fq + ph);
        const taper = Math.min(1, (k / n) * 4, ((n - k) / n) * 4), hw = (tw / 2) * Math.max(0.15, taper);
        const c = { x: pos.p.x + pos.n.x * off, y: pos.p.y + pos.n.y * off };
        left.push({ x: c.x + pos.n.x * hw, y: c.y + pos.n.y * hw });
        right.push({ x: c.x - pos.n.x * hw, y: c.y - pos.n.y * hw });
      }
      out.push({ d: [{ closed: true, pts: [...left, ...right.reverse()].map((p) => anchor(p.x, p.y)) }], paint: null, opacity: op });
    }
  });
  return out;
}

export function brushOutline(doc: Doc, def: BrushDef, d: PathData, s: StrokeItem): BrushPiece[] {
  const b = def.brush;
  if (b.type === 'calligraphic') return [{ d: calligraphic(d, b, s.width, s.profile), paint: null }];
  if (b.type === 'bristle') return bristleStrokes(b, d, s);
  const out: BrushPiece[] = [];
  for (const sp of d) {
    if (sp.pts.length < 2) continue;
    const tr = track(sp);
    if (tr.len < 1e-3) continue;
    if (b.type === 'pattern') { patternBrush(def, b, sp, tr, s, out); continue; }
    const art = artPieces(b.art), ab = artBounds(b.art);
    if (!art.length || ab.w <= 0) continue;
    if (b.type === 'art') {
      for (const piece of artBrush(b, art, ab, tr, s.width)) out.push({ d: piece.d, paint: colorize(def, piece.paint, s.paint) });
    } else {
      const size = (b.size / 100) * Math.max(0.1, s.width), step = Math.max(1, ab.w * size * (b.spacing / 100));
      let i = 0;
      for (let at = step / 2; at < tr.len; at += step) {
        const pos = tr.at(at), seed = Math.sin(i * 12.9898) * 43758.5453, rnd = seed - Math.floor(seed);
        const off = ((rnd * 2 - 1) * b.scatter / 100) * ab.h * size;
        const ang = b.rotation + (b.relative ? (Math.atan2(pos.n.x, -pos.n.y) * 180) / Math.PI : 0);
        const cx = ab.x + ab.w / 2, cy = ab.y + ab.h / 2;
        const m = mul(translate(pos.p.x + pos.n.x * off - cx, pos.p.y + pos.n.y * off - cy), mul(rotateAbout(ang, cx, cy), scaleAbout(size, size, cx, cy)));
        for (const a of art) out.push({ d: transformPath(a.d, m), paint: colorize(def, a.paint, s.paint) });
        i++;
      }
    }
  }
  return out;
}

export function defaultBrushes(newId: (p: string) => string): BrushDef[] {
  const leaf: VNode = { id: newId('b'), kind: 'path', d: [{ closed: true, pts: [anchor(0, 0, 0, 0, 10, -8), anchor(40, 0, 30, -8, 30, 8), ] }], rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [{ kind: 'fill', paint: solid(BLACK), opacity: 1, blend: 'normal', visible: true, effects: [] }], effects: [] } };
  const dot: VNode = { id: newId('b'), kind: 'path', d: ellipsePath(0, 0, 10, 10), rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [{ kind: 'fill', paint: solid(BLACK), opacity: 1, blend: 'normal', visible: true, effects: [] }], effects: [] } };
  const star: VNode = { id: newId('b'), kind: 'path', d: starPath(5, 5, 5, 2, 5), rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [{ kind: 'fill', paint: solid(BLACK), opacity: 1, blend: 'normal', visible: true, effects: [] }], effects: [] } };
  const taper: VNode = { id: newId('b'), kind: 'path', d: [{ closed: true, pts: [anchor(0, 5), anchor(10, 0, 4, 0, 60, 0), anchor(100, 5), anchor(10, 10, 60, 10, 4, 10)] }], rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [{ kind: 'fill', paint: solid(BLACK), opacity: 1, blend: 'normal', visible: true, effects: [] }], effects: [] } };
  const tile: VNode = { id: newId('b'), kind: 'group', clip: false, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, children: [
    { id: newId('b'), kind: 'path', d: rectPath(0, 0, 12, 4), rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [{ kind: 'fill', paint: solid(BLACK), opacity: 1, blend: 'normal', visible: true, effects: [] }], effects: [] } },
    { id: newId('b'), kind: 'path', d: rectPath(14, 0, 4, 4), rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [{ kind: 'fill', paint: solid(BLACK), opacity: 1, blend: 'normal', visible: true, effects: [] }], effects: [] } },
  ] };
  return [
    { id: newId('br'), name: '3 pt. Round', brush: { type: 'calligraphic', angle: 0, roundness: 100, size: 3 }, colorize: 'none' },
    { id: newId('br'), name: '5 pt. Flat', brush: { type: 'calligraphic', angle: 30, roundness: 25, size: 5 }, colorize: 'none' },
    { id: newId('br'), name: 'Ink Taper', brush: { type: 'art', art: taper, stretch: true, flip: false, width: 100 }, colorize: 'tints' },
    { id: newId('br'), name: 'Leaf Art', brush: { type: 'art', art: leaf, stretch: true, flip: false, width: 100 }, colorize: 'tints' },
    { id: newId('br'), name: 'Dot Scatter', brush: { type: 'scatter', art: dot, size: 60, spacing: 160, scatter: 0, rotation: 0, relative: false }, colorize: 'tints' },
    { id: newId('br'), name: 'Star Scatter', brush: { type: 'scatter', art: star, size: 80, spacing: 140, scatter: 60, rotation: 0, relative: true }, colorize: 'tints' },
    { id: newId('br'), name: 'Dash Dot Pattern', brush: { type: 'pattern', art: tile, spacing: 10, fit: 'stretch' }, colorize: 'tints' },
    { id: newId('br'), name: 'Round Bristle', brush: { type: 'bristle', shape: 'round_point', size: 7, length: 100, density: 50, thickness: 50, opacity: 75, stiffness: 50 }, colorize: 'none' },
  ];
}

export const TILE_KEYS = ['outer', 'inner', 'start', 'end'] as const;

export function artGuides(o: Record<string, unknown>): { stretch?: boolean; guides?: [number, number] | null } {
  const mode = typeof o.scaleMode === 'string' ? o.scaleMode : null;
  if (!mode) return {};
  if (mode === 'proportional') return { stretch: false, guides: null };
  if (mode === 'guides') {
    const g1 = Math.max(0, Math.min(100, Number(o.guide1 ?? 25))), g2 = Math.max(0, Math.min(100, Number(o.guide2 ?? 75)));
    return { stretch: true, guides: [Math.min(g1, g2) / 100, Math.max(g1, g2, Math.min(g1, g2) + 1) / 100] };
  }
  return { stretch: true, guides: null };
}

export function bristleKind(o: Record<string, unknown>): Extract<BrushDef['brush'], { type: 'bristle' }> {
  const n = (k: string, d: number, lo: number, hi: number): number => { const v = Number(o[k]); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  const shapes = ['round_point', 'flat_point', 'round_blunt', 'flat_blunt', 'round_curve', 'flat_curve', 'round_angle', 'flat_angle', 'fan'];
  return { type: 'bristle', shape: (shapes.includes(String(o.shape)) ? o.shape : 'round_point') as 'round_point', size: n('size', 7, 0.5, 72), length: n('length', 100, 25, 300), density: n('density', 50, 1, 100), thickness: n('thickness', 50, 1, 100), opacity: n('opacity', 75, 1, 100), stiffness: n('stiffness', 50, 1, 100) };
}

export function brushLength(d: PathData): number { return d.reduce((s, sp) => s + pathLength(sp), 0); }
export { pointAtLength };
