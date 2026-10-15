import { parse, type Font, type PathCommand } from 'opentype.js';
import { anchor, mul, transformPath } from '../engine/geometry';
import { axesKey, fontsChanged, glyphMat, hasAxes, layoutText, setShaping, weightOf } from '../engine/text';
import type { Anchor, CharStyle, Mat, PathData, SubPath, TextNode } from '../engine';
import { api, type FontInfo, type SimilarFont } from './api';

const BUNDLED = import.meta.glob('../../node_modules/@fontsource/{inter,jetbrains-mono}/files/*-latin-*-{normal,italic}.woff', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>;

export const BUNDLED_FAMILIES = ['Inter', 'JetBrains Mono'];
export const WEB_FAMILIES = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Garamond', 'Palatino', 'Futura', 'Avenir', 'Gill Sans', 'Optima', 'Menlo', 'Impact'];
export const STYLES = ['Thin', 'Extra Light', 'Light', 'Regular', 'Medium', 'Semibold', 'Bold', 'Extra Bold', 'Black', 'Italic', 'Light Italic', 'Medium Italic', 'Bold Italic'];

function bundledLoader(family: string, style: string): (() => Promise<string>) | null {
  const slug = family.toLowerCase().replace(/\s+/g, '-');
  if (slug !== 'inter' && slug !== 'jetbrains-mono') return null;
  const { weight, italic } = weightOf(style);
  const pick = (w: number, it: boolean): (() => Promise<string>) | null => {
    const key = Object.keys(BUNDLED).find((k) => k.endsWith(`/${slug}-latin-${w}-${it ? 'italic' : 'normal'}.woff`));
    return key ? BUNDLED[key] : null;
  };
  const ws = [weight, 400, 500, 600, 700, 300];
  for (const w of ws) { const l = pick(w, italic) ?? pick(w, false); if (l) return l; }
  return null;
}

export async function bundledFontFile(family: string, style: string): Promise<{ name: string; blob: Blob } | null> {
  const load = bundledLoader(family, style);
  if (!load) return null;
  try {
    const url = await load(), res = await fetch(url);
    if (!res.ok) return null;
    return { name: decodeURIComponent(url.split('?')[0].split('/').pop() ?? 'font.woff'), blob: await res.blob() };
  } catch { return null; }
}

const faces = new Set<string>();
let onFace: (() => void) | null = null;
export function onFontsLoaded(fn: () => void): void { onFace = fn; }

export async function ensureFace(family: string, style: string): Promise<void> {
  const key = `${family}|${style}`;
  if (faces.has(key)) return;
  faces.add(key);
  const load = bundledLoader(family, style);
  if (!load) return;
  try {
    const url = await load(), { weight, italic } = weightOf(style);
    const face = new FontFace(family, `url(${url})`, { weight: String(weight), style: italic ? 'italic' : 'normal' });
    await face.load();
    document.fonts.add(face);
    fontsChanged();
    onFace?.();
  } catch { faces.delete(key); }
}

let systemList: FontInfo[] | null = null;
export async function systemFonts(): Promise<FontInfo[]> {
  if (systemList) return systemList;
  systemList = await api.fonts();
  return systemList;
}

export function families(): string[] {
  const sys = [...new Set((systemList ?? []).map((f) => f.family))].sort((a, b) => a.localeCompare(b));
  return [...BUNDLED_FAMILIES, ...WEB_FAMILIES.filter((f) => !sys.includes(f)), ...sys.filter((f) => !BUNDLED_FAMILIES.includes(f))];
}
export async function findSimilarFonts(family: string, style = 'Regular', limit = 10): Promise<SimilarFont[]> {
  const list = await systemFonts(), of = list.filter((f) => f.family === family);
  const hit = of.find((f) => f.style === style) ?? of.find((f) => /^(regular|book|roman|normal)$/i.test(f.style)) ?? of[0];
  return hit ? api.similarFonts(hit.id, limit) : [];
}
export function isVariableFamily(family: string): boolean { return (systemList ?? []).some((f) => f.family === family && !!f.variable); }

const instanceStyles = new Map<string, string[]>();
export function stylesOf(family: string): string[] {
  const sys = (systemList ?? []).filter((f) => f.family === family).map((f) => f.style);
  const inst = instanceStyles.get(family) ?? [];
  return sys.length || inst.length ? [...new Set([...sys, ...inst])] : STYLES;
}

export interface VariationAxis { tag: string; name: string; min: number; def: number; max: number }
export interface VariationInfo { axes: VariationAxis[]; instances: Array<{ name: string; coords: Record<string, number> }> }
export const AXIS_NAMES: Record<string, string> = { wght: 'Weight', wdth: 'Width', slnt: 'Slant', ital: 'Italic', opsz: 'Optical size' };
type Fvar = { axes?: Array<{ tag: string; minValue: number; defaultValue: number; maxValue: number; name?: Record<string, string> }>; instances?: Array<{ name?: Record<string, string>; coordinates: Record<string, number> }> };
const infoCache = new WeakMap<Font, VariationInfo | null>();
function infoOf(font: Font): VariationInfo | null {
  if (infoCache.has(font)) return infoCache.get(font) ?? null;
  const fv = font.tables.fvar as Fvar | undefined;
  const info: VariationInfo | null = fv?.axes?.length ? {
    axes: fv.axes.map((a) => ({ tag: a.tag, name: AXIS_NAMES[a.tag] ?? `${a.name?.en ?? a.tag} (${a.tag})`, min: a.minValue, def: a.defaultValue, max: a.maxValue })),
    instances: (fv.instances ?? []).map((i) => ({ name: i.name?.en ?? Object.values(i.name ?? {})[0] ?? '', coords: { ...i.coordinates } })).filter((i) => !!i.name),
  } : null;
  infoCache.set(font, info);
  return info;
}
export async function variationOf(family: string, style: string): Promise<VariationInfo | null> {
  const font = await fontFor(family, style);
  return font ? infoOf(font) : null;
}

const parsed = new Map<string, Promise<Font | null>>();
const byFile = new Map<string, Promise<Font | null>>();
const rawData = new WeakMap<Font, ArrayBuffer>();
const keep = (buf: ArrayBuffer): Font => { const f = parse(buf); rawData.set(f, buf); return f; };
const installedId = new WeakMap<Font, string>();
export function fontSource(font: Font): { id: string } | { bytes: ArrayBuffer } | null {
  const id = installedId.get(font), bytes = rawData.get(font);
  return id ? { id } : bytes ? { bytes } : null;
}
export function glyphAdvance(font: Font, gid: number, st: CharStyle): number { return variedGlyph(font, gid, st).adv; }
export function fontFor(family: string, style: string): Promise<Font | null> {
  const key = `${family}|${style}`;
  let p = parsed.get(key);
  if (!p) {
    p = (async () => {
      try {
        const load = bundledLoader(family, style);
        if (load) { const url = await load(); return keep(await (await fetch(url)).arrayBuffer()); }
        const hit = await api.findFont(family, style);
        if (!hit) return null;
        let f = byFile.get(hit.id);
        if (!f) { f = api.fontFile(hit.id).then(keep).catch(() => null); byFile.set(hit.id, f); }
        const font = await f;
        if (font) installedId.set(font, hit.id);
        const info = font ? infoOf(font) : null;
        if (info?.instances.length) {
          const names = info.instances.map((i) => i.name), had = instanceStyles.get(family) ?? [];
          if (names.some((x) => !had.includes(x))) instanceStyles.set(family, [...new Set([...had, ...names])]);
        }
        return font;
      } catch { return null; }
    })();
    parsed.set(key, p);
  }
  return p;
}

type Varied = { d: PathData; adv: number };
type VarGlyph = { advanceWidth?: number; _advanceWidth?: number; leftSideBearing?: number; _leftSideBearing?: number };
type VarFont = { variation?: { getTransform(g: number, coords: Record<string, number>): { advanceWidth?: number; path: { commands: PathCommand[] } } } };
const outlines = new WeakMap<Font, Map<string, Varied>>();
function variedGlyph(font: Font, gid: number, st: CharStyle): Varied {
  const key = `${gid}|${axesKey(st)}`;
  let m = outlines.get(font);
  if (!m) { m = new Map(); outlines.set(font, m); }
  const hit = m.get(key);
  if (hit) return hit;
  const g = font.glyphs.get(gid), upm = font.unitsPerEm || 1000, v = (font as unknown as VarFont).variation;
  let out: Varied = { d: g ? commandsToPath(g.getPath(0, 0, 1).commands, [1, 0, 0, 1, 0, 0]) : [], adv: (g?.advanceWidth ?? 0) / upm };
  if (g && v && hasAxes(st)) {
    const raw = g as unknown as VarGlyph;
    try {
      const t = v.getTransform(gid, { ...st.axes });
      out = { d: commandsToPath(t.path.commands, [1 / upm, 0, 0, -1 / upm, 0, 0]), adv: (t.advanceWidth ?? g.advanceWidth ?? 0) / upm };
    } catch { out = { ...out }; }
    if (raw._advanceWidth !== undefined) raw.advanceWidth = raw._advanceWidth;
    if (raw._leftSideBearing !== undefined) raw.leftSideBearing = raw._leftSideBearing;
  }
  m.set(key, out);
  return out;
}

function commandsToPath(cmds: PathCommand[], m: Mat): PathData {
  const out: SubPath[] = [];
  let cur: Anchor[] = [], last = { x: 0, y: 0 };
  const flush = (closed: boolean): void => {
    if (cur.length > 1) {
      if (closed) { const a = cur[0], b = cur[cur.length - 1]; if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) { a.ix = b.ix; a.iy = b.iy; cur.pop(); } }
      out.push({ closed, pts: cur });
    }
    cur = [];
  };
  for (const c of cmds) {
    if (c.type === 'M') { flush(false); last = { x: c.x ?? 0, y: c.y ?? 0 }; cur.push(anchor(last.x, last.y)); }
    else if (c.type === 'L') { last = { x: c.x ?? 0, y: c.y ?? 0 }; cur.push(anchor(last.x, last.y)); }
    else if (c.type === 'C') {
      const prev = cur[cur.length - 1];
      if (prev) { prev.ox = c.x1 ?? prev.x; prev.oy = c.y1 ?? prev.y; }
      last = { x: c.x ?? 0, y: c.y ?? 0 };
      cur.push({ x: last.x, y: last.y, ix: c.x2 ?? last.x, iy: c.y2 ?? last.y, ox: last.x, oy: last.y });
    } else if (c.type === 'Q') {
      const prev = cur[cur.length - 1], qx = c.x1 ?? 0, qy = c.y1 ?? 0, x = c.x ?? 0, y = c.y ?? 0;
      if (prev) { prev.ox = prev.x + (2 / 3) * (qx - prev.x); prev.oy = prev.y + (2 / 3) * (qy - prev.y); }
      cur.push({ x, y, ix: x + (2 / 3) * (qx - x), iy: y + (2 / 3) * (qy - y), ox: x, oy: y });
      last = { x, y };
    } else if (c.type === 'Z') flush(true);
  }
  flush(false);
  return transformPath(out, m);
}

