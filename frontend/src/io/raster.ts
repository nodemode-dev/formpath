import { renderNode, type RenderContext } from '../engine/render';
import { selectionBounds, visualBounds } from '../engine/bounds';
import { childrenOf, findNode, makeLayer, newId } from '../engine/doc';
import { inflate, isEmptyRect } from '../engine/geometry';
import { BLACK, hex, toRgb, WHITE } from '../engine/paint';
import { rayTraced } from '../engine/threed';
import type { Color, Engine, Project, Rect, VNode } from '../engine';
import { exportRegion, exportSvg } from './svg';
import { zipFiles } from './zip';
import { encodeTiff, type TiffCompression } from './tiff';

export type RasterFormat = 'png' | 'jpg' | 'webp' | 'tiff';
export interface TiffChoice { compression: TiffCompression; cmyk: boolean; ppi: number }
export interface DitherOpts {
  model: 'bitmap' | 'grayscale' | 'palette';
  method: 'none' | 'diffusion' | 'bayer';
  fg?: Color;
  bg?: Color;
  levels?: number;
  palette?: Color[];
  threshold?: number;
}
export interface RasterOpts { region: Rect; scale: number; format: RasterFormat; quality: number; transparent: boolean; bg?: Color | null; only?: VNode[]; dither?: DitherOpts; tiff?: Partial<TiffChoice> }

export const RASTER_MAX_SIDE = 16384;
const MAX_SIDE = RASTER_MAX_SIDE;

