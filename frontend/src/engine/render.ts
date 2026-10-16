import { selectionBounds, strokeReach, visualBounds } from './bounds';
import { childrenOf } from './doc';
import { arrowGeometry, brushGeometry, effectPath, has3d, rasterEffects, rasterEffectsOf, rayTraceImage, strokeOutline, textureArt, textureTile, threeDFaces, TRACE_ID, type RasterFx } from './effects';
import { emptyRect, inflate, isEmptyRect, pathBounds, toPath2D, tracePath, transformRect } from './geometry';
import { liveChildren } from './live';
import { fxNode } from './groupfx';
import { plateValue } from './inks';
import { meshQuads } from './mesh';
import { rayTraced, textureOf } from './threed';
import { cssColor, freeformPixels, gray, gradientAt, perceptualStops, resolvePaint, toCmyk, toRgb } from './paint';
import { liveFaceNodes } from './livepaint';
import { derivedArt } from './shaper';
import { isLive } from './pathfinder';
import { latticeCopies, patternLattice } from './pattern';
import { instanceArt } from './symbolism';
import { runFilter, type FilterFrame } from './filters';
import { gradientStrokeArt, type GradientStrokeArt, type StrokePiece } from './stroke-gradient';
import { drawText, textEpoch } from './text';
import { BLEND_MODES, type AppearanceItem, type BlendMode, type Color, type Doc, type Gradient, type ImageNode, type Mat, type GroupNode, type Paint, type PathData, type PatternDef, type Pt, type Rect, type StrokeItem, type TraceView, type VNode } from './types';

export interface RenderContext {
  doc: Doc;
  scale: number;
  outline: boolean;
  assets: (key: string) => CanvasImageSource | null;
  skip?: Set<string>;
  printing?: boolean;
  pixelRatio?: number;
  outlineColor?: string;
  knockout?: boolean;
  overprint?: boolean;
  separation?: string | null;
}

function plateGray(rc: RenderContext, raw: Paint, c: Color): Color {
  const s = rc.separation;
  if (!s) return c;
  return gray(plateValue(rc.doc, raw, c, s));
}

const plateBlend = (rc: RenderContext, it: { overprint?: boolean; blend: BlendMode }): BlendMode => (rc.overprint && it.overprint && it.blend === 'normal' ? 'multiply' : it.blend);

export const knocksOut = (n: VNode, inherited: boolean): boolean => (n.kind === 'group' || n.kind === 'layer') && (n.knockout === 'inherit' ? inherited : n.knockout === true);

const pathCache = new WeakMap<PathData, Path2D>();
export function cachedPath(d: PathData): Path2D {
  let p = pathCache.get(d);
  if (!p) { p = toPath2D(d); pathCache.set(d, p); }
  return p;
}

const BLEND_CSS = new Map(BLEND_MODES.map((b) => [b.id, b.css]));
export const blendCss = (b: BlendMode): GlobalCompositeOperation => BLEND_CSS.get(b) ?? 'source-over';

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  return c;
}
export function canvas2d(w: number, h: number): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D } {
  const canvas = makeCanvas(w, h);
  return { canvas, ctx: canvas.getContext('2d') as unknown as CanvasRenderingContext2D };
}

function addStops(g: CanvasGradient, gr: Gradient, alpha: number): void {
  const stops = [...gr.stops].sort((a, b) => a.offset - b.offset);
  if (!stops.length) return;
  const pst = perceptualStops(gr);
  if (pst) { for (const s of pst) g.addColorStop(Math.max(0, Math.min(1, s.t)), cssColor(s.color, s.opacity * alpha)); return; }
  const put = (o: number): void => { const v = gradientAt(gr, o); g.addColorStop(Math.max(0, Math.min(1, o)), cssColor(v.color, v.opacity * alpha)); };
  for (let i = 0; i < stops.length; i++) {
    put(stops[i].offset);
    if (i < stops.length - 1 && Math.abs(stops[i].mid - 0.5) > 0.01) {
      for (let k = 1; k < 6; k++) put(stops[i].offset + ((stops[i + 1].offset - stops[i].offset) * k) / 6);
    }
  }
}

export function gradientGeom(gr: Gradient, b: Rect): { x1: number; y1: number; x2: number; y2: number; fx?: number; fy?: number } {
  if (gr.geom) return gr.geom;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, a = (gr.angle * Math.PI) / 180, dx = Math.cos(a), dy = -Math.sin(a);
  if (gr.kind === 'radial') { const r = Math.max(b.w, b.h) / 2; return { x1: cx, y1: cy, x2: cx + dx * r, y2: cy + dy * r }; }
  const half = (Math.abs(b.w * dx) + Math.abs(b.h * dy)) / 2;
  return { x1: cx - dx * half, y1: cy - dy * half, x2: cx + dx * half, y2: cy + dy * half };
}

export type Style = string | CanvasGradient | CanvasPattern;

const BAYER8 = (() => {
  const m = new Float32Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const lv = (b: number): number => { const xb = (x >> b) & 1, yb = (y >> b) & 1; return xb ? (yb ? 1 : 2) : yb ? 3 : 0; };
    m[y * 8 + x] = (16 * lv(0) + 4 * lv(1) + lv(2) + 0.5) / 64 - 0.5;
  }
  return m;
})();
const ditherCache = new Map<string, HTMLCanvasElement | OffscreenCanvas>();

