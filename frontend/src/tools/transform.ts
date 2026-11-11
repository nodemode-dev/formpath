import { findNode } from '../engine/doc';
import { apply, mul, nearestOnPath, normRect, rotateAbout, scaleAbout } from '../engine/geometry';
import { normalizeWidthPoints, profileAt, widthAxisNearest, widthFrames } from '../engine/effects';
import { transformNodes } from '../engine/ops/objects';
import { firstStroke, withFirstStroke } from '../engine/paint';
import type { Anchor, Engine, Mat, PathData, Pt, StrokeItem, VNode, WidthPoint } from '../engine';
import { registerTool, toolHost, type ToolContext, type ToolPointer } from '../extensions/registry';
import { CURSORS, cursorFor } from '../ui/cursors';
import { beginTransform, dragTransform, endTransform, handleAt, newDrag, replaceNode } from './select';
import { refine } from './liquify-detail';
import { fmt, hud, marquee } from './util';

const xf = (e: Engine) => ({ strokes: e.view.scaleStrokes, patterns: e.view.transformPatterns, gradients: true });

interface T { origin: Pt | null; forSel: string; on: boolean; start: Pt; cur: Pt; moved: boolean; copy: boolean; copyIds: string[] | null; ids: string[]; info: string[] }
const T: T = { origin: null, forSel: '', on: false, start: { x: 0, y: 0 }, cur: { x: 0, y: 0 }, moved: false, copy: false, copyIds: null, ids: [], info: [] };

function origin(e: Engine): Pt | null {
  const key = e.selectedIds().join(',');
  if (T.forSel !== key) { T.forSel = key; T.origin = null; }
  if (T.origin) return T.origin;
  const b = e.selectionBounds(false);
  return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null;
}

export function toolOrigin(e: Engine): Pt | null { return origin(e); }

function reflectAcross(o: Pt, deg: number): Mat {
  const r = rotateAbout(deg, o.x, o.y), back = rotateAbout(-deg, o.x, o.y);
  return mul(r, mul([1, 0, 0, -1, 0, 2 * o.y], back));
}

type Kind = 'rotate' | 'reflect' | 'scale' | 'shear';
function matrixFor(kind: Kind, o: Pt, s: Pt, p: Pt, shift: boolean): { m: Mat; info: string } {
  const a0 = Math.atan2(s.y - o.y, s.x - o.x), a1 = Math.atan2(p.y - o.y, p.x - o.x);
  if (kind === 'rotate') { let deg = ((a1 - a0) * 180) / Math.PI; if (shift) deg = Math.round(deg / 45) * 45; return { m: rotateAbout(deg, o.x, o.y), info: `${fmt(-deg)}°` }; }
  if (kind === 'reflect') { let deg = (a1 * 180) / Math.PI; if (shift) deg = Math.round(deg / 45) * 45; return { m: reflectAcross(o, deg), info: `Axis ${fmt(-deg)}°` }; }
  if (kind === 'scale') {
    let sx = Math.abs(s.x - o.x) > 1e-9 ? (p.x - o.x) / (s.x - o.x) : 1, sy = Math.abs(s.y - o.y) > 1e-9 ? (p.y - o.y) / (s.y - o.y) : 1;
    if (shift) { const k = Math.max(Math.abs(sx), Math.abs(sy)); sx = Math.sign(sx || 1) * k; sy = Math.sign(sy || 1) * k; }
    return { m: scaleAbout(sx || 1e-3, sy || 1e-3, o.x, o.y), info: `${fmt(sx * 100)}% × ${fmt(sy * 100)}%` };
  }
  const dx = p.x - s.x, dy = p.y - s.y, horiz = shift || Math.abs(dx) >= Math.abs(dy);
  const h = Math.max(1e-6, Math.abs(s.y - o.y)), w = Math.max(1e-6, Math.abs(s.x - o.x));
  const k = horiz ? dx / h * Math.sign(s.y - o.y || 1) : dy / w * Math.sign(s.x - o.x || 1);
  const m: Mat = horiz ? [1, 0, k, 1, -k * o.y, 0] : [1, k, 0, 1, 0, -k * o.x];
  return { m, info: `${fmt((Math.atan(k) * 180) / Math.PI)}° ${horiz ? 'horizontal' : 'vertical'}` };
}

