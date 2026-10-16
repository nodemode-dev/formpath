import type { Color, ColorSettings, Doc, ProfileRef, RGB } from './types';

export interface ProfileInfo { id: string; name: string; space: string; class: string; size: number; source: 'builtin' | 'user' | 'system' }
export interface ColorBackend {
  profiles(): Promise<ProfileInfo[]>;
  profileBytes(id: string): Promise<Uint8Array>;
  lut(kind: 'rgb-to-cmyk' | 'cmyk-to-rgb' | 'proof' | 'preserve', body: Record<string, unknown>): Promise<Uint8Array>;
  displayProfile?(): Promise<(ProfileInfo & { via: string }) | null>;
}
export interface Lut { n: number; data: Uint8Array }
export interface CmykLuts { r2c: Lut; c2r: Lut }
export interface Resolved { rgb: ProfileInfo | null; cmyk: ProfileInfo | null; intent: 0 | 1 | 2 | 3; bpc: boolean }

export const INTENTS: ReadonlyArray<readonly [0 | 1 | 2 | 3, string]> = [[0, 'Perceptual'], [1, 'Relative Colorimetric'], [2, 'Saturation'], [3, 'Absolute Colorimetric']];
export const GENERIC_CMYK_NAME = 'formpth Generic CMYK';
export const SRGB_NAME = 'sRGB (built-in)';
const GRID = { 'rgb-to-cmyk': 17, 'cmyk-to-rgb': 9, proof: 33, preserve: 9 } as const;

let backend: ColorBackend | null = null;
let profiles: ProfileInfo[] = [];
let listing: Promise<ProfileInfo[]> | null = null;
const lutCache = new Map<string, Promise<Uint8Array>>();
const listeners = new Set<() => void>();

let wanted = '';
let active: CmykLuts | null = null;
let activeKey = '';
let proofOn = false;
let proofKey = '';
let proofLut: Lut | null = null;
let proofWanted = '';
let preserveLut: Lut | null = null;
let previewRender = false;
let display: (ProfileInfo & { via: string }) | null = null;

export function displayProfileInfo(): (ProfileInfo & { via: string }) | null { return display; }
export function refreshDisplayProfile(): Promise<(ProfileInfo & { via: string }) | null> {
  const ask = backend?.displayProfile;
  if (!ask || !backend) return Promise.resolve(display);
  return ask.call(backend).then((p) => { display = p; return p; }, () => display);
}
export function setPreviewRender(on: boolean): void { previewRender = on; }

