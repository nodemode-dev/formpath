import { findNode } from '../engine/doc';
import { anchor, flatIndex, hasIn, hasOut, nearestOnPath, reversePath, splitSegmentAt, unflatIndex } from '../engine/geometry';
import { anchorHit } from '../engine/hit';
import { constrainAngle } from '../engine/snap';
import type { Anchor, Doc, Engine, PathData, PathNode, Pt, SubPath, VNode } from '../engine';
import { registerTool, type ToolContext, type ToolPointer } from '../extensions/registry';
import { CURSORS } from '../ui/cursors';
import { replaceNode } from './select';
import { anchorDot, layerColor, tolDoc } from './util';

function pathNode(doc: Doc, id: string): PathNode | null { const n = findNode(doc, id); return n?.kind === 'path' ? n : null; }

function setPath(doc: Doc, id: string, d: PathData): Doc {
  const n = findNode(doc, id);
  if (!n || n.kind !== 'path') return doc;
  return replaceNode(doc, id, { ...n, d, live: undefined });
}

interface PenState { id: string | null; dragging: boolean; closing: boolean; down: Pt; hover: Pt | null; cursor: string; moved: boolean }
const P: PenState = { id: null, dragging: false, closing: false, down: { x: 0, y: 0 }, hover: null, cursor: CURSORS.pen, moved: false };

function draft(e: Engine): SubPath | null {
  const pr = e.current;
  if (!pr || !P.id) return null;
  const n = pathNode(pr.doc, P.id);
  if (!n || n.d.length !== 1 || n.d[0].closed) { P.id = null; return null; }
  return n.d[0];
}

function finish(ctx: ToolContext): void {
  const e = ctx.engine;
  if (P.id) { const pr = e.current; if (pr) e.setAnchors(P.id, new Set([-2])); }
  P.id = null; P.closing = false; P.dragging = false;
  ctx.redraw();
}

function endpointUnder(e: Engine, p: Pt, tol: number): { id: string; first: boolean } | null {
  const pr = e.current;
  if (!pr) return null;
  for (const id of e.selectedIds()) {
    const n = pathNode(pr.doc, id);
    if (!n || n.d.length !== 1 || n.d[0].closed) continue;
    const pts = n.d[0].pts;
    if (pts.length && Math.hypot(pts[pts.length - 1].x - p.x, pts[pts.length - 1].y - p.y) <= tol) return { id, first: false };
    if (pts.length > 1 && Math.hypot(pts[0].x - p.x, pts[0].y - p.y) <= tol) return { id, first: true };
  }
  return null;
}

function segmentUnder(e: Engine, p: Pt, tol: number): { id: string; sub: number; seg: number; t: number } | null {
  const pr = e.current;
  if (!pr) return null;
  for (const id of e.selectedIds()) {
    const n = pathNode(pr.doc, id);
    if (!n) continue;
    const r = nearestOnPath(n.d, p);
    if (r && r.d <= tol) return { id, sub: r.sub, seg: r.seg, t: r.t };
  }
  return null;
}

function anchorUnder(e: Engine, p: Pt, tol: number): { id: string; index: number; part: 'anchor' | 'in' | 'out' } | null {
  const pr = e.current;
  if (!pr) return null;
  const nodes = e.selectedIds().map((id) => findNode(pr.doc, id)).filter((n): n is VNode => n?.kind === 'path');
  const h = anchorHit(pr.doc, nodes, p, tol, (id) => pr.anchors.get(id) ?? null);
  return h ? { id: h.id, index: h.index, part: h.part } : null;
}

export function addAnchorAt(e: Engine, id: string, sub: number, seg: number, t: number): void {
  e.edit('Add Anchor Point', (doc) => {
    const n = pathNode(doc, id);
    if (!n) return doc;
    const d = n.d.map((sp, k) => (k === sub ? splitSegmentAt(sp, seg, t) : sp));
    return { doc: setPath(doc, id, d), select: [id] };
  });
  e.setAnchors(id, new Set([flatIndex(pathNode(e.doc as Doc, id)?.d ?? [], sub, seg + 1)]));
}

