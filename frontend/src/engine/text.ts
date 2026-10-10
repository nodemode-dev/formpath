import { apply, emptyRect, invert, mul, nearestOnSeg, pathBounds, pathLength, pointAtLength, rectCorners, reversePath, segLength, segments, toPath2D, transformPath, transformRect, unionRect } from './geometry';
import { BLACK, NONE, solid } from './paint';
import type { AreaOptions, CharStyle, Mat, ParaStyle, PathData, Pt, Rect, Span, SubPath, TextNode } from './types';

export const DEFAULT_CHAR: CharStyle = {
  font: 'Inter', style: 'Regular', size: 12, leading: null, tracking: 0, kerning: 'auto', baseline: 0, hscale: 100, vscale: 100,
  fill: solid(BLACK), stroke: NONE, strokeWidth: 1, underline: false, strike: false, caps: 'none', position: 'normal', features: [],
};
export const DEFAULT_PARA: ParaStyle = { align: 'left', indentLeft: 0, indentRight: 0, indentFirst: 0, spaceBefore: 0, spaceAfter: 0, hyphenate: false };

export interface Glyph { ch: string; x: number; y: number; w: number; size: number; style: CharStyle; index: number; angle: number; gid?: number; m?: [number, number, number, number]; iu?: number; ia?: number; up?: boolean; box?: Rect }
export interface Line { y: number; x: number; width: number; ascent: number; descent: number; glyphs: Glyph[]; start: number; end: number }
export interface TextLayout { lines: Line[]; glyphs: Glyph[]; bounds: Rect; overflow: number; text: string; vertical?: boolean }

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
export interface VerticalGlyph extends ShapedGlyph { vadv: number; vorg: number; sub: boolean }
export interface FontMetrics { cap: number; x: number; ascender: number }
export interface Shaping {
  shape(st: CharStyle, text: string, features: string[]): ShapedGlyph[] | null;
  outline(st: CharStyle, gid: number): PathData | null;
  has(st: CharStyle, feature: string): boolean;
  vertical?(st: CharStyle, text: string, features: string[]): VerticalGlyph[] | null;
  metrics?(st: CharStyle): FontMetrics | null;
}
let shaping: Shaping | null = null;
export function setShaping(s: Shaping | null): void { shaping = s; fontsChanged(); }
export function glyphOutline(st: CharStyle, gid: number): PathData | null { return shaping?.outline(st, gid) ?? null; }
export function fontHasFeature(st: CharStyle, feature: string): boolean { return !!shaping?.has(st, feature); }

