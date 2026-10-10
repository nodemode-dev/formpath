import { brushOutline } from './brushes';
import { FILTER_IDS, filterReach } from './filters';
import { anchor, apply, bezPoint, bezTangent, centerOf, dist, flattenSub, hasIn, hasOut, pathBounds, pathLength, pointAtLength, rectPath, ellipsePath, roundCorners, segments, transformPath, rotateAbout, scaleAbout, translate, mul } from './geometry';
import { offsetPath, strokeToPath } from './kernel';
import { mapPathNonlinear, warpPoint } from './live';
import { parseColor, cssColor, BLACK, effect, fill, gradientAt, resolvePaint, rgb, solid, stroke, toRgb } from './paint';
import { childrenOf } from './doc';
import { textBounds, textOutline, textEpoch } from './text';
import { lighting, outline3d, scene3dWith, VECTOR_3D, type RGB3, type Scene, type Solid } from './threed';
import { transformNode } from './transform';
import type { Anchor, BlendMode, BrushDef, Doc, Effect, GroupNode, Mat, Paint, PathData, PathNode, Pt, Rect, StrokeItem, VNode, WidthPoint } from './types';

export interface EffectParam { key: string; label: string; kind: 'number' | 'boolean' | 'select' | 'color' | 'text'; min?: number; max?: number; step?: number; unit?: string; choices?: string[]; def: number | boolean | string }
export interface EffectDef { id: string; label: string; menu: string; raster?: boolean; family?: 'photoshop'; params: EffectParam[] }

const num = (key: string, label: string, def: number, min: number, max: number, unit = '', step = 1): EffectParam => ({ key, label, kind: 'number', def, min, max, unit, step });
const bool = (key: string, label: string, def: boolean): EffectParam => ({ key, label, kind: 'boolean', def });
const sel = (key: string, label: string, def: string, choices: string[]): EffectParam => ({ key, label, kind: 'select', def, choices });
const col = (key: string, label: string, def: string): EffectParam => ({ key, label, kind: 'color', def });

export const WARP_STYLES = ['arc', 'arc_lower', 'arc_upper', 'arch', 'bulge', 'shell_lower', 'shell_upper', 'flag', 'wave', 'fish', 'rise', 'fisheye', 'inflate', 'squeeze', 'twist'];
const BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color_dodge', 'color_burn', 'hard_light', 'soft_light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
const title = (s: string): string => s.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

const TEXTURES = ['canvas', 'brick', 'burlap', 'sandstone'];
const LIGHTS = ['bottom', 'bottom_left', 'left', 'top_left', 'top', 'top_right', 'right', 'bottom_right'];
const DIRECTIONS = ['right_diagonal', 'horizontal', 'left_diagonal', 'vertical'];
const surface = (light: string, relief: number): EffectParam[] => [sel('texture', 'Texture', 'canvas', TEXTURES), num('scaling', 'Scaling', 100, 50, 200, '%'), num('relief', 'Relief', relief, 0, 50), sel('light', 'Light', light, LIGHTS)];
const tones = (fg = '#000000'): EffectParam[] => [col('foreground', 'Foreground', fg), col('background', 'Background', '#ffffff')];
const ps = (menu: string, id: string, label: string, params: EffectParam[]): EffectDef => ({ id, label, menu, raster: true, family: 'photoshop', params });

const MATERIALS = ['plastic', 'matte', 'metal', 'wireframe'];
const LIGHT_PRESETS = ['top_left', 'top', 'top_right', 'left', 'front', 'right', 'bottom_left', 'bottom', 'bottom_right'];
const turn = (rx: number, ry: number, rz: number): EffectParam[] => [num('rx', 'X Rotation', rx, -180, 180, 'deg'), num('ry', 'Y Rotation', ry, -180, 180, 'deg'), num('rz', 'Z Rotation', rz, -180, 180, 'deg'), num('perspective', 'Perspective', 0, 0, 160, 'deg')];
const light = (materials = MATERIALS, material = 'plastic'): EffectParam[] => [sel('material', 'Material', material, materials), sel('light', 'Light', 'top_left', LIGHT_PRESETS), num('intensity', 'Intensity', 100, 0, 200, '%'), num('ambient', 'Ambient Light', 40, 0, 100, '%'), num('highlight', 'Highlight', 60, 0, 100, '%'), col('shading_color', 'Shading Color', '#000000')];
const txt = (key: string, label: string, def: string): EffectParam => ({ key, label, kind: 'text', def });
const mapArt = (): EffectParam[] => [txt('map_symbol', 'Map Art Symbol', ''), num('map_scale', 'Map Art Scale', 100, 5, 400, '%'), num('map_x', 'Map Art X', 0, -2000, 2000, 'pt'), num('map_y', 'Map Art Y', 0, -2000, 2000, 'pt'), bool('shade_art', 'Shade Artwork', true)];
const shadows = (): EffectParam[] => [bool('shadow', 'Shadow', false), sel('shadow_position', 'Shadow Position', 'behind', ['behind', 'below']), num('shadow_distance', 'Shadow Distance', 20, 0, 500, 'pt'), num('shadow_softness', 'Shadow Softness', 8, 0, 100, 'pt'), num('shadow_opacity', 'Shadow Opacity', 40, 0, 100, '%')];
const THREE_D: EffectDef[] = [
  { id: '3d.extrude', label: 'Extrude & Bevel', menu: '3D and Materials', params: [...turn(-18, -26, 8), num('depth', 'Depth', 50, 0, 2000, 'pt'), bool('cap', 'Cap', true), sel('bevel', 'Bevel', 'none', ['none', 'classic', 'rounded']), num('bevel_height', 'Bevel Height', 4, 0, 100, 'pt'), ...light(), ...mapArt(), ...shadows()] },
  { id: '3d.revolve', label: 'Revolve', menu: '3D and Materials', params: [...turn(-18, -26, 8), num('angle', 'Revolve Angle', 360, 1, 360, 'deg'), num('offset', 'Offset', 0, 0, 1000, 'pt'), sel('from', 'From', 'left', ['left', 'right']), bool('cap', 'Cap', true), ...light(), ...shadows()] },
  { id: '3d.inflate', label: 'Inflate', menu: '3D and Materials', raster: true, params: [num('depth', 'Depth', 20, 1, 500, 'pt'), num('volume', 'Volume', 100, 10, 100, '%'), num('rx', 'X Rotation', 0, -180, 180, 'deg'), num('ry', 'Y Rotation', 0, -180, 180, 'deg'), num('rz', 'Z Rotation', 0, -180, 180, 'deg'), ...light(['plastic', 'matte', 'metal'])] },
  { id: '3d.rotate', label: 'Rotate', menu: '3D and Materials', params: [...turn(-18, -26, 8), ...light([...MATERIALS, 'flat'], 'flat'), ...mapArt(), ...shadows()] },
];

