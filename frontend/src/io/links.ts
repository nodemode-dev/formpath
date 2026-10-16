import { allNodes, newId } from '../engine/doc';
import { invalidateLayers } from '../engine/render';
import type { Engine, ImageLink, ImageNode, Project } from '../engine';
import { api } from './api';
import { displayBlob, placeKind } from './place';

export type LinkState = 'linked' | 'modified' | 'missing' | 'embedded' | 'unknown';
export interface LinkStatus { state: LinkState; size?: number; mtime?: number }
export interface LinkFile { blob: Blob; name: string; size: number; mtime: number; path?: string; handle?: string; shown?: boolean }

export const linkKey = (l: ImageLink): string => (l.path ? `path:${l.path}` : `handle:${l.handle ?? ''}`);
export const IMAGE_KINDS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.pdf', '.ai', '.psd', '.psb', '.tif', '.tiff'];
export const linkable = (name: string): boolean => IMAGE_KINDS.some((k) => name.toLowerCase().endsWith(k));
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' };
export function typed(blob: Blob, name: string): Blob {
  const t = MIME[(name.split('.').pop() ?? '').toLowerCase()];
  return t && blob.type !== t ? new Blob([blob], { type: t }) : blob;
}

export interface FileHandle { kind: 'file'; name: string; getFile(): Promise<File>; queryPermission?(o: { mode: string }): Promise<string>; requestPermission?(o: { mode: string }): Promise<string>; createWritable?(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }
interface DirHandle { kind: 'directory'; name: string; values(): AsyncIterable<FileHandle | DirHandle> }
type Picker = { showOpenFilePicker?(o: unknown): Promise<FileHandle[]>; showSaveFilePicker?(o: unknown): Promise<FileHandle>; showDirectoryPicker?(o?: unknown): Promise<DirHandle> };
const picker = (): Picker => window as unknown as Picker;
export const canLinkHandles = (): boolean => typeof picker().showOpenFilePicker === 'function' && typeof indexedDB !== 'undefined';

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const r = indexedDB.open('formpth-links', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('handles'); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}
async function store<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => { const q = fn(d.transaction('handles', mode).objectStore('handles')); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
}
async function keepHandle(h: FileHandle): Promise<string> { const id = newId('fh'); await store('readwrite', (s) => s.put(h, id)); return id; }
async function getHandle(id: string): Promise<FileHandle | null> { try { return ((await store('readonly', (s) => s.get(id))) as FileHandle | undefined) ?? null; } catch { return null; } }

const IMAGE_TYPES = [{ description: 'Images', accept: { 'image/*': IMAGE_KINDS } }];

export async function pickLinkedFile(): Promise<LinkFile | null> {
  const p = picker();
  if (!p.showOpenFilePicker) return null;
  let hs: FileHandle[];
  try { hs = await p.showOpenFilePicker({ types: IMAGE_TYPES, multiple: false }); } catch { return null; }
  const h = hs[0];
  if (!h) return null;
  const f = await h.getFile();
  return { blob: f, name: f.name, size: f.size, mtime: f.lastModified, handle: await keepHandle(h) };
}

async function linkFromHandle(h: FileHandle, keep: boolean): Promise<LinkFile> {
  const f = await h.getFile();
  return { blob: f, name: f.name, size: f.size, mtime: f.lastModified, ...(keep ? { handle: await keepHandle(h) } : {}) };
}

/** File > Place: the picker returns handles, so a linkable file keeps its handle; anything else (SVG, EPS, models) comes back as a plain file. */
export async function pickPlaceFiles(): Promise<LinkFile[] | null> {
  const p = picker();
  if (!p.showOpenFilePicker) return null;
  let hs: FileHandle[];
  try { hs = await p.showOpenFilePicker({ types: IMAGE_TYPES, multiple: true }); } catch { return null; }
  const out: LinkFile[] = [];
  for (const h of hs) out.push(await linkFromHandle(h, linkable(h.name)));
  return out;
}

/** Drag and drop: must be called synchronously inside the drop event, because the items are dead after the first await. */
export async function dropHandles(dt: DataTransfer | null): Promise<Map<string, () => Promise<LinkFile>>> {
  const out = new Map<string, () => Promise<LinkFile>>();
  if (!dt) return out;
  const asks = Array.from(dt.items ?? []).map((i) => {
    const get = (i as unknown as { getAsFileSystemHandle?: () => Promise<FileHandle | DirHandle | null> }).getAsFileSystemHandle;
    if (i.kind !== 'file' || typeof get !== 'function') return Promise.resolve(null);
    try { return get.call(i).catch(() => null); } catch { return Promise.resolve(null); }
  });
  for (const h of await Promise.all(asks)) if (h && h.kind === 'file' && linkable(h.name)) { const fh = h; out.set(fh.name, () => linkFromHandle(fh, true)); }
  return out;
}

export async function pickLinkFolder(): Promise<Map<string, () => Promise<LinkFile>> | null> {
  const p = picker();
  if (!p.showDirectoryPicker) return null;
  let dir: DirHandle;
  try { dir = await p.showDirectoryPicker(); } catch { return null; }
  const out = new Map<string, () => Promise<LinkFile>>();
  for await (const h of dir.values()) if (h.kind === 'file') { const fh = h; out.set(fh.name.toLowerCase(), async () => { const f = await fh.getFile(); return { blob: f, name: f.name, size: f.size, mtime: f.lastModified, handle: await keepHandle(fh) }; }); }
  return out;
}

export async function saveLinkedFile(blob: Blob, name: string): Promise<LinkFile | null> {
  const p = picker();
  if (!p.showSaveFilePicker) return null;
  let h: FileHandle;
  try { h = await p.showSaveFilePicker({ suggestedName: name, types: IMAGE_TYPES }); } catch { return null; }
  const w = await h.createWritable?.();
  if (!w) return null;
  await w.write(blob); await w.close();
  const f = await h.getFile();
  return { blob: f, name: f.name, size: f.size, mtime: f.lastModified, handle: await keepHandle(h) };
}

export function linkOf(f: LinkFile): ImageLink { return { name: f.name, size: f.size, mtime: f.mtime, ...(f.path ? { path: f.path } : {}), ...(f.handle ? { handle: f.handle } : {}) }; }

export class LinkManager {
  private status = new Map<string, LinkStatus>();
  private hydrated = new WeakSet<Project>();
  private told = new Map<string, LinkState>();
  private running: Promise<void> | null = null;
  private soon = 0;
  onChange: (() => void) | null = null;
  notify: ((text: string) => void) | null = null;

