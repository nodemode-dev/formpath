import { geomBounds } from '../bounds';
import { childrenOf, findNode, newId, pathOf, removeNodes, topObjects, updateAt, updateNodes, type IndexPath } from '../doc';
import { anchor, bezSplit, dist, flatIndex, hasIn, hasOut, isLineSeg, pathBounds, rectPath, rectsTouch, reversePath, segOf, segments, splitSegmentAt, unflatIndex } from '../geometry';
import { boolean, cleanup, contains, area, offsetPath, polyKnife, simplifyPath, smoothPath, toPaper, fromPaper, type BoolOp } from '../kernel';
import { emptyAppearance, fill, NONE, solid, BLACK } from '../paint';
import { gradientStrokeArt, gradientStrokeNodes, strokeRegion } from '../stroke-gradient';
import type { Anchor, CompoundNode, Doc, FillItem, FillRule, GroupNode, Join, Paint, PathData, PathNode, Pt, StrokeItem, SubPath, VNode } from '../types';
import type { OpResult } from './objects';

export type PathfinderOp = 'unite' | 'minus_front' | 'intersect' | 'exclude' | 'divide' | 'trim' | 'merge' | 'crop' | 'outline' | 'minus_back';

export function geometryOf(n: VNode): { d: PathData; rule: FillRule } | null {
  if (n.kind === 'path') return n.guide ? null : { d: n.d, rule: n.rule };
  if (n.kind === 'compound') return { d: n.children.flatMap((c) => c.d), rule: n.rule };
  const ch = childrenOf(n);
  if (ch && n.kind !== 'layer') {
    const parts = ch.map(geometryOf).filter((g): g is { d: PathData; rule: FillRule } => !!g && g.d.length > 0);
    if (!parts.length) return null;
    if (parts.length === 1) return parts[0];
    let acc = parts[0].d;
    for (const p of parts.slice(1)) acc = boolean(acc, p.d, 'unite', 'nonzero', p.rule);
    return { d: acc, rule: 'nonzero' };
  }
  return null;
}

function shapeNode(d: PathData, like: VNode, ap?: VNode['ap']): VNode {
  const base = { opacity: like.opacity, blend: like.blend, ap: ap ?? like.ap };
  if (d.length > 1) {
    const c: CompoundNode = { id: newId('c'), kind: 'compound', rule: 'nonzero', children: d.map((sp) => ({ id: newId(), kind: 'path', d: [sp], rule: 'nonzero', opacity: 1, blend: 'normal', ap: emptyAppearance() })), ...base };
    return c;
  }
  const p: PathNode = { id: newId('p'), kind: 'path', d, rule: 'nonzero', ...base };
  return p;
}

function fillPaint(n: VNode): Paint { const f = n.ap.items.find((i) => i.kind === 'fill' && i.visible) as FillItem | undefined; return f ? f.paint : NONE; }
function paintKeyOf(p: Paint): string { return JSON.stringify(p); }

function replaceSelection(doc: Doc, tops: string[], made: VNode[]): OpResult {
  if (!made.length) return { doc: removeNodes(doc, tops), ids: [] };
  const lastId = tops[tops.length - 1];
  let out = removeNodes(doc, tops.filter((id) => id !== lastId));
  const replacement: VNode = made.length === 1 ? made[0] : ({ id: newId('g'), kind: 'group', clip: false, children: made, opacity: 1, blend: 'normal', ap: emptyAppearance() } as GroupNode);
  out = updateAt(out, pathOf(out, lastId) as IndexPath, () => replacement);
  return { doc: out, ids: [replacement.id] };
}

interface Face { d: PathData; top: number }
export function arrangement(shapes: Array<{ d: PathData; rule: FillRule }>): Face[] {
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
  return faces.flatMap((f) => splitContours(f.d).map((d) => ({ d, top: f.top })));
}

