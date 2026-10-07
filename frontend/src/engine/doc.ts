import { basicAppearance, BLACK, defaultSwatches, emptyAppearance, NONE, solid, WHITE } from './paint';
import type { Artboard, ContainerNode, Doc, LayerNode, Units, VNode } from './types';

export const LAYER_COLORS = ['#4f80ff', '#ff4f4f', '#4fbf4f', '#4f4fff', '#ffd400', '#ff4fff', '#4fdfff', '#9f9f9f', '#ff8f2f', '#2f9f8f', '#9f4fff', '#bf8f4f'];

let counter = 0;
const salt = Math.random().toString(36).slice(2, 6);
export function newId(prefix = 'n'): string { counter += 1; return `${prefix}${salt}${counter.toString(36)}`; }

export function isContainer(n: VNode): n is ContainerNode {
  return n.kind === 'layer' || n.kind === 'group' || n.kind === 'compound' || n.kind === 'blend' || n.kind === 'envelope' || n.kind === 'repeat';
}
export function childrenOf(n: VNode): VNode[] | null { return isContainer(n) ? (n.children as VNode[]) : null; }
export function withChildren<T extends VNode>(n: T, children: VNode[]): T { return { ...n, children } as T; }

export function makeLayer(name: string, index: number): LayerNode {
  return { id: newId('l'), kind: 'layer', name, children: [], color: LAYER_COLORS[index % LAYER_COLORS.length], opacity: 1, blend: 'normal', ap: emptyAppearance(), printable: true };
}

export function newDoc(w: number, h: number, opts: { title?: string; units?: Units; colorMode?: 'rgb' | 'cmyk'; artboards?: number } = {}): Doc {
  const count = Math.max(1, Math.min(100, opts.artboards ?? 1)), gap = 20, cols = Math.ceil(Math.sqrt(count));
  const artboards: Artboard[] = [];
  for (let i = 0; i < count; i++) artboards.push({ id: newId('a'), name: `Artboard ${i + 1}`, x: (i % cols) * (w + gap), y: Math.floor(i / cols) * (h + gap), w, h, bg: null });
  const swatches = [
    { id: newId('s'), name: '[None]', paint: NONE, global: false, spot: false },
    { id: newId('s'), name: '[Registration]', paint: solid(BLACK), global: true, spot: false },
    ...defaultSwatches().map((s) => ({ id: newId('s'), name: s.name, paint: solid(s.color), global: false, spot: false })),
  ];
  return {
    version: 1, title: opts.title ?? 'Untitled', units: opts.units ?? 'pt', colorMode: opts.colorMode ?? 'rgb',
    artboards, layers: [makeLayer('Layer 1', 0)], swatches, symbols: [], styles: [
      { id: newId('g'), name: 'Default Graphic Style', ap: basicAppearance(solid(WHITE), solid(BLACK), 1), opacity: 1, blend: 'normal' },
    ], brushes: [], patterns: [], charStyles: [], paraStyles: [], guides: [], grid: { spacing: 72, subdivisions: 8 }, images: {}, rasterPpi: 300,
  };
}

export type IndexPath = number[];

const indexCache = new WeakMap<Doc, Map<string, IndexPath>>();
export function indexOf(doc: Doc): Map<string, IndexPath> {
  let m = indexCache.get(doc);
  if (m) return m;
  m = new Map();
  const walkIn = (nodes: VNode[], base: IndexPath): void => {
    nodes.forEach((n, i) => {
      const p = [...base, i];
      (m as Map<string, IndexPath>).set(n.id, p);
      const ch = childrenOf(n);
      if (ch) walkIn(ch, p);
    });
  };
  walkIn(doc.layers, []);
  indexCache.set(doc, m);
  return m;
}

export function nodeAt(doc: Doc, path: IndexPath): VNode | null {
  let list: VNode[] = doc.layers, node: VNode | null = null;
  for (const i of path) {
    node = list[i] ?? null;
    if (!node) return null;
    list = childrenOf(node) ?? [];
  }
  return node;
}

export function findNode(doc: Doc, id: string): VNode | null { const p = indexOf(doc).get(id); return p ? nodeAt(doc, p) : null; }
export function pathOf(doc: Doc, id: string): IndexPath | null { return indexOf(doc).get(id) ?? null; }

export function ancestors(doc: Doc, id: string): VNode[] {
  const p = pathOf(doc, id);
  if (!p) return [];
  const out: VNode[] = [];
  for (let k = 1; k < p.length; k++) { const n = nodeAt(doc, p.slice(0, k)); if (n) out.push(n); }
  return out;
}
export function parentOf(doc: Doc, id: string): VNode | null { const a = ancestors(doc, id); return a.length ? a[a.length - 1] : null; }
export function layerOf(doc: Doc, id: string): LayerNode | null { const p = pathOf(doc, id); return p ? doc.layers[p[0]] ?? null : null; }

function replaceIn(list: VNode[], path: IndexPath, fn: (n: VNode) => VNode | VNode[] | null): VNode[] {
  const [i, ...rest] = path;
  const node = list[i];
  if (!node) return list;
  const out = list.slice();
  if (!rest.length) {
    const r = fn(node);
    if (r === null) out.splice(i, 1);
    else if (Array.isArray(r)) out.splice(i, 1, ...r);
    else out[i] = r;
    return out;
  }
  const ch = childrenOf(node);
  if (!ch) return list;
  out[i] = withChildren(node, replaceIn(ch, rest, fn));
  return out;
}

