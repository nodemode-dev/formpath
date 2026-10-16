import { childrenOf, newDoc, newId } from '../engine/doc';
import { effectPath, has3d, threeDFaces } from '../engine/effects';
import { anchor, apply, arcSegmentPath, ellipsePath, flattenSeg, fitCurve, matAngle, matScale, mul, segments, transformPath, isLineSeg, type Seg } from '../engine/geometry';
import { liveChildren } from '../engine/live';
import { liveFaceNodes } from '../engine/livepaint';
import { fxNode } from '../engine/groupfx';
import { derivedArt } from '../engine/shaper';
import { isLive } from '../engine/pathfinder';
import { instanceArt } from '../engine/symbolism';
import { fill as fillItem, gradientAt, linearGradient, resolvePaint, stop, stroke as strokeItem, toRgb } from '../engine/paint';
import { DEFAULT_CHAR, DEFAULT_PARA, layoutText } from '../engine/text';
import type { Anchor, Color, Doc, LayerNode, Mat, PathData, Pt, Project, Rect, SubPath, TextNode, VNode } from '../engine';

export type DxfUnit = 'unitless' | 'in' | 'ft' | 'yd' | 'mi' | 'mm' | 'cm' | 'm' | 'km' | 'pt' | 'px';
export const DXF_UNITS: ReadonlyArray<readonly [DxfUnit, string]> = [['mm', 'Millimeters'], ['cm', 'Centimeters'], ['m', 'Meters'], ['km', 'Kilometers'], ['in', 'Inches'], ['ft', 'Feet'], ['yd', 'Yards'], ['mi', 'Miles'], ['pt', 'Points'], ['px', 'Pixels']];
const PT_PER: Record<DxfUnit, number> = { unitless: 1, in: 72, ft: 864, yd: 2592, mi: 4561920, mm: 72 / 25.4, cm: 72 / 2.54, m: 7200 / 2.54, km: 7200000 / 2.54, pt: 1, px: 1 };
const INSUNITS: Record<number, DxfUnit> = { 1: 'in', 2: 'ft', 3: 'mi', 4: 'mm', 5: 'cm', 6: 'm', 7: 'km', 10: 'yd' };
const INSUNITS_OUT: Partial<Record<DxfUnit, number>> = { in: 1, ft: 2, mi: 3, mm: 4, cm: 5, m: 6, km: 7, yd: 10, pt: 0, px: 0 };
export const ptPerUnit = (u: DxfUnit): number => PT_PER[u] ?? 1;

type Pair = [number, string];
interface Ent { type: string; c: Pair[] }
interface Layer { name: string; color: number; rgb: number | null; lw: number; off: boolean }
interface Block { name: string; base: Pt; ents: Ent[] }
export interface DxfFile { version: string; units: DxfUnit; metric: boolean; layers: Map<string, Layer>; styles: Map<string, string>; blocks: Map<string, Block>; ents: Ent[]; layouts: string[] }
export interface DxfImportOptions { units: DxfUnit; scale: number; layout: string; merge: boolean; fit: 'actual' | 'artboard' }

const g = (e: Ent, code: number, d = ''): string => { for (const [k, v] of e.c) if (k === code) return v; return d; };
const gn = (e: Ent, code: number, d = 0): number => { for (const [k, v] of e.c) if (k === code) { const n = parseFloat(v); return Number.isFinite(n) ? n : d; } return d; };
const has = (e: Ent, code: number): boolean => e.c.some(([k]) => k === code);

export function parseDxf(text: string): DxfFile {
  if (text.startsWith('AutoCAD Binary DXF')) throw new Error('This is a binary DXF. Save it as an ASCII DXF from your CAD program, then open it.');
  const lines = text.split(/\r\n|\r|\n/);
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (!Number.isFinite(code)) { i--; continue; }
    pairs.push([code, lines[i + 1].replace(/\s+$/, '')]);
  }
  if (!pairs.some(([k, v]) => k === 0 && v === 'SECTION')) throw new Error('This file is not a readable DXF.');
  const file: DxfFile = { version: '', units: 'unitless', metric: false, layers: new Map(), styles: new Map(), blocks: new Map(), ents: [], layouts: ['Model'] };
  let i = 0;
  const records = (from: number, to: number): Ent[] => {
    const out: Ent[] = [];
    let cur: Ent | null = null;
    for (let k = from; k < to; k++) {
      const [code, v] = pairs[k];
      if (code === 0) { cur = { type: v.trim().toUpperCase(), c: [] }; out.push(cur); }
      else cur?.c.push([code, v]);
    }
    return out;
  };
  while (i < pairs.length) {
    if (pairs[i][0] === 0 && pairs[i][1] === 'SECTION') {
      const name = pairs[i + 1]?.[1]?.trim().toUpperCase() ?? '';
      let j = i + 2;
      while (j < pairs.length && !(pairs[j][0] === 0 && pairs[j][1] === 'ENDSEC')) j++;
      if (name === 'HEADER') {
        for (let k = i + 2; k < j; k++) {
          const [code, v] = pairs[k];
          if (code !== 9) continue;
          const val = pairs[k + 1]?.[1] ?? '';
          if (v === '$ACADVER') file.version = val.trim();
          if (v === '$INSUNITS') file.units = INSUNITS[parseInt(val, 10)] ?? 'unitless';
          if (v === '$MEASUREMENT') file.metric = parseInt(val, 10) === 1;
        }
      } else if (name === 'TABLES') {
        for (const r of records(i + 2, j)) {
          if (r.type === 'LAYER') { const color = gn(r, 62, 7), flags = gn(r, 70, 0); file.layers.set(g(r, 2, '0'), { name: g(r, 2, '0'), color: Math.abs(color) || 7, rgb: has(r, 420) ? gn(r, 420) : null, lw: gn(r, 370, -3), off: color < 0 || (flags & 1) === 1 }); }
          if (r.type === 'STYLE') file.styles.set(g(r, 2, 'STANDARD').toUpperCase(), (g(r, 3, '') || g(r, 1000, '')).toLowerCase());
        }
      } else if (name === 'BLOCKS') {
        let cur: Block | null = null;
        for (const r of records(i + 2, j)) {
          if (r.type === 'BLOCK') { cur = { name: g(r, 2, g(r, 3, '')), base: { x: gn(r, 10), y: gn(r, 20) }, ents: [] }; continue; }
          if (r.type === 'ENDBLK') { if (cur) file.blocks.set(cur.name, cur); cur = null; continue; }
          cur?.ents.push(r);
        }
      } else if (name === 'ENTITIES') file.ents = records(i + 2, j);
      i = j + 1;
      continue;
    }
    i++;
  }
  const paper = new Set<string>();
  for (const e of file.ents) if (gn(e, 67, 0) === 1) paper.add(g(e, 410, 'Layout1'));
  file.layouts = ['Model', ...[...paper].sort()];
  return file;
}

