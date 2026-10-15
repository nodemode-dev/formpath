import { textureArt } from './effects';
import type { Project } from './project';
import { canvas2d, renderNode } from './render';

const SIDE = 24;

async function bitmapOf(p: Project, key: string): Promise<ImageBitmap | HTMLImageElement | null> {
  const have = p.bitmaps.get(key);
  if (have) return have;
  const blob = p.assets.get(key);
  if (!blob || typeof createImageBitmap !== 'function') return null;
  try { const b = await createImageBitmap(blob); p.bitmaps.set(key, b); return b; } catch { return null; }
}

export async function textureAverage(p: Project, ref: string): Promise<string | null> {
  const ta = textureArt(p.doc, ref);
  if (!ta) return null;
  if (p.doc.images[ref]) await bitmapOf(p, ref);
  const { ctx } = canvas2d(SIDE, SIDE);
  ctx.setTransform(SIDE / ta.b.w, 0, 0, SIDE / ta.b.h, -ta.b.x * (SIDE / ta.b.w), -ta.b.y * (SIDE / ta.b.h));
  renderNode(ctx, ta.art, { doc: p.doc, scale: SIDE / Math.max(ta.b.w, ta.b.h), outline: false, assets: (k) => p.bitmaps.get(k) ?? null, printing: true });
  return averageOf(ctx);
}

export function imageAverage(img: CanvasImageSource, w: number, h: number): string | null {
  const { ctx } = canvas2d(SIDE, SIDE);
  ctx.drawImage(img, 0, 0, w, h, 0, 0, SIDE, SIDE);
  return averageOf(ctx);
}

function averageOf(ctx: CanvasRenderingContext2D): string | null {
  const d = ctx.getImageData(0, 0, SIDE, SIDE).data;
  let r = 0, g = 0, b = 0, a = 0;
  for (let i = 0; i < d.length; i += 4) { const w = d[i + 3] / 255; r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; a += w; }
  if (a < 1e-6) return null;
  const h = (v: number): string => Math.round(Math.min(255, Math.max(0, v / a))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function textureName(p: Project, ref: string): string {
  const sym = p.doc.symbols.find((s) => s.id === ref || s.name === ref);
  if (sym) return sym.name;
  const m = /^img-tex[a-z0-9]*-(.+?)(\.[a-z0-9]+)?$/i.exec(ref);
  return m ? m[1].replace(/-/g, ' ') : ref;
}
