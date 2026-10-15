import paper from 'paper/dist/paper-core';
import { cornered } from './corners';
import { anchor, EPS } from './geometry';
import type { Anchor, FillRule, Join, PathData, Pt, SubPath } from './types';

let scope: paper.PaperScope | null = null;
function ps(): paper.PaperScope {
  if (!scope) {
    scope = new paper.PaperScope();
    scope.setup(new scope.Size(1, 1));
    scope.settings.insertItems = false;
  }
  scope.activate();
  return scope;
}

function toPaperPath(sp: SubPath): paper.Path {
  const s = ps();
  const segs = sp.pts.map((a) => new s.Segment(new s.Point(a.x, a.y), new s.Point(a.ix - a.x, a.iy - a.y), new s.Point(a.ox - a.x, a.oy - a.y)));
  const p = new s.Path({ segments: segs, closed: sp.closed, insert: false });
  return p;
}

export function toPaper(d: PathData, rule: FillRule = 'nonzero'): paper.PathItem {
  const s = ps();
  const children = cornered(d).filter((sp) => sp.pts.length > 0).map(toPaperPath);
  if (children.length === 1) { children[0].fillRule = rule; return children[0]; }
  const c = new s.CompoundPath({ children, insert: false });
  c.fillRule = rule;
  return c;
}

function fromPaperPath(p: paper.Path): SubPath {
  const pts: Anchor[] = p.segments.map((sg) => {
    const x = sg.point.x, y = sg.point.y;
    const a = anchor(x, y, x + sg.handleIn.x, y + sg.handleIn.y, x + sg.handleOut.x, y + sg.handleOut.y);
    if (!sg.handleIn.isZero() && !sg.handleOut.isZero() && Math.abs(sg.handleIn.normalize().dot(sg.handleOut.normalize()) + 1) < 1e-3) a.smooth = true;
    return a;
  });
  return { closed: p.closed, pts };
}

export function fromPaper(item: paper.Item | null): PathData {
  if (!item) return [];
  const s = ps();
  if (item instanceof s.Path) return item.segments.length ? [fromPaperPath(item)] : [];
  if (item instanceof s.CompoundPath) return (item.children as paper.Path[]).filter((c) => c.segments.length).map(fromPaperPath);
  if (item instanceof s.Group) return (item.children as paper.Item[]).flatMap((c) => fromPaper(c));
  return [];
}

export type BoolOp = 'unite' | 'intersect' | 'subtract' | 'exclude' | 'divide';

export function boolean(a: PathData, b: PathData, op: BoolOp, ruleA: FillRule = 'nonzero', ruleB: FillRule = 'nonzero'): PathData {
  const pa = toPaper(a, ruleA), pb = toPaper(b, ruleB);
  const r = op === 'unite' ? pa.unite(pb, { insert: false }) : op === 'intersect' ? pa.intersect(pb, { insert: false }) : op === 'subtract' ? pa.subtract(pb, { insert: false }) : op === 'exclude' ? pa.exclude(pb, { insert: false }) : pa.divide(pb, { insert: false });
  return cleanup(fromPaper(r));
}

export function uniteAll(paths: Array<{ d: PathData; rule: FillRule }>): PathData {
  if (!paths.length) return [];
  let acc: paper.PathItem = toPaper(paths[0].d, paths[0].rule);
  for (let i = 1; i < paths.length; i++) acc = acc.unite(toPaper(paths[i].d, paths[i].rule), { insert: false });
  return cleanup(fromPaper(acc));
}

export function resolveSelf(d: PathData, rule: FillRule): PathData {
  const p = toPaper(d, rule);
  const r = (p as paper.PathItem).unite(new (ps().Path)({ insert: false }), { insert: false });
  return cleanup(fromPaper(r));
}

export function cleanup(d: PathData): PathData {
  return d.map((sp) => {
    const pts: Anchor[] = [];
    for (const a of sp.pts) {
      const last = pts[pts.length - 1];
      if (last && Math.abs(last.x - a.x) < 1e-6 && Math.abs(last.y - a.y) < 1e-6) { last.ox = a.ox; last.oy = a.oy; continue; }
      pts.push({ ...a });
    }
    if (sp.closed && pts.length > 1) { const f = pts[0], l = pts[pts.length - 1]; if (Math.abs(f.x - l.x) < 1e-6 && Math.abs(f.y - l.y) < 1e-6) { f.ix = l.ix; f.iy = l.iy; pts.pop(); } }
    return { closed: sp.closed, pts };
  }).filter((sp) => sp.pts.length > (sp.closed ? 2 : 1) || (sp.pts.length > 1 && !sp.closed));
}

