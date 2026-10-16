import { geomBounds, visualBounds } from '../engine/bounds';
import { newId } from '../engine/doc';
import { ARROWHEADS, arrowGeometry } from '../engine/effects';
import { anchor, apply, bezTangent, emptyRect, invert, isEmptyRect, mul, pathBounds, rectPath, segments, transformPath, unionRect } from '../engine/geometry';
import { hex, NONE, solid } from '../engine/paint';
import type { Anchor, Doc, FillRule, GroupNode, Mat, OpacityMask, Paint, PathData, PathNode, PatternDef, Pt, Rect, StrokeItem, VNode } from '../engine';

export type Style = Record<string, string>;

export interface RefCtx {
  doc: Doc;
  ids: Map<string, Element>;
  own: (e: Element) => Style;
  styleAt: (e: Element) => Style;
  walk: (e: Element, inherited: Style, m0: Mat, out: VNode[], depth: number) => void;
  shapeD: (e: Element) => PathData | null;
  parseTransform: (s: string | null) => Mat;
  len: (v: string | undefined, d?: number) => number;
  patterns: Map<string, PatternDef>;
  stack: Element[];
  note: (s: string) => void;
  setContext: (fill: string | undefined, stroke: string | undefined) => void;
}

const IDENT: Mat = [1, 0, 0, 1, 0, 0];
const FAR = 5e4;
const local = (e: Element): string => e.nodeName.toLowerCase().replace(/^.*:/, '');
const hrefOf = (e: Element): string => (e.getAttribute('href') ?? e.getAttribute('xlink:href') ?? '').replace(/^#/, '');
export const refId = (v: string | undefined | null): string | null => { const u = /url\(\s*['"]?#([^'")]+)['"]?\s*\)/.exec(v ?? ''); return u ? u[1] : null; };

function prop(e: Element, name: string): string | null {
  const st = e.getAttribute('style');
  if (st) for (const part of st.split(';')) { const i = part.indexOf(':'); if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim(); }
  return e.getAttribute(name);
}

const group = (children: VNode[], clip = false, name?: string): GroupNode => ({ id: newId('g'), kind: 'group', clip, children, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, ...(name ? { name } : {}) });
const pathNode = (d: PathData, rule: FillRule = 'nonzero'): PathNode => ({ id: newId('p'), kind: 'path', d, rule, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } });
const nums = (v: string | null | undefined): number[] => (v ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);

function chainOf(c: RefCtx, first: Element, tag: string): Element[] {
  const chain: Element[] = [first];
  let cur = first;
  for (let i = 0; i < 16; i++) {
    const h = hrefOf(cur), nx = h ? c.ids.get(h) : undefined;
    if (!nx || local(nx) !== tag || chain.includes(nx)) break;
    chain.push(nx);
    cur = nx;
  }
  return chain;
}

export function fitViewBox(vb: number[], w: number, h: number, par: string | null): Mat {
  const [vx, vy, vw, vh] = vb;
  if (!(vw > 0 && vh > 0)) return IDENT;
  const parts = (par ?? 'xMidYMid meet').trim().split(/\s+/).filter((s) => s !== 'defer'), align = parts[0] ?? 'xMidYMid', mode = parts[1] ?? 'meet';
  const sx = w / vw, sy = h / vh;
  if (align === 'none') return [sx, 0, 0, sy, -vx * sx, -vy * sy];
  const s = mode === 'slice' ? Math.max(sx, sy) : Math.min(sx, sy);
  const ax = /xMin/.test(align) ? 0 : /xMax/.test(align) ? 1 : 0.5, ay = /YMin/.test(align) ? 0 : /YMax/.test(align) ? 1 : 0.5;
  return [s, 0, 0, s, (w - vw * s) * ax - vx * s, (h - vh * s) * ay - vy * s];
}

export function userBox(c: RefCtx, nodes: VNode[], m: Mat): Rect | null {
  let r = emptyRect();
  for (const n of nodes) { try { r = unionRect(r, geomBounds(c.doc, n)); } catch { } }
  if (isEmptyRect(r)) return null;
  const inv = invert(m);
  let o = emptyRect();
  for (const p of [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }]) { const q = apply(inv, p.x, p.y); o = unionRect(o, { x: q.x, y: q.y, w: 0, h: 0 }); }
  return o;
}

