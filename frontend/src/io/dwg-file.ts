import { Bits, DwgError, DwgUnsupportedError, headerMask, lz77 } from './dwg-bits';

const TAGS: Record<string, number> = { AC1015: 15, AC1018: 18, AC1021: 21, AC1024: 24, AC1027: 27, AC1032: 32 };
const TAG_NAMES: Record<string, string> = { AC1012: 'R13', AC1014: 'R14', AC1015: 'R2000', AC1018: 'R2004', AC1021: 'R2007', AC1024: 'R2010', AC1027: 'R2013', AC1032: 'R2018' };

// header and classes start at their RL size field; objects is the buffer the object map offsets point into
export interface Sections { ver: number; tag: string; header: Uint8Array; classes: Uint8Array; handles: Uint8Array; objects: Uint8Array; maint: number }
export interface ClassInfo { num: number; dxf: string; cpp: string; entity: boolean }

const u32 = (d: Uint8Array, p: number): number => (d[p] | (d[p + 1] << 8) | (d[p + 2] << 16) | (d[p + 3] << 24)) >>> 0;
const i32 = (d: Uint8Array, p: number): number => d[p] | (d[p + 1] << 8) | (d[p + 2] << 16) | (d[p + 3] << 24);
const u64 = (d: Uint8Array, p: number): number => u32(d, p) + u32(d, p + 4) * 4294967296;

export function versionOf(d: Uint8Array): { tag: string; ver: number } {
  if (d.length < 0x80) throw new DwgError('This file is too short to be a DWG drawing.');
  let tag = '';
  for (let i = 0; i < 6; i++) tag += String.fromCharCode(d[i]);
  if (!/^AC10\d\d$/.test(tag)) throw new DwgError('This file is not a DWG drawing (it does not start with an AutoCAD version tag).');
  const ver = TAGS[tag];
  if (!ver) throw new DwgUnsupportedError(`DWG ${TAG_NAMES[tag] ?? tag} is not read natively.`);
  return { tag, ver };
}

function r2000(d: Uint8Array, tag: string): Sections {
  const n = u32(d, 0x15);
  if (n < 3 || n > 16) throw new DwgError('The section table of this DWG drawing is damaged.');
  const loc: Array<{ at: number; size: number }> = [];
  for (let i = 0; i < n; i++) { const p = 0x19 + i * 9; loc[d[p]] = { at: u32(d, p + 1), size: u32(d, p + 5) }; }
  const sect = (i: number): Uint8Array => {
    const l = loc[i];
    if (!l || l.at + l.size > d.length) throw new DwgError('A section of this DWG drawing is outside the file.');
    return d.subarray(l.at, l.at + l.size);
  };
  return { ver: 15, tag, header: sect(0).subarray(16), classes: sect(1).subarray(16), handles: sect(2), objects: d, maint: d[0x0b] };
}

interface PageRef { addr: number; size: number }
interface SecDesc { name: string; size: number; pages: Array<{ no: number; size: number; start: number }>; comp: number; maxd: number }

function sysPage(d: Uint8Array, at: number): Uint8Array {
  if (at + 20 > d.length) throw new DwgError('A system page is outside the file.');
  const dec = u32(d, at + 4), comp = u32(d, at + 8), ct = u32(d, at + 12);
  if (at + 20 + comp > d.length) throw new DwgError('A system page is cut short.');
  return ct === 2 ? lz77(d, at + 20, comp, dec) : d.slice(at + 20, at + 20 + dec);
}