interface Item { ch: string; st: CharStyle; index: number; gid?: number; adv?: number; up?: boolean; vadv?: number; vorg?: number }
const EM_ORG = 0.88;
const UPRIGHT: ReadonlyArray<readonly [number, number]> = [[0xa7, 0xa7], [0xa9, 0xa9], [0xae, 0xae], [0xb1, 0xb1], [0xbc, 0xbe], [0xd7, 0xd7], [0xf7, 0xf7], [0x1100, 0x11ff], [0x2030, 0x2031], [0x203b, 0x203b], [0x2100, 0x218f], [0x2460, 0x24ff], [0x25a0, 0x27bf], [0x2e80, 0xa4cf], [0xa960, 0xa97f], [0xac00, 0xd7ff], [0xe000, 0xfaff], [0xfe10, 0xfe1f], [0xfe30, 0xfe6f], [0xff00, 0xff60], [0xffe0, 0xffe7], [0x1f000, 0x1faff], [0x20000, 0x3ffff]];
const TURNED: ReadonlyArray<readonly [number, number]> = [[0x2329, 0x232a], [0x3008, 0x3011], [0x3014, 0x301f], [0x3030, 0x3030], [0x30a0, 0x30a0], [0x30fc, 0x30fc], [0xfe59, 0xfe5e], [0xff08, 0xff09], [0xff0d, 0xff0d], [0xff1c, 0xff1e], [0xff3b, 0xff3b], [0xff3d, 0xff3d], [0xff3f, 0xff3f], [0xff5b, 0xff60], [0xffe3, 0xffe3]];
const inRanges = (cp: number, r: ReadonlyArray<readonly [number, number]>): boolean => r.some(([a, b]) => cp >= a && cp <= b);
export function verticalClass(ch: string): 'upright' | 'rotated' | 'turned' {
  const cp = ch.codePointAt(0) ?? 0;
  return inRanges(cp, TURNED) ? 'turned' : inRanges(cp, UPRIGHT) ? 'upright' : 'rotated';
}
const NO_START = /^[、。，．・：；？！）」』】〕〉》ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]$/;
function cjkBreakAfter(ch: string, next: string | undefined): boolean {
  return (ch.codePointAt(0) ?? 0) >= 0x2e80 && verticalClass(ch) !== 'rotated' && !/^[「『（【〔〈《]$/.test(ch) && !NO_START.test(next ?? '');
}
function orient(out: Item[]): Item[] {
  for (const it of out) {
    if (it.ch === '\n') continue;
    const cls = verticalClass(it.ch), vs = shaping?.vertical?.(it.st, it.ch, it.st.features)?.[0];
    const up = !!it.st.upright || cls === 'upright' || (cls === 'turned' && !!vs?.sub && vs.gid > 0);
    it.up = up;
    if (!vs || vs.gid <= 0) continue;
    if (up && vs.sub) { it.gid = vs.gid; it.adv = vs.adv; }
    it.vadv = vs.vadv; it.vorg = vs.vorg;
  }
  return out;
}
const smallCaps = new WeakMap<CharStyle, CharStyle>();
function smallOf(st: CharStyle): CharStyle {
  let s = smallCaps.get(st);
  if (!s) { s = { ...st, size: st.size * 0.72, caps: 'none', leading: st.leading ?? st.size * 1.2 }; smallCaps.set(st, s); }
  return s;
}
function items(spans: Span[], vertical = false): Item[] {
  return vertical ? orient(itemsOf(spans)) : itemsOf(spans);
}
function itemsOf(spans: Span[]): Item[] {
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

function uprightWidth(it: Item): number {
  const size = effSize(it.st);
  return (it.adv !== undefined ? it.adv * size : charWidth(cssFont(it.st, size), it.ch)) * (it.st.hscale / 100);
}
function vAdvance(it: Item, next: Item | undefined): number {
  if (!it.up) return advance(it, next);
  return (it.vadv ?? 1) * effSize(it.st) * (it.st.vscale / 100) + (it.st.tracking / 1000) * it.st.size;
}
function lineMetrics(st: CharStyle, size: number, vertical: boolean): { ascent: number; descent: number } {
  return vertical ? { ascent: size / 2, descent: size / 2 } : metrics(st, size);
}

function firstBase(a: AreaOptions | undefined, st: CharStyle, maxSize: number, lead: number, vertical: boolean): number {
  const kind = a?.firstBaseline ?? 'ascent', min = a?.baselineMin ?? 0;
  if (kind === 'fixed') return min;
  if (vertical) return Math.max(min, maxSize / 2);
  const fm = kind === 'cap' || kind === 'x' || kind === 'legacy' ? shaping?.metrics?.(st) ?? null : null;
  const v = kind === 'cap' ? (fm?.cap ?? 0.7) * maxSize : kind === 'x' ? (fm?.x ?? 0.5) * maxSize : kind === 'leading' ? lead : kind === 'em' ? EM_ORG * maxSize : kind === 'legacy' ? (fm?.ascender ?? 0.8) * maxSize : metrics(st, maxSize).ascent;
  return Math.max(min, v);
}

interface Cell { x: number; w: number; top: number; bottom: number }
function areaCells(a: AreaOptions | undefined, f: Rect, vertical: boolean): Cell[] {
  const inset = a?.inset ?? 0, cols = Math.max(1, Math.round(a?.columns ?? 1)), rows = Math.max(1, Math.round(a?.rows ?? 1));
  const g = a?.gutter ?? 12, rg = a?.rowGutter ?? g;
  const cw = (f.w - inset * 2 - g * (cols - 1)) / cols, rh = (f.h - inset * 2 - rg * (rows - 1)) / rows;
  const col = (k: number): number => (vertical ? cols - 1 - k : k);
  const order: Array<[number, number]> = [];
  if ((a?.flow ?? 'rows') === 'rows') { for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) order.push([r, col(k)]); }
  else for (let k = 0; k < cols; k++) for (let r = 0; r < rows; r++) order.push([r, col(k)]);
  return order.map(([r, c]) => {
    const x = f.x + inset + c * (cw + g), y = f.y + inset + r * (rh + rg);
    return vertical ? { x: y, w: rh, top: -(x + cw), bottom: -x } : { x, w: cw, top: y, bottom: y + rh };
  });
}

