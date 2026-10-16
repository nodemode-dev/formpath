import { triangulate } from '../engine/raymesh';
import type { MeshRgb, RawGroup, RawModel } from '../engine/modelmesh';

export interface MtlEntry { color: MeshRgb; map: string | null }
export interface ObjResult { raw: RawModel; imageNames: string[]; faces: number; skipped: string[] }

const GREY: MeshRgb = [0.72, 0.72, 0.72];

export function parseMtl(text: string): Map<string, MtlEntry> {
  const out = new Map<string, MtlEntry>();
  let cur: MtlEntry | null = null;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t[0] === '#') continue;
    const p = t.split(/\s+/), key = p[0].toLowerCase();
    if (key === 'newmtl') { cur = { color: [...GREY] as MeshRgb, map: null }; out.set(t.slice(7).trim(), cur); }
    else if (cur && key === 'kd' && p.length >= 4) { const c = [Number(p[1]), Number(p[2]), Number(p[3])]; if (c.every((v) => Number.isFinite(v))) cur.color = [Math.min(1, Math.max(0, c[0])), Math.min(1, Math.max(0, c[1])), Math.min(1, Math.max(0, c[2]))]; }
    else if (cur && key === 'map_kd') { const name = p.length > 1 ? p[p.length - 1] : ''; if (name) cur.map = name; }
  }
  return out;
}

function polygon(P: number[], ids: number[]): number[] {
  const n = ids.length;
  if (n === 3) return [ids[0], ids[1], ids[2]];
  const at = (k: number): [number, number, number] => [P[ids[k] * 3], P[ids[k] * 3 + 1], P[ids[k] * 3 + 2]];
  if (n === 4) {
    const a = at(0), b = at(1), c = at(2), d = at(3), d02 = Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]), d13 = Math.hypot(b[0] - d[0], b[1] - d[1], b[2] - d[2]);
    return d02 <= d13 ? [ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]] : [ids[0], ids[1], ids[3], ids[1], ids[2], ids[3]];
  }
  let nx = 0, ny = 0, nz = 0;
  for (let k = 0; k < n; k++) { const a = at(k), b = at((k + 1) % n); nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz), xs: number[] = [], ys: number[] = [];
  for (let k = 0; k < n; k++) { const a = at(k); if (az >= ax && az >= ay) { xs.push(a[0]); ys.push(a[1]); } else if (ax >= ay) { xs.push(a[1]); ys.push(a[2]); } else { xs.push(a[2]); ys.push(a[0]); } }
  let tris: number[] = [];
  try { tris = triangulate(xs, ys, n, []); } catch { tris = []; }
  if (tris.length < 3) { for (let k = 1; k < n - 1; k++) tris.push(0, k, k + 1); }
  const out: number[] = [];
  for (let t = 0; t < tris.length; t += 3) {
    const a = at(tris[t]), b = at(tris[t + 1]), c = at(tris[t + 2]);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const dp = (uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz;
    if (dp >= 0) out.push(ids[tris[t]], ids[tris[t + 1]], ids[tris[t + 2]]); else out.push(ids[tris[t]], ids[tris[t + 2]], ids[tris[t + 1]]);
  }
  return out;
}

export function parseObj(text: string, mtl: (name: string) => string | null): ObjResult {
  const V: number[] = [], T: number[] = [], N: number[] = [], skipped: string[] = [];
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [], grp: number[] = [];
  const vertex = new Map<string, number>(), groupAt = new Map<string, number>(), groups: RawGroup[] = [], materials = new Map<string, MtlEntry>(), imageNames: string[] = [];
  let curMat = '', curGroup = '', haveAllN = true, haveAnyT = false, faces = 0;
  const lib = (name: string): void => { const t = mtl(name); if (t) for (const [k, v] of parseMtl(t)) materials.set(k, v); };
  const groupOf = (): number => {
    const key = curMat || curGroup || 'default';
    let g = groupAt.get(key);
    if (g === undefined) {
      if (groups.length >= 64) return groups.length - 1;
      const m = materials.get(key);
      let image: number | undefined;
      if (m?.map) { image = imageNames.indexOf(m.map); if (image < 0) { imageNames.push(m.map); image = imageNames.length - 1; } }
      g = groups.length;
      groups.push({ name: key, color: m ? m.color : [...GREY] as MeshRgb, ...(image !== undefined ? { image } : {}) });
      groupAt.set(key, g);
    }
    return g;
  };
  const resolve = (s: string, count: number): number => { const v = parseInt(s, 10); return v < 0 ? count + v : v - 1; };
  for (const line of text.split('\n')) {
    const c = line.charCodeAt(0);
    if (c === 35 || line.length < 2) continue;
    const t = line.trim();
    if (!t) continue;
    const sp = t.indexOf(' '), key = sp < 0 ? t : t.slice(0, sp);
    if (key === 'v') { const p = t.split(/\s+/); V.push(Number(p[1]), Number(p[2]), Number(p[3])); }
    else if (key === 'vt') { const p = t.split(/\s+/); T.push(Number(p[1]), 1 - (Number(p[2]) || 0)); }
    else if (key === 'vn') { const p = t.split(/\s+/); N.push(Number(p[1]), Number(p[2]), Number(p[3])); }
    else if (key === 'f') {
      const p = t.split(/\s+/).slice(1), ids: number[] = [];
      if (p.length < 3) continue;
      const g = groupOf();
      for (const tok of p) {
        const parts = tok.split('/'), vi = resolve(parts[0], V.length / 3), ti = parts[1] ? resolve(parts[1], T.length / 2) : -1, ni = parts[2] ? resolve(parts[2], N.length / 3) : -1;
        if (!(vi >= 0 && vi < V.length / 3)) continue;
        const k = `${vi}/${ti}/${ni}`;
        let at = vertex.get(k);
        if (at === undefined) {
          at = pos.length / 3;
          vertex.set(k, at);
          pos.push(V[vi * 3], V[vi * 3 + 1], V[vi * 3 + 2]);
          if (ni >= 0 && ni < N.length / 3) nrm.push(N[ni * 3], N[ni * 3 + 1], N[ni * 3 + 2]); else { haveAllN = false; nrm.push(0, 0, 0); }
          if (ti >= 0 && ti < T.length / 2) { uv.push(T[ti * 2], T[ti * 2 + 1]); haveAnyT = true; } else uv.push(0, 0);
        }
        ids.push(at);
      }
      if (ids.length < 3) continue;
      const tris = polygon(pos, ids);
      for (let k = 0; k < tris.length; k += 3) { idx.push(tris[k], tris[k + 1], tris[k + 2]); grp.push(g); faces++; }
    }
    else if (key === 'usemtl') curMat = t.slice(7).trim();
    else if (key === 'g' || key === 'o') curGroup = t.slice(2).trim();
    else if (key === 'mtllib') lib(t.slice(7).trim());
    else if (key === 'l' || key === 'p') { if (!skipped.includes('lines and points')) skipped.push('lines and points'); }
  }
  if (!groups.length) groups.push({ name: 'default', color: [...GREY] as MeshRgb });
  return { raw: { pos, nrm: haveAllN && nrm.length ? nrm : null, uv: haveAnyT ? uv : null, idx, grp, groups }, imageNames, faces, skipped };
}
