import { geomBounds } from '../engine/bounds';
import { effectDefaults } from '../engine/effects';
import { collectColors, fitRowsToPalette, mapNodeColors, nearestFn, oklab, reduceRows, rowsFn, samplePalette } from '../engine/ops/recolor';
import { hex, parseColor } from '../engine/paint';
import type { Color, Doc, Effect, ImageNode, Project, Rect, VNode } from '../engine';
import { renderRegion } from './raster';

export const MAX_PALETTE = 8;
const MAX_COLORS = 12;

export interface Limits { maxShapes: number; gradients: number; strokes: 'none' | 'few' | 'any' | 'only'; compound: boolean }

const SHAPES = [8, 12, 18, 26, 38, 54, 78, 110, 160, 230];
const GRADIENTS = [0, 0, 1, 2, 4, 8, 14, 24, 40, 80];

export interface GenStyle { id: string; label: string; text: string }
export const GEN_STYLES: ReadonlyArray<GenStyle> = [
  { id: 'auto', label: 'No preset', text: '' },
  { id: 'flat', label: 'Flat', text: 'flat vector style: solid fills only, no gradients, no outlines, crisp geometric shapes with clean edges' },
  { id: 'line_art', label: 'Line Art', text: 'line art: every shape is fill="none" with a stroke, one consistent stroke width between 3 and 6, stroke-linecap="round" and stroke-linejoin="round", no filled areas' },
  { id: 'isometric', label: 'Isometric', text: 'isometric projection at 30 degrees: each form is built from three flat faces (light top, mid left, dark right) with parallel edges, no perspective, no gradients' },
  { id: 'hand_drawn', label: 'Hand drawn', text: 'hand drawn look: slightly wobbly irregular outlines, loose organic shapes, stroke widths that vary between 2 and 8, stroke-linecap="round" and stroke-linejoin="round", nothing perfectly geometric' },
  { id: 'gradient', label: 'Gradient', text: 'gradient style: smooth linear and radial gradients on most large shapes, soft light to dark transitions, glowing depth' },
  { id: 'retro', label: 'Retro', text: 'retro vintage poster style: four or five faded warm colours, chunky simple geometry, thick outlines, flat fills, no gradients' },
  { id: 'minimal', label: 'Minimal', text: 'minimal style: very few shapes, generous empty space, one accent colour on a neutral base, no gradients' },
];
export const STYLE_IDS = GEN_STYLES.map((s) => s.id).filter((id) => id !== 'auto');

export function detailLimits(level: number, style = 'auto'): Limits {
  const i = Math.max(1, Math.min(10, Math.round(Number.isFinite(level) ? level : 5))) - 1;
  const lim: Limits = { maxShapes: SHAPES[i], gradients: GRADIENTS[i], strokes: i < 2 ? 'none' : i < 5 ? 'few' : 'any', compound: i >= 3 };
  if (style === 'flat' || style === 'isometric' || style === 'retro') { lim.gradients = 0; if (style !== 'retro' && style !== 'isometric') lim.strokes = 'none'; }
  if (style === 'line_art') { lim.gradients = 0; lim.strokes = 'only'; }
  if (style === 'hand_drawn' && i >= 2) lim.strokes = 'any';
  if (style === 'gradient') lim.gradients = Math.max(lim.gradients, 2);
  if (style === 'minimal') { lim.maxShapes = Math.max(4, Math.ceil(lim.maxShapes / 2)); lim.gradients = 0; if (lim.strokes === 'any') lim.strokes = 'few'; }
  return lim;
}