export function rasterCap(region: Rect, scale: number): { scale: number; width: number; height: number; capped: boolean; message: string } {
  const k = Math.min(scale, MAX_SIDE / Math.max(1, region.w), MAX_SIDE / Math.max(1, region.h));
  const width = Math.max(1, Math.round(region.w * k)), height = Math.max(1, Math.round(region.h * k)), capped = k < scale - 1e-9;
  const message = capped ? `This region would need ${Math.round(region.w * scale).toLocaleString('en-US')} x ${Math.round(region.h * scale).toLocaleString('en-US')} px, more than the ${MAX_SIDE.toLocaleString('en-US')} px per side a browser can draw. It will be exported at ${width.toLocaleString('en-US')} x ${height.toLocaleString('en-US')} px, or choose tiles to keep the full resolution.` : '';
  return { scale: k, width, height, capped, message };
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function ditherCanvas(c: HTMLCanvasElement, o: DitherOpts): void {
  const g = c.getContext('2d');
  if (!g) return;
  const w = c.width, h = c.height, img = g.getImageData(0, 0, w, h), d = img.data;
  const fg = toRgb(o.fg ?? BLACK), bg = toRgb(o.bg ?? WHITE);
  const lum = (i: number): number => (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
  if (o.model === 'palette' && o.palette?.length) {
    const pal = o.palette.map(toRgb), near = (r: number, gg: number, b: number): number => { let best = 0, bd = Infinity; for (let i = 0; i < pal.length; i++) { const e = (pal[i].r - r) ** 2 + (pal[i].g - gg) ** 2 + (pal[i].b - b) ** 2; if (e < bd) { bd = e; best = i; } } return best; };
    const err = o.method === 'diffusion' ? new Float32Array(w * h * 3) : null, spread = 255 / Math.max(2, Math.cbrt(pal.length));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, e = (y * w + x) * 3;
      if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
      let r = d[i], gg = d[i + 1], b = d[i + 2];
      if (err) { r += err[e]; gg += err[e + 1]; b += err[e + 2]; } else if (o.method === 'bayer') { const t = (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5; r += t * spread; gg += t * spread; b += t * spread; }
      const p = pal[near(r, gg, b)];
      d[i] = p.r; d[i + 1] = p.g; d[i + 2] = p.b; d[i + 3] = 255;
      if (err) {
        const er = r - p.r, eg = gg - p.g, eb = b - p.b;
        const push = (dx: number, dy: number, k: number): void => { const nx = x + dx, ny = y + dy; if (nx < 0 || nx >= w || ny >= h) return; const j = (ny * w + nx) * 3; err[j] += er * k; err[j + 1] += eg * k; err[j + 2] += eb * k; };
        push(1, 0, 7 / 16); push(-1, 1, 3 / 16); push(0, 1, 5 / 16); push(1, 1, 1 / 16);
      }
    }
  } else {
    const L = o.model === 'bitmap' ? 2 : Math.max(2, Math.min(256, Math.round(o.levels ?? 4))), th = Math.max(0.01, Math.min(0.99, o.threshold ?? 0.5));
    const err = o.method === 'diffusion' ? new Float32Array(w * h) : null;
    const quant = (v: number): number => (L === 2 ? (v >= th ? 1 : 0) : Math.max(0, Math.min(1, Math.round(v * (L - 1)) / (L - 1))));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
      let v = lum(i);
      if (err) v += err[y * w + x]; else if (o.method === 'bayer') v += ((BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5) / (L - 1);
      const q = quant(v);
      d[i] = Math.round(fg.r + (bg.r - fg.r) * q); d[i + 1] = Math.round(fg.g + (bg.g - fg.g) * q); d[i + 2] = Math.round(fg.b + (bg.b - fg.b) * q); d[i + 3] = 255;
      if (err) {
        const e = v - q;
        if (x + 1 < w) err[y * w + x + 1] += e * 7 / 16;
        if (y + 1 < h) { if (x > 0) err[(y + 1) * w + x - 1] += e * 3 / 16; err[(y + 1) * w + x] += e * 5 / 16; if (x + 1 < w) err[(y + 1) * w + x + 1] += e / 16; }
      }
    }
  }
  g.putImageData(img, 0, 0);
}

export async function exportRasterTiles(p: Project, o: RasterOpts, tilePx = 8192, maxTiles = 256): Promise<Blob> {
  const step = tilePx / o.scale, cols = Math.max(1, Math.ceil(o.region.w / step - 1e-9)), rows = Math.max(1, Math.ceil(o.region.h / step - 1e-9));
  if (cols * rows > maxTiles) throw new Error(`This export would need ${(cols * rows).toLocaleString('en-US')} tiles, more than the ${maxTiles} allowed. Lower the scale or export a smaller region.`);
  const files: Array<{ name: string; blob: Blob }> = [];
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const region = { x: o.region.x + q * step, y: o.region.y + r * step, w: Math.min(step, o.region.w - q * step), h: Math.min(step, o.region.h - r * step) };
    files.push({ name: `tile-r${r + 1}-c${q + 1}.${o.format}`, blob: await exportRaster(p, { ...o, region }) });
  }
  return zipFiles(files);
}

export async function ensureBitmaps(p: Project): Promise<void> {
  for (const [key, blob] of p.assets) {
    if (p.bitmaps.has(key)) continue;
    try { p.bitmaps.set(key, await createImageBitmap(blob)); } catch { }
  }
}

export async function renderRegion(p: Project, o: Omit<RasterOpts, 'format' | 'quality'>): Promise<HTMLCanvasElement> {
  await ensureBitmaps(p);
  await document.fonts.ready.catch(() => undefined);
  const k = rasterCap(o.region, o.scale).scale;
  const w = Math.max(1, Math.round(o.region.w * k)), h = Math.max(1, Math.round(o.region.h * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('This browser could not make a drawing surface for the export.');
  if (!o.transparent) { g.fillStyle = o.bg ? hex(o.bg) : '#ffffff'; g.fillRect(0, 0, w, h); }
  g.setTransform(k, 0, 0, k, -o.region.x * k, -o.region.y * k);
  const rc: RenderContext = { doc: p.doc, scale: k, outline: false, assets: (key) => p.bitmaps.get(key) ?? null, printing: true };
  for (const n of o.only ?? p.doc.layers) renderNode(g, n, rc);
  if (o.dither) ditherCanvas(c, o.dither);
  return c;
}

export async function bakeTraced(engine: Engine, ids?: string[]): Promise<Map<string, VNode>> {
  const p = engine.current, out = new Map<string, VNode>();
  if (!p) return out;
  const found: VNode[] = [];
  const walk = (n: VNode): void => {
    if (n.hidden) return;
    if (n.kind !== 'layer' && n.ap.effects.some((e) => rayTraced(e))) { found.push(n); return; }
    for (const c of childrenOf(n) ?? []) walk(c);
  };
  for (const id of engine.targetIds(ids)) { const n = findNode(p.doc, id); if (n) walk(n); }
  for (const n of found) {
    const b = inflate(visualBounds(p.doc, n), 1);
    if (isEmptyRect(b) || b.w <= 0 || b.h <= 0) continue;
    const c = await renderRegion(p, { region: b, scale: (p.doc.rasterPpi || 300) / 72, transparent: true, only: [{ ...n, opacity: 1, blend: 'normal' } as VNode] }), blob = await canvasBlob(c, 'png', 1), key = `img-${newId('').replace(/[^a-z0-9]/gi, '')}.png`;
    p.assets.set(key, blob);
    out.set(n.id, { id: newId('im'), kind: 'image', src: key, w: c.width, h: c.height, xf: [b.w / c.width, 0, 0, b.h / c.height, b.x, b.y], opacity: n.opacity, blend: n.blend, ap: { items: [], effects: [] }, name: n.name ?? '3D' });
  }
  return out;
}

export async function canvasBlob(c: HTMLCanvasElement, format: RasterFormat, quality: number, tiff?: Partial<TiffChoice>, transparent = false): Promise<Blob> {
  if (format === 'tiff') {
    const g = c.getContext('2d');
    if (!g) throw new Error('This browser could not read the drawing surface for the TIFF export.');
    const px = g.getImageData(0, 0, c.width, c.height);
    return encodeTiff(px.data, c.width, c.height, { ppi: tiff?.ppi ?? 72, alpha: transparent, cmyk: tiff?.cmyk, compression: tiff?.compression ?? 'lzw' });
  }
  const type = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error(`This browser cannot write ${format.toUpperCase()} files.`))), type, quality));
}

