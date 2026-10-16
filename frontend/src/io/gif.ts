import type { Indexed } from './palette';

class Bytes {
  buf = new Uint8Array(1 << 16);
  n = 0;
  put(v: number): void { if (this.n === this.buf.length) { const b = new Uint8Array(this.buf.length * 2); b.set(this.buf); this.buf = b; } this.buf[this.n++] = v; }
  u16(v: number): void { this.put(v & 255); this.put((v >> 8) & 255); }
  all(arr: ArrayLike<number>): void { for (let i = 0; i < arr.length; i++) this.put(arr[i]); }
  done(): Uint8Array { return this.buf.slice(0, this.n); }
}

function lzw(pixels: Uint8Array, minCode: number): Uint8Array {
  const out = new Bytes(), clear = 1 << minCode, eoi = clear + 1;
  let acc = 0, nb = 0, size = minCode + 1, next = eoi + 1, dict = new Map<number, number>();
  const emit = (code: number): void => {
    acc |= code << nb; nb += size;
    while (nb >= 8) { out.put(acc & 255); acc >>>= 8; nb -= 8; }
  };
  emit(clear);
  if (pixels.length) {
    let prefix = pixels[0];
    for (let i = 1; i < pixels.length; i++) {
      const k = pixels[i], key = (prefix << 8) | k, hit = dict.get(key);
      if (hit !== undefined) { prefix = hit; continue; }
      emit(prefix);
      if (next === 4096) { emit(clear); dict = new Map(); next = eoi + 1; size = minCode + 1; }
      else { if (next >= (1 << size)) size++; dict.set(key, next++); }
      prefix = k;
    }
    emit(prefix);
  }
  emit(eoi);
  if (nb > 0) out.put(acc & 255);
  return out.done();
}

export function interlaceRows(h: number): number[] {
  const rows: number[] = [];
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let y = start; y < h; y += step) rows.push(y);
  return rows;
}

export function encodeGif(img: Indexed, o: { interlace?: boolean } = {}): Blob {
  const { width: w, height: h } = img;
  if (w > 65535 || h > 65535) throw new Error('A GIF can be at most 65,535 pixels on a side. Lower the resolution.');
  let bits = 1;
  while ((1 << bits) < img.count) bits++;
  const table = 1 << bits, minCode = Math.max(2, bits), out = new Bytes();
  out.all(Array.from('GIF89a', (c) => c.charCodeAt(0)));
  out.u16(w); out.u16(h);
  out.put(0x80 | (7 << 4) | (bits - 1)); out.put(0); out.put(0);
  const pal = new Uint8Array(table * 3);
  pal.set(img.palette.subarray(0, img.count * 3));
  out.all(pal);
  if (img.trans >= 0) { out.put(0x21); out.put(0xf9); out.put(4); out.put(0x09); out.u16(0); out.put(img.trans); out.put(0); }
  out.put(0x2c); out.u16(0); out.u16(0); out.u16(w); out.u16(h); out.put(o.interlace ? 0x40 : 0);
  let pixels = img.pixels;
  if (o.interlace) {
    const rows = interlaceRows(h), re = new Uint8Array(pixels.length);
    rows.forEach((y, i) => re.set(pixels.subarray(y * w, (y + 1) * w), i * w));
    pixels = re;
  }
  out.put(minCode);
  const data = lzw(pixels, minCode);
  for (let i = 0; i < data.length; i += 255) { const n = Math.min(255, data.length - i); out.put(n); for (let j = 0; j < n; j++) out.put(data[i + j]); }
  out.put(0);
  out.put(0x3b);
  return new Blob([out.done() as Uint8Array<ArrayBuffer>], { type: 'image/gif' });
}
