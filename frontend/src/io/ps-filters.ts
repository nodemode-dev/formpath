// PostScript data filters and sample unpacking for the EPS reader (ps-read.ts).
// A stream hands out one byte at a time and returns -1 at its end. Everything here is synchronous so the
// interpreter can stay synchronous; JPEG data is passed through as bytes and decoded by the browser later.

export interface PsStream { get(): number; raw?: boolean; live?: boolean; jpeg?: () => Uint8Array }

class Bytes {
  buf = new Uint8Array(4096);
  n = 0;
  push(b: number): void {
    if (this.n >= this.buf.length) { const g = new Uint8Array(this.buf.length * 2); g.set(this.buf); this.buf = g; }
    this.buf[this.n++] = b;
  }
  done(): Uint8Array { return this.buf.subarray(0, this.n); }
}

export function drain(src: PsStream, max = 1 << 28): Uint8Array {
  const out = new Bytes();
  for (let c = src.get(); c >= 0 && out.n < max; c = src.get()) out.push(c);
  return out.done();
}

export function bytesStream(b: Uint8Array): PsStream {
  let i = 0;
  return { get: () => (i < b.length ? b[i++] : -1) };
}

export function hexStream(src: PsStream): PsStream {
  let done = false;
  const nib = (): number => {
    for (;;) {
      const c = src.get();
      if (c < 0 || c === 62) { done = true; return -1; }
      if (c >= 48 && c <= 57) return c - 48;
      if (c >= 65 && c <= 70) return c - 55;
      if (c >= 97 && c <= 102) return c - 87;
    }
  };
  return { get: () => { if (done) return -1; const a = nib(); if (a < 0) return -1; const b = nib(); return (a << 4) | (b < 0 ? 0 : b); } };
}

export function a85Stream(src: PsStream): PsStream {
  const buf: number[] = [];
  let pos = 0, done = false, started = false;
  const fill = (): void => {
    const grp: number[] = [];
    while (grp.length < 5) {
      const c = src.get();
      if (c < 0) { done = true; break; }
      if (c <= 32) continue;
      if (!started) { started = true; if (c === 60) { src.get(); continue; } }
      if (c === 126) { src.get(); done = true; break; }
      if (c === 122 && grp.length === 0) { buf.push(0, 0, 0, 0); return; }
      if (c < 33 || c > 117) continue;
      grp.push(c - 33);
    }
    const n = grp.length;
    if (n < 2) { done = true; return; }
    while (grp.length < 5) grp.push(84);
    let v = 0;
    for (const g of grp) v = v * 85 + g;
    const u = v >>> 0, bytes = [(u >>> 24) & 255, (u >>> 16) & 255, (u >>> 8) & 255, u & 255];
    for (let i = 0; i < n - 1; i++) buf.push(bytes[i]);
  };
  return { get: () => { if (pos >= buf.length) { buf.length = 0; pos = 0; if (!done) fill(); if (!buf.length) return -1; } return buf[pos++]; } };
}

export function rlStream(src: PsStream): PsStream {
  let run = 0, lit = 0, val = 0, done = false;
  const next = (): number => { const c = src.get(); if (c < 0) done = true; return c; };
  return {
    get: () => {
      if (done) return -1;
      if (run > 0) { run--; return val; }
      if (lit > 0) { lit--; return next(); }
      const l = next();
      if (l < 0 || l === 128) { done = true; return -1; }
      if (l < 128) { lit = l; return next(); }
      const c = next();
      if (c < 0) return -1;
      run = 257 - l - 1; val = c;
      return c;
    },
  };
}

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CLORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

interface Huff { count: Uint16Array; sym: Uint16Array }
function huff(lengths: ArrayLike<number>, n: number): Huff {
  const count = new Uint16Array(16), sym = new Uint16Array(n), offs = new Uint16Array(17);
  for (let i = 0; i < n; i++) count[lengths[i]]++;
  count[0] = 0;
  for (let l = 1; l < 16; l++) offs[l + 1] = offs[l] + count[l];
  for (let i = 0; i < n; i++) if (lengths[i]) sym[offs[lengths[i]]++] = i;
  return { count, sym };
}

