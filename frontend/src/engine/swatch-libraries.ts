import { anchor, ellipsePath, rectPath } from './geometry';
import { BLACK, cmyk, gray, linearGradient, parseColor, radialGradient, solid, stop, tinted } from './paint';
import type { Color, Doc, Gradient, Paint, PathData, PatternDef, Rect, VNode } from './types';

export interface LibPattern { tile: Rect; art: VNode; type: PatternDef['type']; hs: number; vs: number }
export interface LibSwatch { name: string; paint: Paint; spot?: boolean; global?: boolean; pattern?: LibPattern }
export interface LibGroup { name: string; swatches: LibSwatch[] }
export interface SwatchLibrary { id: string; name: string; folder?: string; groups: LibGroup[]; user?: boolean }

const c = (h: string): Color => parseColor(h) ?? BLACK;
const set = (list: Array<[string, string]>): LibSwatch[] => list.map(([name, h]) => ({ name, paint: solid(c(h)) }));
const grad = (name: string, g: Gradient): LibSwatch => ({ name, paint: { type: 'gradient', gradient: g } });
const lin = (angle: number, ...stops: Array<[number, string, number?]>): Gradient => linearGradient(stops.map(([o, h, a]) => stop(o, c(h), a ?? 1)), angle);
const rad = (...stops: Array<[number, string, number?]>): Gradient => radialGradient(stops.map(([o, h, a]) => stop(o, c(h), a ?? 1)));

let seq = 0;
const nid = (): string => `lib${++seq}`;
const shape = (d: PathData, color: Color = BLACK): VNode => ({ id: nid(), kind: 'path', d, rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [{ kind: 'fill', paint: solid(color), opacity: 1, blend: 'normal', visible: true, effects: [] }], effects: [] } });
const art = (...kids: VNode[]): VNode => ({ id: nid(), kind: 'group', clip: false, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, children: kids });
const poly = (...pts: Array<[number, number]>): PathData => [{ closed: true, pts: pts.map(([x, y]) => anchor(x, y)) }];
const pat = (name: string, w: number, h: number, kids: VNode[], type: PatternDef['type'] = 'grid'): LibSwatch => ({ name, paint: { type: 'pattern', pattern: '', xf: [1, 0, 0, 1, 0, 0] }, pattern: { tile: { x: 0, y: 0, w, h }, art: art(...kids), type, hs: 0, vs: 0 } });
const wave = (w: number, h: number, t: number): PathData => [{ closed: true, pts: [
  anchor(0, h / 2, 0, h / 2, w / 4, h / 2 - h / 3), anchor(w, h / 2, w * 3 / 4, h / 2 + h / 3, w, h / 2),
  anchor(w, h / 2 + t, w, h / 2 + t, w * 3 / 4, h / 2 + h / 3 + t), anchor(0, h / 2 + t, w / 4, h / 2 - h / 3 + t, 0, h / 2 + t),
] }];

function webSafe(): LibSwatch[] {
  const out: LibSwatch[] = [], v = ['00', '33', '66', '99', 'CC', 'FF'];
  for (const r of v) for (const g of v) for (const b of v) out.push({ name: `#${r}${g}${b}`, paint: solid(c(`#${r}${g}${b}`)) });
  return out;
}

function grays(): LibSwatch[] {
  const out: LibSwatch[] = [];
  for (let k = 0; k <= 100; k += 5) out.push({ name: `Gray ${k}%`, paint: solid(gray(k)) });
  return out;
}

