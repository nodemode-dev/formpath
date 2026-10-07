import { geomBounds, selectionBounds, visualBounds } from '../bounds';
import { childrenOf, cloneNode, comparePaths, findNode, indexOf, inDocOrder, insertInto, newId, nodeAt, pathOf, removeNodes, topObjects, updateAt, updateNodes, withChildren, type IndexPath } from '../doc';
import { mul, translate } from '../geometry';
import { emptyAppearance, NONE } from '../paint';
import { transformNode, type XfOpts } from '../transform';
import type { CompoundNode, Doc, FillRule, GroupNode, Mat, PathNode, Rect, VNode } from '../types';

export interface OpResult { doc: Doc; ids: string[] }

function parentPathOf(doc: Doc, id: string): IndexPath | null { const p = pathOf(doc, id); return p ? p.slice(0, -1) : null; }

export function groupNodes(doc: Doc, ids: string[]): OpResult {
  const tops = topObjects(doc, ids).filter((id) => (pathOf(doc, id)?.length ?? 0) > 1);
  if (!tops.length) return { doc, ids: [] };
  const last = tops[tops.length - 1];
  const nodes = tops.map((id) => findNode(doc, id) as VNode);
  const group: GroupNode = { id: newId('g'), kind: 'group', children: nodes, clip: false, opacity: 1, blend: 'normal', ap: emptyAppearance() };
  let out = removeNodes(doc, tops.filter((id) => id !== last));
  out = updateAt(out, pathOf(out, last) as IndexPath, () => group);
  return { doc: out, ids: pathOf(out, group.id) ? [group.id] : [] };
}

export function ungroupNodes(doc: Doc, ids: string[]): OpResult {
  let out = doc;
  const result: string[] = [];
  for (const id of inDocOrder(doc, ids).reverse()) {
    const n = findNode(out, id);
    if (!n || (n.kind !== 'group' && n.kind !== 'repeat' && n.kind !== 'blend' && n.kind !== 'envelope')) { result.push(id); continue; }
    if (n.kind !== 'group') { result.push(id); continue; }
    const kids = n.children.map((c, i) => (n.clip && i === n.children.length - 1 && c.kind === 'path' ? { ...c, ap: { items: [], effects: [] } } : c));
    const withGroupFx = n.opacity !== 1 || n.blend !== 'normal' ? kids.map((c) => ({ ...c, opacity: c.opacity * n.opacity, blend: c.blend === 'normal' ? n.blend : c.blend })) : kids;
    out = updateAt(out, pathOf(out, id) as IndexPath, () => withGroupFx);
    result.push(...withGroupFx.map((c) => c.id));
  }
  return { doc: out, ids: result };
}

export type ArrangeOrder = 'bring_to_front' | 'bring_forward' | 'send_backward' | 'send_to_back';
export function arrange(doc: Doc, ids: string[], order: ArrangeOrder): Doc {
  const tops = topObjects(doc, ids);
  const byParent = new Map<string, string[]>();
  for (const id of tops) { const pp = parentPathOf(doc, id); if (!pp) continue; const k = pp.join(','); byParent.set(k, [...(byParent.get(k) ?? []), id]); }
  let out = doc;
  for (const [key, list] of byParent) {
    const pp = key ? key.split(',').map(Number) : [];
    out = updateAt(out, pp, (parent) => {
      const ch = (childrenOf(parent) ?? []).slice();
      const sel = new Set(list);
      let next: VNode[];
      if (order === 'bring_to_front') next = [...ch.filter((c) => !sel.has(c.id)), ...ch.filter((c) => sel.has(c.id))];
      else if (order === 'send_to_back') next = [...ch.filter((c) => sel.has(c.id)), ...ch.filter((c) => !sel.has(c.id))];
      else if (order === 'bring_forward') { next = ch.slice(); for (let i = next.length - 2; i >= 0; i--) if (sel.has(next[i].id) && !sel.has(next[i + 1].id)) [next[i], next[i + 1]] = [next[i + 1], next[i]]; }
      else { next = ch.slice(); for (let i = 1; i < next.length; i++) if (sel.has(next[i].id) && !sel.has(next[i - 1].id)) [next[i], next[i - 1]] = [next[i - 1], next[i]]; }
      return withChildren(parent, next);
    });
  }
  return out;
}

