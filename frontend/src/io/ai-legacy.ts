import { makeLayer, newDoc, newId } from '../engine/doc';
import { geomBounds } from '../engine/bounds';
import { anchor, mul, translate } from '../engine/geometry';
import { expandAppearance } from '../engine/ops/expand';
import { transformNode } from '../engine/transform';
import { fill as fillItem, linearGradient, radialGradient, solid, stop, stroke as strokeItem } from '../engine/paint';
import { DEFAULT_CHAR, DEFAULT_PARA } from '../engine/text';
import { zstdDecompress } from './ai-zstd';
import { parseStyles, resolveStyle, type PaintRead, type StyleHost, type StyleResult } from './ai-styles';
import type { Anchor, Appearance, BlendMode, BrushDef, Color, CompoundNode, Doc, GradientStop, ImageNode, LayerNode, Mat, Paint, PathData, PathNode, PatternDef, Span, SubPath, SymbolDef, TextNode, Units, VNode } from '../engine';

export interface AiRead { doc: Doc; assets: Map<string, Blob>; skipped: string[]; unknown: string[]; version: string; kept: string[] }

/** A private-data block the reader keeps instead of skipping: its lines with the %_ prefix removed and plain comments dropped. */
interface Def { kind: 'pattern' | 'symbol' | 'brushart' | 'plugin' | 'styles' | 'stylelist'; block: string; head: string; lines: string[]; raster: boolean }

type Tok = { t: 'n'; v: number } | { t: 's'; v: string } | { t: 'x'; v: string } | { t: 'a'; v: Tok[] } | { t: 'w'; v: string } | { t: 'd'; v: string };

interface GradDef { type: number; stops: GradientStop[] }
interface Meta {
  version: string; bbox: number[] | null; tile: number[] | null; artboards: number[][]; units: Units; cmyk: boolean;
  customs: Map<string, Color>; gradients: Map<string, GradDef>; skipped: Set<string>; pages: number; defs: Def[];
}
interface Ctx { kind: 'layer' | 'group' | 'clip' | 'compound'; nodes: VNode[]; clipper?: VNode; kids: PathNode[]; ap?: Appearance; rule?: 'nonzero' | 'evenodd'; clipped?: boolean; opacity?: number; blend?: BlendMode; styled?: string; sub?: { name: string; hidden: boolean; locked: boolean } }
/** A group the file marked with an art style: Illustrator wrote its expanded look, and the unpainted source art follows. */
interface Held { node: VNode; style: string; parent: Ctx; src: Array<{ ctx: Ctx; d: PathData }>; srcStyle: string }
interface LayerOut { name: string; hidden: boolean; locked: boolean; printable: boolean; color: string; nodes: VNode[] }
interface Gs {
  fill: Paint | null; stroke: Paint | null; lw: number; cap: 'butt' | 'round' | 'square'; join: 'miter' | 'round' | 'bevel'; miter: number; dash: number[]; dashOff: number;
  fillOp: boolean; strokeOp: boolean; rule: 'nonzero' | 'evenodd'; opacity: number; blend: BlendMode;
}
interface GradPending { name: string; x: number; y: number; angle: number; len: number; m: Mat; mSet: boolean }
interface TextRun { name: string; size: number; leading: number | null; tracking: number; baseline: number; hs: number; vs: number }

const BLEND: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'soft_light', 'hard_light', 'color_dodge', 'color_burn', 'darken', 'lighten', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
const UNITS: Units[] = ['in', 'mm', 'pt', 'pc', 'cm', 'pt', 'px'];
const BLOCKS: Record<string, string> = { Pattern: 'patterns', BrushPattern: 'brushes', Brush: 'brushes', Symbol: 'symbols', SymbolList: '', ArtStyles: 'graphic styles', ArtStyleList: '', SVGFilter: 'SVG filters', PluginObject: 'live effects and plug-in objects', Palette: '', DocumentData: '', TextDocument: '', Mesh: 'gradient meshes' };
const KEPT: Record<string, Def['kind']> = { Pattern: 'pattern', Symbol: 'symbol', BrushPattern: 'brushart', PluginObject: 'plugin', ArtStyles: 'styles', ArtStyleList: 'stylelist' };
const SILENT = new Set(['D', ',', ':', ';', 'Np', 'Ap', 'Ar', 'XW', 'Xw', 'XR', 'Xd', 'Bn', 'Bh', 'Bc', 'A', 'Pc', 'Pb', 'Xt', 'XT', 'Xe', 'XE', 'Xp', 'XP', 'Xi', 'XH', 'Ya', 'Yb', 'TC', 'TW', 'Ti', 'Th', 'Tq', 'TV', 'TA', 'Tt', 'Tk', 'Tw', 'Tl', 'Tr', 'Xo', 'XO', 'Xl', 'XL', 'XN', 'Xn', 'Bd', 'BD', 'Br', 'Bs', 'gsave', 'grestore', 'annotatepage', 'showpage', 'save', 'restore', 'get', 'exec']);

export const latin1 = (b: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192) as unknown as number[]);
  return s;
};

export function aiSource(data: ArrayBuffer): string {
  const b = new Uint8Array(data);
  if (b[0] === 0xc5 && b[1] === 0xd0 && b[2] === 0xd3 && b[3] === 0xc6) {
    const dv = new DataView(data), off = dv.getUint32(4, true), len = dv.getUint32(8, true);
    return latin1(b.subarray(off, off + len));
  }
  return latin1(b);
}

export function isLegacyAi(data: ArrayBuffer): boolean {
  const b = new Uint8Array(data);
  const dos = b[0] === 0xc5 && b[1] === 0xd0 && b[2] === 0xd3 && b[3] === 0xc6;
  const head = latin1(b.subarray(0, 1024));
  if (/%PDF-/.test(head)) return false;
  if (!dos && !/^\s*%!PS/.test(head)) return false;
  return !/[\r\n]\d+ \d+ obj[\r\n <]/.test(aiSource(data));
}

function ascii85(s: string): Uint8Array {
  const end = s.indexOf('~>'), t = end >= 0 ? s.slice(0, end) : s, out: number[] = [];
  let grp: number[] = [];
  const flush = (n: number): void => {
    let v = 0;
    for (let i = 0; i < 5; i++) v = v * 85 + (grp[i] ?? 84);
    for (let i = 0; i < n; i++) out.push(Math.floor(v / 2 ** (24 - 8 * i)) & 255);
  };
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c <= 32) continue;
    if (c === 122 && !grp.length) { out.push(0, 0, 0, 0); continue; }
    if (c < 33 || c > 117) continue;
    grp.push(c - 33);
    if (grp.length === 5) { flush(4); grp = []; }
  }
  if (grp.length > 1) flush(grp.length - 1);
  return Uint8Array.from(out);
}

export async function inflate(b: Uint8Array): Promise<Uint8Array> {
  const run = async (raw: Uint8Array, kind: 'deflate' | 'deflate-raw'): Promise<Uint8Array> => new Uint8Array(await new Response(new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream(kind))).arrayBuffer());
  try { return await run(b, 'deflate'); } catch { return run(b.subarray(2), 'deflate-raw'); }
}

async function privateText(src: string, skipped: Set<string>): Promise<string | null> {
  const i = src.indexOf('%AI9_PrivateDataBegin');
  if (i < 0) return null;
  const e = src.indexOf('%AI9_PrivateDataEnd', i);
  const lines = src.slice(i, e < 0 ? src.length : e).split(/\r\n|\r|\n/).slice(1);
  const at = lines.findIndex((l) => l.startsWith('%AI9_DataStream'));
  if (at < 0) return lines.map((l) => (l.startsWith('%') && !/^%(%|AI\d)/.test(l) ? l.slice(1) : l)).join('\n');
  const body = lines.slice(at + 1).map((l) => (l.startsWith('%') ? l.slice(1) : l)).join('');
  const raw = ascii85(body);
  let bytes = raw;
  const text0 = latin1(raw.subarray(0, 64));
  const zi = raw.length > 4 ? findZstd(raw) : -1;
  if (raw[0] === 0x78) bytes = await inflate(raw);
  else if (zi >= 0) {
    try { bytes = zstdDecompress(raw.subarray(zi)); } catch (err) { skipped.add(`ZStandard compressed art (${err instanceof Error ? err.message : 'not supported'})`); return null; }
  } else if (/^%AI12_CompressedData/.test(text0)) {
    const k = raw.subarray(0, 64).findIndex((v) => v === 10 || v === 13);
    bytes = await inflate(raw.subarray(k + 1));
  }
  return latin1(bytes);
}

