import type { Appearance, BlendMode, Color, Doc, Effect, FillItem, Gradient, GradientStop, Paint, RGB, StrokeItem } from './types';
import { cmToCmyk, cmToRgb } from './color-management';

export const rgb = (r: number, g: number, b: number): Color => ({ kind: 'rgb', r, g, b });
export const cmyk = (c: number, m: number, y: number, k: number): Color => ({ kind: 'cmyk', c, m, y, k });
export const gray = (k: number): Color => ({ kind: 'gray', k });
export const BLACK: Color = rgb(0, 0, 0);
export const WHITE: Color = rgb(255, 255, 255);
export const NONE: Paint = { type: 'none' };
export const solid = (c: Color): Paint => ({ type: 'color', color: c });

const clamp255 = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

export function toRgb(c: Color): RGB {
  if (c.kind === 'rgb') return { r: c.r, g: c.g, b: c.b };
  if (c.kind === 'gray') { const v = clamp255(255 * (1 - c.k / 100)); return { r: v, g: v, b: v }; }
  const managed = cmToRgb(c);
  if (managed) return managed;
  const C = c.c / 100, M = c.m / 100, Y = c.y / 100, K = c.k / 100;
  return { r: clamp255(255 * (1 - C) * (1 - K)), g: clamp255(255 * (1 - M) * (1 - K)), b: clamp255(255 * (1 - Y) * (1 - K)) };
}
export function rgbToCmyk(r: number, g: number, b: number): Color {
  const R = r / 255, G = g / 255, B = b / 255, K = 1 - Math.max(R, G, B);
  if (K >= 1 - 1e-6) return cmyk(0, 0, 0, 100);
  const f = (v: number): number => Math.round(((1 - v - K) / (1 - K)) * 1000) / 10;
  return cmyk(f(R), f(G), f(B), Math.round(K * 1000) / 10);
}
export function toCmyk(c: Color): Color { if (c.kind === 'cmyk') return c; const v = toRgb(c); return cmToCmyk(v) ?? rgbToCmyk(v.r, v.g, v.b); }
export function toGray(c: Color): Color { if (c.kind === 'gray') return c; const v = toRgb(c); return gray(Math.round((1 - (0.299 * v.r + 0.587 * v.g + 0.114 * v.b) / 255) * 1000) / 10); }
export function inMode(c: Color, mode: 'rgb' | 'cmyk'): Color { if (mode === 'cmyk') return c.kind === 'rgb' ? toCmyk(c) : c; if (c.kind === 'rgb') return c; const v = toRgb(c); return rgb(v.r, v.g, v.b); }

export function rgbToHsb(r: number, g: number, b: number): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d > 0) h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, max === 0 ? 0 : (d / max) * 100, max * 100];
}
export function hsbToRgb(h: number, s: number, v: number): RGB {
  const S = s / 100, V = v / 100, C = V * S, X = C * (1 - Math.abs(((h / 60) % 2) - 1)), m = V - C;
  const [r, g, b] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
  return { r: clamp255((r + m) * 255), g: clamp255((g + m) * 255), b: clamp255((b + m) * 255) };
}