const ACI_LOW = [0x000000, 0xff0000, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0xff00ff, 0x000000, 0x808080, 0xc0c0c0];
const ACI_GRAY = [0x333333, 0x505050, 0x696969, 0x828282, 0xbebebe, 0xffffff];
export function aciRgb(i: number): number {
  if (i < 10) return ACI_LOW[Math.max(0, i)];
  if (i >= 250) return ACI_GRAY[Math.min(5, i - 250)];
  const h = Math.floor((i - 10) / 10) * 15, r = (i - 10) % 10, v = [1, 1, 0.8, 0.8, 0.6, 0.6, 0.5, 0.5, 0.3, 0.3][r], s = r % 2 ? 0.5 : 1;
  const f = (n: number): number => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return (Math.round(f(5) * 255) << 16) | (Math.round(f(3) * 255) << 8) | Math.round(f(1) * 255);
}
const rgbColor = (n: number): Color => ({ kind: 'rgb', r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 });
export function nearestAci(c: Color): number {
  const v = toRgb(c);
  if (v.r + v.g + v.b < 24) return 7;
  let best = 7, bd = Infinity;
  for (let i = 1; i < 256; i++) {
    if (i === 7) continue;
    const n = aciRgb(i), d = ((n >> 16) & 255) - v.r, e = ((n >> 8) & 255) - v.g, f = (n & 255) - v.b, s = d * d * 2 + e * e * 4 + f * f * 3;
    if (s < bd) { bd = s; best = i; }
  }
  return best;
}

function bulgeArc(p0: Pt, p1: Pt, b: number): Anchor[] {
  const c = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  if (Math.abs(b) < 1e-9 || c < 1e-12) return [anchor(p1.x, p1.y)];
  const th = 4 * Math.atan(b), ux = (p1.x - p0.x) / c, uy = (p1.y - p0.y) / c, d = c / 2 / Math.tan(th / 2);
  const cx = (p0.x + p1.x) / 2 - uy * d, cy = (p0.y + p1.y) / 2 + ux * d, r = Math.hypot(p0.x - cx, p0.y - cy);
  const a0 = Math.atan2(p0.y - cy, p0.x - cx);
  return arcSegmentPath(cx, cy, r, r, a0, a0 + th);
}

function joinAnchors(pts: Anchor[], seq: Anchor[]): void {
  if (!pts.length) { pts.push(...seq.map((a) => ({ ...a }))); return; }
  const last = pts[pts.length - 1], first = seq[0];
  if (seq.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) < 1e-9) { last.ox = first.ox; last.oy = first.oy; pts.push(...seq.slice(1).map((a) => ({ ...a }))); }
  else pts.push(...seq.map((a) => ({ ...a })));
}

function polyPath(vs: Array<{ p: Pt; b: number }>, closed: boolean): SubPath | null {
  if (vs.length < 2 && !(vs.length === 1 && closed)) return null;
  const pts: Anchor[] = [anchor(vs[0].p.x, vs[0].p.y)];
  const n = closed ? vs.length : vs.length - 1;
  for (let k = 0; k < n; k++) {
    const a = vs[k], z = vs[(k + 1) % vs.length];
    const seq = bulgeArc(a.p, z.p, a.b);
    if (seq.length === 1) pts.push(seq[0]);
    else joinAnchors(pts, seq);
  }
  if (closed && pts.length > 1) { const a = pts[0], z = pts[pts.length - 1]; if (Math.hypot(a.x - z.x, a.y - z.y) < 1e-9) { a.ix = z.ix; a.iy = z.iy; pts.pop(); } }
  return { closed, pts };
}

function bspline(deg: number, knots: number[], ctrl: Pt[], weights: number[], closed: boolean, fit: Pt[]): SubPath | null {
  if (ctrl.length < 2) {
    if (fit.length < 2) return null;
    const pts: Anchor[] = fit.map((p) => anchor(p.x, p.y));
    for (let i = 0; i < fit.length; i++) {
      const a = fit[Math.max(0, i - 1)], b = fit[Math.min(fit.length - 1, i + 1)], tx = (b.x - a.x) / 6, ty = (b.y - a.y) / 6;
      pts[i].ix = fit[i].x - tx; pts[i].iy = fit[i].y - ty; pts[i].ox = fit[i].x + tx; pts[i].oy = fit[i].y + ty;
    }
    pts[0].ix = pts[0].x; pts[0].iy = pts[0].y; pts[pts.length - 1].ox = pts[pts.length - 1].x; pts[pts.length - 1].oy = pts[pts.length - 1].y;
    return { closed, pts };
  }
  const p = Math.max(1, deg), rational = weights.length === ctrl.length && weights.some((w) => Math.abs(w - weights[0]) > 1e-9);
  let U = knots.length === ctrl.length + p + 1 ? [...knots] : Array.from({ length: ctrl.length + p + 1 }, (_, i) => Math.max(0, Math.min(ctrl.length - p, i - p)));
  if (p > 3 || rational) {
    const w = weights.length === ctrl.length ? weights : ctrl.map(() => 1), lo = U[p], hi = U[ctrl.length], N = Math.max(32, ctrl.length * 12), out: Pt[] = [];
    for (let s = 0; s <= N; s++) {
      const t = lo + ((hi - lo) * s) / N;
      let k = p; while (k < ctrl.length - 1 && U[k + 1] <= t) k++;
      const d = Array.from({ length: p + 1 }, (_, j) => { const q = ctrl[k - p + j], ww = w[k - p + j]; return { x: q.x * ww, y: q.y * ww, w: ww }; });
      for (let r = 1; r <= p; r++) for (let j = p; j >= r; j--) { const i = k - p + j, den = U[i + p - r + 1] - U[i], a = den ? (t - U[i]) / den : 0; d[j] = { x: (1 - a) * d[j - 1].x + a * d[j].x, y: (1 - a) * d[j - 1].y + a * d[j].y, w: (1 - a) * d[j - 1].w + a * d[j].w }; }
      out.push({ x: d[p].x / d[p].w, y: d[p].y / d[p].w });
    }
    const span = Math.max(1e-9, Math.hypot(Math.max(...out.map((q) => q.x)) - Math.min(...out.map((q) => q.x)), Math.max(...out.map((q) => q.y)) - Math.min(...out.map((q) => q.y))));
    return { closed, pts: fitCurve(out, span * 1e-4) };
  }
  let P = ctrl.map((q) => ({ ...q }));
  const lo = U[p], hi = U[P.length];
  const insert = (u: number): void => {
    let k = p; while (k < P.length - 1 && U[k + 1] <= u) k++;
    const Q: Pt[] = [];
    for (let i = 0; i <= P.length; i++) {
      if (i <= k - p) Q.push(P[i]);
      else if (i <= k) { const den = U[i + p] - U[i], a = den ? (u - U[i]) / den : 0; Q.push({ x: (1 - a) * P[i - 1].x + a * P[i].x, y: (1 - a) * P[i - 1].y + a * P[i].y }); }
      else Q.push(P[i - 1]);
    }
    U = [...U.slice(0, k + 1), u, ...U.slice(k + 1)];
    P = Q;
  };
  const distinct = [...new Set(U.filter((u) => u >= lo && u <= hi))];
  for (const u of distinct) { let m = U.filter((x) => Math.abs(x - u) < 1e-12).length; while (m < p && P.length < 20000) { insert(u); m++; } }
  const pts: Anchor[] = [];
  for (let i = p; i < P.length; i++) {
    if (!(U[i] < U[i + 1]) || U[i] < lo - 1e-12 || U[i + 1] > hi + 1e-12) continue;
    const b = P.slice(i - p, i + 1);
    let c: Pt[];
    if (p === 1) c = [b[0], b[0], b[1], b[1]];
    else if (p === 2) c = [b[0], { x: b[0].x + (2 / 3) * (b[1].x - b[0].x), y: b[0].y + (2 / 3) * (b[1].y - b[0].y) }, { x: b[2].x + (2 / 3) * (b[1].x - b[2].x), y: b[2].y + (2 / 3) * (b[1].y - b[2].y) }, b[2]];
    else c = b;
    if (!pts.length) pts.push(anchor(c[0].x, c[0].y));
    const last = pts[pts.length - 1];
    last.ox = c[1].x; last.oy = c[1].y;
    pts.push({ x: c[3].x, y: c[3].y, ix: c[2].x, iy: c[2].y, ox: c[3].x, oy: c[3].y });
  }
  if (pts.length < 2) return null;
  const a = pts[0], z = pts[pts.length - 1];
  const shut = closed || Math.hypot(a.x - z.x, a.y - z.y) < 1e-9;
  if (shut && Math.hypot(a.x - z.x, a.y - z.y) < 1e-9) { a.ix = z.ix; a.iy = z.iy; pts.pop(); }
  return { closed: shut, pts };
}