// zlib or raw deflate. A damaged or truncated stream returns what was decoded so far.
export function inflate(src: Uint8Array): Uint8Array {
  let p = 0, bitBuf = 0, bitCnt = 0, o = 0, out = new Uint8Array(Math.max(1024, src.length * 4));
  if (src.length > 2 && (src[0] & 15) === 8 && ((src[0] << 8) | src[1]) % 31 === 0) { p = 2; if (src[1] & 32) p += 4; }
  const need = (n: number): void => { if (o + n > out.length) { const g = new Uint8Array(Math.max(out.length * 2, o + n)); g.set(out); out = g; } };
  const bits = (n: number): number => {
    while (bitCnt < n) { if (p >= src.length) throw new Error('truncated'); bitBuf |= src[p++] << bitCnt; bitCnt += 8; }
    const v = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n; bitCnt -= n;
    return v;
  };
  const decode = (h: Huff): number => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const c = h.count[len];
      if (code - c < first) return h.sym[index + (code - first)];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error('bad code');
  };
  let fixedL: Huff | null = null, fixedD: Huff | null = null;
  try {
    for (;;) {
      const last = bits(1), type = bits(2);
      if (type === 0) {
        bitBuf = 0; bitCnt = 0;
        if (p + 4 > src.length) break;
        const len = src[p] | (src[p + 1] << 8);
        p += 4;
        const take = Math.min(len, src.length - p);
        need(take); out.set(src.subarray(p, p + take), o); o += take; p += take;
      } else if (type === 1 || type === 2) {
        let lit: Huff, dist: Huff;
        if (type === 1) {
          if (!fixedL || !fixedD) {
            const l = new Uint8Array(288);
            l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
            fixedL = huff(l, 288); fixedD = huff(new Uint8Array(30).fill(5), 30);
          }
          lit = fixedL; dist = fixedD;
        } else {
          const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4, cl = new Uint8Array(19);
          for (let i = 0; i < hclen; i++) cl[CLORDER[i]] = bits(3);
          const ch = huff(cl, 19), lens = new Uint8Array(hlit + hdist);
          for (let i = 0; i < hlit + hdist;) {
            const s = decode(ch);
            if (s < 16) lens[i++] = s;
            else {
              let rep: number, val = 0;
              if (s === 16) { if (!i) throw new Error('bad repeat'); val = lens[i - 1]; rep = 3 + bits(2); }
              else if (s === 17) rep = 3 + bits(3);
              else rep = 11 + bits(7);
              while (rep-- && i < hlit + hdist) lens[i++] = val;
            }
          }
          lit = huff(lens.subarray(0, hlit), hlit); dist = huff(lens.subarray(hlit), hdist);
        }
        for (;;) {
          const s = decode(lit);
          if (s < 256) { need(1); out[o++] = s; }
          else if (s === 256) break;
          else {
            const k = s - 257;
            if (k >= 29) throw new Error('bad length');
            const len = LBASE[k] + bits(LEXT[k]), ds = decode(dist);
            if (ds >= 30) throw new Error('bad distance');
            const d = DBASE[ds] + bits(DEXT[ds]);
            if (d > o) throw new Error('bad distance');
            need(len);
            for (let i = 0; i < len; i++, o++) out[o] = out[o - d];
          }
        }
      } else throw new Error('bad block');
      if (last) break;
    }
  } catch { /* keep what was decoded */ }
  return out.subarray(0, o);
}

export function flateStream(src: PsStream): PsStream {
  let data: Uint8Array | null = null, i = 0;
  return { get: () => { if (!data) data = inflate(drain(src)); return i < data.length ? data[i++] : -1; } };
}

// Reads one complete JPEG (SOI to EOI) from a stream that does not mark its own end.
export function readJpeg(src: PsStream): Uint8Array {
  const out = new Bytes();
  if (src.get() !== 255 || src.get() !== 216) return out.done();
  out.push(255); out.push(216);
  let marker = -1;
  scan: for (;;) {
    if (marker < 0) {
      let c = src.get();
      while (c >= 0 && c !== 255) c = src.get();
      if (c < 0) break;
      while (c === 255) c = src.get();
      if (c < 0) break;
      marker = c;
    }
    const m = marker;
    marker = -1;
    out.push(255); out.push(m);
    if (m === 0xd9) break;
    if (m === 0x01 || m === 0xd8 || (m >= 0xd0 && m <= 0xd7)) continue;
    const l1 = src.get(), l2 = src.get();
    if (l2 < 0) break;
    out.push(l1); out.push(l2);
    for (let i = 0, len = (l1 << 8) | l2; i < len - 2; i++) { const c = src.get(); if (c < 0) break scan; out.push(c); }
    if (m === 0xda) {
      for (;;) {
        const c = src.get();
        if (c < 0) break scan;
        if (c !== 255) { out.push(c); continue; }
        let d = src.get();
        while (d === 255) d = src.get();
        if (d < 0) break scan;
        if (d === 0 || (d >= 0xd0 && d <= 0xd7)) { out.push(255); out.push(d); continue; }
        marker = d;
        break;
      }
    }
  }
  return out.done();
}

export function dctStream(src: PsStream): PsStream {
  let data: Uint8Array | null = null, i = 0;
  const load = (): Uint8Array => (data ??= src.raw ? readJpeg(src) : drain(src));
  return { get: () => { const d = load(); return i < d.length ? d[i++] : -1; }, jpeg: load };
}