export async function exportRaster(p: Project, o: RasterOpts): Promise<Blob> {
  const c = await renderRegion(p, { ...o, transparent: o.transparent && o.format !== 'jpg' });
  return canvasBlob(c, o.format, o.quality, o.tiff ? { ...o.tiff, ppi: o.tiff.ppi ?? Math.round(72 * o.scale) } : { ppi: Math.round(72 * o.scale) }, o.transparent);
}

export interface ScreenItem { artboard: number; scale: number; format: RasterFormat | 'svg' | 'pdf'; suffix: string }
export interface AssetItem { scale: number; format: RasterFormat | 'svg' | 'pdf'; suffix: string }

export async function exportAssetsZip(p: Project, assets: Array<{ name: string; ids: string[] }>, items: AssetItem[], pdf: (q: Project) => Promise<Blob>): Promise<Blob | null> {
  const files: Array<{ name: string; blob: Blob }> = [], used = new Set<string>();
  const safe = (s: string): string => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Asset';
  for (const a of assets) {
    const nodes = a.ids.map((id) => findNode(p.doc, id)).filter((n): n is VNode => !!n && !n.hidden);
    if (!nodes.length) continue;
    const b = selectionBounds(p.doc, nodes, true);
    if (isEmptyRect(b) || b.w <= 0 || b.h <= 0) continue;
    let stem = safe(a.name), k = 1;
    while (used.has(stem)) stem = `${safe(a.name)}-${++k}`;
    used.add(stem);
    for (const it of items) {
      const name = `${stem}${it.suffix}`;
      if (it.format === 'svg') files.push({ name: `${name}.svg`, blob: new Blob([await exportSvg(p, { artboard: 'art', ids: nodes.map((n) => n.id), outlineText: false, preserve: false, precision: 3 })], { type: 'image/svg+xml' }) });
      else if (it.format === 'pdf') {
        const layer = { ...makeLayer('Asset', 0), children: nodes };
        const q = Object.create(p) as Project;
        Object.defineProperty(q, 'doc', { value: { ...p.doc, artboards: [{ id: 'asset', name: stem, x: b.x, y: b.y, w: b.w, h: b.h, bg: null }], layers: [layer] } });
        files.push({ name: `${name}.pdf`, blob: await pdf(q) });
      } else files.push({ name: `${name}.${it.format}`, blob: await exportRaster(p, { region: b, scale: it.scale, format: it.format, quality: 0.92, transparent: true, only: nodes }) });
    }
  }
  return files.length ? zipFiles(files) : null;
}

export async function exportForScreens(p: Project, items: ScreenItem[], pdf: (artboards: number[]) => Promise<Blob>): Promise<Blob> {
  const files: Array<{ name: string; blob: Blob }> = [];
  const safe = (s: string): string => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Artboard';
  for (const it of items) {
    const a = p.doc.artboards[it.artboard];
    if (!a) continue;
    const base = `${safe(a.name)}${it.suffix}`;
    if (it.format === 'svg') files.push({ name: `${base}.svg`, blob: new Blob([await exportSvg(p, { artboard: it.artboard, outlineText: false, preserve: false, precision: 3 })], { type: 'image/svg+xml' }) });
    else if (it.format === 'pdf') files.push({ name: `${base}.pdf`, blob: await pdf([it.artboard]) });
    else files.push({ name: `${base}.${it.format}`, blob: await exportRaster(p, { region: exportRegion(p, it.artboard), scale: it.scale, format: it.format, quality: 0.92, transparent: !a.bg, bg: a.bg }) });
  }
  return zipFiles(files);
}
