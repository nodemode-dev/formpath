import { newId } from './doc';
import { arrowGeometry, profileAt, strokeOutline } from './effects';
import { anchor, dist, flattenSeg, pointInPolygon, segments } from './geometry';
import { boolean, strokeToPath } from './kernel';
import { emptyAppearance, fill, gradientAt, resolvePaint, rgb } from './paint';
import type { Doc, FillRule, Gradient, GradientStop, Paint, PathData, Pt, StrokeItem, SubPath, VNode } from './types';

export interface StrokePiece { d: PathData; paint: Paint }
export interface GradientStrokeArt { pieces: StrokePiece[]; alpha: StrokePiece[] | null; arrows: StrokePiece[] }

export function strokeGradient(doc: Doc | null | undefined, s: StrokeItem): Gradient | null {
  if (s.brush || s.width <= 0 || s.paint.type !== 'gradient') return null;
  const p = doc ? resolvePaint(doc, s.paint) : s.paint;
  if (p.type !== 'gradient') return null;
  const g = p.gradient;
  return g.kind !== 'freeform' && g.stops.length > 0 && (g.strokeMode === 'along' || g.strokeMode === 'across') ? g : null;
}

interface ArtEntry { d: PathData; rule: FillRule; g: Gradient; art: GradientStrokeArt }
const artCache = new WeakMap<SubPath, WeakMap<StrokeItem, ArtEntry>>();
const sameSubs = (a: PathData, b: PathData): boolean => a === b || (a.length === b.length && a.every((sp, i) => sp === b[i]));

export function gradientStrokeArt(doc: Doc | null | undefined, d: PathData, s: StrokeItem, rule: FillRule = 'nonzero'): GradientStrokeArt | null {
  const g = strokeGradient(doc, s);
  if (!g || !d.length) return null;
  let m = artCache.get(d[0]);
  if (!m) { m = new WeakMap(); artCache.set(d[0], m); }
  const hit = m.get(s);
  if (hit && hit.rule === rule && sameSubs(hit.d, d) && (hit.g === g || (hit.g.stops === g.stops && hit.g.strokeMode === g.strokeMode))) return hit.art;
  const art = buildArt(d, s, g, rule);
  m.set(s, { d, rule, g, art });
  return art;
}

const shift = (p: Pt, t: Pt, k: number): Pt => ({ x: p.x + t.x * k, y: p.y + t.y * k });

function linear(stops: GradientStop[], a: Pt, b: Pt): Paint {
  const e = dist(a, b) < 1e-3 ? { x: a.x + 1e-3, y: a.y } : b;
  return { type: 'gradient', gradient: { kind: 'linear', stops, angle: 0, aspect: 1, geom: { x1: a.x, y1: a.y, x2: e.x, y2: e.y } } };
}

const opaqueStops = (st: GradientStop[]): GradientStop[] => st.map((x) => ({ ...x, opacity: 1 }));
const alphaStops = (st: GradientStop[]): GradientStop[] => st.map((x) => { const v = Math.round(Math.max(0, Math.min(1, x.opacity)) * 255); return { ...x, color: rgb(v, v, v), opacity: 1 }; });

function subStops(g: Gradient, t0: number, t1: number): GradientStop[] {
  const at = (t: number, offset: number): GradientStop => { const c = gradientAt(g, t); return { offset, color: c.color, opacity: c.opacity, mid: 0.5 }; };
  const span = t1 - t0;
  if (span <= 1e-9) return [at(t0, 0), at(t0, 1)];
  const ts = [t0, t1], sorted = [...g.stops].sort((a, b) => a.offset - b.offset);
  sorted.forEach((st, i) => {
    if (st.offset > t0 && st.offset < t1) ts.push(st.offset);
    const nx = sorted[i + 1];
    if (nx && Math.abs(st.mid - 0.5) > 0.01) for (let k = 1; k < 8; k++) { const t = st.offset + ((nx.offset - st.offset) * k) / 8; if (t > t0 && t < t1) ts.push(t); }
  });
  return [...new Set(ts)].sort((a, b) => a - b).map((t) => at(t, (t - t0) / span));
}