function splitContours(d: PathData): PathData[] {
  if (d.length <= 1) return [d];
  const item = toPaper(d, 'nonzero') as paper.PathItem & { children?: paper.Path[] };
  const kids = (item.children ?? []) as paper.Path[];
  if (!kids.length) return [d];
  const outer = kids.filter((k) => k.clockwise === kids[0].clockwise);
  if (outer.length <= 1) return [d];
  return outer.map((o) => [...fromPaper(o), ...kids.filter((h) => h.clockwise !== o.clockwise && o.contains(h.interiorPoint)).flatMap((h) => fromPaper(h))]);
}

export function pathfinder(doc: Doc, ids: string[], op: PathfinderOp): OpResult {
  const all = topObjects(doc, ids);
  const nodes = all.map((id) => findNode(doc, id) as VNode).filter(Boolean);
  const shapes = nodes.map((n) => ({ n, g: geometryOf(n) })).filter((x): x is { n: VNode; g: { d: PathData; rule: FillRule } } => !!x.g && x.g.d.length > 0);
  if (shapes.length < (op === 'divide' || op === 'outline' || op === 'trim' || op === 'merge' ? 1 : 2)) return { doc, ids: all };
  const tops = shapes.map((s) => s.n.id);
  const top = shapes[shapes.length - 1], bottom = shapes[0];
  const bin = (a: PathData, ar: FillRule, b: PathData, br: FillRule, o: BoolOp): PathData => boolean(a, b, o, ar, br);
  if (op === 'unite' || op === 'intersect' || op === 'exclude') {
    let acc = shapes[0].g.d, rule = shapes[0].g.rule;
    for (const s of shapes.slice(1)) { acc = bin(acc, rule, s.g.d, s.g.rule, op); rule = 'nonzero'; }
    return replaceSelection(doc, tops, acc.length ? [shapeNode(acc, top.n)] : []);
  }
  if (op === 'minus_front') {
    let acc = bottom.g.d, rule = bottom.g.rule;
    for (const s of shapes.slice(1)) { acc = bin(acc, rule, s.g.d, s.g.rule, 'subtract'); rule = 'nonzero'; }
    return replaceSelection(doc, tops, acc.length ? [shapeNode(acc, bottom.n)] : []);
  }
  if (op === 'minus_back') {
    let acc = top.g.d, rule = top.g.rule;
    for (const s of shapes.slice(0, -1)) { acc = bin(acc, rule, s.g.d, s.g.rule, 'subtract'); rule = 'nonzero'; }
    return replaceSelection(doc, tops, acc.length ? [shapeNode(acc, top.n)] : []);
  }
  const faces = arrangement(shapes.map((s) => s.g));
  const strokeless = (n: VNode): VNode['ap'] => ({ items: n.ap.items.filter((i) => i.kind === 'fill'), effects: [] });
  if (op === 'divide') return replaceSelection(doc, tops, faces.map((f) => shapeNode(f.d, shapes[f.top].n)));
  if (op === 'trim' || op === 'merge') {
    const made = faces.map((f) => ({ f, n: shapes[f.top].n }));
    if (op === 'merge') {
      const groups = new Map<string, { d: PathData; n: VNode }>();
      for (const m of made) {
        const k = paintKeyOf(fillPaint(m.n));
        const g = groups.get(k);
        groups.set(k, g ? { d: boolean(g.d, m.f.d, 'unite'), n: g.n } : { d: m.f.d, n: m.n });
      }
      return replaceSelection(doc, tops, [...groups.values()].flatMap((g) => splitContours(g.d).map((d) => shapeNode(d, g.n, strokeless(g.n)))));
    }
    const byTop = new Map<number, PathData>();
    for (const m of made) byTop.set(m.f.top, [...(byTop.get(m.f.top) ?? []), ...m.f.d]);
    return replaceSelection(doc, tops, [...byTop.entries()].sort((a, b) => a[0] - b[0]).map(([i, d]) => shapeNode(cleanup(d), shapes[i].n, strokeless(shapes[i].n))));
  }
  if (op === 'crop') {
    const cropper = top.g, under = shapes.slice(0, -1);
    const kept: Array<{ d: PathData; n: VNode }> = [];
    under.forEach((s, i) => {
      let vis = s.g.d, rule = s.g.rule;
      for (const above of under.slice(i + 1)) { vis = boolean(vis, above.g.d, 'subtract', rule, above.g.rule); rule = 'nonzero'; }
      const d = boolean(vis, cropper.d, 'intersect', rule, cropper.rule);
      if (d.length) kept.push({ d, n: s.n });
    });
    return replaceSelection(doc, tops, kept.map((k) => shapeNode(k.d, k.n, strokeless(k.n))));
  }
  const lines: VNode[] = [];
  for (const s of shapes) {
    const p = fillPaint(s.n);
    for (const sp of s.g.d) lines.push({ id: newId('p'), kind: 'path', d: [{ ...sp, closed: sp.closed }], rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [{ kind: 'stroke', paint: p.type === 'none' ? solid(BLACK) : p, width: 1, cap: 'butt', join: 'miter', miter: 10, align: 'center', dash: [], dashOffset: 0, dashCorners: false, startArrow: 'none', endArrow: 'none', arrowScale: [100, 100], arrowAlign: 'extend', profile: null, brush: null, opacity: 1, blend: 'normal', visible: true, effects: [] }], effects: [] } });
  }
  return replaceSelection(doc, tops, lines);
}

