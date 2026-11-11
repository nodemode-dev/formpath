import { geomBounds } from './bounds';
import { cloneNode, newId, updateNodes, walk } from './doc';
import { anchor, ellipsePath, isEmptyRect, mul, piePath, rectPath } from './geometry';
import { BLACK, emptyAppearance, fill, gray, NONE, solid, stroke, WHITE } from './paint';
import { layoutText, textNode } from './text';
import { transformNode } from './transform';
import type { Appearance, Doc, GraphData, GraphDesign, GraphSeriesType, GraphSpec, GraphType, GroupNode, Mat, PathData, PathNode, Pt, Rect, TextAlign, TextNode, VNode } from './types';

export const GRAPH_TYPES: ReadonlyArray<readonly [GraphType, string]> = [['column', 'Column'], ['stacked', 'Stacked Column'], ['bar', 'Bar'], ['stackedBar', 'Stacked Bar'], ['line', 'Line'], ['area', 'Area'], ['scatter', 'Scatter'], ['pie', 'Pie'], ['radar', 'Radar']];
export const COMBINABLE: ReadonlySet<GraphType> = new Set(['column', 'stacked', 'line', 'area']);

export const GRAPH_DEFAULTS: Omit<GraphSpec, 'type' | 'w' | 'h' | 'xf' | 'data'> = {
  axis: 'start', auto: true, min: 0, max: 100, divisions: 5, valueTicks: 'short', catTicks: 'short', prefix: '', suffix: '',
  legend: 'right', pieLegend: 'standard', pieSort: 'none', piePosition: 'ratio', colWidth: 90, clusterWidth: 80,
  mark: true, connect: true, edgeToEdge: false, fillLines: false, lineWidth: 1, markerSize: 5, shadow: false, font: 'Inter', style: 'Regular', size: 9,
};

export function sampleData(type: GraphType): GraphData {
  if (type === 'scatter') return { series: ['Y', 'X'], cats: ['', '', '', ''], values: [[2, 1], [3.5, 2], [3, 3], [5, 4]] };
  if (type === 'pie') return { series: ['North', 'South', 'East', 'West'], cats: ['2026'], values: [[40, 25, 20, 15]] };
  if (type === 'radar') return { series: ['Plan', 'Actual'], cats: ['Speed', 'Cost', 'Quality', 'Reach', 'Risk'], values: [[4, 3], [3, 4], [5, 4], [2, 3], [3, 2]] };
  return { series: ['Series 1', 'Series 2'], cats: ['2024', '2025', '2026'], values: [[3, 5], [4, 6], [6, 7]] };
}

export function graphSpec(type: GraphType, w: number, h: number, xf: Mat, data?: GraphData, patch: Partial<GraphSpec> = {}): GraphSpec {
  return { ...GRAPH_DEFAULTS, ...(type === 'scatter' ? { connect: false } : {}), ...patch, type, w: Math.max(4, w), h: Math.max(4, h), xf, data: data ?? sampleData(type) };
}

export const cleanData = (d: GraphData): GraphData => {
  const cols = Math.max(d.series.length, ...d.values.map((r) => r.length), 0), rows = Math.max(d.cats.length, d.values.length);
  return {
    series: Array.from({ length: cols }, (_, i) => String(d.series[i] ?? '')),
    cats: Array.from({ length: rows }, (_, i) => String(d.cats[i] ?? '')),
    values: Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => { const v = d.values[r]?.[c]; return typeof v === 'number' && Number.isFinite(v) ? v : null; })),
  };
};

export function transposeData(d: GraphData): GraphData {
  const c = cleanData(d);
  return { series: [...c.cats], cats: [...c.series], values: c.series.map((_, j) => c.cats.map((__, i) => c.values[i][j])) };
}

export function swapXY(d: GraphData): GraphData {
  const c = cleanData(d), idx = c.series.map((_, i) => (i % 2 === 0 ? (i + 1 < c.series.length ? i + 1 : i) : i - 1));
  return { series: idx.map((i) => c.series[i]), cats: c.cats, values: c.values.map((r) => idx.map((i) => r[i])) };
}

function splitRow(line: string, sep: string): string[] {
  if (sep === '\t') return line.split('\t');
  const out: string[] = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/^"|"$/g, '').replace(/[\s ]/g, '').replace(/^[$€£¥]/, '').replace(/%$/, '');
  if (!s) return null;
  const n = Number(/^-?[\d,]+(\.\d+)?$/.test(s) && /,\d{3}(\D|$)/.test(s) ? s.replace(/,/g, '') : s);
  return Number.isFinite(n) ? n : null;
}

export function parseGrid(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const sep = lines.some((l) => l.includes('\t')) ? '\t' : lines.some((l) => l.includes(',')) ? ',' : lines.some((l) => l.includes(';')) ? ';' : '\t';
  return lines.map((l) => splitRow(l, sep).map((c) => c.trim()));
}

export function parseTable(text: string): GraphData {
  const g = parseGrid(text);
  if (!g.length) return { series: [], cats: [], values: [] };
  const word = (s: string | undefined): boolean => !!s && parseNumber(s) === null;
  const header = g[0].slice(1).some(word) || (!g[0][0] && g.length > 1 && g[0].slice(1).every((s) => !s || word(s))) || g[0].every((s) => !s || word(s));
  const body = header ? g.slice(1) : g;
  const labels = body.some((r) => word(r[0])) || (header && !g[0][0]);
  const off = labels ? 1 : 0, cols = Math.max(0, ...body.map((r) => r.length - off), header ? g[0].length - off : 0);
  const hoff = header && labels && g[0].length <= cols && g[0][0] !== '' ? 0 : off;
  return cleanData({
    series: header ? Array.from({ length: cols }, (_, i) => g[0][i + hoff] ?? '') : Array.from({ length: cols }, () => ''),
    cats: body.map((r) => (labels ? r[0] ?? '' : '')),
    values: body.map((r) => Array.from({ length: cols }, (_, i) => parseNumber(r[i + off] ?? ''))),
  });
}

