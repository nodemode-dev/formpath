import { selectionBounds, visualBounds } from '../engine/bounds';
import { childrenOf } from '../engine/doc';
import { arrowGeometry, brushGeometry, effectPath, rasterEffects, strokeOutline } from '../engine/effects';
import { inflate, isEmptyRect, isLineSeg, segments } from '../engine/geometry';
import { liveChildren } from '../engine/live';
import { gradientAt, resolvePaint, toCmyk, toRgb } from '../engine/paint';
import { clipGeometry, gradientGeom } from '../engine/render';
import type { BlendMode, Color, Doc, Gradient, Mat, Paint, PathData, Project, Rect, StrokeItem, VNode } from '../engine';
import { outlineText } from './fonts';
import { renderRegion } from './raster';
import { serialize } from './project-io';

export interface PdfOptions { artboards: number[]; preserve: boolean; ppi: number; title?: string; version?: string }

const BM: Partial<Record<BlendMode, string>> = { multiply: 'Multiply', screen: 'Screen', overlay: 'Overlay', darken: 'Darken', lighten: 'Lighten', color_dodge: 'ColorDodge', color_burn: 'ColorBurn', hard_light: 'HardLight', soft_light: 'SoftLight', difference: 'Difference', exclusion: 'Exclusion', hue: 'Hue', saturation: 'Saturation', color: 'Color', luminosity: 'Luminosity' };
const f = (v: number): string => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };
const pdfString = (s: string): string => `(${s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '?')})`;

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') return data;
  const cs = new CompressionStream('deflate');
  const out = new Response(new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(cs));
  return new Uint8Array(await out.arrayBuffer());
}

class PdfFile {
  private objs: Array<Uint8Array | null> = [null];
  private readonly enc = new TextEncoder();
  reserve(): number { this.objs.push(null); return this.objs.length - 1; }
  set(id: number, dict: string, stream?: Uint8Array): void {
    if (!stream) { this.objs[id] = this.enc.encode(`${id} 0 obj\n${dict}\nendobj\n`); return; }
    const head = this.enc.encode(`${id} 0 obj\n${dict.replace(/>>\s*$/, `/Length ${stream.length} >>`)}\nstream\n`), tail = this.enc.encode('\nendstream\nendobj\n');
    const all = new Uint8Array(head.length + stream.length + tail.length);
    all.set(head, 0); all.set(stream, head.length); all.set(tail, head.length + stream.length);
    this.objs[id] = all;
  }
  add(dict: string, stream?: Uint8Array): number { const id = this.reserve(); this.set(id, dict, stream); return id; }
  build(root: number, info: number): Blob {
    const parts: Uint8Array[] = [this.enc.encode('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n')];
    let pos = parts[0].length;
    const offsets: number[] = [0];
    for (let i = 1; i < this.objs.length; i++) { offsets.push(pos); const o = this.objs[i] ?? this.enc.encode(`${i} 0 obj\nnull\nendobj\n`); parts.push(o); pos += o.length; }
    const xref = [`xref\n0 ${this.objs.length}\n0000000000 65535 f \n`, ...offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
    parts.push(this.enc.encode(`${xref}trailer\n<< /Size ${this.objs.length} /Root ${root} 0 R /Info ${info} 0 R >>\nstartxref\n${pos}\n%%EOF\n`));
    return new Blob(parts as Uint8Array<ArrayBuffer>[], { type: 'application/pdf' });
  }
}

class Painter {
  readonly gs = new Map<string, number>();
  readonly patterns = new Map<string, number>();
  readonly xobjects = new Map<string, number>();
  private n = 0;
  constructor(private readonly pdf: PdfFile, private readonly p: Project, private readonly o: PdfOptions, private readonly cmyk: boolean, private readonly outlines: Map<string, PathData>) {}
  get doc(): Doc { return this.p.doc; }
  name(prefix: string): string { this.n++; return `${prefix}${this.n}`; }