function flat(sp: SubPath, tol: number): { P: Pt[]; closed: boolean } {
  const raw: Pt[] = [];
  segments(sp).forEach((sg, i) => flattenSeg(sg, tol, raw, i === 0));
  const P: Pt[] = [];
  for (const p of raw) if (!P.length || dist(P[P.length - 1], p) > 1e-6) P.push(p);
  if (sp.closed && P.length > 2 && dist(P[0], P[P.length - 1]) < 1e-6) P.pop();
  return { P, closed: sp.closed && P.length > 2 };
}

const poly = (pts: Pt[]): PathData => [{ closed: true, pts: pts.map((q) => anchor(q.x, q.y)) }];
const solidStops = (g: Gradient, t: number): GradientStop[] => { const c = gradientAt(g, Math.max(0, Math.min(1, t))); return [{ offset: 0, color: c.color, opacity: c.opacity, mid: 0.5 }, { offset: 1, color: c.color, opacity: c.opacity, mid: 0.5 }]; };

function buildArt(d: PathData, s: StrokeItem, g: Gradient, rule: FillRule): GradientStrokeArt {
  const along = g.strokeMode === 'along', hw = s.width / 2, prof = s.profile && s.profile.length ? s.profile : null;
  const aligned = !prof && s.align !== 'center' && d.every((sp) => sp.closed);
  const translucent = g.stops.some((x) => x.opacity < 1);
  const tol = Math.min(0.35, Math.max(0.05, hw / 30)), margin = 1 + hw * 0.1, ends = (prof || s.cap === 'butt' ? 0 : hw) + margin;
  const pieces: StrokePiece[] = [], alpha: StrokePiece[] = [], arrows: StrokePiece[] = [];
  const put = (pd: PathData, st: GradientStop[], mk: (x: GradientStop[]) => Paint): void => {
    pieces.push({ d: pd, paint: mk(translucent ? opaqueStops(st) : st) });
    if (translucent) alpha.push({ d: pd, paint: mk(alphaStops(st)) });
  };
  const polys = d.map((sp) => flat(sp, tol));
  const inside = (q: Pt): boolean => { let w = 0; for (const f of polys) if (f.P.length > 2) w += pointInPolygon(q, f.P); return rule === 'evenodd' ? (w & 1) === 1 : w !== 0; };
  const open = d.find((sp) => !sp.closed && sp.pts.length > 1);
  d.forEach((sp, si) => {
    const { P, closed } = polys[si];
    if (P.length < 2) return;
    const n = closed ? P.length : P.length - 1;
    const dir: Pt[] = [], len: number[] = [], cum = [0];
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % P.length], l = Math.max(1e-9, dist(a, b));
      dir.push({ x: (b.x - a.x) / l, y: (b.y - a.y) / l });
      len.push(l);
      cum.push(cum[i] + l);
    }
    const total = Math.max(1e-9, cum[n]);
    const nrm = (i: number): Pt => ({ x: -dir[i].y, y: dir[i].x });
    let plus = 0;
    if (aligned) { const a = P[0], b = P[1], q = { x: (a.x + b.x) / 2 + nrm(0).x * 1e-3, y: (a.y + b.y) / 2 + nrm(0).y * 1e-3 }; plus = (s.align === 'inside') === inside(q) ? 1 : -1; }
    const band = (v: number): [number, number] => {
      if (prof) { const w = profileAt(prof, cum[v] / total); return [hw * w.l, -hw * w.r]; }
      return plus > 0 ? [s.width, 0] : plus < 0 ? [0, -s.width] : [hw, -hw];
    };
    const wedge = (v: number, i0: number, i1: number): void => {
      const p = P[v % P.length], A = dir[i0], B = dir[i1], cr = A.x * B.y - A.y * B.x, th = Math.atan2(Math.abs(cr), A.x * B.x + A.y * B.y);
      if (th < 1e-4) return;
      const sg = cr > 0 ? -1 : 1, sense = cr > 0 ? 1 : -1, [hi, lo] = band(v);
      const R = (sg > 0 ? Math.max(0, hi) : Math.max(0, -lo)) + margin, pad = 0.03;
      const a0 = Math.atan2(A.x * sg, -A.y * sg) - pad * sense, span = th + 2 * pad, at = (ang: number, r: number): Pt => ({ x: p.x + Math.cos(ang) * r, y: p.y + Math.sin(ang) * r });
      const mk = 1 / Math.cos(th / 2);
      let ring: Pt[];
      if (s.join === 'miter' && mk <= s.miter) ring = [at(a0, R), at(a0 + (span / 2) * sense, R * mk * 1.02 + margin), at(a0 + span * sense, R)];
      else {
        const m = 2 * Math.max(1, Math.ceil(span / (Math.PI / 4))), step = span / m, rr = R / Math.cos(step / 2);
        ring = [];
        for (let k = 0; k <= m; k++) ring.push(at(a0 + step * k * sense, rr));
      }
      const pts = [p, ...ring], solid = (x: GradientStop[]): Paint => ({ type: 'color', color: x[0].color });
      if (along && v === n && closed) { const h = (ring.length - 1) / 2; put(poly([p, ...ring.slice(0, h + 1)]), solidStops(g, 1), solid); put(poly([p, ...ring.slice(h)]), solidStops(g, 0), solid); return; }
      if (along) { put(poly(pts), solidStops(g, cum[v] / total), solid); return; }
      const reach = Math.max(...pts.map((q) => dist(q, p))), span2 = hi - lo, K = 16;
      const st: GradientStop[] = [];
      for (let k = 0; k <= K; k++) { const u = k / K, t = span2 > 1e-9 ? (hi - sg * u * reach) / span2 : 0.5, c = gradientAt(g, Math.max(0, Math.min(1, t))); st.push({ offset: u, color: c.color, opacity: c.opacity, mid: 0.5 }); }
      put(poly(pts), st, (x) => ({ type: 'gradient', gradient: { kind: 'radial', stops: x, angle: 0, aspect: 1, geom: { x1: p.x, y1: p.y, x2: p.x + Math.max(1e-3, reach), y2: p.y } } }));
    };
    const seam = closed && along ? (() => { const u = nrm(n - 1), w = nrm(0), bx = u.x + w.x, by = u.y + w.y, bl = Math.hypot(bx, by); if (bl < 1e-6) return { b: w, k: 1 }; const b = { x: bx / bl, y: by / bl }; return { b, k: Math.min(20, 1 / Math.max(0.05, b.x * w.x + b.y * w.y)) }; })() : null;
    let first: Paint | null = null, last: Paint | null = null;
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % P.length], t = dir[i], nn = nrm(i), [hA, lA] = band(i), [hB, lB] = band(i + 1);
      const back = i === 0 ? (closed ? Math.min(0.9 * len[n - 1], Math.max(1, hw * 0.25)) : ends) : 0, ov = !closed && i === n - 1 ? ends : closed && i === n - 1 ? 0 : Math.min(0.9 * len[i + 1], Math.max(1, hw * 0.25));
      const a0 = shift(a, t, -back), b1 = shift(b, t, ov), eps = Math.min(0.5, 0.25 * len[0]);
      const start = seam && i === 0 ? [shift(shift(a, seam.b, (hA + margin) * seam.k), t, -eps), shift(shift(a, seam.b, (lA - margin) * seam.k), t, -eps)] : [shift(a0, nn, hA + margin), shift(a0, nn, lA - margin)];
      const end = seam && i === n - 1 ? [shift(b, seam.b, (hB + margin) * seam.k), shift(b, seam.b, (lB - margin) * seam.k)] : [shift(b1, nn, hB + margin), shift(b1, nn, lB - margin)];
      const quad = poly([start[0], end[0], end[1], start[1]]);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, hi = (hA + hB) / 2, lo = (lA + lB) / 2;
      const ends2: [Pt, Pt] = along ? [a, b] : [{ x: mx + nn.x * hi, y: my + nn.y * hi }, { x: mx + nn.x * lo, y: my + nn.y * lo }];
      const st = along ? subStops(g, cum[i] / total, cum[i + 1] / total) : g.stops;
      put(quad, st, (x) => linear(x, ends2[0], ends2[1]));
      const raw = linear(st, ends2[0], ends2[1]);
      first ??= raw;
      last = raw;
      if (i < n - 1) wedge(i + 1, i, i + 1);
      else if (closed) wedge(n, n - 1, 0);
    }
    if (sp === open && first && last) {
      const head = arrowGeometry(d, { ...s, endArrow: 'none' }), tail = arrowGeometry(d, { ...s, startArrow: 'none' });
      if (head) arrows.push({ d: head, paint: first });
      if (tail) arrows.push({ d: tail, paint: last });
    }
  });
  return { pieces, alpha: translucent ? alpha : null, arrows };
}