function mtextPlain(s: string): string {
  return s.replace(/\\P/g, '\n').replace(/\\~/g, ' ').replace(/\\S([^;]*);/g, (_, x: string) => x.replace(/[#^]/g, '/'))
    .replace(/\\[fFHWQTACcp][^;]*;/g, '').replace(/\\[LlOoKkNX]/g, '').replace(/\\U\+([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\\/g, '\u0000').replace(/[{}]/g, '').replace(/\u0000/g, '\\');
}
const textPlain = (s: string): string => s.replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±').replace(/%%[uUoOkK]/g, '').replace(/%%%/g, '%').replace(/\\U\+([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));

function fontFrom(file: string): string {
  if (/times/.test(file)) return 'Times New Roman';
  if (/cour/.test(file)) return 'Courier New';
  if (/georgia/.test(file)) return 'Georgia';
  if (/verdana/.test(file)) return 'Verdana';
  return 'Arial';
}

interface Ctx { m: Mat; layer: string | null; color: Color | null; lw: number | null; depth: number }
interface Item { layer: string; node: VNode }

export function dxfToDoc(file: DxfFile, o: DxfImportOptions, title: string): { doc: Doc; skipped: string[] } {
  const skipped = new Map<string, number>();
  const skip = (t: string): void => { skipped.set(t, (skipped.get(t) ?? 0) + 1); };
  const items: Item[] = [];
  const layerOf = (e: Ent, ctx: Ctx): string => { const l = g(e, 8, '0'); return l === '0' && ctx.layer ? ctx.layer : l; };
  const colorOf = (e: Ent, ctx: Ctx): Color => {
    if (has(e, 420)) return rgbColor(gn(e, 420));
    const ci = has(e, 62) ? gn(e, 62, 256) : 256;
    if (ci === 0) return ctx.color ?? rgbColor(0);
    if (ci === 256 || ci < 0) { const L = file.layers.get(layerOf(e, ctx)); return L?.rgb !== null && L?.rgb !== undefined ? rgbColor(L.rgb) : rgbColor(aciRgb(L?.color ?? 7)); }
    return rgbColor(aciRgb(ci));
  };
  const weightOf = (e: Ent, ctx: Ctx): number => {
    let w = has(e, 370) ? gn(e, 370, -1) : -1;
    if (w === -2) w = ctx.lw ?? -3;
    if (w === -1) w = file.layers.get(layerOf(e, ctx))?.lw ?? -3;
    if (w < 0) w = 25;
    return Math.max(0.25, (w / 100) * (72 / 25.4));
  };
  const ocs = (e: Ent): Mat => (gn(e, 230, 1) < 0 ? [-1, 0, 0, 1, 0, 0] : [1, 0, 0, 1, 0, 0]);
  const push = (e: Ent, ctx: Ctx, d: PathData, mode: 'stroke' | 'fill' | 'both', extra?: { width?: number; even?: boolean; paint?: VNode['ap']['items'][number]['paint'] }): void => {
    if (!d.length) return;
    const m = mul(ctx.m, ocs(e)), dd = transformPath(d, m), col = colorOf(e, ctx), items0: VNode['ap']['items'] = [];
    if (mode !== 'stroke') items0.push(fillItem(extra?.paint ?? { type: 'color', color: col }));
    if (mode !== 'fill') items0.push(strokeItem({ type: 'color', color: col }, extra?.width && extra.width > 0 ? extra.width * matScale(m) : weightOf(e, ctx), { cap: 'round', join: 'round' }));
    items.push({ layer: layerOf(e, ctx), node: { id: newId('p'), kind: 'path', d: dd, rule: extra?.even ? 'evenodd' : 'nonzero', opacity: 1, blend: 'normal', ap: { items: items0, effects: [] } } });
  };
  const text = (e: Ent, ctx: Ctx, str: string, at: Pt, height: number, rot: number, align: 'left' | 'center' | 'right', hscale = 100): void => {
    if (!str.trim()) return;
    const style = (file.styles.get(g(e, 7, 'STANDARD').toUpperCase()) ?? '');
    const m = mul(ctx.m, ocs(e)), q = apply(m, at.x, at.y), s = matScale(m);
    const a = ((rot + matAngle(m)) * Math.PI) / 180, size = Math.max(0.5, (height * s) / 0.7);
    const xf: Mat = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), q.x, q.y];
    const node: TextNode = { id: newId('t'), kind: 'text', mode: 'point', spans: [{ text: str, style: { ...DEFAULT_CHAR, font: fontFrom(style), style: 'Regular', size, hscale, fill: { type: 'color', color: colorOf(e, ctx) } } }], para: { ...DEFAULT_PARA, align }, xf, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
    items.push({ layer: layerOf(e, ctx), node });
  };
  const inLayout = (e: Ent, top: boolean): boolean => {
    if (!top) return true;
    const paper = gn(e, 67, 0) === 1;
    return o.layout === 'Model' ? !paper : paper && g(e, 410, 'Layout1') === o.layout;
  };
  const run = (ents: Ent[], ctx: Ctx, top: boolean): void => {
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.type === 'SEQEND' || e.type === 'VERTEX' || e.type === 'ATTRIB') continue;
      if (!inLayout(e, top)) { if (e.type === 'POLYLINE' || e.type === 'INSERT') while (i + 1 < ents.length && ['VERTEX', 'SEQEND', 'ATTRIB'].includes(ents[i + 1].type)) i++; continue; }
      if (gn(e, 60, 0) === 1) continue;
      switch (e.type) {
        case 'LINE': push(e, ctx, [{ closed: false, pts: [anchor(gn(e, 10), gn(e, 20)), anchor(gn(e, 11), gn(e, 21))] }], 'stroke'); break;
        case 'LWPOLYLINE': {
          const vs: Array<{ p: Pt; b: number }> = [];
          let cur: { p: Pt; b: number } | null = null, x = 0;
          for (const [k, v] of e.c) {
            if (k === 10) { x = parseFloat(v); }
            else if (k === 20) { cur = { p: { x, y: parseFloat(v) }, b: 0 }; vs.push(cur); }
            else if (k === 42 && cur) cur.b = parseFloat(v) || 0;
          }
          const sp = polyPath(vs, (gn(e, 70, 0) & 1) === 1);
          if (sp) push(e, ctx, [sp], 'stroke', { width: gn(e, 43, 0) });
          break;
        }
        case 'POLYLINE': {
          const flags = gn(e, 70, 0), vs: Array<{ p: Pt; b: number }> = [];
          let j = i + 1;
          for (; j < ents.length && ents[j].type === 'VERTEX'; j++) { const vf = gn(ents[j], 70, 0); if ((vf & 16) === 16 || (vf & 128) === 128) continue; vs.push({ p: { x: gn(ents[j], 10), y: gn(ents[j], 20) }, b: gn(ents[j], 42, 0) }); }
          if (j < ents.length && ents[j].type === 'SEQEND') j++;
          i = j - 1;
          if ((flags & 16) || (flags & 64)) { skip('3D meshes'); break; }
          const sp = polyPath(vs, (flags & 1) === 1);
          if (sp) push(e, ctx, [sp], 'stroke', { width: gn(e, 40, 0) });
          break;
        }
        case 'CIRCLE': { const r = gn(e, 40); if (r > 0) push(e, ctx, ellipsePath(gn(e, 10) - r, gn(e, 20) - r, 2 * r, 2 * r), 'stroke'); break; }
        case 'ARC': {
          const r = gn(e, 40), a0 = gn(e, 50); let a1 = gn(e, 51, 360);
          while (a1 <= a0) a1 += 360;
          if (r > 0) push(e, ctx, [{ closed: false, pts: arcSegmentPath(gn(e, 10), gn(e, 20), r, r, (a0 * Math.PI) / 180, (a1 * Math.PI) / 180) }], 'stroke');
          break;
        }
        case 'ELLIPSE': {
          const cx = gn(e, 10), cy = gn(e, 20), ax = gn(e, 11), ay = gn(e, 21), ratio = gn(e, 40, 1), t0 = gn(e, 41, 0);
          let t1 = gn(e, 42, Math.PI * 2);
          while (t1 <= t0) t1 += Math.PI * 2;
          const full = Math.abs(t1 - t0 - Math.PI * 2) < 1e-6, M: Mat = [ax, ay, -ay * ratio, ax * ratio, cx, cy];
          push(e, ctx, full ? transformPath(ellipsePath(-1, -1, 2, 2), M) : transformPath([{ closed: false, pts: arcSegmentPath(0, 0, 1, 1, t0, t1) }], M), 'stroke');
          break;
        }
        case 'SPLINE': {
          const knots: number[] = [], ctrl: Pt[] = [], fit: Pt[] = [], w: number[] = [];
          let x = 0, fx = 0;
          for (const [k, v] of e.c) { if (k === 40) knots.push(parseFloat(v)); else if (k === 41) w.push(parseFloat(v)); else if (k === 10) x = parseFloat(v); else if (k === 20) ctrl.push({ x, y: parseFloat(v) }); else if (k === 11) fx = parseFloat(v); else if (k === 21) fit.push({ x: fx, y: parseFloat(v) }); }
          const sp = bspline(gn(e, 71, 3), knots, ctrl, w, (gn(e, 70, 0) & 1) === 1, fit);
          if (sp) push(e, ctx, [sp], 'stroke');
          break;
        }
        case 'SOLID': case 'TRACE': {
          const q = [0, 1, 3, 2].map((k) => ({ x: gn(e, 10 + k), y: gn(e, 20 + k) }));
          push(e, ctx, [{ closed: true, pts: q.map((p) => anchor(p.x, p.y)) }], 'fill');
          break;
        }
        case '3DFACE': push(e, ctx, [{ closed: true, pts: [0, 1, 2, 3].map((k) => anchor(gn(e, 10 + k), gn(e, 20 + k))) }], 'stroke'); break;
        case 'TEXT': case 'ATTDEF': {
          if (e.type === 'ATTDEF') break;
          const h = gn(e, 72, 0), v = gn(e, 73, 0), height = gn(e, 40, 2.5), useAlign = (h !== 0 || v !== 0) && has(e, 11);
          const at = useAlign ? { x: gn(e, 11), y: gn(e, 21) } : { x: gn(e, 10), y: gn(e, 20) };
          const dy = v === 2 ? -height / 2 : v === 3 ? -height : v === 1 ? height * 0.25 : 0;
          const rot = gn(e, 50, 0), ra = (rot * Math.PI) / 180;
          text(e, ctx, textPlain(g(e, 1)), { x: at.x - Math.sin(ra) * dy, y: at.y + Math.cos(ra) * dy }, height, rot, h === 1 || h === 4 ? 'center' : h === 2 ? 'right' : 'left', Math.round(gn(e, 41, 1) * 100));
          break;
        }
        case 'MTEXT': {
          const body = mtextPlain(e.c.filter(([k]) => k === 3).map(([, v]) => v).join('') + g(e, 1)), height = gn(e, 40, 2.5), att = gn(e, 71, 1);
          const rot = has(e, 50) ? gn(e, 50) : has(e, 11) ? (Math.atan2(gn(e, 21), gn(e, 11)) * 180) / Math.PI : 0;
          const lines = body.split('\n'), pitch = height * (5 / 3) * gn(e, 44, 1), total = height + pitch * (lines.length - 1);
          const row = Math.floor((att - 1) / 3), col = (att - 1) % 3, ra = (rot * Math.PI) / 180;
          const fb = row === 0 ? -height : row === 1 ? total / 2 - height : pitch * (lines.length - 1);
          text(e, ctx, lines.join('\n'), { x: gn(e, 10) - Math.sin(ra) * fb, y: gn(e, 20) + Math.cos(ra) * fb }, height, rot, col === 1 ? 'center' : col === 2 ? 'right' : 'left');
          break;
        }
        case 'HATCH': {
          const d: PathData = [], c = e.c;
          let k = c.findIndex(([code]) => code === 91);
          const loops = k >= 0 ? parseInt(c[k][1], 10) : 0;
          k++;
          const next = (code: number): number => { while (k < c.length && c[k][0] !== code) k++; return k < c.length ? parseFloat(c[k++][1]) : 0; };
          for (let L = 0; L < loops && k < c.length; L++) {
            const type = next(92);
            if (type & 2) {
              const hb = next(72); next(73);
              const n = next(93), vs: Array<{ p: Pt; b: number }> = [];
              for (let v = 0; v < n; v++) { const x = next(10), y = next(20); let b = 0; if (hb && c[k]?.[0] === 42) b = parseFloat(c[k++][1]) || 0; vs.push({ p: { x, y }, b }); }
              const sp = polyPath(vs, true);
              if (sp) d.push(sp);
            } else {
              const n = next(93), pts: Anchor[] = [];
              for (let ed = 0; ed < n; ed++) {
                const et = next(72);
                if (et === 1) { const a = { x: next(10), y: next(20) }, b = { x: next(11), y: next(21) }; joinAnchors(pts, [anchor(a.x, a.y), anchor(b.x, b.y)]); }
                else if (et === 2) { const cx = next(10), cy = next(20), r = next(40), a0 = next(50), a1 = next(51), ccw = next(73); let s = (a0 * Math.PI) / 180, t = (a1 * Math.PI) / 180; if (!ccw) { s = -s; t = -t; } while (ccw ? t <= s : t >= s) t += ccw ? Math.PI * 2 : -Math.PI * 2; joinAnchors(pts, arcSegmentPath(cx, cy, r, r, s, t)); }
                else if (et === 3) { const cx = next(10), cy = next(20), ax = next(11), ay = next(21), ratio = next(40), a0 = next(50), a1 = next(51), ccw = next(73); let s = (a0 * Math.PI) / 180, t = (a1 * Math.PI) / 180; if (!ccw) { s = -s; t = -t; } while (ccw ? t <= s : t >= s) t += ccw ? Math.PI * 2 : -Math.PI * 2; joinAnchors(pts, transformPath([{ closed: false, pts: arcSegmentPath(0, 0, 1, 1, s, t) }], [ax, ay, -ay * ratio, ax * ratio, cx, cy])[0].pts); }
                else if (et === 4) {
                  const deg = next(94); next(73); next(74); const nk = next(95), nc = next(96), kn: number[] = [], cp: Pt[] = [], ws: number[] = [];
                  for (let q = 0; q < nk; q++) kn.push(next(40));
                  for (let q = 0; q < nc; q++) { const x = next(10), y = next(20); cp.push({ x, y }); if (c[k]?.[0] === 42) ws.push(parseFloat(c[k++][1])); }
                  if (c[k]?.[0] === 97) { const nf = parseInt(c[k++][1], 10); for (let q = 0; q < nf; q++) { next(11); next(21); } }
                  const sp = bspline(deg, kn, cp, ws, false, []);
                  if (sp) joinAnchors(pts, sp.pts);
                }
              }
              if (pts.length > 1) { const a = pts[0], z = pts[pts.length - 1]; if (Math.hypot(a.x - z.x, a.y - z.y) < 1e-9) { a.ix = z.ix; a.iy = z.iy; pts.pop(); } d.push({ closed: true, pts }); }
            }
            if (c[k]?.[0] === 97) { const ns = parseInt(c[k++][1], 10); for (let q = 0; q < ns && c[k]?.[0] === 330; q++) k++; }
          }
          if (!d.length) { skip('hatches without boundaries'); break; }
          let paint: VNode['ap']['items'][number]['paint'] | undefined;
          if (gn(e, 450, 0) === 1) {
            const cols = e.c.filter(([code]) => code === 421).map(([, v]) => rgbColor(parseInt(v, 10)));
            const aci = e.c.filter(([code]) => code === 63).map(([, v]) => rgbColor(aciRgb(parseInt(v, 10))));
            const cs = cols.length >= 2 ? cols : aci.length >= 2 ? aci : [];
            if (cs.length >= 2) {
              const m = mul(ctx.m, ocs(e)), dd = transformPath(d, m);
              let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
              for (const sp of dd) for (const a of sp.pts) { x0 = Math.min(x0, a.x); x1 = Math.max(x1, a.x); y0 = Math.min(y0, a.y); y1 = Math.max(y1, a.y); }
              const ang = gn(e, 460, 0) + Math.atan2(m[1], m[0]), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, half = (Math.abs((x1 - x0) * Math.cos(ang)) + Math.abs((y1 - y0) * Math.sin(ang))) / 2;
              paint = { type: 'gradient', gradient: { ...linearGradient([stop(0, cs[0]), stop(1, cs[1])]), geom: { x1: cx - Math.cos(ang) * half, y1: cy - Math.sin(ang) * half, x2: cx + Math.cos(ang) * half, y2: cy + Math.sin(ang) * half } } };
            }
          }
          push(e, ctx, d, 'fill', { even: true, paint });
          break;
        }
        case 'LEADER': {
          const pts: Anchor[] = []; let x = 0;
          for (const [kk, v] of e.c) { if (kk === 10) x = parseFloat(v); else if (kk === 20) pts.push(anchor(x, parseFloat(v))); }
          if (pts.length > 1) push(e, ctx, [{ closed: false, pts }], 'stroke');
          break;
        }
        case 'INSERT': case 'DIMENSION': {
          const name = g(e, 2), b = file.blocks.get(name);
          let j = i + 1;
          const attribs: Ent[] = [];
          if (e.type === 'INSERT') { for (; j < ents.length && ents[j].type === 'ATTRIB'; j++) attribs.push(ents[j]); if (j < ents.length && ents[j].type === 'SEQEND' && attribs.length) j++; i = j - 1; }
          if (!b || ctx.depth > 16) { if (!b) skip('missing blocks'); break; }
          const sub: Ctx = { m: ctx.m, layer: layerOf(e, ctx), color: colorOf(e, ctx), lw: weightOf(e, ctx) * (100 / (72 / 25.4)), depth: ctx.depth + 1 };
          if (e.type === 'DIMENSION') { run(b.ents, { ...sub, m: mul(ctx.m, ocs(e)) }, false); break; }
          const sx = gn(e, 41, 1), sy = gn(e, 42, sx), rot = (gn(e, 50, 0) * Math.PI) / 180, cols = Math.max(1, gn(e, 70, 1)), rows = Math.max(1, gn(e, 71, 1)), dx = gn(e, 44, 0), dy = gn(e, 45, 0);
          for (let r = 0; r < Math.min(rows, 200); r++) for (let cI = 0; cI < Math.min(cols, 200); cI++) {
            const R: Mat = [Math.cos(rot), Math.sin(rot), -Math.sin(rot), Math.cos(rot), 0, 0];
            const local = mul(mul(mul([1, 0, 0, 1, gn(e, 10), gn(e, 20)], R), [1, 0, 0, 1, cI * dx, r * dy]), mul([sx, 0, 0, sy, 0, 0], [1, 0, 0, 1, -b.base.x, -b.base.y]));
            run(b.ents, { ...sub, m: mul(mul(ctx.m, ocs(e)), local) }, false);
          }
          for (const at of attribs) if ((gn(at, 70, 0) & 1) === 0) { const h = gn(at, 72, 0), useAlign = h !== 0 && has(at, 11); text(at, ctx, textPlain(g(at, 1)), useAlign ? { x: gn(at, 11), y: gn(at, 21) } : { x: gn(at, 10), y: gn(at, 20) }, gn(at, 40, 2.5), gn(at, 50, 0), h === 1 || h === 4 ? 'center' : h === 2 ? 'right' : 'left'); }
          break;
        }
        case 'POINT': skip('points'); break;
        case 'VIEWPORT': break;
        case 'IMAGE': skip('raster images'); break;
        default: skip(e.type.toLowerCase());
      }
    }
  };
  run(file.ents, { m: [1, 0, 0, 1, 0, 0], layer: null, color: null, lw: null, depth: 0 }, true);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (p: Pt): void => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); };
  for (const it of items) { if (it.node.kind === 'path') for (const sp of it.node.d) for (const a of sp.pts) grow(a); else if (it.node.kind === 'text') {
      const q = it.node.xf, s = it.node.spans[0].style.size, rows = it.node.spans[0].text.split('\n'), w = s * 0.55 * Math.max(...rows.map((x) => x.length)), al = it.node.para.align, x0r = al === 'center' ? -w / 2 : al === 'right' ? -w : 0;
      for (const [u, v] of [[x0r, -s * 0.25 - (rows.length - 1) * s * 1.2], [x0r + w, -s * 0.25 - (rows.length - 1) * s * 1.2], [x0r, s * 0.75], [x0r + w, s * 0.75]]) grow({ x: q[4] + q[0] * u + q[2] * v, y: q[5] + q[1] * u + q[3] * v });
    } }
  if (!Number.isFinite(x0)) { x0 = 0; y0 = 0; x1 = 100; y1 = 100; }
  const W = Math.max(1e-6, x1 - x0), H = Math.max(1e-6, y1 - y0);
  const k = o.fit === 'artboard' ? Math.min(612 / W, 792 / H) * 0.9 : ptPerUnit(o.units) * o.scale;
  const toDoc: Mat = [k, 0, 0, -k, -x0 * k, y1 * k];
  const abW = o.fit === 'artboard' ? 612 : Math.max(1, W * k), abH = o.fit === 'artboard' ? 792 : Math.max(1, H * k);
  const shift: Mat = o.fit === 'artboard' ? [1, 0, 0, 1, (612 - W * k) / 2, (792 - H * k) / 2] : [1, 0, 0, 1, 0, 0];
  const M = mul(shift, toDoc);
  const place = (n: VNode): VNode => {
    if (n.kind === 'path') return { ...n, d: transformPath(n.d, M) };
    if (n.kind === 'text') {
      const s = n.spans[0], q = apply(M, n.xf[4], n.xf[5]), a = Math.atan2(n.xf[1], n.xf[0]);
      return { ...n, spans: [{ ...s, style: { ...s.style, size: s.style.size * k } }], xf: [Math.cos(a), -Math.sin(a), Math.sin(a), Math.cos(a), q.x, q.y] };
    }
    return n;
  };
  const doc = newDoc(abW, abH, { title, units: o.units === 'mm' || o.units === 'cm' || o.units === 'in' || o.units === 'pt' || o.units === 'px' ? o.units : 'pt' });
  const order = [...file.layers.keys()];
  for (const it of items) if (!order.includes(it.layer)) order.push(it.layer);
  const base = doc.layers[0];
  if (o.merge) doc.layers = [{ ...base, name: title || 'Layer 1', children: items.map((it) => place(it.node)) }];
  else {
    const layers: LayerNode[] = [];
    order.forEach((name) => {
      const kids = items.filter((it) => it.layer === name).map((it) => place(it.node));
      if (!kids.length) return;
      const L = file.layers.get(name), rgb = L ? (L.rgb ?? aciRgb(L.color)) : 0x4f80ff;
      layers.push({ ...base, id: newId('l'), name, children: kids, color: `#${(rgb === 0 ? 0x4f80ff : rgb).toString(16).padStart(6, '0')}`, ...(L?.off ? { hidden: true } : {}) });
    });
    doc.layers = layers.length ? layers : [base];
  }
  return { doc, skipped: [...skipped.entries()].map(([t, n]) => `${n} ${t}`) };
}

