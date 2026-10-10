import { newId, updateNodes, walk } from './doc';
import { anchor, arcSegmentPath, ellipsePath } from './geometry';
import { emptyAppearance, fill, rgb, solid, stroke } from './paint';
import { layoutText, textNode } from './text';
import { UNIT_PT, type DimensionSpec, type Doc, type GroupNode, type Mat, type PathData, type PathNode, type Pt, type TextNode, type Units, type VNode } from './types';

export const DIM_DEFAULTS: Omit<DimensionSpec, 'type' | 'pts'> = {
  orient: 'aligned', radial: 'radius', offset: 18, units: 'doc', precision: 2, scale: 1, showUnits: true,
  arrow: 'filled', arrowSize: 6, font: 'Inter', style: 'Regular', size: 9, textPos: 'above', color: rgb(0, 0, 0), weight: 0.75,
};

export const dimensionSpec = (p: Partial<DimensionSpec> & Pick<DimensionSpec, 'type' | 'pts'>): DimensionSpec => ({ ...DIM_DEFAULTS, ...p });

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y;
const unit = (v: Pt, fb: Pt = { x: 1, y: 0 }): Pt => { const l = Math.hypot(v.x, v.y); return l > 1e-9 ? { x: v.x / l, y: v.y / l } : fb; };
const perp = (u: Pt): Pt => ({ x: u.y, y: -u.x });
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export const dimUnits = (s: DimensionSpec, docUnits: Units): Units => (s.units === 'doc' ? docUnits : s.units);

function linearFrame(s: DimensionSpec): { a: Pt; b: Pt; u: Pt; n: Pt; lo: number; hi: number } {
  const [a, b] = s.pts, u = s.orient === 'horizontal' ? { x: 1, y: 0 } : s.orient === 'vertical' ? { x: 0, y: 1 } : unit(sub(b, a)), n = perp(u);
  const sa = dot(a, n), sb = dot(b, n);
  return { a, b, u, n, lo: Math.min(sa, sb), hi: Math.max(sa, sb) };
}

function angularFrame(s: DimensionSpec): { c: Pt; ta: number; sweep: number; r: number } {
  const [c, a, b] = s.pts, ta = Math.atan2(a.y - c.y, a.x - c.x), tb = Math.atan2(b.y - c.y, b.x - c.x);
  let sweep = tb - ta;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep <= -Math.PI) sweep += 2 * Math.PI;
  const r = s.offset > 0 ? s.offset : 0.5 * Math.min(Math.hypot(a.x - c.x, a.y - c.y), Math.hypot(b.x - c.x, b.y - c.y));
  return { c, ta, sweep, r };
}

export function dimValue(s: DimensionSpec): number {
  if (s.type === 'linear') { const f = linearFrame(s); return Math.abs(dot(sub(f.b, f.a), f.u)); }
  if (s.type === 'angular') return Math.abs(angularFrame(s).sweep) * 180 / Math.PI;
  const r = Math.hypot(s.pts[1].x - s.pts[0].x, s.pts[1].y - s.pts[0].y);
  return s.radial === 'diameter' ? 2 * r : r;
}

export function dimLabel(s: DimensionSpec, docUnits: Units): string {
  const p = Math.max(0, Math.min(6, Math.round(s.precision)));
  if (s.type === 'angular') return `${dimValue(s).toFixed(p)}°`;
  const u = dimUnits(s, docUnits), v = (dimValue(s) / UNIT_PT[u]) * (s.scale || 1);
  const txt = `${v.toFixed(p)}${s.showUnits ? ` ${u}` : ''}`;
  return s.type === 'radial' ? `${s.radial === 'diameter' ? 'Ø' : 'R'} ${txt}` : txt;
}

export function dimOffsetFor(s: DimensionSpec, m: Pt): number {
  if (s.type === 'angular') return Math.hypot(m.x - s.pts[0].x, m.y - s.pts[0].y);
  if (s.type === 'radial') { const u = unit(sub(s.pts[1], s.pts[0])); return Math.max(0, dot(sub(m, s.pts[1]), u)); }
  const f = linearFrame(s), v = dot(m, f.n);
  if (v >= f.hi) return v - f.hi;
  if (v <= f.lo) return v - f.lo;
  return v - f.hi > f.lo - v ? Math.max(1e-3, v - f.hi) : Math.min(-1e-3, v - f.lo);
}

export function dimHandles(s: DimensionSpec): Array<{ at: Pt; which: number }> {
  const out = s.pts.map((p, i) => ({ at: p, which: i }));
  if (s.type === 'linear') {
    const f = linearFrame(s), L = s.offset >= 0 ? f.hi + s.offset : f.lo + s.offset;
    out.push({ at: mid(add(f.a, f.n, L - dot(f.a, f.n)), add(f.b, f.n, L - dot(f.b, f.n))), which: -1 });
  } else if (s.type === 'angular') {
    const g = angularFrame(s), t = g.ta + g.sweep / 2;
    out.push({ at: { x: g.c.x + g.r * Math.cos(t), y: g.c.y + g.r * Math.sin(t) }, which: -1 });
  } else {
    const u = unit(sub(s.pts[1], s.pts[0]));
    out.push({ at: add(s.pts[1], u, Math.max(s.offset, 0)), which: -1 });
  }
  return out;
}

