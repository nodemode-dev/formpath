export type CmykToRgb = (c: number, m: number, y: number, k: number) => [number, number, number] | null;

export interface TiffPageInfo {
  index: number;
  width: number;
  height: number;
  ppiX: number | null;
  ppiY: number | null;
  bits: number;
  samples: number;
  photometric: number;
  compression: number;
  alpha: boolean;
}

export interface TiffImage { width: number; height: number; rgba: Uint8ClampedArray; ppiX: number | null; ppiY: number | null; icc: Uint8Array | null; alpha: boolean; mode: string }

interface Entry { type: number; count: number; at: number }
interface Ifd { tags: Map<number, Entry> }

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
const MAX_PIXELS = 120_000_000;

class Tiff {
  readonly dv: DataView;
  readonly bytes: Uint8Array;
  readonly le: boolean;
  readonly ifds: Ifd[] = [];

  constructor(data: ArrayBuffer) {
    this.bytes = new Uint8Array(data);
    this.dv = new DataView(data);
    if (this.bytes.length < 8) throw new Error('it is too short to be a TIFF file');
    const order = String.fromCharCode(this.bytes[0], this.bytes[1]);
    if (order !== 'II' && order !== 'MM') throw new Error('it is not a TIFF file');
    this.le = order === 'II';
    const magic = this.dv.getUint16(2, this.le);
    if (magic === 43) throw new Error('BigTIFF files are not supported');
    if (magic !== 42) throw new Error('it is not a TIFF file');
    let off = this.dv.getUint32(4, this.le);
    const seen = new Set<number>();
    while (off > 0 && off + 2 <= this.bytes.length && !seen.has(off) && this.ifds.length < 4096) {
      seen.add(off);
      const n = this.dv.getUint16(off, this.le), tags = new Map<number, Entry>();
      if (off + 2 + n * 12 + 4 > this.bytes.length) break;
      for (let i = 0; i < n; i++) {
        const e = off + 2 + i * 12, tag = this.dv.getUint16(e, this.le), type = this.dv.getUint16(e + 2, this.le), count = this.dv.getUint32(e + 4, this.le);
        const size = (TYPE_SIZE[type] ?? 1) * count;
        tags.set(tag, { type, count, at: size <= 4 ? e + 8 : this.dv.getUint32(e + 8, this.le) });
      }
      this.ifds.push({ tags });
      off = this.dv.getUint32(off + 2 + n * 12, this.le);
    }
    if (!this.ifds.length) throw new Error('it has no image');
  }

  nums(ifd: Ifd, tag: number): number[] {
    const e = ifd.tags.get(tag);
    if (!e) return [];
    const sz = TYPE_SIZE[e.type] ?? 1, out: number[] = [], le = this.le, dv = this.dv;
    if (e.at + sz * e.count > this.bytes.length) return [];
    for (let i = 0; i < e.count; i++) {
      const p = e.at + i * sz;
      switch (e.type) {
        case 1: case 2: case 7: out.push(dv.getUint8(p)); break;
        case 6: out.push(dv.getInt8(p)); break;
        case 3: out.push(dv.getUint16(p, le)); break;
        case 8: out.push(dv.getInt16(p, le)); break;
        case 4: out.push(dv.getUint32(p, le)); break;
        case 9: out.push(dv.getInt32(p, le)); break;
        case 5: { const d = dv.getUint32(p + 4, le); out.push(d ? dv.getUint32(p, le) / d : 0); break; }
        case 10: { const d = dv.getInt32(p + 4, le); out.push(d ? dv.getInt32(p, le) / d : 0); break; }
        case 11: out.push(dv.getFloat32(p, le)); break;
        case 12: out.push(dv.getFloat64(p, le)); break;
        default: out.push(0);
      }
    }
    return out;
  }

  num(ifd: Ifd, tag: number, d: number): number { const v = this.nums(ifd, tag); return v.length ? v[0] : d; }

