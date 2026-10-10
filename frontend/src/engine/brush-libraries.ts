import { anchor, ellipsePath, rectPath, starPath } from './geometry';
import { BLACK, parseColor, solid } from './paint';
import type { BrushDef, BristleShape, Color, PathData, VNode } from './types';

export interface BrushLibrary { id: string; name: string; brushes: Array<Omit<BrushDef, 'id'>>; user?: boolean }

let seq = 0;
const nid = (): string => `blib${++seq}`;
const c = (h: string): Color => parseColor(h) ?? BLACK;
const shape = (d: PathData, color: Color = BLACK): VNode => ({ id: nid(), kind: 'path', d, rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [{ kind: 'fill', paint: solid(color), opacity: 1, blend: 'normal', visible: true, effects: [] }], effects: [] } });
const art = (...kids: VNode[]): VNode => ({ id: nid(), kind: 'group', clip: false, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, children: kids });
const poly = (...pts: Array<[number, number]>): PathData => [{ closed: true, pts: pts.map(([x, y]) => anchor(x, y)) }];
const lens = (x: number, y: number, w: number, h: number): PathData => [{ closed: true, pts: [anchor(x, y + h / 2, x, y + h / 2, x + w * 0.3, y), anchor(x + w, y + h / 2, x + w * 0.7, y, x + w * 0.7, y + h), anchor(x, y + h / 2, x + w * 0.3, y + h, x, y + h / 2)] }];
const heart = (s: number): PathData => [{ closed: true, pts: [anchor(s / 2, s * 0.3, s * 0.2, -s * 0.1, s * 0.8, -s * 0.1), anchor(s / 2, s, s * 1.1, s * 0.45, s / 2, s), anchor(s / 2, s, s / 2, s, -s * 0.1, s * 0.45)] }];

const bristle = (name: string, shape: BristleShape, size: number, length = 100, density = 50, thickness = 50, opacity = 75, stiffness = 50): Omit<BrushDef, 'id'> => ({ name, brush: { type: 'bristle', shape, size, length, density, thickness, opacity, stiffness }, colorize: 'none' });

