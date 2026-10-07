import { apply, emptyRect, pathLength, pointAtLength, transformRect, unionRect } from './geometry';
import { BLACK, NONE, solid } from './paint';
import type { CharStyle, Mat, ParaStyle, Pt, Rect, Span, TextNode } from './types';

export const DEFAULT_CHAR: CharStyle = {
  font: 'Inter', style: 'Regular', size: 12, leading: null, tracking: 0, kerning: 'auto', baseline: 0, hscale: 100, vscale: 100,
  fill: solid(BLACK), stroke: NONE, strokeWidth: 1, underline: false, strike: false, caps: 'none', position: 'normal', features: [],
};
export const DEFAULT_PARA: ParaStyle = { align: 'left', indentLeft: 0, indentRight: 0, indentFirst: 0, spaceBefore: 0, spaceAfter: 0, hyphenate: false };

export interface Glyph { ch: string; x: number; y: number; w: number; size: number; style: CharStyle; index: number; angle: number }
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

interface Item { ch: string; st: CharStyle; index: number }
function items(spans: Span[]): Item[] {
  const out: Item[] = [];
  let i = 0;
  for (const sp of spans) {
    const text = sp.style.caps === 'all' ? sp.text.toUpperCase() : sp.text;
    for (const ch of text) { out.push({ ch, st: sp.style, index: i }); i += ch.length; }
  }
  return out;
}

function effSize(st: CharStyle): number { return st.position === 'normal' ? st.size : st.size * 0.583; }
function effShift(st: CharStyle): number { return st.baseline + (st.position === 'super' ? -st.size * 0.333 : st.position === 'sub' ? st.size * 0.15 : 0); }

function advance(it: Item, next: Item | undefined): number {
  const size = effSize(it.st), font = cssFont(it.st, size);
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

function layoutLines(n: TextNode): TextLayout {
  const all = items(n.spans), para = n.para, area = n.mode === 'area' && n.frame;
  const frame = area ? n.frame as Rect : null;
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
  let paraStart = 0;
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const p = paragraphs[pi];
    const pIndex = p.length ? p[0].index : paraStart;
    const raw: Item[][] = [];
    if (!frame) raw.push(p);
    else {
      let line: Item[] = [], width = 0, lastBreak = -1;
      const avail = (firstLine: boolean): number => colW - para.indentLeft - para.indentRight - (firstLine ? para.indentFirst : 0);
      for (let i = 0; i < p.length; i++) {
        const it = p[i], w = advance(it, p[i + 1]);
        line.push(it); width += w;
        if (it.ch === ' ' || it.ch === '\t' || it.ch === '-') lastBreak = line.length;
        if (width > avail(raw.length === 0) && line.length > 1) {
          let cut = lastBreak > 0 ? lastBreak : line.length - 1;
          if (cut <= 0) cut = line.length - 1;
          raw.push(line.slice(0, cut));
          line = line.slice(cut);
          width = line.reduce((s, x, k) => s + advance(x, line[k + 1]), 0);
          lastBreak = -1;
          for (let k = 0; k < line.length; k++) if (line[k].ch === ' ') lastBreak = k + 1;
        }
      }
      raw.push(line);
    }
    if (pi > 0 || !first) y += para.spaceBefore;
    raw.forEach((li, liIdx) => {
      const sizes = li.length ? li.map((x) => x.st) : [n.spans[n.spans.length - 1]?.style ?? DEFAULT_CHAR];
      const lead = Math.max(...sizes.map(leadingOf)), maxSize = Math.max(...sizes.map((s) => s.size));
      const asc = metrics(sizes[0], maxSize).ascent, desc = metrics(sizes[0], maxSize).descent;
      if (first) { y = frame ? top + asc : 0; first = false; }
      else y += lead;
      if (frame && y + desc > bottom + 0.01) {
        if (col + 1 < cols) { col++; y = top + asc; }
        else { if (overflowAt < 0) overflowAt = li.length ? li[0].index : pIndex; return; }
      }
      const visible = li.filter((x, k) => !(k === li.length - 1 && x.ch === ' '));
      const widths = visible.map((x, k) => advance(x, visible[k + 1]));
      const lineW = widths.reduce((a, b) => a + b, 0);
      const indent = para.indentLeft + (liIdx === 0 ? para.indentFirst : 0);
      const availW = frame ? colW - para.indentLeft - para.indentRight - (liIdx === 0 ? para.indentFirst : 0) : 0;
      const lastLine = liIdx === raw.length - 1;
      let x0 = startCol(col) + indent, extraSpace = 0;
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
        glyphs.push({ ch: it.ch, x, y: y + effShift(it.st), w: widths[k], size: effSize(it.st), style: it.st, index: it.index, angle: 0 });
        x += widths[k] + (it.ch === ' ' ? extraSpace : 0);
      });
      const start = li.length ? li[0].index : pIndex, end = li.length ? li[li.length - 1].index + li[li.length - 1].ch.length : pIndex;
      lines.push({ y, x: x0, width: x - x0, ascent: asc, descent: desc, glyphs, start, end });
    });
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
    glyphs.push({ ch: it.ch, x: cx, y: cy, w: widths[k], size: effSize(it.st), style: it.st, index: it.index, angle: n.pathEffect === 'skew' ? 0 : ang });
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
    if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fillText(g.ch, 0, 0); }
    for (const f of extraFills) { ctx.fillStyle = f; ctx.fillText(g.ch, 0, 0); }
    if (st.stroke.type !== 'none' && st.strokeWidth > 0) {
      const ss = paintStyle(st.stroke, b);
      if (ss) { ctx.strokeStyle = ss; ctx.lineWidth = st.strokeWidth; ctx.lineJoin = 'round'; ctx.strokeText(g.ch, 0, 0); }
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
export function styleAt(spans: Span[], index: number): CharStyle {
  let pos = 0;
  for (const sp of spans) { if (index <= pos + sp.text.length) return sp.style; pos += sp.text.length; }
  return spans[spans.length - 1]?.style ?? DEFAULT_CHAR;
}
