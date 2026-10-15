import { rgb as mkRgb, toRgb } from '../paint';
import { lutCmykToRgb, lutRgbToCmyk, type Lut } from '../color-management';
import type { Appearance, Color, Doc, Paint, VNode } from '../types';

export type ColorFn = (c: Color) => Color;

export function throughCmykFn(oldCmykToRgb: Lut | null, rgbToCmyk: Lut): ColorFn {
  return (c) => {
    if (c.kind === 'gray') return c;
    const v = c.kind === 'cmyk' ? (oldCmykToRgb ? lutCmykToRgb(oldCmykToRgb, c.c, c.m, c.y, c.k) : toRgb(c)) : toRgb(c);
    return lutRgbToCmyk(rgbToCmyk, v.r, v.g, v.b);
  };
}

export function toRgbFn(cmykToRgb: Lut): ColorFn {
  return (c) => {
    if (c.kind !== 'cmyk') return c;
    const v = lutCmykToRgb(cmykToRgb, c.c, c.m, c.y, c.k);
    return mkRgb(v.r, v.g, v.b);
  };
}

function paintOf(p: Paint, f: ColorFn): Paint {
  if (p.type === 'color') return { ...p, color: f(p.color) };
  if (p.type === 'gradient') return { ...p, gradient: { ...p.gradient, stops: p.gradient.stops.map((s) => ({ ...s, color: f(s.color) })), points: p.gradient.points?.map((q) => ({ ...q, color: f(q.color) })) } };
  return p;
}

function apOf(ap: Appearance, f: ColorFn): Appearance { return { ...ap, items: ap.items.map((i) => ({ ...i, paint: paintOf(i.paint, f) })) }; }

export function convertNode(n: VNode, f: ColorFn): VNode {
  const base = { ...n, ap: apOf(n.ap, f) } as VNode;
  switch (base.kind) {
    case 'text': return { ...base, spans: base.spans.map((s) => ({ ...s, style: { ...s.style, fill: paintOf(s.style.fill, f), stroke: paintOf(s.style.stroke, f) } })) };
    case 'mesh': return { ...base, points: base.points.map((q) => ({ ...q, color: f(q.color) })) };
    case 'compound': return { ...base, children: base.children.map((c) => convertNode(c, f) as typeof c) };
    default: return 'children' in base ? ({ ...base, children: (base.children as VNode[]).map((c) => convertNode(c, f)) } as VNode) : base;
  }
}

export function convertDoc(doc: Doc, f: ColorFn): Doc {
  return {
    ...doc,
    layers: doc.layers.map((l) => convertNode(l, f) as typeof l),
    swatches: doc.swatches.map((s) => ({ ...s, paint: paintOf(s.paint, f) })),
    symbols: doc.symbols.map((s) => ({ ...s, art: convertNode(s.art, f) })),
    styles: doc.styles.map((s) => ({ ...s, ap: apOf(s.ap, f) })),
    artboards: doc.artboards.map((a) => (a.bg ? { ...a, bg: f(a.bg) } : a)),
  };
}
