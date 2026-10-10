import { allNodes, findNode, isLocked, isVisible } from '../engine/doc';
import { anchorHit, segmentHit } from '../engine/hit';
import { apply, flatIndex, hasIn, hasOut, invert, mul, nearestOnPath, normRect, pointInPolygon, rectContains, rotateAbout, scaleAbout, translate, unflatIndex } from '../engine/geometry';
import { transformNodes } from '../engine/ops/objects';
import { constrainAngle } from '../engine/snap';
import { framePort } from '../engine/flow';
import { pathBrackets, pathParamAt } from '../engine/text';
import { editLive, normalizeLive } from '../engine/ops/live-shapes';
import { updateNodes } from '../engine/doc';
import type { Anchor, Doc, Engine, EnvelopeNode, LiveShape, Mat, PathData, Pt, Rect, VNode } from '../engine';
import { meshHandleAt, meshHandles, meshPointAt, withMeshHandle, withMeshPoint, type MeshSpec } from '../engine/envelope';
import { envelopeFrame } from '../engine/live';
import { registerTool, type ToolContext, type ToolPointer } from '../extensions/registry';
import { CURSORS, cursorFor } from '../ui/cursors';
import { isMac } from '../ui/dom';
import { fmt, hud, layerColor, marquee, outlineNode, stroke2, tolDoc, unitLabel } from './util';

const xf = (e: Engine) => ({ strokes: e.view.scaleStrokes, patterns: e.view.transformPatterns, gradients: true });

export function boxHandles(r: Rect): Pt[] {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, x1 = r.x + r.w, y1 = r.y + r.h;
  return [{ x: r.x, y: r.y }, { x: cx, y: r.y }, { x: x1, y: r.y }, { x: x1, y: cy }, { x: x1, y: y1 }, { x: cx, y: y1 }, { x: r.x, y: y1 }, { x: r.x, y: cy }];
}

export function frameHandles(c: Pt[]): Pt[] {
  const m = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  return [c[0], m(c[0], c[1]), c[1], m(c[1], c[2]), c[2], m(c[2], c[3]), c[3], m(c[3], c[0])];
}

export function handleAt(ctx: ToolContext, p: ToolPointer): number {
  const e = ctx.engine, pr = e.current;
  if (!pr || !e.view.boundingBox || pr.anchors.size || !pr.selection.size) return -1;
  const f = e.selectionFrame();
  if (!f) return -1;
  const v = ctx.view(), cs = f.corners.map((q) => v.toScreen(q)), hs = frameHandles(cs);
  for (let i = 0; i < 8; i++) if (Math.abs(p.screen.x - hs[i].x) <= 5 && Math.abs(p.screen.y - hs[i].y) <= 5) return i;
  for (const i of [0, 2, 4, 6]) if (Math.hypot(p.screen.x - hs[i].x, p.screen.y - hs[i].y) <= 18 && pointInPolygon(p.screen, cs) === 0) return 100 + i;
  return -1;
}

type Frame = NonNullable<ReturnType<Engine['selectionFrame']>>;
interface Drag { mode: 'move' | 'scale' | 'rotate' | 'marquee' | null; start: Pt; cur: Pt; ids: string[]; box: Rect | null; frame: Frame | null; handle: number; moved: boolean; copyIds: string[] | null; info: string[] }
export const newDrag = (): Drag => ({ mode: null, start: { x: 0, y: 0 }, cur: { x: 0, y: 0 }, ids: [], box: null, frame: null, handle: -1, moved: false, copyIds: null, info: [] });

export function beginTransform(ctx: ToolContext, S: Drag, p: ToolPointer, mode: 'move' | 'scale' | 'rotate', handle = -1): void {
  const e = ctx.engine;
  S.mode = mode; S.start = p.doc; S.cur = p.doc; S.moved = false; S.copyIds = null; S.handle = handle;
  S.ids = e.targetIds(); S.box = e.selectionBounds(false); S.frame = e.selectionFrame();
  e.beginDrag(mode === 'move' ? 'Move' : mode === 'scale' ? 'Scale' : 'Rotate');
}