export function dataToText(d: GraphData): string {
  const c = cleanData(d), cell = (s: string): string => (/[\t\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [['', ...c.series].map(cell).join('\t'), ...c.cats.map((cat, i) => [cat, ...c.values[i].map((v) => (v === null ? '' : String(v)))].map(cell).join('\t'))].join('\n');
}

const SHADES = [100, 70, 45, 25, 85, 55, 35, 15];
const seriesPaint = (i: number) => solid(gray(SHADES[i % SHADES.length]));
const fillAp = (i: number): Appearance => ({ items: [fill(seriesPaint(i))], effects: [] });
const lineAp = (i: number, w: number): Appearance => ({ items: [fill(NONE), stroke(seriesPaint(i), w)], effects: [] });

function nice(lo: number, hi: number, target = 5): { min: number; max: number; div: number; step: number } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
  if (hi - lo < 1e-12) { hi = lo + (Math.abs(lo) > 1e-9 ? Math.abs(lo) : 1); }
  const raw = (hi - lo) / target, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const min = Math.floor(lo / step + 1e-9) * step, max = Math.ceil(hi / step - 1e-9) * step;
  return { min, max, div: Math.max(1, Math.round((max - min) / step)), step };
}

const fmtNum = (v: number, step: number): string => {
  let dec = 0;
  while (dec < 4 && Math.abs(Math.round(step * 10 ** dec) - step * 10 ** dec) > 1e-6) dec++;
  return (Math.abs(v) < 1e-12 ? 0 : v).toFixed(dec);
};

interface Ctx { s: GraphSpec; designs: (id: string | undefined) => { art: VNode; b: Rect } | null }
interface Acc { grid: PathData; axes: PathData; shadow: VNode[]; series: Map<number, VNode[]>; keys: Map<number, VNode>; labels: VNode[]; legend: VNode[] }

const P = (part: string, d: PathData, ap: Appearance): PathNode => ({ id: '', part, kind: 'path', d, rule: 'nonzero', opacity: 1, blend: 'normal', ap });
const G = (part: string, children: VNode[]): GroupNode => ({ id: '', part, kind: 'group', clip: false, children, opacity: 1, blend: 'normal', ap: emptyAppearance() });
const seg = (a: Pt, b: Pt): PathData[number] => ({ closed: false, pts: [anchor(a.x, a.y), anchor(b.x, b.y)] });
const poly = (pts: Pt[], closed: boolean): PathData[number] => ({ closed, pts: pts.map((p) => anchor(p.x, p.y)) });

function label(c: Ctx, part: string, str: string, x: number, y: number, align: TextAlign = 'left'): TextNode {
  return { id: '', part, ...textNode(str, x, y, { font: c.s.font, style: c.s.style, size: c.s.size, fill: solid(BLACK) }, { align }) } as TextNode;
}
function textW(c: Ctx, str: string): number { return str ? layoutText({ id: 'm', ...textNode(str, 0, 0, { font: c.s.font, style: c.s.style, size: c.s.size }) } as TextNode).bounds.w : 0; }

function push(a: Acc, i: number, n: VNode): void { const l = a.series.get(i); if (l) l.push(n); else a.series.set(i, [n]); }

function designArt(c: Ctx, id: string | undefined, r: Rect, mode: 'vertical' | 'uniform' | 'fit', horizontal = false): VNode | null {
  const d = c.designs(id);
  if (!d || d.b.w < 1e-6 || d.b.h < 1e-6) return null;
  let m: Mat;
  if (mode === 'vertical') m = [r.w / d.b.w, 0, 0, r.h / d.b.h, r.x - d.b.x * (r.w / d.b.w), r.y - d.b.y * (r.h / d.b.h)];
  else {
    const k = mode === 'fit' ? Math.min(r.w / d.b.w, r.h / d.b.h) : horizontal ? r.w / d.b.w : r.h / d.b.h, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    m = [k, 0, 0, k, cx - (d.b.x + d.b.w / 2) * k, cy - (d.b.y + d.b.h / 2) * k];
  }
  return transformNode(cloneNode(d.art), m, { strokes: true, patterns: true, gradients: true });
}

function repeatArt(c: Ctx, id: string | undefined, r: Rect, unit: number, count: number, fraction: 'chop' | 'scale', horizontal: boolean): VNode | null {
  const d = c.designs(id);
  if (!d || d.b.w < 1e-6 || d.b.h < 1e-6 || unit < 1e-6 || count <= 0) return null;
  const k = unit / (horizontal ? d.b.w : d.b.h), w = d.b.w * k, h = d.b.h * k, full = Math.floor(count + 1e-9), frac = count - full, kids: VNode[] = [];
  const at = (i: number, sy = 1): VNode => {
    const m: Mat = horizontal ? [k * sy, 0, 0, k, r.x + i * w - d.b.x * k * sy, r.y + r.h / 2 - (d.b.y + d.b.h / 2) * k] : [k, 0, 0, k * sy, r.x + r.w / 2 - (d.b.x + d.b.w / 2) * k, r.y + r.h - (i * h) - h * sy - d.b.y * k * sy];
    return transformNode(cloneNode(d.art), m, { strokes: true, patterns: true, gradients: true });
  };
  for (let i = 0; i < full; i++) kids.push(at(i));
  if (frac > 1e-3) {
    if (fraction === 'scale') kids.push(at(full, frac));
    else {
      const piece = at(full), clipR = horizontal ? rectPath(r.x + full * w, r.y - h, w * frac, r.h + 2 * h) : rectPath(r.x - w, r.y + r.h - full * h - h * frac, r.w + 2 * w, h * frac);
      kids.push({ id: newId('g'), kind: 'group', clip: true, children: [piece, { id: newId('p'), kind: 'path', d: clipR, rule: 'nonzero', opacity: 1, blend: 'normal', ap: emptyAppearance() }], opacity: 1, blend: 'normal', ap: emptyAppearance() });
    }
  }
  return { id: newId('g'), kind: 'group', clip: false, children: kids, opacity: 1, blend: 'normal', ap: emptyAppearance() };
}

function lineOutline(pts: Pt[], w: number): PathData[number] | null {
  if (pts.length < 2) return null;
  const hw = w / 2, left: Pt[] = [], right: Pt[] = [];
  const nrm = (a: Pt, b: Pt): Pt => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: -dy / l, y: dx / l }; };
  for (let i = 0; i < pts.length; i++) {
    const n0 = i > 0 ? nrm(pts[i - 1], pts[i]) : null, n1 = i < pts.length - 1 ? nrm(pts[i], pts[i + 1]) : null;
    let n = n0 && n1 ? { x: n0.x + n1.x, y: n0.y + n1.y } : (n0 ?? n1) as Pt;
    const l = Math.hypot(n.x, n.y) || 1;
    n = { x: n.x / l, y: n.y / l };
    const ref = n1 ?? n0 as Pt, cos = Math.max(0.25, n.x * ref.x + n.y * ref.y), k = hw / cos;
    left.push({ x: pts[i].x + n.x * k, y: pts[i].y + n.y * k });
    right.push({ x: pts[i].x - n.x * k, y: pts[i].y - n.y * k });
  }
  return poly([...left, ...right.reverse()], true);
}

