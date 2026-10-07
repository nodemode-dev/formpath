import { renderNode, type RenderContext } from '../engine/render';
import { selectionBounds } from '../engine/bounds';
import { findNode, makeLayer } from '../engine/doc';
import { isEmptyRect } from '../engine/geometry';
import { hex } from '../engine/paint';
import type { Color, Project, Rect, VNode } from '../engine';
import { exportRegion, exportSvg } from './svg';
import { zipFiles } from './zip';

export type RasterFormat = 'png' | 'jpg' | 'webp';
export interface RasterOpts { region: Rect; scale: number; format: RasterFormat; quality: number; transparent: boolean; bg?: Color | null; only?: VNode[] }

const MAX_SIDE = 16384;

export async function ensureBitmaps(p: Project): Promise<void> {
  for (const [key, blob] of p.assets) {
    if (p.bitmaps.has(key)) continue;
    try { p.bitmaps.set(key, await createImageBitmap(blob)); } catch { }
  }
}

export async function renderRegion(p: Project, o: Omit<RasterOpts, 'format' | 'quality'>): Promise<HTMLCanvasElement> {
  await ensureBitmaps(p);
  await document.fonts.ready.catch(() => undefined);
  const k = Math.min(o.scale, MAX_SIDE / Math.max(1, o.region.w), MAX_SIDE / Math.max(1, o.region.h));
  const w = Math.max(1, Math.round(o.region.w * k)), h = Math.max(1, Math.round(o.region.h * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('This browser could not make a drawing surface for the export.');
  if (!o.transparent) { g.fillStyle = o.bg ? hex(o.bg) : '#ffffff'; g.fillRect(0, 0, w, h); }
  g.setTransform(k, 0, 0, k, -o.region.x * k, -o.region.y * k);
  const rc: RenderContext = { doc: p.doc, scale: k, outline: false, assets: (key) => p.bitmaps.get(key) ?? null, printing: true };
  for (const n of o.only ?? p.doc.layers) renderNode(g, n, rc);
  return c;
}

export async function canvasBlob(c: HTMLCanvasElement, format: RasterFormat, quality: number): Promise<Blob> {
  const type = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error(`This browser cannot write ${format.toUpperCase()} files.`))), type, quality));
}

export async function exportRaster(p: Project, o: RasterOpts): Promise<Blob> {
  const c = await renderRegion(p, { ...o, transparent: o.transparent && o.format !== 'jpg' });
  return canvasBlob(c, o.format, o.quality);
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