export function dragTransform(ctx: ToolContext, S: Drag, p: ToolPointer): void {
  const e = ctx.engine, origin = e.dragOrigin, b = S.box;
  S.cur = p.doc;
  if (!origin || !b) return;
  const v = ctx.view();
  if (!S.moved && Math.hypot(p.doc.x - S.start.x, p.doc.y - S.start.y) * v.zoom < 3) return;
  S.moved = true;
  if (S.mode === 'move') {
    const q = p.shift ? constrainAngle(S.start, p.doc) : p.doc;
    let dx = q.x - S.start.x, dy = q.y - S.start.y;
    if (!p.shift) { const s = ctx.snapRect({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h }, new Set(S.ids)); dx += s.dx; dy += s.dy; }
    const r = transformNodes(origin, S.ids, translate(dx, dy), p.alt, xf(e));
    S.copyIds = p.alt ? r.ids : null;
    e.dragTo(r.doc);
    S.info = [`dX: ${unitLabel(e, dx)}`, `dY: ${unitLabel(e, dy)}`];
  } else if (S.mode === 'scale') {
    const a = S.frame?.angle ?? 0, r = S.frame?.local ?? b, toLocal = rotateAbout(-a, 0, 0), toDoc = rotateAbout(a, 0, 0);
    const i = S.handle, hs = boxHandles(r), h = hs[i], o = p.alt ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : hs[(i + 4) % 8];
    const qd = ctx.snap(p.doc, new Set(S.ids)).p, q = apply(toLocal, qd.x, qd.y);
    let sx = i === 1 || i === 5 ? 1 : (q.x - o.x) / (Math.abs(h.x - o.x) > 1e-9 ? h.x - o.x : 1e-9);
    let sy = i === 3 || i === 7 ? 1 : (q.y - o.y) / (Math.abs(h.y - o.y) > 1e-9 ? h.y - o.y : 1e-9);
    if (p.shift) {
      if (i % 2 === 0) { const s = Math.max(Math.abs(sx), Math.abs(sy)); sx = Math.sign(sx || 1) * s; sy = Math.sign(sy || 1) * s; }
      else if (i === 1 || i === 5) sx = Math.abs(sy);
      else sy = Math.abs(sx);
    }
    const lim = (s: number): number => (Math.abs(s) < 1e-3 ? (s < 0 ? -1e-3 : 1e-3) : s);
    sx = lim(sx); sy = lim(sy);
    e.dragTo(transformNodes(origin, S.ids, mul(toDoc, mul(scaleAbout(sx, sy, o.x, o.y), toLocal)), false, xf(e)).doc);
    S.info = [`W: ${unitLabel(e, r.w * Math.abs(sx))}`, `H: ${unitLabel(e, r.h * Math.abs(sy))}`];
  } else if (S.mode === 'rotate') {
    const fc = S.frame?.corners, c = fc ? { x: (fc[0].x + fc[2].x) / 2, y: (fc[0].y + fc[2].y) / 2 } : { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    let deg = ((Math.atan2(p.doc.y - c.y, p.doc.x - c.x) - Math.atan2(S.start.y - c.y, S.start.x - c.x)) * 180) / Math.PI;
    if (p.shift) deg = Math.round(deg / 45) * 45;
    e.dragTo(transformNodes(origin, S.ids, rotateAbout(deg, c.x, c.y), p.alt, xf(e)).doc);
    S.info = [`${fmt((((-deg % 360) + 540) % 360) - 180)}°`];
  }
}

export function endTransform(ctx: ToolContext, S: Drag): void {
  const e = ctx.engine;
  if (e.dragging) { if (!S.moved) e.cancelDrag(); else e.commitDrag(S.copyIds ?? undefined); }
  S.mode = null; S.info = [];
}

const S = newDrag();
let hover: string | null = null;
const L = { id: null as string | null, drag: false, start: { x: 0, y: 0 }, cur: { x: 0, y: 0 } };

function outPortAt(ctx: ToolContext, p: ToolPointer): string | null {
  const e = ctx.engine, pr = e.current;
  if (!pr || !e.view.edges) return null;
  const v = ctx.view();
  for (const id of pr.selection) {
    const n = findNode(pr.doc, id);
    if (n?.kind !== 'text' || n.mode !== 'area' || !n.frame) continue;
    const s = v.toScreen(framePort(n, true));
    if (Math.abs(p.screen.x - s.x) <= 6 && Math.abs(p.screen.y - (s.y - 10)) <= 6) return n.id;
  }
  return null;
}

function placeLoaded(ctx: ToolContext, p: ToolPointer): void {
  const e = ctx.engine, pr = e.current, from = L.id ? findNode(pr?.doc as Doc, L.id) : null;
  L.id = null; L.drag = false;
  if (!pr || from?.kind !== 'text' || !from.frame) return;
  const hit = e.hit(p.doc), target = hit ? findNode(pr.doc, e.selectableFor(hit.id)) : null;
  if (target && target.id !== from.id && (target.kind === 'path' || target.kind === 'compound' || (target.kind === 'text' && target.mode === 'area'))) { e.threadText([from.id, target.id]); return; }
  const r = normRect(L.start.x, L.start.y, p.doc.x, p.doc.y), z = ctx.view().zoom;
  const box = r.w * z > 6 && r.h * z > 6 ? r : { x: p.doc.x, y: p.doc.y, w: from.frame.w, h: from.frame.h };
  e.beginGesture();
  const id = e.addText('', box.x, box.y, { mode: 'area', width: box.w, height: box.h, style: from.spans[0]?.style, para: from.para });
  if (id) e.threadText([from.id, id]);
  e.endGesture();
}

type BracketKind = 'start' | 'end' | 'centre';
const BR = { on: false, id: '', kind: 'start' as BracketKind, moved: false, u0: 0, start0: 0, end0: 1, flip0: false };

function bracketAt(ctx: ToolContext, p: ToolPointer): { id: string; kind: BracketKind } | null {
  const e = ctx.engine, pr = e.current;
  if (!pr || !e.view.edges) return null;
  const v = ctx.view();
  for (const id of pr.selection) {
    const n = findNode(pr.doc, id);
    if (n?.kind !== 'text' || n.mode !== 'path') continue;
    const br = pathBrackets(n);
    if (!br) continue;
    const parts: Array<[BracketKind, { p: Pt; t: Pt }, number, number]> = [['start', br.start, 0, 16], ['end', br.end, 0, 16], ['centre', br.centre, -10, 10]];
    for (const [kind, b, a0, a1] of parts) {
      const s = v.toScreen(b.p), nx = -b.t.y, ny = b.t.x, ax = s.x - nx * a0, ay = s.y - ny * a0, bx = s.x - nx * a1, by = s.y - ny * a1;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((p.screen.x - ax) * dx + (p.screen.y - ay) * dy) / l2));
      if (Math.hypot(p.screen.x - (ax + dx * k), p.screen.y - (ay + dy * k)) <= 5) return { id, kind };
    }
  }
  return null;
}

function bracketDown(ctx: ToolContext, p: ToolPointer): boolean {
  const e = ctx.engine, pr = e.current, hit = bracketAt(ctx, p);
  const n = hit && pr ? findNode(pr.doc, hit.id) : null;
  if (!hit || n?.kind !== 'text') return false;
  const at = pathParamAt(n, p.doc);
  Object.assign(BR, { on: true, id: hit.id, kind: hit.kind, moved: false, u0: at?.u ?? 0, start0: n.pathStart ?? 0, end0: n.pathEnd ?? 1, flip0: !!n.pathFlip });
  e.beginDrag(hit.kind === 'centre' ? 'Move Type on a Path' : 'Type on a Path Range');
  return true;
}

