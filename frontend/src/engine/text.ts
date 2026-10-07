import { apply, emptyRect, pathLength, pointAtLength, toPath2D, transformRect, unionRect } from './geometry';
import { BLACK, NONE, solid } from './paint';
import type { CharStyle, Mat, ParaStyle, PathData, Pt, Rect, Span, TextNode } from './types';

export const DEFAULT_CHAR: CharStyle = {
  font: 'Inter', style: 'Regular', size: 12, leading: null, tracking: 0, kerning: 'auto', baseline: 0, hscale: 100, vscale: 100,
  fill: solid(BLACK), stroke: NONE, strokeWidth: 1, underline: false, strike: false, caps: 'none', position: 'normal', features: [],
};
export const DEFAULT_PARA: ParaStyle = { align: 'left', indentLeft: 0, indentRight: 0, indentFirst: 0, spaceBefore: 0, spaceAfter: 0, hyphenate: false };

export interface Glyph { ch: string; x: number; y: number; w: number; size: number; style: CharStyle; index: number; angle: number; gid?: number }
export interface Line { y: number; x: number; width: number; ascent: number; descent: number; glyphs: Glyph[]; start: number; end: number }
export interface TextLayout { lines: Line[]; glyphs: Glyph[]; bounds: Rect; overflow: number; text: string }

let measureCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
function mctx(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  if (!measureCtx) {
    measureCtx = typeof OffscreenCanvas !== 'undefined' ? (new OffscreenCanvas(4, 4).getContext('2d') as OffscreenCanvasRenderingContext2D) : (document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D);
  }
  return measureCtx;
}

export function weightOf(style: string): { weight: number; italic: boolean } {
  const s = style.toLowerCase(), italic = /italic|oblique/.test(s);
  const n = /\b(\d{3})\b/.exec(s);
  if (n) return { weight: +n[1], italic };
  const w = /thin|hairline/.test(s) ? 100 : /extra ?light|ultra ?light/.test(s) ? 200 : /light/.test(s) ? 300 : /medium/.test(s) ? 500 : /semi ?bold|demi ?bold/.test(s) ? 600 : /extra ?bold|ultra ?bold/.test(s) ? 800 : /black|heavy/.test(s) ? 900 : /bold/.test(s) ? 700 : 400;
  return { weight: w, italic };
}
export function cssFont(st: CharStyle, size = st.size): string {
  const { weight, italic } = weightOf(st.style);
  const fam = st.font.includes('"') ? st.font : `"${st.font}"`;
  return `${italic ? 'italic ' : ''}${weight} ${Math.max(0.1, size)}px ${fam}, "Inter", sans-serif`;
}

const widthCache = new Map<string, Map<string, number>>();
let fontEpoch = 0;
export function fontsChanged(): void { widthCache.clear(); fontEpoch++; layoutCache = new WeakMap(); }
export const textEpoch = (): number => fontEpoch;
function charWidth(font: string, ch: string): number {
  let m = widthCache.get(font);
  if (!m) { m = new Map(); widthCache.set(font, m); }
  let w = m.get(ch);
  if (w === undefined) {
    const c = mctx();
    c.font = font;
    w = c.measureText(ch).width;
    m.set(ch, w);
  }
  return w;
}
function pairKern(font: string, a: string, b: string): number {
  const key = `\u0000${a}${b}`;
  let m = widthCache.get(font);
  if (!m) { m = new Map(); widthCache.set(font, m); }
  let k = m.get(key);
  if (k === undefined) { const c = mctx(); c.font = font; k = c.measureText(a + b).width - charWidth(font, a) - charWidth(font, b); if (Math.abs(k) < 1e-3) k = 0; m.set(key, k); }
  return k;
}
function metrics(st: CharStyle, size: number): { ascent: number; descent: number } {
  return { ascent: size * 0.8, descent: size * 0.22 };
}

export function plainText(n: TextNode): string { return n.spans.map((s) => s.text).join(''); }

export interface ShapedGlyph { gid: number; chars: number; adv: number }
export interface Shaping {
  shape(st: CharStyle, text: string, features: string[]): ShapedGlyph[] | null;
  outline(st: CharStyle, gid: number): PathData | null;
  has(st: CharStyle, feature: string): boolean;
}
let shaping: Shaping | null = null;
export function setShaping(s: Shaping | null): void { shaping = s; fontsChanged(); }
export function glyphOutline(st: CharStyle, gid: number): PathData | null { return shaping?.outline(st, gid) ?? null; }
export function fontHasFeature(st: CharStyle, feature: string): boolean { return !!shaping?.has(st, feature); }

