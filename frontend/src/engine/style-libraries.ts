import { effectDefaults } from './effects';
import { BLACK, effect, fill, linearGradient, NONE, parseColor, solid, stop, stroke, WHITE } from './paint';
import type { AppearanceItem, Color, Effect, GraphicStyle, Paint } from './types';

export interface StyleLibrary { id: string; name: string; styles: Array<Omit<GraphicStyle, 'id'>> }

const c = (h: string): Color => parseColor(h) ?? BLACK;
const fx = (id: string, p: Effect['params'] = {}): Effect => effect(id, { ...effectDefaults(id), ...p });
const lin = (bottom: string, top: string): Paint => ({ type: 'gradient', gradient: linearGradient([stop(0, c(bottom)), stop(1, c(top))], 90) });
const gloss: Paint = { type: 'gradient', gradient: linearGradient([stop(0, WHITE, 0), stop(1, WHITE, 0.6)], 90) };
const on = <T extends AppearanceItem>(it: T, ...e: Effect[]): T => ({ ...it, effects: e });
const style = (name: string, items: AppearanceItem[], effects: Effect[] = []): Omit<GraphicStyle, 'id'> => ({ name, ap: { items, effects }, opacity: 1, blend: 'normal' });
const ink = '#1b1b1f';
const round = { join: 'round', cap: 'round' } as const;

