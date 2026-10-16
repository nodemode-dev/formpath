import { DwgError } from './dwg-bits';

// The AutoCAD 2007 (AC1021) file container. It is not the R2004 page layout: the file header, the page map and the
// section map are error-corrected blocks (255 bytes per codeword, the parity bytes are skipped) and every block is
// packed with a compression of its own. This file was written from byte-level study of sample drawings, with the
// stored sizes, the object CRCs and the object map as the checks; it follows no existing implementation.

export interface Container { header: Uint8Array; classes: Uint8Array; handles: Uint8Array; objects: Uint8Array }

const i64 = (d: Uint8Array, p: number): number => {
  const lo = (d[p] | (d[p + 1] << 8) | (d[p + 2] << 16) | (d[p + 3] << 24)) >>> 0;
  const hi = d[p + 4] | (d[p + 5] << 8) | (d[p + 6] << 16) | (d[p + 7] << 24);
  return hi * 4294967296 + lo;
};
const i32 = (d: Uint8Array, p: number): number => d[p] | (d[p + 1] << 8) | (d[p + 2] << 16) | (d[p + 3] << 24);

// A literal run of the compression is not copied in order. Runs are cut in groups of 32 bytes whose four 8-byte words
// come out in reverse order; the rest of the run (0 to 31 bytes) is cut in pieces of 8, 4 and 1 byte whose order is
// reversed. This table gives the piece sizes, in stream order, for each rest length.
const PIECES: number[][] = [
  [], [1], [1, 1], [1, 1, 1], [4], [4, 1], [1, 4, 1], [1, 4, 1, 1], [8], [8, 1], [1, 8, 1], [1, 8, 1, 1], [8, 4], [8, 4, 1], [1, 8, 4, 1], [1, 8, 4, 1, 1],
  [8, 8], [8, 1, 8], [1, 8, 8, 1], [8, 8, 1, 1, 1], [8, 8, 4], [8, 8, 4, 1], [8, 8, 4, 1, 1], [8, 8, 4, 1, 1, 1], [8, 8, 8], [8, 8, 1, 8], [8, 8, 1, 8, 1], [8, 8, 1, 8, 1, 1],
  [8, 8, 8, 4], [8, 8, 8, 4, 1], [8, 8, 8, 4, 1, 1], [1, 1, 8, 8, 8, 4, 1],
];

function lz2007(src: Uint8Array, start: number, length: number, outSize: number): Uint8Array {
  const out = new Uint8Array(outSize), stop = start + length;
  let ip = start, op = 0, lit = 0;
  const rd = (): number => { if (ip >= stop) throw new DwgError('Compressed data ends early.'); return src[ip++]; };
  const put = (n: number): void => {
    if (ip + n > stop || op + n > outSize) throw new DwgError('Compressed data is too long.');
    let s = ip, d = op;
    for (let g = n >> 5; g > 0; g--, s += 32) for (let q = 3; q >= 0; q--) for (let t = 0; t < 8; t++) out[d++] = src[s + q * 8 + t];
    const piece = PIECES[n & 31], at: number[] = [];
    let a = s;
    for (const k of piece) { at.push(a); a += k; }
    for (let k = piece.length - 1; k >= 0; k--) for (let t = 0; t < piece[k]; t++) out[d++] = src[at[k] + t];
    ip += n; op += n;
  };
  if ((src[ip] & 0xf0) === 0x20) { ip += 3; lit = rd() & 7; }
  for (;;) {
    if (lit) put(lit);
    if (ip >= stop) break;
    let o = rd(), prev = lit;
    if (lit === 0 && o < 0x10) {
      let n = (o & 15) + 8;
      if ((o & 15) === 15) {
        const e = rd();
        n += e;
        if (e === 255) for (;;) { const w = rd() | (rd() << 8); n += w; if (w !== 0xffff) break; }
      }
      put(n);
      if (ip >= stop) break;
      o = rd(); prev = -1;
    }
    const h = o >> 4;
    let len: number, off: number;
    if (h === 0 || (h === 15 && prev === 0)) {
      len = (o & 15) + 0x13;
      off = rd();
      const b = rd();
      off += ((b & 0x78) << 5) + 1; len += (b >> 3) & 0x10; lit = b & 7;
    } else if (h === 1) {
      len = (o & 15) + 3;
      off = rd();
      const b = rd();
      off += ((b & 0xf8) << 5) + 1; lit = b & 7;
    } else if (h === 2) {
      off = rd() | (rd() << 8);
      len = o & 7;
      if ((o & 8) === 0) { const b = rd(); len += b & 0xf8; lit = b & 7; }
      else { off++; len += rd() << 3; const b = rd(); len += ((b & 0xf8) << 8) + 0x100; lit = b & 7; }
    } else {
      len = h;
      const b = rd();
      off = ((b & 0xf8) << 1) + (o & 15) + 1; lit = b & 7;
    }
    if (off > op || op + len > outSize) throw new DwgError('Bad compression back reference.');
    for (let k = 0; k < len; k++, op++) out[op] = out[op - off];
  }
  if (op !== outSize) throw new DwgError('Compressed data is the wrong size.');
  return out;
}

