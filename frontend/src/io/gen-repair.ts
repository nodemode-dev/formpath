import { geomBounds } from '../engine/bounds';
import { cloneNode, newDoc, newId } from '../engine/doc';
import { isEmptyRect, parseSvgD, pathBounds } from '../engine/geometry';
import { parseColor } from '../engine/paint';
import { transformNode } from '../engine/transform';
import { BLEND_MODES } from '../engine/types';
import type { Doc, GroupNode, Mat, Paint, PathNode, Project, Rect, StrokeItem, VNode } from '../engine';
import { renderRegion } from './raster';
import type { Limits } from './gen-options';

const ALLOWED = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'lineargradient', 'radialgradient', 'stop', 'title', 'desc']);
const SHAPE_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const PROPER: Record<string, string> = { lineargradient: 'linearGradient', radialgradient: 'radialGradient' };
const ATTRS = new Set(['viewbox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'd', 'points', 'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity', 'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'spreadmethod', 'id', 'data-name', 'mix-blend-mode', 'style', 'xmlns', 'href', 'xlink:href', 'xmlns:xlink']);
const STYLE_PROPS = new Set(['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity', 'stop-color', 'stop-opacity', 'mix-blend-mode']);
const NUMERIC = ['x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'x1', 'y1', 'x2', 'y2'];
const BLENDS = new Set(BLEND_MODES.map((b) => b.css as string).filter((c) => c !== 'source-over'));
const MAX_SVG = 600_000, MAX_NODES = 6000;

export interface Report { dropped: string[]; fixed: string[]; notes: string[] }
export const emptyReport = (): Report => ({ dropped: [], fixed: [], notes: [] });
export const reportLines = (r: Report): string[] => [...r.dropped.map((s) => `Dropped ${s}`), ...r.fixed.map((s) => `Fixed ${s}`), ...r.notes];
export const reportText = (r: Report): string => { const l = reportLines(r).map((s) => s.replace(/[.\s]+$/, '')); return l.length ? `${l.join('. ')}.` : ''; };

class Tally {
  private readonly d = new Map<string, number>();
  private readonly f = new Map<string, number>();
  private readonly n: string[] = [];
  drop(label: string, by = 1): void { this.d.set(label, (this.d.get(label) ?? 0) + by); }
  fix(label: string, by = 1): void { this.f.set(label, (this.f.get(label) ?? 0) + by); }
  note(s: string): void { if (!this.n.includes(s)) this.n.push(s); }
  report(): Report {
    const fmt = (m: Map<string, number>): string[] => [...m.entries()].map(([k, v]) => (v > 1 ? `${v} ${k}` : `1 ${k}`));
    return { dropped: fmt(this.d), fixed: fmt(this.f), notes: [...this.n] };
  }
}

export function extractSvg(text: string): string | null {
  const a = text.search(/<svg[\s>]/i), z = text.toLowerCase().lastIndexOf('</svg>');
  if (a < 0) return null;
  if (z < a) return text.slice(a).replace(/`{3}[\s\S]*$/, '');
  return text.slice(a, z + 6);
}

const num = (v: string | null | undefined): number => (v === null || v === undefined || !v.trim() ? NaN : Number(v.trim().replace(/(px|pt)$/, '')));
const frac = (v: string): number => { const s = v.trim(); return s.endsWith('%') ? parseFloat(s) / 100 : Number(s); };

function styleMap(e: Element): Map<string, string> {
  const m = new Map<string, string>();
  for (const part of (e.getAttribute('style') ?? '').split(';')) { const i = part.indexOf(':'); if (i > 0) m.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim()); }
  return m;
}
function writeStyle(e: Element, m: Map<string, string>): void {
  const s = [...m.entries()].map(([k, v]) => `${k}:${v}`).join(';');
  if (s) e.setAttribute('style', s); else e.removeAttribute('style');
}
const getProp = (e: Element, k: string, sm: Map<string, string>): string | null => sm.get(k) ?? e.getAttribute(k);
function setProp(e: Element, k: string, v: string | null, sm: Map<string, string>): void {
  if (sm.has(k)) { if (v === null) sm.delete(k); else sm.set(k, v); } else if (v === null) e.removeAttribute(k); else e.setAttribute(k, v);
}

function parseLenient(src: string, t: Tally): Element {
  let dom = new DOMParser().parseFromString(src, 'image/svg+xml');
  if (dom.querySelector('parsererror')) {
    const html = new DOMParser().parseFromString(src, 'text/html').querySelector('svg');
    if (!html) throw new Error('The model did not answer with readable SVG.');
    for (const e of [html, ...Array.from(html.querySelectorAll('*'))]) for (const a of Array.from(e.attributes)) if (!/^[A-Za-z_][\w:.-]*$/.test(a.name)) e.removeAttribute(a.name);
    dom = new DOMParser().parseFromString(new XMLSerializer().serializeToString(html), 'image/svg+xml');
    if (dom.querySelector('parsererror')) throw new Error('The model did not answer with readable SVG.');
    t.fix('malformed markup (unclosed or stray tags)');
  }
  const root = dom.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg') throw new Error('The model did not answer with readable SVG.');
  return root;
}

interface GradInfo { ok: boolean; first: string | null }

function checkGradients(root: Element, t: Tally): Map<string, GradInfo> {
  const info = new Map<string, GradInfo>();
  const all = Array.from(root.querySelectorAll('*')).filter((e) => /^(linear|radial)gradient$/i.test(e.localName));
  const refs = new Map<string, Element>();
  for (const g of all) { const id = g.getAttribute('id'); if (id) refs.set(id, g); }
  const stopsOf = (g: Element, seen = new Set<Element>()): Element[] => {
    if (seen.has(g)) return [];
    seen.add(g);
    const own = Array.from(g.children).filter((c) => c.localName.toLowerCase() === 'stop');
    if (own.length) return own;
    const h = (g.getAttribute('href') ?? g.getAttribute('xlink:href') ?? '').replace(/^#/, '');
    const nx = h ? refs.get(h) : undefined;
    return nx ? stopsOf(nx, seen) : [];
  };
  for (const g of all) {
    const id = g.getAttribute('id') ?? '';
    for (const k of ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'fx', 'fy']) { const v = g.getAttribute(k); if (v !== null && !Number.isFinite(frac(v))) { g.removeAttribute(k); t.fix('unreadable gradient coordinates'); } }
    if (g.localName.toLowerCase() === 'radialgradient' && g.hasAttribute('r') && !(frac(g.getAttribute('r') ?? '') > 0)) { g.removeAttribute('r'); t.fix('unreadable gradient coordinates'); }
    const u = g.getAttribute('gradientUnits');
    if (u && u !== 'objectBoundingBox' && u !== 'userSpaceOnUse') { g.removeAttribute('gradientUnits'); t.fix('gradient units'); }
    const sm = g.getAttribute('spreadMethod');
    if (sm && !['pad', 'reflect', 'repeat'].includes(sm)) { g.removeAttribute('spreadMethod'); t.fix('gradient spread method'); }
    let last = 0, good = 0, first: string | null = null;
    for (const s of stopsOf(g)) {
      const own = s.parentElement === g, ssm = styleMap(s);
      const col = getProp(s, 'stop-color', ssm) ?? '#000000';
      if (!parseColor(col)) { if (own) { s.remove(); t.drop('gradient stops with unreadable colours'); } continue; }
      if (own) {
        let off = s.hasAttribute('offset') ? frac(s.getAttribute('offset') ?? '0') : 0;
        if (!Number.isFinite(off)) off = last;
        const c = Math.max(last, Math.max(0, Math.min(1, off)));
        if (c !== off || !s.hasAttribute('offset')) { s.setAttribute('offset', String(c)); t.fix('gradient stop offsets'); }
        last = c;
        const so = getProp(s, 'stop-opacity', ssm);
        if (so !== null) { const v = frac(so); const cl = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1; if (cl !== v) { setProp(s, 'stop-opacity', String(cl), ssm); writeStyle(s, ssm); t.fix('stop opacity'); } }
      }
      good++;
      first ??= col;
    }
    info.set(id, { ok: good >= 2, first });
    if (good < 2 && id) t.note(good ? `Gradient "${id}" had one stop and became a solid colour.` : `Gradient "${id}" had no usable stops and was replaced by grey.`);
  }
  return info;
}

function fixPaintProp(e: Element, prop: 'fill' | 'stroke', grads: Map<string, GradInfo>, t: Tally): void {
  const sm = styleMap(e), v = getProp(e, prop, sm);
  if (v === null) return;
  const s = v.trim();
  if (!s || /^(none|transparent|currentcolor|inherit)$/i.test(s)) return;
  const u = /^url\(\s*['"]?#([^'")]+)['"]?\s*\)\s*(.*)$/i.exec(s);
  if (u) {
    const g = grads.get(u[1]);
    if (g?.ok) return;
    const fb = g?.first && parseColor(g.first) ? g.first : (u[2] && parseColor(u[2]) ? u[2] : prop === 'fill' ? '#808080' : 'none');
    setProp(e, prop, fb, sm); writeStyle(e, sm);
    t.fix(g ? 'gradients with fewer than two stops' : 'gradient references that point nowhere');
    return;
  }
  if (parseColor(s)) return;
  setProp(e, prop, prop === 'fill' ? '#808080' : 'none', sm); writeStyle(e, sm);
  t.fix('unreadable colours');
}

function fixScalars(e: Element, W: number, H: number, t: Tally): void {
  const sm = styleMap(e);
  const edit = (k: string, f: (v: string) => string | null, label: string): void => {
    const v = getProp(e, k, sm);
    if (v === null) return;
    const out = f(v);
    if (out === v) return;
    setProp(e, k, out, sm);
    t.fix(label);
  };
  for (const k of ['opacity', 'fill-opacity', 'stroke-opacity']) edit(k, (v) => { const n = frac(v); return Number.isFinite(n) ? String(Math.max(0, Math.min(1, n))) : null; }, 'opacity values outside 0 to 1');
  edit('stroke-width', (v) => { const n = num(v); return Number.isFinite(n) ? String(Math.max(0, Math.min(Math.max(W, H) / 4, n))) : null; }, 'stroke widths');
  edit('stroke-linecap', (v) => (['butt', 'round', 'square'].includes(v.trim()) ? v : null), 'stroke caps');
  edit('stroke-linejoin', (v) => (['miter', 'round', 'bevel'].includes(v.trim()) ? v : v.trim() === 'miter-clip' || v.trim() === 'arcs' ? 'miter' : null), 'stroke joins');
  edit('stroke-miterlimit', (v) => { const n = num(v); return Number.isFinite(n) ? String(Math.max(1, Math.min(20, n))) : null; }, 'miter limits');
  edit('fill-rule', (v) => (['evenodd', 'nonzero'].includes(v.trim()) ? v : null), 'fill rules');
  edit('clip-rule', (v) => (['evenodd', 'nonzero'].includes(v.trim()) ? v : null), 'fill rules');
  edit('mix-blend-mode', (v) => (v.trim() === 'normal' || BLENDS.has(v.trim()) ? v : null), 'blend modes the importer cannot match');
  edit('stroke-dasharray', (v) => (v.trim() === 'none' || /^[\d.\s,]+$/.test(v) ? v : null), 'dash patterns');
  const tf = e.getAttribute('transform');
  if (tf !== null && !/^\s*((translate|scale|rotate|matrix|skewX|skewY)\(\s*[-+\d.eE\s,]+\)\s*)+$/.test(tf)) { e.removeAttribute('transform'); t.fix('unreadable transforms'); }
  const nm = e.getAttribute('data-name'), id = e.getAttribute('id');
  if (nm !== null) { const c = nm.replace(/[^\w .-]/g, '').trim().slice(0, 40); if (c) e.setAttribute('data-name', c); else e.removeAttribute('data-name'); }
  if (id !== null && !/^[\w-]{1,60}$/.test(id)) { const c = id.replace(/[^\w-]/g, '').slice(0, 60); if (c) e.setAttribute('id', c); else e.removeAttribute('id'); }
  writeStyle(e, sm);
}

function shapeProblem(e: Element, tag: string): string | null {
  for (const k of NUMERIC) { const v = e.getAttribute(k); if (v !== null && v.trim() && !v.trim().endsWith('%')) { const n = num(v); if (!Number.isFinite(n) || Math.abs(n) > 1e6) return 'invalid or runaway numbers'; } }
  switch (tag) {
    case 'path': {
      const d = e.getAttribute('d') ?? '';
      if (!d.trim()) return 'no path data';
      if (/nan|infinity|undefined|null/i.test(d)) return 'invalid numbers in path data';
      let pd;
      try { pd = parseSvgD(d); } catch { return 'unreadable path data'; }
      if (!pd.length || pd.every((sp) => sp.pts.length < 2)) return 'path data with no drawable segment';
      if (pd.some((sp) => sp.pts.some((a) => ![a.x, a.y, a.ix, a.iy, a.ox, a.oy].every(Number.isFinite)))) return 'invalid numbers in path data';
      return null;
    }
    case 'rect': return num(e.getAttribute('width')) > 0 && num(e.getAttribute('height')) > 0 ? null : 'rect without a size';
    case 'circle': return num(e.getAttribute('r')) > 0 ? null : 'circle without a radius';
    case 'ellipse': return num(e.getAttribute('rx')) > 0 && num(e.getAttribute('ry')) > 0 ? null : 'ellipse without radii';
    case 'line': return null;
    default: {
      const v = (e.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number);
      return v.length >= 4 && v.every(Number.isFinite) ? null : 'points that cannot be read';
    }
  }
}

export function repairSvg(src: string, W: number, H: number): { svg: string; report: Report } {
  const t = new Tally();
  if (src.length > MAX_SVG) throw new Error('The model answered with an SVG too large to use.');
  const root = parseLenient(src, t);
  for (const a of Array.from(root.attributes)) if (!ATTRS.has(a.name.toLowerCase())) root.removeAttribute(a.name);
  let hoisted = 0;
  for (let pass = 0; pass < 8; pass++) {
    const nested = Array.from(root.querySelectorAll('*')).filter((e) => SHAPE_TAGS.has(e.localName.toLowerCase()) && e.children.length);
    if (!nested.length) break;
    for (const s of nested) { let ref: Element = s; for (const k of Array.from(s.children)) { ref.after(k); ref = k; hoisted++; } }
  }
  if (hoisted) t.fix('elements nested inside shapes moved out', hoisted);
  const grads = checkGradients(root, t);
  let count = 0;
  const clean = (e: Element): void => {
    for (let c of Array.from(e.children)) {
      const tag = c.localName.toLowerCase();
      if (!ALLOWED.has(tag)) { t.drop(`${tag} element${/^(text|tspan|image|filter|mask|use|symbol|pattern|clippath|style|script|foreignobject)$/.test(tag) ? ' (not supported)' : ''}`); c.remove(); continue; }
      if (++count > MAX_NODES) { t.drop('elements past the 6000 element limit'); c.remove(); continue; }
      if (PROPER[tag] && c.localName !== PROPER[tag]) {
        const n = c.ownerDocument.createElementNS(c.namespaceURI, PROPER[tag]);
        for (const a of Array.from(c.attributes)) n.setAttribute(a.name, a.value);
        while (c.firstChild) n.appendChild(c.firstChild);
        c.replaceWith(n);
        c = n;
      }
      let stripped = 0;
      for (const a of Array.from(c.attributes)) {
        const n = a.name.toLowerCase(), v = a.value;
        if (!ATTRS.has(n)) { c.removeAttribute(a.name); stripped++; continue; }
        if ((n === 'href' || n === 'xlink:href') && !/^#[\w-]+$/.test(v)) { c.removeAttribute(a.name); stripped++; }
        else if (n !== 'style' && (/url\(\s*['"]?(?!#)/i.test(v) || /expression|javascript:|@import/i.test(v))) { c.removeAttribute(a.name); stripped++; }
        else if (n === 'style') {
          const sm = styleMap(c);
          for (const k of [...sm.keys()]) { const sv = sm.get(k) ?? ''; if (!STYLE_PROPS.has(k) || /url\(\s*['"]?(?!#)/i.test(sv) || /expression|javascript:|@import/i.test(sv)) { sm.delete(k); stripped++; } }
          writeStyle(c, sm);
        }
      }
      if (stripped) t.fix('unsupported attributes removed', stripped);
      if (SHAPE_TAGS.has(tag)) {
        const why = shapeProblem(c, tag);
        if (why) { t.drop(`${tag === 'g' ? 'group' : tag} elements: ${why}`); c.remove(); continue; }
      }
      fixScalars(c, W, H, t);
      if (SHAPE_TAGS.has(tag) || tag === 'g') { fixPaintProp(c, 'fill', grads, t); fixPaintProp(c, 'stroke', grads, t); }
      clean(c);
    }
  };
  clean(root);
  fixPaintProp(root, 'fill', grads, t);
  fixPaintProp(root, 'stroke', grads, t);
  for (const g of Array.from(root.querySelectorAll('g'))) if (!g.children.length) { g.remove(); t.drop('empty groups'); }
  return { svg: new XMLSerializer().serializeToString(root), report: t.report() };
}

const boundsOf = (n: VNode): Rect => { const base = newDoc(10, 10); const d: Doc = { ...base, layers: [{ ...base.layers[0], children: [n] }] }; return geomBounds(d, n); };

interface Leaf { node: PathNode; area: number; big: boolean }

function mapLeaves(nodes: VNode[], f: (p: PathNode) => VNode | VNode[] | null): VNode[] {
  const out: VNode[] = [];
  for (const n of nodes) {
    if (n.kind === 'path') { const r = f(n); if (r) out.push(...(Array.isArray(r) ? r : [r])); }
    else if (n.kind === 'group') { const kids = mapLeaves(n.children, f); if (kids.length) out.push({ ...n, children: kids }); }
    else out.push(n);
  }
  return out;
}
function eachLeaf(nodes: VNode[], f: (p: PathNode) => void): void {
  for (const n of nodes) { if (n.kind === 'path') f(n); else if (n.kind === 'group') eachLeaf(n.children, f); }
}

export interface FinishOptions { vbW: number; vbH: number; limits: Limits; scene?: boolean }

export function finishNodes(nodes: VNode[], o: FinishOptions, report: Report): VNode[] {
  const { vbW: W, vbH: H, limits: lim } = o;
  const tally = new Tally();
  let closed = 0, clamped = 0;
  const lo = (v: number, s: number): number => Math.max(-s, Math.min(2 * s, v));
  let out = mapLeaves(nodes, (p) => {
    if (p.d.some((sp) => sp.pts.some((a) => Math.max(Math.abs(a.x), Math.abs(a.y)) > 10 * Math.max(W, H)))) { tally.drop('shapes with runaway coordinates'); return null; }
    let moved = false;
    const d = p.d.map((sp) => ({ ...sp, pts: sp.pts.map((a) => {
      const b = { ...a, x: lo(a.x, W), y: lo(a.y, H), ix: lo(a.ix, W), iy: lo(a.iy, H), ox: lo(a.ox, W), oy: lo(a.oy, H) };
      if (b.x !== a.x || b.y !== a.y || b.ix !== a.ix || b.iy !== a.iy || b.ox !== a.ox || b.oy !== a.oy) moved = true;
      return b;
    }) }));
    if (moved) clamped++;
    const filled = p.ap.items.some((i) => i.kind === 'fill' && i.visible && i.paint.type !== 'none');
    let wasOpen = false;
    const d2 = filled ? d.map((sp) => { if (!sp.closed && sp.pts.length > 2) { wasOpen = true; return { ...sp, closed: true }; } return sp; }) : d;
    if (wasOpen) closed++;
    const b = pathBounds(d2);
    if (isEmptyRect(b) || ![b.x, b.y, b.w, b.h].every(Number.isFinite)) { tally.drop('shapes with no extent'); return null; }
    if (b.x + b.w < -0.25 * W || b.y + b.h < -0.25 * H || b.x > 1.25 * W || b.y > 1.25 * H) { tally.drop('shapes entirely outside the canvas'); return null; }
    return { ...p, d: d2 };
  });
  if (closed) tally.fix('open filled paths closed', closed);
  if (clamped) tally.fix('runaway coordinates clamped to the canvas', clamped);

  if (!lim.compound) {
    let split = 0;
    out = mapLeaves(out, (p) => {
      if (p.d.length < 2) return p;
      split++;
      return p.d.map((sp, i) => ({ ...p, id: i === 0 ? p.id : newId('p'), d: [sp] }));
    });
    if (split) tally.fix('compound paths split into simple paths (detail is too low for holes)', split);
  }

  const cap = Math.ceil(lim.maxShapes * 1.3);
  const all: Leaf[] = [];
  eachLeaf(out, (p) => { const b = pathBounds(p.d); all.push({ node: p, area: b.w * b.h, big: b.w * b.h >= W * H * 0.4 }); });
  if (all.length > cap) {
    const drop = new Set(all.filter((l) => !l.big).sort((a, b) => a.area - b.area).slice(0, all.length - cap).map((l) => l.node.id));
    out = mapLeaves(out, (p) => (drop.has(p.id) ? null : p));
    tally.drop(`smallest shapes beyond the ${cap} this detail level allows`, drop.size);
  }

  if (lim.strokes === 'none' || lim.strokes === 'only') {
    let n = 0;
    out = mapLeaves(out, (p) => {
      const items = p.ap.items.filter((i) => (lim.strokes === 'none' ? i.kind !== 'stroke' : i.kind !== 'fill'));
      if (items.length === p.ap.items.length) return p;
      n++;
      if (!items.length) {
        const src = p.ap.items[0];
        if (lim.strokes === 'only' && src.kind === 'fill') return { ...p, ap: { ...p.ap, items: [strokeFrom(src.paint)] } };
        return { ...p, ap: { ...p.ap, items: [src] } };
      }
      return { ...p, ap: { ...p.ap, items } };
    });
    if (n) tally.fix(lim.strokes === 'none' ? 'strokes removed (this detail and style use fills only)' : 'fills turned into strokes (line art)', n);
  } else if (lim.strokes === 'few') {
    let total = 0;
    eachLeaf(out, () => { total++; });
    const cap = Math.max(4, Math.ceil(total * 0.25));
    let seen = 0, removed = 0;
    out = mapLeaves(out, (p) => {
      if (!p.ap.items.some((i) => i.kind === 'stroke')) return p;
      if (++seen <= cap) return p;
      const items = p.ap.items.filter((i) => i.kind !== 'stroke');
      if (!items.length) return p;
      removed++;
      return { ...p, ap: { ...p.ap, items } };
    });
    if (removed) tally.fix('strokes removed beyond the few this detail allows', removed);
  }

  const leaves: Leaf[] = [];
  eachLeaf(out, (p) => { const b = pathBounds(p.d); leaves.push({ node: p, area: b.w * b.h, big: b.w * b.h >= W * H * 0.4 }); });
  const gradLeaves = leaves.filter((l) => l.node.ap.items.some((i) => i.paint.type === 'gradient'));
  let gradCount = 0;
  const gradItems = (p: PathNode): number => p.ap.items.filter((i) => i.paint.type === 'gradient').length;
  for (const l of gradLeaves) gradCount += gradItems(l.node);
  if (gradCount > lim.gradients) {
    const keep = new Set<string>();
    let budget = lim.gradients;
    for (const l of [...gradLeaves].sort((a, b) => b.area - a.area)) { const g = gradItems(l.node); if (budget >= g) { budget -= g; keep.add(l.node.id); } }
    let flat = 0;
    out = mapLeaves(out, (p) => {
      if (keep.has(p.id) || !gradItems(p)) return p;
      flat++;
      return { ...p, ap: { ...p.ap, items: p.ap.items.map((i) => (i.paint.type === 'gradient' ? { ...i, paint: { type: 'color' as const, color: i.paint.gradient.stops[Math.floor(i.paint.gradient.stops.length / 2)].color } } : i)) } };
    });
    if (flat) tally.fix(lim.gradients === 0 ? 'gradients replaced by solid colours (this detail and style use solid fills)' : `gradients replaced by solid colours beyond the ${lim.gradients} this detail allows`, flat);
  }

  const r = tally.report();
  report.dropped.push(...r.dropped); report.fixed.push(...r.fixed); report.notes.push(...r.notes);
  if (o.scene) {
    const names = out.filter((n) => n.kind === 'group').map((n) => n.name ?? '');
    const have = ['background', 'midground', 'foreground'].filter((k) => names.some((nm) => nm.toLowerCase().includes(k)));
    report.notes.push(have.length === 3 ? 'Scene layers kept: Background, Midground, Foreground.' : `The model gave ${have.length} of the 3 scene layers (${have.join(', ') || 'none'}).`);
  }
  return out.map((n) => (n.kind === 'group' && n.name && o.scene ? { ...n, name: n.name.charAt(0).toUpperCase() + n.name.slice(1) } : n));
}

function strokeFrom(paint: Paint): StrokeItem {
  return { kind: 'stroke', paint, width: 4, cap: 'round', join: 'round', miter: 4, align: 'center', dash: [], dashOffset: 0, dashCorners: false, startArrow: 'none', endArrow: 'none', arrowScale: [100, 100], arrowAlign: 'extend', profile: null, brush: null, opacity: 1, blend: 'normal', visible: true, effects: [] };
}

export interface SeamResult { art: VNode; crossing: number; copies: number; skipped: number }

function unwrap(children: VNode[]): VNode[] {
  let list = children;
  for (let i = 0; i < 3; i++) {
    if (list.length !== 1) break;
    const g = list[0];
    if (g.kind !== 'group' || g.clip || g.opacity !== 1 || g.blend !== 'normal' || g.ap.effects.length || g.mask) break;
    list = g.children;
  }
  return list;
}

export function seamlessWrap(art: GroupNode, tile: Rect): SeamResult {
  const eps = Math.max(0.2, tile.w * 0.004), kids = unwrap(art.children);
  let crossing = 0, copies = 0, skipped = 0;
  const out: VNode[] = [];
  for (const child of kids) {
    out.push(child);
    const b = boundsOf(child);
    if (isEmptyRect(b) || (b.w >= tile.w * 0.95 && b.h >= tile.h * 0.95)) continue;
    const xs = [0, ...(b.x < tile.x - eps ? [tile.w] : []), ...(b.x + b.w > tile.x + tile.w + eps ? [-tile.w] : [])];
    const ys = [0, ...(b.y < tile.y - eps ? [tile.h] : []), ...(b.y + b.h > tile.y + tile.h + eps ? [-tile.h] : [])];
    if (xs.length === 1 && ys.length === 1) continue;
    crossing++;
    if (child.opacity < 1 || child.ap.items.some((i) => i.opacity < 1 || (i.kind === 'fill' && i.paint.type === 'gradient' && i.paint.gradient.stops.some((s) => s.opacity < 1)))) { skipped++; continue; }
    for (const dx of xs) for (const dy of ys) {
      if (!dx && !dy) continue;
      const m: Mat = [1, 0, 0, 1, dx, dy];
      out.push(transformNode(cloneNode(child), m));
      copies++;
    }
  }
  return { art: { ...art, children: out }, crossing, copies, skipped };
}

export interface SeamCheck { x: number; y: number; ok: boolean }

export async function seamCheck(p: Project, art: VNode, tile: Rect): Promise<SeamCheck> {
  const c = await renderRegion(p, { region: tile, scale: 96 / Math.max(tile.w, tile.h), transparent: false, bg: { kind: 'rgb', r: 255, g: 255, b: 255 }, only: [art] });
  const g = c.getContext('2d');
  if (!g) return { x: 0, y: 0, ok: true };
  const W = c.width, H = c.height, px = g.getImageData(0, 0, W, H).data;
  const at = (x: number, y: number, k: number): number => px[(y * W + x) * 4 + k];
  const diff = (x1: number, y1: number, x2: number, y2: number): number => (Math.abs(at(x1, y1, 0) - at(x2, y2, 0)) + Math.abs(at(x1, y1, 1) - at(x2, y2, 1)) + Math.abs(at(x1, y1, 2) - at(x2, y2, 2))) / 765;
  let ex = 0, bx = 0, ey = 0, by = 0;
  for (let y = 0; y < H; y++) { ex += diff(0, y, W - 1, y); for (let x = 0; x < W - 1; x++) bx += diff(x, y, x + 1, y); }
  for (let x = 0; x < W; x++) { ey += diff(x, 0, x, H - 1); for (let y = 0; y < H - 1; y++) by += diff(x, y, x, y + 1); }
  const sx = Math.max(0, ex / H - bx / (H * (W - 1))), sy = Math.max(0, ey / W - by / (W * (H - 1)));
  return { x: Math.round(sx * 1000) / 1000, y: Math.round(sy * 1000) / 1000, ok: sx < 0.06 && sy < 0.06 };
}
