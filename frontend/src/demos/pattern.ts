import { boards, idOf, idsOf, linear, type Tool } from './kit';

const INK = '#22223b', SAND = '#f2e8cf', TEAL = '#2a9d8f', CORAL = '#e76f51', SAFFRON = '#e9c46a', NAVY = '#264653';

export async function buildPatternDemo(t: Tool): Promise<void> {
  await t('new_document', { name: 'Tide Pattern Studies', width: 720, height: 480, units: 'pt' });
  const [a] = await boards(t);
  await t('artboard', { action: 'set', index: 0, name: 'Studies' });
  const X = (x: number): number => a.x + x, Y = (y: number): number => a.y + y;
  await t('draw_shape', { shape: 'rectangle', x: X(0), y: Y(0), width: 720, height: 480, fill: SAND, stroke: 'none', name: 'Paper' });

  await t('add_layer', { name: 'Pattern' });
  const tile = [
    idOf(await t('draw_shape', { shape: 'ellipse', x: X(40), y: Y(40), width: 28, height: 28, fill: TEAL, stroke: 'none' })),
    idOf(await t('draw_path', { d: `M${X(34)} ${Y(84)} C ${X(44)} ${Y(74)} ${X(54)} ${Y(94)} ${X(64)} ${Y(84)} S ${X(84)} ${Y(74)} ${X(94)} ${Y(84)}`, fill: 'none', stroke: NAVY, stroke_width: 4 })),
    idOf(await t('draw_shape', { shape: 'ellipse', x: X(80), y: Y(48), width: 10, height: 10, fill: CORAL, stroke: 'none' })),
  ];
  await t('set_stroke', { ids: [tile[1]], cap: 'round' });
  await t('make_pattern', { ids: tile, name: 'Tide Tiles', tile: 'brick_by_row', h_spacing: 8, v_spacing: 6 });
  await t('delete_objects', { ids: tile });
  const panel = idOf(await t('draw_shape', { shape: 'rounded_rectangle', x: X(28), y: Y(28), width: 300, height: 424, corner_radius: 18, fill: SAND, stroke: NAVY, stroke_width: 2, name: 'Pattern panel' }));
  await t('set_paint', { ids: [panel], fill: 'Tide Tiles' });
  await t('draw_shape', { shape: 'rounded_rectangle', x: X(44), y: Y(400), width: 150, height: 38, corner_radius: 10, fill: NAVY, stroke: 'none', name: 'Label' });
  await t('add_text', { text: 'Tide Tiles', x: X(58), y: Y(426), font: 'Inter', style: 'Black', size: 20, color: SAND });

  await t('add_layer', { name: 'Blend and envelope' });
  const from = idOf(await t('draw_shape', { shape: 'ellipse', x: X(360), y: Y(40), width: 54, height: 54, fill: TEAL, stroke: 'none' }));
  const to = idOf(await t('draw_shape', { shape: 'rounded_rectangle', x: X(636), y: Y(52), width: 30, height: 30, corner_radius: 6, fill: CORAL, stroke: 'none' }));
  const blend = idOf(await t('make_blend', { ids: [from, to], spacing: 'steps', steps: 9 }));
  await t('set_object', { ids: [blend], name: 'Shape blend' });
  const word = idOf(await t('add_text', { text: 'TIDE', x: X(510), y: Y(186), font: 'Inter', style: 'Black', size: 80, tracking: 60, align: 'center', color: linear(0, [0, NAVY], [1, TEAL]) }));
  await t('envelope', { ids: [word], action: 'warp', style: 'flag', bend: 35 });

  await t('add_layer', { name: '3D badge' });
  const hex = idOf(await t('draw_shape', { shape: 'polygon', x: X(352), y: Y(244), width: 100, height: 100, sides: 6, fill: SAFFRON, stroke: 'none', name: 'Badge' }));
  await t('three_d', { ids: [hex], kind: 'extrude', depth: 24, bevel: 'classic', bevel_height: 4, position: 'off_axis_front', material: 'plastic', light: 'top_left' });
  await t('add_text', { text: 'SALT\nWORKS', x: X(402), y: Y(398), font: 'Inter', style: 'Bold', size: 15, leading: 17, tracking: 120, align: 'center', color: NAVY });

  await t('add_layer', { name: 'Colourways' });
  await t('color_harmony', { color: TEAL, rule: 'analogous', variation: 'none', save_group: 'Coast' });
  const palette = [NAVY, TEAL, SAFFRON, '#f4a261', CORAL];
  const chips: string[] = [];
  for (let i = 0; i < palette.length; i++) chips.push(idOf(await t('draw_shape', { shape: 'rounded_rectangle', x: X(544 + i * 34), y: Y(250), width: 28, height: 28, corner_radius: 8, fill: palette[i], stroke: 'none' })));
  const row = idOf(await t('group', { ids: chips }));
  await t('set_object', { ids: [row], name: 'Original colours' });
  const coast = idsOf(await t('duplicate_objects', { ids: [row], dx: 0, dy: 50 }));
  await t('recolor', { ids: coast, action: 'group', group: 'Coast' });
  await t('set_object', { ids: coast, name: 'Coast colourway' });
  const triad = idsOf(await t('duplicate_objects', { ids: [row], dx: 0, dy: 100 }));
  await t('recolor', { ids: triad, action: 'harmony', harmony: 'triad', base: CORAL });
  await t('set_object', { ids: triad, name: 'Triad colourway' });
  for (const [label, y] of [['Original', 268], ['Coast', 318], ['Triad', 368]] as const) await t('add_text', { text: label, x: X(534), y: Y(y), font: 'Inter', style: 'Medium', size: 11, align: 'right', color: INK });
  await t('add_text', { text: 'One palette, three colourways', x: X(544), y: Y(410), font: 'Inter', style: 'Regular', size: 10, color: INK });
}
