import { apply, applyPt, isIdentity, matScale, mul, transformPath } from './geometry';
import type { Appearance, AppearanceItem, Gradient, LiveShape, Mat, Paint, VNode } from './types';

export interface XfOpts { strokes?: boolean; patterns?: boolean; gradients?: boolean }

function xfGradient(g: Gradient, m: Mat): Gradient {
  if (!g.geom) return g;
  const a = apply(m, g.geom.x1, g.geom.y1), b = apply(m, g.geom.x2, g.geom.y2);
  const f = g.geom.fx !== undefined && g.geom.fy !== undefined ? apply(m, g.geom.fx, g.geom.fy) : null;
  return { ...g, geom: { x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...(f ? { fx: f.x, fy: f.y } : {}) }, points: g.points?.map((p) => ({ ...p, ...applyPt(m, p) })) };
}
function xfPaint(p: Paint, m: Mat, o: XfOpts): Paint {
  if (p.type === 'gradient' && o.gradients !== false) return { ...p, gradient: xfGradient(p.gradient, m) };
  if (p.type === 'pattern' && o.patterns) return { ...p, xf: mul(m, p.xf) };
  return p;
}
function xfItem(it: AppearanceItem, m: Mat, o: XfOpts): AppearanceItem {
  if (it.kind === 'fill') return { ...it, paint: xfPaint(it.paint, m, o) };
  return { ...it, paint: xfPaint(it.paint, m, o), width: o.strokes ? it.width * matScale(m) : it.width };
}
export function xfAppearance(ap: Appearance, m: Mat, o: XfOpts): Appearance { return { ...ap, items: ap.items.map((i) => xfItem(i, m, o)) }; }

function xfLive(l: LiveShape, m: Mat): LiveShape {
  if (l.kind === 'line') { const a = apply(m, l.x1, l.y1), b = apply(m, l.x2, l.y2); return { kind: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y }; }
  return { ...l, xf: mul(m, l.xf) };
}

export function transformNode<T extends VNode>(n: T, m: Mat, o: XfOpts = { strokes: true, patterns: true, gradients: true }): T {
  if (isIdentity(m)) return n;
  const ap = xfAppearance(n.ap, m, o);
  const mask = n.mask ? { ...n.mask, art: n.mask.linked ? transformNode(n.mask.art, m, o) : n.mask.art } : n.mask;
  const base = { ...n, ap, ...(n.mask !== undefined ? { mask } : {}) };
  switch (n.kind) {
    case 'path': return { ...base, d: transformPath(n.d, m), ...(n.live ? { live: xfLive(n.live, m) } : {}) } as T;
    case 'compound': return { ...base, children: n.children.map((c) => transformNode(c, m, o)) } as T;
    case 'text':
      if (n.mode === 'path') return { ...base, path: n.path ? transformPath(n.path, m) : n.path, spans: o.strokes ? n.spans : n.spans } as T;
      return { ...base, xf: mul(m, n.xf) } as T;
    case 'image': case 'symbol': return { ...base, xf: mul(m, n.xf) } as T;
    case 'mesh': return { ...base, points: n.points.map((p) => { const q = apply(m, p.x, p.y); const hs = p.h.map((h) => { const a = apply(m, p.x + h.x, p.y + h.y); return { x: a.x - q.x, y: a.y - q.y }; }) as [typeof p.h[0], typeof p.h[0], typeof p.h[0], typeof p.h[0]]; return { ...p, x: q.x, y: q.y, h: hs }; }) } as T;
    case 'group': case 'layer': return { ...base, children: n.children.map((c) => transformNode(c, m, o)) } as T;
    case 'blend': return { ...base, children: n.children.map((c) => transformNode(c, m, o)), spec: { ...n.spec, spine: n.spec.spine ? transformPath(n.spec.spine, m) : null } } as T;
    case 'envelope': {
      const spec = n.spec.kind === 'mesh' ? { ...n.spec, points: n.spec.points.map((p) => applyPt(m, p)) } : n.spec.kind === 'top' ? { ...n.spec, shape: transformPath(n.spec.shape, m) } : n.spec;
      const tl = apply(m, n.frame.x, n.frame.y), br = apply(m, n.frame.x + n.frame.w, n.frame.y + n.frame.h);
      return { ...base, children: n.children.map((c) => transformNode(c, m, o)), spec, frame: { x: Math.min(tl.x, br.x), y: Math.min(tl.y, br.y), w: Math.abs(br.x - tl.x), h: Math.abs(br.y - tl.y) } } as T;
    }
    case 'repeat': {
      const s = n.spec;
      const spec = s.kind === 'radial' ? (() => { const c = apply(m, s.cx, s.cy); return { ...s, cx: c.x, cy: c.y, radius: s.radius * matScale(m) }; })() : s.kind === 'mirror' ? (() => { const c = apply(m, s.cx, s.cy); return { ...s, cx: c.x, cy: c.y }; })() : s;
      return { ...base, children: n.children.map((c) => transformNode(c, m, o)), spec } as T;
    }
  }
}
