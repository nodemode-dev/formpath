import { newId } from '../engine/doc';
import { mul, parseSvgD, pathLength, transformPath } from '../engine/geometry';
import { NONE, parseColor, solid } from '../engine/paint';
import { DEFAULT_CHAR, DEFAULT_PARA, glyphBox, layoutText } from '../engine/text';
import type { BlendMode, CharStyle, CharTouch, GroupNode, Mat, Paint, PathData, Rect, Span, TextAlign, TextNode, VNode } from '../engine';

type Style = Record<string, string>;

export interface TextEnv {
  own: (e: Element) => Style;
  inherited: Set<string>;
  paint: (v: string | undefined, bbox: () => Rect) => Paint | null;
  len: (v: string | undefined, d?: number) => number;
}

interface Frame { start: number; x: string[] | null; y: string[] | null; dx: string[] | null; dy: string[] | null; r: string[] | null; fs: number }
interface Rec {
  c: string; st: Style; fs: number; up: number; deco: string;
  x?: number; y?: number; dx: number; dy: number; rot?: number;
  pen: number; b: number; sz: number; pos: 'normal' | 'super' | 'sub'; sx: number; tr: number; ls: number;
}
interface Ln { recs: Rec[]; base: number; lead: number }

const SUP = 0.583, SUP_UP = 0.333, SUB_DOWN = 0.15;
const GENERIC: Record<string, string> = { 'sans-serif': 'Inter', 'system-ui': 'Inter', serif: 'Times New Roman', monospace: 'JetBrains Mono', cursive: 'Inter', fantasy: 'Inter' };
const NAMED_SIZE: Record<string, number> = { 'xx-small': 9, 'x-small': 10, small: 13, medium: 16, large: 18, 'x-large': 24, 'xx-large': 32 };

const unitless = (s: string): boolean => /^[+-]?[\d.]+(e[+-]?\d+)?$/i.test(s.trim());

function fontSize(v: string | undefined, parent: number, env: TextEnv): number {
  if (!v) return parent;
  const s = v.trim();
  if (NAMED_SIZE[s] !== undefined) return NAMED_SIZE[s];
  if (s === 'larger') return parent * 1.2;
  if (s === 'smaller') return parent / 1.2;
  if (s.endsWith('%')) return (parseFloat(s) / 100) * parent;
  if (s.endsWith('em')) return parseFloat(s) * parent;
  if (s.endsWith('ex')) return parseFloat(s) * parent * 0.5;
  const n = env.len(s, parent);
  return n > 0 ? n : parent;
}

function emLen(s: string, fs: number, env: TextEnv): number {
  if (s.endsWith('em')) return parseFloat(s) * fs;
  if (s.endsWith('ex')) return parseFloat(s) * fs * 0.5;
  if (s.endsWith('%')) return (parseFloat(s) / 100) * fs;
  return env.len(s, 0);
}

function shiftOf(v: string | undefined, fs: number, env: TextEnv): number {
  if (!v) return 0;
  const s = v.trim();
  if (s === 'baseline') return 0;
  if (s === 'super') return fs * SUP_UP;
  if (s === 'sub') return -fs * SUP_UP;
  return unitless(s) ? parseFloat(s) : emLen(s, fs, env);
}

function weightName(v: string | undefined): string {
  const s = (v ?? '400').trim();
  const w = s === 'bold' || s === 'bolder' ? 700 : s === 'normal' ? 400 : s === 'lighter' ? 300 : Number(s) || 400;
  return w >= 900 ? 'Black' : w >= 800 ? 'ExtraBold' : w >= 700 ? 'Bold' : w >= 600 ? 'Semibold' : w >= 500 ? 'Medium' : w <= 100 ? 'Thin' : w <= 200 ? 'ExtraLight' : w <= 300 ? 'Light' : 'Regular';
}

