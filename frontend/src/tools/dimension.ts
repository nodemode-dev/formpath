import { findNode, updateNodes } from '../engine/doc';
import { circleFrom, circumcentre, dimensionChildren, dimensionSpec, dimHandles, dimLabel, dimOffsetFor } from '../engine/dimension';
import { cachedPath } from '../engine/render';
import { cssColor } from '../engine/paint';
import { layoutText } from '../engine/text';
import type { DimensionSpec, Engine, GroupNode, Pt, RGB, VNode } from '../engine';
import { registerTool, type OptionSpec, type ToolContext, type ToolPointer } from '../extensions/registry';
import { families, stylesOf } from '../io/fonts';
import { CURSORS } from '../ui/cursors';
import { anchorDot, hud, inView } from './util';

type Phase = null | 'pts' | 'offset';
const D = { phase: null as Phase, pts: [] as Pt[], cur: { x: 0, y: 0 }, down: { x: 0, y: 0 }, pressed: false, circle: false, edit: null as null | { id: string; which: number }, moved: false };

const defaults = (e: Engine): DimensionSpec => dimensionSpec({ type: 'linear', pts: [], ...(e.options.dim ?? {}) });
const selectedDims = (e: Engine): GroupNode[] => e.selected().filter((n): n is GroupNode => n.kind === 'group' && !!n.dim);
const current = (e: Engine): DimensionSpec => selectedDims(e)[0]?.dim ?? defaults(e);
const need = (s: DimensionSpec, e: Engine): number => (s.type === 'linear' ? 2 : s.type === 'angular' ? 3 : (e.options.dimPick ?? 'center') === 'three' ? 3 : 2);

function setOpt(e: Engine, patch: Partial<DimensionSpec>, apply = true): void {
  e.update({ dim: { ...(e.options.dim ?? {}), ...patch } });
  if (apply && selectedDims(e).length) e.setDimension(patch);
}

function previewSpec(e: Engine): DimensionSpec | null {
  const base = defaults(e), pts = [...D.pts];
  if (D.phase === 'pts') pts.push(D.cur);
  if (base.type === 'radial' && (e.options.dimPick ?? 'center') === 'three' && !D.circle) {
    if (pts.length < 3) return null;
    const c = circumcentre(pts[0], pts[1], pts[2]);
    return c ? { ...base, pts: [c, pts[0]], offset: D.phase === 'offset' ? dimOffsetFor({ ...base, pts: [c, pts[0]] }, D.cur) : 0 } : null;
  }
  if (pts.length < (base.type === 'angular' ? 3 : 2)) return null;
  const s = { ...base, pts: pts.slice(0, base.type === 'angular' ? 3 : 2) };
  return D.phase === 'offset' ? { ...s, offset: dimOffsetFor(s, D.cur) } : s.type === 'radial' ? { ...s, offset: 0 } : s;
}

function handleAt(ctx: ToolContext, p: Pt): { id: string; which: number } | null {
  const v = ctx.view(), s = v.toScreen(p);
  for (const g of selectedDims(ctx.engine)) for (const h of dimHandles(g.dim as DimensionSpec)) {
    const t = v.toScreen(h.at);
    if (Math.hypot(t.x - s.x, t.y - s.y) <= 6) return { id: g.id, which: h.which };
  }
  return null;
}

function snapped(ctx: ToolContext, p: ToolPointer, exclude?: Set<string>, from?: Pt): Pt {
  if (p.shift && from) {
    const dx = p.doc.x - from.x, dy = p.doc.y - from.y, l = Math.hypot(dx, dy), a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    return { x: from.x + Math.cos(a) * l, y: from.y + Math.sin(a) * l };
  }
  return ctx.snap(p.doc, exclude, from ? { from } : undefined).p;
}

function reset(): void { D.phase = null; D.pts = []; D.pressed = false; D.circle = false; }

function commit(ctx: ToolContext): void {
  const s = previewSpec(ctx.engine);
  reset();
  if (s) ctx.engine.addDimension(s);
  ctx.redraw();
}

