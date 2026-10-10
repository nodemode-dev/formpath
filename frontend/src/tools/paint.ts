import { findNode, newId } from '../engine/doc';
import { cachedPath } from '../engine/render';
import { addMeshLine, meshPointAt, removeMeshLines } from '../engine/mesh';
import { computeFaces, faceAt, faceContains, liveFaces } from '../engine/livepaint';
import { insideFill, nearestOnPath, pathLength } from '../engine/geometry';
import { area } from '../engine/kernel';
import { envelopeOutline } from '../engine/live';
import { cssColor, defaultGradient, firstFill, firstStroke, freeformColorAt, solid, toRgb, withFirstFill } from '../engine/paint';
import type { Doc, Engine, FreeformPoint, Gradient, GroupNode, MeshNode, MeshPoint, PathData, Pt, VNode } from '../engine';
import { registerTool, type ToolContext, type ToolPointer } from '../extensions/registry';
import { CURSORS } from '../ui/cursors';
import { EP, envelopeDown, envelopeMove, envelopeOverlay, envelopePointHit, envelopeUp, replaceNode } from './select';
import { fmt, hud, inView, layerColor, tolDoc, unitLabel } from './util';

registerTool({
  id: 'eyedropper', label: 'Eyedropper Tool', group: 'eyedropper', order: 70, shortcut: 'I',
  icon: () => 'vEyedropper',
  hint: () => 'Click an object to copy its paint and appearance to the selection. Shift-click takes just the color into the active Fill or Stroke.',
  cursor: () => CURSORS.eyedropper,
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const h = e.hit(p.doc);
    if (!h) return;
    const src = findNode(pr.doc, h.id);
    if (!src) return;
    if (src.kind === 'text') {
      const st = src.spans[0]?.style;
      if (!st) return;
      if (p.shift) { e.setActivePaint(e.activeSlot === 'fill' ? st.fill : st.stroke); return; }
      if (e.hasSelection) e.setCharStyle({ font: st.font, style: st.style, size: st.size, fill: st.fill, stroke: st.stroke, strokeWidth: st.strokeWidth });
      e.fillPaint = st.fill; e.strokePaint = st.stroke; e.emit('colors', null);
      return;
    }
    const f = firstFill(src.ap), s = firstStroke(src.ap);
    if (p.shift) { const pp = e.activeSlot === 'fill' ? f?.paint : s?.paint; if (pp) e.setActivePaint(pp); return; }
    if (e.hasSelection && !pr.selection.has(src.id)) e.applyToSelection('Eyedropper', (n) => (n.kind === 'text' ? n : { ...n, ap: src.ap, opacity: src.opacity, blend: src.blend }));
    e.fillPaint = f?.paint ?? { type: 'none' }; e.strokePaint = s?.paint ?? { type: 'none' }; if (s) e.strokeWidth = s.width;
    e.emit('colors', null);
  },
});

const GR = { on: false, id: '', start: { x: 0, y: 0 }, cur: { x: 0, y: 0 }, moved: false };
export const FF = { sel: -1, drag: null as null | { id: string; kind: 'point' | 'spread'; i: number; moved: boolean } };

function freeformTarget(e: Engine, doc?: Doc): { n: VNode; g: Gradient } | null {
  const d = doc ?? e.doc;
  if (!d) return null;
  for (const id of e.targetIds()) {
    const n = findNode(d, id), f = n ? firstFill(n.ap) : null;
    if (n && f?.paint.type === 'gradient' && f.paint.gradient.kind === 'freeform') return { n, g: f.paint.gradient };
  }
  return null;
}
const withPoints = (doc: Doc, n: VNode, g: Gradient, points: FreeformPoint[]): Doc => replaceNode(doc, n.id, { ...n, ap: withFirstFill(n.ap, { type: 'gradient', gradient: { ...g, points } }) });

function freeformDown(ctx: ToolContext, p: ToolPointer, t: { n: VNode; g: Gradient }): void {
  const e = ctx.engine, v = ctx.view(), pts = t.g.points ?? [], near = (q: Pt, r: number): boolean => { const s = v.toScreen(q); return Math.hypot(s.x - p.screen.x, s.y - p.screen.y) <= r; };
  const cur = pts[FF.sel];
  if (cur && near({ x: cur.x + cur.spread, y: cur.y }, 6)) { FF.drag = { id: t.n.id, kind: 'spread', i: FF.sel, moved: false }; e.beginDrag('Gradient Point Spread'); return; }
  const i = pts.findIndex((q) => near(q, 8));
  if (i >= 0) { FF.sel = i; FF.drag = { id: t.n.id, kind: 'point', i, moved: false }; e.beginDrag('Move Gradient Point'); e.emit('options', null); ctx.redraw(); return; }
  const h = e.hit(p.doc);
  if (!h || e.selectableFor(h.id) !== t.n.id) { const top = h ? e.selectableFor(h.id) : null; if (top) e.select([top]); else e.deselect(); FF.sel = -1; return; }
  const add: FreeformPoint = { x: p.doc.x, y: p.doc.y, color: freeformColorAt(t.g, p.doc.x, p.doc.y), spread: pts[0]?.spread ?? 60 };
  let at = pts.length;
  if (t.g.mode === 'lines' && pts.length > 1) {
    let best = Infinity;
    for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, u = L ? Math.max(0, Math.min(1, ((p.doc.x - a.x) * dx + (p.doc.y - a.y) * dy) / L)) : 0, d = Math.hypot(p.doc.x - a.x - dx * u, p.doc.y - a.y - dy * u) * v.zoom; if (d < 8 && d < best) { best = d; at = k + 1; } }
  }
  const next = [...pts.slice(0, at), add, ...pts.slice(at)];
  e.edit('Add Gradient Point', (d) => withPoints(d, t.n, t.g, next));
  FF.sel = at;
  FF.drag = { id: t.n.id, kind: 'point', i: at, moved: false };
  e.beginDrag('Move Gradient Point');
  e.emit('options', null);
}