function familyOf(v: string | undefined): string {
  const first = (v ?? 'Inter').split(',')[0].replace(/["']/g, '').trim();
  return GENERIC[first.toLowerCase()] ?? (first || 'Inter');
}

const attrList = (e: Element, k: string): string[] | null => {
  const v = e.getAttribute(k);
  if (v === null) return null;
  const a = v.trim().split(/[\s,]+/).filter(Boolean);
  return a.length ? a : null;
};

function collect(e: Element, st0: Style, env: TextEnv, preserve: boolean): Rec[] {
  const out: Rec[] = [], frames: Frame[] = [];
  const add = (data: string, st: Style, fs: number, up: number, deco: string): void => {
    for (const ch of data) {
      const c = /\s/.test(ch) && ch !== ' ' ? ' ' : ch;
      if (!preserve && c === ' ' && (!out.length || out[out.length - 1].c === ' ')) continue;
      const r: Rec = { c, st, fs, up, deco, dx: 0, dy: 0, pen: 0, b: 0, sz: fs, pos: 'normal', sx: 0, tr: 0, ls: 0 };
      const idx = out.length;
      for (const f of frames) {
        const j = idx - f.start;
        if (j < 0) continue;
        if (f.x && j < f.x.length) r.x = emLen(f.x[j], fs, env);
        if (f.y && j < f.y.length) r.y = emLen(f.y[j], fs, env);
        if (f.dx && j < f.dx.length) r.dx = emLen(f.dx[j], fs, env);
        if (f.dy && j < f.dy.length) r.dy = emLen(f.dy[j], fs, env);
        if (f.r) r.rot = Number(f.r[Math.min(j, f.r.length - 1)]) || 0;
      }
      out.push(r);
    }
  };
  const visit = (el: Element, st: Style, fs: number, up: number, deco: string): void => {
    frames.push({ start: out.length, x: attrList(el, 'x'), y: attrList(el, 'y'), dx: attrList(el, 'dx'), dy: attrList(el, 'dy'), r: attrList(el, 'rotate'), fs });
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3 || node.nodeType === 4) { add(node.nodeValue ?? '', st, fs, up, deco); continue; }
      if (node.nodeType !== 1) continue;
      const c = node as Element, tag = c.nodeName.toLowerCase().replace(/^.*:/, '');
      if (tag !== 'tspan' && tag !== 'a' && tag !== 'textpath' && tag !== 'altglyph') continue;
      const own = env.own(c);
      const st2: Style = { ...Object.fromEntries(Object.entries(st).filter(([k]) => env.inherited.has(k))), ...own };
      visit(c, st2, fontSize(own['font-size'], fs, env), up + shiftOf(own['baseline-shift'], fs, env), `${deco} ${own['text-decoration'] ?? own['text-decoration-line'] ?? ''}`);
    }
    frames.pop();
  };
  visit(e, st0, fontSize(st0['font-size'], 16, env), 0, st0['text-decoration'] ?? '');
  if (!preserve && out.length && out[out.length - 1].c === ' ') out.pop();
  return out;
}

function splitLines(recs: Rec[]): Ln[] {
  const lines: Ln[] = [];
  let pen = 0, cur: Ln | null = null, lastX = -Infinity, curBase = 0, maxFs = 0;
  for (const r of recs) {
    if (r.y !== undefined) pen = r.y;
    pen += r.dy;
    r.pen = pen;
    if (cur) {
      const d = pen - curBase;
      const back = r.x !== undefined && r.x < lastX - 0.25;
      if (Math.abs(d) > 0.01 && (Math.abs(d) >= 0.6 * Math.max(maxFs, r.fs) || back)) cur = null;
    }
    if (!cur) { cur = { recs: [], base: pen, lead: 0 }; curBase = pen; maxFs = 0; lines.push(cur); }
    cur.recs.push(r);
    maxFs = Math.max(maxFs, r.fs);
    if (r.x !== undefined) lastX = r.x;
  }
  for (const ln of lines) {
    let best = ln.recs[0];
    for (const r of ln.recs) if (r.fs > best.fs + 1e-6) best = r;
    ln.base = best.pen;
  }
  return lines;
}

export interface PathOpts { d: PathData; offset: number; pct: boolean }

function oneLine(recs: Rec[]): Ln[] {
  let pen = 0;
  for (const r of recs) { pen += r.dy; r.pen = pen; }
  return [{ recs, base: 0, lead: 0 }];
}

