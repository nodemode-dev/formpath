import { newDoc, newId } from '../engine/doc';
import { anchor, arcSegmentPath, mul, transformPath } from '../engine/geometry';
import { fill as fillItem, linearGradient, radialGradient, stop, stroke as strokeItem, toRgb } from '../engine/paint';
import { bytesStream, filterStream, subStream, toRgba, type PsStream, type Samples } from './ps-filters';
import { DEFAULT_CHAR, DEFAULT_PARA } from '../engine/text';
import type { Anchor, Color, Doc, Mat, Paint, PathData, SubPath, VNode } from '../engine';

type PsName = { t: 'name'; v: string; lit: boolean };
type PsProc = { t: 'proc'; v: PsObj[] };
type PsArr = { t: 'arr'; v: PsObj[] };
type PsDict = { t: 'dict'; v: Map<string, PsObj> };
type PsOp = { t: 'op'; v: string; f: (ps: Interp) => void };
type PsFont = { t: 'font'; name: string; size: number; m: Mat };
type PsObj = number | boolean | string | null | PsName | PsProc | PsArr | PsDict | PsOp | PsFont | { t: 'mark' } | PsFile | { t: 'save'; depth: number };
type PsFile = { t: 'file'; st: PsStream };
interface PendingImage { key: string; w: number; h: number; rgba?: Uint8ClampedArray; jpeg?: Uint8Array }
interface ImgSpace { n: number; palette?: Uint8Array }

class ExitSignal extends Error {}
class StopSignal extends Error {}

interface GState { ctm: Mat; path: SubPath[]; cp: { x: number; y: number } | null; color: Color; lw: number; cap: 'butt' | 'round' | 'square'; join: 'miter' | 'round' | 'bevel'; miter: number; dash: number[]; dashOff: number; clip: { d: PathData; even: boolean; key: number } | null; font: PsFont | null; space: number }

class Lexer {
  i = 0;
  constructor(readonly s: string) {}
  skipTo(marker: string): void { const k = this.s.indexOf(marker, this.i); this.i = k < 0 ? this.s.length : k + marker.length; }
  next(): PsObj | undefined | { t: 'open' } | { t: 'close' } | { t: 'dopen' } | { t: 'dclose' } | { t: 'aopen' } | { t: 'aclose' } {
    const s = this.s;
    for (;;) {
      while (this.i < s.length && /\s/.test(s[this.i])) this.i++;
      if (this.i >= s.length) return undefined;
      if (s[this.i] === '%') { while (this.i < s.length && s[this.i] !== '\n' && s[this.i] !== '\r') this.i++; continue; }
      break;
    }
    const ch = s[this.i];
    if (ch === '{') { this.i++; return { t: 'open' }; }
    if (ch === '}') { this.i++; return { t: 'close' }; }
    if (ch === '[') { this.i++; return { t: 'aopen' }; }
    if (ch === ']') { this.i++; return { t: 'aclose' }; }
    if (ch === '<' && s[this.i + 1] === '<') { this.i += 2; return { t: 'dopen' }; }
    if (ch === '>' && s[this.i + 1] === '>') { this.i += 2; return { t: 'dclose' }; }
    if (ch === '(') {
      let depth = 1, out = '';
      this.i++;
      while (this.i < s.length && depth > 0) {
        const c = s[this.i++];
        if (c === '\\') { const e = s[this.i++]; const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }; if (map[e]) out += map[e]; else if (/[0-7]/.test(e)) { let o = e; while (o.length < 3 && /[0-7]/.test(s[this.i])) o += s[this.i++]; out += String.fromCharCode(parseInt(o, 8)); } else if (e === '\n' || e === '\r') { if (e === '\r' && s[this.i] === '\n') this.i++; } else out += e; continue; }
        if (c === '(') depth++;
        if (c === ')') { depth--; if (!depth) break; }
        out += c;
      }
      return out;
    }
    if (ch === '<' && s[this.i + 1] === '~') { const k = s.indexOf('~>', this.i); this.i = k < 0 ? s.length : k + 2; return ''; }
    if (ch === '<') { const k = s.indexOf('>', this.i); const hex = s.slice(this.i + 1, k < 0 ? s.length : k).replace(/\s+/g, ''); this.i = k < 0 ? s.length : k + 1; let out = ''; for (let j = 0; j < hex.length; j += 2) out += String.fromCharCode(parseInt((hex.slice(j, j + 2) + '0').slice(0, 2), 16) || 0); return out; }
    let j = this.i;
    if (ch === '/') j++;
    while (j < s.length && !/[\s()<>[\]{}/%]/.test(s[j])) j++;
    if (ch === '/' && j === this.i + 1 && s[j] === '/') j++;
    const word = s.slice(this.i, j);
    this.i = Math.max(j, this.i + 1);
    if (word.startsWith('/')) return { t: 'name', v: word.replace(/^\/+/, ''), lit: true };
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(word)) return Number(word);
    const radix = /^(\d+)#([0-9a-zA-Z]+)$/.exec(word);
    if (radix) return parseInt(radix[2], Number(radix[1]));
    return { t: 'name', v: word, lit: false };
  }
}

const isName = (o: PsObj | undefined): o is PsName => typeof o === 'object' && o !== null && (o as { t?: string }).t === 'name';
const isProc = (o: PsObj | undefined): o is PsProc => typeof o === 'object' && o !== null && (o as { t?: string }).t === 'proc';
const isArr = (o: PsObj | undefined): o is PsArr => typeof o === 'object' && o !== null && (o as { t?: string }).t === 'arr';
const isDict = (o: PsObj | undefined): o is PsDict => typeof o === 'object' && o !== null && (o as { t?: string }).t === 'dict';
const keyOf = (o: PsObj): string => (isName(o) ? o.v : typeof o === 'string' ? o : String(o));
const FONT_MAP: Array<[RegExp, string]> = [[/^Helvetica|^Arial|^NimbusSans|^Nimbus Sans/i, 'Helvetica'], [/^Times|^NimbusRom/i, 'Times New Roman'], [/^Courier|^NimbusMono/i, 'Courier New'], [/^Palatino/i, 'Palatino'], [/^Georgia/i, 'Georgia'], [/^Verdana/i, 'Verdana']];

class Interp {
  stack: PsObj[] = [];
  dicts: Array<Map<string, PsObj>> = [];
  gs: GState;
  gstack: GState[] = [];
  out: VNode[] = [];
  skipped = new Set<string>();
  images: PendingImage[] = [];
  imgSpace: ImgSpace = { n: 1 };
  stamp = Date.now().toString(36);
  steps = 0;
  clipKey = 0;
  constructor(readonly lex: Lexer, readonly flip: Mat) {
    this.gs = { ctm: [1, 0, 0, 1, 0, 0], path: [], cp: null, color: { kind: 'gray', k: 100 }, lw: 1, cap: 'butt', join: 'miter', miter: 10, dash: [], dashOff: 0, clip: null, font: null, space: 1 };
    const sys = new Map<string, PsObj>(), user = new Map<string, PsObj>();
    for (const [k, fn] of Object.entries(OPS)) sys.set(k, { t: 'op', v: k, f: fn });
    sys.set('true', true); sys.set('false', false); sys.set('null', null);
    sys.set('userdict', { t: 'dict', v: user }); sys.set('systemdict', { t: 'dict', v: sys }); sys.set('globaldict', { t: 'dict', v: user }); sys.set('statusdict', { t: 'dict', v: new Map() }); sys.set('errordict', { t: 'dict', v: new Map() });
    this.dicts = [sys, user];
  }
  pop(): PsObj { if (!this.stack.length) throw new Error('stackunderflow'); return this.stack.pop() as PsObj; }
  num(): number { const v = this.pop(); return typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : 0; }
  push(...v: PsObj[]): void { this.stack.push(...v); }
  lookup(k: string): PsObj | undefined { for (let i = this.dicts.length - 1; i >= 0; i--) { const d = this.dicts[i]; if (d.has(k)) return d.get(k); } return undefined; }
  tick(): void { if (++this.steps > 4_000_000) throw new Error('This EPS runs too long for the reader.'); }

