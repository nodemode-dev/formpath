import { findNode, updateNodes } from '../engine/doc';
import { apply, invert, mul, normRect } from '../engine/geometry';
import { BLACK, NONE, solid } from '../engine/paint';
import { charStyleAt, glyphBaseMat, glyphBox, glyphMat, layoutText, plainText, touchSpans, type Glyph } from '../engine/text';
import type { CharTouch, Engine, Mat, Pt, Rect, TextNode } from '../engine';
import { registerTool, type OptionSpec, type ToolContext, type ToolPointer } from '../extensions/registry';
import { CURSORS } from '../ui/cursors';
import { typing } from '../ui/text-editor';
import { families, stylesOf } from '../io/fonts';
import { marquee, tolDoc } from './util';

const S = { on: false, start: { x: 0, y: 0 }, cur: { x: 0, y: 0 }, word: false };

function typeOptions(e: Engine): OptionSpec[] {
  const st = (): { font: string; style: string; size: number } => {
    const n = e.selected().find((x) => x.kind === 'text');
    const s = n?.kind === 'text' ? n.spans[0]?.style : null;
    return { font: s?.font ?? typeDefaults.font, style: s?.style ?? typeDefaults.style, size: s?.size ?? typeDefaults.size };
  };
  const apply = (patch: Partial<{ font: string; style: string; size: number }>): void => {
    Object.assign(typeDefaults, patch);
    const ed = typing.editor;
    if (e.selected().some((x) => x.kind === 'text')) e.setCharStyle(patch, undefined, ed?.range() ?? undefined);
    else e.emit('options', null);
  };
  return [
    { kind: 'title', text: 'Type' },
    { kind: 'select', label: 'Font', choices: [], live: () => families().map((f) => ({ id: f, label: f })), get: () => st().font, set: (v) => apply({ font: v }) },
    { kind: 'select', label: 'Style', choices: [], live: () => stylesOf(st().font).map((s) => ({ id: s, label: s })), get: () => st().style, set: (v) => apply({ style: v }) },
    { kind: 'number', label: 'Size', min: 0.1, max: 1296, step: 1, unit: 'pt', get: () => st().size, set: (v) => apply({ size: v }) },
    { kind: 'segment', label: 'Align', choices: [{ id: 'left', label: 'Left' }, { id: 'center', label: 'Center' }, { id: 'right', label: 'Right' }, { id: 'justify', label: 'Justify' }], get: () => { const n = e.selected().find((x) => x.kind === 'text'); return n?.kind === 'text' ? n.para.align : 'left'; }, set: (v) => { e.setParaStyle({ align: v as 'left' }); } },
  ];
}

export const typeDefaults = { font: 'Inter', style: 'Regular', size: 24 };

function typeTool(id: string, label: string, iconName: string, order: number, shortcut: string | undefined, kind: 'point' | 'area' | 'path', vertical = false): void {
  registerTool({
    id, label, group: 'type', order, shortcut,
    icon: () => iconName,
    hint: () => (kind === 'point' ? `Click to type a ${vertical ? 'vertical column' : 'line'}, drag to make a text box. Click in existing type to edit it; double-click selects a word. Escape finishes.` : kind === 'area' ? `Click a closed path to fill it with ${vertical ? 'vertical ' : ''}type, or drag a text box.` : `Click a path to set ${vertical ? 'vertical ' : ''}type along it.`),
    cursor: () => (vertical ? CURSORS.typeVertical : CURSORS.type),
    options: typeOptions,
    activate: (ctx) => {
      const e = ctx.engine;
      e.fillPaint = e.fillPicked && e.fillPaint.type !== 'none' ? e.fillPaint : solid(BLACK); e.strokePaint = NONE; e.emit('colors', null);
    },
    down: (ctx, p) => {
      const ed = typing.editor;
      S.word = false;
      if (ed?.active && ed.contains(p.doc, tolDoc(ctx, 4))) {
        if (p.clicks === 2) { ed.selectWord(p.doc); S.word = true; return; }
        if (p.clicks >= 3) { ed.selectAll(); S.word = true; return; }
        ed.caretTo(p.doc, p.shift); ed.dragging = true; return;
      }
      ed?.end();
      S.on = true; S.start = p.doc; S.cur = p.doc;
    },
    move: (ctx, p) => {
      const ed = typing.editor;
      if (ed?.dragging) { ed.caretTo(p.doc, true); return; }
      if (!S.on) return;
      S.cur = p.doc; ctx.redraw();
    },
    up: (ctx, p) => { up(ctx, p, kind, vertical); },
    overlay: (ctx, g) => { if (S.on) marquee(ctx, g, S.start, S.cur); typing.editor?.overlay(ctx, g); },
  });
}

