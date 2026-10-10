import { anchor, ellipsePath, polygonPath, rectPath, starPath, translate } from './geometry';
import { BLACK, fill, parseColor, solid, stroke } from './paint';
import { transformNode } from './transform';
import type { Color, Doc, PathData, SymbolSlice, VNode } from './types';

export interface LibSymbol { name: string; art: VNode; type?: 'static' | 'dynamic'; slice?: SymbolSlice | null }
export interface SymbolLibrary { id: string; name: string; symbols: LibSymbol[]; user?: boolean }

let seq = 0;
const nid = (): string => `ylib${++seq}`;
const c = (h: string): Color => parseColor(h) ?? BLACK;
const sh = (d: PathData, f: string | null, s: string | null = null, w = 2, rule: 'nonzero' | 'evenodd' = 'nonzero'): VNode => ({
  id: nid(), kind: 'path', d, rule, opacity: 1, blend: 'normal',
  ap: { items: [...(f ? [fill(solid(c(f)))] : []), ...(s ? [stroke(solid(c(s)), w, { cap: 'round', join: 'round' })] : [])], effects: [] },
});
const grp = (...kids: VNode[]): VNode => ({ id: nid(), kind: 'group', clip: false, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, children: kids });
const P = (...pts: Array<[number, number]>): PathData => [{ closed: true, pts: pts.map(([x, y]) => anchor(x, y)) }];
const L = (...pts: Array<[number, number]>): PathData => [{ closed: false, pts: pts.map(([x, y]) => anchor(x, y)) }];
const join = (...ds: PathData[]): PathData => ds.flat();
const circle = (cx: number, cy: number, r: number): PathData => ellipsePath(cx - r, cy - r, r * 2, r * 2);

function bbox(n: VNode, r = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }): typeof r {
  if (n.kind === 'path') for (const sp of n.d) for (const a of sp.pts) { r.x0 = Math.min(r.x0, a.x); r.y0 = Math.min(r.y0, a.y); r.x1 = Math.max(r.x1, a.x); r.y1 = Math.max(r.y1, a.y); }
  if (n.kind === 'group') for (const k of n.children) bbox(k, r);
  return r;
}
const sym = (name: string, art: VNode, slice?: [number, number, number, number]): LibSymbol => {
  const b = bbox(art), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return { name, art: transformNode(art, translate(-cx, -cy)), type: 'dynamic', slice: slice ? { x1: slice[0] - cx, y1: slice[1] - cy, x2: slice[2] - cx, y2: slice[3] - cy } : null };
};

const INK = '#1f2a37', BLUE = '#2f6fed', TEAL = '#14a39a', RED = '#e5484d', AMBER = '#f5a524', GREEN = '#3aa655', LEAF = '#2e8b57', SKY = '#7cc4f0', SAND = '#e9d8a6', SLATE = '#6b7a90', WHITE = '#ffffff';

const gear = (): PathData => {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2, w = Math.PI / 8;
    for (const [a, r] of [[a0 - w * 0.55, 18], [a0 - w * 0.35, 23], [a0 + w * 0.35, 23], [a0 + w * 0.55, 18]] as Array<[number, number]>) pts.push([24 + Math.cos(a) * r, 24 + Math.sin(a) * r]);
  }
  return join(P(...pts), circle(24, 24, 7));
};
const heart = (x: number, y: number, s: number): PathData => [{ closed: true, pts: [
  anchor(x + s / 2, y + s * 0.28, x + s * 0.2, y - s * 0.08, x + s * 0.8, y - s * 0.08),
  anchor(x + s / 2, y + s * 0.95, x + s * 1.12, y + s * 0.42, x + s / 2, y + s * 0.95),
  anchor(x + s / 2, y + s * 0.95, x + s / 2, y + s * 0.95, x - s * 0.12, y + s * 0.42),
] }];
const cloud = (): PathData => [{ closed: true, pts: [
  anchor(10, 34, 4, 34, 4, 24), anchor(14, 22, 12, 22, 14, 12), anchor(28, 12, 18, 6, 32, 6), anchor(38, 20, 38, 12, 46, 16), anchor(40, 34, 48, 28, 40, 34),
] }];
const leaf = (): PathData => [{ closed: true, pts: [anchor(6, 42, 6, 42, 4, 14), anchor(42, 6, 30, 4, 44, 32)] }];