export function findZstd(b: Uint8Array): number {
  for (let i = 0; i < Math.min(80, b.length - 4); i++) if (b[i] === 0x28 && b[i + 1] === 0xb5 && b[i + 2] === 0x2f && b[i + 3] === 0xfd) return i;
  return -1;
}

const NUM = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
function tokenize(s: string): Tok[] {
  const out: Tok[] = [], stack: Tok[][] = [out];
  let cur = out, i = 0;
  const n = s.length;
  const push = (t: Tok): void => { cur.push(t); };
  while (i < n) {
    const c = s[i];
    if (c <= ' ') { i++; continue; }
    if (c === '(') {
      let depth = 1, str = '';
      i++;
      while (i < n && depth > 0) {
        const ch = s[i++];
        if (ch === '\\') {
          const e = s[i++];
          if (e === 'n') str += '\n'; else if (e === 'r') str += '\r'; else if (e === 't') str += '\t'; else if (e === 'b') str += '\b'; else if (e === 'f') str += '\f';
          else if (e >= '0' && e <= '7') { let o = e; while (o.length < 3 && s[i] >= '0' && s[i] <= '7') o += s[i++]; str += String.fromCharCode(parseInt(o, 8) & 255); }
          else if (e === '\n') continue; else if (e === '\r') { if (s[i] === '\n') i++; } else str += e;
          continue;
        }
        if (ch === '(') depth++;
        if (ch === ')') { depth--; if (!depth) break; }
        str += ch;
      }
      push({ t: 's', v: str });
      continue;
    }
    if (c === '<') {
      if (s[i + 1] === '<') { i += 2; continue; }
      const k = s.indexOf('>', i);
      const hex = s.slice(i + 1, k < 0 ? n : k).replace(/\s+/g, '');
      i = k < 0 ? n : k + 1;
      push({ t: 'd', v: hex });
      continue;
    }
    if (c === '>') { i++; continue; }
    if (c === '[') { const a: Tok[] = []; push({ t: 'a', v: a }); stack.push(a); cur = a; i++; continue; }
    if (c === ']') { if (stack.length > 1) { stack.pop(); cur = stack[stack.length - 1]; } i++; continue; }
    if (c === '{' || c === '}' || c === ')') { i++; continue; }
    let j = i + 1;
    while (j < n && s[j] > ' ' && !'()<>[]{}/%'.includes(s[j])) j++;
    const w = s.slice(i, j);
    i = j;
    if (c === '/') push({ t: 'x', v: w.slice(1) });
    else if (NUM.test(w)) push({ t: 'n', v: Number(w) });
    else push({ t: 'w', v: w });
  }
  return out;
}

interface Prep { ops: string; datas: string[]; meta: Meta }

function prepare(text: string): Prep {
  const meta: Meta = { version: '', bbox: null, tile: null, artboards: [], units: 'pt', cmyk: true, customs: new Map(), gradients: new Map(), skipped: new Set(), pages: 1, defs: [] };
  const lines = text.split(/\r\n|\r|\n/), keep: string[] = [], datas: string[] = [];
  let cap: Def | null = null;
  const num = (s: string): number[] => (s.match(/[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/g) ?? []).map(Number);
  let skipEnd: string | null = null, nonPrint = 0, grad: { name: string; lines: string[] } | null = null, inData: string[] | null = null, lastCustom = false;
  const customs = (l: string): void => {
    for (const m of l.matchAll(/([-+]?[\d.]+)\s+([-+]?[\d.]+)\s+([-+]?[\d.]+)\s+([-+]?[\d.]+)\s+\(([^)]*)\)/g)) meta.customs.set(m[5], { kind: 'cmyk', c: Number(m[1]) * 100, m: Number(m[2]) * 100, y: Number(m[3]) * 100, k: Number(m[4]) * 100 });
  };
  const header = (l: string): void => {
    let m: RegExpExecArray | null;
    if ((m = /^%%HiResBoundingBox:\s*(.+)$/.exec(l))) { const v = num(m[1]); if (v.length >= 4) meta.bbox = v; }
    else if ((m = /^%%BoundingBox:\s*(.+)$/.exec(l))) { const v = num(m[1]); if (v.length >= 4 && !meta.bbox) meta.bbox = v; }
    else if ((m = /^%AI3_TileBox:\s*(.+)$/.exec(l))) { const v = num(m[1]); if (v.length >= 4 && !meta.tile) meta.tile = v; }
    else if ((m = /^%AI\d+_ArtboardRect:?\s*(.+)$/.exec(l))) { const v = num(m[1]); if (v.length >= 4) meta.artboards.push(v.slice(0, 4)); }
    else if ((m = /^%AI5_FileFormat\s+(\S+)/.exec(l))) meta.version = m[1];
    else if ((m = /^%AI5_RulerUnits:\s*(\d+)/.exec(l))) meta.units = UNITS[Number(m[1])] ?? 'pt';
    else if ((m = /^%AI9_ColorModel:\s*(\d+)/.exec(l))) meta.cmyk = Number(m[1]) !== 1;
    else if ((m = /^%%CMYKCustomColor:\s*(.*)$/.exec(l))) { customs(m[1]); lastCustom = true; return; }
    else if ((m = /^%%RGBCustomColor:\s*(.*)$/.exec(l))) {
      for (const g of m[1].matchAll(/([-+]?[\d.]+)\s+([-+]?[\d.]+)\s+([-+]?[\d.]+)\s+\(([^)]*)\)/g)) meta.customs.set(g[4], { kind: 'rgb', r: Math.round(Number(g[1]) * 255), g: Math.round(Number(g[2]) * 255), b: Math.round(Number(g[3]) * 255) });
      lastCustom = true;
      return;
    } else if (lastCustom && (m = /^%%\+\s*(.*)$/.exec(l))) { customs(m[1]); return; }
    lastCustom = false;
  };
  for (let li = 0; li < lines.length; li++) {
    let l = lines[li];
    if (inData) {
      if (/^(%%EndData|%AI5_EndRaster)/.test(l)) { datas.push(inData.join('')); keep.push('XDATA'); inData = null; } else inData.push(l.replace(/^%/, '').replace(/[^0-9A-Fa-f]/g, ''));
      continue;
    }
    if (grad) {
      if (/^%AI5_EndGradient/.test(l)) {
        const def = parseGradient(grad.lines);
        meta.gradients.set(grad.name, def);
        grad = null;
      } else grad.lines.push(l);
      continue;
    }
    let m: RegExpExecArray | null;
    if (cap) {
      if (new RegExp(`^%AI\\d+_End${cap.block}\\b`).test(l)) { meta.defs.push(cap); cap = null; continue; }
      if (l.startsWith('%_')) cap.lines.push(l.slice(2)); else if (!l.startsWith('%')) cap.lines.push(l);
      if (/(^|\s)XI\s*$/.test(l.replace(/^%_/, ''))) cap.raster = true;
      continue;
    }
    if ((m = /^%AI\d+_BeginGradient:\s*\((.*)\)/.exec(l))) { grad = { name: m[1], lines: [] }; continue; }
    if (skipEnd) { if (new RegExp(`^%AI\\d+_End${skipEnd}\\b`).test(l)) skipEnd = null; continue; }
    if (/^%AI5_Begin_NonPrinting/.test(l)) { nonPrint++; continue; }
    if (/^%AI5_End_NonPrinting/.test(l)) { nonPrint = Math.max(0, nonPrint - 1); continue; }
    if ((m = /^%AI\d+_Begin(\w+)/.exec(l)) && m[1] !== 'Layer' && m[1] !== 'Gradient' && m[1] !== 'Setup' && m[1] !== 'Prolog') {
      if (m[1] in KEPT) { cap = { kind: KEPT[m[1]], block: m[1], head: l, lines: [], raster: false }; continue; }
      if (m[1] in BLOCKS) { if (BLOCKS[m[1]]) meta.skipped.add(BLOCKS[m[1]]); skipEnd = m[1]; continue; }
      if (/^(Encoding|Procedure|Resource)/.test(m[1])) continue;
      meta.skipped.add(`${m[1]} blocks`); skipEnd = m[1];
      continue;
    }
    if (/^%%BeginData/.test(l) || /^%%BeginBinary/.test(l)) { inData = []; continue; }
    if (/^%%Page:/.test(l)) meta.pages++;
    if (l.startsWith('%_')) l = l.slice(2);
    else if (l.startsWith('%')) { if (!nonPrint) header(l); continue; }
    if (nonPrint) continue;
    keep.push(l);
    if (/(^|\s)XI\s*$/.test(l)) inData = [];
  }
  return { ops: keep.join('\n'), datas, meta };
}

