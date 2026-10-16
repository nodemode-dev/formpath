import { allNodes, childrenOf, findNode, isLocked, isVisible } from '../engine/doc';
import { ellipsePath, fitCurve, nearestOnPath, pathBounds, polyToPath, rectPath, rectsTouch, reversePath } from '../engine/geometry';
import { strokeToPath, uniteAll } from '../engine/kernel';
import { eraseRegion, eraseSegments, geometryOf, joinPaths, knifeCut, scissorsCut, smoothRegion } from '../engine/ops/paths';
import { fill, NONE, stroke } from '../engine/paint';
import type { Doc, Engine, PathData, PathNode, Pt, VNode } from '../engine';
import type { StrokeItem, SubPath, WidthPoint } from '../engine/types';
import { registerTool, type ToolContext, type ToolPointer } from '../extensions/registry';
import { CURSORS } from '../ui/cursors';
import { replaceNode } from './select';
import { layerColor, stroke2, tolDoc } from './util';

interface F { on: boolean; pts: Pt[]; pr: number[]; last: Pt; ids: string[]; changed: boolean; alt: boolean; shift: boolean }
const F: F = { on: false, pts: [], pr: [], last: { x: 0, y: 0 }, ids: [], changed: false, alt: false, shift: false };

function leaves(doc: Doc, ids: string[] | null): string[] {
  const out: string[] = [];
  const visit = (n: VNode): void => {
    if (n.hidden || n.locked) return;
    if (n.kind === 'path') { if (!n.guide) out.push(n.id); return; }
    if (n.kind === 'compound') { out.push(n.id); return; }
    if (n.kind === 'group' || n.kind === 'layer') childrenOf(n)?.forEach(visit);
  };
  if (ids) { for (const id of ids) { const n = findNode(doc, id); if (n && isVisible(doc, id) && !isLocked(doc, id)) visit(n); } } else doc.layers.forEach(visit);
  return out;
}

function strokeReach(n: VNode): number {
  return Math.max(0, ...n.ap.items.filter((i): i is StrokeItem => i.kind === 'stroke' && i.paint.type !== 'none').map((i) => i.width)) / 2;
}

function straightLine(): Pt[] {
  if (!F.alt || F.pts.length < 2) return F.pts;
  const a = F.pts[0];
  let b = F.pts[F.pts.length - 1];
  if (F.shift) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), step = Math.PI / 4, ang = Math.round(Math.atan2(dy, dx) / step) * step;
    b = { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
  }
  return [a, b];
}

function collect(ctx: ToolContext, p: ToolPointer): void {
  const z = ctx.view().zoom;
  if (Math.hypot(p.doc.x - F.last.x, p.doc.y - F.last.y) * z < 1.5) return;
  F.pts.push(p.doc); F.pr.push(p.pressure); F.last = p.doc;
  ctx.redraw();
}

function begin(p: ToolPointer): void { F.on = true; F.pts = [p.doc]; F.pr = [p.pressure]; F.last = p.doc; F.ids = []; F.changed = false; F.alt = false; F.shift = false; }

function pressureProfile(pr: number[]): WidthPoint[] | null {
  if (pr.length < 3 || pr.every((v) => v >= 0.99)) return null;
  const n = Math.min(16, pr.length), out: WidthPoint[] = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1), v = Math.max(0.1, pr[Math.round(t * (pr.length - 1))] * 1.4); out.push({ t, l: v, r: v }); }
  return out;
}

function trail(ctx: ToolContext, g: CanvasRenderingContext2D, color?: string, pts: Pt[] = F.pts): void {
  if (!F.on) return;
  const v = ctx.view();
  stroke2(g, pts.map((q) => v.toScreen(q)), color ?? layerColor(ctx.engine));
}