export function deleteAnchorAt(e: Engine, id: string, index: number): void {
  e.edit('Delete Anchor Point', (doc) => {
    const n = pathNode(doc, id);
    if (!n) return doc;
    const u = unflatIndex(n.d, index);
    if (!u) return doc;
    const d = n.d.map((sp, k) => (k === u[0] ? { ...sp, pts: sp.pts.filter((_, i) => i !== u[1]) } : sp)).filter((sp) => sp.pts.length > 0);
    if (!d.length) return { doc: replaceNode(doc, id, { ...n, d: [] }), select: [] };
    return { doc: setPath(doc, id, d), select: [id] };
  });
}

function convertAnchor(e: Engine, id: string, index: number): void {
  e.edit('Convert Anchor Point', (doc) => {
    const n = pathNode(doc, id);
    if (!n) return doc;
    let k = 0;
    const d = n.d.map((sp) => ({ ...sp, pts: sp.pts.map((a) => (k++ === index ? { ...a, ix: a.x, iy: a.y, ox: a.x, oy: a.y, smooth: false } : a)) }));
    return setPath(doc, id, d);
  });
}

function pullHandles(a: Anchor, q: Pt, breakIt: boolean): Anchor {
  return breakIt ? { ...a, ox: q.x, oy: q.y, smooth: false } : { ...a, ox: q.x, oy: q.y, ix: 2 * a.x - q.x, iy: 2 * a.y - q.y, smooth: true };
}

