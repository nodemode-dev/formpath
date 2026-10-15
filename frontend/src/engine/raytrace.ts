export type V3 = [number, number, number];

export interface RayTexture { w: number; h: number; data: Uint8ClampedArray; lit: boolean; clip?: boolean }
export interface RayMesh { tris: number; pos: Float32Array; nrm: Float32Array; obj: Float32Array; solid: Int32Array; colors: Float32Array; uv?: Float32Array; uvOn?: Uint8Array; tex?: RayTexture }
export interface RayLight { dir: V3; color: V3; intensity: number; softness: number }
export interface RayGround { m: number[]; blur: number; opacity: number }
export type RayQuality = 'low' | 'medium' | 'high';
export interface RayInput {
  mesh: RayMesh; w: number; h: number; sx: number; sy: number; ox: number; oy: number; f: number; rot: number[]; axis: V3;
  lights: RayLight[]; ambient: number; highlight: number; shade: V3; look: string; texScale: number; quality: RayQuality; size: number; ground: RayGround | null; bias?: number; denoise?: number;
}
export interface RayResult { data: Uint8ClampedArray; w: number; h: number }

export const RAY_QUALITY: Record<RayQuality, { px: number; shadow: number; ao: number; aa: number; denoise: number }> = {
  low: { px: 130000, shadow: 1, ao: 1, aa: 2, denoise: 2 },
  medium: { px: 250000, shadow: 4, ao: 3, aa: 3, denoise: 1 },
  high: { px: 400000, shadow: 8, ao: 5, aa: 3, denoise: 0 },
};
export const RAY_DRAFT_PX = 40000;
let drafting = false, draftTaken = false;
export const setRayDraft = (on: boolean): void => { drafting = on; };
export const rayDrafting = (): boolean => { if (drafting) draftTaken = true; return drafting; };
export const rayDraftTaken = (): boolean => { const t = draftTaken; draftTaken = false; return t; };
export const TEXTURE_LOOKS = new Set(['brushed_metal', 'wood', 'rough']);

const BIG = 1e30, GOLD = 2.399963229728653, TAU = Math.PI * 2;
const stack = new Int32Array(160);
let hT = 0, hU = 0, hV = 0, hSlot = -1;

interface Bvh { box: Float64Array; left: Int32Array; start: Int32Array; count: Int32Array; tv: Float64Array; order: Int32Array; axis: Uint8Array }

function build(mesh: RayMesh): Bvh {
  const n = mesh.tris, p = mesh.pos, cen = new Float64Array(n * 3), order = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    order[i] = i;
    const k = i * 9;
    cen[i * 3] = (p[k] + p[k + 3] + p[k + 6]) / 3; cen[i * 3 + 1] = (p[k + 1] + p[k + 4] + p[k + 7]) / 3; cen[i * 3 + 2] = (p[k + 2] + p[k + 5] + p[k + 8]) / 3;
  }
  const cap = 2 * n + 1, box = new Float64Array(cap * 6), left = new Int32Array(cap).fill(-1), start = new Int32Array(cap), count = new Int32Array(cap), axis = new Uint8Array(cap);
  let used = 1;
  const work: number[] = [0, 0, n];
  while (work.length) {
    const hi = work.pop() as number, lo = work.pop() as number, nd = work.pop() as number;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, c0x = Infinity, c0y = Infinity, c0z = Infinity, c1x = -Infinity, c1y = -Infinity, c1z = -Infinity;
    for (let s = lo; s < hi; s++) {
      const t = order[s], k = t * 9;
      for (let v = 0; v < 3; v++) {
        const x = p[k + v * 3], y = p[k + v * 3 + 1], z = p[k + v * 3 + 2];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      const cx = cen[t * 3], cy = cen[t * 3 + 1], cz = cen[t * 3 + 2];
      if (cx < c0x) c0x = cx; if (cx > c1x) c1x = cx; if (cy < c0y) c0y = cy; if (cy > c1y) c1y = cy; if (cz < c0z) c0z = cz; if (cz > c1z) c1z = cz;
    }
    const b = nd * 6;
    box[b] = x0; box[b + 1] = y0; box[b + 2] = z0; box[b + 3] = x1; box[b + 4] = y1; box[b + 5] = z1;
    if (hi - lo <= 4) { start[nd] = lo; count[nd] = hi - lo; continue; }
    const ex = c1x - c0x, ey = c1y - c0y, ez = c1z - c0z, ax = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2, mid = ax === 0 ? (c0x + c1x) / 2 : ax === 1 ? (c0y + c1y) / 2 : (c0z + c1z) / 2;
    let i = lo, j = hi - 1;
    while (i <= j) {
      if (cen[order[i] * 3 + ax] < mid) i++;
      else { const s = order[i]; order[i] = order[j]; order[j] = s; j--; }
    }
    let m = i;
    if (m <= lo || m >= hi) m = (lo + hi) >> 1;
    const l = used;
    used += 2;
    left[nd] = l;
    axis[nd] = ax;
    work.push(l, lo, m, l + 1, m, hi);
  }
  const tv = new Float64Array(n * 9);
  for (let s = 0; s < n; s++) {
    const k = order[s] * 9, o = s * 9;
    tv[o] = p[k]; tv[o + 1] = p[k + 1]; tv[o + 2] = p[k + 2];
    tv[o + 3] = p[k + 3] - p[k]; tv[o + 4] = p[k + 4] - p[k + 1]; tv[o + 5] = p[k + 5] - p[k + 2];
    tv[o + 6] = p[k + 6] - p[k]; tv[o + 7] = p[k + 7] - p[k + 1]; tv[o + 8] = p[k + 8] - p[k + 2];
  }
  return { box, left, start, count, tv, order, axis };
}

