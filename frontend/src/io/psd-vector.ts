import { Out } from './psd-write';
import type { Anchor, Color, FillRule, Gradient, PathData, SubPath } from '../engine/types';
import { toRgb } from '../engine/paint';
import { flattenSub } from '../engine/geometry';

// Adobe Photoshop File Formats Specification, https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/
// Sections used: Additional Layer Information (lsct, TySh, SoCo, GdFl, vmsk, vstk), Descriptor structure, Path record, Fixed-point.

export type DV =
  | { t: 'long'; v: number } | { t: 'doub'; v: number } | { t: 'UntF'; u: string; v: number } | { t: 'TEXT'; v: string }
  | { t: 'enum'; a: string; b: string } | { t: 'bool'; v: boolean } | { t: 'tdta'; v: Uint8Array }
  | { t: 'Objc'; cls: string; items: Array<[string, DV]> } | { t: 'VlLs'; items: DV[] };

const L = (v: number): DV => ({ t: 'long', v }), D = (v: number): DV => ({ t: 'doub', v }), U = (u: string, v: number): DV => ({ t: 'UntF', u, v });
const E = (a: string, b: string): DV => ({ t: 'enum', a, b }), B = (v: boolean): DV => ({ t: 'bool', v }), O = (cls: string, items: Array<[string, DV]>): DV => ({ t: 'Objc', cls, items });

function idStr(o: Out, s: string): void { o.u32(s.length === 4 ? 0 : s.length); o.tag(s); }
function uni(o: Out, s: string): void { o.u32(s.length + 1); for (let i = 0; i < s.length; i++) o.u16(s.charCodeAt(i)); o.u16(0); }
function body(o: Out, v: DV): void {
  switch (v.t) {
    case 'long': o.u32(v.v); break;
    case 'doub': dbl(o, v.v); break;
    case 'UntF': o.tag(v.u); dbl(o, v.v); break;
    case 'TEXT': uni(o, v.v); break;
    case 'enum': idStr(o, v.a); idStr(o, v.b); break;
    case 'bool': o.u8(v.v ? 1 : 0); break;
    case 'tdta': o.u32(v.v.length); o.bytes(v.v); break;
    case 'Objc': desc(o, v.cls, v.items); break;
    case 'VlLs': o.u32(v.items.length); for (const it of v.items) { o.tag(it.t === 'Objc' ? 'Objc' : it.t); body(o, it); } break;
  }
}
function dbl(o: Out, x: number): void { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, x); for (let i = 0; i < 8; i++) o.u8(b.getUint8(i)); }
function desc(o: Out, cls: string, items: Array<[string, DV]>): void {
  uni(o, ''); idStr(o, cls); o.u32(items.length);
  for (const [k, v] of items) { idStr(o, k); o.tag(v.t === 'Objc' ? 'Objc' : v.t); body(o, v); }
}
export function descriptor(cls: string, items: Array<[string, DV]>): Uint8Array { const o = new Out(); desc(o, cls, items); return o.done().slice(); }

