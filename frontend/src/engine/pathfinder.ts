import { childrenOf, cloneNode, newId } from './doc';
import { bezPoint, hasIn, hasOut, pathBounds, scaleAbout, segments, transformPath } from './geometry';
import { area, boolean, cleanup, fromPaper, offsetPath, toPaper, type BoolOp } from './kernel';
import { cmyk, emptyAppearance, fill, luminance, mixColor, NONE, rgb, sameColor, solid, tinted, toCmyk, toRgb, BLACK } from './paint';
import type { Anchor, Color, Effect, FillItem, FillRule, GroupNode, Paint, PathData, PathNode, ShapeMode, SubPath, VNode, CompoundNode } from './types';

export interface Geo { d: PathData; rule: FillRule }
export interface PathfinderOptions { precision: number; removeRedundant: boolean; removeUnpainted: boolean }
export const DEFAULT_PATHFINDER_OPTIONS: PathfinderOptions = { precision: 0.028, removeRedundant: false, removeUnpainted: false };
export interface TrapArgs { thickness: number; heightWidth: number; tintReduction: number; process: boolean; reverse: boolean }
export type PfOp = 'unite' | 'minus_front' | 'intersect' | 'exclude' | 'divide' | 'trim' | 'merge' | 'crop' | 'outline' | 'minus_back' | 'hard_mix' | 'soft_mix' | 'trap';

export const PF_EFFECTS: ReadonlyMap<string, PfOp> = new Map<string, PfOp>([
  ['pathfinder.add', 'unite'], ['pathfinder.intersect', 'intersect'], ['pathfinder.exclude', 'exclude'], ['pathfinder.subtract', 'minus_front'], ['pathfinder.minus_back', 'minus_back'],
  ['pathfinder.divide', 'divide'], ['pathfinder.trim', 'trim'], ['pathfinder.merge', 'merge'], ['pathfinder.crop', 'crop'], ['pathfinder.outline', 'outline'],
  ['pathfinder.hard_mix', 'hard_mix'], ['pathfinder.soft_mix', 'soft_mix'], ['pathfinder.trap', 'trap'],
]);

let opts: PathfinderOptions = { ...DEFAULT_PATHFINDER_OPTIONS };
export const pathfinderOptions = (): PathfinderOptions => opts;

interface Caches { geo: WeakMap<VNode, Geo | null>; step: WeakMap<Geo, WeakMap<VNode, Map<string, Geo>>>; node: WeakMap<Geo, WeakMap<VNode, VNode>>; art: WeakMap<VNode[], WeakMap<Effect[], VNode[]>> }
const fresh = (): Caches => ({ geo: new WeakMap(), step: new WeakMap(), node: new WeakMap(), art: new WeakMap() });
let C = fresh();

export function setPathfinderOptions(patch: Partial<PathfinderOptions>): boolean {
  const next: PathfinderOptions = {
    precision: typeof patch.precision === 'number' && Number.isFinite(patch.precision) ? Math.min(100, Math.max(0.001, patch.precision)) : opts.precision,
    removeRedundant: patch.removeRedundant ?? opts.removeRedundant,
    removeUnpainted: patch.removeUnpainted ?? opts.removeUnpainted,
  };
  if (next.precision === opts.precision && next.removeRedundant === opts.removeRedundant && next.removeUnpainted === opts.removeUnpainted) return false;
  opts = next;
  C = fresh();
  return true;
}

const near = (a: Anchor, b: Anchor, tol: number): boolean => Math.hypot(a.x - b.x, a.y - b.y) < tol;

function mergeNear(d: PathData, tol: number): PathData {
  return d.flatMap((sp) => {
    const res: Anchor[] = [];
    let moved = false;
    for (const a of sp.pts) {
      const last = res[res.length - 1];
      if (last && near(last, a, tol)) { res[res.length - 1] = { ...last, ox: a.ox + (last.x - a.x), oy: a.oy + (last.y - a.y) }; moved = true; continue; }
      res.push(a);
    }
    if (sp.closed && res.length > 1 && near(res[0], res[res.length - 1], tol)) {
      const l = res[res.length - 1];
      res[0] = { ...res[0], ix: l.ix + (res[0].x - l.x), iy: l.iy + (res[0].y - l.y) };
      res.pop();
      moved = true;
    }
    if (res.length < 2) return [];
    if (res.length === 2 && sp.closed && !res.some((a) => hasIn(a) || hasOut(a))) return [];
    return [moved ? { closed: sp.closed, pts: res } : sp];
  });
}