function freeformOverlay(ctx: ToolContext, g2: CanvasRenderingContext2D, t: { n: VNode; g: Gradient }): void {
  const v = ctx.view(), pts = t.g.points ?? [], accent = ctx.paint().accent;
  g2.save();
  if (t.g.mode === 'lines' && pts.length > 1) {
    g2.beginPath(); pts.forEach((q, i) => { const s = v.toScreen(q); if (i) g2.lineTo(s.x, s.y); else g2.moveTo(s.x, s.y); });
    g2.strokeStyle = '#000'; g2.lineWidth = 3; g2.stroke(); g2.strokeStyle = '#fff'; g2.lineWidth = 1; g2.stroke();
  }
  const sel = pts[FF.sel];
  if (sel) {
    const s = v.toScreen(sel), r = sel.spread * v.zoom;
    g2.setLineDash([4, 4]); g2.strokeStyle = '#fff'; g2.lineWidth = 1; g2.beginPath(); g2.arc(s.x, s.y, r, 0, Math.PI * 2); g2.stroke();
    g2.lineDashOffset = 4; g2.strokeStyle = '#000'; g2.stroke(); g2.setLineDash([]);
    g2.fillStyle = '#fff'; g2.strokeStyle = '#000'; g2.fillRect(s.x + r - 3.5, s.y - 3.5, 7, 7); g2.strokeRect(s.x + r - 3.5, s.y - 3.5, 7, 7);
  }
  pts.forEach((q, i) => {
    const s = v.toScreen(q);
    g2.beginPath(); g2.arc(s.x, s.y, i === FF.sel ? 8 : 6, 0, Math.PI * 2);
    g2.fillStyle = cssColor(q.color); g2.fill();
    g2.lineWidth = 2; g2.strokeStyle = i === FF.sel ? accent : '#fff'; g2.stroke();
    g2.lineWidth = 1; g2.strokeStyle = '#000'; g2.beginPath(); g2.arc(s.x, s.y, (i === FF.sel ? 8 : 6) + 1.5, 0, Math.PI * 2); g2.stroke();
  });
  g2.restore();
}

