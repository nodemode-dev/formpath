import { applyOne, effectDef, effectPath, EFFECT_IDS, has3d } from './effects';
import { emptyRect, isEmptyRect, pathBounds, rectPath, unionRect } from './geometry';
import { liveChildren } from './live';
import { fill, stroke } from './paint';
import { isLive, liveArt } from './pathfinder';
import { instanceArt } from './symbolism';
import { textEpoch, textOutlineGlyphs } from './text';
import { VECTOR_3D } from './threed';
import { transformNode } from './transform';
import type { Appearance, AppearanceItem, Doc, Effect, FillRule, PathData, Rect, TextNode, VNode } from './types';

export function isGeomFx(e: Effect): boolean {
  return e.visible && EFFECT_IDS.has(e.id) && !e.id.startsWith('pathfinder.') && !VECTOR_3D.has(e.id) && !effectDef(e.id)?.raster;
}

export const hasGeomFx = (n: VNode): boolean => (n.kind === 'group' || n.kind === 'layer' || n.kind === 'text') && n.ap.effects.length > 0 && n.ap.effects.some(isGeomFx);

export const fxBase = (id: string): string => id.replace(/~fx[a-z0-9]*$/, '');

const SHARED = (id: string): boolean => id.startsWith('warp.') || id === 'distort.free_distort' || id === 'distort.pucker_bloat' || id === 'distort.twist';
const SEEDED = new Set(['distort.roughen', 'distort.tweak', 'stylize.scribble']);

interface Leaf { src: VNode; id: string; proto: Record<string, unknown>; gens: PathData[]; rule: FillRule; ap: Appearance; framed: boolean; run: number }
type Slot =
  | { t: 'leaf'; leaf: Leaf }
  | { t: 'keep'; node: VNode }
  | { t: 'box'; kids: Slot[]; make: (kids: VNode[], gen: number) => VNode; runs?: boolean };
interface State { leaves: Leaf[]; collapse: Leaf | null }

const suffix = (id: string, gen: number): string => (gen ? `${id}~fx${gen}` : id);
const stripAp = (ap: Appearance): Appearance => (ap.effects.some(isGeomFx) ? { ...ap, effects: ap.effects.filter((e) => !isGeomFx(e)) } : ap);
const plainAp = (ap: Appearance): Appearance => {
  const drop = (e: Effect): boolean => isGeomFx(e) || e.id.startsWith('pathfinder.');
  return ap.effects.some(drop) ? { ...ap, effects: ap.effects.filter((e) => !drop(e)) } : ap;
};

function leafOf(st: State, src: VNode, d: PathData, rule: FillRule, framed: boolean): Slot {
  const { children: _c, live: _l, bbox: _b, ...rest } = src as unknown as Record<string, unknown>;
  const leaf: Leaf = { src, id: src.id, proto: rest, gens: [d], rule, ap: stripAp(src.ap), framed, run: 0 };
  st.leaves.push(leaf);
  return { t: 'leaf', leaf };
}

const shell = (c: VNode, kids: VNode[], gen: number): VNode => ({ id: suffix(c.id, gen), kind: 'group', clip: false, children: kids, opacity: c.opacity, blend: c.blend, ap: { items: [], effects: stripAp(c.ap).effects }, ...(c.name ? { name: c.name } : {}), ...(c.mask ? { mask: c.mask } : {}) });