  raw(ifd: Ifd, tag: number): Uint8Array | null {
    const e = ifd.tags.get(tag);
    if (!e) return null;
    const n = (TYPE_SIZE[e.type] ?? 1) * e.count;
    return e.at + n <= this.bytes.length ? this.bytes.subarray(e.at, e.at + n) : null;
  }
}

function resolution(t: Tiff, ifd: Ifd): { x: number | null; y: number | null } {
  const unit = t.num(ifd, 296, 2), x = t.num(ifd, 282, 0), y = t.num(ifd, 283, 0);
  if (unit === 1 || (!x && !y)) return { x: null, y: null };
  const k = unit === 3 ? 2.54 : 1;
  return { x: x ? x * k : y * k, y: y ? y * k : x * k };
}

function pageList(t: Tiff): Ifd[] {
  const full = t.ifds.filter((f) => (t.num(f, 254, 0) & 5) === 0 && t.num(f, 256, 0) > 0 && t.num(f, 257, 0) > 0);
  return full.length ? full : t.ifds;
}

function infoOf(t: Tiff, f: Ifd, index: number): TiffPageInfo {
  const r = resolution(t, f), photo = t.num(f, 262, 1), spp = t.num(f, 277, 1), extra = t.nums(f, 338);
  const base = photo === 5 ? 4 : photo === 2 || photo === 6 ? 3 : 1;
  return { index, width: t.num(f, 256, 0), height: t.num(f, 257, 0), ppiX: r.x, ppiY: r.y, bits: t.nums(f, 258)[0] ?? 1, samples: spp, photometric: photo, compression: t.num(f, 259, 1), alpha: spp > base && (extra.length ? extra[0] !== 0 : true) };
}

export function readTiffInfo(data: ArrayBuffer): TiffPageInfo[] {
  const t = new Tiff(data);
  return pageList(t).map((f, i) => infoOf(t, f, i));
}

function packBitsDecode(src: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size);
  let i = 0, o = 0;
  while (i < src.length && o < size) {
    const n = (src[i++] << 24) >> 24;
    if (n >= 0) { const c = n + 1; for (let k = 0; k < c && i < src.length && o < size; k++) out[o++] = src[i++]; }
    else if (n !== -128) { const c = 1 - n, v = src[i++]; for (let k = 0; k < c && o < size; k++) out[o++] = v; }
  }
  return out;
}

function lzwDecode(src: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size);
  const prefix = new Int32Array(4096), suffix = new Uint8Array(4096), len = new Uint16Array(4096), first = new Uint8Array(4096);
  for (let i = 0; i < 256; i++) { suffix[i] = i; len[i] = 1; prefix[i] = -1; first[i] = i; }
  let next = 258, bits = 9, acc = 0, nb = 0, pos = 0, o = 0, prev = -1;
  const emit = (code: number): void => {
    const L = len[code];
    let p = o + L - 1, c = code;
    while (c >= 0 && p >= o) { if (p < size) out[p] = suffix[c]; c = prefix[c]; p--; }
    o += L;
  };
  for (;;) {
    while (nb < bits && pos < src.length) { acc = (acc << 8) | src[pos++]; nb += 8; }
    if (nb < bits) break;
    const code = (acc >>> (nb - bits)) & ((1 << bits) - 1);
    nb -= bits;
    acc &= (1 << nb) - 1;
    if (code === 257) break;
    if (code === 256) { next = 258; bits = 9; prev = -1; continue; }
    if (prev === -1) { if (code >= 256) break; emit(code); prev = code; continue; }
    if (code < next) {
      emit(code);
      if (next < 4096) { prefix[next] = prev; suffix[next] = first[code]; len[next] = len[prev] + 1; first[next] = first[prev]; next++; }
    } else if (code === next && next < 4096) {
      prefix[next] = prev; suffix[next] = first[prev]; len[next] = len[prev] + 1; first[next] = first[prev]; next++;
      emit(code);
    } else break;
    bits = next >= 2047 ? 12 : next >= 1023 ? 11 : next >= 511 ? 10 : 9;
    prev = code;
    if (o >= size) break;
  }
  return out;
}

