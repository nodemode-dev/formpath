import type { Color, Doc, FillItem, GroupNode, LayerNode, PathData, PathNode, Rect, StrokeItem, TextNode, VNode } from '../engine/types';
import { apply } from '../engine/geometry';
import { cornered } from '../engine/corners';
import { layoutText } from '../engine/text';
import { nodeLabel } from '../engine/doc';
import { systemFonts } from './fonts';
import { concat, gradientBlock, sectionBlock, solidBlock, strokeBlock, typeBlock, vectorMaskBlock, type PsdStroke, type TextRun } from './psd-vector';
import { BLEND_KEYS, type PsdLayerIn } from './psd-write';

export const PSD_NOTES: { last: string[] } = { last: [] };

export type PsdWriteMode = 'editable' | 'pixels';
export interface PsdBuildCtx { doc: Doc; region: Rect; k: number; w: number; h: number; render: (only: VNode[]) => Promise<Uint8ClampedArray> }

const NONE = new Uint8Array(0);
const plain = (n: VNode): VNode => ({ ...n, hidden: false, opacity: 1, blend: 'normal' } as VNode);
const pxOf = (c: PsdBuildCtx) => (x: number, y: number): { x: number; y: number } => ({ x: (x - c.region.x) * c.k, y: (y - c.region.y) * c.k });
const solid = (c: Color): boolean => c.kind === 'rgb' || c.kind === 'cmyk' || c.kind === 'gray';

function visibleItems(n: VNode): { fills: FillItem[]; strokes: StrokeItem[] } {
  const fills: FillItem[] = [], strokes: StrokeItem[] = [];
  for (const it of n.ap.items) {
    if (!it.visible || it.paint.type === 'none') continue;
    if (it.kind === 'fill') fills.push(it); else if (it.width > 0) strokes.push(it);
  }
  return { fills, strokes };
}

function whyPixels(n: VNode): string | null {
  if (n.mask) return 'opacity mask';
  if (n.persp) return 'perspective attachment';
  if (n.ap.effects.length || n.ap.items.some((i) => i.effects.length)) return 'effects';
  return null;
}

function shapeReason(n: VNode): string | null {
  const why = whyPixels(n);
  if (why) return why;
  if (n.kind === 'path' && (n.guide || n.d.length === 0)) return 'guide or empty path';
  const { fills, strokes } = visibleItems(n);
  if (fills.length > 1 || strokes.length > 1) return 'more than one fill or stroke';
  if (!fills.length && !strokes.length) return 'no visible fill or stroke';
  for (const f of fills) {
    if (f.opacity !== 1 || f.blend !== 'normal') return 'fill opacity or blend';
    if (f.paint.type === 'pattern') return 'pattern fill';
    if (f.paint.type === 'gradient' && f.paint.gradient.kind === 'freeform') return 'freeform gradient';
    if (f.paint.type === 'color' && f.paint.tint !== undefined && f.paint.tint !== 100 && f.paint.tint !== 1) return 'tinted colour';
  }
  for (const s of strokes) {
    if (s.paint.type !== 'color') return 'gradient or pattern stroke';
    if (s.opacity !== 1 || s.blend !== 'normal') return 'stroke opacity or blend';
    if (s.profile || s.brush) return 'width profile or brush';
    if ((s.startArrow && s.startArrow !== 'none') || (s.endArrow && s.endArrow !== 'none')) return 'arrowheads';
  }
  return null;
}

async function psName(family: string, style: string): Promise<string> {
  try {
    const list = await systemFonts();
    const hit = list.find((f) => f.family === family && f.style === style && f.postscript);
    if (hit) return hit.postscript;
  } catch { }
  return `${family.replace(/\s+/g, '')}-${style.replace(/\s+/g, '')}`;
}

function textReason(n: TextNode): string | null {
  if (n.mode === 'path') return 'text on a path';
  if (n.vertical) return 'vertical type';
  if (n.next || n.framePath || (n.area && (n.area.columns > 1 || n.area.rows > 1))) return 'threaded or multi-column type';
  if (n.wrapShape?.length) return 'text wrap';
  const why = whyPixels(n);
  if (why) return why;
  if (n.ap.items.some((i) => i.visible && i.paint.type !== 'none')) return 'appearance fill or stroke on type';
  if (!n.spans.length || !n.spans.some((s) => s.text.length)) return 'empty text';
  for (const s of n.spans) {
    const st = s.style;
    if (st.fill.type !== 'color') return 'gradient or pattern type fill';
    if (st.stroke.type !== 'none' && st.strokeWidth > 0) return 'type with a stroke';
    if (st.touch || st.rotate || st.upright || st.axes) return 'touch type, rotation or variable axes';
  }
  return null;
}

const ALIGN: Record<string, number> = { left: 0, right: 1, center: 2, justify: 3, justify_center: 4, justify_right: 5, justify_all: 6 };

