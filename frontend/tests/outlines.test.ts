import { beforeAll, describe, expect, it } from 'vitest';
import { Engine } from '../src/engine';
import { findNode } from '../src/engine/doc';
import { pathBounds } from '../src/engine/geometry';
import { textNode } from '../src/engine/text';
import { outlineText } from '../src/io/fonts';
import type { PathData, TextNode } from '../src/engine/types';
import { useBundledFonts } from './helpers';

beforeAll(useBundledFonts);

const text = (s: string, size = 100, font = 'Inter'): TextNode => ({ id: 't1', ...textNode(s, 20, 120, { font, style: 'Regular', size }) }) as TextNode;

describe('text to outlines', () => {
  it('turns every glyph into closed contours', async () => {
    const d = (await outlineText(text('Hag'))) as PathData;
    expect(d.length).toBeGreaterThanOrEqual(3);
    expect(d.every((sp) => sp.closed && sp.pts.length >= 3)).toBe(true);
  });

  it('places the outlines where the type sits and at the size asked for', async () => {
    const d = (await outlineText(text('H', 100))) as PathData;
    const b = pathBounds(d);
    expect(b.x).toBeGreaterThan(20);
    expect(b.y + b.h).toBeCloseTo(120, 0);
    expect(b.h).toBeGreaterThan(60);
    expect(b.h).toBeLessThan(80);
  });

  it('scales with the font size', async () => {
    const small = pathBounds((await outlineText(text('H', 50))) as PathData);
    const large = pathBounds((await outlineText(text('H', 100))) as PathData);
    expect(large.h / small.h).toBeCloseTo(2, 1);
  });

  it('gives a letter with a counter an extra contour', async () => {
    const o = (await outlineText(text('O'))) as PathData;
    const l = (await outlineText(text('l'))) as PathData;
    expect(o).toHaveLength(2);
    expect(l).toHaveLength(1);
  });

  it('skips spaces and gives a blank string no contours', async () => {
    expect(await outlineText(text('   '))).toEqual([]);
    const spaced = (await outlineText(text('a b'))) as PathData;
    const tight = (await outlineText(text('ab'))) as PathData;
    expect(spaced).toHaveLength(tight.length);
  });

  it('answers null when the font cannot be loaded, so nothing is replaced with nothing', async () => {
    expect(await outlineText(text('Hag', 100, 'No Such Family 123'))).toBeNull();
  });

  it('Create Outlines replaces the type with a compound of closed paths and keeps one undo step', async () => {
    const e = new Engine();
    const p = e.newDocument(300, 200);
    const [id] = e.addNodes('Type', [{ id: 'tx', ...textNode('Go', 10, 100, { font: 'Inter', style: 'Regular', size: 80 }) } as TextNode], {});
    expect(findNode(p.doc, id)?.kind).toBe('text');
    expect(await e.createOutlines(outlineText, [id])).toBe(true);
    const made = findNode(e.current!.doc, e.current!.doc.layers[0].children[0].id);
    expect(made?.kind).toBe('compound');
    if (made?.kind !== 'compound') return;
    expect(made.children.length).toBeGreaterThanOrEqual(3);
    expect(made.children.every((c) => c.d.every((sp) => sp.closed))).toBe(true);
    expect(e.current!.doc.layers[0].children.some((n) => n.kind === 'text')).toBe(false);
    e.undo();
    expect(e.current!.doc.layers[0].children[0].kind).toBe('text');
  });

  it('Create Outlines leaves the type alone when the font is missing', async () => {
    const e = new Engine();
    const p = e.newDocument(300, 200);
    const [id] = e.addNodes('Type', [{ id: 'tx', ...textNode('Go', 10, 100, { font: 'No Such Family 123', style: 'Regular', size: 80 }) } as TextNode], {});
    expect(await e.createOutlines(outlineText, [id])).toBe(false);
    expect(findNode(p.doc, id)?.kind).toBe('text');
  });
});
