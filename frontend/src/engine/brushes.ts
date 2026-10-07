import { childrenOf } from './doc';
import { anchor, dist, emptyRect, flattenSub, pathBounds, pathLength, pointAtLength, unionRect, mul, translate, rotateAbout, scaleAbout, transformPath, ellipsePath, starPath, rectPath } from './geometry';
import { mapPathNonlinear } from './live';
import { luminance, mixColor, solid, tinted, BLACK, rgb } from './paint';
import type { BrushDef, Doc, Paint, PathData, Pt, Rect, StrokeItem, SubPath, VNode } from './types';

export interface BrushPiece { d: PathData; paint: Paint | null }

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

function calligraphic(d: PathData, b: Extract<BrushDef['brush'], { type: 'calligraphic' }>, width: number): PathData {
  const a = (b.size * (width || 1)) / 2, bb = a * Math.max(0.01, b.roundness / 100), th = (b.angle * Math.PI) / 180, ct = Math.cos(th), st = Math.sin(th);
  const support = (ux: number, uy: number): Pt => {
    const rx = ux * ct + uy * st, ry = -ux * st + uy * ct, den = Math.sqrt(a * a * rx * rx + bb * bb * ry * ry) || 1;
    const px = (a * a * rx) / den, py = (bb * bb * ry) / den;
    return { x: px * ct - py * st, y: px * st + py * ct };
  };
  const out: PathData = [];
  for (const sp of d) {
    const pts = flattenSub(sp, 0.3);
    if (pts.length < 2) continue;
    if (sp.closed) pts.push({ ...pts[0] });
    const left: Pt[] = [], right: Pt[] = [];
    pts.forEach((p, i) => {
      const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], dx = q.x - o.x, dy = q.y - o.y, l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l, s1 = support(nx, ny), s2 = support(-nx, -ny);
      left.push({ x: p.x + s1.x, y: p.y + s1.y });
      right.push({ x: p.x + s2.x, y: p.y + s2.y });
    });
    out.push({ closed: true, pts: [...left, ...right.reverse()].map((p) => anchor(p.x, p.y)) });
  }
  return out;
}

function stretchAlong(art: Array<{ d: PathData; paint: Paint }>, ab: Rect, tr: Track, from: number, length: number, thick: number, flip: boolean): Array<{ d: PathData; paint: Paint }> {
  const cy = ab.y + ab.h / 2, sy = ab.h > 0 ? thick / ab.h : 1, sx = ab.w > 0 ? length / ab.w : 1;
  const f = (p: Pt): Pt => {
    const s = from + (p.x - ab.x) * sx, at = tr.at(s), off = (p.y - cy) * sy * (flip ? -1 : 1);
    return { x: at.p.x + at.n.x * off, y: at.p.y + at.n.y * off };
  };
  return art.map((a) => ({ d: mapPathNonlinear(a.d, f, 6), paint: a.paint }));
}

export function brushOutline(doc: Doc, def: BrushDef, d: PathData, s: StrokeItem): BrushPiece[] {
  const b = def.brush;
  if (b.type === 'calligraphic') return [{ d: calligraphic(d, b, s.width), paint: null }];
  const out: BrushPiece[] = [];
  for (const sp of d) {
    if (sp.pts.length < 2) continue;
    const tr = track(sp);
    if (tr.len < 1e-3) continue;
    const art = artPieces(b.art), ab = artBounds(b.art);
    if (!art.length || ab.w <= 0) continue;
    if (b.type === 'art') {
      const thick = ab.h * (b.width / 100) * Math.max(0.1, s.width);
      for (const piece of stretchAlong(art, ab, tr, 0, tr.len, thick, b.flip)) out.push({ d: piece.d, paint: colorize(def, piece.paint, s.paint) });
    } else if (b.type === 'pattern') {
      const scale = Math.max(0.1, s.width), tileW = ab.w * scale * (1 + b.spacing / 100), count = Math.max(1, b.fit === 'stretch' ? Math.round(tr.len / tileW) : Math.floor(tr.len / tileW));
      const len = b.fit === 'stretch' ? tr.len / count : tileW;
      for (let i = 0; i < count; i++) for (const piece of stretchAlong(art, ab, tr, i * len, len / (1 + b.spacing / 100), ab.h * scale, false)) out.push({ d: piece.d, paint: colorize(def, piece.paint, s.paint) });
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
  ];
}

export function brushLength(d: PathData): number { return d.reduce((s, sp) => s + pathLength(sp), 0); }
export { pointAtLength };
