import { findNode, newId } from '../engine/doc';
import { cachedPath } from '../engine/render';
import { addMeshLine, meshPointAt } from '../engine/mesh';
import { livePaintFill, shapeRegions } from '../engine/ops/paths';
import { defaultGradient, firstFill, firstStroke, solid, withFirstFill } from '../engine/paint';
import type { Engine, Gradient, MeshNode, PathData, Pt, VNode } from '../engine';
import { registerTool, type ToolContext } from '../extensions/registry';
import { CURSORS } from '../ui/cursors';
import { replaceNode } from './select';
import { fmt, hud, inView, layerColor, unitLabel } from './util';

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
registerTool({
  id: 'gradient', label: 'Gradient Tool', group: 'gradient', order: 71, shortcut: 'G',
  icon: () => 'vGradient',
  hint: () => 'Drag across the selected objects to set the direction and length of their gradient fill; click to apply the default gradient.',
  cursor: () => CURSORS.cross,
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    if (!e.hasSelection) { const h = e.hit(p.doc); if (h) e.select([e.selectableFor(h.id)]); }
    if (!e.hasSelection) return;
    GR.on = true; GR.start = p.doc; GR.cur = p.doc; GR.moved = false;
    e.beginDrag('Gradient');
  },
  move: (ctx, p) => {
    const e = ctx.engine, base = e.dragOrigin;
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
    if (!GR.on) return;
    GR.on = false;
    if (GR.moved) { e.commitDrag(); return; }
    e.cancelDrag();
    const pr = e.current;
    if (!pr) return;
    const n = findNode(pr.doc, e.targetIds()[0] ?? '');
    const f = n ? firstFill(n.ap) : null;
    if (!f || f.paint.type !== 'gradient') e.setFill({ type: 'gradient', gradient: e.fillPaint.type === 'gradient' ? e.fillPaint.gradient : defaultGradient() });
  },
  overlay: (ctx, g) => {
    const e = ctx.engine, pr = e.current;
    if (!pr || !e.view.gradientAnnotator) return;
    const v = ctx.view();
    for (const id of e.targetIds()) {
      const n = findNode(pr.doc, id), f = n ? firstFill(n.ap) : null;
      if (!f || f.paint.type !== 'gradient') continue;
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

const M = { on: false, id: '', idx: -1, start: { x: 0, y: 0 }, moved: false };
registerTool({
  id: 'mesh', label: 'Mesh Tool', group: 'gradient', order: 72, shortcut: 'U',
  icon: () => 'vMesh',
  hint: () => 'Click a shape to turn it into a gradient mesh, click inside a mesh to add a mesh line in the current fill color, drag a mesh point to move it.',
  cursor: () => CURSORS.cross,
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const h = e.hit(p.doc, 5);
    const n = h ? findNode(pr.doc, h.id) : null;
    if (!n) return;
    if (n.kind === 'mesh') {
      const idx = meshPointAt(n, p.doc, 6 / ctx.view().zoom);
      e.select([n.id]);
      if (idx >= 0) { M.on = true; M.id = n.id; M.idx = idx; M.start = p.doc; M.moved = false; e.beginDrag('Move Mesh Point'); return; }
      const color = e.fillPaint.type === 'color' ? e.fillPaint.color : null;
      e.edit('Add Mesh Line', (d) => {
        const m = findNode(d, n.id) as MeshNode;
        let next = addMeshLine(m, p.doc);
        if (color) { const k = meshPointAt(next, p.doc, 1e9); if (k >= 0) next = { ...next, points: next.points.map((q, i) => (i === k ? { ...q, color } : q)) }; }
        return replaceNode(d, n.id, next);
      });
      return;
    }
    if (n.kind === 'path' || n.kind === 'compound') { e.select([n.id]); e.createMesh(Math.max(1, e.options.meshRows), Math.max(1, e.options.meshCols), 'flat'); }
  },
  move: (ctx, p) => {
    const e = ctx.engine, base = e.dragOrigin;
    if (!M.on || !base) return;
    const m = findNode(base, M.id) as MeshNode | null;
    if (!m) return;
    M.moved = true;
    const dx = p.doc.x - M.start.x, dy = p.doc.y - M.start.y;
    const pts = m.points.map((q, i) => (i === M.idx ? { ...q, x: q.x + dx, y: q.y + dy, h: q.h.map((hh) => ({ x: hh.x + dx, y: hh.y + dy })) as typeof q.h } : q));
    e.dragTo(replaceNode(base, M.id, { ...m, points: pts }));
  },
  up: (ctx) => { const e = ctx.engine; if (!M.on) return; M.on = false; if (M.moved) e.commitDrag(); else e.cancelDrag(); },
  options: (e) => [{ kind: 'title', text: 'Mesh' }, { kind: 'range', label: 'Rows', min: 1, max: 20, get: () => e.options.meshRows, set: (v) => e.update({ meshRows: Math.round(v) }) }, { kind: 'range', label: 'Columns', min: 1, max: 20, get: () => e.options.meshCols, set: (v) => e.update({ meshCols: Math.round(v) }) }],
  overlay: (ctx, g) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const v = ctx.view(), color = layerColor(e);
    for (const id of e.selectedIds()) {
      const m = findNode(pr.doc, id);
      if (m?.kind !== 'mesh') continue;
      g.save(); g.strokeStyle = color; g.lineWidth = 1;
      const at = (r: number, c: number): Pt => m.points[r * (m.cols + 1) + c];
      g.beginPath();
      for (let r = 0; r <= m.rows; r++) for (let c = 0; c <= m.cols; c++) {
        const a = v.toScreen(at(r, c));
        if (c < m.cols) { const b = v.toScreen(at(r, c + 1)); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
        if (r < m.rows) { const b = v.toScreen(at(r + 1, c)); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
      }
      g.stroke();
      for (const q of m.points) { const s = v.toScreen(q); g.fillStyle = '#fff'; g.fillRect(s.x - 3, s.y - 3, 6, 6); g.strokeRect(s.x - 3 + 0.5, s.y - 3 + 0.5, 5, 5); }
      g.restore();
    }
  },
});

let lpHover: PathData | null = null;
registerTool({
  id: 'livePaint', label: 'Live Paint Bucket', group: 'shapeBuilder', order: 74, shortcut: 'K',
  icon: () => 'vLivePaint',
  hint: () => 'Click a region formed by the selected paths to fill it with the current fill; the paths stay editable as separate pieces.',
  cursor: () => CURSORS.bucket,
  hover: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    lpHover = null;
    if (p && pr && e.hasSelection) for (const r of regions(e)) if (ctxHit(r.d, p.doc)) { lpHover = r.d; break; }
    ctx.redraw();
  },
  down: (ctx, p) => {
    const e = ctx.engine;
    if (!e.hasSelection) { const h = e.hit(p.doc); if (h) e.select([e.selectableFor(h.id)]); return; }
    const paint = e.fillPaint.type === 'none' ? solid({ kind: 'rgb', r: 0, g: 0, b: 0 }) : e.fillPaint;
    e.run('Live Paint', (d, ids) => livePaintFill(d, ids, p.doc, paint));
    cache = null;
  },
  overlay: (ctx, g) => { if (lpHover) { const d = lpHover; inView(ctx, g, () => { g.fillStyle = 'rgba(255, 64, 64, 0.25)'; g.fill(cachedPath(d)); g.strokeStyle = '#ff4040'; g.lineWidth = 2 / ctx.view().zoom; g.stroke(cachedPath(d)); }); } },
});

let cache: { key: string; doc: unknown; regions: Array<{ d: PathData; top: string; sources: string[] }> } | null = null;
function regions(e: Engine): Array<{ d: PathData; top: string; sources: string[] }> {
  const pr = e.current;
  if (!pr) return [];
  const key = e.targetIds().join(',');
  if (!cache || cache.key !== key || cache.doc !== pr.doc) {
    try { cache = { key, doc: pr.doc, regions: shapeRegions(pr.doc, e.targetIds()) }; } catch { cache = { key, doc: pr.doc, regions: [] }; }
  }
  return cache.regions;
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

const ME = { on: false, a: { x: 0, y: 0 }, b: { x: 0, y: 0 } };
registerTool({
  id: 'measure', label: 'Measure Tool', group: 'eyedropper', order: 77,
  icon: () => 'vMeasure',
  hint: () => 'Drag to measure the distance and angle between two points; the result shows in the Info panel too.',
  cursor: () => CURSORS.cross,
  down: (ctx, p) => { ME.on = true; ME.a = ctx.snap(p.doc).p; ME.b = ME.a; },
  move: (ctx, p) => { if (!ME.on) return; ME.b = p.shift ? (() => { const dx = p.doc.x - ME.a.x, dy = p.doc.y - ME.a.y, l = Math.hypot(dx, dy), q = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); return { x: ME.a.x + Math.cos(q) * l, y: ME.a.y + Math.sin(q) * l }; })() : ctx.snap(p.doc, undefined, { from: ME.a }).p; ctx.redraw(); },
  up: (ctx) => { ME.on = false; ctx.engine.setOverlay({ label: `D ${unitLabel(ctx.engine, Math.hypot(ME.b.x - ME.a.x, ME.b.y - ME.a.y))}`, at: ME.b, lines: [] }); },
  overlay: (ctx, g) => {
    if (ME.a.x === ME.b.x && ME.a.y === ME.b.y) return;
    const v = ctx.view(), s = v.toScreen(ME.a), t = v.toScreen(ME.b), e = ctx.engine;
    g.save(); g.strokeStyle = ctx.paint().accent; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(t.x, t.y); g.stroke(); g.restore();
    const dx = ME.b.x - ME.a.x, dy = ME.b.y - ME.a.y;
    hud(ctx, g, t, [`D: ${unitLabel(e, Math.hypot(dx, dy))}`, `W: ${unitLabel(e, Math.abs(dx))}  H: ${unitLabel(e, Math.abs(dy))}`, `${fmt((-Math.atan2(dy, dx) * 180) / Math.PI)}°`]);
  },
});

export const measured = (): { a: Pt; b: Pt } => ({ a: ME.a, b: ME.b });
