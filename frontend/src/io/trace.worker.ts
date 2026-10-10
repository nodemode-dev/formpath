import { traceCore, type RGB3, type TraceOpts } from './trace-core';

interface Job { bmp: ImageBitmap; w: number; h: number; opts: TraceOpts; library: RGB3[] | null; scale: number }
const scope = self as unknown as { onmessage: ((e: MessageEvent<Job>) => void) | null; postMessage(m: unknown): void };

scope.onmessage = (e) => {
  const { bmp, w, h, opts, library, scale } = e.data;
  try {
    const c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
    g.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const px = g.getImageData(0, 0, w, h).data;
    scope.postMessage({ ok: true, out: traceCore(px, w, h, opts, library, scale) });
  } catch (err) {
    scope.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