export function hex(c: Color): string {
  const v = toRgb(c), h = (n: number): string => clamp255(n).toString(16).padStart(2, '0');
  return `#${h(v.r)}${h(v.g)}${h(v.b)}`;
}
export function cssColor(c: Color, alpha = 1): string {
  const v = toRgb(c);
  return alpha >= 1 ? `rgb(${v.r},${v.g},${v.b})` : `rgba(${v.r},${v.g},${v.b},${Math.max(0, alpha).toFixed(3)})`;
}
export function tinted(c: Color, tint: number): Color {
  if (tint >= 100) return c;
  const t = Math.max(0, tint) / 100;
  if (c.kind === 'cmyk') return cmyk(c.c * t, c.m * t, c.y * t, c.k * t);
  if (c.kind === 'gray') return gray(c.k * t);
  return rgb(255 - (255 - c.r) * t, 255 - (255 - c.g) * t, 255 - (255 - c.b) * t);
}
export function sameColor(a: Color, b: Color): boolean { const x = toRgb(a), y = toRgb(b); return x.r === y.r && x.g === y.g && x.b === y.b; }
export function mixColor(a: Color, b: Color, t: number): Color {
  if (a.kind === 'cmyk' && b.kind === 'cmyk') return cmyk(a.c + (b.c - a.c) * t, a.m + (b.m - a.m) * t, a.y + (b.y - a.y) * t, a.k + (b.k - a.k) * t);
  if (a.kind === 'gray' && b.kind === 'gray') return gray(a.k + (b.k - a.k) * t);
  const x = toRgb(a), y = toRgb(b);
  return rgb(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t);
}
export function luminance(c: Color): number { const v = toRgb(c); return (0.2126 * v.r + 0.7152 * v.g + 0.0722 * v.b) / 255; }

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
  orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', gray: '#808080', grey: '#808080', brown: '#a52a2a', navy: '#000080', teal: '#008080',
  lime: '#00ff00', maroon: '#800000', olive: '#808000', silver: '#c0c0c0', gold: '#ffd700', indigo: '#4b0082', violet: '#ee82ee', coral: '#ff7f50',
  salmon: '#fa8072', crimson: '#dc143c', turquoise: '#40e0d0', beige: '#f5f5dc', ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa', tomato: '#ff6347',
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4', azure: '#f0ffff', bisque: '#ffe4c4', blanchedalmond: '#ffebcd', blueviolet: '#8a2be2',
  burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00', chocolate: '#d2691e', cornflowerblue: '#6495ed', cornsilk: '#fff8dc', darkblue: '#00008b', darkcyan: '#008b8b',
  darkgoldenrod: '#b8860b', darkgray: '#a9a9a9', darkgreen: '#006400', darkgrey: '#a9a9a9', darkkhaki: '#bdb76b', darkmagenta: '#8b008b', darkolivegreen: '#556b2f', darkorange: '#ff8c00',
  darkorchid: '#9932cc', darkred: '#8b0000', darksalmon: '#e9967a', darkseagreen: '#8fbc8f', darkslateblue: '#483d8b', darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', darkturquoise: '#00ced1',
  darkviolet: '#9400d3', deeppink: '#ff1493', deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969', dodgerblue: '#1e90ff', firebrick: '#b22222', floralwhite: '#fffaf0',
  forestgreen: '#228b22', fuchsia: '#ff00ff', gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', goldenrod: '#daa520', greenyellow: '#adff2f', honeydew: '#f0fff0', hotpink: '#ff69b4',
  indianred: '#cd5c5c', lavenderblush: '#fff0f5', lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6', lightcoral: '#f08080', lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2',
  lightgray: '#d3d3d3', lightgreen: '#90ee90', lightgrey: '#d3d3d3', lightpink: '#ffb6c1', lightsalmon: '#ffa07a', lightseagreen: '#20b2aa', lightskyblue: '#87cefa', lightslategray: '#778899',
  lightslategrey: '#778899', lightsteelblue: '#b0c4de', lightyellow: '#ffffe0', limegreen: '#32cd32', linen: '#faf0e6', mediumaquamarine: '#66cdaa', mediumblue: '#0000cd', mediumorchid: '#ba55d3',
  mediumpurple: '#9370db', mediumseagreen: '#3cb371', mediumslateblue: '#7b68ee', mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc', mediumvioletred: '#c71585', midnightblue: '#191970',
  mintcream: '#f5fffa', mistyrose: '#ffe4e1', moccasin: '#ffe4b5', navajowhite: '#ffdead', oldlace: '#fdf5e6', olivedrab: '#6b8e23', orangered: '#ff4500', orchid: '#da70d6',
  palegoldenrod: '#eee8aa', palegreen: '#98fb98', paleturquoise: '#afeeee', palevioletred: '#db7093', papayawhip: '#ffefd5', peachpuff: '#ffdab9', peru: '#cd853f', plum: '#dda0dd',
  powderblue: '#b0e0e6', rebeccapurple: '#663399', rosybrown: '#bc8f8f', royalblue: '#4169e1', saddlebrown: '#8b4513', sandybrown: '#f4a460', seagreen: '#2e8b57', seashell: '#fff5ee',
  sienna: '#a0522d', skyblue: '#87ceeb', slateblue: '#6a5acd', slategray: '#708090', slategrey: '#708090', snow: '#fffafa', springgreen: '#00ff7f', steelblue: '#4682b4', tan: '#d2b48c',
  thistle: '#d8bfd8', wheat: '#f5deb3', whitesmoke: '#f5f5f5', yellowgreen: '#9acd32',
};