export function updateAt(doc: Doc, path: IndexPath, fn: (n: VNode) => VNode | VNode[] | null): Doc {
  return { ...doc, layers: replaceIn(doc.layers, path, fn) as LayerNode[] };
}

export function comparePaths(a: IndexPath, b: IndexPath): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

export function updateNodes(doc: Doc, ids: Iterable<string>, fn: (n: VNode) => VNode | VNode[] | null): Doc {
  const idx = indexOf(doc);
  const paths = [...new Set(ids)].map((id) => idx.get(id)).filter((p): p is IndexPath => !!p).sort(comparePaths).reverse();
  let out = doc;
  for (const p of paths) out = updateAt(out, p, fn);
  return out;
}
export function updateNode(doc: Doc, id: string, fn: (n: VNode) => VNode | VNode[] | null): Doc { return updateNodes(doc, [id], fn); }
export function removeNodes(doc: Doc, ids: Iterable<string>): Doc { return updateNodes(doc, ids, () => null); }

export function insertInto(doc: Doc, parentPath: IndexPath, index: number, nodes: VNode[]): Doc {
  if (!parentPath.length) return { ...doc, layers: [...doc.layers.slice(0, index), ...(nodes as LayerNode[]), ...doc.layers.slice(index)] };
  return updateAt(doc, parentPath, (p) => {
    const ch = childrenOf(p) ?? [];
    const at = Math.max(0, Math.min(ch.length, index));
    return withChildren(p, [...ch.slice(0, at), ...nodes, ...ch.slice(at)]);
  });
}

export function walk(nodes: VNode[], fn: (n: VNode, parents: VNode[]) => void | false, parents: VNode[] = []): void {
  for (const n of nodes) {
    if (fn(n, parents) === false) continue;
    const ch = childrenOf(n);
    if (ch) walk(ch, fn, [...parents, n]);
  }
}
export function allNodes(doc: Doc): VNode[] { const out: VNode[] = []; walk(doc.layers, (n) => { out.push(n); }); return out; }

export function cloneNode<T extends VNode>(n: T): T {
  const copy = { ...n, id: newId() } as T;
  const ch = childrenOf(n);
  if (ch) (copy as unknown as { children: VNode[] }).children = ch.map((c) => cloneNode(c));
  if (n.mask) copy.mask = { ...n.mask, art: cloneNode(n.mask.art) };
  return copy;
}

export function isVisible(doc: Doc, id: string): boolean {
  const n = findNode(doc, id);
  if (!n || n.hidden) return false;
  return ancestors(doc, id).every((a) => !a.hidden);
}
export function isLocked(doc: Doc, id: string): boolean {
  const n = findNode(doc, id);
  if (!n || n.locked) return true;
  return ancestors(doc, id).some((a) => a.locked);
}

export function topSelectable(doc: Doc, id: string, isolation: string | null): string {
  const p = pathOf(doc, id);
  if (!p) return id;
  let start = 1;
  if (isolation) {
    const ip = pathOf(doc, isolation);
    if (ip && p.length > ip.length && ip.every((v, i) => v === p[i])) start = ip.length + 1;
  }
  for (let k = start; k <= p.length; k++) { const n = nodeAt(doc, p.slice(0, k)); if (n && n.kind !== 'layer') return n.id; }
  return id;
}

export function topObjects(doc: Doc, ids: Iterable<string>): string[] {
  const set = new Set(ids), idx = indexOf(doc), out: string[] = [];
  for (const id of set) {
    const p = idx.get(id);
    if (!p) continue;
    let covered = false;
    for (let k = 1; k < p.length; k++) { const a = nodeAt(doc, p.slice(0, k)); if (a && set.has(a.id) && a.kind !== 'layer') { covered = true; break; } }
    if (!covered) out.push(id);
  }
  return out.sort((a, b) => comparePaths(idx.get(a) as IndexPath, idx.get(b) as IndexPath));
}

export function inDocOrder(doc: Doc, ids: Iterable<string>): string[] {
  const idx = indexOf(doc);
  return [...new Set(ids)].filter((id) => idx.has(id)).sort((a, b) => comparePaths(idx.get(a) as IndexPath, idx.get(b) as IndexPath));
}

export function nodeLabel(n: VNode): string {
  if (n.name) return n.name;
  switch (n.kind) {
    case 'layer': return 'Layer';
    case 'group': return n.clip ? 'Clip Group' : 'Group';
    case 'path': return n.live ? ({ rect: 'Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', star: 'Star', line: 'Line' }[n.live.kind]) : n.guide ? 'Guide' : 'Path';
    case 'compound': return 'Compound Path';
    case 'text': { const t = n.spans.map((s) => s.text).join('').replace(/\s+/g, ' ').trim(); return t ? (t.length > 28 ? t.slice(0, 28) + '…' : t) : 'Type'; }
    case 'image': return 'Image';
    case 'symbol': return 'Symbol';
    case 'blend': return 'Blend';
    case 'envelope': return 'Envelope';
    case 'mesh': return 'Mesh';
    case 'repeat': return `Repeat ${n.spec.kind[0].toUpperCase()}${n.spec.kind.slice(1)}`;
  }
}