function up(ctx: ToolContext, p: ToolPointer, kind: 'point' | 'area' | 'path', vertical: boolean): void {
  const ed = typing.editor, e = ctx.engine, pr = e.current;
  if (ed?.dragging) { ed.dragging = false; return; }
  if (!S.on || !pr) return;
  S.on = false;
  const r = normRect(S.start.x, S.start.y, p.doc.x, p.doc.y), z = ctx.view().zoom;
  if (r.w * z > 6 && r.h * z > 6) { ctx.typeAt({ x: r.x, y: r.y, box: { w: r.w, h: r.h }, vertical }); ctx.redraw(); return; }
  const h = e.hit(S.start, 4), n = h ? findNode(pr.doc, h.id) : null;
  if (n?.kind === 'text') { ctx.typeAt({ id: n.id, x: S.start.x, y: S.start.y }); return; }
  if (n?.kind === 'path' && kind !== 'point') {
    if (kind === 'area' && n.d.every((sp) => sp.closed)) { ed?.begin({ path: n.id, mode: 'area', vertical }); return; }
    if (kind === 'path') { ed?.begin({ path: n.id, mode: 'path', vertical }); return; }
  }
  if (n?.kind === 'path' && kind === 'point' && p.alt) { ed?.begin({ path: n.id, mode: 'path', vertical }); return; }
  ctx.typeAt({ x: S.start.x, y: S.start.y, vertical });
}

type TouchMode = 'move' | 'scale' | 'sx' | 'sy' | 'rotate';
const TT: { id: string | null; index: number; mode: TouchMode | null; start: Pt; base: CharTouch } = { id: null, index: -1, mode: null, start: { x: 0, y: 0 }, base: { x: 0, y: 0, sx: 100, sy: 100, r: 0 } };
const IDENT: CharTouch = { x: 0, y: 0, sx: 100, sy: 100, r: 0 };

function touchGlyph(e: Engine): { n: TextNode; g: Glyph; B: Mat; box: Rect } | null {
  if (!TT.id) return null;
  const n = e.nodeById(TT.id);
  if (n?.kind !== 'text') return null;
  const g = layoutText(n).glyphs.find((x) => x.index === TT.index && !x.syn);
  if (!g) return null;
  return { n, g, B: n.mode === 'path' ? glyphBaseMat(g) : mul(n.xf, glyphBaseMat(g)), box: glyphBox(g) };
}
function touchOf(n: TextNode, index: number): CharTouch { return { ...IDENT, ...(charStyleAt(n.spans, index).touch ?? {}) }; }

interface TouchHandles { quad: Pt[]; mids: Pt[]; dot: Pt; centre: Pt }
function touchHandles(ctx: ToolContext, tg: { g: Glyph; B: Mat; box: Rect }): TouchHandles {
  const v = ctx.view(), M = mul(tg.B, tg.g.t ?? [1, 0, 0, 1, 0, 0]), b = tg.box;
  const loc = [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }];
  const quad = loc.map((p) => v.toScreen(apply(M, p.x, p.y)));
  const mid = (a: Pt, c: Pt): Pt => ({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 });
  const mids = [mid(quad[0], quad[1]), mid(quad[1], quad[2]), mid(quad[2], quad[3]), mid(quad[3], quad[0])];
  const centre = mid(quad[0], quad[2]), up = { x: mids[0].x - centre.x, y: mids[0].y - centre.y }, l = Math.hypot(up.x, up.y) || 1;
  return { quad, mids, dot: { x: mids[0].x + (up.x / l) * 14, y: mids[0].y + (up.y / l) * 14 }, centre };
}

function touchPick(ctx: ToolContext, p: ToolPointer): TouchMode | null {
  const tg = touchGlyph(ctx.engine);
  if (!tg) return null;
  const h = touchHandles(ctx, tg), near = (q: Pt): boolean => Math.hypot(q.x - p.screen.x, q.y - p.screen.y) <= 6;
  if (near(h.dot)) return 'rotate';
  if (h.quad.some(near)) return 'scale';
  if (near(h.mids[0]) || near(h.mids[2])) return 'sy';
  if (near(h.mids[1]) || near(h.mids[3])) return 'sx';
  return null;
}

