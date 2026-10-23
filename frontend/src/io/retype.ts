import type { Font, PathCommand } from 'opentype.js';
import { geomBounds } from '../engine/bounds';
import { childrenOf, newId } from '../engine/doc';
import { pathBounds, tracePath } from '../engine/geometry';
import { firstFill, resolvePaint, rgb, solid } from '../engine/paint';
import { DEFAULT_CHAR, DEFAULT_PARA } from '../engine/text';
import type { Color, Doc, Project, Rect, SubPath, TextNode, VNode } from '../engine';
import type { FontInfo } from './api';
import { BUNDLED_FAMILIES, fontFor, systemFonts } from './fonts';
import { renderRegion } from './raster';

const N = 32, LINE_H = 48;
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&?!.,-';

interface Glyph { mask: Uint8Array; w: number; h: number; top: number; x0: number; x1: number; line: number }
export interface RetypeSource { kind: 'outlines' | 'image'; ids: string[]; box: Rect; glyphs: Glyph[]; lines: number[][]; lineMask: { w: number; h: number; d: Uint8Array; box: Rect; line: number }; ref: number; color: Color; png: string; pitch: number }
export interface FontMatch { family: string; style: string; score: number; text: string }

const canvas = (w: number, h: number): CanvasRenderingContext2D => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D; };
const inkOf = (g: CanvasRenderingContext2D): Uint8Array => { const { width: w, height: h } = g.canvas, d = g.getImageData(0, 0, w, h).data, out = new Uint8Array(w * h); for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] >= 128 ? 1 : 0; return out; };

function iou(a: Uint8Array, b: Uint8Array): number { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { const x = a[k], y = b[k]; if (x | y) { u++; if (x & y) i++; } } return u ? i / u : 0; }

function blur(m: Uint8Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) { s += m[Y * w + X]; n++; } } out[y * w + x] = s / n; }
  return out;
}
function softIou(a: Uint8Array, b: Uint8Array, w: number, h: number): number { const A = blur(a, w, h), B = blur(b, w, h); let i = 0, u = 0; for (let k = 0; k < A.length; k++) { i += Math.min(A[k], B[k]); u += Math.max(A[k], B[k]); } return u ? i / u : 0; }

function fitMask(draw: (g: CanvasRenderingContext2D) => void, box: Rect, size = N): Uint8Array {
  const g = canvas(size, size), s = (size - 4) / Math.max(box.w, box.h, 1e-6);
  g.setTransform(s, 0, 0, s, (size - box.w * s) / 2 - box.x * s, (size - box.h * s) / 2 - box.y * s);
  g.fillStyle = '#000';
  draw(g);
  return inkOf(g);
}

function stretchMask(draw: (g: CanvasRenderingContext2D) => void, box: Rect, w: number, h: number): Uint8Array {
  const g = canvas(w, h);
  g.setTransform(w / Math.max(box.w, 1e-6), 0, 0, h / Math.max(box.h, 1e-6), -box.x * (w / Math.max(box.w, 1e-6)), -box.y * (h / Math.max(box.h, 1e-6)));
  g.fillStyle = '#000';
  draw(g);
  return inkOf(g);
}

function unionFind(n: number): { find: (i: number) => number; join: (a: number, b: number) => void } {
  const p = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => { while (p[i] !== i) { p[i] = p[p[i]]; i = p[i]; } return i; };
  return { find, join: (a, b) => { const x = find(a), y = find(b); if (x !== y) p[y] = x; } };
}

