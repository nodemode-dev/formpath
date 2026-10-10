import { geomBounds } from '../engine/bounds';
import { findNode, topObjects, updateNodes } from '../engine/doc';
import { emptyRect, isEmptyRect, normRect, scaleAbout, unionRect } from '../engine/geometry';
import { duplicateNodes } from '../engine/ops/objects';
import { attachPlace, dragGrid, fromPlane, gridHandles, gridOf, HANDLE_LABELS, leafPlaneBounds, localScale, perspLeaves, placeMatrix, planeAt, PLANE_LABELS, reprojectDoc, type GridHandleId } from '../engine/perspective';
import type { Doc, Engine, PerspGrid, PerspPlane, Pt, Rect, VNode } from '../engine';
import { registerTool, toolHost, type OptionSpec, type ToolContext, type ToolPointer } from '../extensions/registry';
import { CURSORS, cursorFor } from '../ui/cursors';
import { fmt, hud, marquee } from './util';

const HANDLE_PX = 7;
const planeChoices = [{ id: 'left', label: 'Left' }, { id: 'floor', label: 'Horizontal' }, { id: 'right', label: 'Right' }, { id: 'none', label: 'None' }] as const;

const viewOptions = (e: Engine): OptionSpec[] => [
  { kind: 'segment', label: 'Plane', choices: planeChoices, get: () => e.perspView.plane, set: (v) => e.setPerspView({ plane: v as PerspPlane | 'none', show: true }) },
  { kind: 'toggle', label: 'Show Grid', get: () => e.perspView.show, set: (v) => e.setPerspView({ show: v }) },
  { kind: 'toggle', label: 'Snap to Grid', get: () => e.perspView.snap, set: (v) => e.setPerspView({ snap: v }) },
];

interface GridDrag { id: GridHandleId; g0: PerspGrid; moved: boolean; at: Pt }
let GD: GridDrag | null = null;
let hoverHandle: GridHandleId | null = null;

function handleAt(ctx: ToolContext, p: Pt): GridHandleId | null {
  const e = ctx.engine, d = e.doc;
  if (!d) return null;
  const v = ctx.view(), s = v.toScreen(p);
  let best: GridHandleId | null = null, bd = HANDLE_PX + 1;
  for (const h of gridHandles(gridOf(d))) { const q = v.toScreen(h.at), dd = Math.hypot(q.x - s.x, q.y - s.y); if (dd < bd) { bd = dd; best = h.id; } }
  return best;
}

