import { rotateAbout } from '../engine/geometry';
import { transformNode } from '../engine/transform';
import type { Engine, Mat, PathData, Pt, VNode } from '../engine';
import { attachPlace, planeAt, snapPlane } from '../engine/perspective';
import { registerTool, toolHost, type OptionSpec } from '../extensions/registry';
import { CURSORS } from '../ui/cursors';
import { dragRect, fmt, inView, measureHud, layerColor, unitLabel } from './util';
import { cachedPath } from '../engine/render';

export const pendingShape: { kind: string; at: Pt } = { kind: 'rectangle', at: { x: 0, y: 0 } };

type Kind = 'rectangle' | 'rounded_rectangle' | 'ellipse' | 'polygon' | 'star' | 'flare' | 'line' | 'arc' | 'spiral' | 'rect_grid' | 'polar_grid';
interface State { on: boolean; start: Pt; cur: Pt; shift: boolean; alt: boolean; preview: VNode | null; plane: Engine['perspActive'] }
const S: State = { on: false, start: { x: 0, y: 0 }, cur: { x: 0, y: 0 }, shift: false, alt: false, preview: null, plane: null };

const radial = new Set<Kind>(['polygon', 'star', 'flare', 'spiral']);
const linear = new Set<Kind>(['line', 'arc']);

function build(e: Engine, kind: Kind, a: Pt, b: Pt, square: boolean, center: boolean): VNode | null {
  if (radial.has(kind)) {
    const r = Math.hypot(b.x - a.x, b.y - a.y);
    if (r < 1e-6) return null;
    const ang = square ? 0 : (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;
    const n = e.shapePath(kind, a.x - r, a.y - r, 2 * r, 2 * r);
    return ang && kind !== 'spiral' ? transformNode(n, rotateAbout(ang, a.x, a.y)) : n;
  }
  if (linear.has(kind)) {
    let q = b;
    if (square) { const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), s = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); q = { x: a.x + Math.cos(s) * len, y: a.y + Math.sin(s) * len }; }
    const s0 = center ? { x: 2 * a.x - q.x, y: 2 * a.y - q.y } : a;
    if (Math.hypot(q.x - s0.x, q.y - s0.y) < 1e-6) return null;
    return e.shapePath(kind, s0.x, s0.y, q.x - s0.x, q.y - s0.y, { x2: q.x, y2: q.y });
  }
  const r = dragRect(a, b, square, center);
  if (r.w < 1e-6 && r.h < 1e-6) return null;
  if (kind === 'rect_grid') return e.gridGroup('rectangular', r.x, r.y, r.w, r.h, e.options.gridRows, e.options.gridCols);
  if (kind === 'polar_grid') return e.gridGroup('polar', r.x, r.y, r.w, r.h, e.options.gridRows, e.options.gridCols);
  return e.shapePath(kind, r.x, r.y, r.w, r.h);
}

type OnPlane = NonNullable<Engine['perspActive']>;
const I: Mat = [1, 0, 0, 1, 0, 0];

function planePt(e: Engine, pl: OnPlane, p: Pt, zoom: number): Pt | null {
  const q = planeAt(pl.grid, pl.plane, pl.off, p);
  return q && e.perspView.snap ? snapPlane(pl.grid, pl.plane, pl.off, q, 6 / zoom) : q;
}

function buildOn(e: Engine, pl: OnPlane | null, kind: Kind, a: Pt, b: Pt, square: boolean, center: boolean, zoom: number): VNode | null {
  if (!pl) return build(e, kind, a, b, square, center);
  const pa = planePt(e, pl, a, zoom), pb = planePt(e, pl, b, zoom), d = e.doc;
  if (!pa || !pb || !d) return null;
  const n = build(e, kind, pa, pb, square, center);
  return n ? attachPlace(d, n, pl.grid, { plane: pl.plane, off: pl.off }, I) : null;
}

function geometry(n: VNode): PathData[] {
  if (n.kind === 'path') return [n.d];
  if (n.kind === 'group') return n.children.flatMap(geometry);
  return [];
}