const GALLERY: EffectDef[] = [
  ps('Artistic', 'gallery.colored_pencil', 'Colored Pencil', [num('width', 'Pencil Width', 4, 1, 24), num('pressure', 'Stroke Pressure', 8, 0, 15), num('paper', 'Paper Brightness', 25, 0, 50)]),
  ps('Artistic', 'gallery.cutout', 'Cutout', [num('levels', 'Number of Levels', 4, 2, 8), num('simplicity', 'Edge Simplicity', 4, 0, 10), num('fidelity', 'Edge Fidelity', 2, 1, 3)]),
  ps('Artistic', 'gallery.dry_brush', 'Dry Brush', [num('size', 'Brush Size', 2, 0, 10), num('detail', 'Brush Detail', 8, 0, 10), num('texture', 'Texture', 1, 1, 3)]),
  ps('Artistic', 'gallery.film_grain', 'Film Grain', [num('grain', 'Grain', 4, 0, 20), num('highlight', 'Highlight Area', 0, 0, 20), num('intensity', 'Intensity', 10, 0, 10)]),
  ps('Artistic', 'gallery.fresco', 'Fresco', [num('size', 'Brush Size', 2, 0, 10), num('detail', 'Brush Detail', 8, 0, 10), num('texture', 'Texture', 1, 1, 3)]),
  ps('Artistic', 'gallery.neon_glow', 'Neon Glow', [num('size', 'Glow Size', 5, -24, 24), num('brightness', 'Glow Brightness', 15, 0, 50), col('color', 'Glow Color', '#2b8cff')]),
  ps('Artistic', 'gallery.paint_daubs', 'Paint Daubs', [num('size', 'Brush Size', 8, 1, 50), num('sharpness', 'Sharpness', 7, 0, 40), sel('type', 'Brush Type', 'simple', ['simple', 'light_rough', 'dark_rough', 'wide_sharp', 'wide_blurry', 'sparkle'])]),
  ps('Artistic', 'gallery.palette_knife', 'Palette Knife', [num('size', 'Stroke Size', 25, 1, 50), num('detail', 'Stroke Detail', 3, 1, 3), num('softness', 'Softness', 0, 0, 10)]),
  ps('Artistic', 'gallery.plastic_wrap', 'Plastic Wrap', [num('highlight', 'Highlight Strength', 15, 0, 20), num('detail', 'Detail', 9, 1, 15), num('smoothness', 'Smoothness', 7, 1, 15)]),
  ps('Artistic', 'gallery.poster_edges', 'Poster Edges', [num('thickness', 'Edge Thickness', 2, 0, 10), num('intensity', 'Edge Intensity', 1, 0, 10), num('posterization', 'Posterization', 2, 0, 6)]),
  ps('Artistic', 'gallery.rough_pastels', 'Rough Pastels', [num('stroke', 'Stroke Length', 6, 0, 40), num('detail', 'Stroke Detail', 4, 1, 20), ...surface('bottom', 20)]),
  ps('Artistic', 'gallery.smudge_stick', 'Smudge Stick', [num('stroke', 'Stroke Length', 2, 0, 10), num('highlight', 'Highlight Area', 0, 0, 20), num('intensity', 'Intensity', 10, 0, 10)]),
  ps('Artistic', 'gallery.sponge', 'Sponge', [num('size', 'Brush Size', 2, 0, 10), num('definition', 'Definition', 12, 0, 25), num('smoothness', 'Smoothness', 5, 1, 15)]),
  ps('Artistic', 'gallery.underpainting', 'Underpainting', [num('size', 'Brush Size', 6, 0, 40), num('coverage', 'Texture Coverage', 16, 0, 40), ...surface('top', 4)]),
  ps('Artistic', 'gallery.watercolor', 'Watercolor', [num('detail', 'Brush Detail', 9, 1, 14), num('shadow', 'Shadow Intensity', 1, 0, 10), num('texture', 'Texture', 1, 1, 3)]),
  ps('Blur', 'blur.radial', 'Radial Blur', [num('amount', 'Amount', 10, 1, 100), sel('method', 'Blur Method', 'spin', ['spin', 'zoom']), sel('quality', 'Quality', 'good', ['draft', 'good', 'best']), num('center_x', 'Center X', 0, -50, 50, '%'), num('center_y', 'Center Y', 0, -50, 50, '%')]),
  ps('Blur', 'blur.smart', 'Smart Blur', [num('radius', 'Radius', 3, 0.1, 100, 'pt', 0.1), num('threshold', 'Threshold', 25, 0.1, 100, '', 0.1), sel('mode', 'Mode', 'normal', ['normal', 'edge_only', 'overlay_edge'])]),
  ps('Brush Strokes', 'gallery.accented_edges', 'Accented Edges', [num('width', 'Edge Width', 2, 1, 14), num('brightness', 'Edge Brightness', 38, 0, 50), num('smoothness', 'Smoothness', 5, 1, 15)]),
  ps('Brush Strokes', 'gallery.angled_strokes', 'Angled Strokes', [num('balance', 'Direction Balance', 50, 0, 100), num('length', 'Stroke Length', 15, 3, 50), num('sharpness', 'Sharpness', 3, 0, 10)]),
  ps('Brush Strokes', 'gallery.crosshatch', 'Crosshatch', [num('length', 'Stroke Length', 9, 3, 50), num('sharpness', 'Sharpness', 6, 0, 20), num('strength', 'Strength', 1, 1, 3)]),
  ps('Brush Strokes', 'gallery.dark_strokes', 'Dark Strokes', [num('balance', 'Balance', 5, 0, 10), num('black', 'Black Intensity', 6, 0, 10), num('white', 'White Intensity', 2, 0, 10)]),
  ps('Brush Strokes', 'gallery.ink_outlines', 'Ink Outlines', [num('length', 'Stroke Length', 4, 1, 50), num('dark', 'Dark Intensity', 20, 0, 50), num('light', 'Light Intensity', 10, 0, 50)]),
  ps('Brush Strokes', 'gallery.spatter', 'Spatter', [num('radius', 'Spray Radius', 10, 0, 25, 'pt'), num('smoothness', 'Smoothness', 5, 1, 15)]),
  ps('Brush Strokes', 'gallery.sprayed_strokes', 'Sprayed Strokes', [num('length', 'Stroke Length', 12, 0, 20), num('radius', 'Spray Radius', 7, 0, 25, 'pt'), sel('direction', 'Stroke Direction', 'right_diagonal', DIRECTIONS)]),
  ps('Brush Strokes', 'gallery.sumi_e', 'Sumi-e', [num('width', 'Stroke Width', 10, 3, 15), num('pressure', 'Stroke Pressure', 2, 0, 15), num('contrast', 'Contrast', 16, 0, 40)]),
  ps('Distort', 'gallery.diffuse_glow', 'Diffuse Glow', [num('graininess', 'Graininess', 6, 0, 10), num('glow', 'Glow Amount', 10, 0, 20), num('clear', 'Clear Amount', 15, 0, 20), col('color', 'Glow Color', '#ffffff')]),
  ps('Distort', 'gallery.glass', 'Glass', [num('distortion', 'Distortion', 5, 0, 20), num('smoothness', 'Smoothness', 3, 1, 15), sel('texture', 'Texture', 'frosted', ['frosted', 'blocks', 'canvas', 'tiny_lens']), num('scaling', 'Scaling', 100, 50, 200, '%'), bool('invert', 'Invert', false)]),
  ps('Distort', 'gallery.ocean_ripple', 'Ocean Ripple', [num('size', 'Ripple Size', 9, 1, 15), num('magnitude', 'Ripple Magnitude', 9, 0, 20)]),
  ps('Pixelate', 'gallery.color_halftone', 'Color Halftone', [num('radius', 'Max Radius', 8, 4, 127, 'pt'), num('c', 'Channel 1 (C)', 108, -360, 360, 'deg'), num('m', 'Channel 2 (M)', 162, -360, 360, 'deg'), num('y', 'Channel 3 (Y)', 90, -360, 360, 'deg'), num('k', 'Channel 4 (K)', 45, -360, 360, 'deg')]),
  ps('Pixelate', 'gallery.crystallize', 'Crystallize', [num('cell', 'Cell Size', 10, 3, 300, 'pt')]),
  ps('Pixelate', 'gallery.mezzotint', 'Mezzotint', [sel('type', 'Type', 'medium_dots', ['fine_dots', 'medium_dots', 'grainy_dots', 'coarse_dots', 'short_lines', 'medium_lines', 'long_lines', 'short_strokes', 'medium_strokes', 'long_strokes'])]),
  ps('Pixelate', 'gallery.pointillize', 'Pointillize', [num('cell', 'Cell Size', 5, 3, 300, 'pt'), col('background', 'Background', '#ffffff')]),
  ps('Sketch', 'gallery.bas_relief', 'Bas Relief', [num('detail', 'Detail', 13, 1, 15), num('smoothness', 'Smoothness', 3, 1, 15), sel('light', 'Light', 'bottom', LIGHTS), ...tones()]),
  ps('Sketch', 'gallery.chalk_charcoal', 'Chalk & Charcoal', [num('charcoal', 'Charcoal Area', 6, 0, 20), num('chalk', 'Chalk Area', 6, 0, 20), num('pressure', 'Stroke Pressure', 1, 0, 5), ...tones()]),
  ps('Sketch', 'gallery.charcoal', 'Charcoal', [num('thickness', 'Charcoal Thickness', 1, 1, 7), num('detail', 'Detail', 5, 0, 5), num('balance', 'Light/Dark Balance', 50, 0, 100), ...tones()]),
  ps('Sketch', 'gallery.chrome', 'Chrome', [num('detail', 'Detail', 4, 0, 10), num('smoothness', 'Smoothness', 7, 0, 10)]),
  ps('Sketch', 'gallery.conte_crayon', 'Conté Crayon', [num('fg_level', 'Foreground Level', 11, 1, 15), num('bg_level', 'Background Level', 7, 1, 15), ...surface('top', 4), ...tones('#3b2417')]),
  ps('Sketch', 'gallery.graphic_pen', 'Graphic Pen', [num('length', 'Stroke Length', 15, 1, 15), num('balance', 'Light/Dark Balance', 50, 0, 100), sel('direction', 'Stroke Direction', 'right_diagonal', DIRECTIONS), ...tones()]),
  ps('Sketch', 'gallery.halftone_pattern', 'Halftone Pattern', [num('size', 'Size', 1, 1, 12), num('contrast', 'Contrast', 5, 0, 50), sel('type', 'Pattern Type', 'dot', ['circle', 'dot', 'line']), ...tones()]),
  ps('Sketch', 'gallery.note_paper', 'Note Paper', [num('balance', 'Image Balance', 25, 0, 50), num('graininess', 'Graininess', 10, 0, 20), num('relief', 'Relief', 11, 0, 25), ...tones()]),
  ps('Sketch', 'gallery.photocopy', 'Photocopy', [num('detail', 'Detail', 7, 1, 24), num('darkness', 'Darkness', 8, 1, 50), ...tones()]),
  ps('Sketch', 'gallery.plaster', 'Plaster', [num('balance', 'Image Balance', 20, 0, 50), num('smoothness', 'Smoothness', 2, 1, 15), sel('light', 'Light', 'top', LIGHTS), ...tones()]),
  ps('Sketch', 'gallery.reticulation', 'Reticulation', [num('density', 'Density', 12, 0, 50), num('fg_level', 'Foreground Level', 40, 0, 50), num('bg_level', 'Background Level', 5, 0, 50), ...tones()]),
  ps('Sketch', 'gallery.stamp', 'Stamp', [num('balance', 'Light/Dark Balance', 25, 0, 50), num('smoothness', 'Smoothness', 5, 1, 50), ...tones()]),
  ps('Sketch', 'gallery.torn_edges', 'Torn Edges', [num('balance', 'Image Balance', 25, 0, 50), num('smoothness', 'Smoothness', 11, 1, 15), num('contrast', 'Contrast', 17, 1, 25), ...tones()]),
  ps('Sketch', 'gallery.water_paper', 'Water Paper', [num('fiber', 'Fiber Length', 15, 3, 50), num('brightness', 'Brightness', 60, 0, 100), num('contrast', 'Contrast', 80, 0, 100)]),
  ps('Stylize', 'gallery.glowing_edges', 'Glowing Edges', [num('width', 'Edge Width', 2, 1, 14), num('brightness', 'Edge Brightness', 6, 0, 20), num('smoothness', 'Smoothness', 5, 1, 15)]),
  ps('Texture', 'gallery.craquelure', 'Craquelure', [num('spacing', 'Crack Spacing', 15, 2, 100, 'pt'), num('depth', 'Crack Depth', 6, 0, 10), num('brightness', 'Crack Brightness', 9, 0, 10)]),
  ps('Texture', 'gallery.grain', 'Grain', [num('intensity', 'Intensity', 40, 0, 100), num('contrast', 'Contrast', 50, 0, 100), sel('type', 'Grain Type', 'regular', ['regular', 'soft', 'sprinkles', 'clumped', 'contrasty', 'enlarged', 'stippled', 'horizontal', 'vertical', 'speckle'])]),
  ps('Texture', 'gallery.mosaic_tiles', 'Mosaic Tiles', [num('size', 'Tile Size', 12, 2, 100, 'pt'), num('grout', 'Grout Width', 3, 1, 15), num('lighten', 'Lighten Grout', 9, 0, 10)]),
  ps('Texture', 'gallery.patchwork', 'Patchwork', [num('size', 'Square Size', 4, 0, 10), num('relief', 'Relief', 8, 0, 25)]),
  ps('Texture', 'gallery.stained_glass', 'Stained Glass', [num('cell', 'Cell Size', 10, 2, 50, 'pt'), num('border', 'Border Thickness', 4, 1, 20), num('light', 'Light Intensity', 3, 0, 10), col('foreground', 'Border Color', '#000000')]),
  ps('Texture', 'gallery.texturizer', 'Texturizer', [...surface('top', 4), bool('invert', 'Invert', false)]),
  ps('Video', 'gallery.de_interlace', 'De-Interlace', [sel('eliminate', 'Eliminate', 'odd', ['odd', 'even']), sel('create', 'Create New Fields by', 'interpolation', ['duplication', 'interpolation'])]),
  ps('Video', 'gallery.ntsc_colors', 'NTSC Colors', []),
];