// the data bytes of an interleaved block: codeword j holds every blocks-th byte from j, its first k bytes are data
function codewords(d: Uint8Array, at: number, blocks: number, k: number): Uint8Array {
  if (blocks < 1 || at < 0 || at + blocks * 255 > d.length) throw new DwgError('A block of this DWG drawing is cut short.');
  const out = new Uint8Array(blocks * k);
  for (let j = 0; j < blocks; j++) for (let i = 0; i < k; i++) out[j * k + i] = d[at + blocks * i + j];
  return out;
}

const pad8 = (n: number): number => (n + 7) & ~7;

function sysPage(d: Uint8Array, at: number, comp: number, factor: number, size: number): Uint8Array {
  if (comp < 1 || comp > d.length || size < 1 || size > 0x4000000 || factor < 1 || factor > 64) throw new DwgError('A system block of this DWG drawing is damaged.');
  const raw = codewords(d, at, Math.ceil((pad8(comp) * factor) / 239), 239).subarray(0, comp);
  return comp === size ? raw : lz2007(raw, 0, comp, size);
}

export function readContainer(d: Uint8Array): Container {
  const head = codewords(d, 0x80, 3, 239);
  const clen = i32(head, 24);
  const hq = clen > 0 ? lz2007(head, 32, clen, 0x110) : head.subarray(32, 32 - clen);
  const q = (i: number): number => i64(hq, i * 8);
  if (hq.length < 0xe0) throw new DwgError('The file header of this DWG drawing is damaged.');
  const pm = sysPage(d, 0x480, q(10), q(3), q(11));
  const pages = new Map<number, { at: number; size: number }>();
  for (let p = 0, at = 0x480; p + 16 <= pm.length; p += 16) {
    const size = i64(pm, p), id = i64(pm, p + 8);
    if (id >= 0) pages.set(id, { at, size });
    at += size;
  }
  const sp = pages.get(q(24));
  if (!sp) throw new DwgError('The section map of this DWG drawing is missing.');
  const sm = sysPage(d, sp.at, q(22), q(27), q(25));
  const secs = new Map<string, { enc: number; pages: Array<{ at: number; id: number; unc: number; comp: number }> }>();
  for (let p = 0; p + 64 <= sm.length;) {
    const enc = i64(sm, p + 48), np = i64(sm, p + 56), nl = i64(sm, p + 32);
    p += 64;
    let name = '';
    for (let i = 0; i + 1 < nl && p + i + 1 < sm.length; i += 2) { const c = sm[p + i] | (sm[p + i + 1] << 8); if (!c) break; name += String.fromCharCode(c); }
    p += nl;
    const ps: Array<{ at: number; id: number; unc: number; comp: number }> = [];
    for (let k = 0; k < np && p + 56 <= sm.length; k++, p += 56) ps.push({ at: i64(sm, p), id: i64(sm, p + 16), unc: i64(sm, p + 24), comp: i64(sm, p + 32) });
    if (name) secs.set(name, { enc, pages: ps });
  }
  const load = (name: string): Uint8Array => {
    const s = secs.get(name);
    if (!s) throw new DwgError(`The ${name} section of this DWG drawing is missing.`);
    let total = 0;
    for (const pg of s.pages) total = Math.max(total, pg.at + pg.unc);
    if (total > 0x10000000) throw new DwgError('A section of this DWG drawing is too large.');
    const out = new Uint8Array(total);
    for (const pg of s.pages) {
      const ref = pages.get(pg.id);
      if (!ref) throw new DwgError('A page of this DWG drawing is missing.');
      if (s.enc !== 4) { out.set(d.subarray(ref.at, ref.at + pg.unc), pg.at); continue; }
      const raw = codewords(d, ref.at, Math.ceil(pad8(pg.comp) / 251), 251).subarray(0, pg.comp);
      out.set(pg.comp === pg.unc ? raw : lz2007(raw, 0, pg.comp, pg.unc), pg.at);
    }
    return out;
  };
  return { header: load('AcDb:Header').subarray(16), classes: load('AcDb:Classes').subarray(16), handles: load('AcDb:Handles'), objects: load('AcDb:AcDbObjects') };
}