function shapeOptions(kind: Kind, e: Engine): OptionSpec[] {
  const o: OptionSpec[] = [];
  if (kind === 'rounded_rectangle' || kind === 'rectangle') o.push({ kind: 'number', label: 'Corner radius', min: 0, max: 2000, step: 1, unit: 'pt', get: () => e.options.cornerRadius, set: (v) => e.update({ cornerRadius: v }) });
  if (kind === 'polygon') o.push({ kind: 'range', label: 'Sides', min: 3, max: 64, get: () => e.options.polygonSides, set: (v) => e.update({ polygonSides: Math.round(v) }) });
  if (kind === 'star') o.push({ kind: 'range', label: 'Points', min: 3, max: 64, get: () => e.options.starPoints, set: (v) => e.update({ starPoints: Math.round(v) }) }, { kind: 'range', label: 'Inner ratio', min: 5, max: 100, unit: '%', get: () => Math.round(e.options.starRatio * 100), set: (v) => e.update({ starRatio: v / 100 }) });
  if (kind === 'flare') o.push({ kind: 'range', label: 'Rays', min: 3, max: 64, get: () => e.options.flareRays, set: (v) => e.update({ flareRays: Math.round(v) }) });
  if (kind === 'spiral') o.push({ kind: 'range', label: 'Decay', min: 5, max: 150, unit: '%', get: () => Math.round(e.options.spiralDecay * 100), set: (v) => e.update({ spiralDecay: v / 100 }) }, { kind: 'range', label: 'Segments', min: 2, max: 60, get: () => e.options.spiralSegments, set: (v) => e.update({ spiralSegments: Math.round(v) }) });
  if (kind === 'arc') o.push({ kind: 'toggle', label: 'Convex', get: () => e.options.arcConvex, set: (v) => e.update({ arcConvex: v }) });
  if (kind === 'rect_grid' || kind === 'polar_grid') o.push({ kind: 'range', label: kind === 'polar_grid' ? 'Rings' : 'Rows', min: 1, max: 50, get: () => e.options.gridRows, set: (v) => e.update({ gridRows: Math.round(v) }) }, { kind: 'range', label: kind === 'polar_grid' ? 'Dividers' : 'Columns', min: 1, max: 50, get: () => e.options.gridCols, set: (v) => e.update({ gridCols: Math.round(v) }) });
  o.push({ kind: 'segment', label: 'Draw', choices: [{ id: 'normal', label: 'Normal' }, { id: 'behind', label: 'Behind' }, { id: 'inside', label: 'Inside' }], get: () => e.options.shapeMode, set: (v) => e.update({ shapeMode: v as 'normal' | 'behind' | 'inside' }) });
  return o;
}

