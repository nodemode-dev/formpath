export class DwgError extends Error {}
export class DwgUnsupportedError extends DwgError {}

const scratch = new DataView(new ArrayBuffer(8));

export class Bits {
  pos = 0;
  constructor(readonly d: Uint8Array, readonly end = d.length * 8, start = 0) { this.pos = start; }

  private need(n: number): void { if (this.pos + n > this.end) throw new DwgError('Read past the end of a record.'); }
  bit(): number { this.need(1); const p = this.pos++; return (this.d[p >> 3] >> (7 - (p & 7))) & 1; }
  bits(n: number): number { let v = 0; for (let i = 0; i < n; i++) v = v * 2 + this.bit(); return v; }
  rc(): number {
    this.need(8);
    const p = this.pos, i = p >> 3, s = p & 7;
    this.pos += 8;
    return s === 0 ? this.d[i] : ((this.d[i] << s) | ((this.d[i + 1] ?? 0) >> (8 - s))) & 255;
  }
  rs(): number { const a = this.rc(); return a | (this.rc() << 8); }
  rsBE(): number { const a = this.rc(); return (a << 8) | this.rc(); }
  rl(): number { const a = this.rs(); return (a | (this.rs() << 16)) >>> 0; }
  rll(): number { const a = this.rl(); return a + this.rl() * 4294967296; }
  rd(): number { for (let i = 0; i < 8; i++) scratch.setUint8(i, this.rc()); return scratch.getFloat64(0, true); }
  b(): number { return this.bit(); }
  bb(): number { return (this.bit() << 1) | this.bit(); }
  tb(): number { if (!this.bit()) return 0; if (!this.bit()) return 2; return this.bit() ? 7 : 6; }
  bs(): number { const c = this.bb(); return c === 0 ? this.rs() : c === 1 ? this.rc() : c === 2 ? 0 : 256; }
  bl(): number { const c = this.bb(); return c === 0 ? this.rl() : c === 1 ? this.rc() : 0; }
  bll(): number { const n = this.bits(3); let v = 0, m = 1; for (let i = 0; i < n; i++) { v += this.rc() * m; m *= 256; } return v; }
  bd(): number { const c = this.bb(); return c === 0 ? this.rd() : c === 1 ? 1 : 0; }
  dd(def: number): number {
    const c = this.bb();
    if (c === 0) return def;
    if (c === 3) return this.rd();
    scratch.setFloat64(0, def, true);
    if (c === 1) { for (let i = 0; i < 4; i++) scratch.setUint8(i, this.rc()); }
    else { scratch.setUint8(4, this.rc()); scratch.setUint8(5, this.rc()); for (let i = 0; i < 4; i++) scratch.setUint8(i, this.rc()); }
    return scratch.getFloat64(0, true);
  }
  bt(): number { return this.bit() ? 0 : this.bd(); }
  be(): [number, number, number] { return this.bit() ? [0, 0, 1] : [this.bd(), this.bd(), this.bd()]; }
  p3(): [number, number, number] { return [this.bd(), this.bd(), this.bd()]; }
  r2(): [number, number] { return [this.rd(), this.rd()]; }
  mc(): number {
    let v = 0, m = 1;
    for (let i = 0; i < 10; i++) {
      const c = this.rc();
      if (!(c & 0x80)) { const neg = (c & 0x40) !== 0; v += (c & 0x3f) * m; return neg ? -v : v; }
      v += (c & 0x7f) * m; m *= 128;
    }
    throw new DwgError('Bad modular char.');
  }
  mcU(): number {
    let v = 0, m = 1;
    for (let i = 0; i < 10; i++) {
      const c = this.rc();
      v += (c & 0x7f) * m; m *= 128;
      if (!(c & 0x80)) return v;
    }
    throw new DwgError('Bad modular char.');
  }
  ms(): number {
    let v = 0, m = 1;
    for (let i = 0; i < 4; i++) {
      const lo = this.rs();
      v += (lo & 0x7fff) * m; m *= 32768;
      if (!(lo & 0x8000)) return v;
    }
    throw new DwgError('Bad modular short.');
  }
  skipBytes(n: number): void { this.need(n * 8); this.pos += n * 8; }
  bytes(n: number): Uint8Array { const o = new Uint8Array(n); for (let i = 0; i < n; i++) o[i] = this.rc(); return o; }
  align(): void { this.pos = (this.pos + 7) & ~7; }
  // Handle reference: returns the absolute handle, resolving relative codes against ref.
  h(ref = 0): number {
    const x = this.rc(), code = x >> 4, n = x & 15;
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 256 + this.rc();
    switch (code) {
      case 6: return ref + 1;
      case 8: return ref - 1;
      case 10: return ref + v;
      case 12: return ref - v;
      default: return v;
    }
  }
  tvCp(): string {
    const n = this.bs();
    if (n <= 0) return '';
    const b = this.bytes(n);
    let e = n;
    while (e > 0 && b[e - 1] === 0) e--;
    return cp1252(b.subarray(0, e));
  }
  tuStr(): string {
    const n = this.bs();
    if (n <= 0) return '';
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.rs());
    const z = s.indexOf('\u0000');
    return z >= 0 ? s.slice(0, z) : s;
  }
}

