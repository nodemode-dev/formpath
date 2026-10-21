import { selectionBounds, visualBounds } from '../engine/bounds';
import { childrenOf } from '../engine/doc';
import { arrowGeometry, brushGeometry, effectPath, has3d, rasterEffects, rasterEffectsOf, strokeOutline, threeDFaces } from '../engine/effects';
import { inflate, isEmptyRect, isLineSeg, segments } from '../engine/geometry';
import { liveChildren } from '../engine/live';
import { liveFaceNodes } from '../engine/livepaint';
import { fxNode } from '../engine/groupfx';
import { derivedArt } from '../engine/shaper';
import { isLive } from '../engine/pathfinder';
import { instanceArt } from '../engine/symbolism';
import { gradientAt, perceptualStops, resolvePaint, toCmyk, toRgb } from '../engine/paint';
import { clipGeometry, gradientGeom } from '../engine/render';
import { gradientStrokeArt, strokeGradient } from '../engine/stroke-gradient';
import type { Color, Doc, Gradient, PathData, Project, Rect, VNode } from '../engine';
import { outlineText } from './fonts';
import { renderRegion } from './raster';
import { serialize } from './project-io';

export interface EpsOptions { region: Rect; cmyk: boolean; preserve: boolean; ppi: number; title?: string; version?: string }

const f = (v: number): string => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };
const EMBED_BEGIN = '%FormpathDocument-Begin', EMBED_END = '%FormpathDocument-End', EMBED_LINE = '%FPTH:';

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') return data;
  const out = new Response(new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate')));
  return new Uint8Array(await out.arrayBuffer());
}

export function ascii85(data: Uint8Array): string {
  const out: string[] = [];
  let line = '';
  const push = (s: string): void => { line += s; if (line.length >= 76) { out.push(line); line = ''; } };
  for (let i = 0; i < data.length; i += 4) {
    const n = Math.min(4, data.length - i);
    const v = (((data[i] << 24) >>> 0) + ((data[i + 1] ?? 0) << 16) + ((data[i + 2] ?? 0) << 8) + (data[i + 3] ?? 0)) >>> 0;
    if (v === 0 && n === 4) { push('z'); continue; }
    let x = v; const c: string[] = [];
    for (let k = 0; k < 5; k++) { c.unshift(String.fromCharCode(33 + (x % 85))); x = Math.floor(x / 85); }
    push(c.slice(0, n + 1).join(''));
  }
  if (line) out.push(line);
  return `${out.join('\n')}~>`;
}

function trimAfter(doc: Doc, id: string): Doc {
  let found = false;
  const cut = (list: VNode[]): VNode[] => {
    const out: VNode[] = [];
    for (const n of list) {
      if (found) break;
      if (n.id === id) { out.push(n); found = true; break; }
      const kids = childrenOf(n);
      if (kids && kids.length && (n.kind === 'layer' || n.kind === 'group') && !(n.kind === 'group' && n.clip)) {
        const inner = cut(kids);
        out.push({ ...n, children: inner } as VNode);
      } else out.push(n);
    }
    return out;
  };
  return { ...doc, layers: cut(doc.layers) as Doc['layers'] };
}

class PsPainter {
  constructor(private readonly p: Project, private readonly o: EpsOptions, private readonly outlines: Map<string, PathData>) {}
  get doc(): Doc { return this.p.doc; }

  path(d: PathData): string {
    const out: string[] = [];
    for (const sp of d) {
      if (!sp.pts.length) continue;
      out.push(`${f(sp.pts[0].x)} ${f(sp.pts[0].y)} m`);
      for (const s of segments(sp)) out.push(isLineSeg(s) ? `${f(s[3].x)} ${f(s[3].y)} l` : `${f(s[1].x)} ${f(s[1].y)} ${f(s[2].x)} ${f(s[2].y)} ${f(s[3].x)} ${f(s[3].y)} c`);
      if (sp.closed) out.push('h');
    }
    return out.join('\n');
  }

  color(c: Color): string {
    if (this.o.cmyk) { const k = toCmyk(c); if (k.kind === 'cmyk') return `${f(k.c / 100)} ${f(k.m / 100)} ${f(k.y / 100)} ${f(k.k / 100)} setcmykcolor`; }
    if (c.kind === 'gray') return `${f(1 - c.k / 100)} setgray`;
    const v = toRgb(c);
    return `${f(v.r / 255)} ${f(v.g / 255)} ${f(v.b / 255)} setrgbcolor`;
  }

