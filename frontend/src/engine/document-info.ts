import { allNodes } from './doc';
import type { Doc, ImageNode, NodeKind, Paint, VNode } from './types';

export interface DocInfoImage { id: string; name: string; embedded: boolean; path: string | null; pxW: number; pxH: number; placedW: number; placedH: number; ppi: number }
export interface DocInfoFont { font: string; style: string; chars: number; embedded: boolean }
export interface DocInfoSwatch { name: string; spot: boolean; global: boolean; uses: number }
export interface DocumentInfo {
  title: string;
  units: Doc['units'];
  colorMode: 'RGB' | 'CMYK';
  artboards: Array<{ name: string; w: number; h: number; x: number; y: number }>;
  bleed: { t: number; b: number; l: number; r: number } | null;
  objects: { total: number; byKind: Partial<Record<NodeKind, number>> };
  paths: { count: number; anchors: number };
  fonts: DocInfoFont[];
  images: DocInfoImage[];
  swatches: DocInfoSwatch[];
  spotColors: string[];
  gradients: { defined: number; used: number };
  patterns: { defined: number; used: number; names: string[] };
  symbols: { defined: number; used: number; names: string[] };
  brushes: { defined: number; used: number; names: string[] };
  graphicStyles: { defined: number; used: number; names: string[] };
  overprint: number;
}

const BUNDLED_FONTS = ['Inter', 'JetBrains Mono'];

export function documentInfo(doc: Doc, opts: { embeddedFonts?: string[] } = {}): DocumentInfo {
  const nodes = allNodes(doc), byKind: Partial<Record<NodeKind, number>> = {};
  const embedded = new Set(opts.embeddedFonts ?? BUNDLED_FONTS);
  let anchors = 0, paths = 0, overprint = 0, gradUsed = 0;
  const swUse = new Map<string, number>(), patUse = new Set<string>(), symUse = new Set<string>(), brushUse = new Set<string>(), styleUse = new Set<string>();
  const fonts = new Map<string, DocInfoFont>(), images: DocInfoImage[] = [];
  const tally = (p: Paint): void => {
    if (p.type === 'color' && p.swatch) swUse.set(p.swatch, (swUse.get(p.swatch) ?? 0) + 1);
    else if (p.type === 'gradient') { gradUsed++; if (p.swatch) swUse.set(p.swatch, (swUse.get(p.swatch) ?? 0) + 1); }
    else if (p.type === 'pattern') patUse.add(p.pattern);
  };
  const countPath = (n: VNode): void => { if (n.kind === 'path') { paths++; for (const sp of n.d) anchors += sp.pts.length; } };
  for (const n of nodes) {
    byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
    countPath(n);
    if (n.style) styleUse.add(n.style);
    for (const it of n.ap.items) {
      tally(it.paint);
      if (it.overprint) overprint++;
      if (it.kind === 'stroke' && it.brush) brushUse.add(it.brush);
    }
    if (n.kind === 'symbol') symUse.add(n.symbol);
    if (n.kind === 'text') {
      for (const s of n.spans) {
        const k = `${s.style.font}\u0000${s.style.style}`;
        const u = fonts.get(k) ?? { font: s.style.font, style: s.style.style, chars: 0, embedded: embedded.has(s.style.font) };
        u.chars += s.text.length; fonts.set(k, u);
        tally(s.style.fill);
      }
    }
    if (n.kind === 'image') images.push(imageInfo(n));
  }
  const names = <T extends { id: string; name: string }>(list: T[], used: Set<string>): string[] => list.filter((x) => used.has(x.id)).map((x) => x.name);
  const swatches = doc.swatches.filter((s) => swUse.has(s.id)).map((s) => ({ name: s.name, spot: s.spot, global: s.global, uses: swUse.get(s.id) ?? 0 }));
  const total = nodes.filter((n) => n.kind !== 'layer').length;
  return {
    title: doc.title, units: doc.units, colorMode: doc.colorMode === 'cmyk' ? 'CMYK' : 'RGB',
    artboards: doc.artboards.map((a) => ({ name: a.name, w: a.w, h: a.h, x: a.x, y: a.y })),
    bleed: doc.bleed ?? null,
    objects: { total, byKind },
    paths: { count: paths, anchors },
    fonts: [...fonts.values()].sort((a, b) => a.font.localeCompare(b.font) || a.style.localeCompare(b.style)),
    images,
    swatches,
    spotColors: swatches.filter((s) => s.spot).map((s) => s.name),
    gradients: { defined: doc.swatches.filter((s) => s.paint.type === 'gradient').length, used: gradUsed },
    patterns: { defined: doc.patterns.length, used: patUse.size, names: names(doc.patterns, patUse) },
    symbols: { defined: doc.symbols.length, used: symUse.size, names: names(doc.symbols, symUse) },
    brushes: { defined: doc.brushes.length, used: brushUse.size, names: names(doc.brushes, brushUse) },
    graphicStyles: { defined: doc.styles.length, used: styleUse.size, names: names(doc.styles, styleUse) },
    overprint,
  };
}

