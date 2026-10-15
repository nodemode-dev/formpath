import { Bits, DwgError, DwgUnsupportedError } from './dwg-bits';
import { objectMap, readClasses, readSections, stringStream, type ClassInfo, type Sections } from './dwg-file';
import { readHeader } from './dwg-header';
import type { DxfFile } from './dxf';

export { DwgError, DwgUnsupportedError };
export { versionOf } from './dwg-file';

type Pair = [number, string];
interface Ent { type: string; c: Pair[] }
export interface DwgLinetype { name: string; description: string; pattern: number[] }
export type DwgFile = DxfFile & { linetypes: Map<string, DwgLinetype>; lineScale: number; extents: [number, number, number, number] | null; native: { version: string; objects: number; unreadable: number; failures: string[] } };

const KIND: Record<number, string> = {
  1: 'TEXT', 2: 'ATTRIB', 3: 'ATTDEF', 4: 'BLOCK', 5: 'ENDBLK', 6: 'SEQEND', 7: 'INSERT', 8: 'MINSERT', 10: 'VERTEX_2D', 11: 'VERTEX_3D', 12: 'VERTEX_MESH', 13: 'VERTEX_PFACE', 14: 'VERTEX_PFACE_FACE',
  15: 'POLYLINE_2D', 16: 'POLYLINE_3D', 17: 'ARC', 18: 'CIRCLE', 19: 'LINE', 20: 'DIMENSION', 21: 'DIMENSION', 22: 'DIMENSION', 23: 'DIMENSION', 24: 'DIMENSION', 25: 'DIMENSION', 26: 'DIMENSION',
  27: 'POINT', 28: '3DFACE', 29: 'POLYLINE_PFACE', 30: 'POLYLINE_MESH', 31: 'SOLID', 32: 'TRACE', 33: 'SHAPE', 34: 'VIEWPORT', 35: 'ELLIPSE', 36: 'SPLINE', 37: 'REGION', 38: '3DSOLID', 39: 'BODY', 40: 'RAY', 41: 'XLINE',
  43: 'OLEFRAME', 44: 'MTEXT', 45: 'LEADER', 46: 'TOLERANCE', 47: 'MLINE', 49: 'BLOCK_HEADER', 51: 'LAYER', 53: 'STYLE', 57: 'LTYPE', 74: 'OLE2FRAME', 77: 'LWPOLYLINE', 78: 'HATCH',
};
const ENTITY = new Set(['TEXT', 'ATTRIB', 'ATTDEF', 'BLOCK', 'ENDBLK', 'SEQEND', 'INSERT', 'MINSERT', 'VERTEX_2D', 'VERTEX_3D', 'VERTEX_MESH', 'VERTEX_PFACE', 'VERTEX_PFACE_FACE', 'POLYLINE_2D', 'POLYLINE_3D', 'ARC', 'CIRCLE', 'LINE', 'DIMENSION', 'POINT', '3DFACE', 'POLYLINE_PFACE', 'POLYLINE_MESH', 'SOLID', 'TRACE', 'SHAPE', 'VIEWPORT', 'ELLIPSE', 'SPLINE', 'REGION', '3DSOLID', 'BODY', 'RAY', 'XLINE', 'OLEFRAME', 'MTEXT', 'LEADER', 'TOLERANCE', 'MLINE', 'OLE2FRAME', 'LWPOLYLINE', 'HATCH']);
const CHILD = new Set(['VERTEX_2D', 'VERTEX_3D', 'VERTEX_MESH', 'VERTEX_PFACE', 'VERTEX_PFACE_FACE', 'ATTRIB', 'SEQEND']);
const LW = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];
const lwOf = (i: number): number => (i < LW.length ? LW[i] : i === 29 ? -1 : i === 30 ? -2 : -3);
const num = (v: number): string => String(v);
const deg = (r: number): number => (r * 180) / Math.PI;

class Rd {
  constructor(readonly b: Bits, readonly s: Bits | null, readonly h: Bits, readonly ver: number) {}
  t(): string { return this.ver >= 21 ? (this.s ? this.s.tuStr() : '') : this.b.tvCp(); }
}

