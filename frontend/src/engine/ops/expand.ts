import { newId } from '../doc';
import { arrowGeometry, brushGeometry, effectDef, effectPath, strokeOutline } from '../effects';
import { boolean, strokeToPath } from '../kernel';
import { emptyAppearance, fill } from '../paint';
import type { Doc, FillRule, PathData, StrokeItem, VNode } from '../types';
import { geometryOf } from './paths';

function shape(d: PathData, rule: FillRule, items: VNode['ap']['items']): VNode {
  if (d.length > 1) return { id: newId('c'), kind: 'compound', rule, children: d.map((sp) => ({ id: newId(), kind: 'path', d: [sp], rule, opacity: 1, blend: 'normal', ap: emptyAppearance() })), opacity: 1, blend: 'normal', ap: { items, effects: [] } };
  return { id: newId('p'), kind: 'path', d, rule, opacity: 1, blend: 'normal', ap: { items, effects: [] } };
}

function strokeParts(doc: Doc, d: PathData, rule: FillRule, s: StrokeItem): VNode[] {
  const out: VNode[] = [];
  const it = fill(s.paint, s.opacity, s.blend);
  if (s.brush) {
    const pieces = brushGeometry(doc, d, s);
    if (pieces) { for (const p of pieces) out.push(shape(p.d, 'nonzero', [fill(p.paint ?? s.paint, s.opacity, s.blend)])); return out; }
  }
  let outline: PathData;
  if (s.profile && s.profile.length) outline = strokeOutline(d, s);
  else {
    const dashed = s.dash.length ? dashPath(d, s.dash, s.dashOffset) : d;
    outline = strokeToPath(dashed, s.width * (s.align === 'center' ? 1 : 2), s.cap, s.join, s.miter);
    if (s.align !== 'center' && d.every((sp) => sp.closed)) outline = s.align === 'inside' ? boolean(outline, d, 'intersect', 'nonzero', rule) : boolean(outline, d, 'subtract', 'nonzero', rule);
  }
  if (outline.length) out.push(shape(outline, 'nonzero', [it]));
  const arrows = arrowGeometry(d, s);
  if (arrows) out.push(shape(arrows, 'nonzero', [it]));
  return out;
}

function dashPath(d: PathData, dash: number[], offset: number): PathData {
  const pattern = dash.length % 2 ? [...dash, ...dash] : dash;
  const total = pattern.reduce((a, b) => a + b, 0);
  if (total <= 0) return d;
  const out: PathData = [];
  for (const sp of d) {
    const segsPts = (() => { const arr: Array<{ x: number; y: number }> = []; const n = sp.pts.length; for (let i = 0; i < (sp.closed ? n : n - 1); i++) { const a = sp.pts[i], b = sp.pts[(i + 1) % n]; for (let k = 0; k <= 16; k++) { const t = k / 16, u = 1 - t; if (i > 0 && k === 0) continue; arr.push({ x: u * u * u * a.x + 3 * u * u * t * a.ox + 3 * u * t * t * b.ix + t * t * t * b.x, y: u * u * u * a.y + 3 * u * u * t * a.oy + 3 * u * t * t * b.iy + t * t * t * b.y }); } } return arr; })();
    const pos = -((offset % total) + total) % total;
    let k = 0, on = true;
    let cur: Array<{ x: number; y: number }> = [];
    let left = pattern[0] + pos;
    while (left <= 0) { k = (k + 1) % pattern.length; on = !on; left += pattern[k]; }
    for (let i = 1; i < segsPts.length; i++) {
      let a = segsPts[i - 1];
      const b = segsPts[i];
      let segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (on && !cur.length) cur.push(a);
      while (segLen > left) {
        const t = left / segLen, m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        if (on) { cur.push(m); out.push({ closed: false, pts: cur.map((p) => ({ x: p.x, y: p.y, ix: p.x, iy: p.y, ox: p.x, oy: p.y })) }); cur = []; }
        else cur = [m];
        segLen -= left; a = m;
        k = (k + 1) % pattern.length; on = !on; left = pattern[k];
      }
      left -= segLen;
      if (on) cur.push(b);
    }
    if (on && cur.length > 1) out.push({ closed: false, pts: cur.map((p) => ({ x: p.x, y: p.y, ix: p.x, iy: p.y, ox: p.x, oy: p.y })) });
  }
  return out;
}

export function expandAppearance(doc: Doc, n: VNode): VNode[] {
  if (n.kind !== 'path' && n.kind !== 'compound') return [n];
  const g = geometryOf(n);
  if (!g) return [n];
  const vectorFx = n.ap.effects.filter((e) => e.visible && !effectDef(e.id)?.raster);
  const rasterFx = n.ap.effects.filter((e) => e.visible && effectDef(e.id)?.raster);
  const base = effectPath(g.d, vectorFx);
  const parts: VNode[] = [];
  for (const it of n.ap.items) {
    if (!it.visible || it.paint.type === 'none') continue;
    const d = effectPath(base, it.effects);
    if (it.kind === 'fill') parts.push(shape(d, g.rule, [{ ...it, effects: [] }]));
    else parts.push(...strokeParts(doc, d, g.rule, it));
  }
  if (!parts.length) return [];
  if (parts.length === 1 && !rasterFx.length && n.opacity === 1 && n.blend === 'normal') return [{ ...parts[0], name: n.name }];
  return [{ id: newId('g'), kind: 'group', clip: false, children: parts, opacity: n.opacity, blend: n.blend, ap: { items: [], effects: rasterFx }, name: n.name }];
}
