import { makeLayer, newDoc, newId } from '../engine/doc';
import { apply, IDENTITY, mul } from '../engine/geometry';
import { cmyk, fill, gray, rgb, solid, stroke as strokeItem, NONE, stop } from '../engine/paint';
import { cssFont, DEFAULT_CHAR, DEFAULT_PARA, layoutText } from '../engine/text';
import type { Anchor, BlendMode, Cap, CharStyle, Color, Doc, Gradient, GroupNode, ImageAsset, ImageNode, Join, Mat, MeshNode, Paint, PathData, PathNode, PatternDef, Pt, Span, SubPath, TextNode, VNode } from '../engine';
import { families, systemFonts } from './fonts';
import type { FontInfo as InstalledFont } from './api';
import { openCrypt, type CryptMethod, type CryptParams, type PdfCrypt } from './pdf-crypt';
import { gridMesh, latticeMesh, patchTriangles, rasterTriangles, readLattice, readPatches, readTriangles, type MeshSpec, type Patch, type RV } from './pdf-mesh';

export class PdfPasswordError extends Error {
  constructor(readonly wrong: boolean) { super(wrong ? 'the password is not right' : 'it needs a password'); }
}

class Name { constructor(readonly v: string) {} }
class Ref { constructor(readonly n: number, readonly g: number) {} }
class Op { constructor(readonly v: string) {} }
class Str { constructor(readonly b: Uint8Array) {} }
class Stream { num = 0; gen = 0; constructor(readonly dict: PDict, readonly raw: Uint8Array) {} }
type PDict = Map<string, Val>;
type Val = number | boolean | null | Name | Str | Ref | Op | Stream | PDict | Val[];

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);
const ESC: Record<number, number> = { 110: 10, 114: 13, 116: 9, 98: 8, 102: 12, 40: 40, 41: 41, 92: 92 };

class Lexer {
  i: number;
  constructor(readonly s: Uint8Array, at = 0, private readonly refs = true) { this.i = at; }
  skip(): void {
    const s = this.s;
    while (this.i < s.length) {
      const c = s[this.i];
      if (WS.has(c)) { this.i++; continue; }
      if (c === 37) { while (this.i < s.length && s[this.i] !== 10 && s[this.i] !== 13) this.i++; continue; }
      break;
    }
  }
  word(): string { const s = this.s, a = this.i; while (this.i < s.length && !WS.has(s[this.i]) && !DELIM.has(s[this.i])) this.i++; return latin(s.subarray(a, this.i)); }
  value(): Val | undefined {
    this.skip();
    const s = this.s;
    if (this.i >= s.length) return undefined;
    const c = s[this.i];
    if (c === 47) { this.i++; return new Name(this.word().replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))); }
    if (c === 40) return this.literal();
    if (c === 60 && s[this.i + 1] === 60) {
      this.i += 2;
      const m: PDict = new Map();
      for (;;) {
        this.skip();
        if (this.i >= s.length) return m;
        if (s[this.i] === 62 && s[this.i + 1] === 62) { this.i += 2; return m; }
        const k = this.value();
        if (k === undefined) return m;
        if (k instanceof Name) m.set(k.v, this.value() ?? null);
      }
    }
    if (c === 60) {
      this.i++;
      const a = this.i;
      while (this.i < s.length && s[this.i] !== 62) this.i++;
      const hex = latin(s.subarray(a, this.i)).replace(/[^0-9a-fA-F]/g, ''), h = hex.length % 2 ? `${hex}0` : hex, out = new Uint8Array(h.length / 2);
      this.i++;
      for (let k = 0; k < out.length; k++) out[k] = parseInt(h.slice(k * 2, k * 2 + 2), 16);
      return new Str(out);
    }
    if (c === 91) {
      this.i++;
      const arr: Val[] = [];
      for (;;) { this.skip(); if (this.i >= s.length) return arr; if (s[this.i] === 93) { this.i++; return arr; } const v = this.value(); if (v === undefined) return arr; arr.push(v); }
    }
    if (DELIM.has(c)) { this.i++; return new Op(String.fromCharCode(c)); }
    const w = this.word();
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) {
      if (this.refs && /^\d+$/.test(w)) {
        const save = this.i;
        this.skip();
        const g = this.word();
        if (/^\d+$/.test(g)) { this.skip(); if (this.word() === 'R') return new Ref(Number(w), Number(g)); }
        this.i = save;
      }
      return Number(w);
    }
    if (w === 'true') return true;
    if (w === 'false') return false;
    if (w === 'null') return null;
    return new Op(w);
  }
  literal(): Str {
    const s = this.s, out: number[] = [];
    let depth = 0;
    this.i++;
    while (this.i < s.length) {
      const c = s[this.i++];
      if (c === 92) {
        const d = s[this.i++];
        if (ESC[d] !== undefined) out.push(ESC[d]);
        else if (d >= 48 && d <= 55) { let v = d - 48; for (let k = 0; k < 2 && s[this.i] >= 48 && s[this.i] <= 55; k++) v = v * 8 + s[this.i++] - 48; out.push(v & 255); }
        else if (d === 13) { if (s[this.i] === 10) this.i++; }
        else if (d !== 10) out.push(d);
        continue;
      }
      if (c === 40) depth++;
      if (c === 41) { if (depth === 0) break; depth--; }
      out.push(c);
    }
    return new Str(Uint8Array.from(out));
  }
}

function latin(b: Uint8Array): string { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return s; }
const num = (v: Val | undefined, d = 0): number => (typeof v === 'number' ? v : d);
const nameOf = (v: Val | undefined): string => (v instanceof Name ? v.v : '');
const mat6 = (a: number[]): Mat | null => (a.length === 6 ? [a[0], a[1], a[2], a[3], a[4], a[5]] : null);
const corner = (p: { x: number; y: number }): Anchor => ({ x: p.x, y: p.y, ix: p.x, iy: p.y, ox: p.x, oy: p.y });

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  for (const fmt of ['deflate', 'deflate-raw'] as const) {
    const ds = new DecompressionStream(fmt), w = ds.writable.getWriter();
    void w.write(data as unknown as BufferSource).catch(() => undefined);
    void w.close().catch(() => undefined);
    const r = ds.readable.getReader(), parts: Uint8Array[] = [];
    let total = 0;
    for (;;) { let res: ReadableStreamReadResult<Uint8Array>; try { res = await r.read(); } catch { break; } if (res.done) break; parts.push(res.value); total += res.value.length; }
    if (!total) continue;
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  throw new Error('a compressed stream could not be read');
}