  exec(o: PsObj): void {
    this.tick();
    if (isName(o) && !o.lit) {
      const v = this.lookup(o.v);
      if (v === undefined) { this.skipped.add(o.v); return; }
      if (isProc(v)) { this.runProc(v); return; }
      if (typeof v === 'object' && v !== null && (v as { t?: string }).t === 'op') { (v as PsOp).f(this); return; }
      this.push(v);
      return;
    }
    if (typeof o === 'object' && o !== null && (o as { t?: string }).t === 'op') { (o as PsOp).f(this); return; }
    this.push(o);
  }
  runProc(p: PsProc): void { for (const x of p.v) { if (isProc(x)) this.push(x); else this.exec(x); } }
  call(o: PsObj): void { if (isProc(o)) this.runProc(o); else this.exec(o); }

  read(): PsObj | undefined {
    const tk = this.lex.next();
    if (tk === undefined) return undefined;
    if (typeof tk === 'object' && tk !== null && 't' in tk) {
      if (tk.t === 'open') { const body: PsObj[] = []; for (;;) { const lt = this.lex.next(); if (lt === undefined) break; if (typeof lt === 'object' && lt !== null && (lt as { t: string }).t === 'close') break; body.push(this.convert(lt)); } return { t: 'proc', v: body }; }
      if (tk.t === 'close') return undefined;
      if (tk.t === 'aopen') return { t: 'name', v: '[', lit: false };
      if (tk.t === 'aclose') return { t: 'name', v: ']', lit: false };
      if (tk.t === 'dopen') return { t: 'name', v: '<<', lit: false };
      if (tk.t === 'dclose') return { t: 'name', v: '>>', lit: false };
    }
    return tk as PsObj;
  }
  private convert(lt: ReturnType<Lexer['next']>): PsObj {
    if (typeof lt === 'object' && lt !== null && 't' in lt) {
      if (lt.t === 'open') { const body: PsObj[] = []; for (;;) { const x = this.lex.next(); if (x === undefined) break; if (typeof x === 'object' && x !== null && (x as { t: string }).t === 'close') break; body.push(this.convert(x)); } return { t: 'proc', v: body }; }
      if (lt.t === 'aopen') return { t: 'name', v: '[', lit: false };
      if (lt.t === 'aclose') return { t: 'name', v: ']', lit: false };
      if (lt.t === 'dopen') return { t: 'name', v: '<<', lit: false };
      if (lt.t === 'dclose') return { t: 'name', v: '>>', lit: false };
    }
    return lt as PsObj;
  }

  run(): void {
    for (;;) {
      const o = this.read();
      if (o === undefined) { if (this.lex.i >= this.lex.s.length) break; continue; }
      try { if (isProc(o)) this.push(o); else this.exec(o); }
      catch (e) { if (e instanceof ExitSignal || e instanceof StopSignal) continue; if (e instanceof Error && /too long/.test(e.message)) throw e; this.skipped.add(`error ${e instanceof Error ? e.message : String(e)}`); }
    }
  }

  user(x: number, y: number): { x: number; y: number } { const m = this.gs.ctm; return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }; }
  toDoc(d: PathData): PathData { return transformPath(d, this.flip); }
  curSub(): SubPath { const p = this.gs.path; if (!p.length || !this.gs.cp) throw new Error('nocurrentpoint'); return p[p.length - 1]; }
  moveTo(x: number, y: number): void { const q = this.user(x, y); this.gs.path = [...this.gs.path, { closed: false, pts: [anchor(q.x, q.y)] }]; this.gs.cp = q; }
  lineTo(x: number, y: number): void { const q = this.user(x, y), sp = this.curSub(); sp.pts.push(anchor(q.x, q.y)); this.gs.cp = q; }
  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    const a = this.user(x1, y1), b = this.user(x2, y2), c = this.user(x3, y3), sp = this.curSub(), last = sp.pts[sp.pts.length - 1];
    last.ox = a.x; last.oy = a.y;
    sp.pts.push({ x: c.x, y: c.y, ix: b.x, iy: b.y, ox: c.x, oy: c.y });
    this.gs.cp = c;
  }
  closePath(): void {
    const p = this.gs.path;
    if (!p.length) return;
    const sp = p[p.length - 1];
    if (sp.pts.length > 1) { const a = sp.pts[0], z = sp.pts[sp.pts.length - 1]; if (Math.abs(a.x - z.x) < 1e-6 && Math.abs(a.y - z.y) < 1e-6) { a.ix = z.ix; a.iy = z.iy; sp.pts.pop(); } }
    sp.closed = true;
    this.gs.cp = sp.pts[0] ? { x: sp.pts[0].x, y: sp.pts[0].y } : null;
  }
  arc(cx: number, cy: number, r: number, a1: number, a2: number, neg: boolean): void {
    if (!neg) while (a2 < a1) a2 += 360; else while (a2 > a1) a2 -= 360;
    const pts = arcSegmentPath(cx, cy, r, r, (a1 * Math.PI) / 180, (a2 * Math.PI) / 180);
    const m = this.gs.ctm, t = pts.map((p): Anchor => { const q = (x: number, y: number): { x: number; y: number } => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }); const a = q(p.x, p.y), i = q(p.ix, p.iy), o = q(p.ox, p.oy); return { x: a.x, y: a.y, ix: i.x, iy: i.y, ox: o.x, oy: o.y }; });
    if (this.gs.cp && this.gs.path.length) { const sp = this.curSub(); sp.pts.push(t[0]); sp.pts.push(...t.slice(1)); }
    else this.gs.path = [...this.gs.path, { closed: false, pts: t }];
    const z = t[t.length - 1]; this.gs.cp = { x: z.x, y: z.y };
  }
  cloneGs(): GState { return { ...this.gs, path: this.gs.path.map((s) => ({ closed: s.closed, pts: s.pts.map((a) => ({ ...a })) })), dash: [...this.gs.dash] }; }
  emit(node: VNode): void {
    const c = this.gs.clip;
    if (!c) { this.out.push(node); return; }
    const last = this.out[this.out.length - 1];
    if (last && last.kind === 'group' && last.clip && (last as { name?: string }).name === `clip-${c.key}`) {
      const kids = last.children.slice(0, -1);
      this.out[this.out.length - 1] = { ...last, children: [...kids, node, last.children[last.children.length - 1]] };
      return;
    }
    const cp: VNode = { id: newId('p'), kind: 'path', d: this.toDoc(c.d), rule: c.even ? 'evenodd' : 'nonzero', opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
    this.out.push({ id: newId('g'), kind: 'group', name: `clip-${c.key}`, clip: true, children: [node, cp], opacity: 1, blend: 'normal', ap: { items: [], effects: [] } });
  }
  paintPath(fill: Paint | null, stroke: boolean, even: boolean): void {
    const d = this.gs.path.filter((s) => s.pts.length > 1);
    this.gs.path = []; this.gs.cp = null;
    if (!d.length) return;
    const g = this.gs, scale = Math.sqrt(Math.abs(g.ctm[0] * g.ctm[3] - g.ctm[1] * g.ctm[2])) || 1;
    const items: VNode['ap']['items'] = [];
    if (fill) items.push(fillItem(fill));
    if (stroke) items.push(strokeItem({ type: 'color', color: g.color }, Math.max(0.1, g.lw * scale), { cap: g.cap, join: g.join, miter: g.miter, dash: g.dash.map((v) => v * scale), dashOffset: g.dashOff * scale }));
    this.emit({ id: newId('p'), kind: 'path', d: this.toDoc(d), rule: even ? 'evenodd' : 'nonzero', opacity: 1, blend: 'normal', ap: { items, effects: [] } });
  }
  setColor(comps: number[]): void {
    const n = this.gs.space;
    if (n === 4) this.gs.color = { kind: 'cmyk', c: comps[0] * 100, m: comps[1] * 100, y: comps[2] * 100, k: comps[3] * 100 };
    else if (n === 3) this.gs.color = { kind: 'rgb', r: Math.round(comps[0] * 255), g: Math.round(comps[1] * 255), b: Math.round(comps[2] * 255) };
    else this.gs.color = { kind: 'gray', k: (1 - (comps[0] ?? 0)) * 100 };
  }
  colorOf(arr: PsObj): Color {
    const v = isArr(arr) ? arr.v.map((x) => (typeof x === 'number' ? x : 0)) : [];
    if (v.length >= 4) return { kind: 'cmyk', c: v[0] * 100, m: v[1] * 100, y: v[2] * 100, k: v[3] * 100 };
    if (v.length === 3) return { kind: 'rgb', r: Math.round(v[0] * 255), g: Math.round(v[1] * 255), b: Math.round(v[2] * 255) };
    return { kind: 'gray', k: (1 - (v[0] ?? 0)) * 100 };
  }
  mat(o: PsObj): Mat | null { if (!isArr(o) || o.v.length !== 6) return null; return o.v.map((x) => (typeof x === 'number' ? x : 0)) as Mat; }
  rawFile(): PsFile { const lex = this.lex; return { t: 'file', st: { raw: true, get: () => (lex.i < lex.s.length ? lex.s.charCodeAt(lex.i++) & 255 : -1) } }; }
}