function bracketMove(ctx: ToolContext, p: ToolPointer): void {
  const e = ctx.engine, base = e.dragOrigin, n0 = base ? findNode(base, BR.id) : null;
  if (!base || n0?.kind !== 'text') return;
  const at = pathParamAt(n0, p.doc);
  if (!at) return;
  const closed = !!n0.path?.[0]?.closed, gap = 0.01;
  let start = BR.start0, end = BR.end0, flip = BR.flip0;
  if (BR.kind === 'start') start = closed ? at.u : Math.min(at.u, end - gap);
  else if (BR.kind === 'end') end = closed ? at.u : Math.max(at.u, start + gap);
  else {
    let du = at.u - BR.u0;
    if (closed) { du -= Math.round(du); start = ((start + du) % 1 + 1) % 1; end = ((end + du) % 1 + 1) % 1; }
    else { du = Math.max(-start, Math.min(1 - end, du)); start += du; end += du; }
    const textSide = BR.flip0 ? 1 : -1;
    if (at.side === -textSide && at.d * ctx.view().zoom > 4) flip = !BR.flip0;
  }
  BR.moved = true;
  e.dragTo(updateNodes(base, [BR.id], (x) => (x.kind === 'text' ? { ...x, pathStart: start, pathEnd: end, pathFlip: flip || undefined } : x)));
}

function bracketUp(ctx: ToolContext): void {
  const e = ctx.engine;
  BR.on = false;
  if (e.dragging) { if (BR.moved) e.commitDrag(); else e.cancelDrag(); }
}

const BH = { at: null as Pt | null, skip: new Set<string>() };
interface Widget { id: string; at: Pt; corner: number; dir: Pt; origin: Pt; xf: Mat; k: number; max: number }
const CW = { on: false, w: null as Widget | null, moved: false };

function cornerWidgets(ctx: ToolContext): Widget[] {
  const e = ctx.engine, pr = e.current;
  if (!pr || !e.view.cornerWidget || pr.selection.size !== 1 || pr.anchors.size) return [];
  const n = findNode(pr.doc, [...pr.selection][0]);
  if (n?.kind !== 'path' || !n.live || (n.live.kind !== 'rect' && n.live.kind !== 'polygon')) return [];
  const l = normalizeLive(n.live) as Extract<LiveShape, { kind: 'rect' | 'polygon' }>, zoom = ctx.view().zoom, min = 14 / zoom;
  if (l.kind === 'rect') {
    const cs: Array<[number, number, number, number]> = [[l.x, l.y, 1, 1], [l.x + l.w, l.y, -1, 1], [l.x + l.w, l.y + l.h, -1, -1], [l.x, l.y + l.h, 1, -1]];
    if (Math.min(Math.abs(l.w), Math.abs(l.h)) * zoom < 40) return [];
    return cs.map(([cx, cy, sx, sy], i) => { const d = Math.max(l.radii[i], min); return { id: n.id, at: apply(l.xf, cx + sx * d, cy + sy * d), corner: i, dir: { x: sx / Math.SQRT2, y: sy / Math.SQRT2 }, origin: { x: cx, y: cy }, xf: l.xf, k: Math.SQRT2, max: Math.min(Math.abs(l.w), Math.abs(l.h)) / 2 }; });
  }
  if (l.r * zoom < 24) return [];
  const half = Math.PI / l.sides, sinH = Math.cos(half), a = -Math.PI / 2, vx = l.cx + l.r * Math.cos(a), vy = l.cy + l.r * Math.sin(a), dir = { x: -Math.cos(a), y: -Math.sin(a) }, d = Math.max(l.radius, min) / sinH;
  return [{ id: n.id, at: apply(l.xf, vx + dir.x * d, vy + dir.y * d), corner: -1, dir, origin: { x: vx, y: vy }, xf: l.xf, k: 1 / sinH, max: l.r * Math.cos(half) }];
}

function widgetAt(ctx: ToolContext, p: ToolPointer): Widget | null {
  const v = ctx.view();
  for (const w of cornerWidgets(ctx)) { const s = v.toScreen(w.at); if (Math.hypot(s.x - p.screen.x, s.y - p.screen.y) <= 6) return w; }
  return null;
}

function dragWidget(ctx: ToolContext, p: ToolPointer): void {
  const e = ctx.engine, base = e.dragOrigin, w = CW.w;
  if (!base || !w) return;
  const q = apply(invert(w.xf), p.doc.x, p.doc.y), along = (q.x - w.origin.x) * w.dir.x + (q.y - w.origin.y) * w.dir.y;
  const r = Math.max(0, Math.min(w.max, along / w.k));
  CW.moved = true;
  e.dragTo(updateNodes(base, [w.id], (n) => {
    if (n.kind !== 'path' || !n.live) return n;
    if (n.live.kind === 'rect' && p.alt) { const l = normalizeLive(n.live) as Extract<LiveShape, { kind: 'rect' }>; const radii = [...l.radii] as [number, number, number, number]; radii[w.corner] = r; return editLive(n, { radii }); }
    return editLive(n, { radius: r });
  }));
  e.setOverlay({ label: `Radius: ${unitLabel(e, r)}`, at: p.doc, lines: [] });
}

