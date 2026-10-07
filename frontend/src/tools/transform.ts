import { findNode } from '../engine/doc';
import { apply, mul, nearestOnPath, normRect, rotateAbout, scaleAbout, segLength, segments } from '../engine/geometry';
import { transformNodes } from '../engine/ops/objects';
import { firstStroke, withFirstStroke } from '../engine/paint';
import type { Anchor, Doc, Engine, Mat, PathData, Pt, Rect, VNode, WidthPoint } from '../engine';
import { registerTool, toolHost } from '../extensions/registry';
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

function bilinear(r: Rect, q: [Pt, Pt, Pt, Pt]): (p: Pt) => Pt {
  return (p) => {
    const u = r.w ? (p.x - r.x) / r.w : 0, v = r.h ? (p.y - r.y) / r.h : 0;
    const top = { x: q[0].x + (q[1].x - q[0].x) * u, y: q[0].y + (q[1].y - q[0].y) * u }, bot = { x: q[3].x + (q[2].x - q[3].x) * u, y: q[3].y + (q[2].y - q[3].y) * u };
    return { x: top.x + (bot.x - top.x) * v, y: top.y + (bot.y - top.y) * v };
  };
}

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

const FT = { ...newDrag(), distort: false, corner: -1, q: null as [Pt, Pt, Pt, Pt] | null };
registerTool({
  id: 'freeTransform', label: 'Free Transform Tool', group: 'free', order: 54, shortcut: 'E',
  icon: () => 'vFreeTransform',
  hint: () => 'Drag handles to scale, outside a corner to rotate. Hold Ctrl or Command while dragging a corner to distort freely.',
  cursor: (ctx, p) => { if (!p) return CURSORS.select; const h = handleAt(ctx, p); return h >= 100 ? CURSORS.rotate : h >= 0 ? (p.mod ? CURSORS.direct : cursorFor(h)) : CURSORS.select; },
  down: (ctx, p) => {
    const e = ctx.engine, h = handleAt(ctx, p);
    if (h < 0) {
      const hit = e.hit(p.doc);
      if (hit) { const id = e.selectableFor(hit.id); if (!e.current?.selection.has(id)) e.select([id]); beginTransform(ctx, FT, p, 'move'); }
      else { e.deselect(); FT.mode = 'marquee'; FT.start = FT.cur = p.doc; }
      return;
    }
    if (p.mod && h < 100 && h % 2 === 0) {
      const b = e.selectionBounds(false);
      if (!b) return;
      FT.distort = true; FT.corner = h / 2; FT.box = b; FT.ids = e.targetIds(); FT.start = p.doc; FT.moved = false;
      FT.q = [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }];
      e.beginDrag('Free Distort');
      return;
    }
    beginTransform(ctx, FT, p, h >= 100 ? 'rotate' : 'scale', h % 100);
  },
  move: (ctx, p) => {
    if (FT.mode === 'marquee') { FT.cur = p.doc; ctx.redraw(); return; }
    if (!FT.distort) { dragTransform(ctx, FT, p); return; }
    const e = ctx.engine, base = e.dragOrigin;
    if (!base || !FT.box || !FT.q) return;
    FT.moved = true;
    const q = FT.q.map((x) => ({ ...x })) as [Pt, Pt, Pt, Pt];
    q[FT.corner] = ctx.snap(p.doc, new Set(FT.ids)).p;
    const f = bilinear(FT.box, q);
    let doc: Doc = base;
    for (const id of FT.ids) { const n = findNode(doc, id); if (n) doc = replaceNode(doc, id, mapAnchorsNode(n, f)); }
    e.dragTo(doc);
  },
  up: (ctx, p) => {
    const e = ctx.engine;
    if (FT.mode === 'marquee') { const r = normRect(FT.start.x, FT.start.y, p.doc.x, p.doc.y); FT.mode = null; if (r.w * ctx.view().zoom > 2) e.selectInRect(r, 'replace', false); ctx.redraw(); return; }
    if (FT.distort) { FT.distort = false; if (FT.moved) e.commitDrag(); else e.cancelDrag(); return; }
    endTransform(ctx, FT);
  },
  overlay: (ctx, g) => { if (FT.mode === 'marquee') marquee(ctx, g, FT.start, FT.cur); if (FT.mode && FT.moved) hud(ctx, g, ctx.view().toScreen(FT.cur), FT.info); },
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
