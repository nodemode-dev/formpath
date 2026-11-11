import { newId } from '../engine/doc';
import { reflow } from '../engine/flow';
import { Project } from '../engine/project';
import { applyDataSetDoc, fileStem, type ResolvedImage } from '../engine/variables';
import type { Engine } from '../engine';
import { api } from './api';
import { exportPdf } from './pdf';
import { serialize } from './project-io';
import { exportRaster } from './raster';
import { exportRegion, exportSvg } from './svg';
import { zipFiles } from './zip';

const cache = new WeakMap<Project, Map<string, ResolvedImage>>();
const mimeOf = (name: string, blob: Blob): string => blob.type && blob.type !== 'application/octet-stream' ? blob.type : /\.png$/i.test(name) ? 'image/png' : /\.jpe?g$/i.test(name) ? 'image/jpeg' : /\.webp$/i.test(name) ? 'image/webp' : /\.gif$/i.test(name) ? 'image/gif' : /\.svg$/i.test(name) ? 'image/svg+xml' : 'image/png';

async function fetchImage(src: string): Promise<{ blob: Blob; name: string }> {
  const name = src.split(/[\\/]/).pop()?.split('?')[0] || 'image.png';
  if (/^(https?:|data:|blob:)/i.test(src)) { const r = await fetch(src); if (!r.ok) throw new Error(`${src} answered ${r.status}.`); const b = await r.blob(); return { blob: new Blob([b], { type: mimeOf(name, b) }), name }; }
  const b = await api.readFile(src);
  return { blob: new Blob([b], { type: mimeOf(name, b) }), name };
}

export async function resolveImages(p: Project, index: number, fail: (t: string) => void = () => undefined): Promise<Record<string, ResolvedImage>> {
  const set = p.doc.dataSets?.[index], out: Record<string, ResolvedImage> = {};
  if (!set) return out;
  let c = cache.get(p);
  if (!c) { c = new Map(); cache.set(p, c); }
  for (const v of p.doc.variables ?? []) {
    if (v.kind !== 'image' || !v.node) continue;
    const raw = set.values[v.id];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const src = raw.trim();
    if (src.startsWith('asset:')) { const key = src.slice(6), a = p.doc.images[key]; if (a && p.assets.has(key)) out[v.id] = { key, asset: a, name: key }; continue; }
    const hit = c.get(src);
    if (hit && p.assets.has(hit.key)) { out[v.id] = hit; continue; }
    try {
      const { blob, name } = await fetchImage(src);
      const bmp = await createImageBitmap(blob), w = bmp.width, h = bmp.height;
      bmp.close();
      const key = `img-${newId('').replace(/[^a-z0-9]/gi, '')}.${(blob.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg').replace(/[^a-z0-9]/g, '') || 'png'}`;
      p.assets.set(key, blob);
      const r: ResolvedImage = { key, asset: { mime: blob.type || 'image/png', w, h }, name: src };
      c.set(src, r);
      out[v.id] = r;
    } catch (err) { fail(`${v.name}: ${err instanceof Error ? err.message : String(err)}`); }
  }
  return out;
}

export async function showDataSet(engine: Engine, index: number): Promise<boolean> {
  const p = engine.current;
  if (!p || !p.doc.dataSets?.[index]) return false;
  const images = await engine.task(() => resolveImages(p, index, (t) => engine.notice(t, 'error')));
  return engine.applyDataSet(index, images);
}

export interface MergeOpts { format: 'png' | 'svg' | 'pdf'; fpth: boolean; nameVar: string | null; folder: string | null; scale: number; artboard: number; sets?: number[] }
export interface MergeResult { files: string[]; errors: string[]; zip: Blob | null; folder: string | null }

export async function variationProject(p: Project, index: number, images: Record<string, ResolvedImage>): Promise<Project> {
  const q = new Project(newId('d'), reflow(applyDataSetDoc(p.doc, index, images)), p.name);
  for (const [k, b] of p.assets) q.assets.set(k, b);
  q.activeArtboard = p.activeArtboard;
  return q;
}

export async function projectBlob(q: Project): Promise<Blob> {
  const { manifest, files } = serialize(q);
  return zipFiles([{ name: 'manifest.json', blob: new Blob([JSON.stringify(manifest)], { type: 'application/json' }) }, ...files.map((f) => ({ name: `images/${f.name}`, blob: f.blob }))]);
}

export async function renderAs(q: Project, format: 'png' | 'svg' | 'pdf', artboard: number, scale: number, version: string): Promise<Blob> {
  if (format === 'svg') return new Blob([await exportSvg(q, { artboard, outlineText: false, preserve: true, precision: 3 })], { type: 'image/svg+xml' });
  if (format === 'pdf') return exportPdf(q, { artboards: [artboard], preserve: true, ppi: q.doc.rasterPpi || 300, version });
  return exportRaster(q, { region: exportRegion(q, artboard), scale, format: 'png', quality: 1, transparent: false, bg: q.doc.artboards[artboard]?.bg ?? null });
}

export async function exportDataSets(engine: Engine, o: MergeOpts, version: string, progress: (t: string) => void = () => undefined): Promise<MergeResult> {
  const p = engine.current;
  if (!p) throw new Error('No document is open.');
  const sets = p.doc.dataSets ?? [];
  if (!sets.length) throw new Error('The document has no data sets: capture or import some first.');
  const pick = (o.sets?.length ? o.sets : sets.map((_, i) => i)).filter((i) => sets[i]);
  const files: Array<{ name: string; blob: Blob }> = [], errors: string[] = [], written: string[] = [], used = new Set<string>();
  for (const i of pick) {
    progress(`Data set ${i + 1} of ${sets.length}`);
    try {
      const images = await resolveImages(p, i, (t) => errors.push(`${sets[i].name}: ${t}`));
      const q = await variationProject(p, i, images);
      let stem = fileStem(p.doc, sets[i], o.nameVar, i), n = 2;
      while (used.has(stem.toLowerCase())) stem = `${fileStem(p.doc, sets[i], o.nameVar, i)} ${n++}`;
      used.add(stem.toLowerCase());
      files.push({ name: `${stem}.${o.format}`, blob: await renderAs(q, o.format, Math.min(o.artboard, q.doc.artboards.length - 1), o.scale, version) });
      if (o.fpth) files.push({ name: `${stem}.fpth`, blob: await projectBlob(q) });
    } catch (err) { errors.push(`${sets[i].name}: ${err instanceof Error ? err.message : String(err)}`); }
  }
  if (o.folder) {
    for (const f of files) { try { written.push(await api.writeFile(o.folder, f.name, f.blob)); } catch (err) { errors.push(`${f.name}: ${err instanceof Error ? err.message : String(err)}`); } }
    if (errors.length) { try { await api.writeFile(o.folder, 'formpath-data-merge-errors.txt', new Blob([errors.join('\n') + '\n'], { type: 'text/plain' })); } catch { } }
    return { files: written, errors, zip: null, folder: o.folder };
  }
  if (errors.length) files.push({ name: 'formpath-data-merge-errors.txt', blob: new Blob([errors.join('\n') + '\n'], { type: 'text/plain' }) });
  return { files: files.map((f) => f.name), errors, zip: files.length ? await zipFiles(files) : null, folder: null };
}
