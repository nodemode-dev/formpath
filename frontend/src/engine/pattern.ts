import type { PatternDef, Pt, Rect, VNode } from './types';

export type PatternType = PatternDef['type'];
export type PatternGeometry = Pick<PatternDef, 'tile' | 'hs' | 'vs' | 'type' | 'brick' | 'overlap'>;
export interface Lattice { w: number; h: number; cells: Pt[] }

export function patternLattice(def: PatternGeometry): Lattice {
  const tw = Math.max(1e-3, def.tile.w + def.hs), th = Math.max(1e-3, def.tile.h + def.vs), off = def.brick ?? 0.5;
  switch (def.type) {
    case 'brick_row': return { w: tw, h: th * 2, cells: [{ x: 0, y: 0 }, { x: tw * off, y: th }] };
    case 'brick_col': return { w: tw * 2, h: th, cells: [{ x: 0, y: 0 }, { x: tw, y: th * off }] };
    case 'hex_col': return { w: tw * 1.5, h: th, cells: [{ x: 0, y: 0 }, { x: tw * 0.75, y: th / 2 }] };
    case 'hex_row': return { w: tw, h: th * 1.5, cells: [{ x: 0, y: 0 }, { x: tw / 2, y: th * 0.75 }] };
    default: return { w: tw, h: th, cells: [{ x: 0, y: 0 }] };
  }
}

export function latticeCopies(def: PatternGeometry, reach: number, skipOrigin = false): Pt[] {
  const l = patternLattice(def), out: Pt[] = [];
  for (let j = -reach; j <= reach; j++) for (let i = -reach; i <= reach; i++) for (const c of l.cells) {
    const p = { x: i * l.w + c.x, y: j * l.h + c.y };
    if (skipOrigin && Math.abs(p.x) < 1e-9 && Math.abs(p.y) < 1e-9) continue;
    out.push(p);
  }
  const [h, v] = def.overlap ?? ['left', 'top'];
  return out.sort((a, b) => (Math.abs(a.y - b.y) > 1e-9 ? (v === 'top' ? b.y - a.y : a.y - b.y) : h === 'left' ? b.x - a.x : a.x - b.x));
}

export function tileOutline(def: PatternGeometry): Pt[] {
  const t = def.tile, x0 = t.x - def.hs / 2, y0 = t.y - def.vs / 2, w = t.w + def.hs, h = t.h + def.vs;
  if (def.type === 'hex_col') return [{ x: x0 + w * 0.25, y: y0 }, { x: x0 + w * 0.75, y: y0 }, { x: x0 + w, y: y0 + h / 2 }, { x: x0 + w * 0.75, y: y0 + h }, { x: x0 + w * 0.25, y: y0 + h }, { x: x0, y: y0 + h / 2 }];
  if (def.type === 'hex_row') return [{ x: x0 + w / 2, y: y0 }, { x: x0 + w, y: y0 + h * 0.25 }, { x: x0 + w, y: y0 + h * 0.75 }, { x: x0 + w / 2, y: y0 + h }, { x: x0, y: y0 + h * 0.75 }, { x: x0, y: y0 + h * 0.25 }];
  return [{ x: x0, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w, y: y0 + h }, { x: x0, y: y0 + h }];
}

export interface PatternSession {
  pattern: string | null;
  group: string;
  name: string;
  type: PatternType;
  hs: number;
  vs: number;
  brick: number;
  overlap: ['left' | 'right', 'top' | 'bottom'];
  fit: boolean;
  w: number;
  h: number;
  copies: 0 | 3 | 5 | 7;
  dim: number;
  edge: boolean;
  mark: number;
  before: string[];
}

export function sessionTile(s: PatternSession, art: Rect): Rect {
  if (s.fit || !(s.w > 0) || !(s.h > 0)) return art;
  return { x: art.x + art.w / 2 - s.w / 2, y: art.y + art.h / 2 - s.h / 2, w: s.w, h: s.h };
}

export function sessionGeometry(s: PatternSession, art: Rect): PatternGeometry {
  const fit = s.fit || !(s.w > 0) || !(s.h > 0);
  return { tile: sessionTile(s, art), hs: fit ? s.hs : 0, vs: fit ? s.vs : 0, type: s.type, brick: s.brick, overlap: s.overlap };
}

export const artChildren = (art: VNode): VNode[] => (art.kind === 'group' && !art.clip && !art.mask && art.opacity === 1 && art.blend === 'normal' && !art.ap.items.length && !art.ap.effects.length ? art.children : [art]);