const isFile = (o: PsObj | undefined): o is PsFile => typeof o === 'object' && o !== null && (o as { t?: string }).t === 'file';
const bytesOf = (s: string): Uint8Array => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
const mentions = (o: PsObj | undefined, name: string, depth = 0): boolean => (isProc(o) || isArr(o) ? depth < 6 && o.v.some((x) => mentions(x, name, depth + 1)) : isName(o) && !o.lit && o.v === name);

// Reads the bytes of one image data source: a string, a file or filter chain, or a procedure that yields strings.
class Puller {
  private buf: Uint8Array = new Uint8Array(0);
  private at = 0;
  private dead = false;
  constructor(private readonly ps: Interp, private readonly src: PsObj) {}
  take(n: number): Uint8Array {
    const out = new Uint8Array(n);
    let have = 0;
    while (have < n) {
      if (this.at < this.buf.length) { const k = Math.min(n - have, this.buf.length - this.at); out.set(this.buf.subarray(this.at, this.at + k), have); this.at += k; have += k; continue; }
      if (this.dead) break;
      const s = this.src;
      if (typeof s === 'string') { this.buf = bytesOf(s); this.at = 0; this.dead = true; }
      else if (isFile(s)) {
        const b = new Uint8Array(n - have);
        let k = 0;
        while (k < b.length) { const c = s.st.get(); if (c < 0) { this.dead = true; break; } b[k++] = c; }
        out.set(b.subarray(0, k), have); have += k;
      } else if (isProc(s)) {
        const depth = this.ps.stack.length;
        this.ps.runProc(s);
        const r = this.ps.stack.length > depth ? this.ps.pop() : null;
        this.ps.stack.length = Math.min(this.ps.stack.length, depth);
        if (typeof r !== 'string' || !r.length) this.dead = true;
        else { this.buf = bytesOf(r); this.at = 0; }
      } else this.dead = true;
    }
    return out;
  }
  finish(): void { const s = this.src; if (isFile(s) && !s.st.raw) for (let c = s.st.get(), k = 0; c >= 0 && k < 1 << 22; c = s.st.get(), k++); }
}

// image, colorimage and imagemask. Returns false when it could not make sense of the operands.
function paintImage(ps: Interp, kind: 'image' | 'colorimage' | 'imagemask'): boolean {
  let w = 0, h = 0, bits = 8, matrix: Mat | null = null, decode: number[] | null = null, polarity = false, comps = 1, sources: PsObj[] = [], spaced = false;
  const num = (o: PsObj | undefined, d: number): number => (typeof o === 'number' ? o : d);
  if (kind === 'colorimage') {
    comps = ps.num();
    const multi = ps.pop();
    sources = [];
    for (let i = 0; i < (multi === true ? comps : 1); i++) sources.unshift(ps.pop());
    matrix = ps.mat(ps.pop()); bits = ps.num(); h = ps.num(); w = ps.num();
  } else {
    const top = ps.pop();
    if (isDict(top)) {
      const g = (k: string): PsObj | undefined => top.v.get(k);
      w = num(g('Width'), 0); h = num(g('Height'), 0); bits = num(g('BitsPerComponent'), kind === 'imagemask' ? 1 : 8);
      matrix = ps.mat(g('ImageMatrix') ?? null);
      const d = g('Decode');
      if (isArr(d)) decode = d.v.map((x) => num(x, 0));
      const ds = g('DataSource');
      if (isArr(ds)) sources = ds.v; else if (ds !== undefined) sources = [ds];
      if (kind === 'imagemask') polarity = !!decode && decode[0] === 1;
      const it = g('ImageType');
      if (typeof it === 'number' && it !== 1) { ps.skipped.add('masked images'); return false; }
    } else {
      sources = [top];
      matrix = ps.mat(ps.pop());
      const third = ps.pop();
      if (kind === 'imagemask') polarity = third === true; else bits = typeof third === 'number' ? third : 8;
      h = ps.num(); w = ps.num();
    }
    spaced = kind === 'image' && isDict(top);
    if (spaced) comps = ps.imgSpace.n;
  }
  if (!(w > 0 && h > 0) || w * h > 1e8 || !matrix || !sources.length) return false;
  w = Math.round(w); h = Math.round(h);
  const m = matrix;
  if (Math.abs(m[0] * m[3] - m[1] * m[2]) < 1e-12) return false;
  if (kind === 'imagemask') bits = 1;
  if (![1, 2, 4, 8, 12, 16].includes(bits)) { ps.skipped.add('image sample depth'); return false; }
  const direct = sources.some((s) => (isFile(s) && (s.st.raw === true || s.st.live === true)) || mentions(s, 'currentfile'));
  if (direct) { const lex = ps.lex, c = lex.s[lex.i]; if (c === '\r' && lex.s[lex.i + 1] === '\n') lex.i += 2; else if (c === '\n' || c === '\r' || c === ' ' || c === '\t') lex.i++; }
  const key = `eps-img-${ps.stamp}-${ps.images.length}`;
  const fillColor = toRgb(ps.gs.color);
  const first = sources[0];
  let pending: PendingImage;
  if (kind !== 'imagemask' && isFile(first) && first.st.jpeg) {
    const jpeg = first.st.jpeg();
    if (jpeg.length < 4) return false;
    pending = { key: `${key}.jpg`, w, h, jpeg };
  } else {
    const planar = sources.length > 1, nsrc = planar ? comps : 1;
    if (planar && sources.length < comps) return false;
    const rowBytes = Math.ceil((w * bits * (planar ? 1 : comps)) / 8);
    const pulls = sources.slice(0, nsrc).map((s) => new Puller(ps, s));
    const rows: Uint8Array[][] = [];
    for (let y = 0; y < h; y++) rows.push(pulls.map((p) => p.take(rowBytes)));
    for (const p of pulls) p.finish();
    const dec = decode && decode.length >= comps * 2 ? decode : ps.imgSpace.palette && spaced ? [0, (1 << bits) - 1] : Array.from({ length: comps }, () => [0, 1]).flat();
    const s: Samples = { w, h, bits, comps: kind === 'imagemask' ? 1 : comps, rows, decode: dec, ...(spaced && ps.imgSpace.palette ? { palette: ps.imgSpace.palette } : {}), ...(kind === 'imagemask' ? { mask: { paintOne: polarity, r: fillColor.r, g: fillColor.g, b: fillColor.b } } : {}) };
    pending = { key: `${key}.png`, w, h, rgba: toRgba(s) };
  }
  ps.images.push(pending);
  const xf = mul(ps.flip, mul(ps.gs.ctm, inv(m)));
  ps.emit({ id: newId('im'), kind: 'image', src: pending.key, w, h, xf, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, ...(kind === 'imagemask' ? { name: 'Image mask' } : {}) });
  return true;
}

const ARGN = (ps: Interp, n: number): number[] => { const out: number[] = []; for (let i = 0; i < n; i++) out.unshift(ps.num()); return out; };
const inv = (m: Mat): Mat => { const d = m[0] * m[3] - m[1] * m[2] || 1; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; };
const matObj = (m: Mat): PsArr => ({ t: 'arr', v: [...m] });
const xform = (ps: Interp, fn: (m: Mat, x: number, y: number) => [number, number]): void => {
  const top = ps.stack[ps.stack.length - 1];
  const m = isArr(top) ? (ps.pop(), ps.mat(top) ?? ps.gs.ctm) : ps.gs.ctm;
  const [x, y] = ARGN(ps, 2), r = fn(m, x, y);
  ps.push(r[0], r[1]);
};

