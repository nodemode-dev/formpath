import { geomBounds } from '../bounds';
import { childrenOf, findNode, newId, parentOf, pathOf, removeNodes, topObjects, updateAt, updateNodes, type IndexPath } from '../doc';
import { anchor, bezPoint, bezSplit, dist, fitCurve, flatIndex, hasIn, hasOut, isLineSeg, pathBounds, rectPath, rectsTouch, reversePath, segOf, segments, splitSegmentAt, unflatIndex } from '../geometry';
import { boolean, cleanup, contains, area, intersections, offsetPath, pathSampler, polyKnife, simplifyPath, simplifyWith, smoothPath, splitAtOffsets, toPaper, fromPaper, type BoolOp } from '../kernel';
import { emptyAppearance, fill, NONE, solid, BLACK } from '../paint';
import { gradientStrokeArt, gradientStrokeNodes, strokeRegion } from '../stroke-gradient';
import { brushGeometry } from '../effects';
import type { Anchor, Doc, FillRule, GroupNode, Join, Paint, PathData, PathNode, Pt, ShapeMode, StrokeItem, SubPath, VNode } from '../types';
import { ungroupNodes, type OpResult } from './objects';
import { arrangement, geometryOf, isLive, liveExpanded, pathfinderNodes, shapeNode, splitContours, type PfOp, type TrapArgs } from '../pathfinder';

export type PathfinderOp = 'unite' | 'minus_front' | 'intersect' | 'exclude' | 'divide' | 'trim' | 'merge' | 'crop' | 'outline' | 'minus_back';
export { arrangement, geometryOf, shapeNode };

export function replaceSelection(doc: Doc, tops: string[], made: VNode[]): OpResult {
  if (!made.length) return { doc: removeNodes(doc, tops), ids: [] };
  const lastId = tops[tops.length - 1];
  let out = removeNodes(doc, tops.filter((id) => id !== lastId));
  const replacement: VNode = made.length === 1 ? made[0] : ({ id: newId('g'), kind: 'group', clip: false, children: made, opacity: 1, blend: 'normal', ap: emptyAppearance() } as GroupNode);
  out = updateAt(out, pathOf(out, lastId) as IndexPath, () => replacement);
  return { doc: out, ids: [replacement.id] };
}

export function pathfinder(doc: Doc, ids: string[], op: PathfinderOp | PfOp, live = false, trap?: TrapArgs, rate?: number): OpResult {
  const all = topObjects(doc, ids);
  const nodes = all.map((id) => findNode(doc, id) as VNode).filter(Boolean);
  if (live && (op === 'unite' || op === 'minus_front' || op === 'intersect' || op === 'exclude')) return makeCompoundShape(doc, all, op);
  const r = pathfinderNodes(nodes, op, { trap, rate });
  if (!r) return { doc, ids: all };
  if (r.add) {
    const last = nodes[nodes.length - 1].id;
    return { doc: updateAt(doc, pathOf(doc, last) as IndexPath, (x) => [x, ...r.made]), ids: r.made.map((m) => m.id) };
  }
  return replaceSelection(doc, r.used, r.made);
}

const SHAPE_MODES: Record<string, (i: number) => ShapeMode> = { unite: () => 'add', intersect: () => 'intersect', exclude: () => 'exclude', minus_front: (i) => (i === 0 ? 'add' : 'subtract') };

export function makeCompoundShape(doc: Doc, ids: string[], op: 'unite' | 'minus_front' | 'intersect' | 'exclude'): OpResult {
  const tops = topObjects(doc, ids).filter((id) => (pathOf(doc, id)?.length ?? 0) > 1);
  const nodes = tops.map((id) => findNode(doc, id) as VNode).filter((n) => !!n && !!geometryOf(n));
  if (nodes.length < 2) return { doc, ids: tops };
  const kids = nodes.map((n, i) => ({ ...n, smode: SHAPE_MODES[op](i) }) as VNode);
  const group: GroupNode = { id: newId('g'), kind: 'group', clip: false, compoundShape: true, name: 'Compound Shape', children: kids, opacity: 1, blend: 'normal', ap: emptyAppearance() };
  return replaceSelection(doc, nodes.map((n) => n.id), [group]);
}