export function duplicateNodes(doc: Doc, ids: string[], dx = 0, dy = 0): OpResult {
  const tops = topObjects(doc, ids);
  let out = doc;
  const fresh: string[] = [];
  for (const id of [...tops].reverse()) {
    const n = findNode(out, id);
    if (!n || n.kind === 'layer') continue;
    const copy = cloneNode(dx || dy ? transformNode(n, translate(dx, dy)) : n);
    const p = pathOf(out, id) as IndexPath;
    out = insertInto(out, p.slice(0, -1), p[p.length - 1] + 1, [copy]);
    fresh.unshift(copy.id);
  }
  return { doc: out, ids: fresh };
}

export function transformNodes(doc: Doc, ids: string[], m: Mat, copy = false, o?: XfOpts): OpResult {
  const tops = topObjects(doc, ids);
  if (copy) {
    const d = duplicateNodes(doc, tops);
    return { doc: updateNodes(d.doc, d.ids, (n) => transformNode(n, m, o)), ids: d.ids };
  }
  return { doc: updateNodes(doc, tops, (n) => transformNode(n, m, o)), ids: tops };
}

function flattenPaths(n: VNode): PathNode[] {
  if (n.kind === 'path') return [n];
  if (n.kind === 'compound') return n.children;
  return (childrenOf(n) ?? []).flatMap(flattenPaths);
}

export function makeCompound(doc: Doc, ids: string[], rule?: FillRule): OpResult {
  const tops = topObjects(doc, ids);
  const nodes = tops.map((id) => findNode(doc, id) as VNode).filter((n) => n && (n.kind === 'path' || n.kind === 'compound' || n.kind === 'group'));
  const paths = nodes.flatMap(flattenPaths);
  if (paths.length < 1) return { doc, ids: [] };
  const bottom = nodes[0];
  const comp: CompoundNode = { id: newId('c'), kind: 'compound', children: paths.map((p) => ({ ...p, ap: emptyAppearance(), live: undefined })), rule: rule ?? (bottom.kind === 'compound' ? bottom.rule : 'evenodd'), opacity: bottom.opacity, blend: bottom.blend, ap: bottom.ap };
  const lastId = tops[tops.length - 1];
  let out = removeNodes(doc, tops.filter((id) => id !== lastId));
  out = updateAt(out, pathOf(out, lastId) as IndexPath, () => comp);
  return { doc: out, ids: [comp.id] };
}

export function releaseCompound(doc: Doc, ids: string[]): OpResult {
  let out = doc;
  const res: string[] = [];
  for (const id of inDocOrder(doc, ids).reverse()) {
    const n = findNode(out, id);
    if (!n || n.kind !== 'compound') { res.push(id); continue; }
    const kids = n.children.map((c) => ({ ...c, id: newId(), ap: n.ap, opacity: n.opacity, blend: n.blend }));
    out = updateAt(out, pathOf(out, id) as IndexPath, () => kids);
    res.push(...kids.map((k) => k.id));
  }
  return { doc: out, ids: res };
}

export function makeClip(doc: Doc, ids: string[]): OpResult {
  const tops = topObjects(doc, ids);
  if (tops.length < 2) return { doc, ids: [] };
  const g = groupNodes(doc, tops);
  if (!g.ids.length) return g;
  const out = updateNodes(g.doc, g.ids, (n) => {
    if (n.kind !== 'group') return n;
    const kids = n.children.slice();
    const clip = kids[kids.length - 1];
    kids[kids.length - 1] = clip.kind === 'path' || clip.kind === 'compound' ? { ...clip, ap: { items: [], effects: clip.ap.effects } } : clip;
    return { ...n, clip: true, children: kids };
  });
  return { doc: out, ids: g.ids };
}

