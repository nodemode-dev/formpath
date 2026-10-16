import type { Font } from 'opentype.js';
import { has3d } from '../engine/effects';
import { mul } from '../engine/geometry';
import { resolvePaint } from '../engine/paint';
import { axesKey, glyphMat, hasAxes, layoutText } from '../engine/text';
import type { CharStyle, Doc, Mat, Paint, TextNode } from '../engine';
import { api } from './api';
import { fontFor, fontSource, glyphAdvance } from './fonts';

export interface PdfSink { add(dict: string, stream?: Uint8Array): number }
export interface Ink { fill: string | null; stroke: string | null; width: number }
export interface LiveGlyph { face: Face; gid: number; tm: Mat; style: CharStyle }
export interface LiveText { node: TextNode; glyphs: LiveGlyph[]; faces: Set<Face> }

const num = (v: number): string => { const r = Math.round(v * 1e6) / 1e6; return Object.is(r, -0) ? '0' : String(r); };
const hex4 = (v: number): string => v.toString(16).padStart(4, '0');
const utf16 = (s: string): string => Array.from(s, (c) => { const p = c.codePointAt(0) as number; if (p < 0x10000) return hex4(p); const q = p - 0x10000; return hex4(0xd800 + (q >> 10)) + hex4(0xdc00 + (q & 0x3ff)); }).join('');

export class Face {
  readonly gids = new Set<number>();
  readonly uni = new Map<number, string>();
  readonly adv = new Map<number, number>();
  failed = false;
  resource = '';
  id = 0;
  constructor(readonly key: string, readonly font: Font, readonly style: CharStyle) {}
}

const solidOrNone = (doc: Doc, p: Paint): boolean => { const r = resolvePaint(doc, p); return r.type === 'none' || r.type === 'color'; };

function psName(font: Font): string {
  const names = font.names as unknown as Record<string, unknown>;
  const pick = (o: unknown): string | undefined => { const r = o as Record<string, string> | undefined; return r && typeof r === 'object' ? r.en ?? Object.values(r)[0] : undefined; };
  const win = names.windows as Record<string, unknown> | undefined;
  const raw = pick(names.postScriptName) ?? pick(win?.postScriptName) ?? pick(names.fullName) ?? pick(win?.fullName) ?? 'Font';
  return raw.replace(/[^A-Za-z0-9-]/g, '') || 'Font';
}

function tagOf(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  let out = '';
  for (let i = 0; i < 6; i++) { out += String.fromCharCode(65 + (h >>> 0) % 26); h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; }
  return out;
}

function toUnicode(face: Face): string {
  const rows = [...face.uni.entries()].sort((a, b) => a[0] - b[0]).map(([gid, s]) => `<${hex4(gid)}> <${utf16(s)}>`);
  const blocks: string[] = [];
  for (let i = 0; i < rows.length; i += 100) { const part = rows.slice(i, i + 100); blocks.push(`${part.length} beginbfchar\n${part.join('\n')}\nendbfchar`); }
  return `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${blocks.join('\n')}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`;
}

export async function embeddedMarkFont(pdf: PdfSink, deflate: (b: Uint8Array) => Promise<Uint8Array>): Promise<number> {
  const font = await fontFor('Inter', 'Regular');
  const src = font ? fontSource(font) : null;
  if (!font || !src) return 0;
  const codes = Array.from({ length: 95 }, (_, i) => 32 + i), gids = codes.map((c) => font.charToGlyph(String.fromCharCode(c)).index);
  const sub = await api.subsetFont(src, [0, ...new Set(gids)], {});
  if (!sub) return 0;
  const k = 1000 / font.unitsPerEm, head = font.tables.head as { xMin: number; yMin: number; xMax: number; yMax: number }, os2 = font.tables.os2 as { sCapHeight?: number } | undefined;
  const widths = gids.map((g) => Math.round((font.glyphs.get(g).advanceWidth ?? 0) * k));
  const file = await deflate(sub.data);
  const ff = sub.cff ? pdf.add(`<< /Subtype /OpenType /Filter /FlateDecode >>`, file) : pdf.add(`<< /Length1 ${sub.data.length} /Filter /FlateDecode >>`, file);
  const name = `${tagOf('formpth-marks')}+${psName(font)}`;
  const desc = pdf.add(`<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [${[head.xMin, head.yMin, head.xMax, head.yMax].map((v) => Math.round(v * k)).join(' ')}] /ItalicAngle 0 /Ascent ${Math.round(font.ascender * k)} /Descent ${Math.round(font.descender * k)} /CapHeight ${Math.round((os2?.sCapHeight || font.ascender * 0.7) * k)} /StemV 80 ${sub.cff ? '/FontFile3' : '/FontFile2'} ${ff} 0 R >>`);
  return pdf.add(`<< /Type /Font /Subtype /TrueType /BaseFont /${name} /FirstChar 32 /LastChar 126 /Widths [${widths.join(' ')}] /Encoding /WinAnsiEncoding /FontDescriptor ${desc} 0 R >>`);
}