export function dashPath(d: PathData, dash: number[], offset: number): PathData {
  const pattern = dash.length % 2 ? [...dash, ...dash] : dash;
  const total = pattern.reduce((a, b) => a + b, 0);
  if (total <= 0) return d;
  const out: PathData = [];
  for (const sp of d) {
    const segsPts = (() => { const arr: Array<{ x: number; y: number }> = []; const n = sp.pts.length; for (let i = 0; i < (sp.closed ? n : n - 1); i++) { const a = sp.pts[i], b = sp.pts[(i + 1) % n]; for (let k = 0; k <= 16; k++) { const t = k / 16, u = 1 - t; if (i > 0 && k === 0) continue; arr.push({ x: u * u * u * a.x + 3 * u * u * t * a.ox + 3 * u * t * t * b.ix + t * t * t * b.x, y: u * u * u * a.y + 3 * u * u * t * a.oy + 3 * u * t * t * b.iy + t * t * t * b.y }); } } return arr; })();
    const pos = -((offset % total) + total) % total;
    let k = 0, on = true;
    let cur: Array<{ x: number; y: number }> = [];
    let left = pattern[0] + pos;
    while (left <= 0) { k = (k + 1) % pattern.length; on = !on; left += pattern[k]; }
    for (let i = 1; i < segsPts.length; i++) {
      let a = segsPts[i - 1];
      const b = segsPts[i];
      let segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (on && !cur.length) cur.push(a);
      while (segLen > left) {
        const t = left / segLen, m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        if (on) { cur.push(m); out.push({ closed: false, pts: cur.map((p) => ({ x: p.x, y: p.y, ix: p.x, iy: p.y, ox: p.x, oy: p.y })) }); cur = []; }
        else cur = [m];
        segLen -= left; a = m;
        k = (k + 1) % pattern.length; on = !on; left = pattern[k];
      }
      left -= segLen;
      if (on) cur.push(b);
    }
    if (on && cur.length > 1) out.push({ closed: false, pts: cur.map((p) => ({ x: p.x, y: p.y, ix: p.x, iy: p.y, ox: p.x, oy: p.y })) });
  }
  return out;
}