registerTool({
  id: 'selection', label: 'Selection Tool', group: 'select', order: 10, shortcut: 'V',
  icon: () => 'vSelect',
  hint: () => `Click or drag a marquee to select; ${isMac ? 'Cmd' : 'Ctrl'}-click again to select the object behind. Drag to move, Alt-drag to copy, Shift to constrain. Drag a handle to scale, just outside a corner to rotate, a corner widget to round corners. Double-click a group to isolate it.`,
  cursor: (ctx, p) => {
    if (L.id) return CURSORS.loadedText;
    if (!p) return CURSORS.select;
    const h = handleAt(ctx, p);
    if (h >= 100) return CURSORS.rotate;
    if (h >= 0) return cursorFor(h);
    return p.alt && hover ? CURSORS.selectCopy : CURSORS.select;
  },
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    if (L.id) { L.drag = true; L.start = p.doc; L.cur = p.doc; return; }
    if (bracketDown(ctx, p)) return;
    const port = outPortAt(ctx, p);
    if (port) { L.id = port; ctx.redraw(); return; }
    const wdg = widgetAt(ctx, p);
    if (wdg) { CW.on = true; CW.w = wdg; CW.moved = false; e.beginDrag('Corner Radius'); return; }
    const h = handleAt(ctx, p);
    if (h >= 0) { beginTransform(ctx, S, p, h >= 100 ? 'rotate' : 'scale', h % 100); return; }
    if (p.mod && !p.shift) {
      if (!BH.at || Math.hypot(BH.at.x - p.doc.x, BH.at.y - p.doc.y) * ctx.view().zoom > 4) BH.skip = new Set();
      BH.at = p.doc;
      if (e.selectBehind(p.doc, BH.skip)) beginTransform(ctx, S, p, 'move');
      return;
    }
    const hit = e.hit(p.doc);
    if (hit) {
      const id = e.selectableFor(hit.id);
      if (p.shift) { const was = pr.selection.has(id); e.select([id], 'toggle'); if (was) return; }
      else if (!pr.selection.has(id)) e.select([id]);
      beginTransform(ctx, S, p, 'move');
      return;
    }
    if (!p.shift) e.deselect();
    S.mode = 'marquee'; S.start = p.doc; S.cur = p.doc;
  },
  move: (ctx, p) => {
    if (BR.on) { bracketMove(ctx, p); return; }
    if (CW.on) { dragWidget(ctx, p); return; }
    if (L.drag) { L.cur = p.doc; ctx.redraw(); return; }
    if (S.mode === 'marquee') { S.cur = p.doc; ctx.redraw(); return; }
    dragTransform(ctx, S, p);
  },
  up: (ctx, p) => {
    const e = ctx.engine;
    if (BR.on) { bracketUp(ctx); return; }
    if (CW.on) { CW.on = false; CW.w = null; e.clearOverlay(); if (CW.moved) e.commitDrag(); else e.cancelDrag(); return; }
    if (L.drag) { placeLoaded(ctx, p); ctx.redraw(); return; }
    if (S.mode === 'marquee') {
      const r = normRect(S.start.x, S.start.y, p.doc.x, p.doc.y), z = ctx.view().zoom;
      S.mode = null;
      if (r.w * z > 2 || r.h * z > 2) e.selectInRect(r, p.shift ? 'toggle' : 'replace', false);
      ctx.redraw();
      return;
    }
    endTransform(ctx, S);
  },
  cancel: (ctx) => { if (ctx.engine.dragging) ctx.engine.cancelDrag(); S.mode = null; L.id = null; L.drag = false; BR.on = false; ctx.redraw(); },
  deactivate: () => { L.id = null; L.drag = false; },
  hover: (ctx, p) => {
    const next = p && ctx.engine.view.smartGuides ? (() => { const h = ctx.engine.hit(p.doc); return h ? ctx.engine.selectableFor(h.id) : null; })() : null;
    if (next !== hover) { hover = next; ctx.redraw(); }
  },
  dblclick: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const hit = e.hit(p.doc);
    if (!hit) { if (pr.isolation) e.isolate(null); return; }
    const leaf = findNode(pr.doc, hit.id);
    if (leaf?.kind === 'text') { e.setTool('type'); ctx.typeAt({ id: leaf.id, x: p.doc.x, y: p.doc.y }); return; }
    const top = findNode(pr.doc, e.selectableFor(hit.id));
    if (top && top.kind === 'group') e.isolate(top.id);
  },
  overlay: (ctx, g) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    if (!S.mode && !L.id) {
      const v = ctx.view(), color = pr.selection.size ? layerColor(e, [...pr.selection][0]) : ctx.paint().accent;
      for (const w of cornerWidgets(ctx)) { const s = v.toScreen(w.at); g.save(); g.beginPath(); g.arc(s.x, s.y, 4, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1; g.strokeStyle = color; g.stroke(); g.beginPath(); g.arc(s.x, s.y, 1.5, 0, Math.PI * 2); g.fillStyle = color; g.fill(); g.restore(); }
    }
    if (L.drag) marquee(ctx, g, L.start, L.cur);
    else if (S.mode === 'marquee') marquee(ctx, g, S.start, S.cur);
    else if (!S.mode && hover && !pr.selection.has(hover)) { const n = findNode(pr.doc, hover); if (n) outlineNode(ctx, g, pr.doc, n, layerColor(e, hover), 1.5); }
    if (S.mode && S.moved) hud(ctx, g, ctx.view().toScreen(S.cur), S.info);
  },
});

function leafPaths(n: VNode): Array<{ id: string; d: PathData }> {
  if (n.kind === 'path') return [{ id: n.id, d: n.d }];
  if (n.kind === 'compound') return n.children.map((c) => ({ id: c.id, d: c.d }));
  if (n.kind === 'text' && n.mode === 'path' && n.path) return [{ id: n.id, d: n.path }];
  if (n.kind === 'group' || n.kind === 'blend') return n.children.flatMap(leafPaths);
  return [];
}

function selectedLeaves(e: Engine): VNode[] {
  const pr = e.current;
  if (!pr) return [];
  const out: VNode[] = [];
  const add = (n: VNode): void => { if (n.kind === 'path' || n.kind === 'compound' || n.kind === 'text') out.push(n); else if (n.kind === 'group' || n.kind === 'blend') n.children.forEach(add); };
  for (const id of pr.selection) { const n = findNode(pr.doc, id); if (n) add(n); }
  return out;
}

function pathDataOf(n: VNode): PathData | null { return n.kind === 'path' ? n.d : n.kind === 'text' && n.mode === 'path' && n.path ? n.path : null; }

function withPath(n: VNode, d: PathData): VNode {
  if (n.kind === 'path') return { ...n, d, live: undefined };
  if (n.kind === 'text' && n.mode === 'path') return { ...n, path: d };
  return n;
}

function mapAnchors(d: PathData, pick: (idx: number) => boolean, f: (a: Anchor) => Anchor): PathData {
  let k = 0;
  return d.map((sp) => ({ ...sp, pts: sp.pts.map((a) => (pick(k++) ? f(a) : a)) }));
}

const shift = (a: Anchor, dx: number, dy: number): Anchor => ({ ...a, x: a.x + dx, y: a.y + dy, ix: a.ix + dx, iy: a.iy + dy, ox: a.ox + dx, oy: a.oy + dy });