function glyphUnder(e: Engine, p: Pt, tol: number): { id: string; index: number } | null {
  const pr = e.current;
  if (!pr) return null;
  const h = e.hit(p, tol), n = h ? findNode(pr.doc, h.id) : null;
  const cands = n?.kind === 'text' ? [n] : e.selected().filter((x): x is TextNode => x.kind === 'text');
  for (const t of cands) {
    let best: { index: number; d: number } | null = null;
    for (const g of layoutText(t).glyphs) {
      if (g.syn || !g.ch.trim()) continue;
      const M = t.mode === 'path' ? glyphMat(g) : mul(t.xf, glyphMat(g)), q = apply(invert(M), p.x, p.y), b = glyphBox(g);
      const dx = q.x < b.x ? b.x - q.x : q.x > b.x + b.w ? q.x - b.x - b.w : 0, dy = q.y < b.y ? b.y - q.y : q.y > b.y + b.h ? q.y - b.y - b.h : 0, d = Math.hypot(dx, dy);
      if (d <= tol && (!best || d < best.d)) best = { index: g.index, d };
    }
    if (best) return { id: t.id, index: best.index };
  }
  return null;
}

function touchFrom(tg: { g: Glyph; B: Mat; box: Rect }, p: Pt): CharTouch {
  const inv = invert(tg.B), a = apply(inv, TT.start.x, TT.start.y), b = apply(inv, p.x, p.y), base = TT.base;
  const c0 = { x: base.x + (tg.box.x + tg.box.w / 2) * (base.sx / 100), y: base.y + (tg.box.y + tg.box.h / 2) * (base.sy / 100) };
  if (TT.mode === 'move') return { ...base, x: base.x + b.x - a.x, y: base.y + b.y - a.y };
  if (TT.mode === 'rotate') { const d = (Math.atan2(b.y - c0.y, b.x - c0.x) - Math.atan2(a.y - c0.y, a.x - c0.x)) * (180 / Math.PI); return { ...base, r: base.r - d }; }
  const ang = (-base.r * Math.PI) / 180, ux = { x: Math.cos(ang), y: Math.sin(ang) }, uy = { x: -Math.sin(ang), y: Math.cos(ang) };
  const along = (q: Pt, u: Pt): number => Math.abs((q.x - c0.x) * u.x + (q.y - c0.y) * u.y);
  const ratio = (num: number, den: number): number => (den > 1e-6 ? Math.max(0.01, num / den) : 1);
  const fx = TT.mode === 'sy' ? 1 : TT.mode === 'scale' ? ratio(Math.hypot(b.x - c0.x, b.y - c0.y), Math.hypot(a.x - c0.x, a.y - c0.y)) : ratio(along(b, ux), along(a, ux));
  const fy = TT.mode === 'sx' ? 1 : TT.mode === 'scale' ? fx : ratio(along(b, uy), along(a, uy));
  const sx = base.sx * fx, sy = base.sy * fy, cx = tg.box.x + tg.box.w / 2, cy = tg.box.y + tg.box.h / 2;
  return { ...base, sx, sy, x: base.x + (cx * (base.sx - sx)) / 100, y: base.y + (cy * (base.sy - sy)) / 100 };
}

function touchOptions(e: Engine): OptionSpec[] {
  const cur = (): CharTouch | null => { const n = TT.id ? e.nodeById(TT.id) : null; return n?.kind === 'text' && TT.index >= 0 ? touchOf(n, TT.index) : null; };
  const put = (patch: Partial<CharTouch>): void => { const c = cur(); if (c && TT.id) e.setCharTouch(TT.id, TT.index, { ...c, ...patch }); };
  const num = (label: string, key: keyof CharTouch, unit: string, min: number, max: number): OptionSpec => ({ kind: 'number', label, unit, min, max, step: 1, get: () => { const c = cur(); return c ? Math.round(c[key] * 100) / 100 : null; }, set: (v) => put({ [key]: v }) });
  return [
    { kind: 'title', text: 'Glyph Touch' },
    { kind: 'readout', label: 'Character', get: () => { const n = TT.id ? e.nodeById(TT.id) : null; return n?.kind === 'text' && TT.index >= 0 ? `“${plainText(n).slice(TT.index, TT.index + 1)}”` : 'None'; } },
    num('X', 'x', 'pt', -10000, 10000), num('Y', 'y', 'pt', -10000, 10000), num('H', 'sx', '%', 1, 10000), num('V', 'sy', '%', 1, 10000), num('Rotate', 'r', '°', -180, 180),
    { kind: 'button', label: 'Reset', run: () => { if (TT.id && TT.index >= 0) e.setCharTouch(TT.id, TT.index, null, 'Reset Glyph Touch'); } },
  ];
}

