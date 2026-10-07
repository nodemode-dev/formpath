import { selectionBounds } from '../engine/bounds';
import { childrenOf, findNode, newDoc, newId } from '../engine/doc';
import { arrowGeometry, brushGeometry, effectPath, rasterEffects, strokeOutline, type RasterFx } from '../engine/effects';
import { apply, emptyRect, inflate as inflateRect, isEmptyRect, mul, parseSvgD, toSvgD, transformPath, unionRect, ellipsePath, rectPath, linePath, polyToPath } from '../engine/geometry';
import { liveChildren } from '../engine/live';
import { meshQuads } from '../engine/mesh';
import { cssColor, fill, gradientAt, hex, NONE, parseColor, resolvePaint, solid, stop, stroke, linearGradient, radialGradient } from '../engine/paint';
import { clipGeometry, docArtBounds, gradientGeom } from '../engine/render';
import { layoutText, weightOf, DEFAULT_CHAR } from '../engine/text';
import { BLEND_MODES, type Doc, type Gradient, type LayerNode, type Mat, type Paint, type PathData, type Project, type Rect, type StrokeItem, type TextNode, type VNode } from '../engine';
import { outlineText } from './fonts';
import { docFromManifest, serialize } from './project-io';

export interface SvgOptions { artboard: number | 'all' | 'art'; outlineText: boolean; preserve: boolean; precision: number; ids?: string[] }
const BLEND_CSS = new Map(BLEND_MODES.map((b) => [b.id, b.css === 'source-over' ? 'normal' : b.css]));

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v: number, p = 3): string => String(Math.round(v * 10 ** p) / 10 ** p);
const mat = (m: Mat, p: number): string => `matrix(${m.map((v) => num(v, p + 2)).join(' ')})`;

async function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
}

class Writer {
  private defs: string[] = [];
  private n = 0;
  private gradients = new Map<string, string>();
  private symbols = new Map<string, string>();
  constructor(private readonly p: Project, private readonly o: SvgOptions, private readonly images: Map<string, string>, private readonly outlines: Map<string, PathData>) {}
  get doc(): Doc { return this.p.doc; }
  id(prefix: string): string { this.n++; return `${prefix}${this.n}`; }
  defsXml(): string { return this.defs.length ? `<defs>${this.defs.join('')}</defs>` : ''; }
  d(d: PathData): string { return toSvgD(d, this.o.precision); }

  paint(raw: Paint, b: Rect): { v: string; op: number } {
    const p = resolvePaint(this.doc, raw);
    if (p.type === 'none') return { v: 'none', op: 1 };
    if (p.type === 'color') return { v: hex(p.color), op: 1 };
    if (p.type === 'gradient') return { v: `url(#${this.gradient(p.gradient, b)})`, op: 1 };
    const def = this.doc.patterns.find((x) => x.id === p.pattern);
    if (!def) return { v: 'none', op: 1 };
    const id = this.id('pat');
    this.defs.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" x="${num(def.tile.x)}" y="${num(def.tile.y)}" width="${num(def.tile.w)}" height="${num(def.tile.h)}"${p.xf ? ` patternTransform="${mat(p.xf, this.o.precision)}"` : ''}>${this.node(def.art)}</pattern>`);
    return { v: `url(#${id})`, op: 1 };
  }