export interface DxfExportOptions { region: Rect; version: 'R12' | '2000'; units: DxfUnit; scale: number; text: 'text' | 'outlines'; lineweights: boolean; ids?: string[] }

const STD_LW = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];
const r6 = (v: number): string => { const r = Math.round(v * 1e6) / 1e6; return Object.is(r, -0) ? '0.0' : Number.isInteger(r) ? `${r}.0` : String(r); };
const layerName = (s: string): string => (s || 'Layer').replace(/[<>/\\":;?*|=`,]/g, '_').slice(0, 255);

interface Shape { layer: string; d: PathData; stroke: { color: Color; width: number } | null; fill: Color | null; even: boolean }
interface Label { layer: string; lines: Array<{ text: string; at: Pt; height: number; rot: number }>; color: Color }

function arcOf(s: Seg): { bulge: number } | null {
  const [p0, , , p3] = s, q = (t: number): Pt => { const u = 1 - t; return { x: u * u * u * s[0].x + 3 * u * u * t * s[1].x + 3 * u * t * t * s[2].x + t * t * t * s[3].x, y: u * u * u * s[0].y + 3 * u * u * t * s[1].y + 3 * u * t * t * s[2].y + t * t * t * s[3].y }; };
  const m = q(0.5), ax = p0.x, ay = p0.y, bx = m.x, by = m.y, cx = p3.x, cy = p3.y;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-12) return null;
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d, uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const r = Math.hypot(ax - ux, ay - uy), tol = Math.max(1e-6, r * 1e-3);
  for (const t of [0.15, 0.3, 0.7, 0.85]) { const p = q(t); if (Math.abs(Math.hypot(p.x - ux, p.y - uy) - r) > tol) return null; }
  const a0 = Math.atan2(ay - uy, ax - ux), am = Math.atan2(by - uy, bx - ux), a1 = Math.atan2(cy - uy, cx - ux);
  const norm = (v: number): number => { while (v <= -Math.PI) v += 2 * Math.PI; while (v > Math.PI) v -= 2 * Math.PI; return v; };
  const h1 = norm(am - a0), h2 = norm(a1 - am), th = h1 + h2;
  if (Math.sign(h1) !== Math.sign(h2) || Math.abs(th) > Math.PI * 1.01) return null;
  return { bulge: Math.tan(th / 4) };
}

class DxfWriter {
  private out: string[] = [];
  private hn = 0x20;
  constructor(readonly v2000: boolean) {}
  h(): string { this.hn++; return this.hn.toString(16).toUpperCase(); }
  get seed(): string { return (this.hn + 1).toString(16).toUpperCase(); }
  get last(): string { return this.hn.toString(16).toUpperCase(); }
  p(code: number, v: string | number): void { this.out.push(String(code), typeof v === 'number' ? r6(v) : v); }
  i(code: number, v: number): void { this.out.push(String(code), String(Math.round(v))); }
  text(): string { return `${this.out.join('\n')}\n`; }
  mark(): number { return this.out.length; }
  splice(at: number, lines: string[]): void { this.out.splice(at, 0, ...lines); }
}

export async function exportDxf(p: Project, o: DxfExportOptions, outline: (n: TextNode) => Promise<PathData | null>): Promise<Blob> {
  const doc = p.doc, r = o.region, k = o.scale / ptPerUnit(o.units);
  const X = (x: number): number => (x - r.x) * k, Y = (y: number): number => (r.y + r.h - y) * k;
  const toD: Mat = [k, 0, 0, -k, -r.x * k, (r.y + r.h) * k];
  const shapes: Shape[] = [], labels: Label[] = [];
  const only = o.ids ? new Set(o.ids) : null;
  const solidOf = (raw: VNode['ap']['items'][number]['paint']): Color | null => { const q = resolvePaint(doc, raw); return q.type === 'color' ? q.color : q.type === 'gradient' && q.gradient.stops.length ? gradientAt(q.gradient, 0.5).color : null; };
  const visit = async (n: VNode, layer: string, inside: boolean): Promise<void> => {
    if (n.hidden) return;
    if (n.ap.effects.length) n = fxNode(doc, n) ?? n;
    if (n.kind === 'layer') { if (n.template) return; for (const c of n.children) await visit(c, layerName(n.name ?? 'Layer'), inside); return; }
    const on = inside || !only || only.has(n.id);
    const faces = has3d(n) ? threeDFaces(doc, n) : null;
    if (faces) { for (const c of faces) await visit(c, layer, on); return; }
    switch (n.kind) {
      case 'group': {
        const list = n.livePaint ? [...liveFaceNodes(n), ...n.children] : (n.shaper || n.intertwine || isLive(n)) ? derivedArt(n) ?? [] : n.children;
        for (const c of list) await visit(c, layer, on);
        return;
      }
      case 'blend': case 'envelope': case 'repeat': for (const c of liveChildren(doc, n)) await visit(c, layer, on); return;
      case 'symbol': { const art = instanceArt(doc, n); if (!art) return; const moved = transformArt(art, n.xf); await visit(moved, layer, on); return; }
      case 'path': case 'compound': {
        if (!on || (n.kind === 'path' && n.guide)) return;
        const d = effectPath(n.kind === 'path' ? n.d : n.children.flatMap((c) => c.d), n.ap.effects);
        const st = n.ap.items.find((i) => i.visible && i.kind === 'stroke' && i.width > 0);
        const fi = n.ap.items.find((i) => i.visible && i.kind === 'fill' && i.paint.type !== 'none');
        const sc = st ? solidOf(st.paint) : null, fc = fi ? solidOf(fi.paint) : null;
        shapes.push({ layer, d, stroke: st && sc ? { color: sc, width: st.kind === 'stroke' ? st.width : 1 } : null, fill: fc, even: n.rule === 'evenodd' });
        return;
      }
      case 'text': {
        if (!on) return;
        const fillC = n.spans[0] ? solidOf(n.spans[0].style.fill) ?? { kind: 'rgb', r: 0, g: 0, b: 0 } as Color : { kind: 'rgb', r: 0, g: 0, b: 0 } as Color;
        if (o.text === 'outlines' || n.mode === 'path') { const d = await outline(n); if (d) shapes.push({ layer, d, stroke: null, fill: fillC, even: false }); return; }
        const lay = layoutText(n), lines: Label['lines'] = [];
        for (const ln of lay.lines) {
          const t = ln.glyphs.map((gl) => gl.ch).join('').replace(/\s+$/, '');
          if (!t || !ln.glyphs.length) continue;
          const at = apply(n.xf, ln.glyphs[0].x, ln.y);
          lines.push({ text: t, at, height: (ln.glyphs[0].size ?? 12) * 0.7 * matScale(n.xf), rot: -matAngle(n.xf) });
        }
        if (lines.length) labels.push({ layer, lines, color: fillC });
        return;
      }
      default: return;
    }
  };
  for (const l of doc.layers) await visit(l, layerName(l.name ?? 'Layer'), false);
  const layers = [...new Set(['0', ...doc.layers.map((l) => layerName(l.name ?? 'Layer'))])];
  const hidden = new Set(doc.layers.filter((l) => l.hidden).map((l) => layerName(l.name ?? 'Layer')));
  const w = new DxfWriter(o.version === '2000');
  const v2 = o.version === '2000';
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes) for (const sp of s.d) for (const a of sp.pts) { x0 = Math.min(x0, X(a.x)); x1 = Math.max(x1, X(a.x)); y0 = Math.min(y0, Y(a.y)); y1 = Math.max(y1, Y(a.y)); }
  if (!Number.isFinite(x0)) { x0 = 0; y0 = 0; x1 = r.w * k; y1 = r.h * k; }
  const lwOf = (pt: number): number => { const mm = (pt * 25.4) / 72 * (o.lineweights ? o.scale : 1) * 100; let best = 0; for (const v of STD_LW) if (Math.abs(v - mm) < Math.abs(best - mm)) best = v; return best; };
  const ents: Array<() => void> = [];
  let ms = '', ps = '';
  const head = (type: string, layer: string, c: Color | null, lw: number | null, sub: string): void => {
    w.p(0, type);
    if (v2) { w.p(5, w.h()); w.p(330, ms); w.p(100, 'AcDbEntity'); }
    w.p(8, layer);
    if (c) { w.i(62, nearestAci(c)); if (v2) { const v = toRgb(c); w.i(420, (v.r << 16) | (v.g << 8) | v.b); } }
    if (v2 && lw !== null) w.i(370, lw);
    if (v2 && sub) w.p(100, sub);
  };
  const subpathOut = (s: Shape, sp: SubPath): void => {
    const segs = segments(sp), pts = sp.pts.map((a) => ({ x: X(a.x), y: Y(a.y) }));
    const dsegs: Seg[] = segs.map((g2) => g2.map((q) => ({ x: X(q.x), y: Y(q.y) })) as Seg);
    const arcs = dsegs.map((sg) => (isLineSeg(sg) ? { bulge: 0 } : arcOf(sg)));
    const color = s.stroke?.color ?? s.fill, lw = s.stroke ? lwOf(s.stroke.width) : null;
    const straightish = arcs.every((a) => a !== null);
    if (v2 && !straightish) {
      ents.push(() => {
        head('SPLINE', s.layer, color, lw, 'AcDbSpline');
        w.p(210, 0); w.p(220, 0); w.p(230, 1);
        const ctrl: Pt[] = [dsegs[0][0]];
        for (const sg of dsegs) { if (isLineSeg(sg)) ctrl.push({ x: sg[0].x + (sg[3].x - sg[0].x) / 3, y: sg[0].y + (sg[3].y - sg[0].y) / 3 }, { x: sg[0].x + (2 * (sg[3].x - sg[0].x)) / 3, y: sg[0].y + (2 * (sg[3].y - sg[0].y)) / 3 }, sg[3]); else ctrl.push(sg[1], sg[2], sg[3]); }
        const n = dsegs.length, knots = [0, 0, 0, 0];
        for (let i2 = 1; i2 < n; i2++) knots.push(i2, i2, i2);
        knots.push(n, n, n, n);
        w.i(70, 8); w.i(71, 3); w.i(72, knots.length); w.i(73, ctrl.length); w.i(74, 0);
        w.p(42, 1e-10); w.p(43, 1e-10);
        for (const kv of knots) w.p(40, kv);
        for (const c2 of ctrl) { w.p(10, c2.x); w.p(20, c2.y); w.p(30, 0); }
      });
      return;
    }
    const verts: Array<{ p: Pt; b: number }> = [];
    if (straightish) pts.forEach((pt, i2) => verts.push({ p: pt, b: i2 < arcs.length ? (arcs[i2] as { bulge: number }).bulge : 0 }));
    else { const flat: Pt[] = []; for (let i2 = 0; i2 < dsegs.length; i2++) { if (arcs[i2]) { if (!flat.length) flat.push(dsegs[i2][0]); flat.push(dsegs[i2][3]); } else flattenSeg(dsegs[i2], 0.05 * Math.max(1e-6, k), flat, flat.length === 0); } if (sp.closed && flat.length > 1 && Math.hypot(flat[0].x - flat[flat.length - 1].x, flat[0].y - flat[flat.length - 1].y) < 1e-9) flat.pop(); flat.forEach((q) => verts.push({ p: q, b: 0 })); }
    if (!sp.closed && verts.length) verts[verts.length - 1].b = 0;
    if (v2) ents.push(() => {
      head('LWPOLYLINE', s.layer, color, lw, 'AcDbPolyline');
      w.i(90, verts.length); w.i(70, sp.closed ? 1 : 0);
      for (const vv of verts) { w.p(10, vv.p.x); w.p(20, vv.p.y); if (Math.abs(vv.b) > 1e-12) w.p(42, vv.b); }
    });
    else ents.push(() => {
      head('POLYLINE', s.layer, color, null, ''); w.i(66, 1); w.p(10, 0); w.p(20, 0); w.p(30, 0); w.i(70, sp.closed ? 1 : 0);
      for (const vv of verts) { w.p(0, 'VERTEX'); w.p(8, s.layer); w.p(10, vv.p.x); w.p(20, vv.p.y); w.p(30, 0); if (Math.abs(vv.b) > 1e-12) w.p(42, vv.b); }
      w.p(0, 'SEQEND'); w.p(8, s.layer);
    });
  };
  for (const s of shapes) {
    if (v2 && s.fill) {
      const loops = s.d.filter((sp) => sp.pts.length > 1).map((sp) => { const flat: Pt[] = []; for (const sg of segments(sp)) flattenSeg(sg.map((q) => ({ x: X(q.x), y: Y(q.y) })) as Seg, 0.05 * Math.max(1e-6, k), flat, flat.length === 0); return flat; });
      if (loops.length) ents.push(() => {
        head('HATCH', s.layer, s.fill, null, 'AcDbHatch');
        w.p(10, 0); w.p(20, 0); w.p(30, 0); w.p(210, 0); w.p(220, 0); w.p(230, 1);
        w.p(2, 'SOLID'); w.i(70, 1); w.i(71, 0); w.i(91, loops.length);
        for (const L of loops) { w.i(92, 3); w.i(72, 0); w.i(73, 1); w.i(93, L.length); for (const q of L) { w.p(10, q.x); w.p(20, q.y); } w.i(97, 0); }
        w.i(75, s.even ? 0 : 1); w.i(76, 1); w.i(98, 0);
      });
    }
    if (s.stroke || !s.fill || !v2) for (const sp of s.d) if (sp.pts.length > 1) subpathOut(s, sp);
  }
  for (const L of labels) for (const ln of L.lines) ents.push(() => {
    head('TEXT', L.layer, L.color, null, 'AcDbText');
    w.p(10, X(ln.at.x)); w.p(20, Y(ln.at.y)); w.p(30, 0); w.p(40, Math.max(1e-6, ln.height * k)); w.p(1, ln.text.replace(/[\r\n]/g, ' '));
    if (Math.abs(ln.rot) > 1e-6) w.p(50, ln.rot);
    w.p(7, v2 ? 'Standard' : 'STANDARD');
    if (v2) w.p(100, 'AcDbText');
  });
  w.p(0, 'SECTION'); w.p(2, 'HEADER');
  w.p(9, '$ACADVER'); w.p(1, v2 ? 'AC1015' : 'AC1009');
  if (v2) { w.p(9, '$DWGCODEPAGE'); w.p(3, 'ANSI_1252'); }
  w.p(9, '$INSBASE'); w.p(10, 0); w.p(20, 0); w.p(30, 0);
  w.p(9, '$EXTMIN'); w.p(10, x0); w.p(20, y0); w.p(30, 0);
  w.p(9, '$EXTMAX'); w.p(10, x1); w.p(20, y1); w.p(30, 0);
  w.p(9, '$LIMMIN'); w.p(10, 0); w.p(20, 0);
  w.p(9, '$LIMMAX'); w.p(10, r.w * k); w.p(20, r.h * k);
  w.p(9, '$MEASUREMENT'); w.i(70, ['mm', 'cm', 'm', 'km'].includes(o.units) ? 1 : 0);
  if (v2) { w.p(9, '$INSUNITS'); w.i(70, INSUNITS_OUT[o.units] ?? 0); w.p(9, '$LWDISPLAY'); w.i(290, 1); }
  const seedAt = w.mark();
  w.p(0, 'ENDSEC');
  if (v2) { w.p(0, 'SECTION'); w.p(2, 'CLASSES'); w.p(0, 'ENDSEC'); }
  w.p(0, 'SECTION'); w.p(2, 'TABLES');
  const table = (name: string, count: number, rows: () => void, sub = ''): void => {
    w.p(0, 'TABLE'); w.p(2, name);
    let th = '';
    if (v2) { th = w.h(); w.p(5, th); w.p(330, '0'); w.p(100, 'AcDbSymbolTable'); }
    w.i(70, count);
    if (v2 && sub) w.p(100, sub);
    tableHandle = th;
    rows();
    w.p(0, 'ENDTAB');
  };
  let tableHandle = '';
  const rec = (type: string, sub: string): void => { w.p(0, type); if (v2) { w.p(type === 'DIMSTYLE' ? 105 : 5, w.h()); w.p(330, tableHandle); w.p(100, 'AcDbSymbolTableRecord'); w.p(100, sub); } };
  if (v2) table('VPORT', 1, () => { rec('VPORT', 'AcDbViewportTableRecord'); w.p(2, '*Active'); w.i(70, 0); w.p(10, 0); w.p(20, 0); w.p(11, 1); w.p(21, 1); w.p(12, (x0 + x1) / 2); w.p(22, (y0 + y1) / 2); w.p(40, Math.max(1, y1 - y0) * 1.1); w.p(41, Math.max(0.1, (x1 - x0) / Math.max(1e-6, y1 - y0))); });
  const ltypes = v2 ? ['ByBlock', 'ByLayer', 'Continuous'] : ['CONTINUOUS'];
  table('LTYPE', ltypes.length, () => { for (const lt of ltypes) { rec('LTYPE', 'AcDbLinetypeTableRecord'); w.p(2, lt); w.i(70, 0); w.p(3, lt === 'Continuous' || lt === 'CONTINUOUS' ? 'Solid line' : ''); w.i(72, 65); w.i(73, 0); w.p(40, 0); } });
  table('LAYER', layers.length, () => { for (const name of layers) { rec('LAYER', 'AcDbLayerTableRecord'); w.p(2, name); w.i(70, 0); w.i(62, hidden.has(name) ? -7 : 7); w.p(6, v2 ? 'Continuous' : 'CONTINUOUS'); if (v2) { w.i(370, -3); w.p(390, '0'); } } });
  table('STYLE', 1, () => { rec('STYLE', 'AcDbTextStyleTableRecord'); w.p(2, v2 ? 'Standard' : 'STANDARD'); w.i(70, 0); w.p(40, 0); w.p(41, 1); w.p(50, 0); w.i(71, 0); w.p(42, 2.5); w.p(3, v2 ? 'arial.ttf' : 'txt'); w.p(4, ''); });
  if (v2) {
    table('VIEW', 0, () => undefined);
    table('UCS', 0, () => undefined);
    table('APPID', 1, () => { rec('APPID', 'AcDbRegAppTableRecord'); w.p(2, 'ACAD'); w.i(70, 0); });
    table('DIMSTYLE', 1, () => { rec('DIMSTYLE', 'AcDbDimStyleTableRecord'); w.p(2, 'Standard'); w.i(70, 0); }, 'AcDbDimStyleTable');
    table('BLOCK_RECORD', 2, () => { rec('BLOCK_RECORD', 'AcDbBlockTableRecord'); ms = w.last; w.p(2, '*Model_Space'); rec('BLOCK_RECORD', 'AcDbBlockTableRecord'); ps = w.last; w.p(2, '*Paper_Space'); });
  }
  w.p(0, 'ENDSEC');
  w.p(0, 'SECTION'); w.p(2, 'BLOCKS');
  if (v2) for (const [name, owner] of [['*Model_Space', ms], ['*Paper_Space', ps]]) {
    w.p(0, 'BLOCK'); w.p(5, w.h()); w.p(330, owner); w.p(100, 'AcDbEntity'); if (name === '*Paper_Space') w.i(67, 1); w.p(8, '0'); w.p(100, 'AcDbBlockBegin'); w.p(2, name); w.i(70, 0); w.p(10, 0); w.p(20, 0); w.p(30, 0); w.p(3, name); w.p(1, '');
    w.p(0, 'ENDBLK'); w.p(5, w.h()); w.p(330, owner); w.p(100, 'AcDbEntity'); if (name === '*Paper_Space') w.i(67, 1); w.p(8, '0'); w.p(100, 'AcDbBlockEnd');
  }
  w.p(0, 'ENDSEC');
  w.p(0, 'SECTION'); w.p(2, 'ENTITIES');
  for (const e of ents) e();
  w.p(0, 'ENDSEC');
  if (v2) {
    w.p(0, 'SECTION'); w.p(2, 'OBJECTS');
    const root = w.h(), grp = w.h();
    w.p(0, 'DICTIONARY'); w.p(5, root); w.p(330, '0'); w.p(100, 'AcDbDictionary'); w.i(281, 1); w.p(3, 'ACAD_GROUP'); w.p(350, grp);
    w.p(0, 'DICTIONARY'); w.p(5, grp); w.p(330, root); w.p(100, 'AcDbDictionary'); w.i(281, 1);
    w.p(0, 'ENDSEC');
    w.splice(seedAt, ['9', '$HANDSEED', '5', w.seed]);
  }
  w.p(0, 'EOF');
  return new Blob([w.text().replace(/\n/g, '\r\n')], { type: 'application/dxf' });
}

function transformArt(n: VNode, m: Mat): VNode {
  switch (n.kind) {
    case 'path': return { ...n, d: transformPath(n.d, m) };
    case 'compound': return { ...n, children: n.children.map((c) => ({ ...c, d: transformPath(c.d, m) })) };
    case 'text': case 'image': case 'symbol': return { ...n, xf: mul(m, n.xf) };
    default: { const kids = childrenOf(n); return kids ? { ...n, children: kids.map((c) => transformArt(c, m)) } as VNode : n; }
  }
}