export function shapeBuild(doc: Doc, ids: string[], points: Pt[], erase: boolean, paintOverride?: Paint | null): OpResult {
  const tops = topObjects(doc, ids);
  const shapes = tops.map((id) => ({ id, n: findNode(doc, id) as VNode })).map((x) => ({ ...x, g: x.n ? geometryOf(x.n) : null })).filter((x): x is { id: string; n: VNode; g: { d: PathData; rule: FillRule } } => !!x.g);
  if (!shapes.length) return { doc, ids: tops };
  const faces = arrangement(shapes.map((s) => s.g));
  const picked = new Set<number>();
  faces.forEach((f, i) => { if (points.some((p) => contains(f.d, 'nonzero', p))) picked.add(i); });
  if (!picked.size) return { doc, ids: tops };
  const keep = faces.filter((_, i) => !picked.has(i));
  const made: VNode[] = keep.map((f) => shapeNode(f.d, shapes[f.top].n));
  const used = shapes.map((s) => s.id);
  if (!erase) {
    let merged: PathData = [];
    let style: VNode = shapes[faces[[...picked][0]].top].n;
    for (const i of picked) { merged = merged.length ? boolean(merged, faces[i].d, 'unite') : faces[i].d; style = shapes[faces[i].top].n; }
    const n = shapeNode(merged, style);
    if (paintOverride) n.ap = { ...n.ap, items: n.ap.items.map((it) => (it.kind === 'fill' ? { ...it, paint: paintOverride } : it)) };
    made.push(n);
  }
  return replaceSelection(doc, used, made);
}


export type PathOp = 'offset' | 'outline_stroke' | 'simplify' | 'smooth' | 'join' | 'average' | 'reverse' | 'add_anchors' | 'remove_anchors' | 'divide_objects_below' | 'split_into_grid' | 'clean_up' | 'close' | 'open';
export interface PathOpArgs { offset?: number; joins?: Join; miterLimit?: number; precision?: number; axis?: 'horizontal' | 'vertical' | 'both'; rows?: number; columns?: number; gutter?: number; anchors?: Map<string, Set<number>> }

function eachPathNode(doc: Doc, ids: string[], fn: (n: PathNode) => PathNode | VNode | VNode[] | null): Doc {
  const targets: string[] = [];
  const visit = (n: VNode): void => { if (n.kind === 'path') targets.push(n.id); else if (n.kind !== 'compound') childrenOf(n)?.forEach(visit); };
  for (const id of ids) { const n = findNode(doc, id); if (n) { if (n.kind === 'compound') targets.push(...n.children.map((c) => c.id)); else visit(n); } }
  return updateNodes(doc, targets, (n) => (n.kind === 'path' ? fn(n) : n));
}