interface Built { lines: PathData; heads: PathData; label: { at: Pt; dir: Pt; up: Pt; breakAt?: { a: Pt; b: Pt } } }

function head(tip: Pt, d: Pt, s: DimensionSpec, out: Built): void {
  const z = s.arrowSize, p = perp(d), w = z * 0.32;
  if (s.arrow === 'filled') out.heads.push({ closed: true, pts: [anchor(tip.x, tip.y), anchor(tip.x - d.x * z + p.x * w, tip.y - d.y * z + p.y * w), anchor(tip.x - d.x * z - p.x * w, tip.y - d.y * z - p.y * w)] });
  else if (s.arrow === 'open') out.lines.push({ closed: false, pts: [anchor(tip.x - d.x * z + p.x * w, tip.y - d.y * z + p.y * w), anchor(tip.x, tip.y), anchor(tip.x - d.x * z - p.x * w, tip.y - d.y * z - p.y * w)] });
  else if (s.arrow === 'tick') { const k = unit(add(d, p)), h = z * 0.5; out.lines.push({ closed: false, pts: [anchor(tip.x - k.x * h, tip.y - k.y * h), anchor(tip.x + k.x * h, tip.y + k.y * h)] }); }
  else if (s.arrow === 'dot') { const r = z * 0.22; out.heads.push(...ellipsePath(tip.x - r, tip.y - r, 2 * r, 2 * r)); }
}

const seg = (a: Pt, b: Pt): PathData[number] => ({ closed: false, pts: [anchor(a.x, a.y), anchor(b.x, b.y)] });

function build(s: DimensionSpec): Built {
  const out: Built = { lines: [], heads: [], label: { at: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, up: { x: 0, y: -1 } } };
  const gap = Math.max(1, s.arrowSize * 0.35), ext = Math.max(1.5, s.arrowSize * 0.5);
  if (s.type === 'linear') {
    const f = linearFrame(s), L = s.offset >= 0 ? f.hi + s.offset : f.lo + s.offset;
    const A = add(f.a, f.n, L - dot(f.a, f.n)), B = add(f.b, f.n, L - dot(f.b, f.n));
    for (const [p, q] of [[f.a, A], [f.b, B]] as const) {
      const v = dot(sub(q, p), f.n), sg = Math.sign(v);
      if (Math.abs(v) > gap) out.lines.push(seg(add(p, f.n, sg * gap), add(q, f.n, sg * ext)));
    }
    out.lines.push(seg(A, B));
    const d = unit(sub(B, A), f.u);
    head(B, d, s, out); head(A, { x: -d.x, y: -d.y }, s, out);
    out.label = { at: mid(A, B), dir: d, up: s.offset >= 0 ? f.n : { x: -f.n.x, y: -f.n.y }, breakAt: { a: A, b: B } };
  } else if (s.type === 'angular') {
    const g = angularFrame(s), te = g.ta + g.sweep, sg = Math.sign(g.sweep) || 1;
    for (const p of [s.pts[1], s.pts[2]]) {
      const dv = sub(p, g.c), l = Math.hypot(dv.x, dv.y), u = unit(dv);
      if (g.r > l + gap) out.lines.push(seg(add(g.c, u, l + gap), add(g.c, u, g.r + ext)));
    }
    out.lines.push({ closed: false, pts: arcSegmentPath(g.c.x, g.c.y, g.r, g.r, g.ta, te) });
    const at = (t: number): Pt => ({ x: g.c.x + g.r * Math.cos(t), y: g.c.y + g.r * Math.sin(t) });
    head(at(g.ta), { x: sg * Math.sin(g.ta), y: -sg * Math.cos(g.ta) }, s, out);
    head(at(te), { x: -sg * Math.sin(te), y: sg * Math.cos(te) }, s, out);
    const tm = g.ta + g.sweep / 2, up = { x: Math.cos(tm), y: Math.sin(tm) };
    out.label = { at: at(tm), dir: { x: -up.y, y: up.x }, up };
  } else {
    const c = s.pts[0], a = s.pts[1], u = unit(sub(a, c)), r = Math.hypot(a.x - c.x, a.y - c.y), tail = add(a, u, Math.max(0, s.offset));
    const start = s.radial === 'diameter' ? add(c, u, -r) : c;
    out.lines.push(seg(start, tail));
    const cm = Math.max(2, s.arrowSize * 0.5);
    out.lines.push(seg({ x: c.x - cm, y: c.y }, { x: c.x + cm, y: c.y }), seg({ x: c.x, y: c.y - cm }, { x: c.x, y: c.y + cm }));
    head(a, u, s, out);
    if (s.radial === 'diameter') head(start, { x: -u.x, y: -u.y }, s, out);
    const lab = s.offset > s.arrowSize ? mid(a, tail) : mid(start, a);
    out.label = { at: lab, dir: u, up: perp(u), breakAt: { a: start, b: tail } };
  }
  return out;
}