function unpredict(data: Uint8Array, parms: PDict | null): Uint8Array {
  if (num(parms?.get('Predictor'), 1) < 10) return data;
  const colors = num(parms?.get('Colors'), 1), bpc = num(parms?.get('BitsPerComponent'), 8), cols = num(parms?.get('Columns'), 1);
  const bpp = Math.max(1, Math.ceil((colors * bpc) / 8)), row = Math.ceil((colors * bpc * cols) / 8), rows = Math.floor(data.length / (row + 1));
  const out = new Uint8Array(rows * row);
  for (let r = 0; r < rows; r++) {
    const t = data[r * (row + 1)], src = r * (row + 1) + 1, line = r * row, prev = (r - 1) * row;
    for (let k = 0; k < row; k++) {
      const x = data[src + k], a = k >= bpp ? out[line + k - bpp] : 0, b = r ? out[prev + k] : 0, c = r && k >= bpp ? out[prev + k - bpp] : 0;
      let v = x;
      if (t === 1) v = x + a; else if (t === 2) v = x + b; else if (t === 3) v = x + ((a + b) >> 1);
      else if (t === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      out[line + k] = v & 255;
    }
  }
  return out;
}

function ascii85(d: Uint8Array): Uint8Array {
  const out: number[] = [];
  let tuple = 0, n = 0;
  for (let i = 0; i < d.length; i++) {
    const c = d[i];
    if (c === 126) break;
    if (WS.has(c)) continue;
    if (c === 122 && n === 0) { out.push(0, 0, 0, 0); continue; }
    tuple = tuple * 85 + (c - 33); n++;
    if (n === 5) { out.push((tuple >>> 24) & 255, (tuple >>> 16) & 255, (tuple >>> 8) & 255, tuple & 255); tuple = 0; n = 0; }
  }
  if (n > 1) { for (let k = n; k < 5; k++) tuple = tuple * 85 + 84; out.push(...[(tuple >>> 24) & 255, (tuple >>> 16) & 255, (tuple >>> 8) & 255, tuple & 255].slice(0, n - 1)); }
  return Uint8Array.from(out);
}

class PdfFile {
  private readonly offsets = new Map<number, number>();
  private readonly cache = new Map<number, Val>();
  private readonly packed = new Map<number, Val>();
  private readonly gens = new Map<number, number>();
  private crypt: PdfCrypt | null = null;
  private encryptObj = -1;
  readonly trailer: PDict = new Map();
  readonly text: string;

  constructor(readonly bytes: Uint8Array) {
    this.text = latin(bytes);
    const re = /(\d+)\s+(\d+)\s+obj\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.text))) { this.offsets.set(Number(m[1]), m.index + m[0].length); this.gens.set(Number(m[1]), Number(m[2])); }
    for (let at = this.text.lastIndexOf('trailer'); at >= 0; at = this.text.lastIndexOf('trailer', at - 1)) {
      const v = new Lexer(bytes, at + 7).value();
      if (v instanceof Map) { for (const [k, x] of v) if (!this.trailer.has(k)) this.trailer.set(k, x); if (this.trailer.has('Root')) break; }
    }
  }

  async init(password?: string): Promise<void> {
    const keys = [...this.offsets.keys()];
    for (const n of keys) {
      const o = this.raw(n);
      if (o instanceof Stream && nameOf(o.dict.get('Type')) === 'XRef') for (const k of ['Root', 'Encrypt', 'ID']) if (!this.trailer.has(k) && o.dict.has(k)) this.trailer.set(k, o.dict.get(k) as Val);
    }
    if (this.trailer.has('Encrypt')) await this.unlock(password);
    for (const n of keys) {
      const o = this.raw(n);
      if (!(o instanceof Stream)) continue;
      if (nameOf(o.dict.get('Type')) !== 'ObjStm') continue;
      try {
        const data = await this.decode(o), count = num(o.dict.get('N')), first = num(o.dict.get('First')), lx = new Lexer(data, 0, false), pairs: number[] = [];
        for (let k = 0; k < count * 2; k++) pairs.push(num(lx.value()));
        for (let k = 0; k < count; k++) if (!this.offsets.has(pairs[k * 2])) this.packed.set(pairs[k * 2], new Lexer(data, first + pairs[k * 2 + 1]).value() ?? null);
      } catch { continue; }
    }
  }

  private async unlock(password: string | undefined): Promise<void> {
    const ev = this.trailer.get('Encrypt'), enc = this.dict(ev);
    if (ev instanceof Ref) this.encryptObj = ev.n;
    if (!enc) throw new Error('its encryption could not be read');
    const filter = nameOf(enc.get('Filter'));
    if (filter && filter !== 'Standard') throw new Error(`it uses the ${filter} security handler`);
    const v = this.n(enc.get('V')), r = this.n(enc.get('R'), 2), bytes = (x: Val | undefined): Uint8Array => { const s = this.get(x); return s instanceof Str ? s.b : new Uint8Array(); };
    const cf = this.dict(enc.get('CF')), method = (name: string): CryptMethod => {
      if (v < 4) return 'V2';
      const m = nameOf(this.get(this.dict(cf?.get(name))?.get('CFM')));
      return name === 'Identity' || !name ? 'None' : m === 'AESV2' || m === 'AESV3' || m === 'V2' ? m : 'None';
    };
    const ids = this.arr(this.trailer.get('ID')), idv = this.get(ids[0]);
    const params: CryptParams = {
      v, r, length: v === 1 ? 40 : v === 4 ? 128 : v >= 5 ? 256 : this.n(enc.get('Length'), 40), o: bytes(enc.get('O')), u: bytes(enc.get('U')), oe: bytes(enc.get('OE')), ue: bytes(enc.get('UE')), p: this.n(enc.get('P')),
      id: idv instanceof Str ? idv.b : new Uint8Array(), encryptMetadata: this.get(enc.get('EncryptMetadata')) !== false, stm: method(nameOf(this.get(enc.get('StmF'))) || 'Identity'), str: method(nameOf(this.get(enc.get('StrF'))) || 'Identity'),
    };
    const c = await openCrypt(params, password ?? '');
    if (!c) throw new PdfPasswordError(!!password);
    this.crypt = c;
    for (const [n, val] of [...this.cache]) {
      if (n === this.encryptObj || (val instanceof Stream && nameOf(val.dict.get('Type')) === 'XRef')) continue;
      this.cache.set(n, await this.shield(n, val));
    }
  }

  private async shield(n: number, v: Val, depth = 0): Promise<Val> {
    const c = this.crypt;
    if (!c || depth > 24) return v;
    if (v instanceof Str) return new Str(await c.string(n, this.gens.get(n) ?? 0, v.b));
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = await this.shield(n, v[i], depth + 1); return v; }
    const d = v instanceof Map ? v : v instanceof Stream ? v.dict : null;
    if (d) for (const [k, x] of [...d]) d.set(k, await this.shield(n, x, depth + 1));
    return v;
  }

  private raw(n: number): Val {
    if (this.cache.has(n)) return this.cache.get(n) as Val;
    const at = this.offsets.get(n);
    if (at === undefined) return this.packed.get(n) ?? null;
    this.cache.set(n, null);
    const lx = new Lexer(this.bytes, at), v = lx.value() ?? null;
    let out: Val = v;
    if (v instanceof Map) {
      lx.skip();
      if (latin(this.bytes.subarray(lx.i, lx.i + 6)) === 'stream') {
        let p = lx.i + 6;
        if (this.bytes[p] === 13) p++;
        if (this.bytes[p] === 10) p++;
        const lenV = v.get('Length'), len = lenV instanceof Ref ? num(this.raw(lenV.n), -1) : num(lenV, -1);
        let end = len >= 0 ? p + len : -1;
        if (end < 0 || !/^\s*endstream/.test(this.text.slice(end, end + 24))) {
          end = this.text.indexOf('endstream', p);
          if (end < 0) end = this.bytes.length;
          if (end > p && this.bytes[end - 1] === 10) end--;
          if (end > p && this.bytes[end - 1] === 13) end--;
        }
        const st = new Stream(v, this.bytes.subarray(p, Math.max(p, end)));
        st.num = n;
        st.gen = this.gens.get(n) ?? 0;
        out = st;
      }
    }
    this.cache.set(n, out);
    return out;
  }

  get(v: Val | undefined): Val { let x: Val = v ?? null; for (let k = 0; k < 16 && x instanceof Ref; k++) x = this.raw(x.n); return x; }
  dict(v: Val | undefined): PDict | null { const x = this.get(v); return x instanceof Map ? x : x instanceof Stream ? x.dict : null; }
  arr(v: Val | undefined): Val[] { const x = this.get(v); return Array.isArray(x) ? x : []; }
  nums(v: Val | undefined): number[] { return this.arr(v).map((x) => num(this.get(x))); }
  n(v: Val | undefined, d = 0): number { return num(this.get(v), d); }
  filters(s: Stream): string[] { const f = this.get(s.dict.get('Filter')); return (Array.isArray(f) ? f : f ? [f] : []).map((x) => nameOf(this.get(x))); }

  async decode(s: Stream): Promise<Uint8Array> {
    let data = s.raw;
    const fs = this.filters(s), pv = this.get(s.dict.get('DecodeParms')), ps = Array.isArray(pv) ? pv.map((x) => this.dict(x)) : [this.dict(pv)], type = nameOf(this.get(s.dict.get('Type')));
    if (this.crypt && !fs.includes('Crypt') && type !== 'XRef' && !(type === 'Metadata' && !this.crypt.encryptMetadata)) data = await this.crypt.stream(s.num, s.gen, data);
    for (let k = 0; k < fs.length; k++) {
      const f = fs[k];
      if (f === 'Crypt') continue;
      if (f === 'FlateDecode' || f === 'Fl') data = unpredict(await inflate(data), ps[k] ?? null);
      else if (f === 'ASCIIHexDecode' || f === 'AHx') { const t = latin(data).replace(/[^0-9a-fA-F]/g, ''), out = new Uint8Array(Math.floor(t.length / 2)); for (let i = 0; i < out.length; i++) out[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16); data = out; }
      else if (f === 'ASCII85Decode' || f === 'A85') data = ascii85(data);
      else if (f === 'DCTDecode' || f === 'DCT') return data;
      else throw new Error(`the ${f} filter`);
    }
    return data;
  }
}

interface FontInfo { family: string; style: string; widths: Map<number, number>; dw: number; two: boolean; uni: Map<number, string> | null; enc: Map<number, string> | null; type3: { matrix: Mat; procs: PDict; res: PDict | null; names: Map<number, string> } | null }
interface GS {
  ctm: Mat; fill: Paint; stroke: Paint; fa: number; sa: number; lw: number; cap: Cap; join: Join; miter: number; dash: number[]; phase: number; blend: BlendMode;
  fcs: Val[]; scs: Val[]; target: VNode[]; sm: { g: GroupNode; outer: VNode[] } | null; font: FontInfo | null; size: number; tc: number; tw: number; th: number; tl: number; rise: number; tr: number;
}

