import { childrenOf, cloneNode, comparePaths, findNode, makeLayer, newId, nodeAt, nodeLabel, pathOf, removeNodes, topObjects, updateAt, updateNodes, withChildren, type IndexPath } from '../doc';
import { emptyAppearance } from '../paint';
import type { Doc, GroupNode, LayerNode, VNode } from '../types';

export interface LayerResult { doc: Doc; ids: string[] }

const isLayer = (n: VNode | null | undefined): n is LayerNode => !!n && n.kind === 'layer';

function layersIn(doc: Doc, ids: Iterable<string>): LayerNode[] {
  const out: LayerNode[] = [];
  for (const id of new Set(ids)) { const n = findNode(doc, id); if (isLayer(n)) out.push(n); }
  return out;
}

function panelOrder(a: IndexPath, b: IndexPath): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return b[i] - a[i];
  return a.length - b.length;
}

function underSelected(doc: Doc, id: string, set: Set<string>): boolean {
  const p = pathOf(doc, id);
  if (!p) return false;
  for (let k = 1; k < p.length; k++) { const a = nodeAt(doc, p.slice(0, k)); if (a && set.has(a.id)) return true; }
  return false;
}

function looks(l: LayerNode): boolean {
  return !!l.hidden || !!l.locked || !!l.clip || l.opacity !== 1 || l.blend !== 'normal' || l.ap.items.length > 0 || l.ap.effects.length > 0;
}

function carry(l: LayerNode, kids: VNode[]): VNode[] {
  if (!looks(l)) return kids;
  const g: GroupNode = { id: newId('g'), kind: 'group', name: l.name, children: kids, clip: !!l.clip, opacity: l.opacity, blend: l.blend, ap: l.ap ?? emptyAppearance() };
  if (l.hidden) g.hidden = true;
  if (l.locked) g.locked = true;
  return [g];
}

export function duplicateLayers(doc: Doc, ids: string[]): LayerResult {
  const sel = layersIn(doc, ids), set = new Set(sel.map((l) => l.id));
  const tops = sel.filter((l) => !underSelected(doc, l.id, set)).sort((a, b) => comparePaths(pathOf(doc, b.id) as IndexPath, pathOf(doc, a.id) as IndexPath));
  if (!tops.length) return { doc, ids: [] };
  let out = doc;
  const fresh: string[] = [];
  const copies = new Map<string, LayerNode>();
  for (const l of tops) copies.set(l.id, { ...cloneNode(l), name: `${nodeLabel(l)} copy` });
  for (const l of tops) {
    const p = pathOf(out, l.id) as IndexPath, copy = copies.get(l.id) as LayerNode;
    const parent = p.slice(0, -1);
    if (parent.length) out = updateAt(out, parent, (host) => { const ch = childrenOf(host) ?? [], at = p[p.length - 1] + 1; return withChildren(host, [...ch.slice(0, at), copy, ...ch.slice(at)]); });
    else out = { ...out, layers: [...out.layers.slice(0, p[0] + 1), copy, ...out.layers.slice(p[0] + 1)] };
    fresh.unshift(copy.id);
  }
  return { doc: out, ids: fresh };
}

export function mergeLayers(doc: Doc, ids: string[]): LayerResult {
  const sel = layersIn(doc, ids);
  if (sel.length < 2) return { doc, ids: [] };
  const sorted = sel.slice().sort((a, b) => panelOrder(pathOf(doc, a.id) as IndexPath, pathOf(doc, b.id) as IndexPath));
  const target = sorted[0], tp = pathOf(doc, target.id) as IndexPath;
  const others = sorted.slice(1), otherSet = new Set(others.map((l) => l.id));
  const inside = new Set(others.filter((l) => { const p = pathOf(doc, l.id) as IndexPath; return tp.every((v, i) => p[i] === v); }).map((l) => l.id));
  const outside = others.filter((l) => !inside.has(l.id) && !underSelected(doc, l.id, otherSet)).sort((a, b) => comparePaths(pathOf(doc, a.id) as IndexPath, pathOf(doc, b.id) as IndexPath));
  const inline = (kids: VNode[]): VNode[] => kids.flatMap((c) => (isLayer(c) && inside.has(c.id) ? carry(c, inline(c.children)) : [c]));
  const below = outside.flatMap((l) => carry(l, l.children));
  let out = updateNodes(doc, [target.id], (n) => (isLayer(n) ? { ...n, children: [...below, ...inline(n.children)] } : n));
  out = removeNodes(out, outside.map((l) => l.id));
  return { doc: out, ids: [target.id] };
}