interface Item { ch: string; st: CharStyle; index: number; gid?: number; adv?: number }
const smallCaps = new WeakMap<CharStyle, CharStyle>();
function smallOf(st: CharStyle): CharStyle {
  let s = smallCaps.get(st);
  if (!s) { s = { ...st, size: st.size * 0.72, caps: 'none', leading: st.leading ?? st.size * 1.2 }; smallCaps.set(st, s); }
  return s;
}
function items(spans: Span[]): Item[] {
  const out: Item[] = [];
  let i = 0;
  for (const sp of spans) {
    const st = sp.style, text = st.caps === 'all' ? sp.text.toUpperCase() : sp.text;
    const smcp = st.caps === 'small' && fontHasFeature(st, 'smcp');
    const feats = smcp ? [...st.features, 'smcp'] : st.features;
    for (const piece of text.split(/(\r\n|\r|\n)/)) {
      if (!piece) continue;
      if (piece === '\n' || piece === '\r' || piece === '\r\n') { out.push({ ch: '\n', st, index: i }); i += piece.length; continue; }
      const shaped = (feats.length || st.alt !== undefined) && shaping ? shaping.shape(st, piece, feats) : null;
      if (shaped) {
        let k = 0;
        for (const g of shaped) { const ch = piece.slice(k, k + g.chars); out.push({ ch, st, index: i, gid: g.gid, adv: g.adv }); i += ch.length; k += g.chars; }
        continue;
      }
      for (const ch of piece) {
        if (st.caps === 'small' && ch !== ch.toUpperCase()) out.push({ ch: ch.toUpperCase(), st: smallOf(st), index: i });
        else out.push({ ch, st, index: i });
        i += ch.length;
      }
    }
  }
  return out;
}

function effSize(st: CharStyle): number { return st.position === 'normal' ? st.size : st.size * 0.583; }
function effShift(st: CharStyle): number { return st.baseline + (st.position === 'super' ? -st.size * 0.333 : st.position === 'sub' ? st.size * 0.15 : 0); }

function advance(it: Item, next: Item | undefined): number {
  const size = effSize(it.st);
  if (it.adv !== undefined) return it.adv * size * (it.st.hscale / 100) + (it.st.tracking / 1000) * it.st.size;
  const font = cssFont(it.st, size);
  let w = charWidth(font, it.ch) * (it.st.hscale / 100);
  if (next && next.st === it.st && it.st.kerning !== 'none') w += pairKern(font, it.ch, next.ch) * (it.st.hscale / 100);
  return w + (it.st.tracking / 1000) * it.st.size;
}

function leadingOf(st: CharStyle): number { return st.leading ?? st.size * 1.2; }

let layoutCache = new WeakMap<TextNode, TextLayout>();

export function layoutText(n: TextNode): TextLayout {
  const hit = layoutCache.get(n);
  if (hit) return hit;
  const r = n.mode === 'path' ? layoutOnPath(n) : layoutLines(n);
  layoutCache.set(n, r);
  return r;
}

type Band = Array<[number, number]>;
function bandRange(pts: Pt[], y0: number, y1: number): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (Math.max(a.y, b.y) < y0 || Math.min(a.y, b.y) > y1) continue;
    if (a.y === b.y) { lo = Math.min(lo, a.x, b.x); hi = Math.max(hi, a.x, b.x); continue; }
    for (const y of [Math.max(Math.min(a.y, b.y), y0), Math.min(Math.max(a.y, b.y), y1)]) { const x = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x); lo = Math.min(lo, x); hi = Math.max(hi, x); }
  }
  return lo <= hi ? [lo, hi] : null;
}
function cutBand(free: Band, a: number, b: number): Band {
  const out: Band = [];
  for (const [s, e] of free) { if (b <= s || a >= e) { out.push([s, e]); continue; } if (a > s) out.push([s, a]); if (b < e) out.push([b, e]); }
  return out;
}
function keepBand(free: Band, a: number, b: number): Band {
  const out: Band = [];
  for (const [s, e] of free) { const x = Math.max(s, a), y = Math.min(e, b); if (y > x) out.push([x, y]); }
  return out;
}

