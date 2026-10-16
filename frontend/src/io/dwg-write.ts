import { BitsOut, crc16, mcS, mcU, msBytes } from './dwg-out';
import { exportDxf, parseDxf, type DxfExportOptions, type DxfFile, type DxfUnit } from './dxf';
import type { PathData, Project, TextNode } from '../engine';

export type V3 = [number, number, number];
export interface DwgLayerOut { name: string; color: number; off?: boolean; frozen?: boolean; lw?: number }
interface Look { layer: string; color?: number; lw?: number }
export interface DwgVertex { x: number; y: number; b: number }
export type DwgEnt = Look & (
  | { k: 'LINE'; a: V3; b: V3 }
  | { k: 'CIRCLE'; c: V3; r: number }
  | { k: 'ARC'; c: V3; r: number; a0: number; a1: number }
  | { k: 'ELLIPSE'; c: V3; major: V3; ratio: number; t0: number; t1: number }
  | { k: 'POINT'; p: V3 }
  | { k: 'LWPOLYLINE'; v: DwgVertex[]; closed: boolean; width?: number }
  | { k: 'SPLINE'; degree: number; knots: number[]; ctrl: V3[]; weights?: number[]; closed?: boolean }
  | { k: 'TEXT'; text: string; at: V3; height: number; rot: number; style?: string }
  | { k: 'MTEXT'; text: string; at: V3; height: number; width: number; rot: number }
  | { k: 'HATCH'; loops: DwgVertex[][]; style: number }
);
export interface DwgOut { layers: DwgLayerOut[]; ents: DwgEnt[]; units: DxfUnit; metric: boolean; lineweights: boolean }

const INSUNITS_OUT: Partial<Record<DxfUnit, number>> = { in: 1, ft: 2, mi: 3, mm: 4, cm: 5, m: 6, km: 7, yd: 10 };
const LW_TABLE = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];
// lineweight in hundredths of a millimetre to the one-byte index that entities carry; 29 is by layer, 30 by block, 31 the default
function lwIndex(lw: number | undefined): number {
  if (lw === undefined || lw === -1) return 29;
  if (lw === -2) return 30;
  if (lw === -3) return 31;
  let best = 0;
  for (let i = 0; i < LW_TABLE.length; i++) if (Math.abs(LW_TABLE[i] - lw) < Math.abs(LW_TABLE[best] - lw)) best = i;
  return best;
}

const SENT = {
  image: [0x1f, 0x25, 0x6d, 0x07, 0xd4, 0x36, 0x28, 0x28, 0x9d, 0x57, 0xca, 0x3f, 0x9d, 0x44, 0x10, 0x2b],
  imageEnd: [0xe0, 0xda, 0x92, 0xf8, 0x2b, 0xc9, 0xd7, 0xd7, 0x62, 0xa8, 0x35, 0xc0, 0x62, 0xbb, 0xef, 0xd4],
  header: [0xcf, 0x7b, 0x1f, 0x23, 0xfd, 0xde, 0x38, 0xa9, 0x5f, 0x7c, 0x68, 0xb8, 0x4e, 0x6d, 0x33, 0x5f],
  headerEnd: [0x30, 0x84, 0xe0, 0xdc, 0x02, 0x21, 0xc7, 0x56, 0xa0, 0x83, 0x97, 0x47, 0xb1, 0x92, 0xcc, 0xa0],
  classes: [0x8d, 0xa1, 0xc4, 0xb8, 0xc4, 0xa9, 0xf8, 0xc5, 0xc0, 0xdc, 0xf4, 0x5f, 0xe7, 0xcf, 0xb6, 0x8a],
  classesEnd: [0x72, 0x5e, 0x3b, 0x47, 0x3b, 0x56, 0x07, 0x3a, 0x3f, 0x23, 0x0b, 0xa0, 0x18, 0x30, 0x49, 0x75],
  file: [0x95, 0xa0, 0x4e, 0x28, 0x99, 0x82, 0x1a, 0xe5, 0x5e, 0x41, 0xe0, 0x5f, 0x9d, 0x3a, 0x4d, 0x00],
  second: [0xd4, 0x7b, 0x21, 0xce, 0x28, 0x93, 0x9f, 0xbf, 0x53, 0x24, 0x40, 0x09, 0x12, 0x3c, 0xaa, 0x01],
  secondEnd: [0x2b, 0x84, 0xde, 0x31, 0xd7, 0x6c, 0x60, 0x40, 0xac, 0xdb, 0xbf, 0xf6, 0xed, 0xc3, 0x55, 0xfe],
};

const cat = (...parts: Array<ArrayLike<number>>): Uint8Array => {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p as ArrayLike<number>, o); o += p.length; }
  return out;
};
const le32 = (v: number): number[] => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
const le16 = (v: number): number[] => [v & 255, (v >> 8) & 255];

// One object of the file: bit-coded data, then the handle stream, framed by size, type, bit size and CRC
class Obj {
  readonly d = new BitsOut();
  readonly s = new BitsOut();
  constructor(readonly type: number, readonly handle: number) { this.d.h(0, handle); this.d.bs(0); }
  finish(): Uint8Array {
    const t = new BitsOut();
    t.bs(this.type);
    const typeBits = t.pos;
    const all = new BitsOut();
    all.bs(this.type);
    all.rl(typeBits + 32 + this.d.pos);
    all.append(this.d);
    all.append(this.s);
    const data = all.bytes();
    const body = cat(msBytes(data.length), data);
    const c = crc16(body);
    return cat(body, [c & 255, c >> 8]);
  }
}

