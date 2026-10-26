import { beforeAll, describe, expect, it } from 'vitest';
import { Engine } from '../src/engine';
import { allNodes } from '../src/engine/doc';
import { pathBounds } from '../src/engine/geometry';
import { area } from '../src/engine/kernel';
import { exportSvg, importSvg } from '../src/io/svg';
import type { PathNode, VNode } from '../src/engine/types';
import { ellipsePath, rectPath } from '../src/engine/geometry';
import { basicAppearance, solid, rgb } from '../src/engine/paint';
import { useBundledFonts, useXmlParser } from './helpers';
import { textNode } from '../src/engine/text';

beforeAll(() => {
  useXmlParser();
  useBundledFonts();
});

const OPTS = { artboard: 0 as const, outlineText: false, preserve: false, precision: 4 };

function paths(doc: { layers: VNode[] }): PathNode[] {
  return allNodes(doc as never).filter((n): n is PathNode => n.kind === 'path');
}

function drawn(): Engine {
  const e = new Engine();
  e.newDocument(400, 300);
  const ap = (r: number, g: number, b: number) => basicAppearance(solid(rgb(r, g, b)), solid(rgb(0, 0, 0)), 2);
  e.addNodes('Rect', [{ id: 'r1', kind: 'path', d: rectPath(20, 30, 100, 60), rule: 'nonzero', opacity: 1, blend: 'normal', ap: ap(255, 0, 0) } as PathNode]);
  e.addNodes('Circle', [{ id: 'c1', kind: 'path', d: ellipsePath(200, 100, 80, 80), rule: 'nonzero', opacity: 1, blend: 'normal', ap: ap(0, 128, 255) } as PathNode]);
  return e;
}

const closeTo = (a: number, b: number, tol: number): void => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('SVG export then import', () => {
  it('keeps the artboard size', async () => {
    const e = drawn();
    const svg = await exportSvg(e.current!, OPTS);
    expect(svg).toMatch(/width="400"/);
    expect(svg).toMatch(/height="300"/);
    const back = await importSvg(svg, 'again');
    expect(back.native).toBe(false);
    expect(back.doc.artboards[0].w).toBe(400);
    expect(back.doc.artboards[0].h).toBe(300);
  });

  it('keeps every shape inside half a point of where it was drawn, with the same area', async () => {
    const e = drawn();
    const before = paths(e.current!.doc);
    const back = await importSvg(await exportSvg(e.current!, OPTS), 'again');
    const after = paths(back.doc);
    expect(after).toHaveLength(before.length);
    before.forEach((p, i) => {
      const a = pathBounds(p.d), b = pathBounds(after[i].d);
      for (const k of ['x', 'y', 'w', 'h'] as const) closeTo(a[k], b[k], 0.5);
      closeTo(area(p.d), area(after[i].d), area(p.d) * 0.005);
    });
  });

  it('keeps the fill and stroke colours and the stroke width', async () => {
    const e = drawn();
    const svg = await exportSvg(e.current!, OPTS);
    expect(svg.toLowerCase()).toContain('#ff0000');
    expect(svg.toLowerCase()).toContain('#0080ff');
    const back = paths((await importSvg(svg, 'again')).doc);
    const stroke = back[0].ap.items.find((i) => i.kind === 'stroke');
    expect(stroke && stroke.kind === 'stroke' ? stroke.width : 0).toBeCloseTo(2, 2);
  });

  it('with preserve on, reopening gives the editable document back', async () => {
    const e = drawn();
    const back = await importSvg(await exportSvg(e.current!, { ...OPTS, preserve: true }), 'again');
    expect(back.native).toBe(true);
    expect(back.doc.layers).toEqual(e.current!.doc.layers);
    expect(back.doc.artboards.map((a) => [a.w, a.h])).toEqual([[400, 300]]);
  });

  it('writes outlined type as paths with no text element', async () => {
    const e = new Engine();
    e.newDocument(300, 200);
    e.addNodes('Type', [{ id: 'tx', ...textNode('Go', 10, 100, { font: 'Inter', style: 'Regular', size: 80 }) } as never]);
    const svg = await exportSvg(e.current!, { ...OPTS, outlineText: true });
    expect(svg).not.toContain('<text');
    expect(svg).toContain('<path');
  });
});

describe('SVG import of a hand-written file', () => {
  const file = (body: string, attrs = 'width="200" height="100" viewBox="0 0 100 50"'): string => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;

  it('scales the viewBox to the stated size', async () => {
    const r = await importSvg(file('<rect x="10" y="10" width="20" height="10" fill="#00ff00"/>'));
    expect([r.doc.artboards[0].w, r.doc.artboards[0].h]).toEqual([200, 100]);
    const b = pathBounds(paths(r.doc)[0].d);
    expect([b.x, b.y, b.w, b.h].map((v) => Math.round(v * 100) / 100)).toEqual([20, 20, 40, 20]);
  });

  it('reads millimetre sizes as points', async () => {
    const r = await importSvg(file('<rect width="10" height="10"/>', 'width="210mm" height="297mm"'));
    closeTo(r.doc.artboards[0].w, 595.28, 0.01);
    closeTo(r.doc.artboards[0].h, 841.89, 0.01);
  });

  it('applies group transforms and reads circles, polygons and curves as closed or open paths', async () => {
    const r = await importSvg(file('<g transform="translate(10,20)"><circle cx="10" cy="10" r="5"/><polygon points="0,0 10,0 5,8"/><path d="M0 0 C 10 0 10 10 0 10"/></g>'));
    const ps = paths(r.doc);
    expect(ps).toHaveLength(3);
    const c = pathBounds(ps[0].d);
    closeTo(c.x, (10 + 10 - 5) * 2, 0.01);
    closeTo(c.y, (20 + 10 - 5) * 2, 0.01);
    expect(ps[0].d[0].closed).toBe(true);
    expect(ps[1].d[0].closed).toBe(true);
    expect(ps[1].d[0].pts).toHaveLength(3);
    expect(ps[2].d[0].closed).toBe(false);
  });

  it('refuses a file that is not SVG', async () => {
    await expect(importSvg('<html><body>no</body></html>')).rejects.toThrow(/not a readable SVG/);
    await expect(importSvg('not xml at all <<<')).rejects.toThrow();
  });
});
