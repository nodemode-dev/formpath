const scratch = new DataView(new ArrayBuffer(8));

// CRC-16 as the DWG file uses it: reflected polynomial 0xA001, byte at a time, seeded per structure (0xC0C1 for every structure written here).
const CRC_TABLE = (() => {
  const t = new Uint16Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xa001 : c >>> 1; t[i] = c; }
  return t;
})();

export function crc16(d: Uint8Array, seed = 0xc0c1): number {
  let c = seed;
  for (let i = 0; i < d.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ d[i]) & 255];
  return c & 0xffff;
}

// The writing counterpart of Bits: the same bit-coded values, most significant bit first, appended to a growing buffer.
export class BitsOut {
  pos = 0;
  private buf = new Uint8Array(256);

  private room(n: number): void {
    const need = (this.pos + n + 7) >> 3;
    if (need <= this.buf.length) return;
    let cap = this.buf.length;
    while (cap < need) cap *= 2;
    const nb = new Uint8Array(cap);
    nb.set(this.buf);
    this.buf = nb;
  }
  bit(v: number): void {
    this.room(1);
    if (v) this.buf[this.pos >> 3] |= 0x80 >> (this.pos & 7);
    this.pos++;
  }
  bits(v: number, n: number): void { for (let i = n - 1; i >= 0; i--) this.bit(Math.floor(v / 2 ** i) & 1); }
  rc(v: number): void {
    this.room(8);
    const s = this.pos & 7, i = this.pos >> 3, b = v & 255;
    if (s === 0) this.buf[i] = b;
    else { this.buf[i] |= b >> s; this.buf[i + 1] |= (b << (8 - s)) & 255; }
    this.pos += 8;
  }
  rs(v: number): void { this.rc(v & 255); this.rc((v >> 8) & 255); }
  rl(v: number): void { this.rs(v & 0xffff); this.rs(Math.floor(v / 65536) & 0xffff); }
  rd(v: number): void { scratch.setFloat64(0, v, true); for (let i = 0; i < 8; i++) this.rc(scratch.getUint8(i)); }
  bb(v: number): void { this.bit((v >> 1) & 1); this.bit(v & 1); }
  bs(v: number): void {
    v &= 0xffff;
    if (v === 0) this.bb(2);
    else if (v === 256) this.bb(3);
    else if (v < 256) { this.bb(1); this.rc(v); }
    else { this.bb(0); this.rs(v); }
  }
  bl(v: number): void {
    if (v === 0) this.bb(2);
    else if (v > 0 && v < 256) { this.bb(1); this.rc(v); }
    else { this.bb(0); this.rl(v >>> 0); }
  }
  bd(v: number): void {
    if (v === 0) this.bb(2);
    else if (v === 1) this.bb(1);
    else { this.bb(0); this.rd(v); }
  }
  // double with default: a value equal to the default costs two bits
  dd(v: number, def: number): void {
    if (v === def) { this.bb(0); return; }
    this.bb(3);
    this.rd(v);
  }
  bt(v: number): void { if (v === 0) this.bit(1); else { this.bit(0); this.bd(v); } }
  be(e: [number, number, number]): void { if (e[0] === 0 && e[1] === 0 && e[2] === 1) this.bit(1); else { this.bit(0); this.bd(e[0]); this.bd(e[1]); this.bd(e[2]); } }
  p3(p: ArrayLike<number>): void { this.bd(p[0]); this.bd(p[1]); this.bd(p[2] ?? 0); }
  r2(p: ArrayLike<number>): void { this.rd(p[0]); this.rd(p[1]); }
  b2(p: ArrayLike<number>): void { this.bd(p[0]); this.bd(p[1]); }
  // handle: 4-bit code, 4-bit byte count, then the value big endian
  h(code: number, v: number): void {
    const bytes: number[] = [];
    let x = v;
    while (x > 0) { bytes.unshift(x % 256); x = Math.floor(x / 256); }
    this.rc((code << 4) | bytes.length);
    for (const b of bytes) this.rc(b);
  }
  // text of R2000: bit short length counting the terminating zero, then the bytes in the code page
  tv(s: string): void {
    if (!s) { this.bs(0); return; }
    const b = encodeCp1252(s);
    this.bs(b.length + 1);
    for (const c of b) this.rc(c);
    this.rc(0);
  }
  raw(b: Uint8Array): void { for (const c of b) this.rc(c); }
  align(): void { const r = this.pos & 7; if (r) { this.room(8); this.pos += 8 - r; } }
  append(o: BitsOut): void {
    const full = o.pos >> 3, rest = o.pos & 7;
    for (let i = 0; i < full; i++) this.rc(o.buf[i]);
    for (let i = 0; i < rest; i++) this.bit((o.buf[full] >> (7 - i)) & 1);
  }
  bytes(): Uint8Array { return this.buf.slice(0, (this.pos + 7) >> 3); }
}

// unsigned modular char: seven bits per byte, low group first, high bit says more follow
export function mcU(v: number): number[] {
  const out: number[] = [];
  let a = v;
  while (a >= 128) { out.push((a % 128) | 128); a = Math.floor(a / 128); }
  out.push(a);
  return out;
}

// signed modular char: the last byte keeps six bits and the sign in bit 6
export function mcS(v: number): number[] {
  const neg = v < 0;
  let a = Math.abs(v);
  const out: number[] = [];
  while (a >= 64) { out.push((a % 128) | 128); a = Math.floor(a / 128); }
  out.push(a | (neg ? 64 : 0));
  return out;
}

// modular short for the object size: fifteen bits per little endian word, high bit says another word follows
export function msBytes(v: number): number[] {
  const out: number[] = [];
  let a = v;
  while (a >= 32768) { const w = (a % 32768) | 32768; out.push(w & 255, w >> 8); a = Math.floor(a / 32768); }
  out.push(a & 255, a >> 8);
  return out;
}

const CP1252_HI: Record<number, number> = { 0x20ac: 0x80, 0x201a: 0x82, 0x192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x2c6: 0x88, 0x2030: 0x89, 0x160: 0x8a, 0x2039: 0x8b, 0x152: 0x8c, 0x17d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2dc: 0x98, 0x2122: 0x99, 0x161: 0x9a, 0x203a: 0x9b, 0x153: 0x9c, 0x17e: 0x9e, 0x178: 0x9f };
export function encodeCp1252(s: string): number[] {
  const out: number[] = [];
  // what the code page cannot hold goes out as the \U+XXXX escape that CAD programs write and read back
  const esc = (u: number): void => { for (const ch of `\\U+${u.toString(16).toUpperCase().padStart(4, '0')}`) out.push(ch.charCodeAt(0)); };
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 256 && !(c >= 0x80 && c < 0xa0)) out.push(c);
    else if (CP1252_HI[c] !== undefined) out.push(CP1252_HI[c]);
    else esc(c);
  }
  return out;
}
