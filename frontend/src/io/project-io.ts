import { allNodes, newDoc } from '../engine/doc';
import type { Artboard, Doc, Project } from '../engine';
import type { FilePart } from './api';

export const FORMAT = 'com.nodemode.formpth';
export const FORMAT_VERSION = 1;

export interface Manifest extends Record<string, unknown> { format: string; version: number; app: string; document: Record<string, unknown>; view?: { activeArtboard: number; activeLayer: string } }

export function serialize(p: Project, app = 'formpth'): { manifest: Manifest; files: FilePart[] } {
  const d = p.doc;
  const document: Record<string, unknown> = { ...d, artboards: d.artboards.map((a) => ({ ...a, rect: [a.x, a.y, a.w, a.h] })), perspView: p.persp };
  const files: FilePart[] = [];
  const linked = new Set<string>(), embedded = new Set<string>();
  for (const n of allNodes(d)) {
    if (n.kind === 'image') (n.linked ? linked : embedded).add(n.src);
    if (n.kind === 'group' && n.trace) (n.trace.src.linked ? linked : embedded).add(n.trace.src.src);
  }
  for (const key of Object.keys(d.images)) {
    const viaLink = linked.has(key) && !embedded.has(key);
    if (viaLink && d.linkPreviews === false) continue;
    const blob = (viaLink ? p.previews.get(key) : undefined) ?? p.assets.get(key);
    if (blob) files.push({ name: key, blob });
  }
  return { manifest: { format: FORMAT, version: FORMAT_VERSION, app, document, view: { activeArtboard: p.activeArtboard, activeLayer: p.activeLayer } }, files };
}

export function docFromManifest(manifest: Record<string, unknown>): Doc {
  if (manifest.format !== FORMAT) throw new Error('This is not a formpth project.');
  if (typeof manifest.version !== 'number' || manifest.version > FORMAT_VERSION) throw new Error(`This project was saved by a newer formpth (format ${String(manifest.version)}).`);
  const raw = manifest.document as Partial<Doc> & { artboards?: Array<Partial<Artboard> & { rect?: number[] }> };
  if (!raw || typeof raw !== 'object') throw new Error('The document is missing from the project.');
  const base = newDoc(612, 792);
  const artboards: Artboard[] = ((raw.artboards ?? []) as Array<Partial<Artboard> & { rect?: number[] }>).map((a, i) => {
    const r = Array.isArray(a.rect) && a.rect.length === 4 ? a.rect : [a.x ?? 0, a.y ?? 0, a.w ?? 612, a.h ?? 792];
    return { id: a.id ?? `ab${i}`, name: a.name ?? `Artboard ${i + 1}`, x: Number(r[0]), y: Number(r[1]), w: Math.max(1, Number(r[2])), h: Math.max(1, Number(r[3])), bg: a.bg ?? null };
  });
  return {
    ...base,
    ...raw,
    version: 1,
    artboards: artboards.length ? artboards : base.artboards,
    layers: Array.isArray(raw.layers) && raw.layers.length ? raw.layers : base.layers,
    swatches: raw.swatches ?? base.swatches,
    symbols: raw.symbols ?? [],
    styles: raw.styles ?? base.styles,
    brushes: raw.brushes ?? [],
    patterns: raw.patterns ?? [],
    charStyles: raw.charStyles ?? [],
    paraStyles: raw.paraStyles ?? [],
    guides: raw.guides ?? [],
    grid: raw.grid ?? base.grid,
    images: raw.images ?? {},
    rasterPpi: raw.rasterPpi ?? 300,
  } as Doc;
}

export async function deserialize(manifest: Record<string, unknown>, fetchAsset: (name: string) => Promise<Blob>): Promise<{ doc: Doc; assets: Map<string, Blob>; view: Manifest['view'] | null }> {
  const doc = docFromManifest(manifest);
  const assets = new Map<string, Blob>();
  for (const key of Object.keys(doc.images)) {
    try { assets.set(key, await fetchAsset(key)); } catch { }
  }
  return { doc, assets, view: (manifest.view as Manifest['view']) ?? null };
}