export const STYLE_LIBRARIES: StyleLibrary[] = [
  { id: 'shadows', name: 'Shadows and Glows', styles: [
    style('Soft Shadow', [fill(solid(WHITE)), stroke(solid(c('#d9dce3')), 0.75)], [fx('stylize.drop_shadow', { mode: 'multiply', opacity: 30, x: 0, y: 6, blur: 9, color: '#0b1020' })]),
    style('Lifted Card', [fill(solid(WHITE))], [fx('stylize.drop_shadow', { mode: 'multiply', opacity: 22, x: 0, y: 1, blur: 1.5, color: '#0b1020' }), fx('stylize.drop_shadow', { mode: 'multiply', opacity: 16, x: 0, y: 10, blur: 16, color: '#0b1020' })]),
    style('Hard Shadow', [fill(solid(c('#ffd23f'))), stroke(solid(c(ink)), 2, { join: 'round' })], [fx('stylize.drop_shadow', { mode: 'normal', opacity: 100, x: 6, y: 6, blur: 0, color: ink })]),
    style('Long Shadow', [on(fill(solid(c('#2a2140'))), fx('distort.transform', { move_h: 1.2, move_v: 1.2, copies: 40 })), fill(solid(c('#ff7a59')))]),
    style('Warm Glow', [fill(solid(c('#ffb000')))], [fx('stylize.outer_glow', { mode: 'screen', opacity: 85, blur: 12, color: '#ffd166' })]),
    style('Inner Light', [fill(solid(c('#2f6bff')))], [fx('stylize.inner_glow', { mode: 'screen', opacity: 80, blur: 9, color: '#bcd3ff' })]),
    style('Neon', [on(stroke(solid(c('#19e3ff')), 5, round), fx('blur.gaussian', { radius: 4 })), stroke(solid(c('#19e3ff')), 2.5, round), stroke(solid(c('#e9fdff')), 0.8, round)]),
    style('Feathered', [fill(solid(c('#7b5cff')))], [fx('stylize.feather', { radius: 8 })]),
  ] },
  { id: 'buttons', name: 'Buttons', styles: [
    style('Primary', [fill(lin('#2f5bea', '#4f8cff'))], [fx('stylize.round_corners', { radius: 12 }), fx('stylize.drop_shadow', { mode: 'multiply', opacity: 28, x: 0, y: 3, blur: 5, color: '#1a2f8a' })]),
    style('Secondary', [fill(solid(WHITE)), stroke(solid(c('#2f5bea')), 1.5)], [fx('stylize.round_corners', { radius: 12 })]),
    style('Glossy', [fill(lin('#0d7a5f', '#2ccf9d')), on(fill(gloss), fx('path.offset', { offset: -3, joins: 'round' }))], [fx('stylize.round_corners', { radius: 14 }), fx('stylize.drop_shadow', { mode: 'multiply', opacity: 25, x: 0, y: 2, blur: 4, color: '#06392c' })]),
    style('Danger', [fill(lin('#c62f3b', '#ef5a64'))], [fx('stylize.round_corners', { radius: 12 }), fx('stylize.inner_glow', { mode: 'screen', opacity: 35, blur: 4, color: '#ffd6d9' })]),
    style('Ghost', [fill(NONE), stroke(solid(c('#8a909c')), 1.25)], [fx('stylize.round_corners', { radius: 12 })]),
    style('Pressed', [fill(solid(c('#e6e9f0'))), stroke(solid(c('#c5cad6')), 1)], [fx('stylize.round_corners', { radius: 12 }), fx('stylize.inner_glow', { mode: 'multiply', opacity: 30, blur: 5, color: '#5b6272' })]),
  ] },
  { id: 'outlines', name: 'Outlines', styles: [
    style('Sticker', [stroke(solid(c(ink)), 12, round), stroke(solid(WHITE), 8, round), fill(solid(c('#ff5d73')))]),
    style('Offset Outline', [fill(solid(c('#ff6b6b'))), on(stroke(solid(c(ink)), 1.5, round), fx('path.offset', { offset: 5, joins: 'round' }))]),
    style('Inline', [fill(solid(c('#1f6feb'))), on(stroke(solid(WHITE), 1.5, round), fx('path.offset', { offset: -4, joins: 'round' }))]),
    style('Stitched', [fill(solid(c('#2e7d6b'))), on(stroke(solid(c('#f4f1e8')), 1.25, { cap: 'round', dash: [4, 3] }), fx('path.offset', { offset: -5, joins: 'round' }))]),
    style('Rough Ink', [fill(solid(c('#f3e6c8'))), on(stroke(solid(c('#2b2118')), 1.6, round), fx('distort.roughen', { size: 1.2, relative: false, detail: 18, smooth: true, seed: 3 })), on(stroke(solid(c('#2b2118')), 0.8, round), fx('distort.roughen', { size: 1.5, relative: false, detail: 22, smooth: true, seed: 11 }))]),
    style('Zig Zag Edge', [fill(solid(c('#ffcf33'))), on(stroke(solid(c('#e0507a')), 2, round), fx('distort.zig_zag', { size: 3, ridges: 6, smooth: false }))]),
  ] },
  { id: 'textures', name: 'Textures', styles: [
    style('Grain', [on(fill(solid(c('#d08a4c'))), fx('gallery.grain', { intensity: 35, contrast: 40 })), stroke(solid(c('#6b3f1d')), 1)]),
    style('Watercolor', [on(fill(lin('#2f63c4', '#8fb8f0')), fx('gallery.watercolor'))]),
    style('Halftone', [on(fill(solid(c('#2a6f97'))), fx('gallery.color_halftone', { radius: 5 })), stroke(solid(c(ink)), 1.5)]),
    style('Mosaic', [on(fill(lin('#3a7bd5', '#00d2ff')), fx('gallery.mosaic_tiles', { size: 10 }))]),
    style('Stained Glass', [on(fill(lin('#fda085', '#f6d365')), fx('gallery.stained_glass', { cell: 14 })), stroke(solid(c(ink)), 2)]),
    style('Canvas', [on(fill(solid(c('#e8dcc4'))), fx('gallery.texturizer')), stroke(solid(c('#8c7a5b')), 1)]),
  ] },
  { id: 'scribbles', name: 'Scribbles', styles: [
    style('Scribble', [on(fill(solid(c('#ff6b6b'))), fx('stylize.scribble', { angle: 30, spacing: 4, width: 1.6, variation: 1 })), stroke(solid(c(ink)), 1.25, round)]),
    style('Crosshatch', [on(fill(solid(c('#3b82f6'))), fx('stylize.scribble', { angle: 45, spacing: 5, width: 0.9, variation: 0.5 })), on(fill(solid(c('#3b82f6'))), fx('stylize.scribble', { angle: -45, spacing: 5, width: 0.9, variation: 0.5, seed: 4 })), stroke(solid(c(ink)), 1, round)]),
    style('Marker', [on(fill(solid(c('#ffd23f'))), fx('stylize.scribble', { angle: 0, spacing: 9, width: 7, variation: 2 }))]),
    style('Pencil Sketch', [fill(solid(c('#f5f1e8'))), on(stroke(solid(c('#3a3a3a')), 0.8, round), fx('distort.roughen', { size: 1, relative: false, detail: 25, smooth: true, seed: 2 })), on(stroke(solid(c('#3a3a3a')), 0.6, round), fx('distort.roughen', { size: 1.4, relative: false, detail: 20, smooth: true, seed: 9 }))]),
  ] },
];

export const styleLibrary = (key: string): StyleLibrary | undefined => {
  const k = key.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  return STYLE_LIBRARIES.find((l) => l.id === k || l.name.toLowerCase() === k);
};
