import { parse, type Font, type PathCommand } from 'opentype.js';
import { anchor, mul, rotateAbout, transformPath } from '../engine/geometry';
import { fontsChanged, layoutText, weightOf } from '../engine/text';
import type { Anchor, Mat, PathData, SubPath, TextNode } from '../engine';
import { api, type FontInfo } from './api';

const BUNDLED = import.meta.glob('../../node_modules/@fontsource/{inter,jetbrains-mono}/files/*-latin-*-{normal,italic}.woff', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>;

export const BUNDLED_FAMILIES = ['Inter', 'JetBrains Mono'];
export const WEB_FAMILIES = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Garamond', 'Palatino', 'Futura', 'Avenir', 'Gill Sans', 'Optima', 'Menlo', 'Impact'];
export const STYLES = ['Thin', 'Extra Light', 'Light', 'Regular', 'Medium', 'Semibold', 'Bold', 'Extra Bold', 'Black', 'Italic', 'Light Italic', 'Medium Italic', 'Bold Italic'];

function bundledLoader(family: string, style: string): (() => Promise<string>) | null {
  const slug = family.toLowerCase().replace(/\s+/g, '-');
  if (slug !== 'inter' && slug !== 'jetbrains-mono') return null;
  const { weight, italic } = weightOf(style);
  const pick = (w: number, it: boolean): (() => Promise<string>) | null => {
    const key = Object.keys(BUNDLED).find((k) => k.endsWith(`/${slug}-latin-${w}-${it ? 'italic' : 'normal'}.woff`));
    return key ? BUNDLED[key] : null;
  };
  const ws = [weight, 400, 500, 600, 700, 300];
  for (const w of ws) { const l = pick(w, italic) ?? pick(w, false); if (l) return l; }
  return null;
}

const faces = new Set<string>();
let onFace: (() => void) | null = null;
export function onFontsLoaded(fn: () => void): void { onFace = fn; }

export async function ensureFace(family: string, style: string): Promise<void> {
  const key = `${family}|${style}`;
  if (faces.has(key)) return;
  faces.add(key);
  const load = bundledLoader(family, style);
  if (!load) return;
  try {
    const url = await load(), { weight, italic } = weightOf(style);
    const face = new FontFace(family, `url(${url})`, { weight: String(weight), style: italic ? 'italic' : 'normal' });
    await face.load();
    document.fonts.add(face);
    fontsChanged();
    onFace?.();
  } catch { faces.delete(key); }
}

let systemList: FontInfo[] | null = null;
export async function systemFonts(): Promise<FontInfo[]> {
  if (systemList) return systemList;
  systemList = await api.fonts();
  return systemList;
}

export function families(): string[] {
  const sys = [...new Set((systemList ?? []).map((f) => f.family))].sort((a, b) => a.localeCompare(b));
  return [...BUNDLED_FAMILIES, ...WEB_FAMILIES.filter((f) => !sys.includes(f)), ...sys.filter((f) => !BUNDLED_FAMILIES.includes(f))];
}

export function stylesOf(family: string): string[] {
  const sys = (systemList ?? []).filter((f) => f.family === family).map((f) => f.style);
  return sys.length ? [...new Set(sys)] : STYLES;
}

const parsed = new Map<string, Promise<Font | null>>();
export function fontFor(family: string, style: string): Promise<Font | null> {
  const key = `${family}|${style}`;
  let p = parsed.get(key);
  if (!p) {
    p = (async () => {
      try {
        const load = bundledLoader(family, style);
        if (load) { const url = await load(); return parse(await (await fetch(url)).arrayBuffer()); }
        const hit = await api.findFont(family, style);
        if (!hit) return null;
        return parse(await api.fontFile(hit.id));
      } catch { return null; }
    })();
    parsed.set(key, p);
  }
  return p;
}

function commandsToPath(cmds: PathCommand[], m: Mat): PathData {
  const out: SubPath[] = [];
  let cur: Anchor[] = [], last = { x: 0, y: 0 };
  const flush = (closed: boolean): void => {
    if (cur.length > 1) {
      if (closed) { const a = cur[0], b = cur[cur.length - 1]; if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) { a.ix = b.ix; a.iy = b.iy; cur.pop(); } }
      out.push({ closed, pts: cur });
    }
    cur = [];
  };
  for (const c of cmds) {
    if (c.type === 'M') { flush(false); last = { x: c.x ?? 0, y: c.y ?? 0 }; cur.push(anchor(last.x, last.y)); }
    else if (c.type === 'L') { last = { x: c.x ?? 0, y: c.y ?? 0 }; cur.push(anchor(last.x, last.y)); }
    else if (c.type === 'C') {
      const prev = cur[cur.length - 1];
      if (prev) { prev.ox = c.x1 ?? prev.x; prev.oy = c.y1 ?? prev.y; }
      last = { x: c.x ?? 0, y: c.y ?? 0 };
      cur.push({ x: last.x, y: last.y, ix: c.x2 ?? last.x, iy: c.y2 ?? last.y, ox: last.x, oy: last.y });
    } else if (c.type === 'Q') {
      const prev = cur[cur.length - 1], qx = c.x1 ?? 0, qy = c.y1 ?? 0, x = c.x ?? 0, y = c.y ?? 0;
      if (prev) { prev.ox = prev.x + (2 / 3) * (qx - prev.x); prev.oy = prev.y + (2 / 3) * (qy - prev.y); }
      cur.push({ x, y, ix: x + (2 / 3) * (qx - x), iy: y + (2 / 3) * (qy - y), ox: x, oy: y });
      last = { x, y };
    } else if (c.type === 'Z') flush(true);
  }
  flush(false);
  return transformPath(out, m);
}

export async function outlineText(n: TextNode): Promise<PathData | null> {
  const lay = layoutText(n);
  const out: SubPath[] = [];
  for (const g of lay.glyphs) {
    if (g.ch === ' ' || g.ch === '\t') continue;
    const font = await fontFor(g.style.font, g.style.style);
    if (!font) return null;
    const glyph = font.charToGlyph(g.ch);
    const local: Mat = mul([1, 0, 0, 1, g.x, g.y], mul(g.angle ? rotateAbout((g.angle * 180) / Math.PI, 0, 0) : [1, 0, 0, 1, 0, 0], [g.style.hscale / 100, 0, 0, g.style.vscale / 100, 0, 0]));
    const m = n.mode === 'path' ? local : mul(n.xf, local);
    out.push(...commandsToPath(glyph.getPath(0, 0, g.size).commands, m));
  }
  return out;
}

export async function glyphList(family: string, style: string, limit = 2000): Promise<string[]> {
  const font = await fontFor(family, style);
  if (!font) return [];
  const out: string[] = [];
  for (let i = 0; i < Math.min(font.glyphs.length, limit); i++) {
    const g = font.glyphs.get(i);
    for (const u of g.unicodes ?? []) if (u > 31) out.push(String.fromCodePoint(u));
  }
  return [...new Set(out)];
}
