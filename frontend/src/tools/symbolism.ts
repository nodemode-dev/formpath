import { applySymbolism, instanceCenter, symbolInstances } from '../engine/symbolism';
import { SYMBOLISM_NAMES, type Color, type Engine, type Pt, type SymbolismArgs, type SymbolismOp } from '../engine';
import { registerTool, type OptionSpec, type ToolContext, type ToolPointer } from '../extensions/registry';
import { CURSORS } from '../ui/cursors';

const S = { on: false, op: 'shift' as SymbolismOp, last: { x: 0, y: 0 } as Pt, hover: null as Pt | null, ids: [] as string[], alt: false, timer: 0, ctx: null as ToolContext | null };

const fillColor = (e: Engine): Color | undefined => { const f = e.fillPaint; return f.type === 'color' ? f.color : f.type === 'gradient' ? f.gradient.stops[0]?.color : undefined; };

function targets(ctx: ToolContext, p: ToolPointer): string[] {
  const e = ctx.engine, pr = e.current;
  if (!pr) return [];
  const sel = [...pr.selection];
  if (symbolInstances(pr.doc, sel).length) return sel;
  const h = e.hit(p.doc);
  if (!h) return [];
  const id = e.selectableFor(h.id);
  if (!symbolInstances(pr.doc, [id]).length) return [];
  e.select([id]);
  return [id];
}

function step(ctx: ToolContext, at: Pt, extra: Partial<SymbolismArgs> = {}): void {
  const e = ctx.engine, doc = e.doc;
  if (!doc || !S.ids.length) return;
  const style = S.op === 'style' ? doc.styles.find((s) => s.id === e.currentStyle) ?? null : null;
  const r = applySymbolism(doc, S.ids, { op: S.op, at, radius: e.options.liquifySize / 2, intensity: e.options.symbolIntensity, method: e.options.symbolMethod, reverse: S.alt, color: fillColor(e), style, ...extra });
  if (r.touched) e.dragTo(r.doc);
}

function stop(ctx: ToolContext): void {
  if (S.timer) { clearInterval(S.timer); S.timer = 0; }
  if (!S.on) return;
  S.on = false;
  ctx.engine.commitDrag();
  ctx.redraw();
}

const HINTS: Record<SymbolismOp, string> = {
  shift: 'Drag across a symbol set to push its instances. Shift-click brings instances forward, Shift-Alt-click sends them back.',
  scrunch: 'Hold or drag over a symbol set to pull instances together; Alt pushes them apart.',
  size: 'Hold or drag over a symbol set to enlarge instances; Alt shrinks them.',
  spin: 'Drag over a symbol set to turn instances toward the drag direction.',
  stain: 'Hold or drag over a symbol set to tint instances with the fill colour; Alt removes the tint.',
  screen: 'Hold or drag over a symbol set to make instances more transparent; Alt makes them more opaque.',
  style: 'Hold or drag over a symbol set to apply the graphic style chosen here or in the Graphic Styles panel; Alt removes it.',
};
const ICONS: Record<SymbolismOp, string> = { shift: 'vSymbolShifter', scrunch: 'vSymbolScruncher', size: 'vSymbolSizer', spin: 'vSymbolSpinner', stain: 'vSymbolStainer', screen: 'vSymbolScreener', style: 'vSymbolStyler' };
const TIMED: ReadonlySet<SymbolismOp> = new Set(['scrunch', 'size', 'stain', 'screen', 'style']);
const METHOD: ReadonlySet<SymbolismOp> = new Set(['size', 'spin', 'stain', 'screen']);

function options(op: SymbolismOp, e: Engine): OptionSpec[] {
  const out: OptionSpec[] = [
    { kind: 'title', text: SYMBOLISM_NAMES[op] },
    { kind: 'range', label: 'Diameter', min: 4, max: 800, unit: 'pt', get: () => e.options.liquifySize, set: (v) => e.update({ liquifySize: v }) },
    { kind: 'range', label: 'Intensity', min: 1, max: 10, get: () => e.options.symbolIntensity, set: (v) => e.update({ symbolIntensity: Math.round(v) }) },
  ];
  if (METHOD.has(op)) out.push({ kind: 'segment', label: 'Method', choices: [{ id: 'user', label: 'User Defined' }, { id: 'average', label: 'Average' }, { id: 'random', label: 'Random' }], get: () => e.options.symbolMethod, set: (v) => e.update({ symbolMethod: v as 'user' | 'average' | 'random' }) });
  if (op === 'style') out.push({ kind: 'select', label: 'Style', choices: [], live: () => (e.doc?.styles ?? []).map((s) => ({ id: s.id, label: s.name })), get: () => e.currentStyle ?? '', set: (v) => { e.currentStyle = v; e.emit('options', null); } });
  return out;
}