function imageInfo(n: ImageNode): DocInfoImage {
  const sx = Math.hypot(n.xf[0], n.xf[1]) || 1, sy = Math.hypot(n.xf[2], n.xf[3]) || 1;
  return { id: n.id, name: n.linked?.name ?? n.link ?? n.src, embedded: !n.linked, path: n.linked?.path ?? null, pxW: n.w, pxH: n.h, placedW: n.w * sx, placedH: n.h * sy, ppi: Math.round((72 / sx) * 10) / 10 };
}

export function documentInfoText(info: DocumentInfo): string {
  const L: string[] = [];
  const n = (v: number): string => String(Math.round(v * 100) / 100);
  L.push(`Document: ${info.title}`, `Units: ${info.units}   Colour mode: ${info.colorMode}`);
  if (info.bleed) L.push(`Bleed (pt): top ${n(info.bleed.t)}, bottom ${n(info.bleed.b)}, left ${n(info.bleed.l)}, right ${n(info.bleed.r)}`);
  L.push('', `Artboards (${info.artboards.length})`);
  for (const a of info.artboards) L.push(`  ${a.name}: ${n(a.w)} x ${n(a.h)} pt at ${n(a.x)}, ${n(a.y)}`);
  L.push('', `Objects: ${info.objects.total}`);
  for (const [k, v] of Object.entries(info.objects.byKind)) if (k !== 'layer') L.push(`  ${k}: ${v}`);
  L.push(`Paths: ${info.paths.count}   Anchor points: ${info.paths.anchors}`);
  L.push('', `Fonts (${info.fonts.length})`);
  for (const f of info.fonts) L.push(`  ${f.font} ${f.style}: ${f.chars} characters${f.embedded ? ' (embedded)' : ' (not embedded)'}`);
  L.push('', `Images (${info.images.length})`);
  for (const i of info.images) L.push(`  ${i.name}: ${i.pxW} x ${i.pxH} px, ${n(i.placedW)} x ${n(i.placedH)} pt placed, ${i.ppi} ppi, ${i.embedded ? 'embedded' : `linked ${i.path ?? ''}`}`);
  L.push('', `Swatches used (${info.swatches.length})`);
  for (const s of info.swatches) L.push(`  ${s.name}${s.spot ? ' (spot)' : ''}${s.global ? ' (global)' : ''}: ${s.uses}`);
  L.push('', `Gradients: ${info.gradients.defined} defined, ${info.gradients.used} used`);
  L.push(`Patterns: ${info.patterns.defined} defined, ${info.patterns.used} used${info.patterns.names.length ? ` (${info.patterns.names.join(', ')})` : ''}`);
  L.push(`Symbols: ${info.symbols.defined} defined, ${info.symbols.used} used${info.symbols.names.length ? ` (${info.symbols.names.join(', ')})` : ''}`);
  L.push(`Brushes: ${info.brushes.defined} defined, ${info.brushes.used} used${info.brushes.names.length ? ` (${info.brushes.names.join(', ')})` : ''}`);
  L.push(`Graphic styles: ${info.graphicStyles.defined} defined, ${info.graphicStyles.used} used${info.graphicStyles.names.length ? ` (${info.graphicStyles.names.join(', ')})` : ''}`);
  L.push(`Overprint items: ${info.overprint}`);
  return L.join('\n') + '\n';
}