export function detailLevel(raw: unknown, fallback = 5): number {
  if (typeof raw === 'string') {
    const k = raw.trim().toLowerCase();
    if (k === 'low') return 3;
    if (k === 'medium') return 5;
    if (k === 'high') return 8;
    const n = Number(k);
    if (Number.isFinite(n) && k) return Math.max(1, Math.min(10, Math.round(n)));
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(1, Math.min(10, Math.round(raw)));
  return fallback;
}

export function detailText(level: number, lim: Limits, scope = 'in total'): string {
  const n = Math.max(1, Math.min(10, Math.round(level)));
  const lo = Math.max(3, Math.round(lim.maxShapes * 0.6));
  const grad = lim.gradients === 0 ? 'no gradients: solid fills only' : `at most ${lim.gradients} gradient${lim.gradients === 1 ? '' : 's'} (linearGradient or radialGradient in defs, two or more stops with offsets from 0 to 1)`;
  const stroke = lim.strokes === 'none' ? 'no strokes' : lim.strokes === 'only' ? 'strokes only, no filled areas' : lim.strokes === 'few' ? 'strokes only on a few key outlines, widths 2 to 6' : 'strokes freely, with stroke-linecap and stroke-linejoin set';
  const comp = lim.compound ? 'use one path with several subpaths and fill-rule="evenodd" for holes' : 'no compound paths: every shape is one simple closed path';
  return `Detail ${n} of 10 (1 is minimal, 10 is richly detailed): about ${lo} to ${lim.maxShapes} drawn elements ${scope} and never more than ${lim.maxShapes}; ${grad}; ${stroke}; ${comp}.`;
}

export interface GenEffect { id: string; label: string; fx: string; params: Record<string, number | string | boolean>; tint: 'light' | 'dark' | null }
export const GEN_EFFECTS: ReadonlyArray<GenEffect> = [
  { id: 'halftone', label: 'Halftone', fx: 'gallery.color_halftone', params: { radius: 5 }, tint: null },
  { id: 'grain', label: 'Grain', fx: 'gallery.grain', params: { intensity: 35, contrast: 50 }, tint: null },
  { id: 'glow', label: 'Glow', fx: 'stylize.outer_glow', params: { blur: 8, opacity: 70 }, tint: 'light' },
  { id: 'shadow', label: 'Shadow', fx: 'stylize.drop_shadow', params: { x: 6, y: 6, blur: 6, opacity: 55 }, tint: 'dark' },
];
export const EFFECT_NAMES = GEN_EFFECTS.map((e) => e.id);

export interface GenTone { id: string; label: string; colors: string[]; text: string }
export const GEN_TONES: ReadonlyArray<GenTone> = [
  { id: 'auto', label: 'Model choice', colors: [], text: '' },
  { id: 'pastel', label: 'Pastel', colors: ['#f7c6d0', '#fbe3c4', '#fdf5c2', '#c9ecd3', '#c7def5', '#ddd1f2', '#ffffff', '#8d99ae'], text: 'soft pastel tones: low saturation, high lightness, gentle contrast' },
  { id: 'vibrant', label: 'Vibrant', colors: ['#ff2e63', '#ff9f1c', '#ffd60a', '#06d6a0', '#118ab2', '#7b2cbf', '#111111', '#ffffff'], text: 'vibrant saturated colours with strong contrast' },
  { id: 'monochrome', label: 'Monochrome', colors: ['#0d1b2a', '#1b263b', '#415a77', '#778da9', '#a9bcd0', '#e0e1dd'], text: 'monochrome: shades and tints of one single hue only' },
  { id: 'black_and_white', label: 'Black and white', colors: ['#000000', '#ffffff'], text: 'black and white only, no greys: use shape and line weight for tone' },
  { id: 'warm', label: 'Warm', colors: ['#7a1f12', '#c2410c', '#ea7a28', '#f2b134', '#f6dfa4', '#fff6e5'], text: 'warm tones: reds, oranges and yellows' },
  { id: 'cool', label: 'Cool', colors: ['#0b2545', '#13315c', '#1f6f8b', '#3fa7b5', '#99d6d9', '#eef7f7'], text: 'cool tones: blues, teals and violets' },
  { id: 'earth', label: 'Earth', colors: ['#3b2f2a', '#6b4f3a', '#a0764f', '#c9a66b', '#7d8a5a', '#e9dfc9'], text: 'earthy natural tones' },
  { id: 'forest', label: 'Forest', colors: ['#14301f', '#245a36', '#3f8a4f', '#8cbf6a', '#d9e8b8', '#f4f1e1'], text: 'forest greens with warm light accents' },
  { id: 'ocean', label: 'Ocean', colors: ['#03256c', '#2541b2', '#1768ac', '#06bee1', '#a7e8f0', '#ffffff'], text: 'ocean blues and aquas' },
];
export const TONE_IDS = GEN_TONES.map((t) => t.id).filter((id) => id !== 'auto');

const toColors = (list: string[]): Color[] => list.map((h) => parseColor(h)).filter((c): c is Color => !!c);

export interface StyleRef {
  name: string; source: 'object' | 'image';
  palette: Color[]; strokeWidths: number[]; corners: 'sharp' | 'rounded' | 'mixed' | 'none';
  gradients: { linear: number; radial: number }; shapes: number; tone: string; summary: string; image: string | null;
}

export interface GenCommon {
  detail?: number; style?: string; reference?: StyleRef | null; effects?: string[]; tone?: string; palette?: Color[];
}

export function resolvePalette(c: GenCommon): Color[] {
  if (c.palette?.length) return c.palette.slice(0, MAX_COLORS);
  const tone = c.tone ?? 'auto';
  if (tone === 'reference') return (c.reference?.palette ?? []).slice(0, MAX_PALETTE);
  const hit = GEN_TONES.find((t) => t.id === tone);
  return hit ? toColors(hit.colors).slice(0, MAX_PALETTE) : [];
}

export interface Constraints { text: string; limits: Limits; palette: Color[]; image: string | null; detail: number; style: string }

function referenceText(r: StyleRef): string {
  const lines = [`Style reference "${r.name}": copy its look (colours, line quality, corners, level of abstraction), never its subject or layout.`];
  if (r.palette.length) lines.push(`- Reference colours: ${r.palette.map((c) => hex(c)).join(', ')}.`);
  if (r.source === 'object') {
    lines.push(r.strokeWidths.length ? `- Reference stroke widths: ${r.strokeWidths.join(', ')} (measured on a 1000 unit canvas; scale them to the canvas you draw on).` : '- Reference has no strokes: draw with fills.');
    if (r.corners !== 'none') lines.push(`- Reference corners: ${r.corners}.`);
    lines.push(r.gradients.linear + r.gradients.radial ? `- Reference gradients: ${r.gradients.linear} linear, ${r.gradients.radial} radial.` : '- Reference gradients: none, use solid fills.');
  }
  if (r.tone) lines.push(`- Reference tone: ${r.tone}.`);
  if (r.source === 'object' && r.summary) lines.push(`- Reference structure (reduced SVG, coordinates 0 to 100):\n${r.summary}`);
  if (r.image) lines.push('- The attached image shows the reference.');
  return lines.join('\n');
}

export function constraints(c: GenCommon, defaultDetail = 5, shapeScale = 1, scope = 'in total'): Constraints {
  const detail = Math.max(1, Math.min(10, Math.round(c.detail ?? defaultDetail))), style = c.style ?? 'auto';
  const limits = detailLimits(detail, style), palette = resolvePalette(c);
  limits.maxShapes = Math.round(limits.maxShapes * shapeScale);
  const parts = [detailText(detail, limits, scope)];
  const st = GEN_STYLES.find((s) => s.id === style);
  if (st?.text) parts.push(`Style ${st.label}: ${st.text}.`);
  if (c.reference) parts.push(referenceText(c.reference));
  if (palette.length) {
    const tone = GEN_TONES.find((t) => t.id === c.tone);
    parts.push(`Use only these colours, for fills, strokes and gradient stops: ${palette.map((p) => hex(p)).join(', ')}.${tone?.text ? ` Mood: ${tone.text}.` : ''}`);
  } else if (c.reference?.palette.length && !st?.text) parts.push('Choose colours close to the reference colours.');
  return { text: parts.join('\n'), limits, palette, image: c.reference?.image ?? null, detail, style };
}

export function enforcePalette(art: VNode, palette: Color[]): VNode {
  if (!palette.length) return art;
  const colors = collectColors([art]);
  if (!colors.length) return art;
  const pal = palette.slice(0, MAX_COLORS), near = nearestFn(pal), keep = new Map<string, Color>(), far: Color[] = [];
  for (const c of colors) {
    const n = near(c), a = oklab(c), b = oklab(n);
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= 0.08) keep.set(hex(c), n); else far.push(c);
  }
  const farRows = far.length ? fitRowsToPalette(far.length > pal.length ? reduceRows(far, pal.length) : far.map((c) => ({ from: [c], to: c, on: true })), pal) : [];
  const farFn = rowsFn(farRows, false);
  return mapNodeColors(art, (c) => keep.get(hex(c)) ?? near(farFn(c)));
}