export async function outlineText(n: TextNode): Promise<PathData | null> {
  const lay = layoutText(n);
  const out: SubPath[] = [];
  for (const g of lay.glyphs) {
    if (g.ch === ' ' || g.ch === '\t') continue;
    const font = await fontFor(g.style.font, g.style.style);
    if (!font) return null;
    const gid = g.gid ?? font.charToGlyph(g.ch).index;
    const local: Mat = mul(glyphMat(g), [(g.size * g.style.hscale) / 100, 0, 0, (g.size * g.style.vscale) / 100, 0, 0]);
    out.push(...transformPath(variedGlyph(font, gid, g.style).d, n.mode === 'path' ? local : mul(n.xf, local)));
  }
  return out;
}

const ready = new Map<string, Font | null>();
function fontNow(st: CharStyle): Font | null {
  const key = `${st.font}|${st.style}`;
  const hit = ready.get(key);
  if (hit !== undefined) return hit;
  ready.set(key, null);
  void fontFor(st.font, st.style).then((f) => { ready.set(key, f); if (f) { fontsChanged(); onFace?.(); } });
  return null;
}

interface Subs { single: Map<number, number>; ligs: Map<number, Array<{ rest: number[]; by: number }>> }
const subsCache = new WeakMap<Font, Map<string, Subs>>();
const CJK_SCRIPTS = ['DFLT', 'hani', 'kana', 'hang', 'latn'];
function subsOf(font: Font, tag: string, scripts: string[] = ['latn', 'DFLT']): Subs {
  let m = subsCache.get(font);
  if (!m) { m = new Map(); subsCache.set(font, m); }
  const ck = scripts.length === 2 && scripts[0] === 'latn' ? tag : `${tag}|${scripts.join(',')}`;
  const hit = m.get(ck);
  if (hit) return hit;
  const s: Subs = { single: new Map(), ligs: new Map() };
  for (const script of scripts) {
    try {
      for (const r of font.substitution.getSingle(tag, script)) if (!s.single.has(r.sub)) s.single.set(r.sub, r.by);
      for (const r of font.substitution.getAlternates(tag, script)) if (!s.single.has(r.sub) && r.by.length) s.single.set(r.sub, r.by[0]);
      for (const r of font.substitution.getLigatures(tag, script)) {
        const [first, ...rest] = r.sub, list = s.ligs.get(first) ?? [];
        if (!list.some((l) => l.rest.join() === rest.join())) list.push({ rest, by: r.by });
        s.ligs.set(first, list);
      }
    } catch { continue; }
  }
  for (const list of s.ligs.values()) list.sort((a, b) => b.rest.length - a.rest.length);
  m.set(ck, s);
  return s;
}