const BM: Record<string, BlendMode> = { Normal: 'normal', Multiply: 'multiply', Screen: 'screen', Overlay: 'overlay', Darken: 'darken', Lighten: 'lighten', ColorDodge: 'color_dodge', ColorBurn: 'color_burn', HardLight: 'hard_light', SoftLight: 'soft_light', Difference: 'difference', Exclusion: 'exclusion', Hue: 'hue', Saturation: 'saturation', Color: 'color', Luminosity: 'luminosity' };
const CAPS: Cap[] = ['butt', 'round', 'square'];
const JOINS: Join[] = ['miter', 'round', 'bevel'];
const WIN: Record<number, string> = { 128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡', 136: 'ˆ', 137: '‰', 138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•', 150: '–', 151: '\u2014', 152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ' };
const GLYPH: Record<string, string> = { space: ' ', exclam: '!', quotedbl: '"', numbersign: '#', dollar: '$', percent: '%', ampersand: '&', quotesingle: "'", quoteright: '’', quoteleft: '‘', parenleft: '(', parenright: ')', asterisk: '*', plus: '+', comma: ',', hyphen: '-', minus: '−', period: '.', slash: '/', zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', colon: ':', semicolon: ';', less: '<', equal: '=', greater: '>', question: '?', at: '@', bracketleft: '[', backslash: '\\', bracketright: ']', asciicircum: '^', underscore: '_', grave: '`', braceleft: '{', bar: '|', braceright: '}', asciitilde: '~', bullet: '•', endash: '–', emdash: '\u2014', quotedblleft: '“', quotedblright: '”', fi: 'fi', fl: 'fl', ff: 'ff', ffi: 'ffi', ffl: 'ffl', ellipsis: '…', copyright: '©', registered: '®', trademark: '™', degree: '°', dagger: '†', daggerdbl: '‡', section: '§', paragraph: '¶', periodcentered: '·', guillemotleft: '«', guillemotright: '»', nbspace: ' ' };

function glyphChar(name: string): string {
  if (GLYPH[name]) return GLYPH[name];
  if (/^[A-Za-z]$/.test(name)) return name;
  const u = /^uni([0-9A-Fa-f]{4})$/.exec(name) ?? /^u([0-9A-Fa-f]{4,6})$/.exec(name);
  if (u) return String.fromCodePoint(parseInt(u[1], 16));
  const base = name.split('.')[0];
  return base !== name ? glyphChar(base) : '';
}

let measure: OffscreenCanvasRenderingContext2D | null = null;
function emOf(css: string, ch: string): number {
  measure ??= new OffscreenCanvas(1, 1).getContext('2d');
  if (!measure) return ch === ' ' ? 0.25 : 0.5;
  measure.font = css;
  return measure.measureText(ch).width / 100;
}

function fitRun(n: TextNode, want: number, count: number): TextNode {
  const line = layoutText(n).lines[0];
  if (!line || count < 2 || want <= 0 || Math.abs(want - line.width) < want * 0.004) return n;
  const extra = (want - line.width) / count;
  return { ...n, spans: n.spans.map((s) => ({ ...s, style: { ...s.style, tracking: Math.round((s.style.tracking + (extra / s.style.size) * 1000) * 10) / 10 } })) };
}

const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const FONT_ALIAS: Record<string, string> = { times: 'Times New Roman', timesroman: 'Times New Roman', courier: 'Courier New', helvetica: 'Helvetica', arial: 'Arial', symbol: 'Times New Roman' };
const MONO_FONT = /Mono|Courier|Cursor|Typewriter|Code|Consol|^CMTT/i, SERIF_FONT = /Roman|Times|Serif|Termes|Schola|Pagella|Bonum|Garamond|Georgia|Minion|Book|Palat|Caslon|Baskerville|^CM(?!SS)/i;

class FontNames {
  private readonly known = new Map<string, string>();
  private readonly postscript = new Map<string, { family: string; style: string }>();
  readonly substituted = new Map<string, string>();
  constructor(list: string[], installed: InstalledFont[]) {
    for (const f of list) if (!this.known.has(squash(f))) this.known.set(squash(f), f);
    for (const f of installed) if (f.postscript) this.postscript.set(squash(f.postscript), { family: f.family, style: f.style });
  }

  resolve(base: string): { family: string; style: string } {
    const raw = base.replace(/^[A-Z]{6}\+/, ''), exact = this.postscript.get(squash(raw));
    if (exact) return exact;
    const [famPart, stylePart = ''] = raw.split(/[-,]/);
    const s = `${stylePart} ${famPart}`;
    const weight = /Black|Heavy/i.test(s) ? 'Black' : /Semi ?bold|Demi/i.test(s) ? 'Semibold' : /Bold/i.test(s) ? 'Bold' : /Medium/i.test(s) ? 'Medium' : /Light/i.test(s) ? 'Light' : '';
    const italic = /Ital|Obli/i.test(s), style = weight && italic ? `${weight} Italic` : weight || (italic ? 'Italic' : 'Regular');
    const core = famPart.replace(/(PSMT|PS|MT)$/, '').replace(/(Bold|Italic|Oblique|Black|Light|Medium|Semibold|Regular)+$/i, '') || 'Helvetica';
    const key = squash(core), alias = FONT_ALIAS[key];
    const found = this.known.get(alias ? squash(alias) : key) ?? this.known.get(key.replace(/^lm/, 'latinmodern').replace(/\d+$/, '')) ?? this.known.get(key.replace(/\d+$/, ''));
    if (found) return { family: found, style };
    const fallback = MONO_FONT.test(core) ? 'Courier New' : SERIF_FONT.test(core) ? 'Times New Roman' : 'Helvetica';
    this.substituted.set(core.replace(/([a-z])([A-Z][a-z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').replace(/([A-Za-z])(\d)/, '$1 $2'), fallback);
    return { family: fallback, style };
  }
}

export interface PdfImport { doc: Doc; assets: Map<string, Blob>; pages: number; skipped: string[]; fonts: Array<[string, string]> }

export async function readPdfVector(data: ArrayBuffer, title: string, password?: string): Promise<PdfImport> {
  const pdf = new PdfFile(new Uint8Array(data));
  await pdf.init(password);
  const catalog = pdf.dict(pdf.trailer.get('Root')) ?? findCatalog(pdf);
  if (!catalog) throw new Error('no page tree was found in it');
  const pages: Array<{ page: PDict; res: PDict | null; box: number[] }> = [];
  const walk = (node: PDict | null, res: PDict | null, box: number[] | null, depth: number): void => {
    if (!node || depth > 32) return;
    const r = pdf.dict(node.get('Resources')) ?? res, cb = pdf.nums(node.get('CropBox')), mb = pdf.nums(node.get('MediaBox')), b = cb.length === 4 ? cb : mb.length === 4 ? mb : box;
    if (nameOf(node.get('Type')) === 'Page' || (!node.has('Kids') && node.has('Contents'))) { pages.push({ page: node, res: r, box: b ?? [0, 0, 612, 792] }); return; }
    for (const k of pdf.arr(node.get('Kids'))) walk(pdf.dict(k), r, b, depth + 1);
  };
  walk(pdf.dict(catalog.get('Pages')), null, null, 0);
  if (!pages.length) throw new Error('it has no pages');
  const doc = newDoc(612, 792, { title });
  doc.artboards = [];
  const layer = makeLayer('Layer 1', 0), assets = new Map<string, Blob>(), images: Record<string, ImageAsset> = {}, skipped = new Set<string>(), patterns: PatternDef[] = [];
  const installed = await systemFonts().catch((): InstalledFont[] => []);
  const names = new FontNames(families(), installed);
  if (pages.length > 200) skipped.add(`pages 201 to ${pages.length}`);
  let x0 = 0;
  for (const [pi, pg] of pages.slice(0, 200).entries()) {
    const [bx0, by0, bx1, by1] = pg.box, w = Math.abs(bx1 - bx0), h = Math.abs(by1 - by0), left = Math.min(bx0, bx1), top = Math.max(by0, by1);
    const rot = ((pdf.n(pg.page.get('Rotate')) % 360) + 360) % 360, side = rot === 90 || rot === 270;
    const aw = side ? h : w, ah = side ? w : h;
    const flip: Mat = [1, 0, 0, -1, -left, top], R: Mat = rot === 90 ? [0, 1, -1, 0, h, 0] : rot === 180 ? [-1, 0, 0, -1, w, h] : rot === 270 ? [0, -1, 1, 0, 0, w] : IDENTITY;
    const P = mul([1, 0, 0, 1, x0, 0], mul(R, flip));
    doc.artboards.push({ id: newId('a'), name: `Page ${pi + 1}`, x: x0, y: 0, w: aw, h: ah, bg: null });
    const group: GroupNode = { id: newId('g'), kind: 'group', clip: false, children: [], opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, name: `Page ${pi + 1}` };
    const painter = new Painter(pdf, assets, images, skipped, names);
    try { await painter.run(await contentsOf(pdf, pg.page), pg.res, P, group.children, 0); } catch (err) { skipped.add(err instanceof Error ? err.message : String(err)); }
    painter.finish();
    patterns.push(...painter.patterns);
    group.children = prune(group.children);
    if (group.children.length) layer.children.push(group);
    x0 += aw + 40;
  }
  doc.layers = [layer];
  doc.images = images;
  doc.patterns = patterns;
  return { doc, assets, pages: pages.length, skipped: [...skipped], fonts: [...names.substituted] };
}

function prune(list: VNode[]): VNode[] {
  const out: VNode[] = [];
  for (const n of list) {
    if (n.kind !== 'group') { out.push(n); continue; }
    const kids = prune(n.children);
    if (!kids.length || (n.clip && kids.length < 2)) continue;
    out.push({ ...n, children: kids });
  }
  return out;
}

function freshIds(n: VNode): VNode {
  const c = { ...n, id: newId(n.kind === 'group' ? 'g' : n.kind === 'image' ? 'im' : n.kind === 'mesh' ? 'm' : 'p') } as VNode;
  if ('children' in c && Array.isArray(c.children)) (c as GroupNode).children = c.children.map(freshIds);
  return c;
}

function whiten(n: VNode): void {
  const white = solid(rgb(255, 255, 255));
  n.ap = { ...n.ap, items: n.ap.items.map((it) => (it.paint.type === 'none' ? it : { ...it, paint: white })) };
  if (n.kind === 'text') n.spans = n.spans.map((s) => ({ ...s, style: { ...s.style, fill: s.style.fill.type === 'none' ? s.style.fill : white, stroke: s.style.stroke.type === 'none' ? s.style.stroke : white } }));
  if ('children' in n && Array.isArray(n.children)) n.children.forEach(whiten);
}

function findCatalog(pdf: PdfFile): PDict | null {
  const m = /(\d+)\s+\d+\s+obj\s*<<[^>]*\/Type\s*\/Catalog/.exec(pdf.text);
  return m ? pdf.dict(new Ref(Number(m[1]), 0)) : null;
}

async function contentsOf(pdf: PdfFile, page: PDict): Promise<Uint8Array> {
  const c = pdf.get(page.get('Contents')), list = Array.isArray(c) ? c.map((x) => pdf.get(x)) : [c];
  const parts: Uint8Array[] = [];
  for (const s of list) if (s instanceof Stream) { try { parts.push(await pdf.decode(s)); } catch { continue; } }
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length + 1, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; out[o++] = 10; }
  return out;
}

class Painter {
  private readonly clips: Array<{ g: GroupNode; clip: PathNode }> = [];
  private readonly fonts = new Map<PDict, FontInfo>();
  readonly patterns: PatternDef[] = [];
  private readonly meshOf = new WeakMap<Paint, VNode[]>();
  private readonly tiles = new Map<string, string>();
  private readonly meshCache = new Map<PDict, Map<string, VNode[]>>();
  private readonly building = new Set<PDict>();

  constructor(private readonly pdf: PdfFile, private readonly assets: Map<string, Blob>, private readonly images: Record<string, ImageAsset>, private readonly skipped: Set<string>, private readonly names: FontNames) {}

  finish(): void { for (const c of this.clips) c.g.children.push(c.clip); }

  private async softMask(sm: PDict, ctm: Mat, res: PDict | null, depth: number): Promise<GroupNode | null> {
    const pdf = this.pdf, xo = pdf.get(sm.get('G'));
    if (!(xo instanceof Stream)) return null;
    const alpha = nameOf(pdf.get(sm.get('S'))) === 'Alpha', m = mul(ctm, mat6(pdf.nums(xo.dict.get('Matrix'))) ?? IDENTITY), bb = pdf.nums(xo.dict.get('BBox')), kids: VNode[] = [];
    const rect = (pts: Array<{ x: number; y: number }>, color: Paint | null): PathNode => ({ id: newId('p'), kind: 'path', d: [{ closed: true, pts: pts.map(corner) }], rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: color ? [fill(color)] : [], effects: [] } });
    try { await this.run(await pdf.decode(xo), pdf.dict(xo.dict.get('Resources')) ?? res, m, kids, depth + 1); } catch (err) { this.skipped.add(err instanceof Error ? err.message : String(err)); }
    let body: VNode[] = kids;
    if (bb.length === 4) body = [{ id: newId('g'), kind: 'group', clip: true, children: [...kids, rect([apply(m, bb[0], bb[1]), apply(m, bb[2], bb[1]), apply(m, bb[2], bb[3]), apply(m, bb[0], bb[3])], null)], opacity: 1, blend: 'normal', ap: { items: [], effects: [] } }];
    if (alpha) body.forEach(whiten);
    else {
      const bc = pdf.nums(sm.get('BC')), csv = pdf.get(pdf.dict(xo.dict.get('Group'))?.get('CS'));
      const cs = Array.isArray(csv) ? csv.map((y) => pdf.get(y)) : csv instanceof Name ? this.space(csv, res) : [new Name(bc.length === 4 ? 'DeviceCMYK' : bc.length === 3 ? 'DeviceRGB' : 'DeviceGray')];
      const col = bc.length ? this.toColor(cs, bc) : null;
      if (col) { const [r, g, b] = toRgbLocal(col); if (0.3 * r + 0.59 * g + 0.11 * b > 1) body = [rect([{ x: -2e4, y: -2e4 }, { x: 2e4, y: -2e4 }, { x: 2e4, y: 2e4 }, { x: -2e4, y: 2e4 }], solid(col)), ...body]; }
    }
    let invert = false;
    const tr = pdf.get(sm.get('TR')), fd = tr instanceof Name ? null : pdf.dict(tr), lo = fd ? evalFn(pdf, fd, [0]) : null, hi = fd ? evalFn(pdf, fd, [1]) : null;
    if (lo && hi) {
      if (lo[0] > 0.5 && hi[0] < 0.5) invert = true;
      else if (Math.abs(lo[0]) > 0.05 || Math.abs(hi[0] - 1) > 0.05) this.skipped.add('soft mask transfer curves');
    }
    const art: GroupNode = { id: newId('g'), kind: 'group', clip: false, children: body, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
    return { id: newId('g'), kind: 'group', clip: false, children: [], opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, mask: { art, clip: false, invert, disabled: false, linked: true } };
  }

  async run(content: Uint8Array, res: PDict | null, base: Mat, target: VNode[], depth: number, inherit?: Partial<GS>): Promise<void> {
    if (depth > 12) return;
    const pdf = this.pdf, lx = new Lexer(content, 0, false);
    await this.prepareFonts(res);
    let gs: GS = { ctm: base, fill: solid(gray(100)), stroke: solid(gray(100)), fa: 1, sa: 1, lw: 1, cap: 'butt', join: 'miter', miter: 10, dash: [], phase: 0, blend: 'normal', fcs: [new Name('DeviceGray')], scs: [new Name('DeviceGray')], sm: null, font: null, size: 12, tc: 0, tw: 0, th: 1, tl: 0, rise: 0, tr: 0, ...inherit, target };
    const stack: GS[] = [];
    let path: SubPath[] = [], cur: Anchor[] | null = null, clip: 'nonzero' | 'evenodd' | null = null, tm: Mat = IDENTITY, tlm: Mat = IDENTITY;
    const ops: Val[] = [];
    const P = (x: number, y: number): { x: number; y: number } => apply(gs.ctm, x, y);
    const flush = (closed: boolean): void => { if (cur && cur.length) path.push({ closed, pts: cur }); cur = null; };
    const scale = (): number => Math.sqrt(Math.abs(gs.ctm[0] * gs.ctm[3] - gs.ctm[1] * gs.ctm[2])) || 1;
    const paint = (doFill: boolean, doStroke: boolean, rule: 'nonzero' | 'evenodd'): void => {
      flush(false);
      const d: PathData = path;
      if (d.length && (doFill || doStroke)) {
        const items = [], mesh = doFill ? this.meshOf.get(gs.fill) : undefined;
        if (mesh) gs.target.push({ id: newId('g'), kind: 'group', clip: true, children: [...mesh.map(freshIds), { id: newId('p'), kind: 'path', d, rule, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } } as PathNode], opacity: gs.fa, blend: gs.blend, ap: { items: [], effects: [] } } as GroupNode);
        if (doFill && !mesh && gs.fill.type !== 'none') items.push({ ...fill(gs.fill), opacity: gs.fa });
        if (doStroke && gs.stroke.type !== 'none') { const k = scale(); items.push({ ...strokeItem(gs.stroke, Math.max(0.05, gs.lw * k), { cap: gs.cap, join: gs.join, miter: gs.miter, dash: gs.dash.map((v) => v * k), dashOffset: gs.phase * k }), opacity: gs.sa }); }
        if (items.length) gs.target.push({ id: newId('p'), kind: 'path', d, rule, opacity: 1, blend: gs.blend, ap: { items, effects: [] } } as PathNode);
      }
      if (clip && d.length) {
        const c: PathNode = { id: newId('p'), kind: 'path', d, rule: clip, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
        const g: GroupNode = { id: newId('g'), kind: 'group', clip: true, children: [], opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
        gs.target.push(g);
        this.clips.push({ g, clip: c });
        gs = { ...gs, target: g.children };
      }
      clip = null;
      path = [];
    };
    for (;;) {
      const v = lx.value();
      if (v === undefined) break;
      if (!(v instanceof Op)) { ops.push(v); continue; }
      const op = v.v, a = ops.splice(0), n = (k: number): number => num(a[k]);
      switch (op) {
        case 'q': stack.push(gs); gs = { ...gs }; break;
        case 'Q': if (stack.length) gs = stack.pop() as GS; break;
        case 'cm': gs = { ...gs, ctm: mul(gs.ctm, [n(0), n(1), n(2), n(3), n(4), n(5)]) }; break;
        case 'w': gs.lw = n(0); break;
        case 'J': gs.cap = CAPS[n(0)] ?? 'butt'; break;
        case 'j': gs.join = JOINS[n(0)] ?? 'miter'; break;
        case 'M': gs.miter = n(0); break;
        case 'd': gs.dash = (Array.isArray(a[0]) ? a[0] : []).map((x) => num(x)); gs.phase = n(1); break;
        case 'gs': {
          const eg = pdf.dict(pdf.dict(res?.get('ExtGState'))?.get(nameOf(a[0])));
          if (!eg) break;
          if (eg.has('ca')) gs.fa = pdf.n(eg.get('ca'), 1);
          if (eg.has('CA')) gs.sa = pdf.n(eg.get('CA'), 1);
          if (eg.has('LW')) gs.lw = pdf.n(eg.get('LW'), 1);
          const bm = pdf.get(eg.get('BM')), bmn = Array.isArray(bm) ? nameOf(pdf.get(bm[0])) : nameOf(bm);
          if (bmn) gs.blend = BM[bmn] ?? 'normal';
          if (eg.has('SMask')) {
            const sm = pdf.get(eg.get('SMask'));
            if (gs.sm && gs.target === gs.sm.g.children) gs.target = gs.sm.outer;
            gs.sm = null;
            if (sm instanceof Map) {
              const g = await this.softMask(sm, gs.ctm, res, depth);
              if (g) { gs.target.push(g); gs.sm = { g, outer: gs.target }; gs.target = g.children; }
            }
          }
          break;
        }
        case 'm': flush(false); cur = [corner(P(n(0), n(1)))]; break;
        case 'l': if (cur) cur.push(corner(P(n(0), n(1)))); else cur = [corner(P(n(0), n(1)))]; break;
        case 'c': case 'v': case 'y': {
          if (!cur || !cur.length) break;
          const last = cur[cur.length - 1];
          const e = op === 'c' ? P(n(4), n(5)) : P(n(2), n(3));
          const c1 = op === 'v' ? { x: last.x, y: last.y } : P(n(0), n(1));
          const c2 = op === 'c' ? P(n(2), n(3)) : op === 'v' ? P(n(0), n(1)) : e;
          last.ox = c1.x; last.oy = c1.y;
          cur.push({ x: e.x, y: e.y, ix: c2.x, iy: c2.y, ox: e.x, oy: e.y });
          break;
        }
        case 'h': {
          if (cur && cur.length > 2) { const first = cur[0], last = cur[cur.length - 1]; if (Math.abs(last.x - first.x) < 1e-6 && Math.abs(last.y - first.y) < 1e-6) { first.ix = last.ix; first.iy = last.iy; cur.pop(); } }
          flush(true);
          break;
        }
        case 're': { flush(false); const x = n(0), y = n(1), w = n(2), h = n(3); path.push({ closed: true, pts: [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)].map(corner) }); break; }
        case 'f': case 'F': paint(true, false, 'nonzero'); break;
        case 'f*': paint(true, false, 'evenodd'); break;
        case 'S': paint(false, true, 'nonzero'); break;
        case 's': flush(true); paint(false, true, 'nonzero'); break;
        case 'B': paint(true, true, 'nonzero'); break;
        case 'B*': paint(true, true, 'evenodd'); break;
        case 'b': flush(true); paint(true, true, 'nonzero'); break;
        case 'b*': flush(true); paint(true, true, 'evenodd'); break;
        case 'n': paint(false, false, 'nonzero'); break;
        case 'W': clip = 'nonzero'; break;
        case 'W*': clip = 'evenodd'; break;
        case 'g': gs.fcs = [new Name('DeviceGray')]; gs.fill = this.color(gs.fcs, [n(0)]); break;
        case 'G': gs.scs = [new Name('DeviceGray')]; gs.stroke = this.color(gs.scs, [n(0)]); break;
        case 'rg': gs.fcs = [new Name('DeviceRGB')]; gs.fill = this.color(gs.fcs, [n(0), n(1), n(2)]); break;
        case 'RG': gs.scs = [new Name('DeviceRGB')]; gs.stroke = this.color(gs.scs, [n(0), n(1), n(2)]); break;
        case 'k': gs.fcs = [new Name('DeviceCMYK')]; gs.fill = this.color(gs.fcs, [n(0), n(1), n(2), n(3)]); break;
        case 'K': gs.scs = [new Name('DeviceCMYK')]; gs.stroke = this.color(gs.scs, [n(0), n(1), n(2), n(3)]); break;
        case 'cs': gs.fcs = await this.unpackLut(this.space(a[0], res)); gs.fill = this.color(gs.fcs, this.initial(gs.fcs)); break;
        case 'CS': gs.scs = await this.unpackLut(this.space(a[0], res)); gs.stroke = this.color(gs.scs, this.initial(gs.scs)); break;
        case 'sc': case 'scn': gs.fill = a[a.length - 1] instanceof Name ? await this.pattern(nameOf(a[a.length - 1]), res, base, gs.fcs, a.filter((x): x is number => typeof x === 'number'), depth) : this.color(gs.fcs, a.filter((x): x is number => typeof x === 'number')); break;
        case 'SC': case 'SCN': gs.stroke = a[a.length - 1] instanceof Name ? await this.pattern(nameOf(a[a.length - 1]), res, base, gs.scs, a.filter((x): x is number => typeof x === 'number'), depth) : this.color(gs.scs, a.filter((x): x is number => typeof x === 'number')); break;
        case 'sh': {
          const sh = await this.shading(pdf.get(pdf.dict(res?.get('Shading'))?.get(nameOf(a[0]))), gs.ctm);
          if (sh && 'nodes' in sh) for (const k of sh.nodes) gs.target.push({ ...freshIds(k), opacity: gs.fa, blend: gs.blend } as VNode);
          else if (sh) gs.target.push({ id: newId('p'), kind: 'path', d: sh.d, rule: 'nonzero', opacity: 1, blend: gs.blend, ap: { items: [{ ...fill(sh.paint), opacity: gs.fa }], effects: [] } } as PathNode);
          break;
        }
        case 'Do': {
          const xo = pdf.get(pdf.dict(res?.get('XObject'))?.get(nameOf(a[0])));
          if (!(xo instanceof Stream)) break;
          const st = nameOf(xo.dict.get('Subtype'));
          if (st === 'Form') {
            const fm = mat6(pdf.nums(xo.dict.get('Matrix'))) ?? IDENTITY;
            const g: GroupNode = { id: newId('g'), kind: 'group', clip: false, children: [], opacity: 1, blend: gs.blend, ap: { items: [], effects: [] } };
            try { await this.run(await pdf.decode(xo), pdf.dict(xo.dict.get('Resources')) ?? res, mul(gs.ctm, fm), g.children, depth + 1, { fill: gs.fill, stroke: gs.stroke, fa: gs.fa, sa: gs.sa, fcs: gs.fcs, scs: gs.scs, lw: gs.lw }); } catch (err) { this.skipped.add(err instanceof Error ? err.message : String(err)); }
            if (g.children.length === 1 && gs.blend === 'normal') gs.target.push(g.children[0]); else if (g.children.length) gs.target.push(g);
          } else if (st === 'Image') { const img = await this.image(xo, gs.ctm); if (img) { img.opacity = gs.fa; img.blend = gs.blend; gs.target.push(img); } }
          break;
        }
        case 'BI': { let k = lx.i; while (k < content.length - 1 && !(content[k] === 69 && content[k + 1] === 73 && WS.has(content[k - 1]) && (k + 2 >= content.length || WS.has(content[k + 2])))) k++; lx.i = k + 2; this.skipped.add('inline images'); break; }
        case 'BT': tm = IDENTITY; tlm = IDENTITY; break;
        case 'Tf': gs.font = this.font(pdf.dict(res?.get('Font'))?.get(nameOf(a[0])), res); gs.size = n(1); break;
        case 'Tc': gs.tc = n(0); break;
        case 'Tw': gs.tw = n(0); break;
        case 'Tz': gs.th = n(0) / 100; break;
        case 'TL': gs.tl = n(0); break;
        case 'Ts': gs.rise = n(0); break;
        case 'Tr': gs.tr = n(0); break;
        case 'Td': tlm = mul(tlm, [1, 0, 0, 1, n(0), n(1)]); tm = tlm; break;
        case 'TD': gs.tl = -n(1); tlm = mul(tlm, [1, 0, 0, 1, n(0), n(1)]); tm = tlm; break;
        case 'Tm': tlm = [n(0), n(1), n(2), n(3), n(4), n(5)]; tm = tlm; break;
        case 'T*': tlm = mul(tlm, [1, 0, 0, 1, 0, -gs.tl]); tm = tlm; break;
        case 'Tj': case "'": case '"': case 'TJ': {
          if (op === "'" || op === '"') { if (op === '"') { gs.tw = n(0); gs.tc = n(1); } tlm = mul(tlm, [1, 0, 0, 1, 0, -gs.tl]); tm = tlm; }
          tm = await this.show(op === 'TJ' ? (Array.isArray(a[0]) ? a[0] : []) : [a[a.length - 1]], gs, tm, depth);
          break;
        }
        default: break;
      }
    }
  }

  private async show(items: Val[], gs: GS, tm: Mat, depth: number): Promise<Mat> {
    const f = gs.font, size = gs.size;
    if (!f) return tm;
    const t3 = f.type3;
    let text = '', adv = 0, ink = 0;
    const start = tm, glyphs: Array<{ code: number; at: number }> = [], gaps = new Map<number, number>();
    const css = !t3 && !f.two && !f.widths.size ? cssFont({ ...DEFAULT_CHAR, font: f.family, style: f.style }, 100) : '';
    for (const it of items) {
      if (typeof it === 'number') { adv += (-it / 1000) * size * gs.th; if (-it / 1000 > 0.18 && text && !text.endsWith(' ')) { gaps.set(text.length, -it / 1000); text += ' '; } continue; }
      if (!(it instanceof Str)) continue;
      const b = it.b;
      for (let i = 0; i < b.length; i += f.two ? 2 : 1) {
        const code = f.two ? (b[i] << 8) | (b[i + 1] ?? 0) : b[i];
        const ch = f.uni?.get(code) ?? f.enc?.get(code) ?? (f.two ? '' : code >= 32 && code < 127 ? String.fromCharCode(code) : WIN[code] ?? (code >= 160 ? String.fromCharCode(code) : ''));
        text += ch;
        if (t3) glyphs.push({ code, at: adv });
        const w = t3 ? (f.widths.get(code) ?? 0) * t3.matrix[0] : css ? emOf(css, ch || ' ') : (f.widths.get(code) ?? f.dw) / 1000;
        adv += (w * size + gs.tc + (code === 32 && !f.two ? gs.tw : 0)) * gs.th;
        if (ch.trim()) ink = adv;
      }
    }
    const next = mul(tm, [1, 0, 0, 1, adv, 0]);
    if (gs.tr === 3 || gs.tr === 7) return next;
    if (t3) {
      for (const g of glyphs) {
        const name = t3.names.get(g.code), proc = name ? this.pdf.get(t3.procs.get(name)) : null;
        if (!(proc instanceof Stream)) continue;
        const gm = mul(gs.ctm, mul(start, mul([size * gs.th, 0, 0, size, g.at, gs.rise], t3.matrix)));
        try { await this.run(await this.pdf.decode(proc), t3.res, gm, gs.target, depth + 1, { fill: gs.fill, stroke: gs.stroke, fa: gs.fa, sa: gs.sa, fcs: gs.fcs, scs: gs.scs }); } catch { continue; }
      }
      return next;
    }
    if (!text.trim()) return next;
    const xf = mul(gs.ctm, mul(start, [gs.th, 0, 0, -1, 0, gs.rise]));
    const filled = gs.tr === 1 || gs.tr === 5 ? NONE : gs.fill, stroked = gs.tr === 1 || gs.tr === 2 || gs.tr === 5 || gs.tr === 6 ? gs.stroke : NONE;
    const base: CharStyle = { ...DEFAULT_CHAR, font: f.family, style: f.style, size, fill: filled, stroke: stroked, strokeWidth: stroked.type === 'none' ? 0 : gs.lw, tracking: gs.tc ? Math.round((gs.tc / Math.max(0.01, size)) * 1000) : 0 };
    const body = text.replace(/\s+$/, ''), space = emOf(cssFont(base, 100), ' '), spans: Span[] = [];
    let from = 0;
    for (const [at, em] of gaps) {
      if (at >= body.length) break;
      if (at > from) spans.push({ text: body.slice(from, at), style: base });
      spans.push({ text: ' ', style: { ...base, tracking: Math.round((em - space) * 1000) } });
      from = at + 1;
    }
    if (from < body.length) spans.push({ text: body.slice(from), style: base });
    const node: TextNode = { id: newId('t'), kind: 'text', mode: 'point', xf, opacity: gs.fa, blend: gs.blend, ap: { items: [], effects: [] }, para: { ...DEFAULT_PARA }, spans };
    gs.target.push(fitRun(node, ink / gs.th, body.length));
    return next;
  }

  private font(ref: Val | undefined, res: PDict | null): FontInfo | null {
    const pdf = this.pdf, d = pdf.dict(ref);
    if (!d) return null;
    const hit = this.fonts.get(d);
    if (hit) return hit;
    const sub = nameOf(d.get('Subtype')), two = sub === 'Type0', desc = two ? pdf.dict(pdf.arr(d.get('DescendantFonts'))[0]) : null;
    const { family, style } = this.names.resolve(nameOf(d.get('BaseFont')) || nameOf(desc?.get('BaseFont')) || 'Helvetica');
    const widths = new Map<number, number>();
    let dw = 500;
    if (two && desc) {
      dw = pdf.n(desc.get('DW'), 1000);
      const w = pdf.arr(desc.get('W'));
      for (let i = 0; i < w.length;) {
        const a = pdf.n(w[i]), b = pdf.get(w[i + 1]);
        if (Array.isArray(b)) { b.forEach((x, k) => widths.set(a + k, pdf.n(x))); i += 2; }
        else { const e = pdf.n(b), v = pdf.n(w[i + 2]); for (let c = a; c <= e && c - a < 65536; c++) widths.set(c, v); i += 3; }
      }
    } else {
      const fc = pdf.n(d.get('FirstChar')), ws = pdf.arr(d.get('Widths'));
      ws.forEach((x, k) => widths.set(fc + k, pdf.n(x)));
      dw = ws.length ? 500 : 600;
    }
    let enc: Map<number, string> | null = null;
    const names = new Map<number, string>(), e = pdf.get(d.get('Encoding'));
    if (e instanceof Map) {
      enc = new Map();
      let code = 0;
      for (const x of pdf.arr(e.get('Differences'))) { const v = pdf.get(x); if (typeof v === 'number') code = v; else if (v instanceof Name) { names.set(code, v.v); const ch = glyphChar(v.v); if (ch) enc.set(code, ch); code++; } }
    }
    const t3 = sub === 'Type3' ? { matrix: mat6(pdf.nums(d.get('FontMatrix'))) ?? ([0.001, 0, 0, 0.001, 0, 0] as Mat), procs: pdf.dict(d.get('CharProcs')) ?? new Map(), res: pdf.dict(d.get('Resources')) ?? res, names } : null;
    const info: FontInfo = { family, style, widths, dw, two, uni: null, enc, type3: t3 };
    this.fonts.set(d, info);
    return info;
  }

  private async prepareFonts(res: PDict | null): Promise<void> {
    const fonts = this.pdf.dict(res?.get('Font'));
    if (!fonts) return;
    for (const v of fonts.values()) {
      const d = this.pdf.dict(v), f = this.font(v, res), tu = d ? this.pdf.get(d.get('ToUnicode')) : null;
      if (f && !f.uni && tu instanceof Stream) { try { f.uni = parseCMap(latin(await this.pdf.decode(tu))); } catch { f.uni = null; } }
    }
  }

  private space(v: Val | undefined, res: PDict | null): Val[] {
    const n = nameOf(v);
    if (['DeviceGray', 'DeviceRGB', 'DeviceCMYK', 'Pattern', 'G', 'RGB', 'CMYK'].includes(n)) return [new Name(n)];
    const cs = this.pdf.get(this.pdf.dict(res?.get('ColorSpace'))?.get(n));
    return Array.isArray(cs) ? cs.map((x) => this.pdf.get(x)) : cs instanceof Name ? [cs] : [new Name('DeviceGray')];
  }

  private async unpackLut(cs: Val[]): Promise<Val[]> {
    const lut = nameOf(cs[0]) === 'Indexed' ? this.pdf.get(cs[3]) : null;
    return lut instanceof Stream ? [...cs.slice(0, 3), new Str(await this.pdf.decode(lut))] : cs;
  }

  private initial(cs: Val[]): number[] { const k = nameOf(cs[0]); return k === 'DeviceCMYK' || k === 'CMYK' ? [0, 0, 0, 1] : k === 'DeviceRGB' || k === 'RGB' ? [0, 0, 0] : k === 'Separation' || k === 'DeviceN' ? [1] : [0]; }

  private color(cs: Val[], v: number[]): Paint { const c = this.toColor(cs, v); return solid(c ?? gray(100)); }

  private toColor(cs: Val[], v: number[]): Color | null {
    const k = nameOf(cs[0]), pdf = this.pdf, cl = (x: number): number => Math.max(0, Math.min(1, x));
    if (k === 'DeviceGray' || k === 'G' || k === 'CalGray') return gray(Math.round((1 - cl(v[0] ?? 0)) * 1000) / 10);
    if (k === 'DeviceRGB' || k === 'RGB' || k === 'CalRGB') return rgb(Math.round(cl(v[0] ?? 0) * 255), Math.round(cl(v[1] ?? 0) * 255), Math.round(cl(v[2] ?? 0) * 255));
    if (k === 'DeviceCMYK' || k === 'CMYK') return cmyk(Math.round(cl(v[0] ?? 0) * 1000) / 10, Math.round(cl(v[1] ?? 0) * 1000) / 10, Math.round(cl(v[2] ?? 0) * 1000) / 10, Math.round(cl(v[3] ?? 1) * 1000) / 10);
    if (k === 'Lab') { const L = v[0] ?? 50, a = v[1] ?? 0, b = v[2] ?? 0, fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200, f = (t: number): number => (t > 6 / 29 ? t ** 3 : 3 * (6 / 29) ** 2 * (t - 4 / 29)), X = 0.9505 * f(fx), Y = f(fy), Z = 1.089 * f(fz), g = (c: number): number => Math.round(255 * cl(c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)); return rgb(g(3.2406 * X - 1.5372 * Y - 0.4986 * Z), g(-0.9689 * X + 1.8758 * Y + 0.0415 * Z), g(0.0557 * X - 0.204 * Y + 1.057 * Z)); }
    if (k === 'ICCBased') { const s = pdf.get(cs[1]), nc = s instanceof Stream ? pdf.n(s.dict.get('N'), v.length) : v.length; return this.toColor([new Name(nc === 1 ? 'DeviceGray' : nc === 4 ? 'DeviceCMYK' : 'DeviceRGB')], v); }
    if (k === 'Indexed') {
      const base = pdf.get(cs[1]), baseCs = Array.isArray(base) ? base.map((x) => pdf.get(x)) : [base], hival = pdf.n(cs[2]), lut = pdf.get(cs[3]);
      const bytes = lut instanceof Str ? lut.b : lut instanceof Stream ? lut.raw : new Uint8Array();
      const bk = nameOf(baseCs[0]), nc = bk === 'DeviceCMYK' ? 4 : bk === 'DeviceGray' ? 1 : bk === 'ICCBased' ? ((s) => (s instanceof Stream ? pdf.n(s.dict.get('N'), 3) : 3))(pdf.get(baseCs[1])) : 3, i = Math.max(0, Math.min(hival, Math.round(v[0] ?? 0)));
      return this.toColor(baseCs, Array.from(bytes.subarray(i * nc, i * nc + nc), (b) => b / 255));
    }
    if (k === 'Separation' || k === 'DeviceN') {
      const alt = pdf.get(cs[2]), altCs = Array.isArray(alt) ? alt.map((x) => pdf.get(x)) : [alt], fn = pdf.dict(cs[3]), out = fn ? evalFn(pdf, fn, v) : null;
      return out ? this.toColor(altCs, out) : gray(Math.round(cl(v[0] ?? 1) * 1000) / 10);
    }
    return null;
  }

  private async pattern(name: string, res: PDict | null, base: Mat, space: Val[], comps: number[], depth: number): Promise<Paint> {
    const pdf = this.pdf, p = pdf.get(pdf.dict(res?.get('Pattern'))?.get(name)), d = p instanceof Stream ? p.dict : p instanceof Map ? p : null;
    const grey = (): Paint => solid(gray(50));
    if (!d) return grey();
    const xf = mul(base, mat6(pdf.nums(d.get('Matrix'))) ?? IDENTITY), type = pdf.n(d.get('PatternType'));
    if (type === 2) {
      const sh = await this.shading(pdf.get(d.get('Shading')), xf);
      if (sh && 'paint' in sh) return sh.paint;
      const out = grey();
      if (sh) this.meshOf.set(out, sh.nodes);
      return out;
    }
    if (type === 1 && p instanceof Stream) return this.tiling(p, xf, space, comps, depth);
    this.skipped.add('patterns of an unknown type');
    return grey();
  }

  private async tiling(st: Stream, xf: Mat, space: Val[], comps: number[], depth: number): Promise<Paint> {
    const pdf = this.pdf, d = st.dict, bb = pdf.nums(d.get('BBox')), uncoloured = pdf.n(d.get('PaintType'), 1) === 2, grey = (): Paint => solid(gray(50));
    const bw = Math.abs((bb[2] ?? 0) - (bb[0] ?? 0)), bh = Math.abs((bb[3] ?? 0) - (bb[1] ?? 0)), bx = Math.min(bb[0] ?? 0, bb[2] ?? 0), by = Math.min(bb[1] ?? 0, bb[3] ?? 0);
    if (!(bw > 0 && bh > 0)) return grey();
    let ink: Paint | null = null;
    if (uncoloured) {
      const under = pdf.get(space[1]), cs = Array.isArray(under) ? under.map((y) => pdf.get(y)) : [under ?? new Name('DeviceGray')];
      ink = this.color(cs, comps);
    }
    const tag = `${st.num}:${ink ? JSON.stringify(ink) : ''}`, known = this.tiles.get(tag);
    if (known) return { type: 'pattern', pattern: known, xf };
    if (this.building.has(d)) { this.skipped.add('a pattern that paints itself'); return grey(); }
    this.building.add(d);
    const kids: VNode[] = [];
    try { await this.run(await pdf.decode(st), pdf.dict(d.get('Resources')), IDENTITY, kids, depth + 1, ink ? { fill: ink, stroke: ink } : undefined); } catch (err) { this.skipped.add(err instanceof Error ? err.message : String(err)); } finally { this.building.delete(d); }
    const xs = Math.abs(pdf.n(d.get('XStep'), bw)) || bw, ys = Math.abs(pdf.n(d.get('YStep'), bh)) || bh;
    const clip: PathNode = { id: newId('p'), kind: 'path', d: [{ closed: true, pts: [{ x: bx, y: by }, { x: bx + bw, y: by }, { x: bx + bw, y: by + bh }, { x: bx, y: by + bh }].map(corner) }], rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
    const art: GroupNode = { id: newId('g'), kind: 'group', clip: true, children: [...kids, clip], opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
    const id = newId('pat');
    this.patterns.push({ id, name: `Pattern ${this.patterns.length + 1}`, tile: { x: bx, y: by, w: bw, h: bh }, art, type: 'grid', hs: xs - bw, vs: ys - bh });
    this.tiles.set(tag, id);
    return { type: 'pattern', pattern: id, xf };
  }

  private compCount(cs: Val[]): number {
    const k = nameOf(cs[0]), pdf = this.pdf;
    if (k === 'DeviceCMYK' || k === 'CMYK') return 4;
    if (k === 'DeviceRGB' || k === 'RGB' || k === 'CalRGB' || k === 'Lab') return 3;
    if (k === 'ICCBased') { const s = pdf.get(cs[1]); return s instanceof Stream ? pdf.n(s.dict.get('N'), 3) : 3; }
    if (k === 'DeviceN') return pdf.arr(cs[1]).length || 1;
    return 1;
  }

  private async meshShading(st: Stream, cs: Val[], type: 4 | 5 | 6 | 7, m: Mat): Promise<VNode[] | null> {
    const pdf = this.pdf, d = st.dict, tag = m.join(','), hit = this.meshCache.get(d)?.get(tag);
    if (hit) return hit;
    const fnv = pdf.get(d.get('Function')), fns = (Array.isArray(fnv) ? fnv : fnv ? [fnv] : []).map((x) => pdf.dict(x)).filter((x): x is PDict => !!x), nc = fns.length ? 1 : this.compCount(cs);
    const spec: MeshSpec = { type, bpCoord: pdf.n(d.get('BitsPerCoordinate'), 8), bpComp: pdf.n(d.get('BitsPerComponent'), 8), bpFlag: pdf.n(d.get('BitsPerFlag'), 8), decode: pdf.nums(d.get('Decode')), ncomp: nc, perRow: pdf.n(d.get('VerticesPerRow'), 0) };
    if (spec.decode.length < 4 + nc * 2 || !spec.bpCoord || !spec.bpComp) return null;
    const data = await pdf.decode(st), xf = (x: number, y: number): Pt => apply(m, x, y), t0 = spec.decode[4], t1 = spec.decode[5];
    const colorOf = (c: number[]): Color => {
      if (!fns.length) return this.toColor(cs, c) ?? gray(50);
      const out = fns.length === 1 ? evalFn(pdf, fns[0], [c[0]]) : fns.map((f) => (evalFn(pdf, f, [c[0]]) ?? [0])[0]);
      return this.toColor(cs, out ?? [0]) ?? gray(50);
    };
    const rgbOf = (c: number[]): number[] => toRgbLocal(colorOf(c));
    const lut = fns.length ? Array.from({ length: 257 }, (_, i) => toRgbLocal(colorOf([t0 + ((t1 - t0) * i) / 256]))) : null;
    const finish = (c: number[]): [number, number, number] => { if (lut) return lut[Math.max(0, Math.min(256, Math.round(((c[0] - t0) / (t1 - t0 || 1)) * 256)))]; return [c[0], c[1], c[2]]; };
    const prep = (v: RV): RV => (lut ? v : { x: v.x, y: v.y, c: rgbOf(v.c) });
    let nodes: VNode[] | null = null, tris: Array<[RV, RV, RV]> = [];
    const mesh = (g: { rows: number; cols: number; points: MeshNode['points'] }): VNode[] => [{ id: newId('m'), kind: 'mesh', rows: g.rows, cols: g.cols, points: g.points, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } } as MeshNode];
    if (type === 4) tris = readTriangles(data, spec, xf).map((t) => t.map(prep) as [RV, RV, RV]);
    else if (type === 5) {
      const rows = readLattice(data, spec, xf), g = lut ? null : latticeMesh(rows, colorOf);
      if (g) nodes = mesh(g);
      else for (let r = 0; r + 1 < rows.length; r++) for (let c = 0; c + 1 < spec.perRow; c++) { const a = prep(rows[r][c]), b = prep(rows[r][c + 1]), e = prep(rows[r + 1][c + 1]), f = prep(rows[r + 1][c]); tris.push([a, b, e], [a, e, f]); }
    } else {
      const patches: Patch[] = readPatches(data, spec, xf), g = lut ? null : gridMesh(patches, colorOf);
      if (g) nodes = mesh(g);
      else {
        const n = patches.length <= 16 ? 24 : patches.length <= 256 ? 12 : patches.length <= 2000 ? 6 : 4;
        for (const p of patches) tris.push(...patchTriangles(lut ? p : { ...p, c: p.c.map(rgbOf) }, n));
        this.skipped.add('mesh shadings that are not a patch grid (set as a picture of the region)');
      }
    }
    if (!nodes && type === 4) this.skipped.add('free-form triangle meshes (set as a picture of the region)');
    if (!nodes && type === 5) this.skipped.add('lattice meshes with function colours (set as a picture of the region)');
    if (!nodes) {
      const r = rasterTriangles(tris, 4, finish);
      if (!r) return null;
      const cv = new OffscreenCanvas(r.w, r.h), g = cv.getContext('2d');
      if (!g) return null;
      g.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
      const blob = await cv.convertToBlob({ type: 'image/png' }), key = `img-${newId('').replace(/[^a-z0-9]/gi, '')}.png`;
      this.assets.set(key, blob);
      this.images[key] = { mime: 'image/png', w: r.w, h: r.h };
      nodes = [{ id: newId('im'), kind: 'image', src: key, w: r.w, h: r.h, xf: [1 / r.scale, 0, 0, 1 / r.scale, r.x, r.y], opacity: 1, blend: 'normal', ap: { items: [], effects: [] } } as ImageNode];
    }
    const per = this.meshCache.get(d) ?? new Map<string, VNode[]>();
    per.set(tag, nodes);
    this.meshCache.set(d, per);
    return nodes;
  }

  private async shading(v: Val, m: Mat): Promise<{ paint: Paint; d: PathData } | { nodes: VNode[] } | null> {
    const pdf = this.pdf, d = v instanceof Stream ? v.dict : v instanceof Map ? v : null;
    if (!d) return null;
    const type = pdf.n(d.get('ShadingType')), csv = pdf.get(d.get('ColorSpace')), cs = Array.isArray(csv) ? csv.map((y) => pdf.get(y)) : [csv];
    if (type >= 4 && type <= 7) {
      if (!(v instanceof Stream)) return null;
      try { const nodes = await this.meshShading(v, cs, type as 4 | 5 | 6 | 7, m); return nodes ? { nodes } : null; } catch (err) { this.skipped.add(`a mesh shading (${err instanceof Error ? err.message : String(err)})`); return null; }
    }
    if (type !== 2 && type !== 3) { this.skipped.add('function-based shadings'); return null; }
    const c = pdf.nums(d.get('Coords')), dom = pdf.nums(d.get('Domain')), fnv = pdf.get(d.get('Function'));
    const fns = (Array.isArray(fnv) ? fnv : [fnv]).map((x) => pdf.dict(x)).filter((x): x is PDict => !!x);
    const t0 = dom[0] ?? 0, t1 = dom[1] ?? 1;
    const at = (t: number): Color => { const x = t0 + (t1 - t0) * t, out = fns.length === 1 ? evalFn(pdf, fns[0], [x]) : fns.map((f) => (evalFn(pdf, f, [x]) ?? [0])[0]); return this.toColor(cs, out ?? [0]) ?? gray(50); };
    const stops = Array.from({ length: 9 }, (_, i) => stop(i / 8, at(i / 8)));
    const sc = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
    let g: Gradient;
    if (type === 2) { const a = apply(m, c[0], c[1]), b = apply(m, c[2], c[3]); g = { kind: 'linear', stops, angle: 0, aspect: 1, geom: { x1: a.x, y1: a.y, x2: b.x, y2: b.y } }; }
    else { const f0 = apply(m, c[0], c[1]), o = apply(m, c[3], c[4]), r1 = (c[5] ?? 1) * sc, r0 = (c[2] ?? 0) * sc; const s0 = r1 > 0 ? r0 / r1 : 0; g = { kind: 'radial', stops: s0 > 0 ? stops.map((s) => ({ ...s, offset: s0 + s.offset * (1 - s0) })) : stops, angle: 0, aspect: 1, geom: { x1: o.x, y1: o.y, x2: o.x + r1, y2: o.y, fx: f0.x, fy: f0.y } }; }
    const box = pdf.nums(d.get('BBox'));
    const r = box.length === 4 ? [apply(m, box[0], box[1]), apply(m, box[2], box[1]), apply(m, box[2], box[3]), apply(m, box[0], box[3])] : [{ x: -5e3, y: -5e3 }, { x: 5e3, y: -5e3 }, { x: 5e3, y: 5e3 }, { x: -5e3, y: 5e3 }];
    return { paint: { type: 'gradient', gradient: g }, d: [{ closed: true, pts: r.map(corner) }] };
  }

  private async image(xo: Stream, ctm: Mat): Promise<VNode | null> {
    const pdf = this.pdf, d = xo.dict, w = pdf.n(d.get('Width')), h = pdf.n(d.get('Height'));
    if (!(w > 0 && h > 0) || w * h > 64e6) return null;
    const dct = pdf.filters(xo).includes('DCTDecode') || pdf.filters(xo).includes('DCT');
    let blob: Blob | null = null, ow = w, oh = h;
    try {
      const plainJpeg = dct && !d.has('SMask') && !d.has('Mask') && !/CMYK|ICCBased|Indexed/.test(nameOf(pdf.get(d.get('ColorSpace'))) || 'x') && nameOf(pdf.get(d.get('ColorSpace'))) !== 'DeviceCMYK';
      blob = plainJpeg ? new Blob([(await pdf.decode(xo)) as unknown as BlobPart], { type: 'image/jpeg' }) : await this.raster(xo, w, h, dct);
      if (!plainJpeg) { ow = this.rw; oh = this.rh; }
    } catch (err) { this.skipped.add(`an image (${err instanceof Error ? err.message : String(err)})`); return null; }
    if (!blob) return null;
    const key = `img-${newId('').replace(/[^a-z0-9]/gi, '')}.${blob.type === 'image/jpeg' ? 'jpg' : 'png'}`;
    this.assets.set(key, blob);
    this.images[key] = { mime: blob.type, w: ow, h: oh };
    return { id: newId('im'), kind: 'image', src: key, w: ow, h: oh, xf: mul(ctm, [1 / ow, 0, 0, -1 / oh, 0, 1]), opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
  }

  private rw = 0;
  private rh = 0;

  private async raster(xo: Stream, w: number, h: number, dct: boolean): Promise<Blob | null> {
    const pdf = this.pdf, d = xo.dict, c = new OffscreenCanvas(w, h), g = c.getContext('2d');
    if (!g) return null;
    let img: ImageData;
    if (dct) {
      const bmp = await createImageBitmap(new Blob([(await pdf.decode(xo)) as unknown as BlobPart], { type: 'image/jpeg' }));
      g.drawImage(bmp, 0, 0, w, h); bmp.close();
      img = g.getImageData(0, 0, w, h);
    } else {
      const bpc = pdf.n(d.get('BitsPerComponent'), 8), mask = d.get('ImageMask') === true, csv = pdf.get(d.get('ColorSpace')), cs = await this.unpackLut(mask ? [new Name('DeviceGray')] : Array.isArray(csv) ? csv.map((y) => pdf.get(y)) : [csv]);
      const data = await pdf.decode(xo), kind = nameOf(cs[0]);
      const pal = kind === 'Indexed' ? Array.from({ length: pdf.n(cs[2]) + 1 }, (_, i) => ((col) => (col ? toRgbLocal(col) : [0, 0, 0]))(this.toColor(cs, [i]))) : [];
      img = g.createImageData(w, h);
      const px = img.data;
      const nc = kind === 'ICCBased' ? ((s) => (s instanceof Stream ? pdf.n(s.dict.get('N'), 3) : 3))(pdf.get(cs[1])) : kind === 'DeviceCMYK' ? 4 : ['DeviceGray', 'CalGray', 'Indexed', 'Separation'].includes(kind) || mask ? 1 : 3;
      const rowBytes = Math.ceil((w * nc * bpc) / 8), max = (1 << Math.min(bpc, 8)) - 1;
      const sample = (row: number, i: number): number => { if (bpc === 8) return data[row * rowBytes + i] ?? 0; if (bpc === 16) return data[row * rowBytes + i * 2] ?? 0; const bit = i * bpc, byte = data[row * rowBytes + (bit >> 3)] ?? 0; return (byte >> (8 - bpc - (bit & 7))) & max; };
      const fillC = mask ? ((x) => (x.type === 'color' ? toRgbLocal(x.color) : [0, 0, 0]))(solid(gray(100))) : [0, 0, 0];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        let r = 0, gg = 0, b = 0;
        if (mask) { [r, gg, b] = fillC; px[o] = r; px[o + 1] = gg; px[o + 2] = b; px[o + 3] = sample(y, x) ? 0 : 255; continue; }
        if (kind === 'Indexed') [r, gg, b] = pal[sample(y, x)] ?? [0, 0, 0];
        else if (kind === 'Separation') { r = gg = b = 255 - (sample(y, x) * 255) / max; }
        else if (nc === 1) { r = gg = b = (sample(y, x) * 255) / max; }
        else if (nc === 4) { const C = sample(y, x * 4) / max, M = sample(y, x * 4 + 1) / max, Y = sample(y, x * 4 + 2) / max, K = sample(y, x * 4 + 3) / max; r = 255 * (1 - C) * (1 - K); gg = 255 * (1 - M) * (1 - K); b = 255 * (1 - Y) * (1 - K); }
        else { r = (sample(y, x * 3) * 255) / max; gg = (sample(y, x * 3 + 1) * 255) / max; b = (sample(y, x * 3 + 2) * 255) / max; }
        px[o] = r; px[o + 1] = gg; px[o + 2] = b; px[o + 3] = 255;
      }
    }
    const sm = pdf.get(d.get('SMask')), em = pdf.get(d.get('Mask')), ms = sm instanceof Stream ? sm : em instanceof Stream ? em : null;
    this.rw = w; this.rh = h;
    if (ms) {
      const mw = pdf.n(ms.dict.get('Width')), mh = pdf.n(ms.dict.get('Height')), stencil = ms !== sm, mb = pdf.n(ms.dict.get('BitsPerComponent'), stencil ? 1 : 8);
      if (mw > 0 && mh > 0 && mw * mh <= 64e6 && !pdf.filters(ms).some((f) => f === 'DCTDecode' || f === 'DCT')) {
        const md = await pdf.decode(ms), dec = pdf.nums(ms.dict.get('Decode')), flip = dec.length === 2 && dec[0] > dec[1], row = Math.ceil((mw * mb) / 8), mmax = (1 << Math.min(mb, 8)) - 1;
        const alphaAt = (x: number, y: number): number => {
          const bit = x * mb, byte = md[y * row + (bit >> 3)] ?? 0;
          const v = mb === 8 ? byte : mb === 16 ? byte : (byte >> (8 - mb - (bit & 7))) & mmax;
          const a = stencil ? (v ? 0 : 255) : (v * 255) / mmax;
          return flip ? 255 - a : a;
        };
        const W = Math.max(w, mw), H = Math.max(h, mh);
        let out = img;
        if (W !== w || H !== h) {
          const big = new OffscreenCanvas(W, H), bg = big.getContext('2d');
          if (bg) {
            g.putImageData(img, 0, 0);
            bg.imageSmoothingEnabled = true;
            bg.drawImage(c, 0, 0, w, h, 0, 0, W, H);
            out = bg.getImageData(0, 0, W, H);
          }
        }
        if (out.width === W && out.height === H) {
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out.data[(y * W + x) * 4 + 3] = alphaAt(Math.min(mw - 1, Math.floor((x * mw) / W)), Math.min(mh - 1, Math.floor((y * mh) / H)));
          const oc = new OffscreenCanvas(W, H), og = oc.getContext('2d');
          if (og) { og.putImageData(out, 0, 0); this.rw = W; this.rh = H; return oc.convertToBlob({ type: 'image/png' }); }
        }
      }
    }
    g.putImageData(img, 0, 0);
    return c.convertToBlob({ type: 'image/png' });
  }
}

function toRgbLocal(c: Color): [number, number, number] {
  if (c.kind === 'rgb') return [c.r, c.g, c.b];
  if (c.kind === 'gray') { const v = 255 * (1 - c.k / 100); return [v, v, v]; }
  const C = c.c / 100, M = c.m / 100, Y = c.y / 100, K = c.k / 100;
  return [255 * (1 - C) * (1 - K), 255 * (1 - M) * (1 - K), 255 * (1 - Y) * (1 - K)];
}

function evalFn(pdf: PdfFile, f: PDict, x: number[]): number[] | null {
  const type = pdf.n(f.get('FunctionType'), -1), dom = pdf.nums(f.get('Domain')), t = Math.max(dom[0] ?? 0, Math.min(dom[1] ?? 1, x[0] ?? 0));
  if (type === 2) {
    const c0 = pdf.nums(f.get('C0')), c1 = pdf.nums(f.get('C1')), N = pdf.n(f.get('N'), 1), a = c0.length ? c0 : [0], b = c1.length ? c1 : [1];
    return a.map((v, i) => v + Math.pow(t, N) * ((b[i] ?? 1) - v));
  }
  if (type === 3) {
    const fns = pdf.arr(f.get('Functions')).map((v) => pdf.dict(v)), bounds = pdf.nums(f.get('Bounds')), enc = pdf.nums(f.get('Encode'));
    let k = 0;
    while (k < bounds.length && t >= bounds[k]) k++;
    const lo = k === 0 ? dom[0] ?? 0 : bounds[k - 1], hi = k === bounds.length ? dom[1] ?? 1 : bounds[k], e0 = enc[k * 2] ?? 0, e1 = enc[k * 2 + 1] ?? 1;
    const sub = fns[k];
    return sub ? evalFn(pdf, sub, [hi > lo ? e0 + ((t - lo) / (hi - lo)) * (e1 - e0) : e0]) : null;
  }
  if (type === 0 || type === 4) {
    const rng = pdf.nums(f.get('Range')), n = Math.floor(rng.length / 2);
    return Array.from({ length: n }, (_, i) => (rng[i * 2] ?? 0) + t * ((rng[i * 2 + 1] ?? 1) - (rng[i * 2] ?? 0)));
  }
  return null;
}

function parseCMap(src: string): Map<number, string> {
  const out = new Map<number, string>(), hex = (h: string): number => parseInt(h, 16);
  const uni = (h: string): string => { let s = ''; for (let i = 0; i + 4 <= h.length; i += 4) s += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); if (h.length === 2) s = String.fromCharCode(parseInt(h, 16)); return s; };
  for (const block of src.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) for (const m of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) out.set(hex(m[1]), uni(m[2]));
  for (const block of src.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    for (const m of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]*)>|\[([^\]]*)\])/g)) {
      const a = hex(m[1]), b = hex(m[2]);
      if (m[3] !== undefined) { const base = m[3], head = base.slice(0, -4), tail = parseInt(base.slice(-4) || '0', 16); for (let c = a; c <= b && c - a < 65536; c++) out.set(c, uni(head + (tail + c - a).toString(16).padStart(4, '0'))); }
      else [...(m[4] ?? '').matchAll(/<([0-9a-fA-F]*)>/g)].forEach((x, k) => out.set(a + k, uni(x[1])));
    }
  }
  return out;
}