function xformTool(id: string, label: string, iconName: string, group: string, order: number, shortcut: string | undefined, kind: Kind, dialog: string): void {
  registerTool({
    id, label, group, order, shortcut,
    icon: () => iconName,
    hint: () => `Click to set the reference point, then drag to ${kind}. Alt-drag copies; Shift constrains. Double-click the tool or press Enter for exact values.`,
    cursor: () => (kind === 'rotate' ? CURSORS.rotate : CURSORS.cross),
    keydown: (_ctx, e) => { if (e.key !== 'Enter') return false; toolHost.run(dialog); return true; },
    down: (ctx, p) => {
      const e = ctx.engine, o = origin(e);
      if (!e.hasSelection || !o) return;
      if (Math.hypot(p.doc.x - o.x, p.doc.y - o.y) * ctx.view().zoom < 5) { T.origin = ctx.snap(p.doc).p; ctx.redraw(); return; }
      T.on = true; T.start = p.doc; T.cur = p.doc; T.moved = false; T.ids = e.targetIds(); T.copyIds = null;
      e.beginDrag(label.replace(/ Tool$/, ''));
    },
    move: (ctx, p) => {
      const e = ctx.engine, base = e.dragOrigin, o = origin(e);
      if (!T.on || !base || !o) return;
      T.cur = p.doc;
      if (!T.moved && Math.hypot(p.doc.x - T.start.x, p.doc.y - T.start.y) * ctx.view().zoom < 3) return;
      T.moved = true;
      const r = matrixFor(kind, o, T.start, p.doc, p.shift);
      const res = transformNodes(base, T.ids, r.m, p.alt, xf(e));
      T.copyIds = p.alt ? res.ids : null;
      T.info = [r.info];
      e.dragTo(res.doc);
      e.lastTransform = { m: r.m, copy: p.alt };
      e.noteDragTransform(r.m, p.alt);
    },
    up: (ctx, p) => {
      const e = ctx.engine;
      if (!T.on) return;
      T.on = false;
      if (T.moved) e.commitDrag(T.copyIds ?? undefined);
      else { e.cancelDrag(); T.origin = ctx.snap(p.doc).p; if (p.alt) toolHost.run(dialog); }
      T.info = [];
      ctx.redraw();
    },
    dblclick: () => toolHost.run(dialog),
    overlay: (ctx, g) => {
      const e = ctx.engine, o = origin(e);
      if (!o || !e.hasSelection) return;
      const s = ctx.view().toScreen(o), c = ctx.paint().accent;
      g.save(); g.strokeStyle = c; g.lineWidth = 1.5;
      g.beginPath(); g.arc(s.x, s.y, 4, 0, Math.PI * 2); g.moveTo(s.x - 9, s.y); g.lineTo(s.x + 9, s.y); g.moveTo(s.x, s.y - 9); g.lineTo(s.x, s.y + 9); g.stroke(); g.restore();
      if (T.on && T.moved) hud(ctx, g, ctx.view().toScreen(T.cur), T.info);
    },
    cancel: (ctx) => { if (ctx.engine.dragging) ctx.engine.cancelDrag(); T.on = false; T.moved = false; T.info = []; ctx.redraw(); },
  });
}

xformTool('rotate', 'Rotate Tool', 'vRotate', 'rotate', 50, 'R', 'rotate', 'rotate-dialog');
xformTool('reflect', 'Reflect Tool', 'vReflect', 'rotate', 51, 'O', 'reflect', 'reflect-dialog');
xformTool('scale', 'Scale Tool', 'vScale', 'scale', 52, 'S', 'scale', 'scale-dialog');
xformTool('shear', 'Shear Tool', 'vShear', 'scale', 53, undefined, 'shear', 'shear-dialog');

function mapAnchorsNode(n: VNode, f: (p: Pt) => Pt): VNode {
  const ma = (a: Anchor): Anchor => { const c = f(a), i = f({ x: a.ix, y: a.iy }), o = f({ x: a.ox, y: a.oy }); return { ...a, x: c.x, y: c.y, ix: i.x, iy: i.y, ox: o.x, oy: o.y }; };
  const md = (d: PathData): PathData => d.map((sp) => ({ ...sp, pts: sp.pts.map(ma) }));
  if (n.kind === 'path') return { ...n, d: md(n.d), live: undefined };
  if (n.kind === 'compound') return { ...n, children: n.children.map((c) => ({ ...c, d: md(c.d) })) };
  if (n.kind === 'group') return { ...n, children: n.children.map((c) => mapAnchorsNode(c, f)) };
  if (n.kind === 'text' || n.kind === 'image' || n.kind === 'symbol') {
    const o = f({ x: n.xf[4], y: n.xf[5] }), ax = f({ x: n.xf[4] + n.xf[0], y: n.xf[5] + n.xf[1] }), ay = f({ x: n.xf[4] + n.xf[2], y: n.xf[5] + n.xf[3] });
    return { ...n, xf: [ax.x - o.x, ax.y - o.y, ay.x - o.x, ay.y - o.y, o.x, o.y] };
  }
  return n;
}