const GUID = (): string => '{' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => { const r = Math.floor(Math.random() * 16); return (ch === 'x' ? r : (r & 3) | 8).toString(16).toUpperCase(); }) + '}';

function bounds(ents: DwgEnt[]): { lo: V3; hi: V3 } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number): void => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const e of ents) {
    switch (e.k) {
      case 'LINE': add(e.a[0], e.a[1]); add(e.b[0], e.b[1]); break;
      case 'CIRCLE': case 'ARC': add(e.c[0] - e.r, e.c[1] - e.r); add(e.c[0] + e.r, e.c[1] + e.r); break;
      case 'ELLIPSE': { const m = Math.hypot(e.major[0], e.major[1]); add(e.c[0] - m, e.c[1] - m); add(e.c[0] + m, e.c[1] + m); break; }
      case 'POINT': add(e.p[0], e.p[1]); break;
      case 'LWPOLYLINE': for (const v of e.v) add(v.x, v.y); break;
      case 'SPLINE': for (const p of e.ctrl) add(p[0], p[1]); break;
      case 'TEXT': case 'MTEXT': add(e.at[0], e.at[1]); add(e.at[0] + e.height, e.at[1] + e.height); break;
      case 'HATCH': for (const l of e.loops) for (const v of l) add(v.x, v.y); break;
    }
  }
  if (!Number.isFinite(x0)) return { lo: [0, 0, 0], hi: [12, 9, 0] };
  return { lo: [x0, y0, 0], hi: [x1, y1, 0] };
}