const UNITS = [{ id: 'doc', label: 'Document' }, { id: 'pt', label: 'Points' }, { id: 'px', label: 'Pixels' }, { id: 'mm', label: 'Millimetres' }, { id: 'cm', label: 'Centimetres' }, { id: 'in', label: 'Inches' }, { id: 'pc', label: 'Picas' }] as const;

function options(e: Engine): OptionSpec[] {
  const cur = (): DimensionSpec => current(e);
  const isType = (t: DimensionSpec['type']) => (): boolean => defaults(e).type === t;
  const hex = (c: DimensionSpec['color']): RGB => { const m = /#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(cssColor(c)); return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 }; };
  return [
    { kind: 'title', text: 'Dimension' },
    { kind: 'segment', label: 'Type', choices: [{ id: 'linear', label: 'Linear' }, { id: 'angular', label: 'Angular' }, { id: 'radial', label: 'Radial' }], get: () => defaults(e).type, set: (v) => { reset(); setOpt(e, { type: v as DimensionSpec['type'] }, false); } },
    { kind: 'segment', label: 'Measure', choices: [{ id: 'horizontal', label: 'Horizontal' }, { id: 'vertical', label: 'Vertical' }, { id: 'aligned', label: 'Aligned' }], get: () => cur().orient, set: (v) => setOpt(e, { orient: v as DimensionSpec['orient'] }), when: isType('linear') },
    { kind: 'segment', label: 'Measure', choices: [{ id: 'radius', label: 'Radius' }, { id: 'diameter', label: 'Diameter' }], get: () => cur().radial, set: (v) => setOpt(e, { radial: v as DimensionSpec['radial'] }), when: isType('radial') },
    { kind: 'segment', label: 'From', choices: [{ id: 'center', label: 'Centre' }, { id: 'three', label: 'Three Points' }], get: () => e.options.dimPick ?? 'center', set: (v) => { reset(); e.update({ dimPick: v as 'center' | 'three' }); }, when: isType('radial') },
    { kind: 'select', label: 'Units', choices: UNITS, get: () => cur().units, set: (v) => setOpt(e, { units: v as DimensionSpec['units'] }) },
    { kind: 'number', label: 'Precision', min: 0, max: 6, step: 1, get: () => cur().precision, set: (v) => setOpt(e, { precision: Math.max(0, Math.min(6, Math.round(v))) }) },
    { kind: 'number', label: 'Scale 1:', min: 0.0001, step: 1, get: () => cur().scale, set: (v) => { if (v > 0) setOpt(e, { scale: v }); } },
    { kind: 'toggle', label: 'Unit Label', get: () => cur().showUnits, set: (v) => setOpt(e, { showUnits: v }) },
    { kind: 'select', label: 'Arrows', choices: [{ id: 'filled', label: 'Filled' }, { id: 'open', label: 'Open' }, { id: 'tick', label: 'Tick' }, { id: 'dot', label: 'Dot' }, { id: 'none', label: 'None' }], get: () => cur().arrow, set: (v) => setOpt(e, { arrow: v as DimensionSpec['arrow'] }) },
    { kind: 'number', label: 'Arrow Size', min: 1, max: 72, step: 1, unit: 'pt', get: () => cur().arrowSize, set: (v) => setOpt(e, { arrowSize: Math.max(1, v) }) },
    { kind: 'select', label: 'Font', choices: [], live: () => families().map((f) => ({ id: f, label: f })), get: () => cur().font, set: (v) => setOpt(e, { font: v, style: stylesOf(v).includes(cur().style) ? cur().style : stylesOf(v)[0] ?? 'Regular' }) },
    { kind: 'select', label: 'Style', choices: [], live: () => stylesOf(cur().font).map((s) => ({ id: s, label: s })), get: () => cur().style, set: (v) => setOpt(e, { style: v }) },
    { kind: 'number', label: 'Size', min: 1, max: 288, step: 1, unit: 'pt', get: () => cur().size, set: (v) => setOpt(e, { size: Math.max(1, v) }) },
    { kind: 'select', label: 'Text', choices: [{ id: 'above', label: 'Above' }, { id: 'center', label: 'Centre' }, { id: 'below', label: 'Below' }], get: () => cur().textPos, set: (v) => setOpt(e, { textPos: v as DimensionSpec['textPos'] }) },
    { kind: 'color', label: 'Colour', get: () => hex(cur().color), set: (c) => setOpt(e, { color: { kind: 'rgb', r: c.r, g: c.g, b: c.b } }) },
    { kind: 'number', label: 'Weight', min: 0.1, max: 20, step: 0.25, unit: 'pt', get: () => cur().weight, set: (v) => setOpt(e, { weight: Math.max(0.05, v) }) },
    { kind: 'number', label: 'Offset', step: 1, unit: 'pt', get: () => cur().offset, set: (v) => setOpt(e, { offset: v }) },
  ];
}

registerTool({
  id: 'dimension', label: 'Dimension Tool', group: 'eyedropper', order: 77.5, shortcut: 'Shift+I',
  icon: () => 'vDimension',
  hint: (e) => {
    const t = defaults(e).type;
    if (t === 'angular') return 'Click the vertex, then a point on each arm, then click to place the arc. Drag a selected dimension\'s handles to re-measure.';
    if (t === 'radial') return (e.options.dimPick ?? 'center') === 'three' ? 'Click three points on a circle or arc, then click to place the label.' : 'Click a circle or arc, or drag from a centre to the rim, then click to place the label.';
    return 'Drag (or click twice) between two points, then click to place the dimension line. Shift constrains to 45 degrees.';
  },
  cursor: (ctx, p) => (p && handleAt(ctx, p.doc) ? CURSORS.direct : CURSORS.cross),
  options,
  hover: (ctx, p) => { if (!p) return; D.cur = D.phase ? (D.phase === 'pts' ? snapped(ctx, p, undefined, D.pts[D.pts.length - 1]) : p.doc) : p.doc; if (D.phase) ctx.redraw(); },
  down: (ctx, p) => {
    const e = ctx.engine;
    if (!D.phase) {
      const h = handleAt(ctx, p.doc);
      if (h) { D.edit = h; D.moved = false; D.down = p.doc; e.beginDrag('Edit Dimension'); return; }
      const t = defaults(e).type;
      if (t === 'radial' && (e.options.dimPick ?? 'center') === 'center') {
        const hit = e.hit(p.doc, 6), n = hit ? e.nodeById(hit.id) : null, c = n ? circleFrom(n) : null;
        if (c) {
          const d = Math.hypot(p.doc.x - c.c.x, p.doc.y - c.c.y) || 1;
          D.pts = [c.c, { x: c.c.x + ((p.doc.x - c.c.x) / d) * c.r, y: c.c.y + ((p.doc.y - c.c.y) / d) * c.r }];
          D.circle = true; D.phase = 'offset'; D.cur = p.doc; ctx.redraw();
          return;
        }
      }
      D.pts = [snapped(ctx, p)]; D.phase = 'pts'; D.cur = D.pts[0]; D.pressed = true; D.down = p.doc;
      ctx.redraw();
      return;
    }
    if (D.phase === 'pts') {
      D.pts.push(snapped(ctx, p, undefined, D.pts[D.pts.length - 1]));
      D.pressed = true; D.down = p.doc;
      if (D.pts.length >= need(defaults(e), e)) { D.phase = 'offset'; D.cur = p.doc; }
      ctx.redraw();
      return;
    }
    commit(ctx);
  },
  move: (ctx, p) => {
    const e = ctx.engine;
    if (D.edit) {
      const base = e.dragOrigin, n = base ? findNode(base, D.edit.id) : null;
      if (!base || n?.kind !== 'group' || !n.dim) return;
      if (!D.moved && Math.hypot(p.doc.x - D.down.x, p.doc.y - D.down.y) * ctx.view().zoom < 2) return;
      D.moved = true;
      const s = n.dim, ex = new Set([n.id, ...n.children.map((c) => c.id)]);
      let next: DimensionSpec;
      if (D.edit.which < 0) next = { ...s, offset: dimOffsetFor(s, p.doc) };
      else { const pts = s.pts.slice(), w = D.edit.which; pts[w] = snapped(ctx, p, ex, s.type === 'linear' ? s.pts[1 - w] : w > 0 ? s.pts[0] : undefined); next = { ...s, pts }; }
      e.dragTo(updateNodes(base, [n.id], (x) => ({ ...x, dim: next }) as VNode));
      D.cur = p.doc;
      return;
    }
    if (!D.phase) return;
    D.cur = D.phase === 'pts' ? snapped(ctx, p, undefined, D.pts[D.pts.length - 1]) : p.doc;
    ctx.redraw();
  },
  up: (ctx, p) => {
    const e = ctx.engine;
    if (D.edit) { D.edit = null; if (D.moved) e.commitDrag(); else e.cancelDrag(); ctx.redraw(); return; }
    if (!D.pressed) return;
    D.pressed = false;
    const dragged = Math.hypot(p.doc.x - D.down.x, p.doc.y - D.down.y) * ctx.view().zoom > 4;
    if (D.phase === 'pts' && dragged) {
      D.pts.push(snapped(ctx, p, undefined, D.pts[D.pts.length - 1]));
      if (D.pts.length >= need(defaults(e), e)) D.phase = 'offset';
      D.cur = p.doc;
      ctx.redraw();
    }
  },
  keydown: (ctx, ev) => {
    if (ev.key === 'Enter' && D.phase === 'offset') { commit(ctx); return true; }
    return false;
  },
  cancel: (ctx) => { if (D.edit && ctx.engine.dragging) ctx.engine.cancelDrag(); D.edit = null; reset(); ctx.redraw(); },
  deactivate: () => { reset(); },
  overlay: (ctx, g) => {
    const e = ctx.engine, v = ctx.view(), pal = ctx.paint();
    for (const n of selectedDims(e)) for (const h of dimHandles(n.dim as DimensionSpec)) {
      const s = v.toScreen(h.at);
      if (h.which < 0) { g.save(); g.fillStyle = '#fff'; g.strokeStyle = pal.accent; g.beginPath(); g.arc(s.x, s.y, 3.5, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); }
      else anchorDot(g, s, pal.accent, true);
    }
    if (!D.phase) return;
    for (const q of D.pts) anchorDot(g, v.toScreen(q), pal.accent, false);
    const s = previewSpec(e);
    if (!s) {
      if (D.pts.length) { const a = v.toScreen(D.pts[D.pts.length - 1]), b = v.toScreen(D.cur); g.save(); g.strokeStyle = pal.accent; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.restore(); }
      return;
    }
    const kids = dimensionChildren('preview', s, e.doc?.units ?? 'pt');
    inView(ctx, g, () => {
      for (const k of kids) {
        if (k.kind === 'path') { const st = k.ap.items[0]; g.strokeStyle = g.fillStyle = pal.accent; if (st?.kind === 'stroke') { g.lineWidth = Math.max(st.width, 1 / v.zoom); g.stroke(cachedPath(k.d)); } else g.fill(cachedPath(k.d)); }
        else if (k.kind === 'text') {
          const st = k.spans[0].style, lay = layoutText(k);
          g.save(); g.transform(...k.xf); g.fillStyle = pal.accent; g.font = `${st.size}px ${JSON.stringify(st.font)}, Inter, sans-serif`; g.textAlign = 'left';
          for (const gl of lay.glyphs) g.fillText(gl.ch, gl.x, gl.y);
          g.restore();
        }
      }
    });
    hud(ctx, g, v.toScreen(D.cur), [dimLabel(s, e.doc?.units ?? 'pt')]);
  },
});
