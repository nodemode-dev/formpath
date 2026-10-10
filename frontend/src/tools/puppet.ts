import { findNode } from '../engine/doc';
import { defaultPins, inMesh, localAngle, puppetApply, puppetMesh, PuppetSolver, unmapPoint, type PuppetMesh } from '../engine/puppet';
import type { Doc, Engine, Pt, VNode } from '../engine';
import { registerTool, type ToolContext, type ToolPointer } from '../extensions/registry';
import { CURSORS } from '../ui/cursors';
import { fmt, hud } from './util';

interface Pin { at: Pt; to: Pt; angle: number | null; sel: boolean }
interface Session { doc: Doc; rest: VNode[]; mesh: PuppetMesh; pins: Pin[]; def: Float64Array; envIds: Map<string, string>; solver: PuppetSolver | null; solverKey: string; expand: number; seeded: boolean }

let S: Session | null = null;
const D = { mode: null as null | 'move' | 'rotate', start: { x: 0, y: 0 }, cur: { x: 0, y: 0 }, moved: false, pivot: -1, a0: 0, base: [] as Array<{ to: Pt; angle: number | null }>, info: [] as string[], hover: null as Pt | null };

const expandOf = (e: Engine): number => e.options.puppetExpand ?? 3;
const PIN_PX = 7, RING_PX = 22;

function build(e: Engine, pins: Pin[] = []): Session | null {
  const p = e.current;
  if (!p) return null;
  const ids = e.targetIds();
  const rest = ids.map((id) => findNode(p.doc, id)).filter((n): n is VNode => !!n && !n.locked && n.kind !== 'layer');
  if (!rest.length) return null;
  const mesh = puppetMesh(p.doc, rest, expandOf(e));
  if (!mesh) return null;
  return { doc: p.doc, rest, mesh, pins, def: mesh.verts, envIds: new Map(), solver: null, solverKey: '', expand: expandOf(e), seeded: pins.length > 0 };
}

function session(e: Engine): Session | null {
  const p = e.current;
  if (!p) { S = null; return null; }
  const want = e.targetIds().slice().sort().join(',');
  if (S && S.doc === p.doc && S.rest.map((n) => S?.envIds.get(n.id) ?? n.id).sort().join(',') === want) return S;
  S = build(e);
  return S;
}

function rebase(e: Engine): void {
  if (!S) return;
  const keep = S.pins.map((q) => ({ at: q.to, to: q.to, angle: q.angle === null ? null : 0, sel: q.sel }));
  S = build(e, keep);
  if (S) S.seeded = true;
}

function solve(s: Session): Float64Array {
  const key = s.pins.map((q) => `${q.at.x},${q.at.y},${q.angle !== null}`).join(';');
  if (!s.solver || s.solverKey !== key) { s.solver = new PuppetSolver(s.mesh, s.pins.map((q) => ({ at: q.at, rot: q.angle !== null }))); s.solverKey = key; }
  s.def = s.pins.length ? s.solver.solve(s.pins.map((q) => ({ to: q.to, angle: q.angle ?? 0 }))) : s.mesh.verts;
  return s.def;
}

function preview(e: Engine): string[] {
  const s = S, base = e.dragOrigin;
  if (!s || !base) return [];
  const r = puppetApply(base, s.rest, s.mesh, solve(s), s.envIds);
  e.dragTo(r.doc);
  return r.select;
}

function pinAt(ctx: ToolContext, p: Pt, px = PIN_PX): number {
  if (!S) return -1;
  const v = ctx.view(), s = v.toScreen(p);
  let best = -1, bd = px;
  S.pins.forEach((q, i) => { const t = v.toScreen(q.to), d = Math.hypot(t.x - s.x, t.y - s.y); if (d <= bd) { bd = d; best = i; } });
  return best;
}

function placeDefaults(s: Session): void {
  s.pins = defaultPins(s.mesh, 3).map((at) => ({ at, to: at, angle: null, sel: false }));
}

let lastSelect: string[] | null = null;