export const EFFECTS: EffectDef[] = [
  ...WARP_STYLES.map((s) => ({ id: `warp.${s}`, label: title(s), menu: 'Warp', params: [num('bend', 'Bend', 50, -100, 100, '%'), num('horizontal', 'Horizontal Distortion', 0, -100, 100, '%'), num('vertical', 'Vertical Distortion', 0, -100, 100, '%'), bool('vertical_orientation', 'Vertical', false)] })),
  { id: 'distort.free_distort', label: 'Free Distort', menu: 'Distort & Transform', params: [num('tlx', 'Top left x', 0, -500, 500, '%'), num('tly', 'Top left y', 0, -500, 500, '%'), num('trx', 'Top right x', 0, -500, 500, '%'), num('try', 'Top right y', 0, -500, 500, '%'), num('brx', 'Bottom right x', 0, -500, 500, '%'), num('bry', 'Bottom right y', 0, -500, 500, '%'), num('blx', 'Bottom left x', 0, -500, 500, '%'), num('bly', 'Bottom left y', 0, -500, 500, '%')] },
  { id: 'distort.pucker_bloat', label: 'Pucker & Bloat', menu: 'Distort & Transform', params: [num('amount', 'Amount', 30, -200, 200, '%')] },
  { id: 'distort.roughen', label: 'Roughen', menu: 'Distort & Transform', params: [num('size', 'Size', 5, 0, 100, '%'), bool('relative', 'Relative', true), num('detail', 'Detail', 10, 0, 100, '/in'), bool('smooth', 'Smooth', false), num('seed', 'Seed', 1, 0, 9999)] },
  { id: 'distort.transform', label: 'Transform', menu: 'Distort & Transform', params: [num('scale_h', 'Scale Horizontal', 100, -1000, 1000, '%'), num('scale_v', 'Scale Vertical', 100, -1000, 1000, '%'), num('move_h', 'Move Horizontal', 0, -10000, 10000, 'pt'), num('move_v', 'Move Vertical', 0, -10000, 10000, 'pt'), num('rotate', 'Angle', 0, -360, 360, 'deg'), num('copies', 'Copies', 0, 0, 1000), bool('reflect_x', 'Reflect X', false), bool('reflect_y', 'Reflect Y', false)] },
  { id: 'distort.tweak', label: 'Tweak', menu: 'Distort & Transform', params: [num('horizontal', 'Horizontal', 10, 0, 100, '%'), num('vertical', 'Vertical', 10, 0, 100, '%'), bool('anchors', 'Anchor Points', true), bool('handles', 'Control Points', true), num('seed', 'Seed', 1, 0, 9999)] },
  { id: 'distort.twist', label: 'Twist', menu: 'Distort & Transform', params: [num('angle', 'Angle', 45, -3600, 3600, 'deg')] },
  { id: 'distort.zig_zag', label: 'Zig Zag', menu: 'Distort & Transform', params: [num('size', 'Size', 10, 0, 1000, 'pt'), num('ridges', 'Ridges per segment', 4, 0, 100), bool('smooth', 'Smooth', false), bool('relative', 'Relative', false)] },
  { id: 'path.offset', label: 'Offset Path', menu: 'Path', params: [num('offset', 'Offset', 10, -1000, 1000, 'pt'), sel('joins', 'Joins', 'miter', ['miter', 'round', 'bevel']), num('miter', 'Miter limit', 4, 1, 500)] },
  { id: 'path.outline_stroke', label: 'Outline Stroke', menu: 'Path', params: [num('width', 'Width', 4, 0.01, 1000, 'pt')] },
  { id: 'stylize.round_corners', label: 'Round Corners', menu: 'Stylize', params: [num('radius', 'Radius', 10, 0, 1000, 'pt')] },
  { id: 'stylize.scribble', label: 'Scribble', menu: 'Stylize', params: [num('angle', 'Angle', 30, -180, 180, 'deg'), num('spacing', 'Spacing', 5, 0.1, 100, 'pt'), num('width', 'Stroke Width', 3, 0.1, 100, 'pt'), num('variation', 'Variation', 1, 0, 50, 'pt'), num('seed', 'Seed', 1, 0, 9999)] },
  { id: 'stylize.drop_shadow', label: 'Drop Shadow', menu: 'Stylize', raster: true, params: [sel('mode', 'Mode', 'multiply', BLENDS), num('opacity', 'Opacity', 75, 0, 100, '%'), num('x', 'X Offset', 7, -1000, 1000, 'pt'), num('y', 'Y Offset', 7, -1000, 1000, 'pt'), num('blur', 'Blur', 5, 0, 144, 'pt'), col('color', 'Color', '#000000')] },
  { id: 'stylize.inner_glow', label: 'Inner Glow', menu: 'Stylize', raster: true, params: [sel('mode', 'Mode', 'screen', BLENDS), num('opacity', 'Opacity', 75, 0, 100, '%'), num('blur', 'Blur', 5, 0, 144, 'pt'), col('color', 'Color', '#ffffff')] },
  { id: 'stylize.outer_glow', label: 'Outer Glow', menu: 'Stylize', raster: true, params: [sel('mode', 'Mode', 'screen', BLENDS), num('opacity', 'Opacity', 75, 0, 100, '%'), num('blur', 'Blur', 5, 0, 144, 'pt'), col('color', 'Color', '#ffd400')] },
  { id: 'stylize.feather', label: 'Feather', menu: 'Stylize', raster: true, params: [num('radius', 'Feather Radius', 5, 0, 1000, 'pt')] },
  ...THREE_D,
  { id: 'rasterize.raster', label: 'Rasterize', menu: 'Rasterize', raster: true, params: [num('resolution', 'Resolution', 72, 1, 2400, 'ppi'), sel('background', 'Background', 'transparent', ['transparent', 'white']), num('around', 'Add Around Object', 0, 0, 1000, 'pt')] },
  { id: 'blur.gaussian', label: 'Gaussian Blur', menu: 'Blur', raster: true, family: 'photoshop', params: [num('radius', 'Radius', 5, 0, 250, 'pt')] },
  ...GALLERY,
  { id: 'convert.rectangle', label: 'Rectangle', menu: 'Convert to Shape', params: [num('extra_w', 'Extra Width', 0, -1000, 1000, 'pt'), num('extra_h', 'Extra Height', 0, -1000, 1000, 'pt')] },
  { id: 'convert.rounded_rectangle', label: 'Rounded Rectangle', menu: 'Convert to Shape', params: [num('extra_w', 'Extra Width', 0, -1000, 1000, 'pt'), num('extra_h', 'Extra Height', 0, -1000, 1000, 'pt'), num('radius', 'Corner Radius', 9, 0, 1000, 'pt')] },
  { id: 'convert.ellipse', label: 'Ellipse', menu: 'Convert to Shape', params: [num('extra_w', 'Extra Width', 0, -1000, 1000, 'pt'), num('extra_h', 'Extra Height', 0, -1000, 1000, 'pt')] },
];
export const EFFECT_IDS = new Set(EFFECTS.map((e) => e.id));
export function effectDef(id: string): EffectDef | undefined { return EFFECTS.find((e) => e.id === id); }
export function effectDefaults(id: string): Effect['params'] { const d = effectDef(id); return Object.fromEntries((d?.params ?? []).map((p) => [p.key, p.def])); }