function onLine(a: Anchor, p: Anchor, q: Anchor, tol: number): boolean {
  if (hasIn(a) || hasOut(a) || hasOut(p) || hasIn(q)) return false;
  const dx = q.x - p.x, dy = q.y - p.y, len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return false;
  const t = ((a.x - p.x) * dx + (a.y - p.y) * dy) / len2;
  if (t < 0 || t > 1) return false;
  return Math.abs((a.x - p.x) * dy - (a.y - p.y) * dx) / Math.sqrt(len2) <= tol;
}

function joinsSmoothly(a: Anchor, p: Anchor, q: Anchor, tol: number): boolean {
  if (!hasIn(a) && !hasOut(a)) return false;
  const c1 = Math.hypot(a.x - p.x, a.y - p.y), c2 = Math.hypot(q.x - a.x, q.y - a.y);
  if (c1 < 1e-9 || c2 < 1e-9) return false;
  const t = c1 / (c1 + c2);
  if (t < 0.05 || t > 0.95) return false;
  const m: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
    { x: p.x, y: p.y }, { x: p.x + (p.ox - p.x) / t, y: p.y + (p.oy - p.y) / t }, { x: q.x + (q.ix - q.x) / (1 - t), y: q.y + (q.iy - q.y) / (1 - t) }, { x: q.x, y: q.y },
  ];
  const s1 = segments({ closed: false, pts: [p, a] })[0], s2 = segments({ closed: false, pts: [a, q] })[0];
  for (let k = 1; k < 8; k++) {
    const u = k / 8, e1 = bezPoint(s1, u), g1 = bezPoint(m, t * u), e2 = bezPoint(s2, u), g2 = bezPoint(m, t + (1 - t) * u);
    if (Math.hypot(e1.x - g1.x, e1.y - g1.y) > tol || Math.hypot(e2.x - g2.x, e2.y - g2.y) > tol) return false;
  }
  return true;
}

function dropRedundant(d: PathData, tol: number): PathData {
  return d.map((sp) => {
    const pts = sp.pts.slice();
    const min = sp.closed ? 3 : 2;
    let again = true;
    for (let guard = 0; again && guard < 8; guard++) {
      again = false;
      for (let i = 0; i < pts.length && pts.length > min; i++) {
        if (!sp.closed && (i === 0 || i === pts.length - 1)) continue;
        const n = pts.length, a = pts[i], pi = (i - 1 + n) % n, qi = (i + 1) % n, p = pts[pi], q = pts[qi];
        if (onLine(a, p, q, tol)) { pts.splice(i, 1); i--; again = true; continue; }
        if (joinsSmoothly(a, p, q, tol)) {
          const c1 = Math.hypot(a.x - p.x, a.y - p.y), c2 = Math.hypot(q.x - a.x, q.y - a.y), t = c1 / (c1 + c2);
          pts[pi] = { ...p, ox: p.x + (p.ox - p.x) / t, oy: p.y + (p.oy - p.y) / t };
          pts[qi] = { ...q, ix: q.x + (q.ix - q.x) / (1 - t), iy: q.y + (q.iy - q.y) / (1 - t) };
          pts.splice(i, 1); i--; again = true;
        }
      }
    }
    return pts.length === sp.pts.length ? sp : { closed: sp.closed, pts };
  });
}

function sliver(sp: SubPath, tol: number): boolean {
  const b = pathBounds([sp]);
  return b.w < tol && b.h < tol;
}

export function settle(d: PathData): PathData {
  if (!d.length) return d;
  let out = mergeNear(d, opts.precision).filter((sp) => !sliver(sp, opts.precision));
  if (opts.removeRedundant) out = dropRedundant(out, Math.max(opts.precision, 0.005));
  return out;
}

const bool = (a: PathData, ar: FillRule, b: PathData, br: FillRule, o: BoolOp): PathData => settle(boolean(a, b, o, ar, br));