interface Common {
  handle: number; mode: number; nreact: number; xdicMissing: number; nolinks: number; color: number; rgb: number | null; lt: number; ps: number; mat: number; lw: number; invis: number;
  owner: number; layer: number; hasEnt: boolean;
}

interface Rec { handle: number; kind: string; type: number; owner: number; mode: number; layer: number; c: Pair[]; style?: number; block?: number; name?: string; paper?: number; extra?: Rec[] }

function ot(b: Bits): number { const c = b.bb(); return c === 0 ? b.rc() : c === 1 ? b.rc() + 0x1f0 : b.rs(); }

function skipEed(b: Bits): void {
  for (;;) { const n = b.bs(); if (n === 0) return; b.h(); b.skipBytes(n); }
}

function methodColor(ci: number, v: number): { ci: number; rgb: number | null } {
  const m = (v >>> 24) & 255;
  if (m === 0xc2) return { ci, rgb: v & 0xffffff };
  if (m === 0xc3) return { ci: v & 0xff, rgb: null };
  if (m === 0xc1) return { ci: 0, rgb: null };
  if (m === 0xc0) return { ci: 256, rgb: null };
  return { ci, rgb: null };
}

function readColor(r: Rd): { ci: number; rgb: number | null } {
  const b = r.b;
  if (r.ver < 18) return { ci: b.bs(), rgb: null };
  const f = b.bs();
  let out = { ci: f & 0x1ff, rgb: null as number | null };
  if (f & 0x8000) out = methodColor(out.ci, b.bl());
  if (f & 0x2000) b.bl();
  return out;
}

function readCmc(r: Rd): { ci: number; rgb: number | null } {
  const b = r.b, ci = b.bs();
  if (r.ver < 18) return { ci, rgb: null };
  const v = b.bl(), fl = b.rc();
  if (fl & 1) r.t();
  if (fl & 2) r.t();
  const o = methodColor(ci, v);
  return { ci: ci < 0 ? -Math.abs(o.ci || ci) : o.ci || ci, rgb: o.rgb };
}

function common(r: Rd, handleOf: number, entity: boolean): Common {
  const b = r.b, ver = r.ver;
  const c: Common = { handle: handleOf, mode: 0, nreact: 0, xdicMissing: 0, nolinks: 1, color: 256, rgb: null, lt: 0, ps: 0, mat: 0, lw: 29, invis: 0, owner: 0, layer: 0, hasEnt: entity };
  if (b.h() !== handleOf) throw new DwgError('The object handle does not match the object map.');
  skipEed(b);
  if (!entity) {
    c.nreact = b.bl();
    if (ver >= 18) c.xdicMissing = b.bit();
    if (ver >= 27) b.bit();
    return c;
  }
  if (b.bit()) { const n = ver >= 24 ? b.bll() : b.rl(); b.skipBytes(n); }
  c.mode = b.bb();
  c.nreact = b.bl();
  if (ver >= 18) c.xdicMissing = b.bit();
  if (ver >= 27) b.bit();
  if (ver === 15) c.nolinks = b.bit();
  const col = readColor(r);
  c.color = col.ci; c.rgb = col.rgb;
  b.bd();
  c.lt = b.bb(); c.ps = b.bb();
  if (ver >= 21) { c.mat = b.bb(); b.rc(); }
  if (ver >= 24) { b.bit(); b.bit(); b.bit(); }
  c.invis = b.bs();
  c.lw = b.rc();
  return c;
}

function commonHandles(r: Rd, c: Common): void {
  const h = r.h, own = c.handle;
  if (c.hasEnt && c.mode === 0) c.owner = h.h(own);
  else if (!c.hasEnt) c.owner = h.h(own);
  if (c.hasEnt && r.ver === 15 && c.nolinks === 0) { h.h(own); h.h(own); }
  for (let i = 0; i < c.nreact; i++) h.h(own);
  if (r.ver === 15 || !c.xdicMissing) h.h(own);
  if (!c.hasEnt) return;
  c.layer = h.h(own);
  if (c.lt === 3) h.h(own);
  if (r.ver >= 21 && c.mat === 3) h.h(own);
  if (c.ps === 3) h.h(own);
}