export const SWATCH_LIBRARIES: SwatchLibrary[] = [
  { id: 'brights', name: 'Brights', folder: 'Color Themes', groups: [{ name: 'Brights', swatches: set([['Signal Red', '#ff2d2d'], ['Tangerine', '#ff7a00'], ['Sunbeam', '#ffd400'], ['Lime Pop', '#9be22d'], ['Kelly', '#00b84a'], ['Aqua Jet', '#00c2d1'], ['Electric Blue', '#1f6bff'], ['Ultra Violet', '#7a2cff'], ['Hot Magenta', '#ff1fa8'], ['Coral Flash', '#ff5a6e']]) }] },
  { id: 'pastels', name: 'Pastels', folder: 'Color Themes', groups: [{ name: 'Pastels', swatches: set([['Blush', '#f8c8d0'], ['Peach Cream', '#ffd8b8'], ['Butter', '#fff1b0'], ['Mint', '#c8f0d4'], ['Pistachio', '#d8ebb4'], ['Powder Blue', '#c4dcf4'], ['Periwinkle', '#c8c8f4'], ['Lilac', '#e0c8f0'], ['Shell', '#f4e4dc'], ['Mist', '#dfe7ea']]) }] },
  { id: 'retro', name: 'Retro', folder: 'Color Themes', groups: [
    { name: 'Diner', swatches: set([['Cherry', '#c8102e'], ['Seafoam', '#7fd1b9'], ['Cream Soda', '#f3e3c3'], ['Chrome', '#b9c0c6'], ['Jukebox Teal', '#00878f']]) },
    { name: 'Seventies', swatches: set([['Harvest Gold', '#e0a526'], ['Avocado', '#7a8a2e'], ['Burnt Orange', '#c85a17'], ['Rust Brown', '#7a3b1e'], ['Mustard', '#d4a72c']]) },
  ] },
  { id: 'skin_tones', name: 'Skin Tones', folder: 'Skin Tones', groups: [{ name: 'Skin Tones', swatches: set([
    ['Porcelain', '#f6e1d3'], ['Ivory', '#f3d5c0'], ['Shell Pink', '#eec4ae'], ['Light Beige', '#e8bd9c'], ['Warm Beige', '#deaa86'], ['Sand', '#d39a73'], ['Honey', '#c88b5f'], ['Golden', '#bb7b4c'],
    ['Caramel', '#a96a3e'], ['Amber', '#9a5d36'], ['Bronze', '#8a512f'], ['Chestnut', '#774428'], ['Mocha', '#643922'], ['Cocoa', '#52301e'], ['Espresso', '#422719'], ['Ebony', '#331f15'],
  ]) }] },
  { id: 'earth_tones', name: 'Earth Tones', folder: 'Earth Tones', groups: [
    { name: 'Clay', swatches: set([['Terracotta', '#b5562f'], ['Adobe', '#c7764b'], ['Red Earth', '#8f3b22'], ['Ochre', '#c28a2c'], ['Sienna', '#a0522d']]) },
    { name: 'Stone', swatches: set([['Slate', '#5d6670'], ['Granite', '#7c7a76'], ['Limestone', '#cfc6b4'], ['Basalt', '#3b3a38'], ['Sandstone', '#d2b48c']]) },
    { name: 'Moss', swatches: set([['Moss', '#6b7a3a'], ['Fern', '#4f6d3a'], ['Lichen', '#a3ad7a'], ['Bark', '#5a4532'], ['Peat', '#3e3326']]) },
  ] },
  { id: 'metals', name: 'Metals', folder: 'Metals', groups: [
    { name: 'Metal Colors', swatches: set([['Gold', '#c9a227'], ['Silver', '#b8bcc2'], ['Copper', '#b8733d'], ['Bronze', '#9c6b30'], ['Brass', '#b5a642'], ['Steel', '#7d8590'], ['Pewter', '#8e9294'], ['Rose Gold', '#c98f7d']]) },
    { name: 'Metal Gradients', swatches: [
      grad('Gold Bar', lin(90, [0, '#7a5a12'], [0.35, '#f2d675'], [0.5, '#fff3c4'], [0.65, '#d4a82e'], [1, '#6e4f0e'])),
      grad('Polished Silver', lin(90, [0, '#5e6268'], [0.4, '#e9ecef'], [0.5, '#ffffff'], [0.6, '#c3c8cd'], [1, '#4d5156'])),
      grad('Copper Sheet', lin(90, [0, '#5c2c12'], [0.45, '#e39b68'], [0.55, '#f6c49b'], [1, '#6a3417'])),
      grad('Brushed Steel', lin(0, [0, '#8a9097'], [0.25, '#c8cdd2'], [0.5, '#9aa0a6'], [0.75, '#d4d8dc'], [1, '#868c93'])),
      grad('Chrome Ball', rad([0, '#ffffff'], [0.35, '#d8dde2'], [0.8, '#59606a'], [1, '#22262b'])),
    ] },
  ] },
  { id: 'web', name: 'Web', folder: 'Web', groups: [{ name: 'Web Safe', swatches: webSafe() }] },
  { id: 'grayscale', name: 'Grayscale', folder: 'Grayscale', groups: [{ name: 'Grayscale', swatches: grays() }] },
  { id: 'spectrums', name: 'Spectrums', folder: 'Gradients', groups: [{ name: 'Spectrums', swatches: [
    grad('Full Spectrum', lin(0, [0, '#ff0000'], [0.17, '#ffff00'], [0.33, '#00ff00'], [0.5, '#00ffff'], [0.67, '#0000ff'], [0.83, '#ff00ff'], [1, '#ff0000'])),
    grad('Warm Spectrum', lin(0, [0, '#ffd400'], [0.5, '#ff7a00'], [1, '#d4002a'])),
    grad('Cool Spectrum', lin(0, [0, '#00e0c0'], [0.5, '#1f6bff'], [1, '#6a1fd1'])),
    grad('Rainbow Radial', rad([0, '#ffffff'], [0.2, '#ffd400'], [0.45, '#ff5a00'], [0.7, '#c4007a'], [1, '#2a0a6e'])),
    grad('Infrared', lin(0, [0, '#000000'], [0.4, '#6e0000'], [0.7, '#ff4000'], [1, '#ffff80'])),
  ] }] },
  { id: 'sky_water', name: 'Sky and Water', folder: 'Gradients', groups: [{ name: 'Sky and Water', swatches: [
    grad('Dawn', lin(90, [0, '#ffb07a'], [0.5, '#f6a3b7'], [1, '#6b7fd6'])),
    grad('Noon', lin(90, [0, '#d8f0ff'], [1, '#2f8cff'])),
    grad('Dusk', lin(90, [0, '#ff7e3f'], [0.45, '#b23a7a'], [1, '#1d1b4f'])),
    grad('Night', lin(90, [0, '#1b2a5c'], [1, '#05070f'])),
    grad('Shallows', lin(90, [0, '#e6fff6'], [0.5, '#5fe0d1'], [1, '#0d8fa8'])),
    grad('Deep Sea', rad([0, '#1aa7c9'], [1, '#021e3a'])),
  ] }] },
  { id: 'fades', name: 'Fades', folder: 'Gradients', groups: [{ name: 'Fades', swatches: [
    grad('Black Fade', lin(0, [0, '#000000'], [1, '#000000', 0])),
    grad('White Fade', lin(0, [0, '#ffffff'], [1, '#ffffff', 0])),
    grad('Black Vignette', rad([0, '#000000', 0], [0.6, '#000000', 0], [1, '#000000', 0.85])),
    grad('Glow', rad([0, '#ffffff', 0.9], [1, '#ffffff', 0])),
    grad('Sun Fade', lin(90, [0, '#ffb000'], [1, '#ffb000', 0])),
  ] }] },
  { id: 'lines', name: 'Basic Lines', folder: 'Patterns', groups: [{ name: 'Basic Lines', swatches: [
    pat('Lines Fine', 10, 10, [shape(rectPath(0, 0, 10, 1))]),
    pat('Lines Bold', 10, 10, [shape(rectPath(0, 0, 10, 4))]),
    pat('Lines Vertical', 10, 10, [shape(rectPath(0, 0, 2, 10))]),
    pat('Diagonal', 10, 10, [shape(poly([0, 0], [1.5, 0], [10, 8.5], [10, 10], [8.5, 10], [0, 1.5])), shape(poly([8.5, 0], [10, 0], [10, 1.5])), shape(poly([0, 8.5], [1.5, 10], [0, 10]))]),
    pat('Crosshatch', 10, 10, [shape(rectPath(0, 0, 10, 1)), shape(rectPath(0, 0, 1, 10))]),
    pat('Wave', 24, 12, [shape(wave(24, 12, 2))]),
  ] }] },
  { id: 'dots', name: 'Dots and Grids', folder: 'Patterns', groups: [{ name: 'Dots and Grids', swatches: [
    pat('Polka Small', 10, 10, [shape(ellipsePath(3, 3, 4, 4))]),
    pat('Polka Large', 20, 20, [shape(ellipsePath(2, 2, 16, 16))]),
    pat('Hex Dots', 10, 10, [shape(ellipsePath(2.5, 2.5, 5, 5))], 'hex_col'),
    pat('Checker', 10, 10, [shape(rectPath(0, 0, 5, 5)), shape(rectPath(5, 5, 5, 5))]),
    pat('Grid Paper', 12, 12, [shape(rectPath(0, 0, 12, 0.5), c('#4f8cff')), shape(rectPath(0, 0, 0.5, 12), c('#4f8cff'))]),
    pat('Brick', 20, 10, [shape(rectPath(0.5, 0.5, 19, 9), c('#a0522d'))], 'brick_row'),
  ] }] },
  { id: 'seasons', name: 'Seasons', folder: 'Nature', groups: [
    { name: 'Spring', swatches: set([['Blossom', '#f7b6c8'], ['New Leaf', '#9ad06b'], ['Daffodil', '#ffe066'], ['Lilac Bloom', '#c3a6e0'], ['Rain Sky', '#a9c8e8']]) },
    { name: 'Summer', swatches: set([['Sun', '#ffc21a'], ['Sea', '#0096c7'], ['Watermelon', '#f25c78'], ['Palm', '#2e8b57'], ['Sand Dune', '#f1d6a0']]) },
    { name: 'Autumn', swatches: set([['Maple', '#c0392b'], ['Pumpkin', '#e67e22'], ['Acorn', '#8e5b2d'], ['Wheat', '#d9b56c'], ['Plum', '#6c3461']]) },
    { name: 'Winter', swatches: set([['Snow', '#f4f8fb'], ['Ice', '#bfe3f2'], ['Pine', '#1f4d3a'], ['Frost Gray', '#9aa7b0'], ['Midnight', '#14213d']]) },
  ] },
  { id: 'spot_inks', name: 'Spot Inks', folder: 'Color Books', groups: [{ name: 'Spot Inks', swatches: ([
    ['Spot Warm Red', cmyk(0, 85, 80, 0)], ['Spot Orange', cmyk(0, 60, 100, 0)], ['Spot Yellow', cmyk(0, 5, 100, 0)], ['Spot Green', cmyk(85, 0, 90, 0)], ['Spot Process Blue', cmyk(100, 15, 0, 0)],
    ['Spot Reflex Blue', cmyk(100, 85, 0, 5)], ['Spot Violet', cmyk(70, 95, 0, 0)], ['Spot Rubine', cmyk(5, 100, 35, 5)], ['Spot Black', cmyk(0, 0, 0, 100)], ['Spot Metallic Gold', cmyk(20, 30, 80, 15)],
  ] as Array<[string, Color]>).map(([name, col]) => ({ name, paint: solid(col), spot: true, global: true })) }] },
];