function ditheredPattern(ctx: CanvasRenderingContext2D, rc: RenderContext, gr: Gradient, b: Rect, g: { x1: number; y1: number; x2: number; y2: number; fx?: number; fy?: number }, alpha: number): CanvasPattern | null {
  if (gr.kind === 'freeform' || g.fx !== undefined || b.w <= 0 || b.h <= 0) return null;
  let k = rc.scale * (rc.pixelRatio ?? 1);
  const px = (s: number): number => Math.max(1, Math.ceil(s * k));
  if (px(b.w) * px(b.h) > 16_000_000) k *= Math.sqrt(16_000_000 / (px(b.w) * px(b.h)));
  const w = px(b.w), h = px(b.h), key = JSON.stringify([gr.kind, gr.stops, gr.blend, gr.aspect, g, b, w, h, alpha]);
  let cv = ditherCache.get(key);
  if (!cv) {
    const N = 1024, lut = new Float32Array((N + 1) * 4);
    for (let i = 0; i <= N; i++) { const v = gradientAt(gr, i / N), c = toRgb(v.color); lut[i * 4] = c.r; lut[i * 4 + 1] = c.g; lut[i * 4 + 2] = c.b; lut[i * 4 + 3] = v.opacity * alpha * 255; }
    const made = canvas2d(w, h), img = made.ctx.createImageData(w, h), d = img.data;
    const dx = g.x2 - g.x1, dy = g.y2 - g.y1, L2 = Math.max(1e-9, dx * dx + dy * dy), R = Math.max(1e-9, Math.hypot(dx, dy)), asp = gr.aspect && gr.aspect > 0 ? gr.aspect : 1, kx = w / b.w, ky = h / b.h;
    for (let y = 0; y < h; y++) {
      const wy = b.y + (y + 0.5) / ky;
      for (let x = 0; x < w; x++) {
        const wx = b.x + (x + 0.5) / kx;
        const t = gr.kind === 'linear' ? ((wx - g.x1) * dx + (wy - g.y1) * dy) / L2 : Math.hypot(wx - g.x1, (wy - g.y1) / asp) / R;
        const f = Math.max(0, Math.min(1, t)) * N, i = Math.min(N - 1, Math.floor(f)), u = f - i, o = (y * w + x) * 4, th = BAYER8[(y & 7) * 8 + (x & 7)], a = i * 4, c = a + 4;
        d[o] = Math.round(lut[a] + (lut[c] - lut[a]) * u + th);
        d[o + 1] = Math.round(lut[a + 1] + (lut[c + 1] - lut[a + 1]) * u + th);
        d[o + 2] = Math.round(lut[a + 2] + (lut[c + 2] - lut[a + 2]) * u + th);
        d[o + 3] = Math.round(lut[a + 3] + (lut[c + 3] - lut[a + 3]) * u + th);
      }
    }
    made.ctx.putImageData(img, 0, 0);
    cv = made.canvas;
    if (ditherCache.size >= 6) ditherCache.delete(ditherCache.keys().next().value as string);
    ditherCache.set(key, cv);
  }
  const pat = ctx.createPattern(cv as CanvasImageSource, 'repeat');
  if (!pat) return null;
  pat.setTransform(new DOMMatrix([b.w / w, 0, 0, b.h / h, b.x, b.y]));
  return pat;
}

export function paintStyle(ctx: CanvasRenderingContext2D, rc: RenderContext, raw: Paint, b: Rect, alpha = 1): Style | null {
  const p = resolvePaint(rc.doc, raw);
  if (p.type === 'none') return null;
  if (p.type === 'color') return cssColor(plateGray(rc, raw, p.color), alpha);
  if (p.type === 'gradient') {
    const gr = rc.separation ? { ...p.gradient, stops: p.gradient.stops.map((s) => ({ ...s, color: plateGray(rc, p, s.color) })) } : p.gradient;
    if (gr.kind === 'freeform') { const v = gradientAt(gr, 0.5); return cssColor(v.color, alpha); }
    const g = gradientGeom(gr, b);
    if (gr.dither) { const dp = ditheredPattern(ctx, rc, gr, b, g, alpha); if (dp) return dp; }
    let cg: CanvasGradient;
    if (gr.kind === 'linear') cg = ctx.createLinearGradient(g.x1, g.y1, g.x2, g.y2);
    else { const r = Math.hypot(g.x2 - g.x1, g.y2 - g.y1); cg = ctx.createRadialGradient(g.fx ?? g.x1, g.fy ?? g.y1, 0, g.x1, g.y1, Math.max(1e-3, r)); }
    addStops(cg, gr, alpha);
    return cg;
  }
  return patternStyle(ctx, rc, p.pattern, p.xf, alpha);
}

const patternTiles = new Map<string, { key: string; def: PatternDef; canvas: HTMLCanvasElement | OffscreenCanvas; scale: number }>();
function patternStyle(ctx: CanvasRenderingContext2D, rc: RenderContext, id: string, xf: Mat, alpha: number): Style | null {
  const def = rc.doc.patterns.find((p) => p.id === id);
  if (!def || def.tile.w <= 0 || def.tile.h <= 0) return null;
  const scale = Math.min(8, Math.max(1, rc.scale * (rc.pixelRatio ?? 1) * (Math.sqrt(Math.abs(xf[0] * xf[3] - xf[1] * xf[2])) || 1)));
  const key = `${def.id}:${scale.toFixed(2)}`;
  let tile = patternTiles.get(def.id);
  const stamp = key;
  if (!tile || tile.key !== stamp || tile.def !== def) {
    const l = patternLattice(def);
    const w = Math.ceil(l.w * scale), h = Math.ceil(l.h * scale);
    const { canvas, ctx: t } = canvas2d(Math.min(4096, w), Math.min(4096, h));
    t.scale(scale, scale);
    t.translate(-def.tile.x, -def.tile.y);
    for (const o of latticeCopies(def, 1)) { t.save(); t.translate(o.x, o.y); renderNode(t, def.art, { ...rc, scale }); t.restore(); }
    tile = { key: stamp, def, canvas, scale };
    patternTiles.set(def.id, tile);
  }
  const pat = ctx.createPattern(tile.canvas as CanvasImageSource, 'repeat');
  if (!pat) return null;
  const m = new DOMMatrix([xf[0], xf[1], xf[2], xf[3], xf[4], xf[5]]).multiply(new DOMMatrix([1 / tile.scale, 0, 0, 1 / tile.scale, def.tile.x, def.tile.y]));
  pat.setTransform(m);
  void alpha;
  return pat;
}