export function shapeNode(d: PathData, like: VNode, ap?: VNode['ap']): VNode {
  const base = { opacity: like.opacity, blend: like.blend, ap: ap ?? like.ap };
  if (d.length > 1) {
    const c: CompoundNode = { id: newId('c'), kind: 'compound', rule: 'nonzero', children: d.map((sp) => ({ id: newId(), kind: 'path', d: [sp], rule: 'nonzero', opacity: 1, blend: 'normal', ap: emptyAppearance() })), ...base };
    return c;
  }
  const p: PathNode = { id: newId('p'), kind: 'path', d, rule: 'nonzero', ...base };
  return p;
}

export function geometryOf(n: VNode): Geo | null {
  if (n.kind === 'path') return n.guide ? null : { d: n.d, rule: n.rule };
  if (n.kind === 'compound') return { d: n.children.flatMap((c) => c.d), rule: n.rule };
  const ch = n.kind === 'group' ? liveArt(n) ?? childrenOf(n) : childrenOf(n);
  if (ch && n.kind !== 'layer') {
    const parts = ch.map(geometryOf).filter((g): g is Geo => !!g && g.d.length > 0);
    if (!parts.length) return null;
    if (parts.length === 1) return parts[0];
    let acc = parts[0].d;
    for (const p of parts.slice(1)) acc = boolean(acc, p.d, 'unite', 'nonzero', p.rule);
    return { d: acc, rule: 'nonzero' };
  }
  return null;
}

function geoOf(n: VNode): Geo | null {
  if (C.geo.has(n)) return C.geo.get(n) ?? null;
  const g = geometryOf(n);
  C.geo.set(n, g);
  return g;
}

export function splitContours(d: PathData): PathData[] {
  if (d.length <= 1) return [d];
  const item = toPaper(d, 'nonzero') as paper.PathItem & { children?: paper.Path[] };
  const kids = (item.children ?? []) as paper.Path[];
  if (!kids.length) return [d];
  const outer = kids.filter((k) => k.clockwise === kids[0].clockwise);
  if (outer.length <= 1) return [d];
  const owner = (h: paper.Path): paper.Path | undefined => outer.filter((o) => Math.abs(o.area) > Math.abs(h.area) && o.contains(h.interiorPoint)).sort((a, b) => Math.abs(a.area) - Math.abs(b.area))[0];
  return outer.map((o) => [...fromPaper(o), ...kids.filter((h) => h.clockwise !== o.clockwise && owner(h) === o).flatMap((h) => fromPaper(h))]);
}

interface Face { d: PathData; top: number }
export function arrangement(shapes: Geo[]): Face[] {
  let faces: Face[] = [];
  shapes.forEach((s, i) => {
    const next: Face[] = [];
    let rest: PathData = cleanup(s.d);
    for (const f of faces) {
      const inside = boolean(f.d, rest, 'intersect', 'nonzero', s.rule);
      const outside = boolean(f.d, rest, 'subtract', 'nonzero', s.rule);
      if (outside.length && area(outside) > 1e-4) next.push({ d: outside, top: f.top });
      if (inside.length && area(inside) > 1e-4) next.push({ d: inside, top: i });
    }
    for (const f of faces) rest = boolean(rest, f.d, 'subtract', s.rule, 'nonzero');
    if (rest.length && area(rest) > 1e-4) next.push({ d: rest, top: i });
    faces = next;
  });
  return faces.flatMap((f) => splitContours(f.d).map((d) => ({ d: settle(d), top: f.top }))).filter((f) => f.d.length > 0);
}

const MODE_OP: Record<ShapeMode, BoolOp> = { add: 'unite', subtract: 'subtract', intersect: 'intersect', exclude: 'exclude' };
export const shapeModeOf = (n: VNode): ShapeMode => n.smode ?? 'add';

function step(prev: Geo, k: VNode, g: Geo, mode: ShapeMode): Geo {
  let byKid = C.step.get(prev);
  if (!byKid) { byKid = new WeakMap(); C.step.set(prev, byKid); }
  let byMode = byKid.get(k);
  if (!byMode) { byMode = new Map(); byKid.set(k, byMode); }
  const hit = byMode.get(mode);
  if (hit) return hit;
  const made: Geo = { d: bool(prev.d, prev.rule, g.d, g.rule, MODE_OP[mode]), rule: 'nonzero' };
  byMode.set(mode, made);
  return made;
}

