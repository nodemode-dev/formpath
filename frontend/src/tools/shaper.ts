import { findNode, updateNodes } from '../engine/doc';
import { translate } from '../engine/geometry';
import { inArea, overlapAt } from '../engine/intertwine';
import { geometryOf } from '../engine/ops/paths';
import { firstFill, toRgb } from '../engine/paint';
import { cachedPath } from '../engine/render';
import { isScribble, shaperRegionAt, type ShaperOp } from '../engine/shaper';
import { transformNode } from '../engine/transform';
import type { Engine, GroupNode, PathData, Pt } from '../engine';
import { registerTool, type ToolContext, type ToolPointer } from '../extensions/registry';
import { CURSORS } from '../ui/cursors';
import { inView, layerColor, stroke2 } from './util';

const SH = { on: false, pts: [] as Pt[], start: { x: 0, y: 0 } as Pt, move: null as { id: string; from: Pt } | null, hover: null as PathData | null, last: '', mode: 'faces' as 'faces' | 'construction', op: 'merge' as ShaperOp, alt: false, shift: false };
const opFor = (alt: boolean, shift: boolean): ShaperOp => (alt ? 'punch' : shift ? 'delete' : SH.op);

const shaperGroups = (e: Engine): GroupNode[] => e.selected().filter((n): n is GroupNode => n.kind === 'group' && !!n.shaper);
function hostOf(e: Engine, id: string): GroupNode | null {
  const doc = e.doc;
  if (!doc) return null;
  const n = findNode(doc, id);
  if (n?.kind === 'group' && n.shaper) return n;
  for (const g of allShaper(e)) if (g.children.some((c) => c.id === id)) return g;
  return null;
}
function allShaper(e: Engine): GroupNode[] {
  const doc = e.doc, out: GroupNode[] = [];
  if (!doc) return out;
  const visit = (list: readonly import('../engine').VNode[]): void => { for (const n of list) { if (n.kind === 'group' && n.shaper) out.push(n); else if (n.kind === 'group' || n.kind === 'layer') visit(n.children); } };
  visit(doc.layers);
  return out;
}
function shaperAt(e: Engine, at: Pt): GroupNode | null {
  for (const g of [...shaperGroups(e), ...allShaper(e).reverse()]) if (!g.hidden && shaperRegionAt(g, at)) return g;
  return null;
}
function sourceAt(g: GroupNode, at: Pt): string | null {
  for (let i = g.children.length - 1; i >= 0; i--) {
    const c = g.children[i], geo = c.hidden ? null : geometryOf(c);
    if (geo && inArea(geo.d.map((sp) => ({ ...sp, closed: true })), at)) return c.id;
  }
  return null;
}
const faceSel = (e: Engine): GroupNode | null => { const s = e.shaperSelection, n = s && e.doc ? findNode(e.doc, s.group) : null; return n?.kind === 'group' && n.shaper ? n : null; };
const label = (k: string): string => `${k[0].toUpperCase()}${k.slice(1)}`;

