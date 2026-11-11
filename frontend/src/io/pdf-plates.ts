import { childrenOf } from '../engine/doc';
import { platesOf, type Plate } from '../engine/inks';
import type { Mat, PathData, Project, VNode } from '../engine';
import { outlineText } from './fonts';
import { deflate, Painter, PdfFile, PDF_MAX_SIDE } from './pdf';
import { bleedFor, marksActive, marksContent, pageGeometry, type PdfMarks } from './pdf-marks';
import { PlatePaint } from './pdf-plate-map';
import { inCopies, sheetPages } from './pdf-sheet';
import { embeddedMarkFont, LiveFonts, type LiveText } from './pdf-text';
import type { PrintSettings } from './print-layout';
import { ensureBitmaps } from './raster';

export interface PlateOptions { artboards: number[]; marks: PdfMarks; dpi: number; sheet: PrintSettings; title?: string; version?: string }

const f = (v: number): string => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };
const f6 = (v: number): string => { const r = Math.round(v * 1e6) / 1e6; return Object.is(r, -0) ? '0' : String(r); };
const text = (s: string): string => `(${s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '?')})`;

export async function exportPlates(p: Project, o: PlateOptions): Promise<Blob> {
  await ensureBitmaps(p);
  await document.fonts.ready.catch(() => undefined);
  const plates = platesOf(p.doc, true);
  if (!plates.length) throw new Error('Every ink is set not to print. Turn one on in the Ink Manager and try again.');
  const pdf = new PdfFile(), outlines = new Map<string, PathData>(), live = new LiveFonts(), plans = new Map<string, LiveText>();
  const visit = async (n: VNode, plain: boolean): Promise<void> => {
    if (n.kind === 'text') {
      const d = await outlineText(n);
      if (d) {
        outlines.set(n.id, d);
        const plan = !plain ? await live.plan(p.doc, n) : null;
        if (plan) plans.set(n.id, plan);
      }
    }
    for (const c of childrenOf(n) ?? []) await visit(c, plain || n.kind === 'envelope');
  };
  for (const l of p.doc.layers) await visit(l, false);
  for (const s of p.doc.symbols) await visit(s.art, true);
  if (plans.size) await live.build(pdf, deflate);
  const res = pdf.reserve(), pagesId = pdf.reserve();
  pdf.res = res;
  const ppi = Math.max(36, Math.min(1200, o.dpi));
  const painters = new Map<string, { painter: Painter; plate: PlatePaint; info: Plate }>();
  for (const info of plates) {
    const painter = new Painter(pdf, p, { artboards: [], preserve: false, ppi }, p.doc.colorMode === 'cmyk', outlines, live, plans), plate = new PlatePaint(p.doc, info.value);
    painter.plate = plate;
    await painter.prepare();
    painters.set(info.key, { painter, plate, info });
  }
  const made: Array<() => number> = [], direct: number[] = [], wantInfo = !!o.marks.pageInfo;
  const fontId = wantInfo ? (await embeddedMarkFont(pdf, deflate)) || pdf.add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>') : 0;
  const sep = pdf.add('[/Separation /All /DeviceGray << /FunctionType 2 /Domain [0 1] /C0 [1] /C1 [0] /N 1 >>]');
  const title = o.title ?? p.doc.title ?? p.name, day = new Date().toISOString().slice(0, 10);
  const list = o.artboards.length ? o.artboards : p.doc.artboards.map((_, k) => k);
  for (const i of list) {
    const a = p.doc.artboards[i];
    if (!a) continue;
    const uu = Math.max(1, Math.ceil((Math.max(a.w, a.h) / PDF_MAX_SIDE) * 1000) / 1000), s = 1 / uu;
    const bleed = bleedFor(p.doc, o.marks), geo = pageGeometry(a.w, a.h, bleed, o.marks), boxed = marksActive(o.marks) || bleed.t + bleed.b + bleed.l + bleed.r > 0;
    const ox = geo.ml * s, oy = geo.mb * s, page: Mat = [s, 0, 0, -s, ox - a.x * s, oy + (a.y + a.h) * s];
    const bodies: Array<{ info: Plate; body: string; inked: boolean }> = [];
    for (const { painter, plate, info } of painters.values()) {
      plate.touched = false;
      const parts: string[] = [];
      for (const l of p.doc.layers) parts.push(await painter.node(l, page));
      bodies.push({ info, body: parts.filter(Boolean).join('\n'), inked: plate.touched });
    }
    let chosen = bodies.filter((b) => b.inked);
    if (!chosen.length) chosen = [bodies.find((b) => b.info.value === 'K') ?? bodies[0]].map((b) => ({ ...b, body: '' }));
    for (const { info, body } of chosen) {
      const parts: string[] = [];
      if (boxed) parts.push(`q ${f(ox - bleed.l * s)} ${f(oy - bleed.b * s)} ${f((a.w + bleed.l + bleed.r) * s)} ${f((a.h + bleed.t + bleed.b) * s)} re W n`);
      parts.push(`${f6(s)} 0 0 ${f6(-s)} ${f6(ox - a.x * s)} ${f6(oy + (a.y + a.h) * s)} cm`, body);
      if (boxed) parts.push('Q');
      if (marksActive(o.marks)) {
        parts.push(marksContent(geo, a.w, a.h, { ...o.marks, colorBars: false }, s, `CS${sep}`, 'FMark', text(`${title}   ${a.name}   ${info.label}   ${day}`)));
        if (o.marks.colorBars) {
          const sz = 9 * s, y = oy - geo.start.b * s - sz, room = Math.max(0, Math.floor((a.w * s / 2 - 16 * s) / sz));
          const steps = Array.from({ length: Math.min(room, 11) }, (_, n) => `${f(1 - n / 10)} g ${f(ox + 16 * s + n * sz)} ${f(y)} ${f(sz)} ${f(sz)} re f`);
          if (steps.length) parts.push(`q ${steps.join(' ')} Q`);
        }
      }
      const packed = await deflate(new TextEncoder().encode(parts.filter(Boolean).join('\n')));
      if (o.sheet) { made.push(...sheetPages(pdf, `${res} 0 R`, pagesId, packed, geo.width * s, geo.height * s, uu, { w: geo.width, h: geo.height }, o.sheet)); continue; }
      const content = pdf.add('<< /Filter /FlateDecode >>', packed);
      const W = geo.width * s, H = geo.height * s, box = (x0: number, y0: number, x1: number, y1: number): string => `[${f(x0)} ${f(y0)} ${f(x1)} ${f(y1)}]`;
      const bleedBox = bleed.t + bleed.b + bleed.l + bleed.r > 0 ? ` /BleedBox ${box(ox - bleed.l * s, oy - bleed.b * s, ox + (a.w + bleed.r) * s, oy + (a.h + bleed.t) * s)}` : '';
      direct.push(pdf.add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f(W)} ${f(H)}]${bleedBox} /TrimBox ${box(ox, oy, ox + a.w * s, oy + a.h * s)}${uu > 1 ? ` /UserUnit ${f6(uu)}` : ''} /Resources ${res} 0 R /Contents ${content} 0 R >>`));
    }
  }
  for (const { painter } of painters.values()) await painter.flush();
  const pageIds = o.sheet ? inCopies(made, o.sheet) : direct;
  const merge = (pick: (x: Painter) => Map<string, number>, pre: string): string => {
    const ids = new Set<number>();
    for (const { painter } of painters.values()) for (const id of pick(painter).values()) ids.add(id);
    return [...ids].map((id) => `/${pre}${id} ${id} 0 R`).join(' ');
  };
  const liveFonts = plans.size ? live.resources() : '';
  pdf.set(res, `<< /ProcSet [/PDF /ImageB] /ExtGState << ${merge((x) => x.gs, 'GS')} >> /Pattern << ${merge((x) => x.patterns, 'P')} >> /Shading << ${merge((x) => x.shadings, 'Sh')} >> /XObject << ${merge((x) => x.xobjects, 'Im')} >>${fontId || liveFonts ? ` /Font << ${fontId ? `/FMark ${fontId} 0 R ` : ''}${liveFonts} >>` : ''} /ColorSpace << /CS${sep} ${sep} 0 R >> >>`);
  pdf.set(pagesId, `<< /Type /Pages /Kids [${pageIds.map((x) => `${x} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  const root = pdf.add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`), now = new Date();
  const stamp = `D:${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}Z`;
  const info = pdf.add(`<< /Title ${text(`${title} separations`)} /Producer ${text(`formpath ${o.version ?? ''}`.trim())} /Creator (formpath) /CreationDate (${stamp}) /ModDate (${stamp}) >>`);
  return pdf.build(root, info);
}