function deviceRect(ctx: CanvasRenderingContext2D, r: Rect): Rect | null {
  const t = ctx.getTransform();
  const m: Mat = [t.a, t.b, t.c, t.d, t.e, t.f];
  const d = transformRect(r, m);
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const x0 = Math.max(0, Math.floor(d.x)), y0 = Math.max(0, Math.floor(d.y)), x1 = Math.min(W, Math.ceil(d.x + d.w)), y1 = Math.min(H, Math.ceil(d.y + d.h));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

let layerEpoch = 0;
export function invalidateLayers(): void { layerEpoch++; }
const layerCache = new WeakMap<object, { doc: object; skip: object | undefined; key: string; canvas: HTMLCanvasElement | OffscreenCanvas }>();

function wholeRect(ctx: CanvasRenderingContext2D, m: Mat, r: Rect): Rect | null {
  const d = transformRect(r, m), W = ctx.canvas.width, H = ctx.canvas.height;
  const x0 = Math.floor(d.x), y0 = Math.floor(d.y), x1 = Math.ceil(d.x + d.w), y1 = Math.ceil(d.y + d.h);
  if (x1 <= Math.max(0, x0) || y1 <= Math.max(0, y0) || x0 >= W || y0 >= H) return null;
  if ((x1 - x0) * (y1 - y0) > 6e6) { const cx0 = Math.max(0, x0), cy0 = Math.max(0, y0), cx1 = Math.min(W, x1), cy1 = Math.min(H, y1); return cx1 > cx0 && cy1 > cy0 ? { x: cx0, y: cy0, w: cx1 - cx0, h: cy1 - cy0 } : null; }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function withLayer(ctx: CanvasRenderingContext2D, bounds: Rect, opts: { opacity: number; blend: BlendMode; fx?: RasterFx[]; mask?: ((c: CanvasRenderingContext2D) => void) | null; maskInvert?: boolean; cache?: { node: object; doc: object; skip?: object } }, draw: (c: CanvasRenderingContext2D) => void): void {
  const margin = (opts.fx ?? []).reduce((m, f) => Math.max(m, f.reach), 0);
  const t = ctx.getTransform(), heavy = !!opts.cache && !!opts.fx?.some((f) => f.kind === 'filter');
  const ex = heavy ? Math.round(t.e) : t.e, ey = heavy ? Math.round(t.f) : t.f;
  const dev = heavy ? wholeRect(ctx, [t.a, t.b, t.c, t.d, ex, ey], inflate(bounds, margin)) : deviceRect(ctx, inflate(bounds, margin));
  if (!dev) return;
  const key = heavy ? `${layerEpoch},${textEpoch()},${t.a},${t.b},${t.c},${t.d},${ex - dev.x},${ey - dev.y},${dev.w},${dev.h}` : '';
  const hit = heavy && opts.cache ? layerCache.get(opts.cache.node) : undefined;
  let canvas = hit && opts.cache && hit.doc === opts.cache.doc && hit.skip === opts.cache.skip && hit.key === key ? hit.canvas : null;
  if (!canvas) {
    const made = canvas2d(dev.w, dev.h), off = made.ctx;
    off.setTransform(t.a, t.b, t.c, t.d, ex - dev.x, ey - dev.y);
    draw(off);
    if (opts.fx && opts.fx.length) { const tb = transformRect(bounds, [t.a, t.b, t.c, t.d, ex - dev.x, ey - dev.y]); applyFx(off, made.canvas, opts.fx, Math.hypot(t.a, t.b), { scale: Math.hypot(t.a, t.b), x: tb.x, y: tb.y, w: tb.w, h: tb.h }); }
    if (opts.mask) {
      const { canvas: mc, ctx: m } = canvas2d(dev.w, dev.h);
      m.setTransform(t.a, t.b, t.c, t.d, ex - dev.x, ey - dev.y);
      opts.mask(m);
      const img = m.getImageData(0, 0, dev.w, dev.h), px = img.data;
      for (let i = 0; i < px.length; i += 4) {
        const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255, a = (px[i + 3] / 255) * lum;
        px[i] = px[i + 1] = px[i + 2] = 0;
        px[i + 3] = Math.round((opts.maskInvert ? 1 - a : a) * 255);
      }
      m.putImageData(img, 0, 0);
      off.setTransform(1, 0, 0, 1, 0, 0);
      off.globalCompositeOperation = 'destination-in';
      off.drawImage(mc as CanvasImageSource, 0, 0);
    }
    canvas = made.canvas;
    if (heavy && opts.cache) layerCache.set(opts.cache.node, { doc: opts.cache.doc, skip: opts.cache.skip, key, canvas });
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= opts.opacity;
  ctx.globalCompositeOperation = blendCss(opts.blend);
  ctx.drawImage(canvas as CanvasImageSource, dev.x, dev.y);
  ctx.restore();
}

function boxBlur(img: ImageData, r: number): void {
  if (r < 1) return;
  const { width: w, height: h, data } = img, tmp = new Uint8ClampedArray(data.length), rad = Math.round(r);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      for (let c = 0; c < 4; c++) {
        let acc = 0;
        for (let x = -rad; x <= rad; x++) acc += data[(y * w + Math.min(w - 1, Math.max(0, x))) * 4 + c];
        for (let x = 0; x < w; x++) {
          tmp[(y * w + x) * 4 + c] = acc / (2 * rad + 1);
          acc += data[(y * w + Math.min(w - 1, x + rad + 1)) * 4 + c] - data[(y * w + Math.max(0, x - rad)) * 4 + c];
        }
      }
    }
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 4; c++) {
        let acc = 0;
        for (let y = -rad; y <= rad; y++) acc += tmp[(Math.min(h - 1, Math.max(0, y)) * w + x) * 4 + c];
        for (let y = 0; y < h; y++) {
          data[(y * w + x) * 4 + c] = acc / (2 * rad + 1);
          acc += tmp[(Math.min(h - 1, y + rad + 1) * w + x) * 4 + c] - tmp[(Math.max(0, y - rad) * w + x) * 4 + c];
        }
      }
    }
  }
}

let filterProbe: boolean | null = null;
function canFilterNow(): boolean {
  if (filterProbe !== null) return filterProbe;
  try {
    const { ctx: c } = canvas2d(9, 9);
    c.filter = 'blur(2px)';
    c.fillStyle = '#fff';
    c.fillRect(4, 4, 1, 1);
    filterProbe = c.getImageData(2, 4, 1, 1).data[3] > 0;
  } catch { filterProbe = false; }
  return filterProbe;
}

