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
