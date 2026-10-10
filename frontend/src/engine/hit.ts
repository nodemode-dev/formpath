import { geomBounds, nodePath } from './bounds';
import { childrenOf } from './doc';
import { apply, flatIndex, hasIn, hasOut, inflate, invert, nearestOnPath, pointInPolygon, rectContains, rectsTouch, segments, segBounds, flattenSub } from './geometry';
import { liveChildren } from './live';
import { liveFaceNodes } from './livepaint';
import { intertwineHit } from './intertwine';
import { shaperRegionAt } from './shaper';
import { cachedPath, clipGeometry } from './render';
import { glyphCenter, layoutText, lineRect } from './text';
import { instanceArt } from './symbolism';
import type { Doc, PathData, Pt, Rect, SymbolNode, VNode } from './types';

let hctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
function ctx(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  if (!hctx) hctx = typeof OffscreenCanvas !== 'undefined' ? (new OffscreenCanvas(2, 2).getContext('2d') as OffscreenCanvasRenderingContext2D) : (document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D);
  return hctx;
}

export interface Hit { id: string; chain: string[]; part: 'fill' | 'stroke' | 'edge' | 'text' | 'image' }
export interface HitOpts { tol: number; outline: boolean; skipLocked?: boolean; exclude?: Set<string> }

function shapeHit(n: VNode, d: PathData, rule: CanvasFillRule, p: Pt, o: HitOpts): 'fill' | 'stroke' | 'edge' | null {
  const c = ctx(), path = cachedPath(d);
  const stroke = n.ap.items.find((i) => i.kind === 'stroke' && i.visible && i.paint.type !== 'none');
  const w = stroke && stroke.kind === 'stroke' ? stroke.width : 0;
  c.lineWidth = Math.max(w, o.tol * 2);
  c.lineJoin = 'round';
  if (c.isPointInStroke(path, p.x, p.y)) return w > 0 ? 'stroke' : 'edge';
  if (o.outline) return null;
  const hasFill = n.ap.items.some((i) => i.kind === 'fill' && i.visible && i.paint.type !== 'none');
  if (hasFill && c.isPointInPath(path, p.x, p.y, rule)) return 'fill';
  return null;
}

function leafHit(doc: Doc, n: VNode, p: Pt, o: HitOpts): Hit['part'] | null {
  switch (n.kind) {
    case 'path': if (n.guide) return null; return shapeHit(n, n.d, n.rule, p, o);
    case 'compound': return shapeHit(n, n.children.flatMap((c) => c.d), n.rule, p, o);
    case 'text': {
      if (n.mode === 'path') {
        const lay = layoutText(n);
        for (const g of lay.glyphs) { const c = glyphCenter(g); if (Math.hypot(c.x - p.x, c.y - p.y) < Math.max(g.size * 0.6, o.tol)) return 'text'; }
        if (n.path) { const r = nearestOnPath(n.path, p); if (r && r.d <= o.tol) return 'edge'; }
        return null;
      }
      const inv = invert(n.xf), q = apply(inv, p.x, p.y), lay = layoutText(n), t = o.tol / Math.max(1e-6, Math.hypot(n.xf[0], n.xf[1]));
      if (n.mode === 'area' && n.frame) return rectContains(inflate(n.frame, t), q) ? 'text' : null;
      for (const l of lay.lines) { const r0 = lineRect(lay, l), r = { x: r0.x - t - 1, y: r0.y - t - 1, w: r0.w + 2 * t + 2, h: r0.h + 2 * t + 2 }; if (rectContains(r, q)) return 'text'; }
      return null;
    }
    case 'image': {
      if (n.warp) { const w = n.warp, W = w.cols + 1; for (let j = 0; j < w.rows; j++) for (let i = 0; i < w.cols; i++) if (pointInPolygon(p, [w.pts[j * W + i], w.pts[j * W + i + 1], w.pts[(j + 1) * W + i + 1], w.pts[(j + 1) * W + i]]) !== 0) return 'image'; return null; }
      const q = apply(invert(n.xf), p.x, p.y); return q.x >= 0 && q.y >= 0 && q.x <= n.w && q.y <= n.h ? 'image' : null;
    }
    case 'symbol': return symbolPartHit(doc, n, p, o) ? 'fill' : null;
    case 'mesh': return rectContains(geomBounds(doc, n), p) ? 'fill' : null;
    default: return null;
  }
}