function rand(seed: number): () => number {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
const P = (e: Effect, k: string, d: number): number => { const v = e.params[k]; return typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && !Number.isNaN(+v) ? +v : d; };
const B = (e: Effect, k: string, d: boolean): boolean => { const v = e.params[k]; return typeof v === 'boolean' ? v : d; };
const PT_PER_IN = 72;

function quadMap(p0: Pt, p1: Pt, p2: Pt, p3: Pt): number[] | null {
  const ex = p0.x - p1.x + p2.x - p3.x, ey = p0.y - p1.y + p2.y - p3.y;
  if (Math.abs(ex) < 1e-9 && Math.abs(ey) < 1e-9) return [p1.x - p0.x, p3.x - p0.x, p0.x, p1.y - p0.y, p3.y - p0.y, p0.y, 0, 0];
  const ax = p1.x - p2.x, bx = p3.x - p2.x, ay = p1.y - p2.y, by = p3.y - p2.y, den = ax * by - bx * ay;
  if (Math.abs(den) < 1e-12) return null;
  const g = (ex * by - bx * ey) / den, h = (ax * ey - ex * ay) / den;
  return [p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x, p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y, g, h];
}

function normalAt(sp: Pt[], i: number, closed: boolean): Pt {
  const n = sp.length, a = sp[(i - 1 + n) % n], b = sp[(i + 1) % n];
  const p = closed || (i > 0 && i < n - 1) ? { x: b.x - a.x, y: b.y - a.y } : i === 0 ? { x: sp[1].x - sp[0].x, y: sp[1].y - sp[0].y } : { x: sp[n - 1].x - sp[n - 2].x, y: sp[n - 1].y - sp[n - 2].y };
  const l = Math.hypot(p.x, p.y) || 1;
  return { x: -p.y / l, y: p.x / l };
}

function polyToSmooth(pts: Pt[], closed: boolean, smooth: boolean): PathData {
  if (!smooth) return [{ closed, pts: pts.map((p) => anchor(p.x, p.y)) }];
  const n = pts.length;
  return [{ closed, pts: pts.map((p, i) => {
    const back = closed || i > 0, fwd = closed || i < n - 1, prev = back ? pts[(i - 1 + n) % n] : p, next = fwd ? pts[(i + 1) % n] : p;
    const tx = next.x - prev.x, ty = next.y - prev.y, tl = Math.hypot(tx, ty) || 1, li = Math.hypot(p.x - prev.x, p.y - prev.y) * 0.3, lo = Math.hypot(next.x - p.x, next.y - p.y) * 0.3;
    return anchor(p.x, p.y, p.x - (tx / tl) * li, p.y - (ty / tl) * li, p.x + (tx / tl) * lo, p.y + (ty / tl) * lo, true);
  }) }];
}

function applyOne(d: PathData, e: Effect): PathData {
  const b = pathBounds(d);
  if (!Number.isFinite(b.x)) return d;
  const id = e.id;
  if (VECTOR_3D.has(id)) return outline3d(d, e);
  if (id.startsWith('warp.')) {
    const style = id.slice(5);
    return mapPathNonlinear(d, (p) => warpPoint(style, P(e, 'bend', 50), P(e, 'horizontal', 0), P(e, 'vertical', 0), B(e, 'vertical_orientation', false), b, p), 6);
  }
  switch (id) {
    case 'distort.pucker_bloat': {
      const a = P(e, 'amount', 30) / 100, c = centerOf(b);
      return d.map((sp) => {
        const n = sp.pts.length, moved = sp.pts.map((p) => ({ x: p.x + (c.x - p.x) * a * 0.4, y: p.y + (c.y - p.y) * a * 0.4 })), out: Anchor[] = moved.map((m) => anchor(m.x, m.y));
        segments(sp).forEach((s, i) => {
          const j = (i + 1) % n, mid = bezPoint(s, 0.5), apex = { x: mid.x + (mid.x - c.x) * a * 0.9, y: mid.y + (mid.y - c.y) * a * 0.9 };
          const p0 = moved[i], p3 = moved[j], q = { x: 2 * apex.x - (p0.x + p3.x) / 2, y: 2 * apex.y - (p0.y + p3.y) / 2 };
          out[i] = { ...out[i], ox: p0.x + ((q.x - p0.x) * 2) / 3, oy: p0.y + ((q.y - p0.y) * 2) / 3 };
          out[j] = { ...out[j], ix: p3.x + ((q.x - p3.x) * 2) / 3, iy: p3.y + ((q.y - p3.y) * 2) / 3 };
        });
        return { closed: sp.closed, pts: out };
      });
    }
    case 'distort.roughen': {
      const r = rand(P(e, 'seed', 1)), size = B(e, 'relative', true) ? (P(e, 'size', 5) / 100) * Math.max(b.w, b.h) : P(e, 'size', 5), detail = Math.max(0.1, P(e, 'detail', 10));
      return d.flatMap((sp) => {
        if (sp.pts.length < 2) return [sp];
        const len = pathLength(sp), count = Math.max(sp.pts.length, Math.round((len / PT_PER_IN) * detail)), total = sp.closed ? count : count + 1, pts: Pt[] = [];
        for (let i = 0; i < total; i++) {
          const at = pointAtLength(sp, (len * i) / count), kn = (r() * 2 - 1) * size, kt = (r() * 2 - 1) * size * 0.35;
          pts.push({ x: at.p.x - at.tangent.y * kn + at.tangent.x * kt, y: at.p.y + at.tangent.x * kn + at.tangent.y * kt });
        }
        return polyToSmooth(pts, sp.closed, B(e, 'smooth', false));
      });
    }
    case 'distort.zig_zag': {
      const size = B(e, 'relative', false) ? (P(e, 'size', 10) / 100) * Math.max(b.w, b.h) : P(e, 'size', 10), ridges = Math.max(0, Math.round(P(e, 'ridges', 4)));
      return d.flatMap((sp) => {
        const segN = segments(sp).length;
        if (!segN) return [sp];
        const len = pathLength(sp), pts: Pt[] = [];
        let total = segN * (ridges + 1);
        if (sp.closed && total % 2) total++;
        for (let k = 0; k <= total; k++) {
          if (sp.closed && k === total) break;
          const at = pointAtLength(sp, (len * k) / total), s = k % 2 ? -size : size;
          pts.push({ x: at.p.x + at.tangent.y * s, y: at.p.y - at.tangent.x * s });
        }
        return polyToSmooth(pts, sp.closed, B(e, 'smooth', false));
      });
    }
    case 'distort.twist': {
      const c = centerOf(b), deg = P(e, 'angle', 45), ang = (deg * Math.PI) / 180;
      let R = 1e-6;
      for (const sp of d) for (const p of sp.pts) R = Math.max(R, Math.hypot(p.x - c.x, p.y - c.y));
      return mapPathNonlinear(d, (p) => { const dx = p.x - c.x, dy = p.y - c.y, k = Math.max(0, 1 - (Math.hypot(dx, dy) / R) ** 2), a = ang * k * k, co = Math.cos(a), si = Math.sin(a); return { x: c.x + dx * co - dy * si, y: c.y + dx * si + dy * co }; }, Math.min(24, Math.max(4, Math.ceil(Math.abs(deg) / 20))));
    }
    case 'distort.transform': {
      const c = centerOf(b), th = (-P(e, 'rotate', 0) * Math.PI) / 180, co = Math.cos(th), si = Math.sin(th);
      const sx = (P(e, 'scale_h', 100) / 100) * (B(e, 'reflect_x', false) ? -1 : 1), sy = (P(e, 'scale_v', 100) / 100) * (B(e, 'reflect_y', false) ? -1 : 1);
      const m00 = co * sx, m01 = si * sx, m10 = -si * sy, m11 = co * sy;
      const step: Mat = [m00, m01, m10, m11, c.x + P(e, 'move_h', 0) - (m00 * c.x + m10 * c.y), c.y + P(e, 'move_v', 0) - (m01 * c.x + m11 * c.y)];
      const copies = Math.max(0, Math.min(500, Math.round(P(e, 'copies', 0))));
      if (!copies) return transformPath(d, step);
      const out: PathData = [...d];
      for (let i = 0, acc = step; i < copies; i++, acc = mul(step, acc)) out.push(...transformPath(d, acc));
      return out;
    }
    case 'distort.tweak': {
      const seed = Math.round(P(e, 'seed', 1)), hx = (P(e, 'horizontal', 10) / 100) * b.w, vy = (P(e, 'vertical', 10) / 100) * b.h, an = B(e, 'anchors', true), hd = B(e, 'handles', true);
      const jit = (i: number, j: number, k: number): number => { let h = Math.imul(i + 1, 374761393) ^ Math.imul(j + 1, 668265263) ^ Math.imul(k + 7, 1274126177) ^ Math.imul(seed, 2654435761); h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (((h ^ (h >>> 16)) >>> 0) / 4294967295) * 2 - 1; };
      return d.map((sp, si) => ({ closed: sp.closed, pts: sp.pts.map((a, ai) => {
        const dx = an ? jit(si, ai, 0) * hx : 0, dy = an ? jit(si, ai, 1) * vy : 0, kx = (k: number): number => (hd ? jit(si, ai, k) * hx * 0.6 : 0), ky = (k: number): number => (hd ? jit(si, ai, k) * vy * 0.6 : 0);
        return { ...a, x: a.x + dx, y: a.y + dy, ix: a.ix + dx + (hasIn(a) ? kx(2) : 0), iy: a.iy + dy + (hasIn(a) ? ky(3) : 0), ox: a.ox + dx + (hasOut(a) ? kx(4) : 0), oy: a.oy + dy + (hasOut(a) ? ky(5) : 0) };
      }) }));
    }
    case 'distort.free_distort': {
      const q = (k: string): number => P(e, k, 0) / 100;
      const tl = { x: b.x + q('tlx') * b.w, y: b.y + q('tly') * b.h }, tr = { x: b.x + b.w + q('trx') * b.w, y: b.y + q('try') * b.h }, br = { x: b.x + b.w + q('brx') * b.w, y: b.y + b.h + q('bry') * b.h }, bl = { x: b.x + q('blx') * b.w, y: b.y + b.h + q('bly') * b.h };
      const H = quadMap(tl, tr, br, bl);
      if (!H) return d;
      return mapPathNonlinear(d, (p) => { const u = (p.x - b.x) / (b.w || 1), v = (p.y - b.y) / (b.h || 1), w = Math.max(1e-3, H[6] * u + H[7] * v + 1); return { x: (H[0] * u + H[1] * v + H[2]) / w, y: (H[3] * u + H[4] * v + H[5]) / w }; }, 4);
    }
    case 'path.offset': try { return offsetPath(d, P(e, 'offset', 10), (String(e.params.joins ?? 'miter') as 'miter' | 'round' | 'bevel'), P(e, 'miter', 4)); } catch { return d; }
    case 'path.outline_stroke': try { return strokeToPath(d, P(e, 'width', 4), 'butt', 'miter', 4); } catch { return d; }
    case 'stylize.round_corners': return roundCorners(d, P(e, 'radius', 10));
    case 'stylize.scribble': return scribble(d, e);
    case 'convert.rectangle': return rectPath(b.x - P(e, 'extra_w', 0), b.y - P(e, 'extra_h', 0), b.w + 2 * P(e, 'extra_w', 0), b.h + 2 * P(e, 'extra_h', 0));
    case 'convert.rounded_rectangle': { const r = P(e, 'radius', 9); return rectPath(b.x - P(e, 'extra_w', 0), b.y - P(e, 'extra_h', 0), b.w + 2 * P(e, 'extra_w', 0), b.h + 2 * P(e, 'extra_h', 0), [r, r, r, r]); }
    case 'convert.ellipse': return ellipsePath(b.x - P(e, 'extra_w', 0), b.y - P(e, 'extra_h', 0), b.w + 2 * P(e, 'extra_w', 0), b.h + 2 * P(e, 'extra_h', 0));
  }
  return d;
}

function scribble(d: PathData, e: Effect): PathData {
  const b = pathBounds(d), ang = (P(e, 'angle', 30) * Math.PI) / 180, spacing = Math.max(0.1, P(e, 'spacing', 5)), width = Math.max(0.1, P(e, 'width', 3)), r = rand(P(e, 'seed', 1)), vari = P(e, 'variation', 1);
  const polys = d.filter((sp) => sp.pts.length > 2).map((sp) => flattenSub({ ...sp, closed: true }, 1));
  const c = centerOf(b), R = Math.hypot(b.w, b.h) / 2 + spacing, co = Math.cos(ang), si = Math.sin(ang);
  const rot = (x: number, y: number): Pt => ({ x: c.x + x * co - y * si, y: c.y + x * si + y * co });
  const zig: Pt[] = [];
  let flip = false;
  for (let y = -R; y <= R; y += spacing) {
    const xs: number[] = [];
    for (const poly of polys) for (let i = 0; i < poly.length; i++) {
      const a = poly[i], bb = poly[(i + 1) % poly.length];
      const la = { x: (a.x - c.x) * co + (a.y - c.y) * si, y: -(a.x - c.x) * si + (a.y - c.y) * co }, lb = { x: (bb.x - c.x) * co + (bb.y - c.y) * si, y: -(bb.x - c.x) * si + (bb.y - c.y) * co };
      if ((la.y <= y && lb.y > y) || (lb.y <= y && la.y > y)) xs.push(la.x + ((y - la.y) / (lb.y - la.y)) * (lb.x - la.x));
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    const x0 = xs[0] + (r() - 0.5) * vari, x1 = xs[xs.length - 1] + (r() - 0.5) * vari;
    if (flip) { zig.push(rot(x1, y), rot(x0, y + spacing / 2)); } else { zig.push(rot(x0, y), rot(x1, y + spacing / 2)); }
    flip = !flip;
  }
  if (zig.length < 2) return d;
  try { return strokeToPath([{ closed: false, pts: zig.map((p) => anchor(p.x, p.y)) }], width, 'round', 'round', 4); } catch { return d; }
}

const effectCache = new WeakMap<PathData, WeakMap<Effect[], PathData>>();
export function effectPath(d: PathData, effects: Effect[]): PathData {
  const active = effects.filter((e) => e.visible && !effectDef(e.id)?.raster && EFFECT_IDS.has(e.id));
  if (!active.length) return d;
  let byFx = effectCache.get(d);
  if (!byFx) { byFx = new WeakMap(); effectCache.set(d, byFx); }
  const hit = byFx.get(effects);
  if (hit) return hit;
  let out = d;
  for (const e of active) { try { out = applyOne(out, e); } catch { } }
  byFx.set(effects, out);
  return out;
}

const facesCache = new WeakMap<VNode, { epoch: number; symbols: Doc['symbols']; swatches: Doc['swatches']; faces: VNode[] }>();
export const has3d = (n: VNode): boolean => n.ap.effects.some((e) => e.visible && VECTOR_3D.has(e.id));
export function threeDFaces(doc: Doc, n: VNode): VNode[] | null {
  const at = n.kind === 'layer' ? -1 : n.ap.effects.findIndex((e) => e.visible && VECTOR_3D.has(e.id));
  if (at < 0) return null;
  const ep = textEpoch(), hit = facesCache.get(n);
  if (hit && hit.epoch === ep && hit.symbols === doc.symbols && hit.swatches === doc.swatches) return hit.faces;
  const tone = (raw: Paint): RGB3 | null => { const p = resolvePaint(doc, raw); if (p.type === 'color') { const v = toRgb(p.color); return [v.r / 255, v.g / 255, v.b / 255]; } if (p.type === 'gradient') { const v = toRgb(gradientAt(p.gradient, 0.5).color); return [v.r / 255, v.g / 255, v.b / 255]; } return null; };
  const solids: Solid[] = [], paints: Array<Paint | null> = [];
  const add = (x: VNode, own: Effect[]): void => {
    if (x.hidden) return;
    const f = x.ap.items.find((i) => i.visible && i.kind === 'fill'), s = x.ap.items.find((i): i is StrokeItem => i.visible && i.kind === 'stroke');
    const vec = own.filter((e) => e.visible && !VECTOR_3D.has(e.id) && !effectDef(e.id)?.raster);
    if (x.kind === 'path' || x.kind === 'compound') { solids.push({ d: effectPath(x.kind === 'path' ? x.d : x.children.flatMap((c) => c.d), vec), rule: x.rule, fill: f ? tone(f.paint) : null, stroke: s ? tone(s.paint) : null, strokeWidth: s?.width ?? 0 }); paints.push(f && f.paint.type !== 'none' ? f.paint : null); }
    else if (x.kind === 'text') { const d = textOutline(x), st = x.spans[0]?.style; if (d && d.length) { solids.push({ d, rule: 'nonzero', fill: st ? tone(st.fill) : [0, 0, 0], stroke: null, strokeWidth: 0 }); paints.push(st && st.fill.type !== 'none' ? st.fill : null); } }
    else childrenOf(x)?.forEach((c) => add(c, c.ap.effects));
  };
  add(n, n.ap.effects.slice(0, at));
  if (!solids.length) return null;
  const col = (c: RGB3): Paint => solid(rgb(Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)));
  const fx = n.ap.effects[at], p = fx.params, L = lighting(p), keep = L.material !== 'wireframe', scene = scene3dWith(solids, fx), out: VNode[] = [];
  const path = (id: string, d: PathData, rule: PathNode['rule'], items: PathNode['ap']['items']): PathNode => ({ id, kind: 'path', d, rule, opacity: 1, blend: 'normal', ap: { items, effects: [] } });
  const shade = (f: { t: number; s: number }): PathNode['ap']['items'] => [...(f.t < 0.998 ? [fill(col(L.shade), 1 - f.t)] : []), ...(f.s > 0.002 ? [fill(solid(rgb(255, 255, 255)), f.s)] : [])];
  const mapName = String(p.map_symbol ?? '').trim(), sym = mapName ? doc.symbols.find((s) => s.id === mapName || s.name === mapName) : undefined;
  if (p.shadow === true && scene.faces.length) {
    const dist = P(fx, 'shadow_distance', 20), below = p.shadow_position === 'below', lx = -L.light[0], ly = -L.light[1], ll = Math.hypot(lx, ly) || 1;
    let bottom = -Infinity;
    for (const f of scene.faces) for (const sp of f.d) for (const a of sp.pts) bottom = Math.max(bottom, a.y);
    const m: Mat = below ? [1, 0, -(lx / ll) * 0.6, 0.28, (lx / ll) * 0.6 * bottom + dist * (lx / ll), bottom * 0.72 + dist * 0.15] : [1, 0, 0, 1, (lx / ll) * dist, (ly / ll) * dist];
    const soft = P(fx, 'shadow_softness', 8), kids = scene.faces.map((f, i) => path(`${n.id}~3ds${i}`, transformPath(f.d, m), f.rule, [fill(solid(rgb(0, 0, 0)))]));
    out.push({ id: `${n.id}~3dshadow`, kind: 'group', clip: false, children: kids, opacity: Math.max(0, Math.min(1, P(fx, 'shadow_opacity', 40) / 100)), blend: 'multiply', ap: { items: [], effects: soft > 0 ? [effect('blur.gaussian', { radius: soft })] : [] } } as GroupNode);
  }
  scene.faces.forEach((f, i) => {
    const own = f.cap && keep ? paints[f.solid] : null, id = `${n.id}~3d${i}`;
    if (!own) { out.push(path(id, f.d, f.rule, [...(f.fill ? [fill(col(f.fill))] : []), ...(f.stroke && f.strokeWidth > 0 ? [stroke(col(f.stroke), f.strokeWidth, { join: 'round' })] : [])])); return; }
    const art = sym && f.role === 'front' && f.facing ? mapped(doc, sym.art, scene, P(fx, 'map_scale', 100) / 100, P(fx, 'map_x', 0), P(fx, 'map_y', 0), `${id}a`) : null;
    if (!art) { out.push(path(id, f.d, f.rule, [fill(own), ...shade(f)])); return; }
    const shadeArt = p.shade_art !== false;
    out.push(path(id, f.d, f.rule, shadeArt ? [fill(own)] : [fill(own), ...shade(f)]));
    out.push({ id: `${id}m`, kind: 'group', clip: true, children: [art, path(`${id}c`, f.d, f.rule, [])], opacity: 1, blend: 'normal', ap: { items: [], effects: [] } } as GroupNode);
    if (shadeArt) out.push(path(`${id}s`, f.d, f.rule, shade(f)));
  });
  facesCache.set(n, { epoch: ep, symbols: doc.symbols, swatches: doc.swatches, faces: out });
  return out;
}

function artBounds(doc: Doc, art: VNode): Rect | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (r: Rect): void => { if (!Number.isFinite(r.x) || r.w < 0) return; x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); };
  const walk = (x: VNode): void => {
    if (x.hidden) return;
    if (x.kind === 'path') add(pathBounds(x.d));
    else if (x.kind === 'compound') x.children.forEach((c) => add(pathBounds(c.d)));
    else if (x.kind === 'text') add(textBounds(x));
    else if (x.kind === 'image') { const a = apply(x.xf, 0, 0), c = apply(x.xf, x.w, x.h); add({ x: Math.min(a.x, c.x), y: Math.min(a.y, c.y), w: Math.abs(c.x - a.x), h: Math.abs(c.y - a.y) }); }
    else childrenOf(x)?.forEach(walk);
  };
  walk(art);
  void doc;
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

