import { rgbToCmyk } from '../engine/paint';

export type TiffCompression = 'none' | 'packbits' | 'lzw' | 'deflate';
export interface TiffOpts { ppi: number; alpha: boolean; cmyk?: boolean; compression?: TiffCompression; title?: string; icc?: Uint8Array | null; convert?: (r: number, g: number, b: number, out: Uint8Array, at: number) => void }

function packBits(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < src.length) {
    let run = 1;
    while (i + run < src.length && run < 128 && src[i + run] === src[i]) run++;
    if (run >= 2) { out.push(257 - run, src[i]); i += run; continue; }
    const s = i;
    i++;
    while (i < src.length && i - s < 128 && !(i + 1 < src.length && src[i] === src[i + 1])) i++;
    out.push(i - s - 1);
    for (let j = s; j < i; j++) out.push(src[j]);
  }
  return Uint8Array.from(out);
}

function lzw(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  let acc = 0, nb = 0, bits = 9, next = 258;
  let table = new Map<number, number>();
  const put = (code: number): void => {
    acc = (acc << bits) | code; nb += bits;
    while (nb >= 8) { nb -= 8; out.push((acc >>> nb) & 0xff); }
    acc &= (1 << nb) - 1;
  };
  const reset = (): void => { table = new Map(); next = 258; bits = 9; };
  put(256);
  if (src.length) {
    let w = src[0];
    for (let i = 1; i < src.length; i++) {
      const c = src[i], key = (w << 8) | c, hit = table.get(key);
      if (hit !== undefined) { w = hit; continue; }
      put(w);
      table.set(key, next++);
      if (next === 512) bits = 10; else if (next === 1024) bits = 11; else if (next === 2048) bits = 12;
      if (next === 4094) { put(256); reset(); }
      w = c;
    }
    put(w);
    if (next === 511) bits = 10; else if (next === 1023) bits = 11; else if (next === 2047) bits = 12;
  }
  put(257);
  if (nb > 0) out.push((acc << (8 - nb)) & 0xff);
  return Uint8Array.from(out);
}

async function zlib(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') throw new Error('This browser cannot compress with Deflate. Choose LZW or PackBits.');
  const out = new Response(new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate')));
  return new Uint8Array(await out.arrayBuffer());
}

export async function encodeTiff(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, o: TiffOpts): Promise<Blob> {
  const cmyk = !!o.cmyk, spp = cmyk ? (o.alpha ? 5 : 4) : o.alpha ? 4 : 3, comp = o.compression ?? 'lzw';
  const rowBytes = w * spp, rps = Math.max(1, Math.min(h, Math.floor(65536 / rowBytes)));
  const strips: Uint8Array[] = [];
  for (let y0 = 0; y0 < h; y0 += rps) {
    const rows = Math.min(rps, h - y0), raw = new Uint8Array(rows * rowBytes);
    let q = 0;
    for (let y = y0; y < y0 + rows; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (cmyk) {
        if (o.convert) { o.convert(rgba[i], rgba[i + 1], rgba[i + 2], raw, q); q += 4; }
        else {
          const k = rgbToCmyk(rgba[i], rgba[i + 1], rgba[i + 2]);
          if (k.kind === 'cmyk') { raw[q++] = Math.round(k.c * 2.55); raw[q++] = Math.round(k.m * 2.55); raw[q++] = Math.round(k.y * 2.55); raw[q++] = Math.round(k.k * 2.55); }
        }
      } else { raw[q++] = rgba[i]; raw[q++] = rgba[i + 1]; raw[q++] = rgba[i + 2]; }
      if (o.alpha) raw[q++] = rgba[i + 3];
    }
    strips.push(comp === 'packbits' ? packBits(raw) : comp === 'lzw' ? lzw(raw) : comp === 'deflate' ? await zlib(raw) : raw);
  }
  const enc = new TextEncoder(), software = enc.encode('formpath\0'), ppi = Math.max(1, Math.round(o.ppi));
  const tags: Array<[number, number, number, number | number[]]> = [];
  const n = strips.length;
  const icc = o.icc && o.icc.length ? o.icc : null;
  const entries = 13 + (o.alpha ? 1 : 0) + (cmyk ? 1 : 0) + (icc ? 1 : 0);
  const ifdSize = 2 + entries * 12 + 4;
  let extra = 8 + ifdSize;
  const offsetOf = (len: number): number => { const at = extra; extra += len + (len & 1); return at; };
  const bpsAt = offsetOf(spp * 2), xresAt = offsetOf(8), yresAt = offsetOf(8), swAt = offsetOf(software.length), iccAt = icc ? offsetOf(icc.length) : 0;
  const countsAt = n > 1 ? offsetOf(n * 4) : 0, offsetsAt = n > 1 ? offsetOf(n * 4) : 0;
  const dataStart = extra;
  const stripOffsets: number[] = [];
  let pos = dataStart;
  for (const s of strips) { stripOffsets.push(pos); pos += s.length + (s.length & 1); }
  const total = pos, buf = new Uint8Array(total), dv = new DataView(buf.buffer);
  buf[0] = 0x49; buf[1] = 0x49; dv.setUint16(2, 42, true); dv.setUint32(4, 8, true);
  const at = (o2: number): number => o2;
  tags.push([256, 4, 1, w], [257, 4, 1, h], [258, 3, spp, bpsAt], [259, 3, 1, comp === 'none' ? 1 : comp === 'packbits' ? 32773 : comp === 'lzw' ? 5 : 8], [262, 3, 1, cmyk ? 5 : 2]);
  tags.push([273, 4, n, n > 1 ? offsetsAt : stripOffsets[0]], [277, 3, 1, spp], [278, 4, 1, rps], [279, 4, n, n > 1 ? countsAt : strips[0].length]);
  tags.push([282, 5, 1, xresAt], [283, 5, 1, yresAt], [296, 3, 1, 2], [305, 2, software.length, swAt]);
  if (cmyk) tags.push([332, 3, 1, 1]);
  if (o.alpha) tags.push([338, 3, 1, 2]);
  if (icc) tags.push([34675, 7, icc.length, iccAt]);
  tags.sort((a, b) => a[0] - b[0]);
  dv.setUint16(at(8), tags.length, true);
  tags.forEach((t, i) => {
    const e = at(8) + 2 + i * 12;
    dv.setUint16(e, t[0], true); dv.setUint16(e + 2, t[1], true); dv.setUint32(e + 4, t[2], true);
    const v = t[3] as number;
    if (t[1] === 3 && t[2] === 1) dv.setUint16(e + 8, v, true); else dv.setUint32(e + 8, v, true);
  });
  dv.setUint32(at(8) + 2 + tags.length * 12, 0, true);
  for (let i = 0; i < spp; i++) dv.setUint16(bpsAt + i * 2, 8, true);
  dv.setUint32(xresAt, ppi, true); dv.setUint32(xresAt + 4, 1, true);
  dv.setUint32(yresAt, ppi, true); dv.setUint32(yresAt + 4, 1, true);
  buf.set(software, swAt);
  if (icc) buf.set(icc, iccAt);
  if (n > 1) strips.forEach((s, i) => { dv.setUint32(countsAt + i * 4, s.length, true); dv.setUint32(offsetsAt + i * 4, stripOffsets[i], true); });
  strips.forEach((s, i) => buf.set(s, stripOffsets[i]));
  return new Blob([buf], { type: 'image/tiff' });
}
