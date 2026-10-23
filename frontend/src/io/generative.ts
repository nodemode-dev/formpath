import { geomBounds } from '../engine/bounds';
import { cloneNode, newDoc, newId } from '../engine/doc';
import { isEmptyRect, mul, pathBounds, toSvgD, transformPath } from '../engine/geometry';
import { transformNode } from '../engine/transform';
import { collectColors, fitRowsToPalette, recolorDoc, rowsFn } from '../engine/ops/recolor';
import { hex, parseColor } from '../engine/paint';
import type { Color, Doc, Engine, FillRule, Mat, PathData, Rect, VNode } from '../engine';
import type { Project } from '../engine';
import { api } from './api';
import { applyEffects, constraints, enforcePalette, type Constraints, type GenCommon } from './gen-options';
import { emptyReport, extractSvg, finishNodes, reportLines, repairSvg, seamCheck, seamlessWrap, type Report, type SeamCheck } from './gen-repair';
import { importSvg } from './svg';

export { extractSvg } from './gen-repair';
export type { GenCommon, StyleRef } from './gen-options';

export interface ModelState { ready: boolean; vision: boolean; model: string; message: string }
export const NO_MODEL = 'No language model is set. Generative features use the model you choose for the Assistant: set it in Preferences > Plugins (Ollama, LM Studio or any OpenAI-compatible service).';

export async function modelState(): Promise<ModelState> {
  const s = await api.llmStatus();
  if (!s) return { ready: false, vision: false, model: '', message: 'The formpath engine is offline. Start it with ./formpath boot; generative features run through it.' };
  if (!s.configured) return { ready: false, vision: false, model: '', message: NO_MODEL };
  return { ready: true, vision: !!s.vision, model: s.model, message: `Uses ${s.model}${s.vision ? ', which reads images' : ''}.` };
}

export function sanitizeSvg(src: string): string { return repairSvg(src, 1000, 1000).svg; }

const SYSTEM = 'You draw vector graphics as SVG. Answer with one complete <svg> element and nothing else: no prose, no code fences. Use only g, path, rect, circle, ellipse, polygon, polyline, line, defs, linearGradient, radialGradient and stop. Paint with solid colours, and with gradients only when the brief allows them: define each gradient in defs with an id and two or more stops (offset 0 to 1), then use fill="url(#id)". Strokes may set stroke-width, stroke-linecap and stroke-linejoin. Make holes with one path of several subpaths and fill-rule="evenodd". Group related shapes in named groups such as <g id="sky" data-name="Sky">; opacity on groups is fine, and mix-blend-mode in a style attribute (multiply, screen or overlay) is allowed for shadows and highlights. Close every filled path with Z. No text, images, filters, masks, scripts, CSS classes or external references.';

interface SvgArt { nodes: VNode[]; report: Report; vbW: number; vbH: number }

async function svgNodes(text: string, vw: number, vh: number, c: Constraints, scene = false): Promise<SvgArt> {
  const svg = extractSvg(text);
  if (!svg) throw new Error('The model did not answer with SVG.');
  const fixed = repairSvg(svg, vw, vh), dom = new DOMParser().parseFromString(fixed.svg, 'image/svg+xml'), root = dom.documentElement;
  const vb = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const hasVb = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0;
  if (!hasVb) root.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  root.setAttribute('width', String(hasVb ? vb[2] : vw)); root.setAttribute('height', String(hasVb ? vb[3] : vh));
  const wrap = dom.createElementNS(root.namespaceURI, 'g');
  wrap.setAttribute('data-name', 'Generated');
  while (root.firstChild) wrap.appendChild(root.firstChild);
  root.appendChild(wrap);
  const r = await importSvg(new XMLSerializer().serializeToString(root), 'Generated');
  const report = fixed.report;
  report.notes.push(...r.leftOut);
  const nodes = finishNodes(r.doc.layers.flatMap((l) => l.children), { vbW: hasVb ? vb[2] : vw, vbH: hasVb ? vb[3] : vh, limits: c.limits, scene }, report);
  if (!nodes.length) throw new Error(`The model answered with an SVG that has no usable shapes${reportLines(report).length ? ` (${reportLines(report).join('; ')})` : ''}.`);
  return { nodes, report, vbW: hasVb ? vb[2] : vw, vbH: hasVb ? vb[3] : vh };
}