export class LiveFonts {
  private readonly faces = new Map<string, Face>();

  capable(doc: Doc, n: TextNode): boolean {
    return !has3d(n) && !n.ap.effects.length && !n.ap.items.some((i) => i.visible) && !(n.mask && !n.mask.disabled);
  }

  async plan(doc: Doc, n: TextNode): Promise<LiveText | null> {
    if (!this.capable(doc, n)) return null;
    const lay = layoutText(n), staged: Array<{ key: string; font: Font; style: CharStyle; gid: number; ch: string; tm: Mat }> = [];
    for (const g of lay.glyphs) {
      const code = g.ch.charCodeAt(0);
      if (code < 32) continue;
      const st = g.style, hasStroke = st.stroke.type !== 'none' && st.strokeWidth > 0;
      if (!solidOrNone(doc, st.fill) || (hasStroke && !solidOrNone(doc, st.stroke))) return null;
      const font = await fontFor(st.font, st.style);
      if (!font) return null;
      const gid = g.gid ?? font.charToGlyph(g.ch).index;
      if (gid === 0 && /\s/.test(g.ch)) continue;
      const local = mul(glyphMat(g), [(g.size * st.hscale) / 100, 0, 0, (g.size * st.vscale) / 100, 0, 0]), m = n.mode === 'path' ? local : mul(n.xf, local);
      staged.push({ key: `${st.font}|${st.style}|${hasAxes(st) ? axesKey(st) : ''}`, font, style: st, gid, ch: g.ch, tm: [m[0], m[1], -m[2], -m[3], m[4], m[5]] });
    }
    const glyphs: LiveGlyph[] = [], used = new Set<Face>();
    for (const s of staged) {
      let face = this.faces.get(s.key);
      if (!face) { face = new Face(s.key, s.font, s.style); this.faces.set(s.key, face); }
      face.gids.add(s.gid);
      if (s.gid !== 0 && !face.uni.has(s.gid)) face.uni.set(s.gid, s.ch);
      if (!face.adv.has(s.gid)) face.adv.set(s.gid, Math.round(glyphAdvance(s.font, s.gid, s.style) * 1e4) / 10);
      used.add(face);
      glyphs.push({ face, gid: s.gid, tm: s.tm, style: s.style });
    }
    return { node: n, glyphs, faces: used };
  }

  ok(plan: LiveText): boolean { return [...plan.faces].every((f) => !f.failed); }

  async build(pdf: PdfSink, deflate: (d: Uint8Array) => Promise<Uint8Array>, openType = true): Promise<void> {
    await Promise.all([...this.faces.values()].map(async (face) => {
      const src = fontSource(face.font);
      const res = src ? await api.subsetFont(src, [...face.gids], hasAxes(face.style) ? { ...face.style.axes } : {}) : null;
      if (!res || (res.cff && !openType)) { face.failed = true; return; }
      const font = face.font, upm = font.unitsPerEm || 1000, k = 1000 / upm;
      const head = font.tables.head as { xMin: number; yMin: number; xMax: number; yMax: number } | undefined;
      const os2 = font.tables.os2 as { usWeightClass?: number; sCapHeight?: number } | undefined;
      const post = font.tables.post as { italicAngle?: number; isFixedPitch?: number } | undefined;
      const angle = post?.italicAngle ?? 0, weight = face.style.axes?.wght ?? os2?.usWeightClass ?? 400;
      const flags = 4 | (angle !== 0 || /italic|oblique/i.test(face.style.style) ? 64 : 0) | (post?.isFixedPitch ? 1 : 0);
      const name = `${tagOf(face.key + [...face.gids].join())}+${psName(font)}`;
      const file = pdf.add(res.cff ? '<< /Subtype /OpenType /Filter /FlateDecode >>' : `<< /Filter /FlateDecode /Length1 ${res.data.length} >>`, await deflate(res.data));
      const box = head ? [head.xMin, head.yMin, head.xMax, head.yMax].map((v) => Math.round(v * k)) : [-200, -250, 1200, 950];
      const descriptor = pdf.add(`<< /Type /FontDescriptor /FontName /${name} /Flags ${flags} /FontBBox [${box.join(' ')}] /ItalicAngle ${num(angle)} /Ascent ${Math.round((font.ascender || upm * 0.8) * k)} /Descent ${Math.round((font.descender || -upm * 0.2) * k)} /CapHeight ${Math.round((os2?.sCapHeight || upm * 0.7) * k)} /StemV ${Math.round(50 + (weight * weight) / 4225)} ${res.cff ? '/FontFile3' : '/FontFile2'} ${file} 0 R >>`);
      const widths = [...face.adv.entries()].sort((a, b) => a[0] - b[0]).map(([gid, w]) => `${gid} [${w}]`).join(' ');
      const cid = pdf.add(`<< /Type /Font /Subtype /${res.cff ? 'CIDFontType0' : 'CIDFontType2'} /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /DW 1000 /W [${widths}]${res.cff ? '' : ' /CIDToGIDMap /Identity'} >>`);
      const map = pdf.add('<< /Filter /FlateDecode >>', await deflate(new TextEncoder().encode(toUnicode(face))));
      face.id = pdf.add(`<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${map} 0 R >>`);
      face.resource = `TF${face.id}`;
    }));
  }