async function typeLayer(n: TextNode, c: PsdBuildCtx): Promise<Uint8Array | null> {
  const lay = layoutText(n), first = lay.lines[0];
  if (!first) return null;
  const to = pxOf(c), area = n.mode === 'area' && n.frame ? n.frame : null;
  const org = area ? apply(n.xf, area.x, area.y) : apply(n.xf, 0, first.y), at = to(org.x, org.y);
  const runs: TextRun[] = [];
  for (const s of n.spans) {
    if (!s.text.length) continue;
    const st = s.style, fill = st.fill.type === 'color' ? st.fill.color : { kind: 'rgb', r: 0, g: 0, b: 0 } as Color;
    runs.push({ text: s.text, font: await psName(st.font, st.style), size: st.size * c.k, fill, tracking: st.tracking, leading: st.leading === null ? null : st.leading * c.k, hscale: st.hscale, vscale: st.vscale, baseline: st.baseline * c.k, underline: st.underline, strike: st.strike, caps: st.caps });
  }
  if (!runs.length) return null;
  const b = lay.bounds, wid = (area ? area.w : b.w) * c.k, hgt = (area ? area.h : b.h) * c.k;
  return typeBlock({
    runs, align: ALIGN[n.para.align] ?? 0, indentLeft: n.para.indentLeft * c.k, indentRight: n.para.indentRight * c.k, indentFirst: n.para.indentFirst * c.k, spaceBefore: n.para.spaceBefore * c.k, spaceAfter: n.para.spaceAfter * c.k,
    area: area ? { w: wid, h: hgt } : null, bounds: { l: 0, t: area ? 0 : -(first.ascent) * c.k, r: wid, b: area ? hgt : (first.descent) * c.k + (b.h - first.ascent - first.descent) * c.k },
    xf: [n.xf[0], n.xf[1], n.xf[2], n.xf[3], at.x, at.y], antiAlias: true,
  });
}

function shapeBlocks(n: VNode, c: PsdBuildCtx): Uint8Array {
  const paths: PathData[] = n.kind === 'compound' ? n.children.map((p: PathNode) => cornered(p.d)) : [cornered((n as PathNode).d)];
  const rule = n.kind === 'compound' ? n.rule : (n as PathNode).rule;
  const { fills, strokes } = visibleItems(n), f = fills[0], s = strokes[0], to = pxOf(c);
  const parts: Uint8Array[] = [];
  if (f && f.paint.type === 'gradient') {
    const g = f.paint.gradient, geom = g.geom;
    const ang = geom ? (-Math.atan2(geom.y2 - geom.y1, geom.x2 - geom.x1) * 180) / Math.PI : -g.angle;
    parts.push(gradientBlock(g, ang));
  } else parts.push(solidBlock(f && f.paint.type === 'color' ? f.paint.color : s && s.paint.type === 'color' ? s.paint.color : { kind: 'rgb', r: 0, g: 0, b: 0 }));
  parts.push(vectorMaskBlock(paths, rule, (x, y) => to(x, y), c.w, c.h));
  const stroke: PsdStroke | null = s && s.paint.type === 'color' ? { color: s.paint.color, width: s.width * c.k, cap: s.cap, join: s.join, miter: s.miter, align: s.align, dash: s.dash.map((d) => d * c.k), dashOffset: s.dashOffset * c.k, opacity: 1 } : null;
  parts.push(strokeBlock(stroke, !!f));
  return concat(parts);
}

function groupable(n: VNode): n is LayerNode | GroupNode {
  if (n.kind !== 'layer' && n.kind !== 'group') return false;
  if (n.mask || n.persp || n.ap.effects.length || (n.kind === 'group' && n.ap.items.length)) return false;
  if (n.kind === 'group' && (n.clip || n.trace || n.livePaint || n.dim || n.intertwine || n.shaper || n.graph || n.compoundShape)) return false;
  if (n.kind === 'layer' && n.clip) return false;
  return true;
}

export async function buildPsdLayers(nodes: VNode[], c: PsdBuildCtx, mode: PsdWriteMode): Promise<PsdLayerIn[]> {
  const out: PsdLayerIn[] = [], notes: string[] = [];
  const pixels = async (n: VNode, blocks?: Uint8Array, irrelevant = false): Promise<void> => {
    out.push({ name: nodeLabel(n), rgba: await c.render([plain(n)]), hidden: !!n.hidden, opacity: n.opacity, blend: n.blend, blocks, irrelevant });
  };
  const walk = async (n: VNode): Promise<void> => {
    if (mode === 'pixels') { await pixels(n); return; }
    if ((n.kind === 'layer' || n.kind === 'group') && !groupable(n)) { notes.push(`${nodeLabel(n)}: written as pixels (clip, mask, effects or live group)`); await pixels(n); return; }
    if (groupable(n)) {
      out.push({ name: '</Layer group>', rgba: NONE, hidden: false, opacity: 1, blend: 'normal', key: 'norm', irrelevant: true, blocks: sectionBlock('divider', 'norm') });
      for (const ch of n.children) await walk(ch);
      const passthrough = n.blend === 'normal' && n.opacity === 1;
      out.push({ name: nodeLabel(n), rgba: NONE, hidden: !!n.hidden, opacity: n.opacity, blend: n.blend, key: passthrough ? 'pass' : undefined, irrelevant: true, blocks: sectionBlock('open', passthrough ? 'pass' : BLEND_KEYS[n.blend]) });
      return;
    }
    if (n.kind === 'text') {
      const why = textReason(n);
      const blocks = why ? null : await typeLayer(n, c);
      if (blocks) { await pixels(n, blocks); return; }
      notes.push(`${nodeLabel(n)}: written as pixels (${why ?? 'no laid-out text'})`);
      await pixels(n); return;
    }
    if (n.kind === 'path' || n.kind === 'compound') {
      const why = shapeReason(n);
      if (!why) { await pixels(n, shapeBlocks(n, c), true); return; }
      notes.push(`${nodeLabel(n)}: written as pixels (${why})`);
      await pixels(n); return;
    }
    await pixels(n);
  };
  for (const n of nodes) await walk(n);
  PSD_NOTES.last = notes;
  return out;
}
