import { geomBounds, nodePath } from './bounds';
import { childrenOf, comparePaths, pathOf, updateNodes, walk, type IndexPath } from './doc';
import { apply, flattenSub, invert, isEmptyRect, rectCorners, simplifyPolyline } from './geometry';
import { DEFAULT_CHAR, layoutText, mergeSpans, sliceSpans } from './text';
import { refreshDimensions } from './dimension';
import { refreshGraphs } from './graph';
import { perspSync } from './perspective';
import type { Doc, Pt, Span, TextNode, VNode, WrapShape } from './types';

const MAX_PTS = 240;

function outlines(doc: Doc, n: VNode): Pt[][] {
  if (n.hidden) return [];
  const d = nodePath(n);
  if (d) {
    return d.filter((sp) => sp.pts.length > 1).map((sp) => {
      let pts = flattenSub(sp, 0.75);
      if (pts.length > MAX_PTS) pts = simplifyPolyline(pts, 1.5);
      if (pts.length > MAX_PTS) { const step = Math.ceil(pts.length / MAX_PTS); pts = pts.filter((_, i) => i % step === 0); }
      return pts;
    });
  }
  const kids = n.kind === 'group' || n.kind === 'blend' || n.kind === 'repeat' ? childrenOf(n) : null;
  if (kids && !(n.kind === 'group' && n.clip)) return kids.flatMap((c) => outlines(doc, c));
  if (n.kind === 'group' && n.clip && n.children[0]) return outlines(doc, n.children[0]);
  const b = geomBounds(doc, n);
  return isEmptyRect(b) ? [] : [rectCorners(b)];
}

const round = (p: Pt): Pt => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });

function wrapShapes(doc: Doc, t: TextNode, tp: IndexPath, wrappers: Array<{ n: VNode; path: IndexPath }>): WrapShape[] | undefined {
  const inv = invert(t.xf), out: WrapShape[] = [];
  for (const w of wrappers) {
    if (w.path[0] !== tp[0] || comparePaths(w.path, tp) <= 0 || !w.n.wrap) continue;
    if (tp.length > w.path.length && w.path.every((v, i) => v === tp[i])) continue;
    for (const pts of outlines(doc, w.n)) out.push({ pts: pts.map((p) => round(apply(inv, p.x, p.y))), offset: w.n.wrap.offset, invert: w.n.wrap.invert });
  }
  return out.length ? out : undefined;
}

export function threadChains(doc: Doc): TextNode[][] {
  const texts = new Map<string, TextNode>(), order: string[] = [];
  walk(doc.layers, (n) => { if (n.kind === 'text') { texts.set(n.id, n); order.push(n.id); } });
  const pointed = new Map<string, string>();
  for (const id of order) {
    const t = texts.get(id) as TextNode, nx = t.next;
    if (!nx || nx === id || pointed.has(nx)) continue;
    const target = texts.get(nx);
    if (target && target.mode === 'area' && t.mode === 'area') pointed.set(nx, id);
  }
  const chains: TextNode[][] = [];
  for (const id of order) {
    const t = texts.get(id) as TextNode;
    if (t.mode !== 'area' || pointed.has(id) || !t.next || pointed.get(t.next) !== id) continue;
    const chain = [t], seen = new Set([id]);
    let cur = t;
    while (cur.next && pointed.get(cur.next) === cur.id && !seen.has(cur.next)) { cur = texts.get(cur.next) as TextNode; chain.push(cur); seen.add(cur.id); }
    chains.push(chain);
  }
  return chains;
}

export function framePort(t: TextNode, out: boolean): Pt {
  const f = t.frame ?? { x: 0, y: 0, w: 0, h: 0 };
  return apply(t.xf, out ? f.x + f.w : f.x, out ? f.y + f.h : f.y);
}

export function storyOf(chain: TextNode[]): Span[] { return mergeSpans(chain.flatMap((t) => t.spans.filter((s, i) => s.text || i === 0))); }

