import { bezPoint, flattenSub, pathBounds } from './geometry';
import { mixColor } from './paint';
import type { Color, MeshNode, MeshPoint, PathData, Pt } from './types';

export interface MeshQuad { pts: [Pt, Pt, Pt, Pt]; color: Color; opacity: number }

function edge(a: MeshPoint, ah: Pt, b: MeshPoint, bh: Pt): [Pt, Pt, Pt, Pt] {
  return [{ x: a.x, y: a.y }, { x: a.x + ah.x, y: a.y + ah.y }, { x: b.x + bh.x, y: b.y + bh.y }, { x: b.x, y: b.y }];
}

export function patchEval(m: MeshNode, r: number, c: number): (u: number, v: number) => { p: Pt; color: Color; opacity: number } {
  const w = m.cols + 1;
  const p00 = m.points[r * w + c], p10 = m.points[r * w + c + 1], p01 = m.points[(r + 1) * w + c], p11 = m.points[(r + 1) * w + c + 1];
  const top = edge(p00, p00.h[0], p10, p10.h[1]), bottom = edge(p01, p01.h[0], p11, p11.h[1]);
  const left = edge(p00, p00.h[2], p01, p01.h[3]), right = edge(p10, p10.h[2], p11, p11.h[3]);
  return (u, v) => {
    const t = bezPoint(top, u), b = bezPoint(bottom, u), l = bezPoint(left, v), rr = bezPoint(right, v);
    const x = (1 - v) * t.x + v * b.x + (1 - u) * l.x + u * rr.x - ((1 - u) * (1 - v) * p00.x + u * (1 - v) * p10.x + (1 - u) * v * p01.x + u * v * p11.x);
    const y = (1 - v) * t.y + v * b.y + (1 - u) * l.y + u * rr.y - ((1 - u) * (1 - v) * p00.y + u * (1 - v) * p10.y + (1 - u) * v * p01.y + u * v * p11.y);
    const cTop = mixColor(p00.color, p10.color, u), cBot = mixColor(p01.color, p11.color, u);
    const oTop = p00.opacity + (p10.opacity - p00.opacity) * u, oBot = p01.opacity + (p11.opacity - p01.opacity) * u;
    return { p: { x, y }, color: mixColor(cTop, cBot, v), opacity: oTop + (oBot - oTop) * v };
  };
}

export function meshQuads(m: MeshNode, level: number): MeshQuad[] {
  const out: MeshQuad[] = [];
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
    const f = patchEval(m, r, c);
    const grid: Pt[][] = [];
    for (let j = 0; j <= level; j++) { const row: Pt[] = []; for (let i = 0; i <= level; i++) row.push(f(i / level, j / level).p); grid.push(row); }
    for (let j = 0; j < level; j++) for (let i = 0; i < level; i++) {
      const mid = f((i + 0.5) / level, (j + 0.5) / level);
      out.push({ pts: [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]], color: mid.color, opacity: mid.opacity });
    }
  }
  return out;
}

function sides(d: PathData): ((u: number, v: number) => Pt) {
  const b = pathBounds(d);
  const sp = d[0];
  if (!sp || sp.pts.length < 3) return (u, v) => ({ x: b.x + u * b.w, y: b.y + v * b.h });
  const poly = flattenSub({ ...sp, closed: true }, 0.5);
  const corners = [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }];
  const near = corners.map((c) => { let k = 0, bd = Infinity; poly.forEach((p, i) => { const dd = Math.hypot(p.x - c.x, p.y - c.y); if (dd < bd) { bd = dd; k = i; } }); return k; });
  const walk = (a: number, z: number, fwd: boolean): Pt[] => { const out: Pt[] = []; let i = a; for (let g = 0; g <= poly.length; g++) { out.push(poly[i]); if (i === z) break; i = fwd ? (i + 1) % poly.length : (i - 1 + poly.length) % poly.length; } return out; };
  const cw = ((): boolean => { let s = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; s += p.x * q.y - q.x * p.y; } return s > 0; })();
  const top = walk(near[0], near[1], cw), right = walk(near[1], near[2], cw), bottom = walk(near[3], near[2], !cw), left = walk(near[0], near[3], !cw);
  const at = (line: Pt[], t: number): Pt => { if (line.length < 2) return line[0] ?? { x: 0, y: 0 }; const f = t * (line.length - 1), i = Math.min(line.length - 2, Math.floor(f)), k = f - i; return { x: line[i].x + (line[i + 1].x - line[i].x) * k, y: line[i].y + (line[i + 1].y - line[i].y) * k }; };
  const P00 = top[0], P10 = top[top.length - 1], P01 = bottom[0], P11 = bottom[bottom.length - 1];
  return (u, v) => {
    const t = at(top, u), bo = at(bottom, u), l = at(left, v), r = at(right, v);
    return { x: (1 - v) * t.x + v * bo.x + (1 - u) * l.x + u * r.x - ((1 - u) * (1 - v) * P00.x + u * (1 - v) * P10.x + (1 - u) * v * P01.x + u * v * P11.x), y: (1 - v) * t.y + v * bo.y + (1 - u) * l.y + u * r.y - ((1 - u) * (1 - v) * P00.y + u * (1 - v) * P10.y + (1 - u) * v * P01.y + u * v * P11.y) };
  };
}