type FtMode = 'transform' | 'perspective' | 'free';
const FT = { ...newDrag(), distort: null as null | 'free' | 'perspective', corner: -1, src: null as Pt[] | null, q: null as Pt[] | null, angle: 0, envIds: new Map<string, string>(), shear: false };
function shearDrag(ctx: ToolContext, p: ToolPointer): void {
  const e = ctx.engine, base = e.dragOrigin, f = FT.frame;
  if (!base || !f) return;
  FT.cur = p.doc;
  if (!FT.moved && Math.hypot(p.doc.x - FT.start.x, p.doc.y - FT.start.y) * ctx.view().zoom < 3) return;
  FT.moved = true;
  const toLocal = rotateAbout(-f.angle, 0, 0), toDoc = rotateAbout(f.angle, 0, 0), r = f.local;
  const a = apply(toLocal, FT.start.x, FT.start.y), b = apply(toLocal, p.doc.x, p.doc.y), horiz = FT.handle === 1 || FT.handle === 5;
  const top = FT.handle === 1, left = FT.handle === 7;
  const k = horiz ? (b.x - a.x) / Math.max(1e-6, r.h) * (top ? -1 : 1) : (b.y - a.y) / Math.max(1e-6, r.w) * (left ? -1 : 1);
  const oy = top ? r.y + r.h : r.y, ox = left ? r.x + r.w : r.x;
  const s: Mat = horiz ? [1, 0, k, 1, -k * oy, 0] : [1, k, 0, 1, 0, -k * ox];
  e.dragTo(transformNodes(base, FT.ids, mul(toDoc, mul(s, toLocal)), p.alt, xf(e)).doc);
  FT.info = [`${fmt((Math.atan(k) * 180) / Math.PI)}°`];
}
const ftMode = (e: Engine): FtMode => e.options.ftMode ?? 'transform';
const FT_HINT: Record<FtMode, string> = {
  transform: 'Drag handles to scale, outside a corner to rotate, Ctrl or Command on a side handle to shear. Ctrl or Command on a corner distorts freely; Ctrl+Alt+Shift or Command+Option+Shift on a corner distorts in perspective.',
  perspective: 'Perspective Distort: drag a corner along its edge; the opposite corner on that edge moves the other way.',
  free: 'Free Distort: drag any corner of the bounding box anywhere.',
};
function distortQuad(p: ToolPointer, constrain: boolean): Pt[] {
  const src = FT.src as Pt[], q = src.map((c) => ({ ...c })), k = FT.corner, a = (FT.angle * Math.PI) / 180;
  const u = { x: Math.cos(a), y: Math.sin(a) }, v = { x: -Math.sin(a), y: Math.cos(a) };
  const dx = p.doc.x - FT.start.x, dy = p.doc.y - FT.start.y, du = dx * u.x + dy * u.y, dv = dx * v.x + dy * v.y;
  if (FT.distort === 'perspective') {
    const horiz = Math.abs(du) >= Math.abs(dv), partner = horiz ? k ^ 1 : 3 - k, dir = horiz ? u : v, t = horiz ? du : dv;
    q[k] = { x: src[k].x + dir.x * t, y: src[k].y + dir.y * t };
    q[partner] = { x: src[partner].x - dir.x * t, y: src[partner].y - dir.y * t };
    return q;
  }
  if (constrain) { const horiz = Math.abs(du) >= Math.abs(dv), dir = horiz ? u : v, t = horiz ? du : dv; q[k] = { x: src[k].x + dir.x * t, y: src[k].y + dir.y * t }; }
  else q[k] = { x: src[k].x + dx, y: src[k].y + dy };
  return q;
}
registerTool({
  id: 'freeTransform', label: 'Free Transform Tool', group: 'free', order: 54, shortcut: 'E',
  icon: () => 'vFreeTransform',
  hint: (e) => FT_HINT[ftMode(e)],
  cursor: (ctx, p) => {
    if (!p) return CURSORS.select;
    const h = handleAt(ctx, p), mode = ftMode(ctx.engine), corner = h >= 0 && h < 100 && h % 2 === 0;
    if (mode !== 'transform') return corner ? CURSORS.direct : CURSORS.select;
    return h >= 100 ? CURSORS.rotate : h >= 0 ? (p.mod && corner ? CURSORS.direct : cursorFor(h)) : CURSORS.select;
  },
  options: (e) => [
    { kind: 'title', text: 'Free Transform' },
    { kind: 'segment', label: 'Mode', choices: [{ id: 'transform', label: 'Free Transform' }, { id: 'perspective', label: 'Perspective Distort' }, { id: 'free', label: 'Free Distort' }], get: () => ftMode(e), set: (id) => e.update({ ftMode: id as FtMode }) },
    { kind: 'toggle', label: 'Constrain', get: () => !!e.options.ftConstrain, set: (v) => e.update({ ftConstrain: v }) },
  ],
  down: (ctx, p) => {
    const e = ctx.engine, h = handleAt(ctx, p), mode = ftMode(e);
    if (h < 0) {
      const hit = e.hit(p.doc);
      if (hit) { const id = e.selectableFor(hit.id); if (!e.current?.selection.has(id)) e.select([id]); beginTransform(ctx, FT, p, 'move'); }
      else { e.deselect(); FT.mode = 'marquee'; FT.start = FT.cur = p.doc; }
      return;
    }
    const corner = h < 100 && h % 2 === 0;
    const persp = corner && (mode === 'perspective' || (mode === 'transform' && p.mod && p.alt && p.shift));
    const free = corner && !persp && (mode === 'free' || (mode === 'transform' && p.mod));
    if (persp || free) {
      const f = e.selectionFrame();
      if (!f) return;
      FT.distort = persp ? 'perspective' : 'free'; FT.corner = h / 2; FT.ids = e.targetIds(); FT.start = p.doc; FT.cur = p.doc; FT.moved = false;
      FT.src = f.corners; FT.q = f.corners.map((c) => ({ ...c })); FT.angle = f.angle; FT.envIds = new Map(); FT.copyIds = null;
      e.beginDrag(persp ? 'Perspective Distort' : 'Free Distort');
      return;
    }
    if (mode !== 'transform') return;
    FT.shear = h < 100 && h % 2 === 1 && p.mod;
    beginTransform(ctx, FT, p, h >= 100 ? 'rotate' : 'scale', h % 100);
    if (FT.shear) e.beginDrag('Shear');
  },
  move: (ctx, p) => {
    const e = ctx.engine, constrain = p.shift || !!e.options.ftConstrain;
    if (FT.mode === 'marquee') { FT.cur = p.doc; ctx.redraw(); return; }
    if (FT.shear && FT.mode === 'scale') { shearDrag(ctx, p); return; }
    if (!FT.distort) { dragTransform(ctx, FT, constrain && FT.mode !== 'move' ? { ...p, shift: true } : p); return; }
    const base = e.dragOrigin;
    if (!base || !FT.src) return;
    FT.cur = p.doc;
    if (!FT.moved && Math.hypot(p.doc.x - FT.start.x, p.doc.y - FT.start.y) * ctx.view().zoom < 2) return;
    FT.moved = true;
    let ptr = p;
    if (FT.distort === 'free' && !constrain) { const c = FT.src[FT.corner], s = ctx.snap({ x: c.x + p.doc.x - FT.start.x, y: c.y + p.doc.y - FT.start.y }, new Set(FT.ids)).p; ptr = { ...p, doc: { x: FT.start.x + s.x - c.x, y: FT.start.y + s.y - c.y } }; }
    FT.q = distortQuad(ptr, constrain);
    const r = e.distortTargets(base, FT.ids, FT.src, FT.q, FT.envIds);
    FT.copyIds = r.select;
    e.dragTo(r.doc);
  },
  up: (ctx, p) => {
    const e = ctx.engine;
    if (FT.mode === 'marquee') { const r = normRect(FT.start.x, FT.start.y, p.doc.x, p.doc.y); FT.mode = null; if (r.w * ctx.view().zoom > 2) e.selectInRect(r, 'replace', false); ctx.redraw(); return; }
    if (FT.distort) { FT.distort = null; FT.q = null; if (FT.moved) e.commitDrag(FT.copyIds ?? undefined); else e.cancelDrag(); FT.copyIds = null; ctx.redraw(); return; }
    FT.shear = false;
    endTransform(ctx, FT);
  },
  cancel: (ctx) => { if (ctx.engine.dragging) ctx.engine.cancelDrag(); FT.mode = null; FT.distort = null; FT.q = null; FT.shear = false; ctx.redraw(); },
  overlay: (ctx, g) => {
    if (FT.mode === 'marquee') marquee(ctx, g, FT.start, FT.cur);
    if (FT.mode && FT.moved) hud(ctx, g, ctx.view().toScreen(FT.cur), FT.info);
    if (FT.distort && FT.q && FT.moved) {
      const v = ctx.view(), s = FT.q.map((q) => v.toScreen(q));
      g.save(); g.strokeStyle = ctx.paint().accent; g.lineWidth = 1; g.beginPath(); s.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath(); g.stroke();
      g.fillStyle = '#fff'; for (const q of s) { g.fillRect(Math.round(q.x) - 3, Math.round(q.y) - 3, 6, 6); g.strokeRect(Math.round(q.x) - 2.5, Math.round(q.y) - 2.5, 5, 5); }
      g.restore();
    }
  },
});