export function setColorBackend(b: ColorBackend | null): void { backend = b; }
export function onColorChange(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
function notify(): void { for (const fn of listeners) fn(); }

export function profileList(): ProfileInfo[] { return profiles; }
export function refreshProfiles(force = false): Promise<ProfileInfo[]> {
  if (!backend) return Promise.resolve(profiles);
  if (!listing || force) listing = backend.profiles().then((p) => { profiles = p; return p; }).catch(() => { listing = null; return profiles; });
  return listing;
}
export function addProfile(p: ProfileInfo): void { if (!profiles.some((x) => x.id === p.id)) profiles = [...profiles, p]; }

export function resolveProfile(ref: ProfileRef | undefined, space: 'RGB' | 'CMYK'): ProfileInfo | null {
  if (ref) { const hit = profiles.find((p) => p.id === ref.id && p.space === space) ?? profiles.find((p) => p.name === ref.name && p.space === space); if (hit) return hit; }
  if (space === 'RGB') return profiles.find((p) => p.source === 'builtin' && p.space === 'RGB') ?? null;
  return null;
}
export const refOf = (p: ProfileInfo): ProfileRef => ({ id: p.id, name: p.name });
export const genericCmyk = (): ProfileInfo | null => profiles.find((p) => p.source === 'builtin' && p.space === 'CMYK') ?? null;

export function resolveSettings(cm: ColorSettings | undefined): Resolved {
  return { rgb: resolveProfile(cm?.rgb, 'RGB'), cmyk: cm?.cmyk ? resolveProfile(cm.cmyk, 'CMYK') : null, intent: cm?.intent ?? 1, bpc: cm?.bpc ?? true };
}
export function proofDevice(cm: ColorSettings | undefined): ProfileInfo | null {
  return resolveProfile(cm?.proof?.device, 'CMYK') ?? (cm?.cmyk ? resolveProfile(cm.cmyk, 'CMYK') : null) ?? genericCmyk();
}

function fetchLut(kind: keyof typeof GRID, body: Record<string, unknown>): Promise<Uint8Array> {
  const key = `${kind}|${JSON.stringify(body)}`;
  let p = lutCache.get(key);
  if (!p) {
    if (!backend) return Promise.reject(new Error('The formpth engine is not reachable.'));
    p = backend.lut(kind, { ...body, grid: GRID[kind] });
    lutCache.set(key, p);
    p.catch(() => lutCache.delete(key));
  }
  return p;
}

export async function cmykLuts(rgb: ProfileInfo, cmyk: ProfileInfo, intent: number, bpc: boolean): Promise<CmykLuts> {
  const [a, b] = await Promise.all([
    fetchLut('rgb-to-cmyk', { rgb: rgb.id, cmyk: cmyk.id, intent, bpc }),
    fetchLut('cmyk-to-rgb', { rgb: rgb.id, cmyk: cmyk.id, intent, bpc }),
  ]);
  return { r2c: { n: GRID['rgb-to-cmyk'], data: a }, c2r: { n: GRID['cmyk-to-rgb'], data: b } };
}

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

export function lutCmykToRgb(l: Lut, c: number, m: number, y: number, k: number): RGB {
  const n = l.n, d = l.data, top = n - 2, sc = (n - 1) / 100;
  const fc = Math.max(0, Math.min(n - 1, c * sc)), fm = Math.max(0, Math.min(n - 1, m * sc)), fy = Math.max(0, Math.min(n - 1, y * sc)), fk = Math.max(0, Math.min(n - 1, k * sc));
  const ic = Math.min(top, Math.floor(fc)), im = Math.min(top, Math.floor(fm)), iy = Math.min(top, Math.floor(fy)), ik = Math.min(top, Math.floor(fk));
  const tc = fc - ic, tm = fm - im, ty = fy - iy, tk = fk - ik;
  const s2 = n * 3, s1 = n * s2, s0 = n * s1;
  const base = ic * s0 + im * s1 + iy * s2 + ik * 3;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < 16; i++) {
    const w = (i & 8 ? tc : 1 - tc) * (i & 4 ? tm : 1 - tm) * (i & 2 ? ty : 1 - ty) * (i & 1 ? tk : 1 - tk);
    if (w === 0) continue;
    const o = base + (i & 8 ? s0 : 0) + (i & 4 ? s1 : 0) + (i & 2 ? s2 : 0) + (i & 1 ? 3 : 0);
    r += w * d[o]; g += w * d[o + 1]; b += w * d[o + 2];
  }
  return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
}

export function lutRgbToCmyk(l: Lut, r: number, g: number, b: number): Color {
  const n = l.n, d = l.data, top = n - 2, sc = (n - 1) / 255;
  const fr = Math.max(0, Math.min(n - 1, r * sc)), fg = Math.max(0, Math.min(n - 1, g * sc)), fb = Math.max(0, Math.min(n - 1, b * sc));
  const ir = Math.min(top, Math.floor(fr)), ig = Math.min(top, Math.floor(fg)), ib = Math.min(top, Math.floor(fb));
  const tr = fr - ir, tg = fg - ig, tb = fb - ib;
  const s1 = n * 4, s0 = n * s1;
  const base = ir * s0 + ig * s1 + ib * 4;
  let c = 0, m = 0, y = 0, k = 0;
  for (let i = 0; i < 8; i++) {
    const w = (i & 4 ? tr : 1 - tr) * (i & 2 ? tg : 1 - tg) * (i & 1 ? tb : 1 - tb);
    if (w === 0) continue;
    const o = base + (i & 4 ? s0 : 0) + (i & 2 ? s1 : 0) + (i & 1 ? 4 : 0);
    c += w * d[o]; m += w * d[o + 1]; y += w * d[o + 2]; k += w * d[o + 3];
  }
  const p = (v: number): number => Math.round((v / 255) * 1000) / 10;
  return { kind: 'cmyk', c: p(c), m: p(m), y: p(y), k: p(k) };
}