const CP1252_HI = [0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178];
export function cp1252(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) { const c = b[i]; s += String.fromCharCode(c >= 0x80 && c < 0xa0 ? CP1252_HI[c - 0x80] : c); }
  return s;
}

// The pseudo-random mask that hides the R2004 and later file header: a linear congruential sequence seeded with 1.
export function headerMask(n: number): Uint8Array {
  const out = new Uint8Array(n);
  let seed = 1;
  for (let i = 0; i < n; i++) { seed = (Math.imul(seed, 0x343fd) + 0x269ec3) | 0; out[i] = (seed >>> 16) & 255; }
  return out;
}

// The LZ77 variant of R2004 and later (compression type 2).
export function lz77(src: Uint8Array, start: number, length: number, outSize: number): Uint8Array {
  const out = new Uint8Array(outSize);
  let ip = start, op = 0;
  const stop = start + length;
  const rd = (): number => { if (ip >= stop) throw new DwgError('Compressed data ends early.'); return src[ip++]; };
  const longLen = (): number => { let n = 0, b = rd(); if (b === 0) { n = 0xff; while ((b = rd()) === 0) n += 0xff; } return n + b; };
  const litRun = (op1: number): number => (op1 === 0 ? 0x0f + longLen() + 3 : op1 + 3);
  const copyLit = (n: number): void => { if (op + n > outSize) throw new DwgError('Compressed data is too long.'); for (let i = 0; i < n; i++) out[op++] = rd(); };
  let b = rd();
  if ((b & 0xf0) === 0) { copyLit(litRun(b)); b = rd(); }
  for (;;) {
    if (b === 0x11) break;
    let comp = 0, off = 0, lit = 0;
    if (b >= 0x40) {
      comp = ((b & 0xf0) >> 4) - 1;
      const b2 = rd();
      off = (b2 << 2) | ((b & 0x0c) >> 2);
      lit = b & 3;
    } else if (b >= 0x21) {
      comp = b - 0x1e;
      const b2 = rd(), b3 = rd();
      off = (b3 << 6) | (b2 >> 2);
      lit = b2 & 3;
    } else if (b === 0x20) {
      comp = longLen() + 0x21;
      const b2 = rd(), b3 = rd();
      off = (b3 << 6) | (b2 >> 2);
      lit = b2 & 3;
    } else if (b >= 0x12) {
      comp = (b & 7) + 2;
      const hi = (b & 8) << 11;
      const b2 = rd(), b3 = rd();
      off = ((b3 << 6) | (b2 >> 2)) + hi + 0x3fff;
      lit = b2 & 3;
    } else if (b === 0x10) {
      comp = longLen() + 9;
      const b2 = rd(), b3 = rd();
      off = ((b3 << 6) | (b2 >> 2)) + 0x3fff;
      lit = b2 & 3;
    } else throw new DwgError('Unknown compression opcode.');
    const from = op - off - 1;
    if (from < 0 || op + comp > outSize) throw new DwgError('Bad compression back reference.');
    for (let i = 0; i < comp; i++) out[op + i] = out[from + i];
    op += comp;
    if (lit) copyLit(lit);
    b = rd();
    if ((b & 0xf0) === 0) { copyLit(litRun(b)); b = rd(); }
  }
  return out;
}