export function writeDwg(doc: DwgOut): Uint8Array {
  const objs = new Map<number, Uint8Array>();
  let next = 1;
  const take = (n = 1): number => { const h = next; next += n; return h; };
  const ID = {
    blockCtl: take(), layerCtl: take(), styleCtl: take(), skip4: take(), ltypeCtl: take(), viewCtl: take(), ucsCtl: take(), vportCtl: take(), appidCtl: take(), dimCtl: take(), skipB: take(),
    nod: take(), group: take(), plotDict: take(), normal: take(), layer0: take(), standard: take(), acad: take(), skip13: take(), byBlock: take(), byLayer: take(), continuous: take(),
    mlDict: take(), mlStd: take(), layoutDict: take(), plotSettings: take(), vx: take(), vport: take(), dimStd: take(),
    msHeader: take(), msBegin: take(), msEnd: take(), msLayout: take(), psHeader: take(), psBegin: take(), psEnd: take(), psLayout: take(),
  };
  const layers = doc.layers.filter((l) => l.name !== '0');
  const layerIds = new Map<string, number>([['0', ID.layer0]]);
  for (const l of layers) layerIds.set(l.name, take());
  const entIds = doc.ents.map(() => take());
  const layerOf = (n: string): number => layerIds.get(n) ?? ID.layer0;
  const put = (o: Obj): void => { objs.set(o.handle, o.finish()); };
  const ext = bounds(doc.ents);
  const model = (h: number, type: number): Obj => new Obj(type, h);

  // control objects of the symbol tables
  const control = (type: number, handle: number, entries: number[], tail?: (o: Obj) => void, extra = false): void => {
    const o = model(handle, type);
    o.d.bl(0);
    o.d.bl(entries.length);
    if (extra) o.d.rc(0);
    o.s.h(4, 0); o.s.h(3, 0);
    for (const e of entries) o.s.h(2, e);
    if (extra) for (const e of entries) o.s.h(5, e);
    tail?.(o);
    put(o);
  };
  control(48, ID.blockCtl, [], (o) => { o.s.h(3, ID.msHeader); o.s.h(3, ID.psHeader); });
  control(50, ID.layerCtl, [ID.layer0, ...layers.map((l) => layerIds.get(l.name) as number)]);
  control(52, ID.styleCtl, [ID.standard]);
  control(56, ID.ltypeCtl, [ID.continuous], (o) => { o.s.h(3, ID.byBlock); o.s.h(3, ID.byLayer); });
  control(60, ID.viewCtl, []);
  control(62, ID.ucsCtl, []);
  control(64, ID.vportCtl, [ID.vport]);
  control(66, ID.appidCtl, [ID.acad]);
  control(68, ID.dimCtl, [ID.dimStd], undefined, true);
  control(70, ID.vx, []);

  const record = (type: number, handle: number, owner: number, name: string): Obj => {
    const o = model(handle, type);
    o.d.bl(0);
    o.d.tv(name);
    o.d.bit(1); o.d.bs(0); o.d.bit(0);
    o.s.h(4, owner); o.s.h(3, 0); o.s.h(5, 0);
    return o;
  };

  // layers, with the plot flag set and the lineweight index in bits 5 to 9
  const layerRec = (name: string, handle: number, color: number, off: boolean, frozen: boolean, lw: number | undefined): void => {
    const o = record(51, handle, ID.layerCtl, name);
    o.d.bs(((lw === undefined ? 31 : lwIndex(lw)) << 5) | 0x10 | (frozen ? 1 : 0));
    o.d.bs(off ? -(color || 7) : color || 7);
    o.s.h(5, ID.normal); o.s.h(5, ID.continuous);
    put(o);
  };
  layerRec('0', ID.layer0, 7, false, false, undefined);
  for (const l of layers) layerRec(l.name, layerIds.get(l.name) as number, l.color, !!l.off, !!l.frozen, doc.lineweights ? l.lw : undefined);

  const style = record(53, ID.standard, ID.styleCtl, 'Standard');
  style.d.bit(0); style.d.bit(0); style.d.bd(0); style.d.bd(1); style.d.bd(0); style.d.rc(0); style.d.bd(0.2); style.d.tv('arial.ttf'); style.d.tv('');
  put(style);

  const appid = record(67, ID.acad, ID.appidCtl, 'ACAD');
  appid.d.rc(0);
  put(appid);

  const ltype = (handle: number, name: string, desc: string): void => {
    const o = record(57, handle, ID.ltypeCtl, name);
    o.d.tv(desc); o.d.bd(0); o.d.rc(65); o.d.rc(0);
    for (let i = 0; i < 256; i++) o.d.rc(0);
    put(o);
  };
  ltype(ID.byBlock, 'ByBlock', ''); ltype(ID.byLayer, 'ByLayer', ''); ltype(ID.continuous, 'Continuous', 'Solid line');

  const dim = record(69, ID.dimStd, ID.dimCtl, 'Standard');
  const dd = dim.d;
  dd.tv(''); dd.tv('');
  for (const v of [1, 0.18, 0.0625, 0.38, 0.18, 0, 0, 0, 0]) dd.bd(v);
  for (let i = 0; i < 4; i++) dd.bit(i === 2 || i === 3 ? 1 : 0);
  dd.bit(0); dd.bit(0);
  dd.bs(0); dd.bs(0); dd.bs(0);
  for (const v of [0.18, 0.09, 0, 25.4, 1, 0, 1, 0.09, 0]) dd.bd(v);
  dd.bit(0); dd.bs(2); dd.bit(0); dd.bit(0); dd.bit(0); dd.bit(0);
  dd.bs(0); dd.bs(0); dd.bs(0);
  for (const v of [0, 4, 4, 2, 2, 0, 0, 2, 46, 0, 0]) dd.bs(v);
  dd.bit(0); dd.bit(0);
  dd.bs(1); dd.bs(0); dd.bs(0); dd.bs(0);
  dd.bit(0);
  dd.bs(3);
  dd.bs(-2); dd.bs(-2);
  dd.bit(0);
  dim.s.h(5, ID.standard);
  for (let i = 0; i < 4; i++) dim.s.h(5, 0);
  put(dim);

  const vp = record(65, ID.vport, ID.vportCtl, '*Active');
  {
    const w = Math.max(1e-6, ext.hi[0] - ext.lo[0]), h = Math.max(1e-6, ext.hi[1] - ext.lo[1]), a = 1.5, size = Math.max(h, w / a) * 1.1, v = vp.d;
    v.bd(size); v.bd(size * a); v.rd((ext.lo[0] + ext.hi[0]) / 2); v.rd((ext.lo[1] + ext.hi[1]) / 2);
    v.p3([0, 0, 0]); v.p3([0, 0, 1]); v.bd(0); v.bd(50); v.bd(0); v.bd(0);
    for (let i = 0; i < 4; i++) v.bit(0);
    v.rc(0); v.r2([0, 0]); v.r2([1, 1]);
    v.bit(0); v.bs(1000); v.bit(1); v.bb(3); v.bit(0); v.r2([0.5, 0.5]);
    v.bit(0); v.bit(0); v.bs(0); v.bd(0); v.r2([0, 0]); v.r2([0.5, 0.5]);
    v.bit(0); v.bit(1);
    v.p3([0, 0, 0]); v.p3([1, 0, 0]); v.p3([0, 1, 0]); v.bd(0); v.bs(0);
    vp.s.h(5, 0); vp.s.h(5, 0);
  }
  put(vp);

  // dictionaries and what they hold
  const dict = (handle: number, owner: number, items: Array<[string, number]>, opts: { type?: number; dflt?: number; reactor?: number } = {}): void => {
    const o = model(handle, opts.type ?? 42);
    const rx = opts.reactor ?? (owner === 0 ? 0 : owner);
    o.d.bl(rx ? 1 : 0);
    o.d.bl(items.length); o.d.bs(1); o.d.rc(0);
    for (const [n] of items) o.d.tv(n);
    o.s.h(4, owner);
    if (rx) o.s.h(4, rx);
    o.s.h(3, 0);
    for (const [, h] of items) o.s.h(2, h);
    if (opts.dflt !== undefined) o.s.h(5, opts.dflt);
    put(o);
  };
  dict(ID.nod, 0, [['ACAD_GROUP', ID.group], ['ACAD_LAYOUT', ID.layoutDict], ['ACAD_MLINESTYLE', ID.mlDict], ['ACAD_PLOTSETTINGS', ID.plotSettings], ['ACAD_PLOTSTYLENAME', ID.plotDict]]);
  dict(ID.group, ID.nod, [], { reactor: ID.nod });
  dict(ID.plotDict, ID.nod, [['Normal', ID.normal]], { type: 500, dflt: ID.normal, reactor: ID.nod });
  dict(ID.mlDict, ID.nod, [['Standard', ID.mlStd]], { reactor: ID.nod });
  dict(ID.layoutDict, ID.nod, [['Layout1', ID.psLayout], ['Model', ID.msLayout]], { reactor: ID.nod });
  dict(ID.plotSettings, ID.nod, [], { reactor: ID.nod });
  {
    const o = model(ID.normal, 501);
    o.d.bl(1);
    o.s.h(4, ID.plotDict); o.s.h(4, ID.plotDict); o.s.h(3, 0);
    put(o);
  }
  {
    const o = model(ID.mlStd, 73);
    o.d.bl(1);
    o.d.tv('STANDARD'); o.d.tv(''); o.d.bs(0); o.d.bs(256); o.d.bd(Math.PI / 2); o.d.bd(Math.PI / 2); o.d.rc(2);
    for (const off of [0.5, -0.5]) { o.d.bd(off); o.d.bs(256); o.d.bs(32767); }
    o.s.h(4, ID.mlDict); o.s.h(4, ID.mlDict); o.s.h(3, 0);
    put(o);
  }

  // model space and paper space: block header, BLOCK, ENDBLK and the layout that goes with them
  const first = entIds.length ? entIds[0] : 0, last = entIds.length ? entIds[entIds.length - 1] : 0;
  const blockHeader = (handle: number, name: string, begin: number, end: number, layout: number, f: number, l: number): void => {
    const o = record(49, handle, ID.blockCtl, name);
    o.d.bit(0); o.d.bit(0); o.d.bit(0); o.d.bit(0); o.d.bit(0);
    o.d.p3([0, 0, 0]); o.d.tv(''); o.d.rc(0); o.d.tv(''); o.d.bl(0);
    o.s.h(3, begin); o.s.h(4, f); o.s.h(4, l); o.s.h(3, end); o.s.h(5, layout);
    put(o);
  };
  blockHeader(ID.msHeader, '*Model_Space', ID.msBegin, ID.msEnd, ID.msLayout, first, last);
  blockHeader(ID.psHeader, '*Paper_Space', ID.psBegin, ID.psEnd, ID.psLayout, 0, 0);
  const entity = (type: number, handle: number, mode: number, e: { layer: number; color?: number; lw?: number }, prev: number, nxt: number, owner = 0): Obj => {
    const o = model(handle, type);
    o.d.bit(0); o.d.bb(mode); o.d.bl(0); o.d.bit(0);
    o.d.bs(e.color ?? 256); o.d.bd(1); o.d.bb(0); o.d.bb(0); o.d.bs(0); o.d.rc(lwIndex(e.lw));
    if (mode === 0) o.s.h(4, owner);
    o.s.h(3, 0); o.s.h(4, prev); o.s.h(4, nxt); o.s.h(5, e.layer);
    return o;
  };
  const blk = (handle: number, type: number, mode: number, name: string): void => {
    const o = entity(type, handle, mode, { layer: ID.layer0 }, 0, 0);
    if (type === 4) o.d.tv(name);
    put(o);
  };
  blk(ID.msBegin, 4, 2, '*Model_Space'); blk(ID.msEnd, 5, 2, '');
  blk(ID.psBegin, 4, 1, '*Paper_Space'); blk(ID.psEnd, 5, 1, '');

  const layout = (handle: number, header: number, name: string, tab: number, flags: number, model: boolean, vport: number): void => {
    const o = new Obj(502, handle);
    const d = o.d;
    d.bl(1);
    d.tv(''); d.tv(model ? 'none_device' : 'None'); d.bs(model ? 11952 : 688);
    if (model) { d.bd(6.35); d.bd(19.05); d.bd(6.35); d.bd(19.05); d.bd(215.9); d.bd(279.4); d.tv('ANSI_A_(8.50_x_11.00_Inches)'); }
    else { for (let i = 0; i < 6; i++) d.bd(0); d.tv(''); }
    d.b2([0, 0]); d.bs(model ? 0 : 0); d.bs(model ? 1 : 0); d.bs(model ? 0 : 5);
    d.b2([0, 0]); d.b2([0, 0]); d.tv('');
    d.bd(1); d.bd(1); d.tv(''); d.bs(model ? 0 : 16); d.bd(1); d.b2([0, 0]);
    d.tv(name); d.bl(tab); d.bs(flags);
    d.p3([0, 0, 0]); d.r2([0, 0]); d.r2([12, 9]); d.p3([0, 0, 0]); d.p3([1, 0, 0]); d.p3([0, 1, 0]); d.bd(0); d.bs(0);
    d.p3([0, 0, 0]); d.p3([0, 0, 0]);
    o.s.h(4, ID.layoutDict); o.s.h(4, ID.layoutDict); o.s.h(3, 0); o.s.h(4, header); o.s.h(4, vport); o.s.h(5, 0); o.s.h(5, 0);
    put(o);
  };
  layout(ID.msLayout, ID.msHeader, 'Model', 0, 1, true, ID.vport);
  layout(ID.psLayout, ID.psHeader, 'Layout1', 1, 1, false, 0);

  // entities, chained in order inside model space
  doc.ents.forEach((e, i) => {
    const prev = i > 0 ? entIds[i - 1] : 0, nxt = i + 1 < entIds.length ? entIds[i + 1] : 0;
    const look = { layer: layerOf(e.layer), color: e.color, lw: doc.lineweights ? e.lw : undefined };
    const h = entIds[i];
    switch (e.k) {
      case 'LINE': {
        const o = entity(19, h, 2, look, prev, nxt), d = o.d, zz = e.a[2] === 0 && e.b[2] === 0;
        d.bit(zz ? 1 : 0); d.rd(e.a[0]); d.dd(e.b[0], e.a[0]); d.rd(e.a[1]); d.dd(e.b[1], e.a[1]);
        if (!zz) { d.rd(e.a[2]); d.dd(e.b[2], e.a[2]); }
        d.bt(0); d.be([0, 0, 1]);
        put(o);
        break;
      }
      case 'CIRCLE': case 'ARC': {
        const o = entity(e.k === 'CIRCLE' ? 18 : 17, h, 2, look, prev, nxt), d = o.d;
        d.p3(e.c); d.bd(e.r); d.bt(0); d.be([0, 0, 1]);
        if (e.k === 'ARC') { d.bd(e.a0); d.bd(e.a1); }
        put(o);
        break;
      }
      case 'POINT': { const o = entity(27, h, 2, look, prev, nxt); o.d.p3(e.p); o.d.bt(0); o.d.be([0, 0, 1]); o.d.bd(0); put(o); break; }
      case 'ELLIPSE': { const o = entity(35, h, 2, look, prev, nxt), d = o.d; d.p3(e.c); d.p3(e.major); d.p3([0, 0, 1]); d.bd(e.ratio); d.bd(e.t0); d.bd(e.t1); put(o); break; }
      case 'LWPOLYLINE': {
        const o = entity(77, h, 2, look, prev, nxt), d = o.d, bul = e.v.some((v) => v.b !== 0), cw = e.width ?? 0;
        d.bs((cw ? 4 : 0) | (bul ? 16 : 0) | (e.closed ? 512 : 0));
        if (cw) d.bd(cw);
        d.bl(e.v.length);
        if (bul) d.bl(e.v.length);
        e.v.forEach((v, k) => { if (k === 0) d.r2([v.x, v.y]); else { d.dd(v.x, e.v[k - 1].x); d.dd(v.y, e.v[k - 1].y); } });
        if (bul) for (const v of e.v) d.bd(v.b);
        put(o);
        break;
      }
      case 'SPLINE': {
        const o = entity(36, h, 2, look, prev, nxt), d = o.d, wt = !!e.weights && e.weights.length === e.ctrl.length;
        d.bl(1); d.bl(e.degree);
        d.bit(wt ? 1 : 0); d.bit(e.closed ? 1 : 0); d.bit(0); d.bd(1e-7); d.bd(1e-7);
        d.bl(e.knots.length); d.bl(e.ctrl.length); d.bit(wt ? 1 : 0);
        for (const k of e.knots) d.bd(k);
        e.ctrl.forEach((p, k) => { d.p3(p); if (wt) d.bd((e.weights as number[])[k]); });
        put(o);
        break;
      }
      case 'TEXT': {
        const o = entity(1, h, 2, look, prev, nxt), d = o.d;
        const df = (e.at[2] === 0 ? 1 : 0) | 2 | (0 << 2) | (e.rot === 0 ? 8 : 0) | 4 | 0x10 | 0x20 | 0x40 | 0x80;
        d.rc(df);
        if (!(df & 1)) d.rd(e.at[2]);
        d.r2(e.at);
        d.be([0, 0, 1]); d.bt(0);
        if (!(df & 8)) d.rd(e.rot);
        d.rd(e.height);
        d.tv(e.text);
        o.s.h(5, ID.standard);
        put(o);
        break;
      }
      case 'MTEXT': {
        const o = entity(44, h, 2, look, prev, nxt), d = o.d;
        d.p3(e.at); d.p3([0, 0, 1]); d.p3([Math.cos(e.rot), Math.sin(e.rot), 0]); d.bd(e.width); d.bd(e.height);
        d.bs(1); d.bs(1); d.bd(e.height); d.bd(e.width);
        d.tv(e.text); d.bs(1); d.bd(1); d.bit(0);
        o.s.h(5, ID.standard);
        put(o);
        break;
      }
      case 'HATCH': {
        const o = entity(78, h, 2, look, prev, nxt), d = o.d;
        d.bd(0); d.p3([0, 0, 1]); d.tv('SOLID'); d.bit(1); d.bit(0); d.bl(e.loops.length);
        for (const L of e.loops) {
          d.bl(3);
          d.bit(L.some((v) => v.b !== 0) ? 1 : 0); d.bit(1); d.bl(L.length);
          const bl = L.some((v) => v.b !== 0);
          for (const v of L) { d.r2([v.x, v.y]); if (bl) d.bd(v.b); }
          d.bl(0);
        }
        d.bs(e.style); d.bs(1); d.bl(0);
        put(o);
        break;
      }
    }
  });

  // classes
  const cls = new BitsOut();
  const klass = (num: number, flags: number, cpp: string, dxf: string): void => { cls.bs(num); cls.bs(flags); cls.tv('ObjectDBX Classes'); cls.tv(cpp); cls.tv(dxf); cls.bit(0); cls.bs(499); };
  klass(500, 0, 'AcDbDictionaryWithDefault', 'ACDBDICTIONARYWDFLT');
  klass(501, 0, 'AcDbPlaceHolder', 'ACDBPLACEHOLDER');
  klass(502, 0, 'AcDbLayout', 'LAYOUT');
  const clsData = cls.bytes();
  const clsBody = cat(le32(clsData.length), clsData);
  const clsCrc = crc16(clsBody);
  const clsSec = cat(SENT.classes, clsBody, le16(clsCrc), SENT.classesEnd);

  // header variables
  const now = Date.now() / 86400000 + 2440587.5;
  const day = Math.floor(now), ms = Math.floor((now - day) * 86400000);
  const seed = next;
  const hv = new BitsOut();
  const lim: [number, number] = [12, 9];
  const ucs = (): void => { hv.p3([0, 0, 0]); hv.p3([1, 0, 0]); hv.p3([0, 1, 0]); hv.h(5, 0); hv.h(5, 0); hv.bs(0); hv.h(5, 0); for (let i = 0; i < 6; i++) hv.p3([0, 0, 0]); };
  hv.bd(412148564080); hv.bd(1); hv.bd(1); hv.bd(1);
  hv.tv('m'); hv.tv(''); hv.tv(''); hv.tv('');
  hv.bl(24); hv.bl(0);
  hv.h(5, 0);
  for (const v of [1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0]) hv.bit(v);
  for (const v of [1, 3020, 2, 4, 0, 0, 1, 0]) hv.bs(v);
  for (let i = 0; i < 5; i++) hv.bs(0);
  for (const v of [8, 6, 6, 6, 6, 6, 6, 3, 70, 0, 64, 4, 0, 50]) hv.bs(v);
  for (const v of [1, 0.2, 0.05, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1, 1]) hv.bd(v);
  hv.tv('.');
  hv.bl(day); hv.bl(ms); hv.bl(day); hv.bl(ms); hv.bl(0); hv.bl(0); hv.bl(0); hv.bl(0);
  hv.bs(256);
  hv.h(0, seed);
  hv.h(5, ID.layer0); hv.h(5, ID.standard); hv.h(5, ID.byLayer); hv.h(5, ID.dimStd); hv.h(5, ID.mlStd);
  hv.bd(0);
  hv.p3([0, 0, 0]); hv.p3([0, 0, 0]); hv.p3([0, 0, 0]); hv.r2([0, 0]); hv.r2(lim); hv.bd(0);
  ucs();
  hv.p3([0, 0, 0]); hv.p3(ext.lo); hv.p3(ext.hi); hv.r2([0, 0]); hv.r2(lim); hv.bd(0);
  ucs();
  hv.tv(''); hv.tv('');
  for (const v of [1, 0.18, 0.0625, 0.38, 0.18, 0, 0, 0, 0]) hv.bd(v);
  for (const v of [0, 0, 1, 1, 0, 0]) hv.bit(v);
  hv.bs(0); hv.bs(0); hv.bs(0);
  for (const v of [0.18, 0.09, 0, 25.4, 1, 0, 1, 0.09, 0]) hv.bd(v);
  hv.bit(0); hv.bs(2); hv.bit(0); hv.bit(0); hv.bit(0); hv.bit(0);
  hv.bs(0); hv.bs(0); hv.bs(0);
  for (const v of [0, 4, 4, 2, 2, 0, 0, 2, 46, 0, 0]) hv.bs(v);
  hv.bit(0); hv.bit(0);
  hv.bs(1); hv.bs(0); hv.bs(0); hv.bs(0);
  hv.bit(0);
  hv.bs(3);
  hv.h(5, ID.standard); for (let i = 0; i < 4; i++) hv.h(5, 0);
  hv.bs(-2); hv.bs(-2);
  for (const c of [ID.blockCtl, ID.layerCtl, ID.styleCtl, ID.ltypeCtl, ID.viewCtl, ID.ucsCtl, ID.vportCtl, ID.appidCtl, ID.dimCtl, ID.vx]) hv.h(3, c);
  hv.h(5, ID.group); hv.h(5, ID.mlDict); hv.h(3, ID.nod);
  hv.bs(1); hv.bs(70);
  hv.tv(''); hv.tv('');
  hv.h(5, ID.layoutDict); hv.h(5, ID.plotSettings); hv.h(5, ID.plotDict);
  hv.bl(doc.lineweights ? 0x281d : 0x2a1d);
  hv.bs(INSUNITS_OUT[doc.units] ?? 0);
  hv.bs(0);
  hv.tv(GUID()); hv.tv(GUID());
  hv.h(5, ID.psHeader); hv.h(5, ID.msHeader); hv.h(5, ID.byLayer); hv.h(5, ID.byBlock); hv.h(5, ID.continuous);
  for (let i = 0; i < 4; i++) hv.bs(0);
  const hvData = hv.bytes();
  const hvBody = cat(le32(hvData.length), hvData);
  const hvSec = cat(SENT.header, hvBody, le16(crc16(hvBody)), SENT.headerEnd);

  // file layout
  const AUX_AT = 0x61, AUX_LEN = 123;
  const image = cat(SENT.image, le32(1), [0], SENT.imageEnd);
  const imageAt = AUX_AT + AUX_LEN;
  const hdrAt = imageAt + image.length;
  const clsAt = hdrAt + hvSec.length;
  const objAt = clsAt + clsSec.length + 4;
  const order = [...objs.keys()].sort((a, b) => a - b);
  const offsets = new Map<number, number>();
  let at = objAt;
  for (const h of order) { offsets.set(h, at); at += (objs.get(h) as Uint8Array).length; }
  const mapAt = at;

  // object map in sections of at most 2000 bytes
  const sections: Uint8Array[] = [];
  let chunk: number[] = [], ph = 0, pl = 0;
  const flush = (): void => {
    if (!chunk.length) return;
    const size = chunk.length + 2, body = cat([size >> 8, size & 255], chunk), c = crc16(body);
    sections.push(cat(body, [c >> 8, c & 255]));
    chunk = []; ph = 0; pl = 0;
  };
  for (const h of order) {
    const loc = offsets.get(h) as number;
    const piece = [...mcU(h - ph), ...mcS(loc - pl)];
    if (chunk.length + piece.length > 2000) { flush(); chunk.push(...mcU(h), ...mcS(loc)); } else chunk.push(...piece);
    ph = h; pl = loc;
  }
  flush();
  { const body = [0, 2], c = crc16(Uint8Array.from(body)); sections.push(Uint8Array.from([0, 2, c >> 8, c & 255])); }
  const mapBytes = cat(...sections);
  const secondAt = mapAt + mapBytes.length;

  // second header: copy of the locators and the handles of the control objects
  const locs: Array<[number, number, number]> = [[0, hdrAt, hvSec.length], [1, clsAt, clsSec.length], [2, mapAt, mapBytes.length], [3, 0, 0], [4, 0, 0], [5, AUX_AT, AUX_LEN]];
  const sh = new BitsOut();
  sh.bl(secondAt);
  for (const c of 'AC1015') sh.rc(c.charCodeAt(0));
  for (let i = 0; i < 5; i++) sh.rc(0);
  sh.rc(0x0f); sh.rc(0x01);
  sh.bl(0x1e081f);
  sh.bl(locs.length);
  for (const [n, a, s] of locs) { sh.rc(n); sh.bl(a); sh.bl(s); }
  const hl: number[] = [seed, ID.blockCtl, ID.layerCtl, ID.styleCtl, ID.ltypeCtl, ID.viewCtl, ID.ucsCtl, ID.vportCtl, ID.appidCtl, ID.dimCtl, ID.vx, ID.group, ID.mlDict, ID.nod];
  sh.bl(hl.length);
  hl.forEach((v, i) => {
    const bytes: number[] = [];
    let x = v;
    while (x > 0) { bytes.unshift(x % 256); x = Math.floor(x / 256); }
    sh.rc(bytes.length); sh.rc(i);
    for (const b of bytes) sh.rc(b);
  });
  sh.align();
  const shBits = sh.bytes();
  const shSize = 4 + shBits.length + 2 + 8;
  const shHead = cat(le32(shSize), shBits);
  const second = cat(SENT.second, shHead, le16(crc16(shHead)), new Uint8Array(8), SENT.secondEnd);
  const templateAt = secondAt + second.length;
  const template = Uint8Array.from([0, 0, doc.metric ? 1 : 0, 0]);

  // auxiliary header
  const aux = new Uint8Array(AUX_LEN);
  {
    const dv = new DataView(aux.buffer);
    aux.set([0xff, 0x77, 0x01], 0);
    let p = 3;
    const s16 = (v: number): void => { dv.setUint16(p, v, true); p += 2; };
    const s32 = (v: number): void => { dv.setUint32(p, v >>> 0, true); p += 4; };
    s16(31); s16(8); s32(1); s32(0xffffffff); s16(1); s16(1); s32(0);
    s16(22); s16(46); s16(22); s16(46);
    for (const v of [4, 1381, 262, 7601, 0, 1]) s16(v);
    for (const v of [0, 0, 0, 16843008, 65537]) s32(v);
    s32(day); s32(ms); s32(day); s32(ms); s32(seed); s32(0);
    s16(0); s16(1);
  }

  // file header
  const fh = new Uint8Array(0x61);
  {
    const dv = new DataView(fh.buffer);
    for (let i = 0; i < 6; i++) fh[i] = 'AC1015'.charCodeAt(i);
    fh[0x0b] = 0x0f; fh[0x0c] = 0x01;
    dv.setUint32(0x0d, imageAt, true);
    fh[0x11] = 0x1f; fh[0x12] = 0x08;
    dv.setUint16(0x13, 30, true);
    dv.setUint32(0x15, locs.length, true);
    const real: Array<[number, number, number]> = [[0, hdrAt, hvSec.length], [1, clsAt, clsSec.length], [2, mapAt, mapBytes.length], [3, 0, 0], [4, templateAt, 4], [5, AUX_AT, AUX_LEN]];
    real.forEach(([n, a, s], i) => { const p = 0x19 + i * 9; fh[p] = n; dv.setUint32(p + 1, a, true); dv.setUint32(p + 5, s, true); });
    const end = 0x19 + real.length * 9;
    dv.setUint16(end, crc16(fh.subarray(0, end)), true);
    fh.set(SENT.file, end + 2);
  }
  const parts: Uint8Array[] = [fh, aux, image, hvSec, clsSec, Uint8Array.from([0, 0, 0, 0])];
  for (const h of order) parts.push(objs.get(h) as Uint8Array);
  parts.push(mapBytes, second, template);
  return cat(...parts);
}