function group(boxes: Rect[]): { glyphs: number[][]; lines: number[][] } {
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[a].y + boxes[a].h / 2 - (boxes[b].y + boxes[b].h / 2));
  const lines: number[][] = [], spans: Array<[number, number]> = [];
  for (const i of order) {
    const b = boxes[i];
    let at = -1;
    spans.forEach(([y0, y1], k) => { const ov = Math.min(y1, b.y + b.h) - Math.max(y0, b.y); if (ov > 0.35 * Math.min(b.h, y1 - y0) || (b.y >= y0 && b.y + b.h <= y1)) at = k; });
    if (at < 0) { lines.push([i]); spans.push([b.y, b.y + b.h]); }
    else { lines[at].push(i); spans[at] = [Math.min(spans[at][0], b.y), Math.max(spans[at][1], b.y + b.h)]; }
  }
  const glyphs: number[][] = [];
  const outLines: number[][] = [];
  lines.map((l, k) => ({ l, y: spans[k][0] })).sort((a, b) => a.y - b.y).forEach(({ l }) => {
    const uf = unionFind(l.length);
    for (let a = 0; a < l.length; a++) for (let c = a + 1; c < l.length; c++) {
      const A = boxes[l[a]], B = boxes[l[c]], ov = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
      if (ov > 0.5 * Math.min(A.w, B.w)) uf.join(a, c);
    }
    const sets = new Map<number, number[]>();
    l.forEach((idx, a) => { const r = uf.find(a); sets.set(r, [...(sets.get(r) ?? []), idx]); });
    const gs = [...sets.values()].sort((a, b) => Math.min(...a.map((i) => boxes[i].x)) - Math.min(...b.map((i) => boxes[i].x)));
    outLines.push(gs.map((_, k) => glyphs.length + k));
    glyphs.push(...gs);
  });
  return { glyphs, lines: outLines };
}

const unionBox = (bs: Rect[]): Rect => { const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y)), x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h)); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };

function finish(kind: RetypeSource['kind'], ids: string[], boxes: Rect[], draw: (gi: number[], g: CanvasRenderingContext2D) => void, color: Color, png: string): RetypeSource {
  const { glyphs: sets, lines } = group(boxes);
  if (!sets.length) throw new Error('Font Match found no letter shapes there.');
  const gb = sets.map((s) => unionBox(s.map((i) => boxes[i])));
  const heights = gb.map((b) => b.h).sort((a, b) => b - a), ref = heights[Math.floor(heights.length * 0.25)] || heights[0];
  const glyphs: Glyph[] = sets.map((s, k) => {
    const b = gb[k], line = lines.findIndex((l) => l.includes(k));
    const lineTop = Math.min(...lines[line].map((j) => gb[j]).filter((x) => x.h >= 0.8 * ref).map((x) => x.y).concat([b.y]));
    return { mask: fitMask((g) => draw(s, g), b), w: b.w, h: b.h, top: (b.y - lineTop) / ref, x0: b.x, x1: b.x + b.w, line };
  });
  const li = lines.reduce((best, l, k) => (l.length > lines[best].length ? k : best), 0);
  const lb = unionBox(lines[li].map((k) => gb[k])), lw = Math.max(8, Math.min(1200, Math.round((LINE_H * lb.w) / Math.max(lb.h, 1e-6))));
  const all = lines[li].flatMap((k) => sets[k]);
  const lineMask = { w: lw, h: LINE_H, d: stretchMask((g) => draw(all, g), lb, lw, LINE_H), box: lb, line: li };
  const tops = lines.map((l) => Math.min(...l.map((k) => gb[k].y)));
  const pitch = tops.length > 1 ? (tops[tops.length - 1] - tops[0]) / (tops.length - 1) : 0;
  return { kind, ids, box: unionBox(gb), glyphs, lines, lineMask, ref, color, png, pitch };
}

function subpathsOf(n: VNode, out: Array<{ sp: SubPath; color: Color | null }>, inherited: Color | null): void {
  const f = firstFill(n.ap), c = f && f.paint.type === 'color' ? f.paint.color : inherited;
  if (n.kind === 'path') { for (const sp of n.d) out.push({ sp, color: c }); return; }
  if (n.kind === 'compound') { for (const ch of n.children) for (const sp of ch.d) out.push({ sp, color: c }); return; }
  for (const ch of childrenOf(n) ?? []) subpathsOf(ch, out, c);
}

export async function sourceFromOutlines(p: Project, nodes: VNode[]): Promise<RetypeSource> {
  const parts: Array<{ sp: SubPath; color: Color | null }> = [];
  for (const n of nodes) subpathsOf(n, parts, null);
  const subs = parts.filter((x) => x.sp.pts.length > 1);
  if (!subs.length) throw new Error('Select outlined type (paths or compound paths of letters), or a placed image.');
  const boxes = subs.map((x) => pathBounds([x.sp]));
  const draw = (idx: number[], g: CanvasRenderingContext2D): void => { const path = new Path2D(); for (const i of idx) tracePath(path, [subs[i].sp]); g.fill(path, 'nonzero'); };
  const all = unionBox(boxes), color = subs.find((x) => x.color)?.color ?? rgb(0, 0, 0);
  const png = await previewPng(p, nodes, all);
  return finish('outlines', nodes.map((n) => n.id), boxes, draw, resolveColor(p.doc, color), png);
}