function parseGradient(lines: string[]): GradDef {
  let type = 0;
  const stops: Array<{ c: Color; mid: number; ramp: number }> = [];
  for (const raw of lines) {
    const l = raw.startsWith('%_') ? raw.slice(2) : raw;
    if (raw.startsWith('%') && !raw.startsWith('%_')) continue;
    const bd = /\)\s+(\d+)\s+\d+\s+Bd\s*$/.exec(l);
    if (bd) { type = Number(bd[1]); continue; }
    if (!/\sBs\s*$/.test(l) || /%_BS\s*$/.test(l)) continue;
    const toks = tokenize(l.replace(/\sBs\s*$/, ''));
    const nums = toks.filter((t): t is { t: 'n'; v: number } => t.t === 'n').map((t) => t.v);
    if (nums.length < 3) continue;
    const ramp = nums[nums.length - 1], mid = nums[nums.length - 2], head = nums.slice(0, -2);
    let c: Color;
    if (head.length === 8 && head[7] === 2) c = { kind: 'rgb', r: Math.round(head[4] * 255), g: Math.round(head[5] * 255), b: Math.round(head[6] * 255) };
    else if (head.length >= 4) c = { kind: 'cmyk', c: head[0] * 100, m: head[1] * 100, y: head[2] * 100, k: head[3] * 100 };
    else c = { kind: 'gray', k: (1 - head[0]) * 100 };    stops.push({ c, mid, ramp });
  }
  stops.sort((a, b) => a.ramp - b.ramp);
  return { type, stops: stops.map((s) => stop(Math.max(0, Math.min(1, s.ramp / 100)), s.c, 1, Math.max(0.1, Math.min(0.9, s.mid / 100)))) };
}

const apt = (m: Mat, x: number, y: number): { x: number; y: number } => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