export function importText(e: Element, st0: Style, m: Mat, env: TextEnv, opacity: number, blend: BlendMode, name?: string, path?: PathOpts): VNode[] {
  const preserve = /preserve/.test(e.getAttribute('xml:space') ?? '');
  const recs = collect(e, st0, env, preserve);
  if (!recs.length) return [];
  const K = path ? Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1 : 1;
  const lines = path ? oneLine(recs) : splitLines(recs);
  const cache = new Map<string, CharStyle>();
  const paintOf = (v: string | undefined): Paint => (v === undefined ? solid({ kind: 'rgb', r: 0, g: 0, b: 0 }) : env.paint(v, () => ({ x: 0, y: 0, w: 1, h: 1 })) ?? NONE);

  for (const ln of lines) {
    const mx = Math.max(...ln.recs.map((r) => r.fs));
    for (const r of ln.recs) {
      r.b = r.pen - ln.base - r.up;
      r.sz = r.fs; r.pos = 'normal';
      const ratio = r.fs / mx;
      if (Math.abs(ratio - SUP) < 0.03 && Math.abs(r.b + SUP_UP * mx) < 0.03 * mx) { r.sz = mx; r.pos = 'super'; r.b = 0; }
      else if (Math.abs(ratio - SUP) < 0.03 && Math.abs(r.b - SUB_DOWN * mx) < 0.03 * mx) { r.sz = mx; r.pos = 'sub'; r.b = 0; }
      const ls = r.st['letter-spacing'], ws = r.st['word-spacing'];
      let sp = ls && ls !== 'normal' ? emLen(ls, r.fs, env) : 0;
      if (r.c === ' ' && ws && ws !== 'normal') sp += emLen(ws, r.fs, env);
      r.ls = (sp / Math.max(0.1, r.sz)) * 1000;
    }
  }
  lines.forEach((ln, i) => { ln.lead = i === 0 ? 0 : Math.max(0.1, ln.base - lines[i - 1].base); });

  const styleOf = (r: Rec, ln: Ln, touch: CharTouch | undefined): CharStyle => {
    const it = /italic|oblique/.test(r.st['font-style'] ?? ''), w = weightName(r.st['font-weight']);
    const fam = familyOf(r.st['font-family']), style = it ? (w === 'Regular' ? 'Italic' : `${w} Italic`) : w;
    const stroke = r.st.stroke && r.st.stroke !== 'none' ? paintOf(r.st.stroke) : NONE;
    const sw = stroke.type !== 'none' ? env.len(r.st['stroke-width'], 1) : 1;
    const tt = r.st['text-transform'], sc = /small-caps/.test(r.st['font-variant'] ?? '');
    const s: CharStyle = {
      ...DEFAULT_CHAR, font: fam, style, size: r.sz * K, leading: ln.lead > 0 ? ln.lead : null, tracking: Math.round((r.ls + r.tr) * 1000) / 1000, baseline: Math.round(r.b * K * 1000) / 1000,
      fill: paintOf(r.st.fill), stroke, strokeWidth: sw * K, underline: /underline/.test(r.deco), strike: /line-through/.test(r.deco),
      caps: tt === 'uppercase' ? 'all' : sc ? 'small' : 'none', position: r.pos,
    };
    if (r.rot) s.rotate = -r.rot;
    if (touch) s.touch = touch;
    const key = JSON.stringify(s);
    const had = cache.get(key);
    if (had) return had;
    cache.set(key, s);
    return s;
  };

  const build = (group: Ln[], align: TextAlign, touches: Map<Rec, CharTouch>): { node: TextNode; starts: number[][] } => {
    const spans: Span[] = [], starts: number[][] = [];
    let at = 0;
    const push = (text: string, style: CharStyle): void => {
      const last = spans[spans.length - 1];
      if (last && last.style === style) last.text += text; else spans.push({ text, style });
      at += text.length;
    };
    group.forEach((ln, li) => {
      if (li > 0) push('\n', styleOf(ln.recs[0], ln, touches.get(ln.recs[0])));
      starts.push(ln.recs.map((r) => { const s = at; push(r.c, styleOf(r, ln, touches.get(r))); return s; }));
    });
    const node: TextNode = { id: newId('t'), kind: 'text', mode: 'point', spans, para: { ...DEFAULT_PARA, align }, xf: [1, 0, 0, 1, 0, 0], opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
    return { node, starts };
  };

  const natural = (group: Ln[], align: TextAlign, touches: Map<Rec, CharTouch>): { nat: number[][]; ends: number[]; box: Array<Array<ReturnType<typeof glyphBox> | null>>; start: number[] } => {
    const { node, starts } = build(group, align, touches), lay = layoutText(node);
    const byIndex = new Map<number, (typeof lay.glyphs)[number]>();
    for (const g of lay.glyphs) if (!g.syn && !byIndex.has(g.index)) byIndex.set(g.index, g);
    const nat: number[][] = [], box: Array<Array<ReturnType<typeof glyphBox> | null>> = [], ends: number[] = [], start: number[] = [];
    group.forEach((ln, li) => {
      const L = lay.lines[li];
      ends.push(L ? L.x + L.width : 0);
      start.push(L ? L.x : 0);
      const row: number[] = [], bx: Array<ReturnType<typeof glyphBox> | null> = [];
      let prev = L ? L.x : 0;
      ln.recs.forEach((_r, k) => {
        const g = byIndex.get(starts[li][k]);
        row.push(g ? g.x : prev);
        bx.push(g ? glyphBox(g) : null);
        prev = g ? g.x + g.w : prev;
      });
      nat.push(row); box.push(bx);
    });
    return { nat, ends, box, start };
  };

  const none = new Map<Rec, CharTouch>();
  if (path) {
    const sp = path.d[0];
    if (!sp || sp.pts.length < 2) return [];
    const anchorMode = recs[0].st['text-anchor'] ?? 'start', node = build(lines, 'left', none).node, total = pathLength(sp) || 1;
    const W = layoutText({ ...node }).lines[0]?.width ?? 0;
    const off = (path.pct ? path.offset * total : path.offset * K) - (anchorMode === 'middle' ? W / 2 : anchorMode === 'end' ? W : 0);
    node.mode = 'path'; node.path = path.d; node.xf = [1, 0, 0, 1, 0, 0];
    node.pathStart = Math.max(0, Math.min(1, off / total)); node.pathEnd = 1;
    node.opacity = opacity; node.blend = blend;
    if (name) node.name = name;
    return [node];
  }
  const first = natural(lines, 'left', none);
  lines.forEach((ln, li) => {
    const row = first.nat[li], end = first.ends[li];
    let x = ln.recs[0].x ?? (li > 0 ? lines[li - 1].recs[lines[li - 1].recs.length - 1].sx + (first.ends[li - 1] - first.nat[li - 1][lines[li - 1].recs.length - 1]) : 0);
    ln.recs.forEach((r, k) => {
      if (k > 0) x = ln.recs[k - 1].sx + (row[k] - row[k - 1]);
      if (r.x !== undefined) x = r.x;
      x += r.dx;
      r.sx = x;
    });
    let a = 0;
    while (a < ln.recs.length) {
      let b = a + 1;
      while (b < ln.recs.length && ln.recs[b].x === undefined) b++;
      const anchor = ln.recs[a].st['text-anchor'] ?? 'start';
      if (anchor === 'middle' || anchor === 'end') {
        const w = (b < ln.recs.length ? row[b] : end) - row[a], sh = anchor === 'middle' ? -w / 2 : -w;
        for (let k = a; k < b; k++) ln.recs[k].sx += sh;
      }
      a = b;
    }
  });

  const edges = lines.map((ln, li) => {
    const r0 = ln.recs[0], rl = ln.recs[ln.recs.length - 1], row = first.nat[li], k = ln.recs.length - 1;
    const left = r0.sx, right = rl.sx + (first.ends[li] - row[k]);
    return { left, right, center: (left + right) / 2 };
  });
  const same = (f: (e: (typeof edges)[number]) => number): boolean => edges.every((e) => Math.abs(f(e) - f(edges[0])) < 0.75);
  let align: TextAlign = 'left', groups: Ln[][] = [lines];
  if (lines.length > 1) {
    if (same((e) => e.left)) align = 'left';
    else if (same((e) => e.center)) align = 'center';
    else if (same((e) => e.right)) align = 'right';
    else groups = lines.map((l) => [l]);
  }

  const out: VNode[] = [];
  for (const group of groups) {
    const gi = group.map((l) => lines.indexOf(l));
    const ed = gi.map((i) => edges[i]);
    const X0 = align === 'center' ? ed[0].center : align === 'right' ? ed[0].right : ed[0].left;
    const touches = new Map<Rec, CharTouch>();
    let cur = natural(group, align, touches);
    group.forEach((ln, li) => ln.recs.forEach((r, k) => {
      if (!r.rot) return;
      const bx = cur.box[li][k];
      if (!bx) return;
      const a = (r.rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2;
      touches.set(r, { x: c * cx - s * cy - cx, y: s * cx + c * cy - cy, sx: 100, sy: 100, r: 0 });
    }));
    for (let pass = 0; pass < 4; pass++) {
      cur = natural(group, align, touches);
      let worst = 0;
      group.forEach((ln, li) => {
        const err = ln.recs.map((r, k) => r.sx - X0 - cur.nat[li][k]);
        for (let k = 1; k < ln.recs.length; k++) {
          const d = err[k] - err[k - 1];
          if (Math.abs(d) > 0.02) { ln.recs[k - 1].tr += (d / Math.max(0.1, ln.recs[k - 1].sz)) * 1000; worst = Math.max(worst, Math.abs(d)); }
        }
      });
      if (worst <= 0.02) break;
    }
    const built = build(group, align, touches);
    built.node.xf = mul(m, [1, 0, 0, 1, X0, group[0].base]);
    built.node.opacity = opacity; built.node.blend = blend;
    if (name) built.node.name = name;
    out.push(built.node);
  }
  if (out.length === 1) return out;
  const g: GroupNode = { id: newId('g'), kind: 'group', clip: false, children: out, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, ...(name ? { name } : {}) };
  return [g];
}

interface PathHint { d: string; s: number; e: number; f: number; fx: string; al: string; sp: number; pa: string; r: Array<{ t: string; ft: string; fs: string; z: number; c: string; k: number; b: number }> }

export function textFromHint(raw: string, m: Mat, opacity: number, blend: BlendMode, name?: string): TextNode | null {
  let h: PathHint;
  try { h = JSON.parse(raw) as PathHint; } catch { return null; }
  if (!h || typeof h.d !== 'string' || !Array.isArray(h.r) || !h.r.length) return null;
  const d = transformPath(parseSvgD(h.d), m), K = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
  if (!d.length) return null;
  const spans: Span[] = h.r.map((r) => {
    const c = parseColor(r.c);
    return { text: String(r.t), style: { ...DEFAULT_CHAR, font: r.ft, style: r.fs, size: r.z * K, tracking: r.k, baseline: r.b * K, fill: c ? solid(c) : solid({ kind: 'rgb', r: 0, g: 0, b: 0 }) } };
  });
  const node: TextNode = { id: newId('t'), kind: 'text', mode: 'path', spans, para: { ...DEFAULT_PARA, align: (['left', 'center', 'right'].includes(h.pa) ? h.pa : 'left') as TextAlign }, xf: [1, 0, 0, 1, 0, 0], path: d, pathStart: h.s, pathEnd: h.e, opacity, blend, ap: { items: [], effects: [] } };
  if (h.f) node.pathFlip = true;
  if (['rainbow', 'skew', 'ribbon', 'stair', 'gravity'].includes(h.fx)) node.pathEffect = h.fx as TextNode['pathEffect'];
  if (['baseline', 'ascender', 'descender', 'center'].includes(h.al)) node.pathAlign = h.al as TextNode['pathAlign'];
  if (h.sp) node.pathSpacing = h.sp;
  if (name) node.name = name;
  return node;
}