const MAX_TOKENS = 12000;
async function ask(c: Constraints, user: string, i: number, n: number, temperature: number): Promise<string> {
  const res = await api.llmGenerate(SYSTEM, n > 1 ? `${user}\nVariation ${i + 1} of ${n}: make it distinct from the others.` : user, { temperature, maxTokens: MAX_TOKENS, ...(c.image ? { image: c.image } : {}) });
  return res.text;
}

const wrapGroup = (children: VNode[], name: string): VNode => ({ id: newId('g'), kind: 'group', name, clip: false, children, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } });
const moved = (n: VNode, m: Mat): VNode => transformNode(n, m);
const boundsOf = (n: VNode): Rect => { const d: Doc = { ...newDoc(10, 10), layers: [{ ...newDoc(10, 10).layers[0], children: [n] }] }; return geomBounds(d, n); };

export interface ShapeTarget { d: PathData; rule: FillRule; color: Color | null }
export interface ShapeFillOptions extends GenCommon { prompt: string; strength: number; detail: number; variations: number }
export interface Variation { art: VNode | null; error: string | null; report?: Report | null }
export const strengthMode = (s: number): string => (s >= 67 ? 'Fit silhouette, then clip' : s >= 34 ? 'Follow loosely, then clip' : 'Clip only');

export async function shapeFillVariations(t: ShapeTarget, o: ShapeFillOptions): Promise<Variation[]> {
  const b = pathBounds(t.d);
  if (isEmptyRect(b) || b.w < 1 || b.h < 1) throw new Error('The shape is too small to fill.');
  const k = 1000 / Math.max(b.w, b.h), W = Math.round(b.w * k), H = Math.round(b.h * k);
  const outline = toSvgD(transformPath(t.d, [k, 0, 0, k, -b.x * k, -b.y * k]), 1);
  const strength = Math.max(0, Math.min(100, o.strength));
  const c = constraints(o, 5);
  const user = [
    `Make SVG art with viewBox="0 0 ${W} ${H}" that fills this outline: <path d="${outline}"${t.rule === 'evenodd' ? ' fill-rule="evenodd"' : ''}/>.`,
    `Subject: ${o.prompt.trim() || 'an ornamental illustration that suits the outline'}.`,
    `Shape strength ${strength} of 100 (${strengthMode(strength)}): ${strength >= 67 ? 'fit the silhouette first: the subject must take the shape of the outline and reach every edge of it, and formpath then clips it to the outline' : strength >= 34 ? 'arrange the subject to follow the outline loosely and cover it; formpath then clips it to the outline' : 'compose freely: the outline only crops the art, so cover the whole viewBox'}.`,
    c.text,
    c.palette.length || o.reference?.palette.length || o.style !== undefined && o.style !== 'auto' ? '' : t.color ? `Work with a palette that suits ${hex(t.color)}.` : 'Choose a harmonious palette.',
    'The art will be clipped to the outline, so let shapes run past its edge rather than leave gaps.',
  ].filter(Boolean).join('\n');
  const n = Math.max(1, Math.min(3, Math.round(o.variations)));
  const runs = Array.from({ length: n }, async (_, i): Promise<Variation> => {
    try {
      const made = await svgNodes(await ask(c, user, i, n, 0.6 + i * 0.25), W, H, c);
      let art = wrapGroup(made.nodes, 'Generated Art');
      art = enforcePalette(art, c.palette);
      art = moved(art, [1 / k, 0, 0, 1 / k, b.x, b.y]);
      if (strength >= 67) {
        const raw = boundsOf(art), x0 = Math.max(raw.x, b.x - b.w * 0.1), y0 = Math.max(raw.y, b.y - b.h * 0.1);
        const ab: Rect = { x: x0, y: y0, w: Math.min(raw.x + raw.w, b.x + b.w * 1.1) - x0, h: Math.min(raw.y + raw.h, b.y + b.h * 1.1) - y0 };
        if (!isEmptyRect(ab) && ab.w > 0.5 && ab.h > 0.5) art = moved(art, mul([b.w / ab.w, 0, 0, b.h / ab.h, b.x, b.y], [1, 0, 0, 1, -ab.x, -ab.y]));
      }
      return { art: applyEffects(art, o.effects ?? [], c.palette), error: null, report: made.report };
    } catch (err) { return { art: null, error: err instanceof Error ? err.message : String(err) }; }
  });
  return Promise.all(runs);
}