export function releaseClip(doc: Doc, ids: string[]): OpResult {
  let out = doc;
  const res: string[] = [];
  const targets = ids.map((id) => { const n = findNode(doc, id); if (n?.kind === 'group' && n.clip) return id; const p = pathOf(doc, id); if (!p) return null; for (let k = p.length - 1; k > 0; k--) { const a = nodeAt(doc, p.slice(0, k)); if (a?.kind === 'group' && a.clip) return a.id; } return null; }).filter((x): x is string => !!x);
  for (const id of inDocOrder(doc, targets).reverse()) {
    const n = findNode(out, id);
    if (!n || n.kind !== 'group') continue;
    out = updateAt(out, pathOf(out, id) as IndexPath, () => n.children);
    res.push(...n.children.map((c) => c.id));
  }
  return { doc: out, ids: res };
}

export function moveToParent(doc: Doc, ids: string[], parentId: string, index?: number): OpResult {
  const tops = topObjects(doc, ids).filter((id) => id !== parentId);
  const nodes = tops.map((id) => findNode(doc, id)).filter((n): n is VNode => !!n && n.kind !== 'layer');
  if (!nodes.length) return { doc, ids: [] };
  let out = removeNodes(doc, nodes.map((n) => n.id));
  const pp = pathOf(out, parentId);
  if (!pp) return { doc, ids: [] };
  const parent = nodeAt(out, pp);
  const len = parent ? (childrenOf(parent) ?? []).length : 0;
  out = insertInto(out, pp, index ?? len, nodes);
  return { doc: out, ids: nodes.map((n) => n.id) };
}

export function moveRelative(doc: Doc, ids: string[], targetId: string, where: 'above' | 'below' | 'inside'): OpResult {
  if (where === 'inside') return moveToParent(doc, ids, targetId);
  const tops = topObjects(doc, ids).filter((id) => id !== targetId);
  const nodes = tops.map((id) => findNode(doc, id)).filter((n): n is VNode => !!n);
  if (!nodes.length) return { doc, ids: [] };
  const target = findNode(doc, targetId);
  if (!target) return { doc, ids: [] };
  const isLayers = nodes.every((n) => n.kind === 'layer');
  if (nodes.some((n) => n.kind === 'layer') && !isLayers) return { doc, ids: [] };
  let out = removeNodes(doc, nodes.map((n) => n.id));
  const tp = pathOf(out, targetId);
  if (!tp) return { doc, ids: [] };
  if (isLayers && tp.length > 1 && target.kind !== 'layer') return { doc, ids: [] };
  const at = tp[tp.length - 1] + (where === 'above' ? 1 : 0);
  out = insertInto(out, tp.slice(0, -1), at, nodes);
  return { doc: out, ids: nodes.map((n) => n.id) };
}

export type AlignAction = 'left' | 'horizontal_center' | 'right' | 'top' | 'vertical_center' | 'bottom' | 'distribute_left' | 'distribute_horizontal_center' | 'distribute_right' | 'distribute_top' | 'distribute_vertical_center' | 'distribute_bottom' | 'distribute_horizontal_space' | 'distribute_vertical_space';

