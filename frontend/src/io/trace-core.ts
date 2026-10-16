import { fitCurve } from '../engine/geometry';
import type { Anchor, PathData, Pt, SubPath } from '../engine/types';

export type TracePalette = 'auto' | 'limited' | 'full' | 'library';
export type TraceMethod = 'abutting' | 'overlapping';
export interface TraceOpts {
  mode: 'bw' | 'gray' | 'color'; palette: TracePalette; colors: number; threshold: number;
  detail: number; corners: number; noise: number; method: TraceMethod;
  fills: boolean; strokes: boolean; strokeWidth: number;
  ignoreWhite: boolean; smooth: boolean; snapLines: boolean; maxSide: number;
}
export type RGB3 = [number, number, number];
export interface TracePiece { color: RGB3; d: PathData; stroke: number }
export interface TraceOut { w: number; h: number; pieces: TracePiece[]; colors: number }

const lum = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;

function kmeans(sample: RGB3[], k: number): RGB3[] {
  if (!sample.length) return [[255, 255, 255]];
  const centers: RGB3[] = [sample[0]];
  const best = new Float64Array(sample.length).fill(Infinity);
  while (centers.length < Math.min(k, sample.length)) {
    const c = centers[centers.length - 1];
    let bi = 0, bd = -1;
    for (let i = 0; i < sample.length; i++) {
      const s = sample[i], d = (s[0] - c[0]) ** 2 + (s[1] - c[1]) ** 2 + (s[2] - c[2]) ** 2;
      if (d < best[i]) best[i] = d;
      if (best[i] > bd) { bd = best[i]; bi = i; }
    }
    if (bd <= 0) break;
    centers.push([...sample[bi]] as RGB3);
  }
  for (let it = 0; it < 10; it++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (const s of sample) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < centers.length; i++) { const c = centers[i], d = (s[0] - c[0]) ** 2 + (s[1] - c[1]) ** 2 + (s[2] - c[2]) ** 2; if (d < bd) { bd = d; bi = i; } }
      const a = acc[bi]; a[0] += s[0]; a[1] += s[1]; a[2] += s[2]; a[3]++;
    }
    acc.forEach((a, i) => { if (a[3]) centers[i] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
  }
  return centers.map((c) => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])] as RGB3);
}

function autoCount(sample: RGB3[]): number {
  const bins = new Map<number, number>();
  for (const s of sample) { const k = ((s[0] >> 4) << 8) | ((s[1] >> 4) << 4) | (s[2] >> 4); bins.set(k, (bins.get(k) ?? 0) + 1); }
  let n = 0;
  for (const v of bins.values()) if (v >= sample.length * 0.004) n++;
  return Math.max(2, Math.min(30, n));
}

function classify(px: Uint8ClampedArray, w: number, h: number, o: TraceOpts, library: RGB3[] | null): { labels: Int32Array; palette: RGB3[] } {
  const n = w * h, labels = new Int32Array(n);
  if (o.mode === 'bw') {
    for (let i = 0; i < n; i++) labels[i] = px[i * 4 + 3] <= 16 ? -1 : lum(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) < o.threshold ? 0 : 1;
    return { labels, palette: [[0, 0, 0], [255, 255, 255]] };
  }
  const gray = o.mode === 'gray';
  const sample: RGB3[] = [];
  const step = Math.max(1, Math.floor(n / 6000));
  for (let i = 0; i < n; i += step) if (px[i * 4 + 3] > 16) { if (gray) { const l = Math.round(lum(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])); sample.push([l, l, l]); } else sample.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]); }
  let palette: RGB3[];
  if (o.palette === 'library' && library && library.length) palette = gray ? library.map((c) => { const l = Math.round(lum(c[0], c[1], c[2])); return [l, l, l] as RGB3; }) : library.slice();
  else {
    const k = o.palette === 'auto' ? autoCount(sample) : o.palette === 'full' ? (gray ? 32 : 48) : Math.max(2, Math.min(64, Math.round(o.colors)));
    palette = kmeans(sample, k);
  }
  const lut = new Int32Array(gray ? 256 : 32768).fill(-1);
  const nearest = (r: number, g: number, b: number): number => {
    let bi = 0, bd = Infinity;
    for (let c = 0; c < palette.length; c++) { const q = palette[c], d = (r - q[0]) ** 2 + (g - q[1]) ** 2 + (b - q[2]) ** 2; if (d < bd) { bd = d; bi = c; } }
    return bi;
  };
  for (let i = 0; i < n; i++) {
    if (px[i * 4 + 3] <= 16) { labels[i] = -1; continue; }
    if (gray) { const l = Math.round(lum(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])); let v = lut[l]; if (v < 0) v = lut[l] = nearest(l, l, l); labels[i] = v; continue; }
    const key = ((px[i * 4] >> 3) << 10) | ((px[i * 4 + 1] >> 3) << 5) | (px[i * 4 + 2] >> 3);
    let v = lut[key];
    if (v < 0) v = lut[key] = nearest((px[i * 4] & 0xf8) + 4, (px[i * 4 + 1] & 0xf8) + 4, (px[i * 4 + 2] & 0xf8) + 4);
    labels[i] = v;
  }
  return { labels, palette };
}