function intersect(B: Bvh, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tmin: number, tmax: number, any: boolean): boolean {
  const ix = Math.abs(dx) > 1e-12 ? 1 / dx : BIG, iy = Math.abs(dy) > 1e-12 ? 1 / dy : BIG, iz = Math.abs(dz) > 1e-12 ? 1 / dz : BIG;
  const { box, left, start, count, tv, axis } = B;
  let sp = 0, best = tmax, found = false;
  stack[sp++] = 0;
  while (sp > 0) {
    const nd = stack[--sp], b = nd * 6;
    let t0 = tmin, t1 = best, a = (box[b] - ox) * ix, c = (box[b + 3] - ox) * ix, s: number;
    if (a > c) { s = a; a = c; c = s; }
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
    a = (box[b + 1] - oy) * iy; c = (box[b + 4] - oy) * iy;
    if (a > c) { s = a; a = c; c = s; }
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
    a = (box[b + 2] - oz) * iz; c = (box[b + 5] - oz) * iz;
    if (a > c) { s = a; a = c; c = s; }
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
    if (t0 > t1) continue;
    const l = left[nd];
    if (l >= 0) {
      const ax = axis[nd];
      if ((ax === 0 ? dx : ax === 1 ? dy : dz) < 0) { stack[sp++] = l; stack[sp++] = l + 1; } else { stack[sp++] = l + 1; stack[sp++] = l; }
      continue;
    }
    const s0 = start[nd], s1 = s0 + count[nd];
    for (let q = s0; q < s1; q++) {
      const k = q * 9, e1x = tv[k + 3], e1y = tv[k + 4], e1z = tv[k + 5], e2x = tv[k + 6], e2y = tv[k + 7], e2z = tv[k + 8];
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
      if (det > -1e-14 && det < 1e-14) continue;
      const inv = 1 / det, sx = ox - tv[k], sy = oy - tv[k + 1], sz = oz - tv[k + 2], u = (sx * px + sy * py + sz * pz) * inv;
      if (u < -1e-6 || u > 1.000001) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) * inv;
      if (v < -1e-6 || u + v > 1.000001) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (t <= tmin || t >= best) continue;
      best = t; hT = t; hU = u; hV = v; hSlot = q; found = true;
      if (any) return true;
    }
  }
  return found;
}

function hash3(x: number, y: number, z: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = hash3(ix, iy, iz), b = hash3(ix + 1, iy, iz), c = hash3(ix, iy + 1, iz), d = hash3(ix + 1, iy + 1, iz), e = hash3(ix, iy, iz + 1), f = hash3(ix + 1, iy, iz + 1), g = hash3(ix, iy + 1, iz + 1), hh = hash3(ix + 1, iy + 1, iz + 1);
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx, x2 = e + (f - e) * fx, x3 = g + (hh - g) * fx, y0 = x0 + (x1 - x0) * fy, y1 = x2 + (x3 - x2) * fy;
  return y0 + (y1 - y0) * fz;
}

const bump = (x: number, y: number, z: number): number => vnoise(x, y, z) * 0.65 + vnoise(x * 2.3 + 11.7, y * 2.3 + 3.1, z * 2.3 + 7.9) * 0.35;
const ign = (x: number, y: number): number => { const v = 52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1); return v - Math.floor(v); };
const clamp = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const len3 = (x: number, y: number, z: number): number => Math.sqrt(x * x + y * y + z * z);
const smooth = (a: number, b: number, v: number): number => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function blurPlane(a: Float32Array, w: number, h: number, r: number): void {
  if (r < 1) return;
  const tmp = new Float32Array(Math.max(w, h)), k = 1 / (2 * r + 1);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[o + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) { tmp[x] = acc * k; acc += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; }
      for (let x = 0; x < w; x++) a[o + x] = tmp[x];
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += a[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) { tmp[y] = acc * k; acc += a[Math.min(h - 1, y + r + 1) * w + x] - a[Math.max(0, y - r) * w + x]; }
      for (let y = 0; y < h; y++) a[y * w + x] = tmp[y];
    }
  }
}