export function area(d: PathData): number {
  const p = toPaper(d);
  return Math.abs((p as paper.PathItem & { area: number }).area);
}

export function contains(d: PathData, rule: FillRule, pt: Pt): boolean { return toPaper(d, rule).contains(new (ps().Point)(pt.x, pt.y)); }

export function intersections(a: SubPath, b: SubPath): Array<{ pt: Pt; offsetA: number; offsetB: number }> {
  const pa = toPaperPath(a), pb = toPaperPath(b);
  return pa.getIntersections(pb).map((loc) => ({ pt: { x: loc.point.x, y: loc.point.y }, offsetA: loc.offset, offsetB: loc.intersection?.offset ?? 0 }));
}

export function splitAtOffsets(sp: SubPath, offsets: number[]): SubPath[] {
  const p = toPaperPath(sp);
  const sorted = [...offsets].sort((x, y) => y - x);
  const pieces: paper.Path[] = [];
  let cur: paper.Path | null = p;
  if (sp.closed && sorted.length) {
    const first = sorted[sorted.length - 1];
    const r = cur.splitAt(first);
    if (r) cur = r;
    cur.closed = false;
    const adj = sorted.slice(0, -1).map((o) => o - first).map((o) => (o < 0 ? o + p.length : o));
    for (const o of adj.sort((x, y) => y - x)) { const r2 = cur.splitAt(o); if (r2) pieces.unshift(r2); }
    pieces.unshift(cur);
    return pieces.map(fromPaperPath).filter((s) => s.pts.length > 1);
  }
  for (const o of sorted) { if (!cur) break; if (o <= EPS || o >= cur.length - EPS) continue; const r = cur.splitAt(o); if (r) pieces.unshift(r); }
  if (cur) pieces.unshift(cur);
  return pieces.map(fromPaperPath).filter((s) => s.pts.length > 1);
}

export function simplifyPath(d: PathData, tolerance: number): PathData {
  return d.map((sp) => { const p = toPaperPath(sp); p.simplify(Math.max(0.01, tolerance)); return fromPaperPath(p); });
}
export function smoothPath(d: PathData, factor = 0.4): PathData {
  return d.map((sp) => { const p = toPaperPath(sp); p.smooth({ type: 'geometric', factor }); return fromPaperPath(p); });
}
export function flattenPath(d: PathData, flatness: number): PathData {
  return d.map((sp) => { const p = toPaperPath(sp); p.flatten(Math.max(0.05, flatness)); return fromPaperPath(p); });
}

function joinOf(j: Join): 'miter' | 'round' | 'bevel' { return j; }

function arcPts(c: Pt, r: number, a0: number, a1: number, out: Pt[]): void {
  let sweep = a1 - a0;
  while (sweep > Math.PI) sweep -= Math.PI * 2;
  while (sweep < -Math.PI) sweep += Math.PI * 2;
  const n = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 16)));
  for (let i = 1; i < n; i++) { const a = a0 + (sweep * i) / n; out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }); }
}

function sideOffsets(pts: Pt[], closed: boolean, hw: number, join: Join, miter: number): Pt[] {
  const n = pts.length, out: Pt[] = [];
  const dir = (a: Pt, b: Pt): Pt => { const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; };
  const segCount = closed ? n : n - 1;
  const dirs: Pt[] = [];
  for (let i = 0; i < segCount; i++) dirs.push(dir(pts[i], pts[(i + 1) % n]));
  const nrm = (d: Pt): Pt => ({ x: -d.y * hw, y: d.x * hw });
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const hasPrev = closed || i > 0, hasNext = closed || i < n - 1;
    const d0 = hasPrev ? dirs[(i - 1 + segCount) % segCount] : null, d1 = hasNext ? dirs[i % segCount] : null;
    if (!d0 && d1) { const q = nrm(d1); out.push({ x: p.x + q.x, y: p.y + q.y }); continue; }
    if (d0 && !d1) { const q = nrm(d0); out.push({ x: p.x + q.x, y: p.y + q.y }); continue; }
    if (!d0 || !d1) continue;
    const n0 = nrm(d0), n1 = nrm(d1), cross = d0.x * d1.y - d0.y * d1.x, dot = d0.x * d1.x + d0.y * d1.y;
    const a = { x: p.x + n0.x, y: p.y + n0.y }, b = { x: p.x + n1.x, y: p.y + n1.y };
    if (Math.abs(cross) < 1e-9 && dot > 0) { out.push(a); continue; }
    const outer = cross * hw < 0;
    if (!outer) { out.push(a, p, b); continue; }
    out.push(a);
    if (join === 'round') arcPts(p, Math.abs(hw), Math.atan2(n0.y, n0.x), Math.atan2(n1.y, n1.x), out);
    else if (join === 'miter') {
      const bis = { x: n0.x + n1.x, y: n0.y + n1.y }, bl = Math.hypot(bis.x, bis.y);
      const cosHalf = bl / (2 * Math.abs(hw));
      if (cosHalf > 1e-6 && 1 / cosHalf <= miter) { const len = Math.abs(hw) / cosHalf; out.push({ x: p.x + (bis.x / bl) * len, y: p.y + (bis.y / bl) * len }); }
    }
    out.push(b);
  }
  return out;
}