function reid(x: VNode, prefix: string): VNode {
  let k = 0;
  const go = (v: VNode): VNode => {
    const id = `${prefix}${k++}`, kids = childrenOf(v);
    if (v.kind === 'compound') return { ...v, id, children: v.children.map((c) => ({ ...c, id: `${prefix}${k++}` })) };
    return kids ? ({ ...v, id, children: kids.map(go) } as VNode) : { ...v, id };
  };
  return go(x);
}

function mapped(doc: Doc, art: VNode, scene: Scene, scale: number, dx: number, dy: number, prefix: string): VNode | null {
  const b = artBounds(doc, art);
  if (!b) return null;
  const c = scene.center, k = 50, o = scene.project(c.x, c.y, 0), px = scene.project(c.x + k, c.y, 0), py = scene.project(c.x, c.y + k, 0);
  const A: Mat = [(px.x - o.x) / k, (px.y - o.y) / k, (py.x - o.x) / k, (py.y - o.y) / k, 0, 0];
  const place: Mat = mul([1, 0, 0, 1, c.x + dx, c.y + dy], mul([scale, 0, 0, scale, 0, 0], [1, 0, 0, 1, -(b.x + b.w / 2), -(b.y + b.h / 2)]));
  const m = mul([A[0], A[1], A[2], A[3], o.x - (A[0] * c.x + A[2] * c.y), o.y - (A[1] * c.x + A[3] * c.y)], place);
  return transformNode(reid(art, prefix), m);
}

