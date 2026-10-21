import { toRgb } from '../engine/paint';
import type { Appearance, AppearanceItem, BlendMode, Color, Effect, Paint, StrokeItem } from '../engine';

/**
 * Illustrator's art style dictionaries (%AI9_BeginArtStyles). A style is a tree: Chain filters apply their
 * children in order to the first one, Stack filters hold the fills and strokes (listed top first), and the
 * leaves are Fill, Stroke, Conduit, Blend and the "Adobe ..." live effect plug-ins with a parameter dictionary.
 */
export interface StyleNode { compound: boolean; name: string; title: string; visible: boolean; fs: number; dict: Record<string, number | string | boolean>; paints: Record<string, string[]>; kids: StyleNode[] }
export interface StyleDef { name: string; root: StyleNode | null; simple: string[] | null }

/** What the reader can say about a block of paint operators (a FillStyle or StrokeStyle dictionary). */
export interface PaintRead { fill: Paint | null; stroke: Paint | null; lw: number; cap: StrokeItem['cap']; join: StrokeItem['join']; miter: number; dash: number[]; dashOff: number; blend: BlendMode; opacity: number }
export interface StyleHost {
  paint(lines: string[]): PaintRead;
  brush(kind: 'calligraphic', size: number, roundness: number, angle: number): string;
}
export interface StyleResult { ap: Appearance; opacity: number; blend: BlendMode; missing: string[]; mapped: string[]; brushes: number }

const node = (compound: boolean): StyleNode => ({ compound, name: '', title: '', visible: true, fs: 0, dict: {}, paints: {}, kids: [] });
const PAINT_TAGS = new Set(['FillStyle', 'StrokeStyle', 'BlendStyle']);

export function parseStyles(lines: string[]): StyleDef[] {
  const out: StyleDef[] = [];
  let cur: StyleDef | null = null, stack: StyleNode[] = [], cap: { key: string; lines: string[]; done: boolean; simple: boolean } | null = null, inDict = false;
  const close = (): void => {
    if (!cur) return;
    while (stack.length > 1) { const k = stack.pop() as StyleNode; stack[stack.length - 1].kids.push(k); }
    if (stack.length) cur.root = stack[0];
    stack = [];
  };
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    if (cap) {
      if (cap.done) {
        const k = /^\((.+)\)\s*,/.exec(t);
        if (cap.simple) { if (cur) cur.simple = cap.lines; cap = null; continue; }
        if (k && stack.length) stack[stack.length - 1].paints[k[1]] = cap.lines;
        cap = null;
        continue;
      }
      if (t === (cap.simple ? '/Paint ;' : '/Def ;') || t.startsWith(cap.simple ? '/Paint ;' : '/Def ;')) { cap.done = true; if (cap.simple) { if (cur) cur.simple = cap.lines; cap = null; } continue; }
      cap.lines.push(t);
      continue;
    }
    let m: RegExpExecArray | null;
    if (t.startsWith('/KnownStyle')) { close(); cur = { name: '', root: null, simple: null }; out.push(cur); stack = []; inDict = false; continue; }
    if (!cur) continue;
    if ((m = /^\((.*)\)\s*\/Name\s*,/.exec(t))) { cur.name = m[1]; continue; }
    if ((m = /^\/(\w+)\s*:\s*(.*)$/.exec(t))) {
      const tag = m[1], rest = m[2].trim();
      if (tag === 'SimpleStyle') { cap = { key: 'simple', lines: rest ? [rest] : [], done: false, simple: true }; continue; }
      if (tag === 'CompoundFilter') { stack.push(node(true)); continue; }
      if (tag === 'BasicFilter') { stack.push(node(false)); continue; }
      if (tag === 'Dictionary') { inDict = true; continue; }
      if (PAINT_TAGS.has(tag)) { cap = { key: tag, lines: rest ? [rest] : [], done: false, simple: false }; continue; }
      continue;
    }
    if (/^\/Part\s*,/.test(t)) { if (stack.length > 1) { const k = stack.pop() as StyleNode; stack[stack.length - 1].kids.push(k); } continue; }
    if (/^\/Execution/.test(t)) { close(); continue; }
    const top = stack[stack.length - 1];
    if (!top) continue;
    if ((m = /^\((.*)\)\s+(\d+)\s+(\d+)\s+\/Filter\s*,/.exec(t))) { top.name = m[1]; continue; }
    if ((m = /^(\d+)\s+\/Visible\s*,/.exec(t))) { top.visible = m[1] !== '0'; continue; }
    if ((m = /^(\d+)\s+\/FillOrStroke\s*,/.exec(t))) { top.fs = Number(m[1]); continue; }
    if ((m = /^\((.*)\)\s+\/Title\s*,/.exec(t))) { top.title = m[1]; continue; }
    if (/^\/Dict\s*;/.test(t) || t === '; /Dict ;') { inDict = false; continue; }
    if (inDict || /\/(Real|Int|Bool|String)\s+\(/.test(t)) {
      if ((m = /^([-+\d.eE]+)\s+\/(Real|Int|Bool)\s+\((.+)\)\s*,/.exec(t))) { top.dict[m[3]] = m[2] === 'Bool' ? m[1] !== '0' : Number(m[1]); continue; }
      if ((m = /^\((.*)\)\s+\/String\s+\((.+)\)\s*,/.exec(t))) { top.dict[m[2]] = m[1]; continue; }
    }
  }
  close();
  return out;
}

