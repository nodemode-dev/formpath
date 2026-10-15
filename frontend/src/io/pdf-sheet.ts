import { MAX_SHEETS, sheetFor, tilesFor, type PrintSettings } from './print-layout';
import type { PdfSink } from './pdf-text';

const f = (v: number): string => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };
const f6 = (v: number): string => { const r = Math.round(v * 1e6) / 1e6; return Object.is(r, -0) ? '0' : String(r); };

export function sheetPages(pdf: PdfSink, resources: string, parent: number, packed: Uint8Array, cw: number, ch: number, unit: number, phys: { w: number; h: number }, s: PrintSettings): Array<() => number> {
  const sheet = sheetFor(s, phys.w, phys.h), tiles = tilesFor(s, sheet, phys.w, phys.h), enc = new TextEncoder();
  if (tiles.length > MAX_SHEETS) throw new Error(`At this scale one page needs ${tiles.length} sheets, more than the ${MAX_SHEETS} allowed. Choose a larger paper size or a smaller scale.`);
  const form = pdf.add(`<< /Type /XObject /Subtype /Form /BBox [0 0 ${f(cw)} ${f(ch)}] /Resources ${resources} /Filter /FlateDecode >>`, packed);
  return tiles.map((t) => (): number => {
    const k = t.k * unit, content = pdf.add('<< >>', enc.encode(`q ${f6(k)} 0 0 ${f6(k)} ${f(t.tx)} ${f(t.ty)} cm /Fm Do Q`));
    return pdf.add(`<< /Type /Page /Parent ${parent} 0 R /MediaBox [0 0 ${f(sheet.w)} ${f(sheet.h)}] /Resources << /XObject << /Fm ${form} 0 R >> >> /Contents ${content} 0 R >>`);
  });
}

export function inCopies(pages: Array<() => number>, s: PrintSettings): number[] {
  const copies = Math.max(1, Math.min(99, Math.round(s.copies) || 1)), out: number[] = [];
  if (s.collate) { for (let c = 0; c < copies; c++) for (const make of pages) out.push(make()); return out; }
  for (const make of pages) for (let c = 0; c < copies; c++) out.push(make());
  return out;
}