function blurred(src: HTMLCanvasElement | OffscreenCanvas, radiusPx: number): HTMLCanvasElement | OffscreenCanvas {
  const { canvas, ctx } = canvas2d(src.width, src.height);
  if (radiusPx <= 0.3) { ctx.drawImage(src as CanvasImageSource, 0, 0); return canvas; }
  if (canFilterNow()) { ctx.filter = `blur(${radiusPx}px)`; ctx.drawImage(src as CanvasImageSource, 0, 0); ctx.filter = 'none'; return canvas; }
  ctx.drawImage(src as CanvasImageSource, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  boxBlur(img, radiusPx * 0.58);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function tintedSilhouette(src: HTMLCanvasElement | OffscreenCanvas, color: string): HTMLCanvasElement | OffscreenCanvas {
  const { canvas, ctx } = canvas2d(src.width, src.height);
  ctx.drawImage(src as CanvasImageSource, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function applyFx(off: CanvasRenderingContext2D, canvas: HTMLCanvasElement | OffscreenCanvas, fx: RasterFx[], scale: number, frame: FilterFrame): void {
  const art = makeCanvas(canvas.width, canvas.height);
  (art.getContext('2d') as unknown as CanvasRenderingContext2D).drawImage(canvas as CanvasImageSource, 0, 0);
  let result: HTMLCanvasElement | OffscreenCanvas = art;
  for (const f of fx) {
    const r = f.blur * scale;
    const { canvas: out, ctx: o } = canvas2d(canvas.width, canvas.height);
    if (f.kind === 'blur') { o.drawImage(blurred(result, r) as CanvasImageSource, 0, 0); }
    else if (f.kind === 'drop_shadow' || f.kind === 'outer_glow') {
      const sil = blurred(tintedSilhouette(result, f.color), r);
      o.globalAlpha = f.opacity;
      o.globalCompositeOperation = blendCss(f.blend);
      o.drawImage(sil as CanvasImageSource, f.dx * scale, f.dy * scale);
      o.globalAlpha = 1;
      o.globalCompositeOperation = 'source-over';
      o.drawImage(result as CanvasImageSource, 0, 0);
    } else if (f.kind === 'inner_glow') {
      o.drawImage(result as CanvasImageSource, 0, 0);
      const { canvas: inv, ctx: iv } = canvas2d(canvas.width, canvas.height);
      iv.fillStyle = f.color; iv.fillRect(0, 0, inv.width, inv.height);
      iv.globalCompositeOperation = 'destination-out';
      iv.drawImage(result as CanvasImageSource, 0, 0);
      const glow = blurred(inv, r);
      const { canvas: g2, ctx: gc } = canvas2d(canvas.width, canvas.height);
      gc.drawImage(glow as CanvasImageSource, 0, 0);
      gc.globalCompositeOperation = 'destination-in';
      gc.drawImage(result as CanvasImageSource, 0, 0);
      o.globalAlpha = f.opacity;
      o.globalCompositeOperation = blendCss(f.blend);
      o.drawImage(g2 as CanvasImageSource, 0, 0);
    } else if (f.kind === 'feather') {
      const { canvas: alpha, ctx: ac } = canvas2d(canvas.width, canvas.height);
      ac.drawImage(result as CanvasImageSource, 0, 0);
      const soft = blurred(alpha, r);
      o.drawImage(result as CanvasImageSource, 0, 0);
      o.globalCompositeOperation = 'destination-in';
      o.drawImage(soft as CanvasImageSource, 0, 0);
    } else if (f.kind === 'filter' && f.filter) {
      o.drawImage(result as CanvasImageSource, 0, 0);
      const img = o.getImageData(0, 0, out.width, out.height);
      runFilter(f.filter.id, f.filter.params, img, frame);
      o.putImageData(img, 0, 0);
    }
    result = out;
  }
  off.save();
  off.setTransform(1, 0, 0, 1, 0, 0);
  off.globalCompositeOperation = 'copy';
  off.drawImage(result as CanvasImageSource, 0, 0);
  off.restore();
}

function strokeWith(ctx: CanvasRenderingContext2D, rc: RenderContext, path: Path2D, d: PathData, s: StrokeItem, b: Rect, rule: CanvasFillRule, solo = false): void {
  const style = paintStyle(ctx, rc, s.paint, b);
  if (!style || s.width <= 0) return;
  const art = gradientStrokeArt(rc.doc, d, s, rule);
  if (art) { gradientStroke(ctx, rc, art, path, d, s, b, rule, solo); return; }
  ctx.save();
  if (!solo) { ctx.globalAlpha *= s.opacity; ctx.globalCompositeOperation = blendCss(plateBlend(rc, s)); }
  if (s.brush) {
    const g = brushGeometry(rc.doc, d, s);
    if (g) {
      ctx.fillStyle = style;
      const a0 = ctx.globalAlpha;
      for (const part of g) { ctx.fillStyle = part.paint ? (paintStyle(ctx, rc, part.paint, b) ?? style) : style; ctx.globalAlpha = a0 * (part.opacity ?? 1); ctx.fill(cachedPath(part.d), 'nonzero'); }
      ctx.globalAlpha = a0;
      ctx.restore();
      return;
    }
  }
  strokeShape(ctx, style, path, d, s, b, rule);
  const arrows = arrowGeometry(d, s);
  if (arrows) { ctx.setLineDash([]); ctx.fillStyle = style; ctx.fill(cachedPath(arrows), 'nonzero'); }
  ctx.restore();
}

function strokeShape(ctx: CanvasRenderingContext2D, style: Style, path: Path2D, d: PathData, s: StrokeItem, b: Rect, rule: CanvasFillRule): void {
  if (s.profile && s.profile.length) {
    ctx.fillStyle = style;
    ctx.fill(cachedPath(strokeOutline(d, s)), 'nonzero');
    return;
  }
  ctx.strokeStyle = style;
  ctx.lineWidth = s.width;
  ctx.lineCap = s.cap;
  ctx.lineJoin = s.join;
  ctx.miterLimit = s.miter;
  ctx.setLineDash(s.dash.length ? s.dash : []);
  ctx.lineDashOffset = s.dashOffset;
  const closed = d.every((sp) => sp.closed);
  if (s.align === 'inside' && closed) { ctx.clip(path, rule); ctx.lineWidth = s.width * 2; ctx.stroke(path); }
  else if (s.align === 'outside' && closed) {
    const big = new Path2D(), r = inflate(b, s.width * 4 + 10);
    big.rect(r.x, r.y, r.w, r.h);
    tracePath(big, d);
    ctx.clip(big, 'evenodd');
    ctx.lineWidth = s.width * 2;
    ctx.stroke(path);
  } else ctx.stroke(path);
}

function gradientStroke(ctx: CanvasRenderingContext2D, rc: RenderContext, art: GradientStrokeArt, path: Path2D, d: PathData, s: StrokeItem, b: Rect, rule: CanvasFillRule, solo: boolean): void {
  const box = inflate(pathBounds(d), strokeReach(s) + s.width + 2);
  const fillAll = (c: CanvasRenderingContext2D, list: StrokePiece[]): void => { for (const p of list) { const st = paintStyle(c, rc, p.paint, b); if (st) { c.fillStyle = st; c.fill(cachedPath(p.d), 'nonzero'); } } };
  const keep = (c: CanvasRenderingContext2D): void => {
    const t = c.getTransform(), { canvas: sc, ctx: m } = canvas2d(c.canvas.width, c.canvas.height);
    m.setTransform(t);
    strokeShape(m, '#fff', path, d, s, b, rule);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(sc as CanvasImageSource, 0, 0);
    c.restore();
  };
  const alpha = art.alpha;
  withLayer(ctx, box, { opacity: solo ? 1 : s.opacity, blend: solo ? 'normal' : s.blend, mask: alpha ? (m) => { fillAll(m, alpha); keep(m); } : null }, (c) => { fillAll(c, art.pieces); if (!alpha) keep(c); });
  if (!art.arrows.length) return;
  ctx.save();
  if (!solo) { ctx.globalAlpha *= s.opacity; ctx.globalCompositeOperation = blendCss(s.blend); }
  fillAll(ctx, art.arrows);
  ctx.restore();
}

const bareVariants = new WeakMap<VNode, VNode>();
function inflateTextured(ctx: CanvasRenderingContext2D, rc: RenderContext, n: VNode, d: PathData, rule: CanvasFillRule): VNode {
  if (rc.outline) return n;
  const fx = n.ap.effects.find((e) => e.visible && e.id === '3d.inflate'), T = fx ? textureOf(fx.params) : null;
  if (!T) return n;
  const ta = textureArt(rc.doc, T.ref), b = pathBounds(d);
  if (!ta || isEmptyRect(b)) return n;
  const fillItem = n.ap.items.find((i) => i.visible && i.kind === 'fill'), tile = textureTile(ta.b, Math.max(b.w, b.h, 1), T.scale), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const half = Math.min(10, Math.ceil((Math.hypot(b.w, b.h) / 2 + Math.hypot(T.ox, T.oy)) / Math.min(tile.w, tile.h))), near = Math.hypot(b.w, b.h) / 2 + Math.hypot(tile.w, tile.h) / 2 + Math.hypot(T.ox, T.oy);
  ctx.save();
  ctx.clip(cachedPath(d), rule);
  if (fillItem) ctx.globalAlpha *= fillItem.opacity;
  for (let j = -half; j <= half; j++) for (let i = -half; i <= half; i++) {
    if (Math.hypot(i * tile.w, j * tile.h) > near) continue;
    ctx.save();
    ctx.translate(cx + T.ox, cy + T.oy);
    ctx.rotate((-T.rot * Math.PI) / 180);
    ctx.translate(i * tile.w, j * tile.h);
    ctx.scale(tile.w / ta.b.w, tile.h / ta.b.h);
    ctx.translate(-(ta.b.x + ta.b.w / 2), -(ta.b.y + ta.b.h / 2));
    renderNode(ctx, ta.art, { ...rc, skip: undefined });
    ctx.restore();
  }
  ctx.restore();
  let v = bareVariants.get(n);
  if (!v) { v = { ...n, ap: { ...n.ap, items: n.ap.items.filter((i) => i !== fillItem) } } as VNode; bareVariants.set(n, v); }
  return v;
}

function drawShapeItems(ctx: CanvasRenderingContext2D, rc: RenderContext, n: VNode, d: PathData, rule: CanvasFillRule): void {
  const path = cachedPath(d), b = selectionBounds(rc.doc, [n]);
  if (rc.outline) { outlineStroke(ctx, rc, path); return; }
  for (const it of n.ap.items) {
    if (!it.visible) continue;
    const id = itemGeometry(d, it.effects);
    const ip = id === d ? path : cachedPath(id);
    const fx = it.effects.length ? rasterEffectsOf(it.effects) : [];
    if (fx.length) {
      const box = inflate(pathBounds(id), it.kind === 'stroke' ? strokeReach(it) : 0);
      if (!isEmptyRect(box)) withLayer(ctx, box, { opacity: it.opacity, blend: it.blend, fx, cache: fx.some((f) => f.kind === 'filter') ? { node: itemKey(id, it), doc: rc.doc, skip: rc.skip } : undefined }, (c) => drawItem(c, rc, it, id, ip, b, rule, true));
      continue;
    }
    drawItem(ctx, rc, it, id, ip, b, rule, false);
  }
}

const itemKeys = new WeakMap<PathData, WeakMap<AppearanceItem, object>>();
function itemKey(d: PathData, it: AppearanceItem): object {
  let m = itemKeys.get(d);
  if (!m) { m = new WeakMap(); itemKeys.set(d, m); }
  let k = m.get(it);
  if (!k) { k = {}; m.set(it, k); }
  return k;
}

function drawItem(ctx: CanvasRenderingContext2D, rc: RenderContext, it: AppearanceItem, id: PathData, ip: Path2D, b: Rect, rule: CanvasFillRule, solo: boolean): void {
  if (it.kind === 'stroke') { strokeWith(ctx, rc, ip, id, it, b, rule, solo); return; }
  const p = rc.doc ? resolvePaint(rc.doc, it.paint) : it.paint;
  if (p.type === 'gradient' && p.gradient.kind === 'freeform') { drawFreeform(ctx, rc, ip, rule, p.gradient, b, solo ? 1 : it.opacity, solo ? 'normal' : it.blend); return; }
  const style = paintStyle(ctx, rc, it.paint, b);
  if (!style) return;
  ctx.save();
  if (!solo) { ctx.globalAlpha *= it.opacity; ctx.globalCompositeOperation = blendCss(plateBlend(rc, it)); }
  ctx.fillStyle = style;
  ctx.fill(ip, rule);
  ctx.restore();
}

function itemGeometry(d: PathData, effects: StrokeItem['effects']): PathData {
  if (!effects.length || effects.every((e) => !e.visible)) return d;
  return effectPath(d, effects);
}

function outlineStroke(ctx: CanvasRenderingContext2D, rc: RenderContext, path: Path2D): void {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rc.outlineColor ?? '#000';
  ctx.lineWidth = 1 / Math.max(1e-6, rc.scale * (rc.pixelRatio ?? 1));
  ctx.setLineDash([]);
  ctx.stroke(path);
  ctx.restore();
}

const ffCache = new WeakMap<Gradient, { key: string; canvas: HTMLCanvasElement | OffscreenCanvas }>();
function drawFreeform(ctx: CanvasRenderingContext2D, rc: RenderContext, path: Path2D, rule: CanvasFillRule, gr: Gradient, b: Rect, opacity: number, blend: BlendMode): void {
  const pts = gr.points ?? [];
  if (!pts.length || isEmptyRect(b)) return;
  const res = Math.max(8, Math.min(256, Math.ceil(Math.max(b.w, b.h) * rc.scale * 0.5)));
  const W = Math.max(2, Math.round((res * b.w) / Math.max(b.w, b.h))), H = Math.max(2, Math.round((res * b.h) / Math.max(b.w, b.h)));
  const key = `${b.x},${b.y},${b.w},${b.h},${W},${H}`, hit = ffCache.get(gr);
  let canvas = hit && hit.key === key ? hit.canvas : null;
  if (!canvas) {
    const made = canvas2d(W, H), img = made.ctx.createImageData(W, H);
    img.data.set(freeformPixels(gr, b, W, H));
    made.ctx.putImageData(img, 0, 0);
    canvas = made.canvas;
    ffCache.set(gr, { key, canvas });
  }
  ctx.save();
  ctx.clip(path, rule);
  ctx.globalAlpha *= opacity;
  ctx.globalCompositeOperation = blendCss(blend);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvas as CanvasImageSource, b.x, b.y, b.w, b.h);
  ctx.restore();
}

function drawnFx(n: VNode): RasterFx[] {
  const fx = rasterEffects(n);
  return fx.some((f) => f.filter?.id === TRACE_ID) ? fx.filter((f) => f.filter?.id !== TRACE_ID) : fx;
}

const traceCanvas = new WeakMap<Uint8ClampedArray, HTMLCanvasElement | OffscreenCanvas>();
function drawTraced(ctx: CanvasRenderingContext2D, n: VNode, rc: RenderContext): boolean {
  const region = visualBounds(rc.doc, n);
  if (isEmptyRect(region)) return false;
  const paint = (art: VNode, b: Rect, w: number, h: number): Uint8ClampedArray | null | 'pending' => {
    const made = canvas2d(w, h);
    let missing = false;
    made.ctx.setTransform(w / b.w, 0, 0, h / b.h, -b.x * (w / b.w), -b.y * (h / b.h));
    renderNode(made.ctx, art, { ...rc, skip: undefined, outline: false, assets: (k) => { const a = rc.assets(k); if (!a) missing = true; return a; } });
    return missing ? 'pending' : made.ctx.getImageData(0, 0, w, h).data;
  };
  const t = ctx.getTransform(), r = rayTraceImage(rc.doc, n, region, Math.hypot(t.a, t.b), !!rc.printing, paint);
  if (!r) return false;
  let cv = traceCanvas.get(r.data);
  if (!cv) {
    const made = canvas2d(r.w, r.h);
    made.ctx.putImageData(new ImageData(r.data as Uint8ClampedArray<ArrayBuffer>, r.w, r.h), 0, 0);
    cv = made.canvas;
    traceCanvas.set(r.data, cv);
  }
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cv as CanvasImageSource, region.x, region.y, region.w, region.h);
  ctx.restore();
  return true;
}

function needsLayer(n: VNode, multi: boolean, rc: RenderContext): boolean {
  return (n.opacity < 1 && multi) || n.blend !== 'normal' || !!(n.mask && !n.mask.disabled) || drawnFx(n).length > 0 || !!n.isolate || knocksOut(n, !!rc.knockout);
}

const shapeVariants = new WeakMap<VNode, VNode>();
export function knockoutShape(n: VNode): VNode {
  if (n.knockoutShape || (n.opacity >= 1 && !(n.mask && !n.mask.disabled))) return n;
  let v = shapeVariants.get(n);
  if (!v) { v = { ...n, opacity: 1, mask: null } as VNode; shapeVariants.set(n, v); }
  return v;
}

function drawKnockout(ctx: CanvasRenderingContext2D, kids: VNode[], rc: RenderContext): void {
  const t = ctx.getTransform();
  for (const c of kids) {
    if (c.hidden || rc.skip?.has(c.id)) continue;
    const vb = visualBounds(rc.doc, c);
    const dev = isEmptyRect(vb) ? null : deviceRect(ctx, inflate(vb, 2 / Math.max(1e-6, Math.hypot(t.a, t.b))));
    if (!dev) continue;
    const draw = (n: VNode): HTMLCanvasElement | OffscreenCanvas => { const { canvas, ctx: o } = canvas2d(dev.w, dev.h); o.setTransform(t.a, t.b, t.c, t.d, t.e - dev.x, t.f - dev.y); renderNode(o, n, rc); return canvas; };
    const art = draw(c), sv = knockoutShape(c), shape = sv === c ? art : draw(sv);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(shape as CanvasImageSource, dev.x, dev.y);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(art as CanvasImageSource, dev.x, dev.y);
    ctx.restore();
  }
}

function drawKids(ctx: CanvasRenderingContext2D, n: VNode, kids: VNode[], rc: RenderContext): void {
  const ko = knocksOut(n, !!rc.knockout), sub = ko === !!rc.knockout ? rc : { ...rc, knockout: ko };
  if (ko && !rc.outline) { drawKnockout(ctx, kids, sub); return; }
  for (const c of kids) renderNode(ctx, c, sub);
}

export function renderNode(ctx: CanvasRenderingContext2D, n: VNode, rc: RenderContext): void {
  if (n.hidden || rc.skip?.has(n.id)) return;
  if (rc.printing && n.kind === 'layer' && (n.printable === false || n.template)) return;
  if (n.ap.effects.length) n = fxNode(rc.doc, n) ?? n;
  const fx = rc.outline ? [] : drawnFx(n);
  const ch = n.kind === 'compound' ? null : childrenOf(n);
  const multi = !!ch || n.ap.items.filter((i) => i.visible).length > 1 || n.kind === 'text' || n.kind === 'symbol' || n.kind === 'mesh' || has3d(n);
  if (!rc.outline && needsLayer(n, multi, rc)) {
    const vb = visualBounds(rc.doc, n);
    if (isEmptyRect(vb)) return;
    const mask = n.mask && !n.mask.disabled ? (c: CanvasRenderingContext2D) => renderNode(c, n.mask!.art, { ...rc, skip: undefined }) : null;
    const clipMask = n.mask && !n.mask.disabled && n.mask.clip;
    withLayer(ctx, clipMask ? visualBounds(rc.doc, n.mask!.art) : vb, { opacity: n.opacity, blend: n.blend, fx, mask, maskInvert: !!n.mask?.invert, cache: { node: n, doc: rc.doc, skip: rc.skip } }, (c) => drawBody(c, n, rc));
    return;
  }
  ctx.save();
  if (n.opacity < 1 && !rc.outline) ctx.globalAlpha *= n.opacity;
  drawBody(ctx, n, rc);
  ctx.restore();
}

function drawBody(ctx: CanvasRenderingContext2D, n: VNode, rc: RenderContext): void {
  if (!rc.outline && n.kind !== 'layer' && has3d(n)) {
    if (n.ap.effects.some((e) => rayTraced(e)) && drawTraced(ctx, n, rc)) return;
    const faces = threeDFaces(rc.doc, n);
    if (faces) { for (const f of faces) renderNode(ctx, f, rc); return; }
  }
  switch (n.kind) {
    case 'layer': {
      if (n.template && !rc.printing) { ctx.save(); ctx.globalAlpha *= 0.5; for (const c of n.children) renderNode(ctx, c, rc); ctx.restore(); return; }
      if (n.clip && n.children.length > 1) { drawClipped(ctx, n, n.children, rc); return; }
      drawKids(ctx, n, n.children, rc);
      if (n.ap.items.length && !rc.outline) drawGroupItems(ctx, n, rc);
      return;
    }
    case 'group':
      if (n.trace && !rc.outline && !rc.printing && n.trace.view !== 'result') { drawTraceView(ctx, n, n.trace.view, rc); return; }
      if (n.livePaint) { if (!rc.outline) for (const f of liveFaceNodes(n)) renderNode(ctx, f, rc); for (const c of n.children) renderNode(ctx, c, rc); return; }
      if (n.shaper || n.intertwine || isLive(n)) { for (const c of derivedArt(n, rc.outline) ?? []) renderNode(ctx, c, rc); return; }
      if (n.clip && n.children.length > 1) { drawClipped(ctx, n, n.children, rc); return; }
      drawKids(ctx, n, n.children, rc);
      if (n.ap.items.length && !rc.outline) drawGroupItems(ctx, n, rc);
      return;
    case 'blend': case 'envelope': case 'repeat':
      for (const c of liveChildren(rc.doc, n)) renderNode(ctx, c, rc);
      if (rc.outline && n.kind === 'blend' && n.spec.spine) outlineStroke(ctx, rc, cachedPath(n.spec.spine));
      return;
    case 'path': {
      const d = effectPath(n.d, n.ap.effects);
      if (n.guide) return;
      drawShapeItems(ctx, rc, inflateTextured(ctx, rc, n, d, n.rule), d, n.rule);
      return;
    }
    case 'compound': {
      const d = effectPath(n.children.flatMap((c) => c.d), n.ap.effects);
      drawShapeItems(ctx, rc, inflateTextured(ctx, rc, n, d, n.rule), d, n.rule);
      return;
    }
    case 'text': {
      if (rc.outline) { drawText(ctx, n, () => rc.outlineColor ?? '#000', []); return; }
      const b = selectionBounds(rc.doc, [n]);
      const extra = n.ap.items.filter((i) => i.visible && i.kind === 'fill').map((i) => paintStyle(ctx, rc, i.paint, b, i.opacity)).filter((s): s is Style => !!s);
      drawText(ctx, n, (p, bb) => paintStyle(ctx, rc, p, bb), extra);
      return;
    }
    case 'image': {
      const img = rc.assets(n.src);
      if (n.warp) {
        if (rc.outline || !img) { const w = n.warp, row = (j: number): Pt[] => Array.from({ length: w.cols + 1 }, (_, i) => w.pts[j * (w.cols + 1) + i]), col = (i: number): Pt[] => Array.from({ length: w.rows + 1 }, (_, j) => w.pts[j * (w.cols + 1) + i]); const ring = [...row(0), ...col(w.cols), ...row(w.rows).reverse(), ...col(0).reverse()], p = new Path2D(); ring.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y))); p.closePath(); outlineStroke(ctx, rc, p); return; }
        drawWarpedImage(ctx, img, n, rc.scale * (rc.pixelRatio ?? 1));
        return;
      }
      ctx.save();
      ctx.transform(n.xf[0], n.xf[1], n.xf[2], n.xf[3], n.xf[4], n.xf[5]);
      if (rc.outline || !img) {
        ctx.strokeStyle = rc.outlineColor ?? '#000';
        ctx.lineWidth = 1 / Math.max(1e-6, rc.scale * Math.hypot(n.xf[0], n.xf[1]));
        ctx.strokeRect(0, 0, n.w, n.h);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(n.w, n.h); ctx.moveTo(n.w, 0); ctx.lineTo(0, n.h); ctx.stroke();
      } else {
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, n.w, n.h);
      }
      ctx.restore();
      return;
    }
    case 'symbol': {
      const art = instanceArt(rc.doc, n);
      if (!art) return;
      ctx.save();
      ctx.transform(n.xf[0], n.xf[1], n.xf[2], n.xf[3], n.xf[4], n.xf[5]);
      renderNode(ctx, art, rc);
      ctx.restore();
      return;
    }
    case 'mesh': {
      if (rc.outline) { for (const q of meshQuads(n, 1)) { const p = new Path2D(); p.moveTo(q.pts[0].x, q.pts[0].y); for (const v of q.pts.slice(1)) p.lineTo(v.x, v.y); p.closePath(); outlineStroke(ctx, rc, p); } return; }
      const b = selectionBounds(rc.doc, [n]);
      const level = Math.max(3, Math.min(24, Math.ceil((Math.max(b.w, b.h) * rc.scale) / Math.max(1, Math.max(n.rows, n.cols)) / 6)));
      const grow = 0.6 / Math.max(1e-6, rc.scale * (rc.pixelRatio ?? 1));
      for (const q of meshQuads(n, level)) {
        ctx.fillStyle = cssColor(q.color, q.opacity);
        ctx.beginPath();
        const cx = (q.pts[0].x + q.pts[2].x) / 2, cy = (q.pts[0].y + q.pts[2].y) / 2;
        q.pts.forEach((v, i) => { const dx = v.x - cx, dy = v.y - cy, l = Math.hypot(dx, dy) || 1, x = v.x + (dx / l) * grow, y = v.y + (dy / l) * grow; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.closePath();
        ctx.fill();
      }
      return;
    }
  }
}

