import type { MeshRgb, RawGroup, RawModel } from '../engine/modelmesh';

export interface GltfImage { bytes: Uint8Array; mime: string }
export interface GltfResult { raw: RawModel; images: GltfImage[]; faces: number; skipped: string[] }

interface Json {
  scene?: number; scenes?: Array<{ nodes?: number[] }>; nodes?: Array<{ mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }>;
  meshes?: Array<{ name?: string; primitives: Array<{ attributes: Record<string, number>; indices?: number; material?: number; mode?: number; extensions?: Record<string, unknown> }> }>;
  accessors?: Array<{ bufferView?: number; byteOffset?: number; componentType: number; normalized?: boolean; count: number; type: string }>;
  bufferViews?: Array<{ buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }>;
  buffers?: Array<{ uri?: string; byteLength: number }>;
  materials?: Array<{ name?: string; pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: { index: number } } }>;
  textures?: Array<{ source?: number }>;
  images?: Array<{ uri?: string; mimeType?: string; bufferView?: number }>;
  extensionsRequired?: string[];
}

const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
type M4 = number[];
const IDENT: M4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mul = (a: M4, b: M4): M4 => { const o = new Array<number>(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
const srgb = (c: number): number => { const v = Math.min(1, Math.max(0, c)); return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };

function local(n: NonNullable<Json['nodes']>[number]): M4 {
  if (n.matrix && n.matrix.length === 16) return n.matrix;
  const t = n.translation ?? [0, 0, 0], q = n.rotation ?? [0, 0, 0, 1], s = n.scale ?? [1, 1, 1], [x, y, z, w] = q;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [(1 - 2 * (yy + zz)) * s[0], (2 * (xy + wz)) * s[0], (2 * (xz - wy)) * s[0], 0, (2 * (xy - wz)) * s[1], (1 - 2 * (xx + zz)) * s[1], (2 * (yz + wx)) * s[1], 0, (2 * (xz + wy)) * s[2], (2 * (yz - wx)) * s[2], (1 - 2 * (xx + yy)) * s[2], 0, t[0], t[1], t[2], 1];
}

function dataUri(uri: string): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(uri);
  if (!m) return null;
  if (m[2]) { const bin = atob(m[3]), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return { bytes: out, mime: m[1] }; }
  return { bytes: new TextEncoder().encode(decodeURIComponent(m[3])), mime: m[1] };
}

export function parseGltf(data: ArrayBuffer, external: (uri: string) => Uint8Array | null = () => null): GltfResult {
  const dv = new DataView(data);
  let json: Json, bin: Uint8Array | null = null;
  if (data.byteLength >= 12 && dv.getUint32(0, true) === 0x46546c67) {
    let o = 12;
    let text = '';
    while (o + 8 <= data.byteLength) {
      const len = dv.getUint32(o, true), type = dv.getUint32(o + 4, true);
      if (type === 0x4e4f534a) text = new TextDecoder().decode(new Uint8Array(data, o + 8, len));
      else if (type === 0x004e4942 && !bin) bin = new Uint8Array(data, o + 8, len);
      o += 8 + len;
    }
    if (!text) throw new Error('This GLB file has no JSON chunk.');
    json = JSON.parse(text) as Json;
  } else json = JSON.parse(new TextDecoder().decode(new Uint8Array(data))) as Json;
  for (const x of json.extensionsRequired ?? []) if (x === 'KHR_draco_mesh_compression' || x === 'EXT_meshopt_compression') throw new Error(`This glTF needs the ${x} extension, which formpath does not read.`);
  const buffers: Array<Uint8Array | null> = (json.buffers ?? []).map((b, i) => {
    if (!b.uri) return i === 0 ? bin : null;
    const d = dataUri(b.uri);
    return d ? d.bytes : external(b.uri);
  });
  const view = (i: number): { bytes: Uint8Array; stride: number } | null => {
    const v = json.bufferViews?.[i], buf = v ? buffers[v.buffer] : null;
    if (!v || !buf) return null;
    return { bytes: buf.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength), stride: v.byteStride ?? 0 };
  };
  const read = (ai: number): { v: Float64Array; n: number; count: number } | null => {
    const a = json.accessors?.[ai];
    if (!a || a.bufferView === undefined) return null;
    const bv = view(a.bufferView), n = SIZE[a.type] ?? 1, cb = BYTES[a.componentType];
    if (!bv || !cb) return null;
    const stride = bv.stride || n * cb, base = a.byteOffset ?? 0, dv2 = new DataView(bv.bytes.buffer, bv.bytes.byteOffset, bv.bytes.byteLength), out = new Float64Array(a.count * n);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) {
      const o = base + i * stride + k * cb;
      if (o + cb > bv.bytes.byteLength) return null;
      let x: number;
      switch (a.componentType) {
        case 5120: x = dv2.getInt8(o); if (a.normalized) x = Math.max(x / 127, -1); break;
        case 5121: x = dv2.getUint8(o); if (a.normalized) x /= 255; break;
        case 5122: x = dv2.getInt16(o, true); if (a.normalized) x = Math.max(x / 32767, -1); break;
        case 5123: x = dv2.getUint16(o, true); if (a.normalized) x /= 65535; break;
        case 5125: x = dv2.getUint32(o, true); break;
        default: x = dv2.getFloat32(o, true);
      }
      out[i * n + k] = x;
    }
    return { v: out, n, count: a.count };
  };

  const images: GltfImage[] = [], imageOf = new Map<number, number>(), skipped: string[] = [];
  const imageFor = (texture: number | undefined): number | undefined => {
    if (texture === undefined) return undefined;
    const src = json.textures?.[texture]?.source;
    if (src === undefined) return undefined;
    const hit = imageOf.get(src);
    if (hit !== undefined) return hit;
    const im = json.images?.[src];
    if (!im) return undefined;
    let bytes: Uint8Array | null = null, mime = im.mimeType ?? '';
    if (im.bufferView !== undefined) bytes = view(im.bufferView)?.bytes.slice() ?? null;
    else if (im.uri) { const d = dataUri(im.uri); if (d) { bytes = d.bytes; mime = mime || d.mime; } else { bytes = external(im.uri); if (!mime) mime = /\.png$/i.test(im.uri) ? 'image/png' : /\.jpe?g$/i.test(im.uri) ? 'image/jpeg' : ''; } }
    if (!bytes || !/^image\/(png|jpeg|webp)$/.test(mime)) { if (!skipped.includes('a texture image')) skipped.push('a texture image'); return undefined; }
    images.push({ bytes, mime });
    imageOf.set(src, images.length - 1);
    return images.length - 1;
  };

  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [], grp: number[] = [], groups: RawGroup[] = [], groupAt = new Map<string, number>();
  let haveN = true, haveUv = false, faces = 0;
  const groupFor = (mat: number | undefined, mesh: string): number => {
    const key = mat === undefined ? `mesh:${mesh}` : `mat:${mat}`;
    let g = groupAt.get(key);
    if (g === undefined) {
      if (groups.length >= 64) return groups.length - 1;
      const m = mat === undefined ? undefined : json.materials?.[mat], f = m?.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1], tex = imageFor(m?.pbrMetallicRoughness?.baseColorTexture?.index);
      const color: MeshRgb = mat === undefined ? [0.72, 0.72, 0.72] : [srgb(f[0] ?? 1), srgb(f[1] ?? 1), srgb(f[2] ?? 1)];
      g = groups.length;
      groups.push({ name: m?.name || (mat === undefined ? mesh || 'default' : `Material ${mat}`), color, ...(tex !== undefined ? { image: tex } : {}) });
      groupAt.set(key, g);
    }
    return g;
  };

  const walk = (ni: number, parent: M4, depth: number): void => {
    const n = json.nodes?.[ni];
    if (!n || depth > 64) return;
    const world = mul(parent, local(n));
    if (n.mesh !== undefined) emit(json.meshes?.[n.mesh], world);
    for (const c of n.children ?? []) walk(c, world, depth + 1);
  };
  const emit = (mesh: NonNullable<Json['meshes']>[number] | undefined, w: M4): void => {
    if (!mesh) return;
    const a = [w[0], w[4], w[8], w[1], w[5], w[9], w[2], w[6], w[10]], det = a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
    const cof = [a[4] * a[8] - a[5] * a[7], a[5] * a[6] - a[3] * a[8], a[3] * a[7] - a[4] * a[6], a[2] * a[7] - a[1] * a[8], a[0] * a[8] - a[2] * a[6], a[1] * a[6] - a[0] * a[7], a[1] * a[5] - a[2] * a[4], a[2] * a[3] - a[0] * a[5], a[0] * a[4] - a[1] * a[3]];
    for (const pr of mesh.primitives) {
      const mode = pr.mode ?? 4;
      if (mode < 4 || mode > 6) { if (!skipped.includes('points and lines')) skipped.push('points and lines'); continue; }
      const P = pr.attributes.POSITION === undefined ? null : read(pr.attributes.POSITION);
      if (!P) { if (pr.extensions?.KHR_draco_mesh_compression && !skipped.includes('Draco meshes')) skipped.push('Draco meshes'); continue; }
      const Nn = pr.attributes.NORMAL === undefined ? null : read(pr.attributes.NORMAL), Tt = pr.attributes.TEXCOORD_0 === undefined ? null : read(pr.attributes.TEXCOORD_0), base = pos.length / 3;
      for (let i = 0; i < P.count; i++) {
        const x = P.v[i * 3], y = P.v[i * 3 + 1], z = P.v[i * 3 + 2];
        pos.push(w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]);
        if (Nn) { const nx = Nn.v[i * 3], ny = Nn.v[i * 3 + 1], nz = Nn.v[i * 3 + 2], ox = cof[0] * nx + cof[3] * ny + cof[6] * nz, oy = cof[1] * nx + cof[4] * ny + cof[7] * nz, oz = cof[2] * nx + cof[5] * ny + cof[8] * nz, l = Math.hypot(ox, oy, oz) || 1; nrm.push(ox / l, oy / l, oz / l); } else nrm.push(0, 0, 0);
        if (Tt) uv.push(Tt.v[i * 2], Tt.v[i * 2 + 1]); else uv.push(0, 0);
      }
      if (!Nn) haveN = false;
      if (Tt) haveUv = true;
      let ind: number[];
      if (pr.indices !== undefined) { const I = read(pr.indices); if (!I) continue; ind = Array.from(I.v); } else ind = Array.from({ length: P.count }, (_, i) => i);
      const tri: number[] = [];
      if (mode === 4) for (let i = 0; i + 2 < ind.length; i += 3) tri.push(ind[i], ind[i + 1], ind[i + 2]);
      else if (mode === 5) for (let i = 0; i + 2 < ind.length; i++) { if (i % 2) tri.push(ind[i + 1], ind[i], ind[i + 2]); else tri.push(ind[i], ind[i + 1], ind[i + 2]); }
      else for (let i = 1; i + 1 < ind.length; i++) tri.push(ind[0], ind[i], ind[i + 1]);
      const g = groupFor(pr.material, mesh.name ?? '');
      for (let i = 0; i < tri.length; i += 3) {
        if (det < 0) idx.push(base + tri[i], base + tri[i + 2], base + tri[i + 1]); else idx.push(base + tri[i], base + tri[i + 1], base + tri[i + 2]);
        grp.push(g); faces++;
      }
    }
  };
  const sc = json.scenes?.[json.scene ?? 0];
  if (sc?.nodes) for (const r of sc.nodes) walk(r, IDENT, 0);
  else {
    const child = new Set<number>();
    (json.nodes ?? []).forEach((n) => (n.children ?? []).forEach((c) => child.add(c)));
    (json.nodes ?? []).forEach((_, i) => { if (!child.has(i)) walk(i, IDENT, 0); });
  }
  if (!groups.length) groups.push({ name: 'default', color: [0.72, 0.72, 0.72] });
  return { raw: { pos, nrm: haveN && nrm.length ? nrm : null, uv: haveUv ? uv : null, idx, grp, groups }, images, faces, skipped };
}