function layoutLines(n: TextNode): TextLayout {
  const all = items(n.spans), para = n.para, frame = n.mode === 'area' && n.frame ? n.frame : null;
  const inset = n.area?.inset ?? 0;
  const cols = Math.max(1, n.area?.columns ?? 1), gutter = n.area?.gutter ?? 12;
  const colW = frame ? (frame.w - inset * 2 - gutter * (cols - 1)) / cols : Infinity;
  const lines: Line[] = [];
  const paragraphs: Item[][] = [[]];
  for (const it of all) { if (it.ch === '\n' || it.ch === '\r') paragraphs.push([]); else paragraphs[paragraphs.length - 1].push(it); }
  let y = 0, col = 0, first = true, overflowAt = -1;
  const top = frame ? frame.y + inset : 0;
  const bottom = frame ? frame.y + frame.h - inset : Infinity;
  const startCol = (c: number): number => (frame ? frame.x + inset + c * (colW + gutter) : 0);
  const wraps = frame ? n.wrapShape ?? [] : [];
  const slots = (c: number, y0: number, y1: number, minW: number): Band => {
    let free: Band = [[startCol(c), startCol(c) + colW]];
    for (const w of wraps) {
      if (w.invert) {
        const a = bandRange(w.pts, y0, y0), b = bandRange(w.pts, y1, y1);
        free = a && b ? keepBand(free, Math.max(a[0], b[0]) + w.offset, Math.min(a[1], b[1]) - w.offset) : [];
      } else {
        const r = bandRange(w.pts, y0 - w.offset, y1 + w.offset);
        if (r) free = cutBand(free, r[0] - w.offset, r[1] + w.offset);
      }
    }
    return free.filter(([a, b]) => b - a >= minW);
  };
  const tail = n.spans[n.spans.length - 1]?.style ?? DEFAULT_CHAR;
  let paraStart = 0;
  outer: for (let pi = 0; pi < paragraphs.length; pi++) {
    const p = paragraphs[pi];
    const pIndex = p.length ? p[0].index : paraStart;
    if (pi > 0) y += para.spaceBefore;
    let i = 0, lineNo = 0;
    do {
      const st0 = p[i]?.st ?? tail, lead0 = leadingOf(st0), m0 = metrics(st0, st0.size);
      let ly = first ? (frame ? top + m0.ascent : 0) : y + lead0, fromTop = first && !!frame;
      let band: Band = [[startCol(col), Infinity]];
      if (frame) {
        for (let guard = 0; ; guard++) {
          if (ly + m0.descent > bottom + 0.01) {
            if (col + 1 < cols) { col++; ly = top + m0.ascent; fromTop = true; continue; }
            overflowAt = p[i]?.index ?? pIndex;
            break outer;
          }
          band = wraps.length ? slots(col, ly - m0.ascent, ly + m0.descent, Math.max(st0.size * 1.5, 4)) : [[startCol(col), startCol(col) + colW]];
          if (band.length || guard > 4000) break;
          ly += Math.max(1, lead0);
          fromTop = false;
        }
      }
      first = false;
      let lineY = ly;
      for (let si = 0; si < band.length; si++) {
        if (si > 0 && i >= p.length) break;
        const [sx0, sx1] = band[si];
        const firstLine = lineNo === 0;
        const indent = para.indentLeft + (firstLine ? para.indentFirst : 0);
        const availW = frame ? sx1 - sx0 - indent - para.indentRight : Infinity;
        let j = i, width = 0, lastBreak = -1, end = p.length;
        while (j < p.length) {
          const w = advance(p[j], p[j + 1]);
          if (width + w > availW && j > i) { end = p[j].ch === ' ' || p[j].ch === '\t' ? j + 1 : lastBreak > i ? lastBreak : j; break; }
          width += w;
          if (p[j].ch === ' ' || p[j].ch === '\t' || p[j].ch === '-') lastBreak = j + 1;
          j++;
        }
        const li = p.slice(i, end);
        i = end;
        const sizes = li.length ? li.map((x) => x.st) : [st0];
        const lead = Math.max(...sizes.map(leadingOf)), maxSize = Math.max(...sizes.map((s) => s.size));
        const asc = metrics(sizes[0], maxSize).ascent, desc = metrics(sizes[0], maxSize).descent;
        if (si === 0) lineY = ly + (fromTop ? asc - m0.ascent : lines.length ? lead - lead0 : 0);
        const visible = li.filter((x, k) => !(k === li.length - 1 && x.ch === ' '));
        const widths = visible.map((x, k) => advance(x, visible[k + 1]));
        const lineW = widths.reduce((a, b) => a + b, 0);
        const lastLine = i >= p.length;
        let x0 = (frame ? sx0 : startCol(col)) + indent, extraSpace = 0;
        const align = para.align;
        if (frame) {
          if (align === 'center' || (align === 'justify_center' && lastLine)) x0 += (availW - lineW) / 2;
          else if (align === 'right' || (align === 'justify_right' && lastLine)) x0 += availW - lineW;
          else if (align.startsWith('justify') && (!lastLine || align === 'justify_all')) {
            const spaces = visible.filter((x) => x.ch === ' ').length;
            if (spaces > 0) extraSpace = (availW - lineW) / spaces;
          }
        } else {
          if (align === 'center' || align === 'justify_center') x0 = -lineW / 2;
          else if (align === 'right' || align === 'justify_right') x0 = -lineW;
        }
        const glyphs: Glyph[] = [];
        let x = x0;
        visible.forEach((it, k) => {
          glyphs.push({ ch: it.ch, x, y: lineY + effShift(it.st), w: widths[k], size: effSize(it.st), style: it.st, index: it.index, angle: 0, gid: it.gid });
          x += widths[k] + (it.ch === ' ' ? extraSpace : 0);
        });
        const start = li.length ? li[0].index : pIndex, stop = li.length ? li[li.length - 1].index + li[li.length - 1].ch.length : pIndex;
        lines.push({ y: lineY, x: x0, width: x - x0, ascent: asc, descent: desc, glyphs, start, end: stop });
        lineNo++;
      }
      y = lineY;
    } while (i < p.length);
    y += para.spaceAfter;
    paraStart = pIndex + p.reduce((s, it) => s + it.ch.length, 0) + 1;
  }
  if (!lines.length) {
    const st = n.spans[0]?.style ?? DEFAULT_CHAR;
    const asc = metrics(st, st.size).ascent;
    lines.push({ y: frame ? top + asc : 0, x: frame ? startCol(0) : 0, width: 0, ascent: asc, descent: metrics(st, st.size).descent, glyphs: [], start: 0, end: 0 });
  }
  let b = emptyRect();
  for (const l of lines) b = unionRect(b, { x: Math.min(l.x, l.x + l.width), y: l.y - l.ascent, w: Math.abs(l.width), h: l.ascent + l.descent });
  if (frame) b = { ...frame };
  return { lines, glyphs: lines.flatMap((l) => l.glyphs), bounds: b, overflow: overflowAt, text: all.map((x) => x.ch).join('') };
}

