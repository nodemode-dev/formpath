import { findNode, layerOf } from '../engine/doc';
import { apply, normRect } from '../engine/geometry';
import { cachedPath } from '../engine/render';
import { layoutText, lineBaseline } from '../engine/text';
import type { Doc, Engine, PathData, Pt, Rect, VNode } from '../engine';
import { dashed, type ToolContext } from '../extensions/registry';

export const tolDoc = (ctx: ToolContext, px = 4): number => px / ctx.view().zoom;

export function dragRect(a: Pt, b: Pt, square: boolean, center: boolean): Rect {
  let dx = b.x - a.x, dy = b.y - a.y;
  if (square) { const s = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * s; dy = Math.sign(dy || 1) * s; }
  return center ? normRect(a.x - dx, a.y - dy, a.x + dx, a.y + dy) : normRect(a.x, a.y, a.x + dx, a.y + dy);
}

export function layerColor(engine: Engine, id?: string | null): string {
  const doc = engine.doc, p = engine.current;
  if (!doc || !p) return '#4f80ff';
  const l = id ? layerOf(doc, id) : (findNode(doc, p.activeLayer) as VNode | null);
  return (l && l.kind === 'layer' ? l.color : null) ?? '#4f80ff';
}

export function inView(ctx: ToolContext, g: CanvasRenderingContext2D, draw: () => void): void {
  const v = ctx.view();
  const s = v.toScreen({ x: 0, y: 0 });
  g.save();
  g.setTransform(v.zoom * v.dpr, 0, 0, v.zoom * v.dpr, s.x * v.dpr, s.y * v.dpr);
  g.lineWidth = 1 / v.zoom;
  draw();
  g.restore();
}

export function strokeDocPath(ctx: ToolContext, g: CanvasRenderingContext2D, d: PathData, color: string, width = 1): void {
  inView(ctx, g, () => { g.lineWidth = width / ctx.view().zoom; g.strokeStyle = color; g.stroke(cachedPath(d)); });
}

export function outlineNode(ctx: ToolContext, g: CanvasRenderingContext2D, doc: Doc, n: VNode, color: string, width = 1): void {
  inView(ctx, g, () => {
    g.lineWidth = width / ctx.view().zoom;
    g.strokeStyle = color;
    const walk = (x: VNode): void => {
      if (x.hidden) return;
      if (x.kind === 'path') g.stroke(cachedPath(x.d));
      else if (x.kind === 'compound') for (const c of x.children) g.stroke(cachedPath(c.d));
      else if (x.kind === 'group' || x.kind === 'layer' || x.kind === 'blend' || x.kind === 'repeat') for (const c of x.children) walk(c);
      else if (x.kind === 'envelope') g.strokeRect(x.frame.x, x.frame.y, x.frame.w, x.frame.h);
      else if (x.kind === 'text') {
        if (x.mode === 'path' && x.path) { g.stroke(cachedPath(x.path)); return; }
        if (x.mode === 'area' && x.frame) { g.strokeRect(x.frame.x, x.frame.y, x.frame.w, x.frame.h); return; }
        g.beginPath();
        const lay = layoutText(x);
        for (const l of lay.lines) { const [p0, p1] = lineBaseline(lay, l), a = apply(x.xf, p0.x, p0.y), b = apply(x.xf, p1.x, p1.y); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
        g.stroke();
      } else if (x.kind === 'image') { g.save(); g.transform(...x.xf); g.lineWidth /= Math.max(1e-6, Math.hypot(x.xf[0], x.xf[1])); g.strokeRect(0, 0, x.w, x.h); g.restore(); }
      else { const b = ctx.engine.boundsOf(x); if (Number.isFinite(b.x)) g.strokeRect(b.x, b.y, b.w, b.h); }
    };
    walk(n);
  });
  void doc;
}

export function marquee(ctx: ToolContext, g: CanvasRenderingContext2D, a: Pt, b: Pt): void {
  const v = ctx.view(), s = v.toScreen(a), t = v.toScreen(b);
  const x = Math.round(Math.min(s.x, t.x)) + 0.5, y = Math.round(Math.min(s.y, t.y)) + 0.5, w = Math.round(Math.abs(t.x - s.x)), h = Math.round(Math.abs(t.y - s.y));
  dashed(ctx, g, () => g.rect(x, y, w, h));
}

export function hud(ctx: ToolContext, g: CanvasRenderingContext2D, at: Pt, lines: string[]): void {
  if (!lines.length) return;
  g.save();
  g.font = '500 11px Inter, system-ui, sans-serif';
  const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 12, h = lines.length * 14 + 8;
  const x = Math.min(at.x + 14, ctx.view().width - w - 4), y = Math.min(at.y + 16, ctx.view().height - h - 4);
  g.fillStyle = 'rgba(30, 30, 30, 0.88)';
  g.beginPath();
  g.roundRect(x, y, w, h, 4);
  g.fill();
  g.fillStyle = '#f2f2f2';
  lines.forEach((l, i) => g.fillText(l, x + 6, y + 15 + i * 14));
  g.restore();
}

export const fmt = (v: number): string => `${Math.round(v * 100) / 100}`;

export function unitLabel(engine: Engine, pt: number): string {
  const u = engine.doc?.units ?? 'pt', k = { pt: 1, px: 1, mm: 72 / 25.4, cm: 72 / 2.54, in: 72, pc: 12 }[u];
  return `${fmt(pt / k)} ${u}`;
}

export function anchorDot(g: CanvasRenderingContext2D, p: Pt, color: string, filled: boolean, r = 3): void {
  g.fillStyle = filled ? color : '#ffffff';
  g.strokeStyle = color;
  g.lineWidth = 1;
  g.fillRect(Math.round(p.x - r), Math.round(p.y - r), r * 2, r * 2);
  g.strokeRect(Math.round(p.x - r) + 0.5, Math.round(p.y - r) + 0.5, r * 2 - 1, r * 2 - 1);
}

export function handleDot(g: CanvasRenderingContext2D, a: Pt, h: Pt, color: string): void {
  g.strokeStyle = color;
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(h.x, h.y); g.stroke();
  g.fillStyle = color;
  g.beginPath(); g.arc(h.x, h.y, 2.5, 0, Math.PI * 2); g.fill();
}

export function stroke2(g: CanvasRenderingContext2D, pts: Pt[], color: string, closed = false): void {
  if (pts.length < 2) return;
  g.save();
  g.strokeStyle = color;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  if (closed) g.closePath();
  g.stroke();
  g.restore();
}
