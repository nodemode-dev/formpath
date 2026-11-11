import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { parse } from 'opentype.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Engine } from '../src/engine';
import { textNode } from '../src/engine/text';
import type { PathData, TextNode } from '../src/engine/types';
import { api } from '../src/io/api';
import { outlineText } from '../src/io/fonts';
import { exportPdf, glyphNotes } from '../src/io/pdf';
import { useBundledFonts } from './helpers';

const CJK_FILES: Array<[string, string]> = [
  ['Arial Unicode MS', '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'],
  ['Arial Unicode MS', '/Library/Fonts/Arial Unicode.ttf'],
  ['Droid Sans Fallback', '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf'],
  ['Noto Sans CJK SC', '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf'],
  ['Noto Sans CJK SC', '/usr/share/fonts/noto-cjk/NotoSansCJKsc-Regular.otf'],
  ['Microsoft YaHei', 'C:\\Windows\\Fonts\\msyh.ttf'],
];
const cjk = CJK_FILES.find(([, path]) => existsSync(path)) ?? null;
const OMEGA = 'Ω', TOKYO = '東', NOWHERE = String.fromCodePoint(0x10fffd);
const VS16 = '\ufe0f', ZWJ = '\u200d', MARK = '\u0f71', GRIN = String.fromCodePoint(0x1f600);

beforeAll(() => {
  useBundledFonts();
  vi.spyOn(api, 'findFont').mockImplementation(async (family: string) => (cjk && family === cjk[0] ? { id: cjk[1], family, style: 'Regular', full: family, postscript: family } as never : null));
  vi.spyOn(api, 'fontFile').mockImplementation(async (id: string) => { const b = await readFile(id); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; });
  vi.spyOn(api, 'subsetFont').mockImplementation(async (src) => {
    const bytes = 'bytes' in src ? new Uint8Array(src.bytes) : new Uint8Array(await readFile(src.id));
    return { data: bytes, cff: bytes[0] === 0x4f && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4f };
  });
});
afterAll(() => { vi.restoreAllMocks(); });

function engineWith(s: string): Engine {
  const e = new Engine();
  e.newDocument(400, 200);
  e.addNodes('Type', [{ id: 'tx', ...textNode(s, 20, 100, { font: 'Inter', style: 'Regular', size: 40 }) } as TextNode], {});
  return e;
}

function streams(pdf: Buffer): string[] {
  const text = pdf.toString('latin1'), out: string[] = [];
  for (const m of text.matchAll(/stream\r?\n/g)) {
    const start = (m.index ?? 0) + m[0].length, end = text.indexOf('endstream', start);
    const raw = pdf.subarray(start, end);
    try { out.push(inflateSync(raw).toString('latin1')); } catch { out.push(raw.toString('latin1')); }
  }
  return out;
}

const hex = (ch: string): string => (ch.codePointAt(0) as number).toString(16).padStart(4, '0');
const mapped = (cmaps: string[], ch: string): string[] => cmaps.flatMap((c) => [...c.matchAll(new RegExp(`<([0-9a-f]{4})> <${hex(ch)}>`, 'g'))].map((m) => m[1]));

async function livePdf(s: string): Promise<{ cmaps: string[]; drawn: string[]; notes: string[] }> {
  const notes: string[] = [];
  const blob = await exportPdf(engineWith(s).current!, { artboards: [0], preserve: false, ppi: 72, liveText: true, notes: (n) => notes.push(n) });
  const buf = Buffer.from(await blob.arrayBuffer());
  const all = streams(buf), shown = all.filter((x) => / Tf\n/.test(x)).flatMap((x) => [...x.matchAll(/<([0-9a-f]+)>/g)].map((m) => m[1]));
  return { cmaps: all.filter((x) => x.includes('begincmap')), drawn: shown.flatMap((h) => h.match(/.{4}/g) ?? []), notes };
}

const subpaths = (d: PathData | null): number => (d ?? []).length;

