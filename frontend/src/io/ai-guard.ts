import { Project, type Doc, type VNode } from '../engine';
import { childrenOf } from '../engine/doc';
import { t } from '../i18n';
import type { AiRead } from './ai-legacy';
import { readPdfVector, type PdfImport, type PdfSession } from './pdf-read';
import { renderRegion } from './raster';
import { assignPdfProfile } from './pdf-icc';

export const GUARD_SIDE = 256;
export const GUARD_CHANNEL = 40;
export const GUARD_LIMIT = 0.12;
export const GUARD_MAX_OBJECTS = 20000;
export const GUARD_BLANK = 0.002;

export interface GuardResult { pdf: PdfImport | null; diff: number; skipped: boolean; ms: number; boards: number[]; why: string }

export const guardNotice = (): string => t('The Illustrator data did not match the page, so the file opened through its PDF page.');

export function countObjects(doc: Doc, cap: number): number {
  let n = 0;
  const walk = (nodes: VNode[]): void => {
    for (const c of nodes) {
      if (n > cap) return;
      n++;
      const k = childrenOf(c);
      if (k) walk(k);
    }
  };
  for (const l of doc.layers) walk(l.children as VNode[]);
  return n;
}

async function shot(doc: Doc, assets: Map<string, Blob>, i: number, w: number, h: number | null): Promise<ImageData | null> {
  const a = doc.artboards[i];
  if (!a) return null;
  const p = new Project(`guard-${i}`, doc, 'guard');
  for (const [k, b] of assets) p.assets.set(k, b);
  const c = await renderRegion(p, { region: { x: a.x, y: a.y, w: a.w, h: a.h }, scale: GUARD_SIDE / Math.max(1, a.w, a.h), transparent: false });
  let src = c;
  if (h !== null && (c.width !== w || c.height !== h)) {
    src = document.createElement('canvas');
    src.width = w; src.height = h;
    src.getContext('2d')?.drawImage(c, 0, 0, w, h);
  }
  return src.getContext('2d')?.getImageData(0, 0, src.width, src.height) ?? null;
}

export function ink(a: ImageData): number {
  const x = a.data, n = x.length >> 2;
  let on = 0;
  for (let i = 0; i < x.length; i += 4) if (x[i] < 250 || x[i + 1] < 250 || x[i + 2] < 250) on++;
  return n ? on / n : 0;
}

export function differing(a: ImageData, b: ImageData): number {
  if (a.width !== b.width || a.height !== b.height) return 1;
  const x = a.data, y = b.data, n = x.length >> 2;
  let bad = 0;
  for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) > GUARD_CHANNEL || Math.abs(x[i + 1] - y[i + 1]) > GUARD_CHANNEL || Math.abs(x[i + 2] - y[i + 2]) > GUARD_CHANNEL) bad++;
  return n ? bad / n : 0;
}

/** Compares each artboard of a private data read with the file's own PDF page at about 256 px; the PDF read comes back when the two disagree so it is not parsed twice. */
export async function guardAi(read: AiRead, data: ArrayBuffer, title: string, password: string | undefined, session: PdfSession): Promise<GuardResult> {
  const t0 = performance.now(), done = (r: Omit<GuardResult, 'ms'>): GuardResult => ({ ...r, ms: Math.round(performance.now() - t0) });
  const objects = countObjects(read.doc, GUARD_MAX_OBJECTS);
  if (objects > GUARD_MAX_OBJECTS) return done({ pdf: null, diff: 0, skipped: true, boards: [], why: `${objects} objects` });
  let pdf: PdfImport;
  try { pdf = await readPdfVector(data, title, password, { session }); pdf = { ...pdf, doc: (await assignPdfProfile(pdf.doc, data)).doc }; } catch (err) { return done({ pdf: null, diff: 0, skipped: true, boards: [], why: `page unreadable: ${err instanceof Error ? err.message : String(err)}` }); }
  const boards: number[] = [];
  try {
    const pages = pdf.doc.artboards.length;
    if (read.doc.artboards.length < pages) return done({ pdf, diff: 1, skipped: false, boards: [1], why: `${read.doc.artboards.length} artboards for ${pages} pages` });
    for (let i = 0; i < pages; i++) {
      const b = await shot(pdf.doc, pdf.assets, i, 0, null);
      if (!b) continue;
      if (ink(b) < GUARD_BLANK) { boards.push(0); continue; }
      const a = await shot(read.doc, read.assets, i, b.width, b.height);
      boards.push(a ? differing(a, b) : 1);
    }
  } catch (err) { return done({ pdf: null, diff: 0, skipped: true, boards, why: `render failed: ${err instanceof Error ? err.message : String(err)}` }); }
  const diff = Math.max(0, ...boards);
  return done({ pdf: diff > GUARD_LIMIT ? pdf : null, diff, skipped: false, boards, why: '' });
}
