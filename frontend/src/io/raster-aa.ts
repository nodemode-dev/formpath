import type { VNode } from '../engine/types';

export type AntiAlias = 'art' | 'none' | 'type';

const MAX_PIXELS = 100_000_000;

export function hardEdges(c: HTMLCanvasElement): void {
  const w = c.width, h = c.height, g = c.getContext('2d');
  if (!g || w * h > MAX_PIXELS) return;
  const img = g.getImageData(0, 0, w, h), d = img.data, u = new Uint32Array(d.buffer), n = w * h;
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3];
    if (a === 0 || a === 255) continue;
    if (a >= 128) d[i * 4 + 3] = 255; else u[i] = 0;
  }
  const flat = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const up = y > 0 ? y - 1 : 0, dn = y < h - 1 ? y + 1 : h - 1;
    for (let x = 0; x < w; x++) {
      const lf = x > 0 ? x - 1 : 0, rt = x < w - 1 ? x + 1 : w - 1, v = u[y * w + x];
      const same = (u[up * w + lf] === v ? 1 : 0) + (u[up * w + x] === v ? 1 : 0) + (u[up * w + rt] === v ? 1 : 0) + (u[y * w + lf] === v ? 1 : 0) + (u[y * w + rt] === v ? 1 : 0) + (u[dn * w + lf] === v ? 1 : 0) + (u[dn * w + x] === v ? 1 : 0) + (u[dn * w + rt] === v ? 1 : 0);
      if (same >= 5) flat[y * w + x] = 1;
    }
  }
  const found: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (flat[i] || d[i * 4 + 3] !== 255) continue;
    found.length = 0;
    let over = false;
    for (let yy = Math.max(0, y - 2); yy <= Math.min(h - 1, y + 2) && !over; yy++) for (let xx = Math.max(0, x - 2); xx <= Math.min(w - 1, x + 2); xx++) {
      const j = yy * w + xx;
      if (!flat[j] || d[j * 4 + 3] !== 255) continue;
      const v = u[j];
      if (found.indexOf(v) < 0) { found.push(v); if (found.length > 4) { over = true; break; } }
    }
    if (over || !found.length) continue;
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
    let lo0 = 255, lo1 = 255, lo2 = 255, hi0 = 0, hi1 = 0, hi2 = 0, best = found[0], bd = Infinity;
    for (const v of found) {
      const r2 = v & 255, g2 = (v >>> 8) & 255, b2 = (v >>> 16) & 255;
      if (r2 < lo0) lo0 = r2; if (r2 > hi0) hi0 = r2; if (g2 < lo1) lo1 = g2; if (g2 > hi1) hi1 = g2; if (b2 < lo2) lo2 = b2; if (b2 > hi2) hi2 = b2;
      const e = (r2 - r) * (r2 - r) + (g2 - gg) * (g2 - gg) + (b2 - b) * (b2 - b);
      if (e < bd) { bd = e; best = v; }
    }
    if (r < lo0 - 2 || r > hi0 + 2 || gg < lo1 - 2 || gg > hi1 + 2 || b < lo2 - 2 || b > hi2 + 2) continue;
    u[i] = best;
  }
  g.putImageData(img, 0, 0);
}

export function hardScale(w: number, h: number): number {
  const ss = Math.floor(Math.sqrt(36_000_000 / Math.max(1, w * h)));
  return Math.max(1, Math.min(8, ss, Math.floor(16000 / Math.max(w, h))));
}

