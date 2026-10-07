import { selectionBounds, visualBounds } from './bounds';
import { childrenOf } from './doc';
import { arrowGeometry, brushGeometry, effectPath, rasterEffects, strokeOutline, type RasterFx } from './effects';
import { emptyRect, inflate, isEmptyRect, toPath2D, tracePath, transformRect } from './geometry';
import { liveChildren } from './live';
import { meshQuads } from './mesh';
import { cssColor, freeformPixels, gradientAt, resolvePaint, toRgb } from './paint';
import { liveFaceNodes } from './livepaint';
import { latticeCopies, patternLattice } from './pattern';
import { instanceArt } from './symbolism';
import { runFilter, type FilterFrame } from './filters';
import { drawText, textEpoch } from './text';
import { BLEND_MODES, type BlendMode, type Doc, type Gradient, type Mat, type GroupNode, type Paint, type PathData, type PatternDef, type Rect, type StrokeItem, type TraceView, type VNode } from './types';

export interface RenderContext {
  doc: Doc;
  scale: number;
  outline: boolean;
  assets: (key: string) => CanvasImageSource | null;
  skip?: Set<string>;
  printing?: boolean;
  pixelRatio?: number;
  outlineColor?: string;
}

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

export function paintStyle(ctx: CanvasRenderingContext2D, rc: RenderContext, raw: Paint, b: Rect, alpha = 1): Style | null {
  const p = resolvePaint(rc.doc, raw);
  if (p.type === 'none') return null;
  if (p.type === 'color') return cssColor(p.color, alpha);
  if (p.type === 'gradient') {
    const gr = p.gradient;
    if (gr.kind === 'freeform') { const v = gradientAt(gr, 0.5); return cssColor(v.color, alpha); }
    const g = gradientGeom(gr, b);
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
  const scale = Math.min(8, Math.max(1, rc.scale * (rc.pixelRatio ?? 1)));
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

function strokeWith(ctx: CanvasRenderingContext2D, rc: RenderContext, path: Path2D, d: PathData, s: StrokeItem, b: Rect, rule: CanvasFillRule): void {
  const style = paintStyle(ctx, rc, s.paint, b);
  if (!style || s.width <= 0) return;
  ctx.save();
  ctx.globalAlpha *= s.opacity;
  ctx.globalCompositeOperation = blendCss(s.blend);
  if (s.brush) {
    const g = brushGeometry(rc.doc, d, s);
    if (g) {
      ctx.fillStyle = style;
      for (const part of g) { ctx.fillStyle = part.paint ? (paintStyle(ctx, rc, part.paint, b) ?? style) : style; ctx.fill(cachedPath(part.d), 'nonzero'); }
      ctx.restore();
      return;
    }
  }
  if (s.profile && s.profile.length) {
    ctx.fillStyle = style;
    ctx.fill(cachedPath(strokeOutline(d, s)), 'nonzero');
  } else {
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
  const arrows = arrowGeometry(d, s);
  if (arrows) { ctx.setLineDash([]); ctx.fillStyle = style; ctx.fill(cachedPath(arrows), 'nonzero'); }
  ctx.restore();
}

function drawShapeItems(ctx: CanvasRenderingContext2D, rc: RenderContext, n: VNode, d: PathData, rule: CanvasFillRule): void {
  const path = cachedPath(d), b = selectionBounds(rc.doc, [n]);
  if (rc.outline) { outlineStroke(ctx, rc, path); return; }
  for (const it of n.ap.items) {
    if (!it.visible) continue;
    const id = itemGeometry(d, it.effects);
    const ip = id === d ? path : cachedPath(id);
    if (it.kind === 'fill') {
      const p = rc.doc ? resolvePaint(rc.doc, it.paint) : it.paint;
      if (p.type === 'gradient' && p.gradient.kind === 'freeform') { drawFreeform(ctx, rc, ip, rule, p.gradient, b, it.opacity, it.blend); continue; }
      const style = paintStyle(ctx, rc, it.paint, b);
      if (!style) continue;
      ctx.save();
      ctx.globalAlpha *= it.opacity;
      ctx.globalCompositeOperation = blendCss(it.blend);
      ctx.fillStyle = style;
      ctx.fill(ip, rule);
      ctx.restore();
    } else strokeWith(ctx, rc, ip, id, it, b, rule);
  }
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

function needsLayer(n: VNode, multi: boolean): boolean {
  return (n.opacity < 1 && multi) || n.blend !== 'normal' || !!(n.mask && !n.mask.disabled) || rasterEffects(n).length > 0 || !!n.isolate;
}

export function renderNode(ctx: CanvasRenderingContext2D, n: VNode, rc: RenderContext): void {
  if (n.hidden || rc.skip?.has(n.id)) return;
  if (rc.printing && n.kind === 'layer' && (n.printable === false || n.template)) return;
  const fx = rc.outline ? [] : rasterEffects(n);
  const ch = n.kind === 'compound' ? null : childrenOf(n);
  const multi = !!ch || n.ap.items.filter((i) => i.visible).length > 1 || n.kind === 'text' || n.kind === 'symbol' || n.kind === 'mesh';
  if (!rc.outline && needsLayer(n, multi)) {
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
  switch (n.kind) {
    case 'layer': {
      if (n.template && !rc.printing) { ctx.save(); ctx.globalAlpha *= 0.5; for (const c of n.children) renderNode(ctx, c, rc); ctx.restore(); return; }
      if (n.clip && n.children.length > 1) { drawClipped(ctx, n.children, rc); return; }
      for (const c of n.children) renderNode(ctx, c, rc);
      return;
    }
    case 'group':
      if (n.trace && !rc.outline && !rc.printing && n.trace.view !== 'result') { drawTraceView(ctx, n, n.trace.view, rc); return; }
      if (n.livePaint) { if (!rc.outline) for (const f of liveFaceNodes(n)) renderNode(ctx, f, rc); for (const c of n.children) renderNode(ctx, c, rc); return; }
      if (n.clip && n.children.length > 1) { drawClipped(ctx, n.children, rc); return; }
      for (const c of n.children) renderNode(ctx, c, rc);
      if (n.ap.items.length && !rc.outline) drawGroupItems(ctx, n, rc);
      return;
    case 'blend': case 'envelope': case 'repeat':
      for (const c of liveChildren(rc.doc, n)) renderNode(ctx, c, rc);
      if (rc.outline && n.kind === 'blend' && n.spec.spine) outlineStroke(ctx, rc, cachedPath(n.spec.spine));
      return;
    case 'path': {
      const d = effectPath(n.d, n.ap.effects);
      if (n.guide) return;
      drawShapeItems(ctx, rc, n, d, n.rule);
      return;
    }
    case 'compound': {
      const d = effectPath(n.children.flatMap((c) => c.d), n.ap.effects);
      drawShapeItems(ctx, rc, n, d, n.rule);
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

function drawClipped(ctx: CanvasRenderingContext2D, children: VNode[], rc: RenderContext): void {
  const clipper = children[children.length - 1];
  const geo = clipGeometry(clipper);
  ctx.save();
  if (geo) ctx.clip(cachedPath(geo.d), geo.rule);
  for (const c of children.slice(0, -1)) renderNode(ctx, c, rc);
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

export function docArtBounds(doc: Doc): Rect {
  let r = emptyRect();
  for (const l of doc.layers) if (!l.hidden) { const b = visualBounds(doc, l); if (!isEmptyRect(b)) r = isEmptyRect(r) ? b : { x: Math.min(r.x, b.x), y: Math.min(r.y, b.y), w: Math.max(r.x + r.w, b.x + b.w) - Math.min(r.x, b.x), h: Math.max(r.y + r.h, b.y + b.h) - Math.min(r.y, b.y) }; }
  return r;
}