export function parseColor(raw: string): Color | null {
  const s = raw.trim().toLowerCase();
  if (NAMED[s]) return parseColor(NAMED[s]);
  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (m) {
    const h = m[1].length <= 4 ? m[1].split('').map((x) => x + x).join('') : m[1];
    return rgb(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
  }
  m = /^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)/.exec(s);
  if (m) { const v = (x: string): number => (x.endsWith('%') ? (parseFloat(x) * 255) / 100 : parseFloat(x)); return rgb(clamp255(v(m[1])), clamp255(v(m[2])), clamp255(v(m[3]))); }
  m = /^cmyk\(\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*\)$/.exec(s);
  if (m) return cmyk(+m[1], +m[2], +m[3], +m[4]);
  m = /^gr[ae]y\(\s*([\d.]+)%?\s*\)$/.exec(s);
  if (m) return gray(+m[1]);
  m = /^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%/.exec(s);
  if (m) {
    const h = +m[1], sat = +m[2] / 100, l = +m[3] / 100, c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), mm = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return rgb(clamp255((r + mm) * 255), clamp255((g + mm) * 255), clamp255((b + mm) * 255));
  }
  return null;
}

export const stop = (offset: number, color: Color, opacity = 1, mid = 0.5): GradientStop => ({ offset, color, opacity, mid });
export function linearGradient(stops: GradientStop[], angle = 0): Gradient { return { kind: 'linear', stops, angle, aspect: 1, geom: null }; }
export function radialGradient(stops: GradientStop[]): Gradient { return { kind: 'radial', stops, angle: 0, aspect: 1, geom: null }; }
export const defaultGradient = (): Gradient => linearGradient([stop(0, WHITE), stop(1, BLACK)]);

export function freeformSampler(g: Gradient): (x: number, y: number) => RGB {
  const pts = g.points ?? [], cols = pts.map((p) => toRgb(p.color));
  const lines = g.mode === 'lines' && pts.length > 1;
  return (x, y) => {
    let sw = 0, r = 0, gg = 0, b = 0;
    const add = (d: number, w0: number, c: RGB): void => { const w = w0 / Math.max(1e-9, d * d * d); sw += w; r += c.r * w; gg += c.g * w; b += c.b * w; };
    if (lines) {
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dy = q.y - p.y, L = dx * dx + dy * dy;
        const t = L > 1e-9 ? Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / L)) : 0;
        const sp = Math.max(1, p.spread + (q.spread - p.spread) * t), d = Math.max(1e-3, Math.hypot(x - p.x - dx * t, y - p.y - dy * t) / sp);
        const a = cols[i], c = cols[i + 1];
        add(d, 1, { r: a.r + (c.r - a.r) * t, g: a.g + (c.g - a.g) * t, b: a.b + (c.b - a.b) * t });
      }
    } else pts.forEach((p, i) => add(Math.max(1e-3, Math.hypot(x - p.x, y - p.y) / Math.max(1, p.spread)), 1, cols[i]));
    return sw > 0 ? { r: r / sw, g: gg / sw, b: b / sw } : { r: 0, g: 0, b: 0 };
  };
}

export function freeformPixels(g: Gradient, b: { x: number; y: number; w: number; h: number }, W: number, H: number): Uint8ClampedArray<ArrayBuffer> {
  const px = new Uint8ClampedArray(W * H * 4), at = freeformSampler(g);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = at(b.x + ((x + 0.5) / W) * b.w, b.y + ((y + 0.5) / H) * b.h), k = (y * W + x) * 4;
    px[k] = c.r; px[k + 1] = c.g; px[k + 2] = c.b; px[k + 3] = 255;
  }
  return px;
}

export function freeformColorAt(g: Gradient, x: number, y: number): Color { const c = freeformSampler(g)(x, y); return rgb(Math.round(c.r), Math.round(c.g), Math.round(c.b)); }

export function freeformGradient(b: { x: number; y: number; w: number; h: number }, colors: Color[], mode: 'points' | 'lines' = 'points'): Gradient {
  const cs = colors.length ? colors : [rgb(255, 196, 0), rgb(255, 64, 129), rgb(64, 120, 255), rgb(0, 200, 170)];
  const spots = mode === 'lines'
    ? [[0.15, 0.25], [0.5, 0.5], [0.85, 0.75]]
    : [[0.2, 0.2], [0.8, 0.25], [0.75, 0.8], [0.25, 0.75]];
  const spread = Math.max(b.w, b.h) * 0.35;
  return { kind: 'freeform', stops: [], angle: 0, aspect: 1, geom: null, mode, points: spots.map(([u, v], i) => ({ x: b.x + b.w * u, y: b.y + b.h * v, color: cs[i % cs.length], spread })) };
}
export function gradientAt(g: Gradient, t: number): { color: Color; opacity: number } {
  const s = [...g.stops].sort((a, b) => a.offset - b.offset);
  if (!s.length) return { color: BLACK, opacity: 1 };
  if (t <= s[0].offset) return { color: s[0].color, opacity: s[0].opacity };
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i], b = s[i + 1];
    if (t <= b.offset) {
      let u = (t - a.offset) / Math.max(1e-9, b.offset - a.offset);
      const mid = Math.max(0.01, Math.min(0.99, a.mid));
      u = u < mid ? (u / mid) * 0.5 : 0.5 + ((u - mid) / (1 - mid)) * 0.5;
      return { color: g.blend === 'perceptual' ? mixOklab(a.color, b.color, u) : mixColor(a.color, b.color, u), opacity: a.opacity + (b.opacity - a.opacity) * u };
    }
  }
  const last = s[s.length - 1];
  return { color: last.color, opacity: last.opacity };
}

