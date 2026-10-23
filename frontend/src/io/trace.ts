import { transformPath } from '../engine/geometry';
import { rgb, solid, fill, stroke } from '../engine/paint';
import { newId } from '../engine/doc';
import type { Mat, TraceView, VNode } from '../engine';
import { traceCore, type RGB3, type TraceOpts, type TraceOut } from './trace-core';
export type { TraceOpts } from './trace-core';

export const TRACE_CAP = 2000;
const STROKES = { strokes: true, fills: false, ignoreWhite: true } as const;
export const TRACE_PRESETS: Record<string, Partial<TraceOpts>> = {
  'Black and White Logo': { mode: 'bw', threshold: 128, detail: 0.6, corners: 0.75, noise: 25, ignoreWhite: true, strokes: false, fills: true },
  'Sketched Art': { mode: 'bw', threshold: 160, detail: 0.3, noise: 40, ignoreWhite: true, smooth: false, strokes: false, fills: true },
  '3 Colors': { mode: 'color', palette: 'limited', colors: 3, noise: 25 },
  '6 Colors': { mode: 'color', palette: 'limited', colors: 6, noise: 25 },
  '16 Colors': { mode: 'color', palette: 'limited', colors: 16, noise: 16 },
  'Shades of Gray': { mode: 'gray', palette: 'auto', colors: 6, noise: 16 },
  'Low Fidelity Photo': { mode: 'color', palette: 'full', detail: 0.3, corners: 0.25, noise: 16, method: 'overlapping' },
  'High Fidelity Photo': { mode: 'color', palette: 'full', detail: 0.85, corners: 0.25, noise: 4, method: 'overlapping' },
  'Silhouettes': { mode: 'bw', threshold: 230, detail: 0.5, noise: 25, ignoreWhite: true, strokes: false, fills: true },
  'Line Art': { mode: 'bw', threshold: 128, detail: 0.75, noise: 9, ...STROKES, fills: true, strokeWidth: 10 },
  'Technical Drawing': { mode: 'bw', threshold: 140, detail: 0.9, corners: 0.95, noise: 9, smooth: true, snapLines: true, ...STROKES, fills: true, strokeWidth: 6 },
  'Outline': { mode: 'bw', threshold: 128, detail: 0.7, corners: 0.6, noise: 9, ...STROKES, strokeWidth: 10 },
};
export const DEFAULT_TRACE: TraceOpts = { mode: 'color', palette: 'limited', colors: 6, threshold: 128, detail: 0.5, corners: 0.75, noise: 25, method: 'abutting', fills: true, strokes: false, strokeWidth: 10, ignoreWhite: false, smooth: true, snapLines: false, maxSide: TRACE_CAP };
export const TRACE_PALETTES: ReadonlyArray<readonly [TraceOpts['palette'], string]> = [['auto', 'Automatic'], ['limited', 'Limited'], ['full', 'Full Tone'], ['library', 'Document Library']];
export const TRACE_VIEWS: ReadonlyArray<readonly [TraceView, string]> = [['result', 'Tracing Result'], ['result_outlines', 'Tracing Result with Outlines'], ['outlines', 'Outlines'], ['outlines_source', 'Outlines with Source Image'], ['source', 'Source Image']];

const words = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && w !== 'and');
export function presetKey(name: unknown): string | null {
  const want = words(String(name ?? ''));
  if (!want.length) return null;
  const keys = Object.keys(TRACE_PRESETS);
  return keys.find((k) => { const have = words(k); return have.length === want.length && want.every((w) => have.includes(w)); }) ?? keys.find((k) => { const have = words(k); return want.every((w) => have.includes(w)); }) ?? null;
}

