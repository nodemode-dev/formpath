import { geomBounds } from '../bounds';
import { childrenOf, findNode, newId, pathOf, topObjects, updateAt, updateNodes, type IndexPath } from '../doc';
import { mul, rotateAbout, scaleAbout, transformPath, translate } from '../geometry';
import { area, boolean, offsetPath, pathSampler } from '../kernel';
import { cmyk, fill, luminance, mixColor, rgb, sameColor, solid, tinted, toCmyk, toRgb } from '../paint';
import { transformNode } from '../transform';
import type { Color, Doc, FillItem, GroupNode, PathData, PathNode, VNode } from '../types';
import { ungroupNodes, type OpResult } from './objects';
import { arrangement, geometryOf, replaceSelection, shapeNode } from './paths';

const plainGroup = (n: VNode): boolean => n.kind === 'group' && !n.clip && !n.livePaint && !n.trace && !n.dim && !n.graph && !n.intertwine && !n.shaper;

export function ungroupAll(doc: Doc, ids: string[]): OpResult {
  let out = doc, cur = topObjects(doc, ids);
  for (let guard = 0; guard < 64; guard++) {
    const groups = cur.filter((id) => { const n = findNode(out, id); return !!n && plainGroup(n); });
    if (!groups.length) break;
    const r = ungroupNodes(out, groups);
    out = r.doc;
    cur = [...cur.filter((id) => !groups.includes(id)), ...r.ids];
  }
  return { doc: out, ids: cur };
}

export function anchorCount(doc: Doc, ids: string[]): number {
  let n = 0;
  const visit = (v: VNode): void => {
    if (v.kind === 'path') n += v.d.reduce((s, sp) => s + sp.pts.length, 0);
    else if (v.kind === 'compound') v.children.forEach(visit);
    else childrenOf(v)?.forEach(visit);
  };
  for (const id of topObjects(doc, ids)) { const v = findNode(doc, id); if (v) visit(v); }
  return n;
}

const solidOf = (n: VNode): Color | null => {
  const f = n.ap.items.find((i) => i.kind === 'fill' && i.visible) as FillItem | undefined;
  return f && f.paint.type === 'color' ? f.paint.color : null;
};

interface Shape { n: VNode; g: { d: PathData; rule: 'nonzero' | 'evenodd' } }
function shapesOf(doc: Doc, ids: string[]): Shape[] {
  return topObjects(doc, ids).map((id) => findNode(doc, id) as VNode).filter(Boolean).map((n) => ({ n, g: geometryOf(n) })).filter((x): x is Shape => !!x.g && x.g.d.length > 0);
}

function maxColor(cols: Color[]): Color {
  if (cols.every((c) => c.kind === 'cmyk')) { const k = cols as Array<Extract<Color, { kind: 'cmyk' }>>; return cmyk(Math.max(...k.map((c) => c.c)), Math.max(...k.map((c) => c.m)), Math.max(...k.map((c) => c.y)), Math.max(...k.map((c) => c.k))); }
  const v = cols.map(toRgb);
  return rgb(Math.max(...v.map((c) => c.r)), Math.max(...v.map((c) => c.g)), Math.max(...v.map((c) => c.b)));
}

export function mixPathfinder(doc: Doc, ids: string[], mode: 'hard' | 'soft', rate = 50): OpResult {
  const shapes = shapesOf(doc, ids), tops = shapes.map((s) => s.n.id);
  if (shapes.length < 2) return { doc, ids: topObjects(doc, ids) };
  const k = Math.max(0, Math.min(100, rate)) / 100;
  const made = arrangement(shapes.map((s) => s.g)).map((f) => {
    const base = shapes[f.top].n, size = area(f.d);
    const cols = shapes.filter((s) => area(boolean(f.d, s.g.d, 'intersect', 'nonzero', s.g.rule)) > size * 0.5).map((s) => solidOf(s.n)).filter((c): c is Color => !!c);
    const keep = base.ap.items.filter((i) => i.kind === 'fill');
    if (cols.length < 2) return shapeNode(f.d, base, { items: keep, effects: [] });
    const c = mode === 'hard' ? maxColor(cols) : cols.slice(1).reduce((acc, x) => mixColor(acc, x, k), cols[0]);
    const items = keep.length ? keep.map((i) => (i.kind === 'fill' && i.visible ? { ...i, paint: solid(c) } : i)) : [fill(solid(c))];
    return shapeNode(f.d, base, { items, effects: [] });
  });
  return replaceSelection(doc, tops, made);
}