interface VMetrics { upm: number; long: number; adv: DataView | null; vmtx: number; vorg: Map<number, number> | null; vorgDefault: number }
const vmetricsCache = new WeakMap<Font, VMetrics>();
function vmetricsOf(font: Font): VMetrics {
  const hit = vmetricsCache.get(font);
  if (hit) return hit;
  const upm = font.unitsPerEm || 1000;
  const out: VMetrics = { upm, long: 0, adv: null, vmtx: 0, vorg: null, vorgDefault: upm * 0.88 };
  const buf = rawData.get(font);
  if (buf && buf.byteLength > 12) {
    try {
      const dv = new DataView(buf), sig = dv.getUint32(0);
      if (sig === 0x00010000 || sig === 0x4f54544f || sig === 0x74727565) {
        const tables = new Map<string, { off: number; len: number }>();
        for (let i = 0, n = dv.getUint16(4); i < n; i++) {
          const r = 12 + i * 16, tag = String.fromCharCode(dv.getUint8(r), dv.getUint8(r + 1), dv.getUint8(r + 2), dv.getUint8(r + 3));
          tables.set(tag, { off: dv.getUint32(r + 8), len: dv.getUint32(r + 12) });
        }
        const vhea = tables.get('vhea'), vmtx = tables.get('vmtx'), vorg = tables.get('VORG');
        if (vhea && vmtx) { out.long = dv.getUint16(vhea.off + 34); out.adv = dv; out.vmtx = vmtx.off; }
        if (vorg) {
          out.vorgDefault = dv.getInt16(vorg.off + 4);
          const m = new Map<number, number>();
          for (let i = 0, n = dv.getUint16(vorg.off + 6); i < n; i++) m.set(dv.getUint16(vorg.off + 8 + i * 4), dv.getInt16(vorg.off + 10 + i * 4));
          out.vorg = m;
        }
      }
    } catch { out.adv = null; }
  }
  vmetricsCache.set(font, out);
  return out;
}
function verticalMetrics(font: Font, gid: number): { vadv: number; vorg: number } {
  const v = vmetricsOf(font);
  let vadv = 1, org = v.vorg ? v.vorg.get(gid) ?? v.vorgDefault : null;
  if (v.adv && v.long > 0) {
    const i = Math.min(gid, v.long - 1);
    vadv = v.adv.getUint16(v.vmtx + i * 4) / v.upm;
    if (org === null) {
      const tsb = gid < v.long ? v.adv.getInt16(v.vmtx + gid * 4 + 2) : v.adv.getInt16(v.vmtx + v.long * 4 + (gid - v.long) * 2);
      const g = font.glyphs.get(gid) as unknown as { yMax?: number; getBoundingBox?: () => { y2: number } };
      const yMax = g?.yMax ?? (g?.getBoundingBox ? g.getBoundingBox().y2 : undefined);
      org = yMax !== undefined && Number.isFinite(yMax) ? yMax + tsb : v.vorgDefault;
    }
  }
  return { vadv, vorg: (org ?? v.vorgDefault) / v.upm };
}