  private comp(c: Color): string {
    if (this.o.cmyk) { const k = toCmyk(c); return k.kind === 'cmyk' ? `${f(k.c / 100)} ${f(k.m / 100)} ${f(k.y / 100)} ${f(k.k / 100)}` : '0 0 0 1'; }
    const v = toRgb(c);
    return `${f(v.r / 255)} ${f(v.g / 255)} ${f(v.b / 255)}`;
  }

  fnFor(gr: Gradient): string {
    const stops = [...gr.stops].sort((a, b) => a.offset - b.offset);
    const pts: Array<{ t: number; c: Color }> = [];
    if (stops[0].offset > 0) pts.push({ t: 0, c: stops[0].color });
    const pst = perceptualStops(gr);
    if (pst) for (const s of pst) pts.push({ t: s.t, c: s.color });
    else stops.forEach((s, i) => { pts.push({ t: s.offset, c: s.color }); const nx = stops[i + 1]; if (nx && Math.abs(s.mid - 0.5) > 0.01) pts.push({ t: s.offset + (nx.offset - s.offset) * s.mid, c: gradientAt(gr, s.offset + (nx.offset - s.offset) * s.mid).color }); });
    if (stops[stops.length - 1].offset < 1) pts.push({ t: 1, c: stops[stops.length - 1].color });
    const fns: string[] = [], bounds: string[] = [], encode: string[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      fns.push(`<< /FunctionType 2 /Domain [0 1] /C0 [${this.comp(pts[i].c)}] /C1 [${this.comp(pts[i + 1].c)}] /N 1 >>`);
      if (i > 0) bounds.push(f(pts[i].t));
      encode.push('0 1');
    }
    if (!fns.length) return `<< /FunctionType 2 /Domain [0 1] /C0 [${this.comp(stops[0].color)}] /C1 [${this.comp(stops[0].color)}] /N 1 >>`;
    return fns.length === 1 ? fns[0] : `<< /FunctionType 3 /Domain [0 1] /Functions [${fns.join(' ')}] /Bounds [${bounds.join(' ')}] /Encode [${encode.join(' ')}] >>`;
  }

  shading(gr: Gradient, b: Rect): string {
    const g = gradientGeom(gr, b), cs = this.o.cmyk ? '/DeviceCMYK' : '/DeviceRGB';
    const coords = gr.kind === 'radial' ? `[${f(g.fx ?? g.x1)} ${f(g.fy ?? g.y1)} 0 ${f(g.x1)} ${f(g.y1)} ${f(Math.hypot(g.x2 - g.x1, g.y2 - g.y1))}]` : `[${f(g.x1)} ${f(g.y1)} ${f(g.x2)} ${f(g.y2)}]`;
    return `<< /ShadingType ${gr.kind === 'radial' ? 3 : 2} /ColorSpace ${cs} /Coords ${coords} /Function ${this.fnFor(gr)} /Extend [true true] >> shfill`;
  }

  spot(raw: VNode['ap']['items'][number]['paint']): string | null {
    if (raw.type !== 'color' || !raw.swatch) return null;
    const sw = this.doc.swatches.find((s) => s.id === raw.swatch);
    const reg = sw?.name === '[Registration]';
    if (!sw || !(sw.spot || reg) || sw.paint.type !== 'color') return null;
    const k = toCmyk(sw.paint.color), [C, M, Y, K] = reg ? [1, 1, 1, 1] : k.kind === 'cmyk' ? [k.c / 100, k.m / 100, k.y / 100, k.k / 100] : [0, 0, 0, 1];
    return `[/Separation ${reg ? '/All' : `/${sw.name.replace(/[^A-Za-z0-9_.-]/g, '_') || 'Spot'}`} /DeviceCMYK {dup ${f(C)} mul exch dup ${f(M)} mul exch dup ${f(Y)} mul exch ${f(K)} mul}] setcolorspace ${f(Math.max(0, Math.min(100, raw.tint ?? 100)) / 100)} setcolor`;
  }