function capPts(at: Pt, d: Pt, hw: number, cap: 'butt' | 'round' | 'square', out: Pt[]): void {
  const n = { x: -d.y * hw, y: d.x * hw };
  if (cap === 'square') { out.push({ x: at.x + n.x + d.x * hw, y: at.y + n.y + d.y * hw }, { x: at.x - n.x + d.x * hw, y: at.y - n.y + d.y * hw }); }
  else if (cap === 'round') {
    const a0 = Math.atan2(n.y, n.x), k = 12;
    for (let i = 1; i < k; i++) { const a = a0 - (Math.PI * i) / k; out.push({ x: at.x + Math.cos(a) * hw, y: at.y + Math.sin(a) * hw }); }
  }
}

export function strokeToPath(d: PathData, width: number, cap: 'butt' | 'round' | 'square', join: Join, miter: number): PathData {
  const out: PathData = [];
  const hw = width / 2;
  let curved = false;
  for (const sp of d) {
    if (sp.pts.length < 2) continue;
    if (sp.pts.some((a) => Math.abs(a.ix - a.x) + Math.abs(a.iy - a.y) + Math.abs(a.ox - a.x) + Math.abs(a.oy - a.y) > 1e-9)) curved = true;
    const p = toPaperPath(sp);
    if (curved) p.flatten(Math.max(0.02, Math.min(0.25, width / 40)));
    const pts = p.segments.map((s) => ({ x: s.point.x, y: s.point.y }));
    const uniq = pts.filter((q, i) => i === 0 || Math.hypot(q.x - pts[i - 1].x, q.y - pts[i - 1].y) > 1e-7);
    if (sp.closed && uniq.length > 2 && Math.hypot(uniq[0].x - uniq[uniq.length - 1].x, uniq[0].y - uniq[uniq.length - 1].y) < 1e-7) uniq.pop();
    if (uniq.length < 2) continue;
    if (sp.closed) {
      const left = sideOffsets(uniq, true, hw, join, miter), right = sideOffsets(uniq, true, -hw, join, miter).reverse();
      out.push({ closed: true, pts: left.map((q) => anchor(q.x, q.y)) }, { closed: true, pts: right.map((q) => anchor(q.x, q.y)) });
    } else {
      const left = sideOffsets(uniq, false, hw, join, miter), right = sideOffsets(uniq, false, -hw, join, miter).reverse();
      const ring: Pt[] = [...left];
      const e = uniq[uniq.length - 1], e0 = uniq[uniq.length - 2], ed = { x: e.x - e0.x, y: e.y - e0.y }, el = Math.hypot(ed.x, ed.y) || 1;
      capPts(e, { x: ed.x / el, y: ed.y / el }, hw, cap, ring);
      ring.push(...right);
      const s0 = uniq[0], s1 = uniq[1], sd = { x: s0.x - s1.x, y: s0.y - s1.y }, sl = Math.hypot(sd.x, sd.y) || 1;
      capPts(s0, { x: sd.x / sl, y: sd.y / sl }, hw, cap, ring);
      out.push({ closed: true, pts: ring.map((q) => anchor(q.x, q.y)) });
    }
  }
  if (!out.length) return [];
  let merged: PathData;
  try { merged = cleanup(fromPaper(toPaper(out, 'nonzero').unite(new (ps().Path)({ insert: false }), { insert: false }))); } catch { merged = out; }
  if (curved) merged = merged.map((sp) => simplifyKeepingCorners(sp, Math.max(0.01, Math.min(0.08, width / 200))));
  return merged;
}