const rectOf = (r: Rect): PathData => rectPath(r.x, r.y, r.w, r.h);

export function patternPaint(c: RefCtx, el: Element, m: Mat, ubox: Rect | null, depth: number): Paint | null {
  if (depth > 8 || c.stack.includes(el)) return null;
  const chain = chainOf(c, el, 'pattern');
  const attr = (k: string): string | null => { for (const p of chain) { const v = p.getAttribute(k); if (v !== null) return v; } return null; };
  const holder = chain.find((p) => p.children.length > 0);
  if (!holder) return NONE;
  const pt = c.parseTransform(attr('patternTransform')), pid = el.getAttribute('id') ?? '';
  c.stack.push(el);
  try {
    const hint = chain[0].getAttribute('data-formpth-pattern'), artEl = c.ids.get(chain[0].getAttribute('data-formpth-art') ?? '');
    if (hint && artEl) {
      const h = hint.trim().split(/\s+/), n = h.slice(1, 8).map(Number), type = h[0] as PatternDef['type'];
      if (['grid', 'brick_row', 'brick_col', 'hex_col', 'hex_row'].includes(type) && n.length === 7 && n.every(Number.isFinite) && n[2] > 0 && n[3] > 0) {
        const key = `${artEl.getAttribute('id') ?? pid}|native|${h.slice(1).join(' ')}`;
        let def = c.patterns.get(key);
        if (!def) {
          const kids: VNode[] = [];
          c.walk(artEl, artEl.parentElement ? c.styleAt(artEl.parentElement) : {}, IDENT, kids, depth + 1);
          let art: VNode = kids[0] ?? group([]);
          while (art.kind === 'group' && !art.clip && art.children.length === 1 && art.children[0].kind === 'group' && !art.name) art = art.children[0];
          const overlap: ['left' | 'right', 'top' | 'bottom'] = [h[8] === 'right' ? 'right' : 'left', h[9] === 'bottom' ? 'bottom' : 'top'];
          def = { id: newId('pat'), name: el.getAttribute('data-name') ?? (pid || 'SVG pattern'), tile: { x: n[0], y: n[1], w: n[2], h: n[3] }, art, type, hs: n[4], vs: n[5], brick: n[6], overlap };
          addPattern(c, key, def);
        }
        return { type: 'pattern', pattern: def.id, xf: mul(m, pt) };
      }
    }
    const unitsBox = (attr('patternUnits') ?? 'objectBoundingBox') === 'objectBoundingBox', contentBox = (attr('patternContentUnits') ?? 'userSpaceOnUse') === 'objectBoundingBox';
    const vbRaw = attr('viewBox') ? nums(attr('viewBox')) : null, vb = vbRaw && vbRaw.length === 4 && vbRaw.every(Number.isFinite) && vbRaw[2] > 0 && vbRaw[3] > 0 ? vbRaw : null;
    const needBox = unitsBox || (contentBox && !vb);
    if (needBox && (!ubox || !(ubox.w > 0) || !(ubox.h > 0))) { c.note('A pattern that depends on the bounding box was left out on an object without one.'); return null; }
    const f = (k: string, d: number): number => { const v = attr(k); if (v === null) return d; const q = parseFloat(v); if (!Number.isFinite(q)) return d; return unitsBox ? (v.trim().endsWith('%') ? q / 100 : q) : c.len(v, d); };
    const bx = ubox?.x ?? 0, by = ubox?.y ?? 0, bw = ubox?.w ?? 1, bh = ubox?.h ?? 1;
    const tile: Rect = unitsBox ? { x: bx + f('x', 0) * bw, y: by + f('y', 0) * bh, w: f('width', 0) * bw, h: f('height', 0) * bh } : { x: f('x', 0), y: f('y', 0), w: f('width', 0), h: f('height', 0) };
    if (!(tile.w > 0 && tile.h > 0)) return NONE;
    const key = `${pid}|${needBox || contentBox ? `${bx.toFixed(3)},${by.toFixed(3)},${bw.toFixed(3)},${bh.toFixed(3)}` : 'user'}`;
    let def = c.patterns.get(key);
    if (!def) {
      const cmat: Mat = vb ? fitViewBox(vb, tile.w, tile.h, attr('preserveAspectRatio')) : contentBox ? [bw, 0, 0, bh, 0, 0] : IDENT;
      const cm = mul([1, 0, 0, 1, tile.x, tile.y], cmat), kids: VNode[] = [], st = c.styleAt(holder);
      for (const k of Array.from(holder.children)) c.walk(k, st, cm, kids, depth + 1);
      if (!kids.length) return NONE;
      let spill = false;
      for (const k of kids) { try { const b = visualBounds(c.doc, k); if (!isEmptyRect(b) && (b.x < tile.x - 0.5 || b.y < tile.y - 0.5 || b.x + b.w > tile.x + tile.w + 0.5 || b.y + b.h > tile.y + tile.h + 0.5)) spill = true; } catch { } }
      const art = spill ? group([...kids, pathNode(rectOf(tile))], true) : group(kids);
      def = { id: newId('pat'), name: el.getAttribute('data-name') ?? (pid || 'SVG pattern'), tile, art, type: 'grid', hs: 0, vs: 0 };
      addPattern(c, key, def);
    }
    return { type: 'pattern', pattern: def.id, xf: mul(m, pt) };
  } finally { c.stack.pop(); }
}