const resolveColor = (doc: Doc, c: Color): Color => { const r = resolvePaint(doc, solid(c)); return r.type === 'color' ? r.color : c; };

async function previewPng(p: Project, nodes: VNode[], box: Rect): Promise<string> {
  const pad = Math.max(2, box.h * 0.15), r = { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad };
  const c = await renderRegion(p, { region: r, scale: Math.min(4, 160 / Math.max(1, r.h)), transparent: false, only: nodes });
  return c.toDataURL('image/png');
}

export async function sourceFromImage(p: Project, img: VNode, region: Rect | null): Promise<RetypeSource> {
  const r = region ?? geomBounds(p.doc, img);
  const scale = Math.max(0.5, Math.min(8, 400 / Math.max(1, r.h), 2400 / Math.max(1, r.w)));
  const c = await renderRegion(p, { region: r, scale, transparent: false, only: [img] });
  const W = c.width, H = c.height, px = (c.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, W, H).data;
  const lum = new Uint8Array(W * H), hist = new Array<number>(256).fill(0);
  for (let i = 0; i < W * H; i++) { const v = Math.round(0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]); lum[i] = v; hist[v]++; }
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sB = 0, wB = 0, best = 0, th = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = W * H - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = t; } }
  let edgeDark = 0, edges = 0;
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { edges++; if (lum[y * W + x] <= th) edgeDark++; }
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { edges++; if (lum[y * W + x] <= th) edgeDark++; }
  const darkInk = edgeDark < edges / 2;
  const ink = new Uint8Array(W * H);
  for (let i = 0; i < ink.length; i++) ink[i] = (darkInk ? lum[i] <= th : lum[i] > th) ? 1 : 0;
  const label = new Int32Array(W * H).fill(-1), comps: Array<{ box: Rect; px: number[] }> = [];
  for (let i = 0; i < ink.length; i++) {
    if (!ink[i] || label[i] >= 0) continue;
    const id = comps.length, stack = [i], pts: number[] = [];
    label[i] = id;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    while (stack.length) {
      const k = stack.pop() as number, x = k % W, y = (k - x) / W;
      pts.push(k); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const n of [k - 1, k + 1, k - W, k + W]) { if (n < 0 || n >= ink.length || (n === k - 1 && x === 0) || (n === k + 1 && x === W - 1)) continue; if (ink[n] && label[n] < 0) { label[n] = id; stack.push(n); } }
      if (pts.length > W * H * 0.5) break;
    }
    comps.push({ box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, px: pts });
  }
  const keep = comps.filter((q) => q.px.length >= Math.max(4, W * H * 0.00005) && q.box.w < W * 0.9 && q.box.h < H * 0.95);
  if (!keep.length) throw new Error('Font Match found no letters in that part of the image.');
  const toDoc = (b: Rect): Rect => ({ x: r.x + b.x / scale, y: r.y + b.y / scale, w: b.w / scale, h: b.h / scale });
  let cr = 0, cg = 0, cb = 0, cn = 0;
  for (const q of keep) for (const k of q.px) { cr += px[k * 4]; cg += px[k * 4 + 1]; cb += px[k * 4 + 2]; cn++; }
  const color = rgb(Math.round(cr / cn), Math.round(cg / cn), Math.round(cb / cn));
  const draw = (idx: number[], g: CanvasRenderingContext2D): void => {
    const t = g.getTransform();
    g.save();
    for (const i of idx) for (const k of keep[i].px) { const x = k % W, y = (k - x) / W, d = toDoc({ x, y, w: 1, h: 1 }); g.setTransform(t); g.fillRect(d.x, d.y, d.w + 0.5 / scale, d.h + 0.5 / scale); }
    g.restore();
  };
  return finish('image', [img.id], keep.map((q) => toDoc(q.box)), draw, color, c.toDataURL('image/png'));
}