registerTool({
  id: 'shaper', label: 'Shaper Tool', group: 'pencil', order: 41, shortcut: 'Shift+N',
  icon: () => 'vShaper',
  hint: () => (SH.mode === 'faces' ? 'Draw a rough rectangle, circle, ellipse, triangle, polygon or line to get a live shape. Scribble over shapes to do the Operation chosen in the options bar (Merge, Punch or Delete); hold Alt to Punch or Shift to Delete. Click a face of a Shaper Group to select it and change its fill.' : 'Construction: click a shape inside the Shaper Group to select it, drag to move it; the faces recompute.'),
  cursor: () => CURSORS.shaper,
  activate: () => { SH.hover = null; },
  deactivate: (ctx) => { ctx.engine.shaperSelection = null; SH.hover = null; SH.on = false; ctx.redraw(); },
  options: (e) => [
    { kind: 'title', text: 'Shaper' },
    { kind: 'segment', label: 'Click selects', choices: [{ id: 'faces', label: 'Faces' }, { id: 'construction', label: 'Shapes' }], get: () => SH.mode, set: (v) => { SH.mode = v === 'construction' ? 'construction' : 'faces'; e.shaperSelection = null; e.emit('options', null); e.emit('overlay', null); } },
    { kind: 'segment', label: 'Operation', choices: [{ id: 'merge', label: 'Merge' }, { id: 'punch', label: 'Punch' }, { id: 'delete', label: 'Delete' }], get: () => SH.op, set: (v) => { SH.op = v === 'punch' ? 'punch' : v === 'delete' ? 'delete' : 'merge'; e.emit('options', null); } },
    { kind: 'readout', label: 'Last', get: () => SH.last || 'None' },
    { kind: 'color', label: 'Face fill', when: () => !!faceSel(e), get: () => { const g = faceSel(e), s = e.shaperSelection, r = g && s ? shaperRegionAt(g, s.at) : null, f = r ? firstFill(r.node.ap) : null; return f && f.paint.type === 'color' ? toRgb(f.paint.color) : { r: 255, g: 255, b: 255 }; }, set: (c) => { const g = faceSel(e), s = e.shaperSelection; if (g && s) e.shaperFill(g.id, s.at, { type: 'color', color: { kind: 'rgb', r: c.r, g: c.g, b: c.b } }); } },
    { kind: 'button', label: 'Expand', when: () => shaperGroups(e).length > 0, run: () => { e.shaperSelection = null; e.expandShaper(); } },
  ],
  hover: (ctx, p) => {
    SH.hover = null;
    if (p && !SH.on) {
      const g = shaperAt(ctx.engine, p.doc);
      if (g) {
        if (SH.mode === 'faces') SH.hover = shaperRegionAt(g, p.doc)?.node.d ?? null;
        else { const id = sourceAt(g, p.doc), c = id ? g.children.find((x) => x.id === id) : null; SH.hover = c ? geometryOf(c)?.d ?? null : null; }
      }
    }
    ctx.redraw();
  },
  down: (ctx, p) => {
    const e = ctx.engine;
    SH.on = true; SH.pts = [p.doc]; SH.start = p.doc; SH.move = null; SH.alt = p.alt; SH.shift = p.shift;
    if (SH.mode === 'construction') {
      const g = shaperAt(e, p.doc), id = g ? sourceAt(g, p.doc) : null;
      if (g && id && e.current?.selection.has(id)) { SH.move = { id, from: p.doc }; e.beginDrag('Move Shape'); }
    }
  },
  move: (ctx, p) => {
    if (!SH.on) return;
    const e = ctx.engine;
    if (SH.move) {
      const base = e.dragOrigin, m = SH.move;
      if (base) e.dragTo(updateNodes(base, [m.id], (n) => transformNode(n, translate(p.doc.x - m.from.x, p.doc.y - m.from.y))));
      return;
    }
    const last = SH.pts[SH.pts.length - 1];
    if (Math.hypot(p.doc.x - last.x, p.doc.y - last.y) * ctx.view().zoom >= 1.5) { SH.pts.push(p.doc); ctx.redraw(); }
  },
  up: (ctx, p) => {
    if (!SH.on) return;
    SH.on = false; SH.hover = null;
    const e = ctx.engine, z = ctx.view().zoom;
    if (SH.move) { e.commitDrag([SH.move.id]); SH.move = null; ctx.redraw(); return; }
    const pts = SH.pts.concat(Math.hypot(p.doc.x - SH.pts[SH.pts.length - 1].x, p.doc.y - SH.pts[SH.pts.length - 1].y) > 0 ? [p.doc] : []);
    const span = pts.reduce((s, q, i) => (i ? s + Math.hypot(q.x - pts[i - 1].x, q.y - pts[i - 1].y) : 0), 0) * z;
    if (span < 5) { click(ctx, p); return; }
    e.shaperSelection = null;
    if (isScribble(pts)) {
      const op = opFor(p.alt || SH.alt, p.shift || SH.shift), r = e.shaperScribble(pts, op);
      const none = op === 'merge' ? 'Nothing merged: scribble across two or more regions' : op === 'punch' ? 'Nothing punched: scribble over a region where two or more shapes overlap' : 'Nothing deleted: scribble over the shape to delete';
      SH.last = !r ? 'Scribble missed every shape' : r.action === 'none' ? none : r.action === 'cut' ? 'Punched out a region' : r.action === 'merge' ? 'Merged regions' : 'Deleted a shape';
    } else {
      const r = e.addShaperShape(pts);
      SH.last = r ? label(r.kind) : 'Not recognised';
      if (!r) e.notice('Shaper: draw a closed rectangle, circle, ellipse, triangle or polygon, or a straight line.');
    }
    e.emit('options', null);
    ctx.redraw();
  },
  keydown: (ctx, ev) => {
    if (ev.key === 'Escape') { if (SH.move) { ctx.engine.cancelDrag(); SH.move = null; } SH.on = false; ctx.engine.shaperSelection = null; ctx.redraw(); return true; }
    return false;
  },
  cancel: (ctx) => { if (SH.move) ctx.engine.cancelDrag(); SH.on = false; SH.move = null; ctx.redraw(); },
  overlay: (ctx, g) => {
    const e = ctx.engine, accent = ctx.paint().accent;
    if (SH.on && !SH.move) { const v = ctx.view(); stroke2(g, SH.pts.map((q) => v.toScreen(q)), layerColor(e)); }
    inView(ctx, g, () => {
      const zz = ctx.view().zoom;
      if (SH.hover) { g.strokeStyle = accent; g.lineWidth = 2 / zz; g.stroke(cachedPath(SH.hover)); }
      const fg = faceSel(e), s = e.shaperSelection;
      if (fg && s) { const r = shaperRegionAt(fg, s.at); if (r) { g.fillStyle = 'rgba(80, 140, 255, 0.25)'; g.fill(cachedPath(r.node.d)); g.setLineDash([4 / zz, 3 / zz]); g.lineWidth = 1.5 / zz; g.strokeStyle = accent; g.stroke(cachedPath(r.node.d)); g.setLineDash([]); } }
      if (SH.mode === 'construction') {
        const sel = new Set(e.selectedIds());
        for (const grp of allShaper(e)) {
          if (!sel.has(grp.id) && !grp.children.some((c) => sel.has(c.id))) continue;
          g.setLineDash([3 / zz, 3 / zz]); g.lineWidth = 1 / zz; g.strokeStyle = accent;
          for (const c of grp.children) { const geo = c.hidden ? null : geometryOf(c); if (geo) g.stroke(cachedPath(geo.d)); }
          g.setLineDash([]);
        }
      }
    });
  },
});