function brushCircle(ctx: ToolContext, g: CanvasRenderingContext2D, at: Pt | null, size: number): void {
  if (!at) return;
  const v = ctx.view(), s = v.toScreen(at);
  g.save(); g.strokeStyle = ctx.paint().accent; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, Math.max(2, (size / 2) * v.zoom), 0, Math.PI * 2); g.stroke(); g.restore();
}

function openEnd(e: Engine, p: Pt, tol: number): { id: string; first: boolean } | null {
  const pr = e.current;
  if (!pr) return null;
  for (const id of e.selectedIds()) {
    const n = findNode(pr.doc, id);
    if (n?.kind !== 'path' || n.d.length !== 1 || n.d[0].closed) continue;
    const pts = n.d[0].pts, a = pts[0], b = pts[pts.length - 1];
    if (Math.hypot(b.x - p.x, b.y - p.y) <= tol) return { id, first: false };
    if (Math.hypot(a.x - p.x, a.y - p.y) <= tol) return { id, first: true };
  }
  return null;
}

let hoverAt: Pt | null = null;

registerTool({
  id: 'pencil', label: 'Pencil Tool', group: 'pencil', order: 40, shortcut: 'N',
  icon: () => 'vPencil',
  hint: () => 'Drag to draw a freeform path. Start on the end of a selected path to extend it; end near the start, or hold Alt, to close it.',
  cursor: () => CURSORS.pencil,
  options: (e) => [
    { kind: 'title', text: 'Pencil' },
    { kind: 'range', label: 'Fidelity', min: 0, max: 100, unit: '%', get: () => Math.round(e.options.pencilFidelity * 100), set: (v) => e.update({ pencilFidelity: v / 100 }) },
    { kind: 'toggle', label: 'Keep selected', get: () => e.options.keepSelected, set: (v) => e.update({ keepSelected: v }) },
  ],
  down: (_ctx, p) => begin(p),
  move: (ctx, p) => { if (F.on) collect(ctx, p); },
  up: (ctx, p) => {
    if (!F.on) return;
    F.on = false;
    const e = ctx.engine, z = ctx.view().zoom, pts = F.pts;
    if (pts.length < 2) { ctx.redraw(); return; }
    const err = (0.6 + e.options.pencilFidelity * 9) / z;
    const close = p.alt || (pts.length > 4 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) * z < 12);
    const ext = openEnd(e, pts[0], 8 / z);
    if (ext) {
      const doc = e.doc as Doc, n = findNode(doc, ext.id) as PathNode;
      const base = ext.first ? reversePath(n.d)[0].pts : n.d[0].pts;
      const fresh = fitCurve(pts, err), last = base[base.length - 1];
      const merged = [...base.slice(0, -1), { ...last, ox: fresh[0]?.ox ?? last.ox, oy: fresh[0]?.oy ?? last.oy }, ...fresh.slice(1)];
      e.edit('Pencil', (d) => ({ doc: replaceNode(d, ext.id, { ...n, d: [{ closed: false, pts: merged }], live: undefined }), select: [ext.id] }));
    } else {
      const d = e.pathFromPoints(pts, true, close, err);
      const node = e.makePath(d);
      node.ap = { items: [fill(close ? e.fillPaint : NONE), stroke(e.strokePaint.type === 'none' ? e.fillPaint : e.strokePaint, e.strokeWidth)], effects: [] };
      e.addNodes('Pencil', [node], { select: e.options.keepSelected });
    }
    ctx.redraw();
  },
  overlay: (ctx, g) => trail(ctx, g),
});