registerTool({
  id: 'perspectiveGrid', label: 'Perspective Grid Tool', group: 'perspective', order: 74.9, shortcut: 'Shift+P',
  icon: () => 'vPerspective',
  hint: (e) => (e.perspView.lock ? 'The perspective grid is locked. Unlock it from View > Perspective Grid to move its widgets.' : 'Drag the vanishing points, horizon, ground level, grid extents, cell size and plane controls to define the grid. Keys 1 to 4 pick the active plane.'),
  cursor: (ctx, p) => (p && !ctx.engine.perspView.lock && handleAt(ctx, p.doc) ? 'move' : CURSORS.perspGrid),
  options: (e) => [
    { kind: 'title', text: 'Perspective Grid' },
    { kind: 'segment', label: 'Type', choices: [{ id: '1', label: '1 Point' }, { id: '2', label: '2 Point' }, { id: '3', label: '3 Point' }], get: () => String(e.perspGrid()?.type ?? 2), set: (v) => { const g = e.perspGrid(); if (g && String(g.type) !== v) e.setPerspGrid({ ...g, type: Number(v) as 1 | 2 | 3, vp3: g.vp3 || Math.max(4 * g.distance, Math.abs(g.height) * 4) }, 'Perspective Grid Type'); } },
    ...viewOptions(e),
    { kind: 'toggle', label: 'Lock', get: () => e.perspView.lock, set: (v) => e.setPerspView({ lock: v }) },
    { kind: 'button', label: 'Define Grid', run: () => toolHost.run('persp-define') },
  ],
  activate: (ctx) => { ctx.engine.setPerspView({ show: true }); },
  hover: (ctx, p) => { const h = p ? handleAt(ctx, p.doc) : null; if (h !== hoverHandle) { hoverHandle = h; ctx.redraw(); } },
  down: (ctx, p) => {
    const e = ctx.engine, d = e.doc;
    if (!d || e.perspView.lock) return;
    const id = handleAt(ctx, p.doc);
    if (!id) return;
    GD = { id, g0: gridOf(d), moved: false, at: p.doc };
    e.beginDrag(`Perspective Grid ${HANDLE_LABELS[id]}`);
  },
  move: (ctx, p) => {
    const e = ctx.engine, base = e.dragOrigin;
    if (!GD || !base) return;
    GD.moved = true; GD.at = p.doc;
    e.dragTo(reprojectDoc(base, dragGrid(GD.g0, GD.id, p.doc)));
    ctx.redraw();
  },
  up: (ctx) => {
    const e = ctx.engine;
    if (!GD) return;
    if (GD.moved) e.commitDrag(); else e.cancelDrag();
    GD = null;
    ctx.redraw();
  },
  cancel: (ctx) => { if (GD && ctx.engine.dragging) ctx.engine.cancelDrag(); GD = null; ctx.redraw(); },
  overlay: (ctx, g) => {
    const e = ctx.engine, d = e.doc;
    if (!d || !e.perspView.show) return;
    const v = ctx.view(), pal = ctx.paint(), grid = gridOf(d), lock = e.perspView.lock;
    g.save();
    for (const h of gridHandles(grid)) {
      const s = v.toScreen(h.at), on = h.id === (GD?.id ?? hoverHandle), r = on ? 6 : 4.5;
      g.fillStyle = lock ? pal.antsB : on ? pal.accent : pal.handle; g.strokeStyle = lock ? pal.antsA : on ? pal.antsB : pal.accent; g.lineWidth = 1.2;
      g.beginPath();
      if (h.id.startsWith('vp')) g.arc(s.x, s.y, r + 1, 0, Math.PI * 2);
      else if (h.id.startsWith('off')) { g.moveTo(s.x, s.y - r - 1); g.lineTo(s.x + r + 1, s.y); g.lineTo(s.x, s.y + r + 1); g.lineTo(s.x - r - 1, s.y); g.closePath(); }
      else g.rect(s.x - r, s.y - r, 2 * r, 2 * r);
      g.fill(); g.stroke();
    }
    g.restore();
    if (GD?.moved) {
      const gr = gridOf(d), u = (n: number): string => `${fmt(n)} pt`;
      const info: Record<GridHandleId, string[]> = {
        vpl: [`Angle: ${fmt(gr.angle)}°`, `Distance: ${u(gr.distance)}`], vpr: [`Angle: ${fmt(gr.angle)}°`, `Distance: ${u(gr.distance)}`], vp1: [`Horizon: ${u(gr.height)}`],
        vp3: [`Third point: ${u(gr.vp3)}`], horizonL: [`Horizon: ${u(gr.height)}`], horizonR: [`Horizon: ${u(gr.height)}`], ground: [`X: ${fmt(gr.ground.x)}`, `Y: ${fmt(gr.ground.y)}`],
        extL: [`Left extent: ${u(gr.ext.left)}`], extR: [`Right extent: ${u(gr.ext.right)}`], extH: [`Height: ${u(gr.ext.height)}`], cell: [`Cell: ${u(gr.cell)}`],
        offL: [`Left plane: ${u(gr.off.left)}`], offR: [`Right plane: ${u(gr.off.right)}`], offF: [`Horizontal plane: ${u(gr.off.floor)}`],
      };
      hud(ctx, g, v.toScreen(GD.at), [HANDLE_LABELS[GD.id], ...info[GD.id]]);
    }
  },
});

type Mode = 'move' | 'place' | 'scale' | 'marquee';
interface SelDrag { mode: Mode; start: ToolPointer; cur: Pt; ids: string[]; plane: PerspPlane; off: number; copy: boolean; perp: boolean; moved: boolean; handle: number; box: Rect | null; select: string[]; info: string[]; shift: boolean }
let SD: SelDrag | null = null;

function leafOfHit(doc: Doc, chain: string[], id: string): VNode | null {
  for (const x of [...chain, id]) { const n = findNode(doc, x); if (n?.persp) return n; }
  const n = findNode(doc, id);
  return n ? perspLeaves(n)[0] ?? null : null;
}

