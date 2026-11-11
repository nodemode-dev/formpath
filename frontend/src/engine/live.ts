import { geomBounds } from './bounds';
import { childrenOf, cloneNode } from './doc';
import { envelopeOptions, fidelityTol, localAffine, mapPathAdaptive, meshCurves, meshMapper, meshOutline, segsToSub } from './envelope';
import { anchor, apply, bezSplit, dist, emptyRect, flattenSub, isEmptyRect, isLineSeg, pathBounds, pathLength, pointAtLength, rotateAbout, reflectAbout, segLength, segOf, segTAtLength, segments, translate, unionRect } from './geometry';
import { expandAppearance } from './ops/expand';
import { fill, mixColor, resolvePaint, stroke, toRgb } from './paint';
import { instanceArt } from './symbolism';
import { textEpoch, textOutlineRuns } from './text';
import { transformNode } from './transform';
import type { Anchor, Appearance, AppearanceItem, BlendNode, Color, Doc, EnvelopeNode, EnvelopeOptions, Gradient, Paint, PathData, Pt, Rect, RepeatNode, SubPath, VNode } from './types';

const cache = new WeakMap<VNode, VNode[]>();
const envCache = new WeakMap<VNode, { epoch: number; symbols: Doc['symbols']; out: VNode[] }>();

export function liveChildren(doc: Doc, n: VNode): VNode[] {
  if (n.kind !== 'blend' && n.kind !== 'envelope' && n.kind !== 'repeat') return childrenOf(n) ?? [];
  if (n.kind === 'envelope') {
    const e = envCache.get(n), epoch = textEpoch();
    if (e && e.epoch === epoch && e.symbols === doc.symbols) return e.out;
    let out: VNode[];
    try { out = envelopeContent(doc, n); } catch { out = n.children; }
    envCache.set(n, { epoch, symbols: doc.symbols, out });
    return out;
  }
  const hit = cache.get(n);
  if (hit) return hit;
  let out: VNode[];
  try {
    out = n.kind === 'blend' ? blendSteps(doc, n) : repeatInstances(n);
  } catch { out = n.children; }
  cache.set(n, out);
  return out;
}

function quickBounds(n: VNode): Rect {
  if (n.kind === 'path') return pathBounds(n.d);
  const ch = childrenOf(n);
  if (ch) return ch.reduce((r, c) => unionRect(r, quickBounds(c)), emptyRect());
  if (n.kind === 'image' || n.kind === 'symbol' || n.kind === 'text') return { x: n.xf[4], y: n.xf[5], w: 1, h: 1 };
  return emptyRect();
}

