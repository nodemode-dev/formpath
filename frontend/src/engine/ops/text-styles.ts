import { allNodes, newId, updateNodes } from '../doc';
import { DEFAULT_CHAR, DEFAULT_PARA, styleSpans } from '../text';
import { CHAR_STYLE_KEYS, PARA_STYLE_KEYS, type CharStyle, type CharStyleDef, type Doc, type ParaStyle, type ParaStyleDef, type TextNode, type VNode } from '../types';

export type TextStyleKind = 'char' | 'para';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export function pickChar(st: Partial<CharStyle>): Partial<CharStyle> {
  const out: Record<string, unknown> = {};
  for (const k of CHAR_STYLE_KEYS) if (st[k] !== undefined) out[k] = st[k];
  return out as Partial<CharStyle>;
}
export function pickPara(p: Partial<ParaStyle>): Partial<ParaStyle> {
  const out: Record<string, unknown> = {};
  for (const k of PARA_STYLE_KEYS) if (p[k] !== undefined) out[k] = p[k];
  return out as Partial<ParaStyle>;
}

export function charOverridden(def: CharStyleDef, st: CharStyle): boolean {
  return Object.entries(def.style).some(([k, v]) => !same(v, (st as unknown as Record<string, unknown>)[k]));
}
export function paraOverridden(def: ParaStyleDef, t: TextNode): boolean {
  if (Object.entries(def.style).some(([k, v]) => !same(v, (t.para as unknown as Record<string, unknown>)[k]))) return true;
  return !!def.char && t.spans.some((s) => !s.style.cs && Object.entries(def.char ?? {}).some(([k, v]) => !same(v, (s.style as unknown as Record<string, unknown>)[k])));
}

const NORMAL_CHAR: Partial<CharStyle> = (() => { const { fill, stroke, strokeWidth, ...rest } = pickChar(DEFAULT_CHAR); void fill; void stroke; void strokeWidth; return { ...rest, axes: undefined, rotate: undefined }; })();
const NORMAL_PARA: Partial<ParaStyle> = { ...pickPara(DEFAULT_PARA), hyph: undefined, tabs: undefined, just: undefined, list: undefined };

export function charPatch(doc: Doc, id: string | null): Partial<CharStyle> {
  const def = id ? doc.charStyles.find((s) => s.id === id) : null;
  return def ? { ...def.style, cs: def.id } : { ...NORMAL_CHAR, cs: undefined };
}

export function applyCharStyle(doc: Doc, ids: string[], id: string | null, range?: [number, number]): Doc {
  const patch = charPatch(doc, id);
  return updateNodes(doc, ids, (n) => (n.kind === 'text' ? { ...n, spans: range ? styleSpans(n.spans, range[0], range[1], patch) : n.spans.map((s) => ({ ...s, style: { ...s.style, ...patch } })) } : n));
}

export function applyParaStyle(doc: Doc, ids: string[], id: string | null): Doc {
  const def = id ? doc.paraStyles.find((s) => s.id === id) : null;
  return updateNodes(doc, ids, (n) => {
    if (n.kind !== 'text') return n;
    const para: ParaStyle = def ? { ...n.para, ...def.style, ps: def.id } : { ...n.para, ...NORMAL_PARA, ps: undefined };
    const ch = def?.char ?? (def ? null : NORMAL_CHAR);
    const spans = ch ? n.spans.map((s) => ({ ...s, style: { ...s.style, ...ch, ...(s.style.cs ? doc.charStyles.find((c) => c.id === s.style.cs)?.style ?? {} : {}) } })) : n.spans;
    return { ...n, para, spans };
  });
}

export function addTextStyle(doc: Doc, kind: TextStyleKind, name: string, from: TextNode | null): { doc: Doc; id: string } {
  const id = newId(kind === 'char' ? 'cs' : 'ps');
  const st = from?.spans[0]?.style ?? DEFAULT_CHAR;
  if (kind === 'char') return { doc: { ...doc, charStyles: [...doc.charStyles, { id, name, style: pickChar(st) }] }, id };
  return { doc: { ...doc, paraStyles: [...doc.paraStyles, { id, name, style: pickPara(from?.para ?? DEFAULT_PARA), char: pickChar(st) }] }, id };
}

