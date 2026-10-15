import { RAY_DRAFT_PX, RAY_QUALITY, rayDrafting, rayTrace, type RayLight, type RayMesh, type RayQuality } from './raytrace';
import { rotator, surfaceOf, type Lighting, type V3 } from './threed';
import type { Effect } from './types';

export interface InflatePlanes { w: number; h: number; r: Float32Array; g: Float32Array; b: Float32Array; a: Float32Array }
export interface InflateFrame { x: number; y: number; w: number; h: number; scale: number }

const CELLS: Record<RayQuality, number> = { low: 6000, medium: 14000, high: 30000 };

export function inflateTrace(px: InflatePlanes, S: Float32Array, quality: unknown, F: InflateFrame, L: Lighting, rx: number, ry: number, rz: number, params?: Effect['params']): InflatePlanes {
  const { w, h } = px, n = w * h, out: InflatePlanes = { w, h, r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n) };
  let bx0 = w, by0 = h, bx1 = -1, by1 = -1, count = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px.a[y * w + x] > 0.5) { count++; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  if (bx1 < 0) return out;
  const asked = quality === 'low' || quality === 'high' ? quality : 'medium', q: RayQuality = rayDrafting() ? 'low' : asked;
  const cells = rayDrafting() ? 3000 : CELLS[asked], g = Math.max(1, Math.ceil(Math.sqrt(count / cells)));
  const gx0 = bx0 - 2 * g, gy0 = by0 - 2 * g, cols = Math.ceil((bx1 - bx0 + 1) / g) + 4, rows = Math.ceil((by1 - by0 + 1) / g) + 4;
  const mark = new Uint8Array(cols * rows);
  for (let y = by0; y <= by1; y++) {
    const cj = Math.floor((y - gy0) / g);
    for (let x = bx0; x <= bx1; x++) if (px.a[y * w + x] > 0.02) mark[cj * cols + Math.floor((x - gx0) / g)] = 1;
  }
  const cell = new Uint8Array(cols * rows);
  let used = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let on = 0;
    for (let dj = -1; dj <= 1 && !on; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < cols && b < rows && mark[b * cols + a]) { on = 1; break; } }
    cell[j * cols + i] = on;
    used += on;
  }
  const turn = rotator(rx, ry, rz), ex = turn.fwd([1, 0, 0]), ey = turn.fwd([0, 1, 0]), ez = turn.fwd([0, 0, 1]);
  const R = [ex[0], ey[0], ez[0], ex[1], ey[1], ez[1], ex[2], ey[2], ez[2]], tilted = !!(rx || ry || rz), bottom = R[8] < 0;
  const cx = F.x + F.w / 2, cy = F.y + F.h / 2, vw = cols + 1;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : S[y * w + x]);
  const vp = new Float32Array(vw * (rows + 1) * 3), vn = new Float32Array(vw * (rows + 1) * 3);
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const x = gx0 + i * g, y = gy0 + j * g, z = -at(x, y), hx = (at(x + g, y) - at(x - g, y)) / (2 * g), hy = (at(x, y + g) - at(x, y - g)) / (2 * g), l = Math.hypot(hx, hy, 1), o = (j * vw + i) * 3;
    vp[o] = x + 0.5 - cx; vp[o + 1] = y + 0.5 - cy; vp[o + 2] = z;
    vn[o] = -hx / l; vn[o + 1] = -hy / l; vn[o + 2] = -1 / l;
  }
  const tris = used * 2 * (bottom ? 2 : 1), pos = new Float32Array(tris * 9), nrm = new Float32Array(tris * 9), obj = new Float32Array(tris * 9), uv = new Float32Array(tris * 6), uvOn = new Uint8Array(tris), solid = new Int32Array(tris);
  let t = 0;
  const view = (a: V3): V3 => turn.fwd(a);
  const put = (a: number, b: number, c: number, flat: boolean): void => {
    for (let k = 0; k < 3; k++) {
      const o = (k === 0 ? a : k === 1 ? b : c) * 3, p: V3 = [vp[o], vp[o + 1], flat ? 0 : vp[o + 2]], nn: V3 = flat ? [0, 0, 1] : [vn[o], vn[o + 1], vn[o + 2]], pv = view(p), nv = view(nn), d = t * 9 + k * 3;
      pos[d] = pv[0]; pos[d + 1] = pv[1]; pos[d + 2] = pv[2];
      nrm[d] = nv[0]; nrm[d + 1] = nv[1]; nrm[d + 2] = nv[2];
      obj[d] = p[0]; obj[d + 1] = p[1]; obj[d + 2] = p[2];
      uv[t * 6 + k * 2] = (p[0] + cx) / w; uv[t * 6 + k * 2 + 1] = (p[1] + cy) / h;
    }
    uvOn[t] = 1;
    t++;
  };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (!cell[j * cols + i]) continue;
    const a = j * vw + i, b = a + 1, c = a + vw + 1, d = a + vw;
    put(a, b, c, false); put(a, c, d, false);
    if (bottom) { put(a, c, b, true); put(a, d, c, true); }
  }
  let ar = 0, ag = 0, ab = 0, an = 0;
  const data = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) { data[i * 4] = px.r[i] * 255; data[i * 4 + 1] = px.g[i] * 255; data[i * 4 + 2] = px.b[i] * 255; data[i * 4 + 3] = px.a[i] * 255; if (px.a[i] > 0.5) { ar += px.r[i]; ag += px.g[i]; ab += px.b[i]; an++; } }
  const colors = new Float32Array([ar / an, ag / an, ab / an]);
  let top = 0;
  for (let i = 0; i < n; i++) if (S[i] > top) top = S[i];
  const reach = Math.min(Math.max(bx1 - bx0, by1 - by0) + 1, Math.max(24, top * 4));
  const mesh: RayMesh = { tris, pos, nrm, obj, solid, colors, uv, uvOn, tex: { w, h, data, lit: true, clip: true } };
  const lights: RayLight[] = L.srcs ? L.srcs.map((s) => ({ dir: s.dir, color: s.color, intensity: s.intensity, softness: s.softness })) : [{ dir: L.light, color: [1, 1, 1], intensity: L.intensity, softness: 0 }];
  const area = (bx1 - bx0 + 5) * (by1 - by0 + 5), budget = rayDrafting() ? RAY_DRAFT_PX : RAY_QUALITY[q].px, k = area > budget ? Math.sqrt(budget / area) : 1;
  const tw = Math.max(1, Math.ceil(w * k)), th = Math.max(1, Math.ceil(h * k)), sx = tw / w, sy = th / h;
  const res = rayTrace({ mesh, w: tw, h: th, sx, sy, ox: cx, oy: cy, f: 0, rot: R, axis: [R[0], R[3], R[6]], lights, ambient: L.ambient, highlight: L.highlight, shade: L.shade, look: L.look, texScale: 100, quality: q, size: reach, ground: null, surface: params ? surfaceOf(params) : null, bias: Math.max(0.5, g * 0.7), denoise: Math.max(RAY_QUALITY[q].denoise, 2) });
  const d = res.data, px4 = [0, 0, 0, 0];
  const read = (i: number, j: number): void => {
    const fx = (i + 0.5) * sx - 0.5, fy = (j + 0.5) * sy - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    let r = 0, g = 0, b = 0, a = 0;
    for (let c = 0; c < 4; c++) {
      const xi = Math.min(tw - 1, Math.max(0, x0 + (c & 1))), yi = Math.min(th - 1, Math.max(0, y0 + (c >> 1))), wt = (c & 1 ? tx : 1 - tx) * (c & 2 ? ty : 1 - ty), o = (yi * tw + xi) * 4, al = (d[o + 3] / 255) * wt;
      r += d[o] * al; g += d[o + 1] * al; b += d[o + 2] * al; a += al;
    }
    px4[3] = a;
    if (a > 1e-6) { px4[0] = r / (a * 255); px4[1] = g / (a * 255); px4[2] = b / (a * 255); } else { px4[0] = 0; px4[1] = 0; px4[2] = 0; }
  };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const p = j * w + i;
    read(i, j);
    const cov = px4[3];
    if (tilted) { out.r[p] = px4[0]; out.g[p] = px4[1]; out.b[p] = px4[2]; out.a[p] = cov; continue; }
    out.a[p] = px.a[p];
    if (cov > 0.02) { out.r[p] = px4[0]; out.g[p] = px4[1]; out.b[p] = px4[2]; } else { out.r[p] = px.r[p]; out.g[p] = px.g[p]; out.b[p] = px.b[p]; }
  }
  return out;
}
