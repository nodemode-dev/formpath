import { geomBounds } from './bounds';
import { childrenOf, newId, withChildren } from './doc';
import { mapPathAdaptive } from './envelope';
import { apply, translate } from './geometry';
import { emptyAppearance } from './paint';
import { transformNode } from './transform';
import type { HistoryState } from './history';
import type { Doc, GroupNode, Mat, Pt, Rect, SymbolDef, SymbolPart, SymbolSlice, VNode } from './types';

export type SymbolRegistration = 'tl' | 't' | 'tr' | 'l' | 'c' | 'r' | 'bl' | 'b' | 'br';
export const SYMBOL_REGISTRATIONS: ReadonlyArray<readonly [SymbolRegistration, string]> = [['tl', 'Top Left'], ['t', 'Top'], ['tr', 'Top Right'], ['l', 'Left'], ['c', 'Center'], ['r', 'Right'], ['bl', 'Bottom Left'], ['b', 'Bottom'], ['br', 'Bottom Right']];

export function registrationPoint(b: Rect, r: SymbolRegistration): Pt {
  const fx = r.endsWith('l') ? 0 : r.endsWith('r') ? 1 : 0.5, fy = r.startsWith('t') ? 0 : r.startsWith('b') ? 1 : 0.5;
  return { x: b.x + b.w * fx, y: b.y + b.h * fy };
}

export const isDynamic = (s: SymbolDef | undefined | null): boolean => s?.type === 'dynamic';

export function partsApplied(art: VNode, parts: Record<string, SymbolPart>): VNode {
  const o = parts[art.id];
  const base: VNode = o ? ({ ...art, ...(o.ap ? { ap: o.ap } : {}), ...(o.opacity !== undefined ? { opacity: o.opacity } : {}), ...(o.blend ? { blend: o.blend } : {}) } as VNode) : art;
  const ch = childrenOf(base);
  if (!ch || base.kind === 'compound') return base;
  let changed = false;
  const next = ch.map((c) => { const m = partsApplied(c, parts); if (m !== c) changed = true; return m; });
  return changed ? withChildren(base, next) : base;
}

export function findPart(art: VNode, id: string): VNode | null {
  if (art.id === id) return art;
  for (const c of childrenOf(art) ?? []) { const f = findPart(c, id); if (f) return f; }
  return null;
}

export function xfScale(xf: Mat): { sx: number; sy: number } { return { sx: Math.hypot(xf[0], xf[1]), sy: Math.hypot(xf[2], xf[3]) }; }

export function defaultSlice(b: Rect): SymbolSlice { return { x1: b.x + b.w * 0.25, y1: b.y + b.h * 0.25, x2: b.x + b.w * 0.75, y2: b.y + b.h * 0.75 }; }

function axis(lo: number, hi: number, g1: number, g2: number, s: number): (v: number) => number {
  const a = Math.max(lo, Math.min(hi, Math.min(g1, g2))), b = Math.max(a, Math.min(hi, Math.max(g1, g2)));
  const L = a - lo, R = hi - b, W = (hi - lo) * s, kc = L + R > W && L + R > 0 ? W / (L + R) : 1, mid = b - a, km = mid > 1e-9 ? (W - (L + R) * kc) / mid : 0;
  return (v) => {
    const X = v <= a ? lo * s + (v - lo) * kc : v >= b ? hi * s - (hi - v) * kc : lo * s + L * kc + (v - a) * km;
    return X / s;
  };
}

function warp(n: VNode, f: (p: Pt) => Pt): VNode {
  switch (n.kind) {
    case 'path': return { ...n, d: mapPathAdaptive(n.d, f, 0.02, true), live: undefined };
    case 'compound': return { ...n, children: n.children.map((c) => ({ ...c, d: mapPathAdaptive(c.d, f, 0.02, true), live: undefined })) };
    case 'group': case 'layer': case 'blend': case 'repeat': case 'envelope': return withChildren(n, n.children.map((c) => warp(c, f)));
    case 'text': case 'image': case 'symbol': {
      const c = apply(n.xf, 0, 0), q = f(c);
      return transformNode(n, translate(q.x - c.x, q.y - c.y));
    }
    case 'mesh': return { ...n, points: n.points.map((p) => ({ ...p, ...f(p) })) };
  }
}

export function slicedArt(doc: Doc, art: VNode, slice: SymbolSlice, sx: number, sy: number): VNode {
  const b = geomBounds(doc, art);
  if (!Number.isFinite(b.x) || b.w <= 0 || b.h <= 0 || sx <= 1e-6 || sy <= 1e-6) return art;
  const fx = axis(b.x, b.x + b.w, slice.x1, slice.x2, sx), fy = axis(b.y, b.y + b.h, slice.y1, slice.y2, sy);
  return warp(art, (p) => ({ x: fx(p.x), y: fy(p.y) }));
}

export interface SymbolSession { symbol: string; group: string; instance: string | null; hidden: boolean; origin: Pt; shell: GroupNode | null; plain: boolean; mark: number; start: HistoryState; before: string[]; ids: Record<string, string> }

const plainGroup = (n: VNode): n is GroupNode => n.kind === 'group' && !n.clip && !n.trace && !n.livePaint && !n.dim && !n.graph && !n.intertwine && !n.shaper && !n.mask && n.opacity === 1 && n.blend === 'normal' && !n.ap.items.length && !n.ap.effects.length;

function renamed(n: VNode, f: (id: string) => string): VNode {
  const out = { ...n, id: f(n.id) } as VNode;
  const ch = childrenOf(n);
  if (ch) (out as unknown as { children: VNode[] }).children = ch.map((c) => renamed(c, f));
  if (n.mask) out.mask = { ...n.mask, art: renamed(n.mask.art, f) };
  return out;
}

export function sessionStart(def: SymbolDef, origin: Pt): { kids: VNode[]; shell: GroupNode | null; plain: boolean; ids: Record<string, string> } {
  const m = translate(origin.x, origin.y), ids: Record<string, string> = {};
  const fresh = (id: string): string => { const k = newId('e'); ids[k] = id; return k; };
  if (plainGroup(def.art)) return { kids: def.art.children.map((c) => renamed(transformNode(c, m), fresh)), shell: def.art, plain: true, ids };
  return { kids: [renamed(transformNode(def.art, m), fresh)], shell: null, plain: false, ids };
}

const artCache = new WeakMap<VNode, VNode>();
export function sessionArt(g: GroupNode, s: SymbolSession): VNode {
  const hit = artCache.get(g);
  if (hit) return hit;
  const m = translate(-s.origin.x, -s.origin.y), kids = g.children.map((c) => renamed(transformNode(c, m), (id) => s.ids[id] ?? id));
  const art: VNode = s.plain && s.shell ? { ...s.shell, children: kids } : kids.length === 1 ? kids[0] : { id: s.shell?.id ?? newId('g'), kind: 'group', clip: false, children: kids, opacity: 1, blend: 'normal', ap: emptyAppearance() };
  if (!s.plain && kids.length !== 1 && !s.shell) s.shell = art as GroupNode;
  artCache.set(g, art);
  return art;
}