export const BRUSH_LIBRARIES: BrushLibrary[] = [
  { id: 'arrows', name: 'Arrows', brushes: [
    { name: 'Arrow Simple', colorize: 'tints', brush: { type: 'art', art: art(shape(rectPath(0, 4, 82, 2)), shape(poly([80, 0], [100, 5], [80, 10]))), stretch: true, flip: false, width: 100, guides: [0.02, 0.78] } },
    { name: 'Arrow Feathered', colorize: 'tints', brush: { type: 'art', art: art(shape(rectPath(10, 4.25, 72, 1.5)), shape(poly([0, 0], [6, 0], [14, 4.25], [8, 4.25])), shape(poly([0, 10], [6, 10], [14, 5.75], [8, 5.75])), shape(poly([80, 0.5], [100, 5], [80, 9.5], [84, 5]))), stretch: true, flip: false, width: 100, guides: [0.15, 0.79] } },
    { name: 'Arrow Tapered', colorize: 'tints', brush: { type: 'art', art: art(shape(poly([0, 5], [78, 3.5], [78, 6.5])), shape(poly([76, 0], [100, 5], [76, 10]))), stretch: true, flip: false, width: 100, guides: [0, 0.76] } },
    { name: 'Arrow Double', colorize: 'tints', brush: { type: 'art', art: art(shape(rectPath(16, 4, 68, 2)), shape(poly([20, 0], [0, 5], [20, 10])), shape(poly([80, 0], [100, 5], [80, 10]))), stretch: true, flip: false, width: 100, guides: [0.2, 0.8] } },
    { name: 'Arrow Dashes', colorize: 'tints', brush: { type: 'pattern', art: art(shape(rectPath(0, 4, 8, 2))), spacing: 60, fit: 'stretch', start: art(shape(ellipsePath(0, 1, 8, 8))), end: art(shape(poly([0, 0], [14, 5], [0, 10]))) } },
  ] },
  { id: 'borders', name: 'Borders', brushes: [
    { name: 'Dotted Frame', colorize: 'tints', brush: { type: 'pattern', art: art(shape(ellipsePath(1, 1, 6, 6))), spacing: 20, fit: 'stretch', outer: art(shape(ellipsePath(0, 0, 8, 8))), inner: art(shape(rectPath(1, 1, 6, 6))) } },
    { name: 'Rope', colorize: 'tints', brush: { type: 'pattern', art: art(shape(poly([0, 10], [3, 10], [12, 0], [9, 0])), shape(poly([5, 10], [8, 10], [17, 0], [14, 0]))), spacing: 0, fit: 'stretch', outer: art(shape(ellipsePath(0, 0, 10, 10))), inner: art(shape(ellipsePath(1, 1, 8, 8))) } },
    { name: 'Zigzag', colorize: 'tints', brush: { type: 'pattern', art: art(shape(poly([0, 8], [5, 0], [10, 8], [8.5, 8], [5, 2.5], [1.5, 8]))), spacing: 0, fit: 'stretch', outer: art(shape(rectPath(0, 0, 8, 8))), inner: art(shape(rectPath(0, 0, 8, 8))) } },
    { name: 'Scallop', colorize: 'tints', brush: { type: 'pattern', art: art(shape([{ closed: true, pts: [anchor(0, 8, 0, 8, 0, 2), anchor(10, 8, 10, 2, 10, 8)] }])), spacing: 0, fit: 'approximate', outer: art(shape(ellipsePath(0, 0, 10, 10))) } },
    { name: 'Double Line', colorize: 'tints', brush: { type: 'pattern', art: art(shape(rectPath(0, 0, 10, 1.5)), shape(rectPath(0, 4.5, 10, 1.5))), spacing: 0, fit: 'stretch', outer: art(shape(rectPath(0, 0, 6, 1.5)), shape(rectPath(0, 4.5, 6, 1.5)), shape(rectPath(0, 0, 1.5, 6)), shape(rectPath(4.5, 0, 1.5, 6))), inner: art(shape(rectPath(0, 0, 6, 6))) } },
  ] },
  { id: 'decorative_scatter', name: 'Decorative Scatter', brushes: [
    { name: 'Hearts', colorize: 'tints', brush: { type: 'scatter', art: art(shape(heart(10), c('#e8261d'))), size: 80, spacing: 150, scatter: 40, rotation: 0, relative: true } },
    { name: 'Confetti Stars', colorize: 'hue_shift', brush: { type: 'scatter', art: art(shape(starPath(5, 5, 5, 2.2, 5), c('#ffc21a'))), size: 70, spacing: 120, scatter: 120, rotation: 20, relative: false } },
    { name: 'Random Dots', colorize: 'tints', brush: { type: 'scatter', art: art(shape(ellipsePath(0, 0, 6, 6))), size: 60, spacing: 90, scatter: 160, rotation: 0, relative: false } },
    { name: 'Leaves', colorize: 'tints_shades', brush: { type: 'scatter', art: art(shape(lens(0, 0, 18, 7), c('#2e8b57'))), size: 90, spacing: 110, scatter: 60, rotation: 35, relative: true } },
    { name: 'Asterisks', colorize: 'tints', brush: { type: 'scatter', art: art(shape(rectPath(4, 0, 2, 10)), shape(poly([0.7, 2.2], [1.7, 0.5], [9.3, 7.8], [8.3, 9.5])), shape(poly([8.3, 0.5], [9.3, 2.2], [1.7, 9.5], [0.7, 7.8]))), size: 70, spacing: 140, scatter: 30, rotation: 0, relative: false } },
  ] },
  { id: 'artistic_ink', name: 'Artistic Ink', brushes: [
    { name: 'Brush Taper', colorize: 'tints', brush: { type: 'art', art: art(shape(lens(0, 0, 100, 8))), stretch: true, flip: false, width: 100 } },
    { name: 'Dry Ink', colorize: 'tints', brush: { type: 'art', art: art(shape(lens(0, 0, 100, 2.4)), shape(lens(4, 2.5, 88, 1.6)), shape(lens(10, 4.6, 70, 1.4)), shape(lens(2, 6.4, 94, 2)), shape(lens(20, 8.6, 60, 1.2))), stretch: true, flip: false, width: 100 } },
    { name: 'Splash Ink', colorize: 'tints', brush: { type: 'art', art: art(shape(lens(0, 2, 100, 6)), shape(ellipsePath(14, 0, 3, 3)), shape(ellipsePath(46, 8.5, 2.5, 2.5)), shape(ellipsePath(72, -0.5, 2, 2)), shape(ellipsePath(88, 8, 3, 3))), stretch: true, flip: false, width: 100 } },
    { name: 'Calligraphy Oval', colorize: 'none', brush: { type: 'calligraphic', angle: 45, roundness: 40, size: 12 } },
    { name: 'Chisel', colorize: 'none', brush: { type: 'calligraphic', angle: -30, roundness: 8, size: 9 } },
  ] },
  { id: 'bristle', name: 'Bristle Brushes', brushes: [
    bristle('Round Point Soft', 'round_point', 8, 120, 45, 35, 60, 25),
    bristle('Flat Point', 'flat_point', 9, 100, 60, 45, 75, 50),
    bristle('Round Blunt', 'round_blunt', 7, 90, 55, 50, 80, 60),
    bristle('Flat Blunt Dry', 'flat_blunt', 10, 80, 30, 40, 85, 80),
    bristle('Round Curve', 'round_curve', 8, 110, 60, 50, 70, 45),
    bristle('Flat Curve', 'flat_curve', 10, 110, 55, 45, 70, 50),
    bristle('Round Angle', 'round_angle', 8, 130, 50, 40, 65, 40),
    bristle('Flat Angle', 'flat_angle', 10, 130, 55, 45, 70, 55),
    bristle('Fan Wash', 'fan', 14, 150, 40, 30, 45, 20),
  ] },
];

export function brushLibrary(key: string, extra: BrushLibrary[] = []): BrushLibrary | undefined {
  const k = key.trim().toLowerCase();
  return [...BRUSH_LIBRARIES, ...extra].find((l) => l.id.toLowerCase() === k || l.name.toLowerCase() === k);
}