export function rgbToCmykBytes(l: Lut): (r: number, g: number, b: number, out: Uint8Array, at: number) => void {
  const n = l.n, d = l.data, top = n - 2, sc = (n - 1) / 255, s1 = n * 4, s0 = n * s1;
  let pr = -1, pg = -1, pb = -1, c = 0, m = 0, y = 0, k = 0;
  return (r, g, b, out, at) => {
    if (r !== pr || g !== pg || b !== pb) {
      pr = r; pg = g; pb = b;
      const fr = r * sc, fg = g * sc, fb = b * sc;
      const ir = fr > top ? top : fr | 0, ig = fg > top ? top : fg | 0, ib = fb > top ? top : fb | 0;
      const tr = fr - ir, tg = fg - ig, tb = fb - ib, wr = 1 - tr, wg = 1 - tg, wb = 1 - tb;
      const w0 = wr * wg * wb, w1 = wr * wg * tb, w2 = wr * tg * wb, w3 = wr * tg * tb, w4 = tr * wg * wb, w5 = tr * wg * tb, w6 = tr * tg * wb, w7 = tr * tg * tb;
      const p = ir * s0 + ig * s1 + ib * 4, o1 = p + 4, o2 = p + s1, o3 = p + s1 + 4, o4 = p + s0, o5 = p + s0 + 4, o6 = p + s0 + s1, o7 = p + s0 + s1 + 4;
      c = Math.round(d[p] * w0 + d[o1] * w1 + d[o2] * w2 + d[o3] * w3 + d[o4] * w4 + d[o5] * w5 + d[o6] * w6 + d[o7] * w7);
      m = Math.round(d[p + 1] * w0 + d[o1 + 1] * w1 + d[o2 + 1] * w2 + d[o3 + 1] * w3 + d[o4 + 1] * w4 + d[o5 + 1] * w5 + d[o6 + 1] * w6 + d[o7 + 1] * w7);
      y = Math.round(d[p + 2] * w0 + d[o1 + 2] * w1 + d[o2 + 2] * w2 + d[o3 + 2] * w3 + d[o4 + 2] * w4 + d[o5 + 2] * w5 + d[o6 + 2] * w6 + d[o7 + 2] * w7);
      k = Math.round(d[p + 3] * w0 + d[o1 + 3] * w1 + d[o2 + 3] * w2 + d[o3 + 3] * w3 + d[o4 + 3] * w4 + d[o5 + 3] * w5 + d[o6 + 3] * w6 + d[o7 + 3] * w7);
    }
    out[at] = c; out[at + 1] = m; out[at + 2] = y; out[at + 3] = k;
  };
}

export async function printCmykLuts(doc: Doc): Promise<{ profile: ProfileInfo; lut: Lut } | null> {
  if (!backend) return null;
  try {
    if (!profiles.length) await refreshProfiles();
    const s = resolveSettings(doc.cm), cmyk = s.cmyk ?? genericCmyk();
    if (!s.rgb || !cmyk) return null;
    const luts = await cmykLuts(s.rgb, cmyk, s.intent, s.bpc);
    return { profile: cmyk, lut: luts.r2c };
  } catch { return null; }
}