function anchorAt(d: PathData, idx: number): Anchor | null { const u = unflatIndex(d, idx); return u ? d[u[0]].pts[u[1]] : null; }

function collinear(a: Anchor): boolean {
  if (!hasIn(a) || !hasOut(a)) return false;
  const ix = a.ix - a.x, iy = a.iy - a.y, ox = a.ox - a.x, oy = a.oy - a.y;
  const li = Math.hypot(ix, iy), lo = Math.hypot(ox, oy);
  return Math.abs(ix * oy - iy * ox) / (li * lo) < 0.02 && ix * ox + iy * oy < 0;
}

function leafChild(doc: Doc, id: string, p: Pt): string {
  const n = findNode(doc, id);
  if (n?.kind !== 'compound') return id;
  let best = n.children[0]?.id ?? id, bd = Infinity;
  for (const c of n.children) { const r = nearestOnPath(c.d, p); if (r && r.d < bd) { bd = r.d; best = c.id; } }
  return best;
}

interface DState { mode: 'anchors' | 'handle' | 'segment' | 'marquee' | 'lasso' | null; start: Pt; cur: Pt; grab: Pt; path: string; idx: number; part: 'in' | 'out'; seg: { sub: number; seg: number; t: number } | null; moved: boolean; lasso: Pt[] }
const D: DState = { mode: null, start: { x: 0, y: 0 }, cur: { x: 0, y: 0 }, grab: { x: 0, y: 0 }, path: '', idx: 0, part: 'out', seg: null, moved: false, lasso: [] };
let hoverLeaf: string | null = null;
let hoverAnchor = false;

export const EP = { id: '', idx: -1, handle: -1, on: false, moved: false, start: { x: 0, y: 0 }, mesh: null as MeshSpec | null, frame: null as Rect | null };

function envelopeTargets(e: Engine): EnvelopeNode[] {
  const pr = e.current;
  if (!pr) return [];
  return [...pr.selection].map((id) => findNode(pr.doc, id)).filter((n): n is EnvelopeNode => n?.kind === 'envelope' && !n.editContents);
}

export function envelopePointHit(ctx: ToolContext, p: ToolPointer): { n: EnvelopeNode; s: MeshSpec; idx: number; handle: number } | null {
  const e = ctx.engine, pr = e.current;
  if (!pr) return null;
  const tol = tolDoc(ctx, 5);
  for (const n of envelopeTargets(e).reverse()) {
    const s = e.envelopeMesh(pr.doc, n);
    if (EP.id === n.id && EP.idx >= 0 && EP.idx < s.points.length) { const h = meshHandleAt(s, EP.idx, p.doc, tol); if (h >= 0) return { n, s, idx: EP.idx, handle: h }; }
    const i = meshPointAt(s, p.doc, tol);
    if (i >= 0) return { n, s, idx: i, handle: -1 };
  }
  return null;
}

export function envelopeDown(ctx: ToolContext, p: ToolPointer): boolean {
  const e = ctx.engine, pr = e.current, h = envelopePointHit(ctx, p);
  if (!pr || !h) return false;
  Object.assign(EP, { id: h.n.id, idx: h.idx, handle: h.handle, on: true, moved: false, start: p.doc, mesh: h.s, frame: envelopeFrame(pr.doc, h.n) });
  e.beginDrag(h.handle >= 0 ? 'Move Envelope Handle' : 'Move Envelope Point');
  ctx.redraw();
  return true;
}

export function envelopeMove(ctx: ToolContext, p: ToolPointer): boolean {
  if (!EP.on) return false;
  const e = ctx.engine, origin = e.dragOrigin, n = origin ? findNode(origin, EP.id) : null;
  if (!origin || n?.kind !== 'envelope' || !EP.mesh || !EP.frame) return true;
  if (!EP.moved && Math.hypot(p.doc.x - EP.start.x, p.doc.y - EP.start.y) * ctx.view().zoom < 2) return true;
  EP.moved = true;
  const P = EP.mesh.points[EP.idx];
  let spec: MeshSpec;
  if (EP.handle >= 0) spec = withMeshHandle(EP.mesh, EP.idx, EP.handle, p.doc, p.shift);
  else {
    const q = p.shift ? constrainAngle(EP.start, p.doc) : p.doc, want = { x: P.x + q.x - EP.start.x, y: P.y + q.y - EP.start.y };
    spec = withMeshPoint(EP.mesh, EP.idx, p.shift ? want : ctx.snap(want, new Set([EP.id])).p);
  }
  e.dragTo(replaceNode(origin, EP.id, { ...n, frame: EP.frame, spec }));
  return true;
}

export function envelopeUp(ctx: ToolContext): boolean {
  if (!EP.on) return false;
  const e = ctx.engine;
  EP.on = false; EP.mesh = null;
  if (EP.moved) e.commitDrag(); else e.cancelDrag();
  ctx.redraw();
  return true;
}

export function envelopeOverlay(ctx: ToolContext, g: CanvasRenderingContext2D): void {
  const e = ctx.engine, pr = e.current;
  if (!pr) return;
  const v = ctx.view();
  for (const n of envelopeTargets(e)) {
    const s = e.envelopeMesh(pr.doc, n), color = layerColor(e, n.id);
    g.save(); g.strokeStyle = color; g.lineWidth = 1;
    s.points.forEach((q, i) => { const sc = v.toScreen(q), on = EP.id === n.id && EP.idx === i; g.fillStyle = on ? color : '#fff'; g.fillRect(Math.round(sc.x - 3), Math.round(sc.y - 3), 6, 6); g.strokeRect(Math.round(sc.x - 3) + 0.5, Math.round(sc.y - 3) + 0.5, 5, 5); });
    if (EP.id === n.id && EP.idx >= 0 && EP.idx < s.points.length) {
      const q = s.points[EP.idx], sc = v.toScreen(q);
      for (const hh of meshHandles(s)[EP.idx]) {
        if (Math.hypot(hh.x, hh.y) < 1e-6) continue;
        const t = v.toScreen({ x: q.x + hh.x, y: q.y + hh.y });
        g.beginPath(); g.moveTo(sc.x, sc.y); g.lineTo(t.x, t.y); g.stroke();
        g.beginPath(); g.arc(t.x, t.y, 3, 0, Math.PI * 2); g.fillStyle = color; g.fill();
      }
    }
    g.restore();
  }
}