export function artParts(art: VNode): VNode[] { return art.kind === 'group' && !art.clip && !art.ap.effects.length ? art.children : [art]; }

export function clipToShape(art: VNode, shape: VNode): VNode {
  const kids = artParts(art);
  return { id: newId('g'), kind: 'group', name: 'AI Shape Fill', clip: true, children: [...kids, shape], opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
}

export const PATTERN_PRESETS: ReadonlyArray<readonly [string, string, string[]]> = [
  ['any', 'Any colours', []],
  ['warm', 'Warm', ['#7a1f12', '#c2410c', '#ea7a28', '#f2b134', '#f6dfa4', '#fff6e5']],
  ['cool', 'Cool', ['#0b2545', '#13315c', '#1f6f8b', '#3fa7b5', '#99d6d9', '#eef7f7']],
  ['pastel', 'Pastel', ['#f7c6d0', '#fbe3c4', '#fdf5c2', '#c9ecd3', '#c7def5', '#ddd1f2', '#ffffff']],
  ['earth', 'Earth', ['#3b2f2a', '#6b4f3a', '#a0764f', '#c9a66b', '#7d8a5a', '#e9dfc9']],
  ['vivid', 'Vivid', ['#ff2e63', '#ffb000', '#00c2a8', '#2b59ff', '#8f2bff', '#111111', '#ffffff']],
  ['mono', 'Monochrome', ['#111111', '#444444', '#777777', '#aaaaaa', '#dddddd', '#ffffff']],
  ['forest', 'Forest', ['#14301f', '#245a36', '#3f8a4f', '#8cbf6a', '#d9e8b8', '#f4f1e1']],
  ['ocean', 'Ocean', ['#03256c', '#2541b2', '#1768ac', '#06bee1', '#a7e8f0', '#ffffff']],
];
export const DENSITY = ['', 'very sparse: 2 to 4 motifs', 'sparse: 4 to 8 motifs', 'balanced: 8 to 14 motifs', 'dense: 14 to 24 motifs', 'packed: 24 to 40 motifs'];
export type PatternLayout = 'grid' | 'brick_row' | 'brick_col' | 'hex_col' | 'hex_row';
export const PATTERN_LAYOUTS: ReadonlyArray<readonly [PatternLayout, string]> = [['grid', 'Grid'], ['brick_row', 'Brick by row'], ['brick_col', 'Brick by column'], ['hex_col', 'Hex by column'], ['hex_row', 'Hex by row']];
export interface PatternGenOptions extends GenCommon { prompt: string; colors: Color[]; density: number; variations: number; tile?: number; seamless?: boolean; layout?: PatternLayout; hs?: number; vs?: number; project?: Project | null }
export interface PatternVariation { art: VNode | null; tile: Rect; error: string | null; report?: Report | null; seam?: SeamCheck | null; layout?: { type: PatternLayout; hs: number; vs: number } }

export async function patternVariations(o: PatternGenOptions): Promise<PatternVariation[]> {
  const V = 200, T = Math.max(12, Math.min(720, o.tile ?? 96)), density = Math.max(1, Math.min(5, Math.round(o.density)));
  const common: GenCommon = { ...o, palette: o.palette?.length || (o.tone && o.tone !== 'auto') ? o.palette : o.colors.slice(0, 12) };
  const c = constraints(common, 4, 1 + density, 'for each motif');
  const layout = { type: o.layout ?? 'grid', hs: o.hs ?? 0, vs: o.vs ?? 0 };
  const user = [
    `Make one tile of a seamless repeating pattern, viewBox="0 0 ${V} ${V}".`,
    `Theme: ${o.prompt.trim() || 'an elegant decorative motif'}.`,
    `Density: ${DENSITY[density]} per tile.`,
    c.text,
    c.palette.length ? 'You may put a full-tile background rect in one of the colours first.' : 'Choose a harmonious palette and a background rect first.',
    'Motifs may cross the tile edges: formpath repeats the tile so anything past an edge shows on the opposite side. Draw each crossing motif once, at its true position; do not draw the wrapped copies yourself.',
  ].join('\n');
  const n = Math.max(1, Math.min(4, Math.round(o.variations)));
  const tile: Rect = { x: 0, y: 0, w: T, h: T };
  return Promise.all(Array.from({ length: n }, async (_, i): Promise<PatternVariation> => {
    try {
      const made = await svgNodes(await ask(c, user, i, n, 0.6 + i * 0.2), V, V, c);
      let art = wrapGroup(made.nodes, 'Pattern Tile');
      const fit = T / Math.max(made.vbW, made.vbH);
      art = moved(art, [fit, 0, 0, fit, (T - made.vbW * fit) / 2, (T - made.vbH * fit) / 2]);
      art = enforcePalette(art, c.palette);
      let seam: SeamCheck | null = null;
      if (o.seamless !== false && art.kind === 'group') {
        const w = seamlessWrap(art, tile);
        art = w.art;
        if (w.crossing) made.report.notes.push(`${w.crossing} motif${w.crossing === 1 ? '' : 's'} cross the tile edge: ${w.copies} cop${w.copies === 1 ? 'y was' : 'ies were'} added on the opposite side${w.skipped ? `; ${w.skipped} translucent motif${w.skipped === 1 ? '' : 's'} left to the pattern engine` : ''}.`);
        else made.report.notes.push('No motif crosses the tile edge.');
      }
      if (o.project) {
        try { seam = await seamCheck(o.project, art, tile); made.report.notes.push(seam.ok ? `Seamless check passed (edge mismatch ${Math.round(Math.max(seam.x, seam.y) * 1000) / 10}%).` : `Seamless check: the edges differ by ${Math.round(Math.max(seam.x, seam.y) * 1000) / 10}%, a seam may show.`); } catch { seam = null; }
      }
      return { art: applyEffects(art, o.effects ?? [], c.palette), tile, error: null, report: made.report, seam, layout };
    } catch (err) { return { art: null, tile, error: err instanceof Error ? err.message : String(err), layout }; }
  }));
}

export const VECTOR_TYPES: ReadonlyArray<readonly [string, string, string]> = [
  ['subject', 'Subject', 'one centred subject on a transparent background, with no background rectangle'],
  ['scene', 'Scene', 'a full scene that fills the whole viewBox edge to edge, built as exactly three top-level groups in this order: <g id="background" data-name="Background"> (sky, ground, distant shapes), <g id="midground" data-name="Midground"> (the main elements) and <g id="foreground" data-name="Foreground"> (near details and framing)'],
  ['icon', 'Icon', 'a simple flat icon: one bold glyph with at most six colours, centred with padding, no background'],
  ['pattern', 'Pattern', 'a decorative repeating pattern of motifs laid out in a grid that covers the whole viewBox'],
];
export interface TextToVectorOptions extends GenCommon { prompt: string; type: string; detail: number; variations: number }

export async function textToVectorVariations(o: TextToVectorOptions): Promise<Variation[]> {
  const kind = VECTOR_TYPES.find(([id]) => id === o.type) ?? VECTOR_TYPES[0];
  if (!o.prompt.trim()) throw new Error('Describe what to draw first.');
  const c = constraints(o, 5);
  const user = [
    `Make ${/^[aeiou]/i.test(kind[1]) ? 'an' : 'a'} ${kind[1].toLowerCase()} vector graphic with viewBox="0 0 1000 1000".`,
    `Prompt: ${o.prompt.trim()}.`,
    `Type ${kind[1]}: ${kind[2]}.`,
    c.text,
    c.palette.length || o.reference?.palette.length || (o.style && o.style !== 'auto') ? '' : 'Choose a harmonious palette.',
    'Keep every shape closed and editable.',
  ].filter(Boolean).join('\n');
  const n = Math.max(1, Math.min(3, Math.round(o.variations)));
  return Promise.all(Array.from({ length: n }, async (_, i): Promise<Variation> => {
    try {
      const made = await svgNodes(await ask(c, user, i, n, 0.6 + i * 0.25), 1000, 1000, c, kind[0] === 'scene');
      const art = enforcePalette(wrapGroup(made.nodes, 'AI Vector from Text'), c.palette);
      return { art: applyEffects(art, o.effects ?? [], c.palette), error: null, report: made.report };
    } catch (err) { return { art: null, error: err instanceof Error ? err.message : String(err) }; }
  }));
}

export function vectorTarget(engine: Engine): Rect | null {
  const p = engine.current;
  if (!p) return null;
  const sel = engine.selected()[0];
  if (sel) { const b = geomBounds(p.doc, sel); if (b.w > 0.5 && b.h > 0.5) return b; }
  const ab = p.doc.artboards[p.activeArtboard] ?? p.doc.artboards[0];
  return ab ? { x: ab.x + ab.w * 0.15, y: ab.y + ab.h * 0.15, w: ab.w * 0.7, h: ab.h * 0.7 } : null;
}

export function placeVector(engine: Engine, art: VNode): string | null {
  const target = vectorTarget(engine);
  if (!target) return null;
  const fresh = cloneNode(art), ab = boundsOf(fresh);
  if (isEmptyRect(ab) || ab.w < 0.01 || ab.h < 0.01) return null;
  const s = Math.min(target.w / ab.w, target.h / ab.h);
  const fitted = moved(fresh, [s, 0, 0, s, target.x + (target.w - ab.w * s) / 2 - ab.x * s, target.y + (target.h - ab.h * s) / 2 - ab.y * s]);
  return engine.addNodes('AI Vector from Text', [fitted])[0] ?? null;
}

export const RECOLOR_SAMPLES = ['Sunset over the ocean', 'Autumn forest', 'Neon city at night', 'Pastel spring garden'];

export function parsePalettes(text: string, count: number): Color[][] {
  const lists: string[][] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) { if (v.length && v.every((x) => typeof x === 'string')) lists.push(v as string[]); else v.forEach(walk); }
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  const a = text.search(/[[{]/), z = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
  try { walk(JSON.parse(text.slice(a, z + 1))); } catch { lists.length = 0; }
  if (!lists.length) for (const line of text.split('\n')) { const m = line.match(/#[0-9a-f]{6}\b/gi); if (m && m.length >= 2) lists.push(m); }
  return lists.map((l) => l.map((s) => parseColor(s.trim())).filter((c): c is Color => !!c).slice(0, 8)).filter((p) => p.length >= 2).slice(0, count);
}

export async function generativePalettes(prompt: string, count: number): Promise<Color[][]> {
  if (!prompt.trim()) throw new Error('Describe the mood or scene first, such as sunset over the ocean.');
  const n = Math.max(1, Math.min(4, Math.round(count)));
  const system = 'You are a colour palette designer. Answer with JSON only: {"palettes":[["#rrggbb","#rrggbb"]]}. No prose, no code fences.';
  const res = await api.llmGenerate(system, `Make ${n} distinct palettes of 5 to 7 hex colours that capture: ${prompt.trim()}.\nEach palette mixes dark, mid and light colours so artwork keeps its contrast. Reply with the JSON object, ${n} palettes.`, { temperature: 0.9, maxTokens: 1200 });
  const out = parsePalettes(res.text, n);
  if (!out.length) throw new Error('The model did not answer with colour palettes.');
  return out;
}

export function recolorWithPalette(doc: Doc, ids: string[], nodes: VNode[], palette: Color[]): Doc {
  const rows = fitRowsToPalette(collectColors(nodes).map((c) => ({ from: [c], to: c, on: true })), palette);
  return recolorDoc(doc, ids, rowsFn(rows, true));
}