const hex = (c: Color): string => { const { r, g, b } = toRgb(c); const h = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); return `#${h(r)}${h(g)}${h(b)}`; };
const BLEND: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'soft_light', 'hard_light', 'color_dodge', 'color_burn', 'darken', 'lighten', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
const num = (d: StyleNode['dict'], k: string, def: number): number => { const v = d[k]; return typeof v === 'number' && Number.isFinite(v) ? v : def; };
const bool = (d: StyleNode['dict'], k: string, def: boolean): boolean => { const v = d[k]; return typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : def; };

interface Part { items: AppearanceItem[]; effects: Effect[]; opacity: number; blend: BlendMode; conduit: boolean; single: boolean }

export function resolveStyle(def: StyleDef, host: StyleHost): StyleResult {
  const missing: string[] = [], mapped: string[] = [];
  let brushes = 0;
  const colorOf = (n: StyleNode, key: string, dflt: string): string => { const p = n.paints[key] ? host.paint(n.paints[key]).fill : null; return p && p.type === 'color' ? hex(p.color) : dflt; };
  const effectOf = (n: StyleNode): Effect | null => {
    const d = n.dict, nm = n.name.replace(/^Adobe\s+/, '');
    const eff = (id: string, params: Effect['params']): Effect => ({ id, params, visible: n.visible });
    switch (nm) {
      case 'Drop Shadow': {
        if (num(d, 'csrc', 0) === 1) mapped.push('Drop Shadow darkness read as its plain colour');
        return eff('stylize.drop_shadow', { mode: BLEND[Math.round(num(d, 'blnd', 1))] ?? 'multiply', opacity: num(d, 'opac', 0.75) * 100, x: num(d, 'horz', 7), y: num(d, 'vert', 7), blur: num(d, 'blur', 5), color: colorOf(n, 'sclr', '#000000') });
      }
      case 'Outer Glow': return eff('stylize.outer_glow', { mode: BLEND[Math.round(num(d, 'blnd', 2))] ?? 'screen', opacity: num(d, 'opac', 0.75) * 100, blur: num(d, 'blur', 5), color: colorOf(n, 'sclr', '#ffffff') });
      case 'Inner Glow': return eff('stylize.inner_glow', { mode: BLEND[Math.round(num(d, 'blnd', 2))] ?? 'screen', opacity: num(d, 'opac', 0.75) * 100, blur: num(d, 'blur', 5), color: colorOf(n, 'sclr', '#ffffff') });
      case 'Fuzzy Mask': return eff('stylize.feather', { radius: num(d, 'Radius', 5) });
      case 'Round Corners': return eff('stylize.round_corners', { radius: num(d, 'radius', 10) });
      case 'Offset Path': return eff('path.offset', { offset: num(d, 'ofst', 10), joins: ({ 0: 'round', 1: 'bevel', 2: 'miter' } as Record<number, string>)[Math.round(num(d, 'jntp', 2))] ?? 'miter', miter: num(d, 'mlim', 4) });
      case 'Transform': return eff('distort.transform', { scale_h: num(d, 'scaleH_Percent', 100), scale_v: num(d, 'scaleV_Percent', 100), move_h: num(d, 'moveH_Pts', 0), move_v: num(d, 'moveV_Pts', 0), rotate: num(d, 'rotate_Degrees', 0), copies: Math.round(num(d, 'numCopies', 0)), reflect_x: bool(d, 'reflectX', false), reflect_y: bool(d, 'reflectY', false) });
      default: return null;
    }
  };
  const itemOf = (n: StyleNode): AppearanceItem | null => {
    if (n.name === 'Fill Style Filter') {
      const r = host.paint(n.paints.FillStyle ?? []);
      if (!r.fill) return null;
      return { kind: 'fill', paint: r.fill, opacity: 1, blend: 'normal', visible: n.visible, effects: [] };
    }
    const r = host.paint(n.paints.StrokeStyle ?? []);
    if (!r.stroke) return null;
    const s: StrokeItem = { kind: 'stroke', paint: r.stroke, width: r.lw, cap: r.cap, join: r.join, miter: r.miter, align: 'center', dash: r.dash, dashOffset: r.dashOff, dashCorners: false, startArrow: 'none', endArrow: 'none', arrowScale: [100, 100], arrowAlign: 'extend', profile: null, brush: null, opacity: 1, blend: 'normal', visible: n.visible, effects: [] };
    if (n.name === 'Adobe Stroke Offset') s.align = bool(n.dict, 'StrokeOffsetInside', false) ? 'inside' : 'outside';
    return s;
  };
  const empty = (): Part => ({ items: [], effects: [], opacity: 1, blend: 'normal', conduit: false, single: false });
  const walk = (n: StyleNode): Part => {
    if (n.compound && /^Stack/.test(n.name)) {
      const p = empty();
      for (const k of n.kids) { const q = walk(k); p.items.push(...q.items); p.effects.push(...q.effects); p.conduit = p.conduit || q.conduit; }
      return p;
    }
    if (n.compound) {
      const p = empty();
      n.kids.forEach((k, i) => {
        if (i === 0) {
          const q = walk(k);
          Object.assign(p, q);
          p.single = !k.compound && q.items.length === 1;
          return;
        }
        if (k.name === 'Blend Style Filter') {
          const r = host.paint(k.paints.BlendStyle ?? []);
          if (p.single) { p.items[0].opacity = r.opacity; p.items[0].blend = r.blend; } else { p.opacity = r.opacity; p.blend = r.blend; }
          return;
        }
        if (k.name === 'Adobe Calligraphic Brush Tool') {
          const st = p.items.find((x): x is StrokeItem => x.kind === 'stroke');
          if (!st) return;
          st.brush = host.brush('calligraphic', Math.max(0.1, num(k.dict, 'Diameter', 5)), Math.max(0, Math.min(100, num(k.dict, 'Roundness', 100))), -num(k.dict, 'Angle', 0));
          brushes++;
          return;
        }
        if (/^Adobe /.test(k.name)) {
          const e = effectOf(k);
          if (!e) { if (k.visible) missing.push(k.title || k.name.replace(/^Adobe\s+/, '')); return; }
          mapped.push(k.title || k.name.replace(/^Adobe\s+/, ''));
          (p.single ? p.items[0].effects : p.effects).push(e);
          return;
        }
        if (k.compound) { const q = walk(k); p.items.push(...q.items); p.effects.push(...q.effects); }
      });
      return p;
    }
    const p = empty();
    if (n.name === 'Conduit Filter') { p.conduit = true; return p; }
    if (n.name === 'Fill Style Filter' || n.name === 'Stroke Style Filter' || n.name === 'Adobe Stroke Offset') {
      const it = itemOf(n);
      if (it) p.items.push(it);
      if (n.name === 'Adobe Stroke Offset') mapped.push('Stroke Offset');
      return p;
    }
    if (/^Adobe /.test(n.name)) {
      const e = effectOf(n);
      if (e) { p.effects.push(e); mapped.push(n.title || n.name.replace(/^Adobe\s+/, '')); } else if (n.visible) missing.push(n.title || n.name.replace(/^Adobe\s+/, ''));
    }
    return p;
  };
  if (def.simple) {
    const r = host.paint(def.simple);
    const items: AppearanceItem[] = [];
    if (r.fill) items.push({ kind: 'fill', paint: r.fill, opacity: 1, blend: 'normal', visible: true, effects: [] });
    return { ap: { items, effects: [] }, opacity: r.opacity, blend: r.blend, missing, mapped, brushes };
  }
  if (!def.root) return { ap: { items: [], effects: [] }, opacity: 1, blend: 'normal', missing, mapped, brushes };
  const p = walk(def.root);
  // the file lists a stack top first, formpath keeps its items bottom first
  return { ap: { items: p.items.reverse(), effects: p.effects }, opacity: p.opacity, blend: p.blend, missing, mapped, brushes };
}