  fillWith(raw: VNode['ap']['items'][number]['paint'], d: PathData, evenodd: boolean, b: Rect): string {
    const sp = this.spot(raw);
    if (sp) return `gsave ${sp}\n${this.path(d)}\n${evenodd ? 'eofill' : 'fill'} grestore`;
    const p = resolvePaint(this.doc, raw);
    if (p.type === 'color') return `gsave ${this.color(p.color)}\n${this.path(d)}\n${evenodd ? 'eofill' : 'fill'} grestore`;
    if (p.type === 'gradient' && p.gradient.kind !== 'freeform' && p.gradient.stops.length) return `gsave\n${this.path(d)}\n${evenodd ? 'eoclip' : 'clip'} newpath\n${this.shading(p.gradient, b)}\ngrestore`;
    return '';
  }

  needsRaster(n: VNode): boolean {
    if (rasterEffects(n).length || (n.mask && !n.mask.disabled) || n.kind === 'mesh' || (n.kind === 'image' && !!n.warp)) return true;
    if (n.opacity < 1 || n.blend !== 'normal' || (n.knockout === true)) return true;
    if (n.kind === 'text' && !this.outlines.has(n.id)) return true;
    return n.ap.items.some((i) => i.visible && (i.opacity < 1 || i.blend !== 'normal' || i.paint.type === 'pattern' || (i.paint.type === 'gradient' && (i.paint.gradient.kind === 'freeform' || i.paint.gradient.stops.some((s) => s.opacity < 1))) || rasterEffectsOf(i.effects).length > 0 || (i.kind === 'stroke' && !!strokeGradient(this.doc, i))));
  }

  shape(n: VNode, d: PathData, evenodd: boolean): string {
    const b = selectionBounds(this.doc, [n]), out: string[] = [];
    for (const it of n.ap.items) {
      if (!it.visible) continue;
      const id = it.effects.some((e) => e.visible) ? effectPath(d, it.effects) : d;
      if (it.kind === 'fill') { const s = this.fillWith(it.paint, id, evenodd, b); if (s) out.push(s); continue; }
      if (it.width <= 0) continue;
      if (gradientStrokeArt(this.doc, id, it, evenodd ? 'evenodd' : 'nonzero')) continue;
      const brush = it.brush ? brushGeometry(this.doc, id, it) : null;
      if (brush) { for (const part of brush) { const s = this.fillWith(part.paint ?? it.paint, part.d, false, b); if (s) out.push(s); } continue; }
      if (it.profile && it.profile.length) { const s = this.fillWith(it.paint, strokeOutline(id, it), false, b); if (s) out.push(s); }
      else {
        const p = resolvePaint(this.doc, it.paint), sp = this.spot(it.paint);
        const closed = id.every((x) => x.closed);
        const clip = it.align === 'inside' && closed ? `${this.path(id)}\n${evenodd ? 'eoclip' : 'clip'} newpath\n` : it.align === 'outside' && closed ? `${f(b.x - 1e4)} ${f(b.y - 1e4)} m ${f(b.x + 1e4)} ${f(b.y - 1e4)} l ${f(b.x + 1e4)} ${f(b.y + 1e4)} l ${f(b.x - 1e4)} ${f(b.y + 1e4)} l h\n${this.path(id)}\neoclip newpath\n` : '';
        const w = clip ? it.width * 2 : it.width;
        const style = `${f(w)} setlinewidth ${it.cap === 'round' ? 1 : it.cap === 'square' ? 2 : 0} setlinecap ${it.join === 'round' ? 1 : it.join === 'bevel' ? 2 : 0} setlinejoin ${f(Math.max(1, it.miter))} setmiterlimit [${it.dash.map(f).join(' ')}] ${f(it.dashOffset)} setdash`;
        if (sp) out.push(`gsave ${clip}${sp} ${style}\n${this.path(id)}\nstroke grestore`);
        else if (p.type === 'color') out.push(`gsave ${clip}${this.color(p.color)} ${style}\n${this.path(id)}\nstroke grestore`);
        else if (p.type === 'gradient' && p.gradient.kind !== 'freeform') out.push(`gsave ${clip}${style}\n${this.path(id)}\nstrokepath clip newpath\n${this.shading(p.gradient, b)}\ngrestore`);
      }
      const arrows = arrowGeometry(id, it);
      if (arrows) { const s = this.fillWith(it.paint, arrows, false, b); if (s) out.push(s); }
    }
    return out.join('\n');
  }