export function applyEffects(art: VNode, ids: string[], palette: Color[]): VNode {
  const picked = GEN_EFFECTS.filter((e) => ids.includes(e.id));
  if (!picked.length) return art;
  const byL = [...palette].sort((a, b) => oklab(a)[0] - oklab(b)[0]);
  const fx: Effect[] = picked.map((e) => {
    const params: Effect['params'] = { ...effectDefaults(e.fx), ...e.params };
    const tint = e.tint === 'light' ? byL[byL.length - 1] : e.tint === 'dark' ? byL[0] : null;
    if (tint) params.color = hex(tint);
    return { id: e.fx, params, visible: true };
  });
  return { ...art, ap: { ...art.ap, effects: [...art.ap.effects, ...fx] } };
}

const toneWord = (l: number): string => (l < 0.33 ? 'dark' : l > 0.67 ? 'light' : 'mid');

function leaves(nodes: VNode[], out: VNode[] = []): VNode[] {
  for (const n of nodes) {
    if (n.hidden) continue;
    if (n.kind === 'group' || n.kind === 'layer') leaves(n.children, out);
    else if (n.kind === 'compound') out.push(n);
    else out.push(n);
  }
  return out;
}

function paintText(p: { type: string } & Record<string, unknown>): string {
  if (p.type === 'color') return hex((p as unknown as { color: Color }).color);
  if (p.type === 'gradient') {
    const g = (p as unknown as { gradient: { kind: string; stops: Array<{ color: Color }> } }).gradient;
    return `${g.kind}-gradient(${g.stops.map((s) => hex(s.color)).join('>')})`;
  }
  return p.type === 'pattern' ? 'pattern' : 'none';
}

