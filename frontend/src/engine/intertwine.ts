import { geomBounds } from './bounds';
import { childrenOf, cloneNode, newId } from './doc';
import { flattenSub, isEmptyRect, pathBounds, pointInPolygon, polyToPath, rectsTouch, rectToPath, transformPath } from './geometry';
import { area, boolean, interiorPoint, regionParts, resolveSelf, strokeToPath, uniteAll } from './kernel';
import { emptyAppearance } from './paint';
import { textOutline } from './text';
import type { Doc, FillRule, GroupNode, IntertwineSpec, Mat, PathData, PathNode, Pt, VNode } from './types';

const polyCache = new WeakMap<PathData, Pt[][]>();
export function inArea(d: PathData, p: Pt): boolean {
  let polys = polyCache.get(d);
  if (!polys) { polys = d.filter((sp) => sp.pts.length > 1).map((sp) => flattenSub({ ...sp, closed: true }, 0.5)); polyCache.set(d, polys); }
  let w = 0;
  for (const poly of polys) w += pointInPolygon(p, poly);
  return w !== 0;
}

const areaCache = new WeakMap<VNode, PathData>();
export function memberArea(doc: Doc, n: VNode): PathData {
  const c = areaCache.get(n);
  if (c) return c;
  let d: PathData = [];
  try { d = computeArea(doc, n); } catch { d = []; }
  if (!d.length && !n.hidden) { const b = geomBounds(doc, n); if (!isEmptyRect(b) && b.w > 0 && b.h > 0) d = rectToPath(b); }
  areaCache.set(n, d);
  return d;
}

function computeArea(doc: Doc, n: VNode): PathData {
  if (n.hidden) return [];
  if (n.kind === 'path' || n.kind === 'compound') {
    if (n.kind === 'path' && n.guide) return [];
    const d = n.kind === 'path' ? n.d : n.children.flatMap((k) => k.d);
    const solid = d.filter((sp) => sp.pts.length > 2).map((sp) => ({ ...sp, closed: true }));
    const filled = n.ap.items.some((i) => i.kind === 'fill' && i.visible && i.paint.type !== 'none');
    const parts: Array<{ d: PathData; rule: FillRule }> = [];
    if (filled && solid.length) parts.push({ d: solid, rule: n.rule });
    for (const it of n.ap.items) {
      if (it.kind !== 'stroke' || !it.visible || it.paint.type === 'none' || it.width <= 0) continue;
      if (it.align === 'inside' && filled) continue;
      const s = strokeToPath(d, it.align === 'outside' ? it.width * 2 : it.width, it.cap, it.join, it.miter);
      if (s.length) parts.push({ d: s, rule: 'nonzero' });
    }
    if (!parts.length && solid.length) parts.push({ d: solid, rule: n.rule });
    if (!parts.length) return [];
    return parts.length === 1 && !filled ? parts[0].d : uniteAll(parts);
  }
  if (n.kind === 'text') { const t = textOutline(n); return t && t.length ? resolveSelf(t, 'nonzero') : []; }
  if (n.kind === 'group') {
    const kids = n.clip && n.children.length > 1 ? [n.children[n.children.length - 1]] : n.children;
    const parts = kids.map((k) => ({ d: memberArea(doc, k), rule: 'nonzero' as FillRule })).filter((x) => x.d.length);
    return parts.length === 1 ? parts[0].d : uniteAll(parts);
  }
  return [];
}

const faceCache = new WeakMap<VNode[], Map<string, PathData[]>>();
export function overlapAt(doc: Doc, g: GroupNode, p: Pt): { region: PathData; inside: number[] } | null {
  const kids = g.children, areas = kids.map((k) => memberArea(doc, k));
  const inside = kids.map((_, i) => i).filter((i) => !kids[i].hidden && areas[i].length > 0 && inArea(areas[i], p));
  if (inside.length < 2) return null;
  let m = faceCache.get(kids);
  if (!m) { m = new Map(); faceCache.set(kids, m); }
  const key = inside.join(',');
  let parts = m.get(key);
  if (!parts) {
    let r = areas[inside[0]];
    for (const i of inside.slice(1)) if (r.length) r = boolean(r, areas[i], 'intersect');
    kids.forEach((k, j) => {
      if (!r.length || inside.includes(j) || k.hidden || !areas[j].length) return;
      if (rectsTouch(pathBounds(r), pathBounds(areas[j]))) r = boolean(r, areas[j], 'subtract');
    });
    parts = r.length ? regionParts(r) : [];
    m.set(key, parts);
  }
  const region = parts.find((d) => inArea(d, p));
  return region ? { region, inside } : null;
}

export function intertwineTopAt(g: GroupNode, inside: number[], p: Pt): number {
  const zs = g.intertwine?.zones ?? [];
  for (let k = zs.length - 1; k >= 0; k--) {
    const z = zs[k], i = g.children.findIndex((c) => c.id === z.top);
    if (i >= 0 && inside.includes(i) && inArea(z.d, p)) return i;
  }
  return inside[inside.length - 1];
}

