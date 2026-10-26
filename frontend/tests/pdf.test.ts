import { beforeAll, describe, expect, it } from 'vitest';
import { Engine } from '../src/engine';
import { ellipsePath, rectPath } from '../src/engine/geometry';
import { basicAppearance, rgb, solid } from '../src/engine/paint';
import type { PathNode } from '../src/engine/types';
import { exportPdf } from '../src/io/pdf';
import { useBundledFonts } from './helpers';

beforeAll(useBundledFonts);

const OPTS = { artboards: [0], preserve: false, ppi: 72, liveText: false };

async function text(e: Engine, artboards = [0]): Promise<string> {
  const blob = await exportPdf(e.current!, { ...OPTS, artboards });
  return Buffer.from(await blob.arrayBuffer()).toString('latin1');
}

function engine(w: number, h: number, artboards = 1): Engine {
  const e = new Engine();
  e.newDocument(w, h, { artboards });
  e.addNodes('Rect', [{ id: 'r', kind: 'path', d: rectPath(10, 10, 50, 40), rule: 'nonzero', opacity: 1, blend: 'normal', ap: basicAppearance(solid(rgb(200, 0, 0)), solid(rgb(0, 0, 0)), 1) } as PathNode]);
  e.addNodes('Disc', [{ id: 'c', kind: 'path', d: ellipsePath(80, 10, 30, 30), rule: 'nonzero', opacity: 1, blend: 'normal', ap: basicAppearance(solid(rgb(0, 0, 200)), solid(rgb(0, 0, 0)), 1) } as PathNode]);
  return e;
}

const boxes = (pdf: string): number[][] => [...pdf.matchAll(/\/MediaBox \[([\d.\s-]+)\]/g)].map((m) => m[1].trim().split(/\s+/).map(Number));

describe('PDF export', () => {
  it('is a PDF with a header, a cross reference and an end marker', async () => {
    const pdf = await text(engine(612, 792));
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(pdf).toContain('/Type /Catalog');
    expect(pdf).toMatch(/startxref\s+\d+\s+%%EOF\s*$/);
  });

  it('opens at the artboard size: US Letter', async () => {
    expect(boxes(await text(engine(612, 792)))).toEqual([[0, 0, 612, 792]]);
  });

  it('opens at the artboard size: A4 and a landscape page', async () => {
    expect(boxes(await text(engine(595.28, 841.89)))[0].map((v) => Math.round(v * 100) / 100)).toEqual([0, 0, 595.28, 841.89]);
    expect(boxes(await text(engine(1000, 400)))).toEqual([[0, 0, 1000, 400]]);
  });

  it('writes one page per artboard asked for', async () => {
    const e = engine(300, 200, 3);
    expect(boxes(await text(e, [0, 1, 2]))).toHaveLength(3);
    expect(boxes(await text(e, [1]))).toHaveLength(1);
    expect(await text(e, [0, 1, 2])).toMatch(/\/Count 3/);
  });

  it('writes the page count into the page tree and every page refers to it', async () => {
    const pdf = await text(engine(300, 200, 2), [0, 1]);
    expect(pdf).toMatch(/\/Type \/Pages[^>]*\/Count 2/);
    expect((pdf.match(/\/Type \/Page\b(?!s)/g) ?? []).length).toBe(2);
  });

  it('draws the shapes: both fills and both outlines are in the readable page content', async () => {
    const e = engine(300, 200);
    const blob = await exportPdf(e.current!, { ...OPTS, compression: { images: 'auto', jpegQuality: 0.8, downsamplePpi: 0, downsampleAbove: 0, flate: false } });
    const pdf = Buffer.from(await blob.arrayBuffer()).toString('latin1');
    expect(pdf).toMatch(/0\.784 0 0 rg\n10 10 m\n60 10 l\n60 50 l\n10 50 l/);
    expect(pdf).toMatch(/0 0 0\.784 rg/);
    expect((pdf.match(/ c\n/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('refuses a password and a standard together rather than writing a file that breaks the rule', async () => {
    const e = engine(300, 200);
    await expect(exportPdf(e.current!, { ...OPTS, standard: 'x4', security: { openPassword: 'x' } as never })).rejects.toThrow();
  });
});
