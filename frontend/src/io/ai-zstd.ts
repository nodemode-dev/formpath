interface Fse { al: number; sym: Uint8Array; nb: Uint8Array; base: Uint16Array }
interface Huff { bits: number; sym: Uint8Array; nb: Uint8Array }

const LL_BASE = [...Array(16).keys(), 16, 18, 20, 22, 24, 28, 32, 40, 48, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];
const LL_BITS = [...Array(16).fill(0), 1, 1, 1, 1, 2, 2, 3, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const ML_BASE = [...Array.from({ length: 32 }, (_, i) => i + 3), 35, 37, 39, 41, 43, 47, 51, 59, 67, 83, 99, 131, 259, 515, 1027, 2051, 4099, 8195, 16387, 32771, 65539];
const ML_BITS = [...Array(32).fill(0), 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const LL_DEF = [4, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 1, 1, 1, 1, 1, -1, -1, -1, -1];
const ML_DEF = [1, 4, 3, 2, 2, 2, 2, 2, 2, ...Array(37).fill(1), ...Array(7).fill(-1)];
const OF_DEF = [1, 1, 1, 1, 1, 1, 2, 2, 2, ...Array(15).fill(1), -1, -1, -1, -1, -1];

const hiBit = (v: number): number => 31 - Math.clz32(v);

class Back {
  pos: number;
  constructor(readonly b: Uint8Array, readonly start: number, end: number) {
    const last = b[end - 1];
    if (end <= start || !last) throw new Error('corrupt ZStandard stream');
    this.pos = (end - 1 - start) * 8 + hiBit(last);
  }
  read(n: number): number {
    let v = 0, need = n;
    while (need > 0) {
      const i = this.pos - 1;
      if (i < 0) { v *= 2 ** need; this.pos -= need; return v; }
      const byte = this.b[this.start + (i >> 3)], top = i & 7, k = Math.min(need, top + 1);
      v = v * 2 ** k + ((byte >> (top - k + 1)) & ((1 << k) - 1));
      this.pos -= k;
      need -= k;
    }
    return v;
  }
  peek(n: number): number {
    if (this.pos >= n) { const p = this.pos; const v = this.read(n); this.pos = p; return v; }
    const p = this.pos, have = Math.max(0, p), v = have > 0 ? this.read(have) : 0;
    this.pos = p;
    return v * 2 ** (n - have);
  }
}

function buildFse(counts: number[], al: number): Fse {
  const size = 1 << al, sym = new Uint8Array(size), nb = new Uint8Array(size), base = new Uint16Array(size), next = new Int32Array(counts.length);
  let high = size - 1;
  for (let s = 0; s < counts.length; s++) if (counts[s] === -1) { sym[high--] = s; next[s] = 1; }
  const step = (size >> 1) + (size >> 3) + 3, mask = size - 1;
  let pos = 0;
  for (let s = 0; s < counts.length; s++) {
    if (counts[s] <= 0) continue;
    next[s] = counts[s];
    for (let i = 0; i < counts[s]; i++) {
      sym[pos] = s;
      do { pos = (pos + step) & mask; } while (pos > high);
    }
  }
  for (let i = 0; i < size; i++) {
    const s = sym[i], n = next[s]++, bits = al - hiBit(n);
    nb[i] = bits;
    base[i] = (n << bits) - size;
  }
  return { al, sym, nb, base };
}

class Fwd {
  pos = 0;
  constructor(readonly b: Uint8Array, readonly start: number, readonly end: number) {}
  read(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const at = this.start + ((this.pos + i) >> 3);
      const bit = at < this.end ? (this.b[at] >> ((this.pos + i) & 7)) & 1 : 0;
      v += bit * 2 ** i;
    }
    this.pos += n;
    return v;
  }
  bytes(): number { return Math.ceil(this.pos / 8); }
}

function readFseTable(b: Uint8Array, start: number, end: number, maxAl: number, maxSym: number): { t: Fse; used: number } {
  const r = new Fwd(b, start, end), al = r.read(4) + 5;
  if (al > maxAl) throw new Error('corrupt ZStandard table');
  const counts: number[] = [];
  let remaining = (1 << al) + 1, threshold = 1 << al, nbBits = al + 1;
  while (remaining > 1 && counts.length <= maxSym) {
    const max = 2 * threshold - 1 - remaining;
    let v = r.read(nbBits - 1);
    if (v >= max) { v += r.read(1) * (1 << (nbBits - 1)); if (v >= threshold) v -= max; }
    const prob = v - 1;
    remaining -= prob < 0 ? 1 : prob;
    counts.push(prob);
    if (prob === 0) {
      for (;;) { const rep = r.read(2); for (let i = 0; i < rep; i++) counts.push(0); if (rep !== 3) break; }
    }
    while (remaining < threshold) { nbBits--; threshold >>= 1; }
  }
  if (remaining !== 1) throw new Error('corrupt ZStandard table');
  return { t: buildFse(counts, al), used: r.bytes() };
}

function huffFromWeights(w: number[]): Huff {
  let total = 0;
  for (const x of w) if (x > 0) total += 2 ** (x - 1);
  if (!total) throw new Error('corrupt ZStandard literals');
  const maxBits = hiBit(total) + 1, left = 2 ** maxBits - total;
  if (left & (left - 1) || left === 0) throw new Error('corrupt ZStandard literals');
  w.push(hiBit(left) + 1);
  const size = 1 << maxBits, sym = new Uint8Array(size), nb = new Uint8Array(size);
  let at = 0;
  for (let wt = 1; wt <= maxBits; wt++) {
    for (let s = 0; s < w.length; s++) {
      if (w[s] !== wt) continue;
      const run = 1 << (wt - 1);
      for (let i = 0; i < run; i++) { sym[at + i] = s; nb[at + i] = maxBits + 1 - wt; }
      at += run;
    }
  }
  return { bits: maxBits, sym, nb };
}

function readHuffTree(b: Uint8Array, p: number, end: number): { h: Huff; used: number } {
  const hb = b[p];
  const weights: number[] = [];
  if (hb >= 128) {
    const n = hb - 127, bytes = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) { const v = b[p + 1 + (i >> 1)]; weights.push(i & 1 ? v & 15 : v >> 4); }
    return { h: huffFromWeights(weights), used: 1 + bytes };
  }
  const { t, used } = readFseTable(b, p + 1, p + 1 + hb, 6, 255);
  const bs = new Back(b, p + 1 + used, p + 1 + hb);
  let s1 = bs.read(t.al), s2 = bs.read(t.al);
  for (;;) {
    weights.push(t.sym[s1]);
    s1 = t.base[s1] + bs.read(t.nb[s1]);
    if (bs.pos < 0) { weights.push(t.sym[s2]); break; }
    weights.push(t.sym[s2]);
    s2 = t.base[s2] + bs.read(t.nb[s2]);
    if (bs.pos < 0) { weights.push(t.sym[s1]); break; }
    if (weights.length > 255) throw new Error('corrupt ZStandard literals');
  }
  void end;
  return { h: huffFromWeights(weights), used: 1 + hb };
}