function despeckle(labels: Int32Array, w: number, h: number, minArea: number): void {
  if (minArea <= 1) return;
  const n = w * h, seen = new Uint8Array(n), buf = new Int32Array(n), votes = new Map<number, number>();
  for (let s = 0; s < n; s++) {
    if (seen[s] || labels[s] < 0) continue;
    const L = labels[s];
    let head = 0, tail = 0;
    buf[tail++] = s; seen[s] = 1;
    votes.clear();
    while (head < tail) {
      const p = buf[head++], x = p % w, y = (p - x) / w;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) {
        if (q < 0) continue;
        const lq = labels[q];
        if (lq === L) { if (!seen[q]) { seen[q] = 1; buf[tail++] = q; } }
        else if (lq >= 0) votes.set(lq, (votes.get(lq) ?? 0) + 1);
      }
    }
    if (tail >= minArea || !votes.size) continue;
    let to = -1, bv = -1;
    for (const [k, v] of votes) if (v > bv) { bv = v; to = k; }
    for (let i = 0; i < tail; i++) labels[buf[i]] = to;
  }
}

function loops(mask: Uint8Array, w: number, h: number): Pt[][] {
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const H = h + 1, vid = (x: number, y: number): number => x * H + y;
  const runs = new Map<number, number[]>();
  const link = (a: number, b: number): void => { const l = runs.get(a); if (l) l.push(b); else runs.set(a, [b]); };
  for (let y = 0; y <= h; y++) {
    let x = 0;
    while (x < w) {
      const above = inside(x, y - 1), below = inside(x, y);
      if (above === below) { x++; continue; }
      let e = x + 1;
      while (e < w && inside(e, y - 1) === above && inside(e, y) === below) e++;
      if (below) link(vid(e, y), vid(x, y)); else link(vid(x, y), vid(e, y));
      x = e;
    }
  }
  for (let x = 0; x <= w; x++) {
    let y = 0;
    while (y < h) {
      const left = inside(x - 1, y), right = inside(x, y);
      if (left === right) { y++; continue; }
      let e = y + 1;
      while (e < h && inside(x - 1, e) === left && inside(x, e) === right) e++;
      if (right) link(vid(x, y), vid(x, e)); else link(vid(x, e), vid(x, y));
      y = e;
    }
  }
  const pt = (k: number): Pt => ({ x: Math.floor(k / H), y: k % H });
  const out: Pt[][] = [];
  for (const start of [...runs.keys()]) {
    while (runs.get(start)?.length) {
      const poly: Pt[] = [];
      let prev = start, cur = start, guard = 0;
      do {
        const list = runs.get(cur);
        if (!list || !list.length) break;
        let pick = 0;
        if (list.length > 1 && cur !== prev) {
          const a = pt(prev), c = pt(cur), inX = c.x - a.x, inY = c.y - a.y;
          let best = -Infinity;
          list.forEach((nk, i) => { const q = pt(nk), turn = inX * (q.y - c.y) - inY * (q.x - c.x); if (turn > best) { best = turn; pick = i; } });
        }
        const nk = list.splice(pick, 1)[0];
        poly.push(pt(cur));
        prev = cur; cur = nk;
      } while (cur !== start && ++guard < 4e6);
      if (poly.length > 2) out.push(poly);
    }
  }
  return out;
}