export function pathOperation(doc: Doc, ids: string[], op: PathOp, a: PathOpArgs = {}): OpResult {
  const tops = topObjects(doc, ids);
  switch (op) {
    case 'offset': {
      const made: string[] = [];
      let out = doc;
      for (const id of tops) {
        const n = findNode(out, id);
        const g = n ? geometryOf(n) : null;
        if (!n || !g) continue;
        const d = offsetPath(g.d, a.offset ?? 10, a.joins ?? 'miter', a.miterLimit ?? 4, g.rule);
        if (!d.length) continue;
        const copy = shapeNode(d, n);
        const p = pathOf(out, id) as IndexPath;
        out = updateAt(out, p, (x) => (a.offset ?? 10) >= 0 ? [copy, x] : [x, copy]);
        made.push(copy.id);
      }
      return { doc: out, ids: made };
    }
    case 'outline_stroke': {
      let out = doc;
      const res: string[] = [];
      for (const id of tops) {
        const n = findNode(out, id);
        if (!n || (n.kind !== 'path' && n.kind !== 'compound')) { res.push(id); continue; }
        const g = geometryOf(n) as { d: PathData; rule: FillRule };
        const strokes = n.ap.items.filter((i) => i.kind === 'stroke' && i.visible) as StrokeItem[];
        const fills = n.ap.items.filter((i) => i.kind === 'fill' && i.visible);
        if (!strokes.length) { res.push(id); continue; }
        const parts: VNode[] = [];
        if (fills.length && fills.some((f) => f.paint.type !== 'none')) parts.push(shapeNode(g.d, n, { items: fills, effects: [] }));
        for (const s of strokes) {
          const d = strokeRegion(g.d, g.rule, s), art = gradientStrokeArt(out, g.d, s, g.rule);
          if (art) parts.push(...gradientStrokeNodes(art, d, s));
          else if (d.length) parts.push(shapeNode(d, n, { items: [fill(s.paint, s.opacity, s.blend)], effects: [] }));
        }
        const rep: VNode = parts.length === 1 ? parts[0] : ({ id: newId('g'), kind: 'group', clip: false, children: parts, opacity: n.opacity, blend: n.blend, ap: emptyAppearance() } as GroupNode);
        out = updateAt(out, pathOf(out, id) as IndexPath, () => rep);
        res.push(rep.id);
      }
      return { doc: out, ids: res };
    }
    case 'simplify': {
      const tol = 0.05 + (1 - Math.max(0, Math.min(100, a.precision ?? 50)) / 100) * 6;
      return { doc: eachPathNode(doc, tops, (n) => ({ ...n, d: simplifyPath(n.d, tol), live: undefined })), ids: tops };
    }
    case 'smooth': return { doc: eachPathNode(doc, tops, (n) => ({ ...n, d: smoothPath(n.d, 0.4), live: undefined })), ids: tops };
    case 'reverse': return { doc: eachPathNode(doc, tops, (n) => ({ ...n, d: reversePath(n.d) })), ids: tops };
    case 'close': return { doc: eachPathNode(doc, tops, (n) => ({ ...n, d: n.d.map((sp) => ({ ...sp, closed: sp.pts.length > 1 })) })), ids: tops };
    case 'open': return { doc: eachPathNode(doc, tops, (n) => ({ ...n, d: n.d.map((sp) => ({ ...sp, closed: false })), live: undefined })), ids: tops };
    case 'add_anchors': return { doc: eachPathNode(doc, tops, (n) => ({ ...n, live: undefined, d: n.d.map((sp) => { let cur = sp; const segCount = segments(sp).length; for (let i = segCount - 1; i >= 0; i--) cur = splitSegmentAt(cur, i, 0.5); return cur; }) })), ids: tops };
    case 'remove_anchors': {
      const sel = a.anchors ?? new Map();
      return { doc: eachPathNode(doc, tops, (n) => { const s = sel.get(n.id); if (!s || !s.size) return n; const d = removeAnchors(n.d, s); return d.length ? { ...n, d, live: undefined } : null; }), ids: tops };
    }
    case 'average': {
      const sel = a.anchors ?? new Map();
      const pts: Pt[] = [];
      for (const [id, set] of sel) { const n = findNode(doc, id); if (n?.kind === 'path') for (const i of set) { const u = unflatIndex(n.d, i); if (u) pts.push(n.d[u[0]].pts[u[1]]); } }
      if (!pts.length) return { doc, ids: tops };
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length, ax = a.axis ?? 'both';
      const out = updateNodes(doc, [...sel.keys()], (n) => {
        if (n.kind !== 'path') return n;
        const set = sel.get(n.id) as Set<number>;
        return { ...n, live: undefined, d: n.d.map((sp, si) => ({ ...sp, pts: sp.pts.map((p, i) => { if (!set.has(flatIndex(n.d, si, i))) return p; const nx = ax === 'vertical' ? p.x : cx, ny = ax === 'horizontal' ? p.y : cy, dx = nx - p.x, dy = ny - p.y; return { ...p, x: nx, y: ny, ix: p.ix + dx, iy: p.iy + dy, ox: p.ox + dx, oy: p.oy + dy }; }) })) };
      });
      return { doc: out, ids: tops };
    }
    case 'join': return joinPaths(doc, tops, a.anchors ?? new Map());
    case 'divide_objects_below': return divideBelow(doc, tops);
    case 'split_into_grid': {
      const rows = Math.max(1, a.rows ?? 2), cols = Math.max(1, a.columns ?? 2), gut = a.gutter ?? 12;
      let out = doc;
      const made: string[] = [];
      for (const id of tops) {
        const n = findNode(out, id);
        if (!n) continue;
        const b = geomBounds(out, n), cw = (b.w - gut * (cols - 1)) / cols, rh = (b.h - gut * (rows - 1)) / rows;
        if (cw <= 0 || rh <= 0) continue;
        const cells: VNode[] = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ id: newId('p'), kind: 'path', d: rectPath(b.x + c * (cw + gut), b.y + r * (rh + gut), cw, rh), rule: 'nonzero', opacity: n.opacity, blend: n.blend, ap: n.ap });
        out = updateAt(out, pathOf(out, id) as IndexPath, () => cells);
        made.push(...cells.map((x) => x.id));
      }
      return { doc: out, ids: made };
    }
    case 'clean_up': return { doc, ids: tops };
  }
}