  path(d: PathData): string {
    const out: string[] = [];
    for (const sp of d) {
      if (!sp.pts.length) continue;
      out.push(`${f(sp.pts[0].x)} ${f(sp.pts[0].y)} m`);
      const segs = segments(sp);
      for (const s of segs) out.push(isLineSeg(s) ? `${f(s[3].x)} ${f(s[3].y)} l` : `${f(s[1].x)} ${f(s[1].y)} ${f(s[2].x)} ${f(s[2].y)} ${f(s[3].x)} ${f(s[3].y)} c`);
      if (sp.closed) out.push('h');
    }
    return out.join('\n');
  }

  color(c: Color, stroke: boolean): string {
    if (this.cmyk || c.kind === 'cmyk') { const k = toCmyk(c); if (k.kind === 'cmyk') return `${f(k.c / 100)} ${f(k.m / 100)} ${f(k.y / 100)} ${f(k.k / 100)} ${stroke ? 'K' : 'k'}`; }
    if (c.kind === 'gray') return `${f(1 - c.k / 100)} ${stroke ? 'G' : 'g'}`;
    const v = toRgb(c);
    return `${f(v.r / 255)} ${f(v.g / 255)} ${f(v.b / 255)} ${stroke ? 'RG' : 'rg'}`;
  }

  extGState(alpha: number, stroke: boolean, blend: BlendMode = 'normal'): string {
    const key = `${f(alpha)}|${stroke}|${blend}`;
    let id = this.gs.get(key);
    if (!id) { id = this.pdf.add(`<< /Type /ExtGState ${stroke ? `/CA ${f(alpha)}` : `/ca ${f(alpha)}`}${BM[blend] ? ` /BM /${BM[blend]}` : ''} >>`); this.gs.set(key, id); }
    return `/GS${id} gs`;
  }

  fnFor(gr: Gradient): string {
    const stops = [...gr.stops].sort((a, b) => a.offset - b.offset);
    const comp = (c: Color): string => { if (this.cmyk) { const k = toCmyk(c); return k.kind === 'cmyk' ? `${f(k.c / 100)} ${f(k.m / 100)} ${f(k.y / 100)} ${f(k.k / 100)}` : '0 0 0 1'; } const v = toRgb(c); return `${f(v.r / 255)} ${f(v.g / 255)} ${f(v.b / 255)}`; };
    const pts: Array<{ t: number; c: Color }> = [];
    if (stops[0].offset > 0) pts.push({ t: 0, c: stops[0].color });
    stops.forEach((s, i) => { pts.push({ t: s.offset, c: s.color }); const nx = stops[i + 1]; if (nx && Math.abs(s.mid - 0.5) > 0.01) { const t = s.offset + (nx.offset - s.offset) * s.mid; pts.push({ t, c: gradientAt(gr, t).color }); } });
    if (stops[stops.length - 1].offset < 1) pts.push({ t: 1, c: stops[stops.length - 1].color });
    const fns: string[] = [], bounds: string[] = [], encode: string[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      fns.push(`<< /FunctionType 2 /Domain [0 1] /C0 [${comp(pts[i].c)}] /C1 [${comp(pts[i + 1].c)}] /N 1 >>`);
      if (i > 0) bounds.push(f(pts[i].t));
      encode.push('0 1');
    }
    return fns.length === 1 ? fns[0] : `<< /FunctionType 3 /Domain [0 1] /Functions [${fns.join(' ')}] /Bounds [${bounds.join(' ')}] /Encode [${encode.join(' ')}] >>`;
  }