export function buildMesh(d: PathData, rows: number, cols: number, color: Color, highlight: 'flat' | 'center' | 'edge' = 'flat'): Pick<MeshNode, 'rows' | 'cols' | 'points'> {
  const f = sides(d), pts: MeshPoint[] = [], du = 1 / cols / 3, dv = 1 / rows / 3;
  const white: Color = { kind: 'rgb', r: 255, g: 255, b: 255 };
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const u = i / cols, v = j / rows, p = f(u, v);
    const h = (uu: number, vv: number): Pt => { const q = f(Math.max(0, Math.min(1, uu)), Math.max(0, Math.min(1, vv))); return { x: q.x - p.x, y: q.y - p.y }; };
    const centerness = 1 - Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2);
    const col = highlight === 'center' ? mixColor(color, white, centerness * 0.85) : highlight === 'edge' ? mixColor(color, white, (1 - centerness) * 0.85) : color;
    pts.push({ x: p.x, y: p.y, color: col, opacity: 1, h: [i < cols ? h(u + du, v) : { x: 0, y: 0 }, i > 0 ? h(u - du, v) : { x: 0, y: 0 }, j < rows ? h(u, v + dv) : { x: 0, y: 0 }, j > 0 ? h(u, v - dv) : { x: 0, y: 0 }] });
  }
  return { rows, cols, points: pts };
}

export function meshPointAt(m: MeshNode, p: Pt, tol: number): number {
  let best = -1, bd = tol;
  m.points.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d <= bd) { bd = d; best = i; } });
  return best;
}

export function removeMeshLines(m: MeshNode, idx: number): MeshNode {
  const w = m.cols + 1, r = Math.floor(idx / w), c = idx % w;
  const dropRow = r > 0 && r < m.rows, dropCol = c > 0 && c < m.cols;
  if (!dropRow && !dropCol) return m;
  const rows = Array.from({ length: m.rows + 1 }, (_, j) => j).filter((j) => !(dropRow && j === r));
  const cols = Array.from({ length: m.cols + 1 }, (_, i) => i).filter((i) => !(dropCol && i === c));
  const at = (j: number, i: number): MeshPoint => m.points[j * w + i];
  const pts: MeshPoint[] = [];
  rows.forEach((j, jj) => cols.forEach((i, ii) => {
    const q = at(j, i), h = [...q.h] as MeshPoint['h'];
    const toward = (o: MeshPoint, old: Pt): Pt => {
      const len = Math.hypot(o.x - q.x, o.y - q.y) / 3, ol = Math.hypot(old.x, old.y);
      return ol > 1e-6 ? { x: (old.x / ol) * len, y: (old.y / ol) * len } : { x: (o.x - q.x) / 3, y: (o.y - q.y) / 3 };
    };
    if (ii + 1 < cols.length && cols[ii + 1] !== i + 1) h[0] = toward(at(j, cols[ii + 1]), q.h[0]);
    if (ii > 0 && cols[ii - 1] !== i - 1) h[1] = toward(at(j, cols[ii - 1]), q.h[1]);
    if (jj + 1 < rows.length && rows[jj + 1] !== j + 1) h[2] = toward(at(rows[jj + 1], i), q.h[2]);
    if (jj > 0 && rows[jj - 1] !== j - 1) h[3] = toward(at(rows[jj - 1], i), q.h[3]);
    pts.push({ ...q, h });
  }));
  return { ...m, rows: rows.length - 1, cols: cols.length - 1, points: pts };
}

export function addMeshLine(m: MeshNode, p: Pt): MeshNode {
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
    const f = patchEval(m, r, c);
    let bu = -1, bv = -1, bd = Infinity;
    for (let j = 0; j <= 16; j++) for (let i = 0; i <= 16; i++) { const q = f(i / 16, j / 16).p, d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; bu = i / 16; bv = j / 16; } }
    if (bd > 6) continue;
    const U = (c + bu) / m.cols, V = (r + bv) / m.rows;
    const sample = (u: number, v: number): { p: Pt; color: Color; opacity: number } => {
      const cc = Math.min(m.cols - 1, Math.floor(u * m.cols)), rr = Math.min(m.rows - 1, Math.floor(v * m.rows));
      return patchEval(m, rr, cc)(u * m.cols - cc, v * m.rows - rr);
    };
    const us: number[] = [], vs: number[] = [];
    for (let i = 0; i <= m.cols; i++) us.push(i / m.cols);
    for (let j = 0; j <= m.rows; j++) vs.push(j / m.rows);
    if (bu > 0.02 && bu < 0.98) us.splice(c + 1, 0, U);
    if (bv > 0.02 && bv < 0.98) vs.splice(r + 1, 0, V);
    const cols = us.length - 1, rows = vs.length - 1, pts: MeshPoint[] = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const s = sample(us[i], vs[j]);
      const hu = (k: number): Pt => { if (k < 0 || k > cols) return { x: 0, y: 0 }; const q = sample(us[i] + (us[k] - us[i]) / 3, vs[j]).p; return { x: q.x - s.p.x, y: q.y - s.p.y }; };
      const hv = (k: number): Pt => { if (k < 0 || k > rows) return { x: 0, y: 0 }; const q = sample(us[i], vs[j] + (vs[k] - vs[j]) / 3).p; return { x: q.x - s.p.x, y: q.y - s.p.y }; };
      pts.push({ x: s.p.x, y: s.p.y, color: s.color, opacity: s.opacity, h: [hu(i + 1), hu(i - 1), hv(j + 1), hv(j - 1)] });
    }
    return { ...m, rows, cols, points: pts };
  }
  return m;
}