export interface TrapArgs { thickness: number; heightWidth: number; tintReduction: number; process: boolean; reverse: boolean }

export function trapShapes(doc: Doc, ids: string[], a: TrapArgs): OpResult {
  const shapes = shapesOf(doc, ids).map((s) => ({ ...s, c: solidOf(s.n) })).filter((s): s is Shape & { c: Color } => !!s.c);
  if (shapes.length < 2) return { doc, ids: topObjects(doc, ids) };
  const f = Math.max(0.05, a.heightWidth / 100), down = scaleAbout(1, f, 0, 0), up = scaleAbout(1, 1 / f, 0, 0), t = Math.max(0.01, a.thickness);
  const made: VNode[] = [];
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const A = shapes[i], B = shapes[j];
      if (sameColor(A.c, B.c)) continue;
      const aLight = luminance(A.c) >= luminance(B.c), light = aLight ? A : B, dark = aLight ? B : A;
      const spread = a.reverse ? dark : light, target = a.reverse ? light : dark;
      let strip = boolean(offsetPath(transformPath(spread.g.d, down), t, 'miter', 4, spread.g.rule), transformPath(target.g.d, down), 'intersect', 'nonzero', target.g.rule);
      if (!strip.length) continue;
      strip = transformPath(boolean(strip, transformPath(spread.g.d, down), 'subtract', 'nonzero', spread.g.rule), up);
      if (!strip.length) continue;
      let c = tinted(spread.c, 100 - Math.max(0, Math.min(100, a.tintReduction)));
      if (a.process) c = toCmyk(c);
      const node: PathNode = { id: newId('p'), kind: 'path', d: strip, rule: 'nonzero', opacity: 1, blend: 'multiply', ap: { items: [fill(solid(c))], effects: [] } };
      made.push(node);
    }
  }
  if (!made.length) return { doc, ids: shapes.map((s) => s.n.id) };
  const group: GroupNode = { id: newId('g'), kind: 'group', clip: false, children: made, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, name: 'Traps' };
  const last = shapes[shapes.length - 1].n.id;
  return { doc: updateAt(doc, pathOf(doc, last) as IndexPath, (x) => [x, group]), ids: [group.id] };
}

export interface OnPathArgs { rotate: boolean; offset: number; flip: boolean }

export function objectOnPath(doc: Doc, ids: string[], a: OnPathArgs): OpResult {
  const nodes = topObjects(doc, ids).map((id) => findNode(doc, id) as VNode).filter(Boolean);
  const guide = [...nodes].reverse().find((n) => (n.kind === 'path' || n.kind === 'compound') && !!geometryOf(n));
  const others = nodes.filter((n) => n !== guide);
  const samp = guide ? pathSampler((geometryOf(guide) as { d: PathData }).d) : null;
  if (!guide || !samp || !others.length) return { doc, ids: nodes.map((n) => n.id) };
  const off = Math.max(0, Math.min(100, a.offset)) / 100, n = others.length;
  let out = doc;
  others.forEach((o, i) => {
    const t = samp.closed ? off + i / n : n === 1 ? off : off + (i / (n - 1)) * (1 - off);
    const pt = samp.at(t), b = geomBounds(out, findNode(out, o.id) as VNode);
    let m = translate(pt.x - (b.x + b.w / 2), pt.y - (b.y + b.h / 2));
    if (a.rotate) m = mul(rotateAbout(pt.angle + (a.flip ? 180 : 0), pt.x, pt.y), m);
    else if (a.flip) m = mul(rotateAbout(180, pt.x, pt.y), m);
    out = updateNodes(out, [o.id], (x) => transformNode(x, m));
  });
  return { doc: out, ids: nodes.map((x) => x.id) };
}