const area = (p: Pt[]): number => p.reduce((a, q, k) => { const z = p[(k + 1) % p.length]; return a + q.x * z.y - z.x * q.y; }, 0) / 2;

function densify(poly: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], len = Math.hypot(b.x - a.x, b.y - a.y), k = Math.max(1, Math.round(len));
    for (let j = 0; j < k; j++) out.push({ x: a.x + ((b.x - a.x) * (j + 0.5)) / k, y: a.y + ((b.y - a.y) * (j + 0.5)) / k });
  }
  return out;
}

function rdpIdx(pts: Pt[], tol: number, a0: number, b0: number, keep: Uint8Array): void {
  const stack: Array<[number, number]> = [[a0, b0]];
  while (stack.length) {
    const [a, b] = stack.pop() as [number, number];
    const A = pts[a], B = pts[b], dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = len < 1e-9 ? Math.hypot(pts[i].x - A.x, pts[i].y - A.y) : Math.abs(dy * pts[i].x - dx * pts[i].y + B.x * A.y - B.y * A.x) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
}

const plain = (p: Pt): Anchor => ({ x: p.x, y: p.y, ix: p.x, iy: p.y, ox: p.x, oy: p.y });

function snapLines(sp: SubPath, tol: number): SubPath {
  const pts = sp.pts.map((a) => ({ ...a })), n = pts.length, segs = sp.closed ? n : n - 1;
  const off = (q: Pt, a: Pt, b: Pt): number => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return Math.abs(dy * q.x - dx * q.y + b.x * a.y - b.y * a.x) / l; };
  const straight: boolean[] = [];
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const s = off({ x: a.ox, y: a.oy }, a, b) <= tol && off({ x: b.ix, y: b.iy }, a, b) <= tol;
    straight.push(s);
    if (s) { a.ox = a.x; a.oy = a.y; b.ix = b.x; b.iy = b.y; a.smooth = false; b.smooth = false; }
  }
  const move = (a: Anchor, dx: number, dy: number): void => { a.x += dx; a.y += dy; a.ix += dx; a.iy += dy; a.ox += dx; a.oy += dy; };
  for (let i = 0; i < segs; i++) {
    if (!straight[i]) continue;
    const a = pts[i], b = pts[(i + 1) % n], ang = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) % 180;
    if (Math.min(ang, 180 - ang) < 3) { const y = (a.y + b.y) / 2; move(a, 0, y - a.y); move(b, 0, y - b.y); }
    else if (Math.abs(ang - 90) < 3) { const x = (a.x + b.x) / 2; move(a, x - a.x, 0); move(b, x - b.x, 0); }
  }
  return { closed: sp.closed, pts };
}

function relax(pts: Pt[], closed: boolean, passes: number): Pt[] {
  let cur = pts;
  const n = pts.length;
  for (let k = 0; k < passes && n > 4; k++) {
    cur = cur.map((p, i) => {
      if (!closed && (i === 0 || i === n - 1)) return p;
      const a = cur[(i - 1 + n) % n], b = cur[(i + 1) % n];
      return { x: (a.x + 2 * p.x + b.x) / 4, y: (a.y + 2 * p.y + b.y) / 4 };
    });
  }
  return cur;
}

function findCorners(P: Pt[], closed: boolean, minTurn: number): number[] {
  const N = P.length, k = Math.min(4, Math.floor(N / 4));
  if (k < 2) return [];
  const wrap = (i: number): number => (closed ? ((i % N) + N) % N : i);
  const turn = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    if (!closed && (i - k < 0 || i + k >= N)) continue;
    const a = P[wrap(i - k)], b = P[i], c = P[wrap(i + k)];
    const ax = b.x - a.x, ay = b.y - a.y, bx = c.x - b.x, by = c.y - b.y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < 1e-9 || lb < 1e-9) continue;
    turn[i] = (Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))) * 180) / Math.PI;
  }
  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    if (turn[i] < minTurn) continue;
    let peak = true;
    for (let j = -k; j <= k && peak; j++) {
      if (!j) continue;
      const q = closed ? (i + j + N) % N : i + j;
      if (q < 0 || q >= N) continue;
      if (turn[q] > turn[i] || (turn[q] === turn[i] && j < 0)) peak = false;
    }
    if (peak) out.push(i);
  }
  return out;
}

