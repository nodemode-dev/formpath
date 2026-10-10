import { childrenOf, findNode, updateNodes } from './doc';
import { apply, mul, rotateAbout, scaleAbout, translate } from './geometry';
import { geomBounds } from './bounds';
import { hex, mixColor } from './paint';
import { arrange } from './ops/objects';
import { mapNodeColors } from './ops/recolor';
import { findPart, isDynamic, partsApplied, slicedArt, xfScale } from './symbols';
import type { Color, Doc, GraphicStyle, Pt, SymbolNode, VNode } from './types';

export type SymbolismOp = 'shift' | 'scrunch' | 'size' | 'spin' | 'stain' | 'screen' | 'style';
export type SymbolismMethod = 'user' | 'average' | 'random';
export interface SymbolismArgs {
  op: SymbolismOp;
  at: Pt | null;
  radius: number;
  intensity: number;
  reverse?: boolean;
  method?: SymbolismMethod;
  dx?: number;
  dy?: number;
  angle?: number;
  color?: Color;
  style?: GraphicStyle | null;
  stack?: 'forward' | 'backward';
}

const tintCache = new WeakMap<VNode, Map<string, VNode>>();
const partCache = new WeakMap<object, { base: VNode; out: VNode }>();
const sliceCache = new WeakMap<VNode, Map<string, VNode>>();

const memo = (cache: WeakMap<VNode, Map<string, VNode>>, art: VNode, key: string, make: () => VNode): VNode => {
  let m = cache.get(art);
  if (!m) { m = new Map(); cache.set(art, m); }
  let out = m.get(key);
  if (!out) { out = make(); m.set(key, out); if (m.size > 96) m.delete(m.keys().next().value as string); }
  return out;
};

export function partArt(doc: Doc, n: SymbolNode): VNode | null {
  const s = doc.symbols.find((x) => x.id === n.symbol);
  if (!s) return null;
  if (!isDynamic(s) || !n.parts || !Object.keys(n.parts).length) return s.art;
  const c = partCache.get(n.parts);
  if (c && c.base === s.art) return c.out;
  const out = partsApplied(s.art, n.parts);
  partCache.set(n.parts, { base: s.art, out });
  return out;
}

export function instanceArt(doc: Doc, n: SymbolNode): VNode | null {
  const s = doc.symbols.find((x) => x.id === n.symbol);
  let art = partArt(doc, n);
  if (!s || !art) return null;
  const t = n.tint;
  if (t && t.amount > 0) { const base = art; art = memo(tintCache, base, `${hex(t.color)}:${t.amount.toFixed(3)}`, () => mapNodeColors(base, (c) => mixColor(c, t.color, t.amount))); }
  const sl = s.slice;
  if (sl) {
    const { sx, sy } = xfScale(n.xf);
    if (Math.abs(sx - 1) > 1e-4 || Math.abs(sy - 1) > 1e-4) { const base = art; art = memo(sliceCache, base, `${sl.x1},${sl.y1},${sl.x2},${sl.y2}:${sx.toFixed(4)}:${sy.toFixed(4)}`, () => slicedArt(doc, base, sl, sx, sy)); }
  }
  return art;
}

export function withPartEdit(doc: Doc, n: SymbolNode, part: string, fn: (n: VNode) => VNode): SymbolNode {
  const art = partArt(doc, n), cur = art ? findPart(art, part) : null;
  if (!cur) return n;
  const r = fn(cur);
  if (r === cur) return n;
  return { ...n, parts: { ...(n.parts ?? {}), [part]: { ap: r.ap, opacity: r.opacity, blend: r.blend } } };
}

export function bakedInstance(doc: Doc, n: SymbolNode): VNode | null {
  const art = instanceArt(doc, n);
  if (!art) return null;
  return { ...art, opacity: art.opacity * n.opacity, blend: n.blend !== 'normal' ? n.blend : art.blend, ap: { ...art.ap, effects: [...art.ap.effects, ...n.ap.effects] } };
}

export function symbolInstances(doc: Doc, ids: Iterable<string>): SymbolNode[] {
  const out: SymbolNode[] = [], seen = new Set<string>();
  const walk = (n: VNode): void => {
    if (n.hidden || n.locked) return;
    if (n.kind === 'symbol') { if (!seen.has(n.id)) { seen.add(n.id); out.push(n); } return; }
    if (n.kind === 'group' || n.kind === 'layer') childrenOf(n)?.forEach(walk);
  };
  for (const id of ids) { const n = findNode(doc, id); if (n) walk(n); }
  return out;
}

export function instanceCenter(doc: Doc, n: SymbolNode): Pt {
  const s = doc.symbols.find((x) => x.id === n.symbol);
  const b = s ? geomBounds(doc, s.art) : { x: 0, y: 0, w: 0, h: 0 };
  return apply(n.xf, Number.isFinite(b.x) ? b.x + b.w / 2 : 0, Number.isFinite(b.y) ? b.y + b.h / 2 : 0);
}