function deepHit(doc: Doc, nodes: VNode[], p: Pt, o: HitOpts, chain: string[]): Hit | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.hidden || (o.skipLocked !== false && n.locked) || o.exclude?.has(n.id)) continue;
    if (n.kind === 'layer' && n.template) continue;
    if (n.kind === 'envelope' && n.editContents) { const h = deepHit(doc, n.children, p, o, [...chain, n.id]); if (h) return h; continue; }
    const b = geomBounds(doc, n);
    if (Number.isFinite(b.x) && !rectContains(inflate(b, o.tol + 40), p) && n.kind !== 'layer') continue;
    if (n.kind === 'blend' || n.kind === 'envelope' || n.kind === 'repeat') {
      const h = deepHit(doc, liveChildren(doc, n), p, o, [...chain, n.id]);
      if (h) return { id: n.id, chain: [...chain, n.id], part: h.part };
      continue;
    }
    const ch = n.kind === 'compound' ? null : childrenOf(n);
    if (ch) {
      if ((n.kind === 'group' || n.kind === 'layer') && n.clip && ch.length > 1) {
        const g = clipGeometry(ch[ch.length - 1]);
        if (g && !ctx().isPointInPath(cachedPath(g.d), p.x, p.y, g.rule)) {
          const c = ctx(); c.lineWidth = o.tol * 2;
          if (c.isPointInStroke(cachedPath(g.d), p.x, p.y)) return { id: ch[ch.length - 1].id, chain: [...chain, n.id, ch[ch.length - 1].id], part: 'edge' };
          continue;
        }
      }
      if (n.kind === 'group' && n.intertwine && !o.outline) {
        const m = intertwineHit(doc, n, p);
        const zh = m ? deepHit(doc, [m], p, o, [...chain, n.id]) : null;
        if (zh) return zh;
      }
      if (n.kind === 'group' && n.shaper && !o.outline) {
        if (!shaperRegionAt(n, p)) continue;
        return deepHit(doc, ch, p, o, [...chain, n.id]) ?? { id: n.id, chain: [...chain, n.id], part: 'fill' };
      }
      const h = deepHit(doc, ch, p, o, [...chain, n.id]);
      if (h) return h;
      if (n.kind === 'group' && n.livePaint && !o.outline && liveFaceNodes(n).some((f) => ctx().isPointInPath(cachedPath(f.d), p.x, p.y, 'evenodd'))) return { id: n.id, chain: [...chain, n.id], part: 'fill' };
      continue;
    }
    const part = leafHit(doc, n, p, o);
    if (part) return { id: n.id, chain: [...chain, n.id], part };
  }
  return null;
}

export function hitTest(doc: Doc, p: Pt, o: HitOpts): Hit | null { return deepHit(doc, doc.layers, p, o, []); }

export function symbolPartHit(doc: Doc, n: SymbolNode, p: Pt, o: HitOpts): string | null {
  const art = instanceArt(doc, n);
  if (!art) return null;
  const q = apply(invert(n.xf), p.x, p.y);
  return deepHit(doc, [art], q, { ...o, tol: o.tol / Math.max(1e-6, Math.hypot(n.xf[0], n.xf[1])) }, [])?.id ?? null;
}