export function reduceHard(big: HTMLCanvasElement, c: HTMLCanvasElement, ss: number): void {
  const bw = big.width, bh = big.height, w = c.width, h = c.height, bg = big.getContext('2d'), g = c.getContext('2d');
  if (!bg || !g) return;
  const src = bg.getImageData(0, 0, bw, bh), u = new Uint32Array(src.data.buffer), out = g.createImageData(w, h), ou = new Uint32Array(out.data.buffer);
  const px = (x: number, y: number): number => u[(y < 0 ? 0 : y >= bh ? bh - 1 : y) * bw + (x < 0 ? 0 : x >= bw ? bw - 1 : x)];
  const score = (x: number, y: number): number => {
    const v = px(x, y);
    return (px(x - 1, y - 1) === v ? 1 : 0) + (px(x, y - 1) === v ? 1 : 0) + (px(x + 1, y - 1) === v ? 1 : 0) + (px(x - 1, y) === v ? 1 : 0) + (px(x + 1, y) === v ? 1 : 0) + (px(x - 1, y + 1) === v ? 1 : 0) + (px(x, y + 1) === v ? 1 : 0) + (px(x + 1, y + 1) === v ? 1 : 0);
  };
  const half = ss >> 1, reach = Math.min(2, Math.max(1, half));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = Math.min(bw - 1, x * ss + half), cy = Math.min(bh - 1, y * ss + half);
    let best = px(cx, cy), top = score(cx, cy);
    if (top < 7) {
      for (let dy = -reach; dy <= reach && top < 8; dy++) for (let dx = -reach; dx <= reach; dx++) {
        const s = score(cx + dx, cy + dy);
        if (s > top) { top = s; best = px(cx + dx, cy + dy); if (s === 8) break; }
      }
    }
    const a = best >>> 24;
    ou[y * w + x] = a === 0 || a === 255 ? best : a >= 128 ? (best | 0xff000000) >>> 0 : 0;
  }
  g.putImageData(out, 0, 0);
}

const lift = (m: number): number => Math.max(0, Math.min(1, (m - 0.45) * 1.7 + 0.5));

export function sharpenType(c: HTMLCanvasElement, mask: HTMLCanvasElement): void {
  const w = c.width, h = c.height, g = c.getContext('2d'), mg = mask.getContext('2d');
  if (!g || !mg || mask.width !== w || mask.height !== h || w * h > MAX_PIXELS) return;
  const img = g.getImageData(0, 0, w, h), d = img.data, md = mg.getImageData(0, 0, w, h).data;
  for (let i = 0; i < w * h; i++) {
    const p = i * 4, ma = md[p + 3];
    if (ma < 8 || ma > 247) continue;
    const m = ma / 255, m2 = lift(m);
    if (Math.abs(m2 - m) < 0.004) continue;
    const oa = d[p + 3] / 255, tr = md[p], tg = md[p + 1], tb = md[p + 2];
    const ua = (oa - m) / (1 - m);
    if (ua < -0.02 || ua > 1.02) continue;
    const ua2 = Math.max(0, Math.min(1, ua));
    const px: number[] = [];
    let ok = true;
    for (let k = 0; k < 3; k++) {
      const t = k === 0 ? tr : k === 1 ? tg : tb, opm = (d[p + k] * oa) , upm = (opm - m * t) / (1 - m);
      if (upm < -3 || upm > ua2 * 255 + 3) { ok = false; break; }
      px.push(Math.max(0, Math.min(ua2 * 255, upm)) * (1 - m2) + m2 * t);
    }
    if (!ok) continue;
    const na = m2 + ua2 * (1 - m2);
    if (na <= 0) continue;
    d[p] = Math.round(px[0] / na); d[p + 1] = Math.round(px[1] / na); d[p + 2] = Math.round(px[2] / na); d[p + 3] = Math.round(na * 255);
  }
  g.putImageData(img, 0, 0);
}

function plain(n: VNode): boolean { return n.opacity === 1 && n.blend === 'normal' && !n.mask && n.ap.effects.length === 0; }

export function typeTree(nodes: VNode[]): VNode[] {
  const out: VNode[] = [];
  for (const n of nodes) {
    if (n.hidden) continue;
    if (n.kind === 'text') { if (plain(n)) out.push(n); continue; }
    if (n.kind === 'layer' || (n.kind === 'group' && !n.clip && !n.trace && !n.livePaint)) {
      if (!plain(n) || n.ap.items.length > 0 || (n.kind === 'layer' && n.clip)) continue;
      const kids = typeTree(n.children);
      if (kids.length) out.push({ ...n, children: kids } as VNode);
    }
  }
  return out;
}