  pattern(gr: Gradient, b: Rect, page: Mat): number {
    const g = gradientGeom(gr, b), cs = this.cmyk ? '/DeviceCMYK' : '/DeviceRGB';
    const coords = gr.kind === 'radial' ? `[${f(g.fx ?? g.x1)} ${f(g.fy ?? g.y1)} 0 ${f(g.x1)} ${f(g.y1)} ${f(Math.hypot(g.x2 - g.x1, g.y2 - g.y1))}]` : `[${f(g.x1)} ${f(g.y1)} ${f(g.x2)} ${f(g.y2)}]`;
    const sh = this.pdf.add(`<< /ShadingType ${gr.kind === 'radial' ? 3 : 2} /ColorSpace ${cs} /Coords ${coords} /Function ${this.fnFor(gr)} /Extend [true true] >>`);
    const id = this.pdf.add(`<< /Type /Pattern /PatternType 2 /Shading ${sh} 0 R /Matrix [${page.map(f).join(' ')}] >>`);
    this.patterns.set(`P${id}`, id);
    return id;
  }

  paint(raw: Paint, stroke: boolean, b: Rect, page: Mat): string | null {
    const p = resolvePaint(this.doc, raw);
    if (p.type === 'none') return null;
    if (p.type === 'color') return this.color(p.color, stroke);
    if (p.type === 'gradient' && p.gradient.kind !== 'freeform' && p.gradient.stops.length) { const id = this.pattern(p.gradient, b, page); return `/Pattern ${stroke ? 'CS' : 'cs'} /P${id} ${stroke ? 'SCN' : 'scn'}`; }
    return null;
  }

  needsRaster(n: VNode): boolean {
    if (rasterEffects(n).length || (n.mask && !n.mask.disabled) || n.kind === 'mesh') return true;
    if (n.kind === 'text' && !this.outlines.has(n.id)) return true;
    return n.ap.items.some((i) => i.visible && (i.paint.type === 'pattern' || (i.paint.type === 'gradient' && i.paint.gradient.kind === 'freeform')));
  }

  shape(n: VNode, d: PathData, rule: string, page: Mat): string {
    const b = selectionBounds(this.doc, [n]), out: string[] = [];
    for (const it of n.ap.items) {
      if (!it.visible) continue;
      const id = it.effects.some((e) => e.visible) ? effectPath(d, it.effects) : d;
      if (it.kind === 'fill') {
        const c = this.paint(it.paint, false, b, page);
        if (!c) continue;
        out.push(`q ${it.opacity < 1 || it.blend !== 'normal' ? this.extGState(it.opacity, false, it.blend) : ''} ${c}\n${this.path(id)}\n${rule === 'evenodd' ? 'f*' : 'f'} Q`);
        continue;
      }
      if (it.width <= 0) continue;
      const c = this.paint(it.paint, true, b, page), cf = this.paint(it.paint, false, b, page);
      if (!c || !cf) continue;
      const gsx = it.opacity < 1 || it.blend !== 'normal' ? `${this.extGState(it.opacity, true, it.blend)} ${this.extGState(it.opacity, false, it.blend)}` : '';
      const brush = it.brush ? brushGeometry(this.doc, id, it) : null;
      if (brush) { for (const part of brush) out.push(`q ${gsx} ${part.paint ? this.paint(part.paint, false, b, page) ?? cf : cf}\n${this.path(part.d)}\nf Q`); continue; }
      const closed = id.every((sp) => sp.closed);
      if (it.profile && it.profile.length) out.push(`q ${gsx} ${cf}\n${this.path(strokeOutline(id, it))}\nf Q`);
      else {
        const clip = it.align === 'inside' && closed ? `${this.path(id)}\n${rule === 'evenodd' ? 'W*' : 'W'} n\n` : it.align === 'outside' && closed ? `${this.path([{ closed: true, pts: [{ x: b.x - 1e4, y: b.y - 1e4, ix: b.x - 1e4, iy: b.y - 1e4, ox: b.x - 1e4, oy: b.y - 1e4 }, { x: b.x + 1e4, y: b.y - 1e4, ix: b.x + 1e4, iy: b.y - 1e4, ox: b.x + 1e4, oy: b.y - 1e4 }, { x: b.x + 1e4, y: b.y + 1e4, ix: b.x + 1e4, iy: b.y + 1e4, ox: b.x + 1e4, oy: b.y + 1e4 }, { x: b.x - 1e4, y: b.y + 1e4, ix: b.x - 1e4, iy: b.y + 1e4, ox: b.x - 1e4, oy: b.y + 1e4 }] }, ...id])}\nW* n\n` : '';
        const w = clip ? it.width * 2 : it.width;
        out.push(`q ${gsx} ${clip}${c} ${f(w)} w ${it.cap === 'round' ? 1 : it.cap === 'square' ? 2 : 0} J ${it.join === 'round' ? 1 : it.join === 'bevel' ? 2 : 0} j ${f(it.miter)} M [${it.dash.map(f).join(' ')}] ${f(it.dashOffset)} d\n${this.path(id)}\nS Q`);
      }
      const arrows = arrowGeometry(id, it);
      if (arrows) out.push(`q ${gsx} ${cf}\n${this.path(arrows)}\nf Q`);
    }
    return out.join('\n');
  }

