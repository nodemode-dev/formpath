import { renderNode, type RenderContext } from '../engine/render';
import type { Project } from '../engine';
import { bleedFor, marksActive, marksContent, pageGeometry, type PdfMarks } from './pdf-marks';
import { deflate, PdfFile } from './pdf';
import { inCopies, sheetPages } from './pdf-sheet';
import { embeddedMarkFont } from './pdf-text';
import type { PrintSettings } from './print-layout';
import { ensureBitmaps, rasterCap } from './raster';

export interface Plate { key: string; label: string; value: string }
export interface PlateOptions { artboards: number[]; marks: PdfMarks; dpi: number; sheet: PrintSettings; title?: string; version?: string }

const f = (v: number): string => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };
const text = (s: string): string => `(${s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '?')})`;

export function platesOf(p: Project): Plate[] {
  const spots = p.doc.swatches.filter((s) => s.spot);
  return [
    { key: 'C', label: 'Cyan', value: 'C' }, { key: 'M', label: 'Magenta', value: 'M' }, { key: 'Y', label: 'Yellow', value: 'Y' }, { key: 'K', label: 'Black', value: 'K' },
    ...spots.map((s) => ({ key: `spot:${s.id}`, label: s.name, value: s.name })),
  ];
}

export async function exportPlates(p: Project, o: PlateOptions): Promise<Blob> {
  await ensureBitmaps(p);
  await document.fonts.ready.catch(() => undefined);
  const pdf = new PdfFile(), pagesId = pdf.reserve(), made: Array<() => number> = [], plates = platesOf(p);
  const wantInfo = !!o.marks.pageInfo, fontId = wantInfo ? (await embeddedMarkFont(pdf, deflate)) || pdf.add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>') : 0;
  const sep = pdf.add('[/Separation /All /DeviceGray << /FunctionType 2 /Domain [0 1] /C0 [1] /C1 [0] /N 1 >>]');
  const title = o.title ?? p.doc.title ?? p.name, day = new Date().toISOString().slice(0, 10);
  const list = o.artboards.length ? o.artboards : p.doc.artboards.map((_, k) => k);
  for (const i of list) {
    const a = p.doc.artboards[i];
    if (!a) continue;
    const bleed = bleedFor(p.doc, o.marks), geo = pageGeometry(a.w, a.h, bleed, o.marks);
    const region = { x: a.x - bleed.l, y: a.y - bleed.t, w: a.w + bleed.l + bleed.r, h: a.h + bleed.t + bleed.b };
    const cap = rasterCap(region, Math.max(36, Math.min(1200, o.dpi)) / 72), k = cap.scale, w = cap.width, h = cap.height;
    const ox = geo.ml, oy = geo.mb;
    const inked: Array<{ plate: Plate; gray: Uint8Array }> = [];
    for (const plate of plates) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (!g) throw new Error('This browser could not make a drawing surface for the separations.');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.setTransform(k, 0, 0, k, -region.x * k, -region.y * k);
      const rc: RenderContext = { doc: p.doc, scale: k, outline: false, assets: (key) => p.bitmaps.get(key) ?? null, printing: true, separation: plate.value };
      for (const l of p.doc.layers) renderNode(g, l, rc);
      const px = g.getImageData(0, 0, w, h).data, gray = new Uint8Array(w * h);
      let min = 255;
      for (let n = 0; n < gray.length; n++) { const v = px[n * 4]; gray[n] = v; if (v < min) min = v; }
      if (min < 255) inked.push({ plate, gray });
      else if (plate.key === 'K' && !inked.length) inked.push({ plate, gray });
    }
    if (!inked.length) { const k4 = plates[3]; inked.push({ plate: k4, gray: new Uint8Array(w * h).fill(255) }); }
    for (const { plate, gray } of inked) {
      const img = pdf.add(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode >>`, await deflate(gray));
      const parts: string[] = [`q ${f(region.w)} 0 0 ${f(region.h)} ${f(ox - bleed.l)} ${f(oy - bleed.b)} cm /Pl Do Q`];
      if (marksActive(o.marks)) {
        parts.push(marksContent(geo, a.w, a.h, { ...o.marks, colorBars: false }, 1, 'CS1', 'FMark', text(`${title}   ${a.name}   ${plate.label}   ${day}`)));
        if (o.marks.colorBars) {
          const sz = 9, y = oy - geo.start.b - sz, room = Math.max(0, Math.floor((a.w / 2 - 16) / sz));
          const steps = Array.from({ length: Math.min(room, 11) }, (_, n) => `${f(1 - n / 10)} g ${f(ox + 16 + n * sz)} ${f(y)} ${sz} ${sz} re f`);
          if (steps.length) parts.push(`q ${steps.join(' ')} Q`);
        }
      }
      const bytes = await deflate(new TextEncoder().encode(parts.join('\n')));
      const res = `<< /XObject << /Pl ${img} 0 R >> /ColorSpace << /CS1 ${sep} 0 R >>${fontId ? ` /Font << /FMark ${fontId} 0 R >>` : ''} >>`;
      made.push(...sheetPages(pdf, res, pagesId, bytes, geo.width, geo.height, 1, { w: geo.width, h: geo.height }, o.sheet));
    }
  }
  const pageIds = inCopies(made, o.sheet);
  pdf.set(pagesId, `<< /Type /Pages /Kids [${pageIds.map((x) => `${x} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  const root = pdf.add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`), now = new Date();
  const stamp = `D:${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}Z`;
  const info = pdf.add(`<< /Title ${text(`${title} separations`)} /Producer ${text(`formpth ${o.version ?? ''}`.trim())} /Creator (formpth) /CreationDate (${stamp}) /ModDate (${stamp}) >>`);
  return pdf.build(root, info);
}
