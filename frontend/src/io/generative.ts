import { geomBounds } from '../engine/bounds';
import { newDoc, newId } from '../engine/doc';
import { isEmptyRect, mul, pathBounds, toSvgD, transformPath } from '../engine/geometry';
import { transformNode } from '../engine/transform';
import { mapNodeColors, nearestFn } from '../engine/ops/recolor';
import { hex, parseColor, rgb } from '../engine/paint';
import type { Color, Doc, FillRule, Mat, PathData, Rect, VNode } from '../engine';
import { api } from './api';
import { importSvg } from './svg';

export interface ModelState { ready: boolean; vision: boolean; model: string; message: string }
export const NO_MODEL = 'No language model is set. Generative features use the model you choose for the Assistant: set it in Preferences > Plugins (Ollama, LM Studio or any OpenAI-compatible service).';

export async function modelState(): Promise<ModelState> {
  const s = await api.llmStatus();
  if (!s) return { ready: false, vision: false, model: '', message: 'The formpth engine is offline. Start it with ./formpth boot; generative features run through it.' };
  if (!s.configured) return { ready: false, vision: false, model: '', message: NO_MODEL };
  return { ready: true, vision: !!s.vision, model: s.model, message: `Uses ${s.model}${s.vision ? ', which reads images' : ''}.` };
}

const ALLOWED = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'title', 'desc']);
const ATTRS = new Set(['viewbox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'd', 'points', 'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity', 'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'spreadmethod', 'clip-path', 'id', 'style', 'xmlns', 'href', 'xlink:href']);
const MAX_SVG = 600_000, MAX_NODES = 6000;

export function extractSvg(text: string): string | null {
  const a = text.search(/<svg[\s>]/i), z = text.toLowerCase().lastIndexOf('</svg>');
  if (a < 0 || z < a) return null;
  return text.slice(a, z + 6);
}