function click(ctx: ToolContext, p: ToolPointer): void {
  const e = ctx.engine, g = shaperAt(e, p.doc);
  if (!g) {
    e.shaperSelection = null;
    const h = e.hit(p.doc);
    if (h) e.select([e.selectableFor(h.id)]); else e.select([]);
    e.emit('options', null); ctx.redraw();
    return;
  }
  if (SH.mode === 'faces') { e.select([g.id]); e.shaperSelection = { group: g.id, at: p.doc }; }
  else { const id = sourceAt(g, p.doc); e.shaperSelection = null; e.select([id ?? g.id]); }
  e.emit('options', null);
  ctx.redraw();
}

const IT = { on: false, pts: [] as Pt[], hover: null as PathData | null, target: null as string | null };
function intertwineFor(e: Engine, at: Pt | null): GroupNode | null {
  const doc = e.doc;
  if (!doc) return null;
  const sel = e.selected().find((n): n is GroupNode => n.kind === 'group' && !!n.intertwine);
  if (sel) return sel;
  if (!at) return null;
  const h = e.hit(at);
  for (const id of [...(h?.chain ?? [])].reverse()) { const n = findNode(doc, id); if (n?.kind === 'group' && n.intertwine) return n; }
  return null;
}

registerTool({
  id: 'intertwine', label: 'Interlace Tool', group: 'shapeBuilder', order: 74.8, shortcut: 'Shift+J',
  icon: () => 'vIntertwine',
  hint: () => 'Click a highlighted overlap to bring the object below to the front there; with three or more objects each click moves the next one down to the top. Drag (or Alt-drag) around an area to define it freely. Escape or Enter leaves.',
  cursor: () => CURSORS.intertwine,
  activate: (ctx) => { IT.hover = null; IT.target = intertwineFor(ctx.engine, null)?.id ?? null; },
  deactivate: (ctx) => { IT.hover = null; IT.on = false; ctx.redraw(); },
  options: (e) => [
    { kind: 'title', text: 'Interlace' },
    { kind: 'readout', label: 'Objects', get: () => { const g = intertwineFor(e, null); return g ? String(g.children.length) : 'None selected'; } },
    { kind: 'readout', label: 'Areas', get: () => { const g = intertwineFor(e, null); return g ? String(g.intertwine?.zones.length ?? 0) : '0'; } },
    { kind: 'button', label: 'Make', when: () => !intertwineFor(e, null) && e.selected().length > 1, run: () => { e.makeIntertwine(); } },
    { kind: 'button', label: 'Release', when: () => !!intertwineFor(e, null), run: () => { e.releaseIntertwine(); e.setTool('selection'); } },
    { kind: 'button', label: 'Done', run: () => e.setTool('selection') },
  ],
  hover: (ctx, p) => {
    IT.hover = null;
    const e = ctx.engine, doc = e.doc;
    if (p && doc && !IT.on) { const g = intertwineFor(e, p.doc); if (g) IT.hover = overlapAt(doc, g, p.doc)?.region ?? null; }
    ctx.redraw();
  },
  down: (_ctx, p) => { IT.on = true; IT.pts = [p.doc]; },
  move: (ctx, p) => {
    if (!IT.on) return;
    const last = IT.pts[IT.pts.length - 1];
    if (Math.hypot(p.doc.x - last.x, p.doc.y - last.y) * ctx.view().zoom >= 2) { IT.pts.push(p.doc); IT.hover = null; ctx.redraw(); }
  },
  up: (ctx, p) => {
    if (!IT.on) return;
    IT.on = false;
    const e = ctx.engine, pts = IT.pts, z = ctx.view().zoom;
    const span = pts.reduce((s, q, i) => (i ? s + Math.hypot(q.x - pts[i - 1].x, q.y - pts[i - 1].y) : 0), 0) * z;
    const g = intertwineFor(e, span < 5 ? p.doc : pts[0]) ?? intertwineFor(e, p.doc);
    if (!g) {
      const h = e.hit(p.doc);
      if (h) e.select([e.selectableFor(h.id)]); else e.select([]);
      ctx.redraw();
      return;
    }
    if (!e.current?.selection.has(g.id)) e.select([g.id]);
    if (span < 5) { if (!e.intertwineFlip(g.id, p.doc)) e.notice('Click where two or more of the intertwined objects overlap.'); }
    else if (!e.intertwineZone(g.id, pts)) e.notice('Encircle part of an overlap between the intertwined objects.');
    IT.hover = null;
    e.emit('options', null);
    ctx.redraw();
  },
  keydown: (ctx, ev) => {
    if (ev.key === 'Escape' || ev.key === 'Enter') { ctx.engine.setTool('selection'); return true; }
    return false;
  },
  cancel: (ctx) => { IT.on = false; ctx.redraw(); },
  overlay: (ctx, g) => {
    const e = ctx.engine, accent = ctx.paint().accent, grp = intertwineFor(e, null);
    inView(ctx, g, () => {
      const zz = ctx.view().zoom;
      if (grp) {
        g.setLineDash([4 / zz, 3 / zz]); g.lineWidth = 1 / zz; g.strokeStyle = accent;
        for (const z of grp.intertwine?.zones ?? []) g.stroke(cachedPath(z.d));
        g.setLineDash([]);
      }
      if (IT.hover) { g.fillStyle = 'rgba(255, 196, 0, 0.28)'; g.fill(cachedPath(IT.hover)); g.lineWidth = 2 / zz; g.strokeStyle = '#ffb000'; g.stroke(cachedPath(IT.hover)); }
    });
    if (IT.on && IT.pts.length > 1) { const v = ctx.view(); stroke2(g, IT.pts.map((q) => v.toScreen(q)), accent, true); }
  },
});
