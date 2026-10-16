import { visualBounds } from '../engine/bounds';
import { colorManaged, cmToRgb } from '../engine/color-management';
import { newId } from '../engine/doc';
import { rectPath, translate, mul } from '../engine/geometry';
import { transformNodes } from '../engine/ops/objects';
import { emptyAppearance } from '../engine/paint';
import { Project } from '../engine/project';
import { BLEND_MODES } from '../engine/types';
import type { BlendMode, Doc, Engine, GroupNode, ImageAsset, ImageLink, ImageNode, PathNode, PatternDef, Pt, VNode } from '../engine';
import { isLegacyAi, readAiLegacy } from './ai-legacy';
import { readAiModern } from './ai-modern';
import { PdfPasswordError, PdfSession, probePdf, readPdfVector, type PdfBox, type PdfPageInfo } from './pdf-read';
import { renderRegion } from './raster';
import { readPsdComposite, readPsdInfo, readPsdLayers, type PsdLayers, type PsdNode } from './psd-read';
import { decodeTiffPage, readTiffInfo, type CmykToRgb } from './tiff-read';

export type CropTo = 'bounding' | 'art' | 'crop' | 'trim' | 'bleed' | 'media';
export type PlaceKind = 'pdf' | 'psd' | 'tiff';
export interface PlaceOptions { mode?: 'embed' | 'link'; page?: number; crop?: CropTo; psd?: 'layers' | 'flatten' }
export interface PlacePage { label: string; w: number; h: number; thumb: () => Promise<Blob | null> }
export interface PlaceSpec { title: string; ok: string; file: string; kind: PlaceKind; pages: PlacePage[]; canLink: boolean; layered: boolean; note: string }
export type PlaceAsk = (spec: PlaceSpec) => Promise<PlaceOptions | null>;
export interface PlaceDeps { ask: PlaceAsk | null; password: (file: string, again: boolean) => Promise<string | null> }
export interface PlaceSource { blob: Blob; name: string; link?: ImageLink }
export interface PlaceResult { id: string | null; notes: string[]; cancelled?: boolean }

export const CROP_CHOICES: ReadonlyArray<readonly [CropTo, string]> = [['bounding', 'Bounding Box'], ['art', 'Art'], ['crop', 'Crop'], ['trim', 'Trim'], ['bleed', 'Bleed'], ['media', 'Media']];
export const PLACE_KINDS = ['.pdf', '.ai', '.psd', '.psb', '.tif', '.tiff'];

export function placeKind(name: string): PlaceKind | null {
  const e = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return e === 'pdf' || e === 'ai' ? 'pdf' : e === 'psd' || e === 'psb' ? 'psd' : e === 'tif' || e === 'tiff' ? 'tiff' : null;
}

const baseName = (n: string): string => n.replace(/\.[^.]+$/, '');
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const cmykFn = (): CmykToRgb | null => (colorManaged() ? (c, m, y, k) => { const v = cmToRgb({ c: c / 2.55, m: m / 2.55, y: y / 2.55, k: k / 2.55 }); return v ? [v.r, v.g, v.b] : null; } : null);

async function pngOf(rgba: Uint8ClampedArray, w: number, h: number): Promise<Blob> {
  const c = new OffscreenCanvas(w, h), g = c.getContext('2d') as OffscreenCanvasRenderingContext2D;
  g.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  return c.convertToBlob({ type: 'image/png' });
}

async function thumbOf(rgba: Uint8ClampedArray, w: number, h: number, side = 200): Promise<Blob> {
  const k = Math.min(1, side / Math.max(w, h)), tw = Math.max(1, Math.round(w * k)), th = Math.max(1, Math.round(h * k));
  const bmp = await createImageBitmap(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, w, h));
  const c = new OffscreenCanvas(tw, th), g = c.getContext('2d') as OffscreenCanvasRenderingContext2D;
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, tw, th);
  bmp.close();
  return c.convertToBlob({ type: 'image/png' });
}

