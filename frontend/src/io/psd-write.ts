import { rgbToCmyk } from '../engine/paint';
import type { BlendMode } from '../engine/types';

export interface PsdLayerIn { name: string; rgba: Uint8ClampedArray | Uint8Array; hidden: boolean; opacity: number; blend: BlendMode; key?: string; blocks?: Uint8Array; irrelevant?: boolean }
export interface PsdOpts {
  width: number;
  height: number;
  ppi: number;
  cmyk: boolean;
  composite: Uint8ClampedArray | Uint8Array;
  alpha: boolean;
  layers: PsdLayerIn[];
  convert?: (r: number, g: number, b: number, out: Uint8Array, at: number) => void;
}

export const BLEND_KEYS: Record<BlendMode, string> = {
  normal: 'norm', darken: 'dark', multiply: 'mul ', color_burn: 'idiv', lighten: 'lite', screen: 'scrn', color_dodge: 'div ', overlay: 'over',
  soft_light: 'sLit', hard_light: 'hLit', difference: 'diff', exclusion: 'smud', hue: 'hue ', saturation: 'sat ', color: 'colr', luminosity: 'lum ',
};

export class Out {
  buf = new Uint8Array(1 << 16);
  n = 0;
  private room(extra: number): void { if (this.n + extra > this.buf.length) { let len = this.buf.length; while (len < this.n + extra) len *= 2; const b = new Uint8Array(len); b.set(this.buf.subarray(0, this.n)); this.buf = b; } }
  u8(v: number): void { this.room(1); this.buf[this.n++] = v & 255; }
  u16(v: number): void { this.room(2); this.buf[this.n++] = (v >> 8) & 255; this.buf[this.n++] = v & 255; }
  u32(v: number): void { this.room(4); this.buf[this.n++] = (v >>> 24) & 255; this.buf[this.n++] = (v >>> 16) & 255; this.buf[this.n++] = (v >>> 8) & 255; this.buf[this.n++] = v & 255; }
  tag(s: string): void { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); }
  bytes(b: Uint8Array): void { this.room(b.length); this.buf.set(b, this.n); this.n += b.length; }
  pad(multiple: number): void { while (this.n % multiple) this.u8(0); }
  done(): Uint8Array { return this.buf.subarray(0, this.n); }
}

function packBitsRow(row: Uint8Array, out: Out): void {
  let i = 0;
  const n = row.length;
  while (i < n) {
    let run = 1;
    while (i + run < n && run < 128 && row[i + run] === row[i]) run++;
    if (run >= 2) { out.u8(257 - run); out.u8(row[i]); i += run; continue; }
    const s = i;
    i++;
    while (i < n && i - s < 128 && !(i + 1 < n && row[i] === row[i + 1])) i++;
    out.u8(i - s - 1);
    out.bytes(row.subarray(s, i));
  }
}

function rle(planes: Uint8Array[], w: number, h: number): Uint8Array {
  const counts = new Out(), data = new Out();
  for (const p of planes) for (let y = 0; y < h; y++) { const before = data.n; packBitsRow(p.subarray(y * w, (y + 1) * w), data); counts.u16(data.n - before); }
  const all = new Out();
  all.bytes(counts.done()); all.bytes(data.done());
  return all.done();
}

function inks(rgba: Uint8ClampedArray | Uint8Array, o: PsdOpts, box: { x: number; y: number; w: number; h: number }, stride: number): Uint8Array[] {
  const planes = o.cmyk ? [0, 1, 2, 3].map(() => new Uint8Array(box.w * box.h)) : [0, 1, 2].map(() => new Uint8Array(box.w * box.h));
  const tmp = new Uint8Array(4);
  let q = 0;
  for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++, q++) {
    const i = (y * stride + x) * 4;
    if (o.cmyk) {
      if (o.convert) o.convert(rgba[i], rgba[i + 1], rgba[i + 2], tmp, 0);
      else { const k = rgbToCmyk(rgba[i], rgba[i + 1], rgba[i + 2]); if (k.kind === 'cmyk') { tmp[0] = Math.round(k.c * 2.55); tmp[1] = Math.round(k.m * 2.55); tmp[2] = Math.round(k.y * 2.55); tmp[3] = Math.round(k.k * 2.55); } }
      for (let c = 0; c < 4; c++) planes[c][q] = 255 - tmp[c];
    } else { planes[0][q] = rgba[i]; planes[1][q] = rgba[i + 1]; planes[2][q] = rgba[i + 2]; }
  }
  return planes;
}

function resource(out: Out, id: number, data: Uint8Array): void {
  out.tag('8BIM'); out.u16(id); out.u16(0); out.u32(data.length); out.bytes(data);
  if (data.length & 1) out.u8(0);
}

function pascal(name: string): Uint8Array {
  const latin = Array.from(name).map((c) => (c.charCodeAt(0) < 256 && c.charCodeAt(0) >= 32 ? c.charCodeAt(0) : 63)).slice(0, 255);
  const b = new Uint8Array(Math.ceil((latin.length + 1) / 4) * 4);
  b[0] = latin.length;
  latin.forEach((c, i) => { b[i + 1] = c; });
  return b;
}

