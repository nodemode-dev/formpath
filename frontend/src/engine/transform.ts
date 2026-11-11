import { mapMeshSpec, meshFromMapper } from './envelope';
import { apply, applyPt, cornerScale, isIdentity, matScale, mul, transformPath } from './geometry';
import { liveShapePath, normalizeLive } from './ops/live-shapes';
import { envelopeMapper } from './live';
import { dimHandles, dimOffsetFor } from './dimension';
import { transformIntertwine } from './intertwine';
import { mapShaper } from './shaper';
import { xfGraph } from './graph';
import type { Appearance, AppearanceItem, DimensionSpec, Gradient, LiveShape, Mat, Paint, VNode } from './types';

function xfDim(s: DimensionSpec, m: Mat): DimensionSpec {
  const h = dimHandles(s).find((x) => x.which === -1), next = { ...s, pts: s.pts.map((p) => applyPt(m, p)) };
  return h ? { ...next, offset: dimOffsetFor(next, applyPt(m, h.at)) } : next;
}

export function boxAngle(prev: number | undefined, m: Mat): number | undefined {
  const t = ((prev ?? 0) * Math.PI) / 180, ux = Math.cos(t), uy = Math.sin(t);
  const a = (Math.atan2(m[1] * ux + m[3] * uy, m[0] * ux + m[2] * uy) * 180) / Math.PI;
  const r = ((((a + 45) % 90) + 90) % 90) - 45;
  return Math.abs(r) < 0.01 ? undefined : r;
}

export interface XfOpts { strokes?: boolean; patterns?: boolean; gradients?: boolean }

function xfGradient(g: Gradient, m: Mat): Gradient {
  if (!g.geom) return g.points?.length ? { ...g, points: g.points.map((p) => ({ ...p, ...applyPt(m, p), spread: p.spread * matScale(m) })) } : g;
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
  const ang = boxAngle(n.bbox, m);
  const base = { ...n, ap, ...(n.mask !== undefined ? { mask } : {}), ...(ang !== undefined ? { bbox: ang } : n.bbox !== undefined ? { bbox: undefined } : {}) };
  switch (n.kind) {
    case 'path': {
      if (n.live?.kind === 'rect' && !cornerScale.on) {
        const kept = normalizeLive(n.live), moved = normalizeLive(xfLive(n.live, m));
        const live = kept.kind === 'rect' && moved.kind === 'rect' ? { ...moved, radii: kept.radii } : moved;
        return { ...base, d: liveShapePath(live), live } as T;
      }
      return { ...base, d: transformPath(n.d, m), ...(n.live ? { live: xfLive(n.live, m) } : {}) } as T;
    }
    case 'compound': return { ...base, children: n.children.map((c) => transformNode(c, m, o)) } as T;
    case 'text':
      if (n.mode === 'path') return { ...base, path: n.path ? transformPath(n.path, m) : n.path, spans: o.strokes ? n.spans : n.spans } as T;
      return { ...base, xf: mul(m, n.xf) } as T;
    case 'image': return { ...base, xf: mul(m, n.xf), ...(n.warp ? { warp: { ...n.warp, pts: n.warp.pts.map((p) => applyPt(m, p)) } } : {}) } as T;
    case 'symbol': return { ...base, xf: mul(m, n.xf) } as T;
    case 'mesh': return { ...base, points: n.points.map((p) => { const q = apply(m, p.x, p.y); const hs = p.h.map((h) => { const a = apply(m, p.x + h.x, p.y + h.y); return { x: a.x - q.x, y: a.y - q.y }; }) as [typeof p.h[0], typeof p.h[0], typeof p.h[0], typeof p.h[0]]; return { ...p, x: q.x, y: q.y, h: hs }; }) } as T;
    case 'group': return { ...base, children: n.children.map((c) => transformNode(c, m, o)), ...(n.dim ? { dim: xfDim(n.dim, m) } : {}), ...(n.graph ? { graph: xfGraph(n.graph, m) } : {}), ...(n.intertwine ? { intertwine: transformIntertwine(n.intertwine, m) } : {}), ...(n.shaper ? { shaper: mapShaper(n.shaper, (p) => applyPt(m, p), (pp) => xfPaint(pp, m, o)) } : {}), ...(n.trace ? { trace: { ...n.trace, src: transformNode(n.trace.src, m, o) } } : {}), ...(n.livePaint ? { livePaint: { ...n.livePaint, fills: n.livePaint.fills.map((f) => ({ at: apply(m, f.at.x, f.at.y), paint: xfPaint(f.paint, m, o) })) } } : {}) } as T;
    case 'layer': return { ...base, children: n.children.map((c) => transformNode(c, m, o)) } as T;
    case 'blend': return { ...base, children: n.children.map((c) => transformNode(c, m, o)), spec: { ...n.spec, spine: n.spec.spine ? transformPath(n.spec.spine, m) : null } } as T;
    case 'envelope': {
      if (!(Math.abs(m[1]) < 1e-9 && Math.abs(m[2]) < 1e-9 && m[0] > 0 && m[3] > 0)) {
        const s = n.spec.kind === 'mesh' ? n.spec : meshFromMapper(n.frame, 6, 6, envelopeMapper(n));
        return { ...base, spec: mapMeshSpec(s, (p) => applyPt(m, p)) } as T;
      }
      const spec = n.spec.kind === 'mesh' ? { ...n.spec, points: n.spec.points.map((p) => applyPt(m, p)), ...(n.spec.h ? { h: n.spec.h.map((hs) => hs.map((h) => ({ x: h.x * m[0], y: h.y * m[3] }))) as typeof n.spec.h } : {}) } : n.spec.kind === 'top' ? { ...n.spec, shape: transformPath(n.spec.shape, m) } : n.spec;
      const tl = apply(m, n.frame.x, n.frame.y), br = apply(m, n.frame.x + n.frame.w, n.frame.y + n.frame.h);
      return { ...base, children: n.children.map((c) => transformNode(c, m, o)), spec, frame: { x: Math.min(tl.x, br.x), y: Math.min(tl.y, br.y), w: Math.abs(br.x - tl.x), h: Math.abs(br.y - tl.y) } } as T;
    }
    case 'repeat': {
      const s = n.spec;
      const spec = s.kind === 'radial' ? (() => { const c = apply(m, s.cx, s.cy); return { ...s, cx: c.x, cy: c.y, radius: s.radius * matScale(m) }; })() : s.kind === 'mirror' ? (() => { const c = apply(m, s.cx, s.cy), a = (s.angle * Math.PI) / 180, vx = m[0] * -Math.sin(a) + m[2] * Math.cos(a), vy = m[1] * -Math.sin(a) + m[3] * Math.cos(a); return { ...s, cx: c.x, cy: c.y, angle: (Math.atan2(-vx, vy) * 180) / Math.PI }; })() : s;
      return { ...base, children: n.children.map((c) => transformNode(c, m, o)), spec } as T;
    }
  }
}