interface G { gid: number; chars: number; ch: string }
const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';

type Cov = { format: number; glyphs?: number[]; ranges?: Array<{ start: number; end: number; index: number }> };
type ClassDef = { format: number; startGlyph?: number; classes?: number[]; ranges?: Array<{ start: number; end: number; classId?: number; value?: number }> };
type Rec = { sequenceIndex: number; lookupListIndex: number };
type Rule = { backtrack?: number[]; input?: number[]; lookahead?: number[]; lookupRecords?: Rec[]; substLookupRecords?: Rec[] };
type Sub = {
  substFormat: number; coverage?: Cov; deltaGlyphId?: number; substitute?: number[]; alternateSets?: number[][]; ligatureSets?: Array<Array<{ ligGlyph: number; components: number[] }>>;
  ruleSets?: Rule[][]; classSets?: Rule[][]; chainRuleSets?: Rule[][]; chainClassSet?: Rule[][]; classDef?: ClassDef; backtrackClassDef?: ClassDef; inputClassDef?: ClassDef; lookaheadClassDef?: ClassDef;
  coverages?: Cov[]; backtrackCoverage?: Cov[]; inputCoverage?: Cov[]; lookaheadCoverage?: Cov[]; lookupRecords?: Rec[];
};
type Lookup = { lookupType: number; subtables: Sub[] };
type Gsub = { features?: Array<{ tag: string; feature?: { lookupListIndexes?: number[] } }>; lookups?: Lookup[] };