  async image(key: string, blob: Blob): Promise<number> {
    const had = this.xobjects.get(key);
    if (had) return had;
    let id: number;
    if (blob.type === 'image/jpeg') {
      const bmp = await createImageBitmap(blob);
      id = this.pdf.add(`<< /Type /XObject /Subtype /Image /Width ${bmp.width} /Height ${bmp.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode >>`, new Uint8Array(await blob.arrayBuffer()));
      bmp.close();
    } else {
      const bmp = await createImageBitmap(blob), c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      g.drawImage(bmp, 0, 0);
      bmp.close();
      id = await this.rgba(g.getImageData(0, 0, c.width, c.height));
    }
    this.xobjects.set(key, id);
    return id;
  }

  async rgba(img: ImageData): Promise<number> {
    const n = img.width * img.height, rgb = new Uint8Array(n * 3), a = new Uint8Array(n);
    let alpha = false;
    for (let i = 0; i < n; i++) { rgb[i * 3] = img.data[i * 4]; rgb[i * 3 + 1] = img.data[i * 4 + 1]; rgb[i * 3 + 2] = img.data[i * 4 + 2]; a[i] = img.data[i * 4 + 3]; if (a[i] < 255) alpha = true; }
    const smask = alpha ? this.pdf.add(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode >>`, await deflate(a)) : 0;
    return this.pdf.add(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${smask ? ` /SMask ${smask} 0 R` : ''} >>`, await deflate(rgb));
  }

  async rasterize(n: VNode): Promise<string> {
    const b = inflate(visualBounds(this.doc, n), 1);
    if (isEmptyRect(b) || b.w <= 0 || b.h <= 0) return '';
    const c = await renderRegion(this.p, { region: b, scale: this.o.ppi / 72, transparent: true, only: [n] });
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    const id = await this.rgba(g.getImageData(0, 0, c.width, c.height));
    this.xobjects.set(this.name('R'), id);
    return `q ${f(b.w)} 0 0 ${f(-b.h)} ${f(b.x)} ${f(b.y + b.h)} cm /Im${id} Do Q`;
  }

  async group(n: VNode, body: string): Promise<string> {
    const b = inflate(visualBounds(this.doc, n), 2);
    const content = await deflate(new TextEncoder().encode(body));
    const id = this.pdf.add(`<< /Type /XObject /Subtype /Form /BBox [${f(b.x)} ${f(b.y)} ${f(b.x + b.w)} ${f(b.y + b.h)}] /Group << /Type /Group /S /Transparency /I true >> /Resources ${RES} 0 R /Filter /FlateDecode >>`, content);
    this.xobjects.set(this.name('F'), id);
    return `q ${this.extGState(n.opacity, false, n.blend)} ${this.extGState(n.opacity, true, n.blend)} /Im${id} Do Q`;
  }