const keyOf = (): string => `img-${newId('').replace(/[^a-z0-9]/gi, '')}.png`;

async function sizeOf(blob: Blob): Promise<{ w: number; h: number }> { const b = await createImageBitmap(blob); const s = { w: b.width, h: b.height }; b.close(); return s; }

interface Art { node: GroupNode; w: number; h: number; assets: Map<string, Blob>; images: Record<string, ImageAsset>; patterns: PatternDef[]; skipped: string[]; fonts: Array<[string, string]>; doc: Doc }

const BARE = { items: [], effects: [] };

async function pdfArt(data: ArrayBuffer, title: string, page: number, crop: CropTo, session: PdfSession, password: string | undefined): Promise<Art> {
  const box: PdfBox = crop === 'bounding' ? 'media' : crop;
  const r = await readPdfVector(data, title, password, { pages: [page], box, session });
  const ab = r.doc.artboards[0];
  const kids: VNode[] = r.doc.layers.flatMap((l) => l.children.map((c) => (l.hidden ? { ...c, hidden: true } : c)));
  let node: GroupNode = { id: newId('g'), kind: 'group', clip: false, children: kids, opacity: 1, blend: 'normal', ap: { ...BARE }, name: title };
  const withNode = (g: GroupNode): Doc => ({ ...r.doc, layers: [{ ...r.doc.layers[0], children: [g] }] });
  let w = ab?.w ?? 0, h = ab?.h ?? 0, ox = 0, oy = 0;
  const content = visualBounds(withNode(node), node);
  const has = Number.isFinite(content.w) && content.w > 0 && content.h > 0;
  if (crop === 'bounding') {
    if (has) { ox = content.x; oy = content.y; w = content.w; h = content.h; }
  } else {
    const clip: PathNode = { id: newId('p'), kind: 'path', d: rectPath(0, 0, w, h), rule: 'nonzero', opacity: 1, blend: 'normal', ap: { ...BARE } };
    node = { ...node, children: [{ id: newId('g'), kind: 'group', clip: true, children: [node.children.length === 1 ? node.children[0] : { id: newId('g'), kind: 'group', clip: false, children: node.children, opacity: 1, blend: 'normal', ap: { ...BARE } }, clip], opacity: 1, blend: 'normal', ap: { ...BARE } }] };
  }
  if (w <= 0 || h <= 0) throw new Error('that page has nothing to place');
  const moved = ox || oy ? (transformNodes(withNode(node), [node.id], translate(-ox, -oy)).doc.layers[0].children[0] as GroupNode) : node;
  return { node: moved, w, h, assets: r.assets, images: r.doc.images, patterns: r.doc.patterns, skipped: r.skipped, fonts: r.fonts, doc: withNode(moved) };
}

async function renderArt(art: Art, scale: number, paper = false): Promise<Blob> {
  const proj = new Project(newId('d'), art.doc, 'place');
  for (const [k, b] of art.assets) proj.assets.set(k, b);
  const c = await renderRegion(proj, { region: { x: 0, y: 0, w: art.w, h: art.h }, scale, transparent: !paper, only: [art.node] });
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
  if (!blob) throw new Error('could not draw the page');
  for (const b of proj.bitmaps.values()) (b as ImageBitmap).close?.();
  return blob;
}

export const linkScale = (w: number, h: number): number => Math.min(8192 / Math.max(w, h, 1), clamp(2048 / Math.max(w, h, 1), 4, 16));

async function tiffFlat(data: ArrayBuffer, page: number, cmyk: CmykToRgb | null): Promise<{ png: Blob; w: number; h: number; ppiX: number | null; ppiY: number | null; alpha: boolean; mode: string }> {
  const img = await decodeTiffPage(data, page, cmyk);
  return { png: await pngOf(img.rgba, img.width, img.height), w: img.width, h: img.height, ppiX: img.ppiX, ppiY: img.ppiY, alpha: img.alpha, mode: img.mode };
}