registerTool({
  id: 'gradient', label: 'Gradient Tool', group: 'gradient', order: 71, shortcut: 'G',
  icon: () => 'vGradient',
  hint: (e) => (freeformTarget(e) ? 'Freeform: click inside the object to add a color point, drag a point to move it, drag the square on its ring to change its spread, Delete removes the selected point.' : 'Drag across the selected objects to set the direction and length of their gradient fill; click to apply the default gradient.'),
  cursor: () => CURSORS.cross,
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    if (!e.hasSelection) { const h = e.hit(p.doc); if (h) e.select([e.selectableFor(h.id)]); }
    if (!e.hasSelection) return;
    const ff = freeformTarget(e);
    if (ff) { freeformDown(ctx, p, ff); return; }
    GR.on = true; GR.start = p.doc; GR.cur = p.doc; GR.moved = false;
    e.beginDrag('Gradient');
  },
  keydown: (ctx, ev) => {
    const e = ctx.engine, t = freeformTarget(e), pts = t?.g.points ?? [];
    if (!t || (ev.key !== 'Delete' && ev.key !== 'Backspace') || FF.sel < 0 || pts.length < 2) return false;
    e.edit('Delete Gradient Point', (d) => withPoints(d, t.n, t.g, pts.filter((_, i) => i !== FF.sel)));
    FF.sel = Math.min(FF.sel, pts.length - 2);
    e.emit('options', null);
    return true;
  },
  move: (ctx, p) => {
    const e = ctx.engine, base = e.dragOrigin;
    if (FF.drag && base) {
      const t = freeformTarget(e, base), d = FF.drag;
      if (!t) return;
      d.moved = true;
      const pts = (t.g.points ?? []).map((q, i) => (i !== d.i ? q : d.kind === 'point' ? { ...q, x: p.doc.x, y: p.doc.y } : { ...q, spread: Math.max(2, Math.hypot(p.doc.x - q.x, p.doc.y - q.y)) }));
      e.dragTo(withPoints(base, t.n, t.g, pts));
      return;
    }
    if (!GR.on || !base) return;
    GR.cur = p.shift ? (() => { const dx = p.doc.x - GR.start.x, dy = p.doc.y - GR.start.y, l = Math.hypot(dx, dy), a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); return { x: GR.start.x + Math.cos(a) * l, y: GR.start.y + Math.sin(a) * l }; })() : p.doc;
    if (Math.hypot(GR.cur.x - GR.start.x, GR.cur.y - GR.start.y) * ctx.view().zoom < 3) return;
    GR.moved = true;
    const geom = { x1: GR.start.x, y1: GR.start.y, x2: GR.cur.x, y2: GR.cur.y };
    let doc = base;
    for (const id of e.targetIds()) {
      const n = findNode(doc, id);
      if (!n || n.kind === 'text' || n.kind === 'group' || n.kind === 'layer') continue;
      const f = firstFill(n.ap);
      const g: Gradient = f && f.paint.type === 'gradient' ? { ...f.paint.gradient, geom } : { ...(e.fillPaint.type === 'gradient' ? e.fillPaint.gradient : defaultGradient()), geom };
      doc = replaceNode(doc, id, { ...n, ap: withFirstFill(n.ap, { type: 'gradient', gradient: g }) });
    }
    e.dragTo(doc);
  },
  up: (ctx) => {
    const e = ctx.engine;
    if (FF.drag) { const d = FF.drag; FF.drag = null; if (d.moved) e.commitDrag(); else e.cancelDrag(); return; }
    if (!GR.on) return;
    GR.on = false;
    if (GR.moved) { e.commitDrag(); return; }
    e.cancelDrag();
    const pr = e.current;
    if (!pr) return;
    const n = findNode(pr.doc, e.targetIds()[0] ?? '');
    const f = n ? firstFill(n.ap) : null;
    if (e.fillPaint.type === 'gradient' && e.fillPaint.gradient.kind === 'freeform') { e.setFreeform(e.fillPaint.gradient.mode ?? 'points'); FF.sel = -1; return; }
    if (!f || f.paint.type !== 'gradient') e.setFill({ type: 'gradient', gradient: e.fillPaint.type === 'gradient' ? e.fillPaint.gradient : defaultGradient() });
  },
  cancel: (ctx) => { if (FF.drag || GR.on) { FF.drag = null; GR.on = false; ctx.engine.cancelDrag(); } },
  overlay: (ctx, g) => {
    const e = ctx.engine, pr = e.current;
    if (!pr || !e.view.gradientAnnotator) return;
    const ff = freeformTarget(e);
    if (ff) { freeformOverlay(ctx, g, ff); return; }
    const v = ctx.view();
    for (const id of e.targetIds()) {
      const n = findNode(pr.doc, id), f = n ? firstFill(n.ap) : null;
      if (!f || f.paint.type !== 'gradient' || f.paint.gradient.kind === 'freeform') continue;
      const b = e.boundsOf(n as VNode), gr = f.paint.gradient, cx = b.x + b.w / 2, cy = b.y + b.h / 2, a = (gr.angle * Math.PI) / 180;
      const geom = gr.geom ?? { x1: cx - (Math.cos(a) * b.w) / 2, y1: cy + (Math.sin(a) * b.h) / 2, x2: cx + (Math.cos(a) * b.w) / 2, y2: cy - (Math.sin(a) * b.h) / 2 };
      const s = v.toScreen({ x: geom.x1, y: geom.y1 }), t = v.toScreen({ x: geom.x2, y: geom.y2 });
      g.save();
      g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(t.x, t.y); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke();
      for (const st of gr.stops) { const x = s.x + (t.x - s.x) * st.offset, y = s.y + (t.y - s.y) * st.offset; g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#000'; g.stroke(); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(s.x, s.y, 3.5, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
    }
  },
});

