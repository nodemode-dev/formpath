import { childrenOf, newId } from '../doc';
import { arrowGeometry, brushGeometry, effectDef, effectPath, has3d, threeDFaces } from '../effects';
import { fxNode, hasGeomFx } from '../groupfx';
import { emptyAppearance, fill } from '../paint';
import { gradientStrokeArt, gradientStrokeNodes, strokeRegion } from '../stroke-gradient';
import type { Doc, FillRule, PathData, StrokeItem, VNode } from '../types';
import { geometryOf } from './paths';

function shape(d: PathData, rule: FillRule, items: VNode['ap']['items']): VNode {
  if (d.length > 1) return { id: newId('c'), kind: 'compound', rule, children: d.map((sp) => ({ id: newId(), kind: 'path', d: [sp], rule, opacity: 1, blend: 'normal', ap: emptyAppearance() })), opacity: 1, blend: 'normal', ap: { items, effects: [] } };
  return { id: newId('p'), kind: 'path', d, rule, opacity: 1, blend: 'normal', ap: { items, effects: [] } };
}

function strokeParts(doc: Doc, d: PathData, rule: FillRule, s: StrokeItem): VNode[] {
  const out: VNode[] = [];
  const it = fill(s.paint, s.opacity, s.blend);
  if (s.brush) {
    const pieces = brushGeometry(doc, d, s);
    if (pieces) { for (const p of pieces) out.push(shape(p.d, 'nonzero', [fill(p.paint ?? s.paint, s.opacity * (p.opacity ?? 1), s.blend)])); return out; }
  }
  const art = gradientStrokeArt(doc, d, s, rule);
  if (art) return gradientStrokeNodes(art, strokeRegion(d, rule, s), s);
  const outline = strokeRegion(d, rule, s);
  if (outline.length) out.push(shape(outline, 'nonzero', [it]));
  const arrows = arrowGeometry(d, s);
  if (arrows) out.push(shape(arrows, 'nonzero', [it]));
  return out;
}

export function expandAppearance(doc: Doc, n: VNode): VNode[] {
  const faces = n.kind !== 'layer' && has3d(n) ? threeDFaces(doc, n) : null;
  if (faces) return [{ id: newId('g'), kind: 'group', clip: false, children: faces.map((f) => ({ ...f, id: newId('p') })), opacity: n.opacity, blend: n.blend, ap: { items: [], effects: n.ap.effects.filter((e) => e.visible && effectDef(e.id)?.raster) }, name: n.name ?? '3D' }];
  if (n.kind !== 'path' && n.kind !== 'compound') return [n];
  const g = geometryOf(n);
  if (!g) return [n];
  const vectorFx = n.ap.effects.filter((e) => e.visible && !effectDef(e.id)?.raster);
  const rasterFx = n.ap.effects.filter((e) => e.visible && effectDef(e.id)?.raster);
  const base = effectPath(g.d, vectorFx);
  const parts: VNode[] = [];
  for (const it of n.ap.items) {
    if (!it.visible || it.paint.type === 'none') continue;
    const d = effectPath(base, it.effects), own = it.effects.filter((e) => e.visible && effectDef(e.id)?.raster);
    const made = it.kind === 'fill' ? [shape(d, g.rule, [{ ...it, effects: [] }])] : strokeParts(doc, d, g.rule, it);
    if (!own.length || !made.length) parts.push(...made);
    else parts.push(made.length === 1 ? { ...made[0], ap: { ...made[0].ap, effects: [...made[0].ap.effects, ...own] } } : { id: newId('g'), kind: 'group', clip: false, children: made, opacity: 1, blend: 'normal', ap: { items: [], effects: own } });
  }
  if (!parts.length) return [];
  if (parts.length === 1 && !rasterFx.length && n.opacity === 1 && n.blend === 'normal') return [{ ...parts[0], name: n.name }];
  return [{ id: newId('g'), kind: 'group', clip: false, children: parts, opacity: n.opacity, blend: n.blend, ap: { items: [], effects: rasterFx }, name: n.name }];
}

function unfx(n: VNode): VNode {
  const ch = childrenOf(n), id = n.id.includes('~fx') ? newId(n.kind === 'path' ? 'p' : 'g') : n.id;
  return ch ? ({ ...n, id, children: ch.map(unfx) } as VNode) : id === n.id ? n : ({ ...n, id } as VNode);
}

export function expandFx(doc: Doc, n: VNode, each: (c: VNode) => VNode[]): VNode[] | null {
  if ((n.kind !== 'group' && n.kind !== 'text') || !hasGeomFx(n)) return null;
  const s = fxNode(doc, n);
  if (!s || s.kind !== 'group') return null;
  return [unfx({ ...s, id: n.kind === 'text' ? newId('g') : s.id, children: s.children.flatMap(each) })];
}