const srgbToLin = (v: number): number => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const linToSrgb = (v: number): number => clamp255(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055));
export function mixOklab(a: Color, b: Color, t: number): Color {
  const lab = (c: Color): [number, number, number] => {
    const v = toRgb(c), r = srgbToLin(v.r), g = srgbToLin(v.g), bl = srgbToLin(v.b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  const p = lab(a), q = lab(b), L = p[0] + (q[0] - p[0]) * t, A = p[1] + (q[1] - p[1]) * t, B = p[2] + (q[2] - p[2]) * t;
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return rgb(linToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), linToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), linToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s));
}

export function perceptualStops(g: Gradient, perSegment = 16): Array<{ t: number; color: Color; opacity: number }> | null {
  if (g.blend !== 'perceptual') return null;
  const s = [...g.stops].sort((a, b) => a.offset - b.offset), out: Array<{ t: number; color: Color; opacity: number }> = [];
  s.forEach((st, i) => {
    out.push({ t: st.offset, color: st.color, opacity: st.opacity });
    const nx = s[i + 1];
    if (nx) for (let k = 1; k < perSegment; k++) { const t = st.offset + ((nx.offset - st.offset) * k) / perSegment, v = gradientAt(g, t); out.push({ t, color: v.color, opacity: v.opacity }); }
  });
  return out;
}

export function setGradientBlend(g: Gradient, blend: 'linear' | 'perceptual'): Gradient { const { blend: _b, ...rest } = g; return blend === 'perceptual' ? { ...rest, blend } : rest; }
export function setGradientDither(g: Gradient, dither: boolean): Gradient { const { dither: _d, ...rest } = g; return dither ? { ...rest, dither: true } : rest; }

export function fill(paint: Paint, opacity = 1, blend: BlendMode = 'normal'): FillItem { return { kind: 'fill', paint, opacity, blend, visible: true, effects: [] }; }
export function stroke(paint: Paint, width = 1, patch: Partial<StrokeItem> = {}): StrokeItem {
  return { kind: 'stroke', paint, width, cap: 'butt', join: 'miter', miter: 10, align: 'center', dash: [], dashOffset: 0, dashCorners: false, startArrow: 'none', endArrow: 'none', arrowScale: [100, 100], arrowAlign: 'extend', profile: null, brush: null, opacity: 1, blend: 'normal', visible: true, effects: [], ...patch };
}
export function basicAppearance(fillPaint: Paint, strokePaint: Paint, width = 1): Appearance { return { items: [fill(fillPaint), stroke(strokePaint, width)], effects: [] }; }
export const emptyAppearance = (): Appearance => ({ items: [], effects: [] });
export const effect = (id: string, params: Effect['params'] = {}): Effect => ({ id, params, visible: true });

export function firstFill(ap: Appearance): FillItem | null { return (ap.items.find((i) => i.kind === 'fill') as FillItem | undefined) ?? null; }
export function firstStroke(ap: Appearance): StrokeItem | null { return (ap.items.find((i) => i.kind === 'stroke') as StrokeItem | undefined) ?? null; }
export function withFirstFill(ap: Appearance, paint: Paint): Appearance {
  const i = ap.items.findIndex((x) => x.kind === 'fill');
  if (i < 0) return { ...ap, items: [fill(paint), ...ap.items] };
  const items = ap.items.slice();
  items[i] = { ...(items[i] as FillItem), paint };
  return { ...ap, items };
}
export function withFirstStroke(ap: Appearance, patch: Partial<StrokeItem>): Appearance {
  const i = ap.items.findIndex((x) => x.kind === 'stroke');
  if (i < 0) return { ...ap, items: [...ap.items, stroke(patch.paint ?? solid(BLACK), patch.width ?? 1, patch)] };
  const items = ap.items.slice();
  items[i] = { ...(items[i] as StrokeItem), ...patch };
  return { ...ap, items };
}