const M = { on: false, id: '', idx: -1, handle: -1, start: { x: 0, y: 0 }, moved: false, sel: null as { id: string; idx: number } | null };
const meshSel = (e: Engine): { m: MeshNode; idx: number } | null => {
  const s = M.sel, d = e.doc;
  if (!s || !d) return null;
  const m = findNode(d, s.id);
  return m?.kind === 'mesh' && s.idx < m.points.length && e.selectedIds().includes(m.id) ? { m, idx: s.idx } : null;
};
const meshHandleAt = (e: Engine, p: Pt, tol: number): number => { const s = meshSel(e); if (!s) return -1; const q = s.m.points[s.idx]; return q.h.findIndex((h) => Math.hypot(h.x, h.y) > 1e-6 && Math.hypot(q.x + h.x - p.x, q.y + h.y - p.y) <= tol); };
function setMeshPoint(e: Engine, patch: Partial<MeshPoint>, name: string): void {
  const s = meshSel(e);
  if (!s) return;
  e.edit(name, (d) => { const m = findNode(d, s.m.id); return m?.kind === 'mesh' ? replaceNode(d, m.id, { ...m, points: m.points.map((q, i) => (i === s.idx ? { ...q, ...patch } : q)) }) : d; }, { merge: true });
}
registerTool({
  id: 'mesh', label: 'Mesh Tool', group: 'gradient', order: 72, shortcut: 'U',
  icon: () => 'vMesh',
  hint: () => 'Click a shape to make a gradient mesh. Click inside a mesh or a selected envelope to add lines in the fill colour (Shift keeps the colour there); drag points and their handles; Alt-click a point to remove its lines.',
  cursor: () => CURSORS.cross,
  activate: () => { M.sel = null; },
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const tol = 6 / ctx.view().zoom, hk = meshHandleAt(e, p.doc, tol);
    if (hk >= 0 && M.sel) { M.on = true; M.id = M.sel.id; M.idx = M.sel.idx; M.handle = hk; M.start = p.doc; M.moved = false; e.beginDrag('Move Mesh Handle'); return; }
    const eh = envelopePointHit(ctx, p);
    if (eh && p.alt && eh.handle < 0) { EP.idx = -1; e.removeEnvelopeMeshLines(eh.n.id, eh.idx); return; }
    if (eh && envelopeDown(ctx, p)) return;
    const inside = e.selectedEnvelopes().find((x) => !x.editContents && pr.selection.has(x.id) && insideFill(envelopeOutline(pr.doc, x), p.doc, 'nonzero'));
    if (inside) { const idx = e.addEnvelopeMeshLine(inside.id, p.doc, 1e6); if (idx >= 0) { EP.id = inside.id; EP.idx = idx; } ctx.redraw(); return; }
    const h = e.hit(p.doc, 5);
    const n = h ? findNode(pr.doc, h.id) : null;
    if (!n) { M.sel = null; e.emit('options', null); ctx.redraw(); return; }
    if (n.kind === 'envelope' && !n.editContents) {
      M.sel = null;
      if (!pr.selection.has(n.id)) { e.select([n.id]); EP.id = n.id; EP.idx = -1; return; }
      const idx = e.addEnvelopeMeshLine(n.id, p.doc, 1e6);
      if (idx >= 0) { EP.id = n.id; EP.idx = idx; }
      ctx.redraw();
      return;
    }
    if (n.kind === 'mesh') {
      const idx = meshPointAt(n, p.doc, tol);
      e.select([n.id]);
      if (idx >= 0 && p.alt) { M.sel = null; e.edit('Delete Mesh Point', (d) => { const m = findNode(d, n.id); return m?.kind === 'mesh' ? replaceNode(d, n.id, removeMeshLines(m, idx)) : d; }); return; }
      if (idx >= 0) { M.sel = { id: n.id, idx }; M.on = true; M.id = n.id; M.idx = idx; M.handle = -1; M.start = p.doc; M.moved = false; e.beginDrag('Move Mesh Point'); e.emit('options', null); return; }
      const color = !p.shift && e.fillPaint.type === 'color' ? e.fillPaint.color : null;
      let added = -1;
      e.edit('Add Mesh Line', (d) => {
        const m = findNode(d, n.id) as MeshNode;
        let next = addMeshLine(m, p.doc);
        added = meshPointAt(next, p.doc, 1e9);
        if (color && added >= 0) next = { ...next, points: next.points.map((q, i) => (i === added ? { ...q, color } : q)) };
        return replaceNode(d, n.id, next);
      });
      if (added >= 0) { M.sel = { id: n.id, idx: added }; e.emit('options', null); }
      return;
    }
    if (n.kind === 'path' || n.kind === 'compound') { M.sel = null; e.select([n.id]); e.createMesh(Math.max(1, e.options.meshRows), Math.max(1, e.options.meshCols), 'flat'); }
  },
  move: (ctx, p) => {
    if (envelopeMove(ctx, p)) return;
    const e = ctx.engine, base = e.dragOrigin;
    if (!M.on || !base) return;
    const m = findNode(base, M.id) as MeshNode | null;
    if (!m) return;
    M.moved = true;
    const dx = p.doc.x - M.start.x, dy = p.doc.y - M.start.y;
    const pts = m.points.map((q, i) => {
      if (i !== M.idx) return q;
      if (M.handle < 0) return { ...q, x: q.x + dx, y: q.y + dy };
      const hs = [...q.h] as MeshPoint['h'];
      hs[M.handle] = { x: p.doc.x - q.x, y: p.doc.y - q.y };
      return { ...q, h: hs };
    });
    e.dragTo(replaceNode(base, M.id, { ...m, points: pts }));
  },
  up: (ctx) => { if (envelopeUp(ctx)) return; const e = ctx.engine; if (!M.on) return; M.on = false; if (M.moved) e.commitDrag(); else e.cancelDrag(); ctx.redraw(); },
  options: (e) => [
    { kind: 'title', text: 'Mesh' },
    { kind: 'range', label: 'Rows', min: 1, max: 20, get: () => e.options.meshRows, set: (v) => e.update({ meshRows: Math.round(v) }) },
    { kind: 'range', label: 'Columns', min: 1, max: 20, get: () => e.options.meshCols, set: (v) => e.update({ meshCols: Math.round(v) }) },
    { kind: 'color', label: 'Point', when: () => !!meshSel(e), get: () => { const s = meshSel(e); return s ? toRgb(s.m.points[s.idx].color) : { r: 0, g: 0, b: 0 }; }, set: (c) => setMeshPoint(e, { color: { kind: 'rgb', r: c.r, g: c.g, b: c.b } }, 'Mesh Point Color') },
    { kind: 'range', label: 'Opacity', min: 0, max: 100, unit: '%', when: () => !!meshSel(e), get: () => { const s = meshSel(e); return s ? Math.round(s.m.points[s.idx].opacity * 100) : 100; }, set: (v) => setMeshPoint(e, { opacity: Math.max(0, Math.min(1, v / 100)) }, 'Mesh Point Opacity') },
  ],
  overlay: (ctx, g) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const v = ctx.view(), color = layerColor(e), sel = meshSel(e);
    envelopeOverlay(ctx, g);
    for (const id of e.selectedIds()) {
      const m = findNode(pr.doc, id);
      if (m?.kind !== 'mesh') continue;
      g.save(); g.strokeStyle = color; g.lineWidth = 1;
      const at = (r: number, c: number): MeshPoint => m.points[r * (m.cols + 1) + c];
      const curve = (a: MeshPoint, ah: Pt, b: MeshPoint, bh: Pt): void => { const s0 = v.toScreen(a), s1 = v.toScreen({ x: a.x + ah.x, y: a.y + ah.y }), s2 = v.toScreen({ x: b.x + bh.x, y: b.y + bh.y }), s3 = v.toScreen(b); g.moveTo(s0.x, s0.y); g.bezierCurveTo(s1.x, s1.y, s2.x, s2.y, s3.x, s3.y); };
      g.beginPath();
      for (let r = 0; r <= m.rows; r++) for (let c = 0; c <= m.cols; c++) {
        if (c < m.cols) curve(at(r, c), at(r, c).h[0], at(r, c + 1), at(r, c + 1).h[1]);
        if (r < m.rows) curve(at(r, c), at(r, c).h[2], at(r + 1, c), at(r + 1, c).h[3]);
      }
      g.stroke();
      m.points.forEach((q, i) => { const s = v.toScreen(q), on = sel?.m.id === m.id && sel.idx === i; g.fillStyle = on ? color : '#fff'; g.fillRect(s.x - 3, s.y - 3, 6, 6); g.strokeRect(s.x - 3 + 0.5, s.y - 3 + 0.5, 5, 5); });
      if (sel?.m.id === m.id) {
        const q = m.points[sel.idx], s = v.toScreen(q);
        for (const hh of q.h) {
          if (Math.hypot(hh.x, hh.y) < 1e-6) continue;
          const t = v.toScreen({ x: q.x + hh.x, y: q.y + hh.y });
          g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(t.x, t.y); g.stroke();
          g.beginPath(); g.arc(t.x, t.y, 3, 0, Math.PI * 2); g.fillStyle = color; g.fill();
        }
      }
      g.restore();
    }
  },
});