function drawTraceView(ctx: CanvasRenderingContext2D, n: GroupNode, view: TraceView, rc: RenderContext): void {
  const src = n.trace?.src;
  if (src && (view === 'source' || view === 'outlines_source')) { ctx.save(); if (view === 'outlines_source') ctx.globalAlpha *= 0.5; renderNode(ctx, src, rc); ctx.restore(); }
  if (view === 'result_outlines') for (const c of n.children) renderNode(ctx, c, rc);
  if (view === 'source') return;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = view === 'result_outlines' ? 'rgba(20, 20, 20, 0.85)' : '#141414';
  ctx.lineWidth = 1 / Math.max(1e-6, rc.scale * (rc.pixelRatio ?? 1));
  const walk = (x: VNode): void => { if (x.kind === 'path') ctx.stroke(cachedPath(x.d)); else if (x.kind === 'compound') x.children.forEach(walk); else childrenOf(x)?.forEach(walk); };
  n.children.forEach(walk);
  ctx.restore();
}

function drawGroupItems(ctx: CanvasRenderingContext2D, n: VNode, rc: RenderContext): void {
  const geo: PathData = [];
  const collect = (x: VNode): void => { if (x.kind === 'path') geo.push(...x.d); else if (x.kind === 'compound') x.children.forEach((c) => geo.push(...c.d)); else childrenOf(x)?.forEach(collect); };
  collect(n);
  if (geo.length) drawShapeItems(ctx, rc, n, geo, 'nonzero');
}