export interface RasterFx { kind: 'drop_shadow' | 'outer_glow' | 'inner_glow' | 'feather' | 'blur' | 'filter'; dx: number; dy: number; blur: number; color: string; opacity: number; blend: BlendMode; reach: number; filter?: { id: string; params: Effect['params'] } }
export function rasterEffects(n: VNode): RasterFx[] { return rasterEffectsOf(n.ap.effects); }
export const isItemEffect = (id: string): boolean => EFFECT_IDS.has(id) && !id.startsWith('3d.');
export function rasterEffectsOf(effects: Effect[]): RasterFx[] {
  const out: RasterFx[] = [];
  for (const e of effects) {
    if (!e.visible) continue;
    const colr = (k: string, d: string): string => cssColor(parseColor(String(e.params[k] ?? d)) ?? BLACK);
    const mode = (String(e.params.mode ?? 'normal') as BlendMode);
    if (e.id === 'stylize.drop_shadow') { const dx = P(e, 'x', 7), dy = P(e, 'y', 7), bl = P(e, 'blur', 5); out.push({ kind: 'drop_shadow', dx, dy, blur: bl, color: colr('color', '#000'), opacity: P(e, 'opacity', 75) / 100, blend: mode, reach: Math.abs(dx) + Math.abs(dy) + bl * 3 }); }
    else if (e.id === 'stylize.outer_glow') { const bl = P(e, 'blur', 5); out.push({ kind: 'outer_glow', dx: 0, dy: 0, blur: bl, color: colr('color', '#ffd400'), opacity: P(e, 'opacity', 75) / 100, blend: mode, reach: bl * 3 }); }
    else if (e.id === 'stylize.inner_glow') { const bl = P(e, 'blur', 5); out.push({ kind: 'inner_glow', dx: 0, dy: 0, blur: bl, color: colr('color', '#fff'), opacity: P(e, 'opacity', 75) / 100, blend: mode, reach: 0 }); }
    else if (e.id === 'stylize.feather') { const bl = P(e, 'radius', 5); out.push({ kind: 'feather', dx: 0, dy: 0, blur: bl, color: '#000', opacity: 1, blend: 'normal', reach: 0 }); }
    else if (e.id === 'blur.gaussian') { const bl = P(e, 'radius', 5); out.push({ kind: 'blur', dx: 0, dy: 0, blur: bl, color: '#000', opacity: 1, blend: 'normal', reach: bl * 3 }); }
    else if (FILTER_IDS.has(e.id)) out.push({ kind: 'filter', dx: 0, dy: 0, blur: 0, color: '#000', opacity: 1, blend: 'normal', reach: filterReach(e.id, e.params), filter: { id: e.id, params: e.params } });
  }
  return out;
}

