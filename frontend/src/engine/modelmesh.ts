export type MeshRgb = [number, number, number];
export interface MeshGroup { name: string; color: MeshRgb; tex?: string }
export interface Mesh {
  pos: Float32Array;
  nrm: Float32Array;
  uv: Float32Array | null;
  idx: Uint32Array;
  grp: Uint16Array;
  groups: MeshGroup[];
  ext: [number, number, number];
}
export interface RawGroup { name: string; color: MeshRgb; image?: number }
export interface RawModel { pos: number[]; nrm: number[] | null; uv: number[] | null; idx: number[]; grp: number[]; groups: RawGroup[] }

export const MESH_MIME = 'application/x-formpth-mesh';
export const isMeshMime = (m: string | undefined): boolean => m === MESH_MIME;
export const MESH_GROUP_LIMIT = 64;
const MAGIC = 0x314d5046;
const CREASE_COS = Math.cos((55 * Math.PI) / 180);

function weld(pos: Float32Array): Int32Array {
  const n = pos.length / 3, out = new Int32Array(n), seen = new Map<string, number>(), q = 1e5;
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[i * 3] * q)}|${Math.round(pos[i * 3 + 1] * q)}|${Math.round(pos[i * 3 + 2] * q)}`, h = seen.get(k);
    if (h === undefined) { seen.set(k, i); out[i] = i; } else out[i] = h;
  }
  return out;
}

function faceNormals(pos: Float32Array, idx: ArrayLike<number>): Float32Array {
  const nt = idx.length / 3, out = new Float32Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    out[t * 3] = uy * vz - uz * vy; out[t * 3 + 1] = uz * vx - ux * vz; out[t * 3 + 2] = ux * vy - uy * vx;
  }
  return out;
}

function creased(pos: Float32Array, uv: Float32Array | null, idx: Uint32Array, grp: Uint16Array): { pos: Float32Array; nrm: Float32Array; uv: Float32Array | null; idx: Uint32Array; grp: Uint16Array } {
  const nt = idx.length / 3, fn = faceNormals(pos, idx), wid = weld(pos), around = new Map<number, number[]>();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { const w = wid[idx[t * 3 + k]], l = around.get(w); if (l) l.push(t); else around.set(w, [t]); }
  const unit = new Float32Array(nt * 3);
  for (let t = 0; t < nt; t++) { const l = Math.hypot(fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]) || 1; unit[t * 3] = fn[t * 3] / l; unit[t * 3 + 1] = fn[t * 3 + 1] / l; unit[t * 3 + 2] = fn[t * 3 + 2] / l; }
  const keyed = new Map<string, number>(), P: number[] = [], N: number[] = [], U: number[] = [], I = new Uint32Array(idx.length);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const v = idx[t * 3 + k], list = around.get(wid[v]) as number[];
    let x = 0, y = 0, z = 0;
    for (const o of list) if (unit[o * 3] * unit[t * 3] + unit[o * 3 + 1] * unit[t * 3 + 1] + unit[o * 3 + 2] * unit[t * 3 + 2] > CREASE_COS) { x += fn[o * 3]; y += fn[o * 3 + 1]; z += fn[o * 3 + 2]; }
    const l = Math.hypot(x, y, z) || 1;
    x /= l; y /= l; z /= l;
    const key = `${v}|${Math.round(x * 64)}|${Math.round(y * 64)}|${Math.round(z * 64)}`;
    let at = keyed.get(key);
    if (at === undefined) { at = P.length / 3; keyed.set(key, at); P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); N.push(x, y, z); if (uv) U.push(uv[v * 2], uv[v * 2 + 1]); }
    I[t * 3 + k] = at;
  }
  return { pos: Float32Array.from(P), nrm: Float32Array.from(N), uv: uv ? Float32Array.from(U) : null, idx: I, grp };
}

export function buildModelMesh(raw: RawModel, keys: string[]): Mesh {
  const nv = raw.pos.length / 3;
  if (!nv || raw.idx.length < 3) throw new Error('The model has no faces.');
  const pos = new Float32Array(nv * 3);
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < nv; i++) {
    const x = raw.pos[i * 3], y = -raw.pos[i * 3 + 1], z = -raw.pos[i * 3 + 2];
    if (!Number.isFinite(x + y + z)) throw new Error('The model has a vertex that is not a number.');
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const span = Math.max(x1 - x0, y1 - y0, z1 - z0) || 1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  for (let i = 0; i < nv; i++) { pos[i * 3] = (pos[i * 3] - cx) / span; pos[i * 3 + 1] = (pos[i * 3 + 1] - cy) / span; pos[i * 3 + 2] = (pos[i * 3 + 2] - cz) / span; }
  const keep: number[] = [], grp: number[] = [];
  const nt0 = raw.idx.length / 3, fn = faceNormals(pos, raw.idx);
  for (let t = 0; t < nt0; t++) {
    const a = raw.idx[t * 3], b = raw.idx[t * 3 + 1], c = raw.idx[t * 3 + 2];
    if (a === b || b === c || a === c || a >= nv || b >= nv || c >= nv) continue;
    if (Math.hypot(fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]) < 1e-14) continue;
    keep.push(a, b, c); grp.push(Math.min(raw.groups.length - 1, Math.max(0, raw.grp[t] ?? 0)));
  }
  if (!keep.length) throw new Error('The model has no usable faces.');
  const idx = Uint32Array.from(keep);
  const gn = faceNormals(pos, idx);
  let nrm: Float32Array | null = null;
  if (raw.nrm && raw.nrm.length === nv * 3) {
    nrm = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) { const x = raw.nrm[i * 3], y = -raw.nrm[i * 3 + 1], z = -raw.nrm[i * 3 + 2], l = Math.hypot(x, y, z) || 1; nrm[i * 3] = x / l; nrm[i * 3 + 1] = y / l; nrm[i * 3 + 2] = z / l; }
    for (let t = 0; t < idx.length / 3; t++) {
      let sx = 0, sy = 0, sz = 0;
      for (let k = 0; k < 3; k++) { const v = idx[t * 3 + k]; sx += (nrm as Float32Array)[v * 3]; sy += (nrm as Float32Array)[v * 3 + 1]; sz += (nrm as Float32Array)[v * 3 + 2]; }
      if (sx * gn[t * 3] + sy * gn[t * 3 + 1] + sz * gn[t * 3 + 2] < 0) { const s = idx[t * 3 + 1]; idx[t * 3 + 1] = idx[t * 3 + 2]; idx[t * 3 + 2] = s; }
    }
  } else {
    let vol = 0;
    for (let t = 0; t < idx.length / 3; t++) {
      const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
      vol += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) + pos[a + 1] * (pos[b + 2] * pos[c] - pos[b] * pos[c + 2]) + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
    }
    if (vol < -1e-9) for (let t = 0; t < idx.length / 3; t++) { const s = idx[t * 3 + 1]; idx[t * 3 + 1] = idx[t * 3 + 2]; idx[t * 3 + 2] = s; }
  }
  const uv = raw.uv && raw.uv.length === nv * 2 ? Float32Array.from(raw.uv) : null;
  const groups: MeshGroup[] = raw.groups.slice(0, MESH_GROUP_LIMIT).map((g) => ({ name: g.name, color: g.color, ...(g.image !== undefined && keys[g.image] ? { tex: keys[g.image] } : {}) }));
  const g16 = Uint16Array.from(grp.map((g) => Math.min(g, groups.length - 1)));
  const ext: [number, number, number] = [(x1 - x0) / span, (y1 - y0) / span, (z1 - z0) / span];
  if (nrm) return { pos, nrm, uv, idx, grp: g16, groups, ext };
  const c = creased(pos, uv, idx, g16);
  return { pos: c.pos, nrm: c.nrm, uv: c.uv, idx: c.idx, grp: c.grp, groups, ext };
}

export function encodeMesh(m: Mesh): Uint8Array<ArrayBuffer> {
  const nv = m.pos.length / 3, nt = m.idx.length / 3, wide = nv > 65535, head = new TextEncoder().encode(JSON.stringify({ groups: m.groups, ext: m.ext }));
  const jl = (head.length + 3) & ~3, size = 20 + jl + nv * 12 + nv * 6 + (m.uv ? nv * 8 : 0) + nt * 3 * (wide ? 4 : 2) + nt * 2;
  const out = new Uint8Array(size), dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true); dv.setUint32(4, nv, true); dv.setUint32(8, nt, true); dv.setUint32(12, (m.uv ? 2 : 0) | (wide ? 4 : 0) | 1, true); dv.setUint32(16, head.length, true);
  out.set(head, 20);
  let o = 20 + jl;
  for (let i = 0; i < nv * 3; i++, o += 4) dv.setFloat32(o, m.pos[i], true);
  for (let i = 0; i < nv * 3; i++, o += 2) dv.setInt16(o, Math.round(Math.max(-1, Math.min(1, m.nrm[i])) * 32767), true);
  if (m.uv) for (let i = 0; i < nv * 2; i++, o += 4) dv.setFloat32(o, m.uv[i], true);
  for (let i = 0; i < nt * 3; i++) { if (wide) { dv.setUint32(o, m.idx[i], true); o += 4; } else { dv.setUint16(o, m.idx[i], true); o += 2; } }
  for (let i = 0; i < nt; i++, o += 2) dv.setUint16(o, m.grp[i], true);
  return out;
}

export function decodeMesh(buf: ArrayBuffer): Mesh {
  const dv = new DataView(buf);
  if (buf.byteLength < 20 || dv.getUint32(0, true) !== MAGIC) throw new Error('This is not a formpth mesh.');
  const nv = dv.getUint32(4, true), nt = dv.getUint32(8, true), flags = dv.getUint32(12, true), hl = dv.getUint32(16, true), wide = (flags & 4) !== 0;
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, hl))) as { groups: MeshGroup[]; ext: [number, number, number] };
  let o = 20 + ((hl + 3) & ~3);
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), idx = new Uint32Array(nt * 3), grp = new Uint16Array(nt);
  for (let i = 0; i < nv * 3; i++, o += 4) pos[i] = dv.getFloat32(o, true);
  for (let i = 0; i < nv * 3; i++, o += 2) nrm[i] = dv.getInt16(o, true) / 32767;
  let uv: Float32Array | null = null;
  if (flags & 2) { uv = new Float32Array(nv * 2); for (let i = 0; i < nv * 2; i++, o += 4) uv[i] = dv.getFloat32(o, true); }
  for (let i = 0; i < nt * 3; i++) { if (wide) { idx[i] = dv.getUint32(o, true); o += 4; } else { idx[i] = dv.getUint16(o, true); o += 2; } }
  for (let i = 0; i < nt; i++, o += 2) grp[i] = dv.getUint16(o, true);
  return { pos, nrm, uv, idx, grp, groups: head.groups, ext: head.ext };
}

const reduced = new WeakMap<Mesh, Map<number, Mesh>>();

export function simplifyMesh(m: Mesh, target: number): Mesh {
  const nt = m.idx.length / 3, want = Math.max(4, Math.floor(target));
  if (nt <= want) return m;
  let cache = reduced.get(m);
  if (!cache) { cache = new Map(); reduced.set(m, cache); }
  const hit = cache.get(want);
  if (hit) return hit;
  const nv = m.pos.length / 3;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < nv; i++) { const x = m.pos[i * 3], y = m.pos[i * 3 + 1], z = m.pos[i * 3 + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  const span = Math.max(x1 - x0, y1 - y0, z1 - z0, 1e-9), cell = new Int32Array(nv);
  const assign = (res: number): number => {
    const ids = new Map<number, number>(), k = res / span, R = res + 1;
    for (let i = 0; i < nv; i++) {
      const key = Math.floor((m.pos[i * 3] - x0) * k) + Math.floor((m.pos[i * 3 + 1] - y0) * k) * R + Math.floor((m.pos[i * 3 + 2] - z0) * k) * R * R;
      let id = ids.get(key);
      if (id === undefined) { id = ids.size; ids.set(key, id); }
      cell[i] = id;
    }
    let n = 0;
    for (let t = 0; t < nt; t++) { const a = cell[m.idx[t * 3]], b = cell[m.idx[t * 3 + 1]], c = cell[m.idx[t * 3 + 2]]; if (a !== b && b !== c && a !== c) n++; }
    return n;
  };
  let lo = 2, hi = 2048;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (assign(mid) <= want) lo = mid; else hi = mid - 1; }
  assign(lo);
  const cn = new Set(cell).size, sp = new Float64Array(cn * 3), sn = new Float64Array(cn * 3), su = new Float64Array(cn * 2), cc = new Float64Array(cn);
  for (let i = 0; i < nv; i++) {
    const c = cell[i];
    sp[c * 3] += m.pos[i * 3]; sp[c * 3 + 1] += m.pos[i * 3 + 1]; sp[c * 3 + 2] += m.pos[i * 3 + 2];
    sn[c * 3] += m.nrm[i * 3]; sn[c * 3 + 1] += m.nrm[i * 3 + 1]; sn[c * 3 + 2] += m.nrm[i * 3 + 2];
    if (m.uv) { su[c * 2] += m.uv[i * 2]; su[c * 2 + 1] += m.uv[i * 2 + 1]; }
    cc[c]++;
  }
  const pos = new Float32Array(cn * 3), nrm = new Float32Array(cn * 3), uv = m.uv ? new Float32Array(cn * 2) : null;
  for (let c = 0; c < cn; c++) {
    pos[c * 3] = sp[c * 3] / cc[c]; pos[c * 3 + 1] = sp[c * 3 + 1] / cc[c]; pos[c * 3 + 2] = sp[c * 3 + 2] / cc[c];
    const l = Math.hypot(sn[c * 3], sn[c * 3 + 1], sn[c * 3 + 2]) || 1;
    nrm[c * 3] = sn[c * 3] / l; nrm[c * 3 + 1] = sn[c * 3 + 1] / l; nrm[c * 3 + 2] = sn[c * 3 + 2] / l;
    if (uv) { uv[c * 2] = su[c * 2] / cc[c]; uv[c * 2 + 1] = su[c * 2 + 1] / cc[c]; }
  }
  const idx: number[] = [], grp: number[] = [];
  for (let t = 0; t < nt; t++) { const a = cell[m.idx[t * 3]], b = cell[m.idx[t * 3 + 1]], c = cell[m.idx[t * 3 + 2]]; if (a !== b && b !== c && a !== c) { idx.push(a, b, c); grp.push(m.grp[t]); } }
  const out: Mesh = { pos, nrm, uv, idx: Uint32Array.from(idx), grp: Uint16Array.from(grp), groups: m.groups, ext: m.ext };
  cache.set(want, out);
  return out;
}

const meshes = new Map<string, Mesh>();
const failed = new Set<string>();
const loading = new Set<string>();
let epoch = 0, source: ((key: string) => Blob | undefined) | null = null, ready: (() => void) | null = null;

export const meshEpoch = (): number => epoch;
export function setMeshSource(find: (key: string) => Blob | undefined, onReady: () => void): void { source = find; ready = onReady; }
export function registerMesh(key: string, m: Mesh): void { meshes.set(key, m); failed.delete(key); epoch++; }

export function getMesh(key: string): Mesh | null {
  const hit = meshes.get(key);
  if (hit) return hit;
  if (!key || failed.has(key) || loading.has(key) || !source) return null;
  const blob = source(key);
  if (!blob) return null;
  loading.add(key);
  void blob.arrayBuffer().then((b) => { meshes.set(key, decodeMesh(b)); }).catch(() => { failed.add(key); }).finally(() => { loading.delete(key); epoch++; ready?.(); });
  return null;
}