export function parseDwg(data: ArrayBuffer | Uint8Array): DwgFile {
  const d = data instanceof Uint8Array ? data : new Uint8Array(data);
  const sec = readSections(d);
  const classes = readClasses(sec);
  const omap = objectMap(sec.handles);
  return build(sec, classes, omap);
}

function kindOf(type: number, classes: Map<number, ClassInfo>): { kind: string; entity: boolean } {
  if (type >= 500) { const c = classes.get(type); if (!c) return { kind: `CLASS${type}`, entity: false }; return { kind: c.dxf.toUpperCase(), entity: c.entity }; }
  const k = KIND[type] ?? `TYPE${type}`;
  return { kind: k, entity: ENTITY.has(k) };
}

function build(sec: Sections, classes: Map<number, ClassInfo>, omap: Map<number, number>): DwgFile {
  const ver = sec.ver, d = sec.objects;
  const layers = new Map<number, { name: string; color: number; rgb: number | null; lw: number; off: boolean; frozen: boolean }>();
  const styles = new Map<number, { name: string; font: string }>();
  const ltypes = new Map<number, DwgLinetype>();
  const blocks = new Map<number, { name: string; base: [number, number, number]; units: number }>();
  const recs: Rec[] = [];
  const tables: Tables = { layers, styles, ltypes, blocks, rank: new Map() };
  let unreadable = 0;
  const failures: string[] = [];
  const order = [...omap.entries()].sort((a, b) => a[0] - b[0]);
  for (const [handle, off] of order) {
    let kind = '', entity = false, type = 0;
    try {
      const b0 = new Bits(d, d.length * 8, off * 8);
      const size = b0.ms();
      let base = b0.pos, end = base + size * 8;
      let hs: number;
      if (ver >= 24) { const hb = b0.mcU(); base = b0.pos; end = base + size * 8; type = ot(b0); hs = end - hb; }
      else { type = b0.bs(); hs = base + b0.rl(); }
      const k = kindOf(type, classes);
      kind = k.kind; entity = k.entity;
      const isTable = kind === 'LAYER' || kind === 'STYLE' || kind === 'LTYPE' || kind === 'BLOCK_HEADER';
      if (!entity && !isTable) continue;
      if (hs > end || hs < b0.pos) throw new DwgError('Bad handle stream position.');
      const str = ver >= 21 ? stringStream(d, hs, base) : null;
      const r = new Rd(new Bits(d, hs, b0.pos), str, new Bits(d, end, hs), ver);
      const c = common(r, handle, entity);
      commonHandles(r, c);
      if (isTable) { table(r, kind, c, handle, tables); continue; }
      const rec = entityRec(r, kind, c, type);
      if (rec) recs.push(rec);
    } catch (e) {
      if (entity || kind === '') {
        unreadable++;
        if (failures.length < 20) failures.push(`${kind || `type ${type}`} ${handle.toString(16)}: ${(e as Error).message}`);
      }
    }
  }
  return assemble(sec, recs, tables, unreadable, failures);
}

interface Tables {
  layers: Map<number, { name: string; color: number; rgb: number | null; lw: number; off: boolean; frozen: boolean }>;
  styles: Map<number, { name: string; font: string }>;
  ltypes: Map<number, DwgLinetype>;
  blocks: Map<number, { name: string; base: [number, number, number]; units: number }>;
  // position of each entity in its block's own list, which is the drawing order (R2004 and later)
  rank: Map<number, number>;
}