export function redefineTextStyle(doc: Doc, kind: TextStyleKind, id: string, from: TextNode, range?: [number, number]): Doc {
  if (kind === 'char') {
    const st = range ? spanStyleAt(from, range[0]) : from.spans[0]?.style ?? DEFAULT_CHAR;
    const out: Doc = { ...doc, charStyles: doc.charStyles.map((s) => (s.id === id ? { ...s, style: pickChar(st) } : s)) };
    const linked = allNodes(out).filter((n): n is TextNode => n.kind === 'text' && n.spans.some((s) => s.style.cs === id)).map((n) => n.id);
    const patch = charPatch(out, id);
    return updateNodes(out, linked, (n) => (n.kind === 'text' ? { ...n, spans: n.spans.map((s) => (s.style.cs === id ? { ...s, style: { ...s.style, ...patch } } : s)) } : n));
  }
  const out: Doc = { ...doc, paraStyles: doc.paraStyles.map((s) => (s.id === id ? { ...s, style: pickPara(from.para), char: pickChar(from.spans[0]?.style ?? DEFAULT_CHAR) } : s)) };
  const linked = allNodes(out).filter((n) => n.kind === 'text' && n.para.ps === id).map((n) => n.id);
  return applyParaStyle(out, linked, id);
}

export function deleteTextStyle(doc: Doc, kind: TextStyleKind, id: string): Doc {
  const out: Doc = kind === 'char' ? { ...doc, charStyles: doc.charStyles.filter((s) => s.id !== id) } : { ...doc, paraStyles: doc.paraStyles.filter((s) => s.id !== id) };
  const linked = allNodes(out).filter((n) => n.kind === 'text' && (kind === 'char' ? n.spans.some((s) => s.style.cs === id) : n.para.ps === id)).map((n) => n.id);
  return updateNodes(out, linked, (n): VNode => {
    if (n.kind !== 'text') return n;
    return kind === 'char' ? { ...n, spans: n.spans.map((s) => (s.style.cs === id ? { ...s, style: { ...s.style, cs: undefined } } : s)) } : { ...n, para: { ...n.para, ps: undefined } };
  });
}

export function renameTextStyle(doc: Doc, kind: TextStyleKind, id: string, name: string): Doc {
  return kind === 'char' ? { ...doc, charStyles: doc.charStyles.map((s) => (s.id === id ? { ...s, name } : s)) } : { ...doc, paraStyles: doc.paraStyles.map((s) => (s.id === id ? { ...s, name } : s)) };
}

export interface FontUse { font: string; style: string; count: number; ids: string[] }
export function fontsUsed(doc: Doc): FontUse[] {
  const map = new Map<string, FontUse>();
  for (const n of allNodes(doc)) {
    if (n.kind !== 'text') continue;
    for (const s of n.spans) {
      const k = `${s.style.font}\u0000${s.style.style}`;
      let u = map.get(k);
      if (!u) { u = { font: s.style.font, style: s.style.style, count: 0, ids: [] }; map.set(k, u); }
      u.count += s.text.length;
      if (!u.ids.includes(n.id)) u.ids.push(n.id);
    }
  }
  return [...map.values()].sort((a, b) => a.font.localeCompare(b.font) || a.style.localeCompare(b.style));
}
export function replaceFont(doc: Doc, from: { font: string; style?: string }, to: { font: string; style: string }, ids?: string[]): { doc: Doc; count: number } {
  let count = 0;
  const hit = (st: CharStyle): boolean => st.font === from.font && (from.style === undefined || st.style === from.style);
  const targets = (ids ?? allNodes(doc).filter((n) => n.kind === 'text').map((n) => n.id));
  const out = updateNodes(doc, targets, (n) => (n.kind === 'text' && n.spans.some((s) => hit(s.style)) ? { ...n, spans: n.spans.map((s) => (hit(s.style) ? (count++, { ...s, style: { ...s.style, font: to.font, style: to.style } }) : s)) } : n));
  return { doc: count ? out : doc, count };
}

function spanStyleAt(t: TextNode, index: number): CharStyle {
  let pos = 0;
  for (const s of t.spans) { if (index < pos + s.text.length) return s.style; pos += s.text.length; }
  return t.spans[t.spans.length - 1]?.style ?? DEFAULT_CHAR;
}