function directDown(ctx: ToolContext, p: ToolPointer, groupMode: boolean): void {
  const e = ctx.engine, pr = e.current;
  if (!pr) return;
  if (!groupMode && envelopeDown(ctx, p)) return;
  const doc = pr.doc, t = tolDoc(ctx, 5);
  D.start = D.cur = p.doc; D.moved = false;
  const hit = e.hit(p.doc, 5);
  const leaf = hit ? findNode(doc, hit.id) : null;
  if (!groupMode) {
    const cands = [...(leaf ? [leaf] : []), ...selectedLeaves(e)];
    const ah = anchorHit(doc, cands, p.doc, t, (id) => pr.anchors.get(id) ?? null);
    if (ah) {
      const node = findNode(doc, ah.id), d = node ? pathDataOf(node) : null, a = d ? anchorAt(d, ah.index) : null;
      if (ah.part !== 'anchor') { D.mode = 'handle'; D.path = ah.id; D.idx = ah.index; D.part = ah.part; e.beginDrag('Move Handle'); return; }
      const cur = pr.anchors.get(ah.id);
      if (p.shift) {
        const s = new Set(cur ?? []); s.delete(-1);
        const removing = s.has(ah.index);
        if (removing) s.delete(ah.index); else s.add(ah.index);
        e.select([ah.id], 'add');
        e.setAnchors(ah.id, s.size ? s : new Set([-2]));
        if (removing) return;
      } else if (!cur || !(cur.has(ah.index) || cur.has(-1))) { e.select([ah.id]); e.setAnchors(ah.id, new Set([ah.index])); }
      D.mode = 'anchors'; D.grab = a ? { x: a.x, y: a.y } : p.doc; e.beginDrag('Move');
      return;
    }
  }
  if (hit && leaf) {
    const id = groupMode ? groupPick(e, hit.chain) : leafChild(doc, hit.id, p.doc), node = findNode(doc, id);
    const d = node ? pathDataOf(node) : null;
    const sh = !groupMode && d && hit.part !== 'fill' ? segmentHit(d, p.doc, t) : null;
    if (sh && d) {
      const s0 = flatIndex(d, sh.sub, sh.seg), n = d[sh.sub].pts.length, s1 = flatIndex(d, sh.sub, (sh.seg + 1) % n);
      e.select([id], p.shift ? 'add' : 'replace');
      e.setAnchors(id, new Set([-2]));
      D.mode = 'segment'; D.path = id; D.seg = { sub: sh.sub, seg: sh.seg, t: sh.t }; D.idx = s0; D.grab = sh.pt;
      void s1;
      e.beginDrag('Reshape');
      return;
    }
    if (p.shift && pr.selection.has(id)) { e.select([id], 'subtract'); return; }
    e.select([id], p.shift ? 'add' : groupMode && pr.selection.size && hit.chain.some((c) => pr.selection.has(c)) ? 'add' : 'replace');
    if (!groupMode) e.setAnchors(id, new Set([-1]));
    D.mode = 'anchors'; D.grab = p.doc;
    if (groupMode) { e.clearAnchors(); D.mode = null; beginTransform(ctx, G, p, 'move'); return; }
    e.beginDrag('Move');
    return;
  }
  if (!p.shift) e.deselect();
  D.mode = 'marquee';
}

function groupPick(e: Engine, chain: string[]): string {
  const pr = e.current;
  if (!pr) return chain[chain.length - 1];
  const objs = chain.filter((id) => findNode(pr.doc, id)?.kind !== 'layer');
  let k = objs.length - 1;
  while (k >= 0 && !pr.selection.has(objs[k])) k--;
  if (k < 0) return objs[objs.length - 1];
  return objs[Math.max(0, k - 1)];
}

function directMove(ctx: ToolContext, p: ToolPointer): void {
  if (envelopeMove(ctx, p)) return;
  const e = ctx.engine, pr = e.current, origin = e.dragOrigin;
  D.cur = p.doc;
  if (D.mode === 'marquee') { ctx.redraw(); return; }
  if (D.mode === 'lasso') { D.lasso.push(p.doc); ctx.redraw(); return; }
  if (!pr || !origin) return;
  if (!D.moved && Math.hypot(p.doc.x - D.start.x, p.doc.y - D.start.y) * ctx.view().zoom < 2) return;
  D.moved = true;
  if (D.mode === 'anchors') {
    const q0 = p.shift ? constrainAngle(D.start, p.doc) : p.doc;
    let dx = q0.x - D.start.x, dy = q0.y - D.start.y;
    if (!p.shift) { const s = ctx.snap({ x: D.grab.x + dx, y: D.grab.y + dy }, new Set(pr.anchors.keys())); dx = s.p.x - D.grab.x; dy = s.p.y - D.grab.y; }
    let doc = origin;
    for (const [id, set] of pr.anchors) {
      if (set.has(-2)) continue;
      const n = findNode(doc, id);
      if (!n) continue;
      const d = pathDataOf(n);
      if (d) doc = updateLeaf(doc, id, withPath(n, mapAnchors(d, (k) => set.has(-1) || set.has(k), (a) => shift(a, dx, dy))));
      else doc = transformNodes(doc, [id], translate(dx, dy), false, xf(e)).doc;
    }
    e.dragTo(doc);
  } else if (D.mode === 'handle') {
    const n = findNode(origin, D.path), d = n ? pathDataOf(n) : null;
    if (!n || !d) return;
    const q = ctx.snap(p.doc, new Set([D.path])).p;
    const nd = mapAnchors(d, (k) => k === D.idx, (a) => {
      const keep = !p.alt && (a.smooth !== false) && collinear(a);
      if (D.part === 'out') {
        const out = { ...a, ox: q.x, oy: q.y };
        if (!keep) return { ...out, smooth: p.alt ? false : a.smooth };
        const li = Math.hypot(a.ix - a.x, a.iy - a.y), dx = a.x - q.x, dy = a.y - q.y, l = Math.hypot(dx, dy) || 1;
        return { ...out, ix: a.x + (dx / l) * li, iy: a.y + (dy / l) * li };
      }
      const inn = { ...a, ix: q.x, iy: q.y };
      if (!keep) return { ...inn, smooth: p.alt ? false : a.smooth };
      const lo = Math.hypot(a.ox - a.x, a.oy - a.y), dx = a.x - q.x, dy = a.y - q.y, l = Math.hypot(dx, dy) || 1;
      return { ...inn, ox: a.x + (dx / l) * lo, oy: a.y + (dy / l) * lo };
    });
    e.dragTo(updateLeaf(origin, D.path, withPath(n, nd)));
  } else if (D.mode === 'segment' && D.seg) {
    const n = findNode(origin, D.path), d = n ? pathDataOf(n) : null;
    if (!n || !d) return;
    const dx = p.doc.x - D.start.x, dy = p.doc.y - D.start.y, sp = d[D.seg.sub], i0 = D.seg.seg, i1 = (i0 + 1) % sp.pts.length;
    const a = sp.pts[i0], b = sp.pts[i1], line = !hasOut(a) && !hasIn(b);
    const pts = sp.pts.slice();
    if (line) { pts[i0] = shift(a, dx, dy); pts[i1] = shift(b, dx, dy); }
    else {
      const t = D.seg.t, b1 = 3 * (1 - t) * (1 - t) * t, b2 = 3 * (1 - t) * t * t, k = 1 / Math.max(1e-6, b1 * b1 + b2 * b2);
      pts[i0] = { ...a, ox: a.ox + dx * b1 * k, oy: a.oy + dy * b1 * k, smooth: false };
      pts[i1] = { ...b, ix: b.ix + dx * b2 * k, iy: b.iy + dy * b2 * k, smooth: false };
    }
    e.dragTo(updateLeaf(origin, D.path, withPath(n, d.map((s, k) => (k === D.seg?.sub ? { ...s, pts } : s)))));
  }
}