export function strokeRegion(d: PathData, rule: FillRule, s: StrokeItem): PathData {
  if (!d.length) return [];
  if (s.profile && s.profile.length) return strokeOutline(d, s);
  const dashed = s.dash.length ? dashPath(d, s.dash, s.dashOffset) : d;
  const outline = strokeToPath(dashed, s.width * (s.align === 'center' ? 1 : 2), s.cap, s.join, s.miter);
  if (s.align === 'center' || !d.every((sp) => sp.closed)) return outline;
  return s.align === 'inside' ? boolean(outline, d, 'intersect', 'nonzero', rule) : boolean(outline, d, 'subtract', 'nonzero', rule);
}

export function gradientStrokeNodes(art: GradientStrokeArt, region: PathData, s: StrokeItem, name?: string): VNode[] {
  if (!region.length || !art.pieces.length) return [];
  const shape = (p: StrokePiece): VNode => ({ id: newId('p'), kind: 'path', d: p.d, rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [fill(p.paint)], effects: [] } });
  const clip = (): VNode => ({ id: newId('p'), kind: 'path', d: region, rule: 'nonzero', opacity: 1, blend: 'normal', ap: emptyAppearance() });
  const body: VNode = { id: newId('g'), kind: 'group', clip: true, children: [...art.pieces.map(shape), clip()], opacity: 1, blend: 'normal', ap: emptyAppearance(), name: name ?? 'Gradient Stroke' };
  if (art.alpha) body.mask = { art: { id: newId('g'), kind: 'group', clip: true, children: [...art.alpha.map(shape), clip()], opacity: 1, blend: 'normal', ap: emptyAppearance() }, clip: true, invert: false, disabled: false, linked: true };
  if (!art.arrows.length && s.opacity === 1 && s.blend === 'normal') return [body];
  return [{ id: newId('g'), kind: 'group', clip: false, children: [body, ...art.arrows.map(shape)], opacity: s.opacity, blend: s.blend, ap: emptyAppearance(), name: name ?? 'Gradient Stroke' }];
}