describe('PDF export of characters the chosen font lacks', () => {
  it('embeds Omega from a font that has it instead of the empty glyph', async () => {
    const { cmaps, notes } = await livePdf(`A${OMEGA}`);
    const gids = mapped(cmaps, OMEGA);
    expect(gids.length).toBeGreaterThan(0);
    expect(gids.every((g) => g !== '0000')).toBe(true);
    expect(cmaps.length).toBeGreaterThanOrEqual(2);
    expect(notes).toEqual([]);
  });

  it('outlines Omega from a font that has it', async () => {
    const latin = parse((await readFile(new URL('../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff', import.meta.url))).buffer as ArrayBuffer);
    const notdef = latin.glyphs.get(0).getPath(0, 0, 1).commands.filter((c) => c.type === 'M').length;
    const d = await outlineText({ id: 'o', ...textNode(OMEGA, 20, 100, { font: 'Inter', style: 'Regular', size: 40 }) } as TextNode);
    expect(subpaths(d)).toBeGreaterThan(0);
    expect(subpaths(d)).not.toBe(notdef);
  });

  it.skipIf(!cjk)('embeds a CJK character from a system font that has it', async () => {
    const { cmaps, notes } = await livePdf(`A${TOKYO}`);
    const gids = mapped(cmaps, TOKYO);
    expect(gids.length).toBeGreaterThan(0);
    expect(gids.every((g) => g !== '0000')).toBe(true);
    expect(notes).toEqual([]);
  }, 60000);

  it('keeps the box for a character no font has and says so in the export notes', async () => {
    const { notes } = await livePdf(`A${NOWHERE}`);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain(NOWHERE);
  });
});

describe('PDF export of format characters, combining marks and emoji', () => {
  const lookups = (): number => vi.mocked(api.findFont).mock.calls.length;
  const node = (s: string): TextNode => ({ id: 'v', ...textNode(s, 20, 100, { font: 'Inter', style: 'Regular', size: 40 }) } as TextNode);

  it.each([['variation selector 16', VS16], ['zero width joiner', ZWJ], ['combining mark Inter lacks', MARK]])('skips a %s without a font search, a box or a note', async (_label, ch) => {
    const before = lookups();
    const { drawn, notes } = await livePdf(`A${ch}`);
    expect(notes).toEqual([]);
    expect(lookups()).toBe(before);
    expect(drawn.some((g) => g === '0000')).toBe(false);
    expect(await outlineText(node(`A${ch}`))).toEqual(await outlineText(node('A')));
  });

  it('reports colour emoji once, without searching installed fonts', async () => {
    const before = lookups();
    const { notes } = await livePdf(`A${GRIN}${GRIN}${VS16}`);
    expect(lookups()).toBe(before);
    const emoji = notes.filter((n) => n.startsWith('Colour emoji'));
    expect(emoji).toHaveLength(1);
    expect(emoji[0]).toContain(GRIN);
    expect(notes.join(' ')).not.toContain(VS16);
  });
});

describe('PDF export notes', () => {
  it('belong to the export that made them when two run at once', async () => {
    const a: string[] = [], b: string[] = [];
    await Promise.all([
      exportPdf(engineWith(`A${NOWHERE}`).current!, { artboards: [0], preserve: false, ppi: 72, liveText: true, notes: (n) => a.push(n) }),
      exportPdf(engineWith('Plain').current!, { artboards: [0], preserve: false, ppi: 72, liveText: true, notes: (n) => b.push(n) }),
    ]);
    expect(a).toHaveLength(1);
    expect(a[0]).toContain(NOWHERE);
    expect(b).toEqual([]);
  });

  it('name emoji and other missing characters in separate notes', () => {
    const notes = glyphNotes([GRIN, NOWHERE]);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain(GRIN);
    expect(notes[0]).not.toContain(NOWHERE);
    expect(notes[1]).toContain(NOWHERE);
  });
});