function place(it: Item, u: number, a: number, base: number, vertical: boolean): Glyph {
  const size = effSize(it.st), shift = effShift(it.st), common = { ch: it.ch, size, style: it.st, index: it.index, gid: it.gid, iu: u, ia: a };
  if (!vertical) return { ...common, x: u, y: base + shift, w: a, angle: 0 };
  const c = -(base + shift);
  if (it.up) {
    const hw = uprightWidth(it), org = (it.vorg ?? EM_ORG) * size * (it.st.vscale / 100);
    return { ...common, x: c - hw / 2, y: u + org, w: hw, angle: 0, up: true, box: { x: hw / 2 - size / 2, y: -org, w: size, h: a } };
  }
  const m = metrics(it.st, size), x0 = c + (m.descent - m.ascent) / 2, off = (m.descent - m.ascent) / 2;
  return { ...common, x: x0, y: u, w: a, angle: Math.PI / 2, m: [0, 1, -1, 0], box: { x: 0, y: off - size / 2, w: a, h: size } };
}

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
  const vertical = !!n.vertical, all = items(n.spans, vertical), para = n.para, frame = n.mode === 'area' && n.frame ? n.frame : null;
  const cells: Cell[] = frame ? areaCells(n.area, frame, vertical) : [{ x: 0, w: Infinity, top: 0, bottom: Infinity }];
  const lines: Line[] = [];
  const paragraphs: Item[][] = [[]];
  for (const it of all) { if (it.ch === '\n' || it.ch === '\r') paragraphs.push([]); else paragraphs[paragraphs.length - 1].push(it); }
  let y = 0, col = 0, first = true, overflowAt = -1;
  const startCol = (c: number): number => (frame ? cells[c].x : 0);
  const step = (it: Item, next: Item | undefined): number => (vertical ? vAdvance(it, next) : advance(it, next));
  const lm = (st: CharStyle, size: number): { ascent: number; descent: number } => lineMetrics(st, size, vertical);
  const wraps = frame ? (n.wrapShape ?? []).map((w) => (vertical ? { ...w, pts: w.pts.map((q) => ({ x: q.y, y: -q.x })) } : w)) : [];
  const slots = (c: number, y0: number, y1: number, minW: number): Band => {
    let free: Band = [[cells[c].x, cells[c].x + cells[c].w]];
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
      const st0 = p[i]?.st ?? tail, lead0 = leadingOf(st0), m0 = lm(st0, st0.size), fb0 = frame ? firstBase(n.area, st0, st0.size, lead0, vertical) : 0;
      let ly = first ? (frame ? cells[col].top + fb0 : 0) : y + lead0, fromTop = first && !!frame;
      let band: Band = [[startCol(col), Infinity]];
      if (frame) {
        for (let guard = 0; ; guard++) {
          if (ly + m0.descent > cells[col].bottom + 0.01) {
            if (col + 1 < cells.length) { col++; ly = cells[col].top + fb0; fromTop = true; continue; }
            overflowAt = p[i]?.index ?? pIndex;
            break outer;
          }
          band = wraps.length ? slots(col, ly - m0.ascent, ly + m0.descent, Math.max(st0.size * 1.5, 4)) : [[cells[col].x, cells[col].x + cells[col].w]];
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
          const w = step(p[j], p[j + 1]);
          if (width + w > availW && j > i) { end = p[j].ch === ' ' || p[j].ch === '\t' ? j + 1 : lastBreak > i ? lastBreak : j; break; }
          width += w;
          if (p[j].ch === ' ' || p[j].ch === '\t' || p[j].ch === '-' || cjkBreakAfter(p[j].ch, p[j + 1]?.ch)) lastBreak = j + 1;
          j++;
        }
        const li = p.slice(i, end);
        i = end;
        const sizes = li.length ? li.map((x) => x.st) : [st0];
        const lead = Math.max(...sizes.map(leadingOf)), maxSize = Math.max(...sizes.map((s) => s.size));
        const asc = lm(sizes[0], maxSize).ascent, desc = lm(sizes[0], maxSize).descent;
        if (si === 0) lineY = ly + (fromTop ? firstBase(n.area, sizes[0], maxSize, lead, vertical) - fb0 : lines.length ? lead - lead0 : 0);
        const visible = li.filter((x, k) => !(k === li.length - 1 && x.ch === ' '));
        const widths = visible.map((x, k) => step(x, visible[k + 1]));
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
          glyphs.push(place(it, x, widths[k], lineY, vertical));
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
    const m = lm(st, st.size);
    lines.push({ y: frame ? cells[0].top + firstBase(n.area, st, st.size, leadingOf(st), vertical) : 0, x: frame ? startCol(0) : 0, width: 0, ascent: m.ascent, descent: m.descent, glyphs: [], start: 0, end: 0 });
  }
  const out: TextLayout = { lines, glyphs: lines.flatMap((l) => l.glyphs), bounds: emptyRect(), overflow: overflowAt, text: all.map((x) => x.ch).join(''), vertical };
  let b = emptyRect();
  for (const l of lines) b = unionRect(b, lineRect(out, l));
  out.bounds = frame ? { ...frame } : b;
  return out;
}