const R = { on: false, id: '', start: { x: 0, y: 0 }, moved: false };
registerTool({
  id: 'reshape', label: 'Reshape Tool', group: 'scale', order: 55,
  icon: () => 'vReshape',
  hint: () => 'Drag a point on a selected path; the anchors near it follow with a soft falloff.',
  cursor: () => CURSORS.direct,
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const h = e.hit(p.doc, 5);
    if (!h) return;
    const n = findNode(pr.doc, h.id);
    if (n?.kind !== 'path') return;
    if (!pr.selection.has(n.id)) e.select([n.id]);
    R.on = true; R.id = n.id; R.start = p.doc; R.moved = false;
    e.beginDrag('Reshape');
  },
  move: (ctx, p) => {
    const e = ctx.engine, base = e.dragOrigin;
    if (!R.on || !base) return;
    const n = findNode(base, R.id);
    if (n?.kind !== 'path') return;
    R.moved = true;
    const dx = p.doc.x - R.start.x, dy = p.doc.y - R.start.y, b = e.boundsOf(n), rad = Math.max(b.w, b.h) / 2 || 1;
    const f = (q: Pt): Pt => { const w = Math.max(0, 1 - Math.hypot(q.x - R.start.x, q.y - R.start.y) / rad); const k = w * w * (3 - 2 * w); return { x: q.x + dx * k, y: q.y + dy * k }; };
    e.dragTo(replaceNode(base, R.id, mapAnchorsNode(n, f)));
  },
  up: (ctx) => { const e = ctx.engine; if (!R.on) return; R.on = false; if (R.moved) e.commitDrag(); else e.cancelDrag(); },
  cancel: (ctx) => { if (ctx.engine.dragging) ctx.engine.cancelDrag(); R.on = false; ctx.redraw(); },
});