function distribute(chain: TextNode[]): Map<string, Span[]> {
  const out = new Map<string, Span[]>();
  let rest = storyOf(chain);
  chain.forEach((t, i) => {
    if (i === chain.length - 1) { out.set(t.id, rest); return; }
    const lay = layoutText({ ...t, spans: rest });
    if (lay.overflow < 0) { out.set(t.id, rest); rest = sliceSpans(rest, Infinity); return; }
    out.set(t.id, sliceSpans(rest, 0, lay.overflow));
    rest = sliceSpans(rest, lay.overflow);
  });
  return out;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const blank = (t: TextNode): Span[] => [{ text: '', style: t.spans[0]?.style ?? DEFAULT_CHAR }];

export function detachFrames(doc: Doc, ids: Set<string>): Doc {
  const patches = new Map<string, Partial<TextNode>>();
  for (const chain of threadChains(doc)) {
    if (!chain.some((t) => ids.has(t.id))) continue;
    const story = storyOf(chain), keep = chain.filter((t) => !ids.has(t.id));
    for (const t of chain) if (ids.has(t.id)) patches.set(t.id, { next: undefined, spans: blank(t) });
    if (!keep.length) { patches.set(chain[0].id, { next: undefined, spans: story }); continue; }
    keep.forEach((t, i) => patches.set(t.id, { next: keep[i + 1]?.id, spans: i === 0 ? story : blank(t) }));
  }
  return patches.size ? updateNodes(doc, patches.keys(), (n) => ({ ...n, ...patches.get(n.id) }) as VNode) : doc;
}

function frameShape(t: TextNode): WrapShape[] {
  if (t.mode !== 'area' || !t.framePath?.length) return [];
  const sp = t.framePath.find((s) => s.closed && s.pts.length > 2);
  return sp ? [{ pts: flattenSub(sp, 0.75).map(round), offset: t.area?.inset ?? 0, invert: true }] : [];
}

export function reflow(raw: Doc): Doc {
  const doc = perspSync(refreshGraphs(refreshDimensions(raw)));
  const wrappers: Array<{ n: VNode; path: IndexPath }> = [];
  const areas: Array<{ t: TextNode; path: IndexPath }> = [];
  let threads = false;
  walk(doc.layers, (n) => {
    if (n.wrap) wrappers.push({ n, path: pathOf(doc, n.id) as IndexPath });
    if (n.kind === 'text') {
      if (n.next) threads = true;
      if (n.mode === 'area' || n.wrapShape) areas.push({ t: n, path: pathOf(doc, n.id) as IndexPath });
    }
  });
  if (!wrappers.length && !threads && !areas.some((a) => a.t.wrapShape || a.t.framePath)) return doc;
  const patches = new Map<string, Partial<TextNode>>();
  for (const { t, path } of areas) {
    const all = [...frameShape(t), ...(t.mode === 'area' && wrappers.length ? wrapShapes(doc, t, path, wrappers) ?? [] : [])];
    const ws = all.length ? all : undefined;
    if (!same(ws ?? null, t.wrapShape ?? null)) patches.set(t.id, { wrapShape: ws });
  }
  let out = patches.size ? updateNodes(doc, patches.keys(), (n) => ({ ...n, ...patches.get(n.id) }) as VNode) : doc;
  if (threads) {
    const linked = new Set<string>();
    const fixes = new Map<string, Partial<TextNode>>();
    for (const chain of threadChains(out)) {
      chain.forEach((t) => linked.add(t.id));
      const spans = distribute(chain);
      for (const t of chain) { const s = spans.get(t.id); if (s && !same(s, t.spans)) fixes.set(t.id, { spans: s }); }
    }
    walk(out.layers, (n) => { if (n.kind === 'text' && n.next && !(linked.has(n.id) && linked.has(n.next))) fixes.set(n.id, { ...(fixes.get(n.id) ?? {}), next: undefined }); });
    if (fixes.size) out = updateNodes(out, fixes.keys(), (n) => ({ ...n, ...fixes.get(n.id) }) as VNode);
  }
  return out;
}
