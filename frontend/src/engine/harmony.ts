import { hsbToRgb, inMode, rgb, rgbToHsb, toRgb } from './paint';
import type { Color } from './types';

export const HARMONY_RULES = [
  ['complementary', 'Complementary'], ['split_complementary', 'Split Complementary'], ['left_complement', 'Left Complement'], ['right_complement', 'Right Complement'],
  ['analogous', 'Analogous'], ['monochromatic', 'Monochromatic'], ['shades', 'Shades'], ['triad', 'Triad'], ['tetrad', 'Tetrad'], ['compound', 'Compound'],
  ['high_contrast', 'High Contrast'], ['pentagram', 'Pentagram'],
] as const;
export type HarmonyRule = (typeof HARMONY_RULES)[number][0];
export type Variation = 'tints_shades' | 'warm_cool' | 'vivid_muted';

type HSB = [number, number, number];
const wrap = (h: number): number => ((h % 360) + 360) % 360;
const cl = (v: number): number => Math.max(0, Math.min(100, v));
const fromHsb = (h: number, s: number, b: number, like: Color): Color => { const v = hsbToRgb(wrap(h), cl(s), cl(b)); return like.kind === 'rgb' ? rgb(v.r, v.g, v.b) : inMode(rgb(v.r, v.g, v.b), like.kind === 'cmyk' ? 'cmyk' : 'rgb'); };
const hsbOf = (c: Color): HSB => { const v = toRgb(c); return rgbToHsb(v.r, v.g, v.b); };
const toward = (h: number, target: number, amt: number): number => { const d = ((target - h + 540) % 360) - 180; return h + Math.sign(d) * Math.min(Math.abs(d), amt); };

export function harmonyColors(base: Color, rule: HarmonyRule): Color[] {
  const [h, s, b] = hsbOf(base);
  const at = (dh: number, ds = 0, db = 0): Color => fromHsb(h + dh, s + ds, b + db, base);
  switch (rule) {
    case 'complementary': return [at(0), at(0, -25, 15), at(180), at(180, -25, 15), at(180, 0, -30)];
    case 'split_complementary': return [at(0), at(150), at(210), at(150, -20, 10), at(210, -20, -20)];
    case 'left_complement': return [at(0), at(150), at(150, -25, 10), at(150, 0, -30), at(0, -30, 15)];
    case 'right_complement': return [at(0), at(210), at(210, -25, 10), at(210, 0, -30), at(0, -30, 15)];
    case 'analogous': return [at(-60), at(-30), at(0), at(30), at(60)];
    case 'monochromatic': return [at(0), at(0, -40, 20), at(0, -20, 10), at(0, 0, -25), at(0, 10, -45)];
    case 'shades': return [at(0, 0, 40 - b), at(0, 0, 70 - b), at(0), at(0, 0, -25), at(0, 0, -50)];
    case 'triad': return [at(0), at(120), at(240), at(120, -25, 10), at(240, -25, -15)];
    case 'tetrad': return [at(0), at(90), at(180), at(270), at(0, -30, 15)];
    case 'compound': return [at(0), at(30), at(165), at(195), at(165, -25, -20)];
    case 'high_contrast': return [at(0), at(180, 0, -40), at(0, -60, 40), at(180), at(0, 0, -60)];
    case 'pentagram': return [at(0), at(72), at(144), at(216), at(288)];
  }
}

export function variations(c: Color, kind: Variation, steps = 3): Color[] {
  const [h, s, b] = hsbOf(c), out: Color[] = [];
  for (let k = -steps; k <= steps; k++) {
    const t = k / steps;
    if (kind === 'tints_shades') out.push(t < 0 ? fromHsb(h, s, b * (1 + t * 0.85), c) : fromHsb(h, s * (1 - t * 0.85), b + (100 - b) * t * 0.9, c));
    else if (kind === 'warm_cool') out.push(fromHsb(toward(h, t < 0 ? 210 : 30, Math.abs(t) * 30), s, b, c));
    else out.push(fromHsb(h, s * (1 + t * 0.9), b * (1 - Math.max(0, -t) * 0.15), c));
  }
  return out;
}

export function isNeutral(c: Color): boolean { const [, s, b] = hsbOf(c); return s < 12 || b < 8; }
