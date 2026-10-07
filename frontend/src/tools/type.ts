import { findNode } from '../engine/doc';
import { normRect } from '../engine/geometry';
import { BLACK, NONE, solid } from '../engine/paint';
import type { Engine } from '../engine';
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
    hint: () => kind === 'point' ? 'Click to type a line, drag to make a text box. Click in existing type to edit it; double-click selects a word. Escape finishes.' : kind === 'area' ? 'Click a closed path to fill it with type, or drag a text box.' : 'Click a path to set type along it.',
    cursor: () => (vertical ? CURSORS.typeVertical : CURSORS.type),
    options: typeOptions,
    activate: (ctx) => {
      const e = ctx.engine;
      e.fillPaint = solid(BLACK); e.strokePaint = NONE; e.emit('colors', null);
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
  if (r.w * z > 6 && r.h * z > 6) { ctx.typeAt({ x: r.x, y: r.y, box: { w: r.w, h: r.h } }); ctx.redraw(); return; }
  const h = e.hit(S.start, 4), n = h ? findNode(pr.doc, h.id) : null;
  if (n?.kind === 'text') { ctx.typeAt({ id: n.id, x: S.start.x, y: S.start.y }); return; }
  if (n?.kind === 'path' && kind !== 'point') {
    if (kind === 'area' && n.d.every((sp) => sp.closed)) { ed?.begin({ path: n.id, mode: 'area' }); return; }
    if (kind === 'path') { ed?.begin({ path: n.id, mode: 'path' }); return; }
  }
  if (n?.kind === 'path' && kind === 'point' && p.alt) { ed?.begin({ path: n.id, mode: 'path' }); return; }
  if (ed) ed.vertical = vertical;
  ctx.typeAt({ x: S.start.x, y: S.start.y });
}

typeTool('type', 'Type Tool', 'vType', 80, 'T', 'point');
typeTool('areaType', 'Area Type Tool', 'vAreaType', 81, undefined, 'area');
typeTool('typePath', 'Type on a Path Tool', 'vTypePath', 82, undefined, 'path');
typeTool('typeVertical', 'Vertical Type Tool', 'vTypeVertical', 83, undefined, 'point', true);