  async node(n: VNode, page: Mat): Promise<string> {
    if (n.hidden) return '';
    if (n.kind === 'layer' && (n.printable === false || n.template)) return '';
    if (this.needsRaster(n)) return this.rasterize(n);
    const kids = childrenOf(n), asForm = (n.opacity < 1 || n.blend !== 'normal') && (!!kids || n.ap.items.filter((i) => i.visible).length > 1);
    const body = await this.body(n, asForm ? [1, 0, 0, 1, 0, 0] : page);
    if (!body) return '';
    if (asForm) return this.group(n, body);
    if (n.opacity < 1 || n.blend !== 'normal') return `q ${this.extGState(n.opacity, false, n.blend)} ${this.extGState(n.opacity, true, n.blend)}\n${body}\nQ`;
    return body;
  }

  private async children(list: VNode[], page: Mat): Promise<string> { const out: string[] = []; for (const c of list) out.push(await this.node(c, page)); return out.filter(Boolean).join('\n'); }

  async body(n: VNode, page: Mat): Promise<string> {
    switch (n.kind) {
      case 'layer': case 'group': {
        if (n.clip && n.children.length > 1) {
          const clipper = n.children[n.children.length - 1], geo = clipGeometry(clipper);
          const inner = await this.children(n.children.slice(0, -1), page);
          const strokes = geo ? this.shape({ ...clipper, ap: { ...clipper.ap, items: clipper.ap.items.filter((i) => i.kind === 'stroke') } }, geo.d, geo.rule, page) : '';
          return `q\n${geo ? `${this.path(geo.d)}\n${geo.rule === 'evenodd' ? 'W*' : 'W'} n\n` : ''}${inner}\nQ\n${strokes}`;
        }
        return this.children(n.children, page);
      }
      case 'blend': case 'envelope': case 'repeat': return this.children(liveChildren(this.doc, n), page);
      case 'path': return n.guide ? '' : this.shape(n, effectPath(n.d, n.ap.effects), n.rule, page);
      case 'compound': return this.shape(n, effectPath(n.children.flatMap((c) => c.d), n.ap.effects), n.rule, page);
      case 'text': {
        const d = this.outlines.get(n.id), st = n.spans[0]?.style;
        if (!d || !st) return '';
        const b = selectionBounds(this.doc, [n]);
        const fill = this.paint(st.fill, false, b, page), stroke = st.stroke.type !== 'none' && st.strokeWidth > 0 ? this.paint(st.stroke, true, b, page) : null;
        return [fill ? `q ${fill}\n${this.path(d)}\nf Q` : '', stroke ? `q ${stroke} ${f(st.strokeWidth)} w 1 j\n${this.path(d)}\nS Q` : ''].filter(Boolean).join('\n');
      }
      case 'image': {
        const blob = this.p.assets.get(n.src);
        if (!blob) return '';
        const id = await this.image(n.src, blob);
        return `q ${n.xf.map(f).join(' ')} cm ${f(n.w)} 0 0 ${f(-n.h)} 0 ${f(n.h)} cm /Im${id} Do Q`;
      }
      case 'symbol': {
        const s = this.doc.symbols.find((x) => x.id === n.symbol);
        if (!s) return '';
        return `q ${n.xf.map(f).join(' ')} cm\n${await this.node(s.art, page)}\nQ`;
      }
      default: return '';
    }
  }
}

let RES = 0;

export async function exportPdf(p: Project, o: PdfOptions): Promise<Blob> {
  const pdf = new PdfFile();
  const outlines = new Map<string, PathData>();
  const visit = async (n: VNode): Promise<void> => { if (n.kind === 'text') { const d = await outlineText(n); if (d) outlines.set(n.id, d); } for (const c of childrenOf(n) ?? []) await visit(c); };
  for (const l of p.doc.layers) await visit(l);
  for (const s of p.doc.symbols) await visit(s.art);
  const painter = new Painter(pdf, p, o, p.doc.colorMode === 'cmyk', outlines);
  RES = pdf.reserve();
  const pagesId = pdf.reserve();
  const pageIds: number[] = [];
  for (const i of o.artboards.length ? o.artboards : p.doc.artboards.map((_, k) => k)) {
    const a = p.doc.artboards[i];
    if (!a) continue;
    const page: Mat = [1, 0, 0, -1, -a.x, a.y + a.h];
    const parts: string[] = [`1 0 0 -1 ${f(-a.x)} ${f(a.y + a.h)} cm`];
    if (a.bg) parts.push(`q ${painter.color(a.bg, false)} ${f(a.x)} ${f(a.y)} ${f(a.w)} ${f(a.h)} re f Q`);
    for (const l of p.doc.layers) parts.push(await painter.node(l, page));
    const content = pdf.add('<< /Filter /FlateDecode >>', await deflate(new TextEncoder().encode(parts.filter(Boolean).join('\n'))));
    pageIds.push(pdf.add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f(a.w)} ${f(a.h)}] /TrimBox [0 0 ${f(a.w)} ${f(a.h)}] /Resources ${RES} 0 R /Contents ${content} 0 R >>`));
  }
  const res = (m: Map<string, number>, pre: string): string => [...m.values()].map((id) => `/${pre}${id} ${id} 0 R`).join(' ');
  pdf.set(RES, `<< /ProcSet [/PDF /ImageC /ImageB] /ExtGState << ${res(painter.gs, 'GS')} >> /Pattern << ${res(painter.patterns, 'P')} >> /XObject << ${res(painter.xobjects, 'Im')} >> >>`);
  pdf.set(pagesId, `<< /Type /Pages /Kids [${pageIds.map((x) => `${x} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  let names = '';
  if (o.preserve) {
    const { manifest, files } = serialize(p);
    const assets: Record<string, string> = {};
    for (const fp of files) { const b = new Uint8Array(await fp.blob.arrayBuffer()); let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000)); assets[fp.name] = `data:${fp.blob.type || 'application/octet-stream'};base64,${btoa(bin)}`; }
    const payload = new TextEncoder().encode(JSON.stringify({ formpthPdf: 1, manifest, assets }));
    const ef = pdf.add('<< /Type /EmbeddedFile /Subtype /application#2Fjson >>', payload);
    const spec = pdf.add(`<< /Type /Filespec /F (formpth-document.json) /UF (formpth-document.json) /Desc (formpth editing data) /EF << /F ${ef} 0 R >> /AFRelationship /Source >>`);
    names = ` /Names << /EmbeddedFiles << /Names [(formpth-document.json) ${spec} 0 R] >> >> /AF [${spec} 0 R]`;
  }
  const root = pdf.add(`<< /Type /Catalog /Pages ${pagesId} 0 R${names} >>`);
  const now = new Date(), stamp = `D:${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}Z`;
  const info = pdf.add(`<< /Title ${pdfString(o.title ?? p.doc.title ?? p.name)} /Producer ${pdfString(`formpth ${o.version ?? ''}`.trim())} /Creator (formpth) /CreationDate (${stamp}) >>`);
  return pdf.build(root, info);
}

export async function readPdfNative(data: ArrayBuffer): Promise<{ manifest: Record<string, unknown>; assets: Map<string, Blob> } | null> {
  const bytes = new Uint8Array(data), text = new TextDecoder('latin1').decode(bytes);
  const at = text.indexOf('{"formpthPdf":1');
  if (at < 0) return null;
  const end = text.indexOf('\nendstream', at);
  if (end < 0) return null;
  const json = new TextDecoder().decode(bytes.subarray(at, end));
  const parsed = JSON.parse(json) as { manifest: Record<string, unknown>; assets: Record<string, string> };
  const assets = new Map<string, Blob>();
  for (const [k, v] of Object.entries(parsed.assets ?? {})) {
    const m = /^data:([^;,]+)?;base64,(.*)$/s.exec(v);
    if (!m) continue;
    const bin = atob(m[2]), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    assets.set(k, new Blob([buf], { type: m[1] ?? 'application/octet-stream' }));
  }
  return { manifest: parsed.manifest, assets };
}