let lastC = -1, lastM = -1, lastY = -1, lastK = -1, lastRgb: RGB = { r: 255, g: 255, b: 255 };
export function cmToRgb(c: { c: number; m: number; y: number; k: number }): RGB | null {
  if (previewRender && proofOn && preserveLut) return lutCmykToRgb(preserveLut, c.c, c.m, c.y, c.k);
  if (!active) return null;
  if (c.c === lastC && c.m === lastM && c.y === lastY && c.k === lastK) return lastRgb;
  lastRgb = lutCmykToRgb(active.c2r, c.c, c.m, c.y, c.k);
  lastC = c.c; lastM = c.m; lastY = c.y; lastK = c.k;
  return lastRgb;
}
export function cmToCmyk(v: RGB): Color | null { return active ? lutRgbToCmyk(active.r2c, v.r, v.g, v.b) : null; }
export function colorManaged(): boolean { return !!active; }

function settingsKey(cm: ColorSettings | undefined): string { return cm?.cmyk ? `${cm.rgb?.id ?? ''}|${cm.cmyk.id}|${cm.intent ?? 1}|${cm.bpc ?? true}` : ''; }

export function activateDocument(doc: Doc | null): void {
  const cm = doc?.cm;
  const key = settingsKey(cm);
  if (key !== wanted || (key !== activeKey && !key)) {
    wanted = key;
    if (!key) { if (active) { active = null; activeKey = ''; lastC = -1; notify(); } else activeKey = ''; }
    else { const run = loadActive(cm as ColorSettings, key); pending = run; void run.finally(() => { if (pending === run) pending = null; }); }
  }
  refreshProof(doc);
}

let pending: Promise<void> | null = null;
export function colorSettled(): Promise<void> { return pending ?? Promise.resolve(); }

async function loadActive(cm: ColorSettings, key: string): Promise<void> {
  try {
    if (!profiles.length) await refreshProfiles();
    const s = resolveSettings(cm);
    if (!s.rgb || !s.cmyk) return;
    const luts = await cmykLuts(s.rgb, s.cmyk, s.intent, s.bpc);
    if (wanted !== key) return;
    active = luts; activeKey = key; lastC = -1;
    notify();
  } catch {
    if (wanted === key && active) { active = null; activeKey = ''; notify(); }
  }
}

export function isProofing(): boolean { return proofOn; }
export function activeProof(): Lut | null { return proofOn ? proofLut : null; }

function proofBody(cm: ColorSettings | undefined): { key: string; body: Record<string, unknown>; keep: boolean } | null {
  const rgb = resolveProfile(cm?.rgb, 'RGB'), dev = proofDevice(cm);
  if (!rgb || !dev) return null;
  const body: Record<string, unknown> = { rgb: rgb.id, device: dev.id, intent: cm?.intent ?? 1, bpc: cm?.bpc ?? true, paper: !!cm?.proof?.paper, black_ink: !!cm?.proof?.blackInk };
  if (display) body.monitor = display.id;
  const keep = !!cm?.proof?.preserve;
  return { key: JSON.stringify(body) + (keep ? '|keep' : ''), body, keep };
}

async function loadProof(cm: ColorSettings | undefined): Promise<boolean> {
  if (!profiles.length) await refreshProfiles();
  await refreshDisplayProfile();
  const want = proofBody(cm);
  if (!want) return false;
  proofWanted = want.key;
  if (proofKey === want.key && proofLut) return true;
  const { intent: _intent, ...keepBody } = want.body;
  const [data, kept] = await Promise.all([fetchLut('proof', want.body), want.keep ? fetchLut('preserve', keepBody) : Promise.resolve(null)]);
  if (proofWanted !== want.key) return false;
  proofLut = { n: GRID.proof, data }; proofKey = want.key;
  preserveLut = kept ? { n: GRID.preserve, data: kept } : null;
  lastC = -1;
  return true;
}

function refreshProof(doc: Doc | null): void {
  if (!proofOn) return;
  const want = proofBody(doc?.cm);
  if (want && want.key === proofKey) return;
  void loadProof(doc?.cm).then((ok) => { if (ok) notify(); }).catch(() => undefined);
}

