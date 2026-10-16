import type { CmykToRgb } from './tiff-read';

export interface PsdInfo {
  width: number;
  height: number;
  depth: number;
  mode: string;
  ppiX: number | null;
  ppiY: number | null;
  layers: number;
  groups: number;
  icc: Uint8Array | null;
  hasComposite: boolean;
}

export interface PsdNode {
  kind: 'layer' | 'group';
  name: string;
  visible: boolean;
  opacity: number;
  blend: string;
  left: number;
  top: number;
  w: number;
  h: number;
  rgba?: Uint8ClampedArray;
  children?: PsdNode[];
  text?: boolean;
  clipped?: boolean;
}

export interface PsdLayers { width: number; height: number; nodes: PsdNode[]; skipped: string[]; notes: string[] }
export interface PsdComposite { width: number; height: number; rgba: Uint8ClampedArray; alpha: boolean }

interface Chan { id: number; len: number; at: number }
interface Rec {
  top: number; left: number; bottom: number; right: number;
  chans: Chan[]; blend: string; opacity: number; fill: number; clipping: boolean; visible: boolean;
  name: string; section: number; adjust: string | null; text: boolean;
  mask: { top: number; left: number; bottom: number; right: number; def: number; disabled: boolean } | null;
}

const MODES: Record<number, string> = { 0: 'Bitmap', 1: 'Grayscale', 2: 'Indexed', 3: 'RGB', 4: 'CMYK', 7: 'Multichannel', 8: 'Duotone', 9: 'Lab' };
const WIDE_KEYS = new Set(['LMsk', 'Lr16', 'Lr32', 'Layr', 'Mt16', 'Mt32', 'Mtrn', 'Alph', 'FMsk', 'lnk2', 'FEid', 'FXid', 'PxSD']);
const ADJUST = new Set(['brit', 'levl', 'curv', 'expA', 'vibA', 'hue ', 'hue2', 'blnc', 'blwh', 'phfl', 'mixr', 'clrL', 'nvrt', 'post', 'thrs', 'grdm', 'selc', 'CgEd', 'CBrt', 'Lvls']);
const ADJUST_NAME: Record<string, string> = { brit: 'brightness and contrast', levl: 'levels', curv: 'curves', expA: 'exposure', vibA: 'vibrance', 'hue ': 'hue and saturation', hue2: 'hue and saturation', blnc: 'colour balance', blwh: 'black and white', phfl: 'photo filter', mixr: 'channel mixer', clrL: 'colour lookup', nvrt: 'invert', post: 'posterize', thrs: 'threshold', grdm: 'gradient map', selc: 'selective colour' };
const MAX_PIXELS = 120_000_000;

class Psd {
  readonly dv: DataView;
  readonly b: Uint8Array;
  readonly wide: boolean;
  readonly channels: number;
  readonly height: number;
  readonly width: number;
  readonly depth: number;
  readonly mode: number;
  palette: Uint8Array | null = null;
  ppiX: number | null = null;
  ppiY: number | null = null;
  icc: Uint8Array | null = null;
  negative = false;
  readonly recs: Rec[] = [];
  imageAt = 0;

  constructor(data: ArrayBuffer) {
    this.b = new Uint8Array(data);
    this.dv = new DataView(data);
    if (this.b.length < 30 || this.str(0, 4) !== '8BPS') throw new Error('it is not a Photoshop file');
    const version = this.dv.getUint16(4);
    if (version !== 1 && version !== 2) throw new Error('its Photoshop version is not supported');
    this.wide = version === 2;
    this.channels = this.dv.getUint16(12);
    this.height = this.dv.getUint32(14);
    this.width = this.dv.getUint32(18);
    this.depth = this.dv.getUint16(22);
    this.mode = this.dv.getUint16(24);
    if (!this.width || !this.height) throw new Error('its image has no size');
    if (this.width * this.height > MAX_PIXELS) throw new Error(`its image is ${this.width} by ${this.height} pixels, more than formpth can hold`);
    let p = 26;
    const cm = this.dv.getUint32(p);
    p += 4;
    if (this.mode === 2 && cm >= 768) this.palette = this.b.subarray(p, p + 768);
    p += cm;
    const rl = this.dv.getUint32(p);
    p += 4;
    this.resources(p, Math.min(this.b.length, p + rl));
    p += rl;
    const ll = this.wide ? this.u64(p) : this.dv.getUint32(p);
    p += this.wide ? 8 : 4;
    const lend = Math.min(this.b.length, p + ll);
    if (ll > 0) { try { this.layerSection(p, lend); } catch { this.recs.length = 0; } }
    this.imageAt = lend;
  }