const weight = (c: Pt, a: SymbolismArgs): number => {
  if (!a.at) return 1;
  const d = Math.hypot(c.x - a.at.x, c.y - a.at.y);
  if (d >= a.radius) return 0;
  const t = d / Math.max(1e-6, a.radius);
  return 1 - t * t;
};

const scaleOf = (n: SymbolNode): number => Math.sqrt(Math.abs(n.xf[0] * n.xf[3] - n.xf[1] * n.xf[2]));
const angleOf = (n: SymbolNode): number => (Math.atan2(n.xf[1], n.xf[0]) * 180) / Math.PI;
const wrapDeg = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;

export function applySymbolism(doc: Doc, ids: Iterable<string>, a: SymbolismArgs): { doc: Doc; touched: number } {
  const all = symbolInstances(doc, ids);
  const hit = all.map((n) => ({ n, c: instanceCenter(doc, n) })).map((x) => ({ ...x, w: weight(x.c, a) })).filter((x) => x.w > 0);
  if (!hit.length) return { doc, touched: 0 };
  if (a.op === 'shift' && a.stack) return { doc: arrange(doc, hit.map((x) => x.n.id), a.stack === 'forward' ? 'bring_forward' : 'send_backward'), touched: hit.length };
  const k = Math.max(0, Math.min(10, a.intensity)) / 10, sign = a.reverse ? -1 : 1, method = a.method ?? 'user';
  const mean = (f: (n: SymbolNode) => number): number => hit.reduce((s, x) => s + f(x.n), 0) / hit.length;
  const centroid = a.at ?? { x: hit.reduce((s, x) => s + x.c.x, 0) / hit.length, y: hit.reduce((s, x) => s + x.c.y, 0) / hit.length };
  const avgScale = mean(scaleOf), avgAngle = mean(angleOf), avgOpacity = mean((n) => n.opacity), avgTint = mean((n) => n.tint?.amount ?? 0);
  const next = new Map<string, SymbolNode>();
  for (const { n, c, w } of hit) {
    const kw = k * w;
    let out: SymbolNode = n;
    switch (a.op) {
      case 'shift': out = { ...n, xf: mul(translate((a.dx ?? 0) * w, (a.dy ?? 0) * w), n.xf) }; break;
      case 'scrunch': {
        const t = 0.12 * kw * sign;
        out = { ...n, xf: mul(translate((centroid.x - c.x) * t, (centroid.y - c.y) * t), n.xf) };
        break;
      }
      case 'size': {
        const s = scaleOf(n);
        let f = method === 'average' ? 1 + ((avgScale / Math.max(1e-6, s)) - 1) * 0.3 * kw : method === 'random' ? 1 + (Math.random() * 2 - 1) * 0.12 * kw : Math.pow(1 + 0.08 * kw, sign);
        if (s * f < 0.02) f = 0.02 / Math.max(1e-6, s);
        out = { ...n, xf: mul(scaleAbout(f, f, c.x, c.y), n.xf) };
        break;
      }
      case 'spin': {
        const cur = angleOf(n);
        let d = 0;
        if (method === 'average') d = wrapDeg(avgAngle - cur) * 0.3 * kw;
        else if (method === 'random') d = (Math.random() * 2 - 1) * 20 * kw;
        else if (a.angle !== undefined) d = a.angle * w * sign;
        else if (a.dx || a.dy) d = wrapDeg((Math.atan2(a.dy ?? 0, a.dx ?? 0) * 180) / Math.PI - cur) * 0.35 * kw;
        out = { ...n, xf: mul(rotateAbout(d, c.x, c.y), n.xf) };
        break;
      }
      case 'stain': {
        const amt = n.tint?.amount ?? 0;
        if (method === 'average') { const v = amt + (avgTint - amt) * 0.3 * kw; out = { ...n, tint: v > 0.001 && n.tint ? { ...n.tint, amount: v } : undefined }; break; }
        if (!a.color) break;
        const step = (method === 'random' ? Math.random() : 1) * 0.1 * kw;
        if (a.reverse) { const v = amt - step; out = { ...n, tint: v > 0.001 && n.tint ? { ...n.tint, amount: v } : undefined }; break; }
        const v = Math.min(1, amt + step), color = n.tint ? mixColor(n.tint.color, a.color, step / Math.max(1e-6, v)) : a.color;
        out = { ...n, tint: { color, amount: v } };
        break;
      }
      case 'screen': {
        const o = n.opacity;
        const v = method === 'average' ? o + (avgOpacity - o) * 0.3 * kw : method === 'random' ? o + (Math.random() * 2 - 1) * 0.1 * kw : o - 0.08 * kw * sign;
        out = { ...n, opacity: Math.max(0.02, Math.min(1, v)) };
        break;
      }
      case 'style': {
        if (a.reverse || !a.style) { out = { ...n, style: undefined, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } }; break; }
        out = { ...n, style: a.style.id, opacity: a.style.opacity, blend: a.style.blend, ap: { items: [], effects: a.style.ap.effects } };
        break;
      }
    }
    if (out !== n) next.set(n.id, out);
  }
  if (!next.size) return { doc, touched: 0 };
  return { doc: updateNodes(doc, next.keys(), (n) => next.get(n.id) ?? n), touched: next.size };
}