function layoutOnPath(n: TextNode): TextLayout {
  const all = items(n.spans).filter((x) => x.ch !== '\n' && x.ch !== '\r');
  const sp = n.path?.[0];
  const glyphs: Glyph[] = [];
  let b = emptyRect();
  if (!sp || sp.pts.length < 2) return { lines: [], glyphs, bounds: { x: 0, y: 0, w: 0, h: 0 }, overflow: -1, text: '' };
  const total = pathLength(sp), widths = all.map((x, k) => advance(x, all[k + 1])), textW = widths.reduce((a, c) => a + c, 0);
  let s = (n.pathStart ?? 0) * total;
  if (n.para.align === 'center') s += (total * (1 - (n.pathStart ?? 0)) - textW) / 2;
  else if (n.para.align === 'right') s = total - textW;
  let overflow = -1;
  all.forEach((it, k) => {
    const mid = s + widths[k] / 2;
    if (mid > total || mid < 0) { if (mid > total && overflow < 0) overflow = it.index; s += widths[k]; return; }
    const at = pointAtLength(sp, mid), ang = Math.atan2(at.tangent.y, at.tangent.x), shift = effShift(it.st) + (n.pathFlip ? 0 : 0);
    const nx = -at.tangent.y, ny = at.tangent.x;
    const cx = at.p.x - at.tangent.x * (widths[k] / 2) + nx * shift, cy = at.p.y - at.tangent.y * (widths[k] / 2) + ny * shift;
    glyphs.push({ ch: it.ch, x: cx, y: cy, w: widths[k], size: effSize(it.st), style: it.st, index: it.index, angle: n.pathEffect === 'skew' ? 0 : ang, gid: it.gid });
    const sz = effSize(it.st);
    b = unionRect(b, { x: Math.min(cx, at.p.x) - sz, y: Math.min(cy, at.p.y) - sz, w: widths[k] + sz * 2, h: sz * 2 });
    s += widths[k];
  });
  return { lines: [], glyphs, bounds: b, overflow, text: all.map((x) => x.ch).join('') };
}