type WSide = 'l' | 'r';
const W = { mode: '' as '' | 'create' | 'move' | 'side', id: '', sub: 0, hoverId: '', hover: null as Pt | null, moved: false, t0: 0, anchor: { x: 0, y: 0 }, pick: -1, side: 'l' as WSide, dup: false, clickSel: -1, base: [] as number[], subs: new Map<string, number>() };

interface WPos { i: number; c: Pt; a: Pt; b: Pt }
const strokeOf = (n: VNode | null | undefined): StrokeItem | null => (n?.kind === 'path' ? firstStroke(n.ap) : null);

function shownIds(e: Engine): string[] {
  const pr = e.current, out: string[] = [];
  if (!pr) return out;
  for (const id of [...e.selectedIds().slice(0, 8), W.hoverId]) if (id && !out.includes(id) && strokeOf(findNode(pr.doc, id))) out.push(id);
  return out;
}

function widthLayout(d: PathData, sub: number, s: StrokeItem, zoom: number): WPos[] {
  const prof = s.profile ?? [], sp = d[Math.min(sub, d.length - 1)];
  if (!sp || !prof.length) return [];
  const fr = widthFrames(sp, prof.map((q) => q.t)), hw = s.width / 2, group = new Map<number, number[]>();
  if (fr.length !== prof.length) return [];
  prof.forEach((q, i) => { const g = group.get(q.t); if (g) g.push(i); else group.set(q.t, [i]); });
  return prof.map((q, i) => {
    const f = fr[i], g = group.get(q.t) as number[], off = (g.indexOf(i) - (g.length - 1) / 2) * (10 / zoom);
    const c = { x: f.p.x + f.u.x * off, y: f.p.y + f.u.y * off };
    return { i, c, a: { x: c.x + f.n.x * hw * q.l, y: c.y + f.n.y * hw * q.l }, b: { x: c.x - f.n.x * hw * q.r, y: c.y - f.n.y * hw * q.r } };
  });
}

function pickWidth(ctx: ToolContext, p: ToolPointer): { id: string; i: number; handle: WSide | null } | null {
  const e = ctx.engine, pr = e.current, v = ctx.view();
  if (!pr) return null;
  const at = v.toScreen(p.doc);
  let best: { id: string; i: number; handle: WSide | null; d: number } | null = null;
  for (const id of shownIds(e)) {
    const n = findNode(pr.doc, id), s = strokeOf(n);
    if (n?.kind !== 'path' || !s) continue;
    for (const L of widthLayout(n.d, W.subs.get(id) ?? 0, s, v.zoom)) {
      const c = v.toScreen(L.c), a = v.toScreen(L.a), b = v.toScreen(L.b);
      const dc = Math.hypot(c.x - at.x, c.y - at.y), da = Math.hypot(a.x - at.x, a.y - at.y), db = Math.hypot(b.x - at.x, b.y - at.y);
      const cand: Array<[number, WSide | null]> = [[dc, null], [da + 2, 'l'], [db + 2, 'r']];
      for (const [d, handle] of cand) if (d <= 7 && (!best || d < best.d)) best = { id, i: L.i, handle, d };
    }
  }
  return best ? { id: best.id, i: best.i, handle: best.handle } : null;
}