function fontOf(raw: string): { font: string; style: string } {
  const n = raw.replace(/^_/, '').replace(/^[A-Z]{6}\+/, '');
  const [fam0, sty0 = ''] = n.split(/[-,]/);
  const fam = fam0.replace(/(PSMT|MT|PS)$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim() || 'Inter';
  const s = `${sty0} ${/Bold/i.test(fam0) ? 'Bold' : ''}`;
  const style = /Bold/i.test(s) && /Italic|Oblique/i.test(s) ? 'Bold Italic' : /Bold|Black|Heavy/i.test(s) ? 'Bold' : /Italic|Oblique/i.test(s) ? 'Italic' : 'Regular';
  return { font: fam, style };
}

class Reader {
  stack: Tok[] = [];
  gs: Gs = { fill: solid({ kind: 'gray', k: 100 }), stroke: null, lw: 1, cap: 'butt', join: 'miter', miter: 10, dash: [], dashOff: 0, fillOp: false, strokeOp: false, rule: 'nonzero', opacity: 1, blend: 'normal' };
  path: SubPath[] = [];
  ended: PathData = [];
  clipFlag = false;
  guideNext = false;
  inBb = false;
  ctx: Ctx[] = [{ kind: 'layer', nodes: [], kids: [] }];
  pre: VNode[] = [];
  layers: LayerOut[] = [];
  layerSeen = false;
  grad: GradPending | null = null;
  swatches = new Map<string, string>();
  swatchDefs: Doc['swatches'] = [];
  patterns = new Map<string, string>();
  unknown = new Set<string>();
  skipped: Set<string>;
  images: Array<{ node: ImageNode; w: number; h: number; comps: number; bits: number; data: string }> = [];
  imgPending: { m: Mat; w: number; h: number; comps: number; bits: number; binary: boolean } | null = null;
  dataAt = 0;
  text: { type: number; m: Mat; runs: Span[]; path: SubPath[]; capturing: boolean; align: number } | null = null;
  run: TextRun = { name: '_Helvetica', size: 12, leading: null, tracking: 0, baseline: 0, hs: 100, vs: 100 };
  trMode = 0;
  curLayerName = '';
  steps = 0;
  styles = new Map<string, StyleResult>();
  styleStats = { objects: 0, effects: 0, kept: new Set<string>() };
  held: Held | null = null;
  armed = '';
  lastGrad: Paint | null = null;
  styleMode = false;
  constructor(readonly meta: Meta, readonly datas: string[], readonly ox: number, readonly oy: number) { this.skipped = meta.skipped; }

  P(x: number, y: number): { x: number; y: number } { return { x: x - this.ox, y: this.oy - y }; }
  get F(): Mat { return [1, 0, 0, -1, -this.ox, this.oy]; }
  top(): Ctx { return this.ctx[this.ctx.length - 1]; }
  nums(): number[] { const o: number[] = []; for (const t of this.stack) if (t.t === 'n') o.push(t.v); return o; }
  str(): string { for (let i = this.stack.length - 1; i >= 0; i--) { const t = this.stack[i]; if (t.t === 's') return t.v; } return ''; }

  sub(): SubPath | null { return this.path.length ? this.path[this.path.length - 1] : null; }
  moveTo(x: number, y: number): void { const p = this.P(x, y); this.path.push({ closed: false, pts: [anchor(p.x, p.y)] }); }
  lineTo(x: number, y: number, smooth: boolean): void {
    const s = this.sub();
    if (!s) { this.moveTo(x, y); return; }
    const p = this.P(x, y), a = anchor(p.x, p.y);
    if (smooth) a.smooth = true;
    s.pts.push(a);
  }
  curveTo(x1: number | null, y1: number | null, x2: number, y2: number, x3: number, y3: number, smooth: boolean): void {
    const s = this.sub();
    if (!s) { this.moveTo(x3, y3); return; }
    const last = s.pts[s.pts.length - 1];
    if (x1 !== null && y1 !== null) { const c1 = this.P(x1, y1); last.ox = c1.x; last.oy = c1.y; }
    const c2 = this.P(x2, y2), e = this.P(x3, y3);
    const a: Anchor = { x: e.x, y: e.y, ix: c2.x, iy: c2.y, ox: e.x, oy: e.y };
    if (smooth) a.smooth = true;
    s.pts.push(a);
  }
  closeLast(): void {
    const s = this.sub();
    if (!s || s.closed) return;
    if (s.pts.length > 1) {
      const a = s.pts[0], z = s.pts[s.pts.length - 1];
      if (Math.abs(a.x - z.x) < 1e-6 && Math.abs(a.y - z.y) < 1e-6) { a.ix = z.ix; a.iy = z.iy; s.pts.pop(); }
    }
    s.closed = true;
  }
  tidy(d: SubPath[]): PathData {
    return d.filter((s) => s.pts.length > 1).map((s) => ({ closed: s.closed, pts: s.pts.map((a) => { if (a.smooth && ((a.ix === a.x && a.iy === a.y) || (a.ox === a.x && a.oy === a.y))) { const { smooth: _s, ...rest } = a; return rest; } return a; }) }));
  }

  colorPaint(c: Color, tint?: number, swatch?: string): Paint {
    const p: Paint = { type: 'color', color: c };
    if (swatch) { p.swatch = swatch; if (tint !== undefined && tint < 100) p.tint = tint; }
    return p;
  }
  custom(name: string, base: Color, tint: number): Paint {
    let id = this.swatches.get(name);
    if (!id) {
      id = newId('s');
      this.swatches.set(name, id);
      const c = this.meta.customs.get(name) ?? base;
      this.swatchDefs.push({ id, name, paint: solid(c), global: true, spot: true });
    }
    return this.colorPaint(base, Math.round((1 - tint) * 1000) / 10, id);
  }

  appearance(fill: boolean, stroke: boolean, gradient: Paint | null): Appearance {
    const g = this.gs, items: Appearance['items'] = [];
    if (fill) { const f = fillItem(gradient ?? g.fill ?? solid({ kind: 'gray', k: 100 })); if (g.fillOp) f.overprint = true; items.push(f); }
    if (stroke) {
      const s = strokeItem(g.stroke ?? solid({ kind: 'gray', k: 100 }), g.lw, { cap: g.cap, join: g.join, miter: g.miter, dash: [...g.dash], dashOffset: g.dashOff });
      if (g.strokeOp) s.overprint = true;
      items.push(s);
    }
    return { items, effects: [] };
  }

  gradientPaint(): Paint | null {
    const gp = this.grad;
    if (!gp) return null;
    const def = this.meta.gradients.get(gp.name);
    if (!def || def.stops.length < 2) { this.skipped.add('gradient fills whose ramp is missing'); return solid({ kind: 'gray', k: 50 }); }
    const a = (gp.angle * Math.PI) / 180, m = gp.m;
    const p0 = apt(m, gp.x, gp.y), p1 = apt(m, gp.x + Math.cos(a) * gp.len, gp.y + Math.sin(a) * gp.len);
    const q0 = this.P(p0.x, p0.y), q1 = this.P(p1.x, p1.y);
    if (def.type === 1) {
      const sx = Math.hypot(m[0], m[1]) || 1, sy = Math.hypot(m[2], m[3]) || 1;
      const r = Math.hypot(q1.x - q0.x, q1.y - q0.y) || 1;
      const g = radialGradient(def.stops.map((s) => ({ ...s })));
      g.aspect = Math.max(0.05, Math.min(20, sy / sx));
      g.geom = { x1: q0.x, y1: q0.y, x2: q0.x + r, y2: q0.y };
      return { type: 'gradient', gradient: g };
    }
    const g = linearGradient(def.stops.map((s) => ({ ...s })));
    g.geom = { x1: q0.x, y1: q0.y, x2: q1.x, y2: q1.y };
    return { type: 'gradient', gradient: g };
  }

  /**
   * (name) px py sx sy angle rf r k ka [a b c d tx ty] p. The matrix carries the whole pattern transform
   * (origin, scale, rotation, reflection, shear), so only it is used; with no matrix the pattern keeps its
   * natural place. The matrix maps pattern space to page space, which becomes F M F^-1 on the flipped page.
   */
  patternPaint(): Paint {
    const id = this.patterns.get(this.str());
    if (!id) { this.skipped.add('pattern fills whose tile is missing'); return solid({ kind: 'gray', k: 50 }); }
    const arr = [...this.stack].reverse().find((t) => t.t === 'a');
    const k = arr && arr.t === 'a' ? arr.v.filter((t): t is { t: 'n'; v: number } => t.t === 'n').map((t) => t.v) : [];
    let xf: Mat = [1, 0, 0, 1, 0, 0];
    if (k.length >= 6 && k.every((v) => Number.isFinite(v))) {
      const M: Mat = [k[0], k[1], k[2], k[3], k[4], k[5]];
      const a0 = this.P(0, 0);
      const q = (x: number, y: number): { x: number; y: number } => { const t = apt(M, x, y); return this.P(t.x, t.y); };
      const b0 = q(0, 0), b1 = q(1, 0), b2 = q(0, 1);
      // P maps the page unit x to +1 and the page unit y to -1, so the columns of the new matrix are b1-b0 and -(b2-b0)
      const a = b1.x - b0.x, b = b1.y - b0.y, c = b0.x - b2.x, d = b0.y - b2.y;
      xf = [a, b, c, d, b0.x - (a * a0.x + c * a0.y), b0.y - (b * a0.x + d * a0.y)];
    }
    return { type: 'pattern', pattern: id, xf };
  }

  flushHeld(): void {
    const h = this.held;
    if (!h) return;
    this.held = null;
    const st = this.styles.get(h.style);
    let node = h.node;
    if (st && h.src.length && !st.missing.length) {
      const objs: Array<{ ctx: Ctx; d: PathData }> = [];
      for (const s of h.src) { const o = s.ctx.kind === 'compound' ? objs.find((x) => x.ctx === s.ctx) : undefined; if (o) o.d = [...o.d, ...s.d]; else objs.push({ ctx: s.ctx, d: s.d }); }
      let ap = st.ap;
      if (!ap.items.length) { const inner = paintedOf(h.node); if (inner) ap = { items: inner.ap.items, effects: ap.effects }; }
      const own = h.srcStyle ? this.styles.get(h.srcStyle) : undefined;
      if (own && own.ap.items.length && !own.missing.length) ap = { items: own.ap.items, effects: [...own.ap.effects, ...ap.effects] };
      const inner = paintedOf(h.node);
      let lost = false;
      // a gradient inside a style is relative to the object it styles, so the placed gradient of the expanded art is borrowed
      ap = { ...ap, items: ap.items.map((it) => { if (it.paint.type !== 'gradient') return it; const g = inner?.ap.items.find((x) => x.kind === it.kind && x.paint.type === 'gradient'); if (!g) { lost = true; return it; } return { ...it, paint: g.paint }; }) };
      if (lost) this.styleStats.kept.add('gradients inside styles that are not placed in the expanded art');
      if (!lost && (ap.items.length || ap.effects.length)) {
        const made = objs.map((o): VNode => ({ id: newId('p'), kind: 'path', d: o.d, rule: this.gs.rule, opacity: st.opacity, blend: st.blend, ap: { items: ap.items.map((i) => ({ ...i })), effects: ap.effects.map((e) => ({ ...e, params: { ...e.params } })) } }));
        node = made.length === 1 ? made[0] : group(made);
        this.styleStats.objects++;
        this.styleStats.effects += ap.effects.length + ap.items.reduce((s, i) => s + i.effects.length, 0);
      }
    } else if (st && st.missing.length) for (const m of st.missing) this.styleStats.kept.add(m);
    this.addTo(h.parent, node);
  }
  add(n: VNode): void {
    this.flushHeld();
    const c = this.top();
    if (c.kind === 'compound') { if (n.kind === 'path') c.kids.push(n); return; }
    if (this.layerSeen) c.nodes.push(n); else if (this.ctx.length === 1) this.pre.push(n); else c.nodes.push(n);
  }

  paintOp(op: string): void {
    const closes = op === 'f' || op === 's' || op === 'b' || op === 'n';
    if (closes) this.closeLast();
    const fillIt = op === 'f' || op === 'F' || op === 'b' || op === 'B', strokeIt = op === 's' || op === 'S' || op === 'b' || op === 'B';
    if (this.inBb && (op === 'f' || op === 'F')) return;
    this.paintWith(fillIt, strokeIt);
  }
  paintWith(fillIt: boolean, strokeIt: boolean): void {
    let d = this.tidy(this.path);
    this.path = [];
    if (!d.length && this.grad && fillIt && this.ended.length) d = this.ended;
    if (!d.length) { this.clipFlag = false; this.guideNext = false; return; }
    const c = this.top();
    if (this.guideNext) {
      this.guideNext = false;
      this.add({ id: newId('p'), kind: 'path', d, rule: this.gs.rule, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, guide: true });
      return;
    }
    if (this.clipFlag) {
      this.clipFlag = false;
      const clip: PathNode = { id: newId('p'), kind: 'path', d, rule: this.gs.rule, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
      if (c.kind === 'compound') { c.kids.push(clip); c.clipped = true; } else c.clipper = clip;
      return;
    }
    if (!fillIt && !strokeIt) { if (this.held) this.held.src.push({ ctx: c, d }); this.ended = d; return; }
    const gp = fillIt ? this.gradientPaint() : null;
    const ap = this.appearance(fillIt, strokeIt, gp);
    if (c.kind === 'compound') {
      c.ap = ap; c.rule = this.gs.rule; c.opacity = this.gs.opacity; c.blend = this.gs.blend;
      c.kids.push({ id: newId('p'), kind: 'path', d, rule: this.gs.rule, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } });
      return;
    }
    this.add({ id: newId('p'), kind: 'path', d, rule: this.gs.rule, opacity: this.gs.opacity, blend: this.gs.blend, ap });
  }

  closeCtx(kind: Ctx['kind'] | null): void {
    if (this.held && this.top().kind !== 'compound') this.flushHeld();
    const c = this.ctx.length > 1 ? this.ctx.pop() : undefined;
    if (!c) return;
    void kind;
    const parent = this.top();
    if (c.kind === 'compound') {
      const kids = c.kids.filter((k) => k.d.length);
      if (c.clipped) {
        const clip: VNode = kids.length === 1 ? kids[0] : { id: newId('c'), kind: 'compound', rule: c.rule ?? 'nonzero', children: kids, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
        parent.clipper = clip;
        return;
      }
      if (!kids.length) return;
      if (kids.length === 1) { this.addTo(parent, { ...kids[0], ap: c.ap ?? kids[0].ap, opacity: c.opacity ?? 1, blend: c.blend ?? 'normal' }); return; }
      const n: CompoundNode = { id: newId('c'), kind: 'compound', rule: c.rule ?? 'nonzero', children: kids, opacity: c.opacity ?? 1, blend: c.blend ?? 'normal', ap: c.ap ?? { items: [], effects: [] } };
      this.addTo(parent, n);
      return;
    }
    if (!c.nodes.length && !c.clipper) return;
    const clip = c.kind === 'clip' && !!c.clipper;
    const kids = clip ? [...c.nodes, c.clipper as VNode] : c.nodes;
    const gn: VNode = { id: newId('g'), kind: 'group', clip, children: kids, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
    if (c.sub) { if (c.sub.name) gn.name = c.sub.name; if (c.sub.hidden) gn.hidden = true; if (c.sub.locked) gn.locked = true; }
    if (c.styled && this.styles.has(c.styled) && !(parent.kind === 'compound')) { this.held = { node: gn, style: c.styled, parent, src: [], srcStyle: '' }; return; }
    this.addTo(parent, gn);
  }
  addTo(parent: Ctx, n: VNode): void {
    this.flushHeld();
    if (parent.kind === 'compound') { if (n.kind === 'path') parent.kids.push(n); return; }
    if (!this.layerSeen && this.ctx.length === 1) this.pre.push(n); else parent.nodes.push(n);
  }

  endLayer(): void {
    while (this.ctx.length > 1) this.closeCtx(null);
    this.ctx = [{ kind: 'layer', nodes: [], kids: [] }];
  }
  beginLayer(a: number[]): void {
    this.flushHeld();
    this.flushLayer();
    this.layerSeen = true;
    const hex = (v: number): string => Math.max(0, Math.min(255, Math.round(v ?? 0))).toString(16).padStart(2, '0');
    const rgb = a.length >= 11 ? 8 : a.length >= 10 ? 7 : -1;
    this.layers.push({ name: `Layer ${this.layers.length + 1}`, hidden: a[0] === 0, locked: a.length > 2 && a[2] === 0, printable: a[3] !== 0, color: rgb >= 0 ? `#${hex(a[rgb])}${hex(a[rgb + 1])}${hex(a[rgb + 2])}` : '', nodes: [] });
    this.ctx = [{ kind: 'layer', nodes: this.layers[this.layers.length - 1].nodes, kids: [] }];
  }
  flushLayer(): void { this.flushHeld(); this.armed = ''; while (this.ctx.length > 1) this.closeCtx(null); }

  textBegin(type: number): void { this.text = { type, m: [1, 0, 0, 1, 0, 0], runs: [], path: [], capturing: false, align: 0 }; this.path = []; this.run = { ...this.run }; }
  styleNow(): Span['style'] {
    const r = this.run, f = fontOf(r.name), g = this.gs;
    const fillP = g.fill ?? solid({ kind: 'gray', k: 100 });
    const st: Span['style'] = { ...DEFAULT_CHAR, font: f.font, style: f.style, size: Math.max(1, r.size), leading: r.leading, tracking: r.size ? (r.tracking / r.size) * 1000 : 0, baseline: r.baseline, hscale: r.hs, vscale: r.vs, fill: this.trMode === 1 ? { type: 'none' } : fillP };
    if (this.trMode === 1 || this.trMode === 2) { st.stroke = g.stroke ?? fillP; st.strokeWidth = g.lw; }
    return st;
  }
  textShow(s: string): void {
    const t = this.text;
    if (!t || !s) return;
    const style = this.styleNow(), str = s.replace(/\r\n?/g, '\n');
    const last = t.runs[t.runs.length - 1];
    if (last && JSON.stringify(last.style) === JSON.stringify(style)) last.text += str; else t.runs.push({ text: str, style });
  }
  textEnd(): void {
    const t = this.text;
    this.text = null;
    if (!t || !t.runs.length || this.trMode === 3) return;
    const tail = t.runs[t.runs.length - 1];
    if (tail.text.endsWith('\n')) tail.text = tail.text.slice(0, -1);
    const text = t.runs.map((r) => r.text).join('');
    if (!text.replace(/\s/g, '')) return;
    const m = t.m, base: Omit<TextNode, 'mode' | 'xf'> = { id: newId('t'), kind: 'text', spans: t.runs.map((r) => ({ ...r })), para: { ...DEFAULT_PARA, align: t.align === 1 ? 'center' : t.align === 2 ? 'right' : t.align === 3 ? 'justify' : 'left' }, opacity: this.gs.opacity, blend: this.gs.blend, ap: { items: [], effects: [] } };
    const d = this.tidy(t.path);
    if (t.type === 1 && d.length) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const sp of d) for (const a of sp.pts) { x0 = Math.min(x0, a.x); y0 = Math.min(y0, a.y); x1 = Math.max(x1, a.x); y1 = Math.max(y1, a.y); }
      this.add({ ...base, mode: 'area', xf: [1, 0, 0, 1, x0, y0], frame: { x: 0, y: 0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) } });
      return;
    }
    if (t.type === 2 && d.length) { this.add({ ...base, mode: 'path', xf: [1, 0, 0, 1, 0, 0], path: d }); return; }
    this.add({ ...base, mode: 'point', xf: mul(this.F, mul(m, [1, 0, 0, -1, 0, 0])) });
  }

  exec(w: string): void {
    const a = this.nums(), g = this.gs;
    const n = (i: number): number => a[i < 0 ? a.length + i : i] ?? 0;
    switch (w) {
      case 'm': this.moveTo(n(-2), n(-1)); break;
      case 'L': this.lineTo(n(-2), n(-1), false); break;
      case 'l': this.lineTo(n(-2), n(-1), true); break;
      case 'C': this.curveTo(n(-6), n(-5), n(-4), n(-3), n(-2), n(-1), false); break;
      case 'c': this.curveTo(n(-6), n(-5), n(-4), n(-3), n(-2), n(-1), true); break;
      case 'V': this.curveTo(null, null, n(-4), n(-3), n(-2), n(-1), false); break;
      case 'v': this.curveTo(null, null, n(-4), n(-3), n(-2), n(-1), true); break;
      case 'Y': this.curveTo(n(-4), n(-3), n(-2), n(-1), n(-2), n(-1), false); break;
      case 'y': this.curveTo(n(-4), n(-3), n(-2), n(-1), n(-2), n(-1), true); break;
      case 'h': this.closeLast(); break;
      case 'H': break;
      case '*': this.guideNext = true; this.stack = []; return;
      case 'f': case 'F': case 's': case 'S': case 'b': case 'B': case 'n': case 'N': this.paintOp(w); break;
      case 'W': this.clipFlag = true; break;
      case 'XR': g.rule = n(-1) === 1 ? 'evenodd' : 'nonzero'; break;
      case 'u': { this.flushHeld(); const gc: Ctx = { kind: 'group', nodes: [], kids: [] }; if (this.armed) { gc.styled = this.armed; this.armed = ''; } this.ctx.push(gc); break; }
      case 'XW': {
        const name = this.str(), flag = n(-1);
        if (this.held && !name) break;
        if (this.held && flag === 0) { this.held.srcStyle = name; break; }
        if (name && flag === 1) { this.flushHeld(); this.armed = this.styles.has(name) ? name : ''; }
        break;
      }
      case 'U': if (this.top().kind === 'group') this.closeCtx(null); break;
      case 'q': this.ctx.push({ kind: 'clip', nodes: [], kids: [] }); break;
      case 'Q': if (this.top().kind === 'clip') this.closeCtx(null); break;
      case '*u': this.ctx.push({ kind: 'compound', nodes: [], kids: [] }); break;
      case '*U': if (this.top().kind === 'compound') this.closeCtx(null); break;
      case 'g': g.fill = solid({ kind: 'gray', k: (1 - n(-1)) * 100 }); break;
      case 'G': g.stroke = solid({ kind: 'gray', k: (1 - n(-1)) * 100 }); break;
      case 'k': g.fill = solid({ kind: 'cmyk', c: n(-4) * 100, m: n(-3) * 100, y: n(-2) * 100, k: n(-1) * 100 }); break;
      case 'K': g.stroke = solid({ kind: 'cmyk', c: n(-4) * 100, m: n(-3) * 100, y: n(-2) * 100, k: n(-1) * 100 }); break;
      case 'Xa': g.fill = solid({ kind: 'rgb', r: Math.round(n(-3) * 255), g: Math.round(n(-2) * 255), b: Math.round(n(-1) * 255) }); break;
      case 'XA': g.stroke = solid({ kind: 'rgb', r: Math.round(n(-3) * 255), g: Math.round(n(-2) * 255), b: Math.round(n(-1) * 255) }); break;
      case 'x': case 'Xs': case 'X': case 'XS': {
        const base: Color = { kind: 'cmyk', c: n(-5) * 100, m: n(-4) * 100, y: n(-3) * 100, k: n(-2) * 100 };
        const p = this.custom(this.str(), base, n(-1));
        if (w === 'x' || w === 'Xs') g.fill = p; else g.stroke = p;
        break;
      }
      case 'w': g.lw = n(-1); break;
      case 'j': g.join = n(-1) === 1 ? 'round' : n(-1) === 2 ? 'bevel' : 'miter'; break;
      case 'J': g.cap = n(-1) === 1 ? 'round' : n(-1) === 2 ? 'square' : 'butt'; break;
      case 'M': g.miter = n(-1) || 10; break;
      case 'd': {
        const arr = this.stack.find((t) => t.t === 'a');
        g.dash = arr && arr.t === 'a' ? arr.v.filter((t): t is { t: 'n'; v: number } => t.t === 'n').map((t) => t.v) : [];
        g.dashOff = n(-1);
        break;
      }
      case 'O': g.fillOp = n(-1) === 1; break;
      case 'R': g.strokeOp = n(-1) === 1; break;
      case 'Xy': g.blend = BLEND[Math.round(a[0] ?? 0)] ?? 'normal'; g.opacity = Math.max(0, Math.min(1, a.length > 1 ? a[1] : 1)); break;
      case 'Lb': this.beginLayer(a); break;
      case 'LB': this.flushLayer(); break;
      case 'Ln': { const L = this.layers[this.layers.length - 1]; if (L) L.name = this.str() || L.name; break; }
      case 'SL': this.top().sub = { name: this.str(), hidden: n(-2) === 0, locked: n(-1) === 0 }; break;
      case 'Bb': this.inBb = true; break;
      case 'Xx': case 'XX': {
        const type = n(-1), tint = n(-2);
        const base: Color = type === 0 ? { kind: 'cmyk', c: n(-6) * 100, m: n(-5) * 100, y: n(-4) * 100, k: n(-3) * 100 } : { kind: 'rgb', r: Math.round(n(-5) * 255), g: Math.round(n(-4) * 255), b: Math.round(n(-3) * 255) };
        const p = this.custom(this.str(), base, tint);
        if (w === 'Xx') g.fill = p; else g.stroke = p;
        break;
      }
      case 'Bg': {
        const k = a.slice(-10);
        if (k.length === 10) this.grad = { name: this.str(), x: k[0], y: k[1], angle: k[2], len: k[3], m: [k[4], k[5], k[6], k[7], k[8], k[9]], mSet: false };
        break;
      }
      case 'Xm': case 'Bm': if (this.grad && !this.grad.mSet && a.length >= 6) { this.grad.m = [n(-6), n(-5), n(-4), n(-3), n(-2), n(-1)]; this.grad.mSet = true; } break;
      case 'BB': {
        const flag = n(-1);
        if (flag === 2) this.closeLast();
        if (this.grad && this.styleMode) this.lastGrad = this.gradientPaint();
        if (this.grad) this.paintWith(true, flag >= 1);
        this.grad = null;
        this.inBb = false;
        this.ended = [];
        break;
      }
      case 'p': case 'P': {
        const paint = this.patternPaint();
        if (w === 'p') g.fill = paint; else g.stroke = paint;
        break;
      }
      case 'To': this.textBegin(n(-1)); break;
      case 'Tp': if (this.text) { this.text.m = tpMatrix(a); this.text.capturing = this.text.type !== 0; this.path = []; } break;
      case 'TP': if (this.text) { this.text.path = this.path; this.path = []; this.text.capturing = false; } break;
      case 'Tr': this.trMode = n(-1); break;
      case 'Tf': {
        const nm = [...this.stack].reverse().find((t) => t.t === 'x');
        if (nm && nm.t === 'x') this.run.name = nm.v;
        if (a.length) this.run.size = a[0];
        break;
      }
      case 'Tz': this.run.hs = a[0] ?? 100; this.run.vs = a.length > 1 ? a[1] : (a[0] ?? 100); break;
      case 'Ts': this.run.baseline = n(-1); break;
      case 'Tc': this.run.tracking = n(-1); break;
      case 'Ta': if (this.text) this.text.align = Math.round(n(-1)); break;
      case 'Tx': case 'Tj': if (this.text && this.text.type !== 2) for (const t of this.stack) if (t.t === 's') this.textShow(t.v); break;
      case 'TX': for (const t of this.stack) if (t.t === 's') this.textShow(t.v); break;
      case 'TO': this.textEnd(); break;
      case 'XI': this.image(a); break;
      case 'XG': this.skipped.add('linked images'); break;
      default:
        if (!SILENT.has(w) && !/^Adobe_/.test(w)) this.unknown.add(w);
    }
    this.stack = [];
  }

  image(a: number[]): void {
    const m = this.stack.find((t) => t.t === 'a');
    const mat = m && m.t === 'a' ? m.v.filter((t): t is { t: 'n'; v: number } => t.t === 'n').map((t) => t.v) : [];
    if (mat.length < 6 || a.length < 4) { this.skipped.add('placed images'); return; }
    const w = Math.round(a[4] ?? 0), h = Math.round(a[5] ?? 0), bits = Math.round(a[6] ?? 8), comps = Math.round(a[7] ?? 3);
    if (w <= 0 || h <= 0 || w * h > 40_000_000) { this.skipped.add('placed images'); return; }
    this.imgPending = { m: mat.slice(0, 6) as Mat, w, h, comps, bits, binary: a[10] === 1 };
  }
  takeData(): void {
    const p = this.imgPending;
    if (this.dataAt >= this.datas.length) return;
    const data = this.datas[this.dataAt++];
    this.imgPending = null;
    if (!p) return;
    if (p.binary || p.bits !== 8 || p.comps < 1 || p.comps > 4) { this.skipped.add('binary or unusual raster images'); return; }
    const key = `img-${newId('').replace(/[^a-z0-9]/gi, '')}.png`;
    const node: ImageNode = { id: newId('im'), kind: 'image', src: key, w: p.w, h: p.h, xf: mul(this.F, mul(p.m, [1, 0, 0, -1, 0, p.h])), opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
    this.images.push({ node, w: p.w, h: p.h, comps: p.comps, bits: p.bits, data });
    this.add(node);
  }

  go(toks: Tok[]): void {
    for (const t of toks) {
      if (t.t !== 'w') { this.stack.push(t); continue; }
      if (++this.steps > 6_000_000) throw new Error('This Illustrator file is too large for the reader.');
      if (t.v === 'XDATA') { this.takeData(); this.stack = []; continue; }
      this.exec(t.v);
    }
    this.flushHeld();
    while (this.ctx.length > 1) this.closeCtx(null);
  }
}

function tpMatrix(a: number[]): Mat {
  const k = a.length >= 7 ? a.slice(-7, -1) : a.slice(-6);
  return k.length === 6 ? [k[0], k[1], k[2], k[3], k[4], k[5]] : [1, 0, 0, 1, 0, 0];
}

async function rasterPng(w: number, h: number, comps: number, bits: number, hex: string): Promise<Blob | null> {
  const per = Math.max(1, comps) * (bits >> 3);
  if (hex.length < w * h * per * 2) return null;
  const px = new Uint8ClampedArray(w * h * 4), val = (i: number): number => parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  for (let i = 0; i < w * h; i++) {
    const o = i * per, d = i * 4;
    if (comps >= 4) {
      const c = val(o) / 255, m = val(o + 1) / 255, y = val(o + 2) / 255, k = val(o + 3) / 255;
      px[d] = 255 * (1 - c) * (1 - k); px[d + 1] = 255 * (1 - m) * (1 - k); px[d + 2] = 255 * (1 - y) * (1 - k);
    } else if (comps === 3) { px[d] = val(o); px[d + 1] = val(o + 1); px[d + 2] = val(o + 2); }
    else { const v = val(o); px[d] = px[d + 1] = px[d + 2] = v; }
    px[d + 3] = 255;
  }
  const cv = new OffscreenCanvas(w, h), cx = cv.getContext('2d');
  if (!cx) return null;
  cx.putImageData(new ImageData(px, w, h), 0, 0);
  return cv.convertToBlob({ type: 'image/png' });
}

const group = (nodes: VNode[]): VNode => ({ id: newId('g'), kind: 'group', clip: false, children: nodes, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } });
/** The topmost painted path or compound inside a group, whose fills and strokes an effect-only style borrows. */
function paintedOf(n: VNode): PathNode | CompoundNode | null {
  if (n.kind === 'path' || n.kind === 'compound') return n.ap.items.length ? n : null;
  if (n.kind !== 'group') return null;
  for (let i = n.children.length - 1; i >= 0; i--) { const r = paintedOf(n.children[i]); if (r) return r; }
  return null;
}
const isIdentity = (m: number[]): boolean => m.length >= 6 && [1, 0, 0, 1, 0, 0].every((v, i) => Math.abs(m[i] - v) < 1e-6);
const firstString = (line: string): string => { const t = tokenize(line).find((k) => k.t === 's'); return t && t.t === 's' ? t.v : ''; };