function addPattern(c: RefCtx, key: string, def: PatternDef): void {
  c.patterns.set(key, def);
  c.doc.patterns.push(def);
  c.doc.swatches.push({ id: newId('s'), name: def.name, paint: { type: 'pattern', pattern: def.id, xf: [1, 0, 0, 1, 0, 0] }, global: false, spot: false });
}

const WHITE = { kind: 'rgb' as const, r: 255, g: 255, b: 255 };
function whiten(p: Paint): Paint {
  if (p.type === 'color') return solid(WHITE);
  if (p.type === 'gradient') return { ...p, gradient: { ...p.gradient, stops: p.gradient.stops.map((s) => ({ ...s, color: WHITE })), points: p.gradient.points?.map((q) => ({ ...q, color: WHITE })) } };
  return p;
}

export function alphaOnly(n: VNode): VNode {
  const items = n.ap.items.map((i) => ({ ...i, paint: whiten(i.paint) }));
  const base = { ...n, ap: { ...n.ap, items } } as VNode;
  if (base.kind === 'text') return { ...base, spans: base.spans.map((s) => ({ ...s, style: { ...s.style, fill: whiten(s.style.fill), stroke: whiten(s.style.stroke) } })) };
  if (base.kind === 'group' || base.kind === 'layer') return { ...base, children: base.children.map(alphaOnly) };
  if (base.kind === 'compound') return { ...base, children: base.children.map((k) => alphaOnly(k) as PathNode) };
  return base;
}