function marker(c: Ctx, a: Acc, si: number, part: string, at: Pt): void {
  const m = c.s.markerSize, design = c.s.markers?.[si];
  const art = design ? designArt(c, design, { x: at.x - m, y: at.y - m, w: m * 2, h: m * 2 }, 'fit') : null;
  push(a, si, art ? { ...G(part, [art]) } : P(part, rectPath(at.x - m / 2, at.y - m / 2, m, m), fillAp(si)));
}

function legendKeys(c: Ctx, a: Acc, names: Array<{ si: number; name: string; kind: 'box' | 'line' }>, x0: number, y0: number): void {
  const s = c.s, ks = s.size;
  if (s.legend === 'none' || !names.length) return;
  let cx = 0;
  names.forEach((it, k) => {
    const x = s.legend === 'top' ? cx : x0, y = s.legend === 'top' ? y0 : y0 + k * ks * 1.8;
    const box: Rect = { x, y, w: ks, h: ks };
    const col = s.columns?.[it.si], art = it.kind === 'box' && col ? designArt(c, col.design, box, 'fit') : it.kind === 'line' && s.markers?.[it.si] ? designArt(c, s.markers[it.si], { x: x + ks * 0.15, y: y + ks * 0.15, w: ks * 0.7, h: ks * 0.7 }, 'fit') : null;
    if (art) a.keys.set(it.si, G(`s${it.si}:key`, [art]));
    else if (it.kind === 'line') a.keys.set(it.si, P(`s${it.si}:key`, [seg({ x: x - ks * 0.2, y: y + ks / 2 }, { x: x + ks * 1.2, y: y + ks / 2 }), ...(s.mark ? rectPath(x + ks / 2 - s.markerSize / 2, y + ks / 2 - s.markerSize / 2, s.markerSize, s.markerSize) : [])], { items: [fill(seriesPaint(it.si)), stroke(seriesPaint(it.si), s.lineWidth)], effects: [] }));
    else a.keys.set(it.si, P(`s${it.si}:key`, rectPath(box.x, box.y, box.w, box.h), fillAp(it.si)));
    a.legend.push(label(c, `lt${it.si}`, it.name, x + ks * 1.5, y + ks * 0.82));
    cx += ks * 3 + textW(c, it.name);
  });
}

function shadowOf(c: Ctx, a: Acc, part: string, d: PathData): void {
  if (!c.s.shadow) return;
  const o = Math.max(1.5, c.s.size * 0.3);
  a.shadow.push(P(`sh:${part}`, d.map((sp) => ({ ...sp, pts: sp.pts.map((p) => ({ ...p, x: p.x + o, y: p.y + o, ix: p.ix + o, iy: p.iy + o, ox: p.ox + o, oy: p.oy + o })) })), { items: [fill(solid(BLACK))], effects: [] }));
}