function huffStream(b: Uint8Array, start: number, end: number, h: Huff, out: Uint8Array, at: number, count: number): void {
  const bs = new Back(b, start, end);
  for (let i = 0; i < count; i++) {
    const idx = bs.peek(h.bits);
    out[at + i] = h.sym[idx];
    bs.pos -= h.nb[idx];
  }
  if (bs.pos < 0) throw new Error('corrupt ZStandard literals');
}

class Out {
  buf: Uint8Array;
  n = 0;
  constructor(cap: number) { this.buf = new Uint8Array(Math.max(1024, cap)); }
  need(extra: number): void {
    if (this.n + extra <= this.buf.length) return;
    const nb = new Uint8Array(Math.max(this.buf.length * 2, this.n + extra));
    nb.set(this.buf.subarray(0, this.n));
    this.buf = nb;
  }
}

interface State { h: Huff | null; ll: Fse | null; of: Fse | null; ml: Fse | null; rep: [number, number, number] }

function literals(b: Uint8Array, p: number, st: State): { lit: Uint8Array; used: number } {
  const b0 = b[p], type = b0 & 3, fmt = (b0 >> 2) & 3;
  if (type < 2) {
    let size: number, hdr: number;
    if (fmt === 0 || fmt === 2) { size = b0 >> 3; hdr = 1; }
    else if (fmt === 1) { size = (b0 >> 4) + (b[p + 1] << 4); hdr = 2; }
    else { size = (b0 >> 4) + (b[p + 1] << 4) + (b[p + 2] << 12); hdr = 3; }
    if (type === 0) return { lit: b.subarray(p + hdr, p + hdr + size), used: hdr + size };
    return { lit: new Uint8Array(size).fill(b[p + hdr]), used: hdr + 1 };
  }
  let hdr: number, bits: number, streams: number;
  if (fmt === 0) { hdr = 3; bits = 10; streams = 1; } else if (fmt === 1) { hdr = 3; bits = 10; streams = 4; } else if (fmt === 2) { hdr = 4; bits = 14; streams = 4; } else { hdr = 5; bits = 18; streams = 4; }
  let v = 0;
  for (let i = 0; i < hdr; i++) v += b[p + i] * 2 ** (8 * i);
  const regen = Math.floor(v / 16) % 2 ** bits, comp = Math.floor(v / 2 ** (4 + bits)) % 2 ** bits;
  let q = p + hdr;
  const end = q + comp;
  if (type === 2) { const r = readHuffTree(b, q, end); st.h = r.h; q += r.used; }
  if (!st.h) throw new Error('corrupt ZStandard literals');
  const out = new Uint8Array(regen);
  if (streams === 1) huffStream(b, q, end, st.h, out, 0, regen);
  else {
    const s1 = b[q] + (b[q + 1] << 8), s2 = b[q + 2] + (b[q + 3] << 8), s3 = b[q + 4] + (b[q + 5] << 8), seg = Math.ceil(regen / 4);
    const a = q + 6, c = a + s1, d = c + s2, e = d + s3;
    huffStream(b, a, c, st.h, out, 0, seg);
    huffStream(b, c, d, st.h, out, seg, seg);
    huffStream(b, d, e, st.h, out, seg * 2, seg);
    huffStream(b, e, end, st.h, out, seg * 3, regen - seg * 3);
  }
  return { lit: out, used: hdr + comp };
}

