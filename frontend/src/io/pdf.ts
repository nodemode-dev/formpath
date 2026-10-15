import { selectionBounds, visualBounds } from '../engine/bounds';
import { cornered } from '../engine/corners';
import { childrenOf } from '../engine/doc';
import { arrowGeometry, brushGeometry, effectPath, has3d, rasterEffects, rasterEffectsOf, strokeOutline, threeDFaces } from '../engine/effects';
import { inflate, isEmptyRect, isLineSeg, pathBounds, segments, unionRect } from '../engine/geometry';
import { liveChildren } from '../engine/live';
import { liveFaceNodes } from '../engine/livepaint';
import { derivedArt } from '../engine/shaper';
import { latticeCopies, patternLattice } from '../engine/pattern';
import { freeformShading, meshHasAlpha, meshShading } from './pdf-shading';
import { instanceArt } from '../engine/symbolism';
import { gradientAt, perceptualStops, resolvePaint, toCmyk, toRgb } from '../engine/paint';
import { clipGeometry, gradientGeom, knockoutShape, knocksOut } from '../engine/render';
import { gradientStrokeArt, strokeGradient, strokeRegion, type GradientStrokeArt, type StrokePiece } from '../engine/stroke-gradient';
import type { BlendMode, CharStyle, Color, Doc, FillRule, Gradient, Mat, Paint, PathData, PatternDef, Project, Rect, StrokeItem, VNode } from '../engine';
import { outlineText } from './fonts';
import { renderRegion } from './raster';
import { serialize } from './project-io';
import { bleedFor, marksActive, marksContent, pageGeometry, type PdfMarks } from './pdf-marks';
import { pdfxParts } from './pdf-x';
import { outputProfileBytes } from '../engine/color-management';
import { embeddedMarkFont, LiveFonts, liveStream, type Ink, type LiveText } from './pdf-text';

export interface PdfOptions { artboards: number[]; preserve: boolean; ppi: number; title?: string; version?: string; marks?: PdfMarks; liveText?: boolean; standard?: 'none' | 'x4' }