registerTool({
  id: 'pen', label: 'Pen Tool', group: 'pen', order: 20, shortcut: 'P',
  icon: () => 'vPen',
  hint: () => 'Click to place corner points, drag to pull out curve handles. Click the first point to close; Enter or Escape ends an open path. Alt while dragging breaks the handle. Click a segment of a selected path to add a point, an anchor to delete it.',
  cursor: () => P.cursor,
  activate: () => { P.id = null; },
  deactivate: (ctx) => finish(ctx),
  hover: (ctx, p) => {
    P.hover = p ? p.doc : null;
    const e = ctx.engine, t = tolDoc(ctx, 5);
    let c: string = CURSORS.pen;
    if (p) {
      const sp = draft(e);
      if (sp) {
        const first = sp.pts[0];
        c = sp.pts.length > 1 && Math.hypot(first.x - p.doc.x, first.y - p.doc.y) <= t ? CURSORS.penClose : CURSORS.penPlain;
        const last = sp.pts[sp.pts.length - 1];
        if (Math.hypot(last.x - p.doc.x, last.y - p.doc.y) <= t) c = CURSORS.penConvert;
      } else if (endpointUnder(e, p.doc, t)) c = CURSORS.penContinue;
      else if (anchorUnder(e, p.doc, t)?.part === 'anchor') c = CURSORS.penDelete;
      else if (segmentUnder(e, p.doc, t)) c = CURSORS.penAdd;
    }
    P.cursor = c;
    ctx.redraw();
  },
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const t = tolDoc(ctx, 5);
    P.down = p.doc; P.moved = false;
    let sp = draft(e);
    if (!sp) {
      const ep = endpointUnder(e, p.doc, t);
      if (ep) {
        const n = pathNode(pr.doc, ep.id) as PathNode;
        if (ep.first) e.edit('Reverse Path Direction', (d) => setPath(d, ep.id, reversePath(n.d)));
        P.id = ep.id;
        e.select([ep.id]);
        e.setAnchors(ep.id, new Set([n.d[0].pts.length - 1]));
        return;
      }
      const ah = anchorUnder(e, p.doc, t);
      if (ah && ah.part === 'anchor') { deleteAnchorAt(e, ah.id, ah.index); return; }
      const sg = segmentUnder(e, p.doc, t);
      if (sg) { addAnchorAt(e, sg.id, sg.sub, sg.seg, sg.t); return; }
      const q = ctx.snap(p.doc).p;
      const node = e.makePath([{ closed: false, pts: [anchor(q.x, q.y)] }]);
      node.ap = e.newArtAppearance(false);
      e.addNodes('Pen', [node]);
      P.id = node.id;
      e.setAnchors(node.id, new Set([0]));
      P.dragging = true;
      e.beginDrag('Pen');
      return;
    }
    const id = P.id as string, pts = sp.pts, first = pts[0], last = pts[pts.length - 1];
    if (pts.length > 1 && Math.hypot(first.x - p.doc.x, first.y - p.doc.y) <= t) {
      P.closing = true; P.dragging = true;
      e.edit('Close Path', (d) => setPath(d, id, [{ closed: true, pts }]));
      e.setAnchors(id, new Set([0]));
      e.beginDrag('Pen');
      return;
    }
    if (Math.hypot(last.x - p.doc.x, last.y - p.doc.y) <= t) {
      e.edit('Convert Anchor Point', (d) => setPath(d, id, [{ closed: false, pts: [...pts.slice(0, -1), { ...last, ox: last.x, oy: last.y, smooth: false }] }]));
      P.dragging = true;
      e.beginDrag('Pen');
      return;
    }
    let q = p.shift ? constrainAngle(last, p.doc) : ctx.snap(p.doc, new Set([id]), { from: last }).p;
    if (p.shift) q = constrainAngle(last, q);
    e.edit('Pen', (d) => setPath(d, id, [{ closed: false, pts: [...pts, anchor(q.x, q.y)] }]));
    e.setAnchors(id, new Set([pts.length]));
    P.dragging = true;
    e.beginDrag('Pen');
  },
  move: (ctx, p) => {
    const e = ctx.engine, origin = e.dragOrigin;
    if (!P.dragging || !origin || !P.id) return;
    if (!P.moved && Math.hypot(p.doc.x - P.down.x, p.doc.y - P.down.y) * ctx.view().zoom < 2) return;
    P.moved = true;
    const n = pathNode(origin, P.id);
    if (!n) return;
    const sp = n.d[0], pts = sp.pts.slice(), i = P.closing ? 0 : pts.length - 1, a = pts[i];
    const q = p.shift ? constrainAngle(a, p.doc) : p.doc;
    pts[i] = P.closing && p.alt ? { ...a, ix: 2 * a.x - q.x, iy: 2 * a.y - q.y, smooth: false } : pullHandles(a, q, p.alt);
    e.dragTo(setPath(origin, P.id, [{ closed: sp.closed, pts }]));
  },
  up: (ctx) => {
    const e = ctx.engine;
    if (!P.dragging) return;
    P.dragging = false;
    if (e.dragging) { if (P.moved) e.commitDrag(P.id ? [P.id] : undefined); else e.cancelDrag(); }
    if (P.closing) finish(ctx);
  },
  keydown: (ctx, ev) => {
    if (!P.id) return false;
    if (ev.key === 'Enter' || ev.key === 'Escape') { finish(ctx); return true; }
    return false;
  },
  cancel: (ctx) => { if (ctx.engine.dragging) ctx.engine.cancelDrag(); P.dragging = false; },
  overlay: (ctx, g) => {
    const e = ctx.engine, sp = draft(e), h = P.hover;
    if (!sp || !h || P.dragging) return;
    const last = sp.pts[sp.pts.length - 1], v = ctx.view(), color = layerColor(e, P.id);
    const a = v.toScreen(last), c1 = v.toScreen({ x: last.ox, y: last.oy }), b = v.toScreen(h);
    g.save();
    g.strokeStyle = color;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(a.x, a.y);
    if (hasOut(last)) g.bezierCurveTo(c1.x, c1.y, b.x, b.y, b.x, b.y); else g.lineTo(b.x, b.y);
    g.stroke();
    g.restore();
    void hasIn;
  },
});