function cartesian(c: Ctx, a: Acc): void {
  const s = c.s, d = cleanData(s.data), n = d.cats.length, ncols = d.series.length, horizontal = s.type === 'bar' || s.type === 'stackedBar';
  if (!n || !ncols) return;
  const base: GraphSeriesType = s.type === 'stacked' || s.type === 'stackedBar' ? 'stacked' : s.type === 'line' ? 'line' : s.type === 'area' ? 'area' : 'column';
  const stype = (i: number): GraphSeriesType => (COMBINABLE.has(s.type) ? s.seriesTypes?.[i] ?? base : base);
  const val = (r: number, i: number): number | null => d.values[r][i];
  let lo = 0, hi = 0;
  for (let r = 0; r < n; r++) {
    let pos = 0, neg = 0, area = 0;
    for (let i = 0; i < ncols; i++) {
      const v = val(r, i), t = stype(i);
      if (v === null) continue;
      if (t === 'stacked') { if (v >= 0) pos += v; else neg += v; lo = Math.min(lo, neg); hi = Math.max(hi, pos); }
      else if (t === 'area') { area += v; lo = Math.min(lo, area); hi = Math.max(hi, area); }
      else { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    }
  }
  const ns = nice(lo, hi), min = s.auto ? ns.min : s.min, max = s.auto ? ns.max : s.max > s.min ? s.max : s.min + 1, div = s.auto ? ns.div : Math.max(1, Math.round(s.divisions));
  const catLen = horizontal ? s.h : s.w, valLen = horizontal ? s.w : s.h, span = max - min;
  const pv = (v: number): number => ((Math.max(min, Math.min(max, v)) - min) / span) * valLen;
  const xy = (cc: number, v: number): Pt => (horizontal ? { x: v, y: cc } : { x: cc, y: s.h - v });
  const rectAt = (c0: number, c1: number, v0: number, v1: number): Rect => { const p = xy(c0, v0), q = xy(c1, v1); return { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), w: Math.abs(q.x - p.x), h: Math.abs(q.y - p.y) }; };
  const tl = s.size * 0.5, gap = s.size * 0.4, b0 = min <= 0 && max >= 0 ? 0 : min;
  const sides = s.axis === 'both' ? ['start', 'end'] : [s.axis];
  const step = span / div;
  for (let k = 0; k <= div; k++) {
    const v = min + k * step, p = pv(v), txt = `${s.prefix}${fmtNum(v, step)}${s.suffix}`;
    if (s.valueTicks === 'full' && k > 0) a.grid.push(seg(xy(0, p), xy(catLen, p)));
    for (const side of sides) {
      const end = side === 'end';
      if (horizontal) {
        const y = end ? 0 : s.h;
        if (s.valueTicks !== 'none') a.axes.push(seg({ x: p, y }, { x: p, y: end ? -tl : s.h + tl }));
        a.labels.push(label(c, `v${end ? 'e' : ''}l${k}`, txt, p, end ? -tl - gap : s.h + tl + gap + s.size * 0.8, 'center'));
      } else {
        const x = end ? s.w : 0, y = s.h - p;
        if (s.valueTicks !== 'none') a.axes.push(seg({ x, y }, { x: end ? s.w + tl : -tl, y }));
        a.labels.push(label(c, `v${end ? 'e' : ''}l${k}`, txt, end ? s.w + tl + gap : -tl - gap, y + s.size * 0.35, end ? 'left' : 'right'));
      }
    }
  }
  for (const side of sides) a.axes.push(horizontal ? (side === 'end' ? seg({ x: 0, y: 0 }, { x: s.w, y: 0 }) : seg({ x: 0, y: s.h }, { x: s.w, y: s.h })) : side === 'end' ? seg({ x: s.w, y: 0 }, { x: s.w, y: s.h }) : seg({ x: 0, y: 0 }, { x: 0, y: s.h }));
  a.axes.push(seg(xy(0, pv(b0)), xy(catLen, pv(b0))));
  const anyBars = Array.from({ length: ncols }, (_, i) => stype(i)).some((t) => t === 'column' || t === 'stacked');
  const e2e = !anyBars && (s.edgeToEdge || Array.from({ length: ncols }, (_, i) => stype(i)).every((t) => t === 'area'));
  const cw = catLen / n, ptAt = (r: number): number => (e2e ? (n === 1 ? catLen / 2 : (r * catLen) / (n - 1)) : (r + 0.5) * cw);
  for (let r = 0; r <= n; r++) {
    if (e2e && r === n) break;
    const cc = e2e ? ptAt(r) : r * cw;
    if (s.catTicks === 'full' && r > 0 && r < n) a.grid.push(seg(xy(cc, 0), xy(cc, valLen)));
    if (s.catTicks !== 'none') a.axes.push(horizontal ? seg({ x: 0, y: cc }, { x: -tl, y: cc }) : seg({ x: cc, y: s.h }, { x: cc, y: s.h + tl }));
  }
  d.cats.forEach((cat, r) => {
    const cc = ptAt(r);
    if (horizontal) a.labels.push(label(c, `cl${r}`, cat, -tl - gap, cc + s.size * 0.35, 'right'));
    else a.labels.push(label(c, `cl${r}`, cat, cc, s.h + tl + gap + s.size * 0.8, 'center'));
  });
  const areas = Array.from({ length: ncols }, (_, i) => i).filter((i) => stype(i) === 'area');
  const cum = new Array<number>(n).fill(0);
  for (const i of areas) {
    const top = cum.map((b, r) => b + (val(r, i) ?? 0)), up = top.map((v, r) => xy(ptAt(r), pv(v))), down = cum.map((v, r) => xy(ptAt(r), pv(v))).reverse();
    const dd: PathData = [poly([...up, ...down], true)];
    shadowOf(c, a, `s${i}:area`, dd);
    push(a, i, P(`s${i}:area`, dd, fillAp(i)));
    top.forEach((v, r) => { cum[r] = v; });
  }
  const cols = Array.from({ length: ncols }, (_, i) => i).filter((i) => stype(i) === 'column'), stacked = Array.from({ length: ncols }, (_, i) => i).filter((i) => stype(i) === 'stacked');
  const slots = cols.length + (stacked.length ? 1 : 0);
  if (slots) {
    const cluster = cw * Math.max(1, Math.min(100, s.clusterWidth)) / 100, sw = cluster / slots, colw = sw * Math.max(1, Math.min(100, s.colWidth)) / 100;
    const place = (i: number, r: number, slot: number, v0: number, v1: number): void => {
      const c0 = r * cw + (cw - cluster) / 2 + slot * sw + (sw - colw) / 2, rr = rectAt(c0, c0 + colw, pv(v0), pv(v1)), part = `s${i}:c${r}`, cd = s.columns?.[i];
      let art: VNode | null = null;
      if (cd) {
        if (cd.mode === 'repeat') { const per = Math.max(1e-9, cd.per); art = repeatArt(c, cd.design, rr, (per / span) * valLen, Math.abs(v1 - v0) / per, cd.fraction, horizontal); }
        else art = designArt(c, cd.design, rr, cd.mode, horizontal);
      }
      const dd = rectPath(rr.x, rr.y, rr.w, rr.h);
      shadowOf(c, a, part, dd);
      push(a, i, art ? G(part, [art]) : P(part, dd, fillAp(i)));
    };
    for (let r = 0; r < n; r++) {
      cols.forEach((i, slot) => { const v = val(r, i); if (v !== null) place(i, r, slot, b0, v); });
      let pos = 0, neg = 0;
      for (const i of stacked) { const v = val(r, i); if (v === null) continue; if (v >= 0) { place(i, r, cols.length, pos, pos + v); pos += v; } else { place(i, r, cols.length, neg + v, neg); neg += v; } }
    }
  }
  for (let i = 0; i < ncols; i++) {
    if (stype(i) !== 'line') continue;
    const pts: Array<{ r: number; p: Pt }> = [];
    for (let r = 0; r < n; r++) { const v = val(r, i); if (v !== null) pts.push({ r, p: xy(ptAt(r), pv(v)) }); }
    if (s.connect && pts.length > 1) {
      const ol = s.fillLines ? lineOutline(pts.map((q) => q.p), Math.max(0.5, s.lineWidth)) : null;
      push(a, i, ol ? P(`s${i}:line`, [ol], fillAp(i)) : P(`s${i}:line`, [poly(pts.map((q) => q.p), false)], lineAp(i, s.lineWidth)));
    }
    if (s.mark) for (const q of pts) marker(c, a, i, `s${i}:c${q.r}`, q.p);
  }
  const lw = sides.includes('end') && !horizontal ? tl + gap + Math.max(0, ...Array.from({ length: div + 1 }, (_, k) => textW(c, `${s.prefix}${fmtNum(min + k * step, step)}${s.suffix}`))) : 0;
  legendKeys(c, a, d.series.map((name, si) => ({ si, name, kind: stype(si) === 'line' ? 'line' as const : 'box' as const })), s.w + lw + s.size * 1.5, s.legend === 'top' ? -s.size * 2.4 - (horizontal && sides.includes('end') ? tl + gap + s.size : 0) : 0);
}

