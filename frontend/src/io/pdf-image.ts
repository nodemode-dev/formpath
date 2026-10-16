import { toCmyk } from '../engine/paint';
import type { PdfCompression } from './pdf-std';

export interface Pixels { width: number; height: number; data: Uint8ClampedArray }
export interface Encoded { dict: string; data: Uint8Array; mask?: { dict: string; data: Uint8Array } }
type Deflate = (d: Uint8Array) => Promise<Uint8Array>;

export const withMask = (dict: string, id: number): string => dict.replace(/>>\s*$/, `/SMask ${id} 0 R >>`);

/** The size an image is resampled to, or null when it stays as it is: only above the "above" resolution, and never up. */
export function downsampled(widthPx: number, heightPx: number, widthPt: number, c: PdfCompression | undefined): { w: number; h: number } | null {
  if (!c || c.downsamplePpi <= 0 || widthPt <= 0) return null;
  const ppi = widthPx / (widthPt / 72), above = c.downsampleAbove > 0 ? c.downsampleAbove : c.downsamplePpi * 1.5;
  if (ppi <= above || ppi <= c.downsamplePpi) return null;
  const k = c.downsamplePpi / ppi;
  return { w: Math.max(1, Math.round(widthPx * k)), h: Math.max(1, Math.round(heightPx * k)) };
}

/** Resolution a raster export is drawn at: the document resolution, brought down to the target when it is above the "above" resolution. */
export function rasterPpi(ppi: number, c: PdfCompression | undefined): number {
  if (!c || c.downsamplePpi <= 0) return ppi;
  const above = c.downsampleAbove > 0 ? c.downsampleAbove : c.downsamplePpi * 1.5;
  return ppi > above ? c.downsamplePpi : ppi;
}

/** Draws the bitmap at the given size with the browser's high quality filter (bicubic or better) and reads the pixels back. */
export function pixelsOf(bmp: ImageBitmap, size?: { w: number; h: number } | null): Pixels {
  const w = size?.w ?? bmp.width, h = size?.h ?? bmp.height, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h);
  return { width: w, height: h, data: d.data };
}

export function hasAlpha(img: Pixels): boolean {
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
  return false;
}

/** Four bytes per pixel, composited on white where the pixel is not opaque (CMYK images in the print standards carry no soft mask). */
function cmykBytes(img: Pixels): Uint8Array {
  const n = img.width * img.height, out = new Uint8Array(n * 4), d = img.data;
  let lr = -1, lg = -1, lb = -1, c = 0, m = 0, y = 0, k = 0;
  for (let i = 0; i < n; i++) {
    let r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const a = d[i * 4 + 3];
    if (a < 255) { const t = a / 255; r = Math.round(r * t + 255 * (1 - t)); g = Math.round(g * t + 255 * (1 - t)); b = Math.round(b * t + 255 * (1 - t)); }
    if (r !== lr || g !== lg || b !== lb) {
      const v = toCmyk({ kind: 'rgb', r, g, b });
      if (v.kind === 'cmyk') { c = Math.round(v.c * 2.55); m = Math.round(v.m * 2.55); y = Math.round(v.y * 2.55); k = Math.round(v.k * 2.55); } else { c = m = y = 0; k = 255 - Math.round(r * 0.3 + g * 0.59 + b * 0.11); }
      lr = r; lg = g; lb = b;
    }
    out[i * 4] = c; out[i * 4 + 1] = m; out[i * 4 + 2] = y; out[i * 4 + 3] = k;
  }
  return out;
}

async function jpegBytes(img: Pixels, quality: number): Promise<Uint8Array> {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d') as CanvasRenderingContext2D, copy = new Uint8ClampedArray(img.data);
  for (let i = 3; i < copy.length; i += 4) copy[i] = 255;
  g.putImageData(new ImageData(copy, img.width, img.height), 0, 0);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', Math.max(0.05, Math.min(1, quality))));
  if (!blob) throw new Error('This browser could not write the JPEG for the PDF.');
  return new Uint8Array(await blob.arrayBuffer());
}

/** One image XObject (and its soft mask when it has real alpha and the colour is RGB). cmyk converts the colour to DeviceCMYK, flattened on white, and always uses Flate because the browser has no CMYK JPEG encoder. */
export async function encodePixels(img: Pixels, o: { compression?: PdfCompression; cmyk?: boolean; flat?: boolean }, deflate: Deflate): Promise<Encoded> {
  const { width, height } = img, head = `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /BitsPerComponent 8`;
  if (o.cmyk) return { dict: `${head} /ColorSpace /DeviceCMYK /Filter /FlateDecode >>`, data: await deflate(cmykBytes(img)) };
  const n = width * height, rgb = new Uint8Array(n * 3), a = new Uint8Array(n);
  let alpha = false;
  for (let i = 0; i < n; i++) {
    let r = img.data[i * 4], g = img.data[i * 4 + 1], b = img.data[i * 4 + 2];
    const al = img.data[i * 4 + 3];
    if (al < 255) { if (o.flat) { const t = al / 255; r = Math.round(r * t + 255 * (1 - t)); g = Math.round(g * t + 255 * (1 - t)); b = Math.round(b * t + 255 * (1 - t)); } else alpha = true; }
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b; a[i] = o.flat ? 255 : al;
  }
  const mask = alpha ? { dict: `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode >>`, data: await deflate(a) } : undefined;
  if (o.compression?.images === 'jpeg') {
    const data = await jpegBytes({ width, height, data: o.flat ? new Uint8ClampedArray(rgbaOf(rgb, n)) : img.data }, o.compression.jpegQuality);
    return { dict: `${head} /ColorSpace /DeviceRGB /Filter /DCTDecode >>`, data, mask };
  }
  return { dict: `${head} /ColorSpace /DeviceRGB /Filter /FlateDecode >>`, data: await deflate(rgb), mask };
}

function rgbaOf(rgb: Uint8Array, n: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) { out[i * 4] = rgb[i * 3]; out[i * 4 + 1] = rgb[i * 3 + 1]; out[i * 4 + 2] = rgb[i * 3 + 2]; out[i * 4 + 3] = 255; }
  return out;
}