export function repeatInstances(n: RepeatNode): VNode[] {
  const s = n.spec, src = n.children;
  const b = src.reduce((r, c) => unionRect(r, quickBounds(c)), emptyRect());
  const out: VNode[] = [];
  const place = (m: Parameters<typeof transformNode>[1], k: number): void => { for (const c of src) out.push(k === 0 ? c : { ...transformNode(c, m), id: `${c.id}~${k}` }); };
  if (s.kind === 'radial') {
    const span = s.end - s.start, step = Math.abs(span) >= 359.999 ? span / s.instances : span / Math.max(1, s.instances - 1);
    const order = [...Array(s.instances).keys()];
    if (s.reverse) order.reverse();
    for (const i of order) place(rotateAbout(s.start + step * i, s.cx, s.cy), i);
  } else if (s.kind === 'grid') {
    let k = 0;
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
      let m = translate(c * (b.w + s.hs), r * (b.h + s.vs));
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (s.flipCols && c % 2 === 1) m = mulM(m, reflectAbout('horizontal', cx, cy));
      if (s.flipRows && r % 2 === 1) m = mulM(m, reflectAbout('vertical', cx, cy));
      place(m, k++);
    }
  } else {
    place(translate(0, 0), 0);
    const r = rotateAbout(-s.angle, s.cx, s.cy), back = rotateAbout(s.angle, s.cx, s.cy);
    place(mulM(back, mulM(reflectAbout('horizontal', s.cx, s.cy), r)), 1);
  }
  return out;
}
function mulM(a: Parameters<typeof transformNode>[1], b: Parameters<typeof transformNode>[1]): Parameters<typeof transformNode>[1] {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

function stops(sp: SubPath): number[] {
  const n = sp.pts.length, lens = segments(sp).map((s) => segLength(s)), total = lens.reduce((a, b) => a + b, 0);
  if (total < 1e-9) return sp.pts.map((_, i) => i / (sp.closed ? n : Math.max(1, n - 1)));
  const out = [0];
  for (let i = 0, acc = 0; i < n - 1; i++) { acc += lens[i]; out.push(acc / total); }
  return out;
}
function withStops(sp: SubPath, extra: number[]): SubPath {
  const n = sp.pts.length, segN = sp.closed ? n : n - 1;
  if (!extra.length || n < 2) return sp;
  const own = stops(sp), pts: Anchor[] = sp.pts.map((a) => ({ ...a })), out: Anchor[] = [];
  for (let i = 0; i < n; i++) {
    if (i >= segN) { out.push(pts[i]); continue; }
    const j = (i + 1) % n, u0 = own[i], u1 = j === 0 ? 1 : own[j];
    const cuts = extra.filter((u) => u > u0 + 1e-9 && u < u1 - 1e-9).sort((x, y) => x - y);
    if (!cuts.length) { out.push(pts[i]); continue; }
    let seg = segOf(pts[i], pts[j]), head = pts[i], used = 0;
    const L = segLength(seg);
    if (isLineSeg(seg)) {
      const a = pts[i], z = pts[j];
      out.push({ ...a, ox: a.x, oy: a.y });
      for (const u of cuts) { const f = (u - u0) / (u1 - u0); out.push(anchor(a.x + (z.x - a.x) * f, a.y + (z.y - a.y) * f)); }
      if (j === 0) out[0] = { ...out[0], ix: out[0].x, iy: out[0].y }; else pts[j] = { ...pts[j], ix: pts[j].x, iy: pts[j].y };
      continue;
    }
    for (const u of cuts) {
      const want = ((u - u0) / (u1 - u0)) * L - used, [l, r] = bezSplit(seg, Math.min(1 - 1e-4, Math.max(1e-4, segTAtLength(seg, want))));
      out.push({ ...head, ox: l[1].x, oy: l[1].y });
      head = { x: l[3].x, y: l[3].y, ix: l[2].x, iy: l[2].y, ox: r[1].x, oy: r[1].y };
      used += want; seg = r;
    }
    out.push(head);
    if (j === 0) out[0] = { ...out[0], ix: seg[2].x, iy: seg[2].y }; else pts[j] = { ...pts[j], ix: seg[2].x, iy: seg[2].y };
  }
  return { closed: sp.closed, pts: out };
}
function corresponding(a: SubPath, b: SubPath): [SubPath, SubPath] {
  const pa = stops(a), pb = stops(b), has = (list: number[], u: number): boolean => list.some((x) => Math.abs(x - u) < 1e-9);
  const A = withStops(a, pb.filter((u) => !has(pa, u))), B = withStops(b, pa.filter((u) => !has(pb, u)));
  const pad = (s: SubPath, count: number): SubPath => (s.pts.length >= count ? s : { closed: s.closed, pts: [...s.pts, ...Array.from({ length: count - s.pts.length }, () => ({ ...s.pts[s.pts.length - 1] }))] });
  const count = Math.max(A.pts.length, B.pts.length);
  return [pad(A, count), pad(B, count)];
}
function alignStart(a: SubPath, b: SubPath): SubPath {
  const mid = (s: SubPath): Pt => ({ x: s.pts.reduce((m, p) => m + p.x, 0) / s.pts.length, y: s.pts.reduce((m, p) => m + p.y, 0) / s.pts.length });
  const ca = mid(a), cb = mid(b), want = Math.atan2(a.pts[0].y - ca.y, a.pts[0].x - ca.x);
  let best = 0, gap = Infinity;
  b.pts.forEach((p, i) => { let d = Math.abs(Math.atan2(p.y - cb.y, p.x - cb.x) - want); if (d > Math.PI) d = 2 * Math.PI - d; if (d < gap - 1e-9) { gap = d; best = i; } });
  return rotateTo(b, best);
}
function signedAreaSub(sp: SubPath): number {
  const p = flattenSub(sp, 1);
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a.x * b.y - b.x * a.y; }
  return s / 2;
}
function rotateTo(sp: SubPath, k: number): SubPath { if (!sp.closed || !k) return sp; return { closed: true, pts: [...sp.pts.slice(k), ...sp.pts.slice(0, k)] }; }
function reverseSub(sp: SubPath): SubPath { return { closed: sp.closed, pts: [...sp.pts].reverse().map((a) => ({ x: a.x, y: a.y, ix: a.ox, iy: a.oy, ox: a.ix, oy: a.iy })) }; }