export function resolvePaint(doc: Doc, p: Paint): Paint {
  if (p.type === 'color' && p.swatch) {
    const sw = doc.swatches.find((s) => s.id === p.swatch);
    if (sw && (sw.global || sw.spot) && sw.paint.type === 'color') return { type: 'color', color: tinted(sw.paint.color, p.tint ?? 100) };
  }
  if (p.type === 'gradient' && p.swatch) {
    const sw = doc.swatches.find((s) => s.id === p.swatch);
    if (sw && sw.global && sw.paint.type === 'gradient') return { ...p, gradient: { ...sw.paint.gradient, angle: p.gradient.angle, geom: p.gradient.geom, aspect: p.gradient.aspect, strokeMode: p.gradient.strokeMode } };
  }
  return p;
}

export function paintKey(p: Paint): string {
  if (p.type === 'none') return 'none';
  if (p.type === 'color') return `c:${hex(p.color)}`;
  if (p.type === 'gradient') return `g:${p.gradient.kind}:${p.gradient.stops.map((s) => `${s.offset}${hex(s.color)}${s.opacity}`).join(',')}`;
  return `p:${p.pattern}`;
}
export function paintColor(p: Paint): Color | null { return p.type === 'color' ? p.color : p.type === 'gradient' ? p.gradient.stops[0]?.color ?? null : null; }

export function paintFromInput(raw: unknown, doc?: Doc): Paint | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s || s.toLowerCase() === 'none' || s.toLowerCase() === 'transparent') return NONE;
    const sw = doc?.swatches.find((x) => x.name.toLowerCase() === s.toLowerCase());
    if (sw) return sw.global && sw.paint.type === 'color' ? { type: 'color', color: sw.paint.color, swatch: sw.id, tint: 100 } : sw.paint;
    const c = parseColor(s);
    return c ? solid(c) : null;
  }
  if (typeof raw === 'object') {
    const o = raw as { type?: string; angle?: number; stops?: Array<{ offset?: number; color?: string; opacity?: number; mid?: number }>; color?: string };
    if (o.type === 'linear' || o.type === 'radial') {
      const stops = (o.stops ?? []).map((st, i, arr) => stop(typeof st.offset === 'number' ? Math.max(0, Math.min(1, st.offset)) : i / Math.max(1, arr.length - 1), parseColor(String(st.color ?? '#000')) ?? BLACK, typeof st.opacity === 'number' ? st.opacity : 1, typeof st.mid === 'number' ? st.mid : 0.5));
      if (stops.length < 2) return null;
      return { type: 'gradient', gradient: o.type === 'linear' ? linearGradient(stops, o.angle ?? 0) : radialGradient(stops) };
    }
    if (typeof o.color === 'string') return paintFromInput(o.color, doc);
  }
  return null;
}

export function describePaint(p: Paint, doc?: Doc): string {
  if (p.type === 'none') return 'none';
  if (p.type === 'color') { const sw = p.swatch && doc ? doc.swatches.find((s) => s.id === p.swatch) : null; return sw ? `${sw.name} (${hex(p.color)})` : p.color.kind === 'cmyk' ? `cmyk(${p.color.c},${p.color.m},${p.color.y},${p.color.k})` : hex(p.color); }
  if (p.type === 'gradient') return `${p.gradient.kind} gradient ${p.gradient.stops.map((s) => hex(s.color)).join(' to ')}${p.gradient.strokeMode === 'along' || p.gradient.strokeMode === 'across' ? ` (${p.gradient.strokeMode} the stroke)` : ''}`;
  return `pattern ${p.pattern}`;
}

export function defaultSwatches(): Array<{ name: string; color: Color }> {
  const list: Array<[string, string]> = [
    ['White', '#ffffff'], ['Black', '#000000'], ['Red', '#e8261d'], ['Yellow', '#ffef00'], ['Green', '#00a650'], ['Cyan', '#00aeef'], ['Blue', '#2e3192'], ['Magenta', '#ec008c'],
    ['Orange', '#f7941d'], ['Pink', '#f49ac1'], ['Violet', '#662d91'], ['Teal', '#00a99d'], ['Olive', '#8dc63f'], ['Brown', '#8b5e3c'], ['Sand', '#c69c6d'], ['Navy', '#1b1464'],
    ['Gray 10', '#e6e6e6'], ['Gray 25', '#bfbfbf'], ['Gray 50', '#808080'], ['Gray 75', '#404040'], ['Accent', '#f97316'],
  ];
  return list.map(([name, h]) => ({ name, color: parseColor(h) ?? BLACK }));
}