let lpHover: PathData | null = null;
registerTool({
  id: 'livePaint', label: 'Live Paint Bucket', group: 'shapeBuilder', order: 74, shortcut: 'K',
  icon: () => 'vLivePaint',
  hint: () => 'Click an area closed by the selected paths to fill it; they become a Live Paint group and stay editable. Shift-click an edge to paint its stroke.',
  cursor: () => CURSORS.bucket,
  hover: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    lpHover = null;
    const g = p ? livePaintAt(ctx, p.doc) : null;
    if (g && p) { const i = faceAt(g, p.doc); if (i >= 0) lpHover = liveFaces(g)[i].d; }
    else if (p && pr && e.hasSelection) for (const r of regions(e)) if (ctxHit(r.d, p.doc)) { lpHover = r.d; break; }
    ctx.redraw();
  },
  down: (ctx, p) => {
    const e = ctx.engine, black = solid({ kind: 'rgb', r: 0, g: 0, b: 0 });
    const paint = p.shift ? (e.strokePaint.type === 'none' ? black : e.strokePaint) : e.fillPaint.type === 'none' ? black : e.fillPaint;
    const paintAt = (id: string): boolean => (p.shift ? e.livePaintEdge(id, p.doc, { paint, width: e.strokeWidth || 1 }, tolDoc(ctx, 5)) : e.livePaintFill(id, p.doc, paint));
    const g = livePaintAt(ctx, p.doc);
    if (g) { paintAt(g.id); cache = null; return; }
    if (!e.hasSelection) { const h = e.hit(p.doc); if (h) e.select([e.selectableFor(h.id)]); return; }
    e.beginStep();
    const id = e.makeLivePaint();
    if (id) paintAt(id);
    e.endStep();
    cache = null;
  },
  overlay: (ctx, g) => { if (lpHover) { const d = lpHover; inView(ctx, g, () => { g.fillStyle = 'rgba(255, 64, 64, 0.25)'; g.fill(cachedPath(d)); g.strokeStyle = '#ff4040'; g.lineWidth = 2 / ctx.view().zoom; g.stroke(cachedPath(d)); }); } },
});

