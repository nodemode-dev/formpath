import { updateNodes } from '../doc';
import { hex, rgb, toRgb, rgbToHsb, hsbToRgb, toCmyk, toGray, gray } from '../paint';
import type { Appearance, Color, Doc, MeshNode, Paint, VNode } from '../types';

export type ColorFn = (c: Color) => Color;

function mapPaint(p: Paint, f: ColorFn): Paint {
  if (p.type === 'color') return { ...p, color: f(p.color), swatch: undefined, tint: undefined };
  if (p.type === 'gradient') return { ...p, swatch: undefined, gradient: { ...p.gradient, stops: p.gradient.stops.map((s) => ({ ...s, color: f(s.color) })), points: p.gradient.points?.map((q) => ({ ...q, color: f(q.color) })) } };
  return p;
}

function mapAp(ap: Appearance, f: ColorFn): Appearance { return { ...ap, items: ap.items.map((i) => ({ ...i, paint: mapPaint(i.paint, f) })) }; }

export function mapNodeColors(n: VNode, f: ColorFn): VNode {
  const base = { ...n, ap: mapAp(n.ap, f) } as VNode;
  switch (base.kind) {
    case 'text': return { ...base, spans: base.spans.map((s) => ({ ...s, style: { ...s.style, fill: mapPaint(s.style.fill, f), stroke: mapPaint(s.style.stroke, f) } })) };
    case 'mesh': return { ...base, points: (base as MeshNode).points.map((q) => ({ ...q, color: f(q.color) })) };
    case 'compound': return { ...base, children: base.children.map((c) => mapNodeColors(c, f) as typeof c) };
    default: return 'children' in base ? ({ ...base, children: (base.children as VNode[]).map((c) => mapNodeColors(c, f)) } as VNode) : base;
  }
}

export function collectColors(nodes: VNode[]): Color[] {
  const seen = new Map<string, Color>();
  const add = (c: Color): void => { const k = hex(c); if (!seen.has(k)) seen.set(k, c); };
  const paint = (p: Paint): void => { if (p.type === 'color') add(p.color); else if (p.type === 'gradient') p.gradient.stops.forEach((s) => add(s.color)); };
  const walk = (n: VNode): void => {
    n.ap.items.forEach((i) => paint(i.paint));
    if (n.kind === 'text') n.spans.forEach((s) => { paint(s.style.fill); paint(s.style.stroke); });
    if (n.kind === 'mesh') n.points.forEach((q) => add(q.color));
    if ('children' in n) (n.children as VNode[]).forEach(walk);
  };
  nodes.forEach(walk);
  return [...seen.values()];
}

export function recolorDoc(doc: Doc, ids: string[], f: ColorFn): Doc { return updateNodes(doc, ids, (n) => mapNodeColors(n, f)); }

export const RECOLOR: Record<string, (amount: number) => ColorFn> = {
  invert: () => (c) => { const v = toRgb(c); return rgb(255 - v.r, 255 - v.g, 255 - v.b); },
  grayscale: () => (c) => { const g = toGray(c); return g.kind === 'gray' ? gray(g.k) : c; },
  cmyk: () => (c) => toCmyk(c),
  rgb: () => (c) => { const v = toRgb(c); return rgb(v.r, v.g, v.b); },
  saturate: (amount) => (c) => { const v = toRgb(c), [h, s, b] = rgbToHsb(v.r, v.g, v.b), o = hsbToRgb(h, Math.max(0, Math.min(100, s * (1 + amount / 100))), b); return rgb(o.r, o.g, o.b); },
  hue: (amount) => (c) => { const v = toRgb(c), [h, s, b] = rgbToHsb(v.r, v.g, v.b), o = hsbToRgb((((h + amount) % 360) + 360) % 360, s, b); return rgb(o.r, o.g, o.b); },
  brightness: (amount) => (c) => { const v = toRgb(c), [h, s, b] = rgbToHsb(v.r, v.g, v.b), o = hsbToRgb(h, s, Math.max(0, Math.min(100, b + amount))); return rgb(o.r, o.g, o.b); },
};

export function nearestFn(palette: Color[]): ColorFn {
  const pal = palette.map((c) => ({ c, v: toRgb(c) }));
  return (c) => {
    if (!pal.length) return c;
    const v = toRgb(c);
    let best = pal[0], bd = Infinity;
    for (const p of pal) { const d = (p.v.r - v.r) ** 2 + (p.v.g - v.g) ** 2 + (p.v.b - v.b) ** 2; if (d < bd) { bd = d; best = p; } }
    return best.c;
  };
}

export function mapFn(map: Map<string, Color>): ColorFn { return (c) => map.get(hex(c)) ?? c; }

export type Lab = [number, number, number];
const toLin = (v: number): number => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const fromLin = (v: number): number => Math.round(Math.max(0, Math.min(1, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)) * 255);

export function oklab(c: Color): Lab {
  const v = toRgb(c), r = toLin(v.r), g = toLin(v.g), b = toLin(v.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

export function fromOklab(L: number, a: number, b: number): Color {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return rgb(fromLin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), fromLin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), fromLin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s));
}