registerTool({
  id: 'penAdd', label: 'Add Anchor Point Tool', group: 'pen', order: 21, shortcut: '=',
  icon: () => 'vPenAdd',
  hint: () => 'Click a segment of a path to add an anchor point.',
  cursor: () => CURSORS.penAdd,
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const t = tolDoc(ctx, 5), h = e.hit(p.doc, 5);
    if (h && !pr.selection.has(h.id)) { const n = findNode(pr.doc, h.id); if (n?.kind === 'path') e.select([h.id]); }
    const sg = segmentUnder(e, p.doc, t);
    if (sg) addAnchorAt(e, sg.id, sg.sub, sg.seg, sg.t);
  },
});

registerTool({
  id: 'penDelete', label: 'Delete Anchor Point Tool', group: 'pen', order: 22, shortcut: '-',
  icon: () => 'vPenDelete',
  hint: () => 'Click an anchor point to remove it.',
  cursor: () => CURSORS.penDelete,
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const h = e.hit(p.doc, 5);
    if (h && !pr.selection.has(h.id)) { const n = findNode(pr.doc, h.id); if (n?.kind === 'path') e.select([h.id]); }
    const ah = anchorUnder(e, p.doc, tolDoc(ctx, 5));
    if (ah && ah.part === 'anchor') deleteAnchorAt(e, ah.id, ah.index);
  },
});

const A = { id: '', index: -1, part: 'anchor' as 'anchor' | 'in' | 'out', down: { x: 0, y: 0 }, moved: false };
registerTool({
  id: 'anchorPoint', label: 'Anchor Point Tool', group: 'pen', order: 23, shortcut: 'Shift+C',
  icon: () => 'vAnchor',
  hint: () => 'Click a smooth point to make it a corner, drag from a corner to pull out smooth handles, drag a handle to move it on its own.',
  cursor: () => CURSORS.anchor,
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const h = e.hit(p.doc, 5);
    if (h && !pr.selection.has(h.id)) { const n = findNode(pr.doc, h.id); if (n?.kind === 'path') { e.select([h.id]); e.setAnchors(h.id, new Set([-1])); } }
    const ah = anchorUnder(e, p.doc, tolDoc(ctx, 5));
    A.id = ''; A.moved = false; A.down = p.doc;
    if (!ah) return;
    A.id = ah.id; A.index = ah.index; A.part = ah.part;
    e.setAnchors(ah.id, new Set([ah.index]));
    e.beginDrag('Convert Anchor Point');
  },
  move: (ctx, p) => {
    const e = ctx.engine, origin = e.dragOrigin;
    if (!A.id || !origin) return;
    if (!A.moved && Math.hypot(p.doc.x - A.down.x, p.doc.y - A.down.y) * ctx.view().zoom < 3) return;
    A.moved = true;
    const n = pathNode(origin, A.id);
    if (!n) return;
    let k = 0;
    const d = n.d.map((sp) => ({ ...sp, pts: sp.pts.map((a) => {
      if (k++ !== A.index) return a;
      if (A.part === 'out') return { ...a, ox: p.doc.x, oy: p.doc.y, smooth: false };
      if (A.part === 'in') return { ...a, ix: p.doc.x, iy: p.doc.y, smooth: false };
      return pullHandles(a, p.doc, false);
    }) }));
    e.dragTo(setPath(origin, A.id, d));
  },
  up: (ctx) => {
    const e = ctx.engine;
    if (!A.id) return;
    if (A.moved) e.commitDrag();
    else { e.cancelDrag(); if (A.part === 'anchor') convertAnchor(e, A.id, A.index); }
    A.id = '';
  },
});

interface CState { id: string | null; pts: Array<{ p: Pt; corner: boolean }>; hover: Pt | null }
const C: CState = { id: null, pts: [], hover: null };