// ---- from the DXF intermediate ----

type Pair = [number, string];
const num = (e: Pair[], code: number, d = 0): number => { for (const [k, v] of e) if (k === code) { const n = parseFloat(v); return Number.isFinite(n) ? n : d; } return d; };
const str = (e: Pair[], code: number, d = ''): string => { for (const [k, v] of e) if (k === code) return v; return d; };
const all = (e: Pair[], code: number): number[] => e.filter(([k]) => k === code).map(([, v]) => parseFloat(v));
const has = (e: Pair[], code: number): boolean => e.some(([k]) => k === code);

// Turns the entities of the DXF the exporter wrote into the writer's own list. Layers take the colour most of their entities use.
export function dwgFromDxf(f: DxfFile, lineweights: boolean): DwgOut {
  const ents: DwgEnt[] = [];
  const seen = new Map<string, Map<number, number>>();
  const look = (c: Pair[]): Look => {
    const layer = str(c, 8, '0');
    const color = has(c, 62) ? num(c, 62) : undefined;
    if (color !== undefined) { const m = seen.get(layer) ?? new Map<number, number>(); m.set(color, (m.get(color) ?? 0) + 1); seen.set(layer, m); }
    return { layer, color, lw: has(c, 370) ? num(c, 370) : undefined };
  };
  for (const e of f.ents) {
    const c = e.c;
    if (num(c, 67, 0) === 1) continue;
    const p3 = (a: number): V3 => [num(c, a), num(c, a + 10), num(c, a + 20)];
    switch (e.type) {
      case 'LINE': ents.push({ ...look(c), k: 'LINE', a: p3(10), b: p3(11) }); break;
      case 'CIRCLE': ents.push({ ...look(c), k: 'CIRCLE', c: p3(10), r: num(c, 40) }); break;
      case 'ARC': ents.push({ ...look(c), k: 'ARC', c: p3(10), r: num(c, 40), a0: (num(c, 50) * Math.PI) / 180, a1: (num(c, 51) * Math.PI) / 180 }); break;
      case 'ELLIPSE': ents.push({ ...look(c), k: 'ELLIPSE', c: p3(10), major: p3(11), ratio: num(c, 40, 1), t0: num(c, 41), t1: num(c, 42, Math.PI * 2) }); break;
      case 'POINT': ents.push({ ...look(c), k: 'POINT', p: p3(10) }); break;
      case 'LWPOLYLINE': {
        const v: DwgVertex[] = [];
        for (const [k, val] of c) {
          if (k === 10) v.push({ x: parseFloat(val), y: 0, b: 0 });
          else if (k === 20 && v.length) v[v.length - 1].y = parseFloat(val);
          else if (k === 42 && v.length) v[v.length - 1].b = parseFloat(val);
        }
        if (v.length > 1) ents.push({ ...look(c), k: 'LWPOLYLINE', v, closed: (num(c, 70) & 1) === 1 });
        break;
      }
      case 'SPLINE': {
        const ctrl: V3[] = [];
        let cur: V3 | null = null;
        for (const [k, val] of c) {
          if (k === 10) { cur = [parseFloat(val), 0, 0]; ctrl.push(cur); }
          else if (k === 20 && cur) cur[1] = parseFloat(val);
          else if (k === 30 && cur) cur[2] = parseFloat(val);
          else if (k === 11) cur = null;
        }
        const w = all(c, 41);
        if (ctrl.length > 1) ents.push({ ...look(c), k: 'SPLINE', degree: num(c, 71, 3), knots: all(c, 40), ctrl, weights: w.length === ctrl.length ? w : undefined, closed: (num(c, 70) & 1) === 1 });
        break;
      }
      case 'TEXT': ents.push({ ...look(c), k: 'TEXT', text: str(c, 1), at: p3(10), height: num(c, 40, 1), rot: (num(c, 50) * Math.PI) / 180 }); break;
      case 'MTEXT': ents.push({ ...look(c), k: 'MTEXT', text: str(c, 1), at: p3(10), height: num(c, 40, 1), width: num(c, 41), rot: (num(c, 50) * Math.PI) / 180 }); break;
      case 'HATCH': {
        const loops: DwgVertex[][] = [];
        let cur: DwgVertex[] | null = null, inLoops = false;
        for (const [k, val] of c) {
          if (k === 91) inLoops = true;
          else if (!inLoops) continue;
          else if (k === 92) { cur = []; loops.push(cur); }
          else if (k === 10 && cur) cur.push({ x: parseFloat(val), y: 0, b: 0 });
          else if (k === 20 && cur && cur.length) cur[cur.length - 1].y = parseFloat(val);
          else if (k === 42 && cur && cur.length) cur[cur.length - 1].b = parseFloat(val);
          else if (k === 75) break;
        }
        const good = loops.filter((l) => l.length > 2);
        if (good.length) ents.push({ ...look(c), k: 'HATCH', loops: good, style: num(c, 75, 0) });
        break;
      }
      default: break;
    }
  }
  const layers: DwgLayerOut[] = [];
  for (const [name, L] of f.layers) {
    if (name === '0') continue;
    const m = seen.get(name);
    let color = 7, top = 0;
    if (m) for (const [k, n] of m) if (n > top) { top = n; color = k; }
    layers.push({ name, color: color === 0 || color === 256 ? 7 : color, off: L.off, lw: L.lw >= 0 ? L.lw : undefined });
  }
  for (const e of ents) if (!f.layers.has(e.layer) && e.layer !== '0' && !layers.some((l) => l.name === e.layer)) layers.push({ name: e.layer, color: 7 });
  return { layers, ents, units: f.units, metric: f.metric, lineweights };
}

export async function exportDwg(p: Project, o: DxfExportOptions, outline: (n: TextNode) => Promise<PathData | null>): Promise<Blob> {
  const dxf = await exportDxf(p, { ...o, version: '2000' }, outline);
  const file = parseDxf(await dxf.text());
  return new Blob([writeDwg(dwgFromDxf(file, o.lineweights)) as BlobPart], { type: 'application/acad' });
}