function groundAlpha(inp: RayInput): Float32Array {
  const { w, h, mesh, f, ox, oy, sx, sy } = inp, g = inp.ground as RayGround, m = g.m, a = new Float32Array(w * h), p = mesh.pos;
  const X = new Float64Array(3), Y = new Float64Array(3);
  for (let t = 0; t < mesh.tris; t++) {
    for (let v = 0; v < 3; v++) {
      const k = t * 9 + v * 3, z = p[k + 2], kp = f > 0 ? f / Math.max(f * 0.05, f + z) : 1, rx = p[k] * kp, ry = p[k + 1] * kp;
      X[v] = (m[0] * rx + m[2] * ry + m[4] + ox) * sx; Y[v] = (m[1] * rx + m[3] * ry + m[5] + oy) * sy;
    }
    const x0 = Math.max(0, Math.floor(Math.min(X[0], X[1], X[2]))), x1 = Math.min(w - 1, Math.ceil(Math.max(X[0], X[1], X[2]))), y0 = Math.max(0, Math.floor(Math.min(Y[0], Y[1], Y[2]))), y1 = Math.min(h - 1, Math.ceil(Math.max(Y[0], Y[1], Y[2])));
    const den = (Y[1] - Y[2]) * (X[0] - X[2]) + (X[2] - X[1]) * (Y[0] - Y[2]);
    if (Math.abs(den) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5 - X[2], qy = y + 0.5 - Y[2], l0 = ((Y[1] - Y[2]) * qx + (X[2] - X[1]) * qy) / den, l1 = ((Y[2] - Y[0]) * qx + (X[0] - X[2]) * qy) / den, l2 = 1 - l0 - l1;
      if (l0 >= -1e-4 && l1 >= -1e-4 && l2 >= -1e-4) a[y * w + x] = 1;
    }
  }
  blurPlane(a, w, h, Math.round(g.blur * Math.max(sx, sy) * 0.9));
  for (let i = 0; i < a.length; i++) a[i] *= g.opacity;
  return a;
}

class Tracer {
  readonly bvh: Bvh;
  private readonly Q: { px: number; shadow: number; ao: number; aa: number; denoise: number };
  private readonly w: number; private readonly h: number; private readonly sx: number; private readonly sy: number; private readonly ox: number; private readonly oy: number; private readonly f: number;
  private readonly lights: RayLight[]; private readonly ambient: number; private readonly highlight: number; private readonly shade: V3; private readonly look: string; private readonly sc: number;
  private readonly mesh: RayMesh; private readonly rot: number[]; private readonly axis: V3; private readonly size: number; private readonly eps: number; private readonly aoDist: number; private readonly zNear: number;
  private rox = 0; private roy = 0; private roz = 0; private rdx = 0; private rdy = 1; private rdz = 0;
  private px = 0; private py = 0; private pz = 0; private nx = 0; private ny = 0; private nz = 0; private gx = 0; private gy = 0; private gz = 0; private vx = 0; private vy = 0; private vz = -1; private qx = 0; private qy = 0; private qz = 0; private sol = 0;
  private readonly vv: Float64Array;
  private tal = 0; private tu = 0; private tvv = 0; private texOn = false; private tcr = 0; private tcg = 0; private tcb = 0; private tca = 0;

  constructor(private readonly inp: RayInput) {
    this.Q = inp.denoise === undefined ? RAY_QUALITY[inp.quality] : { ...RAY_QUALITY[inp.quality], denoise: inp.denoise };
    this.mesh = inp.mesh; this.w = inp.w; this.h = inp.h; this.sx = inp.sx; this.sy = inp.sy; this.ox = inp.ox; this.oy = inp.oy; this.f = inp.f;
    this.lights = inp.lights; this.ambient = inp.ambient; this.highlight = inp.highlight; this.shade = inp.shade; this.look = inp.look; this.sc = Math.max(0.05, inp.texScale / 100);
    this.rot = inp.rot; this.axis = inp.axis; this.size = Math.max(1, inp.size); this.eps = inp.bias ?? this.size * 0.0012; this.aoDist = this.size * 0.16;
    this.bvh = build(inp.mesh);
    this.vv = new Float64Array(Math.max(1, inp.lights.length));
    let z = Infinity;
    for (let i = 2; i < inp.mesh.pos.length; i += 3) if (inp.mesh.pos[i] < z) z = inp.mesh.pos[i];
    this.zNear = z - this.size * 0.1 - 1;
  }