const LS = { hover: null as PathData | null, pieces: new Map<string, PathData>() };
const lsKey = (q: Pt): string => `${Math.round(q.x * 100)}:${Math.round(q.y * 100)}`;
registerTool({
  id: 'livePaintSelect', label: 'Live Paint Selection Tool', group: 'shapeBuilder', order: 74.5, shortcut: 'Shift+L',
  icon: () => 'vLivePaintSelect',
  hint: () => 'Click faces and edges of a Live Paint group to select them, Shift-click to add or remove; the Fill and Stroke colours, the Stroke panel and Delete then change only those.',
  cursor: () => CURSORS.direct,
  activate: (ctx) => { ctx.engine.livePaintSelection = null; LS.pieces.clear(); },
  deactivate: (ctx) => { ctx.engine.livePaintSelection = null; LS.pieces.clear(); LS.hover = null; ctx.redraw(); },
  hover: (ctx, p) => {
    LS.hover = null;
    const g = p ? livePaintAt(ctx, p.doc) : null;
    if (g && p) {
      const edge = ctx.engine.livePaintEdgePiece(g.id, p.doc, tolDoc(ctx, 5));
      if (edge) LS.hover = [edge];
      else { const i = faceAt(g, p.doc); if (i >= 0) LS.hover = liveFaces(g)[i].d; }
    }
    ctx.redraw();
  },
  down: (ctx, p) => {
    const e = ctx.engine, g = livePaintAt(ctx, p.doc);
    if (!g) { if (!p.shift) { e.livePaintSelection = null; LS.pieces.clear(); } ctx.redraw(); return; }
    e.select([g.id]);
    const cur = e.livePaintSelection;
    const s = cur && cur.group === g.id && p.shift ? { group: g.id, faces: [...cur.faces], edges: [...cur.edges] } : { group: g.id, faces: [] as Pt[], edges: [] as Pt[] };
    if (!(cur && cur.group === g.id && p.shift)) LS.pieces.clear();
    const tol = tolDoc(ctx, 5), edge = e.livePaintEdgePiece(g.id, p.doc, tol);
    if (edge) {
      const on = nearestOnPath([edge], p.doc)?.pt ?? p.doc, i = s.edges.findIndex((q) => (nearestOnPath([edge], q)?.d ?? Infinity) < 0.5);
      if (i >= 0) { LS.pieces.delete(lsKey(s.edges[i])); s.edges.splice(i, 1); } else { s.edges.push(on); LS.pieces.set(lsKey(on), [edge]); }
    } else {
      const f = liveFaces(g).find((x) => faceContains(x, p.doc));
      if (!f) { ctx.redraw(); return; }
      const i = s.faces.findIndex((q) => faceContains(f, q));
      if (i >= 0) s.faces.splice(i, 1); else s.faces.push(p.doc);
    }
    e.livePaintSelection = s;
    e.emit('options', null);
    ctx.redraw();
  },
  overlay: (ctx, g) => {
    const e = ctx.engine, doc = e.doc, s = e.livePaintSelection, n = s && doc ? findNode(doc, s.group) : null;
    inView(ctx, g, () => {
      const z = ctx.view().zoom, accent = ctx.paint().accent;
      if (LS.hover) { g.strokeStyle = accent; g.lineWidth = 2 / z; g.stroke(cachedPath(LS.hover)); }
      if (!s || n?.kind !== 'group' || !n.livePaint) return;
      g.fillStyle = 'rgba(80, 140, 255, 0.28)'; g.strokeStyle = accent; g.lineWidth = 1.5 / z;
      for (const q of s.faces) { const f = liveFaces(n).find((x) => faceContains(x, q)); if (f) { g.fill(cachedPath(f.d), 'evenodd'); g.setLineDash([4 / z, 3 / z]); g.stroke(cachedPath(f.d)); g.setLineDash([]); } }
      g.lineWidth = 4 / z;
      for (const q of s.edges) { const d = LS.pieces.get(lsKey(q)); if (d) g.stroke(cachedPath(d)); }
    });
  },
});

let cache: { key: string; doc: unknown; regions: Array<{ d: PathData }> } | null = null;
function regions(e: Engine): Array<{ d: PathData }> {
  const pr = e.current;
  if (!pr) return [];
  const key = e.targetIds().join(',');
  if (!cache || cache.key !== key || cache.doc !== pr.doc) {
    try { cache = { key, doc: pr.doc, regions: computeFaces(e.targetIds().map((id) => findNode(pr.doc, id)).filter((n): n is VNode => !!n), 0) }; } catch { cache = { key, doc: pr.doc, regions: [] }; }
  }
  return cache.regions;
}

function livePaintAt(ctx: ToolContext, at: Pt): GroupNode | null {
  const e = ctx.engine, doc = e.doc, pr = e.current;
  if (!doc || !pr) return null;
  const h = e.hit(at);
  for (const id of [...(h?.chain ?? [])].reverse()) { const n = findNode(doc, id); if (n?.kind === 'group' && n.livePaint) return n; }
  for (const id of pr.selection) { const n = findNode(doc, id); if (n?.kind === 'group' && n.livePaint && faceAt(n, at) >= 0) return n; }
  return null;
}

let hc: CanvasRenderingContext2D | null = null;
function ctxHit(d: PathData, p: Pt): boolean {
  hc ??= document.createElement('canvas').getContext('2d');
  return !!hc && hc.isPointInPath(cachedPath(d), p.x, p.y, 'evenodd');
}

