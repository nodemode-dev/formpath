import { describe, expect, it } from 'vitest';
import { newDoc } from '../src/engine/doc';
import { ellipsePath, pathBounds, rectPath } from '../src/engine/geometry';
import { area, contains } from '../src/engine/kernel';
import { pathfinder } from '../src/engine/ops/paths';
import { anchorCount } from '../src/engine/ops/illustrator';
import { geometryOf } from '../src/engine/pathfinder';
import { childrenOf } from '../src/engine/doc';
import { emptyAppearance } from '../src/engine/paint';
import type { Doc, PathData, PathNode, VNode } from '../src/engine/types';

function shape(id: string, d: PathData): PathNode {
  return { id, kind: 'path', d, rule: 'nonzero', opacity: 1, blend: 'normal', ap: emptyAppearance() };
}

function setup(...shapes: PathNode[]): Doc {
  const doc = newDoc(400, 400);
  return { ...doc, layers: [{ ...doc.layers[0], children: shapes }] };
}

function leaves(nodes: VNode[]): VNode[] {
  return nodes.flatMap((n) => (n.kind === 'group' ? leaves(childrenOf(n) ?? []) : [n]));
}

function filled(d: PathData): number {
  return d.reduce((sum, sp, i) => {
    const b = pathBounds([sp]);
    const hole = d.some((o, j) => {
      const ob = pathBounds([o]);
      return j !== i && ob.x < b.x && ob.y < b.y && ob.x + ob.w > b.x + b.w && ob.y + ob.h > b.y + b.h && contains([o], 'nonzero', sp.pts[0]);
    });
    return sum + (hole ? -1 : 1) * area([sp]);
  }, 0);
}

function run(doc: Doc, op: Parameters<typeof pathfinder>[2]): { nodes: VNode[]; doc: Doc; area: number; anchors: number } {
  const ids = (doc.layers[0].children as VNode[]).map((n) => n.id);
  const out = pathfinder(doc, ids, op);
  const nodes = leaves(out.doc.layers[0].children as VNode[]);
  const total = nodes.reduce((s, n) => s + filled(geometryOf(n)?.d ?? []), 0);
  return { nodes, doc: out.doc, area: total, anchors: anchorCount(out.doc, nodes.map((n) => n.id)) };
}

const overlapping = (): Doc => setup(shape('a', rectPath(0, 0, 100, 100)), shape('b', rectPath(50, 50, 100, 100)));
const closeTo = (v: number, want: number, tol = 0.01): void => expect(Math.abs(v - want)).toBeLessThan(tol);

describe('pathfinder on two overlapping squares', () => {
  it('unite gives one outline of 17500 square points and 8 anchors', () => {
    const r = run(overlapping(), 'unite');
    expect(r.nodes).toHaveLength(1);
    closeTo(r.area, 17500);
    expect(r.anchors).toBe(8);
  });

  it('intersect gives the 50 by 50 overlap with 4 anchors', () => {
    const r = run(overlapping(), 'intersect');
    expect(r.nodes).toHaveLength(1);
    closeTo(r.area, 2500);
    expect(r.anchors).toBe(4);
  });

  it('minus front removes the top square from the bottom one, leaving an L of 7500 and 6 anchors', () => {
    const r = run(overlapping(), 'minus_front');
    expect(r.nodes).toHaveLength(1);
    closeTo(r.area, 7500);
    expect(r.anchors).toBe(6);
  });

  it('minus back removes the bottom square from the top one', () => {
    const r = run(overlapping(), 'minus_back');
    expect(r.nodes).toHaveLength(1);
    closeTo(r.area, 7500);
    expect(r.anchors).toBe(6);
  });

  it('exclude drops the overlap: 15000 in two L shapes with 12 anchors', () => {
    const r = run(overlapping(), 'exclude');
    closeTo(r.area, 15000);
    expect(r.anchors).toBe(12);
  });

  it('divide cuts the artwork into three faces that add up to the union', () => {
    const r = run(overlapping(), 'divide');
    expect(r.nodes).toHaveLength(3);
    closeTo(r.area, 17500);
  });
});

describe('pathfinder edge cases', () => {
  it('disjoint squares: unite keeps both, intersect leaves nothing', () => {
    const apart = (): Doc => setup(shape('a', rectPath(0, 0, 50, 50)), shape('b', rectPath(200, 200, 50, 50)));
    closeTo(run(apart(), 'unite').area, 5000);
    expect(run(apart(), 'intersect').nodes).toHaveLength(0);
  });

  it('a circle minus a smaller concentric circle is a ring with a hole', () => {
    const r = run(setup(shape('a', ellipsePath(0, 0, 200, 200)), shape('b', ellipsePath(50, 50, 100, 100))), 'minus_front');
    expect(r.nodes).toHaveLength(1);
    const want = Math.PI * (100 * 100 - 50 * 50);
    expect(Math.abs(r.area - want) / want).toBeLessThan(0.002);
  });

  it('a square fully inside another: unite is the outer one, intersect the inner one', () => {
    const nested = (): Doc => setup(shape('a', rectPath(0, 0, 100, 100)), shape('b', rectPath(25, 25, 50, 50)));
    closeTo(run(nested(), 'unite').area, 10000);
    closeTo(run(nested(), 'intersect').area, 2500);
  });

  it('a single object is left alone by the two-input operations', () => {
    const doc = setup(shape('a', rectPath(0, 0, 100, 100)));
    const r = run(doc, 'unite');
    expect(r.nodes).toHaveLength(1);
    expect(r.nodes[0].id).toBe('a');
  });
});