function scatter(c: Ctx, a: Acc): void {
  const s = c.s, d = cleanData(s.data), pairs = Math.floor(d.series.length / 2), n = d.cats.length;
  if (!pairs || !n) return;
  let ylo = Infinity, yhi = -Infinity, xlo = Infinity, xhi = -Infinity;
  for (let p = 0; p < pairs; p++) for (let r = 0; r < n; r++) { const y = d.values[r][2 * p], x = d.values[r][2 * p + 1]; if (y === null || x === null) continue; ylo = Math.min(ylo, y); yhi = Math.max(yhi, y); xlo = Math.min(xlo, x); xhi = Math.max(xhi, x); }
  if (!Number.isFinite(ylo)) { ylo = 0; yhi = 1; xlo = 0; xhi = 1; }
  const ny = nice(Math.min(0, ylo), yhi), nx = nice(Math.min(0, xlo), xhi);
  const ymin = s.auto ? ny.min : s.min, ymax = s.auto ? ny.max : s.max > s.min ? s.max : s.min + 1, ydiv = s.auto ? ny.div : Math.max(1, Math.round(s.divisions));
  const X = (x: number): number => ((x - nx.min) / (nx.max - nx.min)) * s.w, Y = (y: number): number => s.h - ((y - ymin) / (ymax - ymin)) * s.h;
  const tl = s.size * 0.5, gap = s.size * 0.4, ystep = (ymax - ymin) / ydiv;
  const sides = s.axis === 'both' ? ['start', 'end'] : [s.axis];
  for (let k = 0; k <= ydiv; k++) {
    const v = ymin + k * ystep, y = Y(v), txt = `${s.prefix}${fmtNum(v, ystep)}${s.suffix}`;
    if (s.valueTicks === 'full' && k > 0) a.grid.push(seg({ x: 0, y }, { x: s.w, y }));
    for (const side of sides) {
      const end = side === 'end', x = end ? s.w : 0;
      if (s.valueTicks !== 'none') a.axes.push(seg({ x, y }, { x: end ? s.w + tl : -tl, y }));
      a.labels.push(label(c, `v${end ? 'e' : ''}l${k}`, txt, end ? s.w + tl + gap : -tl - gap, y + s.size * 0.35, end ? 'left' : 'right'));
    }
  }
  for (let k = 0; k <= nx.div; k++) {
    const v = nx.min + k * nx.step, x = X(v);
    if (s.catTicks === 'full' && k > 0) a.grid.push(seg({ x, y: 0 }, { x, y: s.h }));
    if (s.catTicks !== 'none') a.axes.push(seg({ x, y: s.h }, { x, y: s.h + tl }));
    a.labels.push(label(c, `cl${k}`, fmtNum(v, nx.step), x, s.h + tl + gap + s.size * 0.8, 'center'));
  }
  for (const side of sides) a.axes.push(side === 'end' ? seg({ x: s.w, y: 0 }, { x: s.w, y: s.h }) : seg({ x: 0, y: 0 }, { x: 0, y: s.h }));
  a.axes.push(seg({ x: 0, y: s.h }, { x: s.w, y: s.h }));
  for (let p = 0; p < pairs; p++) {
    const pts: Array<{ r: number; p: Pt }> = [];
    for (let r = 0; r < n; r++) { const y = d.values[r][2 * p], x = d.values[r][2 * p + 1]; if (y !== null && x !== null) pts.push({ r, p: { x: X(x), y: Y(y) } }); }
    if (s.connect && pts.length > 1) push(a, p, P(`s${p}:line`, [poly(pts.map((q) => q.p), false)], lineAp(p, s.lineWidth)));
    for (const q of pts) marker(c, a, p, `s${p}:c${q.r}`, q.p);
  }
  legendKeys(c, a, Array.from({ length: pairs }, (_, p) => ({ si: p, name: d.series[2 * p], kind: 'line' as const })), s.w + s.size * 1.5 + (sides.includes('end') ? tl + gap + s.size * 3 : 0), s.legend === 'top' ? -s.size * 2.4 : 0);
}