([['shift', 1], ['scrunch', 2], ['size', 3], ['spin', 4], ['stain', 5], ['screen', 6], ['style', 7]] as const).forEach(([op, i]) => registerTool({
  id: ICONS[op].replace(/^vS/, 's'),
  label: `${SYMBOLISM_NAMES[op]} Tool`, group: 'symbolism', order: 76 + i / 10,
  icon: () => ICONS[op],
  hint: () => HINTS[op],
  cursor: () => CURSORS.cross,
  options: (e) => options(op, e),
  activate: () => { S.hover = null; },
  deactivate: (ctx) => stop(ctx),
  cancel: (ctx) => { if (S.timer) { clearInterval(S.timer); S.timer = 0; } if (S.on) { S.on = false; ctx.engine.cancelDrag(); } },
  keydown: (ctx, ev) => { if (ev.key !== '[' && ev.key !== ']') return false; const e = ctx.engine; e.update({ liquifySize: Math.max(4, Math.min(800, e.options.liquifySize + (ev.key === ']' ? 8 : -8))) }); ctx.redraw(); return true; },
  hover: (ctx, p) => { S.hover = p?.doc ?? null; ctx.redraw(); },
  down: (ctx, p) => {
    const e = ctx.engine;
    S.ids = targets(ctx, p);
    if (!S.ids.length) { e.notice('Select a symbol set first: spray one with the Symbol Sprayer or select symbol instances.'); return; }
    if (op === 'shift' && p.shift) {
      const doc = e.doc;
      if (!doc) return;
      const r = applySymbolism(doc, S.ids, { op, at: p.doc, radius: e.options.liquifySize / 2, intensity: e.options.symbolIntensity, stack: p.alt ? 'backward' : 'forward' });
      if (r.touched) e.edit(p.alt ? 'Symbol Shifter Send Backward' : 'Symbol Shifter Bring Forward', () => r.doc);
      return;
    }
    if (op === 'style' && !p.alt &&!e.doc?.styles.some((s) => s.id === e.currentStyle)) { e.notice('Choose a graphic style in the options bar or the Graphic Styles panel first.'); return; }
    S.op = op; S.on = true; S.alt = p.alt; S.last = p.doc; S.ctx = ctx;
    e.beginDrag(SYMBOLISM_NAMES[op]);
    if (TIMED.has(op)) { step(ctx, p.doc); S.timer = window.setInterval(() => { if (S.on && S.ctx) step(S.ctx, S.last); }, 90); }
  },
  move: (ctx, p) => {
    S.hover = p.doc;
    if (!S.on) { ctx.redraw(); return; }
    const dx = p.doc.x - S.last.x, dy = p.doc.y - S.last.y;
    if (Math.hypot(dx, dy) * ctx.view().zoom < 2) return;
    if (op === 'shift') step(ctx, S.last, { dx, dy });
    else if (op === 'spin') step(ctx, p.doc, { dx, dy });
    else step(ctx, p.doc);
    S.last = p.doc;
    ctx.redraw();
  },
  up: (ctx) => stop(ctx),
  overlay: (ctx, g) => {
    const e = ctx.engine, v = ctx.view(), doc = e.doc;
    if (!S.hover || !doc) return;
    const s = v.toScreen(S.hover), r = (e.options.liquifySize / 2) * v.zoom;
    g.save();
    g.strokeStyle = ctx.paint().accent;
    g.beginPath(); g.arc(s.x, s.y, r, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.25 + e.options.symbolIntensity * 0.075;
    g.beginPath(); g.arc(s.x, s.y, Math.max(2, r * (e.options.symbolIntensity / 10)), 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
    const pr = e.current;
    if (pr) for (const n of symbolInstances(doc, [...pr.selection])) { const c = v.toScreen(instanceCenter(doc, n)); if (Math.hypot(c.x - s.x, c.y - s.y) > r) continue; g.fillStyle = ctx.paint().accent; g.fillRect(c.x - 2, c.y - 2, 4, 4); }
    g.restore();
  },
}));