const BM: Partial<Record<BlendMode, string>> = { multiply: 'Multiply', screen: 'Screen', overlay: 'Overlay', darken: 'Darken', lighten: 'Lighten', color_dodge: 'ColorDodge', color_burn: 'ColorBurn', hard_light: 'HardLight', soft_light: 'SoftLight', difference: 'Difference', exclusion: 'Exclusion', hue: 'Hue', saturation: 'Saturation', color: 'Color', luminosity: 'Luminosity' };
export const PDF_MAX_SIDE = 14400;
const f6 = (v: number): string => { const r = Math.round(v * 1e6) / 1e6; return Object.is(r, -0) ? '0' : String(r); };
const f = (v: number): string => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };
const pdfName = (s: string): string => (s || 'Spot').replace(/[^\x21-\x7e]|[#()<>[\]{}/%]/g, (ch) => [...new TextEncoder().encode(ch)].map((b) => `#${b.toString(16).padStart(2, '0')}`).join(''));
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
  build(root: number, info: number, version = '1.7', id = ''): Blob {
    const parts: Uint8Array[] = [this.enc.encode(`%PDF-${version}\n%\xe2\xe3\xcf\xd3\n`)];
    let pos = parts[0].length;
    const offsets: number[] = [0];
    for (let i = 1; i < this.objs.length; i++) { offsets.push(pos); const o = this.objs[i] ?? this.enc.encode(`${i} 0 obj\nnull\nendobj\n`); parts.push(o); pos += o.length; }
    const xref = [`xref\n0 ${this.objs.length}\n0000000000 65535 f \n`, ...offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
    parts.push(this.enc.encode(`${xref}trailer\n<< /Size ${this.objs.length} /Root ${root} 0 R /Info ${info} 0 R${id ? ` /ID [<${id}> <${id}>]` : ''} >>\nstartxref\n${pos}\n%%EOF\n`));
    return new Blob(parts as Uint8Array<ArrayBuffer>[], { type: 'application/pdf' });
  }
}

class Painter {
  readonly gs = new Map<string, number>();
  readonly patterns = new Map<string, number>();
  readonly xobjects = new Map<string, number>();
  readonly spaces = new Map<string, number>();
  readonly shadings = new Map<string, number>();
  private readonly tiles = new Map<string, { form: number; def: PatternDef; box: Rect }>();
  private readonly ffShadings = new WeakMap<Gradient, { key: string; id: number }>();
  private readonly jobs: Promise<void>[] = [];
  private n = 0;
  constructor(private readonly pdf: PdfFile, private readonly p: Project, private readonly o: PdfOptions, private readonly cmyk: boolean, private readonly outlines: Map<string, PathData>, private readonly live: LiveFonts, private readonly plans: Map<string, LiveText>) {}
  get doc(): Doc { return this.p.doc; }
  name(prefix: string): string { this.n++; return `${prefix}${this.n}`; }

  path(d: PathData): string {
    const out: string[] = [];
    for (const sp of cornered(d)) {
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

  extGState(alpha: number, stroke: boolean, blend: BlendMode = 'normal', ais = false, op = false): string {
    const key = `${f(alpha)}|${stroke}|${blend}|${ais}${op ? '|op' : ''}`;
    let id = this.gs.get(key);
    if (!id) { id = this.pdf.add(`<< /Type /ExtGState ${stroke ? `/CA ${f(alpha)}` : `/ca ${f(alpha)}`}${BM[blend] ? ` /BM /${BM[blend]}` : ''}${ais ? ' /AIS true' : ''}${op ? ' /OP true /op true /OPM 1' : ''} >>`); this.gs.set(key, id); }
    return `/GS${id} gs`;
  }

  fnFor(gr: Gradient): string {
    const stops = [...gr.stops].sort((a, b) => a.offset - b.offset);
    const comp = (c: Color): string => { if (this.cmyk) { const k = toCmyk(c); return k.kind === 'cmyk' ? `${f(k.c / 100)} ${f(k.m / 100)} ${f(k.y / 100)} ${f(k.k / 100)}` : '0 0 0 1'; } const v = toRgb(c); return `${f(v.r / 255)} ${f(v.g / 255)} ${f(v.b / 255)}`; };
    const pts: Array<{ t: number; c: Color }> = [];
    if (stops[0].offset > 0) pts.push({ t: 0, c: stops[0].color });
    const pst = perceptualStops(gr);
    if (pst) for (const s of pst) pts.push({ t: s.t, c: s.color });
    else stops.forEach((s, i) => { pts.push({ t: s.offset, c: s.color }); const nx = stops[i + 1]; if (nx && Math.abs(s.mid - 0.5) > 0.01) { const t = s.offset + (nx.offset - s.offset) * s.mid; pts.push({ t, c: gradientAt(gr, t).color }); } });
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
    const id = this.pdf.add(`<< /Type /Pattern /PatternType 2 /Shading ${sh} 0 R /Matrix [${page.map(f6).join(' ')}] >>`);
    this.patterns.set(`P${id}`, id);
    return id;
  }

  defer(id: number, dict: string, data: Uint8Array): void {
    this.jobs.push(deflate(data).then((z) => this.pdf.set(id, dict.replace(/>>\s*$/, '/Filter /FlateDecode >>'), z)));
  }

  async flush(): Promise<void> { await Promise.all(this.jobs); }

  private mul(a: Mat, b: Mat): Mat {
    return [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
  }

  freeformPattern(gr: Gradient, b: Rect, page: Mat): number | null {
    if (!gr.points?.length || isEmptyRect(b) || b.w <= 0 || b.h <= 0) return null;
    const box = inflate(b, 0.5), key = `${box.x},${box.y},${box.w},${box.h}`;
    let hit = this.ffShadings.get(gr);
    if (!hit || hit.key !== key) {
      const s = freeformShading(gr, box, this.cmyk), sid = this.pdf.reserve();
      this.defer(sid, s.dict, s.stream);
      hit = { key, id: sid };
      this.ffShadings.set(gr, hit);
    }
    const id = this.pdf.add(`<< /Type /Pattern /PatternType 2 /Shading ${hit.id} 0 R /Matrix [${page.map(f6).join(' ')}] >>`);
    this.patterns.set(`P${id}`, id);
    return id;
  }

  patternPaint(pid: string, xf: Mat, page: Mat): number | null {
    const t = this.tiles.get(pid);
    if (!t) return null;
    const l = patternLattice(t.def), tl = t.def.tile;
    const content = latticeCopies(t.def, 1).map((o) => `q 1 0 0 1 ${f6(o.x)} ${f6(o.y)} cm /Im${t.form} Do Q`).join('\n');
    const id = this.pdf.add(`<< /Type /Pattern /PatternType 1 /PaintType 1 /TilingType 1 /BBox [${f6(tl.x)} ${f6(tl.y)} ${f6(tl.x + l.w)} ${f6(tl.y + l.h)}] /XStep ${f6(l.w)} /YStep ${f6(l.h)} /Matrix [${this.mul(xf, page).map(f6).join(' ')}] /Resources ${RES} 0 R >>`, new TextEncoder().encode(content));
    this.patterns.set(`P${id}`, id);
    return id;
  }

  private patternsIn(root: VNode): string[] {
    const out = new Set<string>(), seen = new Set<VNode>();
    const add = (raw: Paint): void => { const p = resolvePaint(this.doc, raw); if (p.type === 'pattern') out.add(p.pattern); };
    const walk = (n: VNode): void => {
      if (seen.has(n)) return;
      seen.add(n);
      n.ap.items.forEach((i) => add(i.paint));
      if (n.kind === 'text') n.spans.forEach((s) => { add(s.style.fill); add(s.style.stroke); });
      if (n.mask) walk(n.mask.art);
      if (n.kind === 'symbol') { const a = instanceArt(this.doc, n); if (a) walk(a); }
      if (n.kind === 'blend' || n.kind === 'envelope' || n.kind === 'repeat') liveChildren(this.doc, n).forEach(walk);
      childrenOf(n)?.forEach(walk);
    };
    walk(root);
    return [...out];
  }

  private async buildPattern(pid: string, active: Set<string>): Promise<void> {
    if (this.tiles.has(pid) || active.has(pid)) return;
    const def = this.doc.patterns.find((x) => x.id === pid);
    if (!def || def.tile.w <= 0 || def.tile.h <= 0) return;
    active.add(pid);
    for (const dep of this.patternsIn(def.art)) await this.buildPattern(dep, active);
    const b = inflate(visualBounds(this.doc, def.art), 2), inKo = this.ko;
    this.ko = false;
    const body = await this.node(def.art, [1, 0, 0, 1, 0, 0]);
    this.ko = inKo;
    const form = this.pdf.reserve();
    this.defer(form, `<< /Type /XObject /Subtype /Form /BBox [${f(b.x)} ${f(b.y)} ${f(b.x + b.w)} ${f(b.y + b.h)}] /Resources ${RES} 0 R >>`, new TextEncoder().encode(body));
    this.xobjects.set(this.name('F'), form);
    this.tiles.set(pid, { form, def, box: b });
  }

  async prepare(): Promise<void> {
    const ids = new Set<string>();
    for (const l of this.doc.layers) this.patternsIn(l).forEach((x) => ids.add(x));
    for (const s of this.doc.symbols) this.patternsIn(s.art).forEach((x) => ids.add(x));
    const active = new Set<string>();
    for (const id of ids) await this.buildPattern(id, active);
  }

  separation(raw: Paint, stroke: boolean): string | null {
    if (raw.type !== 'color' || !raw.swatch) return null;
    const sw = this.doc.swatches.find((s) => s.id === raw.swatch);
    const reg = sw?.name === '[Registration]';
    if (!sw || !(sw.spot || reg) || sw.paint.type !== 'color') return null;
    let id = this.spaces.get(sw.name);
    if (!id) {
      const k = toCmyk(sw.paint.color), alt = reg ? '1 1 1 1' : k.kind === 'cmyk' ? `${f(k.c / 100)} ${f(k.m / 100)} ${f(k.y / 100)} ${f(k.k / 100)}` : '0 0 0 1';
      id = this.pdf.add(`[/Separation /${reg ? 'All' : pdfName(sw.name)} /DeviceCMYK << /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [${alt}] /N 1 >>]`);
      this.spaces.set(sw.name, id);
    }
    return `/CS${id} ${stroke ? 'CS' : 'cs'} ${f(Math.max(0, Math.min(100, raw.tint ?? 100)) / 100)} ${stroke ? 'SCN' : 'scn'}`;
  }

  paint(raw: Paint, stroke: boolean, b: Rect, page: Mat): string | null {
    const sep = this.separation(raw, stroke);
    if (sep) return sep;
    const p = resolvePaint(this.doc, raw);
    if (p.type === 'none') return null;
    if (p.type === 'color') return this.color(p.color, stroke);
    if (p.type === 'gradient' && p.gradient.kind !== 'freeform' && p.gradient.stops.length) { const id = this.pattern(p.gradient, b, page); return `/Pattern ${stroke ? 'CS' : 'cs'} /P${id} ${stroke ? 'SCN' : 'scn'}`; }
    if (p.type === 'gradient' && p.gradient.kind === 'freeform') { const id = this.freeformPattern(p.gradient, b, page); return id ? `/Pattern ${stroke ? 'CS' : 'cs'} /P${id} ${stroke ? 'SCN' : 'scn'}` : null; }
    if (p.type === 'pattern') { const id = this.patternPaint(p.pattern, p.xf, page); return id ? `/Pattern ${stroke ? 'CS' : 'cs'} /P${id} ${stroke ? 'SCN' : 'scn'}` : null; }
    return null;
  }

  livePlan(n: VNode): LiveText | null {
    const plan = this.plans.get(n.id);
    return plan && plan.node === n && this.live.ok(plan) ? plan : null;
  }

  needsRaster(n: VNode): boolean {
    if (rasterEffects(n).length || (n.kind === 'image' && !!n.warp)) return true;
    if (n.kind === 'text' && !this.outlines.has(n.id) && !this.livePlan(n)) return true;
    return n.ap.items.some((i) => i.visible && ((() => { const p = resolvePaint(this.doc, i.paint); return p.type === 'pattern' && !this.tiles.has(p.pattern); })() || rasterEffectsOf(i.effects).length > 0 || (i.kind === 'stroke' && !!strokeGradient(this.doc, i)?.stops.some((s) => s.opacity < 1))));
  }

  gradientStroke(art: GradientStrokeArt, d: PathData, rule: FillRule, s: StrokeItem, b: Rect, page: Mat): string {
    const region = strokeRegion(d, rule, s);
    const fills = (list: StrokePiece[], m: Mat): string => list.map((p) => { const c = this.paint(p.paint, false, b, m); return c ? `${c}\n${this.path(p.d)}\nf` : ''; }).filter(Boolean).join('\n');
    const body = (m: Mat): string => (region.length ? `q\n${this.path(region)}\nW n\n${fills(art.pieces, m)}\nQ` : '');
    const solo = s.opacity >= 1 && s.blend === 'normal', gsx = solo ? '' : this.extGState(s.opacity, false, s.blend);
    const arrows = art.arrows.length ? `q ${gsx}\n${fills(art.arrows, page)}\nQ` : '';
    if (solo) return [body(page), arrows].filter(Boolean).join('\n');
    const r = inflate(pathBounds(region), 2);
    const id = this.pdf.add(`<< /Type /XObject /Subtype /Form /BBox [${f(r.x)} ${f(r.y)} ${f(r.x + r.w)} ${f(r.y + r.h)}] /Group << /Type /Group /S /Transparency /I true >> /Resources ${RES} 0 R >>`, new TextEncoder().encode(body([1, 0, 0, 1, 0, 0])));
    this.xobjects.set(this.name('F'), id);
    return [`q ${gsx} /Im${id} Do Q`, arrows].filter(Boolean).join('\n');
  }

  shape(n: VNode, d: PathData, rule: string, page: Mat): string {
    const b = selectionBounds(this.doc, [n]), out: string[] = [];
    for (const it of n.ap.items) {
      if (!it.visible) continue;
      const id = it.effects.some((e) => e.visible) ? effectPath(d, it.effects) : d;
      if (it.kind === 'fill') {
        const c = this.paint(it.paint, false, b, page);
        if (!c) continue;
        out.push(`q ${it.opacity < 1 || it.blend !== 'normal' || it.overprint ? this.extGState(it.opacity, false, it.blend, false, !!it.overprint) : ''} ${c}\n${this.path(id)}\n${rule === 'evenodd' ? 'f*' : 'f'} Q`);
        continue;
      }
      if (it.width <= 0) continue;
      const art = gradientStrokeArt(this.doc, id, it, rule === 'evenodd' ? 'evenodd' : 'nonzero');
      if (art) { out.push(this.gradientStroke(art, id, rule === 'evenodd' ? 'evenodd' : 'nonzero', it, b, page)); continue; }
      const c = this.paint(it.paint, true, b, page), cf = this.paint(it.paint, false, b, page);
      if (!c || !cf) continue;
      const gsx = it.opacity < 1 || it.blend !== 'normal' || it.overprint ? `${this.extGState(it.opacity, true, it.blend, false, !!it.overprint)} ${this.extGState(it.opacity, false, it.blend, false, !!it.overprint)}` : '';
      const brush = it.brush ? brushGeometry(this.doc, id, it) : null;
      if (brush) { for (const part of brush) { const po = part.opacity ?? 1, g2 = po < 1 ? this.extGState(it.opacity * po, false, it.blend) : gsx; out.push(`q ${g2} ${part.paint ? this.paint(part.paint, false, b, page) ?? cf : cf}\n${this.path(part.d)}\nf Q`); } continue; }
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
    return `q ${this.ko ? `${this.extGState(1, false, 'normal', true)} ` : ''}${f(b.w)} 0 0 ${f(-b.h)} ${f(b.x)} ${f(b.y + b.h)} cm /Im${id} Do Q`;
  }

  async group(n: VNode, body: string, knockout = false, ais = false, smask = ''): Promise<string> {
    const b = inflate(visualBounds(this.doc, n), 2);
    const content = await deflate(new TextEncoder().encode(body));
    const id = this.pdf.add(`<< /Type /XObject /Subtype /Form /BBox [${f(b.x)} ${f(b.y)} ${f(b.x + b.w)} ${f(b.y + b.h)}] /Group << /Type /Group /S /Transparency /I true${knockout ? ' /K true' : ''} >> /Resources ${RES} 0 R /Filter /FlateDecode >>`, content);
    this.xobjects.set(this.name('F'), id);
    return `q ${smask || `${this.extGState(n.opacity, false, n.blend, ais)} ${this.extGState(n.opacity, true, n.blend, ais)}`} /Im${id} Do Q`;
  }

  private async maskState(n: VNode, ais: boolean): Promise<string> {
    const m = n.mask;
    if (!m) return '';
    const inKo = this.ko;
    this.ko = false;
    const body = await this.node(m.art, [1, 0, 0, 1, 0, 0]);
    this.ko = inKo;
    const ab = visualBounds(this.doc, m.art), nb = visualBounds(this.doc, n), b = inflate(isEmptyRect(ab) ? nb : isEmptyRect(nb) ? ab : unionRect(nb, ab), 2);
    const g = this.pdf.reserve();
    this.defer(g, `<< /Type /XObject /Subtype /Form /BBox [${f(b.x)} ${f(b.y)} ${f(b.x + b.w)} ${f(b.y + b.h)}] /Group << /Type /Group /S /Transparency /CS /DeviceRGB >> /Resources ${RES} 0 R >>`, new TextEncoder().encode(body));
    if (m.invert && !this.invert) this.invert = this.pdf.add('<< /FunctionType 2 /Domain [0 1] /C0 [1] /C1 [0] /N 1 >>');
    const id = this.pdf.add(`<< /Type /ExtGState /SMask << /Type /Mask /S /Luminosity /G ${g} 0 R${m.invert ? ` /TR ${this.invert} 0 R` : ''} >> /CA ${f(n.opacity)} /ca ${f(n.opacity)}${BM[n.blend] ? ` /BM /${BM[n.blend]}` : ''}${ais ? ' /AIS true' : ''} >>`);
    this.gs.set(`mask${id}`, id);
    return `/GS${id} gs`;
  }

  private meshBody(n: VNode): string {
    if (n.kind !== 'mesh' || !n.points.length) return '';
    const sh = (alpha: boolean): number => {
      const s = meshShading(n, this.cmyk, alpha), id = this.pdf.reserve();
      this.defer(id, s.dict, s.stream);
      this.shadings.set(`S${id}`, id);
      return id;
    };
    const color = sh(false);
    if (!meshHasAlpha(n)) return `/Sh${color} sh`;
    const a = sh(true), b = inflate(visualBounds(this.doc, n), 2), g = this.pdf.reserve();
    this.defer(g, `<< /Type /XObject /Subtype /Form /BBox [${f(b.x)} ${f(b.y)} ${f(b.x + b.w)} ${f(b.y + b.h)}] /Group << /Type /Group /S /Transparency /CS /DeviceGray >> /Resources ${RES} 0 R >>`, new TextEncoder().encode(`/Sh${a} sh`));
    const gs = this.pdf.add(`<< /Type /ExtGState /SMask << /Type /Mask /S /Luminosity /G ${g} 0 R >> >>`);
    this.gs.set(`mesh${gs}`, gs);
    return `q /GS${gs} gs\n/Sh${color} sh\nQ`;
  }

  private ko = false;

  async node(n: VNode, page: Mat): Promise<string> {
    if (n.hidden) return '';
    if (n.kind === 'layer' && (n.printable === false || n.template)) return '';
    if (this.needsRaster(n)) return this.rasterize(n);
    const inKo = this.ko, ko = knocksOut(n, inKo), ais = inKo && !!n.knockoutShape;
    const kids = childrenOf(n), multi = !!kids || n.ap.items.filter((i) => i.visible).length > 1 || n.ap.items.some((i) => i.visible && i.kind === 'stroke' && (!!i.brush || !!strokeGradient(this.doc, i))) || (n.kind === 'text' && n.spans.some((s) => s.style.stroke.type !== 'none' && s.style.strokeWidth > 0));
    const masked = !!n.mask && !n.mask.disabled;
    const asForm = masked || ((n.opacity < 1 || n.blend !== 'normal') && multi) || ko || (inKo && multi);
    this.ko = n.kind === 'group' || n.kind === 'layer' ? ko : false;
    let body = await this.body(n, asForm ? [1, 0, 0, 1, 0, 0] : page);
    this.ko = inKo;
    if (!body) return '';
    if (masked && n.mask?.clip) { const r = visualBounds(this.doc, n.mask.art); if (!isEmptyRect(r)) body = `q ${f(r.x)} ${f(r.y)} ${f(r.w)} ${f(r.h)} re W n\n${body}\nQ`; }
    if (asForm) return this.group(n, body, ko && !(kids ?? []).some((c) => c.knockoutShape), ais, masked ? await this.maskState(n, ais) : '');
    if (n.opacity < 1 || n.blend !== 'normal' || ais) return `q ${this.extGState(n.opacity, false, n.blend, ais)} ${this.extGState(n.opacity, true, n.blend, ais)}\n${body}\nQ`;
    return body;
  }

  private async children(list: VNode[], page: Mat): Promise<string> { const out: string[] = []; for (const c of list) out.push(await this.node(c, page)); return out.filter(Boolean).join('\n'); }

  private invert = 0;

  private async kids(list: VNode[], page: Mat): Promise<string> {
    if (!this.ko) return this.children(list, page);
    const vis = list.filter((c) => !c.hidden), parts: string[] = [];
    for (const c of vis) parts.push(await this.node(c, page));
    if (!this.invert) this.invert = this.pdf.add('<< /FunctionType 2 /Domain [0 1] /C0 [1] /C1 [0] /N 1 >>');
    const union: Array<number | undefined> = [];
    const b = inflate(vis.reduce((r: Rect | null, c) => { const vb = visualBounds(this.doc, c); return isEmptyRect(vb) ? r : r ? unionRect(r, vb) : vb; }, null) ?? { x: 0, y: 0, w: 1, h: 1 }, 2);
    let next: number | undefined;
    for (let k = vis.length - 1; k >= 1; k--) {
      if (!vis[k].knockoutShape) {
        const body = `${await this.node(knockoutShape(vis[k]), [1, 0, 0, 1, 0, 0])}${next ? `\n/Im${next} Do` : ''}`;
        next = this.pdf.add(`<< /Type /XObject /Subtype /Form /BBox [${f(b.x)} ${f(b.y)} ${f(b.x + b.w)} ${f(b.y + b.h)}] /Group << /Type /Group /S /Transparency /I true >> /Resources ${RES} 0 R /Filter /FlateDecode >>`, await deflate(new TextEncoder().encode(body)));
        this.xobjects.set(this.name('U'), next);
      }
      union[k] = next;
    }
    return vis.map((_, i) => {
      const u = union[i + 1];
      if (!u || !parts[i]) return parts[i];
      const key = `ko${u}`;
      let gs = this.gs.get(key);
      if (!gs) { gs = this.pdf.add(`<< /Type /ExtGState /SMask << /Type /Mask /S /Alpha /G ${u} 0 R /TR ${this.invert} 0 R >> >>`); this.gs.set(key, gs); }
      return `q /GS${gs} gs\n${parts[i]}\nQ`;
    }).filter(Boolean).join('\n');
  }

  async body(n: VNode, page: Mat): Promise<string> {
    const faces = n.kind !== 'layer' && has3d(n) ? threeDFaces(this.doc, n) : null;
    if (faces) return this.children(faces, page);
    switch (n.kind) {
      case 'layer': case 'group': {
        if (n.clip && n.children.length > 1) {
          const clipper = n.children[n.children.length - 1], geo = clipGeometry(clipper);
          const inner = await this.kids(n.children.slice(0, -1), page);
          const strokes = geo ? this.shape({ ...clipper, ap: { ...clipper.ap, items: clipper.ap.items.filter((i) => i.kind === 'stroke') } }, geo.d, geo.rule, page) : '';
          return `q\n${geo ? `${this.path(geo.d)}\n${geo.rule === 'evenodd' ? 'W*' : 'W'} n\n` : ''}${inner}\nQ\n${strokes}`;
        }
        if (n.kind === 'group' && n.livePaint) return this.children([...liveFaceNodes(n), ...n.children], page);
        if (n.kind === 'group' && (n.shaper || n.intertwine)) return this.children(derivedArt(n) ?? [], page);
        const inner = await this.kids(n.children, page);
        if (!n.ap.items.length) return inner;
        const geo: PathData = [], collect = (x: VNode): void => { if (x.kind === 'path') geo.push(...x.d); else if (x.kind === 'compound') x.children.forEach((c) => geo.push(...c.d)); else childrenOf(x)?.forEach(collect); };
        collect(n);
        return geo.length ? [inner, this.shape(n, geo, 'nonzero', page)].filter(Boolean).join('\n') : inner;
      }
      case 'blend': case 'envelope': case 'repeat': return this.children(liveChildren(this.doc, n), page);
      case 'mesh': return this.meshBody(n);
      case 'path': return n.guide ? '' : this.shape(n, effectPath(n.d, n.ap.effects), n.rule, page);
      case 'compound': return this.shape(n, effectPath(n.children.flatMap((c) => c.d), n.ap.effects), n.rule, page);
      case 'text': {
        const plan = this.livePlan(n);
        if (plan) {
          const b = selectionBounds(this.doc, [n]), inks = new Map<CharStyle, Ink>();
          return liveStream(plan, (st) => {
            let ink = inks.get(st);
            if (!ink) {
              const hasStroke = st.stroke.type !== 'none' && st.strokeWidth > 0;
              ink = { fill: this.paint(st.fill, false, b, page), stroke: hasStroke ? this.paint(st.stroke, true, b, page) : null, width: st.strokeWidth };
              inks.set(st, ink);
            }
            return ink;
          });
        }
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
        const art = instanceArt(this.doc, n);
        if (!art) return '';
        return `q ${n.xf.map(f).join(' ')} cm\n${await this.node(art, page)}\nQ`;
      }
      default: return '';
    }
  }
}

let RES = 0;

export async function exportPdf(p: Project, o: PdfOptions): Promise<Blob> {
  const pdf = new PdfFile();
  const outlines = new Map<string, PathData>();
  const live = new LiveFonts(), plans = new Map<string, LiveText>(), wantLive = o.liveText !== false;
  const visit = async (n: VNode, plain: boolean): Promise<void> => {
    if (n.kind === 'text') {
      const d = await outlineText(n);
      if (d) {
        outlines.set(n.id, d);
        const plan = wantLive && !plain ? await live.plan(p.doc, n) : null;
        if (plan) plans.set(n.id, plan);
      }
    }
    for (const c of childrenOf(n) ?? []) await visit(c, plain || n.kind === 'envelope');
  };
  for (const l of p.doc.layers) await visit(l, false);
  for (const s of p.doc.symbols) await visit(s.art, true);
  if (plans.size) await live.build(pdf, deflate);
  const painter = new Painter(pdf, p, o, p.doc.colorMode === 'cmyk', outlines, live, plans);
  RES = pdf.reserve();
  const pagesId = pdf.reserve();
  await painter.prepare();
  const pageIds: number[] = [];
  const usesMarkFont = !!o.marks?.pageInfo;
  const regSpace = (): number => {
    let id = painter.spaces.get('[Registration]');
    if (!id) { id = pdf.add('[/Separation /All /DeviceCMYK << /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [1 1 1 1] /N 1 >>]'); painter.spaces.set('[Registration]', id); }
    return id;
  };
  for (const i of o.artboards.length ? o.artboards : p.doc.artboards.map((_, k) => k)) {
    const a = p.doc.artboards[i];
    if (!a) continue;
    const uu = Math.max(1, Math.ceil((Math.max(a.w, a.h) / PDF_MAX_SIDE) * 1000) / 1000), s = 1 / uu;
    const bleed = bleedFor(p.doc, o.marks), geo = pageGeometry(a.w, a.h, bleed, o.marks), boxed = marksActive(o.marks) || bleed.t + bleed.b + bleed.l + bleed.r > 0;
    const ox = geo.ml * s, oy = geo.mb * s;
    const page: Mat = [s, 0, 0, -s, ox - a.x * s, oy + (a.y + a.h) * s];
    const parts: string[] = [];
    if (boxed) parts.push(`q ${f(ox - bleed.l * s)} ${f(oy - bleed.b * s)} ${f((a.w + bleed.l + bleed.r) * s)} ${f((a.h + bleed.t + bleed.b) * s)} re W n`);
    parts.push(`${f6(s)} 0 0 ${f6(-s)} ${f6(ox - a.x * s)} ${f6(oy + (a.y + a.h) * s)} cm`);
    if (a.bg) parts.push(`q ${painter.color(a.bg, false)} ${f(a.x - bleed.l)} ${f(a.y - bleed.t)} ${f(a.w + bleed.l + bleed.r)} ${f(a.h + bleed.t + bleed.b)} re f Q`);
    for (const l of p.doc.layers) parts.push(await painter.node(l, page));
    if (boxed) parts.push('Q');
    if (marksActive(o.marks) && o.marks) {
      const reg = regSpace();
      const info = pdfString(`${o.title ?? p.doc.title ?? p.name}   ${a.name}   ${p.doc.colorMode.toUpperCase()}   ${new Date().toISOString().slice(0, 10)}`);
      parts.push(marksContent(geo, a.w, a.h, o.marks, s, `CS${reg}`, 'FMark', info));
    }
    const content = pdf.add('<< /Filter /FlateDecode >>', await deflate(new TextEncoder().encode(parts.filter(Boolean).join('\n'))));
    const W = geo.width * s, H = geo.height * s, box = (x0: number, y0: number, x1: number, y1: number): string => `[${f(x0)} ${f(y0)} ${f(x1)} ${f(y1)}]`;
    const bleedBox = bleed.t + bleed.b + bleed.l + bleed.r > 0 ? ` /BleedBox ${box(ox - bleed.l * s, oy - bleed.b * s, ox + (a.w + bleed.r) * s, oy + (a.h + bleed.t) * s)}` : '';
    pageIds.push(pdf.add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f(W)} ${f(H)}]${bleedBox} /TrimBox ${box(ox, oy, ox + a.w * s, oy + a.h * s)}${uu > 1 ? ` /UserUnit ${f6(uu)}` : ''} /Resources ${RES} 0 R /Contents ${content} 0 R >>`));
  }
  await painter.flush();
  const fontId = usesMarkFont ? (await embeddedMarkFont(pdf, deflate)) || pdf.add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>') : 0;
  const liveFonts = plans.size ? live.resources() : '';
  const res = (m: Map<string, number>, pre: string): string => [...m.values()].map((id) => `/${pre}${id} ${id} 0 R`).join(' ');
  const x4 = o.standard === 'x4';
  const cmykOut = x4 ? await outputProfileBytes(p.doc, 'CMYK') : null, rgbOut = x4 ? await outputProfileBytes(p.doc, 'RGB') : null;
  if (x4 && !cmykOut) throw new Error('PDF/X-4 needs an output profile, and the engine could not supply one. Check that the engine is running, then try again.');
  const xp = cmykOut ? pdfxParts(cmykOut.bytes, 4, 'Custom', cmykOut.name) : null;
  const defaultRgb = rgbOut ? pdf.add(`[/ICCBased ${pdf.add('<< /N 3 /Alternate /DeviceRGB >>', rgbOut.bytes)} 0 R]`) : 0;
  const spaces = `${res(painter.spaces, 'CS')}${defaultRgb ? ` /DefaultRGB ${defaultRgb} 0 R` : ''}`.trim();
  pdf.set(RES, `<< /ProcSet [/PDF /ImageC /ImageB] /ExtGState << ${res(painter.gs, 'GS')} >> /Pattern << ${res(painter.patterns, 'P')} >> /Shading << ${res(painter.shadings, 'Sh')} >> /XObject << ${res(painter.xobjects, 'Im')} >>${fontId || liveFonts ? ` /Font << ${fontId ? `/FMark ${fontId} 0 R ` : ''}${liveFonts} >>` : ''}${spaces ? ` /ColorSpace << ${spaces} >>` : ''} >>`);
  pdf.set(pagesId, `<< /Type /Pages /Kids [${pageIds.map((x) => `${x} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  let names = '';
  if (o.preserve && o.standard !== 'x4') {
    const { manifest, files } = serialize(p);
    const assets: Record<string, string> = {};
    for (const fp of files) { const b = new Uint8Array(await fp.blob.arrayBuffer()); let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000)); assets[fp.name] = `data:${fp.blob.type || 'application/octet-stream'};base64,${btoa(bin)}`; }
    const payload = new TextEncoder().encode(JSON.stringify({ formpthPdf: 1, manifest, assets }));
    const ef = pdf.add('<< /Type /EmbeddedFile /Subtype /application#2Fjson >>', payload);
    const spec = pdf.add(`<< /Type /Filespec /F (formpth-document.json) /UF (formpth-document.json) /Desc (formpth editing data) /EF << /F ${ef} 0 R >> /AFRelationship /Source >>`);
    names = ` /Names << /EmbeddedFiles << /Names [(formpth-document.json) ${spec} 0 R] >> >> /AF [${spec} 0 R]`;
  }
  const now = new Date(), stamp = `D:${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}Z`;
  const title = o.title ?? p.doc.title ?? p.name;
  let extra = '';
  let docId = '';
  if (xp) {
    const icc = pdf.add(xp.iccDict, xp.iccStream);
    const intent = pdf.add(xp.intentDict(icc));
    const iso = now.toISOString().replace(/\.\d+Z$/, 'Z'), esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    docId = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/" xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"><dc:format>application/pdf</dc:format><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(title)}</rdf:li></rdf:Alt></dc:title><xmp:CreateDate>${iso}</xmp:CreateDate><xmp:ModifyDate>${iso}</xmp:ModifyDate><xmp:MetadataDate>${iso}</xmp:MetadataDate><xmp:CreatorTool>formpth</xmp:CreatorTool><pdf:Producer>${esc(`formpth ${o.version ?? ''}`.trim())}</pdf:Producer><pdf:Trapped>False</pdf:Trapped><pdfxid:GTS_PDFXVersion>PDF/X-4</pdfxid:GTS_PDFXVersion><xmpMM:DocumentID>uuid:${docId.replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-')}</xmpMM:DocumentID><xmpMM:VersionID>1</xmpMM:VersionID><xmpMM:RenditionClass>default</xmpMM:RenditionClass></rdf:Description></rdf:RDF></x:xmpmeta>\n<?xpacket end="w"?>`;
    const meta = pdf.add('<< /Type /Metadata /Subtype /XML >>', new TextEncoder().encode(xmp));
    extra = ` /OutputIntents [${intent} 0 R] /Metadata ${meta} 0 R`;
  }
  const root = pdf.add(`<< /Type /Catalog /Pages ${pagesId} 0 R${names}${extra} >>`);
  const info = pdf.add(`<< /Title ${pdfString(title)} /Producer ${pdfString(`formpth ${o.version ?? ''}`.trim())} /Creator (formpth) /CreationDate (${stamp}) /ModDate (${stamp})${xp ? ` ${xp.version} ${xp.trapped}` : ''} >>`);
  return pdf.build(root, info, xp ? '1.6' : '1.7', docId);
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
