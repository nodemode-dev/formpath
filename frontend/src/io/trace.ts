import { simplifyPolyline, transformPath } from '../engine/geometry';
import { rgb, solid, fill } from '../engine/paint';
import { newId } from '../engine/doc';
import type { Anchor, Mat, PathData, Pt, TraceView, VNode } from '../engine';

export interface TraceOpts { mode: 'bw' | 'gray' | 'color'; colors: number; threshold: number; detail: number; ignoreWhite: boolean; smooth: boolean; maxSide: number }
export const TRACE_PRESETS: Record<string, Partial<TraceOpts>> = {
  'Black and White Logo': { mode: 'bw', threshold: 128, detail: 0.6, ignoreWhite: true },
  'Sketched Art': { mode: 'bw', threshold: 160, detail: 0.3, ignoreWhite: true, smooth: false },
  '3 Colors': { mode: 'color', colors: 3 },
  '6 Colors': { mode: 'color', colors: 6 },
  '16 Colors': { mode: 'color', colors: 16 },
  'Shades of Gray': { mode: 'gray', colors: 6 },
  'Low Fidelity Photo': { mode: 'color', colors: 12, detail: 0.3 },
  'High Fidelity Photo': { mode: 'color', colors: 32, detail: 0.85, maxSide: 600 },
  'Silhouettes': { mode: 'bw', threshold: 230, detail: 0.5, ignoreWhite: true },
  'Line Art': { mode: 'bw', threshold: 128, detail: 0.75, ignoreWhite: true },
  'Technical Drawing': { mode: 'bw', threshold: 140, detail: 0.9, ignoreWhite: true, smooth: false, maxSide: 600 },
};
export const DEFAULT_TRACE: TraceOpts = { mode: 'color', colors: 6, threshold: 128, detail: 0.5, ignoreWhite: false, smooth: true, maxSide: 420 };
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
  const touched = ['colors', 'threshold', 'paths', 'ignore_white', 'smooth', 'mode'].some((k) => k in a);
  return {
    ...DEFAULT_TRACE, ...base, ...(pk ? TRACE_PRESETS[pk] : {}),
    ...(typeof a.colors === 'number' ? { colors: Math.max(2, Math.min(64, Math.round(a.colors))), mode: 'color' as const } : {}),
    ...(typeof a.threshold === 'number' ? { threshold: Math.max(1, Math.min(255, Math.round(a.threshold))), mode: 'bw' as const } : {}),
    ...(typeof a.paths === 'number' ? { detail: Math.max(0, Math.min(1, a.paths / 100)) } : {}),
    ...(typeof a.ignore_white === 'boolean' ? { ignoreWhite: a.ignore_white } : {}),
    ...(typeof a.smooth === 'boolean' ? { smooth: a.smooth } : {}),
    ...mode,
    preset: pk ?? (touched ? 'Custom' : String((base as { preset?: unknown }).preset ?? 'Custom')),
  };
}

function quantize(px: Uint8ClampedArray, n: number, k: number): { labels: Uint16Array; palette: Array<[number, number, number]> } {
  const sample: Array<[number, number, number]> = [];
  const step = Math.max(1, Math.floor(n / 4000));
  for (let i = 0; i < n; i += step) if (px[i * 4 + 3] > 16) sample.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
  if (!sample.length) sample.push([255, 255, 255]);
  const centers: Array<[number, number, number]> = [sample[0]];
  while (centers.length < Math.min(k, sample.length)) {
    let best = sample[0], bd = -1;
    for (const s of sample) { let d = Infinity; for (const c of centers) d = Math.min(d, (s[0] - c[0]) ** 2 + (s[1] - c[1]) ** 2 + (s[2] - c[2]) ** 2); if (d > bd) { bd = d; best = s; } }
    if (bd <= 0) break;
    centers.push([...best]);
  }
  for (let it = 0; it < 8; it++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (const s of sample) { let bi = 0, bd = Infinity; centers.forEach((c, i) => { const d = (s[0] - c[0]) ** 2 + (s[1] - c[1]) ** 2 + (s[2] - c[2]) ** 2; if (d < bd) { bd = d; bi = i; } }); const a = acc[bi]; a[0] += s[0]; a[1] += s[1]; a[2] += s[2]; a[3]++; }
    acc.forEach((a, i) => { if (a[3]) centers[i] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
  }
  const labels = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    if (px[i * 4 + 3] <= 16) { labels[i] = 65535; continue; }
    let bi = 0, bd = Infinity;
    for (let c = 0; c < centers.length; c++) { const d = (px[i * 4] - centers[c][0]) ** 2 + (px[i * 4 + 1] - centers[c][1]) ** 2 + (px[i * 4 + 2] - centers[c][2]) ** 2; if (d < bd) { bd = d; bi = c; } }
    labels[i] = bi;
  }
  return { labels, palette: centers.map((c) => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]) };
}