// SubFileDecode: passes bytes through until the end-of-data string has been seen count + 1 times, or for count bytes when the string is empty.
export function subStream(src: PsStream, count: number, eod: string): PsStream {
  const tail: number[] = [];
  let done = false, seen = 0, left = count;
  return {
    get: () => {
      if (done) return -1;
      if (!eod.length) { if (left-- > 0) { const c = src.get(); if (c < 0) done = true; return c; } done = true; return -1; }
      const c = src.get();
      if (c < 0) { done = true; return -1; }
      tail.push(c);
      if (tail.length > eod.length) tail.shift();
      if (tail.length === eod.length && tail.every((v, i) => v === eod.charCodeAt(i)) && seen++ >= count) done = true;
      return c;
    },
  };
}

// The filter names a decoding stage understands. Returns null for a filter it cannot run.
export function filterStream(name: string, src: PsStream): PsStream | null {
  switch (name) {
    case 'ASCIIHexDecode': return hexStream(src);
    case 'ASCII85Decode': return a85Stream(src);
    case 'RunLengthDecode': return rlStream(src);
    case 'FlateDecode': return flateStream(src);
    case 'DCTDecode': return dctStream(src);
    default: return null;
  }
}

// One sample of a row, bits wide, as 0..1 before Decode.
function sampleAt(row: Uint8Array, idx: number, bits: number): number {
  if (bits === 8) return (row[idx] ?? 0) / 255;
  if (bits === 16) return (((row[idx * 2] ?? 0) << 8) | (row[idx * 2 + 1] ?? 0)) / 65535;
  if (bits === 12) { const at = idx * 12, b = at >> 3, v = at & 7 ? ((row[b] & 15) << 8) | (row[b + 1] ?? 0) : ((row[b] ?? 0) << 4) | ((row[b + 1] ?? 0) >> 4); return v / 4095; }
  const at = idx * bits, max = (1 << bits) - 1, shift = 8 - bits - (at & 7);
  return (((row[at >> 3] ?? 0) >> shift) & max) / max;
}

export interface Samples {
  w: number; h: number; bits: number; comps: number;
  rows: Uint8Array[][];           // rows[y][source]: packed row bytes; one source when interleaved, comps sources when planar
  decode: number[];               // 2 entries per component
  palette?: Uint8Array;           // Indexed colour space: rgb triples; samples are indices
  mask?: { paintOne: boolean; r: number; g: number; b: number };
}

export function toRgba(s: Samples): Uint8ClampedArray {
  const { w, h, bits, comps, decode } = s, out = new Uint8ClampedArray(w * h * 4), planar = s.rows[0]?.length === comps && comps > 1;
  const maxv = bits >= 16 ? 65535 : (1 << bits) - 1;
  const v = new Float64Array(comps);
  for (let y = 0; y < h; y++) {
    const srcs = s.rows[y];
    if (!srcs) break;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (s.mask) {
        const bit = sampleAt(srcs[0], x, bits) * maxv > 0.5 ? 1 : 0;
        const paint = s.mask.paintOne ? bit === 1 : bit === 0;
        out[o] = s.mask.r; out[o + 1] = s.mask.g; out[o + 2] = s.mask.b; out[o + 3] = paint ? 255 : 0;
        continue;
      }
      for (let c = 0; c < comps; c++) {
        const t = planar ? sampleAt(srcs[c], x, bits) : sampleAt(srcs[0], x * comps + c, bits);
        v[c] = s.palette ? t * maxv : decode[c * 2] + t * (decode[c * 2 + 1] - decode[c * 2]);
      }
      if (s.palette) {
        const i = Math.max(0, Math.min(Math.floor(s.palette.length / 3) - 1, Math.round(v[0]))) * 3;
        out[o] = s.palette[i]; out[o + 1] = s.palette[i + 1]; out[o + 2] = s.palette[i + 2]; out[o + 3] = 255;
      } else if (comps === 1) { const g = Math.max(0, Math.min(1, v[0])) * 255; out[o] = g; out[o + 1] = g; out[o + 2] = g; out[o + 3] = 255; }
      else if (comps === 3) { out[o] = Math.max(0, Math.min(1, v[0])) * 255; out[o + 1] = Math.max(0, Math.min(1, v[1])) * 255; out[o + 2] = Math.max(0, Math.min(1, v[2])) * 255; out[o + 3] = 255; }
      else {
        const k = 1 - Math.max(0, Math.min(1, v[3]));
        out[o] = (1 - Math.max(0, Math.min(1, v[0]))) * k * 255; out[o + 1] = (1 - Math.max(0, Math.min(1, v[1]))) * k * 255; out[o + 2] = (1 - Math.max(0, Math.min(1, v[2]))) * k * 255; out[o + 3] = 255;
      }
    }
  }
  return out;
}