const absRect = (vertical: boolean | undefined, r: Rect): Rect => (vertical ? { x: -(r.y + r.h), y: r.x, w: r.h, h: r.w } : r);
const absPt = (vertical: boolean | undefined, p: Pt): Pt => (vertical ? { x: -p.y, y: p.x } : p);
const toAbs = (vertical: boolean | undefined, p: Pt): Pt => (vertical ? { x: p.y, y: -p.x } : p);
export function lineRect(lay: TextLayout, l: Line): Rect { return absRect(lay.vertical, { x: Math.min(l.x, l.x + l.width), y: l.y - l.ascent, w: Math.abs(l.width), h: l.ascent + l.descent }); }
export function lineBaseline(lay: TextLayout, l: Line): [Pt, Pt] { const w = Math.max(1, l.width); return [absPt(lay.vertical, { x: l.x, y: l.y }), absPt(lay.vertical, { x: l.x + w, y: l.y })]; }
export function glyphMat(g: Glyph): Mat {
  if (g.m) return [g.m[0], g.m[1], g.m[2], g.m[3], g.x, g.y];
  const c = Math.cos(g.angle), s = Math.sin(g.angle);
  return [c, s, -s, c, g.x, g.y];
}
export function glyphBox(g: Glyph): Rect { return g.box ?? { x: 0, y: -g.size * 0.85, w: g.w, h: g.size * 1.1 }; }
export function glyphCorners(g: Glyph): Pt[] { const m = glyphMat(g); return rectCorners(glyphBox(g)).map((p) => apply(m, p.x, p.y)); }
export function glyphCenter(g: Glyph): Pt { const b = glyphBox(g); return apply(glyphMat(g), b.x + b.w / 2, b.y + b.h / 2); }

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export interface PathSpan { sp: SubPath; total: number; s0: number; s1: number; flip: boolean }
export function pathSpan(n: TextNode): PathSpan | null {
  const sp0 = n.path?.[0];
  if (!sp0 || sp0.pts.length < 2) return null;
  const flip = !!n.pathFlip, rev = flip ? reversePath([sp0])[0] : sp0;
  const sp = flip && sp0.closed ? { ...rev, pts: [rev.pts[rev.pts.length - 1], ...rev.pts.slice(0, -1)] } : rev;
  const total = pathLength(sp), a = clamp01(n.pathStart ?? 0), b = clamp01(n.pathEnd ?? 1);
  let lo = flip ? 1 - b : a, hi = flip ? 1 - a : b;
  if (hi < lo) { if (sp.closed) hi += 1; else [lo, hi] = [hi, lo]; }
  return { sp, total, s0: lo * total, s1: hi * total, flip };
}
export function spanPoint(ps: PathSpan, len: number): { p: Pt; tangent: Pt } {
  const { sp, total } = ps;
  return pointAtLength(sp, sp.closed && total > 0 ? ((len % total) + total) % total : Math.max(0, Math.min(total, len)));
}
export function pathParamAt(n: TextNode, p: Pt): { u: number; d: number; side: number } | null {
  const sp = n.path?.[0];
  if (!sp || sp.pts.length < 2) return null;
  const segs = segments(sp), total = pathLength(sp);
  let best: { u: number; d: number; side: number } | null = null, acc = 0;
  for (const s of segs) {
    const r = nearestOnSeg(s, p), l = segLength(s);
    if (!best || r.d < best.d) {
      const at = pointAtLength(sp, acc + segLength(s, 0, r.t)), side = at.tangent.x * (p.y - r.pt.y) - at.tangent.y * (p.x - r.pt.x);
      best = { u: total > 0 ? (acc + segLength(s, 0, r.t)) / total : 0, d: r.d, side: Math.sign(side) };
    }
    acc += l;
  }
  return best;
}

