import { geomBounds } from '../bounds';
import { applyH, homography, isAffineH, mapMeshSpec, mapPathAdaptive, meshFromMapper, type Mapper } from '../envelope';
import { isEmptyRect } from '../geometry';
import { envelopeFrame, envelopeMapper } from '../live';
import { emptyAppearance } from '../paint';
import { mapShaper } from '../shaper';
import type { Appearance, Doc, EnvelopeNode, Pt, VNode } from '../types';

export interface DistortOpts { affine: boolean; tol: number; envId: (id: string) => string; bend?: boolean; grid?: number }

function mapGradients(ap: Appearance, f: Mapper): Appearance {
  if (!ap.items.some((i) => i.paint.type === 'gradient' && i.paint.gradient.geom)) return ap;
  return { ...ap, items: ap.items.map((it) => {
    if (it.paint.type !== 'gradient' || !it.paint.gradient.geom) return it;
    const g = it.paint.gradient.geom, a = f({ x: g.x1, y: g.y1 }), b = f({ x: g.x2, y: g.y2 }), c = g.fx !== undefined && g.fy !== undefined ? f({ x: g.fx, y: g.fy }) : null;
    return { ...it, paint: { ...it.paint, gradient: { ...it.paint.gradient, geom: { x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...(c ? { fx: c.x, fy: c.y } : {}) } } } };
  }) };
}

export function distortNode(doc: Doc, n: VNode, f: Mapper, o: DistortOpts): VNode {
  switch (n.kind) {
    case 'path': return { ...n, d: mapPathAdaptive(n.d, f, o.tol, !o.bend), live: undefined, bbox: undefined, ap: mapGradients(n.ap, f) };
    case 'compound': return { ...n, bbox: undefined, ap: mapGradients(n.ap, f), children: n.children.map((c) => ({ ...c, d: mapPathAdaptive(c.d, f, o.tol, !o.bend), live: undefined })) };
    case 'group': return { ...n, bbox: undefined, children: n.children.map((c) => distortNode(doc, c, f, o)), ...(n.livePaint ? { livePaint: { ...n.livePaint, fills: n.livePaint.fills.map((x) => ({ ...x, at: f(x.at) })) } } : {}), ...(n.dim ? { dim: { ...n.dim, pts: n.dim.pts.map(f) } } : {}), ...(n.intertwine ? { intertwine: { zones: n.intertwine.zones.map((z) => ({ ...z, d: mapPathAdaptive(z.d, f, o.tol, true) })) } } : {}), ...(n.shaper ? { shaper: mapShaper(n.shaper, f) } : {}) };
    case 'blend': return { ...n, bbox: undefined, children: n.children.map((c) => distortNode(doc, c, f, o)), spec: { ...n.spec, spine: n.spec.spine ? mapPathAdaptive(n.spec.spine, f, o.tol, true) : null } };
    case 'repeat': return { ...n, bbox: undefined, children: n.children.map((c) => distortNode(doc, c, f, o)) };
    case 'mesh': {
      const e = 1e-4;
      return { ...n, bbox: undefined, points: n.points.map((p) => {
        const q = f(p);
        return { ...p, x: q.x, y: q.y, h: p.h.map((h) => { if (Math.abs(h.x) + Math.abs(h.y) < 1e-12) return h; const z = f({ x: p.x + h.x * e, y: p.y + h.y * e }); return { x: (z.x - q.x) / e, y: (z.y - q.y) / e }; }) as typeof p.h };
      }) };
    }
    case 'envelope': {
      const fr = envelopeFrame(doc, n), s = n.spec.kind === 'mesh' ? n.spec : meshFromMapper(fr, 6, 6, envelopeMapper(n, fr));
      return { ...n, bbox: undefined, frame: fr, spec: mapMeshSpec(s, f) };
    }
    case 'text': case 'image': case 'symbol': {
      const fr = geomBounds(doc, n);
      if (isEmptyRect(fr) || fr.w < 1e-6 || fr.h < 1e-6) return n;
      const k = o.affine ? 1 : o.grid ?? 4;
      const env: EnvelopeNode = { id: o.envId(n.id), kind: 'envelope', children: [n], spec: meshFromMapper(fr, k, k, f), frame: fr, opacity: 1, blend: 'normal', ap: emptyAppearance() };
      return env;
    }
    default: return n;
  }
}

export function quadDistort(doc: Doc, nodes: VNode[], from: Pt[], to: Pt[], envId: (id: string) => string): VNode[] {
  const H = homography(from, to), size = Math.max(...from.map((p) => Math.hypot(p.x - from[0].x, p.y - from[0].y)), 1);
  const f: Mapper = (p) => applyH(H, p), opts: DistortOpts = { affine: isAffineH(H, size), tol: Math.max(0.02, size * 2e-4), envId };
  return nodes.map((n) => distortNode(doc, n, f, opts));
}