function summarize(doc: Doc, nodes: VNode[], box: Rect): string {
  const k = 100 / Math.max(box.w, box.h, 1), lines: string[] = [];
  let count = 0;
  const q = (v: number): number => Math.round(v);
  const attrs = (n: VNode, b: Rect): string => {
    const a = [`x="${q((b.x - box.x) * k)}" y="${q((b.y - box.y) * k)}" w="${q(b.w * k)}" h="${q(b.h * k)}"`];
    const fill = n.ap.items.find((i) => i.kind === 'fill' && i.visible), stroke = n.ap.items.find((i) => i.kind === 'stroke' && i.visible);
    a.push(`fill="${fill ? paintText(fill.paint) : 'none'}"`);
    if (stroke && stroke.kind === 'stroke') a.push(`stroke="${paintText(stroke.paint)}" stroke-width="${Math.round(stroke.width * k * 10) / 10}"${stroke.cap === 'round' ? ' linecap="round"' : ''}${stroke.join === 'round' ? ' linejoin="round"' : ''}`);
    if (n.opacity < 1) a.push(`opacity="${Math.round(n.opacity * 100) / 100}"`);
    if (n.blend !== 'normal') a.push(`blend="${n.blend}"`);
    return a.join(' ');
  };
  const walk = (list: VNode[], depth: number): void => {
    for (const n of list) {
      if (n.hidden) continue;
      if (count >= 30) { if (count === 30) { lines.push(`${'  '.repeat(depth)}<!-- more elements -->`); count++; } return; }
      const pad = '  '.repeat(depth);
      if (n.kind === 'group' || n.kind === 'layer') {
        count++;
        const nm = n.name ? ` name="${n.name.replace(/[<>"&]/g, '').slice(0, 30)}"` : '';
        lines.push(`${pad}<g${nm}${n.clip ? ' clip="true"' : ''}${n.opacity < 1 ? ` opacity="${Math.round(n.opacity * 100) / 100}"` : ''}>`);
        if (depth < 3) walk(n.children, depth + 1); else lines.push(`${pad}  <!-- ${leaves(n.children).length} nested -->`);
        lines.push(`${pad}</g>`);
        continue;
      }
      count++;
      const b = geomBounds(doc, n);
      if (n.kind === 'path') {
        const live = n.live;
        if (live?.kind === 'rect') lines.push(`${pad}<rect ${attrs(n, b)}${live.radii.some((r) => r > 0) ? ` r="${q(Math.max(...live.radii) * k)}"` : ''}/>`);
        else if (live?.kind === 'ellipse') lines.push(`${pad}<ellipse ${attrs(n, b)}/>`);
        else {
          const pts = n.d.reduce((s, sp) => s + sp.pts.length, 0), curved = n.d.some((sp) => sp.pts.some((a) => a.ix !== a.x || a.iy !== a.y || a.ox !== a.x || a.oy !== a.y));
          lines.push(`${pad}<path ${attrs(n, b)} points="${pts}" subpaths="${n.d.length}" curves="${curved ? 'yes' : 'no'}"${n.rule === 'evenodd' ? ' fill-rule="evenodd"' : ''}/>`);
        }
      } else if (n.kind === 'compound') lines.push(`${pad}<path ${attrs(n, b)} subpaths="${n.children.length}" fill-rule="${n.rule}"/>`);
      else lines.push(`${pad}<${n.kind} ${attrs(n, b)}/>`);
    }
  };
  walk(nodes, 0);
  let s = lines.join('\n');
  if (s.length > 2200) s = `${s.slice(0, 2200).replace(/\n[^\n]*$/, '')}\n<!-- truncated -->`;
  return s;
}