export function maskOf(c: RefCtx, ref: string, m: Mat, nodes: VNode[], depth: number): OpacityMask | null {
  const el = c.ids.get(ref);
  if (!el || local(el) !== 'mask' || depth > 12 || c.stack.includes(el)) return null;
  const unitsBox = (el.getAttribute('maskUnits') ?? 'objectBoundingBox') === 'objectBoundingBox', contentBox = el.getAttribute('maskContentUnits') === 'objectBoundingBox';
  const ub = unitsBox || contentBox ? userBox(c, nodes, m) : null;
  if ((unitsBox || contentBox) && (!ub || !(ub.w > 0) || !(ub.h > 0))) { c.note(`Mask "${ref}" was left out on an object without a size.`); return null; }
  const cm: Mat = contentBox && ub ? mul(m, [ub.w, 0, 0, ub.h, ub.x, ub.y]) : m;
  const kids: VNode[] = [], st = c.styleAt(el);
  c.stack.push(el);
  try { for (const k of Array.from(el.children)) c.walk(k, st, cm, kids, depth + 1); } finally { c.stack.pop(); }
  if (!kids.length) return { art: group([]), clip: true, invert: false, disabled: false, linked: true };
  const fr = (k: string, d: number): number => { const v = el.getAttribute(k); if (v === null) return d; const q = parseFloat(v); if (!Number.isFinite(q)) return d; return unitsBox ? (v.trim().endsWith('%') ? q / 100 : q) : c.len(v, d); };
  let region: Rect | null = null;
  if (unitsBox && ub) region = { x: ub.x + fr('x', -0.1) * ub.w, y: ub.y + fr('y', -0.1) * ub.h, w: fr('width', 1.2) * ub.w, h: fr('height', 1.2) * ub.h };
  else if (!unitsBox) region = { x: fr('x', -FAR), y: fr('y', -FAR), w: fr('width', 2 * FAR), h: fr('height', 2 * FAR) };
  const alpha = (prop(el, 'mask-type') ?? 'luminance') === 'alpha';
  let list = alpha ? kids.map(alphaOnly) : kids;
  if (region && region.w > 0 && region.h > 0 && region.w < FAR && region.h < FAR) list = [group([...list, pathNode(transformPath(rectOf(region), m))], true)];
  return { art: list.length === 1 && list[0].kind === 'group' ? list[0] : group(list), clip: true, invert: false, disabled: false, linked: true };
}

export function clipOf(c: RefCtx, ref: string, m: Mat, ubox: () => Rect | null): PathNode | null {
  const ce = c.ids.get(ref);
  if (!ce || local(ce) !== 'clippath') return null;
  let cm = m;
  if (ce.getAttribute('clipPathUnits') === 'objectBoundingBox') { const b = ubox(); if (!b || !(b.w > 0) || !(b.h > 0)) return null; cm = mul(m, [b.w, 0, 0, b.h, b.x, b.y]); }
  cm = mul(cm, c.parseTransform(ce.getAttribute('transform')));
  const cd: PathData = [];
  let rule: FillRule = 'nonzero', first = true;
  for (const ch of Array.from(ce.children)) {
    let target: Element = ch, tm = mul(cm, c.parseTransform(ch.getAttribute('transform')));
    if (local(ch) === 'use') {
      const r = c.ids.get(hrefOf(ch));
      if (!r) continue;
      target = r;
      tm = mul(mul(tm, [1, 0, 0, 1, c.len(ch.getAttribute('x') ?? undefined), c.len(ch.getAttribute('y') ?? undefined)]), c.parseTransform(r.getAttribute('transform')));
    }
    if (['text', 'image'].includes(local(target))) { c.note('Text inside a clip path was left out of the clip.'); continue; }
    if (prop(ch, 'display') === 'none') continue;
    const d = c.shapeD(target);
    if (!d) continue;
    cd.push(...transformPath(d, tm));
    if (first) { rule = (c.own(ch)['clip-rule'] ?? prop(ce, 'clip-rule')) === 'evenodd' ? 'evenodd' : 'nonzero'; first = false; }
  }
  return cd.length ? pathNode(cd, rule) : null;
}

interface Vertex { p: Pt; a: Pt | null; b: Pt | null; role: 'start' | 'mid' | 'end' }

function vertices(d: PathData): Vertex[] {
  const out: Vertex[] = [];
  for (const sp of d) {
    const n = sp.pts.length;
    if (!n) continue;
    const segs = segments(sp), pt = (i: number): Pt => ({ x: sp.pts[i].x, y: sp.pts[i].y });
    if (n === 1) { out.push({ p: pt(0), a: null, b: null, role: 'mid' }); continue; }
    if (sp.closed) {
      const last = segs[segs.length - 1], first = segs[0];
      out.push({ p: pt(0), a: bezTangent(last, 1), b: bezTangent(first, 0), role: 'mid' });
      for (let i = 1; i < n; i++) out.push({ p: pt(i), a: bezTangent(segs[i - 1], 1), b: bezTangent(segs[i], 0), role: 'mid' });
      out.push({ p: pt(0), a: bezTangent(last, 1), b: bezTangent(first, 0), role: 'mid' });
    } else {
      out.push({ p: pt(0), a: null, b: bezTangent(segs[0], 0), role: 'mid' });
      for (let i = 1; i < n - 1; i++) out.push({ p: pt(i), a: bezTangent(segs[i - 1], 1), b: bezTangent(segs[i], 0), role: 'mid' });
      out.push({ p: pt(n - 1), a: bezTangent(segs[n - 2], 1), b: null, role: 'mid' });
    }
  }
  if (out.length) { out[0].role = 'start'; out[out.length - 1].role = 'end'; if (out.length === 1) out[0].role = 'start'; }
  return out;
}