registerTool({
  id: 'smooth', label: 'Smooth Tool', group: 'pencil', order: 41,
  icon: () => 'vSmooth',
  hint: () => 'Drag along a selected path to smooth it.',
  cursor: () => CURSORS.pencil,
  hover: (ctx, p) => { hoverAt = p?.doc ?? null; ctx.redraw(); },
  down: (ctx, p) => { begin(p); ctx.engine.beginDrag('Smooth'); },
  move: (ctx, p) => {
    if (!F.on) return;
    hoverAt = p.doc;
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const r = 10 / ctx.view().zoom, region = ellipsePath(p.doc.x - r, p.doc.y - r, 2 * r, 2 * r);
    let doc = pr.doc;
    for (const id of e.selectedIds()) {
      const n = findNode(doc, id);
      if (n?.kind !== 'path') continue;
      const d = smoothRegion(n.d, region, 0.5 / ctx.view().zoom);
      if (d !== n.d) { doc = replaceNode(doc, id, { ...n, d, live: undefined }); F.changed = true; }
    }
    if (doc !== pr.doc) e.dragTo(doc);
  },
  up: (ctx) => { F.on = false; if (F.changed) ctx.engine.commitDrag(); else ctx.engine.cancelDrag(); },
  overlay: (ctx, g) => brushCircle(ctx, g, hoverAt, 20 / ctx.view().zoom),
});

registerTool({
  id: 'pathEraser', label: 'Path Eraser Tool', group: 'pencil', order: 42,
  icon: () => 'vPathEraser',
  hint: () => 'Drag across a selected path to erase the segments under the cursor.',
  cursor: () => CURSORS.pencil,
  hover: (ctx, p) => { hoverAt = p?.doc ?? null; ctx.redraw(); },
  down: (ctx, p) => { begin(p); ctx.engine.beginDrag('Erase Path'); },
  move: (ctx, p) => {
    if (!F.on) return;
    hoverAt = p.doc;
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const r = 6 / ctx.view().zoom, region = ellipsePath(p.doc.x - r, p.doc.y - r, 2 * r, 2 * r);
    let doc = pr.doc;
    for (const id of e.selectedIds()) { const n = findNode(doc, id); if (n?.kind === 'path') { const out = eraseSegments(doc, id, region); if (out.doc !== doc) { doc = out.doc; F.changed = true; } } }
    if (doc !== pr.doc) e.dragTo(doc);
  },
  up: (ctx) => { F.on = false; if (F.changed) ctx.engine.commitDrag(); else ctx.engine.cancelDrag(); },
  overlay: (ctx, g) => brushCircle(ctx, g, hoverAt, 12 / ctx.view().zoom),
});

registerTool({
  id: 'join', label: 'Join Tool', group: 'pencil', order: 43,
  icon: () => 'vJoin',
  hint: () => 'Scrub across the gap between two open ends of selected paths to join them.',
  cursor: () => CURSORS.pencil,
  down: (_ctx, p) => begin(p),
  move: (ctx, p) => { if (F.on) collect(ctx, p); },
  up: (ctx) => {
    F.on = false;
    const e = ctx.engine, pr = e.current, t = tolDoc(ctx, 14);
    if (!pr) return;
    const near = (q: Pt): boolean => F.pts.some((s) => Math.hypot(s.x - q.x, s.y - q.y) <= t);
    const ids = allNodes(pr.doc).filter((n): n is PathNode => n.kind === 'path' && n.d.length === 1 && !n.d[0].closed && isVisible(pr.doc, n.id) && !isLocked(pr.doc, n.id) && (near(n.d[0].pts[0]) || near(n.d[0].pts[n.d[0].pts.length - 1]))).map((n) => n.id);
    if (ids.length) e.run('Join', (d, tt) => joinPaths(d, tt, new Map()), ids);
    ctx.redraw();
  },
  overlay: (ctx, g) => trail(ctx, g),
});

