import { cmyk, gray, rgb, solid, toRgb } from '../engine/paint';
import type { Color } from '../engine';
import type { LibGroup, SwatchLibrary } from '../engine/swatch-libraries';

const GROUP_START = 0xc001, GROUP_END = 0xc002, ENTRY = 0x0001;
const TYPES = ['global', 'spot', 'process'] as const;

function labToColor(l: number, a: number, b: number): Color {
  const fy = (l + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t: number): number => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = 0.9642 * inv(fx), Y = inv(fy), Z = 0.8249 * inv(fz);
  const x = 0.9555766 * X - 0.0230393 * Y + 0.0631636 * Z, y = -0.0282895 * X + 1.0099416 * Y + 0.0210077 * Z, z = 0.0122982 * X - 0.020483 * Y + 1.3299098 * Z;
  const lin = [3.2404542 * x - 1.5371385 * y - 0.4985314 * z, -0.969266 * x + 1.8760108 * y + 0.041556 * z, 0.0556434 * x - 0.2040259 * y + 1.0572252 * z];
  const g = lin.map((v) => { const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, c)) * 255); });
  return rgb(g[0], g[1], g[2]);
}

export function readAse(data: ArrayBuffer, name = 'Library'): SwatchLibrary {
  const v = new DataView(data);
  if (data.byteLength < 12 || String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)) !== 'ASEF') throw new Error(`${name} is not an Adobe Swatch Exchange file.`);
  const count = v.getUint32(8);
  const groups: LibGroup[] = [{ name: '', swatches: [] }];
  let cur = groups[0], at = 12;
  const str = (pos: number): [string, number] => {
    const n = v.getUint16(pos);
    let s = '';
    for (let i = 0; i < n; i++) { const ch = v.getUint16(pos + 2 + i * 2); if (ch) s += String.fromCharCode(ch); }
    return [s, pos + 2 + n * 2];
  };
  for (let i = 0; i < count && at + 6 <= data.byteLength; i++) {
    const type = v.getUint16(at), len = v.getUint32(at + 2), body = at + 6;
    if (type === GROUP_START) { const [g] = str(body); cur = { name: g || `Group ${groups.length}`, swatches: [] }; groups.push(cur); }
    else if (type === GROUP_END) cur = groups[0];
    else if (type === ENTRY) {
      const [label, p] = str(body);
      const model = String.fromCharCode(v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3)).trim().toUpperCase();
      const fl = (k: number): number => v.getFloat32(p + 4 + k * 4);
      const n = model === 'CMYK' ? 4 : model === 'GRAY' ? 1 : 3;
      const col = model === 'CMYK' ? cmyk(fl(0) * 100, fl(1) * 100, fl(2) * 100, fl(3) * 100)
        : model === 'GRAY' ? gray((1 - fl(0)) * 100)
        : model === 'LAB' ? labToColor(fl(0) * 100, fl(1), fl(2))
        : rgb(Math.round(fl(0) * 255), Math.round(fl(1) * 255), Math.round(fl(2) * 255));
      const kind = TYPES[v.getUint16(p + 4 + n * 4)] ?? 'process';
      const c2 = col.kind === 'cmyk' ? cmyk(Math.round(col.c * 10) / 10, Math.round(col.m * 10) / 10, Math.round(col.y * 10) / 10, Math.round(col.k * 10) / 10) : col;
      cur.swatches.push({ name: label || `Swatch ${cur.swatches.length + 1}`, paint: solid(c2), ...(kind === 'spot' ? { spot: true, global: true } : kind === 'global' ? { global: true } : {}) });
    }
    at = body + len;
  }
  const id = `user_${name.toLowerCase().replace(/\.ase$/, '').replace(/[^a-z0-9]+/g, '_')}`;
  return { id, name: name.replace(/\.ase$/i, ''), groups: groups.filter((g) => g.swatches.length), user: true };
}

export function writeAse(lib: SwatchLibrary): { blob: Blob; skipped: number } {
  const blocks: Uint8Array[] = [];
  let count = 0, skipped = 0;
  const strBytes = (s: string): Uint8Array => { const t = s.slice(0, 200), b = new Uint8Array(2 + (t.length + 1) * 2), dv = new DataView(b.buffer); dv.setUint16(0, t.length + 1); for (let i = 0; i < t.length; i++) dv.setUint16(2 + i * 2, t.charCodeAt(i)); return b; };
  const block = (type: number, body: Uint8Array): void => { const b = new Uint8Array(6 + body.length), dv = new DataView(b.buffer); dv.setUint16(0, type); dv.setUint32(2, body.length); b.set(body, 6); blocks.push(b); count++; };
  const entry = (name: string, c: Color, kind: 0 | 1 | 2): void => {
    const nm = strBytes(name), vals = c.kind === 'cmyk' ? [c.c / 100, c.m / 100, c.y / 100, c.k / 100] : c.kind === 'gray' ? [1 - c.k / 100] : (() => { const v = toRgb(c); return [v.r / 255, v.g / 255, v.b / 255]; })();
    const model = c.kind === 'cmyk' ? 'CMYK' : c.kind === 'gray' ? 'Gray' : 'RGB ';
    const body = new Uint8Array(nm.length + 4 + vals.length * 4 + 2), dv = new DataView(body.buffer);
    body.set(nm, 0);
    for (let i = 0; i < 4; i++) body[nm.length + i] = model.charCodeAt(i);
    vals.forEach((x, i) => dv.setFloat32(nm.length + 4 + i * 4, x));
    dv.setUint16(nm.length + 4 + vals.length * 4, kind);
    block(ENTRY, body);
  };
  for (const g of lib.groups) {
    const items = g.swatches.filter((s) => { const ok = s.paint.type === 'color'; if (!ok) skipped++; return ok; });
    if (!items.length) continue;
    if (g.name) block(GROUP_START, strBytes(g.name));
    for (const s of items) if (s.paint.type === 'color') entry(s.name, s.paint.color, s.spot ? 1 : s.global ? 0 : 2);
    if (g.name) block(GROUP_END, new Uint8Array(0));
  }
  const head = new Uint8Array(12), dv = new DataView(head.buffer);
  head.set([0x41, 0x53, 0x45, 0x46], 0);
  dv.setUint16(4, 1); dv.setUint16(6, 0); dv.setUint32(8, count);
  return { blob: new Blob([head, ...blocks] as Uint8Array<ArrayBuffer>[], { type: 'application/octet-stream' }), skipped };
}