function layoutOnPath(n: TextNode): TextLayout {
  const vertical = !!n.vertical, all = items(n.spans, vertical).filter((x) => x.ch !== '\n' && x.ch !== '\r');
  const glyphs: Glyph[] = [], text = all.map((x) => x.ch).join('');
  const ps = pathSpan(n);
  if (!ps) return { lines: [], glyphs, bounds: { x: 0, y: 0, w: 0, h: 0 }, overflow: -1, text, vertical };
  const { sp, total, s0, s1 } = ps;
  const widths = all.map((x, k) => (vertical ? vAdvance(x, all[k + 1]) : advance(x, all[k + 1]))), textW = widths.reduce((a, c) => a + c, 0);
  const al = n.para.align;
  let s = al === 'center' || al === 'justify_center' ? s0 + (s1 - s0 - textW) / 2 : al === 'right' || al === 'justify_right' ? s1 - textW : s0;
  s = Math.max(s0, s);
  const eff = n.pathEffect ?? 'rainbow', spacing = n.pathSpacing ?? 0, align = n.pathAlign ?? 'baseline';
  const pb = pathBounds([sp]), centre = { x: pb.x + pb.w / 2, y: pb.y + pb.h / 2 };
  let overflow = -1, b = emptyRect();
  for (let k = 0; k < all.length; k++) {
    const it = all[k], w = widths[k], mid = s + w / 2;
    if (mid > s1 + 1e-6 || (!sp.closed && mid > total + 1e-6) || (sp.closed && mid - s0 > total + 1e-6)) { overflow = it.index; break; }
    const { p, tangent: t } = spanPoint(ps, mid), nrm = { x: -t.y, y: t.x };
    let U: Pt, V: Pt;
    switch (eff) {
      case 'skew': U = t; V = { x: 0, y: nrm.y < 0 ? -1 : 1 }; break;
      case 'ribbon': U = { x: t.x, y: 0 }; V = nrm; break;
      case 'stair': U = { x: 1, y: 0 }; V = { x: 0, y: 1 }; break;
      case 'gravity': { const dx = centre.x - p.x, dy = centre.y - p.y, l = Math.hypot(dx, dy); V = l > 1e-6 ? { x: dx / l, y: dy / l } : nrm; U = { x: V.y, y: -V.x }; break; }
      default: U = t; V = nrm;
    }
    const size = effSize(it.st), m = metrics(it.st, size), shift = effShift(it.st);
    const P = eff === 'stair' ? spanPoint(ps, s).p : { x: p.x - U.x * (w / 2), y: p.y - U.y * (w / 2) };
    let g: Glyph;
    if (vertical && it.up) {
      const hw = uprightWidth(it), A = (it.vadv ?? 1) * size * (it.st.vscale / 100), org = (it.vorg ?? EM_ORG) * size * (it.st.vscale / 100);
      const O = { x: p.x + V.x * (hw / 2) + U.x * (org - A / 2), y: p.y + V.y * (hw / 2) + U.y * (org - A / 2) };
      g = { ch: it.ch, x: O.x, y: O.y, w: hw, size, style: it.st, index: it.index, gid: it.gid, angle: Math.atan2(-V.y, -V.x), m: [-V.x, -V.y, U.x, U.y], up: true, box: { x: hw / 2 - size / 2, y: -org, w: size, h: w } };
    } else {
      const off = vertical || align === 'center' ? (m.ascent - m.descent) / 2 : align === 'ascender' ? m.ascent : align === 'descender' ? -m.descent : 0;
      const O = { x: P.x + V.x * (off + shift), y: P.y + V.y * (off + shift) };
      g = { ch: it.ch, x: O.x, y: O.y, w, size, style: it.st, index: it.index, gid: it.gid, angle: Math.atan2(U.y, U.x), m: [U.x, U.y, V.x, V.y] };
    }
    glyphs.push(g);
    for (const c of glyphCorners(g)) b = unionRect(b, { x: c.x, y: c.y, w: 0, h: 0 });
    let tighten = 0;
    if (spacing > 0) {
      const ta = spanPoint(ps, s).tangent, tb = spanPoint(ps, s + w).tangent, cr = ta.x * tb.y - ta.y * tb.x;
      if (cr > 0) tighten = Math.min(spacing, 0.5 * size * Math.abs(Math.atan2(cr, ta.x * tb.x + ta.y * tb.y)), w * 0.75);
    }
    s += w - tighten;
  }
  return { lines: [], glyphs, bounds: glyphs.length ? b : (() => { const q = spanPoint(ps, s0).p; return { x: q.x, y: q.y, w: 0, h: 0 }; })(), overflow, text, vertical };
}