function r2004(d: Uint8Array, tag: string, ver: number): Sections {
  const mask = headerMask(0x6c), h = new Uint8Array(0x6c);
  for (let i = 0; i < 0x6c; i++) h[i] = d[0x80 + i] ^ mask[i];
  let id = '';
  for (let i = 0; i < 11; i++) id += String.fromCharCode(h[i]);
  if (id !== 'AcFssFcAJMB') throw new DwgError('The file header of this DWG drawing is damaged.');
  const pm = sysPage(d, u64(h, 0x54) + 0x100), secMapId = u32(h, 0x5c), pages = new Map<number, PageRef>();
  let addr = 0x100;
  for (let p = 0; p + 8 <= pm.length;) {
    const no = i32(pm, p), size = u32(pm, p + 4);
    p += 8;
    if (no >= 0) pages.set(no, { addr, size });
    else p += 16;
    addr += size;
  }
  const sm = pages.get(secMapId);
  if (!sm) throw new DwgError('The section map of this DWG drawing is missing.');
  const si = sysPage(d, sm.addr), count = u32(si, 0), descs = new Map<string, SecDesc>();
  let p = 20;
  for (let k = 0; k < count && p + 96 <= si.length; k++) {
    const p0 = p, size = u64(si, p), np = u32(si, p + 8), comp = u32(si, p + 20);
    let name = '';
    for (let i = 0; i < 64 && si[p + 32 + i]; i++) name += String.fromCharCode(si[p + 32 + i]);
    p += 96;
    const ps: SecDesc['pages'] = [];
    for (let q = 0; q < np; q++, p += 16) ps.push({ no: u32(si, p), size: u32(si, p + 4), start: u64(si, p + 8) });
    descs.set(name, { name, size, pages: ps, comp, maxd: u32(si, p0 + 12) });
  }
  const load = (name: string): Uint8Array => {
    const s = descs.get(name);
    if (!s) throw new DwgError(`The ${name} section of this DWG drawing is missing.`);
    const out = new Uint8Array(s.size);
    for (const pg of s.pages) {
      const ref = pages.get(pg.no);
      if (!ref) throw new DwgError('A page of this DWG drawing is missing.');
      const m = (0x4164536b ^ ref.addr) >>> 0, w = (i: number): number => (u32(d, ref.addr + i * 4) ^ m) >>> 0;
      if (w(0) !== 0x4163043b) throw new DwgError('A data page of this DWG drawing is damaged.');
      const csize = w(2), start = w(4), at = ref.addr + 32;
      if (at + csize > d.length) throw new DwgError('A data page of this DWG drawing is cut short.');
      const dec = s.comp === 2 ? lz77(d, at, csize, s.maxd) : d.subarray(at, at + Math.min(csize, s.maxd));
      out.set(dec.subarray(0, Math.max(0, Math.min(dec.length, out.length - start))), start);
    }
    return out;
  };
  return { ver, tag, header: load('AcDb:Header').subarray(16), classes: load('AcDb:Classes').subarray(16), handles: load('AcDb:Handles'), objects: load('AcDb:AcDbObjects'), maint: d[0x0b] };
}

export function readSections(d: Uint8Array): Sections {
  const { tag, ver } = versionOf(d);
  if (ver === 15) return r2000(d, tag);
  if (ver === 21) throw new DwgUnsupportedError('DWG R2007 is not read natively.');
  return r2004(d, tag, ver);
}

export function objectMap(handles: Uint8Array): Map<number, number> {
  const map = new Map<number, number>();
  let p = 0, h = 0, loc = 0;
  while (p + 2 <= handles.length) {
    const size = (handles[p] << 8) | handles[p + 1];
    if (size <= 2) break;
    const b = new Bits(handles, Math.min(handles.length, p + size) * 8, (p + 2) * 8);
    h = 0; loc = 0;
    while (b.pos < (p + size) * 8 - 7) { h += b.mcU(); loc += b.mc(); map.set(h, loc); }
    p += size + 2;
  }
  return map;
}

// The R2007 and later "string stream" lives at the end of a data region, just before the handle stream.
export function stringStream(d: Uint8Array, hs: number, floor: number): Bits | null {
  let p = hs - 1;
  const at = (q: number): number => (d[q >> 3] >> (7 - (q & 7))) & 1;
  if (p < floor || !at(p)) return null;
  const rs = (q: number): number => { const b = new Bits(d, d.length * 8, q); return b.rs(); };
  p -= 16;
  let len = rs(p);
  if (len & 0x8000) { p -= 16; len = (len & 0x7fff) | (rs(p) << 15); }
  if (len > p - floor) return null;
  return new Bits(d, p, p - len);
}

export function readClasses(s: Sections): Map<number, ClassInfo> {
  const out = new Map<number, ClassInfo>();
  const d = s.classes, ver = s.ver;
  if (d.length < 8) return out;
  const b = new Bits(d, d.length * 8, 0);
  const size = b.rl();
  if (ver >= 24) b.rl();
  let end = (4 + size) * 8, str: Bits | null = null, limit = end;
  if (ver >= 21) {
    const from = b.pos, bits = b.rl();
    end = from + bits;
    str = stringStream(d, end, b.pos);
    limit = str ? str.pos : end;
  }
  if (ver >= 18) { b.bs(); b.rc(); b.rc(); b.bit(); }
  const t = (): string => (ver >= 21 ? (str ? str.tuStr() : '') : b.tvCp());
  try {
    while (b.pos + 16 < limit) {
      const num = b.bs();
      b.bs();
      t(); const cpp = t(), dxf = t();
      b.bit();
      const item = b.bs();
      if (ver >= 18) { b.bl(); b.bs(); b.bs(); b.bl(); b.bl(); }
      out.set(num, { num, dxf, cpp, entity: item === 0x1f2 });
    }
  } catch { /* the classes read so far are kept */ }
  return out;
}