function table(r: Rd, kind: string, c: Common, handle: number, t: Tables): void {
  const b = r.b, ver = r.ver;
  void c;
  const entry = (): void => { if (ver < 21) { b.bit(); b.bs(); b.bit(); } else b.bs(); };
  if (kind === 'LAYER') {
    const name = r.t();
    entry();
    const flags = ver >= 15 ? b.bs() : 0;
    const col = readCmc(r);
    t.layers.set(handle, { name, color: col.ci, rgb: col.rgb, lw: lwOf((flags & 0x3e0) >> 5), off: col.ci < 0, frozen: (flags & 1) === 1 });
  } else if (kind === 'STYLE') {
    const name = r.t();
    entry();
    b.bit(); b.bit();
    b.bd(); b.bd(); b.bd(); b.rc(); b.bd();
    const font = r.t();
    t.styles.set(handle, { name, font });
  } else if (kind === 'LTYPE') {
    const name = r.t();
    entry();
    const description = r.t();
    b.bd(); b.rc();
    const n = b.rc(), pattern: number[] = [];
    for (let i = 0; i < n; i++) { pattern.push(b.bd()); b.bs(); b.rd(); b.rd(); b.bd(); b.bd(); b.bs(); }
    t.ltypes.set(handle, { name, description, pattern });
  } else if (kind === 'BLOCK_HEADER') {
    const name = r.t();
    entry();
    b.bit(); b.bit(); b.bit(); b.bit(); b.bit();
    const owned = ver >= 18 ? b.bl() : 0;
    const base = b.p3();
    r.t();
    while (b.rc() !== 0) { /* insert count bytes */ }
    r.t();
    const pn = b.bl();
    b.skipBytes(pn);
    const units = ver >= 21 ? b.bs() : 0;
    t.blocks.set(handle, { name, base, units });
    if (owned > 0 && owned < 5_000_000) {
      r.h.h(handle); r.h.h(handle);
      for (let i = 0; i < owned; i++) t.rank.set(r.h.h(handle), i);
    }
  }
}

const P = (code: number, v: number | string): Pair => [code, typeof v === 'number' ? num(v) : v];
const p3 = (x: number, y: number, z: number, c0 = 10): Pair[] => [P(c0, x), P(c0 + 10, y), P(c0 + 20, z)];