function updateLeaf(doc: Doc, id: string, n: VNode): Doc {
  const idx = findNode(doc, id);
  if (!idx) return doc;
  return replaceNode(doc, id, n);
}

function replaceNode(doc: Doc, id: string, rep: VNode): Doc {
  const visit = (nodes: VNode[]): VNode[] | null => {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.id === id) { const out = nodes.slice(); out[i] = rep; return out; }
      const ch = 'children' in n ? (n.children as VNode[]) : null;
      if (ch) { const r = visit(ch); if (r) { const out = nodes.slice(); out[i] = { ...n, children: r } as VNode; return out; } }
    }
    return null;
  };
  const layers = visit(doc.layers);
  return layers ? { ...doc, layers: layers as Doc['layers'] } : doc;
}

function selectAnchorsWhere(e: Engine, inside: (p: Pt) => boolean, add: boolean): void {
  const pr = e.current;
  if (!pr) return;
  const found = new Map<string, Set<number>>();
  for (const n of allNodes(pr.doc)) {
    if (n.kind === 'layer' || !isVisible(pr.doc, n.id) || isLocked(pr.doc, n.id)) continue;
    const d = pathDataOf(n);
    if (!d) continue;
    const s = new Set<number>();
    let k = 0;
    for (const sp of d) for (const a of sp.pts) { if (inside(a)) s.add(k); k++; }
    if (s.size) found.set(n.id, s.size === k ? new Set([-1]) : s);
  }
  if (!found.size) { if (!add) e.deselect(); return; }
  e.select([...found.keys()], add ? 'add' : 'replace');
  for (const [id, s] of found) e.setAnchors(id, s);
}

function directUp(ctx: ToolContext, p: ToolPointer): void {
  if (envelopeUp(ctx)) return;
  const e = ctx.engine;
  if (D.mode === 'marquee') {
    const r = normRect(D.start.x, D.start.y, p.doc.x, p.doc.y), z = ctx.view().zoom;
    D.mode = null;
    if (r.w * z > 2 || r.h * z > 2) selectAnchorsWhere(e, (a) => rectContains(r, a), p.shift);
    ctx.redraw();
    return;
  }
  if (D.mode === 'lasso') {
    const poly = D.lasso;
    D.mode = null; D.lasso = [];
    if (poly.length > 2) selectAnchorsWhere(e, (a) => pointInPolygon(a, poly) !== 0, p.shift);
    ctx.redraw();
    return;
  }
  if (e.dragging) { if (D.moved) e.commitDrag(); else e.cancelDrag(); }
  D.mode = null;
}

function directOverlay(ctx: ToolContext, g: CanvasRenderingContext2D): void {
  const e = ctx.engine, pr = e.current;
  if (!pr) return;
  envelopeOverlay(ctx, g);
  if (D.mode === 'marquee') marquee(ctx, g, D.start, D.cur);
  if (D.mode === 'lasso') { const v = ctx.view(); stroke2(g, D.lasso.map((q) => v.toScreen(q)), ctx.paint().accent, false); }
  if (!D.mode && hoverLeaf && !pr.selection.has(hoverLeaf)) {
    const n = findNode(pr.doc, hoverLeaf);
    if (n) {
      const color = layerColor(e, hoverLeaf), v = ctx.view();
      outlineNode(ctx, g, pr.doc, n, color, 1.5);
      for (const { d } of leafPaths(n)) for (const sp of d) for (const a of sp.pts) { const s = v.toScreen(a); g.fillStyle = '#fff'; g.strokeStyle = color; g.fillRect(Math.round(s.x - 2.5), Math.round(s.y - 2.5), 5, 5); g.strokeRect(Math.round(s.x - 2.5) + 0.5, Math.round(s.y - 2.5) + 0.5, 4, 4); }
    }
  }
}

