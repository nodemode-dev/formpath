import type { Doc } from '../engine';

export interface PdfMarks {
  trim: boolean; registration: boolean; colorBars: boolean; pageInfo: boolean;
  offset: number; weight: number;
  bleed: 'none' | 'document' | 'custom';
  custom?: Bleed;
}
export interface Bleed { t: number; b: number; l: number; r: number }
export interface PageGeometry { ml: number; mb: number; mr: number; mt: number; bleed: Bleed; start: Bleed; width: number; height: number }

const MARK_LEN = 18;
const f = (v: number): string => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };

export const DEFAULT_MARKS: PdfMarks = { trim: false, registration: false, colorBars: false, pageInfo: false, offset: 9, weight: 0.25, bleed: 'document' };

export function marksActive(m?: PdfMarks): boolean { return !!m && (m.trim || m.registration || m.colorBars || m.pageInfo); }

export function bleedFor(doc: Doc, m?: PdfMarks): Bleed {
  const z: Bleed = { t: 0, b: 0, l: 0, r: 0 };
  if (!m || m.bleed === 'none') return z;
  const src = m.bleed === 'custom' ? m.custom : doc.bleed;
  if (!src) return z;
  const v = (n: number): number => Math.max(0, Number.isFinite(n) ? n : 0);
  return { t: v(src.t), b: v(src.b), l: v(src.l), r: v(src.r) };
}

export function pageGeometry(w: number, h: number, bleed: Bleed, m?: PdfMarks): PageGeometry {
  const on = marksActive(m), off = Math.max(0, m?.offset ?? 9);
  const start: Bleed = { t: Math.max(off, bleed.t), b: Math.max(off, bleed.b), l: Math.max(off, bleed.l), r: Math.max(off, bleed.r) };
  const edge = (side: keyof Bleed): number => (on ? start[side] + MARK_LEN : bleed[side]);
  let mt = edge('t'), mb = edge('b');
  if (m?.pageInfo) mt = Math.max(mt, start.t + 12);
  if (m?.colorBars) mb = Math.max(mb, start.b + 12);
  const ml = edge('l'), mr = edge('r');
  return { ml, mb, mr, mt, bleed, start, width: w + ml + mr, height: h + mb + mt };
}

export function marksContent(g: PageGeometry, w: number, h: number, m: PdfMarks, s: number, cs: string, fontRef: string, info: string, rgb = false): string {
  const out: string[] = [`q /${cs} cs 1 scn /${cs} CS 1 SCN ${f(m.weight * s)} w`];
  const X0 = g.ml * s, Y0 = g.mb * s, X1 = (g.ml + w) * s, Y1 = (g.mb + h) * s;
  const st = { l: g.start.l * s, r: g.start.r * s, b: g.start.b * s, t: g.start.t * s }, L = MARK_LEN * s;
  const line = (x1: number, y1: number, x2: number, y2: number): void => { out.push(`${f(x1)} ${f(y1)} m ${f(x2)} ${f(y2)} l S`); };
  if (m.trim) {
    for (const [x, sx, side] of [[X0, -1, st.l], [X1, 1, st.r]] as const) for (const [y, sy, vs] of [[Y0, -1, st.b], [Y1, 1, st.t]] as const) {
      line(x + sx * side, y, x + sx * (side + L), y);
      line(x, y + sy * vs, x, y + sy * (vs + L));
    }
  }
  if (m.registration) {
    const r = 4.5 * s, k = 0.5523 * r, cross = 8 * s;
    const target = (cx: number, cy: number): void => {
      out.push(`${f(cx + r)} ${f(cy)} m ${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)} c ${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} c ${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} c ${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} c S`);
      line(cx - cross, cy, cx + cross, cy); line(cx, cy - cross, cx, cy + cross);
    };
    const mx = (X0 + X1) / 2, my = (Y0 + Y1) / 2;
    target(mx, Y0 - st.b - L / 2); target(mx, Y1 + st.t + L / 2);
    target(X0 - st.l - L / 2, my); target(X1 + st.r + L / 2, my);
  }
  out.push('Q');
  if (m.colorBars) {
    const sz = 9 * s, y = Y0 - st.b - sz, tints: string[] = [];
    const inks = ['1 0 0 0', '0 1 0 0', '0 0 1 0', '0 0 0 1', '0 1 1 0', '1 0 1 0', '1 1 0 0', '0.5 0 0 0', '0 0.5 0 0', '0 0 0.5 0', '0 0 0 0.5', '1 1 1 0'];
    const room = Math.max(0, Math.floor(((X1 - X0) / 2 - 16 * s) / sz));
    const paintOf = (ink: string): string => {
      if (!rgb) return `${ink} k`;
      const [c, m, yy, k] = ink.split(' ').map(Number);
      return `${f((1 - c) * (1 - k))} ${f((1 - m) * (1 - k))} ${f((1 - yy) * (1 - k))} rg`;
    };
    inks.slice(0, room).forEach((ink, i) => tints.push(`${paintOf(ink)} ${f(X0 + 16 * s + i * sz)} ${f(y)} ${f(sz)} ${f(sz)} re f`));
    if (tints.length) out.push(`q ${tints.join(' ')} Q`);
  }
  if (m.pageInfo) out.push(`q /${cs} cs 1 scn BT /${fontRef} ${f(6 * s)} Tf ${f(X0 + 16 * s)} ${f(Y1 + st.t + 3 * s)} Td ${info} Tj ET Q`);
  return out.join('\n');
}