  async imageData(img: ImageData, mask: Uint8Array | null): Promise<string> {
    const W = img.width, H = img.height, n = W * H, cmyk = this.o.cmyk, comps = cmyk ? 4 : 3, step = comps + (mask ? 1 : 0);
    const raw = new Uint8Array(n * step);
    for (let i = 0; i < n; i++) {
      let o = i * step;
      if (mask) raw[o++] = mask[i];
      const r = img.data[i * 4], g = img.data[i * 4 + 1], b = img.data[i * 4 + 2];
      if (cmyk) { const k = 255 - Math.max(r, g, b), d = 255 - k || 1; raw[o] = k === 255 ? 0 : Math.round(((255 - r - k) / d) * 255); raw[o + 1] = k === 255 ? 0 : Math.round(((255 - g - k) / d) * 255); raw[o + 2] = k === 255 ? 0 : Math.round(((255 - b - k) / d) * 255); raw[o + 3] = k; }
      else { raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; }
    }
    const decode = Array.from({ length: comps }, () => '0 1').join(' '), mat = `[${W} 0 0 ${H} 0 0]`, src = '/DataSource currentfile /ASCII85Decode filter /FlateDecode filter';
    const data = ascii85(await deflate(raw));
    const space = cmyk ? '/DeviceCMYK' : '/DeviceRGB';
    if (!mask) return `${space} setcolorspace\n<< /ImageType 1 /Width ${W} /Height ${H} /BitsPerComponent 8 /Decode [${decode}] /ImageMatrix ${mat} ${src} >> image\n${data}`;
    return `${space} setcolorspace\n<< /ImageType 3 /InterleaveType 1 /DataDict << /ImageType 1 /Width ${W} /Height ${H} /BitsPerComponent 8 /Decode [${decode}] /ImageMatrix ${mat} ${src} >> /MaskDict << /ImageType 1 /Width ${W} /Height ${H} /BitsPerComponent 8 /Decode [0 1] /ImageMatrix ${mat} >> >> image\n${data}`;
  }

  async picture(blob: Blob, w: number, h: number): Promise<string> {
    const bmp = await createImageBitmap(blob), c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.drawImage(bmp, 0, 0);
    bmp.close();
    const img = g.getImageData(0, 0, c.width, c.height);
    let mask: Uint8Array | null = null;
    for (let i = 0; i < c.width * c.height; i++) if (img.data[i * 4 + 3] < 255) { mask = new Uint8Array(c.width * c.height); break; }
    if (mask) for (let i = 0; i < mask.length; i++) mask[i] = img.data[i * 4 + 3] >= 128 ? 0 : 255;
    return `gsave ${f(w)} ${f(h)} scale\n${await this.imageData(img, mask)}\ngrestore`;
  }

  async rasterize(n: VNode): Promise<string> {
    const b = inflate(visualBounds(this.doc, n), 1);
    if (isEmptyRect(b) || b.w <= 0 || b.h <= 0) return '';
    const scale = this.o.ppi / 72;
    const backdrop = Object.assign(Object.create(Object.getPrototypeOf(this.p) as object) as Project, this.p, { doc: trimAfter(this.doc, n.id) });
    const flat = await renderRegion(backdrop, { region: b, scale, transparent: false });
    const own = await renderRegion(this.p, { region: b, scale, transparent: true, only: [n] });
    const fg = flat.getContext('2d') as CanvasRenderingContext2D, og = own.getContext('2d') as CanvasRenderingContext2D;
    const img = fg.getImageData(0, 0, flat.width, flat.height), cov = og.getImageData(0, 0, own.width, own.height);
    const mask = new Uint8Array(flat.width * flat.height);
    for (let i = 0; i < mask.length; i++) mask[i] = cov.data[i * 4 + 3] >= 8 ? 0 : 255;
    return `gsave ${f(b.x)} ${f(b.y)} translate ${f(b.w)} ${f(b.h)} scale\n${await this.imageData(img, mask)}\ngrestore`;
  }

