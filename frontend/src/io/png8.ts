import type { Indexed } from './palette';

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  let c = 0xffffffff;
  for (let i = 4; i < 8 + data.length; i++) c = CRC[(c ^ out[i]) & 255] ^ (c >>> 8);
  dv.setUint32(8 + data.length, (c ^ 0xffffffff) >>> 0);
  return out;
}

async function zlib(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') throw new Error('This browser cannot compress PNG data.');
  return new Uint8Array(await new Response(new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
}

export async function encodePng8(img: Indexed, o: { ppi: number }): Promise<Blob> {
  const { width: w, height: h, count } = img;
  const depth = count <= 2 ? 1 : count <= 4 ? 2 : count <= 16 ? 4 : 8, rowBytes = Math.ceil((w * depth) / 8);
  const raw = new Uint8Array((rowBytes + 1) * h);
  for (let y = 0; y < h; y++) {
    const at = y * (rowBytes + 1);
    if (depth === 8) raw.set(img.pixels.subarray(y * w, (y + 1) * w), at + 1);
    else for (let x = 0; x < w; x++) raw[at + 1 + ((x * depth) >> 3)] |= img.pixels[y * w + x] << (8 - depth - ((x * depth) & 7));
  }
  const head = new Uint8Array(13), dv = new DataView(head.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h);
  head[8] = depth; head[9] = 3;
  const ppm = Math.round(o.ppi / 0.0254), phys = new Uint8Array(9), pv = new DataView(phys.buffer);
  pv.setUint32(0, ppm); pv.setUint32(4, ppm); phys[8] = 1;
  const parts: Uint8Array[] = [Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), chunk('IHDR', head), chunk('PLTE', img.palette.subarray(0, count * 3))];
  if (img.trans >= 0) parts.push(chunk('tRNS', new Uint8Array(img.trans + 1).fill(255).fill(0, img.trans)));
  parts.push(chunk('pHYs', phys), chunk('IDAT', await zlib(raw)), chunk('IEND', new Uint8Array(0)));
  return new Blob(parts as Uint8Array<ArrayBuffer>[], { type: 'image/png' });
}