function pie(c: Ctx, a: Acc): void {
  const s = c.s, d = cleanData(s.data), m = d.cats.length, k = d.series.length;
  if (!m || !k) return;
  const totals = d.values.map((r) => r.reduce<number>((t, v) => t + (v !== null && v > 0 ? v : 0), 0)), tmax = Math.max(1e-9, ...totals);
  const firstOrder = Array.from({ length: k }, (_, i) => i).sort((x, y) => (d.values[0][y] ?? 0) - (d.values[0][x] ?? 0));
  const stackedPos = s.piePosition === 'stacked', D = stackedPos ? Math.min(s.w, s.h) : Math.min(s.h, s.w / m - (m > 1 ? s.size * 2 : 0));
  const rows = stackedPos ? Array.from({ length: m }, (_, r) => r).sort((x, y) => totals[y] - totals[x]) : Array.from({ length: m }, (_, r) => r);
  for (const r of rows) {
    const R = Math.max(1, (s.piePosition === 'even' ? D : D * Math.sqrt(totals[r] / tmax)) / 2), cx = stackedPos ? s.w / 2 : (r + 0.5) * (s.w / m), cy = s.h / 2;
    const order = s.pieSort === 'all' ? Array.from({ length: k }, (_, i) => i).sort((x, y) => (d.values[r][y] ?? 0) - (d.values[r][x] ?? 0)) : s.pieSort === 'first' ? firstOrder : Array.from({ length: k }, (_, i) => i);
    let ang = -90;
    for (const i of order) {
      const v = d.values[r][i];
      if (v === null || v <= 0 || totals[r] <= 0) continue;
      const sweep = (v / totals[r]) * 360;
      if (sweep < 1e-4) { ang += sweep; continue; }
      const dd = sweep >= 359.999 ? ellipsePath(cx - R, cy - R, 2 * R, 2 * R) : piePath(cx - R, cy - R, 2 * R, 2 * R, ang, ang + sweep);
      shadowOf(c, a, `s${i}:c${r}`, dd);
      push(a, i, P(`s${i}:c${r}`, dd, { items: [fill(seriesPaint(i)), stroke(solid(WHITE), 0.5)], effects: [] }));
      if (s.pieLegend === 'wedges') { const t = ((ang + sweep / 2) * Math.PI) / 180, rr = sweep >= 359.999 ? 0 : R * 0.62; a.legend.push(label(c, `wl${r}:${i}`, d.series[i], cx + Math.cos(t) * rr, cy + Math.sin(t) * rr + s.size * 0.35, 'center')); }
      ang += sweep;
    }
    if (!stackedPos || r === rows[0]) a.labels.push(label(c, `cl${r}`, d.cats[r], cx, cy + (stackedPos ? D / 2 : R) + s.size * 1.6, 'center'));
  }
  if (s.pieLegend === 'standard') legendKeys(c, a, d.series.map((name, si) => ({ si, name, kind: 'box' as const })), s.w + s.size * 1.5, s.legend === 'top' ? -s.size * 2.4 : 0);
}