export function swatchLibrary(key: string, extra: SwatchLibrary[] = []): SwatchLibrary | undefined {
  const k = key.trim().toLowerCase();
  return [...SWATCH_LIBRARIES, ...extra].find((l) => l.id.toLowerCase() === k || l.name.toLowerCase() === k);
}

export function libraryFromDoc(doc: Doc, name: string, id = `user_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`): SwatchLibrary {
  const groups: LibGroup[] = [];
  const at = (g: string): LibGroup => { let x = groups.find((y) => y.name === g); if (!x) { x = { name: g, swatches: [] }; groups.push(x); } return x; };
  for (const s of doc.swatches) {
    if (s.name.startsWith('[')) continue;
    const def = s.paint.type === 'pattern' ? doc.patterns.find((p) => p.id === (s.paint as { pattern: string }).pattern) : null;
    if (s.paint.type === 'pattern' && !def) continue;
    const paint: Paint = s.paint.type === 'color' && s.paint.swatch ? { type: 'color', color: (doc.swatches.find((x) => x.id === (s.paint as { swatch: string }).swatch)?.paint as { color?: Color } | undefined)?.color ?? s.paint.color, tint: s.paint.tint } : s.paint;
    at(s.group ?? '').swatches.push({ name: s.name, paint: paint.type === 'color' && paint.tint !== undefined ? { type: 'color', color: tinted(paint.color, paint.tint) } : paint, ...(s.spot ? { spot: true } : {}), ...(s.global ? { global: true } : {}), ...(def ? { pattern: { tile: def.tile, art: def.art, type: def.type, hs: def.hs, vs: def.vs } } : {}) });
  }
  return { id, name, groups: groups.filter((g) => g.swatches.length), user: true };
}

export function libraryColors(lib: SwatchLibrary, group?: string): Color[] {
  return lib.groups.filter((g) => group === undefined || g.name === group).flatMap((g) => g.swatches).flatMap((s) => (s.paint.type === 'color' ? [s.paint.color] : []));
}
