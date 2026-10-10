import { findNode } from '../engine/doc';
import { apply, mul, nearestOnPath, normRect, rotateAbout, scaleAbout, segLength, segments } from '../engine/geometry';
import { transformNodes } from '../engine/ops/objects';
import { firstStroke, withFirstStroke } from '../engine/paint';
import type { Anchor, Engine, Mat, PathData, Pt, VNode, WidthPoint } from '../engine';
import { registerTool, toolHost, type ToolContext, type ToolPointer } from '../extensions/registry';
import { CURSORS, cursorFor } from '../ui/cursors';
import { beginTransform, dragTransform, endTransform, handleAt, newDrag, replaceNode } from './select';
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
});

function lengthAt(d: PathData, sub: number, seg: number, t: number): number {
  const sp = d[sub], segs = segments(sp), total = segs.reduce((s, g) => s + segLength(g), 0);
  let acc = 0;
  for (let i = 0; i < seg; i++) acc += segLength(segs[i]);
  acc += segLength(segs[seg], 0, t);
  return total ? acc / total : 0;
}

const W = { on: false, id: '', t: 0, anchor: { x: 0, y: 0 }, moved: false, hover: null as Pt | null };
registerTool({
  id: 'width', label: 'Width Tool', group: 'width', order: 56, shortcut: 'Shift+W',
  icon: () => 'vWidth',
  hint: () => 'Drag out from a stroke to change its width at that point; Alt drags one side only.',
  cursor: () => CURSORS.cross,
  hover: (ctx, p) => { W.hover = p?.doc ?? null; ctx.redraw(); },
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const h = e.hit(p.doc, 6);
    const n = h ? findNode(pr.doc, h.id) : null;
    if (n?.kind !== 'path' || !firstStroke(n.ap)) return;
    const r = nearestOnPath(n.d, p.doc);
    if (!r) return;
    if (!pr.selection.has(n.id)) e.select([n.id]);
    W.on = true; W.id = n.id; W.t = lengthAt(n.d, r.sub, r.seg, r.t); W.anchor = r.pt; W.moved = false;
    e.beginDrag('Width');
  },
  move: (ctx, p) => {
    const e = ctx.engine, base = e.dragOrigin;
    if (!W.on || !base) return;
    const n = findNode(base, W.id), s = n ? firstStroke(n.ap) : null;
    if (!n || !s) return;
    W.moved = true;
    const half = Math.max(0.01, Math.hypot(p.doc.x - W.anchor.x, p.doc.y - W.anchor.y)), w = s.width || 1, k = half / (w / 2);
    const prof: WidthPoint[] = (s.profile?.length ? s.profile : [{ t: 0, l: 1, r: 1 }, { t: 1, l: 1, r: 1 }]).filter((x) => Math.abs(x.t - W.t) > 0.02);
    prof.push({ t: W.t, l: k, r: p.alt ? (prof.find((x) => x.t > W.t)?.r ?? 1) : k });
    prof.sort((a, b) => a.t - b.t);
    e.dragTo(replaceNode(base, W.id, { ...n, ap: withFirstStroke(n.ap, { profile: prof }) }));
    W.hover = p.doc;
  },
  up: (ctx) => { const e = ctx.engine; if (!W.on) return; W.on = false; if (W.moved) e.commitDrag(); else e.cancelDrag(); },
  overlay: (ctx, g) => {
    if (!W.on || !W.hover) return;
    const v = ctx.view(), a = v.toScreen(W.anchor), b = v.toScreen(W.hover);
    g.save(); g.strokeStyle = ctx.paint().accent; g.beginPath(); g.moveTo(2 * a.x - b.x, 2 * a.y - b.y); g.lineTo(b.x, b.y); g.stroke(); g.restore();
  },
});

type Liquify = 'warp' | 'twirl' | 'pucker' | 'bloat';
const L = { on: false, last: { x: 0, y: 0 }, hover: null as Pt | null, ids: [] as string[] };
function liquifyTool(id: string, label: string, iconName: string, order: number, kind: Liquify, shortcut?: string): void {
  registerTool({
    id, label, group: 'warp', order, shortcut,
    icon: () => iconName,
    hint: () => `Drag over objects to ${kind} them. [ and ] change the brush size.`,
    cursor: () => 'none',
    options: (e) => [{ kind: 'title', text: label }, { kind: 'range', label: 'Size', min: 4, max: 800, unit: 'pt', get: () => e.options.liquifySize, set: (v) => e.update({ liquifySize: v }) }],
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
      let doc = pr.doc;
      for (const id of L.ids) { const n = findNode(doc, id); if (n && n.kind !== 'text' && n.kind !== 'image') doc = replaceNode(doc, id, mapAnchorsNode(n, f)); }
      e.dragTo(doc);
    },
    up: (ctx) => { if (!L.on) return; L.on = false; ctx.engine.commitDrag(); },
    overlay: (ctx, g) => {
      if (!L.hover) return;
      const v = ctx.view(), s = v.toScreen(L.hover);
      g.save(); g.strokeStyle = ctx.paint().accent; g.beginPath(); g.arc(s.x, s.y, (ctx.engine.options.liquifySize / 2) * v.zoom, 0, Math.PI * 2); g.stroke(); g.restore();
    },
  });
}
liquifyTool('warp', 'Warp Tool', 'vWarp', 57, 'warp', 'Shift+R');
liquifyTool('twirl', 'Twirl Tool', 'vTwirl', 58, 'twirl');
liquifyTool('pucker', 'Pucker Tool', 'vPucker', 59, 'pucker');
liquifyTool('bloat', 'Bloat Tool', 'vBloat', 60, 'bloat');