export function block(key: string, data: Uint8Array): Uint8Array {
  const o = new Out();
  const padded = Math.ceil(data.length / 4) * 4;
  o.tag('8BIM'); o.tag(key); o.u32(padded); o.bytes(data);
  for (let i = data.length; i < padded; i++) o.u8(0);
  return o.done().slice();
}
export function concat(parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((a, p) => a + p.length, 0), out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
function withVersion(d: Uint8Array): Uint8Array { const o = new Out(); o.u32(16); o.bytes(d); return o.done().slice(); }

export function sectionBlock(kind: 'open' | 'closed' | 'divider', key: string): Uint8Array {
  const o = new Out();
  o.u32(kind === 'open' ? 1 : kind === 'closed' ? 2 : 3); o.tag('8BIM'); o.tag(key); o.u32(0);
  return block('lsct', o.done().slice());
}

const rgb255 = (c: Color): Array<[string, DV]> => { const q = toRgb(c); return [['Rd  ', D(q.r)], ['Grn ', D(q.g)], ['Bl  ', D(q.b)]]; };
const clr = (c: Color): DV => O('RGBC', rgb255(c));

export function solidBlock(c: Color): Uint8Array { return block('SoCo', withVersion(descriptor('null', [['Clr ', clr(c)]]))); }

export function gradientBlock(g: Gradient, angle: number): Uint8Array {
  const stops = [...g.stops].sort((a, b) => a.offset - b.offset);
  const loc = (s: number): number => Math.round(Math.max(0, Math.min(1, s)) * 4096);
  const mid = (m: number): number => Math.round(Math.max(0, Math.min(1, m <= 1 ? m : m / 100)) * 100) || 50;
  const clrs: DV = { t: 'VlLs', items: stops.map((s) => O('Clrt', [['Clr ', clr(s.color)], ['Type', E('Clry', 'UsrS')], ['Lctn', L(loc(s.offset))], ['Mdpn', L(mid(s.mid))]])) };
  const trns: DV = { t: 'VlLs', items: stops.map((s) => O('TrnS', [['Opct', U('#Prc', Math.max(0, Math.min(1, s.opacity)) * 100)], ['Lctn', L(loc(s.offset))], ['Mdpn', L(mid(s.mid))]])) };
  const grad = O('Grdn', [['Nm  ', { t: 'TEXT', v: 'Custom' }], ['GrdF', E('GrdF', 'CstS')], ['Intr', D(4096)], ['Clrs', clrs], ['Trns', trns]]);
  const d = descriptor('null', [['Dthr', B(false)], ['Angl', U('#Ang', angle)], ['Type', E('GrdT', g.kind === 'radial' ? 'Rdl ' : 'Lnr ')], ['Rvrs', B(false)], ['Algn', B(true)], ['Scl ', U('#Prc', 100)], ['Grad', grad]]);
  return block('GdFl', withVersion(d));
}

export interface PsdStroke { color: Color; width: number; cap: 'butt' | 'round' | 'square'; join: 'miter' | 'round' | 'bevel'; miter: number; align: 'center' | 'inside' | 'outside'; dash: number[]; dashOffset: number; opacity: number }
export function strokeBlock(s: PsdStroke | null, fill: boolean): Uint8Array {
  const cap = { butt: 'strokeStyleButtCap', round: 'strokeStyleRoundCap', square: 'strokeStyleSquareCap' }[s?.cap ?? 'butt'];
  const join = { miter: 'strokeStyleMiterJoin', round: 'strokeStyleRoundJoin', bevel: 'strokeStyleBevelJoin' }[s?.join ?? 'miter'];
  const align = { center: 'strokeStyleAlignCenter', inside: 'strokeStyleAlignInside', outside: 'strokeStyleAlignOutside' }[s?.align ?? 'center'];
  const dashes: DV = { t: 'VlLs', items: (s?.dash ?? []).map((v) => U('#Nne', v / Math.max(1e-6, s?.width ?? 1))) };
  const items: Array<[string, DV]> = [
    ['strokeStyleVersion', L(2)], ['strokeEnabled', B(!!s)], ['fillEnabled', B(fill)], ['strokeStyleLineWidth', U('#Pxl', s?.width ?? 1)], ['strokeStyleLineDashOffset', U('#Pnt', s?.dashOffset ?? 0)],
    ['strokeStyleMiterLimit', D(s?.miter ?? 4)], ['strokeStyleLineCapType', E('strokeStyleLineCapType', cap)], ['strokeStyleLineJoinType', E('strokeStyleLineJoinType', join)], ['strokeStyleLineAlignment', E('strokeStyleLineAlignment', align)],
    ['strokeStyleScaleLock', B(false)], ['strokeStyleStrokeAdjust', B(false)], ['strokeStyleLineDashSet', dashes], ['strokeStyleBlendMode', E('BlnM', 'Nrml')], ['strokeStyleOpacity', U('#Prc', (s?.opacity ?? 1) * 100)],
    ['strokeStyleContent', O('solidColorLayer', [['Clr ', clr(s?.color ?? { kind: 'rgb', r: 0, g: 0, b: 0 })]])], ['strokeStyleResolution', D(72)],
  ];
  return block('vstk', withVersion(descriptor('strokeStyle', items)));
}

const fx = (v: number): number => Math.max(-0x80000000, Math.min(0x7fffffff, Math.round(v * 16777216)));
function signedArea(sp: SubPath): number {
  const f = flattenSub(sp, 0.5);
  let a = 0;
  for (let i = 0; i < f.length; i++) { const p = f[i], q = f[(i + 1) % f.length]; a += p.x * q.y - q.x * p.y; }
  return a / 2;
}
function inside(pt: { x: number; y: number }, sp: SubPath): boolean {
  const f = flattenSub(sp, 0.5);
  let c = false;
  for (let i = 0, j = f.length - 1; i < f.length; j = i++) if ((f[i].y > pt.y) !== (f[j].y > pt.y) && pt.x < ((f[j].x - f[i].x) * (pt.y - f[i].y)) / (f[j].y - f[i].y) + f[i].x) c = !c;
  return c;
}

export function vectorMaskBlock(paths: PathData[], rule: FillRule, to: (x: number, y: number) => { x: number; y: number }, w: number, h: number): Uint8Array {
  const subs = paths.flat().filter((s) => s.pts.length > 0);
  const o = new Out();
  o.u32(3); o.u32(0);
  const rec = (sel: number, fill: (r: Out) => void): void => { const r = new Out(); r.u16(sel); fill(r); while (r.n < 26) r.u8(0); o.bytes(r.done()); };
  rec(6, () => undefined); rec(8, () => undefined);
  const first = subs.length ? signedArea(subs[0]) : 1;
  subs.forEach((sp, i) => {
    let op = 1;
    if (i > 0) {
      if (rule === 'evenodd') op = 0;
      else if (signedArea(sp) * first < 0 && subs.slice(0, i).some((q) => q.closed && inside({ x: sp.pts[0].x, y: sp.pts[0].y }, q))) op = 2;
    }
    rec(sp.closed ? 0 : 3, (r) => { r.u16(sp.pts.length); r.u16(op); r.u16(1); r.u16(0); r.u16(0); r.u16(0); r.u16(i); });
    for (const a of sp.pts as Anchor[]) {
      const p = [to(a.ix, a.iy), to(a.x, a.y), to(a.ox, a.oy)];
      rec(sp.closed ? 2 : 5, (r) => { for (const q of p) { r.u32(fx(q.y / h)); r.u32(fx(q.x / w)); } });
    }
  });
  return block('vmsk', o.done().slice());
}

// EngineData: the text-serialised dictionary stored in the TySh descriptor, learned from real files (tab indent, UTF-16BE strings with BOM in parentheses).
type EV = number | boolean | { s: string } | EV[] | { d: Array<[string, EV]> };
const isD = (v: EV): v is { d: Array<[string, EV]> } => typeof v === 'object' && !Array.isArray(v) && 'd' in v;
const num = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(+n.toFixed(5)));
function ser(v: EV, ind: number, out: number[]): void {
  const put = (s: string): void => { for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 255); };
  if (typeof v === 'number') { put(num(v)); return; }
  if (typeof v === 'boolean') { put(v ? 'true' : 'false'); return; }
  if (Array.isArray(v)) {
    if (v.length && v.every(isD)) { put('[\n'); for (const e of v) { put('\t'.repeat(ind + 1)); ser(e, ind + 1, out); put('\n'); } put('\t'.repeat(ind) + ']'); }
    else { put('['); for (const e of v) { put(' '); ser(e, ind, out); } put(' ]'); }
    return;
  }
  if (isD(v)) {
    put('<<\n');
    for (const [k, e] of v.d) {
      put('\t'.repeat(ind + 1) + '/' + k);
      if (isD(e)) { put('\n' + '\t'.repeat(ind + 1)); ser(e, ind + 1, out); } else { put(' '); ser(e, ind + 1, out); }
      put('\n');
    }
    put('\t'.repeat(ind) + '>>');
    return;
  }
  const units: number[] = [0xfeff];
  for (const ch of v.s) { const c = ch.codePointAt(0) ?? 63; if (c > 0xffff) { const q = c - 0x10000; units.push(0xd800 + (q >> 10), 0xdc00 + (q & 0x3ff)); } else units.push(c); }
  put('(');
  for (const u of units) for (const b of [u >> 8, u & 255]) { if (b === 0x28 || b === 0x29 || b === 0x5c) out.push(0x5c); out.push(b); }
  put(')');
}
const dd = (...e: Array<[string, EV]>): EV => ({ d: e });