function curvatureD(pts: Array<{ p: Pt; corner: boolean }>, closed: boolean, extra?: Pt): PathData {
  const all = extra ? [...pts, { p: extra, corner: false }] : pts, n = all.length;
  const out: Anchor[] = all.map(({ p }) => anchor(p.x, p.y));
  for (let i = 0; i < n; i++) {
    if (all[i].corner) continue;
    const prev = i > 0 ? all[i - 1].p : closed ? all[n - 1].p : null, next = i < n - 1 ? all[i + 1].p : closed ? all[0].p : null;
    if (!prev || !next) continue;
    const tx = (next.x - prev.x) / 6, ty = (next.y - prev.y) / 6;
    out[i] = { ...out[i], ix: all[i].p.x - tx, iy: all[i].p.y - ty, ox: all[i].p.x + tx, oy: all[i].p.y + ty, smooth: true };
  }
  return [{ closed, pts: out }];
}

function curvatureCommit(e: Engine, closed: boolean): void {
  if (!C.id) return;
  const id = C.id, d = curvatureD(C.pts, closed);
  e.edit('Curvature', (doc) => setPath(doc, id, d));
}

registerTool({
  id: 'curvature', label: 'Curvature Tool', group: 'pen', order: 24, shortcut: 'Shift+~',
  icon: () => 'vCurvature',
  hint: () => 'Click points and the curve flows smoothly through them. Double-click or Alt-click for a corner. Click the first point to close; Escape ends the path.',
  cursor: () => CURSORS.penPlain,
  activate: () => { C.id = null; C.pts = []; },
  deactivate: () => { C.id = null; C.pts = []; },
  hover: (ctx, p) => { C.hover = p ? p.doc : null; ctx.redraw(); },
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    if (C.id && !pathNode(pr.doc, C.id)) { C.id = null; C.pts = []; }
    const q = ctx.snap(p.doc).p, t = tolDoc(ctx, 5);
    if (C.pts.length > 2 && Math.hypot(C.pts[0].p.x - q.x, C.pts[0].p.y - q.y) <= t) { curvatureCommit(e, true); C.id = null; C.pts = []; return; }
    C.pts.push({ p: q, corner: p.alt || p.clicks > 1 });
    if (!C.id) {
      const node = e.makePath(curvatureD(C.pts, false));
      node.ap = e.newArtAppearance(false);
      e.addNodes('Curvature', [node]);
      C.id = node.id;
    } else curvatureCommit(e, false);
    if (C.id) e.setAnchors(C.id, new Set([C.pts.length - 1]));
  },
  dblclick: (ctx) => { if (C.pts.length) { C.pts[C.pts.length - 1].corner = true; curvatureCommit(ctx.engine, false); } },
  keydown: (ctx, ev) => {
    if (!C.id) return false;
    if (ev.key === 'Enter' || ev.key === 'Escape') { C.id = null; C.pts = []; ctx.redraw(); return true; }
    return false;
  },
  overlay: (ctx, g) => {
    if (!C.id || !C.hover || !C.pts.length) return;
    const d = curvatureD(C.pts, false, C.hover), v = ctx.view(), color = layerColor(ctx.engine, C.id);
    const sp = d[0], n = sp.pts.length;
    g.save();
    g.strokeStyle = color;
    g.setLineDash([3, 3]);
    g.beginPath();
    const a = sp.pts[n - 2], b = sp.pts[n - 1], s = v.toScreen(a), c1 = v.toScreen({ x: a.ox, y: a.oy }), c2 = v.toScreen({ x: b.ix, y: b.iy }), e2 = v.toScreen(b);
    g.moveTo(s.x, s.y); g.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, e2.x, e2.y);
    g.stroke();
    g.restore();
    anchorDot(g, v.toScreen(C.hover), color, false, 2.5);
  },
});