export function traceOptions(base: Partial<TraceOpts>, a: Record<string, unknown>): TraceOpts & { preset: string } {
  const pk = presetKey(a.preset);
  const mode: Partial<TraceOpts> = a.mode === 'color' || a.mode === 'gray' || a.mode === 'bw' ? { mode: a.mode } : {};
  const touched = ['colors', 'threshold', 'paths', 'ignore_white', 'smooth', 'mode', 'palette', 'corners', 'noise', 'method', 'fills', 'strokes', 'stroke_width', 'snap_lines'].some((k) => k in a);
  const pal = TRACE_PALETTES.some(([k]) => k === a.palette) ? { palette: a.palette as TraceOpts['palette'] } : {};
  const pct = (v: unknown): number => Math.max(0, Math.min(1, Number(v) / 100));
  const raw = { ...(base as Partial<TraceOpts> & { preset?: unknown }) };
  delete raw.preset;
  return {
    ...DEFAULT_TRACE, ...raw, ...(pk ? TRACE_PRESETS[pk] : {}),
    ...(typeof a.colors === 'number' ? { colors: Math.max(2, Math.min(64, Math.round(a.colors))), ...(a.mode === 'gray' ? {} : { mode: 'color' as const }), ...('palette' in a ? {} : { palette: 'limited' as const }) } : {}),
    ...(typeof a.threshold === 'number' ? { threshold: Math.max(1, Math.min(255, Math.round(a.threshold))), mode: 'bw' as const } : {}),
    ...(typeof a.paths === 'number' ? { detail: pct(a.paths) } : {}),
    ...(typeof a.corners === 'number' ? { corners: pct(a.corners) } : {}),
    ...(typeof a.noise === 'number' ? { noise: Math.max(1, Math.min(1000, Math.round(a.noise))) } : {}),
    ...(a.method === 'abutting' || a.method === 'overlapping' ? { method: a.method } : {}),
    ...(typeof a.fills === 'boolean' ? { fills: a.fills } : {}),
    ...(typeof a.strokes === 'boolean' ? { strokes: a.strokes } : {}),
    ...(typeof a.stroke_width === 'number' ? { strokeWidth: Math.max(1, Math.min(100, a.stroke_width)) } : {}),
    ...(typeof a.ignore_white === 'boolean' ? { ignoreWhite: a.ignore_white } : {}),
    ...(typeof a.smooth === 'boolean' ? { smooth: a.smooth } : {}),
    ...(typeof a.snap_lines === 'boolean' ? { snapLines: a.snap_lines } : {}),
    ...pal, ...mode,
    maxSide: TRACE_CAP,
    preset: pk ?? (touched ? 'Custom' : String((base as { preset?: unknown }).preset ?? 'Custom')),
  };
}

function inWorker(bmp: ImageBitmap, w: number, h: number, opts: TraceOpts, library: RGB3[] | null, scale: number, signal?: AbortSignal): Promise<TraceOut> {
  return new Promise((resolve, reject) => {
    const wk = new Worker(new URL('./trace.worker.ts', import.meta.url), { type: 'module' });
    const stop = (): void => wk.terminate();
    if (signal) signal.addEventListener('abort', () => { stop(); reject(new DOMException('The trace was replaced by a newer one.', 'AbortError')); }, { once: true });
    wk.onmessage = (e: MessageEvent<{ ok: boolean; out?: TraceOut; error?: string }>) => { stop(); if (e.data.ok && e.data.out) resolve(e.data.out); else reject(new Error(e.data.error ?? 'The trace failed.')); };
    wk.onerror = (e) => { stop(); reject(new Error(e.message || 'The trace worker failed.')); };
    wk.postMessage({ bmp, w, h, opts, library, scale }, [bmp]);
  });
}

export interface TraceRun { node: VNode | null; w: number; h: number; colors: number; ms: number }

export async function traceImage(blob: Blob, xf: Mat, natural: { w: number; h: number }, o: TraceOpts, library: RGB3[] | null = null, signal?: AbortSignal): Promise<TraceRun> {
  const t0 = performance.now(), bmp = await createImageBitmap(blob);
  const cap = Math.max(64, Math.min(TRACE_CAP, o.maxSide || TRACE_CAP));
  const s = Math.min(1, cap / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
  let out: TraceOut;
  if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') out = await inWorker(bmp, w, h, o, library, s, signal);
  else {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    g.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    out = traceCore(g.getImageData(0, 0, w, h).data, w, h, o, library, s);
  }
  const toDoc: Mat = [xf[0] * (natural.w / w), xf[1] * (natural.w / w), xf[2] * (natural.h / h), xf[3] * (natural.h / h), xf[4], xf[5]];
  const k = Math.sqrt(Math.abs(toDoc[0] * toDoc[3] - toDoc[1] * toDoc[2]));
  const kids: VNode[] = out.pieces.map((p): VNode => {
    const col = solid(rgb(p.color[0], p.color[1], p.color[2]));
    const ap = p.stroke > 0 ? { items: [stroke(col, Math.max(0.1, p.stroke * k), { cap: 'round', join: 'round' })], effects: [] } : { items: [fill(col)], effects: [] };
    return { id: newId('p'), kind: 'path', d: transformPath(p.d, toDoc), rule: p.stroke > 0 ? 'nonzero' : 'evenodd', opacity: 1, blend: 'normal', ap };
  });
  const node: VNode | null = kids.length ? { id: newId('g'), kind: 'group', clip: false, children: kids, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, name: 'Trace Image' } : null;
  return { node, w, h, colors: out.colors, ms: Math.round(performance.now() - t0) };
}