interface Fit2 { c: Pt; d: Pt; res: number }
function lineFit(pts: Pt[]): Fit2 {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) { const x = p.x - cx, y = p.y - cy; sxx += x * x; sxy += x * y; syy += y * y; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), d = { x: Math.cos(th), y: Math.sin(th) };
  let res = 0;
  for (const p of pts) res = Math.max(res, Math.abs(-(p.x - cx) * d.y + (p.y - cy) * d.x));
  return { c: { x: cx, y: cy }, d, res };
}

function cornerPoint(P: Pt[], closed: boolean, ci: number, prevC: number, nextC: number): Pt {
  const N = P.length, at = (i: number): Pt => P[closed ? ((i % N) + N) % N : i];
  const gapB = closed ? ((ci - prevC + N) % N) || N : ci - prevC, gapF = closed ? ((nextC - ci + N) % N) || N : nextC - ci;
  const mb = Math.min(14, gapB - 3), mf = Math.min(14, gapF - 3);
  if (mb < 3 || mf < 3) return P[ci];
  const left: Pt[] = [], right: Pt[] = [];
  for (let j = 2; j < 2 + mb; j++) left.push(at(ci - j));
  for (let j = 2; j < 2 + mf; j++) right.push(at(ci + j));
  const a = lineFit(left), b = lineFit(right);
  if (a.res > 0.9 || b.res > 0.9) return P[ci];
  const cross = a.d.x * b.d.y - a.d.y * b.d.x;
  if (Math.abs(cross) < 0.34) return P[ci];
  const t = ((b.c.x - a.c.x) * b.d.y - (b.c.y - a.c.y) * b.d.x) / cross;
  const hit = { x: a.c.x + a.d.x * t, y: a.c.y + a.d.y * t };
  return Math.hypot(hit.x - P[ci].x, hit.y - P[ci].y) <= 2.2 ? hit : P[ci];
}

function fitSmooth(raw: Pt[], q: Pt[], closed: boolean, o: TraceOpts, tol: number): SubPath | null {
  const N = raw.length, err = Math.max(0.35, tol), flat = Math.max(0.6, tol * 0.45);
  const found = findCorners(raw, closed, 135 - o.corners * 120);
  if (closed && !found.length) {
    const fit = fitCurve([...q, q[0]], err);
    if (fit.length < 3) return null;
    const last = fit.pop() as Anchor;
    fit[0].ix = last.ix; fit[0].iy = last.iy; fit[0].smooth = true;
    return { closed: true, pts: fit };
  }
  const idx = closed ? found : [0, ...found, N - 1], m = idx.length;
  const pos: Pt[] = idx.map((c, k) => (!closed && (k === 0 || k === m - 1) ? raw[c] : cornerPoint(raw, closed, c, idx[(k - 1 + m) % m], idx[(k + 1) % m])));
  const out: Anchor[] = [];
  const runs = closed ? m : m - 1;
  for (let k = 0; k < runs; k++) {
    const a = idx[k], b = k + 1 < m ? idx[k + 1] : idx[0] + N;
    const R: Pt[] = [], Q: Pt[] = [];
    for (let i = a; i <= b; i++) { R.push(raw[i % N]); Q.push(q[i % N]); }
    const A = pos[k], B = pos[(k + 1) % m];
    R[0] = Q[0] = A; R[R.length - 1] = Q[Q.length - 1] = B;
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
    let straight = L > 1e-6;
    for (let i = 1; straight && i < R.length - 1; i++) if (Math.abs(dy * (R[i].x - A.x) - dx * (R[i].y - A.y)) / L > flat) straight = false;
    const fit = straight ? [plain(A), plain(B)] : fitCurve(Q, err);
    if (!fit.length) continue;
    if (out.length) { const prev = out[out.length - 1]; prev.ox = fit[0].ox; prev.oy = fit[0].oy; out.push(...fit.slice(1)); }
    else out.push(...fit);
  }
  if (closed && out.length > 1) { const last = out.pop() as Anchor; out[0].ix = last.ix; out[0].iy = last.iy; }
  return out.length >= 2 ? { closed, pts: out } : null;
}