function shadingPaint(ps: Interp, sh: PsDict): Paint | null {
  const g = (k: string): PsObj | undefined => sh.v.get(k);
  const type = g('ShadingType'), coords = g('Coords'), fn = g('Function');
  if ((type !== 2 && type !== 3) || !isArr(coords) || !isDict(fn)) return null;
  const c = coords.v.map((x) => (typeof x === 'number' ? x : 0));
  const stops: Array<ReturnType<typeof stop>> = [];
  const addFn = (d: PsDict, t0: number, t1: number): void => {
    if (d.v.get('FunctionType') === 2) { stops.push(stop(t0, ps.colorOf(d.v.get('C0') ?? { t: 'arr', v: [0] })), stop(t1, ps.colorOf(d.v.get('C1') ?? { t: 'arr', v: [1] }))); return; }
    const fs = d.v.get('Functions'), bs = d.v.get('Bounds');
    if (!isArr(fs)) return;
    const b = isArr(bs) ? bs.v.map((x) => (typeof x === 'number' ? x : 0)) : [];
    fs.v.forEach((f, i) => { if (isDict(f)) addFn(f, i === 0 ? t0 : b[i - 1], i === fs.v.length - 1 ? t1 : b[i]); });
  };
  addFn(fn, 0, 1);
  if (stops.length < 2) return null;
  const u = (x: number, y: number): { x: number; y: number } => { const q = ps.user(x, y), m = ps.flip; return { x: m[0] * q.x + m[2] * q.y + m[4], y: m[1] * q.x + m[3] * q.y + m[5] }; };
  if (type === 2) { const a = u(c[0], c[1]), b = u(c[2], c[3]); return { type: 'gradient', gradient: { ...linearGradient(stops), geom: { x1: a.x, y1: a.y, x2: b.x, y2: b.y } } }; }
  const a = u(c[3], c[4]), e = u(c[3] + c[5], c[4]), fo = u(c[0], c[1]);
  return { type: 'gradient', gradient: { ...radialGradient(stops), geom: { x1: a.x, y1: a.y, x2: e.x, y2: e.y, fx: fo.x, fy: fo.y } } };
}

// The colour space an image takes its samples in: component count, and the lookup table of an Indexed space.
function imageSpace(o: PsObj, name: string): ImgSpace {
  if (isArr(o) && name === 'Indexed') {
    const base = o.v[1], bn = isArr(base) ? keyOf(base.v[0] ?? null) : keyOf(base ?? null), k = /CMYK/.test(bn) ? 4 : /RGB/.test(bn) ? 3 : 1, lookup = o.v[3];
    const hival = typeof o.v[2] === 'number' ? o.v[2] : 255;
    if (typeof lookup === 'string') {
      const pal = new Uint8Array((hival + 1) * 3), b = bytesOf(lookup);
      for (let i = 0; i <= hival; i++) {
        const q = (j: number): number => (b[i * k + j] ?? 0) / 255;
        if (k === 1) pal.fill(b[i] ?? 0, i * 3, i * 3 + 3);
        else if (k === 3) { pal[i * 3] = b[i * 3] ?? 0; pal[i * 3 + 1] = b[i * 3 + 1] ?? 0; pal[i * 3 + 2] = b[i * 3 + 2] ?? 0; }
        else { pal[i * 3] = 255 * (1 - q(0)) * (1 - q(3)); pal[i * 3 + 1] = 255 * (1 - q(1)) * (1 - q(3)); pal[i * 3 + 2] = 255 * (1 - q(2)) * (1 - q(3)); }
      }
      return { n: 1, palette: pal };
    }
    return { n: 1 };
  }
  return { n: /CMYK/.test(name) ? 4 : /RGB|CalRGB|Lab/.test(name) ? 3 : 1 };
}

function imageOp(ps: Interp, kind: 'image' | 'colorimage' | 'imagemask'): void {
  const at = ps.lex.i;
  let ok = false;
  try { ok = paintImage(ps, kind); } catch (e) { if (e instanceof Error && /too long|stackunderflow/.test(e.message)) throw e; }
  if (ok) return;
  ps.skipped.add(kind === 'imagemask' ? 'image masks' : 'images');
  if (ps.lex.i === at) skipImageData(ps);
}

function skipImageData(ps: Interp): void {
  const s = ps.lex.s, at = ps.lex.i, a85 = s.indexOf('~>', at), next = s.slice(at, at + 400);
  if (a85 >= 0 && !/\b(grestore|restore|showpage)\b/.test(s.slice(at, Math.min(a85, at + 64)))) { ps.lex.i = a85 + 2; return; }
  if (/^\s*[0-9a-fA-F\s]+/.test(next)) { let j = at; while (j < s.length && /[0-9a-fA-F\s>]/.test(s[j])) j++; ps.lex.i = j; }
}