function plainPath(font: Font, text: string, size: number): PathCommand[] {
  const out: PathCommand[] = [], k = size / (font.unitsPerEm || 1000);
  let x = 0, prev: ReturnType<Font['charToGlyph']> | null = null;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    if (prev) { try { x += font.getKerningValue(prev, g) * k; } catch { x += 0; } }
    out.push(...g.getPath(x, 0, size).commands);
    x += (g.advanceWidth ?? 0) * k;
    prev = g;
  }
  return out;
}

function sampleBox(cmds: PathCommand[]): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, cx = 0, cy = 0;
  const add = (x: number, y: number): void => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  for (const c of cmds) {
    if (c.type === 'M' || c.type === 'L') { cx = c.x ?? 0; cy = c.y ?? 0; add(cx, cy); }
    else if (c.type === 'C' || c.type === 'Q') {
      const x = c.x ?? 0, y = c.y ?? 0;
      for (let t = 0.1; t <= 1.0001; t += 0.1) {
        const u = 1 - t;
        if (c.type === 'Q') add(u * u * cx + 2 * u * t * (c.x1 ?? 0) + t * t * x, u * u * cy + 2 * u * t * (c.y1 ?? 0) + t * t * y);
        else add(u * u * u * cx + 3 * u * u * t * (c.x1 ?? 0) + 3 * u * t * t * (c.x2 ?? 0) + t * t * t * x, u * u * u * cy + 3 * u * u * t * (c.y1 ?? 0) + 3 * u * t * t * (c.y2 ?? 0) + t * t * t * y);
      }
      cx = x; cy = y;
    }
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 };
}

function drawCmds(cmds: PathCommand[]): (g: CanvasRenderingContext2D) => void {
  return (g) => {
    const p = new Path2D();
    for (const c of cmds) {
      if (c.type === 'M') p.moveTo(c.x ?? 0, c.y ?? 0); else if (c.type === 'L') p.lineTo(c.x ?? 0, c.y ?? 0);
      else if (c.type === 'C') p.bezierCurveTo(c.x1 ?? 0, c.y1 ?? 0, c.x2 ?? 0, c.y2 ?? 0, c.x ?? 0, c.y ?? 0);
      else if (c.type === 'Q') p.quadraticCurveTo(c.x1 ?? 0, c.y1 ?? 0, c.x ?? 0, c.y ?? 0);
      else if (c.type === 'Z') p.closePath();
    }
    g.fill(p, 'nonzero');
  };
}

interface FontGlyphs { capTop: number; cap: number; chars: Array<{ ch: string; mask: Uint8Array; h: number; top: number; asp: number }> }
const glyphCache = new WeakMap<Font, FontGlyphs>();
function fontGlyphs(font: Font): FontGlyphs {
  const hit = glyphCache.get(font);
  if (hit) return hit;
  const H = sampleBox(plainPath(font, 'H', 100)), cap = Math.max(1, H.h);
  const chars = [];
  for (const ch of CHARSET) {
    if (font.charToGlyph(ch).index === 0) continue;
    const cmds = plainPath(font, ch, 100), b = sampleBox(cmds);
    if (b.w <= 0 || b.h <= 0) continue;
    chars.push({ ch, mask: fitMask(drawCmds(cmds), b), h: b.h / cap, top: (b.y - H.y) / cap, asp: b.w / b.h });
  }
  const out = { capTop: H.y, cap, chars };
  glyphCache.set(font, out);
  return out;
}

function readGlyphs(src: RetypeSource, font: Font): { score: number; chars: string[] } {
  const fg = fontGlyphs(font);
  if (!fg.chars.length) return { score: 0, chars: [] };
  let total = 0;
  const chars = src.glyphs.map((g) => {
    const relH = g.h / src.ref, asp = g.w / Math.max(g.h, 1e-6);
    let best = -Infinity, pick = '?';
    for (const c of fg.chars) {
      const s = iou(g.mask, c.mask) - 0.6 * Math.abs(relH - c.h) - 0.4 * Math.abs(g.top - c.top) - 0.15 * Math.abs(Math.log(Math.max(0.05, asp) / Math.max(0.05, c.asp)));
      if (s > best) { best = s; pick = c.ch; }
    }
    total += best;
    return pick;
  });
  return { score: total / src.glyphs.length, chars };
}