export async function setProofing(on: boolean, doc: Doc | null): Promise<boolean> {
  if (!on) { if (proofOn) { proofOn = false; notify(); } return false; }
  try { if (!(await loadProof(doc?.cm))) return false; } catch { return false; }
  proofOn = true;
  notify();
  return true;
}

export function applyProof(px: Uint8ClampedArray, stride: number, x0: number, y0: number, x1: number, y1: number, lut: Lut): void {
  const n = lut.n, d = lut.data, top = n - 2, sc = (n - 1) / 255, s1 = n * 3, s0 = n * s1;
  let pr = -1, pg = -1, pb = -1, or = 0, og = 0, ob = 0;
  for (let y = y0; y < y1; y++) {
    let o = (y * stride + x0) * 4;
    for (let x = x0; x < x1; x++, o += 4) {
      const r = px[o], g = px[o + 1], b = px[o + 2];
      if (r !== pr || g !== pg || b !== pb) {
        pr = r; pg = g; pb = b;
        const fr = r * sc, fg = g * sc, fb = b * sc;
        const ir = fr > top ? top : fr | 0, ig = fg > top ? top : fg | 0, ib = fb > top ? top : fb | 0;
        const tr = fr - ir, tg = fg - ig, tb = fb - ib;
        const p = ir * s0 + ig * s1 + ib * 3;
        const wr = 1 - tr, wg = 1 - tg, wb = 1 - tb;
        const w000 = wr * wg * wb, w001 = wr * wg * tb, w010 = wr * tg * wb, w011 = wr * tg * tb, w100 = tr * wg * wb, w101 = tr * wg * tb, w110 = tr * tg * wb, w111 = tr * tg * tb;
        const a = p, bq = p + 3, c = p + s1, dq = p + s1 + 3, e = p + s0, f = p + s0 + 3, g2 = p + s0 + s1, h = p + s0 + s1 + 3;
        or = d[a] * w000 + d[bq] * w001 + d[c] * w010 + d[dq] * w011 + d[e] * w100 + d[f] * w101 + d[g2] * w110 + d[h] * w111;
        og = d[a + 1] * w000 + d[bq + 1] * w001 + d[c + 1] * w010 + d[dq + 1] * w011 + d[e + 1] * w100 + d[f + 1] * w101 + d[g2 + 1] * w110 + d[h + 1] * w111;
        ob = d[a + 2] * w000 + d[bq + 2] * w001 + d[c + 2] * w010 + d[dq + 2] * w011 + d[e + 2] * w100 + d[f + 2] * w101 + d[g2 + 2] * w110 + d[h + 2] * w111;
      }
      px[o] = or; px[o + 1] = og; px[o + 2] = ob;
    }
  }
}

export async function documentCmykProfileBytes(doc: Doc): Promise<Uint8Array | null> {
  if (!backend || !doc.cm?.cmyk) return null;
  try {
    if (!profiles.length) await refreshProfiles();
    const p = resolveProfile(doc.cm.cmyk, 'CMYK');
    return p ? await backend.profileBytes(p.id) : null;
  } catch { return null; }
}

export async function outputProfileBytes(doc: Doc, space: 'RGB' | 'CMYK'): Promise<{ bytes: Uint8Array; name: string } | null> {
  if (!backend) return null;
  try {
    if (!profiles.length) await refreshProfiles();
    const p = resolveProfile(space === 'CMYK' ? doc.cm?.cmyk : doc.cm?.rgb, space) ?? profiles.find((x) => x.source === 'builtin' && x.space === space) ?? null;
    return p ? { bytes: await backend.profileBytes(p.id), name: p.name } : null;
  } catch { return null; }
}

export function withSettings(doc: Doc, patch: Partial<ColorSettings>): Doc {
  const next: ColorSettings = { ...(doc.cm ?? {}), ...patch };
  for (const k of Object.keys(next) as Array<keyof ColorSettings>) if (next[k] === undefined) delete next[k];
  const rest = { ...doc };
  if (Object.keys(next).length) rest.cm = next; else delete rest.cm;
  return rest;
}