  gradient(gr: Gradient, b: Rect): string {
    const g = gradientGeom(gr, b);
    const sorted = [...gr.stops].sort((a, c) => a.offset - c.offset);
    const stops: string[] = [];
    sorted.forEach((s, i) => {
      stops.push(`<stop offset="${num(s.offset, 4)}" stop-color="${hex(s.color)}"${s.opacity < 1 ? ` stop-opacity="${num(s.opacity)}"` : ''}/>`);
      const next = sorted[i + 1];
      if (next && Math.abs(s.mid - 0.5) > 0.01) { const t = s.offset + (next.offset - s.offset) * s.mid, c = gradientAt(gr, t); stops.push(`<stop offset="${num(t, 4)}" stop-color="${hex(c.color)}"${c.opacity < 1 ? ` stop-opacity="${num(c.opacity)}"` : ''}/>`); }
    });
    const key = `${gr.kind}|${num(g.x1)},${num(g.y1)},${num(g.x2)},${num(g.y2)}|${stops.join('')}`;
    const had = this.gradients.get(key);
    if (had) return had;
    const id = this.id('grad');
    this.gradients.set(key, id);
    if (gr.kind === 'radial') {
      const r = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
      const aspect = gr.aspect && gr.aspect !== 1 ? ` gradientTransform="translate(${num(g.x1)} ${num(g.y1)}) scale(1 ${num(gr.aspect)}) translate(${num(-g.x1)} ${num(-g.y1)})"` : '';
      this.defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${num(g.x1)}" cy="${num(g.y1)}" r="${num(r)}"${g.fx !== undefined ? ` fx="${num(g.fx)}" fy="${num(g.fy ?? g.y1)}"` : ''}${aspect}>${stops.join('')}</radialGradient>`);
    } else this.defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(g.x1)}" y1="${num(g.y1)}" x2="${num(g.x2)}" y2="${num(g.y2)}">${stops.join('')}</linearGradient>`);
    return id;
  }

  filter(fx: RasterFx[]): string {
    const id = this.id('fx'), parts: string[] = [];
    let src = 'SourceGraphic';
    fx.forEach((f, i) => {
      const out = `r${i}`;
      if (f.kind === 'blur') parts.push(`<feGaussianBlur in="${src}" stdDeviation="${num(f.blur)}" result="${out}"/>`);
      else if (f.kind === 'drop_shadow' || f.kind === 'outer_glow') parts.push(`<feGaussianBlur in="${src}" stdDeviation="${num(f.blur)}" result="b${i}"/><feOffset in="b${i}" dx="${num(f.dx)}" dy="${num(f.dy)}" result="o${i}"/><feFlood flood-color="${f.color}" flood-opacity="${num(f.opacity)}"/><feComposite in2="o${i}" operator="in" result="s${i}"/><feMerge result="${out}"><feMergeNode in="s${i}"/><feMergeNode in="${src}"/></feMerge>`);
      else if (f.kind === 'inner_glow') parts.push(`<feComponentTransfer in="${src}" result="a${i}"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer><feGaussianBlur in="a${i}" stdDeviation="${num(f.blur)}" result="b${i}"/><feFlood flood-color="${f.color}" flood-opacity="${num(f.opacity)}"/><feComposite in2="b${i}" operator="in" result="c${i}"/><feComposite in="c${i}" in2="${src}" operator="in" result="g${i}"/><feMerge result="${out}"><feMergeNode in="${src}"/><feMergeNode in="g${i}"/></feMerge>`);
      else parts.push(`<feGaussianBlur in="${src}" stdDeviation="${num(f.blur)}" result="b${i}"/><feComposite in="${src}" in2="b${i}" operator="in" result="${out}"/>`);
      src = out;
    });
    this.defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">${parts.join('')}</filter>`);
    return id;
  }

  wrap(n: VNode, inner: string): string {
    const attrs: string[] = [];
    if (n.opacity < 1) attrs.push(`opacity="${num(n.opacity)}"`);
    if (n.blend !== 'normal') attrs.push(`style="mix-blend-mode:${BLEND_CSS.get(n.blend) ?? 'normal'}"`);
    const fx = rasterEffects(n);
    if (fx.length) attrs.push(`filter="url(#${this.filter(fx)})"`);
    if (n.mask && !n.mask.disabled) { const mid = this.id('mask'); this.defs.push(`<mask id="${mid}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">${this.node(n.mask.art)}</mask>`); attrs.push(`mask="url(#${mid})"`); }
    if (n.name) attrs.push(`data-name="${esc(n.name)}"`);
    if (!attrs.length) return inner;
    return `<g ${attrs.join(' ')}>${inner}</g>`;
  }

  strokeAttrs(s: StrokeItem, b: Rect): string {
    const pt = this.paint(s.paint, b);
    const a = [`fill="none"`, `stroke="${pt.v}"`, `stroke-width="${num(s.width)}"`];
    if (s.cap !== 'butt') a.push(`stroke-linecap="${s.cap === 'square' ? 'square' : 'round'}"`);
    if (s.join !== 'miter') a.push(`stroke-linejoin="${s.join}"`);
    if (s.join === 'miter' && s.miter !== 4) a.push(`stroke-miterlimit="${num(s.miter)}"`);
    if (s.dash.length) { a.push(`stroke-dasharray="${s.dash.map((v) => num(v)).join(' ')}"`); if (s.dashOffset) a.push(`stroke-dashoffset="${num(s.dashOffset)}"`); }
    if (s.opacity < 1) a.push(`stroke-opacity="${num(s.opacity)}"`);
    return a.join(' ');
  }

  shape(n: VNode, d: PathData, rule: string): string {
    const b = selectionBounds(this.doc, [n]), out: string[] = [];
    for (const it of n.ap.items) {
      if (!it.visible) continue;
      const id = it.effects.some((e) => e.visible) ? effectPath(d, it.effects) : d;
      const blend = it.blend !== 'normal' ? ` style="mix-blend-mode:${BLEND_CSS.get(it.blend)}"` : '';
      if (it.kind === 'fill') {
        const pt = this.paint(it.paint, b);
        if (pt.v === 'none') continue;
        out.push(`<path d="${this.d(id)}" fill="${pt.v}"${rule === 'evenodd' ? ' fill-rule="evenodd"' : ''}${it.opacity < 1 ? ` fill-opacity="${num(it.opacity)}"` : ''}${blend}/>`);
        continue;
      }
      if (it.width <= 0 || it.paint.type === 'none') continue;
      const pt = this.paint(it.paint, b);
      if (it.brush) {
        const parts = brushGeometry(this.doc, id, it);
        if (parts) { for (const part of parts) out.push(`<path d="${this.d(part.d)}" fill="${part.paint ? this.paint(part.paint, b).v : pt.v}"${blend}/>`); continue; }
      }
      const closed = id.every((sp) => sp.closed);
      if ((it.profile && it.profile.length) || (it.align !== 'center' && closed)) {
        const outline = it.profile && it.profile.length ? strokeOutline(id, it) : null;
        if (outline) out.push(`<path d="${this.d(outline)}" fill="${pt.v}"${it.opacity < 1 ? ` fill-opacity="${num(it.opacity)}"` : ''}${blend}/>`);
        else {
          const cid = this.id('clip');
          if (it.align === 'inside') { this.defs.push(`<clipPath id="${cid}"><path d="${this.d(id)}"${rule === 'evenodd' ? ' clip-rule="evenodd"' : ''}/></clipPath>`); out.push(`<path d="${this.d(id)}" ${this.strokeAttrs({ ...it, width: it.width * 2 }, b)} clip-path="url(#${cid})"${blend}/>`); }
          else { const mid = this.id('mask'); this.defs.push(`<mask id="${mid}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><rect x="-100000" y="-100000" width="200000" height="200000" fill="#fff"/><path d="${this.d(id)}" fill="#000"/></mask>`); out.push(`<path d="${this.d(id)}" ${this.strokeAttrs({ ...it, width: it.width * 2 }, b)} mask="url(#${mid})"${blend}/>`); }
        }
      } else out.push(`<path d="${this.d(id)}" ${this.strokeAttrs(it, b)}${blend}/>`);
      const arrows = arrowGeometry(id, it);
      if (arrows) out.push(`<path d="${this.d(arrows)}" fill="${pt.v}"/>`);
    }
    return out.join('');
  }

  text(n: TextNode): string {
    const outlined = this.outlines.get(n.id);
    if (outlined) {
      const st = n.spans[0]?.style ?? DEFAULT_CHAR, b = selectionBounds(this.doc, [n]);
      const f = this.paint(st.fill, b), s = st.stroke.type !== 'none' ? ` stroke="${this.paint(st.stroke, b).v}" stroke-width="${num(st.strokeWidth)}"` : '';
      return `<path d="${this.d(outlined)}" fill="${f.v}"${s}/>`;
    }
    const lay = layoutText(n), b = selectionBounds(this.doc, [n]);
    const runs: string[] = [];
    const glyphRuns = (gs: typeof lay.glyphs): string => {
      const parts: string[] = [];
      let cur: typeof lay.glyphs = [];
      const flush = (): void => {
        if (!cur.length) return;
        const st = cur[0].style, { weight, italic } = weightOf(st.style);
        const f = this.paint(st.fill, b), s = st.stroke.type !== 'none' && st.strokeWidth > 0 ? ` stroke="${this.paint(st.stroke, b).v}" stroke-width="${num(st.strokeWidth)}"` : '';
        const deco = [st.underline ? 'underline' : '', st.strike ? 'line-through' : ''].filter(Boolean).join(' ');
        const feats = st.features.filter((t) => /^[a-z0-9]{4}$/.test(t)), ff = feats.length ? ` style="font-feature-settings:${feats.map((t) => `'${t}'`).join(',')}"` : '';
        parts.push(`<tspan x="${cur.map((g) => num(g.x)).join(' ')}" y="${num(cur[0].y)}" font-family="${esc(st.font)}" font-size="${num(cur[0].size)}"${weight !== 400 ? ` font-weight="${weight}"` : ''}${italic ? ' font-style="italic"' : ''} fill="${f.v}"${s}${deco ? ` text-decoration="${deco}"` : ''}${ff}>${esc(cur.map((g) => g.ch).join(''))}</tspan>`);
        cur = [];
      };
      for (const g of gs) { if (cur.length && (cur[0].style !== g.style || g.style.features.length)) flush(); cur.push(g); }
      flush();
      return parts.join('');
    };
    if (n.mode === 'path' && n.path) {
      const pid = this.id('tp');
      this.defs.push(`<path id="${pid}" d="${this.d(n.path)}"/>`);
      const st = n.spans[0]?.style ?? DEFAULT_CHAR;
      return `<text font-family="${esc(st.font)}" font-size="${num(st.size)}" fill="${this.paint(st.fill, b).v}"><textPath href="#${pid}" startOffset="${num((n.pathStart ?? 0) * 100)}%">${esc(n.spans.map((s) => s.text).join('').replace(/\n/g, ' '))}</textPath></text>`;
    }
    for (const l of lay.lines) if (l.glyphs.length) runs.push(glyphRuns(l.glyphs));
    const xf = n.xf[0] === 1 && n.xf[1] === 0 && n.xf[2] === 0 && n.xf[3] === 1 && !n.xf[4] && !n.xf[5] ? '' : ` transform="${mat(n.xf, this.o.precision)}"`;
    return `<text xml:space="preserve"${xf}>${runs.join('')}</text>`;
  }

  node(n: VNode): string {
    if (n.hidden) return '';
    switch (n.kind) {
      case 'layer': case 'group': {
        if (n.clip && n.children.length > 1) {
          const clipper = n.children[n.children.length - 1], geo = clipGeometry(clipper), cid = this.id('clip');
          if (geo) this.defs.push(`<clipPath id="${cid}"><path d="${this.d(geo.d)}"${geo.rule === 'evenodd' ? ' clip-rule="evenodd"' : ''}/></clipPath>`);
          const body = n.children.slice(0, -1).map((c) => this.node(c)).join('');
          const strokes = geo ? this.shape({ ...clipper, ap: { ...clipper.ap, items: clipper.ap.items.filter((i) => i.kind === 'stroke') } }, geo.d, geo.rule) : '';
          const inner = `<g${geo ? ` clip-path="url(#${cid})"` : ''}>${body}</g>${strokes}`;
          return n.kind === 'layer' ? `<g id="${esc(n.id)}" data-name="${esc(n.name ?? 'Layer')}">${inner}</g>` : this.wrap(n, inner);
        }
        const body = n.children.map((c) => this.node(c)).join('');
        if (n.kind === 'layer') return `<g id="${esc(n.id)}" data-name="${esc(n.name ?? 'Layer')}"${n.opacity < 1 ? ` opacity="${num(n.opacity)}"` : ''}>${body}</g>`;
        let extra = '';
        if (n.ap.items.length) { const geo: PathData = []; const collect = (x: VNode): void => { if (x.kind === 'path') geo.push(...x.d); else if (x.kind === 'compound') x.children.forEach((c) => geo.push(...c.d)); else childrenOf(x)?.forEach(collect); }; collect(n); if (geo.length) extra = this.shape(n, geo, 'nonzero'); }
        return this.wrap(n, `<g>${body}${extra}</g>`);
      }
      case 'blend': case 'envelope': case 'repeat': return this.wrap(n, `<g>${liveChildren(this.doc, n).map((c) => this.node(c)).join('')}</g>`);
      case 'path': if (n.guide) return ''; return this.wrap(n, this.shape(n, effectPath(n.d, n.ap.effects), n.rule));
      case 'compound': return this.wrap(n, this.shape(n, effectPath(n.children.flatMap((c) => c.d), n.ap.effects), n.rule));
      case 'text': return this.wrap(n, this.text(n));
      case 'image': { const href = this.images.get(n.src); return href ? this.wrap(n, `<image data-formpth-src="${esc(n.src)}" width="${n.w}" height="${n.h}" transform="${mat(n.xf, this.o.precision)}" preserveAspectRatio="none" href="${href}"/>`) : ''; }
      case 'symbol': {
        const s = this.doc.symbols.find((x) => x.id === n.symbol);
        if (!s) return '';
        let sid = this.symbols.get(s.id);
        if (!sid) { sid = this.id('sym'); this.symbols.set(s.id, sid); this.defs.push(`<g id="${sid}" data-name="${esc(s.name)}">${this.node(s.art)}</g>`); }
        return this.wrap(n, `<use href="#${sid}" transform="${mat(n.xf, this.o.precision)}"/>`);
      }
      case 'mesh': return this.wrap(n, meshQuads(n, 4).map((q) => `<path d="M${q.pts.map((v) => `${num(v.x)} ${num(v.y)}`).join('L')}Z" fill="${cssColor(q.color)}"${q.opacity < 1 ? ` fill-opacity="${num(q.opacity)}"` : ''} stroke="${cssColor(q.color)}" stroke-width="0.25"/>`).join(''));
    }
    return '';
  }
}