function chain(kids: VNode[]): { geo: Geo | null; top: VNode | null } {
  let acc: Geo | null = null, top: VNode | null = null;
  for (const k of kids) {
    if (k.hidden) continue;
    const g = geoOf(k);
    if (!g || !g.d.length) continue;
    top = k;
    acc = acc ? step(acc, k, g, shapeModeOf(k)) : g;
  }
  return { geo: acc, top };
}

export function compoundNode(g: GroupNode): VNode | null {
  const { geo, top } = chain(g.children);
  if (!geo || !geo.d.length || !top) return null;
  let byTop = C.node.get(geo);
  if (!byTop) { byTop = new WeakMap(); C.node.set(geo, byTop); }
  const hit = byTop.get(top);
  if (hit) return hit;
  const made = { ...shapeNode(geo.d, top, top.ap), id: `${g.id}~r` } as VNode;
  byTop.set(top, made);
  return made;
}

const painted = (n: VNode): boolean => n.ap.items.some((i) => i.visible && i.paint.type !== 'none');
const fillPaint = (n: VNode): Paint => { const f = n.ap.items.find((i) => i.kind === 'fill' && i.visible) as FillItem | undefined; return f ? f.paint : NONE; };
const solidOf = (n: VNode): Color | null => { const p = fillPaint(n); return p.type === 'color' ? p.color : null; };

function maxColor(cols: Color[]): Color {
  if (cols.every((c) => c.kind === 'cmyk')) { const k = cols as Array<Extract<Color, { kind: 'cmyk' }>>; return cmyk(Math.max(...k.map((c) => c.c)), Math.max(...k.map((c) => c.m)), Math.max(...k.map((c) => c.y)), Math.max(...k.map((c) => c.k))); }
  const v = cols.map(toRgb);
  return rgb(Math.max(...v.map((c) => c.r)), Math.max(...v.map((c) => c.g)), Math.max(...v.map((c) => c.b)));
}

interface Shape { n: VNode; g: Geo }
export interface PfResult { made: VNode[]; used: string[]; add?: boolean }

function strokeless(n: VNode): VNode['ap'] { return { items: n.ap.items.filter((i) => i.kind === 'fill'), effects: [] }; }

export function trapNodes(shapes: Shape[], a: TrapArgs): PathNode[] {
  const solids = shapes.map((s) => ({ ...s, c: solidOf(s.n) })).filter((s): s is Shape & { c: Color } => !!s.c);
  const f = Math.max(0.05, a.heightWidth / 100), down = scaleAbout(1, f, 0, 0), up = scaleAbout(1, 1 / f, 0, 0), t = Math.max(0.01, a.thickness);
  const made: PathNode[] = [];
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const A = solids[i], B = solids[j];
      if (sameColor(A.c, B.c)) continue;
      const aLight = luminance(A.c) >= luminance(B.c), light = aLight ? A : B, dark = aLight ? B : A;
      const spread = a.reverse ? dark : light, target = a.reverse ? light : dark;
      let strip = boolean(offsetPath(transformPath(spread.g.d, down), t, 'miter', 4, spread.g.rule), transformPath(target.g.d, down), 'intersect', 'nonzero', target.g.rule);
      if (strip.length) strip = boolean(strip, transformPath(spread.g.d, down), 'subtract', 'nonzero', spread.g.rule);
      if (!strip.length) {
        const rim = boolean(transformPath(target.g.d, down), offsetPath(transformPath(target.g.d, down), -t, 'miter', 4, target.g.rule), 'subtract', target.g.rule, 'nonzero');
        strip = rim.length ? boolean(rim, transformPath(spread.g.d, down), 'intersect', 'nonzero', spread.g.rule) : [];
      }
      if (!strip.length) continue;
      strip = transformPath(strip, up);
      let c = tinted(spread.c, 100 - Math.max(0, Math.min(100, a.tintReduction)));
      if (a.process) c = toCmyk(c);
      made.push({ id: newId('p'), kind: 'path', d: settle(strip), rule: 'nonzero', opacity: 1, blend: 'multiply', ap: { items: [fill(solid(c))], effects: [] } });
    }
  }
  return made;
}