function analyse(doc: Doc, nodes: VNode[]): Pick<StyleRef, 'palette' | 'strokeWidths' | 'corners' | 'gradients' | 'shapes' | 'tone'> {
  const flat = leaves(nodes);
  const widths = new Map<number, number>();
  const grads = { linear: 0, radial: 0 };
  let anchors = 0, curved = 0, round = false;
  for (const n of flat) {
    for (const i of n.ap.items) {
      if (!i.visible) continue;
      if (i.kind === 'stroke') { const w = Math.round(i.width * 2) / 2; if (w > 0 && i.paint.type !== 'none') widths.set(w, (widths.get(w) ?? 0) + 1); if (i.join === 'round' || i.cap === 'round') round = true; }
      if (i.paint.type === 'gradient') { if (i.paint.gradient.kind === 'radial') grads.radial++; else grads.linear++; }
    }
    const paths = n.kind === 'path' ? [n] : n.kind === 'compound' ? n.children : [];
    for (const p of paths) {
      if (p.live?.kind === 'rect' && p.live.radii.some((r) => r > 0)) { anchors += 4; curved += 4; continue; }
      if (p.live?.kind === 'ellipse') { anchors += 4; curved += 4; continue; }
      for (const sp of p.d) for (const a of sp.pts) { anchors++; if (a.ix !== a.x || a.iy !== a.y || a.ox !== a.x || a.oy !== a.y) curved++; }
    }
  }
  const colors = collectColors(nodes), palette = colors.length > MAX_PALETTE ? reduceRows(colors, MAX_PALETTE).map((r) => r.to) : colors;
  const ratio = anchors ? curved / anchors : 0;
  const corners: StyleRef['corners'] = !anchors ? 'none' : ratio > 0.6 ? 'rounded' : ratio < 0.15 && !round ? 'sharp' : 'mixed';
  const ls = palette.map((c) => oklab(c)[0]), mean = ls.length ? ls.reduce((a, b) => a + b, 0) / ls.length : 0.5;
  const spread = ls.length ? Math.max(...ls) - Math.min(...ls) : 0;
  const tone = ls.length ? `${toneWord(mean)} overall, ${spread > 0.55 ? 'high' : spread > 0.25 ? 'medium' : 'low'} contrast` : '';
  void doc;
  return { palette, strokeWidths: [...widths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map((e) => e[0]).sort((a, b) => a - b), corners, gradients: grads, shapes: flat.length, tone };
}

export function styleFromNodes(doc: Doc, nodes: VNode[]): StyleRef | null {
  const list = nodes.filter((n) => n.kind !== 'layer' && !n.hidden);
  if (!list.length) return null;
  let box: Rect | null = null;
  for (const n of list) { const b = geomBounds(doc, n); if (b.w > 0 || b.h > 0) box = box ? { x: Math.min(box.x, b.x), y: Math.min(box.y, b.y), w: Math.max(box.x + box.w, b.x + b.w) - Math.min(box.x, b.x), h: Math.max(box.y + box.h, b.y + b.h) - Math.min(box.y, b.y) } : b; }
  if (!box) return null;
  const a = analyse(doc, list), k = 1000 / Math.max(box.w, box.h, 1);
  a.strokeWidths = a.strokeWidths.map((w) => Math.max(1, Math.round(w * k)));
  const first = list[0];
  return { name: list.length === 1 ? first.name ?? first.kind : `${list.length} objects`, source: 'object', ...a, summary: summarize(doc, list, box), image: null };
}

export async function styleFromImage(p: Project, n: ImageNode, vision: boolean): Promise<StyleRef> {
  const b = geomBounds(p.doc, n);
  if (!(b.w > 0 && b.h > 0)) throw new Error('The reference image has no size.');
  const c = await renderRegion(p, { region: b, scale: 256 / Math.max(b.w, b.h), transparent: true, only: [n] });
  const g = c.getContext('2d');
  if (!g) throw new Error('This browser could not read the reference image.');
  const px = g.getImageData(0, 0, c.width, c.height).data;
  const palette = samplePalette(px, 6);
  const hist = [0, 0, 0];
  let total = 0, sat = 0, warm = 0, sum = 0, sq = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const r = px[i] / 255, gg = px[i + 1] / 255, bb = px[i + 2] / 255, l = 0.2126 * r + 0.7152 * gg + 0.0722 * bb, mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
    hist[l < 0.33 ? 0 : l > 0.67 ? 2 : 1]++; total++; sat += mx > 0 ? (mx - mn) / mx : 0; warm += r - bb; sum += l; sq += l * l;
  }
  if (!total) throw new Error('The reference image is empty.');
  const mean = sum / total, sd = Math.sqrt(Math.max(0, sq / total - mean * mean)), pc = (v: number): number => Math.round((v / total) * 100);
  const tone = `${pc(hist[0])}% dark, ${pc(hist[1])}% mid, ${pc(hist[2])}% light pixels; ${toneWord(mean)} overall; ${sd > 0.3 ? 'high' : sd > 0.15 ? 'medium' : 'low'} contrast; ${sat / total > 0.5 ? 'saturated' : sat / total > 0.2 ? 'moderately saturated' : 'muted'}; ${warm / total > 0.08 ? 'warm' : warm / total < -0.08 ? 'cool' : 'neutral'} cast`;
  return {
    name: n.name ?? 'Image', source: 'image', palette, strokeWidths: [], corners: 'none', gradients: { linear: 0, radial: 0 }, shapes: 0, tone,
    summary: `<image width="${Math.round(b.w)}" height="${Math.round(b.h)}"/>`, image: vision ? c.toDataURL('image/png') : null,
  };
}

export async function styleReference(p: Project, nodes: VNode[], vision: boolean): Promise<StyleRef> {
  const img = nodes.length === 1 && nodes[0].kind === 'image' ? nodes[0] : null;
  if (img) return styleFromImage(p, img, vision);
  const r = styleFromNodes(p.doc, nodes);
  if (!r) throw new Error('The style reference has nothing to read: pick painted objects or a placed image.');
  return r;
}

export function describeRef(r: StyleRef): string {
  const bits = [`${r.name}`, `${r.palette.length} colour${r.palette.length === 1 ? '' : 's'}`];
  if (r.source === 'object') { bits.push(r.strokeWidths.length ? `strokes ${r.strokeWidths.join('/')}` : 'no strokes'); bits.push(`${r.corners} corners`); const g = r.gradients.linear + r.gradients.radial; bits.push(g ? `${g} gradient${g === 1 ? '' : 's'}` : 'no gradients'); }
  else bits.push(r.image ? 'sent to the model as an image' : 'tones read from its pixels');
  return bits.join(', ');
}