export const WIDTH_PROFILES: Record<string, WidthPoint[]> = {
  uniform: [{ t: 0, l: 1, r: 1 }, { t: 1, l: 1, r: 1 }],
  lens: [{ t: 0, l: 0, r: 0 }, { t: 0.5, l: 1, r: 1 }, { t: 1, l: 0, r: 0 }],
  taper_start: [{ t: 0, l: 0, r: 0 }, { t: 1, l: 1, r: 1 }],
  taper_end: [{ t: 0, l: 1, r: 1 }, { t: 1, l: 0, r: 0 }],
  taper_both: [{ t: 0, l: 0, r: 0 }, { t: 0.15, l: 1, r: 1 }, { t: 0.85, l: 1, r: 1 }, { t: 1, l: 0, r: 0 }],
  pinch: [{ t: 0, l: 1, r: 1 }, { t: 0.5, l: 0.2, r: 0.2 }, { t: 1, l: 1, r: 1 }],
  teardrop: [{ t: 0, l: 0, r: 0 }, { t: 0.3, l: 1, r: 1 }, { t: 1, l: 0, r: 0 }],
  wave: [{ t: 0, l: 0.5, r: 0.5 }, { t: 0.25, l: 1, r: 1 }, { t: 0.5, l: 0.5, r: 0.5 }, { t: 0.75, l: 1, r: 1 }, { t: 1, l: 0.5, r: 0.5 }],
};

export function profileAt(prof: WidthPoint[], t: number): { l: number; r: number } {
  const p = [...prof].sort((a, b) => a.t - b.t);
  if (!p.length) return { l: 1, r: 1 };
  if (t <= p[0].t) return { l: p[0].l, r: p[0].r };
  for (let i = 0; i < p.length - 1; i++) if (t <= p[i + 1].t) { const u = (t - p[i].t) / Math.max(1e-9, p[i + 1].t - p[i].t); return { l: p[i].l + (p[i + 1].l - p[i].l) * u, r: p[i].r + (p[i + 1].r - p[i].r) * u }; }
  const last = p[p.length - 1];
  return { l: last.l, r: last.r };
}