function headPoints(kind: string): Anchor[][] | null {
  const line: PathData = [{ closed: false, pts: [anchor(-10, 0), anchor(0, 0)] }];
  const s = { width: 1, startArrow: 'none', endArrow: kind, arrowScale: [100, 100], arrowAlign: 'tip' } as unknown as StrokeItem;
  const g = arrowGeometry(line, s);
  return g ? g.map((sp) => sp.pts) : null;
}

function matchHead(art: VNode[], strokeHex: string | null): { kind: string; size: number } | null {
  if (art.length !== 1 || art[0].kind !== 'path') return null;
  const n = art[0];
  if (n.ap.items.length !== 1 || n.ap.items[0].kind !== 'fill' || n.opacity < 1 || n.mask) return null;
  const fp = n.ap.items[0].paint;
  if (fp.type !== 'color' || !strokeHex || hex(fp.color).toLowerCase() !== strokeHex.toLowerCase()) return null;
  const cb = pathBounds(n.d);
  if (isEmptyRect(cb) || !(cb.w > 0)) return null;
  const cpts = n.d.map((sp) => sp.pts);
  if (Math.abs(cb.x + cb.w) > 0.06 * cb.w || Math.abs(cb.y + cb.h / 2) > 0.1 * cb.w) return null;
  for (const kind of ARROWHEADS) {
    if (kind === 'none') continue;
    const hp = headPoints(kind);
    if (!hp || hp.length !== cpts.length) continue;
    const flat = hp.flat(), hw = Math.max(...flat.map((p) => p.x)) - Math.min(...flat.map((p) => p.x));
    if (!(hw > 0)) continue;
    const s = cb.w / hw, tol = 0.07 * cb.w, close = (ax: number, ay: number, bx: number, by: number): boolean => Math.hypot(ax - bx, ay - by) < tol;
    const same = (q: Anchor, p: Anchor): boolean => close(q.x, q.y, p.x * s, p.y * s) && close(q.ix, q.iy, p.ix * s, p.iy * s) && close(q.ox, q.oy, p.ox * s, p.oy * s);
    const cf = cpts.flat();
    let ok = hp.every((sp, i) => sp.length === cpts[i].length);
    if (ok) ok = flat.every((p) => cf.some((q) => same(q, p))) && cf.every((q) => flat.some((p) => same(q, p)));
    if (ok) return { kind, size: s };
  }
  return null;
}

export interface MarkerInput { tag: string; d: PathData; st: Style; m: Mat; strokeWidth: number; fillValue: string | undefined; strokeValue: string | undefined; strokeHex: string | null; hasStroke: boolean }
export interface MarkerOut { start: { kind: string; pct: number } | null; end: { kind: string; pct: number } | null; art: VNode[] }