export function pathfinderNodes(nodes: VNode[], op: PfOp, a: { rate?: number; trap?: TrapArgs } = {}): PfResult | null {
  const shapes = nodes.map((n) => ({ n, g: geoOf(n) })).filter((x): x is Shape => !!x.g && x.g.d.length > 0);
  if (shapes.length < (op === 'divide' || op === 'outline' || op === 'trim' || op === 'merge' ? 1 : 2)) return null;
  const used = shapes.map((s) => s.n.id);
  const top = shapes[shapes.length - 1], bottom = shapes[0];
  const out = (made: VNode[]): PfResult => ({ made, used });
  const keepPainted = (list: VNode[]): VNode[] => (opts.removeUnpainted ? list.filter(painted) : list);
  if (op === 'unite' || op === 'intersect' || op === 'exclude') {
    let acc = shapes[0].g.d, rule = shapes[0].g.rule;
    for (const s of shapes.slice(1)) { acc = bool(acc, rule, s.g.d, s.g.rule, op); rule = 'nonzero'; }
    return out(acc.length ? [shapeNode(acc, top.n)] : []);
  }
  if (op === 'minus_front') {
    let acc = bottom.g.d, rule = bottom.g.rule;
    for (const s of shapes.slice(1)) { acc = bool(acc, rule, s.g.d, s.g.rule, 'subtract'); rule = 'nonzero'; }
    return out(acc.length ? [shapeNode(acc, bottom.n)] : []);
  }
  if (op === 'minus_back') {
    let acc = top.g.d, rule = top.g.rule;
    for (const s of shapes.slice(0, -1)) { acc = bool(acc, rule, s.g.d, s.g.rule, 'subtract'); rule = 'nonzero'; }
    return out(acc.length ? [shapeNode(acc, top.n)] : []);
  }
  if (op === 'trap') {
    const traps = trapNodes(shapes, a.trap ?? { thickness: 0.25, heightWidth: 100, tintReduction: 40, process: false, reverse: false });
    if (!traps.length) return null;
    const group: GroupNode = { id: newId('g'), kind: 'group', clip: false, children: traps, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, name: 'Traps' };
    return { made: [group], used: [], add: true };
  }
  const faces = arrangement(shapes.map((s) => s.g));
  if (op === 'divide') return out(keepPainted(faces.map((f) => shapeNode(f.d, shapes[f.top].n))));
  if (op === 'hard_mix' || op === 'soft_mix') {
    const k = Math.max(0, Math.min(100, a.rate ?? 50)) / 100;
    return out(faces.map((f) => {
      const base = shapes[f.top].n, size = area(f.d);
      const cols = shapes.filter((s) => area(boolean(f.d, s.g.d, 'intersect', 'nonzero', s.g.rule)) > size * 0.5).map((s) => solidOf(s.n)).filter((c): c is Color => !!c);
      const keep = base.ap.items.filter((i) => i.kind === 'fill');
      if (cols.length < 2) return shapeNode(f.d, base, { items: keep, effects: [] });
      const c = op === 'hard_mix' ? maxColor(cols) : cols.slice(1).reduce((acc, x) => mixColor(acc, x, k), cols[0]);
      const items = keep.length ? keep.map((i) => (i.kind === 'fill' && i.visible ? { ...i, paint: solid(c) } : i)) : [fill(solid(c))];
      return shapeNode(f.d, base, { items, effects: [] });
    }));
  }
  if (op === 'trim' || op === 'merge') {
    const made = faces.map((f) => ({ f, n: shapes[f.top].n }));
    if (op === 'merge') {
      const groups = new Map<string, { d: PathData; n: VNode }>();
      for (const m of made) {
        const key = JSON.stringify(fillPaint(m.n));
        const g = groups.get(key);
        groups.set(key, g ? { d: bool(g.d, 'nonzero', m.f.d, 'nonzero', 'unite'), n: g.n } : { d: m.f.d, n: m.n });
      }
      return out([...groups.values()].flatMap((g) => splitContours(g.d).map((d) => shapeNode(d, g.n, strokeless(g.n)))));
    }
    const byTop = new Map<number, PathData>();
    for (const m of made) byTop.set(m.f.top, [...(byTop.get(m.f.top) ?? []), ...m.f.d]);
    return out([...byTop.entries()].sort((x, y) => x[0] - y[0]).map(([i, d]) => shapeNode(settle(cleanup(d)), shapes[i].n, strokeless(shapes[i].n))));
  }
  if (op === 'crop') {
    const cropper = top.g, under = shapes.slice(0, -1);
    const kept: Array<{ d: PathData; n: VNode }> = [];
    under.forEach((s, i) => {
      let vis = s.g.d, rule = s.g.rule;
      for (const above of under.slice(i + 1)) { vis = boolean(vis, above.g.d, 'subtract', rule, above.g.rule); rule = 'nonzero'; }
      const d = bool(vis, rule, cropper.d, cropper.rule, 'intersect');
      if (d.length) kept.push({ d, n: s.n });
    });
    return out(kept.map((k) => shapeNode(k.d, k.n, strokeless(k.n))));
  }
  const lines: VNode[] = [];
  for (const s of shapes) {
    const p = fillPaint(s.n);
    for (const sp of s.g.d) lines.push({ id: newId('p'), kind: 'path', d: [{ ...sp, closed: sp.closed }], rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [{ kind: 'stroke', paint: p.type === 'none' ? solid(BLACK) : p, width: 1, cap: 'butt', join: 'miter', miter: 10, align: 'center', dash: [], dashOffset: 0, dashCorners: false, startArrow: 'none', endArrow: 'none', arrowScale: [100, 100], arrowAlign: 'extend', profile: null, brush: null, opacity: 1, blend: 'normal', visible: true, effects: [] }], effects: [] } });
  }
  return out(keepPainted(lines.map((l) => (l.kind === 'path' ? { ...l, d: settle(l.d) } : l)).filter((l) => l.kind !== 'path' || l.d.length > 0)));
}