function covIndex(c: Cov | undefined, gid: number): number {
  if (!c) return -1;
  if (c.format === 1) return c.glyphs?.indexOf(gid) ?? -1;
  for (const r of c.ranges ?? []) if (gid >= r.start && gid <= r.end) return r.index + gid - r.start;
  return -1;
}
function classOf(cd: ClassDef | undefined, gid: number): number {
  if (!cd) return 0;
  if (cd.format === 1) { const i = gid - (cd.startGlyph ?? 0); return i >= 0 && i < (cd.classes?.length ?? 0) ? cd.classes?.[i] ?? 0 : 0; }
  for (const r of cd.ranges ?? []) if (gid >= r.start && gid <= r.end) return r.classId ?? r.value ?? 0;
  return 0;
}

function applyLookup(gsub: Gsub, li: number, gs: G[], i: number, depth = 0): number {
  const lk = gsub.lookups?.[li];
  if (!lk || depth > 6) return 0;
  for (const st of lk.subtables) {
    const g = gs[i];
    if (!g) return 0;
    if (lk.lookupType === 1) {
      const k = covIndex(st.coverage, g.gid);
      if (k < 0) continue;
      gs[i] = { ...g, gid: st.substFormat === 1 ? (g.gid + (st.deltaGlyphId ?? 0)) & 0xffff : st.substitute?.[k] ?? g.gid };
      return 1;
    }
    if (lk.lookupType === 3) {
      const k = covIndex(st.coverage, g.gid), alt = k >= 0 ? st.alternateSets?.[k]?.[0] : undefined;
      if (alt === undefined) continue;
      gs[i] = { ...g, gid: alt };
      return 1;
    }
    if (lk.lookupType === 4) {
      const k = covIndex(st.coverage, g.gid);
      if (k < 0) continue;
      const lig = st.ligatureSets?.[k]?.find((l) => l.components.every((c, n) => gs[i + 1 + n]?.gid === c));
      if (!lig) continue;
      const parts = gs.slice(i, i + 1 + lig.components.length);
      gs.splice(i, parts.length, { gid: lig.ligGlyph, chars: parts.reduce((a, p) => a + p.chars, 0), ch: parts.map((p) => p.ch).join('') });
      return 1;
    }
    if (lk.lookupType === 5 || lk.lookupType === 6) {
      const n = contextMatch(lk.lookupType === 6, st, gs, i);
      if (n === null) continue;
      const recs = n.recs;
      let len = n.len;
      for (const r of recs) { const before = gs.length; applyLookup(gsub, r.lookupListIndex, gs, i + r.sequenceIndex, depth + 1); len -= before - gs.length; }
      return Math.max(1, len);
    }
  }
  return 0;
}