function fitRun(raw: Pt[], closed: boolean, o: TraceOpts, tol: number): SubPath | null {
  if (raw.length < (closed ? 3 : 2)) return null;
  const pts = o.smooth ? relax(raw, closed, o.corners > 0.85 ? 1 : 2) : raw;
  if (!o.smooth) {
    const keep = new Uint8Array(pts.length + 1), ring = closed ? [...pts, pts[0]] : pts;
    keep[0] = keep[ring.length - 1] = 1;
    rdpIdx(ring, tol, 0, ring.length - 1, keep);
    const out = ring.filter((_, i) => keep[i]).map(plain);
    if (closed) out.pop();
    return out.length >= (closed ? 3 : 2) ? { closed, pts: out } : null;
  }
  return fitSmooth(raw, pts, closed, o, tol);
}

function fillPaths(mask: Uint8Array, w: number, h: number, o: TraceOpts, tol: number, minArea: number): PathData {
  const d: PathData = [];
  for (const loop of loops(mask, w, h)) {
    if (Math.abs(area(loop)) < Math.max(1, minArea * 0.5)) continue;
    const sp = fitRun(densify(loop), true, o, tol);
    if (sp) d.push(o.snapLines ? snapLines(sp, Math.max(0.5, tol * 0.6)) : sp);
  }
  return d;
}

function chamfer(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
  const a = 1, b = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!d[i]) continue;
    let v = d[i];
    v = Math.min(v, x > 0 ? d[i - 1] + a : a, y > 0 ? d[i - w] + a : a, x > 0 && y > 0 ? d[i - w - 1] + b : b, x < w - 1 && y > 0 ? d[i - w + 1] + b : b);
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!d[i]) continue;
    d[i] = Math.min(d[i], x < w - 1 ? d[i + 1] + a : a, y < h - 1 ? d[i + w] + a : a, x < w - 1 && y < h - 1 ? d[i + w + 1] + b : b, x > 0 && y < h - 1 ? d[i + w - 1] + b : b);
  }
  return d;
}

function thin(mask: Uint8Array, w: number, h: number): Uint8Array {
  const s = mask.slice(), del: number[] = [];
  const at = (x: number, y: number): number => (x >= 0 && y >= 0 && x < w && y < h ? s[y * w + x] : 0);
  let changed = true, guard = 0;
  while (changed && guard++ < 400) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!s[y * w + x]) continue;
        const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1), p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        let A = 0;
        for (let k = 0; k < 8; k++) if (!seq[k] && seq[k + 1]) A++;
        if (A !== 1) continue;
        if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
        del.push(y * w + x);
      }
      for (const i of del) s[i] = 0;
      if (del.length) changed = true;
    }
  }
  return s;
}

function skeletonLines(sk: Uint8Array, w: number, h: number): number[][] {
  const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && sk[y * w + x] === 1;
  const nbrs = (i: number): number[] => {
    const x = i % w, y = (i - x) / w, out: number[] = [];
    const o4: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of o4) if (on(x + dx, y + dy)) out.push((y + dy) * w + x + dx);
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as Array<[number, number]>) if (on(x + dx, y + dy) && !on(x + dx, y) && !on(x, y + dy)) out.push((y + dy) * w + x + dx);
    return out;
  };
  const deg = new Uint8Array(w * h), list: number[] = [];
  for (let i = 0; i < w * h; i++) if (sk[i]) { deg[i] = nbrs(i).length; list.push(i); }
  const used = new Uint8Array(w * h), pairs = new Set<string>(), lines: number[][] = [];
  const walk = (from: number, to: number): number[] => {
    const line = [from, to];
    let prev = from, cur = to;
    while (deg[cur] === 2 && !used[cur]) {
      used[cur] = 1;
      const nx = nbrs(cur).find((q) => q !== prev);
      if (nx === undefined) break;
      prev = cur; cur = nx; line.push(cur);
    }
    return line;
  };
  for (const i of list) {
    if (deg[i] === 2 || deg[i] === 0) continue;
    for (const q of nbrs(i)) {
      if (deg[q] === 2 && used[q]) continue;
      if (deg[q] !== 2) { const k = i < q ? `${i}:${q}` : `${q}:${i}`; if (pairs.has(k)) continue; pairs.add(k); }
      const line = walk(i, q);
      if (line.length >= 2) lines.push(line);
    }
  }
  for (const i of list) {
    if (deg[i] !== 2 || used[i]) continue;
    used[i] = 1;
    const nb = nbrs(i);
    const line = walk(i, nb[0]);
    if (line.length > 3) lines.push(line);
  }
  return lines;
}