export function textBounds(n: TextNode): Rect {
  const l = layoutText(n);
  if (n.mode === 'path') return l.bounds;
  if (n.mode === 'area' && n.framePath) return transformRect(l.bounds, n.xf);
  return transformRect(l.bounds, n.xf);
}

const glyphPaths = new WeakMap<PathData, Path2D>();
export function drawText(ctx: CanvasRenderingContext2D, n: TextNode, paintStyle: (p: CharStyle['fill'], b: Rect) => string | CanvasGradient | CanvasPattern | null, extraFills: Array<string | CanvasGradient | CanvasPattern>): void {
  const lay = layoutText(n);
  ctx.save();
  if (n.mode !== 'path') ctx.transform(n.xf[0], n.xf[1], n.xf[2], n.xf[3], n.xf[4], n.xf[5]);
  const b = lay.bounds;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  try { (ctx as unknown as { fontKerning: string }).fontKerning = 'none'; } catch { }
  for (const g of lay.glyphs) {
    if (g.ch === ' ' || g.ch === '\t') continue;
    const st = g.style;
    ctx.save();
    ctx.translate(g.x, g.y);
    if (g.angle) ctx.rotate(g.angle);
    if (st.hscale !== 100 || st.vscale !== 100) ctx.scale(st.hscale / 100, st.vscale / 100);
    ctx.font = cssFont(st, g.size);
    const fillStyle = paintStyle(st.fill, b);
    const shape = g.gid !== undefined ? glyphOutline(st, g.gid) : null;
    if (shape) {
      let p2 = glyphPaths.get(shape);
      if (!p2) { p2 = toPath2D(shape); glyphPaths.set(shape, p2); }
      ctx.save();
      ctx.scale(g.size, g.size);
      if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(p2); }
      for (const f of extraFills) { ctx.fillStyle = f; ctx.fill(p2); }
      const ss = st.stroke.type !== 'none' && st.strokeWidth > 0 ? paintStyle(st.stroke, b) : null;
      if (ss) { ctx.strokeStyle = ss; ctx.lineWidth = st.strokeWidth / Math.max(1e-6, g.size); ctx.lineJoin = 'round'; ctx.stroke(p2); }
      ctx.restore();
    } else {
      if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fillText(g.ch, 0, 0); }
      for (const f of extraFills) { ctx.fillStyle = f; ctx.fillText(g.ch, 0, 0); }
      if (st.stroke.type !== 'none' && st.strokeWidth > 0) {
        const ss = paintStyle(st.stroke, b);
        if (ss) { ctx.strokeStyle = ss; ctx.lineWidth = st.strokeWidth; ctx.lineJoin = 'round'; ctx.strokeText(g.ch, 0, 0); }
      }
    }
    if (st.underline || st.strike) {
      ctx.fillStyle = fillStyle ?? '#000';
      const t = Math.max(0.5, g.size * 0.06);
      if (st.underline) ctx.fillRect(0, g.size * 0.12, g.w, t);
      if (st.strike) ctx.fillRect(0, -g.size * 0.3, g.w, t);
    }
    ctx.restore();
  }
  ctx.restore();
}

export function caretAt(n: TextNode, index: number): { x: number; y: number; h: number; angle: number } {
  const lay = layoutText(n);
  const pt = (x: number, y: number): Pt => (n.mode === 'path' ? { x, y } : apply(n.xf, x, y));
  for (const l of lay.lines) {
    if (index >= l.start && index <= l.end) {
      let x = l.x;
      for (const g of l.glyphs) { if (g.index >= index) break; x = g.x + g.w; }
      const p = pt(x, l.y - l.ascent);
      return { x: p.x, y: p.y, h: (l.ascent + l.descent) * Math.hypot(n.xf[2], n.xf[3]), angle: Math.atan2(n.xf[1], n.xf[0]) };
    }
  }
  const g = lay.glyphs[lay.glyphs.length - 1];
  if (g) { const p = n.mode === 'path' ? { x: g.x + Math.cos(g.angle) * g.w, y: g.y + Math.sin(g.angle) * g.w } : pt(g.x + g.w, g.y - g.size * 0.8); return { x: p.x, y: n.mode === 'path' ? p.y - g.size * 0.8 : p.y, h: g.size * 1.02, angle: g.angle }; }
  const first = lay.lines[0];
  const p = pt(first ? first.x : 0, first ? first.y - first.ascent : 0);
  return { x: p.x, y: p.y, h: first ? first.ascent + first.descent : 12, angle: 0 };
}