registerTool({
  id: 'paintbrush', label: 'Paintbrush Tool', group: 'brush', order: 44, shortcut: 'B',
  icon: () => 'vPaintbrush',
  hint: () => 'Drag to paint a stroke with the current brush from the Brushes panel.',
  cursor: () => CURSORS.brush,
  options: (e) => [
    { kind: 'title', text: 'Paintbrush' },
    { kind: 'select', label: 'Brush', choices: [], live: () => [{ id: '', label: 'Basic' }, ...(e.doc?.brushes ?? []).map((b) => ({ id: b.id, label: b.name }))], get: () => e.currentBrush ?? '', set: (v) => { e.currentBrush = v || null; e.emit('options', null); } },
    { kind: 'range', label: 'Fidelity', min: 0, max: 100, unit: '%', get: () => Math.round(e.options.pencilFidelity * 100), set: (v) => e.update({ pencilFidelity: v / 100 }) },
  ],
  down: (_ctx, p) => begin(p),
  move: (ctx, p) => { if (F.on) collect(ctx, p); },
  up: (ctx, p) => {
    if (!F.on) return;
    F.on = false;
    const e = ctx.engine, z = ctx.view().zoom;
    if (F.pts.length < 2) { ctx.redraw(); return; }
    const d = e.pathFromPoints(F.pts, true, p.alt, (0.6 + e.options.pencilFidelity * 9) / z);
    const node = e.makePath(d);
    const paint = e.strokePaint.type === 'none' ? e.fillPaint : e.strokePaint;
    const def = e.doc?.brushes.find((b) => b.id === e.currentBrush), prof = def && (def.brush.type === 'bristle' || def.brush.type === 'calligraphic') ? pressureProfile(F.pr) : null;
    node.ap = { items: [fill(NONE), { ...stroke(paint, Math.max(0.25, e.strokeWidth)), brush: e.currentBrush, cap: 'round', join: 'round', ...(prof ? { profile: prof } : {}) }], effects: [] };
    e.addNodes('Paintbrush', [node], { select: e.options.keepSelected });
    ctx.redraw();
  },
  overlay: (ctx, g) => trail(ctx, g),
});

function blobOutline(pts: Pt[], size: number): PathData {
  if (pts.length === 1) return ellipsePath(pts[0].x - size / 2, pts[0].y - size / 2, size, size);
  return strokeToPath(polyToPath(pts, false), size, 'round', 'round', 4);
}

registerTool({
  id: 'blob', label: 'Blob Brush Tool', group: 'brush', order: 45, shortcut: 'Shift+B',
  icon: () => 'vBlob',
  hint: () => 'Paint filled shapes that merge with touching shapes of the same color. [ and ] change the size.',
  cursor: () => 'none',
  options: (e) => [{ kind: 'title', text: 'Blob Brush' }, { kind: 'range', label: 'Size', min: 1, max: 500, unit: 'pt', get: () => e.options.blobSize, set: (v) => e.update({ blobSize: v }) }],
  hover: (ctx, p) => { hoverAt = p?.doc ?? null; ctx.redraw(); },
  keydown: (ctx, ev) => { if (ev.key !== '[' && ev.key !== ']') return false; const e = ctx.engine; e.update({ blobSize: Math.max(1, e.options.blobSize + (ev.key === ']' ? 2 : -2)) }); ctx.redraw(); return true; },
  down: (_ctx, p) => begin(p),
  move: (ctx, p) => { hoverAt = p.doc; if (F.on) collect(ctx, p); },
  up: (ctx) => {
    if (!F.on) return;
    F.on = false;
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const size = e.options.blobSize / Math.max(1e-6, 1), region = blobOutline(F.pts, size);
    if (!region.length) return;
    const paint = e.strokePaint.type === 'none' ? e.fillPaint : e.strokePaint, key = JSON.stringify(paint), rb = pathBounds(region);
    const merge = allNodes(pr.doc).filter((n): n is PathNode | VNode => (n.kind === 'path' || n.kind === 'compound') && isVisible(pr.doc, n.id) && !isLocked(pr.doc, n.id) && n.ap.items.length === 1 && n.ap.items[0].kind === 'fill' && JSON.stringify(n.ap.items[0].paint) === key && rectsTouch(pathBounds(geometryOf(n)?.d ?? []), rb));
    const all = [{ d: region, rule: 'nonzero' as const }, ...merge.map((n) => geometryOf(n)).filter((g): g is NonNullable<typeof g> => !!g)];
    const united = uniteAll(all);
    const node = e.makePath(united, { name: 'Blob' });
    node.ap = { items: [fill(paint)], effects: [] };
    if (merge.length) e.edit('Blob Brush', (doc) => {
      let out = doc;
      const last = merge[merge.length - 1].id;
      for (const m of merge) if (m.id !== last) out = replaceNodeOrRemove(out, m.id, null);
      return { doc: replaceNodeOrRemove(out, last, node), select: [node.id] };
    });
    else e.addNodes('Blob Brush', [node]);
    ctx.redraw();
  },
  overlay: (ctx, g) => { trail(ctx, g); brushCircle(ctx, g, hoverAt, ctx.engine.options.blobSize); },
});