function table(mode: number, b: Uint8Array, p: number, end: number, maxAl: number, maxSym: number, def: number[], defAl: number, prev: Fse | null): { t: Fse; used: number } {
  if (mode === 0) return { t: buildFse(def, defAl), used: 0 };
  if (mode === 1) {
    const sym = new Uint8Array(1).fill(b[p]);
    return { t: { al: 0, sym, nb: new Uint8Array(1), base: new Uint16Array(1) }, used: 1 };
  }
  if (mode === 3) { if (!prev) throw new Error('corrupt ZStandard sequences'); return { t: prev, used: 0 }; }
  return readFseTable(b, p, end, maxAl, maxSym);
}

function block(b: Uint8Array, p: number, end: number, st: State, o: Out): void {
  const l = literals(b, p, st);
  let q = p + l.used;
  const lit = l.lit;
  let nseq = b[q++];
  if (nseq === 0) { o.need(lit.length); o.buf.set(lit, o.n); o.n += lit.length; return; }
  if (nseq === 255) { nseq = b[q] + (b[q + 1] << 8) + 0x7f00; q += 2; } else if (nseq >= 128) { nseq = ((nseq - 128) << 8) + b[q++]; }
  const modes = b[q++];
  const ll = table(modes >> 6, b, q, end, 9, 35, LL_DEF, 6, st.ll); q += ll.used;
  const of = table((modes >> 4) & 3, b, q, end, 8, 31, OF_DEF, 5, st.of); q += of.used;
  const ml = table((modes >> 2) & 3, b, q, end, 9, 52, ML_DEF, 6, st.ml); q += ml.used;
  st.ll = ll.t; st.of = of.t; st.ml = ml.t;
  const bs = new Back(b, q, end);
  let sL = bs.read(ll.t.al), sO = bs.read(of.t.al), sM = bs.read(ml.t.al), lp = 0;
  let [r1, r2, r3] = st.rep;
  for (let i = 0; i < nseq; i++) {
    const oc = of.t.sym[sO], mc = ml.t.sym[sM], lc = ll.t.sym[sL];
    const ofv = 2 ** oc + bs.read(oc), mlen = ML_BASE[mc] + bs.read(ML_BITS[mc]), llen = LL_BASE[lc] + bs.read(LL_BITS[lc]);
    let off: number;
    if (ofv > 3) { off = ofv - 3; r3 = r2; r2 = r1; r1 = off; }
    else {
      const k = llen === 0 ? ofv + 1 : ofv;
      if (k === 1) off = r1;
      else if (k === 2) { off = r2; r2 = r1; r1 = off; }
      else if (k === 3) { off = r3; r3 = r2; r2 = r1; r1 = off; }
      else { off = r1 - 1; r3 = r2; r2 = r1; r1 = off; }
    }
    if (i < nseq - 1) {
      sL = ll.t.base[sL] + bs.read(ll.t.nb[sL]);
      sM = ml.t.base[sM] + bs.read(ml.t.nb[sM]);
      sO = of.t.base[sO] + bs.read(of.t.nb[sO]);
    }
    if (lp + llen > lit.length || off <= 0 || off > o.n + llen) throw new Error('corrupt ZStandard sequences');
    o.need(llen + mlen);
    o.buf.set(lit.subarray(lp, lp + llen), o.n);
    o.n += llen; lp += llen;
    for (let k = 0, s = o.n - off; k < mlen; k++) o.buf[o.n + k] = o.buf[s + k];
    o.n += mlen;
  }
  st.rep = [r1, r2, r3];
  if (bs.pos < 0) throw new Error('corrupt ZStandard sequences');
  const rest = lit.length - lp;
  o.need(rest);
  o.buf.set(lit.subarray(lp), o.n);
  o.n += rest;
}