export function hiddenArt(doc: Doc): number {
  let n = 0;
  const walk = (nodes: VNode[], top: boolean): void => {
    for (const c of nodes) {
      if (isLayer(c)) { if (c.hidden) n++; else walk(c.children, false); continue; }
      if (!top && c.hidden) n++;
    }
  };
  walk(doc.layers, true);
  return n;
}

export function flattenArtwork(doc: Doc, targetId: string | null, discardHidden: boolean): LayerResult {
  const flat = (l: LayerNode): boolean => !l.hidden && !l.template;
  const tops = doc.layers.filter(flat);
  if (!tops.length) return { doc, ids: [] };
  let target = tops[tops.length - 1];
  if (targetId) { const p = pathOf(doc, targetId); const top = p ? doc.layers[p[0]] : null; if (top && flat(top)) target = top; }
  const content = (kids: VNode[]): VNode[] => kids.flatMap((c) => {
    if (isLayer(c)) return c.hidden && discardHidden ? [] : carry(c, content(c.children));
    return c.hidden && discardHidden ? [] : [c];
  });
  const merged = tops.flatMap((l) => (l.id === target.id ? content(l.children) : carry(l, content(l.children))));
  const layers: LayerNode[] = [];
  for (const l of doc.layers) {
    if (l.id === target.id) layers.push({ ...l, children: merged });
    else if (flat(l)) continue;
    else if (l.hidden && discardHidden) continue;
    else layers.push(l);
  }
  return { doc: { ...doc, layers }, ids: [target.id] };
}

export function releaseToLayers(doc: Doc, id: string, mode: 'sequence' | 'build'): LayerResult {
  const host = findNode(doc, id);
  if (!host || (host.kind !== 'layer' && host.kind !== 'group')) return { doc, ids: [] };
  const kids = host.children;
  if (!kids.length) return { doc, ids: [] };
  const objects = kids.filter((c) => !isLayer(c)), made: LayerNode[] = [];
  objects.forEach((c, i) => {
    const l = makeLayer(nodeLabel(c), i);
    l.children = mode === 'build' ? objects.slice(0, i + 1).map((o) => (i === objects.length - 1 ? o : cloneNode(o))) : [c];
    made.push(l);
  });
  if (!made.length) return { doc, ids: [] };
  const next = [...kids.filter(isLayer), ...made];
  if (host.kind === 'layer') return { doc: updateNodes(doc, [id], (n) => (isLayer(n) ? { ...n, children: next } : n)), ids: made.map((l) => l.id) };
  const sub: LayerNode = { ...makeLayer(host.name ?? 'Group', 0), children: next, opacity: host.opacity, blend: host.blend, ap: host.ap };
  if (host.hidden) sub.hidden = true;
  if (host.locked) sub.locked = true;
  return { doc: updateNodes(doc, [id], () => sub), ids: made.map((l) => l.id) };
}

export function reverseOrder(doc: Doc, ids: string[]): LayerResult {
  const given = [...new Set(ids)].map((id) => findNode(doc, id)).filter((n): n is VNode => !!n);
  const layerIds = given.filter(isLayer).map((n) => n.id), objIds = topObjects(doc, given.filter((n) => !isLayer(n)).map((n) => n.id));
  const picked = [...layerIds, ...objIds];
  const groups = new Map<string, string[]>();
  for (const id of picked) { const p = pathOf(doc, id); if (!p) continue; const k = p.slice(0, -1).join(','); groups.set(k, [...(groups.get(k) ?? []), id]); }
  let out = doc, changed = false;
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const parent = key ? key.split(',').map(Number) : [];
    const flip = (ch: VNode[]): VNode[] => {
      const set = new Set(list), at: number[] = [];
      ch.forEach((c, i) => { if (set.has(c.id)) at.push(i); });
      const picks = at.map((i) => ch[i]).reverse(), next = ch.slice();
      at.forEach((i, k) => { next[i] = picks[k]; });
      return next;
    };
    changed = true;
    if (parent.length) out = updateAt(out, parent, (host) => withChildren(host, flip(childrenOf(host) ?? [])));
    else out = { ...out, layers: flip(out.layers) as LayerNode[] };
  }
  return { doc: changed ? out : doc, ids: picked };
}