export function indexAt(n: TextNode, local: Pt): number {
  const lay = layoutText(n);
  if (!lay.lines.length) {
    let best = 0, bd = Infinity;
    for (const g of lay.glyphs) { const d = Math.hypot(g.x - local.x, g.y - local.y); if (d < bd) { bd = d; best = local.x > g.x + g.w / 2 ? g.index + 1 : g.index; } }
    return best;
  }
  let line = lay.lines[0];
  for (const l of lay.lines) if (local.y >= l.y - l.ascent - 2) line = l;
  for (const g of line.glyphs) if (local.x < g.x + g.w / 2) return g.index;
  return line.end;
}

export function textNode(text: string, x: number, y: number, style: Partial<CharStyle> = {}, para: Partial<ParaStyle> = {}): Omit<TextNode, 'id'> {
  const xf: Mat = [1, 0, 0, 1, x, y];
  return { kind: 'text', mode: 'point', spans: [{ text, style: { ...DEFAULT_CHAR, ...style } }], para: { ...DEFAULT_PARA, ...para }, xf, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
}

export function setPlainText(n: TextNode, text: string): Span[] {
  const st = n.spans[0]?.style ?? DEFAULT_CHAR;
  return [{ text, style: st }];
}

export function styleSpans(spans: Span[], start: number, end: number, patch: Partial<CharStyle>): Span[] {
  const out: Span[] = [];
  let pos = 0;
  for (const sp of spans) {
    const a = pos, b = pos + sp.text.length;
    pos = b;
    if (b <= start || a >= end) { out.push(sp); continue; }
    const s0 = Math.max(start, a) - a, s1 = Math.min(end, b) - a;
    if (s0 > 0) out.push({ text: sp.text.slice(0, s0), style: sp.style });
    out.push({ text: sp.text.slice(s0, s1), style: { ...sp.style, ...patch } });
    if (s1 < sp.text.length) out.push({ text: sp.text.slice(s1), style: sp.style });
  }
  return mergeSpans(out);
}
export function mergeSpans(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const sp of spans) {
    if (!sp.text && out.length) continue;
    const last = out[out.length - 1];
    if (last && JSON.stringify(last.style) === JSON.stringify(sp.style)) last.text += sp.text;
    else out.push({ text: sp.text, style: sp.style });
  }
  return out.length ? out : spans.slice(0, 1);
}
export function insertText(spans: Span[], at: number, text: string, style?: CharStyle): Span[] {
  const out: Span[] = [];
  let pos = 0, done = false;
  for (const sp of spans) {
    const a = pos, b = pos + sp.text.length;
    pos = b;
    if (!done && at >= a && at <= b) {
      out.push({ text: sp.text.slice(0, at - a) + (style ? '' : text) + (style ? '' : sp.text.slice(at - a)), style: sp.style });
      if (style) { out.push({ text, style }); out.push({ text: sp.text.slice(at - a), style: sp.style }); }
      done = true;
    } else out.push(sp);
  }
  if (!done) out.push({ text, style: style ?? spans[spans.length - 1]?.style ?? DEFAULT_CHAR });
  return mergeSpans(out);
}
export function deleteText(spans: Span[], start: number, end: number): Span[] {
  const out: Span[] = [];
  let pos = 0;
  for (const sp of spans) {
    const a = pos, b = pos + sp.text.length;
    pos = b;
    if (b <= start || a >= end) { out.push(sp); continue; }
    out.push({ text: sp.text.slice(0, Math.max(0, start - a)) + sp.text.slice(Math.min(sp.text.length, end - a)), style: sp.style });
  }
  const merged = mergeSpans(out);
  return merged.length ? merged : [{ text: '', style: spans[0]?.style ?? DEFAULT_CHAR }];
}
export function sliceSpans(spans: Span[], start: number, end = Infinity): Span[] {
  const out: Span[] = [];
  let pos = 0;
  for (const sp of spans) {
    const a = pos, b = pos + sp.text.length;
    pos = b;
    if (b <= start || a >= end) continue;
    out.push({ text: sp.text.slice(Math.max(0, start - a), Math.min(sp.text.length, end - a)), style: sp.style });
  }
  return out.length ? mergeSpans(out) : [{ text: '', style: styleAt(spans, start) }];
}
export function styleAt(spans: Span[], index: number): CharStyle {
  let pos = 0;
  for (const sp of spans) { if (index <= pos + sp.text.length) return sp.style; pos += sp.text.length; }
  return spans[spans.length - 1]?.style ?? DEFAULT_CHAR;
}