function drawClipped(ctx: CanvasRenderingContext2D, n: VNode, children: VNode[], rc: RenderContext): void {
  const clipper = children[children.length - 1];
  const geo = clipGeometry(clipper);
  ctx.save();
  if (geo) ctx.clip(cachedPath(geo.d), geo.rule);
  drawKids(ctx, n, children.slice(0, -1), rc);
  ctx.restore();
  if (geo && clipper.ap.items.some((i) => i.kind === 'stroke' && i.visible && i.paint.type !== 'none')) {
    const strokesOnly = { ...clipper, ap: { ...clipper.ap, items: clipper.ap.items.filter((i) => i.kind === 'stroke') } };
    drawShapeItems(ctx, rc, strokesOnly, geo.d, geo.rule);
  }
  if (rc.outline && geo) outlineStroke(ctx, rc, cachedPath(geo.d));
}

export function clipGeometry(n: VNode): { d: PathData; rule: CanvasFillRule } | null {
  if (n.kind === 'path') return { d: n.d, rule: n.rule };
  if (n.kind === 'compound') return { d: n.children.flatMap((c) => c.d), rule: n.rule };
  if (n.kind === 'group' || n.kind === 'layer') { const d = n.children.flatMap((c) => clipGeometry(c)?.d ?? []); return d.length ? { d, rule: 'nonzero' } : null; }
  return null;
}