  async node(n: VNode): Promise<string> {
    if (n.hidden) return '';
    if (n.kind === 'layer' && (n.printable === false || n.template)) return '';
    if (n.ap.effects.length) n = fxNode(this.doc, n) ?? n;
    if (n.kind !== 'layer' && this.needsRaster(n)) return this.rasterize(n);
    return this.body(n);
  }

  private async children(list: VNode[]): Promise<string> { const out: string[] = []; for (const c of list) out.push(await this.node(c)); return out.filter(Boolean).join('\n'); }

  async body(n: VNode): Promise<string> {
    const faces = n.kind !== 'layer' && has3d(n) ? threeDFaces(this.doc, n) : null;
    if (faces) return this.children(faces);
    switch (n.kind) {
      case 'layer': case 'group': {
        if (n.clip && n.children.length > 1) {
          const clipper = n.children[n.children.length - 1], geo = clipGeometry(clipper);
          const inner = await this.children(n.children.slice(0, -1));
          const strokes = geo ? this.shape({ ...clipper, ap: { ...clipper.ap, items: clipper.ap.items.filter((i) => i.kind === 'stroke') } }, geo.d, geo.rule === 'evenodd') : '';
          return `gsave\n${geo ? `${this.path(geo.d)}\n${geo.rule === 'evenodd' ? 'eoclip' : 'clip'} newpath\n` : ''}${inner}\ngrestore\n${strokes}`;
        }
        if (n.kind === 'group' && n.livePaint) return this.children([...liveFaceNodes(n), ...n.children]);
        if (n.kind === 'group' && (n.shaper || n.intertwine || isLive(n))) return this.children(derivedArt(n) ?? []);
        const inner = await this.children(n.children);
        if (!n.ap.items.length) return inner;
        const geo: PathData = [], collect = (x: VNode): void => { if (x.kind === 'path') geo.push(...x.d); else if (x.kind === 'compound') x.children.forEach((c) => geo.push(...c.d)); else childrenOf(x)?.forEach(collect); };
        collect(n);
        return geo.length ? [inner, this.shape(n, geo, false)].filter(Boolean).join('\n') : inner;
      }
      case 'blend': case 'envelope': case 'repeat': return this.children(liveChildren(this.doc, n));
      case 'path': return n.guide ? '' : this.shape(n, effectPath(n.d, n.ap.effects), n.rule === 'evenodd');
      case 'compound': return this.shape(n, effectPath(n.children.flatMap((c) => c.d), n.ap.effects), n.rule === 'evenodd');
      case 'text': {
        const d = this.outlines.get(n.id), st = n.spans[0]?.style;
        if (!d || !st) return '';
        const b = selectionBounds(this.doc, [n]), out: string[] = [];
        if (st.fill.type !== 'none') out.push(this.fillWith(st.fill, d, false, b));
        const sp = st.stroke.type !== 'none' && st.strokeWidth > 0 ? resolvePaint(this.doc, st.stroke) : null;
        if (sp?.type === 'color') out.push(`gsave ${this.color(sp.color)} ${f(st.strokeWidth)} setlinewidth 1 setlinejoin\n${this.path(d)}\nstroke grestore`);
        return out.filter(Boolean).join('\n');
      }
      case 'image': {
        const blob = this.p.assets.get(n.src);
        if (!blob) return '';
        return `gsave [${n.xf.map(f).join(' ')}] concat\n${await this.picture(blob, n.w, n.h)}\ngrestore`;
      }
      case 'symbol': {
        const art = instanceArt(this.doc, n);
        if (!art) return '';
        return `gsave [${n.xf.map(f).join(' ')}] concat\n${await this.node(art)}\ngrestore`;
      }
      default: return '';
    }
  }
}

const PROLOG = [
  '/formpathDict 40 dict def formpathDict begin',
  '/m { moveto } bind def /l { lineto } bind def /c { curveto } bind def /h { closepath } bind def',
  'end',
];