function simplifyKeepingCorners(sp: SubPath, tol: number): SubPath {
  const P = sp.pts.map((a) => ({ x: a.x, y: a.y })), n = P.length;
  if (n < 4) return sp;
  const turn = (i: number): number => {
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y, lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    return lu < 1e-9 || lv < 1e-9 ? 0 : Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv))));
  };
  const corners: number[] = [];
  for (let i = 0; i < n; i++) if ((!sp.closed && (i === 0 || i === n - 1)) || turn(i) > 0.45) corners.push(i);
  if (sp.closed && !corners.length) { const q = toPaperPath(sp); q.simplify(tol); return fromPaperPath(q); }
  const s = ps(), out: Anchor[] = [], runs = sp.closed ? corners.length : corners.length - 1;
  for (let k = 0; k < runs; k++) {
    const i0 = corners[k], i1 = corners[(k + 1) % corners.length], run: Pt[] = [];
    for (let i = i0; ; i = (i + 1) % n) { run.push(P[i]); if (i === i1 && run.length > 1) break; }
    let part: Anchor[];
    if (run.length < 3) part = run.map((q) => anchor(q.x, q.y));
    else { const q = new s.Path({ segments: run.map((v) => new s.Point(v.x, v.y)), closed: false, insert: false }); q.simplify(tol); part = fromPaperPath(q).pts; }
    const last = out[out.length - 1];
    if (last) { last.ox = part[0].ox; last.oy = part[0].oy; last.smooth = false; out.push(...part.slice(1)); } else out.push(...part);
  }
  if (sp.closed && out.length > 1) { const f = out[0], l = out[out.length - 1]; if (Math.abs(f.x - l.x) < 1e-6 && Math.abs(f.y - l.y) < 1e-6) { f.ix = l.ix; f.iy = l.iy; f.smooth = false; out.pop(); } }
  return { closed: sp.closed, pts: out };
}

export function offsetPath(d: PathData, offset: number, join: Join = 'miter', miter = 4, rule: FillRule = 'nonzero'): PathData {
  if (Math.abs(offset) < 1e-6) return d;
  const closed = d.filter((sp) => sp.closed && sp.pts.length > 1), open = d.filter((sp) => !sp.closed && sp.pts.length > 1);
  let result: PathData = [];
  if (closed.length) {
    const ring = strokeToPath(closed, Math.abs(offset) * 2, 'butt', joinOf(join), miter);
    const base = resolveSelf(closed, rule);
    result = offset > 0 ? boolean(base, ring, 'unite') : boolean(base, ring, 'subtract');
  }
  if (open.length && offset > 0) result = result.concat(strokeToPath(open, offset * 2, 'butt', join, miter));
  return result;
}

export function splitByLine(d: PathData, a: Pt, b: Pt, rule: FillRule): PathData[] {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 1e-6) return [d];
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, big = 1e6;
  const half = (sign: number): PathData => [{ closed: true, pts: [
    anchor(a.x - ux * big, a.y - uy * big), anchor(a.x + ux * big, a.y + uy * big),
    anchor(a.x + ux * big + nx * big * sign, a.y + uy * big + ny * big * sign), anchor(a.x - ux * big + nx * big * sign, a.y - uy * big + ny * big * sign),
  ] }];
  return [boolean(d, half(1), 'intersect', rule), boolean(d, half(-1), 'intersect', rule)].filter((x) => x.length);
}

export function polyKnife(d: PathData, stroke: Pt[], rule: FillRule): PathData[] {
  if (stroke.length < 2) return [d];
  const cut = strokeToPath([{ closed: false, pts: stroke.map((p) => anchor(p.x, p.y)) }], 0.02, 'butt', 'bevel', 2);
  const remaining = boolean(d, cut, 'subtract', rule);
  const out: PathData[] = [];
  const s = ps(), item = toPaper(remaining, 'nonzero');
  const pieces = item instanceof s.CompoundPath ? (item.children as paper.Path[]) : [item as paper.Path];
  const outers = pieces.filter((p) => p.clockwise === (pieces[0]?.clockwise ?? true));
  const holes = pieces.filter((p) => !outers.includes(p));
  for (const o of outers) {
    const parts: PathData = [fromPaperPath(o)];
    for (const h of holes) if (o.contains(h.interiorPoint)) parts.push(fromPaperPath(h));
    out.push(parts);
  }
  return out.length ? out : [d];
}

export function interiorPoint(d: PathData): Pt | null {
  if (!d.length) return null;
  const q = (toPaper(d, 'nonzero') as paper.PathItem & { interiorPoint: paper.Point | null }).interiorPoint;
  return q ? { x: q.x, y: q.y } : null;
}

export function regionParts(d: PathData): PathData[] {
  if (d.length <= 1) return d.length ? [d] : [];
  const s = ps(), item = toPaper(d, 'nonzero');
  const pieces = item instanceof s.CompoundPath ? (item.children as paper.Path[]) : [item as paper.Path];
  const outers = pieces.filter((p) => p.clockwise === (pieces[0]?.clockwise ?? true));
  if (outers.length <= 1) return [d];
  const holes = pieces.filter((p) => !outers.includes(p));
  return outers.map((o) => [fromPaperPath(o), ...holes.filter((h) => o.contains(h.interiorPoint)).map(fromPaperPath)]);
}
