import { inflateSync } from 'node:zlib';
import { Font, Glyph, Path, parse } from 'opentype.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Engine } from '../src/engine';
import { textNode } from '../src/engine/text';
import type { TextNode } from '../src/engine/types';
import { api } from '../src/io/api';
import { exportPdf } from '../src/io/pdf';
import { restricted } from '../src/io/pdf-text';
import { useBundledFonts } from './helpers';

const SNOWMAN = String.fromCodePoint(0x2603), COMET = String.fromCodePoint(0x2604);

function crafted(family: string, ch: string, fsType: number): ArrayBuffer {
  const box = new Path();
  box.moveTo(100, 0);
  box.lineTo(500, 0);
  box.lineTo(500, 600);
  box.lineTo(100, 600);
  box.close();
  const glyphs = [new Glyph({ name: '.notdef', advanceWidth: 600, path: new Path() }), new Glyph({ name: 'mark', unicode: ch.codePointAt(0), advanceWidth: 600, path: box })];
  const bytes = new Uint8Array(new Font({ familyName: family, styleName: 'Regular', unitsPerEm: 1000, ascender: 800, descender: -200, glyphs }).toArrayBuffer());
  const view = new DataView(bytes.buffer), tables = view.getUint16(4);
  for (let i = 0; i < tables; i++) {
    const at = 12 + i * 16;
    if (String.fromCharCode(...bytes.subarray(at, at + 4)) === 'OS/2') view.setUint16(view.getUint32(at + 8) + 8, fsType);
  }
  return bytes.buffer;
}

const FILES: Record<string, ArrayBuffer> = { restricted: crafted('Helvetica Neue', SNOWMAN, 0x0002), installable: crafted('Arial', COMET, 0x0000) };
const IDS: Record<string, string> = { 'Helvetica Neue': 'restricted', Arial: 'installable' };

beforeAll(() => {
  useBundledFonts();
  vi.spyOn(api, 'findFont').mockImplementation(async (family: string) => (IDS[family] ? { id: IDS[family], family, style: 'Regular', full: family, postscript: family.replace(/\s/g, '') } as never : null));
  vi.spyOn(api, 'fontFile').mockImplementation(async (id: string) => FILES[id].slice(0));
  vi.spyOn(api, 'subsetFont').mockImplementation(async (src) => {
    const bytes = 'bytes' in src ? new Uint8Array(src.bytes) : new Uint8Array(FILES[src.id]);
    return { data: bytes, cff: bytes[0] === 0x4f && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4f };
  });
});
afterAll(() => { vi.restoreAllMocks(); });

function streams(pdf: Buffer): string[] {
  const text = pdf.toString('latin1'), out: string[] = [];
  for (const m of text.matchAll(/stream\r?\n/g)) {
    const start = (m.index ?? 0) + m[0].length, end = text.indexOf('endstream', start);
    const raw = pdf.subarray(start, end);
    try { out.push(inflateSync(raw).toString('latin1')); } catch { out.push(raw.toString('latin1')); }
  }
  return out;
}

async function livePdf(s: string): Promise<string[]> {
  const e = new Engine();
  e.newDocument(400, 200);
  e.addNodes('Type', [{ id: 'tx', ...textNode(s, 20, 100, { font: 'Inter', style: 'Regular', size: 40 }) } as TextNode], {});
  const blob = await exportPdf(e.current!, { artboards: [0], preserve: false, ppi: 72, liveText: true });
  return streams(Buffer.from(await blob.arrayBuffer())).filter((x) => x.includes('begincmap'));
}

const maps = (cmaps: string[], ch: string): boolean => cmaps.some((c) => c.includes(`<${(ch.codePointAt(0) as number).toString(16).padStart(4, '0')}>`));

describe('PDF live text and the fallback font licence', () => {
  it('reads the restricted-licence bit from OS/2 fsType', () => {
    expect(restricted(parse(FILES.restricted.slice(0)))).toBe(true);
    expect(restricted(parse(FILES.installable.slice(0)))).toBe(false);
  });

  it('does not embed a fallback face whose fsType restricts embedding', async () => {
    const cmaps = await livePdf(`A${SNOWMAN}`);
    expect(maps(cmaps, SNOWMAN)).toBe(false);
  });

  it('embeds a fallback face whose fsType allows it', async () => {
    const cmaps = await livePdf(`A${COMET}`);
    expect(maps(cmaps, COMET)).toBe(true);
  });
});