export function traceCore(px: Uint8ClampedArray, w: number, h: number, o: TraceOpts, library: RGB3[] | null, scale = 1): TraceOut {
  const { labels, palette } = classify(px, w, h, o, library);
  const minArea = Math.max(0, o.noise * scale * scale);
  despeckle(labels, w, h, minArea);
  const n = w * h, counts = new Array<number>(palette.length).fill(0);
  for (let i = 0; i < n; i++) if (labels[i] >= 0) counts[labels[i]]++;
  const isWhite = (c: RGB3): boolean => c[0] > 240 && c[1] > 240 && c[2] > 240;
  const order = palette.map((_, i) => i).filter((i) => counts[i] > 0).sort((a, b) => counts[b] - counts[a]);
  const rank = new Int32Array(palette.length).fill(-1);
  order.forEach((c, r) => { rank[c] = r; });
  const skip = (c: number): boolean => o.ignoreWhite && isWhite(palette[c]);
  const tol = 0.4 + (1 - o.detail) * 2.6;
  const pieces: TracePiece[] = [];
  const strokeMode = o.mode === 'bw' && o.strokes;
  let strokeMask: Uint8Array | null = null;
  const fillMaskFor = (c: number): Uint8Array => {
    const m = new Uint8Array(n);
    if (o.method === 'overlapping') { const r = rank[c]; for (let i = 0; i < n; i++) { const l = labels[i]; if (l >= 0 && rank[l] >= r && !skip(l)) m[i] = 1; } }
    else for (let i = 0; i < n; i++) if (labels[i] === c) m[i] = 1;
    if (strokeMask && c === 0) for (let i = 0; i < n; i++) if (strokeMask[i]) m[i] = 0;
    return m;
  };
  if (strokeMode) {
    const black = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (labels[i] === 0) black[i] = 1;
    const dist = chamfer(black, w, h), seen = new Uint8Array(n), buf = new Int32Array(n);
    strokeMask = new Uint8Array(n);
    const maxW = Math.max(1, o.strokeWidth * scale);
    for (let s = 0; s < n; s++) {
      if (!black[s] || seen[s]) continue;
      let head = 0, tail = 0, md = 0;
      buf[tail++] = s; seen[s] = 1;
      while (head < tail) {
        const p = buf[head++], x = p % w, y = (p - x) / w;
        md = Math.max(md, dist[p]);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if ((dx || dy) && xx >= 0 && yy >= 0 && xx < w && yy < h) { const q = yy * w + xx; if (black[q] && !seen[q]) { seen[q] = 1; buf[tail++] = q; } }
        }
      }
      if (!o.fills || md * 2 - 1 <= maxW) for (let i = 0; i < tail; i++) strokeMask[buf[i]] = 1;
    }
    const sk = thin(strokeMask, w, h);
    const lines = skeletonLines(sk, w, h);
    const d: Array<{ sp: SubPath; width: number }> = [];
    for (const line of lines) {
      const pts = line.map((i) => { const x = i % w; return { x: x + 0.5, y: (i - x) / w + 0.5 }; });
      const closed = line.length > 3 && line[0] === line[line.length - 1];
      if (closed) pts.pop();
      if (pts.length < 2 || (!closed && pts.length < 3 && line.every((i) => dist[i] < 1.5))) continue;
      const width = Math.max(1, line.reduce((a, i) => a + dist[i] * 2 - 1, 0) / line.length);
      const sp = fitRun(pts, closed, o, tol);
      if (sp) d.push({ sp: o.snapLines ? snapLines(sp, Math.max(0.5, tol * 0.6)) : sp, width });
    }
    for (const x of d) pieces.push({ color: [0, 0, 0], d: [x.sp], stroke: x.width });
  }
  const fillPieces: TracePiece[] = [];
  if (!strokeMode || o.fills) {
    for (const c of order) {
      if (skip(c)) continue;
      const d = fillPaths(fillMaskFor(c), w, h, o, tol, minArea);
      if (d.length) fillPieces.push({ color: palette[c], d, stroke: 0 });
    }
  }
  return { w, h, pieces: [...fillPieces, ...pieces], colors: order.length };
}