function textOfLines(src: RetypeSource, chars: string[]): string {
  return src.lines.map((l) => l.map((k, j) => { const g = src.glyphs[k], prev = j ? src.glyphs[l[j - 1]] : null; return (prev && g.x0 - prev.x1 > 0.32 * src.ref ? ' ' : '') + chars[k]; }).join('')).join('\n');
}

function wordScore(src: RetypeSource, font: Font, line: string): number {
  if (!line.trim()) return 0;
  const cmds = plainPath(font, line, 100), b = sampleBox(cmds);
  if (b.w <= 0 || b.h <= 0) return 0;
  const m = src.lineMask, cand = stretchMask(drawCmds(cmds), b, m.w, m.h);
  const asp = (b.w / b.h) / (m.box.w / Math.max(m.box.h, 1e-6));
  return softIou(m.d, cand, m.w, m.h) * Math.exp(-1.5 * Math.abs(Math.log(Math.max(0.05, asp))));
}

const SKIP = /CJK|Emoji|Unifont|Symbol|Math|Fallback|Dingbat|OpenSymbol|Wingding|Webdings|Noto Sans Mono CJK/i;
export async function candidateFaces(limit = 600): Promise<Array<{ family: string; style: string }>> {
  const sys = (await systemFonts()).filter((f: FontInfo) => !SKIP.test(f.family));
  const out: Array<{ family: string; style: string }> = [];
  for (const fam of BUNDLED_FAMILIES) if (!sys.some((f) => f.family === fam)) for (const st of ['Regular', 'Bold', 'Light', 'Italic', 'Bold Italic']) out.push({ family: fam, style: st });
  const seen = new Set(out.map((x) => `${x.family}|${x.style}`));
  for (const f of sys) { const k = `${f.family}|${f.style}`; if (!seen.has(k)) { seen.add(k); out.push({ family: f.family, style: f.style }); } }
  return out.slice(0, limit);
}

const STYLE_WORDS: Array<[RegExp, RegExp]> = [[/bold|heavy|black/i, /bold|black|heavy|extra/i], [/italic|oblique|slanted/i, /italic|oblique|slant/i], [/light|thin/i, /light|thin/i], [/condensed|narrow/i, /cond|narrow/i]];

export async function rankFonts(src: RetypeSource, known: { text: string; description: string } | null, progress: (done: number, total: number) => void, signal?: AbortSignal): Promise<{ text: string; matches: FontMatch[] }> {
  const faces = await candidateFaces();
  const fams = new Map<string, Array<{ family: string; style: string }>>();
  for (const f of faces) fams.set(f.family, [...(fams.get(f.family) ?? []), f]);
  const reps = [...fams.values()].map((list) => list.find((f) => /^(regular|roman|book|normal|medium)$/i.test(f.style)) ?? list[0]);
  const stop = (): void => { if (signal?.aborted) throw new DOMException('Stopped', 'AbortError'); };
  const yieldNow = (): Promise<void> => new Promise((ok) => setTimeout(ok, 0));
  const reads = new Map<string, { score: number; chars: string[] }>(), scores = new Map<string, FontMatch>();
  const desc = known?.description ?? '';
  let text = known?.text?.trim() ?? '', line = '';
  const load = async (list: Array<{ family: string; style: string }>, from: number, total: number): Promise<Array<{ family: string; style: string; font: Font }>> => {
    const out: Array<{ family: string; style: string; font: Font }> = [];
    for (let i = 0; i < list.length; i++) { stop(); const f = await fontFor(list[i].family, list[i].style); if (f) out.push({ ...list[i], font: f }); if (i % 4 === 0) { progress(from + i, total); await yieldNow(); } }
    return out;
  };
  const score = async (list: Array<{ family: string; style: string; font: Font }>): Promise<void> => {
    for (let i = 0; i < list.length; i++) {
      stop();
      const L = list[i], key = `${L.family}|${L.style}`;
      if (!reads.has(key) && !known?.text?.trim()) { try { reads.set(key, readGlyphs(src, L.font)); } catch { reads.delete(key); } }
      let w = 0;
      try { w = wordScore(src, L.font, line); } catch { continue; }
      const r = reads.get(key);
      let s = r ? 0.65 * w + 0.35 * Math.max(0, r.score) : w;
      for (const [d, t] of STYLE_WORDS) if (d.test(desc)) s += t.test(L.style) ? 0.04 : -0.02;
      if (desc && desc.toLowerCase().includes(L.family.toLowerCase())) s += 0.08;
      scores.set(key, { family: L.family, style: L.style, score: Math.max(0, Math.min(1, s)), text });
      if (i % 8 === 0) await yieldNow();
    }
  };
  const extra = Math.min(60, faces.length - reps.length), total = reps.length + extra + 1;
  const first = await load(reps, 0, total);
  if (!first.length) throw new Error('No installed fonts could be read for comparison.');
  if (!text) {
    for (let i = 0; i < first.length; i++) { stop(); const key = `${first[i].family}|${first[i].style}`; try { reads.set(key, readGlyphs(src, first[i].font)); } catch { reads.delete(key); } if (i % 6 === 0) await yieldNow(); }
    const top = [...reads.values()].sort((a, b) => b.score - a.score).slice(0, 7);
    const votes = src.glyphs.map((_, k) => { const tally = new Map<string, number>(); top.forEach((r, j) => tally.set(r.chars[k], (tally.get(r.chars[k]) ?? 0) + (7 - j) * r.score)); return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '?'; });
    text = textOfLines(src, votes);
  }
  const lines = text.split('\n');
  line = lines[Math.min(src.lineMask.line, lines.length - 1)] ?? lines[0];
  await score(first);
  const best = [...scores.values()].sort((a, b) => b.score - a.score).slice(0, 10).map((m) => m.family);
  const more = best.flatMap((fam) => (fams.get(fam) ?? []).filter((f) => !scores.has(`${f.family}|${f.style}`)).slice(0, 8)).slice(0, extra);
  await score(await load(more, reps.length, total));
  progress(1, 1);
  return { text, matches: [...scores.values()].map((m) => ({ ...m, text })).sort((a, b) => b.score - a.score).slice(0, 10) };
}

