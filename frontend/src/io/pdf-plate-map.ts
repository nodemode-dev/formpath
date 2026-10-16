import type { Color, Doc, Paint, Swatch } from '../engine';
import { inkTarget, isRegistration, plateValue, processValue, spotAsProcess, type ProcessInk } from '../engine/inks';
import { resolvePaint, toRgb } from '../engine/paint';
import type { PdfFile } from './pdf';
import type { Pixels } from './pdf-image';

const NONE: Paint = { type: 'none' };

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') return data;
  return new Uint8Array(await new Response(new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
}
const f = (v: number): string => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };

export class PlatePaint {
  readonly process: boolean;
  touched = false;

  constructor(readonly doc: Doc, readonly ink: string) { this.process = ink === 'C' || ink === 'M' || ink === 'Y' || ink === 'K'; }

  private cov(raw: Paint, c: Color): number {
    const v = Math.max(0, Math.min(1, plateValue(this.doc, raw, c, this.ink) / 100));
    if (v > 0) this.touched = true;
    return v;
  }

  gray(cov: number, stroke: boolean): string { return `${f(1 - cov)} ${stroke ? 'G' : 'g'}`; }

  color(c: Color, stroke: boolean): string { return this.gray(this.cov(NONE, c), stroke); }

  swatchOp(sw: Swatch, raw: Paint, stroke: boolean): string | null {
    if (!sw.spot && !isRegistration(sw)) return null;
    return this.gray(this.cov(raw, sw.paint.type === 'color' ? sw.paint.color : { kind: 'gray', k: 100 }), stroke);
  }

  comp(c: Color): string { return f(1 - this.cov(NONE, c)); }

  level(c: Color): number { return 1 - this.cov(NONE, c); }

  blank(raw: Paint): boolean {
    const p = resolvePaint(this.doc, raw);
    if (p.type === 'none') return true;
    if (p.type === 'color') return this.cov(raw, p.color) === 0;
    if (p.type === 'gradient') return p.gradient.stops.every((s) => this.cov(NONE, s.color) === 0);
    return false;
  }

  private async assemble(pdf: PdfFile, img: Pixels, gray: (i: number) => number): Promise<number> {
    const n = img.width * img.height, g = new Uint8Array(n), a = new Uint8Array(n);
    let alpha = false;
    for (let i = 0; i < n; i++) { g[i] = gray(i); a[i] = img.data[i * 4 + 3]; if (a[i] < 255) alpha = true; if (g[i] < 255 && a[i] > 0) this.touched = true; }
    const base = `/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`;
    const smask = alpha ? pdf.add(`<< ${base} >>`, await deflate(a)) : 0;
    return pdf.add(`<< ${base}${smask ? ` /SMask ${smask} 0 R` : ''} >>`, await deflate(g));
  }

  image(pdf: PdfFile, img: Pixels): Promise<number> {
    const d = img.data;
    let lr = -1, lg = -1, lb = -1, v = 255;
    return this.assemble(pdf, img, (i) => {
      if (!this.process) return 255;
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      if (r !== lr || g !== lg || b !== lb) { lr = r; lg = g; lb = b; v = 255 - Math.round((2.55 * processValue({ kind: 'rgb', r, g, b }, this.ink as ProcessInk))); }
      return v < 0 ? 0 : v > 255 ? 255 : v;
    });
  }

  rendered(pdf: PdfFile, img: Pixels): Promise<number> {
    const d = img.data;
    return this.assemble(pdf, img, (i) => d[i * 4]);
  }
}

export function routeInk(doc: Doc, sw: Swatch, raw: Paint, stroke: boolean, rgbOnly: boolean): string | Swatch | null {
  if (!sw.spot || sw.paint.type !== 'color') return null;
  const t = inkTarget(doc, sw);
  if (t.kind === 'spot') return t.swatch.name === sw.name ? null : t.swatch;
  const k = spotAsProcess(sw, raw.type === 'color' ? raw.tint ?? 100 : 100);
  if (rgbOnly) { const v = toRgb({ kind: 'cmyk', c: k.c, m: k.m, y: k.y, k: k.k }); return `${f(v.r / 255)} ${f(v.g / 255)} ${f(v.b / 255)} ${stroke ? 'RG' : 'rg'}`; }
  return `${f(k.c / 100)} ${f(k.m / 100)} ${f(k.y / 100)} ${f(k.k / 100)} ${stroke ? 'K' : 'k'}`;
}