export function textBounds(n: TextNode): Rect {
  const l = layoutText(n);
  if (n.mode === 'path') return l.bounds;
  if (n.mode === 'area' && n.framePath) return transformRect(l.bounds, n.xf);
  return transformRect(l.bounds, n.xf);
}

export function textOutline(n: TextNode): PathData | null {
  if (!shaping) return null;
  const out: PathData = [];
  for (const g of layoutText(n).glyphs) {
    if (!g.ch.trim()) continue;
    const st = g.style, gid = g.gid ?? shaping.shape(st, g.ch, [])?.[0]?.gid, d = gid === undefined ? null : shaping.outline(st, gid);
    if (!d) return null;
    const sx = (g.size * st.hscale) / 100, sy = (g.size * st.vscale) / 100;
    const m: Mat = mul(glyphMat(g), [sx, 0, 0, sy, 0, 0]);
    out.push(...transformPath(d, n.mode === 'path' ? m : mul(n.xf, m)).map((sp) => ({ ...sp, closed: true })));
  }
  return out;
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
    if (g.m) ctx.transform(g.m[0], g.m[1], g.m[2], g.m[3], 0, 0);
    else if (g.angle) ctx.rotate(g.angle);
    if (g.up && (st.underline || st.strike)) {
      const bx = glyphBox(g), t = Math.max(0.5, g.size * 0.06);
      ctx.fillStyle = paintStyle(st.fill, b) ?? '#000';
      if (st.underline) ctx.fillRect(bx.x + bx.w - t, bx.y, t, bx.h);
      if (st.strike) ctx.fillRect(bx.x + bx.w / 2 - t / 2, bx.y, t, bx.h);
    }
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
    if (!g.up && (st.underline || st.strike)) {
      ctx.fillStyle = fillStyle ?? '#000';
      const t = Math.max(0.5, g.size * 0.06);
      if (st.underline) ctx.fillRect(0, g.size * 0.12, g.w, t);
      if (st.strike) ctx.fillRect(0, -g.size * 0.3, g.w, t);
    }
    ctx.restore();
  }
  ctx.restore();
}

const caretFrom = (a: Pt, d: Pt): { x: number; y: number; h: number; angle: number } => { const h = Math.hypot(d.x, d.y) || 1; return { x: a.x, y: a.y, h, angle: Math.atan2(-d.x / h, d.y / h) }; };
const gu = (g: Glyph): number => g.iu ?? g.x;
const ga = (g: Glyph): number => g.ia ?? g.w;

export function caretAt(n: TextNode, index: number): { x: number; y: number; h: number; angle: number } {
  const lay = layoutText(n), xf = n.xf;
  if (n.mode === 'path') {
    let g = lay.glyphs.find((x) => x.index >= index), end = false;
    if (!g) { g = lay.glyphs[lay.glyphs.length - 1]; end = true; }
    if (!g) {
      const ps = pathSpan(n), size = n.spans[0]?.style.size ?? 12;
      if (!ps) return { x: 0, y: 0, h: size, angle: 0 };
      const { p, tangent: t } = spanPoint(ps, ps.s0);
      return caretFrom({ x: p.x + t.y * size * 0.85, y: p.y - t.x * size * 0.85 }, { x: -t.y * size * 1.1, y: t.x * size * 1.1 });
    }
    const m = glyphMat(g), bx = glyphBox(g);
    if (g.up) { const y = end ? bx.y + bx.h : bx.y, a = apply(m, bx.x + bx.w, y), z = apply(m, bx.x, y); return caretFrom(a, { x: z.x - a.x, y: z.y - a.y }); }
    const x = end ? bx.x + bx.w : bx.x, a = apply(m, x, bx.y), z = apply(m, x, bx.y + bx.h);
    return caretFrom(a, { x: z.x - a.x, y: z.y - a.y });
  }
  const local = (q: Pt): Pt => absPt(lay.vertical, q);
  const at = (u: number, l: Line): { x: number; y: number; h: number; angle: number } => {
    const a = local({ x: u, y: l.y - l.ascent }), z = local({ x: u, y: l.y + l.descent });
    const A = apply(xf, a.x, a.y), Z = apply(xf, z.x, z.y);
    return caretFrom(A, { x: Z.x - A.x, y: Z.y - A.y });
  };
  for (const l of lay.lines) {
    if (index >= l.start && index <= l.end) {
      let u = l.x;
      for (const g of l.glyphs) { if (g.index >= index) break; u = gu(g) + ga(g); }
      return at(u, l);
    }
  }
  const last = lay.lines[lay.lines.length - 1];
  return last ? at(last.x + last.width, last) : { x: xf[4], y: xf[5], h: 12, angle: 0 };
}