function removeAnchors(d: PathData, sel: Set<number>): PathData {
  return d.map((sp, si) => {
    const keep = sp.pts.filter((_, i) => !sel.has(flatIndex(d, si, i)));
    return { closed: sp.closed && keep.length > 2, pts: keep };
  }).filter((sp) => sp.pts.length > 1);
}

export function joinPaths(doc: Doc, ids: string[], anchors: Map<string, Set<number>>): OpResult {
  const paths = ids.map((id) => findNode(doc, id)).filter((n): n is PathNode => !!n && n.kind === 'path');
  if (paths.length === 1) {
    const n = paths[0];
    const d = n.d.map((sp) => (sp.closed || sp.pts.length < 2 ? sp : (() => {
      const pts = sp.pts.map((p) => ({ ...p })), f = pts[0], l = pts[pts.length - 1];
      if (dist(f, l) < 0.01) { f.ix = l.ix; f.iy = l.iy; pts.pop(); }
      return { closed: true, pts };
    })()));
    return { doc: updateNodes(doc, [n.id], () => ({ ...n, d, live: undefined })), ids: [n.id] };
  }
  if (paths.length < 2) return { doc, ids };
  const opens = paths.filter((p) => p.d.length === 1 && !p.d[0].closed);
  if (opens.length < 2) return { doc, ids };
  let acc: SubPath = { closed: false, pts: opens[0].d[0].pts.map((p) => ({ ...p })) };
  const rest = opens.slice(1).map((p) => p.d[0]);
  while (rest.length) {
    let bi = 0, bd = Infinity, mode = 0;
    rest.forEach((sp, i) => {
      const a0 = acc.pts[0], a1 = acc.pts[acc.pts.length - 1], b0 = sp.pts[0], b1 = sp.pts[sp.pts.length - 1];
      const cands = [dist(a1, b0), dist(a1, b1), dist(a0, b1), dist(a0, b0)];
      cands.forEach((v, m) => { if (v < bd) { bd = v; bi = i; mode = m; } });
    });
    let sp = rest.splice(bi, 1)[0];
    if (mode === 1 || mode === 3) sp = reversePath([sp])[0];
    const joinPts = (x: Anchor[], y: Anchor[]): Anchor[] => {
      const last = x[x.length - 1], first = y[0];
      if (dist(last, first) < 0.01) { const merged: Anchor = { ...last, ox: first.ox, oy: first.oy }; return [...x.slice(0, -1), merged, ...y.slice(1)]; }
      return [...x, ...y];
    };
    acc = { closed: false, pts: mode === 0 || mode === 1 ? joinPts(acc.pts, sp.pts) : joinPts(sp.pts, acc.pts) };
  }
  void anchors;
  const keep = opens[opens.length - 1];
  const joined: PathNode = { ...opens[0], id: newId('p'), d: [acc], live: undefined };
  let out = removeNodes(doc, opens.filter((p) => p.id !== keep.id).map((p) => p.id));
  out = updateAt(out, pathOf(out, keep.id) as IndexPath, () => joined);
  return { doc: out, ids: [joined.id] };
}