export function exportRegion(p: Project, which: SvgOptions['artboard']): Rect {
  const d = p.doc;
  if (which === 'all') return d.artboards.reduce((r, a) => unionRect(r, { x: a.x, y: a.y, w: a.w, h: a.h }), emptyRect());
  if (which === 'art') { const b = docArtBounds(d); return isEmptyRect(b) ? { x: 0, y: 0, w: 1, h: 1 } : b; }
  const a = d.artboards[which] ?? d.artboards[0];
  return { x: a.x, y: a.y, w: a.w, h: a.h };
}

export async function exportSvg(p: Project, o: SvgOptions): Promise<string> {
  const images = new Map<string, string>();
  for (const key of Object.keys(p.doc.images)) { const b = p.assets.get(key); if (b) images.set(key, await blobToDataUrl(b)); }
  const outlines = new Map<string, PathData>();
  if (o.outlineText) {
    const visit = async (n: VNode): Promise<void> => { if (n.kind === 'text') { const d = await outlineText(n); if (d) outlines.set(n.id, d); } for (const c of childrenOf(n) ?? []) await visit(c); };
    for (const l of p.doc.layers) await visit(l);
  }
  const w = new Writer(p, o, images, outlines);
  const picked = o.ids?.map((id) => findNode(p.doc, id)).filter((n): n is VNode => !!n) ?? null;
  const r = picked?.length ? inflateRect(selectionBounds(p.doc, picked, true), 1) : exportRegion(p, o.artboard);
  const body = (picked?.length ? picked : p.doc.layers).map((l) => w.node(l)).join('');
  let meta = '';
  if (o.preserve) {
    const { manifest } = serialize(p);
    const bytes = new TextEncoder().encode(JSON.stringify(manifest));
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    meta = `<metadata id="formpth-data">${btoa(bin)}</metadata>`;
  }
  const bg = typeof o.artboard === 'number' ? p.doc.artboards[o.artboard]?.bg : null;
  const bgRect = bg ? `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" fill="${hex(bg)}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${num(r.w)}" height="${num(r.h)}" viewBox="${num(r.x)} ${num(r.y)} ${num(r.w)} ${num(r.h)}">\n<title>${esc(p.doc.title || p.name)}</title>${meta}${w.defsXml()}${bgRect}${body}\n</svg>\n`;
}