export function zstdDecompress(b: Uint8Array): Uint8Array {
  let p = 0;
  const o = new Out(b.length * 4);
  while (p + 4 <= b.length) {
    const magic = b[p] + (b[p + 1] << 8) + (b[p + 2] << 16) + b[p + 3] * 2 ** 24;
    if (magic >= 0x184d2a50 && magic <= 0x184d2a5f) { p += 8 + (b[p + 4] + (b[p + 5] << 8) + (b[p + 6] << 16) + b[p + 7] * 2 ** 24); continue; }
    if (magic !== 0xfd2fb528) break;
    p += 4;
    const fd = b[p++], single = (fd >> 5) & 1, fcsFlag = fd >> 6, dict = fd & 3, sum = (fd >> 2) & 1;
    if (!single) p++;
    if (dict) throw new Error('dictionary frames are not supported');
    const fcsBytes = fcsFlag === 0 ? (single ? 1 : 0) : 2 ** fcsFlag;
    let fcs = 0;
    for (let i = 0; i < fcsBytes; i++) fcs += b[p + i] * 2 ** (8 * i);
    if (fcsFlag === 1) fcs += 256;
    p += fcsBytes;
    if (fcs > 0 && fcs < 2 ** 30) o.need(fcs);
    const st: State = { h: null, ll: null, of: null, ml: null, rep: [1, 4, 8] };
    for (;;) {
      const h = b[p] + (b[p + 1] << 8) + (b[p + 2] << 16);
      p += 3;
      const last = h & 1, type = (h >> 1) & 3, size = h >> 3;
      if (type === 0) { o.need(size); o.buf.set(b.subarray(p, p + size), o.n); o.n += size; p += size; }
      else if (type === 1) { o.need(size); o.buf.fill(b[p], o.n, o.n + size); o.n += size; p += 1; }
      else if (type === 2) { block(b, p, p + size, st, o); p += size; }
      else throw new Error('corrupt ZStandard block');
      if (last) break;
      if (p >= b.length) throw new Error('truncated ZStandard data');
    }
    if (sum) p += 4;
  }
  if (!o.n) throw new Error('empty ZStandard data');
  return o.buf.slice(0, o.n);
}