/** Runs the operators of one style dictionary entry (FillStyle, StrokeStyle, BlendStyle) and reports the paint state they leave. */
function paintOf(rd: Reader, lines: string[]): PaintRead {
  const r = new Reader(rd.meta, [], rd.ox, rd.oy);
  r.swatches = rd.swatches; r.swatchDefs = rd.swatchDefs; r.unknown = rd.unknown; r.patterns = rd.patterns;
  r.styleMode = true; r.gs.fill = null;
  r.go(tokenize(lines.join('\n')));
  const g = r.gs;
  return { fill: r.lastGrad ?? g.fill, stroke: g.stroke, lw: g.lw, cap: g.cap, join: g.join, miter: g.miter, dash: g.dash, dashOff: g.dashOff, blend: g.blend, opacity: g.opacity };
}

/** Runs the lines of a kept block through a reader of its own that shares the main reader's swatches and patterns. */
function artOf(rd: Reader, lines: string[]): VNode[] {
  const r = new Reader(rd.meta, [], rd.ox, rd.oy);
  r.swatches = rd.swatches; r.swatchDefs = rd.swatchDefs; r.unknown = rd.unknown; r.patterns = rd.patterns; r.styles = rd.styles;
  r.go(tokenize(lines.join('\n')));
  return r.pre;
}