function shapeTool(id: string, label: string, iconName: string, group: string, order: number, shortcut: string | undefined, kind: Kind, hint: string): void {
  registerTool({
    id, label, group, order, shortcut,
    icon: () => iconName,
    hint: () => hint,
    cursor: () => CURSORS.cross,
    options: (e) => [{ kind: 'title', text: label }, ...shapeOptions(kind, e)],
    hover: (ctx, p) => { if (S.on || ctx.engine.perspActive) return; if (p) ctx.snap(p.doc); else ctx.engine.clearOverlay(); },
    down: (ctx, p) => { S.on = true; S.plane = ctx.engine.perspActive; S.start = S.plane ? p.doc : ctx.snap(p.doc).p; S.cur = S.start; S.preview = null; },
    move: (ctx, p) => {
      if (!S.on) return;
      S.cur = S.plane ? p.doc : ctx.snap(p.doc, undefined, { from: S.start }).p; S.shift = p.shift; S.alt = p.alt;
      S.preview = buildOn(ctx.engine, S.plane, kind, S.start, S.cur, p.shift, p.alt, ctx.view().zoom);
      ctx.redraw();
    },
    up: (ctx, p) => {
      if (!S.on) return;
      S.on = false;
      const e = ctx.engine, z = ctx.view().zoom;
      const moved = Math.hypot(p.doc.x - S.start.x, p.doc.y - S.start.y) * z > 3;
      S.preview = null;
      if (!moved) { pendingShape.kind = kind; pendingShape.at = S.start; toolHost.run('shape-dialog'); ctx.redraw(); return; }
      const n = buildOn(e, S.plane, kind, S.start, S.cur, p.shift, p.alt, z);
      if (n) e.addNodes(label.replace(/ Tool$/, '') + (S.plane ? ' in Perspective' : ''), [n]);
      ctx.redraw();
    },
    cancel: (ctx) => { S.on = false; S.preview = null; ctx.redraw(); },
    keydown: (ctx, e) => {
      if (!S.on || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return false;
      const en = ctx.engine, d = e.key === 'ArrowUp' ? 1 : -1;
      if (kind === 'polygon') en.update({ polygonSides: Math.max(3, Math.min(64, en.options.polygonSides + d)) });
      else if (kind === 'star') en.update({ starPoints: Math.max(3, Math.min(64, en.options.starPoints + d)) });
      else if (kind === 'flare') en.update({ flareRays: Math.max(3, en.options.flareRays + d) });
      else if (kind === 'rect_grid' || kind === 'polar_grid') en.update({ gridRows: Math.max(1, en.options.gridRows + d) });
      else if (kind === 'rounded_rectangle') en.update({ cornerRadius: Math.max(0, en.options.cornerRadius + d) });
      else if (kind === 'spiral') en.update({ spiralSegments: Math.max(2, en.options.spiralSegments + d) });
      else return false;
      S.preview = buildOn(en, S.plane, kind, S.start, S.cur, S.shift, S.alt, ctx.view().zoom);
      ctx.redraw();
      return true;
    },
    overlay: (ctx, g) => {
      if (!S.on || !S.preview) return;
      const color = layerColor(ctx.engine), n = S.preview;
      inView(ctx, g, () => { g.strokeStyle = color; for (const d of geometry(n)) g.stroke(cachedPath(d)); });
      const e = ctx.engine, b = e.boundsOf(n);
      const lines = linear.has(kind)
        ? [`D: ${unitLabel(e, Math.hypot(S.cur.x - S.start.x, S.cur.y - S.start.y))}`, `${fmt((-Math.atan2(S.cur.y - S.start.y, S.cur.x - S.start.x) * 180) / Math.PI)}°`]
        : [`W: ${unitLabel(e, b.w)}`, `H: ${unitLabel(e, b.h)}`];
      measureHud(ctx, g, ctx.view().toScreen(S.cur), lines);
    },
  });
}

shapeTool('rectangle', 'Rectangle Tool', 'vRect', 'shape', 30, 'M', 'rectangle', 'Drag to draw a rectangle. Shift makes a square, Alt draws from the center. Click for exact dimensions.');
shapeTool('roundedRectangle', 'Rounded Rectangle Tool', 'vRoundRect', 'shape', 31, undefined, 'rounded_rectangle', 'Drag to draw a rounded rectangle; Up and Down arrows change the radius while dragging.');
shapeTool('ellipse', 'Ellipse Tool', 'vEllipse', 'shape', 32, 'L', 'ellipse', 'Drag to draw an ellipse. Shift makes a circle, Alt draws from the center.');
shapeTool('polygon', 'Polygon Tool', 'vPolygon', 'shape', 33, undefined, 'polygon', 'Drag from the center to draw a polygon; Up and Down arrows change the number of sides, Shift keeps it upright.');
shapeTool('star', 'Star Tool', 'vStar', 'shape', 34, undefined, 'star', 'Drag from the center to draw a star; Up and Down arrows change the number of points.');
shapeTool('flare', 'Flare Tool', 'vFlare', 'shape', 35, undefined, 'flare', 'Drag from the center to draw a flare.');
shapeTool('line', 'Line Segment Tool', 'vLine', 'line', 25, '\\', 'line', 'Drag to draw a straight line. Shift constrains to 45 degrees, Alt draws from the center.');
shapeTool('arc', 'Arc Tool', 'vArc', 'line', 26, undefined, 'arc', 'Drag to draw an arc.');
shapeTool('spiral', 'Spiral Tool', 'vSpiral', 'line', 27, undefined, 'spiral', 'Drag from the center to draw a spiral; Up and Down arrows change the segments.');
shapeTool('rectGrid', 'Rectangular Grid Tool', 'vRectGrid', 'line', 28, undefined, 'rect_grid', 'Drag to draw a rectangular grid; Up and Down arrows change the rows.');
shapeTool('polarGrid', 'Polar Grid Tool', 'vPolarGrid', 'line', 29, undefined, 'polar_grid', 'Drag to draw a polar grid; Up and Down arrows change the rings.');

export function shapeAt(e: Engine, kind: string, at: Pt, w: number, h: number, fromCenter: boolean): void {
  const x = fromCenter ? at.x - w / 2 : at.x, y = fromCenter ? at.y - h / 2 : at.y;
  const n = kind === 'rect_grid' ? e.gridGroup('rectangular', x, y, w, h, e.options.gridRows, e.options.gridCols)
    : kind === 'polar_grid' ? e.gridGroup('polar', x, y, w, h, e.options.gridRows, e.options.gridCols)
    : kind === 'line' || kind === 'arc' ? e.shapePath(kind, x, y, w, h, { x2: x + w, y2: y + h })
    : e.shapePath(kind, x, y, w, h);
  e.addNodes('Shape', [n]);
}