registerTool({
  id: 'puppetWarp', label: 'Puppet Warp Tool', group: 'free', order: 54.5, shortcut: 'J',
  icon: () => 'vPuppet',
  hint: () => 'Select art, then click it to place pins (the first click places three). Drag a pin to bend the art, Alt-drag near a selected pin to twist around it, Shift-click to select several, Delete removes pins.',
  cursor: (ctx, p) => {
    if (!p || !S) return CURSORS.cross;
    if (pinAt(ctx, p.doc) >= 0) return CURSORS.direct;
    if (p.alt && S.pins.some((q) => q.sel)) return CURSORS.rotate;
    return CURSORS.cross;
  },
  options: (e) => [
    { kind: 'title', text: 'Puppet Warp' },
    { kind: 'range', label: 'Expand', min: 0, max: 100, unit: 'pt', get: () => expandOf(e), set: (v) => { e.update({ puppetExpand: v }); if (S && S.doc === e.doc) rebase(e); e.repaint(); } },
    { kind: 'toggle', label: 'Show Mesh', get: () => e.options.puppetMesh ?? true, set: (v) => { e.update({ puppetMesh: v }); e.repaint(); } },
    { kind: 'button', label: 'Select All Pins', run: () => { const s = session(e); if (s) { s.pins.forEach((q) => { q.sel = true; }); e.update({}); e.repaint(); } } },
    { kind: 'readout', label: 'Pins', get: () => String(S && S.doc === e.doc ? S.pins.length : 0) },
  ],
  activate: (ctx) => { S = null; session(ctx.engine); ctx.redraw(); },
  deactivate: () => { S = null; D.mode = null; },
  hover: (ctx, p) => { D.hover = p?.doc ?? null; ctx.redraw(); },
  down: (ctx, p) => {
    const e = ctx.engine;
    let s = session(e);
    if (!s) {
      const h = e.hit(p.doc);
      if (!h) return;
      e.select([e.selectableFor(h.id)]);
      S = null;
      s = session(e);
      if (!s) return;
    }
    if (!s.seeded) {
      if (!inMesh(s.mesh, p.doc)) { const h = e.hit(p.doc); if (!h) return; }
      s.seeded = true;
      placeDefaults(s);
      ctx.redraw(); e.update({});
      return;
    }
    const sel = s.pins.map((q, i) => (q.sel ? i : -1)).filter((i) => i >= 0);
    const on = pinAt(ctx, p.doc);
    if (p.alt && sel.length) {
      const v = ctx.view(), sp = v.toScreen(p.doc);
      let pv = on >= 0 && s.pins[on].sel ? on : -1;
      if (pv < 0) for (const i of sel) { const t = v.toScreen(s.pins[i].to); if (Math.hypot(t.x - sp.x, t.y - sp.y) <= RING_PX + 14 && (pv < 0 || Math.hypot(t.x - sp.x, t.y - sp.y) < Math.hypot(v.toScreen(s.pins[pv].to).x - sp.x, v.toScreen(s.pins[pv].to).y - sp.y))) pv = i; }
      if (pv < 0 && sel.length === 1) pv = sel[0];
      if (pv >= 0) {
        const q = s.pins[pv];
        if (q.angle === null) q.angle = localAngle(s.mesh, s.def, q.at);
        D.mode = 'rotate'; D.pivot = pv; D.start = p.doc; D.cur = p.doc; D.moved = false; D.a0 = Math.atan2(p.doc.y - q.to.y, p.doc.x - q.to.x);
        D.base = s.pins.map((x) => ({ to: x.to, angle: x.angle }));
        e.beginDrag('Puppet Warp');
        return;
      }
    }
    if (on >= 0) {
      if (p.shift) { s.pins[on].sel = !s.pins[on].sel; ctx.redraw(); if (!s.pins[on].sel) return; }
      else if (!s.pins[on].sel) s.pins.forEach((q, i) => { q.sel = i === on; });
    } else {
      const u = unmapPoint(s.mesh, s.def, p.doc);
      if (!u.inside) { if (!p.shift) s.pins.forEach((q) => { q.sel = false; }); ctx.redraw(); return; }
      if (!p.shift) s.pins.forEach((q) => { q.sel = false; });
      s.pins.push({ at: u.rest, to: p.doc, angle: null, sel: true });
      s.solver = null;
      e.update({});
    }
    D.mode = 'move'; D.start = p.doc; D.cur = p.doc; D.moved = false;
    D.base = s.pins.map((x) => ({ to: x.to, angle: x.angle }));
    e.beginDrag('Puppet Warp');
    ctx.redraw();
  },
  move: (ctx, p) => {
    const e = ctx.engine, s = S;
    D.hover = p.doc;
    if (!D.mode || !s || !e.dragOrigin) return;
    D.cur = p.doc;
    if (!D.moved && Math.hypot(p.doc.x - D.start.x, p.doc.y - D.start.y) * ctx.view().zoom < 2) return;
    D.moved = true;
    if (D.mode === 'move') {
      let dx = p.doc.x - D.start.x, dy = p.doc.y - D.start.y;
      if (p.shift) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      s.pins.forEach((q, i) => { if (q.sel) q.to = { x: D.base[i].to.x + dx, y: D.base[i].to.y + dy }; });
      D.info = [`${fmt(dx)}, ${fmt(dy)} pt`];
    } else {
      const c = D.base[D.pivot].to;
      let da = Math.atan2(p.doc.y - c.y, p.doc.x - c.x) - D.a0;
      if (p.shift) da = Math.round(da / (Math.PI / 4)) * (Math.PI / 4);
      const co = Math.cos(da), si = Math.sin(da);
      s.pins.forEach((q, i) => {
        if (!q.sel && i !== D.pivot) return;
        const b = D.base[i];
        if (i !== D.pivot) { const vx = b.to.x - c.x, vy = b.to.y - c.y; q.to = { x: c.x + vx * co - vy * si, y: c.y + vx * si + vy * co }; }
        if (b.angle !== null) q.angle = b.angle + da;
      });
      D.info = [`${fmt((-da * 180) / Math.PI)}°`];
    }
    lastSelect = preview(e);
  },
  up: (ctx) => {
    const e = ctx.engine, s = S;
    if (!D.mode) return;
    D.mode = null;
    if (D.moved && s) { e.commitDrag(lastSelect ?? undefined); s.doc = e.doc as Doc; }
    else { e.cancelDrag(); if (s) s.pins.forEach((q, i) => { q.to = D.base[i]?.to ?? q.to; q.angle = D.base[i] ? D.base[i].angle : q.angle; }); }
    lastSelect = null;
    D.info = [];
    ctx.redraw();
  },
  keydown: (ctx, ev) => {
    if (ev.key !== 'Delete' && ev.key !== 'Backspace') return false;
    const s = S;
    if (!s || s.doc !== ctx.engine.doc || !s.pins.some((q) => q.sel)) return false;
    s.pins = s.pins.filter((q) => !q.sel);
    rebase(ctx.engine);
    ctx.engine.update({});
    ctx.redraw();
    return true;
  },
  cancel: (ctx) => {
    const e = ctx.engine;
    if (D.mode && e.dragging) { e.cancelDrag(); if (S) S.pins.forEach((q, i) => { q.to = D.base[i]?.to ?? q.to; q.angle = D.base[i] ? D.base[i].angle : q.angle; }); }
    D.mode = null;
    ctx.redraw();
  },
  overlay: (ctx, g) => {
    const e = ctx.engine, s = S;
    if (!s || (s.doc !== e.doc && !e.dragging)) return;
    const v = ctx.view(), pal = ctx.paint();
    if (e.options.puppetMesh ?? true) {
      const T = s.mesh.tris, P = s.def;
      g.save(); g.strokeStyle = pal.layer; g.globalAlpha = 0.45; g.lineWidth = 1; g.beginPath();
      for (let t = 0; t < T.length / 3; t++) {
        const a = v.toScreen({ x: P[2 * T[3 * t]], y: P[2 * T[3 * t] + 1] }), b = v.toScreen({ x: P[2 * T[3 * t + 1]], y: P[2 * T[3 * t + 1] + 1] }), c = v.toScreen({ x: P[2 * T[3 * t + 2]], y: P[2 * T[3 * t + 2] + 1] });
        g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.closePath();
      }
      g.stroke(); g.restore();
    }
    g.save();
    for (const q of s.pins) {
      const t = v.toScreen(q.to);
      if (q.sel) { g.strokeStyle = pal.accent; g.setLineDash([3, 3]); g.lineWidth = 1; g.beginPath(); g.arc(t.x, t.y, RING_PX, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
      g.fillStyle = '#ffd400'; g.strokeStyle = '#1e1e1e'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(t.x, t.y, 5.5, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = q.sel ? '#1e1e1e' : '#ffd400';
      g.beginPath(); g.arc(t.x, t.y, 2.2, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    if (D.mode && D.moved) hud(ctx, g, v.toScreen(D.cur), D.info);
  },
});
