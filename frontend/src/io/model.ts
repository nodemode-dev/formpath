import { newId } from '../engine/doc';
import { buildModelMesh, encodeMesh, MESH_MIME, type Mesh } from '../engine/modelmesh';
import { imageAverage } from '../engine/texture';
import { parseGltf } from './gltf';
import { parseObj } from './obj';

export const MODEL_FILE = /\.(obj|glb|gltf)$/i;
export const MODEL_PART = /\.(mtl|bin)$/i;
export interface ModelImport { mesh: Mesh; blob: Blob; key: string; textures: Array<{ key: string; blob: Blob; w: number; h: number }>; name: string; faces: number; notes: string[] }

const base = (s: string): string => s.replace(/^.*[\\/]/, '').toLowerCase();
const slug = (s: string): string => s.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'model';
const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

async function texture(blob: Blob, label: string): Promise<{ key: string; blob: Blob; w: number; h: number; avg: [number, number, number] | null } | null> {
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(blob); } catch { return null; }
  const ext = (blob.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '') || 'png', avg = imageAverage(bmp, bmp.width, bmp.height);
  const out = { key: `img-mdl${newId('').replace(/[^a-z0-9]/gi, '')}-${slug(label)}.${ext}`, blob, w: bmp.width, h: bmp.height, avg: avg ? hexRgb(avg) : null };
  bmp.close();
  return out;
}

/** Sibling files (.mtl, .bin, textures) an agent hands over with a model file, keyed by the model File. */
export const modelSiblings = new WeakMap<File, File[]>();

export async function importModel(f: File, parts: File[] = []): Promise<ModelImport> {
  const lower = f.name.toLowerCase(), byName = new Map<string, File>();
  for (const p of [...parts, ...(modelSiblings.get(f) ?? [])]) if (p !== f) byName.set(base(p.name), p);
  const notes: string[] = [];
  let raw, faces: number, loose: Array<{ blob: Blob; label: string } | null>;
  if (lower.endsWith('.obj')) {
    const mtl = new Map<string, string>();
    for (const [k, p] of byName) if (k.endsWith('.mtl')) mtl.set(k, await p.text());
    const r = parseObj(await f.text(), (n) => mtl.get(base(n)) ?? null);
    raw = r.raw; faces = r.faces;
    loose = r.imageNames.map((n) => { const p = byName.get(base(n)); return p && /\.(png|jpe?g|webp)$/i.test(p.name) ? { blob: p.slice(0, p.size, p.type || (/\.png$/i.test(p.name) ? 'image/png' : /\.webp$/i.test(p.name) ? 'image/webp' : 'image/jpeg')), label: n } : null; });
    if (r.imageNames.length && loose.some((x) => !x)) notes.push('some texture images were not chosen with the file');
    if (!byName.size && /^\s*mtllib\s/m.test((await f.slice(0, 4096).text()))) notes.push('the .mtl file was not chosen with the file, so colours are grey');
    for (const s of r.skipped) notes.push(`${s} were left out`);
  } else {
    const ext = new Map<string, Uint8Array>();
    for (const [k, p] of byName) if (/\.(bin|png|jpe?g|webp)$/.test(k)) ext.set(k, new Uint8Array(await p.arrayBuffer()));
    const r = parseGltf(await f.arrayBuffer(), (uri) => ext.get(base(decodeURIComponent(uri))) ?? null);
    raw = r.raw; faces = r.faces;
    loose = r.images.map((im, i) => ({ blob: new Blob([im.bytes as Uint8Array<ArrayBuffer>], { type: im.mime }), label: `${slug(f.name)}-${i}` }));
    for (const s of r.skipped) notes.push(`${s} were left out`);
  }
  if (!faces) throw new Error('The model has no faces.');
  const textures: ModelImport['textures'] = [], keys: string[] = [], avgs: Array<[number, number, number] | null> = [];
  for (const l of loose) {
    const t = l ? await texture(l.blob, l.label) : null;
    if (t) { textures.push({ key: t.key, blob: t.blob, w: t.w, h: t.h }); keys.push(t.key); avgs.push(t.avg); } else { keys.push(''); avgs.push(null); }
  }
  const mesh = buildModelMesh(raw, keys);
  raw.groups.forEach((g, i) => {
    const m = mesh.groups[i], a = g.image !== undefined ? avgs[g.image] : null;
    if (m && a) m.color = [Math.min(1, a[0] * g.color[0]), Math.min(1, a[1] * g.color[1]), Math.min(1, a[2] * g.color[2])];
  });
  const key = `mdl-${newId('').replace(/[^a-z0-9]/gi, '')}-${slug(f.name)}.fpm`;
  return { mesh, blob: new Blob([encodeMesh(mesh)], { type: MESH_MIME }), key, textures, name: f.name.replace(/\.[^.]+$/, ''), faces: mesh.idx.length / 3, notes };
}