export function pairPaths(a: PathData, b: PathData): [PathData, PathData] {
  const n = Math.max(a.length, b.length);
  const A: PathData = [], B: PathData = [];
  for (let i = 0; i < n; i++) {
    const sa = a[i] ?? collapse(b[i]);
    let sb = b[i] ?? collapse(a[i]);
    if (sa.closed && sb.closed && sa.pts.length > 2 && sb.pts.length > 2) {
      if (Math.sign(signedAreaSub(sa)) !== Math.sign(signedAreaSub(sb))) sb = reverseSub(sb);
      sb = alignStart(sa, sb);
    }
    const [x, y] = corresponding(sa, sb);
    A.push(x); B.push(y);
  }
  return [A, B];
}
function collapse(sp: SubPath): SubPath {
  const b = pathBounds([sp]), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  return { closed: sp.closed, pts: sp.pts.map(() => anchor(cx, cy)) };
}
export function lerpPaths(a: PathData, b: PathData, t: number): PathData {
  const L = (x: number, y: number): number => x + (y - x) * t;
  return a.map((sa, i) => ({ closed: sa.closed, pts: sa.pts.map((p, j) => { const q = b[i].pts[j]; return { x: L(p.x, q.x), y: L(p.y, q.y), ix: L(p.ix, q.ix), iy: L(p.iy, q.iy), ox: L(p.ox, q.ox), oy: L(p.oy, q.oy) }; }) }));
}
function lerpPaint(a: Paint, b: Paint, t: number): Paint {
  if (a.type === 'color' && b.type === 'color') return { type: 'color', color: mixColor(a.color, b.color, t) };
  if (a.type === 'gradient' && b.type === 'gradient' && a.gradient.stops.length === b.gradient.stops.length) {
    return { type: 'gradient', gradient: { ...a.gradient, angle: a.gradient.angle + (b.gradient.angle - a.gradient.angle) * t, geom: null, stops: a.gradient.stops.map((s, i) => ({ ...s, offset: s.offset + (b.gradient.stops[i].offset - s.offset) * t, color: mixColor(s.color, b.gradient.stops[i].color, t), opacity: s.opacity + (b.gradient.stops[i].opacity - s.opacity) * t })) } };
  }
  if (a.type === 'none' && b.type === 'color') return t < 0.5 ? a : b;
  return t < 0.5 ? a : b;
}
function lerpItems(a: AppearanceItem[], b: AppearanceItem[], t: number): AppearanceItem[] {
  return a.map((ia, i) => {
    const ib = b[i];
    if (!ib || ib.kind !== ia.kind) return ia;
    if (ia.kind === 'fill' && ib.kind === 'fill') return { ...ia, paint: lerpPaint(ia.paint, ib.paint, t), opacity: ia.opacity + (ib.opacity - ia.opacity) * t };
    if (ia.kind === 'stroke' && ib.kind === 'stroke') return { ...ia, paint: lerpPaint(ia.paint, ib.paint, t), width: ia.width + (ib.width - ia.width) * t, opacity: ia.opacity + (ib.opacity - ia.opacity) * t };
    return ia;
  });
}
function geometryOf(n: VNode): PathData | null { return n.kind === 'path' ? n.d : n.kind === 'compound' ? n.children.flatMap((c) => c.d) : null; }
function lab(c: Color): [number, number, number] {
  const v = toRgb(c), lin = (k: number): number => { const s = k / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }, r = lin(v.r), g = lin(v.g), b = lin(v.b);
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
function smoothSteps(doc: Doc, a: VNode, b: VNode): number {
  const col = (n: VNode): Color | null => { const f = n.ap.items.find((i) => i.kind === 'fill'); const p = f ? resolvePaint(doc, f.paint) : null; return p && p.type === 'color' ? p.color : null; };
  const x = col(a), y = col(b);
  if (!x || !y) return 24;
  const p = lab(x), q = lab(y), dE = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  return Math.max(1, Math.min(220, Math.round(dE / 1.15)));
}
function center(n: VNode): Pt { const b = quickBounds(n); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }

export function blendSteps(doc: Doc, n: BlendNode): VNode[] {
  const keys = n.children;
  if (keys.length < 2) return keys;
  const out: VNode[] = [];
  const spine = n.spec.spine?.[0] ?? null;
  const spineLen = spine ? pathLength(spine) : 0;
  const centers = keys.map(center);
  const totalPairs = keys.length - 1;
  for (let k = 0; k < totalPairs; k++) {
    const a = keys[k], b = keys[k + 1];
    out.push(a);
    let steps = n.spec.steps;
    if (n.spec.spacing === 'smooth') steps = smoothSteps(doc, a, b);
    else if (n.spec.spacing === 'distance') steps = Math.max(1, Math.min(1000, Math.floor(dist(centers[k], centers[k + 1]) / Math.max(0.1, n.spec.distance)) - 1));
    const ga = geometryOf(a), gb = geometryOf(b);
    const paired = ga && gb ? pairPaths(ga, gb) : null;
    for (let s = 1; s <= steps; s++) {
      const t = s / (steps + 1);
      let step: VNode;
      if (paired) {
        const d = lerpPaths(paired[0], paired[1], t);
        step = { id: `${n.id}~${k}~${s}`, kind: 'path', d, rule: a.kind === 'compound' ? a.rule : (a as { rule?: 'nonzero' | 'evenodd' }).rule ?? 'nonzero', opacity: a.opacity + (b.opacity - a.opacity) * t, blend: a.blend, ap: { items: lerpItems(a.ap.items, b.ap.items, t), effects: a.ap.effects } };
      } else {
        const ca = centers[k], cb = centers[k + 1];
        step = { ...transformNode(cloneNode(a), translate((cb.x - ca.x) * t, (cb.y - ca.y) * t)), id: `${n.id}~${k}~${s}` };
      }
      if (spine && spineLen > 0) {
        const total = (k + t) / totalPairs, at = pointAtLength(spine, total * spineLen), c = center(step);
        let m = translate(at.p.x - c.x, at.p.y - c.y);
        if (n.spec.alignToPath) m = mulM(rotateAbout((Math.atan2(at.tangent.y, at.tangent.x) * 180) / Math.PI, at.p.x, at.p.y), m);
        step = transformNode(step, m);
      }
      out.push(step);
    }
  }
  out.push(keys[keys.length - 1]);
  if (spine && spineLen > 0) {
    return out.map((node, i) => {
      if (i !== 0 && i !== out.length - 1) return node;
      const at = pointAtLength(spine, i === 0 ? 0 : spineLen), c = center(node);
      return transformNode(node, translate(at.p.x - c.x, at.p.y - c.y));
    });
  }
  return out;
}

export function warpPoint(style: string, bend: number, hd: number, vd: number, vertical: boolean, r: Rect, p: Pt): Pt {
  if (r.w < 1e-9 || r.h < 1e-9) return p;
  let u = ((p.x - r.x) / r.w) * 2 - 1, v = ((p.y - r.y) / r.h) * 2 - 1;
  if (vertical) [u, v] = [v, u];
  const b = bend / 100, bell = (x: number): number => Math.cos((Math.PI / 2) * Math.max(-1, Math.min(1, x)));
  const ease = (e0: number, e1: number, x: number): number => { const k = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
  const down = (v + 1) / 2, up = 1 - down;
  let du = 0, dv = 0;
  switch (style) {
    case 'arc': {
      if (Math.abs(b) < 1e-4) break;
      const k = vertical ? r.w / r.h : r.h / r.w, half = Math.abs(b) * (Math.PI / 2.4), R = 1 / Math.sin(half), th = u * half, rad = R - (b > 0 ? v : -v) * k;
      const x = rad * Math.sin(th), y = (R * Math.cos(half) - rad * Math.cos(th)) / k;
      du = x - u; dv = (b > 0 ? y : -y) - v;
      break;
    }
    case 'arc_lower': dv = 0.85 * b * bell(u) * down * down; break;
    case 'arc_upper': dv = -0.85 * b * bell(u) * up * up; break;
    case 'arch': dv = -0.7 * b * bell(u) * (0.35 + 0.65 * up); break;
    case 'bulge': dv = 0.5 * b * bell(u) * Math.sin((Math.PI / 2) * v); break;
    case 'shell_lower': du = -0.3 * b * u * up * up; dv = 0.75 * b * bell(u) * down ** 1.5; break;
    case 'shell_upper': du = -0.3 * b * u * down * down; dv = -0.75 * b * bell(u) * up ** 1.5; break;
    case 'flag': dv = 1.25 * b * u * (1 - u * u); break;
    case 'wave': dv = 0.36 * b * Math.sin(1.6 * Math.PI * (u + 0.25 * v)); break;
    case 'fish': dv = v * b * (0.55 * Math.exp(-3.2 * (u + 0.15) ** 2) - 0.45 * Math.exp(-18 * (u - 0.7) ** 2) + 0.25 * ease(0.75, 1, u)); break;
    case 'rise': dv = -0.75 * b * (ease(-1, 1, u) - 0.5); break;
    case 'fisheye': { const rr = Math.hypot(u, v) / 1.42; if (rr < 1) { const k = 0.9 * b * Math.cos((Math.PI / 2) * rr) ** 2; du = u * k; dv = v * k; } break; }
    case 'inflate': du = 0.32 * b * u * bell(v); dv = 0.32 * b * v * bell(u); break;
    case 'squeeze': du = -0.32 * b * u * bell(v); dv = 0.2 * b * v * bell(u); break;
    case 'twist': { const a = b * Math.PI * 0.8 * (1 - ease(0, 1.5, Math.hypot(u, v))), c = Math.cos(a), s = Math.sin(a); du = u * c - v * s - u; dv = u * s + v * c - v; break; }
  }
  const su = u + du, sv = v + dv;
  u = vd ? su * Math.exp(0.45 * (vd / 100) * sv) : su;
  v = hd ? sv * Math.exp(0.45 * (hd / 100) * su) : sv;
  if (vertical) [u, v] = [v, u];
  return { x: r.x + ((u + 1) / 2) * r.w, y: r.y + ((v + 1) / 2) * r.h };
}

export function mapPathNonlinear(d: PathData, f: (p: Pt) => Pt, pieces = 8): PathData {
  return d.map((sp) => {
    const n = sp.pts.length;
    if (n < 2) return { closed: sp.closed, pts: sp.pts.map((a) => { const q = f(a); return anchor(q.x, q.y); }) };
    const out: Anchor[] = [];
    const segN = sp.closed ? n : n - 1;
    for (let i = 0; i < segN; i++) {
      const a = sp.pts[i], b = sp.pts[(i + 1) % n];
      let seg = segOf(a, b);
      const k = isLineSeg(seg) ? Math.max(2, pieces) : pieces;
      const parts: Array<ReturnType<typeof segOf>> = [];
      for (let j = 0; j < k; j++) { const t = 1 / (k - j); if (j === k - 1) { parts.push(seg); break; } const [l, r] = bezSplit(seg, t); parts.push(l); seg = r; }
      for (const s of parts) {
        const p0 = f(s[0]), c1 = f(s[1]), c2 = f(s[2]);
        if (out.length) { const last = out[out.length - 1]; last.ox = c1.x; last.oy = c1.y; }
        else out.push({ x: p0.x, y: p0.y, ix: p0.x, iy: p0.y, ox: c1.x, oy: c1.y });
        const p3 = f(s[3]);
        out.push({ x: p3.x, y: p3.y, ix: c2.x, iy: c2.y, ox: p3.x, oy: p3.y });
      }
    }
    if (sp.closed && out.length > 1) { const last = out.pop() as Anchor; out[0].ix = last.ix; out[0].iy = last.iy; }
    return { closed: sp.closed, pts: out };
  });
}

export function mapNode(n: VNode, f: (p: Pt) => Pt): VNode {
  if (n.kind === 'path') return { ...n, d: mapPathNonlinear(n.d, f), live: undefined };
  if (n.kind === 'compound') return { ...n, children: n.children.map((c) => ({ ...c, d: mapPathNonlinear(c.d, f), live: undefined })) };
  const ch = childrenOf(n);
  if (ch) return { ...n, children: ch.map((c) => mapNode(c, f)) } as VNode;
  return n;
}

export function meshGrid(r: Rect, rows: number, cols: number): Pt[] {
  const out: Pt[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) out.push({ x: r.x + (r.w * i) / cols, y: r.y + (r.h * j) / rows });
  return out;
}

function coonsFromShape(shape: PathData): ((u: number, v: number) => Pt) | null {
  const sp = shape[0];
  if (!sp || sp.pts.length < 3) return null;
  const raw = flattenSub({ ...sp, closed: true }, 0.5), poly = signedAreaSub({ ...sp, closed: true }) > 0 ? raw : raw.slice().reverse();
  const b = pathBounds(shape);
  const corners = [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }];
  const idx = corners.map((c) => { let best = 0, bd = Infinity; poly.forEach((p, i) => { const d = dist(p, c); if (d < bd) { bd = d; best = i; } }); return best; });
  const sideOf = (a: number, z: number): Pt[] => { const out: Pt[] = []; let i = a; for (let guard = 0; guard <= poly.length; guard++) { out.push(poly[i]); if (i === z) break; i = (i + 1) % poly.length; } return out; };
  const c = idx;
  const top = sideOf(c[0], c[1]), right = sideOf(c[1], c[2]), bottom = sideOf(c[3], c[2]).length > 1 ? sideOf(c[2], c[3]).reverse() : [], left = sideOf(c[3], c[0]).reverse();
  if (top.length < 2 || right.length < 2 || bottom.length < 2 || left.length < 2) return null;
  const at = (line: Pt[], t: number): Pt => { const f = t * (line.length - 1), i = Math.min(line.length - 2, Math.floor(f)), k = f - i; return { x: line[i].x + (line[i + 1].x - line[i].x) * k, y: line[i].y + (line[i + 1].y - line[i].y) * k }; };
  const P00 = top[0], P10 = top[top.length - 1], P01 = bottom[0], P11 = bottom[bottom.length - 1];
  return (u, v) => {
    const t = at(top, u), bo = at(bottom, u), l = at(left, v), r = at(right, v);
    return {
      x: (1 - v) * t.x + v * bo.x + (1 - u) * l.x + u * r.x - ((1 - u) * (1 - v) * P00.x + u * (1 - v) * P10.x + (1 - u) * v * P01.x + u * v * P11.x),
      y: (1 - v) * t.y + v * bo.y + (1 - u) * l.y + u * r.y - ((1 - u) * (1 - v) * P00.y + u * (1 - v) * P10.y + (1 - u) * v * P01.y + u * v * P11.y),
    };
  };
}

export function envelopeFrame(doc: Doc, n: EnvelopeNode): Rect {
  const b = n.children.reduce((r, c) => (c.hidden ? r : unionRect(r, geomBounds(doc, c))), emptyRect());
  return isEmptyRect(b) || b.w < 1e-6 || b.h < 1e-6 ? n.frame : b;
}

export function envelopeMapper(n: EnvelopeNode, frame: Rect = n.frame): (p: Pt) => Pt {
  const r = frame, s = n.spec;
  if (s.kind === 'warp') return (p) => warpPoint(s.style, s.bend, s.h, s.v, s.vertical, r, p);
  if (s.kind === 'mesh') return s.points.length === (s.rows + 1) * (s.cols + 1) ? meshMapper(s, r) : (p) => p;
  const coons = coonsFromShape(s.shape);
  if (!coons) return (p) => p;
  return (p) => coons(Math.max(0, Math.min(1, (p.x - r.x) / (r.w || 1))), Math.max(0, Math.min(1, (p.y - r.y) / (r.h || 1))));
}

export function envelopeOutline(doc: Doc, n: EnvelopeNode): PathData {
  const s = n.spec;
  if (s.kind === 'mesh' && s.points.length === (s.rows + 1) * (s.cols + 1)) return meshOutline(s);
  if (s.kind === 'top') return s.shape;
  const fr = envelopeFrame(doc, n);
  return mapPathAdaptive([{ closed: true, pts: [anchor(fr.x, fr.y), anchor(fr.x + fr.w, fr.y), anchor(fr.x + fr.w, fr.y + fr.h), anchor(fr.x, fr.y + fr.h)] }], envelopeMapper(n, fr), 0.25);
}

const gridCache = new WeakMap<VNode, PathData>();
export function envelopeGrid(doc: Doc, n: EnvelopeNode): PathData {
  const hit = gridCache.get(n);
  if (hit) return hit;
  const s = n.spec;
  let out: PathData;
  if (s.kind === 'mesh' && s.points.length === (s.rows + 1) * (s.cols + 1)) out = meshCurves(s).map((c) => segsToSub([c], false));
  else if (s.kind === 'top') out = s.shape;
  else {
    const fr = envelopeFrame(doc, n), f = envelopeMapper(n, fr), lines: PathData = [], k = 4;
    for (let i = 0; i <= k; i++) {
      const x = fr.x + (fr.w * i) / k, y = fr.y + (fr.h * i) / k;
      lines.push({ closed: false, pts: [anchor(x, fr.y), anchor(x, fr.y + fr.h)] }, { closed: false, pts: [anchor(fr.x, y), anchor(fr.x + fr.w, y)] });
    }
    out = mapPathAdaptive(lines, f, 0.25);
  }
  gridCache.set(n, out);
  return out;
}

function linearLine(gr: Gradient, b: Rect): { x1: number; y1: number; x2: number; y2: number } {
  if (gr.geom) return gr.geom;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, a = (gr.angle * Math.PI) / 180, dx = Math.cos(a), dy = -Math.sin(a), half = (Math.abs(b.w * dx) + Math.abs(b.h * dy)) / 2;
  return { x1: cx - dx * half, y1: cy - dy * half, x2: cx + dx * half, y2: cy + dy * half };
}
function warpPaint(p: Paint, f: (p: Pt) => Pt, o: EnvelopeOptions, b: Rect): Paint {
  if (p.type === 'gradient' && o.gradients && p.gradient.kind === 'linear') {
    const g = linearLine(p.gradient, b), a = f({ x: g.x1, y: g.y1 }), z = f({ x: g.x2, y: g.y2 });
    return { ...p, gradient: { ...p.gradient, geom: { x1: a.x, y1: a.y, x2: z.x, y2: z.y } } };
  }
  if (p.type === 'pattern' && o.patterns) return { ...p, xf: mulM(localAffine(f, { x: b.x + b.w / 2, y: b.y + b.h / 2 }, Math.max(b.w, b.h)), p.xf) };
  return p;
}
function warpItems(ap: Appearance, f: (p: Pt) => Pt, o: EnvelopeOptions, b: Rect): Appearance {
  if (!o.gradients && !o.patterns) return ap;
  return { ...ap, items: ap.items.map((it) => ({ ...it, paint: warpPaint(it.paint, f, o, b) })) };
}
const asGroup = (c: VNode, children: VNode[], effects = c.ap.effects): VNode => ({ id: c.id, kind: 'group', clip: false, children, opacity: c.opacity, blend: c.blend, ap: { items: [], effects }, ...(c.mask ? { mask: c.mask } : {}) });

function warpNode(doc: Doc, c: VNode, f: (p: Pt) => Pt, o: EnvelopeOptions, tol: number): VNode {
  if (c.hidden) return c;
  switch (c.kind) {
    case 'path': case 'compound': {
      if (o.appearance && (c.ap.items.some((i) => i.visible && i.kind === 'stroke' && i.paint.type !== 'none') || c.ap.effects.some((e) => e.visible))) {
        const parts = expandAppearance(doc, c);
        if (parts.length && !(parts.length === 1 && parts[0] === c)) return asGroup(c, parts.map((x) => warpNode(doc, x, f, { ...o, appearance: false }, tol)), []);
      }
      const b = pathBounds(c.kind === 'path' ? c.d : c.children.flatMap((k) => k.d)), ap = warpItems(c.ap, f, o, b);
      if (c.kind === 'path') return { ...c, d: mapPathAdaptive(c.d, f, tol), live: undefined, bbox: undefined, ap };
      return { ...c, ap, bbox: undefined, children: c.children.map((k) => ({ ...k, d: mapPathAdaptive(k.d, f, tol), live: undefined })) };
    }
    case 'text': {
      const runs = textOutlineRuns(c);
      if (!runs || !runs.length) return c;
      return asGroup(c, runs.map((r, k) => {
        const items: AppearanceItem[] = [fill(r.style.fill)];
        if (r.style.stroke.type !== 'none' && r.style.strokeWidth > 0) items.push(stroke(r.style.stroke, r.style.strokeWidth));
        return warpNode(doc, { id: `${c.id}~${k}`, kind: 'path', d: r.d, rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items, effects: [] } }, f, o, tol);
      }));
    }
    case 'image': {
      if (c.warp) return { ...c, warp: { ...c.warp, pts: c.warp.pts.map(f), smooth: o.antiAlias } };
      const k = Math.round(6 + (Math.max(0, Math.min(100, o.fidelity)) / 100) * 26), aspect = c.w / Math.max(1e-6, c.h);
      const cols = Math.max(2, Math.round(aspect >= 1 ? k : k * aspect)), rows = Math.max(2, Math.round(aspect >= 1 ? k / aspect : k)), pts: Pt[] = [];
      for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) pts.push(f(apply(c.xf, (c.w * i) / cols, (c.h * j) / rows)));
      return { ...c, bbox: undefined, warp: { rows, cols, pts, smooth: o.antiAlias } };
    }
    case 'symbol': {
      const art = instanceArt(doc, c);
      return art ? asGroup(c, [warpNode(doc, transformNode(art, c.xf), f, o, tol)]) : c;
    }
    case 'mesh': {
      const e = 1e-4;
      return { ...c, bbox: undefined, points: c.points.map((p) => {
        const q = f(p);
        return { ...p, x: q.x, y: q.y, h: p.h.map((h) => { if (Math.abs(h.x) + Math.abs(h.y) < 1e-12) return h; const z = f({ x: p.x + h.x * e, y: p.y + h.y * e }); return { x: (z.x - q.x) / e, y: (z.y - q.y) / e }; }) as typeof p.h };
      }) };
    }
    case 'group': return { ...c, bbox: undefined, trace: undefined, children: c.children.map((k) => warpNode(doc, k, f, o, tol)), ...(c.livePaint ? { livePaint: { ...c.livePaint, fills: c.livePaint.fills.map((x) => ({ ...x, at: f(x.at) })) } } : {}) };
    case 'blend': case 'repeat': case 'envelope': return asGroup(c, liveChildren(doc, c).map((k) => warpNode(doc, k, f, o, tol)));
    default: return c;
  }
}

export function envelopeContent(doc: Doc, n: EnvelopeNode): VNode[] {
  const fr = envelopeFrame(doc, n), f = envelopeMapper(n, fr), o = envelopeOptions(n.opts), tol = fidelityTol(o.fidelity);
  return n.children.map((c) => warpNode(doc, c, f, o, tol));
}