async function inflate(src: Uint8Array, size: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot read Deflate-compressed TIFF files');
  const buf = new Uint8Array(await new Response(new Blob([src as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  if (buf.length >= size) return buf.length === size ? buf : buf.subarray(0, size);
  const out = new Uint8Array(size);
  out.set(buf);
  return out;
}

const hasAdobe = (b: Uint8Array): boolean => {
  const n = Math.min(b.length - 5, 1024);
  for (let i = 2; i < n; i++) if (b[i] === 0x41 && b[i + 1] === 0x64 && b[i + 2] === 0x6f && b[i + 3] === 0x62 && b[i + 4] === 0x65) return true;
  return false;
};

async function jpegPixels(chunk: Uint8Array, tables: Uint8Array | null, rgbSpace: boolean): Promise<ImageData> {
  let body = chunk;
  if (body.length >= 2 && body[0] === 0xff && body[1] === 0xd8) body = body.subarray(2);
  const head = tables && tables.length > 2 ? (tables[tables.length - 2] === 0xff && tables[tables.length - 1] === 0xd9 ? tables.subarray(0, tables.length - 2) : tables) : new Uint8Array([0xff, 0xd8]);
  const adobe = rgbSpace && !hasAdobe(head) && !hasAdobe(body) ? new Uint8Array([0xff, 0xee, 0x00, 0x0e, 0x41, 0x64, 0x6f, 0x62, 0x65, 0x00, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00]) : new Uint8Array(0);
  const all = new Uint8Array(head.length + adobe.length + body.length);
  all.set(head.subarray(0, 2), 0);
  all.set(adobe, 2);
  all.set(head.subarray(2), 2 + adobe.length);
  all.set(body, head.length + adobe.length);
  const bmp = await createImageBitmap(new Blob([all], { type: 'image/jpeg' }), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
  g.drawImage(bmp, 0, 0);
  bmp.close();
  return g.getImageData(0, 0, c.width, c.height);
}

function orient(rgba: Uint8ClampedArray, w: number, h: number, o: number): { rgba: Uint8ClampedArray; w: number; h: number } {
  if (o < 2 || o > 8) return { rgba, w, h };
  const swap = o >= 5, nw = swap ? h : w, nh = swap ? w : h, out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let dx = x, dy = y;
    if (o === 2) dx = w - 1 - x;
    else if (o === 3) { dx = w - 1 - x; dy = h - 1 - y; }
    else if (o === 4) dy = h - 1 - y;
    else if (o === 5) { dx = y; dy = x; }
    else if (o === 6) { dx = h - 1 - y; dy = x; }
    else if (o === 7) { dx = h - 1 - y; dy = w - 1 - x; }
    else { dx = y; dy = w - 1 - x; }
    const s = (y * w + x) * 4, d = (dy * nw + dx) * 4;
    out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = rgba[s + 3];
  }
  return { rgba: out, w: nw, h: nh };
}

const MODE: Record<number, string> = { 0: 'Bilevel', 1: 'Grayscale', 2: 'RGB', 3: 'Indexed', 5: 'CMYK', 6: 'YCbCr' };

export async function decodeTiffPage(data: ArrayBuffer, index: number, cmykToRgb?: CmykToRgb | null): Promise<TiffImage> {
  const t = new Tiff(data), list = pageList(t), f = list[index];
  if (!f) throw new Error(`it has no page ${index + 1}`);
  const width = t.num(f, 256, 0), height = t.num(f, 257, 0);
  if (!width || !height) throw new Error('its image has no size');
  if (width * height > MAX_PIXELS) throw new Error(`its image is ${width} by ${height} pixels, more than formpath can hold`);
  const spp = t.num(f, 277, 1), photo = t.num(f, 262, 1), comp = t.num(f, 259, 1), planar = t.num(f, 284, 1), pred = t.num(f, 317, 1);
  const bpsList = t.nums(f, 258), bps = bpsList[0] ?? 1;
  if (bpsList.some((b) => b !== bps)) throw new Error('its samples have different bit depths');
  const fmt = t.num(f, 339, 1);
  if (![1, 2, 4, 8, 16].includes(bps) || (fmt !== 1 && !(fmt === 2 && bps === 8))) throw new Error(`${bps}-bit ${fmt === 3 ? 'floating point ' : ''}samples are not supported`);
  if (![0, 1, 2, 3, 5, 6].includes(photo)) throw new Error('its colour model is not supported');
  if (comp === 6) throw new Error('old-style JPEG compression is not supported; re-save the TIFF with standard JPEG, LZW or Deflate');
  if (![1, 5, 7, 8, 32946, 32773].includes(comp)) throw new Error(`compression ${comp} is not supported`);
  if (comp === 7 && (bps !== 8 || photo === 5)) throw new Error('JPEG compression is only supported for 8-bit grey and RGB images');
  if (photo === 6 && comp !== 7) throw new Error('uncompressed YCbCr is not supported');
  const tiled = f.tags.has(322) && f.tags.has(324);
  const tw = tiled ? t.num(f, 322, width) : width, th = tiled ? t.num(f, 323, height) : Math.min(height, t.num(f, 278, height) || height);
  const offs = t.nums(f, tiled ? 324 : 273), counts = t.nums(f, tiled ? 325 : 279);
  if (!offs.length) throw new Error('it has no image data');
  const across = Math.ceil(width / tw), down = Math.ceil(height / th), perPlane = across * down, planes = planar === 2 ? spp : 1, spc = planar === 2 ? 1 : spp;
  const tables = t.raw(f, 347);
  const samples = new Uint8Array(width * height * spp);
  const maxv = (1 << bps) - 1, keepIndex = photo === 3;
  const norm = (v: number): number => (keepIndex ? v : bps === 8 ? v : bps === 16 ? Math.round(v / 257) : Math.round((v * 255) / maxv));
  for (let plane = 0; plane < planes; plane++) {
    for (let i = 0; i < perPlane; i++) {
      const ci = plane * perPlane + i;
      if (ci >= offs.length) throw new Error('some of its image data is missing');
      const start = offs[ci], size = counts[ci] ?? t.bytes.length - start, src = t.bytes.subarray(start, Math.min(t.bytes.length, start + size));
      const cx = tiled ? (i % across) * tw : 0, cy = tiled ? Math.floor(i / across) * th : i * th;
      const cw = tiled ? tw : width, ch = tiled ? th : Math.min(th, height - cy);
      const rowBytes = Math.ceil((cw * spc * bps) / 8);
      if (comp === 7) {
        const px = await jpegPixels(src, tables, photo === 2 && spp >= 3);
        for (let y = 0; y < ch && y < px.height; y++) for (let x = 0; x < cw && x < px.width; x++) {
          const X = cx + x, Y = cy + y;
          if (X >= width || Y >= height) continue;
          const s = (y * px.width + x) * 4, d = (Y * width + X) * spp;
          if (planar === 2) samples[(Y * width + X) * spp + plane] = px.data[s];
          else if (spp >= 3) { samples[d] = px.data[s]; samples[d + 1] = px.data[s + 1]; samples[d + 2] = px.data[s + 2]; }
          else samples[d] = px.data[s];
        }
        continue;
      }
      const need = rowBytes * ch;
      const buf = comp === 1 ? (src.length >= need ? src.subarray(0, need) : (() => { const b = new Uint8Array(need); b.set(src); return b; })()) : comp === 32773 ? packBitsDecode(src, need) : comp === 5 ? lzwDecode(src, need) : await inflate(src, need);
      let rows = buf;
      if (pred === 2 && bps >= 8) {
        rows = buf === src ? buf.slice() : buf;
        for (let y = 0; y < ch; y++) {
          const r = y * rowBytes;
          if (bps === 8) for (let x = spc; x < cw * spc; x++) rows[r + x] = (rows[r + x] + rows[r + x - spc]) & 255;
          else for (let x = spc; x < cw * spc; x++) {
            const p = r + x * 2, q = p - spc * 2;
            const a = t.le ? rows[p] | (rows[p + 1] << 8) : (rows[p] << 8) | rows[p + 1], b = t.le ? rows[q] | (rows[q + 1] << 8) : (rows[q] << 8) | rows[q + 1], s = (a + b) & 65535;
            if (t.le) { rows[p] = s & 255; rows[p + 1] = s >> 8; } else { rows[p] = s >> 8; rows[p + 1] = s & 255; }
          }
        }
      }
      for (let y = 0; y < ch; y++) {
        const Y = cy + y;
        if (Y >= height) break;
        const r = y * rowBytes;
        for (let x = 0; x < cw; x++) {
          const X = cx + x;
          if (X >= width) break;
          for (let s = 0; s < spc; s++) {
            let v: number;
            const k = x * spc + s;
            if (bps === 8) v = rows[r + k];
            else if (bps === 16) { const p = r + k * 2; v = t.le ? rows[p] | (rows[p + 1] << 8) : (rows[p] << 8) | rows[p + 1]; }
            else { const bit = k * bps; v = (rows[r + (bit >> 3)] >> (8 - bps - (bit & 7))) & maxv; }
            samples[(Y * width + X) * spp + (planar === 2 ? plane : s)] = norm(v);
          }
        }
      }
    }
  }
  const extra = t.nums(f, 338), rgba = new Uint8ClampedArray(width * height * 4);
  const base = photo === 5 ? 4 : photo === 2 || photo === 6 ? 3 : 1;
  const hasAlpha = spp > base && (extra.length ? extra[0] !== 0 : true), premult = extra[0] === 1;
  let palette: Uint8Array | null = null;
  if (photo === 3) {
    const cm = t.nums(f, 320), n = 1 << bps;
    if (cm.length < n * 3) throw new Error('its colour palette is missing');
    const wide = cm.some((v) => v > 255);
    palette = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) palette[i * 3 + c] = wide ? Math.round(cm[c * n + i] / 257) : cm[c * n + i];
  }
  const white0 = photo === 0;
  let anyAlpha = false;
  for (let p = 0, n = width * height; p < n; p++) {
    const s = p * spp, d = p * 4;
    let r: number, g: number, b: number;
    if (photo === 5) {
      const c = samples[s], m = samples[s + 1], y = samples[s + 2], k = samples[s + 3], rgb = cmykToRgb ? cmykToRgb(c, m, y, k) : null;
      if (rgb) { r = rgb[0]; g = rgb[1]; b = rgb[2]; } else { r = ((255 - c) * (255 - k) + 127) / 255; g = ((255 - m) * (255 - k) + 127) / 255; b = ((255 - y) * (255 - k) + 127) / 255; }
    } else if (photo === 3 && palette) { const i = samples[s] * 3; r = palette[i]; g = palette[i + 1]; b = palette[i + 2]; }
    else if (photo === 2 || photo === 6) { r = samples[s]; g = samples[s + 1]; b = samples[s + 2]; }
    else { const v = white0 ? 255 - samples[s] : samples[s]; r = g = b = v; }
    let a = 255;
    if (hasAlpha) {
      a = samples[s + base];
      if (a !== 255) anyAlpha = true;
      if (premult && a > 0 && a < 255) { r = Math.min(255, (r * 255) / a); g = Math.min(255, (g * 255) / a); b = Math.min(255, (b * 255) / a); }
    }
    rgba[d] = r; rgba[d + 1] = g; rgba[d + 2] = b; rgba[d + 3] = a;
  }
  const res = resolution(t, f), o = orient(rgba, width, height, t.num(f, 274, 1)), swapped = o.w !== width;
  const icc = t.raw(f, 34675);
  return { width: o.w, height: o.h, rgba: o.rgba, ppiX: swapped ? res.y : res.x, ppiY: swapped ? res.x : res.y, icc: icc ? icc.slice() : null, alpha: hasAlpha && anyAlpha, mode: `${MODE[photo] ?? 'Image'}, ${bps}-bit` };
}