const OPS: Record<string, (ps: Interp) => void> = {
  pop: (ps) => { ps.pop(); }, exch: (ps) => { const b = ps.pop(), a = ps.pop(); ps.push(b, a); }, dup: (ps) => { const a = ps.pop(); ps.push(a, a); },
  copy: (ps) => { const n = ps.num(); ps.push(...ps.stack.slice(ps.stack.length - n)); }, index: (ps) => { const n = ps.num(); ps.push(ps.stack[ps.stack.length - 1 - n] ?? null); },
  roll: (ps) => { const j = ps.num(), n = ps.num(); if (n <= 0) return; const part = ps.stack.splice(ps.stack.length - n, n), k = ((j % n) + n) % n; ps.push(...part.slice(n - k), ...part.slice(0, n - k)); },
  clear: (ps) => { ps.stack = []; }, count: (ps) => ps.push(ps.stack.length), mark: (ps) => ps.push({ t: 'mark' }),
  cleartomark: (ps) => { while (ps.stack.length) { const o = ps.pop(); if (typeof o === 'object' && o !== null && (o as { t?: string }).t === 'mark') break; } },
  counttomark: (ps) => { let n = 0; for (let i = ps.stack.length - 1; i >= 0; i--, n++) { const o = ps.stack[i]; if (typeof o === 'object' && o !== null && (o as { t?: string }).t === 'mark') break; } ps.push(n); },
  add: (ps) => { const b = ps.num(), a = ps.num(); ps.push(a + b); }, sub: (ps) => { const b = ps.num(), a = ps.num(); ps.push(a - b); }, mul: (ps) => { const b = ps.num(), a = ps.num(); ps.push(a * b); },
  div: (ps) => { const b = ps.num(), a = ps.num(); ps.push(b ? a / b : 0); }, idiv: (ps) => { const b = ps.num(), a = ps.num(); ps.push(b ? Math.trunc(a / b) : 0); }, mod: (ps) => { const b = ps.num(), a = ps.num(); ps.push(b ? a % b : 0); },
  neg: (ps) => ps.push(-ps.num()), abs: (ps) => ps.push(Math.abs(ps.num())), sqrt: (ps) => ps.push(Math.sqrt(Math.max(0, ps.num()))), exp: (ps) => { const e = ps.num(), b = ps.num(); ps.push(b ** e); },
  ln: (ps) => ps.push(Math.log(ps.num())), log: (ps) => ps.push(Math.log10(ps.num())), round: (ps) => ps.push(Math.round(ps.num())), floor: (ps) => ps.push(Math.floor(ps.num())), ceiling: (ps) => ps.push(Math.ceil(ps.num())), truncate: (ps) => ps.push(Math.trunc(ps.num())),
  cvi: (ps) => { const v = ps.pop(); ps.push(Math.trunc(typeof v === 'string' ? parseFloat(v) : Number(v) || 0)); }, cvr: (ps) => { const v = ps.pop(); ps.push(typeof v === 'string' ? parseFloat(v) : Number(v) || 0); },
  sin: (ps) => ps.push(Math.sin((ps.num() * Math.PI) / 180)), cos: (ps) => ps.push(Math.cos((ps.num() * Math.PI) / 180)), atan: (ps) => { const x = ps.num(), y = ps.num(); let a = (Math.atan2(y, x) * 180) / Math.PI; if (a < 0) a += 360; ps.push(a); },
  rand: (ps) => ps.push(Math.floor(Math.random() * 2147483647)), srand: (ps) => { ps.pop(); }, rrand: (ps) => ps.push(0),
  eq: (ps) => { const b = ps.pop(), a = ps.pop(); ps.push(keyOf(a) === keyOf(b)); }, ne: (ps) => { const b = ps.pop(), a = ps.pop(); ps.push(keyOf(a) !== keyOf(b)); },
  lt: (ps) => { const b = ps.num(), a = ps.num(); ps.push(a < b); }, gt: (ps) => { const b = ps.num(), a = ps.num(); ps.push(a > b); }, le: (ps) => { const b = ps.num(), a = ps.num(); ps.push(a <= b); }, ge: (ps) => { const b = ps.num(), a = ps.num(); ps.push(a >= b); },
  and: (ps) => { const b = ps.pop(), a = ps.pop(); ps.push(typeof a === 'boolean' ? a && !!b : (Number(a) & Number(b))); }, or: (ps) => { const b = ps.pop(), a = ps.pop(); ps.push(typeof a === 'boolean' ? a || !!b : (Number(a) | Number(b))); },
  not: (ps) => { const a = ps.pop(); ps.push(typeof a === 'boolean' ? !a : ~Number(a)); }, xor: (ps) => { const b = ps.pop(), a = ps.pop(); ps.push(typeof a === 'boolean' ? a !== b : (Number(a) ^ Number(b))); }, bitshift: (ps) => { const s = ps.num(), a = ps.num(); ps.push(s >= 0 ? a << s : a >> -s); },
  if: (ps) => { const p = ps.pop(), c = ps.pop(); if (c === true) ps.call(p); }, ifelse: (ps) => { const b = ps.pop(), a = ps.pop(), c = ps.pop(); ps.call(c === true ? a : b); },
  exec: (ps) => ps.call(ps.pop()),
  for: (ps) => { const p = ps.pop(), lim = ps.num(), inc = ps.num(), init = ps.num(); try { for (let v = init, k = 0; (inc >= 0 ? v <= lim : v >= lim) && k < 100000; v += inc, k++) { ps.push(v); ps.call(p); } } catch (e) { if (!(e instanceof ExitSignal)) throw e; } },
  repeat: (ps) => { const p = ps.pop(), n = ps.num(); try { for (let i = 0; i < Math.min(n, 100000); i++) ps.call(p); } catch (e) { if (!(e instanceof ExitSignal)) throw e; } },
  loop: (ps) => { const p = ps.pop(); try { for (let i = 0; i < 100000; i++) ps.call(p); } catch (e) { if (!(e instanceof ExitSignal)) throw e; } },
  forall: (ps) => { const p = ps.pop(), o = ps.pop(); try { if (isArr(o) || isProc(o)) for (const x of o.v) { ps.push(x); ps.call(p); } else if (isDict(o)) for (const [k, v] of o.v) { ps.push({ t: 'name', v: k, lit: true }, v); ps.call(p); } else if (typeof o === 'string') for (const ch of o) { ps.push(ch.charCodeAt(0)); ps.call(p); } } catch (e) { if (!(e instanceof ExitSignal)) throw e; } },
  exit: () => { throw new ExitSignal(); }, stop: () => { throw new StopSignal(); },
  stopped: (ps) => { const p = ps.pop(); try { ps.call(p); ps.push(false); } catch (e) { if (e instanceof StopSignal || (e instanceof Error && !/too long/.test(e.message) && !(e instanceof ExitSignal))) ps.push(true); else throw e; } },
  '[': (ps) => ps.push({ t: 'mark' }), '<<': (ps) => ps.push({ t: 'mark' }),
  ']': (ps) => { const v: PsObj[] = []; while (ps.stack.length) { const o = ps.pop(); if (typeof o === 'object' && o !== null && (o as { t?: string }).t === 'mark') break; v.unshift(o); } ps.push({ t: 'arr', v }); },
  '>>': (ps) => { const v: PsObj[] = []; while (ps.stack.length) { const o = ps.pop(); if (typeof o === 'object' && o !== null && (o as { t?: string }).t === 'mark') break; v.unshift(o); } const m = new Map<string, PsObj>(); for (let i = 0; i + 1 < v.length; i += 2) m.set(keyOf(v[i]), v[i + 1]); ps.push({ t: 'dict', v: m }); },
  array: (ps) => ps.push({ t: 'arr', v: new Array(Math.max(0, Math.min(65535, ps.num()))).fill(null) }), string: (ps) => ps.push(' '.repeat(Math.max(0, Math.min(65535, ps.num())))),
  dict: (ps) => { ps.num(); ps.push({ t: 'dict', v: new Map() }); }, begin: (ps) => { const d = ps.pop(); if (isDict(d)) ps.dicts.push(d.v); }, end: (ps) => { if (ps.dicts.length > 2) ps.dicts.pop(); },
  def: (ps) => { const v = ps.pop(), k = ps.pop(); ps.dicts[ps.dicts.length - 1].set(keyOf(k), v); },
  store: (ps) => { const v = ps.pop(), k = keyOf(ps.pop()); for (let i = ps.dicts.length - 1; i >= 0; i--) if (ps.dicts[i].has(k)) { ps.dicts[i].set(k, v); return; } ps.dicts[ps.dicts.length - 1].set(k, v); },
  load: (ps) => { const k = keyOf(ps.pop()); ps.push(ps.lookup(k) ?? null); },
  where: (ps) => { const k = keyOf(ps.pop()); for (let i = ps.dicts.length - 1; i >= 0; i--) if (ps.dicts[i].has(k)) { ps.push({ t: 'dict', v: ps.dicts[i] }, true); return; } ps.push(false); },
  known: (ps) => { const k = keyOf(ps.pop()), d = ps.pop(); ps.push(isDict(d) && d.v.has(k)); }, undef: (ps) => { const k = keyOf(ps.pop()), d = ps.pop(); if (isDict(d)) d.v.delete(k); },
  currentdict: (ps) => ps.push({ t: 'dict', v: ps.dicts[ps.dicts.length - 1] }), countdictstack: (ps) => ps.push(ps.dicts.length),
  get: (ps) => { const k = ps.pop(), o = ps.pop(); if (isDict(o)) ps.push(o.v.get(keyOf(k)) ?? null); else if (isArr(o) || isProc(o)) ps.push(o.v[Number(k)] ?? null); else if (typeof o === 'string') ps.push(o.charCodeAt(Number(k)) || 0); else ps.push(null); },
  put: (ps) => { const v = ps.pop(), k = ps.pop(), o = ps.pop(); if (isDict(o)) o.v.set(keyOf(k), v); else if (isArr(o) || isProc(o)) o.v[Number(k)] = v; },
  length: (ps) => { const o = ps.pop(); ps.push(isDict(o) ? o.v.size : isArr(o) || isProc(o) ? o.v.length : typeof o === 'string' ? o.length : 0); },
  getinterval: (ps) => { const n = ps.num(), i = ps.num(), o = ps.pop(); if (isArr(o) || isProc(o)) ps.push({ t: o.t, v: o.v.slice(i, i + n) } as PsObj); else ps.push(typeof o === 'string' ? o.slice(i, i + n) : ''); },
  putinterval: (ps) => { ps.pop(); ps.pop(); ps.pop(); },
  aload: (ps) => { const a = ps.pop(); if (isArr(a) || isProc(a)) ps.push(...a.v); ps.push(a); },
  astore: (ps) => { const a = ps.pop(); if (isArr(a)) { const n = a.v.length; a.v = ps.stack.splice(ps.stack.length - n, n); ps.push(a); } },
  bind: () => undefined, cvx: (ps) => { const o = ps.pop(); ps.push(isArr(o) ? { t: 'proc', v: o.v } : isName(o) ? { ...o, lit: false } : o); }, cvlit: (ps) => { const o = ps.pop(); ps.push(isProc(o) ? { t: 'arr', v: o.v } : isName(o) ? { ...o, lit: true } : o); },
  xcheck: (ps) => { const o = ps.pop(); ps.push(isProc(o) || (isName(o) && !o.lit)); }, cvn: (ps) => { const o = ps.pop(); ps.push({ t: 'name', v: keyOf(o), lit: true }); },
  cvs: (ps) => { ps.pop(); const o = ps.pop(); ps.push(keyOf(o)); }, type: (ps) => { const o = ps.pop(); ps.push({ t: 'name', v: typeof o === 'number' ? (Number.isInteger(o) ? 'integertype' : 'realtype') : typeof o === 'boolean' ? 'booleantype' : typeof o === 'string' ? 'stringtype' : o === null ? 'nulltype' : isDict(o) ? 'dicttype' : isArr(o) || isProc(o) ? 'arraytype' : isName(o) ? 'nametype' : 'operatortype', lit: false }); },
  readonly: () => undefined, executeonly: () => undefined, noaccess: () => undefined, rcheck: (ps) => { ps.pop(); ps.push(true); }, wcheck: (ps) => { ps.pop(); ps.push(true); },
  languagelevel: (ps) => ps.push(3), version: (ps) => ps.push('3010'), product: (ps) => ps.push('formpath'), revision: (ps) => ps.push(1), vmstatus: (ps) => ps.push(0, 0, 1e7),
  currentfile: (ps) => ps.push(ps.rawFile()),
  filter: (ps) => {
    const name = keyOf(ps.pop());
    let count = 0, eod = '';
    if (name === 'SubFileDecode') {
      let top = ps.stack[ps.stack.length - 1];
      if (isDict(top)) { ps.pop(); count = typeof top.v.get('EODCount') === 'number' ? (top.v.get('EODCount') as number) : 0; const s = top.v.get('EODString'); eod = typeof s === 'string' ? s : ''; }
      else {
        if (typeof top === 'string') { eod = top; ps.pop(); top = ps.stack[ps.stack.length - 1]; }
        if (typeof top === 'number') { count = top; ps.pop(); }
      }
    } else while (typeof ps.stack[ps.stack.length - 1] === 'number' || isDict(ps.stack[ps.stack.length - 1])) ps.pop();
    const src = ps.pop();
    const base: PsStream | null = isFile(src) ? src.st : typeof src === 'string' ? bytesStream(bytesOf(src)) : null;
    const out = base ? (name === 'SubFileDecode' ? subStream(base, count, eod) : filterStream(name, base)) : null;
    if (!base || !out) { ps.skipped.add(`images with the ${name} filter`); ps.push(ps.rawFile()); return; }
    if (base.raw || base.live) out.live = true;
    ps.push({ t: 'file', st: out });
  },
  readhexstring: (ps) => {
    const s = ps.pop(), f = ps.pop(), n = typeof s === 'string' ? s.length : 0;
    let out = '', hi = -1, ok = false;
    if (isFile(f)) {
      for (;;) {
        if (out.length >= n) { ok = true; break; }
        const c = f.st.get();
        if (c < 0 || c === 62) break;
        const v = c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 70 ? c - 55 : c >= 97 && c <= 102 ? c - 87 : -1;
        if (v < 0) continue;
        if (hi < 0) hi = v; else { out += String.fromCharCode((hi << 4) | v); hi = -1; }
      }
    }
    ps.push(out, ok);
  },
  readstring: (ps) => {
    const s = ps.pop(), f = ps.pop(), n = typeof s === 'string' ? s.length : 0;
    let out = '';
    if (isFile(f)) while (out.length < n) { const c = f.st.get(); if (c < 0) break; out += String.fromCharCode(c); }
    ps.push(out, out.length === n);
  },
  readline: (ps) => {
    const s = ps.pop(), f = ps.pop(), n = typeof s === 'string' ? s.length : 0;
    let out = '', ok = false;
    if (isFile(f)) for (;;) { const c = f.st.get(); if (c < 0) break; if (c === 10 || c === 13) { ok = true; break; } if (out.length < n) out += String.fromCharCode(c); }
    ps.push(out, ok);
  },
  closefile: (ps) => { ps.pop(); }, flushfile: (ps) => { ps.pop(); },
  print: (ps) => { ps.pop(); }, '=': (ps) => { ps.pop(); }, '==': (ps) => { ps.pop(); }, flush: () => undefined, pstack: () => undefined,
  save: (ps) => { ps.gstack.push(ps.cloneGs()); ps.push({ t: 'save', depth: ps.gstack.length }); },
  restore: (ps) => { const s = ps.pop() as { depth?: number }; const d = s?.depth ?? ps.gstack.length; while (ps.gstack.length > d) ps.gstack.pop(); const g = ps.gstack.pop(); if (g) ps.gs = g; },
  gsave: (ps) => { ps.gstack.push(ps.cloneGs()); }, grestore: (ps) => { const g = ps.gstack.pop(); if (g) ps.gs = g; }, grestoreall: (ps) => { const g = ps.gstack[0]; ps.gstack = []; if (g) ps.gs = g; },
  initgraphics: (ps) => { ps.gs = { ...ps.gs, ctm: [1, 0, 0, 1, 0, 0], path: [], cp: null, color: { kind: 'gray', k: 100 }, lw: 1, clip: null }; },
  showpage: () => undefined, copypage: () => undefined, erasepage: () => undefined, setpagedevice: (ps) => { ps.pop(); }, setglobal: (ps) => { ps.pop(); }, currentglobal: (ps) => ps.push(false),
  setoverprint: (ps) => { ps.pop(); }, setflat: (ps) => { ps.pop(); }, currentflat: (ps) => ps.push(1), setstrokeadjust: (ps) => { ps.pop(); }, sethalftone: (ps) => { ps.pop(); }, setscreen: (ps) => { ps.pop(); ps.pop(); ps.pop(); }, settransfer: (ps) => { ps.pop(); }, setsmoothness: (ps) => { ps.pop(); }, setcolorrendering: (ps) => { ps.pop(); }, setblackgeneration: (ps) => { ps.pop(); }, setundercolorremoval: (ps) => { ps.pop(); },
  matrix: (ps) => ps.push(matObj([1, 0, 0, 1, 0, 0])), identmatrix: (ps) => { ps.pop(); ps.push(matObj([1, 0, 0, 1, 0, 0])); }, defaultmatrix: (ps) => { ps.pop(); ps.push(matObj([1, 0, 0, 1, 0, 0])); },
  currentmatrix: (ps) => { ps.pop(); ps.push(matObj(ps.gs.ctm)); }, setmatrix: (ps) => { const m = ps.mat(ps.pop()); if (m) ps.gs.ctm = m; }, initmatrix: (ps) => { ps.gs.ctm = [1, 0, 0, 1, 0, 0]; },
  concat: (ps) => { const m = ps.mat(ps.pop()); if (m) ps.gs.ctm = mul(ps.gs.ctm, m); },
  concatmatrix: (ps) => { ps.pop(); const b = ps.mat(ps.pop()) ?? [1, 0, 0, 1, 0, 0], a = ps.mat(ps.pop()) ?? [1, 0, 0, 1, 0, 0]; ps.push(matObj(mul(b, a))); },
  invertmatrix: (ps) => { ps.pop(); const a = ps.mat(ps.pop()) ?? [1, 0, 0, 1, 0, 0]; ps.push(matObj(inv(a))); },
  translate: (ps) => { const top = ps.stack[ps.stack.length - 1]; if (isArr(top)) { ps.pop(); const [x, y] = ARGN(ps, 2); ps.push(matObj([1, 0, 0, 1, x, y])); return; } const [x, y] = ARGN(ps, 2); ps.gs.ctm = mul(ps.gs.ctm, [1, 0, 0, 1, x, y]); },
  scale: (ps) => { const top = ps.stack[ps.stack.length - 1]; if (isArr(top)) { ps.pop(); const [x, y] = ARGN(ps, 2); ps.push(matObj([x, 0, 0, y, 0, 0])); return; } const [x, y] = ARGN(ps, 2); ps.gs.ctm = mul(ps.gs.ctm, [x, 0, 0, y, 0, 0]); },
  rotate: (ps) => { const top = ps.stack[ps.stack.length - 1]; const isM = isArr(top); if (isM) ps.pop(); const a = (ps.num() * Math.PI) / 180, m: Mat = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]; if (isM) ps.push(matObj(m)); else ps.gs.ctm = mul(ps.gs.ctm, m); },
  transform: (ps) => xform(ps, (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]), dtransform: (ps) => xform(ps, (m, x, y) => [m[0] * x + m[2] * y, m[1] * x + m[3] * y]),
  itransform: (ps) => xform(ps, (m, x, y) => { const i = inv(m); return [i[0] * x + i[2] * y + i[4], i[1] * x + i[3] * y + i[5]]; }), idtransform: (ps) => xform(ps, (m, x, y) => { const i = inv(m); return [i[0] * x + i[2] * y, i[1] * x + i[3] * y]; }),
  newpath: (ps) => { ps.gs.path = []; ps.gs.cp = null; },
  moveto: (ps) => { const [x, y] = ARGN(ps, 2); ps.moveTo(x, y); }, lineto: (ps) => { const [x, y] = ARGN(ps, 2); ps.lineTo(x, y); },
  rmoveto: (ps) => { const [dx, dy] = ARGN(ps, 2), i = inv(ps.gs.ctm), cp = ps.gs.cp ?? { x: 0, y: 0 }, u = { x: i[0] * cp.x + i[2] * cp.y + i[4], y: i[1] * cp.x + i[3] * cp.y + i[5] }; ps.moveTo(u.x + dx, u.y + dy); },
  rlineto: (ps) => { const [dx, dy] = ARGN(ps, 2), i = inv(ps.gs.ctm), cp = ps.gs.cp ?? { x: 0, y: 0 }, u = { x: i[0] * cp.x + i[2] * cp.y + i[4], y: i[1] * cp.x + i[3] * cp.y + i[5] }; ps.lineTo(u.x + dx, u.y + dy); },
  curveto: (ps) => { const [a, b, c, d, e, f] = ARGN(ps, 6); ps.curveTo(a, b, c, d, e, f); },
  rcurveto: (ps) => { const [a, b, c, d, e, f] = ARGN(ps, 6), i = inv(ps.gs.ctm), cp = ps.gs.cp ?? { x: 0, y: 0 }, u = { x: i[0] * cp.x + i[2] * cp.y + i[4], y: i[1] * cp.x + i[3] * cp.y + i[5] }; ps.curveTo(u.x + a, u.y + b, u.x + c, u.y + d, u.x + e, u.y + f); },
  closepath: (ps) => ps.closePath(),
  arc: (ps) => { const [x, y, r, a, b] = ARGN(ps, 5); ps.arc(x, y, r, a, b, false); }, arcn: (ps) => { const [x, y, r, a, b] = ARGN(ps, 5); ps.arc(x, y, r, a, b, true); },
  arct: (ps) => { const [, , x2, y2] = ARGN(ps, 5); ps.lineTo(x2, y2); }, arcto: (ps) => { const [, , x2, y2] = ARGN(ps, 5); ps.lineTo(x2, y2); ps.push(0, 0, 0, 0); },
  currentpoint: (ps) => { const cp = ps.gs.cp ?? { x: 0, y: 0 }, i = inv(ps.gs.ctm); ps.push(i[0] * cp.x + i[2] * cp.y + i[4], i[1] * cp.x + i[3] * cp.y + i[5]); },
  fill: (ps) => ps.paintPath({ type: 'color', color: ps.gs.color }, false, false), eofill: (ps) => ps.paintPath({ type: 'color', color: ps.gs.color }, false, true), stroke: (ps) => ps.paintPath(null, true, false),
  rectfill: (ps) => { const top = ps.stack[ps.stack.length - 1]; if (isArr(top)) { ps.pop(); return; } const [x, y, w, h] = ARGN(ps, 4); ps.gs.path = []; ps.moveTo(x, y); ps.lineTo(x + w, y); ps.lineTo(x + w, y + h); ps.lineTo(x, y + h); ps.closePath(); ps.paintPath({ type: 'color', color: ps.gs.color }, false, false); },
  rectstroke: (ps) => { const top = ps.stack[ps.stack.length - 1]; if (isArr(top)) { ps.pop(); return; } const [x, y, w, h] = ARGN(ps, 4); ps.gs.path = []; ps.moveTo(x, y); ps.lineTo(x + w, y); ps.lineTo(x + w, y + h); ps.lineTo(x, y + h); ps.closePath(); ps.paintPath(null, true, false); },
  rectclip: (ps) => { const [x, y, w, h] = ARGN(ps, 4); ps.gs.path = []; ps.moveTo(x, y); ps.lineTo(x + w, y); ps.lineTo(x + w, y + h); ps.lineTo(x, y + h); ps.closePath(); ps.gs.clip = { d: ps.gs.path, even: false, key: ++ps.clipKey }; ps.gs.path = []; ps.gs.cp = null; },
  clip: (ps) => { if (ps.gs.path.length) ps.gs.clip = { d: ps.gs.path.map((s) => ({ closed: true, pts: s.pts })), even: false, key: ++ps.clipKey }; }, eoclip: (ps) => { if (ps.gs.path.length) ps.gs.clip = { d: ps.gs.path.map((s) => ({ closed: true, pts: s.pts })), even: true, key: ++ps.clipKey }; },
  initclip: (ps) => { ps.gs.clip = null; }, clippath: (ps) => { ps.gs.path = ps.gs.clip ? ps.gs.clip.d.map((s) => ({ closed: true, pts: s.pts.map((a) => ({ ...a })) })) : []; },
  strokepath: () => undefined, flattenpath: () => undefined, reversepath: () => undefined,
  pathbbox: (ps) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const i = inv(ps.gs.ctm); for (const s of ps.gs.path) for (const a of s.pts) { const x = i[0] * a.x + i[2] * a.y + i[4], y = i[1] * a.x + i[3] * a.y + i[5]; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } if (!Number.isFinite(x0)) { x0 = y0 = x1 = y1 = 0; } ps.push(x0, y0, x1, y1); },
  setlinewidth: (ps) => { ps.gs.lw = ps.num(); }, currentlinewidth: (ps) => ps.push(ps.gs.lw),
  setlinecap: (ps) => { const v = ps.num(); ps.gs.cap = v === 1 ? 'round' : v === 2 ? 'square' : 'butt'; }, setlinejoin: (ps) => { const v = ps.num(); ps.gs.join = v === 1 ? 'round' : v === 2 ? 'bevel' : 'miter'; },
  setmiterlimit: (ps) => { ps.gs.miter = ps.num(); }, setdash: (ps) => { const off = ps.num(), a = ps.pop(); ps.gs.dash = isArr(a) ? a.v.map((x) => (typeof x === 'number' ? x : 0)) : []; ps.gs.dashOff = off; },
  setgray: (ps) => { ps.gs.space = 1; ps.setColor([ps.num()]); }, setrgbcolor: (ps) => { const c = ARGN(ps, 3); ps.gs.space = 3; ps.setColor(c); }, setcmykcolor: (ps) => { const c = ARGN(ps, 4); ps.gs.space = 4; ps.setColor(c); },
  sethsbcolor: (ps) => { const [h, s, v] = ARGN(ps, 3), i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6]; ps.gs.space = 3; ps.setColor([r, g, b]); },
  currentgray: (ps) => ps.push(ps.gs.color.kind === 'gray' ? 1 - ps.gs.color.k / 100 : 0), currentrgbcolor: (ps) => { const c = ps.gs.color; if (c.kind === 'rgb') ps.push(c.r / 255, c.g / 255, c.b / 255); else ps.push(0, 0, 0); },
  setcolorspace: (ps) => { const o = ps.pop(); const name = isArr(o) ? keyOf(o.v[0] ?? null) : keyOf(o); ps.imgSpace = imageSpace(o, name); ps.gs.space = /CMYK/.test(name) ? 4 : /RGB|CalRGB|Lab/.test(name) ? 3 : /Separation|Indexed|DeviceN/.test(name) ? (isArr(o) && /Separation/.test(name) && /CMYK/.test(keyOf(o.v[2] ?? null)) ? -4 : 1) : 1; ps.setColor(ps.gs.space === 4 ? [0, 0, 0, 1] : ps.gs.space === 3 ? [0, 0, 0] : [0]); },
  setcolor: (ps) => { const n = ps.gs.space; if (n === -4) { const t = ps.num(); ps.gs.color = { kind: 'cmyk', c: 0, m: 0, y: 0, k: t * 100 }; return; } const comps: number[] = []; for (let i = 0; i < Math.max(1, n); i++) { const v = ps.stack[ps.stack.length - 1]; if (typeof v !== 'number') break; comps.unshift(ps.num()); } ps.setColor(comps); },
  setpattern: (ps) => { ps.pop(); }, makepattern: (ps) => { ps.pop(); ps.pop(); ps.push({ t: 'dict', v: new Map() }); },
  shfill: (ps) => { const sh = ps.pop(); if (!isDict(sh)) return; const paint = shadingPaint(ps, sh); const c = ps.gs.clip; if (!paint || !c) { ps.skipped.add('shfill'); return; } const g = ps.gs.clip; ps.gs.clip = null; ps.emit({ id: newId('p'), kind: 'path', d: ps.toDoc(c.d), rule: c.even ? 'evenodd' : 'nonzero', opacity: 1, blend: 'normal', ap: { items: [fillItem(paint)], effects: [] } }); ps.gs.clip = g; },
  image: (ps) => imageOp(ps, 'image'), colorimage: (ps) => imageOp(ps, 'colorimage'), imagemask: (ps) => imageOp(ps, 'imagemask'),
  findfont: (ps) => { const k = keyOf(ps.pop()); ps.push({ t: 'font', name: k, size: 1, m: [1, 0, 0, 1, 0, 0] }); }, definefont: (ps) => { const f = ps.pop(); ps.pop(); ps.push(f); }, undefinefont: (ps) => { ps.pop(); },
  scalefont: (ps) => { const s = ps.num(), f = ps.pop() as PsFont; ps.push({ t: 'font', name: f?.name ?? 'Helvetica', size: (f?.size ?? 1) * s, m: f?.m ?? [1, 0, 0, 1, 0, 0] }); },
  makefont: (ps) => { const m = ps.mat(ps.pop()) ?? [1, 0, 0, 1, 0, 0], f = ps.pop() as PsFont; ps.push({ t: 'font', name: f?.name ?? 'Helvetica', size: (f?.size ?? 1) * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])), m }); },
  setfont: (ps) => { const f = ps.pop(); if (typeof f === 'object' && f !== null && (f as PsFont).t === 'font') ps.gs.font = f as PsFont; },
  selectfont: (ps) => { const s = ps.pop(), k = keyOf(ps.pop()); ps.gs.font = { t: 'font', name: k, size: typeof s === 'number' ? s : 12, m: [1, 0, 0, 1, 0, 0] }; },
  currentfont: (ps) => ps.push(ps.gs.font ?? { t: 'font', name: 'Helvetica', size: 12, m: [1, 0, 0, 1, 0, 0] }),
  stringwidth: (ps) => { const s = ps.pop(); ps.push((typeof s === 'string' ? s.length : 0) * 0.5 * (ps.gs.font?.size ?? 12), 0); },
  show: (ps) => showText(ps, ps.pop()), ashow: (ps) => { const s = ps.pop(); ps.pop(); ps.pop(); showText(ps, s); }, widthshow: (ps) => { const s = ps.pop(); ps.pop(); ps.pop(); ps.pop(); showText(ps, s); },
  awidthshow: (ps) => { const s = ps.pop(); for (let i = 0; i < 5; i++) ps.pop(); showText(ps, s); }, xshow: (ps) => { ps.pop(); showText(ps, ps.pop()); }, yshow: (ps) => { ps.pop(); showText(ps, ps.pop()); }, xyshow: (ps) => { ps.pop(); showText(ps, ps.pop()); },
  kshow: (ps) => { const s = ps.pop(); ps.pop(); showText(ps, s); }, charpath: (ps) => { ps.pop(); ps.pop(); ps.skipped.add('charpath'); },
};