function walk(doc: Doc, c: VNode, st: State, framed: boolean): Slot {
  if (c.hidden || has3d(c)) return { t: 'keep', node: c };
  switch (c.kind) {
    case 'path': return c.guide ? { t: 'keep', node: c } : leafOf(st, c, effectPath(c.d, c.ap.effects), c.rule, framed);
    case 'compound': return leafOf(st, c, effectPath(c.children.flatMap((k) => k.d), c.ap.effects), c.rule, framed);
    case 'group': {
      if (c.trace || c.livePaint || c.shaper || c.intertwine) return { t: 'keep', node: c };
      const base = fxNode(doc, c) ?? c, src = base.kind === 'group' && isLive(base) ? liveArt(base) ?? base.children : (base as { children: VNode[] }).children;
      const clip = base.kind === 'group' && base.clip && src.length > 1;
      const kids = src.map((k, i) => walk(doc, k, st, framed && (!clip || i === src.length - 1)));
      return { t: 'box', kids, make: (ks, gen) => ({ ...base, id: suffix(base.id, gen), children: ks, ap: plainAp(base.ap), compoundShape: undefined }) as VNode };
    }
    case 'text': {
      const glyphs = textOutlineGlyphs(c);
      if (!glyphs) return { t: 'keep', node: c };
      const extra = c.ap.items.filter((i) => i.visible && i.kind === 'fill');
      const kids: Slot[] = [];
      let run = -1, last: typeof glyphs[number]['style'] | null = null;
      for (const g of glyphs) {
        if (!last || (last !== g.style && (JSON.stringify(last.fill) !== JSON.stringify(g.style.fill) || JSON.stringify(last.stroke) !== JSON.stringify(g.style.stroke) || last.strokeWidth !== g.style.strokeWidth))) run++;
        last = g.style;
        const items: AppearanceItem[] = [fill(g.style.fill), ...(g.style.stroke.type !== 'none' && g.style.strokeWidth > 0 ? [stroke(g.style.stroke, g.style.strokeWidth, { join: 'round' })] : []), ...extra.map((i) => ({ ...i, effects: [] }))];
        const leaf: Leaf = { src: c, id: `${c.id}~fxr${run}`, proto: { opacity: 1, blend: 'normal' }, gens: [g.d], rule: 'nonzero', ap: { items, effects: [] }, framed, run };
        st.leaves.push(leaf);
        kids.push({ t: 'leaf', leaf });
      }
      return { t: 'box', kids, runs: true, make: (ks, gen) => shell(c, ks, gen) };
    }
    case 'symbol': {
      const art = instanceArt(doc, c);
      if (!art) return { t: 'keep', node: c };
      return { t: 'box', kids: [walk(doc, transformNode(art, c.xf), st, framed)], make: (ks, gen) => shell(c, ks, gen) };
    }
    case 'blend': case 'envelope': case 'repeat':
      return { t: 'box', kids: liveChildren(doc, c).map((k) => walk(doc, k, st, framed)), make: (ks, gen) => shell(c, ks, gen) };
    default: return { t: 'keep', node: c };
  }
}

function frameOf(leaves: Leaf[]): Rect {
  let r = emptyRect();
  for (const l of leaves) if (l.framed) for (const d of l.gens) { const b = pathBounds(d); if (!isEmptyRect(b)) r = unionRect(r, b); }
  return r;
}

const opCache = new WeakMap<PathData, WeakMap<Effect, Map<string, PathData>>>();
function op(d: PathData, e: Effect, frame: Rect | null, idx: number, key: string, around?: PathData): PathData {
  let byE = opCache.get(d);
  if (!byE) { byE = new WeakMap(); opCache.set(d, byE); }
  let m = byE.get(e);
  if (!m) { m = new Map(); byE.set(e, m); }
  const seeded = SEEDED.has(e.id), k = `${frame ? `${frame.x},${frame.y},${frame.w},${frame.h}` : ''}|${seeded ? idx : ''}|${key}`;
  const hit = m.get(k);
  if (hit) return hit;
  const ee = seeded && idx ? { ...e, params: { ...e.params, seed: Number(e.params.seed ?? 1) + idx * 131 } } : e;
  let r: PathData;
  try { r = applyOne(d, ee, frame ?? undefined, around); } catch { r = d; }
  if (m.size > 6) m.clear();
  m.set(k, r);
  return r;
}

function run(st: State, effects: Effect[]): void {
  for (const e of effects) {
    const frame = frameOf(st.leaves);
    if (isEmptyRect(frame) || !st.leaves.length) return;
    if (e.id.startsWith('convert.')) {
      const first = st.leaves.find((l) => l.framed) ?? st.leaves[0];
      const d = applyOne(rectPath(frame.x, frame.y, frame.w, frame.h), e);
      const leaf: Leaf = { ...first, gens: [d], rule: 'nonzero', framed: true };
      st.collapse = leaf;
      st.leaves = [leaf];
      continue;
    }
    if (e.id === 'distort.transform') {
      const copies = Math.max(0, Math.min(500, Math.round(Number(e.params.copies ?? 0)))), one = copies ? { ...e, params: { ...e.params, copies: 0 } } : e;
      st.leaves.forEach((l, i) => {
        if (!copies) { l.gens = l.gens.map((d) => op(d, e, frame, i, '')); return; }
        const out = [...l.gens];
        let cur = l.gens;
        for (let k = 1; k <= copies; k++) { cur = cur.map((d) => op(d, one, frame, i, `c${k}`)); out.push(...cur); }
        l.gens = out;
      });
      continue;
    }
    if (!SHARED(e.id)) { st.leaves.forEach((l, i) => { l.gens = l.gens.map((d) => op(d, e, null, i, '')); }); continue; }
    let key = '', around: PathData | undefined;
    if (e.id === 'distort.twist') {
      around = st.leaves.flatMap((l) => l.gens.flat());
      const cx = frame.x + frame.w / 2, cy = frame.y + frame.h / 2;
      let R = 1e-6;
      for (const sp of around) for (const p of sp.pts) R = Math.max(R, Math.hypot(p.x - cx, p.y - cy));
      key = String(R);
    }
    st.leaves.forEach((l, i) => { l.gens = l.gens.map((d) => op(d, e, frame, i, key, around)); });
  }
}

