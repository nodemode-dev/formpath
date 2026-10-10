import { childrenOf } from './doc';
import { has3d, threeDFaces } from './effects';
import { filterReach } from './filters';
import { emptyRect, inflate, isEmptyRect, pathBounds, transformRect, unionRect } from './geometry';
import { liveChildren } from './live';
import { instanceArt } from './symbolism';
import { textBounds } from './text';
import type { Doc, Effect, PathData, Rect, StrokeItem, VNode } from './types';

const geomCache = new WeakMap<VNode, Rect>();
const visCache = new WeakMap<VNode, Rect>();
let epoch = 0;
const epochOf = new WeakMap<VNode, number>();
export function invalidateBounds(): void { epoch++; }

export function nodePath(n: VNode): PathData | null {
  if (n.kind === 'path') return n.d;
  if (n.kind === 'compound') return n.children.flatMap((c) => c.d);
  return null;
}

export function geomBounds(doc: Doc, n: VNode): Rect {
  if (epochOf.get(n) === epoch) { const c = geomCache.get(n); if (c) return c; }
  const r = computeGeom(doc, n);
  geomCache.set(n, r);
  epochOf.set(n, epoch);
  return r;
}

function computeGeom(doc: Doc, n: VNode): Rect {
  switch (n.kind) {
    case 'path': return pathBounds(n.d);
    case 'compound': return n.children.reduce((r, c) => unionRect(r, pathBounds(c.d)), emptyRect());
    case 'text': return textBounds(n);
    case 'image': return n.warp ? n.warp.pts.reduce<Rect>((r, p) => unionRect(r, { x: p.x, y: p.y, w: 0, h: 0 }), emptyRect()) : transformRect({ x: 0, y: 0, w: n.w, h: n.h }, n.xf);
    case 'symbol': {
      const art = instanceArt(doc, n);
      return art ? transformRect(geomBounds(doc, art), n.xf) : transformRect({ x: -10, y: -10, w: 20, h: 20 }, n.xf);
    }
    case 'mesh': return n.points.reduce((r, p) => unionRect(r, { x: p.x, y: p.y, w: 0, h: 0 }), emptyRect());
    case 'group': {
      if (n.clip && n.children.length) return geomBounds(doc, n.children[n.children.length - 1]);
      return n.children.reduce((r, c) => (c.hidden ? r : unionRect(r, geomBounds(doc, c))), emptyRect());
    }
    case 'layer': return n.children.reduce((r, c) => (c.hidden ? r : unionRect(r, geomBounds(doc, c))), emptyRect());
    case 'blend': case 'envelope': case 'repeat':
      return liveChildren(doc, n).reduce((r, c) => unionRect(r, geomBounds(doc, c)), emptyRect());
  }
}

export function strokeReach(s: StrokeItem): number {
  const base = s.align === 'center' ? s.width / 2 : s.align === 'outside' ? s.width : 0;
  const miter = s.join === 'miter' ? Math.min(s.miter, 4) : 1;
  const prof = s.profile ? Math.max(1, ...s.profile.map((p) => Math.max(p.l, p.r))) : 1;
  const arrows = s.startArrow !== 'none' || s.endArrow !== 'none' ? s.width * 4 * (Math.max(s.arrowScale[0], s.arrowScale[1]) / 100) : 0;
  return Math.max(base * miter * prof, arrows);
}

export function effectReach(n: VNode): number { return effectsReach(n.ap.effects); }
function itemsReach(n: VNode): number {
  return n.ap.items.reduce((m, it) => (it.visible ? Math.max(m, (it.kind === 'stroke' && it.paint.type !== 'none' ? strokeReach(it) : 0) + effectsReach(it.effects)) : m), 0);
}
export function effectsReach(effects: Effect[]): number {
  let m = 0;
  for (const e of effects) {
    if (!e.visible) continue;
    const p = e.params;
    if (e.id === 'stylize.drop_shadow') m = Math.max(m, Math.abs(Number(p.x ?? 7)) + Math.abs(Number(p.y ?? 7)) + Number(p.blur ?? 5) * 2);
    else if (e.id === 'stylize.outer_glow') m = Math.max(m, Number(p.blur ?? 5) * 2);
    else if (e.id === 'blur.gaussian') m = Math.max(m, Number(p.radius ?? 5) * 3);
    else if (e.id === 'path.offset') m = Math.max(m, Math.abs(Number(p.offset ?? 10)));
    else if (e.id.startsWith('distort.') || e.id.startsWith('warp.')) m = Math.max(m, 40);
    else m = Math.max(m, filterReach(e.id, p));
  }
  return m;
}

const visEpoch = new WeakMap<VNode, number>();
export function visualBounds(doc: Doc, n: VNode): Rect {
  if (visEpoch.get(n) === epoch) { const c = visCache.get(n); if (c) return c; }
  visEpoch.set(n, epoch);
  let r: Rect;
  const ch = childrenOf(n);
  const faces = n.kind !== 'layer' && has3d(n) ? threeDFaces(doc, n) : null;
  if (faces) r = faces.reduce((acc, f) => unionRect(acc, inflate(visualBounds(doc, f), 1)), emptyRect());
  else if (n.kind === 'group' && n.clip && n.children.length) r = geomBounds(doc, n.children[n.children.length - 1]);
  else if (ch && n.kind !== 'compound') {
    r = ch.reduce((acc, c) => (c.hidden ? acc : unionRect(acc, visualBounds(doc, c))), emptyRect());
    if (n.ap.items.length && !isEmptyRect(r)) r = inflate(r, itemsReach(n));
  } else {
    r = geomBounds(doc, n);
    if (!isEmptyRect(r)) r = inflate(r, itemsReach(n));
  }
  const fx = effectReach(n);
  if (fx && !isEmptyRect(r)) r = inflate(r, fx);
  visCache.set(n, r);
  return r;
}

export function selectionBounds(doc: Doc, nodes: VNode[], preview = false): Rect {
  return nodes.reduce((r, n) => unionRect(r, preview ? visualBounds(doc, n) : geomBounds(doc, n)), emptyRect());
}