export function indexAt(n: TextNode, local: Pt): number {
  const lay = layoutText(n);
  if (!lay.lines.length) {
    let best = 0, bd = Infinity;
    for (const g of lay.glyphs) {
      const c = glyphCenter(g), d = Math.hypot(c.x - local.x, c.y - local.y);
      if (d >= bd) continue;
      bd = d;
      const q = apply(invert(glyphMat(g)), local.x, local.y), bx = glyphBox(g);
      best = (g.up ? q.y > bx.y + bx.h / 2 : q.x > bx.x + bx.w / 2) ? g.index + g.ch.length : g.index;
    }
    return best;
  }
  const q = toAbs(lay.vertical, local);
  let line = lay.lines[0], ld = Infinity;
  for (const l of lay.lines) {
    const x0 = Math.min(l.x, l.x + l.width), x1 = Math.max(l.x, l.x + l.width), y0 = l.y - l.ascent, y1 = l.y + l.descent;
    const d = Math.hypot(q.x < x0 ? x0 - q.x : q.x > x1 ? q.x - x1 : 0, q.y < y0 ? y0 - q.y : q.y > y1 ? q.y - y1 : 0) * 4 + Math.abs(q.y - (y0 + y1) / 2) * 0.01;
    if (d < ld) { ld = d; line = l; }
  }
  for (const g of line.glyphs) if (q.x < gu(g) + ga(g) / 2) return g.index;
  return line.end;
}

export function stepLine(n: TextNode, caret: number, dir: 1 | -1): number {
  const lay = layoutText(n), li = lay.lines.findIndex((l) => caret >= l.start && caret <= l.end);
  if (li < 0) return caret;
  const target = lay.lines[li + dir];
  if (!target) return dir < 0 ? 0 : plainText(n).length;
  const l = lay.lines[li];
  let u = l.x;
  for (const g of l.glyphs) { if (g.index >= caret) break; u = gu(g) + ga(g); }
  for (const g of target.glyphs) if (u < gu(g) + ga(g) / 2) return g.index;
  return target.end;
}

export function selectionQuads(n: TextNode, a: number, b: number): Pt[][] {
  const lay = layoutText(n), out: Pt[][] = [];
  if (n.mode === 'path') { for (const g of lay.glyphs) if (g.index >= a && g.index < b) out.push(glyphCorners(g)); return out; }
  for (const l of lay.lines) for (const g of l.glyphs) {
    if (g.index < a || g.index >= b) continue;
    out.push(rectCorners(absRect(lay.vertical, { x: gu(g), y: l.y - l.ascent, w: ga(g), h: l.ascent + l.descent })).map((p) => apply(n.xf, p.x, p.y)));
  }
  return out;
}

export function pathBrackets(n: TextNode): { start: { p: Pt; t: Pt }; end: { p: Pt; t: Pt }; centre: { p: Pt; t: Pt } } | null {
  const ps = pathSpan(n);
  if (!ps) return null;
  const a = spanPoint(ps, ps.s0), z = spanPoint(ps, ps.s1), c = spanPoint(ps, (ps.s0 + ps.s1) / 2);
  return ps.flip ? { start: { p: z.p, t: z.tangent }, end: { p: a.p, t: a.tangent }, centre: { p: c.p, t: c.tangent } } : { start: { p: a.p, t: a.tangent }, end: { p: z.p, t: z.tangent }, centre: { p: c.p, t: c.tangent } };
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