export function markers(c: RefCtx, inp: MarkerInput, depth: number): MarkerOut {
  const out: MarkerOut = { start: null, end: null, art: [] };
  const refs = { start: refId(inp.st['marker-start']), mid: refId(inp.st['marker-mid']), end: refId(inp.st['marker-end']) };
  if (!refs.start && !refs.mid && !refs.end) return out;
  const verts = vertices(inp.d);
  if (!verts.length || verts.length > 2000) return out;
  const single = inp.d.length === 1 && !inp.d[0].closed && inp.d[0].pts.length > 1 && inp.tag !== 'polygon';
  for (const v of verts) {
    const id = v.role === 'start' ? refs.start : v.role === 'end' ? refs.end : refs.mid;
    if (!id) continue;
    const mk = c.ids.get(id);
    if (!mk || local(mk) !== 'marker') continue;
    const mw = c.len(mk.getAttribute('markerWidth') ?? undefined, 3), mh = c.len(mk.getAttribute('markerHeight') ?? undefined, 3);
    if (!(mw > 0 && mh > 0)) continue;
    const vbRaw = nums(mk.getAttribute('viewBox')), vb = vbRaw.length === 4 && vbRaw.every(Number.isFinite) && vbRaw[2] > 0 && vbRaw[3] > 0 ? vbRaw : null;
    const V: Mat = vb ? fitViewBox(vb, mw, mh, mk.getAttribute('preserveAspectRatio')) : IDENT;
    const ref = apply(V, c.len(mk.getAttribute('refX') ?? undefined), c.len(mk.getAttribute('refY') ?? undefined));
    const units = mk.getAttribute('markerUnits') === 'userSpaceOnUse' ? 1 : inp.strokeWidth;
    const orient = (mk.getAttribute('orient') ?? '0').trim();
    let ang = 0;
    if (orient === 'auto' || orient === 'auto-start-reverse') {
      const a = v.a, b = v.b;
      if (a && b) { const a1 = Math.atan2(a.y, a.x), a2 = Math.atan2(b.y, b.x); let dd = a2 - a1; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd <= -Math.PI) dd += 2 * Math.PI; ang = a1 + dd / 2; }
      else { const t = a ?? b; ang = t ? Math.atan2(t.y, t.x) : 0; }
      if (orient === 'auto-start-reverse' && v.role === 'start') ang += Math.PI;
    } else ang = ((parseFloat(orient) || 0) * Math.PI) / 180;
    const co = Math.cos(ang), si = Math.sin(ang);
    const T: Mat = [co * units, si * units, -si * units, co * units, v.p.x, v.p.y];
    const st = c.styleAt(mk);
    c.setContext(inp.fillValue, inp.strokeValue);
    try {
      if (single && inp.hasStroke && !(v.role === 'mid') && ((v.role === 'end' && (orient === 'auto' || orient === 'auto-start-reverse')) || (v.role === 'start' && orient === 'auto-start-reverse')) && inp.strokeWidth > 0) {
        const probe: VNode[] = [];
        for (const k of Array.from(mk.children)) c.walk(k, st, mul([1, 0, 0, 1, -ref.x, -ref.y], V), probe, depth + 1);
        const hit = matchHead(probe, inp.strokeHex);
        if (hit) {
          const pick = { kind: hit.kind, pct: Math.round((100 * hit.size * units) / inp.strokeWidth * 100) / 100 };
          if (v.role === 'start') out.start = pick; else out.end = pick;
          continue;
        }
      }
      const kids: VNode[] = [];
      const lm = mul(inp.m, mul(T, mul([1, 0, 0, 1, -ref.x, -ref.y], V)));
      for (const k of Array.from(mk.children)) c.walk(k, st, lm, kids, depth + 1);
      if (!kids.length) continue;
      const ov = (prop(mk, 'overflow') ?? 'hidden').trim();
      if (ov !== 'visible' && ov !== 'auto') {
        const vp = transformPath(rectPath(0, 0, mw, mh), mul(inp.m, mul(T, [1, 0, 0, 1, -ref.x, -ref.y]))), vbnd = pathBounds(vp);
        let spill = false;
        for (const k of kids) { try { const b = visualBounds(c.doc, k); if (!isEmptyRect(b) && (b.x < vbnd.x - 0.5 || b.y < vbnd.y - 0.5 || b.x + b.w > vbnd.x + vbnd.w + 0.5 || b.y + b.h > vbnd.y + vbnd.h + 0.5)) spill = true; } catch { } }
        if (spill) { out.art.push(group([...kids, pathNode(vp)], true, 'Marker')); continue; }
      }
      out.art.push(group(kids, false, 'Marker'));
    } finally { c.setContext(undefined, undefined); }
  }
  return out;
}
