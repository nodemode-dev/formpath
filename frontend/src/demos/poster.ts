import { boards, idOf, linear, seeded, type Tool } from './kit';

const NIGHT = '#0b1d3a', DUSK = '#46306f', GLOW = '#f2915f', SUN = '#ffd27a', CREAM = '#f6efe4', BRICK = '#c4473c', SEA = '#12305e', DEEP = '#081428';

export async function buildPosterDemo(t: Tool): Promise<void> {
  await t('new_document', { name: 'Harbour Lights Poster', width: 432, height: 648, units: 'pt', artboards: 2 });
  const [a, b] = await boards(t);
  await t('artboard', { action: 'set', index: 0, name: 'Poster' });
  await t('artboard', { action: 'set', index: 1, name: 'Programme' });
  const X = (x: number): number => a.x + x, Y = (y: number): number => a.y + y;

  await t('add_layer', { name: 'Sky and sea' });
  await t('draw_shape', { shape: 'rectangle', x: X(0), y: Y(0), width: 432, height: 400, fill: linear(270, [0, NIGHT], [0.55, DUSK], [1, GLOW]), stroke: 'none', name: 'Sky' });
  const rnd = seeded(7);
  for (let i = 0; i < 26; i++) {
    const s = 1 + rnd() * 2.2;
    await t('draw_shape', { shape: 'ellipse', x: X(14 + rnd() * 404), y: Y(14 + rnd() * 200), width: s, height: s, fill: CREAM, stroke: 'none', name: 'Light' });
  }
  const sun = idOf(await t('draw_shape', { shape: 'ellipse', x: X(200), y: Y(300), width: 150, height: 150, fill: SUN, stroke: 'none', name: 'Moon' }));
  await t('gradient_mesh', { action: 'make', ids: [sun], rows: 3, columns: 3, highlight: 'center' });
  await t('draw_shape', { shape: 'rectangle', x: X(0), y: Y(372), width: 432, height: 276, fill: linear(270, [0, SEA], [1, DEEP]), stroke: 'none', name: 'Sea' });
  const top = idOf(await t('draw_shape', { shape: 'rounded_rectangle', x: X(214), y: Y(386), width: 114, height: 5, corner_radius: 2.5, fill: SUN, stroke: 'none' }));
  const low = idOf(await t('draw_shape', { shape: 'rounded_rectangle', x: X(262), y: Y(470), width: 18, height: 3, corner_radius: 1.5, fill: SEA, stroke: 'none' }));
  const shine = idOf(await t('make_blend', { ids: [top, low], spacing: 'steps', steps: 9 }));
  await t('set_object', { ids: [shine], name: 'Moonlight on the water', blend_mode: 'screen', opacity: 0.85 });

  await t('add_layer', { name: 'Lighthouse' });
  await t('draw_path', { d: `M${X(0)} ${Y(384)} C ${X(40)} ${Y(330)} ${X(110)} ${Y(318)} ${X(176)} ${Y(372)} L ${X(190)} ${Y(388)} L ${X(0)} ${Y(388)} Z`, fill: '#0a1730', stroke: 'none', name: 'Headland' });
  await t('draw_path', { d: `M${X(104)} ${Y(232)} L ${X(432)} ${Y(168)} L ${X(432)} ${Y(282)} Z`, fill: linear(0, [0, CREAM, 0.75], [1, CREAM, 0]), stroke: 'none', name: 'Beam' });
  const beam = idOf(await t('draw_path', { d: `M${X(104)} ${Y(232)} L ${X(0)} ${Y(196)} L ${X(0)} ${Y(262)} Z`, fill: linear(180, [0, CREAM, 0.5], [1, CREAM, 0]), stroke: 'none', name: 'Beam' }));
  await t('set_object', { ids: [beam], blend_mode: 'screen' });
  await t('draw_path', { d: `M${X(94)} ${Y(246)} L ${X(114)} ${Y(246)} L ${X(122)} ${Y(346)} L ${X(86)} ${Y(346)} Z`, fill: CREAM, stroke: 'none', name: 'Tower' });
  for (const [y0, y1] of [[268, 284], [306, 322]]) {
    const w0 = 10 + (y0 - 246) * 0.08, w1 = 10 + (y1 - 246) * 0.08;
    await t('draw_path', { d: `M${X(104 - w0)} ${Y(y0)} L ${X(104 + w0)} ${Y(y0)} L ${X(104 + w1)} ${Y(y1)} L ${X(104 - w1)} ${Y(y1)} Z`, fill: BRICK, stroke: 'none', name: 'Band' });
  }
  await t('draw_shape', { shape: 'rectangle', x: X(96), y: Y(226), width: 16, height: 20, fill: SUN, stroke: '#1d2b44', stroke_width: 1.5, name: 'Lamp' });
  await t('draw_shape', { shape: 'polygon', x: X(92), y: Y(212), width: 24, height: 18, sides: 3, fill: BRICK, stroke: 'none', name: 'Roof' });

  await t('add_layer', { name: 'Type' });
  const words: string[] = [];
  for (const [w, y] of [['HARBOUR', 512], ['LIGHTS', 572]] as const) {
    words.push(idOf(await t('add_text', { text: w, x: X(216), y: Y(y), font: 'Inter', style: 'Black', size: 64, tracking: 40, align: 'center', color: CREAM, name: w })));
  }
  await t('set_appearance', { ids: [words[0]], add_stroke: { color: GLOW, width: 1.5 } });
  await t('apply_effect', { ids: [words[0]], effect: 'stylize.outer_glow', params: { blur: 10, opacity: 60, color: GLOW } });
  await t('graphic_style', { action: 'create', name: 'Harbour Glow', id: words[0] });
  await t('graphic_style', { action: 'apply', name: 'Harbour Glow', ids: [words[1]] });
  const arc = idOf(await t('draw_path', { d: `M${X(66)} ${Y(606)} Q ${X(216)} ${Y(636)} ${X(366)} ${Y(606)}`, stroke: 'none', fill: 'none', name: 'Baseline' }));
  const line = idOf(await t('add_text', { text: 'a festival of light on the water', mode: 'path', path_id: arc, x: X(66), y: Y(606), font: 'Inter', style: 'Medium', size: 13, tracking: 120, color: SUN }));
  await t('set_text', { id: line, align: 'center' });
  const badge = idOf(await t('draw_shape', { shape: 'rounded_rectangle', x: X(296), y: Y(28), width: 108, height: 54, corner_radius: 10, fill: BRICK, stroke: 'none', name: 'Date badge' }));
  await t('set_appearance', { ids: [badge], items: [{ kind: 'fill', color: BRICK }, { kind: 'stroke', color: CREAM, width: 1.5, align: 'inside' }, { kind: 'stroke', color: BRICK, width: 4, align: 'outside' }] });
  await t('apply_effect', { ids: [badge], effect: 'stylize.drop_shadow', params: { x: 0, y: 4, blur: 6, opacity: 45 } });
  await t('graphic_style', { action: 'create', name: 'Ticket Badge', id: badge });
  await t('add_text', { text: '14 to 16\nAUGUST', x: X(350), y: Y(51), font: 'Inter', style: 'Bold', size: 13, leading: 15, align: 'center', color: CREAM });

  const P = (x: number): number => b.x + x, Q = (y: number): number => b.y + y;
  await t('draw_shape', { shape: 'rectangle', x: P(0), y: Q(0), width: 432, height: 648, fill: linear(270, [0, NIGHT], [1, DEEP]), stroke: 'none', name: 'Ground' });
  await t('add_text', { text: 'Programme', x: P(40), y: Q(86), font: 'Inter', style: 'Black', size: 40, color: CREAM });
  const rule = idOf(await t('draw_path', { d: `M${P(40)} ${Q(112)} C ${P(140)} ${Q(104)} ${P(280)} ${Q(120)} ${P(392)} ${Q(108)}`, fill: 'none', stroke: GLOW, stroke_width: 1.2, name: 'Brush rule' }));
  await t('apply_brush', { ids: [rule], library: 'artistic_ink', brush: 'Brush Taper' });
  const body = [
    'Friday 14 August', 'Lantern walk from the old pier at dusk, then the harbour lit boat by boat.',
    'Saturday 15 August', 'Shadow puppets on the sea wall, a brass band at the quay and the night market.',
    'Sunday 16 August', 'Light boats parade at nine; the lighthouse answers at ten. Bring a lamp.',
    'Everywhere', 'Free entry. Step-free routes along the promenade. Saltmere Harbour Trust.',
  ].join('\n');
  const frame = idOf(await t('add_text', { text: body, mode: 'area', x: P(40), y: Q(140), width: 352, height: 250, font: 'Inter', style: 'Regular', size: 13, leading: 19, color: CREAM }));
  await t('set_text', { id: frame, area_columns: 2, area_gutter: 18 });
  let at = 0;
  for (const [i, para] of body.split('\n').entries()) {
    if (i % 2 === 0) await t('set_text', { id: frame, start: at, end: at + para.length, style: 'Bold', color: SUN });
    at += para.length + 1;
  }
  const badge2 = idOf(await t('draw_shape', { shape: 'rounded_rectangle', x: P(40), y: Q(560), width: 160, height: 48, corner_radius: 10, fill: BRICK, stroke: 'none', name: 'Entry badge' }));
  await t('graphic_style', { action: 'apply', name: 'Ticket Badge', ids: [badge2] });
  await t('add_text', { text: 'FREE ENTRY', x: P(120), y: Q(590), font: 'Inter', style: 'Bold', size: 15, tracking: 80, align: 'center', color: CREAM });
}