const outlineCache = new WeakMap<PathData, WeakMap<StrokeItem, PathData>>();
export function strokeOutline(d: PathData, s: StrokeItem): PathData {
  let m = outlineCache.get(d);
  if (!m) { m = new WeakMap(); outlineCache.set(d, m); }
  const hit = m.get(s);
  if (hit) return hit;
  const prof = s.profile ?? WIDTH_PROFILES.uniform, hw = s.width / 2, out: PathData = [];
  for (const sp of d) {
    const pts = flattenSub(sp, 0.2);
    if (pts.length < 2) continue;
    if (sp.closed) pts.push({ ...pts[0] });
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + dist(pts[i], pts[i - 1]));
    const total = lens[lens.length - 1] || 1;
    const left: Pt[] = [], right: Pt[] = [];
    pts.forEach((p, i) => {
      const nrm = normalAt(pts, i, false), w = profileAt(prof, lens[i] / total);
      left.push({ x: p.x + nrm.x * hw * w.l, y: p.y + nrm.y * hw * w.l });
      right.push({ x: p.x - nrm.x * hw * w.r, y: p.y - nrm.y * hw * w.r });
    });
    if (sp.closed) {
      out.push({ closed: true, pts: left.map((p) => anchor(p.x, p.y)) }, { closed: true, pts: right.reverse().map((p) => anchor(p.x, p.y)) });
    } else out.push({ closed: true, pts: [...left, ...right.reverse()].map((p) => anchor(p.x, p.y)) });
  }
  m.set(s, out);
  return out;
}

export const ARROWHEADS = ['none', 'triangle', 'triangle_open', 'arrow', 'arrow_open', 'circle', 'circle_open', 'square', 'square_open', 'diamond', 'diamond_open', 'bar', 'barbed', 'half_arrow', 'feather', 'tail', 'concave'];

function headShape(kind: string): { d: PathData; inset: number } | null {
  const P2 = (pts: number[][]): Anchor[] => pts.map(([x, y]) => anchor(x, y));
  const ring = (outer: Anchor[], k: number): PathData => {
    const cx = outer.reduce((s, a) => s + a.x, 0) / outer.length, cy = outer.reduce((s, a) => s + a.y, 0) / outer.length;
    return [{ closed: true, pts: outer }, { closed: true, pts: [...outer].reverse().map((a) => anchor(cx + (a.x - cx) * k, cy + (a.y - cy) * k)) }];
  };
  switch (kind) {
    case 'triangle': return { d: [{ closed: true, pts: P2([[0, 0], [-4, -1.6], [-4, 1.6]]) }], inset: 3.5 };
    case 'triangle_open': return { d: ring(P2([[0, 0], [-4, -1.6], [-4, 1.6]]), 0.6), inset: 0.5 };
    case 'arrow': return { d: [{ closed: true, pts: P2([[0, 0], [-4.5, -2], [-3.4, 0], [-4.5, 2]]) }], inset: 3 };
    case 'arrow_open': return { d: [{ closed: true, pts: P2([[0, 0], [-4.4, -2.4], [-4.8, -1.8], [-1.3, 0], [-4.8, 1.8], [-4.4, 2.4]]) }], inset: 0.5 };
    case 'circle': return { d: ellipsePath(-3, -1.5, 3, 3), inset: 1.5 };
    case 'circle_open': { const o = ellipsePath(-3, -1.5, 3, 3)[0], i = ellipsePath(-2.4, -0.9, 1.8, 1.8)[0]; return { d: [o, { closed: true, pts: [...i.pts].reverse().map((a) => ({ x: a.x, y: a.y, ix: a.ox, iy: a.oy, ox: a.ix, oy: a.iy })) }], inset: 0.3 }; }
    case 'square': return { d: [{ closed: true, pts: P2([[0, -1.5], [0, 1.5], [-3, 1.5], [-3, -1.5]]) }], inset: 1.5 };
    case 'square_open': return { d: [{ closed: true, pts: P2([[0, -1.5], [0, 1.5], [-3, 1.5], [-3, -1.5]]) }, { closed: true, pts: P2([[-0.6, -0.9], [-2.4, -0.9], [-2.4, 0.9], [-0.6, 0.9]]) }], inset: 0.3 };
    case 'diamond': return { d: [{ closed: true, pts: P2([[0, 0], [-2, -2], [-4, 0], [-2, 2]]) }], inset: 2 };
    case 'diamond_open': return { d: [{ closed: true, pts: P2([[0, 0], [-2, -2], [-4, 0], [-2, 2]]) }, { closed: true, pts: P2([[-0.9, 0], [-2, 1.1], [-3.1, 0], [-2, -1.1]]) }], inset: 0.3 };
    case 'bar': return { d: [{ closed: true, pts: P2([[0, -2], [0, 2], [-0.8, 2], [-0.8, -2]]) }], inset: 0 };
    case 'barbed': return { d: [{ closed: true, pts: P2([[0, 0], [-5, -2.4], [-3.6, 0], [-5, 2.4]]) }], inset: 3 };
    case 'half_arrow': return { d: [{ closed: true, pts: P2([[0, 0], [-4.5, -2.2], [-4.5, 0]]) }], inset: 3 };
    case 'feather': return { d: [{ closed: true, pts: P2([[-3, -0.5], [-0.5, -2.2], [0.5, -2.2], [-2, -0.5], [-2, 0.5], [0.5, 2.2], [-0.5, 2.2], [-3, 0.5]]) }], inset: 0 };
    case 'tail': return { d: [{ closed: true, pts: P2([[0, -1.5], [-2, -1.5], [-3, 0], [-2, 1.5], [0, 1.5], [-1, 0]]) }], inset: 0 };
    case 'concave': return { d: [{ closed: true, pts: [anchor(0, 0), anchor(-4.5, -2.2, -4.5, -2.2, -3, -0.6), anchor(-4.5, 2.2, -3, 0.6, -4.5, 2.2)] }], inset: 3 };
  }
  return null;
}

export function arrowGeometry(d: PathData, s: StrokeItem): PathData | null {
  if ((s.startArrow === 'none' || !s.startArrow) && (s.endArrow === 'none' || !s.endArrow)) return null;
  const sp = d.find((x) => !x.closed && x.pts.length > 1);
  if (!sp) return null;
  const out: PathData = [];
  const place = (kind: string, end: boolean, scalePct: number): void => {
    const h = headShape(kind);
    if (!h) return;
    const segs = segments(sp), seg = end ? segs[segs.length - 1] : segs[0];
    const p = end ? seg[3] : seg[0], tg = bezTangent(seg, end ? 1 : 0);
    const dir = end ? tg : { x: -tg.x, y: -tg.y }, k = s.width * (scalePct / 100), ang = Math.atan2(dir.y, dir.x);
    const shift = s.arrowAlign === 'extend' ? (h.inset > 0 ? h.inset * k : 0) : 0;
    const m = mul(translate(p.x + dir.x * shift, p.y + dir.y * shift), mul(rotateAbout((ang * 180) / Math.PI, 0, 0), scaleAbout(k, k, 0, 0)));
    out.push(...transformPath(h.d, m));
  };
  if (s.startArrow && s.startArrow !== 'none') place(s.startArrow, false, s.arrowScale[0]);
  if (s.endArrow && s.endArrow !== 'none') place(s.endArrow, true, s.arrowScale[1]);
  return out.length ? out : null;
}

export function brushGeometry(doc: Doc, d: PathData, s: StrokeItem): Array<{ d: PathData; paint: StrokeItem['paint'] | null; opacity?: number }> | null {
  const def = doc.brushes.find((b) => b.id === s.brush || b.name === s.brush);
  if (!def) return null;
  let m = brushCache.get(d);
  if (!m) { m = new WeakMap(); brushCache.set(d, m); }
  const hit = m.get(s);
  if (hit && hit.def === def) return hit.out;
  try { const out = brushOutline(doc, def, d, s); m.set(s, { def, out }); return out; } catch { return null; }
}
const brushCache = new WeakMap<PathData, WeakMap<StrokeItem, { def: BrushDef; out: ReturnType<typeof brushOutline> }>>();