/**
 * Pattern definitions become pattern swatches, symbol definitions become symbols and the brush tool records
 * (calligraphic, art, pattern) become brushes whose tiles are the %AI8_BeginBrushPattern blocks they name.
 * Returns what was brought in, for the open message; whatever could not be read is added to meta.skipped.
 */
function buildDefs(rd: Reader, doc: Doc): string[] {
  const sk = rd.meta.skipped, defs = rd.meta.defs.filter((d) => d.lines.some((l) => l.trim()) || d.kind === 'plugin');
  const lines = (d: Def): string[] => d.lines.filter((l) => l.trim());
  const patterns: PatternDef[] = [], swatches: Doc['swatches'] = [], symbols: SymbolDef[] = [], brushes: BrushDef[] = [];
  for (const d of defs) {
    if (d.kind !== 'pattern') continue;
    if (d.raster) { sk.add('patterns that hold placed images'); continue; }
    const ls = lines(d), head = tokenize(ls[0] ?? '');
    const name = firstString(ls[0] ?? '') || /\((.*)\)/.exec(d.head)?.[1] || `Pattern ${patterns.length + 1}`;
    const nums = head.filter((t): t is { t: 'n'; v: number } => t.t === 'n').map((t) => t.v);
    const mat = head.find((t) => t.t === 'a');
    if (nums.length < 4) { sk.add('patterns with no tile box'); continue; }
    const x0 = Math.min(nums[0], nums[2]), x1 = Math.max(nums[0], nums[2]), y0 = Math.min(nums[1], nums[3]), y1 = Math.max(nums[1], nums[3]);
    if (!(x1 - x0 > 0 && y1 - y0 > 0)) { sk.add('patterns with no tile box'); continue; }
    if (mat && mat.t === 'a') {
      const k = mat.v.filter((t): t is { t: 'n'; v: number } => t.t === 'n').map((t) => t.v);
      if (k.length >= 6 && !isIdentity(k)) sk.add('transforms on pattern tiles');
    }
    const nodes = artOf(rd, ls.slice(1));
    if (!nodes.length) { sk.add('patterns with no visible art'); continue; }
    const def: PatternDef = { id: newId('pt'), name, tile: { x: x0 - rd.ox, y: rd.oy - y1, w: x1 - x0, h: y1 - y0 }, art: group(nodes), type: 'grid', hs: 0, vs: 0 };
    patterns.push(def);
    swatches.push({ id: newId('s'), name, paint: { type: 'pattern', pattern: def.id, xf: [1, 0, 0, 1, 0, 0] }, global: false, spot: false });
    rd.patterns.set(name, def.id);
  }
  for (const d of defs) {
    if (d.kind !== 'symbol') continue;
    if (d.raster) { sk.add('symbols that hold placed images'); continue; }
    const ls = lines(d), name = firstString(ls[0] ?? '') || `Symbol ${symbols.length + 1}`;
    const nodes = artOf(rd, ls);
    if (!nodes.length) { sk.add('symbols with no visible art'); continue; }
    const art = group(nodes), b = geomBounds(doc, art);
    symbols.push({ id: newId('y'), name, art: transformNode(art, translate(-(b.x + b.w / 2), -(b.y + b.h / 2))), reg: { x: 0, y: 0 }, type: 'dynamic' });
  }
  const tiles = new Map<string, VNode | null>();
  // brush tiles are bent along a path as filled outlines, so stroked art becomes filled shapes first
  const outlined = (n: VNode): VNode[] => {
    if (n.kind === 'path' || n.kind === 'compound') return n.ap.items.some((i) => i.kind === 'stroke' && i.visible && i.paint.type !== 'none') ? expandAppearance(doc, n) : [n];
    return n.kind === 'group' ? [{ ...n, children: n.children.flatMap(outlined) }] : [n];
  };
  for (const d of defs) {
    if (d.kind !== 'brushart') continue;
    const ls = lines(d), name = firstString(ls[0] ?? '');
    if (!name) continue;
    const nodes = d.raster ? [] : artOf(rd, ls).flatMap(outlined);
    tiles.set(name, nodes.length ? group(nodes) : null);
  }
  for (const d of defs) {
    if (d.kind !== 'plugin') continue;
    const s = tokenize(d.lines.join('\n')).filter((t) => t.t === 's').map((t) => (t.t === 's' ? t.v : ''));
    const tool = s[0] ?? '';
    if (!/Brush Tool$/.test(tool)) { if (!/Brush Manager/.test(tool)) sk.add('live effects and plug-in objects'); continue; }
    const name = s[1] ?? '', params = s.slice(2).join('');
    const bad = (): void => { sk.add('brushes whose definition is incomplete'); };
    if (/Calligraphic/.test(tool)) {
      const n = params.trim().split(/\s+/).map(Number);
      if (!name || n.length < 10 || n.some((v) => !Number.isFinite(v))) { bad(); continue; }
      // version, size a b, roundness a b, angle a b, then the variation kind of size, roundness and angle (0 is fixed)
      const mid = (a: number, b: number): number => (a + b) / 2, varies = (i: number, a: number, b: number): boolean => n[7 + i] !== 0 && Math.abs(a - b) > 1e-6;
      if (varies(0, n[1], n[2]) || varies(1, n[3], n[4]) || varies(2, n[5], n[6])) sk.add('random and pressure variation in calligraphic brushes');
      brushes.push({ id: newId('br'), name, brush: { type: 'calligraphic', angle: 0 - mid(n[5], n[6]), roundness: Math.max(0, Math.min(100, mid(n[3], n[4]))), size: Math.max(0.1, mid(n[1], n[2])) }, colorize: 'none' });
      continue;
    }
    const art = /ArtOnPath/.test(tool), pat = /PatternOnPath/.test(tool);
    if (!art && !pat) { sk.add(`${/Scatter/.test(tool) ? 'scatter' : 'other'} brushes`); continue; }
    // version / side / outer corner / inner corner / start / end / colorization and key colour / options
    const seg = params.split('/');
    if (!name || seg.length !== 8) { bad(); continue; }
    const slots = seg.slice(1, 6).map((x) => x.trim()), want = pat ? slots : slots.slice(0, 1);
    if (!slots[0] || want.some((x) => x && !tiles.get(x))) { bad(); continue; }
    const m = Number(seg[6].trim().split(/\s+/)[0]), colorize: BrushDef['colorize'] = m === 1 ? 'tints' : m === 2 ? 'tints_shades' : m === 3 ? 'hue_shift' : 'none';
    const side = tiles.get(slots[0]) as VNode, tile = (x: string): VNode | null => (x ? tiles.get(x) ?? null : null);
    brushes.push({ id: newId('br'), name, colorize, brush: art ? { type: 'art', art: side, stretch: true, flip: false, width: 100 } : { type: 'pattern', art: side, spacing: 0, fit: 'stretch', outer: tile(slots[1]), inner: tile(slots[2]), start: tile(slots[3]), end: tile(slots[4]) } });
  }
  const styleDefs = defs.filter((d) => d.kind === 'styles').flatMap((d) => parseStyles(d.lines));
  const host: StyleHost = {
    paint: (ls) => paintOf(rd, ls),
    brush: (_kind, size, roundness, angle) => {
      const same = brushes.find((b) => b.brush.type === 'calligraphic' && Math.abs(b.brush.size - size) < 1e-6 && Math.abs(b.brush.roundness - roundness) < 1e-6 && Math.abs(b.brush.angle - angle) < 1e-6);
      if (same) return same.id;
      const id = newId('br');
      brushes.push({ id, name: `Calligraphic ${Math.round(size * 100) / 100} pt`, brush: { type: 'calligraphic', angle, roundness, size }, colorize: 'none' });
      return id;
    },
  };
  for (const s of styleDefs) if (s.name) rd.styles.set(s.name, resolveStyle(s, host));
  const listed = defs.filter((d) => d.kind === 'stylelist').flatMap((d) => tokenize(d.lines.join('\n')).filter((t) => t.t === 's').map((t) => (t.t === 's' ? t.v : '')));
  const gstyles: Doc['styles'] = [];
  for (const nm of listed) {
    const st = rd.styles.get(nm);
    if (!st || nm === '[Default]' || gstyles.some((g) => g.name === nm) || (!st.ap.items.length && !st.ap.effects.length)) continue;
    if (st.missing.length) sk.add(`graphic style effects with no equivalent (${[...new Set(st.missing)].join(', ')})`);
    gstyles.push({ id: newId('gs'), name: nm, ap: st.ap, opacity: st.opacity, blend: st.blend });
  }
  doc.styles = [...doc.styles, ...gstyles];
  doc.patterns = [...doc.patterns, ...patterns];
  doc.swatches = [...doc.swatches, ...swatches];
  doc.symbols = [...doc.symbols, ...symbols];
  doc.brushes = [...doc.brushes, ...brushes];
  if (symbols.length) sk.add('which artwork is an instance of which symbol (placed symbols stay as their artwork)');
  if (brushes.length) sk.add('which strokes use each brush (brushed strokes stay as expanded paths)');
  const kept: string[] = [];
  if (patterns.length) kept.push(`${patterns.length} pattern swatch${patterns.length === 1 ? '' : 'es'}`);
  if (symbols.length) kept.push(`${symbols.length} symbol${symbols.length === 1 ? '' : 's'}`);
  if (brushes.length) kept.push(`${brushes.length} brush${brushes.length === 1 ? '' : 'es'}`);
  if (gstyles.length) kept.push(`${gstyles.length} graphic style${gstyles.length === 1 ? '' : 's'}`);
  return kept;
}