registerTool({
  id: 'width', label: 'Width Tool', group: 'width', order: 56, shortcut: 'Shift+W',
  icon: () => 'vWidth',
  hint: () => 'Drag along a stroke to add a width point, drag a point to move it, drag a handle to change the width. Alt on a handle changes one side; Alt-drag a point copies it; Shift-click selects more; Delete removes; double-click edits.',
  cursor: () => CURSORS.cross,
  hover: (ctx, p) => {
    W.hover = p?.doc ?? null;
    const e = ctx.engine, pr = e.current;
    if (!p) W.hoverId = '';
    else if (pr && !W.mode && !pickWidth(ctx, p)) {
      const h = e.hit(p.doc, 6), n = h ? findNode(pr.doc, h.id) : null;
      if (n?.kind === 'path' && firstStroke(n.ap)) {
        W.hoverId = n.id;
        const r = nearestOnPath(n.d, p.doc);
        if (r) W.subs.set(n.id, r.sub);
      } else if (W.hoverId) {
        const m = findNode(pr.doc, W.hoverId), r = m?.kind === 'path' ? nearestOnPath(m.d, p.doc) : null;
        if (!r || r.d * ctx.view().zoom > 30) W.hoverId = '';
      }
    }
    ctx.redraw();
  },
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    W.moved = false; W.mode = ''; W.clickSel = -1; W.dup = false;
    const k = pickWidth(ctx, p);
    if (k) {
      const n = findNode(pr.doc, k.id), s = strokeOf(n);
      if (n?.kind !== 'path' || !s?.profile) return;
      if (!pr.selection.has(k.id)) e.select([k.id]);
      if (e.widthSel.id !== k.id) e.widthSel = { id: k.id, idx: [] };
      const ws = e.widthSel, on = ws.idx.includes(k.i);
      if (k.handle) ws.idx = on ? ws.idx : p.shift ? [...ws.idx, k.i] : [k.i];
      else if (p.shift) { ws.idx = on ? ws.idx.filter((x) => x !== k.i) : [...ws.idx, k.i]; if (on) { ctx.redraw(); return; } }
      else if (on) W.clickSel = k.i;
      else ws.idx = [k.i];
      const sub = W.subs.get(k.id) ?? 0, near = n.d[sub] ? widthAxisNearest(n.d[sub], p.doc) : null;
      W.id = k.id; W.sub = sub; W.t0 = near?.t ?? s.profile[k.i].t; W.pick = k.i; W.side = k.handle ?? 'l'; W.dup = !k.handle && p.alt;
      W.mode = k.handle ? 'side' : 'move';
      W.base = [...ws.idx];
      e.beginDrag(k.handle ? 'Change Width' : W.dup ? 'Duplicate Width Points' : 'Move Width Points');
      ctx.redraw();
      return;
    }
    const h = e.hit(p.doc, 6), n = h ? findNode(pr.doc, h.id) : null;
    if (n?.kind !== 'path' || !firstStroke(n.ap)) { e.widthSel = { id: '', idx: [] }; ctx.redraw(); return; }
    let sub = 0, best: { t: number; pt: Pt; d: number } | null = null;
    for (let i = 0; i < n.d.length; i++) { const r = widthAxisNearest(n.d[i], p.doc); if (r && (!best || r.d < best.d)) { best = r; sub = i; } }
    if (!best) return;
    if (!pr.selection.has(n.id)) e.select([n.id]);
    e.widthSel = { id: n.id, idx: [] };
    W.subs.set(n.id, sub);
    W.mode = 'create'; W.id = n.id; W.sub = sub; W.t0 = best.t; W.anchor = best.pt;
    e.beginDrag('Add Width Point');
  },
  move: (ctx, p) => {
    const e = ctx.engine, base = e.dragOrigin;
    W.hover = p.doc;
    if (!W.mode || !base) return;
    const n = findNode(base, W.id), s = strokeOf(n), sp = n?.kind === 'path' ? n.d[W.sub] : null;
    if (n?.kind !== 'path' || !s || !sp) return;
    W.moved = true;
    const hw = Math.max(1e-6, (s.width || 1) / 2), prof0 = normalizeWidthPoints(s.profile?.length ? s.profile : [{ t: 0, l: 1, r: 1 }, { t: 1, l: 1, r: 1 }]);
    const sel0 = W.base.filter((i) => i >= 0 && i < prof0.length);
    let out: WidthPoint[], sel: number[];
    if (W.mode === 'create') {
      const fr = widthFrames(sp, [W.t0])[0], dx = p.doc.x - W.anchor.x, dy = p.doc.y - W.anchor.y, cur = profileAt(prof0, W.t0);
      const k = Math.max(0.01, Math.hypot(dx, dy)) / hw;
      let q: WidthPoint = { t: W.t0, l: k, r: k };
      if (p.alt && fr) { const along = dx * fr.n.x + dy * fr.n.y, kk = Math.max(0.01, Math.abs(along)) / hw; q = along >= 0 ? { t: W.t0, l: kk, r: cur.r } : { t: W.t0, l: cur.l, r: kk }; }
      out = prof0.filter((x) => Math.abs(x.t - W.t0) > 0.02);
      out.push(q);
      out.sort((a, b) => a.t - b.t);
      sel = [out.indexOf(q)];
    } else if (W.mode === 'move') {
      const near = widthAxisNearest(sp, p.doc);
      if (!near || !sel0.length) return;
      const items = prof0.map((q) => ({ q: { ...q }, mv: false })), moving = W.dup ? sel0.map((i) => ({ q: { ...prof0[i] }, mv: true })) : sel0.map((i) => { items[i].mv = true; return items[i]; });
      if (W.dup) items.push(...moving);
      const lo = Math.min(...moving.map((x) => x.q.t)), hi = Math.max(...moving.map((x) => x.q.t)), dt = Math.max(-lo, Math.min(1 - hi, near.t - W.t0));
      for (const m of moving) {
        let t = m.q.t + dt;
        for (const o of items) if (!o.mv && Math.abs(o.q.t - t) < 0.003) { t = o.q.t; break; }
        m.q.t = t;
      }
      items.sort((a, b) => a.q.t - b.q.t);
      out = items.map((x) => x.q);
      sel = items.flatMap((x, i) => (x.mv ? [i] : []));
    } else {
      const q0 = prof0[W.pick], fr = q0 ? widthFrames(sp, [q0.t])[0] : null;
      if (!q0 || !fr) return;
      const proj = (((p.doc.x - fr.p.x) * fr.n.x + (p.doc.y - fr.p.y) * fr.n.y) * (W.side === 'l' ? 1 : -1)) / hw, delta = Math.max(0, proj) - q0[W.side];
      out = prof0.map((q) => ({ ...q }));
      for (const i of sel0) {
        const q = out[i];
        if (p.alt) q[W.side] = Math.max(0, q[W.side] + delta);
        else { q.l = Math.max(0, q.l + delta); q.r = Math.max(0, q.r + delta); }
      }
      sel = sel0;
    }
    e.widthSel.idx = sel;
    e.dragTo(replaceNode(base, W.id, { ...n, ap: withFirstStroke(n.ap, { profile: out }) }));
  },
  up: (ctx) => {
    const e = ctx.engine;
    if (!W.mode) return;
    W.mode = '';
    if (W.moved) e.commitDrag();
    else { e.cancelDrag(); if (W.clickSel >= 0) e.widthSel.idx = [W.clickSel]; }
    W.clickSel = -1;
    ctx.redraw();
  },
  cancel: (ctx) => { if (!W.mode) return; W.mode = ''; ctx.engine.cancelDrag(); ctx.redraw(); },
  deactivate: () => { W.mode = ''; W.hoverId = ''; },
  keydown: (ctx, ev) => {
    if (ev.key !== 'Delete' && ev.key !== 'Backspace') return false;
    const e = ctx.engine, ws = e.widthSel, s = strokeOf(e.current ? findNode(e.current.doc, ws.id) : null);
    if (!s?.profile || !ws.idx.length) return false;
    const keep = s.profile.filter((_, i) => !ws.idx.includes(i));
    e.setWidthPoints(keep.length ? keep : null, [ws.id], 'Delete Width Points');
    e.widthSel = { id: ws.id, idx: [] };
    ctx.redraw();
    return true;
  },
  dblclick: (ctx, p) => {
    const k = pickWidth(ctx, p);
    if (!k) return;
    ctx.engine.widthSel = { id: k.id, idx: [k.i] };
    toolHost.run('width-point-edit');
  },
  overlay: (ctx, g) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const v = ctx.view(), pal = ctx.paint();
    g.save();
    g.lineWidth = 1;
    for (const id of shownIds(e)) {
      const n = findNode(pr.doc, id), s = strokeOf(n);
      if (n?.kind !== 'path' || !s) continue;
      const sel = e.widthSel.id === id ? e.widthSel.idx : [];
      for (const L of widthLayout(n.d, W.subs.get(id) ?? 0, s, v.zoom)) {
        const c = v.toScreen(L.c), a = v.toScreen(L.a), b = v.toScreen(L.b), on = sel.includes(L.i);
        g.strokeStyle = pal.accent; g.fillStyle = on ? pal.accent : pal.handle;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        for (const h of [a, b]) { g.beginPath(); g.rect(h.x - 3, h.y - 3, 6, 6); g.fill(); g.stroke(); }
        g.beginPath(); g.moveTo(c.x, c.y - 5); g.lineTo(c.x + 5, c.y); g.lineTo(c.x, c.y + 5); g.lineTo(c.x - 5, c.y); g.closePath(); g.fill(); g.stroke();
      }
    }
    g.restore();
  },
});