  resources(): string {
    return [...this.faces.values()].filter((f) => f.id && !f.failed).map((f) => `/${f.resource} ${f.id} 0 R`).join(' ');
  }
}

export interface Run { face: Face; ink: Ink; tm: Mat; parts: string[]; hex: string; pos: number; end: number; glyphs: number }

const sameLinear = (a: Mat, b: Mat): boolean => { const tol = 1e-5 * (Math.abs(a[0]) + Math.abs(a[1]) + Math.abs(a[2]) + Math.abs(a[3])) + 1e-9; return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol && Math.abs(a[3] - b[3]) <= tol; };

/** Groups consecutive glyphs of one face, ink and matrix whose origins lie on one baseline into runs. Each run is one Tm and one TJ array whose numbers (thousandths of text space) reproduce the layout positions exactly. Type on a path, vertical type and per-glyph rotation or baseline shift break the run, so those glyphs keep a Tm of their own. */
export function liveRuns(plan: LiveText, inkOf: (st: CharStyle) => Ink): Run[] {
  const runs: Run[] = [];
  let cur: Run | null = null, last: LiveGlyph | null = null;
  const flush = (): void => { if (cur) { if (cur.hex) cur.parts.push(`<${cur.hex}>`); cur.hex = ''; runs.push(cur); } cur = null; last = null; };
  for (const g of plan.glyphs) {
    const ink = inkOf(g.style);
    if (!ink.fill && !ink.stroke) { flush(); continue; }
    const adv = g.face.adv.get(g.gid) ?? 0;
    if (cur && last && cur.face === g.face && cur.ink.fill === ink.fill && cur.ink.stroke === ink.stroke && cur.ink.width === ink.width && sameLinear(cur.tm, g.tm)) {
      const a = cur.tm[0], b = cur.tm[1], den = a * a + b * b, dx = g.tm[4] - cur.tm[4], dy = g.tm[5] - cur.tm[5];
      const perp = den > 0 ? Math.abs(dx * b - dy * a) / Math.sqrt(den) : Infinity;
      if (den > 0 && perp <= 0.01) {
        const want = ((dx * a + dy * b) / den) * 1000, off = cur.end - want, n = Math.abs(off) >= 0.25 ? Math.round(off * 100) / 100 : 0;
        if (n) { if (cur.hex) cur.parts.push(`<${cur.hex}>`); cur.hex = ''; cur.parts.push(num(n)); }
        cur.hex += hex4(g.gid);
        cur.pos = cur.end - n;
        cur.end = cur.pos + adv;
        cur.glyphs++;
        last = g;
        continue;
      }
    }
    flush();
    cur = { face: g.face, ink, tm: g.tm, parts: [], hex: hex4(g.gid), pos: 0, end: adv, glyphs: 1 };
    last = g;
  }
  flush();
  return runs;
}

export function liveStream(plan: LiveText, inkOf: (st: CharStyle) => Ink): string {
  const out: string[] = [];
  let face: Face | null = null, fill = '', stroke = '', mode = -1, width = '';
  for (const r of liveRuns(plan, inkOf)) {
    const ink = r.ink, m = ink.fill && ink.stroke ? 2 : ink.stroke ? 1 : 0;
    if (ink.fill && ink.fill !== fill) { out.push(ink.fill); fill = ink.fill; }
    if (ink.stroke) {
      const w = `${num(ink.width)} w 1 j`;
      if (ink.stroke !== stroke) { out.push(ink.stroke); stroke = ink.stroke; }
      if (w !== width) { out.push(w); width = w; }
    }
    out.push('BT');
    if (m !== mode) { out.push(`${m} Tr`); mode = m; }
    if (r.face !== face) { out.push(`/${r.face.resource} 1 Tf`); face = r.face; }
    out.push(`${r.tm.map(num).join(' ')} Tm`, r.parts.length === 1 && r.parts[0].startsWith('<') ? `${r.parts[0]} Tj` : `[${r.parts.join(' ')}] TJ`, 'ET');
  }
  return out.length ? `q\n${out.join('\n')}\nQ` : '';
}