function replaceNodeOrRemove(doc: Doc, id: string, n: VNode | null): Doc {
  if (n) return replaceNode(doc, id, n);
  const strip = (nodes: VNode[]): VNode[] => nodes.filter((x) => x.id !== id).map((x) => ('children' in x ? ({ ...x, children: strip(x.children as VNode[]) } as VNode) : x));
  return { ...doc, layers: strip(doc.layers) as Doc['layers'] };
}

registerTool({
  id: 'eraser', label: 'Eraser Tool', group: 'eraser', order: 46, shortcut: 'Shift+E',
  icon: () => 'vEraser',
  hint: () => 'Drag over shapes to erase them; with a selection only the selected shapes are erased. [ and ] change the size.',
  cursor: () => 'none',
  options: (e) => [{ kind: 'title', text: 'Eraser' }, { kind: 'range', label: 'Size', min: 1, max: 500, unit: 'pt', get: () => e.options.eraserSize, set: (v) => e.update({ eraserSize: v }) }],
  hover: (ctx, p) => { hoverAt = p?.doc ?? null; ctx.redraw(); },
  keydown: (ctx, ev) => { if (ev.key !== '[' && ev.key !== ']') return false; const e = ctx.engine; e.update({ eraserSize: Math.max(1, e.options.eraserSize + (ev.key === ']' ? 2 : -2)) }); ctx.redraw(); return true; },
  down: (_ctx, p) => begin(p),
  move: (ctx, p) => { hoverAt = p.doc; F.alt = p.alt; if (F.on) collect(ctx, p); },
  up: (ctx, p) => {
    if (!F.on) return;
    F.on = false;
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const region = p.alt && F.pts.length > 0 ? eraserMarquee(F.pts[0], p.doc) : blobOutline(F.pts, e.options.eraserSize), rb = pathBounds(region);
    const pool = leaves(pr.doc, e.hasSelection ? e.targetIds() : null);
    const ids = pool.filter((id) => { const n = findNode(pr.doc, id); if (!n) return false; const r = strokeReach(n), b = e.boundsOf(n); return rectsTouch({ x: b.x - r, y: b.y - r, w: b.w + 2 * r, h: b.h + 2 * r }, rb); });
    if (ids.length) e.run('Eraser', (d) => eraseRegion(d, ids, region), ids);
    ctx.redraw();
  },
  overlay: (ctx, g) => {
    if (F.on && F.alt && F.pts.length > 0) {
      const v = ctx.view(), a = v.toScreen(F.pts[0]), b = v.toScreen(F.last);
      g.save(); g.strokeStyle = ctx.paint().accent; g.lineWidth = 1; g.setLineDash([4, 3]); g.strokeRect(Math.min(a.x, b.x) + 0.5, Math.min(a.y, b.y) + 0.5, Math.abs(a.x - b.x), Math.abs(a.y - b.y)); g.restore();
      return;
    }
    trail(ctx, g, ctx.paint().accent); brushCircle(ctx, g, hoverAt, ctx.engine.options.eraserSize);
  },
});