const cache = new WeakMap<DimensionSpec, { key: string; kids: VNode[] }>();

export function dimensionChildren(id: string, s: DimensionSpec, docUnits: Units): VNode[] {
  const key = `${id}|${docUnits}`, hit = cache.get(s);
  if (hit && hit.key === key) return hit.kids;
  const b = build(s), color = solid(s.color);
  let dir = b.label.dir;
  if (dir.x < -1e-9 || (Math.abs(dir.x) <= 1e-9 && dir.y > 0)) dir = { x: -dir.x, y: -dir.y };
  const textUp = { x: dir.y, y: -dir.x };
  const t = { id: `${id}-dt`, ...textNode(dimLabel(s, docUnits), 0, 0, { font: s.font, style: s.style, size: s.size, fill: color }, { align: 'center' }) } as TextNode;
  const gap = Math.max(1.5, s.size * 0.3), onUp = dot(b.label.up, textUp) >= 0, near = gap + s.size * 0.1, far = -(gap + s.size * 0.72);
  const lift = s.textPos === 'center' ? -s.size * 0.35 : (s.textPos === 'above') === onUp ? near : far;
  const o = add(b.label.at, textUp, lift);
  const xf: Mat = [dir.x, dir.y, -dir.y, dir.x, o.x, o.y];
  const label: TextNode = { ...t, xf };
  let lines = b.lines;
  if (s.textPos === 'center' && b.label.breakAt) {
    const w = layoutText(label).bounds.w + gap * 2, { a, b: z } = b.label.breakAt, L = Math.hypot(z.x - a.x, z.y - a.y), m = b.label.at, du = unit(sub(z, a));
    const k = lines.findIndex((sp) => sp.pts.length === 2 && sp.pts[0].x === a.x && sp.pts[0].y === a.y && sp.pts[1].x === z.x && sp.pts[1].y === z.y);
    if (k >= 0 && L > w) {
      const p0 = add(m, du, -w / 2), p1 = add(m, du, w / 2), parts = [] as PathData;
      if (dot(sub(p0, a), du) > 0) parts.push(seg(a, p0));
      if (dot(sub(z, p1), du) > 0) parts.push(seg(p1, z));
      lines = [...lines.slice(0, k), ...parts, ...lines.slice(k + 1)];
    }
  }
  const base = { opacity: 1, blend: 'normal' as const };
  const kids: VNode[] = [{ id: `${id}-dl`, kind: 'path', d: lines, rule: 'nonzero', ap: { items: [stroke(color, s.weight)], effects: [] }, ...base } as PathNode];
  if (b.heads.length) kids.push({ id: `${id}-dh`, kind: 'path', d: b.heads, rule: 'nonzero', ap: { items: [fill(color)], effects: [] }, ...base } as PathNode);
  kids.push(label);
  cache.set(s, { key, kids });
  return kids;
}

export function dimensionNode(s: DimensionSpec, docUnits: Units, id = newId('g')): GroupNode {
  return { id, kind: 'group', name: s.type === 'linear' ? 'Linear Dimension' : s.type === 'angular' ? 'Angular Dimension' : 'Radial Dimension', clip: false, dim: s, children: dimensionChildren(id, s, docUnits), opacity: 1, blend: 'normal', ap: emptyAppearance() };
}

export function refreshDimensions(doc: Doc): Doc {
  const fix: string[] = [];
  walk(doc.layers, (n) => {
    if (n.kind !== 'group' || !n.dim) return;
    const k = dimensionChildren(n.id, n.dim, doc.units);
    if (k.length !== n.children.length || k.some((c, i) => c !== n.children[i])) fix.push(n.id);
    return false;
  });
  if (!fix.length) return doc;
  return updateNodes(doc, fix, (n) => (n.kind === 'group' && n.dim ? { ...n, children: dimensionChildren(n.id, n.dim, doc.units) } : n));
}

export function circleFrom(n: VNode): { c: Pt; r: number } | null {
  if (n.kind !== 'path') return null;
  if (n.live?.kind === 'ellipse') {
    const L = n.live, m = L.xf, cx = L.x + L.w / 2, cy = L.y + L.h / 2;
    const c = { x: m[0] * cx + m[2] * cy + m[4], y: m[1] * cx + m[3] * cy + m[5] };
    return { c, r: (Math.hypot(m[0], m[1]) * L.w + Math.hypot(m[2], m[3]) * L.h) / 4 };
  }
  const pts = n.d.flatMap((sp) => sp.pts);
  if (pts.length < 3 || n.d.length !== 1) return null;
  const c = circumcentre(pts[0], pts[Math.floor(pts.length / 3)], pts[Math.floor((2 * pts.length) / 3)]);
  if (!c) return null;
  const r = Math.hypot(pts[0].x - c.x, pts[0].y - c.y);
  return pts.every((p) => Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - r) < Math.max(0.05, r * 0.01)) ? { c, r } : null;
}

export function circumcentre(a: Pt, b: Pt, c: Pt): Pt | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
  return { x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d, y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d };
}