function styleNotices(rd: Reader, kept: string[]): void {
  const s = rd.styleStats, sk = rd.meta.skipped;
  if (s.objects) kept.push(`${s.objects} styled object${s.objects === 1 ? '' : 's'} as editable source art${s.effects ? ` with ${s.effects} live effect${s.effects === 1 ? '' : 's'}` : ''}`);
  if (s.kept.size) sk.add(`live effects with no formpth equivalent, kept as Illustrator's expanded art (${[...s.kept].join(', ')})`);
}

export async function readAiLegacy(data: ArrayBuffer, title: string): Promise<AiRead> {
  const src = aiSource(data);
  if (!/^\s*%!PS/.test(src)) throw new Error('This file is not an Illustrator document with PostScript art.');
  const early = new Set<string>();
  const priv = await privateText(src, early);
  if (priv === null && early.size) throw new Error(`This Illustrator file keeps its art in ${[...early][0]}; open a PDF compatible copy instead.`);
  return buildAi(priv ?? src, title, early, {});
}

export interface AiBuildOpts { boxes?: number[][]; names?: string[] }

/** Builds the document from already assembled Illustrator text; the legacy reader and the PDF compatible reader share it. */
export async function buildAi(text: string, title: string, early: Set<string>, opts: AiBuildOpts): Promise<AiRead> {
  const prep = prepare(text), meta = prep.meta;
  for (const s of early) meta.skipped.add(s);
  const boxes: number[][] = opts.boxes?.length ? opts.boxes : meta.artboards.length ? meta.artboards : meta.tile ? [meta.tile] : meta.bbox ? [meta.bbox] : [[0, 0, 612, 792]];
  const ox = Math.min(...boxes.map((b) => b[0])), oy = Math.max(...boxes.map((b) => b[3]));
  const rd = new Reader(meta, prep.datas, ox, oy);
  const doc = newDoc(Math.max(1, boxes[0][2] - boxes[0][0]), Math.max(1, boxes[0][3] - boxes[0][1]), { title, units: meta.units, colorMode: meta.cmyk ? 'cmyk' : 'rgb' });
  const kept = buildDefs(rd, doc);
  rd.go(tokenize(prep.ops));
  styleNotices(rd, kept);
  doc.artboards = boxes.map((b, i) => ({ id: newId('a'), name: opts.names?.[i] || `Artboard ${i + 1}`, x: Math.min(b[0], b[2]) - ox, y: oy - Math.max(b[1], b[3]), w: Math.max(1, Math.abs(b[2] - b[0])), h: Math.max(1, Math.abs(b[3] - b[1])), bg: null }));
  let outs = rd.layers;
  if (!outs.length) outs = [{ name: 'Layer 1', hidden: false, locked: false, printable: true, color: '', nodes: rd.pre }];
  else if (rd.pre.length) meta.skipped.add('art outside any layer');
  doc.layers = outs.map((l, i): LayerNode => {
    const ly = makeLayer(l.name, i);
    ly.children = l.nodes;
    if (l.color) ly.color = l.color;
    if (l.hidden) ly.hidden = true;
    if (l.locked) ly.locked = true;
    if (!l.printable) ly.printable = false;
    return ly;
  });
  doc.swatches = [...doc.swatches, ...rd.swatchDefs];
  for (const [name, c] of meta.customs) if (!rd.swatches.has(name)) doc.swatches.push({ id: newId('s'), name, paint: solid(c), global: true, spot: true });
  const assets = new Map<string, Blob>();
  for (const im of rd.images) {
    const blob = await rasterPng(im.w, im.h, im.comps, im.bits, im.data).catch(() => null);
    if (!blob) { meta.skipped.add('placed images'); im.node.hidden = true; continue; }
    assets.set(im.node.src, blob);
    doc.images[im.node.src] = { mime: 'image/png', w: im.w, h: im.h };
  }
  const prune = (nodes: VNode[]): VNode[] => nodes.filter((n) => !(n.kind === 'image' && n.hidden)).map((n) => (n.kind === 'group' ? { ...n, children: prune(n.children) } : n));
  for (const ly of doc.layers) ly.children = prune(ly.children);
  const count = (nodes: VNode[]): number => nodes.reduce((s, n) => s + 1 + ('children' in n ? count(n.children as VNode[]) : 0), 0);
  if (!doc.layers.some((l) => count(l.children))) throw new Error(`No Illustrator artwork found in this file${meta.skipped.size ? `; it holds ${[...meta.skipped].join(', ')}` : ''}.`);
  const unknown = [...rd.unknown];
  const skipped = [...meta.skipped];
  if (unknown.length) skipped.push(`${unknown.length} operator${unknown.length === 1 ? '' : 's'} it does not know`);
  return { doc, assets, skipped, unknown, version: meta.version, kept };
}