function showText(ps: Interp, s: PsObj): void {
  if (typeof s !== 'string' || !s.trim() || !ps.gs.cp) return;
  const f = ps.gs.font ?? { t: 'font' as const, name: 'Helvetica', size: 12, m: [1, 0, 0, 1, 0, 0] as Mat };
  const i = inv(ps.gs.ctm), cp = ps.gs.cp, u = { x: i[0] * cp.x + i[2] * cp.y + i[4], y: i[1] * cp.x + i[3] * cp.y + i[5] };
  const xf = mul(mul(ps.flip, mul(ps.gs.ctm, [1, 0, 0, 1, u.x, u.y])), [1, 0, 0, -1, 0, 0]);
  const fam = FONT_MAP.find(([re]) => re.test(f.name))?.[1] ?? f.name.split('-')[0].replace(/MT$|PS$/, '');
  const style = /BoldItalic|BoldOblique/i.test(f.name) ? 'Bold Italic' : /Bold/i.test(f.name) ? 'Bold' : /Italic|Oblique/i.test(f.name) ? 'Italic' : 'Regular';
  ps.emit({ id: newId('t'), kind: 'text', mode: 'point', spans: [{ text: s, style: { ...DEFAULT_CHAR, font: fam, style, size: f.size, fill: { type: 'color', color: ps.gs.color } } }], para: { ...DEFAULT_PARA }, xf, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } });
  const adv = s.length * 0.5 * f.size;
  ps.gs.cp = ps.user(u.x + adv, u.y);
}

