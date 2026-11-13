import { boards, idOf, linear, type Board, type Tool } from './kit';

const INK = '#1f2a44', BLUE = '#2f7de1', TEAL = '#17a398', GOLD = '#f4b63f';
const NAMES = ['Home', 'Search', 'Favourite', 'Cloud', 'Chat', 'Settings', 'Folder', 'Place', 'Lock', 'Calendar', 'Mail', 'Energy'];

export async function buildIconsDemo(t: Tool): Promise<void> {
  await t('new_document', { name: 'Brightwater Icons', width: 96, height: 96, units: 'px', artboards: NAMES.length });
  await t('artboard', { action: 'rearrange', columns: 4, spacing: 32 });
  const all = await boards(t);
  for (let i = 0; i < NAMES.length; i++) await t('artboard', { action: 'set', index: i, name: NAMES[i] });
  await t('add_layer', { name: 'Icons' });
  for (let i = 0; i < NAMES.length; i++) {
    const g = grid(t, all[i]);
    const id = await DRAW[i](g);
    await t('set_object', { ids: [id], name: NAMES[i] });
    await t('artboard', { action: 'activate', index: i });
    await t('align', { ids: [id], action: 'horizontal_center', to: 'artboard' });
    await t('align', { ids: [id], action: 'vertical_center', to: 'artboard' });
  }
  const right = Math.max(...all.map((b) => b.x + b.w)), top = Math.min(...all.map((b) => b.y));
  const r = await t('artboard', { action: 'add', name: 'Logo', x: right + 64, y: top, width: 384, height: 384 });
  const logo = (await boards(t))[Number(r.index ?? all.length)];
  await t('add_layer', { name: 'Logo' });
  const cx = logo.x + 192, cy = logo.y + 150;
  const petal = idOf(await t('draw_path', { d: `M${cx} ${cy - 18} C ${cx + 22} ${cy - 40} ${cx + 22} ${cy - 84} ${cx} ${cy - 104} C ${cx - 22} ${cy - 84} ${cx - 22} ${cy - 40} ${cx} ${cy - 18} Z`, fill: linear(90, [0, BLUE], [1, TEAL]), stroke: 'none', name: 'Petal' }));
  await t('set_object', { ids: [petal], opacity: 0.85, blend_mode: 'multiply' });
  await t('repeat', { ids: [petal], kind: 'radial', instances: 9, radius: 61 });
  await t('draw_shape', { shape: 'ellipse', x: cx - 14, y: cy - 14, width: 28, height: 28, fill: GOLD, stroke: 'none', name: 'Core' });
  await t('add_text', { text: 'brightwater', x: cx, y: logo.y + 318, font: 'Inter', style: 'Bold', size: 40, tracking: -20, align: 'center', color: INK });
  await t('add_text', { text: 'DESIGN STUDIO', x: cx, y: logo.y + 344, font: 'Inter', style: 'Medium', size: 12, tracking: 400, align: 'center', color: BLUE });
}

type Grid = { box: (kind: string, x: number, y: number, w: number, h: number, more?: Record<string, unknown>) => Promise<string>; path: (d: string, more?: Record<string, unknown>) => Promise<string>; op: (operation: string, ids: string[]) => Promise<string>; at: (x: number, y: number) => [number, number]; t: Tool };

function grid(t: Tool, b: Board): Grid {
  const u = 4, ox = b.x, oy = b.y;
  const P = (x: number, y: number): string => `${ox + x * u} ${oy + y * u}`;
  return {
    t,
    at: (x, y) => [ox + x * u, oy + y * u],
    box: async (kind, x, y, w, h, more = {}) => idOf(await t('draw_shape', { shape: kind, x: ox + x * u, y: oy + y * u, width: w * u, height: h * u, fill: INK, stroke: 'none', ...(typeof more.corner_radius === 'number' ? { ...more, corner_radius: more.corner_radius * u } : more) })),
    path: async (d, more = {}) => idOf(await t('draw_path', { d: d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => P(Number(x), Number(y))), fill: INK, stroke: 'none', ...more })),
    op: async (operation, ids) => idOf(await t('pathfinder', { ids, operation })),
  };
}

