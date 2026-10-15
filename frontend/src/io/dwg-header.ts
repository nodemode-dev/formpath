import { Bits } from './dwg-bits';
import { stringStream, type Sections } from './dwg-file';
import type { DxfUnit } from './dxf';

export interface HeaderVars { units: DxfUnit; metric: boolean; ltscale: number; extents: [number, number, number, number] | null }

// INSUNITS code to unit name; the codes without a matching name read as unitless
const UNIT_OF: Record<number, DxfUnit> = { 1: 'in', 2: 'ft', 3: 'mi', 4: 'mm', 5: 'cm', 6: 'm', 7: 'km', 10: 'yd' };
const METRIC = new Set<DxfUnit>(['mm', 'cm', 'm', 'km']);

// Walks the header variable list in the order the open specification gives it and keeps only the few variables the
// importer uses. A damaged header leaves the defaults, so it never blocks the drawing itself.
export function readHeader(sec: Sections): HeaderVars {
  const out: HeaderVars = { units: 'unitless', metric: false, ltscale: 1, extents: null };
  try { walk(sec, out); } catch { /* the variables read so far are kept */ }
  return out;
}

function walk(sec: Sections, out: HeaderVars): void {
  const d = sec.header, ver = sec.ver;
  const b = new Bits(d, d.length * 8, 0);
  b.rl();
  if (ver >= 24) b.rl();
  let str: Bits | null = null, limit = d.length * 8;
  if (ver >= 21) {
    const from = b.pos, bits = b.rl();
    limit = from + bits;
    str = stringStream(d, limit, b.pos);
  }
  const m = new Bits(d, limit, b.pos);
  const tv = (): string => (ver >= 21 ? (str ? str.tuStr() : '') : m.tvCp());
  // handles sit inline up to R2004 and in a stream of their own from R2007 on
  const hd = (): void => { if (ver < 21) m.h(); };
  const cmc = (): void => {
    if (ver < 18) { m.bs(); return; }
    m.bs(); m.bl();
    const f = m.rc();
    if (f & 1) tv();
    if (f & 2) tv();
  };
  const bs = (n: number): void => { for (let i = 0; i < n; i++) m.bs(); };
  const bd = (n: number): void => { for (let i = 0; i < n; i++) m.bd(); };
  const bits = (n: number): void => { for (let i = 0; i < n; i++) m.b(); };
  const hds = (n: number): void => { for (let i = 0; i < n; i++) hd(); };

  if (ver >= 27) m.bll();
  bd(4);
  tv(); tv(); tv(); tv();
  m.bl(); m.bl();
  if (ver < 18) hd();
  bits(9);
  if (ver >= 18) m.b();
  bits(4 + 2 + 3 + 2);
  bs(8);
  if (ver >= 18) { m.bl(); m.bl(); m.bl(); }
  bs(19);
  out.ltscale = m.bd();
  bd(20);
  if (ver <= 18) tv();
  for (let i = 0; i < 8; i++) m.bl();
  if (ver >= 18) { m.bl(); m.bl(); m.bl(); }
  cmc();
  m.h();
  hds(3);
  if (ver >= 21) hds(1);
  hds(2);
  m.bd();
  // the paper space group comes first: insertion base, extents, limits, elevation, UCS and its six orthographic origins
  const ucs = (): void => { m.p3(); m.p3(); m.p3(); hds(2); m.bs(); hds(1); for (let i = 0; i < 6; i++) m.p3(); };
  m.p3(); m.p3(); m.p3(); m.r2(); m.r2(); m.bd();
  ucs();
  m.p3();
  const emin = m.p3(), emax = m.p3();
  m.r2(); m.r2(); m.bd();
  ucs();
  const lo: [number, number] = [Math.min(emin[0], emax[0]), Math.min(emin[1], emax[1])];
  const hi: [number, number] = [Math.max(emin[0], emax[0]), Math.max(emin[1], emax[1])];
  if (Number.isFinite(lo[0] + lo[1] + hi[0] + hi[1]) && Math.abs(lo[0]) < 1e19 && Math.abs(hi[0]) < 1e19 && Math.abs(lo[1]) < 1e19 && Math.abs(hi[1]) < 1e19 && hi[0] >= lo[0] && hi[1] >= lo[1]) out.extents = [lo[0], lo[1], hi[0], hi[1]];

  // dimension variables
  tv(); tv();
  bd(9);
  if (ver >= 21) { m.bd(); m.bd(); m.bs(); cmc(); }
  bits(6);
  bs(3);
  if (ver >= 21) m.bs();
  bd(9);
  m.b(); m.bs(); bits(4);
  cmc(); cmc(); cmc();
  bs(11);
  bits(2);
  bs(4);
  m.b();
  m.bs();
  if (ver >= 21) m.b();
  if (ver >= 24) { m.b(); m.bd(); tv(); m.bd(); tv(); }
  if (ver < 21) hds(5);
  bs(2);
  // table control objects, then the three dictionaries
  hds(9);
  if (ver < 18) hd();
  hds(3);
  bs(2);
  if (ver < 21) { bs(2); hds(ver < 18 ? 3 : 5); }
  m.bl();
  const code = m.bs();
  out.units = UNIT_OF[code] ?? 'unitless';
  out.metric = METRIC.has(out.units);
}