type Style = Record<string, string>;
const INHERITED = new Set(['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'fill-rule', 'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'visibility', 'clip-rule', 'letter-spacing']);

function parseTransform(s: string | null): Mat {
  let m: Mat = [1, 0, 0, 1, 0, 0];
  if (!s) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let k: RegExpExecArray | null;
  while ((k = re.exec(s))) {
    const a = k[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let t: Mat = [1, 0, 0, 1, 0, 0];
    switch (k[1]) {
      case 'matrix': t = [a[0], a[1], a[2], a[3], a[4], a[5]]; break;
      case 'translate': t = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]; break;
      case 'scale': t = [a[0], 0, 0, a[1] ?? a[0], 0, 0]; break;
      case 'rotate': { const r = ((a[0] ?? 0) * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r), cx = a[1] ?? 0, cy = a[2] ?? 0; t = mul(mul([1, 0, 0, 1, cx, cy], [c, sn, -sn, c, 0, 0]), [1, 0, 0, 1, -cx, -cy]); break; }
      case 'skewX': t = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0]; break;
      case 'skewY': t = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]; break;
    }
    m = mul(m, t);
  }
  return m;
}

const len = (v: string | undefined, d = 0): number => { if (!v) return d; const n = parseFloat(v); if (!Number.isFinite(n)) return d; if (/mm$/.test(v)) return (n * 72) / 25.4; if (/cm$/.test(v)) return (n * 72) / 2.54; if (/in$/.test(v)) return n * 72; if (/pt$/.test(v)) return n; if (/pc$/.test(v)) return n * 12; return n; };