function contextMatch(chain: boolean, st: Sub, gs: G[], i: number): { len: number; recs: Rec[] } | null {
  const at = (k: number): number | undefined => gs[k]?.gid;
  const seqOk = (seq: number[] | undefined, start: number, dir: 1 | -1, test: (gid: number, v: number) => boolean): boolean => (seq ?? []).every((v, n) => { const g = at(start + dir * n); return g !== undefined && test(g, v); });
  if (st.substFormat === 3) {
    const input = chain ? st.inputCoverage ?? [] : st.coverages ?? [];
    if (!input.length || !input.every((c, n) => { const g = at(i + n); return g !== undefined && covIndex(c, g) >= 0; })) return null;
    if (chain) {
      if (!(st.backtrackCoverage ?? []).every((c, n) => { const g = at(i - 1 - n); return g !== undefined && covIndex(c, g) >= 0; })) return null;
      if (!(st.lookaheadCoverage ?? []).every((c, n) => { const g = at(i + input.length + n); return g !== undefined && covIndex(c, g) >= 0; })) return null;
    }
    return { len: input.length, recs: st.lookupRecords ?? (st as { substLookupRecords?: Rec[] }).substLookupRecords ?? [] };
  }
  const first = at(i);
  if (first === undefined) return null;
  if (st.substFormat === 1) {
    const k = covIndex(st.coverage, first);
    if (k < 0) return null;
    for (const r of (chain ? st.chainRuleSets?.[k] : st.ruleSets?.[k]) ?? []) {
      const input = r.input ?? [];
      if (!seqOk(input, i + 1, 1, (g, v) => g === v)) continue;
      if (chain && (!seqOk(r.backtrack, i - 1, -1, (g, v) => g === v) || !seqOk(r.lookahead, i + 1 + input.length, 1, (g, v) => g === v))) continue;
      return { len: input.length + 1, recs: r.lookupRecords ?? r.substLookupRecords ?? [] };
    }
    return null;
  }
  if (st.substFormat === 2) {
    if (covIndex(st.coverage, first) < 0) return null;
    const icd = chain ? st.inputClassDef : st.classDef;
    for (const r of (chain ? st.chainClassSet?.[classOf(icd, first)] : st.classSets?.[classOf(icd, first)]) ?? []) {
      const input = r.input ?? [];
      if (!seqOk(input, i + 1, 1, (g, v) => classOf(icd, g) === v)) continue;
      if (chain && (!seqOk(r.backtrack, i - 1, -1, (g, v) => classOf(st.backtrackClassDef, g) === v) || !seqOk(r.lookahead, i + 1 + input.length, 1, (g, v) => classOf(st.lookaheadClassDef, g) === v))) continue;
      return { len: input.length + 1, recs: r.lookupRecords ?? r.substLookupRecords ?? [] };
    }
  }
  return null;
}