function entityRec(r: Rd, kind: string, c: Common, type: number): Rec | null {
  const b = r.b, ver = r.ver;
  const rec: Rec = { handle: c.handle, kind, type, owner: c.owner, mode: c.mode, layer: c.layer, c: [] };
  const out = rec.c;
  if (c.rgb !== null) out.push(P(420, c.rgb));
  if (c.color !== 256) out.push(P(62, c.color));
  const lw = lwOf(c.lw);
  if (lw !== -1) out.push(P(370, lw));
  if (c.invis & 1) out.push(P(60, 1));
  const ocs = (e: [number, number, number]): void => { if (e[2] < 0) out.push(P(230, e[2])); };
  switch (kind) {
    case 'LINE': {
      const zz = b.bit(), x1 = b.rd(), x2 = b.dd(x1), y1 = b.rd(), y2 = b.dd(y1);
      let z1 = 0, z2 = 0;
      if (!zz) { z1 = b.rd(); z2 = b.dd(z1); }
      out.push(...p3(x1, y1, z1), ...p3(x2, y2, z2, 11));
      break;
    }
    case 'CIRCLE': { const ctr = b.p3(), rad = b.bd(); b.bt(); const e = b.be(); out.push(...p3(...ctr), P(40, rad)); ocs(e); break; }
    case 'ARC': { const ctr = b.p3(), rad = b.bd(); b.bt(); const e = b.be(), a0 = b.bd(), a1 = b.bd(); out.push(...p3(...ctr), P(40, rad), P(50, deg(a0)), P(51, deg(a1))); ocs(e); break; }
    case 'POINT': { const p = b.p3(); out.push(...p3(...p)); break; }
    case 'ELLIPSE': { const ctr = b.p3(), maj = b.p3(), e = b.p3(), ratio = b.bd(), t0 = b.bd(), t1 = b.bd(); out.push(...p3(...ctr), ...p3(...maj, 11), P(40, ratio), P(41, t0), P(42, t1), P(230, e[2])); break; }
    case 'SOLID': case 'TRACE': {
      b.bt(); const el = b.bd();
      const q: Array<[number, number]> = [b.r2(), b.r2(), b.r2(), b.r2()];
      const e = b.be();
      q.forEach((v, i) => out.push(P(10 + i, v[0]), P(20 + i, v[1]), P(30 + i, el)));
      ocs(e);
      break;
    }
    case '3DFACE': {
      const nof = b.bit(), zz = b.bit();
      let x = b.rd(), y = b.rd(), z = zz ? 0 : b.rd();
      out.push(...p3(x, y, z, 10));
      for (let i = 1; i < 4; i++) { x = b.dd(x); y = b.dd(y); z = b.dd(z); out.push(...p3(x, y, z, 10 + i)); }
      if (!nof) b.bs();
      break;
    }
    case 'TEXT': case 'ATTRIB': case 'ATTDEF': {
      const df = b.rc();
      const el = df & 1 ? 0 : b.rd();
      const ins = b.r2();
      const al: [number, number] = df & 2 ? ins : [b.dd(ins[0]), b.dd(ins[1])];
      const e = b.be(); b.bt();
      const obl = df & 4 ? 0 : b.rd(), rot = df & 8 ? 0 : b.rd(), hgt = b.rd(), wf = df & 0x10 ? 1 : b.rd();
      const val = r.t();
      const gen = df & 0x20 ? 0 : b.bs(), ha = df & 0x40 ? 0 : b.bs(), va = df & 0x80 ? 0 : b.bs();
      out.push(P(1, val), P(10, ins[0]), P(20, ins[1]), P(30, el), P(11, al[0]), P(21, al[1]), P(40, hgt), P(41, wf), P(50, deg(rot)), P(51, deg(obl)), P(71, gen), P(72, ha), P(73, va));
      if (kind !== 'TEXT') {
        if (ver >= 24) b.rc();
        if (ver >= 32 && b.rc() > 1) throw new DwgError('A multiline attribute is not read.');
        const tag = r.t(); b.bs();
        const fl = b.rc();
        out.push(P(2, tag), P(70, fl));
        if (ver >= 21) b.bit();
        if (kind === 'ATTDEF') out.push(P(3, r.t()));
      }
      ocs(e);
      rec.style = r.h.h(c.handle);
      break;
    }
    case 'MTEXT': {
      const ins = b.p3(); b.p3(); const xd = b.p3(), rw = b.bd();
      if (ver >= 21) b.bd();
      const th = b.bd(), att = b.bs(); b.bs(); b.bd(); b.bd();
      const txt = r.t();
      let ls = 1;
      b.bs(); ls = b.bd();
      out.push(...p3(...ins), ...p3(...xd, 11), P(40, th), P(41, rw), P(71, att), P(1, txt), P(44, ls));
      rec.style = r.h.h(c.handle);
      break;
    }
    case 'INSERT': case 'MINSERT': {
      const ins = b.p3();
      const fl = b.bb();
      let sx = 1, sy = 1, sz = 1;
      if (fl === 0) { sx = b.rd(); sy = b.dd(sx); sz = b.dd(sx); }
      else if (fl === 1) { sy = b.dd(1); sz = b.dd(1); }
      else if (fl === 2) { sx = b.rd(); sy = sx; sz = sx; }
      const rot = b.bd(), e = b.be(), att = b.bit();
      if (ver >= 27 && att) b.bl();
      out.push(...p3(...ins), P(41, sx), P(42, sy), P(43, sz), P(50, deg(rot)), P(66, att));
      if (kind === 'MINSERT') { const nc = b.bs(), nr = b.bs(), dc = b.bd(), dr = b.bd(); out.push(P(70, nc), P(71, nr), P(44, dc), P(45, dr)); }
      ocs(e);
      rec.kind = 'INSERT';
      rec.block = r.h.h(c.handle);
      break;
    }
    case 'DIMENSION': r.h.h(c.handle); rec.block = r.h.h(c.handle); break;
    case 'LWPOLYLINE': {
      const fl = b.bs();
      let cw = 0, el = 0;
      if (fl & 4) cw = b.bd();
      if (fl & 8) el = b.bd();
      if (fl & 2) b.bd();
      let e: [number, number, number] = [0, 0, 1];
      if (fl & 1) e = b.p3();
      const n = b.bl();
      const nb = fl & 16 ? b.bl() : 0;
      if (ver >= 24 && fl & 1024) b.bl();
      const nw = fl & 32 ? b.bl() : 0;
      if (n > 1_000_000 || nb > n || nw > n) throw new DwgError('Bad polyline.');
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < n; i++) pts.push(i === 0 ? b.r2() : [b.dd(pts[i - 1][0]), b.dd(pts[i - 1][1])]);
      const bul: number[] = [];
      for (let i = 0; i < nb; i++) bul.push(b.bd());
      out.push(P(70, (fl & 512 ? 1 : 0) | (fl & 256 ? 128 : 0)), P(38, el));
      if (cw) out.push(P(43, cw));
      pts.forEach((v, i) => { out.push(P(10, v[0]), P(20, v[1])); if (bul[i]) out.push(P(42, bul[i])); });
      ocs(e);
      break;
    }
    case 'POLYLINE_2D': {
      const fl = b.bs(); b.bs(); const sw = b.bd(); b.bd(); b.bt(); const el = b.bd(), e = b.be();
      out.push(P(70, fl), P(38, el), P(40, sw));
      ocs(e);
      rec.kind = 'POLYLINE';
      break;
    }
    case 'POLYLINE_3D': { const f1 = b.rc(), f2 = b.rc(); out.push(P(70, 8 | (f2 & 1))); void f1; rec.kind = 'POLYLINE'; break; }
    case 'POLYLINE_PFACE': out.push(P(70, 64)); rec.kind = 'POLYLINE'; break;
    case 'POLYLINE_MESH': out.push(P(70, 16)); rec.kind = 'POLYLINE'; break;
    case 'VERTEX_2D': {
      const vf = b.rc(), pt = b.p3(), sw = b.bd();
      if (sw >= 0) b.bd();
      const bu = b.bd();
      out.push(P(70, vf), ...p3(...pt), P(42, bu));
      rec.kind = 'VERTEX';
      break;
    }
    case 'VERTEX_3D': { const vf = b.rc(), pt = b.p3(); out.push(P(70, vf), ...p3(...pt)); rec.kind = 'VERTEX'; break; }
    case 'VERTEX_MESH': case 'VERTEX_PFACE': case 'VERTEX_PFACE_FACE': rec.kind = 'VERTEX'; break;
    case 'SPLINE': case 'HELIX': {
      // a helix is a spline followed by its axis data, so the curve reads the same way
      rec.kind = 'SPLINE';
      const sc = b.bl();
      let f1 = 0, kp = 0;
      if (ver >= 27) { f1 = b.bl(); kp = b.bl(); }
      const degree = b.bl();
      const ctrl: Array<[number, number, number]> = [], fit: Array<[number, number, number]> = [], knots: number[] = [], w: number[] = [];
      let rational = 0, closed = 0, periodic = 0;
      if (ver >= 27 ? (f1 & 1) !== 0 : sc === 2) {
        b.bd(); b.p3(); b.p3();
        const nf = b.bl();
        if (nf > 1_000_000) throw new DwgError('Bad spline.');
        for (let i = 0; i < nf; i++) fit.push(b.p3());
      } else {
        rational = b.bit(); closed = b.bit(); periodic = b.bit(); b.bd(); b.bd();
        const nk = b.bl(), nc = b.bl(), wt = b.bit();
        if (nk > 1_000_000 || nc > 1_000_000) throw new DwgError('Bad spline.');
        for (let i = 0; i < nk; i++) knots.push(b.bd());
        for (let i = 0; i < nc; i++) { ctrl.push(b.p3()); if (wt) w.push(b.bd()); }
      }
      out.push(P(70, (closed ? 1 : 0) | (periodic ? 2 : 0) | (rational ? 4 : 0)), P(71, degree), P(72, knots.length), P(73, ctrl.length), P(74, fit.length));
      knots.forEach((k) => out.push(P(40, k)));
      w.forEach((k) => out.push(P(41, k)));
      ctrl.forEach((v) => out.push(...p3(...v)));
      fit.forEach((v) => out.push(...p3(...v, 11)));
      break;
    }
    case 'LEADER': {
      b.bit(); b.bs(); b.bs();
      const n = b.bl();
      if (n > 1_000_000) throw new DwgError('Bad leader.');
      for (let i = 0; i < n; i++) out.push(...p3(...b.p3()));
      break;
    }
    case 'HATCH': hatch(r, out); break;
    case 'BLOCK': rec.name = r.t(); break;
    case 'ENDBLK': case 'SEQEND': break;
    default: break;
  }
  return rec;
}