function directHover(ctx: ToolContext, p: ToolPointer | null): void {
  const e = ctx.engine, pr = e.current;
  let next: string | null = null, onAnchor = false;
  if (p && pr) {
    const h = e.hit(p.doc, 5);
    if (h) next = leafChild(pr.doc, h.id, p.doc);
    const cands = [...(h ? [findNode(pr.doc, h.id) as VNode] : []), ...selectedLeaves(e)].filter(Boolean);
    onAnchor = !!anchorHit(pr.doc, cands, p.doc, tolDoc(ctx, 5), (id) => pr.anchors.get(id) ?? null) || !!envelopePointHit(ctx, p);
  }
  if (next !== hoverLeaf || onAnchor !== hoverAnchor) { hoverLeaf = next; hoverAnchor = onAnchor; ctx.redraw(); }
}

registerTool({
  id: 'direct', label: 'Direct Selection Tool', group: 'direct', order: 12, shortcut: 'A',
  icon: () => 'vDirect',
  hint: () => 'Click an anchor or segment to edit it, drag handles to reshape curves, Alt-drag a handle to break it. Drag a marquee to select anchors.',
  cursor: (_ctx, p) => (p && hoverAnchor ? CURSORS.directPoint : CURSORS.direct),
  down: (ctx, p) => { if (!bracketDown(ctx, p)) directDown(ctx, p, false); },
  move: (ctx, p) => { if (BR.on) bracketMove(ctx, p); else directMove(ctx, p); },
  up: (ctx, p) => { if (BR.on) bracketUp(ctx); else directUp(ctx, p); },
  hover: directHover,
  cancel: (ctx) => { if (ctx.engine.dragging) ctx.engine.cancelDrag(); D.mode = null; BR.on = false; EP.on = false; ctx.redraw(); },
  overlay: directOverlay,
});

const G = newDrag();
registerTool({
  id: 'groupSelect', label: 'Group Selection Tool', group: 'direct', order: 13,
  icon: () => 'vGroupSelect',
  hint: () => 'Click an object inside a group to select it; click again to add the group around it.',
  cursor: () => CURSORS.groupSelect,
  down: (ctx, p) => { D.mode = null; directDown(ctx, p, true); if (D.mode === 'marquee') { G.mode = null; } },
  move: (ctx, p) => { if (G.mode) dragTransform(ctx, G, p); else directMove(ctx, p); },
  up: (ctx, p) => {
    if (G.mode) { endTransform(ctx, G); return; }
    if (D.mode === 'marquee') { const r = normRect(D.start.x, D.start.y, p.doc.x, p.doc.y); D.mode = null; if (r.w * ctx.view().zoom > 2) ctx.engine.selectInRect(r, p.shift ? 'add' : 'replace', true); ctx.redraw(); return; }
    directUp(ctx, p);
  },
  overlay: (ctx, g) => { directOverlay(ctx, g); if (G.mode && G.moved) hud(ctx, g, ctx.view().toScreen(G.cur), G.info); },
});

export const wand = { fill: true, fillTol: 32, stroke: false, strokeTol: 32, weight: false, weightTol: 5, opacity: false, opacityTol: 5, blend: false };
registerTool({
  id: 'magicWand', label: 'Magic Wand Tool', group: 'wand', order: 14, shortcut: 'Y',
  icon: () => 'vMagicWand',
  hint: () => 'Click an object to select every object whose checked attributes are within tolerance of it. Shift adds, Alt subtracts.',
  cursor: () => CURSORS.select,
  options: (e) => {
    const set = (patch: Partial<typeof wand>): void => { Object.assign(wand, patch); e.emit('options', null); };
    return [
      { kind: 'title', text: 'Magic Wand' },
      { kind: 'toggle', label: 'Fill Color', get: () => wand.fill, set: (v) => set({ fill: v }) },
      { kind: 'number', label: 'Tolerance', min: 0, max: 255, step: 1, get: () => wand.fillTol, set: (v) => set({ fillTol: v }), when: () => wand.fill },
      { kind: 'toggle', label: 'Stroke Color', get: () => wand.stroke, set: (v) => set({ stroke: v }) },
      { kind: 'number', label: 'Tolerance', min: 0, max: 255, step: 1, get: () => wand.strokeTol, set: (v) => set({ strokeTol: v }), when: () => wand.stroke },
      { kind: 'toggle', label: 'Stroke Weight', get: () => wand.weight, set: (v) => set({ weight: v }) },
      { kind: 'number', label: 'Tolerance', min: 0, max: 1000, step: 0.5, unit: 'pt', get: () => wand.weightTol, set: (v) => set({ weightTol: v }), when: () => wand.weight },
      { kind: 'toggle', label: 'Opacity', get: () => wand.opacity, set: (v) => set({ opacity: v }) },
      { kind: 'number', label: 'Tolerance', min: 0, max: 100, step: 1, unit: '%', get: () => wand.opacityTol, set: (v) => set({ opacityTol: v }), when: () => wand.opacity },
      { kind: 'toggle', label: 'Blending Mode', get: () => wand.blend, set: (v) => set({ blend: v }) },
    ];
  },
  down: (ctx, p) => {
    const e = ctx.engine, h = e.hit(p.doc);
    if (!h) { if (!p.shift && !p.alt) e.deselect(); return; }
    const c = { fill: wand.fill ? wand.fillTol : null, stroke: wand.stroke ? wand.strokeTol : null, weight: wand.weight ? wand.weightTol : null, opacity: wand.opacity ? wand.opacityTol : null, blend: wand.blend };
    if (c.fill === null && c.stroke === null && c.weight === null && c.opacity === null && !c.blend) c.fill = wand.fillTol;
    e.selectSimilar(e.selectableFor(h.id), c, p.alt ? 'subtract' : p.shift ? 'add' : 'replace');
  },
});

registerTool({
  id: 'lasso', label: 'Lasso Tool', group: 'wand', order: 15, shortcut: 'Q',
  icon: () => 'vLasso',
  hint: () => 'Drag around anchor points to select them. Shift adds to the selection.',
  cursor: () => CURSORS.direct,
  down: (_ctx, p) => { D.mode = 'lasso'; D.lasso = [p.doc]; D.start = p.doc; },
  move: directMove,
  up: directUp,
  overlay: directOverlay,
});

export { replaceNode, fmt };