  private ray(x: number, y: number): void {
    const X = x / this.sx - this.ox, Y = y / this.sy - this.oy;
    if (this.f > 0) { const l = len3(X, Y, this.f); this.rox = 0; this.roy = 0; this.roz = -this.f; this.rdx = X / l; this.rdy = Y / l; this.rdz = this.f / l; }
    else { this.rox = X; this.roy = Y; this.roz = this.zNear; this.rdx = 0; this.rdy = 0; this.rdz = 1; }
  }

  private surf(slot: number, u: number, v: number): void {
    const B = this.bvh, tv = B.tv, k = slot * 9, tri = B.order[slot], e1x = tv[k + 3], e1y = tv[k + 4], e1z = tv[k + 5], e2x = tv[k + 6], e2y = tv[k + 7], e2z = tv[k + 8], w0 = 1 - u - v;
    this.px = tv[k] + u * e1x + v * e2x; this.py = tv[k + 1] + u * e1y + v * e2y; this.pz = tv[k + 2] + u * e1z + v * e2z;
    let gx = e1y * e2z - e1z * e2y, gy = e1z * e2x - e1x * e2z, gz = e1x * e2y - e1y * e2x;
    const gl = len3(gx, gy, gz) || 1;
    gx /= gl; gy /= gl; gz /= gl;
    const nr = this.mesh.nrm, b = tri * 9;
    let nx = w0 * nr[b] + u * nr[b + 3] + v * nr[b + 6], ny = w0 * nr[b + 1] + u * nr[b + 4] + v * nr[b + 7], nz = w0 * nr[b + 2] + u * nr[b + 5] + v * nr[b + 8];
    const nl = len3(nx, ny, nz);
    if (nl < 1e-6) { nx = gx; ny = gy; nz = gz; } else { nx /= nl; ny /= nl; nz /= nl; }
    if (this.f > 0) { const vx = -this.px, vy = -this.py, vz = -this.f - this.pz, vl = len3(vx, vy, vz) || 1; this.vx = vx / vl; this.vy = vy / vl; this.vz = vz / vl; } else { this.vx = 0; this.vy = 0; this.vz = -1; }
    if (nx * this.vx + ny * this.vy + nz * this.vz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    if (gx * nx + gy * ny + gz * nz < 0) { gx = -gx; gy = -gy; gz = -gz; }
    this.nx = nx; this.ny = ny; this.nz = nz; this.gx = gx; this.gy = gy; this.gz = gz;
    const ob = this.mesh.obj;
    this.qx = w0 * ob[b] + u * ob[b + 3] + v * ob[b + 6]; this.qy = w0 * ob[b + 1] + u * ob[b + 4] + v * ob[b + 7]; this.qz = w0 * ob[b + 2] + u * ob[b + 5] + v * ob[b + 8];
    this.sol = this.mesh.solid[tri];
    const on = this.mesh.uvOn;
    if (on && on[tri]) {
      const uv = this.mesh.uv as Float32Array, q = tri * 6;
      this.tu = w0 * uv[q] + u * uv[q + 2] + v * uv[q + 4]; this.tvv = w0 * uv[q + 1] + u * uv[q + 3] + v * uv[q + 5];
      this.texOn = true;
    } else this.texOn = false;
  }

  private sample(): void {
    const T = this.mesh.tex as RayTexture, W = T.w, H = T.h, d = T.data;
    this.tca = 0; this.tal = 0;
    if (this.tu < 0 || this.tu > 1 || this.tvv < 0 || this.tvv > 1) return;
    const x = this.tu * W - 0.5, y = this.tvv * H - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    let r = 0, g = 0, b = 0, a = 0, cov = 0;
    for (let k = 0; k < 4; k++) {
      const xi = Math.min(W - 1, Math.max(0, x0 + (k & 1))), yi = Math.min(H - 1, Math.max(0, y0 + (k >> 1))), wt = (k & 1 ? fx : 1 - fx) * (k & 2 ? fy : 1 - fy), o = (yi * W + xi) * 4, al = (d[o + 3] / 255) * wt;
      r += d[o] * al; g += d[o + 1] * al; b += d[o + 2] * al; a += al; cov += wt;
    }
    if (a < 1e-6) return;
    this.tal = cov > 0 ? a / cov : 0;
    this.tcr = r / (a * 255); this.tcg = g / (a * 255); this.tcb = b / (a * 255); this.tca = T.clip ? 1 : this.tal;
  }

  private clipTest(slot: number, u: number, v: number): boolean {
    const tri = this.bvh.order[slot], on = this.mesh.uvOn;
    if (!on || !on[tri]) return true;
    const uv = this.mesh.uv as Float32Array, q = tri * 6, w0 = 1 - u - v;
    this.tu = w0 * uv[q] + u * uv[q + 2] + v * uv[q + 4]; this.tvv = w0 * uv[q + 1] + u * uv[q + 3] + v * uv[q + 5];
    this.sample();
    return this.tal >= 0.5;
  }

  private combine(ao: number, out: Float64Array): void {
    const tex = this.texOn ? (this.mesh.tex as RayTexture) : null;
    if (tex) this.sample();
    this.shadeInto(ao, out, tex !== null && tex.lit);
    if (tex && !tex.lit && this.tca > 0) { const a = this.tca; out[0] += (this.tcr - out[0]) * a; out[1] += (this.tcg - out[1]) * a; out[2] += (this.tcb - out[2]) * a; }
  }

  private lightVis(li: number, S: number, x: number, y: number, seed: number): number {
    const Lt = this.lights[li], lx = Lt.dir[0], ly = Lt.dir[1], lz = Lt.dir[2];
    if (this.nx * lx + this.ny * ly + this.nz * lz <= 0) return 0;
    const sg = this.gx * lx + this.gy * ly + this.gz * lz >= 0 ? 1 : -1, e = this.eps * sg, ox = this.px + this.gx * e, oy = this.py + this.gy * e, oz = this.pz + this.gz * e, B = this.bvh;
    const cone = Lt.softness * 0.45;
    if (cone < 0.004) return intersect(B, ox, oy, oz, lx, ly, lz, 0, BIG, true) ? 0 : 1;
    let ax = 1, ay = 0, az = 0;
    if (Math.abs(lx) > 0.8) { ax = 0; ay = 1; }
    let t1x = ly * az - lz * ay, t1y = lz * ax - lx * az, t1z = lx * ay - ly * ax;
    const tl = len3(t1x, t1y, t1z);
    t1x /= tl; t1y /= tl; t1z /= tl;
    const t2x = ly * t1z - lz * t1y, t2y = lz * t1x - lx * t1z, t2z = lx * t1y - ly * t1x, rot = ign(x, y) * TAU + seed * 1.7, jit = ign(y + 5, x + 3);
    let occ = 0;
    for (let k = 0; k < S; k++) {
      const r = Math.sqrt((k + jit) / S) * cone, th = k * GOLD + rot, c = Math.cos(th) * r, s = Math.sin(th) * r;
      let dx = lx + t1x * c + t2x * s, dy = ly + t1y * c + t2y * s, dz = lz + t1z * c + t2z * s;
      const dl = len3(dx, dy, dz);
      dx /= dl; dy /= dl; dz /= dl;
      if ((dx * this.gx + dy * this.gy + dz * this.gz) * sg <= 0 || intersect(B, ox, oy, oz, dx, dy, dz, 0, BIG, true)) occ++;
    }
    return 1 - occ / S;
  }

  private occlusion(S: number, x: number, y: number, seed: number): number {
    if (S <= 0) return 1;
    const nx = this.nx, ny = this.ny, nz = this.nz, ox = this.px + this.gx * this.eps, oy = this.py + this.gy * this.eps, oz = this.pz + this.gz * this.eps, B = this.bvh;
    let ax = 1, ay = 0, az = 0;
    if (Math.abs(nx) > 0.8) { ax = 0; ay = 1; }
    let t1x = ny * az - nz * ay, t1y = nz * ax - nx * az, t1z = nx * ay - ny * ax;
    const tl = len3(t1x, t1y, t1z);
    t1x /= tl; t1y /= tl; t1z /= tl;
    const t2x = ny * t1z - nz * t1y, t2y = nz * t1x - nx * t1z, t2z = nx * t1y - ny * t1x, rot = ign(x + 37, y + 11) * TAU + seed * 2.1, jit = ign(y + 17, x + 29);
    let occ = 0;
    for (let k = 0; k < S; k++) {
      const q = (k + jit) / S, r = Math.sqrt(q), th = k * GOLD + rot, c = Math.cos(th) * r, s = Math.sin(th) * r, lz = Math.sqrt(1 - q);
      const dx = t1x * c + t2x * s + nx * lz, dy = t1y * c + t2y * s + ny * lz, dz = t1z * c + t2z * s + nz * lz;
      if (dx * this.gx + dy * this.gy + dz * this.gz > 0.04 && intersect(B, ox, oy, oz, dx, dy, dz, 0, this.aoDist, true)) occ++;
    }
    return 1 - occ / S;
  }

  private shadeInto(ao: number, out: Float64Array, lit: boolean): void {
    const look = this.look, sol = this.sol * 3, col = this.mesh.colors, sc = this.sc, size = this.size;
    let br = col[sol], bg = col[sol + 1], bb = col[sol + 2], nx = this.nx, ny = this.ny, nz = this.nz, hard = 12;
    const qx = this.qx, qy = this.qy, qz = this.qz;
    if (look === 'wood') {
      const unit = (size / 14) * sc, c = qx / unit, warp = (vnoise(qx / (unit * 1.7) + (qz / unit) * 0.3, qy / (unit * 3), qz / (unit * 0.7)) - 0.5) * 3.2, rr = c + warp, v = rr - Math.floor(rr);
      const band = Math.pow(0.5 - 0.5 * Math.cos(v * TAU), 2.2), fibre = vnoise((qx / unit) * 9, (qy / unit) * 0.5, (qz / unit) * 3), t = clamp(band * 0.85 + (fibre - 0.5) * 0.4);
      br = (0.82 + (0.46 - 0.82) * t) * 0.8 + br * 0.2; bg = (0.6 + (0.27 - 0.6) * t) * 0.8 + bg * 0.2; bb = (0.36 + (0.12 - 0.36) * t) * 0.8 + bb * 0.2;
    } else if (look === 'rough') {
      const unit = (size / 55) * sc, hh = 0.3, x = qx / unit, y = qy / unit, z = qz / unit;
      const g0 = (bump(x + hh, y, z) - bump(x - hh, y, z)) / (2 * hh), g1 = (bump(x, y + hh, z) - bump(x, y - hh, z)) / (2 * hh), g2 = (bump(x, y, z + hh) - bump(x, y, z - hh)) / (2 * hh), R = this.rot;
      const gx = R[0] * g0 + R[1] * g1 + R[2] * g2, gy = R[3] * g0 + R[4] * g1 + R[5] * g2, gz = R[6] * g0 + R[7] * g1 + R[8] * g2, d = gx * nx + gy * ny + gz * nz;
      nx -= (gx - nx * d) * 0.55; ny -= (gy - ny * d) * 0.55; nz -= (gz - nz * d) * 0.55;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      hard = 9;
    }
    if (lit && this.tca > 0) { const t = this.tca; br += (this.tcr - br) * t; bg += (this.tcg - bg) * t; bb += (this.tcb - bb) * t; }
    const vx = this.vx, vy = this.vy, vz = this.vz, metal = look === 'metal' || look === 'brushed_metal';
    let dr = 0, dg = 0, db = 0, sr = 0, sg = 0, sb = 0;
    const brushed = look === 'brushed_metal';
    let tx = 0, ty = 0, tz = 0, bx = 0, by = 0, bz = 0;
    if (brushed) {
      const a = this.axis, d = a[0] * nx + a[1] * ny + a[2] * nz;
      tx = a[0] - nx * d; ty = a[1] - ny * d; tz = a[2] - nz * d;
      let l = Math.hypot(tx, ty, tz);
      if (l < 1e-4) { tx = ny; ty = -nx; tz = 0; l = Math.hypot(tx, ty, tz) || 1; }
      tx /= l; ty /= l; tz /= l;
      bx = ny * tz - nz * ty; by = nz * tx - nx * tz; bz = nx * ty - ny * tx;
    }
    for (let i = 0; i < this.lights.length; i++) {
      const vis = this.vv[i];
      if (vis <= 0) continue;
      const Lt = this.lights[i], lx = Lt.dir[0], ly = Lt.dir[1], lz = Lt.dir[2], ndl = nx * lx + ny * ly + nz * lz;
      if (ndl <= 0) continue;
      const k = vis * Lt.intensity;
      dr += Lt.color[0] * k * ndl; dg += Lt.color[1] * k * ndl; db += Lt.color[2] * k * ndl;
      let hx = lx + vx, hy = ly + vy, hz = lz + vz;
      const hl = len3(hx, hy, hz) || 1;
      hx /= hl; hy /= hl; hz /= hl;
      const nh = Math.max(0, nx * hx + ny * hy + nz * hz);
      let s = 0;
      if (brushed) { const ht = hx * tx + hy * ty + hz * tz, hb = hx * bx + hy * by + hz * bz; s = Math.exp(-((ht / 0.1) ** 2 + (hb / 0.5) ** 2) / Math.max(0.15, nh * nh)) * 0.9; }
      else if (metal) s = Math.pow(nh, 14) * 1.4;
      else if (look !== 'matte') s = Math.pow(nh, hard) * (look === 'rough' ? 0.45 : 1);
      s *= this.highlight * k;
      sr += Lt.color[0] * s; sg += Lt.color[1] * s; sb += Lt.color[2] * s;
    }
    const amb = this.ambient, a = amb * ao, mix = (1 - amb) * (0.65 + 0.35 * ao);
    if (metal) {
      const dn = nx * vx + ny * vy + nz * vz, rx = 2 * dn * nx - vx, ry = 2 * dn * ny - vy;
      let env = 0.12 + 0.93 * smooth(0.36, 0.64, 0.5 - 0.5 * ry) + 0.1 * (1 - Math.abs(rx));
      if (brushed) {
        const c = (qy * 0.9 + qz * 0.3 + qx * 0.05) / (0.9 * sc), n1 = vnoise(c * 1.7, 0.5, 0.5) * 0.6 + vnoise(c * 7.3, 3.1, 1.2) * 0.4;
        env = (0.55 + (env - 0.55) * 0.55) * (0.8 + 0.4 * n1);
      }
      const ke = 0.62 * (0.5 + 0.5 * ao) * env;
      out[0] = clamp(br * (0.3 * a + 0.75 * mix * dr + ke) + br * sr + sr * 0.25);
      out[1] = clamp(bg * (0.3 * a + 0.75 * mix * dg + ke) + bg * sg + sg * 0.25);
      out[2] = clamp(bb * (0.3 * a + 0.75 * mix * db + ke) + bb * sb + sb * 0.25);
      return;
    }
    const tr = clamp(a + mix * dr), tg = clamp(a + mix * dg), tb = clamp(a + mix * db), sh = this.shade;
    const cr = sh[0] + (br - sh[0]) * tr, cg = sh[1] + (bg - sh[1]) * tg, cb = sh[2] + (bb - sh[2]) * tb;
    out[0] = clamp(cr + (1 - cr) * clamp(sr)); out[1] = clamp(cg + (1 - cg) * clamp(sg)); out[2] = clamp(cb + (1 - cb) * clamp(sb));
  }

  run(out: Uint8ClampedArray, ground: Float32Array | null): void {
    const { w, h, Q } = this, n = w * h, L = this.lights.length, B = this.bvh;
    const hit = new Int32Array(n).fill(-1), hu = new Float32Array(n), hv = new Float32Array(n), ht = new Float32Array(n), nb = new Float32Array(n * 3);
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    const mp = this.mesh.pos;
    for (let i = 0; i < mp.length; i += 3) {
      const kp = this.f > 0 ? this.f / Math.max(this.f * 0.05, this.f + mp[i + 2]) : 1, X = (this.ox + mp[i] * kp) * this.sx, Y = (this.oy + mp[i + 1] * kp) * this.sy;
      if (X < bx0) bx0 = X; if (X > bx1) bx1 = X; if (Y < by0) by0 = Y; if (Y > by1) by1 = Y;
    }
    const i0 = Math.max(0, Math.floor(bx0) - 1), i1 = Math.min(w - 1, Math.ceil(bx1) + 1), j0 = Math.max(0, Math.floor(by0) - 1), j1 = Math.min(h - 1, Math.ceil(by1) + 1);
    ht.fill(BIG);
    const clip = !!this.mesh.tex?.clip, tv = B.tv, persp = this.f > 0, XS = new Float64Array(3), YS = new Float64Array(3);
    for (let s = 0; s < this.mesh.tris; s++) {
      const k = s * 9;
      for (let v = 0; v < 3; v++) {
        const o = v ? k + 3 * v : k, x = tv[k] + (v ? tv[o] : 0), y = tv[k + 1] + (v ? tv[o + 1] : 0), z = tv[k + 2] + (v ? tv[o + 2] : 0), kp = persp ? this.f / Math.max(this.f * 0.05, this.f + z) : 1;
        XS[v] = (this.ox + x * kp) * this.sx; YS[v] = (this.oy + y * kp) * this.sy;
      }
      const ta = Math.max(i0, Math.floor(Math.min(XS[0], XS[1], XS[2])) - 1), tb = Math.min(i1, Math.ceil(Math.max(XS[0], XS[1], XS[2])) + 1), tc = Math.max(j0, Math.floor(Math.min(YS[0], YS[1], YS[2])) - 1), td = Math.min(j1, Math.ceil(Math.max(YS[0], YS[1], YS[2])) + 1);
      const e1x = tv[k + 3], e1y = tv[k + 4], e1z = tv[k + 5], e2x = tv[k + 6], e2y = tv[k + 7], e2z = tv[k + 8];
      for (let j = tc; j <= td; j++) for (let i = ta; i <= tb; i++) {
        this.ray(i + 0.5, j + 0.5);
        const dx = this.rdx, dy = this.rdy, dz = this.rdz, px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-14 && det < 1e-14) continue;
        const inv = 1 / det, sx = this.rox - tv[k], sy = this.roy - tv[k + 1], sz = this.roz - tv[k + 2], u = (sx * px + sy * py + sz * pz) * inv;
        if (u < -1e-6 || u > 1.000001) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < -1e-6 || u + v > 1.000001) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv, p = j * w + i;
        if (t <= 0 || t >= ht[p]) continue;
        if (clip && !this.clipTest(s, u, v)) continue;
        hit[p] = s; hu[p] = u; hv[p] = v; ht[p] = t;
      }
    }
    const vis = new Float32Array(Math.max(1, L) * n), ao = new Float32Array(n), soft = this.lights.map((l) => (l.softness * 0.45 < 0.004 ? 1 : Q.shadow));
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const p = j * w + i;
      if (hit[p] < 0) continue;
      this.surf(hit[p], hu[p], hv[p]);
      nb[p * 3] = this.nx; nb[p * 3 + 1] = this.ny; nb[p * 3 + 2] = this.nz;
      for (let li = 0; li < L; li++) vis[li * n + p] = this.lightVis(li, soft[li], i, j, 0);
      ao[p] = this.occlusion(Q.ao, i, j, 0);
    }
    const dth = this.size * 0.03;
    const acc = new Float64Array(Math.max(1, L));
    for (let pass = 0; pass < Q.denoise; pass++) {
      const v2 = new Float32Array(vis.length), a2 = new Float32Array(n);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const p = j * w + i;
        if (hit[p] < 0) continue;
        let wsum = 0, ra = 0;
        acc.fill(0);
        for (let dj = -1; dj <= 1; dj++) {
          const y = j + dj;
          if (y < 0 || y >= h) continue;
          for (let di = -1; di <= 1; di++) {
            const x = i + di;
            if (x < 0 || x >= w) continue;
            const q = y * w + x;
            if (hit[q] < 0 || Math.abs(ht[q] - ht[p]) > dth || nb[q * 3] * nb[p * 3] + nb[q * 3 + 1] * nb[p * 3 + 1] + nb[q * 3 + 2] * nb[p * 3 + 2] < 0.88) continue;
            wsum++; ra += ao[q];
            for (let li = 0; li < L; li++) acc[li] += vis[li * n + q];
          }
        }
        a2[p] = ra / wsum;
        for (let li = 0; li < L; li++) v2[li * n + p] = acc[li] / wsum;
      }
      vis.set(v2); ao.set(a2);
    }
    const edge = new Uint8Array(n), mark = (a: number, b: number): void => {
      const ha = hit[a] >= 0, hb = hit[b] >= 0;
      if (ha !== hb || (ha && (Math.abs(ht[a] - ht[b]) > dth || nb[a * 3] * nb[b * 3] + nb[a * 3 + 1] * nb[b * 3 + 1] + nb[a * 3 + 2] * nb[b * 3 + 2] < 0.8 || this.mesh.solid[B.order[hit[a]]] !== this.mesh.solid[B.order[hit[b]]]))) { edge[a] = 1; edge[b] = 1; }
    };
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const p = j * w + i; if (i + 1 < w) mark(p, p + 1); if (j + 1 < h) mark(p, p + w); }
    const rgb = new Float64Array(3), g = Q.aa, gg = g * g;
    const put = (p: number, r: number, gc: number, b: number, cov: number): void => {
      const sa = ground ? ground[p] : 0, a = cov + sa * (1 - cov);
      if (a <= 0) return;
      const k = (cov / a) * 255, o = p * 4;
      out[o] = r * k; out[o + 1] = gc * k; out[o + 2] = b * k; out[o + 3] = a * 255;
    };
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const p = j * w + i;
      if (edge[p]) {
        let r = 0, gc = 0, b = 0, c = 0;
        for (let sb = 0; sb < g; sb++) for (let sa = 0; sa < g; sa++) {
          this.ray(i + (sa + 0.5) / g, j + (sb + 0.5) / g);
          if (!intersect(B, this.rox, this.roy, this.roz, this.rdx, this.rdy, this.rdz, 0, BIG, false)) continue;
          if (clip && !this.clipTest(hSlot, hU, hV)) continue;
          this.surf(hSlot, hU, hV);
          for (let li = 0; li < L; li++) this.vv[li] = this.lightVis(li, 1, i * g + sa, j * g + sb, sa + sb * g);
          this.combine(this.occlusion(Math.min(2, Q.ao), i * g + sa, j * g + sb, sa + sb * g), rgb);
          r += rgb[0]; gc += rgb[1]; b += rgb[2]; c++;
        }
        if (c) put(p, r / c, gc / c, b / c, c / gg);
        else if (ground && ground[p] > 0) put(p, 0, 0, 0, 0);
        continue;
      }
      if (hit[p] < 0) { if (ground && ground[p] > 0) put(p, 0, 0, 0, 0); continue; }
      this.surf(hit[p], hu[p], hv[p]);
      for (let li = 0; li < L; li++) this.vv[li] = vis[li * n + p];
      this.combine(ao[p], rgb);
      put(p, rgb[0], rgb[1], rgb[2], 1);
    }
  }
}

export function rayTrace(inp: RayInput): RayResult {
  const out = new Uint8ClampedArray(inp.w * inp.h * 4), ground = inp.ground ? groundAlpha(inp) : null;
  if (!inp.mesh.tris) {
    if (ground) for (let p = 0; p < ground.length; p++) out[p * 4 + 3] = ground[p] * 255;
    return { data: out, w: inp.w, h: inp.h };
  }
  new Tracer(inp).run(out, ground);
  return { data: out, w: inp.w, h: inp.h };
}