function withZone(g: GroupNode, region: PathData, top: string | null): IntertwineSpec {
  const rb = pathBounds(region), zones: IntertwineSpec['zones'] = [];
  for (const z of g.intertwine?.zones ?? []) {
    if (!rectsTouch(rb, pathBounds(z.d))) { zones.push(z); continue; }
    const d = boolean(z.d, region, 'subtract');
    if (d.length && area(d) > 0.01) zones.push({ ...z, d });
  }
  if (top) zones.push({ d: region, top });
  return { zones };
}

export function intertwineFlip(doc: Doc, g: GroupNode, p: Pt): IntertwineSpec | null {
  const o = overlapAt(doc, g, p);
  if (!o) return null;
  const k = o.inside.indexOf(intertwineTopAt(g, o.inside, p));
  const next = o.inside[k > 0 ? k - 1 : o.inside.length - 1];
  return withZone(g, o.region, next === o.inside[o.inside.length - 1] ? null : g.children[next].id);
}

export function intertwineLasso(doc: Doc, g: GroupNode, loop: Pt[]): IntertwineSpec | null {
  if (loop.length < 3) return null;
  const L = resolveSelf(polyToPath(loop, true), 'nonzero');
  if (!L.length) return null;
  const kids = g.children, areas = kids.map((k) => memberArea(doc, k));
  const cut = kids.map((k, i) => (k.hidden || !areas[i].length ? [] : boolean(areas[i], L, 'intersect')));
  const touched = kids.map((_, i) => i).filter((i) => cut[i].length > 0 && area(cut[i]) > 0.01);
  if (touched.length < 2) return null;
  let ov: PathData = [];
  for (let a = 0; a < touched.length; a++) for (let b = a + 1; b < touched.length; b++) {
    const x = boolean(cut[touched[a]], cut[touched[b]], 'intersect');
    if (x.length) ov = ov.length ? boolean(ov, x, 'unite') : x;
  }
  if (!ov.length || area(ov) < 0.01) return null;
  const q = interiorPoint(regionParts(ov)[0] ?? ov);
  if (!q) return null;
  const inside = touched.filter((i) => inArea(areas[i], q));
  if (inside.length < 2) return null;
  const k = inside.indexOf(intertwineTopAt(g, inside, q));
  const next = inside[k > 0 ? k - 1 : inside.length - 1];
  const zone = boolean(ov, areas[next], 'intersect');
  return zone.length ? withZone(g, zone, kids[next].id) : null;
}

function reid<T extends VNode>(n: T, sfx: string): T {
  const out = { ...n, id: `${n.id}${sfx}` } as T;
  const ch = childrenOf(n);
  if (ch) (out as unknown as { children: VNode[] }).children = ch.map((c) => reid(c, sfx));
  if (out.kind === 'text' && out.next) delete (out as { next?: string }).next;
  return out;
}

const overlayCache = new WeakMap<GroupNode, GroupNode[]>();
export function intertwineOverlays(g: GroupNode): GroupNode[] {
  const hit = overlayCache.get(g);
  if (hit) return hit;
  const out: GroupNode[] = [];
  (g.intertwine?.zones ?? []).forEach((z, i) => {
    const m = g.children.find((c) => c.id === z.top);
    if (!m || m.hidden || !z.d.length) return;
    const clip: PathNode = { id: `${g.id}~zc${i}`, kind: 'path', d: z.d, rule: 'nonzero', opacity: 1, blend: 'normal', ap: emptyAppearance() };
    out.push({ id: `${g.id}~z${i}`, kind: 'group', clip: true, children: [reid(m, `~z${i}`), clip], opacity: 1, blend: 'normal', ap: emptyAppearance() });
  });
  overlayCache.set(g, out);
  return out;
}

export function intertwineHit(doc: Doc, g: GroupNode, p: Pt): VNode | null {
  const zs = g.intertwine?.zones ?? [];
  for (let k = zs.length - 1; k >= 0; k--) {
    const z = zs[k];
    if (!inArea(z.d, p)) continue;
    const m = g.children.find((c) => c.id === z.top);
    if (m && !m.hidden && inArea(memberArea(doc, m), p)) return m;
  }
  return null;
}

export function intertwineNode(nodes: VNode[], id = newId('g')): GroupNode {
  return { id, kind: 'group', name: 'Intertwine', clip: false, children: nodes, opacity: 1, blend: 'normal', ap: emptyAppearance(), intertwine: { zones: [] } };
}

export function intertwineOverlapping(doc: Doc, nodes: VNode[]): boolean {
  const areas = nodes.map((n) => memberArea(doc, n));
  for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
    if (!areas[a].length || !areas[b].length || !rectsTouch(pathBounds(areas[a]), pathBounds(areas[b]))) continue;
    const x = boolean(areas[a], areas[b], 'intersect');
    if (x.length && area(x) > 0.01) return true;
  }
  return false;
}

export function expandedIntertwine(g: GroupNode): GroupNode {
  const overlays = intertwineOverlays(g).map((o) => cloneNode(o));
  return { ...g, intertwine: undefined, name: g.name === 'Intertwine' ? 'Intertwine (expanded)' : g.name, children: [...g.children, ...overlays] };
}

export function transformIntertwine(s: IntertwineSpec, m: Mat): IntertwineSpec { return { zones: s.zones.map((z) => ({ ...z, d: transformPath(z.d, m) })) }; }