export async function exportEps(p: Project, o: EpsOptions): Promise<Blob> {
  const outlines = new Map<string, PathData>();
  const visit = async (n: VNode): Promise<void> => { if (n.kind === 'text') { const d = await outlineText(n); if (d) outlines.set(n.id, d); } for (const c of childrenOf(n) ?? []) await visit(c); };
  for (const l of p.doc.layers) await visit(l);
  for (const s of p.doc.symbols) await visit(s.art);
  const painter = new PsPainter(p, o, outlines);
  const r = o.region, W = Math.max(1, r.w), H = Math.max(1, r.h);
  const ab = p.doc.artboards.find((a) => Math.abs(a.x - r.x) < 1e-6 && Math.abs(a.y - r.y) < 1e-6 && Math.abs(a.w - r.w) < 1e-6 && Math.abs(a.h - r.h) < 1e-6);
  const body: string[] = [];
  if (ab?.bg) body.push(`gsave ${painter.color(ab.bg)} ${f(r.x)} ${f(r.y)} m ${f(r.x + r.w)} ${f(r.y)} l ${f(r.x + r.w)} ${f(r.y + r.h)} l ${f(r.x)} ${f(r.y + r.h)} l h fill grestore`);
  for (const l of p.doc.layers) { const s = await painter.node(l); if (s) body.push(`%%BeginLayer: ${(l.name ?? 'Layer').replace(/[\r\n]/g, ' ')}\n${s}\n%%EndLayer`); }
  const head = [
    '%!PS-Adobe-3.0 EPSF-3.0',
    `%%Creator: ${`formpath ${o.version ?? ''}`.trim()}`,
    `%%Title: ${(o.title ?? p.name).replace(/[\r\n]/g, ' ')}`,
    `%%CreationDate: ${new Date().toISOString()}`,
    `%%BoundingBox: 0 0 ${Math.ceil(W)} ${Math.ceil(H)}`,
    `%%HiResBoundingBox: 0 0 ${f(W)} ${f(H)}`,
    '%%LanguageLevel: 3',
    '%%DocumentData: Clean7Bit',
    `%%DocumentProcessColors: ${o.cmyk ? 'Cyan Magenta Yellow Black' : 'Black'}`,
    '%%Pages: 1',
    '%%EndComments',
  ];
  const embed: string[] = [];
  if (o.preserve) {
    const { manifest, files } = serialize(p);
    const assets: Record<string, string> = {};
    for (const fp of files) { const b = new Uint8Array(await fp.blob.arrayBuffer()); let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000)); assets[fp.name] = `data:${fp.blob.type || 'application/octet-stream'};base64,${btoa(bin)}`; }
    const json = new TextEncoder().encode(JSON.stringify({ formpathEps: 1, manifest, assets }));
    let bin = ''; for (let i = 0; i < json.length; i += 0x8000) bin += String.fromCharCode(...json.subarray(i, i + 0x8000));
    const b64 = btoa(bin);
    embed.push(EMBED_BEGIN);
    for (let i = 0; i < b64.length; i += 240) embed.push(`${EMBED_LINE}${b64.slice(i, i + 240)}`);
    embed.push(EMBED_END);
  }
  const text = [
    ...head,
    '%%BeginProlog', ...PROLOG, '%%EndProlog',
    '%%Page: 1 1',
    'save formpathDict begin',
    `[1 0 0 -1 ${f(-r.x)} ${f(r.y + r.h)}] concat`,
    ...body,
    'end restore',
    'showpage',
    '%%Trailer',
    ...embed,
    '%%EOF',
    '',
  ].join('\n');
  return new Blob([text], { type: 'application/postscript' });
}

export function readEpsNative(data: ArrayBuffer): { manifest: Record<string, unknown>; assets: Map<string, Blob> } | null {
  const text = new TextDecoder('latin1').decode(new Uint8Array(data));
  const a = text.indexOf(EMBED_BEGIN), z = text.indexOf(EMBED_END, a);
  if (a < 0 || z < 0) return null;
  const b64 = text.slice(a + EMBED_BEGIN.length, z).split(/\r?\n/).filter((x) => x.startsWith(EMBED_LINE)).map((x) => x.slice(EMBED_LINE.length).trim()).join('');
  try {
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { manifest: Record<string, unknown>; assets: Record<string, string> };
    const assets = new Map<string, Blob>();
    for (const [k, v] of Object.entries(parsed.assets ?? {})) {
      const m = /^data:([^;,]+)?;base64,(.*)$/s.exec(v);
      if (!m) continue;
      const s = atob(m[2]), buf = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i);
      assets.set(k, new Blob([buf], { type: m[1] ?? 'application/octet-stream' }));
    }
    return { manifest: parsed.manifest, assets };
  } catch { return null; }
}