function eraserMarquee(a: Pt, b: Pt): PathData {
  const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
  return rectPath(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(w, 1e-3), Math.max(h, 1e-3));
}

registerTool({
  id: 'scissors', label: 'Scissors Tool', group: 'eraser', order: 47, shortcut: 'C',
  icon: () => 'vScissors',
  hint: () => 'Click a path to cut it at that point.',
  cursor: () => CURSORS.scissors,
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const tol = tolDoc(ctx, 5);
    let best: { id: string; sub: number; seg: number; t: number; d: number; sp: SubPath } | null = null;
    for (const id of leaves(pr.doc, null)) {
      const n = findNode(pr.doc, id);
      const d = n?.kind === 'path' ? n.d : n?.kind === 'compound' ? n.children.flatMap((c) => c.d) : null;
      if (!d) continue;
      const b = pathBounds(d);
      if (p.doc.x < b.x - tol || p.doc.y < b.y - tol || p.doc.x > b.x + b.w + tol || p.doc.y > b.y + b.h + tol) continue;
      const r = nearestOnPath(d, p.doc);
      if (r && r.d <= tol && (!best || r.d <= best.d)) best = { id, sub: r.sub, seg: r.seg, t: r.t, d: r.d, sp: d[r.sub] };
    }
    if (!best) return;
    const { id, sub, seg, sp } = best;
    let t = best.t;
    const a = sp.pts[seg], b = sp.pts[(seg + 1) % sp.pts.length];
    if (Math.hypot(a.x - p.doc.x, a.y - p.doc.y) <= tol) t = 0;
    else if (Math.hypot(b.x - p.doc.x, b.y - p.doc.y) <= tol) t = 1;
    if (!e.run('Scissors', (d) => scissorsCut(d, id, sub, seg, t), [id])) return;
    const now = findNode(e.current?.doc as Doc, id);
    if (now?.kind !== 'path') return;
    const first = now.d[0];
    if (first.closed) return;
    if (sp.closed) { e.setAnchors(id, new Set([0, first.pts.length - 1])); return; }
    e.setAnchors(id, new Set([first.pts.length - 1]));
    const other = e.selectedIds().find((s) => s !== id);
    if (other) e.setAnchors(other, new Set([0]));
  },
});

registerTool({
  id: 'knife', label: 'Knife', group: 'eraser', order: 48,
  icon: () => 'vKnife',
  hint: () => 'Drag across closed shapes to slice them; with a selection only the selected shapes are cut.',
  cursor: () => CURSORS.knife,
  down: (ctx, p) => begin(ctx.engine.view.smartGuides ? { ...p, doc: ctx.snap(p.doc).p } : p),
  move: (ctx, p) => {
    if (!F.on) return;
    F.alt = p.alt; F.shift = p.shift;
    collect(ctx, p);
    if (ctx.engine.view.smartGuides && !p.alt) ctx.snap(p.doc);
  },
  up: (ctx, p) => {
    if (!F.on) return;
    F.on = false;
    const e = ctx.engine, pr = e.current;
    F.alt = p.alt; F.shift = p.shift;
    if (F.pts.length > 1 || F.alt) F.pts[F.pts.length > 1 ? F.pts.length - 1 : 1] = e.view.smartGuides && !F.alt ? ctx.snap(p.doc).p : p.doc;
    e.clearOverlay();
    const line = straightLine();
    if (!pr || line.length < 2) { ctx.redraw(); return; }
    const rb = pathBounds(polyToPath(line, false));
    const pool = leaves(pr.doc, e.hasSelection ? e.targetIds() : null);
    const ids = pool.filter((id) => { const n = findNode(pr.doc, id); return !!n && rectsTouch(e.boundsOf(n), rb); });
    if (ids.length) e.run('Knife', (d) => knifeCut(d, ids, line), ids);
    ctx.redraw();
  },
  overlay: (ctx, g) => trail(ctx, g, ctx.paint().accent, straightLine()),
});