function radar(c: Ctx, a: Acc): void {
  const s = c.s, d = cleanData(s.data), n = d.cats.length, k = d.series.length;
  if (n < 3 || !k) return;
  let lo = 0, hi = 0;
  for (const r of d.values) for (const v of r) if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const ns = nice(lo, hi), min = s.auto ? ns.min : s.min, max = s.auto ? ns.max : s.max > s.min ? s.max : s.min + 1, div = s.auto ? ns.div : Math.max(1, Math.round(s.divisions));
  const cx = s.w / 2, cy = s.h / 2, R = Math.min(s.w, s.h) / 2, ang = (i: number): number => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const at = (i: number, v: number): Pt => { const rr = ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * R; return { x: cx + Math.cos(ang(i)) * rr, y: cy + Math.sin(ang(i)) * rr }; };
  const step = (max - min) / div, tl = s.size * 0.4, gap = s.size * 0.4;
  for (let q = 1; q <= div; q++) {
    const v = min + q * step, ring = Array.from({ length: n }, (_, i) => at(i, v));
    if (s.valueTicks === 'full') a.grid.push(poly(ring, true));
    else if (s.valueTicks === 'short') { const p = ring[0]; a.axes.push(seg({ x: p.x - tl, y: p.y }, { x: p.x + tl, y: p.y })); }
  }
  for (let q = 0; q <= div; q++) { const v = min + q * step, p = at(0, v); a.labels.push(label(c, `vl${q}`, `${s.prefix}${fmtNum(v, step)}${s.suffix}`, p.x - tl - gap, p.y + s.size * 0.35, 'right')); }
  for (let i = 0; i < n; i++) {
    const e = { x: cx + Math.cos(ang(i)) * R, y: cy + Math.sin(ang(i)) * R };
    a.axes.push(seg({ x: cx, y: cy }, e));
    const ox = Math.cos(ang(i)), oy = Math.sin(ang(i));
    a.labels.push(label(c, `cl${i}`, d.cats[i], cx + ox * (R + gap * 2), cy + oy * (R + gap * 2) + s.size * 0.35 + (oy > 0.3 ? s.size * 0.5 : oy < -0.3 ? -s.size * 0.2 : 0), Math.abs(ox) < 0.2 ? 'center' : ox > 0 ? 'left' : 'right'));
  }
  for (let j = 0; j < k; j++) {
    const pts = d.values.map((r, i) => (r[j] === null ? null : { i, p: at(i, r[j] as number) })).filter((x): x is { i: number; p: Pt } => !!x);
    if (pts.length > 1 && (s.connect || s.fillLines)) push(a, j, P(`s${j}:line`, [poly(pts.map((q) => q.p), pts.length === n)], s.fillLines ? { items: [fill(seriesPaint(j), 0.6), stroke(seriesPaint(j), s.lineWidth)], effects: [] } : lineAp(j, s.lineWidth)));
    if (s.mark) for (const q of pts) marker(c, a, j, `s${j}:c${q.i}`, q.p);
  }
  legendKeys(c, a, d.series.map((name, si) => ({ si, name, kind: 'line' as const })), s.w + s.size * 1.5, s.legend === 'top' ? -s.size * 2.4 : 0);
}

export function buildGraph(s: GraphSpec, designs: Ctx['designs']): VNode[] {
  const c: Ctx = { s, designs }, a: Acc = { grid: [], axes: [], shadow: [], series: new Map(), keys: new Map(), labels: [], legend: [] };
  if (s.type === 'scatter') scatter(c, a);
  else if (s.type === 'pie') pie(c, a);
  else if (s.type === 'radar') radar(c, a);
  else cartesian(c, a);
  const out: VNode[] = [];
  if (a.grid.length) out.push(P('grid', a.grid, { items: [fill(NONE), stroke(solid(gray(35)), 0.5)], effects: [] }));
  if (a.shadow.length) out.push(G('shadow', a.shadow));
  const idx = [...new Set([...a.series.keys(), ...a.keys.keys()])].sort((x, y) => x - y);
  const rank = (i: number): number => { const l = a.series.get(i) ?? []; return l.some((x) => x.part?.endsWith(':area')) ? 0 : l.some((x) => x.part?.endsWith(':line')) ? 2 : 1; };
  for (const i of idx.sort((x, y) => rank(x) - rank(y) || x - y)) out.push(G(`s${i}`, [...(a.series.get(i) ?? []), ...(a.keys.has(i) ? [a.keys.get(i) as VNode] : [])]));
  if (a.axes.length) out.push(P('axes', a.axes, { items: [fill(NONE), stroke(solid(BLACK), 0.75)], effects: [] }));
  if (a.labels.length) out.push(G('labels', a.labels));
  if (a.legend.length) out.push(G('legend', a.legend));
  return out.map((n) => transformNode(n, s.xf, { strokes: false, patterns: true, gradients: true }));
}

const family = (part: string): string => part.replace(/^(s\d+:[a-z]+)\d+$/, '$1').replace(/^([a-z]+)\d+(:\d+)?$/, '$1');

function collect(nodes: VNode[], into: Map<string, VNode>): void {
  for (const n of nodes) { if (n.part && !into.has(n.part)) into.set(n.part, n); if (n.kind === 'group' && n.part && !n.part.includes(':')) collect(n.children, into); else if (n.kind === 'group' && n.part && /^s\d+$/.test(n.part)) collect(n.children, into); }
}