type Liquify = 'warp' | 'twirl' | 'pucker' | 'bloat';
const L = { on: false, last: { x: 0, y: 0 }, hover: null as Pt | null, ids: [] as string[] };
const LQ = { detail: 5 };
function liquifyTool(id: string, label: string, iconName: string, order: number, kind: Liquify, shortcut?: string): void {
  registerTool({
    id, label, group: 'warp', order, shortcut,
    icon: () => iconName,
    hint: () => `Drag over objects to ${kind} them. [ and ] change the brush size.`,
    cursor: () => 'none',
    options: (e) => [{ kind: 'title', text: label }, { kind: 'range', label: 'Size', min: 4, max: 800, unit: 'pt', get: () => e.options.liquifySize, set: (v) => e.update({ liquifySize: v }) }, { kind: 'range', label: 'Detail', min: 1, max: 10, get: () => LQ.detail, set: (v) => { LQ.detail = v; } }],
    hover: (ctx, p) => { L.hover = p?.doc ?? null; ctx.redraw(); },
    keydown: (ctx, ev) => { if (ev.key !== '[' && ev.key !== ']') return false; const e = ctx.engine; e.update({ liquifySize: Math.max(4, e.options.liquifySize + (ev.key === ']' ? 6 : -6)) }); ctx.redraw(); return true; },
    down: (ctx, p) => {
      const e = ctx.engine, pr = e.current;
      if (!pr) return;
      L.on = true; L.last = p.doc;
      L.ids = e.hasSelection ? e.targetIds() : pr.doc.layers.flatMap((l) => l.hidden || l.locked ? [] : l.children.filter((c) => !c.hidden && !c.locked).map((c) => c.id));
      e.beginDrag(label.replace(/ Tool$/, ''));
    },
    move: (ctx, p) => {
      const e = ctx.engine, pr = e.current;
      L.hover = p.doc;
      if (!L.on || !pr) return;
      const r = e.options.liquifySize / 2, c = p.doc, dx = c.x - L.last.x, dy = c.y - L.last.y;
      L.last = c;
      const f = (q: Pt): Pt => {
        const d = Math.hypot(q.x - c.x, q.y - c.y);
        if (d >= r) return q;
        const w = 1 - d / r, k = w * w;
        if (kind === 'warp') return { x: q.x + dx * k, y: q.y + dy * k };
        if (kind === 'twirl') { const a = 0.08 * k, m = rotateAbout((a * 180) / Math.PI, c.x, c.y); return apply(m, q.x, q.y); }
        const s = kind === 'pucker' ? -0.05 * k : 0.05 * k;
        return { x: q.x + (q.x - c.x) * s, y: q.y + (q.y - c.y) * s };
      };
      const gap = Math.max(1.5, (r * 2) / (3 + LQ.detail * 2));
      const dense = (n: VNode): VNode => {
        if (n.kind === 'path') { const d = n.d.map((sp) => refine(sp, c, r, gap)); return d.some((sp, i) => sp !== n.d[i]) ? { ...n, d, live: undefined } : n; }
        if (n.kind === 'compound') { const ch = n.children.map((k) => ({ ...k, d: k.d.map((sp) => refine(sp, c, r, gap)) })); return { ...n, children: ch }; }
        if (n.kind === 'group') return { ...n, children: n.children.map(dense) };
        return n;
      };
      let doc = pr.doc;
      for (const id of L.ids) { const n = findNode(doc, id); if (n && n.kind !== 'text' && n.kind !== 'image') doc = replaceNode(doc, id, mapAnchorsNode(dense(n), f)); }
      e.dragTo(doc);
    },
    up: (ctx) => { if (!L.on) return; L.on = false; ctx.engine.commitDrag(); },
    overlay: (ctx, g) => {
      if (!L.hover) return;
      const v = ctx.view(), s = v.toScreen(L.hover);
      g.save(); g.strokeStyle = ctx.paint().accent; g.beginPath(); g.arc(s.x, s.y, (ctx.engine.options.liquifySize / 2) * v.zoom, 0, Math.PI * 2); g.stroke(); g.restore();
    },
    cancel: (ctx) => { if (ctx.engine.dragging) ctx.engine.cancelDrag(); L.on = false; ctx.redraw(); },
  });
}
liquifyTool('warp', 'Warp Tool', 'vWarp', 57, 'warp', 'Shift+R');
liquifyTool('twirl', 'Twirl Tool', 'vTwirl', 58, 'twirl');
liquifyTool('pucker', 'Pucker Tool', 'vPucker', 59, 'pucker');
liquifyTool('bloat', 'Bloat Tool', 'vBloat', 60, 'bloat');