function loops(labels: Uint16Array, w: number, h: number, label: number): Pt[][] {
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && labels[y * w + x] === label;
  const H = h + 1, vid = (x: number, y: number): number => x * H + y;
  const runs = new Map<number, number[]>();
  const link = (a: number, b: number): void => { const l = runs.get(a); if (l) l.push(b); else runs.set(a, [b]); };
  for (let y = 0; y <= h; y++) {
    let x = 0;
    while (x < w) {
      const above = inside(x, y - 1), below = inside(x, y);
      if (above === below) { x++; continue; }
      let e = x + 1;
      while (e < w && inside(e, y - 1) === above && inside(e, y) === below) e++;
      if (below) link(vid(e, y), vid(x, y)); else link(vid(x, y), vid(e, y));
      x = e;
    }
  }
  for (let x = 0; x <= w; x++) {
    let y = 0;
    while (y < h) {
      const left = inside(x - 1, y), right = inside(x, y);
      if (left === right) { y++; continue; }
      let e = y + 1;
      while (e < h && inside(x - 1, e) === left && inside(x, e) === right) e++;
      if (right) link(vid(x, y), vid(x, e)); else link(vid(x, e), vid(x, y));
      y = e;
    }
  }
  const pt = (k: number): Pt => ({ x: Math.floor(k / H), y: k % H });
  const out: Pt[][] = [];
  for (const start of [...runs.keys()]) {
    while (runs.get(start)?.length) {
      const poly: Pt[] = [];
      let prev = start, cur = start, guard = 0;
      do {
        const list = runs.get(cur);
        if (!list || !list.length) break;
        let pick = 0;
        if (list.length > 1 && cur !== prev) {
          const a = pt(prev), c = pt(cur), inX = c.x - a.x, inY = c.y - a.y;
          let best = -Infinity;
          list.forEach((nk, i) => { const n = pt(nk), turn = inX * (n.y - c.y) - inY * (n.x - c.x); if (turn > best) { best = turn; pick = i; } });
        }
        const nk = list.splice(pick, 1)[0];
        poly.push(pt(cur));
        prev = cur; cur = nk;
      } while (cur !== start && ++guard < 4e6);
      if (poly.length > 2) out.push(poly);
    }
  }
  return out;
}

function smoothLoop(pts: Pt[], cornerDeg: number): Anchor[] {
  const n = pts.length, lim = Math.cos((cornerDeg * Math.PI) / 180);
  return pts.map((q, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const ax = q.x - a.x, ay = q.y - a.y, bx = b.x - q.x, by = b.y - q.y, la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < 1e-9 || lb < 1e-9 || (ax * bx + ay * by) / (la * lb) < lim) return { x: q.x, y: q.y, ix: q.x, iy: q.y, ox: q.x, oy: q.y };
    const tx = b.x - a.x, ty = b.y - a.y, lt = Math.hypot(tx, ty) || 1, ux = tx / lt, uy = ty / lt;
    return { x: q.x, y: q.y, ix: q.x - (ux * la) / 3, iy: q.y - (uy * la) / 3, ox: q.x + (ux * lb) / 3, oy: q.y + (uy * lb) / 3, smooth: true };
  });
}

export async function traceImage(blob: Blob, xf: Mat, natural: { w: number; h: number }, o: TraceOpts): Promise<VNode | null> {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, o.maxSide / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const img = g.getImageData(0, 0, w, h), px = img.data, n = w * h;
  let labels: Uint16Array, palette: Array<[number, number, number]>;
  if (o.mode === 'bw') {
    labels = new Uint16Array(n);
    for (let i = 0; i < n; i++) { const l = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]; labels[i] = px[i * 4 + 3] <= 16 ? 65535 : l < o.threshold ? 0 : 1; }
    palette = [[0, 0, 0], [255, 255, 255]];
  } else {
    if (o.mode === 'gray') for (let i = 0; i < n; i++) { const l = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]; px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = l; }
    ({ labels, palette } = quantize(px, n, Math.max(2, Math.min(64, o.colors))));
  }
  const counts = palette.map((_, i) => labels.reduce((a, v) => a + (v === i ? 1 : 0), 0));
  const order = palette.map((_, i) => i).sort((a, b) => counts[b] - counts[a]);
  const toDoc: Mat = [xf[0] * (natural.w / w), xf[1] * (natural.w / w), xf[2] * (natural.h / h), xf[3] * (natural.h / h), xf[4], xf[5]];
  const tol = 0.4 + (1 - o.detail) * 2.2, minArea = (1 - o.detail) * 12 + 1;
  const kids: VNode[] = [];
  for (const i of order) {
    const [r, gg, b] = palette[i];
    if (o.ignoreWhite && r > 240 && gg > 240 && b > 240) continue;
    const polys = loops(labels, w, h, i).filter((p) => Math.abs(p.reduce((a, q, k) => { const z = p[(k + 1) % p.length]; return a + q.x * z.y - z.x * q.y; }, 0)) / 2 >= minArea);
    if (!polys.length) continue;
    const d: PathData = polys.map((p) => {
      const simple = simplifyPolyline([...p, p[0]], tol).slice(0, -1);
      if (!o.smooth || simple.length < 4) return { closed: true, pts: simple.map((q) => ({ x: q.x, y: q.y, ix: q.x, iy: q.y, ox: q.x, oy: q.y })) };
      return { closed: true, pts: smoothLoop(simple, 50) };
    });
    kids.push({ id: newId('p'), kind: 'path', d: transformPath(d, toDoc), rule: 'evenodd', opacity: 1, blend: 'normal', ap: { items: [fill(solid(rgb(r, gg, b)))], effects: [] } });
  }
  if (!kids.length) return null;
  return { id: newId('g'), kind: 'group', clip: false, children: kids, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, name: 'Image Trace' };
}