function planeBox(e: Engine): { plane: PerspPlane; off: number; r: Rect; ids: string[] } | null {
  const p = e.current;
  if (!p) return null;
  const ids = topObjects(p.doc, p.selection), leaves = ids.flatMap((id) => { const n = findNode(p.doc, id); return n ? perspLeaves(n) : []; });
  const first = leaves[0]?.persp;
  if (!first) return null;
  let r = emptyRect();
  for (const l of leaves) if (l.persp?.plane === first.plane) r = unionRect(r, leafPlaneBounds(p.doc, l));
  return isEmptyRect(r) ? null : { plane: first.plane, off: first.off, r, ids };
}

const boxPoints = (r: Rect): Pt[] => [
  { x: r.x, y: r.y }, { x: r.x + r.w / 2, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h / 2 },
  { x: r.x + r.w, y: r.y + r.h }, { x: r.x + r.w / 2, y: r.y + r.h }, { x: r.x, y: r.y + r.h }, { x: r.x, y: r.y + r.h / 2 },
];

function boxHandleAt(ctx: ToolContext, p: Pt): { i: number; b: NonNullable<ReturnType<typeof planeBox>> } | null {
  const e = ctx.engine, d = e.doc, b = planeBox(e);
  if (!d || !b) return null;
  const g = gridOf(d), v = ctx.view(), s = v.toScreen(p);
  const pts = boxPoints(b.r).map((q) => v.toScreen(fromPlane(g, b.plane, b.off, q)));
  const i = pts.findIndex((q) => Math.hypot(q.x - s.x, q.y - s.y) <= HANDLE_PX);
  return i >= 0 ? { i, b } : null;
}