export interface EpsRead { doc: Doc; skipped: string[]; assets: Map<string, Blob> }

// One char per byte. TextDecoder's latin1 is really windows-1252, which would corrupt binary image data.
function latin1(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 8192) out += String.fromCharCode.apply(null, b.subarray(i, i + 8192) as unknown as number[]);
  return out;
}

export function epsSource(data: ArrayBuffer): string {
  const b = new Uint8Array(data);
  if (b[0] === 0xc5 && b[1] === 0xd0 && b[2] === 0xd3 && b[3] === 0xc6) {
    const dv = new DataView(data), off = dv.getUint32(4, true), len = dv.getUint32(8, true);
    return latin1(b.subarray(off, off + len));
  }
  return latin1(b);
}

async function pngBlob(rgba: Uint8ClampedArray, w: number, h: number): Promise<Blob> {
  const img = new ImageData(new Uint8ClampedArray(rgba), w, h);
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h);
    c.getContext('2d')?.putImageData(img, 0, 0);
    return c.convertToBlob({ type: 'image/png' });
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d')?.putImageData(img, 0, 0);
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode an image.'))), 'image/png'));
}

export async function readEpsVector(data: ArrayBuffer, title: string): Promise<EpsRead> {
  const src = epsSource(data);
  if (!/^%!PS/.test(src.trimStart())) throw new Error('This file is not PostScript or EPS.');
  const hi = /%%HiResBoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/.exec(src), lo = /%%BoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/.exec(src);
  const bb = (hi ?? lo)?.slice(1).map(Number) ?? [0, 0, 612, 792];
  const [x0, y0, x1, y1] = bb, W = Math.max(1, x1 - x0), H = Math.max(1, y1 - y0);
  const ps = new Interp(new Lexer(src), [1, 0, 0, -1, -x0, y1]);
  ps.run();
  const doc = newDoc(W, H, { title });
  doc.layers = [{ ...doc.layers[0], children: ps.out }];
  const assets = new Map<string, Blob>();
  for (const im of ps.images) {
    try {
      const blob = im.jpeg ? new Blob([im.jpeg as BlobPart], { type: 'image/jpeg' }) : await pngBlob(im.rgba as Uint8ClampedArray, im.w, im.h);
      assets.set(im.key, blob);
      doc.images[im.key] = { mime: blob.type, w: im.w, h: im.h };
    } catch { ps.skipped.add('images'); }
  }
  const skipped = [...ps.skipped].filter((k) => !/^(error|AI|Adobe)/.test(k)).slice(0, 12);
  return { doc, assets, skipped: [...new Set([...skipped.filter((k) => /image|shfill|charpath/.test(k)), ...(skipped.some((k) => !/image|shfill|charpath/.test(k)) ? ['operators it does not know'] : [])])] };
}