export const isLive = (n: VNode): boolean => n.kind === 'group' && !n.clip && (!!n.compoundShape || n.ap.effects.some((e) => e.visible && PF_EFFECTS.has(e.id)));

function effectArgs(e: Effect): { rate?: number; trap?: TrapArgs } {
  const num = (k: string, d: number): number => { const v = e.params[k]; return typeof v === 'number' && Number.isFinite(v) ? v : d; };
  return { rate: num('rate', 50), trap: { thickness: num('thickness', 0.25), heightWidth: num('height_width', 100), tintReduction: num('tint_reduction', 40), process: e.params.process === true, reverse: e.params.reverse === true } };
}

export function liveArt(n: GroupNode, outline = false): VNode[] | null {
  if (!isLive(n)) return null;
  if (outline) return n.children;
  if (n.compoundShape) { const r = compoundNode(n); return r ? [r] : []; }
  let byFx = C.art.get(n.children);
  if (!byFx) { byFx = new WeakMap(); C.art.set(n.children, byFx); }
  const hit = byFx.get(n.ap.effects);
  if (hit) return hit;
  let nodes = n.children.filter((c) => !c.hidden);
  for (const e of n.ap.effects) {
    const op = e.visible ? PF_EFFECTS.get(e.id) : undefined;
    if (!op) continue;
    const r = pathfinderNodes(nodes, op, effectArgs(e));
    if (r) nodes = r.add ? [...nodes, ...r.made] : r.made;
  }
  byFx.set(n.ap.effects, nodes);
  return nodes;
}

export function liveExpanded(g: GroupNode): VNode[] {
  const art = (liveArt(g) ?? g.children).map((c) => cloneNode(c));
  const rest = g.ap.effects.filter((e) => !PF_EFFECTS.has(e.id));
  if (g.compoundShape && g.opacity === 1 && g.blend === 'normal' && !g.mask && !g.ap.items.length && !rest.length) return art;
  return [{ ...g, id: newId('g'), compoundShape: undefined, children: art, ap: { ...g.ap, effects: rest } }];
}