const d2 = (p: Lab, q: Lab): number => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
const chroma = (p: Lab): number => Math.hypot(p[1], p[2]);

export function clusterLab(pts: Lab[], k: number, weights?: number[]): { assign: number[]; centers: Lab[] } {
  const n = pts.length, K = Math.max(1, Math.min(k, n));
  if (!n) return { assign: [], centers: [] };
  const w = weights ?? pts.map(() => 1);
  let first = 0;
  for (let i = 1; i < n; i++) if (chroma(pts[i]) * w[i] > chroma(pts[first]) * w[first]) first = i;
  const centers: Lab[] = [[...pts[first]] as Lab];
  while (centers.length < K) {
    let best = -1, bd = -1;
    for (let i = 0; i < n; i++) { const dd = Math.min(...centers.map((c) => d2(pts[i], c))) * w[i]; if (dd > bd) { bd = dd; best = i; } }
    centers.push([...pts[best]] as Lab);
  }
  const assign = new Array<number>(n).fill(0);
  for (let it = 0; it < 30; it++) {
    let moved = false;
    for (let i = 0; i < n; i++) { let bi = 0, bd = Infinity; centers.forEach((c, j) => { const dd = d2(pts[i], c); if (dd < bd) { bd = dd; bi = j; } }); if (assign[i] !== bi) { assign[i] = bi; moved = true; } }
    for (let j = 0; j < K; j++) {
      let sw = 0; const acc: Lab = [0, 0, 0];
      for (let i = 0; i < n; i++) if (assign[i] === j) { acc[0] += pts[i][0] * w[i]; acc[1] += pts[i][1] * w[i]; acc[2] += pts[i][2] * w[i]; sw += w[i]; }
      if (sw > 0) centers[j] = [acc[0] / sw, acc[1] / sw, acc[2] / sw];
    }
    if (!moved && it > 0) break;
  }
  return { assign, centers };
}

export interface RecolorRow { from: Color[]; to: Color; on: boolean }

export function reduceRows(colors: Color[], n: number): RecolorRow[] {
  const labs = colors.map(oklab), { assign } = clusterLab(labs, n);
  const rows: RecolorRow[] = [];
  const K = Math.max(0, ...assign) + 1;
  for (let j = 0; j < K; j++) {
    const members = colors.filter((_, i) => assign[i] === j);
    if (!members.length) continue;
    rows.push({ from: members, to: rowReference(members), on: true });
  }
  return rows.sort((a, b) => oklab(a.to)[0] - oklab(b.to)[0]);
}

export function rowReference(from: Color[]): Color {
  let best = from[0], score = -Infinity;
  for (const c of from) { const p = oklab(c), s = chroma(p) * 2 + (1 - p[0]) * 0.3; if (s > score) { score = s; best = c; } }
  return best;
}

export function rowsFn(rows: RecolorRow[], preserve: boolean): ColorFn {
  const map = new Map<string, Color>();
  for (const r of rows) {
    if (!r.on || !r.from.length) continue;
    const ref = oklab(rowReference(r.from)), tgt = oklab(r.to);
    for (const c of r.from) {
      if (!preserve || r.from.length === 1) { map.set(hex(c), r.to); continue; }
      const p = oklab(c), cr = chroma(ref), k = cr > 1e-4 ? chroma(p) / cr : 1, ct = chroma(tgt), h = Math.atan2(tgt[2], tgt[1]);
      const L = Math.max(0, Math.min(1, tgt[0] + (p[0] - ref[0]))), C = ct * Math.min(1.5, k);
      map.set(hex(c), fromOklab(L, C * Math.cos(h), C * Math.sin(h)));
    }
  }
  return mapFn(map);
}

export function fitRowsToPalette(rows: RecolorRow[], palette: Color[]): RecolorRow[] {
  if (!palette.length || !rows.length) return rows;
  const all = rows.flatMap((r) => r.from);
  const src = rows.length > palette.length ? reduceRows(all, palette.length) : rows.map((r) => ({ ...r }));
  const byL = [...src].sort((a, b) => oklab(a.to)[0] - oklab(b.to)[0]), pal = [...palette].sort((a, b) => oklab(a)[0] - oklab(b)[0]);
  return byL.map((r, i) => ({ ...r, to: pal[byL.length === 1 ? 0 : Math.round((i * (pal.length - 1)) / (byL.length - 1))] }));
}

export function samplePalette(px: Uint8ClampedArray, n: number): Color[] {
  const pts: Lab[] = [], step = Math.max(1, Math.floor(px.length / 4 / 4000));
  for (let i = 0; i < px.length; i += 4 * step) if (px[i + 3] > 128) pts.push(oklab(rgb(px[i], px[i + 1], px[i + 2])));
  if (!pts.length) return [];
  const { assign, centers } = clusterLab(pts, n);
  const counts = centers.map((_, j) => assign.filter((a) => a === j).length);
  return centers.map((c, j) => ({ c, n: counts[j] })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).map((x) => fromOklab(x.c[0], x.c[1], x.c[2]));
}