function hatch(r: Rd, out: Pair[]): void {
  const b = r.b, ver = r.ver;
  let grad = 0, gAngle = 0;
  const cols: number[] = [];
  if (ver >= 18) {
    grad = b.bl(); b.bl(); gAngle = b.bd(); b.bd(); b.bl(); b.bd();
    const nc = b.bl();
    for (let i = 0; i < nc; i++) { b.bd(); b.bs(); cols.push(b.bl() & 0xffffff); b.rc(); }
    r.t();
  }
  const el = b.bd(), e = b.p3();
  r.t();
  const solid = b.bit();
  b.bit();
  const np = b.bl();
  if (np > 100000) throw new DwgError('Bad hatch.');
  out.push(P(30, el), P(70, solid), P(91, np));
  if (e[2] < 0) out.push(P(230, e[2]));
  for (let i = 0; i < np; i++) {
    const fl = b.bl();
    out.push(P(92, fl));
    if (!(fl & 2)) {
      const ns = b.bl();
      if (ns > 1_000_000) throw new DwgError('Bad hatch path.');
      out.push(P(93, ns));
      for (let s = 0; s < ns; s++) {
        const t = b.rc();
        out.push(P(72, t));
        if (t === 1) { const a = b.r2(), z = b.r2(); out.push(P(10, a[0]), P(20, a[1]), P(11, z[0]), P(21, z[1])); }
        else if (t === 2) { const ctr = b.r2(), rad = b.bd(), a0 = b.bd(), a1 = b.bd(), ccw = b.bit(); out.push(P(10, ctr[0]), P(20, ctr[1]), P(40, rad), P(50, deg(a0)), P(51, deg(a1)), P(73, ccw)); }
        else if (t === 3) { const ctr = b.r2(), mj = b.r2(), ratio = b.bd(), a0 = b.bd(), a1 = b.bd(), ccw = b.bit(); out.push(P(10, ctr[0]), P(20, ctr[1]), P(11, mj[0]), P(21, mj[1]), P(40, ratio), P(50, deg(a0)), P(51, deg(a1)), P(73, ccw)); }
        else if (t === 4) {
          const dg = b.bl(), rat = b.bit(), per = b.bit(), nk = b.bl(), nc = b.bl();
          if (nk > 1_000_000 || nc > 1_000_000) throw new DwgError('Bad hatch spline.');
          out.push(P(94, dg), P(73, rat), P(74, per), P(95, nk), P(96, nc));
          for (let k = 0; k < nk; k++) out.push(P(40, b.bd()));
          for (let k = 0; k < nc; k++) { const v = b.r2(); out.push(P(10, v[0]), P(20, v[1])); if (rat) out.push(P(42, b.bd())); }
          if (ver >= 27) {
            const nf = b.bl();
            out.push(P(97, nf));
            if (nf) { for (let k = 0; k < nf; k++) { const v = b.r2(); out.push(P(11, v[0]), P(21, v[1])); } b.r2(); b.r2(); }
          }
        } else throw new DwgError('Unknown hatch edge.');
      }
    } else {
      const bulges = b.bit(), closed = b.bit(), n = b.bl();
      if (n > 1_000_000) throw new DwgError('Bad hatch polyline.');
      out.push(P(72, bulges), P(73, closed), P(93, n));
      for (let k = 0; k < n; k++) { const v = b.r2(); out.push(P(10, v[0]), P(20, v[1])); if (bulges) out.push(P(42, b.bd())); }
    }
    const nb = b.bl();
    void nb;
    out.push(P(97, 0));
  }
  if (grad) {
    out.push(P(450, 1), P(460, gAngle));
    cols.forEach((cv) => out.push(P(421, cv)));
  }
}