export const SYMBOL_LIBRARIES: SymbolLibrary[] = [
  { id: 'arrows', name: 'Arrows', symbols: [
    sym('Arrow Right', sh(P([0, 14], [26, 14], [26, 4], [44, 20], [26, 36], [26, 26], [0, 26]), INK)),
    sym('Arrow Left', sh(P([44, 14], [18, 14], [18, 4], [0, 20], [18, 36], [18, 26], [44, 26]), INK)),
    sym('Arrow Up', sh(P([14, 44], [14, 18], [4, 18], [20, 0], [36, 18], [26, 18], [26, 44]), INK)),
    sym('Arrow Down', sh(P([14, 0], [14, 26], [4, 26], [20, 44], [36, 26], [26, 26], [26, 0]), INK)),
    sym('Arrow Double', sh(P([0, 20], [14, 6], [14, 14], [34, 14], [34, 6], [48, 20], [34, 34], [34, 26], [14, 26], [14, 34]), BLUE)),
    sym('Chevron', sh(L([12, 4], [30, 22], [12, 40]), null, INK, 6)),
    sym('Arrow Curved', grp(sh([{ closed: false, pts: [anchor(6, 40, 6, 40, 6, 16), anchor(34, 10, 18, 8, 34, 10)] }], null, BLUE, 5), sh(P([30, 0], [44, 11], [30, 20]), BLUE))),
    sym('Arrow Circle', grp(sh([{ closed: false, pts: [anchor(40, 24, 40, 24, 40, 36), anchor(22, 42, 32, 44, 12, 42), anchor(4, 24, 4, 32, 4, 14), anchor(22, 6, 12, 6, 28, 6)] }], null, TEAL, 5), sh(P([24, -2], [36, 6], [24, 14]), TEAL))),
  ] },
  { id: 'web_icons', name: 'Web Icons', symbols: [
    sym('Home', grp(sh(P([4, 22], [24, 4], [44, 22], [38, 22], [38, 44], [10, 44], [10, 22]), INK), sh(rectPath(20, 30, 8, 14), WHITE))),
    sym('Search', grp(sh(circle(20, 20, 13), null, INK, 5), sh(L([30, 30], [44, 44]), null, INK, 6))),
    sym('Mail', grp(sh(rectPath(2, 8, 44, 32, [4, 4, 4, 4]), BLUE), sh(L([4, 11], [24, 26], [44, 11]), null, WHITE, 3))),
    sym('User', grp(sh(circle(24, 14, 10), INK), sh([{ closed: true, pts: [anchor(4, 46, 4, 46, 4, 30), anchor(44, 46, 44, 30, 44, 46)] }], INK))),
    sym('Heart', sh(heart(2, 4, 44), RED)),
    sym('Star', sh(starPath(24, 24, 22, 10, 5), AMBER)),
    sym('Settings', sh(gear(), SLATE, null, 2, 'evenodd')),
    sym('Cart', grp(sh(L([2, 6], [10, 6], [16, 32], [40, 32], [44, 14], [12, 14]), null, INK, 4), sh(circle(18, 41, 4), INK), sh(circle(37, 41, 4), INK))),
    sym('Menu', grp(sh(rectPath(4, 8, 40, 5, [2.5, 2.5, 2.5, 2.5]), INK), sh(rectPath(4, 21, 40, 5, [2.5, 2.5, 2.5, 2.5]), INK), sh(rectPath(4, 34, 40, 5, [2.5, 2.5, 2.5, 2.5]), INK))),
    sym('Bell', grp(sh([{ closed: true, pts: [anchor(6, 36, 6, 36, 12, 30), anchor(24, 4, 10, 4, 38, 4), anchor(42, 36, 36, 30, 42, 36)] }], AMBER), sh(circle(24, 41, 4), AMBER))),
    sym('Check', grp(sh(circle(24, 24, 22), GREEN), sh(L([13, 24], [21, 32], [36, 16]), null, WHITE, 5))),
    sym('Button', grp(sh(rectPath(0, 0, 120, 40, [12, 12, 12, 12]), BLUE), sh(rectPath(4, 4, 112, 14, [9, 9, 4, 4]), WHITE)), [14, 14, 106, 26]),
  ] },
  { id: 'nature', name: 'Nature', symbols: [
    sym('Leaf', grp(sh(leaf(), LEAF), sh(L([8, 40], [36, 12]), null, '#bfe3c8', 2))),
    sym('Tree', grp(sh(rectPath(21, 30, 6, 16), '#7a5230'), sh(P([24, 0], [42, 22], [32, 22], [44, 34], [4, 34], [16, 22], [6, 22]), LEAF))),
    sym('Flower', grp(...[0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; return sh(circle(24 + Math.cos(a) * 12, 24 + Math.sin(a) * 12, 9), '#f28ab2'); }), sh(circle(24, 24, 7), AMBER))),
    sym('Sun', grp(sh(starPath(24, 24, 24, 15, 12), AMBER), sh(circle(24, 24, 12), '#ffd34d'))),
    sym('Cloud', sh(cloud(), SKY)),
    sym('Raindrop', sh([{ closed: true, pts: [anchor(16, 0), anchor(30, 26, 30, 14, 30, 38), anchor(2, 26, 2, 38, 2, 14)] }], BLUE)),
    sym('Mountain', grp(sh(P([0, 40], [18, 8], [28, 24], [34, 16], [48, 40]), SLATE), sh(P([13, 17], [18, 8], [23, 17], [20, 15], [18, 18], [16, 15]), WHITE))),
    sym('Moon', sh([{ closed: true, pts: [anchor(30, 2, 30, 2, 8, 2), anchor(28, 46, 4, 46, 40, 46), anchor(30, 36, 34, 42, 16, 30), anchor(30, 2, 18, 12, 30, 2)] }], '#c9cfe6')),
    sym('Wave', sh([{ closed: true, pts: [anchor(0, 20, 0, 20, 8, 8), anchor(24, 20, 16, 32, 32, 8), anchor(48, 20, 40, 32, 48, 20), anchor(48, 30), anchor(0, 30)] }], TEAL)),
  ] },
  { id: 'shapes', name: 'Shapes', symbols: [
    sym('Circle', sh(circle(24, 24, 22), BLUE)),
    sym('Square', sh(rectPath(2, 2, 44, 44), TEAL)),
    sym('Rounded Square', sh(rectPath(2, 2, 44, 44, [10, 10, 10, 10]), AMBER), [12, 12, 36, 36]),
    sym('Triangle', sh(polygonPath(24, 26, 24, 3), RED)),
    sym('Hexagon', sh(polygonPath(24, 24, 22, 6), GREEN)),
    sym('Star', sh(starPath(24, 24, 22, 10, 5), AMBER)),
    sym('Diamond', sh(P([24, 0], [44, 24], [24, 48], [4, 24]), SLATE)),
    sym('Ring', sh(join(circle(24, 24, 22), circle(24, 24, 13)), BLUE, null, 2, 'evenodd')),
    sym('Heart', sh(heart(2, 4, 44), RED)),
  ] },
  { id: 'flowchart', name: 'Flowchart', symbols: [
    sym('Process', sh(rectPath(0, 0, 96, 48, [4, 4, 4, 4]), WHITE, INK, 2), [10, 10, 86, 38]),
    sym('Decision', sh(P([48, 0], [96, 30], [48, 60], [0, 30]), WHITE, INK, 2)),
    sym('Terminator', sh(rectPath(0, 0, 96, 40, [20, 20, 20, 20]), WHITE, INK, 2), [22, 4, 74, 36]),
    sym('Data', sh(P([16, 0], [96, 0], [80, 44], [0, 44]), WHITE, INK, 2)),
    sym('Document', sh([{ closed: true, pts: [anchor(0, 0), anchor(96, 0), anchor(96, 40, 96, 40, 72, 30), anchor(48, 40, 60, 50, 36, 30), anchor(0, 44, 24, 54, 0, 44)] }], WHITE, INK, 2)),
    sym('Database', grp(sh([{ closed: true, pts: [anchor(0, 8, 0, 8, 0, 0), anchor(64, 8, 64, 0, 64, 8), anchor(64, 56, 64, 56, 64, 64), anchor(0, 56, 0, 64, 0, 56)] }], WHITE, INK, 2), sh([{ closed: false, pts: [anchor(0, 8, 0, 8, 0, 16), anchor(64, 8, 64, 16, 64, 8)] }], null, INK, 2))),
    sym('Connector', sh(circle(16, 16, 15), WHITE, INK, 2)),
    sym('Manual Input', sh(P([0, 14], [96, 0], [96, 48], [0, 48]), WHITE, INK, 2)),
    sym('Flow Arrow', grp(sh(L([0, 10], [60, 10]), null, INK, 2), sh(P([58, 4], [72, 10], [58, 16]), INK))),
  ] },
];

export function symbolLibrary(key: string, extra: SymbolLibrary[] = []): SymbolLibrary | undefined {
  const k = key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return [...SYMBOL_LIBRARIES, ...extra].find((l) => l.id === k || l.id === key || l.name.toLowerCase() === key.trim().toLowerCase());
}

export function symbolLibraryFromDoc(doc: Doc, name: string, id = `user_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`): SymbolLibrary {
  return { id, name, user: true, symbols: doc.symbols.map((s) => ({ name: s.name, art: s.art, type: s.type ?? 'static', slice: s.slice ?? null })) };
}