const SB = { on: false, pts: [] as Pt[], hover: null as PathData | null, alt: false };
registerTool({
  id: 'shapeBuilder', label: 'Shape Builder Tool', group: 'shapeBuilder', order: 73, shortcut: 'Shift+M',
  icon: () => 'vShapeBuilder',
  hint: () => 'With overlapping shapes selected, drag across regions to merge them into one shape; Alt-drag or Alt-click removes regions.',
  cursor: () => CURSORS.cross,
  hover: (ctx, p) => {
    const e = ctx.engine;
    SB.hover = null;
    if (p && e.hasSelection) for (const r of regions(e)) if (ctxHit(r.d, p.doc)) { SB.hover = r.d; break; }
    SB.alt = !!p?.alt;
    ctx.redraw();
  },
  down: (ctx, p) => { SB.on = true; SB.pts = [p.doc]; SB.alt = p.alt; },
  move: (ctx, p) => { if (!SB.on) return; SB.pts.push(p.doc); ctx.redraw(); },
  up: (ctx, p) => {
    if (!SB.on) return;
    SB.on = false;
    const e = ctx.engine;
    if (e.hasSelection) e.shapeBuild(SB.pts, p.alt || SB.alt);
    cache = null; SB.pts = [];
    ctx.redraw();
  },
  overlay: (ctx, g) => {
    const e = ctx.engine;
    const hits = SB.on ? regions(e).filter((r) => SB.pts.some((q) => ctxHit(r.d, q))) : SB.hover ? [{ d: SB.hover }] : [];
    if (!hits.length) return;
    inView(ctx, g, () => {
      for (const r of hits) {
        g.fillStyle = SB.alt ? 'rgba(255, 64, 64, 0.25)' : 'rgba(128, 128, 128, 0.35)';
        g.fill(cachedPath(r.d));
        g.strokeStyle = SB.alt ? '#ff4040' : layerColor(e);
        g.lineWidth = 1.5 / ctx.view().zoom;
        g.stroke(cachedPath(r.d));
      }
    });
    if (SB.on) { const v = ctx.view(); g.save(); g.strokeStyle = SB.alt ? '#ff4040' : layerColor(e); g.beginPath(); SB.pts.forEach((q, i) => { const s = v.toScreen(q); if (i) g.lineTo(s.x, s.y); else g.moveTo(s.x, s.y); }); g.stroke(); g.restore(); }
  },
});