function selectionCenter(doc: Doc, ids: string[]): Pt | null {
  let b = emptyRect();
  for (const id of ids) { const n = findNode(doc, id); if (n) b = unionRect(b, geomBounds(doc, n)); }
  return isEmptyRect(b) ? null : { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

function dragDoc(e: Engine, s: SelDrag, base: Doc, p: ToolPointer): Doc | null {
  const g = gridOf(base);
  if (s.mode === 'move') {
    let ids = s.ids, d = base;
    if (s.copy) { const r = duplicateNodes(base, s.ids); d = r.doc; ids = r.ids; }
    s.select = ids;
    if (s.perp) {
      const a = planeAt(g, s.plane, s.off, s.start.doc), k = a ? localScale(g, s.plane, s.off, a) : 1;
      const dn = -(p.doc.y - s.start.doc.y) / k;
      s.info = [`Perpendicular: ${fmt(dn)} pt`];
      return e.perspMoveDoc(d, ids, s.plane, { x: 0, y: 0, n: dn });
    }
    const a = planeAt(g, s.plane, s.off, s.start.doc), b = planeAt(g, s.plane, s.off, p.doc);
    if (!a || !b) return null;
    let dx = b.x - a.x, dy = b.y - a.y;
    if (p.shift) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    s.info = [`${PLANE_LABELS[s.plane]} plane`, `X: ${fmt(dx)} pt`, `Y: ${fmt(dy)} pt`];
    return e.perspMoveDoc(d, ids, s.plane, { x: dx, y: dy, n: 0 });
  }
  if (s.mode === 'place') {
    let ids = s.ids, d = base;
    if (s.copy) { const r = duplicateNodes(base, s.ids); d = r.doc; ids = r.ids; }
    const c = selectionCenter(d, ids);
    if (!c) return null;
    const at = planeAt(g, s.plane, s.off, { x: c.x + p.doc.x - s.start.doc.x, y: c.y + p.doc.y - s.start.doc.y });
    if (!at) return null;
    const nodes = ids.map((id) => findNode(d, id)).filter((n): n is VNode => !!n), m = placeMatrix(d, nodes, at);
    const out = new Map<string, VNode>();
    for (const n of nodes) out.set(n.id, attachPlace(d, n, g, { plane: s.plane, off: s.off }, m));
    s.select = nodes.map((n) => out.get(n.id)?.id ?? n.id);
    s.info = [`Into ${PLANE_LABELS[s.plane].toLowerCase()} plane`];
    return updateNodes({ ...d, persp: g }, out.keys(), (n) => out.get(n.id) ?? n);
  }
  if (s.mode === 'scale' && s.box) {
    const q = planeAt(g, s.plane, s.off, p.doc);
    if (!q) return null;
    const r = s.box, P = boxPoints(r), h = P[s.handle], o = P[(s.handle + 4) % 8];
    let sx = Math.abs(h.x - o.x) > 1e-9 ? (q.x - o.x) / (h.x - o.x) : 1, sy = Math.abs(h.y - o.y) > 1e-9 ? (q.y - o.y) / (h.y - o.y) : 1;
    if (s.handle === 1 || s.handle === 5) sx = p.shift ? sy : 1;
    if (s.handle === 3 || s.handle === 7) sy = p.shift ? sx : 1;
    if (p.shift && s.handle % 2 === 0) { const k = Math.max(Math.abs(sx), Math.abs(sy)); sx = Math.sign(sx || 1) * k; sy = Math.sign(sy || 1) * k; }
    const c = p.alt ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : o;
    if (p.alt) { sx = sx * 2 - 1; sy = sy * 2 - 1; }
    s.select = s.ids;
    s.info = [`W: ${fmt(Math.abs(r.w * sx))} pt`, `H: ${fmt(Math.abs(r.h * sy))} pt`];
    return e.perspScaleDoc(base, s.ids, s.plane, scaleAbout(sx, sy, c.x, c.y));
  }
  return null;
}

registerTool({
  id: 'perspectiveSelect', label: 'Perspective Selection Tool', group: 'perspective', order: 74.95, shortcut: 'Shift+V',
  icon: () => 'vPerspSelect',
  hint: () => 'Drag art onto the active plane to bring it into perspective; drag perspective art to move it along its plane, Alt-drag to copy, press 5 while dragging to move it perpendicular to its plane. Drag the box handles to scale in plane space.',
  cursor: (ctx, p) => {
    if (!p) return CURSORS.perspSelect;
    const h = boxHandleAt(ctx, p.doc);
    if (h) return cursorFor(h.i);
    return p.alt ? CURSORS.perspCopy : CURSORS.perspSelect;
  },
  options: (e) => [
    { kind: 'title', text: 'Perspective Selection' },
    ...viewOptions(e),
    { kind: 'button', label: 'Attach', run: () => toolHost.run('persp-attach') },
    { kind: 'button', label: 'Release', run: () => toolHost.run('persp-release') },
    { kind: 'button', label: 'Match Plane', run: () => toolHost.run('persp-match-plane') },
    { kind: 'button', label: 'Edit Text', run: () => toolHost.run('persp-edit-text'), when: () => !!e.perspTextOf() },
  ],
  activate: (ctx) => {
    const e = ctx.engine;
    e.setPerspView({ show: true });
  },
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const bh = boxHandleAt(ctx, p.doc);
    if (bh) { SD = { mode: 'scale', start: p, cur: p.doc, ids: bh.b.ids, plane: bh.b.plane, off: bh.b.off, copy: false, perp: false, moved: false, handle: bh.i, box: bh.b.r, select: bh.b.ids, info: [], shift: p.shift }; return; }
    const hit = e.hit(p.doc), box = hit ? null : planeBox(e), inBox = box ? planeAt(gridOf(pr.doc), box.plane, box.off, p.doc) : null;
    if (box && inBox && inBox.x >= box.r.x && inBox.x <= box.r.x + box.r.w && inBox.y >= box.r.y && inBox.y <= box.r.y + box.r.h) {
      SD = { mode: 'move', start: p, cur: p.doc, ids: box.ids, plane: box.plane, off: box.off, copy: p.alt, perp: false, moved: false, handle: -1, box: null, select: box.ids, info: [], shift: p.shift };
      return;
    }
    if (!hit) {
      if (!p.shift) e.select([]);
      SD = { mode: 'marquee', start: p, cur: p.doc, ids: [], plane: 'left', off: 0, copy: false, perp: false, moved: false, handle: -1, box: null, select: [], info: [], shift: p.shift };
      return;
    }
    const id = e.selectableFor(hit.id);
    if (p.shift) { e.select([id], 'toggle'); if (!e.current?.selection.has(id)) return; }
    else if (!pr.selection.has(id)) e.select([id]);
    const ids = topObjects(pr.doc, pr.selection), leaf = leafOfHit(pr.doc, hit.chain, hit.id);
    if (leaf?.persp) { SD = { mode: 'move', start: p, cur: p.doc, ids, plane: leaf.persp.plane, off: leaf.persp.off, copy: p.alt, perp: false, moved: false, handle: -1, box: null, select: ids, info: [], shift: p.shift }; return; }
    const act = e.perspActive;
    if (act) SD = { mode: 'place', start: p, cur: p.doc, ids, plane: act.plane, off: act.off, copy: p.alt, perp: false, moved: false, handle: -1, box: null, select: ids, info: [], shift: p.shift };
    ctx.redraw();
  },
  move: (ctx, p) => {
    const e = ctx.engine, s = SD;
    if (!s) return;
    s.cur = p.doc;
    if (!s.moved && Math.hypot(p.screen.x - s.start.screen.x, p.screen.y - s.start.screen.y) < 3) return;
    if (s.mode === 'marquee') { s.moved = true; ctx.redraw(); return; }
    if (!s.moved) { s.moved = true; e.beginDrag(s.mode === 'scale' ? 'Scale in Perspective' : s.mode === 'place' ? (s.copy ? 'Duplicate into Perspective' : 'Bring into Perspective') : s.copy ? 'Duplicate in Perspective' : 'Move in Perspective'); }
    const base = e.dragOrigin;
    if (!base) return;
    const next = dragDoc(e, s, base, p);
    if (next) e.dragTo(next);
    ctx.redraw();
  },
  up: (ctx, p) => {
    const e = ctx.engine, s = SD;
    SD = null;
    if (!s) return;
    if (s.mode === 'marquee') { if (s.moved) e.selectInRect(normRect(s.start.doc.x, s.start.doc.y, p.doc.x, p.doc.y), s.shift ? 'add' : 'replace', false); ctx.redraw(); return; }
    if (s.moved && e.dragging) e.commitDrag(s.select);
    ctx.redraw();
  },
  dblclick: (ctx, p) => {
    const e = ctx.engine, d = e.doc, hit = e.hit(p.doc);
    if (!d || !hit) return;
    const leaf = leafOfHit(d, hit.chain, hit.id);
    if (leaf && e.perspTextOf(leaf.id)) toolHost.run('persp-edit-text');
  },
  keydown: (ctx, ev) => {
    const s = SD;
    if (!s || s.mode !== 'move' || ev.code !== 'Digit5' || ev.repeat) return false;
    s.perp = !s.perp;
    const e = ctx.engine;
    if (e.dragOrigin && s.moved) { const next = dragDoc(e, s, e.dragOrigin, { ...s.start, doc: s.cur }); if (next) e.dragTo(next); }
    ctx.redraw();
    return true;
  },
  cancel: (ctx) => { if (SD?.moved && ctx.engine.dragging) ctx.engine.cancelDrag(); SD = null; ctx.redraw(); },
  overlay: (ctx, g) => {
    const e = ctx.engine, d = e.doc, s = SD;
    if (!d) return;
    const v = ctx.view(), pal = ctx.paint();
    if (s?.mode === 'marquee' && s.moved) { marquee(ctx, g, s.start.doc, s.cur); return; }
    const b = planeBox(e);
    if (b) {
      const grid = gridOf(d), P = boxPoints(b.r).map((q) => v.toScreen(fromPlane(grid, b.plane, b.off, q)));
      g.save(); g.strokeStyle = pal.accent; g.lineWidth = 1;
      g.beginPath(); [0, 2, 4, 6].forEach((i, k) => { if (k) g.lineTo(P[i].x, P[i].y); else g.moveTo(P[i].x, P[i].y); }); g.closePath(); g.stroke();
      g.fillStyle = pal.handle;
      for (const q of P) { g.beginPath(); g.rect(Math.round(q.x) - 3.5, Math.round(q.y) - 3.5, 7, 7); g.fill(); g.stroke(); }
      g.restore();
    }
    if (s?.moved && s.info.length) hud(ctx, g, v.toScreen(s.cur), s.info);
  },
});