function merge(gen: VNode, old: Map<string, VNode>, fam: Map<string, VNode[]>): VNode {
  if (!gen.part) return gen.id ? gen : { ...gen, id: newId(gen.kind === 'group' ? 'g' : 'p') } as VNode;
  const o = old.get(gen.part), kids = gen.kind === 'group' ? gen.children.map((ch) => merge(ch, old, fam)) : null;
  const same = o && o.kind === gen.kind ? o : null;
  const f = family(gen.part), alt = /^s\d+:(c|key)$/.test(f) ? f.replace(/:(c|key)$/, (m) => (m === ':c' ? ':key' : ':c')) : null;
  const pick = (k: string | null): VNode | undefined => (k ? (fam.get(k) ?? []).find((x) => x.kind === gen.kind) : undefined);
  const sib = same ? null : f.endsWith(':c') ? pick(alt) ?? pick(f) : pick(f) ?? pick(alt);
  const src = same ?? sib;
  const keep = src ? { ap: src.ap, opacity: src.opacity, blend: src.blend, ...(src.style ? { style: src.style } : {}), ...(src.mask && !src.mask.linked ? { mask: src.mask } : {}) } : {};
  const own = same ? { id: same.id, ...(same.name ? { name: same.name } : {}), ...(same.hidden ? { hidden: true } : {}), ...(same.locked ? { locked: true } : {}), ...(same.note ? { note: same.note } : {}) } : { id: newId(gen.kind === 'group' ? 'g' : gen.kind === 'text' ? 't' : 'p') };
  if (gen.kind === 'text') { const st = src?.kind === 'text' ? src.spans[0]?.style : undefined; return { ...gen, ...own, ...(src ? { opacity: src.opacity, blend: src.blend } : {}), spans: st ? gen.spans.map((sp) => ({ ...sp, style: st })) : gen.spans }; }
  if (gen.kind === 'group') return { ...gen, ...own, ...(same ? keep : {}), children: kids ?? [] };
  if (gen.kind === 'path' && gen.part.startsWith('s') && /:(c\d+|key|area|line)$/.test(gen.part) && src?.kind === 'path') return { ...gen, ...own, ...keep };
  return { ...gen, ...own, ...(same ? keep : {}) };
}

const specKeys = new WeakMap<GraphSpec, string>(), designKeys = new WeakMap<GraphDesign, string>();
export function graphKey(doc: Doc, s: GraphSpec): string {
  let k = specKeys.get(s);
  if (k === undefined) { k = JSON.stringify({ ...s, xf: undefined }); specKeys.set(s, k); }
  const used = new Set([...Object.values(s.columns ?? {}).map((x) => x.design), ...Object.values(s.markers ?? {})]);
  if (!used.size) return k;
  return k + '|' + [...used].map((id) => { const d = doc.graphDesigns?.find((x) => x.id === id); if (!d) return `${id}:-`; let dk = designKeys.get(d); if (dk === undefined) { dk = JSON.stringify(d.art); designKeys.set(d, dk); } return dk; }).join('|');
}

export function graphChildren(doc: Doc, g: Pick<GroupNode, 'children'> & { graph: GraphSpec }): VNode[] {
  const designs = (id: string | undefined) => { const d = id ? doc.graphDesigns?.find((x) => x.id === id) : undefined; if (!d) return null; const b = geomBounds(doc, d.art); return isEmptyRect(b) ? null : { art: d.art, b }; };
  const gen = buildGraph(g.graph, designs), old = new Map<string, VNode>(), fam = new Map<string, VNode[]>();
  collect(g.children, old);
  for (const [p, n] of old) { const f = family(p), l = fam.get(f); if (l) l.push(n); else fam.set(f, [n]); }
  return gen.map((n) => merge(n, old, fam));
}

export function graphNode(doc: Doc, s: GraphSpec, id = newId('g')): GroupNode {
  return { id, kind: 'group', name: `${GRAPH_TYPES.find((t) => t[0] === s.type)?.[1] ?? 'Column'} Graph`, clip: false, graph: s, graphKey: graphKey(doc, s), children: graphChildren(doc, { children: [], graph: s }), opacity: 1, blend: 'normal', ap: emptyAppearance() };
}

export function refreshGraphs(doc: Doc): Doc {
  const fix: string[] = [];
  walk(doc.layers, (n) => { if (n.kind === 'group' && n.graph) { if (graphKey(doc, n.graph) !== n.graphKey) fix.push(n.id); return false; } });
  if (!fix.length) return doc;
  return updateNodes(doc, fix, (n) => (n.kind === 'group' && n.graph ? { ...n, children: graphChildren(doc, { children: n.children, graph: n.graph }), graphKey: graphKey(doc, n.graph) } : n));
}

export function xfGraph(s: GraphSpec, m: Mat): GraphSpec {
  const x = mul(m, s.xf);
  if (Math.abs(x[1]) < 1e-9 && Math.abs(x[2]) < 1e-9 && x[0] > 0 && x[3] > 0) return { ...s, w: s.w * x[0], h: s.h * x[3], xf: [1, 0, 0, 1, x[4], x[5]] };
  return { ...s, xf: x };
}

export function restyleText(n: VNode, patch: { font?: string; style?: string; size?: number }): VNode {
  if (n.kind === 'text' && n.part) return { ...n, spans: n.spans.map((sp) => ({ ...sp, style: { ...sp.style, ...patch } })) };
  if (n.kind === 'group' && n.part) return { ...n, children: n.children.map((c) => restyleText(c, patch)) };
  return n;
}

export function seriesOfPart(part: string | undefined): number | null {
  const m = part ? /^(?:sh:)?s(\d+)(?::|$)/.exec(part) : null;
  return m ? Number(m[1]) : null;
}

export function graphSummary(s: GraphSpec): string {
  const d = cleanData(s.data);
  return `${GRAPH_TYPES.find((t) => t[0] === s.type)?.[1] ?? s.type} graph, ${Math.round(s.w)} by ${Math.round(s.h)} pt, ${d.cats.length} row(s) by ${d.series.length} column(s)${s.seriesTypes && Object.keys(s.seriesTypes).length ? `, combined: ${Object.entries(s.seriesTypes).map(([k, v]) => `${d.series[Number(k)] || `column ${Number(k) + 1}`} as ${v}`).join(', ')}` : ''}`;
}