function gsubFeature(font: Font, tag: string, gs: G[]): G[] {
  const gsub = font.tables.gsub as Gsub | undefined;
  const lookups = [...new Set((gsub?.features ?? []).filter((f) => f.tag === tag).flatMap((f) => f.feature?.lookupListIndexes ?? []))].sort((a, b) => a - b);
  if (!gsub || !lookups.length) return gs;
  const out = gs.slice();
  for (const li of lookups) for (let i = 0; i < out.length;) { let n = 0; try { n = applyLookup(gsub, li, out, i); } catch { n = 0; } i += Math.max(1, n); }
  return out;
}
function single(font: Font, tag: string, gs: G[], only?: (i: number) => boolean, scripts?: string[]): G[] {
  const s = subsOf(font, tag, scripts).single;
  return s.size ? gs.map((g, i) => (s.has(g.gid) && (!only || only(i)) ? { ...g, gid: s.get(g.gid) as number } : g)) : gs;
}
function ligate(font: Font, tag: string, gs: G[]): G[] {
  const s = subsOf(font, tag).ligs;
  if (!s.size) return gs;
  const out: G[] = [];
  for (let i = 0; i < gs.length;) {
    const hit = s.get(gs[i].gid)?.find((c) => c.rest.every((r, k) => gs[i + 1 + k]?.gid === r));
    if (!hit) { out.push(gs[i++]); continue; }
    const parts = gs.slice(i, i + 1 + hit.rest.length);
    out.push({ gid: hit.by, chars: parts.reduce((a, p) => a + p.chars, 0), ch: parts.map((p) => p.ch).join('') });
    i += parts.length;
  }
  return out;
}
function fractions(font: Font, gs: G[]): G[] {
  const numr = subsOf(font, 'numr').single, dnom = subsOf(font, 'dnom').single, slash = font.charToGlyph('⁄').index;
  if (!numr.size || !dnom.size) return gs;
  const out = gs.slice();
  for (let i = 1; i < out.length - 1; i++) {
    if (out[i].ch !== '/' || !isDigit(out[i - 1].ch) || !isDigit(out[i + 1].ch)) continue;
    for (let k = i - 1; k >= 0 && isDigit(out[k].ch); k--) out[k] = { ...out[k], gid: numr.get(out[k].gid) ?? out[k].gid };
    for (let k = i + 1; k < out.length && isDigit(out[k].ch); k++) out[k] = { ...out[k], gid: dnom.get(out[k].gid) ?? out[k].gid };
    if (slash) out[i] = { ...out[i], gid: slash };
  }
  return out;
}

export const OT_ORDER = ['frac', 'ordn', 'ccmp', 'rlig', 'liga', 'clig', 'calt', 'dlig', 'smcp', 'c2sc', 'case', 'lnum', 'onum', 'pnum', 'tnum', 'zero', 'sups', 'subs', 'sinf', 'numr', 'dnom', 'titl', 'swsh', 'salt', ...Array.from({ length: 20 }, (_, i) => `ss${String(i + 1).padStart(2, '0')}`)];

function featureGlyphs(font: Font, st: CharStyle, text: string, features: string[]): G[] {
  let gs: G[] = Array.from(text, (ch) => ({ gid: font.charToGlyph(ch).index, chars: ch.length, ch }));
  const want = new Set(features);
  for (const tag of [...OT_ORDER, ...features.filter((f) => !OT_ORDER.includes(f))]) {
    if (!want.has(tag)) continue;
    if (tag === 'frac') gs = fractions(font, gs);
    else if (tag === 'calt' || tag === 'clig' || tag === 'rlig') gs = gsubFeature(font, tag, gs);
    else if (tag === 'ordn') gs = single(font, 'ordn', gs, (i) => { let k = i - 1; while (k >= 0 && /[a-z]/i.test(gs[k].ch)) k--; return k >= 0 && isDigit(gs[k].ch) && /[a-z]/i.test(gs[i].ch); });
    else gs = single(font, tag, ligate(font, tag, gs));
  }
  if (st.alt !== undefined && gs.length === 1 && font.glyphs.get(st.alt)) gs = [{ ...gs[0], gid: st.alt }];
  return gs;
}