function assemble(sec: Sections, recs: Rec[], t: Tables, unreadable: number, failures: string[]): DwgFile {
  const hdr = readHeader(sec);
  const layerName = (h: number): string => t.layers.get(h)?.name ?? '0';
  const file: DwgFile = {
    version: sec.tag, units: hdr.units, metric: hdr.metric, layers: new Map(), styles: new Map(), blocks: new Map(), ents: [], layouts: ['Model'],
    linetypes: new Map(), lineScale: hdr.ltscale, extents: hdr.extents, native: { version: sec.tag, objects: recs.length, unreadable, failures },
  };
  for (const L of t.layers.values()) file.layers.set(L.name, { name: L.name, color: Math.abs(L.color) || 7, rgb: L.rgb, lw: L.lw, off: L.off || L.frozen });
  for (const S of t.styles.values()) file.styles.set(S.name.toUpperCase(), S.font.toLowerCase());
  for (const L of t.ltypes.values()) file.linetypes.set(L.name, L);
  const blockOf = new Map<number, string>(), taken = new Set<string>();
  let anon = 0;
  for (const [h, B] of [...t.blocks].sort((p, q) => p[0] - q[0])) {
    let n = B.name, k = 0;
    if (/^\*[A-Za-z]$/.test(n)) n = `${n}${++anon}`;
    while (taken.has(n.toUpperCase())) n = `${B.name}${++k}`;
    taken.add(n.toUpperCase());
    B.name = n;
    blockOf.set(h, n);
  }
  // the entities of a block keep the order of the block's own list; objects outside any list stay in handle order after them
  const space = (rc: Rec): number => {
    if (rc.mode === 2) return 0;
    if (rc.mode === 1) return 1;
    const bn = blockOf.get(rc.owner);
    if (bn === undefined) return 3;
    const pm = /^\*paper_space(\d*)$/i.exec(bn);
    return /^\*model_space$/i.test(bn) ? 0 : pm ? 1 + Number(pm[1] || 0) / 1000 : 2;
  };
  recs.sort((p, q) => space(p) - space(q) || ((t.rank.get(p.handle) ?? Infinity) - (t.rank.get(q.handle) ?? Infinity) || 0));
  const children = new Map<number, Rec[]>();
  for (const rc of recs) if (CHILD.has(rc.kind) || rc.kind === 'VERTEX' || rc.kind === 'ATTRIB') { const a = children.get(rc.owner) ?? []; a.push(rc); children.set(rc.owner, a); }
  const blockNames = new Map<string, { name: string; base: { x: number; y: number }; ents: Ent[] }>();
  for (const B of t.blocks.values()) if (!/^\*(model_space|paper_space)/i.test(B.name)) blockNames.set(B.name, { name: B.name, base: { x: B.base[0], y: B.base[1] }, ents: [] });
  const paperName = (n: string): string => { const m = /^\*paper_space(\d*)$/i.exec(n); return m ? `Layout${m[1] === '' ? 1 : Number(m[1]) + 2}` : 'Layout1'; };
  const mk = (rc: Rec): Ent => {
    const c: Pair[] = [[8, layerName(rc.layer)]];
    return { type: rc.kind, c: c.concat(rc.c) };
  };
  void mk;
  const paper = new Set<string>();
  for (const rc of recs) {
    if (CHILD.has(rc.kind) || rc.kind === 'VERTEX' || rc.kind === 'BLOCK' || rc.kind === 'ENDBLK') continue;
    let target: Ent[] | null = null, paperLayout = '';
    if (rc.mode === 2) target = file.ents;
    else if (rc.mode === 1) { target = file.ents; paperLayout = 'Layout1'; }
    else {
      const bn = blockOf.get(rc.owner);
      if (bn === undefined) continue;
      if (/^\*model_space$/i.test(bn)) target = file.ents;
      else if (/^\*paper_space/i.test(bn)) { target = file.ents; paperLayout = paperName(bn); }
      else target = blockNames.get(bn)?.ents ?? null;
    }
    if (!target) continue;
    const e: Ent = { type: rc.kind, c: [[8, layerName(rc.layer)], ...rc.c] };
    if (rc.style !== undefined) e.c.push([7, t.styles.get(rc.style)?.name ?? 'STANDARD']);
    if (rc.block !== undefined) e.c.push([2, blockOf.get(rc.block) ?? '']);
    if (paperLayout) { e.c.push([67, '1'], [410, paperLayout]); paper.add(paperLayout); }
    target.push(e);
    const kids = children.get(rc.handle);
    if (kids) {
      for (const k of kids) { if (k.kind === 'SEQEND') continue; target.push({ type: k.kind, c: [[8, layerName(k.layer)], ...k.c] }); }
      target.push({ type: 'SEQEND', c: [] });
    }
  }
  for (const [n, B] of blockNames) file.blocks.set(n, B);
  file.layouts = ['Model', ...[...paper].sort()];
  for (let i = 0; i < unreadable; i++) file.ents.push({ type: 'UNREADABLE OBJECTS', c: [] });
  return file;
}