function divideBelow(doc: Doc, tops: string[]): OpResult {
  const cutterId = tops[tops.length - 1], cutter = findNode(doc, cutterId);
  const cg = cutter ? geometryOf(cutter) : null;
  if (!cutter || !cg) return { doc, ids: tops };
  const cb = geomBounds(doc, cutter);
  let out = removeNodes(doc, [cutterId]);
  const made: string[] = [];
  const victims: string[] = [];
  const visit = (n: VNode): void => {
    if (n.hidden || n.locked) return;
    if ((n.kind === 'path' || n.kind === 'compound') && rectsTouch(geomBounds(out, n), cb)) victims.push(n.id);
    else if (n.kind !== 'compound') childrenOf(n)?.forEach(visit);
  };
  out.layers.forEach(visit);
  for (const id of victims) {
    const n = findNode(out, id);
    const g = n ? geometryOf(n) : null;
    if (!n || !g) continue;
    const inside = boolean(g.d, cg.d, 'intersect', g.rule, cg.rule), outside = boolean(g.d, cg.d, 'subtract', g.rule, cg.rule);
    if (!inside.length || !outside.length) continue;
    const a = shapeNode(outside, n), b = shapeNode(inside, n);
    out = updateAt(out, pathOf(out, id) as IndexPath, () => [a, b]);
    made.push(a.id, b.id);
  }
  return { doc: out, ids: made };
}

export function knifeCut(doc: Doc, ids: string[], stroke: Pt[]): OpResult {
  let out = doc;
  const made: string[] = [];
  for (const id of ids) {
    const n = findNode(out, id);
    const g = n ? geometryOf(n) : null;
    if (!n || !g || !g.d.every((sp) => sp.closed)) continue;
    const pieces = polyKnife(g.d, stroke, g.rule);
    if (pieces.length < 2) continue;
    const nodes = pieces.map((d) => shapeNode(d, n));
    out = updateAt(out, pathOf(out, id) as IndexPath, () => nodes);
    made.push(...nodes.map((x) => x.id));
  }
  return { doc: out, ids: made };
}