export function encodePsd(o: PsdOpts): Blob {
  const { width: w, height: h } = o;
  if (w > 30000 || h > 30000) throw new Error('A PSD file can be at most 30,000 pixels on a side. Lower the resolution.');
  const out = new Out(), ch = o.cmyk ? 4 : 3;
  const compChannels = ch + (o.alpha && !o.cmyk ? 1 : 0);
  out.tag('8BPS'); out.u16(1); out.bytes(new Uint8Array(6)); out.u16(compChannels); out.u32(h); out.u32(w); out.u16(8); out.u16(o.cmyk ? 4 : 3);
  out.u32(0);
  const res = new Out(), ppi = Math.round(o.ppi * 65536);
  const info = new Out();
  info.u32(ppi); info.u16(1); info.u16(1); info.u32(ppi); info.u16(1); info.u16(1);
  resource(res, 1005, info.done());
  out.u32(res.n); out.bytes(res.done());

  const layerInfo = new Out(), pixelData = new Out();
  const writeLayers = o.layers.length > 0;
  if (writeLayers) {
    layerInfo.u16(o.alpha && !o.cmyk ? 0x10000 - o.layers.length : o.layers.length);
    for (const L of o.layers) {
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < (L.rgba.length ? h : 0); y++) {
        const row = y * w * 4;
        let first = -1, last = -1;
        for (let x = 0; x < w; x++) if (L.rgba[row + x * 4 + 3] > 0) { if (first < 0) first = x; last = x; }
        if (first >= 0) { if (first < x0) x0 = first; if (last > x1) x1 = last; if (y < y0) y0 = y; y1 = y; }
      }
      const empty = x1 < 0, box = empty ? { x: 0, y: 0, w: 0, h: 0 } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
      const planes = empty ? [] : inks(L.rgba, o, box, w);
      const alphaPlane = new Uint8Array(box.w * box.h);
      if (!empty) { let q = 0; for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) alphaPlane[q++] = L.rgba[(y * w + x) * 4 + 3]; }
      const chans: Array<{ id: number; data: Uint8Array }> = [];
      const all = [{ id: -1, plane: alphaPlane }, ...(empty ? (o.cmyk ? [0, 1, 2, 3] : [0, 1, 2]).map((id) => ({ id, plane: new Uint8Array(0) })) : planes.map((plane, id) => ({ id, plane })))];
      for (const c of all) {
        const d = new Out();
        if (empty) d.u16(0); else { d.u16(1); d.bytes(rle([c.plane], box.w, box.h)); }
        chans.push({ id: c.id, data: d.done() });
      }
      layerInfo.u32(box.y); layerInfo.u32(box.x); layerInfo.u32(box.y + box.h); layerInfo.u32(box.x + box.w);
      layerInfo.u16(chans.length);
      for (const c of chans) { layerInfo.u16(c.id < 0 ? 0xffff : c.id); layerInfo.u32(c.data.length); }
      layerInfo.tag('8BIM'); layerInfo.tag(L.key ?? BLEND_KEYS[L.blend] ?? 'norm'); layerInfo.u8(Math.max(0, Math.min(255, Math.round(L.opacity * 255)))); layerInfo.u8(0); layerInfo.u8((L.hidden ? 2 : 0) | (L.blocks ? 8 : 0) | (L.irrelevant ? 16 : 0)); layerInfo.u8(0);
      const extra = new Out();
      extra.u32(0); extra.u32(0); extra.bytes(pascal(L.name));
      const uni = new Out(), name = Array.from(L.name);
      uni.u32(name.length);
      for (const c of name) { const code = c.codePointAt(0) ?? 63; if (code > 0xffff) { const v = code - 0x10000; uni.u16(0xd800 + (v >> 10)); uni.u16(0xdc00 + (v & 0x3ff)); } else uni.u16(code); }
      uni.pad(4);
      extra.tag('8BIM'); extra.tag('luni'); extra.u32(uni.n); extra.bytes(uni.done());
      if (L.blocks) extra.bytes(L.blocks);
      layerInfo.u32(extra.n); layerInfo.bytes(extra.done());
      for (const c of chans) pixelData.bytes(c.data);
    }
    layerInfo.bytes(pixelData.done());
    layerInfo.pad(2);
  }
  const section = new Out();
  if (writeLayers) { section.u32(layerInfo.n); section.bytes(layerInfo.done()); } else section.u32(0);
  section.u32(0);
  out.u32(section.n); out.bytes(section.done());

  let comp: Uint8ClampedArray | Uint8Array = o.composite;
  if (compChannels > ch) {
    comp = new Uint8Array(o.composite);
    for (let i = 0; i < w * h; i++) { const a = o.composite[i * 4 + 3] / 255; for (let k = 0; k < 3; k++) comp[i * 4 + k] = Math.round(o.composite[i * 4 + k] * a + 255 * (1 - a)); }
  }
  const planes: Uint8Array[] = inks(comp, o, { x: 0, y: 0, w, h }, w);
  if (compChannels > ch) { const a = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) a[i] = o.composite[i * 4 + 3]; planes.push(a); }
  out.u16(1);
  out.bytes(rle(planes, w, h));
  return new Blob([out.done() as Uint8Array<ArrayBuffer>], { type: 'image/vnd.adobe.photoshop' });
}