const BL = { first: null as string | null };
registerTool({
  id: 'blend', label: 'Blend Tool', group: 'blend', order: 75, shortcut: 'W',
  icon: () => 'vBlend',
  hint: () => 'Click one object, then another, to blend between them. Set steps in Object > Blend > Blend Options.',
  cursor: () => CURSORS.cross,
  activate: () => { BL.first = null; },
  down: (ctx, p) => {
    const e = ctx.engine, h = e.hit(p.doc);
    if (!h) { BL.first = null; ctx.redraw(); return; }
    const id = e.selectableFor(h.id);
    if (!BL.first || BL.first === id) { BL.first = id; e.select([id]); ctx.redraw(); return; }
    const first = BL.first;
    BL.first = null;
    e.makeBlend(undefined, 'smooth', 10, [first, id]);
  },
  overlay: (ctx, g) => {
    const e = ctx.engine, pr = e.current;
    if (!BL.first || !pr) return;
    const n = findNode(pr.doc, BL.first);
    if (!n) return;
    const b = e.boundsOf(n), s = ctx.view().toScreen({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
    g.save(); g.fillStyle = ctx.paint().accent; g.beginPath(); g.arc(s.x, s.y, 4, 0, Math.PI * 2); g.fill(); g.restore();
  },
});

const SP = { on: false, last: { x: 0, y: 0 }, placed: [] as VNode[], hover: null as Pt | null };
registerTool({
  id: 'symbolSprayer', label: 'Symbol Sprayer Tool', group: 'symbolism', order: 76, shortcut: 'Shift+S',
  icon: () => 'vSymbolSprayer',
  hint: () => 'Drag to spray instances of the symbol chosen in the Symbols panel.',
  cursor: () => CURSORS.cross,
  options: (e) => [
    { kind: 'title', text: 'Symbol Sprayer' },
    { kind: 'select', label: 'Symbol', choices: [], live: () => (e.doc?.symbols ?? []).map((s) => ({ id: s.id, label: s.name })), get: () => e.currentSymbol ?? '', set: (v) => { e.currentSymbol = v; e.emit('options', null); } },
    { kind: 'range', label: 'Density', min: 1, max: 10, get: () => e.options.symbolDensity, set: (v) => e.update({ symbolDensity: Math.round(v) }) },
    { kind: 'range', label: 'Diameter', min: 4, max: 800, unit: 'pt', get: () => e.options.liquifySize, set: (v) => e.update({ liquifySize: v }) },
  ],
  hover: (ctx, p) => { SP.hover = p?.doc ?? null; ctx.redraw(); },
  down: (ctx, p) => {
    const e = ctx.engine, doc = e.doc;
    if (!doc) return;
    const sym = doc.symbols.find((s) => s.id === e.currentSymbol) ?? doc.symbols[0];
    if (!sym) { e.notice('Make a symbol first: select artwork and choose Object > Symbol > New Symbol.'); return; }
    e.currentSymbol = sym.id;
    SP.on = true; SP.last = p.doc; SP.placed = [];
    spray(ctx, p.doc, sym.id);
  },
  move: (ctx, p) => {
    SP.hover = p.doc;
    if (!SP.on || !ctx.engine.currentSymbol) return;
    const step = (ctx.engine.options.liquifySize / 2) / Math.max(1, ctx.engine.options.symbolDensity);
    if (Math.hypot(p.doc.x - SP.last.x, p.doc.y - SP.last.y) < step) return;
    SP.last = p.doc;
    spray(ctx, p.doc, ctx.engine.currentSymbol);
  },
  up: (ctx) => {
    if (!SP.on) return;
    SP.on = false;
    if (SP.placed.length) {
      const nodes = SP.placed;
      ctx.engine.addNodes('Symbol Sprayer', [{ id: newId('g'), kind: 'group', clip: false, children: nodes, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, name: 'Symbol Set' }]);
    }
    SP.placed = [];
    ctx.redraw();
  },
  overlay: (ctx, g) => {
    const e = ctx.engine, pr = e.current, v = ctx.view();
    if (SP.hover) { const s = v.toScreen(SP.hover); g.save(); g.strokeStyle = ctx.paint().accent; g.beginPath(); g.arc(s.x, s.y, (e.options.liquifySize / 2) * v.zoom, 0, Math.PI * 2); g.stroke(); g.restore(); }
    if (!pr || !SP.placed.length) return;
    inView(ctx, g, () => {
      g.strokeStyle = layerColor(e);
      for (const n of SP.placed) { if (n.kind !== 'symbol') continue; const sym = pr.doc.symbols.find((s) => s.id === n.symbol); if (!sym) continue; const b = e.boundsOf(sym.art); g.save(); g.transform(...n.xf); g.strokeRect(b.x, b.y, b.w, b.h); g.restore(); }
    });
  },
});

function spray(ctx: ToolContext, at: Pt, sym: string): void {
  const r = ctx.engine.options.liquifySize / 2, a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r * 0.6;
  const x = at.x + Math.cos(a) * d, y = at.y + Math.sin(a) * d, s = 0.8 + Math.random() * 0.4;
  SP.placed.push({ id: newId('i'), kind: 'symbol', symbol: sym, xf: [s, 0, 0, s, x, y], opacity: 1, blend: 'normal', ap: { items: [], effects: [] } });
  ctx.redraw();
}

const ME = { on: false, a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, shape: null as null | { at: Pt; lines: string[] } };
function closedShapes(n: VNode): PathData[] {
  if (n.kind === 'path') { const d = n.d.filter((sp) => sp.closed && sp.pts.length > 2); return d.length ? [d] : []; }
  if (n.kind === 'compound') { const d = n.children.flatMap((c) => c.d).filter((sp) => sp.closed && sp.pts.length > 2); return d.length ? [d] : []; }
  if (n.kind === 'group' && !n.dim) return n.children.flatMap(closedShapes);
  return [];
}
function areaLines(e: Engine, nodes: VNode[]): string[] {
  const shapes = nodes.flatMap(closedShapes);
  if (!shapes.length) return [];
  const u = e.doc?.units ?? 'pt', k = { pt: 1, px: 1, mm: 72 / 25.4, cm: 72 / 2.54, in: 72, pc: 12 }[u];
  const a = shapes.reduce((s, d) => s + area(d), 0), per = shapes.reduce((s, d) => s + d.reduce((t, sp) => t + pathLength(sp), 0), 0);
  return [`Area: ${fmt(a / (k * k))} ${u}²`, `Perimeter: ${unitLabel(e, per)}`];
}
registerTool({
  id: 'measure', label: 'Measure Tool', group: 'eyedropper', order: 77,
  icon: () => 'vMeasure',
  hint: () => 'Drag to measure the distance and angle between two points; click a closed shape (or measure with shapes selected) for its area and perimeter.',
  cursor: () => CURSORS.cross,
  down: (ctx, p) => { ME.on = true; ME.shape = null; ME.a = ctx.snap(p.doc).p; ME.b = ME.a; },
  move: (ctx, p) => { if (!ME.on) return; ME.b = p.shift ? (() => { const dx = p.doc.x - ME.a.x, dy = p.doc.y - ME.a.y, l = Math.hypot(dx, dy), q = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); return { x: ME.a.x + Math.cos(q) * l, y: ME.a.y + Math.sin(q) * l }; })() : ctx.snap(p.doc, undefined, { from: ME.a }).p; ctx.redraw(); },
  up: (ctx, p) => {
    const e = ctx.engine;
    ME.on = false;
    if (Math.hypot(ME.b.x - ME.a.x, ME.b.y - ME.a.y) * ctx.view().zoom < 2) {
      const h = e.hit(p.doc), n = h ? e.nodeById(e.selectableFor(h.id)) : null, lines = n ? areaLines(e, [n]) : areaLines(e, e.selected());
      ME.a = ME.b = p.doc;
      ME.shape = lines.length ? { at: p.doc, lines } : null;
      e.setOverlay({ label: lines.length ? lines.join('  ') : null, at: p.doc, lines: [] });
      ctx.redraw();
      return;
    }
    e.setOverlay({ label: `D ${unitLabel(e, Math.hypot(ME.b.x - ME.a.x, ME.b.y - ME.a.y))}`, at: ME.b, lines: [] });
  },
  overlay: (ctx, g) => {
    if (ME.shape) { hud(ctx, g, ctx.view().toScreen(ME.shape.at), ME.shape.lines); return; }
    if (ME.a.x === ME.b.x && ME.a.y === ME.b.y) return;
    const v = ctx.view(), s = v.toScreen(ME.a), t = v.toScreen(ME.b), e = ctx.engine;
    g.save(); g.strokeStyle = ctx.paint().accent; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(t.x, t.y); g.stroke(); g.restore();
    const dx = ME.b.x - ME.a.x, dy = ME.b.y - ME.a.y;
    hud(ctx, g, t, [`D: ${unitLabel(e, Math.hypot(dx, dy))}`, `W: ${unitLabel(e, Math.abs(dx))}  H: ${unitLabel(e, Math.abs(dy))}`, `${fmt((-Math.atan2(dy, dx) * 180) / Math.PI)}°`, ...areaLines(e, e.selected())]);
  },
});

export const measured = (): { a: Pt; b: Pt } => ({ a: ME.a, b: ME.b });