export function align(doc: Doc, ids: string[], action: AlignAction, to: Rect | null, key: string | null, spacing: number | null, preview = false): Doc {
  const tops = topObjects(doc, ids);
  const nodes = tops.map((id) => findNode(doc, id) as VNode).filter(Boolean);
  if (!nodes.length) return doc;
  const bb = (n: VNode): Rect => (preview ? visualBounds(doc, n) : geomBounds(doc, n));
  const ref: Rect = to ?? (key ? bb(findNode(doc, key) as VNode) : selectionBounds(doc, nodes, preview));
  const moves = new Map<string, [number, number]>();
  const set = (n: VNode, dx: number, dy: number): void => { if (n.id === key) return; moves.set(n.id, [dx, dy]); };
  if (!action.startsWith('distribute')) {
    for (const n of nodes) {
      const b = bb(n);
      if (action === 'left') set(n, ref.x - b.x, 0);
      else if (action === 'horizontal_center') set(n, ref.x + ref.w / 2 - (b.x + b.w / 2), 0);
      else if (action === 'right') set(n, ref.x + ref.w - (b.x + b.w), 0);
      else if (action === 'top') set(n, 0, ref.y - b.y);
      else if (action === 'vertical_center') set(n, 0, ref.y + ref.h / 2 - (b.y + b.h / 2));
      else if (action === 'bottom') set(n, 0, ref.y + ref.h - (b.y + b.h));
    }
  } else if (nodes.length >= 2) {
    const horiz = /left|right|horizontal/.test(action);
    const pos = (b: Rect): number => {
      switch (action) {
        case 'distribute_left': return b.x; case 'distribute_right': return b.x + b.w; case 'distribute_horizontal_center': return b.x + b.w / 2;
        case 'distribute_top': return b.y; case 'distribute_bottom': return b.y + b.h; case 'distribute_vertical_center': return b.y + b.h / 2;
        default: return horiz ? b.x : b.y;
      }
    };
    const sorted = [...nodes].sort((a, b) => pos(bb(a)) - pos(bb(b)));
    if (action === 'distribute_horizontal_space' || action === 'distribute_vertical_space') {
      const sizes = sorted.map((n) => (horiz ? bb(n).w : bb(n).h));
      const first = bb(sorted[0]), last = bb(sorted[sorted.length - 1]);
      const start = horiz ? first.x : first.y, end = horiz ? last.x + last.w : last.y + last.h;
      let gap = spacing ?? (end - start - sizes.reduce((a, c) => a + c, 0)) / (sorted.length - 1);
      if (key && spacing !== null) gap = spacing;
      let cur = start;
      if (key) { const kb = bb(findNode(doc, key) as VNode); const ki = sorted.findIndex((n) => n.id === key); cur = (horiz ? kb.x : kb.y) - sorted.slice(0, ki).reduce((a, n) => a + (horiz ? bb(n).w : bb(n).h) + gap, 0); }
      sorted.forEach((n, i) => { const b = bb(n); const want = cur; if (horiz) set(n, want - b.x, 0); else set(n, 0, want - b.y); cur += sizes[i] + gap; });
    } else {
      const a = pos(bb(sorted[0])), z = pos(bb(sorted[sorted.length - 1])), step = (z - a) / (sorted.length - 1);
      sorted.forEach((n, i) => { const d = a + step * i - pos(bb(n)); if (horiz) set(n, d, 0); else set(n, 0, d); });
    }
  }
  return updateNodes(doc, [...moves.keys()], (n) => { const [dx, dy] = moves.get(n.id) as [number, number]; return dx || dy ? transformNode(n, translate(dx, dy)) : n; });
}

export function setProps(doc: Doc, ids: string[], patch: Partial<Pick<VNode, 'name' | 'hidden' | 'locked' | 'opacity' | 'blend' | 'isolate' | 'knockout'>>): Doc {
  return updateNodes(doc, ids, (n) => ({ ...n, ...patch }) as VNode);
}

export function cleanDoc(doc: Doc): { doc: Doc; removed: number } {
  let removed = 0;
  const bad: string[] = [];
  const visit = (nodes: VNode[]): void => {
    for (const n of nodes) {
      if (n.kind === 'path' && (n.d.every((sp) => sp.pts.length < 2) || (!n.ap.items.some((i) => i.visible && i.paint.type !== 'none') && !n.guide))) bad.push(n.id);
      else if (n.kind === 'text' && !n.spans.some((s) => s.text.trim())) bad.push(n.id);
      const ch = childrenOf(n);
      if (ch && n.kind !== 'compound') visit(ch);
    }
  };
  for (const l of doc.layers) visit(l.children);
  removed = bad.length;
  return { doc: removed ? removeNodes(doc, bad) : doc, removed };
}

export function sortedByDepth(doc: Doc, ids: string[]): string[] { const idx = indexOf(doc); return [...ids].sort((a, b) => comparePaths(idx.get(a) ?? [], idx.get(b) ?? [])); }
export { NONE, mul };