export interface TextRun { text: string; font: string; size: number; fill: Color; tracking: number; leading: number | null; hscale: number; vscale: number; baseline: number; underline: boolean; strike: boolean; caps: 'none' | 'all' | 'small' }
export interface TextIn { runs: TextRun[]; align: number; indentLeft: number; indentRight: number; indentFirst: number; spaceBefore: number; spaceAfter: number; area: { w: number; h: number } | null; bounds: { l: number; t: number; r: number; b: number }; xf: [number, number, number, number, number, number]; antiAlias: boolean }

export function typeBlock(t: TextIn): Uint8Array {
  const fonts: string[] = [];
  const text = t.runs.map((r) => r.text).join('').replace(/\r?\n/g, '\r') + '\r';
  const runs = t.runs.map((r) => ({ ...r, text: r.text.replace(/\r?\n/g, '\r') }));
  runs[runs.length - 1].text += '\r';
  const colour = (c: Color): EV => { const q = toRgb(c); return [1, q.r / 255, q.g / 255, q.b / 255]; };
  const sheet = (r: TextRun): EV => {
    let fi = fonts.indexOf(r.font); if (fi < 0) { fonts.push(r.font); fi = fonts.length - 1; }
    return dd(['Font', fi], ['FontSize', r.size], ['FauxBold', false], ['FauxItalic', false], ['AutoLeading', r.leading === null], ['Leading', r.leading ?? r.size * 1.2], ['HorizontalScale', r.hscale / 100], ['VerticalScale', r.vscale / 100], ['Tracking', Math.round(r.tracking)], ['AutoKerning', true], ['Kerning', 0], ['BaselineShift', r.baseline],
      ['FontCaps', r.caps === 'all' ? 2 : r.caps === 'small' ? 1 : 0], ['FontBaseline', 0], ['Underline', r.underline], ['Strikethrough', r.strike], ['Ligatures', true], ['DLigatures', false], ['BaselineDirection', 1], ['Tsume', 0], ['StyleRunAlignment', 2], ['Language', 0], ['NoBreak', false],
      ['FillColor', dd(['Type', 1], ['Values', colour(r.fill)])], ['StrokeColor', dd(['Type', 1], ['Values', [1, 0, 0, 0]])], ['FillFlag', true], ['StrokeFlag', false], ['FillFirst', true], ['YUnderline', 1], ['OutlineWidth', 1], ['CharacterDirection', 0], ['HindiNumbers', false], ['Kashida', 1], ['DiacriticPos', 2]);
  };
  const styleRun = runs.map((r) => dd(['StyleSheet', dd(['StyleSheetData', sheet(r)])]));
  const paras = text.split(/(?<=\r)/).filter((s) => s.length > 0);
  const psheet = dd(['Justification', t.align], ['FirstLineIndent', t.indentFirst], ['StartIndent', t.indentLeft], ['EndIndent', t.indentRight], ['SpaceBefore', t.spaceBefore], ['SpaceAfter', t.spaceAfter], ['AutoHyphenate', false], ['HyphenatedWordSize', 6], ['PreHyphen', 2], ['PostHyphen', 2], ['ConsecutiveHyphens', 8], ['Zone', 36], ['WordSpacing', [0.8, 1, 1.33]], ['LetterSpacing', [0, 0, 0]], ['GlyphSpacing', [1, 1, 1]], ['AutoLeading', 1.2], ['LeadingType', 0], ['Hanging', false], ['Burasagari', false], ['KinsokuOrder', 0], ['EveryLineComposer', false]);
  const axes = dd(['Axis', [1, 0, 1]], ['XY', [0, 0]]);
  const ptype = t.area ? 1 : 0;
  const cookie = dd(['Photoshop', dd(['ShapeType', ptype], t.area ? ['BoxBounds', [0, 0, t.area.w, t.area.h]] as [string, EV] : ['PointBase', [0, 0]] as [string, EV], ['Base', dd(['ShapeType', ptype], ['TransformPoint0', [1, 0]], ['TransformPoint1', [0, 1]], ['TransformPoint2', [0, 0]])])]);
  const res = (): EV => dd(
    ['KinsokuSet', [dd(['Name', { s: 'PhotoshopKinsokuHard' }], ['NoStart', { s: '' }], ['NoEnd', { s: '' }], ['Keep', { s: '' }], ['Hanging', { s: '' }]), dd(['Name', { s: 'PhotoshopKinsokuSoft' }], ['NoStart', { s: '' }], ['NoEnd', { s: '' }], ['Keep', { s: '' }], ['Hanging', { s: '' }])]],
    ['MojiKumiSet', [1, 2, 3, 4].map((i) => dd(['InternalName', { s: `Photoshop6MojiKumiSet${i}` }]))],
    ['TheNormalStyleSheet', 0], ['TheNormalParagraphSheet', 0],
    ['ParagraphSheetSet', [dd(['Name', { s: 'Normal RGB' }], ['DefaultStyleSheet', 0], ['Properties', psheet])]],
    ['StyleSheetSet', [dd(['Name', { s: 'Normal RGB' }], ['StyleSheetData', sheet(runs[0])])]],
    ['FontSet', fonts.map((f) => dd(['Name', { s: f }], ['Script', 0], ['FontType', 1], ['Synthetic', 0]))],
    ['SuperscriptSize', 0.583], ['SuperscriptPosition', 0.333], ['SubscriptSize', 0.583], ['SubscriptPosition', 0.333], ['SmallCapSize', 0.7]);
  const engine = dd(
    ['Editor', dd(['Text', { s: text }])],
    ['ParagraphRun', dd(['DefaultRunData', dd(['ParagraphSheet', dd(['DefaultStyleSheet', 0], ['Properties', dd()])], ['Adjustments', axes])]
      , ['RunArray', paras.map(() => dd(['ParagraphSheet', dd(['DefaultStyleSheet', 0], ['Properties', psheet])], ['Adjustments', axes]))], ['RunLengthArray', paras.map((p) => p.length)], ['IsJoinable', 1])],
    ['StyleRun', dd(['DefaultRunData', dd(['StyleSheet', dd(['StyleSheetData', dd()])])], ['RunArray', styleRun], ['RunLengthArray', runs.map((r) => r.text.length)], ['IsJoinable', 2])],
    ['GridInfo', dd(['GridIsOn', false], ['ShowGrid', false], ['GridSize', 18], ['GridLeading', 22], ['GridColor', dd(['Type', 1], ['Values', [0, 0, 0, 1]])], ['GridLeadingFillColor', dd(['Type', 1], ['Values', [0, 0, 0, 1]])], ['AlignLineHeightToGridFlags', false])],
    ['AntiAlias', t.antiAlias ? 3 : 0], ['UseFractionalGlyphWidths', true],
    ['Rendered', dd(['Version', 1], ['Shapes', dd(['WritingDirection', 0], ['Children', [dd(['ShapeType', ptype], ['Procession', 0], ['Lines', dd(['WritingDirection', 0], ['Children', []])], ['Cookie', cookie])]])])]);
  const top = dd(['EngineDict', engine], ['ResourceDict', res()], ['DocumentResources', res()]);
  const bytes: number[] = [10, 10];
  ser(top, 0, bytes);
  bytes.push(10);
  const box = (b: { l: number; t: number; r: number; b: number }): DV => O('bounds', [['Left', U('#Pxl', b.l)], ['Top ', U('#Pxl', b.t)], ['Rght', U('#Pxl', b.r)], ['Btom', U('#Pxl', b.b)]]);
  const txt = descriptor('TxLr', [['Txt ', { t: 'TEXT', v: text }], ['textGridding', E('textGridding', 'None')], ['Ornt', E('Ornt', 'Hrzn')], ['AntA', E('Annt', t.antiAlias ? 'AnSm' : 'Anno')], ['bounds', box(t.bounds)], ['boundingBox', box(t.bounds)], ['TextIndex', L(0)], ['EngineData', { t: 'tdta', v: Uint8Array.from(bytes) }]]);
  const warp = descriptor('warp', [['warpStyle', E('warpStyle', 'warpNone')], ['warpValue', D(0)], ['warpPerspective', D(0)], ['warpPerspectiveOther', D(0)], ['warpRotate', E('Ornt', 'Hrzn')]]);
  const o = new Out();
  o.u16(1);
  for (const v of t.xf) dbl(o, v);
  o.u16(50); o.u32(16); o.bytes(txt);
  o.u16(1); o.u32(16); o.bytes(warp);
  for (let i = 0; i < 4; i++) o.u32(0);
  return block('TySh', o.done().slice());
}