  str(p: number, n: number): string { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(this.b[p + i] ?? 0); return s; }
  u64(p: number): number { return Number(this.dv.getBigUint64(p)); }
  len(p: number): number { return this.wide ? this.u64(p) : this.dv.getUint32(p); }

  private resources(p: number, end: number): void {
    while (p + 12 <= end && this.str(p, 4) === '8BIM') {
      p = this.resource(p, end, this.dv.getUint16(p + 4), this.b[p + 6]);
    }
  }

  private resource(p: number, end: number, id: number, nl: number): number {
    const nameEnd = p + 6 + 1 + nl + ((1 + nl) & 1), size = this.dv.getUint32(nameEnd), at = nameEnd + 4;
    if (at + size > end) return end;
    if (id === 1005 && size >= 16) {
      const hr = this.dv.getUint32(at) / 65536, hu = this.dv.getUint16(at + 4), vr = this.dv.getUint32(at + 8) / 65536, vu = this.dv.getUint16(at + 12);
      this.ppiX = hr ? hr * (hu === 2 ? 2.54 : 1) : null;
      this.ppiY = vr ? vr * (vu === 2 ? 2.54 : 1) : null;
    } else if (id === 1039 && size > 0) this.icc = this.b.slice(at, at + size);
    return at + size + (size & 1);
  }

  private layerSection(p: number, end: number): void {
    const li = this.len(p);
    p += this.wide ? 8 : 4;
    if (li > 0) this.layerInfo(p, Math.min(end, p + li));
    p += li;
    if (!this.recs.length && p + 4 <= end) {
      const gm = this.dv.getUint32(p);
      p += 4 + gm;
      while (p + 12 <= end && (this.str(p, 4) === '8BIM' || this.str(p, 4) === '8B64')) {
        const key = this.str(p + 4, 4), wide = this.wide && WIDE_KEYS.has(key), n = wide ? this.u64(p + 8) : this.dv.getUint32(p + 8), at = p + 8 + (wide ? 8 : 4);
        if ((key === 'Lr16' || key === 'Lr32' || key === 'Layr') && n > 0) { this.layerInfo(at, Math.min(end, at + n)); break; }
        p = at + n + ((4 - (n & 3)) & 3);
      }
    }
  }

  private layerInfo(p: number, end: number): void {
    let count = this.dv.getInt16(p);
    p += 2;
    if (count < 0) { this.negative = true; count = -count; }
    for (let i = 0; i < count && p + 34 <= end; i++) p = this.record(p, end);
    for (const r of this.recs) for (const c of r.chans) { c.at = p; p += c.len; }
  }

  private record(p: number, end: number): number {
    const dv = this.dv, top = dv.getInt32(p), left = dv.getInt32(p + 4), bottom = dv.getInt32(p + 8), right = dv.getInt32(p + 12), nch = dv.getUint16(p + 16);
    p += 18;
    const chans: Chan[] = [];
    for (let i = 0; i < nch; i++) { chans.push({ id: dv.getInt16(p), len: this.len(p + 2), at: 0 }); p += this.wide ? 10 : 6; }
    const blend = this.str(p + 4, 4), opacity = this.b[p + 8], clipping = this.b[p + 9] !== 0, flags = this.b[p + 10];
    p += 12;
    const xl = dv.getUint32(p), xend = Math.min(end, p + 4 + xl);
    p += 4;
    const rec: Rec = { top, left, bottom, right, chans, blend, opacity: opacity / 255, fill: 1, clipping, visible: (flags & 2) === 0, name: '', section: 0, adjust: null, text: false, mask: null };
    const ml = dv.getUint32(p);
    if (ml >= 18 && p + 4 + 18 <= xend) rec.mask = { top: dv.getInt32(p + 4), left: dv.getInt32(p + 8), bottom: dv.getInt32(p + 12), right: dv.getInt32(p + 16), def: this.b[p + 20], disabled: (this.b[p + 21] & 2) !== 0 };
    p += 4 + ml;
    p += 4 + dv.getUint32(p);
    const nl = this.b[p];
    rec.name = new TextDecoder('latin1').decode(this.b.subarray(p + 1, p + 1 + nl));
    p += 1 + nl;
    p += (4 - ((1 + nl) & 3)) & 3;
    while (p + 12 <= xend) {
      const sig = this.str(p, 4);
      if (sig !== '8BIM' && sig !== '8B64') break;
      const key = this.str(p + 4, 4), w = this.wide && WIDE_KEYS.has(key), n = w ? this.u64(p + 8) : dv.getUint32(p + 8), at = p + 8 + (w ? 8 : 4);
      if (at + n > xend) break;
      if (key === 'luni' && n >= 4) {
        const c = dv.getUint32(at);
        let s = '';
        for (let i = 0; i < c && at + 4 + i * 2 + 2 <= at + n; i++) s += String.fromCharCode(dv.getUint16(at + 4 + i * 2));
        rec.name = s.replace(/\0+$/, '');
      } else if ((key === 'lsct' || key === 'lsdk') && n >= 4) rec.section = dv.getUint32(at);
      else if (key === 'iOpa' && n >= 1) rec.fill = this.b[at] / 255;
      else if (key === 'TySh' || key === 'tySh') rec.text = true;
      else if (ADJUST.has(key)) rec.adjust = ADJUST_NAME[key] ?? 'an adjustment';
      let e = at + n;
      for (let k = 0; k < 4 && e + 4 <= xend; k++) { const s2 = this.str(e + k, 4); if (s2 === '8BIM' || s2 === '8B64') { e += k; break; } if (k === 3) e = at + n + ((4 - (n & 3)) & 3); }
      p = e;
    }
    this.recs.push(rec);
    return xend;
  }