  constructor(private readonly engine: Engine, private readonly service: () => boolean) {
    window.addEventListener('focus', () => void this.check());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void this.check(); });
    window.setInterval(() => { if (!document.hidden) void this.check(); }, 4000);
    engine.on('projects', () => { for (const p of engine.projects) if (!this.hydrated.has(p)) void this.hydrate(p); });
    engine.on('doc', () => { clearTimeout(this.soon); this.soon = window.setTimeout(() => void this.check(), 300); });
  }

  images(p: Project | null = this.engine.current): ImageNode[] { return p ? allNodes(p.doc).filter((n): n is ImageNode => n.kind === 'image') : []; }
  info(n: ImageNode): LinkStatus { return n.linked ? this.status.get(linkKey(n.linked)) ?? { state: 'unknown' } : { state: 'embedded' }; }
  state(n: ImageNode): LinkState { return this.info(n).state; }

  private judge(l: ImageLink, exists: boolean, size: number, mtime: number): LinkStatus {
    if (!exists) return { state: 'missing' };
    return { state: l.size === size && l.mtime === mtime ? 'linked' : 'modified', size, mtime };
  }

  async statOne(l: ImageLink): Promise<LinkStatus> {
    if (l.path) {
      if (!this.service()) return { state: 'unknown' };
      try { const [r] = await api.statFiles([l.path]); return this.judge(l, !!r?.exists, r?.size ?? 0, r?.mtime ?? 0); } catch { return { state: 'unknown' }; }
    }
    const h = l.handle ? await getHandle(l.handle) : null;
    if (!h) return { state: 'missing' };
    try { if (h.queryPermission && (await h.queryPermission({ mode: 'read' })) !== 'granted') return { state: 'unknown' }; const f = await h.getFile(); return this.judge(l, true, f.size, f.lastModified); } catch { return { state: 'missing' }; }
  }

  check(): Promise<void> {
    this.running ??= this.run().finally(() => { this.running = null; });
    return this.running;
  }

  private async run(): Promise<void> {
    const links = new Map<string, ImageLink>();
    for (const p of this.engine.projects) for (const n of this.images(p)) if (n.linked) links.set(linkKey(n.linked), n.linked);
    if (!links.size) return;
    const next = new Map<string, LinkStatus>();
    const paths = [...links.values()].filter((l) => l.path);
    if (paths.length && this.service()) {
      try { const rs = await api.statFiles(paths.map((l) => l.path as string)); rs.forEach((r, i) => next.set(linkKey(paths[i]), this.judge(paths[i], r.exists, r.size, r.mtime))); } catch { }
    }
    for (const [k, l] of links) if (!next.has(k) && !l.path) next.set(k, await this.statOne(l));
    let changed = false;
    const back: string[] = [];
    for (const [k, s] of next) { const o = this.status.get(k); if (!o || o.state !== s.state || o.mtime !== s.mtime) { if (o && o.state === 'missing' && s.state === 'linked') back.push(k); this.status.set(k, s); changed = true; } }
    for (const k of back) {
      const l = links.get(k), f = l ? await this.read(l) : null;
      if (!f) continue;
      for (const p of this.engine.projects) for (const key of new Set(this.images(p).filter((n) => n.linked && linkKey(n.linked) === k).map((n) => n.src))) await this.adopt(p, key, f.blob);
    }
    for (const [k, s] of next) {
      if ((s.state === 'modified' || s.state === 'missing') && this.told.get(k) !== s.state) this.notify?.(`${links.get(k)?.name ?? 'A linked file'} ${s.state === 'missing' ? 'is missing' : 'changed on disk'}: see the Links panel.`);
      this.told.set(k, s.state);
    }
    if (changed) this.onChange?.();
  }

  async read(l: ImageLink, ask = false): Promise<LinkFile | null> {
    const f = await this.readRaw(l, ask);
    if (!f || !placeKind(l.name)) return f;
    try { return { ...f, blob: await displayBlob(f.blob, l.name, l), shown: true }; } catch { return null; }
  }

  private async readRaw(l: ImageLink, ask: boolean): Promise<LinkFile | null> {
    if (l.path) { if (!this.service()) return null; try { return await this.readPath(l.path); } catch { return null; } }
    const h = l.handle ? await getHandle(l.handle) : null;
    if (!h) return null;
    try {
      if (h.queryPermission && (await h.queryPermission({ mode: 'read' })) !== 'granted') { if (!ask || !h.requestPermission || (await h.requestPermission({ mode: 'read' })) !== 'granted') return null; }
      const f = await h.getFile();
      return { blob: f, name: f.name, size: f.size, mtime: f.lastModified, handle: l.handle };
    } catch { return null; }
  }

  async readPath(path: string): Promise<LinkFile> { const r = await api.readFileInfo(path); return { blob: typed(r.blob, r.name), name: r.name, size: r.size, mtime: r.mtime, path: r.path }; }

  async preview(p: Project, key: string, blob: Blob): Promise<void> {
    try {
      const bmp = await createImageBitmap(blob), s = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
      if (s >= 1 && blob.size < 1.5e6) { p.previews.set(key, blob); bmp.close(); return; }
      const c = new OffscreenCanvas(Math.max(1, Math.round(bmp.width * s)), Math.max(1, Math.round(bmp.height * s)));
      c.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close();
      p.previews.set(key, await c.convertToBlob({ type: blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', quality: 0.85 }));
    } catch { }
  }

  async adopt(p: Project, key: string, blob: Blob): Promise<void> {
    p.assets.set(key, blob);
    try { p.bitmaps.set(key, await createImageBitmap(blob)); } catch { p.bitmaps.delete(key); }
    invalidateLayers();
    this.engine.repaint();
    await this.preview(p, key, blob);
  }

  async hydrate(p: Project): Promise<void> {
    this.hydrated.add(p);
    const seen = new Set<string>();
    for (const n of this.images(p)) {
      if (!n.linked || seen.has(n.src)) continue;
      seen.add(n.src);
      const s = await this.statOne(n.linked);
      this.status.set(linkKey(n.linked), s);
      if (s.state !== 'linked') continue;
      const f = await this.read(n.linked);
      if (f) await this.adopt(p, n.src, f.blob);
    }
    this.onChange?.();
  }
}