export function scissorsCut(doc: Doc, id: string, sub: number, seg: number, t: number): OpResult {
  const n = findNode(doc, id);
  if (!n || n.kind !== 'path') return { doc, ids: [id] };
  const sp = n.d[sub];
  if (!sp) return { doc, ids: [id] };
  let cur = sp, cut = seg + 1;
  if (t <= 1e-3) cut = seg;
  else if (t >= 1 - 1e-3) cut = (seg + 1) % sp.pts.length;
  else cur = splitSegmentAt(sp, seg, t);
  const pts = cur.pts.map((p) => ({ ...p }));
  let pieces: SubPath[];
  if (sp.closed) {
    const rot = [...pts.slice(cut), ...pts.slice(0, cut)];
    rot.push({ ...rot[0] });
    pieces = [{ closed: false, pts: rot }];
  } else {
    pieces = [{ closed: false, pts: pts.slice(0, cut + 1) }, { closed: false, pts: [{ ...pts[cut] }, ...pts.slice(cut + 1)] }].filter((p) => p.pts.length > 1);
  }
  const others = n.d.filter((_, i) => i !== sub);
  const nodes: PathNode[] = pieces.map((p, i) => ({ ...n, id: i === 0 ? n.id : newId('p'), d: i === 0 ? [p, ...others] : [p], live: undefined }));
  const out = updateAt(doc, pathOf(doc, id) as IndexPath, () => nodes);
  return { doc: out, ids: nodes.map((x) => x.id) };
}

export function eraseRegion(doc: Doc, ids: string[], region: PathData): OpResult {
  let out = doc;
  const res: string[] = [];
  for (const id of ids) {
    const n = findNode(out, id);
    const g = n ? geometryOf(n) : null;
    if (!n || !g) continue;
    if (g.d.every((sp) => sp.closed)) {
      const left = boolean(g.d, region, 'subtract', g.rule, 'nonzero');
      const rep = left.length ? splitContours(left).map((d) => shapeNode(d, n)) : [];
      out = updateAt(out, pathOf(out, id) as IndexPath, () => (rep.length ? rep : null));
      res.push(...rep.map((r) => r.id));
    }
  }
  return { doc: out, ids: res };
}

export function eraseSegments(doc: Doc, id: string, region: PathData): OpResult {
  const n = findNode(doc, id);
  if (!n || n.kind !== 'path') return { doc, ids: [id] };
  const keep: SubPath[] = [];
  for (const sp of n.d) {
    let cur: Anchor[] = [];
    const segs = segments(sp);
    segs.forEach((s, i) => {
      const mid = { x: (s[0].x + s[3].x) / 2, y: (s[0].y + s[3].y) / 2 };
      const gone = contains(region, 'nonzero', mid) || contains(region, 'nonzero', s[0]) && contains(region, 'nonzero', s[3]);
      const a = sp.pts[i], b = sp.pts[(i + 1) % sp.pts.length];
      if (gone) { if (cur.length > 1) keep.push({ closed: false, pts: cur }); cur = []; return; }
      if (!cur.length) cur.push({ ...a });
      cur.push({ ...b });
    });
    if (cur.length > 1) keep.push({ closed: false, pts: cur });
  }
  const out = updateAt(doc, pathOf(doc, id) as IndexPath, () => (keep.length ? keep.map((sp, i) => ({ ...n, id: i === 0 ? n.id : newId('p'), d: [sp], live: undefined })) : null));
  return { doc: out, ids: [id] };
}

export function smoothRegion(d: PathData, region: PathData, strength: number): PathData {
  return d.map((sp) => {
    const pts = sp.pts.map((p) => ({ ...p }));
    const idx = pts.map((p, i) => (contains(region, 'nonzero', p) ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 3) return sp;
    const poly = pts.map((p) => ({ x: p.x, y: p.y }));
    const sub = { closed: sp.closed, pts: idx.map((i) => pts[i]) };
    const sm = smoothPath(simplifyPath([sub], 0.5 + strength), 0.4)[0];
    void poly;
    if (!sm) return sp;
    const first = idx[0], last = idx[idx.length - 1];
    if (last - first + 1 !== idx.length) return sp;
    return { closed: sp.closed, pts: [...pts.slice(0, first), ...sm.pts, ...pts.slice(last + 1)] };
  });
}

export function anchorSegmentsTouch(a: Anchor, b: Anchor): boolean { return isLineSeg(segOf(a, b)) && !hasIn(a) && !hasOut(b); }
export { bezSplit, pathBounds, anchor, cleanup };
