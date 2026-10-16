import { geomBounds } from '../bounds';
import { childrenOf, findNode, newId, pathOf, topObjects, updateAt, updateNodes, type IndexPath } from '../doc';
import { mul, rotateAbout, scaleAbout, transformPath, translate } from '../geometry';
import { area, boolean, offsetPath, pathSampler } from '../kernel';
import { cmyk, fill, luminance, mixColor, rgb, sameColor, solid, tinted, toCmyk, toRgb } from '../paint';
import { transformNode } from '../transform';
import type { Color, Doc, FillItem, GroupNode, PathData, PathNode, VNode } from '../types';
import { ungroupNodes, type OpResult } from './objects';
import { geometryOf, pathfinder } from './paths';
import type { TrapArgs } from '../pathfinder';

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

export function mixPathfinder(doc: Doc, ids: string[], mode: 'hard' | 'soft', rate = 50): OpResult {
  return pathfinder(doc, ids, mode === 'hard' ? 'hard_mix' : 'soft_mix', false, undefined, rate);
}

export type { TrapArgs };

export function trapShapes(doc: Doc, ids: string[], a: TrapArgs): OpResult {
  const r = pathfinder(doc, ids, 'trap', false, a);
  return r.doc === doc ? { doc, ids: topObjects(doc, ids) } : r;
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