const DRAW: Array<(g: Grid) => Promise<string>> = [
  async (g) => {
    const roof = await g.path('M12 2.5 L22 11.5 L2 11.5 Z');
    const body = await g.box('rectangle', 5, 10, 14, 11);
    const house = await g.op('unite', [roof, body]);
    return g.op('minus_front', [house, await g.box('rounded_rectangle', 10, 14.5, 4, 6.5, { corner_radius: 1 })]);
  },
  async (g) => {
    const outer = await g.box('ellipse', 2.5, 2.5, 14, 14), inner = await g.box('ellipse', 5.5, 5.5, 8, 8);
    const ring = idOf(await g.t('compound_path', { ids: [outer, inner], rule: 'evenodd' }));
    const handle = await g.box('rounded_rectangle', 12.5, 15.5, 10, 3.4, { corner_radius: 1.7, rotation: -45 });
    return g.op('unite', [ring, handle]);
  },
  async (g) => {
    const l = await g.box('ellipse', 2.5, 3.5, 10.5, 10.5), r = await g.box('ellipse', 11, 3.5, 10.5, 10.5);
    const tip = await g.path('M12 21 L3.6 11.6 L12 6.5 L20.4 11.6 Z');
    const pts = [[5, 7], [8, 5.5], [16, 5.5], [19, 7], [12, 8.5], [12, 12], [7, 12], [17, 12], [12, 18], [9, 15], [15, 15]].map(([x, y]) => g.at(x, y));
    return idOf(await g.t('shape_builder', { ids: [l, r, tip], points: pts, delete: false }));
  },
  async (g) => g.op('unite', [await g.box('ellipse', 2.5, 9.5, 9, 9), await g.box('ellipse', 7.5, 4.5, 11, 11), await g.box('ellipse', 13, 9, 8.5, 8.5), await g.box('rounded_rectangle', 3, 12.5, 18, 6, { corner_radius: 3 })]),
  async (g) => {
    const bubble = await g.op('unite', [await g.box('rounded_rectangle', 2.5, 3.5, 19, 13.5, { corner_radius: 4 }), await g.path('M6.5 15 L12 15 L6.5 21 Z')]);
    return g.op('minus_front', [bubble, await g.box('ellipse', 6.6, 8.8, 2.6, 2.6), await g.box('ellipse', 10.7, 8.8, 2.6, 2.6), await g.box('ellipse', 14.8, 8.8, 2.6, 2.6)]);
  },
  async (g) => g.op('minus_front', [await g.box('star', 2, 2, 20, 20, { points: 8, inner_ratio: 0.8 }), await g.box('ellipse', 8.5, 8.5, 7, 7)]),
  async (g) => g.op('unite', [await g.box('rounded_rectangle', 2, 7, 20, 13.5, { corner_radius: 2 }), await g.box('rounded_rectangle', 2, 4, 9, 5.5, { corner_radius: 1.5 })]),
  async (g) => {
    const drop = await g.op('unite', [await g.box('ellipse', 5, 2, 14, 14), await g.path('M6.2 11.6 L17.8 11.6 L12 22 Z')]);
    return g.op('minus_front', [drop, await g.box('ellipse', 9, 6, 6, 6)]);
  },
  async (g) => {
    const shackle = await g.op('minus_front', [await g.box('rounded_rectangle', 6.5, 2.5, 11, 14, { corner_radius: 5.5 }), await g.box('rounded_rectangle', 9, 5, 6, 12, { corner_radius: 3 })]);
    const lock = await g.op('unite', [shackle, await g.box('rounded_rectangle', 4, 10, 16, 12, { corner_radius: 2.5 })]);
    return g.op('minus_front', [lock, await g.box('ellipse', 10.5, 13.5, 3, 3), await g.box('rectangle', 11.3, 15.5, 1.4, 3.5)]);
  },
  async (g) => {
    const page = await g.op('unite', [await g.box('rounded_rectangle', 3, 4.5, 18, 16.5, { corner_radius: 2.5 }), await g.box('rounded_rectangle', 6.5, 2.5, 2.6, 5, { corner_radius: 1.3 }), await g.box('rounded_rectangle', 14.9, 2.5, 2.6, 5, { corner_radius: 1.3 })]);
    const cells: string[] = [];
    for (const [x, y] of [[6, 10.5], [10.5, 10.5], [15, 10.5], [6, 15], [10.5, 15]]) cells.push(await g.box('rounded_rectangle', x, y, 3, 3, { corner_radius: 0.6 }));
    return g.op('minus_front', [page, ...cells]);
  },
  async (g) => {
    const env = await g.box('rounded_rectangle', 2, 5, 20, 14, { corner_radius: 2.2 });
    const flap = await g.path('M3.5 7 L12 13.4 L20.5 7', { fill: 'none', stroke: INK, stroke_width: 6 });
    const cut = idOf(await g.t('path_operation', { ids: [flap], operation: 'outline_stroke' }));
    return g.op('minus_front', [env, cut]);
  },
  async (g) => g.path('M13.5 1.5 L4 13.5 L10.8 13.5 L9.5 22.5 L20 9.5 L13.2 9.5 Z', { fill: linear(270, [0, GOLD], [1, '#e8772e']) }),
];