export function renderDocument(ctx: CanvasRenderingContext2D, rc: RenderContext): void {
  for (const l of rc.doc.layers) renderNode(ctx, l, rc);
}

function triangleMat(s: [Pt, Pt, Pt], d: [Pt, Pt, Pt]): Mat | null {
  const ux = s[1].x - s[0].x, uy = s[1].y - s[0].y, vx = s[2].x - s[0].x, vy = s[2].y - s[0].y, det = ux * vy - vx * uy;
  if (Math.abs(det) < 1e-12) return null;
  const Ux = d[1].x - d[0].x, Uy = d[1].y - d[0].y, Vx = d[2].x - d[0].x, Vy = d[2].y - d[0].y;
  const a = (Ux * vy - Vx * uy) / det, c = (Vx * ux - Ux * vx) / det, b = (Uy * vy - Vy * uy) / det, dd = (Vy * ux - Uy * vx) / det;
  return [a, b, c, dd, d[0].x - a * s[0].x - c * s[0].y, d[0].y - b * s[0].x - dd * s[0].y];
}

export function drawWarpedImage(ctx: CanvasRenderingContext2D, img: CanvasImageSource, n: ImageNode, devScale: number): void {
  const w = n.warp;
  if (!w) return;
  const sz = img as { naturalWidth?: number; naturalHeight?: number; width?: number | { baseVal: { value: number } }; height?: number | { baseVal: { value: number } } };
  const iw = sz.naturalWidth || (typeof sz.width === 'number' ? sz.width : 0) || n.w, ih = sz.naturalHeight || (typeof sz.height === 'number' ? sz.height : 0) || n.h;
  const kx = iw / n.w, ky = ih / n.h, grow = 0.7 / Math.max(1e-6, devScale), W = w.cols + 1;
  ctx.save();
  ctx.imageSmoothingEnabled = w.smooth;
  if (w.smooth) ctx.imageSmoothingQuality = 'high';
  for (let j = 0; j < w.rows; j++) for (let i = 0; i < w.cols; i++) {
    const x0 = (n.w * i) / w.cols, x1 = (n.w * (i + 1)) / w.cols, y0 = (n.h * j) / w.rows, y1 = (n.h * (j + 1)) / w.rows;
    const s00 = { x: x0, y: y0 }, s10 = { x: x1, y: y0 }, s11 = { x: x1, y: y1 }, s01 = { x: x0, y: y1 };
    const d00 = w.pts[j * W + i], d10 = w.pts[j * W + i + 1], d11 = w.pts[(j + 1) * W + i + 1], d01 = w.pts[(j + 1) * W + i];
    for (const [s, d] of [[[s00, s10, s11], [d00, d10, d11]], [[s00, s11, s01], [d00, d11, d01]]] as Array<[[Pt, Pt, Pt], [Pt, Pt, Pt]]>) {
      const m = triangleMat(s, d);
      if (!m) continue;
      const cx = (d[0].x + d[1].x + d[2].x) / 3, cy = (d[0].y + d[1].y + d[2].y) / 3;
      ctx.save();
      ctx.beginPath();
      d.forEach((q, k) => { const dx = q.x - cx, dy = q.y - cy, l = Math.hypot(dx, dy) || 1, x = q.x + (dx / l) * grow, y = q.y + (dy / l) * grow; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath();
      ctx.clip();
      ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      const sx = Math.max(0, x0 - 1 / kx), sy = Math.max(0, y0 - 1 / ky), ex = Math.min(n.w, x1 + 1 / kx), ey = Math.min(n.h, y1 + 1 / ky);
      ctx.drawImage(img, sx * kx, sy * ky, (ex - sx) * kx, (ey - sy) * ky, sx, sy, ex - sx, ey - sy);
      ctx.restore();
    }
  }
  ctx.restore();
}

export function docArtBounds(doc: Doc): Rect {
  let r = emptyRect();
  for (const l of doc.layers) if (!l.hidden) { const b = visualBounds(doc, l); if (!isEmptyRect(b)) r = isEmptyRect(r) ? b : { x: Math.min(r.x, b.x), y: Math.min(r.y, b.y), w: Math.max(r.x + r.w, b.x + b.w) - Math.min(r.x, b.x), h: Math.max(r.y + r.h, b.y + b.h) - Math.min(r.y, b.y) }; }
  return r;
}