registerTool({
  id: 'touchType', label: 'Glyph Touch Tool', group: 'type', order: 85, shortcut: 'Shift+T',
  icon: () => 'vTouchType',
  hint: () => (TT.id ? 'Drag inside the box to move the character, a corner to scale it, a side or the top to scale one way, the dot to rotate. Arrow keys nudge. The type stays editable.' : 'Click a character to transform it on its own; the type stays editable.'),
  cursor: (ctx, p) => { if (!p) return 'default'; const m = touchPick(ctx, p); return m === 'rotate' ? 'grab' : m === 'scale' ? 'nwse-resize' : m === 'sx' ? 'ew-resize' : m === 'sy' ? 'ns-resize' : 'default'; },
  options: touchOptions,
  deactivate: () => { TT.mode = null; },
  down: (ctx, p) => {
    const e = ctx.engine;
    let mode = touchPick(ctx, p);
    if (!mode) {
      const hit = glyphUnder(e, p.doc, tolDoc(ctx, 3));
      if (!hit) { TT.id = null; TT.index = -1; e.emit('options', null); ctx.redraw(); return; }
      if (hit.id !== TT.id || hit.index !== TT.index) { TT.id = hit.id; TT.index = hit.index; e.select([hit.id]); e.emit('options', null); }
      mode = 'move';
    }
    const n = TT.id ? e.nodeById(TT.id) : null;
    if (n?.kind !== 'text') return;
    TT.mode = mode; TT.start = p.doc; TT.base = touchOf(n, TT.index);
    e.beginDrag('Glyph Touch');
  },
  move: (ctx, p) => {
    const e = ctx.engine, origin = e.dragOrigin;
    if (!TT.mode || !TT.id || !origin) return;
    const tg = touchGlyph(e);
    if (!tg) return;
    const t = touchFrom(tg, p.doc), id = TT.id, index = TT.index;
    e.dragTo(updateNodes(origin, [id], (n) => (n.kind === 'text' ? { ...n, spans: touchSpans(n.spans, index, t) } : n)));
  },
  up: (ctx) => { if (!TT.mode) return; TT.mode = null; ctx.engine.commitDrag(); ctx.engine.emit('options', null); },
  cancel: (ctx) => { if (TT.mode) { TT.mode = null; ctx.engine.cancelDrag(); } },
  keydown: (ctx, ev) => {
    const tg = touchGlyph(ctx.engine);
    if (!tg || TT.mode) return false;
    const d = ev.shiftKey ? 10 : 1, k = ev.key, step = k === 'ArrowLeft' ? { x: -d, y: 0 } : k === 'ArrowRight' ? { x: d, y: 0 } : k === 'ArrowUp' ? { x: 0, y: -d } : k === 'ArrowDown' ? { x: 0, y: d } : null;
    if (!step) { if (k === 'Escape') { TT.id = null; TT.index = -1; ctx.redraw(); return true; } return false; }
    const inv = invert(tg.B), o = apply(inv, 0, 0), q = apply(inv, step.x, step.y), base = touchOf(tg.n, TT.index);
    ctx.engine.setCharTouch(tg.n.id, TT.index, { ...base, x: base.x + q.x - o.x, y: base.y + q.y - o.y }, 'Nudge Glyph Touch');
    return true;
  },
  overlay: (ctx, g) => {
    const tg = touchGlyph(ctx.engine);
    if (!tg) return;
    const h = touchHandles(ctx, tg), col = ctx.paint().accent;
    g.save();
    g.strokeStyle = col; g.lineWidth = 1;
    g.beginPath(); h.quad.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(h.mids[0].x, h.mids[0].y); g.lineTo(h.dot.x, h.dot.y); g.stroke();
    g.fillStyle = '#fff';
    for (const q of [...h.quad, ...h.mids]) { g.fillRect(Math.round(q.x) - 3, Math.round(q.y) - 3, 6, 6); g.strokeRect(Math.round(q.x) - 2.5, Math.round(q.y) - 2.5, 6, 6); }
    g.fillStyle = col; g.beginPath(); g.arc(h.dot.x, h.dot.y, 3.5, 0, Math.PI * 2); g.fill();
    g.restore();
  },
});

typeTool('type', 'Type Tool', 'vType', 80, 'T', 'point');
typeTool('areaType', 'Area Type Tool', 'vAreaType', 81, undefined, 'area');
typeTool('typePath', 'Type on a Path Tool', 'vTypePath', 82, undefined, 'path');
typeTool('typeVertical', 'Vertical Type Tool', 'vTypeVertical', 83, undefined, 'point', true);
typeTool('areaTypeVertical', 'Vertical Area Type Tool', 'vAreaTypeVertical', 84, undefined, 'area', true);
typeTool('typePathVertical', 'Vertical Type on a Path Tool', 'vTypePathVertical', 84.5, undefined, 'path', true);