export function installShaping(): void {
  setShaping({
    vertical: (st, text, features) => {
      const font = fontNow(st);
      if (!font) return null;
      const gs = featureGlyphs(font, st, text, features), vs = single(font, 'vert', gs, undefined, CJK_SCRIPTS), upm = font.unitsPerEm || 1000;
      return vs.map((g, i) => { const vm = verticalMetrics(font, g.gid); return { gid: g.gid, chars: g.chars, adv: (font.glyphs.get(g.gid)?.advanceWidth ?? 0) / upm, vadv: vm.vadv, vorg: vm.vorg, sub: g.gid !== gs[i].gid }; });
    },
    metrics: (st) => {
      const font = fontNow(st);
      if (!font) return null;
      const upm = font.unitsPerEm || 1000, os2 = font.tables.os2 as { sCapHeight?: number; sxHeight?: number } | undefined;
      return { cap: os2?.sCapHeight ? os2.sCapHeight / upm : 0.7, x: os2?.sxHeight ? os2.sxHeight / upm : 0.5, ascender: (font.ascender || upm * 0.8) / upm };
    },
    shape: (st, text, features) => {
      const font = fontNow(st);
      if (!font) return null;
      const gs = featureGlyphs(font, st, text, features);
      const upm = font.unitsPerEm || 1000;
      const vary = hasAxes(st);
      return gs.map((g, i) => {
        let adv = vary ? variedGlyph(font, g.gid, st).adv : (font.glyphs.get(g.gid)?.advanceWidth ?? 0) / upm;
        const next = gs[i + 1];
        if (next && st.kerning === 'auto') { try { adv += font.getKerningValue(g.gid, next.gid) / upm; } catch { adv += 0; } }
        return { gid: g.gid, chars: g.chars, adv };
      });
    },
    outline: (st, gid) => {
      const font = fontNow(st);
      return font ? variedGlyph(font, gid, st).d : null;
    },
    has: (st, feature) => !!fontNow(st)?.tables.gsub?.features?.some((f) => f.tag === feature),
  });
}

const ALT_TAGS = ['aalt', 'salt', 'swsh', 'calt', 'titl', 'case', 'ornm', 'hist', 'nalt', 'smcp', 'c2sc', ...Array.from({ length: 20 }, (_, i) => `ss${String(i + 1).padStart(2, '0')}`), ...Array.from({ length: 30 }, (_, i) => `cv${String(i + 1).padStart(2, '0')}`)];
export async function glyphAlternates(family: string, style: string, ch: string): Promise<Array<{ gid: number; d: string; adv: number }>> {
  const font = await fontFor(family, style);
  if (!font || !ch) return [];
  const base = font.charToGlyph(ch).index, seen = new Set<number>([base]), out: number[] = [];
  const add = (g: number): void => { if (!seen.has(g) && font.glyphs.get(g)) { seen.add(g); out.push(g); } };
  for (const tag of ALT_TAGS) for (const script of ['latn', 'DFLT']) {
    try {
      for (const r of font.substitution.getAlternates(tag, script)) if (r.sub === base) r.by.forEach(add);
      for (const r of font.substitution.getSingle(tag, script)) if (r.sub === base) add(r.by);
    } catch { continue; }
  }
  const upm = font.unitsPerEm || 1000;
  return [base, ...out].map((gid) => { const g = font.glyphs.get(gid); return { gid, d: g ? g.getPath(0, 0.8 * 100, 100).toPathData(2) : '', adv: (g?.advanceWidth ?? upm) / upm }; });
}

export async function featuresOf(family: string, style: string): Promise<Set<string>> {
  const font = await fontFor(family, style);
  return new Set((font?.tables.gsub?.features ?? []).map((f) => f.tag));
}

export async function glyphList(family: string, style: string, limit = 2000): Promise<string[]> {
  const font = await fontFor(family, style);
  if (!font) return [];
  const out: string[] = [];
  for (let i = 0; i < Math.min(font.glyphs.length, limit); i++) {
    const g = font.glyphs.get(i);
    for (const u of g.unicodes ?? []) if (u > 31) out.push(String.fromCodePoint(u));
  }
  return [...new Set(out)];
}