const nodeOf = new WeakMap<PathData, { leaf: Leaf; gen: number; ap: Appearance; node: VNode }>();
function leafNode(leaf: Leaf, gen: number, d: PathData = leaf.gens[gen]): VNode {
  const hit = nodeOf.get(d);
  if (hit && hit.leaf.src === leaf.src && hit.gen === gen && hit.ap === leaf.ap && hit.leaf.id === leaf.id) return hit.node;
  const node = { ...leaf.proto, id: suffix(leaf.id, gen), kind: 'path', d, rule: leaf.rule, ap: leaf.ap } as unknown as VNode;
  nodeOf.set(d, { leaf, gen, ap: leaf.ap, node });
  return node;
}

function emitKids(s: Slot & { t: 'box' }, gen: number): VNode[] {
  if (!s.runs) return s.kids.flatMap((k) => emit(k, gen));
  const merged: Array<{ leaf: Leaf; d: PathData }> = [];
  for (const k of s.kids) {
    if (k.t !== 'leaf' || gen >= k.leaf.gens.length) continue;
    const last = merged[merged.length - 1];
    if (last && last.leaf.run === k.leaf.run) last.d.push(...k.leaf.gens[gen]); else merged.push({ leaf: k.leaf, d: [...k.leaf.gens[gen]] });
  }
  return merged.map((m) => leafNode(m.leaf, gen, m.d));
}

function emit(s: Slot, gen: number): VNode[] {
  if (s.t === 'keep') return gen ? [] : [s.node];
  if (s.t === 'leaf') return gen < s.leaf.gens.length ? [leafNode(s.leaf, gen)] : [];
  return [s.make(emitKids(s, gen), gen)];
}

const cache = new WeakMap<VNode, { epoch: number; symbols: Doc['symbols']; out: VNode | null }>();

export function fxNode(doc: Doc, n: VNode): VNode | null {
  if (n.ap.effects.length === 0 || (n.kind !== 'group' && n.kind !== 'layer' && n.kind !== 'text')) return null;
  const epoch = textEpoch(), hit = cache.get(n);
  if (hit && hit.epoch === epoch && hit.symbols === doc.symbols) return hit.out;
  let out: VNode | null = null;
  try { out = build(doc, n); } catch { out = null; }
  cache.set(n, { epoch, symbols: doc.symbols, out });
  return out;
}

function build(doc: Doc, n: VNode): VNode | null {
  const active = n.ap.effects.filter(isGeomFx);
  if (!active.length || has3d(n)) return null;
  const st: State = { leaves: [], collapse: null };
  let slots: Slot[];
  let clip = false;
  if (n.kind === 'text') {
    const s = walk(doc, n, st, true);
    if (s.t !== 'box') return null;
    slots = [s];
  } else if (n.kind === 'group' || n.kind === 'layer') {
    if (n.kind === 'group' && (n.trace || n.livePaint || n.shaper || n.intertwine)) return null;
    const src = n.kind === 'group' && isLive(n) ? liveArt(n) ?? n.children : n.children;
    clip = !!n.clip && src.length > 1;
    slots = src.map((k, i) => walk(doc, k, st, !clip || i === src.length - 1));
  } else return null;
  if (!st.leaves.length) return null;
  run(st, active);
  const gens = st.collapse ? 1 : st.leaves[0].gens.length;
  const top = n.kind === 'text' ? null : n;
  const rest = plainAp(n.ap);
  if (st.collapse) {
    const kid = leafNode(st.collapse, 0);
    return top ? ({ ...top, children: [kid], ap: rest, compoundShape: undefined } as VNode) : { ...shell(n, [kid], 0), id: n.id };
  }
  const kids: VNode[] = [];
  for (let g = 0; g < (clip ? 1 : gens); g++) for (const s of slots) kids.push(...(top ? emit(s, g) : emitKids(s as Slot & { t: 'box' }, g)));
  if (top) return { ...top, children: kids, ap: rest, compoundShape: undefined } as VNode;
  return { ...shell(n, kids, 0), id: n.id };
}

export function fxText(doc: Doc, n: TextNode): VNode | null { return fxNode(doc, n); }