export interface SvgImport { doc: Doc; assets: Map<string, Blob>; native: boolean; title: string }

function dataUrlToBlob(u: string): Blob | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(u);
  if (!m) return null;
  const mime = m[1] ?? 'application/octet-stream';
  if (m[2]) { const bin = atob(m[3]); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: mime }); }
  return new Blob([decodeURIComponent(m[3])], { type: mime });
}

export async function importSvg(text: string, name = 'Untitled'): Promise<SvgImport> {
  const dom = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = dom.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || dom.querySelector('parsererror')) throw new Error('This file is not a readable SVG.');
  const meta = svg.querySelector('metadata#formpth-data');
  const imgAssets = new Map<string, Blob>();
  for (const im of Array.from(svg.querySelectorAll('image[data-formpth-src]'))) { const key = im.getAttribute('data-formpth-src') ?? '', href = im.getAttribute('href') ?? im.getAttribute('xlink:href') ?? ''; const b = dataUrlToBlob(href); if (key && b) imgAssets.set(key, b); }
  if (meta?.textContent) {
    try {
      const bin = atob(meta.textContent.trim()), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const manifest = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
      return { doc: docFromManifest(manifest), assets: imgAssets, native: true, title: name };
    } catch { }
  }
  const vb = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const W = len(svg.getAttribute('width') ?? undefined, vb[2] || 612), H = len(svg.getAttribute('height') ?? undefined, vb[3] || 792);
  let root: Mat = [1, 0, 0, 1, 0, 0];
  if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) root = [W / vb[2], 0, 0, H / vb[3], (-vb[0] * W) / vb[2], (-vb[1] * H) / vb[3]];
  const doc = newDoc(W, H, { title: name });
  const assets = new Map<string, Blob>();
  const ids = new Map<string, Element>();
  for (const e of Array.from(svg.querySelectorAll('[id]'))) ids.set(e.getAttribute('id') ?? '', e);
  const cssRules = new Map<string, Style>();
  for (const st of Array.from(svg.querySelectorAll('style'))) {
    const re = /([^{}]+)\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(st.textContent ?? ''))) for (const sel of m[1].split(',')) { const k = sel.trim(); if (/^\.[\w-]+$/.test(k)) cssRules.set(k.slice(1), { ...(cssRules.get(k.slice(1)) ?? {}), ...styleOf(m[2]) }); }
  }
  function styleOf(s: string): Style { const o: Style = {}; for (const part of s.split(';')) { const i = part.indexOf(':'); if (i > 0) o[part.slice(0, i).trim()] = part.slice(i + 1).trim(); } return o; }
  const own = (e: Element): Style => {
    const s: Style = {};
    for (const a of Array.from(e.attributes)) if (INHERITED.has(a.name) || a.name === 'opacity' || a.name === 'display' || a.name === 'mix-blend-mode') s[a.name] = a.value;
    for (const c of (e.getAttribute('class') ?? '').split(/\s+/)) if (c && cssRules.has(c)) Object.assign(s, cssRules.get(c));
    Object.assign(s, styleOf(e.getAttribute('style') ?? ''));
    return s;
  };
  const gradPaint = (ref: string, bboxOf: () => Rect, m: Mat): Paint | null => {
    const first = ids.get(ref);
    if (!first) return null;
    const chain: Element[] = [first];
    let el0: Element = first;
    while (true) { const h: string = (el0.getAttribute('href') ?? el0.getAttribute('xlink:href') ?? '').replace(/^#/, ''); const nx: Element | null = h ? ids.get(h) ?? null : null; if (!nx || chain.includes(nx)) break; chain.push(nx); el0 = nx; }
    const attr = (k: string): string | null => { for (const c of chain) { const v = c.getAttribute(k); if (v !== null) return v; } return null; };
    const stopsEl = chain.map((c) => Array.from(c.querySelectorAll('stop'))).find((s) => s.length) ?? [];
    const stops = stopsEl.map((s) => { const st = { ...styleOf(s.getAttribute('style') ?? '') }; const off = s.getAttribute('offset') ?? '0'; const c = parseColor(st['stop-color'] ?? s.getAttribute('stop-color') ?? '#000') ?? { kind: 'rgb' as const, r: 0, g: 0, b: 0 }; return stop(off.endsWith('%') ? parseFloat(off) / 100 : parseFloat(off) || 0, c, parseFloat(st['stop-opacity'] ?? s.getAttribute('stop-opacity') ?? '1')); });
    if (stops.length < 2) return stops[0] ? solid(stops[0].color) : null;
    const user = attr('gradientUnits') === 'userSpaceOnUse', gt = parseTransform(attr('gradientTransform'));
    const b = bboxOf();
    const P = (x: string | null, y: string | null, dx: number, dy: number): { x: number; y: number } => {
      const fx = x === null ? dx : x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x), fy = y === null ? dy : y.endsWith('%') ? parseFloat(y) / 100 : parseFloat(y);
      const q = apply(gt, fx, fy);
      return user ? apply(m, q.x, q.y) : { x: b.x + q.x * b.w, y: b.y + q.y * b.h };
    };
    if (chain[0].nodeName === 'radialGradient') {
      const c = P(attr('cx'), attr('cy'), 0.5, 0.5), rr = attr('r'), rv = rr === null ? 0.5 : rr.endsWith('%') ? parseFloat(rr) / 100 : parseFloat(rr);
      const edge = user ? (() => { const q = apply(gt, parseFloat(attr('cx') ?? '0') + rv, parseFloat(attr('cy') ?? '0')); return apply(m, q.x, q.y); })() : { x: c.x + rv * b.w, y: c.y };
      const g = radialGradient(stops);
      return { type: 'gradient', gradient: { ...g, geom: { x1: c.x, y1: c.y, x2: edge.x, y2: edge.y } } };
    }
    const a = P(attr('x1'), attr('y1'), 0, 0), z = P(attr('x2'), attr('y2'), 1, 0);
    const g = linearGradient(stops);
    return { type: 'gradient', gradient: { ...g, geom: { x1: a.x, y1: a.y, x2: z.x, y2: z.y } } };
  };
  const paintOf = (v: string | undefined, m: Mat, bbox: () => Rect): Paint | null => {
    if (v === undefined) return null;
    if (v === 'none' || v === 'transparent') return NONE;
    const u = /url\(\s*['"]?#([^'")]+)['"]?\s*\)/.exec(v);
    if (u) return gradPaint(u[1], bbox, m) ?? NONE;
    const c = parseColor(v === 'currentColor' ? '#000' : v);
    return c ? solid(c) : NONE;
  };
  const shapeD = (e: Element): PathData | null => {
    const n = e.nodeName.toLowerCase(), A = (k: string): number => len(e.getAttribute(k) ?? undefined, 0);
    switch (n) {
      case 'path': { const d = e.getAttribute('d'); return d ? parseSvgD(d) : null; }
      case 'rect': { const w = A('width'), h = A('height'); if (w <= 0 || h <= 0) return null; let rx = A('rx'), ry = A('ry'); if (!e.hasAttribute('rx')) rx = ry; if (!e.hasAttribute('ry')) ry = rx; const r = Math.min(rx, w / 2, h / 2); return rectPath(A('x'), A('y'), w, h, [r, r, r, r]); }
      case 'circle': { const r = A('r'); return r > 0 ? ellipsePath(A('cx') - r, A('cy') - r, 2 * r, 2 * r) : null; }
      case 'ellipse': { const rx = A('rx'), ry = A('ry'); return rx > 0 && ry > 0 ? ellipsePath(A('cx') - rx, A('cy') - ry, 2 * rx, 2 * ry) : null; }
      case 'line': return linePath(A('x1'), A('y1'), A('x2'), A('y2'));
      case 'polyline': case 'polygon': { const v = (e.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number); const pts = []; for (let i = 0; i + 1 < v.length; i += 2) pts.push({ x: v[i], y: v[i + 1] }); return pts.length > 1 ? polyToPath(pts, n === 'polygon') : null; }
    }
    return null;
  };
  let imgN = 0;
  const walk = (e: Element, inherited: Style, m0: Mat, out: VNode[], depth: number): void => {
    if (depth > 64) return;
    const tag = e.nodeName.toLowerCase();
    if (['defs', 'style', 'metadata', 'title', 'desc', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'pattern', 'symbol', 'marker', 'filter', 'script'].includes(tag)) return;
    const st = { ...Object.fromEntries(Object.entries(inherited).filter(([k]) => INHERITED.has(k))), ...own(e) };
    if (st.display === 'none' || st.visibility === 'hidden') return;
    const m = mul(m0, parseTransform(e.getAttribute('transform')));
    const opacity = st.opacity !== undefined ? Math.max(0, Math.min(1, parseFloat(st.opacity))) : 1;
    const blend = (BLEND_MODES.find((b) => b.css === st['mix-blend-mode'])?.id ?? 'normal');
    const label = e.getAttribute('data-name') ?? e.getAttribute('inkscape:label') ?? e.getAttribute('id') ?? undefined;
    if (tag === 'g' || tag === 'svg' || tag === 'a' || tag === 'switch') {
      const kids: VNode[] = [];
      for (const c of Array.from(e.children)) walk(c, st, tag === 'svg' && e !== svg ? mul(m, [1, 0, 0, 1, len(e.getAttribute('x') ?? undefined), len(e.getAttribute('y') ?? undefined)]) : m, kids, depth + 1);
      if (!kids.length) return;
      const clipRef = /url\(\s*#([^)]+)\)/.exec(e.getAttribute('clip-path') ?? '');
      let clipNode: VNode | null = null;
      if (clipRef) {
        const ce = ids.get(clipRef[1]), cd: PathData = [];
        for (const c of Array.from(ce?.children ?? [])) { const d = shapeD(c); if (d) cd.push(...transformPath(d, mul(m, parseTransform(c.getAttribute('transform'))))); }
        if (cd.length) clipNode = { id: newId('p'), kind: 'path', d: cd, rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
      }
      out.push({ id: newId('g'), kind: 'group', clip: !!clipNode, children: clipNode ? [...kids, clipNode] : kids, opacity, blend, ap: { items: [], effects: [] }, ...(label ? { name: label } : {}) });
      return;
    }
    if (tag === 'use') {
      const ref = ids.get((e.getAttribute('href') ?? e.getAttribute('xlink:href') ?? '').replace(/^#/, ''));
      if (!ref) return;
      const um = mul(m, [1, 0, 0, 1, len(e.getAttribute('x') ?? undefined), len(e.getAttribute('y') ?? undefined)]);
      const kids: VNode[] = [];
      if (ref.nodeName.toLowerCase() === 'symbol') for (const c of Array.from(ref.children)) walk(c, st, um, kids, depth + 1);
      else walk(ref, st, um, kids, depth + 1);
      out.push(...kids);
      return;
    }
    if (tag === 'image') {
      const href = e.getAttribute('href') ?? e.getAttribute('xlink:href') ?? '', blob = dataUrlToBlob(href);
      if (!blob) return;
      const w = len(e.getAttribute('width') ?? undefined, 100), h = len(e.getAttribute('height') ?? undefined, 100), ext = (blob.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '');
      const key = `svg-img-${Date.now().toString(36)}-${imgN++}.${ext}`;
      assets.set(key, blob);
      doc.images[key] = { mime: blob.type || 'image/png', w: Math.round(w), h: Math.round(h) };
      out.push({ id: newId('im'), kind: 'image', src: key, w: Math.round(w), h: Math.round(h), xf: mul(m, [w / Math.round(w), 0, 0, h / Math.round(h), len(e.getAttribute('x') ?? undefined), len(e.getAttribute('y') ?? undefined)]), opacity, blend, ap: { items: [], effects: [] } });
      return;
    }
    if (tag === 'text') {
      const t = (e.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!t) return;
      const firstSpan = e.querySelector('tspan');
      const x = len(e.getAttribute('x') ?? firstSpan?.getAttribute('x')?.split(/[\s,]+/)[0] ?? undefined), y = len(e.getAttribute('y') ?? firstSpan?.getAttribute('y')?.split(/[\s,]+/)[0] ?? undefined);
      const spanSt = firstSpan ? { ...st, ...own(firstSpan) } : st;
      const size = len(spanSt['font-size'], 16), weight = spanSt['font-weight'] ?? '400', italic = spanSt['font-style'] === 'italic';
      const fam = (spanSt['font-family'] ?? 'Inter').split(',')[0].replace(/["']/g, '').trim();
      const w = Number(weight === 'bold' ? 700 : weight === 'normal' ? 400 : weight) || 400;
      const style = `${w >= 700 ? 'Bold' : w >= 600 ? 'Semibold' : w >= 500 ? 'Medium' : w <= 300 ? 'Light' : 'Regular'}${italic ? ' Italic' : ''}`.replace('Regular Italic', 'Italic');
      const f = paintOf(spanSt.fill ?? '#000', m, () => ({ x, y, w: 1, h: 1 })) ?? solid({ kind: 'rgb', r: 0, g: 0, b: 0 });
      const anchor = spanSt['text-anchor'];
      const node: TextNode = { id: newId('t'), kind: 'text', mode: 'point', spans: [{ text: t, style: { ...DEFAULT_CHAR, font: fam, style, size, fill: f } }], para: { align: anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left', indentLeft: 0, indentRight: 0, indentFirst: 0, spaceBefore: 0, spaceAfter: 0, hyphenate: false }, xf: mul(m, [1, 0, 0, 1, x, y]), opacity, blend, ap: { items: [], effects: [] } };
      out.push(node);
      return;
    }
    const d0 = shapeD(e);
    if (!d0 || !d0.length) return;
    const d = transformPath(d0, m);
    const bbox = (): Rect => { let r = emptyRect(); for (const sp of d) for (const a of sp.pts) r = unionRect(r, { x: a.x, y: a.y, w: 0, h: 0 }); return r; };
    const fillP = paintOf(st.fill ?? '#000', m, bbox) ?? solid({ kind: 'rgb', r: 0, g: 0, b: 0 });
    const strokeP = paintOf(st.stroke ?? 'none', m, bbox) ?? NONE;
    const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
    const items: VNode['ap']['items'] = [];
    if (fillP.type !== 'none' && !(tag === 'line' || tag === 'polyline' && st.fill === undefined)) items.push(fill(fillP, st['fill-opacity'] ? parseFloat(st['fill-opacity']) : 1));
    if (strokeP.type !== 'none') {
      const dash = st['stroke-dasharray'] && st['stroke-dasharray'] !== 'none' ? st['stroke-dasharray'].split(/[\s,]+/).map((v) => len(v) * scale).filter((v) => Number.isFinite(v)) : [];
      items.push(stroke(strokeP, len(st['stroke-width'], 1) * scale, { cap: st['stroke-linecap'] === 'round' ? 'round' : st['stroke-linecap'] === 'square' ? 'square' : 'butt', join: st['stroke-linejoin'] === 'round' ? 'round' : st['stroke-linejoin'] === 'bevel' ? 'bevel' : 'miter', miter: parseFloat(st['stroke-miterlimit'] ?? '4') || 4, dash, opacity: st['stroke-opacity'] ? parseFloat(st['stroke-opacity']) : 1 }));
    }
    out.push({ id: newId('p'), kind: 'path', d, rule: st['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero', opacity, blend, ap: { items, effects: [] }, ...(label && !/^(path|rect|circle)\d*$/i.test(label) ? { name: label } : {}) });
  };
  const top: VNode[] = [];
  for (const c of Array.from(svg.children)) walk(c, {}, root, top, 0);
  const groups = top.filter((n) => n.kind === 'group');
  const layers: LayerNode[] = [];
  if (groups.length > 1 && groups.length === top.length && groups.every((g) => g.name)) {
    groups.forEach((g, i) => { const l = { ...doc.layers[0], id: newId('l'), name: g.name ?? `Layer ${i + 1}`, children: g.kind === 'group' ? g.children : [g], color: ['#4f80ff', '#ff4f4f', '#4fbf4f', '#4f4fff', '#ffd400'][i % 5] }; layers.push(l); });
  } else layers.push({ ...doc.layers[0], name: 'Layer 1', children: top });
  doc.layers = layers;
  return { doc, assets, native: false, title: name };
}
