export interface IccPayload { bytes: Uint8Array; name: string }

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

function crc32(parts: Uint8Array[]): number {
  let c = 0xffffffff;
  for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC[(c ^ p[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function zlib(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') throw new Error('This browser cannot compress the colour profile.');
  const out = new Response(new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate')));
  return new Uint8Array(await out.arrayBuffer());
}

function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export const isSrgbName = (name: string): boolean => /srgb/i.test(name);

function pngKeyword(name: string): Uint8Array {
  const clean = name.replace(/[^\x20-\x7e]/g, '?').replace(/^ +| +$/g, '').replace(/ {2,}/g, ' ').slice(0, 79) || 'ICC profile';
  return Uint8Array.from(clean, (ch) => ch.charCodeAt(0));
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const head = new Uint8Array(8), dv = new DataView(head.buffer), tag = Uint8Array.from(type, (ch) => ch.charCodeAt(0));
  dv.setUint32(0, data.length);
  head.set(tag, 4);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crc32([tag, data]));
  return join([head, data, crc]);
}

export async function embedPng(png: Uint8Array, icc: IccPayload): Promise<Uint8Array> {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (png.length < 33 || sig.some((b, i) => png[i] !== b)) return png;
  const dv = new DataView(png.buffer, png.byteOffset, png.length), ihdrEnd = 8 + 12 + dv.getUint32(8), rest: Uint8Array[] = [];
  for (let o = ihdrEnd; o + 12 <= png.length;) {
    const len = dv.getUint32(o), type = String.fromCharCode(png[o + 4], png[o + 5], png[o + 6], png[o + 7]);
    if (type !== 'iCCP' && type !== 'sRGB' && type !== 'gAMA') rest.push(png.subarray(o, o + 12 + len));
    o += 12 + len;
  }
  const kw = pngKeyword(icc.name), body = join([kw, Uint8Array.of(0, 0), await zlib(icc.bytes)]);
  const extra = [pngChunk('iCCP', body)];
  if (isSrgbName(icc.name)) { const g = new Uint8Array(4); new DataView(g.buffer).setUint32(0, 45455); extra.push(pngChunk('gAMA', g)); }
  return join([png.subarray(0, ihdrEnd), ...extra, ...rest]);
}

export function embedJpeg(jpg: Uint8Array, icc: IccPayload): Uint8Array {
  if (jpg.length < 4 || jpg[0] !== 0xff || jpg[1] !== 0xd8) return jpg;
  let at = 2;
  const kept: Uint8Array[] = [];
  while (at + 4 <= jpg.length && jpg[at] === 0xff && jpg[at + 1] >= 0xe0 && jpg[at + 1] <= 0xef) {
    const end = at + 2 + ((jpg[at + 2] << 8) | jpg[at + 3]), isIcc = jpg[at + 1] === 0xe2 && String.fromCharCode(...jpg.subarray(at + 4, at + 15)) === 'ICC_PROFILE';
    if (!isIcc) kept.push(jpg.subarray(at, end));
    at = end;
  }
  const per = 65519, count = Math.max(1, Math.ceil(icc.bytes.length / per)), id = Uint8Array.from('ICC_PROFILE\0', (ch) => ch.charCodeAt(0)), segs: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const part = icc.bytes.subarray(i * per, (i + 1) * per), len = 2 + id.length + 2 + part.length, head = Uint8Array.of(0xff, 0xe2, len >> 8, len & 255);
    segs.push(head, id, Uint8Array.of(i + 1, count), part);
  }
  const first = kept.filter((s) => s[1] === 0xe0), others = kept.filter((s) => s[1] !== 0xe0);
  return join([jpg.subarray(0, 2), ...first, ...segs, ...others, jpg.subarray(at)]);
}

function riffChunk(tag: string, data: Uint8Array): Uint8Array {
  const head = new Uint8Array(8);
  head.set(Uint8Array.from(tag, (ch) => ch.charCodeAt(0)), 0);
  new DataView(head.buffer).setUint32(4, data.length, true);
  return join(data.length & 1 ? [head, data, Uint8Array.of(0)] : [head, data]);
}

function webpSize(tag: string, d: Uint8Array): { w: number; h: number; alpha: boolean } | null {
  if (tag === 'VP8 ' && d.length >= 10 && d[3] === 0x9d && d[4] === 0x01 && d[5] === 0x2a) return { w: ((d[7] << 8) | d[6]) & 0x3fff, h: ((d[9] << 8) | d[8]) & 0x3fff, alpha: false };
  if (tag === 'VP8L' && d.length >= 5 && d[0] === 0x2f) { const b = d[1] | (d[2] << 8) | (d[3] << 16) | (d[4] << 24); return { w: (b & 0x3fff) + 1, h: ((b >>> 14) & 0x3fff) + 1, alpha: ((b >>> 28) & 1) === 1 }; }
  return null;
}

export function embedWebp(webp: Uint8Array, icc: IccPayload): Uint8Array {
  const tag = (o: number): string => String.fromCharCode(webp[o], webp[o + 1], webp[o + 2], webp[o + 3]);
  if (webp.length < 20 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return webp;
  const dv = new DataView(webp.buffer, webp.byteOffset, webp.length), chunks: Array<{ tag: string; data: Uint8Array }> = [];
  for (let o = 12; o + 8 <= webp.length;) {
    const size = dv.getUint32(o + 4, true), data = webp.subarray(o + 8, o + 8 + size);
    chunks.push({ tag: tag(o), data });
    o += 8 + size + (size & 1);
  }
  const rest = chunks.filter((c) => c.tag !== 'ICCP');
  let ext = rest.find((c) => c.tag === 'VP8X');
  if (!ext) {
    const img = rest.find((c) => c.tag === 'VP8 ' || c.tag === 'VP8L'), dim = img ? webpSize(img.tag, img.data) : null;
    if (!img || !dim) return webp;
    const d = new Uint8Array(10);
    d[0] = dim.alpha ? 0x10 : 0;
    d[4] = (dim.w - 1) & 255; d[5] = ((dim.w - 1) >> 8) & 255; d[6] = ((dim.w - 1) >> 16) & 255;
    d[7] = (dim.h - 1) & 255; d[8] = ((dim.h - 1) >> 8) & 255; d[9] = ((dim.h - 1) >> 16) & 255;
    ext = { tag: 'VP8X', data: d };
    rest.unshift(ext);
  } else ext = { tag: 'VP8X', data: Uint8Array.from(ext.data) };
  ext.data[0] |= 0x20;
  const body = [ext, { tag: 'ICCP', data: icc.bytes }, ...rest.filter((c) => c.tag !== 'VP8X')].map((c) => riffChunk(c.tag, c.data)), size = 4 + body.reduce((a, c) => a + c.length, 0), head = new Uint8Array(12);
  head.set(Uint8Array.from('RIFF', (ch) => ch.charCodeAt(0)), 0);
  new DataView(head.buffer).setUint32(4, size, true);
  head.set(Uint8Array.from('WEBP', (ch) => ch.charCodeAt(0)), 8);
  return join([head, ...body]);
}

export function embedPsd(psd: Uint8Array, icc: IccPayload): Uint8Array {
  if (psd.length < 34 || String.fromCharCode(psd[0], psd[1], psd[2], psd[3]) !== '8BPS') return psd;
  const dv = new DataView(psd.buffer, psd.byteOffset, psd.length), modeLen = dv.getUint32(26), resAt = 30 + modeLen;
  if (resAt + 4 > psd.length) return psd;
  const resLen = dv.getUint32(resAt), start = resAt + 4, end = start + resLen, kept: Uint8Array[] = [];
  for (let o = start; o + 12 <= end;) {
    const nameLen = psd[o + 6], nameSpan = (1 + nameLen + 1) & ~1, size = dv.getUint32(o + 6 + nameSpan), id = dv.getUint16(o + 4), total = 6 + nameSpan + 4 + size + (size & 1);
    if (id !== 1039) kept.push(psd.subarray(o, o + total));
    o += total;
  }
  const head = new Uint8Array(12), hv = new DataView(head.buffer);
  head.set(Uint8Array.from('8BIM', (ch) => ch.charCodeAt(0)), 0);
  hv.setUint16(4, 1039); hv.setUint16(6, 0); hv.setUint32(8, icc.bytes.length);
  const block = join(icc.bytes.length & 1 ? [head, icc.bytes, Uint8Array.of(0)] : [head, icc.bytes]), body = join([...kept, block]), len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, body.length);
  return join([psd.subarray(0, resAt), len, body, psd.subarray(end)]);
}

export async function embedIcc(blob: Blob, format: 'png' | 'jpg' | 'webp' | 'psd', icc: IccPayload): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const out = format === 'png' ? await embedPng(bytes, icc) : format === 'jpg' ? embedJpeg(bytes, icc) : format === 'psd' ? embedPsd(bytes, icc) : embedWebp(bytes, icc);
  return out === bytes ? blob : new Blob([out as Uint8Array<ArrayBuffer>], { type: blob.type });
}