function pathTouchesRect(d: PathData, r: Rect, filled: boolean, rule: CanvasFillRule): boolean {
  for (const sp of d) {
    for (const a of sp.pts) if (rectContains(r, a)) return true;
    for (const s of segments(sp)) if (rectsTouch(segBounds(s), r)) {
      const pts = flattenSub({ closed: false, pts: [{ x: s[0].x, y: s[0].y, ix: s[0].x, iy: s[0].y, ox: s[1].x, oy: s[1].y }, { x: s[3].x, y: s[3].y, ix: s[2].x, iy: s[2].y, ox: s[3].x, oy: s[3].y }] }, 0.5);
      for (let i = 1; i < pts.length; i++) if (segRect(pts[i - 1], pts[i], r)) return true;
    }
  }
  if (filled) { const c = ctx(); if (c.isPointInPath(cachedPath(d), r.x + r.w / 2, r.y + r.h / 2, rule)) return true; }
  return false;
}
function segRect(a: Pt, b: Pt, r: Rect): boolean {
  if (rectContains(r, a) || rectContains(r, b)) return true;
  const edges: Array<[Pt, Pt]> = [[{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }], [{ x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }], [{ x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }], [{ x: r.x, y: r.y + r.h }, { x: r.x, y: r.y }]];
  return edges.some(([c, d]) => cross(a, b, c, d));
}
function cross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return o(a, b, c) * o(a, b, d) <= 0 && o(c, d, a) * o(c, d, b) <= 0;
}

export function nodeTouchesRect(doc: Doc, n: VNode, r: Rect): boolean {
  const b = geomBounds(doc, n);
  if (!rectsTouch(b, r)) return false;
  const d = nodePath(n);
  if (d) return pathTouchesRect(d, r, n.ap.items.some((i) => i.kind === 'fill' && i.paint.type !== 'none'), n.kind === 'path' || n.kind === 'compound' ? n.rule : 'nonzero');
  const ch = n.kind === 'blend' || n.kind === 'envelope' || n.kind === 'repeat' ? liveChildren(doc, n) : childrenOf(n);
  if (ch) return ch.some((c) => !c.hidden && nodeTouchesRect(doc, c, r));
  return true;
}

export interface AnchorHit { id: string; index: number; part: 'anchor' | 'in' | 'out'; sub: number; local: number }
export function anchorHit(doc: Doc, nodes: VNode[], p: Pt, tol: number, handlesOf: (id: string) => Set<number> | null): AnchorHit | null {
  for (let k = nodes.length - 1; k >= 0; k--) {
    const n = nodes[k];
    const paths: Array<{ id: string; d: PathData }> = n.kind === 'path' ? [{ id: n.id, d: n.d }] : n.kind === 'compound' ? n.children.map((c) => ({ id: c.id, d: c.d })) : n.kind === 'text' && n.mode === 'path' && n.path ? [{ id: n.id, d: n.path }] : [];
    for (const { id, d } of paths) {
      const shown = handlesOf(id);
      for (let s = 0; s < d.length; s++) for (let i = 0; i < d[s].pts.length; i++) {
        const a = d[s].pts[i], idx = flatIndex(d, s, i);
        if (shown && (shown.has(idx) || shown.has(-1))) {
          if (hasOut(a) && Math.hypot(a.ox - p.x, a.oy - p.y) <= tol) return { id, index: idx, part: 'out', sub: s, local: i };
          if (hasIn(a) && Math.hypot(a.ix - p.x, a.iy - p.y) <= tol) return { id, index: idx, part: 'in', sub: s, local: i };
        }
      }
      for (let s = 0; s < d.length; s++) for (let i = 0; i < d[s].pts.length; i++) {
        const a = d[s].pts[i];
        if (Math.hypot(a.x - p.x, a.y - p.y) <= tol) return { id, index: flatIndex(d, s, i), part: 'anchor', sub: s, local: i };
      }
    }
  }
  return null;
}

export function segmentHit(d: PathData, p: Pt, tol: number): { sub: number; seg: number; t: number; pt: Pt } | null {
  const r = nearestOnPath(d, p);
  return r && r.d <= tol ? { sub: r.sub, seg: r.seg, t: r.t, pt: r.pt } : null;
}