const BLEND_KEYS: Record<string, BlendMode> = { norm: 'normal', pass: 'normal', dark: 'darken', 'mul ': 'multiply', idiv: 'color_burn', dkCl: 'darken', lite: 'lighten', scrn: 'screen', 'div ': 'color_dodge', lgCl: 'lighten', over: 'overlay', sLit: 'soft_light', hLit: 'hard_light', diff: 'difference', smud: 'exclusion', 'hue ': 'hue', 'sat ': 'saturation', colr: 'color', 'lum ': 'luminosity' };
const BLEND_LABEL: Record<string, string> = { diss: 'Dissolve', lbrn: 'Linear Burn', 'lddg': 'Linear Dodge', vLit: 'Vivid Light', lLit: 'Linear Light', pLit: 'Pin Light', hMix: 'Hard Mix', fsub: 'Subtract', fdiv: 'Divide' };

async function composeLayers(nodes: PsdNode[], w: number, h: number): Promise<Uint8ClampedArray> {
  const css = (b: string): GlobalCompositeOperation => BLEND_MODES.find((m) => m.id === (BLEND_KEYS[b] ?? 'normal'))?.css ?? 'source-over';
  const draw = async (g: OffscreenCanvasRenderingContext2D, list: PsdNode[]): Promise<void> => {
    for (const n of list) {
      if (!n.visible) continue;
      g.globalAlpha = n.opacity;
      g.globalCompositeOperation = css(n.blend);
      if (n.kind === 'group') {
        const sub = new OffscreenCanvas(w, h), sg = sub.getContext('2d') as OffscreenCanvasRenderingContext2D;
        await draw(sg, n.children ?? []);
        g.drawImage(sub, 0, 0);
      } else if (n.rgba) {
        const bmp = await createImageBitmap(new ImageData(n.rgba as Uint8ClampedArray<ArrayBuffer>, n.w, n.h));
        g.drawImage(bmp, n.left, n.top);
        bmp.close();
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
  };
  const c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
  await draw(g, nodes);
  return g.getImageData(0, 0, w, h).data;
}

async function psdFlat(data: ArrayBuffer, cmyk: CmykToRgb | null): Promise<{ rgba: Uint8ClampedArray; w: number; h: number; note: string }> {
  const c = await readPsdComposite(data, cmyk);
  if (c) return { rgba: c.rgba, w: c.width, h: c.height, note: '' };
  const l = await readPsdLayers(data, cmyk);
  return { rgba: await composeLayers(l.nodes, l.width, l.height), w: l.width, h: l.height, note: 'The file has no merged image, so the layers were composited.' };
}

interface LayerArt { group: GroupNode; assets: Map<string, Blob>; images: Record<string, ImageAsset>; notes: string[] }

async function psdLayerArt(layers: PsdLayers, name: string, ox: number, oy: number, sx: number, sy: number): Promise<LayerArt> {
  const assets = new Map<string, Blob>(), images: Record<string, ImageAsset> = {}, odd = new Set<string>();
  const build = async (list: PsdNode[]): Promise<VNode[]> => {
    const out: VNode[] = [];
    for (const n of list) {
      if (BLEND_LABEL[n.blend]) odd.add(BLEND_LABEL[n.blend]);
      const blend: BlendMode = BLEND_KEYS[n.blend] ?? 'normal';
      if (n.kind === 'group') {
        const kids = await build(n.children ?? []);
        out.push({ id: newId('g'), kind: 'group', clip: false, children: kids, opacity: n.opacity, blend, ap: { ...BARE }, name: n.name, ...(n.visible ? {} : { hidden: true }) });
        continue;
      }
      const key = keyOf();
      assets.set(key, await pngOf(n.rgba as Uint8ClampedArray, n.w, n.h));
      images[key] = { mime: 'image/png', w: n.w, h: n.h };
      out.push({ id: newId('im'), kind: 'image', src: key, w: n.w, h: n.h, xf: [sx, 0, 0, sy, ox + n.left * sx, oy + n.top * sy], opacity: n.opacity, blend, ap: emptyAppearance(), name: n.name, ...(n.visible ? {} : { hidden: true }) } as ImageNode);
    }
    return out;
  };
  const kids = await build(layers.nodes);
  const notes = [...layers.notes];
  if (odd.size) notes.push(`${[...odd].join(', ')} ${odd.size === 1 ? 'is' : 'are'} not a blend mode formpth has, so ${odd.size === 1 ? 'that layer is' : 'those layers are'} set to Normal`);
  return { group: { id: newId('g'), kind: 'group', clip: false, children: kids, opacity: 1, blend: 'normal', ap: { ...BARE }, name }, assets, images, notes };
}

function linkOfSource(l: ImageLink, extra: Partial<ImageLink>): ImageLink { return { ...l, ...extra }; }

export async function displayBlob(blob: Blob, name: string, link?: ImageLink | null): Promise<Blob> {
  const kind = placeKind(name);
  if (!kind) return blob;
  const data = await blob.arrayBuffer();
  if (kind === 'pdf') {
    const session = new PdfSession(), infos = await probePdf(data, undefined, session), page = clamp((link?.page ?? 1) - 1, 0, infos.length - 1);
    const art = await pdfArt(data, baseName(name), page, (link?.crop as CropTo | undefined) ?? 'bounding', session, undefined);
    return renderArt(art, linkScale(art.w, art.h));
  }
  if (kind === 'tiff') return (await tiffFlat(data, Math.max(0, (link?.page ?? 1) - 1), cmykFn())).png;
  const f = await psdFlat(data, cmykFn());
  return pngOf(f.rgba, f.w, f.h);
}

export async function placeSpecial(engine: Engine, src: PlaceSource, at: Pt | null, width: number | null, given: PlaceOptions | undefined, deps: PlaceDeps, fresh = false): Promise<PlaceResult> {
  const kind = placeKind(src.name) as PlaceKind, name = src.name, title = baseName(name), data = await src.blob.arrayBuffer(), notes: string[] = [];
  const cmyk = fresh ? null : cmykFn();
  const p0 = engine.current;
  const canLink = !!src.link;
  const ensureProject = (wPt: number, hPt: number): NonNullable<typeof p0> => {
    if (fresh) return engine.newDocument(Math.max(1, wPt), Math.max(1, hPt), { title, units: 'pt' });
    if (!p0) throw new Error('open a document first');
    return p0;
  };
  const centre = (p: NonNullable<typeof p0>, w: number, h: number): Pt => {
    if (at) return at;
    if (fresh) return { x: 0, y: 0 };
    const v = p.viewport, c = v.toDoc(v.centerX, v.height / 2);
    return { x: c.x - w / 2, y: c.y - h / 2 };
  };
  const stash = (p: NonNullable<typeof p0>, assets: Map<string, Blob>, images: Record<string, ImageAsset>, patterns: PatternDef[] = []): void => {
    for (const [k, b] of assets) p.assets.set(k, b);
    engine.edit('Place', (d) => ({ ...d, images: { ...d.images, ...images }, patterns: patterns.length ? [...d.patterns, ...patterns] : d.patterns }));
  };

  if (kind === 'pdf') {
    if (/\.ai$/i.test(name) && isLegacyAi(data)) {
      const r = await readAiLegacy(data, title);
      const kids: VNode[] = r.doc.layers.flatMap((l) => l.children);
      if (!kids.length) return { id: null, notes: ['That Illustrator file has no art to place.'] };
      const g: GroupNode = { id: newId('g'), kind: 'group', clip: false, children: kids, opacity: 1, blend: 'normal', ap: { ...BARE }, name };
      const doc: Doc = { ...r.doc, layers: [{ ...r.doc.layers[0], children: [g] }] };
      const b = visualBounds(doc, g), s = width && b.w > 0 ? width / b.w : 1;
      const p = ensureProject(b.w * s, b.h * s), pos = centre(p, b.w * s, b.h * s);
      const moved = transformNodes(doc, [g.id], mul(translate(pos.x, pos.y), [s, 0, 0, s, -b.x * s, -b.y * s])).doc.layers[0].children[0];
      engine.beginStep();
      try { stash(p, r.assets, r.doc.images, r.doc.patterns); const id = engine.addNodes('Place', [moved])[0] ?? null; return { id, notes: ['This is an old Illustrator file, so it was placed as embedded art.'] }; } finally { engine.endStep(); }
    }
    const session = new PdfSession();
    let pw: string | undefined, infos: PdfPageInfo[] | null = null;
    while (!infos) {
      try { infos = await probePdf(data, pw, session); } catch (err) {
        if (!(err instanceof PdfPasswordError)) throw err;
        const next = await deps.password(name, err.wrong);
        if (next === null) return { id: null, notes: [], cancelled: true };
        pw = next;
      }
    }
    const list = infos;
    let o: PlaceOptions;
    if (given) o = { mode: given.mode ?? 'embed', page: clamp(Math.round(given.page ?? 1), 1, list.length), crop: given.crop ?? 'bounding' };
    else if (deps.ask) {
      const pages: PlacePage[] = list.map((i) => {
        const [x0, y0, x1, y1] = i.boxes.crop, side = i.rotate === 90 || i.rotate === 270, w = side ? y1 - y0 : x1 - x0, h = side ? x1 - x0 : y1 - y0;
        return { label: `Page ${i.index + 1}`, w, h, thumb: async () => { const a = await pdfArt(data, title, i.index, 'crop', session, pw); return renderArt(a, Math.min(2, (list.length === 1 ? 480 : 200) / Math.max(a.w, a.h, 1)), true); } };
      });
      const c = await deps.ask({ title: 'Place PDF', ok: 'Place', file: name, kind: 'pdf', pages, canLink, layered: false, note: '' });
      if (!c) return { id: null, notes: [], cancelled: true };
      o = c;
    } else o = { mode: 'embed', page: 1, crop: 'bounding' };
    const pageIx = clamp((o.page ?? 1) - 1, 0, list.length - 1), crop = o.crop ?? 'bounding';
    if (/\.ai$/i.test(name) && !(o.mode === 'link' && canLink)) {
      const mr = await readAiModern(data, title, pw, session);
      if (mr.read) {
        const r = mr.read, ab = r.doc.artboards.length > 1 ? r.doc.artboards[Math.min(pageIx, r.doc.artboards.length - 1)] : null;
        const onBoard = (n: VNode): boolean => { if (!ab) return true; const b = visualBounds(r.doc, n); return b.w >= 0 && b.x < ab.x + ab.w && b.x + b.w > ab.x && b.y < ab.y + ab.h && b.y + b.h > ab.y; };
        const kids: VNode[] = r.doc.layers.map((l) => ({ l, children: l.children.filter(onBoard) })).filter((e) => e.children.length).map(({ l, children }) => ({ id: newId('g'), kind: 'group', clip: false, children, opacity: 1, blend: 'normal', ap: { ...BARE }, name: l.name, ...(l.hidden ? { hidden: true } : {}) }) as GroupNode);
        if (kids.length) {
          const g: GroupNode = { id: newId('g'), kind: 'group', clip: false, children: kids, opacity: 1, blend: 'normal', ap: { ...BARE }, name: title };
          const doc: Doc = { ...r.doc, layers: [{ ...r.doc.layers[0], children: [g] }] };
          const b = visualBounds(doc, g), s = width && b.w > 0 ? width / b.w : 1;
          const p = ensureProject(b.w * s, b.h * s), pos = centre(p, b.w * s, b.h * s);
          const moved = transformNodes(doc, [g.id], mul(translate(pos.x, pos.y), [s, 0, 0, s, -b.x * s, -b.y * s])).doc.layers[0].children[0];
          if (r.skipped.length) notes.push(`Left out: ${r.skipped.slice(0, 4).join(', ')}.`);
          engine.beginStep();
          try { stash(p, r.assets, r.doc.images, r.doc.patterns); const id = engine.addNodes('Place', [moved])[0] ?? null; return { id, notes: ['Placed as editable art from the Illustrator data, one group per layer.', ...notes] }; } finally { engine.endStep(); }
        }
      } else if (mr.why) notes.push(mr.why);
    }
    const art = await pdfArt(data, list.length > 1 ? `${title} (page ${pageIx + 1})` : title, pageIx, crop, session, pw);
    if (art.fonts.length) notes.push(`Fonts not installed, set in their nearest match: ${art.fonts.slice(0, 3).map(([a, b]) => `${a} as ${b}`).join(', ')}${art.fonts.length > 3 ? ` and ${art.fonts.length - 3} more` : ''}.`);
    if (art.skipped.length) notes.push(`Left out: ${art.skipped.slice(0, 4).join(', ')}.`);
    const wantLink = o.mode === 'link';
    if (wantLink && !canLink) notes.push('Linking needs a file on disk, so the page was embedded.');
    if (wantLink && canLink) {
      const scale = linkScale(art.w, art.h), png = await renderArt(art, scale), px = await sizeOf(png), wPt = width ?? art.w, hPt = (wPt * px.h) / px.w;
      const p = ensureProject(wPt, hPt), pos = centre(p, wPt, hPt), key = keyOf();
      engine.beginStep();
      try {
        const id = engine.addImage(key, png, px.w, px.h, pos, wPt, undefined, linkOfSource(src.link as ImageLink, { page: pageIx + 1, crop })) || null;
        return { id, notes: [`Linked page ${pageIx + 1} of ${name} as a picture at ${Math.round(scale * 72)} ppi; it is drawn again when the file changes. Place it embedded to get editable art.`, ...notes] };
      } finally { engine.endStep(); }
    }
    const s = width ? width / art.w : 1, wPt = art.w * s, hPt = art.h * s, p = ensureProject(wPt, hPt), pos = centre(p, wPt, hPt);
    const moved = transformNodes(art.doc, [art.node.id], mul(translate(pos.x, pos.y), [s, 0, 0, s, 0, 0])).doc.layers[0].children[0];
    engine.beginStep();
    try { stash(p, art.assets, art.images, art.patterns); const id = engine.addNodes('Place', [moved])[0] ?? null; return { id, notes }; } finally { engine.endStep(); }
  }

  if (kind === 'tiff') {
    const infos = readTiffInfo(data);
    let o: PlaceOptions;
    if (given) o = { mode: given.mode ?? 'embed', page: clamp(Math.round(given.page ?? 1), 1, infos.length) };
    else if (deps.ask && infos.length > 1) {
      const pages: PlacePage[] = infos.map((i) => ({ label: `Page ${i.index + 1}`, w: i.width, h: i.height, thumb: async () => { const d = await decodeTiffPage(data, i.index, cmyk); return thumbOf(d.rgba, d.width, d.height); } }));
      const c = await deps.ask({ title: fresh ? 'Open TIFF' : 'Place TIFF', ok: fresh ? 'Open' : 'Place', file: name, kind: 'tiff', pages, canLink, layered: false, note: `${infos.length} pages.` });
      if (!c) return { id: null, notes: [], cancelled: true };
      o = c;
    } else o = { mode: canLink ? 'link' : 'embed', page: 1 };
    const pageIx = clamp((o.page ?? 1) - 1, 0, infos.length - 1), f = await tiffFlat(data, pageIx, cmyk);
    if (infos.length > 1) notes.push(`Placed page ${pageIx + 1} of ${infos.length}.`);
    const ppi = f.ppiX ?? 72, wPt = width ?? (f.w * 72) / ppi, hPt = (wPt * f.h) / f.w;
    if (f.ppiX && f.ppiY && Math.abs(f.ppiX - f.ppiY) / f.ppiX > 0.01) notes.push(`The file has different horizontal and vertical resolutions (${Math.round(f.ppiX)} and ${Math.round(f.ppiY)} ppi); the horizontal one sets the size.`);
    const wantLink = o.mode === 'link' && canLink;
    const p = ensureProject(wPt, hPt), pos = centre(p, wPt, hPt), key = keyOf();
    engine.beginStep();
    try {
      const id = engine.addImage(key, f.png, f.w, f.h, pos, wPt, wantLink ? undefined : name, wantLink ? linkOfSource(src.link as ImageLink, { page: pageIx + 1 }) : undefined) || null;
      return { id, notes };
    } finally { engine.endStep(); }
  }

  const info = readPsdInfo(data);
  const layered = info.layers > 0 || info.groups > 0;
  let o: PlaceOptions;
  if (given) o = { mode: given.mode ?? 'embed', psd: given.psd ?? (layered ? 'layers' : 'flatten') };
  else if (deps.ask && (layered || canLink)) {
    const thumb = async (): Promise<Blob | null> => { const f = await psdFlat(data, cmyk); return thumbOf(f.rgba, f.w, f.h, 480); };
    const c = await deps.ask({ title: 'Photoshop Import Options', ok: fresh ? 'Open' : 'Place', file: name, kind: 'psd', pages: [{ label: name, w: info.width, h: info.height, thumb }], canLink, layered, note: `${info.width} by ${info.height} pixels, ${info.mode}, ${info.depth}-bit, ${info.layers} ${info.layers === 1 ? 'layer' : 'layers'}.` });
    if (!c) return { id: null, notes: [], cancelled: true };
    o = c;
  } else o = { mode: canLink ? 'link' : 'embed', psd: layered ? 'layers' : 'flatten' };
  const ppiX = info.ppiX ?? 72, ppiY = info.ppiY ?? ppiX;
  let sx = 72 / ppiX, sy = 72 / ppiY;
  if (width) { const f = width / (info.width * sx); sx *= f; sy *= f; }
  const wPt = info.width * sx, hPt = info.height * sy;
  const wantLink = o.mode === 'link' && canLink;
  if (o.mode === 'link' && !canLink) notes.push('Linking needs a file on disk, so the image was embedded.');
  if (o.psd === 'layers' && !wantLink && layered) {
    const layers = await readPsdLayers(data, cmyk);
    if (layers.skipped.length) notes.push(`Left out: ${layers.skipped.slice(0, 4).join(', ')}${layers.skipped.length > 4 ? ` and ${layers.skipped.length - 4} more` : ''}.`);
    const p = ensureProject(wPt, hPt), pos = centre(p, wPt, hPt), art = await psdLayerArt(layers, name, pos.x, pos.y, sx, sy);
    if (art.notes.length) notes.push(`${art.notes.join('; ')}.`);
    if (!art.group.children.length) return { id: null, notes: [...notes, 'That file has no pixel layers to place.'] };
    engine.beginStep();
    try { stash(p, art.assets, art.images); const id = engine.addNodes('Place', [art.group])[0] ?? null; return { id, notes }; } finally { engine.endStep(); }
  }
  if (o.psd === 'layers' && wantLink) notes.push('A linked Photoshop file is placed flattened.');
  const f = await psdFlat(data, cmyk);
  if (f.note) notes.push(f.note);
  const png = await pngOf(f.rgba, f.w, f.h), p = ensureProject(wPt, hPt), pos = centre(p, wPt, hPt), key = keyOf();
  engine.beginStep();
  try {
    const id = engine.addImage(key, png, f.w, f.h, pos, wPt, wantLink ? undefined : name, wantLink ? linkOfSource(src.link as ImageLink, { layers: 'flatten' }) : undefined) || null;
    return { id, notes };
  } finally { engine.endStep(); }
}