export async function retypeNode(src: RetypeSource, m: { family: string; style: string }, text: string): Promise<TextNode> {
  const font = await fontFor(m.family, m.style);
  const lines = text.split('\n'), li = Math.min(src.lineMask.line, lines.length - 1), line = lines[li] ?? lines[0];
  const lb = src.lineMask.box;
  let size = Math.max(4, lb.h / 0.72), x = lb.x, base = lb.y + lb.h, tracking = 0;
  if (font) {
    const b = sampleBox(plainPath(font, line, 100));
    if (b.h > 0) {
      size = (lb.h / b.h) * 100;
      x = lb.x - (b.x * size) / 100;
      base = lb.y - (b.y * size) / 100;
      const n = Math.max(1, [...line].length - 1), extra = lb.w - (b.w * size) / 100;
      tracking = Math.max(-200, Math.min(400, Math.round(((extra / n) / size) * 1000)));
    }
  }
  const leading = src.pitch > 0 ? src.pitch : null;
  const firstBase = base - (leading ?? size * 1.2) * li;
  return { id: newId('t'), kind: 'text', mode: 'point', name: line.slice(0, 40), spans: [{ text, style: { ...DEFAULT_CHAR, font: m.family, style: m.style, size, tracking, leading, fill: solid(src.color) } }], para: { ...DEFAULT_PARA }, xf: [1, 0, 0, 1, x, firstBase], opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
}

export async function recognize(src: RetypeSource, ask: (prompt: string, image: string) => Promise<string>): Promise<{ text: string; description: string } | null> {
  const answer = await ask('Read the text in this image exactly as written, keeping capitals and line breaks, then describe its typeface (classification such as serif, sans serif, slab, script or monospace, weight, width, slant, and a likely font family if you know one). Answer only with JSON: {"text": "...", "font": "..."}', src.png);
  const m = /\{[\s\S]*\}/.exec(answer);
  if (!m) return answer.trim() ? { text: answer.trim().split('\n')[0], description: '' } : null;
  try { const j = JSON.parse(m[0]) as { text?: unknown; font?: unknown }; return typeof j.text === 'string' && j.text.trim() ? { text: j.text.replace(/\r/g, ''), description: typeof j.font === 'string' ? j.font : '' } : null; }
  catch { return null; }
}
