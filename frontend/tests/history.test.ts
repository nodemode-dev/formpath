import { afterEach, describe, expect, it } from 'vitest';
import { Engine } from '../src/engine';
import { findNode } from '../src/engine/doc';
import { History } from '../src/engine/history';
import { rectPath } from '../src/engine/geometry';
import { basicAppearance, rgb, solid } from '../src/engine/paint';
import type { Doc, PathNode, VNode } from '../src/engine/types';

const LIMIT = History.limit;
afterEach(() => { History.limit = LIMIT; });

function engine(): Engine {
  const e = new Engine();
  e.newDocument(400, 400);
  e.addNodes('Rect', [{ id: 'r', kind: 'path', d: rectPath(10, 10, 50, 40), rule: 'nonzero', opacity: 1, blend: 'normal', ap: basicAppearance(solid(rgb(200, 0, 0)), solid(rgb(0, 0, 0)), 1) } as PathNode]);
  return e;
}

const all = (d: Doc): VNode[] => {
  const out: VNode[] = [];
  const walk = (ns: VNode[]): void => { for (const n of ns) { out.push(n); if ('children' in n && Array.isArray(n.children)) walk(n.children as VNode[]); } };
  walk(d.layers as unknown as VNode[]);
  return out;
};

const named = (d: Doc, prefix: string): VNode[] => all(d).filter((n) => typeof n.name === 'string' && n.name.startsWith(prefix));

function editInside(e: Engine, group: string, times: number): void {
  for (let i = 0; i < times; i++) {
    e.select([group]);
    expect(e.moveBy(1, 0)).toBe(true);
  }
}

describe('cancelling an isolation edit longer than the history', () => {
  it('Cancel on a symbol edit restores the document from before the edit', () => {
    const e = engine();
    e.setHistoryLimit(20);
    e.makeSymbol('Box', ['r']);
    const p = e.current!;
    const inst = all(p.doc).find((n) => n.kind === 'symbol')!;
    const before = p.doc;
    expect(e.enterSymbolEdit(null, inst.id)).toBe(true);
    const group = p.symbolEdit!.group;
    expect((findNode(p.doc, inst.id) as VNode).hidden).toBe(true);
    editInside(e, group, 25);
    e.exitSymbolEdit(false);
    expect(findNode(p.doc, group)).toBeNull();
    expect((findNode(p.doc, inst.id) as VNode).hidden).toBeFalsy();
    expect(named(p.doc, 'Symbol:')).toHaveLength(0);
    expect(p.doc.symbols).toEqual(before.symbols);
    expect(p.history.canRedo).toBe(false);
  });

  it('Cancel on a pattern edit removes the tile group', () => {
    const e = engine();
    e.setHistoryLimit(20);
    const p = e.current!;
    const before = p.doc;
    expect(e.enterPatternEdit(null, ['r'])).toBe(true);
    const group = p.patternEdit!.group;
    editInside(e, group, 25);
    expect(e.exitPatternEdit(false)).toBeNull();
    expect(findNode(p.doc, group)).toBeNull();
    expect(named(p.doc, 'Pattern Tile')).toHaveLength(0);
    expect(p.doc.patterns).toEqual(before.patterns);
    expect(findNode(p.doc, 'r')).not.toBeNull();
  });

  it('Cancel within the history limit still rewinds as before', () => {
    const e = engine();
    e.setHistoryLimit(20);
    const p = e.current!;
    const steps = p.history.steps().names.length;
    expect(e.enterPatternEdit(null, ['r'])).toBe(true);
    editInside(e, p.patternEdit!.group, 3);
    e.exitPatternEdit(false);
    expect(named(p.doc, 'Pattern Tile')).toHaveLength(0);
    expect(p.history.steps().names.length).toBe(steps);
  });

  it('a rewind to a dropped mark with a saved state lands on that state and keeps marks stable', () => {
    History.limit = 5;
    const h = new History({ layers: [] } as unknown as Doc);
    const docs = Array.from({ length: 12 }, (_, i) => ({ layers: [], n: i } as unknown as Doc));
    h.push('a', docs[0], []);
    const mark = h.mark(), saved = h.current;
    for (let i = 1; i < 12; i++) h.push(`s${i}`, docs[i], []);
    expect(h.rewind(mark)).toBeNull();
    const st = h.rewind(mark, saved);
    expect(st?.doc).toBe(docs[0]);
    expect(h.current.doc).toBe(docs[0]);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.mark()).toBe(mark);
  });
});