  async plane(at: number, len: number, w: number, h: number): Promise<Uint8Array> {
    const out = new Uint8Array(w * h);
    if (len < 2 || !w || !h) return out;
    const comp = this.dv.getUint16(at);
    return this.planeBody(comp, at + 2, at + len, w, h, out);
  }

  async planeBody(comp: number, from: number, to: number, w: number, h: number, out: Uint8Array, rowCounts?: number[]): Promise<Uint8Array> {
    const bytes = this.depth === 16 ? 2 : this.depth === 1 ? 0 : 1, rowBytes = this.depth === 1 ? (w + 7) >> 3 : w * bytes;
    if (this.depth === 32) throw new Error('32-bit Photoshop files are not supported');
    let raw: Uint8Array;
    if (comp === 0) raw = this.b.subarray(from, Math.min(to, from + rowBytes * h));
    else if (comp === 1) {
      raw = new Uint8Array(rowBytes * h);
      const sizeW = this.wide ? 4 : 2;
      let q = from + (rowCounts ? 0 : sizeW * h);
      for (let y = 0; y < h; y++) {
        const n = rowCounts ? rowCounts[y] : this.wide ? this.dv.getUint32(from + y * 4) : this.dv.getUint16(from + y * 2);
        unpack(this.b, q, Math.min(to, q + n), raw, y * rowBytes, rowBytes);
        q += n;
      }
    } else if (comp === 2 || comp === 3) {
      raw = await inflate(this.b.subarray(from, to), rowBytes * h);
      if (comp === 3) {
        raw = raw.slice();
        for (let y = 0; y < h; y++) {
          const r = y * rowBytes;
          if (bytes === 1) for (let x = 1; x < rowBytes; x++) raw[r + x] = (raw[r + x] + raw[r + x - 1]) & 255;
          else if (bytes === 2) for (let x = 1; x < w; x++) { const p = r + x * 2, s = (((raw[p] << 8) | raw[p + 1]) + ((raw[p - 2] << 8) | raw[p - 1])) & 65535; raw[p] = s >> 8; raw[p + 1] = s & 255; }
        }
      }
    } else throw new Error(`compression ${comp} is not supported`);
    if (this.depth === 8) { out.set(raw.subarray(0, out.length)); return out; }
    if (this.depth === 16) { for (let i = 0; i < w * h; i++) out[i] = Math.round(((raw[i * 2] << 8) | raw[i * 2 + 1]) / 257); return out; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = (raw[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1 ? 0 : 255;
    return out;
  }
}

function unpack(src: Uint8Array, from: number, to: number, out: Uint8Array, at: number, size: number): void {
  let i = from, o = at;
  const stop = at + size;
  while (i < to && o < stop) {
    const n = (src[i++] << 24) >> 24;
    if (n >= 0) { const c = n + 1; for (let k = 0; k < c && i < to && o < stop; k++) out[o++] = src[i++]; }
    else if (n !== -128) { const c = 1 - n, v = src[i++]; for (let k = 0; k < c && o < stop; k++) out[o++] = v; }
  }
}

async function inflate(src: Uint8Array, size: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot read Deflate-compressed Photoshop data');
  const buf = new Uint8Array(await new Response(new Blob([src as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  if (buf.length >= size) return buf.subarray(0, size);
  const out = new Uint8Array(size);
  out.set(buf);
  return out;
}

const lin = (v: number): number => { const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(c * 255))); };
function labToRgb(L8: number, a8: number, b8: number): [number, number, number] {
  const L = (L8 * 100) / 255, a = a8 - 128, b = b8 - 128, fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const f = (t: number): number => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
  const X = 0.9642 * f(fx), Y = f(fy), Z = 0.8249 * f(fz);
  return [lin(3.1338561 * X - 1.6168667 * Y - 0.4906146 * Z), lin(-0.9787684 * X + 1.9161415 * Y + 0.033454 * Z), lin(0.0719453 * X - 0.2289914 * Y + 1.4052427 * Z)];
}

function colour(psd: Psd, planes: Array<Uint8Array | undefined>, alpha: Uint8Array | null, n: number, cmyk: CmykToRgb | null | undefined): Uint8ClampedArray {
  const out = new Uint8ClampedArray(n * 4), m = psd.mode, p0 = planes[0], p1 = planes[1], p2 = planes[2], p3 = planes[3];
  for (let i = 0; i < n; i++) {
    let r = 0, g = 0, b = 0;
    if (m === 3) { r = p0?.[i] ?? 0; g = p1?.[i] ?? 0; b = p2?.[i] ?? 0; }
    else if (m === 1 || m === 0 || m === 8) { r = g = b = p0?.[i] ?? 0; }
    else if (m === 2) { const k = p0?.[i] ?? 0, pal = psd.palette; if (pal) { r = pal[k]; g = pal[256 + k]; b = pal[512 + k]; } }
    else if (m === 4) {
      const c = 255 - (p0?.[i] ?? 255), mm = 255 - (p1?.[i] ?? 255), y = 255 - (p2?.[i] ?? 255), k = 255 - (p3?.[i] ?? 255), rgb = cmyk ? cmyk(c, mm, y, k) : null;
      if (rgb) { r = rgb[0]; g = rgb[1]; b = rgb[2]; } else { r = ((255 - c) * (255 - k) + 127) / 255; g = ((255 - mm) * (255 - k) + 127) / 255; b = ((255 - y) * (255 - k) + 127) / 255; }
    } else if (m === 9) [r, g, b] = labToRgb(p0?.[i] ?? 0, p1?.[i] ?? 128, p2?.[i] ?? 128);
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = alpha ? alpha[i] : 255;
  }
  return out;
}

const wanted = (psd: Psd): number => (psd.mode === 3 || psd.mode === 9 ? 3 : psd.mode === 4 ? 4 : 1);

function checkMode(psd: Psd): void {
  if (psd.mode === 7) throw new Error('Multichannel Photoshop files are not supported');
  if (![0, 1, 2, 3, 4, 8, 9].includes(psd.mode)) throw new Error('its colour mode is not supported');
}

export function readPsdInfo(data: ArrayBuffer): PsdInfo {
  const p = new Psd(data);
  return { width: p.width, height: p.height, depth: p.depth, mode: MODES[p.mode] ?? 'Unknown', ppiX: p.ppiX, ppiY: p.ppiY, layers: p.recs.filter((r) => r.section === 0).length, groups: p.recs.filter((r) => r.section === 1 || r.section === 2).length, icc: p.icc, hasComposite: p.b.length > p.imageAt + 2 };
}

export async function readPsdComposite(data: ArrayBuffer, cmyk?: CmykToRgb | null): Promise<PsdComposite | null> {
  const psd = new Psd(data);
  checkMode(psd);
  const at = psd.imageAt;
  if (psd.b.length < at + 2) return null;
  const comp = psd.dv.getUint16(at), w = psd.width, h = psd.height, n = psd.channels, need = Math.min(n, wanted(psd) + (psd.negative ? 1 : 0));
  const planes: Uint8Array[] = [];
  let counts: number[][] | null = null, q = at + 2;
  const bytes = psd.depth === 16 ? 2 : 1, rowBytes = psd.depth === 1 ? (w + 7) >> 3 : w * bytes;
  if (comp === 1) {
    const cw = psd.wide ? 4 : 2;
    counts = [];
    for (let c = 0; c < n; c++) { const row: number[] = []; for (let y = 0; y < h; y++) row.push(cw === 4 ? psd.dv.getUint32(q + (c * h + y) * 4) : psd.dv.getUint16(q + (c * h + y) * 2)); counts.push(row); }
    q += n * h * cw;
  }
  if (comp === 2 || comp === 3) {
    const big = await psd.planeBody(comp, q, psd.b.length, w, h * n, new Uint8Array(w * h * n));
    for (let c = 0; c < need; c++) planes.push(big.subarray(c * w * h, (c + 1) * w * h));
  }
  for (let c = 0; c < need && planes.length < need; c++) {
    const out = new Uint8Array(w * h);
    if (comp === 1 && counts) {
      let start = q;
      for (let k = 0; k < c; k++) start += counts[k].reduce((a, v) => a + v, 0);
      await psd.planeBody(1, start, start + counts[c].reduce((a, v) => a + v, 0), w, h, out, counts[c]);
    } else if (comp === 0) await psd.planeBody(0, q + c * rowBytes * h, q + (c + 1) * rowBytes * h, w, h, out);
    else throw new Error(`Photoshop composite compression ${comp} is not supported`);
    planes.push(out);
  }
  const nb = wanted(psd), alpha = psd.negative && planes.length > nb ? planes[nb] : null;
  const rgba = colour(psd, planes, alpha, w * h, cmyk);
  if (alpha) {
    // Photoshop stores the merged image with transparency matted against white; undo that.
    for (let i = 0; i < w * h; i++) {
      const a = rgba[i * 4 + 3];
      if (a === 0 || a === 255) continue;
      const k = 255 / a, m = 255 * (1 - a / 255) * k;
      for (let c = 0; c < 3; c++) rgba[i * 4 + c] = rgba[i * 4 + c] * k - m;
    }
  }
  return { width: w, height: h, rgba, alpha: !!alpha };
}

export async function readPsdLayers(data: ArrayBuffer, cmyk?: CmykToRgb | null): Promise<PsdLayers> {
  const psd = new Psd(data);
  checkMode(psd);
  const skipped: string[] = [], notes: string[] = [], stack: PsdNode[][] = [[]];
  let clipped = 0, texts = 0, masks = 0;
  for (const r of psd.recs) {
    const name = r.name || 'Layer';
    if (r.section === 3) { stack.push([]); continue; }
    if (r.section === 1 || r.section === 2) {
      const kids = stack.length > 1 ? (stack.pop() as PsdNode[]) : [];
      stack[stack.length - 1].push({ kind: 'group', name, visible: r.visible, opacity: r.opacity, blend: r.blend, left: 0, top: 0, w: 0, h: 0, children: kids });
      continue;
    }
    const w = r.right - r.left, h = r.bottom - r.top, colourChans = r.chans.filter((c) => c.id >= 0 && c.len > 2);
    if (w <= 0 || h <= 0 || !colourChans.length) { skipped.push(r.adjust ? `${name} (${r.adjust} adjustment)` : `${name} (no pixels)`); continue; }
    if (w * h > MAX_PIXELS) { skipped.push(`${name} (too large)`); continue; }
    const planes: Array<Uint8Array | undefined> = [];
    let alpha: Uint8Array | null = null;
    for (const c of r.chans) {
      if (c.id >= 0 && c.id < wanted(psd)) planes[c.id] = await psd.plane(c.at, c.len, w, h);
      else if (c.id === -1) alpha = await psd.plane(c.at, c.len, w, h);
    }
    const rgba = colour(psd, planes, alpha, w * h, cmyk);
    const mc = r.chans.find((c) => c.id === -2);
    if (mc && r.mask && !r.mask.disabled && r.mask.right > r.mask.left && r.mask.bottom > r.mask.top) {
      const mw = r.mask.right - r.mask.left, mh = r.mask.bottom - r.mask.top, mp = await psd.plane(mc.at, mc.len, mw, mh);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const mx = x + r.left - r.mask.left, my = y + r.top - r.mask.top, v = mx >= 0 && my >= 0 && mx < mw && my < mh ? mp[my * mw + mx] : r.mask.def;
        const i = (y * w + x) * 4 + 3;
        rgba[i] = Math.round((rgba[i] * v) / 255);
      }
      masks++;
    }
    if (r.clipping) clipped++;
    if (r.text) texts++;
    stack[stack.length - 1].push({ kind: 'layer', name, visible: r.visible, opacity: r.opacity * r.fill, blend: r.blend, left: r.left, top: r.top, w, h, rgba, text: r.text, clipped: r.clipping });
  }
  while (stack.length > 1) { const k = stack.pop() as PsdNode[]; stack[stack.length - 1].push(...k); }
  if (texts) notes.push(`${texts} type ${texts === 1 ? 'layer comes' : 'layers come'} in as pixels`);
  if (masks) notes.push(`${masks} layer ${masks === 1 ? 'mask is' : 'masks are'} applied to the pixels`);
  if (clipped) notes.push(`${clipped} clipping ${clipped === 1 ? 'mask is' : 'masks are'} not applied`);
  return { width: psd.width, height: psd.height, nodes: stack[0], skipped, notes };
}
