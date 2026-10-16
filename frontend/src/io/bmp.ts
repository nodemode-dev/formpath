export interface BmpOpts { bits: 24 | 32; ppi: number; icc?: Uint8Array | null }

export function encodeBmp(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, o: BmpOpts): Blob {
  const bpp = o.bits === 32 ? 4 : 3, stride = (w * bpp + 3) & ~3, data = stride * h;
  const icc = o.icc && o.icc.length ? o.icc : null;
  const head = o.bits === 32 || icc ? (icc ? 124 : 108) : 40, offset = 14 + head, iccAt = offset + data + (icc && (data & 3) ? 4 - (data & 3) : 0);
  const total = iccAt + (icc ? icc.length : 0);
  if (total > 0xffffffff) throw new Error('A BMP file can be at most 4 GB. Lower the resolution.');
  const buf = new Uint8Array(total), dv = new DataView(buf.buffer);
  buf[0] = 0x42; buf[1] = 0x4d;
  dv.setUint32(2, total, true); dv.setUint32(10, offset, true);
  const ppm = Math.round(o.ppi / 0.0254);
  dv.setUint32(14, head, true); dv.setInt32(18, w, true); dv.setInt32(22, h, true);
  dv.setUint16(26, 1, true); dv.setUint16(28, o.bits, true);
  dv.setUint32(30, o.bits === 32 ? 3 : 0, true); dv.setUint32(34, data, true);
  dv.setInt32(38, ppm, true); dv.setInt32(42, ppm, true);
  if (head >= 108) {
    dv.setUint32(54, 0x00ff0000, true); dv.setUint32(58, 0x0000ff00, true); dv.setUint32(62, 0x000000ff, true); dv.setUint32(66, o.bits === 32 ? 0xff000000 : 0, true);
    dv.setUint32(70, icc ? 0x4d424544 : 0x73524742, true);
    if (icc) { dv.setUint32(14 + 108, 4, true); dv.setUint32(14 + 112, iccAt - 14, true); dv.setUint32(14 + 116, icc.length, true); }
  }
  for (let y = 0; y < h; y++) {
    let q = offset + (h - 1 - y) * stride;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      buf[q++] = rgba[i + 2]; buf[q++] = rgba[i + 1]; buf[q++] = rgba[i];
      if (bpp === 4) buf[q++] = rgba[i + 3];
    }
  }
  if (icc) buf.set(icc, iccAt);
  return new Blob([buf], { type: 'image/bmp' });
}