export function sanitizeSvg(src: string): string {
  if (src.length > MAX_SVG) throw new Error('The model answered with an SVG too large to use.');
  const dom = new DOMParser().parseFromString(src, 'image/svg+xml');
  const root = dom.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || dom.querySelector('parsererror')) throw new Error('The model did not answer with readable SVG.');
  let count = 0;
  const clean = (e: Element): void => {
    for (const c of Array.from(e.children)) {
      if (!ALLOWED.has(c.nodeName.toLowerCase()) || ++count > MAX_NODES) { c.remove(); continue; }
      for (const a of Array.from(c.attributes)) {
        const n = a.name.toLowerCase(), v = a.value;
        if (!ATTRS.has(n)) { c.removeAttribute(a.name); continue; }
        if ((n === 'href' || n === 'xlink:href') && !/^#[\w-]+$/.test(v)) c.removeAttribute(a.name);
        else if (/url\(\s*['"]?(?!#)/i.test(v) || /expression|javascript:|@import/i.test(v)) c.removeAttribute(a.name);
      }
      clean(c);
    }
  };
  for (const a of Array.from(root.attributes)) if (!ATTRS.has(a.name.toLowerCase())) root.removeAttribute(a.name);
  clean(root);
  return new XMLSerializer().serializeToString(root);
}

async function svgNodes(text: string, vw: number, vh: number): Promise<VNode[]> {
  const svg = extractSvg(text);
  if (!svg) throw new Error('The model did not answer with SVG.');
  const dom = new DOMParser().parseFromString(sanitizeSvg(svg), 'image/svg+xml'), root = dom.documentElement;
  root.setAttribute('viewBox', root.getAttribute('viewBox') ?? `0 0 ${vw} ${vh}`);
  root.setAttribute('width', String(vw)); root.setAttribute('height', String(vh));
  const r = await importSvg(new XMLSerializer().serializeToString(root), 'Generated');
  const nodes = r.doc.layers.flatMap((l) => l.children);
  if (!nodes.length) throw new Error('The model answered with an SVG that has no shapes.');
  return nodes;
}

const wrapGroup = (children: VNode[], name: string): VNode => ({ id: newId('g'), kind: 'group', name, clip: false, children, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } });
const moved = (n: VNode, m: Mat): VNode => transformNode(n, m);
const boundsOf = (n: VNode): Rect => { const d: Doc = { ...newDoc(10, 10), layers: [{ ...newDoc(10, 10).layers[0], children: [n] }] }; return geomBounds(d, n); };

export interface ShapeTarget { d: PathData; rule: FillRule; color: Color | null }
export interface ShapeFillOptions { prompt: string; strength: number; detail: number; variations: number }
export interface Variation { art: VNode | null; error: string | null }
const DETAIL = ['', 'low detail: 8 to 25 shapes, bold and simple', 'medium detail: 25 to 70 shapes', 'high detail: 70 to 180 shapes with fine features'];

export async function shapeFillVariations(t: ShapeTarget, o: ShapeFillOptions): Promise<Variation[]> {
  const b = pathBounds(t.d);
  if (isEmptyRect(b) || b.w < 1 || b.h < 1) throw new Error('The shape is too small to fill.');
  const k = 1000 / Math.max(b.w, b.h), W = Math.round(b.w * k), H = Math.round(b.h * k);
  const outline = toSvgD(transformPath(t.d, [k, 0, 0, k, -b.x * k, -b.y * k]), 1);
  const strength = Math.max(0, Math.min(100, o.strength)), detail = Math.max(1, Math.min(3, Math.round(o.detail)));
  const system = 'You draw vector illustrations as SVG. Answer with one complete <svg> element and nothing else: no prose, no code fences. Use only path, rect, circle, ellipse, polygon, polyline, line, g, linearGradient and radialGradient with solid fills. No text, images, filters, scripts, masks, CSS classes or external references.';
  const user = [
    `Make SVG art with viewBox="0 0 ${W} ${H}" that fills this outline: <path d="${outline}"${t.rule === 'evenodd' ? ' fill-rule="evenodd"' : ''}/>.`,
    `Subject: ${o.prompt.trim() || 'an ornamental illustration that suits the outline'}.`,
    `Shape strength ${strength} of 100: ${strength >= 67 ? 'the subject must take the silhouette of the outline and reach every edge of it' : strength >= 34 ? 'arrange the subject to follow the outline loosely and cover it' : 'compose freely; the outline only crops the art, so cover the whole viewBox'}.`,
    `Use ${DETAIL[detail]}.`,
    t.color ? `Work with a palette that suits ${hex(t.color)}.` : 'Choose a harmonious palette.',
    'The art will be clipped to the outline, so let shapes run past its edge rather than leave gaps.',
  ].join('\n');
  const n = Math.max(1, Math.min(3, Math.round(o.variations)));
  const runs = Array.from({ length: n }, async (_, i): Promise<Variation> => {
    try {
      const res = await api.llmGenerate(system, `${user}\nVariation ${i + 1} of ${n}: make it distinct from the others.`, { temperature: 0.6 + i * 0.25, maxTokens: 8000 });
      const nodes = await svgNodes(res.text, W, H);
      let art = wrapGroup(nodes, 'Generated Art');
      art = moved(art, [1 / k, 0, 0, 1 / k, b.x, b.y]);
      if (strength >= 67) {
        const ab = boundsOf(art);
        if (!isEmptyRect(ab) && ab.w > 0.5 && ab.h > 0.5) art = moved(art, mul([b.w / ab.w, 0, 0, b.h / ab.h, b.x, b.y], [1, 0, 0, 1, -ab.x, -ab.y]));
      }
      return { art, error: null };
    } catch (err) { return { art: null, error: err instanceof Error ? err.message : String(err) }; }
  });
  return Promise.all(runs);
}

export function clipToShape(art: VNode, shape: VNode): VNode {
  const kids = art.kind === 'group' && !art.clip ? art.children : [art];
  return { id: newId('g'), kind: 'group', name: 'Generative Shape Fill', clip: true, children: [...kids, shape], opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
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
export interface PatternGenOptions { prompt: string; colors: Color[]; density: number; variations: number; tile?: number }
export interface PatternVariation { art: VNode | null; tile: Rect; error: string | null }

export async function patternVariations(o: PatternGenOptions): Promise<PatternVariation[]> {
  const V = 200, T = Math.max(12, Math.min(720, o.tile ?? 96)), density = Math.max(1, Math.min(5, Math.round(o.density)));
  const colors = o.colors.slice(0, 12).map((c) => hex(c));
  const system = 'You design seamless repeating pattern tiles as SVG. Answer with one complete <svg> element and nothing else: no prose, no code fences. Use only path, rect, circle, ellipse, polygon, polyline, line and g with solid fills and strokes. No text, images, filters, gradients, scripts or external references.';
  const user = [
    `Make one tile of a seamless repeating pattern, viewBox="0 0 ${V} ${V}".`,
    `Theme: ${o.prompt.trim() || 'an elegant decorative motif'}.`,
    `Density: ${DENSITY[density]} per tile.`,
    colors.length ? `Use only these colours: ${colors.join(', ')}. You may put a full-tile background rect in one of them first.` : 'Choose a harmonious palette and a background rect first.',
    'Motifs may cross the tile edges: formpth repeats the tile so anything past an edge shows on the opposite side. Do not draw the wrapped copies yourself.',
  ].join('\n');
  const n = Math.max(1, Math.min(4, Math.round(o.variations)));
  const snap = colors.length ? nearestFn(colors.map((c) => parseColor(c) ?? rgb(0, 0, 0))) : null;
  const tile: Rect = { x: 0, y: 0, w: T, h: T };
  return Promise.all(Array.from({ length: n }, async (_, i): Promise<PatternVariation> => {
    try {
      const res = await api.llmGenerate(system, `${user}\nVariation ${i + 1} of ${n}: make it distinct from the others.`, { temperature: 0.6 + i * 0.2, maxTokens: 8000 });
      let art = wrapGroup(await svgNodes(res.text, V, V), 'Pattern Tile');
      art = moved(art, [T / V, 0, 0, T / V, 0, 0]);
      if (snap) art = mapNodeColors(art, snap);
      return { art, tile, error: null };
    } catch (err) { return { art: null, tile, error: err instanceof Error ? err.message : String(err) }; }
  }));
}