export function setShapeMode(doc: Doc, ids: string[], mode: ShapeMode): OpResult | null {
  const want = new Map<string, ShapeMode>();
  for (const id of ids) {
    const n = findNode(doc, id), par = parentOf(doc, id);
    if (n?.kind === 'group' && n.compoundShape) n.children.forEach((c, i) => want.set(c.id, i === 0 ? 'add' : mode));
    else if (n && par?.kind === 'group' && par.compoundShape) want.set(id, mode);
  }
  if (!want.size) return null;
  return { doc: updateNodes(doc, [...want.keys()], (n) => ({ ...n, smode: want.get(n.id) })), ids };
}

export function releaseCompoundShape(doc: Doc, ids: string[]): OpResult {
  const groups = topObjects(doc, ids).filter((id) => { const n = findNode(doc, id); return n?.kind === 'group' && !!n.compoundShape; });
  if (!groups.length) return { doc, ids };
  const kids = groups.flatMap((id) => (findNode(doc, id) as GroupNode).children.map((c) => c.id));
  const r = ungroupNodes(doc, groups);
  return { doc: updateNodes(r.doc, kids, (n) => { const { smode: _s, ...rest } = n; return rest as VNode; }), ids: r.ids };
}

export function expandCompoundShape(doc: Doc, ids: string[]): OpResult {
  const groups = topObjects(doc, ids).filter((id) => { const n = findNode(doc, id); return n?.kind === 'group' && isLive(n); });
  let out = doc;
  const res: string[] = [];
  for (const id of groups) {
    const g = findNode(out, id) as GroupNode, art = liveExpanded(g);
    out = updateAt(out, pathOf(out, id) as IndexPath, () => (art.length ? art : null));
    res.push(...art.map((a) => a.id));
  }
  return { doc: out, ids: res };
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
export interface PathOpArgs { straight?: boolean; angle?: number; offset?: number; joins?: Join; miterLimit?: number; precision?: number; axis?: 'horizontal' | 'vertical' | 'both'; rows?: number; columns?: number; gutter?: number; anchors?: Map<string, Set<number>> }

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
          const pieces = s.brush ? brushGeometry(out, g.d, s) : null;
          if (pieces) { for (const pc of pieces) parts.push(shapeNode(pc.d, n, { items: [fill(pc.paint ?? s.paint, s.opacity * (pc.opacity ?? 1), s.blend)], effects: [] })); continue; }
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
      const plain = !a.straight && !(a.angle && a.angle > 0);
      return { doc: eachPathNode(doc, tops, (n) => ({ ...n, d: plain ? simplifyPath(n.d, tol) : simplifyWith(n.d, tol, !!a.straight, a.angle ?? 0), live: undefined })), ids: tops };
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
      const picked = new Map<string, Set<number>>();
      for (const [id, set] of a.anchors ?? new Map<string, Set<number>>()) { const real = [...set].filter((i) => i >= 0); if (real.length && findNode(doc, id)?.kind === 'path') picked.set(id, new Set(real)); }
      const whole = new Map<string, Set<number>>();
      const visit = (n: VNode): void => {
        if (n.kind === 'path') { const c = n.d.reduce((s, sp) => s + sp.pts.length, 0); whole.set(n.id, new Set(Array.from({ length: c }, (_, i) => i))); }
        else if (n.kind === 'compound') n.children.forEach(visit);
        else childrenOf(n)?.forEach(visit);
      };
      for (const id of tops) { const n = findNode(doc, id); if (n) visit(n); }
      const sel = picked.size ? picked : whole;
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

function cutSub(sp: SubPath, seg: number, t: number): SubPath[] | null {
  let cur = sp, cut = seg + 1;
  if (t <= 1e-3) cut = seg;
  else if (t >= 1 - 1e-3) cut = (seg + 1) % sp.pts.length;
  else cur = splitSegmentAt(sp, seg, t);
  const pts = cur.pts.map((p) => ({ ...p }));
  const tail = (p: Anchor): Anchor => ({ ...p, ox: p.x, oy: p.y, smooth: undefined });
  const head = (p: Anchor): Anchor => ({ ...p, ix: p.x, iy: p.y, smooth: undefined });
  if (sp.closed) {
    const rot = [...pts.slice(cut), ...pts.slice(0, cut)];
    if (rot.length < 2) return null;
    return [{ closed: false, pts: [head(rot[0]), ...rot.slice(1), tail(rot[0])] }];
  }
  if (cut <= 0 || cut >= pts.length - 1) return null;
  return [{ closed: false, pts: [...pts.slice(0, cut), tail(pts[cut])] }, { closed: false, pts: [head(pts[cut]), ...pts.slice(cut + 1)] }];
}

export function scissorsCut(doc: Doc, id: string, sub: number, seg: number, t: number): OpResult {
  const n = findNode(doc, id);
  if (!n || (n.kind !== 'path' && n.kind !== 'compound')) return { doc, ids: [] };
  if (n.kind === 'compound') {
    let k = 0, done = false;
    const kids = n.children.flatMap((c) => {
      const base = k;
      k += c.d.length;
      const hit = c.d.length === 1 && base === sub;
      const pieces = hit ? cutSub(c.d[0], seg, t) : null;
      if (!pieces) return [c];
      done = true;
      return pieces.map((pc, i) => ({ ...c, id: i === 0 ? c.id : newId('p'), d: [pc], live: undefined }));
    });
    if (!done) return { doc, ids: [] };
    return { doc: updateAt(doc, pathOf(doc, id) as IndexPath, () => [{ ...n, children: kids }]), ids: [id] };
  }
  const sp = n.d[sub];
  const pieces = sp ? cutSub(sp, seg, t) : null;
  if (!sp || !pieces) return { doc, ids: [] };
  const others = n.d.filter((_, i) => i !== sub);
  const nodes: PathNode[] = pieces.map((p, i) => ({ ...n, id: i === 0 ? n.id : newId('p'), d: i === 0 ? [p, ...others] : [p], live: undefined }));
  const out = updateAt(doc, pathOf(doc, id) as IndexPath, () => nodes);
  return { doc: out, ids: nodes.map((x) => x.id) };
}

function outsideRegion(sp: SubPath, region: PathData): SubPath[] | null {
  if (sp.pts.length < 2) return null;
  const offs: number[] = [];
  for (const r of region) { try { for (const x of intersections(sp, r)) offs.push(x.offsetA); } catch { } }
  let pieces: SubPath[] = [sp];
  if (offs.length) { try { pieces = splitAtOffsets(sp, offs); } catch { pieces = [sp]; } }
  const keep = pieces.filter((pc) => { const m = pathSampler([pc])?.at(0.5); return !m || !contains(region, 'nonzero', m); });
  return keep.length === pieces.length ? null : keep;
}

export function eraseRegion(doc: Doc, ids: string[], region: PathData): OpResult {
  let out = doc;
  const res: string[] = [];
  for (const id of ids) {
    const n = findNode(out, id);
    const g = n ? geometryOf(n) : null;
    if (!n || !g) continue;
    const filled = n.ap.items.some((i) => i.kind === 'fill' && i.paint.type !== 'none' && i.visible !== false);
    if (filled && g.d.every((sp) => sp.closed)) {
      if (!boolean(g.d, region, 'intersect', g.rule, 'nonzero').length) continue;
      const left = boolean(g.d, region, 'subtract', g.rule, 'nonzero');
      const rep = left.length ? splitContours(left).map((d) => shapeNode(d, n)) : [];
      out = updateAt(out, pathOf(out, id) as IndexPath, () => (rep.length ? rep : null));
      res.push(...rep.map((r) => r.id));
      continue;
    }
    const sw = Math.max(0, ...n.ap.items.filter((i): i is StrokeItem => i.kind === 'stroke' && i.paint.type !== 'none').map((i) => i.width));
    let reg = region;
    if (sw > 0) { try { const grown = offsetPath(region, sw / 2, 'round'); if (grown.length) reg = grown; } catch { } }
    let touched = false;
    const kept: SubPath[] = [];
    for (const sp of g.d) {
      const r = outsideRegion(sp, reg);
      if (r) { touched = true; kept.push(...r); } else kept.push(sp);
    }
    if (!touched) continue;
    const rep = kept.map((sp) => shapeNode([sp], n));
    out = updateAt(out, pathOf(out, id) as IndexPath, () => (rep.length ? rep : null));
    res.push(...rep.map((r) => r.id));
  }
  return { doc: out, ids: res };
}

export function eraseSegments(doc: Doc, id: string, region: PathData): OpResult {
  const n = findNode(doc, id);
  if (!n || n.kind !== 'path') return { doc, ids: [id] };
  const keep: SubPath[] = [];
  let any = false;
  for (const sp of n.d) {
    let cur: Anchor[] = [];
    const segs = segments(sp);
    const gone = segs.map((s) => {
      const mid = bezPoint(s, 0.5);
      return contains(region, 'nonzero', mid) || contains(region, 'nonzero', s[0]) && contains(region, 'nonzero', s[3]);
    });
    if (!gone.includes(true)) { keep.push(sp); continue; }
    any = true;
    const start = sp.closed ? gone.indexOf(true) : 0;
    for (let k = 0; k < segs.length; k++) {
      const i = (start + k) % segs.length;
      const a = sp.pts[i], b = sp.pts[(i + 1) % sp.pts.length];
      if (gone[i]) { if (cur.length > 1) keep.push({ closed: false, pts: cur }); cur = []; continue; }
      if (!cur.length) cur.push({ ...a });
      cur.push({ ...b });
    }
    if (cur.length > 1) keep.push({ closed: false, pts: cur });
  }
  if (!any) return { doc, ids: [id] };
  const out = updateAt(doc, pathOf(doc, id) as IndexPath, () => (keep.length ? keep.map((sp, i) => ({ ...n, id: i === 0 ? n.id : newId('p'), d: [sp], live: undefined })) : null));
  return { doc: out, ids: [id] };
}

export function smoothRegion(d: PathData, region: PathData, strength: number): PathData {
  return d.map((sp) => {
    const pts = sp.pts.map((p) => ({ ...p }));
    const idx = pts.map((p, i) => (contains(region, 'nonzero', p) ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return sp;
    const first = idx[0], last = idx[idx.length - 1];
    if (last - first + 1 !== idx.length) return sp;
    const lo = Math.max(0, first - 1), hi = Math.min(pts.length - 1, last + 1);
    if (hi - lo < 2) return sp;
    const samples: Pt[] = [];
    for (let i = lo; i < hi; i++) {
      const s = segOf(pts[i], pts[i + 1]), n = 10;
      for (let k = 0; k < n; k++) samples.push(bezPoint(s, k / n));
    }
    samples.push({ x: pts[hi].x, y: pts[hi].y });
    let cur = samples;
    for (let it = 0; it < 6; it++) cur = cur.map((q, i) => (i === 0 || i === cur.length - 1 ? q : { x: cur[i - 1].x * 0.25 + q.x * 0.5 + cur[i + 1].x * 0.25, y: cur[i - 1].y * 0.25 + q.y * 0.5 + cur[i + 1].y * 0.25 }));
    const fit = fitCurve(cur, Math.max(0.05, strength));
    if (fit.length < 2) return sp;
    const a0 = pts[lo], a1 = pts[hi], f0 = fit[0], f1 = fit[fit.length - 1];
    fit[0] = { ...f0, ix: a0.ix, iy: a0.iy, smooth: a0.smooth };
    fit[fit.length - 1] = { ...f1, ox: a1.ox, oy: a1.oy, smooth: a1.smooth };
    return { closed: sp.closed, pts: [...pts.slice(0, lo), ...fit, ...pts.slice(hi + 1)] };
  });
}

export function anchorSegmentsTouch(a: Anchor, b: Anchor): boolean { return isLineSeg(segOf(a, b)) && !hasIn(a) && !hasOut(b); }
export { bezSplit, pathBounds, anchor, cleanup };
